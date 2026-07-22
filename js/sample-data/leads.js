/**
 * Leadgeneratie demodataset.
 *
 * Structuur volgt wat een marketeer nodig heeft bij een leadgeneratieklant:
 * primaire leadacties gescheiden van secundaire signalen, maanddoelen tegenover
 * werkelijke aantallen, en lokale zichtbaarheid.
 *
 * Alle cijfers zijn deterministisch en fictief.
 *
 * Let op: deze dataset wordt nog niet door een scherm gebruikt. Het
 * leadgeneratie-klantdashboard staat nog op de lijst met te bouwen onderdelen.
 * De structuur ligt hiermee wel vast.
 */

/** Primaire leads: acties met directe commerciële waarde. */
export const PRIMAIRE_LEADTYPES = [
  'contactformulier',
  'offerteaanvraag',
  'adviesaanvraag',
  'afspraak gepland',
  'spoedaanvraag',
  'brochure download',
  'aanmelding',
];

/** Secundaire conversies: signalen van interesse, geen lead op zichzelf. */
export const SECUNDAIRE_CONVERSIES = [
  'telefoonklik',
  'e-mailklik',
  'WhatsApp-klik',
  'routeaanvraag',
  'nieuwsbriefinschrijving',
  'formulier gestart',
];

/** Bouwt de leadfunnel met doorstroom en uitval per stap. */
export function buildLeadFunnel(stappen) {
  const volgorde = [
    { key: 'klikken', label: 'Klik' },
    { key: 'landingspaginaWeergaven', label: 'Landingspagina bekeken' },
    { key: 'formulierGestart', label: 'Formulier gestart' },
    { key: 'leads', label: 'Lead' },
    { key: 'gekwalificeerdeLeads', label: 'Gekwalificeerde lead' },
    { key: 'afspraken', label: 'Afspraak' },
    { key: 'klanten', label: 'Klant' },
  ];

  return volgorde.map((stap, i) => {
    const volume = stappen[stap.key] ?? 0;
    const vorige = i === 0 ? null : stappen[volgorde[i - 1].key];
    return {
      ...stap,
      volume,
      doorstroom: vorige ? (volume / vorige) * 100 : 100,
      uitval: vorige ? vorige - volume : 0,
      vanTotaal: stappen.klikken ? (volume / stappen.klikken) * 100 : 0,
    };
  });
}

/* ---------------------------------------------------------------
   Vitaalpunt Fysiotherapie — stijgende kosten per lead
   --------------------------------------------------------------- */

