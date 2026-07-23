/**
 * Nieuwe pagina's in de klantomgeving.
 *
 * De klantomgeving was één lange resultatenpagina met een paar zijpaden. Nu is
 * het een werkomgeving met vier vragen:
 *
 *   Overzicht      hoe staat het ervoor, tegenover welk doel, en wat veranderde
 *   Analyse        de verdieping die bij dit dashboardtype hoort
 *   Samenwerking   wat Aizy doet, wat er van de klant nodig is, en wanneer
 *   Rapportage     de vastgelegde uitleg, inclusief wat we niet konden meten
 *
 * TOON
 * De klantomgeving is rustiger dan de agencyomgeving. Geen prioriteitsscores,
 * geen interne signalen, geen jargon. Wat er niet gemeten is, wordt benoemd als
 * "niet gemeten" en niet als nul.
 *
 * RECHTEN
 * Een klantbeheerder mag reageren, bestanden toevoegen en acties goedkeuren.
 * Een alleen-lezen gebruiker ziet dezelfde informatie zonder enige knop die
 * iets verandert. Dat verschil wordt niet met CSS geregeld maar met rechten:
 * de knoppen worden niet gerenderd.
 */

import { fmt, esc, tabel, badge, ontbrekendeCel, metriekKolom, doelRij, kpiMetriek } from './components.js';
import { emptyState, koppelStatus } from '../ui/states.js';
import { renderInzichten } from './insight-cards.js';
import { renderMedewerker } from './context-header.js';
import { toonDatum, toonBereik, DEMO_TODAY } from '../filters/period.js';
import { kanaalLabel, KanaalStatus } from '../filters/channels.js';
import { KANAAL_TABS, kanaalTitel } from './channels.js';
import { ActieStatus } from '../model/actions.js';
import { ItemBron } from '../model/planning.js';
import { LABELS } from '../terminology.js';
import { BusinessModel } from '../sample-data/shared.js';

/* ---------------------------------------------------------------
   Overzicht
   --------------------------------------------------------------- */

export const OVERZICHT_TABS = [
  { key: 'samenvatting', label: 'Samenvatting' },
  { key: 'doelstellingen', label: 'Doelstellingen' },
  { key: 'ontwikkelingen', label: 'Belangrijkste ontwikkelingen' },
];

export function renderKlantOverzicht({ dashboard, verhaal, tab, basisInhoud }) {
  if (tab === 'doelstellingen') return renderDoelstellingen(dashboard);
  if (tab === 'ontwikkelingen') return renderOntwikkelingen(dashboard, verhaal);
  return basisInhoud;
}

function renderDoelstellingen(dashboard) {
  const doelen = dashboard.doelen ?? [];

  if (!doelen.length) {
    return emptyState({
      titel: 'Er zijn nog geen doelstellingen vastgelegd',
      uitleg: 'Je contactpersoon bij Aizy legt samen met jou vast waar we deze periode op sturen.',
      id: 'geenDoelen',
    });
  }

  return `<section class="card">
    <h2>Doelstellingen over ${esc(toonBereik(dashboard.periode.startDate, dashboard.periode.endDate))}</h2>
    <p class="muted">
      Maanddoelen worden naar rato van de gekozen periode omgerekend. Bij een
      week van zeven dagen geldt dus een zevende van het maanddoel, zodat de lat
      eerlijk blijft.
    </p>
    <ul class="goal-list">
      ${doelen.map((d) => doelRij(d, { label: doelLabel(d.kpi), format: doelFormat(d.kpi) })).join('')}
    </ul>
  </section>`;
}

const DOEL_LABELS = {
  omzet: 'Omzet',
  roas: 'Rendement op advertentie-uitgaven',
  aankopen: 'Aankopen',
  maandbudget: 'Advertentiebudget',
  leads: 'Aanvragen',
  gekwalificeerdeLeads: 'Gekwalificeerde aanvragen',
  afspraken: 'Afspraken',
  offertes: 'Offertes',
  klanten: 'Nieuwe klanten',
  cpl: 'Kosten per aanvraag',
  cpql: 'Kosten per gekwalificeerde aanvraag',
  websitegebruikers: 'Websitegebruikers',
  telefoongesprekken: 'Telefoongesprekken',
  emailacties: 'E-mailcontacten',
};

