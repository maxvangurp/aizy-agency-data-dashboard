/**
 * Leadgeneratiedashboard.
 *
 * Waar het e-commercedashboard draait om omzet en ROAS, draait dit om
 * leadvolume tegenover leadkwaliteit. Veel leads zeggen weinig als er niets uit
 * voortkomt, dus staan het aantal gekwalificeerde leads en de kosten daarvan
 * overal naast het ruwe volume.
 *
 * Deze module rekent niets uit. Alles komt uit het viewmodel dat de repository
 * bouwt op basis van de filtercontext; hier wordt alleen bepaald hoe dat op het
 * scherm komt. Ontbrekende data wordt expliciet als ontbrekend getoond: bij een
 * klant zonder CRM-koppeling is de kwalificatie niet nul maar onbekend.
 */

import { lineChart, barChart, funnelChart } from '../charts.js';
import {
  fmt, esc, kpi, kpiMetriek, tabel, figure, renderBudget, ontbrekendeCel, metriekKolom,
  doelRij, doelVoortgang, badge,
} from './components.js';
import { renderInzichten } from './insight-cards.js';
import { toonKorteDatum, toonBereik } from '../filters/period.js';
import { LABELS } from '../terminology.js';

const cf0 = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const nf = new Intl.NumberFormat('nl-NL');

/** Labels en opmaak per doel-KPI. */
const DOEL_META = {
  leads: { label: 'Totaal aantal leads', format: fmt.getal },
  gekwalificeerdeLeads: { label: 'Gekwalificeerde leads', format: fmt.getal },
  afspraken: { label: 'Afspraken', format: fmt.getal },
  offertes: { label: 'Offertes', format: fmt.getal },
  klanten: { label: 'Klanten', format: fmt.getal },
  cpl: { label: 'Kosten per lead', format: fmt.euro2 },
  cpql: { label: 'Kosten per gekwalificeerde lead', format: fmt.euro2 },
  websitegebruikers: { label: 'Websitegebruikers', format: fmt.getal },
  telefoongesprekken: { label: 'Telefoongesprekken', format: fmt.getal },
  emailacties: { label: 'E-mailacties', format: fmt.getal },
  maandbudget: { label: 'Budgetbesteding', format: fmt.euro },
};

const vgl = (d) => (d.vergelijkingActief ? d.vergelijking.label.toLowerCase() : 'de vorige periode');

/* ---------------------------------------------------------------
   Hoofdweergave, agencyversie
   --------------------------------------------------------------- */

export function renderLeadgenClient(dashboard, verhaal) {
  if (!dashboard.heeftData) return renderGeenData(dashboard);

  return `
    ${renderMeldingen(dashboard)}
    ${renderKerncijfers(dashboard)}
    ${renderInzichten(dashboard.inzichten, { titel: 'Wat er is veranderd in de aanvragen' })}
    ${renderBudget(dashboard)}
    ${renderDoelen(dashboard)}
    ${renderFunnel(dashboard)}
    ${renderOntwikkeling(dashboard)}
    ${renderConversies(dashboard)}
    ${renderKanalen(dashboard)}
    ${renderGoogleAds(dashboard)}
    ${renderWebsitegedrag(dashboard)}
    ${renderGoogleBusinessProfile(dashboard)}
  `;
}

/** Getoond wanneer de filterselectie geen enkele rij oplevert. */
function renderGeenData(dashboard) {
  return `<section class="card leeg-blok" id="geenDataBlok">
    <h2>Geen data voor deze selectie</h2>
    <p class="muted">
      Er zijn geen gegevens voor ${esc(toonBereik(dashboard.periode.startDate, dashboard.periode.endDate))}
      met de gekozen kanalen. Kies een langere periode of voeg een kanaal toe.
    </p>
  </section>`;
}

/** Meetbeperkingen worden getoond, niet weggefilterd. */
function renderMeldingen(dashboard) {
  if (!dashboard.meldingen.length) return '';
  return `<div class="banner banner-info datakwaliteit" role="status">
    <strong>Datakwaliteit</strong>
    <ul>${dashboard.meldingen.map((m) => `<li>${esc(m.tekst)}</li>`).join('')}</ul>
  </div>`;
}

