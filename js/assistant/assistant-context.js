/**
 * Contextbuilder van de Aizy-assistent.
 *
 * De assistent kijkt nooit rechtstreeks in de store. Deze module stelt een
 * gecontroleerde, compacte context samen uit dezelfde repositories en selectors
 * die de pagina's zelf gebruiken — en uitsluitend met gegevens die de gebruiker
 * op basis van zijn rol óók in de interface mag zien.
 *
 * De samenvatting is bewust klein: genoeg om een pagina te duiden en een zinnig
 * demo-antwoord te geven, niet de volledige dataset. Datzelfde compacte model
 * gaat later naar een echte provider — nooit de hele store.
 */

import { can, Permission } from '../auth/permissions.js';
import { isAgencyGebruiker } from '../auth/domain.js';
import { toonBereik } from '../filters/period.js';
import { getAccessibleClientSummaries, getAgencyOverview } from '../data/repository.js';
import { getWerkSignalen, getToegankelijkeActies, actieSamenvatting } from '../data/work-repository.js';
import { SignaalStatus } from '../model/signals.js';

/** Herkent de "aandacht nodig"-status ongeacht de exacte labeltekst. */
function vraagtAandacht(status) {
  if (!status) return false;
  const label = String(status.label ?? '').toLowerCase();
  return status.variant === 'hoog' || label.includes('aandacht');
}

/**
 * Stelt een pagina-afhankelijke samenvatting samen. Alles binnen try/catch: een
 * ontbrekend cijfer mag de assistent nooit laten vallen — dan verschijnt gewoon
 * een algemenere regel.
 */
function bouwSamenvatting(user, pageType, { filters, clientId, clientName }) {
  try {
    if (pageType === 'agency-portfolio' || pageType === 'agency-clients' || pageType === 'agency-work') {
      const s = getAccessibleClientSummaries(user, filters);
      return { klantenTotaal: s.length, aandacht: s.filter((x) => vraagtAandacht(x.status)).length };
    }

    if (pageType === 'agency-client-detail' || pageType?.startsWith('client-')) {
      const s = getAccessibleClientSummaries(user, filters).find((x) => x.client?.id === clientId);
      if (!s) return { clientName };
      const t = s.totalen ?? {};
      return {
        clientName: s.client?.name ?? clientName,
        statusLabel: s.status?.label ?? null,
        spend: t.spend ?? t.kosten ?? null,
        leads: t.leads ?? null,
        cpl: t.cpl ?? (t.leads ? Math.round(((t.spend ?? t.kosten ?? 0) / t.leads) * 100) / 100 : null),
        qualifiedLeads: t.qualifiedLeads ?? t.gekwalificeerdeLeads ?? null,
        openSignalen: s.openSignalen ?? null,
      };
    }

    if (pageType === 'agency-signals') {
      const sig = getWerkSignalen(user, filters);
      return {
        signalenTotaal: sig.length,
        signalenNieuw: sig.filter((x) => x.status === SignaalStatus.NIEUW).length,
        signalenZonderEigenaar: sig.filter((x) => x.open && !x.verantwoordelijkeId).length,
        signalenZonderActie: sig.filter((x) => x.open && !x.primaryActionId).length,
        signalenZonderPlanning: sig.filter((x) => x.open && x.primaryActionId && !x.plannedAt).length,
      };
    }

    if (pageType === 'agency-actions' || pageType === 'agency-work') {
      const acties = getToegankelijkeActies(user);
      const sam = actieSamenvatting(acties);
      return {
        actiesTotaal: sam.totaal,
        actiesOpen: sam.open.length,
        actiesVerlopen: sam.verlopen.length,
        actiesVandaag: sam.vandaag.length,
        actiesWachtOpKlant: sam.wachtOpKlant.length,
      };
    }

    // De agency-brede performance- en analysepagina's delen één aggregatie.
    const PERFORMANCE = [
      'agency-channels', 'agency-channel', 'agency-campaigns', 'agency-budgets',
      'agency-conversions', 'agency-dataquality', 'agency-insights', 'agency-reports',
    ];
    if (PERFORMANCE.includes(pageType)) {
      const o = getAgencyOverview(user, filters);
      return {
        klantenTotaal: o.aantalKlanten,
        aandacht: o.aandachtNodig,
        opKoers: o.opKoers,
        spend: o.totaleSpend,
        budget: o.totaalBudget,
        pacing: o.pacing != null ? Math.round(o.pacing) : null,
        leads: o.leadgen?.leads ?? null,
        gemCpl: o.leadgen?.gemiddeldeCpl != null ? Math.round(o.leadgen.gemiddeldeCpl * 100) / 100 : null,
        aankopen: o.ecommerce?.aankopen ?? null,
        gemRoas: o.ecommerce?.gemiddeldeRoas != null ? Math.round(o.ecommerce.gemiddeldeRoas * 10) / 10 : null,
        dekkingProblemen: o.onvolledigeDekking,
        trackingProblemen: o.trackingProblemen,
        openSignalen: o.openSignalen,
      };
    }
  } catch {
    // Geen samenvatting is geen fout: de assistent valt terug op algemene hulp.
  }
  return {};
}

