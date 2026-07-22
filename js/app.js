/**
 * Applicatieshell.
 *
 * Verantwoordelijk voor het opstarten, de navigatie, het accountmenu en de
 * klantcontextwisselaar. De shell kent geen klantdata: alles komt via de
 * repository, die de gebruiker als eerste argument krijgt.
 *
 * Opstartvolgorde. Er wordt bewust niets gerenderd voordat stap 1 tot en met
 * 4 klaar zijn, zodat er geen moment is waarop onbevoegde data zichtbaar is.
 *   1. sessie herstellen
 *   2. huidige gebruiker ophalen
 *   3. organisatiecontext bepalen
 *   4. route controleren
 *   5. renderen
 */

import { applyTheme, state, setState, subscribe } from './state.js';
import { destroyAllCharts } from './charts.js';
import {
  restoreSession, login, logout, getCurrentUser, acceptInvite,
  requestPasswordReset, getActieveKlantId, setActieveKlantId, onAuthChange,
} from './auth/auth-service.js';
import {
  can, Permission, standaardRoute,
} from './auth/permissions.js';
import {
  isAgencyGebruiker, primaireRol, primaireOrganisatieId, ROL_LABELS, getOrganisatie,
} from './auth/domain.js';
import {
  parseHash, controleerRoute, Uitkomst, navigeer, navigeerNaarStartpagina, startRouter,
} from './router.js';
import { getAccessibleClients, getClientById } from './data/repository.js';
import {
  renderLogin, renderForgotPassword, renderAcceptInvite,
  renderGeenToegang, renderNietGevonden,
} from './views/auth-screens.js';
import {
  renderAgencyOverview, renderAgencyClients, renderAgencyTeam,
  renderAgencySignals, renderAgencyActions, renderAgencySettings,
} from './views/agency.js';
import {
  renderClientOverview, renderClientPerformance, renderClientConversions,
  renderClientReport, renderClientUsers, drawClientCharts,
} from './views/client-env.js';
import { renderAgencyClientDetail, drawAgencyClientCharts } from './views/agency-client-detail.js';
import { esc } from './views/components.js';
import { schrijfOverride } from './auth/demo-auth-provider.js';

/** Filters van het klantenoverzicht. Leven in de shell, niet in de URL. */
const klantFilters = { zoek: '', medewerker: '', type: '', status: '', sorteer: 'naam' };

/** Melding die eenmalig boven een scherm wordt getoond. */
let vluchtigeMelding = null;

/* ---------------------------------------------------------------
   Navigatie-items
   --------------------------------------------------------------- */

/** Navigatie voor de agencyomgeving, gefilterd op rechten. */
function agencyNavigatie(user) {
  return [
    { hash: '#/agency/overview', label: 'Overzicht', permission: Permission.VIEW_AGENCY_DASHBOARD },
    {
      hash: '#/agency/clients',
      label: can(user, Permission.VIEW_ALL_CLIENTS) ? 'Klanten' : 'Mijn klanten',
      permission: Permission.VIEW_AGENCY_DASHBOARD,
    },
    { hash: '#/agency/signals', label: 'Signalen', permission: Permission.VIEW_AGENCY_SIGNALS },
    { hash: '#/agency/actions', label: 'Acties', permission: Permission.VIEW_AGENCY_DASHBOARD },
    { hash: '#/agency/team', label: 'Team', permission: Permission.MANAGE_TEAM },
    { hash: '#/agency/settings', label: 'Instellingen', permission: Permission.VIEW_AGENCY_SETTINGS },
  ].filter((item) => can(user, item.permission));
}

/** Navigatie voor de klantomgeving. */
function clientNavigatie(user) {
  return [
    { hash: '#/client/overview', label: 'Overzicht', permission: Permission.VIEW_CLIENT_DASHBOARD },
    { hash: '#/client/performance', label: 'Resultaten', permission: Permission.VIEW_CLIENT_DASHBOARD },
    { hash: '#/client/conversions', label: 'Conversies', permission: Permission.VIEW_CLIENT_DASHBOARD },
    { hash: '#/client/report', label: 'Rapportage', permission: Permission.VIEW_CLIENT_REPORT },
    { hash: '#/client/users', label: 'Gebruikers', permission: Permission.MANAGE_CLIENT_USERS },
  ].filter((item) => can(user, item.permission));
}

function huidigeNavigatie(user, pad) {
  if (!user) return [];
  return pad.startsWith('/client') ? clientNavigatie(user) : agencyNavigatie(user);
}

