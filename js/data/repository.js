/**
 * Datarepository met tenantfiltering én filtertoepassing.
 *
 * Elke functie hier ontvangt de gebruiker als eerste argument en, waar data
 * wordt opgehaald, de filtercontext als laatste. Wat terugkomt is een viewmodel:
 * al gefilterd, al toegestaan, al berekend.
 *
 * DE HARDE REGEL
 * Views halen nooit een volledige tijdreeks op om daar zelf op te filteren, en
 * berekenen nooit zelf een agencytotaal. Zou dat wel gebeuren, dan staat de
 * data van klanten die iemand niet mag zien alsnog in de DOM, in dropdowns, in
 * zoekresultaten en in totalen. De grens hoort vóór de view te liggen, niet
 * erin. Een filter is daarmee ook nooit een manier om die grens te verschuiven:
 * de filtercontext wordt genormaliseerd tegen wat de gebruiker mag zien
 * voordat er ook maar iets wordt opgehaald.
 *
 * ISOLATIE NU EN LATER
 *   nu       frontendautorisatie. Alle demodata zit in dezelfde bundle en is
 *            met de browserconsole te benaderen. Deze laag modelleert de
 *            grens, maar handhaaft hem niet tegen een vastberaden gebruiker.
 *   later    backendautorisatie. Dezelfde beslissingen worden in de Azure API
 *            genomen vóórdat data wordt verstuurd.
 */

import {
  SAMPLE_CLIENTS, SAMPLE_ALERTS, BusinessModel, BUSINESS_MODEL_LABELS,
  PRIMAIRE_METRIEK, CUMULATIEVE_DOELEN, DOEL_METRIEK, DOEL_CONVERSIETYPE,
} from '../sample-data/shared.js';
import { getEcommerceProfiel, ECOMMERCE_CONVERSIE_CONFIG, ECOMMERCE_CONVERSIE_LABELS } from '../sample-data/ecommerce.js';
import { getLeadsProfiel, CONVERSIE_LABELS } from '../sample-data/leads.js';
import { getClientRows, getClientKanalen, getClientModel } from '../sample-data/timeseries.js';
import { toegankelijkeKlantIds, magKlantZien, can, Permission } from '../auth/permissions.js';
import { DEMO_GEBRUIKERS, isAgencyGebruiker } from '../auth/domain.js';
import { metOverrides } from '../auth/demo-auth-provider.js';
import {
  KANALEN, KanaalStatus, KanaalSoort, ADVERTENTIEKANAAL_KEYS, kanaalLabel, sorteerKanalen,
} from '../filters/channels.js';
import { ConversieScope } from '../filters/filter-context.js';
import { dagenInMaand, isVoor, isNa, DATA_VOLLEDIG_TOT } from '../filters/period.js';
import { berekenDeltas } from './metrics.js';
import {
  selecteerRijen, totalenVoorModel, perKanaal, dagelijkseReeks, verdichtReeks,
  conversieTotalen, bepaalDekking, dekkingMeldingen, DekkingStatus,
  bouwLeadFunnel, bouwEcommerceFunnel, budgetPrognose, bouwPeriodeVerhaal,
  schaalVerdeling, PacingStatus,
} from './selectors.js';

const ALLE_CLIENT_IDS = SAMPLE_CLIENTS.map((c) => c.id);

/* ---------------------------------------------------------------
   Klanten
   --------------------------------------------------------------- */

/**
 * Alle klantprofielen die deze gebruiker mag zien.
 * Dit is de bron voor de contextwisselaar en voor iedere lijst met klanten.
 */
export function getAccessibleClients(user) {
  const toegestaan = new Set(toegankelijkeKlantIds(user, ALLE_CLIENT_IDS));
  return SAMPLE_CLIENTS.filter((c) => toegestaan.has(c.id));
}

/**
 * Eén klant, of null wanneer de gebruiker er geen toegang toe heeft.
 * Bewust null in plaats van een fout, zodat een niet toegestane klant-id in de
 * URL hetzelfde gedrag oplevert als een klant die niet bestaat. Het antwoord
 * verklapt daardoor niet of de klant bestaat.
 */
export function getClientById(user, clientId) {
  if (!magKlantZien(user, clientId)) return null;
  return SAMPLE_CLIENTS.find((c) => c.id === clientId) ?? null;
}

function modelVan(client) {
  return getClientModel(client.id) ?? 'awareness';
}

function conversieConfigVan(client) {
  if (client.businessModel === BusinessModel.LEADGEN) {
    return getLeadsProfiel(client.id)?.conversieConfig ?? null;
  }
  if (client.businessModel === BusinessModel.ECOMMERCE) {
    return ECOMMERCE_CONVERSIE_CONFIG;
  }
  return null;
}

function conversieLabelsVan(client) {
  return client.businessModel === BusinessModel.ECOMMERCE ? ECOMMERCE_CONVERSIE_LABELS : CONVERSIE_LABELS;
}

/** De advertentiekanalen waarvoor deze klant data heeft. */
function kanaalKeysVan(client) {
  return sorteerKanalen(getClientKanalen(client.id).map((k) => k.key))
    .filter((k) => ADVERTENTIEKANAAL_KEYS.includes(k));
}

