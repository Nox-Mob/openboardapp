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

## Self-hosting

Board runs on its own server and its own Supabase project. `npm run build` builds from your own `.env` / `.env.local` (see [`.env.example`](.env.example)); it needs no secrets. Today's app still uses the tables in `supabase/migrations/` (apply them in filename order); it moves to the `board` schema in `db/migrations/` with the next client change (see `supabase/README.md`). With `VITE_HOSTED=false` (the default) Board keeps its own sign-in, organizations and invitations and doesn't link to openapphub.org. `wrangler.jsonc` isn't used.

## Hosted edition (OpenAppHub)

The hosted edition at `board.openapphub.org` is a Cloudflare Worker configured by [`wrangler.jsonc`](wrangler.jsonc): the top level is production, `env.staging` is staging. Cloudflare's Git integration builds `main` with `npm run build:hosted` and deploys with `npx wrangler deploy --config wrangler.jsonc`. See `docs/SHARED-SPEC.md` and `docs/MIGRATION-NOTES.md`.
