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

import { metriekMeta, Formaat, DeltaStatus } from '../data/metrics.js';
import { PacingStatus } from '../data/selectors.js';
import { ontbrekendTerm, budgetstatusTerm, KLANTSTATUSSEN } from '../terminology.js';

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
 * Maakt een waarde op volgens het formaat uit de metriekmetadata.
 * Zo staat de opmaak van een metriek op één plek, naast de betekenis ervan.
 */
export function formatteerMetriek(waarde, formaat) {
  switch (formaat) {
    case Formaat.EURO: return fmt.euro(waarde);
    case Formaat.EURO2: return fmt.euro2(waarde);
    case Formaat.PROCENT: return fmt.procent(waarde);
    case Formaat.RATIO: return fmt.ratio(waarde);
    default: return fmt.getal(waarde);
  }
}

/** Waarde van een metriek uit een totalenobject, al opgemaakt. */
export function toonMetriek(totalen, key, leegTekst = 'Onvoldoende data') {
  const waarde = totalen?.[key];
  if (waarde == null) return leegTekst;
  return formatteerMetriek(waarde, metriekMeta(key).formaat);
}

/**
 * Beschrijft een verandering in woorden.
 * De vijf statussen uit metrics.js worden hier vertaald naar tekst die naast
 * een KPI past, zonder dat de view zelf hoeft te weten of dalen goed is.
 */
export function deltaTekst(delta, vergelijkingLabel = 'de vorige periode') {
  if (!delta) return '';
  switch (delta.status) {
    case DeltaStatus.ONVOLDOENDE_DATA: return 'Onvoldoende data';
    case DeltaStatus.NIET_VERGELIJKBAAR: return delta.tekst;
    case DeltaStatus.GELIJK: return `Gelijk aan ${vergelijkingLabel}`;
    default: return `${delta.tekst} t.o.v. ${vergelijkingLabel}`;
  }
}

/**
 * KPI-kaart.
 *
 * De kaart benoemt altijd de volledige naam. Een afkorting staat er als
 * ondersteunende tekst bij, nooit in plaats van de naam: "CPQL" zonder "Kosten
 * per gekwalificeerde lead" is voor de helft van de lezers betekenisloos.
 *
 * De verandering wordt niet alleen met kleur weergegeven. Er staat een richting
 * in woorden, het percentage en waarmee vergeleken wordt.
 */
export function kpi(label, waarde, sub = '', richting = 'neutraal', {
  kort = null, uitleg = '', detail = null,
} = {}) {
  const uitlegId = uitleg ? `kpi-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-uitleg` : null;

  return `<article class="card kpi" data-label="${esc(label)}"${uitleg ? ` aria-describedby="${esc(uitlegId)}"` : ''}>
    <span class="kpi-label">
      ${esc(label)}
      ${kort ? `<abbr class="kpi-kort" title="${esc(uitleg || label)}">${esc(kort)}</abbr>` : ''}
    </span>
    <span class="kpi-value">${esc(waarde)}</span>
    <span class="kpi-sub trend-${esc(richting)}">${esc(sub)}</span>
    ${uitleg ? `<span class="kpi-uitleg" id="${esc(uitlegId)}">${esc(uitleg)}</span>` : ''}
    ${detail ? `<a class="kpi-detail link-klein" href="${esc(detail.href)}">${esc(detail.tekst)}</a>` : ''}
  </article>`;
}

/**
 * KPI-kaart die zijn naam, opmaak, uitleg en richting uit de metriekmetadata
 * haalt. Een view bepaalt dus nooit zelf of een daling goed nieuws is.
 *
 * @param {object} totalen     berekende totalen
 * @param {string} key         metrieksleutel
 * @param {object} deltas      berekende delta's
 * @param {object} opties      label, leegTekst en vergelijkingLabel
 */
