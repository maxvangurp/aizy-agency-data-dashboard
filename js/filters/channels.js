/**
 * Kanalen en databronnen.
 *
 * Er is bewust onderscheid tussen twee dingen die in dashboards vaak door
 * elkaar lopen:
 *
 *   advertentiekanaal  een bron van uitgaven, vertoningen en klikken. Hierop
 *                      kan worden gefilterd, want iedere rij in de dataset
 *                      hoort bij precies één kanaal.
 *   meetbron           een bron die het resultaat meet, zoals Google Analytics 4
 *                      of het CRM. Die staat naast alle kanalen en is dus geen
 *                      filterwaarde. Zou je erop filteren, dan zou je de
 *                      meetlat zelf uit de meting halen.
 *
 * Een bron die nog niet gekoppeld is, of waarvoor te weinig data bestaat, wordt
 * met een status getoond en niet als actieve databron gepresenteerd.
 */

export const KanaalSoort = {
  ADVERTENTIE: 'advertentie',
  MEETBRON: 'meetbron',
};

export const KanaalStatus = {
  GEKOPPELD: 'gekoppeld',
  NIET_GEKOPPELD: 'niet-gekoppeld',
  TOEKOMSTIG: 'toekomstig',
  ONVOLDOENDE_DATA: 'onvoldoende-data',
};

export const KANAAL_STATUS_LABELS = {
  [KanaalStatus.GEKOPPELD]: 'Gekoppeld',
  [KanaalStatus.NIET_GEKOPPELD]: 'Niet gekoppeld',
  [KanaalStatus.TOEKOMSTIG]: 'Toekomstige koppeling',
  [KanaalStatus.ONVOLDOENDE_DATA]: 'Onvoldoende data',
};

export const KANAAL_STATUS_VARIANT = {
  [KanaalStatus.GEKOPPELD]: 'ok',
  [KanaalStatus.NIET_GEKOPPELD]: 'muted',
  [KanaalStatus.TOEKOMSTIG]: 'middel',
  [KanaalStatus.ONVOLDOENDE_DATA]: 'muted',
};

/**
 * Alle bronnen die de applicatie kent.
 *
 * `selecteerbaar` bepaalt of een bron in het kanaalfilter kan staan. Alleen
 * advertentiekanalen zijn selecteerbaar; meetbronnen worden als status getoond.
 */
export const KANALEN = [
  { key: 'google_ads', label: 'Google Ads', soort: KanaalSoort.ADVERTENTIE, selecteerbaar: true },
  { key: 'meta_ads', label: 'Meta Ads', soort: KanaalSoort.ADVERTENTIE, selecteerbaar: true },
  { key: 'microsoft_ads', label: 'Microsoft Ads', soort: KanaalSoort.ADVERTENTIE, selecteerbaar: true },
  { key: 'linkedin_ads', label: 'LinkedIn Ads', soort: KanaalSoort.ADVERTENTIE, selecteerbaar: true },
  { key: 'ga4', label: 'Google Analytics 4', soort: KanaalSoort.MEETBRON, selecteerbaar: false },
  { key: 'crm', label: 'CRM', soort: KanaalSoort.MEETBRON, selecteerbaar: false },
  {
    key: 'google_business_profile',
    label: 'Google Business Profile',
    soort: KanaalSoort.MEETBRON,
    selecteerbaar: false,
    toekomstig: true,
  },
];

const OP_KEY = new Map(KANALEN.map((k) => [k.key, k]));
const OP_LABEL = new Map(KANALEN.map((k) => [k.label.toLowerCase(), k]));

export const ADVERTENTIEKANAAL_KEYS = KANALEN.filter((k) => k.selecteerbaar).map((k) => k.key);

export function getKanaal(key) {
  return OP_KEY.get(key) ?? null;
}

export function kanaalLabel(key) {
  return OP_KEY.get(key)?.label ?? key;
}

/** Vertaalt een weergavenaam uit de klantgegevens naar een kanaalsleutel. */
export function kanaalKeyVoorLabel(label) {
  return OP_LABEL.get(String(label ?? '').trim().toLowerCase())?.key ?? null;
}

/** Houdt de vaste volgorde van KANALEN aan, ongeacht de invoervolgorde. */
export function sorteerKanalen(keys) {
  const volgorde = new Map(KANALEN.map((k, i) => [k.key, i]));
  return [...new Set(keys)]
    .filter((k) => volgorde.has(k))
    .sort((a, b) => volgorde.get(a) - volgorde.get(b));
}

/** Leesbare opsomming: "Google Ads en Meta Ads". */
export function kanalenTekst(keys) {
  const namen = sorteerKanalen(keys).map(kanaalLabel);
  if (!namen.length) return 'geen kanalen';
  if (namen.length === 1) return namen[0];
  return `${namen.slice(0, -1).join(', ')} en ${namen[namen.length - 1]}`;
}
