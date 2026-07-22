/**
 * Agencyomgeving voor medewerkers van Aizy.
 *
 * Alle data komt via de repository, die de gebruiker en de filtercontext
 * ontvangt. Deze module haalt zelf nooit uit sample-data, filtert zelf geen
 * datums of kanalen en berekent zelf geen totalen; ze bepaalt alleen hoe het
 * viewmodel op het scherm komt. Wat iemand mag, wordt via can() gevraagd.
 */

import {
  getTeamLeden, getToewijsbareKlanten, BUSINESS_MODEL_LABELS, BusinessModel,
} from '../data/repository.js';
import { can, Permission } from '../auth/permissions.js';
import { primaireRol, ROL_LABELS, ACCOUNT_STATUS_LABELS, AccountStatus } from '../auth/domain.js';
import { fmt, esc, kpi, tabel, badge, deltaTekst } from './components.js';
import { kanaalLabel } from '../filters/channels.js';
import { toonBereik, toonDatum, DATA_VOLLEDIG_TOT } from '../filters/period.js';
import { PACING_LABELS, PacingStatus } from '../data/selectors.js';

/* ---------------------------------------------------------------
   Begroeting
   --------------------------------------------------------------- */

/** Dagdeel op basis van de lokale tijd van de lezer. */
function dagdeel() {
  const uur = new Date().getHours();
  if (uur < 6) return 'Goedenacht';
  if (uur < 12) return 'Goedemorgen';
  if (uur < 18) return 'Goedemiddag';
  return 'Goedenavond';
}

function begroeting(user, aantalKlanten, periode) {
  const beheert = can(user, Permission.VIEW_ALL_CLIENTS)
    ? `Je hebt toegang tot alle ${aantalKlanten} klanten.`
    : aantalKlanten === 0
      ? 'Er zijn nog geen klanten aan je account toegewezen.'
      : `Je beheert ${aantalKlanten === 1 ? '1 klant' : `${aantalKlanten} klanten`}.`;

  return `<header class="page-head">
    <h1>${esc(dagdeel())}, ${esc(user.firstName)}</h1>
    <p>${esc(beheert)}${periode ? ` Weergave: ${esc(toonBereik(periode.startDate, periode.endDate))}.` : ''}</p>
  </header>`;
}

/** Getoond wanneer een medewerker nog geen toewijzingen heeft. */
function geenKlantenToegewezen() {
  return `<section class="card leeg-blok">
    <h2>Nog geen klanten toegewezen</h2>
    <p class="muted">
      Er zijn nog geen klanten aan je account toegewezen.
      Vraag een agencybeheerder om een klant toe te voegen.
    </p>
  </section>`;
}

/* ---------------------------------------------------------------
   Overzicht
   --------------------------------------------------------------- */

export function renderAgencyOverview(user, { overview, inzichten, filterbalk = '' }) {
  if (!overview.aantalKlanten) {
    return begroeting(user, 0, null) + geenKlantenToegewezen();
  }

  const label = overview.filters.vergelijkingActief
    ? overview.filters.vergelijking.label.toLowerCase()
    : 'de vorige periode';

  return `
    ${begroeting(user, overview.aantalKlanten, overview.filters.periode)}
    ${filterbalk}

    <div class="kpi-row">
      ${kpi('Actieve klanten', fmt.getal(overview.aantalKlanten), `${overview.opKoers} op koers, ${overview.aandachtNodig} aandacht nodig`)}
      ${kpi('Advertentie-uitgaven', fmt.euro(overview.totaleSpend),
        deltaTekst(overview.deltas.spend, label) || `van ${fmt.euro(overview.totaalBudget)} budget`,
        overview.deltas.spend?.richting ?? 'neutraal')}
      ${kpi('Budgetbesteding', overview.pacing == null ? 'Niet beschikbaar' : fmt.procent(overview.pacing),
        overview.pacing == null ? 'Geen budget vastgelegd'
          : `${fmt.euro(overview.totaleSpend)} van ${fmt.euro(overview.totaalBudget)} voor deze periode`,
        overview.pacing == null ? 'neutraal' : overview.pacing > 105 ? 'negatief' : 'positief')}
      ${kpi('Open signalen', fmt.getal(overview.openSignalen),
        overview.trackingProblemen ? `${overview.trackingProblemen} met trackingprobleem` : 'geen trackingproblemen',
        overview.openSignalen ? 'negatief' : 'positief')}
    </div>

    ${renderResultatenPerType(overview, label)}
    ${renderDekking(overview)}
    ${renderInzichten(inzichten)}
    ${renderSignalen(overview.signalen, overview.samenvattingen, overview.filters)}
  `;
}

