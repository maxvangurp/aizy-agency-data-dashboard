/**
 * Datalaag voor het simpele Meta/Google Ads-dashboard.
 *
 * Haalt de advertentiecijfers op via de data-provider-seam
 * (`fetchResource(url, sampleLoader)`): in demomodus draait de sample-loader,
 * in live modus wordt de API bevraagd. Het dashboard consumeert altijd dezelfde
 * contractvorm, dus een echte koppeling vervangt alléén de sample-loader — de
 * dashboard-code blijft gelijk. Zie docs/api-contract-ads.md voor het contract.
 */

import { fetchResource, DataStatus } from '../data-provider.js';
import { metaInsightsSample, googleCampagnesSample } from '../sample-data/ads-sample.js';

function periodeQuery(filters) {
  const p = filters?.periode ?? {};
  const params = new URLSearchParams();
  if (p.startDate) params.set('since', p.startDate);
  if (p.endDate) params.set('until', p.endDate);
  return params.toString();
}

/**
 * Haalt de Meta- en Google Ads-platformblokken op voor één klant.
 * `dashboard` is het al berekende klantdashboard (uit `getClientDashboard`);
 * dat levert de basiscijfers waaruit de sample-loaders de contractvorm afleiden.
 */
export async function haalAdsPlatforms(dashboard, filters) {
  if (!dashboard) return null;
  const q = periodeQuery(filters);
  const clientId = encodeURIComponent(dashboard.client.id);

  const [meta, google] = await Promise.all([
    fetchResource(`/api/meta/insights?client=${clientId}&${q}`, () => metaInsightsSample(dashboard)),
    fetchResource(`/api/google-ads/campaigns?client=${clientId}&${q}`, () => googleCampagnesSample(dashboard)),
  ]);

  return {
    meta: meta.data ?? null,
    google: google.data ?? null,
    status: { meta: meta.status, google: google.status },
    demodata: meta.status === DataStatus.SAMPLE || google.status === DataStatus.SAMPLE,
  };
}

/** Telt de platformtotalen op tot één gecombineerd totaal (Meta + Google). */
export function combineerTotalen(platforms) {
  const blokken = [platforms?.meta, platforms?.google].filter((b) => b?.aanwezig && b.totals);
  if (!blokken.length) return null;

  const som = (veld) => blokken.reduce((s, b) => s + (b.totals[veld] ?? 0), 0);
  const spend = som('spend');
  const impressions = som('impressions');
  const clicks = som('clicks');
  const results = som('results');

  return {
    spend,
    impressions,
    clicks,
    ctr: impressions ? (clicks / impressions) * 100 : null,
    cpc: clicks ? spend / clicks : null,
    results,
    costPerResult: results ? spend / results : null,
    resultLabel: blokken[0].resultLabel,
  };
}

/** Alle campagnes over beide platforms, gesorteerd op spend (voor de tabel). */
export function alleCampagnes(platforms) {
  const meta = (platforms?.meta?.campaigns ?? []).map((c) => ({ ...c, platform: 'Meta Ads' }));
  const google = (platforms?.google?.campaigns ?? []).map((c) => ({ ...c, platform: 'Google Ads' }));
  return [...meta, ...google].sort((a, b) => (b.spend ?? 0) - (a.spend ?? 0));
}
