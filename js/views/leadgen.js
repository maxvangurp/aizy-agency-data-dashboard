/**
 * Leadgeneratie klantdashboard.
 *
 * Waar het e-commerce dashboard draait om omzet en ROAS, draait dit om
 * leadvolume tegenover leadkwaliteit. Veel leads zeggen weinig als er niets
 * uit voortkomt, dus staan het aantal gekwalificeerde leads en de kosten
 * daarvan overal naast het ruwe volume.
 *
 * Ontbrekende data wordt expliciet als ontbrekend getoond. Bij een klant
 * zonder CRM-koppeling is de kwalificatie niet nul maar onbekend, en dat
 * verschil moet zichtbaar blijven.
 */

import {
  getLeadsData,
  buildLeadFunnel,
  leadToCustomer,
  splitsConversies,
  CONVERSIE_LABELS,
} from '../sample-data/leads.js';
import { lineChart, barChart, funnelChart, donutChart } from '../charts.js';
import {
  fmt, esc, delta, kpi, tabel, figure,
  doelRij, doelVoortgang, maandPrognose, trackingBadge, badge,
} from './components.js';

const MAAND_LABELS = {
  '2026-01': 'jan', '2026-02': 'feb', '2026-03': 'mrt', '2026-04': 'apr',
  '2026-05': 'mei', '2026-06': 'jun', '2026-07': 'jul',
};

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
};

/* ---------------------------------------------------------------
   Hoofdweergave, agencyversie
   --------------------------------------------------------------- */

export function renderLeadgenClient(client) {
  const data = getLeadsData(client.id);
  if (!data) {
    return `<p class="empty">Voor ${esc(client.name)} is nog geen leadgeneratiedata beschikbaar.</p>`;
  }

  return `
    ${renderKop(client, data)}
    ${renderKerncijfers(client, data)}
    ${renderDoelen(data)}
    ${renderFunnel(data)}
    ${renderConversies(data)}
    ${renderKanalen(data)}
    ${renderGoogleAds(data)}
    ${renderWebsitegedrag(data)}
    ${renderGoogleBusinessProfile(data)}
  `;
}

function renderKop(client, data) {
  return `<header class="page-head">
    <h1>${esc(client.name)}</h1>
    <p>
      Leadgeneratie · ${esc(client.accountmanager)} · ${esc(client.land)} ·
      Laatste synchronisatie ${new Date(data.laatsteSync).toLocaleString('nl-NL')}
    </p>
    <div class="head-badges">
      ${trackingBadge(data.trackingStatus)}
      ${badge(`Data health ${data.dataHealth} procent`, data.dataHealth >= 80 ? 'ok' : data.dataHealth >= 65 ? 'middel' : 'hoog')}
    </div>
  </header>`;
}

