/**
 * Centrale paginahulpcatalogus voor de Aizy-assistent.
 *
 * Per paginatype staat hier wat de pagina is, wat je er kunt, welke vragen
 * zinvol zijn en welke eerste stap logisch is. De assistent leest hieruit; geen
 * enkele view heeft eigen assistent-teksten. Zo blijft de hulp consistent en op
 * één plek te onderhouden.
 *
 * Een `insight(context)` geeft één korte, contextafhankelijke regel op basis van
 * de samenvatting die de contextbuilder heeft samengesteld. De functie is
 * defensief: ontbreekt een cijfer, dan valt hij terug op een algemene regel.
 */

const euro = (n) => (typeof n === 'number' ? `€${n.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}` : '—');

/** Terugvalhulp voor pagina's zonder eigen inhoudelijke analyse. */
const STANDAARD = {
  naam: 'Deze pagina',
  doel: 'Deze pagina toont een onderdeel van het dashboard.',
  capabilities: ['De cijfers en onderdelen op deze pagina bekijken', 'Naar een verdieping of ander onderdeel navigeren'],
  suggestedQuestions: [
    'Wat kan ik op deze pagina doen?',
    'Waar kijk ik naar?',
    'Wat is een logische volgende stap?',
  ],
  tips: ['Gebruik de linkernavigatie om naar een verwant onderdeel te gaan.'],
  navActions: [],
  insight: () => 'Ik kan uitleggen wat je op deze pagina ziet en welke stappen logisch zijn.',
};

