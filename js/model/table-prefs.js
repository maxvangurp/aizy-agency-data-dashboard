/**
 * Tabelvoorkeuren en opgeslagen weergaven.
 *
 * SLEUTELS
 * Een voorkeur hoort bij een gebruiker, een pagina, een tabel én een
 * klantcontext. Dezelfde kolomkeuze op de portefeuillepagina hoeft niet te
 * gelden voor de klantenlijst binnen één klant. De sleutel is daarom:
 *
 *   tabel.<gebruikersid>.<pagina>.<tabel>.<klantcontext|agency>
 *
 * WAT ER WORDT BEWAARD
 *   kolommen    de zichtbare kolommen, in de volgorde waarin ze staan
 *   breedtes    de handmatig ingestelde breedte per kolom, in pixels
 *   vastgezet   kolommen die links blijven staan bij horizontaal scrollen
 *   sortering   sleutel en richting
 *   groepering  kolom waarop wordt gegroepeerd, of null
 *   dichtheid   compacte of ruime rijhoogte
 *   perPagina   aantal rijen per pagina
 *   pagina      de pagina waarop de gebruiker stond
 *   zoek        de zoekterm
 *   filters     de actieve filters per filtersleutel
 *
 * OPGESLAGEN WEERGAVEN
 * Een weergave is een naam met precies deze staat eronder. Er zijn ingebouwde
 * weergaven die niet verwijderd kunnen worden, en eigen weergaven die dat wel
 * kunnen. Beide worden op dezelfde manier toegepast, zodat er geen tweede soort
 * gedrag ontstaat.
 */

import { lees, schrijf, wis, nieuwId, nu } from './store.js';

const VERSIE = 2;

export const Dichtheid = {
  COMPACT: 'compact',
  RUIM: 'ruim',
};

/** De staat waarmee een tabel begint wanneer er niets is bewaard. */
export function standaardStaat(definitie) {
  return {
    kolommen: definitie.kolommen.filter((k) => k.standaard !== false).map((k) => k.key),
    breedtes: {},
    vastgezet: definitie.kolommen.filter((k) => k.vast).map((k) => k.key),
    sortering: definitie.standaardSortering ?? null,
    groepering: null,
    dichtheid: definitie.dichtheid ?? Dichtheid.COMPACT,
    perPagina: definitie.perPagina ?? 25,
    pagina: 1,
    zoek: '',
    filters: {},
  };
}

function sleutelVoor({ userId, pagina, tabel, context }) {
  return `tabel.${userId ?? 'anoniem'}.${pagina}.${tabel}.${context ?? 'agency'}`;
}

function weergaveSleutelVoor({ userId, pagina, tabel }) {
  return `weergaven.${userId ?? 'anoniem'}.${pagina}.${tabel}`;
}

/**
 * Leest de bewaarde staat en vult hem aan tot een volledige staat.
 *
 * Kolommen die niet meer bestaan verdwijnen; nieuwe verplichte kolommen komen
 * erbij. Zonder die schoonmaak zou een oude voorkeur een lege tabel opleveren
 * zodra een kolom van naam verandert.
 */
export function leesStaat(context, definitie) {
  const standaard = standaardStaat(definitie);
  const bewaard = lees(sleutelVoor(context), VERSIE, null);
  if (!bewaard || typeof bewaard !== 'object') return standaard;

  return normaliseerStaat({ ...standaard, ...bewaard }, definitie);
}

/** Houdt een staat binnen wat de tabeldefinitie toestaat. */
export function normaliseerStaat(staat, definitie) {
  const bestaande = new Map(definitie.kolommen.map((k) => [k.key, k]));
  const verplicht = definitie.kolommen.filter((k) => k.verplicht).map((k) => k.key);

  let kolommen = (Array.isArray(staat.kolommen) ? staat.kolommen : [])
    .filter((key) => bestaande.has(key));
  for (const key of verplicht) {
    if (!kolommen.includes(key)) kolommen = [key, ...kolommen];
  }
  if (!kolommen.length) kolommen = standaardStaat(definitie).kolommen;

  const sortering = staat.sortering && bestaande.has(staat.sortering.key)
    ? { key: staat.sortering.key, richting: staat.sortering.richting === 'op' ? 'op' : 'af' }
    : definitie.standaardSortering ?? null;

  const groepering = staat.groepering && bestaande.get(staat.groepering)?.groepeerbaar
    ? staat.groepering
    : null;

  return {
    kolommen,
    breedtes: staat.breedtes && typeof staat.breedtes === 'object' ? staat.breedtes : {},
    vastgezet: (Array.isArray(staat.vastgezet) ? staat.vastgezet : []).filter((k) => kolommen.includes(k)),
    sortering,
    groepering,
    dichtheid: staat.dichtheid === Dichtheid.RUIM ? Dichtheid.RUIM : Dichtheid.COMPACT,
    perPagina: [10, 25, 50, 100].includes(Number(staat.perPagina)) ? Number(staat.perPagina) : 25,
    pagina: Math.max(1, Number(staat.pagina) || 1),
    zoek: typeof staat.zoek === 'string' ? staat.zoek : '',
    filters: staat.filters && typeof staat.filters === 'object' ? staat.filters : {},
  };
}

export function schrijfStaat(context, definitie, staat) {
  const genormaliseerd = normaliseerStaat(staat, definitie);
  schrijf(sleutelVoor(context), VERSIE, genormaliseerd);
  return genormaliseerd;
}

/** Zet de tabel terug naar de standaardweergave. */
export function herstelStaat(context) {
  wis(sleutelVoor(context));
}

/* ---------------------------------------------------------------
   Opgeslagen weergaven
   --------------------------------------------------------------- */

/**
 * Alle weergaven van een tabel: eerst de ingebouwde, dan de eigen.
 * De ingebouwde staan in de tabeldefinitie, zodat elke tabel zijn eigen zinnige
 * startpunten kan meebrengen in plaats van een generieke lijst.
 */
export function leesWeergaven(context, definitie) {
  const eigen = lees(weergaveSleutelVoor(context), VERSIE, []) ?? [];
  const ingebouwd = (definitie.weergaven ?? []).map((w) => ({ ...w, ingebouwd: true }));
  return [...ingebouwd, ...(Array.isArray(eigen) ? eigen : []).map((w) => ({ ...w, ingebouwd: false }))];
}

export function bewaarWeergave(context, naam, staat) {
  const tekst = String(naam ?? '').trim();
  if (!tekst) return null;

  const eigen = lees(weergaveSleutelVoor(context), VERSIE, []) ?? [];
  const weergave = { id: nieuwId('wg'), naam: tekst, staat, aangemaaktOp: nu() };
  schrijf(weergaveSleutelVoor(context), VERSIE, [...eigen, weergave]);
  return weergave;
}

export function verwijderWeergave(context, id) {
  const eigen = lees(weergaveSleutelVoor(context), VERSIE, []) ?? [];
  const over = eigen.filter((w) => w.id !== id);
  schrijf(weergaveSleutelVoor(context), VERSIE, over);
  return over.length !== eigen.length;
}

/**
 * Past een weergave toe op de huidige staat.
 * Alleen de velden die de weergave beschrijft worden overgenomen; de rest, zoals
 * kolombreedtes die de gebruiker zelf heeft ingesteld, blijft staan.
 */
export function pasWeergaveToe(staat, weergave, definitie) {
  return normaliseerStaat({ ...staat, ...(weergave?.staat ?? {}), pagina: 1 }, definitie);
}
