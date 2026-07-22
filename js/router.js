/**
 * Hash-router met routebeveiliging.
 *
 * Iedere route draagt zelf de eis die eraan hangt. De router controleert die
 * eis vóórdat er iets wordt gerenderd, zodat er geen moment is waarop
 * onbevoegde data in de DOM staat.
 *
 * De guard is de tweede van twee lagen. De eerste is de repository, die geen
 * ontoegankelijke data teruggeeft. Beide zijn nodig: de guard voorkomt dat
 * iemand op een scherm belandt, de repository voorkomt dat een fout in de
 * guard alsnog data lekt.
 */

import { getCurrentUser, getActieveKlantId } from './auth/auth-service.js';
import { can, magKlantZien, standaardRoute, weigeringsreden, Permission } from './auth/permissions.js';
import { isAgencyGebruiker } from './auth/domain.js';

/**
 * Routedefinities.
 *
 * publiek   toegankelijk zonder inloggen
 * permission recht dat vereist is
 * clientParam de route bevat een klant-id dat gecontroleerd moet worden
 */
export const ROUTES = [
  { pad: '/login', naam: 'login', publiek: true, titel: 'Inloggen' },
  { pad: '/forgot-password', naam: 'forgot-password', publiek: true, titel: 'Wachtwoord vergeten' },
  { pad: '/accept-invite', naam: 'accept-invite', publiek: true, titel: 'Uitnodiging accepteren' },

  { pad: '/agency/overview', naam: 'agency-overview', permission: Permission.VIEW_AGENCY_DASHBOARD, titel: 'Overzicht' },
  { pad: '/agency/clients', naam: 'agency-clients', permission: Permission.VIEW_AGENCY_DASHBOARD, titel: 'Klanten' },
  { pad: '/agency/clients/:clientId', naam: 'agency-client-detail', permission: Permission.VIEW_AGENCY_DASHBOARD, clientParam: 'clientId', titel: 'Klantdetail' },
  { pad: '/agency/signals', naam: 'agency-signals', permission: Permission.VIEW_AGENCY_SIGNALS, titel: 'Signalen' },
  { pad: '/agency/actions', naam: 'agency-actions', permission: Permission.VIEW_AGENCY_DASHBOARD, titel: 'Acties' },
  { pad: '/agency/team', naam: 'agency-team', permission: Permission.MANAGE_TEAM, titel: 'Team' },
  { pad: '/agency/team/:userId', naam: 'agency-medewerker', permission: Permission.MANAGE_TEAM, titel: 'Medewerker' },
  { pad: '/agency/settings', naam: 'agency-settings', permission: Permission.VIEW_AGENCY_SETTINGS, titel: 'Instellingen' },

  { pad: '/client/overview', naam: 'client-overview', permission: Permission.VIEW_CLIENT_DASHBOARD, titel: 'Overzicht' },
  { pad: '/client/performance', naam: 'client-performance', permission: Permission.VIEW_CLIENT_DASHBOARD, titel: 'Resultaten' },
  { pad: '/client/channels', naam: 'client-channels', permission: Permission.VIEW_CLIENT_CHANNELS, titel: 'Kanalen' },
  { pad: '/client/conversions', naam: 'client-conversions', permission: Permission.VIEW_CLIENT_CONVERSIONS, titel: 'Conversies' },
  { pad: '/client/report', naam: 'client-report', permission: Permission.VIEW_CLIENT_REPORT, titel: 'Rapportages' },
  { pad: '/client/users', naam: 'client-users', permission: Permission.MANAGE_CLIENT_USERS, titel: 'Gebruikers' },

  { pad: '/unauthorized', naam: 'unauthorized', publiek: true, titel: 'Geen toegang' },
];

