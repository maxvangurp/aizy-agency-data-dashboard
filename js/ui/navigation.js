/**
 * Navigatiestructuur per rol.
 *
 * De navigatie is geen lijst met alle pagina's die bestaan, maar een beschrijving
 * van het werk dat iemand doet. Een agencybeheerder begint bij de portefeuille,
 * een medewerker bij zijn eigen dag, een klant bij zijn eigen resultaat. Die
 * volgorde staat hier en niet in de router, omdat de router over toegang gaat en
 * deze module over betekenis.
 *
 * REGELS
 *   - Een onderdeel waar geen recht voor bestaat, verschijnt niet. Een link die
 *     daarna een geen-toegangpagina toont, is een belofte die niet wordt
 *     nagekomen.
 *   - Een groep zonder zichtbare onderdelen verdwijnt in zijn geheel.
 *   - Iedere link wijst naar een bestaande route. Er staan geen plaatshouders in.
 *   - Iconen zijn ondersteunend. Bij een ingeklapte navigatie draagt de tooltip
 *     en het aria-label de betekenis, nooit het pictogram alleen.
 */

import { can, Permission } from '../auth/permissions.js';
import { Rol, primaireRol } from '../auth/domain.js';

/**
 * Iconen als inline pad, zodat er geen extra verzoek nodig is en het icoon de
 * tekstkleur volgt. Puur decoratief: ze staan altijd naast een label.
 */
export const ICONEN = {
  portefeuille: 'M3 5h18v4H3zM3 11h8v8H3zM13 11h8v8h-8z',
  werk: 'M4 7h16v12H4zM9 7V5h6v2',
  klanten: 'M4 19v-2a4 4 0 0 1 4-4h2a4 4 0 0 1 4 4v2M9 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6M17 19v-2a4 4 0 0 0-2-3.4',
  team: 'M3 20v-1a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v1M9 4a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7M18 20v-1a5 5 0 0 0-2-4',
  kanalen: 'M4 20V9M10 20V4M16 20v-7M22 20V11',
  campagnes: 'M4 12h4l3-7 3 14 3-7h4',
  budget: 'M12 3v18M8 7h6a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h6',
  conversies: 'M4 5h16l-6 7v6l-4 2v-8z',
  acties: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
  planning: 'M3 6h18v15H3zM3 10h18M8 3v4M16 3v4',
  signalen: 'M12 3a6 6 0 0 1 6 6v4l2 3H4l2-3V9a6 6 0 0 1 6-6M10 19a2 2 0 0 0 4 0',
  inzichten: 'M9 18h6M10 21h4M12 3a6 6 0 0 1 4 10.5V15H8v-1.5A6 6 0 0 1 12 3',
  rapportages: 'M6 3h9l4 4v14H6zM15 3v4h4M9 13h6M9 17h6',
  datakwaliteit: 'M12 3l8 4v6c0 5-3.5 7.5-8 8-4.5-.5-8-3-8-8V7zM9 12l2 2 4-4',
  integraties: 'M9 3v4M15 3v4M6 7h12v5a6 6 0 0 1-12 0zM12 18v3',
  instellingen: 'M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-2.8-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.5 15H3a2 2 0 1 1 0-4h.2A1.6 1.6 0 0 0 4.3 8.2l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1z',
  overzicht: 'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z',
  resultaten: 'M4 19h16M7 16V9M12 16V5M17 16v-4',
  samenwerking: 'M8 12h8M8 8h8M4 4h16v12H8l-4 4z',
  vandaag: 'M12 8v4l3 2M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18',
};

/**
 * Bouwt een navigatie-item.
 * `match` bepaalt wanneer het item actief is; standaard is dat een exacte
 * overeenkomst van het pad, zodat een subpagina niet twee items tegelijk
 * oplicht.
 */
function item(pad, label, icoon, permission, { match = null, uitleg = '' } = {}) {
  return { pad, hash: `#${pad}`, label, icoon, permission, match, uitleg };
}

/* ---------------------------------------------------------------
   Agencybeheerder en medewerker
   --------------------------------------------------------------- */

