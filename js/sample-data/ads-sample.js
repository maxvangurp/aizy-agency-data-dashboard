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

/**
 * Het Nederlandse resultaatveld in de sample-profielrijen (campagnes,
 * zoekwoorden, advertentiegroepen). Ecommerce telt `conversies`, de overige
 * modellen `leads`. Zonder deze mapping tonen ecommerce-deep-dives 0 resultaten.
 */
function profielResultVeld(model) {
  if (model === 'ecommerce') return 'conversies';
  return 'leads';
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

  // Account-brede totalen om omzet (e-commerce) en bereik (awareness) naar dit
  // platform te splitsen: omzet naar resultaat-aandeel, bereik naar impressie-aandeel.
  const acc = dashboard.totalen ?? {};
  const accResults = acc[rveld] ?? null;
  const revenue = (dashboard.model === 'ecommerce' && acc.revenue != null && accResults)
    ? Math.round(acc.revenue * (results / accResults)) : null;
  const reach = (dashboard.model === 'awareness' && acc.reach != null && acc.impressions)
    ? Math.round(acc.reach * (impressions / acc.impressions)) : null;

  const totals = {
    spend,
    impressions,
    clicks,
    results,
    ctr: impressions ? (clicks / impressions) * 100 : null,
    cpc: ratio(spend, clicks),
    cpm: impressions ? (spend / impressions) * 1000 : null,
    costPerResult: ratio(spend, results),
    conversieratio: clicks ? (results / clicks) * 100 : null,
    revenue,
    roas: (revenue != null && spend) ? revenue / spend : null,
    reach,
    frequentie: reach ? impressions / reach : null,
  };

  // Tijdreeks. De uitgaven verdelen we naar spend-aandeel (dat reconcilieert met
  // de platform-spend). De resultaten schalen we op de dagelijkse resultaatvorm
  // zó dat de som gelijk is aan het wérkelijke platformresultaat (`results`) —
  // spend-weging zou niet aansluiten op de KPI-band en de vergelijkingstabel.
  const totaalSpend = (dashboard.kanaalRijen ?? []).reduce((s, k) => s + (k.spend ?? 0), 0) || 1;
  const aandeel = spend / totaalSpend;
  const punten = dashboard.reeks?.punten ?? [];
  // Kies de dagvorm voor de resultaten: de dagelijkse resultaatreeks als die er
  // is (bijv. purchases bij e-commerce), anders de dagelijkse uitgavenvorm (bij
  // leadgen ontbreekt een dagelijks leads-veld). In beide gevallen schalen we zó
  // dat de som gelijk is aan het werkelijke platformresultaat.
  const dagResultaat = (p) => (p[rveld] != null ? p[rveld] : p.leads);
  const somDagResultaat = punten.reduce((s, p) => s + (dagResultaat(p) ?? 0), 0);
  const somDagSpend = punten.reduce((s, p) => s + (p.spend ?? 0), 0);
  const vormVeld = somDagResultaat > 0 ? dagResultaat : (p) => p.spend;
  const somVorm = somDagResultaat > 0 ? somDagResultaat : somDagSpend;
  const resultSchaal = somVorm > 0 ? results / somVorm : null;
  // Klikken en impressies worden — net als resultaten — op hun dagelijkse vorm
  // geschaald naar het wérkelijke platformtotaal (niet naar spend-aandeel), zodat
  // de trendgrafiek per platform aansluit op de KPI-band voor datzelfde platform.
  const somDagImpr = punten.reduce((s, p) => s + (p.impressions ?? 0), 0);
  const somDagClicks = punten.reduce((s, p) => s + (p.clicks ?? 0), 0);
  const imprSchaal = somDagImpr > 0 ? impressions / somDagImpr : null;
  const clicksSchaal = somDagClicks > 0 ? clicks / somDagClicks : null;
  // Dagelijkse omzet (e-commerce) volgt de resultaatvorm, dagelijks bereik
  // (awareness) de impressievorm — beide geschaald op het platformtotaal, zodat
  // de sparklines reconciliëren met de KPI-band.
  const revenueSchaal = (revenue != null && somVorm > 0) ? revenue / somVorm : null;
  const reachSchaal = (reach != null && somDagImpr > 0) ? reach / somDagImpr : null;
  const series = punten.map((p) => {
    const vorm = vormVeld(p);
    return {
      date: p.date,
      spend: p.spend != null ? Math.round(p.spend * aandeel) : null,
      impressions: (imprSchaal != null && p.impressions != null) ? Math.round(p.impressions * imprSchaal) : null,
      clicks: (clicksSchaal != null && p.clicks != null) ? Math.round(p.clicks * clicksSchaal) : null,
      results: (resultSchaal != null && vorm != null) ? Math.round(vorm * resultSchaal) : null,
      revenue: (revenueSchaal != null && vorm != null) ? Math.round(vorm * revenueSchaal) : null,
      reach: (reachSchaal != null && p.impressions != null) ? Math.round(p.impressions * reachSchaal) : null,
    };
  });

  const campaigns = platform === 'google'
    ? googleCampagnes(dashboard, rlabel)
    : metaCampagnes(totals, rlabel);

  // Verdiepingen per platform (voor de deep-dive-pagina's): Google levert
  // advertentiegroepen + zoekwoorden uit het sample-profiel; Meta ad sets +
  // placements afgeleid uit de platformtotalen.
  const breakdowns = platform === 'google'
    ? googleBreakdowns(dashboard)
    : metaBreakdowns(totals);

  return { platform, label, aanwezig: true, resultLabel: rlabel, totals, series, campaigns, breakdowns };
}

