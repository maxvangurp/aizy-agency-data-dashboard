/**
 * Schermen rond authenticatie: inloggen, wachtwoord vergeten, uitnodiging
 * accepteren, geen toegang en niet gevonden.
 *
 * Deze schermen staan buiten de applicatieshell: er is geen navigatie en geen
 * klantcontext, omdat er nog geen gebruiker is.
 */

import { esc } from './components.js';
import { DEMO_ACCOUNT_SUGGESTIES, DEMO_WACHTWOORD } from '../auth/domain.js';
import { toegangsniveauTerm } from '../terminology.js';

/** Het Aizy-merkteken, gedeeld door alle authenticatieschermen. */
function merkteken() {
  return `<div class="auth-brand">
    <div class="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 64 64"><path d="M19 13h13.3a12.9 12.9 0 1 1 0 25.8H19V13Zm8.4 8.2v9.4h4.6a4.7 4.7 0 1 0 0-9.4h-4.6Zm0 15.3v7.2h4.7a3.6 3.6 0 0 0 0-7.2h-4.7Z"></path></svg>
    </div>
    <span class="auth-brand-name">Aizy</span>
  </div>`;
}

function foutmelding(id, tekst) {
  return `<p class="veld-fout" id="${esc(id)}" role="alert">${tekst ? esc(tekst) : ''}</p>`;
}

/* ---------------------------------------------------------------
   Inloggen — twee flows naast elkaar (simpel + uitgebreid)
   --------------------------------------------------------------- */

/**
 * Eén inlogscherm met twee panelen naast elkaar: links "Snel inzicht" (het
 * datagerichte Meta/Google Ads-dashboard, modus simpel) en rechts "Volledig
 * systeem" (het complete platform, modus uitgebreid). Elk paneel is een echt
 * formulier; de velden staan op `name` (niet op een gedeeld id) zodat ze in één
 * document naast elkaar kunnen bestaan. `foutFlow` bepaalt op welk paneel een
 * foutmelding verschijnt.
 */
export function renderLoginKeuze({ fout = null, foutFlow = null, email = '' } = {}) {
  const paneel = (flow, formId, { badge, titel, pitch, knop, extra = '' }) => `
    <form id="${formId}" class="auth-kaart auth-keuze-kaart auth-keuze-${flow}" novalidate>
      <span class="auth-flow-badge auth-flow-badge-${flow}">${esc(badge)}</span>
      <h2>${titel}</h2>
      <p class="muted">${pitch}</p>

      ${fout && foutFlow === flow ? `<div class="banner banner-danger" role="alert"><span>${esc(fout)}</span></div>` : ''}

      <div class="veld">
        <label for="${formId}-email">E-mailadres</label>
        <input type="email" id="${formId}-email" name="email" autocomplete="username"
          value="${esc(email)}" required>
      </div>

      <div class="veld">
        <label for="${formId}-ww">Wachtwoord</label>
        <div class="veld-met-knop">
          <input type="password" id="${formId}-ww" name="wachtwoord" autocomplete="current-password" required>
          <button type="button" class="veld-knop" data-toon-wachtwoord
            aria-label="Wachtwoord tonen" aria-pressed="false">Tonen</button>
        </div>
      </div>

      ${extra}

      <button type="submit" class="btn primary breed">${esc(knop)}</button>
    </form>`;

  return `
    <div class="auth-scherm auth-keuze">
      <div class="auth-keuze-kop">
        ${merkteken()}
        <h1>Inloggen</h1>
        <p class="muted">Kies hoe je wilt inloggen.</p>
      </div>

      <div class="auth-keuze-grid">
        ${paneel('simpel', 'startLoginForm', {
          badge: 'Snel inzicht',
          titel: 'Meta &amp; Google Ads',
          pitch: 'Direct je advertentiecijfers en trends, zonder omwegen.',
          knop: 'Bekijk mijn cijfers',
        })}
        ${paneel('volledig', 'loginForm', {
          badge: 'Volledig systeem',
          titel: 'Het complete platform',
          pitch: 'Dashboards, signalen, acties, planning en rapportages.',
          knop: 'Inloggen',
          extra: `<div class="veld-rij">
            <label class="checkbox"><input type="checkbox" name="blijfIngelogd" checked><span>Ingelogd blijven</span></label>
            <a href="#/forgot-password" class="link-klein">Wachtwoord vergeten</a>
          </div>`,
        })}
      </div>

      ${demoAccountsSectie()}
    </div>`;
}

