/**
 * Applicatie.
 *
 * Deze module zet de applicatieshell neer, kiest per route de juiste pagina en
 * verwerkt alle interactie. Ze kent geen klantdata: alles komt via de
 * repository, die de gebruiker als eerste argument en de filtercontext als
 * laatste argument krijgt.
 *
 * OPSTARTVOLGORDE
 * Er wordt bewust niets gerenderd voordat stap 1 tot en met 5 klaar zijn, zodat
 * er geen moment is waarop onbevoegde data zichtbaar is.
 *   1. sessie herstellen
 *   2. huidige gebruiker ophalen
 *   3. organisatiecontext bepalen
 *   4. route controleren
 *   5. filtercontext bepalen en normaliseren tegen wat deze gebruiker mag zien
 *   6. renderen
 *
 * CONTEXT IN DE URL
 * De URL draagt de filters, de actieve tab, het geopende detailpaneel en de
 * schermstand. Een gedeelde link levert daardoor hetzelfde scherm op, en een
 * stap terug in de geschiedenis geeft de vorige tab terug in plaats van de
 * vorige pagina.
 *
 * INTERACTIE
 * Alle handlers zijn gedelegeerd op document. Het scherm wordt bij iedere
 * wijziging volledig opnieuw getekend; dat is bij deze omvang ruim snel genoeg
 * en het maakt het onmogelijk dat twee weergaven van dezelfde gegevens uit
 * elkaar lopen.
 */

import { applyTheme, state, setState, subscribe } from './state.js';
import { destroyAllCharts } from './charts.js';
import {
  restoreSession, login, logout, getCurrentUser, acceptInvite,
  requestPasswordReset, getActieveKlantId, setActieveKlantId, onAuthChange,
} from './auth/auth-service.js';
import { can, Permission, standaardRoute } from './auth/permissions.js';
import {
  isAgencyGebruiker, primaireRol, primaireOrganisatieId, getOrganisatie, Rol,
} from './auth/domain.js';
import {
  parseHash, parseQuery, bouwHash, controleerRoute, Uitkomst, navigeer,
  navigeerNaarStartpagina, startRouter,
} from './router.js';
import {
  getAccessibleClients, getClientById, getFilterOpties, getAgencyOverview,
  getAccessibleClientSummaries, getPersoonlijkOverzicht, getClientDashboard,
  getPeriodNarrative, getTeamOverzicht, getMedewerkerDetail, getPortfolioInzichten,
  getKanaalOverzicht, getKanaalDetails, kanaalKeysVan,
} from './data/repository.js';
import {
  getToegankelijkeActies, getActieDetail, getWerkSignalen, getPlanning,
  getToewijsbareMedewerkers, magActieBewerken, actieSamenvatting,
} from './data/work-repository.js';
import {
  bepaalFilters, getActieveFilters, pasFiltersAan, standaardVoorContext,
  queryVoor, AGENCY_SCOPE, klantScope,
} from './filters/filter-store.js';
import { kanaalLabel, ADVERTENTIEKANAAL_KEYS } from './filters/channels.js';
import { DEMO_TODAY, toonBereik, toonDatum, plusDagen } from './filters/period.js';
import { dashboardtypeTerm, LABELS } from './terminology.js';

import {
  renderLogin, renderForgotPassword, renderAcceptInvite,
  renderGeenToegang, renderNietGevonden,
} from './views/auth-screens.js';
import {
  renderShell, renderSidebar, renderContextbalk, renderPaginakop,
  renderPaginatabs, renderDetailpaneel, actieveTab,
} from './ui/app-shell.js';
import { renderAssistent } from './ui/assistant.js';
import * as assistent from './assistant/assistant-controller.js';
import { bouwAssistantContext } from './assistant/assistant-context.js';
import { navigatieVoor, actiefItem, KANAALNAMEN, ANALYSE_TABS } from './ui/navigation.js';
import { UiSleutel, leesUiParams, leesOverigeParams, combineerQuery, hashMetParam, hashMetParams, leesPaneel, paneelWaarde, bewaarScroll, leesScroll } from './ui/url-state.js';
import { toast, toastFout } from './ui/toast.js';
import { emptyState } from './ui/states.js';
import { bindTooltips } from './ui/tooltip.js';
import { getMetriekOpbouw } from './data/breakdown.js';
import { metriekOpbouwPaneel } from './ui/metric-breakdown.js';
import { bindSlepen, registreerSleepdoel, bindKolombreedte, bindKolomvolgorde } from './ui/dnd.js';
import * as grids from './ui/grid-controller.js';
import { renderDataGrid } from './ui/data-grid.js';
import { klantPreview, actieDetail, signaalDetail, signaalPlanning } from './ui/drawer.js';

import { esc } from './views/components.js';
import { renderAgencyTeam, renderMedewerkerDetail, renderAgencySettings } from './views/agency.js';
import {
  renderPortefeuille, prioriteitenDefinitie, PORTEFEUILLE_TABS,
} from './views/portfolio.js';
import { renderVandaag, WERK_TABS, dagdeel } from './views/my-work.js';
import { renderActies, actiesDefinitie, ACTIE_TABS } from './views/actions.js';
import { renderPlanning, PLANNING_TABS, bereikVoor, verschuif } from './views/planning.js';
import { renderSignaalcentrum, SIGNAAL_TABS, signaalTellers } from './views/signals.js';
import { renderKanaalpagina, kanaalTabs, kanaalTitel, KANAALPAGINAS } from './views/channels.js';
import {
  renderCampagnes, renderBudgetten, renderConversies, renderPortfolioInzichten,
  renderRapportages, renderDatakwaliteit, renderIntegraties,
} from './views/agency-pages.js';
import {
  renderClientOverview, renderClientPerformance, renderClientChannels,
  renderClientConversions, renderClientReport, renderClientUsers, drawClientCharts,
} from './views/client-env.js';
import {
  renderKlantOverzicht, renderKlantAnalyse, renderKlantKanaal, renderSamenwerking,
  renderKlantRapportage, OVERZICHT_TABS, SAMENWERKING_TABS, RAPPORTAGE_TABS,
} from './views/client-pages.js';
import { renderAgencyClientDetail, drawAgencyClientCharts } from './views/agency-client-detail.js';

import { onDemoWijziging, wisAlleDemoGegevens } from './model/store.js';
import {
  maakAanActie, wijzigActie, verwijderActie, voegOpmerkingToe, zetStatus, zetDatum,
  getActie, ActieStatus, ActiePrioriteit, ActieSoort,
} from './model/actions.js';
import {
  markeerBekeken, wijsSignaalToe, negeerSignaal, losSignaalOp, heropenSignaal,
  maakActieVanSignaal, planSignaalOpvolging, planResultaatcontrole, beoordeelResultaat,
  planActieVanSignaal, SignaalStatus,
} from './model/signals.js';
import { verplaatsItem, beginVanWeek } from './model/planning.js';
import {
  leesIndeling, verplaatsWidget, schuifWidget, zetZichtbaarheid, schaalWidget, herstelIndeling,
} from './model/widgets.js';
import {
  leesUiVoorkeuren, zetNavCompact, zetNavGroep, isNavGroepOpen, onthoudKlant,
} from './model/ui-prefs.js';
import { schrijfOverride } from './auth/demo-auth-provider.js';

/* ---------------------------------------------------------------
   Schermstand die niet in de URL hoort
   --------------------------------------------------------------- */

/** Panelen die open staan: die stand hoort bij dit moment, niet bij het adres. */
let filterPaneelOpen = false;
let kanaalPaneelOpen = false;
let widgetBewerken = false;
let nieuweActieOpen = false;
let negeerVoorId = null;
const openGridPanelen = new Set();
let laatstePad = null;

/** Routes met een filterbalk, en de contextvariant die daarbij hoort. */
const FILTER_ROUTES = new Set([
  'agency-portfolio', 'agency-overview', 'agency-work', 'agency-clients', 'agency-client-detail',
  'agency-channels', 'agency-channel', 'agency-campaigns', 'agency-budgets', 'agency-conversions',
  'agency-actions', 'agency-planning', 'agency-signals', 'agency-insights', 'agency-reports',
  'agency-dataquality',
  'client-overview', 'client-performance', 'client-channels', 'client-channel', 'client-analysis',
  'client-conversions', 'client-report', 'client-collaboration',
]);

/* ---------------------------------------------------------------
   Hulpfuncties voor de URL
   --------------------------------------------------------------- */

function huidigPad() {
  return parseHash();
}

/** Een hash op het huidige pad met één gewijzigde contextparameter. */
function metParam(sleutel, waarde) {
  return hashMetParam(window.location.hash, sleutel, waarde);
}

function gaNaarParam(sleutel, waarde) {
  navigeer(metParam(sleutel, waarde));
}

/** Opent of sluit het detailpaneel. */
function openPaneel(soort, id) {
  gaNaarParam(UiSleutel.PANEEL, paneelWaarde(soort, id));
}

function sluitPaneel() {
  gaNaarParam(UiSleutel.PANEEL, null);
}

/**
 * Opent de opbouw van een metriek in het detailpaneel.
 * Op een agency-klantdetailpagina wordt de klant-id meegegeven, zodat de opbouw
 * over die klant gaat en niet over de hele portefeuille.
 */
