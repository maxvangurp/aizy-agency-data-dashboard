const path = require('path');
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const {google} = require('googleapis');
const dotenv = require('dotenv');
const {v4: uuidv4} = require('uuid');
const {encrypt, decrypt} = require('./utils');
const {
  getGoogleConnection,
  upsertGoogleConnection,
  deleteGoogleConnection,
  deleteClientResourceMapping,
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
  'https://www.googleapis.com/auth/content',
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

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
