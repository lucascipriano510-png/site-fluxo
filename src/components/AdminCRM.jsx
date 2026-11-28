import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, Clock, MessageCircle, Phone, Plus, RefreshCcw, Search, ShoppingBag, UserRound } from 'lucide-react';
import { createWhatsAppCrmTask, fetchWhatsAppCrmContacts, fetchWhatsAppCrmHistory, fetchWhatsAppCrmMetrics, fetchWhatsAppCrmTasks, updateWhatsAppCrmTask } from '../lib/whatsappCrm';
import ManualSale from './ManualSale';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dateTime = (value) => value ? new Date(value).toLocaleString('pt-BR') : '—';
const localInputDate = (date) => {
  const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
};
const SEGMENTS = [
  ['all', 'Todos'], ['no_purchase', 'Conversou, sem compra'], ['single_purchase', 'Uma compra'],
  ['repeat', 'Recorrentes'], ['reorder_due', 'Recompra no prazo'],
];

function timelineFor(history) {
  return [
    ...(history?.messages || []).map((item) => ({ kind: 'message', at: item.message_at, item })),
    ...(history?.site_events || []).map((item) => ({ kind: 'site', at: item.created_at, item })),
    ...(history?.orders || []).map((item) => ({ kind: 'order', at: item.created_at, item })),
  ].sort((a, b) => new Date(a.at || 0) - new Date(b.at || 0));
}