function renderKerncijfers(client, data) {
  const k = data.kerncijfers;
  const v = k.vorigePeriode ?? {};
  const pacing = (client.spend / client.maandbudget) * 100;
  const l2c = leadToCustomer(data.funnelStappen);

  const d = (huidig, vorig, lagerIsBeter = false) => {
    const r = delta(huidig, vorig, lagerIsBeter);
    return r.tekst === 'Niet beschikbaar' ? 'Geen vergelijking' : `${r.tekst} t.o.v. vorige periode`;
  };
  const richting = (huidig, vorig, lagerIsBeter = false) => delta(huidig, vorig, lagerIsBeter).richting;

  return `<div class="kpi-row">
    ${kpi('Spend', fmt.euro(client.spend), `${fmt.procent(pacing)} van ${fmt.euro(client.maandbudget)}`, pacing > 100 ? 'negatief' : 'positief')}
    ${kpi('Totaal aantal leads', fmt.getal(k.leads), d(k.leads, v.leads), richting(k.leads, v.leads))}
    ${kpi('Gekwalificeerde leads', k.gekwalificeerdeLeads == null ? 'Onvoldoende data' : fmt.getal(k.gekwalificeerdeLeads),
      k.gekwalificeerdeLeads == null ? 'Geen CRM-koppeling' : d(k.gekwalificeerdeLeads, v.gekwalificeerdeLeads),
      k.gekwalificeerdeLeads == null ? 'neutraal' : richting(k.gekwalificeerdeLeads, v.gekwalificeerdeLeads))}
    ${kpi('Kosten per lead', fmt.euro2(k.cpl), d(k.cpl, v.cpl, true), richting(k.cpl, v.cpl, true))}
    ${kpi('Kosten per gekwalificeerde lead', k.cpql == null ? 'Onvoldoende data' : fmt.euro2(k.cpql),
      k.cpql == null ? 'Geen CRM-koppeling' : d(k.cpql, v.cpql, true),
      k.cpql == null ? 'neutraal' : richting(k.cpql, v.cpql, true))}
    ${kpi('Afspraken', fmt.getal(k.afspraken), d(k.afspraken, v.afspraken), richting(k.afspraken, v.afspraken))}
    ${kpi('Offertes', k.offertes == null ? 'Onvoldoende data' : fmt.getal(k.offertes),
      k.offertes == null ? 'Niet gemeten' : d(k.offertes, v.offertes),
      k.offertes == null ? 'neutraal' : richting(k.offertes, v.offertes))}
    ${kpi('Klanten', k.klanten == null ? 'Onvoldoende data' : fmt.getal(k.klanten),
      k.klanten == null ? 'Geen CRM-koppeling' : d(k.klanten, v.klanten),
      k.klanten == null ? 'neutraal' : richting(k.klanten, v.klanten))}
    ${kpi('Lead naar klant', l2c == null ? 'Onvoldoende data' : fmt.procent(l2c),
      l2c == null ? 'Geen CRM-koppeling' : 'van lead tot betalende klant')}
    ${kpi('Pipelinewaarde', k.pipelinewaarde == null ? 'Onvoldoende data' : fmt.euro(k.pipelinewaarde),
      k.pipelinewaarde == null ? 'Geen CRM-koppeling' : d(k.pipelinewaarde, v.pipelinewaarde),
      k.pipelinewaarde == null ? 'neutraal' : richting(k.pipelinewaarde, v.pipelinewaarde))}
  </div>`;
}

/* ---------------------------------------------------------------
   Doelen
   --------------------------------------------------------------- */

function renderDoelen(data) {
  // Prognose op basis van het aantal verstreken dagen in de maand.
  const DAG_VAN_MAAND = 21;
  const DAGEN_IN_MAAND = 31;

  const rijen = data.doelen.map((doel) => {
    const meta = DOEL_META[doel.kpi] ?? { label: doel.kpi, format: fmt.getal };
    // Een prognose is alleen zinvol voor doelen die gedurende de maand oplopen.
    const oplopend = !['cpl', 'cpql'].includes(doel.kpi);
    const prognose = oplopend ? maandPrognose(doel.actueel, DAG_VAN_MAAND, DAGEN_IN_MAAND) : null;
    return doelRij(doel, {
      label: meta.label,
      format: meta.format,
      prognose,
      vorigePeriode: doel.vorigePeriode,
    });
  });

  const behaald = data.doelen.filter((d) => doelVoortgang(d).opSchema).length;
  const meetbaar = data.doelen.filter((d) => doelVoortgang(d).behaald != null).length;

  return `<section class="card">
    <h2>Doelen tegenover werkelijkheid</h2>
    <p class="muted">${behaald} van ${meetbaar} meetbare maanddoelen op schema of hoger.</p>
    <ul class="goal-list">${rijen.join('')}</ul>
    <p class="muted note">
      De prognose is een schatting op basis van het tempo tot nu toe, uitgaande van
      ${DAG_VAN_MAAND} verstreken dagen. Bron: Google Ads, Google Analytics 4 en CRM.
    </p>
  </section>`;
}

