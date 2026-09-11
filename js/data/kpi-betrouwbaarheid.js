/**
 * Welke KPI's van de geselecteerde klant betekenis hebben.
 *
 * max-marketing-os stelt dat per account vast uit de conversieopzet en zet het
 * oordeel in `client_kpi_reliability`. Het komt hier binnen via
 * `/api/clients/live`, aan de klant vastgeplakt.
 *
 * **Waarom dit een module met geheugen is en geen parameter.** De KPI-kaart
 * wordt op tientallen plekken aangeroepen, telkens met een metrieksleutel en
 * zonder klant. Het oordeel bij elke aanroep meegeven zou tientallen
 * aanroepplekken raken voor iets dat per klantselectie één keer verandert.
 * Daarom zet de app het hier neer zodra de selectie wijzigt, en kijkt de kaart
 * het op. Een view die het tóch expliciet wil meegeven, kan dat.
 *
 * **Niet beoordeeld is niet hetzelfde als goedgekeurd.** Zonder oordeel geeft
 * `isOnbetrouwbaar()` false terug -- er is dan geen grond om iets te
 * betwijfelen -- maar `heeftOordeel()` zegt eerlijk dat er niets vaststaat.
 * Die twee door elkaar halen zou een onbeoordeeld account een schone
 * gezondheidsverklaring geven.
 */

/** Het oordeel over de klant die nu getoond wordt, of null. */
let actief = null;

/** Zet het oordeel dat vanaf nu geldt. `null` als er geen is. */
export function zetBetrouwbaarheid(oordeel) {
  actief = oordeel && typeof oordeel === 'object' ? oordeel : null;
}

export function huidigeBetrouwbaarheid() {
  return actief;
}

/** Is deze klant beoordeeld? Iets anders dan: is hij in orde? */
export function heeftOordeel(oordeel = actief) {
  return Boolean(oordeel?.beoordeeld);
}

/**
 * Mag deze KPI zonder voorbehoud getoond worden?
 *
 * @param {string} key metrieksleutel, bijvoorbeeld 'roas'
 */
export function isOnbetrouwbaar(key, oordeel = actief) {
  if (!oordeel?.onbetrouwbareKpis?.length) return false;
  return oordeel.onbetrouwbareKpis.includes(key);
}

/**
 * De reden in één zin, voor naast het cijfer.
 *
 * Bewust de bevinding zelf en niet een algemene waarschuwing: "de
 * conversiewaarde is een vaste waarde per conversie" laat zich nalopen,
 * "datakwaliteit laag" niet.
 *
 * **De reden moet wel bij dít cijfer horen.** Een account kan tegelijk een
 * kapotte conversieteller en een kapotte conversiewaarde hebben, en dat zijn
 * twee verschillende verhalen. "Routeklikken tellen mee als conversie"
 * verklaart een onbruikbare CPA, niet een onbruikbare ROAS. Daarom draagt elke
 * bevinding in `raaktKpis` welke KPI's zij velt, en wordt daarop gefilterd.
 *
 * Oudere oordelen kennen dat veld niet. Die vallen terug op de zwaarste
 * bevinding -- minder precies, maar beter dan geen uitleg.
 */
export function redenVoor(key, oordeel = actief) {
  if (!isOnbetrouwbaar(key, oordeel)) return null;
  const alle = oordeel.bevindingen ?? [];
  const eigen = alle.filter((b) => Array.isArray(b.raaktKpis) && b.raaktKpis.includes(key));
  const kandidaten = eigen.length ? eigen : alle.filter((b) => !Array.isArray(b.raaktKpis));

  const zwaar = kandidaten.filter((b) => b.ernst === 'hoog');
  return (zwaar[0] ?? kandidaten[0])?.tekst ?? oordeel.oordeel ?? null;
}