/**
 * Resultaten gescheiden per bedrijfsmodel.
 *
 * Een gemiddelde ROAS over leadgeneratieklanten bestaat niet en een gemiddelde
 * CPL over webshops evenmin. Ze worden daarom naast elkaar getoond in plaats
 * van tot één getal samengevoegd.
 */
function renderResultatenPerType(overview, label) {
  const blokken = [];

  if (overview.ecommerce.aantal) {
    blokken.push(`<div class="type-blok">
      <h3>E-commerce <span class="muted">${overview.ecommerce.aantal} ${overview.ecommerce.aantal === 1 ? 'klant' : 'klanten'}</span></h3>
      <div class="kpi-row">
        ${kpi('Omzet', fmt.euro(overview.ecommerce.omzet), deltaTekst(overview.deltas.revenue, label) || 'deze periode', overview.deltas.revenue?.richting ?? 'neutraal')}
        ${kpi('Aankopen', fmt.getal(overview.ecommerce.aankopen), deltaTekst(overview.deltas.purchases, label) || 'deze periode', overview.deltas.purchases?.richting ?? 'neutraal')}
        ${kpi('Gemiddelde ROAS', overview.ecommerce.gemiddeldeRoas == null ? 'Onvoldoende data' : fmt.ratio(overview.ecommerce.gemiddeldeRoas), 'over e-commerceklanten')}
      </div>
    </div>`);
  }

  if (overview.leadgen.aantal) {
    blokken.push(`<div class="type-blok">
      <h3>Leadgeneratie <span class="muted">${overview.leadgen.aantal} ${overview.leadgen.aantal === 1 ? 'klant' : 'klanten'}</span></h3>
      <div class="kpi-row">
        ${kpi('Leads', fmt.getal(overview.leadgen.leads), deltaTekst(overview.deltas.leads, label) || 'deze periode', overview.deltas.leads?.richting ?? 'neutraal')}
        ${kpi('Gemiddelde CPL', overview.leadgen.gemiddeldeCpl == null ? 'Onvoldoende data' : fmt.euro2(overview.leadgen.gemiddeldeCpl), 'over leadgeneratieklanten')}
        ${kpi('Zonder CRM-koppeling', fmt.getal(overview.leadgen.zonderKwalificatie),
          overview.leadgen.zonderKwalificatie ? 'leadkwaliteit niet meetbaar' : 'alle klanten gekoppeld',
          overview.leadgen.zonderKwalificatie ? 'negatief' : 'positief')}
      </div>
    </div>`);
  }

  if (!blokken.length) return '';

  return `<section class="card">
    <h2>Resultaten per type</h2>
    <p class="muted">
      E-commerce en leadgeneratie worden apart getoond. Omzet, ROAS, leads en
      kosten per lead zijn niet onderling vergelijkbaar.
    </p>
    ${blokken.join('')}
    ${overview.overig.aantal ? `<p class="muted note">${overview.overig.aantal} ${overview.overig.aantal === 1 ? 'klant heeft' : 'klanten hebben'} een bedrijfsmodel zonder eigen dashboard.</p>` : ''}
  </section>`;
}

/** Meldt onvolledige dekking in plaats van hem te verbergen achter een totaal. */
function renderDekking(overview) {
  if (!overview.onvolledigeDekking) return '';
  return `<div class="banner banner-info" role="status">
    <strong>Datakwaliteit</strong>
    <span>
      Bij ${overview.onvolledigeDekking} ${overview.onvolledigeDekking === 1 ? 'klant' : 'klanten'}
      is de data binnen deze periode niet volledig. Alle bronnen zijn compleet tot en met
      ${esc(toonDatum(DATA_VOLLEDIG_TOT))}.
    </span>
  </div>`;
}

