/**
 * Metriekdefinities, veilige rekenregels en vergelijkingen.
 *
 * Dit is de enige plek waar staat wat een metriek betekent en of een stijging
 * goed of slecht nieuws is. Views vragen het hier op in plaats van zelf te
 * bepalen of rood of groen past; anders staat dezelfde interpretatie op tien
 * plekken, en op de elfde plek net niet.
 *
 * REKENREGELS
 *   - Delen door nul levert null op, nooit oneindig en nooit nul.
 *   - Een ontbrekende meting blijft null en wordt nooit stil nul.
 *   - Een som van uitsluitend ontbrekende waarden is null, geen nul.
 *   - Er wordt intern met ongeronde waarden gerekend; afronden gebeurt pas in
 *     de opmaak.
 */

/* ---------------------------------------------------------------
   Metriekmetadata
   --------------------------------------------------------------- */

export const Formaat = {
  GETAL: 'getal',
  EURO: 'euro',
  EURO2: 'euro2',
  PROCENT: 'procent',
  RATIO: 'ratio',
};

/**
 * `lagerIsBeter` bepaalt de richting van een verandering.
 * `richtingNeutraal` is voor metrieken waarbij een stijging of daling zonder
 * context niets zegt. Uitgaven zijn daar het duidelijkste voorbeeld: minder
 * uitgeven is pas goed nieuws als het resultaat gelijk blijft.
 */
export const METRIEK_META = {
  spend: { label: 'Uitgaven', formaat: Formaat.EURO, richtingNeutraal: true },
  impressions: { label: 'Impressies', formaat: Formaat.GETAL },
  clicks: { label: 'Klikken', formaat: Formaat.GETAL },
  ctr: { label: 'CTR', formaat: Formaat.PROCENT },
  cpc: { label: 'CPC', formaat: Formaat.EURO2, lagerIsBeter: true },
  cpm: { label: 'CPM', formaat: Formaat.EURO2, lagerIsBeter: true },
  sessions: { label: 'Sessies', formaat: Formaat.GETAL },
  users: { label: 'Gebruikers', formaat: Formaat.GETAL },
  landingPageViews: { label: 'Landingspaginaweergaven', formaat: Formaat.GETAL },
  formStarts: { label: 'Formulier gestart', formaat: Formaat.GETAL },

  leads: { label: 'Leads', formaat: Formaat.GETAL },
  cpl: { label: 'Kosten per lead', formaat: Formaat.EURO2, lagerIsBeter: true },
  qualifiedLeads: { label: 'Gekwalificeerde leads', formaat: Formaat.GETAL },
  cpql: { label: 'Kosten per gekwalificeerde lead', formaat: Formaat.EURO2, lagerIsBeter: true },
  appointments: { label: 'Afspraken', formaat: Formaat.GETAL },
  quotes: { label: 'Offertes', formaat: Formaat.GETAL },
  customers: { label: 'Klanten', formaat: Formaat.GETAL },
  leadNaarKlant: { label: 'Lead naar klant', formaat: Formaat.PROCENT },
  kwalificatieratio: { label: 'Kwalificatieratio', formaat: Formaat.PROCENT },
  pipelineValue: { label: 'Pipelinewaarde', formaat: Formaat.EURO },

  revenue: { label: 'Omzet', formaat: Formaat.EURO },
  roas: { label: 'ROAS', formaat: Formaat.RATIO },
  purchases: { label: 'Transacties', formaat: Formaat.GETAL },
  cpa: { label: 'Kosten per transactie', formaat: Formaat.EURO2, lagerIsBeter: true },
  aov: { label: 'Gemiddelde orderwaarde', formaat: Formaat.EURO2 },
  conversieratio: { label: 'Conversieratio', formaat: Formaat.PROCENT },
  productViews: { label: 'Productweergaven', formaat: Formaat.GETAL },
  addToCarts: { label: 'Toevoegingen aan winkelwagen', formaat: Formaat.GETAL },
  checkouts: { label: 'Checkouts gestart', formaat: Formaat.GETAL },
  winkelwagenratio: { label: 'Winkelwagenratio', formaat: Formaat.PROCENT },
  checkoutratio: { label: 'Checkoutratio', formaat: Formaat.PROCENT },
  aankoopratio: { label: 'Aankoopratio', formaat: Formaat.PROCENT },

  secondaryConversions: { label: 'Secundaire conversies', formaat: Formaat.GETAL },
  conversies: { label: 'Conversies', formaat: Formaat.GETAL },
};

