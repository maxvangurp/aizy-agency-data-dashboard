/**
 * Klantomgeving.
 *
 * Dit is geen uitgeklede agencyomgeving. Een klant kijkt naar zijn eigen
 * resultaat en heeft niets aan interne prioriteiten, statusscores of signalen
 * die in bureautaal zijn opgeschreven. De inhoud komt uit dezelfde bron als het
 * agencydashboard, maar de selectie en de toon zijn anders.
 *
 * Wat hier nooit terechtkomt: andere klanten, agencybrede cijfers, interne
 * notities, medewerkerbelasting, marges en signalen. De filterbalk toont in
 * deze omgeving alleen de kanalen van de eigen organisatie.
 */

import { getOrganisatieGebruikers, BusinessModel } from '../data/repository.js';
import { renderLeadgenKlantview, drawLeadgenCharts } from './leadgen.js';
import { renderEcommerceClient, drawEcommerceCharts } from './ecommerce.js';
import { can, Permission } from '../auth/permissions.js';
import { primaireRol, ROL_LABELS, ACCOUNT_STATUS_LABELS } from '../auth/domain.js';
import { fmt, esc, tabel, badge } from './components.js';
import { toonBereik } from '../filters/period.js';

/**
 * Kop van de klantomgeving.
 * Toont de klantnaam, niet de naam van het bureau of de medewerker.
 */
function klantKop(client, ondertitel) {
  return `<header class="page-head">
    <h1>${esc(client.name)}</h1>
    <p>${esc(ondertitel)}</p>
  </header>`;
}

/** Getoond wanneer er voor een bedrijfsmodel nog geen dashboard bestaat. */
function geenDashboardType(client) {
  return `<section class="card leeg-blok">
    <h2>Nog geen dashboard beschikbaar</h2>
    <p class="muted">
      Voor ${esc(client.name)} is nog geen dashboard ingericht dat past bij het
      ingestelde bedrijfsmodel. Je accountmanager richt dit in.
    </p>
  </section>`;
}

function heeftDashboard(dashboard) {
  return [BusinessModel.LEADGEN, BusinessModel.ECOMMERCE].includes(dashboard.type);
}

/* ---------------------------------------------------------------
   Overzicht en resultaten
   --------------------------------------------------------------- */

export function renderClientOverview({ dashboard, verhaal, filterbalk = '' }) {
  if (!dashboard) return null;
  const { client, periode } = dashboard;

  if (!heeftDashboard(dashboard)) {
    return klantKop(client, `Resultaten van ${toonBereik(periode.startDate, periode.endDate)}`)
      + filterbalk + geenDashboardType(client);
  }

  // De klantweergave van leadgeneratie bevat het periodeverhaal en is bewust
  // rustiger dan het agencydashboard. Voor e-commerce is het bestaande
  // dashboard inhoudelijk geschikt en wordt dat hergebruikt.
  const inhoud = dashboard.type === BusinessModel.LEADGEN
    ? renderLeadgenKlantview(dashboard, verhaal)
    : renderEcommerceClient(dashboard, verhaal);

  return splitsKop(inhoud, filterbalk);
}

/**
 * Zet de filterbalk direct onder de paginakop.
 * De dashboardmodules maken zelf hun kop; die blijft daarmee de eerste h1 op de
 * pagina, wat voor screenreaders en voor de navigatie belangrijk is.
 */
function splitsKop(inhoud, filterbalk) {
  if (!filterbalk) return inhoud;
  const einde = inhoud.indexOf('</header>');
  if (einde === -1) return filterbalk + inhoud;
  const grens = einde + '</header>'.length;
  return inhoud.slice(0, grens) + filterbalk + inhoud.slice(grens);
}

/**
 * Resultatenpagina met het volledige beeld.
 * Voor leadgeneratie wordt hier bewust de klantweergave hergebruikt in plaats
 * van het agencydashboard, omdat dat laatste interne kolommen bevat.
 */
export function renderClientPerformance(model) {
  return renderClientOverview(model);
}

