/**
 * E-commerce demodataset.
 *
 * Structuur is ontleend aan wat een marketeer nodig heeft in een
 * e-commerce rapportage: GA4-acquisitie per kanaal, de ecommerce-funnel,
 * Google Ads tot op zoekwoord- en URL-niveau, Merchant Center en doelen.
 *
 * Alle cijfers zijn deterministisch en fictief. Er is geen klantdata gebruikt.
 */

/* ---------------------------------------------------------------
   Kanaalgroepen zoals GA4 ze rapporteert
   --------------------------------------------------------------- */

export const GA4_CHANNELS = [
  'Direct',
  'Paid Search',
  'Paid Social',
  'Organic Search',
  'Organic Social',
  'Cross-network',
  'Email',
  'Referral',
  'Paid Shopping',
  'Organic Shopping',
  'Unassigned',
];

/* ---------------------------------------------------------------
   Helper: bouwt een funnel met afgeleide percentages
   --------------------------------------------------------------- */

export function buildFunnel(events) {
  const stappen = [
    { key: 'view_item', label: 'Product bekeken' },
    { key: 'add_to_cart', label: 'Toegevoegd aan winkelwagen' },
    { key: 'view_cart', label: 'Winkelwagen bekeken' },
    { key: 'begin_checkout', label: 'Checkout gestart' },
    { key: 'purchase', label: 'Aankoop' },
  ];

  return stappen.map((stap, i) => {
    const volume = events[stap.key] ?? 0;
    const vorige = i === 0 ? null : events[stappen[i - 1].key];
    const doorstroom = vorige ? (volume / vorige) * 100 : 100;
    const uitval = vorige ? vorige - volume : 0;
    return {
      ...stap,
      volume,
      doorstroom,
      uitval,
      vanTotaal: events.view_item ? (volume / events.view_item) * 100 : 0,
    };
  });
}

/* ---------------------------------------------------------------
   Klant 1: Tafelwerk Studio — presteert boven doelstelling
   --------------------------------------------------------------- */

