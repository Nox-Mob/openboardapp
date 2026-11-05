# OpenBoardApp

Using the OpenLedgerApp Project design as a framework, build a Board Management App using the following as a roadmap.

This project was built with [Lovable](https://lovable.dev).

## Architecture

See [OpenBoard architecture](docs/architecture.md) for application layers, organization isolation, official voting records, document generation, exports and CI checks.

## Database migrations

`supabase/migrations` is the single, ordered migration history. The `Supabase database` workflow (`.github/workflows/supabase-db.yml`) rebuilds the database from it on every pull request. See [Phase 0 inventory](docs/migration/phase-0-inventory.md) and [Settings to re-enter](docs/migration/settings-to-reenter.md).

> **Legacy:** `drizzle/` and `drizzle.config.ts` are what Lovable Cloud applies today, through `LOVABLE_DB_MIGRATION_URL`. They are kept only until the Phase 1 cutover and then removed. Until then, add every schema change to both `drizzle/migrations` and `supabase/migrations` with identical SQL.

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/2f575a9a-fbb1-45cb-908a-1d2f5e0ae4a0).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
