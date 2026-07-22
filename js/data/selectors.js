/**
 * Selectorlaag.
 *
 * Pure functies die dagrijen omzetten in totalen, reeksen, funnels, budgetten
 * en verhalen. Geen enkele functie hier kent de gebruiker, de rechten of het
 * scherm; dat is bewust. De repository zet de grens om wie wat mag zien, deze
 * laag rekent alleen nog uit wat er binnen die grens overblijft.
 *
 * Alles is een functie van (rijen, filters). Dezelfde invoer geeft altijd
 * dezelfde uitvoer, dus resultaten kunnen zonder risico worden gecachet en
 * grafieken kunnen zonder bijwerkingen opnieuw worden getekend.
 */

import {
  sommeer, veiligDelen, veiligPercentage, leadgenAfgeleid, ecommerceAfgeleid,
} from './metrics.js';
import {
  DEMO_TODAY, DATA_VOLLEDIG_TOT, aantalDagen, datumReeks, isVoor, isNa,
  dagenInMaand, plusDagen,
} from '../filters/period.js';
import { kanalenTekst, kanaalLabel } from '../filters/channels.js';
import { ConversieScope } from '../filters/filter-context.js';

/* ---------------------------------------------------------------
   Selectie
   --------------------------------------------------------------- */

/** De rijen binnen een datumbereik en een kanaalselectie. */
export function selecteerRijen(rijen, { startDate, endDate, channels }) {
  if (!startDate || !endDate) return [];
  const toegestaan = channels ? new Set(channels) : null;
  return rijen.filter(
    (r) =>
      !isVoor(r.date, startDate) &&
      !isNa(r.date, endDate) &&
      (!toegestaan || toegestaan.has(r.channel))
  );
}

/** Somt een lijst velden op over rijen. Ontbrekende metingen blijven null. */
export function totalenVan(rijen, velden) {
  const totalen = {};
  for (const veld of velden) {
    totalen[veld] = sommeer(rijen, veld).waarde;
  }
  return totalen;
}

/** Somt conversietypen op. Een type dat nergens voorkomt blijft null. */
export function conversieTotalen(rijen, typen) {
  const totalen = {};
  for (const type of typen) {
    let som = 0;
    let gemeten = 0;
    for (const rij of rijen) {
      const waarde = rij.conversies?.[type];
      if (waarde == null) continue;
      som += waarde;
      gemeten += 1;
    }
    totalen[type] = gemeten ? som : null;
  }
  return totalen;
}

/* ---------------------------------------------------------------
   Conversiescope
   --------------------------------------------------------------- */

/**
 * Bepaalt hoeveel conversies er binnen de gekozen scope zijn.
 *
 * Dubbeltelling wordt hier voorkomen. Een formulierstart is een secundaire
 * conversie én een funnelstap die aan de lead voorafgaat; die zou bij "alle
 * conversies" dezelfde uitkomst een tweede keer meetellen. Types in
 * `uitgeslotenVanTotaal` doen daarom niet mee in het totaal, maar blijven wel
 * afzonderlijk zichtbaar.
 */
export function conversiesInScope(conversieTotalenPerType, config, scope) {
  const primair = (config?.primair ?? []).filter((t) => conversieTotalenPerType[t] != null);
  const secundair = (config?.secundair ?? []).filter((t) => conversieTotalenPerType[t] != null);
  const uitgesloten = new Set(config?.uitgeslotenVanTotaal ?? []);

  const som = (typen) => {
    const bruikbaar = typen.filter((t) => conversieTotalenPerType[t] != null);
    if (!bruikbaar.length) return null;
    return bruikbaar.reduce((t, type) => t + conversieTotalenPerType[type], 0);
  };

  const primairTotaal = som(primair);
  const secundairTotaal = som(secundair);
  const secundairZonderOverlap = som(secundair.filter((t) => !uitgesloten.has(t)));

  if (scope === ConversieScope.SECUNDAIR) return secundairTotaal;
  if (scope === ConversieScope.ALLE) {
    if (primairTotaal == null && secundairZonderOverlap == null) return null;
    return (primairTotaal ?? 0) + (secundairZonderOverlap ?? 0);
  }
  return primairTotaal;
}

/* ---------------------------------------------------------------
   Totalen per bedrijfsmodel
   --------------------------------------------------------------- */

const LEADGEN_VELDEN = [
  'spend', 'impressions', 'clicks', 'sessions', 'users', 'newUsers',
  'engagedSessions', 'sessionSeconds', 'landingPageViews', 'engagement',
  'formStarts', 'qualifiedLeads', 'appointments', 'quotes', 'customers',
  'pipelineValue', 'revenue',
];

