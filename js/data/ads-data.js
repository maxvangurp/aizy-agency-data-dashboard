/**
 * Datalaag voor het simpele Meta/Google Ads-dashboard.
 *
 * Haalt de advertentiecijfers op via de data-provider-seam
 * (`fetchResource(url, sampleLoader)`): in demomodus draait de sample-loader,
 * in live modus wordt de API bevraagd. Het dashboard consumeert altijd dezelfde
 * contractvorm, dus een echte koppeling vervangt alléén de sample-loader — de
 * dashboard-code blijft gelijk. Zie docs/api-contract-ads.md voor het contract.
 */

import { fetchResource, DataStatus } from '../data-provider.js';
import { parseQuery } from '../router.js';
import { metaInsightsSample, googleCampagnesSample } from '../sample-data/ads-sample.js';
import { ga4Sample } from '../sample-data/ga4-sample.js';
import { berekenDelta } from './metrics.js';

function periodeQuery(filters) {
  const p = filters?.periode ?? {};
  const params = new URLSearchParams();
  if (p.startDate) params.set('since', p.startDate);
  if (p.endDate) params.set('until', p.endDate);
  return params.toString();
}

/**
 * Haalt de Meta- en Google Ads-platformblokken op voor één klant.
 * `dashboard` is het al berekende klantdashboard (uit `getClientDashboard`);
 * dat levert de basiscijfers waaruit de sample-loaders de contractvorm afleiden.
 */
export async function haalAdsPlatforms(dashboard, filters) {
  if (!dashboard) return null;
  const q = periodeQuery(filters);
  const clientId = encodeURIComponent(dashboard.client.id);

  const [meta, google, segmenten, databronnen, portefeuille, ga4] = await Promise.all([
    fetchResource(`/api/meta/insights?client=${clientId}&${q}`, () => metaInsightsSample(dashboard)),
    fetchResource(`/api/google-ads/campaigns?client=${clientId}&${q}`, () => googleCampagnesSample(dashboard)),
    // Doorsnedes hebben geen voorbeeldvariant: die staan al in `dashboard.profiel`.
    // Lukt het ophalen niet, dan blijft dit null en valt adSegmenten terug.
    fetchResource(`/api/segments?client=${clientId}&${q}`, () => null),
    // Welke bronnen er werkelijk data leveren. Geen voorbeeldvariant: in
    // demomodus houdt de koppelpagina zijn eigen gesimuleerde status.
    fetchResource(`/api/databronnen?client=${clientId}`, () => null),
    // De hele portefeuille, los van de gekozen klant. Dat is precies het punt:
    // de vraag "waar begin ik" gaat over alle klanten tegelijk.
    fetchResource(`/api/portfolio?${q}`, () => null),
    // De GA4-module. De voorbeeldvariant volgt het klanttype van de demoklant en
    // draagt `demodata: true`, zodat de pagina hem als demo labelt. Een
    // generieke variant zou juist verbergen waar deze module om draait.
    fetchResource(`/api/ga4?client=${clientId}&${ga4Query()}`, () => ga4Sample(dashboard)),
  ]);

  return {
    meta: meta.data ?? null,
    google: google.data ?? null,
    segmenten: segmenten.data ?? null,
    databronnen: databronnen.data ?? null,
    portefeuille: portefeuille.data ?? null,
    // Geen antwoord is zelf een toestand, geen reden om te blijven laden. Welke
    // toestand het is hangt ervan af waarom er niets kwam: in demomodus is er
    // bewust geen GA4-voorbeeld -- welke KPI's hier horen hangt af van het
    // klanttype, en dat verzinnen is precies de fout die deze module voorkomt.
    ga4: {
      data: ga4.data ?? ga4Toestand(ga4.status),
      status: ga4.status,
    },
    status: { meta: meta.status, google: google.status, ga4: ga4.status },
    demodata: meta.status === DataStatus.SAMPLE || google.status === DataStatus.SAMPLE,
  };
}

/**
 * De periodevraag van de GA4-module.
 *
 * Bewust niet het periodefilter van de advertentiepagina's. Dat kent
 * "Afgelopen 30 dagen" inclusief vandaag, terwijl GA4-rapporten per exacte
 * periode bewaard worden en op volledige dagen gaan. Eén dag verschil betekent
 * "nog geen cijfers voor deze periode" terwijl ze er wel zijn.
 *
 * Het venster staat in de hash (`#/pulse/website?venster=7`), zodat een keuze
 * deelbaar is en een herlading hem overleeft.
 */
