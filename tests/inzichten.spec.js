import { test, expect } from '@playwright/test';
import { login, ga, ACCOUNTS, zetPeriode, zetVergelijking, foutenVerzamelen, canvasIsGevuld } from './helpers.js';

/**
 * Tests voor de inzichtlaag en de dashboardtypes.
 *
 * De regels die hier worden bewaakt:
 *   - een inzicht herhaalt geen KPI maar benoemt de verandering met cijfers;
 *   - ieder primair inzicht draagt bewijs en een concrete actie;
 *   - onzekerheid wordt benoemd, niet weggelaten;
 *   - een ontbrekende meting wordt nooit als nul beschreven;
 *   - leadgeneratie, e-commerce en awareness worden verschillend beoordeeld.
 */

/** Formuleringen die nergens mogen voorkomen. */
const VERBODEN_TAAL = [
  'de diagnose', 'het lek is dicht', 'komt tot leven', 'ontgrendel',
  'commandocentrum', 'mission control', 'de motor achter', 'blijf optimaliseren',
  'rockstar', 'krachtige inzichten',
];

async function inzichtTeksten(page) {
  return page.locator('.inzicht-kaart').allTextContents();
}

/* ---------------------------------------------------------------
   Opbouw van een inzicht
   --------------------------------------------------------------- */

