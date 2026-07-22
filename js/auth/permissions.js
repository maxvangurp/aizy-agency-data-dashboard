/**
 * Centrale autorisatielaag.
 *
 * Dit is de enige plek in de applicatie waar wordt bepaald wat iemand mag.
 * Views, routes en de datarepository stellen hun vraag hier; nergens anders
 * staat een controle op een rolnaam.
 *
 * De reden daarvoor is praktisch: een controle als `user.role === 'admin'`
 * die op tien plekken staat, wordt bij de elfde plek vergeten. Eén functie
 * die overal wordt aangeroepen is te overzien en te testen.
 *
 * BELANGRIJK
 * Dit is autorisatie in de frontend. Het bepaalt wat de interface toont en
 * welke data de repository teruggeeft, maar het is geen beveiliging: alle
 * demodata zit in dezelfde JavaScriptbundle en is met de browserconsole te
 * benaderen. In productie moet exact dezelfde beslissing nog een keer aan de
 * serverkant worden genomen, voordat data de API verlaat. Zie README.
 */

import {
  Rol,
  primaireRol,
  primaireOrganisatieId,
  isAgencyGebruiker,
  AccountStatus,
} from './domain.js';

/**
 * Alle rechten die de applicatie kent.
 * Een recht beschrijft een handeling, niet een scherm, zodat meerdere
 * schermen hetzelfde recht kunnen delen.
 */
export const Permission = {
  // Agency
  VIEW_AGENCY_DASHBOARD: 'view_agency_dashboard',
  VIEW_ALL_CLIENTS: 'view_all_clients',
  VIEW_CLIENT: 'view_client',
  VIEW_AGENCY_SIGNALS: 'view_agency_signals',
  MANAGE_TEAM: 'manage_team',
  MANAGE_CLIENT_ASSIGNMENTS: 'manage_client_assignments',
  INVITE_AGENCY_USER: 'invite_agency_user',
  SWITCH_CONTEXT: 'switch_context',
  VIEW_AGENCY_SETTINGS: 'view_agency_settings',

  // Klant
  VIEW_CLIENT_DASHBOARD: 'view_client_dashboard',
  VIEW_CLIENT_CHANNELS: 'view_client_channels',
  VIEW_CLIENT_CONVERSIONS: 'view_client_conversions',
  VIEW_CLIENT_REPORT: 'view_client_report',
  MANAGE_CLIENT_USERS: 'manage_client_users',
  INVITE_CLIENT_USER: 'invite_client_user',
};

/**
 * Rechten per rol.
 *
 * VIEW_CLIENT staat er bewust niet bij: dat recht hangt af van een specifieke
 * klant en wordt daarom apart afgehandeld in can().
 */
const RECHTEN_PER_ROL = {
  [Rol.AGENCY_ADMIN]: new Set([
    Permission.VIEW_AGENCY_DASHBOARD,
    Permission.VIEW_ALL_CLIENTS,
    Permission.VIEW_AGENCY_SIGNALS,
    Permission.MANAGE_TEAM,
    Permission.MANAGE_CLIENT_ASSIGNMENTS,
    Permission.INVITE_AGENCY_USER,
    Permission.SWITCH_CONTEXT,
    Permission.VIEW_AGENCY_SETTINGS,
    Permission.VIEW_CLIENT_DASHBOARD,
    Permission.VIEW_CLIENT_CHANNELS,
    Permission.VIEW_CLIENT_CONVERSIONS,
    Permission.VIEW_CLIENT_REPORT,
  ]),

  [Rol.AGENCY_EMPLOYEE]: new Set([
    Permission.VIEW_AGENCY_DASHBOARD,
    Permission.VIEW_AGENCY_SIGNALS,
    Permission.SWITCH_CONTEXT,
    Permission.VIEW_CLIENT_DASHBOARD,
    Permission.VIEW_CLIENT_CHANNELS,
    Permission.VIEW_CLIENT_CONVERSIONS,
    Permission.VIEW_CLIENT_REPORT,
  ]),

  [Rol.CLIENT_ADMIN]: new Set([
    Permission.VIEW_CLIENT_DASHBOARD,
    Permission.VIEW_CLIENT_CHANNELS,
    Permission.VIEW_CLIENT_CONVERSIONS,
    Permission.VIEW_CLIENT_REPORT,
    Permission.MANAGE_CLIENT_USERS,
    Permission.INVITE_CLIENT_USER,
  ]),

  // Een alleen-lezen klantgebruiker ziet het resultaat en waar het vandaan
  // komt. De losse conversieconfiguratie is beheerdersinformatie: die gaat over
  // hoe er gemeten wordt, niet over wat het resultaat is.
  [Rol.CLIENT_VIEWER]: new Set([
    Permission.VIEW_CLIENT_DASHBOARD,
    Permission.VIEW_CLIENT_CHANNELS,
    Permission.VIEW_CLIENT_REPORT,
  ]),
};

