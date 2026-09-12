import { test, expect } from '@playwright/test';
import { ACCOUNTS } from './helpers.js';

/**
 * De GA4-module in de simpele modus.
 *
 * Deze tests bewaken het doorslaggevende punt van de module: het klanttype
 * bepaalt de inhoud. Een leadgeneratieklant hoort geen winkelwagenrapport te
 * zien, een webshop geen contactinteracties, en een klant zonder vastgesteld
 * type hoort een uitleg te krijgen in plaats van lege kaarten.
 *
 * De module leest uit Supabase; zolang migratie 019 niet gedraaid is, is de
 * verwachte toestand "nog niet ingericht" mét de stap die nodig is. Dat is geen
 * randgeval maar de eerste toestand die een gebruiker ziet, dus die wordt hier
 * net zo goed bewaakt als de gevulde variant.
 */

/**
 * Inloggen, met een eigen GA4-antwoord in de demo-store.
 *
 * Het dashboard draait in de demomodus op voorbeelddata en doet dan geen
 * fetch, dus een onderschepte route zou nooit aan bod komen. `aizy.demo.ga4`
 * is dezelfde demo-store die de Databronnen-pagina gebruikt: daarmee is elke
 * situatie te tonen zonder server. Het zetten gebeurt ná het opschonen, want
 * dat verwijdert alle `aizy.demo.*`-sleutels.
 */
async function simpelLogin(page, email, ga4 = null) {
  await page.goto('/index.html');
  await page.evaluate((payload) => {
    localStorage.setItem('aizy.theme', 'light');
    localStorage.removeItem('aizy.session');
    localStorage.removeItem('aizy.state');
    Object.keys(localStorage).filter((k) => k.startsWith('aizy.demo.')).forEach((k) => localStorage.removeItem(k));
    if (payload) localStorage.setItem('aizy.demo.ga4', JSON.stringify(payload));
    window.location.hash = '#/login';
  }, ga4);
  await page.reload();
  await page.waitForSelector('#startLoginForm');
  await page.fill('#startLoginForm [name="email"]', email);
  await page.fill('#startLoginForm [name="wachtwoord"]', 'demo123');
  await page.click('#startLoginForm button[type="submit"]');
  await page.waitForFunction(() => window.location.hash.includes('/pulse'));
  await page.waitForTimeout(600);
}

const PERIODE = { start: '2026-08-15', eind: '2026-09-11' };
const VERGELIJKING = { start: '2026-07-18', eind: '2026-08-14', label: 'Vorige periode', beschikbaar: true };

const kpi = (sleutel, label, waarde, eenheid) => ({
  sleutel, label, eenheid, definitie: 'Een definitie die lang genoeg is om te tonen.',
  waarde, vorige: waarde, gemeten: waarde != null,
  verandering: { absoluut: 0, procent: 0, vanNul: false }, voorbehoud: null, secundair: false,
});

const LEADGEN = {
  status: 'ok',
  klant: { slug: 'waltmann', naam: 'Waltmann' },
  klanttype: 'leadgen',
  prioriteit: null,
  property: { id: '530478933', naam: 'www.waltmann.com', tijdzone: 'Europe/Amsterdam', valuta: 'EUR' },
  doelen: { leads: ['form_submit_zoekopdracht'], contactinteracties: ['click_telefoon'] },
  periode: PERIODE,
  vergelijking: VERGELIJKING,
  kpis: [
    { sleutel: 'context', titel: 'Websiteverkeer', uitleg: 'Hele site.', kpis: [kpi('sessies', 'Sessies', 6206, 'aantal')] },
    {
      sleutel: 'leads', titel: 'Leadgeneratie', uitleg: 'Gemeten op form_submit_zoekopdracht.',
      nietIngericht: false,
      kpis: [
        kpi('aanvragen', 'Aanvragen', 145, 'aantal'),
        kpi('leadratio', 'Sessies met een aanvraag', 2.19, 'procent'),
        kpi('contact', 'Contactklikken', 66, 'aantal'),
      ],
    },
  ],
  tabellen: {
    kanaal: {
      doorsnede: 'kanaal', groepen: ['leads', 'contactinteracties'], totaalSessies: 6206, somSessies: 6206,
      rijen: [{
        segment: 'Organic Search', onbekend: false, sessies: 1789, engagement: 70, omzet: null,
        resultaten: { leads: { events: 27, sessies: 24, ratio: 1.34, perEvent: [{ event: 'form_submit_zoekopdracht', aantal: 27 }] },
          contactinteracties: { events: 12, sessies: 11, ratio: 0.6, perEvent: [{ event: 'click_telefoon', aantal: 12 }] } },
      }],
      dekking: null,
    },
  },
  producten: null,
  stappen: null,
  meldingen: [],
  synchronisatie: { opgehaaldOp: '2026-09-12T08:00:00.000Z', nogInVerwerking: false },
  inzichten: [],
};

