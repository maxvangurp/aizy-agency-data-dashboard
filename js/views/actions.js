/**
 * Actiecentrum.
 *
 * Drie weergaven op precies dezelfde gegevens:
 *
 *   lijst    een configureerbare tabel, om te filteren en te overzien
 *   bord     vijf statuskolommen, om te verplaatsen
 *   agenda   een week, om te plannen
 *
 * De weergaven delen geen kopie maar dezelfde bron. Een status die op het bord
 * verandert, staat een tel later in de lijst en in de agenda. Dat is geen
 * bijzaak: een bord dat iets anders zegt dan de lijst maakt het hele product
 * onbetrouwbaar.
 *
 * SLEPEN EN HET ALTERNATIEF
 * Iedere kaart heeft een sleepgreep én een keuzelijst voor de status. Elk
 * agenda-item heeft een sleepgreep én twee knoppen om een dag op te schuiven.
 * Beide schrijven naar hetzelfde model.
 */

import { esc, badge } from './components.js';
import { emptyState } from '../ui/states.js';
import { renderDataGrid } from '../ui/data-grid.js';
import { sleepbaar, dropzone } from '../ui/dnd.js';
import { ACTIE_STATUSSEN, ACTIE_PRIORITEITEN, ACTIE_SOORTEN, ActieStatus } from '../model/actions.js';
import { beginVanWeek, maandRooster } from '../model/planning.js';
import { toonDatum, toonKorteDatum, plusDagen, DEMO_TODAY, datumReeks } from '../filters/period.js';
import { kanaalLabel, ADVERTENTIEKANAAL_KEYS } from '../filters/channels.js';
import { LABELS } from '../terminology.js';

export const ACTIE_TABS = [
  { key: 'lijst', label: 'Lijst' },
  { key: 'bord', label: 'Bord' },
  { key: 'agenda', label: 'Agenda' },
];

/* ---------------------------------------------------------------
   Tabeldefinitie
   --------------------------------------------------------------- */

