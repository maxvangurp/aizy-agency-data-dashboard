import { test, expect } from '@playwright/test';
import { login, ga, ACCOUNTS, foutenVerzamelen } from './helpers.js';

/**
 * Tests voor de taakgerichte werkomgeving: de applicatieshell, de
 * configureerbare tabellen, het actiecentrum, het signaalcentrum, de planning,
 * de widgets en het detailpaneel.
 *
 * De rode draad is dat zichtbare controls iets doen en dat dezelfde gegevens in
 * elke weergave hetzelfde tonen. Een bord dat iets anders zegt dan de lijst is
 * een fout, geen cosmetisch detail.
 */

/* ---------------------------------------------------------------
   Applicatieshell en navigatie
   --------------------------------------------------------------- */

test.describe('Applicatieshell', () => {
  test('de navigatie is gegroepeerd en per rol verschillend', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    // Een beheerder ziet de systeemgroep met integraties.
    await expect(page.locator('.nav-groep-titel').filter({ hasText: 'Systeem' })).toBeVisible();
    await expect(page.locator('.nav-link').filter({ hasText: 'Integraties' })).toBeVisible();
  });

  test('de navigatie onthoudt de compacte stand', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await page.click('#navInklap');
    await expect(page.locator('.app-grid')).toHaveClass(/nav-compact/);

    await page.reload();
    await page.waitForTimeout(600);
    await expect(page.locator('.app-grid')).toHaveClass(/nav-compact/);
  });

  test('een navigatiegroep is in te klappen', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    const groep = page.locator('.nav-groep[data-groep="performance"]');
    await groep.locator('.nav-groep-kop').click();
    await page.waitForTimeout(300);
    // De groep die niet actief is, klapt dicht.
    await expect(groep.locator('.nav-lijst')).toBeHidden();
  });

  test('de contextbalk toont de actieve klant bij een klantweergave', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await page.selectOption('#contextSelect', 'tafelwerk');
    await page.waitForTimeout(700);
    await expect(page.locator('.nav-klant-naam')).toContainText('Tafelwerk');
  });
});

/* ---------------------------------------------------------------
   Portefeuille zonder herhaling
   --------------------------------------------------------------- */

test.describe('Portefeuille', () => {
  test('het portefeuilleoverzicht is opgedeeld in tabs en niet één lange pagina', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await expect(page.locator('.paginatab').filter({ hasText: 'Overzicht' })).toBeVisible();
    await expect(page.locator('.paginatab').filter({ hasText: 'Prioriteiten' })).toBeVisible();
    await expect(page.locator('.paginatab').filter({ hasText: 'Resultaten' })).toBeVisible();
  });

  test('iedere KPI opent de onderliggende lijst', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    const kaart = page.locator('.kpi-klikbaar').first();
    await expect(kaart).toHaveAttribute('href', /prioriteiten/);
  });

  test('de prioriteitenlijst toont reden, ernst en betrouwbaarheid', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/portfolio?tab=prioriteiten', { wacht: 500 });
    const kop = page.locator('.grid-tabel thead');
    await expect(kop).toContainText('Belangrijkste reden');
    await expect(kop).toContainText('Ernst');
    await expect(kop).toContainText('Betrouwbaarheid');
  });

  test('de kaartweergave toont dezelfde klanten als de lijst', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/portfolio?tab=prioriteiten', { wacht: 500 });
    const rijen = await page.locator('.grid-tabel tbody tr').count();

    await page.click('[data-weergavevorm="kaarten"]');
    await page.waitForTimeout(400);
    const kaarten = await page.locator('.klantkaart').count();
    expect(kaarten).toBe(rijen);
  });
});

/* ---------------------------------------------------------------
   Configureerbare tabellen
   --------------------------------------------------------------- */

