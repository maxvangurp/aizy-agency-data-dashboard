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

/**
 * Welke granulariteit gebruiken we voor deze rijen?
 *
 * Dezelfde periode staat in `performance_snapshots` zowel als dagrijen als als
 * weekrijen. Alles optellen telt dus alles dubbel -- precies wat
 * `blended_kpis` in de database wegneemt en een rauwe query niet. Eén
 * granulariteit kiezen houdt de totalen en de campagnetabel consistent, en
 * herhaalt de dedup-logica uit migratie 014 niet op een tweede plek.
 *
 * Dag wint van week wanneer hij er is. Dagrijen bestaan alleen waar er
 * activiteit was, dus ze tellen op tot hetzelfde totaal, en ze leveren een
 * echte dagreeks in plaats van één punt per week.
 */
function kiesGranulariteit(rijen, periode = {}) {
  const dagrijen = (rijen ?? []).filter((r) => r.granularity === 'day');
  if (dagrijen.length === 0) return 'week';

  // Dag alleen wanneer hij het gevraagde bereik ook echt dekt. De eerste versie
  // koos dag zodra er één dagrij was, en dan vielen de weekrijen van alle
  // andere perioden weg: een venster van dertig dagen liet de uitgaven van één
  // week zien en zag eruit als een klant die bijna niets deed.
  const dagen = new Set(dagrijen.map((r) => r.snapshot_date)).size;
  const gevraagd = dagenTussen(periode.since, periode.until);
  if (!gevraagd) return 'day';
  return dagen / gevraagd >= DAGDEKKING ? 'day' : 'week';
}

/** Vanaf welke dekking een dagreeks het hele bereik mag vertegenwoordigen. */
const DAGDEKKING = 0.9;