/**
 * Bouwt de volledige assistentcontext voor de huidige render.
 *
 * @param {object} bron alles wat de shell al heeft berekend
 * @returns {object} de gecontroleerde context
 */
export function bouwAssistantContext({
  user, route, params = {}, filters = null, omgeving = 'agency',
  tab = null, clientId = null, clientName = null, pagina = null, openPaneel = null,
}) {
  const pageType = route?.naam ?? 'onbekend';
  const rol = user?.memberships?.[0]?.rol ?? null;

  const summary = bouwSamenvatting(user, pageType, { filters, clientId, clientName });

  const rechten = {
    beheertActies: can(user, Permission.MANAGE_ACTIONS),
    wijstActiesToe: can(user, Permission.ASSIGN_ACTIONS),
    beheertSignalen: can(user, Permission.MANAGE_SIGNALS),
    zietSignalen: can(user, Permission.VIEW_AGENCY_SIGNALS),
    zietPlanning: can(user, Permission.VIEW_AGENCY_PLANNING),
    isAgency: isAgencyGebruiker(user),
  };

  return {
    route: route?.pad ?? null,
    pageType,
    environment: omgeving,
    userId: user?.id ?? null,
    userRole: rol,
    clientId,
    clientName: clientName ?? summary.clientName ?? null,
    activeTab: tab,
    openDrawer: openPaneel ? { soort: openPaneel.soort, id: openPaneel.id } : null,
    selectedPeriod: filters?.periode
      ? { start: filters.periode.startDate, end: filters.periode.endDate }
      : null,
    periodeLabel: filters?.periode ? toonBereik(filters.periode.startDate, filters.periode.endDate) : 'de geselecteerde periode',
    comparisonPeriod: filters?.vergelijking?.mode && filters.vergelijking.mode !== 'none'
      ? { mode: filters.vergelijking.mode, start: filters.vergelijking.startDate, end: filters.vergelijking.endDate }
      : null,
    activeFilters: {
      channels: filters?.channels ?? [],
      conversionScope: filters?.conversionScope ?? null,
    },
    pageTitle: pagina?.titel ?? route?.titel ?? null,
    pageModel: pagina?.model ?? null,
    summary,
    permissions: rechten,
  };
}

/**
 * Het compacte, API-ready requestmodel. Dit — en niet de store — is wat later
 * naar een echte provider gaat.
 */
export function naarRequestModel(message, context, conversation = []) {
  return {
    message,
    pageContext: {
      route: context.route,
      pageType: context.pageType,
      environment: context.environment,
      clientId: context.clientId,
      clientName: context.clientName,
      activeTab: context.activeTab,
      selectedPeriod: context.selectedPeriod,
      filters: context.activeFilters,
      summary: context.summary,
      permissions: context.permissions,
    },
    conversation: conversation.map((b) => ({ rol: b.rol, tekst: b.tekst })),
    locale: 'nl-NL',
  };
}
