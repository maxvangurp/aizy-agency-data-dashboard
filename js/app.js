/**
 * Applicatieshell.
 *
 * Verantwoordelijk voor het opstarten, de navigatie, het accountmenu, de
 * klantcontextwisselaar en de filterbalk. De shell kent geen klantdata: alles
 * komt via de repository, die de gebruiker als eerste argument en de
 * filtercontext als laatste argument krijgt.
 *
 * Opstartvolgorde. Er wordt bewust niets gerenderd voordat stap 1 tot en met 5
 * klaar zijn, zodat er geen moment is waarop onbevoegde data zichtbaar is.
 *   1. sessie herstellen
 *   2. huidige gebruiker ophalen
 *   3. organisatiecontext bepalen
 *   4. route controleren
 *   5. filtercontext bepalen en normaliseren tegen wat deze gebruiker mag zien
 *   6. renderen
 *
 * FILTERS EN DE URL
 * De URL is leidend. Elke render normaliseert de filterselectie en schrijft die
 * met replaceState terug in de hash, zodat iedere geschiedenisstap zijn eigen
 * filters draagt. Een wijziging van een filter voegt een nieuwe geschiedenisstap
 * toe; terug en vooruit werken daardoor zoals een gebruiker verwacht.
 */

import { applyTheme, state, setState, subscribe } from './state.js';
import { destroyAllCharts } from './charts.js';
import {
  restoreSession, login, logout, getCurrentUser, acceptInvite,
  requestPasswordReset, getActieveKlantId, setActieveKlantId, onAuthChange,
} from './auth/auth-service.js';
import { can, Permission, standaardRoute } from './auth/permissions.js';
import {
  isAgencyGebruiker, primaireRol, primaireOrganisatieId, getOrganisatie,
} from './auth/domain.js';
import { toegangsniveauTerm, omgevingTerm, LABELS } from './terminology.js';
import {
  parseHash, parseQuery, bouwHash, controleerRoute, Uitkomst, navigeer,
  navigeerNaarStartpagina, startRouter,
} from './router.js';
import {
  getAccessibleClients, getClientById, getFilterOpties, getAgencyOverview,
  getAccessibleClientSummaries, getAccessibleSignals, getPersoonlijkOverzicht,
  getClientDashboard, getPeriodNarrative, getTeamOverzicht, getMedewerkerDetail,
} from './data/repository.js';
import {
  bepaalFilters, getActieveFilters, pasFiltersAan, standaardVoorContext,
  queryVoor, AGENCY_SCOPE, klantScope,
} from './filters/filter-store.js';
import { renderFilterbalk } from './views/filterbar.js';
import { kanaalLabel } from './filters/channels.js';
import {
  renderLogin, renderForgotPassword, renderAcceptInvite,
  renderGeenToegang, renderNietGevonden,
} from './views/auth-screens.js';
import {
  renderAgencyOverview, renderMijnOverzicht, renderAgencyClients, renderAgencyTeam,
  renderMedewerkerDetail, renderAgencySignals, renderAgencyActions, renderAgencySettings,
} from './views/agency.js';
import {
  renderClientOverview, renderClientPerformance, renderClientChannels,
  renderClientConversions, renderClientReport, renderClientUsers, drawClientCharts,
} from './views/client-env.js';
import { renderAvatar, renderIdentiteit } from './views/context-header.js';
import { renderAgencyClientDetail, drawAgencyClientCharts } from './views/agency-client-detail.js';
import { esc } from './views/components.js';
import { schrijfOverride } from './auth/demo-auth-provider.js';

/** Filters van het klantenoverzicht. Leven in de shell, niet in de URL. */
const klantFilters = { zoek: '', medewerker: '', type: '', status: '', sorteer: 'prioriteit' };

/** Melding die eenmalig boven een scherm wordt getoond. */
let vluchtigeMelding = null;