/** Google-verdiepingen: advertentiegroepen + zoekwoorden uit het sample-profiel. */
function googleBreakdowns(dashboard) {
  const g = dashboard.profiel?.googleAds ?? {};
  const pv = profielResultVeld(dashboard.model);
  const keywords = (g.zoekwoorden ?? []).map((z) => {
    const results = z[pv] ?? 0;
    return {
      name: z.zoekwoord,
      matchType: z.matchtype ?? null,
      spend: z.kosten ?? 0,
      impressions: z.vertoningen ?? null,
      clicks: z.klikken ?? 0,
      ctr: z.vertoningen ? (z.klikken / z.vertoningen) * 100 : null,
      cpc: z.klikken ? z.kosten / z.klikken : null,
      results,
      costPerResult: results ? z.kosten / results : null,
    };
  });
  const adGroups = (g.advertentiegroepen ?? []).map((a) => {
    const results = a[pv] ?? 0;
    return {
      name: a.groep,
      campaign: a.campagne ?? null,
      spend: a.kosten ?? 0,
      clicks: a.klikken ?? 0,
      cpc: a.klikken ? a.kosten / a.klikken : null,
      results,
      costPerResult: results ? a.kosten / results : null,
    };
  });
  return { adGroups, keywords };
}

/** Meta-verdiepingen: ad sets + placements, afgeleid uit de platformtotalen. */
function metaBreakdowns(totals) {
  if (!totals || !totals.spend) return { adSets: [], placements: [] };
  const adSets = [
    { name: 'Lookalike 1% — NL', deel: 0.34 },
    { name: 'Interesses — kernpubliek', deel: 0.28 },
    { name: 'Retargeting — websitebezoekers', deel: 0.22 },
    { name: 'Retargeting — winkelwagen', deel: 0.16 },
  ].map(({ name, deel }) => afgeleidDeel(name, totals, deel));
  const placements = [
    { name: 'Facebook Feed', deel: 0.40 },
    { name: 'Instagram Feed', deel: 0.30 },
    { name: 'Stories & Reels', deel: 0.22 },
    { name: 'Audience Network', deel: 0.08 },
  ].map(({ name, deel }) => afgeleidDeel(name, totals, deel));
  return { adSets, placements };
}

/** Eén regel (ad set / placement) als aandeel van de platformtotalen. */
function afgeleidDeel(name, totals, deel) {
  const spend = Math.round(totals.spend * deel);
  const impressions = Math.round(totals.impressions * deel);
  const clicks = Math.round(totals.clicks * deel);
  const results = Math.round(totals.results * deel);
  return {
    name,
    spend,
    impressions,
    clicks,
    ctr: impressions ? (clicks / impressions) * 100 : null,
    cpc: clicks ? spend / clicks : null,
    results,
    costPerResult: results ? spend / results : null,
  };
}

/** Google Ads-campagnes uit het bestaande sample-profiel (of afgeleid). */
function googleCampagnes(dashboard, rlabel) {
  const bron = dashboard.profiel?.googleAds?.campagnes ?? [];
  if (bron.length) {
    const pv = profielResultVeld(dashboard.model);
    return bron.map((c) => {
      const results = c[pv] ?? 0;
      return {
        name: c.naam,
        type: c.type ?? null,
        spend: c.kosten ?? 0,
        impressions: c.vertoningen ?? null,
        clicks: c.klikken ?? 0,
        ctr: c.vertoningen ? (c.klikken / c.vertoningen) * 100 : null,
        cpc: c.klikken ? c.kosten / c.klikken : null,
        results,
        costPerResult: results ? c.kosten / results : null,
        resultLabel: rlabel,
      };
    });
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
