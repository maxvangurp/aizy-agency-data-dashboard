/**
 * Applicatieshell.
 *
 * Verantwoordelijk voor navigatie, filters, thema en het renderen van
 * schermen. Alle data komt via de dataProvider, alle toestand via state.
 */

import { DataMode, DataStatus, fetchResource, hasBackend } from './data-provider.js';
import { state, setState, subscribe, applyTheme, toggleTheme, setResource, getResource } from './state.js';
import {
  SAMPLE_CLIENTS,
  SAMPLE_ALERTS,
  SAMPLE_OVERVIEW,
  BUSINESS_MODEL_LABELS,
  PRIMARY_KPIS,
  BusinessModel,
  getClient,
} from './sample-data.js';
import { renderEcommerceClient, drawEcommerceCharts } from './views/ecommerce.js';
import { destroyAllCharts } from './charts.js';

const NAV = [
  { id: 'overview', label: 'Overzicht' },
  { id: 'customers', label: 'Klanten' },
  { id: 'channels', label: 'Kanalen' },
  { id: 'actions', label: 'Acties' },
  { id: 'integration', label: 'Integraties' },
];

const PERIODS = [
  { id: 'laatste-7-dagen', label: 'Laatste 7 dagen' },
  { id: 'laatste-30-dagen', label: 'Laatste 30 dagen' },
  { id: 'deze-maand', label: 'Deze maand' },
  { id: 'dit-kwartaal', label: 'Dit kwartaal' },
  { id: 'dit-jaar', label: 'Dit jaar' },
];

const CHANNELS = ['Google Ads', 'Microsoft Ads', 'Meta Ads', 'LinkedIn Ads'];

/* ---------- formatters ---------- */

const nf = new Intl.NumberFormat('nl-NL');
const cf = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

const fmt = {
  getal: (v) => (v == null ? 'Niet beschikbaar' : nf.format(v)),
  euro: (v) => (v == null ? 'Niet beschikbaar' : cf.format(v)),
  ratio: (v) => (v == null ? 'Niet beschikbaar' : `${v.toFixed(1)}×`),
  procent: (v) => (v == null ? 'Niet beschikbaar' : `${v.toFixed(1)}%`),
};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

/** Verschil tussen twee waarden, met richting. Hogere CPA is niet positief. */
function delta(actueel, vorig, lagerIsBeter = false) {
  if (actueel == null || vorig == null || vorig === 0) {
    return { tekst: 'Niet beschikbaar', richting: 'neutraal' };
  }
  const pct = ((actueel - vorig) / vorig) * 100;
  const positief = lagerIsBeter ? pct < 0 : pct > 0;
  return {
    tekst: `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`,
    richting: Math.abs(pct) < 0.5 ? 'neutraal' : positief ? 'positief' : 'negatief',
  };
}

/* ---------- statusbanners ---------- */

function statusBanner(resource) {
  if (!resource) return '';
  const { status, message } = resource;
  if (status === DataStatus.LIVE) return '';

  const variants = {
    [DataStatus.SAMPLE]: { klasse: 'info', label: 'Demodata' },
    [DataStatus.EMPTY]: { klasse: 'muted', label: 'Geen data' },
    [DataStatus.ERROR]: { klasse: 'danger', label: 'Fout' },
    [DataStatus.LOADING]: { klasse: 'muted', label: 'Laden' },
    [DataStatus.PARTIAL]: { klasse: 'warning', label: 'Gedeeltelijk' },
  };
  const variant = variants[status] ?? variants[DataStatus.EMPTY];
  return `<div class="banner banner-${variant.klasse}" role="status">
    <strong>${variant.label}</strong>
    <span>${escapeHtml(message || '')}</span>
  </div>`;
}

/* ---------- schermen ---------- */

