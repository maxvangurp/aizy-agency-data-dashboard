import { test, expect } from '@playwright/test';

const LEADGEN_KLANTEN = [
  { id: 'vitaalpunt', naam: 'Vitaalpunt Fysiotherapie' },
  { id: 'meridiaan', naam: 'Meridiaan Bedrijfsadvies' },
  { id: 'havenkwartier', naam: 'Havenkwartier Makelaars' },
];

/** Zet klant, thema en weergave, en open het klantdashboard. */
async function openKlant(page, clientId, { theme = 'light', view = 'agency', period = 'deze-maand' } = {}) {
  await page.goto('/index.html');
  await page.evaluate(
    ([id, t, v, p]) => {
      localStorage.setItem('aizy.theme', t);
      localStorage.setItem(
        'aizy.state',
        JSON.stringify({ customerId: id, view: v, theme: t, channel: 'all', period: p, comparison: 'vorige-periode' })
      );
    },
    [clientId, theme, view, period]
  );
  await page.reload();
  await page.click('#nav button[data-page="customers"]');
  await page.waitForTimeout(700);
}

function foutenVerzamelen(page) {
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

test.describe('Leadgeneratie klantdashboard', () => {
  for (const klant of LEADGEN_KLANTEN) {
    test(`${klant.id} rendert alle secties zonder console-fouten`, async ({ page }) => {
      const errors = foutenVerzamelen(page);
      await openKlant(page, klant.id);

      await expect(page.getByRole('heading', { name: klant.naam })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Doelen tegenover werkelijkheid' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Conversies', exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Google Ads campagnes' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Website en gebruikersgedrag' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Lokale zichtbaarheid' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Doorstroom per funnelstap' })).toBeVisible();

      expect(errors).toEqual([]);
    });
  }

  test('de leadgeneratie-KPI\'s verschijnen, niet de e-commerce KPI\'s', async ({ page }) => {
    await openKlant(page, 'vitaalpunt');
    const kpis = page.locator('.kpi-row').first();

    await expect(kpis).toContainText('Totaal aantal leads');
    await expect(kpis).toContainText('Gekwalificeerde leads');
    await expect(kpis).toContainText('Kosten per lead');
    await expect(kpis).toContainText('Kosten per gekwalificeerde lead');
    await expect(kpis).toContainText('Pipelinewaarde');

    // ROAS en gemiddelde orderwaarde horen bij e-commerce.
    await expect(kpis).not.toContainText('ROAS');
    await expect(kpis).not.toContainText('Gemiddelde orderwaarde');
  });

  test('klantselectie via de filter wisselt het dashboard', async ({ page }) => {
    await openKlant(page, 'vitaalpunt');
    await expect(page.getByRole('heading', { name: 'Vitaalpunt Fysiotherapie' })).toBeVisible();

    await page.selectOption('#customerFilter', 'meridiaan');
    await page.waitForTimeout(600);
    await expect(page.getByRole('heading', { name: 'Meridiaan Bedrijfsadvies' })).toBeVisible();
  });

  test('doelen tonen target, werkelijk, verschil, percentage en status', async ({ page }) => {
    await openKlant(page, 'vitaalpunt');
    const doelen = page.locator('.goal-list').first();

    await expect(doelen).toContainText('Totaal aantal leads');
    await expect(doelen).toContainText('Gekwalificeerde leads');
    await expect(doelen).toContainText('Kosten per lead');
    await expect(doelen).toContainText('Websitegebruikers');
    await expect(doelen).toContainText('Telefoongesprekken');

    // Iedere doelrij benoemt percentage, verschil en vorige periode.
    const eerste = doelen.locator('.goal').first();
    await expect(eerste).toContainText('procent behaald');
    await expect(eerste).toContainText('Verschil:');
    await expect(eerste).toContainText('Vorige periode:');
    await expect(doelen.locator('.progress').first()).toBeVisible();
  });

  test('een doel waarbij lager beter is wordt juist beoordeeld', async ({ page }) => {
    // Meridiaan haalt een CPL van 232,10 bij een doel van 250. Dat is beter
    // dan het doel en moet als zodanig worden geteld, niet als 93 procent.
    await openKlant(page, 'meridiaan');
    const cplRij = page.locator('.goal').filter({ hasText: 'Kosten per lead' }).first();
    await expect(cplRij).toContainText('Boven doelstelling');
    await expect(cplRij.locator('.trend-positief')).toBeVisible();
  });

  test('de leadfunnel toont alle negen stappen met bron en knelpunt', async ({ page }) => {
    await openKlant(page, 'vitaalpunt');
    await page.locator('.leadfunnel summary').click();
    const tabel = page.locator('.leadfunnel table');

    for (const stap of [
      'Impressies', 'Klikken', 'Landingspagina bekeken', 'Engagement',
      'Formulier gestart', 'Lead', 'Gekwalificeerde lead', 'Afspraak of offerte', 'Klant',
    ]) {
      await expect(tabel).toContainText(stap);
    }
    await expect(tabel).toContainText('Google Ads');
    await expect(tabel).toContainText('CRM');

    const knelpunt = page.locator('.leadfunnel .banner-warning');
    await expect(knelpunt).toContainText('Knelpunt');
  });

  test('het knelpunt wijst niet naar de doorklikratio', async ({ page }) => {
    // De stap van impressie naar klik is altijd de grootste daling en zegt
    // niets over een knelpunt. Die mag het knelpunt dus nooit opeisen.
    for (const klant of LEADGEN_KLANTEN) {
      await openKlant(page, klant.id);
      const knelpunt = page.locator('.leadfunnel .banner-warning');
      await expect(knelpunt, `${klant.id} wijst naar Klikken`).not.toContainText('stap Klikken');
    }
  });

  test('primaire en secundaire conversies staan gescheiden en verschillen per klant', async ({ page }) => {
    await openKlant(page, 'vitaalpunt');
    const sectie = page.locator('.card').filter({ has: page.getByRole('heading', { name: 'Conversies', exact: true }) });
    await expect(sectie).toContainText('Primaire conversies');
    await expect(sectie).toContainText('Secundaire conversies');
    await expect(sectie).toContainText('Spoedaanvraag');
    await expect(sectie).toContainText('Telefoonklik');

    // Een makelaar heeft andere primaire conversies dan een praktijk.
    await openKlant(page, 'havenkwartier');
    const sectie2 = page.locator('.card').filter({ has: page.getByRole('heading', { name: 'Conversies', exact: true }) });
    await expect(sectie2).toContainText('Waardebepaling aangevraagd');
    await expect(sectie2).toContainText('WhatsApp-klik');
    await expect(sectie2).not.toContainText('Spoedaanvraag');
  });

  test('het GA4-overzicht toont gedrag, pagina\'s, apparaten en regio\'s', async ({ page }) => {
    await openKlant(page, 'meridiaan');
    const sectie = page.locator('.card').filter({ has: page.getByRole('heading', { name: 'Website en gebruikersgedrag' }) });

    await expect(sectie).toContainText('Gebruikers');
    await expect(sectie).toContainText('Engagement rate');
    await expect(sectie).toContainText('Gemiddelde sessieduur');
    await expect(sectie).toContainText("Landingspagina's");
    await expect(sectie).toContainText('Bron en medium');
    await expect(sectie).toContainText('Apparaten');
    await expect(sectie).toContainText("Regio's");
    await expect(sectie).toContainText('Landen');
  });

  test('Google Ads onderscheidt leadvolume van leadkwaliteit', async ({ page }) => {
    await openKlant(page, 'meridiaan');
    const sectie = page.locator('.card').filter({ has: page.getByRole('heading', { name: 'Google Ads campagnes' }) });

    await expect(sectie).toContainText('Advertentiegroepen');
    await expect(sectie).toContainText('Zoekwoorden');
    await expect(sectie).toContainText('Gekwalificeerd');
    await expect(sectie).toContainText('CPQL');
    await expect(sectie).toContainText('Matchtype');
  });

  test('Google Business Profile is gemarkeerd als toekomstige koppeling', async ({ page }) => {
    await openKlant(page, 'vitaalpunt');
    const sectie = page.locator('.card').filter({ has: page.getByRole('heading', { name: 'Lokale zichtbaarheid' }) });

    await expect(sectie).toContainText('Toekomstige koppeling');
    await expect(sectie).toContainText('Profielinteracties');
    await expect(sectie).toContainText('Telefoongesprekken');
    await expect(sectie).toContainText('Routeaanvragen');
    await expect(sectie).toContainText('Websiteklikken');
  });
});

