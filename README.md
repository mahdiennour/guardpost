# 🛡️ GuardPost

<p align="center">
  <strong>Uptime, SSL & Domain Expiry Monitoring for Freelancers and Small Agencies</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-Backend-339933?style=for-the-badge&logo=node.js&logoColor=white"/>
  <img src="https://img.shields.io/badge/Express.js-API-000000?style=for-the-badge&logo=express&logoColor=white"/>
  <img src="https://img.shields.io/badge/SQLite-Database-003B57?style=for-the-badge&logo=sqlite&logoColor=white"/>
  <img src="https://img.shields.io/badge/Security-Monitoring-red?style=for-the-badge&logo=shield&logoColor=white"/>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/SSL%2FTLS-Monitoring-blue?style=for-the-badge&logo=letsencrypt&logoColor=white"/>
  <img src="https://img.shields.io/badge/Uptime-Monitoring-success?style=for-the-badge"/>
  <img src="https://img.shields.io/badge/WHOIS-Domain%20Monitoring-orange?style=for-the-badge"/>
</p>

---

## 🚀 Overview

**GuardPost** is a lightweight monitoring platform built for **freelancers, developers, and small agencies managing client websites**.

It provides a centralized dashboard to monitor the health and security of websites by checking:

🔵 **Website uptime**
🔐 **SSL/TLS certificate expiration**
🌍 **Domain expiration**
🚨 **Service availability**
📧 **Automated alerts**

Instead of manually checking every client website, GuardPost automatically monitors them and notifies the site owner when something requires attention.

> 🛡️ **Know when something breaks before your client does.**

---

# ✨ Features

## 🌐 Website Uptime Monitoring

GuardPost periodically checks whether monitored websites are reachable.

The uptime monitoring system provides information about:

* 🟢 Website availability
* 🔴 Downtime detection
* ⏱️ Response status
* 📊 Check history
* 🔄 Downtime transitions

The scheduler performs uptime checks automatically every **5 minutes**.

```text
🌐 Website
    │
    ▼
🔍 HTTP(S) Check
    │
    ├── 🟢 Online
    │
    └── 🔴 Offline
           │
           ▼
      🚨 Alert System
```

---

# 🔐 SSL/TLS Certificate Monitoring

GuardPost automatically checks the SSL/TLS certificate of monitored websites.

It can determine:

* 🔒 Certificate validity
* 📅 Expiration date
* ⏳ Remaining validity
* ⚠️ Upcoming expiration
* 🚨 Expiration alerts

SSL monitoring is performed automatically on a **daily basis**.

### Alert thresholds

GuardPost can trigger alerts when a certificate reaches:

```text
🟡 30 days remaining
🟠 14 days remaining
🔴 3 days remaining
```

This helps prevent unexpected certificate expiration and the resulting browser security warnings.

---

# 🌍 Domain Expiration Monitoring

GuardPost also monitors **domain registration expiration**.

The application uses a raw **WHOIS client** to query the authoritative registry and determine the domain's expiration date.

### 🔎 How it works

```text
🌍 Domain
   │
   ▼
🌐 IANA
   │
   ▼
🏛️ Authoritative Registry
   │
   ▼
🔎 WHOIS Query
   │
   ▼
📅 Expiration Date
   │
   ▼
🚨 Alert Engine
```

No paid domain-monitoring API is required.

Domain checks are scheduled **weekly**.

---

# 🚨 Smart Alert System

GuardPost doesn't simply detect problems — it decides **when an alert should actually be sent**.

The alert engine handles:

### 🔴 Downtime

Alerts are triggered when a monitored website transitions into a downtime state.

### 🔐 SSL Expiration

Alerts are generated at:

* 30 days
* 14 days
* 3 days

### 🌍 Domain Expiration

The same expiration thresholds are used for domain monitoring.

### 🛑 Alert Deduplication

Alerts are deduplicated **per day** to avoid repeatedly sending the same notification.