export function actiesDefinitie({ klanten, medewerkers, pagina = 'acties' }) {
  return {
    id: 'acties',
    pagina,
    titel: 'Acties',
    omschrijving: 'Alle acties die je mag zien, met status, verantwoordelijke en deadline.',
    rijId: (a) => a.id,
    zoektekst: (a) => `${a.titel} ${a.omschrijving} ${a.klantNaam} ${a.verantwoordelijkeNaam}`,
    standaardSortering: { key: 'deadline', richting: 'op' },

    kolommen: [
      {
        key: 'titel',
        label: 'Actie',
        verplicht: true,
        vast: true,
        breedte: 300,
        waarde: (a) => a.titel,
        cel: (a) => `<button type="button" class="link" data-actiepaneel="${esc(a.id)}">${esc(a.titel)}</button>
          ${a.verlopen ? `<br>${badge('Deadline verstreken', 'hoog')}` : ''}`,
      },
      {
        key: 'klant',
        label: LABELS.klant,
        groepeerbaar: true,
        waarde: (a) => a.klantNaam,
        cel: (a) => esc(a.klantNaam),
      },
      {
        key: 'status',
        label: 'Status',
        groepeerbaar: true,
        waarde: (a) => ACTIE_STATUSSEN.findIndex((s) => s.key === a.status),
        groepWaarde: (a) => a.statusTerm.kort,
        cel: (a) => `<span class="badge badge-${esc(a.statusTerm.variant)}" title="${esc(a.statusTerm.omschrijving)}">${esc(a.statusTerm.kort)}</span>`,
      },
      {
        key: 'prioriteit',
        label: LABELS.prioriteit,
        groepeerbaar: true,
        waarde: (a) => a.prioriteitTerm.punten,
        groepWaarde: (a) => a.prioriteitTerm.kort,
        cel: (a) => badge(a.prioriteitTerm.kort, a.prioriteitTerm.variant),
      },
      {
        key: 'verantwoordelijke',
        label: LABELS.verantwoordelijke,
        groepeerbaar: true,
        waarde: (a) => a.verantwoordelijkeNaam,
        cel: (a) => esc(a.verantwoordelijkeNaam),
      },
      {
        key: 'kanaal',
        label: 'Kanaal',
        groepeerbaar: true,
        waarde: (a) => a.kanaalNaam,
        cel: (a) => `<span class="muted">${esc(a.kanaalNaam)}</span>`,
      },
      {
        key: 'soort',
        label: 'Soort werk',
        standaard: false,
        groepeerbaar: true,
        waarde: (a) => a.soortTerm.kort,
        cel: (a) => esc(a.soortTerm.kort),
      },
      {
        key: 'startdatum',
        label: 'Startdatum',
        standaard: false,
        waarde: (a) => a.startdatum,
        cel: (a) => (a.startdatum ? esc(toonDatum(a.startdatum)) : '<span class="muted klein">Niet ingepland</span>'),
      },
      {
        key: 'deadline',
        label: 'Deadline',
        waarde: (a) => a.deadline,
        cel: (a) => (a.deadline
          ? `<span class="${a.verlopen ? 'trend-negatief' : ''}">${esc(toonDatum(a.deadline))}</span>`
          : '<span class="muted klein">Geen deadline</span>'),
      },
      {
        key: 'signaal',
        label: 'Gekoppeld signaal',
        standaard: false,
        sorteerbaar: false,
        waarde: (a) => (a.signaalId ? 'ja' : 'nee'),
        cel: (a) => (a.signaalId
          ? `<button type="button" class="link-klein" data-signaalpaneel="${esc(a.signaalId)}">Signaal openen</button>`
          : '<span class="muted klein">Geen</span>'),
      },
      {
        key: 'gewijzigd',
        label: 'Laatste wijziging',
        standaard: false,
        waarde: (a) => a.gewijzigdOp,
        cel: (a) => `<span class="muted klein">${esc(new Date(a.gewijzigdOp).toLocaleString('nl-NL'))}</span>`,
      },
      {
        key: 'klantzichtbaar',
        label: 'Gedeeld met klant',
        standaard: false,
        waarde: (a) => (a.zichtbaarVoorKlant ? 'ja' : 'nee'),
        cel: (a) => (a.zichtbaarVoorKlant ? badge('Zichtbaar voor klant', 'ok') : '<span class="muted klein">Intern</span>'),
      },
    ],

    filters: [
      {
        key: 'status',
        label: 'Status',
        opties: ACTIE_STATUSSEN.map((s) => ({ waarde: s.key, label: s.kort })),
        test: (a, waarde) => a.status === waarde,
      },
      {
        key: 'prioriteit',
        label: LABELS.prioriteit,
        opties: ACTIE_PRIORITEITEN.map((p) => ({ waarde: p.key, label: p.kort })),
        test: (a, waarde) => a.prioriteit === waarde,
      },
      {
        key: 'klant',
        label: LABELS.klant,
        opties: klanten.map((c) => ({ waarde: c.id, label: c.name })),
        test: (a, waarde) => a.klantId === waarde,
      },
      {
        key: 'verantwoordelijke',
        label: LABELS.verantwoordelijke,
        opties: medewerkers.map((m) => ({ waarde: m.id, label: m.displayName })),
        test: (a, waarde) => a.verantwoordelijkeId === waarde,
      },
      {
        key: 'kanaal',
        label: 'Kanaal',
        opties: ADVERTENTIEKANAAL_KEYS.map((k) => ({ waarde: k, label: kanaalLabel(k) })),
        test: (a, waarde) => a.kanaal === waarde,
      },
      {
        key: 'soort',
        label: 'Soort werk',
        opties: ACTIE_SOORTEN.map((s) => ({ waarde: s.key, label: s.kort })),
        test: (a, waarde) => a.soort === waarde,
      },
    ],

    weergaven: [
      { id: 'open', naam: 'Alles wat openstaat', staat: { filters: {}, sortering: { key: 'deadline', richting: 'op' } } },
      { id: 'hoge-prioriteit', naam: 'Hoge prioriteit', staat: { filters: { prioriteit: 'hoog' } } },
      { id: 'wacht-op-klant', naam: 'Wacht op klant', staat: { filters: { status: ActieStatus.WACHT_OP_KLANT } } },
      { id: 'deze-week', naam: 'Deze week controleren', staat: { filters: { status: ActieStatus.GEPLAND }, sortering: { key: 'startdatum', richting: 'op' } } },
      { id: 'google-ads', naam: 'Google Ads', staat: { filters: { kanaal: 'google_ads' } } },
      { id: 'per-medewerker', naam: 'Per medewerker', staat: { groepering: 'verantwoordelijke' } },
    ],

    bulkacties: [
      { id: 'status-bezig', label: 'Op Bezig zetten' },
      { id: 'status-afgerond', label: 'Afronden' },
      { id: 'prioriteit-hoog', label: 'Prioriteit op hoog' },
    ],
  };
}

