/**
 * De Aizy-assistent in beeld: launcher, paneel, berichten en suggesties.
 *
 * De UI kent geen providerlogica. Ze leest de stand uit de controller en tekent
 * die; iedere knop verwijst via data-attributen naar de controller of hergebruikt
 * bestaande dashboardhandlers (navigatie, klantomgeving). Zo bouwt de assistent
 * nooit een tweede kopie van functionaliteit.
 */

import { esc, badge } from '../views/components.js';
import * as assistent from '../assistant/assistant-controller.js';
import { startsuggesties } from '../assistant/assistant-intents.js';
import { resolveActies } from '../assistant/assistant-actions.js';

const AI_ICOON = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none"
  stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 3l1.6 3.9L17.5 8.5 13.6 10.1 12 14l-1.6-3.9L6.5 8.5l3.9-1.6z"></path>
  <path d="M18 14l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"></path>
</svg>`;

/** Onthoudt het vorige paginatype om een contextwissel te kunnen melden. */
let laatstePageType = null;

function moment(op) {
  const d = new Date(op);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
}

function renderActieknoppen(acties) {
  if (!acties?.length) return '';
  return `<div class="assistent-acties">
    ${acties.map((a) => (a.type === 'klantomgeving'
      ? `<button type="button" class="btn klein" data-klantomgeving="${esc(a.clientId)}">${esc(a.label)}</button>`
      : `<a class="btn klein" href="${esc(a.hash)}" data-assistent-nav>${esc(a.label)}</a>`)).join('')}
  </div>`;
}

function renderBericht(bericht, context) {
  if (bericht.rol === 'gebruiker') {
    return `<li class="assistent-bericht is-gebruiker"><div class="assistent-bel">${esc(bericht.tekst)}</div>
      <span class="assistent-moment">${esc(moment(bericht.op))}</span></li>`;
  }

  const cijfers = bericht.cijfers?.length
    ? `<dl class="assistent-cijfers">${bericht.cijfers.map((c) => `<div><dt>${esc(c.label)}</dt><dd>${esc(c.waarde)}</dd></div>`).join('')}</dl>`
    : '';
  const punten = bericht.punten?.length
    ? `<ul class="assistent-punten">${bericht.punten.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>`
    : '';
  const beperking = bericht.beperking ? `<p class="assistent-beperking">${esc(bericht.beperking)}</p>` : '';
  const gebruikt = bericht.context
    ? `<p class="assistent-contextgebruikt"><span class="assistent-contextlabel">Gebruikte context</span> ${esc(bericht.context)}</p>`
    : '';
  const acties = renderActieknoppen(resolveActies(bericht.acties, context));
  const suggesties = bericht.suggesties?.length
    ? `<div class="assistent-suggesties">${bericht.suggesties.map((v) => `<button type="button" class="assistent-chip" data-assistent-vraag="${esc(v)}">${esc(v)}</button>`).join('')}</div>`
    : '';

  return `<li class="assistent-bericht is-assistent">
    <div class="assistent-bel">
      <p>${esc(bericht.tekst)}</p>
      ${cijfers}${punten}${beperking}${gebruikt}
    </div>
    ${acties}${suggesties}
    <span class="assistent-moment">${esc(moment(bericht.op))}</span>
  </li>`;
}

function renderStartscherm(context) {
  const s = startsuggesties(context);
  return `<div class="assistent-start">
    <p class="assistent-begroeting">${esc(s.begroeting)}</p>
    <p class="assistent-insight">${esc(s.insight)}</p>
    <div class="assistent-suggesties">
      ${s.vragen.map((v) => `<button type="button" class="assistent-chip" data-assistent-vraag="${esc(v)}">${esc(v)}</button>`).join('')}
    </div>
  </div>`;
}

function renderGesprek(context) {
  const berichten = assistent.berichten();
  if (!berichten.length) return renderStartscherm(context);
  return `<ul class="assistent-berichten">
    ${berichten.map((b) => renderBericht(b, context)).join('')}
    ${assistent.isBezig() ? '<li class="assistent-bericht is-assistent"><div class="assistent-bel assistent-laadt"><span></span><span></span><span></span></div></li>' : ''}
  </ul>`;
}

function renderContextbalk(context) {
  // Dedupliceer: op een klantdetail is de paginatitel gelijk aan de klantnaam.
  const delen = [...new Set([context.pageTitle, context.clientName, context.periodeLabel].filter(Boolean))];
  return `<p class="assistent-contextbalk">${esc(delen.join(' · '))}</p>`;
}

/** Het volledige assistentpaneel (zwevend of vastgezet). */
function renderPaneel(context) {
  const vastgezet = assistent.isVastgezet();
  const ingeklapt = assistent.isIngeklapt();
  const status = assistent.providerStatus();
  const contextGewijzigd = laatstePageType && laatstePageType !== context.pageType;

  return `<section class="assistent-paneel${vastgezet ? ' is-vastgezet' : ''}${ingeklapt ? ' is-ingeklapt' : ''}"
    id="assistentPaneel" role="${vastgezet ? 'complementary' : 'dialog'}"
    aria-label="Aizy Assistent" ${vastgezet ? '' : 'aria-modal="false"'} tabindex="-1">
    <header class="assistent-kop">
      <div class="assistent-titel">${AI_ICOON}<span>Aizy Assistent</span>${badge('Demo', 'muted')}</div>
      <div class="assistent-kop-acties">
        <button type="button" class="icoonknop klein" data-assistent="nieuw" title="Nieuw gesprek" aria-label="Nieuw gesprek">＋</button>
        <button type="button" class="icoonknop klein" data-assistent="${vastgezet ? 'unpin' : 'pin'}"
          title="${vastgezet ? 'Losmaken' : 'Vastzetten'}" aria-label="${vastgezet ? 'Assistent losmaken' : 'Assistent vastzetten'}">${vastgezet ? '⇥' : '⇤'}</button>
        <button type="button" class="icoonknop klein" data-assistent="inklap"
          title="${ingeklapt ? 'Uitklappen' : 'Inklappen'}" aria-label="${ingeklapt ? 'Uitklappen' : 'Inklappen'}">${ingeklapt ? '▸' : '▾'}</button>
        <button type="button" class="icoonknop klein" data-assistent="sluit" title="Sluiten" aria-label="Assistent sluiten">×</button>
      </div>
    </header>
    ${ingeklapt ? '' : `
      ${renderContextbalk(context)}
      ${contextGewijzigd ? `<p class="assistent-contextwissel" role="status">Context gewijzigd naar ${esc(context.pageTitle ?? 'deze pagina')}.</p>` : ''}
      <div class="assistent-gesprek" id="assistentGesprek" aria-live="polite">
        ${renderGesprek(context)}
      </div>
      <form class="assistent-invoer" data-assistent-form>
        <label class="visueel-verborgen" for="assistentVraag">Stel een vraag over deze pagina</label>
        <input type="text" id="assistentVraag" name="vraag" autocomplete="off"
          placeholder="Stel een vraag over deze pagina">
        <button type="submit" class="icoonknop" aria-label="Vraag versturen">↑</button>
      </form>`}
  </section>`;
}

/**
 * De volledige assistent-laag (launcher + eventueel paneel) die aan de shell
 * wordt toegevoegd. Geeft een lege string terug wanneer de assistent uitstaat.
 */
export function renderAssistent(context) {
  if (!context || !assistent.isZichtbaar()) {
    laatstePageType = context?.pageType ?? laatstePageType;
    return '';
  }

  const open = assistent.isOpen();
  const nieuwSuggestie = !assistent.berichten().length; // subtiele indicator bij verse paginahulp
  const laag = `<div class="assistent-laag${assistent.isVastgezet() ? ' is-vastgezet' : ''}" data-pagetype="${esc(context.pageType)}">
    ${open ? renderPaneel(context) : ''}
    ${assistent.isVastgezet() ? '' : `<button type="button" class="assistent-launcher${open ? ' is-open' : ''}"
      id="assistentLauncher" data-assistent="toggle"
      aria-expanded="${open ? 'true' : 'false'}" aria-controls="assistentPaneel"
      title="Vraag over deze data">
      ${AI_ICOON}
      <span class="visueel-verborgen">Vraag over deze data</span>
      ${nieuwSuggestie && !open ? '<span class="assistent-indicator" aria-hidden="true"></span>' : ''}
    </button>`}
  </div>`;

  laatstePageType = context.pageType;
  return laag;
}

/** Reset de contextwissel-tracking (bij uitloggen). */
export function resetAssistentUi() { laatstePageType = null; }
