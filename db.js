const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dbPath = process.env.DATABASE_URL
  ? path.resolve(process.env.DATABASE_URL)
  : path.join(__dirname, 'data', 'app.db');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, {recursive: true});

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS agency_users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL,
  agency_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  agency_id TEXT NOT NULL,
  name TEXT NOT NULL,
  business_model TEXT,
  website TEXT,
  currency TEXT,
  timezone TEXT,
  status TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS google_connections (
  id TEXT PRIMARY KEY,
  agency_id TEXT NOT NULL,
  account_email TEXT NOT NULL,
  account_name TEXT,
  google_id TEXT,
  encrypted_refresh_token TEXT NOT NULL,
  scopes TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_token_refresh_at TEXT,
  last_error TEXT
);

CREATE TABLE IF NOT EXISTS client_resource_mappings (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  resource_name TEXT,
  account_id TEXT,
  property_url TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_runs (
  id TEXT PRIMARY KEY,
  client_id TEXT,
  provider TEXT NOT NULL,
  resource_id TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL,
  records_received INTEGER DEFAULT 0,
  error_code TEXT,
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS cached_data (
  id TEXT PRIMARY KEY,
  client_id TEXT,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  expires_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`);

const getGoogleConnection = () => db.prepare('SELECT * FROM google_connections LIMIT 1').get();
const upsertGoogleConnection = (connection) => {
  const existing = getGoogleConnection();
  const now = new Date().toISOString();
  if (existing) {
    db.prepare(`
      UPDATE google_connections SET
        agency_id = ?,
        account_email = ?,
        account_name = ?,
        google_id = ?,
        encrypted_refresh_token = ?,
        scopes = ?,
        status = ?,
        updated_at = ?,
        last_token_refresh_at = ?,
        last_error = ?
      WHERE id = ?
    `).run(
      connection.agency_id,
      connection.account_email,
      connection.account_name,
      connection.google_id,
      connection.encrypted_refresh_token,
      connection.scopes,
      connection.status,
      now,
      connection.last_token_refresh_at,
      connection.last_error,
      existing.id
    );
    return existing.id;
  }

  db.prepare(`
    INSERT INTO google_connections (
      id,
      agency_id,
      account_email,
      account_name,
      google_id,
      encrypted_refresh_token,
      scopes,
      status,
      created_at,
      updated_at,
      last_token_refresh_at,
      last_error
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    connection.id,
    connection.agency_id,
    connection.account_email,
    connection.account_name,
    connection.google_id,
    connection.encrypted_refresh_token,
    connection.scopes,
    connection.status,
    now,
    now,
    connection.last_token_refresh_at,
    connection.last_error
  );
  return connection.id;
};

const deleteGoogleConnection = () => db.prepare('DELETE FROM google_connections').run();
const deleteClientResourceMappings = () => db.prepare('DELETE FROM client_resource_mappings').run();
const deleteClientResourceMapping = (id) => db.prepare('DELETE FROM client_resource_mappings WHERE id = ?').run(id);
const getClientResourceMappings = () => db.prepare('SELECT * FROM client_resource_mappings').all();
const getClientResourceMappingsByClient = (clientId) => db.prepare('SELECT * FROM client_resource_mappings WHERE client_id = ?').all(clientId);
const getClientResourceMappingsByProvider = (provider) => db.prepare('SELECT * FROM client_resource_mappings WHERE provider = ?').all(provider);
const getClients = () => db.prepare('SELECT * FROM clients').all();
const createClientResourceMapping = (mapping) => {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO client_resource_mappings (
      id,
      client_id,
      provider,
      resource_type,
      resource_id,
      resource_name,
      account_id,
      property_url,
      active,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    mapping.id,
    mapping.client_id,
    mapping.provider,
    mapping.resource_type,
    mapping.resource_id,
    mapping.resource_name,
    mapping.account_id,
    mapping.property_url,
    mapping.active ? 1 : 0,
    now,
    now
  );
};

const ensureSeedData = () => {
  const settings = db.prepare('SELECT COUNT(*) AS count FROM clients').get();
  if (settings.count === 0) {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO clients (id, agency_id, name, business_model, website, currency, timezone, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('client_muebles', 'agency_default', 'Maatwerk Tafels', 'e-commerce', 'https://maatwerka.nl', 'EUR', 'Europe/Amsterdam', 'active', now, now);
    db.prepare(`
      INSERT INTO clients (id, agency_id, name, business_model, website, currency, timezone, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('client_vitalis', 'agency_default', 'Vitalis Fysiotherapie', 'lead generation', 'https://vitalisfysio.nl', 'EUR', 'Europe/Amsterdam', 'active', now, now);
  }
};

ensureSeedData();

module.exports = {
  db,
  getGoogleConnection,
  upsertGoogleConnection,
  deleteGoogleConnection,
  deleteClientResourceMappings,
  deleteClientResourceMapping,
  getClientResourceMappings,
  getClientResourceMappingsByClient,
  getClientResourceMappingsByProvider,
  getClients,
  createClientResourceMapping,
};