function renderInzichten(inzichten) {
  if (!inzichten.length) return '';
  const variant = { positief: 'ok', negatief: 'hoog', aandacht: 'middel' };

  return `<section class="card">
    <h2>Portefeuille-inzichten</h2>
    <ul class="inzicht-lijst">
      ${inzichten.map((i) => `<li class="inzicht inzicht-${esc(i.soort)}">
        <div class="inzicht-kop">
          ${badge(i.titel, variant[i.soort] ?? 'muted')}
        </div>
        <p>${esc(i.tekst)}</p>
      </li>`).join('')}
    </ul>
  </section>`;
}

function renderSignalen(signalen, samenvattingen, filters) {
  const naam = (id) => samenvattingen.find((s) => s.client.id === id)?.client.name ?? 'Onbekende klant';

  return `<section class="card">
    <h2>Signalen</h2>
    ${!signalen.length
      ? `<p class="empty">Er zijn geen signalen binnen ${esc(toonBereik(filters.periode.startDate, filters.periode.endDate))} voor de geselecteerde kanalen.</p>`
      : `<ul class="alert-list">${signalen.map((a) => `<li class="alert alert-${esc(a.ernst)}">
          <div class="alert-head">
            ${badge(a.ernst === 'hoog' ? 'Hoge ernst' : 'Middelmatige ernst', a.ernst === 'hoog' ? 'hoog' : 'middel')}
            <strong>${esc(naam(a.klantId))}</strong>
            <span class="muted">${esc(a.kanaalLabel ?? kanaalLabel(a.kanaal))}</span>
          </div>
          <p class="alert-problem">${esc(a.probleem)}</p>
          <p class="alert-meta"><span class="muted">Mogelijke oorzaak:</span> ${esc(a.oorzaak)}</p>
          <p class="alert-meta"><span class="muted">Aanbevolen actie:</span> ${esc(a.aanbeveling)}</p>
        </li>`).join('')}</ul>`}
  </section>`;
}

/* ---------------------------------------------------------------
   Klantenoverzicht
   --------------------------------------------------------------- */

/**
 * @param {object} user
 * @param {{samenvattingen: object[], filters: object, klantFilters: object, filterbalk: string}} model
 */
