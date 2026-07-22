/**
 * Agencyomgeving voor medewerkers van Aizy.
 *
 * Er zijn twee startschermen, omdat er twee taken zijn. Een beheerder kijkt
 * naar de portefeuille en bepaalt waar de aandacht heen moet. Een medewerker
 * kijkt naar zijn eigen klanten en bepaalt waar hij vandaag begint. Beide
 * schermen putten uit dezelfde repository, met dezelfde tenantgrens.
 *
 * Alle data komt via de repository, die de gebruiker en de filtercontext
 * ontvangt. Deze module haalt zelf nooit uit sample-data, filtert zelf geen
 * datums of kanalen en berekent zelf geen totalen.
 */

import { BUSINESS_MODEL_LABELS, BusinessModel } from '../data/repository.js';
import { can, Permission } from '../auth/permissions.js';
import { primaireRol, AccountStatus } from '../auth/domain.js';
import {
  fmt, esc, kpi, tabel, badge, deltaTekst, ontbrekendeCel, metriekKolom, meetstatusBadge,
} from './components.js';
import { renderContextheader, renderMedewerker, renderAvatar } from './context-header.js';
import { renderInzichten, renderPrioriteit } from './insight-cards.js';
import { kanaalLabel } from '../filters/channels.js';
import { toonBereik, toonDatum, DATA_VOLLEDIG_TOT } from '../filters/period.js';
import {
  toegangsniveauTerm, accountstatusTerm, dashboardtypeTerm, budgetstatusTerm, LABELS,
} from '../terminology.js';

/**
 * Dagdeel voor de begroeting.
 *
 * De demo rekent met een vaste referentietijd, zodat een test niet afhangt van
 * het uur waarop hij draait. Buiten de demo zou hier de klok van de gebruiker
 * staan.
 */
export const DEMO_UUR = 10;

function dagdeel(uur = DEMO_UUR) {
  if (uur < 6) return 'Goedenacht';
  if (uur < 12) return 'Goedemorgen';
  if (uur < 18) return 'Goedemiddag';
  return 'Goedenavond';
}

/** Getoond wanneer een medewerker nog geen toewijzingen heeft. */
function geenKlantenToegewezen() {
  return `<section class="card leeg-blok" id="geenKlanten">
    <h2>Er zijn nog geen klanten aan je account toegewezen</h2>
    <p class="muted">
      Een agencybeheerder kan klanten aan je portefeuille toevoegen. Zodra dat is
      gebeurd, verschijnen ze hier met hun resultaten en aandachtspunten.
    </p>
  </section>`;
}

/* ---------------------------------------------------------------
   Startscherm van de beheerder: de portefeuille
   --------------------------------------------------------------- */

export function renderAgencyOverview(user, { overview, filterbalk = '' }) {
  const kop = renderContextheader({
    kruimelpad: [{ label: 'Agency', href: '#/agency/overview' }, { label: 'Overzicht' }],
    titel: 'Portefeuilleoverzicht',
    ondertitel: `Alle ${overview.aantalKlanten} klanten van Aizy, over ${toonBereik(overview.filters.periode.startDate, overview.filters.periode.endDate)}.`,
    omgeving: 'agency',
    labels: [{ tekst: `${overview.portefeuille.opPrioriteit.filter((s) => s.prioriteit.niveau !== 'geen').length} klanten met aandachtspunten`, variant: 'middel' }],
  });

  if (!overview.aantalKlanten) return kop + geenKlantenToegewezen();

  const label = overview.filters.vergelijkingActief
    ? overview.filters.vergelijking.label.toLowerCase()
    : 'de vorige periode';

  return `
    ${kop}
    ${filterbalk}
    ${renderAgencyKpis(overview, label)}
    ${renderWerkvolgorde(overview.portefeuille, 'Waar aandacht nodig is')}
    ${renderResultatenPerType(overview, label)}
    ${renderPortefeuilleGroepen(overview.portefeuille)}
    ${renderSignalen(overview.signalen, overview.samenvattingen, overview.filters)}
  `;
}

function renderAgencyKpis(overview, label) {
  return `<div class="kpi-row">
    ${kpi('Actieve klanten', fmt.getal(overview.aantalKlanten),
      `${overview.opKoers} op koers, ${overview.aandachtNodig} onder doel`, 'neutraal',
      { uitleg: 'Het aantal klanten waartoe dit account toegang heeft.' })}
    ${kpi('Advertentie-uitgaven', fmt.euro(overview.totaleSpend),
      deltaTekst(overview.deltas.spend, label) || `van ${fmt.euro(overview.totaalBudget)} budget`,
      overview.deltas.spend?.richting ?? 'neutraal',
      { uitleg: 'De uitgaven over alle toegankelijke klanten binnen de geselecteerde periode en kanalen.' })}
    ${kpi('Budgetbesteding', overview.pacing == null ? 'Niet beschikbaar' : fmt.procent(overview.pacing),
      overview.pacing == null ? 'Geen budget vastgelegd'
        : `${fmt.euro(overview.totaleSpend)} van ${fmt.euro(overview.totaalBudget)} voor deze periode`,
      overview.pacing == null ? 'neutraal' : overview.pacing > 105 ? 'negatief' : 'positief',
      { uitleg: 'Het deel van het budget voor deze periode dat is besteed. Het maandbudget wordt naar rato omgerekend.' })}
    ${kpi('Open signalen', fmt.getal(overview.openSignalen),
      overview.trackingProblemen ? `${overview.trackingProblemen} klanten met onvolledige meting` : 'alle metingen volledig',
      overview.openSignalen ? 'negatief' : 'positief',
      { uitleg: 'Signalen binnen de geselecteerde periode en kanalen die nog niet zijn opgevolgd.' })}
  </div>`;
}