function dagenTussen(since, until) {
  if (!since || !until) return 0;
  const a = Date.parse(`${since}T00:00:00.000Z`);
  const b = Date.parse(`${until}T00:00:00.000Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0;
  return Math.round((b - a) / 86400000) + 1;
}

/**
 * Welke dagen bestrijkt deze rij?
 *
 * `period_end` staat er sinds migratie 014 bij. Draait die nog niet, dan is het
 * einde af te leiden uit `granularity` -- precies de afleiding die deze code
 * anders impliciet toch al deed. Zonder die terugval hangt dit endpoint aan de
 * volgorde waarin code en migratie uitgerold worden, en dat is een afhankelijk-
 * heid die niemand wil bewaken.
 */
function periodeVan(rij) {
  const start = String(rij.snapshot_date);
  if (rij.period_end) return { start, eind: String(rij.period_end) };

  const dag = new Date(`${start}T00:00:00.000Z`);
  if (Number.isNaN(dag.getTime())) return { start, eind: start };
  if (rij.granularity === 'week') {
    dag.setUTCDate(dag.getUTCDate() + 6);
    return { start, eind: dag.toISOString().slice(0, 10) };
  }
  if (rij.granularity === 'month') {
    const eind = new Date(Date.UTC(dag.getUTCFullYear(), dag.getUTCMonth() + 1, 0));
    return { start, eind: eind.toISOString().slice(0, 10) };
  }
  return { start, eind: start };
}

/**
 * Alleen de rijen die HEEL binnen het gevraagde bereik vallen.
 *
 * Hiervoor werd de bovengrens op `snapshot_date` gelegd, en dat is de
 * verkeerde kant van de periode: een maandrij die op `since` begint liep dan
 * drie weken buiten het venster door en telde toch helemaal mee. Een halve
 * periode naar rato omslaan is geen alternatief -- dat verzint een verdeling
 * die niet gemeten is.
 *
 * Dezelfde regel als `blended_kpis()` in Supabase. Dat die twee hetzelfde
 * antwoord geven is belangrijker dan welke van de twee grenzen je kiest.
 */
function binnenBereik(rijen, { since = null, until = null } = {}) {
  return (rijen ?? []).filter((rij) => {
    const { start, eind } = periodeVan(rij);
    if (since && start < String(since)) return false;
    if (until && eind > String(until)) return false;
    return true;
  });
}

/**
 * Hoeveel van de gevraagde dagen zitten er daadwerkelijk in deze rijen?
 *
 * Containment laat dagen aan de randen vallen: een week die op 31 augustus
 * begon hoort niet bij september, maar de eerste zes dagen van september
 * zitten dan ook nergens in. Dat is geen fout, maar het is wel iets waar een
 * lezer van moet weten voordat hij twee perioden vergelijkt -- en zonder dit
 * getal is het verschil tussen "weinig uitgegeven" en "niet alles gemeten"
 * niet te zien.
 */
function dekkingVan(rijen, { since = null, until = null } = {}) {
  const gevraagd = dagenTussen(since, until);
  if (!gevraagd) return null;

  const dagen = new Set();
  for (const rij of rijen ?? []) {
    const { start, eind } = periodeVan(rij);
    const van = Date.parse(`${start}T00:00:00.000Z`);
    const tot = Date.parse(`${eind}T00:00:00.000Z`);
    if (!Number.isFinite(van) || !Number.isFinite(tot)) continue;
    for (let t = van; t <= tot; t += 86400000) dagen.add(t);
  }
  return { dagen: dagen.size, gevraagd, volledig: dagen.size >= gevraagd };
}

/** Welk woord hoort bij de conversies van dit verdienmodel? */
function resultLabelVan(businessModel) {
  return businessModel === 'ecommerce' ? 'Aankopen' : 'Leads';
}

/**
 * Welke contractvelden sneuvelen bij welke KPI uit `client_kpi_reliability`?
 *
 * `unreliable_kpis` gebruikt de namen uit `lib/conversies.js` van
 * max-marketing-os; het contract gebruikt die van docs/api-contract-ads.md.
 * Eén tabel in plaats van twee woordenlijsten die uit elkaar gaan lopen.
 */
const KPI_NAAR_CONTRACT = {
  spend: ['spend'], impressions: ['impressions'], clicks: ['clicks'],
  ctr: ['ctr'], cpc: ['cpc'], cpm: ['cpm'],
  leads: ['results'], purchases: ['results'],
  conversieratio: ['conversieratio'],
  cpl: ['costPerResult'], cpa: ['costPerResult'],
  revenue: ['revenue'], roas: ['roas'],
};

/**
 * Haalt de KPI's weg die op dit account geen betekenis hebben.
 *
 * Bij drie van de veertien aangesloten accounts levert de conversieopzet
 * getallen op waar niets achter zit: vijftien campagnes op precies €1,00 per
 * conversie is een instelling, geen orderwaarde. De ROAS van 0,22 die daaruit
 * rolt ziet er precies zo uit als een ROAS die wél iets betekent.
 *
 * Null en niet nul, en niet weggelaten: het dashboard toont een null als
 * "Niet te berekenen" of "—", en dat is het eerlijke antwoord. Een nul zou
 * eruitzien als een meting en een ontbrekend veld als een storing.
 */
function onderdrukOnbetrouwbaar(totals, onbetrouwbareKpis) {
  if (!totals || !Array.isArray(onbetrouwbareKpis) || onbetrouwbareKpis.length === 0) return totals;
  const uit = { ...totals };
  for (const kpi of onbetrouwbareKpis) {
    for (const veld of KPI_NAAR_CONTRACT[kpi] ?? []) {
      if (veld in uit) uit[veld] = null;
    }
  }
  return uit;
}

/** De rij uit `client_kpi_reliability` in de vorm die het contract meegeeft. */
function betrouwbaarheidVan(rij) {
  if (!rij) return null;
  return {
    beoordeeld: true,
    periode: { since: rij.assessed_period_start ?? null, until: rij.assessed_period_end ?? null },
    beoordeeldOp: rij.assessed_at ?? null,
    lagen: {
      platform: rij.platform_metrics_reliable !== false,
      conversieteller: rij.conversion_count_reliable !== false,
      conversiewaarde: rij.conversion_value_reliable !== false,
    },
    onbetrouwbareKpis: Array.isArray(rij.unreliable_kpis) ? rij.unreliable_kpis : [],
    oordeel: rij.verdict ?? null,
    bevindingen: Array.isArray(rij.findings) ? rij.findings : [],
  };
}

/**
 * Bouwt het Google-platformblok uit de rijen van `performance_snapshots`,
 * verrijkt met de campagnenamen uit `campaigns`.
 *
 * @param {Array<object>} snapshots rijen uit performance_snapshots
 * @param {Map<string, object>} campagnes campaign_id -> campagnerij
 * @param {{businessModel?: string, betrouwbaarheid?: object}} opties
 */
function googleBlokVan(snapshots, campagnes = new Map(), { businessModel, betrouwbaarheid = null } = {}) {
  return blokVan(snapshots, campagnes, {
    businessModel, betrouwbaarheid, platform: 'google', label: 'Google Ads',
    breakdowns: { adGroups: [], keywords: [] },
  });
}

/**
 * Hetzelfde blok voor Meta.
 *
 * Eén verschil, en dat is geen opmaak. Een webshop die op Meta leadcampagnes
 * draait meet leads en geen aankopen: `conversions_primary` staat dan op nul
 * terwijl er wel degelijk conversies zijn. Vitrinemasters had zo 67 leads die
 * als "0 aankopen" op het scherm zouden komen.
 *
 * Dit blok zegt daarom wat dít platform gemeten heeft, met het bijbehorende
 * label. Niet stilzwijgend: `resultSoort` vertelt de interface welke soort het
 * geworden is, zodat er niets wordt opgeteld dat niet bij elkaar hoort.
 */
function metaBlokVan(snapshots, campagnes = new Map(), { businessModel, betrouwbaarheid = null } = {}) {
  const rijen = Array.isArray(snapshots) ? snapshots : [];
  const primair = rijen.reduce((som, r) => som + getal(r.conversions_primary), 0);
  const leads = rijen.reduce((som, r) => som + getal(r.leads), 0);
  const opLeads = primair === 0 && leads > 0;

  return blokVan(rijen, campagnes, {
    businessModel, betrouwbaarheid, platform: 'meta', label: 'Meta Ads',
    breakdowns: { adSets: [], placements: [] },
    ...(opLeads ? { resultKolom: 'leads', resultLabel: 'Leads', resultSoort: 'leads' } : {}),
  });
}

function blokVan(snapshots, campagnes, {
  businessModel, betrouwbaarheid = null, platform, label, breakdowns,
  resultKolom = 'conversions_primary', resultLabel = null, resultSoort = null,
}) {
  const rijen = Array.isArray(snapshots) ? snapshots : [];
  const oordeel = betrouwbaarheidVan(betrouwbaarheid);
  if (rijen.length === 0) {
    return {
      platform,
      label,
      aanwezig: false,
      resultLabel: resultLabel ?? resultLabelVan(businessModel),
      totals: null,
      series: [],
      campaigns: [],
      breakdowns,
      betrouwbaarheid: oordeel,
    };
  }

  const ecommerce = businessModel === 'ecommerce';
  const basis = rijen.reduce((acc, r) => ({
    spend: acc.spend + getal(r.spend),
    impressions: acc.impressions + getal(r.impressions),
    clicks: acc.clicks + getal(r.clicks),
    results: acc.results + getal(r[resultKolom]),
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
    platform,
    label,
    aanwezig: true,
    resultLabel: resultLabel ?? resultLabelVan(businessModel),
    ...(resultSoort ? { resultSoort } : {}),
    totals: onderdrukOnbetrouwbaar(totals, oordeel?.onbetrouwbareKpis),
    series: reeksVan(rijen, resultKolom),
    campaigns: campagnesVan(rijen, campagnes, resultKolom),
    campagnestatus: statusSamenvatting(campagnesVan(rijen, campagnes, resultKolom)),
    breakdowns,
    betrouwbaarheid: oordeel,
  };
}

/**
 * Hoeveel van de uitgaven ging naar campagnes die inmiddels uitstaan?
 *
 * De vraag achter "er staan zoveel gepauzeerde campagnes in de lijst". Het
 * aantal zegt weinig -- een account kan honderd oude campagnes hebben die niets
 * kostten. Het bedrag zegt alles: gaat de helft van het budget naar campagnes
 * die nu uit staan, dan beschrijven deze cijfers een situatie die niet meer
 * bestaat, en is elke conclusie eruit een conclusie over het verleden.
 *
 * `onbekend` staat apart. Bij ingeplakte connectordata is de status niet
 * gemeten; die op "actief" gooien maakt het percentage te rooskleurig.
 */
function statusSamenvatting(campagnes) {
  const som = { actief: 0, uit: 0, onbekend: 0 };
  const aantal = { actief: 0, uit: 0, onbekend: 0 };
  let metProblemen = 0;

  for (const c of campagnes) {
    const bedrag = getal(c.spend);
    const bak = c.status == null ? 'onbekend' : (c.status === 'active' ? 'actief' : 'uit');
    som[bak] += bedrag;
    aantal[bak] += 1;
    // Loopt wel, maar er is iets mis met de advertenties of de betaling. Dat is
    // geen derde status maar een waarschuwing bij een actieve campagne.
    if (c.platformStatus === 'WITH_ISSUES') metProblemen += 1;
  }

  const totaal = som.actief + som.uit + som.onbekend;
  return {
    aantal,
    uitgaven: {
      actief: rond(som.actief, 2),
      uit: rond(som.uit, 2),
      onbekend: rond(som.onbekend, 2),
    },
    aandeelUit: totaal > 0 ? rond((som.uit / totaal) * 100, 1) : null,
    metProblemen,
    // Zonder gemeten status is het aandeel een schatting; dat hoort zichtbaar
    // te zijn en niet in het percentage te verdwijnen.
    statusGemeten: aantal.onbekend === 0,
  };
}

/** Eén punt per snapshotdatum, opgeteld over de campagnes van die periode. */
function reeksVan(rijen, resultKolom = 'conversions_primary') {
  const perDatum = new Map();
  for (const r of rijen) {
    const datum = r.snapshot_date;
    if (!datum) continue;
    const p = perDatum.get(datum) ?? { date: datum, spend: 0, impressions: 0, clicks: 0, results: 0 };
    p.spend += getal(r.spend);
    p.impressions += getal(r.impressions);
    p.clicks += getal(r.clicks);
    p.results += getal(r[resultKolom]);
    perDatum.set(datum, p);
  }
  return [...perDatum.values()]
    .map((p) => ({ ...p, spend: rond(p.spend, 2), results: rond(p.results, 2) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Eén regel per campagne, opgeteld over de perioden in de selectie. */
function campagnesVan(rijen, campagnes, resultKolom = 'conversions_primary') {
  const perCampagne = new Map();
  for (const r of rijen) {
    const sleutel = r.campaign_id ?? 'onbekend';
    const c = perCampagne.get(sleutel)
      ?? { sleutel, spend: 0, impressions: 0, clicks: 0, results: 0 };
    c.spend += getal(r.spend);
    c.impressions += getal(r.impressions);
    c.clicks += getal(r.clicks);
    c.results += getal(r[resultKolom]);
    perCampagne.set(sleutel, c);
  }

  return [...perCampagne.values()]
    .map((c) => {
      const meta = campagnes.get(c.sleutel) ?? {};
      const ratios = afgeleideRatios(c);
      return {
        name: meta.name ?? 'Onbekende campagne',
        type: meta.channel_type ?? 'Google',
        // De status van nu, naast cijfers van de periode. Dat zijn twee
        // verschillende momenten en dat is precies het punt: een campagne die
        // gisteren is uitgezet heeft drie weken geld uitgegeven. Hem verbergen
        // zou die uitgaven laten verdwijnen; hem tonen zonder status suggereert
        // dat hij nog loopt.
        status: meta.status ?? null,
        platformStatus: meta.platform_status ?? null,
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

module.exports = {
  afgeleideRatios, resultLabelVan, googleBlokVan, metaBlokVan, kiesGranulariteit,
  onderdrukOnbetrouwbaar, betrouwbaarheidVan,
  periodeVan, binnenBereik, dekkingVan,
};
