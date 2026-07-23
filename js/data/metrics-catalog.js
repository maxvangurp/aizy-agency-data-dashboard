/**
 * Metriekcatalogus.
 *
 * De centrale plek waar staat wat een metriek is, hoe hij wordt berekend, hoe je
 * hem leest en waar je in kunt zoomen. Dit is een uitbreiding op js/data/metrics.js:
 * dat bestand bevat de metadata en de rekenregels, dit bestand voegt de didactiek
 * toe die de interface nodig heeft — formule, interpretatie, beperking, bron en
 * de beschikbare verdiepingen.
 *
 * WAAROM APART
 * De rekenlaag hoort niet te weten hoe een tooltip eruitziet, en een view hoort
 * niet zelf een formule op te schrijven. Deze catalogus zit ertussen: één bron
 * voor alle uitleg, zodat dezelfde metriek nergens twee definities krijgt.
 *
 * VORM
 *   metriekCatalogus(key) geeft altijd een volledig object terug, ook voor een
 *   onbekende sleutel, zodat een view nooit op een ontbrekend veld stuit.
 */

import { METRIEK_META, metriekMeta, Formaat } from './metrics.js';

/**
 * De didactische aanvulling per metriek.
 *
 *   formule         hoe de waarde tot stand komt, in gewone taal
 *   interpretatie   hoe je de uitkomst leest en wanneer die goed of slecht is
 *   beperking       wat de uitkomst niet zegt, of waar hij van afhangt
 *   bronnen         uit welke databron(nen) de metriek komt
 *   decimalen       aantal decimalen in de opmaak
 *   eenheid         de eenheid, voor toegankelijke omschrijvingen
 *   drilldowns      langs welke assen je in deze metriek kunt zoomen
 */
