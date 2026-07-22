/**
 * Awarenessdashboard.
 *
 * Awareness wordt hier niet beoordeeld alsof het leadgeneratie is. Er staat
 * geen kosten per lead en geen conversieratio als hoofdmaat: een campagne die
 * bekendheid opbouwt, levert die bekendheid niet in dezelfde periode als
 * conversies af.
 *
 * Wat wél telt: hoeveel mensen je bereikt, hoe vaak ze dezelfde boodschap
 * krijgen, hoeveel aandacht ze eraan geven en of dat verslechtert. De
 * combinatie van oplopende frequentie, dalende aandacht en stijgende kosten is
 * het patroon waaruit vermoeidheid kán blijken. Kán, want frequentie alleen
 * bewijst dat niet, en dat staat er ook zo.
 *
 * BEREIK EN OPTELLEN
 * Unieke personen zijn niet over dagen op te tellen. Het dashboard toont daarom
 * het dagbereik en zegt er expliciet bij dat het unieke bereik over de hele
 * periode niet gemeten wordt. Een getal dat suggereert dat het wél gemeten is,
 * zou hier het gevaarlijkste getal op het scherm zijn.
 */

import { lineChart, barChart } from '../charts.js';
import {
  fmt, esc, kpi, kpiMetriek, tabel, figure, renderBudget, ontbrekendeCel, metriekKolom,
} from './components.js';
import { renderInzichten } from './insight-cards.js';
import { toonKorteDatum } from '../filters/period.js';

const nf = new Intl.NumberFormat('nl-NL');
const cf0 = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

const vgl = (d) => (d.vergelijkingActief ? d.vergelijking.label.toLowerCase() : 'de vorige periode');

export function renderAwarenessClient(dashboard) {
  if (!dashboard.heeftData) {
    return `<section class="card leeg-blok" id="geenDataBlok">
      <h2>Geen data voor deze selectie</h2>
      <p class="muted">
        Er zijn geen gegevens voor deze periode en kanaalselectie. Kies een
        langere periode of voeg een kanaal toe.
      </p>
    </section>`;
  }

  const { totalen, deltas } = dashboard;
  const label = vgl(dashboard);
  const m = (key, opties = {}) => kpiMetriek(totalen, key, deltas, { vergelijkingLabel: label, ...opties });

  return `
    ${renderMeldingen(dashboard)}
    ${renderInzichten(dashboard.inzichten, { titel: 'Wat er is veranderd in bereik en aandacht' })}

    <section class="card">
      <h2>Bereik en levering</h2>
      <p class="muted">
        Hoeveel mensen de campagne bereikt en hoe vaak zij dezelfde boodschap zien.
      </p>
      <div class="kpi-row">
        ${m('impressions')}
        ${m('reach', { label: 'Bereikte personen per dag' })}
        ${m('frequentie')}
        ${m('cpm')}
        ${m('spend')}
        ${kpi('Uniek bereik in de periode', 'Niet gemeten', 'Unieke personen zijn niet over dagen op te tellen', 'neutraal',
          { uitleg: 'De advertentiekanalen leveren dagbereik. Het aantal unieke personen over de hele periode is lager dan de som van de dagen en wordt niet gemeten.' })}
      </div>
    </section>

    <section class="card">
      <h2>Aandacht en interactie</h2>
      <p class="muted">
        Of mensen iets met de boodschap doen, niet alleen of ze hem gezien hebben.
      </p>
      <div class="kpi-row">
        ${m('videoStarts')}
        ${m('videoVoltooiing')}
        ${m('gemKijktijd', { label: 'Gemiddelde kijktijd in seconden' })}
        ${m('engagements')}
        ${m('engagementRatio')}
        ${m('sessions', { label: 'Websitebezoeken vanuit de campagne' })}
      </div>
    </section>

    ${renderVerzadiging(dashboard)}
    ${renderBudget(dashboard)}
    ${renderOntwikkeling(dashboard)}
    ${renderKanalen(dashboard)}
    ${renderOndersteunend(dashboard)}
  `;
}

