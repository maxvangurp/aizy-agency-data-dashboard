/**
 * Leadgeneratie demodataset.
 *
 * Structuur volgt wat een marketeer nodig heeft bij een leadgeneratieklant:
 * primaire leadacties gescheiden van secundaire signalen, de volledige funnel
 * van impressie tot klant, maanddoelen tegenover werkelijke aantallen en
 * lokale zichtbaarheid.
 *
 * Welke conversies primair of secundair zijn, verschilt per klant. Een
 * telefoonklik is bij een fysiotherapiepraktijk een serieus signaal maar geen
 * lead, terwijl een spoedaanvraag dat wel is. Daarom staat die indeling per
 * klant in `conversieConfig` en niet als vaste lijst in de code.
 *
 * Alle cijfers zijn deterministisch en fictief. Namen, domeinen en resultaten
 * zijn verzonnen en verwijzen niet naar bestaande organisaties.
 */

/* ---------------------------------------------------------------
   Conversietypen
   --------------------------------------------------------------- */

/** Alle conversies die het dashboard kent, met een leesbaar label. */
export const CONVERSIE_LABELS = {
  contactformulier: 'Contactformulier',
  offerteaanvraag: 'Offerteaanvraag',
  adviesaanvraag: 'Adviesaanvraag',
  afspraakGepland: 'Afspraak gepland',
  spoedaanvraag: 'Spoedaanvraag',
  gekwalificeerdeLead: 'Gekwalificeerde lead',
  offlineKlant: 'Offline klant',
  demoAanvraag: 'Demoaanvraag',
  bezichtiging: 'Bezichtiging aangevraagd',
  waardebepaling: 'Waardebepaling aangevraagd',
  telefoonklik: 'Telefoonklik',
  emailklik: 'E-mailklik',
  whatsappKlik: 'WhatsApp-klik',
  brochureDownload: 'Brochure download',
  formulierGestart: 'Formulier gestart',
  nieuwsbrief: 'Nieuwsbriefinschrijving',
  routeaanvraag: 'Routeaanvraag',
};

/* ---------------------------------------------------------------
   Funnel
   --------------------------------------------------------------- */

/**
 * De volledige leadfunnel, van advertentievertoning tot betalende klant.
 * De stappen komen uit verschillende bronnen; dat staat per stap vermeld
 * zodat een afwijking herleidbaar blijft.
 */
export const LEAD_FUNNEL_STAPPEN = [
  { key: 'impressies', label: 'Impressies', bron: 'Google Ads' },
  { key: 'klikken', label: 'Klikken', bron: 'Google Ads' },
  { key: 'landingspaginaWeergaven', label: 'Landingspagina bekeken', bron: 'Google Analytics 4' },
  { key: 'engagement', label: 'Engagement', bron: 'Google Analytics 4' },
  { key: 'formulierGestart', label: 'Formulier gestart', bron: 'Google Analytics 4' },
  { key: 'leads', label: 'Lead', bron: 'Google Analytics 4' },
  { key: 'gekwalificeerdeLeads', label: 'Gekwalificeerde lead', bron: 'CRM' },
  { key: 'afsprakenOfOffertes', label: 'Afspraak of offerte', bron: 'CRM' },
  { key: 'klanten', label: 'Klant', bron: 'CRM' },
];

/**
 * Bouwt de funnel met doorstroom, uitval en het verschil met de vorige periode.
 * Het grootste relatieve verlies wordt gemarkeerd als knelpunt.
 */
export function buildLeadFunnel(stappen, vorigePeriode = null) {
  const rijen = LEAD_FUNNEL_STAPPEN.map((stap, i) => {
    // Bewust geen ?? 0. Een ontbrekende meting blijft null, anders zou een
    // niet-gekoppelde bron als een resultaat van nul worden gepresenteerd.
    const volume = stappen[stap.key] ?? null;
    const vorigeStap = i === 0 ? null : stappen[LEAD_FUNNEL_STAPPEN[i - 1].key] ?? null;
    const vorigeWaarde = vorigePeriode?.[stap.key] ?? null;

    // Doorstroom en uitval zijn alleen te berekenen als beide stappen gemeten zijn.
    const meetbaar = volume != null && vorigeStap != null && vorigeStap !== 0;

    return {
      ...stap,
      volume,
      doorstroom: i === 0 ? (volume == null ? null : 100) : meetbaar ? (volume / vorigeStap) * 100 : null,
      uitval: meetbaar ? vorigeStap - volume : null,
      vanTotaal: volume != null && stappen.impressies ? (volume / stappen.impressies) * 100 : null,
      vorigePeriode: vorigeWaarde,
      verschil:
        volume != null && vorigeWaarde != null && vorigeWaarde !== 0
          ? ((volume - vorigeWaarde) / vorigeWaarde) * 100
          : null,
    };
  });

  // Het knelpunt is de stap met de laagste doorstroom, maar niet elke daling is
  // een probleem. De stap van impressie naar klik is de doorklikratio en ligt in
  // advertenties altijd rond enkele procenten; die zou het knelpunt permanent
  // opeisen zonder iets te zeggen. De beoordeling begint daarom bij de
  // landingspagina, waar een verlies wel beïnvloedbaar is.
  const EERSTE_BEOORDEELDE_STAP = LEAD_FUNNEL_STAPPEN.findIndex(
    (s) => s.key === 'landingspaginaWeergaven'
  );

  const knelpunt = rijen
    .slice(EERSTE_BEOORDEELDE_STAP)
    .filter((r) => r.doorstroom != null)
    .reduce((laagste, r) => (laagste === null || r.doorstroom < laagste.doorstroom ? r : laagste), null);

  return { rijen, knelpunt };
}

/**
 * Percentage van lead naar betalende klant.
 *
 * Geeft null terug wanneer het aantal klanten niet gemeten wordt. Zonder deze
 * controle zou null naar 0 worden omgezet en zou het dashboard beweren dat
 * geen enkele lead klant werd, terwijl het simpelweg onbekend is.
 */
export function leadToCustomer(stappen) {
  if (!stappen?.leads) return null;
  if (stappen.klanten == null) return null;
  return (stappen.klanten / stappen.leads) * 100;
}

/* ---------------------------------------------------------------
   Klant 1: Vitaalpunt Fysiotherapie
   Scenario: stijgende kosten per lead, dalend volume
   --------------------------------------------------------------- */