function renderOverview() {
  const resource = getResource('overview');
  const clients = filteredClients();
  const totaalSpend = clients.reduce((s, c) => s + c.spend, 0);
  const totaalBudget = clients.reduce((s, c) => s + c.maandbudget, 0);
  const pacing = totaalBudget ? (totaalSpend / totaalBudget) * 100 : 0;

  return `
    ${statusBanner(resource)}
    <header class="page-head">
      <h1>Agency-overzicht</h1>
      <p>Wat vandaag aandacht nodig heeft, gesorteerd op ernst.</p>
    </header>

    <div class="kpi-row">
      ${kpiCard('Totale spend', fmt.euro(totaalSpend), `van ${fmt.euro(totaalBudget)} budget`)}
      ${kpiCard('Budget pacing', fmt.procent(pacing), pacing > 100 ? 'Boven budget' : 'Binnen budget', pacing > 100 ? 'negatief' : 'positief')}
      ${kpiCard('Klanten', fmt.getal(clients.length), 'actief in deze selectie')}
      ${kpiCard('Open signalen', fmt.getal(SAMPLE_ALERTS.length), `${SAMPLE_ALERTS.filter((a) => a.ernst === 'hoog').length} met hoge ernst`, SAMPLE_ALERTS.length ? 'negatief' : 'positief')}
    </div>

    <section class="card">
      <h2>Wat heeft vandaag aandacht nodig?</h2>
      ${SAMPLE_ALERTS.length === 0
        ? '<p class="empty">Geen openstaande signalen.</p>'
        : `<ul class="alert-list">${SAMPLE_ALERTS.map(alertRow).join('')}</ul>`}
    </section>

    <section class="card">
      <h2>Klanten</h2>
      ${clients.length === 0
        ? '<p class="empty">Geen klanten in deze selectie.</p>'
        : `<div class="table-scroll"><table>
            <thead><tr>
              <th>Klant</th><th>Bedrijfsmodel</th><th>Spend</th>
              <th>Budget</th><th>Pacing</th><th>Primair resultaat</th><th>Tracking</th>
            </tr></thead>
            <tbody>${clients.map(clientRow).join('')}</tbody>
          </table></div>`}
    </section>
  `;
}

function kpiCard(label, waarde, subtekst = '', richting = 'neutraal') {
  return `<article class="card kpi">
    <span class="kpi-label">${escapeHtml(label)}</span>
    <span class="kpi-value">${escapeHtml(waarde)}</span>
    <span class="kpi-sub trend-${richting}">${escapeHtml(subtekst)}</span>
  </article>`;
}

function alertRow(alert) {
  const client = getClient(alert.klantId);
  return `<li class="alert alert-${escapeHtml(alert.ernst)}">
    <div class="alert-head">
      <span class="badge badge-${escapeHtml(alert.ernst)}">${alert.ernst === 'hoog' ? 'Hoge ernst' : 'Middelmatige ernst'}</span>
      <strong>${escapeHtml(client?.name ?? 'Onbekende klant')}</strong>
      <span class="muted">${escapeHtml(alert.kanaal)}</span>
    </div>
    <p class="alert-problem">${escapeHtml(alert.probleem)}</p>
    <p class="alert-meta"><span class="muted">Mogelijke oorzaak:</span> ${escapeHtml(alert.oorzaak)}</p>
    <p class="alert-meta"><span class="muted">Aanbevolen actie:</span> ${escapeHtml(alert.aanbeveling)}</p>
  </li>`;
}

function clientRow(client) {
  const pacing = (client.spend / client.maandbudget) * 100;
  const primair = primaryResult(client);
  const trackingLabels = {
    gezond: 'Gezond',
    'controle-aanbevolen': 'Controle aanbevolen',
    probleem: 'Probleem',
  };
  return `<tr>
    <td><button class="link" data-client="${escapeHtml(client.id)}">${escapeHtml(client.name)}</button></td>
    <td><span class="tag">${escapeHtml(BUSINESS_MODEL_LABELS[client.businessModel])}</span></td>
    <td>${fmt.euro(client.spend)}</td>
    <td>${fmt.euro(client.maandbudget)}</td>
    <td class="${pacing > 100 ? 'trend-negatief' : 'trend-positief'}">${fmt.procent(pacing)}</td>
    <td>${escapeHtml(primair)}</td>
    <td><span class="badge badge-${client.trackingStatus === 'gezond' ? 'ok' : client.trackingStatus === 'probleem' ? 'hoog' : 'middel'}">${escapeHtml(trackingLabels[client.trackingStatus])}</span></td>
  </tr>`;
}

/** Het primaire resultaat verschilt per bedrijfsmodel. */
function primaryResult(client) {
  switch (client.businessModel) {
    case BusinessModel.ECOMMERCE:
      return `${fmt.euro(client.kpis.omzet)} omzet · ${fmt.ratio(client.kpis.roas)} ROAS`;
    case BusinessModel.LEADGEN:
      return `${fmt.getal(client.kpis.leads)} leads · ${fmt.euro(client.kpis.cpl)} CPL`;
    case BusinessModel.AWARENESS:
      return `${fmt.getal(client.kpis.bereik)} bereik · ${fmt.euro(client.kpis.cpm)} CPM`;
    default:
      return 'Niet ingesteld';
  }
}

