/**
 * Signaalcentrum.
 *
 * Een signaal was een kaartje met een probleem, een oorzaak en een aanbeveling.
 * Mooi om te lezen, en daarna gebeurde er niets. Nu heeft ieder signaal een
 * status, een eigenaar en een uitkomst.
 *
 * DE WERKSTROOM
 *   Nieuw → Bekeken → Actie aangemaakt → Opgelost
 *                  ↘ Genegeerd, met een reden
 *
 * Negeren zonder reden kan niet. Een signaal dat zonder toelichting verdwijnt,
 * komt volgende maand terug en dan weet niemand meer waarom het de vorige keer
 * niet is opgepakt.
 *
 * ÉÉN ACTIE PER SIGNAAL
 * De knop "Omzetten naar actie" maakt een actie aan en koppelt beide kanten aan
 * elkaar. Een tweede klik maakt geen tweede actie maar opent de bestaande. Zo
 * kan het bord niet vollopen met dubbel werk.
 */

import { esc, badge } from './components.js';
import { emptyState } from '../ui/states.js';
import { SIGNAAL_STATUSSEN, SignaalStatus } from '../model/signals.js';
import { toonDatum } from '../filters/period.js';
import { LABELS } from '../terminology.js';

export const SIGNAAL_TABS = [
  { key: 'open', label: 'Openstaand' },
  { key: 'nieuw', label: 'Nieuw' },
  { key: 'afgehandeld', label: 'Afgehandeld' },
  { key: 'alle', label: 'Alle signalen' },
];

/** Welke signalen bij een tab horen. */
export function filterVoorTab(signalen, tab) {
  if (tab === 'nieuw') return signalen.filter((s) => s.status === SignaalStatus.NIEUW);
  if (tab === 'afgehandeld') {
    return signalen.filter((s) => [SignaalStatus.OPGELOST, SignaalStatus.GENEGEERD].includes(s.status));
  }
  if (tab === 'alle') return signalen;
  return signalen.filter((s) => s.open);
}

/** De tellers naast de tabnamen, uit dezelfde lijst als de inhoud eronder. */
export function signaalTellers(signalen) {
  return SIGNAAL_TABS.map((t) => ({ ...t, aantal: filterVoorTab(signalen, t.key).length }));
}

