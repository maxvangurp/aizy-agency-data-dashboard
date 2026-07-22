import { test, expect } from '@playwright/test';
import { login, ga, ACCOUNTS, DEMO_WACHTWOORD, foutenVerzamelen, canvasIsGevuld } from './helpers.js';

/**
 * Tests voor accounts, rollen, routebeveiliging en datascheiding.
 *
 * De isolatietests kijken bewust naar de volledige tekst van de pagina en
 * niet alleen naar zichtbare kaarten. Data die met CSS is verborgen staat nog
 * steeds in de DOM en telt dus als lek.
 */

const NIET_TOEGANKELIJK_VOOR_MEDEWERKER = ['Meridiaan', 'Tafelwerk', 'Draadloos', 'Kaap Noord', 'Noordlicht'];

/* ---------------------------------------------------------------
   Authenticatie
   --------------------------------------------------------------- */

test.describe('Authenticatie', () => {
  test('zonder sessie verschijnt het inlogscherm', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => location.hash)).toContain('/login');
    await expect(page.getByRole('heading', { name: 'Inloggen' })).toBeVisible();
  });

  test('een agencybeheerder kan inloggen en komt op het agencyoverzicht', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    expect(await page.evaluate(() => location.hash)).toBe('#/agency/overview');
    await expect(page.locator('#pageRoot h1')).toContainText('Portefeuilleoverzicht');
  });

  test('een agencymedewerker komt op zijn eigen overzicht', async ({ page }) => {
    await login(page, ACCOUNTS.medewerker);
    expect(await page.evaluate(() => location.hash)).toBe('#/agency/overview');
    // De medewerker begint bij zijn werkdag, niet bij de portefeuille.
    await expect(page.locator('#pageRoot h1')).toContainText('Berry');
    await expect(page.getByRole('link', { name: 'Mijn klanten' })).toBeVisible();
  });

  test('een klantgebruiker komt direct in de eigen klantomgeving', async ({ page }) => {
    await login(page, ACCOUNTS.klantAdmin);
    expect(await page.evaluate(() => location.hash)).toBe('#/client/overview');
    await expect(page.locator('#pageRoot h1')).toContainText('Vitaalpunt');
  });

  test('een onjuiste combinatie geeft een nette melding', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForSelector('#loginEmail');
    await page.fill('#loginEmail', ACCOUNTS.admin);
    await page.fill('#loginWachtwoord', 'onjuist');
    await page.click('#loginKnop');
    await page.waitForTimeout(500);

    await expect(page.locator('.banner-danger')).toContainText('klopt niet');
    expect(await page.evaluate(() => location.hash)).toContain('/login');
  });

  test('een ongeldig e-mailadres wordt afgewezen', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForSelector('#loginEmail');
    await page.fill('#loginEmail', 'geen-adres');
    await page.fill('#loginWachtwoord', DEMO_WACHTWOORD);
    await page.click('#loginKnop');
    await page.waitForTimeout(500);
    await expect(page.locator('.banner-danger')).toBeVisible();
  });

  test('een uitgenodigd account kan nog niet inloggen', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForSelector('#loginEmail');
    await page.fill('#loginEmail', ACCOUNTS.uitgenodigd);
    await page.fill('#loginWachtwoord', DEMO_WACHTWOORD);
    await page.click('#loginKnop');
    await page.waitForTimeout(500);
    await expect(page.locator('.banner-danger')).toContainText('uitnodiging');
  });

  test('uitloggen beëindigt de sessie', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await page.click('#accountKnop');
    await page.click('#menuUitloggen');
    await page.waitForTimeout(600);

    expect(await page.evaluate(() => location.hash)).toContain('/login');
    expect(await page.evaluate(() => localStorage.getItem('aizy.session'))).toBeNull();
  });

  test('de sessie blijft behouden na een refresh', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await page.reload();
    await page.waitForTimeout(700);
    expect(await page.evaluate(() => location.hash)).not.toContain('/login');
    await expect(page.locator('#accountKnop')).toContainText('Enrico');
  });

  test('een beschadigde sessie wordt opgeruimd', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await page.evaluate(() => localStorage.setItem('aizy.session', '{dit is geen json'));
    await page.reload();
    await page.waitForTimeout(700);

    await expect(page.getByRole('heading', { name: 'Inloggen' })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('aizy.session'))).toBeNull();
  });

  test('wachtwoord tonen en verbergen werkt', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForSelector('#loginWachtwoord');
    await expect(page.locator('#loginWachtwoord')).toHaveAttribute('type', 'password');
    await page.click('#toonWachtwoord');
    await expect(page.locator('#loginWachtwoord')).toHaveAttribute('type', 'text');
    await page.click('#toonWachtwoord');
    await expect(page.locator('#loginWachtwoord')).toHaveAttribute('type', 'password');
  });

  test('een demo-account vult het formulier in', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForSelector('.demo-account');
    await page.locator('.demo-account').first().click();
    await expect(page.locator('#loginEmail')).toHaveValue(ACCOUNTS.admin);
    await expect(page.locator('#loginWachtwoord')).toHaveValue(DEMO_WACHTWOORD);
  });
});

