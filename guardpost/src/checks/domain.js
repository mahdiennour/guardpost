const net = require('net');

const IANA_WHOIS = 'whois.iana.org';

/**
 * Sends a raw WHOIS query to a given server and returns the text response.
 */
function queryWhois(server, query, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(43, server);
    let data = '';

    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error('whois timeout'));
    }, timeoutMs);

    socket.on('connect', () => {
      socket.write(query + '\r\n');
    });
    socket.on('data', (chunk) => (data += chunk.toString('utf8')));
    socket.on('end', () => {
      clearTimeout(timer);
      resolve(data);
    });
    socket.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/**
 * Finds the authoritative WHOIS server for a TLD via IANA, then queries it.
 * Falls back gracefully if a registry uses thin WHOIS (referral only).
 */
async function fetchWhoisRaw(domain) {
  const tld = domain.split('.').pop();
  const ianaResponse = await queryWhois(IANA_WHOIS, tld);
  const refMatch = ianaResponse.match(/refer:\s*([^\s]+)/i);

  if (!refMatch) {
    // Some TLDs answer directly from IANA (rare) - just use what we got
    return ianaResponse;
  }

  const registryServer = refMatch[1];
  const registryResponse = await queryWhois(registryServer, domain);
  return registryResponse;
}

/**
 * Extracts an expiry date from raw WHOIS text. Registries use inconsistent
 * field names, so we try the common variants in order.
 */
function extractExpiryDate(rawText) {
  const patterns = [
    /Registry Expiry Date:\s*(.+)/i,
    /Registrar Registration Expiration Date:\s*(.+)/i,
    /Expiration Date:\s*(.+)/i,
    /Expiry Date:\s*(.+)/i,
    /paid-till:\s*(.+)/i, // some ccTLDs
    /renewal date:\s*(.+)/i,
  ];

  for (const pattern of patterns) {
    const match = rawText.match(pattern);
    if (match) {
      const date = new Date(match[1].trim());
      if (!isNaN(date.getTime())) return date;
    }
  }
  return null;
}

/**
 * Public entry point. Returns { expiresAt, daysLeft, error }
 */
async function checkDomainExpiry(domain) {
  try {
    const raw = await fetchWhoisRaw(domain);
    const expiresAt = extractExpiryDate(raw);

    if (!expiresAt) {
      return { expiresAt: null, daysLeft: null, error: 'could not parse expiry from whois' };
    }

    const daysLeft = Math.floor((expiresAt - Date.now()) / (1000 * 60 * 60 * 24));
    return { expiresAt: expiresAt.toISOString(), daysLeft, error: null };
  } catch (err) {
    return { expiresAt: null, daysLeft: null, error: err.message };
  }
}

module.exports = { checkDomainExpiry };