function openMetriek(metric) {
  const pad = huidigPad();
  const match = pad.match(/^\/agency\/clients\/([^/]+)$/);
  const patch = { [UiSleutel.PANEEL]: paneelWaarde('metric', metric) };
  if (match) patch.client = decodeURIComponent(match[1]);
  navigeer(hashMetParams(window.location.hash, patch));
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
  grids.wisGrids();

  const pad = huidigPad();
  const query = parseQuery();
  const uiParams = leesUiParams(query);

  if (pad !== laatstePad) {
    kanaalPaneelOpen = false;
    filterPaneelOpen = false;
    openGridPanelen.clear();
    nieuweActieOpen = false;
    negeerVoorId = null;
  }

  const controle = controleerRoute(pad);

  if (controle.uitkomst === Uitkomst.DOORSTUREN) {
    navigeer(controle.naar, { vervang: true });
    return;
  }

  const user = getCurrentUser();

  if (controle.uitkomst === Uitkomst.TOEGESTAAN && controle.route.publiek) {
    if (user && ['login', 'forgot-password', 'accept-invite'].includes(controle.route.naam)) {
      navigeerNaarStartpagina();
      return;
    }
    renderPubliek(controle.route);
    laatstePad = pad;
    return;
  }

  if (controle.uitkomst === Uitkomst.NIET_GEVONDEN) {
    const terug = user ? standaardRoute(user) : '#/login';
    renderAuthScherm(renderNietGevonden({ pad, terugNaar: terug, terugLabel: user ? 'Naar het dashboard' : 'Naar inloggen' }), 'Niet gevonden');
    laatstePad = pad;
    return;
  }

  if (controle.uitkomst === Uitkomst.GEEN_TOEGANG) {
    const terug = user ? standaardRoute(user) : '#/login';
    renderAuthScherm(renderGeenToegang({ reden: controle.reden, terugNaar: terug, terugLabel: user ? 'Naar het dashboard' : 'Naar inloggen' }), 'Geen toegang');
    laatstePad = pad;
    return;
  }

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

  synchroniseerUrl(pad, query, ctx);

  const omgeving = route.pad.startsWith('/client') ? 'client' : 'agency';
  const actieveKlantId = getActieveKlantId();
  if (omgeving === 'client' && actieveKlantId) onthoudKlant(user.id, actieveKlantId);

  let pagina;
  try {
    pagina = bouwPagina({ user, route, params, ctx, uiParams, omgeving });
  } catch (fout) {
    // Een fout in één pagina mag de shell niet meeslepen: de gebruiker houdt
    // zijn navigatie en kan verder.
    console.error(fout);
    pagina = {
      titel: route.titel,
      inhoud: emptyState({
        titel: 'Deze pagina kon niet worden opgebouwd',
        uitleg: 'Er ging iets mis bij het samenstellen van dit scherm. Kies een andere periode of ga terug naar je startpagina.',
        actie: { hash: standaardRoute(user), label: 'Naar je startpagina' },
      }),
    };
  }

  if (pagina.inhoud == null) {
    renderAuthScherm(
      renderGeenToegang({
        reden: 'Deze gegevens zijn niet beschikbaar voor je account.',
        terugNaar: standaardRoute(user),
        terugLabel: 'Naar het dashboard',
      }),
      'Geen toegang'
    );
    laatstePad = pad;
    return;
  }

  const voorkeuren = leesUiVoorkeuren(user.id);
  const klantContext = omgeving === 'client' && actieveKlantId
    ? { kanalen: kanaalKeysVanKlant(user, actieveKlantId), model: pagina.model ?? 'leadgen' }
    : null;
  const navGroepen = navigatieVoor(user, { omgeving, klantContext });
  const actief = actiefItem(navGroepen, pad, uiParams[UiSleutel.TAB], uiParams);

  const klanten = getAccessibleClients(user);
  const signalenVoorTeller = can(user, Permission.VIEW_AGENCY_SIGNALS)
    ? getWerkSignalen(user, ctx.resolved).filter((s) => s.status === SignaalStatus.NIEUW).length
    : 0;

  const paneel = bouwDetailpaneel({ user, ctx, uiParams, omgeving });

  document.title = `${pagina.titel} · Aizy`;
  document.body.dataset.shell = 'app';

  const vorigeScroll = leesScroll(pad);

  app().innerHTML = renderShell({
    omgeving,
    compact: voorkeuren.navCompact,
    drawerOpen: !!paneel,
    sidebar: renderSidebar({
      groepen: navGroepen,
      actief,
      compact: voorkeuren.navCompact,
      groepOpen: (id) => isNavGroepOpen(voorkeuren, id),
      context: {
        omgeving,
        klant: omgeving === 'client' && actieveKlantId ? getClientById(user, actieveKlantId) : null,
      },
    }),
    contextbalk: renderContextbalk({
      user: { ...user, organisatieNaam: getOrganisatie(primaireOrganisatieId(user))?.name ?? 'Onbekend' },
      filters: FILTER_ROUTES.has(route.naam) ? ctx.resolved : null,
      kanalen: opties.kanalen,
      conversieOpties: opties.conversieOpties,
      bronnen: omgeving === 'client' ? opties.bronnen : [],
      correcties: ctx.correcties,
      klanten,
      actieveKlantId,
      meldingen: signalenVoorTeller,
      magWisselen: can(user, Permission.SWITCH_CONTEXT),
      omgeving,
    }),
    kop: renderPaginakop({
      kruimelpad: pagina.kruimelpad ?? [],
      titel: pagina.titel,
      ondertitel: pagina.ondertitel ?? '',
      labels: pagina.labels ?? [],
      acties: pagina.acties ?? '',
    }),
    tabs: pagina.tabs?.length
      ? renderPaginatabs(pagina.tabs, pagina.tabKey, (key) => metParam(pagina.tabParam ?? UiSleutel.TAB, key))
      : '',
    inhoud: pagina.inhoud,
    detail: renderDetailpaneel(paneel ?? { open: false }),
  });

  // De Aizy-assistent staat als aparte laag boven op de shell, zodat hij bij
  // navigatie beschikbaar blijft en de shell niet hoeft te herstructureren.
  const assistentContext = bouwAssistantContext({
    user,
    route,
    params,
    filters: FILTER_ROUTES.has(route.naam) ? ctx.resolved : ctx.resolved,
    omgeving,
    tab: uiParams[UiSleutel.TAB] ?? null,
    clientId: scope.clientId ?? (omgeving === 'client' ? actieveKlantId : null),
    clientName: (scope.clientId ?? actieveKlantId)
      ? getClientById(user, scope.clientId ?? actieveKlantId)?.name ?? null
      : null,
    pagina,
    openPaneel: leesPaneel(new URLSearchParams(uiParams).toString()),
  });
  assistent.zetContext(assistentContext);
  assistent.zetVerversCallback(herrenderAssistent);
  document.body.dataset.assistent = assistent.isVastgezet() ? 'vast' : 'los';
  app().insertAdjacentHTML('beforeend', renderAssistent(assistentContext));

  pagina.teken?.();
  herstelPanelen();

  // De scrollpositie hoort bij de plek waar je was, niet bij het adres dat je
  // net hebt geopend. Alleen terugkeren naar hetzelfde pad herstelt hem.
  if (pad === laatstePad && vorigeScroll) {
    document.querySelector('.werkgebied')?.scrollTo({ top: vorigeScroll });
  }
  laatstePad = pad;
}

/**
 * Hertekent alleen de assistentlaag. De rest van de pagina blijft staan, zodat
 * een vraag stellen niet de hele shell opnieuw opbouwt en de scroll behouden
 * blijft. Deze functie draait uitsluitend bij een assistent-interactie, dus het
 * invoerveld terugfocussen steelt nooit de aandacht van de rest van de pagina.
 */
function herrenderAssistent() {
  const context = assistent.getContext();
  document.body.dataset.assistent = assistent.isVastgezet() ? 'vast' : 'los';
  const html = context ? renderAssistent(context) : '';
  const bestaand = document.querySelector('.assistent-laag');
  if (bestaand) {
    if (html) bestaand.outerHTML = html;
    else bestaand.remove();
  } else if (html) {
    app().insertAdjacentHTML('beforeend', html);
  }
  document.getElementById('assistentVraag')?.focus();
  const gesprek = document.getElementById('assistentGesprek');
  if (gesprek) gesprek.scrollTop = gesprek.scrollHeight;
}

function kanaalKeysVanKlant(user, clientId) {
  const client = getClientById(user, clientId);
  if (!client) return [];
  const advertentie = kanaalKeysVan(client);
  const meetbronnen = Object.entries(client.bronnen ?? {})
    .filter(([key, status]) => key === 'ga4' && status === 'gekoppeld')
    .map(([key]) => key);
  return [...advertentie, ...meetbronnen];
}

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

/**
 * Zet de genormaliseerde selectie in de hash zonder een render uit te lokken.
 * De contextparameters blijven daarbij staan; zonder die stap zou het kiezen van
 * een periode de actieve tab en het geopende paneel wissen.
 */
