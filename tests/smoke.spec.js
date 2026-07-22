import { test, expect } from '@playwright/test';

const PAGES = ['overview', 'customers', 'channels', 'actions', 'integration'];

/** Verzamelt console-fouten en mislukte verzoeken tijdens een test. */
function attachErrorCollector(page) {
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('requestfailed', (req) => {
    // Afgebroken navigatieverzoeken zijn niet relevant.
    if (req.failure()?.errorText !== 'net::ERR_ABORTED') {
      errors.push(`requestfailed: ${req.url()} ${req.failure()?.errorText}`);
    }
  });
  return errors;
}

test.describe('Fase 1 stabiliteit', () => {
  test('de applicatie laadt zonder console-fouten', async ({ page }) => {
    const errors = attachErrorCollector(page);
    await page.goto('/index.html');
    await expect(page.locator('#nav button')).toHaveCount(PAGES.length);
    await expect(page.locator('.kpi-value').first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('iedere navigatielink rendert een scherm', async ({ page }) => {
    const errors = attachErrorCollector(page);
    await page.goto('/index.html');
    for (const id of PAGES) {
      await page.click(`#nav button[data-page="${id}"]`);
      await expect(page.locator('#pageRoot h1')).toBeVisible();
      await expect(page.locator(`#nav button[data-page="${id}"]`)).toHaveClass(/active/);
    }
    expect(errors).toEqual([]);
  });

  test('het thema wisselt en blijft bewaard na herladen', async ({ page }) => {
    await page.goto('/index.html');
    const html = page.locator('html');

    const start = await html.getAttribute('data-theme');
    await page.click('#themeBtn');
    const gewisseld = await html.getAttribute('data-theme');
    expect(gewisseld).not.toBe(start);

    await page.reload();
    await expect(html).toHaveAttribute('data-theme', gewisseld);
  });

  test('tekst blijft leesbaar in beide thema\'s', async ({ page }) => {
    for (const theme of ['light', 'dark']) {
      await page.goto('/index.html');
      await page.evaluate((t) => {
        localStorage.setItem('aizy.theme', t);
      }, theme);
      await page.reload();

      const contrast = await page.evaluate(() => {
        const body = getComputedStyle(document.body);
        return { bg: body.backgroundColor, ink: body.color };
      });
      // Achtergrond en tekst mogen nooit dezelfde kleur zijn.
      expect(contrast.bg).not.toBe(contrast.ink);
    }
  });

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

test.describe('Fase 1 fallback zonder backend', () => {
  test('geen "Unexpected token" bij een HTML-antwoord op een API-pad', async ({ page }) => {
    const errors = attachErrorCollector(page);

    // Simuleer GitHub Pages: iedere API-aanroep geeft de index.html terug.
    await page.route('**/api/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<!DOCTYPE html><html><body>index</body></html>',
      })
    );

    await page.goto('/index.html');
    await page.evaluate(() => localStorage.setItem('aizy.dataMode', 'live'));
    await page.reload();
    await page.waitForTimeout(500);

    const unexpectedToken = errors.filter((e) => e.includes('Unexpected token'));
    expect(unexpectedToken).toEqual([]);

    // De gebruiker krijgt een begrijpelijke melding in plaats van een lege pagina.
    await expect(page.locator('.banner-danger')).toBeVisible();
  });

  test('een serverfout levert een leesbare melding op', async ({ page }) => {
    const errors = attachErrorCollector(page);
    await page.route('**/api/**', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"Serverfout"}' }));

    await page.goto('/index.html');
    await page.evaluate(() => localStorage.setItem('aizy.dataMode', 'live'));
    await page.reload();
    await page.waitForTimeout(500);

    await expect(page.locator('.banner-danger')).toBeVisible();
    expect(errors.filter((e) => e.includes('Unexpected token'))).toEqual([]);
  });
});
