const test = require('node:test');
const assert = require('node:assert/strict');
const {googleBlokVan, afgeleideRatios, resultLabelVan} = require('../../ads-contract');

/** Twee weken, twee campagnes — zoals performance_snapshots ze teruggeeft. */
const SNAPSHOTS = [
  {campaign_id: 'k1', snapshot_date: '2026-09-01', spend: 100, impressions: 2000, clicks: 100, conversions_primary: 5, revenue: 500},
  {campaign_id: 'k2', snapshot_date: '2026-09-01', spend: 50, impressions: 1000, clicks: 40, conversions_primary: 2, revenue: 200},
  {campaign_id: 'k1', snapshot_date: '2026-09-08', spend: 150, impressions: 3000, clicks: 160, conversions_primary: 8, revenue: 800},
];

const CAMPAGNES = new Map([
  ['k1', {id: 'k1', name: 'PMax | Merk', channel_type: 'PERFORMANCE_MAX'}],
  ['k2', {id: 'k2', name: 'Search | Generiek', channel_type: 'SEARCH'}],
]);

test('levert de contractvorm uit docs/api-contract-ads.md', () => {
  const blok = googleBlokVan(SNAPSHOTS, CAMPAGNES, {businessModel: 'ecommerce'});

  assert.equal(blok.platform, 'google');
  assert.equal(blok.label, 'Google Ads');
  assert.equal(blok.aanwezig, true);
  assert.equal(blok.resultLabel, 'Aankopen');
  for (const sleutel of ['totals', 'series', 'campaigns', 'breakdowns']) {
    assert.ok(sleutel in blok, `${sleutel} hoort in het contract te zitten`);
  }
});

test('telt de totalen op en leidt de ratio\'s af', () => {
  const {totals} = googleBlokVan(SNAPSHOTS, CAMPAGNES, {businessModel: 'ecommerce'});

  assert.equal(totals.spend, 300);
  assert.equal(totals.impressions, 6000);
  assert.equal(totals.clicks, 300);
  assert.equal(totals.results, 15);
  assert.equal(totals.revenue, 1500);
  assert.equal(totals.ctr, 5);          // 300 / 6000
  assert.equal(totals.cpc, 1);          // 300 / 300
  assert.equal(totals.cpm, 50);         // 300 / 6000 * 1000
  assert.equal(totals.costPerResult, 20);
  assert.equal(totals.roas, 5);         // 1500 / 300
});

test('bij leadgen is omzet null en niet nul, zodat ROAS niet 0 wordt', () => {
  const {totals, resultLabel} = googleBlokVan(SNAPSHOTS, CAMPAGNES, {businessModel: 'leadgen'});
  assert.equal(resultLabel, 'Leads');
  assert.equal(totals.revenue, null);
  assert.equal(totals.roas, null, 'een ROAS van 0 zou suggereren dat er gemeten is');
  assert.equal(totals.spend, 300, 'de rest van de totalen blijft gewoon staan');
});

test('de reeks is per snapshotdatum, opgeteld over de campagnes', () => {
  const {series} = googleBlokVan(SNAPSHOTS, CAMPAGNES, {businessModel: 'ecommerce'});
  assert.deepEqual(series, [
    {date: '2026-09-01', spend: 150, impressions: 3000, clicks: 140, results: 7},
    {date: '2026-09-08', spend: 150, impressions: 3000, clicks: 160, results: 8},
  ]);
});

test('campagnes worden samengevoegd over perioden en op uitgaven gesorteerd', () => {
  const {campaigns} = googleBlokVan(SNAPSHOTS, CAMPAGNES, {businessModel: 'ecommerce'});
  assert.equal(campaigns.length, 2);
  assert.equal(campaigns[0].name, 'PMax | Merk');
  assert.equal(campaigns[0].spend, 250, 'twee weken van dezelfde campagne horen opgeteld te worden');
  assert.equal(campaigns[0].type, 'PERFORMANCE_MAX');
  assert.equal(campaigns[1].name, 'Search | Generiek');
});

test('een campagne zonder naam krijgt een label in plaats van undefined', () => {
  const {campaigns} = googleBlokVan(
    [{campaign_id: 'onbekend', snapshot_date: '2026-09-01', spend: 10, clicks: 1}],
    new Map(), {businessModel: 'leadgen'}
  );
  assert.equal(campaigns[0].name, 'Onbekende campagne');
  assert.equal(campaigns[0].type, 'Google');
});

