/**
 * Inzichtlaag.
 *
 * Een inzicht is geen herhaling van een KPI. "De CPL vraagt aandacht" vertelt
 * niet wat er veranderde, hoe groot het verschil is, waar het vandaan komt of
 * wat je eraan doet. Een inzicht uit deze laag beantwoordt die vragen wél, of
 * het bestaat niet.
 *
 * IEDER INZICHT DRAAGT
 *   titel        wat er veranderde, met het getal erin
 *   samenvatting de omvang en de waarschijnlijke herkomst
 *   bewijs       de cijfers waarop de uitspraak rust, zodat de lezer het na kan
 *                rekenen in plaats van te moeten geloven
 *   actie        een concrete vervolgstap die uit datzelfde bewijs volgt
 *   betrouwbaarheid  hoe zeker de conclusie is, en waarom
 *
 * OVER OORZAKEN
 * De data laat samenhang zien, geen oorzaak. Er staat daarom "hangt
 * waarschijnlijk samen met" waar de data een richting geeft, en "op basis van
 * de huidige data is geen oorzaak vast te stellen" waar die er niet is. Een
 * stellige oorzaak verschijnt alleen wanneer het bewijs die draagt, zoals bij
 * een ontleding die per definitie optelt tot het verschil.
 *
 * PRIORITERING
 * Per dashboard verschijnen maximaal één hoofdontwikkeling, één aandachtspunt
 * en één kans. Een grote procentuele verandering op weinig volume komt daardoor
 * niet boven een echte zakelijke afwijking te staan: volume en betrouwbaarheid
 * wegen mee in de score, en die score is uitlegbaar.
 */

import { InzichtCategorie, Betrouwbaarheid } from '../terminology.js';
import { veiligDelen, veiligPercentage, metriekMeta } from './metrics.js';
import {
  ontleedOmzetgroei, ontleedLeadgroei, DekkingStatus, PacingStatus,
} from './selectors.js';

const nf = new Intl.NumberFormat('nl-NL');
const cf0 = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const cf2 = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pf = (v) => `${Number(v).toFixed(1)} procent`;
const pf0 = (v) => `${Math.round(Number(v))} procent`;

/* ---------------------------------------------------------------
   Contracten per dashboardtype
   --------------------------------------------------------------- */

/**
 * Wat een dashboardtype minimaal moet beoordelen en wat het nooit mag beweren.
 * De regels staan hier zodat ze te lezen, te testen en te documenteren zijn.
 */
export const INZICHT_CONTRACTEN = {
  leadgen: {
    label: 'Leadgeneratie',
    verplicht: ['volume', 'efficientie', 'kwaliteit', 'funnel', 'kanaalbijdrage'],
    optioneel: ['budget', 'pipeline'],
    verboden: [
      'klantconversies als nul tonen wanneer CRM-data ontbreekt',
      'de doorklikratio als funnelknelpunt aanwijzen',
      'een oorzaak als feit presenteren zonder ondersteunende data',
    ],
  },
  ecommerce: {
    label: 'E-commerce',
    verplicht: ['omzet', 'rendement', 'groei-ontleding', 'conversiepad', 'kanaalbijdrage'],
    optioneel: ['productfeed', 'budget'],
    verboden: [
      'winstgevendheid claimen zonder kostprijsdata',
      'een margeprobleem claimen zonder margedata',
      'een voorraadprobleem claimen zonder voorraaddata',
      'attributie als causaliteit presenteren',
    ],
  },
  awareness: {
    label: 'Awareness',
    verplicht: ['bereik en levering', 'aandacht', 'verzadiging'],
    optioneel: ['ondersteunende resultaten', 'budget'],
    verboden: [
      'kosten per lead als primaire KPI gebruiken',
      'advertentievermoeidheid als feit presenteren op basis van alleen frequentie',
      'uniek periodebereik tonen dat niet gemeten wordt',
    ],
  },
};

/* ---------------------------------------------------------------
   Betrouwbaarheid
   --------------------------------------------------------------- */

/**
 * Bepaalt hoe zeker een uitspraak is en waarom.
 *
 * @param {{volume: number|null, minimum: number, vergelijkbaar: boolean,
 *          dekking: object|null, bronOntbreekt: string|null}} context
 */
export function bepaalBetrouwbaarheid({
  volume = null, minimum = 30, vergelijkbaar = true, dekking = null, bronOntbreekt = null,
}) {
  const redenen = [];

  if (volume == null) {
    return { niveau: Betrouwbaarheid.ONVOLDOENDE, redenen: ['Deze waarde wordt niet gemeten.'] };
  }
  if (!vergelijkbaar) {
    redenen.push('Er is geen vergelijkbare vorige periode.');
  }
  if (bronOntbreekt) {
    redenen.push(bronOntbreekt);
  }
  if (dekking?.status === DekkingStatus.GEEN_DATA) {
    return { niveau: Betrouwbaarheid.ONVOLDOENDE, redenen: ['Er is geen data binnen deze selectie.'] };
  }
  if (dekking?.ontbrekendeDagen > 0) {
    redenen.push(`Voor ${dekking.ontbrekendeDagen} van de ${dekking.totaalDagen} dagen ontbreekt data.`);
  }

  if (volume < minimum / 3) {
    redenen.unshift(`Er zijn in deze periode ${nf.format(Math.round(volume))} metingen. Een kleine verandering geeft dan al een groot percentage.`);
    return { niveau: Betrouwbaarheid.BEPERKT, redenen };
  }
  if (volume < minimum) {
    redenen.unshift(`Het volume van ${nf.format(Math.round(volume))} is beperkt voor een harde conclusie.`);
    return { niveau: Betrouwbaarheid.REDELIJK, redenen };
  }
  if (redenen.length) {
    return { niveau: Betrouwbaarheid.REDELIJK, redenen };
  }
  return { niveau: Betrouwbaarheid.HOOG, redenen: [] };
}

