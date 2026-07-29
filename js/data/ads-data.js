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
import { berekenDelta } from './metrics.js';

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
  // Optelling die null blijft wanneer géén enkel platform het veld levert
  // (bijv. omzet bij leadgen), zodat een afgeleide als ROAS niet op 0 uitkomt.
  const somOfNull = (veld) => {
    const aanwezig = blokken.filter((b) => b.totals[veld] != null);
    return aanwezig.length ? aanwezig.reduce((s, b) => s + b.totals[veld], 0) : null;
  };
  const spend = som('spend');
  const impressions = som('impressions');
  const clicks = som('clicks');
  const results = som('results');
  const revenue = somOfNull('revenue');
  const reach = somOfNull('reach');

  return {
    spend,
    impressions,
    clicks,
    results,
    ctr: impressions ? (clicks / impressions) * 100 : null,
    cpc: clicks ? spend / clicks : null,
    cpm: impressions ? (spend / impressions) * 1000 : null,
    costPerResult: results ? spend / results : null,
    conversieratio: clicks ? (results / clicks) * 100 : null,
    revenue,
    roas: (revenue != null && spend) ? revenue / spend : null,
    reach,
    frequentie: reach ? impressions / reach : null,
    resultLabel: blokken[0].resultLabel,
  };
}

/** De metrieksleutel voor het resultaat en de kosten-per-resultaat, per klanttype. */
export function resultMetriek(model) {
  if (model === 'ecommerce') return 'purchases';
  if (model === 'awareness') return 'engagements';
  return 'leads';
}
function kostenMetriek(model) {
  if (model === 'ecommerce') return 'cpa';
  if (model === 'awareness') return 'cpc';
  return 'cpl';
}

/**
 * De vorige-periode-waarden op ad-schaal. De basiswaarden worden geschaald met
 * de account-brede periode-over-periode-verhouding (`vorigeTotalen`/`totalen`);
 * de ratio's (CTR, CPC, CPM, ROAS…) worden dáár weer uit afgeleid, zodat ze
 * intern consistent zijn. Zelfde methode als in `vergelijkingTabel`.
 */
export function adTotalenVorige(dashboard, ad) {
  const t = dashboard.totalen ?? {};
  const v = dashboard.vorigeTotalen ?? {};
  const rveld = resultMetriek(dashboard.model);
  const schaal = (waarde, accKey) => {
    const nu = t[accKey];
    const toen = v[accKey];
    return (waarde != null && nu != null && toen != null && nu !== 0) ? waarde * (toen / nu) : null;
  };
  const spend = schaal(ad.spend, 'spend');
  const impressions = schaal(ad.impressions, 'impressions');
  const clicks = schaal(ad.clicks, 'clicks');
  const results = schaal(ad.results, rveld);
  const revenue = schaal(ad.revenue, 'revenue');
  const reach = schaal(ad.reach, 'reach');
  return {
    spend, impressions, clicks, results, revenue, reach,
    ctr: impressions ? (clicks / impressions) * 100 : null,
    cpc: clicks ? spend / clicks : null,
    cpm: impressions ? (spend / impressions) * 1000 : null,
    costPerResult: results ? spend / results : null,
    conversieratio: clicks ? (results / clicks) * 100 : null,
    roas: (revenue != null && spend) ? revenue / spend : null,
    frequentie: reach ? impressions / reach : null,
  };
}

/**
 * Delta per metrieksleutel voor de gecombineerde ad-totalen, t.o.v. de vorige
 * periode. Hergebruikt `berekenDelta` (richting uit de metriek-catalogus), zodat
 * een view nooit zelf hoeft te weten of dalen goed nieuws is.
 */
export function adDeltas(dashboard, ad) {
  if (!ad) return {};
  const vorige = adTotalenVorige(dashboard, ad);
  const rveld = resultMetriek(dashboard.model);
  const kveld = kostenMetriek(dashboard.model);
  const paren = [
    ['spend', 'spend'], ['impressions', 'impressions'], ['clicks', 'clicks'],
    ['ctr', 'ctr'], ['cpc', 'cpc'], ['cpm', 'cpm'],
    ['results', rveld], ['costPerResult', kveld], ['conversieratio', 'conversieratio'],
    ['revenue', 'revenue'], ['roas', 'roas'], ['reach', 'reach'], ['frequentie', 'frequentie'],
  ];
  const uit = {};
  for (const [adKey, metriekKey] of paren) {
    uit[adKey] = berekenDelta(metriekKey, ad[adKey], vorige[adKey]);
  }
  return uit;
}

