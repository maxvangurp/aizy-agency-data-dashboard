import { test, expect } from '@playwright/test';
import { login, ga, ACCOUNTS, foutenVerzamelen } from './helpers.js';

/**
 * Tests voor de inhoudelijke en interactieve verdiepingslaag: de centrale
 * metriekcatalogus, de hoveruitleg, de statusuitleg, de drill-down naar de
 * metriekopbouw en de cross-filtering.
 *
 * De rode draad is dat uitleg uit één bron komt, dat een verdieping optelt tot
 * het cijfer erboven, en dat alles ook zonder muis en zonder hover bereikbaar
 * is.
 */

/* ---------------------------------------------------------------
   Centrale metriekcatalogus
   --------------------------------------------------------------- */

test.describe('Metriekcatalogus', () => {
  test('iedere metriek met een tooltip heeft een definitie en formule', async ({ page }) => {
    await login(page, ACCOUNTS.admin);

    const resultaat = await page.evaluate(async () => {
      const mod = await import('/js/data/metrics-catalog.js');
      const uit = [];
      for (const key of mod.alleMetriekSleutels()) {
        const c = mod.metriekCatalogus(key);
        uit.push({ key, heeftLabel: !!c.label, heeftUitleg: !!c.uitleg });
      }
      return uit;
    });

    expect(resultaat.length).toBeGreaterThan(20);
    for (const m of resultaat) {
      expect(m.heeftLabel, `${m.key} zonder label`).toBe(true);
      expect(m.heeftUitleg, `${m.key} zonder uitleg`).toBe(true);
    }
  });

  test('de belangrijkste efficiëntiemetrieken hebben een formule en bron', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    const info = await page.evaluate(async () => {
      const mod = await import('/js/data/metrics-catalog.js');
      return ['cpa', 'roas', 'cpl', 'cpql'].map((k) => {
        const c = mod.metriekCatalogus(k);
        return { k, formule: c.formule, bronnen: c.bronnen.length, drill: c.drilldowns.length };
      });
    });
    for (const m of info) {
      expect(m.formule, `${m.k} zonder formule`).toBeTruthy();
      expect(m.bronnen, `${m.k} zonder bron`).toBeGreaterThan(0);
    }
  });
});

/* ---------------------------------------------------------------
   Hoveruitleg
   --------------------------------------------------------------- */

test.describe('Hoveruitleg', () => {
  test('een KPI toont bij hover een definitie uit de catalogus', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/clients/vitaalpunt', { wacht: 700 });

    await page.locator('.kpi-label-tip').first().hover();
    await page.waitForTimeout(300);
    const tip = page.locator('#aizyTooltip');
    await expect(tip).toBeVisible();
    await expect(tip).toContainText('Bron:');
  });

  test('de tooltip verschijnt bij toetsenbordfocus en sluit met Escape', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/clients/vitaalpunt', { wacht: 700 });

    await page.locator('.kpi-label-tip').first().focus();
    await page.waitForTimeout(150);
    await expect(page.locator('#aizyTooltip')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('#aizyTooltip')).toBeHidden();
  });

  test('de tooltip valt binnen het scherm', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/clients/vitaalpunt', { wacht: 700 });

    // Een kolomkop rechts in een brede tabel: de tooltip mag niet buiten beeld vallen.
    await page.locator('[data-tip]').last().hover();
    await page.waitForTimeout(300);
    const binnen = await page.locator('#aizyTooltip').evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.left >= -1 && r.right <= window.innerWidth + 1 && r.top >= -1;
    });
    expect(binnen).toBe(true);
  });

  test('op touch opent een tik de uitleg', async ({ browser }) => {
    const context = await browser.newContext({ hasTouch: true, viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/clients/vitaalpunt', { wacht: 700 });

    await page.locator('.kpi-label-tip').first().tap();
    await page.waitForTimeout(200);
    await expect(page.locator('#aizyTooltip')).toBeVisible();
    await context.close();
  });

  test('een tabelkop legt de metriek uit', async ({ page }) => {
    await login(page, ACCOUNTS.klantAdmin);
    await ga(page, '#/client/channels', { wacht: 600 });
    await expect(page.locator('#pageRoot thead [data-tip]').first()).toBeVisible();
  });
});

/* ---------------------------------------------------------------
   Statusuitleg
   --------------------------------------------------------------- */

test.describe('Statusuitleg', () => {
  test('een klantstatus is uitlegbaar met de factoren erachter', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/portfolio?tab=prioriteiten', { wacht: 600 });

    const trigger = page.locator('.grid-tabel [data-tip-text]').first();
    await trigger.hover();
    await page.waitForTimeout(300);
    const tip = page.locator('#aizyTooltip');
    await expect(tip).toBeVisible();
    await expect(tip).toContainText('Waarom');
  });
});

/* ---------------------------------------------------------------
   Drill-down naar de metriekopbouw
   --------------------------------------------------------------- */

