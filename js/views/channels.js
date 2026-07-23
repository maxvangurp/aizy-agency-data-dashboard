/**
 * Kanaalpagina's.
 *
 * Ieder kanaal krijgt een eigen pagina met eigen tabs, want de bouwstenen van
 * Google Ads en Meta Ads heten anders en betekenen iets anders. Een
 * advertentiegroep is geen advertentieset, en doen alsof van wel maakt het
 * dashboard onbruikbaar voor wie in het advertentieplatform werkt.
 *
 * LEGE TABS BESTAAN NIET
 * Een tab voor een bron die niet gekoppeld is, toont geen lege tabel maar de
 * koppelstatus met uitleg: wat er ontbreekt, wat dat betekent voor de cijfers
 * en wat ervoor nodig is. Een lege tabel wordt gelezen als "geen resultaat", en
 * dat is iets anders dan "niet gemeten".
 */

import { fmt, esc, tabel, badge, ontbrekendeCel, metriekKolom } from './components.js';
import { emptyState, koppelStatus } from '../ui/states.js';
import { KANALEN, KanaalSoort, KanaalStatus, kanaalLabel } from '../filters/channels.js';
import { KANAALNAMEN } from '../ui/navigation.js';
import { LABELS } from '../terminology.js';

/**
 * De tabs per kanaal.
 *
 * `bron` vertelt waar de tab zijn gegevens vandaan haalt. Tabs met bron `geen`
 * hebben in deze demo nog geen databron en tonen de koppelstatus; ze staan er
 * wel, omdat ze bij het kanaal horen en de gebruiker moet weten wat er komt.
 */
export const KANAAL_TABS = {
  alle: [
    { key: 'overzicht', label: 'Overzicht', bron: 'kanalen' },
    { key: 'vergelijking', label: 'Vergelijking', bron: 'kanalen' },
    { key: 'budget', label: 'Budget', bron: 'budget' },
  ],
  google_ads: [
    { key: 'overzicht', label: 'Overzicht', bron: 'kanaal' },
    { key: 'campagnes', label: 'Campagnes', bron: 'campagnes' },
    { key: 'advertentiegroepen', label: 'Advertentiegroepen', bron: 'advertentiegroepen' },
    { key: 'zoekwoorden', label: 'Zoekwoorden', bron: 'zoekwoorden' },
    { key: 'zoektermen', label: 'Zoektermen', bron: 'geen' },
    { key: 'advertenties', label: 'Advertenties', bron: 'geen' },
    { key: 'conversies', label: 'Conversies', bron: 'conversies' },
    { key: 'budget', label: 'Budget', bron: 'budget' },
  ],
  meta_ads: [
    { key: 'overzicht', label: 'Overzicht', bron: 'kanaal' },
    { key: 'campagnes', label: 'Campagnes', bron: 'geen' },
    { key: 'advertentiesets', label: 'Advertentiesets', bron: 'geen' },
    { key: 'advertenties', label: 'Advertenties', bron: 'geen' },
    { key: 'creatives', label: 'Creatives', bron: 'geen' },
    { key: 'doelgroepen', label: 'Doelgroepen', bron: 'geen' },
    { key: 'conversies', label: 'Conversies', bron: 'conversies' },
    { key: 'budget', label: 'Budget', bron: 'budget' },
  ],
  microsoft_ads: [
    { key: 'overzicht', label: 'Overzicht', bron: 'kanaal' },
    { key: 'campagnes', label: 'Campagnes', bron: 'geen' },
    { key: 'zoekwoorden', label: 'Zoekwoorden', bron: 'geen' },
    { key: 'advertenties', label: 'Advertenties', bron: 'geen' },
    { key: 'conversies', label: 'Conversies', bron: 'conversies' },
    { key: 'budget', label: 'Budget', bron: 'budget' },
  ],
  linkedin_ads: [
    { key: 'overzicht', label: 'Overzicht', bron: 'kanaal' },
    { key: 'campagnes', label: 'Campagnes', bron: 'geen' },
    { key: 'doelgroepen', label: 'Doelgroepen', bron: 'geen' },
    { key: 'advertenties', label: 'Advertenties', bron: 'geen' },
    { key: 'conversies', label: 'Conversies', bron: 'conversies' },
    { key: 'budget', label: 'Budget', bron: 'budget' },
  ],
  ga4: [
    { key: 'overzicht', label: 'Overzicht', bron: 'meetbron' },
    { key: 'kanalen', label: 'Verkeersbronnen', bron: 'geen' },
    { key: 'landingspaginas', label: 'Landingspagina’s', bron: 'geen' },
    { key: 'apparaten', label: 'Apparaten', bron: 'geen' },
    { key: 'conversies', label: 'Conversies', bron: 'conversies' },
  ],
};