const vitaalpunt = {
  clientId: 'vitaalpunt',
  laatsteSync: '2026-07-21T06:20:00Z',
  trackingStatus: 'controle-aanbevolen',
  dataHealth: 74,

  /** Welke conversies tellen als lead en welke als ondersteunend signaal. */
  conversieConfig: {
    primair: ['contactformulier', 'afspraakGepland', 'adviesaanvraag', 'spoedaanvraag'],
    secundair: ['telefoonklik', 'emailklik', 'formulierGestart', 'nieuwsbrief', 'routeaanvraag'],
  },

  ga4: {
    gebruikers: 3184,
    nieuweGebruikers: 2610,
    sessies: 4120,
    engagedSessions: 2489,
    engagementRate: 60.4,
    gemSessieduur: 148,
    vorigePeriode: { gebruikers: 3402, nieuweGebruikers: 2814, sessies: 4386, engagementRate: 62.1 },
  },

  conversies: [
    { type: 'contactformulier', aantal: 42, vorigePeriode: 51 },
    { type: 'afspraakGepland', aantal: 34, vorigePeriode: 39 },
    { type: 'adviesaanvraag', aantal: 21, vorigePeriode: 24 },
    { type: 'spoedaanvraag', aantal: 12, vorigePeriode: 9 },
    { type: 'telefoonklik', aantal: 86, vorigePeriode: 74 },
    { type: 'emailklik', aantal: 41, vorigePeriode: 38 },
    { type: 'formulierGestart', aantal: 214, vorigePeriode: 236 },
    { type: 'nieuwsbrief', aantal: 18, vorigePeriode: 15 },
    { type: 'routeaanvraag', aantal: 29, vorigePeriode: 31 },
  ],

  funnelStappen: {
    impressies: 84200,
    klikken: 2140,
    landingspaginaWeergaven: 1892,
    engagement: 1148,
    formulierGestart: 214,
    leads: 109,
    gekwalificeerdeLeads: 71,
    afsprakenOfOffertes: 34,
    klanten: 19,
  },
  funnelVorigePeriode: {
    impressies: 81600,
    klikken: 2112,
    landingspaginaWeergaven: 1904,
    engagement: 1212,
    formulierGestart: 236,
    leads: 123,
    gekwalificeerdeLeads: 84,
    afsprakenOfOffertes: 39,
    klanten: 22,
  },

  kerncijfers: {
    leads: 109,
    gekwalificeerdeLeads: 71,
    cpl: 108.44,
    cpql: 166.48,
    afspraken: 34,
    offertes: 28,
    klanten: 19,
    pipelinewaarde: 61200,
    vorigePeriode: { leads: 123, gekwalificeerdeLeads: 84, cpl: 91.18, cpql: 133.51, afspraken: 39, offertes: 33, klanten: 22, pipelinewaarde: 70400 },
  },

  acquisitie: [
    { kanaal: 'Paid Search', gebruikers: 1284, sessies: 1702, leads: 58, gekwalificeerd: 38, cpl: 108.42, engagementRate: 64.2 },
    { kanaal: 'Organic Search', gebruikers: 986, sessies: 1284, leads: 31, gekwalificeerd: 21, cpl: null, engagementRate: 61.8 },
    { kanaal: 'Direct', gebruikers: 512, sessies: 648, leads: 12, gekwalificeerd: 8, cpl: null, engagementRate: 54.1 },
    { kanaal: 'Paid Social', gebruikers: 284, sessies: 372, leads: 6, gekwalificeerd: 3, cpl: 142.18, engagementRate: 41.2 },
    { kanaal: 'Referral', gebruikers: 118, sessies: 114, leads: 2, gekwalificeerd: 1, cpl: null, engagementRate: 58.4 },
  ],

  sourceMedium: [
    { bron: 'google / cpc', gebruikers: 1284, leads: 58 },
    { bron: 'google / organic', gebruikers: 986, leads: 31 },
    { bron: '(direct) / (none)', gebruikers: 512, leads: 12 },
    { bron: 'facebook / paid', gebruikers: 284, leads: 6 },
    { bron: 'zorgkaart.example / referral', gebruikers: 118, leads: 2 },
  ],

  landingspaginas: [
    { pagina: '/fysiotherapie', gebruikers: 842, leads: 41, conversieratio: 4.87 },
    { pagina: '/afspraak-maken', gebruikers: 486, leads: 34, conversieratio: 7.0 },
    { pagina: '/behandelingen/rugklachten', gebruikers: 394, leads: 18, conversieratio: 4.57 },
    { pagina: '/', gebruikers: 618, leads: 12, conversieratio: 1.94 },
    { pagina: '/contact', gebruikers: 214, leads: 13, conversieratio: 6.07 },
  ],

  apparaten: [
    { apparaat: 'Mobiel', gebruikers: 2140, leads: 68, conversieratio: 3.18 },
    { apparaat: 'Computer', gebruikers: 826, leads: 34, conversieratio: 4.12 },
    { apparaat: 'Tablet', gebruikers: 218, leads: 7, conversieratio: 3.21 },
  ],

  landen: [{ land: 'Nederland', gebruikers: 3086, leads: 107 }, { land: 'België', gebruikers: 98, leads: 2 }],

  regios: [
    { regio: 'Noord-Brabant', gebruikers: 1842, leads: 71 },
    { regio: 'Zuid-Holland', gebruikers: 486, leads: 14 },
    { regio: 'Noord-Holland', gebruikers: 342, leads: 9 },
    { regio: 'Gelderland', gebruikers: 284, leads: 8 },
    { regio: 'Limburg', gebruikers: 132, leads: 5 },
  ],

  googleAds: {
    totalen: { kosten: 11820, klikken: 2140, vertoningen: 84200, ctr: 2.54, cpc: 5.52, leads: 109, cpa: 108.44, conversieratio: 5.09, gekwalificeerdeLeads: 71, cpql: 166.48 },
    maanden: [
      { maand: '2026-02', vertoningen: 62400, klikken: 1840, ctr: 2.95, cpc: 4.42, kosten: 8133, leads: 142, cpa: 57.27, gekwalificeerdeLeads: 98, cpql: 82.99 },
      { maand: '2026-03', vertoningen: 68200, klikken: 1946, ctr: 2.85, cpc: 4.68, kosten: 9107, leads: 138, cpa: 65.99, gekwalificeerdeLeads: 92, cpql: 98.99 },
      { maand: '2026-04', vertoningen: 72800, klikken: 2018, ctr: 2.77, cpc: 4.91, kosten: 9908, leads: 134, cpa: 73.94, gekwalificeerdeLeads: 88, cpql: 112.59 },
      { maand: '2026-05', vertoningen: 78400, klikken: 2084, ctr: 2.66, cpc: 5.12, kosten: 10670, leads: 128, cpa: 83.36, gekwalificeerdeLeads: 84, cpql: 127.02 },
      { maand: '2026-06', vertoningen: 81600, klikken: 2112, ctr: 2.59, cpc: 5.31, kosten: 11215, leads: 123, cpa: 91.18, gekwalificeerdeLeads: 84, cpql: 133.51 },
      { maand: '2026-07', vertoningen: 84200, klikken: 2140, ctr: 2.54, cpc: 5.52, kosten: 11820, leads: 109, cpa: 108.44, gekwalificeerdeLeads: 71, cpql: 166.48 },
    ],
    campagnes: [
      { naam: 'Search | Regio | Fysiotherapie', type: 'Search', kosten: 6420, klikken: 1180, vertoningen: 42800, ctr: 2.76, cpc: 5.44, leads: 64, cpa: 100.31, conversieratio: 5.42, gekwalificeerdeLeads: 46, cpql: 139.57 },
      { naam: 'Search | Regio | Klachten', type: 'Search', kosten: 3180, klikken: 620, vertoningen: 24600, ctr: 2.52, cpc: 5.13, leads: 30, cpa: 106.0, conversieratio: 4.84, gekwalificeerdeLeads: 19, cpql: 167.37 },
      { naam: 'Performance Max | Regio', type: 'Performance Max', kosten: 2220, klikken: 340, vertoningen: 16800, ctr: 2.02, cpc: 6.53, leads: 15, cpa: 148.0, conversieratio: 4.41, gekwalificeerdeLeads: 6, cpql: 370.0 },
    ],
    advertentiegroepen: [
      { groep: 'Fysiotherapie | Algemeen', campagne: 'Search | Regio | Fysiotherapie', kosten: 3840, klikken: 712, leads: 41, cpa: 93.66, gekwalificeerdeLeads: 31 },
      { groep: 'Fysiotherapie | Spoed', campagne: 'Search | Regio | Fysiotherapie', kosten: 2580, klikken: 468, leads: 23, cpa: 112.17, gekwalificeerdeLeads: 15 },
      { groep: 'Klachten | Rug', campagne: 'Search | Regio | Klachten', kosten: 1920, klikken: 384, leads: 19, cpa: 101.05, gekwalificeerdeLeads: 12 },
      { groep: 'Klachten | Knie', campagne: 'Search | Regio | Klachten', kosten: 1260, klikken: 236, leads: 11, cpa: 114.55, gekwalificeerdeLeads: 7 },
    ],
    zoekwoorden: [
      { zoekwoord: 'fysiotherapeut in de buurt', matchtype: 'Phrase', vertoningen: 14200, klikken: 486, ctr: 3.42, cpc: 4.86, kosten: 2362, leads: 28, cpa: 84.36, gekwalificeerdeLeads: 22, cpql: 107.36 },
      { zoekwoord: 'fysiotherapie spoed', matchtype: 'Exact', vertoningen: 4820, klikken: 284, ctr: 5.89, cpc: 5.12, kosten: 1454, leads: 19, cpa: 76.53, gekwalificeerdeLeads: 15, cpql: 96.93 },
      { zoekwoord: 'rugklachten behandeling', matchtype: 'Phrase', vertoningen: 12400, klikken: 342, ctr: 2.76, cpc: 5.41, kosten: 1850, leads: 14, cpa: 132.14, gekwalificeerdeLeads: 9, cpql: 205.56 },
      { zoekwoord: 'fysiotherapie kosten', matchtype: 'Phrase', vertoningen: 9800, klikken: 268, ctr: 2.73, cpc: 4.94, kosten: 1324, leads: 9, cpa: 147.11, gekwalificeerdeLeads: 3, cpql: 441.33 },
      { zoekwoord: 'fysio', matchtype: 'Breed', vertoningen: 28400, klikken: 412, ctr: 1.45, cpc: 6.82, kosten: 2810, leads: 8, cpa: 351.25, gekwalificeerdeLeads: 2, cpql: 1405.0 },
    ],
  },

  googleBusinessProfile: {
    koppelingBeschikbaar: false,
    profielinteracties: 412,
    telefoongesprekken: 86,
    routeaanvragen: 29,
    websiteklikken: 148,
    vorigePeriode: { profielinteracties: 386, telefoongesprekken: 74, routeaanvragen: 31, websiteklikken: 134 },
  },

  doelen: [
    { kpi: 'leads', periode: 'maand', target: 130, actueel: 109, vorigePeriode: 123, eigenaar: 'Daan Verhoeven' },
    { kpi: 'gekwalificeerdeLeads', periode: 'maand', target: 85, actueel: 71, vorigePeriode: 84, eigenaar: 'Daan Verhoeven' },
    { kpi: 'afspraken', periode: 'maand', target: 40, actueel: 34, vorigePeriode: 39, eigenaar: 'Daan Verhoeven' },
    { kpi: 'offertes', periode: 'maand', target: 35, actueel: 28, vorigePeriode: 33, eigenaar: 'Daan Verhoeven' },
    { kpi: 'klanten', periode: 'maand', target: 24, actueel: 19, vorigePeriode: 22, eigenaar: 'Daan Verhoeven' },
    { kpi: 'cpl', periode: 'maand', target: 90, actueel: 108.44, vorigePeriode: 91.18, eigenaar: 'Noor El Amrani' },
    { kpi: 'cpql', periode: 'maand', target: 140, actueel: 166.48, vorigePeriode: 133.51, eigenaar: 'Noor El Amrani' },
    { kpi: 'websitegebruikers', periode: 'maand', target: 3500, actueel: 3184, vorigePeriode: 3402, eigenaar: 'Noor El Amrani' },
    { kpi: 'telefoongesprekken', periode: 'maand', target: 90, actueel: 86, vorigePeriode: 74, eigenaar: 'Daan Verhoeven' },
    { kpi: 'emailacties', periode: 'maand', target: 45, actueel: 41, vorigePeriode: 38, eigenaar: 'Daan Verhoeven' },
  ],

  doelHistorie: [
    { maand: '2026-02', target: 130, werkelijk: 142 },
    { maand: '2026-03', target: 130, werkelijk: 138 },
    { maand: '2026-04', target: 130, werkelijk: 134 },
    { maand: '2026-05', target: 130, werkelijk: 128 },
    { maand: '2026-06', target: 130, werkelijk: 123 },
    { maand: '2026-07', target: 130, werkelijk: 109 },
  ],

  klantverhaal: {
    goed: [
      'Spoedaanvragen stegen met 33 procent naar 12 per maand',
      'De telefoonklikken namen toe met 16 procent',
      'De campagne op spoedzoekwoorden levert de goedkoopste gekwalificeerde leads op met 96,93 euro',
    ],
    aandacht: [
      'De kosten per lead stegen van 91,18 naar 108,44 euro',
      'Het brede zoekwoord fysio kostte 2.810 euro en leverde 2 gekwalificeerde leads op',
      'Het aantal leads daalde zes maanden op rij, van 142 naar 109',
    ],
    gedaan: [
      'Zoekwoorden met een CPQL boven 400 euro gepauzeerd',
      'Aparte advertentiegroep ingericht voor spoedaanvragen',
      'Formulier op de afspraakpagina ingekort van 9 naar 5 velden',
    ],
    volgende: [
      'Het brede zoekwoord fysio omzetten naar phrase match',
      'Budget verschuiven naar de campagne op spoedzoekwoorden',
      'Belregistratie koppelen zodat telefonische leads meetellen',
    ],
    vanKlant: [
      'Terugkoppeling op de leadkwaliteit van de laatste 30 aanvragen',
      'Akkoord op het verplaatsen van 1.500 euro budget binnen het maandtotaal',
      'Actuele openingstijden voor het Google-bedrijfsprofiel',
    ],
  },
};

