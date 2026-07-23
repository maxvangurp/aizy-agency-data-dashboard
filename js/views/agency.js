/**
 * Teambeheer en instellingen binnen de agencyomgeving.
 *
 * Het portefeuilleoverzicht, het persoonlijke overzicht, de klantenlijst, de
 * signalen en de acties stonden hier eerder ook. Ze hebben nu een eigen module,
 * omdat het eigen werkomgevingen zijn geworden met tabs, panelen en
 * configureerbare tabellen:
 *
 *   js/views/portfolio.js      de portefeuille
 *   js/views/my-work.js        de persoonlijke startpagina
 *   js/views/actions.js        het actiecentrum
 *   js/views/signals.js        het signaalcentrum
 *   js/views/planning.js       de planning
 *
 * Wat hier overblijft, gaat over mensen en over de omgeving zelf.
 *
 * De paginakop komt uit de applicatieshell; deze module levert alleen de inhoud.
 */

import { can, Permission } from '../auth/permissions.js';
import { primaireRol, AccountStatus } from '../auth/domain.js';
import { esc, tabel, badge } from './components.js';
import { renderAvatar } from './context-header.js';
import { renderPrioriteit } from './insight-cards.js';
import { emptyState } from '../ui/states.js';
import { dashboardtypeTerm, toegangsniveauTerm, accountstatusTerm, LABELS } from '../terminology.js';
import { renderAssistentInstellingen } from './assistant-settings.js';
import { leesVoorkeuren } from '../assistant/assistant-storage.js';
import { providerStatus } from '../assistant/assistant-controller.js';

/* ---------------------------------------------------------------
   Teambeheer
   --------------------------------------------------------------- */

export function renderAgencyTeam(user, { team }) {
  return `
    <section class="card">
      <div class="kaart-kop">
        <h2>Medewerkers</h2>
        ${can(user, Permission.INVITE_AGENCY_USER)
          ? '<button type="button" class="btn primary" id="nodigUitKnop">Medewerker uitnodigen</button>'
          : ''}
      </div>

      <div class="table-scroll">
        ${tabel(
          [LABELS.medewerker, LABELS.functietitel, LABELS.toegangsniveau, LABELS.accountstatus,
            LABELS.toegewezenKlanten, 'Verantwoordelijk voor', 'Ondersteunt bij',
            'Klanten met aandachtspunten', LABELS.openActies, LABELS.laatsteLogin, 'Acties'],
          team.map((lid) => teamRij(lid))
        )}
      </div>
      <p class="muted note">
        De namen van het Aizy Performance Team zijn gebruikt om de demo herkenbaar
        te maken. Toegangsniveaus, klanttoewijzingen, inlogmomenten en
        accountstatussen zijn fictief. Er wordt geen prestatie per medewerker
        gemeten of vergeleken.
      </p>
    </section>`;
}

function teamRij(lid) {
  const g = lid.gebruiker;
  const rol = primaireRol(g);
  const niveau = toegangsniveauTerm(rol);
  const status = accountstatusTerm(g.status);

  const klantenlijst = (lijst) => (lijst.length
    ? lijst.map((s) => `<a class="link klein" href="#/agency/clients/${esc(s.client.id)}">${esc(s.client.name)}</a>`).join(', ')
    : '<span class="muted">Geen</span>');

  return [
    `<a class="link" href="#/agency/team/${esc(g.id)}">${esc(g.displayName)}</a><br><span class="muted klein">${esc(g.email)}</span>`,
    esc(g.jobTitle ?? 'Niet vastgelegd'),
    `<span title="${esc(niveau.omschrijving)}">${badge(niveau.kort, rol === 'agency_admin' ? 'ok' : 'muted')}</span>`,
    `<span title="${esc(status.omschrijving)}">${badge(status.kort, status.variant)}</span>`,
    lid.isBeheerder ? '<span class="muted">Alle klanten</span>' : `${lid.toegewezen.length}`,
    klantenlijst(lid.primair),
    klantenlijst(lid.ondersteunend),
    lid.aandachtNodig.length ? `<span class="trend-negatief">${lid.aandachtNodig.length}</span>` : '0',
    String(lid.openSignalen),
    g.laatsteLogin
      ? new Date(g.laatsteLogin).toLocaleDateString('nl-NL')
      : '<span class="muted">Nog niet ingelogd</span>',
    teamActies(g, lid.isBeheerder),
  ];
}