const ECOMMERCE_VELDEN = [
  'spend', 'impressions', 'clicks', 'sessions', 'users',
  'productViews', 'addToCarts', 'checkouts', 'purchases', 'revenue',
];

const AWARENESS_VELDEN = [
  'spend', 'impressions', 'clicks', 'reach', 'sessions',
  'videoStarts', 'videoCompletions', 'videoWatchSeconds',
  'engagements', 'brandedSearchClicks',
];

/**
 * Totalen van een leadgeneratieklant.
 * Leads worden afgeleid uit de primaire conversietypen, zodat het aantal leads
 * en de conversietabel per definitie hetzelfde vertellen.
 */
export function leadgenTotalen(rijen, conversieConfig, scope = ConversieScope.PRIMAIR) {
  const basis = totalenVan(rijen, LEADGEN_VELDEN);
  const typen = [...(conversieConfig?.primair ?? []), ...(conversieConfig?.secundair ?? [])];
  const perType = conversieTotalen(rijen, typen);

  const leads = conversiesInScope(perType, conversieConfig, ConversieScope.PRIMAIR);
  const secundair = conversiesInScope(perType, conversieConfig, ConversieScope.SECUNDAIR);
  const inScope = conversiesInScope(perType, conversieConfig, scope);

  const totalen = {
    ...basis,
    leads,
    secondaryConversions: secundair,
    conversies: inScope,
    conversiesPerType: perType,
  };

  return {
    ...totalen,
    ...leadgenAfgeleid(totalen),
    kostenPerConversie: veiligDelen(totalen.spend, inScope),
    gemSessieduur: veiligDelen(basis.sessionSeconds, basis.sessions),
    engagementRate: veiligPercentage(basis.engagedSessions, basis.sessions),
  };
}

/** Totalen van een e-commerceklant. */
export function ecommerceTotalen(rijen, conversieConfig, scope = ConversieScope.PRIMAIR) {
  const basis = totalenVan(rijen, ECOMMERCE_VELDEN);

  const secundair =
    basis.addToCarts == null && basis.checkouts == null
      ? null
      : (basis.addToCarts ?? 0) + (basis.checkouts ?? 0);

  // Bij e-commerce zijn winkelwagen- en checkoutacties funnelstappen die aan
  // dezelfde aankoop voorafgaan. Ze bij de transacties optellen zou dezelfde
  // uitkomst dubbel tellen, dus kent dit model geen optie "alle conversies".
  const inScope = scope === ConversieScope.SECUNDAIR ? secundair : basis.purchases;

  const totalen = { ...basis, secondaryConversions: secundair, conversies: inScope };

  return {
    ...totalen,
    ...ecommerceAfgeleid(totalen),
    kostenPerConversie: veiligDelen(totalen.spend, inScope),
  };
}

/**
 * Totalen van een awarenessklant.
 *
 * Bereik is de lastige: unieke personen zijn niet op te tellen over dagen,
 * want dezelfde persoon telt dan meerdere keren mee. Het veld `reach` is
 * daarom nadrukkelijk het dagbereik, opgeteld over de periode. De frequentie
 * die eruit volgt is een gemiddelde per dag, niet over de hele periode, en dat
 * staat als uitleg bij de metriek. Het unieke bereik over de periode wordt niet
 * gemeten en wordt dus ook niet getoond.
 */
export function awarenessTotalen(rijen) {
  const basis = totalenVan(rijen, AWARENESS_VELDEN);
  const dagen = new Set(rijen.map((r) => r.date)).size;

  return {
    ...basis,
    ctr: veiligPercentage(basis.clicks, basis.impressions),
    cpc: veiligDelen(basis.spend, basis.clicks),
    cpm: veiligDelen(basis.spend, basis.impressions == null ? null : basis.impressions / 1000),
    kostenPerBereik: veiligDelen(basis.spend, basis.reach == null ? null : basis.reach / 1000),
    frequentie: veiligDelen(basis.impressions, basis.reach),
    bereikPerDag: veiligDelen(basis.reach, dagen || null),
    videoVoltooiing: veiligPercentage(basis.videoCompletions, basis.videoStarts),
    gemKijktijd: veiligDelen(basis.videoWatchSeconds, basis.videoStarts),
    engagementRatio: veiligPercentage(basis.engagements, basis.impressions),
  };
}

/** Kiest de juiste totaalberekening bij een bedrijfsmodel. */
export function totalenVoorModel(model, rijen, conversieConfig, scope) {
  if (model === 'leadgen') return leadgenTotalen(rijen, conversieConfig, scope);
  if (model === 'ecommerce') return ecommerceTotalen(rijen, conversieConfig, scope);
  return awarenessTotalen(rijen);
}

/* ---------------------------------------------------------------
   Reeksen en verdelingen
   --------------------------------------------------------------- */

