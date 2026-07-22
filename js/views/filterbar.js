/**
 * Filterbalk.
 *
 * Eén component voor beide omgevingen, met twee varianten. De agencyversie is
 * compact en informatiedicht; de klantversie toont alleen keuzes die voor een
 * klant betekenis hebben en laat het conversiefilter weg wanneer er maar één
 * zinnige optie is.
 *
 * De balk toont uitsluitend waarden die in deze context zijn toegestaan. De
 * lijst met kanalen komt uit de repository en bevat dus nooit een kanaal van
 * een klant waar de gebruiker geen toegang toe heeft.
 *
 * Toegankelijkheid
 *   Iedere keuze heeft een zichtbaar label. Het kanaalmenu is een knop met
 *   aria-expanded en aria-controls, sluit op Escape en op een klik erbuiten, en
 *   geeft de focus terug aan de knop. Status wordt nooit alleen met kleur
 *   overgebracht: actieve waarden staan ook als tekst in de samenvatting.
 */

import { esc, badge } from './components.js';
import { PERIODE_PRESETS, VERGELIJK_MODI, toonBereik, DEMO_TODAY } from '../filters/period.js';
import { CONVERSIE_SCOPE_LABELS } from '../filters/filter-context.js';
import { KANAAL_STATUS_LABELS, KANAAL_STATUS_VARIANT, KanaalStatus } from '../filters/channels.js';

/**
 * @param {object} opties
 * @param {object} opties.resolved     de opgeloste filtercontext
 * @param {object[]} opties.kanalen    beschikbare advertentiekanalen
 * @param {string[]} opties.conversieOpties
 * @param {object[]} opties.bronnen    meetbronnen met status, alleen ter informatie
 * @param {string[]} opties.correcties meldingen over automatisch herstelde waarden
 * @param {'agency'|'client'} opties.variant
 */
export function renderFilterbalk({
  resolved, kanalen = [], conversieOpties = [], bronnen = [], correcties = [], variant = 'agency',
}) {
  const { periode, vergelijking } = resolved;
  const gekozen = new Set(resolved.channels ?? []);
  const alleGekozen = kanalen.length > 0 && kanalen.every((k) => gekozen.has(k.key));
  const toonConversie = conversieOpties.length > 1;

  return `
  <section class="filterbalk-wrap" data-variant="${esc(variant)}"
    data-periode="${esc(periode.preset)}"
    data-van="${esc(periode.startDate)}"
    data-tot="${esc(periode.endDate)}"
    data-dagen="${periode.dagen}"
    data-vergelijking="${esc(vergelijking.mode)}"
    data-vgl-van="${esc(vergelijking.startDate ?? '')}"
    data-vgl-tot="${esc(vergelijking.endDate ?? '')}"
    data-kanalen="${esc((resolved.channels ?? []).join(','))}"
    data-conversie="${esc(resolved.conversionScope)}">

    <div class="filterbalk-kop">
      <h2 class="filterbalk-titel" id="filterbalkTitel">Filters</h2>
      <button type="button" class="btn klein filterbalk-toggle" id="filterToggle"
        aria-expanded="false" aria-controls="filterbalkVelden">Filters tonen</button>
      <button type="button" class="btn klein" id="filterReset">Filters resetten</button>
    </div>

    <div class="filterbalk filterbalk-velden" id="filterbalkVelden" role="group" aria-labelledby="filterbalkTitel">
      <div class="veld">
        <label for="filterPeriode">Periode</label>
        <select id="filterPeriode">
          ${PERIODE_PRESETS.map((p) => `<option value="${esc(p.key)}"${periode.preset === p.key ? ' selected' : ''}>${esc(p.label)}</option>`).join('')}
        </select>
      </div>

      ${periode.preset === 'custom' ? renderAangepastBereik(periode) : ''}

      <div class="veld">
        <label for="filterVergelijking">Vergelijking</label>
        <select id="filterVergelijking">
          ${VERGELIJK_MODI.map((m) => `<option value="${esc(m.key)}"${vergelijking.mode === m.key ? ' selected' : ''}>${esc(m.label)}</option>`).join('')}
        </select>
      </div>

      ${renderKanaalkiezer(kanalen, gekozen, alleGekozen)}

      ${toonConversie ? `
        <div class="veld">
          <label for="filterConversie">Conversietype</label>
          <select id="filterConversie">
            ${conversieOpties.map((s) => `<option value="${esc(s)}"${resolved.conversionScope === s ? ' selected' : ''}>${esc(CONVERSIE_SCOPE_LABELS[s] ?? s)}</option>`).join('')}
          </select>
        </div>` : ''}
    </div>

    ${renderSamenvatting(resolved, kanalen, toonConversie)}
    ${bronnen.length && variant === 'client' ? renderBronnen(bronnen) : ''}
    ${correcties.length ? renderCorrecties(correcties) : ''}
  </section>`;
}

