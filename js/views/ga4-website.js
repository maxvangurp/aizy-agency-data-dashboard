/**
 * De GA4-module: hoe presteert de website, en wat moet er gebeuren.
 *
 * De inhoud van deze pagina wordt bepaald door het klanttype. Een
 * leadgeneratieklant ziet aanvragen, contactinteracties en de pagina's die ze
 * opleveren; een webshop ziet aankopen, omzet, producten en het aankoopproces.
 * Een gecombineerde klant ziet allebei, gescheiden, in de volgorde die bij zijn
 * bedrijfsdoel hoort.
 *
 * Er is geen generieke variant. Een webshop een leadrapport tonen -- of
 * andersom -- levert lege kaarten op die eruitzien als slechte prestaties in
 * plaats van als niet van toepassing.
 *
 * Het rekenwerk staat in `ga4-contract.js` en `ga4-inzichten.js` aan de
 * serverkant. Dit bestand toont alleen.
 */

import { esc, uitklap, tabel, badge } from './components.js';
import { interactieveTabel } from './simpel-widgets.js';

const fmtGetal = (v) => (v == null ? '—' : Number(v).toLocaleString('nl-NL'));
const fmtProcent = (v) => (v == null ? '—' : `${Number(v).toLocaleString('nl-NL', { maximumFractionDigits: 2 })}%`);
const fmtGeld = (v, valuta = 'EUR') => (v == null ? '—'
  : Number(v).toLocaleString('nl-NL', { style: 'currency', currency: valuta, maximumFractionDigits: 2 }));

const fmtDatum = (iso) => {
  if (!iso) return '—';
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
};

/* ------------------------------------------------------------ hoofdview -- */

export function renderGa4View(data) {
  if (!data) return laden();
  if (data.status === 'niet_ingericht') return nietIngericht(data);
  if (data.status === 'geen_data') return geenData(data);
  if (data.status !== 'ok') return fout(data);

  const valuta = data.property?.valuta ?? 'EUR';
  return `
    ${demoBalk(data)}
    ${kop(data)}
    ${meldingenBlok(data)}
    <h2 class="visueel-verborgen">Belangrijkste inzichten</h2>
    ${inzichtenBlok(data.inzichten ?? [])}
    <h2 class="visueel-verborgen">Kerncijfers</h2>
    ${kpiBlokken(data, valuta)}
    ${acquisitieBlok(data, valuta)}
    ${landingspaginaBlok(data, valuta)}
    ${leadVerdieping(data)}
    ${ecommerceVerdieping(data, valuta)}
    ${apparaatEnLocatie(data, valuta)}
    ${instellingenBlok(data)}
  `;
}

/**
 * Demonstratiedata wordt nooit als klantdata getoond.
 *
 * Boven alles, niet als voetnoot: de cijfers hieronder zien er precies zo uit
 * als echte, en juist bij deze module zou iemand de conversieratio van een
 * verzonnen webshop voor die van zijn eigen site kunnen aanzien.
 */
function demoBalk(data) {
  if (!data?.demodata) return '';
  return `<p class="ga4-demobalk" role="note">
    <strong>Voorbeelddata.</strong> Dit zijn geen cijfers van deze klant. De module is nog
    niet aan een GA4-property gekoppeld; wat je hier ziet laat zien hoe hij eruitziet voor
    een ${esc(data.klanttype === 'ecommerce' ? 'e-commerceklant' : 'leadgeneratieklant')}.
  </p>`;
}

/* ------------------------------------------------------------- statussen -- */

function laden() {
  return `<div class="ga4-skelet" aria-busy="true">
    <p class="muted">Websitecijfers laden…</p>
  </div>`;
}

function nietIngericht(data) {
  return `
    <header class="pagina-kop"><h1>Website</h1></header>
    <section class="card ga4-leeg">
      <h2>Deze module is nog niet ingericht</h2>
      <p>${esc(data.melding ?? '')}</p>
      <p class="muted">
        Zolang niet vaststaat of dit een leadgeneratie- of e-commerceklant is, weten we
        niet welke gebeurtenis een bedrijfsresultaat is. Een dashboard bouwen op een
        aanname daarover levert cijfers op die eruitzien alsof ze kloppen.
      </p>
    </section>`;
}

