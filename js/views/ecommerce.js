/**
 * E-commercedashboard.
 *
 * Toont wat een marketeer nodig heeft om te beoordelen of een webshop op koers
 * ligt: omzet en ROAS tegenover doel, de ecommerce-funnel, kanaalbijdrage,
 * Google Ads tot op zoekwoordniveau en de productfeed.
 *
 * Net als bij leadgeneratie rekent deze module niets uit. Alles komt uit het
 * viewmodel van de repository, dat al op de filtercontext is toegepast.
 *
 * Iedere grafiek heeft een tabelweergave. Dat is niet alleen toegankelijkheid,
 * het is ook de opheffing van de contrastwaarschuwing op de lichte reekskleuren.
 */

import { lineChart, barChart, funnelChart, donutChart } from '../charts.js';
import {
  fmt, esc, kpi, kpiMetriek, tabel, figure, doelRij, renderBudget,
} from './components.js';
import { toonKorteDatum, toonBereik } from '../filters/period.js';

const nf = new Intl.NumberFormat('nl-NL');
const cf = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

const DOEL_META = {
  omzet: { label: 'Omzet', format: fmt.euro },
  roas: { label: 'ROAS', format: fmt.ratio },
  aankopen: { label: 'Aankopen', format: fmt.getal },
  maandbudget: { label: 'Budgetbesteding', format: fmt.euro },
};

const vgl = (d) => (d.vergelijkingActief ? d.vergelijking.label.toLowerCase() : 'de vorige periode');

/* ---------------------------------------------------------------
   Hoofdweergave
   --------------------------------------------------------------- */

export function renderEcommerceClient(dashboard, verhaal) {
  const { client, periode, totalen, deltas } = dashboard;

  const kop = `<header class="page-head">
      <h1>${esc(client.name)}</h1>
      <p>E-commerce · ${esc(client.accountmanager)} · ${esc(client.land)} · ${esc(toonBereik(periode.startDate, periode.endDate))}</p>
    </header>`;

  if (!dashboard.heeftData) {
    return `${kop}<section class="card leeg-blok" id="geenDataBlok">
      <h2>Geen data voor deze selectie</h2>
      <p class="muted">Er zijn geen gegevens voor deze periode en kanaalselectie. Kies een langere periode of voeg een kanaal toe.</p>
    </section>`;
  }

  const label = vgl(dashboard);
  const m = (key, opties = {}) => kpiMetriek(totalen, key, deltas, { vergelijkingLabel: label, ...opties });

  return `
    ${kop}
    ${renderMeldingen(dashboard)}

    <div class="kpi-row">
      ${m('revenue', { label: 'Omzet' })}
      ${m('purchases', { label: 'Aankopen' })}
      ${m('roas', { label: 'ROAS' })}
      ${m('cpa', { label: 'Kosten per aankoop' })}
      ${m('aov', { label: 'Gemiddelde orderwaarde' })}
      ${m('spend', { label: 'Spend' })}
      ${m('conversieratio', { label: 'Conversieratio' })}
      ${m('winkelwagenratio', { label: 'Winkelwagenratio' })}
      ${m('checkoutratio', { label: 'Checkoutratio' })}
      ${m('aankoopratio', { label: 'Aankoopratio' })}
    </div>

    ${renderBudget(dashboard)}
    ${renderDoelen(dashboard)}

    <div class="chart-grid">
      ${renderOntwikkeling(dashboard)}
      ${renderRoasReeks(dashboard)}
    </div>

    ${renderFunnel(dashboard)}

    <div class="chart-grid">
      ${renderKanalen(dashboard)}
      ${renderMatchtypes(dashboard)}
    </div>

    ${renderProductfeed(dashboard.profiel?.merchantCenter)}
    ${renderZoekwoorden(dashboard)}
    ${renderSearchConsole(dashboard.profiel?.searchConsole)}
  `;
}

function renderMeldingen(dashboard) {
  if (!dashboard.meldingen.length) return '';
  return `<div class="banner banner-info datakwaliteit" role="status">
    <strong>Datakwaliteit</strong>
    <ul>${dashboard.meldingen.map((m) => `<li>${esc(m.tekst)}</li>`).join('')}</ul>
  </div>`;
}

function renderDoelen(dashboard) {
  return `<section class="card">
    <h2>Doelen tegenover werkelijkheid</h2>
    <ul class="goal-list">${dashboard.doelen.map((d) => {
      const meta = DOEL_META[d.kpi] ?? { label: d.kpi, format: fmt.getal };
      return doelRij(d, { label: meta.label, format: meta.format });
    }).join('')}</ul>
    <p class="muted note">
      Maanddoelen worden naar rato van de geselecteerde periode omgerekend.
      Verhoudingen zoals de ROAS schalen niet mee.
    </p>
  </section>`;
}