export function renderAgencyClients(user, { samenvattingen, filters, klantFilters = {}, filterbalk = '' }) {
  const titel = can(user, Permission.VIEW_ALL_CLIENTS) ? 'Klanten' : 'Mijn klanten';

  if (!samenvattingen.length) {
    return `<header class="page-head"><h1>${titel}</h1></header>` + geenKlantenToegewezen();
  }

  const zoek = (klantFilters.zoek ?? '').toLowerCase().trim();
  const gefilterd = samenvattingen
    .filter((s) => !zoek || s.client.name.toLowerCase().includes(zoek))
    .filter((s) => !klantFilters.medewerker || s.client.accountmanager === klantFilters.medewerker)
    .filter((s) => !klantFilters.type || s.client.businessModel === klantFilters.type)
    .filter((s) => !klantFilters.status || s.status.code === klantFilters.status);

  const gesorteerd = sorteerKlanten(gefilterd, klantFilters.sorteer);
  const medewerkers = [...new Set(samenvattingen.map((s) => s.client.accountmanager))].sort();
  const typen = [...new Set(samenvattingen.map((s) => s.client.businessModel))];

  return `
    <header class="page-head">
      <h1>${titel}</h1>
      <p>${gesorteerd.length} van ${samenvattingen.length} ${samenvattingen.length === 1 ? 'klant' : 'klanten'} getoond · ${esc(toonBereik(filters.periode.startDate, filters.periode.endDate))}.</p>
    </header>

    ${filterbalk}

    <section class="card">
      <div class="filterbalk">
        <div class="veld">
          <label for="klantZoek">Zoeken</label>
          <input type="search" id="klantZoek" value="${esc(klantFilters.zoek ?? '')}" placeholder="Klantnaam">
        </div>
        <div class="veld">
          <label for="klantMedewerker">Medewerker</label>
          <select id="klantMedewerker">
            <option value="">Alle medewerkers</option>
            ${medewerkers.map((m) => `<option value="${esc(m)}"${klantFilters.medewerker === m ? ' selected' : ''}>${esc(m)}</option>`).join('')}
          </select>
        </div>
        <div class="veld">
          <label for="klantType">Type</label>
          <select id="klantType">
            <option value="">Alle types</option>
            ${typen.map((t) => `<option value="${esc(t)}"${klantFilters.type === t ? ' selected' : ''}>${esc(BUSINESS_MODEL_LABELS[t] ?? t)}</option>`).join('')}
          </select>
        </div>
        <div class="veld">
          <label for="klantStatus">Status</label>
          <select id="klantStatus">
            <option value="">Alle statussen</option>
            <option value="op-koers"${klantFilters.status === 'op-koers' ? ' selected' : ''}>Op koers</option>
            <option value="aandacht"${klantFilters.status === 'aandacht' ? ' selected' : ''}>Aandacht nodig</option>
            <option value="tracking"${klantFilters.status === 'tracking' ? ' selected' : ''}>Trackingprobleem</option>
            <option value="onvoldoende-data"${klantFilters.status === 'onvoldoende-data' ? ' selected' : ''}>Onvoldoende data</option>
            <option value="geen-doel"${klantFilters.status === 'geen-doel' ? ' selected' : ''}>Doel ontbreekt</option>
          </select>
        </div>
        <div class="veld">
          <label for="klantSorteer">Sorteren</label>
          <select id="klantSorteer">
            <option value="naam"${klantFilters.sorteer === 'naam' ? ' selected' : ''}>Naam</option>
            <option value="spend"${klantFilters.sorteer === 'spend' ? ' selected' : ''}>Uitgaven</option>
            <option value="pacing"${klantFilters.sorteer === 'pacing' ? ' selected' : ''}>Budgetbesteding</option>
            <option value="resultaat"${klantFilters.sorteer === 'resultaat' ? ' selected' : ''}>Primair resultaat</option>
          </select>
        </div>
      </div>

      ${!gesorteerd.length
        ? '<p class="empty">Geen klanten gevonden met deze filters.</p>'
        : `<div class="table-scroll">${klantTabel(gesorteerd)}</div>`}
    </section>`;
}

function sorteerKlanten(samenvattingen, sorteer) {
  const lijst = [...samenvattingen];
  switch (sorteer) {
    case 'spend': return lijst.sort((a, b) => (b.totalen.spend ?? 0) - (a.totalen.spend ?? 0));
    case 'pacing': return lijst.sort((a, b) => (b.budget.besteedPercentage ?? 0) - (a.budget.besteedPercentage ?? 0));
    case 'resultaat': return lijst.sort((a, b) => primair(b) - primair(a));
    default: return lijst.sort((a, b) => a.client.name.localeCompare(b.client.name, 'nl'));
  }
}

function primair(s) {
  if (s.client.businessModel === BusinessModel.ECOMMERCE) return s.totalen.revenue ?? 0;
  if (s.client.businessModel === BusinessModel.LEADGEN) return s.totalen.leads ?? 0;
  return 0;
}

function klantTabel(samenvattingen) {
  const statusVariant = {
    'op-koers': 'ok', aandacht: 'middel', tracking: 'hoog',
    'onvoldoende-data': 'muted', 'geen-doel': 'muted',
  };

  return tabel(
    ['Klant', 'Type', 'Medewerker', 'Kanalen', 'Uitgaven', 'Primair resultaat',
     'Status', 'Budgetbesteding', 'Datakwaliteit', 'Dekking', 'Laatste volledige dag'],
    samenvattingen.map((s) => {
      const c = s.client;
      const status = s.status;
      const besteed = s.budget.besteedPercentage;

      return [
        `<a class="link" href="#/agency/clients/${esc(c.id)}">${esc(c.name)}</a>`,
        `<span class="tag">${esc(BUSINESS_MODEL_LABELS[c.businessModel] ?? c.businessModel)}</span>`,
        esc(c.accountmanager),
        `<span class="muted">${esc(s.kanalen.map(kanaalLabel).join(', ') || 'Geen kanaal geselecteerd')}</span>`,
        fmt.euro(s.totalen.spend),
        primairResultaat(s),
        `${badge(status.label, statusVariant[status.code] ?? 'muted')}<br><span class="muted klein">${esc(status.reden)}</span>`,
        besteed == null ? '<span class="muted">Niet beschikbaar</span>'
          : `<span class="${s.budget.status === PacingStatus.BOVEN_BUDGET ? 'trend-negatief' : 'trend-positief'}">${fmt.procent(besteed)}</span>
             <br><span class="muted klein">${esc(PACING_LABELS[s.budget.status] ?? '')}</span>`,
        `${c.dataHealth} procent`,
        `${s.dekking.dagenMetData} van ${s.dekking.totaalDagen} dagen`,
        esc(toonDatum(DATA_VOLLEDIG_TOT)),
      ];
    })
  );
}