const tafelwerk = {
  clientId: 'tafelwerk',

  ga4: {
    gebruikers: 12141,
    nieuweGebruikers: 9860,
    sessies: 16420,
    engagedSessions: 10932,
    engagementRate: 66.6,
    gemSessieduur: 218, // seconden
    aankopen: 412,
    omzet: 147600,
    aov: 358.25,
    conversieratio: 2.51,
  },

  events: {
    view_item: 33956,
    add_to_cart: 3135,
    view_cart: 1707,
    remove_from_cart: 682,
    begin_checkout: 1058,
    purchase: 412,
  },

  eventsVorigePeriode: {
    view_item: 29740,
    add_to_cart: 2810,
    view_cart: 1502,
    remove_from_cart: 631,
    begin_checkout: 921,
    purchase: 349,
  },

  // Acquisitie per GA4-kanaalgroep
  acquisitie: [
    { kanaal: 'Direct',          gebruikers: 5200, sessies: 6840, aankopen: 123, omzet: 44280, conversieratio: 1.80 },
    { kanaal: 'Paid Search',     gebruikers: 1333, sessies: 1901, aankopen: 77,  omzet: 29244, conversieratio: 4.05 },
    { kanaal: 'Paid Social',     gebruikers: 1468, sessies: 1988, aankopen: 26,  omzet: 8788,  conversieratio: 1.31 },
    { kanaal: 'Organic Search',  gebruikers: 1206, sessies: 1704, aankopen: 71,  omzet: 26838, conversieratio: 4.17 },
    { kanaal: 'Organic Social',  gebruikers: 1446, sessies: 1802, aankopen: 21,  omzet: 6972,  conversieratio: 1.17 },
    { kanaal: 'Cross-network',   gebruikers: 1520, sessies: 1944, aankopen: 62,  omzet: 22940, conversieratio: 3.19 },
    { kanaal: 'Email',           gebruikers: 120,  sessies: 184,  aankopen: 24,  omzet: 6960,  conversieratio: 13.04 },
    { kanaal: 'Referral',        gebruikers: 76,   sessies: 98,   aankopen: 6,   omzet: 1578,  conversieratio: 6.12 },
    { kanaal: 'Paid Shopping',   gebruikers: 62,   sessies: 78,   aankopen: 2,   omzet: 0,     conversieratio: 2.56 },
    { kanaal: 'Unassigned',      gebruikers: 261,  sessies: 302,  aankopen: 0,   omzet: 0,     conversieratio: 0 },
  ],

  googleAds: {
    totalen: { kosten: 11240, klikken: 3790, vertoningen: 132958, ctr: 2.85, cpc: 2.97, conversies: 281, cpa: 40.00, conversiewaarde: 89840, roas: 7.99 },

    maanden: [
      { maand: '2026-01', vertoningen: 76399,  klikken: 3596, ctr: 4.71, cpc: 0.64, kosten: 2284, conversies: 347, cpa: 6.58,  conversiewaarde: 26167, roas: 11.46 },
      { maand: '2026-02', vertoningen: 87507,  klikken: 3192, ctr: 3.65, cpc: 0.63, kosten: 2019, conversies: 182, cpa: 11.09, conversiewaarde: 11821, roas: 5.86 },
      { maand: '2026-03', vertoningen: 114512, klikken: 3963, ctr: 3.46, cpc: 0.73, kosten: 2901, conversies: 238, cpa: 12.19, conversiewaarde: 18012, roas: 6.21 },
      { maand: '2026-04', vertoningen: 139285, klikken: 4870, ctr: 3.50, cpc: 0.75, kosten: 3664, conversies: 265, cpa: 13.83, conversiewaarde: 19074, roas: 5.21 },
      { maand: '2026-05', vertoningen: 148002, klikken: 4526, ctr: 3.06, cpc: 0.72, kosten: 3246, conversies: 381, cpa: 8.52,  conversiewaarde: 24295, roas: 7.49 },
      { maand: '2026-06', vertoningen: 148595, klikken: 4268, ctr: 2.87, cpc: 0.72, kosten: 3063, conversies: 129, cpa: 23.74, conversiewaarde: 8857,  roas: 2.89 },
      { maand: '2026-07', vertoningen: 132958, klikken: 3790, ctr: 2.85, cpc: 0.49, kosten: 1864, conversies: 281, cpa: 6.63,  conversiewaarde: 7072,  roas: 3.79 },
    ],

    campagnes: [
      { naam: 'Search | NL | Merk',            type: 'Search',          kosten: 1450, klikken: 849,  vertoningen: 9772,   conversies: 96, cpa: 15.10, conversiewaarde: 18608, roas: 12.83 },
      { naam: 'Performance Max | NL | Alles',  type: 'Performance Max', kosten: 4820, klikken: 1402, vertoningen: 62840, conversies: 108, cpa: 44.63, conversiewaarde: 41260, roas: 8.56 },
      { naam: 'Shopping | NL | Standaard',     type: 'Standard Shopping', kosten: 2960, klikken: 1024, vertoningen: 41208, conversies: 54, cpa: 54.81, conversiewaarde: 21400, roas: 7.23 },
      { naam: 'Search | NL | Niet-merk',       type: 'Search',          kosten: 2010, klikken: 515,  vertoningen: 19138, conversies: 23, cpa: 87.39, conversiewaarde: 8572,  roas: 4.26 },
    ],

    zoekwoorden: [
      { zoekwoord: 'tafelwerk studio',       matchtype: 'Exact',  vertoningen: 968,  klikken: 488, ctr: 50.41, cpc: 0.26, kosten: 126, conversies: 31, cpa: 4.06,  conversiewaarde: 11845, roas: 94.01 },
      { zoekwoord: 'eiken eettafel op maat', matchtype: 'Exact',  vertoningen: 885,  klikken: 376, ctr: 42.49, cpc: 0.53, kosten: 201, conversies: 19, cpa: 10.58, conversiewaarde: 7058,  roas: 35.11 },
      { zoekwoord: 'massief houten tafel',   matchtype: 'Phrase', vertoningen: 1350, klikken: 141, ctr: 10.44, cpc: 0.38, kosten: 54,  conversies: 7,  cpa: 7.71,  conversiewaarde: 2774,  roas: 51.37 },
      { zoekwoord: 'tafel laten maken',      matchtype: 'Phrase', vertoningen: 1204, klikken: 98,  ctr: 8.14,  cpc: 0.92, kosten: 90,  conversies: 4,  cpa: 22.50, conversiewaarde: 1512,  roas: 16.80 },
      { zoekwoord: 'design eettafel',        matchtype: 'Breed',  vertoningen: 3140, klikken: 63,  ctr: 2.01,  cpc: 1.39, kosten: 88,  conversies: 1,  cpa: 88.00, conversiewaarde: 342,   roas: 3.89 },
    ],

    matchtypes: [
      { matchtype: 'Exact',  vertoningen: 4597, klikken: 1220, ctr: 26.54, cpc: 0.57, kosten: 690, conversies: 77, cpa: 8.96,  conversiewaarde: 24935, roas: 36.14 },
      { matchtype: 'Phrase', vertoningen: 7352, klikken: 325,  ctr: 4.42,  cpc: 0.75, kosten: 244, conversies: 16, cpa: 15.25, conversiewaarde: 4334,  roas: 17.76 },
      { matchtype: 'Breed',  vertoningen: 9840, klikken: 218,  ctr: 2.22,  cpc: 1.24, kosten: 270, conversies: 4,  cpa: 67.50, conversiewaarde: 1204,  roas: 4.46 },
    ],

    eindUrls: [
      { url: '/',                        vertoningen: 2738, klikken: 1100, ctr: 40.18, cpc: 0.52, kosten: 569, conversies: 71, cpa: 8.01,  conversiewaarde: 25670 },
      { url: '/shop/',                   vertoningen: 3944, klikken: 279,  ctr: 7.07,  cpc: 0.98, kosten: 274, conversies: 7,  cpa: 39.14, conversiewaarde: 2508 },
      { url: '/shop/eettafels/',         vertoningen: 3652, klikken: 99,   ctr: 2.71,  cpc: 0.59, kosten: 58,  conversies: 4,  cpa: 14.50, conversiewaarde: 1432 },
      { url: '/shop/salontafels/',       vertoningen: 1523, klikken: 66,   ctr: 4.33,  cpc: 0.48, kosten: 32,  conversies: 1,  cpa: 32.00, conversiewaarde: 358 },
    ],

    apparaten: [
      { apparaat: 'Computer',      kosten: 5240, klikken: 1612, conversies: 148, conversiewaarde: 48920 },
      { apparaat: 'Mobiel',        kosten: 4890, klikken: 1804, conversies: 106, conversiewaarde: 32410 },
      { apparaat: 'Tablet',        kosten: 1110, klikken: 374,  conversies: 27,  conversiewaarde: 8510 },
    ],
  },

  merchantCenter: {
    totaalProducten: 428,
    goedgekeurd: 391,
    beperkt: 22,
    afgekeurd: 15,
    waarschuwingen: 34,
    laatsteSync: '2026-07-21T06:12:00Z',
    problemen: [
      { probleem: 'Ontbrekende GTIN',                 producten: 15, ernst: 'afgekeurd' },
      { probleem: 'Afbeelding te klein',              producten: 12, ernst: 'beperkt' },
      { probleem: 'Verzendkosten niet geconfigureerd', producten: 10, ernst: 'beperkt' },
      { probleem: 'Beschrijving te kort',             producten: 34, ernst: 'waarschuwing' },
    ],
  },

  searchConsole: {
    klikken: 4820,
    impressies: 186400,
    ctr: 2.59,
    gemPositie: 12.4,
    branded: { klikken: 1940, impressies: 24800, ctr: 7.82, gemPositie: 2.1 },
    nonBranded: { klikken: 2880, impressies: 161600, ctr: 1.78, gemPositie: 14.2 },
    laatsteDatum: '2026-07-19',
  },

  doelen: [
    { kpi: 'omzet',      periode: 'maand', target: 140000, actueel: 147600, eigenaar: 'Lotte de Vries' },
    { kpi: 'roas',       periode: 'maand', target: 7.5,    actueel: 8.0,    eigenaar: 'Sam Bakker' },
    { kpi: 'aankopen',   periode: 'maand', target: 400,    actueel: 412,    eigenaar: 'Sam Bakker' },
    { kpi: 'maandbudget', periode: 'maand', target: 22000, actueel: 18450,  eigenaar: 'Lotte de Vries' },
  ],
};

