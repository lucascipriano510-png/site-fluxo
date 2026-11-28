import { getServerSupabaseConfig, requireMetaAdmin, sendJson } from '../../server/whatsappAdmin.js';

const ADMIN_SELECT = 'id,order_number,name,phone,phone_digits,items,value,status,created_at,updated_at,store_id,meta_purchase_event_id,meta_purchase_sent_at,fbp,fbc,client_ua,src_url,utm,sales_channel';

function headers(key, prefer) {
  return { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json', 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) };
}

async function rest(path, key, options = {}) {
  const { prefer, ...requestOptions } = options;
  const response = await fetch(`${process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL}/rest/v1/${path}`, {
    ...requestOptions,
    headers: { ...headers(key, prefer), ...requestOptions.headers },
    cache: 'no-store',
  });
  const text = await response.text();
  if (!response.ok) {
    console.error('[admin-orders] Supabase request failed', { status: response.status, path: path.split('?')[0] });
    throw new Error('Não foi possível concluir a operação de pedidos.');
  }
  return text ? JSON.parse(text) : null;
}

function safeId(value) {
  const id = String(value || '').trim();
  return /^[1-9]\d{0,18}$/.test(id) ? id : '';
}

function safeItems(input) {
  if (!Array.isArray(input) || !input.length || input.length > 100) throw new Error('Itens de venda inválidos.');
  return input.map((item) => {
    const id = Number(item?.id);
    const qty = Number(item?.qty ?? item?.quantity ?? 1);
    const price = Number(item?.price ?? 0);
    if (!Number.isSafeInteger(id) || id <= 0 || !Number.isSafeInteger(qty) || qty <= 0 || qty > 1000 || !Number.isFinite(price) || price < 0) {
      throw new Error('Produto, quantidade ou preço inválido.');
    }
    return {
      id, name: String(item?.name || 'Produto').slice(0, 200), sku: String(item?.sku || '').slice(0, 100),
      price, size: String(item?.size || 'U').slice(0, 40), qty, image: String(item?.image || '').slice(0, 2000),
    };
  });
}

function unwrapRows(result) {
  return Array.isArray(result) ? (result[0] || null) : result;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  const admin = await requireMetaAdmin(req);
  if (!admin.ok) return sendJson(res, admin.status, { error: admin.error });
  const { url, serviceRoleKey } = getServerSupabaseConfig();
  if (!url || !serviceRoleKey) return sendJson(res, 503, { error: 'Pedidos administrativos não configurados no servidor.' });

  try {
    const base = url.replace(/\/$/, '');
    if (req.method === 'GET') {
      const mode = String(req.query?.mode || 'list');
      if (mode === 'purchase_event') {
        const id = safeId(req.query?.id);
        if (!id) return sendJson(res, 400, { error: 'Pedido inválido.' });
        const rows = await rest(`orders?select=id,meta_purchase_event_id&id=eq.${id}&limit=1`, serviceRoleKey);
        return rows?.length ? sendJson(res, 200, rows[0]) : sendJson(res, 404, { error: 'Pedido não encontrado.' });
      }
      const limit = Math.min(1000, Math.max(1, Number.parseInt(req.query?.limit, 10) || 1000));
      const offset = Math.max(0, Number.parseInt(req.query?.offset, 10) || 0);
      const rows = await rest(`orders?select=${encodeURIComponent(ADMIN_SELECT)}&order=created_at.desc&limit=${limit + 1}&offset=${offset}`, serviceRoleKey);
      const orders = rows || [];
      return sendJson(res, 200, { orders: orders.slice(0, limit), has_more: orders.length > limit });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'object' && req.body ? req.body : {};
      const action = String(body.action || '');
      if (action === 'manual_sale') {
        const requestId = String(body.request_id || '');
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
          return sendJson(res, 400, { error: 'Identificador da venda inválido.' });
        }
        const name = String(body.name || '').trim().slice(0, 200);
        const phone = String(body.phone || '').replace(/\D/g, '');
        const value = Number(body.value);
        const orderNumber = String(body.order_number || '').trim().slice(0, 40);
        if (name.length < 1 || phone.length < 10 || phone.length > 15 || !Number.isFinite(value) || value <= 0 || !orderNumber) {
          return sendJson(res, 400, { error: 'Dados da venda inválidos.' });
        }
        const items = safeItems(body.items);
        const result = await rest('rpc/fluxo_create_whatsapp_sale', serviceRoleKey, {
          method: 'POST', body: JSON.stringify({
            p_request_id: requestId,
            p_name: name, p_phone: phone, p_items: items, p_value: value,
            p_order_number: orderNumber, p_decrement_stock: body.decrement_stock !== false,
          }),
        });
        const order = unwrapRows(result);
        if (!order) throw new Error('A venda não foi registrada.');
        return sendJson(res, 201, order);
      }
      const id = safeId(body.id);
      if (!id) return sendJson(res, 400, { error: 'Pedido inválido.' });
      if (action === 'confirm_sale' || action === 'cancel') {
        const fn = action === 'confirm_sale' ? 'fluxo_confirm_order_sale' : 'fluxo_cancel_order';
        const result = await rest(`rpc/${fn}`, serviceRoleKey, { method: 'POST', body: JSON.stringify({ p_order_id: id }) });
        const order = unwrapRows(result);
        if (!order) throw new Error('Não foi possível atualizar o pedido.');
        return sendJson(res, 200, order);
      }
      if (action === 'mark_purchase_sent') {
        const eventId = String(body.event_id || '').trim();
        if (!/^[A-Za-z0-9_-]{1,128}$/.test(eventId)) return sendJson(res, 400, { error: 'Identificador Meta inválido.' });
        const rows = await rest(`orders?id=eq.${id}&select=id,meta_purchase_event_id&meta_purchase_event_id=is.null`, serviceRoleKey, {
          method: 'PATCH', body: JSON.stringify({ meta_purchase_event_id: eventId, meta_purchase_sent_at: new Date().toISOString() }), prefer: 'return=representation',
        });
        if (!rows?.length) {
          const existing = await rest(`orders?id=eq.${id}&select=id,meta_purchase_event_id&limit=1`, serviceRoleKey);
          if (!existing?.length) return sendJson(res, 404, { error: 'Pedido não encontrado.' });
          return sendJson(res, 200, existing[0]);
        }
        return sendJson(res, 200, rows[0]);
      }
      return sendJson(res, 400, { error: 'Ação inválida.' });
    }

    if (req.method === 'PATCH') {
      const body = typeof req.body === 'object' && req.body ? req.body : {};
      const id = safeId(body.id);
      const field = String(body.field || '');
      if (!id) return sendJson(res, 400, { error: 'Pedido inválido.' });
      let update;
      if (field === 'status') {
        const status = String(body.value || '').toUpperCase();
        if (!['NOVO', 'EM ATENDIMENTO'].includes(status)) return sendJson(res, 400, { error: 'Use a transação específica para concluir ou cancelar.' });
        update = { status };
      } else if (field === 'phone') {
        const phone = String(body.value || '').replace(/\D/g, '');
        if (phone.length < 10 || phone.length > 15) return sendJson(res, 400, { error: 'Telefone inválido.' });
        update = { phone };
      } else if (field === 'value') {
        const value = Number(body.value);
        if (!Number.isFinite(value) || value < 0 || value > 10000000) return sendJson(res, 400, { error: 'Valor inválido.' });
        update = { value: Math.round(value * 100) / 100 };
      } else return sendJson(res, 400, { error: 'Campo inválido.' });
      const rows = await rest(`orders?id=eq.${id}&select=${encodeURIComponent(ADMIN_SELECT)}`, serviceRoleKey, {
        method: 'PATCH', body: JSON.stringify(update), prefer: 'return=representation',
      });
      return rows?.length ? sendJson(res, 200, rows[0]) : sendJson(res, 404, { error: 'Pedido não encontrado.' });
    }

    return sendJson(res, 405, { error: 'Método não permitido.' });
  } catch (error) {
    console.error('[admin-orders] operation failed', error?.message || error);
    return sendJson(res, 400, { error: error?.message || 'Não foi possível concluir a operação.' });
  }
}