/**
 * Dagelijkse totalen binnen de periode.
 * Dagen zonder rijen krijgen null en geen nul, zodat een grafiek een gat toont
 * in plaats van een daling naar de bodem.
 */
export function dagelijkseReeks(rijen, velden, { startDate, endDate }) {
  const perDatum = new Map();
  for (const rij of rijen) {
    if (!perDatum.has(rij.date)) perDatum.set(rij.date, []);
    perDatum.get(rij.date).push(rij);
  }

  return datumReeks(startDate, endDate).map((datum) => {
    const dagRijen = perDatum.get(datum) ?? [];
    const punt = { date: datum, heeftData: dagRijen.length > 0 };
    for (const veld of velden) {
      punt[veld] = dagRijen.length ? sommeer(dagRijen, veld).waarde : null;
    }
    return punt;
  });
}

/**
 * Vat een dagreeks samen tot maximaal `maxPunten` blokken.
 * Een grafiek met 365 datumlabels is niet leesbaar; een lange periode wordt
 * daarom per week of per maand samengevat, met vermelding van de stapgrootte.
 */
export function verdichtReeks(reeks, velden, maxPunten = 45) {
  if (reeks.length <= maxPunten) return { punten: reeks, stap: 'dag' };

  const blokgrootte = Math.ceil(reeks.length / maxPunten);
  const punten = [];

  for (let i = 0; i < reeks.length; i += blokgrootte) {
    const blok = reeks.slice(i, i + blokgrootte);
    const punt = {
      date: blok[0].date,
      tot: blok[blok.length - 1].date,
      heeftData: blok.some((p) => p.heeftData),
    };
    for (const veld of velden) {
      const waarden = blok.map((p) => p[veld]).filter((v) => v != null);
      punt[veld] = waarden.length ? waarden.reduce((a, b) => a + b, 0) : null;
    }
    punten.push(punt);
  }

  return { punten, stap: blokgrootte >= 28 ? 'maand' : blokgrootte >= 7 ? 'week' : `${blokgrootte} dagen` };
}

/** Totalen per kanaal, gesorteerd op uitgaven. */
export function perKanaal(rijen, model, conversieConfig, scope) {
  const perKey = new Map();
  for (const rij of rijen) {
    if (!perKey.has(rij.channel)) perKey.set(rij.channel, []);
    perKey.get(rij.channel).push(rij);
  }

  return [...perKey.entries()]
    .map(([key, kanaalRijen]) => ({
      channel: key,
      label: kanaalLabel(key),
      dagen: new Set(kanaalRijen.map((r) => r.date)).size,
      ...totalenVoorModel(model, kanaalRijen, conversieConfig, scope),
    }))
    .sort((a, b) => (b.spend ?? 0) - (a.spend ?? 0));
}

/* ---------------------------------------------------------------
   Groei-ontleding
   --------------------------------------------------------------- */

/**
 * Ontleedt een omzetverandering in verkeer, conversie en orderwaarde.
 *
 * Omzet is sessies maal conversieratio maal orderwaarde. Door de factoren één
 * voor één te vervangen, valt de verandering exact in drie stukken uiteen die
 * samen precies het verschil vormen. Dat is iets anders dan drie losse
 * procentuele veranderingen naast elkaar zetten: die tellen niet op en laten in
 * het midden welke factor de omzet werkelijk stuurde.
 *
 * Ontbreekt een van de factoren, dan is de ontleding niet te maken en komt er
 * null terug in plaats van een schatting.
 */
export function ontleedOmzetgroei(huidig, vorig) {
  if (!huidig || !vorig) return null;

  const s0 = vorig.sessions; const s1 = huidig.sessions;
  const c0 = veiligDelen(vorig.purchases, vorig.sessions);
  const c1 = veiligDelen(huidig.purchases, huidig.sessions);
  const a0 = vorig.aov; const a1 = huidig.aov;

  if ([s0, s1, c0, c1, a0, a1].some((v) => v == null)) return null;

  const verkeer = (s1 - s0) * c0 * a0;
  const conversie = s1 * (c1 - c0) * a0;
  const orderwaarde = s1 * c1 * (a1 - a0);
  const totaal = verkeer + conversie + orderwaarde;

  const factoren = [
    { key: 'verkeer', label: 'meer of minder verkeer', bijdrage: verkeer },
    { key: 'conversie', label: 'een hogere of lagere conversieratio', bijdrage: conversie },
    { key: 'orderwaarde', label: 'een hogere of lagere gemiddelde orderwaarde', bijdrage: orderwaarde },
  ].sort((a, b) => Math.abs(b.bijdrage) - Math.abs(a.bijdrage));

  return {
    totaal,
    verkeer,
    conversie,
    orderwaarde,
    factoren,
    grootste: factoren[0],
    // Het aandeel van de grootste factor in de totale verandering.
    aandeelGrootste: totaal === 0 ? null : Math.abs(factoren[0].bijdrage) / Math.abs(totaal),
  };
}

