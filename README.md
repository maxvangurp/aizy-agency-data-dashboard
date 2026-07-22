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
  app.js              Applicatieshell: navigatie, accountmenu, contextwisselaar
  router.js           Hash-routes en routebeveiliging
  state.js            Thema en weergavevoorkeuren
  data-provider.js    safeFetchJson, voor als er weer een backend bij komt
  charts.js           Visualisatielaag met gevalideerd kleurenpalet
  auth/
    domain.js         Organisaties, gebruikers en rollen
    permissions.js    Centrale can(), enige plek met toegangsregels
    session.js        Sessieopslag en validatie
    auth-provider.js  Contract plus plek voor de Azure-implementatie
    demo-auth-provider.js  Demo-implementatie
    auth-service.js   Enig toegangspunt voor de rest van de applicatie
  data/
    repository.js     Tenantgefilterde datatoegang
  sample-data/        Publieke, fictieve demodata (hoort in Git)
    shared.js         Klantenregister, bedrijfsmodellen en signalen
    ecommerce.js      E-commerce dataset
    leads.js          Leadgeneratie dataset
  views/
    components.js     Gedeelde KPI-kaarten, tabellen, doelbalken en formatters
    auth-screens.js   Inloggen, herstel, uitnodiging, geen toegang, 404
    agency.js         Agencyoverzicht, klantenlijst, team, signalen
    agency-client-detail.js  Klantdetail met interne status
    client-env.js     Klantomgeving
    ecommerce.js      E-commerce dashboard
    leadgen.js        Leadgeneratie dashboard en klantweergave
server.js             Express API en OAuth
db.js                 SQLite schema en queries
utils.js              Tokenversleuteling
tests/                Playwright-tests
```

## Databronnen

Alle cijfers komen uit de demodata in `js/sample-data`. De shell doet op dit
moment geen netwerkverzoeken; de cijfers zijn deterministisch en veranderen
niet bij een refresh.

`js/data-provider.js` blijft aanwezig met `safeFetchJson` en de statussen
`sample`, `live`, `empty`, `error`, `loading` en `partial`. Die laag is nodig
zodra er weer een backend bij komt en wordt getest in `tests/smoke.spec.js`.

## GitHub Pages

De frontend werkt volledig zonder backend, inclusief inloggen, rollen en de
datascheiding. Alles draait in de browser.

Beperkingen zonder backend:
- de authenticatie is een demonstratie, geen beveiliging
- Google OAuth werkt niet
- integraties kunnen niet worden gekoppeld
- live data is niet beschikbaar

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


## Accounts, rollen en omgevingen

De applicatie kent een agencyomgeving voor medewerkers van Aizy en een
afgeschermde klantomgeving. Welke omgeving iemand ziet, volgt uit zijn rol.

> **Waarschuwing**
> De authenticatie in deze repository is een demonstratie. Er is geen server
> die tokens uitgeeft of controleert, en alle demodata zit in dezelfde
> JavaScriptbundle. Wie de browserconsole opent, kan de sessie aanpassen en
> bij alle demodata komen. Gebruik deze omgeving niet voor echte klantgegevens
> of productieaccounts.

### Demo-accounts

Het wachtwoord is voor alle accounts `demo123`.

| E-mailadres | Rol | Toegang |
|---|---|---|
| `max@aizy.demo` | Beheerder | Alle 7 klanten, team en instellingen |
| `sanne@aizy.demo` | Medewerker | Vitaalpunt, Havenkwartier |
| `daan@aizy.demo` | Medewerker | Meridiaan, Tafelwerk, Draadloos |
| `noor@aizy.demo` | Medewerker | Openstaande uitnodiging, nog geen toegang |
| `directie@vitaalpunt.demo` | Klantbeheerder | Alleen Vitaalpunt, inclusief gebruikersbeheer |
| `praktijk@vitaalpunt.demo` | Meekijker | Alleen Vitaalpunt |
| `marketing@meridiaan.demo` | Meekijker | Alleen Meridiaan |

Het inlogscherm toont deze accounts, zodat een rol met één klik te testen is.

### Rollen en rechten

Rechten staan centraal in `js/auth/permissions.js`. Er staat nergens anders in
de applicatie een controle op een rolnaam.

| Recht | Beheerder | Medewerker | Klantbeheerder | Meekijker |
|---|:--:|:--:|:--:|:--:|
| Agencydashboard bekijken | ✅ | ✅ | — | — |
| Alle klanten bekijken | ✅ | — | — | — |
| Toegewezen klant bekijken | ✅ | ✅ | eigen organisatie | eigen organisatie |
| Signalen bekijken | ✅ | ✅ | — | — |
| Team beheren | ✅ | — | — | — |
| Klanttoewijzingen wijzigen | ✅ | — | — | — |
| Klantcontext openen | ✅ | ✅ | — | — |
| Instellingen openen | ✅ | — | — | — |
| Klantdashboard bekijken | ✅ | ✅ | ✅ | ✅ |
| Rapportage bekijken | ✅ | ✅ | ✅ | ✅ |
| Gebruikers van eigen organisatie beheren | — | — | ✅ | — |

Gebruik in code:

```js
can(user, Permission.VIEW_AGENCY_DASHBOARD)
can(user, Permission.VIEW_CLIENT, 'vitaalpunt')
can(user, Permission.MANAGE_TEAM)
```

### Agency- en klantcontext

Een agencygebruiker werkt standaard in de agencyomgeving. Via de keuzelijst
rechtsboven opent hij de klantweergave van een klant waar hij toegang toe heeft.
Daarbij verschijnt een vaste contextbalk met `Klantweergave: <klant>` en de
melding dat hij als medewerker van Aizy is ingelogd, plus een knop om terug te
gaan. Een klantgebruiker krijgt die keuzelijst nooit te zien.

### Routes

```text
#/login                          openbaar
#/forgot-password                openbaar
#/accept-invite                  openbaar

