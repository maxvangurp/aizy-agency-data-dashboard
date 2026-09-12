/**
 * Demonstratiedata voor de GA4-module.
 *
 * Nadrukkelijk als demo gelabeld, op elke weergave. De module hangt aan het
 * klanttype, en voorbeeldcijfers die er live uitzien zouden hier het meeste
 * kwaad doen: iemand zou de conversieratio van een verzonnen webshop voor die
 * van zijn eigen site aanzien.
 *
 * De vorm volgt het klanttype van de demoklant, zodat de demo laat zien wat de
 * module wél doet: een leadgeneratieklant krijgt aanvragen en contactklikken,
 * een webshop aankopen, omzet en producten. Een generieke variant zou precies
 * verbergen waar deze module om draait.
 *
 * `aizy.demo.ga4` in localStorage gaat hier voor. Dat is dezelfde demo-store die
 * de Databronnen-pagina gebruikt: zo kan een demo (of een test) een andere
 * situatie tonen zonder dat er een server bij hoeft.
 */

const DEMO_SLEUTEL = 'aizy.demo.ga4';

const PERIODE = { start: '2026-08-15', eind: '2026-09-11' };
const VERGELIJKING = {
  start: '2026-07-18', eind: '2026-08-14', label: 'Vorige periode', beschikbaar: true, reden: null,
};

export function ga4Sample(dashboard) {
  const eigen = uitDemoStore();
  if (eigen) return eigen;

  const klanttype = dashboard?.model === 'ecommerce' ? 'ecommerce' : 'leadgen';
  return klanttype === 'ecommerce' ? webshop(dashboard) : leadbedrijf(dashboard);
}

function uitDemoStore() {
  try {
    const ruw = localStorage.getItem(DEMO_SLEUTEL);
    return ruw ? JSON.parse(ruw) : null;
  } catch {
    // Een stukke of geblokkeerde localStorage is geen reden om de pagina te
    // laten vallen; dan gewoon de standaarddemo.
    return null;
  }
}

const kpi = (sleutel, label, waarde, vorige, eenheid, definitie, extra = {}) => ({
  sleutel, label, eenheid, definitie, voorbehoud: null, secundair: false, ...extra,
  waarde, vorige,
  gemeten: waarde != null,
  verandering: vorige == null || vorige === 0
    ? { absoluut: waarde == null ? null : waarde - (vorige ?? 0), procent: null, vanNul: vorige === 0 }
    : {
        absoluut: Math.round((waarde - vorige) * 100) / 100,
        procent: Math.round(((waarde - vorige) / vorige) * 1000) / 10,
        vanNul: false,
      },
});

const contextGroep = (sessies, vorigeSessies) => ({
  sleutel: 'context', titel: 'Websiteverkeer',
  uitleg: 'Geldt voor de hele site, ongeacht het bedrijfsdoel.',
  kpis: [
    kpi('gebruikers', 'Actieve gebruikers', Math.round(sessies * 0.68), Math.round(vorigeSessies * 0.68), 'aantal',
      'Gebruikers die de site in deze periode gebruikten. Niet op te tellen uit de tabellen '
      + 'hieronder: dezelfde persoon komt in meerdere kanalen voor.'),
    kpi('sessies', 'Sessies', sessies, vorigeSessies, 'aantal',
      'Bezoeken aan de site. De noemer van elke conversieratio hieronder.'),
    kpi('engagement', 'Engagementpercentage', 64.2, 61.8, 'procent',
      'Aandeel sessies dat langer duurde dan tien seconden, een belangrijke gebeurtenis had, '
      + 'of meer dan een pagina bekeek.'),
  ],
});