/** Groepeert de dagreeks op weekdag (ma–zo) en telt spend + resultaten op. */
export function perWeekdag(platforms) {
  const namen = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];
  const volgorde = [1, 2, 3, 4, 5, 6, 0]; // maandag eerst
  const meta = platforms?.meta?.series ?? [];
  const google = platforms?.google?.series ?? [];
  const basis = meta.length ? meta : google;
  const acc = new Map();
  basis.forEach((p, i) => {
    const dag = new Date(`${p.date}T00:00:00`).getDay();
    const spend = (meta[i]?.spend ?? 0) + (google[i]?.spend ?? 0);
    const results = (meta[i]?.results ?? 0) + (google[i]?.results ?? 0);
    const rij = acc.get(dag) ?? { dag, dagen: 0, spend: 0, results: 0 };
    rij.dagen += 1; rij.spend += spend; rij.results += results;
    acc.set(dag, rij);
  });
  return volgorde
    .filter((d) => acc.has(d))
    .map((d) => {
      const r = acc.get(d);
      return {
        name: namen[d],
        spend: r.spend,
        results: r.results,
        dagen: r.dagen,
        costPerResult: r.results ? r.spend / r.results : null,
      };
    });
}

/** Voegt een resultaat-aandeel (%) en kosten/resultaat toe aan segmentrijen. */
function metAandeel(rijen) {
  const totaal = rijen.reduce((s, r) => s + (r.results ?? 0), 0);
  return rijen.map((r) => ({
    ...r,
    aandeel: totaal ? (r.results / totaal) * 100 : null,
    costPerResult: (r.spend != null && r.results) ? r.spend / r.results : null,
  }));
}

/**
 * Segmentdata voor de Segmenten-pagina: apparaat, regio/land en weekdag.
 *
 * De bron verschilt per klanttype: e-commerce leest apparaat uit Google Ads
 * (mét kosten), leadgen uit de analytics-verdelingen (mét gebruikers). Regio en
 * land komen uit de analytics-verdelingen (aanwezig bij leadgen). De weekdag komt
 * uit de gecombineerde dagreeks. Ontbrekende segmenten leveren een lege lijst,
 * die de view netjes wegvalt.
 */
export function adSegmenten(dashboard, platforms) {
  const profiel = dashboard.profiel ?? {};
  const rlabel = platforms?.meta?.resultLabel ?? platforms?.google?.resultLabel ?? 'Resultaat';

  const devices = dashboard.model === 'ecommerce'
    ? metAandeel((profiel.googleAds?.apparaten ?? []).map((a) => ({
        name: a.apparaat, spend: a.kosten ?? null, clicks: a.klikken ?? null, users: null, results: a.conversies ?? 0,
      })))
    : metAandeel((profiel.verdelingen?.apparaten ?? []).map((a) => ({
        name: a.apparaat, spend: null, clicks: null, users: a.gebruikers ?? null, results: a.leads ?? 0,
      })));

  const regios = metAandeel((profiel.verdelingen?.regios ?? []).map((r) => ({
    name: r.regio, spend: null, clicks: null, users: r.gebruikers ?? null, results: r.leads ?? 0,
  })));
  const landen = metAandeel((profiel.verdelingen?.landen ?? []).map((r) => ({
    name: r.land, spend: null, clicks: null, users: r.gebruikers ?? null, results: r.leads ?? 0,
  })));

  return { devices, regios, landen, weekdagen: perWeekdag(platforms), rlabel };
}

/** Alle campagnes over beide platforms, gesorteerd op spend (voor de tabel). */
export function alleCampagnes(platforms) {
  const meta = (platforms?.meta?.campaigns ?? []).map((c) => ({ ...c, platform: 'Meta Ads' }));
  const google = (platforms?.google?.campaigns ?? []).map((c) => ({ ...c, platform: 'Google Ads' }));
  return [...meta, ...google].sort((a, b) => (b.spend ?? 0) - (a.spend ?? 0));
}
