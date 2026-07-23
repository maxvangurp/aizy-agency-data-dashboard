/**
 * Eén tooltipcomponent voor de hele applicatie.
 *
 * WAAROM ÉÉN
 * Losse tooltipimplementaties per pagina lopen onvermijdelijk uit elkaar: de een
 * sluit op Escape en de ander niet, de een valt buiten het scherm en de ander
 * niet. Deze module bindt één keer op document en bedient alles.
 *
 * WAT ER WORDT UITGELEGD
 *   data-tip="<metrieksleutel>"   toont de definitie uit de metriekcatalogus,
 *                                 met formule, interpretatie, bron en beperking.
 *   data-tip-text="<tekst>"       toont vrije tekst; voor statussen en scores.
 *   data-tip-title="<kop>"        optionele kop boven de vrije tekst.
 *
 * TOEGANKELIJKHEID EN TOUCH
 *   - Verschijnt bij hover én bij toetsenbordfocus.
 *   - Sluit met Escape en bij het verlaten van het element.
 *   - Koppelt zich met aria-describedby aan het element, zodat een screenreader
 *     de uitleg voorleest.
 *   - Op touch opent een tik de tooltip; een tik erbuiten sluit hem. De uitleg
 *     is dus nooit alleen via hover bereikbaar.
 *   - Positioneert zich boven, onder, links of rechts, afhankelijk van de ruimte,
 *     en blijft binnen het scherm.
 *   - Een korte vertraging voorkomt een tooltipstorm bij het langs bewegen.
 */

import { esc } from '../views/components.js';
import { metriekCatalogus } from '../data/metrics-catalog.js';

const TOOLTIP_ID = 'aizyTooltip';
const TOON_VERTRAGING = 120;
const VERBERG_VERTRAGING = 80;

let element = null;
let actiefDoel = null;
let toonTimer = null;
let verbergTimer = null;
let teller = 0;

function tooltipElement() {
  if (!element) {
    element = document.createElement('div');
    element.id = TOOLTIP_ID;
    element.className = 'tooltip';
    element.setAttribute('role', 'tooltip');
    element.hidden = true;
    document.body.appendChild(element);
  }
  return element;
}

/* ---------------------------------------------------------------
   Inhoud
   --------------------------------------------------------------- */

/**
 * Bouwt de inhoud van een metriektooltip.
 * De actieve waarde en de vergelijkingswaarde komen uit dataset­attributen op
 * het element, zodat dezelfde definitie met verschillende cijfers hergebruikt
 * wordt zonder tweede opzoeking.
 */
function metriekInhoud(doel, key) {
  const cat = metriekCatalogus(key);
  const waarde = doel.dataset.tipWaarde;
  const vorig = doel.dataset.tipVorig;
  const bron = doel.dataset.tipBron;

  const regels = [];
  if (cat.formule) regels.push(`<p class="tooltip-regel">${esc(cat.formule)}</p>`);
  if (waarde) {
    regels.push(`<p class="tooltip-cijfer"><span>Deze periode</span><strong>${esc(waarde)}</strong></p>`);
  }
  if (vorig) {
    regels.push(`<p class="tooltip-cijfer"><span>Vergelijking</span><strong>${esc(vorig)}</strong></p>`);
  }
  if (cat.interpretatie) regels.push(`<p class="tooltip-regel muted">${esc(cat.interpretatie)}</p>`);
  if (cat.beperking) regels.push(`<p class="tooltip-regel tooltip-beperking">Let op: ${esc(cat.beperking)}</p>`);

  const bronnen = bron ? [bron] : cat.bronnen;
  const bronRegel = bronnen.length
    ? `<p class="tooltip-bron">Bron: ${esc(bronnen.join(', '))}</p>`
    : '';

  const kop = cat.kort ? `${esc(cat.label)} (${esc(cat.kort)})` : esc(cat.label);
  return `<p class="tooltip-titel">${kop}</p>${regels.join('')}${bronRegel}`;
}

function vrijeInhoud(doel) {
  const titel = doel.dataset.tipTitle;
  const tekst = doel.dataset.tipText ?? '';
  // De tekst mag opzettelijk lichte opmaak bevatten (regels gescheiden door │),
  // zodat een statusuitleg zijn factoren onder elkaar kan tonen.
  const regels = tekst.split('│').map((r) => `<p class="tooltip-regel">${esc(r.trim())}</p>`).join('');
  return `${titel ? `<p class="tooltip-titel">${esc(titel)}</p>` : ''}${regels}`;
}

function inhoudVoor(doel) {
  const key = doel.dataset.tip;
  return key ? metriekInhoud(doel, key) : vrijeInhoud(doel);
}

/* ---------------------------------------------------------------
   Tonen en positioneren
   --------------------------------------------------------------- */

function toon(doel) {
  const tip = tooltipElement();
  tip.innerHTML = inhoudVoor(doel);
  tip.hidden = false;

  if (!doel.id) doel.id = `tipdoel-${teller++}`;
  const beschrijfId = `${TOOLTIP_ID}-live`;
  tip.setAttribute('aria-hidden', 'false');
  // aria-describedby koppelt de uitleg aan het element voor screenreaders.
  const bestaand = (doel.getAttribute('aria-describedby') ?? '').split(' ').filter((x) => x && x !== beschrijfId);
  doel.setAttribute('aria-describedby', [...bestaand, beschrijfId].join(' '));
  tip.id = TOOLTIP_ID;
  tip.setAttribute('data-live', beschrijfId);

  positioneer(tip, doel);
  actiefDoel = doel;
}