function punteLabel(punt) {
  return punt.tot && punt.tot !== punt.date
    ? `${toonKorteDatum(punt.date)} – ${toonKorteDatum(punt.tot)}`
    : toonKorteDatum(punt.date);
}

function renderOntwikkeling(dashboard) {
  const { punten, stap } = dashboard.reeks;
  return figure(
    'chart-omzet-kosten',
    'Uitgaven en omzet in de geselecteerde periode',
    `Ontwikkeling van advertentiekosten tegenover de opgeleverde omzet. Weergave per ${stap}.`,
    tabel(
      ['Periode', 'Uitgaven', 'Omzet', 'ROAS'],
      punten.map((p) => [
        esc(punteLabel(p)),
        p.spend == null ? '<span class="muted">Geen data</span>' : fmt.euro(p.spend),
        p.revenue == null ? '<span class="muted">Geen data</span>' : fmt.euro(p.revenue),
        p.spend && p.revenue != null ? fmt.ratio(p.revenue / p.spend) : '<span class="muted">Niet te berekenen</span>',
      ])
    ),
    'Advertentiekanalen en Google Analytics 4'
  );
}

function renderRoasReeks(dashboard) {
  const { punten, stap } = dashboard.reeks;
  return figure(
    'chart-roas',
    'ROAS-ontwikkeling',
    `Rendement op advertentie-uitgaven binnen de geselecteerde periode. Weergave per ${stap}.`,
    tabel(
      ['Periode', 'ROAS', 'Transacties', 'Kosten per transactie'],
      punten.map((p) => [
        esc(punteLabel(p)),
        p.spend && p.revenue != null ? fmt.ratio(p.revenue / p.spend) : '<span class="muted">Niet te berekenen</span>',
        p.purchases == null ? '<span class="muted">Geen data</span>' : fmt.getal(p.purchases),
        p.spend != null && p.purchases ? fmt.euro2(p.spend / p.purchases) : '<span class="muted">Niet te berekenen</span>',
      ])
    ),
    'Advertentiekanalen en Google Analytics 4'
  );
}

function renderFunnel(dashboard) {
  const { rijen, knelpunt, onvoldoendeVolume, minimumVolume } = dashboard.funnel;

  const knelpuntTekst = knelpunt
    ? `Het grootste verlies zit bij de stap ${knelpunt.label}: daar valt ${fmt.procent(100 - knelpunt.doorstroom)} van de voorgaande stap af.`
    : onvoldoendeVolume
      ? `Onvoldoende data. Met minder dan ${minimumVolume} productweergaven in deze selectie wordt er geen knelpunt aangewezen.`
      : 'Er is onvoldoende data om een knelpunt te bepalen.';

  return `<section class="ecomfunnel">
    ${figure(
      'chart-funnel',
      'E-commerce funnel',
      'Van productweergave tot aankoop, met doorstroom en uitval per stap.',
      tabel(
        ['Stap', 'Volume', 'Vorige periode', 'Doorstroom', 'Uitval'],
        rijen.map((s) => [
          esc(s.label),
          s.volume == null ? '<span class="muted">Onvoldoende data</span>' : fmt.getal(s.volume),
          s.vorigePeriode == null ? '<span class="muted">Niet beschikbaar</span>' : fmt.getal(s.vorigePeriode),
          s.doorstroom == null ? '<span class="muted">Onvoldoende data</span>' : fmt.procent(s.doorstroom),
          s.uitval == null ? '<span class="muted">Onvoldoende data</span>' : fmt.getal(s.uitval),
        ])
      ),
      'Google Analytics 4',
      300
    )}
    <div class="banner banner-warning" role="note">
      <strong>Knelpunt</strong>
      <span>${esc(knelpuntTekst)}</span>
    </div>
  </section>`;
}

function renderKanalen(dashboard) {
  return figure(
    'chart-kanaal-omzet',
    'Omzet per kanaal',
    'Welke advertentiekanalen de omzet opleveren binnen de geselecteerde periode.',
    tabel(
      ['Kanaal', 'Uitgaven', 'Sessies', 'Aankopen', 'Omzet', 'ROAS', 'Conversieratio'],
      dashboard.kanaalRijen.map((k) => [
        esc(k.label),
        fmt.euro(k.spend),
        fmt.getal(k.sessions),
        fmt.getal(k.purchases),
        fmt.euro(k.revenue),
        k.roas == null ? '<span class="muted">Niet te berekenen</span>' : fmt.ratio(k.roas),
        fmt.procent(k.conversieratio),
      ])
    ),
    'Advertentiekanalen en Google Analytics 4'
  );
}

