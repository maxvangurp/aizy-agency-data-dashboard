/**
 * Het simpele Meta & Google Ads-datadashboard (modus 'simpel').
 *
 * Een bewust lichte analytics-app: een schone linker-sidebar met alleen
 * datapagina's (géén workflow-functionaliteit) en een lichte topbar. De data
 * komt via de data-provider-seam (`js/data/ads-data.js`), nu uit sample-data,
 * later live uit de Meta/Google API's.
 *
 * `renderSimpelLayout` rendert de eigen layout (níet de app-shell). De inhoud
 * laadt async: eerst een laadstaat, dan `renderSimpelInhoud` voor de actieve
 * view (op `route.naam`). Grafieken worden ná de render getekend
 * (`drawSimpelCharts`); interactieve widgets (metric-switcher, sorteren, zoeken,
 * CSV, filter-chips) worden client-side afgehandeld via delegatie in app.js.
 */

import { fmt, esc, tabel, figure, getalKolom, badge } from './components.js';
import { renderInzichten } from './insight-cards.js';
import { combineerTotalen, alleCampagnes, adDeltas, perWeekdag, adSegmenten, resultMetriek } from '../data/ads-data.js';
import { bouwAdInzichten, budgetTempo } from '../data/simpel-insights.js';
import { lineChart, barChart, donutChart, funnelChart } from '../charts.js';
import { PERIODE_PRESETS, toonBereik, toonKorteDatum } from '../filters/period.js';
import { kpiDelta, metricSwitcher, chips, interactieveTabel } from './simpel-widgets.js';

/* De datapagina's in de sidebar. */
const SIMPEL_NAV = [
  { naam: 'simpel-overzicht', pad: '#/pulse', label: 'Totaal overzicht' },
  { naam: 'simpel-google', pad: '#/pulse/google-ads', label: 'Google Ads' },
  { naam: 'simpel-meta', pad: '#/pulse/meta-ads', label: 'Meta Ads' },
  { naam: 'simpel-campagnes', pad: '#/pulse/campagnes', label: 'Campagnes' },
  { naam: 'simpel-conversies', pad: '#/pulse/conversies', label: 'Conversies' },
  { naam: 'simpel-segmenten', pad: '#/pulse/segmenten', label: 'Segmenten' },
  { naam: 'simpel-trends', pad: '#/pulse/trends', label: 'Trends' },
];

/* ---------------------------------------------------------------
   Layout: lichte sidebar + topbar + inhoud
   --------------------------------------------------------------- */

export function renderSimpelLayout({ user, dashboard, klanten = [], filters, platforms = null, magWisselen = false, view = 'simpel-overzicht' }) {
  return `
    <div class="simpel-app">
      ${renderSimpelSidebar(view)}
      <div class="simpel-kolom">
        ${renderSimpelTopbar({ dashboard, klanten, filters, magWisselen })}
        <main class="simpel-main">
          <div class="page-root simpel-root" id="simpelInhoud">
            ${platforms ? renderSimpelInhoud({ dashboard, platforms, view }) : renderSimpelLaden()}
          </div>
        </main>
      </div>
    </div>`;
}

function renderSimpelSidebar(view) {
  return `<aside class="simpel-sidebar">
    <div class="simpel-merk">
      <span class="simpel-merk-naam">Aizy</span>
      <span class="simpel-merk-sub">Snel inzicht</span>
    </div>
    <nav class="simpel-nav" aria-label="Datapagina's">
      ${SIMPEL_NAV.map((n) => `<a class="simpel-nav-item${n.naam === view ? ' actief' : ''}" href="${n.pad}"${n.naam === view ? ' aria-current="page"' : ''}>${esc(n.label)}</a>`).join('')}
    </nav>
    <div class="simpel-sidebar-voet">
      <button type="button" class="btn klein breed" data-naar-modus="uitgebreid">Volledig systeem</button>
      <button type="button" class="btn klein breed" id="menuUitloggen">Uitloggen</button>
    </div>
  </aside>`;
}

function renderSimpelTopbar({ dashboard, klanten, filters, magWisselen }) {
  const periode = filters?.periode ?? {};
  const klantKiezer = magWisselen && klanten.length > 1
    ? `<label class="simpel-kiezer">
        <span class="visueel-verborgen">Klant</span>
        <select data-simpel-klant>
          ${klanten.map((k) => `<option value="${esc(k.id)}"${k.id === dashboard?.client?.id ? ' selected' : ''}>${esc(k.name)}</option>`).join('')}
        </select>
      </label>`
    : `<span class="simpel-klantnaam">${esc(dashboard?.client?.name ?? '')}</span>`;

  return `<header class="simpel-topbar">
    <div class="simpel-topbar-midden">
      ${klantKiezer}
      <label class="simpel-kiezer">
        <span class="visueel-verborgen">Periode</span>
        <select id="filterPeriode">
          ${PERIODE_PRESETS.map((p) => `<option value="${esc(p.key)}"${periode.preset === p.key ? ' selected' : ''}>${esc(p.label)}</option>`).join('')}
        </select>
      </label>
    </div>
  </header>`;
}

function renderSimpelLaden() {
  return `<div class="simpel-laden" aria-live="polite"><p class="muted">Cijfers laden…</p></div>`;
}

/* ---------------------------------------------------------------
   Inhoud: dispatch per view
   --------------------------------------------------------------- */

