/**
 * Klantregister.
 *
 * Dit bestand beschrijft wie de klanten zijn: hun profiel, hun budget, welke
 * bronnen er gekoppeld zijn en welke doelen er gelden. Het bevat geen
 * resultaten meer.
 *
 * Dat is de belangrijkste wijziging van deze fase. Zolang de kerncijfers hier
 * als vaste getallen stonden, kon geen enkel filter ze beïnvloeden. Alle
 * resultaten komen nu uit js/sample-data/timeseries.js en worden per
 * geselecteerde periode en kanaalselectie berekend. Wat hier staat, is wat niet
 * van de periode afhangt.
 *
 * Doelen staan er als target zonder werkelijke waarde. De werkelijke waarde
 * hoort bij een periode en wordt dus berekend, niet ingetypt.
 *
 * Alle namen, domeinen en cijfers zijn fictief.
 */

import { KanaalStatus } from '../filters/channels.js';

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
 * Welke KPI's primair zijn per bedrijfsmodel.
 * Schermen lezen dit uit in plaats van ROAS hard te coderen.
 */
export const PRIMARY_KPIS = {
  [BusinessModel.ECOMMERCE]: ['revenue', 'purchases', 'roas', 'cpa', 'aov', 'conversieratio'],
  [BusinessModel.LEADGEN]: ['leads', 'qualifiedLeads', 'cpl', 'cpql', 'appointments', 'pipelineValue'],
  [BusinessModel.AWARENESS]: ['impressions', 'clicks', 'cpm', 'ctr'],
};