function renderKerncijfers(dashboard) {
  const { totalen, deltas } = dashboard;
  const label = vgl(dashboard);
  const m = (key, opties = {}) => kpiMetriek(totalen, key, deltas, { vergelijkingLabel: label, ...opties });

  return `<div class="kpi-row">
    ${m('spend', { label: 'Spend' })}
    ${m('leads', { label: 'Totaal aantal leads' })}
    ${m('qualifiedLeads', { label: 'Gekwalificeerde leads', leegSub: 'Geen CRM-koppeling' })}
    ${m('cpl', { label: 'Kosten per lead' })}
    ${m('cpql', { label: 'Kosten per gekwalificeerde lead', leegSub: 'Geen CRM-koppeling' })}
    ${m('appointments', { label: 'Afspraken' })}
    ${m('quotes', { label: 'Offertes', leegSub: 'Niet gemeten' })}
    ${m('customers', { label: 'Klanten', leegSub: 'Geen CRM-koppeling' })}
    ${m('leadNaarKlant', { label: 'Lead naar klant', leegSub: 'Geen CRM-koppeling' })}
    ${m('pipelineValue', { label: 'Pipelinewaarde', leegSub: 'Geen CRM-koppeling' })}
  </div>`;
}

/* ---------------------------------------------------------------
   Doelen
   --------------------------------------------------------------- */

function renderDoelen(dashboard) {
  const rijen = dashboard.doelen.map((doel) => {
    const meta = DOEL_META[doel.kpi] ?? { label: doel.kpi, format: fmt.getal };
    return doelRij(doel, { label: meta.label, format: meta.format });
  });

  const behaald = dashboard.doelen.filter((d) => doelVoortgang(d).opSchema).length;
  const meetbaar = dashboard.doelen.filter((d) => doelVoortgang(d).behaald != null).length;

  return `<section class="card">
    <h2>Doelen tegenover werkelijkheid</h2>
    <p class="muted">${behaald} van ${meetbaar} meetbare doelen op schema of hoger.</p>
    <ul class="goal-list">${rijen.join('')}</ul>
    <p class="muted note">
      Maanddoelen worden naar rato van de geselecteerde periode omgerekend.
      Verhoudingen zoals de kosten per lead schalen niet mee.
      Bron: advertentiekanalen, Google Analytics 4 en CRM.
    </p>
  </section>`;
}

/* ---------------------------------------------------------------
   Funnel
   --------------------------------------------------------------- */

function renderFunnel(dashboard) {
  const { rijen, knelpunt, onvoldoendeVolume, minimumVolume } = dashboard.funnel;

  const tabelHtml = tabel(
    ['Stap', 'Volume', 'Vorige periode', 'Verschil', 'Doorstroom', 'Uitval', 'Bron'],
    rijen.map((r) => [
      esc(r.label),
      r.volume == null ? '<span class="muted">Onvoldoende data</span>' : fmt.getal(r.volume),
      r.vorigePeriode == null ? '<span class="muted">Niet beschikbaar</span>' : fmt.getal(r.vorigePeriode),
      r.verschil == null
        ? '<span class="muted">Niet beschikbaar</span>'
        : `<span class="trend-${r.verschil >= 0 ? 'positief' : 'negatief'}">${r.verschil > 0 ? '+' : ''}${r.verschil.toFixed(1)}%</span>`,
      r.doorstroom == null ? '<span class="muted">Onvoldoende data</span>' : fmt.procent(r.doorstroom),
      r.uitval == null ? '<span class="muted">Onvoldoende data</span>' : fmt.getal(r.uitval),
      esc(r.bron),
    ])
  );

  const knelpuntTekst = knelpunt
    ? `Het grootste verlies zit bij de stap ${knelpunt.label}: daar valt ${fmt.procent(100 - knelpunt.doorstroom)} van de voorgaande stap af.`
    : onvoldoendeVolume
      ? `Onvoldoende data. Met minder dan ${minimumVolume} landingspaginaweergaven in deze selectie is het verschil tussen stappen ruis; daar wordt geen conclusie aan verbonden.`
      : 'Er is onvoldoende data om een knelpunt te bepalen.';

  return `<section class="leadfunnel">
    ${figure(
      'chart-lead-funnel',
      'Doorstroom per funnelstap',
      // De absolute aantallen lopen van honderdduizenden impressies naar
      // tientallen klanten. In een gewone staafgrafiek zijn de laatste stappen
      // dan onzichtbaar, dus toont de grafiek het doorstroompercentage.
      'Percentage dat doorstroomt naar de volgende stap. De absolute aantallen staan in de tabelweergave.',
      tabelHtml,
      'Advertentiekanalen, Google Analytics 4 en CRM',
      340
    )}
    <div class="banner banner-warning" role="note">
      <strong>Knelpunt</strong>
      <span>${esc(knelpuntTekst)}</span>
    </div>
  </section>`;
}