export const KANAALPAGINAS = ['alle', 'google_ads', 'meta_ads', 'microsoft_ads', 'linkedin_ads', 'ga4'];

export function kanaalTabs(kanaal) {
  return KANAAL_TABS[kanaal] ?? KANAAL_TABS.alle;
}

export function kanaalTitel(kanaal) {
  return kanaal === 'alle' ? 'Alle kanalen' : KANAALNAMEN[kanaal] ?? kanaalLabel(kanaal);
}

/* ---------------------------------------------------------------
   Agencyweergave
   --------------------------------------------------------------- */

export function renderKanaalpagina({
  kanaal, tab, overzicht, details, geselecteerd, samenvattingen, filters,
}) {
  const tabs = kanaalTabs(kanaal);
  const actief = tabs.find((t) => t.key === tab) ?? tabs[0];

  if (kanaal !== 'alle' && !geselecteerd) {
    return `<section class="card">
      ${koppelStatus({
        bron: kanaalTitel(kanaal),
        status: KanaalStatus.NIET_GEKOPPELD,
        uitleg: `${kanaalTitel(kanaal)} staat niet in de huidige kanaalselectie. Voeg het kanaal toe in de contextbalk om de cijfers te zien.`,
      })}
    </section>`;
  }

  switch (actief.bron) {
    case 'kanalen': return renderAlleKanalen(overzicht, actief.key);
    case 'kanaal': return renderEenKanaal(overzicht, kanaal);
    case 'meetbron': return renderMeetbron(kanaal, samenvattingen);
    case 'campagnes': return renderVerdeling(details.campagnes, 'campagnes', kanaal);
    case 'advertentiegroepen': return renderVerdeling(details.advertentiegroepen, 'advertentiegroepen', kanaal);
    case 'zoekwoorden': return renderVerdeling(details.zoekwoorden, 'zoekwoorden', kanaal);
    case 'conversies': return renderConversietab(kanaal, overzicht, geselecteerd);
    case 'budget': return renderBudgettab(samenvattingen, kanaal, overzicht);
    default: return renderNogNietGekoppeld(kanaal, actief.label);
  }
}

function renderAlleKanalen(overzicht, tabKey) {
  const kanalen = overzicht.kanalen.filter((k) => k.aantalKlanten > 0);

  if (!kanalen.length) {
    return emptyState({
      titel: 'Geen kanalen met gegevens',
      uitleg: 'Binnen deze periode en selectie levert geen enkel kanaal gegevens.',
      id: 'kanalenLeeg',
    });
  }

  const totaleSpend = kanalen.reduce((t, k) => t + (k.spend ?? 0), 0);

  if (tabKey === 'vergelijking') {
    return `<section class="card">
      <h2>Kanalen vergeleken</h2>
      <p class="muted">
        Uitgaven, vertoningen en klikken zijn over klanten heen op te tellen.
        Omzet en leads staan apart, omdat een som van omzet en leads geen
        betekenis heeft.
      </p>
      <div class="table-scroll">
        ${tabel(
          ['Kanaal', 'Klanten', metriekKolom('spend', 'Uitgaven'), 'Aandeel in uitgaven',
            metriekKolom('impressions'), metriekKolom('clicks'), 'Omzet (e-commerce)', 'Leads (leadgeneratie)'],
          kanalen.map((k) => [
            `<a class="link" href="#/agency/channels/${esc(k.key)}">${esc(k.label)}</a>`,
            `${k.aantalKlanten}${k.zonderKoppeling ? `<br><span class="muted klein">${k.zonderKoppeling} zonder dit kanaal</span>` : ''}`,
            fmt.euro(k.spend),
            totaleSpend ? fmt.procent((k.spend / totaleSpend) * 100) : ontbrekendeCel('onvoldoende_data'),
            fmt.getal(k.impressions),
            fmt.getal(k.clicks),
            k.ecommerceKlanten ? fmt.euro(k.revenue) : ontbrekendeCel('niet_van_toepassing'),
            k.leadgenKlanten ? fmt.getal(k.leads) : ontbrekendeCel('niet_van_toepassing'),
          ])
        )}
      </div>
    </section>`;
  }

  return `
    <div class="kanaalkaarten">
      ${kanalen.map((k) => `<a class="card kanaalkaart" href="#/agency/channels/${esc(k.key)}">
        <span class="kanaalkaart-naam">${esc(k.label)}</span>
        <span class="kanaalkaart-waarde">${esc(fmt.euro(k.spend))}</span>
        <span class="muted klein">${k.aantalKlanten} ${k.aantalKlanten === 1 ? 'klant' : 'klanten'} · ${esc(fmt.getal(k.clicks))} klikken</span>
      </a>`).join('')}
    </div>

    <section class="card">
      <h2>Koppelstatus per kanaal</h2>
      <p class="muted">Kanalen zonder klanten in deze selectie staan hier met de reden erbij.</p>
      <div class="koppelstatus-grid">
        ${overzicht.kanalen.map((k) => koppelStatus({
          bron: k.label,
          status: k.aantalKlanten ? KanaalStatus.GEKOPPELD : KanaalStatus.NIET_GEKOPPELD,
          uitleg: k.aantalKlanten
            ? `${k.aantalKlanten} van je klanten adverteert via ${k.label} binnen deze periode.`
            : `Geen enkele klant in deze selectie adverteert via ${k.label} binnen deze periode.`,
        })).join('')}
      </div>
    </section>`;
}