/* ---------------------------------------------------------------
   Chrome: sidebar, topbar, accountmenu
   --------------------------------------------------------------- */

function renderSidebar(user, pad) {
  const items = huidigeNavigatie(user, pad);
  return `
    <div class="brand">
      <div class="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 64 64"><path d="M19 13h13.3a12.9 12.9 0 1 1 0 25.8H19V13Zm8.4 8.2v9.4h4.6a4.7 4.7 0 1 0 0-9.4h-4.6Zm0 15.3v7.2h4.7a3.6 3.6 0 0 0 0-7.2h-4.7Z"></path></svg>
      </div>
      <div>
        <div class="brand-title">Aizy</div>
        <div class="brand-sub">${esc(pad.startsWith('/client') ? 'Klantomgeving' : 'Agency')}</div>
      </div>
    </div>
    <nav class="nav" aria-label="Hoofdnavigatie">
      ${items.map((i) => `<a href="${i.hash}" class="${pad === i.hash.slice(1) ? 'active' : ''}"
        ${pad === i.hash.slice(1) ? 'aria-current="page"' : ''}>${esc(i.label)}</a>`).join('')}
    </nav>`;
}

/**
 * Contextbalk die verschijnt wanneer een agencymedewerker een klant bekijkt.
 * Blijft zichtbaar zodat duidelijk is dat er niet als de klant wordt gekeken,
 * maar naar de klant.
 */
function renderContextbalk(user) {
  const clientId = getActieveKlantId();
  if (!isAgencyGebruiker(user) || !clientId) return '';

  const client = getClientById(user, clientId);
  if (!client) return '';

  return `<div class="contextbalk" role="status">
    <span>Klantweergave: <strong>${esc(client.name)}</strong></span>
    <span class="muted">Je bent ingelogd als medewerker van Aizy</span>
    <button type="button" class="btn klein" id="terugNaarAgency">Terug naar agency</button>
  </div>`;
}

/** Keuzelijst om een klantweergave te openen. Alleen voor wie dat mag. */
function renderContextwisselaar(user) {
  if (!can(user, Permission.SWITCH_CONTEXT)) return '';

  const klanten = getAccessibleClients(user);
  if (!klanten.length) return '';

  const actief = getActieveKlantId();
  return `<div class="veld contextkiezer">
    <label for="contextSelect">Weergave</label>
    <select id="contextSelect">
      <option value="">Agencyoverzicht</option>
      ${klanten.map((c) => `<option value="${esc(c.id)}"${actief === c.id ? ' selected' : ''}>${esc(c.name)} bekijken</option>`).join('')}
    </select>
  </div>`;
}

function renderAccountmenu(user) {
  const rol = ROL_LABELS[primaireRol(user)] ?? '';
  const org = getOrganisatie(primaireOrganisatieId(user));
  const actieveKlant = getActieveKlantId();
  const actieveKlantNaam = actieveKlant ? getClientById(user, actieveKlant)?.name : null;

  return `
    <div class="accountmenu">
      <button type="button" class="accountknop" id="accountKnop"
        aria-haspopup="menu" aria-expanded="false" aria-controls="accountPaneel">
        <span class="avatar" aria-hidden="true">${esc(user.avatarInitials)}</span>
        <span class="accountknop-tekst">
          <span class="accountknop-naam">${esc(user.displayName)}</span>
          <span class="accountknop-rol">${esc(rol)}</span>
        </span>
      </button>
      <div class="accountpaneel" id="accountPaneel" role="menu" hidden>
        <div class="accountpaneel-kop">
          <span class="avatar groot" aria-hidden="true">${esc(user.avatarInitials)}</span>
          <div>
            <div class="accountpaneel-naam">${esc(user.displayName)}</div>
            <div class="muted klein">${esc(user.email)}</div>
          </div>
        </div>
        <dl class="accountpaneel-gegevens">
          <dt>Rol</dt><dd>${esc(rol)}</dd>
          <dt>Organisatie</dt><dd>${esc(org?.name ?? 'Onbekend')}</dd>
          ${actieveKlantNaam ? `<dt>Actieve weergave</dt><dd>${esc(actieveKlantNaam)}</dd>` : ''}
        </dl>
        <div class="accountpaneel-acties">
          <button type="button" role="menuitem" class="menu-item" id="menuThema">
            Thema wisselen
          </button>
          <button type="button" role="menuitem" class="menu-item gevaar" id="menuUitloggen">
            Uitloggen
          </button>
        </div>
      </div>
    </div>`;
}