/* ---------------------------------------------------------------
   Klant 2: Draadloos Mode — dalende ROAS, feedproblemen
   --------------------------------------------------------------- */

const draadloos = {
  clientId: 'draadloos',

  ga4: {
    gebruikers: 28470,
    nieuweGebruikers: 21980,
    sessies: 38210,
    engagedSessions: 22180,
    engagementRate: 58.0,
    gemSessieduur: 164,
    aankopen: 604,
    omzet: 51340,
    aov: 85.00,
    conversieratio: 1.58,
  },

  events: {
    view_item: 88420,
    add_to_cart: 7240,
    view_cart: 3880,
    remove_from_cart: 1920,
    begin_checkout: 2140,
    purchase: 604,
  },

  eventsVorigePeriode: {
    view_item: 79200,
    add_to_cart: 7010,
    view_cart: 3940,
    remove_from_cart: 1680,
    begin_checkout: 2280,
    purchase: 688,
  },

  acquisitie: [
    { kanaal: 'Paid Social',    gebruikers: 9840, sessies: 12420, aankopen: 148, omzet: 12580, conversieratio: 1.19 },
    { kanaal: 'Organic Search', gebruikers: 6120, sessies: 8410,  aankopen: 172, omzet: 14620, conversieratio: 2.05 },
    { kanaal: 'Direct',         gebruikers: 5230, sessies: 6980,  aankopen: 121, omzet: 10285, conversieratio: 1.73 },
    { kanaal: 'Paid Search',    gebruikers: 3410, sessies: 4620,  aankopen: 98,  omzet: 8330,  conversieratio: 2.12 },
    { kanaal: 'Paid Shopping',  gebruikers: 2140, sessies: 2890,  aankopen: 41,  omzet: 3485,  conversieratio: 1.42 },
    { kanaal: 'Email',          gebruikers: 980,  sessies: 1410,  aankopen: 19,  omzet: 1615,  conversieratio: 1.35 },
    { kanaal: 'Organic Social', gebruikers: 750,  sessies: 1480,  aankopen: 5,   omzet: 425,   conversieratio: 0.34 },
  ],

  googleAds: {
    totalen: { kosten: 9840, klikken: 6420, vertoningen: 284100, ctr: 2.26, cpc: 1.53, conversies: 139, cpa: 70.79, conversiewaarde: 11815, roas: 1.20 },
    maanden: [
      { maand: '2026-02', vertoningen: 198400, klikken: 5210, ctr: 2.63, cpc: 1.21, kosten: 6304, conversies: 184, cpa: 34.26, conversiewaarde: 16560, roas: 2.63 },
      { maand: '2026-03', vertoningen: 214800, klikken: 5640, ctr: 2.63, cpc: 1.28, kosten: 7219, conversies: 178, cpa: 40.56, conversiewaarde: 15130, roas: 2.10 },
      { maand: '2026-04', vertoningen: 241200, klikken: 6010, ctr: 2.49, cpc: 1.34, kosten: 8053, conversies: 166, cpa: 48.51, conversiewaarde: 14110, roas: 1.75 },
      { maand: '2026-05', vertoningen: 258900, klikken: 6180, ctr: 2.39, cpc: 1.41, kosten: 8714, conversies: 158, cpa: 55.15, conversiewaarde: 13430, roas: 1.54 },
      { maand: '2026-06', vertoningen: 271400, klikken: 6340, ctr: 2.34, cpc: 1.48, kosten: 9383, conversies: 147, cpa: 63.83, conversiewaarde: 12495, roas: 1.33 },
      { maand: '2026-07', vertoningen: 284100, klikken: 6420, ctr: 2.26, cpc: 1.53, kosten: 9840, conversies: 139, cpa: 70.79, conversiewaarde: 11815, roas: 1.20 },
    ],
    campagnes: [
      { naam: 'Performance Max | NL | Feed', type: 'Performance Max', kosten: 4920, klikken: 3180, vertoningen: 162400, conversies: 68, cpa: 72.35, conversiewaarde: 5780, roas: 1.17 },
      { naam: 'Shopping | NL | Sale',        type: 'Standard Shopping', kosten: 2810, klikken: 1840, vertoningen: 84200, conversies: 41, cpa: 68.54, conversiewaarde: 3485, roas: 1.24 },
      { naam: 'Search | NL | Merk',          type: 'Search',          kosten: 1210, klikken: 980,  vertoningen: 21400, conversies: 24, cpa: 50.42, conversiewaarde: 2040, roas: 1.69 },
      { naam: 'Demand Gen | NL | Prospect',  type: 'Demand Gen',      kosten: 900,  klikken: 420,  vertoningen: 16100, conversies: 6,  cpa: 150.00, conversiewaarde: 510, roas: 0.57 },
    ],
    zoekwoorden: [
      { zoekwoord: 'draadloos mode',      matchtype: 'Exact',  vertoningen: 1840, klikken: 812, ctr: 44.13, cpc: 0.42, kosten: 341, conversies: 28, cpa: 12.18, conversiewaarde: 2380, roas: 6.98 },
      { zoekwoord: 'sportlegging dames',  matchtype: 'Phrase', vertoningen: 8420, klikken: 640, ctr: 7.60,  cpc: 1.64, kosten: 1050, conversies: 14, cpa: 75.00, conversiewaarde: 1190, roas: 1.13 },
      { zoekwoord: 'sport bh kopen',      matchtype: 'Phrase', vertoningen: 6180, klikken: 412, ctr: 6.67,  cpc: 1.82, kosten: 750, conversies: 8,  cpa: 93.75, conversiewaarde: 680,  roas: 0.91 },
      { zoekwoord: 'goedkope sportkleding', matchtype: 'Breed', vertoningen: 14200, klikken: 380, ctr: 2.68, cpc: 2.14, kosten: 813, conversies: 3, cpa: 271.00, conversiewaarde: 255, roas: 0.31 },
    ],
    matchtypes: [
      { matchtype: 'Exact',  vertoningen: 42800,  klikken: 2140, ctr: 5.00, cpc: 0.68, kosten: 1455, conversies: 62, cpa: 23.47,  conversiewaarde: 5270, roas: 3.62 },
      { matchtype: 'Phrase', vertoningen: 98400,  klikken: 2410, ctr: 2.45, cpc: 1.62, kosten: 3904, conversies: 51, cpa: 76.55,  conversiewaarde: 4335, roas: 1.11 },
      { matchtype: 'Breed',  vertoningen: 142900, klikken: 1870, ctr: 1.31, cpc: 2.40, kosten: 4488, conversies: 26, cpa: 172.62, conversiewaarde: 2210, roas: 0.49 },
    ],
    eindUrls: [
      { url: '/',                     vertoningen: 24100, klikken: 1840, ctr: 7.63, cpc: 0.94, kosten: 1730, conversies: 52, cpa: 33.27, conversiewaarde: 4420 },
      { url: '/shop/leggings/',       vertoningen: 68200, klikken: 1620, ctr: 2.38, cpc: 1.58, kosten: 2560, conversies: 34, cpa: 75.29, conversiewaarde: 2890 },
      { url: '/shop/sport-bhs/',      vertoningen: 52400, klikken: 1210, ctr: 2.31, cpc: 1.72, kosten: 2081, conversies: 28, cpa: 74.32, conversiewaarde: 2380 },
      { url: '/sale/',                vertoningen: 41800, klikken: 980,  ctr: 2.34, cpc: 1.84, kosten: 1803, conversies: 18, cpa: 100.17, conversiewaarde: 1530 },
    ],
    apparaten: [
      { apparaat: 'Mobiel',   kosten: 6820, klikken: 4610, conversies: 88, conversiewaarde: 7480 },
      { apparaat: 'Computer', kosten: 2410, klikken: 1310, conversies: 41, conversiewaarde: 3485 },
      { apparaat: 'Tablet',   kosten: 610,  klikken: 500,  conversies: 10, conversiewaarde: 850 },
    ],
  },

  merchantCenter: {
    totaalProducten: 1842,
    goedgekeurd: 1421,
    beperkt: 148,
    afgekeurd: 273,
    waarschuwingen: 216,
    laatsteSync: '2026-07-21T05:40:00Z',
    problemen: [
      { probleem: 'Onjuiste prijs ten opzichte van landingspagina', producten: 142, ernst: 'afgekeurd' },
      { probleem: 'Ontbrekende beschikbaarheid',                   producten: 131, ernst: 'afgekeurd' },
      { probleem: 'Afbeelding kan niet worden opgehaald',          producten: 96,  ernst: 'beperkt' },
      { probleem: 'Ontbrekend merk',                               producten: 52,  ernst: 'beperkt' },
      { probleem: 'Titel bevat promotionele tekst',                producten: 216, ernst: 'waarschuwing' },
    ],
  },

  searchConsole: {
    klikken: 18420,
    impressies: 842000,
    ctr: 2.19,
    gemPositie: 18.7,
    branded: { klikken: 6820, impressies: 78400, ctr: 8.70, gemPositie: 1.8 },
    nonBranded: { klikken: 11600, impressies: 763600, ctr: 1.52, gemPositie: 20.4 },
    laatsteDatum: '2026-07-19',
  },

  doelen: [
    { kpi: 'omzet',       periode: 'maand', target: 68000, actueel: 51340, eigenaar: 'Noor El Amrani' },
    { kpi: 'roas',        periode: 'maand', target: 2.5,   actueel: 1.20,  eigenaar: 'Noor El Amrani' },
    { kpi: 'aankopen',    periode: 'maand', target: 750,   actueel: 604,   eigenaar: 'Noor El Amrani' },
    { kpi: 'maandbudget', periode: 'maand', target: 12000, actueel: 9840,  eigenaar: 'Eva Krol' },
  ],
};

