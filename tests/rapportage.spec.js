import { test, expect } from '@playwright/test';
import { login, ga, ACCOUNTS, foutenVerzamelen } from './helpers.js';

/**
 * De rapportage-builder. Aizy stelt een rapportage samen vóór een klant: kies
 * KPI's, inzichten en secties, met een live preview ernaast, en sla op. Deze
 * tests bewaken de kern: de builder komt op, de preview beweegt mee met de
 * keuzes, opslaan bewaart, en een klantgebruiker kan er niet bij.
 */

async function openNieuweBouwer(page) {
  await ga(page, '#/agency/reports', { wacht: 400 });
  await page.click('.rapport-lijst-kop a[href$="/agency/reports/new"]');
  await page.waitForTimeout(600);
}

test.describe('Rapportage-builder', () => {
  test('de rapportagepagina heeft een knop naar de builder', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/reports', { wacht: 400 });
    const knop = page.locator('.rapport-lijst-kop a', { hasText: 'Nieuwe rapportage' });
    await expect(knop).toBeVisible();
    await expect(knop).toHaveAttribute('href', /reports\/new/);
  });

  test('de builder toont opties en een live preview', async ({ page }) => {
    const fouten = foutenVerzamelen(page);
    await login(page, ACCOUNTS.admin);
    await openNieuweBouwer(page);

    await expect(page.locator('#rapportBouwer')).toBeVisible();
    await expect(page.locator('#rapportPreview')).toBeVisible();
    // Er zijn selecteerbare KPI's en inzichten, en de preview toont een titel.
    expect(await page.locator('[data-rapport-kpi]').count()).toBeGreaterThan(0);
    await expect(page.locator('.rapport-titel')).not.toHaveText('');
    expect(fouten, fouten.join('\n')).toEqual([]);
  });

  test('een KPI uitzetten verwijdert hem uit de preview', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await openNieuweBouwer(page);

    const voor = await page.locator('#rapportPreview .kpi-row .kpi').count();
    expect(voor).toBeGreaterThan(0);
    await page.locator('[data-rapport-kpi]').first().uncheck();
    await page.waitForTimeout(300);
    const na = await page.locator('#rapportPreview .kpi-row .kpi').count();
    expect(na).toBe(voor - 1);
  });

  test('de titel bewerken werkt live door in de preview', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await openNieuweBouwer(page);

    await page.fill('[data-rapport-titel]', 'Maandrapportage juli');
    await page.waitForTimeout(400);
    await expect(page.locator('.rapport-titel')).toHaveText('Maandrapportage juli');
  });

  test('een sectie uitzetten verwijdert hem uit de preview', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await openNieuweBouwer(page);

    // De samenwerkingssectie staat standaard aan; uitzetten haalt hem weg.
    await expect(page.locator('#rapportPreview')).toContainText('Samenwerking deze periode');
    await page.locator('[data-rapport-sectie="samenwerking"]').uncheck();
    await page.waitForTimeout(300);
    await expect(page.locator('#rapportPreview')).not.toContainText('Samenwerking deze periode');
  });

  test('opslaan bewaart de rapportage en toont hem in de lijst', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await openNieuweBouwer(page);

    await page.fill('[data-rapport-titel]', 'Opgeslagen testrapport');
    await page.waitForTimeout(300);
    await page.click('[data-rapport-opslaan]');
    await page.waitForTimeout(400);

    await ga(page, '#/agency/reports', { wacht: 400 });
    await expect(page.locator('.link', { hasText: 'Opgeslagen testrapport' })).toBeVisible();
  });

  test('een opgeslagen rapportage opent weer in de builder', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await openNieuweBouwer(page);
    await page.fill('[data-rapport-titel]', 'Heropenbaar rapport');
    await page.waitForTimeout(300);
    await page.click('[data-rapport-opslaan]');
    await page.waitForTimeout(400);

    await ga(page, '#/agency/reports', { wacht: 400 });
    await page.click('.link', { hasText: 'Heropenbaar rapport' });
    await page.waitForTimeout(500);
    await expect(page.locator('#rapportBouwer')).toBeVisible();
    await expect(page.locator('[data-rapport-titel]')).toHaveValue('Heropenbaar rapport');
  });

  test('een klantgebruiker kan de agency-builder niet openen', async ({ page }) => {
    await login(page, ACCOUNTS.klantAdmin);
    await ga(page, '#/agency/reports/new', { wacht: 400 });
    // De routeguard geeft geen toegang: de builder verschijnt niet.
    await expect(page.locator('#rapportBouwer')).toHaveCount(0);
    await expect(page.locator('.rapport-opties')).toHaveCount(0);
  });
});

