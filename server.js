const path = require('path');
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const {google} = require('googleapis');
const dotenv = require('dotenv');
const {v4: uuidv4} = require('uuid');
const {encrypt, decrypt} = require('./utils');
const supabase = require('./supabase');
const {
  googleBlokVan, metaBlokVan, kiesGranulariteit, binnenBereik, dekkingVan,
} = require('./ads-contract');
const {
  zoekKlant, haalGoogleAdsBron, leesBetrouwbaarheid, leesCampagnes, PLATFORM: PLATFORM_GOOGLE,
} = require('./ads-query');
const {signalenVoor, zwaarste} = require('./portfolio-signalen');
const ga4Contract = require('./ga4-contract');
const {inzichten: ga4Inzichten} = require('./ga4-inzichten');

/**
 * Onder welke platformnaam max-marketing-os wegschrijft. Deze strings staan aan
 * beide kanten van de koppeling en moeten gelijk blijven, dus elk op één plek:
 * Google komt uit `ads-query.js`, die hem zelf gebruikt om te filteren. Een
 * typefout is dan een fout en geen lege grafiek.
 */
const PLATFORM_META = 'meta-ads';
const {
  getGoogleConnection,
  upsertGoogleConnection,
  deleteGoogleConnection,
  deleteClientResourceMapping,
  deleteClientResourceMappings,
  getClientResourceMappings,
  getClientResourceMappingsByClient,
  getClientResourceMappingsByProvider,
  getClients,
  createClientResourceMapping,
} = require('./db');

dotenv.config();

const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
  SESSION_SECRET = 'replace-this-session-secret',
  TOKEN_ENCRYPTION_KEY,
  USE_MOCK_DATA = 'true',
  PORT = 8000,
} = process.env;

const app = express();
const port = Number(PORT);
const oauthStateStore = new Map();

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

if (USE_MOCK_DATA !== 'true' && !TOKEN_ENCRYPTION_KEY) {
  throw new Error('TOKEN_ENCRYPTION_KEY is required when USE_MOCK_DATA is false.');
}

app.use(express.static(path.join(__dirname)));

const oauthScopes = [
  'https://www.googleapis.com/auth/analytics.readonly',
  'https://www.googleapis.com/auth/analytics.admin.readonly',
  'https://www.googleapis.com/auth/content.readonly',
  'https://www.googleapis.com/auth/webmasters.readonly',
];

function createOAuthClient() {
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );
}

function getAuthClientFromConnection() {
  const connection = getGoogleConnection();
  if (!connection) return null;
  const oauth2Client = createOAuthClient();
  const refreshToken = decrypt(connection.encrypted_refresh_token);
  oauth2Client.setCredentials({refresh_token: refreshToken});
  return oauth2Client;
}

function buildDemoOverview() {
  return {
    connected: false,
    demo: true,
    accountEmail: null,
    resources: [],
    message: 'Demo-modus actief. Vul Google Cloud-credentials in om live data te verbinden.',
    kpis: {
      spend: 54230,
      roas: 7.4,
      health: 82,
      alerts: 3,
    },
    merchant: {
      accounts: 2,
      products: 124,
    },
    search: {
      sites: ['https://voorbeeld.nl'],
      clicks: 412,
      impressions: 60834,
    },
  };
}

function formatError(error) {
  if (!error) return 'Unknown error';
  if (error.response && error.response.data) return JSON.stringify(error.response.data);
  return error.message || String(error);
}

app.get('/api/auth/google/start', (req, res) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
    return res.status(500).json({error: 'Google OAuth is niet geconfigureerd.'});
  }

  const oauth2Client = createOAuthClient();
  const state = uuidv4();
  oauthStateStore.set(state, {createdAt: Date.now()});

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: oauthScopes,
    state,
  });

  res.json({authUrl});
});

app.get('/api/auth/google/callback', async (req, res) => {
  try {
    const {code, state} = req.query;
    if (!code || !state) {
      return res.status(400).send('Ongeldige OAuth callback: ontbreken code of state.');
    }

    const storedState = oauthStateStore.get(state);
    if (!storedState || Date.now() - storedState.createdAt > 10 * 60 * 1000) {
      return res.status(400).send('Ongeldige of verlopen OAuth-state.');
    }
    oauthStateStore.delete(state);

    const oauth2Client = createOAuthClient();
    const {tokens} = await oauth2Client.getToken(code);
    const refreshToken = tokens.refresh_token;
    if (!refreshToken) {
      return res.status(400).send('Geen refresh token ontvangen van Google. Probeer opnieuw.');
    }

    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({version: 'v2', auth: oauth2Client});
    const userinfo = await oauth2.userinfo.get();

    upsertGoogleConnection({
      id: uuidv4(),
      agency_id: 'agency_default',
      account_email: userinfo.data.email,
      account_name: userinfo.data.name,
      google_id: userinfo.data.id,
      encrypted_refresh_token: encrypt(refreshToken),
      scopes: oauthScopes.join(' '),
      status: 'connected',
      last_token_refresh_at: new Date().toISOString(),
      last_error: null,
    });

    res.redirect('/');
  } catch (error) {
    console.error('OAuth callback error', formatError(error));
    res.status(500).send(`Google OAuth callback is mislukt: ${formatError(error)}`);
  }
});

app.get('/auth/google', (req, res) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
    return res.status(500).send('Google OAuth is niet geconfigureerd.');
  }

  const oauth2Client = createOAuthClient();
  const state = uuidv4();
  oauthStateStore.set(state, {createdAt: Date.now()});
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: oauthScopes,
    state,
  });

  res.redirect(authUrl);
});

app.get('/auth/logout', (req, res) => {
  deleteGoogleConnection();
  res.redirect('/');
});

app.get('/api/integrations/google/status', (req, res) => {
  const connection = getGoogleConnection();
  if (!connection) {
    return res.json({connected: false, demo: USE_MOCK_DATA === 'true'});
  }
  res.json({
    connected: true,
    demo: false,
    accountEmail: connection.account_email,
    accountName: connection.account_name,
    scopes: connection.scopes,
    status: connection.status,
    updatedAt: connection.updated_at,
    lastTokenRefreshAt: connection.last_token_refresh_at,
    lastError: connection.last_error,
    resourceMappings: getClientResourceMappings(),
  });
});

app.post('/api/integrations/google/reconnect', async (req, res) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
    return res.status(500).json({error: 'Google OAuth is niet geconfigureerd.'});
  }
  const oauth2Client = createOAuthClient();
  const state = uuidv4();
  oauthStateStore.set(state, {createdAt: Date.now()});
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: oauthScopes,
    state,
  });
  res.json({authUrl});
});

app.post('/api/integrations/google/disconnect', (req, res) => {
  deleteGoogleConnection();
  deleteClientResourceMappings();
  res.json({success: true});
});

app.get('/api/ga4/accounts', async (req, res) => {
  if (USE_MOCK_DATA === 'true') {
    return res.json({accounts: []});
  }
  try {
    const auth = getAuthClientFromConnection();
    if (!auth) return res.status(401).json({error:'Nog geen Google-verbinding.'});
    const analyticsadmin = google.analyticsadmin({version: 'v1alpha', auth});
    const response = await analyticsadmin.accountSummaries.list();
    return res.json({accounts: response.data.accountSummaries || []});
  } catch (error) {
    console.error('GA4 accounts error', formatError(error));
    return res.status(500).json({error: formatError(error)});
  }
});

app.get('/api/ga4/properties', async (req, res) => {
  if (USE_MOCK_DATA === 'true') {
    return res.json({properties: []});
  }
  const accountId = req.query.accountId;
  if (!accountId) {
    return res.status(400).json({error:'accountId query parameter is required.'});
  }

  try {
    const auth = getAuthClientFromConnection();
    if (!auth) return res.status(401).json({error:'Nog geen Google-verbinding.'});
    const analyticsadmin = google.analyticsadmin({version: 'v1alpha', auth});
    const response = await analyticsadmin.properties.list({
      filter: `parent:${accountId}`,
    });
    return res.json({properties: response.data.properties || []});
  } catch (error) {
    console.error('GA4 properties error', formatError(error));
    return res.status(500).json({error: formatError(error)});
  }
});

app.get('/api/merchant/accounts', async (req, res) => {
  if (USE_MOCK_DATA === 'true') {
    return res.json({accounts: []});
  }
  try {
    const auth = getAuthClientFromConnection();
    if (!auth) return res.status(401).json({error:'Nog geen Google-verbinding.'});
    const merchant = google.content({version: 'v2.1', auth});
    const response = await merchant.accounts.list({merchantId: process.env.MERCHANT_CENTER_MERCHANT_ID});
    return res.json({accounts: response.data.resources || []});
  } catch (error) {
    console.error('Merchant accounts error', formatError(error));
    return res.status(500).json({error: formatError(error)});
  }
});

app.get('/api/gsc/sites', async (req, res) => {
  if (USE_MOCK_DATA === 'true') {
    return res.json({sites: []});
  }
  try {
    const auth = getAuthClientFromConnection();
    if (!auth) return res.status(401).json({error:'Nog geen Google-verbinding.'});
    const searchconsole = google.searchconsole({version: 'v1', auth});
    const response = await searchconsole.sites.list();
    return res.json({sites: response.data.siteEntry || []});
  } catch (error) {
    console.error('Search Console sites error', formatError(error));
    return res.status(500).json({error: formatError(error)});
  }
});