function geenData(data) {
  const anders = (data.beschikbaar ?? []).slice(0, 6);
  return `
    <header class="pagina-kop">
      <h1>Website</h1>
      ${data.property ? propertyRegel(data.property) : ''}
      ${vensterKeuze(data)}
    </header>
    <section class="card ga4-leeg">
      <h2>Nog geen cijfers voor deze periode</h2>
      <p>${esc(data.melding ?? '')}</p>
      ${anders.length ? `
        <p class="muted">Voor deze klant staan wel klaar:</p>
        <ul class="ga4-beschikbaar">
          ${anders.map((p) => `<li>${esc(fmtDatum(p.start))} t/m ${esc(fmtDatum(p.eind))}</li>`).join('')}
        </ul>
        <p class="muted">
          Staat de gevraagde periode daar niet bij, dan is dat geen storing maar een
          ophaalronde die nog moet draaien.
        </p>` : ''}
    </section>`;
}

function fout(data) {
  return `
    <header class="pagina-kop"><h1>Website</h1></header>
    <section class="card ga4-leeg">
      <h2>De websitecijfers konden niet geladen worden</h2>
      <p>${esc(data.message ?? 'Onbekende fout.')}</p>
    </section>`;
}

/* ------------------------------------------------------------------- kop -- */

const TYPELABEL = {
  leadgen: 'Leadgeneratie',
  ecommerce: 'E-commerce',
  beide: 'Leadgeneratie én e-commerce',
};

function kop(data) {
  const p = data.periode ?? {};
  const v = data.vergelijking;
  return `
    <header class="pagina-kop ga4-kop">
      <div>
        <h1>Website</h1>
        <p class="ga4-periode">
          ${esc(fmtDatum(p.start))} t/m ${esc(fmtDatum(p.eind))}
          ${v
            ? v.beschikbaar
              ? `<span class="muted">· vergeleken met ${esc(fmtDatum(v.start))} t/m ${esc(fmtDatum(v.eind))}</span>`
              : `<span class="muted">· geen vergelijking: ${esc(v.reden ?? '')}</span>`
            : ''}
        </p>
        ${vensterKeuze(data)}
      </div>
      <div class="ga4-kop-rechts">
        ${badge(TYPELABEL[data.klanttype] ?? data.klanttype, 'info')}
        ${propertyRegel(data.property)}
      </div>
    </header>`;
}

/**
 * De vensterkeuze van deze module.
 *
 * Eigen knoppen en niet het periodefilter bovenin. Dat filter kent perioden
 * inclusief vandaag, en een halve dag maakt elke trend op de laatste dag lager
 * dan hij wordt. Bovendien wordt een GA4-rapport per exacte periode opgehaald:
 * wijkt de vraag één dag af van wat er staat, dan is er niets te tonen.
 *
 * De keuze staat in de hash, zodat hij deelbaar is en een herlading overleeft.
 */
const VENSTERS = [
  { dagen: 7, label: '7 dagen' },
  { dagen: 28, label: '28 dagen' },
  { dagen: 90, label: '90 dagen' },
];

function vensterKeuze(data) {
  const actief = data.venster ?? 28;
  const vergelijk = data.vergelijking?.mode === 'vorigJaar' ? 'vorigJaar' : 'vorige';
  const link = (v, verg) => {
    const q = new URLSearchParams({ venster: String(v) });
    if (verg === 'vorigJaar') q.set('ga4vergelijk', 'vorigJaar');
    return `#/pulse/website?${q}`;
  };

  return `
    <div class="ga4-venster" role="group" aria-label="Periode en vergelijking">
      <span class="ga4-venster-label">Volledige dagen:</span>
      ${VENSTERS.map((v) => `
        <a class="ga4-venster-knop${v.dagen === actief ? ' actief' : ''}"
           href="${link(v.dagen, vergelijk)}"
           ${v.dagen === actief ? 'aria-current="true"' : ''}
           data-venster="${v.dagen}">${esc(v.label)}</a>`).join('')}
      <span class="ga4-venster-label">Vergelijk met:</span>
      <a class="ga4-venster-knop${vergelijk === 'vorige' ? ' actief' : ''}"
         href="${link(actief, 'vorige')}" data-vergelijk="vorige">Vorige periode</a>
      <a class="ga4-venster-knop${vergelijk === 'vorigJaar' ? ' actief' : ''}"
         href="${link(actief, 'vorigJaar')}" data-vergelijk="vorigJaar">Vorig jaar</a>
      <p class="ga4-venster-uitleg">
        Deze pagina volgt zijn eigen periode en niet het filter bovenaan. GA4 rekent op
        volledige dagen: een dag die nog loopt is altijd lager dan hij wordt, en laat elke
        trend op het eind dalen zonder dat er iets gebeurde.
      </p>
    </div>`;
}

