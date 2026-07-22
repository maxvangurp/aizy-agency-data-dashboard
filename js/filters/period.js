/**
 * Periodes, datumrekenen en vergelijkingsperiodes.
 *
 * AFSPRAKEN DIE OVERAL GELDEN
 *
 * Referentiedatum
 *   De demo rekent niet met de echte klok. `DEMO_TODAY` is de vaste "vandaag".
 *   Daardoor leveren dezelfde filters altijd dezelfde cijfers op en zijn tests
 *   niet afhankelijk van de dag waarop ze draaien. Er staat nergens anders in
 *   de code een verstreken aantal dagen hard gecodeerd.
 *
 * Tijdzone
 *   Alle datums zijn kalenderdagen in Europe/Amsterdam, opgeslagen als
 *   'JJJJ-MM-DD'. Er wordt intern in UTC gerekend zodat zomertijd geen dag kan
 *   verschuiven; er wordt nooit een tijdstip getoond of vergeleken. Een dag is
 *   dus een label, geen moment.
 *
 * Grenzen
 *   Start- en einddatum zijn allebei inclusief. "Afgelopen 7 dagen" is dus
 *   zeven dagen inclusief vandaag, niet acht en niet zes.
 *
 * Dagen zonder data
 *   Een dag zonder rij bestaat niet als nul. Hij telt niet mee in een som en
 *   wordt apart gemeld als ontbrekende dekking. Zie js/data/metrics.js.
 *
 * Gedeeltelijke periodes
 *   Een lopende periode (de einddatum is vandaag) wordt vergeleken met dezelfde
 *   verstreken duur in de voorgaande periode. Een afgeronde periode die precies
 *   een kalendermaand beslaat, wordt vergeleken met de volledige voorgaande
 *   kalendermaand. Zo staat er nooit een halve maand tegenover een hele.
 *
 * Schrikkeljaren en maandlengtes
 *   Bij een verschuiving van een maand of een jaar wordt de dag geklemd op de
 *   laatste dag van de doelmaand. 31 maart min een maand is 28 of 29 februari,
 *   en 29 februari min een jaar is 28 februari.
 */

/** Vaste referentiedatum van de demo. */
export const DEMO_TODAY = '2026-07-22';

/** Tijdzone waarin een kalenderdag wordt geïnterpreteerd. */
export const TIJDZONE = 'Europe/Amsterdam';

/**
 * De laatste dag waarvan alle bronnen volledig zijn binnengekomen.
 * Advertentie- en CRM-data lopen in werkelijkheid een dag achter; dat wordt
 * gemeld in plaats van verzwegen.
 */
export const DATA_VOLLEDIG_TOT = '2026-07-21';

/* ---------------------------------------------------------------
   Datumrekenen
   --------------------------------------------------------------- */

const DATUM_PATROON = /^\d{4}-\d{2}-\d{2}$/;

export function isDatum(waarde) {
  if (typeof waarde !== 'string' || !DATUM_PATROON.test(waarde)) return false;
  const d = naarDatum(waarde);
  return d != null && naarISO(d) === waarde;
}

/** 'JJJJ-MM-DD' naar een Date op middernacht UTC. */
export function naarDatum(iso) {
  const delen = String(iso ?? '').split('-').map(Number);
  if (delen.length !== 3 || delen.some((n) => !Number.isFinite(n))) return null;
  const [jaar, maand, dag] = delen;
  const d = new Date(Date.UTC(jaar, maand - 1, dag));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function naarISO(datum) {
  return datum.toISOString().slice(0, 10);
}

export function plusDagen(iso, aantal) {
  const d = naarDatum(iso);
  if (!d) return null;
  d.setUTCDate(d.getUTCDate() + aantal);
  return naarISO(d);
}

/** Aantal dagen van start tot en met eind. Gelijke datums leveren 1 op. */
export function aantalDagen(startIso, eindIso) {
  const a = naarDatum(startIso);
  const b = naarDatum(eindIso);
  if (!a || !b) return 0;
  return Math.round((b - a) / 86400000) + 1;
}

export function isVoor(a, b) {
  return naarDatum(a) < naarDatum(b);
}

export function isNa(a, b) {
  return naarDatum(a) > naarDatum(b);
}

export function beginVanMaand(iso) {
  const d = naarDatum(iso);
  return naarISO(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)));
}