function renderCustomer() {
  const client = getClient(state.customerId) ?? SAMPLE_CLIENTS[0];
  if (!client) return '<p class="empty">Geen klant geselecteerd.</p>';

  // Het bedrijfsmodel bepaalt welk klantdashboard wordt getoond.
  if (client.businessModel === BusinessModel.ECOMMERCE) {
    return statusBanner(getResource('overview')) + renderEcommerceClient(client);
  }

  const kpiKeys = PRIMARY_KPIS[client.businessModel] ?? [];
  const labels = {
    omzet: 'Omzet', aankopen: 'Aankopen', roas: 'ROAS', cpa: 'Kosten per aankoop',
    aov: 'Gemiddelde orderwaarde', conversieratio: 'Conversieratio',
    leads: 'Leads', gekwalificeerdeLeads: 'Gekwalificeerde leads', cpl: 'Kosten per lead',
    cpql: 'Kosten per gekwalificeerde lead', afspraken: 'Afspraken', pipelinewaarde: 'Pipelinewaarde',
    bereik: 'Bereik', impressies: 'Impressies', frequentie: 'Frequentie', cpm: 'CPM',
    videoWeergaven: 'Videoweergaven', engagement: 'Engagement',
  };
  const formatters = {
    omzet: fmt.euro, cpa: fmt.euro, aov: fmt.euro, cpl: fmt.euro, cpql: fmt.euro,
    pipelinewaarde: fmt.euro, cpm: fmt.euro,
    roas: fmt.ratio, frequentie: fmt.ratio,
    conversieratio: fmt.procent, engagement: fmt.procent,
  };

  return `
    ${statusBanner(getResource('overview'))}
    <header class="page-head">
      <h1>${escapeHtml(client.name)}</h1>
      <p>${escapeHtml(BUSINESS_MODEL_LABELS[client.businessModel])} · ${escapeHtml(client.accountmanager)} · ${escapeHtml(periodLabel())}</p>
    </header>

    <div class="kpi-row">
      ${kpiCard('Spend', fmt.euro(client.spend), `van ${fmt.euro(client.maandbudget)}`)}
      ${kpiKeys.slice(0, 3).map((key) => {
        const format = formatters[key] ?? fmt.getal;
        const vorig = client.vorigePeriode?.[key];
        const lagerIsBeter = ['cpa', 'cpl', 'cpql', 'cpm', 'frequentie'].includes(key);
        const d = delta(client.kpis[key], vorig, lagerIsBeter);
        return kpiCard(labels[key] ?? key, format(client.kpis[key]), `${d.tekst} t.o.v. vorige periode`, d.richting);
      }).join('')}
    </div>

    <section class="card">
      <h2>Doelen tegenover werkelijkheid</h2>
      ${(client.doelen ?? []).length === 0
        ? '<p class="empty">Nog geen doelen ingesteld.</p>'
        : `<ul class="goal-list">${client.doelen.map((doel) => {
            const format = formatters[doel.kpi] ?? fmt.getal;
            const lagerIsBeter = ['cpa', 'cpl', 'cpql', 'cpm'].includes(doel.kpi);
            const behaald = lagerIsBeter
              ? (doel.target / doel.actueel) * 100
              : (doel.actueel / doel.target) * 100;
            const opSchema = behaald >= 100;
            return `<li class="goal">
              <div class="goal-head">
                <strong>${escapeHtml(labels[doel.kpi] ?? doel.kpi)}</strong>
                <span class="${opSchema ? 'trend-positief' : 'trend-negatief'}">
                  ${escapeHtml(format(doel.actueel))} van ${escapeHtml(format(doel.target))}
                </span>
              </div>
              <div class="progress" role="img" aria-label="${behaald.toFixed(0)} procent behaald">
                <span style="width:${Math.min(behaald, 100).toFixed(1)}%" class="${opSchema ? 'is-ok' : 'is-behind'}"></span>
              </div>
              <span class="muted">${behaald.toFixed(0)} procent behaald</span>
            </li>`;
          }).join('')}</ul>`}
    </section>
  `;
}