/* ---------------------------------------------------------------
   Filteropties
   --------------------------------------------------------------- */

/**
 * De filterwaarden die binnen een context zijn toegestaan.
 *
 * Dit is de lijst waartegen de filtercontext wordt genormaliseerd. Staat een
 * kanaal hier niet in, dan kan het ook niet via de URL of via localStorage in
 * de selectie belanden.
 *
 * @param {object} user
 * @param {{clientId?: string|null}} opties
 */
export function getFilterOpties(user, { clientId = null } = {}) {
  if (clientId) {
    const client = getClientById(user, clientId);
    if (!client) return { kanalen: [], toegestaneKanalen: [], conversieOpties: [ConversieScope.PRIMAIR], bronnen: [] };

    const keys = kanaalKeysVan(client);
    return {
      kanalen: keys.map((key) => ({
        key,
        label: kanaalLabel(key),
        status: KanaalStatus.GEKOPPELD,
        selecteerbaar: true,
      })),
      toegestaneKanalen: keys,
      conversieOpties: conversieScopesVoor(client),
      bronnen: bronnenVan(client),
    };
  }

  // Agencyweergave: de vereniging van de kanalen van alle toegankelijke klanten.
  const klanten = getAccessibleClients(user);
  const keys = sorteerKanalen(klanten.flatMap(kanaalKeysVan));

  return {
    kanalen: keys.map((key) => ({
      key,
      label: kanaalLabel(key),
      status: KanaalStatus.GEKOPPELD,
      selecteerbaar: true,
    })),
    toegestaneKanalen: keys,
    // Wat een primaire conversie is, verschilt per klant. Over klanten heen
    // heeft één conversiekeuze daarom geen betekenis en wordt hij niet
    // aangeboden.
    conversieOpties: [ConversieScope.PRIMAIR],
    bronnen: [],
  };
}

/** De conversiekeuzes die bij een bedrijfsmodel horen. */
function conversieScopesVoor(client) {
  if (client.businessModel === BusinessModel.LEADGEN) {
    return [ConversieScope.PRIMAIR, ConversieScope.SECUNDAIR, ConversieScope.ALLE];
  }
  if (client.businessModel === BusinessModel.ECOMMERCE) {
    // Zie ecommerce.js: winkelwagen- en checkoutacties gaan aan dezelfde
    // aankoop vooraf, dus een gecombineerd totaal zou dubbel tellen.
    return [ConversieScope.PRIMAIR, ConversieScope.SECUNDAIR];
  }
  return [ConversieScope.PRIMAIR];
}

/** De meetbronnen van een klant met hun status. */
function bronnenVan(client) {
  return KANALEN.filter((k) => k.soort === KanaalSoort.MEETBRON).map((k) => ({
    key: k.key,
    label: k.label,
    status: client.bronnen?.[k.key] ?? KanaalStatus.NIET_GEKOPPELD,
    selecteerbaar: false,
  }));
}

function heeftCrm(client) {
  return client.bronnen?.crm === KanaalStatus.GEKOPPELD;
}

/* ---------------------------------------------------------------
   Kern: totalen van één klant binnen de filtercontext
   --------------------------------------------------------------- */

/**
 * Rekent één klant door binnen de filtercontext.
 * Wordt zowel voor het agencyoverzicht als voor het klantdashboard gebruikt,
 * zodat beide per definitie dezelfde cijfers tonen.
 */
function rekenKlantDoor(client, filters) {
  const model = modelVan(client);
  const config = conversieConfigVan(client);
  const scope = filters.conversionScope ?? ConversieScope.PRIMAIR;
  const kanalen = filters.channels ?? kanaalKeysVan(client);

  const alleRijen = getClientRows(client.id);
  const periodeRijen = selecteerRijen(alleRijen, {
    startDate: filters.periode.startDate,
    endDate: filters.periode.endDate,
    channels: kanalen,
  });
  const vorigeRijen = filters.vergelijkingActief
    ? selecteerRijen(alleRijen, {
      startDate: filters.vergelijking.startDate,
      endDate: filters.vergelijking.endDate,
      channels: kanalen,
    })
    : [];

  const totalen = totalenVoorModel(model, periodeRijen, config, scope);
  const vorigeTotalen = filters.vergelijkingActief
    ? totalenVoorModel(model, vorigeRijen, config, scope)
    : null;

  const verwachteKanalen = kanaalKeysVan(client).filter((k) => kanalen.includes(k));
  const dekking = bepaalDekking(periodeRijen, filters.periode, verwachteKanalen);

  const budget = budgetPrognose({
    maandbudget: client.maandbudget,
    periode: filters.periode,
    uitgaven: totalen.spend,
  });

  return {
    client, model, config, scope, kanalen,
    periodeRijen, vorigeRijen, totalen, vorigeTotalen, dekking, budget,
  };
}