export function eindVanMaand(iso) {
  const d = naarDatum(iso);
  return naarISO(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)));
}

export function dagenInMaand(iso) {
  const d = naarDatum(iso);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
}

/**
 * Verschuift een datum met hele maanden en klemt de dag op de laatste dag van
 * de doelmaand. 31 maart min één maand wordt daardoor 28 of 29 februari.
 */
export function plusMaanden(iso, aantal) {
  const d = naarDatum(iso);
  const jaar = d.getUTCFullYear();
  const maand = d.getUTCMonth() + aantal;
  const dag = d.getUTCDate();
  const laatste = new Date(Date.UTC(jaar, maand + 1, 0)).getUTCDate();
  return naarISO(new Date(Date.UTC(jaar, maand, Math.min(dag, laatste))));
}

/** Verschuift met hele jaren. 29 februari wordt 28 februari in een gewoon jaar. */
export function plusJaren(iso, aantal) {
  return plusMaanden(iso, aantal * 12);
}

export function beginVanKwartaal(iso) {
  const d = naarDatum(iso);
  const kwartaalMaand = Math.floor(d.getUTCMonth() / 3) * 3;
  return naarISO(new Date(Date.UTC(d.getUTCFullYear(), kwartaalMaand, 1)));
}

export function eindVanKwartaal(iso) {
  const d = naarDatum(iso);
  const kwartaalMaand = Math.floor(d.getUTCMonth() / 3) * 3;
  return naarISO(new Date(Date.UTC(d.getUTCFullYear(), kwartaalMaand + 3, 0)));
}

/** Alle datums van start tot en met eind. */
export function datumReeks(startIso, eindIso) {
  const reeks = [];
  let huidig = startIso;
  const max = aantalDagen(startIso, eindIso);
  for (let i = 0; i < max; i++) {
    reeks.push(huidig);
    huidig = plusDagen(huidig, 1);
  }
  return reeks;
}

/** Nederlandse weergave van een datumbereik. */
const DATUM_FORMAT = new Intl.DateTimeFormat('nl-NL', {
  day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
});

export function toonDatum(iso) {
  const d = naarDatum(iso);
  return d ? DATUM_FORMAT.format(d) : 'Onbekend';
}

const KORT_FORMAT = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** Korte weergave voor aslabels in grafieken. */
export function toonKorteDatum(iso) {
  const d = naarDatum(iso);
  return d ? KORT_FORMAT.format(d) : '';
}

export function toonBereik(startIso, eindIso) {
  if (!startIso || !eindIso) return 'Geen bereik';
  return `${toonDatum(startIso)} tot en met ${toonDatum(eindIso)}`;
}

/* ---------------------------------------------------------------
   Periodepresets
   --------------------------------------------------------------- */

export const PERIODE_PRESETS = [
  { key: 'last_7_days', label: 'Afgelopen 7 dagen', kort: '7 dagen' },
  { key: 'last_30_days', label: 'Afgelopen 30 dagen', kort: '30 dagen' },
  { key: 'last_90_days', label: 'Afgelopen 90 dagen', kort: '90 dagen' },
  { key: 'this_month', label: 'Deze maand', kort: 'Deze maand' },
  { key: 'last_month', label: 'Vorige maand', kort: 'Vorige maand' },
  { key: 'this_quarter', label: 'Dit kwartaal', kort: 'Dit kwartaal' },
  { key: 'custom', label: 'Aangepast datumbereik', kort: 'Aangepast' },
];

export const PERIODE_PRESET_KEYS = new Set(PERIODE_PRESETS.map((p) => p.key));
export const STANDAARD_PERIODE = 'last_30_days';

