/**
 * Signaalcentrum — het werkproces in beeld.
 *
 * De pagina volgt één rechte lijn: Actie nodig → Ingepland → Opgelost. "Nieuw"
 * is geen aparte status maar een eigenschap (een badge binnen "Actie nodig").
 *
 * DE KAART
 *   Header  urgentie, klant (nadruk), kanaal, ouderdom — plus een overflowmenu.
 *   Titel   de belangrijkste conclusie.
 *   Blokken Waarom je dit ziet (inklapbaar), Voorgestelde actie, en — zodra er
 *           gepland is — een compact Planning-blok met verantwoordelijke en datum.
 *   Voet    hoogstens één primaire actie. Oplossen en negeren zitten in het menu.
 *
 * ROLLEN
 *   Inplannen en toewijzen zijn voorbehouden aan wie acties mag toewijzen
 *   (Performance Lead). Andere rollen zien geen plancontrols, alleen de
 *   read-only informatie en de gekoppelde actie. Dat gaat via `magPlannen`
 *   (ASSIGN_ACTIONS) en `magVerwerken` (MANAGE_SIGNALS), niet via een losse check.
 */

import { esc, badge } from './components.js';
import { emptyState } from '../ui/states.js';
import { SIGNAAL_STATUSSEN, SignaalStatus, SignaalFase } from '../model/signals.js';
import { toonDatum } from '../filters/period.js';
import { LABELS } from '../terminology.js';

export const SIGNAAL_TABS = [
  { key: 'actie_nodig', label: 'Actie nodig' },
  { key: 'ingepland', label: 'Ingepland' },
  { key: 'opgelost', label: 'Opgelost' },
  { key: 'alle', label: 'Alle signalen' },
];

const OUDERDOM_OPTIES = [
  { key: '3', label: 'Ouder dan 3 dagen' },
  { key: '7', label: 'Ouder dan 7 dagen' },
  { key: '14', label: 'Ouder dan 14 dagen' },
];

/** Welke signalen bij een tab horen. */
export function filterVoorTab(signalen, tab) {
  if (tab === 'alle') return signalen;
  if (tab === 'opgelost') return signalen.filter((s) => s.fase === SignaalFase.OPGELOST);
  if (tab === 'ingepland') return signalen.filter((s) => s.fase === SignaalFase.INGEPLAND);
  return signalen.filter((s) => s.fase === SignaalFase.ACTIE_NODIG);
}

/** De tellers naast de tabnamen, uit dezelfde lijst als de inhoud eronder. */
export function signaalTellers(signalen) {
  return SIGNAAL_TABS.map((t) => ({ ...t, aantal: filterVoorTab(signalen, t.key).length }));
}

/** Past de compacte filterbalk toe. */
function pasFiltersToe(lijst, { klant, ernst, kanaal, verantw, ouderdom }) {
  return lijst
    .filter((s) => !klant || s.klantId === klant)
    .filter((s) => !ernst || s.ernst === ernst)
    .filter((s) => !kanaal || s.kanaal === kanaal)
    .filter((s) => !verantw || s.verantwoordelijkeId === verantw)
    .filter((s) => !ouderdom || (s.ouderdomDagen ?? 0) >= Number(ouderdom));
}