app.get('/api/gsc/search-analytics', async (req, res) => {
  if (USE_MOCK_DATA === 'true') {
    return res.json({rows: []});
  }
  const siteUrl = req.query.siteUrl || process.env.SEARCH_CONSOLE_SITE_URL;
  if (!siteUrl) {
    return res.status(400).json({error:'siteUrl query parameter is required.'});
  }
  const startDate = req.query.startDate || '7daysAgo';
  const endDate = req.query.endDate || 'today';
  try {
    const auth = getAuthClientFromConnection();
    if (!auth) return res.status(401).json({error:'Nog geen Google-verbinding.'});
    const searchconsole = google.searchconsole({version: 'v1', auth});
    const response = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ['query', 'page'],
        rowLimit: 25,
      },
    });
    return res.json({rows: response.data.rows || []});
  } catch (error) {
    console.error('Search Console analytics error', formatError(error));
    return res.status(500).json({error: formatError(error)});
  }
});

app.get('/api/merchant/products', async (req, res) => {
  if (USE_MOCK_DATA === 'true') {
    return res.json({items: []});
  }
  const merchantId = req.query.merchantId || process.env.MERCHANT_CENTER_MERCHANT_ID;
  if (!merchantId) {
    return res.status(400).json({error:'merchantId query parameter is required.'});
  }
  try {
    const auth = getAuthClientFromConnection();
    if (!auth) return res.status(401).json({error:'Nog geen Google-verbinding.'});
    const merchant = google.content({version: 'v2.1', auth});
    const response = await merchant.products.list({merchantId});
    return res.json({items: response.data.resources || []});
  } catch (error) {
    console.error('Merchant products error', formatError(error));
    return res.status(500).json({error: formatError(error)});
  }
});

app.get('/api/google/resources', async (req, res) => {
  if (USE_MOCK_DATA === 'true') {
    return res.json({
      ga4Accounts: [],
      ga4Properties: [],
      merchantAccounts: [],
      searchConsoleSites: [],
      mappings: getClientResourceMappings(),
    });
  }
  try {
    const auth = getAuthClientFromConnection();
    if (!auth) return res.status(401).json({error:'Nog geen Google-verbinding.'});

    const analyticsadmin = google.analyticsadmin({version: 'v1alpha', auth});
    const searchconsole = google.searchconsole({version: 'v1', auth});
    const merchant = google.content({version: 'v2.1', auth});
    const merchantId = req.query.merchantId || process.env.MERCHANT_CENTER_MERCHANT_ID;
    const accountId = req.query.accountId;

    if (!merchantId) {
      return res.status(400).json({error:'MERCHANT_CENTER_MERCHANT_ID is not configured or merchantId query parameter is missing.'});
    }

    const [accountsRes, sitesRes, merchantRes] = await Promise.all([
      analyticsadmin.accountSummaries.list(),
      searchconsole.sites.list(),
      merchant.accounts.list({merchantId}),
    ]);

    let ga4Properties = [];
    if (accountId) {
      const propertiesRes = await analyticsadmin.properties.list({filter: `parent:${accountId}`});
      ga4Properties = propertiesRes.data.properties || [];
    }

    return res.json({
      ga4Accounts: accountsRes.data.accountSummaries || [],
      ga4Properties,
      merchantAccounts: merchantRes.data.resources || [],
      searchConsoleSites: sitesRes.data.siteEntry || [],
      mappings: getClientResourceMappings(),
    });
  } catch (error) {
    console.error('Google resources error', formatError(error));
    return res.status(500).json({error: formatError(error)});
  }
});

app.get('/api/clients', (req, res) => {
  return res.json({clients: getClients()});
});

app.get('/api/mappings', (req, res) => {
  const {clientId, provider} = req.query;
  if (clientId) {
    return res.json({mappings: getClientResourceMappingsByClient(clientId)});
  }
  if (provider) {
    return res.json({mappings: getClientResourceMappingsByProvider(provider)});
  }
  return res.json({mappings: getClientResourceMappings()});
});

app.delete('/api/mapping/:id', (req, res) => {
  const result = deleteClientResourceMapping(req.params.id);
  return res.json({deleted: result.changes});
});

app.post('/api/ga4/map-property', (req, res) => {
  const {clientId, accountId, propertyId, propertyName, propertyUrl} = req.body;
  if (!clientId || !accountId || !propertyId) {
    return res.status(400).json({error:'clientId, accountId and propertyId are required.'});
  }
  const mapping = {
    id: uuidv4(),
    client_id: clientId,
    provider: 'google',
    resource_type: 'ga4_property',
    resource_id: propertyId,
    resource_name: propertyName || null,
    account_id: accountId,
    property_url: propertyUrl || null,
    active: true,
  };
  createClientResourceMapping(mapping);
  return res.json({mapping});
});

app.post('/api/merchant/map-account', (req, res) => {
  const {clientId, accountId, accountName} = req.body;
  if (!clientId || !accountId) {
    return res.status(400).json({error:'clientId and accountId are required.'});
  }
  const mapping = {
    id: uuidv4(),
    client_id: clientId,
    provider: 'google',
    resource_type: 'merchant_account',
    resource_id: accountId,
    resource_name: accountName || null,
    account_id: accountId,
    property_url: null,
    active: true,
  };
  createClientResourceMapping(mapping);
  return res.json({mapping});
});

app.post('/api/gsc/map-site', (req, res) => {
  const {clientId, siteUrl, permissionLevel} = req.body;
  if (!clientId || !siteUrl) {
    return res.status(400).json({error:'clientId and siteUrl are required.'});
  }
  const mapping = {
    id: uuidv4(),
    client_id: clientId,
    provider: 'google',
    resource_type: 'search_console_property',
    resource_id: siteUrl,
    resource_name: siteUrl,
    account_id: null,
    property_url: siteUrl,
    active: true,
  };
  createClientResourceMapping(mapping);
  return res.json({mapping});
});

app.post('/api/mapping', (req, res) => {
  const payload = req.body;
  if (!payload.clientId || !payload.provider || !payload.resourceType || !payload.resourceId) {
    return res.status(400).json({error:'clientId, provider, resourceType and resourceId are required.'});
  }
  const mapping = {
    id: uuidv4(),
    client_id: payload.clientId,
    provider: payload.provider,
    resource_type: payload.resourceType,
    resource_id: payload.resourceId,
    resource_name: payload.resourceName || null,
    account_id: payload.accountId || null,
    property_url: payload.propertyUrl || null,
    active: payload.active !== false,
  };
  createClientResourceMapping(mapping);
  return res.json({mapping});
});

app.get('/api/auth/status', (req, res) => {
  const connection = getGoogleConnection();
  if (!connection) {
    return res.json({connected: false, demo: USE_MOCK_DATA === 'true', configured: Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_REDIRECT_URI)});
  }
  res.json({connected: true, demo: false, configured: true, accountEmail: connection.account_email});
});

/**
 * Google Ads-cijfers uit Supabase, in de contractvorm uit
 * docs/api-contract-ads.md.
 *
 * De frontend vroeg dit endpoint al aan (js/data/ads-data.js) maar het bestond
 * nog niet, dus live modus liep hier altijd op een fout. De data komt niet uit
 * dit dashboard: max-marketing-os haalt hem bij Google op, normaliseert hem en
 * schrijft hem naar Supabase. Hier wordt alleen gelezen -- twee schrijvers op
 * dezelfde tabellen betekent twee waarheden.
 *
 * `client` accepteert de slug of het uuid uit Supabase. Bij een onbekende
 * klant volgt een 404 met de beschikbare slugs erbij: "geen data" en
 * "verkeerde naam" horen niet op elkaar te lijken.
 */
/**
 * De echte klantenlijst uit Supabase, in de vorm die de frontend verwacht.
 *
 * De frontend draait op SAMPLE_CLIENTS: een lijst met verzonnen klanten waar
 * het hele datamodel op gekoppeld is. Dit endpoint levert de echte klanten in
 * diezelfde vorm, zodat de contextwisselaar en de advertentiepagina's op
 * werkelijke accounts gaan draaien zonder dat de dashboardcode verandert.
 *
 * Velden die Supabase niet kent -- maandbudget, doelen, trackingstatus --
 * komen bewust leeg terug in plaats van met een verzonnen waarde. Een
 * verzonnen budget ziet er in een dashboard precies zo uit als een echt
 * budget, en dat is het soort fout waar je later niet meer op komt.
 */
/**
 * Van de Supabase-rij naar de vorm die het dashboard leest.
 *
 * Ontbreekt de rij, dan is het antwoord null en niet een rij met alles op
 * `true`. Niet beoordeeld is iets anders dan beoordeeld en goed bevonden, en
 * dat verschil is precies waar dit voor bestaat.
 */