/** Of het kanaalmenu open stond. Wordt na een render hersteld, zodat het
 *  aanvinken van meerdere kanalen niet telkens het menu dichtklapt. Bij een
 *  routewisseling gaat het weer dicht: dan kijk je naar iets anders. */
let kanaalPaneelOpen = false;
let laatstePad = null;

/* ---------------------------------------------------------------
   Navigatie-items
   --------------------------------------------------------------- */

/**
 * Navigatie voor de agencyomgeving.
 *
 * De namen zijn taakgericht en verschillen per rol. Een beheerder kijkt naar de
 * portefeuille, een medewerker naar zijn eigen werkdag; dat verschil hoort in de
 * navigatie te staan en niet pas op de pagina te blijken. Onderdelen waar geen
 * recht voor bestaat, verschijnen niet: een link die daarna een geen-toegangpagina
 * toont, is een belofte die het product niet nakomt.
 */
function agencyNavigatie(user) {
  const alleKlanten = can(user, Permission.VIEW_ALL_CLIENTS);
  return [
    { hash: '#/agency/overview', label: alleKlanten ? 'Overzicht' : 'Mijn overzicht', permission: Permission.VIEW_AGENCY_DASHBOARD },
    { hash: '#/agency/clients', label: alleKlanten ? 'Klanten' : 'Mijn klanten', permission: Permission.VIEW_AGENCY_DASHBOARD },
    { hash: '#/agency/signals', label: 'Signalen', permission: Permission.VIEW_AGENCY_SIGNALS },
    { hash: '#/agency/actions', label: 'Acties', permission: Permission.VIEW_AGENCY_DASHBOARD },
    { hash: '#/agency/team', label: 'Team', permission: Permission.MANAGE_TEAM },
    { hash: '#/agency/settings', label: 'Instellingen', permission: Permission.VIEW_AGENCY_SETTINGS },
  ].filter((item) => can(user, item.permission));
}

