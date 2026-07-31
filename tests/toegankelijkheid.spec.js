import { test, expect } from '@playwright/test';
import { login, ga, ACCOUNTS } from './helpers.js';

/**
 * Toegankelijkheid (uit de a11y-audit). Deze tests bewaken de vier verholpen
 * bevindingen: focusbeheer van het detailpaneel-dialog, de ARIA-waarden op de
 * kolom-resize-greep, en de main-landmark. (Contrast/axe is los geverifieerd.)
 */

test.describe('Toegankelijkheid', () => {
  test('het detailpaneel krijgt focus bij openen en geeft hem terug bij sluiten', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/clients', { wacht: 800 });
    const trigger = page.locator('[data-klantpaneel]').first();
    const triggerId = await trigger.getAttribute('data-klantpaneel');
    await trigger.click();
    await page.waitForTimeout(400);
    // Bij openen landt de focus in de dialog.
    await expect(page.locator('#detailpaneel.is-open')).toBeVisible();
    expect(await page.evaluate(() => !!document.activeElement?.closest?.('#detailpaneel'))).toBe(true);
    // Escape sluit en zet de focus terug op het element dat het opende.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    await expect(page.locator('#detailpaneel.is-open')).toHaveCount(0);
    expect(await page.evaluate((id) => document.activeElement?.getAttribute?.('data-klantpaneel') === id, triggerId)).toBe(true);
  });

  test('de kolom-resize-greep draagt de vereiste ARIA-waarden', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/clients', { wacht: 800 });
    const greep = page.locator('.kolom-greep[role="separator"]').first();
    await expect(greep).toHaveAttribute('aria-valuenow', /^\d+$/);
    await expect(greep).toHaveAttribute('aria-valuemin', '72');
    await expect(greep).toHaveAttribute('aria-valuemax', '600');
  });

  test('de shell heeft precies één main-landmark', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/portfolio', { wacht: 700 });
    await expect(page.locator('main#pageRoot')).toHaveCount(1);
    await expect(page.locator('main')).toHaveCount(1);
  });
});
