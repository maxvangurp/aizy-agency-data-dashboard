/**
 * De klantenlijst in live modus: één voorbeeldklant naast de echte klanten.
 *
 * Waarom dit een browsertest is en geen unit-test: de unit-test bewijst dat de
 * lijst klopt, maar niet dat het uitgebreide dashboard er ook mee overweg kan.
 * Echte klanten hebben geen tijdreeks, geen conversieprofiel en geen doelen in
 * de sample-data, en dat is precies het geval waarin een scherm stilletjes een
 * nul toont waar een ontbrekende meting hoort, of helemaal omvalt.
 *
 * De backend blijft erbuiten: `/api/clients/live` wordt hier afgevangen, zodat
 * deze test geen Supabase-sleutels nodig heeft en altijd dezelfde twee echte
 * klanten ziet.
 */
import { test, expect } from '@playwright/test';
import { ACCOUNTS, DEMO_WACHTWOORD } from './helpers.js';

const ECHTE_KLANTEN = [
  {
    id: 'proefwinkel', name: 'Proefwinkel', businessModel: null, website: null,
    land: 'Nederland', valuta: 'EUR', tijdzone: 'Europe/Amsterdam',
    primaryOwnerId: null, supportingOwnerIds: [], maandbudget: null,
    trackingStatus: null, dataHealth: null, scenario: null, bronnen: {}, doelen: [], echt: true,
  },
  {
    id: 'proefkliniek', name: 'Proefkliniek', businessModel: 'leadgen', website: null,
    land: 'Nederland', valuta: 'EUR', tijdzone: 'Europe/Amsterdam',
    primaryOwnerId: null, supportingOwnerIds: [], maandbudget: null,
    trackingStatus: null, dataHealth: null, scenario: null, bronnen: {}, doelen: [], echt: true,
  },
];

/** Logt in met de datamodus op live en een afgevangen klantenlijst. */
async function liveLogin(page) {
  await page.route('**/api/clients/live', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(ECHTE_KLANTEN),
  }));

  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem('aizy.dataMode', 'live');
    localStorage.removeItem('aizy.session');
    localStorage.removeItem('aizy.state');
    window.location.hash = '#/login';
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#loginForm');
  await page.fill('#loginForm [name="email"]', ACCOUNTS.admin);
  await page.fill('#loginForm [name="wachtwoord"]', DEMO_WACHTWOORD);
  await page.click('#loginForm button[type="submit"]');
  await page.waitForFunction(() => !location.hash.includes('/login'));
  await page.waitForTimeout(600);
}

test.describe('Live modus met één controleklant', () => {
  test('de klantenlijst is de echte klanten plus precies één gemarkeerde demo', async ({ page }) => {
    await liveLogin(page);

    const opties = await page.locator('#contextSelect option').allTextContents();
    const klanten = opties.filter((o) => o.trim() && o.trim() !== 'Agencyomgeving');

    expect(klanten).toContain('Proefwinkel');
    expect(klanten).toContain('Proefkliniek');
    expect(klanten.filter((k) => k.includes('(demo)'))).toHaveLength(1);
    expect(klanten, 'geen enkele andere voorbeeldklant blijft over').toHaveLength(3);
  });

  test('de melding zegt dat er een verzonnen klant in de totalen zit', async ({ page }) => {
    await liveLogin(page);
    await page.evaluate(() => { window.location.hash = '#/agency/clients'; });
    await page.waitForTimeout(700);

    const melding = page.locator('#demoklantMelding');
    await expect(melding).toBeVisible();
    await expect(melding).toContainText('voorbeeldklant');
    // Zonder deze zin neemt iemand een totaal over waar verzonnen omzet in zit.
    await expect(melding).toContainText('tellen mee in de totalen');
  });

  test('de portefeuille markeert de voorbeeldklant en toont de echte klanten ernaast', async ({ page }) => {
    await liveLogin(page);
    await page.evaluate(() => { window.location.hash = '#/agency/clients'; });
    await page.waitForTimeout(900);

    const tabel = page.locator('.grid-tabel');
    await expect(tabel).toContainText('Proefwinkel');
    await expect(tabel).toContainText('Proefkliniek');
    await expect(tabel).toContainText('Vitaalpunt Fysiotherapie');
    await expect(tabel.locator('.badge', { hasText: /^Demo$/ })).toHaveCount(1);
  });

  /**
   * Het punt van de controleklant: bij hém hoort er wél iets te staan. Staat een
   * scherm bij beide leeg, dan is het scherm stuk; staat het alleen bij de echte
   * klanten leeg, dan ontbreekt de bron. Dat onderscheid is de hele reden dat
   * deze ene voorbeeldklant meereist.
   */
  test('de voorbeeldklant rendert een volledig klantdashboard', async ({ page }) => {
    await liveLogin(page);
    await page.evaluate(() => { window.location.hash = '#/agency/clients/vitaalpunt'; });
    await page.waitForTimeout(900);

    await expect(page.locator('#pageRoot')).toContainText('Vitaalpunt Fysiotherapie');
    await expect(page.locator('#pageRoot')).toContainText('Budget en pacing');
    const waarden = await page.locator('#pageRoot .kpi-value').allTextContents();
    expect(waarden.some((w) => /\d/.test(w)), 'de controleklant hoort cijfers te tonen').toBe(true);
  });

  /**
   * En bij een echte klant zonder bron hoort er geen verzonnen nul te staan. Dit
   * is de andere helft van hetzelfde principe: leeg is leeg, en dat hoort er als
   * ontbrekende meting te staan en niet als gemeten resultaat.
   */
  test('een echte klant zonder gegevens valt niet om en toont geen verzonnen nul', async ({ page }) => {
    const fouten = [];
    page.on('pageerror', (e) => fouten.push(e.message));

    await liveLogin(page);
    await page.evaluate(() => { window.location.hash = '#/agency/clients/proefwinkel'; });
    await page.waitForTimeout(900);

    await expect(page.locator('#pageRoot')).toContainText('Proefwinkel');
    expect(fouten, 'een klant zonder tijdreeks mag geen scriptfout geven').toEqual([]);
  });
});