function vertaalOordeel(rijen) {
  if (!rijen?.length) return null;

  // Een KPI die op één platform niets betekent, is in het gecombineerde cijfer
  // ook niets waard: de vereniging, niet de doorsnede.
  const onbetrouwbaar = new Set();
  const bevindingen = [];
  for (const rij of rijen) {
    for (const kpi of rij.unreliable_kpis ?? []) onbetrouwbaar.add(kpi);
    // Het platform gaat mee de bevinding in, anders staat er straks "de
    // conversiewaarde is vast" zonder dat iemand weet welk account dat betreft.
    for (const b of rij.findings ?? []) bevindingen.push({...b, platform: rij.platform});
  }

  const alle = (veld) => rijen.every((r) => r[veld] !== false);
  return {
    beoordeeld: true,
    platforms: rijen.map((r) => r.platform),
    betrouwbaar: {
      platformcijfers: alle('platform_metrics_reliable'),
      conversieteller: alle('conversion_count_reliable'),
      conversiewaarde: alle('conversion_value_reliable'),
    },
    onbetrouwbareKpis: [...onbetrouwbaar],
    oordeel: rijen.map((r) => r.verdict).filter(Boolean)[0] ?? null,
    bevindingen,
    periode: {start: rijen[0].assessed_period_start, eind: rijen[0].assessed_period_end},
    beoordeeldOp: rijen.map((r) => r.assessed_at).filter(Boolean).sort().at(-1) ?? null,
  };
}

app.get('/api/clients/live', async (req, res) => {
  const ontbreekt = supabase.ontbrekendeSleutels();
  if (ontbreekt.length) {
    return res.status(503).json({
      message: 'Supabase niet geconfigureerd. Ontbrekend in .env: ' + ontbreekt.join(', ') + '.',
    });
  }
  const vormfout = supabase.sleutelProbleem();
  if (vormfout) return res.status(503).json({message: vormfout});

  try {
    const sb = supabase.maakSupabase();
    const rijen = await sb.lees('clients', {
      kolommen: 'id,slug,name,business_model,website,countries,languages',
      order: 'name.asc',
    });

    // Het voorbehoud reist mee met de klant, niet als losse pagina. Wie een
    // ROAS op het scherm zet hoort in dezelfde beweging te weten of die ROAS
    // op dit account iets betekent -- bij vier van de vijftien klanten niet.
    // Eén oordeel per platform, en dit dashboard toont de platforms door elkaar.
    // Het laatste rijtje houden zou betekenen dat welke sync als laatste liep
    // bepaalt wat er op het scherm staat: bij Whoon zegt Google dat CPA niets
    // betekent en Meta dat alleen ROAS dat niet doet. Vandaar alle rijen, en de
    // vereniging als oordeel -- een KPI die op één platform niets betekent, is
    // in het gecombineerde cijfer ook niets waard.
    const oordelen = new Map();
    try {
      const rijen = await sb.lees('client_kpi_reliability', {
        kolommen: 'client_id,platform,platform_metrics_reliable,conversion_count_reliable,'
          + 'conversion_value_reliable,unreliable_kpis,verdict,findings,assessed_at,'
          + 'assessed_period_start,assessed_period_end',
      });
      for (const r of rijen) oordelen.set(r.client_id, [...(oordelen.get(r.client_id) ?? []), r]);
    } catch (fout) {
      // Geen oordeel is iets anders dan een goed oordeel; dat onderscheid
      // blijft staan doordat `betrouwbaarheid` dan null is in plaats van
      // een vrolijke standaardwaarde.
      console.warn('Betrouwbaarheidsoordeel niet gelezen:', formatError(fout));
    }

    return res.json(rijen.filter((r) => r.slug).map((r) => ({
      // De slug is de sleutel, niet het uuid: daar vraagt de frontend ook mee
      // om /api/google-ads/campaigns, en zo blijft dat een en dezelfde naam.
      id: r.slug,
      name: r.name || r.slug,
      // Null en niet 'leadgen'. Dit veld bepaalt of het dashboard ROAS of CPL
      // toont, welke conversiescopes je mag kiezen en hoe de klant in het
      // agencyoverzicht meetelt. Een gok ziet er daar precies zo uit als een
      // vastgelegd gegeven; `modelVan` valt bij null zichtbaar terug.
      businessModel: r.business_model || null,
      website: r.website || null,
      land: Array.isArray(r.countries) && r.countries.length ? r.countries[0] : null,
      valuta: 'EUR',
      tijdzone: 'Europe/Amsterdam',
      primaryOwnerId: null,
      supportingOwnerIds: [],
      maandbudget: null,
      trackingStatus: null,
      // Bewust geen percentage. `dataHealth` is in de voorbeelddata een score
      // van 0 tot 100, en dit oordeel laat zich daar niet in samenvatten: het
      // zegt niet hoe goed de meting is maar wélke KPI's betekenis hebben.
      // "ROAS klopt hier niet" wordt geen "74 procent".
      dataHealth: null,
      betrouwbaarheid: vertaalOordeel(oordelen.get(r.id)),
      scenario: null,
      bronnen: {},
      doelen: [],
      echt: true,
    })));
  } catch (error) {
    return res.status(502).json({message: formatError(error)});
  }
});

/**
 * Meta Ads, uit dezelfde tabellen als Google.
 *
 * max-marketing-os schrijft Meta sinds vandaag weg onder platform 'meta-ads'.
 * Het contract is hetzelfde als dat van Google; alleen de breakdowns heten
 * anders (advertentiesets en plaatsingen in plaats van advertentiegroepen en
 * zoekwoorden).
 *
 * Staat er niets, dan `aanwezig: false` en niet een 404. Die laatste landt als
 * fout in de console en ziet eruit alsof er iets stuk is, terwijl niet elke
 * klant op Meta adverteert -- Pouw en 123Watches.de bijvoorbeeld niet.
 *
 * LET OP, en dit is geen opmaakpunt. Dit endpoint leest Meta apart en telt
 * niets op; daar gaat het goed. Maar Meta staat inmiddels wél in
 * `performance_snapshots`, en `api.blended_kpis()` telt conversies over
 * platformen heen op terwijl Google en Meta dezelfde aankoop allebei claimen.
 * Elke weergave die op blended_kpis leunt -- de portefeuillepagina om te
 * beginnen -- laat de CPA daardoor te mooi zien.
 *
 * Dat moet aan de databasekant opgelost worden, niet hier: hier weer aftrekken
 * zet dezelfde regel op twee plekken, en dan klopt er één van de twee niet
 * meer zodra iemand de andere aanpast.
 */
/**
 * Doorsnedes van dezelfde uitgaven: per apparaat en per plaatsing.
 *
 * Uit `segment_performance`, een aparte tabel omdat een segmentrij dezelfde
 * euro beschrijft als de campagnerij die erbij hoort. Optellen bij
 * `performance_snapshots` telt elk bedrag twee keer; zie migratie 017.
 *
 * Het platform gaat mee per rij en wordt hier niet weggeteld. Google zegt
 * "Mobiel", Meta zegt "Mobiele app" en "Mobiel web" -- dat zijn verschillende
 * woordenlijsten omdat ze verschillende dingen meten. Ze op naam samenvoegen
 * zou een verdeling opleveren die geen van beide platforms herkent.
 */
/**
 * Welke bronnen leveren werkelijk data voor deze klant?
 *
 * De Databronnen-pagina draaide op een demolaag in localStorage die altijd "0
 * van 2 gekoppeld" zei en beloofde dat de cijfers voorbeelddata bleven. Sinds
 * Google Ads en Meta echt aangesloten zijn is dat niet onvolledig maar onwaar,
 * en dat ondermijnt het vertrouwen in alles wat er verder op het scherm staat.
 *
 * Gekoppeld betekent hier precies één ding: er staat data van deze bron voor
 * deze klant. Geen zelfgerapporteerde status, geen vinkje dat iemand ooit heeft
 * aangezet -- de aanwezigheid van cijfers is het bewijs.
 *
 * Twee kleine vragen per bron in plaats van alles tellen: de oudste en de
 * nieuwste dag. Dat is wat iemand wil weten (loopt het, en tot wanneer) en
 * kost geen zesduizend rijen over de lijn.
 */
const BRONNEN = [
  {platform: 'google-ads', label: 'Google Ads', tabel: 'performance_snapshots',
    omschrijving: 'Zoek-, display- en YouTube-advertenties'},
  {platform: 'meta-ads', label: 'Meta Ads', tabel: 'performance_snapshots',
    omschrijving: 'Facebook- en Instagram-advertenties'},
  {platform: 'ga4', label: 'Google Analytics 4', tabel: 'segment_performance',
    omschrijving: 'Sessies en regio over al het verkeer'},
];

/**
 * Alle klanten naast elkaar, gerangschikt op wat er aan de hand is.
 *
 * Dit is de weergave die pas bestaat nu alle vijftien accounts op één plek
 * staan, en het is de vraag die een bureau maandagochtend stelt: waar begin ik.
 * Per klant apart doorklikken beantwoordt die vraag niet, want dan zie je pas
 * dat er iets mis is als je er al bent.
 *
 * Bewust geen score. Een getal van 0 tot 100 verbergt waaróm een klant bovenaan
 * staat, en dan gaat iemand het getal vertrouwen in plaats van de reden. Er
 * staan signalen, elk met hun eigen bewijs, en de volgorde volgt de zwaarte van
 * het zwaarste signaal.
 *
 * De cijfers komen van `blended_kpis()` in de database. Die laat grovere rijen
 * vallen waar fijnere hetzelfde bestrijken; dat hier overdoen zou dezelfde
 * regel op twee plekken zetten, en daar ontstaat een dubbeltelling die niemand
 * ziet.
 */

