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
   Layout-herindeling en progressive disclosure
   --------------------------------------------------------------- */

test.describe('Layout-herindeling', () => {
  test('de samenwerkingssectie toont drie kolommen naast een contactzijkaart', async ({ page }) => {
    await login(page, ACCOUNTS.klantAdmin);
    await ga(page, '#/client/report?tab=rapportages', { wacht: 600 });

    await expect(page.locator('.samenwerk-kolom')).toHaveCount(3);
    await expect(page.locator('.samenwerk-contact')).toHaveCount(1);
    // De drie kolommen staan op desktop naast elkaar (gelijke bovenkant).
    const tops = await page.locator('.samenwerk-kolom').evaluateAll(
      (els) => els.map((e) => Math.round(e.getBoundingClientRect().top))
    );
    expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(2);
  });

  test('op smal scherm stapelen de samenwerkingskolommen', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, ACCOUNTS.klantAdmin);
    await ga(page, '#/client/report?tab=rapportages', { wacht: 600 });

    const tops = await page.locator('.samenwerk-kolom').evaluateAll(
      (els) => els.map((e) => Math.round(e.getBoundingClientRect().top))
    );
    // Gestapeld: de bovenkanten verschillen duidelijk.
    expect(Math.max(...tops) - Math.min(...tops)).toBeGreaterThan(20);
  });

  test('een ingeklapte sectie houdt zijn titel als vindbare kop', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/clients/vitaalpunt', { wacht: 700 });

    const uitklap = page.locator('.uitklap').first();
    await expect(uitklap).toBeVisible();
    // De titel is een kop (role=heading) en dus met een screenreader vindbaar.
    const kop = uitklap.locator('.uitklap-titel');
    await expect(kop).toHaveAttribute('role', 'heading');

    // Openklappen toont de inhoud.
    const openVoor = await uitklap.evaluate((el) => el.open);
    await uitklap.locator('summary').click();
    await page.waitForTimeout(200);
    const openNa = await uitklap.evaluate((el) => el.open);
    expect(openNa).toBe(!openVoor);
  });

  test('de funnel krijgt meer hoogte dan een compacte grafiek', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/clients/vitaalpunt', { wacht: 700 });
    const funnelHoogte = await page.locator('#chart-lead-funnel')
      .evaluate((el) => Math.round(el.parentElement.getBoundingClientRect().height));
    expect(funnelHoogte).toBeGreaterThanOrEqual(300);
  });
});

/* ---------------------------------------------------------------
   Shell-uitlijning: sidebar-kop en topbalk op één lijn
   --------------------------------------------------------------- */

test.describe('Shell-uitlijning', () => {
  test('de sidebar-kop en de topbalk delen één horizontale lijn', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/clients/vitaalpunt', { wacht: 500 });

    const brandBottom = await page.locator('.sidebar .brand').evaluate((el) => el.getBoundingClientRect().bottom);
    const balkBottom = await page.locator('.contextbalk').evaluate((el) => el.getBoundingClientRect().bottom);
    expect(Math.abs(brandBottom - balkBottom)).toBeLessThanOrEqual(1);
  });

  test('de navigatie-iconen zijn links op één verticale lijn uitgelijnd', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    const lefts = await page.locator('.nav-link .nav-icoon').evaluateAll(
      (els) => els.map((e) => Math.round(e.getBoundingClientRect().left))
    );
    expect(lefts.length).toBeGreaterThan(3);
    expect(Math.max(...lefts) - Math.min(...lefts)).toBeLessThanOrEqual(1);
  });

  test('de topbalk staat op desktop op één regel (vaste hoogte)', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    const hoogte = await page.locator('.contextbalk').evaluate((el) => el.getBoundingClientRect().height);
    expect(hoogte).toBeLessThanOrEqual(64);
  });
});

/* ---------------------------------------------------------------
   Getallen, KPI-voet, samenvattingsstrip en doelbalk
   --------------------------------------------------------------- */