/* ---------------------------------------------------------------
   Ontwikkeling binnen de periode
   --------------------------------------------------------------- */

function renderOntwikkeling(dashboard) {
  const { punten, stap } = dashboard.reeks;

  const tabelHtml = tabel(
    ['Datum', 'Uitgaven', 'Leads', 'Gekwalificeerd', 'Kosten per lead'],
    punten.map((p) => [
      esc(punteLabel(p)),
      p.spend == null ? '<span class="muted">Geen data</span>' : fmt.euro(p.spend),
      p.leads == null ? '<span class="muted">Geen data</span>' : fmt.getal(p.leads),
      p.qualifiedLeads == null ? '<span class="muted">Onvoldoende data</span>' : fmt.getal(p.qualifiedLeads),
      p.spend != null && p.leads ? fmt.euro2(p.spend / p.leads) : '<span class="muted">Niet te berekenen</span>',
    ])
  );

  return figure(
    'chart-lead-cpl',
    'Kosten per lead en per gekwalificeerde lead',
    dashboard.totalen.qualifiedLeads == null
      ? `Alleen de kosten per lead zijn beschikbaar, er is geen CRM-koppeling. Weergave per ${stap}.`
      : `Het verschil tussen beide lijnen laat zien hoeveel leads afvallen bij kwalificatie. Weergave per ${stap}.`,
    tabelHtml,
    'Advertentiekanalen en CRM'
  );
}

function punteLabel(punt) {
  return punt.tot && punt.tot !== punt.date
    ? `${toonKorteDatum(punt.date)} – ${toonKorteDatum(punt.tot)}`
    : toonKorteDatum(punt.date);
}

/* ---------------------------------------------------------------
   Conversies
   --------------------------------------------------------------- */

function renderConversies(dashboard) {
  const { primair, secundair, uitgeslotenVanTotaal } = dashboard.conversies;

  const rij = (c) => [
    esc(c.label),
    fmt.getal(c.aantal),
    c.vorigePeriode == null ? '<span class="muted">Geen vergelijking</span>' : fmt.getal(c.vorigePeriode),
    verschilCel(c),
  ];

  return `<section class="card">
    <h2>Conversies</h2>
    <p class="muted">
      Welke conversies als lead tellen verschilt per klant. Deze indeling is per klant
      geconfigureerd, niet vastgelegd in de software.
    </p>
    <div class="grid-2-col">
      <div>
        <h3>Primaire conversies</h3>
        <p class="muted">Acties met directe commerciële waarde.</p>
        <div class="table-scroll">
          ${tabel(['Conversie', 'Aantal', 'Vorige periode', 'Verschil'], primair.map(rij))}
        </div>
      </div>
      <div>
        <h3>Secundaire conversies</h3>
        <p class="muted">Signalen van interesse, geen lead op zichzelf.</p>
        <div class="table-scroll">
          ${tabel(['Conversie', 'Aantal', 'Vorige periode', 'Verschil'], secundair.map(rij))}
        </div>
      </div>
    </div>
    ${uitgeslotenVanTotaal?.length ? `<p class="muted note">
      ${esc(uitgeslotenVanTotaal.map((t) => dashboard.conversies.labels[t] ?? t).join(', '))}
      telt niet mee in het totaal van alle conversies: die stap gaat aan dezelfde lead vooraf
      en zou anders dubbel worden geteld.
    </p>` : ''}
    <p class="muted note">Bron: Google Analytics 4.</p>
  </section>`;
}

function verschilCel(c) {
  if (c.aantal == null || c.vorigePeriode == null || c.vorigePeriode === 0) {
    return '<span class="muted">Niet vergelijkbaar</span>';
  }
  const pct = ((c.aantal - c.vorigePeriode) / c.vorigePeriode) * 100;
  const richting = Math.abs(pct) < 0.5 ? 'neutraal' : pct > 0 ? 'positief' : 'negatief';
  return `<span class="trend-${richting}">${pct > 0 ? '+' : ''}${pct.toFixed(1)}%</span>`;
}