test.describe('Configureerbare tabellen', () => {
  test('een kolom kan worden verborgen en de voorkeur wordt onthouden', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/actions', { wacht: 500 });

    await page.click('[data-grid-kolommen="acties"]');
    await page.uncheck('[data-grid-kolomkeuze="acties"][value="kanaal"]');
    await page.waitForTimeout(400);
    await expect(page.locator('.grid-tabel th[data-kolom="kanaal"]')).toHaveCount(0);

    await page.reload();
    await page.waitForTimeout(700);
    await expect(page.locator('.grid-tabel th[data-kolom="kanaal"]')).toHaveCount(0);
  });

  test('een kolom kan naar voren worden verplaatst met de toetsenbordknop', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/actions', { wacht: 500 });

    await page.click('[data-grid-kolommen="acties"]');
    const eersteVoor = await page.locator('[data-kolomlijst="acties"] .kolomrij').first().getAttribute('data-kolom');
    // Verplaats de tweede kolom naar voren.
    const tweede = page.locator('[data-kolomlijst="acties"] .kolomrij').nth(1);
    const tweedeKolom = await tweede.getAttribute('data-kolom');
    await tweede.locator('[data-grid-kolomop]').click();
    await page.waitForTimeout(400);
    const eersteNa = await page.locator('[data-kolomlijst="acties"] .kolomrij').first().getAttribute('data-kolom');
    expect(eersteNa).toBe(tweedeKolom);
    expect(eersteNa).not.toBe(eersteVoor);
  });

  test('een opgeslagen weergave werkt en is opnieuw te openen', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/actions', { wacht: 500 });

    // Filter op hoge prioriteit en sla dat op.
    await page.selectOption('[data-grid-filter="acties"][data-filter="prioriteit"]', 'hoog');
    await page.waitForTimeout(400);
    const gefilterd = await page.locator('.grid-tabel tbody tr').count();

    await page.click('[data-grid-weergaven="acties"]');
    await page.fill('[data-grid-weergavenaam="acties"]', 'Alleen hoog');
    await page.click('[data-grid-weergaveopslaan="acties"]');
    await page.waitForTimeout(400);

    // Wis het filter; de teller verandert weer.
    await page.selectOption('[data-grid-filter="acties"][data-filter="prioriteit"]', '');
    await page.waitForTimeout(400);
    expect(await page.locator('.grid-tabel tbody tr').count()).not.toBe(gefilterd);

    // Het weergavenpaneel staat na het opslaan nog open; pas de bewaarde
    // weergave opnieuw toe en de eerdere filtering keert terug.
    await page.locator('[data-grid-weergave="acties"]').filter({ hasText: 'Alleen hoog' }).click();
    await page.waitForTimeout(400);
    expect(await page.locator('.grid-tabel tbody tr').count()).toBe(gefilterd);
  });

  test('de standaardweergave kan worden hersteld', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/actions', { wacht: 500 });

    await page.click('[data-grid-kolommen="acties"]');
    await page.uncheck('[data-grid-kolomkeuze="acties"][value="kanaal"]');
    await page.waitForTimeout(300);
    await expect(page.locator('.grid-tabel th[data-kolom="kanaal"]')).toHaveCount(0);

    await page.click('[data-grid-herstel="acties"]');
    await page.waitForTimeout(400);
    await expect(page.locator('.grid-tabel th[data-kolom="kanaal"]')).toHaveCount(1);
  });

  test('bulkacties werken op de selectie', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/actions', { wacht: 500 });

    await page.locator('[data-grid-rijkeuze="acties"]').first().check();
    await page.waitForTimeout(300);
    await expect(page.locator('.grid-bulkbalk')).toBeVisible();
    await page.click('[data-grid-bulk="acties"][data-bulk="status-afgerond"]');
    await page.waitForTimeout(400);
    await expect(page.locator('.toast')).toContainText('bijgewerkt');
  });
});

/* ---------------------------------------------------------------
   Actiecentrum: lijst, bord en agenda delen dezelfde bron
   --------------------------------------------------------------- */

