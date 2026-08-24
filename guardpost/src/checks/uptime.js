const https = require('https');
const http = require('http');

/**
 * Checks whether a URL is up. Follows the site's own protocol.
 * Returns { isUp, responseMs, statusCode, error }
 */
function checkUptime(url) {
  return new Promise((resolve) => {
    const start = Date.now();
    const client = url.startsWith('https') ? https : http;

    const req = client.get(url, { timeout: 10000 }, (res) => {
      // Drain the response so the socket closes cleanly
      res.on('data', () => {});
      res.on('end', () => {
        resolve({
          isUp: res.statusCode < 500,
          responseMs: Date.now() - start,
          statusCode: res.statusCode,
          error: null,
        });
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ isUp: false, responseMs: null, statusCode: null, error: 'timeout' });
    });

    req.on('error', (err) => {
      resolve({ isUp: false, responseMs: null, statusCode: null, error: err.message });
    });
  });
}

/**
 * Checks the SSL certificate expiry for a domain (port 443).
 * Returns { expiresAt, daysLeft, error }
 */
function checkSSL(domain) {
  const tls = require('tls');
  return new Promise((resolve) => {
    const socket = tls.connect(
      443,
      domain,
      { servername: domain, timeout: 8000, rejectUnauthorized: false },
      () => {
        const cert = socket.getPeerCertificate();
        socket.end();
        if (!cert || !cert.valid_to) {
          return resolve({ expiresAt: null, daysLeft: null, error: 'no certificate found' });
        }
        const expiresAt = new Date(cert.valid_to);
        const daysLeft = Math.floor((expiresAt - Date.now()) / (1000 * 60 * 60 * 24));
        resolve({ expiresAt: expiresAt.toISOString(), daysLeft, error: null });
      }
    );

    socket.on('timeout', () => {
      socket.destroy();
      resolve({ expiresAt: null, daysLeft: null, error: 'timeout' });
    });

    socket.on('error', (err) => {
      resolve({ expiresAt: null, daysLeft: null, error: err.message });
    });
  });
}

module.exports = { checkUptime, checkSSL };
