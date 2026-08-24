const cron = require('node-cron');
const db = require('./db');
const { checkUptime, checkSSL } = require('./checks/uptime');
const { checkDomainExpiry } = require('./checks/domain');
const { evaluateAlerts } = require('./alerts');

const updateUptimeStmt = db.prepare(`
  UPDATE sites SET last_check_at = datetime('now'), is_up = ?, last_response_ms = ?, last_status_code = ?
  WHERE id = ?
`);
const insertHistoryStmt = db.prepare(`
  INSERT INTO check_history (site_id, is_up, response_ms, status_code, error) VALUES (?, ?, ?, ?, ?)
`);
const updateSSLStmt = db.prepare(`
  UPDATE sites SET ssl_expires_at = ?, ssl_days_left = ?, ssl_checked_at = datetime('now') WHERE id = ?
`);
const updateDomainStmt = db.prepare(`
  UPDATE sites SET domain_expires_at = ?, domain_days_left = ?, domain_checked_at = datetime('now') WHERE id = ?
`);

async function runUptimeCheck(site) {
  const wasUp = site.is_up;
  const result = await checkUptime(site.url);
  updateUptimeStmt.run(result.isUp ? 1 : 0, result.responseMs, result.statusCode, site.id);
  insertHistoryStmt.run(site.id, result.isUp ? 1 : 0, result.responseMs, result.statusCode, result.error);

  const fresh = db.prepare('SELECT * FROM sites WHERE id = ?').get(site.id);
  await evaluateAlerts(fresh, wasUp);
}

async function runSSLCheck(site) {
  const result = await checkSSL(site.domain);
  updateSSLStmt.run(result.expiresAt, result.daysLeft, site.id);
  const fresh = db.prepare('SELECT * FROM sites WHERE id = ?').get(site.id);
  await evaluateAlerts(fresh, fresh.is_up);
}

async function runDomainCheck(site) {
  const result = await checkDomainExpiry(site.domain);
  updateDomainStmt.run(result.expiresAt, result.daysLeft, site.id);
  const fresh = db.prepare('SELECT * FROM sites WHERE id = ?').get(site.id);
  await evaluateAlerts(fresh, fresh.is_up);
}

function getAllSites() {
  return db.prepare('SELECT * FROM sites').all();
}

function startScheduler() {
  // Uptime: every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    for (const site of getAllSites()) await runUptimeCheck(site);
  });

  // SSL: once a day
  cron.schedule('0 3 * * *', async () => {
    for (const site of getAllSites()) await runSSLCheck(site);
  });

  // Domain expiry: once a week
  cron.schedule('0 4 * * 1', async () => {
    for (const site of getAllSites()) await runDomainCheck(site);
  });

  console.log('Scheduler started: uptime/5min, ssl/daily, domain/weekly');
}

module.exports = { startScheduler, runUptimeCheck, runSSLCheck, runDomainCheck };
