/**
 * Unit-tests voor de frontend-datalaag `js/data/ads-data.js`.
 *
 * Die module is ESM en draait normaal in de browser, maar raakt bij het laden
 * geen `window` of `localStorage` aan. Een dynamische import vanuit deze
 * CommonJS-test werkt daardoor gewoon, en dat is het waard: het optelgedrag
 * hieronder is precies het soort regel dat in een Playwright-test verdrinkt.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

let combineerTotalen;
let afgeleideRatios;
test.before(async () => {
  ({combineerTotalen, afgeleideRatios} = await import('../../js/data/ads-data.js'));
});

const blok = (platform, totals, betrouwbaarheid = null) => ({
  platform, aanwezig: true, resultLabel: 'Aankopen', totals, betrouwbaarheid,
});

const TOTALEN = {spend: 100, impressions: 2000, clicks: 100, results: 5, revenue: 500};

test('telt twee platformen op zoals het altijd deed', () => {
  const totaal = combineerTotalen({
    meta: blok('meta', TOTALEN),
    google: blok('google', {...TOTALEN, spend: 200, results: 15, revenue: 1000}),
  });

  assert.equal(totaal.spend, 300);
  assert.equal(totaal.results, 20);
  assert.equal(totaal.revenue, 1500);
  assert.equal(totaal.roas, 5);
  assert.equal(totaal.betrouwbaarheid, null, 'zonder oordeel hangt er niets aan');
});

test('een onderdrukte conversieteller blijft null en wordt geen gemeten nul', () => {
  // Dit is de reden dat `results` niet meer met `?? 0` wordt opgeteld. De API
  // geeft null terug wanneer de conversieopzet die teller niet draagt, en
  // "0 aankopen" zou eruitzien als een meting in plaats van als een voorbehoud.
  const totaal = combineerTotalen({
    google: blok('google', {...TOTALEN, results: null}, {onbetrouwbareKpis: ['purchases']}),
  });

  assert.equal(totaal.results, null);
  assert.equal(totaal.costPerResult, null, 'kosten per resultaat hangt aan dezelfde teller');
  assert.equal(totaal.conversieratio, null, 'null / clicks is in JavaScript 0, en dat mag hier niet');
  assert.equal(totaal.spend, 100, 'de platformcijfers blijven gewoon staan');
});

test('afgeleideRatios rekent een ontbrekende teller niet naar nul', () => {
  const r = afgeleideRatios({spend: 100, impressions: 1000, clicks: 50, results: null, revenue: null});
  assert.equal(r.conversieratio, null);
  assert.equal(r.costPerResult, null);
  assert.equal(r.roas, null);
  assert.equal(r.cpc, 2, 'wat het platform zelf factureert blijft gewoon staan');
});

test('het voorbehoud van één platform geldt voor de som', () => {
  // Een som is nooit betrouwbaarder dan zijn slechtste term: zegt Google dat
  // zijn ROAS niets betekent, dan betekent de opgetelde ROAS ook niets.
  const totaal = combineerTotalen({
    meta: blok('meta', TOTALEN, {onbetrouwbareKpis: [], oordeel: 'Niets aan de hand.'}),
    google: blok('google', {...TOTALEN, revenue: null, roas: null}, {
      onbetrouwbareKpis: ['revenue', 'roas'], oordeel: 'Nominale conversiewaarde.',
    }),
  });

  assert.deepEqual(totaal.betrouwbaarheid.onbetrouwbareKpis, ['revenue', 'roas']);
  assert.equal(totaal.betrouwbaarheid.oordelen.length, 2);
  assert.equal(totaal.revenue, 500, 'wat Meta wél meet telt gewoon mee');
});

test('geen enkel platform aanwezig geeft null, geen leeg totaal dat op nul lijkt', () => {
  assert.equal(combineerTotalen({}), null);
  assert.equal(combineerTotalen({google: {aanwezig: false, totals: null}}), null);
});
