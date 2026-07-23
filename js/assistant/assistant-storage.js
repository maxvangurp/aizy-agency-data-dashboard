/**
 * Opslag van de Aizy-assistent.
 *
 * De gesprekken en voorkeuren van de assistent horen bij één gebruiker en
 * overleven een herlading, net als de rest van de demo-interactie. Ze staan
 * daarom onder hetzelfde demo-voorvoegsel, zodat een demo-reset ze in één keer
 * meeneemt en er geen achterblijvers ontstaan.
 *
 * Er is bewust geen backend: dit modelleert alleen het gedrag. Zodra er een
 * echte assistent-API is, verhuist de historie mee naar de server; deze module
 * blijft dan de lokale cache.
 */

import { lees, schrijf, nieuwId, nu } from '../model/store.js';

const VERSIE = 1;
const MAX_GESPREKKEN = 8;
const MAX_BERICHTEN = 60;

const sleutelVoor = (userId) => `assistant.${userId ?? 'anoniem'}`;

function standaard() {
  return {
    gesprekken: [],
    actiefGesprekId: null,
    voorkeuren: {
      zichtbaar: true,
      // 'zwevend' of 'vastgezet'
      positie: 'zwevend',
      ingeklapt: false,
      // 'demo' of 'extern' (extern is voorbereid, nog niet actief)
      modus: 'demo',
    },
  };
}

function laad(userId) {
  const ruw = lees(sleutelVoor(userId), VERSIE, null);
  if (!ruw || typeof ruw !== 'object') return standaard();
  const basis = standaard();
  return {
    gesprekken: Array.isArray(ruw.gesprekken) ? ruw.gesprekken : [],
    actiefGesprekId: ruw.actiefGesprekId ?? null,
    voorkeuren: { ...basis.voorkeuren, ...(ruw.voorkeuren ?? {}) },
  };
}

function bewaar(userId, staat) {
  return schrijf(sleutelVoor(userId), VERSIE, staat);
}

/* ---------------------------------------------------------------
   Voorkeuren
   --------------------------------------------------------------- */

export function leesVoorkeuren(userId) {
  return laad(userId).voorkeuren;
}

export function zetVoorkeur(userId, patch) {
  const staat = laad(userId);
  staat.voorkeuren = { ...staat.voorkeuren, ...patch };
  bewaar(userId, staat);
  return staat.voorkeuren;
}

/* ---------------------------------------------------------------
   Gesprekken
   --------------------------------------------------------------- */

export function actiefGesprek(userId) {
  const staat = laad(userId);
  const gevonden = staat.gesprekken.find((g) => g.id === staat.actiefGesprekId);
  return gevonden ?? staat.gesprekken[0] ?? null;
}

export function alleGesprekken(userId) {
  return laad(userId).gesprekken;
}

/** Zorgt dat er een actief gesprek is en geeft het terug. */
export function verzekerGesprek(userId) {
  const staat = laad(userId);
  let gesprek = staat.gesprekken.find((g) => g.id === staat.actiefGesprekId) ?? staat.gesprekken[0];
  if (!gesprek) {
    gesprek = { id: nieuwId('gesprek'), aangemaaktOp: nu(), berichten: [] };
    staat.gesprekken.unshift(gesprek);
    staat.actiefGesprekId = gesprek.id;
    bewaar(userId, staat);
  } else if (staat.actiefGesprekId !== gesprek.id) {
    staat.actiefGesprekId = gesprek.id;
    bewaar(userId, staat);
  }
  return gesprek;
}

export function nieuwGesprek(userId) {
  const staat = laad(userId);
  const gesprek = { id: nieuwId('gesprek'), aangemaaktOp: nu(), berichten: [] };
  staat.gesprekken.unshift(gesprek);
  staat.gesprekken = staat.gesprekken.slice(0, MAX_GESPREKKEN);
  staat.actiefGesprekId = gesprek.id;
  bewaar(userId, staat);
  return gesprek;
}

/**
 * Voegt een bericht toe aan het actieve gesprek.
 * @param {object} bericht {rol:'gebruiker'|'assistent', tekst, context?, acties?, suggesties?, beperking?}
 */
export function voegBerichtToe(userId, bericht) {
  const staat = laad(userId);
  let gesprek = staat.gesprekken.find((g) => g.id === staat.actiefGesprekId) ?? staat.gesprekken[0];
  if (!gesprek) {
    gesprek = { id: nieuwId('gesprek'), aangemaaktOp: nu(), berichten: [] };
    staat.gesprekken.unshift(gesprek);
    staat.actiefGesprekId = gesprek.id;
  }
  gesprek.berichten.push({ id: nieuwId('bericht'), op: nu(), ...bericht });
  gesprek.berichten = gesprek.berichten.slice(-MAX_BERICHTEN);
  bewaar(userId, staat);
  return gesprek;
}

export function wisGeschiedenis(userId) {
  const staat = laad(userId);
  staat.gesprekken = [];
  staat.actiefGesprekId = null;
  bewaar(userId, staat);
}