/* ---------------------------------------------------------------
   Bouwstenen
   --------------------------------------------------------------- */

let teller = 0;

function inzicht({
  categorie, titel, samenvatting, bewijs = [], herkomst = null, actie = null,
  betrouwbaarheid, impact = 0, volume = 0, metriek = null, kanalen = [],
}) {
  teller += 1;
  return {
    id: `inzicht-${teller}`,
    categorie,
    titel,
    samenvatting,
    bewijs,
    herkomst,
    actie,
    betrouwbaarheid: betrouwbaarheid?.niveau ?? Betrouwbaarheid.REDELIJK,
    betrouwbaarheidRedenen: betrouwbaarheid?.redenen ?? [],
    impact,
    volume,
    metriek,
    kanalen,
  };
}

/** Een bewijsregel: een cijfer met het label erbij. */
const bewijsregel = (label, waarde) => ({ label, waarde });

/**
 * Score voor de rangschikking.
 *
 * De score bestaat uit vier delen die elk apart uit te leggen zijn: de omvang
 * van de afwijking, het volume waarop die rust, de betrouwbaarheid en de vraag
 * of er een concrete actie bij hoort. Zo kan een verandering van 300 procent op
 * drie leads nooit boven een omzetdaling van 12 procent uitkomen.
 */
function score(i) {
  const betrouwbaarheidsfactor = {
    [Betrouwbaarheid.HOOG]: 1,
    [Betrouwbaarheid.REDELIJK]: 0.75,
    [Betrouwbaarheid.BEPERKT]: 0.4,
    [Betrouwbaarheid.ONVOLDOENDE]: 0.15,
  }[i.betrouwbaarheid] ?? 0.5;

  const volumefactor = Math.min(1, Math.log10(Math.max(i.volume, 1) + 1) / 3);
  const actiefactor = i.actie ? 1.1 : 1;
  return Math.abs(i.impact) * betrouwbaarheidsfactor * (0.35 + 0.65 * volumefactor) * actiefactor;
}

/** Kiest per categorie het sterkste inzicht en houdt de rest als aanvulling. */
export function rangschik(inzichten, { perCategorie = 1, maxAanvullend = 2 } = {}) {
  const gesorteerd = [...inzichten].sort((a, b) => score(b) - score(a));
  const gekozen = [];
  const geteld = {};

  for (const i of gesorteerd) {
    geteld[i.categorie] = geteld[i.categorie] ?? 0;
    if (geteld[i.categorie] < perCategorie) {
      geteld[i.categorie] += 1;
      gekozen.push(i);
    }
  }

  const primaireIds = new Set(gekozen.map((i) => i.id));
  const aanvullend = gesorteerd.filter((i) => !primaireIds.has(i.id)).slice(0, maxAanvullend);

  return {
    primair: gekozen.sort((a, b) => VOLGORDE.indexOf(a.categorie) - VOLGORDE.indexOf(b.categorie)),
    aanvullend,
  };
}

const VOLGORDE = [
  InzichtCategorie.ONTWIKKELING,
  InzichtCategorie.AANDACHTSPUNT,
  InzichtCategorie.KANS,
  InzichtCategorie.MEETBEPERKING,
];

/* ---------------------------------------------------------------
   Gedeelde inzichten
   --------------------------------------------------------------- */

function kanaalInzichten({ kanaalRijen, uitkomstVeld, uitkomstNaam, dekking, vergelijkbaar }) {
  const uit = [];
  const metUitkomst = (kanaalRijen ?? []).filter((k) => k[uitkomstVeld] != null && k[uitkomstVeld] > 0);
  if (metUitkomst.length < 2) return uit;

  const totaal = metUitkomst.reduce((t, k) => t + k[uitkomstVeld], 0);
  const opVolume = [...metUitkomst].sort((a, b) => b[uitkomstVeld] - a[uitkomstVeld]);
  const grootste = opVolume[0];

  const metKosten = metUitkomst.filter((k) => k.spend != null && k[uitkomstVeld] > 0);
  const opEfficientie = [...metKosten].sort(
    (a, b) => (a.spend / a[uitkomstVeld]) - (b.spend / b[uitkomstVeld])
  );
  const efficientste = opEfficientie[0];
  const duurste = opEfficientie[opEfficientie.length - 1];

  if (efficientste && duurste && efficientste.channel !== duurste.channel) {
    const kostenGoedkoop = efficientste.spend / efficientste[uitkomstVeld];
    const kostenDuur = duurste.spend / duurste[uitkomstVeld];
    const verschilPct = ((kostenDuur - kostenGoedkoop) / kostenGoedkoop) * 100;

    // Volume en efficiëntie spreken elkaar tegen wanneer het grootste kanaal
    // niet het efficiëntste is. Dat is precies waar een keuze te maken valt.
    const spanning = grootste.channel !== efficientste.channel;

    uit.push(inzicht({
      categorie: spanning ? InzichtCategorie.KANS : InzichtCategorie.ONTWIKKELING,
      titel: spanning
        ? `${grootste.label} levert het meeste volume, ${efficientste.label} is het efficiëntst`
        : `${efficientste.label} levert het meeste en het goedkoopste volume`,
      samenvatting: spanning
        ? `${grootste.label} was goed voor ${nf.format(Math.round(grootste[uitkomstVeld]))} van de ${nf.format(Math.round(totaal))} ${uitkomstNaam}, tegen ${cf2.format(kostenDuur === kostenGoedkoop ? kostenGoedkoop : grootste.spend / grootste[uitkomstVeld])} per stuk. ${efficientste.label} komt uit op ${cf2.format(kostenGoedkoop)}.`
        : `${efficientste.label} levert zowel het meeste volume als de laagste kosten per stuk, namelijk ${cf2.format(kostenGoedkoop)}.`,
      bewijs: opVolume.slice(0, 4).map((k) => bewijsregel(
        k.label,
        `${nf.format(Math.round(k[uitkomstVeld]))} ${uitkomstNaam} · ${cf0.format(k.spend ?? 0)} uitgaven · ${k[uitkomstVeld] ? cf2.format(k.spend / k[uitkomstVeld]) : 'niet te berekenen'} per stuk`
      )),
      herkomst: 'Verdeling van de uitgaven en de uitkomsten over de geselecteerde kanalen.',
      actie: spanning
        ? `Vergelijk de doelgroep en de landingspagina van ${grootste.label} met die van ${efficientste.label} en verschuif budget wanneer de kwaliteit vergelijkbaar is.`
        : `Onderzoek of er ruimte is om het budget van ${efficientste.label} te verhogen.`,
      betrouwbaarheid: bepaalBetrouwbaarheid({
        volume: totaal, minimum: 40, vergelijkbaar, dekking,
      }),
      impact: Math.min(60, Math.abs(verschilPct)),
      volume: totaal,
      kanalen: metUitkomst.map((k) => k.channel),
    }));
  }

  return uit;
}

