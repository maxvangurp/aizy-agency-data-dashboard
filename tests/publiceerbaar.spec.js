import { test, expect } from '@playwright/test';
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

// Playwright draait vanuit de projectmap. De controle hieronder maakt dat expliciet,
// zodat de test niet stil op de verkeerde map gaat werken.
const ROOT = process.cwd();

/**
 * De bestanden die GitHub Pages zou serveren: alles wat Git tracked of zou
 * toevoegen, met uitsluiting van wat .gitignore blokkeert.
 */
function gepubliceerdeBestanden() {
  const output = execSync('git ls-files --cached --others --exclude-standard', {
    cwd: ROOT,
    encoding: 'utf8',
  });
  return new Set(output.split('\n').filter(Boolean).map((f) => f.replace(/\\/g, '/')));
}

/** Haalt relatieve import- en exportpaden uit een JavaScript-module. */
function importPaden(inhoud) {
  const paden = [];
  const patroon = /(?:import|export)\s[^'"]*?from\s*['"](\.[^'"]+)['"]|import\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g;
  let match;
  while ((match = patroon.exec(inhoud)) !== null) {
    paden.push(match[1] ?? match[2]);
  }
  return paden;
}

/** Volgt de volledige modulegraaf vanaf een instapbestand. */
function moduleGraaf(startBestand) {
  const bezocht = new Set();
  const wachtrij = [startBestand];
  const randen = [];

  while (wachtrij.length) {
    const bestand = wachtrij.pop();
    if (bezocht.has(bestand)) continue;
    bezocht.add(bestand);

    const absoluutPad = path.join(ROOT, bestand);
    if (!existsSync(absoluutPad)) continue;

    for (const relatief of importPaden(readFileSync(absoluutPad, 'utf8'))) {
      const doel = path
        .normalize(path.join(path.dirname(bestand), relatief))
        .replace(/\\/g, '/');
      randen.push({ van: bestand, naar: doel });
      wachtrij.push(doel);
    }
  }
  return { bezocht, randen };
}

test.describe('Publiceerbaarheid op GitHub Pages', () => {
  test('de tests draaien vanuit de projectmap', () => {
    expect(existsSync(path.join(ROOT, 'index.html')), `ROOT is ${ROOT}`).toBe(true);
    expect(existsSync(path.join(ROOT, 'js', 'app.js')), `ROOT is ${ROOT}`).toBe(true);
  });

  /**
   * Deze test dekt de storing waarbij "data/" in .gitignore ook js/data/ blokkeerde.
   * Het bestand bestond lokaal, maar stond niet in Git. Op GitHub Pages gaf de
   * import een 404 en initialiseerde de applicatie niet.
   */
  test('ieder geïmporteerd bestand wordt ook door Git gepubliceerd', () => {
    const gepubliceerd = gepubliceerdeBestanden();
    const { randen } = moduleGraaf('js/app.js');

    expect(randen.length, 'de modulegraaf is leeg, klopt het instapbestand nog?').toBeGreaterThan(0);

    const ontbrekend = randen.filter(({ naar }) => !gepubliceerd.has(naar));
    const melding = ontbrekend
      .map(({ van, naar }) => `${van} importeert ${naar}, maar dat bestand staat niet in Git`)
      .join('\n');

    expect(ontbrekend, melding).toEqual([]);
  });

  test('ieder geïmporteerd bestand bestaat ook echt op schijf', () => {
    const { randen } = moduleGraaf('js/app.js');
    const ontbrekend = randen.filter(({ naar }) => !existsSync(path.join(ROOT, naar)));
    const melding = ontbrekend.map(({ van, naar }) => `${van} importeert ${naar}, dat niet bestaat`).join('\n');
    expect(ontbrekend, melding).toEqual([]);
  });

  test('de instapbestanden uit index.html worden gepubliceerd', () => {
    const gepubliceerd = gepubliceerdeBestanden();
    const html = readFileSync(path.join(ROOT, 'index.html'), 'utf8');

    const lokaleBronnen = [...html.matchAll(/(?:src|href)=["'](?!https?:|data:|#)([^"']+)["']/g)]
      .map((m) => m[1].replace(/^\.?\//, ''));

    expect(lokaleBronnen.length).toBeGreaterThan(0);

    const ontbrekend = lokaleBronnen.filter((bron) => !gepubliceerd.has(bron));
    expect(ontbrekend, `index.html verwijst naar niet-gepubliceerde bestanden: ${ontbrekend.join(', ')}`).toEqual([]);
  });

  /**
   * De lokale database bevat versleutelde tokens en mag nooit in Git komen.
   * Deze test bewaakt dat de scherpere .gitignore die bescherming niet verloor.
   */
  test('de lokale database blijft buiten Git', () => {
    const gepubliceerd = gepubliceerdeBestanden();
    const databaseBestanden = [...gepubliceerd].filter((f) => f.startsWith('data/') || f.endsWith('.db'));
    expect(databaseBestanden, 'databasebestanden staan in Git').toEqual([]);
  });

  test('geen .env of referentiebestanden in Git', () => {
    const gepubliceerd = gepubliceerdeBestanden();
    const gevoelig = [...gepubliceerd].filter(
      (f) => f === '.env' || f.startsWith('references/')
    );
    expect(gevoelig, 'gevoelige bestanden staan in Git').toEqual([]);
  });
});
