/**
 * Opslaglaag voor de demo-interactie.
 *
 * Alles wat een gebruiker in deze demo wijzigt — acties, signaalstatussen,
 * planning, tabelvoorkeuren, widgetindeling, navigatiestand — komt hier
 * terecht. Er is nog geen backend, dus localStorage is de enige plek waar een
 * wijziging een herlading kan overleven.
 *
 * WAAROM ÉÉN LAAG
 * Zonder deze laag zou iedere module zijn eigen sleutel verzinnen, zijn eigen
 * JSON-fouten afvangen en zijn eigen versiecontrole doen. Dat levert bij een
 * reset gegarandeerd achterblijvers op. Nu staat elke sleutel onder hetzelfde
 * voorvoegsel en wist `wisAlleDemoGegevens()` ze in één keer.
 *
 * VORM VAN EEN INGANG
 *   { versie: <getal>, gewijzigdOp: <iso>, data: <wat de module bewaart> }
 *
 * Een ingang met een andere versie wordt weggegooid in plaats van gemigreerd:
 * dit is demodata, en een half gemigreerde actie is verwarrender dan een verse.
 *
 * BELANGRIJK
 * Dit is geen beveiliging en geen bron van waarheid. De echte opslag komt in de
 * Azure-backend; deze laag modelleert alleen het gedrag zodat de interface nu al
 * werkelijk iets doet in plaats van te doen alsof.
 */

export const DEMO_PREFIX = 'aizy.demo.';

/** Abonnees die opnieuw moeten renderen wanneer demodata wijzigt. */
const luisteraars = new Set();

/**
 * Meldt dat er iets in de demo-opslag is gewijzigd.
 * De applicatieshell luistert hierop en rendert opnieuw, zodat lijst, bord en
 * agenda na één wijziging per definitie dezelfde gegevens tonen.
 */
export function onDemoWijziging(fn) {
  luisteraars.add(fn);
  return () => luisteraars.delete(fn);
}

function meld(sleutel) {
  luisteraars.forEach((fn) => {
    try {
      fn(sleutel);
    } catch {
      // Een falende abonnee mag een geslaagde schrijfactie niet terugdraaien.
    }
  });
}

/**
 * Leest een ingang.
 *
 * @param {string} sleutel  zonder voorvoegsel
 * @param {number} versie   verwachte versie; een afwijkende ingang vervalt
 * @param {*} standaard     waarde wanneer er niets bruikbaars staat
 */
export function lees(sleutel, versie, standaard) {
  try {
    const raw = localStorage.getItem(DEMO_PREFIX + sleutel);
    if (!raw) return standaard;
    const ingang = JSON.parse(raw);
    if (!ingang || typeof ingang !== 'object' || ingang.versie !== versie) {
      localStorage.removeItem(DEMO_PREFIX + sleutel);
      return standaard;
    }
    return ingang.data ?? standaard;
  } catch {
    // Beschadigde of geblokkeerde opslag mag de applicatie niet tegenhouden.
    return standaard;
  }
}

/** Schrijft een ingang en meldt de wijziging. */
export function schrijf(sleutel, versie, data) {
  try {
    localStorage.setItem(
      DEMO_PREFIX + sleutel,
      JSON.stringify({ versie, gewijzigdOp: new Date().toISOString(), data })
    );
  } catch {
    // Zonder opslag blijft de wijziging alleen in dit tabblad bestaan.
  }
  meld(sleutel);
  return data;
}

/** Verwijdert één ingang. */
export function wis(sleutel) {
  try {
    localStorage.removeItem(DEMO_PREFIX + sleutel);
  } catch {
    // Niets te doen wanneer opslag niet beschikbaar is.
  }
  meld(sleutel);
}

/** Alle demo-sleutels die op dit moment bestaan. */
export function demoSleutels() {
  const uit = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const sleutel = localStorage.key(i);
      if (sleutel && sleutel.startsWith(DEMO_PREFIX)) uit.push(sleutel);
    }
  } catch {
    return [];
  }
  return uit;
}

/**
 * Zet de demo terug naar de uitgangssituatie.
 *
 * Alles wat een gebruiker heeft aangepast verdwijnt: acties, signaalstatussen,
 * planning, tabelweergaven, widgets en de navigatiestand. Het thema en de
 * sessie blijven staan; die horen bij het apparaat en het account, niet bij de
 * demo-inhoud.
 */
export function wisAlleDemoGegevens() {
  demoSleutels().forEach((sleutel) => {
    try {
      localStorage.removeItem(sleutel);
    } catch {
      // Niets te doen.
    }
  });
  meld('*');
}

/* ---------------------------------------------------------------
   Identifiers
   --------------------------------------------------------------- */

let teller = 0;

/**
 * Een stabiele, leesbare identifier.
 *
 * Bewust geen willekeur op basis van de klok alleen: binnen één render kunnen
 * twee aanroepen in dezelfde milliseconde vallen. De teller maakt het verschil.
 */
export function nieuwId(voorvoegsel) {
  teller += 1;
  return `${voorvoegsel}-${Date.now().toString(36)}${teller.toString(36)}`;
}

/** Het moment waarop iets is gebeurd, als ISO-tekst. */
export function nu() {
  return new Date().toISOString();
}
