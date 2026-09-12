/**
 * Unit-tests voor `ads-query.js`, de Supabase-kant van het campagne-endpoint.
 *
 * Het punt van deze tests is niet dat er rijen terugkomen -- dat is een `await`
 * -- maar dat de drie onafhankelijke reads ook echt tegelijk vertrekken. Dat is
 * precies het soort eigenschap dat bij een onschuldig ogende refactor
 * terugvalt naar sequentieel zonder dat iemand het merkt, want het antwoord
 * blijft identiek en alleen de wachttijd verandert.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const {zoekKlant, leesBetrouwbaarheid, haalGoogleAdsBron} = require('../../ads-query');

const KLANT = {id: 'uuid-1', slug: 'shop', name: 'Shop', business_model: 'ecommerce'};

/**
 * Nep-Supabase die bijhoudt wanneer elke read begon en eindigde.
 *
 * `vertraging` is er zodat overlap meetbaar is: zonder wachttijd lopen ook
 * sequentiële aanroepen binnen dezelfde milliseconde en bewijst een tijdstempel
 * niets.
 */
function nepSb({antwoorden = {}, vertraging = 20, faalOp = null} = {}) {
  const calls = [];
  return {
    calls,
    async lees(tabel, opties = {}) {
      const call = {tabel, opties, start: Date.now(), eind: null};
      calls.push(call);
      await new Promise((r) => setTimeout(r, vertraging));
      call.eind = Date.now();
      if (faalOp === tabel) throw new Error(`Supabase gaf 404 op ${tabel} (404)`);
      return antwoorden[tabel] ?? [];
    },
  };
}

/* ------------------------------------------------------------- klant -- */

test('vindt een klant op slug en op uuid', async () => {
  const sb = nepSb({antwoorden: {clients: [KLANT]}, vertraging: 0});

  assert.equal((await zoekKlant(sb, 'shop')).klant.id, 'uuid-1');
  assert.equal((await zoekKlant(sb, 'uuid-1')).klant.id, 'uuid-1');
});

test('geeft bij een misser de beschikbare slugs terug', async () => {
  const sb = nepSb({
    antwoorden: {clients: [KLANT, {id: 'uuid-2', slug: 'winkel'}, {id: 'uuid-3', slug: null}]},
    vertraging: 0,
  });
  const uit = await zoekKlant(sb, 'bestaatniet');

  assert.equal(uit.klant, null);
  assert.deepEqual(uit.beschikbaar, ['shop', 'winkel'], 'een klant zonder slug hoort er niet in');
});

/* ------------------------------------------------------- parallellie -- */

/**
 * Deze test is de reden dat deze module bestaat.
 *
 * Vier round-trips achter elkaar terwijl er maar één afhankelijk is, kost op een
 * verbinding van tachtig milliseconde ruwweg een zesde seconde per weergave.
 * Breekt deze test, dan is dat verlies terug -- en het antwoord ziet er dan nog
 * steeds goed uit.
 */
test('haalt de drie onafhankelijke reads tegelijk op', async () => {
  const sb = nepSb({
    antwoorden: {
      performance_snapshots: [{campaign_id: 'c1', spend: 10}],
      campaigns: [{id: 'c1', name: 'Merk'}],
      client_kpi_reliability: [{platform_metrics_reliable: true}],
    },
    vertraging: 25,
  });

  const t0 = Date.now();
  await haalGoogleAdsBron(sb, {klantId: 'uuid-1'});
  const verstreken = Date.now() - t0;

  assert.equal(sb.calls.length, 3, 'drie reads, niet meer en niet minder');
  assert.ok(
    verstreken < 60,
    `drie reads van 25ms horen samen onder de 60ms te blijven, duurde ${verstreken}ms — ze lopen weer achter elkaar`
  );

  // Harder dan de klok: alle drie begonnen voordat de eerste klaar was.
  const eersteEind = Math.min(...sb.calls.map((c) => c.eind));
  for (const call of sb.calls) {
    assert.ok(call.start <= eersteEind, `${call.tabel} vertrok pas nadat een andere read klaar was`);
  }
});

test('filtert op de klant en op het platform', async () => {
  const sb = nepSb({vertraging: 0});
  await haalGoogleAdsBron(sb, {klantId: 'uuid-1', since: '2026-09-01'});

  const prestaties = sb.calls.find((c) => c.tabel === 'performance_snapshots');
  assert.deepEqual(prestaties.opties.filters, {
    client_id: 'uuid-1', platform: 'google-ads', snapshot_date: 'gte.2026-09-01',
  });

  // Ook de campagnes, en dat is sinds kort geen overbodig filter meer: Meta
  // schrijft naar dezelfde tabel. Zonder platform komen de Meta-campagnes van
  // deze klant mee over de lijn zonder dat iemand ze opvraagt.
  const campagnes = sb.calls.find((c) => c.tabel === 'campaigns');
  assert.deepEqual(campagnes.opties.filters, {client_id: 'uuid-1', platform: 'google-ads'});
});

test('zonder since geen ondergrens, zodat een ongefilterde weergave niet leeg is', async () => {
  const sb = nepSb({vertraging: 0});
  await haalGoogleAdsBron(sb, {klantId: 'uuid-1'});

  const prestaties = sb.calls.find((c) => c.tabel === 'performance_snapshots');
  assert.equal(prestaties.opties.filters.snapshot_date, undefined);
});

test('levert de campagnes als index op id', async () => {
  const sb = nepSb({
    antwoorden: {campaigns: [{id: 'c1', name: 'Merk'}, {id: 'c2', name: 'Shopping'}]},
    vertraging: 0,
  });
  const bron = await haalGoogleAdsBron(sb, {klantId: 'uuid-1'});

  assert.ok(bron.campagnes instanceof Map);
  assert.equal(bron.campagnes.get('c2').name, 'Shopping');
});

test('weigert een aanroep zonder klant, want dan filtert geen enkele query', async () => {
  await assert.rejects(() => haalGoogleAdsBron(nepSb(), {}), /klantId is verplicht/);
});

/* ------------------------------------------------- betrouwbaarheid -- */

/**
 * Een ontbrekende tabel is een volgorde, geen fout: migratie 015 maakt hem aan.
 * Een 401 is dat níét -- dan kloppen de rechten niet, en dat stilzwijgend als
 * "geen oordeel" behandelen is precies hoe je een ROAS toont die niets betekent.
 */
test('een ontbrekende betrouwbaarheidstabel geeft null, geen fout', async () => {
  const sb = nepSb({faalOp: 'client_kpi_reliability', vertraging: 0});
  assert.equal(await leesBetrouwbaarheid(sb, 'uuid-1'), null);

  const bron = await haalGoogleAdsBron(sb, {klantId: 'uuid-1'});
  assert.equal(bron.betrouwbaarheid, null, 'de rest van het blok hoort gewoon te komen');
});

test('een andere fout op die tabel gaat wél door', async () => {
  const sb = {
    async lees(tabel) {
      if (tabel === 'client_kpi_reliability') throw new Error('Supabase weigert de sleutel (401)');
      return [];
    },
  };
  await assert.rejects(() => leesBetrouwbaarheid(sb, 'uuid-1'), /401/);
  await assert.rejects(() => haalGoogleAdsBron(sb, {klantId: 'uuid-1'}), /401/);
});
