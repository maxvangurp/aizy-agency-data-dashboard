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

  test('de periodekiezer in de builder verandert de cijfers en het periodelabel live', async ({ page }) => {
    const fouten = foutenVerzamelen(page);
    await login(page, ACCOUNTS.admin);
    await openNieuweBouwer(page);

    const metaVoor = await page.locator('.rapport-meta').textContent();
    const kpiVoor = await page.locator('#rapportPreview .kpi-row .kpi').first().textContent();
    await page.selectOption('[data-rapport-periode]', 'last_7_days');
    await page.waitForTimeout(500);
    expect(await page.locator('.rapport-meta').textContent()).not.toBe(metaVoor);
    expect(await page.locator('#rapportPreview .kpi-row .kpi').first().textContent()).not.toBe(kpiVoor);
    expect(fouten, fouten.join('\n')).toEqual([]);
  });

  test('een aangepast datumbereik toont van/tot-velden in de builder', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await openNieuweBouwer(page);
    await expect(page.locator('[data-rapport-van]')).toHaveCount(0);
    await page.selectOption('[data-rapport-periode]', 'custom');
    await page.waitForTimeout(400);
    await expect(page.locator('[data-rapport-van]')).toBeVisible();
    await expect(page.locator('[data-rapport-tot]')).toBeVisible();
  });

  test('vergelijking uitzetten haalt het vergelijkingslabel weg', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await openNieuweBouwer(page);
    await expect(page.locator('.rapport-meta')).toContainText('vergeleken met');
    await page.selectOption('[data-rapport-vergelijking]', 'none');
    await page.waitForTimeout(500);
    await expect(page.locator('.rapport-meta')).not.toContainText('vergeleken met');
  });

  test('de rapportage toont automatische vervolgstappen die je kunt overschrijven', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await openNieuweBouwer(page);
    // Automatisch afgeleide stappen met bronvermelding naar het inzicht.
    expect(await page.locator('#rapportPreview .rapport-stap').count()).toBeGreaterThan(0);
    await expect(page.locator('#rapportPreview .rapport-stap-bron').first()).toContainText('Uit inzicht');
    // Zelf vastleggen: de tekst verschijnt als stap, zonder bronvermelding.
    await page.fill('[data-rapport-vervolgstappen]', 'Eigen stap één\nEigen stap twee');
    await page.waitForTimeout(400);
    expect(await page.locator('#rapportPreview .rapport-stap-tekst').allTextContents())
      .toEqual(['Eigen stap één', 'Eigen stap twee']);
    await expect(page.locator('#rapportPreview .rapport-stap-bron')).toHaveCount(0);
  });

  test('de vervolgstappen-editor toont beide knoppen en een vaste hint (geen desync)', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await openNieuweBouwer(page);
    // Beide knoppen staan er altijd, ongeacht auto/handmatig — de editor kan zo
    // niet uit de pas lopen met de preview.
    await expect(page.locator('[data-rapport-vervolg-vul]')).toBeVisible();
    await expect(page.locator('[data-rapport-vervolg-auto]')).toBeVisible();
    // Na inline typen (preview wordt handmatig) blijven beide knoppen staan.
    await page.fill('[data-rapport-vervolgstappen]', 'Eigen stap');
    await page.waitForTimeout(400);
    await expect(page.locator('#rapportPreview .rapport-stap-tekst')).toHaveText(['Eigen stap']);
    await expect(page.locator('[data-rapport-vervolg-auto]')).toBeVisible();
    // "Terug naar automatisch" herstelt de auto-afleiding.
    await page.click('[data-rapport-vervolg-auto]');
    await page.waitForTimeout(400);
    await expect(page.locator('[data-rapport-vervolgstappen]')).toHaveValue('');
    await expect(page.locator('#rapportPreview .rapport-stap-bron').first()).toContainText('Uit inzicht');
  });

  test('een klantwissel behoudt de gekozen periode', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await openNieuweBouwer(page);
    const klanten = await page.locator('[data-rapport-klant] option').count();
    test.skip(klanten < 2, 'minder dan twee klanten beschikbaar');
    await page.selectOption('[data-rapport-periode]', 'last_7_days');
    await page.waitForTimeout(400);
    const opties = await page.locator('[data-rapport-klant] option').all();
    const huidige = await page.locator('[data-rapport-klant]').inputValue();
    const andere = (await Promise.all(opties.map((o) => o.getAttribute('value')))).find((v) => v && v !== huidige);
    await page.selectOption('[data-rapport-klant]', andere);
    await page.waitForTimeout(500);
    // De gekozen periode blijft staan na de klantwissel.
    await expect(page.locator('[data-rapport-periode]')).toHaveValue('last_7_days');
  });

  test('de vervolgstappen-sectie is uit te zetten', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await openNieuweBouwer(page);
    await expect(page.locator('#rapportPreview .rapport-vervolg')).toBeVisible();
    await page.locator('[data-rapport-sectie="vervolgstappen"]').uncheck();
    await page.waitForTimeout(300);
    await expect(page.locator('#rapportPreview .rapport-vervolg')).toHaveCount(0);
  });

  test('de gekozen periode en vervolgstappen overleven opslaan en heropenen', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await openNieuweBouwer(page);
    await page.selectOption('[data-rapport-periode]', 'last_7_days');
    await page.waitForTimeout(400);
    await page.fill('[data-rapport-vervolgstappen]', 'Bewaarde eigen stap');
    await page.waitForTimeout(400);
    await page.fill('[data-rapport-titel]', 'Rapport met eigen periode');
    await page.waitForTimeout(300);
    await page.click('[data-rapport-opslaan]');
    await page.waitForTimeout(400);

    await ga(page, '#/agency/reports', { wacht: 500 });
    await page.click('.link', { hasText: 'Rapport met eigen periode' });
    await page.waitForTimeout(600);
    await expect(page.locator('[data-rapport-periode]')).toHaveValue('last_7_days');
    await expect(page.locator('[data-rapport-vervolgstappen]')).toHaveValue('Bewaarde eigen stap');
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
    await page.waitForSelector('#loginForm');
    await page.fill('#loginForm [name="email"]', email);
    await page.fill('#loginForm [name="wachtwoord"]', 'demo123');
    await page.click('#loginForm button[type="submit"]');
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
