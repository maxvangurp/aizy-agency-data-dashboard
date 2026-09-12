import { test, expect } from '@playwright/test';
import { ACCOUNTS, login, ga } from './helpers.js';

/**
 * De klantweergave op echte cijfers.
 *
 * Deze pagina's lazen hun campagnes en doorsnedes uit het voorbeeldprofiel.
 * Voor de aangesloten klanten bestaat dat profiel niet, dus stond er overal
 * "niet gekoppeld" -- ook op de Meta-campagnetab, terwijl die campagnes
 * gewoon in Supabase staan. Het blok las alleen altijd uit `googleAds`.
 *
 * Deze tests draaien met eigen antwoorden, zodat ze de koppeling toetsen en
 * niet de inhoud van Supabase.
 */

const KLANT = {
  id: 'proefklant', name: 'Proefklant BV', businessModel: 'leadgen',
  valuta: 'EUR', supportingOwnerIds: [], doelen: [], echt: true,
};

function reeks() {
  const rijen = [];
  for (let i = 0; i < 30; i += 1) {
    const datum = new Date(Date.UTC(2026, 7, 13 + i)).toISOString().slice(0, 10);
    for (const channel of ['google_ads', 'meta_ads']) {
      rijen.push({
        date: datum, channel, spend: 50, impressions: 1000, clicks: 25,
        sessions: null, users: null, revenue: null, conversies: { leads: 2 },
      });
    }
  }
  return rijen;
}

const DETAIL = {
  klant: { slug: 'proefklant', naam: 'Proefklant BV' },
  periode: { start: '2026-08-14', eind: '2026-09-12' },
  campagnes: [
    {
      kanaal: 'meta_ads', naam: 'Meta zomeractie', type: null,
      status: 'active', platformStatus: 'ACTIVE',
      kosten: 1200, vertoningen: 90000, klikken: 2400, conversies: 24, conversiewaarde: 0,
    },
    {
      kanaal: 'meta_ads', naam: 'Meta oude campagne', type: null,
      status: 'paused', platformStatus: 'PAUSED',
      kosten: 300, vertoningen: 20000, klikken: 500, conversies: 3, conversiewaarde: 0,
    },
    {
      kanaal: 'google_ads', naam: 'Search merknaam', type: 'SEARCH',
      status: 'active', platformStatus: 'ENABLED',
      kosten: 800, vertoningen: 40000, klikken: 1600, conversies: 32, conversiewaarde: 0,
    },
  ],
  verdelingen: {
    apparaten: [
      { platform: 'google-ads', naam: 'Mobiel', kosten: 500, klikken: 900, conversies: 18, sessies: 0, gebruikers: 0 },
      { platform: 'meta-ads', naam: 'Mobiele app', kosten: 900, klikken: 1800, conversies: 15, sessies: 0, gebruikers: 0 },
    ],
    regios: [{ platform: 'ga4', naam: 'Noord-Brabant', kosten: 0, klikken: 0, conversies: 0, sessies: 2400, gebruikers: 1800 }],
    plaatsingen: [{ platform: 'meta-ads', naam: 'Instagram', kosten: 600, klikken: 1200, conversies: 9, sessies: 0, gebruikers: 0 }],
  },
  nietBeschikbaar: {
    advertentiesets: 'Wordt niet opgehaald bij Meta.',
    creatives: 'Wordt niet opgehaald bij Meta.',
    doelgroepen: 'Wordt niet opgehaald bij Meta.',
    zoektermen: 'Wordt niet opgehaald bij Google Ads.',
  },
};