/* ---------------------------------------------------------------
   Funnel
   --------------------------------------------------------------- */

function renderFunnel(data) {
  const { rijen, knelpunt } = buildLeadFunnel(data.funnelStappen, data.funnelVorigePeriode);

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
    : 'Er is onvoldoende data om een knelpunt te bepalen.';

  return `<section class="leadfunnel">
    ${figure(
      'chart-lead-funnel',
      'Doorstroom per funnelstap',
      // De absolute aantallen lopen van honderdduizenden impressies naar
      // tientallen klanten. In een gewone staafgrafiek zijn de laatste stappen
      // dan onzichtbaar, dus toont de grafiek het doorstroompercentage.
      // De volledige aantallen staan in de tabelweergave.
      'Percentage dat doorstroomt naar de volgende stap. De absolute aantallen staan in de tabelweergave.',
      tabelHtml,
      'Google Ads, Google Analytics 4 en CRM',
      340
    )}
    <div class="banner banner-warning" role="note">
      <strong>Knelpunt</strong>
      <span>${esc(knelpuntTekst)}</span>
    </div>
  </section>`;
}

/* ---------------------------------------------------------------
   Conversies
   --------------------------------------------------------------- */

function renderConversies(data) {
  const { primair, secundair } = splitsConversies(data);

  const rij = (c) => {
    const d = delta(c.aantal, c.vorigePeriode);
    return [
      esc(CONVERSIE_LABELS[c.type] ?? c.type),
      fmt.getal(c.aantal),
      fmt.getal(c.vorigePeriode),
      `<span class="trend-${d.richting}">${esc(d.tekst)}</span>`,
    ];
  };

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
    <p class="muted note">Bron: Google Analytics 4.</p>
  </section>`;
}

/* ---------------------------------------------------------------
   Kanalen
   --------------------------------------------------------------- */

function renderKanalen(data) {
  const tabelHtml = tabel(
    ['Kanaal', 'Gebruikers', 'Sessies', 'Leads', 'Gekwalificeerd', 'CPL', 'Engagement'],
    data.acquisitie.map((a) => [
      esc(a.kanaal),
      fmt.getal(a.gebruikers),
      fmt.getal(a.sessies),
      fmt.getal(a.leads),
      a.gekwalificeerd == null ? '<span class="muted">Onvoldoende data</span>' : fmt.getal(a.gekwalificeerd),
      a.cpl == null ? '<span class="muted">Niet van toepassing</span>' : fmt.euro2(a.cpl),
      fmt.procent(a.engagementRate),
    ])
  );

  return figure(
    'chart-lead-kanaal',
    'Leads per kanaal',
    'Welke kanaalgroepen leads opleveren.',
    tabelHtml,
    'Google Analytics 4'
  );
}

/* ---------------------------------------------------------------
   Google Ads
   --------------------------------------------------------------- */

function renderGoogleAds(data) {
  const ads = data.googleAds;
  const heeftKwalificatie = ads.totalen.gekwalificeerdeLeads != null;

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

  const maandTabel = tabel(
    ['Maand', 'Kosten', 'Klikken', 'Leads', 'CPA', 'Gekwalificeerd', 'CPQL'],
    ads.maanden.map((m) => [
      MAAND_LABELS[m.maand] ?? m.maand,
      fmt.euro(m.kosten),
      fmt.getal(m.klikken),
      fmt.getal(m.leads),
      fmt.euro2(m.cpa),
      m.gekwalificeerdeLeads == null ? '<span class="muted">Onvoldoende data</span>' : fmt.getal(m.gekwalificeerdeLeads),
      m.cpql == null ? '<span class="muted">Onvoldoende data</span>' : fmt.euro2(m.cpql),
    ])
  );

  return `
    ${figure(
      'chart-lead-cpl',
      'Kosten per lead en per gekwalificeerde lead',
      heeftKwalificatie
        ? 'Het verschil tussen beide lijnen laat zien hoeveel leads afvallen bij kwalificatie.'
        : 'Alleen de kosten per lead zijn beschikbaar, er is geen CRM-koppeling.',
      maandTabel,
      'Google Ads en CRM'
    )}

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
      <p class="muted note">Bron: Google Ads. Gekwalificeerde leads komen uit het CRM.</p>
    </section>
  `;
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

function renderWebsitegedrag(data) {
  const g = data.ga4;
  const v = g.vorigePeriode ?? {};

  return `<section class="card">
    <h2>Website en gebruikersgedrag</h2>
    <div class="kpi-row">
      ${kpi('Gebruikers', fmt.getal(g.gebruikers), `${delta(g.gebruikers, v.gebruikers).tekst} t.o.v. vorige periode`, delta(g.gebruikers, v.gebruikers).richting)}
      ${kpi('Nieuwe gebruikers', fmt.getal(g.nieuweGebruikers), `${delta(g.nieuweGebruikers, v.nieuweGebruikers).tekst} t.o.v. vorige periode`, delta(g.nieuweGebruikers, v.nieuweGebruikers).richting)}
      ${kpi('Sessies', fmt.getal(g.sessies), `${delta(g.sessies, v.sessies).tekst} t.o.v. vorige periode`, delta(g.sessies, v.sessies).richting)}
      ${kpi('Engagement rate', fmt.procent(g.engagementRate), `${delta(g.engagementRate, v.engagementRate).tekst} t.o.v. vorige periode`, delta(g.engagementRate, v.engagementRate).richting)}
      ${kpi('Gemiddelde sessieduur', fmt.duur(g.gemSessieduur), 'minuten en seconden')}
    </div>

    <div class="grid-2-col" style="margin-top:20px">
      <div>
        <h3>Landingspagina's</h3>
        <div class="table-scroll">
          ${tabel(['Pagina', 'Gebruikers', 'Leads', 'Conversieratio'],
            data.landingspaginas.map((p) => [esc(p.pagina), fmt.getal(p.gebruikers), fmt.getal(p.leads), fmt.procent(p.conversieratio)]))}
        </div>
      </div>
      <div>
        <h3>Bron en medium</h3>
        <div class="table-scroll">
          ${tabel(['Bron / medium', 'Gebruikers', 'Leads'],
            data.sourceMedium.map((s) => [esc(s.bron), fmt.getal(s.gebruikers), fmt.getal(s.leads)]))}
        </div>
      </div>
      <div>
        <h3>Apparaten</h3>
        <div class="table-scroll">
          ${tabel(['Apparaat', 'Gebruikers', 'Leads', 'Conversieratio'],
            data.apparaten.map((a) => [esc(a.apparaat), fmt.getal(a.gebruikers), fmt.getal(a.leads), fmt.procent(a.conversieratio)]))}
        </div>
      </div>
      <div>
        <h3>Regio's</h3>
        <div class="table-scroll">
          ${tabel(['Regio', 'Gebruikers', 'Leads'],
            data.regios.map((r) => [esc(r.regio), fmt.getal(r.gebruikers), fmt.getal(r.leads)]))}
        </div>
      </div>
    </div>

    <h3 style="margin-top:20px">Landen</h3>
    <div class="table-scroll">
      ${tabel(['Land', 'Gebruikers', 'Leads'], data.landen.map((l) => [esc(l.land), fmt.getal(l.gebruikers), fmt.getal(l.leads)]))}
    </div>
    <p class="muted note">Bron: Google Analytics 4.</p>
  </section>`;
}

/* ---------------------------------------------------------------
   Google Business Profile
   --------------------------------------------------------------- */

function renderGoogleBusinessProfile(data) {
  const gbp = data.googleBusinessProfile;
  const v = gbp.vorigePeriode ?? {};
  const d = (a, b) => delta(a, b);

  return `<section class="card">
    <h2>Lokale zichtbaarheid</h2>
    ${!gbp.koppelingBeschikbaar
      ? `<div class="banner banner-info" role="note">
          <strong>Toekomstige koppeling</strong>
          <span>Een live koppeling met Google Business Profile is nog niet gebouwd. Onderstaande cijfers zijn demodata.</span>
        </div>`
      : ''}
    <div class="kpi-row" style="margin-top:14px">
      ${kpi('Profielinteracties', fmt.getal(gbp.profielinteracties), `${d(gbp.profielinteracties, v.profielinteracties).tekst} t.o.v. vorige periode`, d(gbp.profielinteracties, v.profielinteracties).richting)}
      ${kpi('Telefoongesprekken', fmt.getal(gbp.telefoongesprekken), `${d(gbp.telefoongesprekken, v.telefoongesprekken).tekst} t.o.v. vorige periode`, d(gbp.telefoongesprekken, v.telefoongesprekken).richting)}
      ${kpi('Routeaanvragen', fmt.getal(gbp.routeaanvragen), `${d(gbp.routeaanvragen, v.routeaanvragen).tekst} t.o.v. vorige periode`, d(gbp.routeaanvragen, v.routeaanvragen).richting)}
      ${kpi('Websiteklikken', fmt.getal(gbp.websiteklikken), `${d(gbp.websiteklikken, v.websiteklikken).tekst} t.o.v. vorige periode`, d(gbp.websiteklikken, v.websiteklikken).richting)}
    </div>
    <p class="muted note">Bron: Google Business Profile, demodata.</p>
  </section>`;
}

/* ---------------------------------------------------------------
   Klantview: rustige, klantgerichte weergave
   --------------------------------------------------------------- */

export function renderLeadgenKlantview(client) {
  const data = getLeadsData(client.id);
  if (!data) return `<p class="empty">Voor ${esc(client.name)} is nog geen data beschikbaar.</p>`;

  const k = data.kerncijfers;
  const v = k.vorigePeriode ?? {};
  const verhaal = data.klantverhaal ?? {};
  const { rijen } = buildLeadFunnel(data.funnelStappen, data.funnelVorigePeriode);

  const lijst = (titel, items) => `
    <section class="card">
      <h2>${esc(titel)}</h2>
      ${!items || !items.length
        ? '<p class="empty">Nog niets vastgelegd.</p>'
        : `<ul class="verhaal-lijst">${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`}
    </section>`;

  return `
    <header class="page-head">
      <h1>${esc(client.name)}</h1>
      <p>Resultaten van deze periode</p>
    </header>

    <div class="kpi-row">
      ${kpi('Investering', fmt.euro(client.spend), 'advertentiebudget deze periode')}
      ${kpi('Leads', fmt.getal(k.leads), `${delta(k.leads, v.leads).tekst} t.o.v. vorige periode`, delta(k.leads, v.leads).richting)}
      ${kpi('Kosten per lead', fmt.euro2(k.cpl), `${delta(k.cpl, v.cpl, true).tekst} t.o.v. vorige periode`, delta(k.cpl, v.cpl, true).richting)}
      ${kpi('Leadkwaliteit', k.gekwalificeerdeLeads == null ? 'Onvoldoende data' : `${fmt.getal(k.gekwalificeerdeLeads)} gekwalificeerd`,
        k.gekwalificeerdeLeads == null ? 'Geen CRM-koppeling' : `van ${fmt.getal(k.leads)} leads`,
        k.gekwalificeerdeLeads == null ? 'neutraal' : delta(k.gekwalificeerdeLeads, v.gekwalificeerdeLeads).richting)}
    </div>

    <section class="card">
      <h2>Doelen</h2>
      <ul class="goal-list">${data.doelen
        .filter((d) => ['leads', 'gekwalificeerdeLeads', 'afspraken', 'cpl'].includes(d.kpi))
        .map((d) => {
          const meta = DOEL_META[d.kpi] ?? { label: d.kpi, format: fmt.getal };
          return doelRij(d, { label: meta.label, format: meta.format });
        })
        .join('')}</ul>
    </section>

    ${figure(
      'chart-klant-funnel',
      'Van bezoeker tot klant',
      'Hoeveel mensen elke stap zetten.',
      tabel(
        ['Stap', 'Aantal', 'Doorstroom'],
        rijen.map((r) => [
          esc(r.label),
          r.volume == null ? '<span class="muted">Onvoldoende data</span>' : fmt.getal(r.volume),
          r.volume == null ? '<span class="muted">n.v.t.</span>' : fmt.procent(r.doorstroom),
        ])
      ),
      'Google Ads, Google Analytics 4 en CRM',
      320
    )}

    ${figure(
      'chart-klant-kanaal',
      'Waar de leads vandaan komen',
      'Verdeling van leads over de kanalen.',
      tabel(['Kanaal', 'Leads'], data.acquisitie.map((a) => [esc(a.kanaal), fmt.getal(a.leads)])),
      'Google Analytics 4'
    )}

    ${lijst('Wat ging goed', verhaal.goed)}
    ${lijst('Wat aandacht nodig heeft', verhaal.aandacht)}
    ${lijst('Wat ik deze periode deed', verhaal.gedaan)}
    ${lijst('Wat ik hierna ga doen', verhaal.volgende)}
    ${lijst('Wat ik van je nodig heb', verhaal.vanKlant)}
  `;
}

/* ---------------------------------------------------------------
   Grafieken
   --------------------------------------------------------------- */

export function drawLeadgenCharts(client, { klantview = false } = {}) {
  const data = getLeadsData(client.id);
  if (!data) return;

  const { rijen } = buildLeadFunnel(data.funnelStappen, data.funnelVorigePeriode);

  // Stappen zonder data horen niet in een grafiek: een ontbrekende waarde als
  // nul tekenen zou suggereren dat er niets gebeurt.
  // De grafiek toont doorstroompercentages in plaats van absolute aantallen.
  // Van 218.400 impressies naar 19 klanten is een verhouding van meer dan
  // 10.000 op 1; in een lineaire schaal zijn de laatste stappen onzichtbaar.
  const doorstroomStappen = rijen
    .filter((r) => r.doorstroom != null)
    .map((r) => ({ ...r, volume: r.doorstroom, absoluutVolume: r.volume }));

  if (klantview) {
    funnelChart('chart-klant-funnel', {
      stappen: doorstroomStappen,
      valueFormatter: (v) => `${Number(v).toFixed(0)}%`,
    });
    const kanalen = [...data.acquisitie].sort((a, b) => b.leads - a.leads);
    barChart('chart-klant-kanaal', {
      labels: kanalen.map((a) => a.kanaal),
      horizontal: true,
      series: [{ label: 'Leads', data: kanalen.map((a) => a.leads) }],
      valueFormatter: (v) => nf.format(Math.round(v)),
    });
    return;
  }

  funnelChart('chart-lead-funnel', {
    stappen: doorstroomStappen,
    valueFormatter: (v) => `${Number(v).toFixed(0)}%`,
  });

  const maanden = data.googleAds.maanden;
  const series = [{ label: 'Kosten per lead', data: maanden.map((m) => m.cpa) }];
  if (maanden.some((m) => m.cpql != null)) {
    series.push({ label: 'Kosten per gekwalificeerde lead', data: maanden.map((m) => m.cpql) });
  }
  lineChart('chart-lead-cpl', {
    labels: maanden.map((m) => MAAND_LABELS[m.maand] ?? m.maand),
    series,
    valueFormatter: (v) => cf0.format(v),
  });

  const kanalen = [...data.acquisitie].sort((a, b) => b.leads - a.leads);
  barChart('chart-lead-kanaal', {
    labels: kanalen.map((a) => a.kanaal),
    horizontal: true,
    series: [{ label: 'Leads', data: kanalen.map((a) => a.leads) }],
    valueFormatter: (v) => nf.format(Math.round(v)),
  });
}
