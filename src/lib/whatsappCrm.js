import { supabase } from './supabaseClient';

async function crmRequest(params) {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data?.session?.access_token;
  if (!token) throw new Error('Entre novamente na conta administrativa.');

  const query = new URLSearchParams(params);
  const response = await fetch(`/api/meta/whatsapp/crm?${query.toString()}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Falha ao consultar o CRM.');
  return payload;
}

export function fetchWhatsAppCrmContacts({ q = '', limit = 50, offset = 0 } = {}) {
  return crmRequest({ mode: 'contacts', q, limit: String(limit), offset: String(offset) });
}

export function fetchWhatsAppCrmHistory(contact) {
  return crmRequest({
    mode: 'history',
    contact_id: contact?.contact_id || '',
    phone: contact?.phone_digits || '',
  });
}
