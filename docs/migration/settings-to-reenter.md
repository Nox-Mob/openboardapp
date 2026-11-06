# Settings that do not come with the code

This is the owner's checklist for setting up OpenBoard's own Supabase project. `supabase db push` (the `deploy` job) brings tables, functions, policies and the `org-files` bucket. It does **not** bring the dashboard settings below. Everything here was found by reading the code, the migrations and `supabase/config.toml`. Only names are listed, never values.

Step-by-step setup for the domain, Resend SMTP and the Google OAuth client is in [google-oauth-smtp-domain.md](google-oauth-smtp-domain.md).

## Project settings (already decided)

- [x] Data API on, exposing `public` (and the default `graphql_public`) only.
- [x] "Automatically expose new tables" off. Every table gets its GRANTs in a migration, and `replay` checks this.
- [x] Automatic RLS on.
- [x] Postgres 17 (the version `replay` tests with: `[db] major_version = 17`).

## Access token for the `deploy` job

`SUPABASE_ACCESS_TOKEN` can be a full personal access token or a **scoped** token. A scoped token needs these scopes, taken from `supabase link --help` and `supabase db push --help` (CLI 3.0.0):

| Scope                          | Why                                                                                                      |
| ------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `project_admin_read`           | Required by `supabase link`                                                                              |
| `projects_read`                | Project lookup by `link` and `db push --remote`                                                          |
| `database_pooling_config_read` | Reading the IPv4 connection pooler. Without it, deploy fails with a 403, or with "IPv6 is not supported" |
| `branching_production_read`    | Resolving the project's main (production) branch                                                         |

`database_write` and the network-ban scopes are only used when no database password is given. The job always passes `SUPABASE_DB_PASSWORD`, so they are not needed.

## Sign-in providers

| Provider                           | Today                                                                                                                                                                  | New project                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Email + password                   | `supabase.auth.signInWithPassword` / `signUp` (`src/data/cloud-adapter.ts:52-62`). Sign-up passes `full_name` metadata, which `handle_new_user` copies into `profiles` | [ ] Enable the Email provider and allow new sign-ups. [ ] Decide on "Confirm email". The app handles both: it shows a "check your email" message when sign-up returns no session (`needsConfirmation`). [ ] Keep the minimum password length at least 6 (the demo and test passwords are longer).                                                   |
| Google                             | Brokered by Lovable: `@lovable.dev/cloud-auth-js` (`src/integrations/lovable/index.ts`, `src/data/cloud-adapter.ts:65`)                                                | **Phase 1.** [ ] Create an OAuth client in Google Cloud with the authorized redirect URI `https://<project-ref>.supabase.co/auth/v1/callback`. [ ] Enter its client ID and secret under Auth → Providers → Google. `config.toml` has the entry disabled, reading `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` / `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` |
| Others (SMS, anonymous, SSO, web3) | Not used                                                                                                                                                               | Leave off                                                                                                                                                                                                                                                                                                                                           |

## Redirect URLs

The app builds these from `window.location.origin`:

- `<origin>/board`: `emailRedirectTo` after sign-up (`src/routes/auth.tsx:66`)
- `<origin>/auth`: Google sign-in return (`src/routes/auth.tsx:78`)
- `<origin>/invite/<token>`: reached through `/auth?redirect=…`, then a same-origin redirect inside the app (no extra allow-list entry needed)

Checklist:

- [ ] **Site URL**: the production origin (see "Custom domains" below).
- [ ] **Additional redirect URLs**: `<production origin>/**` and any preview origin you use.
- [ ] For local development: `http://localhost:*/**`. The dev server runs on port 8080 (`@lovable.dev/vite-tanstack-config`). `config.toml` already has this for the local stack only.

## Email templates and SMTP