app.get('/api/portfolio', async (req, res) => {
  const ontbreekt = supabase.ontbrekendeSleutels();
  if (ontbreekt.length) {
    return res.status(503).json({
      message: 'Supabase niet geconfigureerd. Ontbrekend in .env: ' + ontbreekt.join(', ') + '.',
    });
  }
  const vormfout = supabase.sleutelProbleem();
  if (vormfout) return res.status(503).json({message: vormfout});

  const tot = String(req.query.until || '').trim();
  const van = String(req.query.since || '').trim();
  if (!van || !tot) return res.status(400).json({message: 'Parameters `since` en `until` zijn verplicht.'});

  try {
    const sb = supabase.maakSupabase();
    const klanten = await sb.lees('clients', {
      kolommen: 'id,slug,name,business_model', order: 'name.asc',
    });

    const oordelen = new Map();
    for (const r of await sb.lees('client_kpi_reliability', {
      kolommen: 'client_id,platform,conversion_count_reliable,conversion_value_reliable,unreliable_kpis,findings',
    })) {
      oordelen.set(r.client_id, [...(oordelen.get(r.client_id) ?? []), r]);
    }

    // De even lange periode ervoor, zodat "duurder geworden" iets betekent.
    const dagen = Math.round((Date.parse(tot) - Date.parse(van)) / 86400000) + 1;
    const vorigeEind = nieuweDatum(van, -1);
    const vorigeStart = nieuweDatum(vorigeEind, -(dagen - 1));

    const rijen = [];
    for (const klant of klanten.filter((k) => k.slug)) {
      const [nu] = (await sb.roepFunctie('blended_kpis', {
        p_client_id: klant.id, p_start: van, p_end: tot,
      })) ?? [];
      const [vorig] = (await sb.roepFunctie('blended_kpis', {
        p_client_id: klant.id, p_start: vorigeStart, p_end: vorigeEind,
      })) ?? [];
      if (!nu || Number(nu.spend ?? 0) <= 0) continue;

      rijen.push({
        slug: klant.slug,
        naam: klant.name || klant.slug,
        businessModel: klant.business_model || 'leadgen',
        nu: getallen(nu),
        vorig: vorig ? getallen(vorig) : null,
        signalen: signalenVoor(nu, vorig, oordelen.get(klant.id) ?? []),
      });
    }

    // Zwaarste signaal eerst; bij gelijke zwaarte de grootste uitgaven, want
    // daar staat het meeste geld op het spel.
    rijen.sort((a, b) => {
      return zwaarste(b.signalen) - zwaarste(a.signalen) || b.nu.spend - a.nu.spend;
    });

    return res.json({
      periode: {van, tot, dagen},
      vergelijking: {van: vorigeStart, tot: vorigeEind},
      klanten: rijen,
      totaal: {
        spend: Math.round(rijen.reduce((a, r) => a + r.nu.spend, 0) * 100) / 100,
        klanten: rijen.length,
        metSignaal: rijen.filter((r) => r.signalen.length).length,
      },
    });
  } catch (error) {
    return res.status(502).json({message: formatError(error)});
  }
});


function nieuweDatum(iso, dagen) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dagen);
  return d.toISOString().slice(0, 10);
}

function getallen(rij) {
  const g = (v) => (v == null ? null : Number(v));
  return {
    spend: Math.round((g(rij.spend) ?? 0) * 100) / 100,
    clicks: g(rij.clicks) ?? 0,
    impressions: g(rij.impressions) ?? 0,
    results: Math.round((g(rij.conversions_primary) ?? 0) * 100) / 100,
    ctr: g(rij.ctr),
    cpc: g(rij.cpc),
    cpa: g(rij.cpa),
    roas: g(rij.roas),
    dekking: {gedekt: g(rij.covered_days) ?? 0, gevraagd: g(rij.requested_days) ?? 0},
  };
}

app.get('/api/databronnen', async (req, res) => {
  const ontbreekt = supabase.ontbrekendeSleutels();
  if (ontbreekt.length) {
    return res.status(503).json({
      message: 'Supabase niet geconfigureerd. Ontbrekend in .env: ' + ontbreekt.join(', ') + '.',
    });
  }
  const vormfout = supabase.sleutelProbleem();
  if (vormfout) return res.status(503).json({message: vormfout});

  const gevraagd = String(req.query.client || '').trim();
  if (!gevraagd) return res.status(400).json({message: 'Parameter `client` ontbreekt.'});

  try {
    const sb = supabase.maakSupabase();
    const klanten = await sb.lees('clients', {kolommen: 'id,slug'});
    const klant = klanten.find((c) => c.slug === gevraagd || c.id === gevraagd);
    if (!klant) return res.status(404).json({message: 'Onbekende klant "' + gevraagd + '".'});

    const bronnen = [];
    for (const bron of BRONNEN) {
      const filters = {client_id: klant.id, platform: bron.platform};
      const [nieuwste] = await sb.lees(bron.tabel, {
        kolommen: 'snapshot_date,fetched_at', filters, order: 'snapshot_date.desc', limiet: 1,
      });
      if (!nieuwste) {
        bronnen.push({...bron, gekoppeld: false});
        continue;
      }
      const [oudste] = await sb.lees(bron.tabel, {
        kolommen: 'snapshot_date', filters, order: 'snapshot_date.asc', limiet: 1,
      });
      bronnen.push({
        ...bron,
        gekoppeld: true,
        periode: {van: oudste?.snapshot_date ?? null, tot: nieuwste.snapshot_date},
        laatstOpgehaald: nieuwste.fetched_at ?? null,
      });
    }

    return res.json({bronnen, gekoppeld: bronnen.filter((b) => b.gekoppeld).length, totaal: bronnen.length});
  } catch (error) {
    return res.status(502).json({message: formatError(error)});
  }
});

/**
 * De GA4-module van één klant.
 *
 * Leest twee dingen uit Supabase en rekent er één beeld van: de instellingen
 * (klanttype en conversiedefinities) en het opgehaalde rapport. Belt zelf geen
 * GA4 -- dat doet max-marketing-os, dat de credentials heeft.
 *
 * Het klanttype bepaalt de hele inhoud. Staat er geen instellingenrij, dan is
 * de module niet ingericht, en dat is iets anders dan ingericht en leeg: in het
 * eerste geval weten we niet eens wat een conversie is voor deze klant.
 */
/**
 * De dagreeks van alle klanten, in de vorm die het uitgebreide dashboard leest.
 *
 * WAAROM DIT ENDPOINT BESTAAT
 *
 * De uitgebreide kant rekent alles door vanuit één functie: `getClientRows`.
 * Die las tot nu toe uitsluitend uit de voorbeelddataset, en de vijftien echte
 * klanten staan daar niet in. Elke pagina meldde daardoor "er is binnen deze
 * selectie helemaal geen data" -- terwijl er 126 GA4-rapporten en tienduizenden
 * advertentierijen in Supabase staan.
 *
 * Dit endpoint levert precies die vorm: één rij per klant, per kanaal, per dag.
 * Alles wat het dashboard daarna doet -- filteren op periode, op kanaal,
 * totalen, deltas, doelen, signalen -- werkt dan vanzelf op echte cijfers.
 *
 * WAT ER NIET IN ZIT, EN WAAROM DAT ZO BLIJFT
 *
 * Het model kent velden die uit een CRM komen: gekwalificeerde leads,
 * afspraken, offertes, klanten, pijplijnwaarde. Die meet niemand hier. Ze
 * blijven leeg in plaats van geschat, want een verzonnen pijplijnwaarde ziet er
 * precies zo uit als een gemeten.
 *
 * Advertentiekanalen leveren uitgaven, vertoningen, klikken en conversies; GA4
 * levert sessies en gebruikers over de hele site. Die laatste komen daarom op
 * een eigen kanaalrij en worden niet bij een advertentiekanaal opgeteld: dan
 * zouden sessies van organisch verkeer aan Google Ads worden toegeschreven.
 */
