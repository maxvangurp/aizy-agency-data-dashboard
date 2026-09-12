/**
 * Portefeuille.
 *
 * De oude portefeuillepagina zette zes secties onder elkaar: KPI's, waar
 * aandacht nodig is, resultaten per type, portefeuille-indeling en signalen.
 * Drie daarvan toonden dezelfde klanten met een andere reden erbij. Wie
 * "Havenkwartier" zocht, kwam hem drie keer tegen en moest zelf uitzoeken of dat
 * drie problemen waren of één.
 *
 * Wat ervoor in de plaats komt:
 *
 *   Overzicht     de vijf cijfers die de dag bepalen, elk als ingang naar de
 *                 onderliggende lijst, met daaronder de top van de
 *                 prioriteitenlijst en een korte blik op de signalen.
 *   Prioriteiten  één lijst met alle klanten die aandacht vragen, met per klant
 *                 de reden, de ernst, de betrouwbaarheid van die conclusie, de
 *                 ouderdom en de eerstvolgende actie. Te filteren en te
 *                 groeperen in plaats van vooraf in acht vaste groepen gehakt.
 *   Resultaten    per dashboardtype gescheiden, want een gemiddelde ROAS over
 *                 leadgeneratieklanten bestaat niet.
 *
 * De volledige verwerking van signalen staat op de pagina Signalen. Hier staat
 * alleen wat je moet weten om te besluiten daarheen te gaan.
 */

import { BUSINESS_MODEL_LABELS, BusinessModel } from '../data/repository.js';
import { fmt, esc, badge, deltaTekst, ontbrekendeCel, metriekKolom } from './components.js';
import { renderPaginatabs, actieveTab } from '../ui/app-shell.js';
import { emptyState } from '../ui/states.js';
import { renderDataGrid } from '../ui/data-grid.js';
import { kanaalLabel, ADVERTENTIEKANAAL_KEYS } from '../filters/channels.js';
import { toonBereik, toonDatum, DEMO_TODAY } from '../filters/period.js';
import { dashboardtypeTerm, budgetstatusTerm, betrouwbaarheidTerm, Betrouwbaarheid, LABELS } from '../terminology.js';
import { DekkingStatus, PacingStatus } from '../data/selectors.js';
import { SignaalStatus } from '../model/signals.js';
import { ActieStatus } from '../model/actions.js';
import { tipTekstAttrs } from '../ui/tooltip.js';

/**
 * De factoren achter de status van een klant, als uitlegbare tooltip.
 * Een gekleurde badge zonder uitleg dwingt de lezer tot raden; deze popover
 * toont de doelen, het budget, de meting en de openstaande signalen die de
 * status bepaalden.
 */
export function statusUitlegAttr(s) {
  const factoren = [];
  const achter = (s.doelen ?? []).filter((d) => d.actueel != null && d.target != null && !doelGehaald(d));
  if (achter.length) factoren.push(`${achter.length} van ${(s.doelen ?? []).filter((d) => d.actueel != null).length} doelen onder doel`);
  else factoren.push('Alle meetbare doelen op of boven doel');
  if (s.client.trackingStatus === 'probleem') factoren.push(`Meting onvolledig: datakwaliteit ${s.client.dataHealth} procent`);
  if (s.budget?.status === PacingStatus.BOVEN_BUDGET) factoren.push('Budget boven planning');
  if (s.budget?.status === PacingStatus.ONDER_BUDGET) factoren.push('Budget onder planning');
  if ((s.openSignalen ?? 0) > 0) factoren.push(`${s.openSignalen} openstaand signaal`);
  return tipTekstAttrs(`Waarom ${s.status.label.toLowerCase()}?`, factoren);
}

function doelGehaald(d) {
  if (d.richting === 'binnen' || d.richting === 'lager') return d.actueel <= d.target;
  return d.actueel >= d.target;
}

export const PORTEFEUILLE_TABS = [
  { key: 'overzicht', label: 'Overzicht' },
  { key: 'prioriteiten', label: 'Prioriteiten' },
  { key: 'resultaten', label: 'Resultaten' },
];

export const RESULTAAT_TABS = [
  { key: 'leadgen', label: 'Leadgeneratie' },
  { key: 'ecommerce', label: 'E-commerce' },
  { key: 'awareness', label: 'Awareness' },
];

/* ---------------------------------------------------------------
   Prioriteitsregels
   --------------------------------------------------------------- */

/**
 * Hoe zeker de conclusie over deze klant is.
 *
 * Een klant met een trackingprobleem staat bovenaan omdat er iets mis is, niet
 * omdat het resultaat slecht is. Zonder deze kolom zou de lijst een zekerheid
 * suggereren die de meting niet levert.
 */
export function betrouwbaarheidVan(s) {
  if (s.dekking?.status === DekkingStatus.GEEN_DATA) return Betrouwbaarheid.ONVOLDOENDE;
  if (s.client.trackingStatus === 'probleem') return Betrouwbaarheid.BEPERKT;
  if (s.dekking?.status === DekkingStatus.GEDEELTELIJK) return Betrouwbaarheid.BEPERKT;
  if (!s.deltas || !Object.keys(s.deltas).length) return Betrouwbaarheid.REDELIJK;
  return Betrouwbaarheid.HOOG;
}