/** De metrieken waarvoor altijd een delta wordt berekend. */
const DELTA_KEYS = {
  leadgen: ['spend', 'impressions', 'clicks', 'ctr', 'cpc', 'sessions', 'users', 'leads', 'cpl',
    'qualifiedLeads', 'cpql', 'appointments', 'quotes', 'customers', 'leadNaarKlant',
    'pipelineValue', 'conversies', 'secondaryConversions', 'revenue', 'roas'],
  ecommerce: ['spend', 'impressions', 'clicks', 'ctr', 'cpc', 'sessions', 'users', 'revenue',
    'roas', 'purchases', 'cpa', 'aov', 'conversieratio', 'productViews', 'addToCarts',
    'checkouts', 'winkelwagenratio', 'checkoutratio', 'aankoopratio', 'conversies'],
  awareness: ['spend', 'impressions', 'clicks', 'ctr', 'cpc', 'cpm'],
};

function deltasVan(model, totalen, vorigeTotalen, vergelijkingActief) {
  return berekenDeltas(DELTA_KEYS[model] ?? DELTA_KEYS.awareness, totalen, vorigeTotalen, { vergelijkingActief });
}

/* ---------------------------------------------------------------
   Doelen
   --------------------------------------------------------------- */

/**
 * Werkelijke waarden bij de doelen, berekend over de geselecteerde periode.
 *
 * Cumulatieve doelen zijn maanddoelen en worden naar rato van de periodelengte
 * omgerekend. Een doel van 130 leads per maand is bij een weekfilter geen
 * eerlijke lat; 130 gedeeld door de maandlengte maal zeven wel. Verhoudingen
 * als de CPL schalen niet mee: die gelden per lead, niet per dag.
 */
export function berekenDoelen(client, totalen, periode, { vorigeTotalen = null, budget = null } = {}) {
  const maandDagen = dagenInMaand(periode.startDate);
  const factor = periode.dagen / maandDagen;

  const waardeUit = (bron, doel) => {
    if (!bron) return null;
    const conversietype = DOEL_CONVERSIETYPE[doel.kpi];
    if (conversietype) return bron.conversiesPerType?.[conversietype] ?? null;
    const metriek = DOEL_METRIEK[doel.kpi];
    return metriek ? bron[metriek] ?? null : null;
  };

  return (client.doelen ?? []).map((doel) => {
    const actueel = waardeUit(totalen, doel);
    const cumulatief = CUMULATIEVE_DOELEN.has(doel.kpi);
    const target = cumulatief ? doel.target * factor : doel.target;

    // Een prognose heeft alleen zin bij een oplopend doel in een lopende
    // periode, en pas nadat er genoeg dagen verstreken zijn. Het aantal
    // verstreken dagen komt uit de periode, niet uit een vaste aanname.
    const prognose =
      cumulatief && actueel != null && budget && !periode.afgerond &&
      budget.verstrekenDagen >= 3 && budget.resterendeDagen > 0
        ? (actueel / budget.verstrekenDagen) * budget.totaalDagen
        : null;

    return {
      ...doel,
      actueel,
      target,
      maandTarget: doel.target,
      vorigePeriode: waardeUit(vorigeTotalen, doel),
      prognose,
      geschaald: cumulatief && Math.abs(factor - 1) > 0.0001,
      // 'binnen' betekent: de waarde hoort onder het doel te blijven.
      richting: doel.kpi === 'maandbudget' ? 'binnen' : lagerIsBeterDoel(doel.kpi) ? 'lager' : 'hoger',
    };
  });
}

function lagerIsBeterDoel(kpi) {
  return ['cpl', 'cpql', 'cpa', 'cpc', 'cpm'].includes(kpi);
}

/* ---------------------------------------------------------------
   Klantstatus
   --------------------------------------------------------------- */

/**
 * Bepaalt de status van een klant met de reden erbij.
 *
 * Een gekleurde badge zonder toelichting dwingt de lezer tot raden, dus iedere
 * status draagt de onderbouwing mee. De volgorde is een prioriteit: een
 * trackingprobleem maakt de rest van de cijfers onbetrouwbaar en wordt daarom
 * als eerste gemeld.
 */
export function klantStatus(samenvatting) {
  if (!samenvatting) return { code: 'onbekend', label: 'Onbekend', reden: '' };
  const { client, totalen, doelen, dekking } = samenvatting;

  if (client.trackingStatus === 'probleem') {
    return {
      code: 'tracking',
      label: 'Trackingprobleem',
      reden: `De datakwaliteit staat op ${client.dataHealth} procent. Cijfers zijn mogelijk onvolledig.`,
    };
  }

  if (dekking?.status === DekkingStatus.GEEN_DATA) {
    return {
      code: 'onvoldoende-data',
      label: 'Onvoldoende data',
      reden: 'Er is geen data binnen de geselecteerde periode en kanalen.',
    };
  }

  if (!doelen?.length) {
    return { code: 'geen-doel', label: 'Doel ontbreekt', reden: 'Er zijn geen maanddoelen ingesteld.' };
  }

  const primair = PRIMAIRE_METRIEK[client.businessModel];
  if (primair && totalen?.[primair] == null) {
    return {
      code: 'onvoldoende-data',
      label: 'Onvoldoende data',
      reden: 'Het primaire resultaat wordt voor deze klant niet gemeten.',
    };
  }

  const meetbaar = doelen.filter((d) => d.actueel != null && d.target != null);
  if (!meetbaar.length) {
    return {
      code: 'onvoldoende-data',
      label: 'Onvoldoende data',
      reden: 'Geen van de doelen heeft een meetbare waarde.',
    };
  }

  const achter = meetbaar.filter((d) => !doelBehaald(d));

  if (!achter.length) {
    return {
      code: 'op-koers',
      label: 'Op koers',
      reden: `Alle ${meetbaar.length} meetbare doelen liggen op of boven het doel.`,
    };
  }

  return {
    code: 'aandacht',
    label: 'Aandacht nodig',
    reden: `${achter.length} van ${meetbaar.length} doelen liggen onder het doel.`,
  };
}

