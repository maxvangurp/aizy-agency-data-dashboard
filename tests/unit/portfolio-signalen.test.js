const test = require('node:test');
const assert = require('node:assert/strict');

const {signalenVoor, zwaarste} = require('../../portfolio-signalen');

/** Een klant die het gewoon goed doet: één platform, genoeg dagen, stabiel. */
const SCHOON = {
  spend: 1000, conversions_primary: 50, cpa: 20,
  covered_days: 30, requested_days: 30,
  claiming_platforms: ['google-ads'], conversions_double_claimed: false,
};

const codes = (s) => s.map((x) => x.code);

test('een klant zonder bijzonderheden krijgt geen signalen', () => {
  // Een lege lijst is een antwoord. Wie altijd iets meldt, wordt genegeerd.
  assert.deepEqual(signalenVoor(SCHOON, SCHOON, []), []);
});

/* ------------------------------------------- conversies over platforms -- */

test('meldt het wanneer twee platforms allebei conversies claimen', () => {
  // Google en Meta tellen dezelfde aankoop allebei zodra iemand een
  // Instagram-advertentie ziet en daarna op de merknaam zoekt. Opgeteld is dat
  // een bovengrens, en dus een te lage CPA.
  const nu = {
    ...SCHOON,
    claiming_platforms: ['google-ads', 'meta-ads'],
    conversions_double_claimed: true,
  };
  const signaal = signalenVoor(nu, nu, []).find((s) => s.code === 'conversies_dubbel_geclaimd');

  assert.ok(signaal, 'het signaal hoort er te zijn');
  assert.match(signaal.detail, /google-ads en meta-ads/);
  assert.match(signaal.detail, /bovengrens/);
});

test('één claimend platform is geen dubbeltelling', () => {
  assert.ok(!codes(signalenVoor(SCHOON, SCHOON, [])).includes('conversies_dubbel_geclaimd'));
});

test('zonder het veld staat er niets, want dan is er niets vastgesteld', () => {
  // Zolang migratie 018 niet gedraaid is levert blended_kpis dit veld niet.
  // Dan is "geen melding" het juiste gedrag -- niet beoordeeld is iets anders
  // dan beoordeeld en in orde bevonden.
  const oud = {spend: 1000, conversions_primary: 50, cpa: 20, covered_days: 30, requested_days: 30};
  assert.ok(!codes(signalenVoor(oud, oud, [])).includes('conversies_dubbel_geclaimd'));
});

/* ------------------------------------------------------- stuurbaarheid -- */

test('een kapotte stuurmaat weegt zwaarder dan een dure conversie', () => {
  const nu = {...SCHOON, cpa: 40};
  const oordeel = [{unreliable_kpis: ['cpa'], findings: [{ernst: 'hoog', tekst: 'Nominale waarde.'}]}];
  const s = signalenVoor(nu, SCHOON, oordeel);

  assert.ok(codes(s).includes('niet_stuurbaar'));
  // En geen CPA-vergelijking: twee getallen vergelijken die allebei niets
  // zeggen levert een derde getal op dat ook niets zegt.
  assert.ok(!codes(s).includes('duurder'));
});

test('uitgaven zonder conversie is iets anders dan niet kunnen meten', () => {
  const nu = {...SCHOON, conversions_primary: 0, cpa: null};
  assert.ok(codes(signalenVoor(nu, SCHOON, [])).includes('geen_resultaat'));
  // Maar niet als de meting zelf stuk is: dan wéét je niet dat er niets was.
  const stuk = [{unreliable_kpis: ['cpa'], findings: []}];
  assert.ok(!codes(signalenVoor(nu, SCHOON, stuk)).includes('geen_resultaat'));
});

/* -------------------------------------------------------------- dekking -- */

test('gaten in de data zijn een bevinding over onszelf, niet over de klant', () => {
  const nu = {...SCHOON, covered_days: 20, requested_days: 30};
  const s = signalenVoor(nu, SCHOON, []).find((x) => x.code === 'gaten_in_data');
  assert.ok(s);
  assert.match(s.tekst, /20 van 30/);
});

/* ------------------------------------------------------------- sorteren -- */

test('zwaarste kent de volgorde en geeft nul bij geen signalen', () => {
  assert.equal(zwaarste([{ernst: 'laag'}, {ernst: 'hoog'}, {ernst: 'midden'}]), 3);
  assert.equal(zwaarste([{ernst: 'laag'}]), 1);
  assert.equal(zwaarste([]), 0);
  assert.equal(zwaarste(undefined), 0, 'een klant zonder signalenlijst valt niet om');
});
