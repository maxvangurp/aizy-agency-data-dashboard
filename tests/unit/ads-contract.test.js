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

/* ------------------------------------------------------------ Meta-blok -- */

const {metaBlokVan} = require('../../ads-contract');

test('het Meta-blok heeft dezelfde vorm als het Google-blok', () => {
  const blok = metaBlokVan(SNAPSHOTS, CAMPAGNES, {businessModel: 'ecommerce'});
  assert.equal(blok.platform, 'meta');
  assert.equal(blok.label, 'Meta Ads');
  assert.equal(blok.aanwezig, true);
  // Meta kent geen advertentiegroepen en zoekwoorden.
  assert.deepEqual(Object.keys(blok.breakdowns).sort(), ['adSets', 'placements']);
  assert.equal(blok.totals.spend, 300);
});

test('valt terug op leads wanneer dit platform geen aankopen meet', () => {
  // Vitrinemasters staat als webshop en draait op Meta leadcampagnes: 67 leads
  // die anders als "0 aankopen" op het scherm zouden komen.
  const rijen = [
    {campaign_id: 'k1', snapshot_date: '2026-09-01', spend: 300, clicks: 900, conversions_primary: 0, leads: 40},
    {campaign_id: 'k2', snapshot_date: '2026-09-01', spend: 249, clicks: 600, conversions_primary: 0, leads: 27},
  ];
  const blok = metaBlokVan(rijen, CAMPAGNES, {businessModel: 'ecommerce'});

  assert.equal(blok.totals.results, 67);
  assert.equal(blok.resultLabel, 'Leads');
  // Niet stilzwijgend: de interface hoort te weten dat dit een andere soort is,
  // anders telt iemand ze op bij de aankopen van een ander platform.
  assert.equal(blok.resultSoort, 'leads');
  assert.equal(blok.campaigns.reduce((som, c) => som + c.results, 0), 67);
  assert.equal(blok.series[0].results, 67);
});

test('meet het platform wel aankopen, dan blijven dat aankopen', () => {
  const rijen = [
    {campaign_id: 'k1', snapshot_date: '2026-09-01', spend: 100, conversions_primary: 5, leads: 2, revenue: 500},
  ];
  const blok = metaBlokVan(rijen, CAMPAGNES, {businessModel: 'ecommerce'});
  assert.equal(blok.totals.results, 5, 'leads overrulen een gemeten aankoop niet');
  assert.equal(blok.resultSoort, undefined);
});

test('zonder rijen is Meta niet aanwezig in plaats van leeg', () => {
  // Niet elke klant adverteert daar; Pouw en 123Watches.de bijvoorbeeld niet.
  const blok = metaBlokVan([], CAMPAGNES, {businessModel: 'leadgen'});
  assert.equal(blok.aanwezig, false);
  assert.equal(blok.totals, null);
  assert.deepEqual(blok.campaigns, []);
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

/* ------------------------------------------------------ periodegrens -- */

const {periodeVan, binnenBereik, dekkingVan} = require('../../ads-contract');

test('leidt het einde af zolang period_end er nog niet is', () => {
  // Migratie 014 zet die kolom erbij. Tussen deze code en die migratie hoort
  // het endpoint gewoon te blijven werken, dus granularity is de terugval.
  assert.equal(periodeVan({snapshot_date: '2026-09-01', period_end: '2026-09-30'}).eind, '2026-09-30');
  assert.equal(periodeVan({snapshot_date: '2026-09-01', granularity: 'day'}).eind, '2026-09-01');
  assert.equal(periodeVan({snapshot_date: '2026-09-01', granularity: 'week'}).eind, '2026-09-07');
  assert.equal(periodeVan({snapshot_date: '2026-02-01', granularity: 'month'}).eind, '2026-02-28');
  assert.equal(periodeVan({snapshot_date: '2026-09-01'}).eind, '2026-09-01',
    'zonder granulariteit is één dag de enige aanname die niets toevoegt');
});

test('een periode die buiten het venster doorloopt telt niet mee', () => {
  // Dit was de bug: de bovengrens lag op snapshot_date, dus een maandrij die
  // op `since` begon telde in een weekvraag helemaal mee.
  const rijen = [
    {snapshot_date: '2026-09-01', period_end: '2026-09-07', granularity: 'week'},
    {snapshot_date: '2026-09-01', period_end: '2026-09-30', granularity: 'month'},
  ];
  const uit = binnenBereik(rijen, {since: '2026-09-01', until: '2026-09-07'});
  assert.deepEqual(uit.map((r) => r.granularity), ['week']);
});

test('een periode die vóór het venster begon telt ook niet mee', () => {
  const rijen = [
    {snapshot_date: '2026-08-31', period_end: '2026-09-06', granularity: 'week'},
    {snapshot_date: '2026-09-07', period_end: '2026-09-13', granularity: 'week'},
  ];
  const uit = binnenBereik(rijen, {since: '2026-09-01', until: '2026-09-30'});
  assert.deepEqual(uit.map((r) => r.snapshot_date), ['2026-09-07'],
    'dagen van buiten het venster binnenhalen is erger dan ze missen');
});

test('zonder grenzen valt er niets af', () => {
  const rijen = [{snapshot_date: '2026-09-01', period_end: '2026-09-30', granularity: 'month'}];
  assert.equal(binnenBereik(rijen, {}).length, 1);
  assert.equal(binnenBereik(null, {since: '2026-09-01'}).length, 0);
});

test('de dekking zegt hoeveel van de gevraagde dagen er echt in zitten', () => {
  // Vier hele weken in een maand van dertig dagen: 28 gedekt, niet volledig.
  const weken = ['2026-09-01', '2026-09-08', '2026-09-15', '2026-09-22'].map((d) => ({
    snapshot_date: d, granularity: 'week',
  }));
  const dekking = dekkingVan(weken, {since: '2026-09-01', until: '2026-09-30'});
  assert.equal(dekking.dagen, 28);
  assert.equal(dekking.gevraagd, 30);
  assert.equal(dekking.volledig, false, 'zonder dit is "weinig uitgegeven" niet van "niet alles gemeten" te onderscheiden');
});

test('dezelfde dag uit twee campagnes telt één keer mee in de dekking', () => {
  const rijen = [
    {campaign_id: 'k1', snapshot_date: '2026-09-01', granularity: 'day'},
    {campaign_id: 'k2', snapshot_date: '2026-09-01', granularity: 'day'},
  ];
  assert.equal(dekkingVan(rijen, {since: '2026-09-01', until: '2026-09-01'}).dagen, 1);
  assert.equal(dekkingVan(rijen, {}), null, 'zonder venster is dekking geen begrip');
});