function renderEenKanaal(overzicht, kanaal) {
  const k = overzicht.kanalen.find((x) => x.key === kanaal);

  if (!k || !k.aantalKlanten) {
    return `<section class="card">
      ${koppelStatus({
        bron: kanaalTitel(kanaal),
        status: KanaalStatus.NIET_GEKOPPELD,
        uitleg: `Geen enkele klant waartoe je toegang hebt, adverteert via ${kanaalTitel(kanaal)} binnen deze periode.`,
      })}
    </section>`;
  }

  return `
    <div class="kpi-row">
      <article class="card kpi" data-label="Uitgaven">
        <span class="kpi-label">Uitgaven</span>
        <span class="kpi-value">${esc(fmt.euro(k.spend))}</span>
        <span class="kpi-sub">over ${k.aantalKlanten} ${k.aantalKlanten === 1 ? 'klant' : 'klanten'}</span>
      </article>
      <article class="card kpi" data-label="Vertoningen">
        <span class="kpi-label">Vertoningen</span>
        <span class="kpi-value">${esc(fmt.getal(k.impressions))}</span>
        <span class="kpi-sub">binnen deze periode</span>
      </article>
      <article class="card kpi" data-label="Klikken">
        <span class="kpi-label">Klikken</span>
        <span class="kpi-value">${esc(fmt.getal(k.clicks))}</span>
        <span class="kpi-sub">${k.impressions ? `${((k.clicks / k.impressions) * 100).toFixed(2)} procent doorklikratio` : 'geen vertoningen'}</span>
      </article>
      <article class="card kpi" data-label="Resultaat">
        <span class="kpi-label">Resultaat</span>
        <span class="kpi-value">${k.ecommerceKlanten ? esc(fmt.euro(k.revenue)) : esc(fmt.getal(k.leads))}</span>
        <span class="kpi-sub">${k.ecommerceKlanten ? `omzet over ${k.ecommerceKlanten} e-commerceklanten` : `leads over ${k.leadgenKlanten} leadgeneratieklanten`}</span>
      </article>
    </div>

    <section class="card">
      <h2>Per klant</h2>
      <div class="table-scroll">
        ${tabel(
          [LABELS.klant, LABELS.dashboardtype, metriekKolom('spend', 'Uitgaven'),
            metriekKolom('impressions'), metriekKolom('clicks'), 'Primair resultaat'],
          k.perKlant.map((r) => [
            `<a class="link" href="#/agency/clients/${esc(r.client.id)}">${esc(r.client.name)}</a>`,
            badge(r.model === 'ecommerce' ? 'E-commerce' : r.model === 'leadgen' ? 'Leadgeneratie' : 'Awareness', 'muted'),
            fmt.euro(r.totalen.spend),
            fmt.getal(r.totalen.impressions),
            fmt.getal(r.totalen.clicks),
            r.model === 'ecommerce'
              ? `${fmt.euro(r.totalen.revenue)} omzet`
              : r.model === 'leadgen'
                ? `${fmt.getal(r.totalen.leads)} leads`
                : `${fmt.getal(r.totalen.impressions)} vertoningen`,
          ])
        )}
      </div>
      ${k.zonderKoppeling ? `<p class="muted note">
        ${k.zonderKoppeling} ${k.zonderKoppeling === 1 ? 'klant heeft' : 'klanten hebben'} dit kanaal niet.
        Die tellen niet als nul mee, maar staan buiten deze cijfers.
      </p>` : ''}
    </section>`;
}

