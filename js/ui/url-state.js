/**
 * Contextparameters in de URL.
 *
 * De filtercontext stond al in de hash. Deze module voegt daar de rest van de
 * schermcontext aan toe: de actieve paginatab, het geopende detailpaneel, de
 * groepering van een lijst en de weergavevorm.
 *
 * WAAROM IN DE URL
 * Een gebruiker die een collega een link stuurt, verwacht dat die collega
 * hetzelfde scherm ziet: dezelfde tab, hetzelfde paneel, dezelfde filters. En
 * een stap terug in de geschiedenis hoort de vorige tab terug te geven en niet
 * de vorige pagina. Beide werken alleen wanneer die context in de URL staat.
 *
 * WAT ER NIET IN STAAT
 * Voorkeuren die bij de gebruiker horen en niet bij het scherm: de compacte
 * navigatiestand, kolombreedtes, de widgetindeling. Die staan in de opslag.
 *
 * DE SCHEIDING
 * De filterlaag bouwt zijn eigen queryreeks op uit uitsluitend filtersleutels.
 * Deze module bewaakt dat de overige sleutels daarbij niet verloren gaan.
 */

/** Sleutels die door de filterlaag worden beheerd. */
const FILTERSLEUTELS = new Set(['period', 'from', 'to', 'compare', 'channels', 'conv']);

/** Sleutels die door deze module worden beheerd. */
export const UiSleutel = {
  TAB: 'tab',
  PANEEL: 'panel',
  GROEP: 'groep',
  WEERGAVE: 'weergave',
  DATUM: 'datum',
  BEREIK: 'bereik',
  KANAAL: 'kanaal',
  FOCUS: 'focus',
  // Lijstfilters die bij het scherm horen en niet bij de datadoorsnede. Ze
  // staan in de URL zodat een gefilterde lijst deelbaar blijft.
  KLANT: 'klant',
  ERNST: 'ernst',
  MEDEWERKER: 'medewerker',
  SOORT: 'soort',
  VERANTW: 'verantw',
  OUDERDOM: 'ouderdom',
};

const UI_SLEUTELS = new Set(Object.values(UiSleutel));

/** De contextparameters uit een queryreeks. */
export function leesUiParams(query) {
  const params = new URLSearchParams(query ?? '');
  const uit = {};
  for (const [sleutel, waarde] of params.entries()) {
    if (UI_SLEUTELS.has(sleutel) && waarde) uit[sleutel] = waarde;
  }
  return uit;
}

/** Alles wat niet van de filterlaag is, zodat een onbekende parameter niet verdwijnt. */
export function leesOverigeParams(query) {
  const params = new URLSearchParams(query ?? '');
  const uit = {};
  for (const [sleutel, waarde] of params.entries()) {
    if (!FILTERSLEUTELS.has(sleutel) && waarde) uit[sleutel] = waarde;
  }
  return uit;
}

/**
 * Voegt de filterquery en de contextparameters samen.
 * De filters staan voorop, zodat een gedeelde URL herkenbaar begint met de
 * doorsnede van de data en pas daarna de schermstand toont.
 */
export function combineerQuery(filterQuery, uiParams) {
  const params = new URLSearchParams(filterQuery ?? '');
  for (const [sleutel, waarde] of Object.entries(uiParams ?? {})) {
    if (waarde == null || waarde === '') params.delete(sleutel);
    else params.set(sleutel, String(waarde));
  }
  return params.toString();
}

/**
 * Een nieuwe hash met één gewijzigde contextparameter.
 * De rest van de query blijft ongemoeid; dat is precies wat "geen enkele klik
 * reset alle filters" in de praktijk betekent.
 */
export function hashMetParam(hash, sleutel, waarde) {
  const schoon = String(hash ?? '').replace(/^#/, '');
  const index = schoon.indexOf('?');
  const pad = index === -1 ? schoon : schoon.slice(0, index);
  const query = index === -1 ? '' : schoon.slice(index + 1);

  const params = new URLSearchParams(query);
  if (waarde == null || waarde === '') params.delete(sleutel);
  else params.set(sleutel, String(waarde));

  const nieuw = params.toString();
  return nieuw ? `#${pad}?${nieuw}` : `#${pad}`;
}

/** Meerdere parameters tegelijk, zodat er één geschiedenisstap ontstaat. */
export function hashMetParams(hash, patch) {
  return Object.entries(patch).reduce((h, [sleutel, waarde]) => hashMetParam(h, sleutel, waarde), hash);
}

/* ---------------------------------------------------------------
   Detailpaneel
   --------------------------------------------------------------- */

/**
 * Het geopende detailpaneel, als `soort:id`.
 * Bijvoorbeeld `klant:vitaalpunt`, `actie:act-seed-1`, `signaal:alert-2`.
 */
export function leesPaneel(query) {
  const waarde = leesUiParams(query)[UiSleutel.PANEEL];
  if (!waarde) return null;
  const scheiding = waarde.indexOf(':');
  if (scheiding === -1) return null;
  const soort = waarde.slice(0, scheiding);
  const id = waarde.slice(scheiding + 1);
  return soort && id ? { soort, id } : null;
}

export function paneelWaarde(soort, id) {
  return `${soort}:${id}`;
}

/* ---------------------------------------------------------------
   Scrollpositie
   --------------------------------------------------------------- */

/**
 * De scrollpositie per pad, binnen deze sessie.
 *
 * Bewust niet in localStorage: een scrollpositie van gisteren is geen context
 * maar een verrassing. Binnen één sessie terugkeren naar waar je was, is dat
 * wel.
 */
const scrollposities = new Map();

export function bewaarScroll(pad, positie) {
  scrollposities.set(pad, positie);
}

export function leesScroll(pad) {
  return scrollposities.get(pad) ?? 0;
}