function doelBehaald(doel) {
  if (doel.actueel == null || doel.target == null) return false;
  if (doel.richting === 'binnen') return doel.actueel <= doel.target;
  if (doel.richting === 'lager') return doel.actueel <= doel.target;
  return doel.actueel >= doel.target;
}

/* ---------------------------------------------------------------
   Samenvattingen voor het agencyoverzicht
   --------------------------------------------------------------- */

/**
 * Samenvatting per toegankelijke klant binnen de filtercontext.
 * Dit is de enige bron voor het klantenoverzicht en voor de agencytotalen.
 */
export function getAccessibleClientSummaries(user, filters) {
  return getAccessibleClients(user).map((client) => {
    const basis = rekenKlantDoor(client, beperkFiltersTot(filters, client));
    const doelen = berekenDoelen(client, basis.totalen, filters.periode);
    const deltas = deltasVan(basis.model, basis.totalen, basis.vorigeTotalen, filters.vergelijkingActief);
    const samenvatting = { ...basis, doelen, deltas };
    return { ...samenvatting, status: klantStatus(samenvatting) };
  });
}

/**
 * Beperkt de kanaalselectie tot de kanalen die deze klant daadwerkelijk heeft.
 * Zonder deze stap zou een agencybrede selectie van vier kanalen bij een klant
 * met twee kanalen een lege set opleveren.
 */
function beperkFiltersTot(filters, client) {
  const eigen = kanaalKeysVan(client);
  const overlap = (filters.channels ?? eigen).filter((k) => eigen.includes(k));
  return { ...filters, channels: overlap.length ? overlap : [] };
}

/* ---------------------------------------------------------------
   Signalen
   --------------------------------------------------------------- */

/**
 * Signalen over toegankelijke klanten binnen de geselecteerde periode.
 *
 * Klantgebruikers krijgen hier niets: signalen zijn een intern werkinstrument
 * van het bureau en bevatten formuleringen die niet voor de klant bedoeld zijn.
 *
 * Een signaal over een advertentiekanaal verdwijnt wanneer dat kanaal niet is
 * geselecteerd. Signalen over een meetbron blijven staan: die gaan over de
 * meting zelf en niet over een kanaal dat je kunt wegfilteren.
 */
export function getAccessibleSignals(user, filters = null) {
  if (!can(user, Permission.VIEW_AGENCY_SIGNALS)) return [];
  const toegestaan = new Set(toegankelijkeKlantIds(user, ALLE_CLIENT_IDS));

  return SAMPLE_ALERTS.filter((a) => {
    if (!toegestaan.has(a.klantId)) return false;
    if (!filters) return true;

    const binnenPeriode =
      !isVoor(a.startdatum, filters.periode.startDate) && !isNa(a.startdatum, filters.periode.endDate);
    if (!binnenPeriode) return false;

    const isAdvertentiekanaal = ADVERTENTIEKANAAL_KEYS.includes(a.kanaal);
    if (isAdvertentiekanaal && !(filters.channels ?? []).includes(a.kanaal)) return false;

    return true;
  }).map((a) => ({ ...a, kanaalLabel: kanaalLabel(a.kanaal) }));
}

/* ---------------------------------------------------------------
   Agencyoverzicht
   --------------------------------------------------------------- */

/**
 * Geaggregeerde cijfers over de klanten die deze gebruiker mag zien.
 *
 * Resultaten worden per bedrijfsmodel gescheiden gehouden. Een gemiddelde ROAS
 * over leadgeneratieklanten bestaat niet, en een gemiddelde CPL over webshops
 * evenmin; die door elkaar heen middelen levert een getal op dat nergens naar
 * verwijst.
 */