/* ---------------------------------------------------------------
   Weergave
   --------------------------------------------------------------- */

export function renderActies({
  tab, acties, definitie, gridStaat, gridVerwerkt, gridWeergaven, gridSelectie,
  magBewerken, klanten, medewerkers, formOpen, weekStart,
}) {
  const formulier = magBewerken ? renderNieuweActie({ klanten, medewerkers, open: formOpen }) : '';

  if (!acties.length && !formOpen) {
    return formulier + emptyState({
      titel: 'Er staan geen acties open',
      uitleg: 'Zet een signaal om in een actie, of maak er zelf een aan.',
      actie: magBewerken ? { id: 'nieuweActieKnopLeeg', label: 'Actie aanmaken' } : null,
      id: 'actiesLeeg',
    });
  }

  if (tab === 'bord') return formulier + renderBord(acties, magBewerken);
  if (tab === 'agenda') return formulier + renderAgenda(acties, magBewerken, weekStart);

  return formulier + renderDataGrid({
    definitie,
    staat: gridStaat,
    verwerkt: gridVerwerkt,
    selectie: gridSelectie,
    weergaven: gridWeergaven,
    magBewerken,
    leegTitel: 'Geen acties met deze filters',
    leegUitleg: 'Pas de filters of de zoekterm aan om meer acties te zien.',
  });
}

/* ---------------------------------------------------------------
   Bord
   --------------------------------------------------------------- */

function renderBord(acties, magBewerken) {
  return `<div class="kanban" id="actieBord">
    ${ACTIE_STATUSSEN.map((status) => {
      const kolom = acties.filter((a) => a.status === status.key);
      return `<section class="kanban-kolom" ${dropzone('actie', status.key, { label: `Kolom ${status.kort}` })}
        data-kolom="${esc(status.key)}" aria-labelledby="kanban-${esc(status.key)}">
        <header class="kanban-kop">
          <h3 id="kanban-${esc(status.key)}">${esc(status.kort)}</h3>
          <span class="kanban-teller" data-teller="${esc(status.key)}">${kolom.length}</span>
        </header>
        <p class="visueel-verborgen">${esc(status.omschrijving)}</p>
        <div class="kanban-kaarten">
          ${kolom.length
            ? kolom.map((a) => renderKaart(a, magBewerken)).join('')
            : '<p class="kanban-leeg muted klein">Geen acties in deze kolom.</p>'}
        </div>
      </section>`;
    }).join('')}
  </div>`;
}

function renderKaart(actie, magBewerken) {
  return `<article class="kanban-kaart" data-actie="${esc(actie.id)}"
    ${sleepbaar('actie', actie.id, { label: `Actie ${actie.titel}` })}>
    <div class="kanban-kaart-kop">
      ${magBewerken ? '<span class="sleepgreep" data-sleepgreep title="Verslepen" aria-hidden="true">⠿</span>' : ''}
      <button type="button" class="link kanban-titel" data-actiepaneel="${esc(actie.id)}">${esc(actie.titel)}</button>
    </div>
    <p class="kanban-klant">${esc(actie.klantNaam)} · ${esc(actie.kanaalNaam)}</p>
    <div class="kanban-labels">
      ${badge(actie.prioriteitTerm.kort, actie.prioriteitTerm.variant)}
      ${actie.deadline ? badge(`Deadline ${toonKorteDatum(actie.deadline)}`, actie.verlopen ? 'hoog' : 'muted') : ''}
    </div>
    <p class="kanban-eigenaar muted klein">${esc(actie.verantwoordelijkeNaam)}</p>
    ${magBewerken ? `<div class="kanban-verplaats">
      <label class="visueel-verborgen" for="verplaats-${esc(actie.id)}">Status van ${esc(actie.titel)} wijzigen</label>
      <select id="verplaats-${esc(actie.id)}" data-actie-status="${esc(actie.id)}">
        ${ACTIE_STATUSSEN.map((s) => `<option value="${esc(s.key)}"${s.key === actie.status ? ' selected' : ''}>${esc(s.kort)}</option>`).join('')}
      </select>
    </div>` : ''}
  </article>`;
}

