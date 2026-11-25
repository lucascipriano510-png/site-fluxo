import { createHmac, timingSafeEqual } from 'node:crypto';

export const config = { api: { bodyParser: false, sizeLimit: '4mb' } };

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const MAX_BODY_BYTES = 4 * 1024 * 1024;
const BATCH_SIZE = 100;

export function verifyMetaSignature(rawBody, signatureHeader, appSecret) {
  if (!Buffer.isBuffer(rawBody) || !appSecret || typeof signatureHeader !== 'string') return false;
  const match = /^sha256=([a-f0-9]{64})$/i.exec(signatureHeader.trim());
  if (!match) return false;
  const actual = Buffer.from(match[1], 'hex');
  const expected = createHmac('sha256', appSecret).update(rawBody).digest();
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function verifyChallenge(query, expectedToken) {
  if (!expectedToken || query?.['hub.mode'] !== 'subscribe' || typeof query?.['hub.verify_token'] !== 'string')
    return null;
  const actual = Buffer.from(query['hub.verify_token']);
  const expected = Buffer.from(expectedToken);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  return typeof query['hub.challenge'] === 'string' ? query['hub.challenge'] : null;
}

export function extractInboundMessages(payload) {
  const result = [];
  if (payload?.object !== 'whatsapp_business_account' || !Array.isArray(payload.entry)) return result;

  for (const entry of payload.entry) {
    for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
      if (change?.field !== 'messages') continue;
      const value = change?.value || {};
      const contacts = new Map(
        (Array.isArray(value.contacts) ? value.contacts : [])
          .map((contact) => [String(contact?.wa_id || '').replace(/\D/g, ''), contact])
          .filter(([phone]) => phone),
      );
      for (const message of Array.isArray(value.messages) ? value.messages : []) {
        const phoneDigits = String(message?.from || '').replace(/\D/g, '');
        const messageId = String(message?.id || '').trim();
        if (!messageId || phoneDigits.length < 10 || phoneDigits.length > 15) continue;

        const contact = contacts.get(phoneDigits);
        const profileName = String(contact?.profile?.name || '').trim().slice(0, 200);
        const type = String(message?.type || 'unknown').slice(0, 40);
        const typedContent = message?.[type] || {};
        let content = type === 'text'
          ? typedContent?.body
          : (typedContent?.caption || null);
        if (typeof content === 'string') content = content.slice(0, 10000);
        else content = null;

        const rawTimestamp = Number(message?.timestamp);
        const messageAt = Number.isFinite(rawTimestamp) && rawTimestamp > 0
          ? new Date(rawTimestamp * 1000).toISOString()
          : new Date().toISOString();
        const referral = message?.referral && typeof message.referral === 'object'
          ? {
              source_type: String(message.referral.source_type || '').slice(0, 80) || null,
              source_id: String(message.referral.source_id || '').slice(0, 160) || null,
              source_url: String(message.referral.source_url || message.referral.url || '').slice(0, 1000) || null,
              headline: String(message.referral.headline || '').slice(0, 240) || null,
              body: String(message.referral.body || '').slice(0, 1000) || null,
              ctwa_clid: String(message.referral.ctwa_clid || '').slice(0, 500) || null,
            }
          : null;

        result.push({
          phone_digits: phoneDigits,
          profile_name: profileName || null,
          meta_message_id: messageId,
          message_type: type,
          content,
          message_at: messageAt,
          referral,
          phone_number_id: String(value?.metadata?.phone_number_id || '').slice(0, 40) || null,
        });
      }
    }
  }
  return result;
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Payload too large'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function serviceHeaders(prefer) {
  return {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(prefer ? { Prefer: prefer } : {}),
  };
}

