/**
 * E-commerce klantdashboard.
 *
 * Toont wat een marketeer nodig heeft om te beoordelen of een webshop
 * op koers ligt: omzet en ROAS tegenover doel, de ecommerce-funnel,
 * kanaalbijdrage, Google Ads tot op zoekwoordniveau en de productfeed.
 *
 * Iedere grafiek heeft een tabelweergave. Dat is niet alleen toegankelijkheid,
 * het is ook de opheffing van de contrastwaarschuwing op de lichte reekskleuren.
 */

import { getEcommerceData, buildFunnel } from '../sample-data/ecommerce.js';
import { lineChart, barChart, funnelChart, donutChart, palette } from '../charts.js';

const nf = new Intl.NumberFormat('nl-NL');
const cf = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const cf2 = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });

const fmt = {
  getal: (v) => (v == null ? 'Niet beschikbaar' : nf.format(Math.round(v))),
  euro: (v) => (v == null ? 'Niet beschikbaar' : cf.format(v)),
  euro2: (v) => (v == null ? 'Niet beschikbaar' : cf2.format(v)),
  ratio: (v) => (v == null ? 'Niet beschikbaar' : `${v.toFixed(2)}×`),
  procent: (v) => (v == null ? 'Niet beschikbaar' : `${v.toFixed(1)}%`),
};

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const MAAND_LABELS = {
  '2026-01': 'jan', '2026-02': 'feb', '2026-03': 'mrt', '2026-04': 'apr',
  '2026-05': 'mei', '2026-06': 'jun', '2026-07': 'jul',
};

/** Verschil met richting. Bij CPA en CPC is lager beter. */
function delta(actueel, vorig, lagerIsBeter = false) {
  if (actueel == null || vorig == null || vorig === 0) return { tekst: 'Niet beschikbaar', richting: 'neutraal' };
  const pct = ((actueel - vorig) / vorig) * 100;
  const positief = lagerIsBeter ? pct < 0 : pct > 0;
  return {
    tekst: `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`,
    richting: Math.abs(pct) < 0.5 ? 'neutraal' : positief ? 'positief' : 'negatief',
  };
}

function kpi(label, waarde, sub, richting = 'neutraal') {
  return `<article class="card kpi">
    <span class="kpi-label">${esc(label)}</span>
    <span class="kpi-value">${esc(waarde)}</span>
    <span class="kpi-sub trend-${richting}">${esc(sub)}</span>
  </article>`;
}

