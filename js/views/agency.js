/**
 * Agencyomgeving voor medewerkers van Aizy.
 *
 * Alle data komt via de repository, die de gebruiker als eerste argument
 * ontvangt. Deze module haalt zelf nooit uit sample-data en kent geen rollen;
 * wat iemand mag, wordt via can() gevraagd.
 */

import {
  getAccessibleClients, getAgencyMetrics, getAccessibleSignals,
  getPortfolioInzichten, klantStatus, getTeamLeden, getToewijsbareKlanten,
  BUSINESS_MODEL_LABELS, BusinessModel,
} from '../data/repository.js';
import { can, Permission } from '../auth/permissions.js';
import { primaireRol, ROL_LABELS, ACCOUNT_STATUS_LABELS, AccountStatus } from '../auth/domain.js';
import { fmt, esc, delta, kpi, tabel, badge, trackingBadge } from './components.js';

/* ---------------------------------------------------------------
   Begroeting
   --------------------------------------------------------------- */

/** Dagdeel op basis van de lokale tijd. */
function dagdeel() {
  const uur = new Date().getHours();
  if (uur < 6) return 'Goedenacht';
  if (uur < 12) return 'Goedemorgen';
  if (uur < 18) return 'Goedemiddag';
  return 'Goedenavond';
}