app.get('/api/reeks', async (req, res) => {
  const ontbreekt = supabase.ontbrekendeSleutels();
  if (ontbreekt.length) {
    return res.status(503).json({
      message: 'Supabase niet geconfigureerd. Ontbrekend in .env: ' + ontbreekt.join(', ') + '.',
    });
  }

  try {
    const sb = supabase.maakSupabase();
    const klanten = await sb.lees('clients', {kolommen: 'id,slug,name,business_model'});
    if (!klanten.length) return res.json({klanten: {}});

    const sinds = geldigeDatum(req.query.since) ?? nieuweDatum(new Date().toISOString().slice(0, 10), -400);

    // Eén vraag voor alle klanten samen: vijftien losse vragen om dezelfde
    // tabel zijn vijftien round-trips. De rijen worden hier verdeeld.
    const snapshots = await sb.lees('performance_snapshots', {
      kolommen: 'client_id,platform,snapshot_date,period_end,granularity,spend,impressions,clicks,conversions_primary,revenue',
      // De operator hoort hier in de waarde; zie `lees` in supabase.js.
      filters: {snapshot_date: `gte.${sinds}`, granularity: 'eq.day'},
      order: 'snapshot_date.asc',
    });

    const perKlant = new Map(klanten.map((k) => [k.id, {
      slug: k.slug,
      businessModel: k.business_model || 'leadgen',
      perDag: new Map(),
      kanalen: new Set(),
    }]));

    for (const r of snapshots) {
      const klant = perKlant.get(r.client_id);
      if (!klant) continue;
      const kanaal = KANAAL_PER_PLATFORM[r.platform];
      if (!kanaal) continue;
      klant.kanalen.add(kanaal);
      hoopOp(klant.perDag, `${r.snapshot_date}|${kanaal}`, {
        date: r.snapshot_date,
        channel: kanaal,
        spend: getal(r.spend),
        impressions: getal(r.impressions),
        clicks: getal(r.clicks),
        conversies: getal(r.conversions_primary),
        revenue: getal(r.revenue),
      });
    }

    // GA4 erbij: sessies en gebruikers over de hele site, op een eigen
    // kanaalrij. Uit het langste rapport dat er per klant is, zodat een
    // dashboardperiode van negentig dagen ook gevuld is.
    await voegGa4Toe(sb, perKlant);

    const uit = {};
    for (const klant of perKlant.values()) {
      const rijen = [...klant.perDag.values()].map((r) => vormRij(r, klant.businessModel));
      if (!rijen.length) continue;
      // Op de slug en niet op de uuid: `/api/clients/live` levert de slug als
      // `id`, en het dashboard zoekt hier met datzelfde id. Op de uuid
      // sleutelen levert een store op die nooit een treffer geeft -- en dan
      // staat er "geen data" zonder dat er iets stuk is.
      uit[klant.slug] = {
        slug: klant.slug,
        businessModel: klant.businessModel,
        kanalen: [...klant.kanalen],
        rijen: rijen.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.channel.localeCompare(b.channel))),
      };
    }

    return res.json({
      klanten: uit,
      sinds,
      // Wat er niet in zit hoort zichtbaar te zijn, niet stilzwijgend leeg.
      nietGemeten: NIET_GEMETEN,
    });
  } catch (error) {
    return res.status(502).json({message: formatError(error)});
  }
});

/**
 * De detailcijfers van één klant: campagnes en doorsnedes over één periode.
 *
 * WAAROM APART VAN /api/reeks
 *
 * `/api/reeks` levert kanaalrijen per dag voor alle klanten samen; daar rekent
 * het dashboard zijn totalen en grafieken uit. Campagnedetail hoort daar niet
 * bij: vijftien klanten maal een jaar maal een paar honderd campagnes is een
 * antwoord van tientallen megabytes, en je kijkt altijd naar één klant tegelijk.
 *
 * WAT HIER WEL EN NIET IN ZIT
 *
 * Campagnes komen uit `performance_snapshots` en dragen hun status mee. Apparaat
 * en regio komen uit `segment_performance`, dat dagrijen heeft en dus elke
 * periode aankan.
 *
 * Landingspagina's en bron/medium zitten er níet in. Die bestaan alleen in de
 * GA4-rapporten, en die zijn per vast venster opgehaald -- 7, 28 of 90 volledige
 * dagen. Ze hier tonen voor een willekeurige periode zou betekenen dat de
 * tabellen een andere periode beslaan dan de KPI's erboven, zonder dat iemand
 * dat ziet. Ze staan wél op de Website-pagina, waar het venster expliciet is.
 */
app.get('/api/klantdetail', async (req, res) => {
  const ontbreekt = supabase.ontbrekendeSleutels();
  if (ontbreekt.length) {
    return res.status(503).json({
      message: 'Supabase niet geconfigureerd. Ontbrekend in .env: ' + ontbreekt.join(', ') + '.',
    });
  }

  const gevraagd = String(req.query.client || '').trim();
  if (!gevraagd) return res.status(400).json({message: 'Parameter `client` ontbreekt.'});

  try {
    const sb = supabase.maakSupabase();
    const {klant, beschikbaar} = await zoekKlant(sb, gevraagd);
    if (!klant) {
      return res.status(404).json({message: 'Onbekende klant "' + gevraagd + '".', beschikbaar});
    }

    const sinds = geldigeDatum(req.query.since);
    const tot = geldigeDatum(req.query.until);
    if (!sinds || !tot || sinds > tot) {
      return res.status(400).json({message: 'Parameters `since` en `until` vereisen YYYY-MM-DD, met since <= until.'});
    }

    const [snapshots, campagnerijen, segmenten, entiteiten] = await Promise.all([
      sb.lees('performance_snapshots', {
        kolommen: 'campaign_id,platform,spend,impressions,clicks,conversions_primary,revenue',
        filters: {
          client_id: klant.id,
          granularity: 'eq.day',
          snapshot_date: `gte.${sinds}`,
          period_end: `lte.${tot}`,
        },
      }),
      leesCampagnes(sb, klant.id, null),
      sb.lees('segment_performance', {
        kolommen: 'platform,dimension,dimension_value,spend,clicks,conversions_primary,revenue,sessions,users',
        filters: {
          client_id: klant.id,
          granularity: 'eq.day',
          snapshot_date: `gte.${sinds}`,
          period_end: `lte.${tot}`,
        },
      }),
      leesEntiteiten(sb, klant.id),
    ]);

    const meta = new Map(campagnerijen.map((c) => [c.id, c]));
    const perCampagne = new Map();
    for (const r of snapshots) {
      const sleutel = `${r.platform}|${r.campaign_id ?? 'onbekend'}`;
      const c = perCampagne.get(sleutel) ?? {
        platform: r.platform, campaignId: r.campaign_id,
        spend: 0, impressions: 0, clicks: 0, conversies: 0, revenue: 0,
      };
      c.spend += Number(r.spend) || 0;
      c.impressions += Number(r.impressions) || 0;
      c.clicks += Number(r.clicks) || 0;
      c.conversies += Number(r.conversions_primary) || 0;
      c.revenue += Number(r.revenue) || 0;
      perCampagne.set(sleutel, c);
    }

    const campagnes = [...perCampagne.values()].map((c) => {
      const m = meta.get(c.campaignId) ?? {};
      return {
        kanaal: KANAAL_PER_PLATFORM[c.platform] ?? c.platform,
        naam: m.name ?? 'Onbekende campagne',
        type: m.channel_type ?? null,
        // De status van nu, naast cijfers van de periode. Een campagne die
        // gisteren is uitgezet heeft deze uitgaven wél gedaan.
        status: m.status ?? null,
        platformStatus: m.platform_status ?? null,
        kosten: rond(c.spend),
        vertoningen: c.impressions,
        klikken: c.clicks,
        conversies: rond(c.conversies),
        conversiewaarde: rond(c.revenue),
      };
    }).sort((a, b) => b.kosten - a.kosten);

    return res.json({
      klant: {slug: klant.slug, naam: klant.name || klant.slug},
      periode: {start: sinds, eind: tot},
      campagnes,
      verdelingen: {
        apparaten: verdeling(segmenten, 'device'),
        regios: verdeling(segmenten, 'region'),
        plaatsingen: verdeling(segmenten, 'placement'),
        // Wie er bereikt is, niet wie er aangesproken werd: leeftijd en
        // geslacht zijn wat Meta over de bereikte doelgroep prijsgeeft. De
        // gedefinieerde doelgroepen staan in de advertentiesets.
        doelgroepen: [...verdeling(segmenten, 'age'), ...verdeling(segmenten, 'gender')],
      },
      ...entiteitenUit(entiteiten, {start: sinds, eind: tot}),
      // Uitgeschreven wat hier níet in zit, zodat een lege tabel niet als
      // "geen resultaat" gelezen wordt.
      nietBeschikbaar: {
        landingspaginas: 'Alleen per vast GA4-venster beschikbaar; zie de Website-pagina.',
        sourceMedium: 'Alleen per vast GA4-venster beschikbaar; zie de Website-pagina.',
        // Creatives hebben geen eigen cijfers bij Meta: een advertentie draagt
        // de creatie, en de prestaties horen bij de advertentie. De
        // advertentietab is dus waar je ze ziet.
        creatives: 'Meta meet geen prestaties per creatie; die horen bij de advertentie. Zie de tab Advertenties.',
      },
    });
  } catch (error) {
    return res.status(502).json({message: formatError(error)});
  }
});

/**
 * Eén doorsnede, opgeteld over de periode.
 *
 * Per platform apart houden en niet samenvoegen: Google zegt "Mobiel", Meta
 * zegt "Mobiele app" en "Mobiel web", GA4 zegt "mobile". Ze op naam samenvoegen
 * levert een verdeling op die geen van drieën herkent.
 */
function verdeling(rijen, dimensie) {
  const per = new Map();
  for (const r of rijen) {
    if (r.dimension !== dimensie) continue;
    const sleutel = `${r.platform}|${r.dimension_value}`;
    const v = per.get(sleutel) ?? {
      platform: r.platform, naam: r.dimension_value,
      kosten: 0, klikken: 0, conversies: 0, conversiewaarde: 0, sessies: 0, gebruikers: 0,
    };
    v.kosten += Number(r.spend) || 0;
    v.klikken += Number(r.clicks) || 0;
    v.conversies += Number(r.conversions_primary) || 0;
    v.conversiewaarde += Number(r.revenue) || 0;
    v.sessies += Number(r.sessions) || 0;
    v.gebruikers += Number(r.users) || 0;
    per.set(sleutel, v);
  }
  return [...per.values()]
    .map((v) => ({
      ...v,
      kosten: rond(v.kosten), conversies: rond(v.conversies), conversiewaarde: rond(v.conversiewaarde),
    }))
    .sort((a, b) => (b.kosten - a.kosten) || (b.sessies - a.sessies));
}