/* ---------------------------------------------------------------
   Detailtabellen
   --------------------------------------------------------------- */

function renderVerdeling(rijen, soort, kanaal) {
  if (!rijen?.length) return renderNogNietGekoppeld(kanaal, soort);

  const kolommen = {
    campagnes: ['Campagne', LABELS.klant, 'Type', 'Kosten', 'Klikken', 'Vertoningen', 'Resultaat'],
    advertentiegroepen: ['Advertentiegroep', LABELS.klant, 'Campagne', 'Kosten', 'Klikken', 'Resultaat'],
    zoekwoorden: ['Zoekwoord', LABELS.klant, 'Matchtype', 'Kosten', 'Klikken', 'Resultaat'],
  }[soort];

  const rij = (r) => {
    const resultaat = r.conversies != null
      ? `${fmt.getal(r.conversies)} conversies`
      : r.leads != null ? `${fmt.getal(r.leads)} leads` : ontbrekendeCel('niet_gemeten');

    if (soort === 'campagnes') {
      return [esc(r.naam), esc(r.klantNaam), esc(r.type ?? ''), fmt.euro(r.kosten), fmt.getal(r.klikken), fmt.getal(r.vertoningen), resultaat];
    }
    if (soort === 'advertentiegroepen') {
      return [esc(r.groep), esc(r.klantNaam), esc(r.campagne ?? ''), fmt.euro(r.kosten), fmt.getal(r.klikken), resultaat];
    }
    return [esc(r.zoekwoord), esc(r.klantNaam), esc(r.matchtype ?? ''), fmt.euro(r.kosten), fmt.getal(r.klikken), resultaat];
  };

  return `<section class="card">
    <h2>${esc(soort.charAt(0).toUpperCase() + soort.slice(1))}</h2>
    <p class="muted">
      Over alle klanten waartoe je toegang hebt, geschaald naar de geselecteerde
      periode en kanaalselectie.
    </p>
    <div class="table-scroll">${tabel(kolommen, rijen.slice(0, 60).map(rij))}</div>
    ${rijen.length > 60 ? `<p class="muted note">De 60 grootste van ${rijen.length} rijen worden getoond. Filter op klant om de rest te zien.</p>` : ''}
  </section>`;
}

function renderConversietab(kanaal, overzicht, geselecteerd) {
  const k = overzicht.kanalen.find((x) => x.key === kanaal);

  if (!k?.aantalKlanten) return renderNogNietGekoppeld(kanaal, 'conversies');

  return `<section class="card">
    <h2>Conversies via ${esc(kanaalTitel(kanaal))}</h2>
    <p class="muted">
      Conversies worden per klant gemeten en per bedrijfsmodel gescheiden
      gehouden. Een optelsom van aankopen en leads bestaat niet.
    </p>
    <div class="table-scroll">
      ${tabel(
        [LABELS.klant, LABELS.dashboardtype, 'Conversies', 'Kosten per conversie'],
        k.perKlant.map((r) => {
          const aantal = r.model === 'ecommerce' ? r.totalen.purchases : r.model === 'leadgen' ? r.totalen.leads : null;
          const kosten = aantal ? r.totalen.spend / aantal : null;
          return [
            `<a class="link" href="#/agency/clients/${esc(r.client.id)}">${esc(r.client.name)}</a>`,
            badge(r.model === 'ecommerce' ? 'E-commerce' : r.model === 'leadgen' ? 'Leadgeneratie' : 'Awareness', 'muted'),
            aantal == null ? ontbrekendeCel('niet_gemeten') : fmt.getal(aantal),
            kosten == null ? ontbrekendeCel('onvoldoende_data') : fmt.euro2(kosten),
          ];
        })
      )}
    </div>
  </section>`;
}