test.describe('Leadgeneratie onvoldoende data', () => {
  test('ontbrekende CRM-data wordt als onbekend getoond, niet als nul', async ({ page }) => {
    await openKlant(page, 'havenkwartier');
    const kpis = page.locator('.kpi-row').first();

    // Deze klant heeft geen CRM-koppeling. Een 0 zou beweren dat er niets is,
    // terwijl het simpelweg niet gemeten wordt.
    await expect(kpis).toContainText('Onvoldoende data');
    await expect(kpis).toContainText('Geen CRM-koppeling');

    const leadNaarKlant = page.locator('.kpi').filter({ hasText: 'Lead naar klant' });
    await expect(leadNaarKlant).toContainText('Onvoldoende data');
    await expect(leadNaarKlant).not.toContainText('0,0%');
    await expect(leadNaarKlant).not.toContainText('0.0%');
  });

  test('een doel zonder meetbare waarde krijgt de status onvoldoende data', async ({ page }) => {
    await openKlant(page, 'havenkwartier');
    const doel = page.locator('.goal').filter({ hasText: 'Gekwalificeerde leads' }).first();
    await expect(doel).toContainText('Onvoldoende data');
  });

  test('de funnel toont onvoldoende data waar de meting ontbreekt', async ({ page }) => {
    await openKlant(page, 'havenkwartier');
    await page.locator('.leadfunnel summary').click();
    const rij = page.locator('.leadfunnel tbody tr').filter({ hasText: 'Gekwalificeerde lead' }).first();
    await expect(rij).toContainText('Onvoldoende data');
  });
});

