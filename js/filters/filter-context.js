/**
 * De filtercontext: vorm, validatie en vertaling van en naar de URL.
 *
 * De filtercontext is één object dat beschrijft welke doorsnede van de data op
 * dit moment wordt getoond. Hij wordt nergens ter plekke aangepast: elke
 * wijziging levert een nieuw object op dat opnieuw wordt genormaliseerd. Dat
 * maakt het onmogelijk dat een half doorgevoerde wijziging blijft hangen.
 *
 * VORM
 *   {
 *     period:     { preset, startDate, endDate },
 *     comparison: { mode },
 *     channels:   ['google_ads', 'meta_ads'],
 *     conversionScope: 'primary' | 'secondary' | 'all'
 *   }
 *
 * De opgeloste datums van de periode en de vergelijking staan er niet in. Ze
 * worden afgeleid, want anders zouden twee waarheden naast elkaar bestaan: de
 * preset en de datums die er ooit bij hoorden.
 *
 * NORMALISATIE
 *   Normaliseren gebeurt altijd tegen de kanalen en conversietypen die in de
 *   huidige context zijn toegestaan. Een kanaal van een klant waar de gebruiker
 *   geen toegang toe heeft, verdwijnt daardoor uit de selectie voordat er ook
 *   maar iets mee wordt opgehaald.
 *
 * LEGE KANAALSELECTIE
 *   Nul kanalen levert geen leeg scherm op maar een terugval op alle
 *   beschikbare kanalen, met een zichtbare melding. Een dashboard dat niets
 *   toont omdat er per ongeluk niets is aangevinkt, is lastiger te begrijpen
 *   dan een dashboard dat vertelt dat het de selectie heeft hersteld.
 */

import {
  PERIODE_PRESET_KEYS, STANDAARD_PERIODE, VERGELIJK_KEYS, STANDAARD_VERGELIJKING,
  isDatum, resolvePeriode, resolveVergelijking, DEMO_TODAY,
} from './period.js';
import { sorteerKanalen, ADVERTENTIEKANAAL_KEYS, kanaalLabel } from './channels.js';

export const ConversieScope = {
  PRIMAIR: 'primary',
  SECUNDAIR: 'secondary',
  ALLE: 'all',
};

export const CONVERSIE_SCOPE_LABELS = {
  [ConversieScope.PRIMAIR]: 'Primaire conversies',
  [ConversieScope.SECUNDAIR]: 'Secundaire conversies',
  [ConversieScope.ALLE]: 'Alle conversies',
};

export const STANDAARD_CONVERSIE_SCOPE = ConversieScope.PRIMAIR;

/** De filtercontext zoals hij geldt zonder enige keuze van de gebruiker. */
export function standaardFilters(toegestaneKanalen = ADVERTENTIEKANAAL_KEYS) {
  return {
    period: { preset: STANDAARD_PERIODE, startDate: null, endDate: null },
    comparison: { mode: STANDAARD_VERGELIJKING },
    channels: sorteerKanalen(toegestaneKanalen),
    conversionScope: STANDAARD_CONVERSIE_SCOPE,
  };
}

/**
 * Normaliseert een ruwe filtercontext.
 *
 * @param {object|null} ruw
 * @param {{toegestaneKanalen: string[], conversieOpties?: string[], vandaag?: string}} context
 * @returns {{filters: object, correcties: string[]}}
 */
export function normaliseerFilters(ruw, {
  toegestaneKanalen = ADVERTENTIEKANAAL_KEYS,
  conversieOpties = Object.values(ConversieScope),
  vandaag = DEMO_TODAY,
} = {}) {
  const correcties = [];
  const toegestaan = sorteerKanalen(toegestaneKanalen);

  /* Periode */
  const ruwePreset = ruw?.period?.preset;
  const preset = PERIODE_PRESET_KEYS.has(ruwePreset) ? ruwePreset : STANDAARD_PERIODE;
  if (ruwePreset != null && preset !== ruwePreset) {
    correcties.push('De opgegeven periode bestaat niet en is teruggezet op de standaardwaarde.');
  }

  const periodeInvoer = {
    preset,
    startDate: isDatum(ruw?.period?.startDate) ? ruw.period.startDate : null,
    endDate: isDatum(ruw?.period?.endDate) ? ruw.period.endDate : null,
  };
  const opgelost = resolvePeriode(periodeInvoer, vandaag);
  if (opgelost.melding) correcties.push(opgelost.melding);

  /* Vergelijking */
  const ruweModus = ruw?.comparison?.mode;
  const mode = VERGELIJK_KEYS.has(ruweModus) ? ruweModus : STANDAARD_VERGELIJKING;
  if (ruweModus != null && mode !== ruweModus) {
    correcties.push('De opgegeven vergelijking bestaat niet en is teruggezet op de vorige periode.');
  }

  /* Kanalen */
  const gevraagd = Array.isArray(ruw?.channels) ? ruw.channels : null;
  let kanalen;

  if (gevraagd == null) {
    kanalen = toegestaan;
  } else {
    const geldig = sorteerKanalen(gevraagd).filter((k) => toegestaan.includes(k));
    const verwijderd = sorteerKanalen(gevraagd).filter((k) => !toegestaan.includes(k));

    if (verwijderd.length) {
      correcties.push(
        `${verwijderd.map(kanaalLabel).join(', ')} ${verwijderd.length === 1 ? 'is' : 'zijn'} niet beschikbaar in deze weergave en uit de selectie verwijderd.`
      );
    }
    if (!geldig.length) {
      kanalen = toegestaan;
      if (gevraagd.length) {
        correcties.push('Er bleven geen geldige kanalen over. Alle beschikbare kanalen worden getoond.');
      }
    } else {
      kanalen = geldig;
    }
  }

  /* Conversiescope */
  const ruweScope = ruw?.conversionScope;
  let scope = conversieOpties.includes(ruweScope) ? ruweScope : null;
  if (scope == null) {
    scope = conversieOpties.includes(STANDAARD_CONVERSIE_SCOPE)
      ? STANDAARD_CONVERSIE_SCOPE
      : conversieOpties[0] ?? STANDAARD_CONVERSIE_SCOPE;
    if (ruweScope != null && ruweScope !== scope) {
      correcties.push('Het gekozen conversietype bestaat niet voor deze klant en is teruggezet.');
    }
  }

  return {
    filters: {
      period: { preset: opgelost.preset, startDate: opgelost.startDate, endDate: opgelost.endDate },
      comparison: { mode },
      channels: kanalen,
      conversionScope: scope,
    },
    correcties,
  };
}

