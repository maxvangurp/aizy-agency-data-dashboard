import { test, expect } from '@playwright/test';
import { ACCOUNTS } from './helpers.js';

/**
 * Databronnen koppelen in de simpele modus — een gesimuleerde koppel-ervaring op
 * de data-provider-seam. Deze tests bewaken: de pagina + koppel-flow (koppelen /
 * bevestigen / ontkoppelen), persistentie in de demo-store, de statusweerspiegeling
 * in de kop, de eerlijke demolabeling (geen valse live-claim) en de assistent-hulp.
 */

async function simpelLogin(page, email) {
  await page.goto('/index.html');
  await page.evaluate(() => {
    localStorage.setItem('aizy.theme', 'light');
    localStorage.removeItem('aizy.session');
    localStorage.removeItem('aizy.state');
    Object.keys(localStorage).filter((k) => k.startsWith('aizy.demo.')).forEach((k) => localStorage.removeItem(k));
    window.location.hash = '#/login';
  });
  await page.reload();
  await page.waitForSelector('#startLoginForm');
  await page.fill('#startLoginForm [name="email"]', email);
  await page.fill('#startLoginForm [name="wachtwoord"]', 'demo123');
  await page.click('#startLoginForm button[type="submit"]');
  await page.waitForFunction(() => window.location.hash.includes('/pulse'));
  await page.waitForTimeout(600);
}

async function naar(page, label) {
  await page.click(`.simpel-nav-item:has-text("${label}")`);
  await page.waitForTimeout(500);
}

async function koppel(page, platform) {
  await page.click(`[data-databron-koppel="${platform}"]`);
  await page.waitForTimeout(150);
  await page.click(`[data-databron-bevestig="${platform}"]`);
  await page.waitForTimeout(350);
}

const metaKaart = (page) => page.locator('.databron-kaart').filter({ hasText: 'Meta Ads' });
const googleKaart = (page) => page.locator('.databron-kaart').filter({ hasText: 'Google Ads' });

test.describe('Simpele modus — databronnen koppelen (demo)', () => {
  test('de Databronnen-pagina toont beide platforms als demodata', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.medewerkerEcommerce);
    await expect(page.locator('.simpel-nav-item')).toHaveCount(9);
    await naar(page, 'Databronnen');
    await expect(page.locator('#simpelInhoud h1')).toHaveText('Databronnen');
    await expect(metaKaart(page)).toContainText('Demodata');
    await expect(googleKaart(page)).toContainText('Demodata');
  });

  test('koppelen verloopt via een bevestigstap en levert een als demo gelabelde status op', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.medewerkerEcommerce);
    await naar(page, 'Databronnen');
    // De bevestigstap is eerst verborgen.
    await expect(page.locator('[data-databron-bevestig="meta"]')).toBeHidden();
    await page.click('[data-databron-koppel="meta"]');
    await expect(page.locator('[data-databron-bevestig="meta"]')).toBeVisible();
    await page.click('[data-databron-bevestig="meta"]');
    await page.waitForTimeout(300);
    // Gekoppeld — maar eerlijk gelabeld als demo, met een expliciete voorbeelddata-claim.
    await expect(metaKaart(page)).toContainText('Gekoppeld (demo)');
    await expect(metaKaart(page)).toContainText('voorbeeldcijfers');
    await expect(googleKaart(page)).toContainText('Demodata');
    // Ontkoppelen draait het terug.
    await page.click('[data-databron-ontkoppel="meta"]');
    await page.waitForTimeout(300);
    await expect(metaKaart(page)).toContainText('Demodata');
  });

  test('een koppeling overleeft een herlading (demo-store)', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.medewerkerEcommerce);
    await naar(page, 'Databronnen');
    await koppel(page, 'google');
    await expect(googleKaart(page)).toContainText('Gekoppeld (demo)');
    await page.reload();
    await page.waitForFunction(() => window.location.hash.includes('/pulse'));
    await page.waitForTimeout(600);
    await expect(googleKaart(page)).toContainText('Gekoppeld (demo)');
    await expect(metaKaart(page)).toContainText('Demodata');
  });

  test('de databron-chip in de kop weerspiegelt de status en linkt naar de pagina', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.medewerkerEcommerce);
    // Zonder koppeling: demodata + link naar de databronnen-pagina.
    await expect(page.locator('.simpel-databron')).toContainText('Demodata');
    await expect(page.locator('.simpel-databron a[href="#/pulse/databronnen"]')).toBeVisible();
    // Deelkoppeling (1 van 2): ook deze staat blijft eerlijk gelabeld als demo.
    await naar(page, 'Databronnen');
    await koppel(page, 'meta');
    await naar(page, 'Totaal overzicht');
    await expect(page.locator('.simpel-databron')).toContainText('1 van 2 gekoppeld (demo)');
    await expect(page.locator('.simpel-databron')).toContainText('voorbeeldcijfers');
    // Beide koppelen → de chip wordt "Gekoppeld (demo)".
    await naar(page, 'Databronnen');
    await koppel(page, 'google');
    await naar(page, 'Totaal overzicht');
    await expect(page.locator('.simpel-databron')).toContainText('Gekoppeld (demo)');
    // Nooit een valse live-claim: de chip benoemt het als voorbeeldcijfers.
    await expect(page.locator('.simpel-databron')).toContainText('Voorbeeldcijfers');
  });

  test('de assistent legt "Demodata" eerlijk uit (geen metriek-fallback)', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.medewerkerEcommerce);
    await page.click('#assistentLauncher');
    await page.waitForTimeout(200);
    await page.fill('#assistentVraag', 'Wat betekent Demodata?');
    await page.locator('.assistent-invoer button[type="submit"]').click();
    await page.waitForTimeout(300);
    const antwoord = page.locator('.assistent-bericht.is-assistent .assistent-bel').last();
    await expect(antwoord).toContainText('voorbeelddata');
    await expect(antwoord).toContainText('gesimuleerd');
    // Niet de misleidende metriek-fallback.
    await expect(antwoord).not.toContainText('welke metriek');
  });

  test('de bevestigstap annuleren zet de toetsenbordfocus terug op "Koppelen"', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.medewerkerEcommerce);
    await naar(page, 'Databronnen');
    await page.click('[data-databron-koppel="meta"]');
    await page.waitForTimeout(120);
    await page.click('[data-databron-annuleer]');
    await page.waitForTimeout(120);
    const focus = await page.evaluate(() => document.activeElement?.getAttribute('data-databron-koppel'));
    expect(focus).toBe('meta');
  });

  test('de assistent wijst de weg naar databronnen en meldt de koppelstatus', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.medewerkerEcommerce);
    await naar(page, 'Databronnen');
    await page.click('#assistentLauncher');
    await page.waitForTimeout(200);
    // Het startscherm-inzicht meldt de (ontbrekende) koppelstatus — vóór een vraag,
    // want een vraag vervangt het startscherm door het gesprek.
    await expect(page.locator('.assistent-insight')).toContainText('Nog geen databronnen gekoppeld');
    // De vraag "Hoe koppel ik mijn data?" wijst naar de databronnen-pagina.
    await page.fill('#assistentVraag', 'Hoe koppel ik mijn data?');
    await page.locator('.assistent-invoer button[type="submit"]').click();
    await page.waitForTimeout(300);
    const laatste = page.locator('.assistent-bericht.is-assistent').last();
    await expect(laatste.locator('.assistent-acties a')).toHaveAttribute('href', '#/pulse/databronnen');
  });
});
