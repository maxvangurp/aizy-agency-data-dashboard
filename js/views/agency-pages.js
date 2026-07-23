/**
 * Overige agencypagina's.
 *
 * Campagnes, budgetten, conversies, inzichten, rapportages, datakwaliteit en
 * integraties. Elk van deze pagina's bestond eerder als een blok op een andere
 * pagina of helemaal niet. Ze staan nu op zichzelf, omdat het losse vragen zijn
 * die een eigen scherm verdienen.
 *
 * Geen van deze pagina's rekent zelf iets uit: alles komt uit de repository,
 * binnen de filtercontext en binnen wat deze gebruiker mag zien.
 */

import { fmt, esc, tabel, badge, ontbrekendeCel, metriekKolom, deltaTekst } from './components.js';
import { emptyState, koppelStatus } from '../ui/states.js';
import { KANALEN, KanaalSoort, KanaalStatus, kanaalLabel } from '../filters/channels.js';
import { toonDatum, toonBereik, DATA_VOLLEDIG_TOT } from '../filters/period.js';
import { dashboardtypeTerm, budgetstatusTerm, LABELS } from '../terminology.js';
import { DekkingStatus, PacingStatus } from '../data/selectors.js';
import { BusinessModel } from '../sample-data/shared.js';

/* ---------------------------------------------------------------
   Campagnes
   --------------------------------------------------------------- */

export function renderCampagnes({ details, filters }) {
  if (!details.campagnes.length) {
    return `<section class="card">
      ${koppelStatus({
        bron: 'Campagnegegevens',
        status: KanaalStatus.NIET_GEKOPPELD,
        uitleg: 'Campagnegegevens komen in deze demo uit Google Ads. Voeg Google Ads toe aan de kanaalselectie, of kies een periode waarin er is geadverteerd.',
      })}
    </section>`;
  }

  const totaleKosten = details.campagnes.reduce((t, c) => t + (c.kosten ?? 0), 0);

  return `<section class="card">
    <h2>Campagnes over de portefeuille</h2>
    <p class="muted">
      Alle campagnes van de klanten waartoe je toegang hebt, over
      ${esc(toonBereik(filters.periode.startDate, filters.periode.endDate))}.
      Gesorteerd op kosten, want dat is waar een besluit over budget begint.
    </p>
    <div class="table-scroll">
      ${tabel(
        ['Campagne', LABELS.klant, 'Type', 'Kosten', 'Aandeel', 'Klikken', 'Resultaat', 'Kosten per resultaat'],
        details.campagnes.slice(0, 50).map((c) => {
          const resultaat = c.conversies ?? c.leads ?? null;
          return [
            esc(c.naam),
            `<a class="link" href="#/agency/clients/${esc(c.klantId)}">${esc(c.klantNaam)}</a>`,
            esc(c.type ?? ''),
            fmt.euro(c.kosten),
            totaleKosten ? fmt.procent((c.kosten / totaleKosten) * 100) : ontbrekendeCel('onvoldoende_data'),
            fmt.getal(c.klikken),
            resultaat == null ? ontbrekendeCel('niet_gemeten') : fmt.getal(resultaat),
            resultaat ? fmt.euro2(c.kosten / resultaat) : ontbrekendeCel('onvoldoende_data'),
          ];
        })
      )}
    </div>
    ${details.campagnes.length > 50 ? `<p class="muted note">De 50 grootste van ${details.campagnes.length} campagnes worden getoond.</p>` : ''}
  </section>`;
}

/* ---------------------------------------------------------------
   Budgetten
   --------------------------------------------------------------- */