/** Maximale lengte van een aangepast bereik. Beschermt tegen onzinbereiken. */
export const MAX_PERIODE_DAGEN = 731;

/**
 * Zet een preset om in een concreet bereik.
 *
 * @returns {{preset: string, startDate: string, endDate: string, dagen: number,
 *            afgerond: boolean, volledigeMaand: boolean, melding: string|null}}
 */
export function resolvePeriode(periode, vandaag = DEMO_TODAY) {
  const preset = PERIODE_PRESET_KEYS.has(periode?.preset) ? periode.preset : STANDAARD_PERIODE;

  if (preset === 'custom') {
    return resolveAangepast(periode, vandaag);
  }

  let startDate;
  let endDate = vandaag;
  // De datum waar een lopende kalenderperiode naartoe loopt. Alleen dan heeft
  // een prognose betekenis: een voortschrijdend venster van dertig dagen is per
  // definitie al voorbij en valt niets meer over te voorspellen.
  let prognoseTot = null;

  switch (preset) {
    case 'last_7_days': startDate = plusDagen(vandaag, -6); break;
    case 'last_90_days': startDate = plusDagen(vandaag, -89); break;
    case 'this_month':
      startDate = beginVanMaand(vandaag);
      prognoseTot = eindVanMaand(vandaag);
      break;
    case 'last_month': {
      const vorige = plusMaanden(beginVanMaand(vandaag), -1);
      startDate = beginVanMaand(vorige);
      endDate = eindVanMaand(vorige);
      break;
    }
    case 'this_quarter':
      startDate = beginVanKwartaal(vandaag);
      prognoseTot = eindVanKwartaal(vandaag);
      break;
    case 'last_30_days':
    default: startDate = plusDagen(vandaag, -29); break;
  }

  return beschrijf(preset, startDate, endDate, vandaag, null, prognoseTot);
}

/**
 * Valideert en normaliseert een aangepast bereik.
 *
 * Ongeldige invoer wordt niet stil genegeerd maar hersteld met een melding,
 * zodat de gebruiker ziet wat er met zijn keuze is gebeurd.
 */
function resolveAangepast(periode, vandaag) {
  const standaard = resolvePeriode({ preset: STANDAARD_PERIODE }, vandaag);

  let start = periode?.startDate;
  let eind = periode?.endDate;
  const meldingen = [];

  if (!isDatum(start) || !isDatum(eind)) {
    return { ...standaard, preset: 'custom', melding: 'Het aangepaste bereik was onvolledig. De afgelopen 30 dagen worden getoond.' };
  }

  if (isNa(start, eind)) {
    [start, eind] = [eind, start];
    meldingen.push('De begindatum lag na de einddatum; de datums zijn omgedraaid.');
  }

  if (isNa(eind, vandaag)) {
    eind = vandaag;
    meldingen.push('De einddatum lag in de toekomst en is teruggezet naar vandaag.');
    if (isNa(start, eind)) start = eind;
  }

  if (aantalDagen(start, eind) > MAX_PERIODE_DAGEN) {
    start = plusDagen(eind, -(MAX_PERIODE_DAGEN - 1));
    meldingen.push(`Het bereik was langer dan ${MAX_PERIODE_DAGEN} dagen en is ingekort.`);
  }

  return beschrijf('custom', start, eind, vandaag, meldingen.length ? meldingen.join(' ') : null);
}

function beschrijf(preset, startDate, endDate, vandaag, melding, prognoseTot = null) {
  const dagen = aantalDagen(startDate, endDate);
  return {
    preset,
    startDate,
    endDate,
    dagen,
    // Afgerond betekent: de periode is voorbij, er komt geen data meer bij.
    afgerond: isVoor(endDate, vandaag),
    volledigeMaand: startDate === beginVanMaand(startDate) && endDate === eindVanMaand(startDate),
    prognoseTot: prognoseTot && isNa(prognoseTot, endDate) ? prognoseTot : null,
    melding,
  };
}