function beheerderNavigatie() {
  return [
    {
      id: 'start',
      titel: 'Start',
      items: [
        item('/agency/portfolio', 'Portefeuille', 'portefeuille', Permission.VIEW_AGENCY_DASHBOARD,
          { match: (pad) => pad === '/agency/portfolio' || pad === '/agency/overview' }),
        item('/agency/work', 'Mijn werk', 'werk', Permission.VIEW_AGENCY_DASHBOARD),
      ],
    },
    {
      id: 'beheer',
      titel: 'Beheer',
      items: [
        item('/agency/clients', 'Klanten', 'klanten', Permission.VIEW_AGENCY_DASHBOARD,
          { match: (pad) => pad.startsWith('/agency/clients') }),
        item('/agency/team', 'Team', 'team', Permission.MANAGE_TEAM,
          { match: (pad) => pad.startsWith('/agency/team') }),
      ],
    },
    {
      id: 'performance',
      titel: 'Performance',
      items: [
        item('/agency/channels', 'Kanalen', 'kanalen', Permission.VIEW_AGENCY_DASHBOARD,
          { match: (pad) => pad.startsWith('/agency/channels') }),
        item('/agency/campaigns', 'Campagnes', 'campagnes', Permission.VIEW_AGENCY_DASHBOARD),
        item('/agency/budgets', 'Budgetten', 'budget', Permission.VIEW_AGENCY_DASHBOARD),
        item('/agency/conversions', 'Conversies', 'conversies', Permission.VIEW_AGENCY_DASHBOARD),
      ],
    },
    {
      id: 'werk',
      titel: 'Werk',
      items: [
        item('/agency/actions', 'Acties', 'acties', Permission.VIEW_AGENCY_ACTIONS),
        item('/agency/planning', 'Planning', 'planning', Permission.VIEW_AGENCY_PLANNING),
        item('/agency/signals', 'Signalen', 'signalen', Permission.VIEW_AGENCY_SIGNALS),
      ],
    },
    {
      id: 'analyse',
      titel: 'Analyse',
      items: [
        item('/agency/insights', 'Inzichten', 'inzichten', Permission.VIEW_AGENCY_DASHBOARD),
        item('/agency/reports', 'Rapportages', 'rapportages', Permission.VIEW_AGENCY_DASHBOARD),
        item('/agency/dataquality', 'Datakwaliteit', 'datakwaliteit', Permission.VIEW_AGENCY_DASHBOARD),
      ],
    },
    {
      id: 'systeem',
      titel: 'Systeem',
      items: [
        item('/agency/integrations', 'Integraties', 'integraties', Permission.VIEW_AGENCY_SETTINGS),
        item('/agency/settings', 'Instellingen', 'instellingen', Permission.VIEW_AGENCY_SETTINGS),
      ],
    },
  ];
}

/**
 * De medewerker begint bij zijn eigen dag.
 *
 * De groep Mijn werk staat bovenaan met vier ingangen die alle vier een tab van
 * dezelfde pagina zijn. Dat is bewust: het zijn vier vragen die een medewerker
 * 's ochtends stelt, en ze verdienen elk een eigen ingang in de navigatie ook
 * al delen ze een pagina.
 */
function medewerkerNavigatie() {
  return [
    {
      id: 'mijn-werk',
      titel: 'Mijn werk',
      items: [
        item('/agency/work?tab=vandaag', 'Vandaag', 'vandaag', Permission.VIEW_AGENCY_DASHBOARD,
          { match: (pad, tab) => pad === '/agency/work' && (!tab || tab === 'vandaag') }),
        item('/agency/work?tab=acties', 'Mijn acties', 'acties', Permission.VIEW_AGENCY_ACTIONS,
          { match: (pad, tab) => pad === '/agency/work' && tab === 'acties' }),
        item('/agency/work?tab=planning', 'Mijn planning', 'planning', Permission.VIEW_AGENCY_PLANNING,
          { match: (pad, tab) => pad === '/agency/work' && tab === 'planning' }),
        item('/agency/work?tab=signalen', 'Mijn signalen', 'signalen', Permission.VIEW_AGENCY_SIGNALS,
          { match: (pad, tab) => pad === '/agency/work' && tab === 'signalen' }),
      ],
    },
    {
      id: 'klanten',
      titel: 'Klanten',
      items: [
        item('/agency/clients?focus=mijn', 'Mijn klanten', 'klanten', Permission.VIEW_AGENCY_DASHBOARD,
          { match: (pad, tab, params) => pad.startsWith('/agency/clients') && params.focus !== 'alle' }),
        item('/agency/clients?focus=alle', 'Alle toegankelijke klanten', 'overzicht', Permission.VIEW_AGENCY_DASHBOARD,
          { match: (pad, tab, params) => pad.startsWith('/agency/clients') && params.focus === 'alle' }),
      ],
    },
    {
      id: 'performance',
      titel: 'Performance',
      items: [
        item('/agency/channels', 'Kanalen', 'kanalen', Permission.VIEW_AGENCY_DASHBOARD,
          { match: (pad) => pad.startsWith('/agency/channels') }),
        item('/agency/campaigns', 'Campagnes', 'campagnes', Permission.VIEW_AGENCY_DASHBOARD),
        item('/agency/budgets', 'Budgetten', 'budget', Permission.VIEW_AGENCY_DASHBOARD),
        item('/agency/conversions', 'Conversies', 'conversies', Permission.VIEW_AGENCY_DASHBOARD),
      ],
    },
    {
      id: 'analyse',
      titel: 'Analyse',
      items: [
        item('/agency/insights', 'Inzichten', 'inzichten', Permission.VIEW_AGENCY_DASHBOARD),
        item('/agency/reports', 'Rapportages', 'rapportages', Permission.VIEW_AGENCY_DASHBOARD),
        item('/agency/dataquality', 'Datakwaliteit', 'datakwaliteit', Permission.VIEW_AGENCY_DASHBOARD),
      ],
    },
  ];
}

