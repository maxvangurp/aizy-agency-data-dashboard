/**
 * Enig toegangspunt tot authenticatie voor de rest van de applicatie.
 *
 * Views en de router praten hiermee, nooit rechtstreeks met een provider of
 * met de demo-gebruikers. Het vervangen van de provider is daardoor een
 * wijziging op één regel.
 */

import { DemoAuthProvider } from './demo-auth-provider.js';
import { leesSessie, schrijfContext } from './session.js';
import { magKlantZien, can, Permission } from './permissions.js';
import { isAgencyGebruiker, primaireOrganisatieId } from './domain.js';

/**
 * De actieve provider.
 * Vervang deze regel door een AzureAuthProvider zodra de serverkant staat.
 */
const provider = new DemoAuthProvider();

/** Abonnees die opnieuw moeten renderen wanneer de gebruiker of context wijzigt. */
const luisteraars = new Set();

function meld() {
  luisteraars.forEach((fn) => fn());
}

export function onAuthChange(fn) {
  luisteraars.add(fn);
  return () => luisteraars.delete(fn);
}

/* ---------------------------------------------------------------
   Authenticatie
   --------------------------------------------------------------- */

export async function login(credentials) {
  const resultaat = await provider.login(credentials);
  if (resultaat.ok) meld();
  return resultaat;
}

export async function logout() {
  await provider.logout();
  meld();
}

export async function restoreSession() {
  const resultaat = await provider.restoreSession();
  meld();
  return resultaat;
}

export async function acceptInvite(gegevens) {
  const resultaat = await provider.acceptInvite(gegevens);
  if (resultaat.ok) meld();
  return resultaat;
}

export function requestPasswordReset(gegevens) {
  return provider.requestPasswordReset(gegevens);
}

export function getCurrentUser() {
  return provider.getCurrentUser();
}

export function isIngelogd() {
  return provider.getCurrentUser() != null;
}

/* ---------------------------------------------------------------
   Klantcontext
   --------------------------------------------------------------- */

/**
 * De klant die op dit moment wordt bekeken.
 *
 * Voor een klantgebruiker is dat altijd de eigen organisatie; de opgeslagen
 * waarde wordt daarbij genegeerd. Voor een agencygebruiker geldt de gekozen
 * context, maar alleen wanneer die klant ook daadwerkelijk toegankelijk is.
 * Een handmatig aangepaste klant-id in localStorage levert daardoor geen
 * toegang op.
 *
 * @returns {string|null}
 */
export function getActieveKlantId() {
  const user = getCurrentUser();
  if (!user) return null;

  if (!isAgencyGebruiker(user)) {
    return primaireOrganisatieId(user);
  }

  const sessie = leesSessie();
  const gekozen = sessie?.contextClientId ?? null;
  if (!gekozen) return null;

  return magKlantZien(user, gekozen) ? gekozen : null;
}

/**
 * Opent of verlaat een klantcontext.
 * Geeft false terug wanneer de gebruiker de klant niet mag zien of de
 * contextwisselaar niet mag gebruiken.
 */
export function setActieveKlantId(clientId) {
  const user = getCurrentUser();
  if (!user) return false;

  if (clientId === null) {
    schrijfContext(null);
    meld();
    return true;
  }

  if (!can(user, Permission.SWITCH_CONTEXT)) return false;
  if (!magKlantZien(user, clientId)) return false;

  schrijfContext(clientId);
  meld();
  return true;
}

/** True wanneer een agencygebruiker op dit moment een klantweergave bekijkt. */
export function isInKlantContext() {
  const user = getCurrentUser();
  return isAgencyGebruiker(user) && getActieveKlantId() != null;
}
