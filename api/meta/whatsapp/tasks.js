import { getServerSupabaseConfig, requireMetaAdmin, sendJson } from '../../../server/whatsappAdmin.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REASONS = new Set(['retorno', 'pos_venda', 'recompra', 'outro']);

function restHeaders(key, prefer) {
  return { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json', 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) };
}
async function rest(base, path, key, options = {}) {
  const { prefer, ...requestOptions } = options;
  const response = await fetch(`${base.replace(/\/$/, '')}/rest/v1/${path}`, {
    ...requestOptions, headers: { ...restHeaders(key, prefer), ...requestOptions.headers }, cache: 'no-store',
  });
  const text = await response.text();
  if (!response.ok) {
    console.error('[whatsapp-crm-tasks] storage failed', { status: response.status });
    throw new Error('Não foi possível salvar as próximas ações.');
  }
  return text ? JSON.parse(text) : null;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  const admin = await requireMetaAdmin(req);
  if (!admin.ok) return sendJson(res, admin.status, { error: admin.error });
  const { url, serviceRoleKey } = getServerSupabaseConfig();
  if (!url || !serviceRoleKey) return sendJson(res, 503, { error: 'Tarefas CRM não configuradas no servidor.' });

  try {
    if (req.method === 'GET') {
      const status = String(req.query?.status || 'pending');
      if (!['pending', 'completed', 'all'].includes(status)) return sendJson(res, 400, { error: 'Filtro inválido.' });
      const limit = Math.min(100, Math.max(1, Number.parseInt(req.query?.limit, 10) || 100));
      const params = new URLSearchParams({
        select: 'id,contact_id,title,reason,note,due_at,status,created_at,completed_at,whatsapp_crm_contacts(display_name,phone_digits)',
        order: status === 'pending' ? 'due_at.asc' : 'created_at.desc', limit: String(limit),
      });
      if (status !== 'all') params.set('status', `eq.${status}`);
      if (req.query?.contact_id && UUID.test(String(req.query.contact_id))) params.set('contact_id', `eq.${req.query.contact_id}`);
      const tasks = await rest(url, `whatsapp_crm_tasks?${params}`, serviceRoleKey);
      return sendJson(res, 200, { tasks: tasks || [] });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'object' && req.body ? req.body : {};
      let contactId = String(body.contact_id || '');
      const phoneDigits = String(body.phone || '').replace(/\D/g, '');
      const title = String(body.title || '').trim();
      const reason = String(body.reason || 'retorno');
      const note = String(body.note || '').trim();
      const due = new Date(body.due_at);
      if ((!UUID.test(contactId) && (phoneDigits.length < 10 || phoneDigits.length > 15)) || title.length < 1 || title.length > 120 || !REASONS.has(reason) || note.length > 1000 || !Number.isFinite(due.getTime())) {
        return sendJson(res, 400, { error: 'Revise cliente, título, motivo, data e observação da ação.' });
      }
      if (!UUID.test(contactId)) {
        const normalized = phoneDigits.length === 10 || phoneDigits.length === 11 ? `55${phoneDigits}` : phoneDigits;
        const contacts = await rest(url, `whatsapp_crm_contacts?on_conflict=phone_digits&select=id,phone_digits`, serviceRoleKey, {
          method: 'POST', prefer: 'resolution=merge-duplicates,return=representation', body: JSON.stringify([{
            phone_digits: normalized, display_name: String(body.display_name || '').trim().slice(0, 200) || null,
          }]),
        });
        contactId = contacts?.[0]?.id || '';
      }
      if (!UUID.test(contactId)) return sendJson(res, 404, { error: 'Não foi possível associar a ação ao cliente.' });
      const rows = await rest(url, 'whatsapp_crm_tasks?select=id,contact_id,title,reason,note,due_at,status,created_at,completed_at', serviceRoleKey, {
        method: 'POST', prefer: 'return=representation', body: JSON.stringify({
          contact_id: contactId, title, reason, note: note || null, due_at: due.toISOString(), created_by: admin.user.id,
        }),
      });
      return sendJson(res, 201, { task: rows?.[0] || null });
    }

    if (req.method === 'PATCH') {
      const body = typeof req.body === 'object' && req.body ? req.body : {};
      const id = String(body.id || '');
      if (!UUID.test(id)) return sendJson(res, 400, { error: 'Ação inválida.' });
      const update = {};
      if (body.status !== undefined) {
        if (!['pending', 'completed'].includes(body.status)) return sendJson(res, 400, { error: 'Estado inválido.' });
        update.status = body.status;
        update.completed_at = body.status === 'completed' ? new Date().toISOString() : null;
      }
      if (body.title !== undefined) {
        const title = String(body.title || '').trim();
        if (title.length < 1 || title.length > 120) return sendJson(res, 400, { error: 'Título inválido.' });
        update.title = title;
      }
      if (body.reason !== undefined) {
        if (!REASONS.has(String(body.reason))) return sendJson(res, 400, { error: 'Motivo inválido.' });
        update.reason = String(body.reason);
      }
      if (body.note !== undefined) {
        const note = String(body.note || '').trim();
        if (note.length > 1000) return sendJson(res, 400, { error: 'Observação muito longa.' });
        update.note = note || null;
      }
      if (body.due_at !== undefined) {
        const due = new Date(body.due_at);
        if (!Number.isFinite(due.getTime())) return sendJson(res, 400, { error: 'Data inválida.' });
        update.due_at = due.toISOString();
      }
      if (!Object.keys(update).length) return sendJson(res, 400, { error: 'Nenhuma alteração informada.' });
      update.updated_at = new Date().toISOString();
      const rows = await rest(url, `whatsapp_crm_tasks?id=eq.${id}&select=id,contact_id,title,reason,note,due_at,status,created_at,completed_at`, serviceRoleKey, {
        method: 'PATCH', prefer: 'return=representation', body: JSON.stringify(update),
      });
      return rows?.length ? sendJson(res, 200, { task: rows[0] }) : sendJson(res, 404, { error: 'Ação não encontrada.' });
    }

    return sendJson(res, 405, { error: 'Método não permitido.' });
  } catch (error) {
    console.error('[whatsapp-crm-tasks] request failed', error?.message || error);
    return sendJson(res, 400, { error: error?.message || 'Não foi possível concluir a ação.' });
  }
}
