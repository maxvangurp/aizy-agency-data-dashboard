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
  filters/
    period.js         Referentiedatum, periodepresets en vergelijkingsperiodes
    channels.js       Kanalen en meetbronnen met hun status
    filter-context.js Vorm, validatie en URL-vertaling van de filtercontext
    filter-store.js   Filterstate per gebruiker en per context
  data/
    repository.js     Tenantgefilterde datatoegang en viewmodellen
    selectors.js      Pure selectors: totalen, reeksen, funnels, budget, verhaal
    metrics.js        Metriekmetadata, veilige rekenregels en delta's
  sample-data/        Publieke, fictieve demodata (hoort in Git)
    shared.js         Klantenregister, bronnenstatus, doelen en signalen
    timeseries.js     Dagelijkse reeksen per klant en per kanaal
    ecommerce.js      E-commerce conversieconfig, productfeed en verdelingen
    leads.js          Leadgeneratie conversieconfig en verdelingen
  views/
    components.js     Gedeelde KPI-kaarten, tabellen, doelbalken en formatters
    filterbar.js      Filterbalk voor de agency- en de klantomgeving
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

De kern is `js/sample-data/timeseries.js`: dagelijkse records per klant en per
kanaal over 500 dagen. Dat is genoeg voor 120 dagen historie plus dezelfde
periode een jaar eerder. Alle KPI's, funnels, grafieken, verhalen en
agencytotalen worden daaruit berekend; er staat nergens meer een vast
periodetotaal in de code.

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

## Filters

### Architectuur

Filteren gebeurt in de datalaag, niet in de views. De keten is:

```text
URL of voorkeur
   → filter-context.js   normaliseren tegen wat deze gebruiker mag zien
   → filter-store.js     bewaren per gebruiker en per context
   → repository.js       tenantgrens plus filtertoepassing
   → selectors.js        pure berekeningen over dagrijen
   → view                krijgt een kant-en-klaar viewmodel
```

Een view ontvangt nooit een volledige tijdreeks en filtert nooit zelf op datum
of kanaal. Zou dat wel gebeuren, dan staat data van klanten die iemand niet mag
zien alsnog in de DOM, in dropdowns en in totalen.

### De filtercontext

```js
{
  period:     { preset: 'last_30_days', startDate: null, endDate: null },
  comparison: { mode: 'previous_period' },
  channels:   ['google_ads', 'meta_ads'],
  conversionScope: 'primary'
}
```

De opgeloste datums staan er bewust niet in. Ze worden afgeleid uit de preset,
zodat er niet twee waarheden naast elkaar bestaan. De context wordt nooit ter
plekke aangepast: elke wijziging levert een nieuw object op dat opnieuw wordt
genormaliseerd.

### Periodes

| Preset | Bereik op de referentiedatum 22 juli 2026 |
|---|---|
| `last_7_days` | 16 juli tot en met 22 juli |
| `last_30_days` (standaard) | 23 juni tot en met 22 juli |
| `last_90_days` | 24 april tot en met 22 juli |
| `this_month` | 1 juli tot en met 22 juli |
| `last_month` | 1 juni tot en met 30 juni |
| `this_quarter` | 1 juli tot en met 22 juli |
| `custom` | eigen bereik, maximaal 731 dagen |

**Referentiedatum.** De demo rekent niet met de echte klok. `DEMO_TODAY` in
`js/filters/period.js` staat op `2026-07-22`. Daardoor leveren dezelfde filters
altijd dezelfde cijfers op en zijn tests niet afhankelijk van de dag waarop ze
draaien. Er staat nergens anders een aantal verstreken dagen hard gecodeerd.

**Tijdzone.** Alle datums zijn kalenderdagen in Europe/Amsterdam, opgeslagen als
`JJJJ-MM-DD`. Er wordt intern in UTC gerekend zodat zomertijd geen dag kan
verschuiven; er wordt nooit een tijdstip getoond of vergeleken.