export function renderSignaalcentrum({
  signalen, tab, medewerkers, magVerwerken, filterKlant, filterErnst, klanten, negeerVoorId,
}) {
  const zichtbaar = filterVoorTab(signalen, tab)
    .filter((s) => !filterKlant || s.klantId === filterKlant)
    .filter((s) => !filterErnst || s.ernst === filterErnst);

  return `
    <div class="signaal-filters">
      <div class="veld">
        <label for="signaalKlant">${esc(LABELS.klant)}</label>
        <select id="signaalKlant" data-signaal-filter="klant">
          <option value="">Alle klanten</option>
          ${klanten.map((c) => `<option value="${esc(c.id)}"${filterKlant === c.id ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}
        </select>
      </div>
      <div class="veld">
        <label for="signaalErnst">Urgentie</label>
        <select id="signaalErnst" data-signaal-filter="ernst">
          <option value="">Alle urgenties</option>
          <option value="hoog"${filterErnst === 'hoog' ? ' selected' : ''}>Hoge urgentie</option>
          <option value="middel"${filterErnst === 'middel' ? ' selected' : ''}>Gemiddelde urgentie</option>
        </select>
      </div>
      <span class="muted klein" aria-live="polite">${zichtbaar.length} van ${signalen.length} signalen</span>
    </div>

    ${!zichtbaar.length
      ? emptyState({
        titel: 'Geen signalen in deze weergave',
        uitleg: 'Verruim de periode of kies een andere tab. Signalen buiten de geselecteerde periode en kanalen worden niet getoond.',
        id: 'signalenLeeg',
      })
      : `<ul class="signaallijst" id="signaallijst">
          ${zichtbaar.map((s) => renderSignaal(s, { medewerkers, magVerwerken, negeerOpen: negeerVoorId === s.id })).join('')}
        </ul>`}`;
}

function renderSignaal(signaal, { medewerkers, magVerwerken, negeerOpen }) {
  return `<li class="signaalkaart alert-${esc(signaal.ernst)}" data-signaal="${esc(signaal.id)}"
    data-status="${esc(signaal.status)}">
    <div class="signaalkaart-kop">
      ${badge(signaal.ernst === 'hoog' ? 'Hoge urgentie' : 'Gemiddelde urgentie', signaal.ernst === 'hoog' ? 'hoog' : 'middel')}
      <span class="badge badge-${esc(signaal.statusTerm.variant)}" title="${esc(signaal.statusTerm.omschrijving)}"
        data-statuslabel>${esc(signaal.statusTerm.kort)}</span>
      <strong>${esc(signaal.klantNaam)}</strong>
      <span class="muted">${esc(signaal.kanaalLabel)}</span>
      <span class="muted klein">Ontstaan op ${esc(toonDatum(signaal.startdatum))}${signaal.ouderdomDagen ? ` · ${signaal.ouderdomDagen} dagen open` : ''}</span>
    </div>

    <p class="signaalkaart-probleem">${esc(signaal.probleem)}</p>
    <dl class="signaalkaart-bewijs">
      <div><dt>${esc(LABELS.bewijs)}</dt><dd>${esc(signaal.oorzaak)}</dd></div>
      <div><dt>Voorgestelde actie</dt><dd>${esc(signaal.aanbeveling)}</dd></div>
      <div><dt>${esc(LABELS.verantwoordelijke)}</dt><dd data-verantwoordelijke>${esc(signaal.verantwoordelijkeNaam)}</dd></div>
      ${signaal.actie ? `<div><dt>Gekoppelde actie</dt><dd>
        <button type="button" class="link" data-actiepaneel="${esc(signaal.actie.id)}">${esc(signaal.actie.titel)}</button>
      </dd></div>` : ''}
      ${signaal.plannedAt ? `<div><dt>Ingepland op</dt><dd>${esc(toonDatum(signaal.plannedAt))}</dd></div>` : ''}
      ${signaal.nextReviewAt ? `<div><dt>Resultaatcontrole</dt><dd>${esc(toonDatum(signaal.nextReviewAt))}</dd></div>` : ''}
      ${signaal.reden ? `<div><dt>Reden van negeren</dt><dd>${esc(signaal.reden)}</dd></div>` : ''}
    </dl>

    ${renderWorkflow(signaal)}

    ${magVerwerken ? renderActies(signaal, medewerkers, negeerOpen) : ''}
  </li>`;
}

/**
 * De procespositie op de kaart: een compacte stappenbalk plus de eerstvolgende
 * concrete stap. Zo is in één oogopslag te zien waar het signaal staat en wat er
 * moet gebeuren, zonder de kaart te openen.
 */
function renderWorkflow(signaal) {
  const wf = signaal.workflow;
  if (!wf) return '';
  return `<div class="signaalkaart-workflow">
    <ol class="werkstroom werkstroom-compact" aria-label="Werkstroom">
      ${wf.stappen.map((s) => `<li class="werkstroom-stap is-${esc(s.status)}" title="${esc(s.label)}">
        <span class="werkstroom-punt" aria-hidden="true"></span>
        <span class="visueel-verborgen">${esc(s.label)}: ${esc(s.status)}</span>
      </li>`).join('')}
    </ol>
    <p class="signaalkaart-volgende" data-volgende-stap><strong>Volgende stap:</strong> ${esc(wf.volgendeStap.tekst)}</p>
  </div>`;
}

function renderActies(signaal, medewerkers, negeerOpen) {
  const afgehandeld = [SignaalStatus.OPGELOST, SignaalStatus.GENEGEERD].includes(signaal.status);

  return `<div class="signaalkaart-acties">
    <div class="veld veld-inline">
      <label for="toewijzen-${esc(signaal.id)}">Toewijzen aan</label>
      <select id="toewijzen-${esc(signaal.id)}" data-signaal-toewijzen="${esc(signaal.id)}">
        <option value="">Niet toegewezen</option>
        ${medewerkers.map((m) => `<option value="${esc(m.id)}"${signaal.verantwoordelijkeId === m.id ? ' selected' : ''}>${esc(m.displayName)}</option>`).join('')}
      </select>
    </div>

    ${signaal.status === SignaalStatus.NIEUW
      ? `<button type="button" class="btn klein" data-signaal-bekeken="${esc(signaal.id)}">Markeren als bekeken</button>`
      : ''}

    <button type="button" class="btn klein primary" data-signaal-actie="${esc(signaal.id)}">
      ${signaal.actie ? 'Gekoppelde actie openen' : 'Omzetten naar actie'}
    </button>

    <a class="btn klein" href="#/agency/clients/${esc(signaal.klantId)}">Open klant</a>
    <a class="btn klein" href="#/agency/channels/${esc(onderliggendKanaal(signaal))}">Open onderliggende data</a>

    ${afgehandeld
      ? `<button type="button" class="btn klein" data-signaal-heropen="${esc(signaal.id)}">Heropenen</button>`
      : `<button type="button" class="btn klein" data-signaal-oplossen="${esc(signaal.id)}">Markeren als opgelost</button>
         <button type="button" class="btn klein" data-signaal-negeren="${esc(signaal.id)}"
           aria-expanded="${negeerOpen}" aria-controls="negeer-${esc(signaal.id)}">Negeren met reden</button>`}

    ${negeerOpen ? `<form class="negeer-form" id="negeer-${esc(signaal.id)}" data-negeer-form="${esc(signaal.id)}">
      <div class="veld">
        <label for="negeerReden-${esc(signaal.id)}">Waarom wordt dit signaal niet opgevolgd?</label>
        <input type="text" id="negeerReden-${esc(signaal.id)}" name="reden" required
          placeholder="Bijvoorbeeld: bewuste keuze van de klant, budget staat vast tot september">
      </div>
      <button type="submit" class="btn klein primary">Signaal negeren</button>
    </form>` : ''}
  </div>`;
}

/**
 * Naar welke kanaalpagina "open onderliggende data" gaat.
 * Een signaal over een meetbron heeft geen kanaalpagina; die gaat naar de
 * pagina met alle kanalen, waar de koppelstatus staat.
 */
function onderliggendKanaal(signaal) {
  const kanaalPaginas = ['google_ads', 'meta_ads', 'microsoft_ads', 'linkedin_ads', 'ga4'];
  return kanaalPaginas.includes(signaal.kanaal) ? signaal.kanaal : 'alle';
}

export { SIGNAAL_STATUSSEN };