/** Zet een hash om in het pad, zonder queryparameters. */
export function parseHash(hash = window.location.hash) {
  const schoon = String(hash ?? '').replace(/^#/, '') || '/';
  const [pad] = schoon.split('?');
  return pad.startsWith('/') ? pad : `/${pad}`;
}

/**
 * De queryparameters achter de route.
 *
 * De filterstate leeft hier: `#/agency/overview?period=last_7_days`. De router
 * kent de betekenis van die parameters niet en geeft ze ongewijzigd door; het
 * normaliseren gebeurt in de filterlaag, tegen wat de gebruiker mag zien.
 */
export function parseQuery(hash = window.location.hash) {
  const schoon = String(hash ?? '').replace(/^#/, '');
  const index = schoon.indexOf('?');
  return index === -1 ? '' : schoon.slice(index + 1);
}

/** Stelt een hash samen uit een pad en een queryreeks. */
export function bouwHash(pad, query) {
  return query ? `#${pad}?${query}` : `#${pad}`;
}

/**
 * Zoekt de route die bij een pad hoort en haalt de parameters eruit.
 * @returns {{route: object, params: object}|null}
 */
export function matchRoute(pad) {
  const delen = pad.split('/').filter(Boolean);

  for (const route of ROUTES) {
    const routeDelen = route.pad.split('/').filter(Boolean);
    if (routeDelen.length !== delen.length) continue;

    const params = {};
    let past = true;

    for (let i = 0; i < routeDelen.length; i++) {
      if (routeDelen[i].startsWith(':')) {
        params[routeDelen[i].slice(1)] = decodeURIComponent(delen[i]);
      } else if (routeDelen[i] !== delen[i]) {
        past = false;
        break;
      }
    }

    if (past) return { route, params };
  }
  return null;
}

/** Resultaatsoorten van een routecontrole. */
export const Uitkomst = {
  TOEGESTAAN: 'toegestaan',
  DOORSTUREN: 'doorsturen',
  GEEN_TOEGANG: 'geen_toegang',
  NIET_GEVONDEN: 'niet_gevonden',
};

/**
 * Bepaalt of de huidige gebruiker een route mag openen.
 *
 * De volgorde van de controles is bewust:
 *   1. bestaat de route          anders 404
 *   2. is de route publiek       dan altijd toegestaan
 *   3. is er een gebruiker       anders naar het inlogscherm
 *   4. hoort de gebruiker hier   klantgebruikers nooit op agencyroutes
 *   5. heeft de gebruiker het recht
 *   6. mag hij deze specifieke klant zien
 *
 * Stap 6 is de reden dat het aanpassen van een klant-id in de URL niets
 * oplevert: het recht om klanten te bekijken zegt nog niets over déze klant.
 */
export function controleerRoute(pad) {
  const match = matchRoute(pad);
  if (!match) {
    return { uitkomst: Uitkomst.NIET_GEVONDEN, pad };
  }

  const { route, params } = match;
  if (route.publiek) {
    return { uitkomst: Uitkomst.TOEGESTAAN, route, params };
  }

  const user = getCurrentUser();
  if (!user) {
    return { uitkomst: Uitkomst.DOORSTUREN, naar: '#/login' };
  }

  const isAgencyRoute = route.pad.startsWith('/agency');
  const isClientRoute = route.pad.startsWith('/client');

  // Een klantgebruiker komt nooit op een agencyroute, ook niet via de URL.
  if (isAgencyRoute && !isAgencyGebruiker(user)) {
    return {
      uitkomst: Uitkomst.GEEN_TOEGANG,
      route,
      reden: weigeringsreden(user, route.permission),
    };
  }

  // Een agencygebruiker kan wel klantroutes openen, maar alleen met een
  // gekozen klantcontext. Zonder context is er geen klant om te tonen.
  if (isClientRoute && isAgencyGebruiker(user) && !getActieveKlantId()) {
    return { uitkomst: Uitkomst.DOORSTUREN, naar: '#/agency/clients' };
  }

  if (route.permission && !can(user, route.permission)) {
    return {
      uitkomst: Uitkomst.GEEN_TOEGANG,
      route,
      reden: weigeringsreden(user, route.permission),
    };
  }

  if (route.clientParam) {
    const clientId = params[route.clientParam];
    if (!magKlantZien(user, clientId)) {
      return {
        uitkomst: Uitkomst.GEEN_TOEGANG,
        route,
        reden: weigeringsreden(user, Permission.VIEW_CLIENT, clientId),
      };
    }
  }

  return { uitkomst: Uitkomst.TOEGESTAAN, route, params };
}

/* ---------------------------------------------------------------
   Navigatie
   --------------------------------------------------------------- */

const luisteraars = new Set();

export function onRouteChange(fn) {
  luisteraars.add(fn);
  return () => luisteraars.delete(fn);
}

/** Navigeert naar een route. `vervang` voorkomt een extra stap in de geschiedenis. */
export function navigeer(hash, { vervang = false } = {}) {
  const doel = hash.startsWith('#') ? hash : `#${hash}`;
  if (window.location.hash === doel) {
    luisteraars.forEach((fn) => fn());
    return;
  }
  if (vervang) {
    window.history.replaceState(null, '', doel);
    luisteraars.forEach((fn) => fn());
  } else {
    window.location.hash = doel;
  }
}

/** Stuurt de gebruiker naar het scherm dat bij zijn rol hoort. */
export function navigeerNaarStartpagina() {
  navigeer(standaardRoute(getCurrentUser()), { vervang: true });
}

export function startRouter(onChange) {
  window.addEventListener('hashchange', onChange);
  luisteraars.add(onChange);
}