/* ---------------------------------------------------------------
   Klant 2: Meridiaan Bedrijfsadvies
   Scenario: weinig leads, hoge kwaliteit, lange doorlooptijd
   --------------------------------------------------------------- */

const meridiaan = {
  clientId: 'meridiaan',
  laatsteSync: '2026-07-21T06:35:00Z',
  trackingStatus: 'gezond',
  dataHealth: 91,

  conversieConfig: {
    primair: ['offerteaanvraag', 'adviesaanvraag', 'demoAanvraag', 'gekwalificeerdeLead'],
    secundair: ['brochureDownload', 'emailklik', 'telefoonklik', 'nieuwsbrief', 'formulierGestart'],
  },

  ga4: {
    gebruikers: 6842,
    nieuweGebruikers: 5218,
    sessies: 9140,
    engagedSessions: 6398,
    engagementRate: 70.0,
    gemSessieduur: 264,
    vorigePeriode: { gebruikers: 6210, nieuweGebruikers: 4820, sessies: 8340, engagementRate: 68.2 },
  },

  conversies: [
    { type: 'offerteaanvraag', aantal: 38, vorigePeriode: 31 },
    { type: 'adviesaanvraag', aantal: 24, vorigePeriode: 22 },
    { type: 'demoAanvraag', aantal: 19, vorigePeriode: 14 },
    { type: 'brochureDownload', aantal: 142, vorigePeriode: 118 },
    { type: 'emailklik', aantal: 68, vorigePeriode: 61 },
    { type: 'telefoonklik', aantal: 34, vorigePeriode: 29 },
    { type: 'nieuwsbrief', aantal: 86, vorigePeriode: 72 },
    { type: 'formulierGestart', aantal: 184, vorigePeriode: 156 },
  ],

  funnelStappen: {
    impressies: 142600,
    klikken: 3820,
    landingspaginaWeergaven: 3418,
    engagement: 2394,
    formulierGestart: 184,
    leads: 81,
    gekwalificeerdeLeads: 52,
    afsprakenOfOffertes: 38,
    klanten: 11,
  },
  funnelVorigePeriode: {
    impressies: 128400,
    klikken: 3410,
    landingspaginaWeergaven: 3062,
    engagement: 2088,
    formulierGestart: 156,
    leads: 67,
    gekwalificeerdeLeads: 41,
    afsprakenOfOffertes: 31,
    klanten: 8,
  },

  kerncijfers: {
    leads: 81,
    gekwalificeerdeLeads: 52,
    cpl: 232.1,
    cpql: 361.54,
    afspraken: 38,
    offertes: 38,
    klanten: 11,
    pipelinewaarde: 418000,
    vorigePeriode: { leads: 67, gekwalificeerdeLeads: 41, cpl: 258.21, cpql: 421.95, afspraken: 31, offertes: 31, klanten: 8, pipelinewaarde: 342000 },
  },

  acquisitie: [
    { kanaal: 'Paid Search', gebruikers: 2418, sessies: 3184, leads: 42, gekwalificeerd: 28, cpl: 268.42, engagementRate: 72.4 },
    { kanaal: 'LinkedIn Ads', gebruikers: 1284, sessies: 1642, leads: 21, gekwalificeerd: 16, cpl: 312.86, engagementRate: 68.1 },
    { kanaal: 'Organic Search', gebruikers: 1846, sessies: 2418, leads: 12, gekwalificeerd: 6, cpl: null, engagementRate: 74.2 },
    { kanaal: 'Direct', gebruikers: 942, sessies: 1284, leads: 5, gekwalificeerd: 2, cpl: null, engagementRate: 66.8 },
    { kanaal: 'Referral', gebruikers: 352, sessies: 612, leads: 1, gekwalificeerd: 0, cpl: null, engagementRate: 61.4 },
  ],

  sourceMedium: [
    { bron: 'google / cpc', gebruikers: 2418, leads: 42 },
    { bron: 'linkedin / paid', gebruikers: 1284, leads: 21 },
    { bron: 'google / organic', gebruikers: 1846, leads: 12 },
    { bron: '(direct) / (none)', gebruikers: 942, leads: 5 },
    { bron: 'brancheblad.example / referral', gebruikers: 352, leads: 1 },
  ],

  landingspaginas: [
    { pagina: '/bedrijfsadvies', gebruikers: 1842, leads: 31, conversieratio: 1.68 },
    { pagina: '/diensten/procesoptimalisatie', gebruikers: 1284, leads: 22, conversieratio: 1.71 },
    { pagina: '/demo-aanvragen', gebruikers: 486, leads: 19, conversieratio: 3.91 },
    { pagina: '/whitepaper', gebruikers: 1418, leads: 6, conversieratio: 0.42 },
    { pagina: '/', gebruikers: 1812, leads: 3, conversieratio: 0.17 },
  ],

  apparaten: [
    { apparaat: 'Computer', gebruikers: 4818, leads: 64, conversieratio: 1.33 },
    { apparaat: 'Mobiel', gebruikers: 1742, leads: 14, conversieratio: 0.8 },
    { apparaat: 'Tablet', gebruikers: 282, leads: 3, conversieratio: 1.06 },
  ],

  landen: [
    { land: 'Nederland', gebruikers: 5942, leads: 71 },
    { land: 'België', gebruikers: 642, leads: 8 },
    { land: 'Duitsland', gebruikers: 258, leads: 2 },
  ],

  regios: [
    { regio: 'Noord-Holland', gebruikers: 2184, leads: 28 },
    { regio: 'Zuid-Holland', gebruikers: 1842, leads: 24 },
    { regio: 'Utrecht', gebruikers: 1046, leads: 14 },
    { regio: 'Noord-Brabant', gebruikers: 842, leads: 9 },
    { regio: 'Gelderland', gebruikers: 486, leads: 4 },
  ],

  googleAds: {
    totalen: { kosten: 18800, klikken: 3820, vertoningen: 142600, ctr: 2.68, cpc: 4.92, leads: 81, cpa: 232.1, conversieratio: 2.12, gekwalificeerdeLeads: 52, cpql: 361.54 },
    maanden: [
      { maand: '2026-02', vertoningen: 98400, klikken: 2840, ctr: 2.89, cpc: 5.42, kosten: 15393, leads: 54, cpa: 285.06, gekwalificeerdeLeads: 31, cpql: 496.55 },
      { maand: '2026-03', vertoningen: 108200, klikken: 3040, ctr: 2.81, cpc: 5.28, kosten: 16051, leads: 58, cpa: 276.74, gekwalificeerdeLeads: 34, cpql: 472.09 },
      { maand: '2026-04', vertoningen: 116800, klikken: 3210, ctr: 2.75, cpc: 5.14, kosten: 16499, leads: 62, cpa: 266.11, gekwalificeerdeLeads: 38, cpql: 434.18 },
      { maand: '2026-05', vertoningen: 124200, klikken: 3420, ctr: 2.75, cpc: 5.06, kosten: 17305, leads: 66, cpa: 262.2, gekwalificeerdeLeads: 41, cpql: 422.07 },
      { maand: '2026-06', vertoningen: 128400, klikken: 3410, ctr: 2.66, cpc: 5.07, kosten: 17300, leads: 67, cpa: 258.21, gekwalificeerdeLeads: 41, cpql: 421.95 },
      { maand: '2026-07', vertoningen: 142600, klikken: 3820, ctr: 2.68, cpc: 4.92, kosten: 18800, leads: 81, cpa: 232.1, gekwalificeerdeLeads: 52, cpql: 361.54 },
    ],
    campagnes: [
      { naam: 'Search | NL | Bedrijfsadvies', type: 'Search', kosten: 8420, klikken: 1642, vertoningen: 58400, ctr: 2.81, cpc: 5.13, leads: 38, cpa: 221.58, conversieratio: 2.31, gekwalificeerdeLeads: 26, cpql: 323.85 },
      { naam: 'Search | NL | Procesoptimalisatie', type: 'Search', kosten: 5180, klikken: 1084, vertoningen: 38200, ctr: 2.84, cpc: 4.78, leads: 24, cpa: 215.83, conversieratio: 2.21, gekwalificeerdeLeads: 17, cpql: 304.71 },
      { naam: 'Demand Gen | NL | Whitepaper', type: 'Demand Gen', kosten: 3120, klikken: 742, vertoningen: 32400, ctr: 2.29, cpc: 4.2, leads: 12, cpa: 260.0, conversieratio: 1.62, gekwalificeerdeLeads: 6, cpql: 520.0 },
      { naam: 'Search | NL | Merk', type: 'Search', kosten: 2080, klikken: 352, vertoningen: 13600, ctr: 2.59, cpc: 5.91, leads: 7, cpa: 297.14, conversieratio: 1.99, gekwalificeerdeLeads: 3, cpql: 693.33 },
    ],
    advertentiegroepen: [
      { groep: 'Bedrijfsadvies | MKB', campagne: 'Search | NL | Bedrijfsadvies', kosten: 4820, klikken: 942, leads: 23, cpa: 209.57, gekwalificeerdeLeads: 17 },
      { groep: 'Bedrijfsadvies | Corporate', campagne: 'Search | NL | Bedrijfsadvies', kosten: 3600, klikken: 700, leads: 15, cpa: 240.0, gekwalificeerdeLeads: 9 },
      { groep: 'Procesoptimalisatie | Lean', campagne: 'Search | NL | Procesoptimalisatie', kosten: 3180, klikken: 662, leads: 15, cpa: 212.0, gekwalificeerdeLeads: 11 },
      { groep: 'Procesoptimalisatie | Digitaal', campagne: 'Search | NL | Procesoptimalisatie', kosten: 2000, klikken: 422, leads: 9, cpa: 222.22, gekwalificeerdeLeads: 6 },
    ],
    zoekwoorden: [
      { zoekwoord: 'bedrijfsadvies mkb', matchtype: 'Phrase', vertoningen: 24800, klikken: 684, ctr: 2.76, cpc: 4.86, kosten: 3324, leads: 18, cpa: 184.67, gekwalificeerdeLeads: 14, cpql: 237.43 },
      { zoekwoord: 'procesoptimalisatie adviesbureau', matchtype: 'Exact', vertoningen: 12400, klikken: 486, ctr: 3.92, cpc: 4.62, kosten: 2245, leads: 14, cpa: 160.36, gekwalificeerdeLeads: 11, cpql: 204.09 },
      { zoekwoord: 'organisatieadvies bureau', matchtype: 'Phrase', vertoningen: 18600, klikken: 542, ctr: 2.91, cpc: 5.12, kosten: 2775, leads: 12, cpa: 231.25, gekwalificeerdeLeads: 8, cpql: 346.88 },
      { zoekwoord: 'lean consultant', matchtype: 'Exact', vertoningen: 9800, klikken: 384, ctr: 3.92, cpc: 4.94, kosten: 1897, leads: 9, cpa: 210.78, gekwalificeerdeLeads: 6, cpql: 316.17 },
      { zoekwoord: 'adviesbureau', matchtype: 'Breed', vertoningen: 42600, klikken: 812, ctr: 1.91, cpc: 6.24, kosten: 5067, leads: 8, cpa: 633.38, gekwalificeerdeLeads: 2, cpql: 2533.5 },
    ],
  },

  googleBusinessProfile: {
    koppelingBeschikbaar: false,
    profielinteracties: 186,
    telefoongesprekken: 34,
    routeaanvragen: 8,
    websiteklikken: 144,
    vorigePeriode: { profielinteracties: 164, telefoongesprekken: 29, routeaanvragen: 11, websiteklikken: 124 },
  },

  doelen: [
    { kpi: 'leads', periode: 'maand', target: 75, actueel: 81, vorigePeriode: 67, eigenaar: 'Eva Krol' },
    { kpi: 'gekwalificeerdeLeads', periode: 'maand', target: 48, actueel: 52, vorigePeriode: 41, eigenaar: 'Eva Krol' },
    { kpi: 'afspraken', periode: 'maand', target: 34, actueel: 38, vorigePeriode: 31, eigenaar: 'Eva Krol' },
    { kpi: 'offertes', periode: 'maand', target: 34, actueel: 38, vorigePeriode: 31, eigenaar: 'Eva Krol' },
    { kpi: 'klanten', periode: 'maand', target: 10, actueel: 11, vorigePeriode: 8, eigenaar: 'Eva Krol' },
    { kpi: 'cpl', periode: 'maand', target: 250, actueel: 232.1, vorigePeriode: 258.21, eigenaar: 'Sam Bakker' },
    { kpi: 'cpql', periode: 'maand', target: 400, actueel: 361.54, vorigePeriode: 421.95, eigenaar: 'Sam Bakker' },
    { kpi: 'websitegebruikers', periode: 'maand', target: 6500, actueel: 6842, vorigePeriode: 6210, eigenaar: 'Sam Bakker' },
    { kpi: 'telefoongesprekken', periode: 'maand', target: 30, actueel: 34, vorigePeriode: 29, eigenaar: 'Eva Krol' },
    { kpi: 'emailacties', periode: 'maand', target: 60, actueel: 68, vorigePeriode: 61, eigenaar: 'Eva Krol' },
  ],

  doelHistorie: [
    { maand: '2026-02', target: 75, werkelijk: 54 },
    { maand: '2026-03', target: 75, werkelijk: 58 },
    { maand: '2026-04', target: 75, werkelijk: 62 },
    { maand: '2026-05', target: 75, werkelijk: 66 },
    { maand: '2026-06', target: 75, werkelijk: 67 },
    { maand: '2026-07', target: 75, werkelijk: 81 },
  ],

  klantverhaal: {
    goed: [
      'Het aantal leads steeg naar 81 tegenover een doel van 75',
      'De kosten per gekwalificeerde lead daalden van 421,95 naar 361,54 euro',
      'De pipelinewaarde groeide met 22 procent naar 418.000 euro',
    ],
    aandacht: [
      'Het brede zoekwoord adviesbureau kostte 5.067 euro voor 2 gekwalificeerde leads',
      'De campagne op de whitepaper levert veel downloads maar weinig gekwalificeerde leads',
      'Van de leads via mobiel wordt slechts een klein deel gekwalificeerd',
    ],
    gedaan: [
      'Doelgroepen in LinkedIn Ads aangescherpt op functietitel en bedrijfsgrootte',
      'Aparte landingspagina gebouwd voor demoaanvragen',
      'Kwalificatievragen toegevoegd aan het offerteformulier',
    ],
    volgende: [
      'Het brede zoekwoord adviesbureau pauzeren en het budget verplaatsen naar exact',
      'De whitepaper achter een uitgebreider formulier plaatsen',
      'Een mobiele variant van het offerteformulier testen',
    ],
    vanKlant: [
      'Terugkoppeling welke 11 leads klant zijn geworden en waarom',
      'Actuele gemiddelde opdrachtwaarde voor de pipelineberekening',
      'Akkoord op een budgetverhoging van 2.000 euro voor augustus',
    ],
  },
};