async function klantweergave(page, tab) {
  await page.route('**/api/clients/live', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([KLANT]),
  }));
  await page.route('**/api/reeks*', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      klanten: {
        proefklant: {
          slug: 'proefklant', businessModel: 'leadgen',
          kanalen: ['google_ads', 'meta_ads'], rijen: reeks(),
        },
      },
      nietGemeten: [],
    }),
  }));
  await page.route('**/api/klantdetail*', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(DETAIL),
  }));

  await page.addInitScript(() => localStorage.setItem('aizy.dataMode', 'live'));
  await login(page, ACCOUNTS.admin);
  // Agencygebruikers komen alleen bij #/client/* met een actieve klant in de
  // sessie; dat is de "klantweergave" die de bovenbalk toont.
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('aizy.session'));
    s.contextClientId = 'proefklant';
    localStorage.setItem('aizy.session', JSON.stringify(s));
  });
  await page.reload();
  await page.waitForTimeout(1500);
  await ga(page, tab, { wacht: 2500 });
}

test.describe('Klantweergave op echte cijfers', () => {
  test('de Meta-campagnetab toont campagnes in plaats van "niet gekoppeld"', async ({ page }) => {
    await klantweergave(page, '#/client/channels/meta_ads?tab=campagnes');

    const inhoud = page.locator('.page-root');
    await expect(inhoud).toContainText('Meta zomeractie');
    await expect(inhoud).not.toContainText('Niet gekoppeld');
    // En alleen Meta: een Google-campagne hoort hier niet te staan.
    await expect(inhoud).not.toContainText('Search merknaam');
  });

  test('de Google-campagnetab toont alleen Google-campagnes', async ({ page }) => {
    await klantweergave(page, '#/client/channels/google_ads?tab=campagnes');

    const inhoud = page.locator('.page-root');
    await expect(inhoud).toContainText('Search merknaam');
    await expect(inhoud).not.toContainText('Meta zomeractie');
  });

  test('een uitgezette campagne is als zodanig te zien, met het bedrag erbij', async ({ page }) => {
    await klantweergave(page, '#/client/channels/meta_ads?tab=campagnes');

    const inhoud = page.locator('.page-root');
    await expect(inhoud).toContainText('Gepauzeerd');
    // De uitgaven aan uitgezette campagnes staan boven de tabel: die zijn echt
    // gedaan, maar er valt niets meer aan te veranderen.
    await expect(inhoud).toContainText('staan inmiddels uit');
  });

  test('een onderdeel dat niet opgehaald wordt zegt dat, en niet "geen resultaat"', async ({ page }) => {
    await klantweergave(page, '#/client/channels/meta_ads?tab=creatives');

    const inhoud = page.locator('.page-root');
    await expect(inhoud).toContainText('Wordt niet opgehaald bij Meta');
    await expect(inhoud).toContainText('een lege tabel leest als "geen resultaat"');
  });

  test('tijdens het laden staat er geen bewering over de koppeling', async ({ page }) => {
    // Een traag antwoord toonde "niet gekoppeld" -- een uitspraak over de
    // koppeling, terwijl de cijfers onderweg waren.
    await page.route('**/api/klantdetail*', async (r) => {
      await new Promise((klaar) => setTimeout(klaar, 3000));
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(DETAIL) });
    });
    await page.route('**/api/clients/live', (r) => r.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify([KLANT]),
    }));
    await page.route('**/api/reeks*', (r) => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ klanten: { proefklant: { slug: 'proefklant', businessModel: 'leadgen', kanalen: ['google_ads', 'meta_ads'], rijen: reeks() } }, nietGemeten: [] }),
    }));

    await page.addInitScript(() => localStorage.setItem('aizy.dataMode', 'live'));
    await login(page, ACCOUNTS.admin);
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('aizy.session'));
      s.contextClientId = 'proefklant';
      localStorage.setItem('aizy.session', JSON.stringify(s));
    });
    await page.reload();
    await page.waitForTimeout(1200);
    await ga(page, '#/client/channels/meta_ads?tab=campagnes', { wacht: 600 });

    await expect(page.locator('.page-root')).toContainText('laden');
    await expect(page.locator('.page-root')).not.toContainText('Niet gekoppeld');
  });
});