/** De gedeelde demo-accounts-sectie onder de twee login-panelen. */
function demoAccountsSectie() {
  return `<section class="demo-accounts" aria-labelledby="demoAccountsTitel">
      <h2 id="demoAccountsTitel">Demo-accounts</h2>
      <p class="muted">
        Kies een account om de gegevens in te vullen; klik daarna links of rechts
        in te loggen. Het wachtwoord is voor alle demo-accounts <code>${esc(DEMO_WACHTWOORD)}</code>.
      </p>
      <ul class="demo-account-lijst">
        ${DEMO_ACCOUNT_SUGGESTIES.map((a) => {
          const niveau = toegangsniveauTerm(a.rol);
          return `<li>
            <button type="button" class="demo-account" data-email="${esc(a.email)}"
              aria-label="Inloggegevens invullen van ${esc(a.naam)}, ${esc(niveau.volledig)}">
              <span class="demo-account-naam">${esc(a.naam)}</span>
              <span class="demo-account-niveau">${esc(niveau.kort)}</span>
              <span class="demo-account-omvang muted">${esc(a.omvang)}</span>
              <span class="demo-account-email muted klein">${esc(a.email)}</span>
            </button>
          </li>`;
        }).join('')}
      </ul>
      <p class="muted klein">
        De namen van het Aizy Performance Team zijn gebruikt om de demo
        herkenbaar te maken. E-mailadressen, rechten, klanttoewijzingen en
        activiteit zijn fictief. Er is geen productiebeveiliging en de omgeving is
        niet geschikt voor echte klantgegevens.
      </p>
    </section>`;
}

/* ---------------------------------------------------------------
   Wachtwoord vergeten
   --------------------------------------------------------------- */

export function renderForgotPassword({ melding = null, gelukt = false } = {}) {
  return `
    <div class="auth-scherm">
      <div class="auth-kaart">
        ${merkteken()}
        <h1>Wachtwoord vergeten</h1>
        <p class="muted">Vul je e-mailadres in. Je ontvangt dan een herstellink.</p>

        ${melding
          ? `<div class="banner ${gelukt ? 'banner-info' : 'banner-danger'}" role="status"><span>${esc(melding)}</span></div>`
          : ''}

        <form id="forgotForm" novalidate>
          <div class="veld">
            <label for="forgotEmail">E-mailadres</label>
            <input type="email" id="forgotEmail" name="email" autocomplete="username"
              aria-describedby="forgotEmailFout" required>
            ${foutmelding('forgotEmailFout')}
          </div>
          <button type="submit" class="btn primary breed">Herstellink naar dit adres versturen</button>
        </form>

        <p class="muted klein">
          In deze demo worden geen e-mails verzonden. De melding is altijd
          hetzelfde, ook wanneer er geen account bij dit adres hoort.
        </p>
        <a href="#/login" class="link-klein">Terug naar inloggen</a>
      </div>
    </div>`;
}

/* ---------------------------------------------------------------
   Uitnodiging accepteren
   --------------------------------------------------------------- */

export function renderAcceptInvite({ fout = null, email = 'thyra@aizy.demo' } = {}) {
  return `
    <div class="auth-scherm">
      <div class="auth-kaart">
        ${merkteken()}
        <h1>Uitnodiging accepteren</h1>
        <p class="muted">Controleer je gegevens en kies een wachtwoord om je account te activeren.</p>

        <form id="inviteForm" novalidate>
          ${fout ? `<div class="banner banner-danger" role="alert"><span>${esc(fout)}</span></div>` : ''}

          <div class="veld">
            <label for="inviteEmail">E-mailadres</label>
            <input type="email" id="inviteEmail" name="email" value="${esc(email)}"
              autocomplete="username" required>
            ${foutmelding('inviteEmailFout')}
          </div>

          <div class="veld">
            <label for="inviteWachtwoord">Kies een wachtwoord</label>
            <input type="password" id="inviteWachtwoord" name="wachtwoord"
              autocomplete="new-password" aria-describedby="inviteWachtwoordFout" required>
            ${foutmelding('inviteWachtwoordFout')}
          </div>

          <div class="veld">
            <label class="checkbox">
              <input type="checkbox" id="naamBevestigd" name="naamBevestigd">
              <span>Ik bevestig dat mijn naam klopt en ga akkoord met de voorwaarden</span>
            </label>
            ${foutmelding('naamBevestigdFout')}
          </div>

          <button type="submit" class="btn primary breed">Wachtwoord instellen en account activeren</button>
        </form>

        <p class="muted klein">
          In deze demo staat één openstaande uitnodiging klaar voor
          <code>thyra@aizy.demo</code>.
        </p>
        <a href="#/login" class="link-klein">Terug naar inloggen</a>
      </div>
    </div>`;
}

/* ---------------------------------------------------------------
   Geen toegang en niet gevonden
   --------------------------------------------------------------- */

export function renderGeenToegang({ reden = '', terugNaar = '#/login', terugLabel = 'Terug' } = {}) {
  return `
    <div class="status-scherm" data-status="geen-toegang">
      <h1>Geen toegang</h1>
      <p>${esc(reden || 'Je account heeft geen rechten voor dit onderdeel.')}</p>
      <a href="${esc(terugNaar)}" class="btn primary">${esc(terugLabel)}</a>
    </div>`;
}

export function renderNietGevonden({ pad = '', terugNaar = '#/login', terugLabel = 'Terug' } = {}) {
  return `
    <div class="status-scherm" data-status="niet-gevonden">
      <h1>Pagina niet gevonden</h1>
      <p>De pagina <code>${esc(pad)}</code> bestaat niet.</p>
      <a href="${esc(terugNaar)}" class="btn primary">${esc(terugLabel)}</a>
    </div>`;
}
