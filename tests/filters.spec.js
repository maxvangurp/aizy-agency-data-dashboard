import { test, expect } from '@playwright/test';
import {
  login, ga, ACCOUNTS, foutenVerzamelen, filterState, zetPeriode, zetVergelijking,
  kiesKanalen, kpiWaarde, canvasHandtekening, openFilters,
} from './helpers.js';

/**
 * Tests voor het centrale filtersysteem.
 *
 * De uitgangspunten die hier worden bewaakt:
 *   - de referentiedatum is vast, dus datums zijn exact te controleren;
 *   - filters sturen echte data aan en zijn niet cosmetisch;
 *   - een filter kan nooit data zichtbaar maken die de gebruiker niet mag zien;
 *   - een ontbrekende meting blijft ontbrekend en wordt nooit nul.
 */

const DEMO_TODAY = '2026-07-22';

/* ---------------------------------------------------------------
   Filterstate
   --------------------------------------------------------------- */

test.describe('Filterstate', () => {
  test('het standaardfilter wordt geladen zonder dat de URL vervuilt', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    const f = await filterState(page);

    expect(f.periode).toBe('last_30_days');
    expect(f.van).toBe('2026-06-23');
    expect(f.tot).toBe(DEMO_TODAY);
    expect(f.vergelijking).toBe('previous_period');
    expect(f.conversie).toBe('primary');
    // Standaardwaarden horen niet in de URL te staan.
    expect(await page.evaluate(() => location.hash)).toBe('#/agency/portfolio');
  });

  test('de periode kan worden gewijzigd en komt in de URL', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await zetPeriode(page, 'last_7_days');

    const f = await filterState(page);
    expect(f.periode).toBe('last_7_days');
    expect(f.van).toBe('2026-07-16');
    expect(f.dagen).toBe(7);
    expect(await page.evaluate(() => location.hash)).toContain('period=last_7_days');
  });

  test('de kanaalselectie kan worden gewijzigd', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await kiesKanalen(page, ['google_ads']);

    const f = await filterState(page);
    expect(f.kanalen).toEqual(['google_ads']);
    expect(await page.evaluate(() => location.hash)).toContain('channels=google_ads');
  });

  test('de conversiescope kan worden gewijzigd binnen een klant', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/clients/vitaalpunt');

    await openFilters(page);
    await page.selectOption('#filterConversie', 'secondary');
    await page.waitForTimeout(600);

    const f = await filterState(page);
    expect(f.conversie).toBe('secondary');
    expect(await page.evaluate(() => location.hash)).toContain('conv=secondary');
  });

  test('resetten herstelt alle standaardwaarden', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await zetPeriode(page, 'last_7_days');
    await kiesKanalen(page, ['meta_ads']);

    await page.click('#filterReset');
    await page.waitForTimeout(600);

    const f = await filterState(page);
    expect(f.periode).toBe('last_30_days');
    expect(f.kanalen.length).toBeGreaterThan(1);
    expect(await page.evaluate(() => location.hash)).toBe('#/agency/portfolio');
  });

  test('een geldige selectie overleeft een refresh', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await zetPeriode(page, 'last_90_days');

    await page.reload();
    await page.waitForTimeout(900);

    const f = await filterState(page);
    expect(f.periode).toBe('last_90_days');
    expect(f.van).toBe('2026-04-24');
  });

  test('een selectie in de URL wordt hersteld en wint van de voorkeur', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await zetPeriode(page, 'last_7_days');

    // De URL bevat een andere, expliciete keuze dan de zojuist bewaarde voorkeur.
    await ga(page, '#/agency/overview?period=last_month&compare=previous_year', { wacht: 800 });

    const f = await filterState(page);
    expect(f.periode).toBe('last_month');
    expect(f.van).toBe('2026-06-01');
    expect(f.tot).toBe('2026-06-30');
    expect(f.vergelijking).toBe('previous_year');
    expect(f.vglVan).toBe('2025-06-01');
  });

  test('beschadigde filterstate wordt genormaliseerd in plaats van gebruikt', async ({ page }) => {
    const errors = foutenVerzamelen(page);
    await login(page, ACCOUNTS.admin);

    await page.evaluate(() => {
      localStorage.setItem('aizy.filters.u-enrico', '{dit is geen json');
    });
    await ga(page, '#/agency/overview?period=bestaat-niet&channels=hackerskanaal&conv=onzin', { wacht: 800 });

    const f = await filterState(page);
    expect(f.periode).toBe('last_30_days');
    expect(f.kanalen).not.toContain('hackerskanaal');
    expect(f.kanalen.length).toBeGreaterThan(0);
    expect(f.conversie).toBe('primary');
    expect(errors).toEqual([]);
  });

  test('uitloggen verwijdert de gebruikersgebonden filterstate', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await zetPeriode(page, 'last_7_days');

    expect(await page.evaluate(() =>
      Object.keys(localStorage).some((k) => k.startsWith('aizy.filters.')))).toBe(true);

    await page.click('#accountKnop');
    await page.click('#menuUitloggen');
    await page.waitForTimeout(700);

    expect(await page.evaluate(() =>
      Object.keys(localStorage).some((k) => k.startsWith('aizy.filters.')))).toBe(false);
  });

  test('een andere gebruiker erft de selectie van zijn voorganger niet', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await zetPeriode(page, 'last_7_days');
    expect((await filterState(page)).periode).toBe('last_7_days');

    await login(page, ACCOUNTS.medewerker);
    const f = await filterState(page);
    expect(f.periode).toBe('last_30_days');
  });
});

