/**
 * Toastmeldingen.
 *
 * Een uitgevoerde handeling hoort bevestigd te worden. Zonder bevestiging weet
 * een gebruiker die een actie versleept niet of er iets is opgeslagen of dat
 * het kaartje alleen is verschoven.
 *
 * TOEGANKELIJKHEID
 * De container is een `role="status"` met `aria-live="polite"`. De melding komt
 * daardoor ook bij een screenreader binnen, zonder de gebruiker te onderbreken.
 * Een toast is nooit de enige plek waar het resultaat te zien is: de lijst, het
 * bord of de agenda toont de wijziging zelf ook.
 *
 * De container leeft buiten `#app`, zodat een volledige hertekening van het
 * scherm de melding niet halverwege weghaalt.
 */

import { esc } from '../views/components.js';

const CONTAINER_ID = 'toastRegio';
const ZICHTBAAR_MS = 4000;

function container() {
  let el = document.getElementById(CONTAINER_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = CONTAINER_ID;
    el.className = 'toast-regio';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  return el;
}

/**
 * Toont een melding.
 *
 * @param {string} tekst
 * @param {{variant?: 'ok'|'fout'|'info', actie?: {label: string, hash: string}}} opties
 */
export function toast(tekst, { variant = 'ok', actie = null } = {}) {
  const el = document.createElement('div');
  el.className = `toast toast-${variant}`;
  el.innerHTML = `
    <span class="toast-tekst">${esc(tekst)}</span>
    ${actie ? `<a class="toast-actie" href="${esc(actie.hash)}">${esc(actie.label)}</a>` : ''}
    <button type="button" class="toast-sluit" aria-label="Melding sluiten">×</button>`;

  el.querySelector('.toast-sluit').addEventListener('click', () => verwijder(el));
  container().appendChild(el);

  const timer = window.setTimeout(() => verwijder(el), ZICHTBAAR_MS);
  // Wie met de muis op de melding blijft staan, is hem aan het lezen.
  el.addEventListener('mouseenter', () => window.clearTimeout(timer));

  return el;
}

function verwijder(el) {
  el.classList.add('is-weg');
  window.setTimeout(() => el.remove(), 180);
}

/** Kort en duidelijk voor een handeling die niet kon. */
export function toastFout(tekst) {
  return toast(tekst, { variant: 'fout' });
}
