/**
 * Mijn werk.
 *
 * De persoonlijke startpagina van een Aizy-medewerker. Hij beantwoordt de
 * vragen van een werkdag, in deze volgorde:
 *
 *   welke acties vragen vandaag aandacht
 *   welke deadlines komen eraan
 *   welke klanten hebben prioriteit
 *   welke meetings staan gepland
 *   welke signalen zijn nieuw
 *   waar wachten we op de klant
 *
 * De indeling is van de gebruiker. Widgets zijn te verslepen, te verbergen, toe
 * te voegen, te vergroten en te verkleinen, en de indeling wordt per gebruiker
 * bewaard. Dat is geen speelgoed: wie zijn dag met de agenda begint en wie met
 * de signalen, werkt anders, en een vaste volgorde dient altijd één van beiden
 * slecht.
 */

import { fmt, esc, badge } from './components.js';
import { emptyState } from '../ui/states.js';
import { renderWidgetGrid } from '../ui/widget-grid.js';
import { ActieStatus } from '../model/actions.js';
import { SignaalStatus } from '../model/signals.js';
import { ItemBron } from '../model/planning.js';
import { toonDatum, toonKorteDatum, DEMO_TODAY, plusDagen } from '../filters/period.js';
import { dashboardtypeTerm, budgetstatusTerm, LABELS } from '../terminology.js';
import { DekkingStatus, PacingStatus } from '../data/selectors.js';
import { kanaalLabel } from '../filters/channels.js';
import { hoofdreden } from './portfolio.js';

export const WERK_TABS = [
  { key: 'vandaag', label: 'Vandaag' },
  { key: 'acties', label: 'Mijn acties' },
  { key: 'planning', label: 'Mijn planning' },
  { key: 'signalen', label: 'Mijn signalen' },
];

/** Dagdeel voor de begroeting, met een vaste referentietijd voor de demo. */
export const DEMO_UUR = 10;

export function dagdeel(uur = DEMO_UUR) {
  if (uur < 6) return 'Goedenacht';
  if (uur < 12) return 'Goedemorgen';
  if (uur < 18) return 'Goedemiddag';
  return 'Goedenavond';
}

/* ---------------------------------------------------------------
   Vandaag
   --------------------------------------------------------------- */

export function renderVandaag({
  user, indeling, bewerken, persoonlijk, acties, signalen, planning, recenteKlanten,
}) {
  if (!persoonlijk.samenvattingen.length) {
    return emptyState({
      titel: 'Er zijn nog geen klanten aan je account toegewezen',
      uitleg: 'Een agencybeheerder kan klanten aan je portefeuille toevoegen. Zodra dat is gebeurd, verschijnen ze hier met hun resultaten en aandachtspunten.',
      id: 'geenKlanten',
    });
  }

  const bouwers = {
    'acties-vandaag': () => widgetActiesVandaag(acties),
    meetings: () => widgetMeetings(planning),
    'klanten-aandacht': () => widgetKlantenAandacht(persoonlijk),
    'nieuwe-signalen': () => widgetSignalen(signalen),
    'wacht-op-klant': () => widgetWachtOpKlant(acties),
    budget: () => widgetBudget(persoonlijk),
    meetproblemen: () => widgetMeetproblemen(persoonlijk),
    'recente-klanten': () => widgetRecenteKlanten(recenteKlanten),
    'recente-wijzigingen': () => widgetRecenteWijzigingen(persoonlijk),
  };

  return renderWidgetGrid({
    indeling,
    bewerken,
    inhoudVoor: (id) => (bouwers[id] ? bouwers[id]() : '<p class="muted klein">Deze widget bestaat niet meer.</p>'),
  });
}

/* ---------------------------------------------------------------
   Widgets
   --------------------------------------------------------------- */

function lijst(items, leegTekst) {
  if (!items.length) return `<p class="muted klein widget-leeg">${esc(leegTekst)}</p>`;
  return `<ul class="widget-lijst">${items.join('')}</ul>`;
}

function widgetActiesVandaag(acties) {
  const morgen = plusDagen(DEMO_TODAY, 1);
  const relevant = acties.filter((a) => a.status !== ActieStatus.AFGEROND
    && (a.verlopen || a.startdatum === DEMO_TODAY || (a.deadline && a.deadline <= morgen)));

  return `
    ${lijst(relevant.slice(0, 6).map((a) => `<li>
      <button type="button" class="link" data-actiepaneel="${esc(a.id)}">${esc(a.titel)}</button>
      <span class="muted klein">${esc(a.klantNaam)} · ${esc(a.statusTerm.kort)}</span>
      ${a.verlopen ? badge('Deadline verstreken', 'hoog') : a.deadline ? badge(`Deadline ${toonKorteDatum(a.deadline)}`, 'middel') : ''}
    </li>`), acties.length
      ? 'Er staat vandaag niets op je lijst met een deadline.'
      : 'Er staan geen acties op jouw naam. Bij Acties zie je waar je collega’s aan werken.')}
    <a class="link-klein" href="#/agency/work?tab=acties">Al je acties bekijken</a>
    <a class="link-klein" href="#/agency/actions">Acties van het hele team</a>`;
}

