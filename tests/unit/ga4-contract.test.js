const test = require('node:test');
const assert = require('node:assert/strict');

const {
  VENSTERS, vensterPeriode,
  verandering, doelTotaal, doelUitReeks, kpiGroepen,
  doorsnedeTabel, dekkingVanTabel,
  vergelijkingsperiode, dagenIn, nogInVerwerking,
} = require('../../ga4-contract');

/** Waltmann, leadgen, 15 aug t/m 11 sep 2026. Echte cijfers uit GA4. */
const WALTMANN = {
  klanttype: 'leadgen',
  periode: {start: '2026-08-15', eind: '2026-09-11'},
  totalen: {sessies: 6206, gebruikers: 3850, engagementpercentage: 0.6258459555269095},
  doelen: {
    leads: ['form_submit_sneak_preview', 'form_submit_zoekopdracht', 'form_submit_nieuwbouw_contact'],
    contactinteracties: ['click_telefoon', 'click_email'],
  },
  doelReeksen: {
    // 145 events in 136 sessies -- de echte verhouding over vier weken.
    leads: [{datum: '2026-08-15', aantal: 145, sessiesMetDoel: 136}],
    contactinteracties: [{datum: '2026-08-15', aantal: 66, sessiesMetDoel: 60}],
  },
  rapporten: {
    kanaal: {
      basis: [
        {segment: 'Organic Search', onbekend: false, sessies: 1789, engagementpercentage: 0.7},
        {segment: 'Paid Social', onbekend: false, sessies: 80, engagementpercentage: 0.5},
      ],
      doelen: {
        leads: {
          events: ['form_submit_sneak_preview', 'form_submit_zoekopdracht'],
          perEvent: [
            {segment: 'Organic Search', event: 'form_submit_sneak_preview', aantal: 20, sessies: 20},
            {segment: 'Organic Search', event: 'form_submit_zoekopdracht', aantal: 7, sessies: 7},
            {segment: 'Paid Social', event: 'form_submit_sneak_preview', aantal: 25, sessies: 25},
          ],
          uniek: [
            {segment: 'Organic Search', sessiesMetDoel: 24},
            {segment: 'Paid Social', sessiesMetDoel: 24},
          ],
        },
      },
    },
  },
};

/** FITTwear, e-commerce. 220 aankopen, €15.062,13, AOV €68,46 op 14.779 sessies. */
const FITTWEAR = {
  klanttype: 'ecommerce',
  periode: {start: '2026-08-15', eind: '2026-09-11'},
  totalen: {
    sessies: 14779, gebruikers: 10623, engagementpercentage: 0.7326612084714798,
    aankopen: 220, omzet: 15062.13, gemiddeldeOrderwaarde: 68.46422727272727,
  },
  doelen: {aankopen: ['purchase']},
  doelReeksen: {aankopen: [{datum: '2026-08-15', aantal: 220, sessiesMetDoel: 220}]},
  rapporten: {},
};

/* ------------------------------------------------------------ verandering -- */

test('van nul naar tien is geen percentage', () => {
  // Elke keuze hier is fout: oneindig, honderd procent, of nul. Het absolute
  // getal zegt wél iets, en `vanNul` laat de weergave het benoemen.
  const v = verandering(10, 0);
  assert.equal(v.absoluut, 10);
  assert.equal(v.procent, null);
  assert.equal(v.vanNul, true);
});

test('een ontbrekende vorige waarde levert geen verandering', () => {
  assert.deepEqual(verandering(10, null), {absoluut: null, procent: null, vanNul: false});
});

test('een gewone daling wordt gewoon gerekend', () => {
  const v = verandering(80, 100);
  assert.equal(v.absoluut, -20);
  assert.equal(v.procent, -20);
});

/* ----------------------------------------------- niet optellen over events -- */

test('sessies worden niet uit de losse eventrijen opgeteld', () => {
  const groep = WALTMANN.rapporten.kanaal.doelen.leads;
  const totaal = doelTotaal(groep);

  // 20+7+25 = 52 events, in 24+24 = 48 sessies. De losse sessieaantallen
  // optellen zou 52 geven: één sessie kan twee formulieren versturen.
  assert.equal(totaal.events, 52);
  assert.equal(totaal.sessies, 48);
  const somLosseSessies = groep.perEvent.reduce((s, e) => s + e.sessies, 0);
  assert.ok(totaal.sessies < somLosseSessies);
});

test('bij meerdere leadevents wordt overlap gemeld', () => {
  assert.equal(doelTotaal(WALTMANN.rapporten.kanaal.doelen.leads).kanOverlappen, true);
  const een = {events: ['purchase'], perEvent: [], uniek: []};
  assert.equal(doelTotaal(een).kanOverlappen, false);
});

/* ------------------------------------------------------------------ KPI's -- */