**Grenzen.** Start- en einddatum tellen allebei mee. "Afgelopen 7 dagen" is dus
zeven dagen inclusief vandaag.

**Schrikkeljaren.** Bij een verschuiving van een maand of een jaar wordt de dag
geklemd op de laatste dag van de doelmaand. 31 maart min een maand is 28 of 29
februari; 29 februari min een jaar is 28 februari.

**Validatie.** Een aangepast bereik met een einddatum in de toekomst wordt
teruggezet naar de referentiedatum, een omgedraaid bereik wordt rechtgezet en
een te lang bereik wordt ingekort. Elke correctie wordt zichtbaar gemeld in
plaats van stil doorgevoerd.

### Vergelijkingsperiodes

| Modus | Betekenis |
|---|---|
| `previous_period` (standaard) | het venster dat direct aan de periode voorafgaat, even lang |
| `previous_month` | dezelfde periode een kalendermaand eerder, even veel dagen |
| `previous_year` | dezelfde datums een jaar eerder |
| `none` | geen vergelijking |

De regel bij gedeeltelijke periodes: **een lopende periode wordt vergeleken met
dezelfde verstreken duur, een afgeronde kalendermaand met de volledige
voorgaande kalendermaand.** Deze maand van 1 tot en met 22 juli staat dus
tegenover 1 tot en met 22 juni, en juni tegenover de hele maand mei van 31
dagen. Zo staat er nooit een halve maand tegenover een hele.

### Kanalen

Er is onderscheid tussen twee dingen die vaak door elkaar lopen:

- **advertentiekanaal** — Google Ads, Meta Ads, Microsoft Ads, LinkedIn Ads.
  Iedere dagrij hoort bij precies één kanaal, dus hierop kun je filteren.
- **meetbron** — Google Analytics 4, CRM, Google Business Profile. Die staan
  naast alle kanalen. Erop filteren zou de meetlat uit de meting halen, dus ze
  zijn geen filterwaarde. Ze worden met een status getoond: `Gekoppeld`,
  `Niet gekoppeld`, `Toekomstige koppeling` of `Onvoldoende data`.

Een kanaal is alleen selecteerbaar als de klant het heeft, de gebruiker toegang
tot die klant heeft en er data voor bestaat. De agencyweergave toont de
vereniging van de kanalen van alle toegankelijke klanten; opent iemand daarna
een klant met minder kanalen, dan wordt de selectie automatisch ingeperkt en
wordt dat boven het dashboard gemeld.

**Lege selectie.** Nul kanalen levert geen leeg scherm op maar een terugval op
alle beschikbare kanalen, met een melding. Een dashboard dat niets toont omdat
er per ongeluk niets aanstaat, is lastiger te begrijpen dan een dashboard dat
vertelt dat het de selectie heeft hersteld.

### Conversiefilter

De opties komen per klant uit `conversieConfig`, want de betekenis verschilt.

| Model | Opties |
|---|---|
| Leadgeneratie | primair, secundair, alle |
| E-commerce | primair, secundair |
| Agencyweergave | geen keuze |

E-commerce kent bewust geen optie "alle conversies": winkelwagen- en
checkoutacties zijn funnelstappen die aan dezelfde aankoop voorafgaan, en
optellen zou dezelfde uitkomst dubbel tellen. Bij leadgeneratie is
`formulierGestart` om dezelfde reden uitgesloten van het totaal, via
`uitgeslotenVanTotaal`. In de agencyweergave heeft één conversiekeuze over
klanten heen geen betekenis en wordt hij niet aangeboden.

### URL en opslag

De filterstate staat in de queryparameters achter de hashroute:

```text
#/agency/overview?period=last_30_days&channels=google_ads,meta_ads
#/agency/clients/vitaalpunt?period=custom&from=2026-07-01&to=2026-07-14
```

Parameters: `period`, `from`, `to`, `compare`, `channels`, `conv`.
Standaardwaarden worden weggelaten, dus een gebruiker die niets heeft gekozen
houdt een korte URL en de aanwezigheid van een parameter betekent altijd een
bewuste keuze.