const rond = (v) => Math.round((Number(v) || 0) * 100) / 100;

/**
 * De entiteitrijen van een klant: advertentiegroepen, zoekwoorden, zoektermen,
 * advertentiesets en advertenties.
 *
 * Zonder periodefilter: welke periode er beschikbaar is, bepaalt de
 * ophaalronde, niet de vraag. Dat filter hoort een niveau hoger -- zie
 * `entiteitenUit`.
 */
async function leesEntiteiten(sb, clientId) {
  try {
    return await sb.lees('entity_performance', {
      kolommen: 'platform,entity_type,external_id,name,campaign_name,ad_group_name,detail,'
        + 'period_start,period_end,spend,impressions,clicks,conversions_primary,revenue',
      filters: {client_id: clientId},
      order: 'period_start.desc',
    });
  } catch (error) {
    // Zonder migratie 021 bestaat deze tabel niet. De rest van het antwoord
    // blijft dan staan; dat is beter dan het hele endpoint laten vallen.
    if (/\(404\)/.test(String(error && error.message))) return [];
    throw error;
  }
}

/**
 * De entiteiten per soort, uit de periode die het best bij de vraag past.
 *
 * Deze rijen worden per periode opgehaald en niet per dag -- zoekwoorden en
 * zoektermen zijn een lange staart, en bij Whoon leverde één maand 31.406
 * zoekwoordrijen per dag op. Het gevolg is dat de opgeslagen periode zelden
 * exact gelijk is aan wat het dashboard vraagt: dat bereik schuift elke dag op.
 *
 * Bij een exacte treffer geen probleem. Bij afwijking nemen we de meest recente
 * opgeslagen periode en zeggen erbij welke dat is. De cijfers zijn waar voor
 * hún periode; wat niet mag gebeuren is dat ze stilzwijgend doorgaan voor de
 * periode die erboven staat.
 */
function entiteitenUit(rijen, gevraagd) {
  const soorten = {
    advertentiegroepen: 'ad_group',
    zoekwoorden: 'keyword',
    zoektermen: 'search_term',
    advertentiesets: 'adset',
    advertenties: 'ad',
  };

  const uit = {entiteiten: {}, entiteitPeriode: {}};
  for (const [naam, type] of Object.entries(soorten)) {
    const vanType = rijen.filter((r) => r.entity_type === type);
    if (!vanType.length) { uit.entiteiten[naam] = []; continue; }

    const exact = vanType.filter((r) => r.period_start === gevraagd.start && r.period_end === gevraagd.eind);
    const gekozen = exact.length ? exact : vanType.filter((r) => r.period_start === vanType[0].period_start);

    uit.entiteiten[naam] = gekozen
      .map((r) => ({
        platform: r.platform,
        kanaal: KANAAL_PER_PLATFORM[r.platform] ?? r.platform,
        naam: r.name,
        campagne: r.campaign_name ?? null,
        advertentiegroep: r.ad_group_name ?? null,
        detail: r.detail ?? {},
        kosten: rond(r.spend),
        vertoningen: Number(r.impressions) || 0,
        klikken: Number(r.clicks) || 0,
        conversies: rond(r.conversions_primary),
        conversiewaarde: rond(r.revenue),
      }))
      .sort((a, b) => b.kosten - a.kosten);

    uit.entiteitPeriode[naam] = {
      start: gekozen[0].period_start,
      eind: gekozen[0].period_end,
      // Waar is dit anders dan wat er gevraagd werd? Dat hoort op het scherm.
      afwijkend: exact.length === 0,
    };
  }
  return uit;
}

/** Onze platformnamen naar de kanaalsleutels van het dashboard. */
const KANAAL_PER_PLATFORM = {'google-ads': 'google_ads', 'meta-ads': 'meta_ads'};

/**
 * Velden die het model kent maar die hier niemand meet.
 *
 * Ze blijven leeg. Een geschatte pijplijnwaarde ziet er precies zo uit als een
 * gemeten, en het verschil is aan het scherm niet te zien.
 */
const NIET_GEMETEN = [
  'qualifiedLeads', 'appointments', 'quotes', 'customers', 'pipelineValue',
  'formStarts', 'landingPageViews', 'engagement',
];

function hoopOp(kaart, sleutel, waarden) {
  const bestaand = kaart.get(sleutel);
  if (!bestaand) { kaart.set(sleutel, waarden); return; }
  for (const [veld, waarde] of Object.entries(waarden)) {
    if (typeof waarde !== 'number') continue;
    bestaand[veld] = (bestaand[veld] ?? 0) + waarde;
  }
}

/**
 * Eén rij in de vorm die het model verwacht.
 *
 * Bij leadgen gaat de conversieteller in `conversies.leads`; het dashboard telt
 * conversietypen op en heeft er dus een naam voor nodig. Bij e-commerce zijn
 * `purchases` en `revenue` gewone velden.
 */
function vormRij(r, businessModel) {
  const basis = {
    date: r.date,
    channel: r.channel,
    spend: r.spend,
    impressions: r.impressions,
    clicks: r.clicks,
    sessions: r.sessions ?? null,
    users: r.users ?? null,
  };
  if (businessModel === 'ecommerce') {
    return {...basis, purchases: r.conversies ?? r.purchases ?? null, revenue: r.revenue};
  }
  return {
    ...basis,
    revenue: r.revenue,
    ...(r.conversies == null ? {} : {conversies: {leads: r.conversies}}),
  };
}

/** Sessies en gebruikers uit het langste GA4-rapport per klant. */
async function voegGa4Toe(sb, perKlant) {
  let rapporten;
  try {
    rapporten = await sb.lees('ga4_reports', {
      kolommen: 'client_id,period_start,period_end,payload',
      order: 'period_start.asc',
    });
  } catch {
    // Zonder migratie 019 bestaat deze tabel niet. De advertentiecijfers
    // blijven dan gewoon staan; dat is beter dan het hele endpoint laten vallen.
    return;
  }

  const langstePerKlant = new Map();
  for (const r of rapporten) {
    const dagen = (r.payload?.dagreeks ?? []).length;
    const huidig = langstePerKlant.get(r.client_id);
    if (!huidig || dagen > huidig.dagen) langstePerKlant.set(r.client_id, {dagen, payload: r.payload});
  }

  for (const [clientId, {payload}] of langstePerKlant) {
    const klant = perKlant.get(clientId);
    if (!klant) continue;
    klant.kanalen.add('ga4');
    for (const dag of payload?.dagreeks ?? []) {
      if (!dag.datum) continue;
      klant.perDag.set(`${dag.datum}|ga4`, {
        date: dag.datum,
        channel: 'ga4',
        sessions: getal(dag.sessies),
        users: getal(dag.gebruikers),
        // Geen uitgaven: GA4 kost niets en meet de hele site. Deze rij op nul
        // zetten zou "geen advertentie-uitgaven" suggereren waar het "niet van
        // toepassing" is.
        spend: null, impressions: null, clicks: null,
      });
    }
  }
}

function geldigeDatum(waarde) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(waarde ?? '')) ? String(waarde) : null;
}