function leadbedrijf(dashboard) {
  const sessies = 6206;
  const vorige = 6104;
  return {
    status: 'ok',
    demodata: true,
    klant: { slug: dashboard?.client?.slug ?? 'demo', naam: dashboard?.client?.name ?? 'Voorbeeldklant' },
    klanttype: 'leadgen',
    prioriteit: null,
    property: {
      id: '000000000', naam: 'Voorbeeldproperty (demo)',
      tijdzone: 'Europe/Amsterdam', valuta: 'EUR', bron: 'demo',
    },
    doelen: {
      leads: ['formulier_offerte_verzonden', 'afspraak_ingepland'],
      contactinteracties: ['click_telefoon', 'click_email'],
    },
    periode: PERIODE,
    vergelijking: VERGELIJKING,
    kpis: [
      contextGroep(sessies, vorige),
      {
        sleutel: 'leads', titel: 'Leadgeneratie', nietIngericht: false,
        uitleg: 'Gemeten op formulier_offerte_verzonden, afspraak_ingepland.',
        kpis: [
          kpi('aanvragen', 'Aanvragen', 145, 178, 'aantal',
            'Alle gebeurtenissen uit 2 leadevents bij elkaar. Eén bezoeker kan er meer dan een '
            + 'versturen, dus dit is geen aantal unieke aanvragers.',
            { voorbehoud: 'Kan overlappen binnen een sessie' }),
          kpi('leadratio', 'Sessies met een aanvraag', 2.19, 2.72, 'procent',
            'Het aandeel sessies waarin minstens één aanvraag werd verstuurd. Niet het aantal '
            + 'gebeurtenissen gedeeld door sessies -- dat telt twee formulieren in één bezoek '
            + 'als twee bezoeken.'),
          kpi('contact', 'Contactklikken', 132, 88, 'aantal',
            'Klikken op een telefoonnummer, e-mailadres of WhatsApp. Een signaal van interesse, '
            + 'geen bevestigde aanvraag: er is niet gemeten of er daadwerkelijk contact volgde.',
            { secundair: true }),
        ],
      },
    ],
    tabellen: {
      kanaal: doorsnede('kanaal', ['leads', 'contactinteracties'], sessies, [
        ['Organic Search', 1789, 68, { leads: [27, 24, 1.34], contactinteracties: [41, 38, 2.12] }],
        ['Direct', 1370, 72, { leads: [28, 25, 1.82], contactinteracties: [30, 28, 2.04] }],
        ['Organic Social', 1356, 59, { leads: [36, 35, 2.58], contactinteracties: [22, 20, 1.47] }],
        ['Paid Search', 1136, 74, { leads: [25, 24, 2.11], contactinteracties: [28, 26, 2.29] }],
        ['Paid Social', 555, 41, { leads: [29, 28, 5.05], contactinteracties: [11, 10, 1.80] }],
      ]),
      landingspagina: doorsnede('landingspagina', ['leads'], sessies, [
        ['/', 2411, 61, { leads: [38, 35, 1.45] }],
        ['/diensten/waardebepaling', 984, 81, { leads: [52, 49, 4.98] }],
        ['/over-ons', 771, 44, { leads: [3, 3, 0.39] }],
        ['/contact', 402, 88, { leads: [41, 38, 9.45] }],
      ], { hostnaam: 'voorbeeld.nl' }),
      apparaat: doorsnede('apparaat', ['leads'], sessies, [
        ['mobile', 4102, 61, { leads: [62, 58, 1.41] }],
        ['desktop', 1889, 71, { leads: [77, 72, 3.81] }],
        ['tablet', 215, 66, { leads: [6, 6, 2.79] }],
      ]),
      land: doorsnede('land', ['leads'], sessies, [
        ['Netherlands', 5810, 66, { leads: [138, 130, 2.24] }],
        ['Belgium', 268, 52, { leads: [5, 5, 1.87] }],
      ]),
    },
    producten: null,
    stappen: null,
    gebeurtenissen: [],
    meldingen: [],
    synchronisatie: { opgehaaldOp: '2026-09-12T06:00:00.000Z', nogInVerwerking: false },
    inzichten: [
      {
        code: 'zwak_landingspagina',
        titel: 'Landingspagina met veel bezoek en weinig resultaat',
        waarneming: '"/over-ons" bracht 771 sessies (12,4% van het verkeer) met 0,39% aanvragen, '
          + 'tegen 2,34% gemiddeld.',
        cijfers: { nu: 0.39, vorig: 2.34, periode: PERIODE, vergelijking: null },
        waarom: 'Op het gemiddelde zou dit 15 aanvragen extra opleveren, zonder dat er één '
          + 'bezoeker bij hoeft.',
        verklaring: 'Mogelijk sluit de pagina niet aan op de verwachting waarmee bezoekers komen, '
          + 'of staat het formulier te ver naar beneden.',
        actie: 'Bekijk deze pagina naast een pagina die het wél goed doet, met dezelfde bezoekersvraag.',
        onzekerheid: 'Een verschil in conversieratio kan ook aan de bezoekersmix liggen; dit is '
          + 'geen bewijs dat de pagina zelf het probleem is.',
        naar: { tab: 'landingspaginas' },
      },
      {
        code: 'contact_zonder_aanvraag',
        titel: 'Meer contactklikken, niet meer aanvragen',
        waarneming: 'Contactklikken gingen van 88 naar 132 (+50%), terwijl de aanvragen van 178 '
          + 'naar 145 zakten (-18,5%).',
        cijfers: { nu: 132, vorig: 88, periode: PERIODE, vergelijking: VERGELIJKING },
        waarom: 'Er is meer interesse, maar die loopt niet via het formulier. Wat er via de '
          + 'telefoon binnenkomt is hier niet zichtbaar en telt nergens mee.',
        verklaring: 'Mogelijk kiezen bezoekers vaker voor bellen dan voor het formulier, of is het '
          + 'formulier minder goed vindbaar geworden.',
        actie: 'Vraag na hoeveel telefonische aanvragen er binnenkwamen.',
        onzekerheid: 'Een klik op een telefoonnummer is geen gesprek. Er is niet gemeten of er '
          + 'daadwerkelijk contact volgde.',
        naar: { tab: 'leads' },
      },
    ],
  };
}