function teamActies(lid, isBeheerder) {
  const knoppen = [];
  const naam = esc(lid.displayName);

  if (!isBeheerder) {
    knoppen.push(`<button type="button" class="btn klein" data-actie="wijzig-klanten" data-user="${esc(lid.id)}">Klanttoewijzing wijzigen</button>`);
    knoppen.push(`<button type="button" class="btn klein" data-actie="wijzig-rol" data-user="${esc(lid.id)}">Toegangsniveau wijzigen</button>`);
  }
  if (lid.status === AccountStatus.UITGENODIGD) {
    knoppen.push(`<button type="button" class="btn klein" data-actie="opnieuw-uitnodigen" data-user="${esc(lid.id)}">Uitnodiging opnieuw versturen</button>`);
  }
  if (lid.status === AccountStatus.ACTIEF && !isBeheerder) {
    knoppen.push(`<button type="button" class="btn klein gevaar" data-actie="deactiveer" data-user="${esc(lid.id)}"
      aria-label="Account van ${naam} deactiveren">Account deactiveren</button>`);
  }
  if (lid.status === AccountStatus.GEDEACTIVEERD) {
    knoppen.push(`<button type="button" class="btn klein" data-actie="activeer" data-user="${esc(lid.id)}"
      aria-label="Account van ${naam} activeren">Account activeren</button>`);
  }

  return knoppen.length ? `<div class="actie-groep">${knoppen.join('')}</div>` : '<span class="muted">Geen acties</span>';
}

/* ---------------------------------------------------------------
   Medewerkerdetail
   --------------------------------------------------------------- */

export function renderMedewerkerDetail(user, { lid }) {
  if (!lid) return null;
  const g = lid.gebruiker;
  const rol = primaireRol(g);
  const niveau = toegangsniveauTerm(rol);
  const status = accountstatusTerm(g.status);

  return `
    <section class="card">
      <h2>Account</h2>
      <div class="table-scroll">
        ${tabel(['Onderdeel', 'Waarde'], [
          [LABELS.volledigeNaam, `${renderAvatar(g)} ${esc(g.displayName)}`],
          ['E-mailadres', esc(g.email)],
          [LABELS.functietitel, esc(g.jobTitle ?? 'Niet vastgelegd')],
          [LABELS.organisatie, 'Aizy'],
          [LABELS.toegangsniveau, `${badge(niveau.kort, rol === 'agency_admin' ? 'ok' : 'muted')}<br><span class="muted klein">${esc(niveau.omschrijving)}</span>`],
          [LABELS.accountstatus, `${badge(status.kort, status.variant)}<br><span class="muted klein">${esc(status.omschrijving)}</span>`],
          [LABELS.laatsteLogin, g.laatsteLogin ? new Date(g.laatsteLogin).toLocaleString('nl-NL') : '<span class="muted">Nog niet ingelogd</span>'],
        ])}
      </div>
    </section>

    ${renderMedewerkerKlanten(lid)}

    <section class="card">
      <p class="muted note">
        Klanttoewijzingen, activiteit en accountgegevens in deze demo zijn fictief.
        Er worden geen individuele prestaties gemeten of vergeleken.
      </p>
    </section>`;
}