test.describe('Actiecentrum', () => {
  test('een nieuwe actie verschijnt in lijst, bord en agenda', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/actions', { wacht: 500 });

    await page.click('#nieuweActieKop');
    await page.fill('#actieTitel', 'Testactie voor de suite');
    await page.selectOption('#actieKlant', 'tafelwerk');
    await page.fill('#actieStart', '2026-07-23');
    await page.click('#nieuweActieForm button[type="submit"]');
    await page.waitForTimeout(500);

    await expect(page.locator('.grid-tabel')).toContainText('Testactie voor de suite');

    await ga(page, '#/agency/actions?tab=bord', { wacht: 400 });
    await expect(page.locator('.kanban')).toContainText('Testactie voor de suite');

    await ga(page, '#/agency/actions?tab=agenda&datum=2026-07-23', { wacht: 400 });
    await expect(page.locator('.agenda-week')).toContainText('Testactie voor de suite');
  });

  test('een statuswijziging op het bord is zichtbaar in de lijst', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/actions?tab=bord', { wacht: 500 });

    // Zet de eerste kaart via de keuzelijst op afgerond.
    const kaart = page.locator('.kanban-kaart').first();
    const titel = (await kaart.locator('.kanban-titel').textContent())?.trim();
    await kaart.locator('[data-actie-status]').selectOption('afgerond');
    await page.waitForTimeout(500);

    await ga(page, '#/agency/actions?tab=lijst', { wacht: 400 });
    await page.selectOption('[data-grid-filter="acties"][data-filter="status"]', 'afgerond');
    await page.waitForTimeout(400);
    await expect(page.locator('.grid-tabel')).toContainText(titel);
  });

  test('het detailpaneel wijzigt de actie zonder de lijst te verlaten', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/actions', { wacht: 500 });

    await page.locator('[data-actiepaneel]').first().click();
    await page.waitForTimeout(400);
    await expect(page.locator('.detailpaneel.is-open')).toBeVisible();
    // De lijst staat er nog naast.
    await expect(page.locator('.grid-tabel')).toBeVisible();

    await page.selectOption('.detailpaneel [name="prioriteit"]', 'hoog');
    await page.click('.detailpaneel [data-actie-form] button[type="submit"]');
    await page.waitForTimeout(400);
    await expect(page.locator('.toast')).toContainText('opgeslagen');
  });

  test('een actie toont zijn herkomstsignaal op het bord en opent het', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/actions?tab=bord', { wacht: 600 });
    // Acties die uit een signaal komen, tonen de koppeling ook op de kaart.
    const chip = page.locator('.kaart-signaalchip').first();
    await expect(chip).toBeVisible();
    await chip.click();
    await page.waitForTimeout(400);
    await expect(page.locator('.detailpaneel.is-open')).toBeVisible();
  });
});

/* ---------------------------------------------------------------
   Signaalcentrum
   --------------------------------------------------------------- */

test.describe('Signaalcentrum', () => {
  test('een actie inplannen vanuit een signaal maakt precies één gekoppelde actie', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/signals', { wacht: 500 });

    const kaart = page.locator('.signaalkaart[data-fase="actie_nodig"]').first();
    const sid = await kaart.getAttribute('data-signaal');
    await kaart.locator('[data-signaal-plan]').click();
    await page.waitForSelector('#planDatum');
    await page.selectOption('#planVerantwoordelijke', { index: 1 });
    await page.fill('#planDatum', '2026-07-25');
    await page.locator('[data-plan-actie-form] button[type="submit"]').click();
    await page.waitForTimeout(500);
    await expect(page.locator('.toast')).toContainText('ingepland');

    // Het signaal staat nu op Ingepland met precies één gekoppelde actie.
    await ga(page, `#/agency/signals?tab=alle&panel=signaal:${sid}`, { wacht: 500 });
    await expect(page.locator('.detailpaneel .gekoppeld-lijst li')).toHaveCount(1);
  });

  test('een signaal negeren vraagt om een reden (via het overflowmenu)', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/signals', { wacht: 500 });

    // Oplossen en negeren zitten niet meer als grote knoppen, maar in het menu.
    await page.locator('.signaalkaart .kaart-overflow > summary').first().click();
    await page.waitForTimeout(150);
    await page.locator('[data-signaal-negeren]').first().click();
    await page.waitForTimeout(300);
    await expect(page.locator('.negeer-form').first()).toBeVisible();

    await page.locator('.negeer-form [name="reden"]').first().fill('Bewuste keuze van de klant');
    await page.locator('.negeer-form button[type="submit"]').first().click();
    await page.waitForTimeout(400);
    await expect(page.locator('.toast')).toContainText('genegeerd');
  });

  test('inplannen wijst het signaal toe aan een medewerker en toont dat op de kaart', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/signals', { wacht: 500 });

    const kaart = page.locator('.signaalkaart[data-fase="actie_nodig"]').first();
    const sid = await kaart.getAttribute('data-signaal');
    await kaart.locator('[data-signaal-plan]').click();
    await page.waitForSelector('#planDatum');
    await page.selectOption('#planVerantwoordelijke', { index: 1 });
    await page.fill('#planDatum', '2026-07-25');
    await page.locator('[data-plan-actie-form] button[type="submit"]').click();
    await page.waitForTimeout(500);
    await expect(page.locator('.toast')).toContainText('toegewezen aan');

    await ga(page, '#/agency/signals?tab=ingepland', { wacht: 500 });
    await expect(page.locator(`.signaalkaart[data-signaal="${sid}"] [data-verantwoordelijke]`)).not.toHaveText('Niet toegewezen');
  });

  test('een medewerker zonder toewijsrecht ziet geen inplanknop', async ({ page }) => {
    await login(page, ACCOUNTS.medewerker);
    await ga(page, '#/agency/signals', { wacht: 500 });
    // De launcher-/plancontrols zijn voorbehouden aan de Performance Lead.
    await expect(page.locator('.signaalkaart').first()).toBeVisible();
    await expect(page.locator('.signaalkaart [data-signaal-plan]')).toHaveCount(0);
  });
});

