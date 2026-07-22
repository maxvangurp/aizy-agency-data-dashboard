/**
 * Demodataset.
 *
 * Fase 1 legt het datacontract vast met drie klanten, een per bedrijfsmodel.
 * Fase 3 breidt dit uit naar zeven klanten met volledige historische reeksen.
 *
 * Alle waarden zijn deterministisch. Cijfers veranderen niet bij een refresh.
 * Namen zijn fictief en bevatten geen bestaande klantgegevens.
 */

export const BusinessModel = {
  ECOMMERCE: 'ecommerce',
  LEADGEN: 'leadgen',
  AWARENESS: 'awareness',
  HYBRID: 'hybrid',
  CUSTOM: 'custom',
};

export const BUSINESS_MODEL_LABELS = {
  [BusinessModel.ECOMMERCE]: 'E-commerce',
  [BusinessModel.LEADGEN]: 'Leadgeneratie',
  [BusinessModel.AWARENESS]: 'Awareness',
  [BusinessModel.HYBRID]: 'Hybride',
  [BusinessModel.CUSTOM]: 'Custom',
};

/**
 * Bepaalt welke KPI's primair zijn per bedrijfsmodel.
 * Schermen lezen dit uit in plaats van ROAS hard te coderen.
 */
export const PRIMARY_KPIS = {
  [BusinessModel.ECOMMERCE]: ['omzet', 'aankopen', 'roas', 'cpa', 'aov', 'conversieratio'],
  [BusinessModel.LEADGEN]: ['leads', 'gekwalificeerdeLeads', 'cpl', 'cpql', 'afspraken', 'pipelinewaarde'],
  [BusinessModel.AWARENESS]: ['bereik', 'impressies', 'frequentie', 'cpm', 'videoWeergaven', 'engagement'],
};

export const SAMPLE_CLIENTS = [
  {
    id: 'tafelwerk',
    name: 'Tafelwerk Studio',
    businessModel: BusinessModel.ECOMMERCE,
    website: 'https://tafelwerk-studio.example',
    land: 'Nederland',
    valuta: 'EUR',
    tijdzone: 'Europe/Amsterdam',
    accountmanager: 'Lotte de Vries',
    marketeer: 'Sam Bakker',
    maandbudget: 22000,
    spend: 18450,
    kanalen: ['Google Ads', 'Meta Ads', 'Microsoft Ads'],
    trackingStatus: 'gezond',
    dataHealth: 92,
    scenario: 'boven-doelstelling',
    kpis: {
      omzet: 147600,
      aankopen: 412,
      roas: 8.0,
      cpa: 44.78,
      aov: 358.25,
      conversieratio: 2.9,
    },
    vorigePeriode: { omzet: 125100, aankopen: 349, roas: 7.2, cpa: 48.15 },
    doelen: [
      { kpi: 'omzet', periode: 'maand', target: 140000, actueel: 147600 },
      { kpi: 'roas', periode: 'maand', target: 7.5, actueel: 8.0 },
      { kpi: 'aankopen', periode: 'maand', target: 400, actueel: 412 },
    ],
  },
  {
    id: 'draadloos',
    name: 'Draadloos Mode',
    businessModel: BusinessModel.ECOMMERCE,
    website: 'https://draadloos-mode.example',
    land: 'Nederland',
    valuta: 'EUR',
    tijdzone: 'Europe/Amsterdam',
    accountmanager: 'Eva Krol',
    marketeer: 'Noor El Amrani',
    maandbudget: 12000,
    spend: 9840,
    kanalen: ['Google Ads', 'Meta Ads'],
    trackingStatus: 'controle-aanbevolen',
    dataHealth: 68,
    scenario: 'dalende-roas',
    kpis: {
      omzet: 51340,
      aankopen: 604,
      roas: 1.2,
      cpa: 70.79,
      aov: 85.0,
      conversieratio: 1.58,
    },
    vorigePeriode: { omzet: 58480, aankopen: 688, roas: 1.33, cpa: 63.83 },
    doelen: [
      { kpi: 'omzet', periode: 'maand', target: 68000, actueel: 51340 },
      { kpi: 'roas', periode: 'maand', target: 2.5, actueel: 1.2 },
      { kpi: 'aankopen', periode: 'maand', target: 750, actueel: 604 },
    ],
  },
  {
    id: 'kaapnoord',
    name: 'Kaap Noord Outdoor',
    businessModel: BusinessModel.ECOMMERCE,
    website: 'https://kaapnoord.example',
    land: 'Nederland, België, Duitsland',
    valuta: 'EUR',
    tijdzone: 'Europe/Amsterdam',
    accountmanager: 'Eva Krol',
    marketeer: 'Sam Bakker',
    maandbudget: 28000,
    spend: 24180,
    kanalen: ['Google Ads', 'Microsoft Ads', 'Meta Ads'],
    trackingStatus: 'gezond',
    dataHealth: 88,
    scenario: 'schaalruimte',
    kpis: {
      omzet: 218280,
      aankopen: 1284,
      roas: 3.28,
      cpa: 51.89,
      aov: 170.0,
      conversieratio: 2.0,
    },
    vorigePeriode: { omzet: 196400, aankopen: 1082, roas: 3.38, cpa: 50.34 },
    doelen: [
      { kpi: 'omzet', periode: 'maand', target: 200000, actueel: 218280 },
      { kpi: 'roas', periode: 'maand', target: 3.0, actueel: 3.28 },
      { kpi: 'aankopen', periode: 'maand', target: 1200, actueel: 1284 },
    ],
  },
  {
    id: 'vitaalpunt',
    name: 'Vitaalpunt Fysiotherapie',
    businessModel: BusinessModel.LEADGEN,
    website: 'https://vitaalpunt.example',
    land: 'Nederland',
    valuta: 'EUR',
    tijdzone: 'Europe/Amsterdam',
    accountmanager: 'Daan Verhoeven',
    marketeer: 'Noor El Amrani',
    maandbudget: 14000,
    spend: 11820,
    kanalen: ['Google Ads', 'Meta Ads', 'Microsoft Ads'],
    trackingStatus: 'controle-aanbevolen',
    dataHealth: 74,
    scenario: 'stijgende-cpa',
    kpis: {
      leads: 118,
      gekwalificeerdeLeads: 71,
      cpl: 100.17,
      cpql: 166.48,
      afspraken: 34,
      pipelinewaarde: 61200,
    },
    vorigePeriode: { leads: 131, gekwalificeerdeLeads: 84, cpl: 84.2 },
    doelen: [
      { kpi: 'leads', periode: 'maand', target: 130, actueel: 118 },
      { kpi: 'cpl', periode: 'maand', target: 90, actueel: 100.17 },
      { kpi: 'afspraken', periode: 'maand', target: 40, actueel: 34 },
    ],
  },
  {
    id: 'noordlicht',
    name: 'Noordlicht Software',
    businessModel: BusinessModel.AWARENESS,
    website: 'https://noordlicht-software.example',
    land: 'Nederland',
    valuta: 'EUR',
    tijdzone: 'Europe/Amsterdam',
    accountmanager: 'Eva Krol',
    marketeer: 'Sam Bakker',
    maandbudget: 18000,
    spend: 22140,
    kanalen: ['LinkedIn Ads', 'Meta Ads', 'Google Ads'],
    trackingStatus: 'probleem',
    dataHealth: 61,
    scenario: 'over-budget',
    kpis: {
      bereik: 486300,
      impressies: 1284700,
      frequentie: 2.64,
      cpm: 17.23,
      videoWeergaven: 92400,
      engagement: 3.1,
    },
    vorigePeriode: { bereik: 512800, impressies: 1180200, cpm: 15.02 },
    doelen: [
      { kpi: 'bereik', periode: 'maand', target: 500000, actueel: 486300 },
      { kpi: 'cpm', periode: 'maand', target: 16, actueel: 17.23 },
    ],
  },
];

