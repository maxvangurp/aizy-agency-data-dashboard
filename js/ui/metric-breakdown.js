/**
 * MetricBreakdown: de inhoud van het opbouw-detailpaneel.
 *
 * Dit is het eerste verdiepingsniveau van een KPI. Een klik op een cijfer opent
 * hier de opbouw: de definitie, de verandering ten opzichte van de vergelijking,
 * en de bijdrage per kanaal, campagne of conversietype — met een aandeel per
 * regel, zodat zichtbaar wordt wie de beweging veroorzaakt.
 *
 * De cijfers komen uit js/data/breakdown.js en tellen per definitie op tot het
 * cijfer op de KPI-kaart, omdat ze uit hetzelfde viewmodel komen.
 */

import { esc, fmt, deltaCel } from '../views/components.js';
import { formatteerMetriek } from '../views/components.js';
import { emptyState } from './states.js';
import { tipTekstAttrs } from './tooltip.js';

/**
 * Bouwt het paneelmodel (titel, ondertitel, inhoud, voettekst) uit een opbouw.
 * @param {object|null} opbouw uit getMetriekOpbouw()
 */
export function metriekOpbouwPaneel(opbouw) {
  if (!opbouw) {
    return {
      titel: 'Geen opbouw beschikbaar',
      inhoud: emptyState({
        titel: 'Voor deze metriek is geen verdieping beschikbaar',
        uitleg: 'Er is geen onderliggende data om deze waarde uit op te bouwen.',
      }),
    };
  }

  const cat = opbouw.catalogus;
  const label = cat.kort ? `${cat.label} (${cat.kort})` : cat.label;

  const kop = `
    <div class="paneel-labels">
      ${badgeVerandering(opbouw.delta)}
      ${cat.bronnen.length ? `<span class="bron-chip" ${tipTekstAttrs('Databron', ['In deze demo is dit vaste demodata.', `Levert straks: ${cat.bronnen.join(', ')}.`])}>Bron: ${esc(cat.bronnen.join(', '))}</span>` : ''}
    </div>

    <section class="paneel-blok">
      <h3>Wat deze metriek betekent</h3>
      ${cat.formule ? `<p>${esc(cat.formule)}</p>` : ''}
      ${cat.interpretatie ? `<p class="muted klein">${esc(cat.interpretatie)}</p>` : ''}
      ${cat.beperking ? `<p class="muted klein">Let op: ${esc(cat.beperking)}</p>` : ''}
    </section>

    <section class="paneel-blok">
      <h3>Verandering</h3>
      <dl class="paneel-cijfers">
        <div><dt>Deze periode</dt><dd>${esc(waarde(opbouw.totaal, cat.formaat))}</dd></div>
        <div><dt>Vergelijking</dt><dd>${esc(waarde(opbouw.vorig, cat.formaat))}</dd></div>
        <div><dt>Verschil</dt><dd>${verschilTekst(opbouw)}</dd></div>
      </dl>
    </section>`;

  const secties = opbouw.secties.length
    ? opbouw.secties.map((s) => renderSectie(s)).join('')
    : `<section class="paneel-blok"><p class="muted klein">Er is geen verdere onderverdeling voor deze selectie.</p></section>`;

  return {
    titel: `Opbouw · ${label}`,
    ondertitel: opbouw.contextLabel,
    inhoud: kop + secties,
    voettekst: `<a class="btn primary" href="${esc(opbouw.volledigeHash)}">Open volledige analyse</a>`,
  };
}

function renderSectie(sectie) {
  return `<section class="paneel-blok">
    <h3>${esc(sectie.titel)}</h3>
    <ul class="opbouw-lijst">
      ${sectie.rijen.map((r) => `<li class="opbouw-rij">
        <div class="opbouw-rij-kop">
          ${r.link === 'klant' && r.clientId
            ? `<button type="button" class="link" data-klantpaneel="${esc(r.clientId)}">${esc(r.label)}</button>`
            : `<span>${esc(r.label)}</span>`}
          <strong>${esc(waarde(r.waarde, sectie.formaat))}</strong>
        </div>
        ${r.aandeel != null ? `<div class="opbouw-balk" role="img" aria-label="${r.aandeel.toFixed(0)} procent aandeel">
          <span style="width:${Math.min(100, r.aandeel).toFixed(1)}%"></span>
        </div>
        <span class="muted klein">${r.aandeel.toFixed(1)} procent van het totaal</span>` : ''}
      </li>`).join('')}
    </ul>
  </section>`;
}

function waarde(v, formaat) {
  return v == null ? 'Niet beschikbaar' : formatteerMetriek(v, formaat);
}

function badgeVerandering(delta) {
  if (!delta || delta.status === 'onvoldoende-data') return '';
  const cls = delta.richting === 'positief' ? 'ok' : delta.richting === 'negatief' ? 'hoog' : 'muted';
  return `<span class="badge badge-${cls}">${esc(delta.tekst)}</span>`;
}

function verschilTekst(opbouw) {
  const d = opbouw.delta;
  if (!d || d.absoluut == null) return '<span class="muted">Niet vergelijkbaar</span>';
  const teken = d.absoluut > 0 ? '+' : '';
  return `<span class="trend-${esc(d.richting)}">${teken}${esc(fmt.getal(Math.round(d.absoluut)))}${d.procent != null ? ` (${d.tekst})` : ''}</span>`;
}