export function metriekMeta(key) {
  return METRIEK_META[key] ?? { label: key, formaat: Formaat.GETAL };
}

export function lagerIsBeter(key) {
  return METRIEK_META[key]?.lagerIsBeter === true;
}

/* ---------------------------------------------------------------
   Veilige berekeningen
   --------------------------------------------------------------- */

/** Deling die null teruggeeft bij een ontbrekende of nulnoemer. */
export function veiligDelen(teller, noemer) {
  if (teller == null || noemer == null) return null;
  if (!Number.isFinite(teller) || !Number.isFinite(noemer)) return null;
  if (noemer === 0) return null;
  return teller / noemer;
}

/** Percentage van a ten opzichte van b, of null. */
export function veiligPercentage(a, b) {
  const q = veiligDelen(a, b);
  return q == null ? null : q * 100;
}

/**
 * Telt een veld op over rijen.
 *
 * Rijen waar het veld null is tellen niet mee en worden geteld als ontbrekend.
 * Zijn alle rijen null, dan is de uitkomst null: er is dan geen meting, en dat
 * is iets anders dan een gemeten nul.
 *
 * @returns {{waarde: number|null, gemetenRijen: number, ontbrekendeRijen: number}}
 */
export function sommeer(rijen, veld) {
  let som = 0;
  let gemeten = 0;
  let ontbrekend = 0;

  for (const rij of rijen) {
    const waarde = rij[veld];
    if (waarde == null || Number.isNaN(waarde)) ontbrekend += 1;
    else { som += waarde; gemeten += 1; }
  }

  return {
    waarde: gemeten ? som : null,
    gemetenRijen: gemeten,
    ontbrekendeRijen: ontbrekend,
  };
}

/* ---------------------------------------------------------------
   Afgeleide KPI's
   --------------------------------------------------------------- */

/**
 * Afgeleide waarden bij een leadgeneratieklant.
 * Alle deelsommen gaan via veiligDelen, zodat een klant zonder CRM-koppeling
 * geen nul krijgt maar een ontbrekende waarde houdt.
 */
export function leadgenAfgeleid(t) {
  return {
    ctr: veiligPercentage(t.clicks, t.impressions),
    cpc: veiligDelen(t.spend, t.clicks),
    cpm: veiligDelen(t.spend, t.impressions == null ? null : t.impressions / 1000),
    cpl: veiligDelen(t.spend, t.leads),
    cpql: veiligDelen(t.spend, t.qualifiedLeads),
    kwalificatieratio: veiligPercentage(t.qualifiedLeads, t.leads),
    leadNaarKlant: veiligPercentage(t.customers, t.leads),
    conversieratio: veiligPercentage(t.leads, t.sessions),
    // ROAS heeft bij leadgeneratie alleen betekenis wanneer er werkelijk omzet
    // wordt teruggekoppeld. Zonder die koppeling blijft de waarde ontbrekend
    // in plaats van nul.
    roas: veiligDelen(t.revenue, t.spend),
  };
}

/** Afgeleide waarden bij een e-commerceklant. */
export function ecommerceAfgeleid(t) {
  return {
    ctr: veiligPercentage(t.clicks, t.impressions),
    cpc: veiligDelen(t.spend, t.clicks),
    cpm: veiligDelen(t.spend, t.impressions == null ? null : t.impressions / 1000),
    roas: veiligDelen(t.revenue, t.spend),
    cpa: veiligDelen(t.spend, t.purchases),
    aov: veiligDelen(t.revenue, t.purchases),
    conversieratio: veiligPercentage(t.purchases, t.sessions),
    winkelwagenratio: veiligPercentage(t.addToCarts, t.productViews),
    checkoutratio: veiligPercentage(t.checkouts, t.addToCarts),
    aankoopratio: veiligPercentage(t.purchases, t.checkouts),
  };
}

/* ---------------------------------------------------------------
   Vergelijking
   --------------------------------------------------------------- */

export const DeltaStatus = {
  GESTEGEN: 'gestegen',
  GEDAALD: 'gedaald',
  GELIJK: 'gelijk',
  NIET_VERGELIJKBAAR: 'niet-vergelijkbaar',
  ONVOLDOENDE_DATA: 'onvoldoende-data',
};