function renderMeldingen(dashboard) {
  if (!dashboard.meldingen.length) return '';
  return `<div class="banner banner-info datakwaliteit" role="status">
    <strong>Datakwaliteit</strong>
    <ul>${dashboard.meldingen.map((m) => `<li>${esc(m.tekst)}</li>`).join('')}</ul>
  </div>`;
}

/**
 * De vier signalen van verzadiging naast elkaar.
 * Er staat nadrukkelijk niet "de advertenties zijn versleten": dat is een
 * conclusie die deze data niet draagt.
 */
function renderVerzadiging(dashboard) {
  const { totalen, vorigeTotalen, deltas } = dashboard;

  const rij = (key, label, richtingSlecht) => {
    const delta = deltas[key];
    const beweegtVerkeerd = delta?.status === richtingSlecht;
    return [
      esc(label),
      totalen[key] == null ? ontbrekendeCel('niet_gemeten') : formatteer(key, totalen[key]),
      vorigeTotalen?.[key] == null ? ontbrekendeCel('onvoldoende_data') : formatteer(key, vorigeTotalen[key]),
      delta && ['gestegen', 'gedaald'].includes(delta.status)
        ? `<span class="trend-${beweegtVerkeerd ? 'negatief' : 'positief'}">${esc(delta.tekst)}</span>`
        : '<span class="muted">Niet vergelijkbaar</span>',
      beweegtVerkeerd ? '<span class="trend-negatief">Ja</span>' : 'Nee',
    ];
  };

  return `<section class="card">
    <h2>Signalen van verzadiging</h2>
    <p class="muted">
      Vier signalen die samen kunnen wijzen op afnemende creatieve werking. Elk
      signaal apart zegt weinig; de combinatie is wat telt.
    </p>
    <div class="table-scroll">
      ${tabel(
        ['Signaal', 'Deze periode', 'Vorige periode', 'Verandering', 'Beweegt de verkeerde kant op'],
        [
          rij('frequentie', 'Gemiddelde frequentie', 'gestegen'),
          rij('engagementRatio', 'Interactieratio', 'gedaald'),
          rij('cpm', 'Kosten per duizend vertoningen', 'gestegen'),
          rij('videoVoltooiing', 'Videovoltooiing', 'gedaald'),
        ]
      )}
    </div>
    <p class="muted note">
      Advertentievermoeidheid is met deze gegevens niet met zekerheid vast te
      stellen. Een oplopende frequentie kan ook betekenen dat het budget binnen
      een kleinere doelgroep wordt besteed.
    </p>
  </section>`;
}

function formatteer(key, waarde) {
  if (key === 'cpm') return fmt.euro2(waarde);
  if (key === 'frequentie') return fmt.ratio(waarde);
  if (['engagementRatio', 'videoVoltooiing'].includes(key)) return fmt.procent(waarde);
  return fmt.getal(waarde);
}

function punteLabel(punt) {
  return punt.tot && punt.tot !== punt.date
    ? `${toonKorteDatum(punt.date)} – ${toonKorteDatum(punt.tot)}`
    : toonKorteDatum(punt.date);
}