/** Het primaire resultaat verschilt per bedrijfsmodel. */
function primairResultaat(s) {
  const t = s.totalen;
  if (s.client.businessModel === BusinessModel.ECOMMERCE) {
    return `${fmt.euro(t.revenue)} omzet · ${t.roas == null ? 'ROAS onbekend' : `${fmt.ratio(t.roas)} ROAS`}`;
  }
  if (s.client.businessModel === BusinessModel.LEADGEN) {
    return `${fmt.getal(t.leads)} leads · ${t.qualifiedLeads == null ? 'kwalificatie niet gemeten' : `${fmt.getal(t.qualifiedLeads)} gekwalificeerd`}`;
  }
  return '<span class="muted">Geen primair resultaat ingesteld</span>';
}

/* ---------------------------------------------------------------
   Teambeheer
   --------------------------------------------------------------- */

export function renderAgencyTeam(user, { melding = null } = {}) {
  const leden = getTeamLeden(user);
  const klanten = getToewijsbareKlanten(user);

  return `
    <header class="page-head">
      <h1>Team</h1>
      <p>${leden.length} ${leden.length === 1 ? 'medewerker' : 'medewerkers'} bij Aizy.</p>
    </header>

    ${melding ? `<div class="banner banner-info" role="status"><span>${esc(melding)}</span></div>` : ''}

    <section class="card">
      <div class="kaart-kop">
        <h2>Medewerkers</h2>
        <button type="button" class="btn primary" id="nodigUitKnop">Medewerker uitnodigen</button>
      </div>

      <div class="table-scroll">
        ${tabel(
          ['Medewerker', 'Rol', 'Status', 'Toegewezen klanten', 'Aantal', 'Laatste login', 'Acties'],
          leden.map((lid) => {
            const rol = primaireRol(lid);
            const isBeheerder = rol === 'agency_admin';
            const namen = isBeheerder
              ? '<span class="muted">Alle klanten</span>'
              : (lid.clientAssignments ?? []).length
                ? (lid.clientAssignments ?? [])
                    .map((id) => klanten.find((c) => c.id === id)?.name ?? id)
                    .map((n) => `<span class="tag">${esc(n)}</span>`).join(' ')
                : '<span class="muted">Geen toewijzingen</span>';

            return [
              `<strong>${esc(lid.displayName)}</strong><br><span class="muted klein">${esc(lid.email)}</span>`,
              badge(ROL_LABELS[rol] ?? rol, isBeheerder ? 'ok' : 'muted'),
              badge(ACCOUNT_STATUS_LABELS[lid.status] ?? lid.status,
                lid.status === AccountStatus.ACTIEF ? 'ok'
                : lid.status === AccountStatus.UITGENODIGD ? 'middel' : 'hoog'),
              namen,
              isBeheerder ? '<span class="muted">n.v.t.</span>' : String((lid.clientAssignments ?? []).length),
              lid.laatsteLogin
                ? new Date(lid.laatsteLogin).toLocaleDateString('nl-NL')
                : '<span class="muted">Nog niet ingelogd</span>',
              teamActies(lid, isBeheerder),
            ];
          })
        )}
      </div>
      <p class="muted note">
        Wijzigingen worden lokaal in deze demo bewaard en hebben geen effect op
        een echte omgeving.
      </p>
    </section>`;
}