export function getAgencyOverview(user, filters) {
  const samenvattingen = getAccessibleClientSummaries(user, filters);
  const signalen = getAccessibleSignals(user, filters);

  const ecommerce = samenvattingen.filter((s) => s.client.businessModel === BusinessModel.ECOMMERCE);
  const leadgen = samenvattingen.filter((s) => s.client.businessModel === BusinessModel.LEADGEN);
  const overig = samenvattingen.filter(
    (s) => ![BusinessModel.ECOMMERCE, BusinessModel.LEADGEN].includes(s.client.businessModel)
  );

  const som = (lijst, pad) => {
    const waarden = lijst.map(pad).filter((v) => v != null);
    return waarden.length ? waarden.reduce((a, b) => a + b, 0) : null;
  };
  const gemiddelde = (lijst, pad) => {
    const waarden = lijst.map(pad).filter((v) => v != null && !Number.isNaN(v));
    return waarden.length ? waarden.reduce((a, b) => a + b, 0) / waarden.length : null;
  };

  const totaleSpend = som(samenvattingen, (s) => s.totalen.spend) ?? 0;
  const vorigeSpend = filters.vergelijkingActief
    ? som(samenvattingen, (s) => s.vorigeTotalen?.spend)
    : null;
  const totaalBudget = som(samenvattingen, (s) => s.budget.budget) ?? 0;

  const totalen = {
    spend: totaleSpend,
    revenue: som(ecommerce, (s) => s.totalen.revenue),
    purchases: som(ecommerce, (s) => s.totalen.purchases),
    leads: som(leadgen, (s) => s.totalen.leads),
  };
  const vorigeTotalen = filters.vergelijkingActief
    ? {
      spend: vorigeSpend,
      revenue: som(ecommerce, (s) => s.vorigeTotalen?.revenue),
      purchases: som(ecommerce, (s) => s.vorigeTotalen?.purchases),
      leads: som(leadgen, (s) => s.vorigeTotalen?.leads),
    }
    : null;

  const dekkingProblemen = samenvattingen.filter((s) => s.dekking.status !== DekkingStatus.VOLLEDIG);

  return {
    filters,
    samenvattingen,
    signalen,
    aantalKlanten: samenvattingen.length,
    totaleSpend,
    totaalBudget,
    pacing: totaalBudget ? (totaleSpend / totaalBudget) * 100 : null,
    deltas: berekenDeltas(['spend', 'revenue', 'purchases', 'leads'], totalen, vorigeTotalen, {
      vergelijkingActief: filters.vergelijkingActief,
    }),

    ecommerce: {
      aantal: ecommerce.length,
      omzet: som(ecommerce, (s) => s.totalen.revenue) ?? 0,
      aankopen: som(ecommerce, (s) => s.totalen.purchases) ?? 0,
      gemiddeldeRoas: gemiddelde(ecommerce, (s) => s.totalen.roas),
    },
    leadgen: {
      aantal: leadgen.length,
      leads: som(leadgen, (s) => s.totalen.leads) ?? 0,
      gemiddeldeCpl: gemiddelde(leadgen, (s) => s.totalen.cpl),
      zonderKwalificatie: leadgen.filter((s) => s.totalen.qualifiedLeads == null).length,
    },
    overig: { aantal: overig.length },

    opKoers: samenvattingen.filter((s) => s.status.code === 'op-koers').length,
    aandachtNodig: samenvattingen.filter((s) => s.status.code === 'aandacht').length,
    openSignalen: signalen.length,
    trackingProblemen: samenvattingen.filter((s) => s.client.trackingStatus === 'probleem').length,
    onvolledigeDekking: dekkingProblemen.length,
  };
}

/* ---------------------------------------------------------------
   Portefeuille-inzichten
   --------------------------------------------------------------- */

/**
 * Inzichten over de portefeuille van deze gebruiker, binnen de filtercontext.
 * Alleen bevindingen die uit de geselecteerde data te onderbouwen zijn.
 */
