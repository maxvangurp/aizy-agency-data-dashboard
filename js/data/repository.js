/**
 * Datarepository met tenantfiltering.
 *
 * Elke functie hier ontvangt de gebruiker als eerste argument en geeft
 * uitsluitend data terug die die gebruiker mag zien. Views halen geen data
 * meer rechtstreeks uit sample-data; ze krijgen wat ze mogen krijgen.
 *
 * Dat onderscheid is belangrijker dan het lijkt. Een view die alle klanten
 * ophaalt en er vervolgens een paar verbergt, lekt die klanten alsnog in de
 * DOM, in filters, in zoekresultaten en in totalen. De grens hoort vóór de
 * view te liggen, niet erin.
 *
 * ISOLATIE NU EN LATER
 *   nu       frontendautorisatie. Alle demodata zit in dezelfde bundle en is
 *            met de browserconsole te benaderen. Deze laag modelleert de
 *            grens, maar handhaaft hem niet tegen een vastberaden gebruiker.
 *   later    backendautorisatie. Dezelfde beslissingen worden in de Azure API
 *            genomen vóórdat data wordt verstuurd, zodat de frontend nooit
 *            data ontvangt die hij niet mag tonen.
 */

import { SAMPLE_CLIENTS, SAMPLE_ALERTS, BusinessModel, BUSINESS_MODEL_LABELS } from '../sample-data/shared.js';
import { getEcommerceData } from '../sample-data/ecommerce.js';
import { getLeadsData } from '../sample-data/leads.js';
import { toegankelijkeKlantIds, magKlantZien, can, Permission } from '../auth/permissions.js';
import { DEMO_GEBRUIKERS, isAgencyGebruiker } from '../auth/domain.js';
import { metOverrides } from '../auth/demo-auth-provider.js';

const ALLE_CLIENT_IDS = SAMPLE_CLIENTS.map((c) => c.id);

/* ---------------------------------------------------------------
   Klanten
   --------------------------------------------------------------- */

/**
 * Alle klanten die deze gebruiker mag zien.
 * Dit is de bron voor tabellen, filters en dropdowns.
 */
export function getAccessibleClients(user) {
  const toegestaan = new Set(toegankelijkeKlantIds(user, ALLE_CLIENT_IDS));
  return SAMPLE_CLIENTS.filter((c) => toegestaan.has(c.id));
}

/**
 * Eén klant, of null wanneer de gebruiker er geen toegang toe heeft.
 *
 * Geeft bewust null terug in plaats van een fout te werpen, zodat een niet
 * toegestane klant-id in de URL hetzelfde gedrag oplevert als een klant die
 * niet bestaat. Het antwoord verklapt daardoor niet of de klant bestaat.
 */
export function getClientById(user, clientId) {
  if (!magKlantZien(user, clientId)) return null;
  return SAMPLE_CLIENTS.find((c) => c.id === clientId) ?? null;
}

/** De volledige dashboarddata van één klant, afhankelijk van het bedrijfsmodel. */
export function getClientDashboardData(user, clientId) {
  const client = getClientById(user, clientId);
  if (!client) return null;

  if (client.businessModel === BusinessModel.ECOMMERCE) {
    return { client, type: BusinessModel.ECOMMERCE, data: getEcommerceData(clientId) };
  }
  if (client.businessModel === BusinessModel.LEADGEN) {
    return { client, type: BusinessModel.LEADGEN, data: getLeadsData(clientId) };
  }
  // Awareness heeft nog geen eigen dashboard. Dat wordt expliciet gemeld in
  // plaats van een leeg scherm te tonen.
  return { client, type: client.businessModel, data: null };
}

/* ---------------------------------------------------------------
   Signalen
   --------------------------------------------------------------- */

/**
 * Signalen over toegankelijke klanten.
 *
 * Klantgebruikers krijgen hier niets: signalen zijn een intern werkinstrument
 * van het bureau en bevatten formuleringen die niet voor de klant bedoeld zijn.
 */
export function getAccessibleSignals(user) {
  if (!can(user, Permission.VIEW_AGENCY_SIGNALS)) return [];
  const toegestaan = new Set(toegankelijkeKlantIds(user, ALLE_CLIENT_IDS));
  return SAMPLE_ALERTS.filter((a) => toegestaan.has(a.klantId));
}

/* ---------------------------------------------------------------
   Agencycijfers
   --------------------------------------------------------------- */

/**
 * Geaggregeerde cijfers over de klanten die deze gebruiker mag zien.
 *
 * Resultaten worden per bedrijfsmodel gescheiden gehouden. Een gemiddelde
 * ROAS over leadgeneratieklanten bestaat niet, en een gemiddelde CPL over
 * webshops evenmin; die door elkaar heen middelen levert een getal op dat
 * nergens naar verwijst.
 */
