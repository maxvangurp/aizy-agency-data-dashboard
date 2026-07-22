/**
 * Leadgeneratie: conversieconfiguratie en verdelingen.
 *
 * Wat hier staat, hangt niet van een periode af: welke conversies als lead
 * tellen, hoe het verkeer zich over pagina's, apparaten en regio's verdeelt, en
 * wat er de afgelopen periode is gedaan en nog moet gebeuren.
 *
 * De aantallen zelf staan hier niet meer. Die komen uit de dagreeksen in
 * timeseries.js en worden per geselecteerde periode en kanaalselectie berekend.
 *
 * CONVERSIES
 * Welke conversies primair zijn, verschilt per klant. Een telefoonklik is bij
 * een fysiotherapiepraktijk een serieus signaal maar geen lead, terwijl een
 * spoedaanvraag dat wel is. Daarom staat die indeling per klant en niet als
 * vaste lijst in de code.
 *
 * `uitgeslotenVanTotaal` voorkomt dubbeltelling. Een formulierstart is een
 * secundaire conversie én de funnelstap die aan de lead voorafgaat. Bij "alle
 * conversies" zou dezelfde uitkomst anders twee keer meetellen.
 *
 * VERDELINGEN
 * De tabellen met pagina's, bronnen, apparaten, regio's en Google Ads-detail
 * zijn vaste verhoudingen. Ze worden proportioneel meegeschaald met de
 * geselecteerde periode en het geselecteerde kanaal, zodat hun totalen altijd
 * aansluiten op de KPI's erboven. De verhouding zelf verandert niet mee; dat is
 * een bewuste beperking van de demodata en staat als zodanig in de README.
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

export function conversieLabel(type) {
  return CONVERSIE_LABELS[type] ?? type;
}

/* ---------------------------------------------------------------
   Klant 1: Vitaalpunt Fysiotherapie
   Scenario: stijgende kosten per lead, dalend volume
   --------------------------------------------------------------- */