/**
 * Ontleedt een verandering in het aantal leads in verkeer en conversie.
 * Leads zijn klikken maal het aandeel klikken dat een lead werd.
 */
export function ontleedLeadgroei(huidig, vorig) {
  if (!huidig || !vorig) return null;

  const k0 = vorig.clicks; const k1 = huidig.clicks;
  const c0 = veiligDelen(vorig.leads, vorig.clicks);
  const c1 = veiligDelen(huidig.leads, huidig.clicks);
  if ([k0, k1, c0, c1].some((v) => v == null)) return null;

  const verkeer = (k1 - k0) * c0;
  const conversie = k1 * (c1 - c0);
  const totaal = verkeer + conversie;

  const factoren = [
    { key: 'verkeer', label: 'meer of minder klikken', bijdrage: verkeer },
    { key: 'conversie', label: 'een hogere of lagere conversie op de website', bijdrage: conversie },
  ].sort((a, b) => Math.abs(b.bijdrage) - Math.abs(a.bijdrage));

  return { totaal, verkeer, conversie, factoren, grootste: factoren[0] };
}

/* ---------------------------------------------------------------
   Verdelingstabellen
   --------------------------------------------------------------- */

function somVeld(rijen, veld) {
  const waarden = rijen.map((r) => r[veld]).filter((v) => v != null);
  return waarden.length ? waarden.reduce((a, b) => a + b, 0) : null;
}

/**
 * Schaalt een vaste verdelingstabel naar de geselecteerde periode en kanalen.
 *
 * Iedere kolom krijgt zijn eigen factor: het gefilterde totaal gedeeld door het
 * totaal van de vaste tabel. De verhoudingen binnen de tabel blijven gelijk,
 * maar het niveau sluit altijd aan op de KPI's erboven in plaats van een eigen
 * leven te leiden. Dat de verhoudingen zelf niet met de periode meebewegen, is
 * een beperking van de demodata en staat als zodanig in de README.
 *
 * Een doel dat null is, maakt de kolom null: liever geen getal dan een getal
 * dat nergens op slaat.
 *
 * @param {object[]} rijen  de vaste verdeling
 * @param {Record<string, number|null>} doelen  per kolomnaam het gefilterde totaal
 */
export function schaalVerdeling(rijen, doelen) {
  if (!rijen?.length) return [];

  const factoren = {};
  for (const [veld, doel] of Object.entries(doelen)) {
    const basis = somVeld(rijen, veld);
    factoren[veld] = doel == null || !basis ? null : doel / basis;
  }

  return rijen.map((rij) => {
    const nieuw = { ...rij };
    for (const veld of Object.keys(doelen)) {
      if (!(veld in rij)) continue;
      if (rij[veld] == null) { nieuw[veld] = null; continue; }
      nieuw[veld] = factoren[veld] == null ? null : rij[veld] * factoren[veld];
    }
    return verrijkVerdelingsrij(nieuw);
  });
}

/** Berekent afgeleide kolommen opnieuw uit de geschaalde waarden. */
function verrijkVerdelingsrij(rij) {
  const uitkomst = rij.conversies ?? rij.leads ?? null;
  return {
    ...rij,
    ctr: veiligPercentage(rij.klikken, rij.vertoningen),
    cpc: veiligDelen(rij.kosten, rij.klikken),
    cpa: veiligDelen(rij.kosten, uitkomst),
    cpql: veiligDelen(rij.kosten, rij.gekwalificeerdeLeads),
    roas: veiligDelen(rij.conversiewaarde, rij.kosten),
    conversieratio: veiligPercentage(uitkomst, rij.klikken),
  };
}

/* ---------------------------------------------------------------
   Datakwaliteit
   --------------------------------------------------------------- */

export const DekkingStatus = {
  VOLLEDIG: 'volledig',
  GEDEELTELIJK: 'gedeeltelijk',
  GEEN_DATA: 'geen-data',
};

/**
 * Beschrijft hoe volledig de data binnen de periode is.
 *
 * Er wordt onderscheid gemaakt tussen vier situaties die anders op één hoop
 * belanden: nul als gemeten resultaat, ontbrekende dagen, een kanaal dat in de
 * periode nog niet bestond, en een periode die zo recent is dat de bronnen nog
 * niet compleet zijn.
 */