/** De metriek waaraan het primaire resultaat van een klant wordt afgelezen. */
export const PRIMAIRE_METRIEK = {
  [BusinessModel.ECOMMERCE]: 'revenue',
  [BusinessModel.LEADGEN]: 'leads',
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
    trackingStatus: 'gezond',
    dataHealth: 92,
    scenario: 'boven-doelstelling',
    bronnen: {
      ga4: KanaalStatus.GEKOPPELD,
      crm: KanaalStatus.NIET_GEKOPPELD,
      google_business_profile: KanaalStatus.TOEKOMSTIG,
    },
    doelen: [
      { kpi: 'omzet', periode: 'maand', target: 140000, eigenaar: 'Lotte de Vries' },
      { kpi: 'roas', periode: 'maand', target: 7.5, eigenaar: 'Sam Bakker' },
      { kpi: 'aankopen', periode: 'maand', target: 400, eigenaar: 'Sam Bakker' },
      { kpi: 'maandbudget', periode: 'maand', target: 22000, eigenaar: 'Lotte de Vries' },
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
    trackingStatus: 'controle-aanbevolen',
    dataHealth: 68,
    scenario: 'dalende-roas',
    bronnen: {
      ga4: KanaalStatus.GEKOPPELD,
      crm: KanaalStatus.NIET_GEKOPPELD,
      google_business_profile: KanaalStatus.TOEKOMSTIG,
    },
    doelen: [
      { kpi: 'omzet', periode: 'maand', target: 68000, eigenaar: 'Noor El Amrani' },
      { kpi: 'roas', periode: 'maand', target: 6.5, eigenaar: 'Noor El Amrani' },
      { kpi: 'aankopen', periode: 'maand', target: 750, eigenaar: 'Noor El Amrani' },
      { kpi: 'maandbudget', periode: 'maand', target: 12000, eigenaar: 'Eva Krol' },
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
    trackingStatus: 'gezond',
    dataHealth: 88,
    scenario: 'schaalruimte',
    bronnen: {
      ga4: KanaalStatus.GEKOPPELD,
      crm: KanaalStatus.NIET_GEKOPPELD,
      google_business_profile: KanaalStatus.TOEKOMSTIG,
    },
    doelen: [
      { kpi: 'omzet', periode: 'maand', target: 200000, eigenaar: 'Eva Krol' },
      { kpi: 'roas', periode: 'maand', target: 8.5, eigenaar: 'Sam Bakker' },
      { kpi: 'aankopen', periode: 'maand', target: 1200, eigenaar: 'Sam Bakker' },
      { kpi: 'maandbudget', periode: 'maand', target: 28000, eigenaar: 'Eva Krol' },
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
    trackingStatus: 'controle-aanbevolen',
    dataHealth: 74,
    scenario: 'stijgende-cpa',
    bronnen: {
      ga4: KanaalStatus.GEKOPPELD,
      crm: KanaalStatus.GEKOPPELD,
      google_business_profile: KanaalStatus.TOEKOMSTIG,
    },
    doelen: [
      { kpi: 'leads', periode: 'maand', target: 130, eigenaar: 'Daan Verhoeven' },
      { kpi: 'gekwalificeerdeLeads', periode: 'maand', target: 85, eigenaar: 'Daan Verhoeven' },
      { kpi: 'afspraken', periode: 'maand', target: 40, eigenaar: 'Daan Verhoeven' },
      { kpi: 'offertes', periode: 'maand', target: 35, eigenaar: 'Daan Verhoeven' },
      { kpi: 'klanten', periode: 'maand', target: 24, eigenaar: 'Daan Verhoeven' },
      { kpi: 'cpl', periode: 'maand', target: 90, eigenaar: 'Noor El Amrani' },
      { kpi: 'cpql', periode: 'maand', target: 140, eigenaar: 'Noor El Amrani' },
      { kpi: 'websitegebruikers', periode: 'maand', target: 3500, eigenaar: 'Noor El Amrani' },
      { kpi: 'telefoongesprekken', periode: 'maand', target: 90, eigenaar: 'Daan Verhoeven' },
      { kpi: 'emailacties', periode: 'maand', target: 45, eigenaar: 'Daan Verhoeven' },
    ],
  },
  {
    id: 'meridiaan',
    name: 'Meridiaan Bedrijfsadvies',
    businessModel: BusinessModel.LEADGEN,
    website: 'https://meridiaan-advies.example',
    land: 'Nederland',
    valuta: 'EUR',
    tijdzone: 'Europe/Amsterdam',
    accountmanager: 'Eva Krol',
    marketeer: 'Sam Bakker',
    maandbudget: 21000,
    trackingStatus: 'gezond',
    dataHealth: 91,
    scenario: 'boven-doelstelling',
    bronnen: {
      ga4: KanaalStatus.GEKOPPELD,
      crm: KanaalStatus.GEKOPPELD,
      google_business_profile: KanaalStatus.TOEKOMSTIG,
    },
    doelen: [
      { kpi: 'leads', periode: 'maand', target: 75, eigenaar: 'Eva Krol' },
      { kpi: 'gekwalificeerdeLeads', periode: 'maand', target: 48, eigenaar: 'Eva Krol' },
      { kpi: 'afspraken', periode: 'maand', target: 34, eigenaar: 'Eva Krol' },
      { kpi: 'offertes', periode: 'maand', target: 34, eigenaar: 'Eva Krol' },
      { kpi: 'klanten', periode: 'maand', target: 10, eigenaar: 'Eva Krol' },
      { kpi: 'cpl', periode: 'maand', target: 250, eigenaar: 'Sam Bakker' },
      { kpi: 'cpql', periode: 'maand', target: 400, eigenaar: 'Sam Bakker' },
      { kpi: 'websitegebruikers', periode: 'maand', target: 6500, eigenaar: 'Sam Bakker' },
      { kpi: 'telefoongesprekken', periode: 'maand', target: 30, eigenaar: 'Eva Krol' },
      { kpi: 'emailacties', periode: 'maand', target: 60, eigenaar: 'Eva Krol' },
    ],
  },
  {
    id: 'havenkwartier',
    name: 'Havenkwartier Makelaars',
    businessModel: BusinessModel.LEADGEN,
    website: 'https://havenkwartier-makelaars.example',
    land: 'Nederland',
    valuta: 'EUR',
    tijdzone: 'Europe/Amsterdam',
    accountmanager: 'Lotte de Vries',
    marketeer: 'Noor El Amrani',
    maandbudget: 11000,
    trackingStatus: 'probleem',
    dataHealth: 58,
    scenario: 'trackingprobleem',
    bronnen: {
      ga4: KanaalStatus.GEKOPPELD,
      // Zonder CRM-koppeling stopt de funnel bij de lead. Dat is geen nul,
      // dat is een ontbrekende meting.
      crm: KanaalStatus.NIET_GEKOPPELD,
      google_business_profile: KanaalStatus.TOEKOMSTIG,
    },
    doelen: [
      { kpi: 'leads', periode: 'maand', target: 260, eigenaar: 'Lotte de Vries' },
      { kpi: 'gekwalificeerdeLeads', periode: 'maand', target: 150, eigenaar: 'Lotte de Vries' },
      { kpi: 'afspraken', periode: 'maand', target: 40, eigenaar: 'Lotte de Vries' },
      { kpi: 'offertes', periode: 'maand', target: 30, eigenaar: 'Lotte de Vries' },
      { kpi: 'klanten', periode: 'maand', target: 18, eigenaar: 'Lotte de Vries' },
      { kpi: 'cpl', periode: 'maand', target: 38, eigenaar: 'Noor El Amrani' },
      { kpi: 'cpql', periode: 'maand', target: 70, eigenaar: 'Noor El Amrani' },
      { kpi: 'websitegebruikers', periode: 'maand', target: 8500, eigenaar: 'Noor El Amrani' },
      { kpi: 'telefoongesprekken', periode: 'maand', target: 250, eigenaar: 'Lotte de Vries' },
      { kpi: 'emailacties', periode: 'maand', target: 50, eigenaar: 'Lotte de Vries' },
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
    trackingStatus: 'probleem',
    dataHealth: 61,
    scenario: 'over-budget',
    bronnen: {
      ga4: KanaalStatus.ONVOLDOENDE_DATA,
      crm: KanaalStatus.NIET_GEKOPPELD,
      google_business_profile: KanaalStatus.TOEKOMSTIG,
    },
    doelen: [
      { kpi: 'maandbudget', periode: 'maand', target: 18000, eigenaar: 'Eva Krol' },
    ],
  },
];

/**
 * Welke doelen cumulatief zijn en dus met de periodelengte meeschalen.
 * Een verhouding als de CPL schaalt niet: die geldt per lead, niet per dag.
 */
export const CUMULATIEVE_DOELEN = new Set([
  'omzet', 'aankopen', 'maandbudget', 'leads', 'gekwalificeerdeLeads',
  'afspraken', 'offertes', 'klanten', 'websitegebruikers',
  'telefoongesprekken', 'emailacties', 'bereik', 'impressies',
]);

/** Vertaalt een doel-KPI naar de sleutel in de berekende totalen. */
export const DOEL_METRIEK = {
  omzet: 'revenue',
  roas: 'roas',
  aankopen: 'purchases',
  maandbudget: 'spend',
  leads: 'leads',
  gekwalificeerdeLeads: 'qualifiedLeads',
  afspraken: 'appointments',
  offertes: 'quotes',
  klanten: 'customers',
  cpl: 'cpl',
  cpql: 'cpql',
  websitegebruikers: 'users',
};

/** Doelen die uit een conversietype komen in plaats van uit een metriek. */
export const DOEL_CONVERSIETYPE = {
  telefoongesprekken: 'telefoonklik',
  emailacties: 'emailklik',
};

/**
 * Signalen over de accounts.
 *
 * Een signaal heeft een startdatum en een kanaal, zodat het meebeweegt met de
 * periode- en kanaalselectie. Een signaal uit mei hoort niet in een weergave
 * van de afgelopen zeven dagen.
 */
export const SAMPLE_ALERTS = [
  {
    id: 'alert-1',
    ernst: 'hoog',
    klantId: 'noordlicht',
    kanaal: 'linkedin_ads',
    probleem: 'Het account staat boven het maandbudget',
    oorzaak: 'Het dagbudget is op 8 juli verhoogd zonder einddatum',
    aanbeveling: 'Verlaag het dagbudget naar 580 euro of stel een einddatum in',
    startdatum: '2026-07-08',
  },
  {
    id: 'alert-2',
    ernst: 'hoog',
    klantId: 'vitaalpunt',
    kanaal: 'meta_ads',
    probleem: 'De kosten per lead stegen ten opzichte van de vorige periode',
    oorzaak: 'De frequentie liep op naar 4,2 binnen de retargetingdoelgroep',
    aanbeveling: 'Vernieuw de advertentiesets en verbreed de doelgroep',
    startdatum: '2026-07-11',
  },
  {
    id: 'alert-4',
    ernst: 'hoog',
    klantId: 'draadloos',
    kanaal: 'google_ads',
    probleem: '273 producten zijn afgekeurd in de productfeed',
    oorzaak: 'De prijs in de feed wijkt af van de prijs op de landingspagina',
    aanbeveling: 'Synchroniseer de feedprijzen en dien de producten opnieuw in',
    startdatum: '2026-07-14',
  },
  {
    id: 'alert-5',
    ernst: 'hoog',
    klantId: 'draadloos',
    kanaal: 'google_ads',
    probleem: 'De ROAS daalt al zes maanden op rij',
    oorzaak: 'Brede zoekwoorden nemen 46 procent van het budget en leveren weinig op',
    aanbeveling: 'Pauzeer de brede zoekwoorden en verplaats het budget naar exact',
    startdatum: '2026-07-02',
  },
  {
    id: 'alert-6',
    ernst: 'middel',
    klantId: 'kaapnoord',
    kanaal: 'google_ads',
    probleem: 'Het account presteert boven doelstelling met budgetruimte',
    oorzaak: 'De ROAS blijft boven het doel en het budget is niet volledig benut',
    aanbeveling: 'Verhoog het budget van de campagne Performance Max EU met 15 procent',
    startdatum: '2026-07-16',
  },
  {
    id: 'alert-7',
    ernst: 'hoog',
    klantId: 'havenkwartier',
    kanaal: 'crm',
    probleem: 'Gekwalificeerde leads en klanten zijn niet meetbaar',
    oorzaak: 'Er is geen CRM-koppeling, waardoor de funnel stopt bij de lead',
    aanbeveling: 'Richt de CRM-koppeling in of vraag een maandelijkse export van opdrachten',
    startdatum: '2026-06-01',
  },
  {
    id: 'alert-8',
    ernst: 'middel',
    klantId: 'meridiaan',
    kanaal: 'google_ads',
    probleem: 'Het brede zoekwoord adviesbureau levert nauwelijks gekwalificeerde leads',
    oorzaak: 'Brede matchtype trekt zoekopdrachten buiten de doelgroep aan',
    aanbeveling: 'Pauzeer het brede zoekwoord en verplaats het budget naar exacte varianten',
    startdatum: '2026-07-09',
  },
  {
    id: 'alert-3',
    ernst: 'middel',
    klantId: 'noordlicht',
    kanaal: 'ga4',
    probleem: 'GA4 ontvangt sinds 19 juli geen conversies',
    oorzaak: 'De gebeurtenis contact_verzonden ontbreekt na een websitewijziging',
    aanbeveling: 'Controleer de tagconfiguratie in Google Tag Manager',
    startdatum: '2026-07-19',
  },
];

export function getClient(id) {
  return SAMPLE_CLIENTS.find((c) => c.id === id) ?? null;
}