/* ---------------------------------------------------------------
   Klant 3: Kaap Noord — internationale webshop, schaalruimte
   --------------------------------------------------------------- */

const kaapnoord = {
  clientId: 'kaapnoord',

  ga4: {
    gebruikers: 46820,
    nieuweGebruikers: 36140,
    sessies: 64180,
    engagedSessions: 41890,
    engagementRate: 65.3,
    gemSessieduur: 232,
    aankopen: 1284,
    omzet: 218280,
    aov: 170.00,
    conversieratio: 2.00,
  },

  events: {
    view_item: 142600,
    add_to_cart: 12840,
    view_cart: 6920,
    remove_from_cart: 2410,
    begin_checkout: 4180,
    purchase: 1284,
  },

  eventsVorigePeriode: {
    view_item: 128400,
    add_to_cart: 11210,
    view_cart: 6140,
    remove_from_cart: 2280,
    begin_checkout: 3620,
    purchase: 1082,
  },

  acquisitie: [
    { kanaal: 'Organic Search', gebruikers: 14820, sessies: 20140, aankopen: 462, omzet: 78540, conversieratio: 2.29 },
    { kanaal: 'Paid Search',    gebruikers: 9840,  sessies: 13210, aankopen: 318, omzet: 54060, conversieratio: 2.41 },
    { kanaal: 'Direct',         gebruikers: 8420,  sessies: 11480, aankopen: 224, omzet: 38080, conversieratio: 1.95 },
    { kanaal: 'Paid Shopping',  gebruikers: 5610,  sessies: 7840,  aankopen: 148, omzet: 25160, conversieratio: 1.89 },
    { kanaal: 'Paid Social',    gebruikers: 4210,  sessies: 6120,  aankopen: 68,  omzet: 11560, conversieratio: 1.11 },
    { kanaal: 'Email',          gebruikers: 2180,  sessies: 3410,  aankopen: 52,  omzet: 8840,  conversieratio: 1.52 },
    { kanaal: 'Referral',       gebruikers: 1740,  sessies: 1980,  aankopen: 12,  omzet: 2040,  conversieratio: 0.61 },
  ],

  googleAds: {
    totalen: { kosten: 24180, klikken: 18420, vertoningen: 682400, ctr: 2.70, cpc: 1.31, conversies: 466, cpa: 51.89, conversiewaarde: 79220, roas: 3.28 },
    maanden: [
      { maand: '2026-02', vertoningen: 421000, klikken: 11240, ctr: 2.67, cpc: 1.18, kosten: 13263, conversies: 284, cpa: 46.70, conversiewaarde: 48280, roas: 3.64 },
      { maand: '2026-03', vertoningen: 468200, klikken: 12810, ctr: 2.74, cpc: 1.22, kosten: 15628, conversies: 318, cpa: 49.14, conversiewaarde: 54060, roas: 3.46 },
      { maand: '2026-04', vertoningen: 521400, klikken: 14020, ctr: 2.69, cpc: 1.25, kosten: 17525, conversies: 362, cpa: 48.41, conversiewaarde: 61540, roas: 3.51 },
      { maand: '2026-05', vertoningen: 584200, klikken: 15840, ctr: 2.71, cpc: 1.27, kosten: 20117, conversies: 408, cpa: 49.31, conversiewaarde: 69360, roas: 3.45 },
      { maand: '2026-06', vertoningen: 638400, klikken: 17210, ctr: 2.70, cpc: 1.29, kosten: 22201, conversies: 441, cpa: 50.34, conversiewaarde: 74970, roas: 3.38 },
      { maand: '2026-07', vertoningen: 682400, klikken: 18420, ctr: 2.70, cpc: 1.31, kosten: 24180, conversies: 466, cpa: 51.89, conversiewaarde: 79220, roas: 3.28 },
    ],
    campagnes: [
      { naam: 'Performance Max | EU | Alles',  type: 'Performance Max', kosten: 11420, klikken: 8210, vertoningen: 342000, conversies: 224, cpa: 50.98, conversiewaarde: 38080, roas: 3.33 },
      { naam: 'Shopping | NL/BE | Standaard',  type: 'Standard Shopping', kosten: 6840, klikken: 5120, vertoningen: 198400, conversies: 132, cpa: 51.82, conversiewaarde: 22440, roas: 3.28 },
      { naam: 'Search | NL | Merk',            type: 'Search',          kosten: 2410, klikken: 2840, vertoningen: 42800, conversies: 78, cpa: 30.90, conversiewaarde: 13260, roas: 5.50 },
      { naam: 'Search | DE | Niet-merk',       type: 'Search',          kosten: 3510, klikken: 2250, vertoningen: 99200, conversies: 32, cpa: 109.69, conversiewaarde: 5440, roas: 1.55 },
    ],
    zoekwoorden: [
      { zoekwoord: 'kaap noord',           matchtype: 'Exact',  vertoningen: 4210,  klikken: 2140, ctr: 50.83, cpc: 0.38, kosten: 813,  conversies: 62, cpa: 13.11,  conversiewaarde: 10540, roas: 12.96 },
      { zoekwoord: 'outdoor jas heren',    matchtype: 'Exact',  vertoningen: 12400, klikken: 1840, ctr: 14.84, cpc: 1.12, kosten: 2061, conversies: 48, cpa: 42.94,  conversiewaarde: 8160,  roas: 3.96 },
      { zoekwoord: 'waterdichte jas',      matchtype: 'Phrase', vertoningen: 24800, klikken: 1620, ctr: 6.53,  cpc: 1.48, kosten: 2398, conversies: 34, cpa: 70.53,  conversiewaarde: 5780,  roas: 2.41 },
      { zoekwoord: 'wandelschoenen kopen', matchtype: 'Phrase', vertoningen: 18600, klikken: 1210, ctr: 6.51,  cpc: 1.62, kosten: 1960, conversies: 24, cpa: 81.67,  conversiewaarde: 4080,  roas: 2.08 },
      { zoekwoord: 'outdoor kleding',      matchtype: 'Breed',  vertoningen: 42100, klikken: 980,  ctr: 2.33,  cpc: 2.08, kosten: 2038, conversies: 12, cpa: 169.83, conversiewaarde: 2040,  roas: 1.00 },
    ],
    matchtypes: [
      { matchtype: 'Exact',  vertoningen: 142600, klikken: 8420, ctr: 5.90, cpc: 0.82, kosten: 6904,  conversies: 248, cpa: 27.84,  conversiewaarde: 42160, roas: 6.11 },
      { matchtype: 'Phrase', vertoningen: 284100, klikken: 6820, ctr: 2.40, cpc: 1.42, kosten: 9684,  conversies: 158, cpa: 61.29,  conversiewaarde: 26860, roas: 2.77 },
      { matchtype: 'Breed',  vertoningen: 255700, klikken: 3180, ctr: 1.24, cpc: 2.39, kosten: 7592,  conversies: 60,  cpa: 126.53, conversiewaarde: 10200, roas: 1.34 },
    ],
    eindUrls: [
      { url: '/',                    vertoningen: 62400,  klikken: 4820, ctr: 7.72, cpc: 0.68, kosten: 3278, conversies: 148, cpa: 22.15, conversiewaarde: 25160 },
      { url: '/shop/jassen/',        vertoningen: 184200, klikken: 5240, ctr: 2.85, cpc: 1.32, kosten: 6917, conversies: 132, cpa: 52.40, conversiewaarde: 22440 },
      { url: '/shop/schoenen/',      vertoningen: 148600, klikken: 4180, ctr: 2.81, cpc: 1.44, kosten: 6019, conversies: 98,  cpa: 61.42, conversiewaarde: 16660 },
      { url: '/shop/accessoires/',   vertoningen: 98400,  klikken: 2410, ctr: 2.45, cpc: 1.58, kosten: 3808, conversies: 42,  cpa: 90.67, conversiewaarde: 7140 },
    ],
    apparaten: [
      { apparaat: 'Mobiel',   kosten: 12840, klikken: 10210, conversies: 218, conversiewaarde: 37060 },
      { apparaat: 'Computer', kosten: 9210,  klikken: 6420,  conversies: 208, conversiewaarde: 35360 },
      { apparaat: 'Tablet',   kosten: 2130,  klikken: 1790,  conversies: 40,  conversiewaarde: 6800 },
    ],
  },

  merchantCenter: {
    totaalProducten: 3240,
    goedgekeurd: 3128,
    beperkt: 84,
    afgekeurd: 28,
    waarschuwingen: 142,
    laatsteSync: '2026-07-21T06:02:00Z',
    problemen: [
      { probleem: 'Ontbrekende maatgegevens',       producten: 84, ernst: 'beperkt' },
      { probleem: 'Ontbrekende GTIN',               producten: 28, ernst: 'afgekeurd' },
      { probleem: 'Beschrijving kan beter',         producten: 142, ernst: 'waarschuwing' },
    ],
  },

  searchConsole: {
    klikken: 42180,
    impressies: 1284000,
    ctr: 3.28,
    gemPositie: 9.8,
    branded: { klikken: 12840, impressies: 142000, ctr: 9.04, gemPositie: 1.4 },
    nonBranded: { klikken: 29340, impressies: 1142000, ctr: 2.57, gemPositie: 10.9 },
    laatsteDatum: '2026-07-19',
  },

  doelen: [
    { kpi: 'omzet',       periode: 'maand', target: 200000, actueel: 218280, eigenaar: 'Eva Krol' },
    { kpi: 'roas',        periode: 'maand', target: 3.0,    actueel: 3.28,   eigenaar: 'Sam Bakker' },
    { kpi: 'aankopen',    periode: 'maand', target: 1200,   actueel: 1284,   eigenaar: 'Sam Bakker' },
    { kpi: 'maandbudget', periode: 'maand', target: 28000,  actueel: 24180,  eigenaar: 'Eva Krol' },
  ],
};

/* ---------------------------------------------------------------
   Export
   --------------------------------------------------------------- */

export const ECOMMERCE_DATA = {
  tafelwerk,
  draadloos,
  kaapnoord,
};

export function getEcommerceData(clientId) {
  return ECOMMERCE_DATA[clientId] ?? null;
}