/**
 * De werkvolgorde: klanten op prioriteit, met de reden erbij.
 * Nooit alleen een score. Wie boven aan de lijst staat, leest meteen waarom.
 */
function renderWerkvolgorde(portefeuille, titel) {
  const aandacht = portefeuille.opPrioriteit.filter((s) => s.prioriteit.niveau !== 'geen');

  if (!aandacht.length) {
    return `<section class="card" id="werkvolgorde">
      <h2>${esc(titel)}</h2>
      <p class="empty">
        Binnen deze selectie liggen alle klanten op koers en is de meting volledig.
      </p>
    </section>`;
  }

  return `<section class="card" id="werkvolgorde">
    <h2>${esc(titel)}</h2>
    <p class="muted">
      Gesorteerd op de omvang van de afwijking, het volume waarop die rust en de
      volledigheid van de meting. De redenen staan erbij, zodat de volgorde
      navolgbaar is.
    </p>
    <ol class="werkvolgorde">
      ${aandacht.slice(0, 5).map((s) => `<li class="werkvolgorde-item">
        <div class="werkvolgorde-kop">
          <a class="link" href="#/agency/clients/${esc(s.client.id)}">${esc(s.client.name)}</a>
          ${badge(dashboardtypeTerm(s.model).kort, 'muted')}
          ${badge(s.prioriteit.label, s.prioriteit.variant)}
        </div>
        <p class="eyebrow">${esc(LABELS.waaromAandacht)}</p>
        <ul class="prioriteit-redenen">
          ${s.prioriteit.redenen.map((r) => `<li>${esc(r)}</li>`).join('')}
        </ul>
        <p class="klein muted">
          ${esc(LABELS.verantwoordelijke)}: ${esc(s.team.primair?.displayName ?? 'niet toegewezen')}
        </p>
      </li>`).join('')}
    </ol>
  </section>`;
}

/**
 * Resultaten gescheiden per bedrijfsmodel.
 *
 * Een gemiddelde ROAS over leadgeneratieklanten bestaat niet en een gemiddelde
 * CPL over webshops evenmin. Ze worden daarom naast elkaar getoond in plaats
 * van tot één getal samengevoegd.
 */
function renderResultatenPerType(overview, label) {
  const blokken = [];

  if (overview.ecommerce.aantal) {
    blokken.push(`<div class="type-blok">
      <h3>E-commerce <span class="muted">${overview.ecommerce.aantal} ${overview.ecommerce.aantal === 1 ? 'klant' : 'klanten'}</span></h3>
      <div class="kpi-row">
        ${kpi('Omzet', fmt.euro(overview.ecommerce.omzet), deltaTekst(overview.deltas.revenue, label) || 'deze periode', overview.deltas.revenue?.richting ?? 'neutraal')}
        ${kpi('Transacties', fmt.getal(overview.ecommerce.aankopen), deltaTekst(overview.deltas.purchases, label) || 'deze periode', overview.deltas.purchases?.richting ?? 'neutraal')}
        ${kpi('Gemiddeld rendement', overview.ecommerce.gemiddeldeRoas == null ? 'Onvoldoende data' : fmt.ratio(overview.ecommerce.gemiddeldeRoas),
          'over e-commerceklanten', 'neutraal',
          { kort: 'ROAS', uitleg: 'Rendement op advertentie-uitgaven: omzet gedeeld door advertentiekosten, gemiddeld over de e-commerceklanten.' })}
      </div>
    </div>`);
  }

  if (overview.leadgen.aantal) {
    blokken.push(`<div class="type-blok">
      <h3>Leadgeneratie <span class="muted">${overview.leadgen.aantal} ${overview.leadgen.aantal === 1 ? 'klant' : 'klanten'}</span></h3>
      <div class="kpi-row">
        ${kpi('Leads', fmt.getal(overview.leadgen.leads), deltaTekst(overview.deltas.leads, label) || 'deze periode', overview.deltas.leads?.richting ?? 'neutraal')}
        ${kpi('Gemiddelde kosten per lead', overview.leadgen.gemiddeldeCpl == null ? 'Onvoldoende data' : fmt.euro2(overview.leadgen.gemiddeldeCpl),
          'over leadgeneratieklanten', 'neutraal',
          { kort: 'CPL', uitleg: 'Kosten per lead, gemiddeld over de leadgeneratieklanten.' })}
        ${kpi('Zonder CRM-koppeling', fmt.getal(overview.leadgen.zonderKwalificatie),
          overview.leadgen.zonderKwalificatie ? 'leadkwaliteit niet meetbaar' : 'alle klanten gekoppeld',
          overview.leadgen.zonderKwalificatie ? 'negatief' : 'positief')}
      </div>
    </div>`);
  }

  if (!blokken.length) return '';

  return `<section class="card">
    <h2>Resultaten per dashboardtype</h2>
    <p class="muted">
      E-commerce en leadgeneratie worden apart getoond. Omzet, ROAS, leads en
      kosten per lead zijn niet onderling vergelijkbaar.
    </p>
    ${blokken.join('')}
    ${overview.overig.aantal ? `<p class="muted note">${overview.overig.aantal} ${overview.overig.aantal === 1 ? 'klant heeft' : 'klanten hebben'} een awarenessdashboard, dat op bereik en aandacht wordt beoordeeld en niet op kosten per lead.</p>` : ''}
  </section>`;
}

