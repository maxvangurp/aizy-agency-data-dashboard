/**
 * Gedeelde testhulpmiddelen.
 *
 * Sinds de invoering van accounts is er geen ongeauthenticeerde toegang meer.
 * Iedere test logt daarom eerst in. De assertions van de bestaande tests zijn
 * ongewijzigd gebleven; alleen de route ernaartoe is aangepast.
 */

export const DEMO_WACHTWOORD = 'demo123';

export const ACCOUNTS = {
  admin: 'max@aizy.demo',
  medewerkerSanne: 'sanne@aizy.demo',
  medewerkerDaan: 'daan@aizy.demo',
  klantAdmin: 'directie@vitaalpunt.demo',
  klantViewer: 'marketing@meridiaan.demo',
};

/**
 * Logt in en wacht tot de applicatie is gerenderd.
 *
 * De functie is idempotent: een test die meerdere keren inlogt, wordt eerst
 * uitgelogd. Zonder dat zou de tweede aanroep op het dashboard blijven staan
 * en nooit een inlogveld vinden.
 */
export async function login(page, email, { theme = 'light' } = {}) {
  await page.goto('/index.html');
  await page.evaluate((t) => {
    localStorage.setItem('aizy.theme', t);
    // Eventuele bestaande sessie opruimen zodat we altijd bij het
    // inlogscherm beginnen, ook bij een tweede aanroep binnen één test.
    localStorage.removeItem('aizy.session');
    localStorage.removeItem('aizy.state');
    window.location.hash = '#/login';
  }, theme);
  await page.reload();
  await page.waitForSelector('#loginEmail');
  await page.fill('#loginEmail', email);
  await page.fill('#loginWachtwoord', DEMO_WACHTWOORD);
  await page.click('#loginKnop');
  await page.waitForFunction(() => !location.hash.includes('/login'));
  await page.waitForTimeout(400);
}

/** Navigeert naar een route en wacht op de render. */
export async function ga(page, hash, { wacht = 700 } = {}) {
  await page.evaluate((h) => { window.location.hash = h; }, hash);
  await page.waitForTimeout(wacht);
}

/**
 * Opent het volledige klantdashboard binnen de agencyomgeving.
 * Dit is de weergave die het oude klantscherm verving.
 */
export async function openKlantAlsAgency(page, clientId, { theme = 'light', email = ACCOUNTS.admin } = {}) {
  await login(page, email, { theme });
  await ga(page, `#/agency/clients/${clientId}`);
}

/** Opent de klantweergave zoals een klant die ziet. */
export async function openKlantview(page, clientId, { theme = 'light' } = {}) {
  await login(page, ACCOUNTS.admin, { theme });
  // De contextwisselaar zet de actieve klant en stuurt door naar de klantroute.
  await page.selectOption('#contextSelect', clientId);
  await page.waitForTimeout(700);
}

/* ---------------------------------------------------------------
   Filterbalk
   --------------------------------------------------------------- */

/**
 * Leest de actieve filterselectie uit de dataset van de filterbalk.
 * De balk publiceert zijn state daar, zodat een test niet aan de opmaak
 * van labels hoeft te hangen.
 */
export function filterState(page) {
  return page.evaluate(() => {
    const el = document.querySelector('.filterbalk-wrap');
    if (!el) return null;
    return {
      periode: el.dataset.periode,
      van: el.dataset.van,
      tot: el.dataset.tot,
      dagen: Number(el.dataset.dagen),
      vergelijking: el.dataset.vergelijking,
      vglVan: el.dataset.vglVan,
      vglTot: el.dataset.vglTot,
      kanalen: el.dataset.kanalen ? el.dataset.kanalen.split(',') : [],
      conversie: el.dataset.conversie,
    };
  });
}

/** Kiest een periodepreset en wacht op de herberekening. */
export async function zetPeriode(page, preset, { wacht = 600 } = {}) {
  await page.selectOption('#filterPeriode', preset);
  await page.waitForTimeout(wacht);
}

export async function zetVergelijking(page, mode, { wacht = 600 } = {}) {
  await page.selectOption('#filterVergelijking', mode);
  await page.waitForTimeout(wacht);
}

/**
 * Zet de kanaalselectie op precies de opgegeven sleutels.
 * Eerst aanvinken wat erbij moet, dan uitvinken wat eraf moet, zodat er
 * onderweg nooit een lege selectie ontstaat die automatisch wordt hersteld.
 */
export async function kiesKanalen(page, keys) {
  await page.click('#filterKanalenKnop');
  await page.waitForTimeout(150);

  const huidige = async () =>
    page.evaluate(() =>
      [...document.querySelectorAll('input[name="filterKanaal"]')]
        .map((el) => ({ value: el.value, checked: el.checked })));

  for (const wil of [true, false]) {
    for (const vak of await huidige()) {
      if (keys.includes(vak.value) !== wil) continue;
      if (vak.checked === wil) continue;
      await page.locator(`input[name="filterKanaal"][value="${vak.value}"]`).setChecked(wil);
      await page.waitForTimeout(450);
    }
  }

  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
}

/** De waarde van een KPI-kaart met exact dit label. */
export async function kpiWaarde(page, label) {
  const kaart = page
    .locator('.kpi')
    .filter({ has: page.locator('.kpi-label', { hasText: new RegExp(`^${label}$`) }) })
    .first();
  return (await kaart.locator('.kpi-value').textContent())?.trim();
}

/** Een compacte handtekening van de getekende pixels, om verandering te zien. */
export function canvasHandtekening(page, canvasId) {
  return page.evaluate((id) => {
    const c = document.getElementById(id);
    if (!c) return null;
    const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let som = 0;
    for (let i = 0; i < data.length; i += 97) som = (som + data[i] * (i % 251)) % 2147483647;
    return som;
  }, canvasId);
}

/** Verzamelt console- en paginafouten. */
export function foutenVerzamelen(page) {
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

/** True wanneer een canvas daadwerkelijk zichtbare inhoud bevat. */
export function canvasIsGevuld(page, canvasId, drempel = 0.005) {
  return page.evaluate(
    ([id, d]) => {
      const c = document.getElementById(id);
      if (!c) return false;
      const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let zichtbaar = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i] !== 0) zichtbaar++;
      return zichtbaar / (data.length / 4) > d;
    },
    [canvasId, drempel]
  );
}