/* ---------------------------------------------------------------
   Herstel en uitnodiging
   --------------------------------------------------------------- */

test.describe('Herstel en uitnodiging', () => {
  test('wachtwoord vergeten geeft een neutrale melding', async ({ page }) => {
    await page.goto('/index.html#/forgot-password');
    await page.waitForSelector('#forgotEmail');
    await page.fill('#forgotEmail', 'bestaat.niet@voorbeeld.demo');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(400);

    const melding = await page.locator('.banner').textContent();
    // De melding mag niet verklappen of het account bestaat.
    expect(melding).toContain('Als er een account');
    expect(melding).not.toContain('niet gevonden');
  });

  test('een uitnodiging accepteren activeert het account', async ({ page }) => {
    await page.goto('/index.html#/accept-invite');
    await page.waitForSelector('#inviteEmail');
    await page.fill('#inviteEmail', ACCOUNTS.uitgenodigd);
    await page.fill('#inviteWachtwoord', 'nieuwwachtwoord');
    await page.check('#naamBevestigd');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(700);

    expect(await page.evaluate(() => location.hash)).toContain('/agency');
  });

  test('een uitnodiging zonder bevestiging wordt geweigerd', async ({ page }) => {
    await page.goto('/index.html#/accept-invite');
    await page.waitForSelector('#inviteEmail');
    await page.fill('#inviteEmail', ACCOUNTS.uitgenodigd);
    await page.fill('#inviteWachtwoord', 'nieuwwachtwoord');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(400);
    await expect(page.locator('.banner-danger')).toBeVisible();
  });
});

/* ---------------------------------------------------------------
   Autorisatie
   --------------------------------------------------------------- */

test.describe('Autorisatie', () => {
  test('een beheerder ziet alle klanten', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/clients');
    const rijen = page.locator('#pageRoot tbody tr');
    expect(await rijen.count()).toBe(7);
  });

  test('een medewerker ziet alleen toegewezen klanten', async ({ page }) => {
    await login(page, ACCOUNTS.medewerker);
    await ga(page, '#/agency/clients');
    const rijen = page.locator('#pageRoot tbody tr');
    expect(await rijen.count()).toBe(2);
    await expect(page.locator('#pageRoot')).toContainText('Vitaalpunt');
    await expect(page.locator('#pageRoot')).toContainText('Havenkwartier');
  });

  test('een medewerker kan een niet-toegewezen klant niet via de URL openen', async ({ page }) => {
    await login(page, ACCOUNTS.medewerker);
    await ga(page, '#/agency/clients/meridiaan');
    await expect(page.getByRole('heading', { name: 'Geen toegang' })).toBeVisible();
    await expect(page.locator('body')).not.toContainText('Meridiaan Bedrijfsadvies');
  });

  test('een medewerker kan teambeheer niet openen', async ({ page }) => {
    await login(page, ACCOUNTS.medewerker);
    await ga(page, '#/agency/team');
    await expect(page.getByRole('heading', { name: 'Geen toegang' })).toBeVisible();
  });

  test('een klantgebruiker kan geen agencyroute openen', async ({ page }) => {
    await login(page, ACCOUNTS.klantViewer);
    for (const route of ['#/agency/overview', '#/agency/clients', '#/agency/team']) {
      await ga(page, route);
      await expect(page.getByRole('heading', { name: 'Geen toegang' })).toBeVisible();
    }
  });

  test('een meekijker kan gebruikersbeheer niet openen', async ({ page }) => {
    await login(page, ACCOUNTS.klantViewer);
    await ga(page, '#/client/users');
    await expect(page.getByRole('heading', { name: 'Geen toegang' })).toBeVisible();
  });

  test('een klantbeheerder kan gebruikersbeheer wel openen', async ({ page }) => {
    await login(page, ACCOUNTS.klantAdmin);
    await ga(page, '#/client/users');
    await expect(page.getByRole('heading', { name: 'Gebruikers' })).toBeVisible();
  });

  test('alleen agencygebruikers zien de contextwisselaar', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await expect(page.locator('#contextSelect')).toBeVisible();

    await login(page, ACCOUNTS.klantAdmin);
    await expect(page.locator('#contextSelect')).toHaveCount(0);
  });

  test('een onbekende route toont een 404-status', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/bestaat-echt-niet');
    await expect(page.getByRole('heading', { name: 'Pagina niet gevonden' })).toBeVisible();
  });
});