function renderTopbar(user) {
  return `
    <div class="topbar-links">
      <button type="button" class="menuknop" id="menuKnop" aria-label="Navigatie openen" aria-expanded="false">Menu</button>
    </div>
    <div class="topbar-rechts">
      ${renderContextwisselaar(user)}
      ${renderAccountmenu(user)}
    </div>`;
}

/* ---------------------------------------------------------------
   Schermen kiezen
   --------------------------------------------------------------- */

/**
 * Kiest het scherm bij een route.
 * Geeft null terug wanneer de repository geen data vrijgeeft; de aanroeper
 * toont dan de geen-toegangpagina.
 */
function rendersScherm(user, route, params) {
  const klantId = getActieveKlantId() ?? primaireOrganisatieId(user);

  switch (route.naam) {
    case 'agency-overview': return renderAgencyOverview(user);
    case 'agency-clients': return renderAgencyClients(user, klantFilters);
    case 'agency-client-detail': return renderAgencyClientDetail(user, params.clientId);
    case 'agency-signals': return renderAgencySignals(user);
    case 'agency-actions': return renderAgencyActions(user);
    case 'agency-team': return renderAgencyTeam(user, { melding: vluchtigeMelding });
    case 'agency-settings': return renderAgencySettings(user);

    case 'client-overview': return renderClientOverview(user, klantId);
    case 'client-performance': return renderClientPerformance(user, klantId);
    case 'client-conversions': return renderClientConversions(user, klantId);
    case 'client-report': return renderClientReport(user, klantId);
    case 'client-users': return renderClientUsers(user, klantId);

    default: return null;
  }
}

/** Tekent de grafieken die bij het zojuist gerenderde scherm horen. */
function tekenGrafieken(user, route, params) {
  const klantId = getActieveKlantId() ?? primaireOrganisatieId(user);

  if (route.naam === 'agency-client-detail') {
    drawAgencyClientCharts(user, params.clientId);
  } else if (route.pad.startsWith('/client') && route.naam !== 'client-users') {
    drawClientCharts(user, klantId);
  }
}

/* ---------------------------------------------------------------
   Renderen
   --------------------------------------------------------------- */

const app = () => document.getElementById('app');

function renderAuthScherm(html, titel) {
  document.title = `${titel} · Aizy`;
  document.body.dataset.shell = 'auth';
  app().innerHTML = html;
}

function render() {
  destroyAllCharts();

  const pad = parseHash();
  const controle = controleerRoute(pad);

  if (controle.uitkomst === Uitkomst.DOORSTUREN) {
    navigeer(controle.naar, { vervang: true });
    return;
  }

  const user = getCurrentUser();

  // Publieke schermen hebben geen shell.
  if (controle.uitkomst === Uitkomst.TOEGESTAAN && controle.route.publiek) {
    if (user && ['login', 'forgot-password', 'accept-invite'].includes(controle.route.naam)) {
      navigeerNaarStartpagina();
      return;
    }
    renderPubliek(controle.route);
    return;
  }

  if (controle.uitkomst === Uitkomst.NIET_GEVONDEN) {
    const terug = user ? standaardRoute(user) : '#/login';
    renderAuthScherm(renderNietGevonden({ pad, terugNaar: terug, terugLabel: user ? 'Naar het dashboard' : 'Naar inloggen' }), 'Niet gevonden');
    return;
  }

  if (controle.uitkomst === Uitkomst.GEEN_TOEGANG) {
    const terug = user ? standaardRoute(user) : '#/login';
    renderAuthScherm(renderGeenToegang({ reden: controle.reden, terugNaar: terug, terugLabel: user ? 'Naar het dashboard' : 'Naar inloggen' }), 'Geen toegang');
    return;
  }

  // Vanaf hier is er een ingelogde gebruiker met toegang.
  const { route, params } = controle;
  const inhoud = rendersScherm(user, route, params);

  if (inhoud == null) {
    renderAuthScherm(
      renderGeenToegang({ reden: 'Deze gegevens zijn niet beschikbaar voor je account.', terugNaar: standaardRoute(user), terugLabel: 'Naar het dashboard' }),
      'Geen toegang'
    );
    return;
  }

  document.title = `${route.titel} · Aizy`;
  document.body.dataset.shell = 'app';

  app().innerHTML = `
    <div class="app-grid">
      <aside class="sidebar" id="sidebar">${renderSidebar(user, pad)}</aside>
      <div class="main">
        <div class="topbar">${renderTopbar(user)}</div>
        ${renderContextbalk(user)}
        <div id="pageRoot" class="page-root" tabindex="-1">${inhoud}</div>
      </div>
    </div>
    <div class="sidebar-overlay" id="sidebarOverlay" hidden></div>`;

  tekenGrafieken(user, route, params);
  vluchtigeMelding = null;
}

