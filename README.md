# OpenBoardApp

A board management app for small nonprofits; see roadmap.md for the plan.

## Architecture

See [OpenBoard architecture](docs/architecture.md) for application layers, organization isolation, official voting records, document generation, exports and CI checks.

## Database migrations

`supabase/migrations` is the single, ordered migration history. The `Supabase database` workflow (`.github/workflows/supabase-db.yml`) rebuilds the database from it on every pull request. See [Phase 0 inventory](docs/migration/phase-0-inventory.md), [Settings to re-enter](docs/migration/settings-to-reenter.md) and [Domain, Google sign-in and email](docs/migration/google-oauth-smtp-domain.md).

> **Legacy:** `drizzle/` and `drizzle.config.ts` are what Lovable Cloud applied. They are frozen as of the move to OpenBoard's own Supabase project: new migrations go only in `supabase/migrations`, which the `deploy` job pushes. The `drizzle/` files are removed after the cutover merge.

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

Board runs on its own server and its own Supabase project. `npm run build` builds from your own `.env` / `.env.local` (see [`.env.example`](.env.example)); it needs no secrets. With `VITE_HOSTED=false` (the default) Board keeps its own sign-in, organizations and invitations and doesn't link to openapphub.org. `wrangler.jsonc` isn't used.

## Hosted edition (OpenAppHub)

The hosted edition at `board.openapphub.org` is a Cloudflare Worker configured by [`wrangler.jsonc`](wrangler.jsonc): the top level is production, `env.staging` is staging. Cloudflare's Git integration builds `main` with `npm run build:hosted` and deploys with `npx wrangler deploy --config wrangler.jsonc`. See `docs/SHARED-SPEC.md` and `docs/MIGRATION-NOTES.md`.
