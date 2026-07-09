import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Lock, ShieldCheck, X, Zap } from 'lucide-react';
import { cartSnapshot, emitSignal, setKnownLead } from '../lib/leadSignals';

// Extraído do App.jsx (verbatim) — recebe estado/handlers do App por props.
const LeadModalOverlay = ({
  cart,
  checkoutOrderNumber,
  checkoutSuccess,
  currentLead,
  handleFinalize,
  isLoading,
  setCheckoutSuccess,
  setCurrentLead,
  setShowLeadModal,
  showLeadModal,
  showToast,
  viewportOverlayStyle,
  whatsappLink,
}) => (
<AnimatePresence>
      {showLeadModal && (
        <motion.div
          key="lead-modal"
          className="fixed inset-x-0 z-[200] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6 overflow-hidden"
          style={viewportOverlayStyle}
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
            className="bg-zinc-950 w-full max-w-sm rounded-[32px] p-8 space-y-6 shadow-2xl border border-white/10 relative overflow-hidden">
            <button onClick={() => { setShowLeadModal(false); setCheckoutSuccess(false); }} className="absolute top-5 right-5 text-zinc-500 bg-zinc-900 p-2 rounded-full touch-manipulation"><X size={16}/></button>
            {checkoutSuccess ? (
              <div className="text-center relative z-10 space-y-2 mt-4 animate-in">
                 <div className="w-20 h-20 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/20"><CheckCircle2 size={40}/></div>
                 <h3 className="text-2xl font-black uppercase text-white tracking-tighter">Pedido Pronto!</h3>
                 <div className="inline-block bg-zinc-900 border border-white/10 rounded-xl px-4 py-2 mt-2 mb-4"><span className="text-[9px] text-zinc-500 uppercase font-black block">Código do Pedido</span><span className="text-emerald-500 font-black text-xl tracking-widest">#{checkoutOrderNumber}</span></div>
                 <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest px-2 mb-6 text-center">Agora, envie no WhatsApp para validarmos seu envio e combinarmos o frete.</p>
                 <button
                   type="button"
                   onClick={() => {
                     if (!whatsappLink) { showToast('Cadastre um número de WhatsApp válido no Master Control.', 'error'); return; }
                     window.open(whatsappLink, '_blank');
                   }}
                   className="w-full py-5 mt-4 bg-emerald-500 text-zinc-950 rounded-xl font-black text-[11px] uppercase tracking-widest active:scale-95 flex justify-center items-center gap-2 touch-manipulation"
                 >Enviar WhatsApp <Zap size={14}/></button>
                 <button
                   type="button"
                   onClick={() => { setShowLeadModal(false); setCheckoutSuccess(false); }}
                   className="w-full py-3 mt-2 text-zinc-500 hover:text-white font-black text-[10px] uppercase tracking-widest transition-colors"
                 >Fechar</button>
               </div>
             ) : (
               <div className="animate-in">
                 <div className="text-center relative z-10 space-y-2 mt-4">
                   <div className="w-16 h-16 bg-white text-zinc-950 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl"><ShieldCheck size={30}/></div>
                   <h3 className="text-2xl font-black uppercase text-white tracking-tighter">Dados de Entrega</h3>
                   <p className="text-zinc-400 text-[10px] font-bold uppercase">Preencha os dados para concluir seu pedido.</p>
                 </div>
                 <div className="space-y-4 relative z-10 text-left pt-6">
                   <div className="space-y-1"><label className="text-[9px] font-black uppercase text-zinc-500 px-2 tracking-widest">Nome Completo</label><input placeholder="Ex: João da Silva" className="w-full p-4 bg-zinc-900 border border-white/5 rounded-xl text-[16px] font-bold text-white outline-none focus:border-white/30 shadow-inner client-input" value={currentLead.name} onChange={e => setCurrentLead({...currentLead, name: e.target.value})} /></div>
                   <div className="space-y-1"><label className="text-[9px] font-black uppercase text-zinc-500 px-2 tracking-widest">WhatsApp (Com DDD)</label><input placeholder="Ex: 34999999999" type="tel" className="w-full p-4 bg-zinc-900 border border-white/5 rounded-xl text-[16px] font-bold text-white outline-none focus:border-white/30 shadow-inner client-input" value={currentLead.phone} onChange={e => {
                     const ph = e.target.value.replace(/\D/g, '');
                     setCurrentLead({ ...currentLead, phone: ph });
                     // Capturou contato: identifica o lead e liga todo o histórico anônimo ao telefone
                     if (ph.length >= 10) { setKnownLead(ph, currentLead.name); emitSignal('telefone_informado', { phone: ph, name: currentLead.name, cart: cartSnapshot(cart) }); }
                   }} /></div>
                 <button onClick={handleFinalize} disabled={isLoading} className="w-full py-5 bg-emerald-500 text-zinc-950 rounded-xl font-black text-[11px] uppercase tracking-widest active:scale-95 mt-2 flex justify-center items-center gap-2 touch-manipulation">{isLoading ? 'Processando...' : 'Finalizar Pedido via WhatsApp'} <Zap size={14}/></button>
                </div>
                <p className="text-[8px] font-bold uppercase tracking-widest text-zinc-600 flex items-center justify-center gap-1 opacity-70 mt-6"><Lock size={10}/> Ambiente 100% Seguro</p>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
);

export default LeadModalOverlay;