export function getPortfolioInzichten(user, filters) {
  const samenvattingen = getAccessibleClientSummaries(user, filters);
  if (!samenvattingen.length) return [];

  const inzichten = [];
  const pct = (s) => {
    const metriek = PRIMAIRE_METRIEK[s.client.businessModel];
    const delta = metriek ? s.deltas[metriek] : null;
    return delta && ['gestegen', 'gedaald'].includes(delta.status) ? delta.procent : null;
  };

  const metOntwikkeling = samenvattingen
    .map((s) => ({ s, pct: pct(s) }))
    .filter((x) => x.pct != null)
    .sort((a, b) => b.pct - a.pct);

  if (metOntwikkeling.length) {
    const beste = metOntwikkeling[0];
    if (beste.pct > 0) {
      inzichten.push({
        soort: 'positief',
        titel: 'Grootste positieve ontwikkeling',
        tekst: `${beste.s.client.name} groeide met ${beste.pct.toFixed(1)} procent ten opzichte van ${filters.vergelijking.label.toLowerCase()}.`,
        clientId: beste.s.client.id,
      });
    }

    const slechtste = metOntwikkeling[metOntwikkeling.length - 1];
    if (slechtste.pct < 0 && slechtste.s.client.id !== beste.s.client.id) {
      inzichten.push({
        soort: 'negatief',
        titel: 'Grootste negatieve ontwikkeling',
        tekst: `${slechtste.s.client.name} daalde met ${Math.abs(slechtste.pct).toFixed(1)} procent ten opzichte van ${filters.vergelijking.label.toLowerCase()}.`,
        clientId: slechtste.s.client.id,
      });
    }
  }

  const zonderCrm = samenvattingen.filter(
    (s) => s.client.businessModel === BusinessModel.LEADGEN && s.totalen.qualifiedLeads == null
  );
  if (zonderCrm.length) {
    inzichten.push({
      soort: 'aandacht',
      titel: 'Geen meetbare CRM-uitkomst',
      tekst: `Voor ${zonderCrm.length === 1 ? '1 klant' : `${zonderCrm.length} klanten`} ontbreekt een CRM-koppeling: ${zonderCrm.map((s) => s.client.name).join(', ')}.`,
      clientId: zonderCrm[0].client.id,
    });
  }

  const boven = samenvattingen.filter((s) => s.budget.status === PacingStatus.BOVEN_BUDGET);
  if (boven.length) {
    inzichten.push({
      soort: 'negatief',
      titel: 'Boven budget',
      tekst: `${boven.map((s) => s.client.name).join(', ')} ${boven.length === 1 ? 'ligt' : 'liggen'} boven het budget voor deze periode.`,
      clientId: boven[0].client.id,
    });
  }

  const onder = samenvattingen.filter((s) => s.budget.status === PacingStatus.ONDER_BUDGET);
  if (onder.length) {
    inzichten.push({
      soort: 'aandacht',
      titel: 'Achterblijvende budgetbesteding',
      tekst: `${onder.map((s) => s.client.name).join(', ')} ${onder.length === 1 ? 'blijft' : 'blijven'} onder het budget voor deze periode.`,
      clientId: onder[0].client.id,
    });
  }

  const onvolledig = samenvattingen.filter((s) => s.dekking.status === DekkingStatus.GEDEELTELIJK);
  if (onvolledig.length) {
    inzichten.push({
      soort: 'aandacht',
      titel: 'Onvolledige dekking in deze periode',
      tekst: `${onvolledig.map((s) => s.client.name).join(', ')} ${onvolledig.length === 1 ? 'heeft' : 'hebben'} niet over de hele periode data.`,
      clientId: onvolledig[0].client.id,
    });
  }

  const tracking = samenvattingen.filter((s) => s.client.trackingStatus === 'probleem');
  if (tracking.length) {
    inzichten.push({
      soort: 'negatief',
      titel: 'Trackingproblemen',
      tekst: `${tracking.map((s) => s.client.name).join(', ')} ${tracking.length === 1 ? 'heeft' : 'hebben'} een trackingprobleem dat de cijfers onbetrouwbaar maakt.`,
      clientId: tracking[0].client.id,
    });
  }

  return inzichten;
}

/* ---------------------------------------------------------------
   Klantdashboard
   --------------------------------------------------------------- */

/**
 * Het volledige viewmodel van één klant binnen de filtercontext.
 * De view hoeft hier niets meer aan te rekenen; alles wat op het scherm komt,
 * staat er al in.
 */
export function getClientDashboard(user, clientId, filters) {
  const client = getClientById(user, clientId);
  if (!client) return null;

  const eigenFilters = beperkFiltersTot(filters, client);
  const basis = rekenKlantDoor(client, eigenFilters);
  const { model, totalen, vorigeTotalen, config, scope, dekking, budget } = basis;

  const deltas = deltasVan(model, totalen, vorigeTotalen, filters.vergelijkingActief);
  const doelen = berekenDoelen(client, totalen, filters.periode, { vorigeTotalen, budget });
  const kanaalRijen = perKanaal(basis.periodeRijen, model, config, scope);

  const funnel = model === 'ecommerce'
    ? bouwEcommerceFunnel(totalen, vorigeTotalen, { vergelijkingActief: filters.vergelijkingActief })
    : model === 'leadgen'
      ? bouwLeadFunnel(totalen, vorigeTotalen, {
        vergelijkingActief: filters.vergelijkingActief,
        kanaalBron: kanaalBronTekst(eigenFilters.channels),
      })
      : null;

  const reeksVelden = model === 'ecommerce'
    ? ['spend', 'revenue', 'purchases', 'clicks', 'impressions']
    : model === 'leadgen'
      ? ['spend', 'leads', 'qualifiedLeads', 'clicks', 'impressions']
      : ['spend', 'impressions', 'clicks'];

  const ruweReeks = dagelijkseReeks(basis.periodeRijen, reeksVelden, filters.periode);
  const reeks = verdichtReeks(ruweReeks, reeksVelden);

  const samenvatting = { ...basis, doelen, deltas };
  const status = klantStatus(samenvatting);

  return {
    client,
    model,
    type: client.businessModel,
    filters: eigenFilters,
    periode: filters.periode,
    vergelijking: filters.vergelijking,
    vergelijkingActief: filters.vergelijkingActief,

    totalen,
    vorigeTotalen,
    deltas,
    doelen,
    status,
    budget,
    dekking,
    meldingen: dekkingMeldingen(dekking, { crmGekoppeld: heeftCrm(client) }),

    kanaalRijen,
    funnel,
    reeks,
    conversies: bouwConversieOverzicht(client, basis, filters),
    profiel: bouwProfiel(client, basis, filters),
    heeftData: dekking.status !== DekkingStatus.GEEN_DATA,
  };
}

