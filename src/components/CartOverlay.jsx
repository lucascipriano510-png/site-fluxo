import PixIcon from './PixIcon';
import { AnimatePresence, motion } from 'framer-motion';
import { Flame, Lock, MapPin, Minus, Plus, Share2, ShoppingBag, Ticket, Trash2, Truck, X, Zap } from 'lucide-react';
import { cartSnapshot, emitSignal } from '../lib/leadSignals';
import { formatBRL } from '../lib/format';
import { optimizeImage } from '../lib/images';

// Extraído do App.jsx (verbatim) — recebe estado/handlers do App por props.
const CartOverlay = ({
  aplicarCupom,
  cart,
  cupomAtivo,
  cupomDiscount,
  cupomInput,
  hasOfferInCart,
  pixDiscount,
  products,
  removerCupom,
  setCart,
  setCupomInput,
  setShowCart,
  setShowLeadModal,
  showCart,
  showToast,
  subtotal,
  totalComPix,
  viewportOverlayStyle,
}) => (
<AnimatePresence>
      {showCart && (
        <motion.div
          key="cart-overlay"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-x-0 z-[150] bg-zinc-950 overflow-y-auto" style={viewportOverlayStyle}>
          <div className="max-w-md mx-auto min-h-dvh flex flex-col bg-zinc-950 relative">
            <div className="sticky top-0 bg-zinc-950/80 backdrop-blur-xl border-b border-white/5 px-6 py-6 flex justify-between items-center h-20 z-10">
              <h2 className="text-xl font-black uppercase text-white">Sua Sacola <span className="bg-white text-zinc-950 text-[10px] px-2 py-0.5 rounded-full ml-2">{cart.length}</span></h2>
              <div className="flex items-center gap-2">
                {cart.length > 0 && (
                  <button
                    onClick={async () => {
                      // Link de sacola montada: recria esta sacola em qualquer aparelho.
                      const parts = cart.map(i => `${i.sku || i.id}:${i.size || 'U'}${i.quantity > 1 ? `:${i.quantity}` : ''}`);
                      const url = `https://www.fluxooutlet.com.br/?sacola=${parts.join(',')}`;
                      try {
                        if (navigator.share) {
                          await navigator.share({ title: 'Sua sacola — Fluxo Outlet', text: 'Montei sua sacola, é só finalizar 👇', url });
                        } else {
                          await navigator.clipboard.writeText(url);
                          showToast('Link da sacola copiado!');
                        }
                      } catch { /* cancelado pelo usuário — ignora */ }
                    }}
                    data-testid="btn-share-cart"
                    className="p-2 text-zinc-400 bg-zinc-900 rounded-full touch-manipulation"
                    aria-label="Compartilhar sacola"
                  ><Share2 size={18}/></button>
                )}
                <button onClick={() => setShowCart(false)} aria-label="Fechar sacola" className="p-2 text-zinc-400 bg-zinc-900 rounded-full touch-manipulation"><X size={18}/></button>
              </div>
            </div>
            
            <div className="flex-1 space-y-4 px-6 py-6 pb-72">
                {cart.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 opacity-50 animate-in">
                       <ShoppingBag size={48} className="mb-4 text-zinc-600"/>
                       <h3 className="font-black uppercase text-sm tracking-widest text-zinc-400">Sua sacola está vazia</h3>
                       <button onClick={() => setShowCart(false)} className="mt-6 border border-white/20 text-[10px] font-black uppercase px-6 py-3 rounded-full text-white hover:bg-white hover:text-zinc-950 transition-colors">Voltar para a loja</button>
                    </div>
                ) : (
                    cart.map(item => (
                      <div key={item.itemKey} className="bg-zinc-900/50 p-3 rounded-[24px] border border-white/5 flex gap-4 shadow-sm animate-in">
                        {/* Thumb via wsrv: sem isso o original cru (1–5 MB) desce pra um thumb de 80px */}
                        <img src={optimizeImage(item.image, 200, 80)} className="w-20 h-24 rounded-[16px] object-cover border border-white/5" alt="Item" loading="lazy" decoding="async" />
                        <div className="flex-1 flex flex-col justify-between py-1">
                          <div className="flex justify-between items-start">
                            <div className="overflow-hidden pr-2"><h4 className="font-black text-white text-[11px] uppercase truncate leading-tight">{item.name}</h4><span className="text-[9px] font-bold text-zinc-500 uppercase block mt-0.5">Tam: {item.size}</span></div>
                            <button onClick={() => setCart(cart.filter(i => i.itemKey !== item.itemKey))} aria-label="Remover peça da sacola" className="p-2 -m-2 text-zinc-500 hover:text-red-500 touch-manipulation"><Trash2 size={16}/></button>
                          </div>
                          <div className="flex justify-between items-center mt-3">
                            <span className={`font-black text-sm flex items-center gap-1.5 ${item.offer_applied ? 'text-amber-400' : 'text-emerald-500'}`}>
                              {formatBRL(item.price || 0)}
                              {item.offer_applied && <span className="text-[7px] font-black text-zinc-950 px-1.5 py-0.5 rounded bg-gradient-to-r from-amber-400 to-red-500 tracking-wide">OFERTA</span>}
                            </span>
                            <div className="flex items-center bg-zinc-950 rounded-lg border border-white/5 p-1">
                              <button onClick={() => { if(item.quantity > 1) setCart(cart.map(i => i.itemKey === item.itemKey ? {...i, quantity: i.quantity - 1} : i)) }} aria-label="Diminuir quantidade" className="text-zinc-400 p-2.5 -m-1 touch-manipulation"><Minus size={12}/></button>
                              <span className="font-black text-xs text-white w-6 text-center">{item.quantity}</span>
                              <button onClick={() => {
                                 const p = products.find(x => x.id === item.id);
                                 // Produto saiu do catálogo com item ainda na sacola: não deixa aumentar (evita crash).
                                 if (!p) { showToast('Peça indisponível no momento', 'error'); return; }
                                 const sz = (p.sizes || []).find(s => (typeof s === 'string' ? s : s.size) === item.size);
                                 const max = sz ? (typeof sz === 'string' ? p.stock : sz.stock) : p.stock;
                                 if (item.quantity < max) setCart(cart.map(i => i.itemKey === item.itemKey ? {...i, quantity: i.quantity + 1} : i));
                                 else showToast(`Estoque máximo!`, 'error');
                              }} aria-label="Aumentar quantidade" className="text-zinc-400 p-2.5 -m-1 touch-manipulation"><Plus size={12}/></button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                )}
            </div>
            {cart.length > 0 && (
              <div className="fixed bottom-0 left-0 right-0 bg-zinc-950/95 backdrop-blur-xl border-t border-white/10 px-6 py-6 max-w-md mx-auto z-50 shadow-2xl" style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}>
                {/* Cupom de desconto — campo aberto ou linha aplicada */}
                {cupomAtivo ? null : (
                  <div className="flex gap-2 mb-3">
                    <input
                      value={cupomInput}
                      onChange={e => setCupomInput(e.target.value.toUpperCase())}
                      onKeyDown={e => { if (e.key === 'Enter' && aplicarCupom(cupomInput)) setCupomInput(''); }}
                      placeholder="TEM CUPOM? DIGITA AQUI"
                      className="flex-1 min-w-0 bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-[11px] font-black uppercase tracking-widest text-white placeholder:text-zinc-500 outline-none focus:border-amber-400/50"
                      data-testid="cupom-input"
                    />
                    <button
                      onClick={() => { if (aplicarCupom(cupomInput)) setCupomInput(''); }}
                      className="px-5 rounded-xl border border-white/15 text-[10px] font-black uppercase tracking-widest text-white active:scale-95 touch-manipulation"
                      data-testid="cupom-aplicar"
                    >Aplicar</button>
                  </div>
                )}
                <div className="space-y-2 mb-4">
                   <div className="flex justify-between items-center text-[11px] font-bold uppercase text-zinc-400"><span>Subtotal</span><span>{formatBRL(subtotal)}</span></div>
                   {cupomAtivo && (
                     <div className="flex justify-between items-center text-[11px] font-bold uppercase" data-testid="cupom-linha">
                       <span className="text-amber-400 inline-flex items-center gap-1.5"><Ticket size={12} />Cupom {cupomAtivo}</span>
                       <span className="text-amber-400 inline-flex items-center gap-2">- {formatBRL(cupomDiscount)}
                         <button onClick={removerCupom} aria-label="Remover cupom" className="p-2 -m-2 text-zinc-500 hover:text-red-500 touch-manipulation"><X size={12}/></button>
                       </span>
                     </div>
                   )}
                   <div className="flex justify-between items-center text-[11px] font-bold uppercase"><span className="text-zinc-400 inline-flex items-center gap-1.5"><span style={{ color: '#32BCAD', display: 'inline-flex' }}><PixIcon size={12} /></span>Desconto Pix (5%)</span><span className="text-emerald-500">- {formatBRL(pixDiscount)}</span></div>
                   {hasOfferInCart && (
                     <div className="flex items-start gap-1.5 text-[9px] font-bold text-amber-400/90 uppercase tracking-wide leading-snug">
                       <Flame size={11} className="shrink-0 mt-px fill-amber-400 text-amber-400" />
                       <span>Itens em oferta já estão com desconto e não acumulam os 5% do Pix.</span>
                     </div>
                   )}
                   <div className="flex justify-between items-end pt-3 border-t border-white/10">
                     <div className="flex flex-col">
                       <p className="text-[12px] font-black text-white uppercase tracking-widest inline-flex items-center gap-1.5"><span style={{ color: '#32BCAD', display: 'inline-flex' }}><PixIcon size={13} /></span>Total no Pix</p>
                       <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wide">ou {formatBRL(subtotal - cupomDiscount)} em até 4x sem juros</span>
                     </div>
                     <h3 className="text-3xl font-black text-emerald-500 tracking-tighter">{formatBRL(totalComPix)}</h3>
                   </div>
                </div>
                {/* Entrega local — diferencial Uberaba */}
                <div className="flex flex-col gap-2 mb-4 p-3 rounded-2xl" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}>
                   <div className="flex items-center gap-2"><Zap size={13} className="text-emerald-500 shrink-0" /><span className="text-[10px] font-bold text-white">Entrega no mesmo dia em Uberaba</span></div>
                   <div className="flex items-center gap-2"><MapPin size={13} className="text-emerald-500 shrink-0" /><span className="text-[10px] font-bold text-zinc-300">Ou retire na loja</span></div>
                   <div className="flex items-center gap-2"><Truck size={13} className="text-zinc-500 shrink-0" /><span className="text-[10px] font-bold text-zinc-500">Outras regiões: frete combinado no WhatsApp</span></div>
                </div>
                <button onClick={() => { emitSignal('checkout_aberto', { cart: cartSnapshot(cart) }); setShowCart(false); setShowLeadModal(true); }} className="w-full py-5 rounded-2xl font-black text-[11px] uppercase bg-white text-zinc-950 active:scale-95 shadow-2xl flex items-center justify-center gap-2 touch-manipulation">Finalizar Pedido <Lock size={14}/></button>
              </div>
            )}
          </div>
        </motion.div>
      )}
      </AnimatePresence>
);

export default CartOverlay;