/* ---------------------------------------------------------------
   Periodeberekeningen
   --------------------------------------------------------------- */

test.describe('Periodeberekeningen', () => {
  const gevallen = [
    { preset: 'last_7_days', van: '2026-07-16', tot: DEMO_TODAY, dagen: 7 },
    { preset: 'last_30_days', van: '2026-06-23', tot: DEMO_TODAY, dagen: 30 },
    { preset: 'last_90_days', van: '2026-04-24', tot: DEMO_TODAY, dagen: 90 },
    { preset: 'this_month', van: '2026-07-01', tot: DEMO_TODAY, dagen: 22 },
    { preset: 'last_month', van: '2026-06-01', tot: '2026-06-30', dagen: 30 },
    { preset: 'this_quarter', van: '2026-07-01', tot: DEMO_TODAY, dagen: 22 },
  ];

  for (const geval of gevallen) {
    test(`${geval.preset} levert ${geval.van} tot en met ${geval.tot}`, async ({ page }) => {
      await login(page, ACCOUNTS.admin);
      await zetPeriode(page, geval.preset);

      const f = await filterState(page);
      expect(f.van).toBe(geval.van);
      expect(f.tot).toBe(geval.tot);
      // Beide grenzen tellen mee.
      expect(f.dagen).toBe(geval.dagen);
    });
  }

  test('de vorige periode heeft dezelfde duur en sluit direct aan', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await zetPeriode(page, 'last_7_days');

    const f = await filterState(page);
    expect(f.vglVan).toBe('2026-07-09');
    expect(f.vglTot).toBe('2026-07-15');
  });

  test('een lopende maand wordt vergeleken met dezelfde verstreken dagen', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await zetPeriode(page, 'this_month');
    await zetVergelijking(page, 'previous_month');

    const f = await filterState(page);
    // 1 tot en met 22 juli tegenover 1 tot en met 22 juni, geen hele maand.
    expect(f.van).toBe('2026-07-01');
    expect(f.vglVan).toBe('2026-06-01');
    expect(f.vglTot).toBe('2026-06-22');
  });

  test('een afgeronde maand wordt vergeleken met de volledige voorgaande maand', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await zetPeriode(page, 'last_month');

    const f = await filterState(page);
    expect(f.vglVan).toBe('2026-05-01');
    // Mei heeft 31 dagen tegenover juni 30; een afgeronde maand hoort tegenover
    // een volledige maand te staan, niet tegenover een venster van 30 dagen.
    expect(f.vglTot).toBe('2026-05-31');
  });

  test('een aangepast bereik wordt gevalideerd en zichtbaar hersteld', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    // Einddatum in de toekomst en begin na eind: beide worden gecorrigeerd.
    await ga(page, '#/agency/overview?period=custom&from=2026-12-31&to=2026-07-10', { wacht: 800 });

    const f = await filterState(page);
    expect(f.periode).toBe('custom');
    expect(f.van).toBe('2026-07-10');
    expect(f.tot).toBe('2026-12-31' > DEMO_TODAY ? DEMO_TODAY : '2026-12-31');
    await expect(page.locator('#filterCorrecties')).toBeVisible();
  });

  test('een aangepast bereik toont datumvelden binnen het designsysteem', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await zetPeriode(page, 'custom');

    await expect(page.locator('#filterVan')).toBeVisible();
    await expect(page.locator('#filterTot')).toBeVisible();
    await expect(page.locator('#filterTot')).toHaveAttribute('max', DEMO_TODAY);

    const hoogte = await page.locator('#filterVan').evaluate((el) => el.getBoundingClientRect().height);
    expect(hoogte).toBeGreaterThan(30);
  });

  test('zonder vergelijking verdwijnt het vergelijkingsvenster', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await zetVergelijking(page, 'none');

    const f = await filterState(page);
    expect(f.vergelijking).toBe('none');
    expect(f.vglVan).toBe('');
  });
});