export function bepaalDekking(rijen, periode, verwachteKanalen) {
  const dagenMetData = new Set(rijen.map((r) => r.date));
  const totaalDagen = aantalDagen(periode.startDate, periode.endDate);

  const perKanaalDagen = new Map();
  for (const rij of rijen) {
    perKanaalDagen.set(rij.channel, (perKanaalDagen.get(rij.channel) ?? 0) + 1);
  }

  const kanalenZonderData = verwachteKanalen.filter((k) => !perKanaalDagen.has(k));
  const kanalenGedeeltelijk = verwachteKanalen.filter((k) => {
    const dagen = new Set(rijen.filter((r) => r.channel === k).map((r) => r.date)).size;
    return dagen > 0 && dagen < totaalDagen;
  });

  const ontbrekendeDagen = totaalDagen - dagenMetData.size;
  const bevatVoorlopigeDagen = !isVoor(periode.endDate, plusDagen(DATA_VOLLEDIG_TOT, 1));

  let status = DekkingStatus.VOLLEDIG;
  if (!dagenMetData.size) status = DekkingStatus.GEEN_DATA;
  else if (ontbrekendeDagen > 0 || kanalenZonderData.length || kanalenGedeeltelijk.length) {
    status = DekkingStatus.GEDEELTELIJK;
  }

  return {
    status,
    totaalDagen,
    dagenMetData: dagenMetData.size,
    ontbrekendeDagen,
    kanalenZonderData,
    kanalenGedeeltelijk,
    bevatVoorlopigeDagen,
    volledigTot: DATA_VOLLEDIG_TOT,
  };
}

/** Zet de dekking om in leesbare meldingen. Lege lijst betekent: niets aan de hand. */
export function dekkingMeldingen(dekking, { crmGekoppeld = true } = {}) {
  const meldingen = [];

  if (dekking.status === DekkingStatus.GEEN_DATA) {
    meldingen.push({
      soort: 'geen-data',
      tekst: 'Er is voor deze periode en kanaalselectie geen data beschikbaar.',
    });
    return meldingen;
  }

  if (dekking.ontbrekendeDagen > 0) {
    meldingen.push({
      soort: 'gedeeltelijk',
      tekst: `Voor ${dekking.ontbrekendeDagen} van de ${dekking.totaalDagen} dagen in deze periode is geen data aanwezig.`,
    });
  }
  for (const kanaal of dekking.kanalenGedeeltelijk) {
    meldingen.push({
      soort: 'gedeeltelijk',
      tekst: `${kanaalLabel(kanaal)} heeft niet over de hele periode data geleverd.`,
    });
  }
  for (const kanaal of dekking.kanalenZonderData) {
    meldingen.push({
      soort: 'geen-data',
      tekst: `${kanaalLabel(kanaal)} heeft in deze periode geen data geleverd.`,
    });
  }
  if (dekking.bevatVoorlopigeDagen) {
    meldingen.push({
      soort: 'voorlopig',
      tekst: `De meest recente dagen kunnen nog onvolledig zijn. Alle bronnen zijn compleet tot en met ${dekking.volledigTot}.`,
    });
  }
  if (!crmGekoppeld) {
    meldingen.push({
      soort: 'niet-gekoppeld',
      tekst: 'Er is geen CRM-koppeling, waardoor leadkwaliteit en klanten niet meetbaar zijn.',
    });
  }

  return meldingen;
}

/* ---------------------------------------------------------------
   Funnels
   --------------------------------------------------------------- */

export const LEAD_FUNNEL_STAPPEN = [
  { key: 'impressions', label: 'Impressies', bron: 'kanaal' },
  { key: 'clicks', label: 'Klikken', bron: 'kanaal' },
  { key: 'landingPageViews', label: 'Landingspagina bekeken', bron: 'Google Analytics 4' },
  { key: 'engagement', label: 'Engagement', bron: 'Google Analytics 4' },
  { key: 'formStarts', label: 'Formulier gestart', bron: 'Google Analytics 4' },
  { key: 'leads', label: 'Lead', bron: 'Google Analytics 4' },
  { key: 'qualifiedLeads', label: 'Gekwalificeerde lead', bron: 'CRM' },
  { key: 'appointments', label: 'Afspraak of offerte', bron: 'CRM' },
  { key: 'customers', label: 'Klant', bron: 'CRM' },
];

export const ECOMMERCE_FUNNEL_STAPPEN = [
  { key: 'productViews', label: 'Product bekeken', bron: 'Google Analytics 4' },
  { key: 'addToCarts', label: 'Toegevoegd aan winkelwagen', bron: 'Google Analytics 4' },
  { key: 'checkouts', label: 'Checkout gestart', bron: 'Google Analytics 4' },
  { key: 'purchases', label: 'Aankoop', bron: 'Google Analytics 4' },
];

/**
 * Onder dit volume in de eerste beoordeelde stap wordt geen knelpunt benoemd.
 * Bij kleine aantallen is het verschil tussen stappen ruis, en een knelpunt
 * aanwijzen op ruis is misleidender dan niets zeggen.
 */
