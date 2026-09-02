# BloodConnect staging deployment

## Architecture

```
Browser -> Vercel (React/Vite) -> Render (Express API) -> Aiven (MySQL)
```

The frontend is a Vite React single-page application. The Express backend uses
`mysql2` and JWT bearer tokens. Predictive and prescriptive dashboard calculations
are JavaScript calculations in `frontend/src/admin/admin-reports.jsx`; they consume
inventory, request, donor, and hospital API data. There is no Python runtime or
model file to deploy. Facility mapping uses Leaflet with public OpenStreetMap tiles
and facility latitude/longitude returned by the API; no map API key is configured.

## Commands

| Service | Working directory | Install/build | Start |
| --- | --- | --- | --- |
| Frontend | `frontend` | `npm ci && npm run build` | Vercel serves `dist` |
| Backend | `backend` | `npm ci` | `npm start` |

Local development remains `npm run dev` in each respective directory. The frontend
dev server proxies `/api` to `VITE_API_URL`, `VITE_API_BASE_URL`, or (by default)
`http://localhost:3000`.

## Environment variables

Copy the example files locally; do not commit the resulting `.env` files.

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

### Render backend

Set these in Render (never in source control):

```dotenv
NODE_ENV=production
PORT=10000
DB_HOST=<Aiven host>
DB_PORT=<Aiven port>
DB_USER=<Aiven user>
DB_PASSWORD=<Aiven password>
DB_NAME=<Aiven database>
DB_SSL=true
DB_SSL_CA_BASE64=<base64-encoded Aiven CA certificate, if supplied>
FRONTEND_URL=https://<your-vercel-project>.vercel.app
JWT_SECRET=<long random secret>
GOOGLE_CLIENT_ID=<optional OAuth web client ID>
```

`DB_SSL_CA` (a multiline PEM value) is also supported in place of
`DB_SSL_CA_BASE64`. TLS certificate verification remains enabled. Add the SMTP,
Semaphore, and scheduler variables from `backend/.env.example` only if those
features are being tested. `FRONTEND_ORIGIN` remains a backwards-compatible alias
for `FRONTEND_URL`; either may contain comma-separated origins.

### Vercel frontend

Set only browser-safe variables:

```dotenv
VITE_API_URL=https://<your-render-service>.onrender.com
VITE_GOOGLE_CLIENT_ID=<optional OAuth web client ID>
```

Never set `DB_*`, `JWT_SECRET`, `GOOGLE_CLIENT_SECRET`, SMTP credentials, or SMS
keys in Vercel frontend variables. `VITE_API_BASE_URL` is supported only as a
legacy alias. Vite exposes `VITE_*` values to browser code.

## 1. Prepare Aiven MySQL

1. Create an Aiven MySQL service and a separate staging database/user. **NEEDS
   VERIFICATION:** confirm the selected Aiven plan/credit is suitable for a free
   capstone staging deployment before creating the service.
2. Obtain the host, port, database, username, password, and CA certificate from
   the Aiven connection information.
3. Export the local schema and a sanitized staging data copy. This repository has
   no complete baseline `.sql` schema; `backend/ensureSchema.js` only applies
   incremental tables/columns. Importing a dump is therefore required.

   ```bash
   mysqldump -u <local-user> -p --single-transaction --routines --triggers --events bloodconnect > bloodconnect-staging.sql
   mysql --host=<aiven-host> --port=<aiven-port> --user=<aiven-user> --password --ssl-mode=VERIFY_CA --ssl-ca=<aiven-ca.pem> <aiven-database> < bloodconnect-staging.sql
   ```

   Use a sanitized copy: remove real donor contact details, credentials, and any
   other personal data before import. Preserve required reference data, initial
   admin accounts (with newly set staging passwords), tables, indexes, foreign
   keys, triggers, routines, and events.
4. Base64-encode the CA certificate if Render does not accept a multiline value,
   then put the result in `DB_SSL_CA_BASE64`. Leave `DB_SSL=true` and do not set
   `rejectUnauthorized` to false.
5. Confirm the database has at least the base application tables (`users`,
   `hospitals`, `blood_inventory`, `blood_requests`, `donations`, and
   `schedule_requests`) before backend deployment. The additional tables created
   by `ensureSchema.js` include expired-unit, feature-flag, home-post, MBD,
   notification, PRC activity, and event-notification tables.

## 2. Deploy the Express API to Render

1. Push the repository to GitHub without `.env` files. Note: this repository
   currently has tracked `backend/node_modules` files; remove them from Git in a
   separate reviewed cleanup commit before deployment if feasible, because they
   unnecessarily enlarge repository/deploy uploads.
2. In Render, create a **Web Service**, select the repository and set **Root
   Directory** to `backend`.
3. Set **Build Command** to `npm ci` and **Start Command** to `npm start`.
4. Add the Render variables above. Set Health Check Path to `/api/health`.
5. Deploy and open `https://<your-render-service>.onrender.com/api/health`. A
   healthy service returns `{"status":"ok","database":"connected"}`. A 503
   means the app is running but cannot query MySQL.

The server reads Render's `PORT`, binds to `0.0.0.0`, and logs concise API timing
lines for staging performance checks. It runs the existing schema-upgrade code at
startup, so use an Aiven user that has the required schema privileges and test the
dump on a disposable staging database first.

## 3. Deploy the React SPA to Vercel

1. Import the same GitHub repository into Vercel and set **Root Directory** to
   `frontend`.
2. Confirm the detected build command is `npm run build` and output directory is
   `dist`.
3. Set `VITE_API_URL` to the deployed Render URL (no trailing `/api`) and, when
   Google sign-in is used, set `VITE_GOOGLE_CLIENT_ID`.
4. Deploy. `frontend/vercel.json` rewrites all SPA routes to `index.html`, so
   direct visits to dashboard and portal URLs are handled by React Router.
5. Copy the final Vercel URL into Render's `FRONTEND_URL` and redeploy the backend
   so CORS permits it. Add Vercel preview URLs only deliberately; they are separate
   allowed origins.

## Verification checklist

### Aiven

- [ ] Render can connect over TLS.
- [ ] Schema, relationships, indexes, procedures/triggers/events, and sanitized
      test data are imported.
- [ ] Required test users/reference data exist.

### Render

- [ ] Build and `npm start` succeed.
- [ ] `/api/health` returns `status: ok` and `database: connected`.
- [ ] CORS accepts the Vercel origin and rejects unlisted origins.
- [ ] Login, donor, hospital, inventory, request, notification, and report APIs work.
- [ ] Optional SMS/email scheduler integrations are configured only if tested.

### Vercel and end-to-end

- [ ] Frontend builds and direct SPA routes load.
- [ ] `VITE_API_URL` targets Render, not localhost.
- [ ] Login, dashboard, inventory, requests, donor functions, mapping, reports,
      predictive analytics, and prescriptive analytics work.
- [ ] Test the sequence: Browser -> Vercel -> Render -> Aiven -> Render -> Vercel.

## Known limitations / manual review

- Free-tier availability, sleep behavior, quotas, and Aiven pricing are provider
  controlled and **NEED VERIFICATION** at deployment time.
- Google OAuth requires adding the final Vercel origin to the OAuth client's
  authorized JavaScript origins; no client secret belongs in the frontend.
- The application uses bearer JWTs in `localStorage`; this was preserved to avoid
  redesigning authentication. A future production hardening review should consider
  XSS defenses and an httpOnly-cookie design.
- The repository's base database schema and exact data classification cannot be
  inferred completely from code. Inspect the local database with `SHOW TABLES`,
  `SHOW CREATE TABLE`, and the export before importing it.