const CATALOGUS = {
  'agency-portfolio': {
    naam: 'Portefeuille',
    doel: 'Alle klanten in één overzicht, gerangschikt op wie de meeste aandacht vraagt.',
    capabilities: [
      'Klanten sorteren en filteren op status',
      'Zien waarom een klant aandacht vraagt',
      'Een klant openen voor de onderliggende resultaten',
    ],
    suggestedQuestions: [
      'Welke klanten hebben nu de meeste aandacht nodig?',
      'Waarom staat een klant op Aandacht nodig?',
      'Welke filters kan ik hier gebruiken?',
      'Waar zie ik budget- of meetproblemen?',
      'Hoe open ik de onderliggende resultaten?',
    ],
    tips: ['Begin bovenaan: de lijst staat op prioriteit, niet op alfabet.'],
    navActions: ['open-signalen', 'open-budgetten', 'open-datakwaliteit'],
    insight: (c) => {
      const n = c.summary?.klantenTotaal;
      const aandacht = c.summary?.aandacht;
      if (typeof n === 'number') {
        return `Je bekijkt ${n} klanten over ${c.periodeLabel}${aandacht ? `, waarvan ${aandacht} met de status Aandacht nodig` : ''}.`;
      }
      return `Je bekijkt de portefeuille over ${c.periodeLabel}.`;
    },
  },

  'agency-work': {
    naam: 'Mijn werk',
    doel: 'Jouw dag in één blik: openstaande acties, planning en signalen die op jouw naam staan.',
    capabilities: ['Widgets herindelen', 'Direct naar je acties, planning of signalen springen'],
    suggestedQuestions: [
      'Wat staat vandaag op mijn naam?',
      'Welke acties zijn achterstallig?',
      'Welke signalen moet ik nog beoordelen?',
      'Wat is een logische volgende stap?',
    ],
    tips: ['Pak eerst wat achterstallig is; daarna wat vandaag afloopt.'],
    navActions: ['open-acties', 'open-planning', 'open-signalen'],
    insight: (c) => `Je bekijkt je persoonlijke werkoverzicht over ${c.periodeLabel}.`,
  },

  'agency-clients': {
    naam: 'Klanten',
    doel: 'De klantenlijst met resultaat, status en betrokkenheid per klant.',
    capabilities: ['Klanten filteren en sorteren', 'Een klant openen', 'De onderliggende resultaten bekijken'],
    suggestedQuestions: [
      'Welke klanten hebben nu de meeste aandacht nodig?',
      'Waarom staat een klant op Aandacht nodig?',
      'Welke filters kan ik hier gebruiken?',
      'Hoe open ik de onderliggende resultaten?',
    ],
    tips: ['Klik een klant aan voor een preview zonder de lijst te verlaten.'],
    navActions: ['open-signalen', 'open-budgetten'],
    insight: (c) => {
      const n = c.summary?.klantenTotaal;
      return typeof n === 'number'
        ? `Je bekijkt ${n} klanten over ${c.periodeLabel}.`
        : `Je bekijkt de klantenlijst over ${c.periodeLabel}.`;
    },
  },

  'agency-client-detail': {
    naam: 'Klantdetail',
    doel: 'De volledige interne weergave van één klant: resultaat, kanalen, funnel en opvolging.',
    capabilities: ['De belangrijkste ontwikkeling zien', 'Per kanaal de bijdrage bekijken', 'Een actie aanmaken', 'De klantomgeving openen'],
    suggestedQuestions: [
      'Wat is de belangrijkste ontwikkeling?',
      'Welk kanaal draagt het meeste bij?',
      'Waarom is de klant niet volledig op koers?',
      'Welke actie zou logisch zijn?',
      'Leg de kosten per lead uit.',
    ],
    tips: ['Kijk eerst naar de status en de reden daaronder; die vertelt waar de aandacht zit.'],
    navActions: ['open-klant-signalen', 'maak-actie', 'open-klantomgeving'],
    insight: (c) => {
      const s = c.summary;
      if (s?.clientName) {
        const cpl = s.cpl != null ? `, kosten per lead ${euro(s.cpl)}` : '';
        return `Je bekijkt ${s.clientName}${s.leads != null ? ` · ${s.leads} leads` : ''}${cpl} over ${c.periodeLabel}.`;
      }
      return `Je bekijkt de resultaten van ${c.clientName ?? 'deze klant'} over ${c.periodeLabel}.`;
    },
  },

  'agency-team': {
    naam: 'Team',
    doel: 'De teamleden, hun rollen en klanttoewijzingen.',
    capabilities: ['Teamleden bekijken', 'Rollen en toewijzingen zien'],
    suggestedQuestions: ['Wat kan ik op deze pagina doen?', 'Wie is waarvoor verantwoordelijk?'],
    tips: ['Een klant zonder eigenaar is een risico voor de opvolging.'],
    navActions: [],
    insight: () => 'Je bekijkt het team en de klanttoewijzingen.',
  },

  'agency-channels': {
    naam: 'Kanalen',
    doel: 'De prestaties per advertentiekanaal over alle klanten heen.',
    capabilities: ['Kanalen vergelijken', 'Een kanaalpagina openen', 'De opbouw per kanaal bekijken'],
    suggestedQuestions: [
      'Welk kanaal presteert het best?',
      'Waar zit de grootste verandering?',
      'Hoe wordt ROAS berekend?',
      'Waar zie ik de campagnes van een kanaal?',
    ],
    tips: ['Vergelijk altijd met de vorige periode; een absoluut getal zegt weinig zonder richting.'],
    navActions: ['open-campagnes', 'open-budgetten'],
    insight: (c) => c.summary?.spend != null
      ? `Je bekijkt de kanaalprestaties over ${c.periodeLabel}: ${euro(c.summary.spend)} advertentie-uitgaven over ${c.summary.klantenTotaal ?? 0} klanten.`
      : `Je bekijkt de kanaalprestaties over ${c.periodeLabel}.`,
  },

  'agency-channel': {
    naam: 'Kanaaldetail',
    doel: 'De prestaties, campagnes en koppelstatus van één kanaal.',
    capabilities: ['Campagnes van dit kanaal bekijken', 'De koppelstatus zien'],
    suggestedQuestions: ['Welke campagnes lopen op dit kanaal?', 'Hoe wordt ROAS berekend?', 'Wat betekent de koppelstatus?'],
    tips: ['Een niet-gekoppelde tab toont een koppelstatus in plaats van lege cijfers.'],
    navActions: ['open-campagnes'],
    insight: (c) => `Je bekijkt één kanaal over ${c.periodeLabel}.`,
  },

  'agency-campaigns': {
    naam: 'Campagnes',
    doel: 'Alle campagnes met hun uitgaven, resultaat en rendement.',
    capabilities: ['Campagnes filteren en sorteren', 'Zien welke campagne een afwijking veroorzaakt'],
    suggestedQuestions: [
      'Welke campagne presteert het slechtst?',
      'Welke campagne veroorzaakt de grootste budgetafwijking?',
      'Wat betekent CPA?',
      'Hoe wordt ROAS berekend?',
    ],
    tips: ['Sorteer op rendement om snel de uitschieters te vinden.'],
    navActions: ['open-budgetten', 'open-conversies'],
    insight: (c) => c.summary?.spend != null
      ? `Je bekijkt de campagnes over ${c.periodeLabel} met ${euro(c.summary.spend)} totale uitgaven.`
      : `Je bekijkt de campagnes over ${c.periodeLabel}.`,
  },

  'agency-budgets': {
    naam: 'Budgetten',
    doel: 'Budgetbewaking per klant: uitgaven, pacing en forecast tegen het afgesproken budget.',
    capabilities: ['Over- en onderschrijding zien', 'De opbouw per kanaal bekijken', 'Een budgetactie aanmaken'],
    suggestedQuestions: [
      'Welke klanten dreigen over budget te gaan?',
      'Hoe wordt de forecast berekend?',
      'Waar komt de grootste budgetafwijking vandaan?',
      'Welk dagbudget is nu nodig?',
      'Welke campagnes veroorzaken de afwijking?',
    ],
    tips: ['Kijk naar pacing, niet alleen naar het totaal: het tempo voorspelt het einde van de maand.'],
    navActions: ['open-campagnes', 'maak-actie'],
    insight: (c) => (c.summary?.spend != null && c.summary?.budget)
      ? `Je bekijkt de budgetbewaking over ${c.periodeLabel}: ${euro(c.summary.spend)} van ${euro(c.summary.budget)} besteed (${c.summary.pacing ?? '—'}% pacing).`
      : `Je bekijkt de budgetbewaking over ${c.periodeLabel}.`,
  },

  'agency-conversions': {
    naam: 'Conversies',
    doel: 'De conversies en hun waarde, met het gekozen conversietype als meetlat.',
    capabilities: ['Conversietype kiezen', 'De conversiewaarde per kanaal bekijken'],
    suggestedQuestions: ['Wat betekent een gekwalificeerde lead?', 'Welk kanaal levert de meeste conversies?', 'Hoe kies ik het conversietype?'],
    tips: ['Het conversietype bepaalt de meetlat; kies het bewust voordat je vergelijkt.'],
    navActions: ['open-campagnes'],
    insight: (c) => (c.summary?.leads != null || c.summary?.aankopen != null)
      ? `Je bekijkt de conversies over ${c.periodeLabel}: ${c.summary.leads ?? 0} leads en ${c.summary.aankopen ?? 0} aankopen.`
      : `Je bekijkt de conversies over ${c.periodeLabel}.`,
  },

  'agency-actions': {
    naam: 'Acties',
    doel: 'Alle werk in lijst, bord en agenda: één actie, drie weergaven.',
    capabilities: ['Een actie aanmaken', 'De status verslepen op het bord', 'Een actie inplannen', 'Een actie afronden'],
    suggestedQuestions: [
      'Welke acties zijn achterstallig?',
      'Welke acties moet ik nog inplannen?',
      'Wat staat vandaag op mijn naam?',
      'Welke acties komen voort uit een signaal?',
      'Hoe rond ik een actie correct af?',
    ],
    tips: ['Een actie zonder datum staat op het bord maar niet in de agenda; plan hem in.'],
    navActions: ['open-planning', 'open-signalen'],
    insight: (c) => {
      const s = c.summary;
      if (s?.actiesOpen != null) {
        return `Je bekijkt ${s.actiesOpen} openstaande acties${s.actiesVerlopen ? `, waarvan ${s.actiesVerlopen} verlopen` : ''}.`;
      }
      return `Je bekijkt het actiecentrum over ${c.periodeLabel}.`;
    },
  },

  'agency-planning': {
    naam: 'Planning',
    doel: 'De agenda met dashboardacties, meetings en resultaatcontroles.',
    capabilities: ['Een item naar een andere dag slepen', 'Dag-, week- en maandweergave wisselen', 'Een resultaatcontrole terugvinden'],
    suggestedQuestions: [
      'Wat moet nog worden ingepland?',
      'Heeft iemand een planningsconflict?',
      'Welke resultaatcontroles staan gepland?',
      'Hoe sleep ik een actie naar de agenda?',
      'Welke acties lopen deze week af?',
    ],
    tips: ['Versleep een actie in de agenda; dat wijzigt de startdatum van de actie zelf.'],
    navActions: ['open-acties', 'open-signalen'],
    insight: (c) => `Je bekijkt de planning over ${c.periodeLabel}.`,
  },

  'agency-signals': {
    naam: 'Signalen',
    doel: 'Afwijkingen beoordelen en de opvolging starten: van signaal naar actie naar resultaatcontrole.',
    capabilities: [
      'Signalen filteren',
      'Een eigenaar toewijzen',
      'Een actie aanmaken',
      'Een actie direct inplannen',
      'Resultaatcontrole volgen',
    ],
    suggestedQuestions: [
      'Welke signalen moet ik eerst beoordelen?',
      'Hoe maak ik van een signaal een actie?',
      'Welke signalen zijn nog niet ingepland?',
      'Wat betekent betrouwbaarheid?',
      'Waar zie ik de opvolging van een signaal?',
    ],
    tips: ['Begin bij het signaal met de hoogste impact dat nog geen eigenaar of actie heeft.'],
    navActions: ['toon-nieuw', 'open-acties'],
    insight: (c) => {
      const s = c.summary;
      if (s?.signalenNieuw != null) {
        return `Je bekijkt ${s.signalenNieuw} nieuwe signalen die nog beoordeeld moeten worden.`;
      }
      return `Je bekijkt het signaalcentrum over ${c.periodeLabel}.`;
    },
  },

  'agency-insights': {
    naam: 'Inzichten',
    doel: 'Onderbouwde conclusies met bewijs en een voorgestelde actie.',
    capabilities: ['Inzichten lezen met hun bewijs', 'Een inzicht omzetten naar werk'],
    suggestedQuestions: ['Wat is het belangrijkste inzicht?', 'Waar is dit inzicht op gebaseerd?', 'Welke actie hoort hierbij?'],
    tips: ['Een inzicht zonder bewijs is een mening; kijk altijd naar de onderbouwing.'],
    navActions: ['open-acties'],
    insight: (c) => `Je bekijkt de inzichten over ${c.periodeLabel}.`,
  },

  'agency-reports': {
    naam: 'Rapportages',
    doel: 'De rapportages en hun onderdelen voor klanten.',
    capabilities: ['Rapportages bekijken', 'De samenwerking en bestanden zien'],
    suggestedQuestions: ['Wat staat er in een rapportage?', 'Wat is een logische volgende stap?'],
    tips: ['Een rapportage vertelt het verhaal achter de cijfers, niet alleen de cijfers.'],
    navActions: [],
    insight: (c) => `Je bekijkt de rapportages over ${c.periodeLabel}.`,
  },

  'agency-dataquality': {
    naam: 'Datakwaliteit',
    doel: 'De betrouwbaarheid van de meting: meetproblemen, ontbrekende koppelingen en versheid.',
    capabilities: ['Meetproblemen op impact bekijken', 'Zien welke resultaten onbetrouwbaar zijn', 'De laatste actualisatie controleren'],
    suggestedQuestions: [
      'Welke meetproblemen hebben de meeste impact?',
      'Welke resultaten zijn mogelijk onbetrouwbaar?',
      'Wanneer is de data voor het laatst bijgewerkt?',
      'Wat moet eerst worden opgelost?',
      'Welke koppelingen ontbreken?',
    ],
    tips: ['Los eerst een meetprobleem op dat een conclusie raakt; anders stuur je op ruis.'],
    navActions: ['open-integraties'],
    insight: (c) => c.summary?.dekkingProblemen != null
      ? `Je bekijkt de datakwaliteit over ${c.periodeLabel}: ${c.summary.dekkingProblemen} klanten met onvolledige dekking, ${c.summary.trackingProblemen ?? 0} met een trackingprobleem.`
      : `Je bekijkt de datakwaliteit over ${c.periodeLabel}.`,
  },

  'agency-integrations': {
    naam: 'Integraties',
    doel: 'De koppelstatus van kanalen, meetbronnen en de Aizy AI-assistent.',
    capabilities: ['Koppelstatus per bron bekijken', 'De assistent-instellingen openen'],
    suggestedQuestions: ['Welke koppelingen ontbreken?', 'Wat doet de Aizy AI-assistent?', 'Is er al een externe AI-provider gekoppeld?'],
    tips: ['De demo draait op vaste data; er staat geen knop die een koppeling suggereert die er niet is.'],
    navActions: ['open-assistent-instellingen'],
    insight: () => 'Je bekijkt de integraties, inclusief de Aizy AI-assistent (demo).',
  },

  'agency-settings': {
    naam: 'Instellingen',
    doel: 'Je account en de instellingen van deze omgeving.',
    capabilities: ['Thema wisselen', 'De demo resetten', 'De assistent instellen'],
    suggestedQuestions: ['Wat kan ik hier instellen?', 'Hoe stel ik de assistent in?'],
    tips: ['Een demo-reset zet acties, signalen en planning terug naar de uitgangssituatie.'],
    navActions: ['open-assistent-instellingen'],
    insight: () => 'Je bekijkt de instellingen van je account en omgeving.',
  },

  /* ---- Klantomgeving ---- */

  'client-overview': {
    naam: 'Samenvatting',
    doel: 'Het klantdashboard: resultaat, doelstellingen en de belangrijkste ontwikkelingen.',
    capabilities: ['De samenvatting lezen', 'Doelstellingen bekijken', 'Ontwikkelingen zien'],
    suggestedQuestions: [
      'Wat is de belangrijkste ontwikkeling?',
      'Zijn we op koers met de doelstellingen?',
      'Welk kanaal draagt het meeste bij?',
      'Leg de kosten per lead uit.',
    ],
    tips: ['Begin bij de samenvattingsstrip bovenaan; die vat status, resultaat en aandacht samen.'],
    navActions: ['open-analyse', 'open-samenwerking'],
    insight: (c) => `Je bekijkt het overzicht van ${c.clientName ?? 'de klant'} over ${c.periodeLabel}.`,
  },

  'client-analysis': {
    naam: 'Analyse',
    doel: 'De verdiepende analyse per onderwerp: leads, funnel, kosten, kwaliteit en campagnes.',
    capabilities: ['Per tab een onderwerp verdiepen', 'De funnel en kosten per lead bekijken'],
    suggestedQuestions: ['Waar zit de grootste uitval in de funnel?', 'Leg de kosten per lead uit.', 'Welke campagne presteert het best?'],
    tips: ['De tabs volgen het dashboardtype; een webshop toont andere tabs dan leadgen.'],
    navActions: ['open-samenwerking'],
    insight: (c) => `Je bekijkt de analyse van ${c.clientName ?? 'de klant'} over ${c.periodeLabel}.`,
  },

  'client-channels': {
    naam: 'Kanalen (klant)',
    doel: 'De kanaalprestaties van deze klant.',
    capabilities: ['Per kanaal de resultaten bekijken'],
    suggestedQuestions: ['Welk kanaal draagt het meeste bij?', 'Hoe wordt ROAS berekend?'],
    tips: ['Alleen gekoppelde kanalen staan in de navigatie; een leeg kanaal is geen informatie.'],
    navActions: [],
    insight: (c) => `Je bekijkt de kanalen van ${c.clientName ?? 'de klant'} over ${c.periodeLabel}.`,
  },

  'client-collaboration': {
    naam: 'Samenwerking',
    doel: 'De gedeelde acties, planning, notities en bestanden met het bureau.',
    capabilities: ['Gedeelde acties bekijken', 'De planning zien', 'Notities en bestanden raadplegen'],
    suggestedQuestions: ['Welke acties lopen er voor ons?', 'Wat staat er gepland?', 'Wat is de volgende stap?'],
    tips: ['Alleen bewust gedeelde acties verschijnen hier; interne acties blijven intern.'],
    navActions: ['open-rapportage'],
    insight: (c) => `Je bekijkt de samenwerking met ${c.clientName ?? 'de klant'}.`,
  },

  'client-report': {
    naam: 'Rapportage (klant)',
    doel: 'De inzichten, rapportages en datakwaliteit voor deze klant.',
    capabilities: ['Inzichten lezen', 'Rapportages bekijken', 'De datakwaliteit zien'],
    suggestedQuestions: ['Wat is het belangrijkste inzicht?', 'Hoe betrouwbaar is deze data?', 'Wat staat er in de rapportage?'],
    tips: ['Kijk bij twijfel eerst naar datakwaliteit; die bepaalt hoe hard een conclusie is.'],
    navActions: [],
    insight: (c) => `Je bekijkt de rapportage van ${c.clientName ?? 'de klant'} over ${c.periodeLabel}.`,
  },

  'client-users': {
    naam: 'Gebruikers (klant)',
    doel: 'De gebruikers binnen deze klantomgeving.',
    capabilities: ['Gebruikers bekijken en beheren'],
    suggestedQuestions: ['Wat kan ik hier doen?', 'Wie heeft welke toegang?'],
    tips: ['Een alleen-lezen gebruiker kan meekijken maar niets wijzigen.'],
    navActions: [],
    insight: () => 'Je bekijkt de gebruikers van deze klantomgeving.',
  },
};

