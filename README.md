# Aizy Agency Data Dashboard

Dashboard voor het beheren van betaalde en organische marketingprestaties van
meerdere klanten. Frontend in HTML, CSS en JavaScript modules. Backend in
Node/Express met SQLite voor Google OAuth en resourcekoppelingen.

## Lokaal starten

```bash
npm install
cp .env.example .env      # vul je Google OAuth-gegevens in
npm run dev               # of: npm start
```

Open daarna http://127.0.0.1:8000/index.html

## Projectstructuur

```
index.html            Applicatieshell
styles.css            Design system, semantische thema-tokens
js/
  app.js              Navigatie, filters, rendering
  state.js            Centrale applicatiestate met persistentie
  data-provider.js    safeFetchJson en de datamodi
  charts.js           Visualisatielaag met gevalideerd kleurenpalet
  sample-data/        Publieke, fictieve demodata (hoort in Git)
    shared.js         Klantenregister, bedrijfsmodellen en signalen
    ecommerce.js      E-commerce dataset
    leads.js          Leadgeneratie dataset
  views/
    components.js     Gedeelde KPI-kaarten, tabellen, doelbalken en formatters
    ecommerce.js      E-commerce klantdashboard
    leadgen.js        Leadgeneratie klantdashboard en klantview
server.js             Express API en OAuth
db.js                 SQLite schema en queries
utils.js              Tokenversleuteling
tests/                Playwright-tests
```

## Datamodi

De applicatie kent twee modi, wisselbaar via de knop rechtsboven.

**Demodata** is de standaard. Er wordt geen enkel netwerkverzoek gedaan. Alle
schermen, filters en grafieken werken. De gekozen modus wordt lokaal bewaard.

**Live data** gebruikt uitsluitend echte gekoppelde bronnen. Ontbrekende data
wordt als ontbrekend getoond. Er wordt nooit stil teruggevallen op demodata.

Iedere databron levert een status: `sample`, `live`, `empty`, `error`, `loading`
of `partial`. Schermen tonen die status als banner.

## GitHub Pages

De frontend werkt zonder backend. `hasBackend()` in `js/data-provider.js`
detecteert dat er geen Node-server is en houdt de applicatie in demomodus.
API-aanroepen worden dan niet uitgevoerd.

Beperkingen zonder backend:
- Google OAuth werkt niet
- Integraties kunnen niet worden gekoppeld
- Live data is niet beschikbaar

`safeFetchJson` controleert altijd de `content-type` voordat er wordt geparsed.
Een HTML-antwoord op een API-pad levert een leesbare melding op in plaats van
`Unexpected token '<'`.

### Wat wel en niet in Git hoort

| Wel | Niet |
|---|---|
| `js/sample-data/` — publieke, fictieve demodata | `/data/` — lokale database met versleutelde tokens |
| Alles onder `js/`, `styles.css`, `index.html` | `/references/` — lokale referentiebestanden |
| | `.env` — secrets |

Patronen in `.gitignore` staan met een schuine streep vooraan (`/data/`). Zonder
die streep matcht een patroon op ieder niveau. Dat is eerder misgegaan: `data/`
blokkeerde ook `js/data/`, waardoor de demodata niet werd gepusht en de
applicatie op GitHub Pages niet initialiseerde.

`tests/publiceerbaar.spec.js` bewaakt dit. Die test volgt de modulegraaf vanaf
`js/app.js` en controleert of ieder geïmporteerd bestand ook door Git wordt
gepubliceerd. Ook controleert hij dat de database en `.env` er juist buiten
blijven.

## Tests

```bash
npm test           # Playwright, start de server automatisch
npm run test:ui    # interactieve testrunner
```

De suite dekt navigatie, thema's, de API-fallback, het e-commerce dashboard,
het tekenen en opruimen van grafieken en de scheiding tussen bedrijfsmodellen.

## Thema's

Eén centraal systeem via `data-theme` op het root-element. Licht en donker zijn
afzonderlijk gedefinieerd met semantische tokens, geen automatische omkering.
Bij een eerste bezoek volgt de applicatie `prefers-color-scheme`. De keuze wordt
lokaal bewaard.

## Bedrijfsmodellen

Iedere klant heeft een bedrijfsmodel dat bepaalt welke KPI's, funnel en
schermen zichtbaar zijn.

| Model | Primaire KPI's |
|---|---|
| E-commerce | omzet, aankopen, ROAS, CPA, gemiddelde orderwaarde, conversieratio |
| Leadgeneratie | leads, gekwalificeerde leads, CPL, CPQL, afspraken, pipelinewaarde |
| Awareness | bereik, impressies, frequentie, CPM, videoweergaven, engagement |