#/agency/overview                agencydashboard
#/agency/clients                 klantenoverzicht
#/agency/clients/:clientId       klantdetail, gecontroleerd op deze klant
#/agency/signals                 signalen
#/agency/actions                 acties
#/agency/team                    teambeheer, alleen beheerder
#/agency/settings                instellingen, alleen beheerder

#/client/overview                klantoverzicht
#/client/performance             resultaten
#/client/conversions             conversies
#/client/report                  rapportage
#/client/users                   gebruikers, alleen klantbeheerder

#/unauthorized                   geen toegang
```

Een onbekende route toont een 404-status, een bestaande maar niet toegestane
route een geen-toegangpagina met de reden erbij.

### Sessiegedrag

De sessie staat in `localStorage` onder `aizy.session` en bevat alleen een
gebruikers-id en de gekozen klantcontext, nooit rechten of een wachtwoord.
Rechten worden bij iedere weergave opnieuw afgeleid uit het domeinmodel.

- de gebruiker blijft ingelogd na het vernieuwen van de pagina;
- uitloggen verwijdert de sessie en de opgeslagen weergavevoorkeuren;
- beschadigde sessiedata wordt verwijderd in plaats van hersteld;
- een handmatig aangepaste klant-id in de sessie geeft geen toegang: de
  context wordt bij iedere weergave opnieuw tegen de rechten gehouden.

Omdat er geen server is, kan een gebruiker de gebruikers-id in de sessie wel
vervangen door die van een ander demo-account. Dat is inherent aan een
statische frontend en is precies wat de Azure-stap hieronder oplost.

## Datatoegang

Views halen geen data meer rechtstreeks uit `js/sample-data`. Alles loopt via
`js/data/repository.js`, waar iedere functie de gebruiker als eerste argument
krijgt:

```js
getAccessibleClients(user)
getClientById(user, clientId)
getClientDashboardData(user, clientId)
getAccessibleSignals(user)
getAgencyMetrics(user)
```

Dat onderscheid is bewust. Een view die alle klanten ophaalt en er vervolgens
een paar verbergt, lekt die klanten alsnog in de DOM, in filters, in
zoekresultaten en in totalen. De grens ligt daarom vóór de view.

| | Nu | Later |
|---|---|---|
| Isolatie | frontendautorisatie | backendautorisatie |
| Waar | repository en routeguards | Azure API |
| Sterkte | modelleert de grens | handhaaft de grens |

## Toekomstige Azure-integratie

De applicatie praat uitsluitend via de interface in `js/auth/auth-provider.js`
met de buitenwereld. De demo-implementatie kan daardoor worden vervangen
zonder dat er een dashboard hoeft te veranderen.

```text
Frontend
    ↓