- **De URL is leidend.** Staat er een geldige, expliciete selectie in, dan wint
  die van de opgeslagen voorkeur. Een gedeelde link toont dus wat de afzender
  zag.
- **Refresh** behoudt de selectie, want die staat in de URL.
- **Terug en vooruit** werken: elke render schrijft de genormaliseerde selectie
  met `replaceState` terug in de hash, zodat iedere geschiedenisstap zijn eigen
  filters draagt. Een filterwijziging voegt een nieuwe stap toe.
- **Ongeldige waarden** worden genegeerd of genormaliseerd; onbevoegde kanalen
  worden verwijderd en gemeld.

De voorkeur wordt bewaard onder `aizy.filters.<gebruikersid>`, met een ingang
per context: het agencyoverzicht en iedere klant hebben hun eigen selectie.
Doordat de gebruikers-id in de sleutel staat, kan een volgende gebruiker de
selectie van zijn voorganger nooit overnemen; bij uitloggen worden alle
filtersleutels bovendien verwijderd. Opent iemand een klant die nog geen eigen
selectie heeft, dan wordt de periode uit de vorige context overgenomen.

### Ontbrekende data

Vier situaties worden uit elkaar gehouden:

| Situatie | Weergave |
|---|---|
| Gemeten nul | `0` |
| Niet gemeten | `Onvoldoende data` met de reden |
| Gedeeltelijk gemeten | melding met het aantal dagen zonder data |
| Niet van toepassing | `Niet van toepassing` |

Een som van uitsluitend ontbrekende waarden is `null`, geen nul. Delen door nul
levert `null` op. Recente dagen worden gemarkeerd als mogelijk onvolledig: alle
bronnen zijn compleet tot en met `DATA_VOLLEDIG_TOT` (21 juli 2026).

### Budget en prognose

Voor iedere periode worden verstreken dagen, totaal aantal dagen, werkelijke
uitgaven, verwacht eindbedrag, verschil met budget en pacingstatus berekend. Het
maandbudget wordt naar rato van het aantal dagen naar de periode omgerekend.

Er verschijnt **geen** prognose wanneer het budget ontbreekt, de periode al is
afgerond, of er minder dan drie dagen verstreken zijn. Een voortschrijdend
venster als "afgelopen 30 dagen" is per definitie voorbij en krijgt er dus ook
geen: daar valt niets meer te voorspellen. Alleen een lopende kalenderperiode
(deze maand, dit kwartaal) loopt door tot het einde van die periode en krijgt
een prognose. De vaste aanname van 21 verstreken dagen uit de vorige fase is
verdwenen.

### Bekende beperkingen van de demodata

De verdelingstabellen — campagnes, advertentiegroepen, zoekwoorden, matchtypes,
landingspagina's, apparaten en regio's — bestaan niet op dagniveau. Ze zijn
vaste verhoudingen die proportioneel meeschalen met de geselecteerde periode en
het geselecteerde kanaal, zodat hun totalen altijd aansluiten op de KPI's
erboven. De verhoudingen zelf bewegen niet mee met de periode. Zonder Google Ads
in de selectie verdwijnen de Google Ads-tabellen in plaats van te blijven staan
met cijfers die niet bij de selectie horen.

De productfeed en Search Console zijn momentopnames met een eigen
attributievenster en volgen de kanaalselectie niet; dat staat erbij vermeld.

## Datatoegang

Views halen geen data meer rechtstreeks uit `js/sample-data`. Alles loopt via
`js/data/repository.js`, waar iedere functie de gebruiker als eerste argument
krijgt en de filtercontext als laatste:

```js
getAccessibleClients(user)
getClientById(user, clientId)
getFilterOpties(user, { clientId })
getAgencyOverview(user, filters)
getAccessibleClientSummaries(user, filters)
getAccessibleSignals(user, filters)
getClientDashboard(user, clientId, filters)
getPeriodNarrative(user, clientId, filters)
getPortfolioInzichten(user, filters)
```

