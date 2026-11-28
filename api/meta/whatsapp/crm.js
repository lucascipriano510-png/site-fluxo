import { getServerSupabaseConfig, requireMetaAdmin, sendJson } from '../../../server/whatsappAdmin.js';

const MAX_PAGE_SIZE = 100;
function restHeaders(serviceRoleKey, prefer) {
  return { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, Accept: 'application/json', ...(prefer ? { Prefer: prefer } : {}) };
}
async function readRest(url, serviceRoleKey, { method = 'GET' } = {}) {
  const response = await fetch(url, { method, headers: restHeaders(serviceRoleKey, 'count=exact'), cache: 'no-store' });
  if (!response.ok) {
    console.error('[whatsapp-crm] Supabase read failed', { status: response.status });
    throw new Error('CRM storage unavailable');
  }
  return method === 'HEAD' ? response : response.json();
}
function safePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15 ? digits : '';
}
function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}
function safeNameSearch(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, ' ').trim().replace(/\s+/g, ' ').slice(0, 80);
}
function restUrl(base, path, params) {
  const url = new URL(`/rest/v1/${path}`, base);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }
  return url.toString();
}
function countFrom(response) {
  const range = response.headers.get('content-range') || '';
  const total = Number(range.split('/').pop());
  return Number.isFinite(total) ? total : 0;
}
async function totalCount(base, table, serviceRoleKey, extra = {}, keyColumn = 'id') {
  const response = await readRest(restUrl(base, table, { select: keyColumn, ...extra, limit: 1 }), serviceRoleKey, { method: 'HEAD' });
  return countFrom(response);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed.' });
  const admin = await requireMetaAdmin(req);
  if (!admin.ok) return sendJson(res, admin.status, { error: admin.error });
  const { url, serviceRoleKey } = getServerSupabaseConfig();
  if (!url || !serviceRoleKey) return sendJson(res, 503, { error: 'CRM API is not configured on the server.' });

  const params = req.query || {};
  const mode = String(params.mode || 'contacts');
  const base = url.replace(/\/$/, '');
  try {
    if (mode === 'metrics') {
      const [customers, messages, orders] = await Promise.all([
        totalCount(base, 'whatsapp_crm_customer_summary', serviceRoleKey, {}, 'contact_key'),
        totalCount(base, 'whatsapp_crm_messages', serviceRoleKey),
        totalCount(base, 'orders', serviceRoleKey),
      ]);
      return sendJson(res, 200, { customers, messages, orders });
    }

    if (mode === 'contacts') {
      const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Number.parseInt(params.limit, 10) || 50));
      const offset = Math.max(0, Number.parseInt(params.offset, 10) || 0);
      const query = { select: '*', order: 'last_activity_at.desc.nullslast,first_seen_at.desc', limit: limit + 1, offset };
      const rawSearch = String(params.q || '').trim();
      const phone = safePhone(rawSearch);
      if (phone) query.phone_digits = `ilike.*${phone}*`;
      else {
        const name = safeNameSearch(rawSearch);
        if (name) query.display_name = `ilike.*${name}*`;
      }
      const segment = String(params.segment || 'all');
      if (segment === 'no_purchase') { query.has_conversation = 'eq.true'; query.purchase_count = 'eq.0'; }
      else if (segment === 'single_purchase') query.purchase_count = 'eq.1';
      else if (segment === 'repeat') query.purchase_count = 'gt.1';
      else if (segment === 'reorder_due') {
        const rows = await readRest(restUrl(base, 'whatsapp_crm_customer_segments', {
          select: '*', is_repurchase_due: 'eq.true', order: 'last_activity_at.desc.nullslast,first_seen_at.desc', limit: limit + 1, offset,
          ...(phone ? { phone_digits: `ilike.*${phone}*` } : {}),
          ...(!phone && safeNameSearch(rawSearch) ? { display_name: `ilike.*${safeNameSearch(rawSearch)}*` } : {}),
        }), serviceRoleKey);
        const hasMore = rows.length > limit;
        return sendJson(res, 200, { contacts: rows.slice(0, limit), has_more: hasMore, next_offset: hasMore ? offset + limit : null });
      }
      const rows = await readRest(restUrl(base, 'whatsapp_crm_customer_summary', query), serviceRoleKey);
      const hasMore = rows.length > limit;
      return sendJson(res, 200, { contacts: rows.slice(0, limit), has_more: hasMore, next_offset: hasMore ? offset + limit : null });
    }

    if (mode === 'history') {
      const contactId = String(params.contact_id || '').trim();
      const phone = safePhone(params.phone);
      if (!phone && !/^[0-9a-f-]{36}$/i.test(contactId)) return sendJson(res, 400, { error: 'Contato inválido.' });
      const summaryParams = { select: '*', limit: 1 };
      if (phone) summaryParams.phone_digits = `eq.${phone}`;
      else summaryParams.contact_id = `eq.${contactId}`;
      const rows = await readRest(restUrl(base, 'whatsapp_crm_customer_summary', summaryParams), serviceRoleKey);
      const contact = rows[0] || null;
      if (!contact) return sendJson(res, 404, { error: 'Contato não encontrado.' });

      const messages = contact.contact_id ? await readRest(restUrl(base, 'whatsapp_crm_messages', {
        select: 'id,meta_message_id,direction,message_type,content,message_at,referral,phone_number_id',
        contact_id: `eq.${contact.contact_id}`, order: 'message_at.asc', limit: 500,
      }), serviceRoleKey) : [];
      const orders = contact.phone_digits ? await readRest(restUrl(base, 'orders', {
        select: 'id,order_number,items,value,status,created_at,sales_channel,meta_purchase_event_id',
        phone_digits: `eq.${contact.phone_digits}`, order: 'created_at.desc', limit: 200,
      }), serviceRoleKey) : [];
      let siteEvents = [];
      if (contact.phone_digits) {
        const searchDigits = contact.phone_digits.slice(-11);
        const candidates = await readRest(restUrl(base, 'site_lead_signals', {
          select: 'id,visitor_id,event,product_id,product_sku,product_name,category,subcategory,color,size,price,qty,meta,created_at,phone',
          phone: `ilike.*${searchDigits}*`, order: 'created_at.desc', limit: 200,
        }), serviceRoleKey);
        siteEvents = candidates.filter((event) => normalizePhone(event.phone) === contact.phone_digits);
      }
      const tasks = await readRest(restUrl(base, 'whatsapp_crm_tasks', {
        select: 'id,title,reason,note,due_at,status,created_at,completed_at', contact_id: `eq.${contact.contact_id || '00000000-0000-0000-0000-000000000000'}`,
        order: 'due_at.desc', limit: 100,
      }), serviceRoleKey);
      return sendJson(res, 200, { contact, messages, orders, site_events: siteEvents, tasks: tasks || [] });
    }

    return sendJson(res, 400, { error: 'Modo inválido.' });
  } catch (error) {
    console.error('[whatsapp-crm] request failed', error?.message || error);
    return sendJson(res, 503, { error: 'Não foi possível carregar o CRM agora.' });
  }
}