function webshop(dashboard) {
  const sessies = 14779;
  const vorige = 13120;
  return {
    status: 'ok',
    demodata: true,
    klant: { slug: dashboard?.client?.slug ?? 'demo', naam: dashboard?.client?.name ?? 'Voorbeeldwebshop' },
    klanttype: 'ecommerce',
    prioriteit: null,
    property: {
      id: '000000000', naam: 'Voorbeeldwebshop (demo)',
      tijdzone: 'Europe/Amsterdam', valuta: 'EUR', bron: 'demo',
    },
    doelen: { aankopen: ['purchase'] },
    periode: PERIODE,
    vergelijking: VERGELIJKING,
    kpis: [
      contextGroep(sessies, vorige),
      {
        sleutel: 'aankopen', titel: 'E-commerce', nietIngericht: false,
        uitleg: 'Door GA4 gemeten aankopen en omzet. Dit is niet automatisch de volledige '
          + 'webshopomzet: wat GA4 niet meet, staat hier niet in.',
        kpis: [
          kpi('aankopen', 'Aankopen', 220, 241, 'aantal',
            'Afgeronde aankopen. Winkelwagens en gestarte betalingen tellen niet mee.'),
          kpi('omzet', 'Aankoopomzet', 15062.13, 17840.5, 'geld',
            'Door GA4 gemeten omzet over de aankopen in deze periode.'),
          kpi('aankoopratio', 'Sessies met een aankoop', 1.49, 1.84, 'procent',
            'Het aandeel sessies waarin een aankoop plaatsvond.'),
          kpi('orderwaarde', 'Gemiddelde orderwaarde', 68.46, 74.03, 'geld',
            'Zoals GA4 hem rekent, over de aankopen waar een orderwaarde bij hoorde. Omzet zelf '
            + 'door aankopen delen geeft een andere noemer en dus een ander getal.'),
        ],
      },
    ],
    tabellen: {
      kanaal: doorsnede('kanaal', ['aankopen'], sessies, [
        ['Paid Social', 5297, 61, { aankopen: [32, 32, 0.60] }, 2207.8],
        ['Direct', 4396, 80, { aankopen: [53, 53, 1.21] }, 3629.43],
        ['Organic Search', 2297, 89, { aankopen: [40, 40, 1.74] }, 2924.04],
        ['Paid Search', 1783, 83, { aankopen: [80, 80, 4.49] }, 5388.19],
      ]),
      landingspagina: doorsnede('landingspagina', ['aankopen'], sessies, [
        ['/', 7051, 68, { aankopen: [92, 92, 1.30] }, 6298.1],
        ['/shop/dames', 515, 91, { aankopen: [41, 41, 7.96] }, 2810.4],
        ['/shop/dames/leggings', 426, 88, { aankopen: [28, 28, 6.57] }, 1904.2],
      ], { hostnaam: 'voorbeeldshop.nl' }),
      apparaat: doorsnede('apparaat', ['aankopen'], sessies, [
        ['mobile', 11864, 76, { aankopen: [183, 183, 1.54] }, 12160.23],
        ['desktop', 2727, 60, { aankopen: [36, 36, 1.32] }, 2851.2],
        ['tablet', 125, 86, { aankopen: [1, 1, 0.80] }, 50.7],
      ]),
      land: doorsnede('land', ['aankopen'], sessies, [
        ['Netherlands', 12180, 75, { aankopen: [198, 198, 1.63] }, 13600.1],
        ['Belgium', 1842, 69, { aankopen: [20, 20, 1.09] }, 1302.03],
      ]),
    },
    producten: [
      { product: 'Stay In Place Short Sepia', bekeken: 963, inWinkelwagen: 55, gekocht: 6, omzet: 148 },
      { product: 'Hold & Go Legging New Fit Black', bekeken: 949, inWinkelwagen: 163, gekocht: 0, omzet: 0 },
      { product: 'Stay In Place Short Black', bekeken: 736, inWinkelwagen: 82, gekocht: 18, omzet: 540.2 },
    ],
    stappen: [
      { event: 'view_item', label: 'Product bekeken', gemeten: true, aantal: 40070, sessies: 6835 },
      { event: 'add_to_cart', label: 'In winkelwagen', gemeten: true, aantal: 2974, sessies: 1802 },
      { event: 'begin_checkout', label: 'Afrekenen gestart', gemeten: true, aantal: 888, sessies: 701 },
      { event: 'add_payment_info', label: 'Betaalgegevens ingevuld', gemeten: false, aantal: null, sessies: null },
      { event: 'purchase', label: 'Aankoop', gemeten: true, aantal: 220, sessies: 220 },
    ],
    gebeurtenissen: [],
    meldingen: [{
      code: 'afgekapt',
      tekst: 'Er waren 1.173 rijen; hiervan zijn de 200 grootste getoond. De rest zit niet in '
        + 'deze lijst en telt niet mee in de rijtotalen.',
    }],
    synchronisatie: { opgehaaldOp: '2026-09-12T06:00:00.000Z', nogInVerwerking: false },
    inzichten: [
      {
        code: 'omzet_verandering',
        titel: 'Aankoopomzet daalt door de gemiddelde orderwaarde',
        waarneming: 'Omzet € 15.062,13 tegenover € 17.840,50 (-15,6%). Aankopen 220 tegenover '
          + '241 (-8,7%), gemiddelde orderwaarde € 68,46 tegenover € 74,03 (-7,5%).',
        cijfers: { nu: 15062.13, vorig: 17840.5, periode: PERIODE, vergelijking: VERGELIJKING },
        waarom: 'Omzet is aantal maal waarde. Weten welke van de twee verschoof bepaalt of je aan '
          + 'verkeer en conversie werkt, of aan assortiment en prijs.',
        verklaring: 'Mogelijk een verschuiving in welke producten verkocht worden, of een actie '
          + 'met korting.',
        actie: 'Kijk bij de productprestaties welke artikelen van plek zijn gewisseld.',
        onzekerheid: 'Dit is de door GA4 gemeten omzet. Wat GA4 niet meet, staat hier niet in; dit '
          + 'is niet automatisch de volledige webshopomzet.',
        naar: { tab: 'producten' },
      },
      {
        code: 'product_zonder_aankoop',
        titel: 'Veel bekeken product zonder aankopen',
        waarneming: '"Hold & Go Legging New Fit Black" werd 949 keer bekeken en 163 keer in de '
          + 'winkelwagen gelegd, maar niet gekocht.',
        cijfers: { nu: 949, vorig: null, periode: PERIODE, vergelijking: null },
        waarom: 'Dit product trekt aandacht die nergens toe leidt. Dat is verkeer waar al voor '
          + 'betaald is.',
        verklaring: 'Mogelijk is het uitverkocht, staat de prijs of levertijd in de weg, of '
          + 'ontbreken maat- of voorraadgegevens.',
        actie: 'Controleer voorraad, prijs en levertijd van dit artikel.',
        onzekerheid: 'Itemaantallen zijn geen sessies: dezelfde bezoeker kan het artikel meerdere '
          + 'keren bekijken.',
        naar: { tab: 'producten' },
      },
    ],
  };
}