function widgetMeetings(planning) {
  const grens = plusDagen(DEMO_TODAY, 7);
  const meetings = planning
    .filter((i) => i.bron === ItemBron.MEETING && i.datum >= DEMO_TODAY && i.datum <= grens)
    .sort((a, b) => a.datum.localeCompare(b.datum));

  return `
    ${lijst(meetings.slice(0, 5).map((m) => `<li>
      <span class="widget-titel">${esc(m.titel)}</span>
      <span class="muted klein">${esc(toonDatum(m.datum))}${m.starttijd ? ` om ${esc(m.starttijd)}` : ''} · ${esc(m.klantNaam)}</span>
    </li>`), 'Geen meetings in de komende zeven dagen.')}
    <a class="link-klein" href="#/agency/work?tab=planning">Naar je planning</a>`;
}

/**
 * Jouw rol bij deze klant.
 *
 * Er waren twee gevallen: verantwoordelijk, of "je ondersteunt hier". Een
 * agencybeheerder is geen van beide -- hij ziet alle klanten omdat hij alles mag
 * zien, niet omdat hij eraan werkt. Die viel in het tweede geval, en dan staat
 * er "Je ondersteunt hier" bij vier klanten terwijl de kop van dezelfde pagina
 * meldt dat je bij nul klanten ondersteunt. Beide waren waar over hun eigen
 * telling en spraken elkaar op het scherm tegen.
 *
 * Geen rol geeft ook geen regel. De kop van de pagina meldt al dat je bij geen
 * van deze klanten als vaste medewerker staat; dat er dan onder alle vier de
 * klanten "Je hebt toegang, geen rol" komt te staan voegt daar niets aan toe en
 * duwt de reden waaróm een klant aandacht vraagt een regel naar beneden.
 */
function rolTekst(s) {
  if (s.verantwoordelijk) return 'Jij bent verantwoordelijk';
  if (s.ondersteunend) return 'Je ondersteunt hier';
  return '';
}

/**
 * Klanten met aandacht.
 * Draagt bewust het id `vandaagAandacht`: dit is de opvolger van het blok dat
 * eerder zo heette op het persoonlijke overzicht.
 */
function widgetKlantenAandacht(persoonlijk) {
  const items = [...persoonlijk.vandaagAandacht, ...persoonlijk.dezeWeek];

  return `<div id="vandaagAandacht">
    ${lijst(items.slice(0, 5).map((s) => {
      const rol = rolTekst(s);
      return `<li>
        <button type="button" class="link" data-klantpaneel="${esc(s.client.id)}">${esc(s.client.name)}</button>
        ${badge(s.prioriteit.label, s.prioriteit.variant)}
        ${badge(dashboardtypeTerm(s.model).kort, 'muted')}
        <span class="muted klein">${esc(hoofdreden(s))}</span>
        ${rol ? `<span class="muted klein">${esc(rol)}</span>` : ''}
      </li>`;
    }), 'Binnen deze selectie liggen al je klanten op koers en is de meting volledig.')}
    <a class="link-klein" href="#/agency/clients">Al je klanten bekijken</a>
  </div>`;
}

function widgetSignalen(signalen) {
  const nieuw = signalen.filter((s) => s.status === SignaalStatus.NIEUW);

  return `
    ${lijst(nieuw.slice(0, 5).map((s) => `<li>
      <button type="button" class="link" data-signaalpaneel="${esc(s.id)}">${esc(s.probleem)}</button>
      <span class="muted klein">${esc(s.klantNaam)} · ${esc(s.kanaalLabel)}</span>
      ${badge(s.ernst === 'hoog' ? 'Hoge urgentie' : 'Gemiddelde urgentie', s.ernst === 'hoog' ? 'hoog' : 'middel')}
    </li>`), 'Er zijn geen nieuwe signalen binnen deze periode en kanaalselectie.')}
    <a class="link-klein" href="#/agency/signals">Naar het signaalcentrum</a>`;
}

function widgetWachtOpKlant(acties) {
  const wacht = acties.filter((a) => a.status === ActieStatus.WACHT_OP_KLANT);

  return lijst(wacht.slice(0, 5).map((a) => `<li>
    <button type="button" class="link" data-actiepaneel="${esc(a.id)}">${esc(a.titel)}</button>
    <span class="muted klein">${esc(a.klantNaam)}${a.deadline ? ` · verwacht voor ${toonDatum(a.deadline)}` : ''}</span>
  </li>`), 'Er ligt geen werk stil in afwachting van een klant.');
}