test('geen data geeft aanwezig=false, geen leeg blok dat op nul lijkt', () => {
  const blok = googleBlokVan([], new Map(), {businessModel: 'ecommerce'});
  assert.equal(blok.aanwezig, false);
  assert.equal(blok.totals, null, 'nullen zouden er uitzien als gemeten cijfers');
  assert.deepEqual(blok.series, []);
  assert.deepEqual(blok.campaigns, []);
});

test('deelt nooit door nul', () => {
  const r = afgeleideRatios({spend: 0, impressions: 0, clicks: 0, results: 0, revenue: 0});
  for (const [naam, waarde] of Object.entries(r)) {
    assert.equal(waarde, null, `${naam} hoort null te zijn, niet NaN of Infinity`);
  }
});

test('negeert rijen met onbruikbare getallen in plaats van NaN door te geven', () => {
  const {totals} = googleBlokVan(
    [{campaign_id: 'k1', snapshot_date: '2026-09-01', spend: 'onzin', clicks: null, impressions: undefined}],
    CAMPAGNES, {businessModel: 'leadgen'}
  );
  assert.equal(totals.spend, 0);
  assert.equal(totals.clicks, 0);
  assert.equal(Number.isNaN(totals.spend), false);
});

test('resultLabel volgt het verdienmodel', () => {
  assert.equal(resultLabelVan('ecommerce'), 'Aankopen');
  assert.equal(resultLabelVan('leadgen'), 'Leads');
  assert.equal(resultLabelVan(undefined), 'Leads', 'onbekend valt terug op leads');
});

/* ----------------------------------------------------- sleutelvormen -- */

const {sleutelSoort, sleutelProbleem, basisUrl} = require('../../supabase');

test('onderscheidt de secret key van de publishable key', () => {
  assert.equal(sleutelSoort('sb_secret_abc'), 'secret');
  assert.equal(sleutelSoort('eyJhbGciOi.x.y'), 'secret');
  assert.equal(sleutelSoort('sb_publishable_abc'), 'publishable');
  assert.equal(sleutelSoort('zomaarwat'), 'onbekend');
});

