/**
 * Schermen rond authenticatie: inloggen, wachtwoord vergeten, uitnodiging
 * accepteren, geen toegang en niet gevonden.
 *
 * Deze schermen staan buiten de applicatieshell: er is geen navigatie en geen
 * klantcontext, omdat er nog geen gebruiker is.
 */

import { esc } from './components.js';
import { DEMO_ACCOUNT_SUGGESTIES, DEMO_WACHTWOORD } from '../auth/domain.js';

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
   Inloggen
   --------------------------------------------------------------- */

export function renderLogin({ fout = null, email = '' } = {}) {
  return `
    <div class="auth-scherm">
      <div class="auth-kaart">
        ${merkteken()}
        <h1>Inloggen</h1>
        <p class="muted">Meld je aan met je Aizy-account of je klantaccount.</p>

        <form id="loginForm" novalidate>
          ${fout ? `<div class="banner banner-danger" role="alert"><span>${esc(fout)}</span></div>` : ''}

          <div class="veld">
            <label for="loginEmail">E-mailadres</label>
            <input type="email" id="loginEmail" name="email" autocomplete="username"
              value="${esc(email)}" aria-describedby="loginEmailFout" required>
            ${foutmelding('loginEmailFout')}
          </div>

          <div class="veld">
            <label for="loginWachtwoord">Wachtwoord</label>
            <div class="veld-met-knop">
              <input type="password" id="loginWachtwoord" name="wachtwoord"
                autocomplete="current-password" aria-describedby="loginWachtwoordFout" required>
              <button type="button" class="veld-knop" id="toonWachtwoord"
                aria-label="Wachtwoord tonen" aria-pressed="false">Tonen</button>
            </div>
            ${foutmelding('loginWachtwoordFout')}
          </div>

          <div class="veld-rij">
            <label class="checkbox">
              <input type="checkbox" id="blijfIngelogd" name="blijfIngelogd" checked>
              <span>Ingelogd blijven</span>
            </label>
            <a href="#/forgot-password" class="link-klein">Wachtwoord vergeten</a>
          </div>

          <button type="submit" class="btn primary breed" id="loginKnop">Inloggen</button>
        </form>

        <section class="demo-accounts" aria-labelledby="demoAccountsTitel">
          <h2 id="demoAccountsTitel">Demo-accounts</h2>
          <p class="muted">
            Kies een account om die rol te bekijken. Het wachtwoord is voor alle
            demo-accounts <code>${esc(DEMO_WACHTWOORD)}</code>.
          </p>
          <ul class="demo-account-lijst">
            ${DEMO_ACCOUNT_SUGGESTIES.map(
              (a) => `<li>
                <button type="button" class="demo-account" data-email="${esc(a.email)}">
                  <span class="demo-account-email">${esc(a.email)}</span>
                  <span class="demo-account-rol muted">${esc(a.omschrijving)}</span>
                </button>
              </li>`
            ).join('')}
          </ul>
          <p class="muted klein">
            Deze demo gebruikt fictieve accounts en fictieve data. Er is geen
            productiebeveiliging en de omgeving is niet geschikt voor echte klantgegevens.
          </p>
        </section>
      </div>
    </div>`;
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
          <button type="submit" class="btn primary breed">Herstellink versturen</button>
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

export function renderAcceptInvite({ fout = null, email = 'noor@aizy.demo' } = {}) {
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

          <button type="submit" class="btn primary breed">Account activeren</button>
        </form>

        <p class="muted klein">
          In deze demo staat één openstaande uitnodiging klaar voor
          <code>noor@aizy.demo</code>.
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
