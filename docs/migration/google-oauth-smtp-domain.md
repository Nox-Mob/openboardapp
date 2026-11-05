# Domain, Google sign-in and email (Resend) for the new Supabase project

The owner's step-by-step guide for three outside services the new Supabase project needs. Do them **in this order**, because each step uses the one before it:

1. **Domain:** register it. Everything else uses it.
2. **Email (Resend SMTP):** proves the domain to mail providers and replaces Supabase's rate-limited built-in sender.
3. **Google OAuth client:** its consent screen lists the domain and a support email.

Nothing here goes into the repository. Client secrets and API keys are entered only in the Google, Resend and Supabase dashboards, or as GitHub secrets. See `settings-to-reenter.md` for the full checklist. Throughout, `<ref>` is the Supabase project ref and `openboardapp.com` stands for whichever domain you register.

---

## 1. Domain

### Choose and register

- [ ] First choice: **`openboardapp.com`**. Good alternatives: `openboard.app`, `openboardapp.org`, `getopenboard.com`. Availability could not be checked from the build environment, so search at the registrar.
- [ ] Register at a registrar with at-cost renewals, free WHOIS privacy and good DNS:
  - **Cloudflare Registrar** fits best if the app moves to Cloudflare hosting. The current build targets Cloudflare Workers through `@lovable.dev/vite-tanstack-config` / nitro.
  - **Porkbun** and **Namecheap** are also fine.
- [ ] Turn on auto-renew, two-factor login and registrar lock.
- [ ] Optional: also register the `.org` (and `.app`) so nobody else takes them, and redirect them to the main domain.

Notes:

- `.app` domains work only over HTTPS (browsers enforce it). That's fine for this app, but plain-HTTP redirects won't work.
- For a nonprofit audience (board management), `.org` reads well. `.com` is the safest default.

### Plan the names (DNS)

| Name                                 | Points to                                             | Set up in                                      |
| ------------------------------------ | ----------------------------------------------------- | ---------------------------------------------- |
| `openboardapp.com` (and `www`)       | The app's host (decided in Phase 1)                   | Hosting provider; keep Lovable's until cutover |
| `mail.openboardapp.com` (or `send.`) | Resend: SPF, DKIM, MX records for sending             | Section 2                                      |
| `auth.openboardapp.com` (optional)   | Supabase custom domain for the API/auth (paid add-on) | Supabase → Project Settings → Custom Domains   |

Sending email from a **subdomain** keeps the main domain's reputation separate from transactional mail. A Supabase custom domain is optional. Without it, Google's consent screen says "to continue to `<ref>.supabase.co`". With it, it shows your domain.

### After registering

- [ ] Add a DMARC record for the root domain, starting in monitor mode: `TXT _dmarc.openboardapp.com "v=DMARC1; p=none; rua=mailto:dmarc@openboardapp.com"`. Tighten to `p=quarantine` once reports look clean.
- [ ] Do **not** point the root domain at a new host until the Phase 1 cutover. Until then, the live app stays on Lovable.

---

## 2. Email: Resend as Supabase's SMTP server

Supabase's built-in email sender is for testing only: a handful of messages per hour, to team addresses only. OpenBoard sends sign-up confirmation emails when "Confirm email" is on, and password-reset emails if those are added. Invitations are shared links, not emails.

### In Resend

1. [ ] Create an account at resend.com, using an address on a domain you control if possible.
2. [ ] **Domains → Add domain:** enter `mail.openboardapp.com` and choose the region closest to the Supabase project.
3. [ ] Add the DNS records Resend shows to the domain's DNS. Copy them exactly; on Cloudflare, set them to **DNS only** (grey cloud):
   - **MX** for the sending subdomain (bounce handling)
   - **TXT (SPF):** `v=spf1 include:amazonses.com ~all` or whatever value Resend displays
   - **TXT (DKIM):** `resend._domainkey…`
4. [ ] Click **Verify**. It usually takes minutes, but DNS can take up to 48 hours.
5. [ ] **API Keys → Create API key:** name it `supabase-auth-smtp`, permission **Sending access**, restricted to the `mail.openboardapp.com` domain. Copy it once; it's shown only at creation.

Resend's SMTP settings:

| Setting  | Value                                                   |
| -------- | ------------------------------------------------------- |
| Host     | `smtp.resend.com`                                       |
| Port     | `465` (SSL/TLS). Use `587` (STARTTLS) if 465 is blocked |
| Username | `resend`                                                |
| Password | The API key from step 5                                 |

### In Supabase

1. [ ] **Authentication → Emails → SMTP Settings → Enable custom SMTP.**
2. [ ] Fill in:
   - Sender email: `no-reply@mail.openboardapp.com`. It must be on the verified Resend domain.
   - Sender name: `OpenBoard`
   - Host, port, username and password from the table above
3. [ ] Save. Then, under **Authentication → Rate limits**, raise "emails sent per hour" from the post-SMTP default to what you expect. A small board app rarely needs more than 30–100.
4. [ ] **Authentication → Emails → Templates:** brand at least "Confirm signup" with the OpenBoard name. The confirmation link must keep `{{ .ConfirmationURL }}`.
5. [ ] Decide **Authentication → Sign In / Providers → Email → Confirm email**. The app handles both on and off.

