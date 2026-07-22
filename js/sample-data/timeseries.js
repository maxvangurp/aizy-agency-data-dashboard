/**
 * Dagelijkse demodata per klant en per kanaal.
 *
 * WAAROM DAGNIVEAU
 * Een periodefilter kan niet werken op maandtotalen. Zolang de dataset alleen
 * geaggregeerde periodes bevat, is elke filterknop cosmetisch. Daarom is dit
 * bestand de enige bron van waarheid voor alles wat op een periode of een
 * kanaal reageert: KPI's, funnels, grafieken, verhalen en agencytotalen.
 *
 * KALIBRATIE
 * De reeksen zijn zo geschaald dat de standaardperiode, de afgelopen 30 dagen,
 * exact overeenkomt met de kerncijfers uit de vorige fase, en de direct
 * voorafgaande 30 dagen exact met de toen vastgelegde vorige periode. Daardoor
 * blijven de cijfers die eerder in het dashboard stonden kloppen, en zijn
 * afgeleide waarden als CPL, CPQL, ROAS en CPA nu berekend in plaats van
 * ingetypt. Buiten die twee vensters loopt de reeks door op de trend die uit
 * beide vensters volgt.
 *
 * DETERMINISME
 * Er wordt nergens Math.random of de echte klok gebruikt. Alle variatie komt
 * uit een hash van klant, kanaal, metriek en datum. Dezelfde vraag levert
 * daarom altijd hetzelfde antwoord, ook in tests.
 *
 * ONTBREKENDE METINGEN
 * Een metriek die niet gemeten wordt, is null en niet nul. Havenkwartier heeft
 * geen CRM-koppeling, dus gekwalificeerde leads, offertes, klanten en
 * pipelinewaarde zijn daar null. Kaap Noord heeft Microsoft Ads pas sinds
 * 24 mei 2026; vóór die datum bestaan er voor dat kanaal geen rijen, wat iets
 * anders is dan rijen met nullen.
 */

import { DEMO_TODAY, plusDagen, datumReeks, naarDatum, aantalDagen, isVoor } from '../filters/period.js';

/** Aantal dagen historie. Genoeg voor 120 dagen plus dezelfde periode vorig jaar. */
const HISTORIE_DAGEN = 500;

export const REEKS_START = plusDagen(DEMO_TODAY, -(HISTORIE_DAGEN - 1));
export const REEKS_EIND = DEMO_TODAY;

/** Het venster waarop de huidige kerncijfers zijn gekalibreerd. */
const VENSTER_HUIDIG = { start: plusDagen(DEMO_TODAY, -29), eind: DEMO_TODAY };
/** Het direct voorafgaande venster, waarop de vorige periode is gekalibreerd. */
const VENSTER_VORIG = { start: plusDagen(DEMO_TODAY, -59), eind: plusDagen(DEMO_TODAY, -30) };

/* ---------------------------------------------------------------
   Deterministische variatie
   --------------------------------------------------------------- */