function ga4Query() {
  const params = new URLSearchParams(parseQuery());
  const venster = Number(params.get('venster'));
  const vergelijking = params.get('ga4vergelijk');
  const uit = new URLSearchParams();
  uit.set('venster', [7, 28, 90].includes(venster) ? String(venster) : '28');
  if (vergelijking === 'vorigJaar') uit.set('vergelijking', 'vorigJaar');
  return uit.toString();
}

/** Wat de GA4-pagina moet tonen als er geen antwoord kwam. */
function ga4Toestand(status) {
  if (status === DataStatus.SAMPLE) {
    return {
      status: 'niet_ingericht',
      reden: 'demodata',
      melding: 'Dit dashboard draait op voorbeelddata. De GA4-module heeft daar bewust geen '
        + 'voorbeeldvariant van: welke cijfers hier horen hangt af van het klanttype, en die '
        + 'verzinnen zou tonen wat een klant zou kunnen meten in plaats van wat hij meet.',
    };
  }
  if (status === DataStatus.ERROR) {
    return {
      status: 'fout',
      message: 'De websitecijfers konden niet opgehaald worden. Eerder opgehaalde cijfers '
        + 'staan er niet, dus er wordt niets getoond in plaats van iets verouderds zonder label.',
    };
  }
  return {
    status: 'niet_ingericht',
    reden: 'geen_verbinding',
    melding: 'Er is nog geen GA4-koppeling voor deze klant ingericht.',
  };
}

/**
 * De afgeleide ratio's uit een set basiswaarden — de enige plek waar deze
 * formules staan, zodat CTR/CPC/CPM/ROAS/… nooit tussen de totalen, de
 * vorige-periode en de dagreeks uit elkaar kunnen lopen. Ontbrekende basis
 * (bijv. `revenue`/`reach` bij leadgen) levert `null`, nooit NaN.
 */
export function afgeleideRatios({ spend, impressions, clicks, results, revenue, reach } = {}) {
  return {
    ctr: impressions ? (clicks / impressions) * 100 : null,
    cpc: clicks ? spend / clicks : null,
    cpm: impressions ? (spend / impressions) * 1000 : null,
    costPerResult: results ? spend / results : null,
    // `results` mag null zijn sinds de API een KPI kan onderdrukken die op dit
    // account niets betekent. Zonder de expliciete null-check wordt
    // `null / clicks` in JavaScript gewoon 0, en dan staat er 0% conversie waar
    // "niet te berekenen" hoort te staan -- dezelfde valkuil die `roas`
    // hieronder al afving.
    conversieratio: (results != null && clicks) ? (results / clicks) * 100 : null,
    roas: (revenue != null && spend) ? revenue / spend : null,
    frequentie: reach ? impressions / reach : null,
  };
}

/** De basisvelden (rechtstreeks uit de reeks) vs. de afgeleide ratio's. */
const BASIS_VELDEN = new Set(['spend', 'impressions', 'clicks', 'results', 'revenue', 'reach']);
const RATIO_VELDEN = new Set(['ctr', 'cpc', 'cpm', 'costPerResult', 'conversieratio', 'roas', 'frequentie']);

/** Telt de platformtotalen op tot één gecombineerd totaal (Meta + Google). */
export function combineerTotalen(platforms) {
  const blokken = [platforms?.meta, platforms?.google].filter((b) => b?.aanwezig && b.totals);
  if (!blokken.length) return null;

  const som = (veld) => blokken.reduce((s, b) => s + (b.totals[veld] ?? 0), 0);
  // Optelling die null blijft wanneer géén enkel platform het veld levert
  // (bijv. omzet bij leadgen), zodat een afgeleide als ROAS niet op 0 uitkomt.
  const somOfNull = (veld) => {
    const aanwezig = blokken.filter((b) => b.totals[veld] != null);
    return aanwezig.length ? aanwezig.reduce((s, b) => s + b.totals[veld], 0) : null;
  };
  const spend = som('spend');
  const impressions = som('impressions');
  const clicks = som('clicks');
  // Resultaten mogen ontbreken en niet als nul binnenkomen. Een conversieteller
  // waar zachte conversies in zitten komt terug als null, en die op 0 laten
  // uitkomen zou eruitzien als "gemeten, en het waren er geen".
  const results = somOfNull('results');
  const revenue = somOfNull('revenue');
  const reach = somOfNull('reach');

  return {
    spend,
    impressions,
    clicks,
    results,
    revenue,
    reach,
    ...afgeleideRatios({ spend, impressions, clicks, results, revenue, reach }),
    resultLabel: blokken[0].resultLabel,
    betrouwbaarheid: gecombineerdeBetrouwbaarheid(blokken),
  };
}