export function kpiMetriek(totalen, key, deltas, {
  label = null, leegTekst = 'Onvoldoende data', leegSub = 'Niet gemeten in deze periode',
  vergelijkingLabel = 'de vorige periode', detail = null,
} = {}) {
  const meta = metriekMeta(key);
  const waarde = totalen?.[key];
  const delta = deltas?.[key];
  const opmaak = { kort: meta.kort ?? null, uitleg: meta.uitleg ?? '', detail };

  if (waarde == null) {
    return kpi(label ?? meta.label, leegTekst, leegSub, 'neutraal', opmaak);
  }
  return kpi(
    label ?? meta.label,
    formatteerMetriek(waarde, meta.formaat),
    deltaTekst(delta, vergelijkingLabel),
    delta?.richting ?? 'neutraal',
    opmaak
  );
}

/**
 * Cel voor een waarde die er niet is.
 *
 * Er zijn vijf redenen waarom een vakje leeg blijft en ze betekenen alle vijf
 * iets anders. Eén streepje voor alle vijf laat de lezer raden.
 */
export function ontbrekendeCel(soort = 'onvoldoende_data') {
  const term = ontbrekendTerm(soort);
  return `<span class="muted ontbrekend" title="${esc(term.omschrijving)}">${esc(term.kort)}</span>`;
}

/** Toont een getal, of de reden waarom het er niet is. */
export function getalOfReden(waarde, soort = 'onvoldoende_data', format = null) {
  if (waarde == null) return ontbrekendeCel(soort);
  return (format ?? fmt.getal)(waarde);
}

/** Tabelcel met een verandering, inclusief statuswoord voor wie geen kleur ziet. */
export function deltaCel(delta) {
  if (!delta || delta.status === DeltaStatus.ONVOLDOENDE_DATA) {
    return '<span class="muted">Onvoldoende data</span>';
  }
  if (delta.status === DeltaStatus.NIET_VERGELIJKBAAR) {
    return `<span class="muted">${esc(delta.tekst)}</span>`;
  }
  return `<span class="trend-${esc(delta.richting)}">${esc(delta.tekst)}</span>`;
}

/**
 * Tabel uit kolomnamen en rijen. Cellen mogen HTML bevatten.
 *
 * Een kolom is een string of een object met een label en een uitleg. Die uitleg
 * komt in de titel van de kop terecht, zodat een afkorting als CPQL ook in een
 * tabel te begrijpen is zonder de legenda erbij te zoeken.
 *
 * @param {(string|{label: string, uitleg?: string})[]} kolommen
 * @param {string[][]} rijen
 * @param {{leegTekst?: string}} opties
 */
export function tabel(kolommen, rijen, { leegTekst = 'Geen gegevens beschikbaar.' } = {}) {
  if (!rijen.length) {
    return `<p class="empty">${esc(leegTekst)}</p>`;
  }

  const kop = kolommen.map((k) => {
    const label = typeof k === 'string' ? k : k.label;
    const uitleg = typeof k === 'string' ? null : k.uitleg;
    return uitleg
      ? `<th scope="col"><span title="${esc(uitleg)}">${esc(label)}</span></th>`
      : `<th scope="col">${esc(label)}</th>`;
  }).join('');

  return `<table>
    <thead><tr>${kop}</tr></thead>
    <tbody>${rijen.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
  </table>`;
}

/** Kolomkop uit de metriekmetadata, inclusief uitleg bij de afkorting. */
export function metriekKolom(key, label = null) {
  const meta = metriekMeta(key);
  return { label: label ?? meta.label, uitleg: meta.uitleg ?? '' };
}

/**
 * Grafiekfiguur met tabelweergave en bronvermelding.
 *
 * De tabelweergave is niet alleen toegankelijkheid. Het is ook de opheffing
 * van de contrastwaarschuwing op enkele lichte reekskleuren: de waarden zijn
 * altijd ook zonder kleur af te lezen.
 */