test.describe('Rapportage delen met de klant', () => {
  // Maakt, benoemt en publiceert (of niet) een rapportage voor Vitaalpunt en
  // logt daarna in als die klant. De demo-opslag is per browsercontext gedeeld,
  // dus de gepubliceerde rapportage reist mee naar de klantsessie.
  async function maakRapportageVoorVitaalpunt(page, { titel, publiceer }) {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/reports/new', { wacht: 500 });
    await page.selectOption('[data-rapport-klant]', 'vitaalpunt');
    await page.waitForTimeout(500);
    await page.fill('[data-rapport-titel]', titel);
    await page.waitForTimeout(300);
    if (publiceer) {
      await page.click('[data-rapport-publiceer]');
      await page.waitForTimeout(400);
    } else {
      await page.click('[data-rapport-opslaan]');
      await page.waitForTimeout(400);
    }
  }

  async function herloginAls(page, email) {
    await page.evaluate(() => localStorage.removeItem('aizy.session'));
    await page.reload();
    await page.waitForSelector('#loginEmail');
    await page.fill('#loginEmail', email);
    await page.fill('#loginWachtwoord', 'demo123');
    await page.click('#loginKnop');
    await page.waitForFunction(() => !location.hash.includes('/login'));
  }

  test('publiceren zet de status op Gepubliceerd', async ({ page }) => {
    await maakRapportageVoorVitaalpunt(page, { titel: 'Gepubliceerd rapport', publiceer: true });
    await expect(page.locator('.rapport-status')).toContainText('Gepubliceerd');
  });

  test('de klant ziet een gepubliceerde rapportage en kan hem openen', async ({ page }) => {
    await maakRapportageVoorVitaalpunt(page, { titel: 'Rapport voor de klant', publiceer: true });
    await herloginAls(page, ACCOUNTS.klantAdmin);

    await ga(page, '#/client/report?tab=rapportages', { wacht: 500 });
    await expect(page.locator('#gepubliceerdeRapportages')).toBeVisible();
    await expect(page.locator('.rapport-deel-titel', { hasText: 'Rapport voor de klant' })).toBeVisible();

    await page.click('.rapport-deel-link');
    await page.waitForTimeout(600);
    await expect(page.locator('.rapport-weergave #rapportPreview')).toBeVisible();
    await expect(page.locator('.rapport-weergave')).toContainText('Downloaden / printen');
  });

  test('een niet-gepubliceerde rapportage ziet de klant niet', async ({ page }) => {
    await maakRapportageVoorVitaalpunt(page, { titel: 'Alleen concept', publiceer: false });
    await herloginAls(page, ACCOUNTS.klantAdmin);

    await ga(page, '#/client/report?tab=rapportages', { wacht: 500 });
    await expect(page.locator('.rapport-deel-titel', { hasText: 'Alleen concept' })).toHaveCount(0);
  });

  test('een niet-gepubliceerde rapportage is ook via de URL niet te openen', async ({ page }) => {
    await maakRapportageVoorVitaalpunt(page, { titel: 'Verborgen concept', publiceer: false });
    // Lees het id van de zojuist opgeslagen rapportage uit de opslag.
    const id = await page.evaluate(() => {
      const raw = localStorage.getItem('aizy.demo.rapportages');
      return raw ? JSON.parse(raw).data[0].id : null;
    });
    expect(id).toBeTruthy();

    await herloginAls(page, ACCOUNTS.klantAdmin);
    await ga(page, `#/client/report/${id}`, { wacht: 500 });
    await expect(page.locator('#rapportPreview')).toHaveCount(0);
    await expect(page.locator('.pagina-inhoud')).toContainText('niet gevonden');
  });
});