/* ---------------------------------------------------------------
   Kanalen
   --------------------------------------------------------------- */

function renderKanalen(dashboard) {
  const tabelHtml = tabel(
    ['Kanaal', 'Uitgaven', 'Impressies', 'Klikken', 'CTR', 'Leads', 'CPL', 'Gekwalificeerd', 'CPQL'],
    dashboard.kanaalRijen.map((k) => [
      esc(k.label),
      fmt.euro(k.spend),
      fmt.getal(k.impressions),
      fmt.getal(k.clicks),
      fmt.procent(k.ctr),
      fmt.getal(k.leads),
      k.cpl == null ? '<span class="muted">Niet te berekenen</span>' : fmt.euro2(k.cpl),
      k.qualifiedLeads == null ? '<span class="muted">Onvoldoende data</span>' : fmt.getal(k.qualifiedLeads),
      k.cpql == null ? '<span class="muted">Onvoldoende data</span>' : fmt.euro2(k.cpql),
    ])
  );

  return figure(
    'chart-lead-kanaal',
    'Leads per kanaal',
    'Welke advertentiekanalen leads opleveren binnen de geselecteerde periode.',
    tabelHtml,
    'Advertentiekanalen en Google Analytics 4'
  );
}

/* ---------------------------------------------------------------
   Google Ads
   --------------------------------------------------------------- */

function renderGoogleAds(dashboard) {
  const ads = dashboard.profiel?.googleAds;
  const beschikbaar = dashboard.profiel?.googleAdsBeschikbaar;

  if (!beschikbaar || !ads?.campagnes.length) {
    return `<section class="card">
      <h2>Google Ads campagnes</h2>
      <p class="empty">Google Ads staat niet in de huidige kanaalselectie, dus er zijn geen campagnegegevens.</p>
    </section>`;
  }

  const heeftKwalificatie = ads.campagnes.some((c) => c.gekwalificeerdeLeads != null);

  const campagneTabel = tabel(
    ['Campagne', 'Type', 'Kosten', 'Klikken', 'CTR', 'CPC', 'Leads', 'CPA', 'Conv.ratio', 'Gekwalificeerd', 'CPQL'],
    ads.campagnes.map((c) => [
      esc(c.naam),
      `<span class="tag">${esc(c.type)}</span>`,
      fmt.euro(c.kosten),
      fmt.getal(c.klikken),
      fmt.procent(c.ctr),
      fmt.euro2(c.cpc),
      fmt.getal(c.leads),
      fmt.euro2(c.cpa),
      fmt.procent(c.conversieratio),
      c.gekwalificeerdeLeads == null ? '<span class="muted">Onvoldoende data</span>' : fmt.getal(c.gekwalificeerdeLeads),
      c.cpql == null ? '<span class="muted">Onvoldoende data</span>' : kwaliteitCel(c.cpql),
    ])
  );

  const groepTabel = tabel(
    ['Advertentiegroep', 'Campagne', 'Kosten', 'Klikken', 'Leads', 'CPA', 'Gekwalificeerd'],
    ads.advertentiegroepen.map((g) => [
      esc(g.groep),
      `<span class="muted">${esc(g.campagne)}</span>`,
      fmt.euro(g.kosten),
      fmt.getal(g.klikken),
      fmt.getal(g.leads),
      fmt.euro2(g.cpa),
      g.gekwalificeerdeLeads == null ? '<span class="muted">Onvoldoende data</span>' : fmt.getal(g.gekwalificeerdeLeads),
    ])
  );

  const zoekwoordTabel = tabel(
    ['Zoekwoord', 'Matchtype', 'Vertoningen', 'Klikken', 'CTR', 'CPC', 'Kosten', 'Leads', 'CPA', 'Gekwalificeerd', 'CPQL'],
    ads.zoekwoorden.map((z) => [
      esc(z.zoekwoord),
      `<span class="tag">${esc(z.matchtype)}</span>`,
      fmt.getal(z.vertoningen),
      fmt.getal(z.klikken),
      fmt.procent(z.ctr),
      fmt.euro2(z.cpc),
      fmt.euro(z.kosten),
      fmt.getal(z.leads),
      fmt.euro2(z.cpa),
      z.gekwalificeerdeLeads == null ? '<span class="muted">Onvoldoende data</span>' : fmt.getal(z.gekwalificeerdeLeads),
      z.cpql == null ? '<span class="muted">Onvoldoende data</span>' : kwaliteitCel(z.cpql),
    ])
  );

  return `
    <section class="card">
      <h2>Google Ads campagnes</h2>
      <p class="muted">
        ${heeftKwalificatie
          ? 'Veel leads is niet hetzelfde als goede leads. De kolommen gekwalificeerd en CPQL laten zien wat er werkelijk overblijft.'
          : 'Zonder CRM-koppeling is alleen het leadvolume zichtbaar, niet de kwaliteit.'}
      </p>
      <div class="table-scroll">${campagneTabel}</div>
      <h3 style="margin-top:20px">Advertentiegroepen</h3>
      <div class="table-scroll">${groepTabel}</div>
      <h3 style="margin-top:20px">Zoekwoorden</h3>
      <div class="table-scroll">${zoekwoordTabel}</div>
      <p class="muted note">
        Bron: Google Ads. Gekwalificeerde leads komen uit het CRM. De verdeling over campagnes,
        advertentiegroepen en zoekwoorden is in deze demo een vaste verhouding die met de
        geselecteerde periode meeschaalt.
      </p>
    </section>`;
}

