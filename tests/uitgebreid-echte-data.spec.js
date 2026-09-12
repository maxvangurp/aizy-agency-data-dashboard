import { test, expect } from '@playwright/test';
import { ACCOUNTS, login, ga } from './helpers.js';

/**
 * Het uitgebreide dashboard op echte cijfers.
 *
 * De uitgebreide kant rekent alles synchroon door vanuit `getClientRows`. Die
 * las uitsluitend uit de voorbeelddataset, en de aangesloten klanten staan daar
 * niet in -- elke pagina meldde daardoor "er is binnen deze selectie helemaal
 * geen data", terwijl er tienduizenden rijen in Supabase staan.
 *
 * Deze tests draaien in de live-modus met een eigen antwoord op `/api/clients/live`
 * en `/api/reeks`, zodat ze niet van de inhoud van Supabase afhangen maar wel
 * van de koppeling ertussen. Juist daar ging het mis: de klantenlijst levert de
 * slug als id, en de reeksen werden op de uuid gesleuteld. Twee kanten die
 * elkaar nooit vinden, zonder dat er iets stukgaat.
 */

const KLANT = {
  id: 'proefklant',
  name: 'Proefklant BV',
  businessModel: 'leadgen',
  website: 'https://proefklant.example',
  valuta: 'EUR',
  tijdzone: 'Europe/Amsterdam',
  primaryOwnerId: null,
  supportingOwnerIds: [],
  maandbudget: 6000,
  doelen: [],
  echt: true,
};

/** Dertig dagen met vaste cijfers, zodat de totalen narekenbaar zijn. */
function reeks() {
  const rijen = [];
  for (let i = 0; i < 30; i += 1) {
    const d = new Date(Date.UTC(2026, 7, 13 + i));
    const datum = d.toISOString().slice(0, 10);
    rijen.push({
      date: datum, channel: 'google_ads',
      spend: 100, impressions: 2000, clicks: 50,
      sessions: null, users: null, revenue: null,
      conversies: { leads: 4 },
    });
    rijen.push({
      date: datum, channel: 'ga4',
      spend: null, impressions: null, clicks: null,
      sessions: 300, users: 210,
    });
  }
  return rijen;
}

/**
 * Inloggen in het volledige systeem, met eigen antwoorden op de twee vragen
 * die de uitgebreide kant met echte data voedt.
 *
 * Via `login()` en niet via het linkerpaneel: dat tweede is de simpele modus,
 * en die kent `#/agency/*` niet -- je wordt teruggestuurd naar het
 * pulse-dashboard zonder dat er iets misgaat.
 */
async function liveLogin(page, email = ACCOUNTS.admin) {
  await page.route('**/api/clients/live', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([KLANT]),
  }));
  await page.route('**/api/reeks*', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      klanten: {
        proefklant: {
          slug: 'proefklant', businessModel: 'leadgen',
          kanalen: ['google_ads', 'ga4'], rijen: reeks(),
        },
      },
      sinds: '2026-08-13',
      nietGemeten: ['qualifiedLeads', 'appointments', 'quotes', 'customers', 'pipelineValue'],
    }),
  }));
  await page.addInitScript(() => localStorage.setItem('aizy.dataMode', 'live'));
  await login(page, email);
}

test.describe('Uitgebreid dashboard op echte cijfers', () => {
  test('de klantenlijst toont cijfers in plaats van "geen data"', async ({ page }) => {
    await liveLogin(page);
    await ga(page, '#/agency/clients', { wacht: 900 });

    const rij = page.locator('tbody tr', { hasText: 'Proefklant BV' }).first();
    await expect(rij).toBeVisible();
    // De melding die er stond toen de reeksen niet aankwamen.
    await expect(rij).not.toContainText('helemaal geen data');
  });

  test('de klant heeft doorgerekende totalen op zijn eigen pagina', async ({ page }) => {
    await liveLogin(page);
    await ga(page, '#/agency/clients/proefklant', { wacht: 1200 });

    const inhoud = page.locator('.page-root');
    // De standaardperiode (14 aug t/m 12 sep) dekt 29 van de 30 dagen uit de
    // reeks: 29 × 4 = 116 leads. Dat de laatste dag ontbreekt is geen fout maar
    // wat er gemeten is, en de pagina zegt het er ook bij.
    await expect(inhoud).toContainText('116');
    await expect(inhoud).toContainText('ontbreekt data');
    await expect(inhoud).not.toContainText('helemaal geen data');
  });

  test('een klant zonder datakwaliteitscijfer krijgt geen "undefined procent"', async ({ page }) => {
    // Bij de aangesloten klanten is dat veld nooit ingevuld. Het stond er
    // letterlijk als "Datakwaliteit undefined procent", in de kleur van een
    // slechte score -- terwijl niet gemeten iets anders is dan slecht.
    await liveLogin(page);
    await ga(page, '#/agency/clients/proefklant', { wacht: 1200 });

    const inhoud = page.locator('.page-root');
    await expect(inhoud).not.toContainText('undefined');
    await expect(inhoud).toContainText('Datakwaliteit niet vastgesteld');
  });

  test('de kanalen van de klant komen uit zijn eigen reeks', async ({ page }) => {
    await liveLogin(page);
    await ga(page, '#/agency/clients/proefklant', { wacht: 1200 });
    // Google Ads heeft rijen, Meta niet -- dat hoort niet als leeg kanaal te
    // verschijnen maar helemaal niet.
    const inhoud = await page.locator('.page-root').innerText();
    expect(inhoud).toContain('Google Ads');
    expect(inhoud).not.toContain('Microsoft Ads');
  });

  test('zonder reeksen blijft de voorbeelddata staan en valt er niets om', async ({ page }) => {
    // Een stukke reeksvraag mag het dashboard niet meenemen: dan blijft de
    // voorbeelddata staan, en dat is een toestand die de app kent.
    await page.route('**/api/reeks*', (route) => route.fulfill({
      status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'stuk' }),
    }));
    const fouten = [];
    page.on('pageerror', (e) => fouten.push(e.message));

    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/clients', { wacht: 900 });

    expect(fouten, fouten.join('\n')).toEqual([]);
    await expect(page.locator('.page-root')).toBeVisible();
  });
});
