# GuardPost

Uptime, SSL expiry, and domain expiry monitoring for freelancers and small agencies managing client sites.

## What's built

- `src/db.js` — SQLite schema: `users`, `magic_links`, `sessions`, `sites` (scoped by `user_id`), `check_history`, `alerts_sent`
- `src/auth.js` — Magic-link auth: request a link, verify it, session cookie management, `requireAuth`/`attachUser` middleware
- `src/email.js` — Sends via [Resend](https://resend.com)'s HTTP API if `RESEND_API_KEY` is set; otherwise logs the email to console so the app runs with zero setup
- `src/checks/uptime.js` — HTTP(S) uptime check + SSL certificate expiry check (built-in `tls`/`http`/`https` modules only)
- `src/checks/domain.js` — Raw WHOIS client (built-in `net` module), resolves the authoritative registry via IANA and parses the expiry date. No paid API.
- `src/alerts.js` — Decides when an alert fires (downtime transition, SSL/domain thresholds at 30/14/3 days), dedupes per day, sends email to the site's owner + an optional Slack/Discord webhook
- `src/scheduler.js` — `node-cron` jobs: uptime every 5 min, SSL daily, domain weekly
- `src/server.js` — Express API, all site routes scoped to the logged-in user, public status routes unauthenticated by design
- `public/index.html` — Login screen (magic link) + dashboard once signed in
- `public/status.html` — Public, unauthenticated status page (the shareable/viral feature)

**Tested live, including multi-tenant isolation**: two separate users were created via real magic-link tokens; user B correctly saw zero of user A's sites, and a request to delete user A's site by guessing its ID returned 404 without deleting anything.

## Run it locally

```bash
npm install
node src/server.js
```

Open `http://localhost:3000`. Sign in with any email — since no `RESEND_API_KEY` is set by default, the sign-in link is printed to the server console instead of emailed. Copy that link into your browser to log in.

## Environment variables

| Variable | Required? | Purpose |
|---|---|---|
| `RESEND_API_KEY` | No (falls back to console log) | Sends real magic-link and alert emails via Resend |
| `GUARDPOST_FROM_EMAIL` | No | Overrides the "from" address (default `GuardPost <alerts@guardpost.dev>` — must be a domain verified in your Resend account) |
| `PUBLIC_BASE_URL` | No (falls back to request host) | Set this in production so magic links point at your real domain, not an internal hostname |
| `STRIPE_SECRET_KEY` | No | Enables `/api/billing/checkout` (currently a stub — see below) |
| `NODE_ENV=production` | Recommended in prod | Makes the session cookie `secure` (HTTPS-only) |

## What's stubbed for the prototype (by design)

- **Billing**: `/api/billing/checkout` and `/api/billing/webhook` exist as routes but return `501 not_implemented_yet`. Wiring up Stripe:
  1. `npm install stripe`
  2. In `checkout`: create a Stripe customer for `req.user` (store `stripe_customer_id`), then `stripe.checkout.sessions.create(...)` with the relevant price ID and `success_url`/`cancel_url`, return the session URL for the frontend to redirect to
  3. In `webhook`: verify the signature with `stripe.webhooks.constructEvent`, and on `checkout.session.completed` / `customer.subscription.updated`, update `users.plan` and `users.stripe_subscription_id`
  4. Register the webhook endpoint in the Stripe dashboard pointing at `/api/billing/webhook`
- **WHOIS in restricted networks**: the domain-expiry check makes a raw TCP connection on port 43. Works on any normal host, but fails behind an HTTP-only proxy/firewall (this is why it couldn't be fully live-tested in the sandbox this was built in). If you deploy somewhere that blocks port 43, swap in `https://rdap.org` (free RDAP protocol, HTTP-based) as a fallback.
- **Rate limiting**: none yet on `/api/auth/request-link` — add a simple per-IP/per-email rate limit before launch so the endpoint can't be used to spam someone's inbox.

## A note on `npm install`

`better-sqlite3` includes a native module normally installed from a prebuilt binary (fast, no compiler needed). On a machine with unrestricted internet access this is a non-issue. If you're ever installing behind a strict outbound firewall/proxy and it falls back to compiling from source, it needs to download Node headers from `nodejs.org` — make sure that domain isn't blocked, or install a build toolchain (`build-essential`/`python3`) so `node-gyp` can compile locally.

## Path to the free-tier production stack described in the original design

- Swap SQLite → Supabase Postgres (same schema, minimal changes; Supabase Auth can also replace the custom magic-link code if preferred)
- Move `scheduler.js`'s cron logic → Cloudflare Worker + Cron Triggers (or keep node-cron on a $0-tier host like Render/Fly.io if traffic is low)
- Resend is already wired — just add the API key
- Add Stripe per the checklist above
- Deploy static frontend + API together, or split frontend to Cloudflare Pages

## Remaining known limitations

1. No rate limiting on auth or site-add endpoints
2. No input sanitization beyond `new URL()` parsing — fine for URLs, but add basic XSS escaping if labels ever become free-text
3. SQLite is fine up to a few thousand users; migrate to Postgres before that
4. Magic links are single-use and expire in 15 minutes, but there's no UI resend-cooldown yet — a user could request many links in a row
