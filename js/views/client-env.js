/**
 * Klantomgeving.
 *
 * Dit is geen uitgeklede agencyomgeving. Een klant kijkt naar zijn eigen
 * resultaat en heeft niets aan interne prioriteiten, statusscores of
 * signalen die in bureautaal zijn opgeschreven. De inhoud komt uit dezelfde
 * bron als het agencydashboard, maar de selectie en de toon zijn anders.
 *
 * Wat hier nooit terechtkomt: andere klanten, agencybrede cijfers, interne
 * notities, medewerkerbelasting, marges en signalen.
 */

import { getClientDashboardData, BusinessModel } from '../data/repository.js';
import { renderLeadgenKlantview, drawLeadgenCharts } from './leadgen.js';
import { renderEcommerceClient, drawEcommerceCharts } from './ecommerce.js';
import { getOrganisatieGebruikers } from '../data/repository.js';
import { can, Permission } from '../auth/permissions.js';
import { primaireRol, ROL_LABELS, ACCOUNT_STATUS_LABELS } from '../auth/domain.js';
import { fmt, esc, kpi, tabel, badge } from './components.js';

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

/* ---------------------------------------------------------------
   Overzicht
   --------------------------------------------------------------- */

export function renderClientOverview(user, clientId) {
  const bundel = getClientDashboardData(user, clientId);
  if (!bundel) return null;

  const { client, type, data } = bundel;
  if (!data) return klantKop(client, 'Resultaten van deze periode') + geenDashboardType(client);

  // De klantweergave van leadgeneratie bevat het periodeverhaal en is
  // bewust rustiger dan het agencydashboard.
  if (type === BusinessModel.LEADGEN) {
    return renderLeadgenKlantview(client);
  }

  // Voor e-commerce bestaat nog geen aparte klantweergave. Het bestaande
  // dashboard is inhoudelijk geschikt, dus dat wordt hergebruikt met een
  // klantgerichte kop erboven.
  return renderEcommerceClient(client);
}

export function drawClientCharts(user, clientId) {
  const bundel = getClientDashboardData(user, clientId);
  if (!bundel?.data) return;

  if (bundel.type === BusinessModel.LEADGEN) {
    drawLeadgenCharts(bundel.client, { klantview: true });
  } else if (bundel.type === BusinessModel.ECOMMERCE) {
    drawEcommerceCharts(bundel.client);
  }
}

/* ---------------------------------------------------------------
   Resultaten en conversies
   --------------------------------------------------------------- */

/**
 * Resultatenpagina met het volledige beeld.
 * Voor leadgeneratie wordt hier bewust de klantweergave hergebruikt in
 * plaats van het agencydashboard, omdat dat laatste interne kolommen bevat.
 */
export function renderClientPerformance(user, clientId) {
  const bundel = getClientDashboardData(user, clientId);
  if (!bundel) return null;
  const { client, type, data } = bundel;
  if (!data) return klantKop(client, 'Resultaten') + geenDashboardType(client);

  return type === BusinessModel.LEADGEN
    ? renderLeadgenKlantview(client)
    : renderEcommerceClient(client);
}

