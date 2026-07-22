/**
 * E-commerce: conversieconfiguratie, productfeed en verdelingen.
 *
 * Net als bij leadgeneratie staan hier geen periodegebonden aantallen meer.
 * Omzet, transacties, ROAS en de funnel komen uit de dagreeksen en worden per
 * geselecteerde periode en kanaalselectie berekend.
 *
 * CONVERSIES BIJ E-COMMERCE
 * De primaire conversie is de aankoop. Winkelwagen- en checkoutacties zijn
 * secundair, maar ze zijn geen losse uitkomsten: het zijn funnelstappen die aan
 * dezelfde aankoop voorafgaan. Ze bij de transacties optellen zou hetzelfde
 * resultaat twee keer tellen. Daarom kent dit model bewust geen optie "alle
 * conversies", terwijl leadgeneratie die wel heeft. Eén universele lijst zou
 * hier een verkeerd getal opleveren.
 */

export const ECOMMERCE_CONVERSIE_CONFIG = {
  primair: ['purchase'],
  secundair: ['add_to_cart', 'begin_checkout'],
  // Beide secundaire acties gaan aan de aankoop vooraf, dus een gecombineerd
  // totaal bestaat niet.
  uitgeslotenVanTotaal: ['add_to_cart', 'begin_checkout'],
};

export const ECOMMERCE_CONVERSIE_LABELS = {
  purchase: 'Aankoop',
  add_to_cart: 'Toegevoegd aan winkelwagen',
  begin_checkout: 'Checkout gestart',
};

/* ---------------------------------------------------------------
   Klant 1: Tafelwerk Studio
   --------------------------------------------------------------- */