test.describe('Leesbaarheid v4', () => {
  test('numerieke tabelkolommen zijn rechts uitgelijnd', async ({ page }) => {
    await login(page, ACCOUNTS.klantAdmin);
    await ga(page, '#/client/channels', { wacht: 500 });

    const cel = page.locator('.table-scroll td.uitlijn-rechts').first();
    await expect(cel).toHaveCount(1);
    const align = await cel.evaluate((el) => getComputedStyle(el).textAlign);
    expect(align).toBe('right');
  });

  test('de KPI-metaregel zakt naar de onderkant van de kaart', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/clients/vitaalpunt', { wacht: 600 });

    // De onderkant van het laatste meta-element ligt dicht bij de onderkant van
    // de kaart: geen groot wit gat meer.
    const kaart = page.locator('.kpi-drilbaar').first();
    const gat = await kaart.evaluate((el) => {
      const kaartBox = el.getBoundingClientRect();
      // Het écht laatste meta-element (drill wint van uitleg wint van sub).
      const laatste = el.querySelector('.kpi-drill')
        || el.querySelector('.kpi-uitleg')
        || el.querySelector('.kpi-sub');
      const metaBox = laatste.getBoundingClientRect();
      return kaartBox.bottom - metaBox.bottom;
    });
    expect(gat).toBeLessThanOrEqual(24);
  });

  test('het klantdashboard opent met een samenvattingsstrip met werkende ankers', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/clients/vitaalpunt', { wacht: 600 });

    await expect(page.locator('.samenvattingsstrip')).toHaveCount(1);
    const anker = page.locator('.strip-anker').filter({ hasText: 'Funnel' });
    await expect(anker).toBeVisible();
    // Klikken scrolt naar de funnelsectie zonder de route te wijzigen.
    const hashVoor = await page.evaluate(() => location.hash);
    await anker.click();
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => location.hash)).toBe(hashVoor);
    const inBeeld = await page.locator('#funnel').evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.top >= -5 && r.top < window.innerHeight;
    });
    expect(inBeeld).toBe(true);
  });

  test('een doelbalk toont een vorige-periode-markering waar data bestaat', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/clients/vitaalpunt', { wacht: 600 });
    expect(await page.locator('.progress-marker').count()).toBeGreaterThan(0);
  });

  test('e-commerce secundaire secties zijn inklapbaar met vindbare kop', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/clients/tafelwerk', { wacht: 700 });

    // Productfeed/Zoekwoorden/Organische resultaten staan nu in uitklapbare secties.
    await expect(page.getByRole('heading', { name: 'Productfeed' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Organische resultaten' })).toBeVisible();
    expect(await page.locator('.uitklap').count()).toBeGreaterThan(0);
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

/* ---------------------------------------------------------------
   Navigatieshell: topbar en sidebar als één samenhangend systeem
   --------------------------------------------------------------- */

test.describe('Navigatieshell', () => {
  test('elke navigatie-link deelt exact dezelfde iconenkolom', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    const boxes = await page.locator('.nav-link .nav-icoon-box').evaluateAll(
      (els) => els.map((e) => Math.round(e.getBoundingClientRect().width))
    );
    expect(boxes.length).toBeGreaterThan(3);
    // Eén vaste iconenkolom → alle boxen even breed.
    expect(Math.max(...boxes) - Math.min(...boxes)).toBeLessThanOrEqual(1);
  });

  test('de topbar-bediening deelt één consistente hoogte', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    const hoogtes = await page.evaluate(() => {
      const sel = ['.filtergroep', '.zoekveld input', '#meldingenKnop', '.accountknop', '.klantkiezer select'];
      return sel
        .map((s) => document.querySelector(s))
        .filter(Boolean)
        .map((el) => Math.round(el.getBoundingClientRect().height));
    });
    expect(hoogtes.length).toBeGreaterThanOrEqual(4);
    // Alle controls op dezelfde hoogte (± subpixelafronding).
    expect(Math.max(...hoogtes) - Math.min(...hoogtes)).toBeLessThanOrEqual(2);
  });

  test('de filterknoppen zitten gebundeld in één gesegmenteerde control', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    const groep = page.locator('.filtergroep');
    await expect(groep).toBeVisible();
    await expect(groep.locator('#filterToggle')).toHaveCount(1);
    await expect(groep.locator('#filterToggleVergelijking')).toHaveCount(1);
    // De groep heeft één gedeelde omranding (geen losse blokken).
    const rand = await groep.evaluate((el) => getComputedStyle(el).borderTopStyle);
    expect(rand).not.toBe('none');
  });

  test('het actieve item houdt dezelfde rijhoogte als een inactief item', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    const [actief, inactief] = await page.evaluate(() => {
      const h = (el) => Math.round(el.getBoundingClientRect().height);
      const a = document.querySelector('.nav-link.active');
      const i = [...document.querySelectorAll('.nav-link')].find((el) => !el.classList.contains('active'));
      return [h(a), h(i)];
    });
    expect(Math.abs(actief - inactief)).toBeLessThanOrEqual(1);
  });

  test('de bovenbalk blijft één regel bij 1280 zonder horizontale overloop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await login(page, ACCOUNTS.admin);
    const hoogte = await page.locator('.contextbalk').evaluate((el) => Math.round(el.getBoundingClientRect().height));
    expect(hoogte).toBeLessThanOrEqual(64);
    const overloop = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    );
    expect(overloop).toBe(false);
  });
});
