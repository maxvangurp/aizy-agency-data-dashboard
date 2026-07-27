/**
 * Rapportage-builder.
 *
 * Aizy stelt hier een rapportage samen vóór een klant: kies welke KPI's,
 * inzichten en secties uit het klantdashboard meegaan, schrijf een titel en een
 * intro, en zie het resultaat live meebewegen in de preview ernaast. De cijfers
 * en grafieken komen rechtstreeks uit `getClientDashboard`, dus de builder legt
 * de *samenstelling* vast — niet een bevroren kopie van de data.
 *
 * `renderRapportPreview` is bewust gedeeld: de builder-preview, een opgeslagen
 * rapportage en de printweergave gebruiken exact dezelfde opbouw.
 */

import {
  fmt, esc, kpiMetriek, tabel, figure, badge, samenwerkingsGrid, getalKolom,
} from './components.js';
import { renderInzichtkaart } from './insight-cards.js';
import { renderMedewerker } from './context-header.js';
import { metriekCatalogus } from '../data/metrics-catalog.js';
import { PRIMARY_KPIS } from '../sample-data/shared.js';
import { lineChart, funnelChart } from '../charts.js';
import { toonDatum, toonKorteDatum } from '../filters/period.js';

/** De metriek waaraan het resultaat van een model wordt afgelezen. */
const HOOFDMETRIEK = { leadgen: 'leads', ecommerce: 'revenue', awareness: 'impressions' };

/** Alle inzichten van een dashboard als één platte, indexeerbare lijst. */
export function alleInzichten(dashboard) {
  return [...(dashboard?.inzichten?.primair ?? []), ...(dashboard?.inzichten?.aanvullend ?? [])];
}

function metriekLabel(key) {
  return metriekCatalogus(key).label ?? key;
}

function hoofdmetriekWaarde(punt, key) {
  return punt?.[key] ?? null;
}

/* ===============================================================
   Het rapport zelf — gedeeld door preview, opgeslagen weergave en print.
   =============================================================== */

export function renderRapportPreview({ rapport, dashboard, verhaal }) {
  if (!rapport || !dashboard) {
    return '<div class="rapport-preview"><p class="empty">Kies een klant om een rapportage te maken.</p></div>';
  }

  const o = rapport.onderdelen;
  const vgl = dashboard.vergelijkingActief
    ? (dashboard.vergelijking?.label ?? 'de vorige periode').toLowerCase()
    : 'de vorige periode';

  const kpis = o.kpis ?? [];
  const kpiGrid = kpis.length
    ? `<div class="kpi-row">${kpis.map((k) => kpiMetriek(dashboard.totalen, k, dashboard.deltas, {
      label: metriekLabel(k), vergelijkingLabel: vgl, drill: false,
    })).join('')}</div>`
    : '';

  const inzichten = alleInzichten(dashboard);
  const gekozenInzichten = (o.inzichtIds ?? [])
    .map((i) => inzichten[i])
    .filter(Boolean);
  const inzichtBlok = gekozenInzichten.length
    ? `<section class="rapport-sectie">
        <h2>Wat er is veranderd</h2>
        <div class="inzicht-grid">
          ${gekozenInzichten.map((i, idx) => renderInzichtkaart(i, { dominant: idx === 0 })).join('')}
        </div>
      </section>`
    : '';

  const auteur = rapport.auteur?.naam ? esc(rapport.auteur.naam) : 'Aizy';

  return `<article class="rapport-preview" id="rapportPreview">
    <header class="rapport-kop">
      <p class="rapport-merk">Aizy · rapportage</p>
      <h1 class="rapport-titel">${esc(rapport.titel || 'Rapportage')}</h1>
      <p class="rapport-meta">
        ${esc(rapport.clientNaam || dashboard.client.name)}
        ${rapport.periodeLabel ? ` · ${esc(rapport.periodeLabel)}` : ''}
        · opgesteld door ${auteur}
      </p>
      ${rapport.intro ? `<p class="rapport-intro">${esc(rapport.intro)}</p>` : ''}
    </header>

    ${kpiGrid ? `<section class="rapport-sectie"><h2>De cijfers</h2>${kpiGrid}</section>` : ''}
    ${o.ontwikkeling ? renderOntwikkelingSectie(dashboard) : ''}
    ${o.funnel && dashboard.funnel ? renderFunnelSectie(dashboard) : ''}
    ${o.kanalen ? renderKanalenSectie(dashboard) : ''}
    ${inzichtBlok}
    ${o.samenwerking ? renderSamenwerkingSectie(dashboard, verhaal) : ''}

    <footer class="rapport-voet">
      <p class="muted klein">
        Deze rapportage is samengesteld in de Aizy-demo. De cijfers volgen de
        geselecteerde periode en kanalen; grafieken en tabellen komen uit dezelfde
        bron als het dashboard.
      </p>
    </footer>
  </article>`;
}