/**
 * Zet een genormaliseerde filtercontext om in het volledige, opgeloste beeld
 * dat selectors en views gebruiken.
 */
export function resolveFilters(filters, { vandaag = DEMO_TODAY } = {}) {
  const periode = resolvePeriode(filters.period, vandaag);
  const vergelijking = resolveVergelijking(periode, filters.comparison?.mode);
  return {
    ...filters,
    periode,
    vergelijking,
    vergelijkingActief: vergelijking.mode !== 'none',
  };
}

/** Twee filtercontexten zijn gelijk wanneer alle keuzes gelijk zijn. */
export function filtersGelijk(a, b) {
  if (!a || !b) return a === b;
  return (
    a.period?.preset === b.period?.preset &&
    a.period?.startDate === b.period?.startDate &&
    a.period?.endDate === b.period?.endDate &&
    a.comparison?.mode === b.comparison?.mode &&
    a.conversionScope === b.conversionScope &&
    (a.channels ?? []).join(',') === (b.channels ?? []).join(',')
  );
}

/* ---------------------------------------------------------------
   URL
   --------------------------------------------------------------- */

/**
 * Zet de filtercontext om in queryparameters.
 *
 * Standaardwaarden worden weggelaten. Een gebruiker die niets heeft gekozen
 * houdt daardoor een korte, deelbare URL, en de aanwezigheid van een parameter
 * betekent altijd een bewuste keuze.
 */
export function filtersNaarQuery(filters, { toegestaneKanalen = ADVERTENTIEKANAAL_KEYS } = {}) {
  const params = new URLSearchParams();
  const standaard = standaardFilters(toegestaneKanalen);

  if (filters.period?.preset && filters.period.preset !== standaard.period.preset) {
    params.set('period', filters.period.preset);
  }
  if (filters.period?.preset === 'custom') {
    if (filters.period.startDate) params.set('from', filters.period.startDate);
    if (filters.period.endDate) params.set('to', filters.period.endDate);
  }
  if (filters.comparison?.mode && filters.comparison.mode !== standaard.comparison.mode) {
    params.set('compare', filters.comparison.mode);
  }

  const gekozen = sorteerKanalen(filters.channels ?? []);
  const alle = sorteerKanalen(toegestaneKanalen);
  if (gekozen.length && gekozen.join(',') !== alle.join(',')) {
    params.set('channels', gekozen.join(','));
  }

  if (filters.conversionScope && filters.conversionScope !== standaard.conversionScope) {
    params.set('conv', filters.conversionScope);
  }

  return params.toString();
}

/** Leest een filtercontext uit queryparameters. Ontbrekende waarden blijven leeg. */
export function queryNaarFilters(query) {
  const params = new URLSearchParams(query ?? '');
  if ([...params.keys()].length === 0) return null;

  const ruw = {};

  if (params.has('period') || params.has('from') || params.has('to')) {
    ruw.period = {
      preset: params.get('period') ?? (params.has('from') || params.has('to') ? 'custom' : undefined),
      startDate: params.get('from'),
      endDate: params.get('to'),
    };
  }
  if (params.has('compare')) ruw.comparison = { mode: params.get('compare') };
  if (params.has('channels')) {
    ruw.channels = params.get('channels').split(',').map((s) => s.trim()).filter(Boolean);
  }
  if (params.has('conv')) ruw.conversionScope = params.get('conv');

  return Object.keys(ruw).length ? ruw : null;
}