function renderMedewerkerKlanten(lid) {
  if (lid.isBeheerder) {
    return `<section class="card">
      <h2>Klanttoegang</h2>
      <p class="muted">
        Een agencybeheerder heeft toegang tot alle klanten. Toegang is iets
        anders dan verantwoordelijkheid: hieronder staan de klanten waarvoor
        deze medewerker het aanspreekpunt is.
      </p>
      ${lid.primair.length
        ? `<div class="table-scroll">${klantVerantwoordelijkheidTabel(lid.primair, 'Verantwoordelijk')}</div>`
        : '<p class="empty">Deze medewerker is voor geen enkele klant het aanspreekpunt.</p>'}
    </section>`;
  }

  if (!lid.toegewezen.length) {
    return `<section class="card" id="geenKlanten">
      <h2>Er zijn nog geen klanten aan dit account toegewezen</h2>
      <p class="muted">
        Een agencybeheerder kan klanten aan deze portefeuille toevoegen. Tot die
        tijd ziet deze medewerker geen klantdata.
      </p>
    </section>`;
  }

  return `<section class="card">
    <h2>Klanten</h2>
    <div class="table-scroll">
      ${klantVerantwoordelijkheidTabel(lid.toegewezen, null, lid)}
    </div>
  </section>`;
}

function klantVerantwoordelijkheidTabel(lijst, vasteRol, lid = null) {
  return tabel(
    [LABELS.klant, LABELS.dashboardtype, 'Rol bij deze klant', 'Status', LABELS.prioriteit],
    lijst.map((s) => [
      `<a class="link" href="#/agency/clients/${esc(s.client.id)}">${esc(s.client.name)}</a>`,
      badge(dashboardtypeTerm(s.model).kort, 'muted'),
      vasteRol
        ? badge(vasteRol, 'ok')
        : s.client.primaryOwnerId === lid?.gebruiker.id
          ? badge('Verantwoordelijk', 'ok')
          : badge('Ondersteunend', 'muted'),
      `${badge(s.status.label, s.status.variant)}<br><span class="muted klein">${esc(s.status.reden)}</span>`,
      renderPrioriteit(s.prioriteit, { compact: true }),
    ])
  );
}

/* ---------------------------------------------------------------
   Instellingen
   --------------------------------------------------------------- */

export function renderAgencySettings(user) {
  const rol = primaireRol(user);
  const niveau = toegangsniveauTerm(rol);

  return `
    <section class="card">
      <h2>Jouw account</h2>
      <div class="table-scroll">
        ${tabel(['Onderdeel', 'Waarde'], [
          [LABELS.volledigeNaam, esc(user.displayName)],
          ['E-mailadres', esc(user.email)],
          [LABELS.functietitel, esc(user.jobTitle ?? 'Niet vastgelegd')],
          [LABELS.organisatie, 'Aizy'],
          [LABELS.toegangsniveau, `${esc(niveau.kort)}<br><span class="muted klein">${esc(niveau.omschrijving)}</span>`],
        ])}
      </div>
    </section>

    <section class="card">
      <h2>Weergave</h2>
      <p class="muted">
        Het thema, de compacte navigatie, je widgetindeling en je tabelweergaven
        worden per gebruiker in deze browser bewaard. Ze reizen niet mee naar een
        ander apparaat, want er is nog geen backend die ze kan opslaan.
      </p>
      <div class="instelling-rij">
        <button type="button" class="btn klein" id="menuThemaInstellingen">Wissel tussen licht en donker thema</button>
        <button type="button" class="btn klein gevaar" id="menuDemoReset">Demo-indeling en demo-interacties resetten</button>
      </div>
      <p class="muted klein">
        Resetten zet acties, signaalstatussen, planning, tabelweergaven en
        widgets terug naar de uitgangssituatie. Je blijft ingelogd en je thema
        blijft staan.
      </p>
    </section>

    ${renderAssistentInstellingen({ voorkeuren: leesVoorkeuren(user.id), status: providerStatus() })}

    <section class="card">
      <h2>Databronnen</h2>
      <p class="muted">
        Deze demo gebruikt vaste demodata met dagelijkse reeksen. Koppelingen met
        Google Ads, Meta Ads, Microsoft Ads, LinkedIn Ads, Google Analytics 4 en
        CRM worden ingericht zodra de Azure-backend beschikbaar is.
      </p>
      <a class="link" href="#/agency/integrations">Naar het overzicht van integraties</a>
    </section>`;
}

export { emptyState };