/** Groepen klanten die om verschillende redenen opvallen. */
function renderPortefeuilleGroepen(p) {
  const groepen = [
    { titel: 'Onder doel', items: p.onderDoel, reden: (s) => s.status.reden },
    { titel: 'Grootste stijgers', items: p.grootsteStijgers.map((x) => x.s), reden: (s, i, lijst) => stijgerTekst(p.grootsteStijgers, s) },
    { titel: 'Grootste dalers', items: p.grootsteDalers.map((x) => x.s), reden: (s) => stijgerTekst(p.grootsteDalers, s) },
    { titel: 'Onvolledige meting', items: p.metMeetprobleem, reden: (s) => `Datakwaliteit ${s.client.dataHealth} procent.` },
    { titel: 'Zonder CRM-koppeling', items: p.zonderCrm, reden: () => 'Leadkwaliteit en klantconversies zijn niet meetbaar.' },
    { titel: 'Boven budget', items: p.bovenBudget, reden: (s) => `${fmt.euro(s.budget.uitgaven)} besteed van ${fmt.euro(s.budget.budget)}.` },
    { titel: 'Onder budget', items: p.onderBudget, reden: (s) => `${fmt.euro(s.budget.uitgaven)} besteed van ${fmt.euro(s.budget.budget)}.` },
    { titel: 'Onvolledige dekking in deze periode', items: p.onvolledigeDekking, reden: (s) => `${s.dekking.dagenMetData} van ${s.dekking.totaalDagen} dagen met gegevens.` },
  ].filter((g) => g.items.length);

  if (!groepen.length) return '';

  return `<section class="card">
    <h2>Portefeuille-indeling</h2>
    <div class="portefeuille-grid">
      ${groepen.map((g) => `<div class="portefeuille-groep">
        <h3>${esc(g.titel)} <span class="muted">${g.items.length}</span></h3>
        <ul>
          ${g.items.map((s) => `<li>
            <a class="link" href="#/agency/clients/${esc(s.client.id)}">${esc(s.client.name)}</a>
            <span class="muted klein">${esc(g.reden(s))}</span>
          </li>`).join('')}
        </ul>
      </div>`).join('')}
    </div>
  </section>`;
}

function stijgerTekst(lijst, samenvatting) {
  const item = lijst.find((x) => x.s.client.id === samenvatting.client.id);
  if (!item) return '';
  const richting = item.pct > 0 ? 'hoger' : 'lager';
  return `${Math.abs(item.pct).toFixed(1)} procent ${richting} dan de vorige periode.`;
}

function renderSignalen(signalen, samenvattingen, filters) {
  const naam = (id) => samenvattingen.find((s) => s.client.id === id)?.client.name ?? 'Onbekende klant';

  return `<section class="card">
    <h2>Signalen</h2>
    ${!signalen.length
      ? `<p class="empty">Er zijn geen signalen binnen ${esc(toonBereik(filters.periode.startDate, filters.periode.endDate))} voor de geselecteerde kanalen.</p>`
      : `<ul class="alert-list">${signalen.map((a) => `<li class="alert alert-${esc(a.ernst)}">
          <div class="alert-head">
            ${badge(a.ernst === 'hoog' ? 'Hoge urgentie' : 'Gemiddelde urgentie', a.ernst === 'hoog' ? 'hoog' : 'middel')}
            <strong>${esc(naam(a.klantId))}</strong>
            <span class="muted">${esc(a.kanaalLabel ?? kanaalLabel(a.kanaal))}</span>
          </div>
          <p class="alert-problem">${esc(a.probleem)}</p>
          <p class="alert-meta"><span class="eyebrow">${esc(LABELS.context)}</span> ${esc(a.oorzaak)}</p>
          <p class="alert-meta"><span class="eyebrow">${esc(LABELS.actie)}</span> ${esc(a.aanbeveling)}</p>
        </li>`).join('')}</ul>`}
  </section>`;
}

/* ---------------------------------------------------------------
   Startscherm van de medewerker: de eigen werkdag
   --------------------------------------------------------------- */

/**
 * Het persoonlijke overzicht ondersteunt de werkdag.
 *
 * Het beantwoordt welke klanten vandaag aandacht nodig hebben, waar iemand
 * verantwoordelijk voor is, waar hij alleen ondersteunt en waar data ontbreekt.
 * Geen scores per medewerker en geen ranglijst: dit is een werkvolgorde.
 */
export function renderMijnOverzicht(user, { persoonlijk, filterbalk = '' }) {
  const kop = renderContextheader({
    kruimelpad: [{ label: 'Agency', href: '#/agency/overview' }, { label: 'Mijn overzicht' }],
    titel: `${dagdeel()}, ${user.firstName}`,
    ondertitel: persoonlijk.samenvattingen.length
      ? `Je bent verantwoordelijk voor ${aantalTekst(persoonlijk.verantwoordelijkVoor.length, 'klant', 'klanten')} en ondersteunt bij ${aantalTekst(persoonlijk.ondersteuntBij.length, 'klant', 'klanten')}. Weergave over ${toonBereik(persoonlijk.filters.periode.startDate, persoonlijk.filters.periode.endDate)}.`
      : 'Er zijn nog geen klanten aan je account toegewezen.',
    omgeving: 'agency',
    labels: persoonlijk.vandaagAandacht.length
      ? [{ tekst: `${persoonlijk.vandaagAandacht.length} vandaag aandacht nodig`, variant: 'hoog' }]
      : [{ tekst: 'Geen directe aandachtspunten', variant: 'ok' }],
  });

  if (!persoonlijk.samenvattingen.length) return kop + geenKlantenToegewezen();

  return `
    ${kop}
    ${filterbalk}

    <div class="kpi-row">
      ${kpi('Vandaag aandacht nodig', fmt.getal(persoonlijk.vandaagAandacht.length),
        persoonlijk.vandaagAandacht.length ? 'klanten met een directe afwijking' : 'geen directe afwijkingen',
        persoonlijk.vandaagAandacht.length ? 'negatief' : 'positief')}
      ${kpi('Deze week bekijken', fmt.getal(persoonlijk.dezeWeek.length), 'klanten met een kleinere afwijking')}
      ${kpi('Op koers', fmt.getal(persoonlijk.opKoers.length), 'klanten zonder aandachtspunten', 'positief')}
      ${kpi('Advertentie-uitgaven', fmt.euro(persoonlijk.totaleSpend),
        `over ${aantalTekst(persoonlijk.samenvattingen.length, 'klant', 'klanten')} in je portefeuille`, 'neutraal',
        { uitleg: 'De uitgaven van de klanten waartoe je toegang hebt, binnen de geselecteerde periode en kanalen.' })}
      ${kpi('Open signalen', fmt.getal(persoonlijk.signalen.length), 'binnen deze periode en kanalen',
        persoonlijk.signalen.length ? 'negatief' : 'positief')}
    </div>

    ${renderVandaagAandacht(persoonlijk)}
    ${renderMijnKlanten(persoonlijk)}
    ${renderRecenteVeranderingen(persoonlijk)}
    ${renderDatakwaliteit(persoonlijk)}
    ${renderOpenActies(persoonlijk)}
  `;
}

