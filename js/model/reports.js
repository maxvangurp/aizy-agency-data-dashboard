/**
 * Opgeslagen rapportages voor de rapportage-builder.
 *
 * Een rapportage is een samenstelling: welke KPI's, inzichten en secties van het
 * klantdashboard erin komen, plus een titel en een intro. De cijfers en
 * grafieken zelf worden bij het tonen live uit het dashboard gehaald, zodat een
 * rapportage nooit verouderde data toont — de builder legt de *samenstelling*
 * vast, niet een bevroren kopie van de data.
 *
 * Alles staat in de demo-opslag (gedeeld binnen het agency-account, want een
 * rapportage is teamwerk). Geen echte API: dit is de demo-persistentie.
 */

import { lees, schrijf, nieuwId, nu } from './store.js';
import { PRIMARY_KPIS } from '../sample-data/shared.js';

const SLEUTEL = 'rapportages';
const VERSIE = 1;

/** Alle opgeslagen rapportages, nieuwste eerst. */
export function laadRapportages() {
  const lijst = lees(SLEUTEL, VERSIE, []);
  return Array.isArray(lijst) ? lijst : [];
}

function bewaar(lijst) {
  return schrijf(SLEUTEL, VERSIE, lijst);
}

export function getRapportage(id) {
  return laadRapportages().find((r) => r.id === id) ?? null;
}

/**
 * Een vers concept met verstandige standaarden: alle KPI's van het model, alle
 * beschikbare inzichten en alle secties staan aan. Het concept is nog niet
 * opgeslagen; de builder houdt het vast tot de gebruiker op Opslaan drukt.
 */
export function nieuwConcept({ client, model, dashboard, auteur, periodeLabel }) {
  const kpis = (PRIMARY_KPIS[client.businessModel] ?? []).slice();
  // Inzichten staan als { primair, aanvullend }; de builder werkt met de platte
  // lijst, dus indexeren we over beide samen.
  const inzichten = [...(dashboard?.inzichten?.primair ?? []), ...(dashboard?.inzichten?.aanvullend ?? [])];
  const inzichtIds = inzichten.map((_, i) => i);
  return {
    id: nieuwId('rap'),
    clientId: client.id,
    clientNaam: client.name,
    model,
    titel: `Rapportage ${client.name}`,
    intro: '',
    periodeLabel: periodeLabel ?? '',
    onderdelen: {
      kpis,
      inzichtIds,
      funnel: Boolean(dashboard?.funnel),
      kanalen: true,
      ontwikkeling: true,
      samenwerking: true,
    },
    auteur: auteur ?? null,
    aangemaaktOp: nu(),
    gewijzigdOp: nu(),
    concept: true,
  };
}

/** Voegt een nieuwe rapportage toe of werkt een bestaande bij. */
export function opslaanRapportage(rapportage) {
  const lijst = laadRapportages();
  const opgeslagen = { ...rapportage, concept: false, gewijzigdOp: nu() };
  const idx = lijst.findIndex((r) => r.id === rapportage.id);
  if (idx >= 0) lijst[idx] = opgeslagen;
  else lijst.unshift(opgeslagen);
  bewaar(lijst);
  return opgeslagen;
}

export function verwijderRapportage(id) {
  bewaar(laadRapportages().filter((r) => r.id !== id));
}

/** Dupliceert een opgeslagen rapportage zodat je een variant kunt maken. */
export function dupliceerRapportage(id) {
  const bron = getRapportage(id);
  if (!bron) return null;
  const kopie = {
    ...bron,
    id: nieuwId('rap'),
    titel: `${bron.titel} (kopie)`,
    onderdelen: { ...bron.onderdelen, kpis: [...bron.onderdelen.kpis], inzichtIds: [...bron.onderdelen.inzichtIds] },
    aangemaaktOp: nu(),
    gewijzigdOp: nu(),
  };
  const lijst = laadRapportages();
  lijst.unshift(kopie);
  bewaar(lijst);
  return kopie;
}