export function renderBudgetten({ overview }) {
  const s = overview.samenvattingen;
  if (!s.length) {
    return emptyState({ titel: 'Geen klanten in deze selectie', uitleg: 'Er zijn geen budgetten te tonen.' });
  }

  const boven = overview.portefeuille.bovenBudget;
  const onder = overview.portefeuille.onderBudget;

  return `
    <div class="kpi-row">
      <article class="card kpi" data-label="Totaal budget">
        <span class="kpi-label">Budget voor deze periode</span>
        <span class="kpi-value">${esc(fmt.euro(overview.totaalBudget))}</span>
        <span class="kpi-sub">maandbudgetten naar rato omgerekend</span>
      </article>
      <article class="card kpi" data-label="Besteed">
        <span class="kpi-label">Besteed</span>
        <span class="kpi-value">${esc(fmt.euro(overview.totaleSpend))}</span>
        <span class="kpi-sub">${overview.pacing == null ? 'geen budget vastgelegd' : `${fmt.procent(overview.pacing)} van het budget`}</span>
      </article>
      <article class="card kpi" data-label="Boven budget">
        <span class="kpi-label">Boven budget</span>
        <span class="kpi-value">${boven.length}</span>
        <span class="kpi-sub trend-${boven.length ? 'negatief' : 'positief'}">${boven.length ? 'klanten overschrijden het budget' : 'geen overschrijdingen'}</span>
      </article>
      <article class="card kpi" data-label="Onder budget">
        <span class="kpi-label">Onder budget</span>
        <span class="kpi-value">${onder.length}</span>
        <span class="kpi-sub">${onder.length ? 'klanten benutten het budget niet' : 'alle budgetten worden benut'}</span>
      </article>
    </div>

    <section class="card">
      <h2>Budget per klant</h2>
      <div class="table-scroll">
        ${tabel(
          [LABELS.klant, LABELS.dashboardtype, 'Maandbudget', 'Budget deze periode', 'Uitgaven',
            'Besteed', 'Status', 'Verwacht eindbedrag', 'Verschil'],
          s.map((x) => [
            `<a class="link" href="#/agency/clients/${esc(x.client.id)}">${esc(x.client.name)}</a>`,
            badge(dashboardtypeTerm(x.model).kort, 'muted'),
            x.client.maandbudget == null ? ontbrekendeCel('niet_ingesteld') : fmt.euro(x.client.maandbudget),
            x.budget.budget == null ? ontbrekendeCel('niet_ingesteld') : fmt.euro(x.budget.budget),
            fmt.euro(x.budget.uitgaven),
            x.budget.besteedPercentage == null
              ? ontbrekendeCel('onvoldoende_data')
              : `<span class="${x.budget.status === PacingStatus.BOVEN_BUDGET ? 'trend-negatief' : 'trend-positief'}">${fmt.procent(x.budget.besteedPercentage)}</span>`,
            `${badge(budgetstatusTerm(x.budget.status).kort, x.budget.status === PacingStatus.OP_SCHEMA ? 'ok' : 'middel')}`,
            x.budget.prognose == null ? ontbrekendeCel('onvoldoende_data') : fmt.euro(x.budget.prognose),
            x.budget.verschil == null ? ontbrekendeCel('onvoldoende_data') : fmt.euro(x.budget.verschil),
          ])
        )}
      </div>
      <p class="muted note">
        Het maandbudget wordt naar rato van de periodelengte omgerekend. Een
        weekfilter vergelijkt de uitgaven van die week dus met een zevende van
        het maandbudget en niet met het hele bedrag.
      </p>
    </section>`;
}

/* ---------------------------------------------------------------
   Conversies
   --------------------------------------------------------------- */