test.describe('Kwaliteit van inzichten', () => {
  test('ieder primair inzicht bevat bewijs, betrouwbaarheid en een actie', async ({ page }) => {
    await login(page, ACCOUNTS.admin);

    for (const klant of ['vitaalpunt', 'tafelwerk', 'noordlicht']) {
      await ga(page, `#/agency/clients/${klant}`, { wacht: 600 });
      const kaarten = page.locator('.inzicht-kaart');
      const aantal = await kaarten.count();
      expect(aantal, `${klant} levert geen inzichten`).toBeGreaterThan(0);

      for (let i = 0; i < aantal; i++) {
        const kaart = kaarten.nth(i);
        await expect(kaart.locator('.inzicht-titel'), klant).toBeVisible();
        await expect(kaart.locator('.inzicht-samenvatting'), klant).toBeVisible();
        await expect(kaart.locator('.inzicht-zekerheid'), klant).toBeVisible();
        expect(await kaart.locator('.inzicht-bewijs').count(), `${klant} inzicht ${i} zonder bewijs`).toBeGreaterThan(0);
      }
    }
  });

  test('de titel van een inzicht bevat een getal en niet alleen een KPI-naam', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/clients/vitaalpunt');

    const titels = await page.locator('.inzicht-titel').allTextContents();
    expect(titels.length).toBeGreaterThan(0);
    // Minstens de hoofdkaart benoemt de omvang van de verandering.
    expect(titels.some((t) => /\d/.test(t)), `titels zonder getal: ${titels.join(' | ')}`).toBe(true);
    // Een titel als "De CPL vraagt aandacht" zegt niets.
    expect(titels.some((t) => /vraagt aandacht$/i.test(t.trim()))).toBe(false);
  });

  test('het bewijs bevat de cijfers waarop de uitspraak rust', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/clients/vitaalpunt');

    const eerste = page.locator('.inzicht-kaart').first();
    await eerste.locator('.inzicht-bewijs summary').click();
    const bewijs = eerste.locator('.inzicht-bewijs');

    await expect(bewijs).toBeVisible();
    const rijen = await bewijs.locator('.bewijs-rij').count();
    expect(rijen).toBeGreaterThanOrEqual(2);
    await expect(bewijs).toContainText(/\d/);
  });

  test('er verschijnen maximaal drie primaire inzichten per dashboard', async ({ page }) => {
    await login(page, ACCOUNTS.admin);

    for (const klant of ['vitaalpunt', 'meridiaan', 'tafelwerk', 'draadloos', 'kaapnoord', 'noordlicht']) {
      await ga(page, `#/agency/clients/${klant}`, { wacht: 500 });
      const aantal = await page.locator('.inzicht-grid .inzicht-kaart').count();
      expect(aantal, `${klant} toont ${aantal} primaire inzichten`).toBeLessThanOrEqual(3);
    }
  });

  test('er staat precies één dominante kaart per inzichtsectie', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/clients/tafelwerk');
    expect(await page.locator('#inzichten .inzicht-kaart.is-dominant').count()).toBe(1);
  });

  test('inzichten gebruiken geen dramatische of nep-AI-taal', async ({ page }) => {
    await login(page, ACCOUNTS.admin);

    for (const klant of ['vitaalpunt', 'havenkwartier', 'draadloos', 'noordlicht']) {
      await ga(page, `#/agency/clients/${klant}`, { wacht: 500 });
      const tekst = (await page.locator('#pageRoot').innerText()).toLowerCase();
      for (const zin of VERBODEN_TAAL) {
        expect(tekst, `${zin} gevonden bij ${klant}`).not.toContain(zin);
      }
    }
  });

  test('een oorzaak wordt niet stelliger gepresenteerd dan de data toelaat', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/clients/noordlicht');

    const tekst = await page.locator('#inzichten').innerText();
    // Verzadiging wordt als combinatie benoemd, niet als vaststaand feit.
    expect(tekst).toMatch(/kan wijzen op|niet met zekerheid|waarschijnlijk/i);
  });

  test('beperkte betrouwbaarheid wordt benoemd met de reden', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    // Eén dag en één kanaal levert te weinig volume voor een harde conclusie.
    await ga(page, '#/agency/clients/vitaalpunt?period=custom&from=2026-07-22&to=2026-07-22&channels=microsoft_ads', { wacht: 900 });

    const zekerheden = await page.locator('.inzicht-kaart').evaluateAll(
      (els) => els.map((e) => e.dataset.betrouwbaarheid));

    // Op één dag met één kanaal mag niets zich als hoge betrouwbaarheid
    // presenteren, en de reden voor die twijfel hoort erbij te staan.
    expect(zekerheden.length, 'geen inzichten om te beoordelen').toBeGreaterThan(0);
    expect(zekerheden.includes('hoog'), `betrouwbaarheden: ${zekerheden.join(',')}`).toBe(false);
    await expect(page.locator('.inzicht-kanttekening').first()).toBeVisible();
    await expect(page.locator('.inzicht-kanttekening').first()).toContainText(/volume|dagen|vergelijk/i);
  });

  test('inzichten reageren op de periode en op de vergelijking', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/clients/tafelwerk');

    const dertig = await inzichtTeksten(page);
    await zetPeriode(page, 'last_7_days');
    const zeven = await inzichtTeksten(page);
    expect(zeven.join('|')).not.toBe(dertig.join('|'));

    await zetVergelijking(page, 'previous_year');
    const jaar = await inzichtTeksten(page);
    expect(jaar.join('|')).not.toBe(zeven.join('|'));
  });

  test('zonder vergelijking verdwijnen de vergelijkende inzichten', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/clients/tafelwerk');
    await zetVergelijking(page, 'none');

    const tekst = await page.locator('#pageRoot').innerText();
    expect(tekst).not.toMatch(/tegenover \d+[.,]?\d* in de vorige periode/);
  });

  test('een ontbrekende meting wordt nooit als nul beschreven', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/clients/havenkwartier');

    await expect(page.locator('#inzichten')).toContainText('Klantconversies zijn niet meetbaar');
    const tekst = await page.locator('#inzichten').innerText();
    expect(tekst).not.toMatch(/0 klanten geworden/);
    expect(tekst).not.toMatch(/0 gekwalificeerde leads gemeten/);
  });
});

/* ---------------------------------------------------------------
   Contracten per dashboardtype
   --------------------------------------------------------------- */

