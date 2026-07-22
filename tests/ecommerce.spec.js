import { test, expect } from '@playwright/test';
import { login, ga, ACCOUNTS } from './helpers.js';

const ECOM_KLANTEN = ['tafelwerk', 'draadloos', 'kaapnoord'];

/** Zet de actieve klant en opent het klantdashboard binnen de agencyomgeving. */
async function openKlant(page, clientId, theme = 'light') {
  await login(page, ACCOUNTS.admin, { theme });
  await ga(page, `#/agency/clients/${clientId}`);
}

test.describe('E-commerce klantdashboard', () => {
  for (const clientId of ECOM_KLANTEN) {
    test(`${clientId} rendert alle onderdelen zonder fouten`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text());
      });

      await openKlant(page, clientId);

      // De e-commerce KPI's zijn zichtbaar, niet de leadgeneratie-KPI's.
      await expect(page.getByText('Omzet', { exact: true }).first()).toBeVisible();
      await expect(page.getByText('ROAS', { exact: true }).first()).toBeVisible();
      await expect(page.getByText('Gemiddelde orderwaarde')).toBeVisible();

      // De vaste secties bestaan.
      await expect(page.getByRole('heading', { name: 'E-commerce funnel' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Productfeed' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Zoekwoorden' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Organische resultaten' })).toBeVisible();

      expect(errors).toEqual([]);
    });
  }

  test('alle grafieken tekenen daadwerkelijk op het canvas', async ({ page }) => {
    await openKlant(page, 'tafelwerk');
    const canvasIds = ['chart-omzet-kosten', 'chart-roas', 'chart-funnel', 'chart-kanaal-omzet', 'chart-matchtype'];

    for (const id of canvasIds) {
      const heeftInhoud = await page.evaluate((canvasId) => {
        const c = document.getElementById(canvasId);
        if (!c) return false;
        const ctx = c.getContext('2d');
        const pixels = ctx.getImageData(0, 0, c.width, c.height).data;
        // Minstens een pixel moet niet volledig transparant zijn.
        for (let i = 3; i < pixels.length; i += 4) if (pixels[i] !== 0) return true;
        return false;
      }, id);
      expect(heeftInhoud, `${id} is leeg`).toBe(true);
    }
  });

  test('iedere grafiek heeft een tabelweergave en een bronvermelding', async ({ page }) => {
    await openKlant(page, 'tafelwerk');
    const figures = page.locator('.chart-figure');
    const aantal = await figures.count();
    expect(aantal).toBeGreaterThan(0);

    for (let i = 0; i < aantal; i++) {
      await expect(figures.nth(i).locator('.chart-table summary')).toBeVisible();
      await expect(figures.nth(i).locator('.chart-source')).toContainText('Bron:');
    }
  });

  test('categorie-assen tonen namen, geen bedragen', async ({ page }) => {
    await openKlant(page, 'tafelwerk');

    // De funnel-tabel bevat de stapnamen. Dit dekt de bug waarbij de
    // waardeopmaak op de categorie-as werd toegepast.
    await page.locator('#chart-funnel').locator('xpath=ancestor::figure').locator('summary').click();
    const funnelTabel = page.locator('#chart-funnel').locator('xpath=ancestor::figure').locator('table');
    await expect(funnelTabel).toContainText('Product bekeken');
    await expect(funnelTabel).toContainText('Aankoop');
  });

  test('grafieken worden opgeruimd bij het wisselen van scherm', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await openKlant(page, 'tafelwerk');
    // Meerdere keren heen en weer, om dubbele Chart.js-instanties uit te lokken.
    for (let i = 0; i < 3; i++) {
      await ga(page, '#/agency/overview', { wacht: 250 });
      await ga(page, '#/agency/clients/tafelwerk', { wacht: 450 });
    }
    await expect(page.locator('#chart-funnel')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('het bedrijfsmodel bepaalt welk dashboard verschijnt', async ({ page }) => {
    // E-commerce klant toont de funnel.
    await openKlant(page, 'tafelwerk');
    await expect(page.getByRole('heading', { name: 'E-commerce funnel' })).toBeVisible();

    // Leadgeneratie klant toont die funnel juist niet.
    await openKlant(page, 'vitaalpunt');
    await expect(page.getByRole('heading', { name: 'E-commerce funnel' })).toHaveCount(0);
    await expect(page.getByText('Kosten per lead').first()).toBeVisible();
  });

  test('het e-commerce dashboard werkt in donkere modus', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await openKlant(page, 'kaapnoord', 'dark');

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.getByRole('heading', { name: 'E-commerce funnel' })).toBeVisible();
    expect(errors).toEqual([]);
  });
});
