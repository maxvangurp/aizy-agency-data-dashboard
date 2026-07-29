/**
 * Lichte, herbruikbare widgets voor het simpele Meta/Google Ads-dashboard.
 *
 * Bewust minimaal en client-side: een KPI-kaart met vergelijking + sparkline,
 * een sparkline (inline SVG), een segmented control (metric-switcher), filter-
 * chips en een lichte interactieve tabel (sorteren op kolomkop, zoeken, CSV).
 * Géén afhankelijkheid van het zware full-system datagrid — dat past niet bij de
 * bewust-lichte identiteit van deze modus.
 *
 * De interactieve tabel legt haar gedrag vast via data-attributen; de handlers
 * staan in de globale delegatie in app.js (net als de klant-/periodekiezer).
 */

import { esc } from './components.js';

/* ---------------------------------------------------------------
   Sparkline (inline SVG)
   --------------------------------------------------------------- */

/**
 * Kleine trendlijn zonder assen, thema-aware via `currentColor`. Geeft een lege
 * string terug bij te weinig punten, zodat de KPI zonder sparkline netjes blijft.
 */
export function sparkline(data, { breedte = 104, hoogte = 28 } = {}) {
  const punten = (data ?? []).filter((v) => v != null && !Number.isNaN(v));
  if (punten.length < 2) return '';
  const max = Math.max(...punten);
  const min = Math.min(...punten);
  const span = max - min || 1;
  const stap = breedte / (punten.length - 1);
  const coords = punten.map((v, i) => `${(i * stap).toFixed(1)},${(hoogte - ((v - min) / span) * hoogte).toFixed(1)}`);
  return `<svg class="sparkline" viewBox="0 0 ${breedte} ${hoogte}" width="${breedte}" height="${hoogte}" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <polyline points="${coords.join(' ')}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />
  </svg>`;
}

/* ---------------------------------------------------------------
   KPI met vergelijking + sparkline
   --------------------------------------------------------------- */

/**
 * KPI-kaart met een verandering t.o.v. de vorige periode en een sparkline.
 * Spiegelt de markup van `kpi()` (article.card.kpi > label/value/sub) zodat de
 * bestaande KPI-styling geldt; voegt een sparkline toe.
 *
 * @param {string} label
 * @param {string} waarde   al opgemaakte waarde
 * @param {object} delta     resultaat van berekenDelta (of null)
 * @param {{sub?: string, sparkData?: number[], primair?: boolean, tip?: string}} opties
 */
export function kpiDelta(label, waarde, delta, { sparkData = null, primair = false, tip = null } = {}) {
  const richting = delta?.richting ?? 'neutraal';
  // De sparkline-houder staat er altijd (ook leeg), zodat alle kaarten even hoog zijn.
  const spark = `<div class="kpi-spark trend-${esc(richting)}">${sparkData ? sparkline(sparkData) : ''}</div>`;
  const tipAttr = tip ? ` data-tip="${esc(tip)}" tabindex="0"` : '';
  return `<article class="card kpi kpi-delta${primair ? ' kpi-primair' : ''}" data-label="${esc(label)}">
    <span class="kpi-label"${tipAttr}>${esc(label)}${tip ? ' <span class="kpi-info" aria-hidden="true">i</span>' : ''}</span>
    <span class="kpi-value">${esc(waarde)}</span>
    ${deltaPill(delta)}
    ${spark}
  </article>`;
}

/**
 * Compacte, gekleurde verandering-pill: ▲/▼ + percentage. De pijl volgt de
 * werkelijke richting (omhoog/omlaag); de kleur volgt de betekenis (`richting` —
 * een dalende CPC is groen). De vergelijkingsperiode staat al in de kop, dus die
 * herhalen we hier niet. Zonder bruikbare vergelijking blijft de plek leeg (maar
 * gereserveerd), zodat de kaarthoogte gelijk blijft.
 */
export function deltaPill(delta) {
  if (delta && (delta.status === 'gestegen' || delta.status === 'gedaald')) {
    const pijl = (delta.procent ?? 0) > 0 ? '▲' : '▼';
    return `<span class="kpi-delta-pill trend-${esc(delta.richting ?? 'neutraal')}"><span class="kpi-delta-pijl" aria-hidden="true">${pijl}</span>${Math.abs(delta.procent).toFixed(1)}%</span>`;
  }
  if (delta && delta.status === 'gelijk') {
    return '<span class="kpi-delta-pill trend-neutraal">gelijk</span>';
  }
  return '<span class="kpi-delta-pill is-leeg" aria-hidden="true"></span>';
}

/* ---------------------------------------------------------------
   Segmented control (metric-switcher)
   --------------------------------------------------------------- */