Dat onderscheid is bewust. Een view die alle klanten ophaalt en er vervolgens
een paar verbergt, lekt die klanten alsnog in de DOM, in filters, in
zoekresultaten en in totalen. De grens ligt daarom vóór de view. Een filter is
nooit een manier om die grens te verschuiven: de filtercontext wordt eerst
genormaliseerd tegen wat de gebruiker mag zien.

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

De suite dekt authenticatie, autorisatie, data-isolatie, het filtersysteem, de
agency- en klantomgeving, teambeheer, navigatie, thema's, de API-fallback, het
tekenen en opruimen van grafieken en de scheiding tussen bedrijfsmodellen.

| Bestand | Tests |
|---|--:|
| `accounts.spec.js` | 45 |
| `filters.spec.js` | 57 |
| `leadgen.spec.js` | 28 |
| `ecommerce.spec.js` | 9 |
| `smoke.spec.js` | 9 |
| `publiceerbaar.spec.js` | 6 |
| **Totaal** | **154** |

`filters.spec.js` bewaakt de filterstate, de periodeberekeningen tot op de dag,
de tenantisolatie van kanalen, of KPI's, funnels, grafieken en verhalen
werkelijk op de filters reageren, de budgetprognose en de bediening van de
filterbalk op vier schermformaten.

Losse onderdelen zijn zonder browser te controleren, omdat de selectorlaag puur
is:

```bash
node --input-type=module -e "
  const { resolvePeriode } = await import('./js/filters/period.js');
  console.log(resolvePeriode({ preset: 'this_month' }));
"
```

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
| E-commerce | omzet, transacties, ROAS, CPA, gemiddelde orderwaarde, conversieratio, winkelwagen-, checkout- en aankoopratio |
| Leadgeneratie | leads, gekwalificeerde leads, CPL, CPQL, afspraken, offertes, klanten, lead-naar-klant, pipelinewaarde |
| Awareness | impressies, klikken, CTR, CPM |

Het model staat in `js/sample-data/shared.js` per klant onder `businessModel`.
`bouwScherm` in `js/app.js` kiest op basis daarvan het juiste dashboard.

Alle KPI's worden per geselecteerde periode en kanaalselectie berekend uit de
dagreeksen. De demodata is zo gekalibreerd dat de standaardperiode van dertig
dagen exact de kerncijfers uit de vorige fase oplevert, en de voorafgaande
dertig dagen exact de toen vastgelegde vorige periode. Afgeleide waarden als
CPL, CPQL, ROAS en CPA zijn daardoor berekend in plaats van ingetypt.

### Een klant toevoegen

1. Voeg een object toe aan `SAMPLE_CLIENTS` in `js/sample-data/shared.js`, met
   `businessModel`, `maandbudget`, `bronnen` en `doelen` (alleen targets; de
   werkelijke waarde hoort bij een periode en wordt berekend).
2. Voeg een ingang toe aan `CLIENT_CONFIG` in `js/sample-data/timeseries.js`
   met de kanaalverdeling en de totalen van de twee gekalibreerde vensters.
3. Voeg het profiel toe met dezelfde sleutel als de klant-id:
   - e-commerce: `ECOMMERCE_DATA` in `js/sample-data/ecommerce.js`
   - leadgeneratie: `LEADS_DATA` in `js/sample-data/leads.js`

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
- Verdelingstabellen op dagniveau; die schalen nu proportioneel mee
- Een datumkiezer in het designsysteem; nu wordt het datumveld van de browser
  gestyled, waardoor de notatie de taalinstelling van de browser volgt
- Klanttoewijzingen en rollen wijzigen vanuit teambeheer
- Microsoft Ads, Meta Ads en LinkedIn Ads detailschermen
- Budget en forecasting
- Actiecentrum met status, eigenaar en deadline
- Presentatiemodus en command palette
- Google Business Profile koppeling
- `index.fixed.html` is een verouderd prototype en kan worden verwijderd