const MINIMUM_VOLUME_VOOR_KNELPUNT = 100;

/**
 * Bouwt een funnel uit totalen.
 *
 * De beoordeling van het knelpunt begint bewust niet bij de eerste stap. De
 * stap van impressie naar klik is de doorklikratio en ligt in advertenties
 * altijd rond enkele procenten; die zou het knelpunt permanent opeisen zonder
 * iets te zeggen. De beoordeling begint daarom bij de landingspagina, waar een
 * verlies wel beïnvloedbaar is.
 */
export function bouwFunnel(stappen, totalen, vorigeTotalen, {
  eersteBeoordeeldeStap, kanaalBron = 'Advertentiekanalen', vergelijkingActief = true,
} = {}) {
  const rijen = stappen.map((stap, i) => {
    const volume = totalen?.[stap.key] ?? null;
    const vorigeStap = i === 0 ? null : totalen?.[stappen[i - 1].key] ?? null;
    const vorigePeriode = vergelijkingActief ? vorigeTotalen?.[stap.key] ?? null : null;
    const meetbaar = volume != null && vorigeStap != null && vorigeStap !== 0;
    const eerste = totalen?.[stappen[0].key] ?? null;

    return {
      ...stap,
      bron: stap.bron === 'kanaal' ? kanaalBron : stap.bron,
      volume,
      doorstroom: i === 0 ? (volume == null ? null : 100) : meetbaar ? (volume / vorigeStap) * 100 : null,
      uitval: meetbaar ? vorigeStap - volume : null,
      vanTotaal: volume != null && eerste ? (volume / eerste) * 100 : null,
      vorigePeriode,
      verschil:
        volume != null && vorigePeriode != null && vorigePeriode !== 0
          ? ((volume - vorigePeriode) / vorigePeriode) * 100
          : null,
    };
  });

  const startIndex = Math.max(
    0,
    stappen.findIndex((s) => s.key === eersteBeoordeeldeStap)
  );

  const beoordeeld = rijen.slice(startIndex).filter((r) => r.doorstroom != null);
  const instroom = rijen[startIndex]?.volume ?? null;
  const genoegVolume = instroom != null && instroom >= MINIMUM_VOLUME_VOOR_KNELPUNT;

  const knelpunt =
    genoegVolume && beoordeeld.length
      ? beoordeeld.reduce((laagste, r) => (laagste === null || r.doorstroom < laagste.doorstroom ? r : laagste), null)
      : null;

  return {
    rijen,
    knelpunt,
    onvoldoendeVolume: !genoegVolume,
    instroom,
    minimumVolume: MINIMUM_VOLUME_VOOR_KNELPUNT,
  };
}

export function bouwLeadFunnel(totalen, vorigeTotalen, opties = {}) {
  return bouwFunnel(LEAD_FUNNEL_STAPPEN, totalen, vorigeTotalen, {
    eersteBeoordeeldeStap: 'landingPageViews',
    ...opties,
  });
}

export function bouwEcommerceFunnel(totalen, vorigeTotalen, opties = {}) {
  return bouwFunnel(ECOMMERCE_FUNNEL_STAPPEN, totalen, vorigeTotalen, {
    eersteBeoordeeldeStap: 'productViews',
    ...opties,
  });
}

/* ---------------------------------------------------------------
   Budget en prognose
   --------------------------------------------------------------- */

export const PacingStatus = {
  OP_SCHEMA: 'op-schema',
  BOVEN_BUDGET: 'boven-budget',
  ONDER_BUDGET: 'onder-budget',
  GEEN_PROGNOSE: 'geen-prognose',
  GEEN_BUDGET: 'geen-budget',
};

export const PACING_LABELS = {
  [PacingStatus.OP_SCHEMA]: 'Op schema',
  [PacingStatus.BOVEN_BUDGET]: 'Boven budget',
  [PacingStatus.ONDER_BUDGET]: 'Onder budget',
  [PacingStatus.GEEN_PROGNOSE]: 'Geen prognose',
  [PacingStatus.GEEN_BUDGET]: 'Geen budget ingesteld',
};

/** Minimaal aantal verstreken dagen voordat een prognose betekenis heeft. */
const MINIMUM_DAGEN_VOOR_PROGNOSE = 3;

/**
 * Budgetstatus en prognose voor de geselecteerde periode.
 *
 * Het aantal verstreken dagen wordt uit de periode zelf afgeleid en staat
 * nergens meer vast. Een afgeronde periode krijgt geen prognose: daar valt
 * niets meer te voorspellen, alleen te constateren.
 *
 * Het maandbudget wordt naar rato van het aantal dagen naar de periode
 * omgerekend, zodat een periode van zeven dagen niet tegen een maandbudget
 * wordt afgezet.
 */