Het model staat in `js/sample-data.js` per klant onder `businessModel`.
`renderCustomer` in `js/app.js` kiest op basis daarvan het juiste dashboard.

### Een klant toevoegen

1. Voeg een object toe aan `SAMPLE_CLIENTS` in `js/sample-data/shared.js`.
2. Zet `businessModel` op een waarde uit `BusinessModel`.
3. Voeg een dataset toe met dezelfde sleutel als de klant-id:
   - e-commerce: `ECOMMERCE_DATA` in `js/sample-data/ecommerce.js`
   - leadgeneratie: `LEADS_DATA` in `js/sample-data/leads.js`
4. Doelen staan per klant onder `doelen`.

### Conversies per klant instellen

Welke conversies als lead tellen verschilt per klant. Een telefoonklik is bij een
praktijk een serieus signaal maar geen lead; een spoedaanvraag wel. Die indeling
staat daarom per klant in `conversieConfig` en niet vast in de code:

```js
conversieConfig: {
  primair:   ['contactformulier', 'afspraakGepland', 'spoedaanvraag'],
  secundair: ['telefoonklik', 'emailklik', 'routeaanvraag'],
}
```

Labels komen uit `CONVERSIE_LABELS` in hetzelfde bestand.

### Klantview

De knop rechtsboven wisselt tussen agencyview en klantview. De klantview toont
een rustige weergave met investering, leads, leadkwaliteit, doelen, funnel en
het periodeverhaal, zonder technische tabellen. De keuze wordt lokaal bewaard.

### Ontbrekende data

Een ontbrekende meting is iets anders dan een resultaat van nul. Waar een bron
niet gekoppeld is, toont het dashboard `Onvoldoende data` met de reden. Zulke
stappen worden uitgesloten van de knelpuntberekening en niet als nul in
grafieken getekend. Havenkwartier Makelaars is de demoklant zonder
CRM-koppeling en dekt dit geval af.

## Grafieken

De reekskleuren in `js/charts.js` zijn gevalideerd op kleurenblindheid
(protanopie en deuteranopie) tegen beide themaoppervlakken. Licht en donker zijn
afzonderlijk gekozen. Iedere grafiek heeft een tabelweergave en een
bronvermelding.

Chart.js wordt via een CDN geladen zodat de applicatie zonder buildstap werkt.

## API routes

- `GET /api/auth/status`
- `GET /api/auth/google/start`
- `GET /api/auth/google/callback`
- `GET /api/integrations/google/status`
- `POST /api/integrations/google/reconnect`
- `POST /api/integrations/google/disconnect`
- `GET /api/overview`
- `GET /api/ga4/accounts`
- `GET /api/ga4/properties?accountId=ACCOUNT_ID`
- `GET /api/merchant/accounts`
- `GET /api/merchant/products?merchantId=MERCHANT_ID`
- `GET /api/gsc/sites`
- `GET /api/gsc/search-analytics?siteUrl=SITE_URL`
- `GET /api/google/resources`
- `GET /api/clients`
- `GET /api/mappings?clientId=CLIENT_ID&provider=google`
- `POST /api/mapping`
- `POST /api/ga4/map-property`
- `POST /api/merchant/map-account`
- `POST /api/gsc/map-site`
- `DELETE /api/mapping/:id`

Onbekende `/api`-routes geven altijd JSON terug, nooit HTML.

## Google Cloud instellingen

1. Maak of selecteer een Google Cloud-project.
2. Schakel deze APIs in: Analytics Data, Analytics Admin, Merchant, Search Console.
3. Configureer een OAuth consent screen.
4. Maak een OAuth 2.0-webclient aan.
5. Redirect URI: `http://127.0.0.1:8000/api/auth/google/callback`
6. Vul `.env` volgens `.env.example`. Voeg nooit echte secrets aan Git toe.

## Database

SQLite via `db.js`, opgeslagen in `./data/app.db`. Refresh tokens worden
versleuteld opgeslagen met AES-256-GCM.

## Nog niet gebouwd

- Awareness-klantdashboard met eigen funnel
- E-commerce klantview (bestaat nu alleen voor leadgeneratie)
- Microsoft Ads, Meta Ads en LinkedIn Ads detailschermen
- Budget en forecasting
- Actiecentrum met status, eigenaar en deadline
- Presentatiemodus en command palette
- Google Business Profile koppeling
- `index.fixed.html` is een verouderd prototype en kan worden verwijderd
