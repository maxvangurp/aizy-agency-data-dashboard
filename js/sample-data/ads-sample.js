/**
 * Sample-loaders voor het datagerichte Meta/Google Ads-dashboard (simpele modus).
 *
 * Deze functies leveren data in de vórm van het API-contract (zie
 * docs/api-contract-ads.md) — niet de interne sample-structuur. Ze leiden die
 * contractvorm af uit het al berekende klantdashboard (`getClientDashboard`):
 * per-kanaal totalen, de tijdreeks en de Google Ads-campagnedetails. Zo toont
 * het dashboard nu sample-cijfers en straks live cijfers door alleen deze
 * loaders te vervangen door een echte API-fetch — de dashboard-code verandert niet.
 *
 * Een "platformblok" heeft altijd dezelfde vorm voor Meta én Google:
 *   { platform, label, aanwezig, totals, series[], campaigns[] }
 */

const PLATFORMS = {
  meta: { channel: 'meta_ads', label: 'Meta Ads' },
  google: { channel: 'google_ads', label: 'Google Ads' },
};

/** Het resultaatveld dat bij het dashboardtype hoort. */
function resultVeld(model) {
  if (model === 'ecommerce') return 'purchases';
  if (model === 'awareness') return 'engagements';
  return 'leads';
}
function resultLabel(model) {
  if (model === 'ecommerce') return 'Aankopen';
  if (model === 'awareness') return 'Interacties';
  return 'Leads';
}

function ratio(teller, noemer) {
  return noemer ? teller / noemer : null;
}

/** Bouwt één platformblok (contractvorm) uit de dashboard-data. */
function platformBlok(dashboard, platform) {
  const { channel, label } = PLATFORMS[platform];
  const rveld = resultVeld(dashboard.model);
  const rlabel = resultLabel(dashboard.model);
  const rij = (dashboard.kanaalRijen ?? []).find((k) => k.channel === channel);

  if (!rij) {
    return { platform, label, aanwezig: false, resultLabel: rlabel, totals: null, series: [], campaigns: [] };
  }

  const spend = rij.spend ?? 0;
  const impressions = rij.impressions ?? 0;
  const clicks = rij.clicks ?? 0;
  const results = rij[rveld] ?? rij.leads ?? 0;

  const totals = {
    spend,
    impressions,
    clicks,
    ctr: ratio(clicks, impressions) != null ? ratio(clicks, impressions) * 100 : null,
    cpc: ratio(spend, clicks),
    results,
    costPerResult: ratio(spend, results),
  };

  // Tijdreeks: verdeel de totale dashboard-reeks over dit platform naar spend-aandeel.
  const totaalSpend = (dashboard.kanaalRijen ?? []).reduce((s, k) => s + (k.spend ?? 0), 0) || 1;
  const aandeel = spend / totaalSpend;
  const series = (dashboard.reeks?.punten ?? []).map((p) => ({
    date: p.date,
    spend: p.spend != null ? Math.round(p.spend * aandeel) : null,
    results: p[rveld] != null ? Math.round(p[rveld] * aandeel)
      : p.leads != null ? Math.round(p.leads * aandeel) : null,
  }));

  const campaigns = platform === 'google'
    ? googleCampagnes(dashboard, rlabel)
    : metaCampagnes(totals, rlabel);

  return { platform, label, aanwezig: true, resultLabel: rlabel, totals, series, campaigns };
}

/** Google Ads-campagnes uit het bestaande sample-profiel (of afgeleid). */
function googleCampagnes(dashboard, rlabel) {
  const bron = dashboard.profiel?.googleAds?.campagnes ?? [];
  if (bron.length) {
    return bron.map((c) => ({
      name: c.naam,
      type: c.type ?? null,
      spend: c.kosten ?? 0,
      impressions: c.vertoningen ?? null,
      clicks: c.klikken ?? 0,
      ctr: c.vertoningen ? (c.klikken / c.vertoningen) * 100 : null,
      cpc: c.klikken ? c.kosten / c.klikken : null,
      results: c.leads ?? 0,
      costPerResult: c.leads ? c.kosten / c.leads : null,
      resultLabel: rlabel,
    }));
  }
  // Geen campagnedetail beschikbaar (bijv. ecommerce/awareness): één regel uit het totaal.
  const rij = (dashboard.kanaalRijen ?? []).find((k) => k.channel === 'google_ads');
  return rij ? [afgeleideCampagne('Google Ads | Totaal', rij, resultVeld(dashboard.model), rlabel)] : [];
}

/** Meta-campagnes: in de sample afgeleid uit de platformtotalen (3 typische campagnes). */
function metaCampagnes(totals, rlabel) {
  if (!totals || !totals.spend) return [];
  const verdeling = [
    { naam: 'Meta | Prospecting', deel: 0.5 },
    { naam: 'Meta | Retargeting', deel: 0.3 },
    { naam: 'Meta | Merkbekendheid', deel: 0.2 },
  ];
  return verdeling.map(({ naam, deel }) => {
    const spend = Math.round(totals.spend * deel);
    const impressions = Math.round(totals.impressions * deel);
    const clicks = Math.round(totals.clicks * deel);
    const results = Math.round(totals.results * deel);
    return {
      name: naam,
      type: 'Meta',
      spend,
      impressions,
      clicks,
      ctr: impressions ? (clicks / impressions) * 100 : null,
      cpc: clicks ? spend / clicks : null,
      results,
      costPerResult: results ? spend / results : null,
      resultLabel: rlabel,
    };
  });
}

function afgeleideCampagne(naam, rij, rveld, rlabel) {
  const spend = rij.spend ?? 0;
  const clicks = rij.clicks ?? 0;
  const impressions = rij.impressions ?? 0;
  const results = rij[rveld] ?? rij.leads ?? 0;
  return {
    name: naam,
    type: null,
    spend,
    impressions,
    clicks,
    ctr: impressions ? (clicks / impressions) * 100 : null,
    cpc: clicks ? spend / clicks : null,
    results,
    costPerResult: results ? spend / results : null,
    resultLabel: rlabel,
  };
}

/** Contractvormige Meta-insights, afgeleid uit het dashboard. */
export function metaInsightsSample(dashboard) {
  return platformBlok(dashboard, 'meta');
}

/** Contractvormige Google Ads-campagnes, afgeleid uit het dashboard. */
export function googleCampagnesSample(dashboard) {
  return platformBlok(dashboard, 'google');
}
