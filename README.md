# LUMEN Photography Portfolio Manager

LUMEN is an editorial photography portfolio manager with a React/Vite interface, an Express API, and MySQL persistence. The original demo photographs and six demo albums remain part of the frontend experience; real saved records are loaded from MySQL.

## Stack and requirements

- Node.js 22 or newer and npm
- MySQL 8.0+ (the running application has also been checked against the current MySQL 8 schema)
- React 19, Vite 8, Express 4, TypeScript, and `mysql2`

## Local setup

1. Install dependencies with `npm ci`.
2. Create `.env` from `.env.example` only if you do not already have one, then set your local MySQL connection values. Do not commit `.env`.
   - Windows CMD: `if not exist .env copy .env.example .env`
   - PowerShell: `if (-not (Test-Path .env)) { Copy-Item .env.example .env }`
   - macOS/Linux: `test -e .env || cp .env.example .env`
3. For a **new, empty database only**, connect your SQL client to that database and run [`schema.mysql.sql`](./schema.mysql.sql). It uses `CREATE TABLE IF NOT EXISTS` and does not seed or replace records.
4. Start the API and Vite frontend together with `npm run dev`.
5. Open `http://localhost:3000`; check database connectivity at `/api/health`.

The current local `lumen_db` was inspected and uses eight tables. Do not import [`lumen_db.sql`](./lumen_db.sql): it describes a different schema and includes destructive statements. The app does not automatically create, drop, or seed database tables.

## Environment variables

Configure either `DATABASE_URL` (or `MYSQL_URL`) using a `mysql://` URL, or all of `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME`. Local development has localhost defaults; production startup requires explicit database connection settings.

| Variable | Purpose |
|---|---|
| `PORT` | HTTP port; defaults to `3000` and must be `1–65535`. Hosting platforms supply this. |
| `NODE_ENV` | Use `development` locally and `production` for a built deployment. |
| `UPLOAD_DIR` | Local upload directory; defaults to `./uploads`. |
| `UPLOAD_STORAGE` | Currently supports `local`. `s3` is reserved and startup rejects it until an object-storage adapter is configured. |
| `AUTH_TOKEN_SECRET` | Stable random value of at least 32 characters used to sign login sessions; required in production. |
| `APP_URL` | Public app URL for deployment documentation/integration. |

The app's current upload implementation stores image files on the server's local filesystem. For hosting with ephemeral disks, configure a persistent volume or add a durable object-storage integration before accepting uploads. `storageDurable` in the health response is currently false.
AI Suggestions use a deterministic rule-based recommendation; this build does not call a hosted generative-AI model.

## MySQL authentication setup

The app authenticates studio and client accounts against `users.password_hash` and uses signed, HttpOnly session cookies. Public registration is disabled. To enable sign-in for existing accounts:

1. Check whether `users.password_hash` exists. If it does not, apply the additive [`migrations/20261029_add_user_password_hash.sql`](./migrations/20261029_add_user_password_hash.sql) migration to the configured database. This preserves existing user records.
2. Set a stable random `AUTH_TOKEN_SECRET` with at least 32 characters in the server environment. Keep it private; do not commit it. Changing it invalidates existing sessions.
3. Provision each existing account interactively with `npm run auth:provision -- <existing-user-id-or-email>`. Password input is hidden. Existing users cannot sign in until a password is provisioned.

## Features and persistence

- Demo photos and the original demo albums are separate from MySQL records.
- Saved photos, categories, albums, album-photo links, users, and portfolio briefs use the Express API and active database schema.
- Adding photos to an album is append-only and idempotent. Deleting a saved album removes its relationship rows and album row without deleting photo records.
- Portfolio configuration is represented by `portfolio_briefs`. The Final Preview page supports saving, listing, reusing, editing, and deleting multiple brief records in MySQL. The active photo sequence remains stored on photo records; saved briefs do not snapshot or version their photo selection.
- Login uses MySQL-backed password verification and signed server sessions; there is no passwordless demo fallback. Photo deletion, client review writes, album mutations, and portfolio publishing enforce server-side roles and ownership. Photo and album reads are still studio-wide, and client gallery assignment is not modeled; do not expose this as a multi-tenant service until resource-level access is comprehensively scoped.

## Scripts and checks

| Command | Purpose |
|---|---|
| `npm run dev` | Run Express with Vite middleware. |
| `npm run lint` | TypeScript check (`tsc --noEmit`). |
| `npm run build` | Create the frontend production bundle in `dist/`. |
| `npm start` | Serve the built frontend and API; run `npm run build` first. |

There is no automated test script in `package.json` yet.

## Production and hosting

The Node server serves `dist/` and `/api/*` from one origin, listens on the host-provided `PORT`, and requires explicit production MySQL settings. Set secrets in the hosting provider's environment settings, not in source control. Configure a managed MySQL instance reachable from the service; do not expose MySQL publicly just to connect the app. Railway can host this single-origin Node application, but MySQL and durable upload storage must be provisioned and configured separately.

Before public deployment:

1. Select a Node hosting provider and a MySQL provider/plan, and confirm pricing, persistence, backups, and networking.
2. Create a **new** hosted database, then apply `schema.mysql.sql` to that database only.
3. Configure `DATABASE_URL` or the `DB_*` values and set `NODE_ENV=production`.
4. Configure persistent mounted upload storage. Object storage is not implemented, and health reports uploads as non-durable.
5. Apply the additive password migration, configure a private stable `AUTH_TOKEN_SECRET`, and provision existing accounts. Complete resource-level ownership and client-role authorization before exposing the app as a multi-tenant service.
6. Deploy with `npm ci`, `npm run build`, and `npm start`; check `/api/health` and test uploads, persistence, and restart behavior.
7. Configure HTTPS and any provider-specific health-check and backup settings. Only publish a URL after verifying the hosted app and database.

No hosting provider or public URL is configured by this repository. A provider choice and account/database setup are required before deployment; free plans may sleep, have limited storage, or omit persistent volumes/backups.
