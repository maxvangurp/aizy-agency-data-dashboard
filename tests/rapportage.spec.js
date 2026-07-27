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
