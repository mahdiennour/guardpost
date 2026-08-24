const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_ADDRESS = process.env.GUARDPOST_FROM_EMAIL || 'GuardPost <alerts@guardpost.dev>';

/**
 * Sends an email. Uses Resend's HTTP API if RESEND_API_KEY is set
 * (no SDK dependency needed - it's a plain fetch call). Falls back to
 * logging the email to console so the whole app runs with zero setup.
 */
async function sendEmail({ to, subject, text, html }) {
  if (!RESEND_API_KEY) {
    console.log(`\n📧 [EMAIL - no RESEND_API_KEY set, logging instead of sending]`);
    console.log(`   To: ${to}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   Body: ${text}\n`);
    return { ok: true, simulated: true };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [to],
        subject,
        text,
        html: html || `<p>${text}</p>`,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error(`Resend API error (${res.status}): ${errBody}`);
      return { ok: false, error: errBody };
    }

    const data = await res.json();
    return { ok: true, id: data.id };
  } catch (err) {
    console.error('Failed to send email:', err.message);
    return { ok: false, error: err.message };
  }
}

module.exports = { sendEmail };