/**
 * Het voorbehoud van de platformen samen.
 *
 * Zegt één platform dat zijn ROAS niets betekent, dan betekent de opgetelde
 * ROAS ook niets -- een som is nooit betrouwbaarder dan zijn slechtste term.
 * Vandaar de vereniging en niet de doorsnede.
 *
 * Null wanneer geen enkel platform een oordeel meestuurt: niet beoordeeld is
 * iets anders dan beoordeeld en goed bevonden.
 */
function gecombineerdeBetrouwbaarheid(blokken) {
  const oordelen = blokken.map((b) => b.betrouwbaarheid).filter(Boolean);
  if (!oordelen.length) return null;
  return {
    beoordeeld: true,
    onbetrouwbareKpis: [...new Set(oordelen.flatMap((o) => o.onbetrouwbareKpis ?? []))],
    oordelen,
  };
}

/** De metrieksleutel voor het resultaat en de kosten-per-resultaat, per klanttype. */
export function resultMetriek(model) {
  if (model === 'ecommerce') return 'purchases';
  if (model === 'awareness') return 'engagements';
  return 'leads';
}
function kostenMetriek(model) {
  if (model === 'ecommerce') return 'cpa';
  if (model === 'awareness') return 'cpc';
  return 'cpl';
}

/**
 * De vorige-periode-waarden op ad-schaal. De basiswaarden worden geschaald met
 * de account-brede periode-over-periode-verhouding (`vorigeTotalen`/`totalen`);
 * de ratio's (CTR, CPC, CPM, ROAS…) worden dáár weer uit afgeleid, zodat ze
 * intern consistent zijn. Zelfde methode als in `vergelijkingTabel`.
 */
export function adTotalenVorige(dashboard, ad) {
  const t = dashboard.totalen ?? {};
  const v = dashboard.vorigeTotalen ?? {};
  const rveld = resultMetriek(dashboard.model);
  const schaal = (waarde, accKey) => {
    const nu = t[accKey];
    const toen = v[accKey];
    return (waarde != null && nu != null && toen != null && nu !== 0) ? waarde * (toen / nu) : null;
  };
  const spend = schaal(ad.spend, 'spend');
  const impressions = schaal(ad.impressions, 'impressions');
  const clicks = schaal(ad.clicks, 'clicks');
  const results = schaal(ad.results, rveld);
  const revenue = schaal(ad.revenue, 'revenue');
  const reach = schaal(ad.reach, 'reach');
  return {
    spend, impressions, clicks, results, revenue, reach,
    ...afgeleideRatios({ spend, impressions, clicks, results, revenue, reach }),
  };
}

/**
 * Delta per metrieksleutel voor de gecombineerde ad-totalen, t.o.v. de vorige
 * periode. Hergebruikt `berekenDelta` (richting uit de metriek-catalogus), zodat
 * een view nooit zelf hoeft te weten of dalen goed nieuws is.
 */
export function adDeltas(dashboard, ad, { vergelijkingActief = true } = {}) {
  if (!ad) return {};
  const vorige = adTotalenVorige(dashboard, ad);
  const rveld = resultMetriek(dashboard.model);
  const kveld = kostenMetriek(dashboard.model);
  const paren = [
    ['spend', 'spend'], ['impressions', 'impressions'], ['clicks', 'clicks'],
    ['ctr', 'ctr'], ['cpc', 'cpc'], ['cpm', 'cpm'],
    ['results', rveld], ['costPerResult', kveld], ['conversieratio', 'conversieratio'],
    ['revenue', 'revenue'], ['roas', 'roas'], ['reach', 'reach'], ['frequentie', 'frequentie'],
  ];
  const uit = {};
  for (const [adKey, metriekKey] of paren) {
    uit[adKey] = berekenDelta(metriekKey, ad[adKey], vorige[adKey], { vergelijkingActief });
  }
  return uit;
}

