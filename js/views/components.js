/**
 * Gedeelde presentatiecomponenten en formatters.
 *
 * Zowel het e-commerce- als het leadgeneratiedashboard gebruiken deze bouwstenen,
 * zodat een KPI-kaart, een grafiekfiguur en een doelbalk overal hetzelfde
 * gedrag en dezelfde opmaak hebben.
 *
 * Alle kleuren komen uit de centrale thema-tokens in styles.css. Er staan hier
 * geen vaste kleurwaarden.
 */

const nf = new Intl.NumberFormat('nl-NL');
const cf0 = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const cf2 = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Opmaak van waarden.
 *
 * Ontbrekende waarden worden expliciet benoemd. Een leeg streepje zou als
 * een gemeten nul kunnen worden gelezen, en dat is iets anders.
 */
export const fmt = {
  getal: (v) => (v == null ? 'Niet beschikbaar' : nf.format(Math.round(v))),
  euro: (v) => (v == null ? 'Niet beschikbaar' : cf0.format(v)),
  euro2: (v) => (v == null ? 'Niet beschikbaar' : cf2.format(v)),
  ratio: (v) => (v == null ? 'Niet beschikbaar' : `${v.toFixed(2)}×`),
  procent: (v) => (v == null ? 'Niet beschikbaar' : `${v.toFixed(1)}%`),
  /** Seconden naar mm:ss, zoals GA4 de sessieduur toont. */
  duur: (sec) => {
    if (sec == null) return 'Niet beschikbaar';
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  },
};

export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

/**
 * KPI's waarbij een lagere waarde beter is. Wordt gebruikt om de richting van
 * een verandering te bepalen, zodat een dalende CPL groen is en niet rood.
 */
export const LAGER_IS_BETER = new Set([
  'cpa', 'cpl', 'cpql', 'cpc', 'cpm', 'kostenPerLead',
  'kostenPerGekwalificeerdeLead', 'frequentie', 'gemPositie',
]);

/** Verschil tussen twee waarden, met richting. */
export function delta(actueel, vorig, lagerIsBeter = false) {
  if (actueel == null || vorig == null || vorig === 0) {
    return { tekst: 'Niet beschikbaar', richting: 'neutraal', pct: null };
  }
  const pct = ((actueel - vorig) / vorig) * 100;
  const positief = lagerIsBeter ? pct < 0 : pct > 0;
  return {
    tekst: `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`,
    richting: Math.abs(pct) < 0.5 ? 'neutraal' : positief ? 'positief' : 'negatief',
    pct,
  };
}

/** KPI-kaart. */
export function kpi(label, waarde, sub = '', richting = 'neutraal') {
  return `<article class="card kpi">
    <span class="kpi-label">${esc(label)}</span>
    <span class="kpi-value">${esc(waarde)}</span>
    <span class="kpi-sub trend-${esc(richting)}">${esc(sub)}</span>
  </article>`;
}

/** Tabel uit kolomnamen en rijen. Cellen mogen HTML bevatten. */
export function tabel(kolommen, rijen) {
  if (!rijen.length) {
    return `<p class="empty">Geen gegevens beschikbaar.</p>`;
  }
  return `<table>
    <thead><tr>${kolommen.map((k) => `<th>${esc(k)}</th>`).join('')}</tr></thead>
    <tbody>${rijen.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
  </table>`;
}

/**
 * Grafiekfiguur met tabelweergave en bronvermelding.
 *
 * De tabelweergave is niet alleen toegankelijkheid. Het is ook de opheffing
 * van de contrastwaarschuwing op enkele lichte reekskleuren: de waarden zijn
 * altijd ook zonder kleur af te lezen.
 */
export function figure(id, titel, subtitel, tabelHtml, bron, hoogte = 260) {
  return `<figure class="chart-figure card">
    <figcaption>
      <h3>${esc(titel)}</h3>
      <p class="muted">${esc(subtitel)}</p>
    </figcaption>
    <div class="chart-canvas" style="height:${hoogte}px"><canvas id="${esc(id)}"></canvas></div>
    <details class="chart-table">
      <summary>Tabelweergave</summary>
      <div class="table-scroll">${tabelHtml}</div>
    </details>
    <p class="chart-source muted">Bron: ${esc(bron)}</p>
  </figure>`;
}

/* ---------------------------------------------------------------
   Doelen
   --------------------------------------------------------------- */

export const DOEL_STATUS = {
  BOVEN: 'Boven doelstelling',
  OP_SCHEMA: 'Op schema',
  LICHT_ONDER: 'Licht onder doelstelling',
  ONDER: 'Duidelijk onder doelstelling',
  ONVOLDOENDE: 'Onvoldoende data',
  NIET_INGESTELD: 'Niet ingesteld',
};

