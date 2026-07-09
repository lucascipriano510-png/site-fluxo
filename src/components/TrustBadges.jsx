import { ArrowRight, Instagram, MapPin, MessageCircle, ShieldCheck, Zap } from 'lucide-react';

// Extraído do App.jsx (verbatim) — recebe estado/handlers do App por props.
const TrustBadges = ({
  config,
}) => (
<section className="w-full px-6 lg:px-10 mt-16 lg:mt-20 lg:max-w-[1280px] lg:mx-auto">
        {/* Fundo SÓLIDO (não translúcido): alpha sobre o gradiente do brilho fazia o
            Chrome Android piscar/riscar este painel ao rolar. #202024 = mesma cor
            que o zinc-900/40 resultava sobre o fundo — visual idêntico, sem alpha. */}
        <div className="rounded-3xl border border-white/10 p-5 lg:p-7" style={{ background: '#202024' }}>
          <div className="flex items-center gap-2 mb-5">
            <ShieldCheck size={15} className="text-emerald-500 shrink-0" />
            <span className="text-[10px] lg:text-[11px] font-black uppercase tracking-[0.22em] text-white">Loja de verdade, daqui de {(config.location || 'Uberaba, MG').split(',')[0]}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-4">
            <div className="flex items-start gap-3 rounded-2xl bg-zinc-950/40 border border-white/5 p-4">
              <MapPin size={18} className="text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-black uppercase tracking-wide text-white leading-tight">Loja física</p>
                <p className="text-[10px] font-medium text-zinc-400 mt-1 leading-snug">Venha conhecer ou retire seu pedido pessoalmente em {(config.location || 'Uberaba, MG')}.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-2xl bg-zinc-950/40 border border-white/5 p-4">
              <Zap size={18} className="text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-black uppercase tracking-wide text-white leading-tight">Entrega no mesmo dia</p>
                <p className="text-[10px] font-medium text-zinc-400 mt-1 leading-snug">Recebeu hoje em {(config.location || 'Uberaba, MG').split(',')[0]}? A gente entrega hoje.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-2xl bg-zinc-950/40 border border-white/5 p-4">
              <MessageCircle size={18} className="text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-black uppercase tracking-wide text-white leading-tight">Atendimento real</p>
                <p className="text-[10px] font-medium text-zinc-400 mt-1 leading-snug">Fale com gente de verdade no WhatsApp, antes e depois da compra.</p>
              </div>
            </div>
          </div>

          {/* Prova social honesta — Instagram */}
          <a
            href="https://www.instagram.com/fluxooutlet034"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex items-center justify-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3.5 hover:bg-white hover:text-zinc-950 transition-all active:scale-[0.98] touch-manipulation group"
          >
            <Instagram size={16} className="shrink-0" />
            <span className="text-[10px] lg:text-[11px] font-black uppercase tracking-widest">Veja nossos clientes no @fluxooutlet034</span>
            <ArrowRight size={13} className="shrink-0 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-transform" />
          </a>
        </div>
      </section>
);

export default TrustBadges;
