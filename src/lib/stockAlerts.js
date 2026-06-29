// =====================================================================
// FLUXO OUTLET — "Avise-me quando voltar" (estoque)
// Cliente deixa o telefone num tamanho/produto esgotado -> vira lead.
// Tabela public.stock_notifications (migration add_stock_notifications).
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

// Registra um pedido de aviso. Retorna { ok }.
export async function requestStockAlert({ product, size, phone }) {
  const cleanPhone = normPhone(phone);
  if (!cleanPhone || cleanPhone.length < 12) return { ok: false, error: 'Telefone inválido' };
  const row = {
    product_id: product?.id ?? null,
    sku: product?.sku || null,
    product_name: product?.name || null,
    size: size || null,
    phone: cleanPhone,
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