function begroeting(user, aantalKlanten) {
  const beheert = can(user, Permission.VIEW_ALL_CLIENTS)
    ? `Je hebt toegang tot alle ${aantalKlanten} klanten.`
    : aantalKlanten === 0
      ? 'Er zijn nog geen klanten aan je account toegewezen.'
      : `Je beheert ${aantalKlanten === 1 ? '1 klant' : `${aantalKlanten} klanten`}.`;

  return `<header class="page-head">
    <h1>${esc(dagdeel())}, ${esc(user.firstName)}</h1>
    <p>${esc(beheert)}</p>
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

export function renderAgencyOverview(user) {
  const klanten = getAccessibleClients(user);
  if (!klanten.length) {
    return begroeting(user, 0) + geenKlantenToegewezen();
  }

  const m = getAgencyMetrics(user);
  const signalen = getAccessibleSignals(user);
  const inzichten = getPortfolioInzichten(user);

  return `
    ${begroeting(user, m.aantalKlanten)}

    <div class="kpi-row">
      ${kpi('Actieve klanten', fmt.getal(m.aantalKlanten), `${m.opKoers} op koers, ${m.aandachtNodig} aandacht nodig`)}
      ${kpi('Advertentie-uitgaven', fmt.euro(m.totaleSpend), `van ${fmt.euro(m.totaalBudget)} budget`)}
      ${kpi('Budgetbesteding', m.pacing == null ? 'Niet beschikbaar' : fmt.procent(m.pacing),
        m.pacing == null ? '' : m.pacing > 100 ? 'Boven budget' : 'Binnen budget',
        m.pacing == null ? 'neutraal' : m.pacing > 100 ? 'negatief' : 'positief')}
      ${kpi('Open signalen', fmt.getal(m.openSignalen),
        m.trackingProblemen ? `${m.trackingProblemen} met trackingprobleem` : 'geen trackingproblemen',
        m.openSignalen ? 'negatief' : 'positief')}
    </div>

    ${renderResultatenPerType(m)}
    ${renderInzichten(inzichten)}
    ${renderSignalen(signalen, klanten)}
  `;
}

/**
 * Resultaten gescheiden per bedrijfsmodel.
 *
 * Een gemiddelde ROAS over leadgeneratieklanten bestaat niet en een
 * gemiddelde CPL over webshops evenmin. Ze worden daarom naast elkaar
 * getoond in plaats van tot één getal samengevoegd.
 */
function renderResultatenPerType(m) {
  const blokken = [];

  if (m.ecommerce.aantal) {
    blokken.push(`<div class="type-blok">
      <h3>E-commerce <span class="muted">${m.ecommerce.aantal} ${m.ecommerce.aantal === 1 ? 'klant' : 'klanten'}</span></h3>
      <div class="kpi-row">
        ${kpi('Omzet', fmt.euro(m.ecommerce.omzet), 'deze periode')}
        ${kpi('Aankopen', fmt.getal(m.ecommerce.aankopen), 'deze periode')}
        ${kpi('Gemiddelde ROAS', m.ecommerce.gemiddeldeRoas == null ? 'Onvoldoende data' : fmt.ratio(m.ecommerce.gemiddeldeRoas), 'over e-commerceklanten')}
      </div>
    </div>`);
  }

  if (m.leadgen.aantal) {
    blokken.push(`<div class="type-blok">
      <h3>Leadgeneratie <span class="muted">${m.leadgen.aantal} ${m.leadgen.aantal === 1 ? 'klant' : 'klanten'}</span></h3>
      <div class="kpi-row">
        ${kpi('Leads', fmt.getal(m.leadgen.leads), 'deze periode')}
        ${kpi('Gemiddelde CPL', m.leadgen.gemiddeldeCpl == null ? 'Onvoldoende data' : fmt.euro2(m.leadgen.gemiddeldeCpl), 'over leadgeneratieklanten')}
        ${kpi('Zonder CRM-koppeling', fmt.getal(m.leadgen.zonderKwalificatie),
          m.leadgen.zonderKwalificatie ? 'leadkwaliteit niet meetbaar' : 'alle klanten gekoppeld',
          m.leadgen.zonderKwalificatie ? 'negatief' : 'positief')}
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
    ${m.overig.aantal ? `<p class="muted note">${m.overig.aantal} ${m.overig.aantal === 1 ? 'klant heeft' : 'klanten hebben'} een bedrijfsmodel zonder eigen dashboard.</p>` : ''}
  </section>`;
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

function renderSignalen(signalen, klanten) {
  const naam = (id) => klanten.find((c) => c.id === id)?.name ?? 'Onbekende klant';

  return `<section class="card">
    <h2>Signalen</h2>
    ${!signalen.length
      ? '<p class="empty">Er zijn geen openstaande signalen.</p>'
      : `<ul class="alert-list">${signalen.map((a) => `<li class="alert alert-${esc(a.ernst)}">
          <div class="alert-head">
            ${badge(a.ernst === 'hoog' ? 'Hoge ernst' : 'Middelmatige ernst', a.ernst === 'hoog' ? 'hoog' : 'middel')}
            <strong>${esc(naam(a.klantId))}</strong>
            <span class="muted">${esc(a.kanaal)}</span>
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
 * @param {{zoek?: string, medewerker?: string, type?: string, status?: string, sorteer?: string}} filters
 */
export function renderAgencyClients(user, filters = {}) {
  const alle = getAccessibleClients(user);
  const titel = can(user, Permission.VIEW_ALL_CLIENTS) ? 'Klanten' : 'Mijn klanten';

  if (!alle.length) {
    return `<header class="page-head"><h1>${titel}</h1></header>` + geenKlantenToegewezen();
  }

  const zoek = (filters.zoek ?? '').toLowerCase().trim();
  const gefilterd = alle
    .filter((c) => !zoek || c.name.toLowerCase().includes(zoek))
    .filter((c) => !filters.medewerker || c.accountmanager === filters.medewerker)
    .filter((c) => !filters.type || c.businessModel === filters.type)
    .filter((c) => !filters.status || klantStatus(c).code === filters.status);

  const gesorteerd = sorteerKlanten(gefilterd, filters.sorteer);
  const medewerkers = [...new Set(alle.map((c) => c.accountmanager))].sort();
  const typen = [...new Set(alle.map((c) => c.businessModel))];

  return `
    <header class="page-head">
      <h1>${titel}</h1>
      <p>${gesorteerd.length} van ${alle.length} ${alle.length === 1 ? 'klant' : 'klanten'} getoond.</p>
    </header>

    <section class="card">
      <div class="filterbalk">
        <div class="veld">
          <label for="klantZoek">Zoeken</label>
          <input type="search" id="klantZoek" value="${esc(filters.zoek ?? '')}" placeholder="Klantnaam">
        </div>
        <div class="veld">
          <label for="klantMedewerker">Medewerker</label>
          <select id="klantMedewerker">
            <option value="">Alle medewerkers</option>
            ${medewerkers.map((m) => `<option value="${esc(m)}"${filters.medewerker === m ? ' selected' : ''}>${esc(m)}</option>`).join('')}
          </select>
        </div>
        <div class="veld">
          <label for="klantType">Type</label>
          <select id="klantType">
            <option value="">Alle types</option>
            ${typen.map((t) => `<option value="${esc(t)}"${filters.type === t ? ' selected' : ''}>${esc(BUSINESS_MODEL_LABELS[t] ?? t)}</option>`).join('')}
          </select>
        </div>
        <div class="veld">
          <label for="klantStatus">Status</label>
          <select id="klantStatus">
            <option value="">Alle statussen</option>
            <option value="op-koers"${filters.status === 'op-koers' ? ' selected' : ''}>Op koers</option>
            <option value="aandacht"${filters.status === 'aandacht' ? ' selected' : ''}>Aandacht nodig</option>
            <option value="tracking"${filters.status === 'tracking' ? ' selected' : ''}>Trackingprobleem</option>
            <option value="onvoldoende-data"${filters.status === 'onvoldoende-data' ? ' selected' : ''}>Onvoldoende data</option>
            <option value="geen-doel"${filters.status === 'geen-doel' ? ' selected' : ''}>Doel ontbreekt</option>
          </select>
        </div>
        <div class="veld">
          <label for="klantSorteer">Sorteren</label>
          <select id="klantSorteer">
            <option value="naam"${filters.sorteer === 'naam' ? ' selected' : ''}>Naam</option>
            <option value="spend"${filters.sorteer === 'spend' ? ' selected' : ''}>Uitgaven</option>
            <option value="pacing"${filters.sorteer === 'pacing' ? ' selected' : ''}>Budgetbesteding</option>
            <option value="signalen"${filters.sorteer === 'signalen' ? ' selected' : ''}>Open signalen</option>
          </select>
        </div>
      </div>

      ${!gesorteerd.length
        ? '<p class="empty">Geen klanten gevonden met deze filters.</p>'
        : `<div class="table-scroll">${klantTabel(user, gesorteerd)}</div>`}
    </section>`;
}

function sorteerKlanten(klanten, sorteer) {
  const lijst = [...klanten];
  switch (sorteer) {
    case 'spend': return lijst.sort((a, b) => b.spend - a.spend);
    case 'pacing': return lijst.sort((a, b) => (b.spend / b.maandbudget) - (a.spend / a.maandbudget));
    case 'signalen': return lijst.sort((a, b) => signaalAantal(b.id) - signaalAantal(a.id));
    default: return lijst.sort((a, b) => a.name.localeCompare(b.name, 'nl'));
  }
}

// Wordt per render gevuld zodat de sortering het aantal signalen kent.
let _signalenPerKlant = new Map();
function signaalAantal(clientId) {
  return _signalenPerKlant.get(clientId) ?? 0;
}

function klantTabel(user, klanten) {
  _signalenPerKlant = new Map();
  for (const s of getAccessibleSignals(user)) {
    _signalenPerKlant.set(s.klantId, (_signalenPerKlant.get(s.klantId) ?? 0) + 1);
  }

  const statusVariant = {
    'op-koers': 'ok', aandacht: 'middel', tracking: 'hoog',
    'onvoldoende-data': 'muted', 'geen-doel': 'muted',
  };

  return tabel(
    ['Klant', 'Type', 'Medewerker', 'Kanalen', 'Uitgaven', 'Primair resultaat',
     'Status', 'Budgetbesteding', 'Datakwaliteit', 'Signalen', 'Laatste update'],
    klanten.map((c) => {
      const status = klantStatus(c);
      const pacing = c.maandbudget ? (c.spend / c.maandbudget) * 100 : null;
      const signalen = signaalAantal(c.id);

      return [
        `<a class="link" href="#/agency/clients/${esc(c.id)}">${esc(c.name)}</a>`,
        `<span class="tag">${esc(BUSINESS_MODEL_LABELS[c.businessModel] ?? c.businessModel)}</span>`,
        esc(c.accountmanager),
        `<span class="muted">${esc(c.kanalen.join(', '))}</span>`,
        fmt.euro(c.spend),
        primairResultaat(c),
        `${badge(status.label, statusVariant[status.code] ?? 'muted')}<br><span class="muted klein">${esc(status.reden)}</span>`,
        pacing == null ? '<span class="muted">Niet beschikbaar</span>'
          : `<span class="${pacing > 100 ? 'trend-negatief' : 'trend-positief'}">${fmt.procent(pacing)}</span>`,
        `${c.dataHealth} procent`,
        signalen ? `<span class="trend-negatief">${signalen}</span>` : '0',
        '21-07-2026',
      ];
    })
  );
}

/** Het primaire resultaat verschilt per bedrijfsmodel. */
function primairResultaat(c) {
  if (c.businessModel === BusinessModel.ECOMMERCE) {
    return `${fmt.euro(c.kpis?.omzet)} omzet · ${c.kpis?.roas == null ? 'ROAS onbekend' : `${fmt.ratio(c.kpis.roas)} ROAS`}`;
  }
  if (c.businessModel === BusinessModel.LEADGEN) {
    const kwal = c.kpis?.gekwalificeerdeLeads;
    return `${fmt.getal(c.kpis?.leads)} leads · ${kwal == null ? 'kwalificatie niet gemeten' : `${fmt.getal(kwal)} gekwalificeerd`}`;
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

export function renderAgencySignals(user) {
  const signalen = getAccessibleSignals(user);
  const klanten = getAccessibleClients(user);

  return `
    <header class="page-head">
      <h1>Signalen</h1>
      <p>${signalen.length} ${signalen.length === 1 ? 'signaal' : 'signalen'} over je klanten.</p>
    </header>
    ${renderSignalen(signalen, klanten)}`;
}

export function renderAgencyActions(user) {
  const signalen = getAccessibleSignals(user);
  const klanten = getAccessibleClients(user);
  const naam = (id) => klanten.find((c) => c.id === id)?.name ?? 'Onbekend';

  return `
    <header class="page-head">
      <h1>Acties</h1>
      <p>Acties die volgen uit de openstaande signalen.</p>
    </header>
    <section class="card">
      ${!signalen.length
        ? '<p class="empty">Er zijn geen acties.</p>'
        : `<div class="table-scroll">${tabel(
            ['Actie', 'Klant', 'Kanaal', 'Prioriteit', 'Sinds'],
            signalen.map((s) => [
              esc(s.aanbeveling),
              esc(naam(s.klantId)),
              esc(s.kanaal),
              badge(s.ernst === 'hoog' ? 'Hoog' : 'Middel', s.ernst === 'hoog' ? 'hoog' : 'middel'),
              new Date(s.startdatum).toLocaleDateString('nl-NL'),
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
        Deze demo gebruikt vaste demodata. Koppelingen met Google Ads, GA4,
        Meta en CRM worden ingericht zodra de Azure-backend beschikbaar is.
      </p>
    </section>`;
}