export function budgetPrognose({ maandbudget, periode, uitgaven, vandaag = DEMO_TODAY }) {
  // Een lopende kalenderperiode loopt door tot het einde van de maand of het
  // kwartaal; daar valt iets te voorspellen. Een voortschrijdend venster is per
  // definitie al voorbij: alle dagen zijn verstreken en een prognose zou niets
  // toevoegen aan het bedrag dat er al staat.
  const totaalDagen = periode.prognoseTot
    ? aantalDagen(periode.startDate, periode.prognoseTot)
    : periode.dagen;
  const verstreken = Math.min(periode.dagen, totaalDagen);
  const resterend = Math.max(0, totaalDagen - verstreken);

  const dagenInDeMaand = dagenInMaand(periode.startDate);
  const budget = maandbudget == null ? null : (maandbudget / dagenInDeMaand) * totaalDagen;

  const basis = {
    budget,
    maandbudget: maandbudget ?? null,
    totaalDagen,
    verstrekenDagen: verstreken,
    resterendeDagen: resterend,
    uitgaven: uitgaven ?? null,
    gemiddeldPerDag: veiligDelen(uitgaven, verstreken),
    besteedPercentage: veiligPercentage(uitgaven, budget),
    prognose: null,
    verschil: null,
    prognoseMogelijk: false,
  };

  if (maandbudget == null) {
    return { ...basis, status: PacingStatus.GEEN_BUDGET, reden: 'Voor deze klant is geen budget vastgelegd.' };
  }
  if (uitgaven == null) {
    return { ...basis, status: PacingStatus.GEEN_PROGNOSE, reden: 'Er zijn geen uitgaven gemeten in deze periode.' };
  }

  if (periode.afgerond || resterend === 0) {
    const verschil = uitgaven - budget;
    return {
      ...basis,
      verschil,
      status: statusUitVerschil(verschil, budget),
      reden: periode.afgerond
        ? `De periode is afgerond, dus een prognose voegt niets toe. Alle ${totaalDagen} dagen zijn verstreken.`
        : `Alle ${totaalDagen} dagen van deze periode zijn verstreken, dus er valt niets meer te voorspellen.`,
    };
  }

  if (verstreken < MINIMUM_DAGEN_VOOR_PROGNOSE) {
    return {
      ...basis,
      status: PacingStatus.GEEN_PROGNOSE,
      reden: `Er zijn pas ${verstreken} ${verstreken === 1 ? 'dag' : 'dagen'} verstreken. Dat is te weinig voor een betrouwbare prognose.`,
    };
  }

  const prognose = (uitgaven / verstreken) * totaalDagen;
  const verschil = prognose - budget;

  return {
    ...basis,
    prognose,
    verschil,
    prognoseMogelijk: true,
    status: statusUitVerschil(verschil, budget),
    reden: `Prognose op basis van ${verstreken} verstreken van ${totaalDagen} dagen.`,
  };
}

function statusUitVerschil(verschil, budget) {
  if (!budget) return PacingStatus.GEEN_PROGNOSE;
  const afwijking = (verschil / budget) * 100;
  if (afwijking > 5) return PacingStatus.BOVEN_BUDGET;
  if (afwijking < -20) return PacingStatus.ONDER_BUDGET;
  return PacingStatus.OP_SCHEMA;
}

/* ---------------------------------------------------------------
   Periodeverhaal
   --------------------------------------------------------------- */

const nf = new Intl.NumberFormat('nl-NL');
const cf2 = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const cf0 = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

/**
 * Bouwt feitelijke uitspraken over de geselecteerde periode.
 *
 * Iedere zin is direct uit de gefilterde cijfers af te leiden. Er staat geen
 * enkele bewering in over data die buiten het filter valt, en er wordt geen
 * dramatiek toegevoegd: als er niets bijzonders te melden is, is de lijst leeg.
 */