test('klaagt over een publishable key met de vindplaats erbij', () => {
  const klacht = sleutelProbleem({SUPABASE_SERVICE_ROLE_KEY: 'sb_publishable_abc'});
  assert.match(klacht, /publishable key/);
  assert.match(klacht, /Secret keys/);

  assert.equal(sleutelProbleem({SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_abc'}), null);
  assert.equal(sleutelProbleem({}), null, 'leeg meldt ontbrekendeSleutels al');
  assert.match(sleutelProbleem({SUPABASE_SERVICE_ROLE_KEY: 'onzin'}), /geen herkenbare vorm/);
});

test('accepteert zowel de project-URL als de volledige REST-URL', () => {
  assert.equal(basisUrl('https://ref.supabase.co/rest/v1/'), 'https://ref.supabase.co');
  assert.equal(basisUrl('https://ref.supabase.co'), 'https://ref.supabase.co');
});

/* ------------------------------------------------- granulariteitkeuze -- */

const {kiesGranulariteit} = require('../../ads-contract');

test('kiest dag boven week, zodat dezelfde periode niet dubbel telt', () => {
  // Dit was een echte bug: het endpoint telde dag- en weekrijen bij elkaar op
  // en gaf voor elke klant exact het dubbele.
  const gemengd = [
    {granularity: 'week', spend: 100},
    {granularity: 'day', spend: 20},
    {granularity: 'day', spend: 30},
  ];
  assert.equal(kiesGranulariteit(gemengd), 'day');
});

test('valt terug op week als er geen dagrijen zijn', () => {
  assert.equal(kiesGranulariteit([{granularity: 'week', spend: 100}]), 'week');
  assert.equal(kiesGranulariteit([]), 'week', 'leeg mag geen fout geven');
  assert.equal(kiesGranulariteit(null), 'week');
});

test('een gemengde set levert na filteren het enkele totaal op', () => {
  const rijen = [
    {granularity: 'week', campaign_id: 'k1', snapshot_date: '2026-09-01', spend: 100, clicks: 10, conversions_primary: 2},
    {granularity: 'day', campaign_id: 'k1', snapshot_date: '2026-09-01', spend: 60, clicks: 6, conversions_primary: 1},
    {granularity: 'day', campaign_id: 'k1', snapshot_date: '2026-09-02', spend: 40, clicks: 4, conversions_primary: 1},
  ];
  const gekozen = kiesGranulariteit(rijen);
  const {totals, series} = googleBlokVan(
    rijen.filter((r) => r.granularity === gekozen), new Map(), {businessModel: 'leadgen'}
  );
  assert.equal(totals.spend, 100, 'niet 200');
  assert.equal(series.length, 2, 'en een echte dagreeks');
});

test('kiest week wanneer de dagrijen het bereik niet dekken', () => {
  // Zeven dagen binnen een venster van dertig: dan zijn de weekrijen het
  // complete beeld en de dagrijen een fragment. Dit ging mis en liet een klant
  // 1.865 euro over dertig dagen tonen waar het een weekbedrag was.
  const dagen = Array.from({length: 7}, (_, i) => ({
    granularity: 'day', snapshot_date: `2026-09-0${i + 1}`,
  }));
  const weken = [{granularity: 'week', snapshot_date: '2026-08-18'}];
  assert.equal(kiesGranulariteit([...dagen, ...weken], {since: '2026-08-13', until: '2026-09-11'}), 'week');
});

test('kiest dag zodra die het bereik wel dekt', () => {
  const dagen = Array.from({length: 7}, (_, i) => ({
    granularity: 'day', snapshot_date: `2026-09-0${i + 1}`,
  }));
  assert.equal(kiesGranulariteit(dagen, {since: '2026-09-01', until: '2026-09-07'}), 'day');
});

test('zonder bereik blijft dag de keuze', () => {
  assert.equal(kiesGranulariteit([{granularity: 'day', snapshot_date: '2026-09-01'}], {}), 'day');
});

/* --------------------------------------------------- betrouwbaarheid -- */

const {onderdrukOnbetrouwbaar} = require('../../ads-contract');

const NOMINAAL = {
  assessed_period_start: '2026-09-01',
  assessed_period_end: '2026-09-07',
  platform_metrics_reliable: true,
  conversion_count_reliable: true,
  conversion_value_reliable: false,
  unreliable_kpis: ['revenue', 'roas'],
  verdict: 'Gebruik omzet en ROAS niet zonder de conversieopzet eerst na te lopen.',
  findings: [{code: 'nominale_conversiewaarde'}],
};

test('een KPI die niets betekent wordt null, geen getal met twee decimalen', () => {
  // Whoon: vijftien campagnes op precies 1,00 per conversie. De ROAS van 0,22
  // die daaruit rolt ziet er precies zo uit als een ROAS die wel iets zegt.
  const blok = googleBlokVan(SNAPSHOTS, CAMPAGNES, {businessModel: 'ecommerce', betrouwbaarheid: NOMINAAL});

  assert.equal(blok.totals.revenue, null);
  assert.equal(blok.totals.roas, null);
  assert.equal(blok.totals.spend, 300, 'uitgaven factureert het platform zelf en blijven staan');
  assert.equal(blok.totals.results, 15, 'de conversieteller is hier niet in twijfel getrokken');
  assert.equal(blok.betrouwbaarheid.lagen.conversiewaarde, false);
  assert.match(blok.betrouwbaarheid.oordeel, /ROAS/);
});

test('een onbetrouwbare conversieteller neemt ook de kosten per resultaat mee', () => {
  const blok = googleBlokVan(SNAPSHOTS, CAMPAGNES, {
    businessModel: 'leadgen',
    betrouwbaarheid: {...NOMINAAL, conversion_count_reliable: false, unreliable_kpis: ['leads', 'cpl', 'conversieratio']},
  });

  assert.equal(blok.totals.results, null);
  assert.equal(blok.totals.costPerResult, null, 'kosten per lead hangt aan dezelfde teller');
  assert.equal(blok.totals.conversieratio, null);
  assert.equal(blok.totals.clicks, 300, 'klikken komen van het platform en overleven dit');
});

test('geen oordeel is niet hetzelfde als een goed oordeel', () => {
  const blok = googleBlokVan(SNAPSHOTS, CAMPAGNES, {businessModel: 'ecommerce'});
  assert.equal(blok.betrouwbaarheid, null, 'niet beoordeeld hoort zichtbaar te zijn');
  assert.equal(blok.totals.roas, 5, 'zonder oordeel verandert er niets aan de cijfers');
});

test('onderdrukken raakt alleen de genoemde velden en verzint er geen bij', () => {
  const totals = {spend: 10, clicks: 2, results: 1, revenue: 40, roas: 4};
  assert.deepEqual(onderdrukOnbetrouwbaar(totals, []), totals);
  assert.deepEqual(onderdrukOnbetrouwbaar(totals, ['roas']), {...totals, roas: null});
  assert.deepEqual(
    onderdrukOnbetrouwbaar(totals, ['onbekende_kpi']), totals,
    'een naam die het contract niet kent hoort niets stuk te maken'
  );
});