function renderChannels() {
  const clients = filteredClients();
  const perChannel = new Map();
  for (const client of clients) {
    for (const kanaal of client.kanalen) {
      if (state.channel !== 'all' && kanaal !== state.channel) continue;
      const entry = perChannel.get(kanaal) ?? { kanaal, klanten: 0, spend: 0 };
      entry.klanten += 1;
      entry.spend += Math.round(client.spend / client.kanalen.length);
      perChannel.set(kanaal, entry);
    }
  }
  const rows = [...perChannel.values()].sort((a, b) => b.spend - a.spend);

  return `
    <header class="page-head">
      <h1>Kanalen</h1>
      <p>Spend en dekking per kanaal binnen de huidige selectie.</p>
    </header>
    <section class="card">
      ${rows.length === 0
        ? '<p class="empty">Geen kanalen in deze selectie.</p>'
        : `<div class="table-scroll"><table>
            <thead><tr><th>Kanaal</th><th>Klanten</th><th>Spend (verdeeld)</th></tr></thead>
            <tbody>${rows.map((r) => `<tr>
              <td>${escapeHtml(r.kanaal)}</td>
              <td>${fmt.getal(r.klanten)}</td>
              <td>${fmt.euro(r.spend)}</td>
            </tr>`).join('')}</tbody>
          </table></div>`}
      <p class="muted note">Spend is proportioneel verdeeld over de kanalen van een klant. Fase 4 vervangt dit door werkelijke kanaalcijfers.</p>
    </section>
  `;
}

