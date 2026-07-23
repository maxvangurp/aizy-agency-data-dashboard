/**
 * Klantdetail binnen de agencyomgeving.
 *
 * Dit is de werkweergave voor een medewerker: het volledige dashboard van de
 * klant, met daarboven de interne context die de klant zelf niet ziet. Die
 * scheiding is expliciet: de contextheader benoemt dat dit de agencyweergave is
 * en het interne blok staat visueel apart.
 *
 * De filterselectie blijft behouden wanneer een medewerker vanuit het
 * agencyoverzicht een klant opent. Kanalen die deze klant niet heeft, worden
 * automatisch uit de selectie gehaald en dat wordt zichtbaar gemeld.
 */

import { BusinessModel, BUSINESS_MODEL_LABELS } from '../data/repository.js';
import { renderLeadgenClient, drawLeadgenCharts } from './leadgen.js';
import { renderEcommerceClient, drawEcommerceCharts } from './ecommerce.js';
import { renderAwarenessClient, drawAwarenessCharts } from './awareness.js';
import { esc, badge, meetstatusBadge, fmt } from './components.js';
import { renderMedewerker } from './context-header.js';
import { renderPrioriteit } from './insight-cards.js';
import { kanaalLabel } from '../filters/channels.js';
import { LABELS, dashboardtypeTerm, verantwoordelijkheidTerm } from '../terminology.js';

export function renderAgencyClientDetail({ dashboard, verhaal, signalen = [], filterbalk = '', kanaalWaarschuwing = null }) {
  // null betekent: bestaat niet, of geen toegang. Beide leveren hetzelfde
  // antwoord op, zodat het bestaan van een klant niet wordt verklapt.
  if (!dashboard) return null;

  const { client, status, periode, prioriteit, team } = dashboard;

  // De paginakop, het kruimelpad en de statuslabels komen uit de applicatieshell.
  // Deze view levert uitsluitend de inhoud, zodat er nooit twee koppen boven
  // elkaar staan en de kop op iedere pagina hetzelfde gedrag heeft.
  const intern = `
    <section class="card intern-blok" aria-labelledby="internTitel">
      <div class="kaart-kop">
        <h2 id="internTitel">Interne status</h2>
        <span class="muted klein">Niet zichtbaar voor de klant</span>
      </div>

      <div class="intern-grid">
        <div>
          ${renderPrioriteit(prioriteit)}
        </div>
        <div>
          <p class="eyebrow">${esc(LABELS.verantwoordelijke)}</p>
          ${renderMedewerker(team.primair, { rol: verantwoordelijkheidTerm('primair').volledig })}
          ${team.ondersteunend.length ? `
            <p class="eyebrow" style="margin-top:12px">${esc(LABELS.ondersteunend)}</p>
            ${team.ondersteunend.map((m) => renderMedewerker(m, { rol: verantwoordelijkheidTerm('ondersteunend').volledig })).join('')}
          ` : ''}
        </div>
        <div>
          <p class="eyebrow">${esc(LABELS.datakwaliteit)}</p>
          <div class="intern-rij">
            ${meetstatusBadge(client.trackingStatus)}
            ${badge(`Datakwaliteit ${client.dataHealth} procent`, client.dataHealth >= 80 ? 'ok' : client.dataHealth >= 65 ? 'middel' : 'hoog')}
            ${badge(dashboardtypeTerm(dashboard.model).kort, 'muted')}
          </div>
          <p class="muted klein">Maandbudget ${fmt.euro(client.maandbudget)}</p>
        </div>
      </div>

      ${signalen.length
        ? `<h3>Signalen binnen deze selectie</h3>
           <ul class="alert-list">${signalen.map((s) => `<li class="alert alert-${esc(s.ernst)}">
             <div class="alert-head">
               ${badge(s.ernst === 'hoog' ? 'Hoge urgentie' : 'Gemiddelde urgentie', s.ernst === 'hoog' ? 'hoog' : 'middel')}
               <span class="muted">${esc(s.kanaalLabel ?? kanaalLabel(s.kanaal))}</span>
             </div>
             <p class="alert-problem">${esc(s.probleem)}</p>
             <p class="alert-meta"><span class="eyebrow">${esc(LABELS.actie)}</span> ${esc(s.aanbeveling)}</p>
           </li>`).join('')}</ul>`
        : '<p class="muted">Geen signalen voor deze klant binnen de geselecteerde periode en kanalen.</p>'}
    </section>`;

  const waarschuwing = kanaalWaarschuwing
    ? `<div class="banner banner-warning" role="status" id="kanaalWaarschuwing">
        <strong>Kanaalselectie aangepast</strong>
        <span>${esc(kanaalWaarschuwing)}</span>
      </div>`
    : '';

  const inhoud = dashboard.type === BusinessModel.LEADGEN
    ? renderLeadgenClient(dashboard, verhaal)
    : dashboard.type === BusinessModel.ECOMMERCE
      ? renderEcommerceClient(dashboard, verhaal)
      : dashboard.type === BusinessModel.AWARENESS
        ? renderAwarenessClient(dashboard)
        : `<section class="card leeg-blok">
            <h2>Nog geen dashboard beschikbaar</h2>
            <p class="muted">
              Voor het dashboardtype ${esc(BUSINESS_MODEL_LABELS[client.businessModel] ?? client.businessModel)}
              is nog geen weergave gebouwd.
            </p>
          </section>`;

  return intern + filterbalk + waarschuwing + inhoud;
}

export function drawAgencyClientCharts(dashboard) {
  if (!dashboard) return;
  if (dashboard.type === BusinessModel.LEADGEN) drawLeadgenCharts(dashboard, { klantview: false });
  else if (dashboard.type === BusinessModel.ECOMMERCE) drawEcommerceCharts(dashboard);
  else if (dashboard.type === BusinessModel.AWARENESS) drawAwarenessCharts(dashboard);
}