function aantalTekst(n, enkelvoud, meervoud) {
  return `${n} ${n === 1 ? enkelvoud : meervoud}`;
}

function renderVandaagAandacht(persoonlijk) {
  const items = [...persoonlijk.vandaagAandacht, ...persoonlijk.dezeWeek];
  if (!items.length) {
    return `<section class="card" id="vandaagAandacht">
      <h2>Vandaag aandacht nodig</h2>
      <p class="empty">Binnen deze selectie liggen al je klanten op koers en is de meting volledig.</p>
    </section>`;
  }

  return `<section class="card" id="vandaagAandacht">
    <h2>Vandaag aandacht nodig</h2>
    <p class="muted">Op volgorde van impact, met de reden erbij.</p>
    <ol class="werkvolgorde">
      ${items.slice(0, 4).map((s) => `<li class="werkvolgorde-item">
        <div class="werkvolgorde-kop">
          <a class="link" href="#/agency/clients/${esc(s.client.id)}">${esc(s.client.name)}</a>
          ${badge(dashboardtypeTerm(s.model).kort, 'muted')}
          ${badge(s.prioriteit.label, s.prioriteit.variant)}
          ${badge(s.verantwoordelijk ? 'Jij bent verantwoordelijk' : 'Je ondersteunt hier', s.verantwoordelijk ? 'ok' : 'muted')}
        </div>
        <p class="eyebrow">${esc(LABELS.waaromAandacht)}</p>
        <ul class="prioriteit-redenen">${s.prioriteit.redenen.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
      </li>`).join('')}
    </ol>
  </section>`;
}

function renderMijnKlanten(persoonlijk) {
  return `<section class="card">
    <h2>Mijn klanten</h2>
    <div class="table-scroll">
      ${tabel(
        [LABELS.klant, LABELS.dashboardtype, 'Mijn rol bij deze klant', 'Status',
          metriekKolom('spend', 'Advertentie-uitgaven'), 'Primair resultaat', LABELS.prioriteit],
        persoonlijk.samenvattingen.map((s) => [
          `<a class="link" href="#/agency/clients/${esc(s.client.id)}">${esc(s.client.name)}</a>`,
          badge(dashboardtypeTerm(s.model).kort, 'muted'),
          s.verantwoordelijk
            ? badge('Verantwoordelijk', 'ok')
            : s.ondersteunend ? badge('Ondersteunend', 'muted') : '<span class="muted">Geen rol vastgelegd</span>',
          `${badge(s.status.label, s.status.variant)}<br><span class="muted klein">${esc(s.status.reden)}</span>`,
          fmt.euro(s.totalen.spend),
          primairResultaat(s),
          renderPrioriteit(s.prioriteit, { compact: true }),
        ])
      )}
    </div>
  </section>`;
}

function renderRecenteVeranderingen(persoonlijk) {
  if (!persoonlijk.recenteVeranderingen.length) {
    return `<section class="card">
      <h2>Recente veranderingen</h2>
      <p class="empty">Binnen deze selectie zijn er geen veranderingen groter dan 5 procent.</p>
    </section>`;
  }

  return `<section class="card">
    <h2>Recente veranderingen</h2>
    <p class="muted">Het primaire resultaat per klant, vergeleken met de vergelijkingsperiode.</p>
    <ul class="verander-lijst">
      ${persoonlijk.recenteVeranderingen.map((v) => `<li>
        <a class="link" href="#/agency/clients/${esc(v.clientId)}">${esc(v.clientNaam)}</a>
        <span class="trend-${esc(v.richting)}">${esc(v.delta.tekst)}</span>
        <span class="muted klein">${esc(v.metriek === 'revenue' ? 'omzet' : 'leads')}: ${esc(fmt.getal(v.delta.vorig))} naar ${esc(fmt.getal(v.delta.huidig))}</span>
      </li>`).join('')}
    </ul>
  </section>`;
}

function renderDatakwaliteit(persoonlijk) {
  if (!persoonlijk.datakwaliteit.length) {
    return `<section class="card">
      <h2>Datakwaliteit</h2>
      <p class="empty">Alle bronnen van je klanten leveren volledige gegevens binnen deze periode.</p>
    </section>`;
  }

  return `<section class="card">
    <h2>Datakwaliteit</h2>
    <ul class="verander-lijst">
      ${persoonlijk.datakwaliteit.map((s) => `<li>
        <a class="link" href="#/agency/clients/${esc(s.client.id)}">${esc(s.client.name)}</a>
        ${meetstatusBadge(s.client.trackingStatus)}
        <span class="muted klein">${esc(s.meldingenTekst ?? `${s.dekking.dagenMetData} van ${s.dekking.totaalDagen} dagen met gegevens`)}</span>
      </li>`).join('')}
    </ul>
  </section>`;
}

function renderOpenActies(persoonlijk) {
  if (!persoonlijk.signalen.length) {
    return `<section class="card">
      <h2>Open acties</h2>
      <p class="empty">Er staan geen acties open binnen deze periode en kanaalselectie.</p>
    </section>`;
  }

  const naam = (id) => persoonlijk.samenvattingen.find((s) => s.client.id === id)?.client.name ?? 'Onbekend';

  return `<section class="card">
    <h2>Open acties</h2>
    <div class="table-scroll">
      ${tabel(
        ['Actie', LABELS.klant, 'Kanaal', 'Urgentie', 'Openstaand sinds'],
        persoonlijk.signalen.map((s) => [
          esc(s.aanbeveling),
          esc(naam(s.klantId)),
          esc(s.kanaalLabel ?? kanaalLabel(s.kanaal)),
          badge(s.ernst === 'hoog' ? 'Hoge urgentie' : 'Gemiddelde urgentie', s.ernst === 'hoog' ? 'hoog' : 'middel'),
          esc(toonDatum(s.startdatum)),
        ])
      )}
    </div>
  </section>`;
}

/* ---------------------------------------------------------------
   Klantenoverzicht
   --------------------------------------------------------------- */

export function renderAgencyClients(user, { samenvattingen, filters, klantFilters = {}, filterbalk = '' }) {
  const alleKlanten = can(user, Permission.VIEW_ALL_CLIENTS);
  const titel = alleKlanten ? 'Klanten' : 'Mijn klanten';

  const kop = renderContextheader({
    kruimelpad: [{ label: 'Agency', href: '#/agency/overview' }, { label: titel }],
    titel,
    ondertitel: samenvattingen.length
      ? `${samenvattingen.length} ${samenvattingen.length === 1 ? 'klant' : 'klanten'} over ${toonBereik(filters.periode.startDate, filters.periode.endDate)}.`
      : 'Er zijn nog geen klanten aan je account toegewezen.',
    omgeving: 'agency',
  });

  if (!samenvattingen.length) return kop + geenKlantenToegewezen();

  const zoek = (klantFilters.zoek ?? '').toLowerCase().trim();
  const gefilterd = samenvattingen
    .filter((s) => !zoek || s.client.name.toLowerCase().includes(zoek))
    .filter((s) => !klantFilters.medewerker || s.client.primaryOwnerId === klantFilters.medewerker)
    .filter((s) => !klantFilters.type || s.client.businessModel === klantFilters.type)
    .filter((s) => !klantFilters.status || s.status.code === klantFilters.status);

  const gesorteerd = sorteerKlanten(gefilterd, klantFilters.sorteer);
  const medewerkers = [...new Map(samenvattingen
    .filter((s) => s.team.primair)
    .map((s) => [s.team.primair.id, s.team.primair])).values()]
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'nl'));
  const typen = [...new Set(samenvattingen.map((s) => s.client.businessModel))];

  return `
    ${kop}
    ${filterbalk}

    <section class="card">
      <div class="filterbalk">
        <div class="veld">
          <label for="klantZoek">Zoeken op klantnaam</label>
          <input type="search" id="klantZoek" value="${esc(klantFilters.zoek ?? '')}" placeholder="Klantnaam">
        </div>
        <div class="veld">
          <label for="klantMedewerker">${esc(LABELS.verantwoordelijke)}</label>
          <select id="klantMedewerker">
            <option value="">Alle medewerkers</option>
            ${medewerkers.map((m) => `<option value="${esc(m.id)}"${klantFilters.medewerker === m.id ? ' selected' : ''}>${esc(m.displayName)}</option>`).join('')}
          </select>
        </div>
        <div class="veld">
          <label for="klantType">${esc(LABELS.dashboardtype)}</label>
          <select id="klantType">
            <option value="">Alle dashboardtypes</option>
            ${typen.map((t) => `<option value="${esc(t)}"${klantFilters.type === t ? ' selected' : ''}>${esc(BUSINESS_MODEL_LABELS[t] ?? t)}</option>`).join('')}
          </select>
        </div>
        <div class="veld">
          <label for="klantStatus">Status</label>
          <select id="klantStatus">
            <option value="">Alle statussen</option>
            <option value="op-koers"${klantFilters.status === 'op-koers' ? ' selected' : ''}>Op koers</option>
            <option value="aandacht"${klantFilters.status === 'aandacht' ? ' selected' : ''}>Aandacht nodig</option>
            <option value="tracking"${klantFilters.status === 'tracking' ? ' selected' : ''}>Meetprobleem</option>
            <option value="onvoldoende-data"${klantFilters.status === 'onvoldoende-data' ? ' selected' : ''}>Onvoldoende data</option>
            <option value="geen-doel"${klantFilters.status === 'geen-doel' ? ' selected' : ''}>Doel ontbreekt</option>
          </select>
        </div>
        <div class="veld">
          <label for="klantSorteer">Sorteren op</label>
          <select id="klantSorteer">
            <option value="prioriteit"${klantFilters.sorteer === 'prioriteit' ? ' selected' : ''}>Aandacht nodig</option>
            <option value="naam"${klantFilters.sorteer === 'naam' ? ' selected' : ''}>Klantnaam</option>
            <option value="spend"${klantFilters.sorteer === 'spend' ? ' selected' : ''}>Advertentie-uitgaven</option>
            <option value="pacing"${klantFilters.sorteer === 'pacing' ? ' selected' : ''}>Budgetbesteding</option>
            <option value="resultaat"${klantFilters.sorteer === 'resultaat' ? ' selected' : ''}>Primair resultaat</option>
          </select>
        </div>
      </div>

      <p class="muted klein">${gesorteerd.length} van ${samenvattingen.length} klanten getoond.</p>

      ${!gesorteerd.length
        ? '<p class="empty">Geen klanten gevonden met deze filters. Pas het zoekveld of de statuskeuze aan.</p>'
        : `<div class="table-scroll">${klantTabel(gesorteerd)}</div>`}
    </section>`;
}