function kanaalBronTekst(channels) {
  const namen = sorteerKanalen(channels ?? []).map(kanaalLabel);
  return namen.length ? namen.join(', ') : 'Geen kanaal geselecteerd';
}

/**
 * Conversies per type, gesplitst in primair en secundair.
 * Beide lijsten worden altijd meegegeven, ongeacht de gekozen scope, zodat de
 * conversiepagina het volledige beeld kan tonen. De scope bepaalt wat er in de
 * KPI's meetelt.
 */
function bouwConversieOverzicht(client, basis, filters) {
  const config = basis.config;
  if (!config) return { primair: [], secundair: [], scope: basis.scope, labels: {} };

  const typen = [...(config.primair ?? []), ...(config.secundair ?? [])];
  const labels = conversieLabelsVan(client);

  if (client.businessModel === BusinessModel.ECOMMERCE) {
    const rij = (type, veld) => ({
      type,
      label: labels[type] ?? type,
      aantal: basis.totalen[veld] ?? null,
      vorigePeriode: filters.vergelijkingActief ? basis.vorigeTotalen?.[veld] ?? null : null,
    });
    return {
      scope: basis.scope,
      labels,
      primair: [rij('purchase', 'purchases')],
      secundair: [rij('add_to_cart', 'addToCarts'), rij('begin_checkout', 'checkouts')],
      uitgeslotenVanTotaal: config.uitgeslotenVanTotaal ?? [],
    };
  }

  const huidig = conversieTotalen(basis.periodeRijen, typen);
  const vorig = filters.vergelijkingActief ? conversieTotalen(basis.vorigeRijen, typen) : {};

  const maak = (lijst) => lijst
    .filter((type) => huidig[type] != null || vorig[type] != null)
    .map((type) => ({
      type,
      label: labels[type] ?? type,
      aantal: huidig[type] ?? null,
      vorigePeriode: filters.vergelijkingActief ? vorig[type] ?? null : null,
      uitgeslotenVanTotaal: (config.uitgeslotenVanTotaal ?? []).includes(type),
    }))
    .sort((a, b) => (b.aantal ?? 0) - (a.aantal ?? 0));

  return {
    scope: basis.scope,
    labels,
    primair: maak(config.primair ?? []),
    secundair: maak(config.secundair ?? []),
    uitgeslotenVanTotaal: config.uitgeslotenVanTotaal ?? [],
  };
}

/**
 * De vaste verdelingen, geschaald naar de geselecteerde periode en kanalen.
 * Zonder Google Ads in de selectie verdwijnen de Google Ads-tabellen: ze tonen
 * dan geen data in plaats van data die niet bij de selectie hoort.
 */
function bouwProfiel(client, basis, filters) {
  const { totalen, model } = basis;
  const googleGeselecteerd = (basis.kanalen ?? []).includes('google_ads');
  const googleRij = basis.periodeRijen.length
    ? perKanaal(basis.periodeRijen.filter((r) => r.channel === 'google_ads'), model, basis.config, basis.scope)[0] ?? null
    : null;

  const periodeFactor = filters.periode.dagen / 30;

  if (client.businessModel === BusinessModel.LEADGEN) {
    const profiel = getLeadsProfiel(client.id);
    if (!profiel) return null;

    const adsDoelen = googleGeselecteerd && googleRij
      ? {
        kosten: googleRij.spend,
        vertoningen: googleRij.impressions,
        klikken: googleRij.clicks,
        leads: googleRij.leads,
        gekwalificeerdeLeads: googleRij.qualifiedLeads,
      }
      : null;

    return {
      laatsteSync: profiel.laatsteSync,
      googleAdsBeschikbaar: googleGeselecteerd && googleRij != null,
      googleAds: adsDoelen
        ? {
          campagnes: schaalVerdeling(profiel.googleAds.campagnes, adsDoelen),
          advertentiegroepen: schaalVerdeling(profiel.googleAds.advertentiegroepen, {
            kosten: adsDoelen.kosten, klikken: adsDoelen.klikken,
            leads: adsDoelen.leads, gekwalificeerdeLeads: adsDoelen.gekwalificeerdeLeads,
          }),
          zoekwoorden: schaalVerdeling(profiel.googleAds.zoekwoorden, adsDoelen),
        }
        : { campagnes: [], advertentiegroepen: [], zoekwoorden: [] },
      verdelingen: {
        landingspaginas: schaalVerdeling(profiel.verdelingen.landingspaginas, { gebruikers: totalen.users, leads: totalen.leads }),
        sourceMedium: schaalVerdeling(profiel.verdelingen.sourceMedium, { gebruikers: totalen.users, leads: totalen.leads }),
        apparaten: schaalVerdeling(profiel.verdelingen.apparaten, { gebruikers: totalen.users, leads: totalen.leads }),
        regios: schaalVerdeling(profiel.verdelingen.regios, { gebruikers: totalen.users, leads: totalen.leads }),
        landen: schaalVerdeling(profiel.verdelingen.landen, { gebruikers: totalen.users, leads: totalen.leads }),
      },
      googleBusinessProfile: schaalGbp(profiel.googleBusinessProfile, periodeFactor),
      werk: profiel.werk,
    };
  }

  if (client.businessModel === BusinessModel.ECOMMERCE) {
    const profiel = getEcommerceProfiel(client.id);
    if (!profiel) return null;

    const adsDoelen = googleGeselecteerd && googleRij
      ? {
        kosten: googleRij.spend,
        vertoningen: googleRij.impressions,
        klikken: googleRij.clicks,
        conversies: googleRij.purchases,
        conversiewaarde: googleRij.revenue,
      }
      : null;

    return {
      laatsteSync: profiel.laatsteSync,
      googleAdsBeschikbaar: googleGeselecteerd && googleRij != null,
      googleAds: adsDoelen
        ? {
          campagnes: schaalVerdeling(profiel.googleAds.campagnes, adsDoelen),
          zoekwoorden: schaalVerdeling(profiel.googleAds.zoekwoorden, adsDoelen),
          matchtypes: schaalVerdeling(profiel.googleAds.matchtypes, adsDoelen),
          eindUrls: schaalVerdeling(profiel.googleAds.eindUrls, adsDoelen),
          apparaten: schaalVerdeling(profiel.googleAds.apparaten, {
            kosten: adsDoelen.kosten, klikken: adsDoelen.klikken,
            conversies: adsDoelen.conversies, conversiewaarde: adsDoelen.conversiewaarde,
          }),
        }
        : { campagnes: [], zoekwoorden: [], matchtypes: [], eindUrls: [], apparaten: [] },
      merchantCenter: profiel.merchantCenter,
      searchConsole: profiel.searchConsole,
      werk: profiel.werk,
    };
  }

  return null;
}