/** Conversieoverzicht, zonder interne kwalificatiekolommen. */
export function renderClientConversions(user, clientId) {
  const bundel = getClientDashboardData(user, clientId);
  if (!bundel) return null;
  const { client, type, data } = bundel;
  if (!data) return klantKop(client, 'Conversies') + geenDashboardType(client);

  if (type === BusinessModel.LEADGEN) {
    const conversies = data.conversies ?? [];
    const config = data.conversieConfig ?? { primair: [], secundair: [] };
    const labels = data.CONVERSIE_LABELS ?? null;

    const rij = (c) => [
      esc(labelVoor(c.type, labels)),
      fmt.getal(c.aantal),
      fmt.getal(c.vorigePeriode),
    ];

    return `
      ${klantKop(client, 'Conversies deze periode')}
      <section class="card">
        <h2>Aanvragen</h2>
        <p class="muted">Acties waaruit een gesprek of opdracht kan volgen.</p>
        <div class="table-scroll">
          ${tabel(['Conversie', 'Aantal', 'Vorige periode'],
            conversies.filter((c) => config.primair.includes(c.type)).map(rij))}
        </div>
      </section>
      <section class="card">
        <h2>Overige contactmomenten</h2>
        <p class="muted">Signalen van interesse die nog geen aanvraag zijn.</p>
        <div class="table-scroll">
          ${tabel(['Conversie', 'Aantal', 'Vorige periode'],
            conversies.filter((c) => config.secundair.includes(c.type)).map(rij))}
        </div>
      </section>`;
  }

  // E-commerce: de events van de winkelwagen tot de aankoop.
  const e = data.events ?? {};
  const v = data.eventsVorigePeriode ?? {};
  const stappen = [
    ['Product bekeken', e.view_item, v.view_item],
    ['Toegevoegd aan winkelwagen', e.add_to_cart, v.add_to_cart],
    ['Winkelwagen bekeken', e.view_cart, v.view_cart],
    ['Checkout gestart', e.begin_checkout, v.begin_checkout],
    ['Aankoop', e.purchase, v.purchase],
  ];

  return `
    ${klantKop(client, 'Conversies deze periode')}
    <section class="card">
      <h2>Van bezoek tot aankoop</h2>
      <div class="table-scroll">
        ${tabel(['Stap', 'Aantal', 'Vorige periode'],
          stappen.map(([label, nu, toen]) => [
            esc(label),
            nu == null ? '<span class="muted">Niet gemeten</span>' : fmt.getal(nu),
            toen == null ? '<span class="muted">Niet beschikbaar</span>' : fmt.getal(toen),
          ]))}
      </div>
    </section>`;
}

function labelVoor(type, labels) {
  if (labels && labels[type]) return labels[type];
  // Terugval: maak van een sleutel een leesbare tekst.
  return type.replace(/([A-Z])/g, ' $1').replace(/^./, (m) => m.toUpperCase());
}

/* ---------------------------------------------------------------
   Rapportage
   --------------------------------------------------------------- */

export function renderClientReport(user, clientId) {
  const bundel = getClientDashboardData(user, clientId);
  if (!bundel) return null;
  const { client, data } = bundel;

  const verhaal = data?.klantverhaal ?? null;

  const blok = (titel, items) => `
    <section class="card">
      <h2>${esc(titel)}</h2>
      ${!items?.length
        ? '<p class="empty">Nog niets vastgelegd voor deze periode.</p>'
        : `<ul class="verhaal-lijst">${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`}
    </section>`;

  return `
    ${klantKop(client, 'Rapportage over deze periode')}
    ${!verhaal
      ? '<section class="card"><p class="empty">Voor deze klant is nog geen periodeverhaal vastgelegd.</p></section>'
      : `
        ${blok('Wat ik deze periode deed', verhaal.gedaan)}
        ${blok('Wat het resultaat daarvan was', verhaal.goed)}
        ${blok('Waar ik nu op let', verhaal.aandacht)}
        ${blok('Wat ik hierna ga doen', verhaal.volgende)}
        ${blok('Wat ik van je nodig heb', verhaal.vanKlant)}`}
  `;
}

/* ---------------------------------------------------------------
   Gebruikersbeheer binnen de klantorganisatie
   --------------------------------------------------------------- */

export function renderClientUsers(user, clientId) {
  if (!can(user, Permission.MANAGE_CLIENT_USERS)) return null;

  const bundel = getClientDashboardData(user, clientId);
  if (!bundel) return null;

  const gebruikers = getOrganisatieGebruikers(user, clientId);

  return `
    ${klantKop(bundel.client, 'Gebruikers binnen je organisatie')}
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