function renderOntwikkelingSectie(dashboard) {
  const key = HOOFDMETRIEK[dashboard.model] ?? 'spend';
  const punten = dashboard.reeks?.punten ?? [];
  if (!punten.length) return '';
  const label = metriekLabel(key);
  const tabelHtml = tabel(
    ['Datum', getalKolom(label)],
    punten.map((p) => [
      esc(toonKorteDatum(p.date)),
      hoofdmetriekWaarde(p, key) == null ? '<span class="muted">Geen data</span>' : fmt.getal(hoofdmetriekWaarde(p, key)),
    ]),
  );
  return `<section class="rapport-sectie">
    <h2>Ontwikkeling in de periode</h2>
    ${figure('rap-chart-ontwikkeling', `${label} per ${dashboard.reeks?.stap ?? 'dag'}`,
      'Het verloop binnen de geselecteerde periode.', tabelHtml, 'Advertentiekanalen en analytics')}
  </section>`;
}

function renderFunnelSectie(dashboard) {
  const rijen = dashboard.funnel?.rijen ?? [];
  if (!rijen.length) return '';
  const tabelHtml = tabel(
    ['Stap', getalKolom('Aantal'), getalKolom('Doorstroom')],
    rijen.map((r) => [
      esc(r.label),
      r.volume == null ? '<span class="muted">Onvoldoende data</span>' : fmt.getal(r.volume),
      r.doorstroom == null ? '<span class="muted">n.v.t.</span>' : fmt.procent(r.doorstroom),
    ]),
  );
  return `<section class="rapport-sectie">
    <h2>Van bereik tot resultaat</h2>
    ${figure('rap-chart-funnel', 'Doorstroom per stap',
      'Het percentage dat doorstroomt naar de volgende stap.', tabelHtml, 'Advertentiekanalen, analytics en CRM', 300)}
  </section>`;
}

function renderKanalenSectie(dashboard) {
  const key = HOOFDMETRIEK[dashboard.model] ?? 'spend';
  const label = metriekLabel(key);
  const rijen = [...(dashboard.kanaalRijen ?? [])].sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0));
  if (!rijen.length) return '';
  const tabelHtml = tabel(
    ['Kanaal', getalKolom('Uitgaven'), getalKolom(label)],
    rijen.map((k) => [
      esc(k.label),
      fmt.euro(k.spend),
      k[key] == null ? '<span class="muted">Geen data</span>' : fmt.getal(k[key]),
    ]),
  );
  return `<section class="rapport-sectie">
    <h2>Per kanaal</h2>
    <div class="table-scroll">${tabelHtml}</div>
    <p class="muted klein">Bron: advertentiekanalen en analytics.</p>
  </section>`;
}