/* ---------------------------------------------------------------
   Mijn werk: widgets
   --------------------------------------------------------------- */

test.describe('Mijn werk', () => {
  test('een widget kan worden verborgen en de indeling wordt onthouden', async ({ page }) => {
    await login(page, ACCOUNTS.medewerker);
    await page.click('#widgetBewerkenKop');
    await page.waitForTimeout(300);

    const aantalVoor = await page.locator('.widget').count();
    await page.locator('[data-widget-verberg]').first().click();
    await page.waitForTimeout(400);
    expect(await page.locator('.widget').count()).toBe(aantalVoor - 1);

    await page.reload();
    await page.waitForTimeout(700);
    expect(await page.locator('.widget').count()).toBe(aantalVoor - 1);
  });

  test('een widget kan worden verplaatst met de pijlknop', async ({ page }) => {
    await login(page, ACCOUNTS.medewerker);
    await page.click('#widgetBewerkenKop');
    await page.waitForTimeout(300);

    const eersteVoor = await page.locator('.widget').first().getAttribute('data-widget');
    await page.locator('.widget').nth(1).locator('[data-widget-op]').click();
    await page.waitForTimeout(400);
    const eersteNa = await page.locator('.widget').first().getAttribute('data-widget');
    expect(eersteNa).not.toBe(eersteVoor);
  });

  test('de standaardindeling kan worden hersteld', async ({ page }) => {
    await login(page, ACCOUNTS.medewerker);
    await page.click('#widgetBewerkenKop');
    await page.waitForTimeout(300);
    const aantalVoor = await page.locator('.widget').count();
    await page.locator('[data-widget-verberg]').first().click();
    await page.waitForTimeout(300);

    await page.click('#widgetHerstel');
    await page.waitForTimeout(400);
    expect(await page.locator('.widget').count()).toBe(aantalVoor);
  });
});

/* ---------------------------------------------------------------
   Planning
   --------------------------------------------------------------- */

test.describe('Planning', () => {
  test('de planning heeft dag-, week- en maandweergave', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/planning', { wacht: 500 });
    await expect(page.locator('.paginatab').filter({ hasText: 'Week' })).toBeVisible();
    await expect(page.locator('.paginatab').filter({ hasText: 'Dag' })).toBeVisible();
    await expect(page.locator('.paginatab').filter({ hasText: 'Maand' })).toBeVisible();
  });

  test('een agenda-item is een dag op te schuiven met de knop', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/planning', { wacht: 500 });

    const item = page.locator('.agenda-item[data-planitem]').first();
    await item.locator('[data-plan-dag][data-richting="volgende"]').click();
    await page.waitForTimeout(400);
    await expect(page.locator('.toast')).toContainText('Verplaatst');
  });

  test('de externe agenda toont een koppelstatus en geen nagemaakte synchronisatie', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/planning', { wacht: 500 });
    const blok = page.locator('#agendaKoppeling');
    await expect(blok).toContainText('Google Agenda');
    await expect(blok).toContainText('Microsoft Outlook');
    await expect(blok).toContainText('Toekomstige koppeling');
  });
});

/* ---------------------------------------------------------------
   Kanaalpagina's
   --------------------------------------------------------------- */