/**
 * Segmented control dat de actieve metriek van een grafiek kiest. De klik wordt
 * afgehandeld in app.js (`data-simpel-metric="<grafiekId>:<metriekKey>"`), die
 * alleen die grafiek + tabelweergave opnieuw tekent.
 */
export function metricSwitcher(grafiekId, opties, actief) {
  return `<div class="metric-switch" role="group" aria-label="Kies metriek voor de grafiek">
    ${opties.map((o) => `<button type="button" class="metric-switch-knop${o.key === actief ? ' actief' : ''}" aria-pressed="${o.key === actief}" data-simpel-metric="${esc(grafiekId)}:${esc(o.key)}">${esc(o.label)}</button>`).join('')}
  </div>`;
}

/* ---------------------------------------------------------------
   Filter-chips (bijv. Alle / Meta / Google)
   --------------------------------------------------------------- */

export function chips(groep, opties, actief) {
  return `<div class="chip-rij" role="group" aria-label="Filter">
    ${opties.map((o) => `<button type="button" class="chip${o.key === actief ? ' actief' : ''}" aria-pressed="${o.key === actief}" data-simpel-filter="${esc(groep)}:${esc(o.key)}">${esc(o.label)}</button>`).join('')}
  </div>`;
}

/* ---------------------------------------------------------------
   Lichte interactieve tabel: sorteren + zoeken + CSV
   --------------------------------------------------------------- */

/**
 * Interactieve tabel. Sorteren op kolomkop-klik, optioneel zoekveld en
 * CSV-export — allemaal client-side, afgehandeld via delegatie in app.js.
 *
 * @param {string} id
 * @param {{label:string, uitlijn?:'rechts', type?:'num'|'txt', cel:(rij)=>string, waarde:(rij)=>(string|number|null)}[]} kolommen
 * @param {object[]} rijen
 * @param {{zoek?:boolean, exporteer?:boolean, zoekVeld?:(rij)=>string, csvNaam?:string, leegTekst?:string}} opties
 */
export function interactieveTabel(id, kolommen, rijen, {
  zoek = true, exporteer = true, zoekVeld = null, csvNaam = 'export', leegTekst = 'Geen gegevens beschikbaar.', rijAttr = null,
} = {}) {
  const zoekTekst = zoekVeld ?? ((rij) => kolommen.map((k) => k.waarde(rij)).filter((v) => v != null).join(' '));

  const toolbar = (zoek || exporteer) ? `<div class="ia-toolbar">
    ${zoek ? `<label class="ia-zoek-veld"><span class="visueel-verborgen">Zoeken</span>
      <input type="search" class="ia-zoek" data-ia-zoek="${esc(id)}" placeholder="Zoeken…" autocomplete="off"></label>` : ''}
    ${exporteer ? `<button type="button" class="btn klein ia-export" data-ia-export="${esc(id)}" data-csv-naam="${esc(csvNaam)}">Exporteer CSV</button>` : ''}
  </div>` : '';

  if (!rijen.length) {
    // Geen rijen: geen toolbar (zoeken/exporteren zou inert zijn).
    return `<div class="ia-tabel" id="${esc(id)}"><p class="empty">${esc(leegTekst)}</p></div>`;
  }

  const kop = kolommen.map((k, i) => {
    const kls = k.uitlijn === 'rechts' ? ' class="uitlijn-rechts"' : '';
    const type = k.type ?? (k.uitlijn === 'rechts' ? 'num' : 'txt');
    return `<th scope="col"${kls}>
      <button type="button" class="ia-sort" data-ia-sort="${esc(id)}:${i}" data-type="${type}" aria-label="Sorteer op ${esc(k.label)}">
        ${esc(k.label)}<span class="ia-sort-pijl" aria-hidden="true"></span>
      </button></th>`;
  }).join('');

  const body = rijen.map((rij) => {
    const zoekStr = String(zoekTekst(rij) ?? '').toLowerCase();
    const extra = rijAttr ? ` ${rijAttr(rij)}` : '';
    const cellen = kolommen.map((k) => {
      const kls = k.uitlijn === 'rechts' ? ' class="uitlijn-rechts"' : '';
      const raw = k.waarde(rij);
      return `<td${kls} data-v="${esc(raw == null ? '' : raw)}">${k.cel(rij)}</td>`;
    }).join('');
    return `<tr data-zoek="${esc(zoekStr)}"${extra}>${cellen}</tr>`;
  }).join('');

  return `<div class="ia-tabel" id="${esc(id)}">
    ${toolbar}
    <div class="table-scroll">
      <table class="ia-table" data-ia-table="${esc(id)}">
        <thead><tr>${kop}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>
    <p class="ia-leeg empty" hidden>Geen resultaten voor deze zoekopdracht.</p>
  </div>`;
}