async function postgrest(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${path}`, {
    ...options,
    headers: { ...serviceHeaders(options.prefer), ...options.headers },
  });
  if (!response.ok) {
    console.error('[whatsapp-webhook] Supabase write failed', { status: response.status });
    throw new Error('CRM storage failed');
  }
  return response;
}

async function persistInboundMessages(messages) {
  if (!messages.length) return { received: 0, stored: 0 };
  const uniqueMessages = [...new Map(messages.map((message) => [message.meta_message_id, message])).values()];
  const phones = [...new Set(uniqueMessages.map((message) => message.phone_digits))];
  const contactByPhone = new Map();

  for (let i = 0; i < phones.length; i += BATCH_SIZE) {
    const batchPhones = phones.slice(i, i + BATCH_SIZE);
    const batchMessages = uniqueMessages.filter((message) => batchPhones.includes(message.phone_digits));
    const bareContacts = batchPhones.map((phone_digits) => ({ phone_digits }));
    await postgrest('whatsapp_crm_contacts?on_conflict=phone_digits', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify(bareContacts),
    });

    const namedContacts = [...new Map(
      batchMessages.filter((message) => message.profile_name)
        .map((message) => [message.phone_digits, { phone_digits: message.phone_digits, display_name: message.profile_name }]),
    ).values()];
    if (namedContacts.length) {
      await postgrest('whatsapp_crm_contacts?on_conflict=phone_digits', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(namedContacts),
      });
    }

    const filter = encodeURIComponent(`in.(${batchPhones.join(',')})`);
    const contactsResponse = await postgrest(`whatsapp_crm_contacts?select=id,phone_digits&phone_digits=${filter}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    const contacts = await contactsResponse.json();
    for (const contact of contacts) contactByPhone.set(contact.phone_digits, contact.id);

    const rows = batchMessages
      .filter((message) => contactByPhone.has(message.phone_digits))
      .map((message) => ({
        contact_id: contactByPhone.get(message.phone_digits),
        meta_message_id: message.meta_message_id,
        direction: 'inbound',
        message_type: message.message_type,
        content: message.content,
        message_at: message.message_at,
        referral: message.referral,
        phone_number_id: message.phone_number_id,
      }));
    if (rows.length) {
      await postgrest('whatsapp_crm_messages?on_conflict=meta_message_id', {
        method: 'POST',
        headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
        body: JSON.stringify(rows),
      });
    }
  }
  return { received: messages.length, stored: uniqueMessages.length };
}

function queryOf(req) {
  if (req.query && Object.keys(req.query).length) return req.query;
  return Object.fromEntries(new URL(req.url || '/', 'https://localhost').searchParams.entries());
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method === 'GET') {
    const challenge = verifyChallenge(queryOf(req), process.env.META_WHATSAPP_VERIFY_TOKEN || '');
    if (challenge === null) return res.status(process.env.META_WHATSAPP_VERIFY_TOKEN ? 403 : 503).send('Webhook verification failed');
    return res.status(200).send(challenge);
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const appSecret = process.env.META_APP_SECRET || '';
  if (!appSecret || !SUPABASE_URL || !SERVICE_ROLE_KEY)
    return res.status(503).json({ error: 'WhatsApp webhook is not configured on the server.' });

  let rawBody;
  try {
    rawBody = await readRawBody(req);
  } catch (error) {
    return res.status(error?.statusCode || 400).json({ error: 'Invalid webhook body.' });
  }
  const signature = req.headers['x-hub-signature-256'];
  if (!verifyMetaSignature(rawBody, signature, appSecret))
    return res.status(401).json({ error: 'Invalid webhook signature.' });

  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Invalid JSON.' });
  }
  if (payload?.object !== 'whatsapp_business_account')
    return res.status(200).json({ ok: true, ignored: true });

  const messages = extractInboundMessages(payload);
  try {
    const result = await persistInboundMessages(messages);
    return res.status(200).json({ ok: true, ...result });
  } catch {
    return res.status(500).json({ error: 'Could not persist WhatsApp event; Meta may retry.' });
  }
}