/** Conversieoverzicht, zonder interne kwalificatiekolommen. */
export function renderClientConversions({ dashboard, filterbalk = '' }) {
  if (!dashboard) return null;
  const { client, periode, conversies } = dashboard;

  if (!heeftDashboard(dashboard)) {
    return klantKop(client, 'Conversies') + filterbalk + geenDashboardType(client);
  }

  const rij = (c) => [
    esc(c.label),
    c.aantal == null ? '<span class="muted">Niet gemeten</span>' : fmt.getal(c.aantal),
    c.vorigePeriode == null ? '<span class="muted">Geen vergelijking</span>' : fmt.getal(c.vorigePeriode),
  ];

  const kop = client.businessModel === BusinessModel.ECOMMERCE
    ? { primair: 'Aankopen', secundair: 'Stappen daarvoor' }
    : { primair: 'Aanvragen', secundair: 'Overige contactmomenten' };

  const uitleg = client.businessModel === BusinessModel.ECOMMERCE
    ? 'Winkelwagen- en checkoutacties gaan aan dezelfde aankoop vooraf. Ze worden daarom niet bij de aankopen opgeteld.'
    : 'Signalen van interesse die nog geen aanvraag zijn.';

  return `
    ${klantKop(client, `Conversies van ${toonBereik(periode.startDate, periode.endDate)}`)}
    ${filterbalk}
    <section class="card">
      <h2>${esc(kop.primair)}</h2>
      <p class="muted">Acties waaruit een gesprek of opdracht kan volgen.</p>
      <div class="table-scroll">
        ${tabel(['Conversie', 'Aantal', 'Vorige periode'], conversies.primair.map(rij))}
      </div>
    </section>
    <section class="card">
      <h2>${esc(kop.secundair)}</h2>
      <p class="muted">${esc(uitleg)}</p>
      <div class="table-scroll">
        ${tabel(['Conversie', 'Aantal', 'Vorige periode'], conversies.secundair.map(rij))}
      </div>
    </section>`;
}

/* ---------------------------------------------------------------
   Rapportage
   --------------------------------------------------------------- */

export function renderClientReport({ dashboard, verhaal, filterbalk = '' }) {
  if (!dashboard) return null;
  const { client, periode, vergelijking, vergelijkingActief } = dashboard;

  const blok = (titel, items) => `
    <section class="card">
      <h2>${esc(titel)}</h2>
      ${!items?.length
        ? '<p class="empty">Niets te melden voor deze periode.</p>'
        : `<ul class="verhaal-lijst">${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`}
    </section>`;

  const ondertitel = vergelijkingActief
    ? `${toonBereik(periode.startDate, periode.endDate)}, vergeleken met ${toonBereik(vergelijking.startDate, vergelijking.endDate)}`
    : `${toonBereik(periode.startDate, periode.endDate)}, zonder vergelijking`;

  return `
    ${klantKop(client, ondertitel)}
    ${filterbalk}
    ${!verhaal
      ? '<section class="card"><p class="empty">Voor deze klant is nog geen periodeverhaal beschikbaar.</p></section>'
      : `
        ${blok('Wat ik deze periode deed', verhaal.gedaan)}
        ${blok('Wat het resultaat daarvan was', verhaal.goed)}
        ${blok('Waar ik nu op let', verhaal.aandacht)}
        ${verhaal.meetbeperkingen?.length ? blok('Wat we niet kunnen meten', verhaal.meetbeperkingen) : ''}
        ${blok('Wat ik hierna ga doen', verhaal.volgende)}
        ${blok('Wat ik van je nodig heb', verhaal.vanKlant)}`}
  `;
}

/* ---------------------------------------------------------------
   Gebruikersbeheer binnen de klantorganisatie
   --------------------------------------------------------------- */

export function renderClientUsers(user, { dashboard }) {
  if (!can(user, Permission.MANAGE_CLIENT_USERS)) return null;
  if (!dashboard) return null;

  const gebruikers = getOrganisatieGebruikers(user, dashboard.client.id);

  return `
    ${klantKop(dashboard.client, 'Gebruikers binnen je organisatie')}
    <section class="card">
      <div class="kaart-kop">
        <h2>Gebruikers</h2>
        ${can(user, Permission.INVITE_CLIENT_USER)
          ? '<button type="button" class="btn primary" id="nodigCollegaUit">Collega uitnodigen</button>'
          : ''}
      </div>
      <div class="table-scroll">
        ${tabel(['Naam', 'E-mailadres', 'Rol', 'Status'],
          gebruikers.map((g) => [
            esc(g.displayName),
            esc(g.email),
            badge(ROL_LABELS[primaireRol(g)] ?? primaireRol(g), 'muted'),
            badge(ACCOUNT_STATUS_LABELS[g.status] ?? g.status, g.status === 'actief' ? 'ok' : 'middel'),
          ]))}
      </div>
      <p class="muted note">Wijzigingen worden lokaal in deze demo bewaard.</p>
    </section>`;
}

/* ---------------------------------------------------------------
   Grafieken
   --------------------------------------------------------------- */

export function drawClientCharts(dashboard) {
  if (!dashboard || !heeftDashboard(dashboard)) return;

  if (dashboard.type === BusinessModel.LEADGEN) {
    drawLeadgenCharts(dashboard, { klantview: true });
  } else {
    drawEcommerceCharts(dashboard);
  }
}
