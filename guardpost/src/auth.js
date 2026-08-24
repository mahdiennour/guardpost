const crypto = require('crypto');
const db = require('./db');
const { sendEmail } = require('./email');

const MAGIC_LINK_TTL_MIN = 15;
const SESSION_TTL_DAYS = 30;

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Creates a magic link token for the given email and "sends" it (via the
 * pluggable email module). Does NOT reveal whether the email already has
 * an account - same response either way, to avoid leaking user existence.
 */
async function requestMagicLink(email, baseUrl) {
  const normalizedEmail = email.trim().toLowerCase();
  const token = generateToken();
  const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MIN * 60 * 1000).toISOString();

  db.prepare(`INSERT INTO magic_links (email, token, expires_at) VALUES (?, ?, ?)`).run(
    normalizedEmail,
    token,
    expiresAt
  );

  const link = `${baseUrl}/api/auth/verify?token=${token}`;

  await sendEmail({
    to: normalizedEmail,
    subject: 'Your GuardPost sign-in link',
    text: `Click to sign in (expires in ${MAGIC_LINK_TTL_MIN} minutes): ${link}`,
    html: `<p>Click below to sign in. This link expires in ${MAGIC_LINK_TTL_MIN} minutes.</p><p><a href="${link}">${link}</a></p>`,
  });

  return { ok: true };
}

/**
 * Verifies a magic link token, creates the user if new, creates a session,
 * and returns the session token to set as a cookie.
 */
function verifyMagicLink(token) {
  const record = db.prepare(`SELECT * FROM magic_links WHERE token = ?`).get(token);

  if (!record) return { error: 'invalid_token' };
  if (record.used) return { error: 'already_used' };
  if (new Date(record.expires_at) < new Date()) return { error: 'expired' };

  db.prepare(`UPDATE magic_links SET used = 1 WHERE id = ?`).run(record.id);

  let user = db.prepare(`SELECT * FROM users WHERE email = ?`).get(record.email);
  if (!user) {
    const info = db.prepare(`INSERT INTO users (email) VALUES (?)`).run(record.email);
    user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(info.lastInsertRowid);
  }

  const sessionToken = generateToken();
  const sessionExpires = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(`INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)`).run(
    user.id,
    sessionToken,
    sessionExpires
  );

  return { sessionToken, user };
}

function getUserFromSessionToken(token) {
  if (!token) return null;
  const session = db.prepare(`SELECT * FROM sessions WHERE token = ?`).get(token);
  if (!session) return null;
  if (new Date(session.expires_at) < new Date()) return null;
  return db.prepare(`SELECT * FROM users WHERE id = ?`).get(session.user_id);
}

/**
 * Express middleware: reads the session cookie, attaches req.user.
 * Does NOT block unauthenticated requests itself - routes decide that.
 */
function attachUser(req, res, next) {
  const token = req.cookies && req.cookies.gp_session;
  req.user = getUserFromSessionToken(token);
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'not authenticated' });
  next();
}

function logout(token) {
  db.prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
}

module.exports = { requestMagicLink, verifyMagicLink, attachUser, requireAuth, logout };