test('een leadgenklant krijgt geen omzet en geen orderwaarde', () => {
  const groepen = kpiGroepen(WALTMANN);
  const sleutels = groepen.map((g) => g.sleutel);
  assert.deepEqual(sleutels, ['context', 'leads']);
  const alle = groepen.flatMap((g) => g.kpis).map((k) => k.sleutel);
  assert.ok(!alle.includes('omzet'));
  assert.ok(!alle.includes('orderwaarde'));
});

test('een e-commerceklant krijgt geen contactklikken', () => {
  const groepen = kpiGroepen(FITTWEAR);
  assert.deepEqual(groepen.map((g) => g.sleutel), ['context', 'aankopen']);
  const alle = groepen.flatMap((g) => g.kpis).map((k) => k.sleutel);
  assert.ok(!alle.includes('contact'));
  assert.ok(alle.includes('orderwaarde'));
});

test('een gecombineerde klant krijgt twee gescheiden groepen, in de gekozen volgorde', () => {
  const beide = {...WALTMANN, klanttype: 'beide', totalen: {...WALTMANN.totalen, aankopen: 15, omzet: 4200}};
  assert.deepEqual(kpiGroepen(beide, null, {prioriteit: 'leads'}).map((g) => g.sleutel),
    ['context', 'leads', 'aankopen']);
  assert.deepEqual(kpiGroepen(beide, null, {prioriteit: 'aankopen'}).map((g) => g.sleutel),
    ['context', 'aankopen', 'leads']);
});

test('leads en aankopen komen nooit in één cijfer', () => {
  const beide = {...WALTMANN, klanttype: 'beide', totalen: {...WALTMANN.totalen, aankopen: 15}};
  const alle = kpiGroepen(beide).flatMap((g) => g.kpis).map((k) => k.label.toLowerCase());
  assert.ok(!alle.some((l) => l.includes('totaal conversies')));
  assert.ok(!alle.some((l) => l === 'conversies'));
});

test('de conversieratio komt uit sessies met een doel, niet uit eventaantallen', () => {
  const leads = kpiGroepen(WALTMANN).find((g) => g.sleutel === 'leads');
  const ratio = leads.kpis.find((k) => k.sleutel === 'leadratio');
  // 136 sessies met een aanvraag op 6.206 sessies = 2,19%.
  assert.equal(ratio.waarde, 2.19);
  // Zou je 145 events delen, dan stond hier 2,34% -- hoger dan wat er gebeurde.
  assert.notEqual(ratio.waarde, Math.round((145 / 6206) * 10000) / 100);
});

test('de gemiddelde orderwaarde komt van GA4 en wordt niet nagerekend', () => {
  const ecom = kpiGroepen(FITTWEAR).find((g) => g.sleutel === 'aankopen');
  const aov = ecom.kpis.find((k) => k.sleutel === 'orderwaarde');
  assert.equal(aov.waarde, 68.46422727272727);
});

test('een KPI zonder waarde meldt dat hij niet gemeten is', () => {
  const zonder = {...FITTWEAR, totalen: {...FITTWEAR.totalen, omzet: null}};
  const omzet = kpiGroepen(zonder).find((g) => g.sleutel === 'aankopen').kpis.find((k) => k.sleutel === 'omzet');
  assert.equal(omzet.gemeten, false);
  assert.equal(omzet.waarde, null, 'niet gemeten is niet nul');
});

test('een klant zonder gekozen leadevents krijgt dat te zien', () => {
  const leeg = {...WALTMANN, doelen: {leads: [], contactinteracties: []}, doelReeksen: {}};
  const leads = kpiGroepen(leeg).find((g) => g.sleutel === 'leads');
  assert.equal(leads.nietIngericht, true);
  assert.match(leads.uitleg, /nog geen gebeurtenissen als aanvraag aangewezen/);
});

test('elke KPI draagt zijn eigen definitie mee', () => {
  for (const g of kpiGroepen(FITTWEAR)) {
    for (const k of g.kpis) assert.ok(k.definitie && k.definitie.length > 20, k.sleutel);
  }
});

/* --------------------------------------------------------------- tabellen -- */

test('een doorsnede rekent de ratio per rij uit de rij zelf', () => {
  const tabel = doorsnedeTabel(WALTMANN, 'kanaal');
  const social = tabel.rijen.find((r) => r.segment === 'Paid Social');
  // 24 sessies met een lead op 80 sessies = 30%.
  assert.equal(social.resultaten.leads.ratio, 30);
  const organic = tabel.rijen.find((r) => r.segment === 'Organic Search');
  assert.equal(organic.resultaten.leads.ratio, 1.34);
});

test('de tabel sorteert op bedrijfsresultaat en niet op verkeer', () => {
  // Organic Search heeft 1.789 sessies, Paid Social 80. Op verkeer zou Organic
  // bovenaan staan; ze leveren allebei 24 sessies met een lead, en dan wint de
  // grootste. Zet Paid Social er één bij en hij hoort bovenaan.
  const meer = JSON.parse(JSON.stringify(WALTMANN));
  meer.rapporten.kanaal.doelen.leads.uniek[1].sessiesMetDoel = 30;
  const tabel = doorsnedeTabel(meer, 'kanaal');
  assert.equal(tabel.rijen[0].segment, 'Paid Social');
});