function getal(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

app.get('/api/ga4', async (req, res) => {
  const ontbreekt = supabase.ontbrekendeSleutels();
  if (ontbreekt.length) {
    return res.status(503).json({
      message: 'Supabase niet geconfigureerd. Ontbrekend in .env: ' + ontbreekt.join(', ') + '.',
    });
  }

  const gevraagd = String(req.query.client || '').trim();
  if (!gevraagd) return res.status(400).json({message: 'Parameter `client` ontbreekt.'});

  try {
    const sb = supabase.maakSupabase();
    const {klant, beschikbaar} = await zoekKlant(sb, gevraagd);
    if (!klant) {
      return res.status(404).json({message: 'Onbekende klant "' + gevraagd + '".', beschikbaar});
    }

    const instellingen = await leesGa4Instellingen(sb, klant.id);
    if (instellingen === 'tabel_ontbreekt') {
      return res.json({
        status: 'niet_ingericht',
        reden: 'migratie',
        melding: 'De GA4-tabellen staan nog niet in Supabase. Draai migratie 019 uit '
          + 'max-marketing-os en daarna `node bin/ads.js sync-ga4 alle`.',
      });
    }
    if (!instellingen) {
      return res.json({
        status: 'niet_ingericht',
        reden: 'geen_klanttype',
        melding: 'Voor deze klant is nog niet vastgesteld of het een leadgeneratie- of '
          + 'e-commerceklant is. Zonder dat weten we niet welke gebeurtenis een '
          + 'bedrijfsresultaat is. Draai `node bin/ads.js ga4-doelen ' + klant.slug + '`.',
      });
    }

    const periode = periodeUitVraag(req.query);
    const modus = req.query.vergelijking === 'vorigJaar' ? 'vorigJaar' : 'vorige';
    const vorigePeriode = ga4Contract.vergelijkingsperiode(periode, modus);

    // Allebei de perioden in één keer: ze hangen alleen van de klant af.
    const [rapportRij, vorigeRij] = await Promise.all([
      leesGa4Rapport(sb, klant.id, periode),
      vorigePeriode ? leesGa4Rapport(sb, klant.id, vorigePeriode) : null,
    ]);

    if (!rapportRij) {
      // Welke perioden er wél zijn. Zonder dat is "geen cijfers" niet te
      // onderscheiden van "de module werkt niet", en gaat iemand zoeken naar
      // een storing die een datumverschil is.
      const beschikbaar = await beschikbarePerioden(sb, klant.id);
      return res.json({
        status: 'geen_data',
        klanttype: instellingen.client_type,
        property: propertyUit(instellingen),
        periode,
        venster: vensterUit(req.query),
        beschikbaar,
        melding: 'Er is voor deze periode nog geen GA4-rapport opgehaald. Draai '
          + '`node bin/ads.js sync-ga4 ' + klant.slug + ' ' + periode.start + ' ' + periode.eind + '`.',
      });
    }

    const rapport = rapportRij.payload;
    const vorig = vorigeRij?.payload ?? null;

    // Een vergelijking tussen twee verschillende definities is geen
    // vergelijking. Beter geen dan een die stilzwijgend appels en peren telt.
    const definitieGewijzigd = Boolean(vorigeRij && vorigeRij.fingerprint !== rapportRij.fingerprint);

    // Nul sessies in de vorige periode is meestal geen daling maar een property
    // die toen nog niet bestond. Waltmanns property is van maart 2026; een
    // vergelijking met september 2025 leest dan als oneindige groei. De cijfers
    // blijven staan -- ze zijn waar -- maar de pagina zegt erbij wat het is.
    const vorigeLeeg = Boolean(vorig && Number(vorig.totalen?.sessies ?? 0) === 0);
    const bruikbaarVorig = definitieGewijzigd ? null : vorig;

    const prioriteit = instellingen.priority ?? null;
    const doorsnedes = Object.keys(rapport.rapporten ?? {});
    const tabellen = {};
    for (const d of doorsnedes) {
      const tabel = ga4Contract.doorsnedeTabel(rapport, d, {vorig: bruikbaarVorig});
      tabellen[d] = {
        ...tabel,
        dekking: ga4Contract.dekkingVanTabel(tabel, rapport.meldingen ?? []),
      };
    }

    const antwoord = {
      status: 'ok',
      klant: {slug: klant.slug, naam: klant.name || klant.slug},
      klanttype: instellingen.client_type,
      prioriteit,
      property: propertyUit(instellingen),
      doelen: rapport.doelen ?? {},
      periode,
      venster: vensterUit(req.query),
      vergelijking: vorigePeriode
        ? {
            ...vorigePeriode,
            mode: modus,
            beschikbaar: Boolean(bruikbaarVorig),
            // Uitgeschreven waarom hij ontbreekt: "geen vergelijking" zonder
            // reden laat iemand denken dat de data er niet is.
            reden: bruikbaarVorig ? null
              : definitieGewijzigd
                ? 'De conversiedefinitie is tussen deze twee perioden gewijzigd; de cijfers zijn niet vergelijkbaar.'
                : 'Voor die periode is nog geen rapport opgehaald.',
            // Apart van `reden`: de vergelijking is er wél, hij betekent alleen
            // iets anders dan hij lijkt.
            voorbehoud: vorigeLeeg && bruikbaarVorig
              ? 'In de vergelijkingsperiode is geen enkel bezoek gemeten. Waarschijnlijk bestond '
                + 'deze property toen nog niet, of liep de meting nog niet. Elke stijging hieronder '
                + 'is dan een vergelijking met niets.'
              : null,
          }
        : null,
      kpis: ga4Contract.kpiGroepen(rapport, bruikbaarVorig, {prioriteit}),
      tabellen,
      dagreeks: rapport.dagreeks ?? [],
      doelReeksen: rapport.doelReeksen ?? {},
      producten: ga4Contract.productTabel(rapport, {vorig: bruikbaarVorig}),
      stappen: rapport.stappen ?? null,
      gebeurtenissen: rapport.gebeurtenissen ?? [],
      meldingen: rapport.meldingen ?? [],
      // De laatste geslaagde synchronisatie, en of de laatste dag nog kan
      // schuiven. GA4 verwerkt tot ongeveer 48 uur na.
      synchronisatie: {
        opgehaaldOp: rapportRij.fetched_at ?? null,
        nogInVerwerking: ga4Contract.nogInVerwerking(periode),
      },
    };

    // De inzichten leunen op het volledige antwoord -- KPI's, tabellen en
    // producten -- dus die komen er als laatste bij. Hoogstens vijf, en geen
    // als de cijfers ze niet dragen: wie altijd vijf kaarten toont leert
    // iedereen ze te negeren.
    return res.json({...antwoord, inzichten: ga4Inzichten(antwoord)});
  } catch (error) {
    return res.status(502).json({message: formatError(error)});
  }
});

/**
 * De instellingenrij, of een reden waarom hij er niet is.
 *
 * Een ontbrekende tabel is geen fout maar een volgorde: migratie 019 maakt hem
 * aan, en tussen het uitrollen van deze code en het draaien van die migratie
 * hoort het endpoint een bruikbaar antwoord te geven. Andere fouten gaan wél
 * door -- een 401 betekent dat de rechten niet kloppen, en dat als "niet
 * ingericht" tonen verbergt een echt probleem.
 */
async function leesGa4Instellingen(sb, clientId) {
  try {
    const rijen = await sb.lees('client_ga4_settings', {filters: {client_id: clientId}, limiet: 1});
    return rijen[0] ?? null;
  } catch (error) {
    if (/\(404\)/.test(String(error && error.message))) return 'tabel_ontbreekt';
    throw error;
  }
}

async function leesGa4Rapport(sb, clientId, periode) {
  try {
    const rijen = await sb.lees('ga4_reports', {
      filters: {client_id: clientId, period_start: periode.start, period_end: periode.eind},
      limiet: 1,
    });
    return rijen[0] ?? null;
  } catch (error) {
    if (/\(404\)/.test(String(error && error.message))) return null;
    throw error;
  }
}

/** Welk venster er gevraagd is, of null bij een eigen periode. */
function vensterUit(query) {
  const gevraagd = Number(query.venster);
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (iso.test(query.since ?? '') && iso.test(query.until ?? '')) return null;
  return ga4Contract.VENSTERS.includes(gevraagd) ? gevraagd : 28;
}

/** De perioden waarvoor wél een rapport klaarstaat, nieuwste eerst. */
async function beschikbarePerioden(sb, clientId) {
  try {
    const rijen = await sb.lees('ga4_reports', {
      kolommen: 'period_start,period_end',
      filters: {client_id: clientId},
      order: 'period_start.desc',
      limiet: 12,
    });
    return rijen.map((r) => ({start: r.period_start, eind: r.period_end}));
  } catch {
    return [];
  }
}

function propertyUit(rij) {
  return {
    id: rij.property_id ?? null,
    naam: rij.property_name ?? null,
    // Tijdzone en valuta horen bij elke weergave: "de laatste 28 dagen" betekent
    // iets anders per tijdzone, en een omzet zonder valuta is een getal zonder
    // eenheid.
    tijdzone: rij.time_zone ?? null,
    valuta: rij.currency_code ?? null,
    vastgesteldOp: rij.determined_at ?? null,
    bron: rij.determined_from ?? null,
  };
}

/**
 * De gevraagde periode.
 *
 * De GA4-module heeft een eigen vensterkeuze en volgt niet het periodefilter
 * van de advertentiepagina's. Dat is geen eigenzinnigheid maar noodzaak: dat
 * filter kent "Afgelopen 30 dagen" inclusief vandaag, en een rapport wordt per
 * exacte periode bewaard. Vroeg de pagina om 14 augustus t/m 12 september
 * terwijl de ophaalronde 15 augustus t/m 11 september had weggeschreven, dan
 * stond er "nog geen cijfers" terwijl ze er wel waren -- een dag verschoven.
 *
 * `venster` (7, 28 of 90) komt daarom aan beide kanten op dezelfde datums uit.
 * Losse `since`/`until` blijven mogelijk voor een eigen periode; dan is het aan
 * de vrager om die ook te laten ophalen.
 */
function periodeUitVraag(query) {
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (iso.test(query.since ?? '') && iso.test(query.until ?? '') && query.since <= query.until) {
    return {start: query.since, eind: query.until};
  }
  const gevraagd = Number(query.venster);
  const dagen = ga4Contract.VENSTERS.includes(gevraagd) ? gevraagd : 28;
  const venster = ga4Contract.vensterPeriode(dagen);
  return {start: venster.start, eind: venster.eind};
}

app.get('/api/segments', async (req, res) => {
  const ontbreekt = supabase.ontbrekendeSleutels();
  if (ontbreekt.length) {
    return res.status(503).json({
      message: 'Supabase niet geconfigureerd. Ontbrekend in .env: ' + ontbreekt.join(', ') + '.',
    });
  }
  const vormfout = supabase.sleutelProbleem();
  if (vormfout) return res.status(503).json({message: vormfout});

  const gevraagd = String(req.query.client || '').trim();
  if (!gevraagd) return res.status(400).json({message: 'Parameter `client` ontbreekt.'});

  try {
    const sb = supabase.maakSupabase();
    const klanten = await sb.lees('clients', {kolommen: 'id,slug'});
    const klant = klanten.find((c) => c.slug === gevraagd || c.id === gevraagd);
    if (!klant) return res.status(404).json({message: 'Onbekende klant "' + gevraagd + '".'});

    const filters = {client_id: klant.id};
    if (req.query.since) filters.snapshot_date = 'gte.' + req.query.since;

    const rijen = await sb.lees('segment_performance', {
      kolommen: 'platform,dimension,dimension_value,snapshot_date,spend,impressions,clicks,conversions_primary,revenue',
      filters,
    });
    const binnen = req.query.until
      ? rijen.filter((r) => String(r.snapshot_date) <= String(req.query.until))
      : rijen;

    // Optellen over de dagen; de pagina toont een verdeling over de periode.
    const perSleutel = new Map();
    for (const r of binnen) {
      const sleutel = `${r.dimension}|${r.dimension_value}|${r.platform}`;
      const som = perSleutel.get(sleutel) ?? {
        dimension: r.dimension, name: r.dimension_value, platform: r.platform,
        spend: 0, impressions: 0, clicks: 0, results: 0, revenue: 0,
      };
      som.spend += Number(r.spend ?? 0);
      som.impressions += Number(r.impressions ?? 0);
      som.clicks += Number(r.clicks ?? 0);
      som.results += Number(r.conversions_primary ?? 0);
      som.revenue += Number(r.revenue ?? 0);
      perSleutel.set(sleutel, som);
    }

    const dimensies = {};
    for (const rij of perSleutel.values()) {
      (dimensies[rij.dimension] ??= []).push({
        ...rij, spend: Math.round(rij.spend * 100) / 100, results: Math.round(rij.results * 100) / 100,
      });
    }
    for (const lijst of Object.values(dimensies)) lijst.sort((a, b) => b.spend - a.spend);

    return res.json({aanwezig: binnen.length > 0, dimensies});
  } catch (error) {
    return res.status(502).json({message: formatError(error)});
  }
});

app.get('/api/meta/insights', async (req, res) => {
  const ontbreekt = supabase.ontbrekendeSleutels();
  if (ontbreekt.length) {
    return res.status(503).json({
      message: 'Supabase niet geconfigureerd. Ontbrekend in .env: ' + ontbreekt.join(', ') + '.',
    });
  }
  const vormfout = supabase.sleutelProbleem();
  if (vormfout) return res.status(503).json({message: vormfout});

  const gevraagd = String(req.query.client || '').trim();
  if (!gevraagd) return res.status(400).json({message: 'Parameter `client` ontbreekt.'});

  try {
    const sb = supabase.maakSupabase();
    const klanten = await sb.lees('clients', {kolommen: 'id,slug,name,business_model'});
    const klant = klanten.find((c) => c.slug === gevraagd || c.id === gevraagd);
    if (!klant) {
      return res.status(404).json({
        message: 'Onbekende klant "' + gevraagd + '".',
        beschikbaar: klanten.map((c) => c.slug).filter(Boolean),
      });
    }

    const filters = {client_id: klant.id, platform: PLATFORM_META};
    if (req.query.since) filters.snapshot_date = 'gte.' + req.query.since;

    const rijen = await sb.lees('performance_snapshots', {
      kolommen: 'campaign_id,snapshot_date,granularity,spend,impressions,clicks,conversions_primary,leads,revenue',
      filters,
      order: 'snapshot_date.asc',
    });
    const inBereik = req.query.until
      ? rijen.filter((r) => String(r.snapshot_date) <= String(req.query.until))
      : rijen;

    const gekozen = kiesGranulariteit(inBereik, {since: req.query.since, until: req.query.until});
    const binnenPeriode = inBereik.filter((r) => r.granularity === gekozen);

    // Campagnenamen en het Meta-oordeel hangen alleen van de klant af, niet van
    // elkaar; achter elkaar zetten kost een round-trip die niets toevoegt.
    const [campagnerijen, betrouwbaarheid] = await Promise.all([
      leesCampagnes(sb, klant.id, PLATFORM_META),
      leesBetrouwbaarheid(sb, klant.id, PLATFORM_META),
    ]);
    const campagnes = new Map(campagnerijen.map((c) => [c.id, c]));

    return res.json({
      ...metaBlokVan(binnenPeriode, campagnes, {
        businessModel: klant.business_model,
        betrouwbaarheid,
      }),
      granulariteit: gekozen,
    });
  } catch (error) {
    return res.status(502).json({message: formatError(error)});
  }
});

app.get('/api/google-ads/campaigns', async (req, res) => {
  const ontbreekt = supabase.ontbrekendeSleutels();
  if (ontbreekt.length) {
    return res.status(503).json({
      message: 'Supabase niet geconfigureerd. Ontbrekend in .env: ' + ontbreekt.join(', ') + '.',
    });
  }
  // Een verkeerd soort sleutel zou anders pas als 401 terugkomen, en die
  // melding wijst niet naar de sleutel die je moest hebben.
  const vormfout = supabase.sleutelProbleem();
  if (vormfout) return res.status(503).json({message: vormfout});

  const gevraagd = String(req.query.client || '').trim();
  if (!gevraagd) return res.status(400).json({message: 'Parameter `client` ontbreekt.'});

  try {
    const sb = supabase.maakSupabase();
    const {klant, beschikbaar} = await zoekKlant(sb, gevraagd);
    if (!klant) {
      return res.status(404).json({message: 'Onbekende klant "' + gevraagd + '".', beschikbaar});
    }

    // Prestaties, campagnenamen en het conversieoordeel in één keer: ze hangen
    // alleen van de klant af en niet van elkaar. Zie ads-query.js.
    const bron = await haalGoogleAdsBron(sb, {klantId: klant.id, since: req.query.since});

    // De bovengrens ligt op `period_end`, niet op `snapshot_date`: een maandrij
    // die op `since` begint liep anders drie weken buiten het venster door en
    // telde toch helemaal mee. Zie binnenBereik.
    const inBereik = binnenBereik(bron.snapshots, {since: req.query.since, until: req.query.until});

    // Zie kiesGranulariteit: dag- en weekrijen bestrijken dezelfde periode, dus
    // alles optellen telt alles dubbel.
    const gekozen = kiesGranulariteit(inBereik, {since: req.query.since, until: req.query.until});
    const binnenPeriode = inBereik.filter((r) => r.granularity === gekozen);

    return res.json({
      ...googleBlokVan(binnenPeriode, bron.campagnes, {
        businessModel: klant.business_model,
        // Welke KPI's op dit account betekenis hebben. Ontbreekt de rij, dan is
        // de conversieopzet niet beoordeeld -- dat is iets anders dan
        // beoordeeld en goed bevonden, en het blok laat dat verschil zien.
        betrouwbaarheid: bron.betrouwbaarheid,
      }),
      granulariteit: gekozen,
      // Containment laat dagen aan de randen vallen. Zonder dit getal is
      // "weinig uitgegeven" niet te onderscheiden van "niet alles gemeten".
      dekking: dekkingVan(binnenPeriode, {since: req.query.since, until: req.query.until}),
    });
  } catch (error) {
    return res.status(502).json({message: formatError(error)});
  }
});

app.get('/api/overview', async (req, res) => {
  if (USE_MOCK_DATA === 'true') {
    return res.json(buildDemoOverview());
  }

  const connection = getGoogleConnection();
  if (!connection) {
    return res.json(buildDemoOverview());
  }

  try {
    const oauth2Client = createOAuthClient();
    const refreshToken = decrypt(connection.encrypted_refresh_token);
    oauth2Client.setCredentials({refresh_token: refreshToken});
    const analyticsdata = google.analyticsdata({version: 'v1beta', auth: oauth2Client});

    const propertyId = process.env.GA4_PROPERTY_ID;
    if (!propertyId) {
      throw new Error('GA4_PROPERTY_ID is niet geconfigureerd.');
    }

    const report = await analyticsdata.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dateRanges: [{startDate: '7daysAgo', endDate: 'today'}],
        metrics: [{name: 'sessions'}, {name: 'purchaseRevenue'}, {name: 'engagementRate'}],
        dimensions: [{name: 'country'}],
        limit: 5,
      },
    });

    return res.json({
      connected: true,
      demo: false,
      accountEmail: connection.account_email,
      message: 'Live gegevens geladen.',
      kpis: {
        spend: Number(report.data.totals?.[0]?.metricValues?.[1]?.value || 0),
        roas: 0,
        health: 88,
        alerts: 1,
      },
      ga4: report.data,
    });
  } catch (error) {
    console.error('Overview API error', formatError(error));
    res.status(500).json({error: formatError(error), ...buildDemoOverview()});
  }
});

// Onbekende API-routes geven JSON terug, geen HTML.
// Zonder dit levert Express een text/html 404 op en breekt response.json()
// in de frontend met "Unexpected token '<'".
app.use('/api', (req, res) => {
  res.status(404).json({
    error: 'Niet gevonden',
    message: `Onbekende API-route: ${req.method} ${req.originalUrl}`,
  });
});

// Centrale foutafhandeling. Ook hier altijd JSON voor /api-routes.
app.use((error, req, res, next) => {
  console.error('Onverwachte serverfout', formatError(error));
  if (res.headersSent) return next(error);
  if (req.path.startsWith('/api')) {
    return res.status(500).json({
      error: 'Serverfout',
      message: formatError(error),
    });
  }
  return res.status(500).send('Er is een serverfout opgetreden.');
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
