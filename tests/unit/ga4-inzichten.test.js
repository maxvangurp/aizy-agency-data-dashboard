const test = require('node:test');
const assert = require('node:assert/strict');

const {inzichten, DREMPELS} = require('../../ga4-inzichten');

/** Bouwt een /api/ga4-antwoord met alleen wat een test nodig heeft. */
function antwoord(over = {}) {
  return {
    status: 'ok',
    klanttype: 'leadgen',
    periode: {start: '2026-08-15', eind: '2026-09-11'},
    vergelijking: {start: '2026-07-18', eind: '2026-08-14', label: 'Vorige periode', beschikbaar: true},
    doelen: {leads: ['form_submit_offerte'], contactinteracties: ['click_telefoon']},
    kpis: [],
    tabellen: {},
    producten: null,
    ...over,
  };
}

const kpi = (sleutel, waarde, vorige) => ({
  sleutel, waarde, vorige, gemeten: waarde != null,
  verandering: vorige == null || vorige === 0
    ? {absoluut: waarde == null ? null : waarde - (vorige ?? 0), procent: null, vanNul: vorige === 0}
    : {absoluut: waarde - vorige, procent: Math.round(((waarde - vorige) / vorige) * 1000) / 10, vanNul: false},
});

const groep = (sleutel, kpis) => ({sleutel, kpis});

/* --------------------------------------------------------- terughoudend -- */

test('zonder cijfers komen er geen kaarten', () => {
  assert.deepEqual(inzichten(antwoord()), []);
  assert.deepEqual(inzichten({status: 'geen_data'}), []);
  assert.deepEqual(inzichten(null), []);
});

test('zonder vergelijkingsperiode worden er geen veranderingen gemeld', () => {
  const d = antwoord({
    vergelijking: {beschikbaar: false, reden: 'nog niet opgehaald'},
    kpis: [groep('context', [kpi('sessies', 6000, 6000)]), groep('leads', [kpi('aanvragen', 50, 100)])],
  });
  assert.ok(!inzichten(d).some((k) => k.code === 'aanvragen_dalen'));
});

test('hoogstens vijf kaarten', () => {
  assert.ok(DREMPELS.maximum <= 5);
});

/* ------------------------------------------------------------- leadgen -- */

test('minder aanvragen bij gelijk verkeer wordt gemeld', () => {
  const d = antwoord({
    kpis: [
      groep('context', [kpi('sessies', 6100, 6200)]),
      groep('leads', [kpi('aanvragen', 60, 100), kpi('contact', 40, 40)]),
    ],
  });
  const k = inzichten(d).find((x) => x.code === 'aanvragen_dalen');
  assert.ok(k);
  assert.match(k.titel, /gelijkblijvend verkeer/);
  // Waarneming, verklaring en actie staan apart en worden niet samengevoegd.
  assert.ok(k.waarneming && k.verklaring && k.actie && k.waarom);
  assert.match(k.verklaring, /Mogelijk/, 'een verklaring is een mogelijkheid, geen oorzaak');
});

test('een daling op kleine aantallen wordt niet gemeld', () => {
  // Van 4 naar 2 is vijftig procent en betekent niets.
  const d = antwoord({
    kpis: [
      groep('context', [kpi('sessies', 6100, 6200)]),
      groep('leads', [kpi('aanvragen', 2, 4), kpi('contact', 5, 5)]),
    ],
  });
  assert.ok(!inzichten(d).some((x) => x.code === 'aanvragen_dalen'));
});

test('stijgende contactklikken zonder meer aanvragen wordt gemeld, met voorbehoud', () => {
  const d = antwoord({
    kpis: [
      groep('context', [kpi('sessies', 6000, 6000)]),
      groep('leads', [kpi('aanvragen', 52, 50), kpi('contact', 120, 60)]),
    ],
  });
  const k = inzichten(d).find((x) => x.code === 'contact_zonder_aanvraag');
  assert.ok(k);
  assert.match(k.onzekerheid, /geen gesprek/);
});