/** De gecombineerde dagreeks (Meta + Google) per datumpunt. */
export function gecombineerdeReeks(platforms) {
  const meta = platforms?.meta?.series ?? [];
  const google = platforms?.google?.series ?? [];
  const basis = meta.length ? meta : google;
  return basis.map((p, i) => ({
    date: p.date,
    spend: (meta[i]?.spend ?? 0) + (google[i]?.spend ?? 0),
    impressions: (meta[i]?.impressions ?? 0) + (google[i]?.impressions ?? 0),
    clicks: (meta[i]?.clicks ?? 0) + (google[i]?.clicks ?? 0),
    results: (meta[i]?.results ?? 0) + (google[i]?.results ?? 0),
    revenue: (meta[i]?.revenue ?? 0) + (google[i]?.revenue ?? 0),
    reach: (meta[i]?.reach ?? 0) + (google[i]?.reach ?? 0),
  }));
}

/**
 * De dagreeks van één metriek, voor een sparkline. Basiswaarden komen direct uit
 * de reeks; ratio's worden per dag berekend. Werkt op zowel de gecombineerde
 * reeks als een platform-`series` (zelfde veldnamen).
 */
export function metriekReeks(reeks, key) {
  const isBasis = BASIS_VELDEN.has(key);
  if (!isBasis && !RATIO_VELDEN.has(key)) return [];
  // Basisvelden rechtstreeks; ratio's via de gedeelde formules (geen NaN, geen drift).
  return (reeks ?? []).map((p) => (isBasis ? p[key] : afgeleideRatios(p)[key]));
}

/**
 * True wanneer de reeks op dagniveau staat. Bij een lange periode (>45 dagen)
 * wordt de reeks verdicht tot meerdaagse blokken; dan is een weekdag- of
 * per-dag-uitsplitsing niet betrouwbaar (elk punt bundelt meerdere dagen).
 */
export function reeksIsDagelijks(reeks) {
  if (reeks.length < 2) return true;
  // In UTC (`Z`) parsen: lokale tijd maakt een dag rond de zomer-/wintertijdgrens
  // 23 of 25 uur, waardoor een échte dagreeks anders ten onrechte als verdicht telt.
  return (new Date(`${reeks[1].date}T00:00:00Z`) - new Date(`${reeks[0].date}T00:00:00Z`)) === 86400000;
}

/**
 * Groepeert de dagreeks op weekdag (ma–zo). Alleen zinvol op dagniveau: bij een
 * verdichte reeks (lange periode) levert de functie een lege lijst, zodat de
 * weekdag-visualisatie en -inzichten netjes wegvallen i.p.v. verkeerd te tellen.
 */
export function perWeekdag(platforms) {
  const namen = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];
  const volgorde = [1, 2, 3, 4, 5, 6, 0]; // maandag eerst
  const reeks = gecombineerdeReeks(platforms);
  if (!reeksIsDagelijks(reeks)) return [];
  const acc = new Map();
  for (const p of reeks) {
    const dag = new Date(`${p.date}T00:00:00Z`).getUTCDay();
    const rij = acc.get(dag) ?? { dag, dagen: 0, spend: 0, results: 0 };
    rij.dagen += 1; rij.spend += p.spend; rij.results += p.results;
    acc.set(dag, rij);
  }
  return volgorde
    .filter((d) => acc.has(d))
    .map((d) => {
      const r = acc.get(d);
      return {
        name: namen[d],
        spend: r.spend,
        results: r.results,
        dagen: r.dagen,
        gemPerDag: r.dagen ? r.spend / r.dagen : null,
        costPerResult: r.results ? r.spend / r.results : null,
      };
    });
}

/** Voegt een resultaat-aandeel (%) en kosten/resultaat toe aan segmentrijen. */
function metAandeel(rijen) {
  const totaal = rijen.reduce((s, r) => s + (r.results ?? 0), 0);
  return rijen.map((r) => ({
    ...r,
    aandeel: totaal ? (r.results / totaal) * 100 : null,
    costPerResult: (r.spend != null && r.results) ? r.spend / r.results : null,
  }));
}

/**
 * Segmentdata voor de Segmenten-pagina: apparaat, regio/land en weekdag.
 *
 * De bron verschilt per klanttype: e-commerce leest apparaat uit Google Ads
 * (mét kosten), leadgen uit de analytics-verdelingen (mét gebruikers). Regio en
 * land komen uit de analytics-verdelingen (aanwezig bij leadgen). De weekdag komt
 * uit de gecombineerde dagreeks. Ontbrekende segmenten leveren een lege lijst,
 * die de view netjes wegvalt.
 */
