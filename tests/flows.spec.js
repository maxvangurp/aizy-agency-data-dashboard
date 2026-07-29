import { test, expect } from '@playwright/test';
import { login, ACCOUNTS } from './helpers.js';

/**
 * De twee app-flows: 'simpel' (het datagerichte Meta/Google Ads-dashboard op
 * #/pulse, met een lichte linker-sidebar en zes datapagina's) en 'uitgebreid'
 * (het volledige systeem). De modus wordt bij inloggen gekozen op één scherm met
 * twee panelen naast elkaar, per sessie bewaard, en met een guard afgedwongen.
 */

/** Opent het inlogscherm met beide panelen, zonder in te loggen. */
async function openLogin(page) {
  await page.goto('/index.html');
  await page.evaluate(() => {
    localStorage.setItem('aizy.theme', 'light');
    localStorage.removeItem('aizy.session');
    localStorage.removeItem('aizy.state');
    window.location.hash = '#/login';
  });
  await page.reload();
  await page.waitForSelector('#startLoginForm');
}

/** Logt in via het linkerpaneel ("Snel inzicht", modus simpel). */
async function simpelLogin(page, email) {
  await openLogin(page);
  await page.fill('#startLoginForm [name="email"]', email);
  await page.fill('#startLoginForm [name="wachtwoord"]', 'demo123');
  await page.click('#startLoginForm button[type="submit"]');
  await page.waitForFunction(() => window.location.hash.includes('/pulse'));
  await page.waitForTimeout(500);
}

/** Navigeert binnen de simpele modus via een sidebar-navigatie-item. */
async function simpelNaar(page, label) {
  await page.click(`.simpel-nav-item:has-text("${label}")`);
  await page.waitForTimeout(500);
}

test.describe('Twee flows — inlogscherm met twee panelen', () => {
  test('het inlogscherm toont beide flows naast elkaar op één scherm', async ({ page }) => {
    await openLogin(page);
    // Twee echte formulieren naast elkaar.
    await expect(page.locator('#startLoginForm')).toBeVisible();
    await expect(page.locator('#loginForm')).toBeVisible();
    await expect(page.locator('.auth-keuze-grid')).toBeVisible();
    // Elk paneel heeft zijn eigen badge.
    await expect(page.locator('#startLoginForm')).toContainText('Snel inzicht');
    await expect(page.locator('#loginForm')).toContainText('Volledig systeem');
    // De gedeelde demo-accounts staan er één keer onder.
    await expect(page.locator('.demo-accounts')).toHaveCount(1);
  });

  test('#/start toont hetzelfde twee-panelen-scherm', async ({ page }) => {
    await page.goto('/index.html');
    await page.evaluate(() => { localStorage.removeItem('aizy.session'); window.location.hash = '#/start'; });
    await page.reload();
    await page.waitForSelector('#startLoginForm');
    await expect(page.locator('#loginForm')).toBeVisible();
  });

  test('een foutmelding verschijnt op het paneel waar je inlogde', async ({ page }) => {
    await openLogin(page);
    await page.fill('#startLoginForm [name="email"]', ACCOUNTS.admin);
    await page.fill('#startLoginForm [name="wachtwoord"]', 'fout-wachtwoord');
    await page.click('#startLoginForm button[type="submit"]');
    await page.waitForTimeout(400);
    // De banner staat binnen het simpele paneel, niet het volledige.
    await expect(page.locator('#startLoginForm .banner-danger')).toBeVisible();
    await expect(page.locator('#loginForm .banner-danger')).toHaveCount(0);
  });

  test('een demo-account vult beide formulieren tegelijk', async ({ page }) => {
    await openLogin(page);
    await page.click('.demo-account'); // eerste demo-account
    await page.waitForTimeout(150);
    expect(await page.inputValue('#startLoginForm [name="email"]')).not.toBe('');
    expect(await page.inputValue('#loginForm [name="email"]')).not.toBe('');
  });
});