test.describe('Inzichten per dashboardtype', () => {
  test('leadgeneratie beoordeelt kwaliteit en funnel, niet alleen volume', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/clients/vitaalpunt');

    const tekst = await page.locator('#pageRoot').innerText();
    expect(tekst).toContain('Kosten per lead');
    expect(tekst).toContain('Gekwalificeerde leads');
    await expect(page.locator('.leadfunnel')).toBeVisible();
    // De doorklikratio wordt nooit als funnelknelpunt aangewezen.
    await expect(page.locator('.leadfunnel .banner-warning')).not.toContainText('stap Klikken');
  });

  test('e-commerce ontleedt de omzet in verkeer, conversie en orderwaarde', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/clients/draadloos');

    const kaart = page.locator('.inzicht-kaart').filter({ hasText: 'omzet' }).first();
    await expect(kaart).toBeVisible();
    await kaart.locator('.inzicht-bewijs summary').click();

    const bewijs = kaart.locator('.inzicht-bewijs');
    await expect(bewijs).toContainText('Bijdrage van het verkeer');
    await expect(bewijs).toContainText('Bijdrage van de conversieratio');
    await expect(bewijs).toContainText('Bijdrage van de orderwaarde');
  });

  test('e-commerce claimt geen marge, voorraad of winstgevendheid', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    for (const klant of ['tafelwerk', 'draadloos', 'kaapnoord']) {
      await ga(page, `#/agency/clients/${klant}`, { wacht: 500 });
      const tekst = (await page.locator('#inzichten').innerText()).toLowerCase();
      for (const woord of ['marge', 'voorraad', 'winstgevend', 'kostprijs']) {
        expect(tekst, `${woord} geclaimd bij ${klant} zonder data`).not.toContain(woord);
      }
    }
  });

  test('awareness wordt niet op kosten per lead beoordeeld', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/clients/noordlicht');

    const tekst = await page.locator('#pageRoot').innerText();
    expect(tekst).not.toContain('Kosten per lead');
    expect(tekst).not.toContain('Kosten per gekwalificeerde lead');

    // Wel de maten die bij awareness horen.
    await expect(page.locator('.kpi[data-label="Gemiddelde frequentie"]')).toBeVisible();
    await expect(page.locator('.kpi[data-label="Videovoltooiing"]')).toBeVisible();
    await expect(page.locator('.kpi[data-label="Interactieratio"]')).toBeVisible();
  });

  test('awareness toont geen uniek periodebereik dat niet gemeten wordt', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/clients/noordlicht');

    const kaart = page.locator('.kpi[data-label="Uniek bereik in de periode"]');
    await expect(kaart).toContainText('Niet gemeten');
    await expect(kaart).toContainText('niet over dagen op te tellen');
  });

  test('awareness benoemt verzadiging als combinatie van signalen', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/clients/noordlicht');

    const sectie = page.locator('.card').filter({ hasText: 'Signalen van verzadiging' });
    await expect(sectie).toBeVisible();
    await expect(sectie).toContainText('Gemiddelde frequentie');
    await expect(sectie).toContainText('Interactieratio');
    await expect(sectie).toContainText('Videovoltooiing');
    await expect(sectie).toContainText('niet met zekerheid vast te stellen');
  });

  test('de awarenessgrafieken tekenen op het canvas', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/clients/noordlicht', { wacht: 1200 });

    for (const id of ['chart-bereik', 'chart-aandacht']) {
      expect(await canvasIsGevuld(page, id), `${id} is leeg`).toBe(true);
    }
  });

  test('de dashboardtypes leveren inhoudelijk verschillende inzichten', async ({ page }) => {
    await login(page, ACCOUNTS.admin);

    const perType = {};
    for (const [type, klant] of Object.entries({ leadgen: 'vitaalpunt', ecommerce: 'tafelwerk', awareness: 'noordlicht' })) {
      await ga(page, `#/agency/clients/${klant}`, { wacht: 600 });
      perType[type] = (await page.locator('.inzicht-titel').allTextContents()).join(' | ');
    }

    expect(perType.leadgen).not.toBe(perType.ecommerce);
    expect(perType.ecommerce).not.toBe(perType.awareness);
    expect(perType.leadgen).not.toBe(perType.awareness);
  });
});

/* ---------------------------------------------------------------
   Portefeuille en persoonlijk overzicht
   --------------------------------------------------------------- */