function budgetInzicht({ budget, dekking, vergelijkbaar }) {
  if (!budget || ![PacingStatus.BOVEN_BUDGET, PacingStatus.ONDER_BUDGET].includes(budget.status)) {
    return [];
  }
  const boven = budget.status === PacingStatus.BOVEN_BUDGET;
  const afwijking = veiligPercentage(budget.verschil, budget.budget);

  return [inzicht({
    categorie: InzichtCategorie.AANDACHTSPUNT,
    titel: boven
      ? `De besteding ligt ${pf0(Math.abs(afwijking))} boven het budget voor deze periode`
      : `De besteding blijft ${pf0(Math.abs(afwijking))} onder het budget voor deze periode`,
    samenvatting: budget.prognoseMogelijk
      ? `Op het huidige tempo komt de besteding uit op ${cf0.format(budget.prognose)}, tegenover een budget van ${cf0.format(budget.budget)}.`
      : `Er is ${cf0.format(budget.uitgaven)} besteed van een budget van ${cf0.format(budget.budget)}.`,
    bewijs: [
      bewijsregel('Uitgaven tot nu toe', cf0.format(budget.uitgaven)),
      bewijsregel('Budget voor deze periode', cf0.format(budget.budget)),
      bewijsregel('Verstreken', `${budget.verstrekenDagen} van ${budget.totaalDagen} dagen`),
      ...(budget.gemiddeldPerDag != null ? [bewijsregel('Gemiddeld per dag', cf0.format(budget.gemiddeldPerDag))] : []),
    ],
    actie: boven
      ? 'Verlaag het dagbudget of stel een einddatum in voordat het maandbudget wordt overschreden.'
      : 'Beoordeel of het resterende budget nog binnen de periode besteed kan worden, of verlaag het budget.',
    betrouwbaarheid: bepaalBetrouwbaarheid({ volume: budget.verstrekenDagen * 10, minimum: 30, vergelijkbaar, dekking }),
    impact: Math.min(70, Math.abs(afwijking ?? 0)),
    volume: budget.uitgaven ?? 0,
    metriek: 'spend',
  })];
}

function meetbeperkingInzichten({ meldingen, model, totalen }) {
  const uit = [];

  if (model === 'leadgen' && totalen.qualifiedLeads == null) {
    uit.push(inzicht({
      categorie: InzichtCategorie.MEETBEPERKING,
      titel: 'Klantconversies zijn niet meetbaar',
      samenvatting: 'De leads worden wel gemeten, maar er is geen CRM-data om te bepalen hoeveel leads gekwalificeerd zijn of klant zijn geworden.',
      bewijs: [
        bewijsregel('Gemeten leads', nf.format(Math.round(totalen.leads ?? 0))),
        bewijsregel('Gekwalificeerde leads', 'Niet gekoppeld'),
        bewijsregel('Klanten', 'Niet gekoppeld'),
      ],
      actie: 'Richt de CRM-koppeling in, of vraag om een maandelijkse export van opdrachten om de leadkwaliteit alsnog te kunnen beoordelen.',
      betrouwbaarheid: { niveau: Betrouwbaarheid.HOOG, redenen: [] },
      impact: 55,
      volume: totalen.leads ?? 0,
    }));
  }

  const dekkingsmeldingen = (meldingen ?? []).filter((m) => ['gedeeltelijk', 'geen-data'].includes(m.soort));
  if (dekkingsmeldingen.length) {
    uit.push(inzicht({
      categorie: InzichtCategorie.MEETBEPERKING,
      titel: 'De data is niet volledig over deze periode',
      samenvatting: 'Een deel van de periode of van de kanalen heeft geen gegevens geleverd. Vergelijkingen met de vorige periode zijn daardoor minder scherp.',
      bewijs: dekkingsmeldingen.map((m, i) => bewijsregel(`Bevinding ${i + 1}`, m.tekst)),
      actie: 'Controleer de koppelingen van de betrokken bronnen voordat je conclusies aan deze periode verbindt.',
      betrouwbaarheid: { niveau: Betrouwbaarheid.HOOG, redenen: [] },
      impact: 30,
      volume: 100,
    }));
  }

  return uit;
}