const vitaalpunt = {
  clientId: 'vitaalpunt',
  laatsteSync: '2026-07-22T06:20:00Z',

  conversieConfig: {
    primair: ['contactformulier', 'afspraakGepland', 'adviesaanvraag', 'spoedaanvraag'],
    secundair: ['telefoonklik', 'emailklik', 'formulierGestart', 'nieuwsbrief', 'routeaanvraag'],
    uitgeslotenVanTotaal: ['formulierGestart'],
  },

  verdelingen: {
    landingspaginas: [
      { pagina: '/fysiotherapie', gebruikers: 842, leads: 41 },
      { pagina: '/afspraak-maken', gebruikers: 486, leads: 34 },
      { pagina: '/behandelingen/rugklachten', gebruikers: 394, leads: 18 },
      { pagina: '/', gebruikers: 618, leads: 12 },
      { pagina: '/contact', gebruikers: 214, leads: 13 },
    ],
    sourceMedium: [
      { bron: 'google / cpc', gebruikers: 1284, leads: 58 },
      { bron: 'google / organic', gebruikers: 986, leads: 31 },
      { bron: '(direct) / (none)', gebruikers: 512, leads: 12 },
      { bron: 'facebook / paid', gebruikers: 284, leads: 6 },
      { bron: 'zorgkaart.example / referral', gebruikers: 118, leads: 2 },
    ],
    apparaten: [
      { apparaat: 'Mobiel', gebruikers: 2140, leads: 68 },
      { apparaat: 'Computer', gebruikers: 826, leads: 34 },
      { apparaat: 'Tablet', gebruikers: 218, leads: 7 },
    ],
    regios: [
      { regio: 'Noord-Brabant', gebruikers: 1842, leads: 71 },
      { regio: 'Zuid-Holland', gebruikers: 486, leads: 14 },
      { regio: 'Noord-Holland', gebruikers: 342, leads: 9 },
      { regio: 'Gelderland', gebruikers: 284, leads: 8 },
      { regio: 'Limburg', gebruikers: 132, leads: 5 },
    ],
    landen: [
      { land: 'Nederland', gebruikers: 3086, leads: 107 },
      { land: 'België', gebruikers: 98, leads: 2 },
    ],
  },

  googleAds: {
    campagnes: [
      { naam: 'Search | Regio | Fysiotherapie', type: 'Search', kosten: 4020, klikken: 728, vertoningen: 26400, leads: 41, gekwalificeerdeLeads: 29 },
      { naam: 'Search | Regio | Klachten', type: 'Search', kosten: 1990, klikken: 382, vertoningen: 15200, leads: 19, gekwalificeerdeLeads: 12 },
      { naam: 'Performance Max | Regio', type: 'Performance Max', kosten: 1320, klikken: 202, vertoningen: 10300, leads: 9, gekwalificeerdeLeads: 4 },
    ],
    advertentiegroepen: [
      { groep: 'Fysiotherapie | Algemeen', campagne: 'Search | Regio | Fysiotherapie', kosten: 2400, klikken: 440, leads: 26, gekwalificeerdeLeads: 19 },
      { groep: 'Fysiotherapie | Spoed', campagne: 'Search | Regio | Fysiotherapie', kosten: 1620, klikken: 288, leads: 15, gekwalificeerdeLeads: 10 },
      { groep: 'Klachten | Rug', campagne: 'Search | Regio | Klachten', kosten: 1200, klikken: 237, leads: 12, gekwalificeerdeLeads: 8 },
      { groep: 'Klachten | Knie', campagne: 'Search | Regio | Klachten', kosten: 790, klikken: 145, leads: 7, gekwalificeerdeLeads: 4 },
    ],
    zoekwoorden: [
      { zoekwoord: 'fysiotherapeut in de buurt', matchtype: 'Phrase', vertoningen: 8760, klikken: 300, kosten: 1478, leads: 18, gekwalificeerdeLeads: 14 },
      { zoekwoord: 'fysiotherapie spoed', matchtype: 'Exact', vertoningen: 2970, klikken: 175, kosten: 910, leads: 12, gekwalificeerdeLeads: 9 },
      { zoekwoord: 'rugklachten behandeling', matchtype: 'Phrase', vertoningen: 7650, klikken: 211, kosten: 1158, leads: 9, gekwalificeerdeLeads: 6 },
      { zoekwoord: 'fysiotherapie kosten', matchtype: 'Phrase', vertoningen: 6050, klikken: 165, kosten: 828, leads: 6, gekwalificeerdeLeads: 2 },
      { zoekwoord: 'fysio', matchtype: 'Breed', vertoningen: 17530, klikken: 254, kosten: 1758, leads: 5, gekwalificeerdeLeads: 1 },
    ],
  },

  googleBusinessProfile: {
    koppelingBeschikbaar: false,
    profielinteracties: 412,
    telefoongesprekken: 86,
    routeaanvragen: 29,
    websiteklikken: 148,
  },

  werk: {
    gedaan: [
      'Zoekwoorden met een hoge kosten per gekwalificeerde lead gepauzeerd',
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
  laatsteSync: '2026-07-22T06:35:00Z',

  conversieConfig: {
    primair: ['offerteaanvraag', 'adviesaanvraag', 'demoAanvraag'],
    secundair: ['brochureDownload', 'emailklik', 'telefoonklik', 'nieuwsbrief', 'formulierGestart'],
    uitgeslotenVanTotaal: ['formulierGestart'],
  },

  verdelingen: {
    landingspaginas: [
      { pagina: '/bedrijfsadvies', gebruikers: 1842, leads: 31 },
      { pagina: '/diensten/procesoptimalisatie', gebruikers: 1284, leads: 22 },
      { pagina: '/demo-aanvragen', gebruikers: 486, leads: 19 },
      { pagina: '/whitepaper', gebruikers: 1418, leads: 6 },
      { pagina: '/', gebruikers: 1812, leads: 3 },
    ],
    sourceMedium: [
      { bron: 'google / cpc', gebruikers: 2418, leads: 42 },
      { bron: 'linkedin / paid', gebruikers: 1284, leads: 21 },
      { bron: 'google / organic', gebruikers: 1846, leads: 12 },
      { bron: '(direct) / (none)', gebruikers: 942, leads: 5 },
      { bron: 'brancheblad.example / referral', gebruikers: 352, leads: 1 },
    ],
    apparaten: [
      { apparaat: 'Computer', gebruikers: 4818, leads: 64 },
      { apparaat: 'Mobiel', gebruikers: 1742, leads: 14 },
      { apparaat: 'Tablet', gebruikers: 282, leads: 3 },
    ],
    regios: [
      { regio: 'Noord-Holland', gebruikers: 2184, leads: 28 },
      { regio: 'Zuid-Holland', gebruikers: 1842, leads: 24 },
      { regio: 'Utrecht', gebruikers: 1046, leads: 14 },
      { regio: 'Noord-Brabant', gebruikers: 842, leads: 9 },
      { regio: 'Gelderland', gebruikers: 486, leads: 4 },
    ],
    landen: [
      { land: 'Nederland', gebruikers: 5942, leads: 71 },
      { land: 'België', gebruikers: 642, leads: 8 },
      { land: 'Duitsland', gebruikers: 258, leads: 2 },
    ],
  },

  googleAds: {
    campagnes: [
      { naam: 'Search | NL | Bedrijfsadvies', type: 'Search', kosten: 5220, klikken: 1084, vertoningen: 38500, leads: 23, gekwalificeerdeLeads: 16 },
      { naam: 'Search | NL | Procesoptimalisatie', type: 'Search', kosten: 3210, klikken: 715, vertoningen: 25200, leads: 15, gekwalificeerdeLeads: 10 },
      { naam: 'Demand Gen | NL | Whitepaper', type: 'Demand Gen', kosten: 1930, klikken: 490, vertoningen: 21400, leads: 7, gekwalificeerdeLeads: 4 },
      { naam: 'Search | NL | Merk', type: 'Search', kosten: 1290, klikken: 232, vertoningen: 8900, leads: 4, gekwalificeerdeLeads: 2 },
    ],
    advertentiegroepen: [
      { groep: 'Bedrijfsadvies | MKB', campagne: 'Search | NL | Bedrijfsadvies', kosten: 2990, klikken: 622, leads: 14, gekwalificeerdeLeads: 10 },
      { groep: 'Bedrijfsadvies | Corporate', campagne: 'Search | NL | Bedrijfsadvies', kosten: 2230, klikken: 462, leads: 9, gekwalificeerdeLeads: 6 },
      { groep: 'Procesoptimalisatie | Lean', campagne: 'Search | NL | Procesoptimalisatie', kosten: 1970, klikken: 437, leads: 9, gekwalificeerdeLeads: 6 },
      { groep: 'Procesoptimalisatie | Digitaal', campagne: 'Search | NL | Procesoptimalisatie', kosten: 1240, klikken: 278, leads: 6, gekwalificeerdeLeads: 4 },
    ],
    zoekwoorden: [
      { zoekwoord: 'bedrijfsadvies mkb', matchtype: 'Phrase', vertoningen: 16350, klikken: 451, kosten: 2060, leads: 11, gekwalificeerdeLeads: 8 },
      { zoekwoord: 'procesoptimalisatie adviesbureau', matchtype: 'Exact', vertoningen: 8180, klikken: 321, kosten: 1392, leads: 8, gekwalificeerdeLeads: 7 },
      { zoekwoord: 'organisatieadvies bureau', matchtype: 'Phrase', vertoningen: 12270, klikken: 358, kosten: 1721, leads: 7, gekwalificeerdeLeads: 5 },
      { zoekwoord: 'lean consultant', matchtype: 'Exact', vertoningen: 6460, klikken: 253, kosten: 1176, leads: 6, gekwalificeerdeLeads: 4 },
      { zoekwoord: 'adviesbureau', matchtype: 'Breed', vertoningen: 28100, klikken: 536, kosten: 3141, leads: 5, gekwalificeerdeLeads: 1 },
    ],
  },

  googleBusinessProfile: {
    koppelingBeschikbaar: false,
    profielinteracties: 186,
    telefoongesprekken: 34,
    routeaanvragen: 8,
    websiteklikken: 144,
  },

  werk: {
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
      'Terugkoppeling welke leads klant zijn geworden en waarom',
      'Actuele gemiddelde opdrachtwaarde voor de pipelineberekening',
      'Akkoord op een budgetverhoging van 2.000 euro voor augustus',
    ],
  },
};

/* ---------------------------------------------------------------
   Klant 3: Havenkwartier Makelaars
   Scenario: sterke lokale zichtbaarheid, geen meetbare CRM-koppeling
   --------------------------------------------------------------- */

const havenkwartier = {
  clientId: 'havenkwartier',
  laatsteSync: '2026-07-22T05:55:00Z',

  conversieConfig: {
    primair: ['waardebepaling', 'bezichtiging', 'contactformulier', 'afspraakGepland'],
    secundair: ['telefoonklik', 'whatsappKlik', 'routeaanvraag', 'emailklik', 'formulierGestart'],
    uitgeslotenVanTotaal: ['formulierGestart'],
  },

  verdelingen: {
    landingspaginas: [
      { pagina: '/woningaanbod', gebruikers: 3418, leads: 118 },
      { pagina: '/gratis-waardebepaling', gebruikers: 1284, leads: 64 },
      { pagina: '/verkopen', gebruikers: 1642, leads: 52 },
      { pagina: '/', gebruikers: 2418, leads: 38 },
      { pagina: '/contact', gebruikers: 658, leads: 20 },
    ],
    sourceMedium: [
      { bron: 'google / organic', gebruikers: 3842, leads: 108 },
      { bron: 'google / cpc', gebruikers: 2846, leads: 96 },
      { bron: '(direct) / (none)', gebruikers: 1642, leads: 48 },
      { bron: 'instagram / organic', gebruikers: 742, leads: 26 },
      { bron: 'woningsite.example / referral', gebruikers: 348, leads: 14 },
    ],
    apparaten: [
      { apparaat: 'Mobiel', gebruikers: 6428, leads: 204 },
      { apparaat: 'Computer', gebruikers: 2418, leads: 74 },
      { apparaat: 'Tablet', gebruikers: 574, leads: 14 },
    ],
    regios: [
      { regio: 'Zuid-Holland', gebruikers: 5842, leads: 194 },
      { regio: 'Noord-Holland', gebruikers: 1642, leads: 48 },
      { regio: 'Utrecht', gebruikers: 942, leads: 26 },
      { regio: 'Noord-Brabant', gebruikers: 642, leads: 16 },
      { regio: 'Zeeland', gebruikers: 352, leads: 8 },
    ],
    landen: [
      { land: 'Nederland', gebruikers: 9284, leads: 289 },
      { land: 'België', gebruikers: 136, leads: 3 },
    ],
  },

  googleAds: {
    campagnes: [
      { naam: 'Search | Regio | Woning verkopen', type: 'Search', kosten: 2436, klikken: 1177, vertoningen: 46300, leads: 72, gekwalificeerdeLeads: null },
      { naam: 'Search | Regio | Makelaar', type: 'Search', kosten: 1647, klikken: 903, vertoningen: 37600, leads: 52, gekwalificeerdeLeads: null },
      { naam: 'Performance Max | Regio | Aanbod', type: 'Performance Max', kosten: 1369, klikken: 802, vertoningen: 36200, leads: 40, gekwalificeerdeLeads: null },
    ],
    advertentiegroepen: [
      { groep: 'Woning verkopen | Waardebepaling', campagne: 'Search | Regio | Woning verkopen', kosten: 1438, klikken: 706, leads: 44, gekwalificeerdeLeads: null },
      { groep: 'Woning verkopen | Algemeen', campagne: 'Search | Regio | Woning verkopen', kosten: 998, klikken: 471, leads: 28, gekwalificeerdeLeads: null },
      { groep: 'Makelaar | Lokaal', campagne: 'Search | Regio | Makelaar', kosten: 1067, klikken: 585, leads: 35, gekwalificeerdeLeads: null },
      { groep: 'Makelaar | Kosten', campagne: 'Search | Regio | Makelaar', kosten: 580, klikken: 318, leads: 17, gekwalificeerdeLeads: null },
    ],
    zoekwoorden: [
      { zoekwoord: 'gratis waardebepaling woning', matchtype: 'Exact', vertoningen: 15620, klikken: 706, kosten: 1281, leads: 44, gekwalificeerdeLeads: null },
      { zoekwoord: 'makelaar in de buurt', matchtype: 'Phrase', vertoningen: 23430, klikken: 585, kosten: 1068, leads: 35, gekwalificeerdeLeads: null },
      { zoekwoord: 'huis verkopen makelaar', matchtype: 'Phrase', vertoningen: 19140, klikken: 471, kosten: 998, leads: 28, gekwalificeerdeLeads: null },
      { zoekwoord: 'makelaar kosten', matchtype: 'Phrase', vertoningen: 13310, klikken: 318, kosten: 580, leads: 17, gekwalificeerdeLeads: null },
      { zoekwoord: 'woningaanbod', matchtype: 'Breed', vertoningen: 37620, klikken: 802, kosten: 1370, leads: 40, gekwalificeerdeLeads: null },
    ],
  },

  googleBusinessProfile: {
    koppelingBeschikbaar: false,
    profielinteracties: 1842,
    telefoongesprekken: 284,
    routeaanvragen: 86,
    websiteklikken: 642,
  },

  werk: {
    gedaan: [
      'Aparte landingspagina gebouwd voor de gratis waardebepaling',
      'WhatsApp-knop toegevoegd aan de aanbodpagina',
      'Advertentieteksten aangescherpt op de lokale regio',
    ],
    volgende: [
      'De CRM-koppeling inrichten zodat leadkwaliteit meetbaar wordt',
      'Onderzoeken waarom een deel van de gestarte formulieren niet wordt afgerond',
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

export function getLeadsProfiel(clientId) {
  return LEADS_DATA[clientId] ?? null;
}
