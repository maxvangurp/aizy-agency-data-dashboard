import { test, expect } from '@playwright/test';
import { login, ga, ACCOUNTS, AIZY_TEAM, foutenVerzamelen } from './helpers.js';

/**
 * Tests voor terminologie, het team en de context.
 *
 * De regels die hier worden bewaakt:
 *   - een label is zonder aanvullende uitleg te begrijpen;
 *   - twee begrippen worden nooit tot één label samengevoegd;
 *   - een functietitel is geen toegangsniveau;
 *   - interne codewaarden komen niet op het scherm;
 *   - een gebruiker weet altijd waar hij is en voor wie hij kijkt.
 */

/** Interne waarden die nergens zichtbaar mogen zijn. */
const INTERNE_WAARDEN = ['agency_admin', 'agency_employee', 'client_admin', 'client_viewer'];

/* ---------------------------------------------------------------
   Het Aizy Performance Team
   --------------------------------------------------------------- */

test.describe('Aizy Performance Team', () => {
  test('alle negen medewerkers staan in het teamoverzicht met de juiste spelling', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/team');

    const tabel = page.locator('#pageRoot table');
    for (const lid of AIZY_TEAM) {
      await expect(tabel, `${lid.naam} ontbreekt of is verkeerd gespeld`).toContainText(lid.naam);
    }
  });

  test('functietitel en toegangsniveau staan in afzonderlijke kolommen', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/team');

    const rij = page.locator('tbody tr').filter({ hasText: 'Enrico van de Lindeloof' });
    const cellen = await rij.locator('td').allTextContents();

    // De functietitel staat in een eigen cel, los van het toegangsniveau.
    expect(cellen.some((c) => c.trim() === 'Performance Lead')).toBe(true);
    expect(cellen.some((c) => c.includes('Agencybeheerder'))).toBe(true);
    // Nooit samengevoegd tot iets als "Performance Lead-admin".
    expect(cellen.some((c) => /Performance Lead.?[-·]?\s?(admin|beheerder)/i.test(c))).toBe(false);
  });

  test('Enrico en Jim zijn agencybeheerder, de rest is Aizy-medewerker', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/team');

    for (const naam of ['Enrico van de Lindeloof', 'Jim Egging']) {
      const rij = page.locator('tbody tr').filter({ hasText: naam });
      await expect(rij, `${naam} zou beheerder moeten zijn`).toContainText('Agencybeheerder');
    }
    for (const naam of ['Benito Perez', 'Berry Vermeulen', 'Erik Nieuwenhuijs', 'Jip van Leest']) {
      const rij = page.locator('tbody tr').filter({ hasText: naam });
      await expect(rij, `${naam} zou medewerker moeten zijn`).toContainText('Aizy-medewerker');
    }
  });

  test('alle demo-accounts gebruiken het fictieve domein aizy.demo', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/team');

    const html = await page.content();
    for (const lid of AIZY_TEAM) {
      expect(html).toContain(lid.email);
    }
    // Geen echte adressen in de demo.
    expect(html).not.toContain('@aizy.nl');
    expect(html).not.toContain('@aizy.com');
  });

  test('het teamoverzicht toont verantwoordelijkheid en ondersteuning apart', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/team');

    const kop = page.locator('#pageRoot thead');
    await expect(kop).toContainText('Verantwoordelijk voor');
    await expect(kop).toContainText('Ondersteunt bij');
    await expect(kop).toContainText('Functietitel');
    await expect(kop).toContainText('Toegangsniveau');
    await expect(kop).toContainText('Accountstatus');
  });

  test('het teamoverzicht bevat geen prestatieranglijst', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/team');

    const tekst = (await page.locator('#pageRoot').textContent()) ?? '';
    for (const woord of ['score', 'ranking', 'ranglijst', 'productiviteit', 'responstijd', 'beoordeling']) {
      expect(tekst.toLowerCase(), `${woord} hoort niet in een teamoverzicht`).not.toContain(woord);
    }
    await expect(page.locator('#pageRoot')).toContainText('geen prestatie per medewerker');
  });

  test('een medewerkerdetail toont naam, functietitel en toegangsniveau afzonderlijk', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/team/u-benito');

    await expect(page.locator('#pageRoot h1')).toHaveText('Benito Perez');
    const tabel = page.locator('#pageRoot table').first();
    await expect(tabel).toContainText('Performance Marketeer');
    await expect(tabel).toContainText('Aizy-medewerker');
    await expect(tabel).toContainText('benito@aizy.demo');
  });

  test('klanttoewijzingen worden per gebruiker gerespecteerd', async ({ page }) => {
    await login(page, ACCOUNTS.medewerkerEcommerce);
    await ga(page, '#/agency/clients');

    // Erik beheert de drie e-commerceklanten en geen andere.
    const tabel = page.locator('#pageRoot table');
    for (const naam of ['Tafelwerk', 'Draadloos', 'Kaap Noord']) {
      await expect(tabel).toContainText(naam);
    }
    const html = await page.content();
    for (const naam of ['Vitaalpunt', 'Meridiaan', 'Havenkwartier', 'Noordlicht']) {
      expect(html, `${naam} lekt bij Erik`).not.toContain(naam);
    }
  });

  test('een medewerker zonder klanten krijgt uitleg en een vervolgstap', async ({ page }) => {
    await login(page, ACCOUNTS.medewerkerZonderKlanten);

    const blok = page.locator('#geenKlanten');
    await expect(blok).toContainText('geen klanten aan je account toegewezen');
    await expect(blok).toContainText('agencybeheerder');
  });

  test('gelijke initialen leiden niet tot verwarring in toegankelijke namen', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/team');

    // Thyra van der Schoor en Tim Suijkerbuijk hebben allebei de initialen TS.
    for (const naam of ['Thyra van der Schoor', 'Tim Suijkerbuijk']) {
      await expect(page.locator('tbody tr').filter({ hasText: naam })).toHaveCount(1);
    }

    await ga(page, '#/agency/team/u-thyra');
    // De avatar draagt de volledige naam als toegankelijke naam.
    await expect(page.getByRole('img', { name: 'Thyra van der Schoor' }).first()).toBeVisible();
  });

  test('het inlogscherm toont naam en toegangsniveau als aparte gegevens', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForSelector('.demo-account');

    const eerste = page.locator('.demo-account').first();
    await expect(eerste.locator('.demo-account-naam')).toHaveText('Enrico van de Lindeloof');
    await expect(eerste.locator('.demo-account-niveau')).toHaveText('Agencybeheerder');
    await expect(page.locator('.demo-accounts')).toContainText('fictief');
  });
});