export function renderSignaalcentrum({
  signalen, tab, medewerkers, magVerwerken, magPlannen,
  klanten, negeerVoorId, filters = {},
}) {
  const inTab = filterVoorTab(signalen, tab);
  const zichtbaar = pasFiltersToe(inTab, filters);
  const filterActief = Boolean(filters.klant || filters.ernst || filters.kanaal || filters.verantw || filters.ouderdom);

  // Kanaalopties uit de zichtbare signalen zelf, zodat er geen lege optie ontstaat.
  const kanaalOpties = [...new Map(inTab.map((s) => [s.kanaal, s.kanaalLabel])).entries()]
    .map(([key, label]) => ({ key, label }));

  const teller = filterActief
    ? `${zichtbaar.length} van ${inTab.length} signalen`
    : `${inTab.length} ${inTab.length === 1 ? 'signaal' : 'signalen'}`;

  return `
    <div class="signaal-filterbalk">
      <div class="signaal-filtervelden">
        ${filterSelect('signaalKlant', 'klant', LABELS.klant, 'Alle klanten',
          klanten.map((c) => ({ key: c.id, label: c.name })), filters.klant)}
        ${filterSelect('signaalErnst', 'ernst', 'Urgentie', 'Alle urgenties',
          [{ key: 'hoog', label: 'Hoge urgentie' }, { key: 'middel', label: 'Gemiddelde urgentie' }], filters.ernst)}
        ${filterSelect('signaalKanaal', 'kanaal', 'Kanaal', 'Alle kanalen', kanaalOpties, filters.kanaal)}
        ${filterSelect('signaalVerantw', 'verantw', LABELS.verantwoordelijke, 'Iedereen',
          medewerkers.map((m) => ({ key: m.id, label: m.displayName })), filters.verantw)}
        ${filterSelect('signaalOuderdom', 'ouderdom', 'Ouderdom', 'Elke ouderdom', OUDERDOM_OPTIES, filters.ouderdom)}
      </div>
      <div class="signaal-filterinfo">
        <span class="muted klein" aria-live="polite">${teller}</span>
        ${filterActief ? '<button type="button" class="btn klein" data-signaal-filter-wissen>Filters wissen</button>' : ''}
      </div>
    </div>

    ${!zichtbaar.length
      ? emptyState({
        titel: 'Geen signalen in deze weergave',
        uitleg: 'Pas de filters aan of kies een ander tabblad. Signalen buiten de geselecteerde periode en kanalen worden niet getoond.',
        id: 'signalenLeeg',
      })
      : `<ul class="signaallijst" id="signaallijst">
          ${zichtbaar.map((s) => renderSignaal(s, { medewerkers, magVerwerken, magPlannen, negeerOpen: negeerVoorId === s.id })).join('')}
        </ul>`}`;
}

function filterSelect(id, sleutel, label, alle, opties, waarde) {
  return `<div class="veld veld-compact">
    <label for="${esc(id)}">${esc(label)}</label>
    <select id="${esc(id)}" data-signaal-filter="${esc(sleutel)}">
      <option value="">${esc(alle)}</option>
      ${opties.map((o) => `<option value="${esc(o.key)}"${waarde === o.key ? ' selected' : ''}>${esc(o.label)}</option>`).join('')}
    </select>
  </div>`;
}

/* ---------------------------------------------------------------
   Signaalkaart
   --------------------------------------------------------------- */

function renderSignaal(signaal, { medewerkers, magVerwerken, magPlannen, negeerOpen }) {
  const gepland = signaal.fase === SignaalFase.INGEPLAND || (signaal.primaryActionId && signaal.plannedAt);
  const afgehandeld = [SignaalFase.OPGELOST, SignaalFase.GENEGEERD].includes(signaal.fase);

  return `<li class="signaalkaart alert-${esc(signaal.ernst)} fase-${esc(signaal.fase)}" data-signaal="${esc(signaal.id)}"
    data-status="${esc(signaal.status)}" data-fase="${esc(signaal.fase)}">

    <div class="signaalkaart-header">
      <div class="signaalkaart-kenmerken">
        ${badge(signaal.ernst === 'hoog' ? 'Hoge urgentie' : 'Gemiddelde urgentie', signaal.ernst === 'hoog' ? 'hoog' : 'middel')}
        ${signaal.isNieuw ? badge('Nieuw', 'info') : ''}
        <span class="badge badge-${esc(signaal.faseTerm.variant)}" title="${esc(signaal.faseTerm.omschrijving)}" data-statuslabel>${esc(signaal.faseTerm.kort)}</span>
      </div>
      <div class="signaalkaart-klantregel">
        <strong class="signaalkaart-klant">${esc(signaal.klantNaam)}</strong>
        <span class="muted signaalkaart-kanaal">${esc(signaal.kanaalLabel)}</span>
        <span class="muted klein signaalkaart-ouderdom">Ontstaan ${esc(toonDatum(signaal.startdatum))}${signaal.ouderdomDagen ? ` · ${signaal.ouderdomDagen} dagen open` : ''}</span>
      </div>
      ${renderOverflow(signaal, { magVerwerken, magPlannen, gepland, afgehandeld })}
    </div>

    <h3 class="signaalkaart-titel">${esc(signaal.probleem)}</h3>

    <div class="signaalkaart-blokken">
      <details class="signaalkaart-waarom">
        <summary>Waarom je dit signaal ziet</summary>
        <p>${esc(signaal.oorzaak)}</p>
      </details>
      <div class="signaalkaart-blok">
        <span class="signaalkaart-bloklabel">Voorgestelde actie</span>
        <p>${esc(signaal.aanbeveling)}</p>
      </div>
      ${gepland ? `<div class="signaalkaart-blok signaalkaart-planning">
        <span class="signaalkaart-bloklabel">Planning</span>
        <dl class="signaalkaart-plandata">
          <div><dt>${esc(LABELS.verantwoordelijke)}</dt><dd data-verantwoordelijke>${esc(signaal.verantwoordelijkeNaam)}</dd></div>
          ${signaal.plannedAt ? `<div><dt>Uitvoerdatum</dt><dd>${esc(toonDatum(signaal.plannedAt))}</dd></div>` : ''}
          ${signaal.actie ? `<div><dt>Status</dt><dd>${badge(signaal.actie.statusTerm?.kort ?? 'Nieuw', signaal.actie.statusTerm?.variant ?? 'muted')}</dd></div>` : ''}
        </dl>
      </div>` : ''}
    </div>

    <div class="signaalkaart-voet">
      ${renderPrimair(signaal, { magPlannen, gepland, afgehandeld })}
      <a class="btn klein" href="#/agency/clients/${esc(signaal.klantId)}">Bekijk klant</a>
      <a class="btn klein" href="#/agency/channels/${esc(onderliggendKanaal(signaal))}">Bekijk brondata</a>
    </div>

    ${negeerOpen ? renderNegeerForm(signaal) : ''}
  </li>`;
}