/* ---------------------------------------------------------------
   Tenantisolatie
   --------------------------------------------------------------- */

test.describe('Tenantisolatie van filters', () => {
  test('een medewerker ziet alleen kanalen van toegewezen klanten', async ({ page }) => {
    await login(page, ACCOUNTS.medewerker);
    const f = await filterState(page);

    // Vitaalpunt en Havenkwartier hebben geen LinkedIn Ads; dat kanaal hoort
    // dus niet in haar filter te staan.
    expect(f.kanalen).not.toContain('linkedin_ads');
    expect(f.kanalen).toContain('google_ads');

    const opties = await page.locator('input[name="filterKanaal"]').evaluateAll((els) => els.map((e) => e.value));
    expect(opties).not.toContain('linkedin_ads');
  });

  test('een beheerder ziet wel alle kanalen', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    const f = await filterState(page);
    expect(f.kanalen).toContain('linkedin_ads');
  });

  test('een klantgebruiker ziet alleen de kanalen van de eigen organisatie', async ({ page }) => {
    await login(page, ACCOUNTS.klantViewer);
    const opties = await page.locator('input[name="filterKanaal"]').evaluateAll((els) => els.map((e) => e.value));

    // Meridiaan draait op Google Ads en LinkedIn Ads.
    expect(opties.sort()).toEqual(['google_ads', 'linkedin_ads']);
    expect(opties).not.toContain('microsoft_ads');
  });

  test('een onbevoegd kanaal in de URL wordt verwijderd en gemeld', async ({ page }) => {
    await login(page, ACCOUNTS.medewerker);
    await ga(page, '#/agency/overview?channels=google_ads,linkedin_ads', { wacht: 800 });

    const f = await filterState(page);
    expect(f.kanalen).toEqual(['google_ads']);
    await expect(page.locator('#filterCorrecties')).toContainText('LinkedIn Ads');
  });

  test('een onbevoegde klant-id in de URL blijft geweigerd, ook met filters erbij', async ({ page }) => {
    await login(page, ACCOUNTS.medewerker);
    await ga(page, '#/agency/clients/meridiaan?period=last_7_days', { wacht: 700 });

    await expect(page.getByRole('heading', { name: 'Geen toegang' })).toBeVisible();
    await expect(page.locator('body')).not.toContainText('Meridiaan Bedrijfsadvies');
  });

  test('agencytotalen bevatten alleen toegankelijke klanten, ook na filteren', async ({ page }) => {
    await login(page, ACCOUNTS.medewerker);
    await ga(page, '#/agency/clients?focus=alle', { wacht: 500 });

    // Een medewerker ziet uitsluitend zijn twee eigen klanten in de lijst.
    expect(await page.locator('.grid-tabel tbody tr').count()).toBe(2);

    await zetPeriode(page, 'last_7_days');
    expect(await page.locator('.grid-tabel tbody tr').count()).toBe(2);

    const html = await page.content();
    for (const naam of ['Meridiaan', 'Tafelwerk', 'Draadloos', 'Kaap Noord', 'Noordlicht']) {
      expect(html, `${naam} lekt na filteren`).not.toContain(naam);
    }
  });

  test('de filterbalk lekt geen klantnamen', async ({ page }) => {
    await login(page, ACCOUNTS.medewerker);
    const balk = await page.locator('.filterbalk-wrap').innerHTML();
    for (const naam of ['Meridiaan', 'Tafelwerk', 'Draadloos', 'Kaap Noord', 'Noordlicht', 'Vitaalpunt']) {
      expect(balk).not.toContain(naam);
    }
  });

  test('een klantgebruiker ziet geen agencybrede filteropties', async ({ page }) => {
    await login(page, ACCOUNTS.klantAdmin);
    await expect(page.locator('.filterbalk-wrap')).toHaveAttribute('data-variant', 'client');
    // Een klantgebruiker heeft geen klantkiezer in de bovenbalk.
    await expect(page.locator('#contextSelect')).toHaveCount(0);
  });
});

