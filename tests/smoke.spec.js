import { test, expect } from '@playwright/test';
import { login, ga, ACCOUNTS, foutenVerzamelen } from './helpers.js';

/**
 * Basistests voor stabiliteit.
 *
 * De navigatie verliep eerder via knoppen zonder inlog. Sinds de invoering
 * van accounts is er geen ongeauthenticeerde toegang meer, dus loggen deze
 * tests eerst in. De controles zelf zijn ongewijzigd.
 */

const AGENCY_ROUTES = [
  { hash: '#/agency/overview', kop: 'Portefeuilleoverzicht' },
  { hash: '#/agency/clients', kop: 'Klanten' },
  { hash: '#/agency/signals', kop: 'Signalen' },
  { hash: '#/agency/actions', kop: 'Acties' },
  { hash: '#/agency/team', kop: 'Team' },
  { hash: '#/agency/settings', kop: 'Instellingen' },
];

test.describe('Stabiliteit', () => {
  test('de applicatie laadt zonder console-fouten', async ({ page }) => {
    const errors = foutenVerzamelen(page);
    await login(page, ACCOUNTS.admin);

    await expect(page.locator('.sidebar .nav a')).toHaveCount(AGENCY_ROUTES.length);
    await expect(page.locator('.kpi-value').first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('iedere navigatielink rendert een scherm', async ({ page }) => {
    const errors = foutenVerzamelen(page);
    await login(page, ACCOUNTS.admin);

    for (const route of AGENCY_ROUTES) {
      await ga(page, route.hash);
      await expect(page.locator('#pageRoot h1')).toBeVisible();
      await expect(page.locator('#pageRoot h1')).toContainText(route.kop);
    }
    expect(errors).toEqual([]);
  });

  test('het thema wisselt en blijft bewaard na herladen', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    const html = page.locator('html');

    const start = await html.getAttribute('data-theme');
    await page.click('#accountKnop');
    await page.click('#menuThema');
    await page.waitForTimeout(300);

    const gewisseld = await html.getAttribute('data-theme');
    expect(gewisseld).not.toBe(start);

    await page.reload();
    await page.waitForTimeout(600);
    await expect(html).toHaveAttribute('data-theme', gewisseld);
  });

  test("tekst blijft leesbaar in beide thema's", async ({ page }) => {
    for (const theme of ['light', 'dark']) {
      await login(page, ACCOUNTS.admin, { theme });
      const kleuren = await page.evaluate(() => {
        const body = getComputedStyle(document.body);
        return { bg: body.backgroundColor, ink: body.color };
      });
      // Achtergrond en tekst mogen nooit dezelfde kleur zijn.
      expect(kleuren.bg).not.toBe(kleuren.ink);
    }
  });
});

test.describe('Backend', () => {
  test('onbekende API-routes geven JSON, geen HTML', async ({ request }) => {
    const response = await request.get('/api/bestaat-niet');
    expect(response.status()).toBe(404);
    expect(response.headers()['content-type']).toContain('application/json');
    const body = await response.json();
    expect(body.error).toBeTruthy();
  });

  test('de disconnect-route crasht niet meer', async ({ request }) => {
    const response = await request.post('/api/integrations/google/disconnect');
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ success: true });
  });
});

/**
 * De shell doet op dit moment geen API-aanroepen: alle demodata staat in de
 * bundel. De bescherming tegen een HTML-antwoord op een API-pad blijft wel
 * nodig zodra er weer een backend bij komt, dus safeFetchJson wordt hier
 * rechtstreeks getest in plaats van via de interface.
 */
test.describe('API-fallback', () => {
  test('een HTML-antwoord levert geen "Unexpected token" op', async ({ page }) => {
    const errors = foutenVerzamelen(page);
    await page.goto('/index.html');

    await page.route('**/api/**', (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<!DOCTYPE html><html><body>index</body></html>' })
    );

    const resultaat = await page.evaluate(async () => {
      const mod = await import('/js/data-provider.js');
      return mod.safeFetchJson('/api/overview');
    });

    expect(resultaat.status).toBe('error');
    expect(resultaat.message).toContain('webpagina');
    expect(errors.filter((e) => e.includes('Unexpected token'))).toEqual([]);
  });

  test('een serverfout levert een leesbare melding op', async ({ page }) => {
    const errors = foutenVerzamelen(page);
    await page.goto('/index.html');

    await page.route('**/api/**', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"Serverfout"}' })
    );

    const resultaat = await page.evaluate(async () => {
      const mod = await import('/js/data-provider.js');
      return mod.safeFetchJson('/api/overview');
    });

    expect(resultaat.status).toBe('error');
    expect(resultaat.message).toBeTruthy();
    expect(errors.filter((e) => e.includes('Unexpected token'))).toEqual([]);
  });

  test('een leeg antwoord wordt als leeg herkend, niet als fout', async ({ page }) => {
    await page.goto('/index.html');
    await page.route('**/api/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    );

    const resultaat = await page.evaluate(async () => {
      const mod = await import('/js/data-provider.js');
      return mod.safeFetchJson('/api/overview');
    });

    expect(resultaat.status).toBe('empty');
  });
});