const ECOMMERCE = {
  ...LEADGEN,
  klant: { slug: 'fittwear', naam: 'FITTwear.nl' },
  klanttype: 'ecommerce',
  doelen: { aankopen: ['purchase'] },
  kpis: [
    { sleutel: 'context', titel: 'Websiteverkeer', uitleg: 'Hele site.', kpis: [kpi('sessies', 'Sessies', 14779, 'aantal')] },
    {
      sleutel: 'aankopen', titel: 'E-commerce', uitleg: 'Door GA4 gemeten aankopen.',
      nietIngericht: false,
      kpis: [
        kpi('aankopen', 'Aankopen', 220, 'aantal'),
        kpi('omzet', 'Aankoopomzet', 15062.13, 'geld'),
        kpi('orderwaarde', 'Gemiddelde orderwaarde', 68.46, 'geld'),
      ],
    },
  ],
  tabellen: {
    kanaal: {
      doorsnede: 'kanaal', groepen: ['aankopen'], totaalSessies: 14779, somSessies: 14779,
      heeftVergelijking: true,
      rijen: [
        {
          segment: 'Paid Search', onbekend: false, sessies: 1783, engagement: 82, omzet: 5388.19, aankopen: 80,
          resultaten: { aankopen: { events: 80, sessies: 80, ratio: 4.49, perEvent: [{ event: 'purchase', aantal: 80 }],
            vorig: 60, verandering: {absoluut: 20, procent: 33.3, vanNul: false} } },
          sessiesVorig: 1500, sessiesVerandering: {absoluut: 283, procent: 18.9, vanNul: false},
          omzetVorig: 4000, omzetVerandering: {absoluut: 1388.19, procent: 34.7, vanNul: false}, nieuw: false,
        },
        {
          segment: 'Email', onbekend: false, sessies: 220, engagement: 70, omzet: 9000, aankopen: 11,
          resultaten: { aankopen: { events: 11, sessies: 11, ratio: 5, perEvent: [{ event: 'purchase', aantal: 11 }],
            vorig: 0, verandering: {absoluut: 11, procent: null, vanNul: true} } },
          sessiesVorig: 0, sessiesVerandering: {absoluut: 220, procent: null, vanNul: true},
          omzetVorig: 0, omzetVerandering: {absoluut: 9000, procent: null, vanNul: true}, nieuw: false,
        },
      ],
      dekking: null,
    },
  },
  producten: {
    heeftVergelijking: true,
    rijen: [
      { product: 'Stay In Place Short', bekeken: 963, inWinkelwagen: 55, gekocht: 6, omzet: 148,
        koopratio: 0.62, gekochtVorig: 4, gekochtVerandering: {absoluut: 2, procent: 50, vanNul: false},
        omzetVorig: 98, omzetVerandering: {absoluut: 50, procent: 51, vanNul: false}, nieuw: false },
      { product: 'Hold & Go Legging', bekeken: 949, inWinkelwagen: 163, gekocht: 0, omzet: 0,
        koopratio: 0, gekochtVorig: 0, gekochtVerandering: {absoluut: 0, procent: null, vanNul: false},
        omzetVorig: 0, omzetVerandering: {absoluut: 0, procent: null, vanNul: false}, nieuw: false },
      { product: 'Power Bra Sepia', bekeken: 400, inWinkelwagen: 90, gekocht: 30, omzet: 1500,
        koopratio: 7.5, gekochtVorig: null, gekochtVerandering: null,
        omzetVorig: null, omzetVerandering: null, nieuw: true },
    ],
  },
  stappen: [
    { event: 'view_item', label: 'Product bekeken', gemeten: true, aantal: 40070, sessies: 6835 },
    { event: 'add_to_cart', label: 'In winkelwagen', gemeten: true, aantal: 2974, sessies: 1800 },
    // Een stap die deze shop niet meet. Dat hoort als "niet gemeten" te
    // verschijnen en niet als nul: nul zou zeggen dat niemand die stap zette.
    { event: 'add_payment_info', label: 'Betaalgegevens ingevuld', gemeten: false, aantal: null, sessies: null },
    { event: 'purchase', label: 'Aankoop', gemeten: true, aantal: 220, sessies: 220 },
  ],
};

