import { useMemo, useState } from 'react';
import { Search, X, Plus, Minus, Trash2, Check, MessageCircle } from 'lucide-react';
import { createMetaEventId, dispatchCAPIPurchase } from '../lib/capi';
import { createOrder, confirmOrderSale, markOrderPurchaseSent } from '../lib/orders';
import { formatBRL } from '../lib/format';
import { optimizeImage } from '../lib/images';

/**
 * Venda manual (WhatsApp): o dono seleciona os produtos vendidos, informa o
 * WhatsApp do cliente, e ao registrar: cria o pedido (CONCLUÍDO), baixa o estoque
 * (opcional) e dispara o MESMO Purchase pra Meta que uma compra pelo site —
 * com event_id e a trava de idempotência (P17).
 */
// Tamanhos com estoque > 0 — mesma leitura string/objeto da baixa de estoque.
// Venda manual baixa o que existe na loja: peça/tamanho esgotado fica de fora
// (diferente do card do site, onde esgotado vira "Avise-me").
const stockedSizes = (p) => (Array.isArray(p.sizes) ? p.sizes : [])
  .map((s) => ({
    size: String(typeof s === 'string' ? s : s?.size ?? '').trim() || 'U',
    stock: typeof s === 'string' ? Number(p.stock || 0) : Number(s?.stock || 0),
  }))
  .filter((e) => e.stock > 0);