/* ---------------------------------------------------------------
   Klant 3: Havenkwartier Makelaars
   Scenario: sterke lokale zichtbaarheid, onvoldoende CRM-data
   --------------------------------------------------------------- */

const havenkwartier = {
  clientId: 'havenkwartier',
  laatsteSync: '2026-07-21T05:55:00Z',
  trackingStatus: 'probleem',
  dataHealth: 58,

  conversieConfig: {
    primair: ['waardebepaling', 'bezichtiging', 'contactformulier', 'afspraakGepland'],
    secundair: ['telefoonklik', 'whatsappKlik', 'routeaanvraag', 'emailklik', 'formulierGestart'],
  },

  ga4: {
    gebruikers: 9420,
    nieuweGebruikers: 7284,
    sessies: 13840,
    engagedSessions: 8442,
    engagementRate: 61.0,
    gemSessieduur: 196,
    vorigePeriode: { gebruikers: 8640, nieuweGebruikers: 6712, sessies: 12480, engagementRate: 59.4 },
  },

  conversies: [
    { type: 'waardebepaling', aantal: 64, vorigePeriode: 52 },
    { type: 'bezichtiging', aantal: 148, vorigePeriode: 132 },
    { type: 'contactformulier', aantal: 38, vorigePeriode: 41 },
    { type: 'afspraakGepland', aantal: 42, vorigePeriode: 36 },
    { type: 'telefoonklik', aantal: 284, vorigePeriode: 246 },
    { type: 'whatsappKlik', aantal: 118, vorigePeriode: 94 },
    { type: 'routeaanvraag', aantal: 86, vorigePeriode: 78 },
    { type: 'emailklik', aantal: 52, vorigePeriode: 48 },
    { type: 'formulierGestart', aantal: 412, vorigePeriode: 368 },
  ],

  funnelStappen: {
    impressies: 218400,
    klikken: 5240,
    landingspaginaWeergaven: 4816,
    engagement: 2938,
    formulierGestart: 412,
    leads: 292,
    // De CRM-koppeling ontbreekt, dus vanaf hier is er geen betrouwbare data.
    gekwalificeerdeLeads: null,
    afsprakenOfOffertes: 42,
    klanten: null,
  },
  funnelVorigePeriode: {
    impressies: 196800,
    klikken: 4820,
    landingspaginaWeergaven: 4412,
    engagement: 2618,
    formulierGestart: 368,
    leads: 261,
    gekwalificeerdeLeads: null,
    afsprakenOfOffertes: 36,
    klanten: null,
  },

  kerncijfers: {
    leads: 292,
    gekwalificeerdeLeads: null,
    cpl: 32.19,
    cpql: null,
    afspraken: 42,
    offertes: null,
    klanten: null,
    pipelinewaarde: null,
    vorigePeriode: { leads: 261, gekwalificeerdeLeads: null, cpl: 34.82, cpql: null, afspraken: 36, offertes: null, klanten: null, pipelinewaarde: null },
  },

  acquisitie: [
    { kanaal: 'Organic Search', gebruikers: 3842, sessies: 5218, leads: 108, gekwalificeerd: null, cpl: null, engagementRate: 64.2 },
    { kanaal: 'Paid Search', gebruikers: 2846, sessies: 4102, leads: 96, gekwalificeerd: null, cpl: 32.19, engagementRate: 62.8 },
    { kanaal: 'Direct', gebruikers: 1642, sessies: 2384, leads: 48, gekwalificeerd: null, cpl: null, engagementRate: 58.4 },
    { kanaal: 'Organic Social', gebruikers: 742, sessies: 1284, leads: 26, gekwalificeerd: null, cpl: null, engagementRate: 54.1 },
    { kanaal: 'Referral', gebruikers: 348, sessies: 852, leads: 14, gekwalificeerd: null, cpl: null, engagementRate: 51.2 },
  ],

  sourceMedium: [
    { bron: 'google / organic', gebruikers: 3842, leads: 108 },
    { bron: 'google / cpc', gebruikers: 2846, leads: 96 },
    { bron: '(direct) / (none)', gebruikers: 1642, leads: 48 },
    { bron: 'instagram / organic', gebruikers: 742, leads: 26 },
    { bron: 'woningsite.example / referral', gebruikers: 348, leads: 14 },
  ],

  landingspaginas: [
    { pagina: '/woningaanbod', gebruikers: 3418, leads: 118, conversieratio: 3.45 },
    { pagina: '/gratis-waardebepaling', gebruikers: 1284, leads: 64, conversieratio: 4.98 },
    { pagina: '/verkopen', gebruikers: 1642, leads: 52, conversieratio: 3.17 },
    { pagina: '/', gebruikers: 2418, leads: 38, conversieratio: 1.57 },
    { pagina: '/contact', gebruikers: 658, leads: 20, conversieratio: 3.04 },
  ],

  apparaten: [
    { apparaat: 'Mobiel', gebruikers: 6428, leads: 204, conversieratio: 3.17 },
    { apparaat: 'Computer', gebruikers: 2418, leads: 74, conversieratio: 3.06 },
    { apparaat: 'Tablet', gebruikers: 574, leads: 14, conversieratio: 2.44 },
  ],

  landen: [{ land: 'Nederland', gebruikers: 9284, leads: 289 }, { land: 'België', gebruikers: 136, leads: 3 }],

  regios: [
    { regio: 'Zuid-Holland', gebruikers: 5842, leads: 194 },
    { regio: 'Noord-Holland', gebruikers: 1642, leads: 48 },
    { regio: 'Utrecht', gebruikers: 942, leads: 26 },
    { regio: 'Noord-Brabant', gebruikers: 642, leads: 16 },
    { regio: 'Zeeland', gebruikers: 352, leads: 8 },
  ],

  googleAds: {
    totalen: { kosten: 9400, klikken: 5240, vertoningen: 218400, ctr: 2.4, cpc: 1.79, leads: 292, cpa: 32.19, conversieratio: 5.57, gekwalificeerdeLeads: null, cpql: null },
    maanden: [
      { maand: '2026-02', vertoningen: 168400, klikken: 4210, ctr: 2.5, cpc: 1.92, kosten: 8083, leads: 218, cpa: 37.08, gekwalificeerdeLeads: null, cpql: null },
      { maand: '2026-03', vertoningen: 178200, klikken: 4420, ctr: 2.48, cpc: 1.88, kosten: 8310, leads: 232, cpa: 35.82, gekwalificeerdeLeads: null, cpql: null },
      { maand: '2026-04', vertoningen: 186400, klikken: 4610, ctr: 2.47, cpc: 1.85, kosten: 8529, leads: 241, cpa: 35.39, gekwalificeerdeLeads: null, cpql: null },
      { maand: '2026-05', vertoningen: 192800, klikken: 4740, ctr: 2.46, cpc: 1.83, kosten: 8674, leads: 252, cpa: 34.42, gekwalificeerdeLeads: null, cpql: null },
      { maand: '2026-06', vertoningen: 196800, klikken: 4820, ctr: 2.45, cpc: 1.89, kosten: 9090, leads: 261, cpa: 34.82, gekwalificeerdeLeads: null, cpql: null },
      { maand: '2026-07', vertoningen: 218400, klikken: 5240, ctr: 2.4, cpc: 1.79, kosten: 9400, leads: 292, cpa: 32.19, gekwalificeerdeLeads: null, cpql: null },
    ],
    campagnes: [
      { naam: 'Search | Regio | Woning verkopen', type: 'Search', kosten: 4200, klikken: 2140, vertoningen: 84200, ctr: 2.54, cpc: 1.96, leads: 128, cpa: 32.81, conversieratio: 5.98, gekwalificeerdeLeads: null, cpql: null },
      { naam: 'Search | Regio | Makelaar', type: 'Search', kosten: 2840, klikken: 1642, vertoningen: 68400, ctr: 2.4, cpc: 1.73, leads: 92, cpa: 30.87, conversieratio: 5.6, gekwalificeerdeLeads: null, cpql: null },
      { naam: 'Performance Max | Regio | Aanbod', type: 'Performance Max', kosten: 2360, klikken: 1458, vertoningen: 65800, ctr: 2.22, cpc: 1.62, leads: 72, cpa: 32.78, conversieratio: 4.94, gekwalificeerdeLeads: null, cpql: null },
    ],
    advertentiegroepen: [
      { groep: 'Woning verkopen | Waardebepaling', campagne: 'Search | Regio | Woning verkopen', kosten: 2480, klikken: 1284, leads: 78, cpa: 31.79, gekwalificeerdeLeads: null },
      { groep: 'Woning verkopen | Algemeen', campagne: 'Search | Regio | Woning verkopen', kosten: 1720, klikken: 856, leads: 50, cpa: 34.4, gekwalificeerdeLeads: null },
      { groep: 'Makelaar | Lokaal', campagne: 'Search | Regio | Makelaar', kosten: 1840, klikken: 1064, leads: 62, cpa: 29.68, gekwalificeerdeLeads: null },
      { groep: 'Makelaar | Kosten', campagne: 'Search | Regio | Makelaar', kosten: 1000, klikken: 578, leads: 30, cpa: 33.33, gekwalificeerdeLeads: null },
    ],
    zoekwoorden: [
      { zoekwoord: 'gratis waardebepaling woning', matchtype: 'Exact', vertoningen: 28400, klikken: 1284, ctr: 4.52, cpc: 1.72, kosten: 2208, leads: 78, cpa: 28.31, gekwalificeerdeLeads: null, cpql: null },
      { zoekwoord: 'makelaar in de buurt', matchtype: 'Phrase', vertoningen: 42600, klikken: 1064, ctr: 2.5, cpc: 1.73, kosten: 1841, leads: 62, cpa: 29.69, gekwalificeerdeLeads: null, cpql: null },
      { zoekwoord: 'huis verkopen makelaar', matchtype: 'Phrase', vertoningen: 34800, klikken: 856, ctr: 2.46, cpc: 2.01, kosten: 1721, leads: 50, cpa: 34.42, gekwalificeerdeLeads: null, cpql: null },
      { zoekwoord: 'makelaar kosten', matchtype: 'Phrase', vertoningen: 24200, klikken: 578, ctr: 2.39, cpc: 1.73, kosten: 1000, leads: 30, cpa: 33.33, gekwalificeerdeLeads: null, cpql: null },
      { zoekwoord: 'woningaanbod', matchtype: 'Breed', vertoningen: 68400, klikken: 1458, ctr: 2.13, cpc: 1.62, kosten: 2362, leads: 72, cpa: 32.81, gekwalificeerdeLeads: null, cpql: null },
    ],
  },

  googleBusinessProfile: {
    koppelingBeschikbaar: false,
    profielinteracties: 1842,
    telefoongesprekken: 284,
    routeaanvragen: 86,
    websiteklikken: 642,
    vorigePeriode: { profielinteracties: 1618, telefoongesprekken: 246, routeaanvragen: 78, websiteklikken: 578 },
  },

  doelen: [
    { kpi: 'leads', periode: 'maand', target: 260, actueel: 292, vorigePeriode: 261, eigenaar: 'Lotte de Vries' },
    { kpi: 'gekwalificeerdeLeads', periode: 'maand', target: 150, actueel: null, vorigePeriode: null, eigenaar: 'Lotte de Vries' },
    { kpi: 'afspraken', periode: 'maand', target: 40, actueel: 42, vorigePeriode: 36, eigenaar: 'Lotte de Vries' },
    { kpi: 'offertes', periode: 'maand', target: 30, actueel: null, vorigePeriode: null, eigenaar: 'Lotte de Vries' },
    { kpi: 'klanten', periode: 'maand', target: 18, actueel: null, vorigePeriode: null, eigenaar: 'Lotte de Vries' },
    { kpi: 'cpl', periode: 'maand', target: 38, actueel: 32.19, vorigePeriode: 34.82, eigenaar: 'Noor El Amrani' },
    { kpi: 'cpql', periode: 'maand', target: 70, actueel: null, vorigePeriode: null, eigenaar: 'Noor El Amrani' },
    { kpi: 'websitegebruikers', periode: 'maand', target: 8500, actueel: 9420, vorigePeriode: 8640, eigenaar: 'Noor El Amrani' },
    { kpi: 'telefoongesprekken', periode: 'maand', target: 250, actueel: 284, vorigePeriode: 246, eigenaar: 'Lotte de Vries' },
    { kpi: 'emailacties', periode: 'maand', target: 50, actueel: 52, vorigePeriode: 48, eigenaar: 'Lotte de Vries' },
  ],

  doelHistorie: [
    { maand: '2026-02', target: 260, werkelijk: 218 },
    { maand: '2026-03', target: 260, werkelijk: 232 },
    { maand: '2026-04', target: 260, werkelijk: 241 },
    { maand: '2026-05', target: 260, werkelijk: 252 },
    { maand: '2026-06', target: 260, werkelijk: 261 },
    { maand: '2026-07', target: 260, werkelijk: 292 },
  ],

  klantverhaal: {
    goed: [
      'Het aantal leads steeg naar 292 tegenover een doel van 260',
      'De kosten per lead daalden van 34,82 naar 32,19 euro',
      'De aanvragen voor een waardebepaling namen toe met 23 procent',
    ],
    aandacht: [
      'De CRM-koppeling ontbreekt, waardoor gekwalificeerde leads en klanten niet meetbaar zijn',
      'Zonder die data is niet vast te stellen welke campagnes daadwerkelijk opdrachten opleveren',
      'Het formulier wordt 412 keer gestart maar 292 keer afgerond',
    ],
    gedaan: [
      'Aparte landingspagina gebouwd voor de gratis waardebepaling',
      'WhatsApp-knop toegevoegd, goed voor 118 klikken',
      'Advertentieteksten aangescherpt op de lokale regio',
    ],
    volgende: [
      'De CRM-koppeling inrichten zodat leadkwaliteit meetbaar wordt',
      'Onderzoeken waarom 120 gestarte formulieren niet worden afgerond',
      'Belregistratie koppelen aan de campagnes',
    ],
    vanKlant: [
      'Toegang tot het CRM of een maandelijkse export van opdrachten',
      'Terugkoppeling welke aanvragen tot een opdracht hebben geleid',
      'Akkoord op het plaatsen van een meetscript op de bedanktpagina',
    ],
  },
};

/* ---------------------------------------------------------------
   Export
   --------------------------------------------------------------- */

export const LEADS_DATA = { vitaalpunt, meridiaan, havenkwartier };

export function getLeadsData(clientId) {
  return LEADS_DATA[clientId] ?? null;
}

/** Splitst de conversies van een klant in primair en secundair. */
export function splitsConversies(data) {
  const config = data?.conversieConfig ?? { primair: [], secundair: [] };
  const lijst = data?.conversies ?? [];
  return {
    primair: lijst.filter((c) => config.primair.includes(c.type)),
    secundair: lijst.filter((c) => config.secundair.includes(c.type)),
  };
}