/* ---------------------------------------------------------- e-commerce -- */

test('een omzetdaling wordt uiteengerafeld naar aantal of orderwaarde', () => {
  const d = antwoord({
    klanttype: 'ecommerce',
    doelen: {aankopen: ['purchase']},
    kpis: [
      groep('context', [kpi('sessies', 14000, 14000)]),
      groep('aankopen', [
        kpi('aankopen', 200, 205),
        kpi('omzet', 10000, 15000),
        kpi('orderwaarde', 50, 73),
        kpi('aankoopratio', 1.4, 1.45),
      ]),
    ],
  });
  const k = inzichten(d).find((x) => x.code === 'omzet_verandering');
  assert.ok(k);
  // De aantallen bewogen nauwelijks, de orderwaarde wel: dat moet de titel zeggen.
  assert.match(k.titel, /gemiddelde orderwaarde/);
  assert.match(k.onzekerheid, /niet automatisch de volledige webshopomzet/);
});

test('de verklarende factor is die met dezelfde richting als de omzet', () => {
  // Vitrinemasters, echt gemeten: omzet -17,8%, aankopen +50%, orderwaarde
  // -45,2%. Op grootte vergelijken wijst het aantal aankopen aan -- terwijl dat
  // juist steeg. De kaart zou zeggen dat de omzet daalt door meer verkopen.
  const d = antwoord({
    klanttype: 'ecommerce',
    doelen: {aankopen: ['purchase']},
    kpis: [
      groep('context', [kpi('sessies', 15037, 14000)]),
      groep('aankopen', [
        kpi('aankopen', 15, 10),
        kpi('omzet', 22348, 27180),
        kpi('orderwaarde', 1489.88, 2718),
        kpi('aankoopratio', 0.1, 0.08),
      ]),
    ],
  });
  const k = inzichten(d).find((x) => x.code === 'omzet_verandering');
  assert.ok(k);
  assert.match(k.titel, /gemiddelde orderwaarde/);
  assert.ok(!/aantal aankopen/.test(k.titel), 'het aantal steeg; dat verklaart geen daling');
});

test('bewegen beide factoren mee, dan telt de grootste', () => {
  const d = antwoord({
    klanttype: 'ecommerce',
    doelen: {aankopen: ['purchase']},
    kpis: [
      groep('context', [kpi('sessies', 14000, 14000)]),
      groep('aankopen', [
        kpi('aankopen', 150, 200),
        kpi('omzet', 9000, 15000),
        kpi('orderwaarde', 60, 75),
        kpi('aankoopratio', 1.07, 1.43),
      ]),
    ],
  });
  const k = inzichten(d).find((x) => x.code === 'omzet_verandering');
  // Aankopen -25%, orderwaarde -20%: allebei omlaag, aantal verschoof het meest.
  assert.match(k.titel, /aantal aankopen/);
});

test('meer verkeer met een lager aankoopaandeel wordt gemeld', () => {
  const d = antwoord({
    klanttype: 'ecommerce',
    doelen: {aankopen: ['purchase']},
    kpis: [
      groep('context', [kpi('sessies', 20000, 14000)]),
      groep('aankopen', [kpi('aankopen', 220, 220), kpi('omzet', 15000, 15000),
        kpi('orderwaarde', 68, 68), kpi('aankoopratio', 1.1, 1.57)]),
    ],
  });
  const k = inzichten(d).find((x) => x.code === 'verkeer_zonder_aankopen');
  assert.ok(k);
  assert.match(k.waarom, /Meer bezoekers is niet vanzelf beter/);
});