export function renderSimpelInhoud({ dashboard, platforms, view = 'simpel-overzicht' }) {
  if (!platforms || (!platforms.meta?.aanwezig && !platforms.google?.aanwezig)) {
    return renderSimpelLeeg('Geen advertentiedata',
      'Er zijn voor deze klant en periode geen Meta- of Google Ads-cijfers.');
  }
  switch (view) {
    case 'simpel-google': return renderPlatformView(dashboard, platforms.google, platforms);
    case 'simpel-meta': return renderPlatformView(dashboard, platforms.meta, platforms);
    case 'simpel-campagnes': return renderCampagnesView(dashboard, platforms);
    case 'simpel-conversies': return renderConversiesView(dashboard, platforms);
    case 'simpel-segmenten': return renderSegmentenView(dashboard, platforms);
    case 'simpel-trends': return renderTrendsView(dashboard, platforms);
    default: return renderOverzichtView(dashboard, platforms);
  }
}

/**
 * Lege staat binnen de inhoudkolom. Draagt een `<h1>` zodat elk simpel-scherm
 * precies één top-heading heeft, net als de gevulde views (via simpelKop).
 */
export function renderSimpelLeeg(titel, tekst) {
  return `<section class="card simpel-leeg">
    <h1>${esc(titel)}</h1>
    <p class="empty">${esc(tekst)}</p>
  </section>`;
}