/** Grafiek met bijbehorende, uitklapbare tabelweergave. */
function figure(id, titel, subtitel, tabelHtml, bron, hoogte = 260) {
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

function tabel(kolommen, rijen) {
  return `<table>
    <thead><tr>${kolommen.map((k) => `<th>${esc(k)}</th>`).join('')}</tr></thead>
    <tbody>${rijen.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
  </table>`;
}

/* ---------------------------------------------------------------
   Hoofdweergave
   --------------------------------------------------------------- */

export function renderEcommerceClient(client) {
  const data = getEcommerceData(client.id);
  if (!data) {
    return `<p class="empty">Voor ${esc(client.name)} is nog geen e-commercedata beschikbaar.</p>`;
  }

  const { ga4, events, eventsVorigePeriode, googleAds, merchantCenter, searchConsole, doelen } = data;
  const funnel = buildFunnel(events);
  const vorigeFunnel = buildFunnel(eventsVorigePeriode);

  const omzetDelta = delta(client.kpis.omzet, client.vorigePeriode?.omzet);
  const aankopenDelta = delta(client.kpis.aankopen, client.vorigePeriode?.aankopen);
  const roasDelta = delta(client.kpis.roas, client.vorigePeriode?.roas);
  const cpaDelta = delta(client.kpis.cpa, client.vorigePeriode?.cpa, true);
  const pacing = (client.spend / client.maandbudget) * 100;

  return `
    <header class="page-head">
      <h1>${esc(client.name)}</h1>
      <p>E-commerce · ${esc(client.accountmanager)} · ${esc(client.land)}</p>
    </header>

    <div class="kpi-row">
      ${kpi('Omzet', fmt.euro(client.kpis.omzet), `${omzetDelta.tekst} t.o.v. vorige periode`, omzetDelta.richting)}
      ${kpi('Aankopen', fmt.getal(client.kpis.aankopen), `${aankopenDelta.tekst} t.o.v. vorige periode`, aankopenDelta.richting)}
      ${kpi('ROAS', fmt.ratio(client.kpis.roas), `${roasDelta.tekst} t.o.v. vorige periode`, roasDelta.richting)}
      ${kpi('Kosten per aankoop', fmt.euro2(client.kpis.cpa), `${cpaDelta.tekst} t.o.v. vorige periode`, cpaDelta.richting)}
      ${kpi('Gemiddelde orderwaarde', fmt.euro2(client.kpis.aov), 'per bestelling')}
      ${kpi('Spend', fmt.euro(client.spend), `${fmt.procent(pacing)} van budget`, pacing > 100 ? 'negatief' : 'positief')}
    </div>

    ${renderDoelen(doelen, client)}

    <div class="chart-grid">
      ${figure(
        'chart-omzet-kosten',
        'Kosten en conversiewaarde per maand',
        'Ontwikkeling van advertentiekosten tegenover de opgeleverde conversiewaarde.',
        tabel(
          ['Maand', 'Kosten', 'Conversiewaarde', 'ROAS'],
          googleAds.maanden.map((m) => [
            MAAND_LABELS[m.maand] ?? m.maand,
            fmt.euro(m.kosten),
            fmt.euro(m.conversiewaarde),
            fmt.ratio(m.roas),
          ])
        ),
        'Google Ads'
      )}

      ${figure(
        'chart-roas',
        'ROAS per maand',
        'Rendement op advertentie-uitgaven tegenover de doelstelling.',
        tabel(
          ['Maand', 'ROAS', 'CPA', 'Conversies'],
          googleAds.maanden.map((m) => [MAAND_LABELS[m.maand] ?? m.maand, fmt.ratio(m.roas), fmt.euro2(m.cpa), fmt.getal(m.conversies)])
        ),
        'Google Ads'
      )}
    </div>

    ${figure(
      'chart-funnel',
      'E-commerce funnel',
      'Van productweergave tot aankoop, met doorstroom en uitval per stap.',
      tabel(
        ['Stap', 'Volume', 'Vorige periode', 'Doorstroom', 'Uitval'],
        funnel.map((s, i) => [
          esc(s.label),
          fmt.getal(s.volume),
          fmt.getal(vorigeFunnel[i].volume),
          `${s.doorstroom.toFixed(1)}%`,
          fmt.getal(s.uitval),
        ])
      ),
      'Google Analytics 4',
      300
    )}

    <div class="chart-grid">
      ${figure(
        'chart-kanaal-omzet',
        'Omzet per kanaal',
        'Welke kanaalgroepen de omzet opleveren.',
        tabel(
          ['Kanaal', 'Gebruikers', 'Aankopen', 'Omzet', 'Conversieratio'],
          data.acquisitie.map((a) => [
            esc(a.kanaal), fmt.getal(a.gebruikers), fmt.getal(a.aankopen), fmt.euro(a.omzet), fmt.procent(a.conversieratio),
          ])
        ),
        'Google Analytics 4'
      )}

      ${figure(
        'chart-matchtype',
        'Rendement per matchtype',
        'Hoe brede, phrase- en exacte zoekwoorden zich verhouden.',
        tabel(
          ['Matchtype', 'Kosten', 'Conversies', 'CPA', 'ROAS'],
          googleAds.matchtypes.map((m) => [
            esc(m.matchtype), fmt.euro(m.kosten), fmt.getal(m.conversies), fmt.euro2(m.cpa), fmt.ratio(m.roas),
          ])
        ),
        'Google Ads'
      )}
    </div>

    ${renderProductfeed(merchantCenter)}
    ${renderZoekwoorden(googleAds.zoekwoorden)}
    ${renderSearchConsole(searchConsole)}
  `;
}

function renderDoelen(doelen, client) {
  const labels = {
    omzet: 'Omzet', roas: 'ROAS', aankopen: 'Aankopen', maandbudget: 'Budgetbesteding',
  };
  const formatters = { omzet: fmt.euro, roas: fmt.ratio, aankopen: fmt.getal, maandbudget: fmt.euro };
  const lagerIsBeter = ['maandbudget'];

  return `<section class="card">
    <h2>Doelen tegenover werkelijkheid</h2>
    <ul class="goal-list">${doelen.map((d) => {
      const format = formatters[d.kpi] ?? fmt.getal;
      const behaald = lagerIsBeter.includes(d.kpi)
        ? (d.actueel / d.target) * 100
        : (d.actueel / d.target) * 100;
      const opSchema = lagerIsBeter.includes(d.kpi) ? behaald <= 100 : behaald >= 100;
      const status = opSchema
        ? (behaald >= 100 && !lagerIsBeter.includes(d.kpi) ? 'Boven doelstelling' : 'Op schema')
        : behaald >= 90 ? 'Licht onder doelstelling' : 'Duidelijk onder doelstelling';
      return `<li class="goal">
        <div class="goal-head">
          <strong>${esc(labels[d.kpi] ?? d.kpi)}</strong>
          <span class="${opSchema ? 'trend-positief' : 'trend-negatief'}">
            ${esc(format(d.actueel))} van ${esc(format(d.target))}
          </span>
        </div>
        <div class="progress" role="img" aria-label="${behaald.toFixed(0)} procent van het doel behaald">
          <span style="width:${Math.min(behaald, 100).toFixed(1)}%" class="${opSchema ? 'is-ok' : 'is-behind'}"></span>
        </div>
        <span class="muted">${behaald.toFixed(0)} procent behaald · ${esc(status)}${d.eigenaar ? ` · ${esc(d.eigenaar)}` : ''}</span>
      </li>`;
    }).join('')}</ul>
  </section>`;
}

function renderProductfeed(mc) {
  const pct = (n) => (mc.totaalProducten ? (n / mc.totaalProducten) * 100 : 0);
  const ernstLabel = { afgekeurd: 'Afgekeurd', beperkt: 'Beperkt', waarschuwing: 'Waarschuwing' };
  const ernstBadge = { afgekeurd: 'hoog', beperkt: 'middel', waarschuwing: 'muted' };

  return `<section class="card">
    <h2>Productfeed</h2>
    <div class="kpi-row">
      ${kpi('Totaal producten', fmt.getal(mc.totaalProducten), 'in de feed')}
      ${kpi('Goedgekeurd', fmt.getal(mc.goedgekeurd), fmt.procent(pct(mc.goedgekeurd)), 'positief')}
      ${kpi('Beperkt', fmt.getal(mc.beperkt), fmt.procent(pct(mc.beperkt)), mc.beperkt > 0 ? 'negatief' : 'neutraal')}
      ${kpi('Afgekeurd', fmt.getal(mc.afgekeurd), fmt.procent(pct(mc.afgekeurd)), mc.afgekeurd > 0 ? 'negatief' : 'positief')}
    </div>
    <div class="table-scroll" style="margin-top:16px">
      ${tabel(
        ['Probleem', 'Producten', 'Ernst'],
        mc.problemen.map((p) => [
          esc(p.probleem),
          fmt.getal(p.producten),
          `<span class="badge badge-${ernstBadge[p.ernst]}">${esc(ernstLabel[p.ernst])}</span>`,
        ])
      )}
    </div>
    <p class="muted note">Laatste synchronisatie: ${new Date(mc.laatsteSync).toLocaleString('nl-NL')}. Bron: Google Merchant Center.</p>
  </section>`;
}

function renderZoekwoorden(zoekwoorden) {
  return `<section class="card">
    <h2>Zoekwoorden</h2>
    <div class="table-scroll">
      ${tabel(
        ['Zoekwoord', 'Matchtype', 'Vertoningen', 'Klikken', 'CTR', 'CPC', 'Kosten', 'Conversies', 'CPA', 'ROAS'],
        zoekwoorden.map((z) => [
          esc(z.zoekwoord),
          `<span class="tag">${esc(z.matchtype)}</span>`,
          fmt.getal(z.vertoningen),
          fmt.getal(z.klikken),
          fmt.procent(z.ctr),
          fmt.euro2(z.cpc),
          fmt.euro(z.kosten),
          fmt.getal(z.conversies),
          fmt.euro2(z.cpa),
          `<span class="${z.roas >= 3 ? 'trend-positief' : z.roas >= 1 ? 'trend-neutraal' : 'trend-negatief'}">${fmt.ratio(z.roas)}</span>`,
        ])
      )}
    </div>
    <p class="muted note">Bron: Google Ads.</p>
  </section>`;
}

function renderSearchConsole(sc) {
  return `<section class="card">
    <h2>Organische resultaten</h2>
    <div class="kpi-row">
      ${kpi('Klikken', fmt.getal(sc.klikken), 'organisch')}
      ${kpi('Impressies', fmt.getal(sc.impressies), 'organisch')}
      ${kpi('CTR', fmt.procent(sc.ctr), 'gemiddeld')}
      ${kpi('Gemiddelde positie', sc.gemPositie.toFixed(1), 'lager is beter')}
    </div>
    <div class="table-scroll" style="margin-top:16px">
      ${tabel(
        ['Segment', 'Klikken', 'Impressies', 'CTR', 'Gemiddelde positie'],
        [
          ['Merkgebonden', fmt.getal(sc.branded.klikken), fmt.getal(sc.branded.impressies), fmt.procent(sc.branded.ctr), sc.branded.gemPositie.toFixed(1)],
          ['Niet-merkgebonden', fmt.getal(sc.nonBranded.klikken), fmt.getal(sc.nonBranded.impressies), fmt.procent(sc.nonBranded.ctr), sc.nonBranded.gemPositie.toFixed(1)],
        ]
      )}
    </div>
    <p class="muted note">Laatste beschikbare datum: ${esc(sc.laatsteDatum)}. Bron: Google Search Console.</p>
  </section>`;
}

/* ---------------------------------------------------------------
   Grafieken tekenen, na het invoegen van de HTML
   --------------------------------------------------------------- */

export function drawEcommerceCharts(client) {
  const data = getEcommerceData(client.id);
  if (!data) return;

  const { googleAds, acquisitie, events } = data;
  const p = palette();
  const maandLabels = googleAds.maanden.map((m) => MAAND_LABELS[m.maand] ?? m.maand);

  barChart('chart-omzet-kosten', {
    labels: maandLabels,
    series: [
      { label: 'Kosten', data: googleAds.maanden.map((m) => m.kosten) },
      { label: 'Conversiewaarde', data: googleAds.maanden.map((m) => m.conversiewaarde) },
    ],
    valueFormatter: (v) => cf.format(v),
  });

  lineChart('chart-roas', {
    labels: maandLabels,
    series: [{ label: 'ROAS', data: googleAds.maanden.map((m) => m.roas) }],
    valueFormatter: (v) => `${Number(v).toFixed(1)}×`,
  });

  funnelChart('chart-funnel', {
    stappen: buildFunnel(events),
    valueFormatter: (v) => nf.format(Math.round(v)),
  });

  const gesorteerd = [...acquisitie].sort((a, b) => b.omzet - a.omzet).slice(0, 7);
  barChart('chart-kanaal-omzet', {
    labels: gesorteerd.map((a) => a.kanaal),
    horizontal: true,
    series: [{ label: 'Omzet', data: gesorteerd.map((a) => a.omzet) }],
    valueFormatter: (v) => cf.format(v),
  });

  donutChart('chart-matchtype', {
    labels: googleAds.matchtypes.map((m) => m.matchtype),
    data: googleAds.matchtypes.map((m) => m.kosten),
    valueFormatter: (v) => cf.format(v),
  });
}