function renderActions() {
  return `
    <header class="page-head">
      <h1>Acties</h1>
      <p>Acties die volgen uit de openstaande signalen.</p>
    </header>
    <section class="card">
      <div class="table-scroll"><table>
        <thead><tr><th>Actie</th><th>Klant</th><th>Kanaal</th><th>Prioriteit</th></tr></thead>
        <tbody>${SAMPLE_ALERTS.map((a) => {
          const client = getClient(a.klantId);
          return `<tr>
            <td>${escapeHtml(a.aanbeveling)}</td>
            <td>${escapeHtml(client?.name ?? 'Onbekend')}</td>
            <td>${escapeHtml(a.kanaal)}</td>
            <td><span class="badge badge-${escapeHtml(a.ernst)}">${a.ernst === 'hoog' ? 'Hoog' : 'Middel'}</span></td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>
      <p class="muted note">Het volledige actiecentrum met status, eigenaar en deadline volgt in fase 5.</p>
    </section>
  `;
}

function renderIntegration() {
  const resource = getResource('integration');
  const providers = [
    { naam: 'Google Ads', status: 'niet-gekoppeld' },
    { naam: 'Google Analytics 4', status: 'niet-gekoppeld' },
    { naam: 'Google Merchant Center', status: 'niet-gekoppeld' },
    { naam: 'Google Search Console', status: 'niet-gekoppeld' },
    { naam: 'Microsoft Ads', status: 'niet-gekoppeld' },
    { naam: 'Meta Ads', status: 'niet-gekoppeld' },
    { naam: 'LinkedIn Ads', status: 'niet-gekoppeld' },
    { naam: 'Google Business Profile', status: 'toekomstig' },
  ];

  return `
    ${statusBanner(resource)}
    <header class="page-head">
      <h1>Integraties</h1>
      <p>Koppelingen met advertentie- en analyseplatformen.</p>
    </header>
    ${!state.backendAvailable
      ? `<div class="banner banner-info"><strong>Geen backend</strong><span>Deze versie draait statisch. Koppelen is alleen mogelijk met de lokale server.</span></div>`
      : ''}
    <div class="card-grid">
      ${providers.map((p) => `<article class="card">
        <h3>${escapeHtml(p.naam)}</h3>
        <span class="badge badge-${p.status === 'toekomstig' ? 'muted' : 'middel'}">
          ${p.status === 'toekomstig' ? 'Nog niet beschikbaar' : 'Niet gekoppeld'}
        </span>
        <p class="muted">${p.status === 'toekomstig'
          ? 'Een echte koppeling is nog niet gebouwd.'
          : 'Nog geen account gekoppeld.'}</p>
      </article>`).join('')}
    </div>
  `;
}

/* ---------- helpers ---------- */

function filteredClients() {
  return SAMPLE_CLIENTS.filter((c) => state.customerId === 'all' || c.id === state.customerId)
    .filter((c) => state.channel === 'all' || c.kanalen.includes(state.channel));
}

function periodLabel() {
  return PERIODS.find((p) => p.id === state.period)?.label ?? 'Deze maand';
}

/* ---------- data laden ---------- */

async function loadOverview() {
  setResource('overview', { status: DataStatus.LOADING, message: 'Laden...' });
  const res = await fetchResource('/api/overview', () => SAMPLE_OVERVIEW);
  setResource('overview', res);
}

async function loadIntegration() {
  setResource('integration', { status: DataStatus.LOADING, message: 'Laden...' });
  const res = await fetchResource('/api/google/resources', () => ({ providers: [] }));
  setResource('integration', res);
}

/* ---------- render ---------- */

const PAGES = {
  overview: renderOverview,
  customers: renderCustomer,
  channels: renderChannels,
  actions: renderActions,
  integration: renderIntegration,
};

function render() {
  document.getElementById('nav').innerHTML = NAV.map((item) => `
    <button type="button" data-page="${item.id}"
      class="${state.page === item.id ? 'active' : ''}"
      aria-current="${state.page === item.id ? 'page' : 'false'}">${item.label}</button>
  `).join('');

  const modeBtn = document.getElementById('modeBtn');
  if (modeBtn) {
    const sample = state.dataMode === DataMode.SAMPLE;
    modeBtn.textContent = sample ? 'Demodata' : 'Live data';
    modeBtn.dataset.mode = state.dataMode;
    modeBtn.disabled = !state.backendAvailable && !sample;
  }

  const themeBtn = document.getElementById('themeBtn');
  if (themeBtn) themeBtn.textContent = state.theme === 'dark' ? 'Lichte modus' : 'Donkere modus';

  // Chart.js-instanties opruimen voordat het canvas uit de DOM verdwijnt.
  destroyAllCharts();

  const main = document.getElementById('pageRoot');
  const renderer = PAGES[state.page] ?? renderOverview;
  main.innerHTML = renderer();

  // Grafieken tekenen nadat de canvassen in de DOM staan.
  if (state.page === 'customers') {
    const client = getClient(state.customerId) ?? SAMPLE_CLIENTS[0];
    if (client?.businessModel === BusinessModel.ECOMMERCE) drawEcommerceCharts(client);
  }
}

/* ---------- events ---------- */

function bindEvents() {
  document.getElementById('nav').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-page]');
    if (!btn) return;
    setState({ page: btn.dataset.page });
    if (btn.dataset.page === 'integration') loadIntegration();
  });

  document.getElementById('pageRoot').addEventListener('click', (e) => {
    const link = e.target.closest('button[data-client]');
    if (!link) return;
    setState({ customerId: link.dataset.client, page: 'customers' });
    syncFilterInputs();
  });

  document.getElementById('themeBtn').addEventListener('click', toggleTheme);

  document.getElementById('modeBtn').addEventListener('click', () => {
    const next = state.dataMode === DataMode.SAMPLE ? DataMode.LIVE : DataMode.SAMPLE;
    if (next === DataMode.LIVE && !state.backendAvailable) return;
    setState({ dataMode: next });
    loadOverview();
  });

  document.getElementById('customerFilter').addEventListener('change', (e) => setState({ customerId: e.target.value }));
  document.getElementById('channelFilter').addEventListener('change', (e) => setState({ channel: e.target.value }));
  document.getElementById('periodFilter').addEventListener('change', (e) => setState({ period: e.target.value }));
}

function populateFilters() {
  document.getElementById('customerFilter').innerHTML =
    '<option value="all">Alle klanten</option>' +
    SAMPLE_CLIENTS.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  document.getElementById('channelFilter').innerHTML =
    '<option value="all">Alle kanalen</option>' +
    CHANNELS.map((c) => `<option value="${c}">${c}</option>`).join('');
  document.getElementById('periodFilter').innerHTML =
    PERIODS.map((p) => `<option value="${p.id}">${p.label}</option>`).join('');
  syncFilterInputs();
}

function syncFilterInputs() {
  document.getElementById('customerFilter').value = state.customerId;
  document.getElementById('channelFilter').value = state.channel;
  document.getElementById('periodFilter').value = state.period;
}

/* ---------- start ---------- */

function init() {
  applyTheme();
  setState({ backendAvailable: hasBackend() });
  populateFilters();
  bindEvents();
  subscribe(render);
  render();
  loadOverview();
}

document.addEventListener('DOMContentLoaded', init);