export function getAgencyMetrics(user) {
  const klanten = getAccessibleClients(user);
  const signalen = getAccessibleSignals(user);

  const ecommerce = klanten.filter((c) => c.businessModel === BusinessModel.ECOMMERCE);
  const leadgen = klanten.filter((c) => c.businessModel === BusinessModel.LEADGEN);
  const overig = klanten.filter(
    (c) => c.businessModel !== BusinessModel.ECOMMERCE && c.businessModel !== BusinessModel.LEADGEN
  );

  const som = (lijst, veld) => lijst.reduce((t, c) => t + (c[veld] ?? 0), 0);

  /** Gemiddelde over de klanten waar de waarde daadwerkelijk gemeten is. */
  const gemiddelde = (lijst, pad) => {
    const waarden = lijst.map(pad).filter((v) => v != null && !Number.isNaN(v));
    if (!waarden.length) return null;
    return waarden.reduce((a, b) => a + b, 0) / waarden.length;
  };

  const totaleSpend = som(klanten, 'spend');
  const totaalBudget = som(klanten, 'maandbudget');

  return {
    aantalKlanten: klanten.length,
    totaleSpend,
    totaalBudget,
    pacing: totaalBudget ? (totaleSpend / totaalBudget) * 100 : null,

    // Resultaten per type, bewust niet samengevoegd.
    ecommerce: {
      aantal: ecommerce.length,
      omzet: som(ecommerce.map((c) => ({ v: c.kpis?.omzet ?? 0 })), 'v'),
      aankopen: som(ecommerce.map((c) => ({ v: c.kpis?.aankopen ?? 0 })), 'v'),
      gemiddeldeRoas: gemiddelde(ecommerce, (c) => c.kpis?.roas),
    },
    leadgen: {
      aantal: leadgen.length,
      leads: som(leadgen.map((c) => ({ v: c.kpis?.leads ?? 0 })), 'v'),
      gemiddeldeCpl: gemiddelde(leadgen, (c) => c.kpis?.cpl),
      // Klanten zonder CRM-koppeling tellen niet mee in het gemiddelde.
      zonderKwalificatie: leadgen.filter((c) => c.kpis?.gekwalificeerdeLeads == null).length,
    },
    overig: { aantal: overig.length },

    opKoers: klanten.filter((c) => klantStatus(c).code === 'op-koers').length,
    aandachtNodig: klanten.filter((c) => klantStatus(c).code === 'aandacht').length,
    openSignalen: signalen.length,
    trackingProblemen: klanten.filter((c) => c.trackingStatus === 'probleem').length,
  };
}

/* ---------------------------------------------------------------
   Klantstatus
   --------------------------------------------------------------- */

/**
 * Bepaalt de status van een klant met de reden erbij.
 *
 * Een gekleurde badge zonder toelichting dwingt de lezer tot raden, dus
 * iedere status draagt de onderbouwing mee. De volgorde is een prioriteit:
 * een trackingprobleem maakt de rest van de cijfers onbetrouwbaar en wordt
 * daarom als eerste gemeld.
 */
export function klantStatus(client) {
  if (!client) return { code: 'onbekend', label: 'Onbekend', reden: '' };

  if (client.trackingStatus === 'probleem') {
    return {
      code: 'tracking',
      label: 'Trackingprobleem',
      reden: `De datakwaliteit staat op ${client.dataHealth} procent. Cijfers zijn mogelijk onvolledig.`,
    };
  }

  const doelen = client.doelen ?? [];
  if (!doelen.length) {
    return { code: 'geen-doel', label: 'Doel ontbreekt', reden: 'Er zijn geen maanddoelen ingesteld.' };
  }

  // Een klant zonder meetbare primaire uitkomst kan niet worden beoordeeld.
  const model = client.businessModel;
  const primair =
    model === BusinessModel.ECOMMERCE ? client.kpis?.omzet
    : model === BusinessModel.LEADGEN ? client.kpis?.leads
    : null;

  if (primair == null) {
    return {
      code: 'onvoldoende-data',
      label: 'Onvoldoende data',
      reden: 'Het primaire resultaat wordt voor deze klant niet gemeten.',
    };
  }

  const meetbareDoelen = doelen.filter((d) => d.actueel != null && d.target != null);
  if (!meetbareDoelen.length) {
    return {
      code: 'onvoldoende-data',
      label: 'Onvoldoende data',
      reden: 'Geen van de doelen heeft een meetbare waarde.',
    };
  }

  const lagerIsBeter = new Set(['cpl', 'cpql', 'cpa', 'cpc', 'cpm']);
  const achter = meetbareDoelen.filter((d) => {
    const behaald = lagerIsBeter.has(d.kpi)
      ? (d.target / d.actueel) * 100
      : (d.actueel / d.target) * 100;
    return behaald < 100;
  });

  if (achter.length === 0) {
    return {
      code: 'op-koers',
      label: 'Op koers',
      reden: `Alle ${meetbareDoelen.length} meetbare doelen liggen op of boven het doel.`,
    };
  }

  return {
    code: 'aandacht',
    label: 'Aandacht nodig',
    reden: `${achter.length} van ${meetbareDoelen.length} doelen liggen onder het doel.`,
  };
}