/* ---------------------------------------------------------------
   Klantomgeving
   --------------------------------------------------------------- */

/**
 * Analysetabs per dashboardtype.
 *
 * Een leadgeneratieklant heeft niets aan een winkelwagenfunnel en een webshop
 * niets aan leadkwaliteit. De tabs volgen daarom het dashboardtype en niet een
 * vaste lijst.
 */
export const ANALYSE_TABS = {
  leadgen: [
    { key: 'leads', label: 'Leads' },
    { key: 'funnel', label: 'Funnel' },
    { key: 'kosten', label: 'Kosten per lead' },
    { key: 'kwaliteit', label: 'Leadkwaliteit' },
    { key: 'campagnes', label: 'Campagnes' },
    { key: 'zoektermen', label: 'Zoektermen' },
  ],
  ecommerce: [
    { key: 'omzet', label: 'Omzet' },
    { key: 'transacties', label: 'Transacties' },
    { key: 'rendement', label: 'Rendement' },
    { key: 'producten', label: 'Producten' },
    { key: 'campagnes', label: 'Campagnes' },
    { key: 'winkelwagen', label: 'Winkelwagenfunnel' },
  ],
  awareness: [
    { key: 'bereik', label: 'Bereik' },
    { key: 'frequentie', label: 'Frequentie' },
    { key: 'video', label: 'Videoprestaties' },
    { key: 'betrokkenheid', label: 'Betrokkenheid' },
    { key: 'campagnes', label: 'Campagnes' },
  ],
};

/**
 * Navigatie binnen een klantomgeving.
 *
 * @param {object} user
 * @param {{kanalen: string[], model: string}} context de kanalen die deze klant
 *        werkelijk heeft en het dashboardtype. Kanalen zonder koppeling komen
 *        niet in de navigatie: een lege kanaalpagina is geen informatie.
 */
