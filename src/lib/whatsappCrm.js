import { supabase } from './supabaseClient';

async function crmRequest(path, { method = 'GET', params = {}, body } = {}) {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data?.session?.access_token;
  if (!token) throw new Error('Entre novamente na conta administrativa.');
  const query = new URLSearchParams(params);
  const queryString = query.toString();
  const response = await fetch(`${path}${queryString ? `?${queryString}` : ''}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Falha ao consultar o CRM.');
  return payload;
}

const crmPath = '/api/meta/whatsapp/crm';
const tasksPath = '/api/meta/whatsapp/tasks';
export function fetchWhatsAppCrmMetrics() { return crmRequest(crmPath, { params: { mode: 'metrics' } }); }
export function fetchWhatsAppCrmContacts({ q = '', segment = 'all', limit = 50, offset = 0 } = {}) {
  return crmRequest(crmPath, { params: { mode: 'contacts', q, segment, limit: String(limit), offset: String(offset) } });
}
export function fetchWhatsAppCrmHistory(contact) {
  return crmRequest(crmPath, { params: { mode: 'history', contact_id: contact?.contact_id || '', phone: contact?.phone_digits || '' } });
}
export function fetchWhatsAppCrmTasks({ status = 'pending', limit = 100 } = {}) {
  return crmRequest(tasksPath, { params: { status, limit: String(limit) } });
}
export function createWhatsAppCrmTask(task) { return crmRequest(tasksPath, { method: 'POST', body: task }); }
export function updateWhatsAppCrmTask(task) { return crmRequest(tasksPath, { method: 'PATCH', body: task }); }
