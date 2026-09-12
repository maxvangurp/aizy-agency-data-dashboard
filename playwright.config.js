import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

/**
 * Een Chromium die er al staat, in plaats van er een downloaden.
 *
 * Playwright bindt zich aan één revisie: 1.61 wil build 1228 en weigert een
 * andere, ook al is het dezelfde Chrome. Op een machine waar die download niet
 * kan -- een CI-image met een eigen browser, een omgeving zonder net -- is de
 * suite daardoor niet te draaien, en "niet te draaien" wordt in de praktijk
 * "niet gedraaid".
 *
 * `PLAYWRIGHT_CHROMIUM_PATH` wijst naar het binary dat er wél is. Niet gezet is
 * de normale situatie: dan doet Playwright gewoon zijn eigen ding. Wie hem zet
 * neemt bewust het risico dat een suite tegen een andere Chrome-versie draait;
 * dat is een goede ruil tegenover niet kunnen draaien, maar het hoort geen
 * stille standaard te zijn.
 *
 * Een pad dat niet bestaat gooit hier, en niet pas bij de eerste test. Anders
 * is het antwoord een Playwright-fout over een ontbrekende browser -- precies
 * de melding die deze variabele moest oplossen, en dan zoek je in de verkeerde
 * hoek.
 */
const chromiumPad = process.env.PLAYWRIGHT_CHROMIUM_PATH?.trim();
if (chromiumPad && !existsSync(chromiumPad)) {
  throw new Error(
    `PLAYWRIGHT_CHROMIUM_PATH wijst naar ${chromiumPad}, maar daar staat niets. ` +
    'Laat hem leeg om Playwright zijn eigen browser te laten gebruiken.'
  );
}
const eigenBrowser = chromiumPad ? { launchOptions: { executablePath: chromiumPad } } : {};

export default defineConfig({
  testDir: './tests',

  /**
   * Alleen `.spec.js`; de unit-tests in `tests/unit` zijn `.test.js`.
   *
   * Dit staat er niet voor de netheid. Playwright's standaardpatroon dekt ook
   * `*.test.js`, dus het laadde `tests/unit/*.test.js` mee tijdens het
   * verzamelen. Die bestanden starten bij import de runner van `node:test` --
   * in hetzelfde proces, met TAP-uitvoer die tussen de Playwright-regels door
   * komt en met een eigen exitcode aan het eind. Twee testrunners in één proces
   * is geen situatie waarin je wilt uitzoeken waarom een run rood is.
   *
   * Ze horen dus los te draaien: `npm test` voor de browsertests,
   * `npm run test:unit` voor de rest.
   */
  testMatch: '**/*.spec.js',

  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:8000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, ...eigenBrowser },
    },
  ],
  webServer: {
    command: 'node server.js',
    url: 'http://127.0.0.1:8000/index.html',
    reuseExistingServer: true,
    timeout: 30000,
  },
});
