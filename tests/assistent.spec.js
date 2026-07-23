import { test, expect } from '@playwright/test';
import { login, ga, ACCOUNTS, foutenVerzamelen } from './helpers.js';

/**
 * De contextbewuste Aizy-assistent. Deze tests bewaken de kern: de assistent is
 * op elke pagina bereikbaar, kent de context, geeft deterministische demo-
 * antwoorden zonder een echte API te suggereren, en gebruikt bestaande routes en
 * rechten voor vervolgacties.
 */

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

test.describe('Aizy-assistent — launcher en paneel', () => {
  test('de launcher is op verschillende pagina’s bereikbaar', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    for (const route of ['#/agency/portfolio', '#/agency/signals', '#/agency/budgets']) {
      await ga(page, route, { wacht: 400 });
      await expect(page.locator('#assistentLauncher')).toBeVisible();
    }
  });

  test('het paneel opent en sluit', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await openAssistent(page);
    await expect(page.locator('#assistentPaneel')).toBeVisible();
    await page.click('[data-assistent="sluit"]');
    await page.waitForTimeout(200);
    await expect(page.locator('#assistentPaneel')).toHaveCount(0);
  });

  test('het paneel kan worden vastgezet en de voorkeur blijft na navigatie behouden', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await openAssistent(page);
    await page.click('[data-assistent="pin"]');
    await page.waitForTimeout(300);
    await expect(page.locator('.assistent-paneel.is-vastgezet')).toBeVisible();
    expect(await page.evaluate(() => document.body.dataset.assistent)).toBe('vast');

    await ga(page, '#/agency/signals', { wacht: 400 });
    await expect(page.locator('.assistent-paneel.is-vastgezet')).toBeVisible();
  });

  test('de launcher is met het toetsenbord te bedienen en Escape sluit het paneel', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await page.focus('#assistentLauncher');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    await expect(page.locator('#assistentPaneel')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await expect(page.locator('#assistentPaneel')).toHaveCount(0);
  });
});

test.describe('Aizy-assistent — context en antwoorden', () => {
  test('de paginasuggesties verschillen per pagina', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/signals', { wacht: 400 });
    await openAssistent(page);
    const signaalVragen = (await page.locator('.assistent-start .assistent-chip').allTextContents()).join('|');

    await ga(page, '#/agency/budgets', { wacht: 400 });
    const budgetVragen = (await page.locator('.assistent-start .assistent-chip').allTextContents()).join('|');

    expect(signaalVragen).not.toBe(budgetVragen);
    expect(signaalVragen.toLowerCase()).toContain('signal');
    expect(budgetVragen.toLowerCase()).toContain('budget');
  });

  test('het pagina-inzicht weerspiegelt de huidige pagina', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/signals', { wacht: 400 });
    await openAssistent(page);
    await expect(page.locator('.assistent-insight')).toContainText('signalen');
  });

  test('een metriekvraag gebruikt de centrale metriekcatalogus', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/campaigns', { wacht: 400 });
    await openAssistent(page);
    await stelVraag(page, 'Wat betekent ROAS?');
    await expect(laatsteAntwoord(page)).toContainText('Rendement op advertentie-uitgaven');
  });

  test('een samenvatting gebruikt de zichtbare cijfers van de pagina', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/signals', { wacht: 400 });
    await openAssistent(page);
    await stelVraag(page, 'Vat deze pagina samen');
    await expect(laatsteAntwoord(page)).toContainText('nieuwe signalen');
    // De demo maakt duidelijk dat hij alleen de zichtbare gegevens gebruikt.
    await expect(laatsteAntwoord(page)).toContainText('zichtbare gegevens');
  });

  test('een onbekende vraag geeft een eerlijke fallback zonder verzonnen antwoord', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await openAssistent(page);
    await stelVraag(page, 'Bestel een pizza met ananas');
    await expect(laatsteAntwoord(page)).toContainText('demoversie nog niet');
  });

  test('dezelfde vraag geeft in dezelfde context hetzelfde antwoord', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/signals', { wacht: 400 });
    await openAssistent(page);
    await stelVraag(page, 'Waar moet ik eerst naar kijken?');
    await stelVraag(page, 'Waar moet ik eerst naar kijken?');
    const antwoorden = await page.locator('.assistent-bericht.is-assistent .assistent-bel p').allInnerTexts();
    const laatsteTwee = antwoorden.slice(-2);
    expect(laatsteTwee[0]).toBe(laatsteTwee[1]);
  });

  test('een vervolgactie opent de juiste route', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/signals', { wacht: 400 });
    await openAssistent(page);
    await stelVraag(page, 'Waar moet ik eerst naar kijken?');
    await page.locator('.assistent-acties a', { hasText: 'actie nodig' }).first().click();
    await page.waitForTimeout(300);
    expect(page.url()).toContain('tab=actie_nodig');
  });
});

test.describe('Aizy-assistent — integratie en rechten', () => {
  test('de Aizy AI-assistent staat op Integraties met status Demo actief', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/integrations', { wacht: 500 });
    const kaart = page.locator('.assistent-integratie');
    await expect(kaart).toBeVisible();
    await expect(kaart).toContainText('Aizy AI-assistent');
    await expect(kaart).toContainText('Demo actief');
  });

  test('de assistent-instellingen zijn te openen; de externe provider is voorbereid', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/settings', { wacht: 500 });
    await expect(page.locator('#assistentInstellingen')).toBeVisible();
    await expect(page.locator('#assistentInstellingen')).toContainText('voorbereid');
    // De demo blijft actief, ook na het kiezen van de externe provider.
    await page.click('#assistentInstellingen [data-assistent-instelling="modus-extern"]');
    await page.waitForTimeout(300);
    await openAssistent(page);
    await stelVraag(page, 'Wat betekent ROAS?');
    await expect(laatsteAntwoord(page)).toContainText('Rendement op advertentie-uitgaven');
  });

  test('gesprekshistorie wissen zet het gesprek terug naar het startscherm', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await openAssistent(page);
    await stelVraag(page, 'Vat deze pagina samen');
    await expect(page.locator('.assistent-bericht')).not.toHaveCount(0);
    // Het paneel blijft open tijdens navigatie; wissen kan vanuit de instellingen.
    await ga(page, '#/agency/settings', { wacht: 400 });
    await page.click('#assistentInstellingen [data-assistent-instelling="wis"]');
    await page.waitForTimeout(300);
    // Het al geopende paneel toont daarna weer het startscherm met suggesties.
    await expect(page.locator('.assistent-start')).toBeVisible();
    await expect(page.locator('.assistent-bericht')).toHaveCount(0);
  });

  test('de assistent is ook in de klantomgeving bereikbaar', async ({ page }) => {
    await login(page, ACCOUNTS.klantAdmin);
    await ga(page, '#/client/overview', { wacht: 500 });
    await expect(page.locator('#assistentLauncher')).toBeVisible();
    await openAssistent(page);
    await expect(page.locator('.assistent-insight')).toContainText('Vitaalpunt');
  });
});

test.describe('Aizy-assistent — geen overloop', () => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    test(`geen horizontale overloop met open paneel op ${viewport.width}`, async ({ page }) => {
      const fouten = foutenVerzamelen(page);
      await page.setViewportSize(viewport);
      await login(page, ACCOUNTS.admin);
      await openAssistent(page);
      await stelVraag(page, 'Wat kan ik op deze pagina doen?');
      const overloop = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
      );
      expect(overloop, 'horizontale overloop').toBe(false);
      expect(fouten, fouten.join('\n')).toEqual([]);
    });
  }
});
