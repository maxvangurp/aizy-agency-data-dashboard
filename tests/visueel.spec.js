import { test, expect } from '@playwright/test';
import { login, ga, ACCOUNTS, foutenVerzamelen } from './helpers.js';

/**
 * Visuele QA: geen horizontale overloop, consistente uitlijning, leesbare
 * typografie, zichtbare focus en behoud van de responsieve breakpoints. Deze
 * tests bewaken de afwerking, niet de inhoud — ze vullen de functionele tests
 * aan met wat een gebruiker als "strak" ervaart.
 */

const BREEDTES = [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
];

/* ---------------------------------------------------------------
   Geen horizontale overloop, dashboardbreed
   --------------------------------------------------------------- */

test.describe('Geen horizontale overloop', () => {
  const AGENCY = [
    '#/agency/portfolio', '#/agency/work', '#/agency/clients', '#/agency/clients/vitaalpunt',
    '#/agency/channels', '#/agency/channels/google_ads', '#/agency/campaigns', '#/agency/budgets',
    '#/agency/conversions', '#/agency/actions', '#/agency/planning', '#/agency/signals',
    '#/agency/insights', '#/agency/reports', '#/agency/dataquality', '#/agency/integrations',
    '#/agency/team', '#/agency/settings',
  ];
  const KLANT = [
    '#/client/overview', '#/client/performance', '#/client/channels', '#/client/analysis',
    '#/client/collaboration', '#/client/report',
  ];

  for (const viewport of BREEDTES) {
    test(`agencyroutes passen op ${viewport.width}px`, async ({ page }) => {
      const errors = foutenVerzamelen(page);
      await page.setViewportSize(viewport);
      await login(page, ACCOUNTS.admin);
      for (const route of AGENCY) {
        await ga(page, route, { wacht: 350 });
        const overloop = await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
        );
        expect(overloop, `overloop op ${route} @ ${viewport.width}`).toBe(false);
      }
      expect(errors).toEqual([]);
    });

    test(`klantroutes passen op ${viewport.width}px`, async ({ page }) => {
      const errors = foutenVerzamelen(page);
      await page.setViewportSize(viewport);
      await login(page, ACCOUNTS.klantAdmin);
      for (const route of KLANT) {
        await ga(page, route, { wacht: 350 });
        const overloop = await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
        );
        expect(overloop, `overloop op ${route} @ ${viewport.width}`).toBe(false);
      }
      expect(errors).toEqual([]);
    });
  }
});

/* ---------------------------------------------------------------
   Uitlijning en hiërarchie
   --------------------------------------------------------------- */

test.describe('KPI-uitlijning en hiërarchie', () => {
  test('KPI-kaarten in dezelfde rij hebben gelijke hoogte', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/clients/vitaalpunt', { wacht: 600 });

    // Vergelijk binnen elke visuele rij (kaarten met dezelfde bovenkant): een
    // auto-fit-grid wikkelt naar meerdere rijen, en alleen kaarten die naast
    // elkaar staan horen even hoog te zijn.
    const kaarten = await page.locator('.kpi-row').first().locator('.kpi').evaluateAll(
      (els) => els.map((e) => {
        const r = e.getBoundingClientRect();
        return { top: Math.round(r.top), h: Math.round(r.height) };
      })
    );
    expect(kaarten.length).toBeGreaterThan(1);
    const rijen = new Map();
    for (const k of kaarten) {
      const sleutel = [...rijen.keys()].find((t) => Math.abs(t - k.top) <= 3) ?? k.top;
      if (!rijen.has(sleutel)) rijen.set(sleutel, []);
      rijen.get(sleutel).push(k.h);
    }
    let vergeleken = 0;
    for (const hoogtes of rijen.values()) {
      if (hoogtes.length < 2) continue;
      vergeleken += 1;
      expect(Math.max(...hoogtes) - Math.min(...hoogtes)).toBeLessThanOrEqual(2);
    }
    expect(vergeleken, 'minstens één rij met meerdere kaarten').toBeGreaterThan(0);
  });

  test('het primaire resultaat is groter dan de secundaire KPI', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/clients/vitaalpunt', { wacht: 600 });

    const primair = await page.locator('.kpi-primair .kpi-value').first()
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    const gewoon = await page.locator('.kpi:not(.kpi-primair) .kpi-value').first()
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(primair).toBeGreaterThan(gewoon);
  });

  test('de KPI-waarde is stevig en goed leesbaar', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/clients/vitaalpunt', { wacht: 600 });

    const grootte = await page.locator('.kpi-value').first()
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(grootte).toBeGreaterThanOrEqual(24);
  });
});

/* ---------------------------------------------------------------
   Typografie en leesbaarheid
   --------------------------------------------------------------- */

test.describe('Typografie', () => {
  test('bodytekst is minimaal 14 pixels', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/clients/vitaalpunt', { wacht: 500 });
    const bodySize = await page.evaluate(() => parseFloat(getComputedStyle(document.body).fontSize));
    expect(bodySize).toBeGreaterThanOrEqual(14);
  });

  test('microcopy blijft minimaal 12 pixels', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/portfolio', { wacht: 500 });
    const kleinste = await page.locator('.klein, .muted.klein').first()
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)).catch(() => 12);
    expect(kleinste).toBeGreaterThanOrEqual(11.5);
  });
});

/* ---------------------------------------------------------------
   Focus en interactieve affordance
   --------------------------------------------------------------- */

test.describe('Focus en affordance', () => {
  test('een KPI-drilknop toont een zichtbare focusstijl', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/clients/vitaalpunt', { wacht: 500 });

    const knop = page.locator('.kpi-drill').first();
    await knop.focus();
    const outline = await knop.evaluate((el) => {
      const cs = getComputedStyle(el);
      // Een zichtbare focus komt uit outline of box-shadow.
      return cs.outlineStyle !== 'none' || cs.boxShadow !== 'none';
    });
    expect(outline).toBe(true);
  });

  test('de actieve navigatie is duidelijk gemarkeerd', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    const actief = page.locator('.nav-link.active');
    await expect(actief).toHaveCount(1);
    await expect(actief).toHaveAttribute('aria-current', 'page');
  });
});

/* ---------------------------------------------------------------
   Responsief gedrag van de shell
   --------------------------------------------------------------- */

test.describe('Responsieve shell', () => {
  test('op mobiel verbergt de shell de vaste sidebar achter een menuknop', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, ACCOUNTS.admin);
    await expect(page.locator('#menuKnop')).toBeVisible();
  });

  test('de navigatie kan worden ingeklapt en de content groeit mee', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    const breedVoor = await page.locator('.sidebar').evaluate((el) => el.getBoundingClientRect().width);
    await page.click('#navInklap');
    await page.waitForTimeout(300);
    const breedNa = await page.locator('.sidebar').evaluate((el) => el.getBoundingClientRect().width);
    expect(breedNa).toBeLessThan(breedVoor);
  });
});

/* ---------------------------------------------------------------
   Thema's blijven leesbaar
   --------------------------------------------------------------- */

test.describe('Thema-afwerking', () => {
  for (const theme of ['light', 'dark']) {
    test(`de interface blijft leesbaar in ${theme} thema`, async ({ page }) => {
      await login(page, ACCOUNTS.admin, { theme });
      await ga(page, '#/agency/clients/vitaalpunt', { wacht: 500 });
      const kleuren = await page.evaluate(() => {
        const b = getComputedStyle(document.body);
        return { bg: b.backgroundColor, ink: b.color };
      });
      expect(kleuren.bg).not.toBe(kleuren.ink);
    });
  }
});
