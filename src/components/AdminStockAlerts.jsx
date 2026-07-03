import { useEffect, useMemo, useState } from 'react';
import { Bell, Check, RefreshCcw, MessageCircle, Search, ChevronDown, Package, Users, Zap, List, BarChart3 } from 'lucide-react';
import { fetchStockAlerts, setStockAlertNotified, setStockAlertsNotifiedBulk } from '../lib/stockAlerts';
import { optimizeImage } from '../lib/images';

// Aba admin: central de encomendas do "Avise-me quando voltar".
// Visão DEMANDA agrupa pedidos pendentes por produto × tamanho (ranking do que
// repor na campanha); quando o tamanho volta ao estoque, o grupo acende
// "VOLTOU" — é a fila de quem avisar primeiro. Visão LISTA é o histórico.
const AdminStockAlerts = ({ showToast, onPendingChange, products = [] }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('demanda');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(null);

  const load = async () => {
    setLoading(true);
    try { setRows(await fetchStockAlerts()); }
    catch (e) { showToast?.('Erro ao carregar avisos: ' + (e?.message || ''), 'error'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);
  useEffect(() => { onPendingChange?.(rows.filter(r => !r.notified).length); }, [rows, onPendingChange]);

  const productOf = (r) => products.find(p => (r.product_id != null && p.id === r.product_id) || (r.sku && p.sku === r.sku)) || null;
  const stockOf = (product, size) => {
    if (!product || !size) return 0;
    const hit = (product.sizes || []).find(s => String(typeof s === 'string' ? s : s?.size).trim().toUpperCase() === String(size).trim().toUpperCase());
    if (!hit) return 0;
    return typeof hit === 'string' ? Number(product.stock || 0) : Number(hit.stock || 0);
  };

  const q = query.trim().toLowerCase();
  const matches = (r) => !q || [r.product_name, r.sku, r.phone, r.customer_name, r.size].some(v => String(v || '').toLowerCase().includes(q));

  const pending = useMemo(() => rows.filter(r => !r.notified && matches(r)), [rows, q]);
  const done = useMemo(() => rows.filter(r => r.notified && matches(r)), [rows, q]);

  // Pedidos pendentes cujo tamanho JÁ tem estoque de novo: fila de avisar.
  const readyCount = useMemo(() => pending.filter(r => stockOf(productOf(r), r.size) > 0).length, [pending, products]);
  const uniquePhones = useMemo(() => new Set(pending.map(r => r.phone)).size, [pending]);

  // Agrupa pendentes: produto -> tamanho -> pedidos. Ordena pelo que mais dói:
  // grupo com tamanho reposto primeiro, depois quem tem mais gente esperando.
  const groups = useMemo(() => {
    const map = new Map();
    for (const r of pending) {
      const key = r.product_id != null ? `id:${r.product_id}` : (r.sku ? `sku:${r.sku}` : `nm:${r.product_name || '?'}`);
      if (!map.has(key)) map.set(key, { key, name: r.product_name || 'Produto sem nome', sku: r.sku, product: productOf(r), sizes: new Map() });
      const g = map.get(key);
      const sz = r.size || '—';
      if (!g.sizes.has(sz)) g.sizes.set(sz, []);
      g.sizes.get(sz).push(r);
    }
    return [...map.values()].map(g => {
      const sizeRows = [...g.sizes.entries()].map(([size, reqs]) => ({ size, reqs, stockNow: stockOf(g.product, size) }));
      sizeRows.sort((a, b) => (b.stockNow > 0 ? 1 : 0) - (a.stockNow > 0 ? 1 : 0) || b.reqs.length - a.reqs.length);
      const total = sizeRows.reduce((n, s) => n + s.reqs.length, 0);
      const ready = sizeRows.filter(s => s.stockNow > 0).reduce((n, s) => n + s.reqs.length, 0);
      return { ...g, sizeRows, total, ready };
    }).sort((a, b) => (b.ready > 0 ? 1 : 0) - (a.ready > 0 ? 1 : 0) || b.total - a.total);
  }, [pending, products]);

  const toggle = async (row, notified) => {
    setRows(prev => prev.map(r => r.id === row.id ? { ...r, notified } : r));
    try { await setStockAlertNotified(row.id, notified); }
    catch { showToast?.('Falha ao atualizar', 'error'); load(); }
  };

  const notifyAll = async (reqs) => {
    const ids = reqs.map(r => r.id);
    setRows(prev => prev.map(r => ids.includes(r.id) ? { ...r, notified: true } : r));
    try { await setStockAlertsNotifiedBulk(ids); showToast?.(`${ids.length} marcado(s) como avisado(s)`); }
    catch { showToast?.('Falha ao atualizar', 'error'); load(); }
  };

  const waLink = (row) => {
    const phone = String(row.phone || '').replace(/\D/g, '');
    const nome = String(row.customer_name || '').trim().split(/\s+/)[0];
    const peca = row.product_name || 'sua peça';
    const tam = row.size ? ` (tam ${row.size})` : '';
    const msg = `Oi${nome ? `, ${nome}` : ''}! Aqui é da Fluxo Outlet 🙌 A peça *${peca}*${tam} que você queria VOLTOU ao estoque! Quer garantir a sua?`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  };

  const fmtDate = (iso) => { try { return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }); } catch { return ''; } };
  const fmtPhone = (p) => { const d = String(p || '').replace(/^55/, ''); return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d; };

  // Linha de um pedido individual (usada na demanda expandida e na lista).
  const Row = ({ r, showProduct = false }) => (
    <div className={`bg-zinc-900 p-3.5 rounded-2xl border flex items-center gap-3 ${r.notified ? 'border-white/5 opacity-60' : 'border-white/10'}`}>
      <div className="flex-1 min-w-0">
        {showProduct && (
          <p className="text-[12px] font-black uppercase text-white truncate">{r.product_name || '—'} {r.size && <span className="text-emerald-400">· {r.size}</span>}</p>
        )}
        <p className={`text-[11px] font-black truncate ${showProduct ? 'text-zinc-400' : 'text-white'}`}>
          {r.customer_name ? `${r.customer_name} · ` : ''}{fmtPhone(r.phone)}
        </p>
        <p className="text-[10px] text-zinc-500 font-bold">{showProduct ? (r.sku ? `${r.sku} · ` : '') : ''}pediu em {fmtDate(r.created_at)}</p>
      </div>
      {!r.notified && (
        <a href={waLink(r)} target="_blank" rel="noopener noreferrer" className="shrink-0 grid place-items-center w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors" aria-label="Avisar no WhatsApp"><MessageCircle size={16}/></a>
      )}
      <button onClick={() => toggle(r, !r.notified)} className={`shrink-0 grid place-items-center w-9 h-9 rounded-xl transition-colors ${r.notified ? 'bg-zinc-800 text-zinc-500 hover:text-white' : 'bg-white/10 text-white hover:bg-white/20'}`} aria-label={r.notified ? 'Reabrir' : 'Marcar avisado'}>
        {r.notified ? <RefreshCcw size={15}/> : <Check size={16}/>}
      </button>
    </div>
  );

  const Kpi = ({ icon, label, value, accent }) => (
    <div className="bg-zinc-900 border border-white/5 rounded-2xl p-4 flex items-center gap-3">
      <span className={`grid place-items-center w-10 h-10 rounded-xl ${accent ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/5 text-zinc-400'}`}>{icon}</span>
      <div>
        <p className={`text-xl font-black tabular-nums leading-none ${accent && value > 0 ? 'text-emerald-400' : 'text-white'}`}>{value}</p>
        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mt-1">{label}</p>
      </div>
    </div>
  );

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2"><Bell size={16} className="text-emerald-400"/> Encomendas · Avise-me</h2>
        <button onClick={load} className="grid place-items-center w-9 h-9 rounded-xl bg-zinc-900 border border-white/10 text-zinc-400 hover:text-white"><RefreshCcw size={15}/></button>
      </div>

      {/* KPIs: o resumo da campanha em 3 números */}
      <div className="grid grid-cols-3 gap-3">
        <Kpi icon={<Bell size={17}/>} label="Pedidos pendentes" value={pending.length} />
        <Kpi icon={<Users size={17}/>} label="Clientes na fila" value={uniquePhones} />
        <Kpi icon={<Zap size={17}/>} label="Prontos p/ avisar" value={readyCount} accent />
      </div>

      {/* Busca + troca de visão */}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 bg-zinc-900 border border-white/10 rounded-2xl px-3.5">
          <Search size={14} className="text-zinc-500 shrink-0"/>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Produto, SKU, telefone, tamanho…" className="w-full py-3 bg-transparent text-[12px] font-bold text-white outline-none placeholder:text-zinc-600"/>
        </div>
        <div className="flex bg-zinc-900 border border-white/10 rounded-2xl p-1">
          {[{ k: 'demanda', icon: <BarChart3 size={14}/>, label: 'Demanda' }, { k: 'lista', icon: <List size={14}/>, label: 'Lista' }].map(t => (
            <button key={t.k} onClick={() => setView(t.k)} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wide transition-colors ${view === t.k ? 'bg-emerald-500/15 text-emerald-400' : 'text-zinc-500 hover:text-white'}`}>
              {t.icon}<span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-[11px] text-zinc-600 font-black uppercase tracking-widest py-10 text-center">Carregando…</p>
      ) : view === 'demanda' ? (
        groups.length === 0 ? (
          <div className="text-center py-16 opacity-50">
            <Bell size={40} className="mx-auto mb-3 text-zinc-600"/>
            <p className="text-[11px] font-black uppercase tracking-widest text-zinc-400">{q ? 'Nada encontrado' : 'Nenhum pedido pendente'}</p>
            <p className="text-[10px] text-zinc-600 uppercase mt-1">Quando um cliente pedir aviso num tamanho esgotado, aparece aqui.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map(g => (
              <div key={g.key} className={`bg-zinc-900 rounded-2xl border overflow-hidden ${g.ready > 0 ? 'border-emerald-500/40' : 'border-white/5'}`}>
                {/* Cabeçalho do produto */}
                <div className="p-4 flex items-center gap-3">
                  <div className="w-12 h-14 rounded-xl overflow-hidden bg-zinc-950 border border-white/5 shrink-0">
                    {g.product?.image && <img src={optimizeImage(g.product.image, 120, 75)} alt={g.name} className="w-full h-full object-cover"/>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-black uppercase text-white truncate">{g.name}</p>
                    <p className="text-[10px] text-zinc-500 font-bold">{g.sku || 'sem SKU'} · {g.total} pedido{g.total > 1 ? 's' : ''}</p>
                  </div>
                  {g.ready > 0 && (
                    <span className="shrink-0 flex items-center gap-1 bg-emerald-500 text-zinc-950 text-[9px] font-black uppercase tracking-wide px-2.5 py-1.5 rounded-full animate-pulse"><Zap size={10} className="fill-zinc-950"/> Voltou · avisar {g.ready}</span>
                  )}
                </div>

                {/* Demanda por tamanho: o número que manda na reposição */}
                <div className="px-4 pb-4 space-y-2">
                  {g.sizeRows.map(({ size, reqs, stockNow }) => {
                    const exKey = `${g.key}|${size}`;
                    const open = expanded === exKey;
                    return (
                      <div key={size} className={`rounded-xl border ${stockNow > 0 ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-white/5 bg-zinc-950/60'}`}>
                        <button onClick={() => setExpanded(open ? null : exKey)} className="w-full flex items-center gap-3 p-3 text-left">
                          <span className={`grid place-items-center min-w-[42px] h-9 px-2 rounded-lg text-[13px] font-black ${stockNow > 0 ? 'bg-emerald-500 text-zinc-950' : 'bg-zinc-900 text-white border border-white/10 line-through decoration-zinc-600'}`}>{size}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-black text-white">{reqs.length} {reqs.length > 1 ? 'clientes esperando' : 'cliente esperando'}</p>
                            <p className={`text-[10px] font-bold uppercase ${stockNow > 0 ? 'text-emerald-400' : 'text-zinc-600'}`}>{stockNow > 0 ? `Em estoque: ${stockNow} un — hora de avisar!` : 'Sem estoque'}</p>
                          </div>
                          <ChevronDown size={15} className={`text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`}/>
                        </button>
                        {open && (
                          <div className="px-3 pb-3 space-y-2">
                            {reqs.map(r => <Row key={r.id} r={r}/>)}
                            {reqs.length > 1 && (
                              <button onClick={() => notifyAll(reqs)} className="w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white/5 text-zinc-300 hover:bg-white/10 border border-white/10 flex items-center justify-center gap-1.5">
                                <Check size={13}/> Marcar os {reqs.length} como avisados
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <>
          {pending.length === 0 && done.length === 0 ? (
            <div className="text-center py-16 opacity-50">
              <Package size={40} className="mx-auto mb-3 text-zinc-600"/>
              <p className="text-[11px] font-black uppercase tracking-widest text-zinc-400">{q ? 'Nada encontrado' : 'Nenhum aviso ainda'}</p>
            </div>
          ) : (
            <>
              {pending.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Pendentes ({pending.length})</p>
                  {pending.map(r => <Row key={r.id} r={r} showProduct/>)}
                </div>
              )}
              {done.length > 0 && (
                <div className="space-y-2 pt-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Já avisados ({done.length})</p>
                  {done.map(r => <Row key={r.id} r={r} showProduct/>)}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};

export default AdminStockAlerts;