/**
 * Doorsnedes uit `/api/segments`, in de vorm die de Segmenten-pagina leest.
 *
 * Het platform blijft in de naam staan zodra een segmentnaam bij meer dan één
 * platform voorkomt. Google zegt "Mobiel", Meta zegt "Mobiele app" en "Mobiel
 * web"; alleen "Desktop" bestaat bij allebei, en twee regels Desktop zonder
 * uitleg leest als een fout.
 */
/**
 * Boven dit aantal segmenten wordt de staart samengevat.
 *
 * Regio heeft een lange staart: een Brabantse meubelzaak krijgt sessies uit
 * Abu Dhabi en Aksaray, telkens één of twee. Driehonderd regels van één sessie
 * verbergen de vijf die ertoe doen, en een donut met driehonderd punten is een
 * gekleurde ring. De staart verdwijnt niet maar wordt één regel, zodat het
 * totaal blijft kloppen.
 */
const MAX_SEGMENTEN = 8;

function vatStaartSamen(rijen, max = MAX_SEGMENTEN) {
  if (rijen.length <= max) return rijen;
  const gesorteerd = [...rijen].sort((a, b) => (b.results ?? 0) - (a.results ?? 0) || (b.spend ?? 0) - (a.spend ?? 0));
  const kop = gesorteerd.slice(0, max - 1);
  const staart = gesorteerd.slice(max - 1);

  return [...kop, staart.reduce((som, r) => ({
    ...som,
    spend: (som.spend ?? 0) + (r.spend ?? 0),
    clicks: (som.clicks ?? 0) + (r.clicks ?? 0),
    users: (som.users ?? 0) + (r.users ?? 0),
    results: (som.results ?? 0) + (r.results ?? 0),
  }), { name: `Overig (${staart.length})`, spend: 0, clicks: 0, users: 0, results: 0 })];
}

function liveSegmenten(platforms, dimensie) {
  const rijen = platforms?.segmenten?.dimensies?.[dimensie] ?? [];
  if (!rijen.length) return null;

  const perNaam = new Map();
  for (const r of rijen) perNaam.set(r.name, (perNaam.get(r.name) ?? 0) + 1);
  const label = (r) => (perNaam.get(r.name) > 1 ? `${r.name} (${r.platform.replace('-ads', '')})` : r.name);

  return metAandeel(vatStaartSamen(rijen.map((r) => ({
    name: label(r), spend: r.spend ?? null, clicks: r.clicks ?? null,
    users: r.users ?? null, results: r.results ?? 0,
  }))));
}

export function adSegmenten(dashboard, platforms) {
  const profiel = dashboard.profiel ?? {};
  const rlabel = platforms?.meta?.resultLabel ?? platforms?.google?.resultLabel ?? 'Resultaat';

  // Echte doorsnedes gaan voor; de voorbeelddata blijft de bron voor de
  // voorbeeldklant, die niet in Supabase staat.
  const live = liveSegmenten(platforms, 'device');
  const plaatsingen = liveSegmenten(platforms, 'placement');

  const devices = live ?? (dashboard.model === 'ecommerce'
    ? metAandeel((profiel.googleAds?.apparaten ?? []).map((a) => ({
        name: a.apparaat, spend: a.kosten ?? null, clicks: a.klikken ?? null, users: null, results: a.conversies ?? 0,
      })))
    : metAandeel((profiel.verdelingen?.apparaten ?? []).map((a) => ({
        name: a.apparaat, spend: null, clicks: null, users: a.gebruikers ?? null, results: a.leads ?? 0,
      }))));

  const regios = liveSegmenten(platforms, 'region')
    ?? metAandeel((profiel.verdelingen?.regios ?? []).map((r) => ({
      name: r.regio, spend: null, clicks: null, users: r.gebruikers ?? null, results: r.leads ?? 0,
    })));

  return { devices, regios, plaatsingen: plaatsingen ?? [], weekdagen: perWeekdag(platforms), rlabel };
}

/** Alle campagnes over beide platforms, gesorteerd op spend (voor de tabel). */
export function alleCampagnes(platforms) {
  const meta = (platforms?.meta?.campaigns ?? []).map((c) => ({ ...c, platform: 'Meta Ads' }));
  const google = (platforms?.google?.campaigns ?? []).map((c) => ({ ...c, platform: 'Google Ads' }));
  return [...meta, ...google].sort((a, b) => (b.spend ?? 0) - (a.spend ?? 0));
}