function propertyRegel(property) {
  if (!property) return '';
  const delen = [
    property.naam,
    property.id ? `ID ${property.id}` : null,
    property.tijdzone,
    property.valuta,
  ].filter(Boolean);
  return `<p class="ga4-property muted">${esc(delen.join(' · '))}</p>`;
}

/* -------------------------------------------------------------- meldingen -- */

/**
 * Wat er over de cijfers zelf te zeggen valt vóórdat iemand ze leest.
 *
 * Een steekproef, een afgekapte lijst of een periode die nog verwerkt wordt
 * verandert niets aan de getallen op het scherm, maar wel aan wat je ermee mag
 * concluderen. Daarom bovenaan en niet in een voetnoot.
 */
function meldingenBlok(data) {
  const regels = [...(data.meldingen ?? [])];
  if (data.vergelijking?.voorbehoud) {
    regels.unshift({ code: 'vergelijking_leeg', tekst: data.vergelijking.voorbehoud });
  }
  if (data.synchronisatie?.nogInVerwerking) {
    regels.unshift({
      code: 'verwerking',
      tekst: 'De laatste dagen kunnen nog wijzigen: GA4 verwerkt gebeurtenissen tot ongeveer '
        + '48 uur na. Een vergelijking met een afgeronde periode valt daardoor iets te laag uit.',
    });
  }
  if (!regels.length) return '';
  return `
    <section class="ga4-meldingen" role="note">
      ${regels.map((m) => `<p class="ga4-melding"><strong>Let op.</strong> ${esc(m.tekst)}</p>`).join('')}
    </section>`;
}

/* -------------------------------------------------------------- inzichten -- */

function inzichtenBlok(kaarten) {
  if (!kaarten.length) {
    return `<section class="card ga4-inzichten-leeg">
      <p class="muted">
        Geen opvallende veranderingen in deze periode. Dat is een antwoord: er is niets
        gevonden dat boven de drempels uitkomt.
      </p>
    </section>`;
  }
  return `
    <section class="ga4-inzichten">
      ${kaarten.map(inzichtKaart).join('')}
    </section>`;
}

/**
 * Eén kaart, met waarneming, verklaring en actie uit elkaar gehouden.
 *
 * Ze samenvoegen tot één zin laat een mogelijkheid als een conclusie lezen --
 * "mobiel converteert slechter dus de site is stuk" -- en dan gaat iemand een
 * probleem oplossen dat misschien een kanaalmix is.
 */
function inzichtKaart(k) {
  return `
    <article class="ga4-inzicht" data-code="${esc(k.code)}">
      <h3>${esc(k.titel)}</h3>
      <p class="ga4-inzicht-waarneming">${esc(k.waarneming)}</p>
      <dl class="ga4-inzicht-uitleg">
        <dt>Waarom dit telt</dt><dd>${esc(k.waarom)}</dd>
        ${k.verklaring ? `<dt>Mogelijke verklaring</dt><dd>${esc(k.verklaring)}</dd>` : ''}
        <dt>Volgende stap</dt><dd>${esc(k.actie)}</dd>
      </dl>
      ${k.onzekerheid ? `<p class="ga4-inzicht-voorbehoud">${esc(k.onzekerheid)}</p>` : ''}
      ${k.naar?.tab ? `<a class="ga4-inzicht-naar" href="#ga4-${esc(k.naar.tab)}">Bekijk de uitsplitsing</a>` : ''}
    </article>`;
}

