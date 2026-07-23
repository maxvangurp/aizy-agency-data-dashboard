/**
 * Klantomgeving.
 *
 * Dit is geen uitgeklede agencyomgeving. Een klant kijkt naar zijn eigen
 * resultaat en heeft niets aan interne prioriteiten, statusscores of signalen
 * die in bureautaal zijn opgeschreven. De inhoud komt uit dezelfde bron als het
 * agencydashboard, maar de selectie en de toon zijn anders.
 *
 * De volgorde van de klantpagina volgt de vragen die een klant stelt:
 *   1. wat is het resultaat van deze periode
 *   2. hoe staat dat tegenover het doel
 *   3. wat is er veranderd en waarom
 *   4. waar komt het resultaat vandaan
 *   5. wat is er gedaan en wat gebeurt er hierna
 *   6. wat kunnen we niet meten
 *
 * Wat hier nooit terechtkomt: andere klanten, agencybrede cijfers, interne
 * notities, prioriteitsscores en signalen.
 */

import { getOrganisatieGebruikers, BusinessModel } from '../data/repository.js';
import { renderLeadgenKlantview, drawLeadgenCharts } from './leadgen.js';
import { renderEcommerceClient, drawEcommerceCharts } from './ecommerce.js';
import { renderAwarenessClient, drawAwarenessCharts } from './awareness.js';
import { can, Permission } from '../auth/permissions.js';
import { primaireRol } from '../auth/domain.js';
import { fmt, esc, tabel, badge, ontbrekendeCel, metriekKolom } from './components.js';
import { renderContextheader, renderMedewerker } from './context-header.js';
import { renderInzichten } from './insight-cards.js';
import { toonBereik } from '../filters/period.js';
import { toegangsniveauTerm, accountstatusTerm, LABELS } from '../terminology.js';
import { KANAAL_STATUS_LABELS } from '../filters/channels.js';

const DASHBOARDS = [BusinessModel.LEADGEN, BusinessModel.ECOMMERCE, BusinessModel.AWARENESS];

/**
 * De paginakop komt uit de applicatieshell.
 *
 * Eerder tekende iedere klantpagina zijn eigen kop met kruimelpad en labels.
 * Dat leverde per pagina een net iets andere kop op en verschoof de inhoud bij
 * elke navigatie. De shell zet nu één kop neer; deze module levert alleen de
 * inhoud eronder.
 */
function klantKop() {
  return '';
}

/** Getoond wanneer er voor een dashboardtype nog geen weergave bestaat. */
function geenDashboardType(client) {
  return `<section class="card leeg-blok">
    <h2>Nog geen dashboard beschikbaar</h2>
    <p class="muted">
      Voor ${esc(client.name)} is nog geen dashboard ingericht dat past bij het
      ingestelde dashboardtype. Je vaste contactpersoon bij Aizy richt dit in.
    </p>
  </section>`;
}

function heeftDashboard(dashboard) {
  return DASHBOARDS.includes(dashboard.type);
}

/** De vaste contactpersoon bij Aizy, in klantvriendelijke bewoording. */
function renderContactpersoon(dashboard) {
  const persoon = dashboard.team?.primair;
  if (!persoon) return '';
  return `<section class="card contactblok">
    <h2>Je contactpersoon bij Aizy</h2>
    ${renderMedewerker(persoon)}
    <p class="muted klein">
      Vragen over deze rapportage kun je rechtstreeks aan ${esc(persoon.firstName)} stellen.
    </p>
  </section>`;
}

/* ---------------------------------------------------------------
   Overzicht en resultaten
   --------------------------------------------------------------- */

export function renderClientOverview({ dashboard, verhaal, filterbalk = '' }) {
  if (!dashboard) return null;
  const { client, periode, vergelijking, vergelijkingActief } = dashboard;

  const ondertitel = vergelijkingActief
    ? `Resultaten van ${toonBereik(periode.startDate, periode.endDate)}, vergeleken met ${toonBereik(vergelijking.startDate, vergelijking.endDate)}.`
    : `Resultaten van ${toonBereik(periode.startDate, periode.endDate)}, zonder vergelijking.`;

  const kop = klantKop(dashboard, { pagina: 'Overzicht', ondertitel });

  if (!heeftDashboard(dashboard)) return kop + filterbalk + geenDashboardType(client);

  const inhoud = dashboard.type === BusinessModel.LEADGEN
    ? renderLeadgenKlantview(dashboard, verhaal)
    : dashboard.type === BusinessModel.AWARENESS
      ? renderAwarenessClient(dashboard)
      : renderEcommerceClient(dashboard, verhaal);

  return kop + filterbalk + inhoud + renderContactpersoon(dashboard);
}