/* ---------------------------------------------------------------
   Leadgeneratie
   --------------------------------------------------------------- */

function leadgenInzichten(ctx) {
  const { totalen, vorigeTotalen, deltas, kanaalRijen, funnel, dekking, budget, vergelijkingActief } = ctx;
  const uit = [];
  const vergelijkbaar = vergelijkingActief && vorigeTotalen != null;

  /* Efficiëntie: de kosten per lead, met de ontleding erbij. */
  const cpl = deltas.cpl;
  if (cpl && ['gestegen', 'gedaald'].includes(cpl.status)) {
    const ontleding = ontleedLeadgroei(totalen, vorigeTotalen);
    const gestegen = cpl.status === 'gestegen';
    const herkomst = ontleding
      ? `De verandering hangt vooral samen met ${ontleding.grootste.label}: dat verklaart ${nf.format(Math.round(Math.abs(ontleding.grootste.bijdrage)))} van de ${nf.format(Math.round(Math.abs(ontleding.totaal)))} leads verschil.`
      : 'Op basis van de huidige data is geen oorzaak vast te stellen.';

    uit.push(inzicht({
      categorie: gestegen ? InzichtCategorie.AANDACHTSPUNT : InzichtCategorie.ONTWIKKELING,
      titel: `De kosten per lead liggen ${pf0(Math.abs(cpl.procent))} ${gestegen ? 'boven' : 'onder'} de vorige periode`,
      samenvatting: `De kosten gingen van ${cf2.format(cpl.vorig)} naar ${cf2.format(cpl.huidig)} per lead. ${herkomst}`,
      bewijs: [
        bewijsregel('Kosten per lead nu', cf2.format(cpl.huidig)),
        bewijsregel('Kosten per lead vorige periode', cf2.format(cpl.vorig)),
        bewijsregel('Leads', `${nf.format(Math.round(totalen.leads ?? 0))} tegenover ${nf.format(Math.round(vorigeTotalen?.leads ?? 0))}`),
        bewijsregel('Uitgaven', `${cf0.format(totalen.spend ?? 0)} tegenover ${cf0.format(vorigeTotalen?.spend ?? 0)}`),
      ],
      herkomst,
      actie: gestegen
        ? 'Controleer de zoektermen en landingspagina’s van de kanalen met de grootste stijging in kosten per lead.'
        : 'Leg vast wat er in deze periode is aangepast, zodat de verbetering herhaalbaar wordt.',
      betrouwbaarheid: bepaalBetrouwbaarheid({ volume: totalen.leads, minimum: 30, vergelijkbaar, dekking }),
      impact: Math.abs(cpl.procent),
      volume: totalen.leads ?? 0,
      metriek: 'cpl',
    }));
  }

  /* Kwaliteit: het verschil tussen leads en gekwalificeerde leads. */
  if (totalen.qualifiedLeads != null && totalen.leads) {
    const ratio = veiligPercentage(totalen.qualifiedLeads, totalen.leads);
    const vorigeRatio = veiligPercentage(vorigeTotalen?.qualifiedLeads, vorigeTotalen?.leads);
    const verschil = ratio != null && vorigeRatio != null ? ratio - vorigeRatio : null;

    if (verschil != null && Math.abs(verschil) >= 2) {
      const omhoog = verschil > 0;
      uit.push(inzicht({
        categorie: omhoog ? InzichtCategorie.ONTWIKKELING : InzichtCategorie.AANDACHTSPUNT,
        titel: `${pf(ratio)} van de leads is gekwalificeerd, tegenover ${pf(vorigeRatio)} in de vorige periode`,
        samenvatting: omhoog
          ? `Er komen relatief meer bruikbare aanvragen binnen. Van ${nf.format(Math.round(totalen.leads))} leads werden er ${nf.format(Math.round(totalen.qualifiedLeads))} gekwalificeerd.`
          : `Er komen relatief minder bruikbare aanvragen binnen. Van ${nf.format(Math.round(totalen.leads))} leads werden er ${nf.format(Math.round(totalen.qualifiedLeads))} gekwalificeerd.`,
        bewijs: [
          bewijsregel('Leads', nf.format(Math.round(totalen.leads))),
          bewijsregel('Gekwalificeerd', nf.format(Math.round(totalen.qualifiedLeads))),
          bewijsregel('Kosten per gekwalificeerde lead', totalen.cpql == null ? 'Niet te berekenen' : cf2.format(totalen.cpql)),
          bewijsregel('Vorige periode', `${nf.format(Math.round(vorigeTotalen.qualifiedLeads))} van ${nf.format(Math.round(vorigeTotalen.leads))}`),
        ],
        actie: omhoog
          ? 'Zet meer budget op de kanalen en zoektermen die deze kwaliteit leveren.'
          : 'Beoordeel het formulier en de doelgroepinstellingen van de kanalen met de laagste kwalificatieratio.',
        betrouwbaarheid: bepaalBetrouwbaarheid({ volume: totalen.qualifiedLeads, minimum: 25, vergelijkbaar, dekking }),
        impact: Math.abs(verschil) * 2.5,
        volume: totalen.qualifiedLeads,
        metriek: 'kwalificatieratio',
      }));
    }
  }

  /* Funnel: de stap met de grootste actiegerichte uitval. */
  if (funnel?.knelpunt && !funnel.onvoldoendeVolume) {
    const k = funnel.knelpunt;
    uit.push(inzicht({
      categorie: InzichtCategorie.KANS,
      titel: `De grootste uitval zit bij de stap ${k.label.toLowerCase()}`,
      samenvatting: `Van de voorgaande stap komt ${pf(k.doorstroom)} door. Dat is de grootste beïnvloedbare uitval in de funnel; de doorklikratio van de advertentie telt hier bewust niet mee.`,
      bewijs: funnel.rijen
        .filter((r) => r.volume != null)
        .slice(0, 6)
        .map((r) => bewijsregel(r.label, `${nf.format(Math.round(r.volume))}${r.doorstroom == null ? '' : ` · ${pf(r.doorstroom)} doorstroom`}`)),
      actie: `Onderzoek de stap ${k.label.toLowerCase()}: kijk naar de pagina, het formulier en de aansluiting met de advertentietekst.`,
      betrouwbaarheid: bepaalBetrouwbaarheid({ volume: funnel.instroom, minimum: 200, vergelijkbaar, dekking }),
      impact: Math.min(50, 100 - k.doorstroom),
      volume: funnel.instroom ?? 0,
    }));
  }

  uit.push(...kanaalInzichten({
    kanaalRijen, uitkomstVeld: 'leads', uitkomstNaam: 'leads', dekking, vergelijkbaar,
  }));
  uit.push(...budgetInzicht({ budget, dekking, vergelijkbaar }));
  uit.push(...meetbeperkingInzichten({ meldingen: ctx.meldingen, model: 'leadgen', totalen }));

  return uit;
}