/* ---------------------------------------------------------------
   Data en KPI's
   --------------------------------------------------------------- */

test.describe('Filters sturen de data aan', () => {
  test('KPI\'s veranderen na periodefiltering', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/clients/vitaalpunt');

    const leads30 = await kpiWaarde(page, 'Totaal aantal leads');
    const spend30 = await kpiWaarde(page, 'Spend');

    await zetPeriode(page, 'last_7_days');
    const leads7 = await kpiWaarde(page, 'Totaal aantal leads');
    const spend7 = await kpiWaarde(page, 'Spend');

    expect(leads7).not.toBe(leads30);
    expect(spend7).not.toBe(spend30);
  });

  test('KPI\'s veranderen na kanaalfiltering', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/clients/vitaalpunt');

    const alles = await kpiWaarde(page, 'Spend');
    await kiesKanalen(page, ['google_ads']);
    const alleenGoogle = await kpiWaarde(page, 'Spend');

    expect(alleenGoogle).not.toBe(alles);
    await expect(page.locator('.filterbalk-wrap')).toHaveAttribute('data-kanalen', 'google_ads');
  });

  test('de vergelijking en de delta veranderen mee', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/clients/vitaalpunt');

    const kaart = page.locator('.kpi[data-label="Kosten per lead"]').first();
    await expect(kaart).toContainText('vorige periode');

    await zetVergelijking(page, 'none');
    await expect(kaart).toContainText('Geen vergelijking');

    await zetVergelijking(page, 'previous_year');
    await expect(kaart).toContainText('zelfde periode vorig jaar');
  });

  test('een ontbrekende meting blijft onvoldoende data, in elke periode', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/clients/havenkwartier');

    for (const preset of ['last_7_days', 'last_90_days', 'last_month']) {
      await zetPeriode(page, preset);
      const kaart = page.locator('.kpi[data-label="Gekwalificeerde leads"]').first();
      await expect(kaart, `${preset} maakt van null een nul`).toContainText('Onvoldoende data');
      await expect(kaart.locator('.kpi-value')).not.toHaveText('0');
    }
  });

  test('de funnel reageert op de periode', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/clients/vitaalpunt');
    await page.locator('.leadfunnel summary').click();

    const rij = () => page.locator('.leadfunnel tbody tr').first().textContent();
    const dertig = await rij();

    await zetPeriode(page, 'last_7_days');
    await page.locator('.leadfunnel summary').click();
    const zeven = await rij();

    expect(zeven).not.toBe(dertig);
  });

  test('de knelpuntanalyse zwijgt bij te weinig volume', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/clients/vitaalpunt');

    const banner = page.locator('.leadfunnel .banner-warning');
    await expect(banner).toContainText('grootste verlies');

    // Eén dag met één kanaal levert te weinig volume voor een conclusie.
    await ga(page, '#/agency/clients/vitaalpunt?period=custom&from=2026-07-22&to=2026-07-22&channels=microsoft_ads', { wacht: 800 });
    await expect(banner).toContainText('Onvoldoende data');
  });

  test('grafieken worden opnieuw getekend na een filterwijziging', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/clients/tafelwerk');
    await page.waitForTimeout(400);

    const voor = await canvasHandtekening(page, 'chart-omzet-kosten');
    expect(voor).not.toBeNull();

    await zetPeriode(page, 'last_7_days');
    await page.waitForTimeout(400);
    const na = await canvasHandtekening(page, 'chart-omzet-kosten');

    expect(na).not.toBeNull();
    expect(na).not.toBe(voor);
  });

  test('het klantverhaal reageert op de filters', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await page.selectOption('#contextSelect', 'vitaalpunt');
    await page.waitForTimeout(900);

    const blok = page.locator('#inzichten');
    const dertig = await blok.textContent();

    await zetPeriode(page, 'last_7_days');
    const zeven = await blok.textContent();

    expect(zeven).not.toBe(dertig);
  });

  test('het klantverhaal noemt de niet-meetbare uitkomsten expliciet', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await page.selectOption('#contextSelect', 'havenkwartier');
    await page.waitForTimeout(900);

    await expect(page.locator('#meetbeperkingen')).toContainText('Klantconversies zijn niet meetbaar');
  });

  test('de conversiescope stuurt de conversiecijfers aan', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await page.selectOption('#contextSelect', 'vitaalpunt');
    await page.waitForTimeout(900);
    await ga(page, '#/client/conversions', { wacht: 700 });

    await expect(page.locator('#pageRoot')).toContainText('Spoedaanvraag');
    await expect(page.locator('#pageRoot')).toContainText('Telefoonklik');
  });

  test('e-commerce biedt geen optie voor alle conversies samen', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/clients/tafelwerk');

    const waarden = await page.locator('#filterConversie option').evaluateAll((els) => els.map((e) => e.value));
    // Winkelwagen- en checkoutacties gaan aan dezelfde aankoop vooraf; optellen
    // zou dubbel tellen, dus die keuze bestaat hier bewust niet.
    expect(waarden).not.toContain('all');
    expect(waarden).toContain('primary');
  });
});

