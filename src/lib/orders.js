import { supabase } from './supabaseClient';

async function adminOrderRequest({ method = 'GET', body, params = {} } = {}) {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data?.session?.access_token;
  if (!token) throw new Error('Entre novamente na conta administrativa.');
  const query = new URLSearchParams(params);
  const queryString = query.toString();
  const response = await fetch(`/api/admin/orders${queryString ? `?${queryString}` : ''}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Falha ao acessar pedidos.');
  return payload;
}

// Checkout público: INSERT continua permitido por RLS, mas não retorna linha
// alguma, para não exigir nem expor SELECT de pedidos pela chave pública.
export async function createOrder({ customer, items, total, status = 'NOVO', salesChannel = 'website' }) {
  if (status !== 'NOVO' || !Array.isArray(items) || !items.length) throw new Error('Pedido inválido.');
  const payload = {
    order_number: String(customer?.orderNumber || Math.floor(10000 + Math.random() * 90000)),
    name: String(customer?.name || 'Cliente não informado').trim().slice(0, 200),
    phone: String(customer?.phone || '').replace(/\D/g, ''),
    items: items.map((item) => ({
      id: Number(item?.id || 0), name: String(item?.name || '').slice(0, 200), sku: String(item?.sku || '').slice(0, 100),
      price: Number(item?.price || 0), size: String(item?.size || 'U').slice(0, 40), qty: Number(item?.qty || item?.quantity || 1),
      image: String(item?.image || '').slice(0, 2000),
    })),
    value: Number(total || 0), status, sales_channel: salesChannel === 'website' ? 'website' : null,
  };
  const { error } = await supabase.from('orders').insert([payload]);
  if (error) throw error;
  return { order_number: payload.order_number };
}

export async function createWhatsAppSale({ requestId, name, phone, items, value, orderNumber, decrementStock = true }) {
  return adminOrderRequest({
    method: 'POST',
    body: { action: 'manual_sale', request_id: requestId, name, phone, items, value, order_number: orderNumber, decrement_stock: decrementStock },
  });
}

export async function fetchOrders() {
  const allOrders = [];
  let offset = 0;
  const limit = 500;
  while (true) {
    const page = await adminOrderRequest({ params: { limit: String(limit), offset: String(offset) } });
    allOrders.push(...(Array.isArray(page?.orders) ? page.orders : []));
    if (!page?.has_more || !page.orders?.length) return allOrders;
    offset += page.orders.length;
  }
}

export async function confirmOrderSale(order) {
  return adminOrderRequest({ method: 'POST', body: { action: 'confirm_sale', id: order?.id } });
}

export async function cancelOrder(orderId) {
  return adminOrderRequest({ method: 'POST', body: { action: 'cancel', id: orderId } });
}

export async function updateOrderStatus(orderId, status) {
  return adminOrderRequest({ method: 'PATCH', body: { id: orderId, field: 'status', value: status } });
}

export async function getOrderPurchaseEventId(orderId) {
  const result = await adminOrderRequest({ params: { mode: 'purchase_event', id: String(orderId) } });
  return result?.meta_purchase_event_id || null;
}

export async function markOrderPurchaseSent(orderId, eventId) {
  return adminOrderRequest({ method: 'POST', body: { action: 'mark_purchase_sent', id: orderId, event_id: eventId } });
}

export async function updateOrderPhone(orderId, phone) {
  return adminOrderRequest({ method: 'PATCH', body: { id: orderId, field: 'phone', value: phone } });
}

export async function updateOrderValue(orderId, value) {
  return adminOrderRequest({ method: 'PATCH', body: { id: orderId, field: 'value', value } });
}