/** Navigatie voor de klantomgeving, gefilterd op wat dit account werkelijk mag. */
function clientNavigatie(user) {
  return [
    { hash: '#/client/overview', label: 'Overzicht', permission: Permission.VIEW_CLIENT_DASHBOARD },
    { hash: '#/client/performance', label: 'Resultaten', permission: Permission.VIEW_CLIENT_DASHBOARD },
    { hash: '#/client/channels', label: 'Kanalen', permission: Permission.VIEW_CLIENT_CHANNELS },
    { hash: '#/client/conversions', label: 'Conversies', permission: Permission.VIEW_CLIENT_CONVERSIONS },
    { hash: '#/client/report', label: 'Rapportages', permission: Permission.VIEW_CLIENT_REPORT },
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

  return `<div class="contextbalk" role="status" data-context="klantweergave">
    <span class="contextbalk-tekst">
      <strong>Je bekijkt de klantomgeving van ${esc(client.name)} als Aizy-medewerker.</strong>
      <span class="muted">De klant ziet deze weergave zonder interne informatie.</span>
    </span>
    <button type="button" class="btn klein" id="terugNaarAgency">Terug naar agencyoverzicht</button>
  </div>`;
}

/** Keuzelijst om een klantweergave te openen. Alleen voor wie dat mag. */
function renderContextwisselaar(user) {
  if (!can(user, Permission.SWITCH_CONTEXT)) return '';

  const klanten = getAccessibleClients(user);
  if (!klanten.length) return '';

  const actief = getActieveKlantId();
  return `<div class="veld contextkiezer">
    <label for="contextSelect">Klantomgeving openen</label>
    <select id="contextSelect">
      <option value="">Blijf in de agencyomgeving</option>
      ${klanten.map((c) => `<option value="${esc(c.id)}"${actief === c.id ? ' selected' : ''}>Klantomgeving van ${esc(c.name)}</option>`).join('')}
    </select>
  </div>`;
}

/**
 * Accountmenu.
 *
 * Naam, functietitel, organisatie en toegangsniveau staan als vier
 * afzonderlijke gegevens onder elkaar. Een samengevoegde regel als
 * "Meekijker · Meridiaan" maakt niet duidelijk wat de rol is en wat de
 * organisatie; deze opzet wel.
 */
function renderAccountmenu(user) {
  const niveau = toegangsniveauTerm(primaireRol(user));
  const org = getOrganisatie(primaireOrganisatieId(user));
  const actieveKlant = getActieveKlantId();
  const actieveKlantNaam = actieveKlant ? getClientById(user, actieveKlant)?.name : null;

  return `
    <div class="accountmenu">
      <button type="button" class="accountknop" id="accountKnop"
        aria-haspopup="menu" aria-expanded="false" aria-controls="accountPaneel"
        aria-label="Accountmenu van ${esc(user.displayName)}">
        ${renderAvatar(user)}
        <span class="accountknop-tekst">
          <span class="accountknop-naam">${esc(user.displayName)}</span>
          <span class="accountknop-rol">${esc(user.jobTitle ?? niveau.kort)}</span>
        </span>
      </button>
      <div class="accountpaneel" id="accountPaneel" role="menu" hidden>
        <div class="accountpaneel-kop">
          ${renderAvatar(user, { groot: true })}
          <div>
            <div class="accountpaneel-naam">${esc(user.displayName)}</div>
            <div class="muted klein">${esc(user.email)}</div>
          </div>
        </div>
        ${renderIdentiteit(user, {
          organisatie: org?.name ?? 'Onbekend',
          toegangsniveau: niveau,
        })}
        ${actieveKlantNaam ? `<dl class="identiteit">
          <div class="identiteit-rij">
            <dt>Actieve klantweergave</dt>
            <dd>${esc(actieveKlantNaam)}</dd>
          </div>
        </dl>` : ''}
        <div class="accountpaneel-acties">
          <button type="button" role="menuitem" class="menu-item" id="menuThema">
            Wissel tussen licht en donker thema
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
   Filtercontext bepalen
   --------------------------------------------------------------- */

/** Welke routes een filterbalk tonen, en in welke variant. */
const FILTER_ROUTES = {
  'agency-overview': 'agency',
  'agency-clients': 'agency',
  'agency-client-detail': 'agency',
  'agency-signals': 'agency',
  'agency-actions': 'agency',
  'agency-team': 'agency',
  'client-overview': 'client',
  'client-performance': 'client',
  'client-channels': 'client',
  'client-conversions': 'client',
  'client-report': 'client',
};

/**
 * De contextsleutel waaronder de filterselectie wordt bewaard.
 * Het agencyoverzicht en iedere klant hebben een eigen selectie, zodat een
 * periode die bij de ene klant zinvol is de andere niet overneemt.
 */
function bepaalScope(user, route, params) {
  if (route.naam === 'agency-client-detail') {
    return { key: klantScope(params.clientId), clientId: params.clientId };
  }
  if (route.pad.startsWith('/client')) {
    const clientId = getActieveKlantId() ?? primaireOrganisatieId(user);
    return { key: klantScope(clientId), clientId };
  }
  return { key: AGENCY_SCOPE, clientId: null };
}

/* ---------------------------------------------------------------
   Schermen kiezen
   --------------------------------------------------------------- */

/**
 * Bouwt het scherm bij een route.
 *
 * Geeft `{html, teken}` terug. `teken` tekent de grafieken die bij het zojuist
 * gerenderde viewmodel horen; dat viewmodel wordt maar één keer opgehaald,
 * zodat scherm en grafiek per definitie dezelfde cijfers tonen.
 */
function bouwScherm(user, route, params, ctx, opties) {
  const filters = ctx.resolved;
  const variant = FILTER_ROUTES[route.naam];
  const filterbalk = variant
    ? renderFilterbalk({
      resolved: filters,
      kanalen: opties.kanalen,
      conversieOpties: opties.conversieOpties,
      bronnen: opties.bronnen,
      correcties: ctx.correcties,
      variant,
    })
    : '';

  const klantId = getActieveKlantId() ?? primaireOrganisatieId(user);

  switch (route.naam) {
    case 'agency-overview': {
      // Twee rollen, twee taken, twee schermen. Een beheerder krijgt de
      // portefeuille, een medewerker zijn eigen werkdag.
      if (can(user, Permission.VIEW_ALL_CLIENTS)) {
        const overview = getAgencyOverview(user, filters);
        return { html: renderAgencyOverview(user, { overview, filterbalk }) };
      }
      const persoonlijk = getPersoonlijkOverzicht(user, filters);
      return { html: renderMijnOverzicht(user, { persoonlijk, filterbalk }) };
    }

    case 'agency-clients': {
      const samenvattingen = getAccessibleClientSummaries(user, filters);
      return { html: renderAgencyClients(user, { samenvattingen, filters, klantFilters, filterbalk }) };
    }

    case 'agency-signals': {
      const signalen = getAccessibleSignals(user, filters);
      const samenvattingen = getAccessibleClientSummaries(user, filters);
      return { html: renderAgencySignals(user, { signalen, samenvattingen, filters, filterbalk }) };
    }

    case 'agency-actions': {
      const signalen = getAccessibleSignals(user, filters);
      const samenvattingen = getAccessibleClientSummaries(user, filters);
      return { html: renderAgencyActions(user, { signalen, samenvattingen, filters, filterbalk }) };
    }

    case 'agency-client-detail': {
      const dashboard = getClientDashboard(user, params.clientId, filters);
      if (!dashboard) return { html: null };
      const verhaal = getPeriodNarrative(user, params.clientId, filters);
      const signalen = getAccessibleSignals(user, filters).filter((s) => s.klantId === params.clientId);
      return {
        html: renderAgencyClientDetail({
          dashboard, verhaal, signalen, filterbalk,
          kanaalWaarschuwing: kanaalWaarschuwing(filters, dashboard),
        }),
        teken: () => drawAgencyClientCharts(dashboard),
      };
    }

    case 'agency-team': {
      const team = getTeamOverzicht(user, filters);
      return { html: renderAgencyTeam(user, { team, melding: vluchtigeMelding, filterbalk }) };
    }

    case 'agency-medewerker': {
      const lid = getMedewerkerDetail(user, params.userId, filters);
      return { html: lid ? renderMedewerkerDetail(user, { lid }) : null };
    }

    case 'agency-settings': return { html: renderAgencySettings(user) };

    case 'client-overview':
    case 'client-performance': {
      const dashboard = getClientDashboard(user, klantId, filters);
      if (!dashboard) return { html: null };
      const verhaal = getPeriodNarrative(user, klantId, filters);
      const model = { dashboard, verhaal, filterbalk };
      return {
        html: route.naam === 'client-overview' ? renderClientOverview(model) : renderClientPerformance(model),
        teken: () => drawClientCharts(dashboard),
      };
    }

    case 'client-channels': {
      const dashboard = getClientDashboard(user, klantId, filters);
      if (!dashboard) return { html: null };
      return { html: renderClientChannels({ dashboard, filterbalk }) };
    }

    case 'client-conversions': {
      const dashboard = getClientDashboard(user, klantId, filters);
      if (!dashboard) return { html: null };
      return { html: renderClientConversions({ dashboard, filterbalk }) };
    }

    case 'client-report': {
      const dashboard = getClientDashboard(user, klantId, filters);
      if (!dashboard) return { html: null };
      const verhaal = getPeriodNarrative(user, klantId, filters);
      return { html: renderClientReport({ dashboard, verhaal, filterbalk }) };
    }

    case 'client-users': {
      const dashboard = getClientDashboard(user, klantId, filters);
      return { html: renderClientUsers(user, { dashboard }) };
    }

    default: return { html: null };
  }
}

/**
 * Meldt wanneer de kanaalselectie voor deze klant is ingeperkt.
 * Een selectie die bij het agencyoverzicht klopte, hoeft bij een klant met
 * minder kanalen niet te kloppen; dat wordt zichtbaar gecorrigeerd.
 */
function kanaalWaarschuwing(filters, dashboard) {
  const gevraagd = filters.channels ?? [];
  const gebruikt = dashboard.filters.channels ?? [];
  const verwijderd = gevraagd.filter((k) => !gebruikt.includes(k));
  if (!verwijderd.length) return null;
  return `${verwijderd.map(kanaalLabel).join(', ')} ${verwijderd.length === 1 ? 'is' : 'zijn'} niet beschikbaar voor deze klant en telt niet mee in de cijfers.`;
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
  const query = parseQuery();
  if (pad !== laatstePad) kanaalPaneelOpen = false;
  laatstePad = pad;
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

  // Stap 5: de filtercontext, genormaliseerd tegen wat deze gebruiker mag zien.
  const scope = bepaalScope(user, route, params);
  const opties = getFilterOpties(user, { clientId: scope.clientId });
  const ctx = bepaalFilters({
    user,
    scope: scope.key,
    toegestaneKanalen: opties.toegestaneKanalen,
    conversieOpties: opties.conversieOpties,
    query,
  });

  // De URL draagt altijd de genormaliseerde selectie. Zonder deze stap zou een
  // stap terug in de geschiedenis op een adres zonder filters uitkomen en
  // alsnog de laatst gebruikte selectie tonen.
  synchroniseerUrl(pad, query, ctx);

  const scherm = bouwScherm(user, route, params, ctx, opties);

  if (scherm.html == null) {
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
        <div id="pageRoot" class="page-root" tabindex="-1">${scherm.html}</div>
      </div>
    </div>
    <div class="sidebar-overlay" id="sidebarOverlay" hidden></div>`;

  scherm.teken?.();
  herstelKanaalPaneel();
  vluchtigeMelding = null;
}

/** Zet de genormaliseerde filterselectie in de hash zonder een render uit te lokken. */
function synchroniseerUrl(pad, huidigeQuery, ctx) {
  const gewenst = queryVoor(ctx.filters);
  if (gewenst === huidigeQuery) return;
  // replaceState vuurt geen hashchange af, dus dit veroorzaakt geen tweede render.
  window.history.replaceState(null, '', bouwHash(pad, gewenst));
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
   Filterinteractie
   --------------------------------------------------------------- */

/**
 * Voert een filterwijziging door.
 *
 * De wijziging gaat via de filterstore, die hem normaliseert, en komt daarna in
 * de URL terecht. De render volgt uit de hashchange; er wordt nooit twee keer
 * gerenderd voor één wijziging.
 */
function pasFilterToe(patch, { paneelOpen = kanaalPaneelOpen } = {}) {
  const nieuw = pasFiltersAan(patch);
  if (!nieuw) return;

  kanaalPaneelOpen = paneelOpen;
  const pad = parseHash();
  const doel = bouwHash(pad, queryVoor(nieuw));

  document.getElementById('pageRoot')?.setAttribute('aria-busy', 'true');

  if (doel === `#${pad}?${parseQuery()}` || doel === window.location.hash) {
    render();
    return;
  }
  // Een nieuwe geschiedenisstap, zodat terug en vooruit door filterkeuzes lopen.
  window.location.hash = doel;
}

/** De aangevinkte kanalen uit het kanaalmenu. */
function gekozenKanalen() {
  return [...document.querySelectorAll('input[name="filterKanaal"]:checked')].map((el) => el.value);
}

function toggleKanaalPaneel(open) {
  const paneel = document.getElementById('filterKanalenPaneel');
  const knop = document.getElementById('filterKanalenKnop');
  if (!paneel || !knop) return;
  const nieuw = open ?? paneel.hidden;
  paneel.hidden = !nieuw;
  knop.setAttribute('aria-expanded', String(nieuw));
  kanaalPaneelOpen = nieuw;
  if (nieuw) paneel.querySelector('input')?.focus();
}

function herstelKanaalPaneel() {
  if (!kanaalPaneelOpen) return;
  const paneel = document.getElementById('filterKanalenPaneel');
  const knop = document.getElementById('filterKanalenKnop');
  if (!paneel || !knop) { kanaalPaneelOpen = false; return; }
  paneel.hidden = false;
  knop.setAttribute('aria-expanded', 'true');
}

function sluitKanaalPaneel({ focusTerug = false } = {}) {
  const paneel = document.getElementById('filterKanalenPaneel');
  if (!paneel || paneel.hidden) { kanaalPaneelOpen = false; return; }
  paneel.hidden = true;
  document.getElementById('filterKanalenKnop')?.setAttribute('aria-expanded', 'false');
  kanaalPaneelOpen = false;
  if (focusTerug) document.getElementById('filterKanalenKnop')?.focus();
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

    /* Filterbalk */
    if (el.id === 'filterKanalenKnop') { toggleKanaalPaneel(); return; }
    if (el.id === 'filterKanalenSluiten') { sluitKanaalPaneel({ focusTerug: true }); return; }
    if (el.id === 'filterKanalenAlles') {
      pasFilterToe({ channels: getActieveFilters()?.toegestaneKanalen ?? [] }, { paneelOpen: true });
      return;
    }
    if (el.id === 'filterReset') {
      kanaalPaneelOpen = false;
      pasFilterToe(standaardVoorContext(), { paneelOpen: false });
      return;
    }
    if (el.id === 'filterToggle') {
      const velden = document.getElementById('filterbalkVelden');
      const open = velden?.classList.toggle('open');
      el.setAttribute('aria-expanded', String(!!open));
      el.textContent = open ? 'Filters verbergen' : 'Filters tonen';
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
    const id = e.target.id;

    /* Filterbalk */
    if (id === 'filterPeriode') {
      const preset = e.target.value;
      const huidig = getActieveFilters()?.resolved.periode;
      // Bij een overstap naar een aangepast bereik wordt het huidige bereik
      // overgenomen, zodat de gebruiker vanaf iets zinnigs verder kiest.
      pasFilterToe({
        period: preset === 'custom'
          ? { preset, startDate: huidig?.startDate, endDate: huidig?.endDate }
          : { preset, startDate: null, endDate: null },
      });
      return;
    }
    if (id === 'filterVan' || id === 'filterTot') {
      pasFilterToe({
        period: {
          preset: 'custom',
          startDate: document.getElementById('filterVan')?.value,
          endDate: document.getElementById('filterTot')?.value,
        },
      });
      return;
    }
    if (id === 'filterVergelijking') {
      pasFilterToe({ comparison: { mode: e.target.value } });
      return;
    }
    if (id === 'filterConversie') {
      pasFilterToe({ conversionScope: e.target.value });
      return;
    }
    if (e.target.name === 'filterKanaal') {
      pasFilterToe({ channels: gekozenKanalen() }, { paneelOpen: true });
      return;
    }

    if (id === 'contextSelect') {
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
      const veld = { klantZoek: 'zoek', klantMedewerker: 'medewerker', klantType: 'type', klantStatus: 'status', klantSorteer: 'sorteer' }[id];
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

  // Escape sluit het kanaalmenu, het accountmenu en de mobiele navigatie.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const paneel = document.getElementById('filterKanalenPaneel');
    if (paneel && !paneel.hidden) { sluitKanaalPaneel({ focusTerug: true }); return; }
    sluitAccountmenu();
    sluitSidebar();
  });

  // Klik buiten een menu sluit het.
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.accountmenu')) sluitAccountmenu();
    if (!e.target.closest('.kanaalkiezer')) sluitKanaalPaneel();
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

  // 5 en 6: filters bepalen en pas dan renderen.
  render();
}

document.addEventListener('DOMContentLoaded', init);