/* ---------------------------------------------------------------
   Budget en prognose
   --------------------------------------------------------------- */

test.describe('Budget en prognose', () => {
  test('de prognose gebruikt het werkelijke aantal verstreken dagen', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/clients/vitaalpunt');
    await zetPeriode(page, 'this_month');

    const blok = page.locator('.budget-blok');
    // Juli telt 31 dagen, waarvan er op de referentiedatum 22 verstreken zijn.
    await expect(blok).toContainText('22 van 31 dagen verstreken');
    await expect(blok).toContainText('Prognose op basis van 22 verstreken van 31 dagen');
    // De oude, vaste aanname van 21 dagen mag nergens meer staan.
    await expect(blok).not.toContainText('21 verstreken');
  });

  test('een afgeronde periode krijgt geen prognose', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/clients/vitaalpunt');
    await zetPeriode(page, 'last_month');

    const blok = page.locator('.budget-blok');
    await expect(blok).toContainText('Geen prognose');
    await expect(blok).toContainText('afgerond');
  });

  test('te weinig verstreken dagen levert geen prognose maar een uitleg', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/clients/vitaalpunt?period=custom&from=2026-07-01&to=2026-07-02', { wacht: 800 });

    const blok = page.locator('.budget-blok');
    await expect(blok).toContainText('Geen prognose');
  });
});

/* ---------------------------------------------------------------
   Navigatie en context
   --------------------------------------------------------------- */

test.describe('Filters en navigatie', () => {
  test('terug en vooruit lopen door de filterkeuzes', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await zetPeriode(page, 'last_7_days');
    await zetPeriode(page, 'last_90_days');

    await page.goBack();
    await page.waitForTimeout(700);
    expect((await filterState(page)).periode).toBe('last_7_days');

    await page.goForward();
    await page.waitForTimeout(700);
    expect((await filterState(page)).periode).toBe('last_90_days');
  });

  test('de periode blijft behouden bij het openen van een klant', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await zetPeriode(page, 'last_7_days');
    await ga(page, '#/agency/clients/vitaalpunt', { wacht: 800 });

    const f = await filterState(page);
    expect(f.periode).toBe('last_7_days');
  });

  test('een kanaal dat de klant niet heeft wordt zichtbaar gecorrigeerd', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    // Vitaalpunt draait niet op LinkedIn Ads.
    await ga(page, '#/agency/clients/vitaalpunt?channels=google_ads,linkedin_ads', { wacht: 800 });

    await expect(page.locator('#filterCorrecties')).toContainText('LinkedIn Ads');
    expect((await filterState(page)).kanalen).toEqual(['google_ads']);
  });

  test('agency- en klantcontext houden hun eigen selectie', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await zetPeriode(page, 'last_7_days');

    await ga(page, '#/agency/clients/meridiaan', { wacht: 800 });
    await zetPeriode(page, 'last_90_days');

    await ga(page, '#/agency/overview', { wacht: 800 });
    expect((await filterState(page)).periode).toBe('last_7_days');

    await ga(page, '#/agency/clients/meridiaan', { wacht: 800 });
    expect((await filterState(page)).periode).toBe('last_90_days');
  });
});