function synchroniseerUrl(pad, huidigeQuery, ctx) {
  const gewenst = combineerQuery(queryVoor(ctx.filters), leesOverigeParams(huidigeQuery));
  if (gewenst === huidigeQuery) return;
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
   Pagina's
   --------------------------------------------------------------- */

const AGENCY_KRUIMEL = { label: 'Agency', href: '#/agency/portfolio' };

function bouwPagina({ user, route, params, ctx, uiParams, omgeving }) {
  const filters = ctx.resolved;
  const tab = uiParams[UiSleutel.TAB];
  const isBeheerder = primaireRol(user) === Rol.AGENCY_ADMIN;

  switch (route.naam) {
    /* ---- Portefeuille en Mijn werk ---- */
    case 'agency-portfolio':
      return paginaPortefeuille({ user, filters, tab, uiParams });

    case 'agency-overview':
      // Het oude adres toont wat bij de rol hoort, zonder doorstuurstap.
      return isBeheerder
        ? paginaPortefeuille({ user, filters, tab, uiParams })
        : paginaMijnWerk({ user, filters, tab, uiParams });

    case 'agency-work':
      return paginaMijnWerk({ user, filters, tab, uiParams });

    /* ---- Klanten ---- */
    case 'agency-clients': return paginaKlanten({ user, filters, uiParams });
    case 'agency-client-detail': return paginaKlantdetail({ user, filters, params });
    case 'agency-team': return paginaTeam({ user, filters });
    case 'agency-medewerker': return paginaMedewerker({ user, filters, params });

    /* ---- Performance ---- */
    case 'agency-channels': return paginaKanaal({ user, filters, kanaal: 'alle', tab });
    case 'agency-channel': return paginaKanaal({ user, filters, kanaal: params.kanaal, tab });
    case 'agency-campaigns': return paginaCampagnes({ user, filters });
    case 'agency-budgets': return paginaBudgetten({ user, filters });
    case 'agency-conversions': return paginaConversies({ user, filters });

    /* ---- Werk ---- */
    case 'agency-actions': return paginaActies({ user, filters, tab, uiParams });
    case 'agency-planning': return paginaPlanning({ user, filters, tab, uiParams });
    case 'agency-signals': return paginaSignalen({ user, filters, tab, uiParams });

    /* ---- Analyse ---- */
    case 'agency-insights': return paginaInzichten({ user, filters });
    case 'agency-reports': return paginaRapportages({ user, filters });
    case 'agency-dataquality': return paginaDatakwaliteit({ user, filters });

    /* ---- Systeem ---- */
    case 'agency-integrations': return paginaIntegraties({ user, filters });
    case 'agency-settings':
      return {
        titel: 'Instellingen',
        ondertitel: 'Je account en de databronnen van deze omgeving.',
        kruimelpad: [AGENCY_KRUIMEL, { label: 'Instellingen' }],
        inhoud: renderAgencySettings(user),
      };

    /* ---- Klantomgeving ---- */
    default: return bouwKlantpagina({ user, route, params, filters, tab, uiParams });
  }
}

/* ---- Portefeuille ---- */

function paginaPortefeuille({ user, filters, tab, uiParams }) {
  const overview = getAgencyOverview(user, filters);
  const acties = getToegankelijkeActies(user);
  const signalen = getWerkSignalen(user, filters);
  const medewerkers = getToewijsbareMedewerkers(user);
  const actiefTab = actieveTab(PORTEFEUILLE_TABS, tab);

  const definitie = prioriteitenDefinitie({ acties, signalen, medewerkers, userId: user.id });
  const grid = grids.registreerGrid(definitie, overview.samenvattingen, { userId: user.id, context: null });

  const aandacht = overview.portefeuille.opPrioriteit.filter((s) => s.prioriteit.niveau !== 'geen');

  return {
    titel: 'Portefeuille',
    ondertitel: `${overview.aantalKlanten} ${overview.aantalKlanten === 1 ? 'klant' : 'klanten'} over ${toonBereik(filters.periode.startDate, filters.periode.endDate)}.`,
    kruimelpad: [AGENCY_KRUIMEL, { label: 'Portefeuille' }],
    labels: [{ tekst: `${aandacht.length} klanten met aandachtspunten`, variant: aandacht.length ? 'middel' : 'ok' }],
    tabs: PORTEFEUILLE_TABS,
    tabKey: actiefTab,
    inhoud: renderPortefeuille(user, {
      overview,
      acties,
      signalen,
      definitie,
      tab: actiefTab,
      gridStaat: grid.staat,
      gridVerwerkt: grid.verwerkt,
      gridWeergaven: grid.weergaven,
      gridSelectie: grid.selectie,
      weergavevorm: uiParams[UiSleutel.WEERGAVE] === 'kaarten' ? 'kaarten' : 'lijst',
      resultaatTab: uiParams[UiSleutel.GROEP],
      hashVoor: (key) => metParam(UiSleutel.TAB, key),
    }),
  };
}

/* ---- Mijn werk ---- */

function paginaMijnWerk({ user, filters, tab, uiParams }) {
  const actiefTab = actieveTab(WERK_TABS, tab);
  const persoonlijk = getPersoonlijkOverzicht(user, filters);
  const eigenActies = getToegankelijkeActies(user, { alleenEigen: true });
  const alleActies = getToegankelijkeActies(user);
  const signalen = getWerkSignalen(user, filters);
  const eigenSignalen = signalen.filter((s) => s.verantwoordelijkeId === user.id || s.verantwoordelijkeId == null);
  const voorkeuren = leesUiVoorkeuren(user.id);
  const recenteKlanten = voorkeuren.recenteKlanten
    .map((id) => getClientById(user, id))
    .filter(Boolean);

  const basis = {
    titel: `${dagdeel()}, ${user.firstName}`,
    ondertitel: persoonlijk.samenvattingen.length
      ? `Je bent verantwoordelijk voor ${persoonlijk.verantwoordelijkVoor.length} en ondersteunt bij ${persoonlijk.ondersteuntBij.length} klanten. Weergave over ${toonBereik(filters.periode.startDate, filters.periode.endDate)}.`
      : 'Er zijn nog geen klanten aan je account toegewezen.',
    kruimelpad: [AGENCY_KRUIMEL, { label: 'Mijn werk' }],
    labels: persoonlijk.vandaagAandacht.length
      ? [{ tekst: `${persoonlijk.vandaagAandacht.length} vandaag aandacht nodig`, variant: 'hoog' }]
      : [{ tekst: 'Geen directe aandachtspunten', variant: 'ok' }],
    tabs: WERK_TABS.map((t) => ({
      ...t,
      aantal: t.key === 'acties'
        ? eigenActies.filter((a) => a.status !== ActieStatus.AFGEROND).length
        : t.key === 'signalen'
          ? eigenSignalen.filter((s) => s.open).length
          : undefined,
    })),
    tabKey: actiefTab,
  };

  if (actiefTab === 'acties') {
    return {
      ...basis,
      acties: knopNieuweActie(user),
      inhoud: inhoudActies({ user, acties: eigenActies, tab: 'lijst', uiParams, pagina: 'mijn-werk' }),
    };
  }

  if (actiefTab === 'planning') {
    return { ...basis, inhoud: inhoudPlanning({ user, uiParams, eigenAgenda: true }) };
  }

  if (actiefTab === 'signalen') {
    return {
      ...basis,
      inhoud: renderSignaalcentrum({
        signalen: eigenSignalen,
        tab: 'open',
        medewerkers: getToewijsbareMedewerkers(user),
        magVerwerken: can(user, Permission.MANAGE_SIGNALS),
        filterKlant: '',
        filterErnst: '',
        klanten: getAccessibleClients(user),
        negeerVoorId,
      }),
    };
  }

  return {
    ...basis,
    acties: `<button type="button" class="btn klein" id="widgetBewerkenKop" aria-pressed="${widgetBewerken}">
      ${widgetBewerken ? 'Indeling vastzetten' : 'Indeling aanpassen'}
    </button>`,
    inhoud: renderVandaag({
      user,
      indeling: leesIndeling(user.id),
      bewerken: widgetBewerken,
      persoonlijk,
      acties: eigenActies.length ? eigenActies : alleActies,
      signalen,
      planning: getPlanning(user, {
        van: DEMO_TODAY,
        tot: plusDagen(DEMO_TODAY, 14),
        medewerkerId: can(user, Permission.VIEW_ALL_PLANNING) ? null : user.id,
      }),
      recenteKlanten,
    }),
  };
}

/* ---- Klanten ---- */

function paginaKlanten({ user, filters, uiParams }) {
  const alleKlanten = can(user, Permission.VIEW_ALL_CLIENTS);
  const focus = uiParams[UiSleutel.FOCUS] ?? 'mijn';
  let samenvattingen = getAccessibleClientSummaries(user, filters);

  // Een medewerker heeft twee ingangen: zijn eigen klanten en alles waar hij bij
  // mag. Voor een beheerder is dat hetzelfde en verandert er niets.
  if (!alleKlanten && focus === 'mijn') {
    const eigen = samenvattingen.filter((s) => s.verantwoordelijk || s.ondersteunend);
    if (eigen.length) samenvattingen = eigen;
  }

  const acties = getToegankelijkeActies(user);
  const signalen = getWerkSignalen(user, filters);
  const definitie = prioriteitenDefinitie({
    acties, signalen, medewerkers: getToewijsbareMedewerkers(user), userId: user.id,
    id: 'klanten', pagina: 'clients',
  });
  const grid = grids.registreerGrid(definitie, samenvattingen, { userId: user.id, context: null });

  const titel = alleKlanten ? 'Klanten' : focus === 'alle' ? 'Alle toegankelijke klanten' : 'Mijn klanten';

  return {
    titel,
    ondertitel: samenvattingen.length
      ? `${samenvattingen.length} ${samenvattingen.length === 1 ? 'klant' : 'klanten'} over ${toonBereik(filters.periode.startDate, filters.periode.endDate)}.`
      : 'Er zijn nog geen klanten aan je account toegewezen.',
    kruimelpad: [AGENCY_KRUIMEL, { label: titel }],
    inhoud: samenvattingen.length
      ? renderDataGrid({
        definitie,
        staat: grid.staat,
        verwerkt: grid.verwerkt,
        selectie: grid.selectie,
        weergaven: grid.weergaven,
        leegTitel: 'Geen klanten met deze filters',
        leegUitleg: 'Pas de filters of de zoekterm aan, of kies een andere periode.',
      })
      : emptyState({
        titel: 'Er zijn nog geen klanten aan je account toegewezen',
        uitleg: 'Een agencybeheerder kan klanten aan je portefeuille toevoegen.',
        id: 'geenKlanten',
      }),
  };
}

function paginaKlantdetail({ user, filters, params }) {
  const dashboard = getClientDashboard(user, params.clientId, filters);
  if (!dashboard) return { titel: 'Klantdetail', inhoud: null };

  onthoudKlant(user.id, params.clientId);
  const verhaal = getPeriodNarrative(user, params.clientId, filters);
  const signalen = getWerkSignalen(user, filters, { klantId: params.clientId });

  return {
    titel: dashboard.client.name,
    ondertitel: `Agencyweergave over ${toonBereik(dashboard.periode.startDate, dashboard.periode.endDate)}. Deze pagina bevat interne informatie die de klant niet ziet.`,
    kruimelpad: [AGENCY_KRUIMEL, { label: 'Klanten', href: '#/agency/clients' }, { label: dashboard.client.name }],
    labels: [
      { tekst: dashboard.status.label, variant: dashboard.status.variant, uitleg: dashboard.status.reden },
      { tekst: dashboard.prioriteit.label, variant: dashboard.prioriteit.variant, uitleg: dashboard.prioriteit.redenen[0] },
      { tekst: dashboardtypeTerm(dashboard.model).kort, variant: 'muted' },
    ],
    acties: can(user, Permission.SWITCH_CONTEXT)
      ? `<button type="button" class="btn klein" data-klantomgeving="${esc(params.clientId)}">Klantomgeving openen</button>
         <button type="button" class="btn klein primary" data-nieuweactie="${esc(params.clientId)}">Actie aanmaken</button>`
      : '',
    model: dashboard.model,
    inhoud: renderAgencyClientDetail({
      dashboard,
      verhaal,
      signalen,
      kanaalWaarschuwing: kanaalWaarschuwing(filters, dashboard),
    }),
    teken: () => drawAgencyClientCharts(dashboard),
  };
}

function kanaalWaarschuwing(filters, dashboard) {
  const gevraagd = filters.channels ?? [];
  const gebruikt = dashboard.filters.channels ?? [];
  const verwijderd = gevraagd.filter((k) => !gebruikt.includes(k));
  if (!verwijderd.length) return null;
  return `${verwijderd.map(kanaalLabel).join(', ')} ${verwijderd.length === 1 ? 'is' : 'zijn'} niet beschikbaar voor deze klant en telt niet mee in de cijfers.`;
}

function paginaTeam({ user, filters }) {
  const team = getTeamOverzicht(user, filters);
  return {
    titel: 'Team',
    ondertitel: `${team.length} ${team.length === 1 ? 'medewerker' : 'medewerkers'} bij Aizy. Functietitel en toegangsniveau zijn twee verschillende gegevens.`,
    kruimelpad: [AGENCY_KRUIMEL, { label: 'Team' }],
    inhoud: renderAgencyTeam(user, { team }),
  };
}

function paginaMedewerker({ user, filters, params }) {
  const lid = getMedewerkerDetail(user, params.userId, filters);
  if (!lid) return { titel: 'Medewerker', inhoud: null };
  return {
    titel: lid.gebruiker.displayName,
    ondertitel: lid.gebruiker.jobTitle ? `${lid.gebruiker.jobTitle} bij Aizy.` : 'Functietitel niet vastgelegd.',
    kruimelpad: [AGENCY_KRUIMEL, { label: 'Team', href: '#/agency/team' }, { label: lid.gebruiker.displayName }],
    inhoud: renderMedewerkerDetail(user, { lid }),
  };
}

/* ---- Performance ---- */

function paginaKanaal({ user, filters, kanaal, tab }) {
  const geldig = KANAALPAGINAS.includes(kanaal) ? kanaal : 'alle';
  const tabs = kanaalTabs(geldig);
  const actiefTab = actieveTab(tabs, tab);
  const overzicht = getKanaalOverzicht(user, filters);
  const details = geldig === 'alle' ? { campagnes: [], advertentiegroepen: [], zoekwoorden: [] } : getKanaalDetails(user, filters, geldig);
  const geselecteerd = geldig === 'alle' || geldig === 'ga4' || (filters.channels ?? []).includes(geldig);

  return {
    titel: kanaalTitel(geldig),
    ondertitel: `Over ${toonBereik(filters.periode.startDate, filters.periode.endDate)}, over alle klanten waartoe je toegang hebt.`,
    kruimelpad: [AGENCY_KRUIMEL, { label: 'Kanalen', href: '#/agency/channels' },
      ...(geldig === 'alle' ? [] : [{ label: kanaalTitel(geldig) }])],
    tabs,
    tabKey: actiefTab,
    inhoud: renderKanaalpagina({
      kanaal: geldig,
      tab: actiefTab,
      overzicht,
      details,
      geselecteerd,
      samenvattingen: overzicht.samenvattingen,
      filters,
    }),
  };
}

function paginaCampagnes({ user, filters }) {
  return {
    titel: 'Campagnes',
    ondertitel: `Alle campagnes over ${toonBereik(filters.periode.startDate, filters.periode.endDate)}.`,
    kruimelpad: [AGENCY_KRUIMEL, { label: 'Campagnes' }],
    inhoud: renderCampagnes({ details: getKanaalDetails(user, filters, 'google_ads'), filters }),
  };
}

function paginaBudgetten({ user, filters }) {
  return {
    titel: 'Budgetten',
    ondertitel: `Budget en besteding over ${toonBereik(filters.periode.startDate, filters.periode.endDate)}.`,
    kruimelpad: [AGENCY_KRUIMEL, { label: 'Budgetten' }],
    inhoud: renderBudgetten({ overview: getAgencyOverview(user, filters) }),
  };
}

function paginaConversies({ user, filters }) {
  return {
    titel: 'Conversies',
    ondertitel: 'Per bedrijfsmodel gescheiden, want aankopen en aanvragen zijn niet optelbaar.',
    kruimelpad: [AGENCY_KRUIMEL, { label: 'Conversies' }],
    inhoud: renderConversies({ overview: getAgencyOverview(user, filters) }),
  };
}

/* ---- Werk ---- */

function knopNieuweActie(user) {
  if (!can(user, Permission.MANAGE_ACTIONS)) return '';
  return `<button type="button" class="btn klein primary" id="nieuweActieKop">Actie aanmaken</button>`;
}

function inhoudActies({ user, acties, tab, uiParams, pagina }) {
  const klanten = getAccessibleClients(user);
  const medewerkers = getToewijsbareMedewerkers(user);
  const definitie = actiesDefinitie({ klanten, medewerkers, pagina });
  const grid = grids.registreerGrid(definitie, acties, { userId: user.id, context: null });
  const magBewerken = can(user, Permission.MANAGE_ACTIONS);
  const weekParam = uiParams[UiSleutel.DATUM];

  return renderActies({
    tab,
    acties,
    definitie,
    gridStaat: grid.staat,
    gridVerwerkt: grid.verwerkt,
    gridWeergaven: grid.weergaven,
    gridSelectie: grid.selectie,
    magBewerken,
    klanten,
    medewerkers,
    formOpen: nieuweActieOpen,
    weekStart: weekParam ? beginVanWeek(weekParam) : beginVanWeek(DEMO_TODAY),
  });
}

function paginaActies({ user, filters, tab, uiParams }) {
  const actiefTab = actieveTab(ACTIE_TABS, tab);
  const acties = getToegankelijkeActies(user);
  const samenvatting = actieSamenvatting(acties);

  return {
    titel: 'Acties',
    ondertitel: `${samenvatting.open.length} openstaande ${samenvatting.open.length === 1 ? 'actie' : 'acties'}, waarvan ${samenvatting.verlopen.length} over de deadline.`,
    kruimelpad: [AGENCY_KRUIMEL, { label: 'Acties' }],
    labels: [
      { tekst: `${samenvatting.perStatus[ActieStatus.WACHT_OP_KLANT]} wacht op klant`, variant: 'middel' },
      { tekst: `${samenvatting.perStatus[ActieStatus.BEZIG]} bezig`, variant: 'muted' },
    ],
    acties: knopNieuweActie(user),
    tabs: ACTIE_TABS.map((t) => ({ ...t, aantal: t.key === 'lijst' ? acties.length : undefined })),
    tabKey: actiefTab,
    inhoud: inhoudActies({ user, acties, tab: actiefTab, uiParams, pagina: 'acties' }),
  };
}

function inhoudPlanning({ user, uiParams, eigenAgenda = false }) {
  const weergave = uiParams[UiSleutel.BEREIK] ?? 'week';
  const anker = uiParams[UiSleutel.DATUM] ?? DEMO_TODAY;
  const bereik = bereikVoor(weergave, anker);
  const groepering = uiParams[UiSleutel.GROEP] ?? '';

  const medewerkers = getToewijsbareMedewerkers(user);
  const klanten = getAccessibleClients(user);

  const filterMedewerker = eigenAgenda ? user.id : (uiParams.medewerker ?? '');
  const items = getPlanning(user, {
    van: bereik.van,
    tot: bereik.tot,
    medewerkerId: filterMedewerker || null,
    klantId: uiParams.klant || null,
    soort: uiParams.soort || null,
  });

  return renderPlanning({
    items,
    weergave,
    anker,
    groepering,
    medewerkers,
    klanten,
    filterMedewerker,
    filterKlant: uiParams.klant ?? '',
    filterSoort: uiParams.soort ?? '',
    magVerplaatsen: can(user, Permission.MANAGE_ACTIONS),
    toonKoppeling: !eigenAgenda,
  });
}

function paginaPlanning({ user, filters, tab, uiParams }) {
  const weergave = uiParams[UiSleutel.BEREIK] ?? 'week';
  const actiefTab = actieveTab(PLANNING_TABS, weergave);

  return {
    titel: 'Planning',
    ondertitel: 'Werkblokken, klantmeetings en acties met een datum, naast elkaar.',
    kruimelpad: [AGENCY_KRUIMEL, { label: 'Planning' }],
    tabs: PLANNING_TABS,
    tabKey: actiefTab,
    tabParam: UiSleutel.BEREIK,
    inhoud: inhoudPlanning({ user, uiParams: { ...uiParams, [UiSleutel.BEREIK]: actiefTab } }),
  };
}

function paginaSignalen({ user, filters, tab, uiParams }) {
  const signalen = getWerkSignalen(user, filters);
  const tabs = signaalTellers(signalen);
  const actiefTab = actieveTab(SIGNAAL_TABS, tab);

  return {
    titel: 'Signalen',
    ondertitel: `${signalen.filter((s) => s.open).length} openstaande signalen binnen ${toonBereik(filters.periode.startDate, filters.periode.endDate)}.`,
    kruimelpad: [AGENCY_KRUIMEL, { label: 'Signalen' }],
    tabs,
    tabKey: actiefTab,
    inhoud: renderSignaalcentrum({
      signalen,
      tab: actiefTab,
      medewerkers: getToewijsbareMedewerkers(user),
      magVerwerken: can(user, Permission.MANAGE_SIGNALS),
      magPlannen: can(user, Permission.ASSIGN_ACTIONS),
      klanten: getAccessibleClients(user),
      negeerVoorId,
      filters: {
        klant: uiParams.klant ?? '',
        ernst: uiParams.ernst ?? '',
        kanaal: uiParams.kanaal ?? '',
        verantw: uiParams.verantw ?? '',
        ouderdom: uiParams.ouderdom ?? '',
      },
    }),
  };
}

/* ---- Analyse ---- */

function paginaInzichten({ user, filters }) {
  return {
    titel: 'Inzichten',
    ondertitel: 'Bevindingen die uit de geselecteerde cijfers te onderbouwen zijn.',
    kruimelpad: [AGENCY_KRUIMEL, { label: 'Inzichten' }],
    inhoud: renderPortfolioInzichten({ inzichten: getPortfolioInzichten(user, filters), filters }),
  };
}

function paginaRapportages({ user, filters }) {
  return {
    titel: 'Rapportages',
    ondertitel: 'De rapportage per klant en het werk dat daarvoor klaarstaat.',
    kruimelpad: [AGENCY_KRUIMEL, { label: 'Rapportages' }],
    inhoud: renderRapportages({
      overview: getAgencyOverview(user, filters),
      acties: getToegankelijkeActies(user),
    }),
  };
}

function paginaDatakwaliteit({ user, filters }) {
  return {
    titel: 'Datakwaliteit',
    ondertitel: 'Wat er binnenkomt, wat ontbreekt, en wat dat betekent voor de conclusies.',
    kruimelpad: [AGENCY_KRUIMEL, { label: 'Datakwaliteit' }],
    inhoud: renderDatakwaliteit({ overview: getAgencyOverview(user, filters) }),
  };
}

function paginaIntegraties({ user, filters }) {
  return {
    titel: 'Integraties',
    ondertitel: 'Welke bronnen gekoppeld zijn en wat er nog moet komen.',
    kruimelpad: [AGENCY_KRUIMEL, { label: 'Integraties' }],
    inhoud: renderIntegraties({ overview: getAgencyOverview(user, filters) }),
  };
}

/* ---- Klantomgeving ---- */

function bouwKlantpagina({ user, route, params, filters, tab, uiParams }) {
  const klantId = getActieveKlantId() ?? primaireOrganisatieId(user);
  const dashboard = getClientDashboard(user, klantId, filters);
  if (!dashboard) return { titel: route.titel, inhoud: null };

  const verhaal = getPeriodNarrative(user, klantId, filters);
  const kruimel = { label: dashboard.client.name, href: '#/client/overview' };
  const basis = {
    model: dashboard.model,
    teken: () => drawClientCharts(dashboard),
  };

  switch (route.naam) {
    case 'client-overview': {
      const actiefTab = actieveTab(OVERZICHT_TABS, tab);
      return {
        ...basis,
        titel: dashboard.client.name,
        ondertitel: dashboard.vergelijkingActief
          ? `Resultaten van ${toonBereik(dashboard.periode.startDate, dashboard.periode.endDate)}, vergeleken met ${toonBereik(dashboard.vergelijking.startDate, dashboard.vergelijking.endDate)}.`
          : `Resultaten van ${toonBereik(dashboard.periode.startDate, dashboard.periode.endDate)}, zonder vergelijking.`,
        kruimelpad: [kruimel, { label: 'Overzicht' }],
        labels: [{ tekst: dashboardtypeTerm(dashboard.model).kort, variant: 'muted' }],
        tabs: OVERZICHT_TABS,
        tabKey: actiefTab,
        inhoud: renderKlantOverzicht({
          dashboard,
          verhaal,
          tab: actiefTab,
          basisInhoud: renderClientOverview({ dashboard, verhaal }),
        }),
        teken: actiefTab === 'samenvatting' ? basis.teken : undefined,
      };
    }

    case 'client-performance':
      return {
        ...basis,
        titel: dashboard.client.name,
        ondertitel: `Het volledige resultaat van ${toonBereik(dashboard.periode.startDate, dashboard.periode.endDate)}.`,
        kruimelpad: [kruimel, { label: 'Resultaten' }],
        inhoud: renderClientPerformance({ dashboard, verhaal }),
      };

    case 'client-channels':
      return {
        titel: 'Alle kanalen',
        ondertitel: `Waar het resultaat van ${toonBereik(dashboard.periode.startDate, dashboard.periode.endDate)} vandaan kwam.`,
        kruimelpad: [kruimel, { label: 'Alle kanalen' }],
        model: dashboard.model,
        inhoud: renderClientChannels({ dashboard }),
      };

    case 'client-channel': {
      const kanaal = params.kanaal;
      const tabs = kanaalTabs(kanaal);
      const actiefTab = actieveTab(tabs, tab);
      return {
        titel: kanaalTitel(kanaal),
        ondertitel: `Resultaten van ${kanaalTitel(kanaal)} over ${toonBereik(dashboard.periode.startDate, dashboard.periode.endDate)}.`,
        kruimelpad: [kruimel, { label: 'Alle kanalen', href: '#/client/channels' }, { label: kanaalTitel(kanaal) }],
        tabs,
        tabKey: actiefTab,
        model: dashboard.model,
        inhoud: renderKlantKanaal({ dashboard, kanaal, tab: actiefTab }),
      };
    }

    case 'client-analysis': {
      const tabs = ANALYSE_TABS[dashboard.model] ?? ANALYSE_TABS.leadgen;
      const actiefTab = actieveTab(tabs, tab);
      return {
        titel: 'Analyse',
        ondertitel: `De verdieping die bij een ${dashboardtypeTerm(dashboard.model).kort.toLowerCase()}dashboard hoort.`,
        kruimelpad: [kruimel, { label: 'Analyse' }],
        tabs,
        tabKey: actiefTab,
        model: dashboard.model,
        inhoud: renderKlantAnalyse({ dashboard, tab: actiefTab }),
      };
    }

    case 'client-collaboration': {
      const actiefTab = actieveTab(SAMENWERKING_TABS, tab);
      const acties = getToegankelijkeActies(user, { klantId });
      const planning = getPlanning(user, {
        van: plusDagen(DEMO_TODAY, -30),
        tot: plusDagen(DEMO_TODAY, 60),
        klantId,
      });
      return {
        titel: 'Samenwerking',
        ondertitel: 'Wat Aizy doet, wat er van jou nodig is en wanneer we elkaar spreken.',
        kruimelpad: [kruimel, { label: 'Samenwerking' }],
        tabs: SAMENWERKING_TABS,
        tabKey: actiefTab,
        model: dashboard.model,
        inhoud: renderSamenwerking({
          tab: actiefTab,
          acties,
          planning,
          magDeelnemen: can(user, Permission.CLIENT_COLLABORATE),
          contactpersoon: dashboard.team?.primair ?? null,
        }),
      };
    }

    case 'client-conversions':
      return {
        titel: 'Conversies',
        ondertitel: `Welke acties bezoekers ondernamen in ${toonBereik(dashboard.periode.startDate, dashboard.periode.endDate)}.`,
        kruimelpad: [kruimel, { label: 'Conversies' }],
        model: dashboard.model,
        inhoud: renderClientConversions({ dashboard }),
      };

    case 'client-report': {
      const actiefTab = actieveTab(RAPPORTAGE_TABS, tab);
      return {
        titel: 'Rapportage',
        ondertitel: dashboard.vergelijkingActief
          ? `${toonBereik(dashboard.periode.startDate, dashboard.periode.endDate)}, vergeleken met ${toonBereik(dashboard.vergelijking.startDate, dashboard.vergelijking.endDate)}.`
          : `${toonBereik(dashboard.periode.startDate, dashboard.periode.endDate)}, zonder vergelijking.`,
        kruimelpad: [kruimel, { label: 'Rapportage' }],
        tabs: RAPPORTAGE_TABS.filter((t) => t.key !== 'datakwaliteit' || can(user, Permission.VIEW_CLIENT_DATAQUALITY)),
        tabKey: actiefTab,
        model: dashboard.model,
        inhoud: renderKlantRapportage({
          dashboard,
          verhaal,
          tab: actiefTab,
          basisInhoud: renderClientReport({ dashboard, verhaal }),
          magDatakwaliteit: can(user, Permission.VIEW_CLIENT_DATAQUALITY),
        }),
      };
    }

    case 'client-users':
      return {
        titel: 'Gebruikers',
        ondertitel: `De gebruikers van ${dashboard.client.name} met toegang tot dit dashboard.`,
        kruimelpad: [kruimel, { label: 'Gebruikers' }],
        model: dashboard.model,
        inhoud: renderClientUsers(user, { dashboard }),
      };

    default:
      return { titel: route.titel, inhoud: null };
  }
}

/* ---------------------------------------------------------------
   Detailpaneel
   --------------------------------------------------------------- */

function bouwDetailpaneel({ user, ctx, uiParams, omgeving }) {
  const gevraagd = leesPaneel(new URLSearchParams(uiParams).toString());
  if (!gevraagd) return null;

  const filters = ctx.resolved;

  if (gevraagd.soort === 'klant') {
    const samenvatting = getAccessibleClientSummaries(user, filters)
      .find((s) => s.client.id === gevraagd.id) ?? null;
    return {
      open: true,
      ...klantPreview({
        samenvatting,
        acties: getToegankelijkeActies(user),
        signalen: getWerkSignalen(user, filters),
        filters,
        magOpenen: omgeving === 'agency',
      }),
    };
  }

  if (gevraagd.soort === 'actie') {
    const actie = getActieDetail(user, gevraagd.id);
    return {
      open: true,
      ...actieDetail({
        actie,
        medewerkers: getToewijsbareMedewerkers(user),
        magBewerken: actie ? magActieBewerken(user, actie) : false,
        user,
      }),
    };
  }

  if (gevraagd.soort === 'signaal') {
    const signaal = getWerkSignalen(user, null).find((s) => s.id === gevraagd.id) ?? null;
    return {
      open: true,
      ...signaalDetail({
        signaal,
        magVerwerken: can(user, Permission.MANAGE_SIGNALS),
        medewerkers: getToewijsbareMedewerkers(user),
      }),
    };
  }

  if (gevraagd.soort === 'plan') {
    const signaal = getWerkSignalen(user, null).find((s) => s.id === gevraagd.id) ?? null;
    return {
      open: true,
      ...signaalPlanning({
        signaal,
        medewerkers: getToewijsbareMedewerkers(user),
        magPlannen: can(user, Permission.ASSIGN_ACTIONS),
        vandaag: DEMO_TODAY,
      }),
    };
  }

  // Metriekopbouw: het eerste verdiepingsniveau van een KPI. De opbouw wordt
  // berekend binnen de actieve klant- of portefeuillecontext en dezelfde filters.
  if (gevraagd.soort === 'metric') {
    const clientId = omgeving === 'client'
      ? getActieveKlantId() ?? primaireOrganisatieId(user)
      : leesOverigeParams(parseQuery()).client ?? null;
    const opbouw = getMetriekOpbouw(user, filters, gevraagd.id, { clientId });
    return { open: true, ...metriekOpbouwPaneel(opbouw) };
  }

  return null;
}

/* ---------------------------------------------------------------
   Panelen herstellen
   --------------------------------------------------------------- */

function herstelPanelen() {
  if (filterPaneelOpen) {
    const paneel = document.getElementById('filterPaneel');
    if (paneel) {
      paneel.hidden = false;
      document.getElementById('filterToggle')?.setAttribute('aria-expanded', 'true');
    }
  }
  if (kanaalPaneelOpen) {
    const paneel = document.getElementById('filterKanalenPaneel');
    if (paneel) {
      paneel.hidden = false;
      document.getElementById('filterKanalenKnop')?.setAttribute('aria-expanded', 'true');
    } else {
      kanaalPaneelOpen = false;
    }
  }
  for (const id of openGridPanelen) {
    const paneel = document.getElementById(id);
    if (paneel) paneel.hidden = false;
  }
}

/* ---------------------------------------------------------------
   Filterinteractie
   --------------------------------------------------------------- */

function pasFilterToe(patch, { paneelOpen = kanaalPaneelOpen } = {}) {
  const nieuw = pasFiltersAan(patch);
  if (!nieuw) return;

  kanaalPaneelOpen = paneelOpen;
  const pad = huidigPad();
  const doel = bouwHash(pad, combineerQuery(queryVoor(nieuw), leesOverigeParams(parseQuery())));

  document.getElementById('pageRoot')?.setAttribute('aria-busy', 'true');

  if (doel === window.location.hash) {
    render();
    return;
  }
  window.location.hash = doel;
}

function gekozenKanalen() {
  return [...document.querySelectorAll('input[name="filterKanaal"]:checked')].map((el) => el.value);
}

function toggleFilterPaneel(open) {
  const paneel = document.getElementById('filterPaneel');
  if (!paneel) return;
  const nieuw = open ?? paneel.hidden;
  paneel.hidden = !nieuw;
  filterPaneelOpen = nieuw;
  ['filterToggle', 'filterToggleVergelijking', 'filterToggleKanalen', 'filterToggleConversie']
    .forEach((id) => document.getElementById(id)?.setAttribute('aria-expanded', String(nieuw)));
  if (nieuw) document.getElementById('filterPeriode')?.focus();
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

function bindInteractie() {
  document.addEventListener('submit', onSubmit);
  document.addEventListener('click', onClick);
  document.addEventListener('change', onChange);
  document.addEventListener('input', onInput);
  document.addEventListener('keydown', onKeydown);

  // Klik buiten een menu sluit het.
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.accountmenu')) sluitAccountmenu();
    if (!e.target.closest('.kanaalkiezer')) sluitKanaalPaneel();
    if (e.target.id === 'sidebarOverlay') sluitSidebar();
  });

  // De scrollpositie van het werkgebied onthouden, zodat terugkeren naar een
  // lijst je op dezelfde plek zet.
  document.addEventListener('scroll', (e) => {
    const gebied = e.target.closest?.('.werkgebied');
    if (gebied) bewaarScroll(huidigPad(), gebied.scrollTop);
  }, true);
}