function renderPrimair(signaal, { magPlannen, gepland, afgehandeld }) {
  if (afgehandeld) return '';
  if (gepland) {
    return `<button type="button" class="btn primary klein" data-actiepaneel="${esc(signaal.primaryActionId)}">Bekijk geplande actie</button>`;
  }
  if (magPlannen) {
    return `<button type="button" class="btn primary klein" data-signaal-plan="${esc(signaal.id)}">Actie inplannen</button>`;
  }
  return '';
}

/** Het overflowmenu met de minder frequente, maar belangrijke acties. */
function renderOverflow(signaal, { magVerwerken, magPlannen, gepland, afgehandeld }) {
  const items = [];
  if (magVerwerken && !afgehandeld) {
    items.push(`<button type="button" class="kaart-menu-item" data-signaal-oplossen="${esc(signaal.id)}">Markeren als opgelost</button>`);
  }
  if (magPlannen && gepland && !afgehandeld) {
    items.push(`<button type="button" class="kaart-menu-item" data-signaal-plan="${esc(signaal.id)}">Planning aanpassen</button>`);
  }
  if (magVerwerken && !afgehandeld) {
    items.push(`<button type="button" class="kaart-menu-item" data-signaal-negeren="${esc(signaal.id)}">Negeren met reden</button>`);
  }
  if (magVerwerken && afgehandeld) {
    items.push(`<button type="button" class="kaart-menu-item" data-signaal-heropen="${esc(signaal.id)}">Heropenen</button>`);
  }
  if (!items.length) return '';

  return `<details class="kaart-overflow">
    <summary class="kaart-menu-knop" aria-label="Meer acties" title="Meer acties"><span aria-hidden="true">⋯</span></summary>
    <div class="kaart-menu" role="menu">${items.join('')}</div>
  </details>`;
}

function renderNegeerForm(signaal) {
  return `<form class="negeer-form" id="negeer-${esc(signaal.id)}" data-negeer-form="${esc(signaal.id)}">
    <div class="veld">
      <label for="negeerReden-${esc(signaal.id)}">Waarom wordt dit signaal niet opgevolgd?</label>
      <input type="text" id="negeerReden-${esc(signaal.id)}" name="reden" required
        placeholder="Bijvoorbeeld: bewuste keuze van de klant, budget staat vast tot september">
    </div>
    <div class="veld">
      <label for="negeerToelichting-${esc(signaal.id)}">Toelichting (optioneel)</label>
      <input type="text" id="negeerToelichting-${esc(signaal.id)}" name="toelichting"
        placeholder="Extra context voor later">
    </div>
    <button type="submit" class="btn klein primary">Signaal negeren</button>
  </form>`;
}

/**
 * Naar welke kanaalpagina "Bekijk brondata" gaat.
 * Een signaal over een meetbron heeft geen kanaalpagina; die gaat naar de pagina
 * met alle kanalen, waar de koppelstatus staat.
 */
function onderliggendKanaal(signaal) {
  const kanaalPaginas = ['google_ads', 'meta_ads', 'microsoft_ads', 'linkedin_ads', 'ga4'];
  return kanaalPaginas.includes(signaal.kanaal) ? signaal.kanaal : 'alle';
}

export { SIGNAAL_STATUSSEN };