function renderOntwikkeling(dashboard) {
  const { punten, stap } = dashboard.reeks;
  const conclusie = dashboard.deltas.reach && ['gestegen', 'gedaald'].includes(dashboard.deltas.reach.status)
    ? `Het dagbereik ${dashboard.deltas.reach.status === 'gestegen' ? 'groeide' : 'liep terug'} met ${Math.abs(dashboard.deltas.reach.procent).toFixed(0)} procent`
    : null;

  return figure(
    'chart-bereik',
    'Bereik en vertoningen in de geselecteerde periode',
    `Hoe het bereik en het aantal vertoningen zich verhouden. Weergave per ${stap}.`,
    tabel(
      ['Periode', metriekKolom('impressions'), metriekKolom('reach'), metriekKolom('spend')],
      punten.map((p) => [
        esc(punteLabel(p)),
        p.impressions == null ? ontbrekendeCel('niet_gemeten') : fmt.getal(p.impressions),
        p.reach == null ? ontbrekendeCel('niet_gemeten') : fmt.getal(p.reach),
        p.spend == null ? ontbrekendeCel('niet_gemeten') : fmt.euro(p.spend),
      ])
    ),
    'Advertentiekanalen',
    280,
    { conclusie }
  );
}

function renderKanalen(dashboard) {
  return figure(
    'chart-aandacht',
    'Vertoningen per kanaal',
    'Waar de zichtbaarheid vandaan komt binnen de geselecteerde periode.',
    tabel(
      ['Kanaal', metriekKolom('impressions'), metriekKolom('reach'), metriekKolom('frequentie'),
        metriekKolom('cpm'), metriekKolom('spend')],
      dashboard.kanaalRijen.map((k) => [
        esc(k.label),
        fmt.getal(k.impressions),
        k.reach == null ? ontbrekendeCel('niet_gemeten') : fmt.getal(k.reach),
        k.frequentie == null ? ontbrekendeCel('onvoldoende_data') : fmt.ratio(k.frequentie),
        k.cpm == null ? ontbrekendeCel('onvoldoende_data') : fmt.euro2(k.cpm),
        fmt.euro(k.spend),
      ])
    ),
    'Advertentiekanalen'
  );
}

function renderOndersteunend(dashboard) {
  const { totalen, deltas } = dashboard;

  return `<section class="card">
    <h2>Ondersteunende resultaten</h2>
    <p class="muted">
      Awareness levert zelden in dezelfde periode directe conversies op. Deze
      cijfers laten zien of er beweging is, zonder die aan de campagne toe te
      schrijven.
    </p>
    <div class="kpi-row">
      ${kpiMetriek(totalen, 'brandedSearchClicks', deltas, { vergelijkingLabel: vgl(dashboard) })}
      ${kpiMetriek(totalen, 'sessions', deltas, { label: 'Websitebezoeken', vergelijkingLabel: vgl(dashboard) })}
      ${kpi('Toegeschreven conversies', 'Niet van toepassing', 'Deze campagne is niet op conversie ingericht', 'neutraal',
        { uitleg: 'Er is geen conversiedoel ingesteld voor deze campagne. Conversies die later plaatsvinden, zijn niet aan deze vertoningen toe te wijzen.' })}
    </div>
    <p class="muted note">
      Merkzoekopdrachten worden ook door andere activiteiten beïnvloed. Samenhang
      met de campagne is hier geen bewijs van oorzaak.
    </p>
  </section>`;
}

/* ---------------------------------------------------------------
   Grafieken
   --------------------------------------------------------------- */

export function drawAwarenessCharts(dashboard) {
  if (!dashboard?.heeftData) return;
  const punten = dashboard.reeks.punten;
  const labels = punten.map(punteLabel);

  lineChart('chart-bereik', {
    labels,
    series: [
      { label: 'Vertoningen', data: punten.map((p) => p.impressions) },
      { label: 'Bereikte personen per dag', data: punten.map((p) => p.reach) },
    ],
    valueFormatter: (v) => nf.format(Math.round(v)),
  });

  const kanalen = [...dashboard.kanaalRijen].sort((a, b) => (b.impressions ?? 0) - (a.impressions ?? 0));
  barChart('chart-aandacht', {
    labels: kanalen.map((k) => k.label),
    horizontal: true,
    series: [{ label: 'Vertoningen', data: kanalen.map((k) => k.impressions ?? 0) }],
    valueFormatter: (v) => nf.format(Math.round(v)),
  });
}

export { cf0 };