export function figure(id, titel, subtitel, tabelHtml, bron, hoogte = 260, { conclusie = null } = {}) {
  return `<figure class="chart-figure card">
    <figcaption>
      ${conclusie ? `<p class="chart-conclusie">${esc(conclusie)}</p>` : ''}
      <h3${conclusie ? ' class="chart-titel-sub"' : ''}>${esc(titel)}</h3>
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
  BINNEN: 'Binnen budget',
  OVERSCHREDEN: 'Boven budget',
  ONVOLDOENDE: 'Onvoldoende data',
  NIET_INGESTELD: 'Niet ingesteld',
};

/**
 * Berekent de voortgang van een doel.
 *
 * De richting komt uit het doel zelf en niet uit een lijst met KPI-namen in
 * deze module. Er zijn drie richtingen:
 *
 *   hoger   meer is beter, zoals leads of omzet
 *   lager   minder is beter per eenheid, zoals de kosten per lead. "100 procent
 *           behaald" betekent dat de werkelijke waarde precies op het maximum
 *           zit; de verhouding wordt omgekeerd, anders zou een dure lead als
 *           overprestatie worden gelezen.
 *   binnen  de waarde hoort onder het doel te blijven, zoals een budget. Hier
 *           is het percentage juist het bestede deel, want dat is wat je wilt
 *           aflezen.
 */
export function doelVoortgang(doel) {
  const { target, actueel, richting = 'hoger' } = doel;

  if (target == null) {
    return { status: DOEL_STATUS.NIET_INGESTELD, behaald: null, opSchema: false };
  }
  if (actueel == null) {
    return { status: DOEL_STATUS.ONVOLDOENDE, behaald: null, opSchema: false };
  }

  if (richting === 'binnen') {
    const besteed = target === 0 ? null : (actueel / target) * 100;
    if (besteed == null) return { status: DOEL_STATUS.ONVOLDOENDE, behaald: null, opSchema: false };
    return {
      status: besteed <= 100 ? DOEL_STATUS.BINNEN : DOEL_STATUS.OVERSCHREDEN,
      behaald: besteed,
      opSchema: besteed <= 100,
      richting,
    };
  }

  const behaald = richting === 'lager'
    ? (actueel === 0 ? null : (target / actueel) * 100)
    : (target === 0 ? null : (actueel / target) * 100);

  if (behaald == null) {
    return { status: DOEL_STATUS.ONVOLDOENDE, behaald: null, opSchema: false };
  }

  let status;
  if (behaald >= 105) status = DOEL_STATUS.BOVEN;
  else if (behaald >= 100) status = DOEL_STATUS.OP_SCHEMA;
  else if (behaald >= 90) status = DOEL_STATUS.LICHT_ONDER;
  else status = DOEL_STATUS.ONDER;

  return { status, behaald, opSchema: behaald >= 100, richting };
}

/**
 * Doelbalk met target, werkelijke waarde, percentage en status.
 *
 * Bewust een voortgangsbalk en geen meter: een balk is exact af te lezen en
 * werkt ook naast elkaar in een lijst. De status staat er altijd als woord bij,
 * zodat hij niet alleen aan de kleur is af te lezen.
 */
export function doelRij(doel, { label, format = fmt.getal } = {}) {
  const { status, behaald, opSchema } = doelVoortgang(doel);
  const naam = label ?? doel.kpi;

  if (behaald == null) {
    return `<li class="goal">
      <div class="goal-head">
        <strong>${esc(naam)}</strong>
        <span class="muted">${esc(status)}</span>
      </div>
      <div class="progress"><span style="width:0%" class="is-behind"></span></div>
      <span class="muted">${esc(status)}${doel.actueel == null ? ' · Deze waarde wordt niet gemeten' : ''}</span>
    </li>`;
  }

  const verschil = doel.actueel - doel.target;
  const verschilTekst = `${verschil > 0 ? '+' : ''}${format(Math.abs(verschil) === 0 ? 0 : verschil)}`;
  const prognoseTekst = doel.prognose != null ? ` · Prognose einde periode: ${format(doel.prognose)}` : '';
  const vorigeTekst = doel.vorigePeriode != null ? ` · Vorige periode: ${format(doel.vorigePeriode)}` : '';
  const geschaaldTekst = doel.geschaald
    ? ` · Maanddoel ${format(doel.maandTarget)}, omgerekend naar deze periode`
    : '';

  return `<li class="goal">
    <div class="goal-head">
      <strong>${esc(naam)}</strong>
      <span class="${opSchema ? 'trend-positief' : 'trend-negatief'}">
        ${esc(format(doel.actueel))} van ${esc(format(doel.target))}
      </span>
    </div>
    <div class="progress" role="img" aria-label="${behaald.toFixed(0)} procent van het doel behaald">
      <span style="width:${Math.min(behaald, 100).toFixed(1)}%" class="${opSchema ? 'is-ok' : 'is-behind'}"></span>
    </div>
    <span class="muted">
      ${behaald.toFixed(0)} procent behaald · ${esc(status)} · Verschil: ${esc(verschilTekst)}${esc(vorigeTekst)}${esc(prognoseTekst)}${esc(geschaaldTekst)}${doel.eigenaar ? ` · ${esc(doel.eigenaar)}` : ''}
    </span>
  </li>`;
}

/* ---------------------------------------------------------------
   Budget
   --------------------------------------------------------------- */

/**
 * Budgetstatus en prognose voor de geselecteerde periode.
 *
 * Het aantal verstreken dagen komt uit de periode zelf. Er wordt nergens meer
 * van een vast aantal verstreken dagen uitgegaan, en er verschijnt geen
 * prognose wanneer die niets zou toevoegen: bij een afgeronde periode, zonder
 * budget, of met te weinig verstreken dagen.
 */
export function renderBudget(dashboard) {
  const b = dashboard.budget;
  const variant = {
    [PacingStatus.BOVEN_BUDGET]: 'negatief',
    [PacingStatus.ONDER_BUDGET]: 'negatief',
    [PacingStatus.OP_SCHEMA]: 'positief',
  }[b.status] ?? 'neutraal';

  return `<section class="card budget-blok">
    <h2>Budget en pacing</h2>
    <div class="kpi-row">
      ${kpi('Budget voor deze periode', b.budget == null ? 'Niet ingesteld' : fmt.euro(b.budget),
        b.maandbudget == null ? 'Geen budget vastgelegd' : `Maandbudget ${fmt.euro(b.maandbudget)} naar rato`)}
      ${kpi('Uitgaven', fmt.euro(b.uitgaven), `${b.verstrekenDagen} van ${b.totaalDagen} dagen verstreken`)}
      ${kpi('Verwacht eindbedrag', b.prognose == null ? 'Geen prognose' : fmt.euro(b.prognose),
        b.prognose == null ? b.reden : `Gemiddeld ${fmt.euro(b.gemiddeldPerDag)} per dag`, variant)}
      ${kpi('Verschil met budget', b.verschil == null ? 'Niet beschikbaar' : fmt.euro(b.verschil),
        budgetstatusTerm(b.status).kort, variant)}
    </div>
    <p class="muted note">${esc(b.reden)}</p>
  </section>`;
}

/** Badge met een statuslabel. */
export function badge(tekst, variant = 'muted') {
  return `<span class="badge badge-${esc(variant)}">${esc(tekst)}</span>`;
}

/**
 * De staat van de meting bij een klant.
 * "Trackingprobleem" was jargon; een klant leest nu dat de meting onvolledig is.
 */
export function meetstatusBadge(status) {
  const map = {
    gezond: ['Meting volledig', 'ok', 'Alle bronnen leveren gegevens.'],
    'controle-aanbevolen': ['Meting controleren', 'middel', 'Een of meer bronnen leveren onvolledige gegevens.'],
    probleem: ['Meting onvolledig', 'hoog', 'De cijfers zijn onbetrouwbaar doordat metingen ontbreken.'],
    kritiek: ['Meting onvolledig', 'hoog', 'De cijfers zijn onbetrouwbaar doordat metingen ontbreken.'],
    'niet-ingericht': ['Meting niet ingericht', 'muted', 'Er is nog geen meting ingericht.'],
    'onvoldoende-data': [KLANTSTATUSSEN['onvoldoende-data'].kort, 'muted', KLANTSTATUSSEN['onvoldoende-data'].omschrijving],
  };
  const [label, variant, uitleg] = map[status] ?? ['Onbekend', 'muted', ''];
  return `<span class="badge badge-${esc(variant)}" title="${esc(uitleg)}">${esc(label)}</span>`;
}