/* ---------------------------------------------------------------
   Terminologie
   --------------------------------------------------------------- */

test.describe('Terminologie', () => {
  const ROUTES = [
    '#/agency/overview', '#/agency/clients', '#/agency/signals',
    '#/agency/actions', '#/agency/team', '#/agency/settings',
    '#/agency/clients/vitaalpunt', '#/agency/clients/tafelwerk', '#/agency/clients/noordlicht',
  ];

  test('interne rolwaarden komen nergens op het scherm', async ({ page }) => {
    await login(page, ACCOUNTS.admin);

    for (const route of ROUTES) {
      await ga(page, route, { wacht: 400 });
      const zichtbaar = (await page.locator('#pageRoot').innerText()).toLowerCase();
      for (const waarde of INTERNE_WAARDEN) {
        expect(zichtbaar, `${waarde} lekt op ${route}`).not.toContain(waarde);
      }
    }
  });

  test('het label Meekijker bestaat niet meer', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/team');
    expect(await page.content()).not.toContain('Meekijker');

    await login(page, ACCOUNTS.klantAdmin);
    await ga(page, '#/client/users');
    const tabel = page.locator('#pageRoot table');
    await expect(tabel).not.toContainText('Meekijker');
    await expect(tabel).toContainText('Alleen bekijken');
  });

  test('rol en organisatie worden nooit tot één label samengevoegd', async ({ page }) => {
    await login(page, ACCOUNTS.klantViewer);
    const html = await page.content();

    // Combinaties als "Meekijker · Meridiaan" mogen niet voorkomen.
    expect(html).not.toMatch(/Meekijker\s*[·|]\s*Meridiaan/);
    expect(html).not.toMatch(/Alleen bekijken\s*[·|]\s*Meridiaan/);

    await page.click('#accountKnop');
    const paneel = page.locator('#accountPaneel');
    // Vier afzonderlijke gegevens, elk met een eigen label.
    await expect(paneel).toContainText('Organisatie');
    await expect(paneel).toContainText('Toegangsniveau');
    await expect(paneel).toContainText('Functietitel');
    await expect(paneel).toContainText('Meridiaan Bedrijfsadvies');
    await expect(paneel).toContainText('Alleen-lezen klantgebruiker');
  });

  test('afkortingen krijgen altijd een volledige naam of uitleg', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/clients/vitaalpunt');

    const cpl = page.locator('.kpi[data-label="Kosten per lead"]').first();
    await expect(cpl).toBeVisible();
    await expect(cpl.locator('.kpi-kort')).toHaveText('CPL');
    await expect(cpl.locator('.kpi-uitleg')).toContainText('advertentie-uitgaven gedeeld door');

    const cpql = page.locator('.kpi[data-label="Kosten per gekwalificeerde lead"]').first();
    await expect(cpql).toBeVisible();
    await expect(cpql.locator('.kpi-kort')).toHaveText('CPQL');
  });

  test('tabelkoppen gebruiken volledige begrippen', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/clients');

    const kop = page.locator('#pageRoot thead').first();
    await expect(kop).toContainText('Verantwoordelijke medewerker');
    await expect(kop).toContainText('Dashboardtype');
    await expect(kop).toContainText('Advertentie-uitgaven');
    // Geen kale Engelse of technische kolomnamen.
    await expect(kop).not.toContainText('Owner');
    await expect(kop).not.toContainText('Delta');
    await expect(kop).not.toContainText('Updated');
  });

  test('klantnamen worden volledig en consistent weergegeven', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/clients');

    const tabel = page.locator('#pageRoot table');
    for (const naam of ['Vitaalpunt Fysiotherapie', 'Meridiaan Bedrijfsadvies', 'Kaap Noord Outdoor']) {
      await expect(tabel).toContainText(naam);
    }
  });

  test('ontbrekende waarden krijgen een specifieke reden', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/clients/havenkwartier');

    const kaart = page.locator('.kpi[data-label="Gekwalificeerde leads"]').first();
    await expect(kaart).toContainText('Onvoldoende data');
    await expect(kaart).toContainText('Geen CRM-koppeling');
    // Geen kaal streepje als verzamelbak voor alles wat ontbreekt.
    await expect(kaart.locator('.kpi-value')).not.toHaveText('–');
    await expect(kaart.locator('.kpi-value')).not.toHaveText('-');
  });
});

