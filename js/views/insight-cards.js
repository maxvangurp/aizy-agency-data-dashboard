/**
 * Inzichtkaarten.
 *
 * Een inzichtkaart toont in vaste volgorde: wat er veranderde, hoe groot dat
 * is, waar het waarschijnlijk vandaan komt, waarop die uitspraak rust, hoe
 * zeker hij is en wat de logische vervolgstap is. Ontbreekt het bewijs, dan
 * ontbreekt het inzicht; er verschijnt hier nooit een conclusie zonder cijfers.
 *
 * Er is één dominante kaart per sectie. De overige inzichten staan compacter
 * eronder, zodat de leesvolgorde de prioriteit volgt.
 */

import { esc, badge } from './components.js';
import {
  inzichtCategorieTerm, betrouwbaarheidTerm, LABELS,
} from '../terminology.js';

/**
 * @param {{primair: object[], aanvullend: object[]}} inzichten
 * @param {{titel?: string, toonAanvullend?: boolean}} opties
 */
export function renderInzichten(inzichten, { titel = 'Wat er is veranderd', toonAanvullend = true } = {}) {
  const primair = inzichten?.primair ?? [];
  const aanvullend = inzichten?.aanvullend ?? [];

  if (!primair.length) {
    return `<section class="card inzichten-blok" id="inzichten">
      <h2>${esc(titel)}</h2>
      <p class="empty">
        Er zijn binnen deze selectie geen veranderingen die groot genoeg zijn om
        te melden. Kies een langere periode om een ontwikkeling te kunnen zien.
      </p>
    </section>`;
  }

  return `<section class="inzichten-blok" id="inzichten" aria-labelledby="inzichtenTitel">
    <h2 id="inzichtenTitel" class="sectie-titel">${esc(titel)}</h2>
    <div class="inzicht-grid">
      ${primair.map((i, index) => renderInzichtkaart(i, { dominant: index === 0 })).join('')}
    </div>
    ${toonAanvullend && aanvullend.length ? renderAanvullend(aanvullend) : ''}
  </section>`;
}

export function renderInzichtkaart(inzicht, { dominant = false } = {}) {
  const categorie = inzichtCategorieTerm(inzicht.categorie);
  const zekerheid = betrouwbaarheidTerm(inzicht.betrouwbaarheid);

  return `<article class="card inzicht-kaart${dominant ? ' is-dominant' : ''}"
    data-categorie="${esc(inzicht.categorie)}" data-betrouwbaarheid="${esc(inzicht.betrouwbaarheid)}">
    <div class="inzicht-kop">
      ${badge(categorie.kort, categorie.variant ?? 'muted')}
      <span class="inzicht-zekerheid" title="${esc(zekerheid.omschrijving)}">
        ${badge(zekerheid.kort, zekerheid.variant ?? 'muted')}
      </span>
    </div>

    <h3 class="inzicht-titel">${esc(inzicht.titel)}</h3>
    <p class="inzicht-samenvatting">${esc(inzicht.samenvatting)}</p>

    ${inzicht.bewijs?.length ? renderBewijs(inzicht.bewijs) : ''}
    ${inzicht.herkomst ? `<p class="inzicht-herkomst"><span class="eyebrow">${esc(LABELS.context)}</span> ${esc(inzicht.herkomst)}</p>` : ''}
    ${inzicht.betrouwbaarheidRedenen?.length ? renderKanttekening(inzicht.betrouwbaarheidRedenen) : ''}
    ${inzicht.actie ? renderActie(inzicht.actie) : ''}
  </article>`;
}

function renderBewijs(bewijs) {
  return `<details class="inzicht-bewijs">
    <summary>${esc(LABELS.bewijs)} bekijken</summary>
    <dl>
      ${bewijs.map((b) => `<div class="bewijs-rij">
        <dt>${esc(b.label)}</dt>
        <dd>${esc(b.waarde)}</dd>
      </div>`).join('')}
    </dl>
  </details>`;
}

function renderKanttekening(redenen) {
  return `<p class="inzicht-kanttekening">
    <span class="eyebrow">${esc(LABELS.kanttekening)}</span>
    ${esc(redenen.join(' '))}
  </p>`;
}

function renderActie(actie) {
  return `<p class="inzicht-actie">
    <span class="eyebrow">${esc(LABELS.actie)}</span>
    ${esc(actie)}
  </p>`;
}

function renderAanvullend(aanvullend) {
  return `<details class="inzicht-aanvullend">
    <summary>Nog ${aanvullend.length} ${aanvullend.length === 1 ? 'bevinding' : 'bevindingen'}</summary>
    <ul class="inzicht-lijst-compact">
      ${aanvullend.map((i) => `<li>
        <strong>${esc(i.titel)}</strong>
        <span class="muted klein">${esc(i.samenvatting)}</span>
        ${i.actie ? `<span class="klein"><span class="eyebrow">${esc(LABELS.actie)}</span> ${esc(i.actie)}</span>` : ''}
      </li>`).join('')}
    </ul>
  </details>`;
}

/* ---------------------------------------------------------------
   Prioriteit
   --------------------------------------------------------------- */

/**
 * De prioriteit van een klant, altijd met de redenen erbij.
 * Er verschijnt nooit alleen een cijfer: de redenen zijn de uitkomst, de score
 * bepaalt alleen de volgorde.
 */
export function renderPrioriteit(prioriteit, { compact = false } = {}) {
  if (!prioriteit) return '';

  if (compact) {
    return `<span class="prioriteit-compact" title="${esc(prioriteit.redenen[0] ?? '')}">
      ${badge(prioriteit.label, prioriteit.variant)}
    </span>`;
  }

  return `<div class="prioriteit-blok" data-prioriteit="${esc(prioriteit.niveau)}">
    <div class="prioriteit-kop">${badge(prioriteit.label, prioriteit.variant)}</div>
    <p class="eyebrow">${esc(LABELS.waaromAandacht)}</p>
    <ul class="prioriteit-redenen">
      ${prioriteit.redenen.map((r) => `<li>${esc(r)}</li>`).join('')}
    </ul>
  </div>`;
}