/** Client-overzicht heeft tabvarianten met een eigen insight. */
const TAB_VARIANTEN = {
  'client-overview:doelstellingen': (basis) => ({
    ...basis,
    naam: 'Doelstellingen',
    insight: (c) => `Je bekijkt de doelstellingen van ${c.clientName ?? 'de klant'} over ${c.periodeLabel}.`,
    suggestedQuestions: ['Zijn we op koers?', 'Welke doelstelling loopt achter?', 'Wat is nodig om het doel te halen?'],
  }),
  'client-overview:ontwikkelingen': (basis) => ({
    ...basis,
    naam: 'Belangrijkste ontwikkelingen',
    insight: (c) => `Je bekijkt de belangrijkste ontwikkelingen van ${c.clientName ?? 'de klant'} over ${c.periodeLabel}.`,
    suggestedQuestions: ['Wat is de belangrijkste ontwikkeling?', 'Wat gaat goed?', 'Wat heeft aandacht nodig?'],
  }),
};

/**
 * De paginahulp voor een paginatype (route-naam), eventueel gespecialiseerd op
 * de actieve tab. Onbekende pagina's krijgen de standaardhulp.
 */
export function paginahulp(pageType, tab = null) {
  const sleutelMetTab = `${pageType}:${tab}`;
  if (TAB_VARIANTEN[sleutelMetTab]) {
    return TAB_VARIANTEN[sleutelMetTab](CATALOGUS[pageType] ?? STANDAARD);
  }
  return CATALOGUS[pageType] ?? STANDAARD;
}

export { CATALOGUS as PAGINAHULP_CATALOGUS };