function doelLabel(kpi) {
  return DOEL_LABELS[kpi] ?? kpi;
}

function doelFormat(kpi) {
  if (['omzet', 'maandbudget'].includes(kpi)) return fmt.euro;
  if (['cpl', 'cpql'].includes(kpi)) return fmt.euro2;
  if (kpi === 'roas') return fmt.ratio;
  return fmt.getal;
}

function renderOntwikkelingen(dashboard, verhaal) {
  return `
    ${renderInzichten(dashboard.inzichten, { titel: 'Wat er is veranderd' })}
    <section class="card">
      <h2>Wat Aizy deze periode deed</h2>
      ${verhaal?.gedaan?.length
        ? `<ul class="verhaal-lijst">${verhaal.gedaan.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`
        : '<p class="empty">Niets te melden voor deze periode.</p>'}
    </section>
    <section class="card">
      <h2>Wat Aizy hierna gaat doen</h2>
      ${verhaal?.volgende?.length
        ? `<ul class="verhaal-lijst">${verhaal.volgende.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`
        : '<p class="empty">De vervolgstappen worden in het eerstvolgende overleg vastgelegd.</p>'}
    </section>`;
}

/* ---------------------------------------------------------------
   Analyse
   --------------------------------------------------------------- */

/**
 * De analysepagina volgt het dashboardtype.
 *
 * Een leadgeneratieklant heeft niets aan een winkelwagenfunnel en een webshop
 * niets aan leadkwaliteit. De tabs komen daarom uit ANALYSE_TABS in de
 * navigatiestructuur en de inhoud hieronder volgt dezelfde sleutels.
 */
export function renderKlantAnalyse({ dashboard, tab }) {
  if (!dashboard.heeftData) {
    return emptyState({
      titel: 'Geen gegevens voor deze selectie',
      uitleg: 'Er is geen data binnen deze periode en kanaalselectie. Verruim de periode of voeg kanalen toe.',
      id: 'geenDataBlok',
    });
  }

  const bouwers = {
    // Leadgeneratie
    leads: () => leadsBlok(dashboard),
    funnel: () => funnelBlok(dashboard),
    kosten: () => kostenBlok(dashboard),
    kwaliteit: () => kwaliteitBlok(dashboard),
    zoektermen: () => zoektermenBlok(dashboard),
    // E-commerce
    omzet: () => omzetBlok(dashboard),
    transacties: () => transactiesBlok(dashboard),
    rendement: () => rendementBlok(dashboard),
    producten: () => productenBlok(dashboard),
    winkelwagen: () => funnelBlok(dashboard),
    // Awareness
    bereik: () => bereikBlok(dashboard),
    frequentie: () => frequentieBlok(dashboard),
    video: () => videoBlok(dashboard),
    betrokkenheid: () => betrokkenheidBlok(dashboard),
    // Gedeeld
    campagnes: () => campagnesBlok(dashboard),
  };

  return bouwers[tab] ? bouwers[tab]() : bouwers.campagnes();
}

function kpiRij(dashboard, keys) {
  return `<div class="kpi-row">
    ${keys.map((k) => kpiMetriek(dashboard.totalen, k, dashboard.deltas, {
      vergelijkingLabel: dashboard.vergelijkingActief ? dashboard.vergelijking.label.toLowerCase() : 'de vorige periode',
      drill: true,
    })).join('')}
  </div>`;
}

function leadsBlok(d) {
  return `
    ${kpiRij(d, ['leads', 'qualifiedLeads', 'cpl', 'sessions'])}
    <section class="card">
      <h2>Aanvragen per kanaal</h2>
      <div class="table-scroll">
        ${tabel(
          ['Kanaal', metriekKolom('spend'), metriekKolom('clicks'), metriekKolom('leads'), metriekKolom('cpl')],
          d.kanaalRijen.map((k) => [
            esc(k.label), fmt.euro(k.spend), fmt.getal(k.clicks), fmt.getal(k.leads),
            k.cpl == null ? ontbrekendeCel('onvoldoende_data') : fmt.euro2(k.cpl),
          ])
        )}
      </div>
    </section>`;
}

function funnelBlok(d) {
  if (!d.funnel) {
    return emptyState({
      titel: 'Voor dit dashboardtype bestaat geen funnel',
      uitleg: 'Een awarenesscampagne wordt op bereik en aandacht beoordeeld en heeft geen aankoop- of aanvraagfunnel.',
    });
  }

  return `<section class="card">
    <h2>Van bezoek tot resultaat</h2>
    <p class="muted">Elke stap toont hoeveel er van de vorige stap overblijft. Ontbrekende metingen worden als zodanig benoemd en niet als nul geteld.</p>
    <div class="table-scroll">
      ${tabel(
        ['Stap', 'Aantal', 'Van de vorige stap', 'Aandeel van de instroom', 'Bron'],
        (d.funnel.rijen ?? []).map((s) => [
          esc(s.label),
          s.volume == null ? ontbrekendeCel('niet_gemeten') : fmt.getal(s.volume),
          s.doorstroom == null ? ontbrekendeCel('onvoldoende_data') : fmt.procent(s.doorstroom),
          s.vanTotaal == null ? ontbrekendeCel('onvoldoende_data') : fmt.procent(s.vanTotaal),
          esc(s.bron ?? ''),
        ])
      )}
    </div>
    ${d.funnel.knelpunt ? `<p class="muted note">Grootste uitval bij: ${esc(d.funnel.knelpunt.label)}.</p>` : ''}
  </section>`;
}

function kostenBlok(d) {
  return `
    ${kpiRij(d, ['cpl', 'cpql', 'cpc', 'spend'])}
    <section class="card">
      <h2>Wat een aanvraag kost per kanaal</h2>
      <p class="muted">Het grootste kanaal is niet altijd het kanaal met de laagste kosten per aanvraag.</p>
      <div class="table-scroll">
        ${tabel(
          ['Kanaal', metriekKolom('spend'), metriekKolom('leads'), metriekKolom('cpl'), metriekKolom('cpql')],
          d.kanaalRijen.map((k) => [
            esc(k.label), fmt.euro(k.spend), fmt.getal(k.leads),
            k.cpl == null ? ontbrekendeCel('onvoldoende_data') : fmt.euro2(k.cpl),
            k.cpql == null ? ontbrekendeCel('niet_gekoppeld') : fmt.euro2(k.cpql),
          ])
        )}
      </div>
    </section>`;
}

function kwaliteitBlok(d) {
  if (d.totalen.qualifiedLeads == null) {
    return `<section class="card">
      ${koppelStatus({
        bron: 'CRM',
        status: KanaalStatus.NIET_GEKOPPELD,
        uitleg: 'Zonder CRM-koppeling stopt de meting bij de aanvraag. We kunnen daardoor niet zien welke aanvragen tot een gesprek of opdracht leiden. Dat is geen nul, maar een ontbrekende meting.',
      })}
    </section>`;
  }

  return `
    ${kpiRij(d, ['qualifiedLeads', 'appointments', 'quotes', 'customers'])}
    <section class="card">
      <h2>Van aanvraag naar klant</h2>
      <p class="muted">Deze cijfers komen uit het CRM en niet uit de advertentieplatformen.</p>
      <div class="table-scroll">
        ${tabel(
          ['Stap', 'Aantal'],
          [
            ['Aanvragen', fmt.getal(d.totalen.leads)],
            ['Gekwalificeerd', fmt.getal(d.totalen.qualifiedLeads)],
            ['Afspraken', d.totalen.appointments == null ? ontbrekendeCel('niet_gekoppeld') : fmt.getal(d.totalen.appointments)],
            ['Offertes', d.totalen.quotes == null ? ontbrekendeCel('niet_gekoppeld') : fmt.getal(d.totalen.quotes)],
            ['Nieuwe klanten', d.totalen.customers == null ? ontbrekendeCel('niet_gekoppeld') : fmt.getal(d.totalen.customers)],
          ]
        )}
      </div>
    </section>`;
}

function zoektermenBlok(d) {
  const zoekwoorden = d.profiel?.googleAds?.zoekwoorden ?? [];
  if (!zoekwoorden.length) {
    return `<section class="card">
      ${koppelStatus({
        bron: 'Google Ads zoektermen',
        status: KanaalStatus.NIET_GEKOPPELD,
        uitleg: 'Zoektermen komen uit Google Ads. Voeg Google Ads toe aan de kanaalselectie om ze te zien.',
      })}
    </section>`;
  }

  return `<section class="card">
    <h2>Waar mensen op zochten</h2>
    <div class="table-scroll">
      ${tabel(
        ['Zoekwoord', 'Matchtype', 'Vertoningen', 'Klikken', 'Kosten', 'Aanvragen'],
        zoekwoorden.map((z) => [
          esc(z.zoekwoord), esc(z.matchtype ?? ''), fmt.getal(z.vertoningen),
          fmt.getal(z.klikken), fmt.euro(z.kosten),
          z.leads == null ? ontbrekendeCel('niet_gemeten') : fmt.getal(z.leads),
        ])
      )}
    </div>
  </section>`;
}

function omzetBlok(d) {
  return `
    ${kpiRij(d, ['revenue', 'roas', 'aov', 'spend'])}
    <section class="card">
      <h2>Omzet per kanaal</h2>
      <div class="table-scroll">
        ${tabel(
          ['Kanaal', metriekKolom('spend'), metriekKolom('revenue'), metriekKolom('roas')],
          d.kanaalRijen.map((k) => [
            esc(k.label), fmt.euro(k.spend), fmt.euro(k.revenue),
            k.roas == null ? ontbrekendeCel('onvoldoende_data') : fmt.ratio(k.roas),
          ])
        )}
      </div>
    </section>`;
}

function transactiesBlok(d) {
  return `
    ${kpiRij(d, ['purchases', 'conversieratio', 'cpa', 'sessions'])}
    <section class="card">
      <h2>Transacties per kanaal</h2>
      <div class="table-scroll">
        ${tabel(
          ['Kanaal', metriekKolom('sessions'), metriekKolom('purchases'), metriekKolom('cpa')],
          d.kanaalRijen.map((k) => [
            esc(k.label), fmt.getal(k.sessions), fmt.getal(k.purchases),
            k.cpa == null ? ontbrekendeCel('onvoldoende_data') : fmt.euro2(k.cpa),
          ])
        )}
      </div>
    </section>`;
}

function rendementBlok(d) {
  return `
    ${kpiRij(d, ['roas', 'cpa', 'aov', 'conversieratio'])}
    <section class="card">
      <h2>Wat rendement betekent</h2>
      <p class="muted">
        Rendement is de omzet gedeeld door de advertentiekosten. Een rendement
        van 5 betekent vijf euro omzet per euro advertentiekosten. Het zegt niets
        over marge: dat hangt af van inkoop en verzending.
      </p>
    </section>`;
}

function productenBlok(d) {
  const merchant = d.profiel?.merchantCenter;
  if (!merchant) {
    return `<section class="card">
      ${koppelStatus({
        bron: 'Google Merchant Center',
        status: KanaalStatus.NIET_GEKOPPELD,
        uitleg: 'Productgegevens komen uit Merchant Center. Zonder die koppeling is niet te zien welke producten het goed doen.',
      })}
    </section>`;
  }

  return `<section class="card">
    <h2>Productfeed</h2>
    <div class="table-scroll">
      ${tabel(
        ['Onderdeel', 'Waarde'],
        Object.entries(merchant).map(([k, v]) => [esc(leesbaar(k)), esc(String(v))])
      )}
    </div>
  </section>`;
}

function bereikBlok(d) {
  return `
    ${kpiRij(d, ['impressions', 'reach', 'cpm', 'spend'])}
    <section class="card">
      <h2>Bereik per kanaal</h2>
      <div class="table-scroll">
        ${tabel(
          ['Kanaal', metriekKolom('impressions'), metriekKolom('reach'), metriekKolom('cpm')],
          d.kanaalRijen.map((k) => [
            esc(k.label), fmt.getal(k.impressions),
            k.reach == null ? ontbrekendeCel('niet_gemeten') : fmt.getal(k.reach),
            k.cpm == null ? ontbrekendeCel('onvoldoende_data') : fmt.euro2(k.cpm),
          ])
        )}
      </div>
    </section>`;
}

function frequentieBlok(d) {
  return `
    ${kpiRij(d, ['frequentie', 'reach', 'impressions'])}
    <section class="card">
      <h2>Hoe vaak iemand de advertentie zag</h2>
      <p class="muted">
        Frequentie is het aantal vertoningen gedeeld door het bereik. Loopt die
        op zonder dat het bereik groeit, dan zien dezelfde mensen de advertentie
        vaker en werkt hij minder goed.
      </p>
    </section>`;
}

function videoBlok(d) {
  if (d.totalen.videoStarts == null) {
    return emptyState({
      titel: 'Er zijn geen videoprestaties gemeten',
      uitleg: 'Binnen deze periode en kanaalselectie zijn geen videovertoningen geregistreerd.',
    });
  }
  return kpiRij(d, ['videoStarts', 'videoCompletions', 'videoVoltooiing', 'gemKijktijd']);
}

function betrokkenheidBlok(d) {
  return kpiRij(d, ['engagements', 'engagementRatio', 'clicks', 'brandedSearchClicks']);
}

function campagnesBlok(d) {
  const campagnes = d.profiel?.googleAds?.campagnes ?? [];
  if (!campagnes.length) {
    return `<section class="card">
      ${koppelStatus({
        bron: 'Campagnegegevens',
        status: KanaalStatus.NIET_GEKOPPELD,
        uitleg: 'Campagnegegevens komen in deze demo uit Google Ads. Voeg Google Ads toe aan de kanaalselectie om ze te zien.',
      })}
    </section>`;
  }

  const isEcommerce = d.type === BusinessModel.ECOMMERCE;

  return `<section class="card">
    <h2>Campagnes</h2>
    <div class="table-scroll">
      ${tabel(
        ['Campagne', 'Type', 'Kosten', 'Klikken', 'Vertoningen', isEcommerce ? 'Aankopen' : 'Aanvragen'],
        campagnes.map((c) => [
          esc(c.naam), esc(c.type ?? ''), fmt.euro(c.kosten), fmt.getal(c.klikken), fmt.getal(c.vertoningen),
          (isEcommerce ? c.conversies : c.leads) == null
            ? ontbrekendeCel('niet_gemeten')
            : fmt.getal(isEcommerce ? c.conversies : c.leads),
        ])
      )}
    </div>
  </section>`;
}

function leesbaar(sleutel) {
  return sleutel.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
}

/* ---------------------------------------------------------------
   Kanaalpagina binnen de klantomgeving
   --------------------------------------------------------------- */

export function renderKlantKanaal({ dashboard, kanaal, tab }) {
  const rij = dashboard.kanaalRijen.find((k) => k.channel === kanaal);
  const tabs = KANAAL_TABS[kanaal] ?? KANAAL_TABS.alle;
  const actief = tabs.find((t) => t.key === tab) ?? tabs[0];

  if (!rij) {
    return `<section class="card">
      ${koppelStatus({
        bron: kanaalTitel(kanaal),
        status: KanaalStatus.NIET_GEKOPPELD,
        uitleg: `Er zijn geen gegevens van ${kanaalTitel(kanaal)} binnen deze periode. Dat betekent niet dat het resultaat nul is; er is niets gemeten.`,
      })}
    </section>`;
  }

  if (actief.key !== 'overzicht' && actief.bron === 'geen') {
    return `<section class="card">
      ${koppelStatus({
        bron: `${kanaalTitel(kanaal)} — ${actief.label}`,
        status: KanaalStatus.TOEKOMSTIG,
        uitleg: `Dit onderdeel komt rechtstreeks uit ${kanaalTitel(kanaal)}. Zolang die koppeling er niet is, tonen we hier geen tabel, want een lege tabel leest als "geen resultaat".`,
      })}
    </section>`;
  }

  if (actief.key === 'campagnes' || actief.key === 'zoekwoorden' || actief.key === 'advertentiegroepen') {
    return campagnesBlok(dashboard);
  }

  const isEcommerce = dashboard.type === BusinessModel.ECOMMERCE;
  const isLeadgen = dashboard.type === BusinessModel.LEADGEN;

  return `
    <div class="kpi-row">
      <article class="card kpi" data-label="Uitgaven"><span class="kpi-label">Uitgaven</span>
        <span class="kpi-value">${esc(fmt.euro(rij.spend))}</span>
        <span class="kpi-sub">via ${esc(kanaalTitel(kanaal))}</span></article>
      <article class="card kpi" data-label="Vertoningen"><span class="kpi-label">Vertoningen</span>
        <span class="kpi-value">${esc(fmt.getal(rij.impressions))}</span>
        <span class="kpi-sub">binnen deze periode</span></article>
      <article class="card kpi" data-label="Klikken"><span class="kpi-label">Klikken</span>
        <span class="kpi-value">${esc(fmt.getal(rij.clicks))}</span>
        <span class="kpi-sub">${rij.ctr == null ? 'doorklikratio niet beschikbaar' : `${fmt.procent(rij.ctr)} doorklikratio`}</span></article>
      <article class="card kpi" data-label="Resultaat"><span class="kpi-label">Resultaat</span>
        <span class="kpi-value">${isEcommerce ? esc(fmt.euro(rij.revenue)) : isLeadgen ? esc(fmt.getal(rij.leads)) : esc(fmt.getal(rij.impressions))}</span>
        <span class="kpi-sub">${isEcommerce ? 'omzet' : isLeadgen ? 'aanvragen' : 'vertoningen'}</span></article>
    </div>

    <section class="card">
      <h2>Wat dit kanaal bijdroeg</h2>
      <p class="muted">
        De cijfers hierboven gaan uitsluitend over ${esc(kanaalTitel(kanaal))}
        binnen ${esc(toonBereik(dashboard.periode.startDate, dashboard.periode.endDate))}.
        Op de pagina Alle kanalen staat hoe dit zich tot de andere kanalen verhoudt.
      </p>
      <a class="link" href="#/client/channels">Alle kanalen vergelijken</a>
    </section>`;
}

/* ---------------------------------------------------------------
   Samenwerking
   --------------------------------------------------------------- */

export const SAMENWERKING_TABS = [
  { key: 'acties', label: 'Acties' },
  { key: 'planning', label: 'Planning' },
  { key: 'notities', label: 'Notities' },
  { key: 'bestanden', label: 'Bestanden' },
];

export function renderSamenwerking({ tab, acties, planning, magDeelnemen, contactpersoon }) {
  if (tab === 'planning') return renderKlantPlanning(planning);
  if (tab === 'notities') return renderNotities(acties, magDeelnemen);
  if (tab === 'bestanden') return renderBestanden(magDeelnemen);
  return renderKlantActies(acties, magDeelnemen, contactpersoon);
}

/**
 * De acties die met deze klant gedeeld zijn.
 *
 * Alleen acties die bewust gedeeld zijn, staan hier. Interne optimalisaties
 * blijven intern; dat is een eigenschap van de actie en geen filter dat per
 * ongeluk kan wegvallen.
 */
function renderKlantActies(acties, magDeelnemen, contactpersoon) {
  if (!acties.length) {
    return emptyState({
      titel: 'Er staan op dit moment geen gedeelde acties open',
      uitleg: 'Zodra Aizy iets met je afstemt of iets van je nodig heeft, verschijnt het hier.',
      id: 'klantActiesLeeg',
    });
  }

  const wachtOpJou = acties.filter((a) => a.status === ActieStatus.WACHT_OP_KLANT);

  return `
    ${wachtOpJou.length ? `<section class="card" id="wachtOpKlant">
      <h2>Wat wij van je nodig hebben</h2>
      <ul class="klantactie-lijst">
        ${wachtOpJou.map((a) => `<li>
          <div class="klantactie-kop">
            <strong>${esc(a.titel)}</strong>
            ${a.deadline ? badge(`Graag voor ${toonDatum(a.deadline)}`, 'middel') : ''}
          </div>
          <p class="muted">${esc(a.omschrijving)}</p>
          ${magDeelnemen && a.goedkeuringGevraagd ? `<div class="klantactie-knoppen">
            <button type="button" class="btn klein primary" data-klant-goedkeuren="${esc(a.id)}">Akkoord geven</button>
            <button type="button" class="btn klein" data-klant-reageren="${esc(a.id)}">Reageren</button>
          </div>` : ''}
          ${a.goedgekeurdOp ? `<p class="klein trend-positief">Akkoord gegeven op ${esc(new Date(a.goedgekeurdOp).toLocaleDateString('nl-NL'))}.</p>` : ''}
        </li>`).join('')}
      </ul>
    </section>` : ''}

    <section class="card">
      <h2>Waar Aizy aan werkt</h2>
      <div class="table-scroll">
        ${tabel(
          ['Wat', 'Status', 'Wanneer', 'Contactpersoon'],
          acties.map((a) => [
            `<strong>${esc(a.titel)}</strong><br><span class="muted klein">${esc(a.omschrijving)}</span>`,
            badge(a.statusTerm.kort, a.statusTerm.variant),
            a.deadline ? esc(toonDatum(a.deadline)) : '<span class="muted klein">Nog geen datum</span>',
            esc(a.verantwoordelijkeNaam),
          ])
        )}
      </div>
      ${contactpersoon ? `<div class="contactblok">${renderMedewerker(contactpersoon)}</div>` : ''}
    </section>`;
}

function renderKlantPlanning(planning) {
  const komend = planning.filter((i) => i.datum >= DEMO_TODAY).sort((a, b) => a.datum.localeCompare(b.datum));

  if (!komend.length) {
    return emptyState({
      titel: 'Er staan geen afspraken gepland',
      uitleg: 'Je contactpersoon bij Aizy neemt contact op zodra er iets te bespreken is.',
      id: 'klantPlanningLeeg',
    });
  }

  return `<section class="card">
    <h2>Komende afspraken</h2>
    <p class="muted">Alleen afspraken waar jij bij bent. Interne werkblokken van Aizy staan hier niet.</p>
    <div class="table-scroll">
      ${tabel(
        ['Afspraak', 'Datum', 'Tijd', 'Met'],
        komend.map((i) => [
          esc(i.titel),
          esc(toonDatum(i.datum)),
          i.starttijd ? esc(i.starttijd) : '<span class="muted klein">Nog niet vastgelegd</span>',
          esc(i.medewerkerNaam),
        ])
      )}
    </div>
  </section>`;
}

function renderNotities(acties, magDeelnemen) {
  const metOpmerkingen = acties.filter((a) => (a.opmerkingen ?? []).length);

  return `
    <section class="card">
      <h2>Notities en reacties</h2>
      ${metOpmerkingen.length
        ? `<ul class="notitielijst">
            ${metOpmerkingen.map((a) => `<li>
              <strong>${esc(a.titel)}</strong>
              <ul class="tijdlijn">
                ${a.opmerkingen.map((o) => `<li>
                  <span class="tijdlijn-moment">${esc(new Date(o.op).toLocaleString('nl-NL'))}</span>
                  <span>${esc(o.tekst)}</span>
                </li>`).join('')}
              </ul>
            </li>`).join('')}
          </ul>`
        : emptyState({
          titel: 'Er zijn nog geen notities gedeeld',
          uitleg: 'Reacties op gedeelde acties verschijnen hier, zodat afspraken terug te lezen zijn.',
        })}
      ${magDeelnemen ? '<p class="muted klein">Reageren doe je bij de betreffende actie op de tab Acties.</p>' : ''}
    </section>`;
}

function renderBestanden(magDeelnemen) {
  return `<section class="card">
    <h2>Bestanden</h2>
    ${koppelStatus({
      bron: 'Bestandsopslag',
      status: KanaalStatus.TOEKOMSTIG,
      uitleg: 'Bestanden worden opgeslagen zodra de Azure-backend beschikbaar is. Er staat hier bewust geen uploadknop die alleen in deze browser iets zou doen: een bestand dat na een herlading verdwenen is, is erger dan geen bestand.',
    })}
    ${magDeelnemen ? `<p class="muted">
      Aanleveren kan tot die tijd via je contactpersoon bij Aizy. Vraag hem om de
      bestanden aan de bijbehorende actie te koppelen, dan blijft de afspraak
      terug te vinden.
    </p>` : ''}
  </section>`;
}

/* ---------------------------------------------------------------
   Rapportage
   --------------------------------------------------------------- */

export const RAPPORTAGE_TABS = [
  { key: 'inzichten', label: 'Inzichten' },
  { key: 'rapportages', label: 'Rapportages' },
  { key: 'datakwaliteit', label: 'Datakwaliteit' },
];

export function renderKlantRapportage({ dashboard, verhaal, tab, basisInhoud, magDatakwaliteit }) {
  if (tab === 'datakwaliteit') {
    if (!magDatakwaliteit) {
      return emptyState({
        titel: 'Dit onderdeel is niet beschikbaar voor je account',
        uitleg: 'De technische controle op de meting is bedoeld voor beheerders van je organisatie.',
      });
    }
    return renderKlantDatakwaliteit(dashboard);
  }
  if (tab === 'inzichten') {
    return renderInzichten(dashboard.inzichten, { titel: 'Wat er is veranderd' });
  }
  return basisInhoud;
}

function renderKlantDatakwaliteit(dashboard) {
  return `
    <section class="card">
      <h2>Wat we wel en niet kunnen meten</h2>
      <p class="muted">
        Een lage datakwaliteit maakt het resultaat niet slechter, maar de
        conclusie onzekerder. Daarom staat hier per bron wat er binnenkomt.
      </p>
      <div class="table-scroll">
        ${tabel(
          ['Bron', 'Status', 'Wat dit betekent'],
          (dashboard.bronnen ?? []).map((b) => [
            esc(b.label),
            badge(b.status === KanaalStatus.GEKOPPELD ? 'Gekoppeld'
              : b.status === KanaalStatus.TOEKOMSTIG ? 'Toekomstige koppeling'
                : b.status === KanaalStatus.ONVOLDOENDE_DATA ? 'Onvoldoende data' : 'Niet gekoppeld',
            b.status === KanaalStatus.GEKOPPELD ? 'ok' : 'muted'),
            b.status === KanaalStatus.GEKOPPELD
              ? 'Deze bron levert gegevens voor de geselecteerde periode.'
              : b.status === KanaalStatus.TOEKOMSTIG
                ? 'Deze koppeling is nog niet gebouwd. De getoonde cijfers zijn demodata.'
                : b.status === KanaalStatus.ONVOLDOENDE_DATA
                  ? 'Deze bron levert onvolledige gegevens, waardoor cijfers kunnen afwijken.'
                  : 'Deze bron is niet gekoppeld, dus de bijbehorende cijfers ontbreken.',
          ])
        )}
      </div>
    </section>

    <section class="card">
      <h2>Dekking in deze periode</h2>
      <p>
        Er zijn gegevens voor ${dashboard.dekking.dagenMetData} van de
        ${dashboard.dekking.totaalDagen} dagen in deze periode.
      </p>
      ${dashboard.meldingen?.length
        ? `<ul class="verhaal-lijst">${dashboard.meldingen.map((m) => `<li>${esc(typeof m === 'string' ? m : m.tekst ?? '')}</li>`).join('')}</ul>`
        : '<p class="muted">Er zijn geen bijzonderheden in de meting van deze periode.</p>'}
    </section>`;
}

export { ItemBron, LABELS, kanaalLabel };
