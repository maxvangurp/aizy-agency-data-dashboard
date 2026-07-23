/**
 * Deterministische intent-engine van de demo-assistent.
 *
 * Geen taalmodel, geen willekeur: dezelfde vraag met dezelfde context geeft
 * exact hetzelfde antwoord. De engine herkent een handvol intents, put uit de
 * centrale paginahulpcatalogus, de metriekcatalogus en de compacte context, en
 * verzint nooit data of functionaliteit die niet bestaat.
 */

import { paginahulp } from './page-help.js';
import { metriekCatalogus } from '../data/metrics-catalog.js';

const euro = (n, d = 0) => (typeof n === 'number'
  ? `€${n.toLocaleString('nl-NL', { minimumFractionDigits: d, maximumFractionDigits: d })}`
  : '—');

/** Natuurlijke termen → metrieksleutel. */
const METRIEK_TERMEN = [
  [/\broas\b|rendement op advertentie/, 'roas'],
  [/\bcpa\b|kosten per transactie/, 'cpa'],
  [/\bcpl\b|kosten per lead/, 'cpl'],
  [/\bcpql\b|gekwalificeerde lead/, 'qualifiedLeads'],
  [/\bctr\b|doorklikratio/, 'ctr'],
  [/\bcpc\b|kosten per klik/, 'cpc'],
  [/\bcpm\b/, 'cpm'],
  [/\baov\b|gemiddelde orderwaarde/, 'aov'],
  [/conversieratio|conversie ?ratio/, 'conversieratio'],
  [/frequentie/, 'frequentie'],
  [/bereik/, 'reach'],
  [/\bomzet\b/, 'revenue'],
  [/\bleads?\b/, 'leads'],
];

/** Termen die geen catalogusmetriek zijn maar wel uitleg verdienen. */
const BEGRIPPEN = {
  betrouwbaarheid: {
    tekst: 'Betrouwbaarheid geeft aan hoe hard een conclusie is. Ze daalt wanneer een meetbron ontbreekt, data verouderd is of een koppeling incompleet is.',
    punten: ['Hoog: de meting is volledig en actueel.', 'Laag: behandel de cijfers als indicatie, niet als feit.'],
    beperking: 'Betrouwbaarheid gaat over de meting, niet over de prestatie.',
    acties: ['open-datakwaliteit'],
  },
  'budget pacing': {
    tekst: 'Budget pacing is het tempo waarin het budget wordt uitgegeven ten opzichte van de verstreken tijd in de periode.',
    punten: ['Op koers: uitgaven en tijd lopen gelijk op.', 'Te snel: het budget is eerder op dan de maand.'],
    beperking: 'Pacing voorspelt het einde van de periode; het is geen eindresultaat.',
    acties: ['open-budgetten'],
  },
  pacing: {
    tekst: 'Pacing is het uitgavetempo binnen de periode: ligt het budget op schema, of gaat het te snel of te langzaam?',
    punten: [],
    beperking: null,
    acties: ['open-budgetten'],
  },
};

function vindMetriek(tekst) {
  for (const [patroon, key] of METRIEK_TERMEN) if (patroon.test(tekst)) return key;
  return null;
}

/* ---------------------------------------------------------------
   Intentherkenning
   --------------------------------------------------------------- */

function herkenIntent(tekst) {
  if (/vat.*samen|samenvatting|wat valt op|wat gaat goed|wat heeft aandacht nodig|^wat valt/.test(tekst)) return 'samenvatting';
  if (/\beerst\b|belangrijkst|urgent|meeste aandacht|hoogste prioriteit|waar moet ik (eerst|beginnen)/.test(tekst)) return 'prioritering';
  if (/wat betekent|leg .* uit|hoe wordt .* berekend|wat is (cpa|cpl|roas|ctr|cpc|aov|een gekwalificeerde|budget pacing|betrouwbaarheid)/.test(tekst)) return 'metriek';
  if (/waar (zie|vind|kan|staan|zit)|hoe kom ik|hoe ga ik naar|hoe open ik/.test(tekst)) return 'navigatie';
  if (/volgende stap|slimmer|welke filters|waar moet ik op letten|geef een tip|werkwijze|hoe rond ik/.test(tekst)) return 'tips';
  if (/wat kan ik|waar kijk ik|hoe gebruik ik|welke onderdelen|wat is deze pagina|leg deze pagina/.test(tekst)) return 'pagina';
  // Een losse metriekterm zonder vraagwoord telt ook als metriekvraag.
  if (vindMetriek(tekst) || Object.keys(BEGRIPPEN).some((b) => tekst.includes(b))) return 'metriek';
  return 'onbekend';
}

/* ---------------------------------------------------------------
   Antwoordbouwers
   --------------------------------------------------------------- */