function renderBudgettab(samenvattingen, kanaal, overzicht) {
  const k = kanaal === 'alle' ? null : overzicht.kanalen.find((x) => x.key === kanaal);
  const klanten = k ? k.perKlant.map((r) => r.samenvatting) : samenvattingen;

  if (!klanten.length) return renderNogNietGekoppeld(kanaal, 'budget');

  return `<section class="card">
    <h2>Budgetbesteding</h2>
    <p class="muted">
      Het maandbudget geldt per klant en niet per kanaal. De uitgaven hieronder
      zijn de totale uitgaven van de klant binnen deze periode; het kanaalfilter
      bepaalt welke klanten in de lijst staan.
    </p>
    <div class="table-scroll">
      ${tabel(
        [LABELS.klant, 'Budget voor deze periode', 'Uitgaven', 'Besteed', 'Status', 'Verwacht eindbedrag'],
        klanten.map((s) => [
          `<a class="link" href="#/agency/clients/${esc(s.client.id)}">${esc(s.client.name)}</a>`,
          s.budget.budget == null ? ontbrekendeCel('niet_ingesteld') : fmt.euro(s.budget.budget),
          fmt.euro(s.budget.uitgaven),
          s.budget.besteedPercentage == null
            ? ontbrekendeCel('onvoldoende_data')
            : fmt.procent(s.budget.besteedPercentage),
          badge(s.budget.status === 'boven-budget' ? 'Boven budget' : s.budget.status === 'onder-budget' ? 'Onder budget' : 'Op schema',
            s.budget.status === 'op-schema' ? 'ok' : 'middel'),
          s.budget.prognose == null ? ontbrekendeCel('onvoldoende_data') : fmt.euro(s.budget.prognose),
        ])
      )}
    </div>
  </section>`;
}

function renderMeetbron(kanaal, samenvattingen) {
  const bronKey = kanaal;
  const meta = KANALEN.find((k) => k.key === bronKey && k.soort === KanaalSoort.MEETBRON);

  return `<section class="card">
    <h2>${esc(meta?.label ?? kanaalTitel(kanaal))}</h2>
    <p class="muted">
      Een meetbron staat naast alle advertentiekanalen en is daarom geen
      filterwaarde: zou je erop filteren, dan haal je de meetlat uit de meting.
      Hieronder staat per klant of de bron gegevens levert.
    </p>
    <div class="table-scroll">
      ${tabel(
        [LABELS.klant, 'Koppelstatus', LABELS.datakwaliteit, 'Wat dit betekent'],
        samenvattingen.map((s) => {
          const status = s.client.bronnen?.[bronKey] ?? KanaalStatus.NIET_GEKOPPELD;
          return [
            `<a class="link" href="#/agency/clients/${esc(s.client.id)}">${esc(s.client.name)}</a>`,
            badge(
              status === KanaalStatus.GEKOPPELD ? 'Gekoppeld'
                : status === KanaalStatus.ONVOLDOENDE_DATA ? 'Onvoldoende data' : 'Niet gekoppeld',
              status === KanaalStatus.GEKOPPELD ? 'ok' : 'muted'
            ),
            `${s.client.dataHealth} procent`,
            status === KanaalStatus.GEKOPPELD
              ? 'Deze bron levert gegevens voor de geselecteerde periode.'
              : status === KanaalStatus.ONVOLDOENDE_DATA
                ? 'Deze bron levert onvolledige gegevens, waardoor cijfers kunnen afwijken.'
                : 'Zonder deze koppeling ontbreken de bijbehorende cijfers; ze zijn niet nul.',
          ];
        })
      )}
    </div>
  </section>`;
}

/**
 * Voor tabs waarvoor in deze demo nog geen databron bestaat.
 * Er staat wat de tab gaat tonen en waar dat vandaan komt, zodat de tab geen
 * loze belofte is maar een aangekondigde uitbreiding.
 */
function renderNogNietGekoppeld(kanaal, onderdeel) {
  return `<section class="card" id="koppelStatusBlok">
    ${koppelStatus({
      bron: `${kanaalTitel(kanaal)} — ${onderdeel}`,
      status: KanaalStatus.TOEKOMSTIG,
      uitleg: `Dit onderdeel komt rechtstreeks uit de API van ${kanaalTitel(kanaal)}. Zolang die koppeling er niet is, wordt hier geen tabel getoond: een lege tabel wordt gelezen als "geen resultaat", en dat is iets anders dan "niet gemeten".`,
    })}
  </section>`;
}