/* ---------------------------------------------------------------
   Context
   --------------------------------------------------------------- */

test.describe('Context en locatie', () => {
  test('iedere agencypagina heeft een kruimelpad en een omgevingslabel', async ({ page }) => {
    await login(page, ACCOUNTS.admin);

    for (const route of ['#/agency/portfolio', '#/agency/clients', '#/agency/signals', '#/agency/team']) {
      await ga(page, route, { wacht: 400 });
      await expect(page.locator('.kruimelpad'), route).toBeVisible();
      await expect(page.locator('.app-grid'), route).toHaveAttribute('data-omgeving', 'agency');
    }
  });

  test('het klantdetail benoemt dat het een interne agencyweergave is', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/clients/vitaalpunt');

    await expect(page.locator('.paginakop')).toContainText('Agencyweergave');
    await expect(page.locator('.paginakop')).toContainText('interne informatie die de klant niet ziet');
    await expect(page.locator('#internTitel')).toBeVisible();
  });

  test('een Aizy-medewerker in de klantweergave ziet een duidelijke klantcontext', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await page.selectOption('#contextSelect', 'vitaalpunt');
    await page.waitForTimeout(800);

    // De actieve klant staat in de zijnavigatie en de omgeving is klant.
    await expect(page.locator('.nav-klant-naam')).toContainText('Vitaalpunt');
    await expect(page.locator('.app-grid')).toHaveAttribute('data-omgeving', 'client');
    // De klantkiezer in de bovenbalk toont de gekozen klant.
    await expect(page.locator('#contextSelect')).toHaveValue('vitaalpunt');
  });

  test('een klantgebruiker ziet geen agencycontext', async ({ page }) => {
    await login(page, ACCOUNTS.klantAdmin);

    await expect(page.locator('.app-grid')).toHaveAttribute('data-omgeving', 'client');
    await expect(page.locator('#contextSelect')).toHaveCount(0);
    await expect(page.locator('.sidebar')).not.toContainText('Team');
  });

  test('de paginatitel volgt de route', async ({ page }) => {
    await login(page, ACCOUNTS.admin);

    await ga(page, '#/agency/clients');
    expect(await page.title()).toContain('Klanten');

    await ga(page, '#/agency/team');
    expect(await page.title()).toContain('Team');
  });

  test('de navigatie is taakgericht en verschilt per rol', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    let links = (await page.locator('.nav-link').allTextContents()).map((t) => t.trim());
    // Een beheerder start bij de portefeuille en heeft toegang tot team en systeem.
    expect(links).toContain('Portefeuille');
    expect(links).toContain('Team');
    expect(links).toContain('Integraties');
    expect(links).not.toContain('Vandaag');

    await login(page, ACCOUNTS.medewerker);
    links = (await page.locator('.nav-link').allTextContents()).map((t) => t.trim());
    // Een medewerker start bij zijn eigen dag en beheert geen team.
    expect(links).toContain('Vandaag');
    expect(links).toContain('Mijn klanten');
    expect(links).not.toContain('Team');
    expect(links).not.toContain('Integraties');
  });

  test('de klantnavigatie toont alleen wat dit account werkelijk mag openen', async ({ page }) => {
    await login(page, ACCOUNTS.klantAdmin);
    let links = (await page.locator('.nav-link').allTextContents()).map((t) => t.trim());
    // Een klantbeheerder mag samenwerken en gebruikers beheren.
    expect(links).toContain('Samenvatting');
    expect(links).toContain('Acties');
    expect(links).toContain('Gebruikers');

    await login(page, ACCOUNTS.klantViewer);
    links = (await page.locator('.nav-link').allTextContents()).map((t) => t.trim());
    // Een alleen-lezen gebruiker beheert geen gebruikers en ziet geen conversies.
    expect(links).toContain('Samenvatting');
    expect(links).not.toContain('Gebruikers');
  });

  test('geen enkele navigatielink leidt naar een geen-toegangpagina', async ({ page }) => {
    const errors = foutenVerzamelen(page);

    for (const account of [ACCOUNTS.admin, ACCOUNTS.medewerker, ACCOUNTS.klantAdmin, ACCOUNTS.klantViewer]) {
      await login(page, account);
      const hrefs = await page.locator('.nav-link').evaluateAll((els) => els.map((e) => e.getAttribute('href')));
      for (const href of hrefs) {
        await ga(page, href, { wacht: 300 });
        await expect(page.getByRole('heading', { name: 'Geen toegang' }), `${account} op ${href}`).toHaveCount(0);
      }
    }
    expect(errors).toEqual([]);
  });

  test('een alleen-lezen klantgebruiker komt niet via de URL bij de conversiepagina', async ({ page }) => {
    await login(page, ACCOUNTS.klantViewer);
    await ga(page, '#/client/conversions');
    await expect(page.getByRole('heading', { name: 'Geen toegang' })).toBeVisible();
  });

  test('de actieve filtercontext is op iedere pagina zichtbaar', async ({ page }) => {
    await login(page, ACCOUNTS.admin);

    for (const route of ['#/agency/portfolio', '#/agency/clients', '#/agency/clients/vitaalpunt']) {
      await ga(page, route, { wacht: 400 });
      // De actieve periode staat altijd zichtbaar in de bovenbalk, ook wanneer
      // het volledige filterpaneel dicht is.
      // De periodeknop in de bovenbalk toont de actieve periode, altijd zichtbaar.
      await expect(page.locator('#filterToggle'), route).toBeVisible();
      await expect(page.locator('#filterToggle'), route).toContainText('Periode');
    }
  });
});