```text
                 🔍 MONITORING
                       │
                       ▼
                🚨 ALERT ENGINE
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
       UPTIME         SSL         DOMAIN
          │            │            │
          └────────────┼────────────┘
                       ▼
                 🔎 THRESHOLD?
                    /       \
                  YES        NO
                   │          │
                   ▼          ▼
              🚨 ALERT      Continue
                   │
                   ▼
             📧 Email
             💬 Webhook
```

---

# 📧 Notifications

GuardPost supports automated notifications through:

### 📩 Email

Email notifications are sent using the **Resend HTTP API** when `RESEND_API_KEY` is configured.

Without an API key, GuardPost falls back to logging the email directly to the server console.

This makes local development possible with **zero external email configuration**.

### 💬 Webhooks

Optional:

* 💬 Slack webhook
* 🎮 Discord webhook

This makes GuardPost suitable for teams that want monitoring alerts directly inside their existing communication channels.

---

# 🔑 Passwordless Authentication

GuardPost uses a **magic-link authentication system**.

There are no traditional passwords to remember.

```text
👤 User
  │
  ▼
📧 Enter Email
  │
  ▼
🔐 Generate Magic Link
  │
  ▼
📩 Email / Console
  │
  ▼
🔗 Click Link
  │
  ▼
🎫 Create Session
  │
  ▼
🖥️ Dashboard
```

### Security characteristics

🔐 Single-use magic links
⏳ Links expire after **15 minutes**
🍪 Session-based authentication
👤 Authenticated user middleware
🛡️ Protected API routes

---

# 👥 Multi-Tenant Architecture

One of the important architectural aspects of GuardPost is **user isolation**.

Every monitored site is scoped to its owner through `user_id`.

```text
                 👥 USERS
                   │
       ┌───────────┼───────────┐
       ▼           ▼           ▼
    USER A       USER B      USER C
       │           │           │
       ▼           ▼           ▼
   🌐 Sites     🌐 Sites    🌐 Sites
       │           │           │
       ▼           ▼           ▼
   🔒 Isolated  🔒 Isolated 🔒 Isolated
```

A user cannot access or delete another user's monitored websites.

### 🧪 Tested

The multi-tenant isolation has been tested using two separate users created through real magic-link tokens.

The tests confirmed that:

* 👤 User B sees **zero** of User A's sites
* 🚫 Guessing another user's site ID does not provide access
* 🗑️ Unauthorized deletion attempts return **404**
* 🔒 User-owned resources remain isolated

---

# 🗄️ Database Architecture

GuardPost currently uses **SQLite** with the following core tables:

```text
users
│
├── id
├── email
├── plan
└── stripe information

magic_links
│
├── token
├── user_id
└── expiration

sessions
│
├── session
├── user_id
└── expiration

sites
│
├── id
├── user_id
├── url
└── monitoring configuration

check_history
│
└── Monitoring results

alerts_sent
│
└── Alert deduplication
```

The schema is designed to keep monitoring data associated with the correct user.

---

# ⏰ Automated Monitoring

GuardPost uses `node-cron` to schedule monitoring tasks.

| Monitoring         |       Frequency |
| ------------------ | --------------: |
| 🌐 Uptime          | Every 5 minutes |
| 🔐 SSL Certificate |           Daily |
| 🌍 Domain Expiry   |          Weekly |

This allows the application to continuously monitor client infrastructure without requiring manual checks.

---

# 🏗️ Architecture

```text
                         🛡️ GUARDPOST
                              │
                 ┌────────────┴────────────┐
                 │                         │
                 ▼                         ▼
           🖥️ WEB FRONTEND             🔌 EXPRESS API
                 │                         │
                 │                ┌────────┼────────┐
                 │                │        │        │
                 │                ▼        ▼        ▼
                 │              AUTH     SITES    BILLING
                 │                │
                 │                ▼
                 │             🗄️ SQLite
                 │
                 └──────────────────────────┐
                                            │
                              ⏰ SCHEDULER   │
                                    │       │
                         ┌──────────┼───────┘
                         ▼          ▼
                    🌐 UPTIME    🔐 SSL
                         │          │
                         └────┬─────┘
                              ▼
                         🌍 DOMAIN
                              │
                              ▼
                       🚨 ALERT ENGINE
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
                 📧 Email           💬 Webhook
```

