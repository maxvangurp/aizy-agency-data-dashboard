/**
 * Applicatieshell.
 *
 * Eén frame waar elke pagina in valt, met zes vaste plekken:
 *
 *   1  linkernavigatie      waar je heen kunt
 *   2  globale contextbalk  voor wie en over welke periode je kijkt
 *   3  paginakop            waar je nu bent
 *   4  paginatabs           welk deel van deze pagina
 *   5  hoofdcontent         de inhoud
 *   6  detailpaneel         het detail, zonder de lijst te verlaten
 *
 * WAAROM ÉÉN SHELL
 * Zolang iedere pagina zijn eigen kop en eigen filterblok tekende, kreeg je op
 * de ene pagina een kruimelpad en op de andere niet, en verschoof de inhoud bij
 * iedere navigatie. Nu staat de chrome vast en verandert alleen wat eronder
 * hoort te veranderen.
 *
 * DE CONTEXTBALK IS COMPACT
 * Het oude filterblok nam de bovenste 180 pixels van elke pagina. De keuzes
 * staan nu op één regel, met de volledige set achter een knop. Wat actief is,
 * blijft altijd leesbaar: samenvouwen mag nooit betekenen dat je niet meer weet
 * waar je naar kijkt.
 */

import { esc, badge } from '../views/components.js';
import { ICONEN } from './navigation.js';
import { renderAvatar, renderIdentiteit } from '../views/context-header.js';
import { toegangsniveauTerm, omgevingTerm, LABELS } from '../terminology.js';
import { PERIODE_PRESETS, VERGELIJK_MODI, toonBereik, DEMO_TODAY, STANDAARD_PERIODE, STANDAARD_VERGELIJKING } from '../filters/period.js';
import { CONVERSIE_SCOPE_LABELS } from '../filters/filter-context.js';
import { KANAAL_STATUS_LABELS, KANAAL_STATUS_VARIANT, KanaalStatus } from '../filters/channels.js';

/* ---------------------------------------------------------------
   1. Linkernavigatie
   --------------------------------------------------------------- */

function icoon(naam) {
  const pad = ICONEN[naam] ?? ICONEN.overzicht;
  return `<svg class="nav-icoon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="${pad}" fill="none" stroke="currentColor" stroke-width="1.7"
      stroke-linecap="round" stroke-linejoin="round"></path>
  </svg>`;
}

/**
 * @param {object} opties
 * @param {object[]} opties.groepen    uit navigatieVoor()
 * @param {object|null} opties.actief  het actieve item
 * @param {boolean} opties.compact     ingeklapte stand
 * @param {(id: string) => boolean} opties.groepOpen
 * @param {{omgeving: string, klant: object|null}} opties.context
 */
export function renderSidebar({ groepen, actief, compact, groepOpen, context }) {
  const omgeving = context.omgeving === 'client' ? 'Klantomgeving' : 'Agencyomgeving';

  return `
    <div class="brand">
      <div class="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 64 64"><path d="M19 13h13.3a12.9 12.9 0 1 1 0 25.8H19V13Zm8.4 8.2v9.4h4.6a4.7 4.7 0 1 0 0-9.4h-4.6Zm0 15.3v7.2h4.7a3.6 3.6 0 0 0 0-7.2h-4.7Z"></path></svg>
      </div>
      <div class="brand-tekst">
        <div class="brand-title">Aizy</div>
        <div class="brand-sub">${esc(omgeving)}</div>
      </div>
      <button type="button" class="nav-inklap" id="navInklap"
        aria-pressed="${compact ? 'true' : 'false'}"
        aria-label="${compact ? 'Navigatie uitklappen' : 'Navigatie inklappen'}"
        title="${compact ? 'Navigatie uitklappen' : 'Navigatie inklappen'}">
        <span aria-hidden="true">${compact ? '»' : '«'}</span>
      </button>
    </div>

    ${context.klant ? renderKlantContextblok(context.klant, compact) : ''}

    <nav class="nav" aria-label="Hoofdnavigatie">
      ${groepen.map((groep) => renderNavGroep(groep, { actief, compact, open: groepOpen(groep.id) })).join('')}
    </nav>`;
}

/**
 * De actieve klant in de zijbalk.
 * Wie in een klantomgeving werkt, moet zonder omhoog te kijken weten van wie de
 * cijfers zijn die hij aanpast.
 */
