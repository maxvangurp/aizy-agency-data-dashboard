# API-contract — Meta & Google Ads (simpel dashboard)

Het simpele "Snel inzicht"-dashboard (modus `simpel`, route `#/pulse`) haalt zijn
cijfers via de data-provider-seam in `js/data-provider.js`:

```js
fetchResource('/api/meta/insights?client=<id>&since=<ISO>&until=<ISO>', metaSampleLoader)
fetchResource('/api/google-ads/campaigns?client=<id>&since=<ISO>&until=<ISO>', googleSampleLoader)
```

- **Demomodus** (nu): de sample-loader draait; er wordt geen netwerkverzoek gedaan.
- **Live modus** (later): de endpoints hierboven worden bevraagd. Het dashboard
  verandert niet — alleen de bron. Zet de modus met `setDataMode('live')`
  (`js/data-provider.js`).

De frontend is statisch en kan Meta/Google **niet rechtstreeks** aanroepen
(OAuth-secrets horen niet in de browser). Een kleine **backend/proxy** vertaalt
de calls hieronder naar de externe API's en levert exact de contractvorm terug.

## Responsvorm (identiek voor beide endpoints): "platformblok"

```jsonc
{
  "platform": "meta",            // "meta" | "google"
  "label": "Meta Ads",
  "aanwezig": true,               // false = platform niet actief voor deze klant/periode
  "resultLabel": "Aankopen",     // "Leads" (leadgen) | "Aankopen" (ecommerce) | "Interacties" (awareness)
  "totals": {
    "spend": 5535,                // euro
    "impressions": 108560,
    "clicks": 2556,
    "ctr": 3.0,                   // percentage (klikken/vertoningen × 100)
    "cpc": 2.17,                  // euro
    "results": 115,               // conversies (zie resultLabel)
    "costPerResult": 48.13        // euro
  },
  "series": [                      // per dag binnen de periode
    { "date": "2026-06-23", "spend": 180, "results": 4 }
  ],
  "campaigns": [
    {
      "name": "Meta | Prospecting", "type": "Meta",
      "spend": 2768, "impressions": 54280, "clicks": 1278,
      "ctr": 3.0, "cpc": 2.17, "results": 57, "costPerResult": 48.5
    }
  ]
}
```

Het dashboard combineert de twee blokken (`combineerTotalen`, `alleCampagnes` in
`js/data/ads-data.js`) tot de KPI-band, de Meta-vs-Google-splitsing, de
trendgrafiek en de campagnetabel.

## Mapping vanuit de echte API's

### Meta Marketing API → `/api/meta/insights`
Endpoint: `GET /v<versie>/act_<ad_account_id>/insights`
- `time_range={since,until}`, `level=campaign`, `time_increment=1` (voor `series`),
  `fields=spend,impressions,clicks,ctr,cpc,actions,campaign_name`.

| Contract            | Meta-veld |
|---------------------|-----------|
| `totals.spend`      | `spend` |
| `totals.impressions`| `impressions` |
| `totals.clicks`     | `clicks` |
| `totals.ctr`        | `ctr` |
| `totals.cpc`        | `cpc` |
| `totals.results`    | `actions[]` waar `action_type` de klant-conversie is (bijv. `purchase`, `lead`) |
| `series[]`          | rijen met `time_increment=1` (per dag) |
| `campaigns[].name`  | `campaign_name` |

### Google Ads API → `/api/google-ads/campaigns`
Endpoint: `POST /v<versie>/customers/<customer_id>/googleAds:searchStream` (GAQL):
```sql
SELECT campaign.name, campaign.advertising_channel_type, segments.date,
       metrics.cost_micros, metrics.impressions, metrics.clicks,
       metrics.conversions, metrics.ctr, metrics.average_cpc
FROM campaign WHERE segments.date BETWEEN '<since>' AND '<until>'
```

| Contract             | Google-veld |
|----------------------|-------------|
| `totals.spend`       | `metrics.cost_micros` / 1e6 |
| `totals.impressions` | `metrics.impressions` |
| `totals.clicks`      | `metrics.clicks` |
| `totals.ctr`         | `metrics.ctr` × 100 |
| `totals.cpc`         | `metrics.average_cpc` / 1e6 |
| `totals.results`     | `metrics.conversions` |
| `series[]`           | groeperen op `segments.date` |
| `campaigns[].name`   | `campaign.name` |
| `campaigns[].type`   | `campaign.advertising_channel_type` |

## Auth & backend (los van deze frontend)
- **Meta**: Marketing API-app + OAuth (system user of gebruikerstoken met
  `ads_read`), app-review voor productie.
- **Google Ads**: OAuth2 + developer token + `login-customer-id`.
- Tokens en secrets staan uitsluitend op de backend/proxy; de frontend praat
  alleen met `/api/...`. Response cachen per klant+periode is aan te raden
  (rate limits).

## Waar aansluiten in de code
Vervang de sample-loaders in `js/sample-data/ads-sample.js`
(`metaInsightsSample` / `googleCampagnesSample`) door een echte fetch, of laat
ze staan en zet `setDataMode('live')` — dan bevraagt `fetchResource` de
endpoints hierboven. De dashboard-code (`js/views/simpel-dashboard.js`,
`js/data/ads-data.js`) blijft ongewijzigd.