function renderSamenwerkingSectie(dashboard, verhaal) {
  const contact = dashboard.team?.primair
    ? `<h3>Je contactpersoon</h3>${renderMedewerker(dashboard.team.primair)}`
    : '';
  const grid = samenwerkingsGrid([
    { titel: 'Wat Aizy deze periode deed', items: verhaal?.gedaan, leeg: 'Niets te melden voor deze periode.' },
    { titel: 'Wat Aizy hierna gaat doen', items: verhaal?.volgende, leeg: 'De vervolgstappen worden in het eerstvolgende overleg vastgelegd.' },
    { titel: 'Wat wij van je nodig hebben', items: verhaal?.vanKlant, leeg: 'Op dit moment hebben we niets van je nodig.', accent: true },
  ], contact);
  return `<section class="rapport-sectie">
    <h2>Samenwerking deze periode</h2>
    ${grid}
  </section>`;
}

/** Tekent de grafieken van het rapport (na render aanroepen). */
export function drawRapportCharts({ rapport, dashboard }) {
  if (!rapport || !dashboard?.heeftData) return;
  const o = rapport.onderdelen;

  if (o.ontwikkeling) {
    const key = HOOFDMETRIEK[dashboard.model] ?? 'spend';
    const punten = dashboard.reeks?.punten ?? [];
    if (punten.length) {
      lineChart('rap-chart-ontwikkeling', {
        labels: punten.map((p) => toonKorteDatum(p.date)),
        series: [{ label: metriekLabel(key), data: punten.map((p) => hoofdmetriekWaarde(p, key)) }],
        valueFormatter: (v) => fmt.getal(v),
      });
    }
  }

  if (o.funnel && dashboard.funnel) {
    const stappen = (dashboard.funnel.rijen ?? [])
      .filter((r) => r.doorstroom != null)
      .map((r) => ({ ...r, volume: r.doorstroom, absoluutVolume: r.volume }));
    if (stappen.length) {
      funnelChart('rap-chart-funnel', {
        stappen,
        valueFormatter: (v) => `${Number(v).toFixed(0)}%`,
      });
    }
  }
}

/* ===============================================================
   De builder — opties links, live preview rechts.
   =============================================================== */

export function renderRapportBouwer({ user, rapport, dashboard, verhaal, klanten }) {
  const model = dashboard?.model;
  const beschikbareKpis = model ? (dashboard ? kpiKeuzes(dashboard) : []) : [];
  const inzichten = dashboard ? alleInzichten(dashboard) : [];
  const o = rapport?.onderdelen ?? { kpis: [], inzichtIds: [], funnel: false, kanalen: false, ontwikkeling: false, samenwerking: false };

  const klantOpties = (klanten ?? [])
    .map((k) => `<option value="${esc(k.id)}"${k.id === rapport?.clientId ? ' selected' : ''}>${esc(k.name)}</option>`)
    .join('');

  const secties = [
    { key: 'ontwikkeling', label: 'Ontwikkeling (grafiek)' },
    { key: 'funnel', label: 'Funnel (grafiek)', beschikbaar: Boolean(dashboard?.funnel) },
    { key: 'kanalen', label: 'Per kanaal (tabel)' },
    { key: 'samenwerking', label: 'Samenwerking en contactpersoon' },
  ];

  return `<div class="rapport-bouwer" id="rapportBouwer">
    <form class="rapport-opties" data-rapport-form aria-label="Rapportage samenstellen">
      <div class="rapport-opties-kop">
        <h2>Rapportage samenstellen</h2>
        <p class="muted klein">Kies wat er meegaat. De preview beweegt live mee.</p>
      </div>

      <label class="rapport-veld">
        <span class="rapport-veld-label">Klant</span>
        <select data-rapport-klant>${klantOpties || '<option>Geen klanten</option>'}</select>
      </label>

      ${rapport?.periodeLabel ? `<p class="rapport-periode muted klein">Periode: ${esc(rapport.periodeLabel)}</p>` : ''}

      <label class="rapport-veld">
        <span class="rapport-veld-label">Titel</span>
        <input type="text" data-rapport-titel value="${esc(rapport?.titel ?? '')}" placeholder="Titel van de rapportage" />
      </label>

      <label class="rapport-veld">
        <span class="rapport-veld-label">Intro</span>
        <textarea data-rapport-intro rows="3" placeholder="Een korte duiding voor de klant (optioneel).">${esc(rapport?.intro ?? '')}</textarea>
      </label>

      <fieldset class="rapport-groep">
        <legend>KPI's</legend>
        <div class="rapport-keuzes">
          ${beschikbareKpis.map((k) => keuze(`kpi`, k.key, k.label, o.kpis.includes(k.key))).join('') || '<p class="muted klein">Geen KPI\'s beschikbaar.</p>'}
        </div>
      </fieldset>

      <fieldset class="rapport-groep">
        <legend>Secties</legend>
        <div class="rapport-keuzes">
          ${secties.filter((s) => s.beschikbaar !== false).map((s) => keuze('sectie', s.key, s.label, Boolean(o[s.key]))).join('')}
        </div>
      </fieldset>

      <fieldset class="rapport-groep">
        <legend>Inzichten <span class="muted klein">(met bewijs)</span></legend>
        <div class="rapport-keuzes">
          ${inzichten.length
            ? inzichten.map((i, idx) => keuze('inzicht', String(idx), i.titel, (o.inzichtIds ?? []).includes(idx))).join('')
            : '<p class="muted klein">Geen inzichten binnen deze selectie.</p>'}
        </div>
      </fieldset>

      <div class="rapport-acties">
        <button type="button" class="btn primary" data-rapport-opslaan>Rapportage opslaan</button>
        <button type="button" class="btn" data-rapport-print>Exporteren / printen</button>
      </div>
    </form>

    <div class="rapport-preview-wrap">
      ${renderRapportPreview({ rapport, dashboard, verhaal })}
    </div>
  </div>`;
}

