/**
 * Databronnen koppelen (simpele modus) — een gesimuleerde koppel-ervaring.
 *
 * Het pulse-dashboard belooft "Sluit de Meta/Google API's aan voor live cijfers".
 * Hier houden we per klant bij welke advertentiebronnen (Meta/Google) je in de
 * demo hebt "gekoppeld". Dat is bewust een DEMOLAAG, los van de echte
 * `DataMode.LIVE` uit `data-provider.js`: er is geen backend, dus koppelen flipt
 * geen echte fetch. De cijfers blijven voorbeelddata; de UI labelt de koppeling
 * daarom altijd expliciet als demo en claimt nooit dat de data live is geworden.
 *
 * In productie plugt hier een echte OAuth-token + `setDataMode(DataMode.LIVE)` in.
 *
 * Alles staat in de demo-opslag (`aizy.demo.databronnen`); reset via
 * `wisAlleDemoGegevens`.
 */

import { lees, schrijf, nu } from './store.js';

const SLEUTEL = 'databronnen';
const VERSIE = 1;

/** De platforms die je in de simpele modus kunt koppelen. */
export const BronPlatform = {
  META: 'meta',
  GOOGLE: 'google',
};

const PLATFORM_SET = new Set(Object.values(BronPlatform));

/** De koppelstatus van één bron (demolaag, los van DataMode). */
export const BronStatus = {
  DEMODATA: 'demodata',
  GEKOPPELD: 'gekoppeld',
};

/** Alle opgeslagen koppelingen (over alle klanten), als map per klant. */
function laadAlles() {
  const data = lees(SLEUTEL, VERSIE, {});
  return data && typeof data === 'object' ? data : {};
}

function bewaar(data) {
  return schrijf(SLEUTEL, VERSIE, data);
}

/**
 * De koppelstatus van een klant per platform. Ontbrekende records tellen als
 * demodata (nog niet gekoppeld), zodat de default nooit iets live suggereert.
 */
export function koppelingVoor(clientId) {
  const rec = laadAlles()[clientId] ?? {};
  return {
    meta: rec.meta?.status === BronStatus.GEKOPPELD ? BronStatus.GEKOPPELD : BronStatus.DEMODATA,
    google: rec.google?.status === BronStatus.GEKOPPELD ? BronStatus.GEKOPPELD : BronStatus.DEMODATA,
  };
}

/** True wanneer een specifiek platform voor deze klant (demo-)gekoppeld is. */
export function isBronGekoppeld(clientId, platform) {
  return koppelingVoor(clientId)[platform] === BronStatus.GEKOPPELD;
}

/** True wanneer beide bronnen (Meta én Google) gekoppeld zijn. */
export function isVolledigGekoppeld(clientId) {
  const k = koppelingVoor(clientId);
  return k.meta === BronStatus.GEKOPPELD && k.google === BronStatus.GEKOPPELD;
}

/** Het aantal (demo-)gekoppelde bronnen voor een klant (0–2). */
export function aantalGekoppeld(clientId) {
  const k = koppelingVoor(clientId);
  return (k.meta === BronStatus.GEKOPPELD ? 1 : 0) + (k.google === BronStatus.GEKOPPELD ? 1 : 0);
}

/** (Demo-)koppelt een bron voor een klant. Idempotent. */
export function koppelBron(clientId, platform) {
  if (!clientId || !PLATFORM_SET.has(platform)) return;
  const data = laadAlles();
  const rec = { ...(data[clientId] ?? {}) };
  rec[platform] = { status: BronStatus.GEKOPPELD, gekoppeldOp: nu() };
  data[clientId] = rec;
  bewaar(data);
}

/** Ontkoppelt een bron weer (terug naar demodata). */
export function ontkoppelBron(clientId, platform) {
  if (!clientId || !PLATFORM_SET.has(platform)) return;
  const data = laadAlles();
  if (!data[clientId]) return;
  const rec = { ...data[clientId] };
  delete rec[platform];
  if (Object.keys(rec).length) data[clientId] = rec;
  else delete data[clientId];
  bewaar(data);
}