---

# 📂 Project Structure

```text
guardpost/
│
├── 📁 src/
│   ├── 📄 db.js
│   ├── 🔐 auth.js
│   ├── 📧 email.js
│   ├── 🚨 alerts.js
│   ├── ⏰ scheduler.js
│   ├── 🌐 server.js
│   │
│   └── 📁 checks/
│       ├── 🌐 uptime.js
│       └── 🌍 domain.js
│
├── 📁 public/
│   ├── 🖥️ index.html
│   └── 📊 status.html
│
├── 📄 package.json
└── 📄 README.md
```

---

# 🌍 Public Status Page

One of GuardPost's notable features is its **public status page**.

The status page is intentionally unauthenticated and can be shared publicly.

This can be useful for:

* 🌐 Client-facing status pages
* 📢 Service availability
* 🔗 Shareable monitoring pages
* 🏢 Agency/client transparency

```text
👤 Visitor
    │
    ▼
🔗 Public Status URL
    │
    ▼
📊 Service Status
    │
    ├── 🟢 Operational
    ├── 🟡 Degraded
    └── 🔴 Down
```

---

# 💳 Billing Architecture

GuardPost includes a prepared billing architecture for **Stripe**.

The current prototype contains:

```text
/api/billing/checkout
/api/billing/webhook
```

These routes are currently intentionally stubbed and return:

```text
501 not_implemented_yet
```

The planned implementation includes:

* 💳 Stripe Checkout
* 👤 Stripe customer creation
* 📦 Subscription plans
* 🔄 Subscription updates
* 🧾 Customer subscription state
* 🔔 Stripe webhook processing

---

# ⚙️ Environment Variables

| Variable               | Required      | Description                               |
| ---------------------- | ------------- | ----------------------------------------- |
| `RESEND_API_KEY`       | ❌             | Enables real email delivery               |
| `GUARDPOST_FROM_EMAIL` | ❌             | Custom sender address                     |
| `PUBLIC_BASE_URL`      | ❌             | Production base URL                       |
| `STRIPE_SECRET_KEY`    | ❌             | Stripe billing integration                |
| `NODE_ENV=production`  | ⭐ Recommended | Enables secure HTTPS-only session cookies |

---

# 🚀 Run Locally

Clone the repository:

```bash
git clone https://github.com/YOUR_USERNAME/guardpost.git
```

Navigate into the project:

```bash
cd guardpost
```

Install dependencies:

```bash
npm install
```

Start the application:

```bash
node src/server.js
```

Then open:

```text
http://localhost:3000
```

### 🔑 Local Authentication

If `RESEND_API_KEY` is not configured, GuardPost prints the magic-link authentication URL directly in the server console.

This means you can run the application locally without configuring an external email provider.

---

# 🔒 Security

Security is a core part of GuardPost's architecture.

Current protections include:

* 🔐 Passwordless authentication
* ⏳ Expiring magic links
* 🎫 Session-based authentication
* 👥 User-scoped resources
* 🛡️ Multi-tenant isolation
* 🔒 Secure cookies in production
* 🚫 Unauthorized resource access protection
* 🚨 Monitoring and alerting

---

# ⚠️ Current Limitations

GuardPost is still a prototype and has several known limitations.

### 1. 🚦 Rate Limiting

There is currently no rate limiting on:

```text
/api/auth/request-link
```

A per-IP and/or per-email rate limiter should be added before production launch.

---

### 2. 🧹 Input Sanitization

URL validation currently relies primarily on:

```javascript
new URL()
```

Additional sanitization and XSS protection should be added if user-controlled labels become free-form text.

---

### 3. 🗄️ SQLite Scalability

SQLite is appropriate for the current prototype and small deployments.

For a larger SaaS deployment, the database should eventually migrate to:

```text
SQLite
   ↓
PostgreSQL
```

---

### 4. 🌍 WHOIS Network Restrictions

Domain monitoring currently uses a raw TCP connection over:

```text
Port 43
```