async function onSubmit(e) {
  const form = e.target;

  if (form.hasAttribute('data-assistent-form')) {
    e.preventDefault();
    const veld = form.querySelector('[name="vraag"]');
    const vraag = veld?.value ?? '';
    if (veld) veld.value = '';
    assistent.verstuur(vraag);
    return;
  }

  if (form.id === 'loginForm') {
    e.preventDefault();
    await verwerkLogin(form);
    return;
  }
  if (form.id === 'forgotForm') {
    e.preventDefault();
    const email = form.querySelector('#forgotEmail').value;
    const resultaat = await requestPasswordReset({ email });
    renderAuthScherm(renderForgotPassword({ melding: resultaat.melding, gelukt: resultaat.ok }), 'Wachtwoord vergeten');
    return;
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
    return;
  }

  if (form.id === 'nieuweActieForm') {
    e.preventDefault();
    verwerkNieuweActie(form);
    return;
  }

  const actieForm = form.getAttribute('data-actie-form');
  if (actieForm) {
    e.preventDefault();
    verwerkActieWijziging(actieForm, form);
    return;
  }

  const opmerkingForm = form.getAttribute('data-opmerking-form');
  if (opmerkingForm) {
    e.preventDefault();
    const tekst = form.querySelector('[name="tekst"]').value;
    const user = getCurrentUser();
    if (voegOpmerkingToe(opmerkingForm, { auteurId: user.id, tekst })) {
      toast('Opmerking geplaatst.');
    } else {
      toastFout('De opmerking kon niet worden geplaatst.');
    }
    return;
  }

  const negeerForm = form.getAttribute('data-negeer-form');
  if (negeerForm) {
    e.preventDefault();
    const reden = form.querySelector('[name="reden"]').value;
    if (negeerSignaal(negeerForm, reden)) {
      negeerVoorId = null;
      toast('Signaal genegeerd, met de reden erbij.');
    } else {
      toastFout('Geef een reden op voordat je een signaal negeert.');
    }
    return;
  }

  const planForm = form.getAttribute('data-plan-form');
  if (planForm) {
    e.preventDefault();
    if (!can(getCurrentUser(), Permission.MANAGE_SIGNALS)) { toastFout('Je account mag signalen niet verwerken.'); return; }
    const datum = form.querySelector('[name="datum"]').value;
    const resultaat = planSignaalOpvolging(planForm, datum);
    if (resultaat.ok) toast(`Opvolging ingepland op ${datum}.`);
    else toastFout(resultaat.reden ?? 'De opvolging kon niet worden ingepland.');
    return;
  }

  const controleForm = form.getAttribute('data-controle-form');
  if (controleForm) {
    e.preventDefault();
    if (!can(getCurrentUser(), Permission.MANAGE_SIGNALS)) { toastFout('Je account mag signalen niet verwerken.'); return; }
    const datum = form.querySelector('[name="datum"]').value;
    const resultaat = planResultaatcontrole(controleForm, { datum, medewerkerId: getCurrentUser().id });
    if (resultaat.ok) toast(`Resultaatcontrole ingepland op ${datum}.`);
    else toastFout(resultaat.reden ?? 'De resultaatcontrole kon niet worden ingepland.');
    return;
  }

  const planActieForm = form.getAttribute('data-plan-actie-form');
  if (planActieForm) {
    e.preventDefault();
    const user = getCurrentUser();
    if (!can(user, Permission.ASSIGN_ACTIONS)) { toastFout('Alleen de Performance Lead kan een actie inplannen.'); return; }
    const veld = (n) => form.querySelector(`[name="${n}"]`);
    const verantwId = veld('verantwoordelijkeId')?.value || null;
    const resultaat = planActieVanSignaal(planActieForm, {
      titel: veld('titel')?.value ?? null,
      verantwoordelijkeId: verantwId,
      datum: veld('datum')?.value || null,
      prioriteit: veld('prioriteit')?.value || null,
      toelichting: veld('toelichting')?.value || null,
      aanPlanning: veld('aanPlanning')?.checked !== false,
      aanMijnWerk: veld('aanMijnWerk')?.checked !== false,
      auteurId: user.id,
    });
    if (!resultaat.ok) { toastFout(resultaat.reden ?? 'De actie kon niet worden ingepland.'); return; }
    const naam = getToewijsbareMedewerkers(user).find((m) => m.id === verantwId)?.displayName;
    const datumTekst = resultaat.plannedAt ? toonDatum(resultaat.plannedAt) : null;
    toast(datumTekst && naam
      ? `De actie is ingepland voor ${datumTekst} en toegewezen aan ${naam}.`
      : datumTekst ? `De actie is ingepland voor ${datumTekst}.` : 'De actie is aangemaakt.');
    sluitPaneel();
    return;
  }
}