test.describe('Leadgeneratie klantview', () => {
  test('de klantview toont het periodeverhaal en verbergt technische tabellen', async ({ page }) => {
    const errors = foutenVerzamelen(page);
    await openKlant(page, 'vitaalpunt', { view: 'customer' });

    await expect(page.getByRole('heading', { name: 'Wat ging goed' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Wat aandacht nodig heeft' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Wat ik deze periode deed' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Wat ik hierna ga doen' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Wat ik van je nodig heb' })).toBeVisible();

    await expect(page.getByRole('heading', { name: 'Investering' })).toHaveCount(0);
    // De technische Google Ads-tabellen horen niet in de klantview.
    await expect(page.getByRole('heading', { name: 'Google Ads campagnes' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Website en gebruikersgedrag' })).toHaveCount(0);

    expect(errors).toEqual([]);
  });

  test('de knop wisselt tussen agencyview en klantview', async ({ page }) => {
    await openKlant(page, 'meridiaan');
    await expect(page.locator('#viewBtn')).toHaveText('Agencyview');
    await expect(page.getByRole('heading', { name: 'Google Ads campagnes' })).toBeVisible();

    await page.click('#viewBtn');
    await page.waitForTimeout(600);
    await expect(page.locator('#viewBtn')).toHaveText('Klantview');
    await expect(page.getByRole('heading', { name: 'Wat ging goed' })).toBeVisible();
  });

  test('de klantview blijft bewaard na herladen', async ({ page }) => {
    await openKlant(page, 'meridiaan');
    await page.click('#viewBtn');
    await page.waitForTimeout(400);

    await page.reload();
    await page.click('#nav button[data-page="customers"]');
    await page.waitForTimeout(600);
    await expect(page.locator('#viewBtn')).toHaveText('Klantview');
    await expect(page.getByRole('heading', { name: 'Wat ging goed' })).toBeVisible();
  });
});

test.describe('Leadgeneratie grafieken en thema\'s', () => {
  test('alle grafieken tekenen op het canvas', async ({ page }) => {
    await openKlant(page, 'vitaalpunt');
    for (const id of ['chart-lead-funnel', 'chart-lead-cpl', 'chart-lead-kanaal']) {
      const gevuld = await page.evaluate((canvasId) => {
        const c = document.getElementById(canvasId);
        if (!c) return false;
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        for (let i = 3; i < d.length; i += 4) if (d[i] !== 0) return true;
        return false;
      }, id);
      expect(gevuld, `${id} is leeg`).toBe(true);
    }
  });

  test('ook de grafieken in de klantview tekenen op het canvas', async ({ page }) => {
    // De klantview gebruikt andere canvas-ids dan de agencyview. Zonder deze
    // test zou een fout daar onopgemerkt blijven.
    await openKlant(page, 'meridiaan', { view: 'customer' });
    for (const id of ['chart-klant-funnel', 'chart-klant-kanaal']) {
      const gevuld = await page.evaluate((canvasId) => {
        const c = document.getElementById(canvasId);
        if (!c) return false;
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        let zichtbaar = 0;
        for (let i = 3; i < d.length; i += 4) if (d[i] !== 0) zichtbaar++;
        // Meer dan alleen assen: minimaal enkele procenten van het vlak.
        return zichtbaar / (d.length / 4) > 0.02;
      }, id);
      expect(gevuld, `${id} bevat geen zichtbare balken`).toBe(true);
    }
  });

  test('iedere grafiek heeft een tabelweergave en bronvermelding', async ({ page }) => {
    await openKlant(page, 'meridiaan');
    const figures = page.locator('.chart-figure');
    const aantal = await figures.count();
    expect(aantal).toBeGreaterThan(0);
    for (let i = 0; i < aantal; i++) {
      await expect(figures.nth(i).locator('.chart-table summary')).toBeVisible();
      await expect(figures.nth(i).locator('.chart-source')).toContainText('Bron:');
    }
  });

  for (const theme of ['light', 'dark']) {
    test(`het leadgeneratiedashboard werkt in ${theme === 'light' ? 'lichte' : 'donkere'} modus`, async ({ page }) => {
      const errors = foutenVerzamelen(page);
      await openKlant(page, 'havenkwartier', { theme });

      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await expect(page.getByRole('heading', { name: 'Doorstroom per funnelstap' })).toBeVisible();

      // Achtergrond en tekst mogen nooit samenvallen.
      const kleuren = await page.evaluate(() => {
        const s = getComputedStyle(document.body);
        return { bg: s.backgroundColor, ink: s.color };
      });
      expect(kleuren.bg).not.toBe(kleuren.ink);
      expect(errors).toEqual([]);
    });
  }

  test('grafieken worden opgeruimd bij het wisselen van klant en scherm', async ({ page }) => {
    const errors = foutenVerzamelen(page);
    await openKlant(page, 'vitaalpunt');

    for (const id of ['meridiaan', 'havenkwartier', 'vitaalpunt']) {
      await page.selectOption('#customerFilter', id);
      await page.waitForTimeout(400);
      await page.click('#nav button[data-page="overview"]');
      await page.waitForTimeout(200);
      await page.click('#nav button[data-page="customers"]');
      await page.waitForTimeout(400);
    }
    await expect(page.locator('#chart-lead-funnel')).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe('Leadgeneratie filters en persistentie', () => {
  test('het periodefilter blijft bewaard na herladen', async ({ page }) => {
    await openKlant(page, 'vitaalpunt');
    await page.selectOption('#periodFilter', 'dit-kwartaal');
    await page.waitForTimeout(300);

    await page.reload();
    await page.waitForTimeout(400);
    await expect(page.locator('#periodFilter')).toHaveValue('dit-kwartaal');
  });

  test('de klantselectie blijft bewaard na herladen', async ({ page }) => {
    await openKlant(page, 'vitaalpunt');
    await page.selectOption('#customerFilter', 'havenkwartier');
    await page.waitForTimeout(300);

    await page.reload();
    await page.click('#nav button[data-page="customers"]');
    await page.waitForTimeout(500);
    await expect(page.locator('#customerFilter')).toHaveValue('havenkwartier');
    await expect(page.getByRole('heading', { name: 'Havenkwartier Makelaars' })).toBeVisible();
  });

  test('alle leadgeneratieklanten staan in het klantfilter', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForTimeout(400);
    for (const klant of LEADGEN_KLANTEN) {
      await expect(page.locator(`#customerFilter option[value="${klant.id}"]`)).toHaveCount(1);
    }
  });
});