/* ------------------------------------------------------------------ KPI's -- */

function kpiBlokken(data, valuta) {
  return (data.kpis ?? []).map((groep) => `
    <section class="card ga4-kpi-groep" data-groep="${esc(groep.sleutel)}">
      <div class="ga4-kpi-kop">
        <h2>${esc(groep.titel)}</h2>
        <p class="muted">${esc(groep.uitleg)}</p>
      </div>
      ${groep.nietIngericht
        ? `<p class="ga4-kpi-leeg">Er zijn nog geen gebeurtenissen aangewezen voor dit doel,
             dus deze cijfers blijven leeg. Dat is iets anders dan nul.</p>`
        : `<div class="kpi-row ga4-kpis">${groep.kpis.map((k) => kpiKaart(k, valuta, data)).join('')}</div>`}
    </section>`).join('');
}

function kpiKaart(k, valuta, data) {
  const waarde = k.gemeten ? formatteer(k.waarde, k.eenheid, valuta) : 'Niet gemeten';
  const vergelijkLabel = data.vergelijking?.label ?? 'de vorige periode';
  return `
    <article class="kpi ga4-kpi${k.secundair ? ' ga4-kpi-secundair' : ''}" data-kpi="${esc(k.sleutel)}">
      <h3 class="kpi-label">
        ${esc(k.label)}
        <button type="button" class="ga4-uitleg-knop" aria-label="Wat betekent ${esc(k.label)}?"
          title="${esc(k.definitie)}">?</button>
      </h3>
      <p class="kpi-waarde">${esc(waarde)}</p>
      ${k.gemeten ? deltaRegel(k, valuta, vergelijkLabel) : '<p class="kpi-sub muted">Deze meting ontbreekt.</p>'}
      ${k.voorbehoud ? `<p class="ga4-kpi-voorbehoud">${esc(k.voorbehoud)}</p>` : ''}
    </article>`;
}

/**
 * De verandering onder een KPI.
 *
 * Een stijging wordt niet automatisch groen: meer verkeer zonder meer
 * bedrijfsresultaat is niet vanzelf positief. Alleen de KPI's die zelf een
 * bedrijfsresultaat zijn krijgen een richting mee.
 */
const RESULTAAT_KPIS = new Set(['aanvragen', 'leadratio', 'aankopen', 'omzet', 'aankoopratio', 'orderwaarde']);

function deltaRegel(k, valuta, vergelijkLabel) {
  const v = k.verandering ?? {};
  if (v.absoluut == null) return `<p class="kpi-sub muted">Geen vergelijking beschikbaar.</p>`;
  if (v.vanNul) {
    return `<p class="kpi-sub">Van niets naar ${esc(formatteer(k.waarde, k.eenheid, valuta))}
      <span class="muted">· een percentage zegt hier niets</span></p>`;
  }
  const richting = RESULTAAT_KPIS.has(k.sleutel)
    ? (v.absoluut > 0 ? 'omhoog' : v.absoluut < 0 ? 'omlaag' : 'gelijk')
    : 'neutraal';
  const teken = v.absoluut > 0 ? '+' : '';
  return `<p class="kpi-sub ga4-delta ga4-delta-${richting}">
    ${teken}${esc(formatteer(v.absoluut, k.eenheid, valuta))}
    ${v.procent != null ? `<span class="muted">(${teken}${esc(String(v.procent))}%)</span>` : ''}
    <span class="muted">t.o.v. ${esc(vergelijkLabel.toLowerCase())}</span>
  </p>`;
}

function formatteer(waarde, eenheid, valuta) {
  if (eenheid === 'geld') return fmtGeld(waarde, valuta);
  if (eenheid === 'procent') return fmtProcent(waarde);
  return fmtGetal(waarde);
}

/* -------------------------------------------------------------- tabellen -- */