export const DELTA_STATUS_LABELS = {
  [DeltaStatus.GESTEGEN]: 'Gestegen',
  [DeltaStatus.GEDAALD]: 'Gedaald',
  [DeltaStatus.GELIJK]: 'Gelijk gebleven',
  [DeltaStatus.NIET_VERGELIJKBAAR]: 'Niet vergelijkbaar',
  [DeltaStatus.ONVOLDOENDE_DATA]: 'Onvoldoende data',
};

/** Onder deze relatieve verandering spreken we van gelijk gebleven. */
const GELIJK_DREMPEL = 0.5;

/**
 * Vergelijkt een waarde met de vergelijkingsperiode.
 *
 * De uitkomst maakt onderscheid tussen vijf gevallen die in dashboards vaak
 * op één hoop gaan: gestegen, gedaald, gelijk, niet vergelijkbaar en
 * onvoldoende data. Een streepje voor alle vier de laatste gevallen laat de
 * lezer raden welke van de vier het is.
 *
 * @param {string} key       metrieksleutel, bepaalt de interpretatie
 * @param {number|null} huidig
 * @param {number|null} vorig
 * @param {{vergelijkingActief?: boolean}} opties
 */
export function berekenDelta(key, huidig, vorig, { vergelijkingActief = true } = {}) {
  const meta = metriekMeta(key);
  const basis = { key, label: meta.label, huidig, vorig, absoluut: null, procent: null };

  if (huidig == null) {
    return { ...basis, status: DeltaStatus.ONVOLDOENDE_DATA, richting: 'neutraal', tekst: 'Onvoldoende data' };
  }
  if (!vergelijkingActief) {
    return { ...basis, status: DeltaStatus.NIET_VERGELIJKBAAR, richting: 'neutraal', tekst: 'Geen vergelijking' };
  }
  if (vorig == null) {
    return { ...basis, status: DeltaStatus.NIET_VERGELIJKBAAR, richting: 'neutraal', tekst: 'Vorige periode ontbreekt' };
  }

  const absoluut = huidig - vorig;

  if (vorig === 0) {
    // Van nul naar iets is een oneindige stijging. Dat percentage zegt niets,
    // dus wordt de absolute verandering gemeld.
    return {
      ...basis,
      absoluut,
      status: absoluut === 0 ? DeltaStatus.GELIJK : DeltaStatus.NIET_VERGELIJKBAAR,
      richting: absoluut === 0 ? 'neutraal' : richtingVan(key, absoluut > 0),
      tekst: absoluut === 0 ? 'Gelijk gebleven' : 'Vorige periode was nul',
    };
  }

  const procent = (absoluut / Math.abs(vorig)) * 100;

  if (Math.abs(procent) < GELIJK_DREMPEL) {
    return { ...basis, absoluut, procent, status: DeltaStatus.GELIJK, richting: 'neutraal', tekst: 'Gelijk gebleven' };
  }

  const gestegen = procent > 0;
  return {
    ...basis,
    absoluut,
    procent,
    status: gestegen ? DeltaStatus.GESTEGEN : DeltaStatus.GEDAALD,
    richting: richtingVan(key, gestegen),
    tekst: `${gestegen ? '+' : ''}${procent.toFixed(1)}%`,
  };
}

/**
 * Vertaalt een stijging of daling naar goed, slecht of neutraal nieuws.
 * Een dalende CPL is goed, een dalende omzet niet, en dalende uitgaven zeggen
 * op zichzelf niets.
 */
function richtingVan(key, gestegen) {
  const meta = metriekMeta(key);
  if (meta.richtingNeutraal) return 'neutraal';
  const goed = meta.lagerIsBeter ? !gestegen : gestegen;
  return goed ? 'positief' : 'negatief';
}

/**
 * Bouwt een set delta's voor alle sleutels die in beide totalen voorkomen.
 */
export function berekenDeltas(keys, huidigeTotalen, vorigeTotalen, opties = {}) {
  const result = {};
  for (const key of keys) {
    result[key] = berekenDelta(key, huidigeTotalen?.[key] ?? null, vorigeTotalen?.[key] ?? null, opties);
  }
  return result;
}
