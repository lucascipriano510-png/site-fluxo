import { supabase } from './supabaseClient';

// Schema real da tabela `orders`:
// id | order_number | name | phone | items (jsonb) | value | status | created_at

// Cria um pedido novo (status NOVO). NÃO mexe no estoque.
export async function createOrder({ customer, items, total, notes = '', status = 'NOVO' }) {
  const name = String(customer?.name || 'Cliente não informado').trim();
  const phone = String(customer?.phone || '').replace(/\D/g, '') || '00000000000';
  const orderNumber = String(customer?.orderNumber || Math.floor(10000 + Math.random() * 90000));
  const safeItems = Array.isArray(items)
    ? items.map((item) => ({
        id: Number(item?.id || 0),
        name: String(item?.name || 'Produto sem nome'),
        sku: String(item?.sku || ''),
        price: Number(item?.price || 0),
        size: String(item?.size || 'U'),
        qty: Number(item?.qty || item?.quantity || 1),
        image: String(item?.image || ''),
      }))
    : [];

  const payload = {
    order_number: orderNumber,
    name,
    phone,
    items: safeItems,
    value: Number(total || 0),
    status: String(status || 'NOVO'),
  };

  const { data, error } = await supabase
    .from('orders')
    .insert([payload])
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Lista todos os pedidos (mais recentes primeiro)
export async function fetchOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// Confirma a venda: muda status para "CONCLUÍDO" E decrementa estoque
export async function confirmOrderSale(order, products) {
  // 1) Atualiza estoque de cada item
  for (const item of order.items || []) {
    const product = products.find(p => p.id === item.id);
    if (!product) continue;

    const qty = Number(item.qty || item.quantity || 1);
    const newStock = Math.max(0, Number(product.stock || 0) - qty);
    const newSales = Number(product.sales || 0) + qty;

    // Atualiza stock por tamanho se houver
    let newSizes = product.sizes || [];
    if (item.size && Array.isArray(newSizes)) {
      newSizes = newSizes.map(s =>
        s.size === item.size
          ? { ...s, stock: Math.max(0, Number(s.stock || 0) - qty) }
          : s
      );
    }

    const { error: upErr } = await supabase
      .from('products')
      .update({ stock: newStock, sales: newSales, sizes: newSizes })
      .eq('id', product.id);
    if (upErr) throw upErr;
  }

  // 2) Marca pedido como CONCLUÍDO
  const { data, error } = await supabase
    .from('orders')
    .update({ status: 'CONCLUÍDO' })
    .eq('id', order.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Cancela pedido
export async function cancelOrder(orderId) {
  const { data, error } = await supabase
    .from('orders')
    .update({ status: 'CANCELADO' })
    .eq('id', orderId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Devolve o estoque ao cancelar uma venda que JÁ FOI CONCLUÍDA.
// Espelha confirmOrderSale: soma stock de volta e abate sales.
// Use SOMENTE quando oldStatus === 'CONCLUÍDO' e newStatus === 'CANCELADO'.
export async function restoreOrderStock(order, products) {
  for (const item of order.items || []) {
    const product = products.find(p => p.id === item.id);
    if (!product) continue;

    const qty = Number(item.qty || item.quantity || 1);
    const newStock = Number(product.stock || 0) + qty;
    const newSales = Math.max(0, Number(product.sales || 0) - qty);

    let newSizes = product.sizes || [];
    if (item.size && Array.isArray(newSizes)) {
      newSizes = newSizes.map(s => {
        const sName = typeof s === 'string' ? s : s.size;
        const sStock = typeof s === 'string' ? Number(product.stock || 0) : Number(s.stock || 0);
        if (sName !== item.size) return typeof s === 'string' ? { size: sName, stock: sStock } : s;
        return { ...(typeof s === 'string' ? { size: sName } : s), size: sName, stock: sStock + qty };
      });
    }

    const { error: upErr } = await supabase
      .from('products')
      .update({ stock: newStock, sales: newSales, sizes: newSizes })
      .eq('id', product.id);
    if (upErr) throw upErr;
  }
}

// Atualiza status genérico (ex: EM ATENDIMENTO)
export async function updateOrderStatus(orderId, status) {
  const { data, error } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', orderId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteOrder(orderId) {
  const { error } = await supabase.from('orders').delete().eq('id', orderId);
  if (error) throw error;
}

// Idempotência do Purchase no nível do PEDIDO (P17).
// Lê o event_id de Purchase já gravado para este pedido (ou null).
export async function getOrderPurchaseEventId(orderId) {
  const { data, error } = await supabase
    .from('orders')
    .select('meta_purchase_event_id')
    .eq('id', orderId)
    .single();
  if (error) throw error;
  return data?.meta_purchase_event_id || null;
}

// Grava a trava: event_id + timestamp do Purchase. Chamar SOMENTE após a
// Meta aceitar o evento (assim uma falha permite retry depois).
export async function markOrderPurchaseSent(orderId, eventId) {
  const { error } = await supabase
    .from('orders')
    .update({ meta_purchase_event_id: eventId, meta_purchase_sent_at: new Date().toISOString() })
    .eq('id', orderId);
  if (error) throw error;
}

// Atualiza o telefone de um pedido (correção de número errado para CAPI)
export async function updateOrderPhone(orderId, phone) {
  const cleaned = String(phone || '').replace(/\D/g, '');
  if (cleaned.length < 10) throw new Error('Telefone inválido');
  const { data, error } = await supabase
    .from('orders')
    .update({ phone: cleaned })
    .eq('id', orderId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Atualiza o valor pago do pedido (ex: após aplicar desconto manual).
// Útil quando o cliente fecha o pedido com valor diferente do calculado pelo carrinho.
export async function updateOrderValue(orderId, value) {
  const v = Number(value);
  if (!Number.isFinite(v) || v < 0) throw new Error('Valor inválido');
  const { data, error } = await supabase
    .from('orders')
    .update({ value: Math.round(v * 100) / 100 })
    .eq('id', orderId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