export function bouwPeriodeVerhaal({
  model, totalen, vorigeTotalen, deltas, kanaalRijen, dekking, budget, filters,
}) {
  const goed = [];
  const aandacht = [];
  const meetbeperkingen = [];

  const vergelijkbaar = (key) => deltas?.[key] && ['gestegen', 'gedaald'].includes(deltas[key].status);
  const pct = (key) => Math.abs(deltas[key].procent).toFixed(0);

  /* Kosten per resultaat */
  const kostenKey = model === 'ecommerce' ? 'cpa' : 'cpl';
  if (vergelijkbaar(kostenKey)) {
    const gestegen = deltas[kostenKey].status === 'gestegen';
    const zin = model === 'ecommerce'
      ? `De kosten per transactie liggen ${pct(kostenKey)} procent ${gestegen ? 'boven' : 'onder'} de vorige periode`
      : `De CPL ligt ${pct(kostenKey)} procent ${gestegen ? 'boven' : 'onder'} de vorige periode`;
    (gestegen ? aandacht : goed).push(zin);
  }

  /* Omzet tegenover uitgaven */
  if (model === 'ecommerce' && vergelijkbaar('revenue')) {
    const omzetOp = deltas.revenue.status === 'gestegen';
    if (deltas.spend?.status === 'gelijk') {
      goed.push(`De omzet ${omzetOp ? 'steeg' : 'daalde'} met ${pct('revenue')} procent terwijl de uitgaven gelijk bleven`);
    } else if (vergelijkbaar('spend')) {
      const zin = `De omzet ${omzetOp ? 'steeg' : 'daalde'} met ${pct('revenue')} procent bij ${deltas.spend.status === 'gestegen' ? 'hogere' : 'lagere'} uitgaven`;
      (omzetOp ? goed : aandacht).push(zin);
    }
  }

  /* Primair volume */
  const volumeKey = model === 'ecommerce' ? 'purchases' : 'leads';
  if (vergelijkbaar(volumeKey)) {
    const gestegen = deltas[volumeKey].status === 'gestegen';
    const naam = model === 'ecommerce' ? 'transacties' : 'leads';
    const zin = `Het aantal ${naam} ging van ${nf.format(Math.round(deltas[volumeKey].vorig))} naar ${nf.format(Math.round(deltas[volumeKey].huidig))}`;
    (gestegen ? goed : aandacht).push(zin);
  }

  /* Kanaalbijdrage */
  const uitkomstVeld = model === 'ecommerce' ? 'purchases' : 'leads';
  const metUitkomst = (kanaalRijen ?? []).filter((k) => k[uitkomstVeld] != null && k[uitkomstVeld] > 0);
  const totaalUitkomst = metUitkomst.reduce((t, k) => t + k[uitkomstVeld], 0);
  if (metUitkomst.length > 1 && totaalUitkomst > 0) {
    const beste = [...metUitkomst].sort((a, b) => b[uitkomstVeld] - a[uitkomstVeld])[0];
    goed.push(
      `${beste.label} leverde ${nf.format(Math.round(beste[uitkomstVeld]))} van de ${nf.format(Math.round(totaalUitkomst))} ${model === 'ecommerce' ? 'transacties' : 'leads'}`
    );

    const duurste = [...metUitkomst]
      .filter((k) => k.spend != null && k[uitkomstVeld] > 0)
      .sort((a, b) => (b.spend / b[uitkomstVeld]) - (a.spend / a[uitkomstVeld]))[0];
    const goedkoopste = [...metUitkomst]
      .filter((k) => k.spend != null && k[uitkomstVeld] > 0)
      .sort((a, b) => (a.spend / a[uitkomstVeld]) - (b.spend / b[uitkomstVeld]))[0];
    if (duurste && goedkoopste && duurste.channel !== goedkoopste.channel) {
      aandacht.push(
        `${duurste.label} kost ${cf2.format(duurste.spend / duurste[uitkomstVeld])} per ${model === 'ecommerce' ? 'transactie' : 'lead'}, tegenover ${cf2.format(goedkoopste.spend / goedkoopste[uitkomstVeld])} bij ${goedkoopste.label}`
      );
    }
  }

  /* Budget */
  if (budget?.status === PacingStatus.BOVEN_BUDGET) {
    aandacht.push(
      budget.prognoseMogelijk
        ? `De uitgaven komen naar verwachting uit op ${cf0.format(budget.prognose)} tegenover een budget van ${cf0.format(budget.budget)}`
        : `De uitgaven kwamen uit op ${cf0.format(budget.uitgaven)} tegenover een budget van ${cf0.format(budget.budget)}`
    );
  }
  if (budget?.status === PacingStatus.ONDER_BUDGET && budget.prognoseMogelijk) {
    aandacht.push(
      `De uitgaven blijven naar verwachting ${cf0.format(Math.abs(budget.verschil))} onder het budget van ${cf0.format(budget.budget)}`
    );
  }

  /* Meetbeperkingen */
  if (model === 'leadgen' && totalen.qualifiedLeads == null) {
    meetbeperkingen.push('Gekwalificeerde leads zijn niet meetbaar');
  }
  if (model === 'leadgen' && totalen.customers == null) {
    meetbeperkingen.push('Klantconversies zijn niet meetbaar');
  }
  for (const melding of dekking ? dekkingMeldingen(dekking) : []) {
    if (melding.soort !== 'voorlopig') meetbeperkingen.push(melding.tekst);
  }

  return {
    goed,
    aandacht,
    meetbeperkingen,
    kanalen: kanalenTekst(filters?.channels ?? []),
  };
}
