/**
 * Klantdetail binnen de agencyomgeving.
 *
 * Dit is de werkweergave voor een medewerker: het volledige dashboard van de
 * klant, met daarboven de interne context die de klant zelf niet ziet, zoals
 * de statusonderbouwing en de openstaande signalen.
 */

import { getClientDashboardData, getAccessibleSignals, klantStatus, BusinessModel, BUSINESS_MODEL_LABELS } from '../data/repository.js';
import { renderLeadgenClient, drawLeadgenCharts } from './leadgen.js';
import { renderEcommerceClient, drawEcommerceCharts } from './ecommerce.js';
import { esc, badge, trackingBadge } from './components.js';

export function renderAgencyClientDetail(user, clientId) {
  const bundel = getClientDashboardData(user, clientId);
  // null betekent: bestaat niet, of geen toegang. Beide leveren hetzelfde
  // antwoord op, zodat het bestaan van een klant niet wordt verklapt.
  if (!bundel) return null;

  const { client, type, data } = bundel;
  const status = klantStatus(client);
  const signalen = getAccessibleSignals(user).filter((s) => s.klantId === clientId);

  const statusVariant = {
    'op-koers': 'ok', aandacht: 'middel', tracking: 'hoog',
    'onvoldoende-data': 'muted', 'geen-doel': 'muted',
  };

  const intern = `
    <section class="card intern-blok">
      <div class="kaart-kop">
        <h2>Interne status</h2>
        <a class="link" href="#/agency/clients">Terug naar klanten</a>
      </div>
      <div class="intern-rij">
        ${badge(status.label, statusVariant[status.code] ?? 'muted')}
        ${trackingBadge(client.trackingStatus)}
        ${badge(`Datakwaliteit ${client.dataHealth} procent`, client.dataHealth >= 80 ? 'ok' : client.dataHealth >= 65 ? 'middel' : 'hoog')}
        ${badge(BUSINESS_MODEL_LABELS[client.businessModel] ?? client.businessModel, 'muted')}
      </div>
      <p class="muted">${esc(status.reden)}</p>
      <p class="muted klein">
        Accountmanager ${esc(client.accountmanager)} · Marketeer ${esc(client.marketeer)} ·
        Budget ${new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(client.maandbudget)}
      </p>

      ${signalen.length
        ? `<h3>Signalen</h3>
           <ul class="alert-list">${signalen.map((s) => `<li class="alert alert-${esc(s.ernst)}">
             <div class="alert-head">
               ${badge(s.ernst === 'hoog' ? 'Hoge ernst' : 'Middelmatige ernst', s.ernst === 'hoog' ? 'hoog' : 'middel')}
               <span class="muted">${esc(s.kanaal)}</span>
             </div>
             <p class="alert-problem">${esc(s.probleem)}</p>
             <p class="alert-meta"><span class="muted">Aanbevolen actie:</span> ${esc(s.aanbeveling)}</p>
           </li>`).join('')}</ul>`
        : '<p class="muted">Geen openstaande signalen voor deze klant.</p>'}
    </section>`;

  if (!data) {
    return intern + `<section class="card leeg-blok">
      <h2>Nog geen dashboard beschikbaar</h2>
      <p class="muted">
        Voor het bedrijfsmodel ${esc(BUSINESS_MODEL_LABELS[client.businessModel] ?? client.businessModel)}
        is nog geen dashboard gebouwd.
      </p>
    </section>`;
  }

  const dashboard = type === BusinessModel.LEADGEN
    ? renderLeadgenClient(client)
    : renderEcommerceClient(client);

  return intern + dashboard;
}

export function drawAgencyClientCharts(user, clientId) {
  const bundel = getClientDashboardData(user, clientId);
  if (!bundel?.data) return;

  if (bundel.type === BusinessModel.LEADGEN) {
    drawLeadgenCharts(bundel.client, { klantview: false });
  } else if (bundel.type === BusinessModel.ECOMMERCE) {
    drawEcommerceCharts(bundel.client);
  }
}