const vitaalpunt = {
  clientId: 'vitaalpunt',

  ga4: {
    gebruikers: 3184,
    nieuweGebruikers: 2610,
    sessies: 4120,
    engagedSessions: 2489,
    engagementRate: 60.4,
    gemSessieduur: 148,
    keyEvents: 189,
  },

  // Primaire leads per type
  primaireLeads: [
    { type: 'contactformulier',  aantal: 42, vorigePeriode: 51 },
    { type: 'afspraak gepland',  aantal: 34, vorigePeriode: 39 },
    { type: 'adviesaanvraag',    aantal: 21, vorigePeriode: 24 },
    { type: 'spoedaanvraag',     aantal: 12, vorigePeriode: 9 },
    { type: 'brochure download', aantal: 9,  vorigePeriode: 8 },
  ],

  secundaireConversies: [
    { type: 'telefoonklik',            aantal: 86, vorigePeriode: 74 },
    { type: 'e-mailklik',              aantal: 41, vorigePeriode: 38 },
    { type: 'routeaanvraag',           aantal: 29, vorigePeriode: 31 },
    { type: 'formulier gestart',       aantal: 214, vorigePeriode: 236 },
    { type: 'nieuwsbriefinschrijving', aantal: 18, vorigePeriode: 15 },
  ],

  funnelStappen: {
    klikken: 2140,
    landingspaginaWeergaven: 1892,
    formulierGestart: 214,
    leads: 118,
    gekwalificeerdeLeads: 71,
    afspraken: 34,
    klanten: 19,
  },

  // Acquisitie per GA4-kanaalgroep
  acquisitie: [
    { kanaal: 'Paid Search',    gebruikers: 1284, leads: 58, cpl: 108.42 },
    { kanaal: 'Organic Search', gebruikers: 986,  leads: 34, cpl: 0 },
    { kanaal: 'Direct',         gebruikers: 512,  leads: 14, cpl: 0 },
    { kanaal: 'Paid Social',    gebruikers: 284,  leads: 9,  cpl: 142.18 },
    { kanaal: 'Referral',       gebruikers: 118,  leads: 3,  cpl: 0 },
  ],

  landingspaginas: [
    { pagina: '/fysiotherapie-breda',      gebruikers: 842, leads: 41, conversieratio: 4.87 },
    { pagina: '/afspraak-maken',           gebruikers: 486, leads: 34, conversieratio: 7.00 },
    { pagina: '/behandelingen/rugklachten', gebruikers: 394, leads: 18, conversieratio: 4.57 },
    { pagina: '/',                          gebruikers: 618, leads: 12, conversieratio: 1.94 },
    { pagina: '/contact',                   gebruikers: 214, leads: 13, conversieratio: 6.07 },
  ],

  googleAds: {
    totalen: { kosten: 11820, klikken: 2140, vertoningen: 84200, ctr: 2.54, cpc: 5.52, leads: 118, cpa: 100.17, conversieratio: 5.51 },
    maanden: [
      { maand: '2026-02', vertoningen: 62400, klikken: 1840, ctr: 2.95, cpc: 4.42, kosten: 8133, leads: 142, cpa: 57.27 },
      { maand: '2026-03', vertoningen: 68200, klikken: 1946, ctr: 2.85, cpc: 4.68, kosten: 9107, leads: 138, cpa: 65.99 },
      { maand: '2026-04', vertoningen: 72800, klikken: 2018, ctr: 2.77, cpc: 4.91, kosten: 9908, leads: 134, cpa: 73.94 },
      { maand: '2026-05', vertoningen: 78400, klikken: 2084, ctr: 2.66, cpc: 5.12, kosten: 10670, leads: 128, cpa: 83.36 },
      { maand: '2026-06', vertoningen: 81600, klikken: 2112, ctr: 2.59, cpc: 5.31, kosten: 11215, leads: 131, cpa: 85.61 },
      { maand: '2026-07', vertoningen: 84200, klikken: 2140, ctr: 2.54, cpc: 5.52, kosten: 11820, leads: 118, cpa: 100.17 },
    ],
    campagnes: [
      { naam: 'Search | Breda | Fysiotherapie', type: 'Search', kosten: 6420, klikken: 1180, leads: 71, cpa: 90.42 },
      { naam: 'Search | Breda | Klachten',      type: 'Search', kosten: 3180, klikken: 620,  leads: 32, cpa: 99.38 },
      { naam: 'Performance Max | Regio',        type: 'Performance Max', kosten: 2220, klikken: 340, leads: 15, cpa: 148.00 },
    ],
  },

  /** Google Business Profile. Er is nog geen echte koppeling gebouwd. */
  googleBusinessProfile: {
    koppelingBeschikbaar: false,
    profielinteracties: 412,
    telefoongesprekken: 86,
    routeaanvragen: 29,
    websiteklikken: 148,
  },

  /** Maanddoelen tegenover werkelijke aantallen. */
  doelen: [
    { kpi: 'leads',                periode: 'maand', target: 130,   actueel: 118,    eigenaar: 'Daan Verhoeven' },
    { kpi: 'gekwalificeerdeLeads', periode: 'maand', target: 85,    actueel: 71,     eigenaar: 'Daan Verhoeven' },
    { kpi: 'cpl',                  periode: 'maand', target: 90,    actueel: 100.17, eigenaar: 'Noor El Amrani' },
    { kpi: 'afspraken',            periode: 'maand', target: 40,    actueel: 34,     eigenaar: 'Daan Verhoeven' },
    { kpi: 'maandbudget',          periode: 'maand', target: 14000, actueel: 11820,  eigenaar: 'Daan Verhoeven' },
  ],

  /** Historische doelrealisatie, voor de vergelijking per maand. */
  doelHistorie: [
    { maand: '2026-02', targetLeads: 130, werkelijkeLeads: 142 },
    { maand: '2026-03', targetLeads: 130, werkelijkeLeads: 138 },
    { maand: '2026-04', targetLeads: 130, werkelijkeLeads: 134 },
    { maand: '2026-05', targetLeads: 130, werkelijkeLeads: 128 },
    { maand: '2026-06', targetLeads: 130, werkelijkeLeads: 131 },
    { maand: '2026-07', targetLeads: 130, werkelijkeLeads: 118 },
  ],
};

export const LEADS_DATA = { vitaalpunt };

export function getLeadsData(clientId) {
  return LEADS_DATA[clientId] ?? null;
}