function hash32(tekst) {
  let h = 2166136261;
  for (let i = 0; i < tekst.length; i++) {
    h = Math.imul(h ^ tekst.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

/** Ruisfactor tussen 0,88 en 1,12. Altijd dezelfde waarde voor dezelfde sleutel. */
function ruis(sleutel) {
  return 0.88 + ((hash32(sleutel) % 1000) / 1000) * 0.24;
}

/**
 * Verdeelt een geheel getal over gewichten zonder afrondingsverlies.
 * De som van het resultaat is exact het opgegeven totaal.
 */
function verdeel(totaal, gewichten) {
  const n = gewichten.length;
  if (!n) return [];
  const som = gewichten.reduce((a, b) => a + b, 0);
  if (som <= 0 || totaal === 0) return new Array(n).fill(0);

  const exact = gewichten.map((w) => (totaal * w) / som);
  const basis = exact.map((v) => Math.floor(v));
  let rest = totaal - basis.reduce((a, b) => a + b, 0);

  const volgorde = exact
    .map((v, i) => ({ i, fractie: v - Math.floor(v) }))
    .sort((a, b) => b.fractie - a.fractie || a.i - b.i);

  for (let k = 0; rest > 0 && k < volgorde.length * 2; k++) {
    basis[volgorde[k % volgorde.length].i] += 1;
    rest -= 1;
  }
  return basis;
}

/* ---------------------------------------------------------------
   Klantconfiguratie
   --------------------------------------------------------------- */

/**
 * Weekpatronen, index 0 is zondag.
 * Een fysiotherapiepraktijk en een adviesbureau piekt doordeweeks, een makelaar
 * en een webshop juist in het weekend. Zonder dat verschil zou een filter op
 * zeven dagen bij iedere klant hetzelfde beeld geven.
 */
const WEEKPATROON = {
  werkweek: [0.55, 1.25, 1.28, 1.22, 1.18, 1.12, 0.6],
  weekend: [1.22, 0.92, 0.9, 0.92, 0.96, 1.06, 1.22],
  vlak: [0.95, 1.04, 1.05, 1.03, 1.02, 1.0, 0.91],
};

/**
 * Per klant: kanaalverdeling en de twee gekalibreerde vensters.
 *
 * De kanaalaandelen zijn per dimensie apart opgegeven. Google Ads levert bij
 * de meeste klanten relatief meer resultaat per euro dan de sociale kanalen;
 * één gedeeld aandeel zou dat verschil wegpoetsen.
 */
const CLIENT_CONFIG = {
  vitaalpunt: {
    model: 'leadgen',
    weekpatroon: WEEKPATROON.werkweek,
    kanalen: [
      { key: 'google_ads', spend: 0.62, volume: 0.58, uitkomst: 0.64 },
      { key: 'meta_ads', spend: 0.28, volume: 0.34, uitkomst: 0.28 },
      { key: 'microsoft_ads', spend: 0.1, volume: 0.08, uitkomst: 0.08 },
    ],
    huidig: {
      spend: 11820, impressions: 84200, clicks: 2140, sessions: 4120, users: 3184,
      newUsers: 2610, engagedSessions: 2489, sessionSeconds: 609760,
      landingPageViews: 1892, engagement: 1148, formStarts: 214, qualifiedLeads: 71,
      appointments: 34, quotes: 28, customers: 19, pipelineValue: 61200, revenue: null,
    },
    vorig: {
      spend: 11215, impressions: 81600, clicks: 2112, sessions: 4386, users: 3402,
      newUsers: 2814, engagedSessions: 2724, sessionSeconds: 666672,
      landingPageViews: 1904, engagement: 1212, formStarts: 236, qualifiedLeads: 84,
      appointments: 39, quotes: 33, customers: 22, pipelineValue: 70400, revenue: null,
    },
    conversiesHuidig: {
      contactformulier: 42, afspraakGepland: 34, adviesaanvraag: 21, spoedaanvraag: 12,
      telefoonklik: 86, emailklik: 41, formulierGestart: 214, nieuwsbrief: 18, routeaanvraag: 29,
    },
    conversiesVorig: {
      contactformulier: 51, afspraakGepland: 39, adviesaanvraag: 24, spoedaanvraag: 9,
      telefoonklik: 74, emailklik: 38, formulierGestart: 236, nieuwsbrief: 15, routeaanvraag: 31,
    },
  },

  meridiaan: {
    model: 'leadgen',
    weekpatroon: WEEKPATROON.werkweek,
    kanalen: [
      { key: 'google_ads', spend: 0.62, volume: 0.66, uitkomst: 0.6 },
      { key: 'linkedin_ads', spend: 0.38, volume: 0.34, uitkomst: 0.4 },
    ],
    huidig: {
      spend: 18800, impressions: 142600, clicks: 3820, sessions: 9140, users: 6842,
      newUsers: 5218, engagedSessions: 6398, sessionSeconds: 2412960,
      landingPageViews: 3418, engagement: 2394, formStarts: 184, qualifiedLeads: 52,
      appointments: 38, quotes: 38, customers: 11, pipelineValue: 418000, revenue: null,
    },
    vorig: {
      spend: 17300, impressions: 128400, clicks: 3410, sessions: 8340, users: 6210,
      newUsers: 4820, engagedSessions: 5688, sessionSeconds: 2235120,
      landingPageViews: 3062, engagement: 2088, formStarts: 156, qualifiedLeads: 41,
      appointments: 31, quotes: 31, customers: 8, pipelineValue: 342000, revenue: null,
    },
    conversiesHuidig: {
      offerteaanvraag: 38, adviesaanvraag: 24, demoAanvraag: 19,
      brochureDownload: 142, emailklik: 68, telefoonklik: 34, nieuwsbrief: 86, formulierGestart: 184,
    },
    conversiesVorig: {
      offerteaanvraag: 31, adviesaanvraag: 22, demoAanvraag: 14,
      brochureDownload: 118, emailklik: 61, telefoonklik: 29, nieuwsbrief: 72, formulierGestart: 156,
    },
  },

  havenkwartier: {
    model: 'leadgen',
    weekpatroon: WEEKPATROON.weekend,
    kanalen: [
      { key: 'google_ads', spend: 0.58, volume: 0.55, uitkomst: 0.56 },
      { key: 'meta_ads', spend: 0.42, volume: 0.45, uitkomst: 0.44 },
    ],
    huidig: {
      spend: 9400, impressions: 218400, clicks: 5240, sessions: 13840, users: 9420,
      newUsers: 7284, engagedSessions: 8442, sessionSeconds: 2712640,
      landingPageViews: 4816, engagement: 2938, formStarts: 412, qualifiedLeads: null,
      appointments: 42, quotes: null, customers: null, pipelineValue: null, revenue: null,
    },
    vorig: {
      spend: 9088, impressions: 196800, clicks: 4820, sessions: 12480, users: 8640,
      newUsers: 6712, engagedSessions: 7413, sessionSeconds: 2483520,
      landingPageViews: 4412, engagement: 2618, formStarts: 368, qualifiedLeads: null,
      appointments: 36, quotes: null, customers: null, pipelineValue: null, revenue: null,
    },
    conversiesHuidig: {
      waardebepaling: 64, bezichtiging: 148, contactformulier: 38, afspraakGepland: 42,
      telefoonklik: 284, whatsappKlik: 118, routeaanvraag: 86, emailklik: 52, formulierGestart: 412,
    },
    conversiesVorig: {
      waardebepaling: 52, bezichtiging: 132, contactformulier: 41, afspraakGepland: 36,
      telefoonklik: 246, whatsappKlik: 94, routeaanvraag: 78, emailklik: 48, formulierGestart: 368,
    },
  },

  tafelwerk: {
    model: 'ecommerce',
    weekpatroon: WEEKPATROON.vlak,
    kanalen: [
      { key: 'google_ads', spend: 0.61, volume: 0.56, uitkomst: 0.62 },
      { key: 'meta_ads', spend: 0.3, volume: 0.36, uitkomst: 0.28 },
      { key: 'microsoft_ads', spend: 0.09, volume: 0.08, uitkomst: 0.1 },
    ],
    huidig: {
      spend: 18450, impressions: 236000, clicks: 7100, sessions: 16420, users: 12141,
      productViews: 33956, addToCarts: 3135, checkouts: 1058, purchases: 412, revenue: 147600,
    },
    vorig: {
      spend: 16804, impressions: 212000, clicks: 6400, sessions: 14900, users: 11020,
      productViews: 29740, addToCarts: 2810, checkouts: 921, purchases: 349, revenue: 125100,
    },
  },

  draadloos: {
    model: 'ecommerce',
    weekpatroon: WEEKPATROON.weekend,
    kanalen: [
      { key: 'google_ads', spend: 0.52, volume: 0.4, uitkomst: 0.48 },
      { key: 'meta_ads', spend: 0.48, volume: 0.6, uitkomst: 0.52 },
    ],
    huidig: {
      spend: 9840, impressions: 402000, clicks: 9800, sessions: 38210, users: 28470,
      productViews: 88420, addToCarts: 7240, checkouts: 2140, purchases: 604, revenue: 51340,
    },
    vorig: {
      spend: 8900, impressions: 372000, clicks: 9200, sessions: 36400, users: 27100,
      productViews: 79200, addToCarts: 7010, checkouts: 2280, purchases: 688, revenue: 58480,
    },
  },

  kaapnoord: {
    model: 'ecommerce',
    weekpatroon: WEEKPATROON.vlak,
    kanalen: [
      { key: 'google_ads', spend: 0.58, volume: 0.55, uitkomst: 0.6 },
      { key: 'meta_ads', spend: 0.3, volume: 0.34, uitkomst: 0.3 },
      // Microsoft Ads draait pas sinds eind mei. Vóór die datum bestaan er geen
      // rijen, zodat een periode die verder terugkijkt eerlijk meldt dat de
      // dekking onvolledig is.
      { key: 'microsoft_ads', spend: 0.12, volume: 0.11, uitkomst: 0.1, vanaf: '2026-05-24' },
    ],
    huidig: {
      spend: 24180, impressions: 682400, clicks: 18420, sessions: 64180, users: 46820,
      productViews: 142600, addToCarts: 12840, checkouts: 4180, purchases: 1284, revenue: 218280,
    },
    vorig: {
      spend: 22201, impressions: 638400, clicks: 17210, sessions: 59800, users: 43600,
      productViews: 128400, addToCarts: 11210, checkouts: 3620, purchases: 1082, revenue: 196400,
    },
  },

  noordlicht: {
    model: 'awareness',
    weekpatroon: WEEKPATROON.werkweek,
    kanalen: [
      { key: 'linkedin_ads', spend: 0.52, volume: 0.4, uitkomst: 0.5 },
      { key: 'meta_ads', spend: 0.3, volume: 0.42, uitkomst: 0.3 },
      { key: 'google_ads', spend: 0.18, volume: 0.18, uitkomst: 0.2 },
    ],
    // Awarenessscenario: het bereik loopt terug terwijl de frequentie oploopt,
    // de CPM stijgt en de videovoltooiing daalt. Dat is de combinatie waaruit
    // afnemende creatieve werking kán blijken; het dashboard benoemt het als
    // combinatie en niet als vaststaand feit.
    huidig: {
      spend: 22140, impressions: 1284700, clicks: 14200, reach: 486300, sessions: 9840,
      videoStarts: 92400, videoCompletions: 34600, videoWatchSeconds: 1108800,
      engagements: 39800, brandedSearchClicks: 4820, revenue: null,
    },
    vorig: {
      spend: 19800, impressions: 1180200, clicks: 13100, reach: 512800, sessions: 9420,
      videoStarts: 88600, videoCompletions: 37200, videoWatchSeconds: 1152000,
      engagements: 41500, brandedSearchClicks: 4560, revenue: null,
    },
  },
};

/** Welke dimensie hoort bij welke metriek. */
const DIMENSIE = {
  spend: 'spend',
  impressions: 'volume',
  clicks: 'volume',
  sessions: 'volume',
  users: 'volume',
  newUsers: 'volume',
  engagedSessions: 'volume',
  sessionSeconds: 'volume',
  landingPageViews: 'volume',
  engagement: 'volume',
  formStarts: 'volume',
  productViews: 'volume',
  addToCarts: 'volume',
  checkouts: 'volume',
  reach: 'volume',
  videoStarts: 'volume',
  videoCompletions: 'volume',
  videoWatchSeconds: 'volume',
  engagements: 'volume',
  brandedSearchClicks: 'volume',
};

function dimensieVoor(metriek) {
  return DIMENSIE[metriek] ?? 'uitkomst';
}

/** De metrieken die per bedrijfsmodel in een rij staan. */
const METRIEKEN = {
  leadgen: [
    'spend', 'impressions', 'clicks', 'sessions', 'users', 'newUsers',
    'engagedSessions', 'sessionSeconds', 'landingPageViews', 'engagement',
    'formStarts', 'qualifiedLeads', 'appointments', 'quotes', 'customers',
    'pipelineValue', 'revenue',
  ],
  ecommerce: [
    'spend', 'impressions', 'clicks', 'sessions', 'users', 'productViews',
    'addToCarts', 'checkouts', 'purchases', 'revenue',
  ],
  awareness: [
    'spend', 'impressions', 'clicks', 'reach', 'sessions',
    'videoStarts', 'videoCompletions', 'videoWatchSeconds',
    'engagements', 'brandedSearchClicks', 'revenue',
  ],
};

/* ---------------------------------------------------------------
   Reeksgeneratie
   --------------------------------------------------------------- */

/**
 * Bouwt een dagreeks voor één metriek van één kanaal.
 *
 * Binnen de twee gekalibreerde vensters is de som exact gelijk aan het doel.
 * Daarbuiten loopt het niveau door op de trend die uit beide vensters volgt,
 * afgevlakt zodat een reeks over honderden dagen niet ontspoort.
 */
function bouwReeks({ datums, doelHuidig, doelVorig, weekpatroon, seed }) {
  if (doelHuidig == null && doelVorig == null) {
    return new Map(datums.map((d) => [d, null]));
  }

  const dagenHuidig = datums.filter((d) => inVenster(d, VENSTER_HUIDIG));
  const dagenVorig = datums.filter((d) => inVenster(d, VENSTER_VORIG));

  const perDagHuidig = dagenHuidig.length ? (doelHuidig ?? 0) / dagenHuidig.length : 0;
  const perDagVorig = dagenVorig.length ? (doelVorig ?? 0) / dagenVorig.length : perDagHuidig;

  // Trend per blok van dertig dagen, geklemd zodat de historie plausibel blijft.
  const ruwe = perDagHuidig > 0 ? perDagVorig / perDagHuidig : 1;
  const trendPerBlok = Math.min(1.14, Math.max(0.88, ruwe || 1));

  const gewicht = (datum) => {
    const dag = naarDatum(datum).getUTCDay();
    return weekpatroon[dag] * ruis(`${seed}|${datum}`);
  };

  const waarden = new Map();

  for (const datum of datums) {
    let niveau;
    if (inVenster(datum, VENSTER_HUIDIG)) niveau = perDagHuidig;
    else if (inVenster(datum, VENSTER_VORIG)) niveau = perDagVorig;
    else {
      // Ouder dan het vorige venster: de trend verder terug doortrekken.
      const blokken = aantalDagen(datum, VENSTER_VORIG.start) / 30;
      niveau = perDagVorig * Math.pow(trendPerBlok, blokken);
    }
    waarden.set(datum, niveau * gewicht(datum));
  }

  // Binnen de vensters exact op het doel uitkomen.
  kalibreer(waarden, dagenHuidig, doelHuidig);
  kalibreer(waarden, dagenVorig, doelVorig);

  for (const datum of datums) {
    if (inVenster(datum, VENSTER_HUIDIG) || inVenster(datum, VENSTER_VORIG)) continue;
    waarden.set(datum, Math.round(waarden.get(datum)));
  }

  return waarden;
}

function kalibreer(waarden, dagen, doel) {
  if (!dagen.length) return;
  const gewichten = dagen.map((d) => Math.max(waarden.get(d), 0.0001));
  const verdeeld = verdeel(Math.round(doel ?? 0), gewichten);
  dagen.forEach((d, i) => waarden.set(d, verdeeld[i]));
}

function inVenster(datum, venster) {
  return !isVoor(datum, venster.start) && !isVoor(venster.eind, datum);
}

/* ---------------------------------------------------------------
   Rijen samenstellen
   --------------------------------------------------------------- */

const cache = new Map();

/**
 * Alle dagrijen van één klant, gesorteerd op datum.
 * Wordt eenmalig opgebouwd en daarna hergebruikt.
 */
export function getClientRows(clientId) {
  if (cache.has(clientId)) return cache.get(clientId);

  const config = CLIENT_CONFIG[clientId];
  if (!config) {
    cache.set(clientId, []);
    return [];
  }

  const alleDatums = datumReeks(REEKS_START, REEKS_EIND);
  const metrieken = METRIEKEN[config.model];
  const conversieTypen = Object.keys(config.conversiesHuidig ?? {});
  const kanalen = config.kanalen;

  // Doelen per kanaal, zo verdeeld dat de som exact het klanttotaal blijft.
  const doelen = new Map();
  const zetDoel = (metriek, huidig, vorig, dimensie) => {
    const gewichten = kanalen.map((k) => k[dimensie]);
    const perKanaalHuidig = huidig == null ? null : verdeel(Math.round(huidig), gewichten);
    const perKanaalVorig = vorig == null ? null : verdeel(Math.round(vorig), gewichten);
    doelen.set(metriek, kanalen.map((k, i) => ({
      huidig: perKanaalHuidig ? perKanaalHuidig[i] : null,
      vorig: perKanaalVorig ? perKanaalVorig[i] : null,
    })));
  };

  for (const metriek of metrieken) {
    zetDoel(metriek, config.huidig[metriek], config.vorig[metriek], dimensieVoor(metriek));
  }
  for (const type of conversieTypen) {
    zetDoel(`conv:${type}`, config.conversiesHuidig[type], config.conversiesVorig[type], 'uitkomst');
  }

  const rijen = [];

  kanalen.forEach((kanaal, index) => {
    const datums = kanaal.vanaf
      ? alleDatums.filter((d) => !isVoor(d, kanaal.vanaf))
      : alleDatums;

    const reeksen = new Map();
    for (const [metriek, perKanaal] of doelen) {
      reeksen.set(metriek, bouwReeks({
        datums,
        doelHuidig: perKanaal[index].huidig,
        doelVorig: perKanaal[index].vorig,
        weekpatroon: config.weekpatroon,
        seed: `${clientId}|${kanaal.key}|${metriek}`,
      }));
    }

    for (const datum of datums) {
      const rij = { date: datum, clientId, channel: kanaal.key };
      for (const metriek of metrieken) {
        rij[metriek] = reeksen.get(metriek).get(datum);
      }
      if (conversieTypen.length) {
        const conversies = {};
        for (const type of conversieTypen) {
          conversies[type] = reeksen.get(`conv:${type}`).get(datum);
        }
        rij.conversies = conversies;
      }
      rijen.push(rij);
    }
  });

  rijen.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.channel.localeCompare(b.channel)));
  cache.set(clientId, rijen);
  return rijen;
}

/** De kanalen waarvoor deze klant daadwerkelijk data heeft. */
export function getClientKanalen(clientId) {
  return (CLIENT_CONFIG[clientId]?.kanalen ?? []).map((k) => ({ key: k.key, vanaf: k.vanaf ?? null }));
}

/** Het bedrijfsmodel zoals de tijdreeks het kent. */
export function getClientModel(clientId) {
  return CLIENT_CONFIG[clientId]?.model ?? null;
}

export function heeftTijdreeks(clientId) {
  return CLIENT_CONFIG[clientId] != null;
}