export const SAMPLE_ALERTS = [
  {
    id: 'alert-1',
    ernst: 'hoog',
    klantId: 'noordlicht',
    kanaal: 'LinkedIn Ads',
    probleem: 'Het account staat 23 procent boven het maandbudget',
    oorzaak: 'Het dagbudget is op 8 juli verhoogd zonder einddatum',
    aanbeveling: 'Verlaag het dagbudget naar 580 euro of stel een einddatum in',
    startdatum: '2026-07-08',
  },
  {
    id: 'alert-2',
    ernst: 'hoog',
    klantId: 'vitaalpunt',
    kanaal: 'Meta Ads',
    probleem: 'De kosten per lead stegen met 19 procent',
    oorzaak: 'De frequentie liep op naar 4,2 binnen de retargetingdoelgroep',
    aanbeveling: 'Vernieuw de advertentiesets en verbreed de doelgroep',
    startdatum: '2026-07-11',
  },
  {
    id: 'alert-4',
    ernst: 'hoog',
    klantId: 'draadloos',
    kanaal: 'Google Merchant Center',
    probleem: '273 producten zijn afgekeurd',
    oorzaak: 'De prijs in de feed wijkt af van de prijs op de landingspagina',
    aanbeveling: 'Synchroniseer de feedprijzen en dien de producten opnieuw in',
    startdatum: '2026-07-14',
  },
  {
    id: 'alert-5',
    ernst: 'hoog',
    klantId: 'draadloos',
    kanaal: 'Google Ads',
    probleem: 'De ROAS daalde van 2,63 naar 1,20 in zes maanden',
    oorzaak: 'Brede zoekwoorden nemen 46 procent van het budget en leveren 0,49 ROAS',
    aanbeveling: 'Pauzeer de brede zoekwoorden en verplaats het budget naar exact',
    startdatum: '2026-07-02',
  },
  {
    id: 'alert-6',
    ernst: 'middel',
    klantId: 'kaapnoord',
    kanaal: 'Google Ads',
    probleem: 'Het account presteert boven doelstelling met budgetruimte',
    oorzaak: 'De ROAS blijft 3,28 bij een doel van 3,0 en het budget is voor 86 procent benut',
    aanbeveling: 'Verhoog het budget van de campagne Performance Max EU met 15 procent',
    startdatum: '2026-07-16',
  },
  {
    id: 'alert-3',
    ernst: 'middel',
    klantId: 'noordlicht',
    kanaal: 'Google Analytics 4',
    probleem: 'GA4 ontvangt sinds 19 juli geen conversies',
    oorzaak: 'De gebeurtenis contact_verzonden ontbreekt na een websitewijziging',
    aanbeveling: 'Controleer de tagconfiguratie in Google Tag Manager',
    startdatum: '2026-07-19',
  },
];

export const SAMPLE_OVERVIEW = {
  totaleSpend: SAMPLE_CLIENTS.reduce((sum, c) => sum + c.spend, 0),
  totaalBudget: SAMPLE_CLIENTS.reduce((sum, c) => sum + c.maandbudget, 0),
  klanten: SAMPLE_CLIENTS.length,
  openSignalen: SAMPLE_ALERTS.length,
  trackingProblemen: SAMPLE_CLIENTS.filter((c) => c.trackingStatus === 'probleem').length,
};

export function getClient(id) {
  return SAMPLE_CLIENTS.find((c) => c.id === id) ?? null;
}