function teamActies(lid, isBeheerder) {
  const knoppen = [];

  if (!isBeheerder) {
    knoppen.push(`<button type="button" class="btn klein" data-actie="wijzig-klanten" data-user="${esc(lid.id)}">Klanten</button>`);
    knoppen.push(`<button type="button" class="btn klein" data-actie="wijzig-rol" data-user="${esc(lid.id)}">Rol</button>`);
  }
  if (lid.status === AccountStatus.UITGENODIGD) {
    knoppen.push(`<button type="button" class="btn klein" data-actie="opnieuw-uitnodigen" data-user="${esc(lid.id)}">Opnieuw uitnodigen</button>`);
  }
  if (lid.status === AccountStatus.ACTIEF && !isBeheerder) {
    knoppen.push(`<button type="button" class="btn klein gevaar" data-actie="deactiveer" data-user="${esc(lid.id)}">Deactiveren</button>`);
  }
  if (lid.status === AccountStatus.GEDEACTIVEERD) {
    knoppen.push(`<button type="button" class="btn klein" data-actie="activeer" data-user="${esc(lid.id)}">Activeren</button>`);
  }

  return knoppen.length ? `<div class="actie-groep">${knoppen.join('')}</div>` : '<span class="muted">Geen acties</span>';
}

/* ---------------------------------------------------------------
   Signalen en acties als eigen pagina
   --------------------------------------------------------------- */

export function renderAgencySignals(user, { signalen, samenvattingen, filters, filterbalk = '' }) {
  return `
    <header class="page-head">
      <h1>Signalen</h1>
      <p>${signalen.length} ${signalen.length === 1 ? 'signaal' : 'signalen'} binnen ${esc(toonBereik(filters.periode.startDate, filters.periode.endDate))}.</p>
    </header>
    ${filterbalk}
    ${renderSignalen(signalen, samenvattingen, filters)}`;
}

export function renderAgencyActions(user, { signalen, samenvattingen, filters, filterbalk = '' }) {
  const naam = (id) => samenvattingen.find((s) => s.client.id === id)?.client.name ?? 'Onbekend';

  return `
    <header class="page-head">
      <h1>Acties</h1>
      <p>Acties die volgen uit de signalen binnen ${esc(toonBereik(filters.periode.startDate, filters.periode.endDate))}.</p>
    </header>
    ${filterbalk}
    <section class="card">
      ${!signalen.length
        ? '<p class="empty">Er zijn geen acties binnen deze periode en kanaalselectie.</p>'
        : `<div class="table-scroll">${tabel(
            ['Actie', 'Klant', 'Kanaal', 'Prioriteit', 'Sinds'],
            signalen.map((s) => [
              esc(s.aanbeveling),
              esc(naam(s.klantId)),
              esc(s.kanaalLabel ?? kanaalLabel(s.kanaal)),
              badge(s.ernst === 'hoog' ? 'Hoog' : 'Middel', s.ernst === 'hoog' ? 'hoog' : 'middel'),
              esc(toonDatum(s.startdatum)),
            ])
          )}</div>`}
    </section>`;
}

export function renderAgencySettings(user) {
  return `
    <header class="page-head">
      <h1>Instellingen</h1>
      <p>Configuratie van de agencyomgeving.</p>
    </header>
    <section class="card">
      <h2>Account</h2>
      <div class="table-scroll">
        ${tabel(['Onderdeel', 'Waarde'], [
          ['Naam', esc(user.displayName)],
          ['E-mailadres', esc(user.email)],
          ['Rol', esc(ROL_LABELS[primaireRol(user)] ?? primaireRol(user))],
          ['Organisatie', 'Aizy'],
        ])}
      </div>
    </section>
    <section class="card">
      <h2>Databronnen</h2>
      <p class="muted">
        Deze demo gebruikt vaste demodata met dagelijkse reeksen. Koppelingen met
        Google Ads, Meta Ads, Microsoft Ads, LinkedIn Ads, GA4 en CRM worden
        ingericht zodra de Azure-backend beschikbaar is.
      </p>
    </section>`;
}