export function renderConversies({ overview }) {
  const ecommerce = overview.samenvattingen.filter((s) => s.client.businessModel === BusinessModel.ECOMMERCE);
  const leadgen = overview.samenvattingen.filter((s) => s.client.businessModel === BusinessModel.LEADGEN);

  if (!ecommerce.length && !leadgen.length) {
    return emptyState({
      titel: 'Geen meetbare conversies in deze selectie',
      uitleg: 'Awarenessklanten worden op bereik en aandacht beoordeeld en hebben geen conversietelling.',
    });
  }

  const blok = (titel, uitleg, klanten, kolommen, rij) => (klanten.length ? `<section class="card">
    <h2>${esc(titel)}</h2>
    <p class="muted">${esc(uitleg)}</p>
    <div class="table-scroll">${tabel(kolommen, klanten.map(rij))}</div>
  </section>` : '');

  return `
    ${blok('Leadgeneratie', 'Aanvragen en de kwalificatie daarvan. Zonder CRM-koppeling stopt de meting bij de lead; dat is geen nul maar een ontbrekende meting.',
      leadgen,
      [LABELS.klant, 'Leads', 'Gekwalificeerd', 'Kosten per lead', 'Kosten per gekwalificeerde lead', 'Afspraken', 'Klanten'],
      (s) => [
        `<a class="link" href="#/agency/clients/${esc(s.client.id)}">${esc(s.client.name)}</a>`,
        fmt.getal(s.totalen.leads),
        s.totalen.qualifiedLeads == null ? ontbrekendeCel('niet_gekoppeld') : fmt.getal(s.totalen.qualifiedLeads),
        s.totalen.cpl == null ? ontbrekendeCel('onvoldoende_data') : fmt.euro2(s.totalen.cpl),
        s.totalen.cpql == null ? ontbrekendeCel('niet_gekoppeld') : fmt.euro2(s.totalen.cpql),
        s.totalen.appointments == null ? ontbrekendeCel('niet_gekoppeld') : fmt.getal(s.totalen.appointments),
        s.totalen.customers == null ? ontbrekendeCel('niet_gekoppeld') : fmt.getal(s.totalen.customers),
      ])}

    ${blok('E-commerce', 'Aankopen en de stappen ervoor. Winkelwagen- en checkoutacties gaan aan dezelfde aankoop vooraf en worden daarom niet opgeteld.',
      ecommerce,
      [LABELS.klant, 'Aankopen', 'Omzet', 'Rendement', 'Gemiddelde orderwaarde', 'Winkelwagenacties', 'Checkouts'],
      (s) => [
        `<a class="link" href="#/agency/clients/${esc(s.client.id)}">${esc(s.client.name)}</a>`,
        fmt.getal(s.totalen.purchases),
        fmt.euro(s.totalen.revenue),
        s.totalen.roas == null ? ontbrekendeCel('onvoldoende_data') : fmt.ratio(s.totalen.roas),
        s.totalen.aov == null ? ontbrekendeCel('onvoldoende_data') : fmt.euro2(s.totalen.aov),
        s.totalen.addToCarts == null ? ontbrekendeCel('niet_gemeten') : fmt.getal(s.totalen.addToCarts),
        s.totalen.checkouts == null ? ontbrekendeCel('niet_gemeten') : fmt.getal(s.totalen.checkouts),
      ])}`;
}

/* ---------------------------------------------------------------
   Inzichten
   --------------------------------------------------------------- */

export function renderPortfolioInzichten({ inzichten, filters }) {
  if (!inzichten.length) {
    return emptyState({
      titel: 'Geen inzichten binnen deze selectie',
      uitleg: 'Er zijn geen bevindingen die uit de geselecteerde data te onderbouwen zijn. Verruim de periode of voeg kanalen toe.',
      id: 'inzichtenLeeg',
    });
  }

  const variant = { positief: 'ok', negatief: 'hoog', aandacht: 'middel' };

  return `<section class="card" id="portfolioInzichten">
    <h2>Inzichten over de portefeuille</h2>
    <p class="muted">
      Alleen bevindingen die uit de cijfers van
      ${esc(toonBereik(filters.periode.startDate, filters.periode.endDate))} te
      onderbouwen zijn. Er staat nergens een conclusie zonder de gegevens die
      eronder liggen.
    </p>
    <ul class="inzichtlijst">
      ${inzichten.map((i) => `<li class="inzichtrij">
        <div class="inzichtrij-kop">
          ${badge(i.titel, variant[i.soort] ?? 'muted')}
        </div>
        <p>${esc(i.tekst)}</p>
        ${i.clientId ? `<a class="link-klein" href="#/agency/clients/${esc(i.clientId)}">Klant openen</a>` : ''}
      </li>`).join('')}
    </ul>
  </section>`;
}

/* ---------------------------------------------------------------
   Rapportages
   --------------------------------------------------------------- */