/* ---------------------------------------------------------------
   Agenda
   --------------------------------------------------------------- */

/**
 * De weekweergave van de acties.
 *
 * Alleen acties met een startdatum staan in de agenda. Acties zonder datum
 * horen in de kolom Nieuw op het bord; ze in de agenda op vandaag zetten zou
 * een planning suggereren die niemand heeft gemaakt. Ze staan daarom apart
 * onder de week, met een knop om ze in te plannen.
 */
function renderAgenda(acties, magBewerken, weekStart) {
  const start = weekStart ?? beginVanWeek(DEMO_TODAY);
  const dagen = datumReeks(start, plusDagen(start, 6));
  const zonderDatum = acties.filter((a) => !a.startdatum);

  return `
    <div class="agenda-balk">
      <button type="button" class="btn klein" data-week="vorige">Vorige week</button>
      <button type="button" class="btn klein" data-week="vandaag">Deze week</button>
      <button type="button" class="btn klein" data-week="volgende">Volgende week</button>
      <span class="muted klein">Week van ${esc(toonDatum(start))} tot en met ${esc(toonDatum(plusDagen(start, 6)))}</span>
    </div>

    <div class="agenda-week" id="actieAgenda">
      ${dagen.map((datum) => {
        const items = acties.filter((a) => a.startdatum === datum);
        const isVandaag = datum === DEMO_TODAY;
        return `<section class="agenda-dag${isVandaag ? ' is-vandaag' : ''}"
          ${dropzone('actie-datum', datum, { label: `Dag ${toonDatum(datum)}` })}
          data-datum="${esc(datum)}" aria-labelledby="dag-${esc(datum)}">
          <header class="agenda-dagkop">
            <h3 id="dag-${esc(datum)}">${esc(dagnaam(datum))}</h3>
            <span class="muted klein">${esc(toonKorteDatum(datum))}</span>
          </header>
          <div class="agenda-items">
            ${items.length
              ? items.map((a) => renderAgendaItem(a, magBewerken)).join('')
              : '<p class="agenda-leeg muted klein">Niets gepland.</p>'}
          </div>
        </section>`;
      }).join('')}
    </div>

    ${zonderDatum.length ? `<section class="card" id="agendaZonderDatum">
      <h2>Nog niet ingepland</h2>
      <p class="muted">Deze acties hebben geen startdatum en staan daarom niet in de week hierboven.</p>
      <ul class="wachtlijst">
        ${zonderDatum.map((a) => `<li>
          <button type="button" class="link" data-actiepaneel="${esc(a.id)}">${esc(a.titel)}</button>
          <span class="muted klein">${esc(a.klantNaam)}</span>
          ${magBewerken ? `<button type="button" class="btn klein" data-actie-plan="${esc(a.id)}">Vandaag inplannen</button>` : ''}
        </li>`).join('')}
      </ul>
    </section>` : ''}`;
}

function renderAgendaItem(actie, magBewerken) {
  return `<article class="agenda-item prioriteit-${esc(actie.prioriteit)}"
    ${sleepbaar('actie-datum', actie.id, { label: `Actie ${actie.titel}` })}
    data-actie="${esc(actie.id)}">
    <div class="agenda-item-kop">
      ${magBewerken ? '<span class="sleepgreep" data-sleepgreep title="Verslepen" aria-hidden="true">⠿</span>' : ''}
      <button type="button" class="link agenda-item-titel" data-actiepaneel="${esc(actie.id)}">${esc(actie.titel)}</button>
    </div>
    <p class="muted klein">${esc(actie.klantNaam)} · ${esc(actie.statusTerm.kort)}</p>
    ${magBewerken ? `<div class="agenda-item-knoppen">
      <button type="button" class="icoonknop klein" data-actie-dag="${esc(actie.id)}" data-richting="vorige"
        aria-label="${esc(actie.titel)} een dag eerder plannen">◀</button>
      <button type="button" class="icoonknop klein" data-actie-dag="${esc(actie.id)}" data-richting="volgende"
        aria-label="${esc(actie.titel)} een dag later plannen">▶</button>
    </div>` : ''}
  </article>`;
}