/**
 * Resultatenpagina met het volledige beeld.
 * Voor leadgeneratie wordt hier bewust de klantweergave hergebruikt in plaats
 * van het agencydashboard, omdat dat laatste interne kolommen bevat.
 */
export function renderClientPerformance({ dashboard, verhaal, filterbalk = '' }) {
  if (!dashboard) return null;
  const { client, periode } = dashboard;
  const kop = klantKop(dashboard, {
    pagina: 'Resultaten',
    ondertitel: `Het volledige resultaat van ${toonBereik(periode.startDate, periode.endDate)}.`,
  });

  if (!heeftDashboard(dashboard)) return kop + filterbalk + geenDashboardType(client);

  const inhoud = dashboard.type === BusinessModel.LEADGEN
    ? renderLeadgenKlantview(dashboard, verhaal)
    : dashboard.type === BusinessModel.AWARENESS
      ? renderAwarenessClient(dashboard)
      : renderEcommerceClient(dashboard, verhaal);

  return kop + filterbalk + inhoud;
}

/* ---------------------------------------------------------------
   Kanalen
   --------------------------------------------------------------- */

/**
 * Waar het resultaat vandaan komt.
 *
 * Een klant wil weten welk kanaal wat oplevert, en niet alleen welk kanaal het
 * grootst is. Volume, efficiëntie en kwaliteit staan daarom naast elkaar.
 */
export function renderClientChannels({ dashboard, filterbalk = '' }) {
  if (!dashboard) return null;
  const { client, periode, model } = dashboard;

  const kop = klantKop(dashboard, {
    pagina: 'Kanalen',
    ondertitel: `Waar het resultaat van ${toonBereik(periode.startDate, periode.endDate)} vandaan kwam.`,
  });

  if (!heeftDashboard(dashboard)) return kop + filterbalk + geenDashboardType(client);
  if (!dashboard.heeftData) {
    return `${kop}${filterbalk}<section class="card leeg-blok" id="geenDataBlok">
      <h2>Geen data voor deze selectie</h2>
      <p class="muted">Er zijn geen gegevens voor deze periode en kanaalselectie.</p>
    </section>`;
  }

  const kolommen = model === 'ecommerce'
    ? ['Kanaal', metriekKolom('spend'), metriekKolom('sessions'), metriekKolom('purchases'),
      metriekKolom('revenue'), metriekKolom('roas'), metriekKolom('cpa')]
    : model === 'leadgen'
      ? ['Kanaal', metriekKolom('spend'), metriekKolom('clicks'), metriekKolom('leads'),
        metriekKolom('cpl'), metriekKolom('qualifiedLeads'), metriekKolom('cpql')]
      : ['Kanaal', metriekKolom('spend'), metriekKolom('impressions'), metriekKolom('reach'),
        metriekKolom('frequentie'), metriekKolom('cpm')];

  const rij = (k) => (model === 'ecommerce'
    ? [esc(k.label), fmt.euro(k.spend), fmt.getal(k.sessions), fmt.getal(k.purchases),
      fmt.euro(k.revenue), k.roas == null ? ontbrekendeCel('onvoldoende_data') : fmt.ratio(k.roas),
      k.cpa == null ? ontbrekendeCel('onvoldoende_data') : fmt.euro2(k.cpa)]
    : model === 'leadgen'
      ? [esc(k.label), fmt.euro(k.spend), fmt.getal(k.clicks), fmt.getal(k.leads),
        k.cpl == null ? ontbrekendeCel('onvoldoende_data') : fmt.euro2(k.cpl),
        k.qualifiedLeads == null ? ontbrekendeCel('niet_gekoppeld') : fmt.getal(k.qualifiedLeads),
        k.cpql == null ? ontbrekendeCel('niet_gekoppeld') : fmt.euro2(k.cpql)]
      : [esc(k.label), fmt.euro(k.spend), fmt.getal(k.impressions),
        k.reach == null ? ontbrekendeCel('niet_gemeten') : fmt.getal(k.reach),
        k.frequentie == null ? ontbrekendeCel('onvoldoende_data') : fmt.ratio(k.frequentie),
        k.cpm == null ? ontbrekendeCel('onvoldoende_data') : fmt.euro2(k.cpm)]);

  return `
    ${kop}
    ${filterbalk}

    <section class="card">
      <h2>Resultaat per kanaal</h2>
      <p class="muted">
        Volume en efficiëntie staan naast elkaar. Het grootste kanaal is niet
        altijd het kanaal met de laagste kosten per resultaat.
      </p>
      <div class="table-scroll">
        ${tabel(kolommen, dashboard.kanaalRijen.map(rij),
          { leegTekst: 'Er zijn geen kanalen met gegevens binnen deze selectie.' })}
      </div>
    </section>

    ${renderInzichten(dashboard.inzichten, { titel: 'Wat de kanalen laten zien', toonAanvullend: false })}
    ${renderBronnen(dashboard)}`;
}

