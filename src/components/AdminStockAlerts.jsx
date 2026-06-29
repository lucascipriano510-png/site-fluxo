import { useEffect, useMemo, useState } from 'react';
import { Bell, Check, RefreshCcw, MessageCircle } from 'lucide-react';
import { fetchStockAlerts, setStockAlertNotified } from '../lib/stockAlerts';

// Aba admin: pedidos de "avise-me quando voltar". Pendentes primeiro.
// O dono marca como avisado e tem um atalho de WhatsApp pré-preenchido.
const AdminStockAlerts = ({ showToast, onPendingChange }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchStockAlerts();
      setRows(data);
      onPendingChange?.(data.filter(r => !r.notified).length);
    } catch (e) {
      showToast?.('Erro ao carregar avisos: ' + (e?.message || ''), 'error');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const pending = useMemo(() => rows.filter(r => !r.notified), [rows]);
  const done = useMemo(() => rows.filter(r => r.notified), [rows]);

  const toggle = async (row, notified) => {
    setRows(prev => prev.map(r => r.id === row.id ? { ...r, notified } : r));
    onPendingChange?.((notified ? pending.length - 1 : pending.length + 1));
    try { await setStockAlertNotified(row.id, notified); }
    catch (e) { showToast?.('Falha ao atualizar', 'error'); load(); }
  };

  const waLink = (row) => {
    const phone = String(row.phone || '').replace(/\D/g, '');
    const peca = row.product_name || 'sua peça';
    const tam = row.size ? ` (tam ${row.size})` : '';
    const msg = `Oi! Aqui é da Fluxo Outlet 🙌 A peça *${peca}*${tam} que você queria VOLTOU ao estoque! Quer garantir a sua?`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  };

  const fmtDate = (iso) => { try { return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }); } catch { return ''; } };

  const Row = ({ r }) => (
    <div className={`bg-zinc-900 p-4 rounded-2xl border flex items-center gap-3 ${r.notified ? 'border-white/5 opacity-60' : 'border-emerald-500/20'}`}>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-black uppercase text-white truncate">{r.product_name || '—'} {r.size && <span className="text-emerald-400">· {r.size}</span>}</p>
        <p className="text-[10px] text-zinc-500 font-bold">{r.sku || ''} · {r.phone} · {fmtDate(r.created_at)}</p>
      </div>
      {!r.notified && (
        <a href={waLink(r)} target="_blank" rel="noopener noreferrer" className="shrink-0 grid place-items-center w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors" aria-label="Avisar no WhatsApp"><MessageCircle size={16}/></a>
      )}
      <button onClick={() => toggle(r, !r.notified)} className={`shrink-0 grid place-items-center w-9 h-9 rounded-xl transition-colors ${r.notified ? 'bg-zinc-800 text-zinc-500 hover:text-white' : 'bg-white/10 text-white hover:bg-white/20'}`} aria-label={r.notified ? 'Reabrir' : 'Marcar avisado'}>
        {r.notified ? <RefreshCcw size={15}/> : <Check size={16}/>}
      </button>
    </div>
  );

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2"><Bell size={16} className="text-emerald-400"/> Avisos de estoque</h2>
        <button onClick={load} className="grid place-items-center w-9 h-9 rounded-xl bg-zinc-900 border border-white/10 text-zinc-400 hover:text-white"><RefreshCcw size={15}/></button>
      </div>

      {loading ? (
        <p className="text-[11px] text-zinc-600 font-black uppercase tracking-widest py-10 text-center">Carregando…</p>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 opacity-50">
          <Bell size={40} className="mx-auto mb-3 text-zinc-600"/>
          <p className="text-[11px] font-black uppercase tracking-widest text-zinc-400">Nenhum aviso ainda</p>
          <p className="text-[10px] text-zinc-600 uppercase mt-1">Quando um cliente pedir aviso num tamanho esgotado, aparece aqui.</p>
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Pendentes ({pending.length})</p>
              {pending.map(r => <Row key={r.id} r={r} />)}
            </div>
          )}
          {done.length > 0 && (
            <div className="space-y-2 pt-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Já avisados ({done.length})</p>
              {done.map(r => <Row key={r.id} r={r} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminStockAlerts;