test.describe('Prioritering in de agencyomgeving', () => {
  test('het portefeuilleoverzicht prioriteert klanten met een uitlegbare reden', async ({ page }) => {
    await login(page, ACCOUNTS.admin);

    const blok = page.locator('#werkvolgorde');
    await expect(blok).toBeVisible();
    await expect(blok).toContainText('Waarom deze klant aandacht nodig heeft');

    const eerste = blok.locator('.werkvolgorde-item').first();
    expect(await eerste.locator('.prioriteit-redenen li').count()).toBeGreaterThan(0);
    // Geen ondoorzichtige score op het scherm.
    await expect(blok).not.toContainText(/score[: ]/i);
  });

  test('de portefeuille groepeert klanten op wat er aan de hand is', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    const sectie = page.locator('.card').filter({ hasText: 'Portefeuille-indeling' });

    await expect(sectie).toBeVisible();
    await expect(sectie).toContainText('Onvolledige meting');
    await expect(sectie).toContainText('Zonder CRM-koppeling');
  });

  test('een medewerker krijgt een persoonlijk overzicht met een werkvolgorde', async ({ page }) => {
    await login(page, ACCOUNTS.medewerkerGemengd);

    await expect(page.locator('#pageRoot h1')).toContainText('Benito');
    await expect(page.locator('#pageRoot h1')).toContainText(/Goede(morgen|middag|navond|nacht)/);
    await expect(page.locator('#vandaagAandacht')).toBeVisible();
    await expect(page.locator('#pageRoot')).toContainText('Mijn klanten');
    await expect(page.locator('#pageRoot')).toContainText('Recente veranderingen');
    await expect(page.locator('#pageRoot')).toContainText('Datakwaliteit');
    await expect(page.locator('#pageRoot')).toContainText('Open acties');
  });

  test('het persoonlijke overzicht onderscheidt verantwoordelijk en ondersteunend', async ({ page }) => {
    await login(page, ACCOUNTS.medewerkerGemengd);

    const tabel = page.locator('.card').filter({ hasText: 'Mijn klanten' }).locator('table');
    await expect(tabel).toContainText('Verantwoordelijk');
    await expect(tabel).toContainText('Ondersteunend');
    await expect(tabel.locator('thead')).toContainText('Mijn rol bij deze klant');
  });

  test('het persoonlijke overzicht gebruikt geen vage productnamen', async ({ page }) => {
    await login(page, ACCOUNTS.medewerkerGemengd);
    const tekst = (await page.locator('#pageRoot').innerText()).toLowerCase();

    for (const woord of ['commandocentrum', 'mission control', 'pulse', 'smart hub', 'cockpit', 'portfolio van']) {
      expect(tekst, `${woord} hoort hier niet`).not.toContain(woord);
    }
  });

  test('het klantdetail toont prioriteit met redenen en de verantwoordelijke', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/clients/havenkwartier');

    const intern = page.locator('.intern-blok');
    await expect(intern).toContainText('Waarom deze klant aandacht nodig heeft');
    await expect(intern).toContainText('Verantwoordelijke medewerker');
    await expect(intern).toContainText('Berry Vermeulen');
    await expect(intern).toContainText('Niet zichtbaar voor de klant');
  });
});

/* ---------------------------------------------------------------
   Klantomgeving
   --------------------------------------------------------------- */