/** De meetbronnen met hun status, zodat duidelijk is wat wel en niet meetelt. */
function renderBronnen(dashboard) {
  const bronnen = dashboard.bronnen ?? [];
  if (!bronnen.length) return '';

  return `<section class="card">
    <h2>Waar deze cijfers vandaan komen</h2>
    <div class="table-scroll">
      ${tabel(
        ['Bron', 'Status', 'Wat dit betekent'],
        bronnen.map((b) => [
          esc(b.label),
          badge(KANAAL_STATUS_LABELS[b.status] ?? b.status, b.status === 'gekoppeld' ? 'ok' : 'muted'),
          esc(bronUitleg(b)),
        ])
      )}
    </div>
  </section>`;
}

function bronUitleg(bron) {
  if (bron.status === 'gekoppeld') return 'Deze bron levert gegevens voor de geselecteerde periode.';
  if (bron.status === 'toekomstig') return 'Deze koppeling is nog niet gebouwd. De getoonde cijfers zijn demodata.';
  if (bron.status === 'onvoldoende-data') return 'Deze bron levert onvolledige gegevens, waardoor cijfers kunnen afwijken.';
  return 'Deze bron is niet gekoppeld, dus de bijbehorende cijfers ontbreken.';
}

/* ---------------------------------------------------------------
   Conversies
   --------------------------------------------------------------- */

