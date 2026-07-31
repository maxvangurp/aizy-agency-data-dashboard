import { test, expect } from '@playwright/test';
import { login, ga, ACCOUNTS } from './helpers.js';

/**
 * Het gedeelde datagrid (agency: Klanten, Acties) wordt op mobiel een kaartenlijst
 * i.p.v. een brede scroll-tabel. Deze tests bewaken: kaarten + labels op mobiel,
 * behoud van sorteren via het mobiele sorteerbalkje, en een ongewijzigde
 * volwaardige tabel op desktop.
 */

const koppen = (page) => page.locator('.grid-tabel td.cel-primair')
  .evaluateAll((els) => els.slice(0, 3).map((e) => e.textContent.trim()));

test.describe('Datagrid — mobiele kaartweergave', () => {
  test('op mobiel wordt het agency-datagrid een kaartenlijst met labels', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/clients', { wacht: 800 });
    // Kaarten i.p.v. tabel: de kolomkoppen (thead) zijn verborgen, elke rij heeft een primaire kop.
    await expect(page.locator('.grid-tabel thead')).toBeHidden();
    expect(await page.locator('.grid-tabel td.cel-primair').count()).toBeGreaterThan(0);
    // Elke datacel draagt zijn kolomlabel via data-label (bron van de label/waarde-opmaak).
    const label = await page.locator('.grid-tabel td[data-label]:not(.cel-primair)').first().getAttribute('data-label');
    expect(label && label.length).toBeTruthy();
    // Kaartmodus: rijen worden blokken (kaarten) i.p.v. table-rows, en de
    // scroll-wrapper scrolt niet meer horizontaal (overflow-x: visible).
    const rijDisplay = await page.locator('.grid-tabel tbody tr').first().evaluate((el) => getComputedStyle(el).display);
    expect(rijDisplay).toBe('block');
    const scrollOverflow = await page.locator('.grid-scroll').evaluate((el) => getComputedStyle(el).overflowX);
    expect(scrollOverflow).toBe('visible');
  });

  test('op mobiel sorteert de kaartenlijst via het sorteerbalkje', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/clients', { wacht: 800 });
    await expect(page.locator('.grid-sorteer-mobiel')).toBeVisible();
    const voor = await koppen(page);
    await page.selectOption('[data-grid-sorteer-select]', { index: 2 });
    await page.waitForTimeout(500);
    const na = await koppen(page);
    expect(na).not.toEqual(voor);
    // De richtingknop keert de volgorde opnieuw om.
    await page.click('[data-grid-sorteer-richting]');
    await page.waitForTimeout(500);
    expect(await koppen(page)).not.toEqual(na);
  });

  test('op desktop blijft het een volwaardige tabel met kolomkoppen', async ({ page }) => {
    await login(page, ACCOUNTS.admin); // desktop-project = 1440px
    await ga(page, '#/agency/clients', { wacht: 800 });
    await expect(page.locator('.grid-tabel thead')).toBeVisible();
    await expect(page.locator('.grid-sorteer-mobiel')).toBeHidden();
  });
});
