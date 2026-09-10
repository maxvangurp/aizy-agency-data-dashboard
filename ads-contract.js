/**
 * Van Supabase-rijen naar het platformblok uit `docs/api-contract-ads.md`.
 *
 * Zuivere functies, geen netwerk. Het dashboard consumeert al jaren dezelfde
 * contractvorm uit de sample-loaders; deze module zorgt dat live data er
 * precies zo uitziet, zodat er aan de dashboardkant niets verandert.
 *
 * Twee dingen die het contract niet kan leveren uit deze bron, en waarom dat
 * geen bug is:
 *
 *   * **`series` is per week, niet per dag.** `max-marketing-os` bewaart
 *     snapshots per periode, en die perioden zijn weken. Een dagreeks
 *     verzinnen uit een weektotaal zou een grafiek opleveren die er precies zo
 *     uitziet als een echte. Elk punt is hier het begin van een week.
 *   * **`breakdowns` is leeg.** Zoekwoorden en advertentiegroepen staan nog
 *     niet in Supabase. Het contract zegt dat een lege array de tabel weglaat,
 *     dus dat is precies het gewenste gedrag.
 */

/** Afgeleide ratio's. Dezelfde formules als `js/data/ads-data.js`. */
function afgeleideRatios({ spend, impressions, clicks, results, revenue } = {}) {
  return {
    ctr: impressions ? rond((clicks / impressions) * 100, 2) : null,
    cpc: clicks ? rond(spend / clicks, 2) : null,
    cpm: impressions ? rond((spend / impressions) * 1000, 2) : null,
    costPerResult: results ? rond(spend / results, 2) : null,
    conversieratio: clicks ? rond((results / clicks) * 100, 2) : null,
    roas: (revenue != null && spend) ? rond(revenue / spend, 2) : null,
  };
}

/** Welk woord hoort bij de conversies van dit verdienmodel? */
function resultLabelVan(businessModel) {
  return businessModel === 'ecommerce' ? 'Aankopen' : 'Leads';
}

/**
 * Bouwt het Google-platformblok uit de rijen van `performance_snapshots`,
 * verrijkt met de campagnenamen uit `campaigns`.
 *
 * @param {Array<object>} snapshots rijen uit performance_snapshots
 * @param {Map<string, object>} campagnes campaign_id -> campagnerij
 * @param {{businessModel?: string}} opties
 */
function googleBlokVan(snapshots, campagnes = new Map(), { businessModel } = {}) {
  const rijen = Array.isArray(snapshots) ? snapshots : [];
  if (rijen.length === 0) {
    return {
      platform: 'google',
      label: 'Google Ads',
      aanwezig: false,
      resultLabel: resultLabelVan(businessModel),
      totals: null,
      series: [],
      campaigns: [],
      breakdowns: { adGroups: [], keywords: [] },
    };
  }

  const ecommerce = businessModel === 'ecommerce';
  const basis = rijen.reduce((acc, r) => ({
    spend: acc.spend + getal(r.spend),
    impressions: acc.impressions + getal(r.impressions),
    clicks: acc.clicks + getal(r.clicks),
    results: acc.results + getal(r.conversions_primary),
    revenue: acc.revenue + getal(r.revenue),
  }), { spend: 0, impressions: 0, clicks: 0, results: 0, revenue: 0 });

  // Bij leadgen is omzet geen leeg getal maar een niet-bestaand begrip. Het
  // contract vraagt daar expliciet null, zodat ROAS niet op nul uitkomt.
  const revenue = ecommerce ? rond(basis.revenue, 2) : null;
  const totals = {
    spend: rond(basis.spend, 2),
    impressions: basis.impressions,
    clicks: basis.clicks,
    results: rond(basis.results, 2),
    revenue,
    ...afgeleideRatios({ ...basis, revenue }),
  };

  return {
    platform: 'google',
    label: 'Google Ads',
    aanwezig: true,
    resultLabel: resultLabelVan(businessModel),
    totals,
    series: reeksVan(rijen),
    campaigns: campagnesVan(rijen, campagnes),
    breakdowns: { adGroups: [], keywords: [] },
  };
}

/** Eén punt per snapshotdatum, opgeteld over de campagnes van die periode. */
function reeksVan(rijen) {
  const perDatum = new Map();
  for (const r of rijen) {
    const datum = r.snapshot_date;
    if (!datum) continue;
    const p = perDatum.get(datum) ?? { date: datum, spend: 0, impressions: 0, clicks: 0, results: 0 };
    p.spend += getal(r.spend);
    p.impressions += getal(r.impressions);
    p.clicks += getal(r.clicks);
    p.results += getal(r.conversions_primary);
    perDatum.set(datum, p);
  }
  return [...perDatum.values()]
    .map((p) => ({ ...p, spend: rond(p.spend, 2), results: rond(p.results, 2) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Eén regel per campagne, opgeteld over de perioden in de selectie. */
function campagnesVan(rijen, campagnes) {
  const perCampagne = new Map();
  for (const r of rijen) {
    const sleutel = r.campaign_id ?? 'onbekend';
    const c = perCampagne.get(sleutel)
      ?? { sleutel, spend: 0, impressions: 0, clicks: 0, results: 0 };
    c.spend += getal(r.spend);
    c.impressions += getal(r.impressions);
    c.clicks += getal(r.clicks);
    c.results += getal(r.conversions_primary);
    perCampagne.set(sleutel, c);
  }

  return [...perCampagne.values()]
    .map((c) => {
      const meta = campagnes.get(c.sleutel) ?? {};
      const ratios = afgeleideRatios(c);
      return {
        name: meta.name ?? 'Onbekende campagne',
        type: meta.channel_type ?? 'Google',
        spend: rond(c.spend, 2),
        impressions: c.impressions,
        clicks: c.clicks,
        ctr: ratios.ctr,
        cpc: ratios.cpc,
        results: rond(c.results, 2),
        costPerResult: ratios.costPerResult,
      };
    })
    .sort((a, b) => b.spend - a.spend);
}

function getal(waarde) {
  const n = Number(waarde);
  return Number.isFinite(n) ? n : 0;
}

function rond(waarde, decimalen = 2) {
  const n = Number(waarde);
  if (!Number.isFinite(n)) return null;
  const f = 10 ** decimalen;
  return Math.round(n * f) / f;
}

module.exports = { afgeleideRatios, resultLabelVan, googleBlokVan };
