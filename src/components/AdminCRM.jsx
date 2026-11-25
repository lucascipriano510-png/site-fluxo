import React, { useCallback, useEffect, useState } from 'react';
import { Clock, MessageCircle, Phone, RefreshCcw, Search, ShoppingBag, UserRound, ChevronLeft } from 'lucide-react';
import { fetchWhatsAppCrmContacts, fetchWhatsAppCrmHistory } from '../lib/whatsappCrm';
import ManualSale from './ManualSale';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dateTime = (value) => value ? new Date(value).toLocaleString('pt-BR') : '—';

export default function AdminCRM({ showToast, products, setProducts, setLeads, mapOrderRow }) {
  const [contacts, setContacts] = useState([]);
  const [query, setQuery] = useState('');
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [saleContact, setSaleContact] = useState(null);
  const [saleModalOpen, setSaleModalOpen] = useState(false);

  const load = useCallback(async ({ reset = false } = {}) => {
    setLoading(true);
    try {
      const nextOffset = reset ? 0 : offset;
      const data = await fetchWhatsAppCrmContacts({ q: query, limit: 50, offset: nextOffset });
      setContacts((prev) => reset ? (data.contacts || []) : [...prev, ...(data.contacts || [])]);
      setOffset(data.next_offset ?? nextOffset);
      setHasMore(Boolean(data.has_more));
    } catch (error) {
      showToast(error?.message || 'Erro ao carregar clientes do CRM.', 'error');
    } finally {
      setLoading(false);
    }
  }, [offset, query, showToast]);

  useEffect(() => {
    const timer = setTimeout(() => load({ reset: true }), 250);
    return () => clearTimeout(timer);
  }, [query]);

  const openContact = async (contact) => {
    setSelected(contact);
    setHistory(null);
    setHistoryLoading(true);
    try {
      setHistory(await fetchWhatsAppCrmHistory(contact));
    } catch (error) {
      showToast(error?.message || 'Erro ao carregar histórico.', 'error');
    } finally {
      setHistoryLoading(false);
    }
  };

  const afterSale = () => {
    setSaleModalOpen(false);
    setSaleContact(null);
    setSelected(null);
    setHistory(null);
    load({ reset: true });
  };

  return (
    <section className="p-5 sm:p-6 pb-32 space-y-4 animate-in">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black italic uppercase tracking-widest text-white">CRM WhatsApp</h2>
          <p className="text-[10px] text-zinc-500 mt-1">Conversas recebidas e compras registradas separadamente.</p>
        </div>
        <button type="button" onClick={() => load({ reset: true })} className="p-2 text-zinc-400 hover:text-emerald-400" title="Atualizar"><RefreshCcw size={17} /></button>
      </header>

      {selected ? (
        <div className="space-y-4">
          <button type="button" onClick={() => { setSelected(null); setHistory(null); }} className="flex items-center gap-1 text-[10px] font-black uppercase text-zinc-400"><ChevronLeft size={15} /> Clientes</button>
          <div className="rounded-3xl border border-white/10 bg-zinc-900 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-white font-black uppercase">{selected.display_name || 'Cliente sem nome'}</h3>
                <a className="mt-2 flex items-center gap-2 text-sm text-zinc-400" href={`https://wa.me/${selected.phone_digits}`} target="_blank" rel="noreferrer"><Phone size={14} /> {selected.phone_digits}</a>
                <p className="mt-2 text-[10px] text-zinc-500">Origem: {selected.origin || 'Não identificada'} · Última compra: {dateTime(selected.last_purchase_at)} · Compras concluídas: {selected.purchase_count || 0}</p>
                <p className="mt-1 text-[10px] text-zinc-500">Frequência média: {selected.avg_days_between_purchases == null ? '—' : `${selected.avg_days_between_purchases} dias`} · Total: {BRL.format(Number(selected.total_spent || 0))}</p>
              </div>
              <button type="button" onClick={() => { setSaleContact(selected); setSaleModalOpen(true); }} className="rounded-xl bg-emerald-500 px-4 py-3 text-[9px] font-black uppercase text-zinc-950">Registrar venda WhatsApp</button>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-zinc-900 p-4">
            <h4 className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-white"><MessageCircle size={14} className="text-emerald-400" /> Conversas ({history?.messages?.length || 0})</h4>
            {historyLoading ? <p className="py-5 text-center text-xs text-zinc-500">Carregando histórico…</p> : !history?.messages?.length ? <p className="py-5 text-center text-xs text-zinc-500">Nenhuma mensagem recebida registrada.</p> : (
              <div className="max-h-[45vh] space-y-2 overflow-y-auto">
                {history.messages.map((message) => (
                  <article key={message.id} className="rounded-2xl bg-zinc-950 p-3">
                    <div className="mb-1 flex justify-between gap-2 text-[9px] text-zinc-500"><span>{message.message_type || 'mensagem'}</span><time>{dateTime(message.message_at)}</time></div>
                    <p className="whitespace-pre-wrap break-words text-xs text-zinc-200">{message.content || `[Conteúdo ${message.message_type || 'não textual'}]`}</p>
                    {message.referral?.source_type && <p className="mt-2 text-[9px] text-emerald-400">Origem: {message.referral.source_type}{message.referral.ctwa_clid ? ' · anúncio Click-to-WhatsApp' : ''}</p>}
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-white/10 bg-zinc-900 p-4">
            <h4 className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-white"><ShoppingBag size={14} className="text-emerald-400" /> Compras e pedidos ({history?.orders?.length || 0})</h4>
            {!history?.orders?.length ? <p className="py-4 text-center text-xs text-zinc-500">Nenhum pedido associado.</p> : <div className="space-y-2">{history.orders.map((order) => {
              let items = order.items;
              if (typeof items === 'string') { try { items = JSON.parse(items); } catch { items = []; } }
              return <article key={order.id} className="rounded-2xl bg-zinc-950 p-3">
                <div className="flex items-center justify-between gap-2"><strong className="text-xs text-white">Pedido #{order.order_number || order.id}</strong><span className="text-xs font-black text-emerald-400">{BRL.format(Number(order.value || 0))}</span></div>
                <p className="mt-1 text-[10px] text-zinc-500">{dateTime(order.created_at)} · {order.status || '—'} · {order.sales_channel === 'whatsapp' ? 'WhatsApp' : order.sales_channel === 'website' ? 'Site' : 'Origem não marcada'}</p>
                <p className="mt-2 text-[10px] text-zinc-300">{(Array.isArray(items) ? items : []).map((item) => `${item.name || 'Produto'} (${item.qty ?? item.quantity ?? 1}×${item.size ? `, ${item.size}` : ''})`).join(' · ') || 'Itens não disponíveis'}</p>
              </article>;
            })}</div>}
          </div>
        </div>
      ) : (
        <>
          <button type="button" onClick={() => { setSaleContact(null); setSaleModalOpen(true); }} className="w-full rounded-2xl bg-emerald-500 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-950">+ Registrar venda WhatsApp</button>
          <label className="relative block"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={15} /><input value={query} onChange={(event) => { setQuery(event.target.value); setOffset(0); }} placeholder="Buscar por nome ou telefone" className="w-full rounded-2xl border border-white/10 bg-zinc-900 py-3 pl-11 pr-4 text-sm text-white outline-none focus:border-emerald-500/40" /></label>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-zinc-900 p-3"><p className="text-[8px] uppercase text-zinc-500">Clientes</p><p className="text-lg font-black text-white">{contacts.length}{hasMore ? '+' : ''}</p></div>
            <div className="rounded-2xl bg-zinc-900 p-3"><p className="text-[8px] uppercase text-zinc-500">Conversas</p><p className="text-lg font-black text-white">{contacts.reduce((sum, item) => sum + Number(item.message_count || 0), 0)}</p></div>
            <div className="rounded-2xl bg-zinc-900 p-3"><p className="text-[8px] uppercase text-zinc-500">Pedidos</p><p className="text-lg font-black text-white">{contacts.reduce((sum, item) => sum + Number(item.order_count || 0), 0)}</p></div>
          </div>
          {loading && !contacts.length ? <p className="py-12 text-center text-xs text-zinc-500">Carregando clientes…</p> : contacts.length === 0 ? <div className="rounded-3xl border border-white/5 bg-zinc-900 py-12 text-center"><UserRound className="mx-auto mb-2 text-zinc-600" size={22} /><p className="text-xs text-zinc-500">Ainda não há clientes. Eles aparecem após uma conversa recebida ou pedido com telefone.</p></div> : <div className="space-y-2">{contacts.map((contact) => <button key={contact.contact_key} type="button" onClick={() => openContact(contact)} className="w-full rounded-2xl border border-white/5 bg-zinc-900 p-4 text-left hover:border-emerald-500/30">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-black uppercase text-white">{contact.display_name || 'Cliente sem nome'}</p><p className="mt-1 text-xs text-zinc-400">{contact.phone_digits}</p><p className="mt-2 truncate text-[10px] text-zinc-500">{contact.last_message_preview || (contact.purchase_count ? 'Cliente com compra registrada' : 'Sem mensagem disponível')} · {contact.origin || 'Origem não identificada'}</p></div><span className="shrink-0 text-right text-[9px] text-zinc-500"><span className="block font-bold text-emerald-400">{contact.purchase_count || 0} compra(s)</span><span className="mt-1 flex items-center justify-end gap-1"><Clock size={10} />{dateTime(contact.last_activity_at)}</span></span></div>
          </button>)}</div>}
          {hasMore && <button type="button" disabled={loading} onClick={() => load()} className="w-full rounded-xl border border-white/10 py-3 text-[9px] font-black uppercase text-zinc-300 disabled:opacity-50">Carregar mais</button>}
        </>
      )}

      {saleModalOpen && <ManualSale products={products} setProducts={setProducts} setLeads={setLeads} mapOrderRow={mapOrderRow} showToast={showToast} initialPhone={saleContact?.phone_digits || ''} initialName={saleContact?.display_name || ''} onClose={afterSale} />}
    </section>
  );
}