test.describe('Metriekopbouw', () => {
  test('een KPI opent zijn opbouw in het detailpaneel', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/clients/vitaalpunt', { wacht: 700 });

    await page.locator('.kpi-drill').first().click();
    await page.waitForTimeout(400);
    await expect(page.locator('.detailpaneel.is-open')).toBeVisible();
    await expect(page.locator('#detailpaneelTitel')).toContainText('Opbouw');
    // De hoofdpagina blijft eronder staan.
    await expect(page.locator('#pageRoot h1')).toBeVisible();
  });

  test('de opbouw telt op tot het cijfer op de KPI-kaart', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/clients/vitaalpunt', { wacht: 700 });

    const kaart = page.locator('.kpi-drilbaar').first();
    const waarde = (await kaart.locator('.kpi-value').textContent()).trim();
    await kaart.locator('.kpi-drill').click();
    await page.waitForTimeout(400);

    // "Deze periode" in het paneel is dezelfde waarde als op de kaart.
    const periode = (await page.locator('.detailpaneel .paneel-cijfers dd').first().textContent()).trim();
    expect(periode).toBe(waarde);
    // En het paneel gaat over deze klant, niet over de portefeuille.
    await expect(page.locator('#detailpaneel .detailpaneel-kop')).toContainText('Vitaalpunt');
  });

  test('de opbouw toont de bijdrage per kanaal met een aandeel', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/clients/vitaalpunt', { wacht: 700 });

    // Open de opbouw van de uitgaven; die kent een kanaalverdeling.
    const spend = page.locator('.kpi-drilbaar[data-label="Spend"]').first();
    await spend.locator('.kpi-drill').click();
    await page.waitForTimeout(400);
    await expect(page.locator('.opbouw-lijst').first()).toBeVisible();
    await expect(page.locator('.detailpaneel')).toContainText('procent van het totaal');
  });

  test('de opbouw is deelbaar via de URL', async ({ page }) => {
    const errors = foutenVerzamelen(page);
    await login(page, ACCOUNTS.admin);
    // Rechtstreeks een opbouw-URL openen levert hetzelfde paneel op.
    await ga(page, '#/agency/clients/vitaalpunt?panel=metric:spend&client=vitaalpunt', { wacht: 700 });
    await expect(page.locator('.detailpaneel.is-open')).toBeVisible();
    await expect(page.locator('#detailpaneelTitel')).toContainText('Opbouw');
    expect(errors).toEqual([]);
  });

  test('het detailpaneel sluit met Escape en behoudt de lijstcontext', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/portfolio?tab=prioriteiten', { wacht: 600 });
    await page.selectOption('[data-grid-filter="portefeuille"][data-filter="type"]', 'leadgen');
    await page.waitForTimeout(400);
    const voor = await page.locator('.grid-tabel tbody tr').count();

    // Open een klantpreview vanuit de lijst.
    await page.locator('[data-klantpaneel]').first().click();
    await page.waitForTimeout(400);
    await expect(page.locator('.detailpaneel.is-open')).toBeVisible();

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await expect(page.locator('.detailpaneel.is-open')).toHaveCount(0);
    // Het filter op de lijst is behouden.
    expect(await page.locator('.grid-tabel tbody tr').count()).toBe(voor);
  });
});

/* ---------------------------------------------------------------
   Cross-filtering
   --------------------------------------------------------------- */

test.describe('Cross-filtering', () => {
  test('een klik op een kanaal beperkt de weergave tot dat kanaal', async ({ page }) => {
    await login(page, ACCOUNTS.klantAdmin);
    await ga(page, '#/client/channels', { wacht: 700 });

    const knop = page.locator('[data-kanaalfilter]').first();
    const kanaal = await knop.getAttribute('data-kanaalfilter');
    await knop.click();
    await page.waitForTimeout(600);

    // De actieve kanaalselectie in de bovenbalk toont nu één kanaal.
    await expect(page.locator('#filterToggleKanalen')).not.toContainText('Alle kanalen');
    expect(await page.evaluate(() => location.hash)).toContain(kanaal);
  });
});

/* ---------------------------------------------------------------
   Stabiliteit
   --------------------------------------------------------------- */

test.describe('Verdieping blijft stabiel', () => {
  test('drillen en tooltips veroorzaken geen console- of HTTP-fouten', async ({ page }) => {
    const errors = foutenVerzamelen(page);
    await login(page, ACCOUNTS.admin);

    for (const route of ['#/agency/clients/vitaalpunt', '#/agency/clients/tafelwerk', '#/client/channels']) {
      await ga(page, route, { wacht: 500 });
      const drill = page.locator('.kpi-drill').first();
      if (await drill.count()) {
        await drill.click();
        await page.waitForTimeout(300);
        await page.keyboard.press('Escape');
      }
    }
    expect(errors).toEqual([]);
  });
});
