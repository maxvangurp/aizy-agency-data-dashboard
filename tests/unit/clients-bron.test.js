/**
 * Unit-tests voor `js/clients-bron.js`, die bepaalt welke klanten het dashboard
 * ziet.
 *
 * Het gaat hier om één eigenschap die je op het scherm niet betrapt: in live
 * modus reist er precies één voorbeeldklant mee, en die mag nooit een echte
 * klant verdringen of zelf voor echt doorgaan. Gaat dat mis, dan staat er een
 * verzonnen klant met verzonnen omzet tussen de echte -- of erger, een echte
 * klant verdwijnt achter verzonnen cijfers. Beide zien er in de interface
 * volkomen normaal uit.
 *
 * De module is ESM en leest `localStorage` en `fetch` pas bij aanroep, niet bij
 * het laden. Stubs op `globalThis` zijn daarom genoeg.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

let laadEchteClients;
let huidigeClients;
let clientHerkomst;
let herstelClients;
let CONTROLE_CLIENT_ID;

/** De minimale browseromgeving die deze module aanraakt. */
function zetOmgeving() {
  const opslag = new Map();
  globalThis.localStorage = {
    getItem: (k) => (opslag.has(k) ? opslag.get(k) : null),
    setItem: (k, v) => opslag.set(k, String(v)),
    removeItem: (k) => opslag.delete(k),
  };
  globalThis.window = { location: { protocol: 'http:', hostname: '127.0.0.1' } };
}

/** Zet de datamodus zoals `data-provider.js` hem leest. */
function zetModus(modus) {
  globalThis.localStorage.setItem('aizy.dataMode', modus);
}

/** Een `fetch` die één antwoord geeft op /api/clients/live. */
function zetFetch({ ok = true, status = 200, body = [] } = {}) {
  globalThis.fetch = async () => ({
    ok,
    status,
    headers: { get: () => 'application/json' },
    json: async () => body,
    text: async () => JSON.stringify(body),
  });
}

const echteKlant = (id, name) => ({ id, name, businessModel: null, echt: true });

test.before(async () => {
  zetOmgeving();
  ({
    laadEchteClients, huidigeClients, clientHerkomst, herstelClients, CONTROLE_CLIENT_ID,
  } = await import('../../js/clients-bron.js'));
});

test.beforeEach(() => {
  zetOmgeving();
  herstelClients();
});

test('in demomodus blijft de volledige voorbeeldportefeuille staan', async () => {
  zetModus('sample');
  const uit = await laadEchteClients();

  assert.equal(uit.herkomst, 'sample');
  assert.ok(uit.aantal > 1, 'de demo is meer dan één klant; die is het hele fixture');
  assert.equal(huidigeClients().some((c) => c.demo), false,
    'zonder echte klanten valt er niets te onderscheiden, dus geen demomarkering');
});

test('in live modus staat de controleklant vooraan, gemarkeerd, naast alle echte klanten', async () => {
  zetModus('live');
  zetFetch({ body: [echteKlant('shop', 'Shop'), echteKlant('kliniek', 'Kliniek')] });

  const uit = await laadEchteClients();
  const lijst = huidigeClients();

  assert.equal(clientHerkomst(), 'live');
  assert.equal(uit.echt, 2);
  assert.equal(uit.demo, 1);
  assert.equal(lijst.length, 3);

  assert.equal(lijst[0].id, CONTROLE_CLIENT_ID, 'vooraan, anders verdwijnt hij tussen de echte namen');
  assert.equal(lijst[0].demo, true);
  assert.deepEqual(lijst.slice(1).map((c) => c.id), ['shop', 'kliniek'],
    'de echte klanten komen er ongewijzigd en in volgorde achteraan bij');
  assert.equal(lijst.filter((c) => c.demo).length, 1, 'precies één verzonnen klant, niet meer');
});

test('een echte klant met dezelfde slug verdringt de controleklant, niet andersom', async () => {
  zetModus('live');
  zetFetch({ body: [echteKlant(CONTROLE_CLIENT_ID, 'Echte Vitaalpunt'), echteKlant('shop', 'Shop')] });

  const uit = await laadEchteClients();
  const lijst = huidigeClients();

  assert.equal(uit.demo, 0);
  assert.equal(lijst.length, 2);
  assert.equal(lijst.filter((c) => c.id === CONTROLE_CLIENT_ID).length, 1);
  assert.equal(lijst.find((c) => c.id === CONTROLE_CLIENT_ID).name, 'Echte Vitaalpunt',
    'een echte klant verbergen achter verzonnen cijfers is het ergste wat hier kan gebeuren');
  assert.equal(lijst.some((c) => c.demo), false);
});

test('mislukt het ophalen, dan zegt de module dat in plaats van stilletjes terug te vallen', async () => {
  zetModus('live');
  zetFetch({ ok: false, status: 503, body: { message: 'Supabase niet geconfigureerd.' } });

  const uit = await laadEchteClients();

  assert.equal(uit.herkomst, 'sample');
  assert.ok(uit.melding, 'zonder melding kijk je naar verzonnen cijfers zonder dat iets dat zegt');
  assert.equal(huidigeClients().some((c) => c.demo), false);
});

test('een leeg antwoord telt als mislukt, niet als een portefeuille zonder klanten', async () => {
  zetModus('live');
  zetFetch({ body: [] });

  const uit = await laadEchteClients();

  assert.equal(uit.herkomst, 'sample');
  assert.ok(uit.melding);
});