function sorteerKlanten(samenvattingen, sorteer) {
  const lijst = [...samenvattingen];
  switch (sorteer) {
    case 'spend': return lijst.sort((a, b) => (b.totalen.spend ?? 0) - (a.totalen.spend ?? 0));
    case 'pacing': return lijst.sort((a, b) => (b.budget.besteedPercentage ?? 0) - (a.budget.besteedPercentage ?? 0));
    case 'resultaat': return lijst.sort((a, b) => primair(b) - primair(a));
    case 'naam': return lijst.sort((a, b) => a.client.name.localeCompare(b.client.name, 'nl'));
    default: return lijst.sort((a, b) => b.prioriteit.punten - a.prioriteit.punten
      || a.client.name.localeCompare(b.client.name, 'nl'));
  }
}

function primair(s) {
  if (s.client.businessModel === BusinessModel.ECOMMERCE) return s.totalen.revenue ?? 0;
  if (s.client.businessModel === BusinessModel.LEADGEN) return s.totalen.leads ?? 0;
  return s.totalen.impressions ?? 0;
}

function klantTabel(samenvattingen) {
  return tabel(
    [LABELS.klant, LABELS.dashboardtype, LABELS.verantwoordelijke, LABELS.kanalen,
      metriekKolom('spend', 'Advertentie-uitgaven'), 'Primair resultaat', 'Status',
      'Budgetbesteding', 'Datakwaliteit', LABELS.laatsteGegevens],
    samenvattingen.map((s) => {
      const c = s.client;
      const besteed = s.budget.besteedPercentage;

      return [
        `<a class="link" href="#/agency/clients/${esc(c.id)}">${esc(c.name)}</a>`,
        badge(dashboardtypeTerm(s.model).kort, 'muted'),
        s.team.primair
          ? `<span title="${esc(s.team.primair.jobTitle ?? '')}">${esc(s.team.primair.displayName)}</span>`
          : ontbrekendeCel('niet_van_toepassing'),
        `<span class="muted">${esc(s.kanalen.map(kanaalLabel).join(', ') || 'Geen kanaal geselecteerd')}</span>`,
        fmt.euro(s.totalen.spend),
        primairResultaat(s),
        `${badge(s.status.label, s.status.variant)}<br><span class="muted klein">${esc(s.status.reden)}</span>`,
        besteed == null ? ontbrekendeCel('niet_gemeten')
          : `<span class="${s.budget.status === 'boven-budget' ? 'trend-negatief' : 'trend-positief'}">${fmt.procent(besteed)}</span>
             <br><span class="muted klein">${esc(budgetstatusTerm(s.budget.status).kort)}</span>`,
        `${c.dataHealth} procent<br><span class="muted klein">${esc(s.dekking.dagenMetData)} van ${esc(s.dekking.totaalDagen)} dagen</span>`,
        esc(toonDatum(DATA_VOLLEDIG_TOT)),
      ];
    })
  );
}

