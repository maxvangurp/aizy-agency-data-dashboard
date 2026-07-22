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
 * Metriekmetadata.
 *
 *   label            de volledige naam, altijd zonder afkorting
 *   kort             de afkorting, alleen voor krappe ruimte en nooit alleen
 *   uitleg           één zin die het begrip verklaart, gebruikt in tooltips
 *   lagerIsBeter     bepaalt de richting van een verandering
 *   richtingNeutraal voor metrieken waarbij een stijging of daling zonder
 *                    context niets zegt. Uitgaven zijn het duidelijkste
 *                    voorbeeld: minder uitgeven is pas goed nieuws als het
 *                    resultaat gelijk blijft.
 *
 * De interpretatie staat hier en nergens anders. Een view bepaalt nooit zelf of
 * een daling groen of rood is.
 */
export const METRIEK_META = {
  spend: {
    label: 'Advertentie-uitgaven', formaat: Formaat.EURO, richtingNeutraal: true,
    uitleg: 'Wat er in de geselecteerde periode aan advertenties is uitgegeven. Meer of minder uitgeven is op zichzelf niet goed of slecht.',
  },
  impressions: {
    label: 'Impressies', formaat: Formaat.GETAL,
    uitleg: 'Het aantal keren dat een advertentie is vertoond.',
  },
  clicks: {
    label: 'Klikken', formaat: Formaat.GETAL,
    uitleg: 'Het aantal keren dat er op een advertentie is geklikt.',
  },
  ctr: {
    label: 'Doorklikratio', kort: 'CTR', formaat: Formaat.PROCENT,
    uitleg: 'Het aandeel vertoningen dat tot een klik leidde.',
  },
  cpc: {
    label: 'Kosten per klik', kort: 'CPC', formaat: Formaat.EURO2, lagerIsBeter: true,
    uitleg: 'De gemiddelde prijs die voor één klik is betaald.',
  },
  cpm: {
    label: 'Kosten per duizend vertoningen', kort: 'CPM', formaat: Formaat.EURO2, lagerIsBeter: true,
    uitleg: 'Wat duizend vertoningen kosten. Een stijging betekent dat dezelfde zichtbaarheid duurder wordt.',
  },
  sessions: {
    label: 'Sessies', formaat: Formaat.GETAL,
    uitleg: 'Bezoeken aan de website, gemeten door Google Analytics 4.',
  },
  users: {
    label: 'Websitegebruikers', formaat: Formaat.GETAL,
    uitleg: 'Unieke bezoekers van de website in deze periode.',
  },
  landingPageViews: {
    label: 'Landingspaginaweergaven', formaat: Formaat.GETAL,
    uitleg: 'Hoe vaak de landingspagina daadwerkelijk is geladen na een klik.',
  },
  formStarts: {
    label: 'Formulier gestart', formaat: Formaat.GETAL,
    uitleg: 'Hoe vaak iemand aan een formulier begon zonder het per se af te ronden.',
  },

  leads: {
    label: 'Leads', formaat: Formaat.GETAL,
    uitleg: 'Aanvragen die als lead tellen. Welke conversies dat zijn, is per klant ingesteld.',
  },
  cpl: {
    label: 'Kosten per lead', kort: 'CPL', formaat: Formaat.EURO2, lagerIsBeter: true,
    uitleg: 'De advertentie-uitgaven gedeeld door het aantal leads.',
  },
  qualifiedLeads: {
    label: 'Gekwalificeerde leads', formaat: Formaat.GETAL,
    uitleg: 'Leads die na beoordeling in het CRM als serieuze aanvraag zijn bestempeld.',
  },
  cpql: {
    label: 'Kosten per gekwalificeerde lead', kort: 'CPQL', formaat: Formaat.EURO2, lagerIsBeter: true,
    uitleg: 'Wat een bruikbare aanvraag werkelijk kost, na beoordeling in het CRM.',
  },
  appointments: {
    label: 'Afspraken', formaat: Formaat.GETAL,
    uitleg: 'Afspraken of offertes die uit de aanvragen zijn voortgekomen.',
  },
  quotes: { label: 'Offertes', formaat: Formaat.GETAL, uitleg: 'Uitgebrachte offertes.' },
  customers: {
    label: 'Klanten', formaat: Formaat.GETAL,
    uitleg: 'Aanvragen die volgens het CRM klant zijn geworden.',
  },
  leadNaarKlant: {
    label: 'Lead naar klant', formaat: Formaat.PROCENT,
    uitleg: 'Het aandeel leads dat uiteindelijk klant werd.',
  },
  kwalificatieratio: {
    label: 'Kwalificatieratio', formaat: Formaat.PROCENT,
    uitleg: 'Het aandeel leads dat na beoordeling gekwalificeerd bleek.',
  },
  pipelineValue: {
    label: 'Pipelinewaarde', formaat: Formaat.EURO,
    uitleg: 'De verwachte waarde van de openstaande aanvragen volgens het CRM.',
  },

  revenue: {
    label: 'Omzet', formaat: Formaat.EURO,
    uitleg: 'De omzet die in deze periode via de website is gerealiseerd.',
  },
  roas: {
    label: 'Rendement op advertentie-uitgaven', kort: 'ROAS', formaat: Formaat.RATIO,
    uitleg: 'Omzet gedeeld door advertentiekosten. 4× betekent vier euro omzet per euro advertentiekosten.',
  },
  purchases: {
    label: 'Transacties', formaat: Formaat.GETAL,
    uitleg: 'Het aantal afgeronde bestellingen.',
  },
  cpa: {
    label: 'Kosten per transactie', kort: 'CPA', formaat: Formaat.EURO2, lagerIsBeter: true,
    uitleg: 'Advertentie-uitgaven gedeeld door het aantal bestellingen.',
  },
  aov: {
    label: 'Gemiddelde orderwaarde', kort: 'AOV', formaat: Formaat.EURO2,
    uitleg: 'De omzet gedeeld door het aantal bestellingen.',
  },
  conversieratio: {
    label: 'Conversieratio', formaat: Formaat.PROCENT,
    uitleg: 'Het aandeel sessies dat tot een aankoop of aanvraag leidde.',
  },
  productViews: {
    label: 'Productweergaven', formaat: Formaat.GETAL,
    uitleg: 'Hoe vaak een productpagina is bekeken.',
  },
  addToCarts: {
    label: 'Toevoegingen aan winkelwagen', formaat: Formaat.GETAL,
    uitleg: 'Hoe vaak een product in de winkelwagen is gelegd.',
  },
  checkouts: {
    label: 'Checkouts gestart', formaat: Formaat.GETAL,
    uitleg: 'Hoe vaak iemand aan het afrekenen begon.',
  },
  winkelwagenratio: {
    label: 'Winkelwagenratio', formaat: Formaat.PROCENT,
    uitleg: 'Het aandeel productweergaven dat tot een toevoeging aan de winkelwagen leidde.',
  },
  checkoutratio: {
    label: 'Checkoutratio', formaat: Formaat.PROCENT,
    uitleg: 'Het aandeel winkelwagens waarmee het afrekenen is gestart.',
  },
  aankoopratio: {
    label: 'Aankoopratio', formaat: Formaat.PROCENT,
    uitleg: 'Het aandeel gestarte checkouts dat tot een bestelling leidde.',
  },

  reach: {
    label: 'Bereikte personen per dag', formaat: Formaat.GETAL,
    uitleg: 'Het aantal unieke personen dat per dag is bereikt, opgeteld over de periode. Het unieke bereik over de hele periode is lager en wordt niet op dagniveau gemeten.',
  },
  frequentie: {
    label: 'Gemiddelde frequentie', formaat: Formaat.RATIO, lagerIsBeter: true,
    uitleg: 'Hoe vaak een bereikte persoon de advertentie gemiddeld per dag zag. Een oplopende frequentie betekent meer herhaling bij dezelfde mensen.',
  },
  videoStarts: {
    label: 'Videostarts', formaat: Formaat.GETAL,
    uitleg: 'Hoe vaak een video is gestart.',
  },
  videoCompletions: {
    label: 'Volledig bekeken video’s', formaat: Formaat.GETAL,
    uitleg: 'Hoe vaak een video tot het einde is bekeken.',
  },
  videoVoltooiing: {
    label: 'Videovoltooiing', formaat: Formaat.PROCENT,
    uitleg: 'Het aandeel gestarte video’s dat volledig is bekeken.',
  },
  gemKijktijd: {
    label: 'Gemiddelde kijktijd', formaat: Formaat.GETAL,
    uitleg: 'De gemiddelde kijktijd per videostart, in seconden.',
  },
  engagements: {
    label: 'Interacties', formaat: Formaat.GETAL,
    uitleg: 'Reacties, opslagacties, doorklikken en andere interacties met de advertentie.',
  },
  engagementRatio: {
    label: 'Interactieratio', formaat: Formaat.PROCENT,
    uitleg: 'Het aandeel vertoningen dat tot een interactie leidde.',
  },
  brandedSearchClicks: {
    label: 'Klikken op merkzoekwoorden', formaat: Formaat.GETAL,
    uitleg: 'Zoekopdrachten op de merknaam die tot een klik leidden. Een indirecte aanwijzing voor merkbekendheid.',
  },
  kostenPerBereik: {
    label: 'Kosten per duizend bereikte personen', formaat: Formaat.EURO2, lagerIsBeter: true,
    uitleg: 'Wat het kost om duizend personen te bereiken.',
  },

  secondaryConversions: {
    label: 'Secundaire conversies', formaat: Formaat.GETAL,
    uitleg: 'Acties die interesse laten zien maar nog geen aanvraag zijn.',
  },
  conversies: {
    label: 'Conversies', formaat: Formaat.GETAL,
    uitleg: 'Het aantal conversies binnen het gekozen conversietype.',
  },
};

export function metriekMeta(key) {
  return METRIEK_META[key] ?? { label: key, formaat: Formaat.GETAL };
}

export function lagerIsBeter(key) {
  return METRIEK_META[key]?.lagerIsBeter === true;
}

/**
 * Het label zoals het op het scherm hoort te staan.
 * Een afkorting staat er alleen bij wanneer die bestaat, en nooit in plaats van
 * de volledige naam.
 */
export function metriekLabel(key, { metAfkorting = true } = {}) {
  const meta = metriekMeta(key);
  return metAfkorting && meta.kort ? `${meta.label} (${meta.kort})` : meta.label;
}

/** De uitleg bij een metriek, voor tooltips en toegankelijke omschrijvingen. */
export function metriekUitleg(key) {
  return metriekMeta(key).uitleg ?? '';
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