/**
 * De belangrijkste reden dat deze klant aandacht vraagt.
 * De prioriteitsberekening levert alle redenen; hier wordt de eerste gekozen,
 * want die weegt het zwaarst en een lijst leest alleen als er één regel staat.
 */
export function hoofdreden(s) {
  return s.prioriteit?.redenen?.[0] ?? s.status?.reden ?? 'Geen bijzonderheden binnen deze selectie.';
}

/**
 * De eerstvolgende actie voor deze klant.
 * Wanneer er werk klaarstaat, staat dat er. Staat er niets klaar, dan zegt de
 * kolom dat er nog niets is ingepland; dat is informatie en geen leegte.
 */
export function volgendeActieVan(s, acties) {
  const eigen = acties
    .filter((a) => a.klantId === s.client.id && a.status !== ActieStatus.AFGEROND)
    .sort((a, b) => (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999'));
  return eigen[0] ?? null;
}

/** De ouderdom van het probleem, in dagen, uit het oudste open signaal. */
export function ouderdomVan(s, signalen) {
  const eigen = signalen.filter((sig) => sig.klantId === s.client.id && sig.open);
  if (!eigen.length) return null;
  return Math.max(...eigen.map((sig) => sig.ouderdomDagen ?? 0));
}

/* ---------------------------------------------------------------
   Tabeldefinitie
   --------------------------------------------------------------- */

/**
 * De definitie van de prioriteitenlijst.
 *
 * De ingebouwde weergaven aan het einde zijn de opvolgers van de oude
 * "Portefeuille-indeling": in plaats van acht vaste blokken onder elkaar is het
 * nu één lijst met acht startpunten. De informatie is dezelfde, de herhaling is
 * weg.
 */
export function prioriteitenDefinitie({
  acties, signalen, medewerkers, userId, id = 'portefeuille', pagina = 'portfolio',
}) {
  const kolom = (key, label, opties = {}) => ({ key, label, ...opties });

  return {
    id,
    pagina,
    titel: 'Klanten op prioriteit',
    omschrijving: 'Alle klanten waartoe je toegang hebt, op volgorde van aandacht.',
    rijId: (s) => s.client.id,
    zoektekst: (s) => `${s.client.name} ${s.team.primair?.displayName ?? ''} ${hoofdreden(s)}`,
    standaardSortering: { key: 'ernst', richting: 'af' },

    kolommen: [
      kolom('klant', LABELS.klant, {
        verplicht: true,
        vast: true,
        waarde: (s) => s.client.name,
        // Twee verschillende handelingen die er identiek uitzagen: de naam opent
        // een paneel naast de lijst, "Openen" navigeert naar de klantpagina.
        // Allebei blauw en onderstreept, naast elkaar, zonder enig verschil in
        // vorm -- dus klikte je op de naam en kreeg je niet wat je verwachtte.
        // De naam meldt nu dat hij een paneel opent, de link zegt waar hij heen
        // gaat, en allebei dragen ze de klantnaam in hun toegankelijke naam.
        // In live modus reist er één voorbeeldklant mee als controle (zie
        // `clients-bron.js`). Die staat hier tussen echte klanten, met verzonnen
        // omzet en een verzonnen meetstatus, en moet dus als zodanig te zien
        // zijn -- zeker in een lijst waaruit mensen cijfers overnemen.
        cel: (s) => `<button type="button" class="link cel-klant" data-klantpaneel="${esc(s.client.id)}"
            aria-haspopup="dialog" aria-label="${esc(`${s.client.name}: details in het zijpaneel`)}">${esc(s.client.name)}</button>
          ${s.client.demo ? badge('Demo', 'muted') : ''}
          <a class="link-klein cel-klant-pagina" href="#/agency/clients/${esc(s.client.id)}"
            aria-label="${esc(`${s.client.name}: naar de klantpagina`)}">Klantpagina <span aria-hidden="true">→</span></a>`,
      }),
      kolom('type', LABELS.dashboardtype, {
        waarde: (s) => dashboardtypeTerm(s.model).kort,
        groepeerbaar: true,
        cel: (s) => badge(dashboardtypeTerm(s.model).kort, 'muted'),
      }),
      kolom('verantwoordelijke', LABELS.verantwoordelijke, {
        waarde: (s) => s.team.primair?.displayName ?? null,
        groepWaarde: (s) => s.team.primair?.displayName ?? 'Niet toegewezen',
        groepeerbaar: true,
        cel: (s) => (s.team.primair
          ? `<span title="${esc(s.team.primair.jobTitle ?? '')}">${esc(s.team.primair.displayName)}</span>`
          : ontbrekendeCel('niet_van_toepassing')),
      }),
      kolom('reden', 'Belangrijkste reden', {
        waarde: (s) => hoofdreden(s),
        breedte: 320,
        cel: (s) => `<span class="cel-reden">${esc(hoofdreden(s))}</span>`,
      }),
      kolom('status', 'Status', {
        waarde: (s) => s.status.label,
        groepWaarde: (s) => s.status.label,
        groepeerbaar: true,
        // Alleen de badge. De reden stond hier als volzin terwijl de kolom
        // ernaast, "Belangrijkste reden", de onderbouwing al draagt en
        // `statusUitlegAttr` hem hiernaast in een rijkere vorm in de tooltip
        // zet. Die derde kopie maakte iedere rij drie regels hoog en de tabel
        // tweemaal de schermbreedte, waardoor Ernst en alles erachter buiten
        // beeld viel.
        //
        // Let op: die twee zinnen wáren niet identiek. `hoofdreden` komt uit
        // `prioriteit.redenen`, en daar ontbrak het gevolg ("waardoor de cijfers
        // onbetrouwbaar zijn") dat alleen in `status.reden` stond. Deze cel
        // weghalen liet dat gevolg dus nergens meer staan. Het is nu aan de
        // prioriteitsreden zelf toegevoegd (zie `bepaalPrioriteit`), waar het
        // hoort -- en niet als derde kopie hier.
        cel: (s) => `<span ${statusUitlegAttr(s)}>${badge(s.status.label, s.status.variant)}</span>`,
      }),
      kolom('ernst', 'Ernst', {
        waarde: (s) => s.prioriteit.punten,
        groepWaarde: (s) => s.prioriteit.label,
        groepeerbaar: true,
        uitlijning: 'links',
        cel: (s) => badge(s.prioriteit.label, s.prioriteit.variant),
      }),
      kolom('betrouwbaarheid', LABELS.betrouwbaarheid, {
        waarde: (s) => betrouwbaarheidTerm(betrouwbaarheidVan(s)).kort,
        groepeerbaar: true,
        cel: (s) => {
          const term = betrouwbaarheidTerm(betrouwbaarheidVan(s));
          return `<span class="badge badge-${esc(term.variant)}" title="${esc(term.omschrijving)}">${esc(term.kort)}</span>`;
        },
      }),
      kolom('ouderdom', 'Ouderdom of deadline', {
        waarde: (s) => ouderdomVan(s, signalen) ?? -1,
        cel: (s) => {
          const dagen = ouderdomVan(s, signalen);
          const actie = volgendeActieVan(s, acties);
          if (dagen == null && !actie?.deadline) return '<span class="muted klein">Geen deadline</span>';
          return `${dagen != null ? `<span>${dagen} ${dagen === 1 ? 'dag' : 'dagen'} open</span>` : ''}
            ${actie?.deadline ? `<br><span class="muted klein">Deadline ${esc(toonDatum(actie.deadline))}</span>` : ''}`;
        },
      }),
      kolom('volgende', 'Eerstvolgende actie', {
        waarde: (s) => volgendeActieVan(s, acties)?.titel ?? null,
        breedte: 260,
        cel: (s) => {
          const actie = volgendeActieVan(s, acties);
          if (!actie) {
            return `<button type="button" class="link-klein" data-nieuweactie="${esc(s.client.id)}">Actie aanmaken</button>`;
          }
          return `<button type="button" class="link" data-actiepaneel="${esc(actie.id)}">${esc(actie.titel)}</button>
            <br><span class="muted klein">${esc(actie.statusTerm.kort)}</span>`;
        },
      }),
      kolom('spend', 'Advertentie-uitgaven', {
        uitlijning: 'rechts',
        waarde: (s) => s.totalen.spend ?? null,
        cel: (s) => fmt.euro(s.totalen.spend),
      }),
      kolom('budget', 'Budgetbesteding', {
        standaard: false,
        uitlijning: 'rechts',
        waarde: (s) => s.budget.besteedPercentage ?? null,
        cel: (s) => (s.budget.besteedPercentage == null
          ? ontbrekendeCel('niet_gemeten')
          : `<span class="${s.budget.status === PacingStatus.BOVEN_BUDGET ? 'trend-negatief' : 'trend-positief'}">${fmt.procent(s.budget.besteedPercentage)}</span>
             <br><span class="muted klein">${esc(budgetstatusTerm(s.budget.status).kort)}</span>`),
      }),
      kolom('datakwaliteit', LABELS.datakwaliteit, {
        standaard: false,
        uitlijning: 'rechts',
        waarde: (s) => s.client.dataHealth,
        cel: (s) => `${s.client.dataHealth} procent<br><span class="muted klein">${s.dekking.dagenMetData} van ${s.dekking.totaalDagen} dagen</span>`,
      }),
      kolom('kanalen', LABELS.kanalen, {
        standaard: false,
        sorteerbaar: false,
        waarde: (s) => s.kanalen.map(kanaalLabel).join(', '),
        cel: (s) => `<span class="muted klein">${esc(s.kanalen.map(kanaalLabel).join(', ') || 'Geen kanaal geselecteerd')}</span>`,
      }),
      kolom('signalen', 'Open signalen', {
        standaard: false,
        uitlijning: 'rechts',
        waarde: (s) => s.openSignalen ?? 0,
        cel: (s) => String(s.openSignalen ?? 0),
      }),
    ],

    filters: [
      {
        key: 'urgentie',
        label: 'Urgentie',
        opties: [
          { waarde: 'direct', label: 'Vandaag oppakken' },
          { waarde: 'binnenkort', label: 'Deze week bekijken' },
          { waarde: 'geen', label: 'Geen aandachtspunten' },
        ],
        test: (s, waarde) => s.prioriteit.niveau === waarde,
      },
      {
        key: 'type',
        label: LABELS.dashboardtype,
        opties: Object.entries(BUSINESS_MODEL_LABELS)
          .filter(([key]) => ['leadgen', 'ecommerce', 'awareness'].includes(key))
          .map(([waarde, label]) => ({ waarde, label })),
        test: (s, waarde) => s.client.businessModel === waarde,
      },
      {
        key: 'medewerker',
        label: LABELS.verantwoordelijke,
        opties: medewerkers.map((m) => ({ waarde: m.id, label: m.displayName })),
        test: (s, waarde) => s.client.primaryOwnerId === waarde,
      },
      {
        key: 'kanaal',
        label: LABELS.kanalen,
        opties: ADVERTENTIEKANAAL_KEYS.map((k) => ({ waarde: k, label: kanaalLabel(k) })),
        test: (s, waarde) => (s.kanalen ?? []).includes(waarde),
      },
      {
        key: 'meetkwaliteit',
        label: 'Meetkwaliteit',
        opties: [
          { waarde: 'probleem', label: 'Meting onvolledig' },
          { waarde: 'controle-aanbevolen', label: 'Meting controleren' },
          { waarde: 'gezond', label: 'Meting volledig' },
          { waarde: 'geen-crm', label: 'Zonder CRM-koppeling' },
          { waarde: 'gedeeltelijk', label: 'Onvolledige dekking' },
        ],
        test: (s, waarde) => {
          if (waarde === 'geen-crm') {
            return s.client.businessModel === BusinessModel.LEADGEN && s.totalen.qualifiedLeads == null;
          }
          if (waarde === 'gedeeltelijk') return s.dekking.status === DekkingStatus.GEDEELTELIJK;
          return s.client.trackingStatus === waarde;
        },
      },
      {
        key: 'budgetstatus',
        label: 'Budgetstatus',
        opties: [
          { waarde: PacingStatus.BOVEN_BUDGET, label: 'Boven budget' },
          { waarde: PacingStatus.ONDER_BUDGET, label: 'Onder budget' },
          { waarde: PacingStatus.OP_SCHEMA, label: 'Op schema' },
        ],
        test: (s, waarde) => s.budget.status === waarde,
      },
      {
        key: 'betrokken',
        label: 'Mijn betrokkenheid',
        opties: [
          { waarde: 'verantwoordelijk', label: 'Ik ben verantwoordelijk' },
          { waarde: 'ondersteunend', label: 'Ik ondersteun' },
        ],
        test: (s, waarde) => (waarde === 'verantwoordelijk'
          ? s.client.primaryOwnerId === userId
          : (s.client.supportingOwnerIds ?? []).includes(userId)),
      },
    ],

    weergaven: [
      { id: 'mijn-klanten', naam: 'Mijn klanten', staat: { filters: { betrokken: 'verantwoordelijk' } } },
      { id: 'hoge-prioriteit', naam: 'Hoge prioriteit', staat: { filters: { urgentie: 'direct' } } },
      { id: 'boven-budget', naam: 'Boven budget', staat: { filters: { budgetstatus: PacingStatus.BOVEN_BUDGET } } },
      { id: 'meetprobleem', naam: 'Meetprobleem', staat: { filters: { meetkwaliteit: 'probleem' } } },
      { id: 'zonder-crm', naam: 'Zonder CRM-koppeling', staat: { filters: { meetkwaliteit: 'geen-crm' } } },
      { id: 'onvolledige-meting', naam: 'Onvolledige meting', staat: { filters: { meetkwaliteit: 'gedeeltelijk' } } },
      { id: 'google-ads', naam: 'Google Ads', staat: { filters: { kanaal: 'google_ads' } } },
      {
        id: 'deze-week',
        naam: 'Deze week controleren',
        staat: { filters: { urgentie: 'binnenkort' }, groepering: 'verantwoordelijke' },
      },
    ],

    bulkacties: [
      { id: 'actie-aanmaken', label: 'Actie aanmaken voor selectie' },
      { id: 'open-signalen', label: 'Signalen van selectie bekijken' },
    ],
  };
}

/* ---------------------------------------------------------------
   Weergave
   --------------------------------------------------------------- */

export function renderPortefeuille(user, {
  overview, acties, signalen, definitie, tab, gridStaat, gridVerwerkt, gridWeergaven,
  gridSelectie, weergavevorm, resultaatTab, hashVoor,
}) {
  const actief = actieveTab(PORTEFEUILLE_TABS, tab);

  if (!overview.aantalKlanten) {
    return emptyState({
      titel: 'Er zijn nog geen klanten aan je account toegewezen',
      uitleg: 'Een agencybeheerder kan klanten aan je portefeuille toevoegen. Zodra dat is gebeurd, verschijnen ze hier met hun resultaten en aandachtspunten.',
      id: 'geenKlanten',
    });
  }

  if (actief === 'prioriteiten') {
    return renderPrioriteiten({
      acties, signalen, definitie,
      gridStaat, gridVerwerkt, gridWeergaven, gridSelectie, weergavevorm,
    });
  }

  if (actief === 'resultaten') {
    return renderResultaten(overview, resultaatTab, hashVoor);
  }

  return renderOverzicht({ overview, acties, signalen, hashVoor });
}

/* ---------------------------------------------------------------
   Tab: overzicht
   --------------------------------------------------------------- */

/**
 * Een KPI die ergens heen gaat.
 *
 * Een cijfer waar je niet op kunt klikken, dwingt de lezer om zelf te bedenken
 * welke lijst erbij hoort. Iedere kaart hier opent de prioriteitenlijst met
 * precies het filter dat het cijfer verklaart.
 *
 * **De definitie staat in een tooltip en niet in de kaart.** Hij stond hier als
 * vaste alinea onder ieder cijfer. Dat is nuttig op dag één en ruis op dag twee,
 * en het kostte per kaart ruim honderd pixels -- samen genoeg om "Waar aandacht
 * nodig is" onder de vouw te duwen. Dat is de omgekeerde wereld: de uitleg van
 * een KPI stond boven het werk dat eruit volgt. De uitleg is er nog, via
 * dezelfde `data-tip-text` die de kolomkoppen en de simpele modus al gebruiken:
 * zichtbaar bij hover, bij toetsenbordfocus en bij een tik, en gekoppeld met
 * aria-describedby.
 *
 * De tip hangt aan de kaart zodra die klikbaar is, en anders aan het label. Een
 * focusbaar element binnen een link zou een tweede tabstop opleveren voor
 * dezelfde informatie; `simpel-widgets.js` legt diezelfde regel vast.
 */
function kpiKaart({ label, waarde, sub, richting = 'neutraal', uitleg = '', href = null, teller = null }) {
  const tipOpLabel = uitleg && !href
    ? ` data-tip-text="${esc(uitleg)}" data-tip-title="${esc(label)}" tabindex="0"`
    : '';
  const binnen = `
    <span class="kpi-label${uitleg ? ' kpi-label-tip' : ''}"${tipOpLabel}>${esc(label)}${uitleg ? ' <span class="kpi-info" aria-hidden="true">i</span>' : ''}</span>
    <span class="kpi-value">${esc(waarde)}</span>
    <span class="kpi-sub trend-${esc(richting)}">${esc(sub)}</span>`;

  if (!href) {
    return `<article class="card kpi" data-label="${esc(label)}">${binnen}</article>`;
  }
  // Een expliciete naam op de link. Zonder deze regel heten alle vijf de kaarten
  // "Onderliggende lijst openen", en leest een screenreader de hele definitie
  // mee als linktekst.
  const tipOpKaart = uitleg ? ` data-tip-text="${esc(uitleg)}" data-tip-title="${esc(label)}"` : '';
  return `<a class="card kpi kpi-klikbaar" data-label="${esc(label)}" href="${esc(href)}"
    aria-label="${esc(`${label}: ${waarde}. ${sub}. Open de onderliggende lijst.`)}"${tipOpKaart}
    ${teller != null ? `data-teller="${teller}"` : ''}>${binnen}
    <span class="kpi-ingang" aria-hidden="true">Onderliggende lijst openen →</span></a>`;
}

function renderOverzicht({ overview, acties, signalen, hashVoor }) {
  const label = overview.filters.vergelijkingActief
    ? overview.filters.vergelijking.label.toLowerCase()
    : 'de vorige periode';

  const aandacht = overview.portefeuille.opPrioriteit.filter((s) => s.prioriteit.niveau !== 'geen');
  const nieuweSignalen = signalen.filter((s) => s.status === SignaalStatus.NIEUW);

  // Niet elke klant valt in "op koers" of "onder doel": een klant zonder doelen,
  // zonder meetbaar resultaat of met een kapotte meting krijgt geen oordeel. Die
  // vielen hier stil weg, en dan telde de subtekst niet op tot het cijfer
  // erboven -- zeven klanten, drie plus twee eronder. Wie dat opmerkt, gaat aan
  // de rest van de cijfers twijfelen, en terecht.
  const zonderOordeel = Math.max(0, overview.aantalKlanten - overview.opKoers - overview.aandachtNodig);

  return `
    <div class="kpi-row kpi-row-5">
      ${kpiKaart({
        label: 'Actieve klanten',
        waarde: fmt.getal(overview.aantalKlanten),
        sub: [
          `${overview.opKoers} op koers`,
          `${overview.aandachtNodig} onder doel`,
          zonderOordeel ? `${zonderOordeel} nog niet te beoordelen` : null,
        ].filter(Boolean).join(', '),
        uitleg: 'Het aantal klanten waartoe dit account toegang heeft. Een klant zonder doelen, zonder meetbaar resultaat of met een onbetrouwbare meting krijgt geen oordeel en telt apart.',
        href: hashVoor('prioriteiten'),
      })}
      ${kpiKaart({
        label: 'Advertentie-uitgaven',
        waarde: fmt.euro(overview.totaleSpend),
        sub: deltaTekst(overview.deltas.spend, label) || `van ${fmt.euro(overview.totaalBudget)} budget`,
        richting: overview.deltas.spend?.richting ?? 'neutraal',
        uitleg: 'De uitgaven over alle toegankelijke klanten binnen de geselecteerde periode en kanalen.',
        href: `${hashVoor('prioriteiten')}&sorteer=spend`,
      })}
      ${kpiKaart({
        label: 'Budgetbesteding',
        waarde: overview.pacing == null ? 'Niet beschikbaar' : fmt.procent(overview.pacing),
        sub: overview.pacing == null
          ? 'Geen budget vastgelegd'
          : `${fmt.euro(overview.totaleSpend)} van ${fmt.euro(overview.totaalBudget)} voor deze periode`,
        richting: overview.pacing == null ? 'neutraal' : overview.pacing > 105 ? 'negatief' : 'positief',
        uitleg: 'Het deel van het budget voor deze periode dat is besteed. Het maandbudget wordt naar rato omgerekend.',
        href: `${hashVoor('prioriteiten')}&groep=budgetstatus`,
      })}
      ${kpiKaart({
        label: 'Klanten met aandacht',
        waarde: fmt.getal(aandacht.length),
        sub: aandacht.length ? 'vragen deze week om een besluit' : 'alles ligt op koers',
        richting: aandacht.length ? 'negatief' : 'positief',
        uitleg: 'Klanten met een afwijking, een budgetprobleem of een onvolledige meting.',
        href: `${hashVoor('prioriteiten')}&filter=urgentie`,
      })}
      ${kpiKaart({
        label: 'Meetproblemen',
        waarde: fmt.getal(overview.trackingProblemen),
        // Het cijfer telt trackingproblemen, de subtekst ging over dekking. Twee
        // verschillende dingen, en bij twee trackingproblemen en nul gaten in de
        // dekking stond er letterlijk "2 -- alle metingen volledig". Een kaart
        // die zichzelf tegenspreekt kost meer vertrouwen dan hij aan inzicht
        // oplevert. De subtekst gaat nu over hetzelfde cijfer, en de dekking
        // komt er alleen bij als er echt iets aan mankeert.
        sub: [
          overview.trackingProblemen ? 'cijfers onbetrouwbaar' : null,
          overview.onvolledigeDekking ? `${overview.onvolledigeDekking} met onvolledige dekking` : null,
        ].filter(Boolean).join(' · ') || 'alle metingen volledig',
        richting: overview.trackingProblemen || overview.onvolledigeDekking ? 'negatief' : 'positief',
        uitleg: 'Klanten waarvan de meting onbetrouwbaar is. Onvolledige dekking is iets anders: dan mist er data over een deel van de periode.',
        href: `${hashVoor('prioriteiten')}&filter=meetkwaliteit`,
      })}
    </div>

    ${renderWerkvolgorde(aandacht, acties, signalen, hashVoor)}
    ${renderSignaalpreview(nieuweSignalen, signalen)}`;
}

/**
 * De top van de prioriteitenlijst.
 *
 * Vijf klanten, met de reden erbij. Wie meer wil, gaat naar de tab
 * Prioriteiten; die staat er als link onder in plaats van dat de lijst hier
 * doorloopt tot de pagina niet meer past.
 */
function renderWerkvolgorde(aandacht, acties, signalen, hashVoor) {
  if (!aandacht.length) {
    return `<section class="card" id="werkvolgorde">
      <h2>Waar aandacht nodig is</h2>
      ${emptyState({
        titel: 'Binnen deze selectie liggen alle klanten op koers',
        uitleg: 'De meting is volledig en er zijn geen afwijkingen groter dan de drempel.',
      })}
    </section>`;
  }

  return `<section class="card" id="werkvolgorde">
    <div class="kaart-kop">
      <h2>Waar aandacht nodig is</h2>
      <a class="btn klein" href="${esc(hashVoor('prioriteiten'))}">Alle ${aandacht.length} bekijken</a>
    </div>
    <p class="muted">
      Gesorteerd op de omvang van de afwijking, het volume waarop die rust en de
      volledigheid van de meting. De redenen staan erbij, zodat de volgorde
      navolgbaar is.
    </p>
    <ol class="werkvolgorde">
      ${aandacht.slice(0, 5).map((s) => {
        const actie = volgendeActieVan(s, acties);
        const term = betrouwbaarheidTerm(betrouwbaarheidVan(s));
        const dagen = ouderdomVan(s, signalen);

        return `<li class="werkvolgorde-item">
          <div class="werkvolgorde-kop">
            <button type="button" class="link" data-klantpaneel="${esc(s.client.id)}">${esc(s.client.name)}</button>
            ${badge(dashboardtypeTerm(s.model).kort, 'muted')}
            ${badge(s.prioriteit.label, s.prioriteit.variant)}
            <span class="badge badge-${esc(term.variant)}" title="${esc(term.omschrijving)}">${esc(term.kort)}</span>
            ${dagen != null ? `<span class="muted klein">${dagen} ${dagen === 1 ? 'dag' : 'dagen'} open</span>` : ''}
          </div>
          <p class="eyebrow">${esc(LABELS.waaromAandacht)}</p>
          <ul class="prioriteit-redenen">
            ${s.prioriteit.redenen.map((r) => `<li>${esc(r)}</li>`).join('')}
          </ul>
          <p class="klein muted">
            ${esc(LABELS.verantwoordelijke)}: ${esc(s.team.primair?.displayName ?? 'niet toegewezen')}
            ${actie ? ` · Eerstvolgende actie: ${esc(actie.titel)}` : ' · Nog geen actie ingepland'}
          </p>
        </li>`;
      }).join('')}
    </ol>
  </section>`;
}

/**
 * Een korte blik op de signalen.
 * Geen verwerking, geen knoppen om iets af te handelen: dat gebeurt op de
 * pagina Signalen. Twee plekken waar hetzelfde signaal kan worden afgehandeld,
 * levert onvermijdelijk twee verschillende waarheden op.
 */
function renderSignaalpreview(nieuwe, alle) {
  const urgent = alle.filter((s) => s.open && s.ernst === 'hoog');
  const teTonen = [...nieuwe, ...urgent.filter((s) => !nieuwe.includes(s))].slice(0, 3);

  return `<section class="card" id="signaalpreview">
    <div class="kaart-kop">
      <h2>Signalen</h2>
      <a class="btn klein" href="#/agency/signals">Naar het signaalcentrum</a>
    </div>
    ${!teTonen.length
      ? emptyState({
        titel: 'Geen nieuwe of urgente signalen',
        uitleg: 'Binnen deze periode en kanaalselectie staat er niets open dat direct aandacht vraagt.',
      })
      : `<ul class="signaal-preview">
          ${teTonen.map((s) => `<li>
            <div class="signaal-preview-kop">
              ${badge(s.ernst === 'hoog' ? 'Hoge urgentie' : 'Gemiddelde urgentie', s.ernst === 'hoog' ? 'hoog' : 'middel')}
              ${badge(s.statusTerm.kort, s.statusTerm.variant)}
              <strong>${esc(s.klantNaam)}</strong>
              <span class="muted klein">${esc(s.kanaalLabel)}</span>
            </div>
            <p class="signaal-preview-tekst">${esc(s.probleem)}</p>
          </li>`).join('')}
        </ul>
        <p class="muted klein">${alle.filter((s) => s.open).length} signalen staan open. Verwerken doe je in het signaalcentrum.</p>`}
  </section>`;
}

/* ---------------------------------------------------------------
   Tab: prioriteiten
   --------------------------------------------------------------- */

export function renderPrioriteiten({
  acties, signalen, definitie,
  gridStaat, gridVerwerkt, gridWeergaven, gridSelectie, weergavevorm,
}) {
  return `
    <div class="weergavekiezer" role="group" aria-label="Weergavevorm">
      <button type="button" class="btn klein${weergavevorm === 'lijst' ? ' primary' : ''}"
        data-weergavevorm="lijst" aria-pressed="${weergavevorm === 'lijst'}">Lijstweergave</button>
      <button type="button" class="btn klein${weergavevorm === 'kaarten' ? ' primary' : ''}"
        data-weergavevorm="kaarten" aria-pressed="${weergavevorm === 'kaarten'}">Kaartweergave</button>
    </div>

    ${weergavevorm === 'kaarten'
      ? renderKaarten(gridVerwerkt, acties, signalen)
      : renderDataGrid({
        definitie,
        staat: gridStaat,
        verwerkt: gridVerwerkt,
        selectie: gridSelectie,
        weergaven: gridWeergaven,
        leegTitel: 'Geen klanten met deze filters',
        leegUitleg: 'Pas de filters of de zoekterm aan, of kies een andere periode.',
      })}`;
}

/** Compacte kaartweergave van dezelfde rijen, voor wie liever scant dan leest. */
function renderKaarten(verwerkt, acties, signalen) {
  const rijen = verwerkt.groepen ? verwerkt.groepen.flatMap((g) => g.items) : verwerkt.zichtbaar;

  if (!rijen.length) {
    return emptyState({
      titel: 'Geen klanten met deze filters',
      uitleg: 'Pas de filters of de zoekterm aan, of kies een andere periode.',
      id: 'portefeuilleLeeg',
    });
  }

  return `<div class="klantkaarten">
    ${rijen.map((s) => {
      const term = betrouwbaarheidTerm(betrouwbaarheidVan(s));
      const actie = volgendeActieVan(s, acties);
      const dagen = ouderdomVan(s, signalen);

      return `<article class="card klantkaart" data-klant="${esc(s.client.id)}">
        <div class="klantkaart-kop">
          <button type="button" class="link" data-klantpaneel="${esc(s.client.id)}">${esc(s.client.name)}</button>
          ${badge(s.prioriteit.label, s.prioriteit.variant)}
        </div>
        <div class="klantkaart-labels">
          ${badge(dashboardtypeTerm(s.model).kort, 'muted')}
          <span class="badge badge-${esc(term.variant)}" title="${esc(term.omschrijving)}">${esc(term.kort)}</span>
          ${dagen != null ? badge(`${dagen} ${dagen === 1 ? 'dag' : 'dagen'} open`, 'muted') : ''}
        </div>
        <p class="klantkaart-reden">${esc(hoofdreden(s))}</p>
        <dl class="klantkaart-meta">
          <div><dt>${esc(LABELS.verantwoordelijke)}</dt><dd>${esc(s.team.primair?.displayName ?? 'Niet toegewezen')}</dd></div>
          <div><dt>Eerstvolgende actie</dt><dd>${actie ? esc(actie.titel) : 'Nog niets ingepland'}</dd></div>
        </dl>
      </article>`;
    }).join('')}
  </div>`;
}

/* ---------------------------------------------------------------
   Tab: resultaten
   --------------------------------------------------------------- */

/**
 * Resultaten per dashboardtype, in aparte tabs.
 *
 * Inhoudelijk verschillende resultaten worden niet bij elkaar opgeteld: een
 * gemiddelde ROAS over leadgeneratieklanten bestaat niet en een gemiddelde CPL
 * over webshops evenmin.
 */
function renderResultaten(overview, resultaatTab, hashVoor) {
  const aanwezig = RESULTAAT_TABS.filter((t) => {
    if (t.key === 'ecommerce') return overview.ecommerce.aantal > 0;
    if (t.key === 'leadgen') return overview.leadgen.aantal > 0;
    return overview.overig.aantal > 0;
  });

  if (!aanwezig.length) {
    return emptyState({
      titel: 'Geen resultaten binnen deze selectie',
      uitleg: 'Er zijn geen klanten met gegevens in deze periode en kanaalselectie.',
    });
  }

  const actief = aanwezig.some((t) => t.key === resultaatTab) ? resultaatTab : aanwezig[0].key;
  const label = overview.filters.vergelijkingActief
    ? overview.filters.vergelijking.label.toLowerCase()
    : 'de vorige periode';

  const inhoud = {
    leadgen: () => `
      <div class="kpi-row">
        ${kpiKaart({
          label: 'Leads',
          waarde: fmt.getal(overview.leadgen.leads),
          sub: deltaTekst(overview.deltas.leads, label) || 'deze periode',
          richting: overview.deltas.leads?.richting ?? 'neutraal',
        })}
        ${kpiKaart({
          label: 'Gemiddelde kosten per lead',
          waarde: overview.leadgen.gemiddeldeCpl == null ? 'Onvoldoende data' : fmt.euro2(overview.leadgen.gemiddeldeCpl),
          sub: `gemiddeld over ${overview.leadgen.aantal} leadgeneratieklanten`,
          uitleg: 'Kosten per lead, gemiddeld over de leadgeneratieklanten. Niet vergelijkbaar met een ROAS.',
        })}
        ${kpiKaart({
          label: 'Zonder CRM-koppeling',
          waarde: fmt.getal(overview.leadgen.zonderKwalificatie),
          sub: overview.leadgen.zonderKwalificatie ? 'leadkwaliteit niet meetbaar' : 'alle klanten gekoppeld',
          richting: overview.leadgen.zonderKwalificatie ? 'negatief' : 'positief',
          href: `${hashVoor('prioriteiten')}&filter=meetkwaliteit`,
        })}
      </div>`,
    ecommerce: () => `
      <div class="kpi-row">
        ${kpiKaart({
          label: 'Omzet',
          waarde: fmt.euro(overview.ecommerce.omzet),
          sub: deltaTekst(overview.deltas.revenue, label) || 'deze periode',
          richting: overview.deltas.revenue?.richting ?? 'neutraal',
        })}
        ${kpiKaart({
          label: 'Transacties',
          waarde: fmt.getal(overview.ecommerce.aankopen),
          sub: deltaTekst(overview.deltas.purchases, label) || 'deze periode',
          richting: overview.deltas.purchases?.richting ?? 'neutraal',
        })}
        ${kpiKaart({
          label: 'Gemiddeld rendement',
          waarde: overview.ecommerce.gemiddeldeRoas == null ? 'Onvoldoende data' : fmt.ratio(overview.ecommerce.gemiddeldeRoas),
          sub: `gemiddeld over ${overview.ecommerce.aantal} e-commerceklanten`,
          uitleg: 'Rendement op advertentie-uitgaven: omzet gedeeld door advertentiekosten.',
        })}
      </div>`,
    awareness: () => `
      <div class="kpi-row">
        ${kpiKaart({
          label: 'Awarenessklanten',
          waarde: fmt.getal(overview.overig.aantal),
          sub: 'beoordeeld op bereik en aandacht',
          uitleg: 'Een awarenessdashboard wordt niet op kosten per lead of rendement beoordeeld.',
        })}
      </div>
      <p class="muted note">
        Voor awareness gelden bereik, frequentie en videoprestaties als maatstaf.
        Die staan per klant in de klantomgeving, omdat een optelsom over klanten
        met verschillende doelgroepen geen betekenis heeft.
      </p>`,
  }[actief];

  return `
    <div class="paginatabs paginatabs-sub" role="tablist" aria-label="Dashboardtype">
      ${aanwezig.map((t) => `<a class="paginatab${t.key === actief ? ' active' : ''}" role="tab"
        aria-selected="${t.key === actief}" href="${esc(hashVoor('resultaten'))}&groep=${esc(t.key)}"
        data-resultaattab="${esc(t.key)}">${esc(t.label)}</a>`).join('')}
    </div>
    <section class="card">
      <h2>${esc(RESULTAAT_TABS.find((t) => t.key === actief).label)}</h2>
      ${inhoud()}
    </section>`;
}

export { kpiKaart };