export function renderClientConversions({ dashboard, filterbalk = '' }) {
  if (!dashboard) return null;
  const { client, periode, conversies } = dashboard;

  const kop = klantKop(dashboard, {
    pagina: 'Conversies',
    ondertitel: `Welke acties bezoekers ondernamen in ${toonBereik(periode.startDate, periode.endDate)}.`,
  });

  if (!heeftDashboard(dashboard) || !conversies?.primair?.length) {
    return kop + filterbalk + `<section class="card leeg-blok">
      <h2>Voor dit dashboardtype worden geen losse conversies bijgehouden</h2>
      <p class="muted">
        Een awarenesscampagne wordt beoordeeld op bereik en aandacht, niet op
        losse conversieacties.
      </p>
    </section>`;
  }

  const rij = (c) => [
    esc(c.label),
    c.aantal == null ? ontbrekendeCel('niet_gemeten') : fmt.getal(c.aantal),
    c.vorigePeriode == null ? ontbrekendeCel('onvoldoende_data') : fmt.getal(c.vorigePeriode),
  ];

  const kop2 = client.businessModel === BusinessModel.ECOMMERCE
    ? { primair: 'Aankopen', secundair: 'Stappen daarvoor' }
    : { primair: 'Aanvragen', secundair: 'Overige contactmomenten' };

  const uitleg = client.businessModel === BusinessModel.ECOMMERCE
    ? 'Winkelwagen- en checkoutacties gaan aan dezelfde aankoop vooraf. Ze worden daarom niet bij de aankopen opgeteld.'
    : 'Signalen van interesse die nog geen aanvraag zijn. Ze tellen niet mee als lead.';

  return `
    ${kop}
    ${filterbalk}
    <section class="card">
      <h2>${esc(kop2.primair)}</h2>
      <p class="muted">Acties waaruit een gesprek of opdracht kan volgen.</p>
      <div class="table-scroll">
        ${tabel(['Conversie', 'Aantal', 'Vorige periode'], conversies.primair.map(rij))}
      </div>
    </section>
    <section class="card">
      <h2>${esc(kop2.secundair)}</h2>
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
    ? `${toonBereik(periode.startDate, periode.endDate)}, vergeleken met ${toonBereik(vergelijking.startDate, vergelijking.endDate)}.`
    : `${toonBereik(periode.startDate, periode.endDate)}, zonder vergelijking.`;

  return `
    ${klantKop(dashboard, { pagina: 'Rapportages', ondertitel })}
    ${filterbalk}
    ${verhaal ? renderInzichten(dashboard.inzichten, { titel: 'Wat er is veranderd' }) : ''}
    ${blok('Wat ik deze periode deed', verhaal?.gedaan)}
    ${blok('Wat ik hierna ga doen', verhaal?.volgende)}
    ${blok('Wat ik van je nodig heb', verhaal?.vanKlant)}
    ${renderMeetbeperkingen(verhaal)}
    ${renderContactpersoon(dashboard)}
  `;
}

function renderMeetbeperkingen(verhaal) {
  const beperkingen = verhaal?.meetbeperkingen ?? [];
  if (!beperkingen.length) {
    return `<section class="card">
      <h2>Wat we niet kunnen meten</h2>
      <p class="empty">Alle bronnen leverden binnen deze periode volledige gegevens.</p>
    </section>`;
  }

  return `<section class="card">
    <h2>Wat we niet kunnen meten</h2>
    <ul class="verhaal-lijst">
      ${beperkingen.map((b) => `<li>
        <strong>${esc(b.titel)}</strong>
        <span class="muted klein">${esc(b.samenvatting)}</span>
      </li>`).join('')}
    </ul>
  </section>`;
}

/* ---------------------------------------------------------------
   Gebruikersbeheer binnen de klantorganisatie
   --------------------------------------------------------------- */

export function renderClientUsers(user, { dashboard }) {
  if (!can(user, Permission.MANAGE_CLIENT_USERS)) return null;
  if (!dashboard) return null;

  const gebruikers = getOrganisatieGebruikers(user, dashboard.client.id);

  return `
    ${klantKop(dashboard, {
      pagina: 'Gebruikers',
      ondertitel: `De gebruikers van ${dashboard.client.name} met toegang tot dit dashboard.`,
    })}
    <section class="card">
      <div class="kaart-kop">
        <h2>Gebruikers</h2>
        ${can(user, Permission.INVITE_CLIENT_USER)
          ? '<button type="button" class="btn primary" id="nodigCollegaUit">Collega uitnodigen</button>'
          : ''}
      </div>
      <div class="table-scroll">
        ${tabel([LABELS.volledigeNaam, 'E-mailadres', LABELS.functietitel, LABELS.toegangsniveau, LABELS.accountstatus],
          gebruikers.map((g) => {
            const niveau = toegangsniveauTerm(primaireRol(g));
            const status = accountstatusTerm(g.status);
            return [
              esc(g.displayName),
              esc(g.email),
              esc(g.jobTitle ?? 'Niet vastgelegd'),
              `<span title="${esc(niveau.omschrijving)}">${badge(niveau.kort, 'muted')}</span>`,
              `<span title="${esc(status.omschrijving)}">${badge(status.kort, status.variant)}</span>`,
            ];
          }))}
      </div>
      <p class="muted note">Wijzigingen worden lokaal in deze demo bewaard.</p>
    </section>`;
}

/* ---------------------------------------------------------------
   Grafieken
   --------------------------------------------------------------- */

export function drawClientCharts(dashboard) {
  if (!dashboard || !heeftDashboard(dashboard)) return;

  if (dashboard.type === BusinessModel.LEADGEN) drawLeadgenCharts(dashboard, { klantview: true });
  else if (dashboard.type === BusinessModel.AWARENESS) drawAwarenessCharts(dashboard);
  else drawEcommerceCharts(dashboard);
}
