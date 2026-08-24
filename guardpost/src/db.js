const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'guardpost.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL DEFAULT 'free', -- 'free' | 'solo' | 'agency'
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  alert_webhook_url TEXT, -- optional Slack/Discord webhook
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS magic_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used BOOLEAN DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  url TEXT NOT NULL,
  domain TEXT NOT NULL,
  label TEXT,
  public_status BOOLEAN DEFAULT 0,
  status_slug TEXT UNIQUE,
  created_at TEXT DEFAULT (datetime('now')),

  -- latest known state (denormalized for fast dashboard reads)
  last_check_at TEXT,
  is_up BOOLEAN,
  last_response_ms INTEGER,
  last_status_code INTEGER,

  ssl_expires_at TEXT,
  ssl_days_left INTEGER,
  ssl_checked_at TEXT,

  domain_expires_at TEXT,
  domain_days_left INTEGER,
  domain_checked_at TEXT,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS check_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL,
  checked_at TEXT DEFAULT (datetime('now')),
  is_up BOOLEAN,
  response_ms INTEGER,
  status_code INTEGER,
  error TEXT,
  FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS alerts_sent (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL,
  alert_type TEXT NOT NULL, -- 'downtime', 'ssl_30', 'ssl_14', 'ssl_3', 'domain_30', 'domain_14', 'domain_3'
  sent_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
);
`);

module.exports = db;