/**
 * Het Google-bedrijfsprofiel is een toekomstige koppeling met vaste
 * maandcijfers. Die worden naar rato van de periode geschaald en als demodata
 * gemarkeerd, zodat ze niet als live meting worden gelezen.
 */
function schaalGbp(gbp, factor) {
  if (!gbp) return null;
  const schaal = (v) => (v == null ? null : Math.round(v * factor));
  return {
    ...gbp,
    profielinteracties: schaal(gbp.profielinteracties),
    telefoongesprekken: schaal(gbp.telefoongesprekken),
    routeaanvragen: schaal(gbp.routeaanvragen),
    websiteklikken: schaal(gbp.websiteklikken),
  };
}

/* ---------------------------------------------------------------
   Periodeverhaal
   --------------------------------------------------------------- */

/**
 * Het verhaal bij de geselecteerde periode.
 *
 * De uitspraken over wat goed ging en wat aandacht nodig heeft, worden uit de
 * gefilterde cijfers afgeleid. De werkzaamheden, vervolgstappen en vragen aan
 * de klant komen uit het werklogboek: dat zijn geen beweringen over de periode
 * maar vastgelegde afspraken, en die veranderen niet door een filter.
 */
export function getPeriodNarrative(user, clientId, filters) {
  const dashboard = getClientDashboard(user, clientId, filters);
  if (!dashboard) return null;

  const gegenereerd = bouwPeriodeVerhaal({
    model: dashboard.model,
    totalen: dashboard.totalen,
    vorigeTotalen: dashboard.vorigeTotalen,
    deltas: dashboard.deltas,
    kanaalRijen: dashboard.kanaalRijen,
    dekking: dashboard.dekking,
    budget: dashboard.budget,
    filters: dashboard.filters,
  });

  const werk = dashboard.profiel?.werk ?? {};

  return {
    ...gegenereerd,
    gedaan: werk.gedaan ?? [],
    volgende: werk.volgende ?? [],
    vanKlant: werk.vanKlant ?? [],
    periodeLabel: dashboard.periode,
    vergelijking: dashboard.vergelijking,
  };
}

/* ---------------------------------------------------------------
   Team
   --------------------------------------------------------------- */

/** Alle agencymedewerkers, inclusief lokale demowijzigingen. */
export function getTeamLeden(user) {
  if (!can(user, Permission.MANAGE_TEAM)) return [];
  return DEMO_GEBRUIKERS.map(metOverrides).filter((u) => isAgencyGebruiker(u));
}

/** Gebruikers binnen de eigen klantorganisatie. */
export function getOrganisatieGebruikers(user, organisatieId) {
  if (!can(user, Permission.MANAGE_CLIENT_USERS)) return [];
  const eigen = user.memberships?.[0]?.organisatieId;
  if (organisatieId !== eigen) return [];

  return DEMO_GEBRUIKERS.map(metOverrides).filter((u) =>
    (u.memberships ?? []).some((m) => m.organisatieId === organisatieId)
  );
}

/** Klanten die aan een medewerker kunnen worden toegewezen. */
export function getToewijsbareKlanten(user) {
  if (!can(user, Permission.MANAGE_CLIENT_ASSIGNMENTS)) return [];
  return SAMPLE_CLIENTS;
}

export { BUSINESS_MODEL_LABELS, BusinessModel, DATA_VOLLEDIG_TOT, kanaalKeysVan };