/* ---------------------------------------------------------------
   E-commerce
   --------------------------------------------------------------- */

function ecommerceInzichten(ctx) {
  const { totalen, vorigeTotalen, deltas, kanaalRijen, funnel, dekking, budget, vergelijkingActief } = ctx;
  const uit = [];
  const vergelijkbaar = vergelijkingActief && vorigeTotalen != null;

  /* Omzet, ontleed in verkeer, conversie en orderwaarde. */
  const omzet = deltas.revenue;
  const ontleding = ontleedOmzetgroei(totalen, vorigeTotalen);

  if (omzet && ['gestegen', 'gedaald'].includes(omzet.status)) {
    const omhoog = omzet.status === 'gestegen';
    const grootste = ontleding?.grootste;

    uit.push(inzicht({
      categorie: omhoog ? InzichtCategorie.ONTWIKKELING : InzichtCategorie.AANDACHTSPUNT,
      titel: grootste
        ? `De omzet ${omhoog ? 'steeg' : 'daalde'} vooral door ${grootste.label}`
        : `De omzet ${omhoog ? 'steeg' : 'daalde'} met ${pf0(Math.abs(omzet.procent))}`,
      samenvatting: grootste
        ? `De omzet ging van ${cf0.format(omzet.vorig)} naar ${cf0.format(omzet.huidig)}. Van dat verschil van ${cf0.format(Math.abs(ontleding.totaal))} komt ${cf0.format(Math.abs(grootste.bijdrage))} uit ${grootste.label}.`
        : `De omzet ging van ${cf0.format(omzet.vorig)} naar ${cf0.format(omzet.huidig)}. Op basis van de huidige data is niet vast te stellen welke factor daar het meest aan bijdroeg.`,
      bewijs: ontleding
        ? [
          bewijsregel('Bijdrage van het verkeer', cf0.format(ontleding.verkeer)),
          bewijsregel('Bijdrage van de conversieratio', cf0.format(ontleding.conversie)),
          bewijsregel('Bijdrage van de orderwaarde', cf0.format(ontleding.orderwaarde)),
          bewijsregel('Transacties', `${nf.format(Math.round(totalen.purchases ?? 0))} tegenover ${nf.format(Math.round(vorigeTotalen?.purchases ?? 0))}`),
        ]
        : [
          bewijsregel('Omzet nu', cf0.format(omzet.huidig)),
          bewijsregel('Omzet vorige periode', cf0.format(omzet.vorig)),
        ],
      herkomst: ontleding
        ? 'De ontleding vervangt de factoren één voor één, waardoor de drie bijdragen samen precies het omzetverschil vormen.'
        : null,
      actie: ontleding
        ? (grootste.key === 'conversie'
          ? 'Beoordeel het conversiepad van sessie tot bestelling en zoek de stap met de grootste uitval.'
          : grootste.key === 'orderwaarde'
            ? 'Kijk welke productgroepen de orderwaarde verschoven en of dat een blijvende verschuiving is.'
            : 'Beoordeel waar het verkeer vandaan kwam en of dat verkeer herhaalbaar is.')
        : 'Controleer of de conversiemeting over de hele periode volledig was.',
      betrouwbaarheid: bepaalBetrouwbaarheid({ volume: totalen.purchases, minimum: 50, vergelijkbaar, dekking }),
      impact: Math.abs(omzet.procent ?? 0) + 10,
      volume: totalen.purchases ?? 0,
      metriek: 'revenue',
    }));
  }

  /* Rendement. */
  const roas = deltas.roas;
  if (roas && ['gestegen', 'gedaald'].includes(roas.status)) {
    const omhoog = roas.status === 'gestegen';
    uit.push(inzicht({
      categorie: omhoog ? InzichtCategorie.KANS : InzichtCategorie.AANDACHTSPUNT,
      titel: `Het rendement op advertenties ging van ${roas.vorig.toFixed(2)}× naar ${roas.huidig.toFixed(2)}×`,
      samenvatting: omhoog
        ? `Elke euro advertentiekosten levert nu ${cf2.format(roas.huidig)} omzet op, tegen ${cf2.format(roas.vorig)} in de vorige periode.`
        : `Elke euro advertentiekosten levert nu ${cf2.format(roas.huidig)} omzet op, tegen ${cf2.format(roas.vorig)} in de vorige periode. De uitgaven groeiden harder dan de omzet.`,
      bewijs: [
        bewijsregel('Omzet', cf0.format(totalen.revenue ?? 0)),
        bewijsregel('Advertentie-uitgaven', cf0.format(totalen.spend ?? 0)),
        bewijsregel('Kosten per transactie', totalen.cpa == null ? 'Niet te berekenen' : cf2.format(totalen.cpa)),
        bewijsregel('Gemiddelde orderwaarde', totalen.aov == null ? 'Niet te berekenen' : cf2.format(totalen.aov)),
      ],
      actie: omhoog
        ? 'Onderzoek of er ruimte is om het budget te verhogen zonder dat het rendement terugvalt.'
        : 'Vergelijk het rendement per kanaal en verschuif budget weg van de kanalen die het gemiddelde omlaag trekken.',
      betrouwbaarheid: bepaalBetrouwbaarheid({ volume: totalen.purchases, minimum: 50, vergelijkbaar, dekking }),
      impact: Math.abs(roas.procent ?? 0),
      volume: totalen.purchases ?? 0,
      metriek: 'roas',
    }));
  }

  /* Conversiepad. */
  if (funnel?.knelpunt && !funnel.onvoldoendeVolume) {
    const k = funnel.knelpunt;
    uit.push(inzicht({
      categorie: InzichtCategorie.KANS,
      titel: `De grootste uitval in het conversiepad zit bij ${k.label.toLowerCase()}`,
      samenvatting: `Van de voorgaande stap gaat ${pf(k.doorstroom)} door naar ${k.label.toLowerCase()}.`,
      bewijs: funnel.rijen
        .filter((r) => r.volume != null)
        .map((r) => bewijsregel(r.label, `${nf.format(Math.round(r.volume))}${r.doorstroom == null ? '' : ` · ${pf(r.doorstroom)} doorstroom`}`)),
      actie: `Beoordeel de stap ${k.label.toLowerCase()} op laadtijd, verzendkosten en betaalmethoden.`,
      betrouwbaarheid: bepaalBetrouwbaarheid({ volume: funnel.instroom, minimum: 500, vergelijkbaar, dekking }),
      impact: Math.min(45, 100 - k.doorstroom),
      volume: funnel.instroom ?? 0,
    }));
  }

  uit.push(...kanaalInzichten({
    kanaalRijen, uitkomstVeld: 'purchases', uitkomstNaam: 'transacties', dekking, vergelijkbaar,
  }));
  uit.push(...budgetInzicht({ budget, dekking, vergelijkbaar }));
  uit.push(...meetbeperkingInzichten({ meldingen: ctx.meldingen, model: 'ecommerce', totalen }));

  return uit;
}

