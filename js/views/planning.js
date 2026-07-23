/**
 * Planning.
 *
 * Drie zoomniveaus op dezelfde items: dag, week en maand. Daarnaast drie
 * manieren om te groeperen: per medewerker, per klant en per soort werk. Dat
 * zijn zes combinaties van één lijst, geen zes lijsten.
 *
 * DRIE HERKENBARE SOORTEN
 * Een intern werkblok, een klantmeeting en een afspraak uit een externe agenda
 * zien er anders uit en gedragen zich anders. Een extern item is niet
 * verplaatsbaar: dat hoort thuis in de agenda waar hij vandaan komt. Dat wordt
 * getoond in plaats van stilzwijgend genegeerd.
 *
 * NOG GEEN EXTERNE KOPPELING
 * Er staat geen nagemaakte Google Agenda in. De gegevensvorm is voorbereid — elk
 * item draagt een `externeBron` — maar zolang er geen koppeling is, wordt er
 * geen gesynchroniseerde agenda gesuggereerd. De koppelstatus staat onderaan de
 * pagina, met wat er nodig is om hem te maken.
 */

import { esc, badge } from './components.js';
import { emptyState, koppelStatus } from '../ui/states.js';
import { sleepbaar, dropzone } from '../ui/dnd.js';
import { beginVanWeek, maandRooster, ItemBron } from '../model/planning.js';
import { ACTIE_SOORTEN } from '../model/actions.js';
import { toonDatum, toonKorteDatum, plusDagen, datumReeks, DEMO_TODAY } from '../filters/period.js';
import { KanaalStatus } from '../filters/channels.js';
import { LABELS } from '../terminology.js';

export const PLANNING_TABS = [
  { key: 'week', label: 'Week' },
  { key: 'dag', label: 'Dag' },
  { key: 'maand', label: 'Maand' },
];

export const GROEPERINGEN = [
  { key: '', label: 'Niet groeperen' },
  { key: 'medewerker', label: 'Per medewerker' },
  { key: 'klant', label: 'Per klant' },
  { key: 'soort', label: 'Per actietype' },
];

const DAGNAMEN = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];

function dagnaam(iso) {
  const naam = DAGNAMEN[new Date(`${iso}T00:00:00Z`).getUTCDay()] ?? '';
  return naam.charAt(0).toUpperCase() + naam.slice(1);
}

/* ---------------------------------------------------------------
   Bereik
   --------------------------------------------------------------- */

/** Het datumbereik dat bij een weergave en een ankerdatum hoort. */
export function bereikVoor(weergave, anker) {
  if (weergave === 'dag') return { van: anker, tot: anker };
  if (weergave === 'maand') {
    const rooster = maandRooster(anker);
    return { van: rooster.dagen[0].datum, tot: rooster.dagen[rooster.dagen.length - 1].datum };
  }
  const start = beginVanWeek(anker);
  return { van: start, tot: plusDagen(start, 6) };
}

/** Hoeveel de vorige of volgende knop opschuift. */
export function verschuif(weergave, anker, richting) {
  const stap = richting === 'vorige' ? -1 : 1;
  if (weergave === 'dag') return plusDagen(anker, stap);
  if (weergave === 'maand') {
    const d = new Date(`${anker}T00:00:00Z`);
    const nieuw = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + stap, 1));
    return nieuw.toISOString().slice(0, 10);
  }
  return plusDagen(beginVanWeek(anker), stap * 7);
}

/* ---------------------------------------------------------------
   Weergave
   --------------------------------------------------------------- */

export function renderPlanning({
  items, weergave, anker, groepering, medewerkers, klanten,
  filterMedewerker, filterKlant, filterSoort, magVerplaatsen, toonKoppeling = true,
}) {
  const bereik = bereikVoor(weergave, anker);

  return `
    ${renderBalk({
      weergave, anker, bereik, groepering, medewerkers, klanten,
      filterMedewerker, filterKlant, filterSoort,
    })}

    ${!items.length
      ? emptyState({
        titel: 'Niets gepland in deze periode',
        uitleg: 'Verruim het bereik of pas de filters aan. Acties zonder startdatum staan op het actiebord.',
        id: 'planningLeeg',
      })
      : groepering
        ? renderGegroepeerd(items, groepering, weergave, bereik, anker, magVerplaatsen)
        : renderKalender(items, weergave, bereik, anker, magVerplaatsen)}

    ${toonKoppeling ? renderKoppeling() : ''}`;
}