Some restricted hosting environments or firewalls may block this type of connection.

A potential fallback is **RDAP over HTTP**.

---

# 🗺️ Roadmap

### 🔐 Security

* [ ] Add authentication rate limiting
* [ ] Add site-add rate limiting
* [ ] Improve input sanitization
* [ ] Add security headers
* [ ] Add audit logging

### 📊 Monitoring

* [ ] Historical uptime graphs
* [ ] Response-time analytics
* [ ] Advanced SSL information
* [ ] DNS monitoring
* [ ] Port monitoring
* [ ] HTTP status monitoring

### 🔔 Notifications

* [ ] Email alert preferences
* [ ] Slack integration
* [ ] Discord integration
* [ ] Custom webhook management
* [ ] Alert escalation

### 💳 SaaS

* [ ] Stripe Checkout
* [ ] Subscription management
* [ ] Free / Pro plans
* [ ] Usage limits
* [ ] Billing dashboard

### 🗄️ Infrastructure

* [ ] SQLite → PostgreSQL
* [ ] Cloud deployment
* [ ] Distributed monitoring workers
* [ ] Cloudflare Cron Triggers
* [ ] Scalable monitoring architecture

---

# ☁️ Production Vision

The planned production architecture can evolve toward a low-cost cloud stack:

```text
                    🌍 USERS
                       │
                       ▼
                ☁️ FRONTEND
                       │
                       ▼
                 🔌 API SERVER
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
      🗄️ DATABASE    🔐 AUTH      💳 STRIPE
          │
          ▼
      ⏰ MONITORS
          │
    ┌─────┼─────┐
    ▼     ▼     ▼
   🌐    🔐    🌍
 UPTIME  SSL  DOMAIN
    │     │     │
    └─────┼─────┘
          ▼
      🚨 ALERTS
          │
      ┌───┴───┐
      ▼       ▼
    📧       💬
   EMAIL   WEBHOOK
```

---

# 🧠 Engineering Highlights

GuardPost demonstrates practical implementation of:

* 🔐 Passwordless authentication
* 👥 Multi-tenant application architecture
* 🌐 HTTP/HTTPS monitoring
* 🔒 SSL/TLS certificate inspection
* 🌍 WHOIS protocol interaction
* 🚨 Alert and notification systems
* ⏰ Scheduled background jobs
* 🗄️ Relational database design
* 🔌 REST API development
* 🛡️ Access control
* 📊 Monitoring infrastructure
* 💳 SaaS billing architecture

---

# 📸 Screenshots

Add screenshots of the application here:

### 🖥️ Dashboard

```text
📷 screenshots/dashboard.png
```

### 🔐 SSL Monitoring

```text
📷 screenshots/ssl-monitoring.png
```

### 🌐 Uptime Monitoring

```text
📷 screenshots/uptime.png
```

### 🌍 Public Status Page

```text
📷 screenshots/status-page.png
```

---

# 🤝 Contributing

Contributions, suggestions, and improvements are welcome.

```text
🍴 Fork
   ↓
🌿 Create a branch
   ↓
💻 Implement changes
   ↓
🧪 Test
   ↓
📤 Pull Request
```

---

# 📜 License

Add your project's license here.

Example:

```text
MIT License
```

---

# 👨‍💻 Author

### Mahdi Ennour

🛡️ Cybersecurity Engineer
💻 Software Developer
⚙️ DevSecOps Enthusiast

<p align="center">

<a href="https://github.com/YOUR_USERNAME">
<img src="https://img.shields.io/badge/GitHub-Profile-black?style=for-the-badge&logo=github"/>
</a>

<a href="https://www.linkedin.com/in/mahdi-ennour">
<img src="https://img.shields.io/badge/LinkedIn-Connect-blue?style=for-the-badge&logo=linkedin"/>
</a>

</p>

---

<p align="center">

🛡️ <strong>GuardPost</strong>

<em>Monitor your websites. Protect your services. Stay ahead of downtime.</em>

</p>

<p align="center">
⭐ If you find GuardPost useful, consider giving the repository a star!
</p>
