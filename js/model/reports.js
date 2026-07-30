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
export function nieuwConcept({ client, model, dashboard, auteur, periodeLabel, filters }) {
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
    // De filters worden opgeslagen zodat de rapportage overal dezelfde cijfers
    // toont, ongeacht wie hem bekijkt of welke periode er op dat moment is
    // geselecteerd. De demo-data is deterministisch per periode+kanalen. In de
    // builder is de periode nu wél aanpasbaar; bij opslaan blijft de keuze staan.
    filters: filters ?? null,
    // Vervolgstappen: null = automatisch afgeleid uit de acties van de gekozen
    // inzichten (leeft mee met periode/selectie); een array = door de agency
    // handmatig vastgelegde stappen (één string per stap).
    vervolgstappen: null,
    onderdelen: {
      kpis,
      inzichtIds,
      funnel: Boolean(dashboard?.funnel),
      kanalen: true,
      ontwikkeling: true,
      vervolgstappen: true,
      samenwerking: true,
    },
    auteur: auteur ?? null,
    aangemaaktOp: nu(),
    gewijzigdOp: nu(),
    concept: true,
    gepubliceerd: false,
    gepubliceerdOp: null,
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

/** Publiceert een opgeslagen rapportage naar de klant-omgeving. */
export function publiceerRapportage(id) {
  return zetPublicatie(id, true);
}

/** Trekt een publicatie in; de klant ziet de rapportage dan niet meer. */
export function trekPublicatieIn(id) {
  return zetPublicatie(id, false);
}

function zetPublicatie(id, gepubliceerd) {
  const lijst = laadRapportages();
  const idx = lijst.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  lijst[idx] = {
    ...lijst[idx],
    gepubliceerd,
    gepubliceerdOp: gepubliceerd ? nu() : null,
    gewijzigdOp: nu(),
  };
  bewaar(lijst);
  return lijst[idx];
}

/** De gepubliceerde rapportages voor één klant, nieuwste publicatie eerst. */
export function gepubliceerdeRapportagesVoor(clientId) {
  return laadRapportages()
    .filter((r) => r.gepubliceerd && r.clientId === clientId)
    .sort((a, b) => String(b.gepubliceerdOp ?? '').localeCompare(String(a.gepubliceerdOp ?? '')));
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
    vervolgstappen: Array.isArray(bron.vervolgstappen) ? [...bron.vervolgstappen] : null,
    gepubliceerd: false,
    gepubliceerdOp: null,
    aangemaaktOp: nu(),
    gewijzigdOp: nu(),
  };
  const lijst = laadRapportages();
  lijst.unshift(kopie);
  bewaar(lijst);
  return kopie;
}