export default function AdminCRM({ showToast, products, setProducts, setLeads, mapOrderRow }) {
  const [contacts, setContacts] = useState([]);
  const [query, setQuery] = useState('');
  const [segment, setSegment] = useState('all');
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [metrics, setMetrics] = useState({ customers: 0, messages: 0, orders: 0 });
  const [tasks, setTasks] = useState([]);
  const [tab, setTab] = useState('customers');
  const [saleContact, setSaleContact] = useState(null);
  const [saleModalOpen, setSaleModalOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskReason, setTaskReason] = useState('retorno');
  const [taskNote, setTaskNote] = useState('');
  const [taskDue, setTaskDue] = useState(() => localInputDate(new Date(Date.now() + 24 * 60 * 60 * 1000)));
  const [savingTask, setSavingTask] = useState(false);

  const load = useCallback(async ({ reset = false } = {}) => {
    setLoading(true);
    try {
      const nextOffset = reset ? 0 : offset;
      const data = await fetchWhatsAppCrmContacts({ q: query, segment, limit: 50, offset: nextOffset });
      setContacts((prev) => reset ? (data.contacts || []) : [...prev, ...(data.contacts || [])]);
      setOffset(data.next_offset ?? nextOffset);
      setHasMore(Boolean(data.has_more));
    } catch (error) {
      showToast(error?.message || 'Erro ao carregar clientes do CRM.', 'error');
    } finally { setLoading(false); }
  }, [offset, query, segment, showToast]);

  const refreshOverview = useCallback(async () => {
    try {
      const [summary, taskData] = await Promise.all([fetchWhatsAppCrmMetrics(), fetchWhatsAppCrmTasks({ status: 'pending' })]);
      setMetrics(summary);
      setTasks(taskData.tasks || []);
    } catch (error) { showToast(error?.message || 'Erro ao atualizar o CRM.', 'error'); }
  }, [showToast]);

  useEffect(() => {
    const timer = setTimeout(() => { setOffset(0); load({ reset: true }); }, 220);
    return () => clearTimeout(timer);
  }, [query, segment]);
  useEffect(() => { refreshOverview(); }, []);

  const openContact = async (contact) => {
    setSelected(contact); setHistory(null); setHistoryLoading(true);
    try { setHistory(await fetchWhatsAppCrmHistory(contact)); }
    catch (error) { showToast(error?.message || 'Erro ao carregar histórico.', 'error'); }
    finally { setHistoryLoading(false); }
  };

  const afterSale = () => {
    setSaleModalOpen(false); setSaleContact(null); setSelected(null); setHistory(null);
    load({ reset: true }); refreshOverview();
  };

  const submitTask = async (event) => {
    event.preventDefault();
    if (!selected || !taskTitle.trim() || !taskDue) return;
    setSavingTask(true);
    try {
      const due = new Date(taskDue);
      await createWhatsAppCrmTask({
        contact_id: selected.contact_id || null, phone: selected.phone_digits,
        display_name: selected.display_name || '', title: taskTitle.trim(), reason: taskReason,
        note: taskNote.trim(), due_at: due.toISOString(),
      });
      setTaskTitle(''); setTaskNote('');
      setTaskDue(localInputDate(new Date(Date.now() + 24 * 60 * 60 * 1000)));
      const [nextHistory, taskData] = await Promise.all([fetchWhatsAppCrmHistory(selected), fetchWhatsAppCrmTasks({ status: 'pending' })]);
      if (nextHistory.contact) setSelected(nextHistory.contact);
      setHistory(nextHistory); setTasks(taskData.tasks || []);
      showToast('Próxima ação adicionada.');
    } catch (error) { showToast(error?.message || 'Não foi possível salvar a ação.', 'error'); }
    finally { setSavingTask(false); }
  };

  const completeTask = async (task) => {
    try {
      await updateWhatsAppCrmTask({ id: task.id, status: 'completed' });
      const data = await fetchWhatsAppCrmTasks({ status: 'pending' });
      setTasks(data.tasks || []);
      if (selected) setHistory(await fetchWhatsAppCrmHistory(selected));
      showToast('Ação concluída.');
    } catch (error) { showToast(error?.message || 'Não foi possível concluir a ação.', 'error'); }
  };

  const timeline = useMemo(() => timelineFor(history), [history]);

  return (
    <section className="p-5 sm:p-6 pb-32 space-y-4 animate-in">
      <header className="flex items-center justify-between gap-3">
        <div><h2 className="text-lg font-black italic uppercase tracking-widest text-white">CRM WhatsApp</h2><p className="mt-1 text-[10px] text-zinc-500">Clientes, conversas recebidas, vendas e próximos retornos.</p></div>
        <button type="button" onClick={() => { load({ reset: true }); refreshOverview(); }} className="p-2 text-zinc-400 hover:text-emerald-400" title="Atualizar"><RefreshCcw size={17} /></button>
      </header>

      <nav className="flex gap-2" aria-label="Seções do CRM">
        <button type="button" onClick={() => setTab('customers')} className={`rounded-xl px-4 py-2 text-[10px] font-black uppercase ${tab === 'customers' ? 'bg-emerald-500 text-zinc-950' : 'bg-zinc-900 text-zinc-400'}`}>Clientes</button>
        <button type="button" onClick={() => setTab('actions')} className={`rounded-xl px-4 py-2 text-[10px] font-black uppercase ${tab === 'actions' ? 'bg-emerald-500 text-zinc-950' : 'bg-zinc-900 text-zinc-400'}`}>Próximas ações <span className="ml-1">{tasks.length}</span></button>
      </nav>

      {tab === 'actions' ? (
        <div className="space-y-2">
          {!tasks.length ? <div className="rounded-3xl border border-white/5 bg-zinc-900 py-12 text-center"><Clock className="mx-auto mb-2 text-zinc-600" size={22} /><p className="text-xs text-zinc-500">Nenhuma ação pendente.</p></div> : tasks.map((task) => {
            const late = new Date(task.due_at) < new Date();
            const person = task.whatsapp_crm_contacts || {};
            return <article key={task.id} className="flex items-start gap-3 rounded-2xl border border-white/5 bg-zinc-900 p-4">
              <button type="button" onClick={() => completeTask(task)} className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/15 text-zinc-500 hover:border-emerald-400 hover:text-emerald-400" title="Concluir ação"><Check size={14} /></button>
              <div className="min-w-0 flex-1"><p className="text-sm font-bold text-white">{task.title}</p><p className="mt-1 text-[10px] text-zinc-400">{person.display_name || 'Cliente'} · {person.phone_digits || ''} · {task.reason.replace('_', ' ')}</p><p className={`mt-1 text-[10px] font-bold ${late ? 'text-amber-400' : 'text-zinc-500'}`}>{late ? 'Vencida · ' : 'Agendada · '}{dateTime(task.due_at)}</p>{task.note && <p className="mt-2 whitespace-pre-wrap text-[11px] text-zinc-400">{task.note}</p>}</div>
              {person.phone_digits && <a href={`https://wa.me/${person.phone_digits}`} target="_blank" rel="noreferrer" className="rounded-lg border border-emerald-500/30 px-2 py-1 text-[9px] font-black uppercase text-emerald-400">WhatsApp</a>}
            </article>;
          })}
        </div>
      ) : selected ? (
        <div className="space-y-4">
          <button type="button" onClick={() => { setSelected(null); setHistory(null); }} className="flex items-center gap-1 text-[10px] font-black uppercase text-zinc-400"><ChevronLeft size={15} /> Clientes</button>
          <div className="rounded-3xl border border-white/10 bg-zinc-900 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3"><div>
              <h3 className="font-black uppercase text-white">{selected.display_name || 'Cliente sem nome'}</h3>
              <a className="mt-2 flex items-center gap-2 text-sm text-zinc-400" href={`https://wa.me/${selected.phone_digits}`} target="_blank" rel="noreferrer"><Phone size={14} /> {selected.phone_digits}</a>
              <p className="mt-2 text-[10px] text-zinc-500">Origem: {selected.origin || 'Não identificada'} · Última compra: {dateTime(selected.last_purchase_at)} · Compras concluídas: {selected.purchase_count || 0}</p>
              <p className="mt-1 text-[10px] text-zinc-500">Frequência média: {selected.avg_days_between_purchases == null ? '—' : `${selected.avg_days_between_purchases} dias`} · Total: {BRL.format(Number(selected.total_spent || 0))}</p>
              {selected.next_repurchase_due_at && <p className="mt-1 text-[10px] text-emerald-400">Próxima recompra estimada: {dateTime(selected.next_repurchase_due_at)}</p>}
            </div><button type="button" onClick={() => { setSaleContact(selected); setSaleModalOpen(true); }} className="rounded-xl bg-emerald-500 px-4 py-3 text-[9px] font-black uppercase text-zinc-950">Registrar venda WhatsApp</button></div>
          </div>

          <form onSubmit={submitTask} className="space-y-3 rounded-3xl border border-white/10 bg-zinc-900 p-4">
            <h4 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-white"><Plus size={14} className="text-emerald-400" /> Próxima ação</h4>
            <input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} maxLength={120} required placeholder="Ex.: Retomar conversa sobre calça" className="w-full rounded-xl border border-white/10 bg-zinc-950 p-3 text-xs text-white outline-none focus:border-emerald-500/40" />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <select value={taskReason} onChange={(event) => setTaskReason(event.target.value)} className="rounded-xl border border-white/10 bg-zinc-950 p-3 text-xs text-white"><option value="retorno">Retorno</option><option value="pos_venda">Pós-venda</option><option value="recompra">Recompra</option><option value="outro">Outro</option></select>
              <input type="datetime-local" value={taskDue} onChange={(event) => setTaskDue(event.target.value)} required className="rounded-xl border border-white/10 bg-zinc-950 p-3 text-xs text-white" />
            </div>
            <textarea value={taskNote} onChange={(event) => setTaskNote(event.target.value)} maxLength={1000} rows={2} placeholder="Observação interna (opcional)" className="w-full rounded-xl border border-white/10 bg-zinc-950 p-3 text-xs text-white outline-none focus:border-emerald-500/40" />
            <button disabled={savingTask || !taskTitle.trim()} className="rounded-xl bg-emerald-500 px-4 py-3 text-[9px] font-black uppercase text-zinc-950 disabled:opacity-50">{savingTask ? 'Salvando…' : 'Salvar próxima ação'}</button>
          </form>

          <div className="rounded-3xl border border-white/10 bg-zinc-900 p-4">
            <h4 className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-white"><Clock size={14} className="text-emerald-400" /> Linha do tempo ({timeline.length})</h4>
            {historyLoading ? <p className="py-5 text-center text-xs text-zinc-500">Carregando histórico…</p> : !timeline.length ? <p className="py-5 text-center text-xs text-zinc-500">Ainda não há atividade associada a este cliente.</p> : <div className="max-h-[55vh] space-y-2 overflow-y-auto">
              {timeline.map((event) => {
                if (event.kind === 'message') {
                  const message = event.item;
                  return <article key={`m-${message.id}`} className="rounded-2xl bg-zinc-950 p-3"><div className="mb-1 flex justify-between gap-2 text-[9px] text-zinc-500"><span className="flex items-center gap-1"><MessageCircle size={11} /> Mensagem recebida · {message.message_type || 'mensagem'}</span><time>{dateTime(message.message_at)}</time></div><p className="whitespace-pre-wrap break-words text-xs text-zinc-200">{message.content || `[Conteúdo ${message.message_type || 'não textual'}]`}</p>{message.referral?.source_type && <p className="mt-2 text-[9px] text-emerald-400">Origem: {message.referral.source_type}{message.referral.ctwa_clid ? ' · anúncio Click-to-WhatsApp' : ''}</p>}</article>;
                }
                if (event.kind === 'site') {
                  const item = event.item;
                  return <article key={`s-${item.id}`} className="rounded-2xl border border-sky-500/10 bg-sky-950/20 p-3"><div className="mb-1 flex justify-between gap-2 text-[9px] text-zinc-500"><span>Atividade no site · {item.event}</span><time>{dateTime(item.created_at)}</time></div><p className="text-xs text-zinc-200">{item.product_name || item.product_sku || item.category || 'Navegação registrada'}{item.size ? ` · Tam. ${item.size}` : ''}{Number(item.qty) > 0 ? ` · ${item.qty} un.` : ''}</p></article>;
                }
                const order = event.item;
                let items = order.items;
                if (typeof items === 'string') { try { items = JSON.parse(items); } catch { items = []; } }
                return <article key={`o-${order.id}`} className="rounded-2xl border border-emerald-500/10 bg-emerald-950/20 p-3"><div className="flex items-center justify-between gap-2"><strong className="flex items-center gap-1 text-xs text-white"><ShoppingBag size={12} /> Pedido #{order.order_number || order.id}</strong><span className="text-xs font-black text-emerald-400">{BRL.format(Number(order.value || 0))}</span></div><p className="mt-1 text-[10px] text-zinc-500">{dateTime(order.created_at)} · {order.status || '—'} · {order.sales_channel === 'whatsapp' ? 'WhatsApp' : order.sales_channel === 'website' ? 'Site' : 'Origem não marcada'}</p><p className="mt-2 text-[10px] text-zinc-300">{(Array.isArray(items) ? items : []).map((item) => `${item.name || 'Produto'} (${item.qty ?? item.quantity ?? 1}×${item.size ? `, ${item.size}` : ''})`).join(' · ') || 'Itens não disponíveis'}</p></article>;
              })}
            </div>}
          </div>
          {tasks.filter((task) => task.contact_id === selected.contact_id).length > 0 && <div className="rounded-3xl border border-white/10 bg-zinc-900 p-4"><h4 className="mb-3 text-[11px] font-black uppercase text-white">Ações pendentes deste cliente</h4>{tasks.filter((task) => task.contact_id === selected.contact_id).map((task) => <div key={task.id} className="flex items-center justify-between gap-3 border-t border-white/5 py-2"><div><p className="text-xs text-white">{task.title}</p><p className="text-[9px] text-zinc-500">{dateTime(task.due_at)}</p></div><button type="button" onClick={() => completeTask(task)} className="rounded-lg border border-white/10 p-2 text-emerald-400" title="Concluir"><Check size={14} /></button></div>)}</div>}
        </div>
      ) : (
        <>
          <button type="button" onClick={() => { setSaleContact(null); setSaleModalOpen(true); }} className="w-full rounded-2xl bg-emerald-500 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-950">+ Registrar venda WhatsApp</button>
          <div className="grid grid-cols-3 gap-2"><div className="rounded-2xl bg-zinc-900 p-3"><p className="text-[8px] uppercase text-zinc-500">Clientes</p><p className="text-lg font-black text-white">{metrics.customers}</p></div><div className="rounded-2xl bg-zinc-900 p-3"><p className="text-[8px] uppercase text-zinc-500">Mensagens</p><p className="text-lg font-black text-white">{metrics.messages}</p></div><div className="rounded-2xl bg-zinc-900 p-3"><p className="text-[8px] uppercase text-zinc-500">Pedidos</p><p className="text-lg font-black text-white">{metrics.orders}</p></div></div>
          <label className="relative block"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={15} /><input value={query} onChange={(event) => { setQuery(event.target.value); setOffset(0); }} placeholder="Buscar por nome ou telefone" className="w-full rounded-2xl border border-white/10 bg-zinc-900 py-3 pl-11 pr-4 text-sm text-white outline-none focus:border-emerald-500/40" /></label>
          <select value={segment} onChange={(event) => { setSegment(event.target.value); setOffset(0); }} className="w-full rounded-2xl border border-white/10 bg-zinc-900 p-3 text-xs text-white">{SEGMENTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          {loading && !contacts.length ? <p className="py-12 text-center text-xs text-zinc-500">Carregando clientes…</p> : contacts.length === 0 ? <div className="rounded-3xl border border-white/5 bg-zinc-900 py-12 text-center"><UserRound className="mx-auto mb-2 text-zinc-600" size={22} /><p className="text-xs text-zinc-500">Nenhum cliente encontrado para este filtro.</p></div> : <div className="space-y-2">{contacts.map((contact) => <button key={contact.contact_key} type="button" onClick={() => openContact(contact)} className="w-full rounded-2xl border border-white/5 bg-zinc-900 p-4 text-left hover:border-emerald-500/30"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-black uppercase text-white">{contact.display_name || 'Cliente sem nome'}</p><p className="mt-1 text-xs text-zinc-400">{contact.phone_digits}</p><p className="mt-2 truncate text-[10px] text-zinc-500">{contact.last_message_preview || (contact.purchase_count ? 'Cliente com compra registrada' : 'Sem mensagem disponível')} · {contact.origin || 'Origem não identificada'}</p></div><span className="shrink-0 text-right text-[9px] text-zinc-500"><span className="block font-bold text-emerald-400">{contact.purchase_count || 0} compra(s)</span><span className="mt-1 flex items-center justify-end gap-1"><Clock size={10} />{dateTime(contact.last_activity_at)}</span></span></div></button>)}</div>}
          {hasMore && <button type="button" disabled={loading} onClick={() => load()} className="w-full rounded-xl border border-white/10 py-3 text-[9px] font-black uppercase text-zinc-300 disabled:opacity-50">Carregar mais</button>}
        </>
      )}

      {saleModalOpen && <ManualSale products={products} setProducts={setProducts} setLeads={setLeads} mapOrderRow={mapOrderRow} showToast={showToast} initialPhone={saleContact?.phone_digits || ''} initialName={saleContact?.display_name || ''} onClose={afterSale} />}
    </section>
  );
}