test('een veelbekeken product zonder aankopen wordt gemeld', () => {
  const d = antwoord({
    klanttype: 'ecommerce',
    doelen: {aankopen: ['purchase']},
    kpis: [groep('context', [kpi('sessies', 14000, 14000)]),
      groep('aankopen', [kpi('aankopen', 220, 220)])],
    producten: [
      {product: 'Hold & Go Legging', bekeken: 949, inWinkelwagen: 163, gekocht: 0, omzet: 0},
      {product: 'Stay In Place Short', bekeken: 963, inWinkelwagen: 55, gekocht: 6, omzet: 148},
    ],
  });
  const k = inzichten(d).find((x) => x.code === 'product_zonder_aankoop');
  assert.ok(k);
  assert.match(k.waarneming, /Hold & Go Legging/);
  assert.match(k.onzekerheid, /Itemaantallen zijn geen sessies/);
});

/* --------------------------------------------------------------- segment -- */

test('een kanaal met veel verkeer en weinig resultaat wordt gemeld', () => {
  const d = antwoord({
    kpis: [groep('context', [kpi('sessies', 10000, 10000)]),
      groep('leads', [kpi('aanvragen', 200, 200), kpi('contact', 10, 10)])],
    tabellen: {
      kanaal: {
        totaalSessies: 10000,
        rijen: [
          {segment: 'Organic Search', sessies: 5000, onbekend: false, resultaten: {leads: {sessies: 175, ratio: 3.5}}},
          {segment: 'Paid Social', sessies: 5000, onbekend: false, resultaten: {leads: {sessies: 25, ratio: 0.5}}},
        ],
      },
    },
  });
  // Gemiddeld 2% (200 op 10.000). Paid Social zit op 0,5%: ruim onder de helft,
  // en met 5.000 sessies is dat 75 gemiste aanvragen.
  const k = inzichten(d).find((x) => x.code === 'zwak_kanaal');
  assert.ok(k);
  assert.match(k.waarneming, /Paid Social/);
  assert.equal(k.impact, 75);
  assert.match(k.waarom, /extra opleveren/);
});

test('een kanaal dat maar iets onder het gemiddelde zit wordt niet gemeld', () => {
  // Ruis onderdrukken is het punt: bijna elk kanaal zit onder het gemiddelde,
  // en die allemaal melden maakt de lijst onbruikbaar.
  const d = antwoord({
    kpis: [groep('context', [kpi('sessies', 10000, 10000)]),
      groep('leads', [kpi('aanvragen', 200, 200), kpi('contact', 5, 5)])],
    tabellen: {
      kanaal: {
        totaalSessies: 10000,
        rijen: [
          {segment: 'Organic Search', sessies: 5000, onbekend: false, resultaten: {leads: {sessies: 125, ratio: 2.5}}},
          {segment: 'Paid Social', sessies: 5000, onbekend: false, resultaten: {leads: {sessies: 75, ratio: 1.5}}},
        ],
      },
    },
  });
  assert.ok(!inzichten(d).some((x) => x.code === 'zwak_kanaal'));
});

test('het gemiddelde komt uit de totalen en niet uit de rijpercentages', () => {
  // Een kleine rij met 20% en een grote met 1%. Het gemiddelde van de
  // percentages is 10,5%; uit de totalen is het 1,1%. Op 10,5% zou de grote rij
  // ten onrechte als achterblijver gelden.
  const d = antwoord({
    kpis: [groep('context', [kpi('sessies', 10100, 10100)]),
      groep('leads', [kpi('aanvragen', 120, 120), kpi('contact', 5, 5)])],
    tabellen: {
      kanaal: {
        totaalSessies: 10100,
        rijen: [
          {segment: 'Klein', sessies: 100, onbekend: false, resultaten: {leads: {sessies: 20, ratio: 20}}},
          {segment: 'Groot', sessies: 10000, onbekend: false, resultaten: {leads: {sessies: 100, ratio: 1}}},
        ],
      },
    },
  });
  assert.ok(!inzichten(d).some((x) => x.code === 'zwak_kanaal'),
    'op het juiste gemiddelde is er geen achterblijver');
});

