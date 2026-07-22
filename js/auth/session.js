/**
 * Sessieopslag voor de demo.
 *
 * Een sessie bevat alleen een verwijzing naar de gebruiker en de gekozen
 * context. Nooit een wachtwoord, nooit rechten. Rechten worden bij iedere
 * paginaweergave opnieuw afgeleid uit het domeinmodel, zodat het aanpassen
 * van localStorage geen rechten kan toevoegen.
 *
 * BELANGRIJK
 * Dit is geen veilige sessie. Er is geen token, geen handtekening en geen
 * vervaldatum die door een server wordt gecontroleerd. Iedereen die de
 * browserconsole opent, kan een andere gebruikers-id invullen. Dat is voor
 * een demo acceptabel omdat alle data toch fictief en publiek is. In
 * productie hoort hier een door de server uitgegeven token te staan dat bij
 * iedere API-aanroep opnieuw wordt gevalideerd.
 */

import { wisAlleFiltervoorkeuren } from '../filters/filter-store.js';

const SESSIE_SLEUTEL = 'aizy.session';
const SESSIE_VERSIE = 1;

/**
 * Leest de ruwe sessie uit de opslag.
 * Beschadigde of verouderde sessies worden verwijderd in plaats van hersteld,
 * zodat de applicatie nooit op halve gegevens doorstart.
 */
export function leesSessie() {
  let raw;
  try {
    raw = localStorage.getItem(SESSIE_SLEUTEL);
  } catch {
    // Opslag kan geblokkeerd zijn. De applicatie werkt dan zonder sessie.
    return null;
  }
  if (!raw) return null;

  let sessie;
  try {
    sessie = JSON.parse(raw);
  } catch {
    wisSessie();
    return null;
  }

  const geldig =
    sessie &&
    typeof sessie === 'object' &&
    sessie.versie === SESSIE_VERSIE &&
    typeof sessie.userId === 'string' &&
    sessie.userId.length > 0;

  if (!geldig) {
    wisSessie();
    return null;
  }

  return {
    versie: sessie.versie,
    userId: sessie.userId,
    // De context is een voorkeur, geen recht. Hij wordt bij het herstellen
    // altijd opnieuw tegen de rechten van de gebruiker gehouden.
    contextClientId: typeof sessie.contextClientId === 'string' ? sessie.contextClientId : null,
    aangemaaktOp: typeof sessie.aangemaaktOp === 'string' ? sessie.aangemaaktOp : null,
  };
}

export function schrijfSessie({ userId, contextClientId = null }) {
  const sessie = {
    versie: SESSIE_VERSIE,
    userId,
    contextClientId,
    aangemaaktOp: new Date().toISOString(),
  };
  try {
    localStorage.setItem(SESSIE_SLEUTEL, JSON.stringify(sessie));
  } catch {
    // Zonder opslag blijft de gebruiker ingelogd tot de pagina wordt herladen.
  }
  return sessie;
}

/** Werkt alleen de gekozen klantcontext bij, zonder de sessie opnieuw op te bouwen. */
export function schrijfContext(contextClientId) {
  const huidig = leesSessie();
  if (!huidig) return null;
  return schrijfSessie({ userId: huidig.userId, contextClientId });
}

/**
 * Verwijdert alle sessiegegevens.
 *
 * Ook de weergavevoorkeuren van de vorige gebruiker worden gewist. Anders zou
 * een volgende gebruiker de klantselectie of het periodefilter van zijn
 * voorganger overnemen, wat bij een wisseling tussen bureau en klant
 * verwarrend en ongewenst is. Het thema blijft bewust staan: dat is een
 * eigenschap van het apparaat, niet van het account.
 */
export function wisSessie() {
  for (const sleutel of [SESSIE_SLEUTEL, 'aizy.state']) {
    try {
      localStorage.removeItem(sleutel);
    } catch {
      // Niets te doen wanneer opslag niet beschikbaar is.
    }
  }
  // De filtervoorkeuren staan per gebruiker onder een eigen sleutel. Ze worden
  // bij het uitloggen allemaal verwijderd, zodat een volgende gebruiker op
  // hetzelfde apparaat nooit met de selectie van zijn voorganger begint.
  wisAlleFiltervoorkeuren();
}