function acquisitieBlok(data, valuta) {
  const tabelData = data.tabellen?.kanaal;
  if (!tabelData?.rijen?.length) return '';
  return `
    <section class="card" id="ga4-acquisitie">
      <h2>Acquisitie</h2>
      <p class="muted">
        Waar de bezoekers vandaan kwamen, gerangschikt op wat het oplevert en niet op
        verkeer. Dit is sessie-acquisitie: het kanaal waaraan de sessie wordt toegekend,
        niet waar de gebruiker ooit voor het eerst vandaan kwam.
      </p>
      ${doorsnedeTabelHtml(tabelData, data, valuta)}
    </section>`;
}

function landingspaginaBlok(data, valuta) {
  const tabelData = data.tabellen?.landingspagina;
  if (!tabelData?.rijen?.length) return '';
  return `
    <section class="card" id="ga4-landingspaginas">
      <h2>Landingspagina's</h2>
      <p class="muted">
        De pagina waarop het bezoek begon. Zonder querystring, zodat dezelfde pagina niet
        over tientallen rijen versnippert en er geen parameters worden getoond die niet
        nodig zijn.
      </p>
      ${doorsnedeTabelHtml(tabelData, data, valuta, { toonHost: true })}
    </section>`;
}

function apparaatEnLocatie(data, valuta) {
  const apparaat = data.tabellen?.apparaat;
  const land = data.tabellen?.land;
  if (!apparaat?.rijen?.length && !land?.rijen?.length) return '';
  return `
    <section class="card" id="ga4-apparaten">
      <h2>Apparaten en locaties</h2>
      ${apparaat?.rijen?.length ? `
        <h3>Apparaat</h3>
        <p class="muted">
          Een verschil tussen apparaten is nog geen technisch probleem: mobiel en desktop
          verschillen ook in wie er komt en via welk kanaal.
        </p>
        ${doorsnedeTabelHtml(apparaat, data, valuta)}` : ''}
      ${land?.rijen?.length ? uitklap('Landen',
        doorsnedeTabelHtml(land, data, valuta), { samenvatting: `${land.rijen.length} landen` }) : ''}
    </section>`;
}

/**
 * Eén doorsnedetabel: sorteerbaar, met de vorige periode ernaast.
 *
 * De verandering staat per rij en niet alleen bij de KPI erboven. Een kanaal
 * dat halveerde terwijl het totaal gelijk bleef is de bevinding, en in een
 * tabel zonder vergelijking is dat onzichtbaar -- dan zie je alleen een kanaal
 * dat kleiner is dan een ander.
 *
 * Sorteren gaat op de onderliggende waarde en niet op de weergegeven tekst.
 * `€ 1.225,65` sorteert als tekst tussen `€ 114` en `€ 130`, en dan staat de
 * grootste omzet ergens in het midden.
 */
function doorsnedeTabelHtml(tabelData, data, valuta, { toonHost = false, id = null } = {}) {
  const groepen = tabelData.groepen ?? [];
  const toonOmzet = groepen.includes('aankopen');
  const vergelijk = tabelData.heeftVergelijking;
  const label = data.vergelijking?.label ?? 'vorige periode';

  const kolommen = [
    {
      label: kolomLabel(tabelData.doorsnede), type: 'txt',
      waarde: (r) => r.segment,
      cel: (r) => `${esc(r.segment)}${r.onbekend
        ? ' <span class="ga4-onbekend" title="GA4 kon dit niet bepalen">(niet vastgesteld)</span>' : ''}`
        + (r.nieuw ? ' <span class="ga4-nieuw" title="Kwam in de vorige periode niet voor">nieuw</span>' : ''),
    },
    ...(toonHost ? [{ label: 'Hostnaam', type: 'txt', waarde: (r) => r.hostnaam ?? '', cel: (r) => esc(r.hostnaam ?? '—') }] : []),
    getalKolom('Sessies', (r) => r.sessies, fmtGetal),
    ...(vergelijk ? [veranderKolom(`Sessies ${label.toLowerCase()}`, (r) => r.sessiesVerandering, (r) => r.sessiesVorig, fmtGetal)] : []),
    getalKolom('Engagement', (r) => r.engagement, fmtProcent),
    ...groepen.flatMap((g) => {
      const naam = g === 'aankopen' ? 'Aankopen' : g === 'leads' ? 'Aanvragen' : 'Contactklikken';
      return [
        getalKolom(naam, (r) => r.resultaten?.[g]?.events, fmtGetal),
        ...(g === 'contactinteracties' ? [] : [
          getalKolom(`${g === 'aankopen' ? 'Aankoop' : 'Aanvraag'}ratio`, (r) => r.resultaten?.[g]?.ratio, fmtProcent),
          ...(vergelijk ? [veranderKolom(
            `${naam} t.o.v. ${label.toLowerCase()}`,
            (r) => r.resultaten?.[g]?.verandering,
            (r) => r.resultaten?.[g]?.vorig,
            fmtGetal
          )] : []),
        ]),
      ];
    }),
    ...(toonOmzet ? [
      getalKolom('Omzet', (r) => r.omzet, (v) => fmtGeld(v, valuta)),
      ...(vergelijk ? [veranderKolom(`Omzet t.o.v. ${label.toLowerCase()}`, (r) => r.omzetVerandering, (r) => r.omzetVorig, (v) => fmtGeld(v, valuta))] : []),
    ] : []),
  ];

  const dekking = tabelData.dekking;
  return `
    ${interactieveTabel(id ?? `ga4-${tabelData.doorsnede}`, kolommen, tabelData.rijen, {
      csvNaam: `ga4-${tabelData.doorsnede}`,
      leegTekst: 'Geen rijen voor deze periode.',
    })}
    ${dekking ? `<p class="ga4-dekking muted">${esc(dekking.tekst)}</p>` : ''}`;
}