function antwoordMetriek(tekst, hulp) {
  for (const term of Object.keys(BEGRIPPEN)) {
    if (tekst.includes(term)) return { ...BEGRIPPEN[term], demo: true };
  }
  const key = vindMetriek(tekst);
  if (!key) {
    return {
      tekst: 'Ik weet niet zeker welke metriek je bedoelt. Noem bijvoorbeeld ROAS, CPL, CPA of betrouwbaarheid.',
      acties: hulp.navActions,
      demo: true,
    };
  }
  const m = metriekCatalogus(key);
  const punten = [];
  if (m.formule) punten.push(`Berekening: ${m.formule}`);
  if (m.interpretatie) punten.push(m.interpretatie);
  return {
    tekst: `${m.label}${m.kort ? ` (${m.kort})` : ''}: ${m.uitleg || m.interpretatie || 'een metriek in dit dashboard.'}`,
    punten,
    beperking: m.beperking,
    demo: true,
  };
}

function antwoordSamenvatting(context, hulp) {
  const s = context.summary ?? {};
  const cijfers = [];
  let tekst = hulp.insight(context);

  if (context.pageType === 'agency-client-detail' || context.pageType === 'client-overview') {
    if (s.leads != null) cijfers.push({ label: 'Leads', waarde: String(s.leads) });
    if (s.cpl != null) cijfers.push({ label: 'Kosten per lead', waarde: euro(s.cpl, 2) });
    if (s.spend != null) cijfers.push({ label: 'Uitgaven', waarde: euro(s.spend) });
    if (s.statusLabel) tekst = `${context.clientName ?? 'De klant'} heeft de status "${s.statusLabel}". ${tekst}`;
  } else if (context.pageType === 'agency-signals') {
    if (s.signalenNieuw != null) cijfers.push({ label: 'Nieuw', waarde: String(s.signalenNieuw) });
    if (s.signalenZonderActie != null) cijfers.push({ label: 'Zonder actie', waarde: String(s.signalenZonderActie) });
    if (s.signalenZonderPlanning != null) cijfers.push({ label: 'Zonder planning', waarde: String(s.signalenZonderPlanning) });
  } else if (context.pageType === 'agency-actions') {
    if (s.actiesOpen != null) cijfers.push({ label: 'Open', waarde: String(s.actiesOpen) });
    if (s.actiesVerlopen != null) cijfers.push({ label: 'Verlopen', waarde: String(s.actiesVerlopen) });
    if (s.actiesVandaag != null) cijfers.push({ label: 'Vandaag', waarde: String(s.actiesVandaag) });
  } else if (context.pageType === 'agency-portfolio' || context.pageType === 'agency-clients') {
    if (s.aandacht != null) cijfers.push({ label: 'Aandacht nodig', waarde: String(s.aandacht) });
    if (s.klantenTotaal != null) cijfers.push({ label: 'Klanten', waarde: String(s.klantenTotaal) });
  } else if (context.pageType === 'agency-budgets') {
    if (s.spend != null) cijfers.push({ label: 'Besteed', waarde: euro(s.spend) });
    if (s.budget != null) cijfers.push({ label: 'Budget', waarde: euro(s.budget) });
    if (s.pacing != null) cijfers.push({ label: 'Pacing', waarde: `${s.pacing}%` });
  } else if (context.pageType === 'agency-channels' || context.pageType === 'agency-campaigns') {
    if (s.spend != null) cijfers.push({ label: 'Uitgaven', waarde: euro(s.spend) });
    if (s.aandacht != null) cijfers.push({ label: 'Aandacht nodig', waarde: String(s.aandacht) });
  } else if (context.pageType === 'agency-conversions') {
    if (s.leads != null) cijfers.push({ label: 'Leads', waarde: String(s.leads) });
    if (s.aankopen != null) cijfers.push({ label: 'Aankopen', waarde: String(s.aankopen) });
  } else if (context.pageType === 'agency-dataquality') {
    if (s.dekkingProblemen != null) cijfers.push({ label: 'Onvolledige dekking', waarde: String(s.dekkingProblemen) });
    if (s.trackingProblemen != null) cijfers.push({ label: 'Trackingproblemen', waarde: String(s.trackingProblemen) });
  }

  return {
    tekst,
    cijfers,
    beperking: 'Ik gebruik nu alleen de zichtbare gegevens van deze pagina.',
    acties: hulp.navActions.slice(0, 3),
    demo: true,
  };
}