function renderAangepastBereik(periode) {
  return `
    <div class="veld veld-datum">
      <label for="filterVan">Van</label>
      <input type="date" id="filterVan" value="${esc(periode.startDate)}"
        max="${esc(DEMO_TODAY)}" aria-describedby="filterDatumHint">
    </div>
    <div class="veld veld-datum">
      <label for="filterTot">Tot en met</label>
      <input type="date" id="filterTot" value="${esc(periode.endDate)}"
        max="${esc(DEMO_TODAY)}" aria-describedby="filterDatumHint">
    </div>
    <p class="filterbalk-hint" id="filterDatumHint">Begin- en einddatum tellen allebei mee.</p>`;
}

function renderKanaalkiezer(kanalen, gekozen, alleGekozen) {
  if (!kanalen.length) {
    return `<div class="veld">
      <span class="veld-label">Kanalen</span>
      <p class="muted klein">Voor deze weergave zijn geen advertentiekanalen beschikbaar.</p>
    </div>`;
  }

  const samenvatting = alleGekozen
    ? `Alle kanalen (${kanalen.length})`
    : gekozen.size === 1
      ? kanalen.find((k) => gekozen.has(k.key))?.label ?? '1 kanaal'
      : `${gekozen.size} van ${kanalen.length} kanalen`;

  return `
    <div class="veld veld-kanalen">
      <span class="veld-label" id="filterKanalenLabel">Kanalen</span>
      <div class="kanaalkiezer">
        <button type="button" class="kanaalknop" id="filterKanalenKnop"
          aria-haspopup="true" aria-expanded="false" aria-controls="filterKanalenPaneel"
          aria-labelledby="filterKanalenLabel filterKanalenKnop">
          <span>${esc(samenvatting)}</span>
          <span aria-hidden="true" class="kanaalknop-pijl">▾</span>
        </button>
        <div class="kanaalpaneel" id="filterKanalenPaneel" hidden>
          <fieldset>
            <legend class="visueel-verborgen">Kies advertentiekanalen</legend>
            ${kanalen.map((k) => `
              <label class="kanaaloptie">
                <input type="checkbox" name="filterKanaal" value="${esc(k.key)}"${gekozen.has(k.key) ? ' checked' : ''}>
                <span>${esc(k.label)}</span>
                ${k.status && k.status !== KanaalStatus.GEKOPPELD
                  ? badge(KANAAL_STATUS_LABELS[k.status], KANAAL_STATUS_VARIANT[k.status] ?? 'muted')
                  : ''}
              </label>`).join('')}
          </fieldset>
          <div class="kanaalpaneel-acties">
            <button type="button" class="btn klein" id="filterKanalenAlles">Alles selecteren</button>
            <button type="button" class="btn klein" id="filterKanalenSluiten">Sluiten</button>
          </div>
          <p class="muted klein">
            Zonder selectie worden automatisch alle beschikbare kanalen getoond.
          </p>
        </div>
      </div>
    </div>`;
}

function renderSamenvatting(resolved, kanalen, toonConversie) {
  const { periode, vergelijking } = resolved;
  const gekozen = new Set(resolved.channels ?? []);
  const kanaalNamen = kanalen.filter((k) => gekozen.has(k.key)).map((k) => k.label);
  const allesGekozen = kanalen.length > 0 && kanaalNamen.length === kanalen.length;

  const chips = [
    { label: 'Periode', waarde: toonBereik(periode.startDate, periode.endDate) },
    {
      label: 'Vergelijking',
      waarde: vergelijking.mode === 'none'
        ? 'Geen vergelijking'
        : `${vergelijking.label}: ${toonBereik(vergelijking.startDate, vergelijking.endDate)}`,
    },
    { label: 'Kanalen', waarde: allesGekozen ? `Alle kanalen: ${kanaalNamen.join(', ')}` : kanaalNamen.join(', ') || 'Geen' },
  ];

  if (toonConversie) {
    chips.push({ label: 'Conversies', waarde: CONVERSIE_SCOPE_LABELS[resolved.conversionScope] ?? resolved.conversionScope });
  }

  return `<ul class="filter-samenvatting" id="filterSamenvatting" aria-live="polite">
    ${chips.map((c) => `<li><span class="chip-label">${esc(c.label)}</span> <span class="chip-waarde">${esc(c.waarde)}</span></li>`).join('')}
    ${periode.dagen ? `<li><span class="chip-label">Duur</span> <span class="chip-waarde">${periode.dagen} ${periode.dagen === 1 ? 'dag' : 'dagen'}</span></li>` : ''}
    ${!vergelijking.gelijkeLengte && vergelijking.mode !== 'none'
      ? `<li><span class="chip-label">Let op</span> <span class="chip-waarde">De vergelijkingsperiode telt ${vergelijking.dagen} dagen</span></li>`
      : ''}
  </ul>`;
}

function renderBronnen(bronnen) {
  return `<div class="filter-bronnen">
    <span class="muted klein">Meetbronnen:</span>
    ${bronnen.map((b) => `<span class="bron-status">${esc(b.label)} ${badge(KANAAL_STATUS_LABELS[b.status] ?? b.status, KANAAL_STATUS_VARIANT[b.status] ?? 'muted')}</span>`).join('')}
  </div>`;
}

function renderCorrecties(correcties) {
  return `<div class="banner banner-warning" role="status" id="filterCorrecties">
    <strong>Filterselectie aangepast</strong>
    <span>${esc(correcties.join(' '))}</span>
  </div>`;
}
