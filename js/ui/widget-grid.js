/**
 * Widgetraster.
 *
 * De persoonlijke startpagina bestaat uit blokken die de gebruiker zelf
 * ordent, verbergt, vergroot en verkleint. Deze module tekent het raster en de
 * bediening; wat er ín een widget staat, bepaalt de view.
 *
 * TWEE BEDIENINGEN VOOR ÉÉN HANDELING
 * Slepen is prettig met een muis en onmogelijk zonder. Iedere widget heeft
 * daarom naast de sleepgreep twee knoppen om hem een plek op te schuiven, en
 * knoppen om hem breder, smaller of verborgen te maken. Ze doen precies
 * hetzelfde en schrijven naar dezelfde opslag.
 *
 * BEWERKSTAND
 * De bediening staat standaard uit. Een pagina vol grepen en knopjes leest als
 * een instellingenscherm in plaats van als een werkoverzicht. De knop
 * "Indeling aanpassen" zet ze aan.
 */

import { esc } from '../views/components.js';
import { sleepbaar, dropzone } from './dnd.js';
import { WIDGET_OP_ID, GROOTTES, Grootte } from '../model/widgets.js';
import { emptyState } from './states.js';

/**
 * @param {object} opties
 * @param {object} opties.indeling  uit leesIndeling()
 * @param {(id: string) => string} opties.inhoudVoor  levert de HTML van een widget
 * @param {boolean} opties.bewerken
 */
export function renderWidgetGrid({ indeling, inhoudVoor, bewerken = false }) {
  const zichtbaar = indeling.volgorde.filter((id) => !indeling.verborgen.includes(id));

  return `
    <div class="widget-balk">
      <button type="button" class="btn klein${bewerken ? ' primary' : ''}" id="widgetBewerken"
        aria-pressed="${bewerken}">
        ${bewerken ? 'Indeling vastzetten' : 'Indeling aanpassen'}
      </button>
      ${bewerken ? `
        <button type="button" class="btn klein" id="widgetHerstel">Standaardindeling herstellen</button>
        <span class="muted klein">Sleep aan de greep of gebruik de pijlknoppen. Wijzigingen worden meteen bewaard.</span>` : ''}
    </div>

    ${bewerken ? renderVerborgenLijst(indeling) : ''}

    ${!zichtbaar.length
      ? emptyState({
        titel: 'Alle widgets staan uit',
        uitleg: 'Zet er minstens één aan om je werkdag hier te kunnen overzien.',
        actie: { id: 'widgetHerstelLeeg', label: 'Standaardindeling herstellen' },
        id: 'widgetsLeeg',
      })
      : `<div class="widget-grid${bewerken ? ' is-bewerken' : ''}" id="widgetGrid">
          ${zichtbaar.map((id, i) => renderWidget({
            id,
            grootte: indeling.groottes[id] ?? Grootte.MIDDEL,
            inhoud: inhoudVoor(id),
            bewerken,
            eerste: i === 0,
            laatste: i === zichtbaar.length - 1,
          })).join('')}
        </div>`}`;
}

function renderWidget({ id, grootte, inhoud, bewerken, eerste, laatste }) {
  const meta = WIDGET_OP_ID.get(id);
  if (!meta) return '';

  const index = GROOTTES.findIndex((g) => g.key === grootte);

  return `<section class="widget widget-${esc(grootte)}"
    ${sleepbaar('widget', id, { label: `Widget ${meta.titel}` })}
    ${dropzone('widget', id, { label: `Plaats voor ${meta.titel}` })}
    data-widget="${esc(id)}" aria-labelledby="widget-${esc(id)}-titel">
    <header class="widget-kop">
      ${bewerken ? `<span class="sleepgreep" data-sleepgreep title="Verslepen" aria-hidden="true">⠿</span>` : ''}
      <h3 id="widget-${esc(id)}-titel">${esc(meta.titel)}</h3>
      ${bewerken ? `<div class="widget-knoppen">
        <button type="button" class="icoonknop klein" data-widget-op="${esc(id)}"
          aria-label="${esc(meta.titel)} naar voren verplaatsen"${eerste ? ' disabled' : ''}>↑</button>
        <button type="button" class="icoonknop klein" data-widget-neer="${esc(id)}"
          aria-label="${esc(meta.titel)} naar achteren verplaatsen"${laatste ? ' disabled' : ''}>↓</button>
        <button type="button" class="icoonknop klein" data-widget-kleiner="${esc(id)}"
          aria-label="${esc(meta.titel)} smaller maken"${index <= 0 ? ' disabled' : ''}>−</button>
        <button type="button" class="icoonknop klein" data-widget-groter="${esc(id)}"
          aria-label="${esc(meta.titel)} breder maken"${index >= GROOTTES.length - 1 ? ' disabled' : ''}>+</button>
        <button type="button" class="icoonknop klein" data-widget-verberg="${esc(id)}"
          aria-label="${esc(meta.titel)} verbergen">×</button>
      </div>` : ''}
    </header>
    <div class="widget-inhoud">${inhoud}</div>
    ${bewerken ? `<p class="widget-uitleg muted klein">${esc(meta.omschrijving)}</p>` : ''}
  </section>`;
}

function renderVerborgenLijst(indeling) {
  const verborgen = indeling.verborgen
    .map((id) => WIDGET_OP_ID.get(id))
    .filter(Boolean);

  if (!verborgen.length) {
    return '<p class="muted klein" id="verborgenWidgets">Alle beschikbare widgets staan op je startpagina.</p>';
  }

  return `<div class="verborgen-widgets" id="verborgenWidgets">
    <span class="muted klein">Beschikbaar om toe te voegen:</span>
    ${verborgen.map((w) => `<button type="button" class="btn klein" data-widget-toon="${esc(w.id)}"
      title="${esc(w.omschrijving)}">${esc(w.titel)} toevoegen</button>`).join('')}
  </div>`;
}
