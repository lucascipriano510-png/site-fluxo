import { useMemo, useState } from 'react';
import { Barcode, Box, Clock, Database, Edit3, MessageCircle, X } from 'lucide-react';
import { createMetaEventId, dispatchCAPIPurchase, dispatchCAPIRefund } from '../lib/capi';
import { formatBRL } from '../lib/format';
import { cancelOrder, confirmOrderSale, getOrderPurchaseEventId, markOrderPurchaseSent, restoreOrderStock, updateOrderPhone, updateOrderStatus, updateOrderValue } from '../lib/orders';

const AdminLeads = ({ leads, setLeads, products, setProducts, showToast, config }) => {
  const [expandedLead, setExpandedLead] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [updatingLeadId, setUpdatingLeadId] = useState(null); // P17: trava clique repetido por pedido
  const [editingPhoneId, setEditingPhoneId] = useState(null);
  const [editingPhoneValue, setEditingPhoneValue] = useState('');
  const [editingValueId, setEditingValueId] = useState(null);
  const [editingValueText, setEditingValueText] = useState('');
  // Filtro: 'NOVOS' = NOVO + EM ATENDIMENTO; 'CONCLUÍDOS' e 'CANCELADOS' ficam separados
  const [leadsFilter, setLeadsFilter] = useState('NOVOS');

  const openPhoneEditor = (lead) => {
    setEditingPhoneId(lead.id);
    setEditingPhoneValue(String(lead.phone || ''));
  };

  const savePhoneEdit = async () => {
    const lead = leads.find(l => l.id === editingPhoneId);
    if (!lead) { setEditingPhoneId(null); return; }
    const cleaned = editingPhoneValue.replace(/\D/g, '');
    if (cleaned.length < 10) { showToast('Telefone inválido (mín. 10 dígitos com DDD).', 'error'); return; }
    try {
      await updateOrderPhone(lead._raw?.id || lead.id, cleaned);
      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, phone: cleaned } : l));
      showToast('Telefone atualizado!');
      setEditingPhoneId(null);
    } catch (err) {
      console.log('[PHONE_EDIT_ERROR]', err);
      showToast('Erro ao atualizar telefone.', 'error');
    }
  };

  const openValueEditor = (lead) => {
    setEditingValueId(lead.id);
    setEditingValueText(String(Number(lead.value || 0).toFixed(2)).replace('.', ','));
  };

  const saveValueEdit = async () => {
    const lead = leads.find(l => l.id === editingValueId);
    if (!lead) { setEditingValueId(null); return; }
    const parsed = Number(String(editingValueText).replace(/\./g, '').replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed < 0) { showToast('Valor inválido.', 'error'); return; }
    const original = Number(lead.value || 0);
    try {
      await updateOrderValue(lead._raw?.id || lead.id, parsed);
      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, value: parsed } : l));
      const diff = parsed - original;
      const msg = diff === 0
        ? 'Valor atualizado.'
        : diff < 0
          ? `Desconto de ${formatBRL(Math.abs(diff))} aplicado.`
          : `Acréscimo de ${formatBRL(diff)} aplicado.`;
      showToast(msg);
      setEditingValueId(null);
    } catch (err) {
      console.log('[VALUE_EDIT_ERROR]', err);
      showToast('Erro ao atualizar valor.', 'error');
    }
  };

  const updateLeadStatus = async (id, newStatus) => {
    if (updatingLeadId === id) return; // P17: ignora clique repetido/rápido no mesmo pedido
    const leadToUpdate = leads.find(l => l.id === id);
    if (!leadToUpdate) return;
    const oldStatus = leadToUpdate.status || 'NOVO';
    setUpdatingLeadId(id);
    try {
      // Sistema 3.0: estoque só baixa quando admin confirma a venda (CONCLUÍDO)
      if (oldStatus !== 'CONCLUÍDO' && newStatus === 'CONCLUÍDO') {
        // monta order no formato esperado por confirmOrderSale
        const orderForSale = {
          id: leadToUpdate._raw?.id || leadToUpdate.id,
          items: (leadToUpdate.items || []).map(i => ({
            id: i.id, size: i.size, qty: i.qty || i.quantity || 1,
          })),
        };
        await confirmOrderSale(orderForSale, products);
        // Atualiza local: marca como concluído. O `value` é preservado pelo spread,
        // então o totalRevenue do Dashboard é recalculado em tempo real (useMemo).
        // A persistência no Supabase já foi feita por confirmOrderSale acima.
        setLeads(prev => prev.map(l => l.id === id ? { ...l, status: 'CONCLUÍDO' } : l));
        // Atualiza products local pra refletir baixa imediata (polling vai re-sincronizar)
        const updatedProducts = products.map(p => {
          const itemsForP = (orderForSale.items || []).filter(it => it.id === p.id);
          if (itemsForP.length === 0) return p;
          const totalQty = itemsForP.reduce((a, c) => a + Number(c.qty || 0), 0);
          const newSizes = (p.sizes || []).map(s => {
            const sName = typeof s === 'string' ? s : (s.size || 'U');
            const sStock = typeof s === 'string' ? (p.stock || 0) : (s.stock || 0);
            const dec = itemsForP.filter(i => i.size === sName).reduce((a, c) => a + Number(c.qty || 0), 0);
            return { size: sName, stock: Math.max(0, sStock - dec) };
          });
          return { ...p, sizes: newSizes, stock: Math.max(0, (p.stock || 0) - totalQty), sales: (p.sales || 0) + totalQty };
        });
        setProducts(updatedProducts);
        showToast('Venda confirmada e estoque atualizado!');
        // 🔴 P17: Purchase idempotente — a trava vive no BANCO (orders.meta_purchase_event_id),
        // não no status em memória. Relê o pedido: se já tem event_id, NÃO dispara de novo
        // (cobre clique repetido e CANCELADO→CONCLUÍDO). Só grava a trava se a Meta aceitar.
        const purchaseOrderId = leadToUpdate._raw?.id || leadToUpdate.id;
        try {
          const alreadySent = await getOrderPurchaseEventId(purchaseOrderId);
          if (!alreadySent) {
            const purchaseEventId = createMetaEventId();
            const res = await dispatchCAPIPurchase({
              phone: leadToUpdate.phone,
              value: leadToUpdate.value,
              name: leadToUpdate.name,
              event_id: purchaseEventId,
            });
            if (res?.ok) await markOrderPurchaseSent(purchaseOrderId, purchaseEventId);
          }
        } catch (capiErr) {
          console.warn('[CAPI_PURCHASE]', capiErr?.message || capiErr);
        }
      } else if (newStatus === 'CANCELADO') {
        await cancelOrder(leadToUpdate._raw?.id || leadToUpdate.id);

        // 🔄 Devolve estoque SOMENTE se a venda já tinha sido CONCLUÍDA (estoque já baixou).
        // Em qualquer outro status anterior (NOVO, EM ATENDIMENTO) o estoque nunca foi mexido.
        if (oldStatus === 'CONCLUÍDO') {
          const orderForRestore = {
            id: leadToUpdate._raw?.id || leadToUpdate.id,
            items: (leadToUpdate.items || []).map(i => ({
              id: i.id, size: i.size, qty: i.qty || i.quantity || 1,
            })),
          };
          try {
            await restoreOrderStock(orderForRestore, products);
            // Reflete na UI imediatamente (polling re-sincroniza depois)
            const restoredProducts = products.map(p => {
              const itemsForP = (orderForRestore.items || []).filter(it => it.id === p.id);
              if (itemsForP.length === 0) return p;
              const totalQty = itemsForP.reduce((a, c) => a + Number(c.qty || 0), 0);
              const newSizes = (p.sizes || []).map(s => {
                const sName = typeof s === 'string' ? s : (s.size || 'U');
                const sStock = typeof s === 'string' ? (p.stock || 0) : (s.stock || 0);
                const inc = itemsForP.filter(i => i.size === sName).reduce((a, c) => a + Number(c.qty || 0), 0);
                return { size: sName, stock: sStock + inc };
              });
              return { ...p, sizes: newSizes, stock: (p.stock || 0) + totalQty, sales: Math.max(0, (p.sales || 0) - totalQty) };
            });
            setProducts(restoredProducts);
            showToast('Pedido cancelado e estoque devolvido.');
          } catch (restoreErr) {
            console.log('[STOCK_RESTORE_ERROR]', restoreErr);
            showToast('Pedido cancelado, mas houve erro ao devolver estoque.', 'error');
          }
        } else {
          showToast('Pedido cancelado.');
        }

        setLeads(prev => prev.map(l => l.id === id ? { ...l, status: 'CANCELADO' } : l));
        // 🔴 CAPI — fire-and-forget: dispara Refund para a Meta (com Advanced Matching)
        dispatchCAPIRefund({
          phone: leadToUpdate.phone,
          value: leadToUpdate.value,
          name: leadToUpdate.name,
        }).catch(() => {});
      } else {
        // Outros status (NOVO, EM ATENDIMENTO) — persiste no Supabase
        await updateOrderStatus(leadToUpdate._raw?.id || leadToUpdate.id, newStatus);
        setLeads(prev => prev.map(l => l.id === id ? { ...l, status: newStatus } : l));
        showToast('Status atualizado.');
      }
    } catch (err) {
      console.log('[CRM_ERROR]', err); // 5. CATCH
      showToast('Erro ao atualizar status.', 'error');
    } finally {
      setIsProcessing(false); // 6. FINALLY
      setUpdatingLeadId(null);
    }
  };

  const statusColors = { 'NOVO': 'text-blue-500', 'EM ATENDIMENTO': 'text-amber-500', 'CONCLUÍDO': 'text-emerald-500', 'CANCELADO': 'text-red-500' };

  // Captura inteligente de data/hora do pedido
  const smartDate = (raw) => {
    if (!raw) return null;
    const d   = new Date(raw);
    const now  = new Date();
    const diffMs  = now - d;
    const diffMin = Math.floor(diffMs / 60000);
    const diffH   = Math.floor(diffMin / 60);
    const time    = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const today   = new Date(now); today.setHours(0,0,0,0);
    const yest    = new Date(today); yest.setDate(yest.getDate() - 1);

    if (diffMin < 1)   return { label: 'Agora mesmo',                      fresh: true  };
    if (diffMin < 60)  return { label: `Há ${diffMin}min · ${time}`,       fresh: true  };
    if (diffH   < 3)   return { label: `Há ${diffH}h · ${time}`,           fresh: false };
    if (d >= today)    return { label: `Hoje · ${time}`,                    fresh: false };
    if (d >= yest)     return { label: `Ontem · ${time}`,                   fresh: false };
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays < 7) {
      const wd = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.','');
      return { label: `${wd.charAt(0).toUpperCase()}${wd.slice(1)} · ${time}`, fresh: false };
    }
    const ds = d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
    return { label: `${ds} · ${time}`, fresh: false };
  };

  // Data completa para exibição no painel expandido
  const fullDate = (raw) => {
    if (!raw) return '—';
    return new Date(raw).toLocaleString('pt-BR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  };

  const exportCSV = () => {
    if (!leads || leads.length === 0) { showToast('Nenhum pedido para exportar.', 'error'); return; }
    const esc = (v) => {
      const s = String(v == null ? '' : v);
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g,'""')}"` : s;
    };
    const header = ['Pedido','Data','Cliente','WhatsApp','Status','Total (R$)','Itens'];
    const rows = leads.map(l => [
      l.orderNumber,
      l.date,
      l.name,
      l.phone,
      l.status || 'NOVO',
      Number(l.value || 0).toFixed(2).replace('.', ','),
      (l.items || []).map(i => `${i.quantity || i.qty || 1}x ${i.name} (${i.size || 'U'})`).join(' | '),
    ]);
    const csv = '\uFEFF' + [header, ...rows].map(r => r.map(esc).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pedidos-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('CSV exportado!');
  };

  const novosCount = (leads || []).filter(l => (l.status || 'NOVO') === 'NOVO' || l.status === 'EM ATENDIMENTO').length;
  const concluidosCount = (leads || []).filter(l => l.status === 'CONCLUÍDO').length;
  const canceladosCount = (leads || []).filter(l => l.status === 'CANCELADO').length;

  const visibleLeads = (leads || []).filter(l => {
    const st = l.status || 'NOVO';
    if (leadsFilter === 'NOVOS') return st === 'NOVO' || st === 'EM ATENDIMENTO';
    if (leadsFilter === 'CONCLUÍDOS') return st === 'CONCLUÍDO';
    if (leadsFilter === 'CANCELADOS') return st === 'CANCELADO';
    return true;
  });

  return (
    <div className="p-6 animate-in space-y-4 pb-32">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-black italic uppercase text-white tracking-widest text-lg">CRM / Clientes</h3>
        <button onClick={exportCSV} data-testid="btn-export-csv" className="px-4 py-2.5 bg-zinc-800 border border-white/5 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 active:scale-95 hover:border-emerald-500/30">
          <Database size={12} className="text-emerald-500"/> CSV
        </button>
      </div>
      <div className="grid grid-cols-3 gap-1 p-1 bg-zinc-900 rounded-2xl border border-white/5">
        <button
          type="button"
          onClick={() => setLeadsFilter('NOVOS')}
          className={`py-3 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all ${leadsFilter === 'NOVOS' ? 'bg-white text-zinc-950 shadow-lg' : 'bg-transparent text-zinc-500'}`}
        >
          Novos <span className="ml-1 opacity-70">({novosCount})</span>
        </button>
        <button
          type="button"
          onClick={() => setLeadsFilter('CONCLUÍDOS')}
          className={`py-3 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all ${leadsFilter === 'CONCLUÍDOS' ? 'bg-emerald-500 text-zinc-950 shadow-lg' : 'bg-transparent text-zinc-500'}`}
        >
          Concluídos <span className="ml-1 opacity-70">({concluidosCount})</span>
        </button>
        <button
          type="button"
          onClick={() => setLeadsFilter('CANCELADOS')}
          className={`py-3 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all ${leadsFilter === 'CANCELADOS' ? 'bg-red-500 text-zinc-950 shadow-lg' : 'bg-transparent text-zinc-500'}`}
        >
          Cancelados <span className="ml-1 opacity-70">({canceladosCount})</span>
        </button>
      </div>
      {(!visibleLeads || visibleLeads.length === 0) ? (
        <div className="text-center py-20 bg-zinc-900 rounded-[40px] border border-white/5 text-zinc-700">
          Nenhum pedido nesta aba.
        </div>
      ) : visibleLeads.map(lead => (
        <div key={lead.id} className={`bg-zinc-900 rounded-[32px] border overflow-hidden ${expandedLead === lead.id ? 'border-white/20' : 'border-white/5'}`}>
          <div className="p-6 cursor-pointer" onClick={() => setExpandedLead(expandedLead === lead.id ? null : lead.id)}>
            <div className="flex justify-between items-start mb-1.5">
              <h4 className="font-black text-white text-sm uppercase">{lead.name} <span className="text-[10px] text-zinc-600">#{lead.orderNumber}</span></h4>
              <span className={`text-[8px] font-black uppercase ${statusColors[lead.status || 'NOVO']}`}>{lead.status || 'NOVO'}</span>
            </div>
            {/* Data/hora inteligente */}
            {(() => {
              const sd = smartDate(lead._raw?.created_at);
              if (!sd) return null;
              return (
                <div className="flex items-center gap-1.5 mb-2">
                  {sd.fresh && (
                    <span className="relative flex h-1.5 w-1.5 shrink-0">
                      <span className="animate-ping absolute inset-0 rounded-full bg-blue-500 opacity-75" />
                      <span className="relative rounded-full h-1.5 w-1.5 bg-blue-500" />
                    </span>
                  )}
                  <Clock size={9} className={sd.fresh ? 'text-blue-400' : 'text-zinc-600'} />
                  <span className={`text-[10px] font-semibold ${sd.fresh ? 'text-blue-400' : 'text-zinc-500'}`}>
                    {sd.label}
                  </span>
                </div>
              );
            })()}
            <div className="flex justify-between items-center text-[11px] font-bold text-zinc-400">
              {editingPhoneId === lead.id ? (
                <div className="flex items-center gap-1.5 flex-1 mr-2" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="tel"
                    autoFocus
                    value={editingPhoneValue}
                    onChange={(e) => setEditingPhoneValue(e.target.value.replace(/\D/g, ''))}
                    placeholder="DDD + número"
                    className="flex-1 min-w-0 px-2 py-1 bg-zinc-950 border border-emerald-500/30 rounded-md text-[11px] font-bold text-white outline-none focus:border-emerald-500"
                  />
                  <button
                    onClick={savePhoneEdit}
                    className="px-2 py-1 bg-emerald-500 text-zinc-950 rounded-md text-[9px] font-black uppercase active:scale-95"
                  >OK</button>
                  <button
                    onClick={() => setEditingPhoneId(null)}
                    className="px-2 py-1 bg-zinc-800 text-zinc-400 rounded-md text-[9px] font-black uppercase active:scale-95"
                  >X</button>
                </div>
              ) : (
                <span className="flex items-center gap-1.5">
                  <span>{lead.phone}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); openPhoneEditor(lead); }}
                    className="p-1 text-zinc-500 hover:text-emerald-500 active:scale-90 transition-colors"
                    title="Editar telefone"
                  >
                    <Edit3 size={11}/>
                  </button>
                </span>
              )}
              {editingValueId === lead.id ? (
                <span className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <span className="text-emerald-500 text-[10px]">R$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    autoFocus
                    value={editingValueText}
                    onChange={(e) => setEditingValueText(e.target.value.replace(/[^0-9.,]/g, ''))}
                    className="w-20 px-2 py-1 bg-zinc-950 border border-emerald-500/30 rounded-md text-[11px] font-bold text-emerald-500 outline-none focus:border-emerald-500 text-right"
                  />
                  <button onClick={saveValueEdit} className="px-2 py-1 bg-emerald-500 text-zinc-950 rounded-md text-[9px] font-black uppercase active:scale-95">OK</button>
                  <button onClick={() => setEditingValueId(null)} className="px-2 py-1 bg-zinc-800 text-zinc-400 rounded-md text-[9px] font-black uppercase active:scale-95">X</button>
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <span className="text-emerald-500">{formatBRL(lead.value || 0)}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); openValueEditor(lead); }}
                    className="p-1 text-zinc-500 hover:text-emerald-500 active:scale-90 transition-colors"
                    title="Editar valor (desconto/acréscimo)"
                  >
                    <Edit3 size={11}/>
                  </button>
                </span>
              )}
            </div>

          </div>
          {expandedLead === lead.id && (
            <div className="bg-zinc-950/50 p-6 border-t border-white/5 animate-slide-down space-y-4">
              {/* Data e hora completas do pedido */}
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <Clock size={12} className="text-zinc-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-0.5">Pedido realizado em</p>
                  <p className="text-[11px] font-semibold text-zinc-300 capitalize">{fullDate(lead._raw?.created_at)}</p>
                </div>
              </div>
              {(lead.items || []).map((item, idx) => (
                <div key={idx} className="flex gap-4 bg-zinc-900 p-4 rounded-2xl items-center border border-white/5 shadow-inner">
                  <div className="w-16 h-20 bg-zinc-950 rounded-xl overflow-hidden shrink-0 border border-white/10 shadow-2xl">
                    <img src={item.image || 'https://images.unsplash.com/photo-1558769132-cb1fac08c04b?w=200'} className="w-full h-full object-cover" alt="Thumb" />
                  </div>
                  <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-[12px] font-black text-white uppercase truncate tracking-tight">{item.name}</span>
                      <span className="text-emerald-500 font-black text-[11px] shrink-0 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">{item.quantity || item.qty}x</span>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                      <div className="flex items-center gap-1 bg-zinc-950 px-2.5 py-1 rounded-lg border border-white/5">
                        <Barcode size={10} className="text-zinc-500"/>
                        <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">{item.sku || 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-1 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/10">
                        <Box size={10} className="text-emerald-500"/>
                        <span className="text-[9px] font-black text-emerald-500 uppercase">TAM: {item.size || 'U'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => updateLeadStatus(lead.id, 'EM ATENDIMENTO')} disabled={updatingLeadId === lead.id} className="py-3 bg-zinc-800 rounded-xl text-[9px] font-black uppercase text-white disabled:opacity-50 disabled:cursor-not-allowed">Atender</button>
                <button onClick={() => updateLeadStatus(lead.id, 'CONCLUÍDO')} disabled={updatingLeadId === lead.id} className="py-3 bg-emerald-500/10 rounded-xl text-[9px] font-black uppercase text-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed">{updatingLeadId === lead.id ? 'Processando...' : 'Concluir'}</button>
                <button onClick={() => updateLeadStatus(lead.id, 'CANCELADO')} disabled={updatingLeadId === lead.id} className="py-3 bg-red-500/10 rounded-xl text-[9px] font-black uppercase text-red-500 disabled:opacity-50 disabled:cursor-not-allowed">Cancelar</button>
                <button onClick={() => window.open(`https://api.whatsapp.com/send?phone=${lead.phone}&text=Olá ${lead.name.split(' ')[0]}!`)} className="py-3 bg-emerald-500 rounded-xl text-[9px] font-black uppercase text-zinc-950 flex items-center justify-center gap-1"><MessageCircle size={10}/> Chamar</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default AdminLeads;
