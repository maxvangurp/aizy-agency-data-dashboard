import { test, expect } from '@playwright/test';
import { ACCOUNTS, foutenVerzamelen } from './helpers.js';

/**
 * De Aizy-assistent in de simpele modus (pulse-dashboard). Dezelfde assistent als
 * in het volledige systeem, maar met pulse-paginahulp en een live pulse-summary
 * (de echte Meta/Google-cijfers). Deze tests bewaken dat hij aanwezig is, de
 * pulse-pagina kent, ads-metrieken uitlegt en binnen de simpele modus navigeert.
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

async function openAssistent(page) {
  await page.click('#assistentLauncher');
  await page.waitForTimeout(200);
}

async function stelVraag(page, tekst) {
  await page.fill('#assistentVraag', tekst);
  await page.locator('.assistent-invoer button[type="submit"]').click();
  await page.waitForTimeout(300);
}

function laatsteAntwoord(page) {
  return page.locator('.assistent-bericht.is-assistent .assistent-bel').last();
}

function laatsteBericht(page) {
  return page.locator('.assistent-bericht.is-assistent').last();
}

test.describe('Aizy-assistent — simpele modus', () => {
  test('de launcher is aanwezig op het pulse-dashboard', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.medewerkerEcommerce);
    await expect(page.locator('#assistentLauncher')).toBeVisible();
  });

  test('het pagina-inzicht en de suggesties zijn pulse-specifiek met echte cijfers', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.medewerkerEcommerce);
    await openAssistent(page);
    // Het inzicht duidt de pulse-pagina én toont echte cijfers (uitgaven in euro's).
    await expect(page.locator('.assistent-insight')).toContainText('Meta & Google Ads');
    await expect(page.locator('.assistent-insight')).toContainText('€');
    // De suggesties gaan over de pulse-inhoud (optimalisaties), niet over agency-jargon.
    const vragen = (await page.locator('.assistent-start .assistent-chip').allTextContents()).join('|').toLowerCase();
    expect(vragen).toContain('optimalisatie');
    expect(vragen).not.toContain('signal');
  });

  test('een metriekvraag gebruikt de centrale metriekcatalogus', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.medewerkerEcommerce);
    await openAssistent(page);
    await stelVraag(page, 'Wat betekent ROAS?');
    await expect(laatsteAntwoord(page)).toContainText('Rendement op advertentie-uitgaven');
  });

  test('een samenvatting gebruikt de zichtbare pulse-cijfers', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.medewerkerEcommerce);
    await openAssistent(page);
    await stelVraag(page, 'Vat deze pagina samen');
    await expect(laatsteAntwoord(page)).toContainText('Uitgaven');
    await expect(laatsteAntwoord(page)).toContainText('zichtbare gegevens');
  });

  test('het inzicht volgt de actieve pulse-pagina', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.medewerkerEcommerce);
    await naar(page, 'Trends');
    await openAssistent(page);
    await expect(page.locator('.assistent-insight')).toContainText('ontwikkeling');
  });

  test('op de Google-/Meta-pagina is het inzicht platform-gescoopt (niet de combinatie)', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.medewerkerEcommerce);
    await openAssistent(page);
    // Overzicht: gecombineerd.
    await expect(page.locator('.assistent-insight')).toContainText('Meta & Google Ads');
    // Google-pagina: alleen Google, niet de combinatie.
    await naar(page, 'Google Ads');
    await expect(page.locator('.assistent-insight')).toContainText('Je bekijkt Google Ads');
    await expect(page.locator('.assistent-insight')).not.toContainText('Meta & Google');
    // Meta-pagina: alleen Meta.
    await naar(page, 'Meta Ads');
    await expect(page.locator('.assistent-insight')).toContainText('Je bekijkt Meta Ads');
    await expect(page.locator('.assistent-insight')).not.toContainText('Meta & Google');
  });

  test('het kostenlabel volgt het klanttype (lead vs. interactie)', async ({ page }) => {
    // De agencybeheerder kan in de simpele modus van klant wisselen.
    await simpelLogin(page, ACCOUNTS.admin);
    await openAssistent(page);
    // Awareness-klant: kosten per interactie, nooit de hardgecodeerde "per lead".
    await page.selectOption('[data-simpel-klant]', 'noordlicht');
    await page.waitForTimeout(700);
    await expect(page.locator('.assistent-insight')).toContainText('per interactie');
    await expect(page.locator('.assistent-insight')).not.toContainText('per lead');
    // Leadgen-klant: wél kosten per lead.
    await page.selectOption('[data-simpel-klant]', 'vitaalpunt');
    await page.waitForTimeout(700);
    await expect(page.locator('.assistent-insight')).toContainText('per lead');
    // E-commerce-klant: ROAS als rendement, geen kosten-per-regel.
    await page.selectOption('[data-simpel-klant]', 'tafelwerk');
    await page.waitForTimeout(700);
    await expect(page.locator('.assistent-insight')).toContainText('ROAS');
  });

  test('beantwoordt entiteitvragen over een specifieke campagne met een concreet cijfer', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.medewerkerEcommerce);
    await openAssistent(page);
    await stelVraag(page, 'Welke campagne is het duurst?');
    const antwoord = laatsteAntwoord(page);
    // Concreet: een campagnenaam (in aanhalingstekens), "het duurst" en een bedrag per resultaat.
    await expect(antwoord).toContainText('is het duurst');
    await expect(antwoord).toContainText('per aankoop');
    await expect(antwoord).toContainText('€');
    await expect(laatsteBericht(page).locator('.assistent-acties a')).toHaveAttribute('href', '#/pulse/campagnes');
  });

  test('beantwoordt segmentvragen (welk apparaat presteert het best)', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.medewerkerEcommerce);
    await openAssistent(page);
    await stelVraag(page, 'Welk apparaat presteert het best?');
    await expect(laatsteAntwoord(page)).toContainText('presteert het best');
    await expect(laatsteBericht(page).locator('.assistent-acties a')).toHaveAttribute('href', '#/pulse/segmenten');
  });

  test('draagt proactief de belangrijkste optimalisatie aan', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.medewerkerEcommerce);
    await openAssistent(page);
    await stelVraag(page, 'Welke optimalisatie pak ik op?');
    await expect(laatsteAntwoord(page)).toContainText('grootste kans');
    await expect(laatsteBericht(page).locator('.assistent-acties a')).toHaveAttribute('href', '#/pulse/optimalisaties');
  });

  test('een "beste campagne"-vraag geeft de meest efficiënte, niet de duurste', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.medewerkerEcommerce);
    await openAssistent(page);
    await stelVraag(page, 'Welke campagne presteert het best?');
    await expect(laatsteAntwoord(page)).toContainText('is het goedkoopst');
    await expect(laatsteAntwoord(page)).not.toContainText('is het duurst');
  });

  test('een segment zonder kostendata claimt geen efficiëntie ("het best")', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.admin);
    await page.selectOption('[data-simpel-klant]', 'vitaalpunt'); // leadgen: apparaten zonder spend
    await page.waitForTimeout(700);
    await openAssistent(page);
    await stelVraag(page, 'Welk apparaat presteert het best?');
    // Op louter volume zeggen we "levert het meeste", niet de sterkere efficiëntie-claim.
    await expect(laatsteAntwoord(page)).toContainText('levert het meeste');
    await expect(laatsteAntwoord(page)).not.toContainText('presteert het best');
  });

  test('valt eerlijk terug als een segment geen cijfers heeft (awareness-klant)', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.admin);
    await page.selectOption('[data-simpel-klant]', 'noordlicht');
    await page.waitForTimeout(700);
    await openAssistent(page);
    await stelVraag(page, 'Welk apparaat presteert het best?');
    await expect(laatsteAntwoord(page)).toContainText('geen apparaat-cijfers');
  });

  test('een vervolgactie blijft binnen de simpele modus', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.medewerkerEcommerce);
    await openAssistent(page);
    await stelVraag(page, 'Vat deze pagina samen');
    // De pulse-navactie leidt naar een pulse-pagina, niet het volledige systeem.
    await page.locator('.assistent-acties a', { hasText: 'optimalisaties' }).first().click();
    await page.waitForTimeout(400);
    expect(page.url()).toContain('/pulse/optimalisaties');
    expect(page.url()).not.toContain('/agency/');
  });

  test('geen enkele vervolgactie leidt uit de simpele modus (ook niet voor een agency-gebruiker)', async ({ page }) => {
    // Een agencybeheerder in de simpele modus: generieke intents (uitleg van
    // "betrouwbaarheid"/"budget pacing") mogen géén agency-route aandragen.
    await simpelLogin(page, ACCOUNTS.admin);
    await openAssistent(page);
    for (const vraag of ['Wat is betrouwbaarheid?', 'Wat is budget pacing?', 'Vat deze pagina samen', 'Waar moet ik eerst naar kijken?']) {
      await stelVraag(page, vraag);
    }
    // Alle aangeboden acties wijzen naar pulse-routes; niets naar agency/client.
    const hrefs = await page.locator('.assistent-acties a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      expect(href, `actie mag simpele modus niet verlaten: ${href}`).toMatch(/^#\/pulse\//);
    }
  });

  test('geen horizontale overloop met open paneel op mobiel', async ({ page }) => {
    const fouten = foutenVerzamelen(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await simpelLogin(page, ACCOUNTS.medewerkerEcommerce);
    await openAssistent(page);
    await stelVraag(page, 'Wat kan ik op deze pagina doen?');
    const overloop = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    );
    expect(overloop, 'horizontale overloop').toBe(false);
    expect(fouten, fouten.join('\n')).toEqual([]);
  });
});