async function naarWebsite(page) {
  await page.click('.simpel-nav-item:has-text("Website")');
  await page.waitForTimeout(500);
}

test.describe('GA4-module — het klanttype bepaalt de inhoud', () => {
  test('de Website-pagina staat in de navigatie', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.admin);
    await expect(page.locator('.simpel-nav-item', { hasText: 'Website' })).toBeVisible();
  });

  test('een leadgeneratieklant ziet aanvragen en geen winkelwagen', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.admin, LEADGEN);
    await naarWebsite(page);

    await expect(page.locator('#simpelInhoud h1')).toHaveText('Website');
    await expect(page.locator('[data-groep="leads"]')).toBeVisible();
    await expect(page.locator('[data-kpi="aanvragen"]')).toContainText('145');

    // Geen e-commerceonderdelen: die zouden leeg zijn en dan lezen als slechte
    // prestaties in plaats van als niet van toepassing.
    await expect(page.locator('[data-groep="aankopen"]')).toHaveCount(0);
    await expect(page.locator('#ga4-producten')).toHaveCount(0);
    await expect(page.locator('#simpelInhoud')).not.toContainText('Gemiddelde orderwaarde');
  });

  test('een leadgeneratieklant houdt contactklikken los van aanvragen', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.admin, LEADGEN);
    await naarWebsite(page);

    await expect(page.locator('[data-kpi="contact"]')).toContainText('66');
    // En de pagina zegt erbij waarom het geen lead is.
    await expect(page.locator('#ga4-leads')).toContainText('niet gemeten of er daadwerkelijk contact volgde');
  });

  test('een e-commerceklant ziet aankopen, omzet en producten', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.admin, ECOMMERCE);
    await naarWebsite(page);

    await expect(page.locator('[data-groep="aankopen"]')).toBeVisible();
    await expect(page.locator('[data-kpi="omzet"]')).toContainText('15.062');
    await expect(page.locator('#ga4-producten')).toContainText('Stay In Place Short');

    // Geen leadonderdelen.
    await expect(page.locator('[data-groep="leads"]')).toHaveCount(0);
    await expect(page.locator('#ga4-leads')).toHaveCount(0);
  });

  test('het aankoopproces toont stapvolumes zonder uitvalpercentages', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.admin, ECOMMERCE);
    await naarWebsite(page);

    const blok = page.locator('#ga4-producten');
    await expect(blok).toContainText('40.070');
    await expect(blok).toContainText('geen trechter');

    // Geen uitvalkolom. Op de tekst toetsen kan hier niet: de pagina legt juist
    // uit dát er geen uitvalpercentages staan, en dan matcht het woord wel.
    // Wat telt is dat er geen kolom is die uitval suggereert.
    const koppen = await blok.locator('thead th').allInnerTexts();
    expect(koppen.some((k) => /uitval|verlies|drop/i.test(k))).toBe(false);
    // De kop wordt in hoofdletters weergegeven; vergelijken op de tekst zoals
    // hij gerenderd is, niet zoals hij in de code staat.
    expect(koppen.map((k) => k.toLowerCase())).toContain('gebeurtenissen');

    // En een stap die niet gemeten wordt staat als zodanig, niet als nul.
    await expect(blok).toContainText('niet gemeten');
  });

  test('een gecombineerde klant ziet beide doelen, gescheiden', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.admin, {
      ...LEADGEN,
      klanttype: 'beide',
      prioriteit: 'leads',
      doelen: { leads: ['conversion_offerte'], contactinteracties: ['conversion_phone_click'], aankopen: ['purchase'] },
      kpis: [...LEADGEN.kpis, ECOMMERCE.kpis[1]],
      producten: ECOMMERCE.producten,
      stappen: ECOMMERCE.stappen,
    });
    await naarWebsite(page);

    await expect(page.locator('[data-groep="leads"]')).toBeVisible();
    await expect(page.locator('[data-groep="aankopen"]')).toBeVisible();
    // De gekozen voorrang bepaalt de volgorde.
    const groepen = await page.locator('.ga4-kpi-groep').evaluateAll((els) => els.map((e) => e.dataset.groep));
    expect(groepen).toEqual(['context', 'leads', 'aankopen']);
  });

  test('een klant zonder vastgesteld type krijgt uitleg in plaats van lege kaarten', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.admin, {
      status: 'niet_ingericht', reden: 'geen_klanttype',
      melding: 'Voor deze klant is nog niet vastgesteld of het een leadgeneratie- of e-commerceklant is.',
    });
    await naarWebsite(page);

    await expect(page.locator('.ga4-leeg')).toContainText('nog niet ingericht');
    await expect(page.locator('.ga4-leeg')).toContainText('nog niet vastgesteld');
    await expect(page.locator('.kpi')).toHaveCount(0);
  });

  test('een inzicht houdt waarneming, verklaring en actie uit elkaar', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.admin, {
      ...LEADGEN,
      inzichten: [{
        code: 'aanvragen_dalen', titel: 'Minder aanvragen bij gelijkblijvend verkeer',
        waarneming: '60 aanvragen tegenover 100 in de vorige periode.',
        waarom: 'Er komen evenveel mensen, maar minder vragen iets aan.',
        verklaring: 'Mogelijk een wijziging aan het formulier.',
        actie: 'Loop de landingspaginas na.',
        onzekerheid: 'Dit telt gebeurtenissen, geen unieke aanvragers.',
        cijfers: { periode: PERIODE }, naar: { tab: 'landingspaginas' },
      }],
    });
    await naarWebsite(page);

    const kaart = page.locator('.ga4-inzicht[data-code="aanvragen_dalen"]');
    await expect(kaart).toBeVisible();
    await expect(kaart).toContainText('Waarom dit telt');
    await expect(kaart).toContainText('Mogelijke verklaring');
    await expect(kaart).toContainText('Volgende stap');
    await expect(kaart.locator('.ga4-inzicht-voorbehoud')).toContainText('geen unieke aanvragers');
  });

  test('zonder inzichten staat er waarom er niets staat', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.admin, LEADGEN);
    await naarWebsite(page);
    await expect(page.locator('.ga4-inzichten-leeg')).toContainText('Geen opvallende veranderingen');
  });

  test('property, tijdzone en valuta staan bij de instellingen', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.admin, LEADGEN);
    await naarWebsite(page);

    await expect(page.locator('.ga4-property')).toContainText('Europe/Amsterdam');
    await expect(page.locator('.ga4-property')).toContainText('530478933');
    await expect(page.locator('#simpelInhoud')).toContainText('form_submit_zoekopdracht');
  });

  test('een periode die nog verwerkt wordt, wordt gemeld', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.admin, {
      ...LEADGEN,
      synchronisatie: { opgehaaldOp: '2026-09-12T08:00:00.000Z', nogInVerwerking: true },
    });
    await naarWebsite(page);
    await expect(page.locator('.ga4-meldingen')).toContainText('48 uur');
  });

  test('een vergelijking met een lege periode wordt als zodanig gemeld', async ({ page }) => {
    // Waltmanns property is van maart 2026. Een vergelijking met september 2025
    // toont nul tegenover duizenden, en dat leest als explosieve groei. De
    // cijfers blijven staan -- ze zijn waar -- maar de pagina zegt wat het is.
    await simpelLogin(page, ACCOUNTS.admin, {
      ...LEADGEN,
      vergelijking: {
        ...VERGELIJKING, start: '2025-08-15', eind: '2025-09-11', label: 'Vorig jaar',
        voorbehoud: 'In de vergelijkingsperiode is geen enkel bezoek gemeten. Waarschijnlijk '
          + 'bestond deze property toen nog niet.',
      },
    });
    await naarWebsite(page);
    await expect(page.locator('.ga4-meldingen')).toContainText('geen enkel bezoek gemeten');
  });

  test('de vensterkeuze staat op de pagina en legt uit waarom hij eigen is', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.admin, LEADGEN);
    await naarWebsite(page);

    const keuze = page.locator('.ga4-venster');
    await expect(keuze.locator('[data-venster="7"]')).toBeVisible();
    await expect(keuze.locator('[data-venster="28"]')).toHaveClass(/actief/);
    await expect(keuze.locator('[data-venster="90"]')).toBeVisible();
    await expect(keuze).toContainText('eigen periode en niet het filter bovenaan');

    // De keuze staat in de hash, zodat hij deelbaar is en een herlading overleeft.
    await expect(keuze.locator('[data-venster="7"]')).toHaveAttribute('href', /venster=7/);
  });

  test('een ontbrekende vergelijking zegt waarom hij ontbreekt', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.admin, {
      ...LEADGEN,
      vergelijking: {
        start: '2026-07-18', eind: '2026-08-14', label: 'Vorige periode', beschikbaar: false,
        reden: 'De conversiedefinitie is tussen deze twee perioden gewijzigd; de cijfers zijn niet vergelijkbaar.',
      },
    });
    await naarWebsite(page);
    await expect(page.locator('.ga4-periode')).toContainText('conversiedefinitie');
  });

  test('een tabelkolom is sorteerbaar op de waarde, niet op de tekst', async ({ page }) => {
    // "€ 1.225,65" sorteert als tekst tussen "€ 114" en "€ 130". Op omzet
    // sorteren moet de grootste bovenaan zetten, niet ergens in het midden.
    await simpelLogin(page, ACCOUNTS.admin, ECOMMERCE);
    await naarWebsite(page);

    const tabel = page.locator('[data-ia-table="ga4-producten-tabel"]');
    await expect(tabel).toBeVisible();

    // Op de aria-label en niet op de zichtbare tekst: de knop bevat naast het
    // label ook een sorteerpijl, en "Omzet" komt ook voor in "Omzet t.o.v. …".
    const omzetKop = tabel.getByRole('button', { name: 'Sorteer op Omzet', exact: true });
    await omzetKop.click();
    await omzetKop.click(); // tweede klik: aflopend, grootste bovenaan
    const eerste = await tabel.locator('tbody tr').first().locator('td').first().innerText();
    expect(eerste).toContain('Power Bra Sepia');
  });

  test('sorteren op gekocht geeft een andere volgorde dan op omzet', async ({ page }) => {
    // Welk product het vaakst verkocht is en welk product het meeste opleverde
    // zijn verschillende vragen; bij uiteenlopende prijzen ook verschillende
    // antwoorden.
    await simpelLogin(page, ACCOUNTS.admin, ECOMMERCE);
    await naarWebsite(page);

    const tabel = page.locator('[data-ia-table="ga4-producten-tabel"]');
    const gekocht = tabel.getByRole('button', { name: 'Sorteer op Gekocht', exact: true });
    await gekocht.click();
    await gekocht.click();
    const bovenste = await tabel.locator('tbody tr').first().locator('td').first().innerText();
    expect(bovenste).toContain('Power Bra Sepia');

    const bekeken = tabel.getByRole('button', { name: 'Sorteer op Bekeken', exact: true });
    await bekeken.click();
    await bekeken.click();
    const nu = await tabel.locator('tbody tr').first().locator('td').first().innerText();
    expect(nu).toContain('Stay In Place Short');
  });

  test('elke rij toont de verandering tegenover de vorige periode', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.admin, ECOMMERCE);
    await naarWebsite(page);

    const acquisitie = page.locator('#ga4-acquisitie');
    await expect(acquisitie).toContainText('t.o.v.');
    // Paid Search: 1.783 sessies tegenover 1.500.
    await expect(acquisitie.locator('tbody tr').first()).toContainText('+283');
  });

  test('een rij die van nul komt krijgt geen percentage', async ({ page }) => {
    // Van niets naar 220 is geen oneindige groei en geen honderd procent.
    await simpelLogin(page, ACCOUNTS.admin, ECOMMERCE);
    await naarWebsite(page);

    const email = page.locator('#ga4-acquisitie tbody tr', { hasText: 'Email' });
    await expect(email).toContainText('vanaf nul');
  });

  test('een product dat nieuw is wordt als nieuw gemarkeerd', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.admin, ECOMMERCE);
    await naarWebsite(page);
    const rij = page.locator('[data-ia-table="ga4-producten-tabel"] tbody tr', { hasText: 'Power Bra Sepia' });
    await expect(rij.locator('.ga4-nieuw')).toBeVisible();
  });

  test('een tabel is doorzoekbaar en exporteerbaar', async ({ page }) => {
    await simpelLogin(page, ACCOUNTS.admin, ECOMMERCE);
    await naarWebsite(page);

    const houder = page.locator('#ga4-producten-tabel');
    await houder.locator('.ia-zoek').fill('legging');
    await expect(houder.locator('tbody tr:visible')).toHaveCount(1);
    await expect(houder.locator('.ia-export')).toBeVisible();
  });

  test('de pagina werkt op een telefoonscherm zonder horizontale overloop', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await simpelLogin(page, ACCOUNTS.admin, ECOMMERCE);
    await naarWebsite(page);

    const overloop = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overloop).toBe(false);
  });
});