/* ---------------------------------------------------------------
   Portefeuille-inzichten
   --------------------------------------------------------------- */

/**
 * Inzichten over de portefeuille van deze gebruiker.
 * Alleen bevindingen die uit de beschikbare demodata te onderbouwen zijn.
 */
export function getPortfolioInzichten(user) {
  const klanten = getAccessibleClients(user);
  if (!klanten.length) return [];

  const inzichten = [];

  /** Relatieve verandering van het primaire resultaat. */
  const ontwikkeling = (c) => {
    const model = c.businessModel;
    const nu = model === BusinessModel.ECOMMERCE ? c.kpis?.omzet : c.kpis?.leads;
    const toen = model === BusinessModel.ECOMMERCE ? c.vorigePeriode?.omzet : c.vorigePeriode?.leads;
    if (nu == null || toen == null || toen === 0) return null;
    return ((nu - toen) / toen) * 100;
  };

  const metOntwikkeling = klanten
    .map((c) => ({ client: c, pct: ontwikkeling(c) }))
    .filter((x) => x.pct != null)
    .sort((a, b) => b.pct - a.pct);

  if (metOntwikkeling.length) {
    const beste = metOntwikkeling[0];
    if (beste.pct > 0) {
      inzichten.push({
        soort: 'positief',
        titel: 'Grootste positieve ontwikkeling',
        tekst: `${beste.client.name} groeide met ${beste.pct.toFixed(1)} procent ten opzichte van de vorige periode.`,
        clientId: beste.client.id,
      });
    }

    const slechtste = metOntwikkeling[metOntwikkeling.length - 1];
    if (slechtste.pct < 0 && slechtste.client.id !== beste.client.id) {
      inzichten.push({
        soort: 'negatief',
        titel: 'Grootste negatieve ontwikkeling',
        tekst: `${slechtste.client.name} daalde met ${Math.abs(slechtste.pct).toFixed(1)} procent ten opzichte van de vorige periode.`,
        clientId: slechtste.client.id,
      });
    }
  }

  const zonderCrm = klanten.filter(
    (c) => c.businessModel === BusinessModel.LEADGEN && c.kpis?.gekwalificeerdeLeads == null
  );
  if (zonderCrm.length) {
    inzichten.push({
      soort: 'aandacht',
      titel: 'Geen meetbare CRM-uitkomst',
      tekst: `Voor ${zonderCrm.length === 1 ? '1 klant' : `${zonderCrm.length} klanten`} ontbreekt een CRM-koppeling: ${zonderCrm.map((c) => c.name).join(', ')}.`,
      clientId: zonderCrm[0].id,
    });
  }

  const onderbesteed = klanten.filter((c) => c.maandbudget && c.spend / c.maandbudget < 0.8);
  if (onderbesteed.length) {
    inzichten.push({
      soort: 'aandacht',
      titel: 'Achterblijvende budgetbesteding',
      tekst: `${onderbesteed.map((c) => c.name).join(', ')} ${onderbesteed.length === 1 ? 'besteedt' : 'besteden'} minder dan 80 procent van het maandbudget.`,
      clientId: onderbesteed[0].id,
    });
  }

  const overbesteed = klanten.filter((c) => c.maandbudget && c.spend / c.maandbudget > 1);
  if (overbesteed.length) {
    inzichten.push({
      soort: 'negatief',
      titel: 'Boven budget',
      tekst: `${overbesteed.map((c) => c.name).join(', ')} ${overbesteed.length === 1 ? 'staat' : 'staan'} boven het maandbudget.`,
      clientId: overbesteed[0].id,
    });
  }

  const tracking = klanten.filter((c) => c.trackingStatus === 'probleem');
  if (tracking.length) {
    inzichten.push({
      soort: 'negatief',
      titel: 'Trackingproblemen',
      tekst: `${tracking.map((c) => c.name).join(', ')} ${tracking.length === 1 ? 'heeft' : 'hebben'} een trackingprobleem dat de cijfers onbetrouwbaar maakt.`,
      clientId: tracking[0].id,
    });
  }

  return inzichten;
}

/* ---------------------------------------------------------------
   Team
   --------------------------------------------------------------- */

/**
 * Alle agencymedewerkers, inclusief lokale demowijzigingen.
 * Alleen beschikbaar voor wie het team mag beheren.
 */
export function getTeamLeden(user) {
  if (!can(user, Permission.MANAGE_TEAM)) return [];
  return DEMO_GEBRUIKERS.map(metOverrides).filter((u) => isAgencyGebruiker(u));
}

/** Gebruikers binnen de eigen klantorganisatie. */
export function getOrganisatieGebruikers(user, organisatieId) {
  if (!can(user, Permission.MANAGE_CLIENT_USERS)) return [];
  // Een klantbeheerder mag uitsluitend de eigen organisatie zien.
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

export { BUSINESS_MODEL_LABELS, BusinessModel };