/* ---------------------------------------------------------------
   Awareness
   --------------------------------------------------------------- */

function awarenessInzichten(ctx) {
  const { totalen, vorigeTotalen, deltas, dekking, budget, vergelijkingActief } = ctx;
  const uit = [];
  const vergelijkbaar = vergelijkingActief && vorigeTotalen != null;

  /* Bereik en levering. */
  if (deltas.reach && ['gestegen', 'gedaald'].includes(deltas.reach.status)) {
    const omhoog = deltas.reach.status === 'gestegen';
    uit.push(inzicht({
      categorie: omhoog ? InzichtCategorie.ONTWIKKELING : InzichtCategorie.AANDACHTSPUNT,
      titel: `Het dagbereik ${omhoog ? 'groeide' : 'daalde'} met ${pf0(Math.abs(deltas.reach.procent))}`,
      samenvatting: `Er werden ${nf.format(Math.round(totalen.reach))} personen per dag bereikt, opgeteld over de periode, tegenover ${nf.format(Math.round(vorigeTotalen.reach))} in de vorige periode. Het unieke bereik over de hele periode wordt niet gemeten.`,
      bewijs: [
        bewijsregel('Impressies', nf.format(Math.round(totalen.impressions ?? 0))),
        bewijsregel('Bereikte personen per dag', nf.format(Math.round(totalen.reach ?? 0))),
        bewijsregel('Gemiddelde frequentie', totalen.frequentie == null ? 'Niet te berekenen' : `${totalen.frequentie.toFixed(2)}×`),
        bewijsregel('Kosten per duizend vertoningen', totalen.cpm == null ? 'Niet te berekenen' : cf2.format(totalen.cpm)),
      ],
      actie: omhoog
        ? 'Controleer of het extra bereik binnen de doelgroep viel voordat je het budget verder verhoogt.'
        : 'Verbreed de doelgroep of vernieuw de advertenties om nieuw bereik op te bouwen.',
      betrouwbaarheid: bepaalBetrouwbaarheid({ volume: totalen.impressions, minimum: 10000, vergelijkbaar, dekking }),
      impact: Math.abs(deltas.reach.procent ?? 0),
      volume: totalen.impressions ?? 0,
      metriek: 'reach',
    }));
  }

  /* Verzadiging: nadrukkelijk als combinatie, niet als vaststaand feit. */
  const frequentieOp = deltas.frequentie?.status === 'gestegen';
  const engagementAf = deltas.engagementRatio?.status === 'gedaald';
  const cpmOp = deltas.cpm?.status === 'gestegen';
  const voltooiingAf = deltas.videoVoltooiing?.status === 'gedaald';
  const signalen = [frequentieOp, engagementAf, cpmOp, voltooiingAf].filter(Boolean).length;

  if (signalen >= 2) {
    const onderdelen = [];
    if (frequentieOp) onderdelen.push(`de frequentie liep op naar ${totalen.frequentie.toFixed(2)} vertoningen per bereikte persoon per dag`);
    if (engagementAf) onderdelen.push(`de interactieratio daalde naar ${pf(totalen.engagementRatio)}`);
    if (cpmOp) onderdelen.push(`de kosten per duizend vertoningen stegen naar ${cf2.format(totalen.cpm)}`);
    if (voltooiingAf) onderdelen.push(`de videovoltooiing daalde naar ${pf(totalen.videoVoltooiing)}`);

    uit.push(inzicht({
      categorie: InzichtCategorie.AANDACHTSPUNT,
      titel: `${signalen} signalen wijzen samen op afnemende creatieve werking`,
      // Bewust geen stellige uitspraak: deze combinatie kán op vermoeidheid
      // wijzen, maar frequentie alleen bewijst dat niet.
      samenvatting: `De combinatie van ${onderdelen.slice(0, -1).join(', ')}${onderdelen.length > 1 ? ' en ' : ''}${onderdelen[onderdelen.length - 1]} kan wijzen op advertentievermoeidheid. Op basis van deze data alleen is dat niet met zekerheid vast te stellen.`,
      bewijs: [
        bewijsregel('Gemiddelde frequentie', totalen.frequentie == null ? 'Niet te berekenen' : `${totalen.frequentie.toFixed(2)}× tegenover ${vorigeTotalen?.frequentie?.toFixed(2) ?? 'onbekend'}×`),
        bewijsregel('Interactieratio', totalen.engagementRatio == null ? 'Niet gemeten' : `${pf(totalen.engagementRatio)} tegenover ${vorigeTotalen?.engagementRatio == null ? 'onbekend' : pf(vorigeTotalen.engagementRatio)}`),
        bewijsregel('Kosten per duizend vertoningen', totalen.cpm == null ? 'Niet te berekenen' : `${cf2.format(totalen.cpm)} tegenover ${vorigeTotalen?.cpm == null ? 'onbekend' : cf2.format(vorigeTotalen.cpm)}`),
        bewijsregel('Videovoltooiing', totalen.videoVoltooiing == null ? 'Niet gemeten' : `${pf(totalen.videoVoltooiing)} tegenover ${vorigeTotalen?.videoVoltooiing == null ? 'onbekend' : pf(vorigeTotalen.videoVoltooiing)}`),
      ],
      herkomst: 'Vier leveringssignalen bewegen tegelijk de verkeerde kant op. Elk signaal apart zegt weinig; samen vormen ze een patroon.',
      actie: 'Ververs de advertentievarianten en breid de doelgroep uit, en beoordeel daarna of de frequentie daalt en de interactieratio herstelt.',
      betrouwbaarheid: bepaalBetrouwbaarheid({ volume: totalen.impressions, minimum: 10000, vergelijkbaar, dekking }),
      impact: 20 + signalen * 10,
      volume: totalen.impressions ?? 0,
      metriek: 'frequentie',
    }));
  }

  /* Ondersteunende resultaten. */
  if (deltas.brandedSearchClicks && ['gestegen', 'gedaald'].includes(deltas.brandedSearchClicks.status)) {
    const omhoog = deltas.brandedSearchClicks.status === 'gestegen';
    uit.push(inzicht({
      categorie: omhoog ? InzichtCategorie.ONTWIKKELING : InzichtCategorie.AANDACHTSPUNT,
      titel: `Zoekopdrachten op de merknaam ${omhoog ? 'namen toe' : 'namen af'} met ${pf0(Math.abs(deltas.brandedSearchClicks.procent))}`,
      samenvatting: 'Merkzoekopdrachten zijn een indirecte aanwijzing voor bekendheid. Ze zijn niet aan deze campagne toe te schrijven, want ook andere activiteiten beïnvloeden ze.',
      bewijs: [
        bewijsregel('Klikken op merkzoekwoorden', nf.format(Math.round(totalen.brandedSearchClicks ?? 0))),
        bewijsregel('Vorige periode', nf.format(Math.round(vorigeTotalen?.brandedSearchClicks ?? 0))),
        bewijsregel('Impressies in dezelfde periode', nf.format(Math.round(totalen.impressions ?? 0))),
      ],
      herkomst: 'De ontwikkeling loopt gelijk op met de campagne, maar samenhang is hier geen bewijs van oorzaak.',
      actie: 'Volg de merkzoekopdrachten over meerdere periodes voordat je ze aan deze campagne toeschrijft.',
      betrouwbaarheid: {
        niveau: Betrouwbaarheid.BEPERKT,
        redenen: ['Merkzoekopdrachten worden ook door andere activiteiten beïnvloed en zijn niet aan één kanaal toe te wijzen.'],
      },
      impact: Math.abs(deltas.brandedSearchClicks.procent ?? 0) * 0.6,
      volume: totalen.brandedSearchClicks ?? 0,
      metriek: 'brandedSearchClicks',
    }));
  }

  uit.push(...budgetInzicht({ budget, dekking, vergelijkbaar }));
  uit.push(...meetbeperkingInzichten({ meldingen: ctx.meldingen, model: 'awareness', totalen }));

  return uit;
}

