import { test, expect } from '@playwright/test';
import { login, ga, ACCOUNTS, foutenVerzamelen } from './helpers.js';

/**
 * Het gesloten werkproces: signaal → beoordelen → actie → inplannen → uitvoeren →
 * resultaat controleren → oplossen of vervolgactie. Deze tests bewaken dat de drie
 * werkgebieden (Signalen, Acties, Planning) één traceerbare stroom vormen en dat
 * de harde regels gelden: geen dubbele actie, en een afgeronde actie sluit het
 * signaal nooit vanzelf.
 */

/** Opent een paneel voor een soort/id via de hash-router. */
async function openPaneel(page, tab, soort, id) {
  await ga(page, `#/agency/signals?tab=${tab}&panel=${soort}:${id}`, { wacht: 500 });
}

/** Zet een signaal om in een actie en geeft de nieuwe actie-id terug. */
async function maakActie(page, signaalId) {
  await page.locator(`.signaalkaart[data-signaal="${signaalId}"] [data-signaal-actie]`).click();
  await page.waitForTimeout(500);
  return page.evaluate(() => document.querySelector('.detailpaneel [data-actie-form]')?.getAttribute('data-actie-form'));
}

/** Zet de status van een actie via het detailpaneel. */
async function zetActieStatus(page, actieId, status) {
  await openPaneel(page, 'alle', 'actie', actieId);
  await page.selectOption('#paneelStatus', status);
  await page.locator('.detailpaneel [data-actie-form] button[type="submit"]').click();
  await page.waitForTimeout(500);
}

async function eersteNieuwSignaal(page) {
  await ga(page, '#/agency/signals?tab=nieuw', { wacht: 500 });
  return page.evaluate(() => document.querySelector('.signaalkaart')?.getAttribute('data-signaal'));
}