/**
 * Berekent de voortgang van een doel.
 *
 * Bij een KPI waar lager beter is, zoals de kosten per lead, betekent
 * "100 procent behaald" dat de werkelijke waarde precies op het maximum zit.
 * De verhouding wordt daarom omgekeerd, anders zou een dure lead als
 * overprestatie worden gelezen.
 */
export function doelVoortgang(doel) {
  const { target, actueel, kpi: kpiNaam } = doel;

  if (target == null) {
    return { status: DOEL_STATUS.NIET_INGESTELD, behaald: null, opSchema: false };
  }
  if (actueel == null) {
    return { status: DOEL_STATUS.ONVOLDOENDE, behaald: null, opSchema: false };
  }

  const lagerIsBeter = LAGER_IS_BETER.has(kpiNaam);
  const behaald = lagerIsBeter ? (target / actueel) * 100 : (actueel / target) * 100;

  let status;
  if (behaald >= 105) status = DOEL_STATUS.BOVEN;
  else if (behaald >= 100) status = DOEL_STATUS.OP_SCHEMA;
  else if (behaald >= 90) status = DOEL_STATUS.LICHT_ONDER;
  else status = DOEL_STATUS.ONDER;

  return { status, behaald, opSchema: behaald >= 100, lagerIsBeter };
}

/**
 * Prognose voor het einde van de maand op basis van het tot nu toe behaalde
 * tempo. Alleen zinvol voor doelen die gedurende de maand oplopen.
 */
export function maandPrognose(actueel, dagVanMaand, dagenInMaand) {
  if (actueel == null || !dagVanMaand) return null;
  return (actueel / dagVanMaand) * dagenInMaand;
}

/**
 * Doelbalk met target, werkelijke waarde, percentage en status.
 * Bewust een voortgangsbalk en geen meter: een balk is exact af te lezen
 * en werkt ook naast elkaar in een lijst.
 */
export function doelRij(doel, { label, format = fmt.getal, prognose = null, vorigePeriode = null } = {}) {
  const { status, behaald, opSchema } = doelVoortgang(doel);

  if (behaald == null) {
    return `<li class="goal">
      <div class="goal-head">
        <strong>${esc(label ?? doel.kpi)}</strong>
        <span class="muted">${esc(status)}</span>
      </div>
      <div class="progress"><span style="width:0%" class="is-behind"></span></div>
      <span class="muted">${esc(status)}</span>
    </li>`;
  }

  const verschil = doel.actueel - doel.target;
  const verschilTekst = `${verschil > 0 ? '+' : ''}${format(Math.abs(verschil) === 0 ? 0 : verschil)}`;
  const prognoseTekst = prognose != null ? ` · Prognose einde maand: ${format(prognose)}` : '';
  const vorigeTekst = vorigePeriode != null ? ` · Vorige periode: ${format(vorigePeriode)}` : '';

  return `<li class="goal">
    <div class="goal-head">
      <strong>${esc(label ?? doel.kpi)}</strong>
      <span class="${opSchema ? 'trend-positief' : 'trend-negatief'}">
        ${esc(format(doel.actueel))} van ${esc(format(doel.target))}
      </span>
    </div>
    <div class="progress" role="img" aria-label="${behaald.toFixed(0)} procent van het doel behaald">
      <span style="width:${Math.min(behaald, 100).toFixed(1)}%" class="${opSchema ? 'is-ok' : 'is-behind'}"></span>
    </div>
    <span class="muted">
      ${behaald.toFixed(0)} procent behaald · ${esc(status)} · Verschil: ${esc(verschilTekst)}${esc(vorigeTekst)}${esc(prognoseTekst)}${doel.eigenaar ? ` · ${esc(doel.eigenaar)}` : ''}
    </span>
  </li>`;
}

/** Badge met een statuslabel. */
export function badge(tekst, variant = 'muted') {
  return `<span class="badge badge-${esc(variant)}">${esc(tekst)}</span>`;
}

/** Vertaalt een trackingstatus naar label en badgevariant. */
export function trackingBadge(status) {
  const map = {
    gezond: ['Gezond', 'ok'],
    'controle-aanbevolen': ['Controle aanbevolen', 'middel'],
    probleem: ['Probleem', 'hoog'],
    kritiek: ['Kritiek', 'hoog'],
    'niet-ingericht': ['Niet ingericht', 'muted'],
    'onvoldoende-data': ['Onvoldoende data', 'muted'],
  };
  const [label, variant] = map[status] ?? ['Onbekend', 'muted'];
  return badge(label, variant);
}
