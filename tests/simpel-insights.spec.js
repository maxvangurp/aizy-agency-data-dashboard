import fs from 'node:fs';
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
  test('de KPI-band toont gekleurde delta-pills en een sparkline op elke kaart', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.medewerkerEcommerce);
    // Delta-pills: minstens een paar KPI's dragen een positieve/negatieve richting.
    const pills = await page.locator('.kpi-delta-pill.trend-positief, .kpi-delta-pill.trend-negatief').count();
    expect(pills).toBeGreaterThanOrEqual(3);
    // Elke KPI-kaart heeft een sparkline.
    const kaarten = await page.locator('.simpel-kpi .kpi').count();
    expect(await page.locator('.simpel-kpi .sparkline').count()).toBe(kaarten);
    // Alle KPI-kaarten zijn even hoog.
    const hoogtes = await page.evaluate(() =>
      [...new Set([...document.querySelectorAll('.simpel-kpi .kpi')].map((k) => Math.round(k.getBoundingClientRect().height)))]);
    expect(hoogtes).toHaveLength(1);
    // E-commerce toont omzet + ROAS.
    await expect(page.locator('.simpel-kpi')).toContainText('Omzet');
    await expect(page.locator('.simpel-kpi')).toContainText('ROAS');
  });

  test('een klik op een KPI-kaart wisselt de trendgrafiek (geen aparte switcher)', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.medewerkerEcommerce);
    const id = 'simpel-trend-overzicht';
    // Op het overzicht sturen de KPI's de grafiek; er is geen aparte switcher.
    await expect(page.locator('.metric-switch')).toHaveCount(0);
    // Startmetriek = uitgaven; die KPI-kaart is gemarkeerd en klikbaar.
    await expect(page.locator(`.simpel-kpi .kpi[data-simpel-metric="${id}:spend"]`)).toHaveClass(/is-actief/);
    await expect(page.locator(`.simpel-kpi .kpi[data-simpel-metric="${id}:spend"]`)).toHaveAttribute('role', 'button');
    // Klik op de Klikken-KPI: die wordt actief, uitgaven niet meer.
    await page.click(`.simpel-kpi .kpi[data-simpel-metric="${id}:clicks"]`);
    await page.waitForTimeout(300);
    await expect(page.locator(`.simpel-kpi .kpi[data-simpel-metric="${id}:clicks"]`)).toHaveClass(/is-actief/);
    await expect(page.locator(`.simpel-kpi .kpi[data-simpel-metric="${id}:clicks"]`)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator(`.simpel-kpi .kpi[data-simpel-metric="${id}:spend"]`)).not.toHaveClass(/is-actief/);
  });

  test('de metric-switcher op Trends wisselt de trendgrafiek', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.medewerkerEcommerce);
    await naar(page, 'Trends');
    const id = 'simpel-trend-trends';
    await expect(page.locator(`.metric-switch-knop[data-simpel-metric="${id}:spend"]`)).toHaveClass(/actief/);
    await page.click(`.metric-switch-knop[data-simpel-metric="${id}:clicks"]`);
    await page.waitForTimeout(300);
    await expect(page.locator(`.metric-switch-knop[data-simpel-metric="${id}:clicks"]`)).toHaveClass(/actief/);
    await expect(page.locator(`.metric-switch-knop[data-simpel-metric="${id}:spend"]`)).not.toHaveClass(/actief/);
  });

  test('de trendbron is per kanaal correct (Google Ads toont geen Meta)', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.medewerkerEcommerce);
    await naar(page, 'Google Ads');
    const bron = page.locator('.chart-figure:has(#simpel-trend-platform) .chart-source');
    await expect(bron).toContainText('Google Ads API');
    await expect(bron).not.toContainText('Meta');
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
    await expect(page.locator('#simpelInhoud')).toContainText('Conversie/klik');
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

  test('de periodekiezer, custom datumbereik en vergelijking werken', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.medewerkerEcommerce);
    await expect(page.locator('#filterPeriode')).toBeVisible();
    await expect(page.locator('#filterVergelijking')).toBeVisible();

    // Standaard: er zijn gevulde delta-pills, en de kop toont de vergelijkingsperiode.
    expect(await page.locator('.kpi-delta-pill:not(.is-leeg)').count()).toBeGreaterThanOrEqual(3);
    await expect(page.locator('.simpel-kop-meta')).toContainText('Vergeleken met');

    // Vergelijking met vorig jaar: de kop verwijst naar 2025.
    await page.selectOption('#filterVergelijking', 'previous_year');
    await page.waitForTimeout(600);
    await expect(page.locator('.simpel-kop-meta')).toContainText('2025');

    // Geen vergelijking: kop meldt het, en er staan geen gevulde delta-pills meer.
    await page.selectOption('#filterVergelijking', 'none');
    await page.waitForTimeout(600);
    await expect(page.locator('.simpel-kop-meta')).toContainText('Geen vergelijking');
    expect(await page.locator('.kpi-delta-pill:not(.is-leeg)').count()).toBe(0);

    // Aangepast datumbereik toont van/tot-velden.
    await page.selectOption('#filterPeriode', 'custom');
    await page.waitForTimeout(500);
    await expect(page.locator('#filterVan')).toBeVisible();
    await expect(page.locator('#filterTot')).toBeVisible();
  });

  test('op een lange periode valt de weekdag-uitsplitsing netjes weg (verdichte reeks)', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.medewerkerEcommerce);
    await page.selectOption('#filterPeriode', 'last_90_days');
    await page.waitForTimeout(700);
    // Gemiddeld per dag klopt met 90 dagen (niet met het aantal verdichte punten).
    await expect(page.locator('.budget-tempo')).toContainText('over 90 dagen');
    await naar(page, 'Segmenten');
    // Weekdaggrafiek is er niet bij een verdichte reeks; apparaat blijft wel.
    await expect(page.locator('#simpel-bar-weekdag')).toHaveCount(0);
    await expect(page.locator('#simpel-donut-devices')).toBeVisible();
  });

  test('de trend toont vorige-periode-kolommen die verdwijnen bij geen vergelijking', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.medewerkerEcommerce);
    const kolommen = () => page.evaluate(() => {
      const fig = document.getElementById('simpel-trend-overzicht')?.closest('.chart-figure');
      return fig ? [...fig.querySelectorAll('.chart-table thead th')].map((t) => t.textContent.trim()) : [];
    });
    // Standaard vergelijking = vorige periode → vorige-kolommen aanwezig.
    expect((await kolommen()).some((c) => /vorige/i.test(c))).toBe(true);
    await page.selectOption('#filterVergelijking', 'none');
    await page.waitForTimeout(600);
    expect((await kolommen()).some((c) => /vorige/i.test(c))).toBe(false);
  });

  test('de vergelijkingstabel op Trends toont delta-pills', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.medewerkerEcommerce);
    await naar(page, 'Trends');
    expect(await page.locator('#simpelInhoud .kpi-delta-pill').count()).toBeGreaterThanOrEqual(3);
  });

  test('er zijn meerdere auto-inzichten (primair + aanvullend als nette kaartjes)', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.medewerkerEcommerce);
    expect(await page.locator('.inzicht-kaart').count()).toBeGreaterThanOrEqual(2);
    await expect(page.locator('.inzicht-aanvullend')).toBeVisible();
    // De aanvullende bevindingen zijn nu compacte kaartjes met een categorie-badge,
    // niet meer een kale tekstlijst.
    await page.locator('.inzicht-aanvullend > summary').click();
    await page.waitForTimeout(200);
    expect(await page.locator('.inzicht-mini').count()).toBeGreaterThanOrEqual(1);
    await expect(page.locator('.inzicht-mini .badge').first()).toBeVisible();
  });

  test('print- en exportknop; export downloadt een CSV met ruwe (niet-opgemaakte) getallen', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.medewerkerEcommerce);
    await expect(page.locator('[data-simpel-print]')).toBeVisible();
    await naar(page, 'Google Ads');
    const [dl] = await Promise.all([
      page.waitForEvent('download'),
      page.click('[data-simpel-export-pagina]'),
    ]);
    expect(dl.suggestedFilename()).toMatch(/\.csv$/);
    // Ook de statische tabellen exporteren ruw: geen eurotekens of NL-duizendpunten
    // die een spreadsheet als tekst zou lezen.
    const csv = fs.readFileSync(await dl.path(), 'utf8');
    expect(csv).not.toContain('€');
    expect(csv).toMatch(/;\d+(\.\d+)?(\r?\n|;)/); // minstens één ruwe numerieke cel
  });

  test('een niet-bestaande KPI-metriek in de URL valt terug op uitgaven (grafiek matcht titel)', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.medewerker); // leadgen: geen ROAS-kaart
    await page.evaluate(() => { window.location.hash = '#/pulse?metric=roas'; });
    await page.waitForTimeout(800);
    await expect(page.locator('.simpel-kpi .kpi[data-simpel-metric="simpel-trend-overzicht:roas"]')).toHaveCount(0);
    await expect(page.locator('.simpel-kpi .kpi.is-actief[data-simpel-metric^="simpel-trend-overzicht:"]'))
      .toHaveAttribute('data-simpel-metric', 'simpel-trend-overzicht:spend');
    await expect(page.locator('.chart-figure:has(#simpel-trend-overzicht) figcaption p.muted')).toContainText('Uitgaven per dag');
  });

  test('de KPI-band toont een klik-hint en kondigt een metriekwissel aan (aria-live)', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.medewerkerEcommerce);
    await expect(page.locator('.kpi-band-hint')).toBeVisible();
    const live = page.locator('[data-trend-live]').first();
    await expect(live).toHaveAttribute('aria-live', 'polite');
    await page.click('.simpel-kpi .kpi[data-simpel-metric="simpel-trend-overzicht:clicks"]');
    await page.waitForTimeout(300);
    await expect(live).toContainText('Klikken per dag');
  });

  test('de gestapelde-uitgavengrafiek op Trends heeft een tekst-fallback', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.medewerkerEcommerce);
    await naar(page, 'Trends');
    const canvas = page.locator('#simpel-stacked-spend');
    await expect(canvas).toHaveAttribute('role', 'img');
    await expect(canvas).toHaveAttribute('aria-label', /gestapeld/i);
    await expect(page.locator('.card:has(#simpel-stacked-spend) details.chart-table table')).toHaveCount(1);
  });

  test('de Rapportage-knop opent een print-klare samenvatting met KPI\'s, inzichten en vervolgstappen', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.medewerkerEcommerce);
    await page.click('.simpel-topbar-acties a[href="#/pulse/rapportage"]');
    await page.waitForTimeout(700);
    await expect(page.locator('.simpel-rapport')).toBeVisible();
    // Kernsecties: KPI's, ontwikkelingsgrafiek en auto-inzichten.
    await expect(page.locator('.simpel-rapport .simpel-kpi .kpi').first()).toBeVisible();
    await expect(page.locator('#simpel-rapport-trend')).toBeVisible();
    expect(await page.locator('.simpel-rapport .inzicht-kaart').count()).toBeGreaterThanOrEqual(1);
    // De KPI's in het rapport zijn niet klikbaar (statische samenvatting).
    await expect(page.locator('.simpel-rapport .kpi.kpi-klik')).toHaveCount(0);
    await expect(page.locator('.simpel-rapport .kpi.is-actief')).toHaveCount(0);
    // Vervolgstappen, afgeleid uit de inzichten (met bronvermelding).
    expect(await page.locator('.simpel-rapport .rapport-stap').count()).toBeGreaterThanOrEqual(1);
    await expect(page.locator('.simpel-rapport .rapport-stap-bron').first()).toContainText('Uit inzicht');
    // Actiebalk: terug naar het dashboard + download/printen.
    await expect(page.locator('.simpel-rapport-balk a[href="#/pulse"]')).toBeVisible();
    await expect(page.locator('.simpel-rapport-balk [data-simpel-print]')).toBeVisible();
  });

  test('op een smal scherm dunt de trendgrafiek zijn datumlabels uit en staat de donut-legenda onderaan', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await simpelLogin(page, ACCOUNTS.medewerkerEcommerce);
    // Geen horizontale overloop op de trendpagina.
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)).toBe(false);
    // De lijn-as dunt uit (autoSkip) en houdt de datumlabels horizontaal (maxRotation 0).
    const lijn = await page.evaluate(() => {
      const c = window.Chart.getChart('simpel-trend-overzicht');
      return { autoSkip: c?.options?.scales?.x?.ticks?.autoSkip, maxRotation: c?.options?.scales?.x?.ticks?.maxRotation };
    });
    expect(lijn.autoSkip).toBe(true);
    expect(lijn.maxRotation).toBe(0);
    // De donut-legenda staat op mobiel onderaan (niet rechts, dat drukt de donut plat).
    const donutPos = await page.evaluate(() => window.Chart.getChart('simpel-donut-split')?.options?.plugins?.legend?.position);
    expect(donutPos).toBe('bottom');
  });

  test('op een ruim scherm staat de donut-legenda rechts', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.medewerkerEcommerce); // desktop-project = 1440
    const donutPos = await page.evaluate(() => window.Chart.getChart('simpel-donut-split')?.options?.plugins?.legend?.position);
    expect(donutPos).toBe('right');
  });

  test('de gekozen trend-metriek overleeft een herlaadactie via de URL', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.medewerkerEcommerce);
    await page.click('.simpel-kpi .kpi[data-simpel-metric="simpel-trend-overzicht:clicks"]');
    await page.waitForTimeout(300);
    expect(page.url()).toContain('metric=clicks');
    await page.reload();
    await page.waitForTimeout(900);
    await expect(page.locator('.simpel-kpi .kpi.is-actief[data-simpel-metric^="simpel-trend-overzicht:"]'))
      .toHaveAttribute('data-simpel-metric', 'simpel-trend-overzicht:clicks');
  });
});