/** Een getalkolom: rechts uitgelijnd, sorteert op de waarde en niet op de tekst. */
function getalKolom(label, lees, formatteer) {
  return {
    label, uitlijn: 'rechts', type: 'num',
    waarde: (r) => { const v = lees(r); return v == null ? '' : v; },
    cel: (r) => esc(formatteer(lees(r))),
  };
}

/**
 * Een kolom met de verandering tegenover de vorige periode.
 *
 * Sorteert op het absolute verschil en niet op het percentage: van 2 naar 1 is
 * vijftig procent en betekent niets, van 80 naar 60 is vijfentwintig procent en
 * kost twintig. Wie op impact wil sorteren, wil het eerste onderaan.
 *
 * Geen kleur. Een stijging is hier niet vanzelf goed: meer sessies op een
 * kanaal dat niets oplevert is geen vooruitgang.
 */
function veranderKolom(label, leesVerandering, leesVorig, formatteer) {
  return {
    label, uitlijn: 'rechts', type: 'num',
    waarde: (r) => { const v = leesVerandering(r); return v?.absoluut == null ? '' : v.absoluut; },
    cel: (r) => {
      const v = leesVerandering(r);
      const vorig = leesVorig(r);
      if (!v || v.absoluut == null) return '<span class="muted">—</span>';
      if (v.vanNul) return `<span class="ga4-vanaf-nul" title="De vorige periode stond op nul; een percentage zegt hier niets">vanaf nul</span>`;
      const teken = v.absoluut > 0 ? '+' : '';
      return `<span title="Was ${esc(formatteer(vorig))}">${teken}${esc(formatteer(v.absoluut))}`
        + `${v.procent != null ? ` <span class="muted">(${teken}${esc(String(v.procent))}%)</span>` : ''}</span>`;
    },
  };
}

function kolomLabel(doorsnede) {
  return {
    kanaal: 'Kanaal', landingspagina: 'Landingspagina', apparaat: 'Apparaat',
    land: 'Land', regio: 'Regio', bronMedium: 'Bron / medium', campagne: 'Campagne',
  }[doorsnede] ?? doorsnede;
}

/* ------------------------------------------------------------ verdieping -- */