const CATALOGUS = {
  spend: {
    formule: 'De som van alle advertentiekosten in de geselecteerde periode en kanalen.',
    interpretatie: 'Meer of minder uitgeven is op zichzelf niet goed of slecht; het telt pas mee in verhouding tot het resultaat.',
    beperking: 'Bevat alleen mediakosten, geen bureaukosten of interne uren.',
    bronnen: ['Google Ads', 'Microsoft Ads', 'Meta Ads', 'LinkedIn Ads'],
    eenheid: 'euro',
    drilldowns: ['channel', 'campaign'],
  },
  impressions: {
    formule: 'Het totaal aantal keren dat een advertentie is vertoond.',
    interpretatie: 'Zegt iets over zichtbaarheid, niet over resultaat. Meer vertoningen zonder meer klikken duidt op minder relevante plaatsingen.',
    bronnen: ['Google Ads', 'Microsoft Ads', 'Meta Ads', 'LinkedIn Ads'],
    eenheid: 'vertoningen',
    drilldowns: ['channel', 'campaign'],
  },
  clicks: {
    formule: 'Het totaal aantal klikken op een advertentie.',
    interpretatie: 'Een klik is interesse, nog geen resultaat. Beoordeel klikken altijd samen met de conversieratio.',
    bronnen: ['Google Ads', 'Microsoft Ads', 'Meta Ads', 'LinkedIn Ads'],
    eenheid: 'klikken',
    drilldowns: ['channel', 'campaign'],
  },
  ctr: {
    formule: 'Klikken gedeeld door vertoningen, maal honderd.',
    interpretatie: 'Een hogere doorklikratio betekent meestal een relevantere advertentie of doelgroep.',
    beperking: 'Een hoge CTR met een lage conversieratio kan wijzen op een misleidende advertentie.',
    bronnen: ['Google Ads', 'Microsoft Ads', 'Meta Ads', 'LinkedIn Ads'],
    decimalen: 2, eenheid: 'procent',
    drilldowns: ['channel', 'campaign'],
  },
  cpc: {
    formule: 'Advertentie-uitgaven gedeeld door het aantal klikken.',
    interpretatie: 'Een lagere prijs per klik is gunstiger, zolang de kwaliteit van het verkeer gelijk blijft.',
    bronnen: ['Google Ads', 'Microsoft Ads', 'Meta Ads', 'LinkedIn Ads'],
    decimalen: 2, eenheid: 'euro',
    drilldowns: ['channel', 'campaign'],
  },
  cpm: {
    formule: 'Advertentie-uitgaven gedeeld door het aantal vertoningen, maal duizend.',
    interpretatie: 'Een stijging betekent dat dezelfde zichtbaarheid duurder wordt, vaak door meer concurrentie op de veiling.',
    bronnen: ['Google Ads', 'Meta Ads', 'LinkedIn Ads'],
    decimalen: 2, eenheid: 'euro',
    drilldowns: ['channel', 'campaign'],
  },
  sessions: {
    formule: 'Het aantal websitebezoeken, gemeten door Google Analytics 4.',
    interpretatie: 'Meer sessies zijn pas waardevol als de conversieratio op peil blijft.',
    bronnen: ['Google Analytics 4'],
    eenheid: 'sessies',
    drilldowns: ['channel'],
  },
  users: {
    formule: 'Het aantal unieke websitebezoekers in de periode.',
    interpretatie: 'Een indicatie van bereik op de website, los van hoe vaak iemand terugkeert.',
    bronnen: ['Google Analytics 4'],
    eenheid: 'gebruikers',
    drilldowns: ['channel'],
  },

  leads: {
    formule: 'De som van de conversies die als primaire lead zijn ingesteld.',
    interpretatie: 'Het volume aan aanvragen. Beoordeel het samen met de kwalificatieratio, want niet elke lead is bruikbaar.',
    beperking: 'Welke conversies als lead tellen, is per klant ingesteld.',
    bronnen: ['Google Ads', 'Meta Ads', 'Google Analytics 4'],
    eenheid: 'leads',
    drilldowns: ['channel', 'campaign', 'conversionType'],
  },
  cpl: {
    formule: 'Advertentie-uitgaven gedeeld door het aantal leads.',
    interpretatie: 'Een lagere prijs per lead is gunstiger, mits de leadkwaliteit gelijk blijft.',
    beperking: 'Zegt niets over hoeveel leads uiteindelijk klant worden.',
    bronnen: ['Google Ads', 'Meta Ads'],
    decimalen: 2, eenheid: 'euro',
    drilldowns: ['channel', 'campaign'],
  },
  qualifiedLeads: {
    formule: 'Het aantal leads dat na beoordeling in het CRM als serieuze aanvraag geldt.',
    interpretatie: 'De brug tussen marketing en sales. Zonder deze meting is de leadkwaliteit onbekend.',
    beperking: 'Vereist een CRM-koppeling; zonder die koppeling blijft de waarde ontbrekend.',
    bronnen: ['CRM'],
    eenheid: 'leads',
    drilldowns: ['channel', 'campaign'],
  },
  cpql: {
    formule: 'Advertentie-uitgaven gedeeld door het aantal gekwalificeerde leads.',
    interpretatie: 'Wat een bruikbare aanvraag werkelijk kost. Dit is een eerlijker efficiëntiemaat dan de kosten per lead.',
    beperking: 'Vereist een CRM-koppeling.',
    bronnen: ['CRM', 'Google Ads'],
    decimalen: 2, eenheid: 'euro',
    drilldowns: ['channel', 'campaign'],
  },
  appointments: {
    formule: 'Het aantal afspraken of offertes dat uit de aanvragen is voortgekomen.',
    interpretatie: 'Een stap dichter bij omzet dan een gekwalificeerde lead.',
    bronnen: ['CRM'],
    eenheid: 'afspraken',
  },
  customers: {
    formule: 'Het aantal aanvragen dat volgens het CRM klant is geworden.',
    interpretatie: 'Het eindpunt van de leadfunnel en de basis voor de werkelijke acquisitiekosten.',
    bronnen: ['CRM'],
    eenheid: 'klanten',
  },
  pipelineValue: {
    formule: 'De verwachte waarde van de openstaande aanvragen volgens het CRM.',
    interpretatie: 'Een vooruitblik op mogelijke omzet, geen gerealiseerde omzet.',
    bronnen: ['CRM'],
    eenheid: 'euro',
  },

  revenue: {
    formule: 'De som van de conversiewaarde van alle transacties in de periode.',
    interpretatie: 'Het bedrijfsresultaat waar e-commerce op stuurt. Beoordeel het samen met de uitgaven via de ROAS.',
    beperking: 'Betreft omzet, geen marge; inkoop- en verzendkosten zijn niet meegerekend.',
    bronnen: ['Google Analytics 4', 'Google Ads'],
    eenheid: 'euro',
    drilldowns: ['channel', 'campaign'],
  },
  roas: {
    formule: 'Omzet gedeeld door advertentie-uitgaven.',
    interpretatie: 'Een ROAS van 4× betekent vier euro omzet per euro advertentiekosten. Hoger is gunstiger.',
    beperking: 'Zegt niets over marge; een hoge ROAS op een product met lage marge kan alsnog verliesgevend zijn.',
    bronnen: ['Google Ads', 'Google Analytics 4'],
    decimalen: 2, eenheid: 'ratio',
    drilldowns: ['channel', 'campaign'],
  },
  purchases: {
    formule: 'Het aantal afgeronde bestellingen.',
    interpretatie: 'Het transactievolume. Samen met de gemiddelde orderwaarde verklaart het de omzet.',
    bronnen: ['Google Analytics 4', 'Google Ads'],
    eenheid: 'transacties',
    drilldowns: ['channel', 'campaign', 'conversionType'],
  },
  cpa: {
    formule: 'Advertentie-uitgaven gedeeld door het aantal transacties.',
    interpretatie: 'De gemiddelde advertentiekosten per bestelling. Lager is gunstiger bij gelijke orderwaarde.',
    beperking: 'De uitkomst hangt af van welke conversies als primair zijn ingesteld.',
    bronnen: ['Google Ads', 'Meta Ads'],
    decimalen: 2, eenheid: 'euro',
    drilldowns: ['channel', 'campaign', 'conversionType'],
  },
  aov: {
    formule: 'Omzet gedeeld door het aantal transacties.',
    interpretatie: 'De gemiddelde orderwaarde. Een stijging verhoogt de omzet zonder meer transacties.',
    bronnen: ['Google Analytics 4'],
    decimalen: 2, eenheid: 'euro',
  },
  conversieratio: {
    formule: 'Het aantal conversies gedeeld door het aantal sessies, maal honderd.',
    interpretatie: 'Hoe effectief het verkeer wordt omgezet in resultaat. Een lage ratio wijst op een knelpunt op de site of in de doelgroep.',
    bronnen: ['Google Analytics 4'],
    decimalen: 2, eenheid: 'procent',
    drilldowns: ['channel'],
  },
  addToCarts: {
    formule: 'Het aantal keren dat een product in de winkelwagen is gelegd.',
    interpretatie: 'Een microconversie die interesse laat zien. Telt niet mee als aankoop.',
    bronnen: ['Google Analytics 4'],
    eenheid: 'toevoegingen',
  },
  checkouts: {
    formule: 'Het aantal keren dat het afrekenen is gestart.',
    interpretatie: 'Een microconversie vlak voor de aankoop. Een groot verschil met het aantal aankopen wijst op uitval in de checkout.',
    bronnen: ['Google Analytics 4'],
    eenheid: 'checkouts',
  },

  reach: {
    formule: 'Het aantal unieke personen dat per dag is bereikt, opgeteld over de periode.',
    interpretatie: 'Een maat voor bereik bij awareness. Het unieke bereik over de hele periode is lager en wordt niet op dagniveau gemeten.',
    beperking: 'Dagbereik telt dezelfde persoon op verschillende dagen dubbel.',
    bronnen: ['Meta Ads', 'LinkedIn Ads'],
    eenheid: 'personen',
  },
  frequentie: {
    formule: 'Vertoningen gedeeld door het bereik.',
    interpretatie: 'Hoe vaak een bereikte persoon de advertentie gemiddeld zag. Een oplopende frequentie betekent meer herhaling bij dezelfde mensen en vaak advertentiemoeheid.',
    bronnen: ['Meta Ads', 'LinkedIn Ads'],
    decimalen: 2, eenheid: 'ratio',
  },
  conversies: {
    formule: 'De som van de conversies binnen het gekozen conversietype.',
    interpretatie: 'Het geselecteerde resultaat. Welke conversies meetellen, bepaal je met het conversiefilter.',
    bronnen: ['Google Ads', 'Google Analytics 4'],
    eenheid: 'conversies',
    drilldowns: ['channel', 'campaign', 'conversionType'],
  },
};