/**
 * Bepaalt of een gebruiker een handeling mag uitvoeren.
 *
 * @param {object|null} user
 * @param {string} permission  waarde uit Permission
 * @param {string} [resourceId] klant-id, alleen nodig bij VIEW_CLIENT
 * @returns {boolean}
 */
export function can(user, permission, resourceId = null) {
  // Geen gebruiker, of een account dat niet actief is, mag niets.
  // Een uitgenodigd account heeft de uitnodiging nog niet geaccepteerd.
  if (!user) return false;
  if (user.status !== AccountStatus.ACTIEF) return false;

  const rol = primaireRol(user);
  if (!rol) return false;

  if (permission === Permission.VIEW_CLIENT) {
    return magKlantZien(user, resourceId);
  }

  return RECHTEN_PER_ROL[rol]?.has(permission) ?? false;
}

/**
 * Bepaalt of een gebruiker een specifieke klant mag zien.
 *
 * De drie gevallen zijn bewust uit elkaar gehouden:
 * - een beheerder ziet alle klanten;
 * - een medewerker ziet uitsluitend zijn toewijzingen;
 * - een klantgebruiker ziet uitsluitend de eigen organisatie.
 */
export function magKlantZien(user, clientId) {
  if (!user || !clientId) return false;
  if (user.status !== AccountStatus.ACTIEF) return false;

  const rol = primaireRol(user);

  if (rol === Rol.AGENCY_ADMIN) return true;

  if (rol === Rol.AGENCY_EMPLOYEE) {
    return (user.clientAssignments ?? []).includes(clientId);
  }

  if (rol === Rol.CLIENT_ADMIN || rol === Rol.CLIENT_VIEWER) {
    return primaireOrganisatieId(user) === clientId;
  }

  return false;
}

/**
 * De klant-ids die een gebruiker mag zien.
 *
 * Deze functie is de basis van de tenantisolatie: de repository gebruikt hem
 * om iedere lijst te filteren. `alleClientIds` wordt meegegeven zodat deze
 * module niet afhankelijk wordt van de sample-data.
 *
 * @param {object|null} user
 * @param {string[]} alleClientIds
 * @returns {string[]}
 */
export function toegankelijkeKlantIds(user, alleClientIds) {
  if (!user || user.status !== AccountStatus.ACTIEF) return [];

  const rol = primaireRol(user);

  if (rol === Rol.AGENCY_ADMIN) return [...alleClientIds];

  if (rol === Rol.AGENCY_EMPLOYEE) {
    // Alleen toewijzingen die ook echt bestaan. Een verwijderde klant in een
    // toewijzing mag geen lege plek in de interface opleveren.
    return (user.clientAssignments ?? []).filter((id) => alleClientIds.includes(id));
  }

  if (rol === Rol.CLIENT_ADMIN || rol === Rol.CLIENT_VIEWER) {
    const eigen = primaireOrganisatieId(user);
    return alleClientIds.includes(eigen) ? [eigen] : [];
  }

  return [];
}

/**
 * De omgeving waarin een gebruiker thuishoort.
 * Bepaalt naar welke route er na het inloggen wordt doorgestuurd.
 */
export function standaardRoute(user) {
  if (!user) return '#/login';
  if (user.status !== AccountStatus.ACTIEF) return '#/login';

  // Beide agencyrollen starten op het overzicht. Voor een beheerder is dat de
  // portefeuille, voor een medewerker zijn eigen werkdag.
  if (isAgencyGebruiker(user)) return '#/agency/overview';
  return '#/client/overview';
}

/**
 * Beschrijft in één zin waarom toegang is geweigerd.
 * Wordt getoond op de geen-toegangpagina, zodat een gebruiker niet naar een
 * lege melding kijkt.
 */
export function weigeringsreden(user, permission, resourceId = null) {
  if (!user) return 'Je bent niet ingelogd.';
  if (user.status === AccountStatus.GEDEACTIVEERD) return 'Dit account is gedeactiveerd.';
  if (user.status === AccountStatus.UITGENODIGD) return 'Deze uitnodiging is nog niet geaccepteerd.';

  if (permission === Permission.VIEW_CLIENT && resourceId) {
    return isAgencyGebruiker(user)
      ? 'Deze klant is niet aan je account toegewezen.'
      : 'Je hebt alleen toegang tot je eigen organisatie.';
  }
  if (!isAgencyGebruiker(user)) {
    return 'Dit onderdeel is alleen beschikbaar voor medewerkers van Aizy.';
  }
  return 'Je account heeft geen rechten voor dit onderdeel.';
}