Alternative: Resend has a one-click **Supabase integration** (Resend → Integrations) that fills in the SMTP settings for you. The result is the same. Check the sender address afterwards.

### Check it

- [ ] Sign up with a fresh address on the new project, with "Confirm email" on. The email should arrive from `OpenBoard <no-reply@mail.openboardapp.com>`.
- [ ] In Resend → **Emails**, the message shows as Delivered. In the recipient's mail client, "Show original" should report SPF, DKIM and DMARC as `PASS`.

### Local development

The local stack catches all mail in Mailpit (`supabase start` without excluding `mailpit`, web UI on port 54324), so no SMTP or key is needed locally. If you ever want real mail locally, `[auth.email.smtp]` in `supabase/config.toml` would read the key with `pass = "env(RESEND_API_KEY)"`. Never write the key into the file.

---

## 3. Google OAuth client (for "Continue with Google")

Today Google sign-in goes through Lovable's broker (`src/integrations/lovable/index.ts`, `src/data/cloud-adapter.ts:65`). On the new project, Supabase talks to Google directly with your own OAuth client. Setting the client up is configuration; switching the app's code to `supabase.auth.signInWithOAuth` is **Phase 1**.

### In Google Cloud Console (console.cloud.google.com)

1. [ ] **Create a project:** name it `OpenBoard`. Use an organization if you have Google Workspace; otherwise, no organization.
2. [ ] Open **Google Auth Platform** (formerly "OAuth consent screen") → **Get started**:
   - **App information:** app name `OpenBoard`; user support email: an address you monitor
   - **Audience:** **External**, so anyone with a Google account can sign in
   - **Contact information:** your email
   - Agree to the policy → **Create**
3. [ ] **Branding:**
   - App logo is optional. Adding one triggers brand verification, which takes a few days, so you can skip it at first.
   - App home page: `https://openboardapp.com`
   - Privacy policy: `https://openboardapp.com/privacy`; terms: `https://openboardapp.com/terms`. These pages must exist before publishing.
   - **Authorized domains:** `openboardapp.com` and `supabase.co`. Use your Supabase custom domain instead of `supabase.co` if you set one up.
4. [ ] **Data access → Add or remove scopes:** select only `openid`, `.../auth/userinfo.email` and `.../auth/userinfo.profile`. These are non-sensitive scopes, so no Google security review is needed.
5. [ ] **Clients → Create client:**
   - Application type: **Web application**; name: `OpenBoard – Supabase`
   - **Authorized JavaScript origins:** `https://openboardapp.com` (plus any staging origin)
   - **Authorized redirect URIs:** `https://<ref>.supabase.co/auth/v1/callback`. Copy the exact value from Supabase → Authentication → Sign In / Providers → Google ("Callback URL"). If you add a Supabase custom domain, also add `https://auth.openboardapp.com/auth/v1/callback`.
   - **Create**, then copy the **Client ID** and **Client secret**. Store the secret in a password manager.
6. [ ] **Audience → Publish app** ("In production"). While it's in "Testing", only listed test users can sign in, and their sessions expire after 7 days.

### In Supabase

1. [ ] **Authentication → Sign In / Providers → Google → Enable.**
2. [ ] Paste the **Client ID** and **Client secret** → **Save**.
3. [ ] **Authentication → URL Configuration:**
   - Site URL: `https://openboardapp.com`
   - Redirect URLs: `https://openboardapp.com/**` (covers `/auth` and `/board`), any staging origin, and `http://localhost:*/**` for development

### For the local stack (optional)

`supabase/config.toml` already has the Google entry, disabled:

```toml
[auth.external.google]
enabled = false
client_id = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)"
secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)"
```

To try Google sign-in locally in Phase 1:

1. Create a **second** OAuth client in the same Google project, with redirect URI `http://127.0.0.1:54321/auth/v1/callback`.
2. Export the two variables in your shell or an untracked `supabase/.env`.
3. Set `enabled = true` on your machine only.

Never commit the values.

### Check it (Phase 1, after the code switch)

- [ ] "Continue with Google" on `/auth` opens Google's consent screen, which names OpenBoard and your domain, and returns to `/auth` signed in.
- [ ] A row appears in **Authentication → Users** with provider `google`, and `profiles.full_name` is filled in from the Google name (the `handle_new_user` trigger reads `full_name` or `name`).
- [ ] An existing email/password user who signs in with Google on the same address gets the same account. Supabase links identities with the same verified email automatically.

---

## Where each secret lives

| Value                | Stored in                                                         | Never in                |
| -------------------- | ----------------------------------------------------------------- | ----------------------- |
| Google client secret | Supabase → Auth → Providers → Google; your password manager       | The repo, chat, CI logs |
| Resend API key       | Supabase → Auth → SMTP Settings; your password manager            | The repo, chat, CI logs |
| Registrar login      | Password manager, with two-factor login on                        | Anywhere shared         |
| Google client ID     | Supabase dashboard (not secret, but there's no need to commit it) | n/a                     |