/* ---------------------------------------------------------------
   Data-isolatie
   --------------------------------------------------------------- */

test.describe('Data-isolatie', () => {
  test('namen van niet-toegankelijke klanten staan niet in de DOM', async ({ page }) => {
    await login(page, ACCOUNTS.medewerker);

    for (const route of ['#/agency/overview', '#/agency/clients', '#/agency/signals', '#/agency/actions']) {
      await ga(page, route);
      const html = await page.content();
      for (const naam of NIET_TOEGANKELIJK_VOOR_MEDEWERKER) {
        expect(html, `${naam} lekt op ${route}`).not.toContain(naam);
      }
    }
  });

  test('niet-toegankelijke klanten staan niet in de contextwisselaar', async ({ page }) => {
    await login(page, ACCOUNTS.medewerker);
    const opties = await page.locator('#contextSelect option').allTextContents();
    const samen = opties.join(' ');
    for (const naam of NIET_TOEGANKELIJK_VOOR_MEDEWERKER) {
      expect(samen).not.toContain(naam);
    }
    expect(samen).toContain('Vitaalpunt');
  });

  test('de totalen van een medewerker bevatten alleen toegewezen klanten', async ({ page }) => {
    await login(page, ACCOUNTS.medewerker);
    await ga(page, '#/agency/overview');

    // Vitaalpunt 11.820 plus Havenkwartier 9.400 is 21.220 euro.
    await expect(page.locator('.kpi-row').first()).toContainText('21.220');
    await expect(page.locator('.kpi-row').first()).toContainText('2');
  });

  test('een klantgebruiker ziet geen signalen', async ({ page }) => {
    await login(page, ACCOUNTS.klantAdmin);
    const html = await page.content();
    // Signalen bevatten interne bureautaal die niet voor de klant bedoeld is.
    expect(html).not.toContain('Aanbevolen actie');
    expect(html).not.toContain('Mogelijke oorzaak');
  });

  test('een klantgebruiker ziet geen informatie van andere klanten', async ({ page }) => {
    await login(page, ACCOUNTS.klantViewer);
    const html = await page.content();
    for (const naam of ['Vitaalpunt', 'Havenkwartier', 'Tafelwerk', 'Draadloos', 'Kaap Noord']) {
      expect(html, `${naam} lekt in de klantomgeving`).not.toContain(naam);
    }
    expect(html).toContain('Meridiaan');
  });

  test('een aangepaste klantcontext in localStorage geeft geen toegang', async ({ page }) => {
    await login(page, ACCOUNTS.medewerker);

    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('aizy.session'));
      s.contextClientId = 'meridiaan';
      localStorage.setItem('aizy.session', JSON.stringify(s));
    });
    await ga(page, '#/client/overview');

    // De context wordt geweigerd, dus de gebruiker belandt weer bij zijn eigen lijst.
    await expect(page.locator('body')).not.toContainText('Meridiaan Bedrijfsadvies');
    expect(await page.evaluate(() => location.hash)).toContain('/agency');
  });
});

/* ---------------------------------------------------------------
   Weergaven
   --------------------------------------------------------------- */

