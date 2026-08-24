const db = require('./db');
const { sendEmail } = require('./email');

async function sendAlert(site, type, message) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(site.user_id);
  if (!user) return false;

  await sendEmail({
    to: user.email,
    subject: `GuardPost alert: ${site.label || site.domain}`,
    text: message,
    html: `<p><strong>${message}</strong></p><p>Site: ${site.url}</p>`,
  });

  if (user.alert_webhook_url) {
    try {
      await fetch(user.alert_webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: `🚨 GuardPost: ${message}`, content: `🚨 GuardPost: ${message}` }),
        // 'text' is Slack's field, 'content' is Discord's - sending both is harmless, each platform ignores the other
      });
    } catch (err) {
      console.error('Webhook delivery failed:', err.message);
    }
  }

  return true;
}

const alreadySent = db.prepare(`
  SELECT 1 FROM alerts_sent
  WHERE site_id = ? AND alert_type = ?
  AND sent_at > datetime('now', '-1 day')
`);

const recordAlert = db.prepare(`
  INSERT INTO alerts_sent (site_id, alert_type) VALUES (?, ?)
`);

async function maybeAlert(site, alertType, message) {
  if (alreadySent.get(site.id, alertType)) return; // already alerted today, don't spam
  await sendAlert(site, alertType, message);
  recordAlert.run(site.id, alertType);
}

/**
 * Given a fresh check result, decides which alerts (if any) should fire.
 */
async function evaluateAlerts(site, wasUp) {
  // Downtime: alert on the transition from up -> down
  // (SQLite returns 0/1 integers for booleans, so compare loosely / by truthiness)
  if (Number(wasUp) === 1 && Number(site.is_up) === 0) {
    await maybeAlert(site, 'downtime', `${site.url} appears to be down`);
  }

  // SSL expiry thresholds
  for (const threshold of [30, 14, 3]) {
    if (site.ssl_days_left !== null && site.ssl_days_left <= threshold && site.ssl_days_left > threshold - 1) {
      await maybeAlert(site, `ssl_${threshold}`, `SSL cert for ${site.domain} expires in ${site.ssl_days_left} days`);
    }
  }

  // Domain expiry thresholds
  for (const threshold of [30, 14, 3]) {
    if (site.domain_days_left !== null && site.domain_days_left <= threshold && site.domain_days_left > threshold - 1) {
      await maybeAlert(site, `domain_${threshold}`, `Domain ${site.domain} expires in ${site.domain_days_left} days`);
    }
  }
}

module.exports = { evaluateAlerts, sendAlert };
