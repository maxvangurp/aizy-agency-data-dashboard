/**
 * Voorkeuren voor de applicatieshell.
 *
 * Kleine dingen die een gebruiker één keer instelt en daarna niet opnieuw wil
 * instellen: staat de navigatie ingeklapt, welke navigatiegroepen zijn open, en
 * welke klanten heeft hij recent bekeken.
 *
 * Deze voorkeuren horen bij de gebruiker en niet bij de route, dus ze staan in
 * de opslag en niet in de URL. Wat wél in de URL hoort — de actieve tab, het
 * geopende detailpaneel, de filters — staat daar ook, zodat een gedeelde link
 * hetzelfde scherm oplevert.
 */

import { lees, schrijf, wis } from './store.js';

const VERSIE = 2;

function sleutelVoor(userId) {
  return `ui.${userId ?? 'anoniem'}`;
}

function standaard() {
  return {
    navCompact: false,
    navGroepen: {},
    recenteKlanten: [],
  };
}

export function leesUiVoorkeuren(userId) {
  const bewaard = lees(sleutelVoor(userId), VERSIE, null);
  if (!bewaard || typeof bewaard !== 'object') return standaard();
  return {
    navCompact: bewaard.navCompact === true,
    navGroepen: bewaard.navGroepen && typeof bewaard.navGroepen === 'object' ? bewaard.navGroepen : {},
    recenteKlanten: Array.isArray(bewaard.recenteKlanten) ? bewaard.recenteKlanten.slice(0, 6) : [],
  };
}

function schrijfUiVoorkeuren(userId, voorkeuren) {
  return schrijf(sleutelVoor(userId), VERSIE, voorkeuren);
}

export function zetNavCompact(userId, compact) {
  const v = leesUiVoorkeuren(userId);
  const nieuw = { ...v, navCompact: !!compact };
  schrijfUiVoorkeuren(userId, nieuw);
  return nieuw;
}

/**
 * Klapt een navigatiegroep open of dicht.
 * De standaard is open: een dichtgeklapte groep die je nooit hebt aangeraakt,
 * verbergt onderdelen waarvan je niet weet dat ze bestaan.
 */
export function zetNavGroep(userId, groepId, open) {
  const v = leesUiVoorkeuren(userId);
  const nieuw = { ...v, navGroepen: { ...v.navGroepen, [groepId]: !!open } };
  schrijfUiVoorkeuren(userId, nieuw);
  return nieuw;
}

export function isNavGroepOpen(voorkeuren, groepId) {
  return voorkeuren.navGroepen[groepId] !== false;
}

/**
 * Onthoudt welke klant er is geopend.
 * De meest recente staat vooraan en een klant komt nooit twee keer in de lijst.
 */
export function onthoudKlant(userId, clientId) {
  if (!userId || !clientId) return;
  const v = leesUiVoorkeuren(userId);
  if (v.recenteKlanten[0] === clientId) return;
  const recent = [clientId, ...v.recenteKlanten.filter((id) => id !== clientId)].slice(0, 6);
  schrijfUiVoorkeuren(userId, { ...v, recenteKlanten: recent });
}

export function herstelUiVoorkeuren(userId) {
  wis(sleutelVoor(userId));
  return standaard();
}
