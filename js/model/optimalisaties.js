/**
 * Optimalisaties bijhouden (simpele modus).
 *
 * Het simpele dashboard surfacet aanbevolen optimalisaties (de `actie` van elk
 * auto-inzicht). Hier houden we per klant bij welke je hebt opgepakt en in welke
 * status ze staan — een lichtgewicht tracker, bewust NIET de zware
 * agency-acties/signalen-workflow.
 *
 * Een record is een SNAPSHOT van de aanbeveling op het moment van oppakken
 * (titel + actie), zodat een opgepakte optimalisatie in de lijst blijft staan ook
 * als de onderliggende cijfers de volgende periode wijzigen. De `sleutel` (stabiel
 * per aanbeveling) voorkomt dat dezelfde optimalisatie dubbel wordt vastgelegd.
 *
 * Alles staat in de demo-opslag (`aizy.demo.optimalisaties`); geen backend.
 */

import { lees, schrijf, nieuwId, nu } from './store.js';

const SLEUTEL = 'optimalisaties';
const VERSIE = 1;

/** De statussen van een optimalisatie (lichte flow, geen planning/toewijzing). */
export const OptimStatus = {
  OPEN: 'open',
  BEZIG: 'bezig',
  AFGEROND: 'afgerond',
  NIET_NU: 'niet_nu',
};

const STATUS_SET = new Set(Object.values(OptimStatus));

/** Alle opgeslagen optimalisaties (over alle klanten), nieuwste eerst. */
export function laadOptimalisaties() {
  const lijst = lees(SLEUTEL, VERSIE, []);
  return Array.isArray(lijst) ? lijst : [];
}

function bewaar(lijst) {
  return schrijf(SLEUTEL, VERSIE, lijst);
}

/** De optimalisaties voor één klant. */
export function optimalisatiesVoor(clientId) {
  return laadOptimalisaties().filter((o) => o.clientId === clientId);
}

/** De optimalisatie voor een klant + stabiele sleutel, of null. */
export function optimalisatieVoor(clientId, sleutel) {
  return laadOptimalisaties().find((o) => o.clientId === clientId && o.sleutel === sleutel) ?? null;
}

/**
 * Neemt een aanbevolen optimalisatie op in de tracker (status OPEN). Idempotent
 * per klant+sleutel: bestaat hij al, dan blijft de bestaande (met zijn status)
 * staan. Retourneert het (nieuwe of bestaande) record.
 */
export function oppakOptimalisatie({ clientId, sleutel, titel, actie, categorie }) {
  if (!clientId || !sleutel) return null;
  const lijst = laadOptimalisaties();
  const bestaand = lijst.find((o) => o.clientId === clientId && o.sleutel === sleutel);
  if (bestaand) return bestaand;
  const record = {
    id: nieuwId('opt'),
    clientId,
    sleutel,
    titel: titel ?? '',
    actie: actie ?? '',
    categorie: categorie ?? null,
    status: OptimStatus.OPEN,
    aangemaaktOp: nu(),
    gewijzigdOp: nu(),
  };
  lijst.unshift(record);
  bewaar(lijst);
  return record;
}

/** Zet de status van een optimalisatie. */
export function zetOptimalisatieStatus(id, status) {
  if (!STATUS_SET.has(status)) return null;
  const lijst = laadOptimalisaties();
  const idx = lijst.findIndex((o) => o.id === id);
  if (idx < 0) return null;
  lijst[idx] = { ...lijst[idx], status, gewijzigdOp: nu() };
  bewaar(lijst);
  return lijst[idx];
}

/** Verwijdert een optimalisatie uit de tracker. */
export function verwijderOptimalisatie(id) {
  bewaar(laadOptimalisaties().filter((o) => o.id !== id));
}
