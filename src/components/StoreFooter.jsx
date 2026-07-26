import PixIcon from './PixIcon';
import { Award, Instagram, Lock, MapPin, ShieldCheck } from 'lucide-react';
import { optimizeImage } from '../lib/images';

// Extraído do App.jsx (verbatim) — recebe estado/handlers do App por props.
const StoreFooter = ({
  accountToken,
  config,
  handleSearchMyOrders,
  handleSecretDoubleTap,
  setInfoPage,
  setShowMyOrders,
}) => (
<footer className="mt-20 border-t border-white/5 pt-14 pb-10 px-6 lg:px-16 w-full" style={{ background: 'var(--flux-void)' }}>
        <div className="max-w-2xl lg:max-w-5xl mx-auto space-y-12">

          {/* Logo + tagline */}
          <div className="flex flex-col items-center text-center gap-4">
            {/* isolation:isolate: o mix-blend-screen da logo compõe só contra este
                container (bg sólido igual ao footer) e não contra a página toda —
                mix-blend "vazando" pro documento é outra causa clássica de flash
                de tela no Chrome Android durante o scroll. Visual: idêntico. */}
            <div className="h-16 w-full flex items-center justify-center relative overflow-hidden pointer-events-none" style={{ isolation: 'isolate', background: 'var(--flux-void)' }}>
              {config.logoUrl ? (
                <img src={optimizeImage(config.logoUrl, 540, 90)} alt={config.brandName} style={{ transform: `scale(${config.logoZoom || 1.5})` }} className="h-full w-auto max-w-full object-contain mix-blend-screen opacity-90 transition-transform" />
              ) : (
                <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">{config.brandName}</h2>
              )}
            </div>
            {/* Identidade seca (copy-e-voz): fato no lugar de autovalidação —
                "seleção" é a competência que a Fluxo torna visível (módulo 4). */}
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] px-4">
              Streetwear e grife masculina. Peça escolhida a dedo.
            </p>
            <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400">
              <MapPin size={11} className="text-flux-deep" />
              <span>Loja física em {config.location || 'Uberaba, MG'} · Entrega no mesmo dia</span>
            </div>
          </div>

          {/* Instagram */}
          <div className="flex justify-center">
            <a href="https://www.instagram.com/fluxooutlet034" target="_blank" rel="noopener noreferrer" className="group flex items-center gap-3 bg-white/5 border border-white/10 px-8 py-4 rounded-2xl hover:bg-white hover:text-zinc-950 transition-all active:scale-95 shadow-xl touch-manipulation">
              <Instagram size={20} />
              <span className="text-[11px] font-black uppercase tracking-widest">Siga @fluxooutlet034</span>
            </a>
          </div>

          {/* Links institucionais */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 border-t border-white/5 pt-8">
            <div className="space-y-3">
              <p className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.3em]">Institucional</p>
              <button onClick={() => setInfoPage('sobre')} className="block text-[11px] font-bold text-zinc-500 hover:text-white transition-colors uppercase tracking-wide text-left touch-manipulation">Sobre a Loja</button>
              <a href={`https://wa.me/${(config.whatsapp || '').replace(/\D/g,'')}?text=${encodeURIComponent('Oi! Vim pelo site da Fluxo.')}`} target="_blank" rel="noopener noreferrer" className="block text-[11px] font-bold text-whatsapp hover:text-whatsapp transition-colors uppercase tracking-wide">Contato</a>
            </div>
            <div className="space-y-3">
              <p className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.3em]">Ajuda</p>
              <button onClick={() => setInfoPage('trocas')} className="block text-[11px] font-bold text-zinc-500 hover:text-white transition-colors uppercase tracking-wide text-left touch-manipulation">Política de Troca</button>
              <button onClick={() => setInfoPage('privacidade')} className="block text-[11px] font-bold text-zinc-500 hover:text-white transition-colors uppercase tracking-wide text-left touch-manipulation">Privacidade</button>
              <button onClick={() => { setShowMyOrders(true); if (accountToken) setTimeout(() => handleSearchMyOrders(), 100); }} className="block text-[11px] font-bold text-zinc-500 hover:text-white transition-colors uppercase tracking-wide text-left touch-manipulation">Meus Pedidos</button>
            </div>
          </div>

          {/* Trust + pagamento */}
          <div className="bg-asphalt rounded-2xl p-6 border border-white/5 space-y-5">
            <h4 className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.3em] text-center">Checkout 100% Seguro</h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col items-center gap-2"><ShieldCheck size={20} className="text-flux-deep" /><span className="text-[7px] font-bold uppercase text-zinc-500">SSL Cripto</span></div>
              <div className="flex flex-col items-center gap-2"><Lock size={20} className="text-flux-deep" /><span className="text-[7px] font-bold uppercase text-zinc-500">Seguro</span></div>
              <div className="flex flex-col items-center gap-2"><Award size={20} className="text-flux-deep" /><span className="text-[7px] font-bold uppercase text-zinc-500">Original</span></div>
            </div>
            <div className="border-t border-white/5 pt-4">
              <p className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.3em] text-center mb-3">Formas de Pagamento</p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                {['Pix', 'Cartão', 'Dinheiro'].map(m => (
                  <span key={m} className="text-[8px] font-black uppercase text-zinc-600 bg-zinc-900 border border-white/5 px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5">
                    {m === 'Pix' && <span style={{ color: '#32BCAD', display: 'inline-flex' }}><PixIcon size={11} /></span>}
                    {m}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Copyright */}
          <div className="pt-4 text-center border-t border-white/5 text-[8px] font-black text-zinc-700 uppercase tracking-widest flex items-center justify-center gap-2 relative z-10">
            &copy; {new Date().getFullYear()} {config.brandName} &bull; DIREITOS RESERVADOS
            <button onClick={handleSecretDoubleTap} className="text-zinc-800 hover:text-flux transition-colors outline-none select-none touch-manipulation cursor-pointer"><Lock size={10}/></button>
          </div>
        </div>
      </footer>
);

export default StoreFooter;