export default function ManualSale({ products, setProducts, setLeads, mapOrderRow, showToast, onClose }) {
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState([]); // {key,id,name,sku,image,price,size,qty}
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [valueOverride, setValueOverride] = useState('');
  const [decrementStock, setDecrementStock] = useState(true);
  const [saving, setSaving] = useState(false);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return (products || [])
      .filter((p) => !p.is_kit && p.is_active !== false)
      .filter((p) => (Array.isArray(p.sizes) && p.sizes.length > 0 ? stockedSizes(p).length > 0 : Number(p.stock || 0) > 0))
      .filter((p) => `${p.name || ''} ${p.sku || ''} ${p.category || ''}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [products, search]);

  const addItem = (p, size) => {
    const key = `${p.id}-${size || 'U'}`;
    setPicked((prev) => {
      const ex = prev.find((i) => i.key === key);
      if (ex) return prev.map((i) => (i.key === key ? { ...i, qty: i.qty + 1 } : i));
      return [...prev, { key, id: p.id, name: p.name, sku: p.sku || '', image: p.image || '', price: Number(p.price || 0), size: size || 'U', qty: 1 }];
    });
    setSearch('');
  };
  const setQty = (key, d) => setPicked((prev) => prev.flatMap((i) => {
    if (i.key !== key) return [i];
    const q = i.qty + d;
    return q <= 0 ? [] : [{ ...i, qty: q }];
  }));
  const removeItem = (key) => setPicked((prev) => prev.filter((i) => i.key !== key));

  const computedTotal = picked.reduce((a, i) => a + i.price * i.qty, 0);
  const total = valueOverride !== '' ? (parseFloat(valueOverride) || 0) : computedTotal;
  const phoneClean = phone.replace(/\D/g, '');
  const canSubmit = picked.length > 0 && phoneClean.length >= 10 && total > 0 && !saving;

  const submit = async () => {
    if (phoneClean.length < 10) { showToast('Informe o WhatsApp do cliente com DDD (a Meta precisa pra atribuir a venda).', 'error'); return; }
    if (picked.length === 0) { showToast('Adicione ao menos um produto.', 'error'); return; }
    if (total <= 0) { showToast('Valor da venda inválido.', 'error'); return; }
    setSaving(true);
    try {
      // 1) Cria o pedido como CONCLUÍDO (venda já fechada no WhatsApp)
      const items = picked.map((i) => ({ id: i.id, name: i.name, sku: i.sku, price: i.price, size: i.size, qty: i.qty, image: i.image }));
      const order = await createOrder({
        customer: { name: name.trim() || 'Cliente WhatsApp', phone: phoneClean, orderNumber: `WA${Math.floor(10000 + Math.random() * 90000)}` },
        items,
        total,
        status: 'CONCLUÍDO',
      });

      // 2) Baixa estoque (opcional) — reusa a mesma rotina da venda do site
      if (decrementStock) {
        try {
          await confirmOrderSale({ id: order.id, items }, products);
          // Reflete no estado local
          setProducts((prev) => prev.map((p) => {
            const its = items.filter((it) => it.id === p.id);
            if (its.length === 0) return p;
            const totalQty = its.reduce((a, c) => a + Number(c.qty || 0), 0);
            const newSizes = (p.sizes || []).map((s) => {
              const sName = typeof s === 'string' ? s : (s.size || 'U');
              const sStock = typeof s === 'string' ? (p.stock || 0) : Number(s.stock || 0);
              const dec = its.filter((i) => i.size === sName).reduce((a, c) => a + Number(c.qty || 0), 0);
              return { size: sName, stock: Math.max(0, sStock - dec) };
            });
            return { ...p, sizes: newSizes, stock: Math.max(0, (p.stock || 0) - totalQty), sales: (p.sales || 0) + totalQty };
          }));
        } catch (e) { console.warn('[venda-manual] estoque:', e?.message); }
      }

      // 3) Dispara Purchase pra Meta (mesmo caminho do site) + trava idempotência
      // CATÁLOGO: itens com sku -> content_ids (liga a venda ao item do catálogo)
      const eventId = createMetaEventId();
      const res = await dispatchCAPIPurchase({
        phone: phoneClean, value: total, name: name.trim(), event_id: eventId,
        content_ids: items.map(i => String(i.sku || i.id)),
        contents: items.map(i => ({ id: String(i.sku || i.id), quantity: Number(i.qty || 1), item_price: Number(i.price || 0) })),
      });
      if (res?.ok) { try { await markOrderPurchaseSent(order.id, eventId); } catch {} }

      // 4) Mostra na lista de Pedidos na hora
      try { setLeads((prev) => [mapOrderRow(order), ...prev]); } catch {}

      showToast(res?.ok ? 'Venda registrada e enviada pra Meta!' : 'Venda registrada. (Meta: verifique o CAPI)', res?.ok ? 'success' : 'info');
      onClose();
    } catch (err) {
      console.error('[venda-manual]', err);
      showToast('Erro ao registrar venda: ' + (err?.message || ''), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-zinc-900 border border-white/10 rounded-t-[28px] sm:rounded-[28px] max-h-[92vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-2">
            <span className="grid place-items-center w-8 h-8 rounded-full bg-[#25D366]/15 text-[#25D366]"><MessageCircle size={16} /></span>
            <h3 className="font-black uppercase text-white tracking-widest text-sm">Venda manual</h3>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={20} /></button>
        </div>

        <div className="overflow-y-auto no-scrollbar p-5 space-y-4">
          {/* Cliente */}
          <div className="grid grid-cols-1 gap-2.5">
            <div className="space-y-1">
              <label className="text-[9px] font-black text-zinc-500 uppercase px-1">WhatsApp do cliente *</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="numeric" placeholder="Ex: 34 9 9999-9999 (com DDD)" className="w-full p-3.5 bg-zinc-950 border border-white/5 rounded-2xl text-sm text-white outline-none focus:border-emerald-500/50" />
              <p className="text-[9px] font-bold text-zinc-600 px-1">Obrigatório — a Meta usa o número (com hash) pra atribuir a venda ao anúncio.</p>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-zinc-500 uppercase px-1">Nome (opcional)</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do cliente" className="w-full p-3.5 bg-zinc-950 border border-white/5 rounded-2xl text-sm text-white outline-none focus:border-emerald-500/50" />
            </div>
          </div>

          {/* Busca de produtos */}
          <div className="space-y-1">
            <label className="text-[9px] font-black text-zinc-500 uppercase px-1">Produtos vendidos *</label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar produto por nome ou SKU..." className="w-full pl-11 pr-4 py-3 bg-zinc-950 border border-white/5 rounded-2xl text-sm text-white outline-none focus:border-emerald-500/40" />
            </div>
            {list.length > 0 && (
              <div className="rounded-2xl border border-white/5 divide-y divide-white/5 overflow-hidden mt-1">
                {list.map((p) => {
                  const sizes = stockedSizes(p).map((e) => e.size);
                  return (
                    <div key={p.id} className="flex items-center gap-2.5 p-2.5 bg-zinc-900">
                      <img src={optimizeImage(p.image, 80, 70)} alt="" className="w-9 h-11 rounded-lg object-cover bg-zinc-800 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-white truncate uppercase">{p.name}</p>
                        <p className="text-[10px] font-black text-zinc-400">{formatBRL(p.price || 0)}</p>
                      </div>
                      {sizes.length > 0 ? (
                        <div className="flex flex-wrap gap-1 justify-end max-w-[55%]">
                          {sizes.map((s) => (
                            <button key={s} type="button" onClick={() => addItem(p, s)} className="text-[10px] font-black uppercase px-2 py-1 rounded-md bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500 hover:text-zinc-950 transition-colors">{s}</button>
                          ))}
                        </div>
                      ) : (
                        <button type="button" onClick={() => addItem(p, 'U')} className="shrink-0 grid place-items-center w-8 h-8 rounded-lg bg-emerald-500 text-zinc-950"><Plus size={15} /></button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Itens escolhidos */}
          {picked.length > 0 && (
            <div className="rounded-2xl border border-white/5 divide-y divide-white/5 overflow-hidden">
              {picked.map((i) => (
                <div key={i.key} className="flex items-center gap-2.5 p-2.5 bg-zinc-950/40">
                  <img src={optimizeImage(i.image, 80, 70)} alt="" className="w-9 h-11 rounded-lg object-cover bg-zinc-800 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-white truncate uppercase">{i.name}</p>
                    <p className="text-[9px] font-black text-zinc-500 uppercase">Tam {i.size} · {formatBRL(i.price)}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button type="button" onClick={() => setQty(i.key, -1)} className="w-7 h-7 grid place-items-center rounded-lg bg-zinc-800 text-zinc-300"><Minus size={13} /></button>
                    <span className="text-[12px] font-black text-white w-5 text-center tabular-nums">{i.qty}</span>
                    <button type="button" onClick={() => setQty(i.key, 1)} className="w-7 h-7 grid place-items-center rounded-lg bg-zinc-800 text-zinc-300"><Plus size={13} /></button>
                    <button type="button" onClick={() => removeItem(i.key)} className="w-7 h-7 grid place-items-center rounded-lg bg-red-500/10 text-red-400 ml-0.5"><Trash2 size={13} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Total + opções */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-black text-zinc-500 uppercase">Total da venda</span>
              <span className="text-lg font-black text-emerald-400">{formatBRL(total)}</span>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-zinc-500 uppercase px-1">Ajustar valor (opcional — ex: desconto fechado no zap)</label>
              <input value={valueOverride} onChange={(e) => setValueOverride(e.target.value)} inputMode="decimal" placeholder={`Soma dos itens: ${formatBRL(computedTotal)}`} className="w-full p-3 bg-zinc-950 border border-white/5 rounded-2xl text-sm text-white outline-none focus:border-emerald-500/40" />
            </div>
            <label className="flex items-center gap-3 bg-zinc-950 p-3.5 rounded-2xl border border-white/5 cursor-pointer">
              <span className={`grid place-items-center w-5 h-5 rounded-md border-2 ${decrementStock ? 'bg-emerald-500 border-emerald-500' : 'border-white/20'}`}>{decrementStock && <Check size={13} className="text-zinc-950" strokeWidth={3} />}</span>
              <input type="checkbox" checked={decrementStock} onChange={(e) => setDecrementStock(e.target.checked)} className="hidden" />
              <span className="text-[11px] font-black uppercase text-white">Baixar do estoque</span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-white/5 shrink-0">
          <button type="button" disabled={!canSubmit} onClick={submit} className="w-full py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest text-zinc-950 bg-emerald-500 active:scale-95 transition-transform disabled:opacity-40">
            {saving ? 'Registrando...' : 'Registrar venda + enviar pra Meta'}
          </button>
        </div>
      </div>
    </div>
  );
}
