# OpenBoardApp

A board management app for small nonprofits; see roadmap.md for the plan.

## Architecture

See [OpenBoard architecture](docs/architecture.md) for application layers, organization isolation, official voting records, document generation, exports and CI checks.

## Database

Board's tables live in the `board` schema, on top of the OpenAppHub core (`db/core`: organizations, members, roles, invitations, ownership), on the shared OpenAppHub database or on your own (self-hosted).

- **Migrations:** `db/migrations/*.sql`, applied in order by `scripts/migrate.mjs` (vendored from OpenAppHub): `DATABASE_URL=postgres://… npm run db:migrate`. It applies `db/core` first, records every file in `ops.schema_migrations` and refuses a file that changed after it was applied. Never edit an applied migration; add a new one.
- **Rule tests:** `TEST_DATABASE_URL=postgres://… npm run db:test` builds a throwaway database the same way and runs `db/tests/*.sql` (isolation, roles, record locks, live voting, read-only when a plan lapses).
- **Performance:** `npm run db:perf` grows one board through 5,000, 20,000 and 50,000 meetings next to 40 others and fails if a heavy read is slow.
- **Production and staging:** the owner runs Actions → **Migrate** (`migrate.yml`).

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm ci
cp .env.example .env.local   # fill in your Supabase project's URL and publishable key
npm run dev
```

Checks: `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run test:unit`, `npm run build`.

End-to-end tests: `npm run test:e2e` (Playwright, `e2e/`) runs the app on a local dev server, self-hosted (its own sign-in page), against **staging** as the suite demo accounts (`demo@demo.openapphub.org` owns Riverside Community Association; `test@demo.openapphub.org` has no organization; password `OpenAppHubDemo2026`; reset every 12 hours). Staging's public settings come from `wrangler.jsonc` `env.staging`, so no secrets are needed. CI runs it in `.github/workflows/e2e.yml`. In the Claude cloud sandbox: `E2E_NO_SANDBOX=1 E2E_CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome npm run test:e2e`.

## Self-hosting

Board runs on its own server and its own Supabase project. `npm run build` builds from your own `.env` / `.env.local` (see [`.env.example`](.env.example)); it needs no secrets. The database is the OpenAppHub core plus Board's schema `board`: run `DATABASE_URL=postgres://… npm run db:migrate` (it applies `db/core` then `db/migrations`, and only what's new on later runs), then add `board` to the exposed schemas (Supabase: Project Settings → Data API; Docker: `PGRST_DB_SCHEMAS` in the stack's `.env`). Demo data for development or staging: `npm run db:migrate -- --seed` (it refuses a database with real organizations). With `VITE_HOSTED=false` (the default) Board keeps its own sign-in, organizations and invitations and doesn't link to openapphub.org. `wrangler.jsonc` isn't used.

## Hosted edition (OpenAppHub)

The hosted edition at `board.openapphub.org` is a Cloudflare Worker configured by [`wrangler.jsonc`](wrangler.jsonc): the top level is production, `env.staging` is staging. Cloudflare's Git integration builds `main` with `npm run build:hosted` and deploys with `npx wrangler deploy --config wrangler.jsonc`. See `docs/SHARED-SPEC.md` and `docs/MIGRATION-NOTES.md`.