function renderKlantContextblok(klant, compact) {
  if (compact) {
    return `<div class="nav-klant nav-klant-compact" title="Actieve klant: ${esc(klant.name)}">
      <span class="nav-klant-initiaal" aria-hidden="true">${esc(klant.name.slice(0, 2).toUpperCase())}</span>
      <span class="visueel-verborgen">Actieve klant: ${esc(klant.name)}</span>
    </div>`;
  }
  return `<div class="nav-klant">
    <span class="nav-klant-label">Actieve klant</span>
    <span class="nav-klant-naam">${esc(klant.name)}</span>
  </div>`;
}

function renderNavGroep(groep, { actief, compact, open }) {
  const bevatActief = groep.items.some((i) => i === actief);
  // Een groep met het actieve item erin staat altijd open. Anders zou de
  // gebruiker zijn eigen positie niet zien.
  const isOpen = open || bevatActief;
  const paneelId = `navGroep-${groep.id}`;

  return `<div class="nav-groep${isOpen ? ' is-open' : ''}" data-groep="${esc(groep.id)}">
    <button type="button" class="nav-groep-kop" data-navgroep="${esc(groep.id)}"
      aria-expanded="${isOpen ? 'true' : 'false'}" aria-controls="${esc(paneelId)}">
      <span class="nav-groep-titel">${esc(groep.titel)}</span>
      <span class="nav-groep-pijl" aria-hidden="true">${isOpen ? '▾' : '▸'}</span>
    </button>
    <ul class="nav-lijst" id="${esc(paneelId)}"${isOpen ? '' : ' hidden'}>
      ${groep.items.map((i) => {
        const isActief = i === actief;
        return `<li>
          <a href="${esc(i.hash)}" class="nav-link${isActief ? ' active' : ''}"
            ${isActief ? 'aria-current="page"' : ''}
            title="${esc(i.label)}" data-nav="${esc(i.pad)}">
            <span class="nav-icoon-box" aria-hidden="true">${icoon(i.icoon)}</span>
            <span class="nav-link-tekst">${esc(i.label)}</span>
            ${i.aantal != null ? `<span class="nav-badge" aria-hidden="true">${esc(String(i.aantal))}</span>
              <span class="visueel-verborgen">${i.aantal} openstaand</span>` : ''}
          </a>
        </li>`;
      }).join('')}
    </ul>
  </div>`;
}

/* ---------------------------------------------------------------
   2. Globale contextbalk
   --------------------------------------------------------------- */

/**
 * De contextbalk.
 *
 * Links staat waar je bent en voor wie; rechts staan de instellingen die de
 * doorsnede bepalen. De actieve waarden staan altijd als tekst in de balk, ook
 * wanneer het uitgebreide filterpaneel dicht is.
 *
 * @param {object} opties
 * @param {object} opties.user
 * @param {object|null} opties.filters  de opgeloste filtercontext
 * @param {object[]} opties.kanalen
 * @param {string[]} opties.conversieOpties
 * @param {object[]} opties.klanten     klanten waartussen gewisseld kan worden
 * @param {string|null} opties.actieveKlantId
 * @param {number} opties.meldingen     aantal onbekeken signalen
 */
export function renderContextbalk({
  user, filters, kanalen = [], conversieOpties = [], bronnen = [], correcties = [],
  klanten = [], actieveKlantId = null, meldingen = 0, magWisselen = false,
  omgeving = 'agency', zoekwaarde = '',
}) {
  return `
    <div class="contextbalk-links">
      <button type="button" class="menuknop" id="menuKnop"
        aria-label="Navigatie openen" aria-expanded="false">
        <span aria-hidden="true">☰</span>
      </button>
      ${badge(omgevingTerm(omgeving).kort, omgeving === 'client' ? 'ok' : 'omgeving')}
      ${magWisselen ? renderKlantkiezer(klanten, actieveKlantId) : ''}
    </div>

    ${filters ? renderFilterknoppen(filters, kanalen, conversieOpties) : '<div class="contextbalk-filters"></div>'}

    <div class="contextbalk-rechts">
      <div class="zoekveld">
        <label class="visueel-verborgen" for="globaalZoek">Zoeken naar een klant, actie of signaal</label>
        <input type="search" id="globaalZoek" placeholder="Zoeken" value="${esc(zoekwaarde)}"
          autocomplete="off" aria-describedby="zoekHint">
        <span class="visueel-verborgen" id="zoekHint">Typ minimaal twee letters. De resultaten verschijnen eronder.</span>
      </div>
      <button type="button" class="icoonknop" id="meldingenKnop"
        aria-label="${meldingen} nieuwe signalen bekijken" title="Nieuwe signalen">
        <span aria-hidden="true">🔔</span>
        ${meldingen ? `<span class="meldingteller">${meldingen}</span>` : ''}
      </button>
      ${renderAccountmenu(user, actieveKlantId, klanten)}
    </div>

    ${filters ? renderFilterpaneel(filters, kanalen, conversieOpties, bronnen, omgeving) : ''}
    ${correcties.length ? renderCorrecties(correcties) : ''}`;
}

