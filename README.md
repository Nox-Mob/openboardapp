# OpenBoardApp

Open-source board management for small nonprofits: the board's roster and terms, meetings and agendas, live votes, minutes, documents and action items, with an official record nobody can quietly change.

OpenBoardApp is one of the apps of **[OpenAppHub](https://openapphub.org)**: one sign-in, organization and billing across OpenCharterApp, OpenBoardApp and OpenLedgerApp. It also runs on its own when self-hosted.

## What it does

- **Governance:** the board roster, officers, terms and committees
- **Meetings:** scheduling from templates, agendas, attendance and a live quorum indicator
- **Votes:** live member voting with a frozen electorate, recusals and the full vote record
- **Minutes:** notes and motions, minutes approval with versions, and a formatted minutes PDF
- **Documents:** the board packet PDF, the organization's letterhead and generated documents
- **Action items**, an append-only **audit log**, and **export** of the full board record (zip)
- **Reminders by email:** a week and a day before a meeting, and when an action item is due (sent by OpenAppHub when hosted, by your own mail server when self-hosted)
- **With OpenCharterApp:** officers stay in sync both ways, chapters can run their own board, and reports from OpenCharterApp and OpenLedgerApp can be added to a meeting's packet
- **Isolation:** every organization's data is separated by row-level security in the database

What's left and what's next: [`OpenAppHub/docs/ROADMAP.md`](https://github.com/Nox-Mob/OpenAppHub/blob/staging/docs/ROADMAP.md).

## Editions

|                 | Hosted (OpenAppHub)                                   | Self-hosted                                   |
| --------------- | ----------------------------------------------------- | --------------------------------------------- |
| Address         | `board.openapphub.org`                                | your own                                      |
| Sign-in and org | the hub (`openapphub.org`): one account for every app | Board's own sign-in, organizations, invites   |
| Database        | the suite's shared Supabase project, schema `board`   | your own Supabase or Postgres, schema `board` |
| Billing         | the hub's plans; read-only when a plan lapses         | none: always writable                         |
| Switch          | `VITE_HOSTED=true` (set by `npm run build:hosted`)    | `VITE_HOSTED=false` (the default)             |

## Try it

Staging is at **https://staging.board.staging.openapphub.org**, with the suite demo (reset every 12 hours; the apps' data agree with each other, and every account has tasks waiting):

| Account                        | Password             | What you see                                                                                                     |
| ------------------------------ | -------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `demo@demo.openapphub.org`     | `OpenAppHubDemo2026` | owns Riverside Community Association, with its history                                                           |
| `national@demo.openapphub.org` | `OpenAppHubDemo2026` | owns Northstar Veterans League (a veterans national): its executive committee's meetings, and Post 7's own board |
| `test@demo.openapphub.org`     | `OpenAppHubDemo2026` | no organization (a first visit)                                                                                  |

These are public on purpose and exist only on staging.

## Development

You need Node.js 22+ and **npm** (the only package manager this repo uses).

```sh
git clone https://github.com/Nox-Mob/openboardapp.git
cd openboardapp
npm ci
cp .env.example .env.local   # your Supabase project's URL and publishable key
npm run dev                  # http://localhost:8080
```

Checks (CI runs the same):

```sh
npm run typecheck
npm run lint
npm run format:check
npm run test:unit            # unit and page tests (Vitest)
npm run build
```

## Tests

- **Unit and page tests:** `npm run test:unit`.
- **Database rules:** `TEST_DATABASE_URL=postgres://… npm run db:test` builds a throwaway database and runs `db/tests/*.sql`. It checks isolation, roles, record locks, live voting, and read-only when a plan lapses. Never point it at a real database.
- **Performance:** `TEST_DATABASE_URL=postgres://… npm run db:perf` grows one board through 5,000, 20,000 and 50,000 meetings next to 40 others, and fails if a heavy read is slow.
- **End to end:** `npm run test:e2e` (Playwright, `e2e/`).
  - It starts the app on a local dev server, self-hosted (its own sign-in page), and signs in to **staging** as the suite demo accounts.
  - Staging's public settings come from `wrangler.jsonc` `env.staging`, so no secrets are needed.
  - In the Claude cloud sandbox: `E2E_NO_SANDBOX=1 E2E_CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome npm run test:e2e`.

## Database

Board's tables live in schema `board`, on top of the OpenAppHub core (`db/core`, vendored from the hub: organizations, members, roles, invitations, ownership).

- **Migrations:** `db/migrations/*.sql`, applied in order by `scripts/migrate.mjs` (`DATABASE_URL=postgres://… npm run db:migrate`).
  - It applies `db/core` first and records every file in `ops.schema_migrations`.
  - It refuses a file that changed after it was applied. Never edit an applied migration; add a new one.
- **Demo data** (staging and development only): `npm run db:migrate -- --seed`. It refuses a database with real organizations.
- **Staging and production:** the owner runs Actions → **Migrate** (`migrate.yml`).

## Branches, CI and deploys

- **Pull requests target `staging`.** Nothing merges into `main` without the owner's approval; `main` is production.
- **Staging** is the Worker's preview of branch `staging`: `staging.board.staging.openapphub.org`. Any other branch builds at `<branch>.board.staging.openapphub.org`.
- **Production** (`board.openapphub.org`) deploys when `main` changes, through Cloudflare's Git integration (`npm run build:hosted`, then `wrangler deploy`). There are no deploy workflows and no Cloudflare secrets in GitHub.
- **CI** runs on every pull request and on pushes to `staging`, and on a schedule:
  - `ci.yml`: types, lint, formatting, unit tests, build, database rules, performance, dependency audit; also weekly.
  - `e2e.yml`: end-to-end on staging; also daily.

## Self-hosting

1. Build from your own `.env` / `.env.local` (see [`.env.example`](.env.example)) with `npm run build`. It needs no secrets, and `wrangler.jsonc` isn't used.
2. Run `DATABASE_URL=postgres://… npm run db:migrate`. It applies `db/core`, then `db/migrations`, and only what's new on later runs.
3. Add `board` to the exposed schemas: in Supabase, Project Settings → Data API; with Docker, `PGRST_DB_SCHEMAS` in the stack's `.env`.

With `VITE_HOSTED=false` (the default), Board keeps its own sign-in, organizations and invitations, and doesn't link to openapphub.org.

## Docs

- User guide: [docs.openapphub.org](https://docs.openapphub.org)
- Architecture: [`OpenAppHub/docs/board/architecture.md`](https://github.com/Nox-Mob/OpenAppHub/blob/staging/docs/board/architecture.md)
- To-do list: [`OpenAppHub/docs/ROADMAP.md`](https://github.com/Nox-Mob/OpenAppHub/blob/staging/docs/ROADMAP.md)
- Suite contract: [`docs/SHARED-SPEC.md`](docs/SHARED-SPEC.md)
- Rules for contributors and AI assistants: [`AGENTS.md`](AGENTS.md)

## License

Open source. The license file hasn't been added yet (owner).