/* ---------------------------------------------------------------
   Ingang
   --------------------------------------------------------------- */

/**
 * Bouwt en rangschikt de inzichten voor één klant.
 *
 * @returns {{primair: object[], aanvullend: object[], alle: object[], contract: object}}
 */
export function bouwKlantInzichten(ctx) {
  const bouwers = {
    leadgen: leadgenInzichten,
    ecommerce: ecommerceInzichten,
    awareness: awarenessInzichten,
  };
  const alle = (bouwers[ctx.model] ?? awarenessInzichten)(ctx);
  const { primair, aanvullend } = rangschik(alle);

  return { primair, aanvullend, alle, contract: INZICHT_CONTRACTEN[ctx.model] ?? null };
}

/* ---------------------------------------------------------------
   Prioriteit van een klant binnen de portefeuille
   --------------------------------------------------------------- */

export const Prioriteit = {
  DIRECT: 'direct',
  BINNENKORT: 'binnenkort',
  GEEN: 'geen',
};

export const PRIORITEIT_LABELS = {
  [Prioriteit.DIRECT]: 'Vandaag aandacht nodig',
  [Prioriteit.BINNENKORT]: 'Deze week bekijken',
  [Prioriteit.GEEN]: 'Geen actie nodig',
};

export const PRIORITEIT_VARIANT = {
  [Prioriteit.DIRECT]: 'hoog',
  [Prioriteit.BINNENKORT]: 'middel',
  [Prioriteit.GEEN]: 'ok',
};