function leadVerdieping(data) {
  if (data.klanttype !== 'leadgen' && data.klanttype !== 'beide') return '';
  const leads = data.doelen?.leads ?? [];
  const contact = data.doelen?.contactinteracties ?? [];
  if (!leads.length && !contact.length) return '';

  const perEvent = eventTotalen(data, 'leads');
  const perContact = eventTotalen(data, 'contactinteracties');

  return `
    <section class="card" id="ga4-leads">
      <h2>Leadgeneratie</h2>
      <p class="muted">
        Bevestigde aanvragen en contactinteracties, apart gehouden. Een klik op een
        telefoonnummer of e-mailadres is een signaal van interesse; er is niet gemeten of
        er daadwerkelijk contact volgde. Ze meetellen als aanvraag maakt het aantal leads
        een veelvoud van de werkelijkheid.
      </p>
      ${perEvent.length ? `
        <h3>Aanvragen per type</h3>
        ${tabel([{ label: 'Gebeurtenis' }, { label: 'Aantal', klasse: 'num' }],
          perEvent.map((e) => [esc(e.event), fmtGetal(e.aantal)]))}
        ${leads.length > 1
          ? `<p class="ga4-dekking muted">
               Dit zijn gebeurtenissen, geen unieke aanvragers: één bezoeker kan meer dan één
               formulier versturen. Het aandeel sessies met een aanvraag hierboven telt elke
               sessie wél één keer.
             </p>`
          : ''}` : ''}
      ${perContact.length ? `
        <h3>Contactinteracties</h3>
        ${tabel([{ label: 'Gebeurtenis' }, { label: 'Aantal', klasse: 'num' }],
          perContact.map((e) => [esc(e.event), fmtGetal(e.aantal)]))}` : ''}
      <p class="ga4-dekking muted">
        Over leadkwaliteit, verkoopkansen of gesloten deals staat hier niets: dat vraagt een
        CRM-koppeling, en die is er niet.
      </p>
    </section>`;
}

function ecommerceVerdieping(data, valuta) {
  if (data.klanttype !== 'ecommerce' && data.klanttype !== 'beide') return '';
  const stappen = data.stappen ?? [];
  const producten = data.producten?.rijen ?? [];
  if (!stappen.length && !producten.length) return '';

  return `
    <section class="card" id="ga4-producten">
      <h2>E-commerce</h2>
      ${stappen.length ? `
        <h3>Het aankoopproces</h3>
        <p class="muted">
          Stapvolumes, geen trechter. Er staan geen uitvalpercentages bij: losse
          eventaantallen zeggen niet dat dezelfde bezoekers deze stappen op volgorde
          doorliepen. Iemand kan tien producten bekijken en er één kopen, of rechtstreeks
          in de winkelwagen landen.
        </p>
        ${tabel(
          [{ label: 'Stap' }, { label: 'Gebeurtenissen', klasse: 'num' }, { label: 'Sessies', klasse: 'num' }],
          stappen.map((s) => [
            esc(s.label),
            s.gemeten ? fmtGetal(s.aantal) : '<span class="muted">niet gemeten</span>',
            s.gemeten ? fmtGetal(s.sessies) : '<span class="muted">—</span>',
          ])
        )}
        ${stappen.some((s) => !s.gemeten)
          ? `<p class="ga4-dekking muted">
               De stappen zonder cijfer worden niet gemeten. Dat is een gat in de meting, geen
               nul: er is niet vastgesteld dat niemand die stap zette.
             </p>`
          : ''}` : ''}
      ${producten.length ? `
        <h3>Producten</h3>
        <p class="muted">
          Itemaantallen, geen sessies en geen orders: &quot;bekeken&quot; telt bekeken
          artikelen en &quot;gekocht&quot; telt stuks. Klik op een kolomkop om te sorteren --
          op omzet zie je welk artikel het meest opleverde, op koopratio welk artikel
          bekeken wordt zonder dat het verkoopt.
        </p>
        ${productTabelHtml(data, valuta)}` : ''}
    </section>`;
}

/**
 * De producttabel.
 *
 * Omzet staat hier naast het aantal stuks en niet in plaats daarvan: "welk
 * product leverde het meeste op" en "welk product ging het vaakst over de
 * toonbank" zijn verschillende vragen, en bij een assortiment met uiteenlopende
 * prijzen geven ze verschillende antwoorden.
 *
 * `koopratio` is nadrukkelijk geen conversieratio: dit deelt itemaantallen door
 * itemaantallen. Een bezoeker die een artikel drie keer bekijkt telt drie keer.
 */