test.describe('Kanaalpaginas', () => {
  test('ieder kanaal heeft een eigen pagina met eigen tabs', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/channels/google_ads', { wacht: 500 });
    await expect(page.locator('.paginatab').filter({ hasText: 'Advertentiegroepen' })).toBeVisible();

    await ga(page, '#/agency/channels/meta_ads', { wacht: 400 });
    await expect(page.locator('.paginatab').filter({ hasText: 'Advertentiesets' })).toBeVisible();
  });

  test('een niet-gekoppelde tab toont een koppelstatus in plaats van een lege tabel', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/channels/meta_ads?tab=creatives', { wacht: 500 });
    await expect(page.locator('.koppelstatus')).toBeVisible();
    await expect(page.locator('#pageRoot')).not.toContainText('Geen gegevens beschikbaar');
  });
});

/* ---------------------------------------------------------------
   Demo-interactie en reset
   --------------------------------------------------------------- */

test.describe('Demo-interactie', () => {
  test('de demo kan volledig worden gereset', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/actions', { wacht: 500 });

    // Maak een actie aan.
    await page.click('#nieuweActieKop');
    await page.fill('#actieTitel', 'Verdwijnt na reset');
    await page.selectOption('#actieKlant', 'tafelwerk');
    await page.click('#nieuweActieForm button[type="submit"]');
    await page.waitForTimeout(500);
    await expect(page.locator('.grid-tabel')).toContainText('Verdwijnt na reset');

    // Reset via het accountmenu.
    page.on('dialog', (d) => d.accept());
    await page.click('#accountKnop');
    await page.click('#menuDemoReset');
    await page.waitForTimeout(600);
    await expect(page.locator('.grid-tabel')).not.toContainText('Verdwijnt na reset');
  });

  test('een klantwijziging overleeft een herlading via localStorage', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/actions', { wacht: 500 });

    await page.locator('[data-actiepaneel]').first().click();
    await page.waitForTimeout(400);
    await page.fill('.detailpaneel [name="titel"]', 'Aangepaste titel blijft staan');
    await page.click('.detailpaneel [data-actie-form] button[type="submit"]');
    await page.waitForTimeout(400);

    await page.reload();
    await page.waitForTimeout(700);
    await expect(page.locator('.grid-tabel')).toContainText('Aangepaste titel blijft staan');
  });
});

/* ---------------------------------------------------------------
   Rollen en toegang tot de nieuwe pagina's
   --------------------------------------------------------------- */

test.describe('Rollen op de nieuwe werkomgeving', () => {
  test('een alleen-lezen klantgebruiker ziet geen wijzigknoppen in de samenwerking', async ({ page }) => {
    await login(page, ACCOUNTS.klantViewer);
    await ga(page, '#/client/collaboration', { wacht: 500 });
    await expect(page.locator('[data-klant-goedkeuren]')).toHaveCount(0);
  });

  test('een klantbeheerder kan wel samenwerken', async ({ page }) => {
    await login(page, ACCOUNTS.klantAdmin);
    await ga(page, '#/client/collaboration?tab=acties', { wacht: 500 });
    // De klantbeheerder ziet de samenwerkingspagina zonder foutmelding.
    await expect(page.getByRole('heading', { name: 'Geen toegang' })).toHaveCount(0);
  });

  test('een medewerker mag geen team- of systeempagina openen', async ({ page }) => {
    await login(page, ACCOUNTS.medewerker);
    for (const route of ['#/agency/team', '#/agency/integrations']) {
      await ga(page, route, { wacht: 400 });
      await expect(page.getByRole('heading', { name: 'Geen toegang' })).toBeVisible();
    }
  });
});

/* ---------------------------------------------------------------
   Responsiviteit en stabiliteit
   --------------------------------------------------------------- */

test.describe('Responsiviteit', () => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1280, height: 800 },
    { width: 1024, height: 768 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ]) {
    test(`geen horizontale overloop op ${viewport.width} bij ${viewport.height}`, async ({ page }) => {
      const errors = foutenVerzamelen(page);
      await page.setViewportSize(viewport);
      await login(page, ACCOUNTS.admin);

      for (const route of ['#/agency/portfolio', '#/agency/actions', '#/agency/planning', '#/agency/channels/google_ads']) {
        await ga(page, route, { wacht: 400 });
        const overloop = await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
        );
        expect(overloop, `overloop op ${route}`).toBe(false);
      }
      expect(errors).toEqual([]);
    });
  }

  test('op een smal scherm opent de navigatie als lade', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, ACCOUNTS.admin);
    await expect(page.locator('#menuKnop')).toBeVisible();
    await page.click('#menuKnop');
    await expect(page.locator('.sidebar')).toHaveClass(/open/);
  });
});