test('een minimumvolume houdt kleine rijen uit de tabel', () => {
  const tabel = doorsnedeTabel(WALTMANN, 'kanaal', {minimumSessies: 100});
  assert.deepEqual(tabel.rijen.map((r) => r.segment), ['Organic Search']);
});

test('een onbekende doorsnede levert niets in plaats van een lege tabel', () => {
  assert.equal(doorsnedeTabel(WALTMANN, 'apparaat'), null);
});

test('rijen die niet optellen tot het totaal worden verklaard', () => {
  const tabel = doorsnedeTabel(WALTMANN, 'kanaal');
  const dekking = dekkingVanTabel(tabel, [{code: 'afgekapt'}, {code: 'drempelwaarde'}]);
  // 6.206 totaal, 1.789 + 80 in de tabel.
  assert.equal(dekking.verschil, 4337);
  assert.match(dekking.tekst, /afgekapt/);
  assert.match(dekking.tekst, /te weinig gebruikers/);
});

test('een kloppende tabel krijgt geen uitleg', () => {
  const tabel = {totaalSessies: 100, somSessies: 100, rijen: []};
  assert.equal(dekkingVanTabel(tabel, []), null);
});

/* --------------------------------------------------------------- perioden -- */

test('een venster is N volledige dagen tot en met gisteren', () => {
  // Vandaag valt erbuiten: een dag die nog loopt is altijd lager dan hij wordt,
  // en dan daalt elke trend op de laatste dag zonder dat er iets gebeurde.
  const vandaag = new Date('2026-09-12T09:00:00Z');
  assert.deepEqual(vensterPeriode(28, vandaag), {start: '2026-08-15', eind: '2026-09-11', dagen: 28});
  assert.deepEqual(vensterPeriode(7, vandaag), {start: '2026-09-05', eind: '2026-09-11', dagen: 7});
  assert.deepEqual(vensterPeriode(90, vandaag), {start: '2026-06-14', eind: '2026-09-11', dagen: 90});
});

test('het venster telt inclusief, zodat 7 dagen ook echt 7 dagen is', () => {
  const v = vensterPeriode(7, new Date('2026-09-12T09:00:00Z'));
  assert.equal(dagenIn(v), 7);
});

test('een onzinnig venster levert niets in plaats van een rare periode', () => {
  assert.equal(vensterPeriode(0), null);
  assert.equal(vensterPeriode(-5), null);
  assert.equal(vensterPeriode('veel'), null);
});

test('de aangeboden vensters staan vast', () => {
  // Deze drie en niet "vorige maand": een venster moet aan beide kanten -- de
  // pagina die erom vraagt en de ophaalronde die hem vult -- op dezelfde datums
  // uitkomen. Anders staat er "nog geen cijfers" terwijl ze er wel zijn.
  assert.deepEqual(VENSTERS, [7, 28, 90]);
});

test('de vergelijking van een venster sluit erop aan', () => {
  const vandaag = new Date('2026-09-12T09:00:00Z');
  const v = vensterPeriode(28, vandaag);
  const vorig = vergelijkingsperiode(v);
  assert.deepEqual([vorig.start, vorig.eind], ['2026-07-18', '2026-08-14']);
  assert.equal(dagenIn(vorig), 28);
});


test('de vorige periode sluit aan en is even lang', () => {
  const v = vergelijkingsperiode({start: '2026-08-15', eind: '2026-09-11'});
  assert.deepEqual([v.start, v.eind], ['2026-07-18', '2026-08-14']);
  assert.equal(dagenIn(v), dagenIn({start: '2026-08-15', eind: '2026-09-11'}));
});

test('vorig jaar houdt rekening met schrikkeljaren', () => {
  // 29 februari bestaat niet in 2027. Terugvallen op de 28e houdt de datum in
  // dezelfde maand; doorschuiven naar 1 maart zou hem verplaatsen.
  const v = vergelijkingsperiode({start: '2028-02-01', eind: '2028-02-29'}, 'vorigJaar');
  assert.deepEqual([v.start, v.eind], ['2027-02-01', '2027-02-28']);
});

test('een periode die net voorbij is kan nog veranderen', () => {
  const vandaag = new Date('2026-09-12T10:00:00Z');
  assert.equal(nogInVerwerking({eind: '2026-09-11'}, vandaag), true);
  assert.equal(nogInVerwerking({eind: '2026-09-01'}, vandaag), false);
});

test('een onleesbare periode levert niets in plaats van NaN', () => {
  assert.equal(vergelijkingsperiode({start: 'gisteren', eind: '2026-09-11'}), null);
  assert.equal(dagenIn({start: 'gisteren', eind: '2026-09-11'}), null);
});