function productTabelHtml(data, valuta) {
  const bron = data.producten;
  if (!bron?.rijen?.length) return '';
  const vergelijk = bron.heeftVergelijking;
  const label = data.vergelijking?.label ?? 'vorige periode';

  const kolommen = [
    {
      label: 'Product', type: 'txt',
      waarde: (p) => p.product,
      cel: (p) => `${esc(p.product)}${p.nieuw
        ? ' <span class="ga4-nieuw" title="Kwam in de vorige periode niet voor">nieuw</span>' : ''}`,
    },
    getalKolom('Bekeken', (p) => p.bekeken, fmtGetal),
    getalKolom('In winkelwagen', (p) => p.inWinkelwagen, fmtGetal),
    getalKolom('Gekocht', (p) => p.gekocht, fmtGetal),
    ...(vergelijk ? [veranderKolom(`Gekocht t.o.v. ${label.toLowerCase()}`, (p) => p.gekochtVerandering, (p) => p.gekochtVorig, fmtGetal)] : []),
    getalKolom('Koopratio', (p) => p.koopratio, fmtProcent),
    getalKolom('Omzet', (p) => p.omzet, (v) => fmtGeld(v, valuta)),
    ...(vergelijk ? [veranderKolom(`Omzet t.o.v. ${label.toLowerCase()}`, (p) => p.omzetVerandering, (p) => p.omzetVorig, (v) => fmtGeld(v, valuta))] : []),
  ];

  return interactieveTabel('ga4-producten-tabel', kolommen, bron.rijen, {
    csvNaam: 'ga4-producten',
    leegTekst: 'Geen producten in deze periode.',
  });
}

function eventTotalen(data, groep) {
  const perEvent = new Map();
  for (const tabelData of Object.values(data.tabellen ?? {})) {
    for (const rij of tabelData.rijen ?? []) {
      for (const e of rij.resultaten?.[groep]?.perEvent ?? []) {
        perEvent.set(e.event, (perEvent.get(e.event) ?? 0) + (e.aantal ?? 0));
      }
    }
    // Eén doorsnede is genoeg: elke doorsnede dekt hetzelfde verkeer, en ze
    // allemaal optellen zou elke gebeurtenis vier keer tellen.
    break;
  }
  return [...perEvent.entries()]
    .map(([event, aantal]) => ({ event, aantal }))
    .sort((a, b) => b.aantal - a.aantal);
}

/* ---------------------------------------------------------- instellingen -- */

function instellingenBlok(data) {
  const d = data.doelen ?? {};
  const rij = (label, lijst) => (lijst?.length
    ? `<dt>${esc(label)}</dt><dd>${lijst.map((e) => `<code>${esc(e)}</code>`).join(', ')}</dd>`
    : '');

  return uitklap('Instellingen en definities', `
    <dl class="ga4-instellingen">
      <dt>Klanttype</dt><dd>${esc(TYPELABEL[data.klanttype] ?? data.klanttype)}</dd>
      ${data.prioriteit ? `<dt>Voorrang</dt><dd>${esc(data.prioriteit === 'leads' ? 'Leadgeneratie' : 'E-commerce')}</dd>` : ''}
      ${rij('Telt als aanvraag', d.leads)}
      ${rij('Telt als contactinteractie', d.contactinteracties)}
      ${rij('Telt als aankoop', d.aankopen)}
      <dt>Property</dt>
      <dd>${esc([data.property?.naam, data.property?.id, data.property?.tijdzone, data.property?.valuta]
        .filter(Boolean).join(' · ') || '—')}</dd>
      <dt>Laatst opgehaald</dt>
      <dd>${esc(data.synchronisatie?.opgehaaldOp
        ? new Date(data.synchronisatie.opgehaaldOp).toLocaleString('nl-NL')
        : 'onbekend')}</dd>
    </dl>
    <p class="muted">
      Deze keuzes bepalen welke KPI's, rapporten en inzichten je hierboven ziet. Niet elke
      gemeten gebeurtenis telt mee: sleutelgebeurtenissen in GA4 staan vaak op stappen als
      een productweergave, en die optellen als conversie levert ratio's op die nergens naar
      verwijzen.
    </p>
  `, { id: 'ga4-instellingen' });
}