function renderPubliek(route) {
  switch (route.naam) {
    case 'login': renderAuthScherm(renderLogin(), 'Inloggen'); break;
    case 'forgot-password': renderAuthScherm(renderForgotPassword(), 'Wachtwoord vergeten'); break;
    case 'accept-invite': renderAuthScherm(renderAcceptInvite(), 'Uitnodiging'); break;
    case 'unauthorized': renderAuthScherm(renderGeenToegang({}), 'Geen toegang'); break;
    default: renderAuthScherm(renderNietGevonden({ pad: route.pad }), 'Niet gevonden');
  }
}

/* ---------------------------------------------------------------
   Interactie
   --------------------------------------------------------------- */

/** Eén gedelegeerde handler op document, zodat er geen inline handlers nodig zijn. */
function bindInteractie() {
  document.addEventListener('submit', async (e) => {
    const form = e.target;

    if (form.id === 'loginForm') {
      e.preventDefault();
      await verwerkLogin(form);
    }
    if (form.id === 'forgotForm') {
      e.preventDefault();
      const email = form.querySelector('#forgotEmail').value;
      const resultaat = await requestPasswordReset({ email });
      renderAuthScherm(renderForgotPassword({ melding: resultaat.melding, gelukt: resultaat.ok }), 'Wachtwoord vergeten');
    }
    if (form.id === 'inviteForm') {
      e.preventDefault();
      const resultaat = await acceptInvite({
        email: form.querySelector('#inviteEmail').value,
        wachtwoord: form.querySelector('#inviteWachtwoord').value,
        naamBevestigd: form.querySelector('#naamBevestigd').checked,
      });
      if (resultaat.ok) navigeerNaarStartpagina();
      else renderAuthScherm(renderAcceptInvite({ fout: resultaat.melding }), 'Uitnodiging');
    }
  });

  document.addEventListener('click', async (e) => {
    const el = e.target.closest('button, a');
    if (!el) return;

    // Demo-account invullen
    if (el.classList.contains('demo-account')) {
      document.getElementById('loginEmail').value = el.dataset.email;
      document.getElementById('loginWachtwoord').value = 'demo123';
      return;
    }

    if (el.id === 'toonWachtwoord') {
      const veld = document.getElementById('loginWachtwoord');
      const zichtbaar = veld.type === 'text';
      veld.type = zichtbaar ? 'password' : 'text';
      el.textContent = zichtbaar ? 'Tonen' : 'Verbergen';
      el.setAttribute('aria-pressed', String(!zichtbaar));
      el.setAttribute('aria-label', zichtbaar ? 'Wachtwoord tonen' : 'Wachtwoord verbergen');
      return;
    }

    if (el.id === 'accountKnop') { toggleAccountmenu(); return; }
    if (el.id === 'menuUitloggen') { await logout(); navigeer('#/login', { vervang: true }); return; }
    if (el.id === 'menuThema') {
      setState({ theme: state.theme === 'dark' ? 'light' : 'dark' });
      sluitAccountmenu();
      return;
    }
    if (el.id === 'terugNaarAgency') {
      setActieveKlantId(null);
      navigeer('#/agency/clients');
      return;
    }
    if (el.id === 'menuKnop') { toggleSidebar(); return; }

    if (el.dataset.actie) { verwerkTeamActie(el.dataset.actie, el.dataset.user); return; }
    if (el.id === 'nodigUitKnop' || el.id === 'nodigCollegaUit') {
      vluchtigeMelding = 'In deze demo worden geen uitnodigingen verstuurd.';
      render();
    }
  });

  document.addEventListener('change', (e) => {
    if (e.target.id === 'contextSelect') {
      const waarde = e.target.value;
      if (!waarde) {
        setActieveKlantId(null);
        navigeer('#/agency/overview');
      } else if (setActieveKlantId(waarde)) {
        navigeer('#/client/overview');
      }
      return;
    }
    if (e.target.closest('.filterbalk')) {
      const veld = { klantZoek: 'zoek', klantMedewerker: 'medewerker', klantType: 'type', klantStatus: 'status', klantSorteer: 'sorteer' }[e.target.id];
      if (veld) { klantFilters[veld] = e.target.value; render(); }
    }
  });

  document.addEventListener('input', (e) => {
    if (e.target.id === 'klantZoek') {
      klantFilters.zoek = e.target.value;
      render();
      // Focus terugzetten zodat typen niet wordt onderbroken.
      const veld = document.getElementById('klantZoek');
      if (veld) { veld.focus(); veld.setSelectionRange(veld.value.length, veld.value.length); }
    }
  });

  // Escape sluit het accountmenu en de mobiele navigatie.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { sluitAccountmenu(); sluitSidebar(); }
  });

  // Klik buiten het accountmenu sluit het.
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.accountmenu')) sluitAccountmenu();
    if (e.target.id === 'sidebarOverlay') sluitSidebar();
  });
}