/**
 * Kleurt de kosten per gekwalificeerde lead. Een hoge CPQL bij een lage CPA
 * betekent veel goedkope leads die niets opleveren.
 */
function kwaliteitCel(cpql) {
  const klasse = cpql <= 250 ? 'positief' : cpql <= 500 ? 'neutraal' : 'negatief';
  return `<span class="trend-${klasse}">${fmt.euro2(cpql)}</span>`;
}

/* ---------------------------------------------------------------
   Websitegedrag
   --------------------------------------------------------------- */

function renderWebsitegedrag(dashboard) {
  const { totalen, deltas } = dashboard;
  const v = dashboard.profiel?.verdelingen;
  const label = vgl(dashboard);
  const m = (key, opties = {}) => kpiMetriek(totalen, key, deltas, { vergelijkingLabel: label, ...opties });

  return `<section class="card">
    <h2>Website en gebruikersgedrag</h2>
    <div class="kpi-row">
      ${m('users', { label: 'Gebruikers' })}
      ${kpi('Nieuwe gebruikers', fmt.getal(totalen.newUsers), 'binnen de geselecteerde periode')}
      ${m('sessions', { label: 'Sessies' })}
      ${kpi('Engagement rate', fmt.procent(totalen.engagementRate), 'aandeel sessies met interactie')}
      ${kpi('Gemiddelde sessieduur', fmt.duur(totalen.gemSessieduur), 'minuten en seconden')}
    </div>

    <div class="grid-2-col" style="margin-top:20px">
      <div>
        <h3>Landingspagina's</h3>
        <div class="table-scroll">
          ${tabel(['Pagina', 'Gebruikers', 'Leads', 'Conversieratio'],
            (v?.landingspaginas ?? []).map((p) => [esc(p.pagina), fmt.getal(p.gebruikers), fmt.getal(p.leads), fmt.procent(veiligRatio(p.leads, p.gebruikers))]))}
        </div>
      </div>
      <div>
        <h3>Bron en medium</h3>
        <div class="table-scroll">
          ${tabel(['Bron / medium', 'Gebruikers', 'Leads'],
            (v?.sourceMedium ?? []).map((s) => [esc(s.bron), fmt.getal(s.gebruikers), fmt.getal(s.leads)]))}
        </div>
      </div>
      <div>
        <h3>Apparaten</h3>
        <div class="table-scroll">
          ${tabel(['Apparaat', 'Gebruikers', 'Leads', 'Conversieratio'],
            (v?.apparaten ?? []).map((a) => [esc(a.apparaat), fmt.getal(a.gebruikers), fmt.getal(a.leads), fmt.procent(veiligRatio(a.leads, a.gebruikers))]))}
        </div>
      </div>
      <div>
        <h3>Regio's</h3>
        <div class="table-scroll">
          ${tabel(['Regio', 'Gebruikers', 'Leads'],
            (v?.regios ?? []).map((r) => [esc(r.regio), fmt.getal(r.gebruikers), fmt.getal(r.leads)]))}
        </div>
      </div>
    </div>

    <h3 style="margin-top:20px">Landen</h3>
    <div class="table-scroll">
      ${tabel(['Land', 'Gebruikers', 'Leads'], (v?.landen ?? []).map((l) => [esc(l.land), fmt.getal(l.gebruikers), fmt.getal(l.leads)]))}
    </div>
    <p class="muted note">Bron: Google Analytics 4. De verdelingen schalen mee met de geselecteerde periode.</p>
  </section>`;
}

