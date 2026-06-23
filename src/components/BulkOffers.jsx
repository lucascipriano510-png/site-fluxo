import { useMemo, useState } from 'react';
import { Search, Check, Flame, X } from 'lucide-react';
import { OFFER_CAMPAIGNS, CAMPAIGN_SHORT, CAMPAIGN_LABELS, isOfferLive, offerPercent, todayLocalISO, formatDayMonth } from '../lib/offers';
import { upsertProduct } from '../lib/supabase';
import { optimizeImage } from '../lib/images';
import { formatBRL } from '../lib/format';

/**
 * Aplicador de oferta em MASSA: define %, data e campanha uma vez e marca vários
 * produtos de uma vez (em vez de ir produto por produto). Sem entidade nova —
 * grava os campos de oferta direto em cada produto selecionado.
 */
export default function BulkOffers({ products, setProducts, showToast }) {
  const [discount, setDiscount] = useState('');
  const [endDate, setEndDate] = useState('');
  const [campaign, setCampaign] = useState('dia');
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('TODOS');
  const [colorFilter, setColorFilter] = useState('TODOS');
  const [selected, setSelected] = useState(() => new Set());
  const [saving, setSaving] = useState(false);

  // Opções de filtro derivadas dos produtos ativos.
  const categories = useMemo(() => {
    const set = new Set();
    (products || []).forEach((p) => { if (p.is_active !== false && p.category) set.add(p.category); });
    return Array.from(set).sort();
  }, [products]);
  const colors = useMemo(() => {
    const set = new Set();
    (products || []).forEach((p) => {
      if (p.is_active === false) return;
      if (p.color) set.add(String(p.color).toLowerCase());
      if (Array.isArray(p.secondary_colors)) p.secondary_colors.forEach((c) => { if (c) set.add(String(c).toLowerCase()); });
    });
    return Array.from(set).sort();
  }, [products]);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (products || [])
      .filter((p) => p.is_active !== false)
      .filter((p) => catFilter === 'TODOS' || (p.category || '') === catFilter)
      .filter((p) => colorFilter === 'TODOS'
        || String(p.color || '').toLowerCase() === colorFilter
        || (Array.isArray(p.secondary_colors) && p.secondary_colors.some((c) => String(c || '').toLowerCase() === colorFilter)))
      .filter((p) => !q || `${p.name || ''} ${p.sku || ''} ${p.category || ''}`.toLowerCase().includes(q))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [products, search, catFilter, colorFilter]);

  const hasFilter = !!search.trim() || catFilter !== 'TODOS' || colorFilter !== 'TODOS';
  const allFilteredSelected = list.length > 0 && list.every((p) => selected.has(p.id));
  const toggle = (id) => setSelected((prev) => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const toggleAll = () => setSelected((prev) => {
    const n = new Set(prev);
    if (allFilteredSelected) list.forEach((p) => n.delete(p.id));
    else list.forEach((p) => n.add(p.id));
    return n;
  });

  const run = async (mode) => {
    const ids = [...selected];
    if (ids.length === 0) { showToast('Selecione ao menos um produto.', 'error'); return; }
    if (mode === 'apply') {
      const pct = parseFloat(discount);
      if (!(pct > 0 && pct < 100)) { showToast('Desconto inválido (1–99%).', 'error'); return; }
      if (!endDate) { showToast('Defina a data "Válida até".', 'error'); return; }
    }
    setSaving(true);
    try {
      const updates = [];
      for (const id of ids) {
        const p = (products || []).find((x) => x.id === id);
        if (!p) continue;
        const updated = mode === 'apply'
          ? { ...p, offer_active: true, offer_discount_percent: parseFloat(discount), offer_ends_at: endDate, offer_campaign: campaign }
          : { ...p, offer_active: false };
        await upsertProduct(updated);
        updates.push(updated);
      }
      setProducts((prev) => prev.map((p) => updates.find((u) => u.id === p.id) || p));
      showToast(
        mode === 'apply'
          ? `Oferta aplicada em ${updates.length} produto(s)!`
          : `Oferta removida de ${updates.length} produto(s).`,
        'success'
      );
      setSelected(new Set());
    } catch (e) {
      showToast('Erro ao salvar: ' + (e?.message || ''), 'error');
    } finally {
      setSaving(false);
    }
  };

  const pct = parseFloat(discount);
  const validForm = pct > 0 && pct < 100 && !!endDate;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-black italic uppercase text-white tracking-widest text-lg">Ofertas em massa</h3>
        <p className="text-[11px] font-bold text-zinc-500 mt-1">Defina a oferta e marque vários produtos de uma vez.</p>
      </div>

      {/* Configuração da oferta */}
      <div className="p-[1.5px] rounded-[28px] bg-gradient-to-br from-amber-400/40 via-amber-500/10 to-red-500/30">
        <div className="bg-zinc-900 rounded-[27px] p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[9px] font-black text-zinc-500 uppercase px-1">Desconto (%)</label>
              <div className="relative">
                <input type="number" min="1" max="99" step="1" inputMode="numeric" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="Ex: 30" className="w-full p-3.5 pr-8 bg-zinc-950 border border-amber-500/20 rounded-2xl font-bold text-sm text-white outline-none focus:border-amber-400/60" />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-amber-400 font-black text-sm pointer-events-none">%</span>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-zinc-500 uppercase px-1">Válida até (incl.)</label>
              <input type="date" value={endDate} min={todayLocalISO()} onChange={(e) => setEndDate(e.target.value)} className="w-full p-3.5 bg-zinc-950 border border-amber-500/20 rounded-2xl font-bold text-sm text-white outline-none focus:border-amber-400/60 [color-scheme:dark]" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-zinc-500 uppercase px-1">Campanha (onde aparece)</label>
            <div className="grid grid-cols-3 gap-2">
              {OFFER_CAMPAIGNS.map((c) => (
                <button key={c} type="button" onClick={() => setCampaign(c)} className={`py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-wide border transition-all active:scale-95 ${campaign === c ? 'text-zinc-950 border-transparent bg-gradient-to-r from-amber-400 to-red-500' : 'text-zinc-400 border-white/10 bg-zinc-950 hover:border-amber-400/40'}`}>{CAMPAIGN_SHORT[c]}</button>
              ))}
            </div>
            <p className="text-[9px] font-bold text-zinc-600 px-1">Cai no carrossel "{CAMPAIGN_LABELS[campaign]}" da home.</p>
          </div>
        </div>
      </div>

      {/* Busca + selecionar todos */}
      <div className="space-y-2.5">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, SKU ou categoria..." className="w-full pl-11 pr-10 py-3 bg-zinc-950 border border-white/5 rounded-2xl text-sm text-white outline-none focus:border-emerald-500/40" />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500"><X size={14} /></button>}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="w-full py-2.5 px-3 bg-zinc-950 border border-white/5 rounded-2xl text-[11px] font-bold text-white outline-none focus:border-emerald-500/40 [color-scheme:dark]">
            <option value="TODOS">Toda categoria</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={colorFilter} onChange={(e) => setColorFilter(e.target.value)} className="w-full py-2.5 px-3 bg-zinc-950 border border-white/5 rounded-2xl text-[11px] font-bold text-white outline-none focus:border-emerald-500/40 [color-scheme:dark] capitalize">
            <option value="TODOS">Toda cor</option>
            {colors.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
          </select>
        </div>
        <div className="flex items-center justify-between px-1">
          <button type="button" onClick={toggleAll} className="text-[10px] font-black uppercase tracking-wide text-emerald-400">{allFilteredSelected ? 'Limpar seleção' : (hasFilter ? `Selecionar os ${list.length} filtrados` : `Selecionar todos (${list.length})`)}</button>
          <span className="text-[10px] font-black text-zinc-500 uppercase">{selected.size} selecionado(s)</span>
        </div>
      </div>

      {/* Lista de produtos */}
      <div className="max-h-[42vh] overflow-y-auto no-scrollbar rounded-2xl border border-white/5 divide-y divide-white/5">
        {list.length === 0 ? (
          <p className="text-[11px] text-zinc-600 text-center py-8">Nenhum produto encontrado.</p>
        ) : list.map((p) => {
          const isSel = selected.has(p.id);
          const live = isOfferLive(p);
          return (
            <button key={p.id} type="button" onClick={() => toggle(p.id)} className={`w-full flex items-center gap-3 p-2.5 text-left transition-colors ${isSel ? 'bg-emerald-500/10' : 'bg-zinc-900 hover:bg-zinc-800/60'}`}>
              <span className={`shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center ${isSel ? 'bg-emerald-500 border-emerald-500' : 'border-white/20'}`}>{isSel && <Check size={13} className="text-zinc-950" strokeWidth={3} />}</span>
              <img src={optimizeImage(p.image, 100, 70)} alt="" className="w-10 h-12 rounded-lg object-cover bg-zinc-800 shrink-0" loading="lazy" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-white truncate uppercase">{p.name}</p>
                <p className="text-[10px] font-black text-zinc-400">{formatBRL(p.price || 0)}</p>
              </div>
              {live && (
                <span className="shrink-0 flex items-center gap-1 text-[8px] font-black uppercase text-amber-300 bg-amber-500/15 px-2 py-1 rounded-md">
                  <Flame size={9} className="fill-amber-400 text-amber-400" /> -{offerPercent(p)}%
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Ações */}
      <div className="space-y-2.5">
        <button type="button" disabled={saving || selected.size === 0 || !validForm} onClick={() => run('apply')} className="w-full py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest text-zinc-950 bg-gradient-to-r from-amber-400 to-red-500 active:scale-95 transition-transform disabled:opacity-40">
          {saving ? 'Aplicando...' : `Aplicar oferta a ${selected.size} produto(s)`}
        </button>
        <button type="button" disabled={saving || selected.size === 0} onClick={() => run('remove')} className="w-full py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest text-red-300 bg-red-500/10 border border-red-400/20 active:scale-95 transition-transform disabled:opacity-40">
          Remover oferta dos selecionados
        </button>
        {validForm && (
          <p className="text-[9px] font-bold text-zinc-600 text-center">Oferta: <span className="text-amber-300">-{Math.round(pct)}%</span> até <span className="text-amber-300">{formatDayMonth(endDate)}</span> · {CAMPAIGN_SHORT[campaign]}</p>
        )}
      </div>
    </div>
  );
}
