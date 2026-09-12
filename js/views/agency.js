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
          [LABELS.medewerker, LABELS.functietitel, LABELS.toegangsniveau, LABELS.toegewezenKlanten,
            'Klanten met aandachtspunten', 'Open signalen', 'Acties'],
          team.map((lid) => teamRij(lid))
        )}
      </div>
      <p class="muted note">
        Klik op een naam voor het laatste inlogmoment en de volledige
        klantverdeling. Klanttoewijzingen en toegangsniveaus liggen in deze demo
        vast en zijn niet te wijzigen.
      </p>
      <p class="muted note">
        De namen van het Aizy Performance Team zijn gebruikt om de demo herkenbaar
        te maken. Toegangsniveaus, klanttoewijzingen, inlogmomenten en
        accountstatussen zijn fictief. Er wordt geen prestatie per medewerker
        gemeten of vergeleken.
      </p>
    </section>`;
}

/**
 * Eén medewerker als tabelrij.
 *
 * WAT ER MIS WAS
 * De tabel was op een scherm van 1440 pixels tot halverwege zichtbaar; de rest
 * stond achter een horizontale schuif zonder enige aanwijzing dat hij er was.
 * Uitgerekend de laatste kolom bevatte de knoppen -- de enige handelingen op
 * deze pagina -- en die bepaalden ondertussen wél de rijhoogte. Vandaar de
 * wisselende, kapot ogende rijen: een beheerder zonder knoppen kreeg een rij van
 * 80 pixels, een medewerker met drie gestapelde knoppen een van 130.
 *
 * Twee oorzaken, twee ingrepen. De knoppen die niets deden zijn weg (zie
 * `teamActies`), en de kolommen zijn teruggebracht van elf naar zeven. Dat
 * laatste is geen smaak maar rekenwerk: gemeten in de browser had de tabel 1838
 * pixels nodig in een werkgebied van 1096. Vier kolommen konden er per definitie
 * niet bij.
 *
 * WAT ER NIET IS VERDWENEN
 * Verantwoordelijkheid en ondersteuning blijven uit elkaar gehouden -- dat is
 * een regel van dit overzicht, geen detail. Ze stonden als twee kolommen met
 * volledige klantnamen, samen zo'n achthonderd pixels, en juist die twee waren
 * daardoor bij niemand in beeld. Ze staan nu als telling in de kolom Toegewezen
 * klanten ("3 · 1 verantwoordelijk · 2 ondersteunend"), met de namen zelf op de
 * medewerkerpagina achter de naam. Hetzelfde geldt voor de accountstatus, die
 * alleen nog opvalt wanneer hij afwijkt, en voor de laatste login.
 */
function teamRij(lid) {
  const g = lid.gebruiker;
  const rol = primaireRol(g);
  const niveau = toegangsniveauTerm(rol);
  const status = accountstatusTerm(g.status);

  return [
    `<a class="link" href="#/agency/team/${esc(g.id)}">${esc(g.displayName)}</a><br><span class="muted klein">${esc(g.email)}</span>`,
    esc(g.jobTitle ?? 'Niet vastgelegd'),
    // "Actief" bij negen van de negen medewerkers is een kolom die nooit iets
    // zegt. Een afwijkende status is wél nieuws en staat er daarom bij.
    `<span title="${esc(niveau.omschrijving)}">${badge(niveau.kort, rol === 'agency_admin' ? 'ok' : 'muted')}</span>
     ${g.status === AccountStatus.ACTIEF ? '' : `<br><span title="${esc(status.omschrijving)}">${badge(status.kort, status.variant)}</span>`}`,
    teamKlantencel(lid),
    lid.aandachtNodig.length ? `<span class="trend-negatief">${lid.aandachtNodig.length}</span>` : '0',
    // Stond onder de kop "Open acties", maar telt signalen op de klanten
    // waarvoor iemand verantwoordelijk is. Overal elders in het dashboard heet
    // dat getal "open signalen", en die twee door elkaar halen is precies het
    // soort verwarring dat een teamoverzicht niet moet veroorzaken.
    String(lid.openSignalen),
    teamActies(g, lid.isBeheerder),
  ];
}

/**
 * Hoeveel klanten, en in welke rol.
 *
 * Het kale aantal verwarde: een beheerder stond op "Alle klanten" met "Geen" in
 * de kolom ernaast, en bij een medewerker zei "3" niets over de vraag of hij
 * ervoor verantwoordelijk is of meekijkt. Dat onderscheid is het hele punt van
 * dit overzicht en staat er nu in dezelfde cel bij.
 */
function teamKlantencel(lid) {
  if (lid.isBeheerder) {
    return `<span class="muted">Alle klanten</span>
      <br><span class="muted klein">Ziet alles, is nergens verantwoordelijk</span>`;
  }
  if (!lid.toegewezen.length) return '<span class="muted">Nog geen klanten</span>';

  const delen = [
    lid.primair.length ? `${lid.primair.length} verantwoordelijk` : null,
    lid.ondersteunend.length ? `${lid.ondersteunend.length} ondersteunend` : null,
  ].filter(Boolean);

  return `${lid.toegewezen.length}
    <br><span class="muted klein">${esc(delen.join(' · ') || 'alleen toegang')}</span>`;
}

/**
 * De handelingen die deze rij wél kan uitvoeren.
 *
 * Hier stonden ook "Klanttoewijzing wijzigen" en "Toegangsniveau wijzigen". Die
 * twee deden niets: ze openden geen scherm en wijzigden niets, ze meldden dat
 * de wijziging in de demo niet beschikbaar is. Zo'n knop is erger dan geen
 * knop -- hij maakt de kolom twee keer zo breed, hij duwt de knoppen die wél
 * werken buiten beeld, en de gebruiker klikt hem één keer per medewerker aan om
 * er telkens dezelfde melding voor terug te krijgen. Dat de toewijzingen
 * vastliggen staat nu één keer onder de tabel, waar het thuishoort.
 */
function teamActies(lid, isBeheerder) {
  const knoppen = [];
  const naam = esc(lid.displayName);

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
        <button type="button" class="btn klein gevaar" id="menuDemoResetInstellingen">Demo-indeling en demo-interacties resetten</button>
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
