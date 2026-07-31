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
import { inzichtCategorieTerm } from '../terminology.js';
import { combineerTotalen, alleCampagnes, adDeltas, adTotalenVorige, adSegmenten, resultMetriek, gecombineerdeReeks, metriekReeks, afgeleideRatios } from '../data/ads-data.js';
import { bouwAdInzichten, budgetTempo } from '../data/simpel-insights.js';
import { optimalisatiesVoor, OptimStatus } from '../model/optimalisaties.js';
import { koppelingVoor, aantalGekoppeld, BronStatus } from '../model/databronnen.js';
import { lineChart, barChart, donutChart, funnelChart } from '../charts.js';
import { PERIODE_PRESETS, VERGELIJK_MODI, toonBereik, toonKorteDatum, toonDatum } from '../filters/period.js';

/** Korte, in-zin bruikbare tekst per vergelijkingsmodus (voor 't.o.v. …'). */
const VERGELIJK_KORT = {
  previous_period: 'de vorige periode',
  previous_month: 'de vorige maand',
  previous_year: 'dezelfde periode vorig jaar',
  none: 'geen vergelijking',
};
import { kpiDelta, deltaPill, metricSwitcher, chips, interactieveTabel } from './simpel-widgets.js';

/* De datapagina's in de sidebar. */
const SIMPEL_NAV = [
  { naam: 'simpel-overzicht', pad: '#/pulse', label: 'Totaal overzicht' },
  { naam: 'simpel-google', pad: '#/pulse/google-ads', label: 'Google Ads' },
  { naam: 'simpel-meta', pad: '#/pulse/meta-ads', label: 'Meta Ads' },
  { naam: 'simpel-campagnes', pad: '#/pulse/campagnes', label: 'Campagnes' },
  { naam: 'simpel-conversies', pad: '#/pulse/conversies', label: 'Conversies' },
  { naam: 'simpel-segmenten', pad: '#/pulse/segmenten', label: 'Segmenten' },
  { naam: 'simpel-trends', pad: '#/pulse/trends', label: 'Trends' },
  { naam: 'simpel-optimalisatie', pad: '#/pulse/optimalisaties', label: 'Optimalisaties' },
  { naam: 'simpel-databronnen', pad: '#/pulse/databronnen', label: 'Databronnen' },
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
          <div class="page-root simpel-root" id="simpelInhoud" tabindex="-1">
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
  const vergMode = filters?.vergelijking?.mode ?? 'previous_period';
  const isCustom = periode.preset === 'custom';

  const klantKiezer = magWisselen && klanten.length > 1
    ? `<label class="simpel-kiezer">
        <span class="visueel-verborgen">Klant</span>
        <select data-simpel-klant>
          ${klanten.map((k) => `<option value="${esc(k.id)}"${k.id === dashboard?.client?.id ? ' selected' : ''}>${esc(k.name)}</option>`).join('')}
        </select>
      </label>`
    : `<span class="simpel-klantnaam">${esc(dashboard?.client?.name ?? '')}</span>`;

  const datumBereik = isCustom
    ? `<div class="simpel-datumbereik">
        <label class="simpel-datum"><span class="visueel-verborgen">Van</span>
          <input type="date" id="filterVan" value="${esc(periode.startDate ?? '')}" max="${esc(periode.endDate ?? '')}"></label>
        <span aria-hidden="true">–</span>
        <label class="simpel-datum"><span class="visueel-verborgen">Tot</span>
          <input type="date" id="filterTot" value="${esc(periode.endDate ?? '')}" min="${esc(periode.startDate ?? '')}"></label>
      </div>`
    : '';

  return `<header class="simpel-topbar">
    <div class="simpel-topbar-midden">
      ${klantKiezer}
      <div class="simpel-topbar-filters">
        <label class="simpel-kiezer">
          <span class="simpel-kiezer-label">Periode</span>
          <select id="filterPeriode" aria-label="Periode">
            ${PERIODE_PRESETS.map((p) => `<option value="${esc(p.key)}"${periode.preset === p.key ? ' selected' : ''}>${esc(p.label)}</option>`).join('')}
          </select>
        </label>
        ${datumBereik}
        <label class="simpel-kiezer">
          <span class="simpel-kiezer-label">Vergelijk met</span>
          <select id="filterVergelijking" aria-label="Vergelijk met">
            ${VERGELIJK_MODI.map((m) => `<option value="${esc(m.key)}"${m.key === vergMode ? ' selected' : ''}>${esc(m.label)}</option>`).join('')}
          </select>
        </label>
      </div>
    </div>
    <div class="simpel-topbar-acties">
      <a class="btn primary klein" href="#/pulse/rapportage">Rapportage</a>
      <button type="button" class="btn klein" data-simpel-export-pagina>Exporteer</button>
      <button type="button" class="btn klein" data-simpel-print>Print</button>
    </div>
  </header>`;
}

function renderSimpelLaden() {
  const kaart = `<div class="skel-kaart">
    <span class="skel skel-label"></span>
    <span class="skel skel-waarde"></span>
    <span class="skel skel-pill"></span>
    <span class="skel skel-spark"></span>
  </div>`;
  return `<div class="simpel-laden-skel" aria-live="polite" aria-busy="true">
    <span class="visueel-verborgen">Cijfers laden…</span>
    <div class="kpi-row simpel-kpi" aria-hidden="true">${kaart.repeat(5)}</div>
    <div class="skel skel-blok" aria-hidden="true"></div>
  </div>`;
}

/* ---------------------------------------------------------------
   Inhoud: dispatch per view
   --------------------------------------------------------------- */

export function renderSimpelInhoud({ dashboard, platforms, view = 'simpel-overzicht', vergelijking = null }) {
  // Databronnen kun je juist koppelen wanneer er (nog) geen cijfers zijn — die
  // pagina staat daarom vóór de lege-data-terugval en leunt niet op platforms.
  if (view === 'simpel-databronnen') return renderDatabronnenView(dashboard, platforms);
  if (!platforms || (!platforms.meta?.aanwezig && !platforms.google?.aanwezig)) {
    return renderSimpelLeeg('Geen advertentiedata',
      'Er zijn voor deze klant en periode geen Meta- of Google Ads-cijfers.');
  }
  const v = normaliseerVergelijking(vergelijking);
  switch (view) {
    case 'simpel-google': return renderPlatformView(dashboard, platforms.google, platforms, v);
    case 'simpel-meta': return renderPlatformView(dashboard, platforms.meta, platforms, v);
    case 'simpel-campagnes': return renderCampagnesView(dashboard, platforms, v);
    case 'simpel-conversies': return renderConversiesView(dashboard, platforms, v);
    case 'simpel-segmenten': return renderSegmentenView(dashboard, platforms, v);
    case 'simpel-trends': return renderTrendsView(dashboard, platforms, v);
    case 'simpel-optimalisatie': return renderOptimalisatiesView(dashboard, platforms, v);
    case 'simpel-rapportage': return renderSimpelRapportageView(dashboard, platforms, v);
    default: return renderOverzichtView(dashboard, platforms, v);
  }
}