async function verwerkLogin(form) {
  const knop = form.querySelector('#loginKnop');
  const email = form.querySelector('#loginEmail').value;
  const wachtwoord = form.querySelector('#loginWachtwoord').value;

  knop.disabled = true;
  knop.textContent = 'Bezig met inloggen';

  const resultaat = await login({ email, wachtwoord });

  if (resultaat.ok) {
    navigeerNaarStartpagina();
    return;
  }

  renderAuthScherm(renderLogin({ fout: resultaat.melding, email }), 'Inloggen');
  document.getElementById('loginWachtwoord')?.focus();
}

/** Teamacties binnen de demo. Wijzigingen worden lokaal bewaard. */
function verwerkTeamActie(actie, userId) {
  const user = getCurrentUser();
  if (!can(user, Permission.MANAGE_TEAM)) return;

  if (actie === 'deactiveer') {
    if (!window.confirm('Dit account deactiveren? De gebruiker kan daarna niet meer inloggen.')) return;
    schrijfOverride(userId, { status: 'gedeactiveerd' });
    vluchtigeMelding = 'Het account is gedeactiveerd.';
  }
  if (actie === 'activeer') {
    schrijfOverride(userId, { status: 'actief' });
    vluchtigeMelding = 'Het account is geactiveerd.';
  }
  if (actie === 'opnieuw-uitnodigen') {
    vluchtigeMelding = 'In deze demo worden geen uitnodigingen verstuurd.';
  }
  if (actie === 'wijzig-klanten' || actie === 'wijzig-rol') {
    vluchtigeMelding = 'Deze wijziging is in de demo nog niet beschikbaar.';
  }
  render();
}

/* ---------------------------------------------------------------
   Menu- en navigatiegedrag
   --------------------------------------------------------------- */

function toggleAccountmenu() {
  const paneel = document.getElementById('accountPaneel');
  const knop = document.getElementById('accountKnop');
  if (!paneel || !knop) return;
  const open = !paneel.hidden;
  paneel.hidden = open;
  knop.setAttribute('aria-expanded', String(!open));
  if (!open) paneel.querySelector('.menu-item')?.focus();
}

function sluitAccountmenu() {
  const paneel = document.getElementById('accountPaneel');
  const knop = document.getElementById('accountKnop');
  if (paneel && !paneel.hidden) {
    paneel.hidden = true;
    knop?.setAttribute('aria-expanded', 'false');
  }
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const knop = document.getElementById('menuKnop');
  if (!sidebar) return;
  const open = sidebar.classList.toggle('open');
  if (overlay) overlay.hidden = !open;
  knop?.setAttribute('aria-expanded', String(open));
}

function sluitSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  sidebar?.classList.remove('open');
  if (overlay) overlay.hidden = true;
  document.getElementById('menuKnop')?.setAttribute('aria-expanded', 'false');
}

/* ---------------------------------------------------------------
   Opstarten
   --------------------------------------------------------------- */

async function init() {
  applyTheme();
  bindInteractie();

  // 1 tot en met 3: sessie herstellen en gebruiker bepalen.
  await restoreSession();

  // 4: route bepalen. Zonder hash gaat de gebruiker naar zijn startpagina.
  if (!window.location.hash || window.location.hash === '#') {
    const user = getCurrentUser();
    window.history.replaceState(null, '', user ? standaardRoute(user) : '#/login');
  }

  startRouter(render);
  onAuthChange(() => {});
  subscribe(() => applyTheme());

  // 5: pas nu renderen.
  render();
}

document.addEventListener('DOMContentLoaded', init);