function antwoordPrioritering(context, hulp) {
  const s = context.summary ?? {};
  let tekst;
  const acties = [];

  switch (context.pageType) {
    case 'agency-signals':
      tekst = 'Begin met het signaal met de hoogste impact dat nog geen eigenaar of actie heeft. Daarna zijn de signalen belangrijk die wel zijn toegewezen, maar nog niet zijn ingepland.';
      if (s.signalenZonderActie) tekst += ` ${s.signalenZonderActie} signalen hebben nog geen actie.`;
      acties.push('toon-nieuw', 'open-acties');
      break;
    case 'agency-actions':
      tekst = 'Pak eerst wat verlopen is, daarna wat het hardst is, daarna wat als eerste af moet. De lijst staat al in die volgorde.';
      if (s.actiesVerlopen) tekst += ` Er zijn ${s.actiesVerlopen} verlopen acties.`;
      acties.push('open-planning');
      break;
    case 'agency-portfolio':
    case 'agency-clients':
      tekst = 'Kijk eerst naar de klanten met de status Aandacht nodig; de lijst staat op prioriteit. De reden onder de status vertelt waar het aan ligt.';
      if (s.aandacht) tekst += ` ${s.aandacht} klanten vragen nu aandacht.`;
      acties.push('open-signalen', 'open-budgetten');
      break;
    case 'agency-budgets':
      tekst = 'Kijk eerst naar de klanten met de grootste pacing-afwijking; die dreigen als eerste over of onder budget uit te komen.';
      if (s.pacing != null) tekst += ` De portefeuille zit nu op ${s.pacing}% van het budget.`;
      acties.push('open-campagnes');
      break;
    case 'agency-dataquality':
      tekst = 'Los eerst een meetprobleem op dat een conclusie raakt; pas daarna de rest. Onbetrouwbare data stuurt anders je hele analyse.';
      if (s.dekkingProblemen) tekst += ` ${s.dekkingProblemen} klanten hebben onvolledige dekking.`;
      acties.push('open-integraties');
      break;
    default:
      tekst = `${hulp.tips[0] ?? 'Begin bij wat de meeste impact heeft.'}`;
      acties.push(...hulp.navActions.slice(0, 2));
  }

  return { tekst, acties, demo: true };
}

function antwoordNavigatie(tekst, context, hulp) {
  const doelen = [
    [/campagne/, 'open-campagnes', 'De campagnes staan onder Performance → Campagnes.'],
    [/budget/, 'open-budgetten', 'De budgetten staan onder Performance → Budgetten.'],
    [/conversie/, 'open-conversies', 'De conversies staan onder Performance → Conversies.'],
    [/planning|agenda|inplannen/, 'open-planning', 'De planning staat onder Werk → Planning.'],
    [/signal/, 'open-signalen', 'De signalen staan onder Werk → Signalen.'],
    [/kanaal|kanalen/, 'open-kanalen', 'De kanalen staan onder Performance → Kanalen.'],
    [/databron|datakwaliteit|meetprobleem/, 'open-datakwaliteit', 'De databron en meetkwaliteit staan onder Analyse → Datakwaliteit.'],
    [/actie/, 'open-acties', 'De acties staan onder Werk → Acties.'],
  ];
  for (const [patroon, sleutel, uitleg] of doelen) {
    if (patroon.test(tekst)) return { tekst: uitleg, acties: [sleutel], demo: true };
  }
  return {
    tekst: 'Vertel me waar je heen wilt — bijvoorbeeld de campagnes, budgetten, conversies, planning of signalen — dan wijs ik je de weg.',
    acties: hulp.navActions,
    demo: true,
  };
}

function antwoordTips(hulp) {
  return {
    tekst: `Wat je hier kunt: ${hulp.capabilities.slice(0, 3).join(', ').toLowerCase()}.`,
    punten: hulp.tips,
    acties: hulp.navActions.slice(0, 2),
    demo: true,
  };
}

function antwoordPagina(hulp) {
  return {
    tekst: `${hulp.naam}: ${hulp.doel}`,
    punten: hulp.capabilities,
    beperking: hulp.tips[0] ? `Tip: ${hulp.tips[0]}` : null,
    acties: hulp.navActions.slice(0, 3),
    demo: true,
  };
}

function antwoordOnbekend(hulp) {
  return {
    tekst: 'Deze vraag kan ik in de demoversie nog niet volledig beantwoorden. Ik kan je wel helpen met de cijfers, acties, signalen, planning en mogelijkheden op deze pagina.',
    suggesties: hulp.suggestedQuestions.slice(0, 4),
    acties: hulp.navActions.slice(0, 2),
    demo: true,
  };
}

/* ---------------------------------------------------------------
   Publieke API
   --------------------------------------------------------------- */

/**
 * Beantwoordt een vraag deterministisch binnen de huidige context.
 * @returns {{tekst, punten?, cijfers?, beperking?, acties?, suggesties?, demo:true}}
 */
export function beantwoord(message, context) {
  const tekst = String(message ?? '').toLowerCase().trim();
  const hulp = paginahulp(context.pageType, context.activeTab);
  const intent = herkenIntent(tekst);

  switch (intent) {
    case 'metriek': return antwoordMetriek(tekst, hulp);
    case 'samenvatting': return antwoordSamenvatting(context, hulp);
    case 'prioritering': return antwoordPrioritering(context, hulp);
    case 'navigatie': return antwoordNavigatie(tekst, context, hulp);
    case 'tips': return antwoordTips(hulp);
    case 'pagina': return antwoordPagina(hulp);
    default: return antwoordOnbekend(hulp);
  }
}

/** De startsuggesties (begroeting, pagina-inzicht, voorgestelde vragen). */
export function startsuggesties(context) {
  const hulp = paginahulp(context.pageType, context.activeTab);
  return {
    begroeting: 'Waar kan ik je op deze pagina mee helpen?',
    insight: hulp.insight(context),
    vragen: hulp.suggestedQuestions.slice(0, 5),
  };
}