/* ---------------------------------------------------------------
   Toegankelijkheid en responsive gedrag
   --------------------------------------------------------------- */

test.describe('Filterbalk: bediening', () => {
  test('het kanaalmenu is met het toetsenbord te bedienen en sluit op Escape', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await openFilters(page);

    await page.click('#filterKanalenKnop');
    await expect(page.locator('#filterKanalenPaneel')).toBeVisible();
    await expect(page.locator('#filterKanalenKnop')).toHaveAttribute('aria-expanded', 'true');

    await page.keyboard.press('Escape');
    await expect(page.locator('#filterKanalenPaneel')).toBeHidden();
    await expect(page.locator('#filterKanalenKnop')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#filterKanalenKnop')).toBeFocused();
  });

  test('een klik buiten het kanaalmenu sluit het', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await openFilters(page);
    await page.click('#filterKanalenKnop');
    await expect(page.locator('#filterKanalenPaneel')).toBeVisible();

    // Een klik in het filterpaneel maar buiten het kanaalmenu sluit het menu.
    await page.locator('#filterSamenvatting').click();
    await expect(page.locator('#filterKanalenPaneel')).toBeHidden();
  });

  test('iedere filterkeuze heeft een zichtbaar label', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await openFilters(page);
    await expect(page.locator('label[for="filterPeriode"]')).toBeVisible();
    await expect(page.locator('label[for="filterVergelijking"]')).toBeVisible();
    await expect(page.locator('#filterKanalenLabel')).toBeVisible();
  });

  test('de actieve waarden staan als tekst in de bovenbalk', async ({ page }) => {
    await login(page, ACCOUNTS.admin);

    // De compacte knoppen in de bovenbalk tonen de actieve waarden altijd,
    // ook wanneer het volledige filterpaneel dicht is.
    await expect(page.locator('#filterToggle')).toContainText('jun 2026');
    await expect(page.locator('#filterToggleVergelijking')).toContainText('Vorige periode');
    await expect(page.locator('#filterToggleKanalen')).toContainText('Alle kanalen');
  });

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1280, height: 800 },
    { width: 1024, height: 768 },
    { width: 390, height: 844 },
  ]) {
    test(`de filterbalk past op ${viewport.width} bij ${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await login(page, ACCOUNTS.admin);

      // De actieve periode en de resetknop zijn altijd zichtbaar in de bovenbalk.
      await expect(page.locator('#filterToggle')).toBeVisible();
      await expect(page.locator('#filterReset')).toBeVisible();

      const overloop = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
      );
      expect(overloop, 'horizontale overloop').toBe(false);
    });
  }

  test('op mobiel openen de filters in een paneel en blijven ze resetbaar', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, ACCOUNTS.admin);

    // Het volledige paneel is ingevouwen; de actieve waarden blijven zichtbaar.
    await expect(page.locator('#filterPaneel')).toBeHidden();
    await expect(page.locator('#filterToggle')).toBeVisible();
    await expect(page.locator('#filterReset')).toBeVisible();

    await page.click('#filterToggle');
    await expect(page.locator('#filterPaneel')).toBeVisible();
    await expect(page.locator('#filterPeriode')).toBeVisible();

    const buiten = await page.locator('#filterPeriode').evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.right > window.innerWidth + 1 || r.left < -1;
    });
    expect(buiten).toBe(false);
  });
});