function renderBalk({ weergave, anker, bereik, groepering, medewerkers, klanten, filterMedewerker, filterKlant, filterSoort }) {
  const titel = weergave === 'dag'
    ? `${dagnaam(anker)} ${toonDatum(anker)}`
    : weergave === 'maand'
      ? new Date(`${anker}T00:00:00Z`).toLocaleDateString('nl-NL', { month: 'long', year: 'numeric', timeZone: 'UTC' })
      : `Week van ${toonDatum(bereik.van)} tot en met ${toonDatum(bereik.tot)}`;

  return `<div class="planning-balk">
    <div class="planning-navigatie">
      <button type="button" class="btn klein" data-planning-schuif="vorige"
        aria-label="Vorige periode">◀</button>
      <button type="button" class="btn klein" data-planning-schuif="vandaag">Vandaag</button>
      <button type="button" class="btn klein" data-planning-schuif="volgende"
        aria-label="Volgende periode">▶</button>
      <strong class="planning-titel">${esc(titel)}</strong>
    </div>

    <div class="planning-filters">
      <div class="veld">
        <label for="planningGroep">Groeperen</label>
        <select id="planningGroep" data-planning-groep>
          ${GROEPERINGEN.map((g) => `<option value="${esc(g.key)}"${groepering === g.key ? ' selected' : ''}>${esc(g.label)}</option>`).join('')}
        </select>
      </div>
      <div class="veld">
        <label for="planningMedewerker">${esc(LABELS.medewerker)}</label>
        <select id="planningMedewerker" data-planning-filter="medewerker">
          <option value="">Alle medewerkers</option>
          ${medewerkers.map((m) => `<option value="${esc(m.id)}"${filterMedewerker === m.id ? ' selected' : ''}>${esc(m.displayName)}</option>`).join('')}
        </select>
      </div>
      <div class="veld">
        <label for="planningKlant">${esc(LABELS.klant)}</label>
        <select id="planningKlant" data-planning-filter="klant">
          <option value="">Alle klanten</option>
          ${klanten.map((c) => `<option value="${esc(c.id)}"${filterKlant === c.id ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}
        </select>
      </div>
      <div class="veld">
        <label for="planningSoort">Actietype</label>
        <select id="planningSoort" data-planning-filter="soort">
          <option value="">Alle types</option>
          ${ACTIE_SOORTEN.map((s) => `<option value="${esc(s.key)}"${filterSoort === s.key ? ' selected' : ''}>${esc(s.kort)}</option>`).join('')}
        </select>
      </div>
    </div>
  </div>`;
}

/* ---------------------------------------------------------------
   Kalender
   --------------------------------------------------------------- */

function renderKalender(items, weergave, bereik, anker, magVerplaatsen) {
  if (weergave === 'maand') return renderMaand(items, anker, magVerplaatsen);

  const dagen = datumReeks(bereik.van, bereik.tot);

  return `<div class="planning-kalender planning-${esc(weergave)}" id="planningKalender">
    ${dagen.map((datum) => {
      const vanDeze = items.filter((i) => i.datum === datum);
      return `<section class="agenda-dag${datum === DEMO_TODAY ? ' is-vandaag' : ''}"
        ${dropzone('planning', datum, { label: `Dag ${toonDatum(datum)}` })}
        data-datum="${esc(datum)}" aria-labelledby="planning-dag-${esc(datum)}">
        <header class="agenda-dagkop">
          <h3 id="planning-dag-${esc(datum)}">${esc(dagnaam(datum))}</h3>
          <span class="muted klein">${esc(toonKorteDatum(datum))}</span>
        </header>
        <div class="agenda-items">
          ${vanDeze.length
            ? vanDeze.map((i) => renderItem(i, magVerplaatsen)).join('')
            : '<p class="agenda-leeg muted klein">Niets gepland.</p>'}
        </div>
      </section>`;
    }).join('')}
  </div>`;
}

function renderMaand(items, anker, magVerplaatsen) {
  const rooster = maandRooster(anker);

  return `<div class="planning-maand" id="planningKalender">
    <div class="maand-kop" aria-hidden="true">
      ${['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'].map((d) => `<span>${d}</span>`).join('')}
    </div>
    <div class="maand-raster">
      ${rooster.dagen.map(({ datum, binnenMaand }) => {
        const vanDeze = items.filter((i) => i.datum === datum);
        return `<section class="maand-dag${binnenMaand ? '' : ' buiten-maand'}${datum === DEMO_TODAY ? ' is-vandaag' : ''}"
          ${dropzone('planning', datum, { label: `Dag ${toonDatum(datum)}` })}
          data-datum="${esc(datum)}">
          <span class="maand-dagnummer">${Number(datum.slice(8, 10))}</span>
          ${vanDeze.slice(0, 3).map((i) => renderItem(i, magVerplaatsen, { compact: true })).join('')}
          ${vanDeze.length > 3 ? `<span class="muted klein">nog ${vanDeze.length - 3} ${vanDeze.length - 3 === 1 ? 'item' : 'items'}</span>` : ''}
        </section>`;
      }).join('')}
    </div>
  </div>`;
}

function renderItem(item, magVerplaatsen, { compact = false } = {}) {
  const sleepbaarheid = magVerplaatsen && item.verplaatsbaar;

  return `<article class="agenda-item bron-${esc(item.bron)}${compact ? ' is-compact' : ''}"
    ${sleepbaarheid ? sleepbaar('planning', item.id, { label: `Planning ${item.titel}` }) : ''}
    data-planitem="${esc(item.id)}">
    <div class="agenda-item-kop">
      ${sleepbaarheid ? '<span class="sleepgreep" data-sleepgreep title="Verslepen" aria-hidden="true">⠿</span>' : ''}
      ${item.actieId
        ? `<button type="button" class="link agenda-item-titel" data-actiepaneel="${esc(item.actieId)}">${esc(item.titel)}</button>`
        : `<span class="agenda-item-titel">${esc(item.titel)}</span>`}
    </div>
    ${compact ? '' : `
      <p class="muted klein">${esc(item.klantNaam)}${item.starttijd ? ` · ${esc(item.starttijd)}` : ''}</p>
      <div class="agenda-item-labels">
        <span class="badge badge-${esc(item.bronTerm.variant)}" title="${esc(item.bronTerm.omschrijving)}">${esc(item.bronTerm.kort)}</span>
        ${badge(item.soortTerm.kort, 'muted')}
      </div>
      <p class="muted klein">${esc(item.medewerkerNaam)}</p>`}
    ${sleepbaarheid ? `<div class="agenda-item-knoppen">
      <button type="button" class="icoonknop klein" data-plan-dag="${esc(item.id)}" data-richting="vorige"
        aria-label="${esc(item.titel)} een dag eerder plannen">◀</button>
      <button type="button" class="icoonknop klein" data-plan-dag="${esc(item.id)}" data-richting="volgende"
        aria-label="${esc(item.titel)} een dag later plannen">▶</button>
    </div>` : ''}
    ${!item.verplaatsbaar ? '<p class="muted klein">Komt uit een externe agenda en wordt daar gewijzigd.</p>' : ''}
  </article>`;
}

/* ---------------------------------------------------------------
   Gegroepeerd
   --------------------------------------------------------------- */

function renderGegroepeerd(items, groepering, weergave, bereik, anker, magVerplaatsen) {
  const sleutel = {
    medewerker: (i) => i.medewerkerNaam,
    klant: (i) => i.klantNaam,
    soort: (i) => i.soortTerm.kort,
  }[groepering] ?? ((i) => i.klantNaam);

  const kaart = new Map();
  for (const item of items) {
    const naam = sleutel(item);
    if (!kaart.has(naam)) kaart.set(naam, []);
    kaart.get(naam).push(item);
  }

  const dagen = weergave === 'maand'
    ? maandRooster(anker).dagen.filter((d) => d.binnenMaand).map((d) => d.datum)
    : datumReeks(bereik.van, bereik.tot);

  return `<div class="planning-groepen" id="planningKalender">
    ${[...kaart.entries()].sort((a, b) => a[0].localeCompare(b[0], 'nl')).map(([naam, groep]) => `
      <section class="planning-groep">
        <h3>${esc(naam)} <span class="muted klein">${groep.length} ${groep.length === 1 ? 'item' : 'items'}</span></h3>
        <div class="planning-rij">
          ${dagen.map((datum) => {
            const vanDeze = groep.filter((i) => i.datum === datum);
            return `<div class="planning-cel${datum === DEMO_TODAY ? ' is-vandaag' : ''}"
              ${dropzone('planning', datum, { label: `${naam} op ${toonDatum(datum)}` })}
              data-datum="${esc(datum)}">
              <span class="planning-celkop muted klein">${esc(toonKorteDatum(datum))}</span>
              ${vanDeze.map((i) => renderItem(i, magVerplaatsen, { compact: true })).join('')}
            </div>`;
          }).join('')}
        </div>
      </section>`).join('')}
  </div>`;
}

/* ---------------------------------------------------------------
   Koppelstatus
   --------------------------------------------------------------- */

/**
 * Wat er van een externe agenda te verwachten is.
 *
 * Bewust geen schakelaar die niets doet. Er staat wat er nodig is en wat er
 * gebeurt zodra het er is; een uitgeschakelde knop met "binnenkort" erbij is
 * een belofte zonder datum.
 */
function renderKoppeling() {
  return `<section class="card" id="agendaKoppeling">
    <h2>Externe agenda's</h2>
    <p class="muted">
      De planning is voorbereid op een koppeling met Google Agenda en Microsoft
      Outlook: elk item draagt al een veld voor de externe agenda, het externe
      id en de synchronisatierichting. Zolang die koppeling niet bestaat, wordt
      er geen externe agenda getoond, want een agenda die zegt te synchroniseren
      terwijl dat niet zo is, is erger dan geen agenda.
    </p>
    <div class="koppelstatus-grid">
      ${koppelStatus({
        bron: 'Google Agenda',
        status: KanaalStatus.TOEKOMSTIG,
        uitleg: 'Vereist een OAuth-koppeling per medewerker. Zodra die er is, verschijnen afspraken als externe agenda-afspraak, herkenbaar en niet verplaatsbaar vanuit dit product.',
      })}
      ${koppelStatus({
        bron: 'Microsoft Outlook',
        status: KanaalStatus.TOEKOMSTIG,
        uitleg: 'Vereist een koppeling met Microsoft 365. Dezelfde gegevensvorm als Google Agenda, dus er is geen tweede model nodig.',
      })}
    </div>
  </section>`;
}

export { ItemBron };