/** De selecteerbare KPI's van een dashboard, met label (per businessmodel). */
export function kpiKeuzes(dashboard) {
  const keys = PRIMARY_KPIS[dashboard.type] ?? PRIMARY_KPIS[dashboard.client?.businessModel] ?? [];
  return keys.map((key) => ({ key, label: metriekLabel(key) }));
}

function keuze(soort, waarde, label, aan) {
  return `<label class="rapport-keuze">
    <input type="checkbox" data-rapport-${soort}="${esc(waarde)}"${aan ? ' checked' : ''} />
    <span>${esc(label)}</span>
  </label>`;
}

/* ===============================================================
   Opgeslagen rapportages — lijst op de rapportagepagina.
   =============================================================== */

export function renderOpgeslagenRapportages(lijst) {
  if (!lijst.length) {
    return `<section class="card">
      <div class="rapport-lijst-kop">
        <h2>Opgeslagen rapportages</h2>
        <a class="btn primary" href="#/agency/reports/new">Nieuwe rapportage</a>
      </div>
      <p class="empty">Er zijn nog geen rapportages samengesteld. Maak er een met de rapportage-builder.</p>
    </section>`;
  }

  return `<section class="card">
    <div class="rapport-lijst-kop">
      <h2>Opgeslagen rapportages</h2>
      <a class="btn primary" href="#/agency/reports/new">Nieuwe rapportage</a>
    </div>
    <div class="table-scroll">
      ${tabel(
        ['Rapportage', 'Klant', 'Bijgewerkt', 'Acties'],
        lijst.map((r) => [
          `<a class="link" href="#/agency/reports/${esc(r.id)}">${esc(r.titel)}</a>`,
          esc(r.clientNaam ?? '—'),
          esc(toonDatum((r.gewijzigdOp ?? '').slice(0, 10))),
          `<span class="rapport-rij-acties">
            <a class="link klein" href="#/agency/reports/${esc(r.id)}">Openen</a>
            <button type="button" class="link klein" data-rapport-dupliceer="${esc(r.id)}">Dupliceren</button>
            <button type="button" class="link klein gevaar" data-rapport-verwijder="${esc(r.id)}">Verwijderen</button>
          </span>`,
        ]),
      )}
    </div>
  </section>`;
}