export function renderRapportages({ overview, acties }) {
  const rapportageActies = acties.filter((a) => a.soort === 'rapportage');

  return `
    <section class="card">
      <h2>Rapportages per klant</h2>
      <p class="muted">
        Iedere klant heeft een rapportage met dezelfde opbouw: het resultaat,
        het doel, wat er veranderde, wat Aizy deed en wat er hierna gebeurt.
        Openen doe je in de klantomgeving; daar staat de tekst zoals de klant
        hem leest.
      </p>
      <div class="table-scroll">
        ${tabel(
          [LABELS.klant, LABELS.dashboardtype, LABELS.verantwoordelijke, 'Status', LABELS.laatsteGegevens, 'Rapportage'],
          overview.samenvattingen.map((s) => [
            esc(s.client.name),
            badge(dashboardtypeTerm(s.model).kort, 'muted'),
            s.team.primair ? esc(s.team.primair.displayName) : ontbrekendeCel('niet_van_toepassing'),
            `${badge(s.status.label, s.status.variant)}`,
            esc(toonDatum(DATA_VOLLEDIG_TOT)),
            `<a class="link" href="#/agency/clients/${esc(s.client.id)}">Openen</a>`,
          ])
        )}
      </div>
    </section>

    <section class="card">
      <h2>Ingeplande rapportages</h2>
      ${rapportageActies.length
        ? `<div class="table-scroll">${tabel(
            ['Rapportage', LABELS.klant, LABELS.verantwoordelijke, 'Status', 'Deadline'],
            rapportageActies.map((a) => [
              `<button type="button" class="link" data-actiepaneel="${esc(a.id)}">${esc(a.titel)}</button>`,
              esc(a.klantNaam),
              esc(a.verantwoordelijkeNaam),
              badge(a.statusTerm.kort, a.statusTerm.variant),
              a.deadline ? esc(toonDatum(a.deadline)) : '<span class="muted klein">Geen deadline</span>',
            ])
          )}</div>`
        : emptyState({
          titel: 'Er staan geen rapportages ingepland',
          uitleg: 'Maak een actie aan met soort Rapportage om er hier een te zien.',
          actie: { hash: '#/agency/actions', label: 'Naar het actiecentrum' },
        })}
    </section>`;
}

/* ---------------------------------------------------------------
   Datakwaliteit
   --------------------------------------------------------------- */

export function renderDatakwaliteit({ overview }) {
  const s = overview.samenvattingen;

  return `
    <div class="kpi-row">
      <article class="card kpi" data-label="Meetproblemen">
        <span class="kpi-label">Meetproblemen</span>
        <span class="kpi-value">${overview.trackingProblemen}</span>
        <span class="kpi-sub trend-${overview.trackingProblemen ? 'negatief' : 'positief'}">
          ${overview.trackingProblemen ? 'klanten met onbetrouwbare cijfers' : 'alle metingen volledig'}
        </span>
      </article>
      <article class="card kpi" data-label="Onvolledige dekking">
        <span class="kpi-label">Onvolledige dekking</span>
        <span class="kpi-value">${overview.onvolledigeDekking}</span>
        <span class="kpi-sub">klanten zonder data over de hele periode</span>
      </article>
      <article class="card kpi" data-label="Zonder CRM">
        <span class="kpi-label">Zonder CRM-koppeling</span>
        <span class="kpi-value">${overview.leadgen.zonderKwalificatie}</span>
        <span class="kpi-sub">leadkwaliteit niet meetbaar</span>
      </article>
    </div>

    <section class="card">
      <h2>Datakwaliteit per klant</h2>
      <p class="muted">
        De datakwaliteit zegt hoeveel van de verwachte meting daadwerkelijk
        binnenkomt. Een lage waarde maakt niet het resultaat slecht, maar de
        conclusie onzeker.
      </p>
      <div class="table-scroll">
        ${tabel(
          [LABELS.klant, 'Meetstatus', LABELS.datakwaliteit, 'Dagen met gegevens', 'Dekking', 'Ontbrekende bronnen'],
          s.map((x) => [
            `<a class="link" href="#/agency/clients/${esc(x.client.id)}">${esc(x.client.name)}</a>`,
            badge(
              x.client.trackingStatus === 'gezond' ? 'Meting volledig'
                : x.client.trackingStatus === 'probleem' ? 'Meting onvolledig' : 'Meting controleren',
              x.client.trackingStatus === 'gezond' ? 'ok' : x.client.trackingStatus === 'probleem' ? 'hoog' : 'middel'
            ),
            `${x.client.dataHealth} procent`,
            `${x.dekking.dagenMetData} van ${x.dekking.totaalDagen}`,
            x.dekking.status === DekkingStatus.VOLLEDIG ? 'Volledig'
              : x.dekking.status === DekkingStatus.GEDEELTELIJK ? 'Gedeeltelijk' : 'Geen data',
            ontbrekendeBronnen(x.client),
          ])
        )}
      </div>
    </section>`;
}

