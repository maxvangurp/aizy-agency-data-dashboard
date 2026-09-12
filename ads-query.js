/**
 * De Supabase-kant van `/api/google-ads/campaigns`.
 *
 * Losgetrokken uit `server.js` om twee redenen. De eerste is snelheid: dit pad
 * deed vier round-trips naar Supabase achter elkaar terwijl er maar één van
 * afhing van de vorige. De tweede is dat het enige echte-datapad in de server
 * daarmee ook te testen werd -- `ads-contract.js` bestaat al om precies die
 * reden, alleen dekte die de rekenkant en niet het ophalen.
 *
 * **Wat wel en niet op elkaar wacht.** De klant opzoeken moet eerst: zonder
 * `client_id` heeft geen van de andere queries een filter. Daarna zijn de drie
 * reads -- prestaties, campagnenamen en het conversieoordeel -- volledig
 * onafhankelijk van elkaar. Die stonden achter elkaar, en dat kostte twee
 * round-trips die niemand nodig had. Op een verbinding van tachtig milliseconde
 * scheelt dat ruwweg een zesde seconde per dashboardweergave, en dat is precies
 * het soort vertraging waarvan je denkt dat het "gewoon traag" is.
 *
 * Deze module doet alleen I/O. Wat er met de rijen gebeurt -- containment,
 * granulariteit, de KPI's -- staat in `ads-contract.js` en blijft daar.
 */

const PLATFORM = 'google-ads';

/**
 * Zoekt een klant op slug of uuid.
 *
 * Leest de hele tabel. Dat is bewust: hij is klein, en bij een misser hoort de
 * lijst met beschikbare slugs in het antwoord -- zonder die lijst is een typefout
 * in een clientnaam een raadspelletje.
 */
async function zoekKlant(sb, aanduiding) {
  const klanten = await sb.lees('clients', { kolommen: 'id,slug,name,business_model' });
  const klant = klanten.find((c) => c.slug === aanduiding || c.id === aanduiding) ?? null;
  return { klant, beschikbaar: klanten.map((c) => c.slug).filter(Boolean) };
}

/**
 * Het conversieoordeel over dit account, of null.
 *
 * Een ontbrekende tabel is hier geen fout maar een volgorde: migratie 015 van
 * max-marketing-os maakt hem aan, en tussen het uitrollen van deze code en het
 * draaien van die migratie hoort het endpoint gewoon te blijven werken. Dan
 * alleen zonder voorbehoud, en dat zegt het blok ook (`betrouwbaarheid: null`
 * betekent niet beoordeeld).
 *
 * Andere fouten gaan wél door: een 401 op deze tabel betekent dat de sleutel of
 * de rechten niet kloppen, en dat stilzwijgend als "geen oordeel" behandelen is
 * precies hoe je een ROAS toont die niets betekent.
 *
 * Het platform hoort erbij. Het oordeel gaat over een conversieopzet, en die is
 * per platform anders: een account dat op Google alleen routeklikken telt kan
 * op Meta wel degelijk aankopen meten. Het Google-oordeel op Meta plakken
 * onderdrukt dan cijfers die kloppen.
 */
async function leesBetrouwbaarheid(sb, clientId, platform = PLATFORM) {
  try {
    const rijen = await sb.lees('client_kpi_reliability', {
      filters: { client_id: clientId, platform },
      limiet: 1,
    });
    return rijen[0] ?? null;
  } catch (error) {
    if (/\(404\)/.test(String(error && error.message))) return null;
    throw error;
  }
}

/**
 * Haalt alles op wat het campagneblok nodig heeft.
 *
 * @param {object} sb            Supabaseclient uit `supabase.js`
 * @param {object} opties
 * @param {string} opties.klantId
 * @param {string} [opties.since]  Ondergrens op `snapshot_date`
 */
async function haalGoogleAdsBron(sb, { klantId, since } = {}) {
  if (!klantId) throw new TypeError('klantId is verplicht');

  // De periode is optioneel. Zonder grenzen krijg je alles wat er is; dat is
  // bruikbaarder dan een lege grafiek als de filters nog niet gezet zijn.
  const filters = { client_id: klantId, platform: PLATFORM };
  if (since) filters.snapshot_date = 'gte.' + since;

  // Drie onafhankelijke reads. Achter elkaar zetten zou twee round-trips kosten
  // die niets toevoegen; geen van de drie gebruikt het antwoord van de andere.
  const [snapshots, campagnerijen, betrouwbaarheid] = await Promise.all([
    sb.lees('performance_snapshots', {
      kolommen:
        'campaign_id,snapshot_date,period_end,granularity,spend,impressions,clicks,conversions_primary,revenue',
      filters,
      order: 'snapshot_date.asc',
    }),
    sb.lees('campaigns', {
      kolommen: 'id,name,channel_type',
      filters: { client_id: klantId, platform: PLATFORM },
    }),
    leesBetrouwbaarheid(sb, klantId),
  ]);

  return {
    snapshots,
    campagnes: new Map(campagnerijen.map((c) => [c.id, c])),
    betrouwbaarheid,
  };
}

module.exports = { zoekKlant, leesBetrouwbaarheid, haalGoogleAdsBron, PLATFORM };
