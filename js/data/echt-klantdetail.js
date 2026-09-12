/**
 * De detailcijfers van de klant die nu open staat.
 *
 * Apart van `echte-reeks.js`, en dat is geen ordening maar een grens in
 * volume. De reeksen gaan over alle klanten tegelijk en worden één keer bij het
 * opstarten gehaald; campagnedetail gaat over één klant en één periode, en zou
 * voor vijftien klanten maal een jaar tientallen megabytes zijn.
 *
 * Daarom houdt deze store precies één klant vast: degene die open staat. Wie
 * doorklikt naar een andere klant krijgt een nieuwe vraag, en de oude cijfers
 * verdwijnen -- die horen niet op het scherm van een andere klant te staan,
 * ook niet een halve seconde.
 */

let huidig = null;

/**
 * Welke sleutels al geprobeerd zijn, geslaagd of niet.
 *
 * Zonder dit ontstaat een lus: de weergave ziet dat er geen detail is, vraagt
 * erom, de vraag mislukt, de weergave tekent opnieuw en vraagt weer. Een
 * mislukte poging is een antwoord -- niet hetzelfde antwoord als succes, maar
 * wel een reden om te stoppen met vragen.
 */
const geprobeerd = new Set();

/**
 * Welke vraag op dit moment onderweg is.
 *
 * Zonder dit is "nog niet binnen" niet te onderscheiden van "er is niets", en
 * toont de pagina "niet gekoppeld" terwijl de cijfers onderweg zijn. Dat is
 * geen cosmetisch verschil: het eerste is een tijdelijke toestand, het tweede
 * een bewering over de koppeling.
 */
let onderweg = null;

/**
 * Zet de cijfers van één klant en periode.
 *
 * De sleutel bevat de periode: dezelfde klant over een ander bereik is een
 * ander antwoord, en dat hergebruiken zou tabellen tonen die een andere periode
 * beslaan dan de KPI's erboven.
 */
export function zetKlantDetail(clientId, periode, data) {
  huidig = { clientId, sleutel: sleutelVan(clientId, periode), data };
}

export function wisKlantDetail() {
  huidig = null;
}

/** Is er voor deze klant en periode al een poging gedaan? */
export function detailGeprobeerd(clientId, periode) {
  return geprobeerd.has(sleutelVan(clientId, periode));
}

export function markeerGeprobeerd(clientId, periode) {
  geprobeerd.add(sleutelVan(clientId, periode));
  onderweg = sleutelVan(clientId, periode);
}

/** Is de vraag voor deze klant en periode nog onderweg? */
export function detailOnderweg(clientId, periode) {
  return onderweg === sleutelVan(clientId, periode);
}

export function markeerKlaar() {
  onderweg = null;
}

const sleutelVan = (clientId, periode) => `${clientId}|${periode?.startDate}|${periode?.endDate}`;

/** Staat dit antwoord al klaar? */
export function heeftKlantDetail(clientId, periode) {
  return huidig?.sleutel === sleutelVan(clientId, periode);
}

/** De campagnes van deze klant, of een lege lijst. */
export function klantCampagnes(clientId, kanaal = null) {
  if (huidig?.clientId !== clientId) return [];
  const alle = huidig.data?.campagnes ?? [];
  return kanaal ? alle.filter((c) => c.kanaal === kanaal) : alle;
}

/** Eén doorsnede, desgewenst beperkt tot één platform. */
export function klantVerdeling(clientId, naam, platform = null) {
  if (huidig?.clientId !== clientId) return [];
  const lijst = huidig.data?.verdelingen?.[naam] ?? [];
  return platform ? lijst.filter((v) => v.platform === platform) : lijst;
}

/**
 * Waarom een onderdeel leeg is.
 *
 * Zonder deze reden is een lege tabel niet te onderscheiden van een resultaat
 * van nul, en dat verschil is precies wat een lezer nodig heeft.
 */
export function nietBeschikbaar(clientId, onderdeel) {
  if (huidig?.clientId !== clientId) return null;
  return huidig.data?.nietBeschikbaar?.[onderdeel] ?? null;
}

export function klantDetailGeladen(clientId) {
  return huidig?.clientId === clientId;
}

/** Eén soort entiteiten: advertentiegroepen, zoekwoorden, zoektermen, ... */
export function klantEntiteiten(clientId, soort, kanaal = null) {
  if (huidig?.clientId !== clientId) return [];
  const lijst = huidig.data?.entiteiten?.[soort] ?? [];
  return kanaal ? lijst.filter((e) => e.kanaal === kanaal) : lijst;
}

/**
 * Welke periode deze lijst beslaat.
 *
 * Zelden exact de gevraagde: deze cijfers worden per periode opgehaald en het
 * dashboardbereik schuift elke dag op. `afwijkend` zegt of het verschilt, en
 * dat hoort op het scherm te staan -- niet omdat de cijfers onwaar zijn, maar
 * omdat ze over iets anders gaan dan de kop erboven.
 */
export function entiteitPeriode(clientId, soort) {
  if (huidig?.clientId !== clientId) return null;
  return huidig.data?.entiteitPeriode?.[soort] ?? null;
}