function ontbrekendeBronnen(client) {
  const meetbronnen = KANALEN.filter((k) => k.soort === KanaalSoort.MEETBRON);
  const ontbreekt = meetbronnen.filter((k) => (client.bronnen?.[k.key] ?? KanaalStatus.NIET_GEKOPPELD) !== KanaalStatus.GEKOPPELD);
  if (!ontbreekt.length) return '<span class="muted klein">Alle bronnen gekoppeld</span>';
  return `<span class="muted klein">${esc(ontbreekt.map((k) => k.label).join(', '))}</span>`;
}

/* ---------------------------------------------------------------
   Integraties
   --------------------------------------------------------------- */

export function renderIntegraties({ overview }) {
  const advertentiekanalen = KANALEN.filter((k) => k.soort === KanaalSoort.ADVERTENTIE);
  const meetbronnen = KANALEN.filter((k) => k.soort === KanaalSoort.MEETBRON);

  const klantenMet = (key) => overview.samenvattingen.filter((s) => (s.kanalen ?? []).includes(key)).length;
  const bronKlanten = (key) => overview.samenvattingen.filter((s) => s.client.bronnen?.[key] === KanaalStatus.GEKOPPELD).length;

  return `
    <section class="card">
      <h2>Advertentiekanalen</h2>
      <p class="muted">
        Een advertentiekanaal levert uitgaven, vertoningen en klikken. Hierop kun
        je filteren, want iedere rij in de dataset hoort bij precies één kanaal.
      </p>
      <div class="koppelstatus-grid">
        ${advertentiekanalen.map((k) => koppelStatus({
          bron: k.label,
          status: klantenMet(k.key) ? KanaalStatus.GEKOPPELD : KanaalStatus.NIET_GEKOPPELD,
          uitleg: klantenMet(k.key)
            ? `${klantenMet(k.key)} van je klanten adverteert via ${k.label}.`
            : `Geen enkele klant in deze selectie adverteert via ${k.label}.`,
          actie: { hash: `#/agency/channels/${k.key}`, label: 'Kanaalpagina openen' },
        })).join('')}
      </div>
    </section>

    <section class="card">
      <h2>Meetbronnen</h2>
      <p class="muted">
        Een meetbron meet het resultaat en staat naast alle kanalen. Daarom is
        het geen filterwaarde: erop filteren zou de meetlat uit de meting halen.
      </p>
      <div class="koppelstatus-grid">
        ${meetbronnen.map((k) => koppelStatus({
          bron: k.label,
          status: k.toekomstig
            ? KanaalStatus.TOEKOMSTIG
            : bronKlanten(k.key) ? KanaalStatus.GEKOPPELD : KanaalStatus.NIET_GEKOPPELD,
          uitleg: k.toekomstig
            ? `De koppeling met ${k.label} is nog niet gebouwd. De cijfers die er nu bij staan zijn demodata en worden als zodanig gemarkeerd.`
            : `${bronKlanten(k.key)} van je klanten heeft ${k.label} gekoppeld.`,
        })).join('')}
      </div>
    </section>

    <section class="card">
      <h2>Wat er nog niet gekoppeld is</h2>
      <p class="muted">
        Deze demo draait volledig op vaste demodata met dagelijkse reeksen.
        Koppelingen met Google Ads, Meta Ads, Microsoft Ads, LinkedIn Ads,
        Google Analytics 4, CRM en de agenda's van Google en Microsoft worden
        ingericht zodra de Azure-backend beschikbaar is. Tot die tijd staat er
        geen enkele knop die een koppeling suggereert die er niet is.
      </p>
    </section>`;
}

export { deltaTekst, metriekKolom, kanaalLabel };
