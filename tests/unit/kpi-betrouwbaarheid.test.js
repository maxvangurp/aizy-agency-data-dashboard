const test = require('node:test');
const assert = require('node:assert/strict');

/** De module is ESM (js/ draait op "type": "module"), dus dynamisch importeren. */
const laad = () => import('../../js/data/kpi-betrouwbaarheid.js');

/** Zoals /api/clients/live het aanlevert voor een meubelzaak met vaste conversiewaarde. */
const OORDEEL = {
  beoordeeld: true,
  platform: 'google-ads',
  betrouwbaar: {platformcijfers: true, conversieteller: true, conversiewaarde: false},
  onbetrouwbareKpis: ['revenue', 'roas'],
  oordeel: 'Gebruik omzet en ROAS niet zonder de conversieopzet eerst na te lopen.',
  bevindingen: [
    {code: 'conversies_zonder_waarde', ernst: 'laag', tekst: 'Conversies zonder waarde.'},
    {code: 'nominale_conversiewaarde', ernst: 'hoog', tekst: 'Vijftien campagnes op exact 1,00 per conversie.'},
  ],
};

test('zwijgt over KPI\'s die wel kloppen', async () => {
  const {zetBetrouwbaarheid, isOnbetrouwbaar, redenVoor} = await laad();
  zetBetrouwbaarheid(OORDEEL);

  assert.equal(isOnbetrouwbaar('roas'), true);
  assert.equal(isOnbetrouwbaar('revenue'), true);
  // Spend en klikken factureert het platform zelf; daar mankeert niets aan.
  assert.equal(isOnbetrouwbaar('spend'), false);
  assert.equal(redenVoor('cpc'), null);
});

test('noemt de zwaarste bevinding als reden, niet de eerste de beste', async () => {
  const {zetBetrouwbaarheid, redenVoor} = await laad();
  zetBetrouwbaarheid(OORDEEL);
  // 'conversies_zonder_waarde' staat vooraan maar is laag; de nominale waarde
  // is wat het cijfer onbruikbaar maakt, dus die hoort er te staan.
  assert.match(redenVoor('roas'), /exact 1,00 per conversie/);
});

test('niet beoordeeld is iets anders dan goedgekeurd', async () => {
  const {zetBetrouwbaarheid, heeftOordeel, isOnbetrouwbaar} = await laad();
  zetBetrouwbaarheid(null);

  assert.equal(heeftOordeel(), false, 'er staat niets vast');
  assert.equal(isOnbetrouwbaar('roas'), false, 'maar zonder grond ook niets betwijfelen');
});

test('een portfoliopagina wist het oordeel in plaats van het te laten staan', async () => {
  const {zetBetrouwbaarheid, isOnbetrouwbaar} = await laad();
  zetBetrouwbaarheid(OORDEEL);
  assert.equal(isOnbetrouwbaar('roas'), true);

  // Anders draagt de volgende klant het voorbehoud van de vorige.
  zetBetrouwbaarheid(null);
  assert.equal(isOnbetrouwbaar('roas'), false);
});

test('een expliciet meegegeven oordeel wint van het actieve', async () => {
  const {zetBetrouwbaarheid, isOnbetrouwbaar} = await laad();
  zetBetrouwbaarheid(OORDEEL);
  const schoon = {beoordeeld: true, onbetrouwbareKpis: [], bevindingen: []};
  assert.equal(isOnbetrouwbaar('roas', schoon), false, 'een tabelrij kan zijn eigen klant meegeven');
});

/* --------------------------------------------- de kaart zelf -- */

const laadKaart = () => import('../../js/views/components.js');

test('een onbruikbare KPI draagt het voorbehoud op de kaart zelf', async () => {
  const {zetBetrouwbaarheid} = await laad();
  const {kpiMetriek} = await laadKaart();
  zetBetrouwbaarheid(OORDEEL);

  const html = kpiMetriek({roas: 0.22}, 'roas', {});
  assert.match(html, /kpi-voorbehoud/, 'de kaart is als geheel gemarkeerd');
  assert.match(html, /niet bruikbaar/);
  assert.match(html, /exact 1,00 per conversie/, 'met de reden erbij, niet alleen een waarschuwing');

  // Het cijfer blijft staan. Wie het in Google Ads ziet moet het hier
  // terugvinden; weglaten zou de vraag oproepen of het dashboard stuk is.
  assert.match(html, /0,22|0\.22/);
});

test('een KPI die wel klopt blijft onaangeroerd', async () => {
  const {zetBetrouwbaarheid} = await laad();
  const {kpiMetriek} = await laadKaart();
  zetBetrouwbaarheid(OORDEEL);

  const html = kpiMetriek({spend: 1200}, 'spend', {});
  assert.doesNotMatch(html, /kpi-voorbehoud/);
  assert.doesNotMatch(html, /niet bruikbaar/);
});

test('zonder oordeel krijgt geen enkele kaart een voorbehoud', async () => {
  const {zetBetrouwbaarheid} = await laad();
  const {kpiMetriek} = await laadKaart();
  zetBetrouwbaarheid(null);
  assert.doesNotMatch(kpiMetriek({roas: 0.22}, 'roas', {}), /kpi-voorbehoud/);
});

/* ------------------------------------- de juiste reden bij het juiste cijfer -- */

/** Een account waar tegelijk de teller en de waarde sneuvelen. */
const BEIDE_KAPOT = {
  beoordeeld: true,
  onbetrouwbareKpis: ['leads', 'cpl', 'cpa', 'conversieratio', 'revenue', 'roas'],
  bevindingen: [
    {
      code: 'zachte_signalen_tellen_mee', ernst: 'hoog',
      tekst: 'Routeklikken en winkelbezoeken tellen mee als conversie.',
      lagen: ['conversieteller'], raaktKpis: ['leads', 'purchases', 'conversieratio', 'cpl', 'cpa'],
    },
    {
      code: 'nominale_conversiewaarde', ernst: 'hoog',
      tekst: 'Vijftien campagnes op exact 1,00 per conversie.',
      lagen: ['conversiewaarde'], raaktKpis: ['revenue', 'roas'],
    },
  ],
};

test('geeft per cijfer de reden die er ook echt bij hoort', async () => {
  const {redenVoor} = await laad();
  // Beide bevindingen zijn 'hoog'; de volgorde mag niet bepalen wat er staat.
  assert.match(redenVoor('roas', BEIDE_KAPOT), /exact 1,00 per conversie/);
  assert.match(redenVoor('cpa', BEIDE_KAPOT), /Routeklikken/);
  assert.equal(redenVoor('cpc', BEIDE_KAPOT), null, 'CPC hangt aan geen van beide');
});

test('een oordeel van vóór deze toewijzing blijft werken', async () => {
  const {redenVoor} = await laad();
  const oud = {
    beoordeeld: true, onbetrouwbareKpis: ['roas'],
    bevindingen: [{code: 'nominale_conversiewaarde', ernst: 'hoog', tekst: 'Vaste waarde per conversie.'}],
  };
  assert.match(redenVoor('roas', oud), /Vaste waarde/);
});