test('(not set) wordt niet als achterblijvend segment gemeld', () => {
  const d = antwoord({
    kpis: [groep('context', [kpi('sessies', 10000, 10000)]),
      groep('leads', [kpi('aanvragen', 200, 200), kpi('contact', 5, 5)])],
    tabellen: {
      kanaal: {
        totaalSessies: 10000,
        rijen: [
          {segment: 'Organic Search', sessies: 5000, onbekend: false, resultaten: {leads: {sessies: 200, ratio: 4}}},
          {segment: '(not set)', sessies: 5000, onbekend: true, resultaten: {leads: {sessies: 0, ratio: 0}}},
        ],
      },
    },
  });
  assert.ok(!inzichten(d).some((x) => x.code === 'zwak_kanaal' && /not set/.test(x.waarneming)));
});

/* -------------------------------------------------------------- apparaat -- */

test('mobiel dat achterblijft wordt gemeld, met het voorbehoud over de kanaalmix', () => {
  const d = antwoord({
    kpis: [groep('context', [kpi('sessies', 15000, 15000)]),
      groep('leads', [kpi('aanvragen', 200, 200), kpi('contact', 5, 5)])],
    tabellen: {
      apparaat: {
        totaalSessies: 15000,
        rijen: [
          {segment: 'mobile', sessies: 12000, onbekend: false, resultaten: {leads: {sessies: 120, ratio: 1}}},
          {segment: 'desktop', sessies: 3000, onbekend: false, resultaten: {leads: {sessies: 90, ratio: 3}}},
        ],
      },
    },
  });
  const k = inzichten(d).find((x) => x.code === 'mobiel_achter');
  assert.ok(k);
  assert.match(k.onzekerheid, /geen bewijs van een technisch probleem/);
  assert.match(k.actie, /kanaalmix/);
});

/* ---------------------------------------------------------- meetprobleem -- */

test('een webshop zonder gemeten aankopen krijgt dat als eerste kaart', () => {
  const d = antwoord({
    klanttype: 'ecommerce',
    doelen: {aankopen: ['purchase']},
    kpis: [groep('context', [kpi('sessies', 5000, 5000)]),
      groep('aankopen', [kpi('aankopen', 0, 0), kpi('omzet', 0, 0)])],
  });
  const kaarten = inzichten(d);
  assert.equal(kaarten[0].code, 'geen_aankoopmeting');
  assert.match(kaarten[0].waarom, /maakt de klant geen leadgeneratieklant/);
});

test('een leadgenklant zonder leaddefinitie krijgt dat als eerste kaart', () => {
  const d = antwoord({
    doelen: {leads: [], contactinteracties: []},
    kpis: [groep('context', [kpi('sessies', 5000, 5000)])],
  });
  assert.equal(inzichten(d)[0].code, 'geen_leaddefinitie');
});

/* -------------------------------------------------------------- vorm -- */

test('elke kaart draagt de zes verplichte onderdelen', () => {
  const d = antwoord({
    kpis: [groep('context', [kpi('sessies', 6100, 6200)]),
      groep('leads', [kpi('aanvragen', 60, 100), kpi('contact', 40, 40)])],
  });
  for (const k of inzichten(d)) {
    assert.ok(k.titel, 'titel');
    assert.ok(k.waarneming, 'waarneming');
    assert.ok(k.cijfers && k.cijfers.periode, 'cijfers met periode');
    assert.ok(k.waarom, 'waarom relevant');
    assert.ok(k.actie, 'aanbevolen actie');
    assert.ok('onzekerheid' in k, 'onzekerheid (mag null zijn, moet bestaan)');
    assert.ok(k.naar?.tab, 'doorklikbestemming');
  }
});

test('de drempels zijn mee te geven', () => {
  const d = antwoord({
    kpis: [groep('context', [kpi('sessies', 6100, 6200)]),
      groep('leads', [kpi('aanvragen', 60, 100), kpi('contact', 40, 40)])],
  });
  assert.ok(inzichten(d).length > 0);
  const streng = inzichten(d, {drempels: {...DREMPELS, verschilProcent: 95}});
  assert.ok(!streng.some((k) => k.code === 'aanvragen_dalen'));
});