test.describe('Klantgerichte weergave', () => {
  test('de klantomgeving verbergt interne informatie', async ({ page }) => {
    await login(page, ACCOUNTS.klantAdmin);
    const html = await page.content();

    expect(html).not.toContain('Waarom deze klant aandacht nodig heeft');
    expect(html).not.toContain('Interne status');
    expect(html).not.toContain('Niet zichtbaar voor de klant');
    expect(html).not.toContain('Aanbevolen actie');
  });

  test('de klant ziet de contactpersoon bij Aizy met functietitel', async ({ page }) => {
    await login(page, ACCOUNTS.klantAdmin);

    const blok = page.locator('.contactblok');
    await expect(blok).toBeVisible();
    await expect(blok).toContainText('Berry Vermeulen');
    await expect(blok).toContainText('Performance Marketeer');
  });

  test('de kanalenpagina toont volume en efficiëntie naast elkaar', async ({ page }) => {
    await login(page, ACCOUNTS.klantAdmin);
    await ga(page, '#/client/channels');

    const kop = page.locator('#pageRoot thead').first();
    await expect(kop).toContainText('Kanaal');
    await expect(kop).toContainText('Leads');
    await expect(kop).toContainText('Kosten per lead');
    await expect(page.locator('#pageRoot')).toContainText('Waar deze cijfers vandaan komen');
  });

  test('de rapportage volgt de vaste klantstructuur', async ({ page }) => {
    await login(page, ACCOUNTS.klantAdmin);
    await ga(page, '#/client/report');

    await expect(page.getByRole('heading', { name: 'Wat ik deze periode deed' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Wat ik hierna ga doen' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Wat ik van je nodig heb' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Wat we niet kunnen meten' })).toBeVisible();
  });

  test('de klantomgeving toont geen andere organisaties', async ({ page }) => {
    const errors = foutenVerzamelen(page);
    await login(page, ACCOUNTS.klantViewer);

    for (const route of ['#/client/overview', '#/client/performance', '#/client/channels', '#/client/report']) {
      await ga(page, route, { wacht: 400 });
      const html = await page.content();
      for (const naam of ['Vitaalpunt', 'Havenkwartier', 'Tafelwerk', 'Draadloos', 'Kaap Noord', 'Noordlicht']) {
        expect(html, `${naam} lekt op ${route}`).not.toContain(naam);
      }
    }
    expect(errors).toEqual([]);
  });
});

/* ---------------------------------------------------------------
   Microcopy, grafieken en lege staten
   --------------------------------------------------------------- */

test.describe('Microcopy en lege staten', () => {
  test('knoppen beschrijven wat er gebeurt', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/team');

    const labels = await page.locator('#pageRoot button').allTextContents();
    const vaag = ['Openen', 'Bekijken', 'Doorgaan', 'Meer', 'Beheren', 'Klanten', 'Rol'];
    for (const label of labels) {
      expect(vaag, `knoplabel "${label}" is te vaag`).not.toContain(label.trim());
    }
    expect(labels.some((l) => l.includes('Klanttoewijzing wijzigen'))).toBe(true);
    expect(labels.some((l) => l.includes('Toegangsniveau wijzigen'))).toBe(true);
  });

  test('een bevestigingsdialoog benoemt wat er verandert', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/team');

    let dialoogtekst = '';
    page.on('dialog', (d) => { dialoogtekst = d.message(); d.dismiss(); });
    await page.locator('[data-actie="deactiveer"]').first().click();
    await page.waitForTimeout(400);

    expect(dialoogtekst).toContain('deactiveren');
    expect(dialoogtekst.toLowerCase()).toContain('niet meer inloggen');
  });

  test('grafieken dragen een inhoudelijke conclusie waar die te onderbouwen is', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/clients/noordlicht', { wacht: 800 });

    const figuur = page.locator('.chart-figure').filter({ hasText: 'Bereik en vertoningen' });
    await expect(figuur.locator('h3')).toBeVisible();
    await expect(figuur.locator('.chart-source')).toContainText('Bron:');
  });

  test('lege staten onderscheiden nul, ontbrekend en niet gekoppeld', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/clients/havenkwartier');

    const tekst = await page.locator('#pageRoot').innerText();
    expect(tekst).toContain('Onvoldoende data');
    expect(tekst).toContain('Geen CRM-koppeling');
    // Geen kaal streepje als verzamelbak.
    expect(tekst).not.toMatch(/^\s*[–-]\s*$/m);
  });

  test('een selectie zonder gegevens legt uit wat er aan de hand is', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/clients/kaapnoord?period=custom&from=2025-04-01&to=2025-04-07&channels=microsoft_ads', { wacht: 900 });

    const blok = page.locator('#geenDataBlok');
    await expect(blok).toBeVisible();
    await expect(blok).toContainText('Kies een langere periode');
    // Geen kapotte grafiek naast een lege staat.
    expect(await page.locator('#pageRoot canvas').count()).toBe(0);
  });
});

/* ---------------------------------------------------------------
   Toegankelijkheid en responsive gedrag
   --------------------------------------------------------------- */

test.describe('Toegankelijkheid en schermformaten', () => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1280, height: 800 },
    { width: 1024, height: 768 },
    { width: 390, height: 844 },
  ]) {
    test(`context en account blijven bruikbaar op ${viewport.width} bij ${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await login(page, ACCOUNTS.admin);
      await ga(page, '#/agency/clients/vitaalpunt', { wacht: 600 });

      await expect(page.locator('.contextheader h1')).toBeVisible();
      await expect(page.locator('#accountKnop')).toBeVisible();

      const overloop = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      expect(overloop, 'horizontale overloop').toBe(false);
    });
  }

  test('op mobiel is de medewerkersnaam volledig zichtbaar, niet alleen de initialen', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, ACCOUNTS.admin);
    await page.click('#accountKnop');

    await expect(page.locator('#accountPaneel')).toContainText('Enrico van de Lindeloof');
  });

  test('het bewijsblok is met het toetsenbord te openen', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/clients/vitaalpunt');

    const summary = page.locator('.inzicht-bewijs summary').first();
    await summary.focus();
    await expect(summary).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('.inzicht-bewijs[open]').first()).toBeVisible();
  });

  test('status wordt niet uitsluitend met kleur overgebracht', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await ga(page, '#/agency/clients');

    const tabel = page.locator('#pageRoot table');
    // Iedere status draagt een woord, niet alleen een kleur.
    await expect(tabel).toContainText('Op koers');
    await expect(tabel).toContainText('Meetprobleem');
  });

  test('de avatar draagt de volledige naam als toegankelijke naam', async ({ page }) => {
    await login(page, ACCOUNTS.medewerkerGemengd);
    await expect(page.getByRole('img', { name: 'Benito Perez' }).first()).toBeVisible();
  });
});
