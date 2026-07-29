import { test, expect } from '@playwright/test';
import { ACCOUNTS } from './helpers.js';

/**
 * De rijke data-inzichten van het simpele dashboard: delta-KPI's met sparklines,
 * de metric-switcher, interactieve tabellen (sorteren/zoeken/CSV), de platform-
 * filter, donut/funnel-visualisaties, de Segmenten-pagina en de auto-inzichten.
 */

async function simpelLogin(page, email) {
  await page.goto('/index.html');
  await page.evaluate(() => {
    localStorage.setItem('aizy.theme', 'light');
    localStorage.removeItem('aizy.session');
    localStorage.removeItem('aizy.state');
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

test.describe('Simpel dashboard — rijke inzichten', () => {
  test('de KPI-band toont vergelijking met de vorige periode en sparklines', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.medewerkerEcommerce);
    // Delta's: minstens een paar KPI's dragen een positieve/negatieve richting.
    const deltas = await page.locator('.simpel-kpi .kpi-sub.trend-positief, .simpel-kpi .kpi-sub.trend-negatief').count();
    expect(deltas).toBeGreaterThanOrEqual(3);
    // Sparklines onder de KPI's.
    expect(await page.locator('.simpel-kpi .sparkline').count()).toBeGreaterThanOrEqual(1);
    // E-commerce toont omzet + ROAS.
    await expect(page.locator('.simpel-kpi')).toContainText('Omzet');
    await expect(page.locator('.simpel-kpi')).toContainText('ROAS');
  });

  test('de metric-switcher wisselt de trendgrafiek', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.medewerkerEcommerce);
    const id = 'simpel-trend-overzicht';
    await expect(page.locator(`.metric-switch-knop[data-simpel-metric="${id}:spend"]`)).toHaveClass(/actief/);
    await page.click(`[data-simpel-metric="${id}:clicks"]`);
    await page.waitForTimeout(300);
    await expect(page.locator(`.metric-switch-knop[data-simpel-metric="${id}:clicks"]`)).toHaveClass(/actief/);
    await expect(page.locator(`.metric-switch-knop[data-simpel-metric="${id}:spend"]`)).not.toHaveClass(/actief/);
  });

  test('een donut en tabelweergave staan op het totaaloverzicht', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.medewerkerEcommerce);
    await expect(page.locator('#simpel-donut-split')).toBeVisible();
    await expect(page.locator('#simpelInhoud')).toContainText('Verdeling uitgaven');
    // Auto-inzichten met bewijs.
    await expect(page.locator('#simpelInhoud')).toContainText('Wat valt op');
    expect(await page.locator('.inzicht-kaart').count()).toBeGreaterThanOrEqual(1);
    await expect(page.locator('.inzicht-kaart').first()).toContainText('Bewijs');
  });

  test('de campagnetabel is sorteerbaar, doorzoekbaar en filterbaar op platform', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.medewerkerEcommerce);
    await naar(page, 'Campagnes');
    const eersteKolom = () => page.evaluate(() =>
      [...document.querySelectorAll('#campagnes-alle tbody tr:not([hidden]) td:first-child')].map((td) => td.textContent.trim()));

    // Sorteren op uitgaven (aflopend na twee klikken).
    await page.click('#campagnes-alle .ia-sort:has-text("Uitgaven")');
    await page.click('#campagnes-alle .ia-sort:has-text("Uitgaven")');
    await page.waitForTimeout(200);
    const gesorteerd = await page.evaluate(() =>
      [...document.querySelectorAll('#campagnes-alle tbody tr:not([hidden])')].map((r) => Number(r.cells[2].dataset.v)));
    const aflopend = [...gesorteerd].sort((a, b) => b - a);
    expect(gesorteerd).toEqual(aflopend);

    // Platform-chip: alleen Meta.
    await page.click('[data-simpel-filter="campagnes-alle:meta"]');
    await page.waitForTimeout(150);
    const platforms = await page.evaluate(() =>
      [...new Set([...document.querySelectorAll('#campagnes-alle tbody tr:not([hidden])')].map((r) => r.dataset.platform))]);
    expect(platforms).toEqual(['Meta Ads']);

    // Terug naar alle, dan zoeken.
    await page.click('[data-simpel-filter="campagnes-alle:alle"]');
    await page.fill('#campagnes-alle .ia-zoek', 'zzz-bestaat-niet');
    await page.waitForTimeout(150);
    expect((await eersteKolom()).length).toBe(0);
    await expect(page.locator('#campagnes-alle .ia-leeg')).toBeVisible();
  });

  test('de CSV-exportknop is aanwezig op de campagnetabel', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.medewerkerEcommerce);
    await naar(page, 'Campagnes');
    await expect(page.locator('#campagnes-alle .ia-export')).toBeVisible();
  });

  test('de Conversies-pagina toont een visuele funnel en een donut', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.medewerkerEcommerce);
    await naar(page, 'Conversies');
    await expect(page.locator('#simpel-funnel')).toBeVisible();
    await expect(page.locator('#simpel-donut-conversies')).toBeVisible();
    await expect(page.locator('#simpelInhoud')).toContainText('Conversieratio');
  });

  test('de Segmenten-pagina toont apparaat en weekdag', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.medewerkerEcommerce);
    await naar(page, 'Segmenten');
    await expect(page.locator('#simpelInhoud')).toContainText('Apparaat');
    await expect(page.locator('#simpel-donut-devices')).toBeVisible();
    await expect(page.locator('#simpel-bar-weekdag')).toBeVisible();
  });

  test('een leadgenklant toont regio op Segmenten en Leads-KPI\'s', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.medewerker); // Berry: leadgenklanten
    await expect(page.locator('.simpel-kpi')).toContainText('Leads');
    await naar(page, 'Segmenten');
    await expect(page.locator('#simpel-bar-regio')).toBeVisible();
  });
});