function widgetBudget(persoonlijk) {
  const afwijkend = persoonlijk.samenvattingen.filter(
    (s) => s.budget.status === PacingStatus.BOVEN_BUDGET || s.budget.status === PacingStatus.ONDER_BUDGET
  );

  return lijst(afwijkend.slice(0, 5).map((s) => `<li>
    <button type="button" class="link" data-klantpaneel="${esc(s.client.id)}">${esc(s.client.name)}</button>
    ${badge(budgetstatusTerm(s.budget.status).kort, s.budget.status === PacingStatus.BOVEN_BUDGET ? 'hoog' : 'middel')}
    <span class="muted klein">${esc(fmt.euro(s.budget.uitgaven))} van ${esc(fmt.euro(s.budget.budget))}</span>
  </li>`), 'Alle budgetten liggen op schema binnen deze periode.');
}

/**
 * Wat er bij deze klant aan de meting mankeert.
 *
 * De lijst bevat twee verschillende problemen -- een kapotte teller en een gat
 * in de dekking -- en die werden door elkaar getekend: de badge kwam uit de
 * trackingstatus, de regel eronder uit de dekking. Bij een klant met een kapotte
 * teller en een volledige periode stond er letterlijk "Meting onvolledig" boven
 * "30 van 30 dagen met gegevens". Iedere regel noemt nu het probleem dat híj
 * heeft, met de onderbouwing die daarbij hoort.
 *
 * De derde toestand is geen probleem maar vertraging: bij een periode die tot
 * vandaag loopt zijn de laatste dagen simpelweg nog niet binnen. Dat als
 * meetprobleem melden leert de lezer de widget te negeren.
 */
function meetprobleem(s) {
  const gemist = s.dekking.totaalDagen - s.dekking.dagenMetData;

  if (s.client.trackingStatus === 'probleem') {
    return {
      label: 'Meting onvolledig',
      variant: 'hoog',
      tekst: `Datakwaliteit ${s.client.dataHealth} procent${gemist > 0 ? `, en ${gemist} van de ${s.dekking.totaalDagen} dagen zonder gegevens` : ''}`,
    };
  }

  if (s.dekking.status === DekkingStatus.GEEN_DATA) {
    return {
      label: 'Geen gegevens',
      variant: 'hoog',
      tekst: `Geen enkele dag met gegevens in deze periode van ${s.dekking.totaalDagen} dagen`,
    };
  }

  if (s.dekking.bevatVoorlopigeDagen && !s.dekking.kanalenZonderData.length) {
    return {
      label: 'Nog niet compleet',
      variant: 'muted',
      tekst: `De bronnen zijn compleet tot en met ${toonDatum(s.dekking.volledigTot)}; de dagen daarna komen nog binnen`,
    };
  }

  const kanalen = s.dekking.kanalenZonderData.map(kanaalLabel);
  return {
    label: 'Dekking onvolledig',
    variant: 'middel',
    tekst: kanalen.length
      ? `Geen gegevens uit ${kanalen.join(' en ')}`
      : `${gemist} van de ${s.dekking.totaalDagen} dagen zonder gegevens`,
  };
}

function widgetMeetproblemen(persoonlijk) {
  const problemen = persoonlijk.datakwaliteit;

  return lijst(problemen.slice(0, 5).map((s) => {
    const p = meetprobleem(s);
    return `<li>
      <button type="button" class="link" data-klantpaneel="${esc(s.client.id)}">${esc(s.client.name)}</button>
      ${badge(p.label, p.variant)}
      <span class="muted klein">${esc(p.tekst)}</span>
    </li>`;
  }), 'Alle bronnen van je klanten leveren volledige gegevens binnen deze periode.');
}

function widgetRecenteKlanten(recente) {
  return lijst(recente.slice(0, 6).map((c) => `<li>
    <button type="button" class="link" data-klantpaneel="${esc(c.id)}">${esc(c.name)}</button>
    <span class="muted klein">${esc(dashboardtypeTerm(c.model ?? 'leadgen').kort)}</span>
  </li>`), 'Je hebt in deze sessie nog geen klant geopend.');
}

function widgetRecenteWijzigingen(persoonlijk) {
  return lijst(persoonlijk.recenteVeranderingen.slice(0, 5).map((v) => `<li>
    <button type="button" class="link" data-klantpaneel="${esc(v.clientId)}">${esc(v.clientNaam)}</button>
    <span class="trend-${esc(v.richting)}">${esc(v.delta.tekst)}</span>
    <span class="muted klein">${esc(v.metriek === 'revenue' ? 'omzet' : 'leads')}: ${esc(fmt.getal(v.delta.vorig))} naar ${esc(fmt.getal(v.delta.huidig))}</span>
  </li>`), 'Binnen deze selectie zijn er geen veranderingen groter dan 5 procent.');
}

export { DekkingStatus, LABELS };
