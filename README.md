# Aizy Agency Data Dashboard

Een werkende HTML/CSS/JavaScript webapp met een lichte Node/Express backend voor Google OAuth en API-integraties.

## Start lokaal

```bash
cd /Users/max/Documents/Aizy Agency Data Dashboard/aizy-agency-data-dashboard
npm install
cp .env.example .env
# Vul je Google OAuth-gegevens in .env
npm start
```

Open daarna: http://localhost:8000

## Belangrijke Google Cloud instellingen

1. Maak of selecteer een Google Cloud-project.
2. Schakel de volgende APIs in:
   - Google Analytics Data API
   - Google Analytics Admin API
   - Google Merchant API
   - Google Search Console API
3. Configureer een OAuth consent screen.
4. Maak een OAuth 2.0-webclient aan.
5. Voeg toe als redirect URI:
   `http://127.0.0.1:8000/api/auth/google/callback`
6. Plaats `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `SESSION_SECRET`, `TOKEN_ENCRYPTION_KEY` en `DATABASE_URL` in `.env`.

## Omgevingsvariabelen

Gebruik `.env.example` als basis. Voeg nooit echte secrets aan Git toe.

## API routes

- `GET /api/auth/google/start`
- `GET /api/auth/google/callback`
- `GET /api/auth/status`
- `GET /api/integrations/google/status`
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

## Database

De applicatie gebruikt SQLite via `db.js`. De database wordt opgeslagen in `./data/app.db`.