/**
 * De volledige catalogusinvoer voor een metriek.
 * Combineert de metadata uit metrics.js met de didactiek hierboven en vult
 * ontbrekende velden met verdedigbare standaardwaarden.
 */
export function metriekCatalogus(key) {
  const meta = metriekMeta(key);
  const extra = CATALOGUS[key] ?? {};
  return {
    key,
    label: meta.label,
    kort: meta.kort ?? null,
    uitleg: meta.uitleg ?? '',
    formaat: meta.formaat ?? Formaat.GETAL,
    lagerIsBeter: meta.lagerIsBeter === true,
    richtingNeutraal: meta.richtingNeutraal === true,
    formule: extra.formule ?? '',
    interpretatie: extra.interpretatie ?? '',
    beperking: extra.beperking ?? null,
    bronnen: extra.bronnen ?? [],
    decimalen: extra.decimalen ?? decimalenVoor(meta.formaat),
    eenheid: extra.eenheid ?? '',
    drilldowns: extra.drilldowns ?? [],
  };
}

function decimalenVoor(formaat) {
  if (formaat === Formaat.EURO2 || formaat === Formaat.RATIO) return 2;
  if (formaat === Formaat.PROCENT) return 1;
  return 0;
}

/** Of er voor deze metriek een verdieping bestaat. */
export function heeftDrilldown(key) {
  return (CATALOGUS[key]?.drilldowns ?? []).length > 0;
}

/** Alle metriek­sleutels die een centrale definitie hebben. */
export function alleMetriekSleutels() {
  return Object.keys(METRIEK_META);
}

/** De assen waarlangs een metriek verdiept kan worden, met leesbare labels. */
export const DRILLDOWN_LABELS = {
  channel: 'Kanalen',
  campaign: 'Campagnes',
  conversionType: 'Conversietypen',
};