/** Gedeelde paginakop met klant + periode + databron. */
function simpelKop(titel, dashboard, platforms, ondertitel = '') {
  const periodeLabel = dashboard?.periode ? toonBereik(dashboard.periode.startDate, dashboard.periode.endDate) : '';
  return `<div class="simpel-kop">
    <h1>${esc(titel)}</h1>
    <p class="muted">${esc(dashboard?.client?.name ?? '')}${periodeLabel ? ` · ${esc(periodeLabel)}` : ''}${ondertitel ? ` · ${esc(ondertitel)}` : ''}</p>
    ${platforms?.demodata ? `<p class="simpel-databron">${badge('Demodata', 'muted')} <span class="muted klein">Sluit de Meta/Google API's aan voor live cijfers.</span></p>` : ''}
  </div>`;
}

/* ---------------------------------------------------------------
   KPI-band met vergelijking (delta) + sparklines
   --------------------------------------------------------------- */

const FMT = { euro: fmt.euro, euro2: fmt.euro2, getal: fmt.getal, procent: fmt.procent, ratio: fmt.ratio };

/** De gecombineerde dagreeks (Meta + Google) voor sparklines en trends. */
function combinedDagreeks(platforms) {
  const basis = reeksAs(platforms.meta, platforms.google);
  return basis.map((p, i) => ({
    date: p.date,
    spend: (platforms.meta?.series?.[i]?.spend ?? 0) + (platforms.google?.series?.[i]?.spend ?? 0),
    clicks: (platforms.meta?.series?.[i]?.clicks ?? 0) + (platforms.google?.series?.[i]?.clicks ?? 0),
    results: (platforms.meta?.series?.[i]?.results ?? 0) + (platforms.google?.series?.[i]?.results ?? 0),
  }));
}

/**
 * KPI-band met verandering t.o.v. de vorige periode en sparklines. Werkt zowel
 * voor de gecombineerde totalen als voor één platform: geef de bijbehorende
 * dagreeks mee voor de sparklines.
 */
function kpiBandDelta(dashboard, totaal, dagreeks) {
  const deltas = adDeltas(dashboard, totaal);
  const spendSpark = dagreeks.map((p) => p.spend);
  const resultSpark = dagreeks.map((p) => p.results);
  const rlabel = totaal.resultLabel ?? 'Resultaat';
  const rl = rlabel.toLowerCase();
  const model = dashboard.model;
  const rTip = resultMetriek(model);
  const cTip = model === 'ecommerce' ? 'cpa' : model === 'awareness' ? 'cpc' : 'cpl';

  const kaart = (key, label, raw, opmaak, { spark = null, primair = false, tip = null } = {}) =>
    kpiDelta(label, raw == null ? 'Niet te berekenen' : FMT[opmaak](raw), deltas[key], { sparkData: spark, primair, tip: tip ?? key });

  const kaarten = [
    kaart('spend', 'Uitgaven', totaal.spend, 'euro', { spark: spendSpark, primair: true }),
    kaart('impressions', 'Vertoningen', totaal.impressions, 'getal'),
    kaart('clicks', 'Klikken', totaal.clicks, 'getal'),
    kaart('ctr', 'Doorklikratio', totaal.ctr, 'procent'),
    kaart('cpc', 'Kosten per klik', totaal.cpc, 'euro2'),
    kaart('results', rlabel, totaal.results, 'getal', { spark: resultSpark, tip: rTip }),
    kaart('costPerResult', `Kosten per ${rl}`, totaal.costPerResult, 'euro2', { tip: cTip }),
  ];
  if (model === 'ecommerce') {
    kaarten.push(kaart('revenue', 'Omzet', totaal.revenue, 'euro', { tip: 'revenue' }));
    kaarten.push(kaart('roas', 'ROAS', totaal.roas, 'ratio', { tip: 'roas' }));
  } else if (model === 'awareness') {
    kaarten.push(kaart('reach', 'Bereik per dag', totaal.reach, 'getal', { tip: 'reach' }));
    kaarten.push(kaart('frequentie', 'Frequentie', totaal.frequentie, 'ratio', { tip: 'frequentie' }));
  } else {
    kaarten.push(kaart('cpm', 'CPM', totaal.cpm, 'euro2', { tip: 'cpm' }));
    kaarten.push(kaart('conversieratio', 'Conversieratio', totaal.conversieratio, 'procent', { tip: 'conversieratio' }));
  }
  return `<div class="kpi-row simpel-kpi">${kaarten.join('')}</div>`;
}

/* ---------------------------------------------------------------
   Tabellen (statisch + interactief)
   --------------------------------------------------------------- */

/** Statische prestatietabel (voor korte, niet-interactieve lijsten). */
function prestatieTabel(items, rlabel, { eersteKolom = 'Campagne', metPlatform = false, extra = null } = {}) {
  const kop = [
    eersteKolom,
    ...(metPlatform ? ['Platform'] : []),
    ...(extra ? [extra.kop] : []),
    getalKolom('Uitgaven'), getalKolom('Klikken'), getalKolom('CTR'),
    getalKolom(rlabel), getalKolom(`Kosten/${rlabel.toLowerCase()}`),
  ];
  const rijen = items.map((c) => [
    esc(c.name),
    ...(metPlatform ? [badge(c.platform, 'muted')] : []),
    ...(extra ? [extra.cel(c)] : []),
    fmt.euro(c.spend),
    fmt.getal(c.clicks),
    c.ctr == null ? '—' : fmt.procent(c.ctr),
    fmt.getal(c.results),
    c.costPerResult == null ? '—' : fmt.euro2(c.costPerResult),
  ]);
  return tabel(kop, rijen);
}

/** Kolomdefinitie voor een interactieve prestatietabel (sorteren/zoeken/CSV). */
function prestatieKolommen(rlabel, { eersteKolom = 'Campagne', metPlatform = false, extra = null } = {}) {
  const rl = rlabel.toLowerCase();
  const cols = [{ label: eersteKolom, type: 'txt', cel: (c) => esc(c.name), waarde: (c) => c.name }];
  if (metPlatform) cols.push({ label: 'Platform', type: 'txt', cel: (c) => badge(c.platform, 'muted'), waarde: (c) => c.platform });
  if (extra) cols.push({ label: extra.kop, type: 'txt', cel: extra.cel, waarde: extra.waarde ?? ((c) => c[extra.veld] ?? '') });
  cols.push(
    { label: 'Uitgaven', uitlijn: 'rechts', type: 'num', cel: (c) => fmt.euro(c.spend), waarde: (c) => c.spend ?? 0 },
    { label: 'Klikken', uitlijn: 'rechts', type: 'num', cel: (c) => fmt.getal(c.clicks), waarde: (c) => c.clicks ?? 0 },
    { label: 'CTR', uitlijn: 'rechts', type: 'num', cel: (c) => (c.ctr == null ? '—' : fmt.procent(c.ctr)), waarde: (c) => c.ctr ?? 0 },
    { label: rlabel, uitlijn: 'rechts', type: 'num', cel: (c) => fmt.getal(c.results), waarde: (c) => c.results ?? 0 },
    { label: `Kosten/${rl}`, uitlijn: 'rechts', type: 'num', cel: (c) => (c.costPerResult == null ? '—' : fmt.euro2(c.costPerResult)), waarde: (c) => c.costPerResult ?? 0 },
  );
  return cols;
}

function platformSplitTabel(platforms, rlabel) {
  const rijen = ['meta', 'google'].map((k) => platforms[k]).filter((b) => b?.aanwezig).map((b) => [
    esc(b.label), fmt.euro(b.totals.spend), fmt.getal(b.totals.clicks),
    b.totals.ctr == null ? '—' : fmt.procent(b.totals.ctr),
    fmt.getal(b.totals.results), b.totals.costPerResult == null ? '—' : fmt.euro2(b.totals.costPerResult),
  ]);
  return tabel(['Platform', getalKolom('Uitgaven'), getalKolom('Klikken'), getalKolom('CTR'), getalKolom(rlabel), getalKolom(`Kosten/${rlabel.toLowerCase()}`)], rijen);
}

/**
 * De datum-as voor de tijdreeksen: de eerste niet-lege reeks van de aanwezige
 * platforms. Een afwezig platform levert een lege reeks (`[]`), die met `??` niet
 * zou worden overgeslagen — daarom expliciet op lengte kiezen.
 */
function reeksAs(meta, google) {
  return (meta?.series?.length ? meta.series : google?.series) ?? [];
}

/* ---------------------------------------------------------------
   Trend met metric-switcher
   --------------------------------------------------------------- */

const TREND_META = {
  spend: { getVal: (p) => p.spend, opmaak: (v) => fmt.euro(v), bron: 'Meta Marketing API en Google Ads API' },
  clicks: { getVal: (p) => p.clicks, opmaak: (v) => fmt.getal(v), bron: 'Meta Marketing API en Google Ads API' },
  results: { getVal: (p) => p.results, opmaak: (v) => fmt.getal(v), bron: 'Advertentiekanalen en analytics' },
  ctr: { getVal: (p) => (p.impressions ? (p.clicks / p.impressions) * 100 : null), opmaak: (v) => fmt.procent(v), bron: 'Meta Marketing API en Google Ads API' },
};

/** De beschikbare trend-metrieken, afhankelijk van wat de dagreeks bevat. */
function trendMetrieken(platforms) {
  const meta = platforms.meta?.series ?? [];
  const google = platforms.google?.series ?? [];
  const alle = [...meta, ...google];
  const heeft = (veld) => alle.some((p) => p?.[veld] != null);
  const rlabel = platforms.meta?.resultLabel ?? platforms.google?.resultLabel ?? 'Resultaten';
  const opties = [{ key: 'spend', label: 'Uitgaven' }];
  if (heeft('clicks')) opties.push({ key: 'clicks', label: 'Klikken' });
  if (heeft('results')) opties.push({ key: 'results', label: rlabel });
  if (heeft('clicks') && heeft('impressions')) opties.push({ key: 'ctr', label: 'CTR' });
  return opties;
}

function trendMetriekTabel(platforms, metricKey) {
  const m = TREND_META[metricKey] ?? TREND_META.spend;
  const basis = reeksAs(platforms.meta, platforms.google);
  const kolommen = ['Datum'];
  if (platforms.meta?.aanwezig) kolommen.push(getalKolom('Meta'));
  if (platforms.google?.aanwezig) kolommen.push(getalKolom('Google'));
  const rijen = basis.map((p, i) => {
    const rij = [esc(toonKorteDatum(p.date))];
    if (platforms.meta?.aanwezig) rij.push(m.opmaak(m.getVal(platforms.meta.series[i] ?? {})));
    if (platforms.google?.aanwezig) rij.push(m.opmaak(m.getVal(platforms.google.series[i] ?? {})));
    return rij;
  });
  return tabel(kolommen, rijen);
}

/** Trendkaart met een segmented control om de metriek te wisselen. */
function trendMetriekFiguur(grafiekId, platforms, { titel = 'Ontwikkeling per dag', subtitel = 'Kies een metriek om de grafiek te wisselen.' } = {}) {
  const opties = trendMetrieken(platforms);
  const actief = opties[0]?.key ?? 'spend';
  const bron = TREND_META[actief]?.bron ?? 'Advertentiekanalen';
  return `<div class="trend-blok">
    ${metricSwitcher(grafiekId, opties, actief)}
    ${figure(grafiekId, titel, subtitel, trendMetriekTabel(platforms, actief), bron, 280)}
  </div>`;
}

/* ---------- View 1: Totaal overzicht ---------- */

function renderOverzichtView(dashboard, platforms) {
  const totaal = combineerTotalen(platforms);
  const rlabel = totaal?.resultLabel ?? 'Resultaat';
  const campagnes = alleCampagnes(platforms).slice(0, 8);
  const dagreeks = combinedDagreeks(platforms);

  return `
    ${simpelKop('Meta & Google Ads', dashboard, platforms)}
    ${kpiBandDelta(dashboard, totaal, dagreeks)}
    <div class="dash-rij">
      <div class="dash-col" style="--span:5">
        ${figure('simpel-donut-split', 'Verdeling uitgaven', 'Aandeel van Meta en Google in het budget.', platformSplitTabel(platforms, rlabel), 'Meta Marketing API en Google Ads API', 240)}
      </div>
      <div class="dash-col" style="--span:7">
        ${trendMetriekFiguur('simpel-trend-overzicht', platforms, { titel: 'Ontwikkeling per dag', subtitel: 'Meta en Google per dag — wissel de metriek.' })}
      </div>
    </div>
    ${budgetTempoKaart(dashboard, platforms)}
    <section class="card">
      <h2>Top campagnes</h2>
      <p class="muted">De grootste campagnes over beide platforms.</p>
      <div class="table-scroll">${prestatieTabel(campagnes, rlabel, { metPlatform: true })}</div>
    </section>
    ${adInzichtenBlok(dashboard, platforms)}
  `;
}

/* ---------- View 2/3: Google Ads / Meta Ads ---------- */

function renderPlatformView(dashboard, blok, platforms) {
  if (!blok?.aanwezig) {
    return `<section class="card"><h2>Niet actief</h2>
      <p class="empty">Deze klant adverteert binnen de geselecteerde periode niet via dit platform.</p></section>`;
  }
  const rlabel = blok.resultLabel ?? 'Resultaat';
  const rl = rlabel.toLowerCase();
  const bd = blok.breakdowns ?? {};
  const enkelPlatform = { [blok.platform]: blok };

  const interTabel = (id, items, opts) => interactieveTabel(id, prestatieKolommen(rlabel, opts), items, { csvNaam: `${blok.platform}-${id}` });

  const adGroups = (bd.adGroups ?? []).length
    ? `<section class="card"><h2>Advertentiegroepen</h2>${interTabel('adgroups', bd.adGroups, { eersteKolom: 'Advertentiegroep' })}</section>` : '';
  const keywords = (bd.keywords ?? []).length
    ? `<section class="card"><h2>Zoekwoorden</h2>${interTabel('zoekwoorden', bd.keywords, { eersteKolom: 'Zoekwoord', extra: { kop: 'Matchtype', cel: (c) => (c.matchType ? badge(c.matchType, 'muted') : '—'), waarde: (c) => c.matchType ?? '' } })}</section>` : '';
  const adSets = (bd.adSets ?? []).length
    ? `<section class="card"><h2>Ad sets</h2>${interTabel('adsets', bd.adSets, { eersteKolom: 'Ad set' })}</section>` : '';
  const placements = (bd.placements ?? []).length
    ? `<div class="dash-rij">
        <div class="dash-col" style="--span:7"><section class="card"><h2>Plaatsingen</h2>${interTabel('placements', bd.placements, { eersteKolom: 'Plaatsing' })}</section></div>
        <div class="dash-col" style="--span:5">${figure('simpel-donut-placements', 'Verdeling per plaatsing', `Aandeel van de plaatsingen in de uitgaven van ${blok.label}.`, verdeelTabel(bd.placements, 'Plaatsing', rlabel), 'Meta Marketing API', 240)}</div>
      </div>` : '';

  return `
    ${simpelKop(blok.label, dashboard, { demodata: platforms?.demodata })}
    ${kpiBandDelta(dashboard, blok.totals, blok.series ?? [])}
    ${trendMetriekFiguur('simpel-trend-platform', enkelPlatform, { titel: 'Ontwikkeling per dag', subtitel: `${blok.label} per dag — wissel de metriek.` })}
    <section class="card">
      <h2>Campagnes</h2>
      ${interTabel('campagnes', blok.campaigns ?? [], {})}
    </section>
    ${adGroups}
    ${keywords}
    ${adSets}
    ${placements}
    ${adInzichtenBlok(dashboard, platforms, 1)}
  `;
}

/* ---------- View 4: Campagnes (alle, met platformfilter) ---------- */

function renderCampagnesView(dashboard, platforms) {
  const totaal = combineerTotalen(platforms);
  const rlabel = totaal?.resultLabel ?? 'Resultaat';
  const campagnes = alleCampagnes(platforms);
  const platformOpties = [{ key: 'alle', label: 'Alle' }];
  if (platforms.meta?.aanwezig) platformOpties.push({ key: 'meta', label: 'Meta Ads' });
  if (platforms.google?.aanwezig) platformOpties.push({ key: 'google', label: 'Google Ads' });

  return `
    ${simpelKop('Campagnes', dashboard, platforms, `${campagnes.length} campagnes`)}
    <section class="card">
      <div class="card-kop-rij">
        <p class="muted">Alle campagnes over beide platforms — sorteer, zoek, filter of exporteer.</p>
        ${platformOpties.length > 2 ? chips('campagnes-alle', platformOpties, 'alle') : ''}
      </div>
      ${interactieveTabel('campagnes-alle', prestatieKolommen(rlabel, { metPlatform: true }), campagnes, {
        csvNaam: 'campagnes', rijAttr: (c) => `data-platform="${esc(c.platform)}"`,
      })}
    </section>
  `;
}

/* ---------- View 5: Conversies ---------- */

function renderConversiesView(dashboard, platforms) {
  const totaal = combineerTotalen(platforms);
  const rlabel = totaal?.resultLabel ?? 'Resultaat';

  const perPlatform = tabel(
    ['Platform', getalKolom(rlabel), getalKolom(`Kosten/${rlabel.toLowerCase()}`), getalKolom('Conversieratio'), getalKolom('Aandeel')],
    ['meta', 'google'].map((k) => platforms[k]).filter((b) => b?.aanwezig).map((b) => [
      esc(b.label), fmt.getal(b.totals.results),
      b.totals.costPerResult == null ? '—' : fmt.euro2(b.totals.costPerResult),
      b.totals.conversieratio == null ? '—' : fmt.procent(b.totals.conversieratio),
      totaal.results ? fmt.procent((b.totals.results / totaal.results) * 100) : '—',
    ]),
  );

  const conv = dashboard.conversies ?? {};
  const convRij = (c) => [esc(c.label ?? c.type ?? ''), fmt.getal(c.aantal), c.vorigePeriode == null ? '—' : fmt.getal(c.vorigePeriode)];
  const primairRijen = conv.primair ?? [];
  const primair = primairRijen.length
    ? `<div class="dash-rij">
        <div class="dash-col" style="--span:5">${figure('simpel-donut-conversies', 'Conversietypes', 'Verdeling van de primaire conversies.', tabel(['Conversie', getalKolom('Aantal')], primairRijen.map((c) => [esc(c.label ?? c.type ?? ''), fmt.getal(c.aantal)])), 'Advertentiekanalen en analytics', 240)}</div>
        <div class="dash-col" style="--span:7"><section class="card"><h2>Primaire conversies</h2>
          <div class="table-scroll">${tabel(['Conversie', getalKolom('Aantal'), getalKolom('Vorige periode')], primairRijen.map(convRij))}</div></section></div>
       </div>` : '';
  const secundair = (conv.secundair ?? []).length
    ? `<section class="card"><h2>Secundaire conversies</h2>
        <div class="table-scroll">${tabel(['Conversie', getalKolom('Aantal'), getalKolom('Vorige periode')], (conv.secundair ?? []).map(convRij))}</div>
       </section>` : '';

  const funnelRijen = dashboard.funnel?.rijen ?? [];
  const funnel = funnelRijen.length
    ? figure('simpel-funnel', 'Van bereik tot resultaat', 'Elke stap toont het volume en de doorstroom naar de volgende stap.',
        tabel(['Stap', getalKolom('Aantal'), getalKolom('Doorstroom')],
          funnelRijen.map((r) => [esc(r.label), r.volume == null ? '—' : fmt.getal(r.volume), r.doorstroom == null ? '—' : fmt.procent(r.doorstroom)])),
        'Advertentiekanalen en analytics', 320)
    : '';

  return `
    ${simpelKop('Conversies', dashboard, platforms)}
    <section class="card">
      <h2>Resultaat per platform</h2>
      <div class="table-scroll">${perPlatform}</div>
    </section>
    ${funnel}
    ${primair}
    ${secundair}
  `;
}

/* ---------- View 6: Segmenten (apparaat / regio / weekdag) ---------- */

function renderSegmentenView(dashboard, platforms) {
  const seg = adSegmenten(dashboard, platforms);
  const rlabel = seg.rlabel ?? 'Resultaat';
  const heeftSpend = seg.devices.some((d) => d.spend != null);

  const apparaatTabel = tabel(
    ['Apparaat', ...(heeftSpend ? [getalKolom('Uitgaven')] : [getalKolom('Gebruikers')]), getalKolom(rlabel), getalKolom('Aandeel')],
    seg.devices.map((d) => [
      esc(d.name),
      heeftSpend ? fmt.euro(d.spend) : fmt.getal(d.users),
      fmt.getal(d.results),
      d.aandeel == null ? '—' : fmt.procent(d.aandeel),
    ]),
  );

  const apparaat = seg.devices.length
    ? `<div class="dash-rij">
        <div class="dash-col" style="--span:5">${figure('simpel-donut-devices', 'Apparaat', `Verdeling van ${rlabel.toLowerCase()} over apparaten.`, apparaatTabel, 'Advertentiekanalen en analytics', 240)}</div>
        <div class="dash-col" style="--span:7"><section class="card"><h2>Per apparaat</h2><div class="table-scroll">${apparaatTabel}</div>${segmentInzicht(seg.devices, rlabel, 'apparaat')}</section></div>
      </div>` : '';

  const regio = seg.regios.length
    ? figure('simpel-bar-regio', 'Regio', `${rlabel} per regio.`,
        tabel(['Regio', getalKolom('Gebruikers'), getalKolom(rlabel), getalKolom('Aandeel')],
          seg.regios.map((r) => [esc(r.name), fmt.getal(r.users), fmt.getal(r.results), r.aandeel == null ? '—' : fmt.procent(r.aandeel)])),
        'Analytics', 260)
    : '';

  const weekdag = seg.weekdagen.length
    ? figure('simpel-bar-weekdag', 'Dag van de week', 'Uitgaven en resultaten per weekdag, opgeteld over de periode.',
        tabel(['Dag', getalKolom('Uitgaven'), getalKolom(rlabel), getalKolom(`Kosten/${rlabel.toLowerCase()}`)],
          seg.weekdagen.map((w) => [esc(w.name), fmt.euro(w.spend), fmt.getal(w.results), w.costPerResult == null ? '—' : fmt.euro2(w.costPerResult)])),
        'Meta Marketing API en Google Ads API', 260)
    : '';

  const leeg = (!seg.devices.length && !seg.regios.length && !seg.weekdagen.length)
    ? `<section class="card"><p class="empty">Er zijn voor deze klant geen segmentgegevens beschikbaar.</p></section>` : '';

  return `
    ${simpelKop('Segmenten', dashboard, platforms)}
    ${apparaat}
    ${seg.regios.length ? `<div class="dash-rij"><div class="dash-col" style="--span:6">${regio}</div><div class="dash-col" style="--span:6">${weekdag}</div></div>` : weekdag}
    ${leeg}
  `;
}

/** Kort één-regel-inzicht onder een segmenttabel (grootste segment). */
function segmentInzicht(rijen, rlabel, soort) {
  const top = [...rijen].filter((r) => r.results > 0).sort((a, b) => b.results - a.results)[0];
  if (!top || top.aandeel == null) return '';
  return `<p class="muted klein segment-inzicht">${esc(top.name)} is het grootste ${soort}: ${fmt.procent(top.aandeel)} van de ${esc(rlabel.toLowerCase())}.</p>`;
}

/* ---------- View 7: Trends ---------- */

function renderTrendsView(dashboard, platforms) {
  const totaal = combineerTotalen(platforms);
  const rlabel = totaal?.resultLabel ?? 'Resultaat';

  return `
    ${simpelKop('Trends', dashboard, platforms)}
    ${trendMetriekFiguur('simpel-trend-trends', platforms, { titel: 'Ontwikkeling per dag', subtitel: 'Meta en Google per dag — wissel de metriek.' })}
    <section class="card">
      <h2>Uitgaven per dag — gestapeld</h2>
      <p class="muted">Meta en Google gestapeld, zodat het totale dagbudget zichtbaar is.</p>
      <div class="chart-canvas" style="height:260px"><canvas id="simpel-stacked-spend"></canvas></div>
    </section>
    <section class="card">
      <h2>Vergelijking met de vorige periode</h2>
      ${vergelijkingTabel(dashboard, totaal)}
    </section>
  `;
}

/* ---------- Vergelijkingstabel ---------- */

/**
 * Vergelijkt de huidige periode met de vorige, gescoped op de twee
 * advertentieplatforms (Meta + Google). De "deze periode"-waarden komen uit de
 * gecombineerde platformtotalen; de vorige periode + het verschil komen uit
 * `adDeltas` (ad-schaal, richting uit de metriek-catalogus).
 */
function vergelijkingTabel(dashboard, adTotalen) {
  const ad = adTotalen ?? {};
  const deltas = adDeltas(dashboard, ad);
  const rlabel = ad.resultLabel ?? 'Resultaat';
  const model = dashboard.model;
  const regels = [
    { label: 'Uitgaven', key: 'spend', fmt: fmt.euro },
    { label: 'Vertoningen', key: 'impressions', fmt: fmt.getal },
    { label: 'Klikken', key: 'clicks', fmt: fmt.getal },
    { label: 'Doorklikratio', key: 'ctr', fmt: fmt.procent },
    { label: 'Kosten per klik', key: 'cpc', fmt: fmt.euro2 },
    { label: rlabel, key: 'results', fmt: fmt.getal },
    { label: `Kosten per ${rlabel.toLowerCase()}`, key: 'costPerResult', fmt: fmt.euro2 },
  ];
  if (model === 'ecommerce') {
    regels.push({ label: 'Omzet', key: 'revenue', fmt: fmt.euro });
    regels.push({ label: 'ROAS', key: 'roas', fmt: fmt.ratio });
  } else if (model === 'awareness') {
    regels.push({ label: 'Bereik per dag', key: 'reach', fmt: fmt.getal });
    regels.push({ label: 'Frequentie', key: 'frequentie', fmt: fmt.ratio });
  }
  const rijen = regels.map((r) => {
    const nu = ad[r.key];
    const d = deltas[r.key];
    const toen = d?.vorig;
    const verschil = d && d.procent != null && (d.status === 'gestegen' || d.status === 'gedaald')
      ? `<span class="trend-${esc(d.richting)}">${esc(d.tekst)}</span>`
      : '—';
    return [esc(r.label), nu == null ? '—' : r.fmt(nu), toen == null ? '—' : r.fmt(toen), verschil];
  });
  return `<div class="table-scroll">${tabel(['Metriek', getalKolom('Deze periode'), getalKolom('Vorige periode'), getalKolom('Verschil')], rijen)}</div>`;
}

/* ---------- Budget & tempo ---------- */

function budgetTempoKaart(dashboard, platforms) {
  const t = budgetTempo(dashboard, platforms);
  if (!t) return '';
  const drukste = t.drukste ? `${t.drukste.name} (${fmt.euro(t.drukste.spend)})` : 'Niet te bepalen';
  return `<section class="card budget-tempo">
    <h2>Budget &amp; tempo</h2>
    <div class="kpi-row">
      ${kpiKaartje('Uitgaven', fmt.euro(t.uitgaven), `over ${t.dagen} ${t.dagen === 1 ? 'dag' : 'dagen'}`)}
      ${kpiKaartje('Gemiddeld per dag', t.gemiddeldPerDag == null ? '—' : fmt.euro(t.gemiddeldPerDag), 'advertentiebudget')}
      ${kpiKaartje('Drukste dag', drukste, 'hoogste dagbudget')}
      ${t.aandeelBudget != null ? kpiKaartje('Aandeel van accountbudget', fmt.procent(t.aandeelBudget), `budget ${fmt.euro(t.accountBudget)}`) : ''}
    </div>
  </section>`;
}

/** Lichte KPI-tegel zonder delta (voor de tempokaart). */
function kpiKaartje(label, waarde, sub) {
  return `<article class="card kpi" data-label="${esc(label)}">
    <span class="kpi-label">${esc(label)}</span>
    <span class="kpi-value">${esc(waarde)}</span>
    <span class="kpi-sub">${esc(sub)}</span>
  </article>`;
}

/* ---------- Verdeeltabel (voor donut-tabelweergave) ---------- */

function verdeelTabel(items, eersteKolom, rlabel) {
  const totaalSpend = items.reduce((s, i) => s + (i.spend ?? 0), 0);
  return tabel(
    [eersteKolom, getalKolom('Uitgaven'), getalKolom('Aandeel'), getalKolom(rlabel)],
    items.map((i) => [
      esc(i.name), fmt.euro(i.spend),
      totaalSpend ? fmt.procent((i.spend / totaalSpend) * 100) : '—',
      fmt.getal(i.results),
    ]),
  );
}

/* ---------- Inzichten ---------- */

/** Ad-gerichte auto-inzichten ("Wat valt op"). */
function adInzichtenBlok(dashboard, platforms, max = 3) {
  const inzichten = bouwAdInzichten(dashboard, platforms);
  if (!inzichten.primair.length) return '';
  return renderInzichten(
    { primair: inzichten.primair.slice(0, max), aanvullend: inzichten.aanvullend },
    { titel: 'Wat valt op', toonAanvullend: true },
  );
}

/* ---------------------------------------------------------------
   Grafieken (na render tekenen) — per view
   --------------------------------------------------------------- */

/** Leest de actieve metriek van een metric-switcher uit de DOM (default spend). */
function actieveMetriek(grafiekId) {
  const knop = document.querySelector(`.metric-switch-knop.actief[data-simpel-metric^="${grafiekId}:"]`);
  const waarde = knop?.dataset.simpelMetric?.split(':')[1];
  return TREND_META[waarde] ? waarde : 'spend';
}

export function drawSimpelCharts({ dashboard, platforms, view = 'simpel-overzicht' }) {
  if (!platforms) return;
  const meta = platforms.meta;
  const google = platforms.google;

  if (view === 'simpel-overzicht') {
    tekenTrendMetriek('simpel-trend-overzicht', platforms, actieveMetriek('simpel-trend-overzicht'));
    tekenSplitDonut('simpel-donut-split', meta, google);
  } else if (view === 'simpel-google' || view === 'simpel-meta') {
    const blok = view === 'simpel-google' ? google : meta;
    if (blok?.aanwezig) {
      tekenTrendMetriek('simpel-trend-platform', { [blok.platform]: blok }, actieveMetriek('simpel-trend-platform'));
      const placements = blok.breakdowns?.placements ?? [];
      if (placements.length) tekenVerdeelDonut('simpel-donut-placements', placements);
    }
  } else if (view === 'simpel-conversies') {
    const primair = dashboard?.conversies?.primair ?? [];
    if (primair.length) {
      donutChart('simpel-donut-conversies', {
        labels: primair.map((c) => c.label ?? c.type ?? ''),
        data: primair.map((c) => c.aantal ?? 0),
        valueFormatter: (v) => fmt.getal(v),
      });
    }
    const funnelRijen = dashboard.funnel?.rijen ?? [];
    if (funnelRijen.length) {
      funnelChart('simpel-funnel', {
        stappen: funnelRijen.map((r) => ({ label: r.label, volume: r.volume, doorstroom: r.doorstroom })),
        valueFormatter: (v) => fmt.getal(v),
      });
    }
  } else if (view === 'simpel-segmenten') {
    const seg = adSegmenten(dashboard, platforms);
    if (seg.devices.length) {
      donutChart('simpel-donut-devices', {
        labels: seg.devices.map((d) => d.name),
        data: seg.devices.map((d) => d.results ?? 0),
        valueFormatter: (v) => fmt.getal(v),
      });
    }
    if (seg.regios.length) {
      barChart('simpel-bar-regio', {
        labels: seg.regios.map((r) => r.name),
        series: [{ label: seg.rlabel, data: seg.regios.map((r) => r.results ?? 0) }],
        horizontal: true,
        valueFormatter: (v) => fmt.getal(v),
      });
    }
    if (seg.weekdagen.length) {
      barChart('simpel-bar-weekdag', {
        labels: seg.weekdagen.map((w) => w.name),
        series: [{ label: 'Uitgaven', data: seg.weekdagen.map((w) => w.spend ?? 0) }],
        valueFormatter: (v) => fmt.euro(v),
      });
    }
  } else if (view === 'simpel-trends') {
    tekenTrendMetriek('simpel-trend-trends', platforms, actieveMetriek('simpel-trend-trends'));
    tekenStackedSpend('simpel-stacked-spend', meta, google);
  }
}

/** Herteken de trendgrafiek voor een gekozen metriek (metric-switcher). */
export function zetTrendMetriek(platforms, grafiekId, metricKey) {
  const key = TREND_META[metricKey] ? metricKey : 'spend';
  document.querySelectorAll(`[data-simpel-metric^="${grafiekId}:"]`).forEach((b) => {
    const actief = b.dataset.simpelMetric === `${grafiekId}:${key}`;
    b.classList.toggle('actief', actief);
    b.setAttribute('aria-selected', actief ? 'true' : 'false');
  });
  const canvas = document.getElementById(grafiekId);
  const fig = canvas?.closest('.chart-figure');
  const tabelHouder = fig?.querySelector('.chart-table .table-scroll');
  if (tabelHouder) tabelHouder.innerHTML = trendMetriekTabel(platforms, key);
  const bron = fig?.querySelector('.chart-source');
  if (bron) bron.textContent = `Bron: ${TREND_META[key]?.bron ?? 'Advertentiekanalen'}`;
  tekenTrendMetriek(grafiekId, platforms, key);
}

function tekenTrendMetriek(canvasId, platforms, metricKey) {
  const m = TREND_META[metricKey] ?? TREND_META.spend;
  const basis = reeksAs(platforms.meta, platforms.google);
  if (!basis.length) return;
  const series = [];
  if (platforms.meta?.aanwezig) series.push({ label: 'Meta Ads', data: platforms.meta.series.map(m.getVal) });
  if (platforms.google?.aanwezig) series.push({ label: 'Google Ads', data: platforms.google.series.map(m.getVal) });
  lineChart(canvasId, { labels: basis.map((p) => toonKorteDatum(p.date)), series, valueFormatter: m.opmaak });
}

function tekenSplitDonut(canvasId, meta, google) {
  const labels = [];
  const data = [];
  for (const b of [meta, google]) if (b?.aanwezig) { labels.push(b.label); data.push(b.totals.spend); }
  if (labels.length) donutChart(canvasId, { labels, data, valueFormatter: (v) => fmt.euro(v) });
}

function tekenVerdeelDonut(canvasId, items) {
  donutChart(canvasId, {
    labels: items.map((i) => i.name),
    data: items.map((i) => i.spend ?? 0),
    valueFormatter: (v) => fmt.euro(v),
  });
}

function tekenStackedSpend(canvasId, meta, google) {
  const basis = reeksAs(meta, google);
  if (!basis.length) return;
  const series = [];
  if (meta?.aanwezig) series.push({ label: 'Meta Ads', data: meta.series.map((p) => p.spend) });
  if (google?.aanwezig) series.push({ label: 'Google Ads', data: google.series.map((p) => p.spend) });
  barChart(canvasId, { labels: basis.map((p) => toonKorteDatum(p.date)), series, stacked: true, valueFormatter: (v) => fmt.euro(v) });
}