/** Label van een periode, inclusief het bereik. */
export function periodeLabel(resolved) {
  const preset = PERIODE_PRESETS.find((p) => p.key === resolved.preset);
  return preset && preset.key !== 'custom' ? preset.label : toonBereik(resolved.startDate, resolved.endDate);
}

/* ---------------------------------------------------------------
   Vergelijkingsperiodes
   --------------------------------------------------------------- */

export const VERGELIJK_MODI = [
  { key: 'previous_period', label: 'Vorige periode' },
  { key: 'previous_month', label: 'Vorige maand' },
  { key: 'previous_year', label: 'Zelfde periode vorig jaar' },
  { key: 'none', label: 'Geen vergelijking' },
];

export const VERGELIJK_KEYS = new Set(VERGELIJK_MODI.map((m) => m.key));
export const STANDAARD_VERGELIJKING = 'previous_period';

/**
 * Berekent de vergelijkingsperiode bij een opgeloste periode.
 *
 * previous_period
 *   De direct voorafgaande periode van dezelfde lengte. Beslaat de periode
 *   precies een kalendermaand, dan wordt de volledige voorgaande kalendermaand
 *   gebruikt: bij maandrapportage is dat de eerlijke vergelijking, ook als de
 *   maanden verschillend lang zijn.
 *
 * previous_month
 *   Dezelfde periode een kalendermaand eerder, met hetzelfde aantal dagen. Voor
 *   een lopende maand betekent dat de eerste evenveel dagen van de vorige
 *   maand, dus 1 tot en met 22 juni tegenover 1 tot en met 22 juli.
 *
 * previous_year
 *   Dezelfde datums een jaar eerder, met klemming op de laatste dag van de maand.
 *
 * @returns {{mode: string, startDate: string|null, endDate: string|null,
 *            dagen: number, label: string, gelijkeLengte: boolean}}
 */
export function resolveVergelijking(resolvedPeriode, mode = STANDAARD_VERGELIJKING) {
  const gekozen = VERGELIJK_KEYS.has(mode) ? mode : STANDAARD_VERGELIJKING;

  if (gekozen === 'none') {
    return { mode: 'none', startDate: null, endDate: null, dagen: 0, label: 'Geen vergelijking', gelijkeLengte: true };
  }

  const { startDate, endDate, dagen, volledigeMaand, afgerond } = resolvedPeriode;

  if (gekozen === 'previous_year') {
    const start = plusJaren(startDate, -1);
    const eind = plusJaren(endDate, -1);
    return maakVergelijking('previous_year', start, eind, dagen);
  }

  // Een afgeronde volledige kalendermaand hoort tegenover een volledige maand
  // te staan, niet tegenover een willekeurig venster van evenveel dagen.
  if (volledigeMaand && afgerond) {
    const vorige = plusMaanden(startDate, -1);
    return maakVergelijking(gekozen, beginVanMaand(vorige), eindVanMaand(vorige), dagen);
  }

  if (gekozen === 'previous_month') {
    const start = plusMaanden(startDate, -1);
    const eind = plusDagen(start, dagen - 1);
    // Niet over de maandgrens heen lopen wanneer de vorige maand korter is.
    const maximum = eindVanMaand(start);
    return maakVergelijking('previous_month', start, isNa(eind, maximum) ? maximum : eind, dagen);
  }

  // previous_period: het venster dat direct aan de periode voorafgaat.
  const eind = plusDagen(startDate, -1);
  const start = plusDagen(eind, -(dagen - 1));
  return maakVergelijking('previous_period', start, eind, dagen);
}

function maakVergelijking(mode, startDate, endDate, verwachteDagen) {
  const dagen = aantalDagen(startDate, endDate);
  const label = VERGELIJK_MODI.find((m) => m.key === mode)?.label ?? mode;
  return {
    mode,
    startDate,
    endDate,
    dagen,
    label,
    gelijkeLengte: dagen === verwachteDagen,
  };
}
