/**
 * Metriekopbouw: de data achter een drill-down.
 *
 * Wanneer een gebruiker op een KPI klikt, hoort hij te zien wáár het cijfer
 * vandaan komt: welk kanaal, welke campagne, welk conversietype eraan bijdraagt,
 * en hoe die bijdrage zich ontwikkelde. Deze module rekent dat uit, binnen
 * dezelfde filtercontext en dezelfde tenantgrens als de rest van de repository.
 *
 * DE HARDE REGEL BLIJFT
 * Er wordt niets opgehaald buiten wat de gebruiker mag zien. De opbouw komt uit
 * dezelfde viewmodellen (getClientDashboard, getKanaalOverzicht) die ook de
 * pagina's voeden, zodat een drill-down per definitie optelt tot het cijfer
 * erboven.
 */

import {
  getClientDashboard, getKanaalOverzicht, getAccessibleClientSummaries,
} from './repository.js';
import { metriekCatalogus } from './metrics-catalog.js';
import { veiligPercentage, berekenDelta } from './metrics.js';
import { kanaalLabel } from '../filters/channels.js';

/**
 * De opbouw van één metriek.
 *
 * @param {object} user
 * @param {object} filters   opgeloste filtercontext
 * @param {string} metric    metrieksleutel
 * @param {{clientId?: string|null}} opties
 * @returns {object|null}     null wanneer de metriek geen opbouw kent
 */
export function getMetriekOpbouw(user, filters, metric, { clientId = null } = {}) {
  const cat = metriekCatalogus(metric);
  if (!cat.drilldowns.length) return null;

  return clientId
    ? opbouwVoorKlant(user, filters, metric, clientId, cat)
    : opbouwVoorPortefeuille(user, filters, metric, cat);
}

/* ---------------------------------------------------------------
   Klantniveau
   --------------------------------------------------------------- */

function opbouwVoorKlant(user, filters, metric, clientId, cat) {
  const dashboard = getClientDashboard(user, clientId, filters);
  if (!dashboard) return null;

  const totaal = dashboard.totalen[metric] ?? null;
  const vorig = dashboard.vorigeTotalen?.[metric] ?? null;
  const delta = dashboard.deltas[metric]
    ?? berekenDelta(metric, totaal, vorig, { vergelijkingActief: dashboard.vergelijkingActief });

  const secties = [];

  if (cat.drilldowns.includes('channel')) {
    const rijen = (dashboard.kanaalRijen ?? [])
      .map((k) => ({ label: k.label, waarde: k[metric] ?? null }))
      .filter((r) => r.waarde != null)
      .sort((a, b) => (b.waarde ?? 0) - (a.waarde ?? 0));
    if (rijen.length) secties.push(bouwSectie('Per kanaal', rijen, totaal, cat));
  }

  if (cat.drilldowns.includes('campaign')) {
    const campagnes = dashboard.profiel?.googleAds?.campagnes ?? [];
    const veld = campagneVeld(metric);
    if (veld) {
      const rijen = campagnes
        .map((c) => ({ label: c.naam, waarde: c[veld] ?? null }))
        .filter((r) => r.waarde != null)
        .sort((a, b) => (b.waarde ?? 0) - (a.waarde ?? 0))
        .slice(0, 6);
      if (rijen.length) secties.push(bouwSectie('Grootste campagnes (Google Ads)', rijen, null, cat));
    }
  }

  if (cat.drilldowns.includes('conversionType')) {
    const conv = dashboard.conversies;
    const rijen = [...(conv?.primair ?? []), ...(conv?.secundair ?? [])]
      .map((c) => ({ label: c.label, waarde: c.aantal ?? null }))
      .filter((r) => r.waarde != null)
      .sort((a, b) => (b.waarde ?? 0) - (a.waarde ?? 0));
    if (rijen.length) secties.push(bouwSectie('Per conversietype', rijen, null, cat, { formaat: 'getal' }));
  }

  return {
    metric,
    catalogus: cat,
    context: 'klant',
    clientId,
    contextLabel: dashboard.client.name,
    totaal,
    vorig,
    delta,
    secties,
    volledigeHash: `#/client/analysis?tab=${eersteAnalyseTab(metric)}`,
    heeftData: dashboard.heeftData,
  };
}