test.describe('Gesloten werkproces', () => {
  test('elk signaal toont een werkstroom met een duidelijke volgende stap', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/signals?tab=alle', { wacht: 600 });

    const kaarten = await page.locator('.signaalkaart').count();
    expect(kaarten).toBeGreaterThan(0);
    // Iedere kaart heeft een stappenbalk én een expliciete volgende stap.
    expect(await page.locator('.signaalkaart .werkstroom').count()).toBe(kaarten);
    const volgende = await page.locator('[data-volgende-stap]').first().textContent();
    expect(volgende).toContain('Volgende stap');
  });

  test('een signaal doorloopt de volledige stroom tot en met oplossen', async ({ page }) => {
    const fouten = foutenVerzamelen(page);
    await login(page, ACCOUNTS.admin);

    const signaalId = await eersteNieuwSignaal(page);
    expect(signaalId).toBeTruthy();

    // Actie aanmaken vanuit het signaal.
    const actieId = await maakActie(page, signaalId);
    expect(actieId).toBeTruthy();
    await expect(page.locator('.toast')).toContainText('Actie aangemaakt');

    // De actie draagt het signaal en waarschuwt dat afronden niet automatisch sluit.
    await openPaneel(page, 'alle', 'actie', actieId);
    await expect(page.locator('.detailpaneel')).toContainText('Volgt signaal op');
    await expect(page.locator('.detailpaneel')).toContainText('lost het signaal niet vanzelf op');

    // Vanuit het signaal is de gekoppelde actie zichtbaar en inplanbaar.
    await openPaneel(page, 'alle', 'signaal', signaalId);
    await expect(page.locator('.detailpaneel .gekoppeld-lijst li')).toHaveCount(1);
    await page.fill(`#planDatum-${signaalId}`, '2026-07-25');
    await page.locator('.detailpaneel [data-plan-form] button[type="submit"]').click();
    await page.waitForTimeout(400);
    await openPaneel(page, 'alle', 'signaal', signaalId);
    await expect(page.locator('.detailpaneel')).toContainText('Ingepland');

    // Actie uitvoeren (afronden) — het signaal sluit NIET vanzelf.
    await zetActieStatus(page, actieId, 'afgerond');
    await openPaneel(page, 'alle', 'signaal', signaalId);
    await expect(page.locator('.detailpaneel .paneel-labels')).toContainText('Wacht op controle');
    await expect(page.locator('.detailpaneel [data-beoordeel-form]')).toBeVisible();

    // Resultaat beoordelen → opgelost.
    await page.locator('.detailpaneel [data-signaal-beoordeel][data-uitkomst="opgelost"]').click();
    await page.waitForTimeout(400);
    await openPaneel(page, 'alle', 'signaal', signaalId);
    await expect(page.locator('.detailpaneel .paneel-labels')).toContainText('Opgelost');

    expect(fouten, fouten.join('\n')).toEqual([]);
  });

  test('een afgeronde actie sluit het signaal niet automatisch', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    const signaalId = await eersteNieuwSignaal(page);
    const actieId = await maakActie(page, signaalId);

    await zetActieStatus(page, actieId, 'afgerond');

    // Het signaal staat op "wacht op controle", niet op "opgelost".
    await ga(page, '#/agency/signals?tab=alle', { wacht: 500 });
    const status = await page.locator(`.signaalkaart[data-signaal="${signaalId}"]`).getAttribute('data-status');
    expect(status).toBe('wacht-op-controle');
  });

  test('een signaal krijgt geen tweede primaire actie bij nogmaals omzetten', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    const signaalId = await eersteNieuwSignaal(page);
    await maakActie(page, signaalId);

    // Nogmaals omzetten opent de bestaande actie in plaats van een tweede te maken.
    await openPaneel(page, 'alle', 'signaal', signaalId);
    await expect(page.locator('.detailpaneel .gekoppeld-lijst li')).toHaveCount(1);
    // De kaartknop opent nu de gekoppelde actie (geen nieuwe aanmaak-toast).
    await ga(page, '#/agency/signals?tab=alle', { wacht: 400 });
    await page.locator(`.signaalkaart[data-signaal="${signaalId}"] [data-signaal-actie]`).click();
    await page.waitForTimeout(400);
    await openPaneel(page, 'alle', 'signaal', signaalId);
    await expect(page.locator('.detailpaneel .gekoppeld-lijst li')).toHaveCount(1);
  });

  test('een resultaatcontrole verschijnt in de planning met de signaalkoppeling', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    const signaalId = await eersteNieuwSignaal(page);
    const actieId = await maakActie(page, signaalId);
    await zetActieStatus(page, actieId, 'afgerond');

    // Resultaatcontrole inplannen vanuit het signaalpaneel.
    await openPaneel(page, 'alle', 'signaal', signaalId);
    await page.fill(`#controleDatum-${signaalId}`, '2026-07-28');
    await page.locator('.detailpaneel [data-controle-form] button[type="submit"]').click();
    await page.waitForTimeout(400);

    // Het signaal toont de geplande controle.
    await openPaneel(page, 'alle', 'signaal', signaalId);
    await expect(page.locator('.detailpaneel')).toContainText('Resultaatcontrole');
  });

  test('de gedeelde tijdlijn legt de procesgebeurtenissen vast', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    const signaalId = await eersteNieuwSignaal(page);
    await maakActie(page, signaalId);

    await openPaneel(page, 'alle', 'signaal', signaalId);
    const tijdlijn = page.locator('.detailpaneel .tijdlijn li');
    // Minstens: signaal ontstaan + actie aangemaakt.
    expect(await tijdlijn.count()).toBeGreaterThanOrEqual(2);
    await expect(page.locator('.detailpaneel .tijdlijn')).toContainText('Actie aangemaakt');
  });

  test('een medewerker zonder recht kan het proces niet verwerken', async ({ page }) => {
    // De alleen-lezen klantgebruiker ziet geen signalencentrum en kan niets verwerken.
    await login(page, ACCOUNTS.klantViewer);
    await ga(page, '#/agency/signals', { wacht: 400 });
    // Geen toegang tot de agency-signaalpagina voor een klantgebruiker.
    await expect(page.locator('.signaalkaart')).toHaveCount(0);
  });
});