function renderKlantkiezer(klanten, actief) {
  if (!klanten.length) return '';
  return `<div class="klantkiezer">
    <label class="visueel-verborgen" for="contextSelect">Klantomgeving openen</label>
    <select id="contextSelect">
      <option value="">Agencyomgeving</option>
      ${klanten.map((c) => `<option value="${esc(c.id)}"${actief === c.id ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}
    </select>
  </div>`;
}

/**
 * De samengevatte filterstand, altijd zichtbaar.
 * De knop opent het paneel met de volledige keuzes; de tekst op de knoppen
 * vertelt intussen wat er geselecteerd is.
 */
function renderFilterknoppen(filters, kanalen, conversieOpties) {
  const { periode, vergelijking } = filters;
  const gekozen = new Set(filters.channels ?? []);
  const kanaalNamen = kanalen.filter((k) => gekozen.has(k.key)).map((k) => k.label);
  const alleGekozen = kanalen.length > 0 && kanaalNamen.length === kanalen.length;

  const kanaalTekst = !kanalen.length
    ? 'Geen kanalen'
    : alleGekozen
      ? `Alle kanalen (${kanalen.length})`
      : kanaalNamen.length === 1 ? kanaalNamen[0] : `${kanaalNamen.length} van ${kanalen.length} kanalen`;

  // Het aantal filters dat afwijkt van de standaard, voor een compacte badge.
  const actief = [
    periode.preset !== STANDAARD_PERIODE,
    vergelijking.mode !== STANDAARD_VERGELIJKING,
    kanalen.length > 0 && !alleGekozen,
  ].filter(Boolean).length;

  return `<div class="contextbalk-filters">
    <div class="filtergroep" role="group" aria-label="Analysefilters">
      <button type="button" class="contextknop" id="filterToggle"
        aria-expanded="false" aria-controls="filterPaneel">
        <span class="contextknop-label">Periode</span>
        <span class="contextknop-waarde">${esc(toonBereik(periode.startDate, periode.endDate).replace(' tot en met ', ' – '))}</span>
      </button>
      <button type="button" class="contextknop" id="filterToggleVergelijking"
        aria-expanded="false" aria-controls="filterPaneel">
        <span class="contextknop-label">Vergelijking</span>
        <span class="contextknop-waarde">${esc(vergelijking.mode === 'none' ? 'Geen' : vergelijking.label)}</span>
      </button>
      <button type="button" class="contextknop" id="filterToggleKanalen"
        aria-expanded="false" aria-controls="filterPaneel">
        <span class="contextknop-label">Kanalen</span>
        <span class="contextknop-waarde">${esc(kanaalTekst)}</span>
      </button>
      ${conversieOpties.length > 1 ? `<button type="button" class="contextknop" id="filterToggleConversie"
        aria-expanded="false" aria-controls="filterPaneel">
        <span class="contextknop-label">Conversies</span>
        <span class="contextknop-waarde">${esc(CONVERSIE_SCOPE_LABELS[filters.conversionScope] ?? filters.conversionScope)}</span>
      </button>` : ''}
    </div>
    <button type="button" class="filter-reset${actief ? ' is-actief' : ''}" id="filterReset"
      title="Alle filters terugzetten naar de standaard">
      <span aria-hidden="true">↺</span>
      <span class="filter-reset-tekst">Filters resetten</span>
      ${actief ? `<span class="filter-reset-badge" aria-hidden="true">${actief}</span>` : ''}
    </button>
  </div>`;
}

/**
 * Het uitklapbare filterpaneel.
 *
 * De datasetattributen op de wrapper zijn de publicatie van de filterstand.
 * Tests en de rest van de applicatie lezen die in plaats van labels te parsen,
 * zodat een tekstwijziging nooit een test breekt.
 */
function renderFilterpaneel(filters, kanalen, conversieOpties, bronnen, variant = 'agency') {
  const { periode, vergelijking } = filters;
  const gekozen = new Set(filters.channels ?? []);
  const toonConversie = conversieOpties.length > 1;

  return `<section class="filterbalk-wrap" id="filterPaneel" hidden
    data-variant="${esc(variant)}"
    data-periode="${esc(periode.preset)}"
    data-van="${esc(periode.startDate)}"
    data-tot="${esc(periode.endDate)}"
    data-dagen="${periode.dagen}"
    data-vergelijking="${esc(vergelijking.mode)}"
    data-vgl-van="${esc(vergelijking.startDate ?? '')}"
    data-vgl-tot="${esc(vergelijking.endDate ?? '')}"
    data-kanalen="${esc((filters.channels ?? []).join(','))}"
    data-conversie="${esc(filters.conversionScope)}"
    aria-label="Filters">

    <div class="filterbalk filterbalk-velden" id="filterbalkVelden" role="group">
      <div class="veld">
        <label for="filterPeriode">Periode</label>
        <select id="filterPeriode">
          ${PERIODE_PRESETS.map((p) => `<option value="${esc(p.key)}"${periode.preset === p.key ? ' selected' : ''}>${esc(p.label)}</option>`).join('')}
        </select>
      </div>

      ${periode.preset === 'custom' ? `
        <div class="veld veld-datum">
          <label for="filterVan">Van</label>
          <input type="date" id="filterVan" value="${esc(periode.startDate)}" max="${esc(DEMO_TODAY)}"
            aria-describedby="filterDatumHint">
        </div>
        <div class="veld veld-datum">
          <label for="filterTot">Tot en met</label>
          <input type="date" id="filterTot" value="${esc(periode.endDate)}" max="${esc(DEMO_TODAY)}"
            aria-describedby="filterDatumHint">
        </div>
        <p class="filterbalk-hint" id="filterDatumHint">Begin- en einddatum tellen allebei mee.</p>` : ''}

      <div class="veld">
        <label for="filterVergelijking">Vergelijking</label>
        <select id="filterVergelijking">
          ${VERGELIJK_MODI.map((m) => `<option value="${esc(m.key)}"${vergelijking.mode === m.key ? ' selected' : ''}>${esc(m.label)}</option>`).join('')}
        </select>
      </div>

      ${renderKanaalkiezer(kanalen, gekozen)}

      ${toonConversie ? `
        <div class="veld">
          <label for="filterConversie">Conversietype</label>
          <select id="filterConversie">
            ${conversieOpties.map((s) => `<option value="${esc(s)}"${filters.conversionScope === s ? ' selected' : ''}>${esc(CONVERSIE_SCOPE_LABELS[s] ?? s)}</option>`).join('')}
          </select>
        </div>` : ''}
    </div>

    ${renderFiltersamenvatting(filters, kanalen, toonConversie)}
    ${bronnen.length ? renderBronnen(bronnen) : ''}
  </section>`;
}

function renderKanaalkiezer(kanalen, gekozen) {
  if (!kanalen.length) {
    return `<div class="veld">
      <span class="veld-label">Kanalen</span>
      <p class="muted klein">Voor deze weergave zijn geen advertentiekanalen beschikbaar.</p>
    </div>`;
  }

  const alleGekozen = kanalen.every((k) => gekozen.has(k.key));
  const samenvatting = alleGekozen
    ? `Alle kanalen (${kanalen.length})`
    : gekozen.size === 1
      ? kanalen.find((k) => gekozen.has(k.key))?.label ?? '1 kanaal'
      : `${gekozen.size} van ${kanalen.length} kanalen`;

  return `<div class="veld veld-kanalen">
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
        <p class="muted klein">Zonder selectie worden automatisch alle beschikbare kanalen getoond.</p>
      </div>
    </div>
  </div>`;
}

function renderFiltersamenvatting(filters, kanalen, toonConversie) {
  const { periode, vergelijking } = filters;
  const gekozen = new Set(filters.channels ?? []);
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
    chips.push({
      label: 'Conversies',
      waarde: CONVERSIE_SCOPE_LABELS[filters.conversionScope] ?? filters.conversionScope,
    });
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

/* ---------------------------------------------------------------
   Accountmenu
   --------------------------------------------------------------- */

function renderAccountmenu(user, actieveKlantId, klanten) {
  const niveau = toegangsniveauTerm(user.memberships?.[0]?.rol);
  const actieveKlantNaam = actieveKlantId
    ? klanten.find((c) => c.id === actieveKlantId)?.name ?? null
    : null;

  return `
    <div class="accountmenu">
      <button type="button" class="accountknop" id="accountKnop"
        aria-haspopup="menu" aria-expanded="false" aria-controls="accountPaneel"
        aria-label="Accountmenu van ${esc(user.displayName)}">
        ${renderAvatar(user)}
        <span class="accountknop-tekst">
          <span class="accountknop-naam">${esc(user.displayName)}</span>
          <span class="accountknop-rol">${esc(user.jobTitle ?? niveau.kort)}</span>
        </span>
      </button>
      <div class="accountpaneel" id="accountPaneel" role="menu" hidden>
        <div class="accountpaneel-kop">
          ${renderAvatar(user, { groot: true })}
          <div>
            <div class="accountpaneel-naam">${esc(user.displayName)}</div>
            <div class="muted klein">${esc(user.email)}</div>
          </div>
        </div>
        ${renderIdentiteit(user, {
          organisatie: user.organisatieNaam ?? 'Onbekend',
          toegangsniveau: niveau,
        })}
        ${actieveKlantNaam ? `<dl class="identiteit">
          <div class="identiteit-rij">
            <dt>Actieve klantweergave</dt>
            <dd>${esc(actieveKlantNaam)}</dd>
          </div>
        </dl>` : ''}
        <div class="accountpaneel-acties">
          <button type="button" role="menuitem" class="menu-item" id="menuThema">
            Wissel tussen licht en donker thema
          </button>
          <button type="button" role="menuitem" class="menu-item" id="menuDemoReset">
            Demo-indeling en demo-interacties resetten
          </button>
          <button type="button" role="menuitem" class="menu-item gevaar" id="menuUitloggen">
            Uitloggen
          </button>
        </div>
      </div>
    </div>`;
}

/* ---------------------------------------------------------------
   3. Paginakop
   --------------------------------------------------------------- */

/**
 * @param {object} opties
 * @param {{label: string, href?: string}[]} opties.kruimelpad
 * @param {string} opties.titel
 * @param {string} [opties.ondertitel]
 * @param {{tekst: string, variant?: string, uitleg?: string}[]} [opties.labels]
 * @param {string} [opties.acties]  al opgemaakte HTML met knoppen
 */
export function renderPaginakop({
  kruimelpad = [], titel, ondertitel = '', labels = [], acties = '', id = null,
}) {
  return `<header class="paginakop"${id ? ` id="${esc(id)}"` : ''}>
    ${kruimelpad.length ? `<nav class="kruimelpad" aria-label="Kruimelpad">
      <ol>
        ${kruimelpad.map((k, i) => {
          const laatste = i === kruimelpad.length - 1;
          return `<li>${k.href && !laatste
            ? `<a href="${esc(k.href)}">${esc(k.label)}</a>`
            : `<span${laatste ? ' aria-current="page"' : ''}>${esc(k.label)}</span>`}</li>`;
        }).join('')}
      </ol>
    </nav>` : ''}
    <div class="paginakop-rij">
      <div class="paginakop-tekst">
        <h1>${esc(titel)}</h1>
        ${ondertitel ? `<p class="paginakop-sub">${esc(ondertitel)}</p>` : ''}
      </div>
      ${acties ? `<div class="paginakop-acties">${acties}</div>` : ''}
    </div>
    ${labels.length ? `<div class="paginakop-labels">
      ${labels.map((l) => (l.uitleg
        ? `<span class="badge badge-${esc(l.variant ?? 'muted')}" title="${esc(l.uitleg)}">${esc(l.tekst)}</span>`
        : badge(l.tekst, l.variant ?? 'muted'))).join('')}
    </div>` : ''}
  </header>`;
}

/* ---------------------------------------------------------------
   4. Paginatabs
   --------------------------------------------------------------- */

/**
 * Tabs binnen een pagina.
 *
 * Bewust links en geen knoppen: een tab is een adres. Wie er met het midden-
 * muisknopje op klikt hoort hem in een nieuw tabblad te kunnen openen, en wie
 * hem deelt hoort dezelfde tab te krijgen.
 *
 * @param {{key: string, label: string, aantal?: number}[]} tabs
 * @param {string} actief
 * @param {(key: string) => string} hashVoor
 */
export function renderPaginatabs(tabs, actief, hashVoor) {
  if (!tabs.length) return '';

  return `<div class="paginatabs" role="tablist" aria-label="Onderdelen van deze pagina">
    ${tabs.map((t) => {
      const isActief = t.key === actief;
      return `<a class="paginatab${isActief ? ' active' : ''}" role="tab"
        href="${esc(hashVoor(t.key))}"
        aria-selected="${isActief ? 'true' : 'false'}"
        ${isActief ? 'aria-current="page"' : ''}
        data-tab="${esc(t.key)}">
        ${esc(t.label)}
        ${t.aantal != null ? `<span class="tab-teller">${t.aantal}</span>` : ''}
      </a>`;
    }).join('')}
  </div>`;
}

/** De actieve tab, met terugval op de eerste wanneer de gevraagde niet bestaat. */
export function actieveTab(tabs, gevraagd) {
  if (!tabs.length) return null;
  return tabs.some((t) => t.key === gevraagd) ? gevraagd : tabs[0].key;
}

/* ---------------------------------------------------------------
   6. Detailpaneel
   --------------------------------------------------------------- */

/**
 * Uitschuifbaar paneel aan de rechterkant.
 *
 * Het paneel staat in de DOM naast de hoofdcontent en niet erin, zodat de lijst
 * eronder gewoon blijft staan. Op smalle schermen dekt het het scherm volledig
 * af; dan is er geen ruimte voor twee kolommen en is een half zichtbare lijst
 * eronder alleen maar verwarrend.
 */
export function renderDetailpaneel({ open, titel = '', ondertitel = '', inhoud = '', voettekst = '' }) {
  if (!open) return '<aside class="detailpaneel" id="detailpaneel" hidden aria-hidden="true"></aside>';

  return `<aside class="detailpaneel is-open" id="detailpaneel"
    role="dialog" aria-modal="false" aria-labelledby="detailpaneelTitel" tabindex="-1">
    <header class="detailpaneel-kop">
      <div>
        <h2 id="detailpaneelTitel">${esc(titel)}</h2>
        ${ondertitel ? `<p class="muted klein">${esc(ondertitel)}</p>` : ''}
      </div>
      <button type="button" class="icoonknop" id="detailSluit" aria-label="Detailpaneel sluiten">
        <span aria-hidden="true">×</span>
      </button>
    </header>
    <div class="detailpaneel-inhoud">${inhoud}</div>
    ${voettekst ? `<footer class="detailpaneel-voet">${voettekst}</footer>` : ''}
  </aside>`;
}

/* ---------------------------------------------------------------
   Samenstellen
   --------------------------------------------------------------- */

/**
 * Zet de volledige shell in elkaar.
 * Deze functie kent geen data en geen rechten; ze plaatst wat haar wordt
 * aangereikt. Alles wat wél iets weet, zit in app.js en in de repository.
 */
export function renderShell({
  sidebar, contextbalk, kop, tabs, inhoud, detail, compact, drawerOpen, omgeving,
}) {
  return `
    <div class="app-grid${compact ? ' nav-compact' : ''}${drawerOpen ? ' met-detail' : ''}"
      data-omgeving="${esc(omgeving)}">
      <aside class="sidebar" id="sidebar">${sidebar}</aside>
      <div class="main">
        <div class="contextbalk" id="contextbalk">${contextbalk}</div>
        <div class="werkgebied">
          <div id="pageRoot" class="page-root" tabindex="-1">
            ${kop}
            ${tabs}
            <div class="pagina-inhoud">${inhoud}</div>
          </div>
          ${detail}
        </div>
      </div>
    </div>
    <div class="sidebar-overlay" id="sidebarOverlay" hidden></div>`;
}

export { LABELS };
