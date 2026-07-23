/**
 * Lege staten, laadstaten en koppelstatussen.
 *
 * Een leeg vlak vertelt niets. Deze componenten vertellen wel iets: wat er
 * ontbreekt, waarom het ontbreekt en wat je eraan kunt doen. Die drie horen bij
 * elkaar; een lege staat met alleen "Geen gegevens" laat de lezer raden of er
 * niets is, of dat er iets kapot is.
 */

import { esc, badge } from '../views/components.js';
import { KANAAL_STATUS_LABELS, KANAAL_STATUS_VARIANT, KanaalStatus } from '../filters/channels.js';

/**
 * @param {object} opties
 * @param {string} opties.titel     wat er ontbreekt
 * @param {string} opties.uitleg    waarom het ontbreekt
 * @param {{hash?: string, id?: string, label: string}} [opties.actie] wat de gebruiker kan doen
 * @param {string} [opties.id]      om vanuit tests aan te wijzen
 */
export function emptyState({ titel, uitleg = '', actie = null, id = null, variant = 'neutraal' }) {
  const knop = actie
    ? actie.hash
      ? `<a class="btn klein primary" href="${esc(actie.hash)}">${esc(actie.label)}</a>`
      : `<button type="button" class="btn klein primary" id="${esc(actie.id)}"${actie.data ? ` data-actie="${esc(actie.data)}"` : ''}>${esc(actie.label)}</button>`
    : '';

  return `<div class="lege-staat lege-staat-${esc(variant)}"${id ? ` id="${esc(id)}"` : ''}>
    <p class="lege-staat-titel">${esc(titel)}</p>
    ${uitleg ? `<p class="lege-staat-uitleg">${esc(uitleg)}</p>` : ''}
    ${knop}
  </div>`;
}

/**
 * Laadstaat.
 *
 * Er zijn in deze demo geen trage aanroepen, maar een tabel die zichzelf
 * herberekent zet wel `aria-busy`. Deze component is de zichtbare tegenhanger
 * daarvan en houdt de hoogte van het blok stabiel, zodat de pagina niet
 * verspringt.
 */
export function loadingState({ regels = 3, label = 'Bezig met laden' } = {}) {
  return `<div class="laad-staat" role="status" aria-live="polite">
    <span class="visueel-verborgen">${esc(label)}</span>
    ${Array.from({ length: regels }, () => '<span class="laad-regel" aria-hidden="true"></span>').join('')}
  </div>`;
}

/**
 * Koppelstatus van een databron.
 *
 * Een tab voor een niet-gekoppelde bron blijft niet leeg. Er staat wat er
 * ontbreekt, wat dat betekent voor de cijfers en wie het kan inrichten. Een
 * lege tab zou als "geen resultaat" worden gelezen, en dat is iets anders dan
 * "niet gemeten".
 */
export function koppelStatus({ bron, status, uitleg = null, actie = null }) {
  const teksten = {
    [KanaalStatus.NIET_GEKOPPELD]: `${bron} is niet gekoppeld. De cijfers van deze bron ontbreken daarom volledig; ze zijn niet nul.`,
    [KanaalStatus.TOEKOMSTIG]: `De koppeling met ${bron} is nog niet gebouwd. Wat je hier ziet zodra hij er is, komt rechtstreeks uit die bron.`,
    [KanaalStatus.ONVOLDOENDE_DATA]: `${bron} levert onvolledige gegevens. Cijfers uit deze bron kunnen daardoor afwijken van de werkelijkheid.`,
    [KanaalStatus.GEKOPPELD]: `${bron} levert gegevens voor de geselecteerde periode.`,
  };

  return `<div class="koppelstatus" data-status="${esc(status)}">
    <div class="koppelstatus-kop">
      <strong>${esc(bron)}</strong>
      ${badge(KANAAL_STATUS_LABELS[status] ?? status, KANAAL_STATUS_VARIANT[status] ?? 'muted')}
    </div>
    <p class="muted">${esc(uitleg ?? teksten[status] ?? '')}</p>
    ${actie ? `<a class="link-klein" href="${esc(actie.hash)}">${esc(actie.label)}</a>` : ''}
  </div>`;
}