const tafelwerk = {
  clientId: 'tafelwerk',
  laatsteSync: '2026-07-22T06:12:00Z',

  googleAds: {
    campagnes: [
      { naam: 'Search | NL | Merk', type: 'Search', kosten: 1980, klikken: 1002, vertoningen: 11500, conversies: 88, conversiewaarde: 31400 },
      { naam: 'Performance Max | NL | Alles', type: 'Performance Max', kosten: 4890, klikken: 1654, vertoningen: 73900, conversies: 99, conversiewaarde: 35300 },
      { naam: 'Shopping | NL | Standaard', type: 'Standard Shopping', kosten: 3010, klikken: 1208, vertoningen: 48500, conversies: 49, conversiewaarde: 17600 },
      { naam: 'Search | NL | Niet-merk', type: 'Search', kosten: 1370, klikken: 612, vertoningen: 22600, conversies: 20, conversiewaarde: 7200 },
    ],
    zoekwoorden: [
      { zoekwoord: 'tafelwerk studio', matchtype: 'Exact', vertoningen: 1140, klikken: 576, kosten: 640, conversies: 34, conversiewaarde: 12300 },
      { zoekwoord: 'eiken eettafel op maat', matchtype: 'Exact', vertoningen: 1040, klikken: 444, kosten: 1020, conversies: 21, conversiewaarde: 7600 },
      { zoekwoord: 'massief houten tafel', matchtype: 'Phrase', vertoningen: 1590, klikken: 166, kosten: 274, conversies: 8, conversiewaarde: 2900 },
      { zoekwoord: 'tafel laten maken', matchtype: 'Phrase', vertoningen: 1420, klikken: 116, kosten: 457, conversies: 4, conversiewaarde: 1600 },
      { zoekwoord: 'design eettafel', matchtype: 'Breed', vertoningen: 3700, klikken: 74, kosten: 447, conversies: 1, conversiewaarde: 360 },
    ],
    matchtypes: [
      { matchtype: 'Exact', vertoningen: 5420, klikken: 1440, kosten: 3505, conversies: 85, conversiewaarde: 26400 },
      { matchtype: 'Phrase', vertoningen: 8670, klikken: 384, kosten: 1240, conversies: 18, conversiewaarde: 4600 },
      { matchtype: 'Breed', vertoningen: 11600, klikken: 258, kosten: 1372, conversies: 5, conversiewaarde: 1300 },
    ],
    eindUrls: [
      { url: '/', vertoningen: 3230, klikken: 1298, kosten: 2891, conversies: 79, conversiewaarde: 28200 },
      { url: '/shop/', vertoningen: 4650, klikken: 329, kosten: 1392, conversies: 8, conversiewaarde: 2800 },
      { url: '/shop/eettafels/', vertoningen: 4310, klikken: 117, kosten: 295, conversies: 4, conversiewaarde: 1600 },
      { url: '/shop/salontafels/', vertoningen: 1800, klikken: 78, kosten: 163, conversies: 1, conversiewaarde: 400 },
    ],
    apparaten: [
      { apparaat: 'Computer', kosten: 5570, klikken: 1712, conversies: 137, conversiewaarde: 48900 },
      { apparaat: 'Mobiel', kosten: 4020, klikken: 1917, conversies: 98, conversiewaarde: 34900 },
      { apparaat: 'Tablet', kosten: 1660, klikken: 397, conversies: 21, conversiewaarde: 7700 },
    ],
  },

  merchantCenter: {
    totaalProducten: 428,
    goedgekeurd: 391,
    beperkt: 22,
    afgekeurd: 15,
    waarschuwingen: 34,
    laatsteSync: '2026-07-22T06:12:00Z',
    problemen: [
      { probleem: 'Ontbrekende GTIN', producten: 15, ernst: 'afgekeurd' },
      { probleem: 'Afbeelding te klein', producten: 12, ernst: 'beperkt' },
      { probleem: 'Verzendkosten niet geconfigureerd', producten: 10, ernst: 'beperkt' },
      { probleem: 'Beschrijving te kort', producten: 34, ernst: 'waarschuwing' },
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

  werk: {
    gedaan: [
      'Merkcampagne gesplitst van de niet-merkcampagne',
      'Feedtitels aangevuld met materiaal en maatvoering',
      'Verzendkosten toegevoegd aan de productpagina',
    ],
    volgende: [
      'Budget verschuiven naar Performance Max op basis van het rendement',
      'De ontbrekende GTIN-codes aanvullen',
      'Een test starten met een bundelaanbieding',
    ],
    vanKlant: [
      'Aanleverdatum van de najaarscollectie',
      'Actuele marges per productgroep',
      'Akkoord op het verhogen van het maandbudget',
    ],
  },
};

/* ---------------------------------------------------------------
   Klant 2: Draadloos Mode
   --------------------------------------------------------------- */

const draadloos = {
  clientId: 'draadloos',
  laatsteSync: '2026-07-22T05:40:00Z',

  googleAds: {
    campagnes: [
      { naam: 'Performance Max | NL | Feed', type: 'Performance Max', kosten: 2560, klikken: 1590, vertoningen: 81200, conversies: 140, conversiewaarde: 12800 },
      { naam: 'Shopping | NL | Sale', type: 'Standard Shopping', kosten: 1460, klikken: 920, vertoningen: 42100, conversies: 84, conversiewaarde: 7100 },
      { naam: 'Search | NL | Merk', type: 'Search', kosten: 630, klikken: 490, vertoningen: 10700, conversies: 49, conversiewaarde: 4200 },
      { naam: 'Demand Gen | NL | Prospect', type: 'Demand Gen', kosten: 470, klikken: 210, vertoningen: 8050, conversies: 17, conversiewaarde: 1500 },
    ],
    zoekwoorden: [
      { zoekwoord: 'draadloos mode', matchtype: 'Exact', vertoningen: 920, klikken: 406, kosten: 177, conversies: 57, conversiewaarde: 4900 },
      { zoekwoord: 'sportlegging dames', matchtype: 'Phrase', vertoningen: 4210, klikken: 320, kosten: 546, conversies: 29, conversiewaarde: 2400 },
      { zoekwoord: 'sport bh kopen', matchtype: 'Phrase', vertoningen: 3090, klikken: 206, kosten: 390, conversies: 16, conversiewaarde: 1400 },
      { zoekwoord: 'goedkope sportkleding', matchtype: 'Breed', vertoningen: 7100, klikken: 190, kosten: 423, conversies: 6, conversiewaarde: 520 },
    ],
    matchtypes: [
      { matchtype: 'Exact', vertoningen: 21400, klikken: 1070, kosten: 757, conversies: 127, conversiewaarde: 10800 },
      { matchtype: 'Phrase', vertoningen: 49200, klikken: 1205, kosten: 2030, conversies: 104, conversiewaarde: 8900 },
      { matchtype: 'Breed', vertoningen: 71450, klikken: 935, kosten: 2333, conversies: 53, conversiewaarde: 4500 },
    ],
    eindUrls: [
      { url: '/', vertoningen: 12050, klikken: 920, kosten: 900, conversies: 106, conversiewaarde: 9100 },
      { url: '/shop/leggings/', vertoningen: 34100, klikken: 810, kosten: 1331, conversies: 70, conversiewaarde: 5900 },
      { url: '/shop/sport-bhs/', vertoningen: 26200, klikken: 605, kosten: 1082, conversies: 57, conversiewaarde: 4900 },
      { url: '/sale/', vertoningen: 20900, klikken: 490, kosten: 937, conversies: 37, conversiewaarde: 3100 },
    ],
    apparaten: [
      { apparaat: 'Mobiel', kosten: 3546, klikken: 2305, conversies: 180, conversiewaarde: 15300 },
      { apparaat: 'Computer', kosten: 1253, klikken: 655, conversies: 84, conversiewaarde: 7100 },
      { apparaat: 'Tablet', kosten: 317, klikken: 250, conversies: 20, conversiewaarde: 1700 },
    ],
  },

  merchantCenter: {
    totaalProducten: 1842,
    goedgekeurd: 1421,
    beperkt: 148,
    afgekeurd: 273,
    waarschuwingen: 216,
    laatsteSync: '2026-07-22T05:40:00Z',
    problemen: [
      { probleem: 'Onjuiste prijs ten opzichte van landingspagina', producten: 142, ernst: 'afgekeurd' },
      { probleem: 'Ontbrekende beschikbaarheid', producten: 131, ernst: 'afgekeurd' },
      { probleem: 'Afbeelding kan niet worden opgehaald', producten: 96, ernst: 'beperkt' },
      { probleem: 'Ontbrekend merk', producten: 52, ernst: 'beperkt' },
      { probleem: 'Titel bevat promotionele tekst', producten: 216, ernst: 'waarschuwing' },
    ],
  },

  searchConsole: {
    klikken: 18420,
    impressies: 842000,
    ctr: 2.19,
    gemPositie: 18.7,
    branded: { klikken: 6820, impressies: 78400, ctr: 8.7, gemPositie: 1.8 },
    nonBranded: { klikken: 11600, impressies: 763600, ctr: 1.52, gemPositie: 20.4 },
    laatsteDatum: '2026-07-19',
  },

  werk: {
    gedaan: [
      'Brede zoekwoorden met een laag rendement gepauzeerd',
      'Feedprijzen opnieuw gesynchroniseerd na de prijswijziging',
      'Retargeting gesplitst van prospectie',
    ],
    volgende: [
      'De afgekeurde producten herstellen en opnieuw indienen',
      'Budget verschuiven van Demand Gen naar Shopping',
      'De checkoutstap op mobiel opnieuw testen',
    ],
    vanKlant: [
      'Actuele voorraadstanden voor de feed',
      'Terugkoppeling op de retourpercentages per productgroep',
      'Akkoord op het verlagen van het budget voor Demand Gen',
    ],
  },
};

/* ---------------------------------------------------------------
   Klant 3: Kaap Noord Outdoor
   --------------------------------------------------------------- */

const kaapnoord = {
  clientId: 'kaapnoord',
  laatsteSync: '2026-07-22T06:02:00Z',

  googleAds: {
    campagnes: [
      { naam: 'Performance Max | EU | Alles', type: 'Performance Max', kosten: 6620, klikken: 4780, vertoningen: 198000, conversies: 375, conversiewaarde: 63700 },
      { naam: 'Shopping | NL/BE | Standaard', type: 'Standard Shopping', kosten: 3970, klikken: 2980, vertoningen: 115000, conversies: 221, conversiewaarde: 37600 },
      { naam: 'Search | NL | Merk', type: 'Search', kosten: 1400, klikken: 1650, vertoningen: 24800, conversies: 131, conversiewaarde: 22200 },
      { naam: 'Search | DE | Niet-merk', type: 'Search', kosten: 2035, klikken: 1305, vertoningen: 57500, conversies: 54, conversiewaarde: 9100 },
    ],
    zoekwoorden: [
      { zoekwoord: 'kaap noord', matchtype: 'Exact', vertoningen: 2440, klikken: 1240, kosten: 471, conversies: 104, conversiewaarde: 17600 },
      { zoekwoord: 'outdoor jas heren', matchtype: 'Exact', vertoningen: 7190, klikken: 1067, kosten: 1195, conversies: 80, conversiewaarde: 13600 },
      { zoekwoord: 'waterdichte jas', matchtype: 'Phrase', vertoningen: 14380, klikken: 939, kosten: 1390, conversies: 57, conversiewaarde: 9700 },
      { zoekwoord: 'wandelschoenen kopen', matchtype: 'Phrase', vertoningen: 10780, klikken: 701, kosten: 1136, conversies: 40, conversiewaarde: 6800 },
      { zoekwoord: 'outdoor kleding', matchtype: 'Breed', vertoningen: 24400, klikken: 568, kosten: 1181, conversies: 20, conversiewaarde: 3400 },
    ],
    matchtypes: [
      { matchtype: 'Exact', vertoningen: 82700, klikken: 4880, kosten: 4002, conversies: 415, conversiewaarde: 70600 },
      { matchtype: 'Phrase', vertoningen: 164700, klikken: 3953, kosten: 5613, conversies: 265, conversiewaarde: 45000 },
      { matchtype: 'Breed', vertoningen: 148200, klikken: 1843, kosten: 4400, conversies: 101, conversiewaarde: 17100 },
    ],
    eindUrls: [
      { url: '/', vertoningen: 36200, klikken: 2794, kosten: 1900, conversies: 248, conversiewaarde: 42100 },
      { url: '/shop/jassen/', vertoningen: 106800, klikken: 3037, kosten: 4010, conversies: 221, conversiewaarde: 37600 },
      { url: '/shop/schoenen/', vertoningen: 86200, klikken: 2423, kosten: 3489, conversies: 164, conversiewaarde: 27900 },
      { url: '/shop/accessoires/', vertoningen: 57000, klikken: 1397, kosten: 2207, conversies: 70, conversiewaarde: 12000 },
    ],
    apparaten: [
      { apparaat: 'Mobiel', kosten: 7444, klikken: 5919, conversies: 366, conversiewaarde: 62200 },
      { apparaat: 'Computer', kosten: 5340, klikken: 3722, conversies: 349, conversiewaarde: 59300 },
      { apparaat: 'Tablet', kosten: 1235, klikken: 1038, conversies: 67, conversiewaarde: 11400 },
    ],
  },

  merchantCenter: {
    totaalProducten: 3240,
    goedgekeurd: 3128,
    beperkt: 84,
    afgekeurd: 28,
    waarschuwingen: 142,
    laatsteSync: '2026-07-22T06:02:00Z',
    problemen: [
      { probleem: 'Ontbrekende maatgegevens', producten: 84, ernst: 'beperkt' },
      { probleem: 'Ontbrekende GTIN', producten: 28, ernst: 'afgekeurd' },
      { probleem: 'Beschrijving kan beter', producten: 142, ernst: 'waarschuwing' },
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

  werk: {
    gedaan: [
      'Microsoft Ads toegevoegd als extra kanaal',
      'Duitse campagnes gesplitst van de Nederlandse',
      'Maatgegevens aangevuld in de productfeed',
    ],
    volgende: [
      'Het budget van Performance Max EU verhogen',
      'De Duitse niet-merkcampagne herstructureren',
      'Een test starten met vrije verzending boven een drempelbedrag',
    ],
    vanKlant: [
      'Voorraadprognose voor het winterseizoen',
      'Akkoord op een hoger maandbudget',
      'Vertalingen voor de Duitse landingspagina',
    ],
  },
};

/* ---------------------------------------------------------------
   Export
   --------------------------------------------------------------- */

export const ECOMMERCE_DATA = { tafelwerk, draadloos, kaapnoord };

export function getEcommerceProfiel(clientId) {
  return ECOMMERCE_DATA[clientId] ?? null;
}
