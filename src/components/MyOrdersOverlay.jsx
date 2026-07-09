import { AnimatePresence, motion } from 'framer-motion';
import { ClipboardList, X } from 'lucide-react';
import { formatBRL } from '../lib/format';

// Extraído do App.jsx (verbatim) — recebe estado/handlers do App por props.
const MyOrdersOverlay = ({
  accountToken,
  myOrdersResults,
  setAuthForm,
  setAuthMode,
  setDrawerTab,
  setMyOrdersPhone,
  setMyOrdersResults,
  setShowMyOrders,
  setShowUserDrawer,
  showMyOrders,
  userProfile,
  viewportOverlayStyle,
}) => (
<AnimatePresence>
      {showMyOrders && (
        <motion.div
          key="my-orders-modal"
          className="fixed inset-x-0 z-[200] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6 overflow-hidden"
          style={viewportOverlayStyle}
          data-testid="modal-my-orders"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="bg-zinc-950 w-full max-w-sm rounded-[32px] p-8 space-y-5 shadow-2xl border border-white/10 relative overflow-hidden max-h-[90vh] flex flex-col">
	            <button onClick={() => { setShowMyOrders(false); setMyOrdersResults(null); setMyOrdersPhone(''); }} className="absolute top-5 right-5 text-zinc-500 bg-zinc-900 p-2 rounded-full touch-manipulation z-10" data-testid="btn-close-my-orders"><X size={16}/></button>
	            <div className="text-center space-y-2 shrink-0">
	              <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto border border-emerald-500/20"><ClipboardList size={28}/></div>
	              <h3 className="text-2xl font-black uppercase text-white tracking-tighter">Meus Pedidos</h3>
	              <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">
	                {accountToken ? 'Pedidos da sua conta' : 'Entre na sua conta para consultar'}
	              </p>
	            </div>

	            {/* Consulta por telefone digitado MORREU: era qualquer um vendo pedido
	                de qualquer um. Agora pedidos exigem a conta com senha. */}
	            {!accountToken && (
	              <button
	                onClick={() => {
	                  setShowMyOrders(false);
	                  setDrawerTab('profile');
	                  setAuthMode(userProfile?.phone ? 'signup' : 'login');
	                  if (userProfile?.phone) setAuthForm(f => ({ ...f, name: userProfile.name || '', phone: userProfile.phone || '' }));
	                  setShowUserDrawer(true);
	                }}
	                className="w-full py-4 bg-emerald-500 text-zinc-950 rounded-xl font-black text-[11px] uppercase tracking-widest active:scale-95 touch-manipulation shrink-0"
	                data-testid="btn-my-orders-login"
	              >
	                Entrar na minha conta
	              </button>
	            )}

	            <div className="flex-1 overflow-y-auto space-y-3 -mx-2 px-2">
	              {myOrdersResults === null ? (
	                <div className="text-center py-8 text-zinc-400 text-[10px] font-bold uppercase tracking-widest">{accountToken ? 'Carregando...' : 'Seus pedidos aparecem aqui depois de entrar'}</div>
	              ) : myOrdersResults.length === 0 ? (
	                <div className="text-center py-8 text-zinc-400 text-[10px] font-bold uppercase tracking-widest">Nenhum pedido encontrado para este número</div>
	              ) : (
	                myOrdersResults.map((row) => {
	                  const its = typeof row.items === 'string' ? (() => { try { return JSON.parse(row.items); } catch { return []; } })() : (row.items || []);
	                  const st = String(row.status || 'NOVO').toUpperCase();
	                  const stMap = { 'CONFIRMED': 'CONCLUÍDO', 'CONCLUIDO': 'CONCLUÍDO', 'CANCELLED': 'CANCELADO' };
	                  const status = stMap[st] || st;
	                  const color = status === 'CONCLUÍDO' ? 'text-emerald-500 bg-emerald-500/10' : status === 'CANCELADO' ? 'text-red-500 bg-red-500/10' : status === 'EM ATENDIMENTO' ? 'text-amber-500 bg-amber-500/10' : 'text-blue-500 bg-blue-500/10';
	                  return (
	                    <div key={row.id} className="bg-zinc-900 rounded-2xl p-4 border border-white/5" data-testid={`my-order-${row.order_number}`}>
	                      <div className="flex justify-between items-center mb-2">
	                        <span className="text-[10px] font-black uppercase text-white">#{row.order_number}</span>
	                        <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-full ${color}`}>{status}</span>
	                      </div>
	                      <div className="text-[9px] text-zinc-500 font-bold uppercase mb-2">{row.created_at ? new Date(row.created_at).toLocaleString('pt-BR') : ''}</div>
	                      <div className="space-y-1">
	                        {(its || []).map((it, i) => (
	                          <div key={i} className="text-[10px] text-zinc-300 font-bold flex justify-between">
	                            <span className="truncate pr-2">{it.qty || 1}x {it.name} <span className="text-emerald-500">({it.size || 'U'})</span></span>
	                            <span className="text-zinc-500 shrink-0">{formatBRL(it.price || 0)}</span>
	                          </div>
	                        ))}
	                      </div>
	                      <div className="flex justify-between items-center pt-2 mt-2 border-t border-white/5">
	                        <span className="text-[9px] text-zinc-500 font-black uppercase">Total</span>
	                        <span className="text-[13px] font-black text-emerald-500">{formatBRL(row.value || 0)}</span>
	                      </div>
	                    </div>
	                  );
	                })
	              )}
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
);

export default MyOrdersOverlay;
