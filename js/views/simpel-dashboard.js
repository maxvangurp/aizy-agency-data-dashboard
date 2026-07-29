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
 * view (op `route.naam`).
 */

import { fmt, esc, tabel, figure, getalKolom, badge, kpi } from './components.js';
import { renderInzichtkaart } from './insight-cards.js';
import { combineerTotalen, alleCampagnes } from '../data/ads-data.js';
import { lineChart, barChart } from '../charts.js';
import { PERIODE_PRESETS, toonBereik, toonKorteDatum } from '../filters/period.js';

/* De datapagina's in de sidebar. */
const SIMPEL_NAV = [
  { naam: 'simpel-overzicht', pad: '#/pulse', label: 'Totaal overzicht' },
  { naam: 'simpel-google', pad: '#/pulse/google-ads', label: 'Google Ads' },
  { naam: 'simpel-meta', pad: '#/pulse/meta-ads', label: 'Meta Ads' },
  { naam: 'simpel-campagnes', pad: '#/pulse/campagnes', label: 'Campagnes' },
  { naam: 'simpel-conversies', pad: '#/pulse/conversies', label: 'Conversies' },
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
    case 'simpel-google': return renderPlatformView(dashboard, platforms.google);
    case 'simpel-meta': return renderPlatformView(dashboard, platforms.meta);
    case 'simpel-campagnes': return renderCampagnesView(dashboard, platforms);
    case 'simpel-conversies': return renderConversiesView(dashboard, platforms);
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

/** KPI-band uit een totals-object. */
function kpiBand(totals, rlabel) {
  return `<div class="kpi-row simpel-kpi">
    ${kpi('Uitgaven', fmt.euro(totals.spend), 'advertentiebudget', 'neutraal', { primair: true })}
    ${kpi('Vertoningen', fmt.getal(totals.impressions), 'keer getoond')}
    ${kpi('Klikken', fmt.getal(totals.clicks), `CTR ${totals.ctr == null ? '—' : fmt.procent(totals.ctr)}`)}
    ${kpi('Kosten per klik', totals.cpc == null ? 'Niet te berekenen' : fmt.euro2(totals.cpc), 'gemiddelde CPC')}
    ${kpi(rlabel, fmt.getal(totals.results), 'geregistreerde conversies')}
    ${kpi(`Kosten per ${rlabel.toLowerCase()}`, totals.costPerResult == null ? 'Niet te berekenen' : fmt.euro2(totals.costPerResult), 'gemiddeld')}
  </div>`;
}

/** Tabel met campagne-/breakdownregels (spend, klikken, ctr, resultaat, kosten/res). */
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

/* ---------- View 1: Totaal overzicht ---------- */

function renderOverzichtView(dashboard, platforms) {
  const totaal = combineerTotalen(platforms);
  const rlabel = totaal?.resultLabel ?? 'Resultaat';
  const campagnes = alleCampagnes(platforms).slice(0, 8);

  return `
    ${simpelKop('Meta & Google Ads', dashboard, platforms)}
    ${kpiBand(totaal, rlabel)}
    <div class="dash-rij">
      <div class="dash-col" style="--span:5">
        <section class="card">
          <h2>Meta vs Google</h2>
          <div class="chart-canvas" style="height:220px"><canvas id="simpel-chart-split"></canvas></div>
          <div class="table-scroll">${platformSplitTabel(platforms, rlabel)}</div>
        </section>
      </div>
      <div class="dash-col" style="--span:7">
        ${figure('simpel-chart-trend', 'Uitgaven per dag', 'Het bestede budget per platform binnen de periode.', trendTabel(platforms), 'Meta Marketing API en Google Ads API', 260)}
      </div>
    </div>
    <section class="card">
      <h2>Top campagnes</h2>
      <p class="muted">De grootste campagnes over beide platforms.</p>
      <div class="table-scroll">${prestatieTabel(campagnes, rlabel, { metPlatform: true })}</div>
    </section>
    ${simpelInzichten(dashboard, 2)}
  `;
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
 * platforms. Een afwezig platform levert een lege reeks (`[]`), die met `??`
 * niet zou worden overgeslagen — daarom expliciet op lengte kiezen. Zo houdt een
 * klant met alleen Google (of alleen Meta) toch een gevulde trend.
 */
function reeksAs(meta, google) {
  return (meta?.series?.length ? meta.series : google?.series) ?? [];
}

function trendTabel(platforms) {
  const basis = reeksAs(platforms.meta, platforms.google);
  return tabel(['Datum', getalKolom('Meta'), getalKolom('Google')],
    basis.map((p, i) => [esc(toonKorteDatum(p.date)), fmt.euro(platforms.meta?.series?.[i]?.spend ?? 0), fmt.euro(platforms.google?.series?.[i]?.spend ?? 0)]));
}

/* ---------- View 2/3: Google Ads / Meta Ads ---------- */

function renderPlatformView(dashboard, blok) {
  if (!blok?.aanwezig) {
    return `<section class="card"><h2>Niet actief</h2>
      <p class="empty">Deze klant adverteert binnen de geselecteerde periode niet via dit platform.</p></section>`;
  }
  const rlabel = blok.resultLabel ?? 'Resultaat';
  const bd = blok.breakdowns ?? {};

  const adGroups = (bd.adGroups ?? []).length
    ? `<section class="card"><h2>Advertentiegroepen</h2>
        <div class="table-scroll">${prestatieTabel(bd.adGroups, rlabel, { eersteKolom: 'Advertentiegroep' })}</div></section>`
    : '';
  const keywords = (bd.keywords ?? []).length
    ? `<section class="card"><h2>Zoekwoorden</h2>
        <div class="table-scroll">${prestatieTabel(bd.keywords, rlabel, { eersteKolom: 'Zoekwoord', extra: { kop: 'Matchtype', cel: (c) => c.matchType ? badge(c.matchType, 'muted') : '—' } })}</div></section>`
    : '';
  const adSets = (bd.adSets ?? []).length
    ? `<section class="card"><h2>Ad sets</h2>
        <div class="table-scroll">${prestatieTabel(bd.adSets, rlabel, { eersteKolom: 'Ad set' })}</div></section>`
    : '';
  const placements = (bd.placements ?? []).length
    ? `<section class="card"><h2>Plaatsingen</h2>
        <div class="table-scroll">${prestatieTabel(bd.placements, rlabel, { eersteKolom: 'Plaatsing' })}</div></section>`
    : '';

  return `
    ${simpelKop(blok.label, dashboard, { demodata: true })}
    ${kpiBand(blok.totals, rlabel)}
    ${figure('simpel-chart-platform', 'Uitgaven per dag', `Het bestede budget van ${blok.label} binnen de periode.`,
      tabel(['Datum', getalKolom('Uitgaven')], (blok.series ?? []).map((p) => [esc(toonKorteDatum(p.date)), fmt.euro(p.spend ?? 0)])),
      blok.platform === 'google' ? 'Google Ads API' : 'Meta Marketing API', 260)}
    <section class="card">
      <h2>Campagnes</h2>
      <div class="table-scroll">${prestatieTabel(blok.campaigns ?? [], rlabel)}</div>
    </section>
    ${adGroups}
    ${keywords}
    ${adSets}
    ${placements}
    ${simpelInzichten(dashboard, 1)}
  `;
}

/* ---------- View 4: Campagnes (alle, met platformfilter) ---------- */

function renderCampagnesView(dashboard, platforms) {
  const totaal = combineerTotalen(platforms);
  const rlabel = totaal?.resultLabel ?? 'Resultaat';
  const campagnes = alleCampagnes(platforms);

  return `
    ${simpelKop('Campagnes', dashboard, platforms, `${campagnes.length} campagnes`)}
    <section class="card">
      <p class="muted">Alle campagnes over beide platforms, gesorteerd op uitgaven.</p>
      <div class="table-scroll">${prestatieTabel(campagnes, rlabel, { metPlatform: true })}</div>
    </section>
  `;
}

/* ---------- View 5: Conversies ---------- */

function renderConversiesView(dashboard, platforms) {
  const totaal = combineerTotalen(platforms);
  const rlabel = totaal?.resultLabel ?? 'Resultaat';

  const perPlatform = tabel(
    ['Platform', getalKolom(rlabel), getalKolom(`Kosten/${rlabel.toLowerCase()}`), getalKolom('Aandeel')],
    ['meta', 'google'].map((k) => platforms[k]).filter((b) => b?.aanwezig).map((b) => [
      esc(b.label), fmt.getal(b.totals.results),
      b.totals.costPerResult == null ? '—' : fmt.euro2(b.totals.costPerResult),
      totaal.results ? fmt.procent((b.totals.results / totaal.results) * 100) : '—',
    ]),
  );

  const conv = dashboard.conversies ?? {};
  const convRij = (c) => [esc(c.label ?? c.type ?? ''), fmt.getal(c.aantal), c.vorigePeriode == null ? '—' : fmt.getal(c.vorigePeriode)];
  const primair = (conv.primair ?? []).length
    ? `<section class="card"><h2>Primaire conversies</h2>
        <div class="chart-canvas" style="height:220px"><canvas id="simpel-chart-conversies"></canvas></div>
        <div class="table-scroll">${tabel(['Conversie', getalKolom('Aantal'), getalKolom('Vorige periode')], (conv.primair ?? []).map(convRij))}</div>
       </section>` : '';
  const secundair = (conv.secundair ?? []).length
    ? `<section class="card"><h2>Secundaire conversies</h2>
        <div class="table-scroll">${tabel(['Conversie', getalKolom('Aantal'), getalKolom('Vorige periode')], (conv.secundair ?? []).map(convRij))}</div>
       </section>` : '';

  const funnel = (dashboard.funnel?.rijen ?? []).length
    ? `<section class="card"><h2>Van bereik tot resultaat</h2>
        <div class="table-scroll">${tabel(['Stap', getalKolom('Aantal'), getalKolom('Doorstroom')],
          dashboard.funnel.rijen.map((r) => [esc(r.label), r.volume == null ? '—' : fmt.getal(r.volume), r.doorstroom == null ? '—' : fmt.procent(r.doorstroom)]))}</div>
       </section>` : '';

  return `
    ${simpelKop('Conversies', dashboard, platforms)}
    <section class="card">
      <h2>Resultaat per platform</h2>
      <div class="table-scroll">${perPlatform}</div>
    </section>
    ${primair}
    ${secundair}
    ${funnel}
  `;
}

/* ---------- View 6: Trends ---------- */

function renderTrendsView(dashboard, platforms) {
  const totaal = combineerTotalen(platforms);
  const rlabel = totaal?.resultLabel ?? 'Resultaat';
  const basis = reeksAs(platforms.meta, platforms.google);

  const resultRij = basis.map((p, i) => {
    const m = platforms.meta?.series?.[i]?.results ?? 0;
    const g = platforms.google?.series?.[i]?.results ?? 0;
    return [esc(toonKorteDatum(p.date)), fmt.getal(m + g)];
  });

  return `
    ${simpelKop('Trends', dashboard, platforms)}
    <div class="dash-rij">
      <div class="dash-col" style="--span:6">
        ${figure('simpel-chart-trend-spend', 'Uitgaven per dag', 'Per platform binnen de periode.', trendTabel(platforms), 'Meta Marketing API en Google Ads API', 240)}
      </div>
      <div class="dash-col" style="--span:6">
        ${figure('simpel-chart-trend-results', `${rlabel} per dag`, 'Gecombineerd over beide platforms.',
          tabel(['Datum', getalKolom(rlabel)], resultRij), 'Advertentiekanalen en analytics', 240)}
      </div>
    </div>
    <section class="card">
      <h2>Vergelijking met de vorige periode</h2>
      ${vergelijkingTabel(dashboard, totaal)}
    </section>
  `;
}

/**
 * Vergelijkt de huidige periode met de vorige, gescoped op de twee
 * advertentieplatforms (Meta + Google) zodat de cijfers gelijk zijn aan de rest
 * van dit "Meta & Google Ads"-dashboard. De "deze periode"-waarden komen uit de
 * gecombineerde platformtotalen; de vorige periode wordt afgeleid door de
 * account-brede periode-over-periode-verhouding (`vorigeTotalen`/`totalen`) op
 * die ad-waarden toe te passen. Zo blijft het procentuele verschil gelijk aan de
 * accounttrend, terwijl de absolute getallen consistent blijven met de KPI-band.
 */
function vergelijkingTabel(dashboard, adTotalen) {
  const ad = adTotalen ?? {};
  const t = dashboard.totalen ?? {};
  const v = dashboard.vorigeTotalen ?? {};
  const rveld = dashboard.model === 'ecommerce' ? 'purchases' : dashboard.model === 'awareness' ? 'engagements' : 'leads';
  const rlabel = dashboard.model === 'ecommerce' ? 'Aankopen' : dashboard.model === 'awareness' ? 'Interacties' : 'Leads';
  const regels = [
    { label: 'Uitgaven', adKey: 'spend', accKey: 'spend', fmt: fmt.euro },
    { label: 'Vertoningen', adKey: 'impressions', accKey: 'impressions', fmt: fmt.getal },
    { label: 'Klikken', adKey: 'clicks', accKey: 'clicks', fmt: fmt.getal },
    { label: rlabel, adKey: 'results', accKey: rveld, fmt: fmt.getal },
  ];
  const rijen = regels.map((r) => {
    const nu = ad[r.adKey];
    const accNu = t[r.accKey];
    const accToen = v[r.accKey];
    // Vorige-periode-waarde op ad-schaal: de ad-waarde vermenigvuldigd met de
    // account-verhouding vorige/huidige. Het % verschil is daarmee gelijk aan de
    // accounttrend.
    const toen = (nu != null && accNu != null && accToen != null && accNu !== 0)
      ? nu * (accToen / accNu)
      : null;
    const verschil = (nu != null && toen != null && toen !== 0)
      ? `<span class="trend-${nu - toen >= 0 ? 'positief' : 'negatief'}">${nu - toen >= 0 ? '+' : ''}${(((nu - toen) / toen) * 100).toFixed(1)}%</span>`
      : '—';
    return [esc(r.label), nu == null ? '—' : r.fmt(nu), toen == null ? '—' : r.fmt(Math.round(toen)), verschil];
  });
  return `<div class="table-scroll">${tabel(['Metriek', getalKolom('Deze periode'), getalKolom('Vorige periode'), getalKolom('Verschil')], rijen)}</div>`;
}

/* ---------- Inzichten ---------- */

function simpelInzichten(dashboard, aantal) {
  const primair = (dashboard?.inzichten?.primair ?? []).slice(0, aantal);
  if (!primair.length) return '';
  return `<section class="inzichten-blok">
    <h2 class="sectie-titel">Wat opvalt</h2>
    <div class="inzicht-grid">
      ${primair.map((i, idx) => renderInzichtkaart(i, { dominant: idx === 0 })).join('')}
    </div>
  </section>`;
}

/* ---------------------------------------------------------------
   Grafieken (na render tekenen) — per view
   --------------------------------------------------------------- */

export function drawSimpelCharts({ dashboard, platforms, view = 'simpel-overzicht' }) {
  if (!platforms) return;
  const meta = platforms.meta;
  const google = platforms.google;

  if (view === 'simpel-overzicht') {
    tekenTrend('simpel-chart-trend', meta, google);
    tekenSplit('simpel-chart-split', meta, google);
  } else if (view === 'simpel-google' || view === 'simpel-meta') {
    const blok = view === 'simpel-google' ? google : meta;
    if (blok?.aanwezig && blok.series?.length) {
      lineChart('simpel-chart-platform', {
        labels: blok.series.map((p) => toonKorteDatum(p.date)),
        series: [{ label: 'Uitgaven', data: blok.series.map((p) => p.spend) }],
        valueFormatter: (v) => fmt.euro(v),
      });
    }
  } else if (view === 'simpel-trends') {
    tekenTrend('simpel-chart-trend-spend', meta, google);
    const basis = reeksAs(meta, google);
    if (basis.length) {
      lineChart('simpel-chart-trend-results', {
        labels: basis.map((p) => toonKorteDatum(p.date)),
        series: [{ label: 'Resultaat', data: basis.map((p, i) => (meta?.series?.[i]?.results ?? 0) + (google?.series?.[i]?.results ?? 0)) }],
        valueFormatter: (v) => fmt.getal(v),
      });
    }
  } else if (view === 'simpel-conversies') {
    const primair = dashboard?.conversies?.primair ?? [];
    if (primair.length) {
      barChart('simpel-chart-conversies', {
        labels: primair.map((c) => c.label ?? c.type ?? ''),
        series: [{ label: 'Aantal', data: primair.map((c) => c.aantal ?? 0) }],
        valueFormatter: (v) => fmt.getal(v),
      });
    }
  }
}

function tekenTrend(canvasId, meta, google) {
  const basis = reeksAs(meta, google);
  if (!basis.length) return;
  const series = [];
  if (meta?.aanwezig) series.push({ label: 'Meta Ads', data: meta.series.map((p) => p.spend) });
  if (google?.aanwezig) series.push({ label: 'Google Ads', data: google.series.map((p) => p.spend) });
  lineChart(canvasId, { labels: basis.map((p) => toonKorteDatum(p.date)), series, valueFormatter: (v) => fmt.euro(v) });
}

function tekenSplit(canvasId, meta, google) {
  const labels = [];
  const data = [];
  for (const b of [meta, google]) if (b?.aanwezig) { labels.push(b.label); data.push(b.totals.spend); }
  if (labels.length) barChart(canvasId, { labels, series: [{ label: 'Uitgaven', data }], valueFormatter: (v) => fmt.euro(v) });
}
