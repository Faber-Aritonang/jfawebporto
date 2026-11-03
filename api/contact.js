/**
 * Contact API — form kontak portfolio
 *
 * POST /api/contact  { name, email, subject?, message, website? }
 *
 * Pengiriman (pilih salah satu, tanpa dependency baru):
 *   1. CONTACT_WEBHOOK_URL  → POST JSON ke webhook (Zapier / Make / Discord / Slack / dsb.)
 *   2. RESEND_API_KEY       → kirim email via REST Resend
 *                              (CONTACT_TO_EMAIL, CONTACT_FROM_EMAIL)
 *
 * Kalau belum ada yang dikonfigurasi, endpoint membalas 503 { configured: false }
 * dan frontend menawarkan kirim lewat aplikasi email pengunjung (mailto).
 */

const MAX_MESSAGE = 5000;
const RATE_LIMIT = { windowMs: 10 * 60 * 1000, max: 5 };
const hits = new Map(); // per-instance saja; cukup untuk mencegah spam sederhana

function isRateLimited(ip) {
  if (!ip) return false;
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now - entry.start > RATE_LIMIT.windowMs) {
    hits.set(ip, { start: now, count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT.max;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function validate(body) {
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim();
  const subject = String(body.subject || '').trim();
  const message = String(body.message || '').trim();

  if (name.length < 2 || name.length > 100) return { error: 'Nama wajib diisi (2-100 karakter)' };
  if (!isValidEmail(email)) return { error: 'Email tidak valid' };
  if (subject.length > 150) return { error: 'Subjek terlalu panjang (maks 150 karakter)' };
  if (message.length < 5) return { error: 'Pesan terlalu pendek' };
  if (message.length > MAX_MESSAGE) return { error: 'Pesan terlalu panjang (maks 5000 karakter)' };

  return { data: { name, email, subject, message } };
}

async function sendViaWebhook(url, payload) {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });
  if (!resp.ok) throw new Error(`Webhook menolak pesan (HTTP ${resp.status})`);
}

async function sendViaResend(payload) {
  const to = process.env.CONTACT_TO_EMAIL;
  const from = process.env.CONTACT_FROM_EMAIL || 'Portfolio <onboarding@resend.dev>';
  if (!to) throw new Error('CONTACT_TO_EMAIL belum di-set');

  const text = [
    `Nama: ${payload.name}`,
    `Email: ${payload.email}`,
    `Subjek: ${payload.subject || '(tanpa subjek)'}`,
    '',
    payload.message,
  ].join('\n');

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: payload.email,
      subject: `[Portfolio] ${payload.subject || payload.name}`,
      text,
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!resp.ok) {
    const err = await resp.text();
    console.error('[Contact] Resend error:', resp.status, err.substring(0, 200));
    throw new Error('Gagal mengirim email');
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  // Honeypot: bot mengisi field tersembunyi, manusia tidak
  if (String(body.website || '').trim() !== '') {
    return res.status(200).json({ ok: true });
  }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Terlalu banyak pesan. Coba lagi beberapa menit lagi.' });
  }

  const { error, data } = validate(body);
  if (error) return res.status(400).json({ error });

  const webhook = process.env.CONTACT_WEBHOOK_URL;
  const resendKey = process.env.RESEND_API_KEY;

  if (!webhook && !resendKey) {
    return res.status(503).json({
      error: 'Form kontak belum dikonfigurasi',
      configured: false,
    });
  }

  try {
    if (webhook) {
      await sendViaWebhook(webhook, {
        type: 'contact',
        ...data,
        received_at: new Date().toISOString(),
      });
    } else {
      await sendViaResend(data);
    }

    return res.status(200).json({ ok: true, via: webhook ? 'webhook' : 'email' });
  } catch (err) {
    console.error('[Contact] Error:', err.message);
    return res.status(502).json({ error: 'Pesan gagal dikirim. Silakan hubungi email/Telegram langsung.' });
  }
};
