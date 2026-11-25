import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { Readable } from 'node:stream';

process.env.SUPABASE_URL ||= 'https://supabase.test';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'service-role-test-only';
const { default: webhookHandler, extractInboundMessages, verifyChallenge, verifyMetaSignature } = await import('./webhook.js');

const APP_SECRET = 'local-test-only';

function signature(raw) {
  return `sha256=${createHmac('sha256', APP_SECRET).update(raw).digest('hex')}`;
}

test('verifica HMAC-SHA256 sobre os bytes originais e rejeita assinatura inválida', () => {
  const raw = Buffer.from('{"object":"whatsapp_business_account"}');
  assert.equal(verifyMetaSignature(raw, signature(raw), APP_SECRET), true);
  assert.equal(verifyMetaSignature(raw, signature(raw), 'wrong-secret'), false);
  assert.equal(verifyMetaSignature(raw, 'sha256=not-a-digest', APP_SECRET), false);
  assert.equal(verifyMetaSignature(Buffer.from('{}'), signature(raw), APP_SECRET), false);
});

test('responde challenge apenas com mode e verify token corretos', () => {
  const query = { 'hub.mode': 'subscribe', 'hub.verify_token': 'token-local', 'hub.challenge': '98765' };
  assert.equal(verifyChallenge(query, 'token-local'), '98765');
  assert.equal(verifyChallenge(query, 'wrong-token'), null);
  assert.equal(verifyChallenge({ ...query, 'hub.mode': 'unsubscribe' }, 'token-local'), null);
});

test('extrai mensagem recebida, telefone e referral, ignorando status e IDs duplicados depois', () => {
  const payload = {
    object: 'whatsapp_business_account',
    entry: [{ changes: [{ field: 'messages', value: {
      metadata: { phone_number_id: '1234567890' },
      contacts: [{ wa_id: '5534999990000', profile: { name: 'Cliente de teste' } }],
      messages: [{
        from: '5534999990000', id: 'wamid.local.1', timestamp: '1795636800', type: 'text',
        text: { body: 'Olá, gostaria de saber o preço.' },
        referral: { source_type: 'ad', source_id: 'ad-test', ctwa_clid: 'click-test' },
      }],
      statuses: [{ id: 'wamid.outgoing', status: 'delivered' }],
    } }] }],
  };

  const messages = extractInboundMessages(payload);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].phone_digits, '5534999990000');
  assert.equal(messages[0].profile_name, 'Cliente de teste');
  assert.equal(messages[0].meta_message_id, 'wamid.local.1');
  assert.equal(messages[0].content, 'Olá, gostaria de saber o preço.');
  assert.equal(messages[0].referral.source_type, 'ad');
  assert.equal(messages[0].phone_number_id, '1234567890');
});

test('não interpreta status de entrega nem mensagem sem número como venda', () => {
  const payload = {
    object: 'whatsapp_business_account',
    entry: [{ changes: [{ field: 'messages', value: {
      statuses: [{ id: 'wamid.outgoing', status: 'delivered' }],
      messages: [{ id: 'wamid.no-phone', type: 'text', text: { body: 'Oi' } }],
    } }] }],
  };
  assert.deepEqual(extractInboundMessages(payload), []);
});

test('persiste contato e mensagem recebida via PostgREST simulado, sem registrar status como conversa', async () => {
  const raw = Buffer.from(JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [{ changes: [{ field: 'messages', value: {
      contacts: [{ wa_id: '5534999990000', profile: { name: 'Cliente sintético' } }],
      messages: [{ from: '5534999990000', id: 'wamid.persist.test', timestamp: '1795636800', type: 'text', text: { body: 'Teste local; não é uma venda.' } }],
      statuses: [{ id: 'wamid.status.test', status: 'delivered' }],
    } }] }],
  }));
  const oldFetch = globalThis.fetch;
  const calls = [];
  process.env.META_APP_SECRET = APP_SECRET;
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || 'GET', body: options.body ? JSON.parse(options.body) : null });
    const isContactLookup = String(url).includes('whatsapp_crm_contacts?select=id');
    return {
      ok: true,
      status: 200,
      json: async () => isContactLookup ? [{ id: '00000000-0000-4000-8000-000000000001', phone_digits: '5534999990000' }] : [],
    };
  };

  try {
    const req = Readable.from([raw]);
    req.method = 'POST';
    req.headers = { 'x-hub-signature-256': signature(raw) };
    req.url = '/api/meta/whatsapp/webhook';
    const result = { statusCode: null, payload: null };
    const res = {
      setHeader() { return this; },
      status(code) { result.statusCode = code; return this; },
      json(body) { result.payload = body; return this; },
      send(body) { result.payload = body; return this; },
    };

    await webhookHandler(req, res);
    assert.equal(result.statusCode, 200);
    assert.deepEqual(result.payload, { ok: true, received: 1, stored: 1 });
    const contactUpserts = calls.filter((call) => call.method === 'POST' && call.url.includes('whatsapp_crm_contacts?'));
    assert.equal(contactUpserts.length, 2);
    assert.equal(contactUpserts[0].body[0].phone_digits, '5534999990000');
    assert.equal(contactUpserts[1].body[0].display_name, 'Cliente sintético');
    const messageInsert = calls.find((call) => call.method === 'POST' && call.url.includes('whatsapp_crm_messages?'));
    assert.equal(messageInsert.body[0].meta_message_id, 'wamid.persist.test');
    assert.equal(messageInsert.body[0].direction, 'inbound');
    assert.equal(messageInsert.body[0].content, 'Teste local; não é uma venda.');
    assert.equal(calls.some((call) => call.url.includes('orders')), false);
  } finally {
    globalThis.fetch = oldFetch;
  }
});
