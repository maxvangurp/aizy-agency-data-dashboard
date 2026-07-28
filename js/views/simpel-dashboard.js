/**
 * Het simpele, datagerichte Meta & Google Ads-dashboard (modus 'simpel').
 *
 * Een bewust uitgeklede ervaring: een lichte topbar en één scroll met de
 * cijfers die ertoe doen — voor wie het volledige systeem te veel vindt. De
 * data komt via de data-provider-seam (zie `js/data/ads-data.js`), nu uit
 * sample-data, later live uit de Meta/Google API's.
 *
 * `renderSimpelLayout` rendert de eigen layout (níet de volledige app-shell).
 * De inhoud laadt async: eerst een laadstaat, dan `renderSimpelInhoud`.
 */

import { fmt, esc, tabel, figure, getalKolom, badge, kpi } from './components.js';
import { renderInzichtkaart } from './insight-cards.js';
import { combineerTotalen, alleCampagnes } from '../data/ads-data.js';
import { lineChart, barChart } from '../charts.js';
import { PERIODE_PRESETS, toonBereik, toonKorteDatum } from '../filters/period.js';

/* ---------------------------------------------------------------
   Layout: lichte topbar + inhoud
   --------------------------------------------------------------- */

export function renderSimpelLayout({ user, dashboard, klanten = [], filters, platforms = null, magWisselen = false }) {
  return `
    <div class="simpel-app">
      ${renderSimpelTopbar({ user, dashboard, klanten, filters, magWisselen })}
      <main class="simpel-main">
        <div class="page-root simpel-root" id="simpelInhoud">
          ${platforms ? renderSimpelInhoud({ dashboard, platforms }) : renderSimpelLaden()}
        </div>
      </main>
    </div>`;
}