const DAGNAMEN = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];

function dagnaam(iso) {
  const dag = new Date(`${iso}T00:00:00Z`).getUTCDay();
  const naam = DAGNAMEN[dag] ?? '';
  return naam.charAt(0).toUpperCase() + naam.slice(1);
}

/* ---------------------------------------------------------------
   Nieuwe actie
   --------------------------------------------------------------- */

/**
 * Het aanmaakformulier.
 *
 * Bewust geen modaal venster: een modaal bovenop een bord verbergt precies de
 * kolom waar de actie in terechtkomt. Het formulier schuift open boven de
 * weergave en sluit zichzelf na het opslaan.
 */
function renderNieuweActie({ klanten, medewerkers, open }) {
  return `<section class="card nieuwe-actie">
    <div class="kaart-kop">
      <h2>Nieuwe actie</h2>
      <button type="button" class="btn klein${open ? '' : ' primary'}" id="nieuweActieKnop"
        aria-expanded="${open}" aria-controls="nieuweActieForm">
        ${open ? 'Annuleren' : 'Actie aanmaken'}
      </button>
    </div>
    <form id="nieuweActieForm"${open ? '' : ' hidden'} class="actie-form">
      <div class="veld">
        <label for="actieTitel">Titel</label>
        <input type="text" id="actieTitel" name="titel" required maxlength="140"
          placeholder="Bijvoorbeeld: brede zoekwoorden pauzeren">
      </div>
      <div class="veld">
        <label for="actieOmschrijving">Omschrijving</label>
        <textarea id="actieOmschrijving" name="omschrijving" rows="2"
          placeholder="Wat er precies moet gebeuren en waarom"></textarea>
      </div>
      <div class="veld-rij">
        <div class="veld">
          <label for="actieKlant">${esc(LABELS.klant)}</label>
          <select id="actieKlant" name="klantId" required>
            <option value="">Kies een klant</option>
            ${klanten.map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}
          </select>
        </div>
        <div class="veld">
          <label for="actieKanaal">Kanaal</label>
          <select id="actieKanaal" name="kanaal">
            <option value="">Geen kanaal</option>
            ${ADVERTENTIEKANAAL_KEYS.map((k) => `<option value="${esc(k)}">${esc(kanaalLabel(k))}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="veld-rij">
        <div class="veld">
          <label for="actieVerantwoordelijke">${esc(LABELS.verantwoordelijke)}</label>
          <select id="actieVerantwoordelijke" name="verantwoordelijkeId">
            ${medewerkers.map((m) => `<option value="${esc(m.id)}">${esc(m.displayName)}</option>`).join('')}
          </select>
        </div>
        <div class="veld">
          <label for="actiePrioriteit">${esc(LABELS.prioriteit)}</label>
          <select id="actiePrioriteit" name="prioriteit">
            ${ACTIE_PRIORITEITEN.map((p) => `<option value="${esc(p.key)}"${p.key === 'middel' ? ' selected' : ''}>${esc(p.kort)}</option>`).join('')}
          </select>
        </div>
        <div class="veld">
          <label for="actieSoort">Soort werk</label>
          <select id="actieSoort" name="soort">
            ${ACTIE_SOORTEN.map((s) => `<option value="${esc(s.key)}">${esc(s.kort)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="veld-rij">
        <div class="veld">
          <label for="actieStart">Startdatum</label>
          <input type="date" id="actieStart" name="startdatum">
        </div>
        <div class="veld">
          <label for="actieDeadline">Deadline</label>
          <input type="date" id="actieDeadline" name="deadline">
        </div>
      </div>
      <label class="checkbox">
        <input type="checkbox" id="actieZichtbaar" name="zichtbaarVoorKlant">
        <span>Deze actie delen met de klant</span>
      </label>
      <div class="form-acties">
        <button type="submit" class="btn primary">Actie opslaan</button>
      </div>
    </form>
  </section>`;
}

export { renderKaart, maandRooster };