function veiligRatio(teller, noemer) {
  if (teller == null || !noemer) return null;
  return (teller / noemer) * 100;
}

/* ---------------------------------------------------------------
   Google Business Profile
   --------------------------------------------------------------- */

function renderGoogleBusinessProfile(dashboard) {
  const gbp = dashboard.profiel?.googleBusinessProfile;
  if (!gbp) return '';

  return `<section class="card">
    <h2>Lokale zichtbaarheid</h2>
    ${!gbp.koppelingBeschikbaar
      ? `<div class="banner banner-info" role="note">
          <strong>Toekomstige koppeling</strong>
          <span>Een live koppeling met Google Business Profile is nog niet gebouwd. Onderstaande cijfers zijn demodata, naar rato van de geselecteerde periode.</span>
        </div>`
      : ''}
    <div class="kpi-row" style="margin-top:14px">
      ${kpi('Profielinteracties', fmt.getal(gbp.profielinteracties), 'in de geselecteerde periode')}
      ${kpi('Telefoongesprekken', fmt.getal(gbp.telefoongesprekken), 'in de geselecteerde periode')}
      ${kpi('Routeaanvragen', fmt.getal(gbp.routeaanvragen), 'in de geselecteerde periode')}
      ${kpi('Websiteklikken', fmt.getal(gbp.websiteklikken), 'in de geselecteerde periode')}
    </div>
    <p class="muted note">Bron: Google Business Profile, demodata.</p>
  </section>`;
}

/* ---------------------------------------------------------------
   Klantview: rustige, klantgerichte weergave
   --------------------------------------------------------------- */