/** Bouwt één doorsnedetabel in de vorm die `/api/ga4` oplevert. */
function doorsnede(naam, groepen, totaalSessies, rijen, { hostnaam = null } = {}) {
  const uit = rijen.map(([segment, sessies, engagement, resultaten, omzet = null]) => ({
    segment,
    onbekend: false,
    hostnaam,
    sessies,
    engagement,
    omzet,
    aankopen: resultaten.aankopen ? resultaten.aankopen[0] : null,
    resultaten: Object.fromEntries(Object.entries(resultaten).map(([groep, [events, metDoel, ratio]]) => [
      groep, { events, sessies: metDoel, ratio, perEvent: [] },
    ])),
    sessiesVorig: null, sessiesVerandering: null, nieuw: false,
  }));
  const som = uit.reduce((s, r) => s + r.sessies, 0);
  return {
    doorsnede: naam,
    primairDoel: groepen[0] ?? null,
    groepen,
    rijen: uit,
    somSessies: som,
    totaalSessies,
    dekking: som < totaalSessies
      ? {
          verschil: totaalSessies - som,
          aandeel: Math.round(((totaalSessies - som) / totaalSessies) * 1000) / 10,
          tekst: `${(totaalSessies - som).toLocaleString('nl-NL')} sessies staan niet in deze tabel, `
            + 'omdat de lijst is afgekapt op de grootste rijen.',
        }
      : null,
  };
}