Microsoft Entra External ID of Azure Static Web Apps Authentication
    ↓
Azure API Management of Azure Functions
    ↓
Server-side autorisatie en tenantfiltering
    ↓
Google Ads, GA4, Meta, CRM en overige databronnen
```

### Wat er moet worden gebouwd

1. **`AzureAuthProvider`** in `js/auth/auth-provider.js`. De klasse staat er al
   en werpt bewust een fout: een half werkende koppeling zou de indruk wekken
   dat er beveiliging is. Te implementeren methoden: `login`, `logout`,
   `getCurrentUser`, `restoreSession`, `acceptInvite`, `requestPasswordReset`.

2. **Claims vertalen naar het domeinmodel.** Minimaal nodig:

   | Claim | Gebruik |
   |---|---|
   | `oid` of `sub` | stabiele gebruikers-id |
   | `emails` of `preferred_username` | e-mailadres |
   | `name` of `given_name` en `family_name` | weergavenaam |
   | `extension_organisationId` | organisatie van de gebruiker |
   | `roles` of `extension_role` | rol binnen die organisatie |
   | `extension_clientAssignments` | klanttoewijzingen van een medewerker |

   De vertaling hoort in de provider, niet in de views.

3. **Serverkant.** De frontend mag blijven bepalen wat er wordt getoond, maar
   de API moet zelfstandig controleren:

   1. is het token geldig, niet verlopen en voor deze applicatie uitgegeven;
   2. hoort de organisatie-id uit het token bij de opgevraagde resource;
   3. staat de gevraagde klant-id in de toewijzingen van deze gebruiker;
   4. is de rol toereikend voor de gevraagde handeling;
   5. wordt het antwoord op tenant gefilterd vóór verzending.

   Zonder stap 5 zijn stap 1 tot en met 4 niet genoeg. Een gefilterde weergave
   op een ongefilterd antwoord is geen isolatie.

Er zijn bewust geen aannames gedaan over een bestaande Azure-tenant,
appregistraties of beschikbare API's.

## Tests

```bash
npm test           # Playwright, start de server automatisch
npm run test:ui    # interactieve testrunner
```

De suite dekt authenticatie, autorisatie, data-isolatie, de agency- en
klantomgeving, teambeheer, navigatie, thema's, de API-fallback, het tekenen en
opruimen van grafieken en de scheiding tussen bedrijfsmodellen.

| Bestand | Tests |
|---|--:|
| `accounts.spec.js` | 45 |
| `leadgen.spec.js` | 28 |
| `ecommerce.spec.js` | 9 |
| `smoke.spec.js` | 9 |
| `publiceerbaar.spec.js` | 6 |
| **Totaal** | **97** |

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
- E-commerce klantweergave met eigen periodeverhaal, nu wordt het
  agencydashboard hergebruikt
- Periode- en kanaalfilters in de shell, die zijn bij de herbouw vervallen
- Klanttoewijzingen en rollen wijzigen vanuit teambeheer
- Microsoft Ads, Meta Ads en LinkedIn Ads detailschermen
- Budget en forecasting
- Actiecentrum met status, eigenaar en deadline
- Presentatiemodus en command palette
- Google Business Profile koppeling
- `index.fixed.html` is een verouderd prototype en kan worden verwijderd
