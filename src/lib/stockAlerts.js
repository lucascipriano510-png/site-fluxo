// =====================================================================
// FLUXO OUTLET — "Avise-me quando voltar" (estoque)
// Cliente deixa o telefone num tamanho/produto esgotado -> vira lead.
// Tabela public.stock_notifications (migration add_stock_notifications
// + stock_notifications_customer_name).
// =====================================================================
import { supabase } from './supabaseClient';

// Normaliza telefone BR p/ só dígitos (com DDI 55).
function normPhone(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('55') && d.length >= 12) return d;
  if (d.length === 10 || d.length === 11) return '55' + d;
  return d;
}

// Registra um pedido de aviso. Mesmo telefone + peça + tamanho pendente não
// duplica (o cliente ansioso clica duas vezes; o dono não pode ver dobrado).
// Retorna { ok, duplicate? }.
export async function requestStockAlert({ product, size, phone, name }) {
  const cleanPhone = normPhone(phone);
  if (!cleanPhone || cleanPhone.length < 12) return { ok: false, error: 'Telefone inválido' };
  const cleanName = String(name || '').trim().slice(0, 60) || null;

  let dupQuery = supabase
    .from('stock_notifications')
    .select('id')
    .eq('phone', cleanPhone)
    .eq('notified', false)
    .limit(1);
  dupQuery = product?.id != null ? dupQuery.eq('product_id', product.id) : dupQuery.is('product_id', null);
  dupQuery = size ? dupQuery.eq('size', size) : dupQuery.is('size', null);
  const { data: dup } = await dupQuery;
  if (dup && dup.length > 0) {
    if (cleanName) await supabase.from('stock_notifications').update({ customer_name: cleanName }).eq('id', dup[0].id);
    return { ok: true, duplicate: true };
  }

  const row = {
    product_id: product?.id ?? null,
    sku: product?.sku || null,
    product_name: product?.name || null,
    size: size || null,
    phone: cleanPhone,
    customer_name: cleanName,
  };
  const { error } = await supabase.from('stock_notifications').insert(row);
  if (error) { console.warn('[stockAlert] insert falhou:', error.message); return { ok: false, error: error.message }; }
  return { ok: true };
}

// Lista os pedidos de aviso (admin). Pendentes primeiro, mais recentes no topo.
export async function fetchStockAlerts() {
  const { data, error } = await supabase
    .from('stock_notifications')
    .select('*')
    .order('notified', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// Marca um pedido como avisado (ou desfaz).
export async function setStockAlertNotified(id, notified = true) {
  const { error } = await supabase.from('stock_notifications').update({ notified }).eq('id', id);
  if (error) throw error;
  return { ok: true };
}

// Marca vários de uma vez (grupo produto × tamanho que voltou ao estoque).
export async function setStockAlertsNotifiedBulk(ids, notified = true) {
  if (!ids?.length) return { ok: true };
  const { error } = await supabase.from('stock_notifications').update({ notified }).in('id', ids);
  if (error) throw error;
  return { ok: true };
}