/** Het primaire resultaat verschilt per dashboardtype. */
function primairResultaat(s) {
  const t = s.totalen;
  if (s.client.businessModel === BusinessModel.ECOMMERCE) {
    return `${fmt.euro(t.revenue)} omzet · ${t.roas == null ? ontbrekendeCel('onvoldoende_data') : `${fmt.ratio(t.roas)} rendement`}`;
  }
  if (s.client.businessModel === BusinessModel.LEADGEN) {
    return `${fmt.getal(t.leads)} leads · ${t.qualifiedLeads == null ? ontbrekendeCel('niet_gekoppeld') : `${fmt.getal(t.qualifiedLeads)} gekwalificeerd`}`;
  }
  return `${fmt.getal(t.impressions)} vertoningen · ${t.frequentie == null ? ontbrekendeCel('onvoldoende_data') : `${fmt.ratio(t.frequentie)} frequentie`}`;
}

/* ---------------------------------------------------------------
   Teambeheer
   --------------------------------------------------------------- */

export function renderAgencyTeam(user, { team, melding = null, filterbalk = '' }) {
  const kop = renderContextheader({
    kruimelpad: [{ label: 'Agency', href: '#/agency/overview' }, { label: 'Team' }],
    titel: 'Team',
    ondertitel: `${team.length} ${team.length === 1 ? 'medewerker' : 'medewerkers'} bij Aizy. Functietitel en toegangsniveau zijn twee verschillende gegevens.`,
    omgeving: 'agency',
  });

  return `
    ${kop}
    ${melding ? `<div class="banner banner-info" role="status"><span>${esc(melding)}</span></div>` : ''}
    ${filterbalk}

    <section class="card">
      <div class="kaart-kop">
        <h2>Medewerkers</h2>
        <button type="button" class="btn primary" id="nodigUitKnop">Medewerker uitnodigen</button>
      </div>

      <div class="table-scroll">
        ${tabel(
          [LABELS.medewerker, LABELS.functietitel, LABELS.toegangsniveau, LABELS.accountstatus,
            LABELS.toegewezenKlanten, 'Verantwoordelijk voor', 'Ondersteunt bij',
            'Klanten met aandachtspunten', LABELS.openActies, LABELS.laatsteLogin, 'Acties'],
          team.map((lid) => teamRij(lid))
        )}
      </div>
      <p class="muted note">
        De namen van het Aizy Performance Team zijn gebruikt om de demo herkenbaar
        te maken. Toegangsniveaus, klanttoewijzingen, inlogmomenten en
        accountstatussen zijn fictief. Er wordt geen prestatie per medewerker
        gemeten of vergeleken.
      </p>
    </section>`;
}

