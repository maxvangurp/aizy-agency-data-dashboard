/**
 * De dagreeksen van de echte klanten.
 *
 * Het uitgebreide dashboard rekent alles door vanuit `getClientRows(clientId)`.
 * Die functie las uitsluitend uit de voorbeelddataset, en de vijftien
 * aangesloten klanten staan daar niet in -- vandaar dat elke pagina meldde dat
 * er "binnen deze selectie helemaal geen data" was, terwijl er tienduizenden
 * rijen in Supabase staan.
 *
 * Dit bestand is de andere kant van diezelfde naad: een store die eenmalig
 * gevuld wordt uit `/api/reeks` en daarna synchroon te bevragen is, precies
 * zoals de voorbeelddataset. Zo hoeft de repository -- en dus het hele
 * dashboard erboven -- niet asynchroon te worden.
 *
 * WAT HIER NIET GEBEURT
 *
 * Er wordt niets bijgeschat. Het model kent velden die uit een CRM komen --
 * gekwalificeerde leads, afspraken, offertes, klanten, pijplijnwaarde -- en
 * die blijven leeg. Een geschatte pijplijnwaarde ziet er op het scherm precies
 * zo uit als een gemeten, en dat verschil is nergens meer terug te vinden.
 *
 * WAAROM EEN MODULESTORE EN GEEN LOCALSTORAGE
 *
 * Deze cijfers gaan over klanten die de ingelogde gebruiker mag zien. Ze in
 * localStorage leggen betekent dat ze blijven staan als iemand anders achter
 * dezelfde browser inlogt. Een modulestore verdwijnt bij het verversen, en dat
 * is hier de veiligere eigenschap.
 */

let store = new Map();
let geladen = false;
let nietGemeten = [];

/**
 * Vult de store met wat `/api/reeks` teruggaf.
 *
 * Vervangt de hele inhoud in plaats van bij te werken: een halve verversing
 * zou klanten laten staan die de nieuwe gebruiker niet mag zien.
 */
export function zetEchteReeksen(antwoord) {
  store = new Map(Object.entries(antwoord?.klanten ?? {}));
  nietGemeten = antwoord?.nietGemeten ?? [];
  geladen = true;
}

/** Leegmaken bij uitloggen: de volgende gebruiker begint schoon. */
export function wisEchteReeksen() {
  store = new Map();
  nietGemeten = [];
  geladen = false;
}

/** Is er al een poging gedaan? Onderscheidt "nog niet geladen" van "leeg". */
export function reeksenGeladen() {
  return geladen;
}

export function heeftEchteReeks(clientId) {
  return store.has(clientId);
}

/** De dagrijen van één klant, of een lege lijst. */
export function echteRijen(clientId) {
  return store.get(clientId)?.rijen ?? [];
}

/**
 * De kanalen waarvoor deze klant werkelijk data heeft.
 *
 * In dezelfde vorm als de voorbeelddataset: `{ key, vanaf }`. `vanaf` blijft
 * leeg -- we weten wanneer de eerste rij is, maar niet wanneer het kanaal is
 * aangezet, en dat zijn twee verschillende dingen.
 */
export function echteKanalen(clientId) {
  return (store.get(clientId)?.kanalen ?? []).map((key) => ({ key, vanaf: null }));
}

/**
 * De conversieopzet van een echte klant.
 *
 * Eén type, en dat is geen versimpeling maar wat er gemeten wordt:
 * `performance_snapshots` houdt één conversieteller per campagne per dag. De
 * uitsplitsing naar soort conversie bestaat wel -- in de conversieacties van
 * Google Ads en de GA4-doelen -- maar niet per dag per campagne, en hem hier
 * verzinnen zou een uitsplitsing tonen die nergens op staat.
 */
export function echteConversieConfig(clientId) {
  const klant = store.get(clientId);
  if (!klant || klant.businessModel !== 'leadgen') return null;
  return { primair: ['leads'], secundair: [] };
}

export function echteConversieLabels(clientId) {
  return store.has(clientId) ? { leads: 'Leads' } : null;
}

/** Welke velden van het model hier niet gemeten worden. */
export function nietGemetenVelden() {
  return nietGemeten;
}