function renderSimpelTopbar({ user, dashboard, klanten, filters, magWisselen }) {
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
    <div class="simpel-merk">
      <span class="simpel-merk-naam">Aizy</span>
      <span class="simpel-merk-sub">Snel inzicht</span>
    </div>
    <div class="simpel-topbar-midden">
      ${klantKiezer}
      <label class="simpel-kiezer">
        <span class="visueel-verborgen">Periode</span>
        <select id="filterPeriode">
          ${PERIODE_PRESETS.map((p) => `<option value="${esc(p.key)}"${periode.preset === p.key ? ' selected' : ''}>${esc(p.label)}</option>`).join('')}
        </select>
      </label>
    </div>
    <div class="simpel-topbar-rechts">
      <button type="button" class="btn klein" data-naar-modus="uitgebreid">Volledig systeem</button>
      <button type="button" class="btn klein" id="menuUitloggen">Uitloggen</button>
    </div>
  </header>`;
}

function renderSimpelLaden() {
  return `<div class="simpel-laden" aria-live="polite">
    <p class="muted">Cijfers laden…</p>
  </div>`;
}

/* ---------------------------------------------------------------
   Inhoud: KPI's, platformsplitsing, trend, campagnes, inzichten
   --------------------------------------------------------------- */

export function renderSimpelInhoud({ dashboard, platforms }) {
  if (!platforms || (!platforms.meta?.aanwezig && !platforms.google?.aanwezig)) {
    return `<section class="card"><h2>Geen advertentiedata</h2>
      <p class="empty">Er zijn voor deze klant en periode geen Meta- of Google Ads-cijfers.</p></section>`;
  }

  const totaal = combineerTotalen(platforms);
  const rlabel = totaal?.resultLabel ?? 'Resultaat';
  const periodeLabel = dashboard?.periode
    ? toonBereik(dashboard.periode.startDate, dashboard.periode.endDate)
    : '';

  return `
    <div class="simpel-kop">
      <h1>Meta &amp; Google Ads</h1>
      <p class="muted">${esc(dashboard?.client?.name ?? '')}${periodeLabel ? ` · ${esc(periodeLabel)}` : ''}</p>
      ${platforms.demodata ? `<p class="simpel-databron">${badge('Demodata', 'muted')} <span class="muted klein">Sluit de Meta/Google API's aan voor live cijfers.</span></p>` : ''}
    </div>

    <div class="kpi-row simpel-kpi">
      ${kpi('Uitgaven', fmt.euro(totaal.spend), 'totaal over beide platforms', 'neutraal', { primair: true })}
      ${kpi('Vertoningen', fmt.getal(totaal.impressions), 'keer getoond')}
      ${kpi('Klikken', fmt.getal(totaal.clicks), `CTR ${totaal.ctr == null ? '—' : fmt.procent(totaal.ctr)}`)}
      ${kpi('Kosten per klik', totaal.cpc == null ? 'Niet te berekenen' : fmt.euro2(totaal.cpc), 'gemiddelde CPC')}
      ${kpi(rlabel, fmt.getal(totaal.results), 'geregistreerde conversies')}
      ${kpi(`Kosten per ${rlabel.toLowerCase()}`, totaal.costPerResult == null ? 'Niet te berekenen' : fmt.euro2(totaal.costPerResult), 'gemiddeld')}
    </div>

    ${renderSplitEnTrend({ dashboard, platforms, rlabel })}
    ${renderCampagneTabel({ platforms, rlabel })}
    ${renderSimpelInzichten(dashboard)}
  `;
}

function renderSplitEnTrend({ dashboard, platforms, rlabel }) {
  const rijen = ['meta', 'google']
    .map((k) => platforms[k])
    .filter((b) => b?.aanwezig)
    .map((b) => [
      esc(b.label),
      fmt.euro(b.totals.spend),
      fmt.getal(b.totals.clicks),
      b.totals.ctr == null ? '—' : fmt.procent(b.totals.ctr),
      fmt.getal(b.totals.results),
      b.totals.costPerResult == null ? '—' : fmt.euro2(b.totals.costPerResult),
    ]);
  const splitTabel = tabel(
    ['Platform', getalKolom('Uitgaven'), getalKolom('Klikken'), getalKolom('CTR'), getalKolom(rlabel), getalKolom(`Kosten/${rlabel.toLowerCase()}`)],
    rijen,
  );

  const trendTabel = tabel(
    ['Datum', getalKolom('Meta'), getalKolom('Google')],
    (platforms.meta?.series ?? platforms.google?.series ?? []).map((p, i) => [
      esc(toonKorteDatum(p.date)),
      fmt.euro(platforms.meta?.series?.[i]?.spend ?? 0),
      fmt.euro(platforms.google?.series?.[i]?.spend ?? 0),
    ]),
  );

  return `<div class="dash-rij">
    <div class="dash-col" style="--span:5">
      <section class="card">
        <h2>Meta vs Google</h2>
        <div class="chart-canvas" style="height:220px"><canvas id="simpel-chart-split"></canvas></div>
        <div class="table-scroll">${splitTabel}</div>
      </section>
    </div>
    <div class="dash-col" style="--span:7">
      ${figure('simpel-chart-trend', 'Uitgaven per dag', 'Het bestede budget per platform binnen de periode.', trendTabel, 'Meta Marketing API en Google Ads API', 260)}
    </div>
  </div>`;
}

function renderCampagneTabel({ platforms, rlabel }) {
  const campagnes = alleCampagnes(platforms).slice(0, 12);
  if (!campagnes.length) return '';
  const tabelHtml = tabel(
    ['Campagne', 'Platform', getalKolom('Uitgaven'), getalKolom('Klikken'), getalKolom('CTR'), getalKolom(rlabel), getalKolom(`Kosten/${rlabel.toLowerCase()}`)],
    campagnes.map((c) => [
      esc(c.name),
      badge(c.platform, 'muted'),
      fmt.euro(c.spend),
      fmt.getal(c.clicks),
      c.ctr == null ? '—' : fmt.procent(c.ctr),
      fmt.getal(c.results),
      c.costPerResult == null ? '—' : fmt.euro2(c.costPerResult),
    ]),
  );
  return `<section class="card">
    <h2>Campagnes</h2>
    <p class="muted">De campagnes over beide platforms, gesorteerd op uitgaven.</p>
    <div class="table-scroll">${tabelHtml}</div>
  </section>`;
}

function renderSimpelInzichten(dashboard) {
  const primair = (dashboard?.inzichten?.primair ?? []).slice(0, 2);
  if (!primair.length) return '';
  return `<section class="inzichten-blok">
    <h2 class="sectie-titel">Wat opvalt</h2>
    <div class="inzicht-grid">
      ${primair.map((i, idx) => renderInzichtkaart(i, { dominant: idx === 0 })).join('')}
    </div>
  </section>`;
}

/* ---------------------------------------------------------------
   Grafieken (na render tekenen)
   --------------------------------------------------------------- */

export function drawSimpelCharts({ platforms }) {
  if (!platforms) return;
  const meta = platforms.meta;
  const google = platforms.google;

  const punten = (meta?.series?.length ? meta.series : google?.series) ?? [];
  if (punten.length) {
    const series = [];
    if (meta?.aanwezig) series.push({ label: 'Meta Ads', data: meta.series.map((p) => p.spend) });
    if (google?.aanwezig) series.push({ label: 'Google Ads', data: google.series.map((p) => p.spend) });
    lineChart('simpel-chart-trend', {
      labels: punten.map((p) => toonKorteDatum(p.date)),
      series,
      valueFormatter: (v) => fmt.euro(v),
    });
  }

  const labels = [];
  const spendData = [];
  for (const b of [meta, google]) {
    if (b?.aanwezig) { labels.push(b.label); spendData.push(b.totals.spend); }
  }
  if (labels.length) {
    barChart('simpel-chart-split', {
      labels,
      series: [{ label: 'Uitgaven', data: spendData }],
      valueFormatter: (v) => fmt.euro(v),
    });
  }
}