function teamRij(lid) {
  const g = lid.gebruiker;
  const rol = primaireRol(g);
  const niveau = toegangsniveauTerm(rol);
  const status = accountstatusTerm(g.status);

  const klantenlijst = (lijst) => (lijst.length
    ? lijst.map((s) => `<a class="link klein" href="#/agency/clients/${esc(s.client.id)}">${esc(s.client.name)}</a>`).join(', ')
    : '<span class="muted">Geen</span>');

  return [
    `<a class="link" href="#/agency/team/${esc(g.id)}">${esc(g.displayName)}</a><br><span class="muted klein">${esc(g.email)}</span>`,
    esc(g.jobTitle ?? 'Niet vastgelegd'),
    `<span title="${esc(niveau.omschrijving)}">${badge(niveau.kort, rol === 'agency_admin' ? 'ok' : 'muted')}</span>`,
    `<span title="${esc(status.omschrijving)}">${badge(status.kort, status.variant)}</span>`,
    lid.isBeheerder
      ? '<span class="muted">Alle klanten</span>'
      : `${lid.toegewezen.length}`,
    klantenlijst(lid.primair),
    klantenlijst(lid.ondersteunend),
    lid.aandachtNodig.length ? `<span class="trend-negatief">${lid.aandachtNodig.length}</span>` : '0',
    String(lid.openSignalen),
    g.laatsteLogin
      ? new Date(g.laatsteLogin).toLocaleDateString('nl-NL')
      : '<span class="muted">Nog niet ingelogd</span>',
    teamActies(g, lid.isBeheerder),
  ];
}

function teamActies(lid, isBeheerder) {
  const knoppen = [];
  const naam = esc(lid.displayName);

  if (!isBeheerder) {
    knoppen.push(`<button type="button" class="btn klein" data-actie="wijzig-klanten" data-user="${esc(lid.id)}">Klanttoewijzing wijzigen</button>`);
    knoppen.push(`<button type="button" class="btn klein" data-actie="wijzig-rol" data-user="${esc(lid.id)}">Toegangsniveau wijzigen</button>`);
  }
  if (lid.status === AccountStatus.UITGENODIGD) {
    knoppen.push(`<button type="button" class="btn klein" data-actie="opnieuw-uitnodigen" data-user="${esc(lid.id)}">Uitnodiging opnieuw versturen</button>`);
  }
  if (lid.status === AccountStatus.ACTIEF && !isBeheerder) {
    knoppen.push(`<button type="button" class="btn klein gevaar" data-actie="deactiveer" data-user="${esc(lid.id)}"
      aria-label="Account van ${naam} deactiveren">Account deactiveren</button>`);
  }
  if (lid.status === AccountStatus.GEDEACTIVEERD) {
    knoppen.push(`<button type="button" class="btn klein" data-actie="activeer" data-user="${esc(lid.id)}"
      aria-label="Account van ${naam} activeren">Account activeren</button>`);
  }

  return knoppen.length ? `<div class="actie-groep">${knoppen.join('')}</div>` : '<span class="muted">Geen acties</span>';
}

/* ---------------------------------------------------------------
   Medewerkerdetail
   --------------------------------------------------------------- */

export function renderMedewerkerDetail(user, { lid, filterbalk = '' }) {
  if (!lid) return null;
  const g = lid.gebruiker;
  const rol = primaireRol(g);
  const niveau = toegangsniveauTerm(rol);
  const status = accountstatusTerm(g.status);

  return `
    ${renderContextheader({
      kruimelpad: [
        { label: 'Agency', href: '#/agency/overview' },
        { label: 'Team', href: '#/agency/team' },
        { label: g.displayName },
      ],
      titel: g.displayName,
      ondertitel: g.jobTitle ? `${g.jobTitle} bij Aizy.` : 'Functietitel niet vastgelegd.',
      omgeving: 'agency',
      labels: [
        { tekst: niveau.kort, variant: rol === 'agency_admin' ? 'ok' : 'muted', uitleg: niveau.omschrijving },
        { tekst: status.kort, variant: status.variant, uitleg: status.omschrijving },
      ],
      actie: { href: '#/agency/team', tekst: 'Terug naar teamoverzicht' },
    })}

    <section class="card">
      <h2>Account</h2>
      <div class="table-scroll">
        ${tabel(['Onderdeel', 'Waarde'], [
          [LABELS.volledigeNaam, `${renderAvatar(g)} ${esc(g.displayName)}`],
          ['E-mailadres', esc(g.email)],
          [LABELS.functietitel, esc(g.jobTitle ?? 'Niet vastgelegd')],
          [LABELS.organisatie, 'Aizy'],
          [LABELS.toegangsniveau, `${badge(niveau.kort, rol === 'agency_admin' ? 'ok' : 'muted')}<br><span class="muted klein">${esc(niveau.omschrijving)}</span>`],
          [LABELS.accountstatus, `${badge(status.kort, status.variant)}<br><span class="muted klein">${esc(status.omschrijving)}</span>`],
          [LABELS.laatsteLogin, g.laatsteLogin ? new Date(g.laatsteLogin).toLocaleString('nl-NL') : '<span class="muted">Nog niet ingelogd</span>'],
        ])}
      </div>
    </section>

    ${renderMedewerkerKlanten(lid)}

    <section class="card">
      <p class="muted note">
        Klanttoewijzingen, activiteit en accountgegevens in deze demo zijn fictief.
        Er worden geen individuele prestaties gemeten of vergeleken.
      </p>
    </section>`;
}

