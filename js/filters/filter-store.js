/**
 * Beheer van de filterstate.
 *
 * WAAR DE WAARHEID LIGT
 * De URL is leidend. Staat er een geldige, expliciete selectie in de hash, dan
 * wint die altijd van de opgeslagen voorkeur. Pas als de URL niets zegt, wordt
 * de laatst gebruikte selectie van deze gebruiker in deze context hersteld, en
 * anders gelden de standaardwaarden.
 *
 * Die volgorde maakt een gedeelde link betrouwbaar: wie hem opent ziet wat de
 * afzender zag, ook als hij zelf een andere voorkeur had staan.
 *
 * OPSLAG PER GEBRUIKER EN PER CONTEXT
 * De voorkeur wordt bewaard onder `aizy.filters.<gebruikersid>`, met daarin een
 * ingang per context: het agencyoverzicht en iedere klant hebben hun eigen
 * selectie. Een periode die voor de ene klant zinvol is, hoeft dat voor de
 * andere niet te zijn.
 *
 * Doordat de gebruikers-id in de sleutel staat, kan een volgende gebruiker de
 * selectie van zijn voorganger nooit overnemen. Bij uitloggen worden alle
 * filtersleutels bovendien verwijderd; zie js/auth/session.js.
 *
 * WAT ER NIET GEBEURT
 * Er staat geen filterstate in losse globale variabelen en views schrijven er
 * nooit rechtstreeks in. Een view krijgt een viewmodel en een filtercontext,
 * meer niet.
 */

import {
  normaliseerFilters, resolveFilters, standaardFilters, filtersGelijk,
  filtersNaarQuery, queryNaarFilters,
} from './filter-context.js';
import { ADVERTENTIEKANAAL_KEYS } from './channels.js';

const SLEUTEL_PREFIX = 'aizy.filters.';

/** Contextsleutels. Het agencyoverzicht en iedere klant hebben een eigen selectie. */
export const AGENCY_SCOPE = 'agency';
export function klantScope(clientId) {
  return `client:${clientId}`;
}

/* ---------------------------------------------------------------
   Opslag
   --------------------------------------------------------------- */

function sleutelVoor(userId) {
  return `${SLEUTEL_PREFIX}${userId}`;
}

function leesVoorkeuren(userId) {
  if (!userId) return {};
  try {
    const raw = localStorage.getItem(sleutelVoor(userId));
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    // Beschadigde of geblokkeerde opslag mag de applicatie niet tegenhouden.
    return {};
  }
}

function schrijfVoorkeuren(userId, voorkeuren) {
  if (!userId) return;
  try {
    localStorage.setItem(sleutelVoor(userId), JSON.stringify(voorkeuren));
  } catch {
    // Zonder opslag werkt alles nog, alleen zonder geheugen tussen sessies.
  }
}

/** Verwijdert alle bewaarde filtervoorkeuren van alle gebruikers. */
export function wisAlleFiltervoorkeuren() {
  try {
    const teVerwijderen = [];
    for (let i = 0; i < localStorage.length; i++) {
      const sleutel = localStorage.key(i);
      if (sleutel && sleutel.startsWith(SLEUTEL_PREFIX)) teVerwijderen.push(sleutel);
    }
    teVerwijderen.forEach((s) => localStorage.removeItem(s));
  } catch {
    // Niets te doen wanneer opslag niet beschikbaar is.
  }
}

/* ---------------------------------------------------------------
   Bepalen van de actieve filtercontext
   --------------------------------------------------------------- */

/** De laatst bepaalde context, zodat een interactie weet waarop hij voortbouwt. */
let actief = null;

/**
 * Bepaalt de filtercontext voor de huidige render.
 *
 * @param {{
 *   user: object|null,
 *   scope: string,
 *   toegestaneKanalen: string[],
 *   conversieOpties?: string[],
 *   query?: string
 * }} opties
 * @returns {{filters: object, resolved: object, correcties: string[], uitUrl: boolean, scope: string}}
 */
export function bepaalFilters({ user, scope, toegestaneKanalen, conversieOpties, query = '' }) {
  const userId = user?.id ?? null;
  const uitUrl = queryNaarFilters(query);
  const voorkeuren = leesVoorkeuren(userId);
  const bewaard = voorkeuren[scope] ?? null;

  const bron = uitUrl ?? bewaard ?? overgenomenVanVorigeContext(scope);
  const { filters, correcties } = normaliseerFilters(bron, { toegestaneKanalen, conversieOpties });

  // De genormaliseerde selectie wordt teruggeschreven, zodat een ongeldige of
  // verouderde voorkeur zichzelf opruimt in plaats van bij elke render opnieuw
  // te worden gecorrigeerd.
  if (userId && !filtersGelijk(bewaard, filters)) {
    schrijfVoorkeuren(userId, { ...voorkeuren, [scope]: filters });
  }

  actief = {
    filters,
    resolved: resolveFilters(filters),
    correcties,
    uitUrl: uitUrl != null,
    scope,
    toegestaneKanalen,
    conversieOpties,
    userId,
  };
  return actief;
}

/** De filtercontext van de laatste render. */
export function getActieveFilters() {
  return actief;
}

/**
 * Neemt de periode en de vergelijking over uit de context waar de gebruiker
 * vandaan komt.
 *
 * Opent iemand vanuit het agencyoverzicht een klant, dan blijft de gekozen
 * periode staan; dat is wat je verwacht als je net zeven dagen hebt gekozen.
 * De kanaalselectie wordt bewust niet overgenomen, want die hoort bij de
 * kanalen van die klant en wordt opnieuw genormaliseerd. Zodra een context een
 * eigen selectie krijgt, gaat die voor.
 */
function overgenomenVanVorigeContext(scope) {
  if (!actief || actief.scope === scope) return null;
  return { period: actief.filters.period, comparison: actief.filters.comparison };
}

/**
 * Past de actieve filters aan en geeft de genormaliseerde uitkomst terug.
 *
 * De uitkomst wordt meteen als voorkeur bewaard. Zonder die stap zou een
 * terugkeer naar de standaardwaarden niet in de URL zichtbaar zijn en zou de
 * volgende render de oude voorkeur weer oppikken.
 */
export function pasFiltersAan(patch) {
  if (!actief) return null;
  const samengevoegd = {
    ...actief.filters,
    ...patch,
    period: { ...actief.filters.period, ...(patch.period ?? {}) },
    comparison: { ...actief.filters.comparison, ...(patch.comparison ?? {}) },
  };
  const { filters } = normaliseerFilters(samengevoegd, {
    toegestaneKanalen: actief.toegestaneKanalen,
    conversieOpties: actief.conversieOpties,
  });

  if (actief.userId) {
    const voorkeuren = leesVoorkeuren(actief.userId);
    schrijfVoorkeuren(actief.userId, { ...voorkeuren, [actief.scope]: filters });
  }
  actief = { ...actief, filters };

  return filters;
}

/** De standaardselectie binnen de huidige context. */
export function standaardVoorContext() {
  return standaardFilters(actief?.toegestaneKanalen ?? ADVERTENTIEKANAAL_KEYS);
}

/** De queryreeks die bij een filtercontext hoort. */
export function queryVoor(filters) {
  return filtersNaarQuery(filters, { toegestaneKanalen: actief?.toegestaneKanalen ?? ADVERTENTIEKANAAL_KEYS });
}