function klantNavigatie(user, { kanalen = [], model = 'leadgen' } = {}) {
  const kanaalItems = kanalen.map((key) => item(
    `/client/channels/${key}`,
    KANAALNAMEN[key] ?? key,
    'kanalen',
    Permission.VIEW_CLIENT_CHANNELS,
    { match: (pad) => pad === `/client/channels/${key}` }
  ));

  return [
    {
      id: 'overzicht',
      titel: 'Overzicht',
      items: [
        item('/client/overview?tab=samenvatting', 'Samenvatting', 'overzicht', Permission.VIEW_CLIENT_DASHBOARD,
          { match: (pad, tab) => pad === '/client/overview' && (!tab || tab === 'samenvatting') }),
        item('/client/overview?tab=doelstellingen', 'Doelstellingen', 'resultaten', Permission.VIEW_CLIENT_DASHBOARD,
          { match: (pad, tab) => pad === '/client/overview' && tab === 'doelstellingen' }),
        item('/client/overview?tab=ontwikkelingen', 'Belangrijkste ontwikkelingen', 'inzichten', Permission.VIEW_CLIENT_DASHBOARD,
          { match: (pad, tab) => pad === '/client/overview' && tab === 'ontwikkelingen' }),
      ],
    },
    {
      id: 'resultaten',
      titel: 'Resultaten',
      items: [
        item('/client/channels', 'Alle kanalen', 'kanalen', Permission.VIEW_CLIENT_CHANNELS,
          { match: (pad) => pad === '/client/channels' }),
        ...kanaalItems,
      ],
    },
    {
      id: 'analyse',
      titel: 'Analyse',
      items: (ANALYSE_TABS[model] ?? []).map((t) => item(
        `/client/analysis?tab=${t.key}`,
        t.label,
        'inzichten',
        Permission.VIEW_CLIENT_DASHBOARD,
        { match: (pad, tab) => pad === '/client/analysis' && (tab ?? (ANALYSE_TABS[model] ?? [])[0]?.key) === t.key }
      )),
    },
    {
      id: 'samenwerking',
      titel: 'Samenwerking',
      items: [
        item('/client/collaboration?tab=acties', 'Acties', 'acties', Permission.VIEW_CLIENT_COLLABORATION,
          { match: (pad, tab) => pad === '/client/collaboration' && (!tab || tab === 'acties') }),
        item('/client/collaboration?tab=planning', 'Planning', 'planning', Permission.VIEW_CLIENT_COLLABORATION,
          { match: (pad, tab) => pad === '/client/collaboration' && tab === 'planning' }),
        item('/client/collaboration?tab=notities', 'Notities', 'samenwerking', Permission.VIEW_CLIENT_COLLABORATION,
          { match: (pad, tab) => pad === '/client/collaboration' && tab === 'notities' }),
        item('/client/collaboration?tab=bestanden', 'Bestanden', 'rapportages', Permission.VIEW_CLIENT_COLLABORATION,
          { match: (pad, tab) => pad === '/client/collaboration' && tab === 'bestanden' }),
      ],
    },
    {
      id: 'rapportage',
      titel: 'Rapportage',
      items: [
        item('/client/report?tab=inzichten', 'Inzichten', 'inzichten', Permission.VIEW_CLIENT_REPORT,
          { match: (pad, tab) => pad === '/client/report' && (!tab || tab === 'inzichten') }),
        item('/client/report?tab=rapportages', 'Rapportages', 'rapportages', Permission.VIEW_CLIENT_REPORT,
          { match: (pad, tab) => pad === '/client/report' && tab === 'rapportages' }),
        item('/client/report?tab=datakwaliteit', 'Datakwaliteit', 'datakwaliteit', Permission.VIEW_CLIENT_DATAQUALITY,
          { match: (pad, tab) => pad === '/client/report' && tab === 'datakwaliteit' }),
        item('/client/users', 'Gebruikers', 'team', Permission.MANAGE_CLIENT_USERS),
      ],
    },
  ];
}

/** De namen van de kanaalpagina's, los van het kanaalregister zelf. */
const KANAALNAMEN = {
  google_ads: 'Google Ads',
  meta_ads: 'Meta Ads',
  microsoft_ads: 'Microsoft Ads',
  linkedin_ads: 'LinkedIn Ads',
  ga4: 'Google Analytics 4',
};

/* ---------------------------------------------------------------
   Samenstellen
   --------------------------------------------------------------- */

/**
 * De navigatie voor deze gebruiker in deze omgeving.
 *
 * @param {object} user
 * @param {{omgeving: 'agency'|'client', klantContext?: object}} opties
 * @returns {{id: string, titel: string, items: object[]}[]}
 */
export function navigatieVoor(user, { omgeving, klantContext = null } = {}) {
  if (!user) return [];

  const groepen = omgeving === 'client'
    ? klantNavigatie(user, klantContext ?? {})
    : primaireRol(user) === Rol.AGENCY_ADMIN
      ? beheerderNavigatie()
      : medewerkerNavigatie();

  return groepen
    .map((groep) => ({ ...groep, items: groep.items.filter((i) => can(user, i.permission)) }))
    .filter((groep) => groep.items.length > 0);
}

/**
 * Bepaalt welk navigatie-item actief is.
 * Er is er hoogstens één: twee opgelichte items in dezelfde navigatie maken de
 * plaats van de gebruiker onduidelijk in plaats van duidelijker.
 */
export function actiefItem(groepen, pad, tab, params = {}) {
  for (const groep of groepen) {
    for (const i of groep.items) {
      const past = i.match ? i.match(pad, tab, params) : i.pad === pad;
      if (past) return i;
    }
  }
  return null;
}

/** De startpagina die bij een rol hoort. */
export function startPaginaVoor(user) {
  if (!user) return '#/login';
  const rol = primaireRol(user);
  if (rol === Rol.AGENCY_ADMIN) return '#/agency/portfolio';
  if (rol === Rol.AGENCY_EMPLOYEE) return '#/agency/work';
  return '#/client/overview';
}

export { KANAALNAMEN };