function renderMedewerkerKlanten(lid) {
  if (lid.isBeheerder) {
    return `<section class="card">
      <h2>Klanttoegang</h2>
      <p class="muted">
        Een agencybeheerder heeft toegang tot alle klanten. Toegang is iets
        anders dan verantwoordelijkheid: hieronder staan de klanten waarvoor
        deze medewerker het aanspreekpunt is.
      </p>
      ${lid.primair.length
        ? `<div class="table-scroll">${klantVerantwoordelijkheidTabel(lid.primair, 'Verantwoordelijk')}</div>`
        : '<p class="empty">Deze medewerker is voor geen enkele klant het aanspreekpunt.</p>'}
    </section>`;
  }

  if (!lid.toegewezen.length) {
    return `<section class="card" id="geenKlanten">
      <h2>Er zijn nog geen klanten aan dit account toegewezen</h2>
      <p class="muted">
        Een agencybeheerder kan klanten aan deze portefeuille toevoegen. Tot die
        tijd ziet deze medewerker geen klantdata.
      </p>
    </section>`;
  }

  return `<section class="card">
    <h2>Klanten</h2>
    <div class="table-scroll">
      ${klantVerantwoordelijkheidTabel(lid.toegewezen, null, lid)}
    </div>
  </section>`;
}

function klantVerantwoordelijkheidTabel(lijst, vasteRol, lid = null) {
  return tabel(
    [LABELS.klant, LABELS.dashboardtype, 'Rol bij deze klant', 'Status', LABELS.prioriteit],
    lijst.map((s) => [
      `<a class="link" href="#/agency/clients/${esc(s.client.id)}">${esc(s.client.name)}</a>`,
      badge(dashboardtypeTerm(s.model).kort, 'muted'),
      vasteRol
        ? badge(vasteRol, 'ok')
        : s.client.primaryOwnerId === lid?.gebruiker.id
          ? badge('Verantwoordelijk', 'ok')
          : badge('Ondersteunend', 'muted'),
      `${badge(s.status.label, s.status.variant)}<br><span class="muted klein">${esc(s.status.reden)}</span>`,
      renderPrioriteit(s.prioriteit, { compact: true }),
    ])
  );
}

/* ---------------------------------------------------------------
   Signalen en acties als eigen pagina
   --------------------------------------------------------------- */

export function renderAgencySignals(user, { signalen, samenvattingen, filters, filterbalk = '' }) {
  return `
    ${renderContextheader({
      kruimelpad: [{ label: 'Agency', href: '#/agency/overview' }, { label: 'Signalen' }],
      titel: 'Signalen',
      ondertitel: `${signalen.length} ${signalen.length === 1 ? 'signaal' : 'signalen'} binnen ${toonBereik(filters.periode.startDate, filters.periode.endDate)}.`,
      omgeving: 'agency',
    })}
    ${filterbalk}
    ${renderSignalen(signalen, samenvattingen, filters)}`;
}

export function renderAgencyActions(user, { signalen, samenvattingen, filters, filterbalk = '' }) {
  const naam = (id) => samenvattingen.find((s) => s.client.id === id)?.client.name ?? 'Onbekend';

  return `
    ${renderContextheader({
      kruimelpad: [{ label: 'Agency', href: '#/agency/overview' }, { label: 'Acties' }],
      titel: 'Acties',
      ondertitel: `Acties die volgen uit de signalen binnen ${toonBereik(filters.periode.startDate, filters.periode.endDate)}.`,
      omgeving: 'agency',
    })}
    ${filterbalk}
    <section class="card">
      ${!signalen.length
        ? '<p class="empty">Er zijn geen acties binnen deze periode en kanaalselectie. Verruim de periode om oudere signalen te zien.</p>'
        : `<div class="table-scroll">${tabel(
            ['Aanbevolen actie', LABELS.klant, 'Kanaal', LABELS.verantwoordelijke, 'Urgentie', 'Openstaand sinds'],
            signalen.map((s) => {
              const klant = samenvattingen.find((x) => x.client.id === s.klantId);
              return [
                esc(s.aanbeveling),
                esc(naam(s.klantId)),
                esc(s.kanaalLabel ?? kanaalLabel(s.kanaal)),
                klant?.team.primair ? esc(klant.team.primair.displayName) : ontbrekendeCel('niet_van_toepassing'),
                badge(s.ernst === 'hoog' ? 'Hoge urgentie' : 'Gemiddelde urgentie', s.ernst === 'hoog' ? 'hoog' : 'middel'),
                esc(toonDatum(s.startdatum)),
              ];
            })
          )}</div>`}
    </section>`;
}

export function renderAgencySettings(user) {
  const rol = primaireRol(user);
  const niveau = toegangsniveauTerm(rol);

  return `
    ${renderContextheader({
      kruimelpad: [{ label: 'Agency', href: '#/agency/overview' }, { label: 'Instellingen' }],
      titel: 'Instellingen',
      ondertitel: 'Je account en de databronnen van deze omgeving.',
      omgeving: 'agency',
    })}
    <section class="card">
      <h2>Jouw account</h2>
      <div class="table-scroll">
        ${tabel(['Onderdeel', 'Waarde'], [
          [LABELS.volledigeNaam, esc(user.displayName)],
          ['E-mailadres', esc(user.email)],
          [LABELS.functietitel, esc(user.jobTitle ?? 'Niet vastgelegd')],
          [LABELS.organisatie, 'Aizy'],
          [LABELS.toegangsniveau, `${esc(niveau.kort)}<br><span class="muted klein">${esc(niveau.omschrijving)}</span>`],
        ])}
      </div>
    </section>
    <section class="card">
      <h2>Databronnen</h2>
      <p class="muted">
        Deze demo gebruikt vaste demodata met dagelijkse reeksen. Koppelingen met
        Google Ads, Meta Ads, Microsoft Ads, LinkedIn Ads, Google Analytics 4 en
        CRM worden ingericht zodra de Azure-backend beschikbaar is.
      </p>
    </section>`;
}
