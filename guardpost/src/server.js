const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const db = require('./db');
const { startScheduler, runUptimeCheck, runSSLCheck, runDomainCheck } = require('./scheduler');
const { requestMagicLink, verifyMagicLink, attachUser, requireAuth, logout } = require('./auth');

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(attachUser);
app.use(express.static(path.join(__dirname, '..', 'public')));

const PLAN_LIMITS = { free: 3, solo: 15, agency: 75 };
const IS_PROD = process.env.NODE_ENV === 'production';

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Math.random().toString(36).slice(2, 7);
}

function baseUrl(req) {
  return process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
}

// --- Auth ---

app.post('/api/auth/request-link', async (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'valid email required' });
  await requestMagicLink(email, baseUrl(req));
  res.json({ ok: true, message: 'Check your email for a sign-in link.' });
});

app.get('/api/auth/verify', (req, res) => {
  const { token } = req.query;
  const result = verifyMagicLink(token);
  if (result.error) return res.redirect('/?auth_error=' + result.error);

  res.cookie('gp_session', result.sessionToken, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
  res.redirect('/');
});

app.post('/api/auth/logout', (req, res) => {
  const token = req.cookies && req.cookies.gp_session;
  if (token) logout(token);
  res.clearCookie('gp_session');
  res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  if (!req.user) return res.json({ user: null });
  const currentCount = db.prepare('SELECT COUNT(*) as c FROM sites WHERE user_id = ?').get(req.user.id).c;
  res.json({
    user: { email: req.user.email, plan: req.user.plan },
    limit: PLAN_LIMITS[req.user.plan],
    used: currentCount,
  });
});

// --- Sites CRUD (all scoped to req.user) ---

app.get('/api/sites', requireAuth, (req, res) => {
  const sites = db.prepare('SELECT * FROM sites WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  res.json(sites);
});

app.post('/api/sites', requireAuth, async (req, res) => {
  const { urls } = req.body;
  if (!urls || typeof urls !== 'string') return res.status(400).json({ error: 'urls (string) required' });

  const currentCount = db.prepare('SELECT COUNT(*) as c FROM sites WHERE user_id = ?').get(req.user.id).c;
  const limit = PLAN_LIMITS[req.user.plan];

  const lines = urls.split('\n').map((l) => l.trim()).filter(Boolean);
  const created = [];
  const skipped = [];

  const insertStmt = db.prepare(`
    INSERT INTO sites (user_id, url, domain, label, status_slug) VALUES (?, ?, ?, ?, ?)
  `);

  for (const line of lines) {
    if (currentCount + created.length >= limit) {
      skipped.push({ url: line, reason: `plan limit (${limit}) reached` });
      continue;
    }
    try {
      const normalized = line.startsWith('http') ? line : `https://${line}`;
      const domain = new URL(normalized).hostname;
      const slug = slugify(domain);
      const info = insertStmt.run(req.user.id, normalized, domain, domain, slug);
      created.push({ id: info.lastInsertRowid, url: normalized, domain });
    } catch (e) {
      skipped.push({ url: line, reason: 'invalid URL' });
    }
  }

  for (const site of created) {
    const fullSite = db.prepare('SELECT * FROM sites WHERE id = ?').get(site.id);
    runUptimeCheck(fullSite).catch(() => {});
    runSSLCheck(fullSite).catch(() => {});
    runDomainCheck(fullSite).catch(() => {});
  }

  res.json({ created, skipped, limit, currentCount: currentCount + created.length });
});

function ownedSiteOr404(req, res) {
  const site = db.prepare('SELECT * FROM sites WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!site) res.status(404).json({ error: 'not found' });
  return site;
}

app.delete('/api/sites/:id', requireAuth, (req, res) => {
  if (!ownedSiteOr404(req, res)) return;
  db.prepare('DELETE FROM sites WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

app.patch('/api/sites/:id/public-status', requireAuth, (req, res) => {
  if (!ownedSiteOr404(req, res)) return;
  const { enabled } = req.body;
  db.prepare('UPDATE sites SET public_status = ? WHERE id = ? AND user_id = ?').run(enabled ? 1 : 0, req.params.id, req.user.id);
  res.json(db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id));
});

app.post('/api/sites/:id/check-now', requireAuth, async (req, res) => {
  const site = ownedSiteOr404(req, res);
  if (!site) return;
  await runUptimeCheck(site);
  await runSSLCheck(site);
  await runDomainCheck(site);
  res.json(db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id));
});

app.patch('/api/account/webhook', requireAuth, (req, res) => {
  const { webhookUrl } = req.body;
  db.prepare('UPDATE users SET alert_webhook_url = ? WHERE id = ?').run(webhookUrl || null, req.user.id);
  res.json({ ok: true });
});

// --- Public status page (no auth - shareable/viral feature) ---

app.get('/api/status/:slug', (req, res) => {
  const site = db.prepare('SELECT * FROM sites WHERE status_slug = ? AND public_status = 1').get(req.params.slug);
  if (!site) return res.status(404).json({ error: 'not found' });

  const history = db.prepare(`
    SELECT is_up, checked_at FROM check_history
    WHERE site_id = ? ORDER BY checked_at DESC LIMIT 90
  `).all(site.id);

  res.json({ site, history });
});

app.get('/status/:slug', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'status.html'));
});

// --- Billing (Stripe Checkout stub - see README for wiring instructions) ---

app.post('/api/billing/checkout', requireAuth, (req, res) => {
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(501).json({
      error: 'billing_not_configured',
      message: 'Set STRIPE_SECRET_KEY and STRIPE_PRICE_ID_* env vars to enable checkout. See README.',
    });
  }
  res.status(501).json({ error: 'not_implemented_yet' });
});

app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  // Stripe webhook handler stub - verifies signature and updates users.plan
  // on checkout.session.completed / customer.subscription.updated events.
  // See README for the full implementation.
  res.json({ received: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`GuardPost running at http://localhost:${PORT}`);
  startScheduler();
});