/* ---------------------------------------------------------------
   Portefeuilleniveau
   --------------------------------------------------------------- */

function opbouwVoorPortefeuille(user, filters, metric, cat) {
  const overzicht = getKanaalOverzicht(user, filters);
  const samenvattingen = getAccessibleClientSummaries(user, filters);

  const totaal = optelbaar(metric)
    ? som(samenvattingen.map((s) => s.totalen[metric]))
    : null;
  const vorig = optelbaar(metric)
    ? som(samenvattingen.map((s) => s.vorigeTotalen?.[metric]))
    : null;
  const delta = berekenDelta(metric, totaal, vorig, { vergelijkingActief: filters.vergelijkingActief });

  const secties = [];

  if (cat.drilldowns.includes('channel')) {
    const rijen = overzicht.kanalen
      .map((k) => ({ label: k.label, waarde: k[kanaalVeld(metric)] ?? null }))
      .filter((r) => r.waarde != null)
      .sort((a, b) => (b.waarde ?? 0) - (a.waarde ?? 0));
    if (rijen.length) secties.push(bouwSectie('Per kanaal', rijen, totaal, cat));
  }

  // Bijdrage per klant: altijd zinvol op portefeuilleniveau.
  const perKlant = samenvattingen
    .map((s) => ({ label: s.client.name, waarde: s.totalen[metric] ?? null, clientId: s.client.id }))
    .filter((r) => r.waarde != null)
    .sort((a, b) => (b.waarde ?? 0) - (a.waarde ?? 0))
    .slice(0, 8);
  if (perKlant.length) secties.push(bouwSectie('Grootste bijdrage per klant', perKlant, totaal, cat, { link: 'klant' }));

  return {
    metric,
    catalogus: cat,
    context: 'portefeuille',
    clientId: null,
    contextLabel: 'Portefeuille',
    totaal,
    vorig,
    delta,
    secties,
    volledigeHash: '#/agency/channels',
    heeftData: totaal != null,
  };
}

/* ---------------------------------------------------------------
   Hulp
   --------------------------------------------------------------- */

function bouwSectie(titel, rijen, totaal, cat, { link = null } = {}) {
  const somWaarde = totaal ?? som(rijen.map((r) => r.waarde));
  return {
    titel,
    rijen: rijen.map((r) => ({
      ...r,
      aandeel: somWaarde ? veiligPercentage(r.waarde, somWaarde) : null,
      link,
    })),
    formaat: cat.formaat,
  };
}

function som(waarden) {
  const geldig = waarden.filter((v) => v != null && !Number.isNaN(v));
  return geldig.length ? geldig.reduce((a, b) => a + b, 0) : null;
}

/** Alleen kosten en gebeurtenissen zijn over klanten heen optelbaar. */
function optelbaar(metric) {
  return ['spend', 'impressions', 'clicks', 'sessions', 'users', 'leads', 'qualifiedLeads',
    'revenue', 'purchases', 'conversies', 'reach'].includes(metric);
}

/** Het veld in het kanaaloverzicht dat bij een metriek hoort. */
function kanaalVeld(metric) {
  return metric;
}

/** Het veld in de Google Ads-campagnedata dat bij een metriek hoort. */
function campagneVeld(metric) {
  const map = {
    spend: 'kosten', clicks: 'klikken', impressions: 'vertoningen',
    leads: 'leads', qualifiedLeads: 'gekwalificeerdeLeads',
    purchases: 'conversies', conversies: 'conversies', revenue: 'conversiewaarde',
  };
  return map[metric] ?? null;
}

function eersteAnalyseTab(metric) {
  const map = {
    spend: 'kosten', cpl: 'kosten', cpql: 'kosten', cpa: 'rendement',
    leads: 'leads', qualifiedLeads: 'kwaliteit', revenue: 'omzet', roas: 'rendement',
    purchases: 'transacties', conversies: 'leads',
  };
  return map[metric] ?? 'campagnes';
}

export { kanaalLabel };
