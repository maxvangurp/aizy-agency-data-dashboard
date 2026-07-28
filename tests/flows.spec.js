import { test, expect } from '@playwright/test';
import { login, ga, ACCOUNTS, foutenVerzamelen } from './helpers.js';

/**
 * De twee app-flows: 'simpel' (het datagerichte Meta/Google Ads-dashboard op
 * #/pulse) en 'uitgebreid' (het volledige systeem). De modus wordt bij inloggen
 * gekozen, per sessie bewaard, en met een guard afgedwongen.
 */

async function simpelLogin(page, email) {
  await page.goto('/index.html');
  await page.evaluate(() => {
    localStorage.setItem('aizy.theme', 'light');
    localStorage.removeItem('aizy.session');
    localStorage.removeItem('aizy.state');
    window.location.hash = '#/start';
  });
  await page.waitForSelector('#startLoginForm');
  await page.fill('#loginEmail', email);
  await page.fill('#loginWachtwoord', 'demo123');
  await page.click('#loginKnop');
  await page.waitForFunction(() => window.location.hash.includes('/pulse'));
}

test.describe('Twee flows — simpel en uitgebreid', () => {
  test('de simpele flow leidt naar het datagerichte pulse-dashboard', async ({ page }) => {
    const fouten = foutenVerzamelen(page);
    await simpelLogin(page, ACCOUNTS.admin);
    await page.waitForTimeout(600);

    expect(await page.evaluate(() => document.body.dataset.shell)).toBe('simpel');
    await expect(page.locator('.simpel-topbar')).toBeVisible();
    // Geen volledige sidebar-navigatie in de simpele modus.
    await expect(page.locator('.app-grid .sidebar')).toHaveCount(0);
    // De datagerichte inhoud is geladen (KPI's, Meta vs Google, campagnes).
    expect(await page.locator('.simpel-kpi .kpi').count()).toBeGreaterThanOrEqual(4);
    await expect(page.locator('#simpelInhoud')).toContainText('Meta & Google Ads');
    await expect(page.locator('#simpelInhoud')).toContainText('Campagnes');
    expect(fouten, fouten.join('\n')).toEqual([]);
  });

  test('de data komt via de seam (demodata-melding zichtbaar)', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.admin);
    await expect(page.locator('.simpel-databron')).toContainText('Demodata');
  });

  test('de uitgebreide flow leidt naar het volledige systeem', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    expect(page.url()).toContain('/agency/portfolio');
    expect(await page.evaluate(() => document.body.dataset.shell)).toBe('app');
    await expect(page.locator('.app-grid .sidebar')).toHaveCount(1);
  });

  test('een simpele gebruiker wordt van een volledige route teruggestuurd naar pulse', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.admin);
    await page.evaluate(() => { window.location.hash = '#/agency/portfolio'; });
    await page.waitForTimeout(500);
    expect(page.url()).toContain('/pulse');
    await expect(page.locator('.app-grid .sidebar')).toHaveCount(0);
  });

  test('de modus overleeft een herlaadactie', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.admin);
    await page.reload();
    await page.waitForTimeout(600);
    expect(page.url()).toContain('/pulse');
    expect(await page.evaluate(() => document.body.dataset.shell)).toBe('simpel');
  });

  test('wisselen tussen simpel en volledig werkt beide kanten op', async ({ page }) => {
    // Volledig → snel inzicht via het accountmenu.
    await login(page, ACCOUNTS.admin);
    await page.click('#accountKnop');
    await page.waitForTimeout(200);
    await page.click('[data-naar-modus="simpel"]');
    await page.waitForTimeout(700);
    expect(page.url()).toContain('/pulse');

    // Snel inzicht → volledig systeem via de topbar-knop.
    await page.click('[data-naar-modus="uitgebreid"]');
    await page.waitForTimeout(700);
    expect(page.url()).toContain('/agency/portfolio');
    expect(await page.evaluate(() => document.body.dataset.shell)).toBe('app');
  });

  test('de login-schermen linken naar elkaar', async ({ page }) => {
    await page.goto('/index.html');
    await page.evaluate(() => { localStorage.removeItem('aizy.session'); window.location.hash = '#/login'; });
    await page.waitForSelector('#loginForm');
    await expect(page.locator('.auth-flow-wissel a[href="#/start"]')).toBeVisible();

    await page.evaluate(() => { window.location.hash = '#/start'; });
    await page.waitForSelector('#startLoginForm');
    await expect(page.locator('.auth-flow-wissel a[href="#/login"]')).toBeVisible();
  });
});