Resend setup: see [google-oauth-smtp-domain.md § 2](google-oauth-smtp-domain.md#2-email-resend-as-supabases-smtp-server).

- No custom email templates in the repo. Lovable's defaults were used for sign-up confirmation, password reset and magic link (the app uses neither of the last two).
- Invitations are **links an administrator copies and shares**, not emails (`create_invitation` returns the token). No invitation email template is needed.
- [ ] If "Confirm email" is on, set up custom SMTP (Auth → SMTP). The built-in sender is heavily rate-limited. The SMTP password is a dashboard secret, never a repo value.
- [ ] Optional: brand the "Confirm signup" template with the OpenBoard name.

## MFA

- The app never calls `supabase.auth.mfa`. TOTP stays **off** (`[auth.mfa.totp]` is disabled in `config.toml`). Nothing to enter.

## Storage

- [ ] After the first `deploy`, confirm that bucket `org-files` exists and is **private**. The migration `20261105000000_storage_buckets.sql` creates it, and the `storage.objects` policies come from the earlier migrations.
- No file size limit or MIME list was configured in code. The project's global upload limit applies (the local stack uses 50 MiB).

## Scheduled jobs

- None. The migrations create no `pg_cron` or `pg_net` jobs, and the code has no cron routes.
- `src/integrations/supabase/cron-auth.ts` is a generated helper reading `LOVABLE_CRON_SECRET` / `LOVABLE_CRON_SECRET_PREVIOUS`, but nothing calls it. Reminders (roadmap v0.2) would be the first scheduled job.

## Secrets and environment variables (names only)

App, read by the browser build (public values; currently in the tracked `.env`):

| Name                            | Read in                                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------------ |
| `VITE_SUPABASE_URL`             | `src/integrations/supabase/client.ts:60`, `src/data/platform.ts:14`, `src/test/db/helpers.ts:18` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `src/integrations/supabase/client.ts:62`, `src/data/platform.ts:14`, `src/test/db/helpers.ts:19` |
| `VITE_SUPABASE_PROJECT_ID`      | `.env` only (allowed by `scripts/ci/check-env.mjs`)                                              |

Server runtime (SSR worker):

| Name                                                  | Read in                                                                                                   | Secret?                                                      |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `SUPABASE_URL`                                        | `src/integrations/supabase/client.ts:13,60`, `auth-middleware.ts:36`, `client.server.ts:36`               | No                                                           |
| `SUPABASE_PUBLISHABLE_KEY`                            | `src/integrations/supabase/client.ts:17,62`, `auth-middleware.ts:37`                                      | No                                                           |
| `SUPABASE_PROJECT_ID`                                 | `.env` only; the Supabase CLI also reads it                                                               | No                                                           |
| `SUPABASE_SERVICE_ROLE_KEY`                           | `src/integrations/supabase/client.server.ts:37` (generated admin client; **not imported anywhere** today) | **Yes**: set only in the host's secret store, if ever needed |
| `LOVABLE_CRON_SECRET`, `LOVABLE_CRON_SECRET_PREVIOUS` | `src/integrations/supabase/cron-auth.ts:3-4` (unused)                                                     | Yes (Lovable-managed; drop in Phase 1)                       |

Tooling and CI:

| Name                                                                              | Used by                                                                     |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `LOVABLE_DB_MIGRATION_URL`                                                        | `drizzle.config.ts:8` (legacy; removed at cutover). Secret, Lovable-managed |
| `SKIP_DB_TESTS`                                                                   | `src/test/db/helpers.ts:20`, `npm run test:unit`                            |
| `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_ID`            | `supabase-db.yml` job `deploy`: secrets of the `supabase-prod` environment  |
| `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID`, `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` | `supabase/config.toml` (local stack, disabled); Phase 1                     |

## Outside webhooks and integrations

- None. No Stripe, payment, calendar, video, email-API or AI integrations (`ai.gateway.lovable.dev` is not used). No database webhooks and no edge functions.

## Custom domains

Domain choice and DNS plan: see [google-oauth-smtp-domain.md § 1](google-oauth-smtp-domain.md#1-domain).

- None is configured in the code. The app is reached at its Lovable-hosted URL today. [ ] Check the Lovable project's domain settings for a custom domain. If there is one, use it as the Site URL above and plan its DNS move in Phase 1.
- [ ] Optional: a Supabase custom domain for the API. Remember to update the Google OAuth redirect URI if you add one.

## Data that is not migrated

- [ ] Demo accounts and data: `demo@demo.org` (owner), `chair@demo.org`, `member@demo.org` in "Riverside Community Association". The repo has no demo seed script; seed them by hand, as before (AGENTS.md).
- [ ] `ci.yml`'s `database-rules` job runs against the new project (`.env`). Create its test accounts once by running `scripts/db/create-test-accounts.sql` in the SQL Editor, or with `psql`. It creates `test-a@demo.org`, `test-member@demo.org` and `test-b@demo.org` in Test Org A/B **only**, and refuses to touch real organizations. Each CI run adds test meetings, votes and audit rows to Test Org A. Votes and audit rows are permanent by design.