/**
 * Kiest de plek met de meeste ruimte en houdt de tooltip binnen het scherm.
 * Voorkeur: boven, dan onder, dan rechts, dan links.
 */
function positioneer(tip, doel) {
  const marge = 8;
  const rect = doel.getBoundingClientRect();
  // Eerst meten met de tooltip zichtbaar maar buiten beeld.
  tip.style.left = '-9999px';
  tip.style.top = '0';
  const tw = tip.offsetWidth;
  const th = tip.offsetHeight;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const ruimteBoven = rect.top;
  const ruimteOnder = vh - rect.bottom;

  let top;
  let plaatsing;
  if (ruimteBoven >= th + marge || ruimteBoven >= ruimteOnder) {
    top = rect.top - th - marge;
    plaatsing = 'boven';
  } else {
    top = rect.bottom + marge;
    plaatsing = 'onder';
  }
  // Binnen het scherm houden.
  top = Math.max(marge, Math.min(top, vh - th - marge));

  let left = rect.left + rect.width / 2 - tw / 2;
  left = Math.max(marge, Math.min(left, vw - tw - marge));

  tip.style.left = `${Math.round(left + window.scrollX)}px`;
  tip.style.top = `${Math.round(top + window.scrollY)}px`;
  tip.dataset.plaatsing = plaatsing;
}

function verberg() {
  const tip = tooltipElement();
  tip.hidden = true;
  tip.setAttribute('aria-hidden', 'true');
  if (actiefDoel) {
    const beschrijfId = `${TOOLTIP_ID}-live`;
    const rest = (actiefDoel.getAttribute('aria-describedby') ?? '')
      .split(' ').filter((x) => x && x !== beschrijfId);
    if (rest.length) actiefDoel.setAttribute('aria-describedby', rest.join(' '));
    else actiefDoel.removeAttribute('aria-describedby');
  }
  actiefDoel = null;
}

function planToon(doel) {
  window.clearTimeout(verbergTimer);
  window.clearTimeout(toonTimer);
  toonTimer = window.setTimeout(() => toon(doel), TOON_VERTRAGING);
}

function planVerberg() {
  window.clearTimeout(toonTimer);
  window.clearTimeout(verbergTimer);
  verbergTimer = window.setTimeout(verberg, VERBERG_VERTRAGING);
}

/* ---------------------------------------------------------------
   Binden
   --------------------------------------------------------------- */

function doelVan(node) {
  return node?.closest?.('[data-tip], [data-tip-text]') ?? null;
}

/** Wordt één keer aangeroepen bij het opstarten. */
export function bindTooltips() {
  // De live-regio moet altijd bestaan zodat aria-describedby ergens naar wijst.
  tooltipElement();

  document.addEventListener('pointerover', (e) => {
    if (e.pointerType === 'touch') return;
    const doel = doelVan(e.target);
    if (doel && doel !== actiefDoel) planToon(doel);
  });

  document.addEventListener('pointerout', (e) => {
    if (e.pointerType === 'touch') return;
    const doel = doelVan(e.target);
    if (doel && !doel.contains(e.relatedTarget) && doel !== e.relatedTarget) planVerberg();
  });

  // Toetsenbord: focus toont, blur verbergt.
  document.addEventListener('focusin', (e) => {
    const doel = doelVan(e.target);
    if (doel) toon(doel);
  });
  document.addEventListener('focusout', (e) => {
    const doel = doelVan(e.target);
    if (doel) verberg();
  });

  // Touch: een tik op een tooltipdoel opent of sluit hem.
  document.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    const doel = doelVan(e.target);
    if (doel) {
      e.preventDefault();
      if (actiefDoel === doel) verberg();
      else toon(doel);
    } else if (actiefDoel) {
      verberg();
    }
  }, true);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && actiefDoel) verberg();
  });

  // Bij scrollen of navigeren de tooltip weghalen, anders blijft hij zweven.
  window.addEventListener('scroll', () => { if (actiefDoel) verberg(); }, true);
  window.addEventListener('hashchange', () => { if (actiefDoel) verberg(); });
}

/**
 * De dataset-attributen voor een metriektooltip, als HTML-fragment.
 * Views roepen dit aan zodat ze de attribuutnamen niet hoeven te kennen.
 */
export function tipAttrs(key, { waarde = null, vorig = null, bron = null } = {}) {
  const delen = [`data-tip="${esc(key)}"`, 'tabindex="0"'];
  if (waarde != null) delen.push(`data-tip-waarde="${esc(waarde)}"`);
  if (vorig != null) delen.push(`data-tip-vorig="${esc(vorig)}"`);
  if (bron != null) delen.push(`data-tip-bron="${esc(bron)}"`);
  return delen.join(' ');
}

/** De dataset-attributen voor een vrije-tekst-tooltip (statussen, scores). */
export function tipTekstAttrs(titel, regels) {
  const tekst = Array.isArray(regels) ? regels.join(' │ ') : String(regels ?? '');
  return `data-tip-text="${esc(tekst)}"${titel ? ` data-tip-title="${esc(titel)}"` : ''} tabindex="0"`;
}