export function renderLeadgenKlantview(dashboard, verhaal) {
  const { client, totalen, deltas, periode } = dashboard;
  const label = vgl(dashboard);

  if (!dashboard.heeftData) return renderGeenData(dashboard);

  const lijst = (titel, items) => `
    <section class="card">
      <h2>${esc(titel)}</h2>
      ${!items || !items.length
        ? '<p class="empty">Niets te melden voor deze periode.</p>'
        : `<ul class="verhaal-lijst">${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`}
    </section>`;

  const kernDoelen = dashboard.doelen.filter((d) =>
    ['leads', 'gekwalificeerdeLeads', 'afspraken', 'cpl'].includes(d.kpi));

  return `
    ${renderMeldingen(dashboard)}

    <div class="kpi-row">
      ${kpi('Investering', fmt.euro(totalen.spend), 'advertentiebudget deze periode')}
      ${kpiMetriek(totalen, 'leads', deltas, { label: 'Leads', vergelijkingLabel: label })}
      ${kpiMetriek(totalen, 'cpl', deltas, { label: 'Kosten per lead', vergelijkingLabel: label })}
      ${kpi('Leadkwaliteit',
        totalen.qualifiedLeads == null ? 'Onvoldoende data' : `${fmt.getal(totalen.qualifiedLeads)} gekwalificeerd`,
        totalen.qualifiedLeads == null ? 'Geen CRM-koppeling' : `van ${fmt.getal(totalen.leads)} leads`,
        totalen.qualifiedLeads == null ? 'neutraal' : deltas.qualifiedLeads?.richting ?? 'neutraal')}
    </div>

    ${renderBudget(dashboard)}

    <section class="card">
      <h2>Doelen</h2>
      <ul class="goal-list">${kernDoelen.map((d) => {
        const meta = DOEL_META[d.kpi] ?? { label: d.kpi, format: fmt.getal };
        return doelRij(d, { label: meta.label, format: meta.format });
      }).join('')}</ul>
    </section>

    ${figure(
      'chart-klant-funnel',
      'Van bezoeker tot klant',
      'Hoeveel mensen elke stap zetten binnen de geselecteerde periode.',
      tabel(
        ['Stap', 'Aantal', 'Doorstroom'],
        dashboard.funnel.rijen.map((r) => [
          esc(r.label),
          r.volume == null ? '<span class="muted">Onvoldoende data</span>' : fmt.getal(r.volume),
          r.doorstroom == null ? '<span class="muted">n.v.t.</span>' : fmt.procent(r.doorstroom),
        ])
      ),
      'Advertentiekanalen, Google Analytics 4 en CRM',
      320
    )}

    ${figure(
      'chart-klant-kanaal',
      'Waar de leads vandaan komen',
      'Verdeling van leads over de geselecteerde kanalen.',
      tabel(['Kanaal', 'Leads', 'Kosten per lead'], dashboard.kanaalRijen.map((k) => [
        esc(k.label), fmt.getal(k.leads), k.cpl == null ? '<span class="muted">Niet te berekenen</span>' : fmt.euro2(k.cpl),
      ])),
      'Advertentiekanalen en Google Analytics 4'
    )}

    ${renderInzichten(dashboard.inzichten, { titel: 'Wat er is veranderd', toonAanvullend: false })}
    ${renderMeetbeperkingen(verhaal)}

    ${lijst('Wat ik deze periode deed', verhaal?.gedaan)}
    ${lijst('Wat ik hierna ga doen', verhaal?.volgende)}
    ${lijst('Wat ik van je nodig heb', verhaal?.vanKlant)}
  `;
}

/** Wat er binnen deze periode niet te meten viel, in gewone taal. */
function renderMeetbeperkingen(verhaal) {
  const beperkingen = verhaal?.meetbeperkingen ?? [];
  if (!beperkingen.length) return '';

  return `<section class="card" id="meetbeperkingen">
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
   Grafieken
   --------------------------------------------------------------- */

export function drawLeadgenCharts(dashboard, { klantview = false } = {}) {
  if (!dashboard?.heeftData) return;

  // Stappen zonder data horen niet in een grafiek: een ontbrekende waarde als
  // nul tekenen zou suggereren dat er niets gebeurt. De grafiek toont bovendien
  // doorstroompercentages in plaats van absolute aantallen, omdat de verhouding
  // tussen impressies en klanten meer dan 10.000 op 1 is.
  const doorstroomStappen = dashboard.funnel.rijen
    .filter((r) => r.doorstroom != null)
    .map((r) => ({ ...r, volume: r.doorstroom, absoluutVolume: r.volume }));

  const kanalen = [...dashboard.kanaalRijen].sort((a, b) => (b.leads ?? 0) - (a.leads ?? 0));

  if (klantview) {
    funnelChart('chart-klant-funnel', {
      stappen: doorstroomStappen,
      valueFormatter: (v) => `${Number(v).toFixed(0)}%`,
    });
    barChart('chart-klant-kanaal', {
      labels: kanalen.map((k) => k.label),
      horizontal: true,
      series: [{ label: 'Leads', data: kanalen.map((k) => k.leads ?? 0) }],
      valueFormatter: (v) => nf.format(Math.round(v)),
    });
    return;
  }

  funnelChart('chart-lead-funnel', {
    stappen: doorstroomStappen,
    valueFormatter: (v) => `${Number(v).toFixed(0)}%`,
  });

  const punten = dashboard.reeks.punten;
  const series = [{
    label: 'Kosten per lead',
    data: punten.map((p) => (p.spend != null && p.leads ? p.spend / p.leads : null)),
  }];
  if (dashboard.totalen.qualifiedLeads != null) {
    series.push({
      label: 'Kosten per gekwalificeerde lead',
      data: punten.map((p) => (p.spend != null && p.qualifiedLeads ? p.spend / p.qualifiedLeads : null)),
    });
  }
  lineChart('chart-lead-cpl', {
    labels: punten.map(punteLabel),
    series,
    valueFormatter: (v) => cf0.format(v),
  });

  barChart('chart-lead-kanaal', {
    labels: kanalen.map((k) => k.label),
    horizontal: true,
    series: [{ label: 'Leads', data: kanalen.map((k) => k.leads ?? 0) }],
    valueFormatter: (v) => nf.format(Math.round(v)),
  });
}