test.describe('Weergaven', () => {
  test('het agencyoverzicht scheidt e-commerce en leadgeneratie', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    const sectie = page.locator('.card').filter({ hasText: 'Resultaten per dashboardtype' });

    await expect(sectie).toContainText('E-commerce');
    await expect(sectie).toContainText('Leadgeneratie');
    await expect(sectie).toContainText('Gemiddeld rendement');
    await expect(sectie).toContainText('Gemiddelde kosten per lead');
    // De twee mogen niet tot één gemiddelde zijn samengevoegd.
    await expect(sectie).toContainText('niet onderling vergelijkbaar');
  });

  test('het klantenoverzicht toont statussen met onderbouwing', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/clients');
    const tabel = page.locator('#pageRoot table');

    await expect(tabel).toContainText('Meetprobleem');
    await expect(tabel).toContainText('doelen liggen onder het doel');
  });

  test('het klantenoverzicht kan worden gefilterd en gesorteerd', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/clients');

    await page.selectOption('#klantType', 'leadgen');
    await page.waitForTimeout(400);
    expect(await page.locator('#pageRoot tbody tr').count()).toBe(3);

    await page.selectOption('#klantType', '');
    await page.waitForTimeout(400);
    await page.fill('#klantZoek', 'kaap');
    await page.waitForTimeout(500);
    expect(await page.locator('#pageRoot tbody tr').count()).toBe(1);
  });

  test('teambeheer toont rollen, status en toewijzingen', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/team');
    const tabel = page.locator('#pageRoot table');

    await expect(tabel).toContainText('Agencybeheerder');
    await expect(tabel).toContainText('Aizy-medewerker');
    await expect(tabel).toContainText('Uitgenodigd');
    await expect(tabel).toContainText('Alle klanten');
    // Functietitel en toegangsniveau staan in aparte kolommen.
    await expect(tabel).toContainText('Performance Lead');
    await expect(tabel).toContainText('Operational Manager');
  });

  test('een medewerker deactiveren werkt binnen de demo', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/team');

    page.on('dialog', (d) => d.accept());
    await page.locator('[data-actie="deactiveer"]').first().click();
    await page.waitForTimeout(500);
    await expect(page.locator('.banner-info')).toContainText('gedeactiveerd');
  });

  test('de contextwisselaar opent de klantweergave met contextbalk', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await page.selectOption('#contextSelect', 'vitaalpunt');
    await page.waitForTimeout(800);

    await expect(page.locator('.contextbalk')).toContainText('Vitaalpunt');
    await expect(page.locator('.contextbalk')).toContainText('als Aizy-medewerker');
    expect(await page.evaluate(() => location.hash)).toContain('/client');
  });

  test('terug naar agency verlaat de klantcontext', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await page.selectOption('#contextSelect', 'vitaalpunt');
    await page.waitForTimeout(700);
    await page.click('#terugNaarAgency');
    await page.waitForTimeout(700);

    await expect(page.locator('.contextbalk')).toHaveCount(0);
    expect(await page.evaluate(() => location.hash)).toContain('/agency');
  });

  test('grafieken tekenen in de klantweergave', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await page.selectOption('#contextSelect', 'vitaalpunt');
    await page.waitForTimeout(1200);
    expect(await canvasIsGevuld(page, 'chart-klant-funnel')).toBe(true);
  });

  test('een e-commerceklant rendert in de klantweergave', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await page.selectOption('#contextSelect', 'tafelwerk');
    await page.waitForTimeout(1200);
    await expect(page.locator('#pageRoot h1')).toContainText('Tafelwerk');
    await expect(page.getByRole('heading', { name: 'E-commerce funnel' })).toBeVisible();
  });

  test('een medewerker zonder toewijzingen krijgt uitleg, geen leeg scherm', async ({ page }) => {
    // Tim is actief maar heeft geen toewijzingen.
    await login(page, ACCOUNTS.medewerkerZonderKlanten);

    await expect(page.locator('#geenKlanten')).toContainText('geen klanten aan je account toegewezen');
    await expect(page.locator('#pageRoot canvas')).toHaveCount(0);
  });
});

/* ---------------------------------------------------------------
   Toegankelijkheid en accountmenu
   --------------------------------------------------------------- */

test.describe('Accountmenu', () => {
  test('het menu toont naam, rol en organisatie', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await page.click('#accountKnop');
    const paneel = page.locator('#accountPaneel');

    await expect(paneel).toBeVisible();
    await expect(paneel).toContainText('Enrico van de Lindeloof');
    // Functietitel en toegangsniveau staan als twee afzonderlijke gegevens.
    await expect(paneel).toContainText('Performance Lead');
    await expect(paneel).toContainText('Agencybeheerder');
    await expect(paneel).toContainText('Aizy');
  });

  test('Escape sluit het accountmenu', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await page.click('#accountKnop');
    await expect(page.locator('#accountPaneel')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('#accountPaneel')).toBeHidden();
    await expect(page.locator('#accountKnop')).toHaveAttribute('aria-expanded', 'false');
  });

  test('klikken buiten het menu sluit het', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await page.click('#accountKnop');
    await expect(page.locator('#accountPaneel')).toBeVisible();

    await page.locator('#pageRoot h1').click();
    await expect(page.locator('#accountPaneel')).toBeHidden();
  });
});

test.describe('Responsive', () => {
  test('op mobiel blijft het accountmenu bereikbaar', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, ACCOUNTS.admin);

    await expect(page.locator('#accountKnop')).toBeVisible();
    await expect(page.locator('#menuKnop')).toBeVisible();

    await page.click('#menuKnop');
    await page.waitForTimeout(300);
    await expect(page.locator('#sidebar')).toHaveClass(/open/);
  });

  test('er ontstaat geen horizontale overloop op mobiel', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/clients');

    const overloop = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    );
    expect(overloop).toBe(false);
  });
});