/**
 * Bepaalt hoeveel aandacht een klant nodig heeft, met de redenen erbij.
 *
 * Er komt bewust geen ondoorzichtig cijfer uit. De redenen zijn de uitkomst; de
 * score bepaalt alleen de volgorde. Wie de lijst leest, ziet meteen waaróm een
 * klant bovenaan staat.
 */
export function bepaalPrioriteit(samenvatting) {
  const redenen = [];
  let punten = 0;

  const { client, totalen, doelen, budget, dekking, deltas, openSignalen = 0 } = samenvatting;

  if (client.trackingStatus === 'probleem') {
    punten += 40;
    redenen.push(`De meting is onvolledig: de datakwaliteit staat op ${client.dataHealth} procent.`);
  }

  // Het budgetdoel blijft hier buiten: de budgetafwijking krijgt hieronder al
  // een eigen reden, en die twee keer noemen maakt de lijst langer maar niet
  // duidelijker.
  const gemist = (doelen ?? []).filter(
    (d) => d.kpi !== 'maandbudget' && d.actueel != null && d.target != null && !doelBehaaldLokaal(d)
  );
  for (const doel of gemist.slice(0, 3)) {
    const afwijking = doel.richting === 'hoger'
      ? ((doel.target - doel.actueel) / doel.target) * 100
      : ((doel.actueel - doel.target) / doel.target) * 100;
    if (afwijking > 5) {
      punten += Math.min(30, afwijking);
      redenen.push(`${metriekMeta(doelMetriek(doel.kpi)).label} ligt ${pf0(afwijking)} van het doel af.`);
    }
  }

  if (budget?.status === PacingStatus.BOVEN_BUDGET) {
    const afwijking = Math.abs(veiligPercentage(budget.verschil, budget.budget) ?? 0);
    punten += Math.min(25, afwijking);
    redenen.push(`De besteding ligt ${pf0(afwijking)} boven het budget voor deze periode.`);
  }
  if (budget?.status === PacingStatus.ONDER_BUDGET) {
    const afwijking = Math.abs(veiligPercentage(budget.verschil, budget.budget) ?? 0);
    punten += Math.min(15, afwijking / 2);
    redenen.push(`De besteding blijft ${pf0(afwijking)} onder het budget voor deze periode.`);
  }

  const primaireMetriek = { ecommerce: 'revenue', leadgen: 'leads' }[modelVanClient(client)];
  const hoofdDelta = primaireMetriek ? deltas?.[primaireMetriek] : null;
  if (hoofdDelta?.status === 'gedaald' && Math.abs(hoofdDelta.procent) > 10) {
    punten += Math.min(25, Math.abs(hoofdDelta.procent));
    redenen.push(`${metriekMeta(primaireMetriek).label} daalde met ${pf0(Math.abs(hoofdDelta.procent))} ten opzichte van de vorige periode.`);
  }

  if (dekking?.status === DekkingStatus.GEDEELTELIJK) {
    punten += 12;
    redenen.push(`Voor ${dekking.ontbrekendeDagen || 'een deel van de'} dagen in deze periode ontbreekt data.`);
  }
  if (dekking?.status === DekkingStatus.GEEN_DATA) {
    punten += 35;
    redenen.push('Er is binnen deze selectie helemaal geen data.');
  }

  if (modelVanClient(client) === 'leadgen' && totalen?.qualifiedLeads == null) {
    punten += 15;
    redenen.push('Zonder CRM-koppeling is niet te bepalen welke leads iets opleveren.');
  }

  if (openSignalen > 0) {
    punten += Math.min(20, openSignalen * 8);
    redenen.push(`${openSignalen} ${openSignalen === 1 ? 'openstaand signaal' : 'openstaande signalen'} zonder opvolging.`);
  }

  const niveau = punten >= 45 ? Prioriteit.DIRECT : punten >= 18 ? Prioriteit.BINNENKORT : Prioriteit.GEEN;

  return {
    niveau,
    punten: Math.round(punten),
    label: PRIORITEIT_LABELS[niveau],
    variant: PRIORITEIT_VARIANT[niveau],
    redenen: redenen.length ? redenen : ['Alle meetbare doelen liggen op koers en de meting is volledig.'],
  };
}

function doelBehaaldLokaal(doel) {
  if (doel.richting === 'binnen' || doel.richting === 'lager') return doel.actueel <= doel.target;
  return doel.actueel >= doel.target;
}

function doelMetriek(kpi) {
  return {
    omzet: 'revenue', aankopen: 'purchases', roas: 'roas', maandbudget: 'spend',
    leads: 'leads', gekwalificeerdeLeads: 'qualifiedLeads', afspraken: 'appointments',
    offertes: 'quotes', klanten: 'customers', cpl: 'cpl', cpql: 'cpql',
    websitegebruikers: 'users', telefoongesprekken: 'conversies', emailacties: 'conversies',
  }[kpi] ?? kpi;
}

function modelVanClient(client) {
  return client.businessModel;
}