/** Normaliseert de opgeloste vergelijking tot wat de views nodig hebben. */
function normaliseerVergelijking(vergelijking) {
  const mode = vergelijking?.mode ?? 'previous_period';
  return {
    mode,
    actief: mode !== 'none',
    kort: VERGELIJK_KORT[mode] ?? 'de vorige periode',
    label: vergelijking?.label ?? 'Vorige periode',
    startDate: vergelijking?.startDate ?? null,
    endDate: vergelijking?.endDate ?? null,
  };
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

/** Gedeelde paginakop met klant + periode + vergelijking + databron. */
function simpelKop(titel, dashboard, platforms, { ondertitel = '', vergelijking = null } = {}) {
  const periodeLabel = dashboard?.periode ? toonBereik(dashboard.periode.startDate, dashboard.periode.endDate) : '';
  const vergLabel = (vergelijking?.actief && vergelijking.startDate && vergelijking.endDate)
    ? `Vergeleken met ${toonBereik(vergelijking.startDate, vergelijking.endDate)}`
    : (vergelijking && !vergelijking.actief ? 'Geen vergelijking' : '');
  const databron = platforms?.demodata ? databronChip(dashboard) : '';
  return `<div class="simpel-kop">
    <h1>${esc(titel)}</h1>
    <p class="muted">${esc(dashboard?.client?.name ?? '')}${periodeLabel ? ` · ${esc(periodeLabel)}` : ''}${ondertitel ? ` · ${esc(ondertitel)}` : ''}</p>
    <p class="simpel-kop-meta">
      ${vergLabel ? `<span class="muted klein">${esc(vergLabel)}</span>` : ''}
      ${databron ? `${vergLabel ? '<span class="simpel-kop-scheiding" aria-hidden="true">·</span>' : ''}${databron}` : ''}
    </p>
  </div>`;
}

/**
 * De databron-chip in de kop weerspiegelt de (demo-)koppelstatus van de klant en
 * linkt naar de Databronnen-pagina. Nooit een valse live-claim: gekoppeld heet
 * "Gekoppeld (demo)" en de cijfers blijven voorbeelddata.
 */
function databronChip(dashboard) {
  const clientId = dashboard?.client?.id;
  const aantal = clientId ? aantalGekoppeld(clientId) : 0;
  const link = '<a class="link-klein" href="#/pulse/databronnen">Beheer databronnen</a>';
  if (aantal >= 2) {
    return `<span class="simpel-databron">${badge('Gekoppeld (demo)', 'ok')} <span class="muted klein">Voorbeeldcijfers — in productie live via de API.</span> ${link}</span>`;
  }
  if (aantal === 1) {
    return `<span class="simpel-databron">${badge('1 van 2 gekoppeld (demo)', 'middel')} <span class="muted klein">Nog voorbeeldcijfers.</span> <a class="link-klein" href="#/pulse/databronnen">Rond het koppelen af</a></span>`;
  }
  return `<span class="simpel-databron">${badge('Demodata', 'muted')} <a class="link-klein" href="#/pulse/databronnen">Koppel je databronnen voor live cijfers</a></span>`;
}

/* ---------------------------------------------------------------
   KPI-band met vergelijking (delta) + sparklines
   --------------------------------------------------------------- */

const FMT = { euro: fmt.euro, euro2: fmt.euro2, getal: fmt.getal, procent: fmt.procent, ratio: fmt.ratio };

/**
 * KPI-band met verandering t.o.v. de vorige periode en sparklines. Werkt zowel
 * voor de gecombineerde totalen als voor één platform: geef de bijbehorende
 * dagreeks mee voor de sparklines.
 */
function kpiBandDelta(dashboard, totaal, dagreeks, vergelijking = null, { grafiekId = null, actief = 'spend' } = {}) {
  const deltas = adDeltas(dashboard, totaal, { vergelijkingActief: vergelijking ? vergelijking.actief : true });
  const rlabel = totaal.resultLabel ?? 'Resultaat';
  const rl = rlabel.toLowerCase();
  const model = dashboard.model;
  const rTip = resultMetriek(model);
  const cTip = model === 'ecommerce' ? 'cpa' : model === 'awareness' ? 'cpc' : 'cpl';

  // Elke KPI krijgt een sparkline en is (op de trend-pagina's) klikbaar: klikken
  // zet die metriek in de trendgrafiek eronder. De actieve metriek is gemarkeerd.
  const kaart = (key, label, raw, opmaak, { tip } = {}) =>
    kpiDelta(label, raw == null ? 'Niet te berekenen' : FMT[opmaak](raw), deltas[key], {
      sparkData: metriekReeks(dagreeks, key), tip: tip === false ? null : (tip ?? key),
      metric: grafiekId ? key : null, grafiekId, actief: key === actief,
    });

  const kaarten = [
    kaart('spend', 'Uitgaven', totaal.spend, 'euro'),
    kaart('impressions', 'Vertoningen', totaal.impressions, 'getal'),
    kaart('clicks', 'Klikken', totaal.clicks, 'getal'),
    kaart('ctr', 'Doorklikratio', totaal.ctr, 'procent'),
    kaart('cpc', 'Kosten per klik', totaal.cpc, 'euro2'),
    kaart('results', rlabel, totaal.results, 'getal', { tip: rTip }),
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
    // "Conversie per klik" = resultaten/klikken. Bewust géén metriek-tooltip: de
    // catalogus definieert 'conversieratio' als aandeel van sessies (GA4), niet klikken.
    kaarten.push(kaart('conversieratio', 'Conversie per klik', totaal.conversieratio, 'procent', { tip: false }));
  }
  // Zichtbare, hover-onafhankelijke hint dat de kaarten de grafiek sturen — de
  // enige affordance die ook op touch werkt (waar cursor/hover ontbreekt).
  const hint = grafiekId
    ? '<p class="kpi-band-hint muted">Tik of klik op een kaart om die in de grafiek hieronder te zien.</p>'
    : '';
  return `${hint}<div class="kpi-row simpel-kpi">${kaarten.join('')}</div>`;
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
    // CTR en kosten/resultaat mogen ontbreken: geef dan de ruwe null door (leeg
    // data-v) i.p.v. 0, zodat sorteren en CSV "geen data" niet als 0 behandelen.
    { label: 'CTR', uitlijn: 'rechts', type: 'num', cel: (c) => (c.ctr == null ? '—' : fmt.procent(c.ctr)), waarde: (c) => c.ctr },
    { label: rlabel, uitlijn: 'rechts', type: 'num', cel: (c) => fmt.getal(c.results), waarde: (c) => c.results ?? 0 },
    { label: `Kosten/${rl}`, uitlijn: 'rechts', type: 'num', cel: (c) => (c.costPerResult == null ? '—' : fmt.euro2(c.costPerResult)), waarde: (c) => c.costPerResult },
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

// getVal voor de ratio's leunt op dezelfde `afgeleideRatios` als de rest van de
// datalaag — geen aparte formulekopieën die uiteen kunnen lopen.
const TREND_META = {
  spend: { getVal: (p) => p.spend, opmaak: fmt.euro, label: 'Uitgaven' },
  impressions: { getVal: (p) => p.impressions, opmaak: fmt.getal, label: 'Vertoningen' },
  clicks: { getVal: (p) => p.clicks, opmaak: fmt.getal, label: 'Klikken' },
  ctr: { getVal: (p) => afgeleideRatios(p).ctr, opmaak: fmt.procent, label: 'Doorklikratio' },
  cpc: { getVal: (p) => afgeleideRatios(p).cpc, opmaak: fmt.euro2, label: 'Kosten per klik' },
  cpm: { getVal: (p) => afgeleideRatios(p).cpm, opmaak: fmt.euro2, label: 'CPM' },
  results: { getVal: (p) => p.results, opmaak: fmt.getal, label: 'Resultaat' },
  costPerResult: { getVal: (p) => afgeleideRatios(p).costPerResult, opmaak: fmt.euro2, label: 'Kosten per resultaat' },
  conversieratio: { getVal: (p) => afgeleideRatios(p).conversieratio, opmaak: fmt.procent, label: 'Conversie per klik' },
  revenue: { getVal: (p) => p.revenue, opmaak: fmt.euro, label: 'Omzet' },
  roas: { getVal: (p) => afgeleideRatios(p).roas, opmaak: fmt.ratio, label: 'ROAS' },
  reach: { getVal: (p) => p.reach, opmaak: fmt.getal, label: 'Bereik' },
  frequentie: { getVal: (p) => afgeleideRatios(p).frequentie, opmaak: fmt.ratio, label: 'Frequentie' },
};

/**
 * De metriek-sleutels die als KPI-kaart in de band staan, per klanttype — de
 * enige geldige "actieve" metrieken op het overzicht/de platformpagina's. Moet
 * gelijk lopen met de kaarten in `kpiBandDelta`.
 */
function kpiMetriekKeys(model) {
  const keys = ['spend', 'impressions', 'clicks', 'ctr', 'cpc', 'results', 'costPerResult'];
  if (model === 'ecommerce') keys.push('revenue', 'roas');
  else if (model === 'awareness') keys.push('reach', 'frequentie');
  else keys.push('cpm', 'conversieratio');
  return keys;
}

/** Bronvermelding op basis van de aanwezige kanalen (per kanaal correct). */
function trendBron(platforms) {
  const namen = trendPlatforms(platforms).map((k) => (k.key === 'meta' ? 'Meta Marketing API' : 'Google Ads API'));
  return namen.join(' en ') || 'Advertentiekanalen';
}

/** De ondertitel van de trend: welke metriek per dag, plus de klik-hint. */
function trendSubtitel(metricKey, rlabel, { hint = true } = {}) {
  const label = metricKey === 'results' ? rlabel : (TREND_META[metricKey]?.label ?? 'Ontwikkeling');
  return `${label} per dag${hint ? ' — klik op een KPI hierboven om te wisselen.' : ''}`;
}

/** "over beide platforms" bij twee kanalen, anders "voor <kanaal>" (single-channel klant). */
function kanalenZin(platforms) {
  const kols = trendPlatforms(platforms);
  return kols.length > 1 ? 'over beide platforms' : `voor ${kols[0]?.label ?? 'dit kanaal'}`;
}

/** De vorige-periode-zin voor de trend; meervoud bij twee kanalen (twee overlays). */
function stippelZin(platforms) {
  return trendPlatforms(platforms).length > 1
    ? ' De stippellijnen zijn dezelfde periode ervoor.'
    : ' De stippellijn is dezelfde periode ervoor.';
}

/** De volledige trendondertitel: metriek-per-dag (+ evt. klik-hint) + stippel-zin. */
function trendOndertitel(metricKey, rlabel, { hint, vergelijking, platforms }) {
  const basis = trendSubtitel(metricKey, rlabel, { hint });
  if (!vergelijkingActief(vergelijking)) return basis;
  return `${basis.endsWith('.') ? basis : `${basis}.`}${stippelZin(platforms)}`;
}

/** De beschikbare trend-metrieken, afhankelijk van wat de dagreeks bevat. */
function trendMetrieken(platforms) {
  const meta = platforms.meta?.series ?? [];
  const google = platforms.google?.series ?? [];
  const alle = [...meta, ...google];
  const heeft = (veld) => alle.some((p) => p?.[veld] != null);
  const rlabel = platforms.meta?.resultLabel ?? platforms.google?.resultLabel ?? 'Resultaten';
  // Labels uit TREND_META, zodat de switcher-knop en de grafiekondertitel dezelfde
  // term gebruiken (voorheen zei de knop "CTR" en de ondertitel "Doorklikratio").
  const opties = [{ key: 'spend', label: TREND_META.spend.label }];
  if (heeft('clicks')) opties.push({ key: 'clicks', label: TREND_META.clicks.label });
  if (heeft('results')) opties.push({ key: 'results', label: rlabel });
  if (heeft('clicks') && heeft('impressions')) opties.push({ key: 'ctr', label: TREND_META.ctr.label });
  return opties;
}

/** True wanneer een vergelijking actief is (werkt met ruwe én genormaliseerde vorm). */
function vergelijkingActief(vergelijking) {
  return vergelijking?.actief ?? (vergelijking?.mode ? vergelijking.mode !== 'none' : false);
}

/**
 * De 'vorige periode'-referentiereeks voor één platform en één metriek: de
 * huidige dagvorm van dat platform, geschaald zodat het totaal gelijk is aan de
 * vorige-periode-waarde van dat platform. De dagreeks van de vorige periode wordt
 * niet opgeslagen; dit is dezelfde afleiding als de rest van het dashboard.
 */
function platformOverlay(dashboard, blok, metricKey) {
  if (!dashboard || !blok?.aanwezig || !blok.totals) return null;
  const vorige = adTotalenVorige(dashboard, blok.totals);
  const nu = blok.totals[metricKey];
  const toen = vorige[metricKey];
  if (nu == null || toen == null || nu === 0) return null;
  const ratio = toen / nu;
  return metriekReeks(blok.series ?? [], metricKey).map((v) => (v == null ? null : v * ratio));
}

/** De aanwezige platforms in vaste volgorde, met hun kleurindex. */
function trendPlatforms(platforms) {
  return [['meta', 'Meta Ads'], ['google', 'Google Ads']]
    .map(([k, label], i) => ({ key: k, label, blok: platforms[k], kleurIndex: i }))
    .filter((x) => x.blok?.aanwezig);
}

function trendMetriekTabel(platforms, metricKey, { dashboard = null, vergelijking = null } = {}) {
  const m = TREND_META[metricKey] ?? TREND_META.spend;
  const basis = reeksAs(platforms.meta, platforms.google);
  const kols = trendPlatforms(platforms);
  const toonVorige = vergelijkingActief(vergelijking);
  const overlays = toonVorige ? kols.map((k) => platformOverlay(dashboard, k.blok, metricKey)) : [];

  const kolommen = ['Datum', ...kols.map((k) => getalKolom(k.label.replace(' Ads', '')))];
  if (toonVorige) kols.forEach((k) => kolommen.push(getalKolom(`${k.label.replace(' Ads', '')} · vorige`)));

  const rijen = basis.map((p, i) => {
    const rij = [esc(toonKorteDatum(p.date))];
    kols.forEach((k) => rij.push(m.opmaak(m.getVal(k.blok.series[i] ?? {}))));
    if (toonVorige) overlays.forEach((ov) => rij.push(ov && ov[i] != null ? m.opmaak(ov[i]) : '—'));
    return rij;
  });
  return tabel(kolommen, rijen);
}

/** De ruwe metriek uit de URL-query (`metric=`), of null. */
function urlMetriekRaw() {
  try {
    const q = window.location.hash.split('?')[1];
    return q ? new URLSearchParams(q).get('metric') : null;
  } catch { return null; }
}

/**
 * De actieve trend-metriek. `switcherOpties` = de beperkte set van de switcher
 * (Trends-pagina); `kaartKeys` = de metrieken die als klikbare KPI-kaart bestaan
 * (overzicht/platform). De URL-metriek moet in die set zitten, anders valt de
 * grafiek terug op 'spend' — voorkomt dat kop/tabel bijv. ROAS tonen terwijl de
 * grafiek (die geen bijbehorende kaart vindt) stilzwijgend Uitgaven tekent.
 */
function actieveTrendMetriek({ switcherOpties = null, kaartKeys = null } = {}) {
  const m = urlMetriekRaw();
  if (switcherOpties) return (m && switcherOpties.some((o) => o.key === m)) ? m : (switcherOpties[0]?.key ?? 'spend');
  const geldig = kaartKeys ? kaartKeys.includes(m) : Boolean(m && TREND_META[m]);
  return geldig ? m : 'spend';
}

/**
 * Trendkaart. Op het overzicht en de platformpagina's sturen de klikbare KPI's
 * de grafiek (geen aparte switcher); op Trends staat wél een switcher, want daar
 * zijn geen KPI's. `actief` geeft de startmetriek.
 */
function trendMetriekFiguur(grafiekId, platforms, { titel = 'Ontwikkeling per dag', dashboard = null, vergelijking = null, toonSwitcher = false, actief = 'spend', hint = !toonSwitcher } = {}) {
  const opties = trendMetrieken(platforms);
  const key = TREND_META[actief] ? actief : 'spend';
  const rlabel = platforms.meta?.resultLabel ?? platforms.google?.resultLabel ?? 'Resultaat';
  const bron = trendBron(platforms);
  const subtitel = trendOndertitel(key, rlabel, { hint, vergelijking, platforms });
  return `<div class="trend-blok">
    ${toonSwitcher ? metricSwitcher(grafiekId, opties, key) : ''}
    ${figure(grafiekId, titel, subtitel, trendMetriekTabel(platforms, key, { dashboard, vergelijking }), bron, 280)}
    <p class="visueel-verborgen" aria-live="polite" data-trend-live></p>
  </div>`;
}

/* ---------- View 1: Totaal overzicht ---------- */

function renderOverzichtView(dashboard, platforms, vergelijking) {
  const totaal = combineerTotalen(platforms);
  const rlabel = totaal?.resultLabel ?? 'Resultaat';
  const campagnes = alleCampagnes(platforms).slice(0, 8);
  const dagreeks = gecombineerdeReeks(platforms);
  const actiefMetriek = actieveTrendMetriek({ kaartKeys: kpiMetriekKeys(dashboard.model) });

  return `
    ${simpelKop('Meta & Google Ads', dashboard, platforms, { vergelijking })}
    <h2 class="visueel-verborgen">Kerncijfers</h2>
    ${kpiBandDelta(dashboard, totaal, dagreeks, vergelijking, { grafiekId: 'simpel-trend-overzicht', actief: actiefMetriek })}
    <h2 class="visueel-verborgen">Verdeling en ontwikkeling</h2>
    <div class="dash-rij">
      <div class="dash-col" style="--span:5">
        ${figure('simpel-donut-split', 'Verdeling uitgaven', 'Aandeel van Meta en Google in het budget.', platformSplitTabel(platforms, rlabel), trendBron(platforms), 240)}
      </div>
      <div class="dash-col" style="--span:7">
        ${trendMetriekFiguur('simpel-trend-overzicht', platforms, { titel: 'Ontwikkeling per dag', dashboard, vergelijking, toonSwitcher: false, actief: actiefMetriek })}
      </div>
    </div>
    ${budgetTempoKaart(dashboard, platforms)}
    <section class="card">
      <h2>Top campagnes</h2>
      <p class="muted">De grootste campagnes ${kanalenZin(platforms)}.</p>
      <div class="table-scroll">${prestatieTabel(campagnes, rlabel, { metPlatform: true })}</div>
    </section>
    ${adInzichtenBlok(dashboard, platforms, vergelijking)}
  `;
}

/* ---------- View 2/3: Google Ads / Meta Ads ---------- */

function renderPlatformView(dashboard, blok, platforms, vergelijking) {
  if (!blok?.aanwezig) {
    const naam = blok?.label ?? 'Dit platform';
    return `
      ${simpelKop(naam, dashboard, platforms, { vergelijking })}
      <section class="card"><h2>Niet actief</h2>
        <p class="empty">Deze klant adverteert binnen de geselecteerde periode niet via ${esc(naam.toLowerCase())}.</p></section>`;
  }
  const rlabel = blok.resultLabel ?? 'Resultaat';
  const rl = rlabel.toLowerCase();
  const bd = blok.breakdowns ?? {};
  const enkelPlatform = { [blok.platform]: blok };
  const actiefMetriek = actieveTrendMetriek({ kaartKeys: kpiMetriekKeys(dashboard.model) });

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
    ${simpelKop(blok.label, dashboard, platforms, { vergelijking })}
    <h2 class="visueel-verborgen">Kerncijfers</h2>
    ${kpiBandDelta(dashboard, blok.totals, blok.series ?? [], vergelijking, { grafiekId: 'simpel-trend-platform', actief: actiefMetriek })}
    <h2 class="visueel-verborgen">Ontwikkeling per dag</h2>
    ${trendMetriekFiguur('simpel-trend-platform', enkelPlatform, { titel: 'Ontwikkeling per dag', dashboard, vergelijking, toonSwitcher: false, actief: actiefMetriek })}
    <section class="card">
      <h2>Campagnes</h2>
      ${interTabel('campagnes', blok.campaigns ?? [], {})}
    </section>
    ${adGroups}
    ${keywords}
    ${adSets}
    ${placements}
    ${adInzichtenBlok(dashboard, platforms, vergelijking, 1)}
  `;
}

/* ---------- View 4: Campagnes (alle, met platformfilter) ---------- */

function renderCampagnesView(dashboard, platforms, vergelijking) {
  const totaal = combineerTotalen(platforms);
  const rlabel = totaal?.resultLabel ?? 'Resultaat';
  const campagnes = alleCampagnes(platforms);
  const platformOpties = [{ key: 'alle', label: 'Alle' }];
  if (platforms.meta?.aanwezig) platformOpties.push({ key: 'meta', label: 'Meta Ads' });
  if (platforms.google?.aanwezig) platformOpties.push({ key: 'google', label: 'Google Ads' });
  // De platform-chips (en dus de 'filter'-belofte) hebben alleen zin bij >1 kanaal.
  const metFilter = platformOpties.length > 2;

  return `
    ${simpelKop('Campagnes', dashboard, platforms, { ondertitel: `${campagnes.length} campagnes`, vergelijking })}
    <section class="card">
      <div class="card-kop-rij">
        <p class="muted">Alle campagnes ${kanalenZin(platforms)} — sorteer, zoek${metFilter ? ', filter' : ''} of exporteer.</p>
        ${metFilter ? chips('campagnes-alle', platformOpties, 'alle') : ''}
      </div>
      ${interactieveTabel('campagnes-alle', prestatieKolommen(rlabel, { metPlatform: true }), campagnes, {
        csvNaam: 'campagnes', rijAttr: (c) => `data-platform="${esc(c.platform)}"`,
      })}
    </section>
  `;
}

/* ---------- View 5: Conversies ---------- */

function renderConversiesView(dashboard, platforms, vergelijking) {
  const totaal = combineerTotalen(platforms);
  const rlabel = totaal?.resultLabel ?? 'Resultaat';

  const perPlatform = tabel(
    ['Platform', getalKolom(rlabel), getalKolom(`Kosten/${rlabel.toLowerCase()}`), getalKolom('Conversie/klik'), getalKolom('Aandeel')],
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
    ${simpelKop('Conversies', dashboard, platforms, { vergelijking })}
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

function renderSegmentenView(dashboard, platforms, vergelijking) {
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
    ? figure('simpel-bar-weekdag', 'Dag van de week', 'Gemiddelde uitgaven per weekdag (per keer dat die dag in de periode viel).',
        tabel(['Dag', getalKolom('Gem. uitgaven'), getalKolom(rlabel), getalKolom(`Kosten/${rlabel.toLowerCase()}`)],
          seg.weekdagen.map((w) => [esc(w.name), w.gemPerDag == null ? '—' : fmt.euro(w.gemPerDag), fmt.getal(w.results), w.costPerResult == null ? '—' : fmt.euro2(w.costPerResult)])),
        'Meta Marketing API en Google Ads API', 260)
    : '';

  const leeg = (!seg.devices.length && !seg.regios.length && !seg.weekdagen.length)
    ? `<section class="card"><p class="empty">Er zijn voor deze klant geen segmentgegevens beschikbaar.</p></section>` : '';

  return `
    ${simpelKop('Segmenten', dashboard, platforms, { vergelijking })}
    <h2 class="visueel-verborgen">Segmentanalyse</h2>
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

function renderTrendsView(dashboard, platforms, vergelijking) {
  const totaal = combineerTotalen(platforms);
  const titel = vergelijking?.actief ? `Vergelijking met ${vergelijking.kort}` : 'Vergelijking met de vorige periode';
  const actiefMetriek = actieveTrendMetriek({ switcherOpties: trendMetrieken(platforms) });

  // "Gestapeld" en "Meta en Google" gelden alleen bij twee kanalen.
  const stapelKols = trendPlatforms(platforms);
  const stapelMeerdere = stapelKols.length > 1;
  const stapelTitel = `Uitgaven per dag${stapelMeerdere ? ' — gestapeld' : ''}`;
  const stapelSub = stapelMeerdere
    ? 'Meta en Google gestapeld, zodat het totale dagbudget zichtbaar is.'
    : `${stapelKols[0]?.label ?? 'Advertenties'} per dag.`;

  return `
    ${simpelKop('Trends', dashboard, platforms, { vergelijking })}
    <h2 class="visueel-verborgen">Ontwikkeling per dag</h2>
    ${trendMetriekFiguur('simpel-trend-trends', platforms, { titel: 'Ontwikkeling per dag', dashboard, vergelijking, toonSwitcher: true, actief: actiefMetriek })}
    <section class="card">
      <h2>${esc(stapelTitel)}</h2>
      <p class="muted">${esc(stapelSub)}</p>
      <div class="chart-canvas" style="height:260px"><canvas id="simpel-stacked-spend" role="img" aria-label="${esc(`${stapelTitel}. ${stapelSub} Zie de tabelweergave voor de cijfers per dag.`)}"></canvas></div>
      <details class="chart-table">
        <summary>Tabelweergave</summary>
        <div class="table-scroll">${trendMetriekTabel(platforms, 'spend', { dashboard })}</div>
      </details>
    </section>
    <section class="card">
      <h2>${esc(titel)}</h2>
      ${vergelijkingTabel(dashboard, totaal, vergelijking)}
    </section>
  `;
}

/* ---------- Rapportage: nette, meerdelige print/PDF-samenvatting ---------- */

/** De vervolgstappen voor de rapportage: de acties van de auto-inzichten, ontdubbeld. */
function simpelVervolgstappen(inzichten) {
  const alle = [...(inzichten?.primair ?? []), ...(inzichten?.aanvullend ?? [])];
  const stappen = [];
  const gezien = new Set();
  for (const i of alle) {
    const tekst = i?.actie?.trim();
    if (!tekst || gezien.has(tekst)) continue;
    gezien.add(tekst);
    stappen.push({ tekst, bron: i.titel ?? null });
  }
  return stappen;
}

/**
 * Een op zichzelf staande, print-/PDF-klare samenvatting van de pulse-data:
 * KPI's + deltas, de verdeling, de ontwikkeling, de auto-inzichten én de daaruit
 * afgeleide vervolgstappen. Hergebruikt de bestaande secties; de actiebalk valt
 * bij printen weg (data-print-verbergen), zodat alleen het rapport op papier komt.
 */
function renderSimpelRapportageView(dashboard, platforms, vergelijking) {
  const totaal = combineerTotalen(platforms);
  if (!totaal) return renderSimpelLeeg('Geen data om te rapporteren', 'Er zijn voor deze klant en periode geen Meta- of Google Ads-cijfers.');
  const rlabel = totaal.resultLabel ?? 'Resultaat';
  const dagreeks = gecombineerdeReeks(platforms);
  const inzichten = bouwAdInzichten(dashboard, platforms, vergelijking);
  const stappen = simpelVervolgstappen(inzichten);

  const periodeLabel = dashboard?.periode ? toonBereik(dashboard.periode.startDate, dashboard.periode.endDate) : '';
  const vergLabel = (vergelijking?.actief && vergelijking.startDate && vergelijking.endDate)
    ? `vergeleken met ${toonBereik(vergelijking.startDate, vergelijking.endDate)}`
    : '';

  const stappenBlok = stappen.length ? `
    <section class="simpel-rapport-sectie rapport-vervolg">
      <h2>Aanbevolen vervolgstappen</h2>
      <p class="muted klein">Automatisch afgeleid uit de inzichten hierboven.</p>
      <ol class="rapport-stappen">
        ${stappen.map((s) => `<li class="rapport-stap">
          <span class="rapport-stap-tekst">${esc(s.tekst)}</span>
          ${s.bron ? `<span class="rapport-stap-bron muted klein">Uit inzicht: ${esc(s.bron)}</span>` : ''}
        </li>`).join('')}
      </ol>
    </section>` : '';

  return `
    <div class="simpel-rapport-balk" data-print-verbergen>
      <a class="btn klein" href="#/pulse">← Terug naar het dashboard</a>
      <button type="button" class="btn primary" data-simpel-print>Download / printen (PDF)</button>
    </div>
    <article class="simpel-rapport">
      <header class="simpel-rapport-kop">
        <p class="simpel-rapport-merk">Aizy · Snel inzicht</p>
        <h1>Rapportage — Meta &amp; Google Ads</h1>
        <p class="muted">${esc(dashboard?.client?.name ?? '')}${periodeLabel ? ` · ${esc(periodeLabel)}` : ''}${vergLabel ? ` · ${esc(vergLabel)}` : ''}</p>
      </header>

      <section class="simpel-rapport-sectie">
        <h2>De cijfers</h2>
        ${kpiBandDelta(dashboard, totaal, dagreeks, vergelijking, { actief: null })}
      </section>

      <section class="simpel-rapport-sectie">
        <h2>Verdeling en ontwikkeling</h2>
        <div class="dash-rij">
          <div class="dash-col" style="--span:5">
            ${figure('simpel-rapport-donut', 'Verdeling uitgaven', 'Aandeel van Meta en Google in het budget.', platformSplitTabel(platforms, rlabel), trendBron(platforms), 220)}
          </div>
          <div class="dash-col" style="--span:7">
            ${trendMetriekFiguur('simpel-rapport-trend', platforms, { titel: 'Ontwikkeling per dag', dashboard, vergelijking, toonSwitcher: false, actief: 'spend', hint: false })}
          </div>
        </div>
      </section>

      <section class="simpel-rapport-sectie">
        <h2 class="visueel-verborgen">Inzichten</h2>
        ${adInzichtenBlok(dashboard, platforms, vergelijking)}
      </section>

      ${stappenBlok}

      <footer class="simpel-rapport-voet">
        <p class="muted klein">Samengesteld met Aizy Snel inzicht. De cijfers volgen de gekozen periode en kanalen; grafieken en tabellen komen uit dezelfde bron als het dashboard.${platforms?.demodata ? (aantalGekoppeld(dashboard?.client?.id) >= 2 ? ' Databronnen gekoppeld (demo) — de cijfers zijn in deze demo voorbeelddata.' : ' Demodata — koppel de Meta/Google-databronnen voor live cijfers.') : ''}</p>
      </footer>
    </article>
  `;
}

/* ---------- Vergelijkingstabel ---------- */

/**
 * Vergelijkt de huidige periode met de vorige, gescoped op de twee
 * advertentieplatforms (Meta + Google). De "deze periode"-waarden komen uit de
 * gecombineerde platformtotalen; de vorige periode + het verschil komen uit
 * `adDeltas` (ad-schaal, richting uit de metriek-catalogus).
 */
function vergelijkingTabel(dashboard, adTotalen, vergelijking = null) {
  const ad = adTotalen ?? {};
  const actief = vergelijking ? vergelijking.actief : true;
  const deltas = adDeltas(dashboard, ad, { vergelijkingActief: actief });
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
    const verschil = d && (d.status === 'gestegen' || d.status === 'gedaald' || d.status === 'gelijk')
      ? deltaPill(d)
      : '—';
    return [esc(r.label), nu == null ? '—' : r.fmt(nu), toen == null ? '—' : r.fmt(toen), verschil];
  });
  return `<div class="table-scroll">${tabel(['Metriek', getalKolom('Deze periode'), getalKolom('Vorige periode'), getalKolom('Verschil')], rijen)}</div>`;
}

/* ---------- Budget & tempo ---------- */

function budgetTempoKaart(dashboard, platforms) {
  const t = budgetTempo(dashboard, platforms);
  if (!t) return '';
  return `<section class="card budget-tempo">
    <h2>Budget &amp; tempo</h2>
    <div class="kpi-row">
      ${kpiKaartje('Uitgaven', fmt.euro(t.uitgaven), `over ${t.dagen} ${t.dagen === 1 ? 'dag' : 'dagen'}`)}
      ${kpiKaartje('Gemiddeld per dag', t.gemiddeldPerDag == null ? '—' : fmt.euro(t.gemiddeldPerDag), 'advertentiebudget')}
      ${t.drukste ? kpiKaartje('Drukste dag', `${t.drukste.name} (${fmt.euro(t.drukste.spend)})`, 'hoogste dagbudget') : ''}
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
function adInzichtenBlok(dashboard, platforms, vergelijking, max = 3) {
  const inzichten = bouwAdInzichten(dashboard, platforms, vergelijking);
  if (!inzichten.primair.length) return '';
  // Wat niet in 'primair' past, schuift door naar 'aanvullend' — nooit weggegooid.
  const primair = inzichten.primair.slice(0, max);
  const aanvullend = [...inzichten.primair.slice(max), ...inzichten.aanvullend];
  // Elke aanbevolen optimalisatie krijgt een "Oppakken"-knop of, als hij al wordt
  // bijgehouden, een statuschip (client-side; wijzigingen hertekenen via de store).
  const tracked = new Map(optimalisatiesVoor(dashboard?.client?.id).map((o) => [o.sleutel, o]));
  return renderInzichten(
    { primair, aanvullend },
    { titel: 'Wat valt op', toonAanvullend: true, slotVoor: (i) => trackControl(i, tracked) },
  );
}

/* ---------------------------------------------------------------
   Optimalisaties bijhouden
   --------------------------------------------------------------- */

const OPTIM_STATUS_META = {
  [OptimStatus.OPEN]: { label: 'Open', variant: 'muted' },
  [OptimStatus.BEZIG]: { label: 'Bezig', variant: 'middel' },
  [OptimStatus.AFGEROND]: { label: 'Afgerond', variant: 'ok' },
  [OptimStatus.NIET_NU]: { label: 'Niet nu', variant: 'muted' },
};
const OPTIM_STATUS_VOLGORDE = [OptimStatus.OPEN, OptimStatus.BEZIG, OptimStatus.AFGEROND, OptimStatus.NIET_NU];

/** De "Oppakken"-knop of statuschip onder een inzichtkaart (alleen trackbare inzichten). */
function trackControl(inzicht, trackedBySleutel) {
  if (!inzicht.sleutel || !inzicht.actie) return '';
  const bestaand = trackedBySleutel.get(inzicht.sleutel);
  if (bestaand) {
    const m = OPTIM_STATUS_META[bestaand.status] ?? OPTIM_STATUS_META[OptimStatus.OPEN];
    return `<div class="optim-slot is-getrackt">
      <span class="optim-slot-status">${badge(m.label, m.variant)}</span>
      <a class="link klein" href="#/pulse/optimalisaties">Beheer</a>
    </div>`;
  }
  return `<div class="optim-slot">
    <button type="button" class="btn klein" data-optim-oppak="${esc(inzicht.sleutel)}">Oppakken</button>
  </div>`;
}

/** Eén statuskiezer (segmented) voor een bijgehouden optimalisatie. */
function optimStatusKiezer(o) {
  return `<div class="optim-status" role="group" aria-label="Status">
    ${OPTIM_STATUS_VOLGORDE.map((s) => `<button type="button" class="optim-status-knop${o.status === s ? ' actief' : ''}" aria-pressed="${o.status === s}" data-optim-status="${esc(o.id)}:${esc(s)}">${esc(OPTIM_STATUS_META[s].label)}</button>`).join('')}
  </div>`;
}

/** Eén bijgehouden optimalisatie als rij. */
function optimRij(o) {
  const cat = o.categorie ? inzichtCategorieTerm(o.categorie) : null;
  const datum = o.aangemaaktOp ? toonDatum(String(o.aangemaaktOp).slice(0, 10)) : '';
  return `<article class="optim-rij" data-status="${esc(o.status)}">
    <div class="optim-rij-kop">
      ${cat ? badge(cat.kort, cat.variant ?? 'muted') : ''}
      ${datum ? `<span class="muted klein">Op je lijst sinds ${esc(datum)}</span>` : ''}
    </div>
    <h3 class="optim-rij-titel">${esc(o.titel)}</h3>
    ${o.actie ? `<p class="optim-rij-actie">${esc(o.actie)}</p>` : ''}
    <div class="optim-rij-voet">
      ${optimStatusKiezer(o)}
      <button type="button" class="link klein gevaar" data-optim-verwijder="${esc(o.id)}">Verwijderen</button>
    </div>
  </article>`;
}

/** Eén nog-niet-opgepakte aanbeveling als rij, met een "Oppakken"-knop. */
function aanbevelingRij(i) {
  const cat = i.categorie ? inzichtCategorieTerm(i.categorie) : null;
  return `<article class="optim-rij is-aanbeveling" data-categorie="${esc(i.categorie ?? '')}">
    <div class="optim-rij-kop">
      ${cat ? badge(cat.kort, cat.variant ?? 'muted') : ''}
    </div>
    <h3 class="optim-rij-titel">${esc(i.titel)}</h3>
    ${i.actie ? `<p class="optim-rij-actie">${esc(i.actie)}</p>` : ''}
    <div class="optim-rij-voet">
      <button type="button" class="btn klein primary" data-optim-oppak="${esc(i.sleutel)}">Oppakken</button>
    </div>
  </article>`;
}

/**
 * De Optimalisaties-pagina: een samenvatting, jouw bijgehouden optimalisaties met
 * hun status, en de aanbevelingen uit de inzichten die je nog niet hebt opgepakt.
 */
function renderOptimalisatiesView(dashboard, platforms, vergelijking) {
  const clientId = dashboard?.client?.id;
  const getrackt = optimalisatiesVoor(clientId);
  const trackedSleutels = new Set(getrackt.map((o) => o.sleutel));

  const inzichten = bouwAdInzichten(dashboard, platforms, vergelijking);
  const aanbevelingen = [...inzichten.primair, ...inzichten.aanvullend].filter((i) => i.sleutel && i.actie);
  const nieuw = aanbevelingen.filter((i) => !trackedSleutels.has(i.sleutel));

  // Op status sorteren (open/bezig eerst), daarbinnen nieuwste eerst.
  const rang = { [OptimStatus.OPEN]: 0, [OptimStatus.BEZIG]: 1, [OptimStatus.AFGEROND]: 2, [OptimStatus.NIET_NU]: 3 };
  const gesorteerd = [...getrackt].sort((a, b) =>
    (rang[a.status] ?? 9) - (rang[b.status] ?? 9) || String(b.aangemaaktOp).localeCompare(String(a.aangemaaktOp)));

  const telling = OPTIM_STATUS_VOLGORDE.map((s) => ({ s, n: getrackt.filter((o) => o.status === s).length }));
  const samenvatting = getrackt.length
    ? `<div class="optim-samenvatting">${telling.map(({ s, n }) => `<span class="optim-telling" data-status="${esc(s)}">${badge(String(n), OPTIM_STATUS_META[s].variant)} ${esc(OPTIM_STATUS_META[s].label)}</span>`).join('')}</div>`
    : '';

  return `
    ${simpelKop('Optimalisaties', dashboard, platforms, { vergelijking, ondertitel: `${getrackt.length} bijgehouden` })}
    <p class="muted optim-intro">Houd bij welke aanbevolen optimalisaties je oppakt en volg hun status — puur voor jou, per klant bewaard.</p>
    ${samenvatting}

    <section class="card">
      <h2>Jouw optimalisaties</h2>
      ${getrackt.length
        ? `<div class="optim-lijst">${gesorteerd.map(optimRij).join('')}</div>`
        : '<p class="empty">Je houdt nog geen optimalisaties bij. Pak er hieronder een op, of gebruik de "Oppakken"-knop bij "Wat valt op".</p>'}
    </section>

    <section class="card">
      <h2>Aanbevolen om op te pakken</h2>
      ${nieuw.length
        ? `<div class="optim-lijst">${nieuw.map(aanbevelingRij).join('')}</div>`
        : `<p class="empty">${aanbevelingen.length ? 'Alle huidige aanbevelingen staan al op je lijst.' : 'Er zijn nu geen aanbevolen optimalisaties voor deze klant en periode.'}</p>`}
    </section>
  `;
}

/* ---------------------------------------------------------------
   Databronnen (gesimuleerde koppeling — demolaag)
   --------------------------------------------------------------- */

const BRON_META = {
  meta: { label: 'Meta Ads', bron: 'Meta', detail: 'Facebook- en Instagram-advertenties' },
  google: { label: 'Google Ads', bron: 'Google', detail: 'Zoek-, display- en YouTube-advertenties' },
};

/**
 * Eén platformkaart met de (demo-)koppelstatus. Niet gekoppeld toont een
 * "Koppelen"-knop die een inline bevestigstap (OAuth-simulatie) onthult;
 * gekoppeld toont een eerlijk gelabelde demostatus + "Ontkoppelen".
 */
function databronKaart(platform, status) {
  const m = BRON_META[platform];
  const gekoppeld = status === BronStatus.GEKOPPELD;
  return `<div class="koppelstatus databron-kaart" data-status="${gekoppeld ? 'gekoppeld' : 'niet_gekoppeld'}">
    <div class="koppelstatus-kop">
      <strong>${esc(m.label)}</strong>
      ${gekoppeld ? badge('Gekoppeld (demo)', 'ok') : badge('Demodata', 'muted')}
    </div>
    <p class="muted klein">${esc(m.detail)}</p>
    ${gekoppeld
      ? `<p class="muted">In productie stromen de cijfers rechtstreeks uit ${esc(m.bron)} via de API. In deze demo blijven het voorbeeldcijfers.</p>
         <button type="button" class="btn klein" data-databron-ontkoppel="${platform}">Ontkoppelen</button>`
      : `<p class="muted">De ${esc(m.label)}-cijfers zijn nu voorbeelddata. In productie levert een koppeling live cijfers; in deze demo simuleren we alleen de koppeling — de cijfers blijven voorbeelddata.</p>
         <button type="button" class="btn klein primary" data-databron-koppel="${platform}">Koppelen</button>
         <div class="databron-bevestig" tabindex="-1" hidden>
           <p class="muted klein">Geef Aizy toegang tot je ${esc(m.bron)}-advertentieaccount. Dit is een demo-simulatie — er wordt geen echte verbinding gemaakt en de cijfers blijven voorbeelddata.</p>
           <div class="databron-bevestig-acties">
             <button type="button" class="btn klein primary" data-databron-bevestig="${platform}">Toegang verlenen</button>
             <button type="button" class="btn klein" data-databron-annuleer>Annuleren</button>
           </div>
         </div>`}
  </div>`;
}

function renderDatabronnenView(dashboard) {
  const clientId = dashboard?.client?.id;
  const k = koppelingVoor(clientId);
  const aantal = clientId ? aantalGekoppeld(clientId) : 0;
  return `
    ${simpelKop('Databronnen', dashboard, null, { ondertitel: `${aantal} van 2 gekoppeld` })}
    <p class="muted optim-intro">Koppel je advertentieaccounts zodat het dashboard live cijfers toont in plaats van demodata. In deze demo simuleren we de koppeling: de cijfers blijven voorbeelddata en zijn overal als zodanig gemarkeerd. Dit is precies de plek waar in productie de Meta- en Google-API's aansluiten.</p>
    <section class="card">
      <div class="koppelstatus-grid databronnen-grid">
        ${databronKaart('meta', k.meta)}
        ${databronKaart('google', k.google)}
      </div>
    </section>`;
}

/* ---------------------------------------------------------------
   Grafieken (na render tekenen) — per view
   --------------------------------------------------------------- */

/**
 * Leest de actieve metriek uit de DOM (default spend). Op Trends is dat de
 * gemarkeerde switcher-knop; op het overzicht/platform de gemarkeerde KPI-kaart.
 */
function actieveMetriek(grafiekId) {
  const bron = document.querySelector(`.metric-switch-knop.actief[data-simpel-metric^="${grafiekId}:"]`)
    ?? document.querySelector(`.simpel-kpi .kpi.is-actief[data-simpel-metric^="${grafiekId}:"]`);
  const waarde = bron?.dataset.simpelMetric?.split(':')[1];
  return TREND_META[waarde] ? waarde : 'spend';
}

export function drawSimpelCharts({ dashboard, platforms, view = 'simpel-overzicht', vergelijking = null }) {
  if (!platforms) return;
  const meta = platforms.meta;
  const google = platforms.google;
  const trendOpts = { dashboard, vergelijking };

  if (view === 'simpel-overzicht') {
    tekenTrendMetriek('simpel-trend-overzicht', platforms, actieveMetriek('simpel-trend-overzicht'), trendOpts);
    tekenSplitDonut('simpel-donut-split', meta, google);
  } else if (view === 'simpel-google' || view === 'simpel-meta') {
    const blok = view === 'simpel-google' ? google : meta;
    if (blok?.aanwezig) {
      tekenTrendMetriek('simpel-trend-platform', { [blok.platform]: blok }, actieveMetriek('simpel-trend-platform'), trendOpts);
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
        series: [{ label: 'Gem. uitgaven', data: seg.weekdagen.map((w) => w.gemPerDag ?? 0) }],
        valueFormatter: (v) => fmt.euro(v),
      });
    }
  } else if (view === 'simpel-trends') {
    tekenTrendMetriek('simpel-trend-trends', platforms, actieveMetriek('simpel-trend-trends'), trendOpts);
    tekenStackedSpend('simpel-stacked-spend', meta, google);
  } else if (view === 'simpel-rapportage') {
    tekenTrendMetriek('simpel-rapport-trend', platforms, 'spend', trendOpts);
    tekenSplitDonut('simpel-rapport-donut', meta, google);
  }
}

/**
 * Herteken de trendgrafiek voor een gekozen metriek. De keuze komt van een
 * KPI-kaart (overzicht/platform) of de segmented control (Trends); beide markeren
 * we hier consistent, plus de tabel, ondertitel en grafiek.
 */
export function zetTrendMetriek(platforms, grafiekId, metricKey, { dashboard = null, vergelijking = null } = {}) {
  const key = TREND_META[metricKey] ? metricKey : 'spend';
  // Segmented control (Trends): actieve knop markeren.
  document.querySelectorAll(`.metric-switch-knop[data-simpel-metric^="${grafiekId}:"]`).forEach((b) => {
    const actief = b.dataset.simpelMetric === `${grafiekId}:${key}`;
    b.classList.toggle('actief', actief);
    b.setAttribute('aria-pressed', actief ? 'true' : 'false');
  });
  // Klikbare KPI-kaarten (overzicht/platform): de gekozen kaart markeren.
  const kpis = document.querySelectorAll(`.simpel-kpi .kpi[data-simpel-metric^="${grafiekId}:"]`);
  kpis.forEach((k) => {
    const actief = k.dataset.simpelMetric === `${grafiekId}:${key}`;
    k.classList.toggle('is-actief', actief);
    k.setAttribute('aria-pressed', actief ? 'true' : 'false');
  });
  const canvas = document.getElementById(grafiekId);
  const fig = canvas?.closest('.chart-figure');
  const rlabel = platforms.meta?.resultLabel ?? platforms.google?.resultLabel ?? 'Resultaat';
  const tabelHouder = fig?.querySelector('.chart-table .table-scroll');
  if (tabelHouder) tabelHouder.innerHTML = trendMetriekTabel(platforms, key, { dashboard, vergelijking });
  // Ondertitel volgt de metriek; de KPI-hint alleen tonen waar KPI's klikbaar zijn.
  const onder = fig?.querySelector('figcaption p.muted');
  if (onder) {
    onder.textContent = trendOndertitel(key, rlabel, { hint: kpis.length > 0, vergelijking, platforms });
  }
  const bron = fig?.querySelector('.chart-source');
  if (bron) bron.textContent = `Bron: ${trendBron(platforms)}`;
  // Kondig de wissel aan voor schermlezers (de grafiek zelf is geen tekst).
  const live = fig?.closest('.trend-blok')?.querySelector('[data-trend-live]');
  if (live) live.textContent = `Grafiek toont nu ${trendSubtitel(key, rlabel, { hint: false })}.`;
  tekenTrendMetriek(grafiekId, platforms, key, { dashboard, vergelijking });
}

function tekenTrendMetriek(canvasId, platforms, metricKey, { dashboard = null, vergelijking = null } = {}) {
  const m = TREND_META[metricKey] ?? TREND_META.spend;
  const basis = reeksAs(platforms.meta, platforms.google);
  if (!basis.length) return;
  const kols = trendPlatforms(platforms);
  const series = kols.map((k) => ({ label: k.label, data: k.blok.series.map(m.getVal), kleurIndex: k.kleurIndex }));
  // Per platform een gestippelde 'vorige periode'-lijn in dezelfde kleur.
  if (vergelijkingActief(vergelijking)) {
    kols.forEach((k) => {
      const ov = platformOverlay(dashboard, k.blok, metricKey);
      if (ov) series.push({ label: `${k.label.replace(' Ads', '')} · vorige`, data: ov, kleurIndex: k.kleurIndex, dash: [5, 4], dun: true });
    });
  }
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