test.describe('Twee flows — simpele modus (datadashboard)', () => {
  test('de simpele flow leidt naar het datagerichte pulse-dashboard met sidebar', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.admin);

    expect(await page.evaluate(() => document.body.dataset.shell)).toBe('simpel');
    await expect(page.locator('.simpel-sidebar')).toBeVisible();
    await expect(page.locator('.simpel-topbar')).toBeVisible();
    // Zes navigatie-items in de lichte sidebar.
    await expect(page.locator('.simpel-nav-item')).toHaveCount(7);
    // Geen volledige systeem-sidebar in de simpele modus.
    await expect(page.locator('.app-grid .sidebar')).toHaveCount(0);
    // De overzichtspagina toont de gecombineerde KPI-band.
    expect(await page.locator('.simpel-kpi .kpi').count()).toBeGreaterThanOrEqual(4);
  });

  test('de data komt via de seam (demodata-melding zichtbaar)', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.admin);
    await expect(page.locator('.simpel-databron')).toContainText('Demodata');
  });

  test('de sidebar navigeert tussen alle zeven datapagina\'s zonder fouten', async ({ page }) => {
    const fouten = [];
    page.on('pageerror', (e) => fouten.push(`pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') fouten.push(`console: ${m.text()}`); });

    await simpelLogin(page, ACCOUNTS.admin);

    const stappen = [
      { label: 'Google Ads', hash: '/pulse/google-ads', kop: 'Google Ads' },
      { label: 'Meta Ads', hash: '/pulse/meta-ads', kop: 'Meta Ads' },
      { label: 'Campagnes', hash: '/pulse/campagnes', kop: 'Campagnes' },
      { label: 'Conversies', hash: '/pulse/conversies', kop: 'Conversies' },
      { label: 'Segmenten', hash: '/pulse/segmenten', kop: 'Segmenten' },
      { label: 'Trends', hash: '/pulse/trends', kop: 'Trends' },
      { label: 'Totaal overzicht', hash: '/pulse', kop: 'Meta & Google Ads' },
    ];

    for (const stap of stappen) {
      await simpelNaar(page, stap.label);
      expect(page.url(), `route na ${stap.label}`).toContain(stap.hash);
      // Het actieve item is gemarkeerd.
      await expect(page.locator('.simpel-nav-item.actief')).toContainText(stap.label);
      // De inhoud van de pagina is geladen.
      await expect(page.locator('#simpelInhoud')).toContainText(stap.kop);
    }

    expect(fouten, fouten.join('\n')).toEqual([]);
  });

  test('de simpele modus blijft data-only (geen workflow-onderdelen in de sidebar)', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.admin);
    const navTekst = await page.locator('.simpel-sidebar').innerText();
    expect(navTekst).not.toMatch(/Planning|Acties|Signalen|Team/);
  });

  test('een gebruiker zonder klanten krijgt een lege staat, geen blijvende laadstaat', async ({ page }) => {
    // Tim is actief maar heeft geen klanttoewijzingen.
    await simpelLogin(page, ACCOUNTS.medewerkerZonderKlanten);
    await expect(page.locator('#simpelInhoud')).toContainText('Nog geen klanten');
    // De laadstaat mag niet blijven staan.
    await expect(page.locator('.simpel-laden')).toHaveCount(0);
    // Er is precies één h1 (de lege-staat-kop).
    await expect(page.locator('#simpelInhoud h1')).toHaveCount(1);
  });
});

test.describe('Twee flows — uitgebreide modus en guard', () => {
  test('de uitgebreide flow leidt naar het volledige systeem', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    expect(page.url()).toContain('/agency/portfolio');
    expect(await page.evaluate(() => document.body.dataset.shell)).toBe('app');
    await expect(page.locator('.app-grid .sidebar')).toHaveCount(1);
  });

  test('een simpele gebruiker wordt van een volledige route teruggestuurd naar pulse', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.admin);
    await page.evaluate(() => { window.location.hash = '#/agency/portfolio'; });
    await page.waitForTimeout(500);
    expect(page.url()).toContain('/pulse');
    await expect(page.locator('.app-grid .sidebar')).toHaveCount(0);
  });

  test('alle #/pulse/* datapagina\'s blijven bereikbaar in de simpele modus', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.admin);
    for (const hash of ['#/pulse/google-ads', '#/pulse/meta-ads', '#/pulse/campagnes', '#/pulse/conversies', '#/pulse/segmenten', '#/pulse/trends']) {
      await page.evaluate((h) => { window.location.hash = h; }, hash);
      await page.waitForTimeout(400);
      expect(page.url()).toContain(hash.slice(1));
      await expect(page.locator('.simpel-sidebar')).toBeVisible();
    }
  });

  test('de modus overleeft een herlaadactie', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.admin);
    await page.reload();
    await page.waitForTimeout(600);
    expect(page.url()).toContain('/pulse');
    expect(await page.evaluate(() => document.body.dataset.shell)).toBe('simpel');
  });

  test('wisselen tussen simpel en volledig werkt beide kanten op', async ({ page }) => {
    // Volledig → snel inzicht via het accountmenu.
    await login(page, ACCOUNTS.admin);
    await page.click('#accountKnop');
    await page.waitForTimeout(200);
    await page.click('[data-naar-modus="simpel"]');
    await page.waitForTimeout(700);
    expect(page.url()).toContain('/pulse');

    // Snel inzicht → volledig systeem via de knop onderin de sidebar.
    await page.click('.simpel-sidebar [data-naar-modus="uitgebreid"]');
    await page.waitForTimeout(700);
    expect(page.url()).toContain('/agency/portfolio');
    expect(await page.evaluate(() => document.body.dataset.shell)).toBe('app');
  });
});