async function onClick(e) {
  const el = e.target.closest('button, a');
  if (!el) return;

  /* --- Aizy-assistent --- */
  if (el.dataset.assistent) {
    const a = el.dataset.assistent;
    if (a === 'toggle') assistent.toggle();
    else if (a === 'open') assistent.open();
    else if (a === 'sluit') assistent.sluit();
    else if (a === 'pin') assistent.zetPositie('vastgezet');
    else if (a === 'unpin') assistent.zetPositie('zwevend');
    else if (a === 'inklap') assistent.toggleInklap();
    else if (a === 'nieuw') assistent.nieuwGesprek();
    else if (a === 'wis') assistent.wisGeschiedenis();
    return;
  }
  if (el.dataset.assistentVraag) { assistent.verstuur(el.dataset.assistentVraag); return; }
  if (el.dataset.assistentInstelling) {
    const i = el.dataset.assistentInstelling;
    if (i === 'zichtbaar-aan') assistent.zetZichtbaar(true);
    else if (i === 'zichtbaar-uit') assistent.zetZichtbaar(false);
    else if (i === 'positie-zwevend') assistent.zetPositie('zwevend');
    else if (i === 'positie-vastgezet') assistent.zetPositie('vastgezet');
    else if (i === 'modus-demo') assistent.zetModus('demo');
    else if (i === 'modus-extern') { assistent.zetModus('extern'); toast('De externe provider is voorbereid, maar nog niet beschikbaar. De demo blijft actief.', { variant: 'info' }); }
    else if (i === 'wis') { assistent.wisGeschiedenis(); toast('Gespreksgeschiedenis gewist.'); }
    return;
  }
  // De navigatielinks van de assistent zijn gewone ankers; die laten we los
  // zodat de bestaande router de route opent (en de assistent open blijft).

  /* --- Inlogscherm --- */
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

  /* --- Shell --- */
  if (el.id === 'menuKnop') { toggleSidebar(); return; }
  if (el.id === 'navInklap') {
    const user = getCurrentUser();
    const voorkeuren = leesUiVoorkeuren(user.id);
    zetNavCompact(user.id, !voorkeuren.navCompact);
    render();
    return;
  }
  if (el.dataset.navgroep) {
    const user = getCurrentUser();
    const voorkeuren = leesUiVoorkeuren(user.id);
    zetNavGroep(user.id, el.dataset.navgroep, !isNavGroepOpen(voorkeuren, el.dataset.navgroep));
    render();
    return;
  }
  if (el.id === 'accountKnop') { toggleAccountmenu(); return; }
  if (el.id === 'menuUitloggen') { await logout(); navigeer('#/login', { vervang: true }); return; }
  if (el.id === 'menuThema' || el.id === 'menuThemaInstellingen') {
    setState({ theme: state.theme === 'dark' ? 'light' : 'dark' });
    sluitAccountmenu();
    return;
  }
  if (el.id === 'menuDemoReset') {
    if (!window.confirm('De demo-indeling en alle demo-interacties terugzetten? Acties, signaalstatussen, planning, tabelweergaven en widgets gaan terug naar de uitgangssituatie.')) return;
    wisAlleDemoGegevens();
    widgetBewerken = false;
    sluitAccountmenu();
    toast('De demo is teruggezet naar de uitgangssituatie.');
    render();
    return;
  }
  if (el.id === 'meldingenKnop') { navigeer('#/agency/signals?tab=nieuw'); return; }
  if (el.id === 'detailSluit') { sluitPaneel(); return; }

  /* --- Filterbalk --- */
  if (['filterToggle', 'filterToggleVergelijking', 'filterToggleKanalen', 'filterToggleConversie'].includes(el.id)) {
    toggleFilterPaneel();
    return;
  }
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

  /* --- Detailpanelen openen --- */
  if (el.dataset.klantpaneel) { openPaneel('klant', el.dataset.klantpaneel); return; }
  if (el.dataset.actiepaneel) { openPaneel('actie', el.dataset.actiepaneel); return; }
  if (el.dataset.signaalpaneel) { openPaneel('signaal', el.dataset.signaalpaneel); return; }
  if (el.dataset.drill) { openMetriek(el.dataset.drill); return; }

  /* --- Signalen: inplannen, filters, paneel sluiten --- */
  if (el.dataset.signaalPlan) {
    if (!can(getCurrentUser(), Permission.ASSIGN_ACTIONS)) { toastFout('Alleen de Performance Lead kan een actie inplannen.'); return; }
    openPaneel('plan', el.dataset.signaalPlan);
    return;
  }
  if (el.hasAttribute('data-paneel-sluit')) { sluitPaneel(); return; }
  if (el.hasAttribute('data-signaal-filter-wissen')) {
    navigeer(hashMetParams(window.location.hash, { klant: null, ernst: null, kanaal: null, verantw: null, ouderdom: null }));
    return;
  }

  /* --- Sprong-ankers van de samenvattingsstrip --- */
  if (el.dataset.spring) {
    const doel = document.getElementById(el.dataset.spring);
    if (doel) doel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  /* --- Cross-filtering op kanaal --- */
  if (el.dataset.kanaalfilter) {
    const huidig = getActieveFilters()?.filters.channels ?? [];
    const alleen = [el.dataset.kanaalfilter];
    // Klikken op het al enige geselecteerde kanaal heft de beperking op.
    const doel = huidig.length === 1 && huidig[0] === el.dataset.kanaalfilter
      ? getActieveFilters()?.toegestaneKanalen ?? alleen
      : alleen;
    pasFilterToe({ channels: doel });
    toast(doel.length === 1 ? `Weergave beperkt tot ${kanaalLabel(doel[0])}.` : 'Kanaalfilter opgeheven.', { variant: 'info' });
    return;
  }
  if (el.dataset.klantomgeving) {
    if (setActieveKlantId(el.dataset.klantomgeving)) navigeer('#/client/overview');
    return;
  }

  /* --- Weergavevorm en subtabs --- */
  if (el.dataset.weergavevorm) { gaNaarParam(UiSleutel.WEERGAVE, el.dataset.weergavevorm); return; }

  /* --- Datagrid --- */
  if (verwerkGridKlik(el)) return;

  /* --- Widgets --- */
  if (verwerkWidgetKlik(el)) return;

  /* --- Acties --- */
  if (verwerkActieKlik(el)) return;

  /* --- Signalen --- */
  if (verwerkSignaalKlik(el)) return;

  /* --- Planning --- */
  if (verwerkPlanningKlik(el)) return;

  /* --- Team --- */
  if (el.dataset.actie) { verwerkTeamActie(el.dataset.actie, el.dataset.user); return; }
  if (el.id === 'nodigUitKnop' || el.id === 'nodigCollegaUit') {
    toast('In deze demo worden geen uitnodigingen verstuurd.', { variant: 'info' });
  }
}

/* ---- Datagrid ---- */

function verwerkGridKlik(el) {
  const d = el.dataset;

  if (d.gridSorteer) { grids.sorteer(d.gridSorteer, d.kolom); return true; }
  if (d.gridDichtheid) { grids.wisselDichtheid(d.gridDichtheid); return true; }
  if (d.gridExport) { grids.exporteer(d.gridExport); return true; }
  if (d.gridHerstel) { grids.herstel(d.gridHerstel); return true; }
  if (d.gridPagina) { grids.blader(d.gridPagina, d.richting); return true; }
  if (d.gridSelectieleeg) { grids.wisSelectie(d.gridSelectieleeg); return true; }
  if (d.gridKolomop) { grids.schuifKolom(d.gridKolomop, d.kolom, 'op'); return true; }
  if (d.gridKolomneer) { grids.schuifKolom(d.gridKolomneer, d.kolom, 'neer'); return true; }
  if (d.gridKolomvast) { grids.wisselVastzetten(d.gridKolomvast, d.kolom); return true; }
  if (d.gridWeergave) { grids.pasWeergaveToeOpGrid(d.gridWeergave, d.weergave); return true; }
  if (d.gridWeergaveweg) { grids.verwijderOpgeslagenWeergave(d.gridWeergaveweg, d.weergave); return true; }

  if (d.gridWeergaveopslaan) {
    const veld = document.querySelector(`[data-grid-weergavenaam="${d.gridWeergaveopslaan}"]`);
    grids.slaWeergaveOp(d.gridWeergaveopslaan, veld?.value ?? '');
    return true;
  }

  if (d.gridKolommen || d.gridWeergaven) {
    const grid = d.gridKolommen ?? d.gridWeergaven;
    const paneelId = d.gridKolommen ? `grid-kolommen-${grid}` : `grid-weergaven-${grid}`;
    const paneel = document.getElementById(paneelId);
    if (!paneel) return true;
    const open = paneel.hidden;
    paneel.hidden = !open;
    el.setAttribute('aria-expanded', String(open));
    if (open) openGridPanelen.add(paneelId);
    else openGridPanelen.delete(paneelId);
    return true;
  }

  if (d.gridBulk) { verwerkBulkactie(d.gridBulk, d.bulk); return true; }

  return false;
}

function verwerkBulkactie(gridId, bulk) {
  const rijen = grids.geselecteerdeRijen(gridId);
  if (!rijen.length) {
    toastFout('Selecteer eerst een of meer rijen.');
    return;
  }

  const user = getCurrentUser();

  if (gridId === 'acties') {
    if (!can(user, Permission.MANAGE_ACTIONS)) { toastFout('Je mag deze acties niet wijzigen.'); return; }
    const patch = {
      'status-bezig': { status: ActieStatus.BEZIG },
      'status-afgerond': { status: ActieStatus.AFGEROND },
      'prioriteit-hoog': { prioriteit: ActiePrioriteit.HOOG },
    }[bulk];
    if (!patch) return;
    rijen.forEach((a) => wijzigActie(a.id, patch));
    grids.wisSelectie(gridId);
    toast(`${rijen.length} ${rijen.length === 1 ? 'actie' : 'acties'} bijgewerkt.`);
    return;
  }

  if (bulk === 'actie-aanmaken') {
    if (!can(user, Permission.MANAGE_ACTIONS)) { toastFout('Je mag geen acties aanmaken.'); return; }
    rijen.forEach((s) => maakAanActie({
      titel: `Controle ${s.client.name}`,
      omschrijving: 'Aangemaakt vanuit een selectie op de portefeuillepagina.',
      klantId: s.client.id,
      verantwoordelijkeId: s.client.primaryOwnerId,
      prioriteit: s.prioriteit.niveau === 'direct' ? ActiePrioriteit.HOOG : ActiePrioriteit.MIDDEL,
      soort: ActieSoort.CAMPAGNECONTROLE,
      status: ActieStatus.NIEUW,
    }));
    grids.wisSelectie(gridId);
    toast(`${rijen.length} ${rijen.length === 1 ? 'actie' : 'acties'} aangemaakt.`, {
      actie: { label: 'Naar het actiecentrum', hash: '#/agency/actions' },
    });
    return;
  }

  if (bulk === 'open-signalen') {
    grids.wisSelectie(gridId);
    navigeer(`#/agency/signals?klant=${encodeURIComponent(rijen[0].client.id)}`);
  }
}

/* ---- Widgets ---- */

function verwerkWidgetKlik(el) {
  const d = el.dataset;
  const user = getCurrentUser();
  if (!user) return false;

  if (el.id === 'widgetBewerken' || el.id === 'widgetBewerkenKop') {
    widgetBewerken = !widgetBewerken;
    render();
    return true;
  }
  if (el.id === 'widgetHerstel' || el.id === 'widgetHerstelLeeg') {
    herstelIndeling(user.id);
    toast('De standaardindeling is hersteld.');
    render();
    return true;
  }
  if (d.widgetOp) { schuifWidget(user.id, d.widgetOp, 'omhoog'); render(); return true; }
  if (d.widgetNeer) { schuifWidget(user.id, d.widgetNeer, 'omlaag'); render(); return true; }
  if (d.widgetGroter) { schaalWidget(user.id, d.widgetGroter, 'groter'); render(); return true; }
  if (d.widgetKleiner) { schaalWidget(user.id, d.widgetKleiner, 'kleiner'); render(); return true; }
  if (d.widgetVerberg) {
    zetZichtbaarheid(user.id, d.widgetVerberg, false);
    toast('Widget verborgen. Toevoegen kan met de knoppen boven het raster.');
    render();
    return true;
  }
  if (d.widgetToon) { zetZichtbaarheid(user.id, d.widgetToon, true); render(); return true; }

  return false;
}

/* ---- Acties ---- */

function verwerkActieKlik(el) {
  const d = el.dataset;
  const user = getCurrentUser();

  if (el.id === 'nieuweActieKnop' || el.id === 'nieuweActieKop' || el.id === 'nieuweActieKnopLeeg') {
    nieuweActieOpen = !nieuweActieOpen;
    render();
    if (nieuweActieOpen) document.getElementById('actieTitel')?.focus();
    return true;
  }

  if (d.nieuweactie) {
    nieuweActieOpen = true;
    const doel = huidigPad().startsWith('/agency/actions') ? null : '#/agency/actions';
    if (doel) {
      navigeer(doel);
    } else {
      render();
    }
    window.setTimeout(() => {
      const klant = document.getElementById('actieKlant');
      if (klant) klant.value = d.nieuweactie;
      document.getElementById('actieTitel')?.focus();
    }, 60);
    return true;
  }

  if (d.actiePlan) {
    if (zetDatum(d.actiePlan, DEMO_TODAY)) toast('Actie ingepland op vandaag.');
    return true;
  }

  if (d.actieDag) {
    const actie = getActie(d.actieDag);
    if (!actie?.startdatum) { toastFout('Deze actie heeft nog geen startdatum.'); return true; }
    const nieuw = plusDagen(actie.startdatum, d.richting === 'vorige' ? -1 : 1);
    if (zetDatum(d.actieDag, nieuw)) toast(`Actie verplaatst naar ${nieuw}.`);
    return true;
  }

  if (d.actieVerwijder) {
    if (!window.confirm('Deze actie verwijderen? Dat kan niet ongedaan worden gemaakt.')) return true;
    if (verwijderActie(d.actieVerwijder)) {
      toast('De actie is verwijderd.');
      sluitPaneel();
    }
    return true;
  }

  if (d.week) {
    const huidig = leesUiParams(parseQuery())[UiSleutel.DATUM] ?? DEMO_TODAY;
    const nieuw = d.week === 'vandaag'
      ? DEMO_TODAY
      : plusDagen(beginVanWeek(huidig), d.week === 'vorige' ? -7 : 7);
    gaNaarParam(UiSleutel.DATUM, nieuw);
    return true;
  }

  if (d.klantGoedkeuren) {
    if (!can(user, Permission.CLIENT_COLLABORATE)) { toastFout('Je account mag niets wijzigen.'); return true; }
    wijzigActie(d.klantGoedkeuren, { goedgekeurdOp: new Date().toISOString(), status: ActieStatus.GEPLAND });
    toast('Bedankt, je akkoord is doorgegeven aan Aizy.');
    return true;
  }

  if (d.klantReageren) {
    if (!can(user, Permission.CLIENT_COLLABORATE)) { toastFout('Je account mag niets wijzigen.'); return true; }
    openPaneel('actie', d.klantReageren);
    return true;
  }

  return false;
}

function verwerkNieuweActie(form) {
  const user = getCurrentUser();
  if (!can(user, Permission.MANAGE_ACTIONS)) { toastFout('Je mag geen acties aanmaken.'); return; }

  const data = new FormData(form);
  const titel = String(data.get('titel') ?? '').trim();
  const klantId = String(data.get('klantId') ?? '');

  if (!titel || !klantId) {
    toastFout('Een actie heeft minstens een titel en een klant nodig.');
    return;
  }

  const actie = maakAanActie({
    titel,
    omschrijving: String(data.get('omschrijving') ?? ''),
    klantId,
    kanaal: String(data.get('kanaal') ?? '') || null,
    verantwoordelijkeId: String(data.get('verantwoordelijkeId') ?? '') || user.id,
    prioriteit: String(data.get('prioriteit') ?? ActiePrioriteit.MIDDEL),
    soort: String(data.get('soort') ?? ActieSoort.OPTIMALISATIE),
    startdatum: String(data.get('startdatum') ?? '') || null,
    deadline: String(data.get('deadline') ?? '') || null,
    status: data.get('startdatum') ? ActieStatus.GEPLAND : ActieStatus.NIEUW,
    zichtbaarVoorKlant: data.get('zichtbaarVoorKlant') === 'on',
  });

  nieuweActieOpen = false;
  toast(`Actie "${actie.titel}" aangemaakt.`);
}

function verwerkActieWijziging(id, form) {
  const user = getCurrentUser();
  const actie = getActie(id);
  if (!actie || !magActieBewerken(user, actie)) {
    toastFout('Je mag deze actie niet wijzigen.');
    return;
  }

  const data = new FormData(form);
  wijzigActie(id, {
    titel: String(data.get('titel') ?? actie.titel).trim() || actie.titel,
    omschrijving: String(data.get('omschrijving') ?? ''),
    status: String(data.get('status') ?? actie.status),
    prioriteit: String(data.get('prioriteit') ?? actie.prioriteit),
    startdatum: String(data.get('startdatum') ?? '') || null,
    deadline: String(data.get('deadline') ?? '') || null,
    verantwoordelijkeId: String(data.get('verantwoordelijkeId') ?? '') || null,
    zichtbaarVoorKlant: data.get('zichtbaarVoorKlant') === 'on',
  });
  toast('De wijzigingen zijn opgeslagen. Lijst, bord en agenda tonen ze meteen.');
}

/* ---- Signalen ---- */

function verwerkSignaalKlik(el) {
  const d = el.dataset;
  const user = getCurrentUser();
  if (!d.signaalBekeken && !d.signaalActie && !d.signaalNegeren && !d.signaalOplossen
    && !d.signaalHeropen && !d.signaalBeoordeel) {
    return false;
  }
  if (!can(user, Permission.MANAGE_SIGNALS)) {
    toastFout('Je account mag signalen niet verwerken.');
    return true;
  }

  if (d.signaalBekeken) { markeerBekeken(d.signaalBekeken); toast('Signaal beoordeeld.'); return true; }
  if (d.signaalOplossen) { losSignaalOp(d.signaalOplossen); toast('Signaal gemarkeerd als opgelost.'); return true; }
  if (d.signaalHeropen) { heropenSignaal(d.signaalHeropen); toast('Signaal heropend.'); return true; }

  if (d.signaalBeoordeel) {
    const notitie = el.closest('form')?.querySelector('[name="notitie"]')?.value ?? null;
    const resultaat = beoordeelResultaat(d.signaalBeoordeel, { uitkomst: el.dataset.uitkomst, notitie, verantwoordelijkeId: user.id });
    if (!resultaat.ok) { toastFout(resultaat.reden ?? 'De beoordeling kon niet worden verwerkt.'); return true; }
    if (resultaat.actie) {
      toast(`Vervolgactie aangemaakt: ${resultaat.actie.titel}`, {
        actie: { label: 'Naar het actiecentrum', hash: '#/agency/actions' },
      });
      openPaneel('actie', resultaat.actie.id);
    } else if (el.dataset.uitkomst === 'heropenen') {
      toast('Signaal heropend: het resultaat was nog niet voldoende.');
    } else {
      toast('Resultaat gecontroleerd en signaal opgelost.');
    }
    return true;
  }
  if (d.signaalNegeren) {
    negeerVoorId = negeerVoorId === d.signaalNegeren ? null : d.signaalNegeren;
    render();
    document.getElementById(`negeerReden-${d.signaalNegeren}`)?.focus();
    return true;
  }

  if (d.signaalActie) {
    const resultaat = maakActieVanSignaal(d.signaalActie, { verantwoordelijkeId: user.id });
    if (!resultaat) { toastFout('Dit signaal bestaat niet meer.'); return true; }
    if (resultaat.nieuw) {
      toast(`Actie aangemaakt: ${resultaat.actie.titel}`, {
        actie: { label: 'Naar het actiecentrum', hash: '#/agency/actions' },
      });
    } else {
      toast('Er bestond al een actie voor dit signaal. Die wordt nu geopend.', { variant: 'info' });
    }
    openPaneel('actie', resultaat.actie.id);
    return true;
  }

  return true;
}

/* ---- Planning ---- */

function verwerkPlanningKlik(el) {
  const d = el.dataset;

  if (d.planningSchuif) {
    const params = leesUiParams(parseQuery());
    const weergave = params[UiSleutel.BEREIK] ?? 'week';
    const anker = params[UiSleutel.DATUM] ?? DEMO_TODAY;
    const nieuw = d.planningSchuif === 'vandaag' ? DEMO_TODAY : verschuif(weergave, anker, d.planningSchuif);
    gaNaarParam(UiSleutel.DATUM, nieuw);
    return true;
  }

  if (d.planDag) {
    const item = document.querySelector(`[data-planitem="${d.planDag}"]`);
    const cel = item?.closest('[data-datum]');
    const huidig = cel?.getAttribute('data-datum');
    if (!huidig) { toastFout('De datum van dit item is niet te bepalen.'); return true; }
    const nieuw = plusDagen(huidig, d.richting === 'vorige' ? -1 : 1);
    const resultaat = verplaatsItem(d.planDag, nieuw);
    if (resultaat.ok) toast(`Verplaatst naar ${nieuw}.`);
    else toastFout(resultaat.reden);
    return true;
  }

  return false;
}

/* ---- Team ---- */

function verwerkTeamActie(actie, userId) {
  const user = getCurrentUser();
  if (!can(user, Permission.MANAGE_TEAM)) return;

  if (actie === 'deactiveer') {
    if (!window.confirm('Dit account deactiveren? De gebruiker kan daarna niet meer inloggen.')) return;
    schrijfOverride(userId, { status: 'gedeactiveerd' });
    toast('Het account is gedeactiveerd.');
  }
  if (actie === 'activeer') {
    schrijfOverride(userId, { status: 'actief' });
    toast('Het account is geactiveerd.');
  }
  if (actie === 'opnieuw-uitnodigen') {
    toast('In deze demo worden geen uitnodigingen verstuurd.', { variant: 'info' });
  }
  if (actie === 'wijzig-klanten' || actie === 'wijzig-rol') {
    toast('Deze wijziging is in de demo nog niet beschikbaar.', { variant: 'info' });
  }
  render();
}

/* ---------------------------------------------------------------
   change en input
   --------------------------------------------------------------- */

function onChange(e) {
  const el = e.target;
  const id = el.id;
  const d = el.dataset;

  /* Filterbalk */
  if (id === 'filterPeriode') {
    const preset = el.value;
    const huidig = getActieveFilters()?.resolved.periode;
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
  if (id === 'filterVergelijking') { pasFilterToe({ comparison: { mode: el.value } }); return; }
  if (id === 'filterConversie') { pasFilterToe({ conversionScope: el.value }); return; }
  if (el.name === 'filterKanaal') { pasFilterToe({ channels: gekozenKanalen() }, { paneelOpen: true }); return; }

  /* Klantcontext */
  if (id === 'contextSelect') {
    const waarde = el.value;
    if (!waarde) {
      setActieveKlantId(null);
      navigeer(standaardRoute(getCurrentUser()));
    } else if (setActieveKlantId(waarde)) {
      navigeer('#/client/overview');
    }
    return;
  }

  /* Datagrid */
  if (d.gridFilter) { grids.zetFilter(d.gridFilter, d.filter, el.value); return; }
  if (d.gridGroep) { grids.zetGroepering(d.gridGroep, el.value); return; }
  if (d.gridPerpagina) { grids.zetPerPagina(d.gridPerpagina, el.value); return; }
  if (d.gridKolomkeuze) { grids.zetKolomZichtbaar(d.gridKolomkeuze, el.value, el.checked); return; }
  if (d.gridRijkeuze) { grids.zetRijSelectie(d.gridRijkeuze, el.value, el.checked); return; }
  if (d.gridAlles) { grids.zetAllesSelectie(d.gridAlles, el.checked); return; }

  /* Acties */
  if (d.actieStatus) {
    const user = getCurrentUser();
    const actie = getActie(d.actieStatus);
    if (!actie || !magActieBewerken(user, actie)) { toastFout('Je mag deze actie niet wijzigen.'); return; }
    zetStatus(d.actieStatus, el.value);
    toast(`Status gewijzigd naar ${el.options[el.selectedIndex].text}.`);
    return;
  }

  /* Signalen */
  if (d.signaalToewijzen) {
    const user = getCurrentUser();
    if (!can(user, Permission.MANAGE_SIGNALS)) { toastFout('Je account mag signalen niet verwerken.'); return; }
    wijsSignaalToe(d.signaalToewijzen, el.value);
    toast(el.value ? 'Signaal toegewezen.' : 'Toewijzing verwijderd.');
    return;
  }
  if (d.signaalFilter) { gaNaarParam(d.signaalFilter, el.value || null); return; }

  /* Planning */
  if (d.planningGroep != null && el.hasAttribute('data-planning-groep')) { gaNaarParam(UiSleutel.GROEP, el.value); return; }
  if (d.planningFilter) { gaNaarParam(d.planningFilter, el.value); }
}

let zoekTimer = null;

function onInput(e) {
  const el = e.target;
  const d = el.dataset;

  if (d.gridZoek) {
    // Even wachten, zodat er niet bij iedere aanslag opnieuw wordt gerenderd en
    // de cursor in het veld blijft staan.
    window.clearTimeout(zoekTimer);
    const grid = d.gridZoek;
    const waarde = el.value;
    zoekTimer = window.setTimeout(() => {
      grids.zoek(grid, waarde);
      const veld = document.querySelector(`[data-grid-zoek="${grid}"]`);
      if (veld) {
        veld.focus();
        veld.setSelectionRange(veld.value.length, veld.value.length);
      }
    }, 220);
    return;
  }

  if (el.id === 'globaalZoek') {
    window.clearTimeout(zoekTimer);
    const waarde = el.value;
    zoekTimer = window.setTimeout(() => zoekGlobaal(waarde), 260);
  }
}

/**
 * De globale zoekfunctie.
 *
 * Zoekt in klanten, acties en signalen en toont het resultaat als een lijst
 * onder het zoekveld. Bewust geen aparte zoekpagina: wie zoekt, wil doorklikken
 * en niet eerst een tussenscherm.
 */
function zoekGlobaal(term) {
  const bestaand = document.getElementById('zoekResultaat');
  bestaand?.remove();

  const schoon = String(term ?? '').trim().toLowerCase();
  if (schoon.length < 2) return;

  const user = getCurrentUser();
  const filters = getActieveFilters()?.resolved;
  if (!user || !filters) return;

  const klanten = getAccessibleClients(user)
    .filter((c) => c.name.toLowerCase().includes(schoon))
    .slice(0, 4)
    .map((c) => ({ soort: 'klant', id: c.id, label: c.name, sub: 'Klant' }));

  const acties = getToegankelijkeActies(user)
    .filter((a) => a.titel.toLowerCase().includes(schoon))
    .slice(0, 4)
    .map((a) => ({ soort: 'actie', id: a.id, label: a.titel, sub: `Actie · ${a.klantNaam}` }));

  const signalen = getWerkSignalen(user, filters)
    .filter((s) => s.probleem.toLowerCase().includes(schoon))
    .slice(0, 4)
    .map((s) => ({ soort: 'signaal', id: s.id, label: s.probleem, sub: `Signaal · ${s.klantNaam}` }));

  const resultaten = [...klanten, ...acties, ...signalen];
  const veld = document.getElementById('globaalZoek');
  if (!veld) return;

  const lijst = document.createElement('div');
  lijst.id = 'zoekResultaat';
  lijst.className = 'zoekresultaat';
  lijst.setAttribute('role', 'listbox');
  lijst.innerHTML = resultaten.length
    ? resultaten.map((r) => `<button type="button" role="option" aria-selected="false"
        data-${r.soort}paneel="${esc(r.id)}">
        <span class="zoek-label">${esc(r.label)}</span>
        <span class="zoek-sub">${esc(r.sub)}</span>
      </button>`).join('')
    : '<p class="muted klein">Geen klanten, acties of signalen gevonden.</p>';

  veld.parentElement.appendChild(lijst);
}

/* ---------------------------------------------------------------
   Toetsenbord
   --------------------------------------------------------------- */

function onKeydown(e) {
  // Sneltoets voor de assistent (⌘/Ctrl + Shift + A); ⌘/Ctrl + K blijft zoeken.
  if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
    e.preventDefault();
    if (getCurrentUser()) assistent.toggle();
    return;
  }

  if (e.key !== 'Escape') return;

  // Een zwevend, geopend assistentpaneel sluit met Escape; vastgezet blijft staan.
  if (!assistent.isVastgezet() && assistent.isOpen()) {
    assistent.sluit();
    document.getElementById('assistentLauncher')?.focus();
    return;
  }

  const zoekResultaat = document.getElementById('zoekResultaat');
  if (zoekResultaat) { zoekResultaat.remove(); return; }

  const kanaalPaneel = document.getElementById('filterKanalenPaneel');
  if (kanaalPaneel && !kanaalPaneel.hidden) { sluitKanaalPaneel({ focusTerug: true }); return; }

  const filterPaneel = document.getElementById('filterPaneel');
  if (filterPaneel && !filterPaneel.hidden) { toggleFilterPaneel(false); return; }

  const detail = document.getElementById('detailpaneel');
  if (detail?.classList.contains('is-open')) { sluitPaneel(); return; }

  sluitAccountmenu();
  sluitSidebar();
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
  if (paneel && !paneel.hidden) {
    paneel.hidden = true;
    document.getElementById('accountKnop')?.setAttribute('aria-expanded', 'false');
  }
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (!sidebar) return;
  const open = sidebar.classList.toggle('open');
  if (overlay) overlay.hidden = !open;
  document.getElementById('menuKnop')?.setAttribute('aria-expanded', String(open));
}

function sluitSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  sidebar?.classList.remove('open');
  if (overlay) overlay.hidden = true;
  document.getElementById('menuKnop')?.setAttribute('aria-expanded', 'false');
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

/* ---------------------------------------------------------------
   Slepen
   --------------------------------------------------------------- */

function bindSleepdoelen() {
  bindSlepen();

  // Een actiekaart die in een andere kolom belandt, verandert werkelijk van
  // status. De lijst en de agenda tonen die wijziging bij de volgende render.
  registreerSleepdoel('actie', (id, status) => {
    const user = getCurrentUser();
    const actie = getActie(id);
    if (!actie || !magActieBewerken(user, actie)) { toastFout('Je mag deze actie niet wijzigen.'); return; }
    if (actie.status === status) return;
    zetStatus(id, status);
    toast(`"${actie.titel}" verplaatst naar ${status.replace(/-/g, ' ')}.`);
  });

  registreerSleepdoel('actie-datum', (id, datum) => {
    const user = getCurrentUser();
    const actie = getActie(id);
    if (!actie || !magActieBewerken(user, actie)) { toastFout('Je mag deze actie niet wijzigen.'); return; }
    if (actie.startdatum === datum) return;
    zetDatum(id, datum);
    toast(`"${actie.titel}" verplaatst naar ${datum}.`);
  });

  registreerSleepdoel('planning', (id, datum) => {
    const resultaat = verplaatsItem(id, datum);
    if (resultaat.ok) toast(`Planning verplaatst naar ${datum}.`);
    else toastFout(resultaat.reden);
  });

  registreerSleepdoel('widget', (id, doelId) => {
    const user = getCurrentUser();
    if (id === doelId) return;
    verplaatsWidget(user.id, id, doelId);
    render();
  });

  bindKolombreedte((kolom, breedte, grid) => grids.zetBreedte(grid, kolom, breedte));
  bindKolomvolgorde((grid, kolom, doel) => grids.verplaatsKolom(grid, kolom, doel));
}

/* ---------------------------------------------------------------
   Opstarten
   --------------------------------------------------------------- */

async function init() {
  applyTheme();
  bindInteractie();
  bindSleepdoelen();
  bindTooltips();
  grids.initGrids(render);

  // Iedere wijziging in de demo-opslag leidt tot één hertekening. Daardoor
  // tonen lijst, bord en agenda per definitie dezelfde gegevens.
  onDemoWijziging(() => render());

  await restoreSession();

  if (!window.location.hash || window.location.hash === '#') {
    const user = getCurrentUser();
    window.history.replaceState(null, '', user ? standaardRoute(user) : '#/login');
  }

  startRouter(render);
  onAuthChange(() => {});
  subscribe(() => applyTheme());

  render();
}

document.addEventListener('DOMContentLoaded', init);