function renderMatchtypes(dashboard) {
  const matchtypes = dashboard.profiel?.googleAds?.matchtypes ?? [];

  if (!matchtypes.length) {
    return `<section class="card">
      <h2>Rendement per matchtype</h2>
      <p class="empty">Google Ads staat niet in de huidige kanaalselectie, dus er zijn geen matchtypes.</p>
    </section>`;
  }

  return figure(
    'chart-matchtype',
    'Rendement per matchtype',
    'Hoe brede, phrase- en exacte zoekwoorden zich verhouden binnen Google Ads.',
    tabel(
      ['Matchtype', 'Kosten', 'Conversies', 'CPA', 'ROAS'],
      matchtypes.map((m) => [
        esc(m.matchtype), fmt.euro(m.kosten), fmt.getal(m.conversies), fmt.euro2(m.cpa), fmt.ratio(m.roas),
      ])
    ),
    'Google Ads'
  );
}

function renderProductfeed(mc) {
  if (!mc) return '';
  const pct = (n) => (mc.totaalProducten ? (n / mc.totaalProducten) * 100 : null);
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
    <p class="muted note">
      De feedstatus is een momentopname en beweegt niet mee met de geselecteerde periode.
      Laatste synchronisatie: ${new Date(mc.laatsteSync).toLocaleString('nl-NL')}. Bron: Google Merchant Center.
    </p>
  </section>`;
}

function renderZoekwoorden(dashboard) {
  const zoekwoorden = dashboard.profiel?.googleAds?.zoekwoorden ?? [];

  return `<section class="card">
    <h2>Zoekwoorden</h2>
    ${!zoekwoorden.length
      ? '<p class="empty">Google Ads staat niet in de huidige kanaalselectie, dus er zijn geen zoekwoorden.</p>'
      : `<div class="table-scroll">
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
            z.roas == null
              ? '<span class="muted">Niet te berekenen</span>'
              : `<span class="${z.roas >= 3 ? 'trend-positief' : z.roas >= 1 ? 'trend-neutraal' : 'trend-negatief'}">${fmt.ratio(z.roas)}</span>`,
          ])
        )}
      </div>
      <p class="muted note">
        Bron: Google Ads. De verdeling over zoekwoorden is in deze demo een vaste verhouding
        die met de geselecteerde periode meeschaalt.
      </p>`}
  </section>`;
}

function renderSearchConsole(sc) {
  if (!sc) return '';
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
    <p class="muted note">
      Organische cijfers komen uit een aparte bron met een eigen attributievenster en volgen
      de kanaalselectie niet. Laatste beschikbare datum: ${esc(sc.laatsteDatum)}. Bron: Google Search Console.
    </p>
  </section>`;
}

/* ---------------------------------------------------------------
   Grafieken
   --------------------------------------------------------------- */

export function drawEcommerceCharts(dashboard) {
  if (!dashboard?.heeftData) return;

  const punten = dashboard.reeks.punten;
  const labels = punten.map(punteLabel);

  barChart('chart-omzet-kosten', {
    labels,
    series: [
      { label: 'Uitgaven', data: punten.map((p) => p.spend) },
      { label: 'Omzet', data: punten.map((p) => p.revenue) },
    ],
    valueFormatter: (v) => cf.format(v),
  });

  lineChart('chart-roas', {
    labels,
    series: [{
      label: 'ROAS',
      data: punten.map((p) => (p.spend && p.revenue != null ? p.revenue / p.spend : null)),
    }],
    valueFormatter: (v) => `${Number(v).toFixed(1)}×`,
  });

  funnelChart('chart-funnel', {
    stappen: dashboard.funnel.rijen.filter((s) => s.volume != null),
    valueFormatter: (v) => nf.format(Math.round(v)),
  });

  const kanalen = [...dashboard.kanaalRijen].sort((a, b) => (b.revenue ?? 0) - (a.revenue ?? 0));
  barChart('chart-kanaal-omzet', {
    labels: kanalen.map((k) => k.label),
    horizontal: true,
    series: [{ label: 'Omzet', data: kanalen.map((k) => k.revenue ?? 0) }],
    valueFormatter: (v) => cf.format(v),
  });

  const matchtypes = dashboard.profiel?.googleAds?.matchtypes ?? [];
  if (matchtypes.length) {
    donutChart('chart-matchtype', {
      labels: matchtypes.map((m) => m.matchtype),
      data: matchtypes.map((m) => m.kosten),
      valueFormatter: (v) => cf.format(v),
    });
  }
}
