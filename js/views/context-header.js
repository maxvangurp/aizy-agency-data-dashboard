/**
 * Contextheader.
 *
 * Op ieder scherm moet zonder nadenken duidelijk zijn waar je bent, voor wie je
 * kijkt en met welke instellingen. Eén component levert dat, zodat er geen
 * concurrerende contextindicatoren naast elkaar ontstaan: één kruimelpad, één
 * titel, één ondertitel en één rij statuslabels.
 *
 * De onderdelen staan altijd in dezelfde volgorde:
 *   kruimelpad   waar dit scherm in de structuur hangt
 *   titel        waar je naar kijkt, meestal de klant of het onderwerp
 *   ondertitel   welke doorsnede, in gewone taal
 *   labels       omgeving, dashboardtype, status
 *   actie        de logische stap terug of vooruit
 */

import { esc, badge } from './components.js';
import { omgevingTerm, dashboardtypeTerm, LABELS } from '../terminology.js';

/**
 * @param {object} opties
 * @param {{label: string, href?: string}[]} opties.kruimelpad
 * @param {string} opties.titel
 * @param {string} [opties.ondertitel]
 * @param {'agency'|'client'} [opties.omgeving]
 * @param {string} [opties.dashboardtype]
 * @param {{tekst: string, variant?: string, uitleg?: string}[]} [opties.labels]
 * @param {{href: string, tekst: string}} [opties.actie]
 */
export function renderContextheader({
  kruimelpad = [], titel, ondertitel = '', omgeving = null,
  dashboardtype = null, labels = [], actie = null,
}) {
  const omgevingsterm = omgeving ? omgevingTerm(omgeving) : null;
  const typeterm = dashboardtype ? dashboardtypeTerm(dashboardtype) : null;

  return `<header class="page-head contextheader" data-omgeving="${esc(omgeving ?? '')}" data-dashboardtype="${esc(dashboardtype ?? '')}">
    ${kruimelpad.length ? renderKruimelpad(kruimelpad) : ''}
    <div class="contextheader-kop">
      <h1>${esc(titel)}</h1>
      ${actie ? `<a class="btn klein" href="${esc(actie.href)}">${esc(actie.tekst)}</a>` : ''}
    </div>
    ${ondertitel ? `<p class="contextheader-sub">${esc(ondertitel)}</p>` : ''}
    <div class="contextheader-labels">
      ${omgevingsterm ? contextLabel(omgevingsterm.kort, 'omgeving', omgevingsterm.omschrijving) : ''}
      ${typeterm ? contextLabel(typeterm.kort, 'muted', typeterm.omschrijving) : ''}
      ${labels.map((l) => contextLabel(l.tekst, l.variant ?? 'muted', l.uitleg)).join('')}
    </div>
  </header>`;
}

function contextLabel(tekst, variant, uitleg) {
  if (!uitleg) return badge(tekst, variant);
  return `<span class="badge badge-${esc(variant)}" title="${esc(uitleg)}">${esc(tekst)}</span>`;
}

function renderKruimelpad(items) {
  return `<nav class="kruimelpad" aria-label="Kruimelpad">
    <ol>
      ${items.map((item, i) => {
        const laatste = i === items.length - 1;
        const inhoud = item.href && !laatste
          ? `<a href="${esc(item.href)}">${esc(item.label)}</a>`
          : `<span${laatste ? ' aria-current="page"' : ''}>${esc(item.label)}</span>`;
        return `<li>${inhoud}</li>`;
      }).join('')}
    </ol>
  </nav>`;
}

/* ---------------------------------------------------------------
   Identiteit
   --------------------------------------------------------------- */

/**
 * Toont wie iemand is, in vier afzonderlijke gegevens.
 *
 * Naam, functietitel, organisatie en toegangsniveau staan bewust onder elkaar
 * en niet op één regel. Een label als "Meekijker · Meridiaan" voegt een rol en
 * een organisatie samen en maakt beide onduidelijk.
 */
export function renderIdentiteit(user, { organisatie, toegangsniveau, compact = false }) {
  if (compact) {
    return `<div class="identiteit identiteit-compact">
      <span class="identiteit-naam">${esc(user.displayName)}</span>
      ${user.jobTitle ? `<span class="identiteit-functie">${esc(user.jobTitle)}</span>` : ''}
    </div>`;
  }

  return `<dl class="identiteit">
    <div class="identiteit-rij">
      <dt>${esc(LABELS.volledigeNaam)}</dt>
      <dd>${esc(user.displayName)}</dd>
    </div>
    ${user.jobTitle ? `<div class="identiteit-rij">
      <dt>${esc(LABELS.functietitel)}</dt>
      <dd>${esc(user.jobTitle)}</dd>
    </div>` : ''}
    <div class="identiteit-rij">
      <dt>${esc(LABELS.organisatie)}</dt>
      <dd>${esc(organisatie)}</dd>
    </div>
    <div class="identiteit-rij">
      <dt>${esc(LABELS.toegangsniveau)}</dt>
      <dd>
        ${esc(toegangsniveau.volledig)}
        <span class="muted klein">${esc(toegangsniveau.omschrijving)}</span>
      </dd>
    </div>
  </dl>`;
}

/**
 * Avatar met de volledige naam als toegankelijke naam.
 *
 * De initialen zijn decoratie: Thyra van der Schoor en Tim Suijkerbuijk hebben
 * allebei TS. Screenreaders en tooltips krijgen daarom altijd de volledige naam.
 */
export function renderAvatar(user, { groot = false } = {}) {
  return `<span class="avatar${groot ? ' groot' : ''}" role="img"
    aria-label="${esc(user.displayName)}" title="${esc(user.displayName)}">${esc(user.avatarInitials)}</span>`;
}

/**
 * Naam met functietitel eronder, voor lijsten en tabellen.
 * Nooit alleen initialen: die zijn niet uniek.
 */
export function renderMedewerker(user, { rol = null } = {}) {
  if (!user) return '<span class="muted">Niet toegewezen</span>';
  return `<span class="medewerker">
    ${renderAvatar(user)}
    <span class="medewerker-tekst">
      <span class="medewerker-naam">${esc(user.displayName)}</span>
      ${user.jobTitle ? `<span class="medewerker-functie muted klein">${esc(user.jobTitle)}</span>` : ''}
      ${rol ? `<span class="medewerker-rol muted klein">${esc(rol)}</span>` : ''}
    </span>
  </span>`;
}
