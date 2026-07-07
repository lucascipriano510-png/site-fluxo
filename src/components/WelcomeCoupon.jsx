// =====================================================================
// FLUXO OUTLET — Pop-up de boas-vindas com cupom (bloco do dono)
// Abre no MOBILE, na primeira visita, 1x por visitante (gatilhos no App).
//
// Copy corrigida conforme o bloco pediu ("corrige o que achar fraco/clichê"):
// - "se sentiu confortável" (vago, cara de pijama) → "uma peça caiu
//   perfeita em você" (específico: caimento, que é o produto).
// - "que você merece" e "sensação de autoconfiança" (clichê de propaganda,
//   abstrato) → "a confiança de sair sabendo que tá bem vestido" (concreto).
// - "vamos construir juntos essa amizade" (clichê corporativo) → cortado;
//   boas-vindas viram o próprio presente (cupom).
// - Regra da casa: ação escrita DENTRO do botão, cliente não adivinha.
// =====================================================================
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Ticket, X } from 'lucide-react';

export default function WelcomeCoupon({ aberto, cupom = 'NOVOFLUXO5', onFechar, onQueroCupom }) {
  return (
    <AnimatePresence>
      {aberto && (
        <motion.div
          className="fixed inset-0 z-[130] flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          data-testid="welcome-popup"
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onFechar} />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%', transition: { duration: 0.22, ease: 'easeIn' } }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="relative w-full max-w-md rounded-t-[28px] overflow-hidden border-t border-x border-white/10 px-6 pt-9 pb-7"
            style={{ background: '#131316' }}
          >
            {/* Luzes da casa: âmbar alto-esq, esmeralda alto-dir (mesma paleta
                do brilho-ambient — o pop-up é da MESMA loja, não um banner alien) */}
            <div
              aria-hidden="true"
              style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                background:
                  'radial-gradient(440px 280px at 6% 0%, rgba(245,158,11,0.14), transparent 60%),' +
                  'radial-gradient(440px 280px at 96% 6%, rgba(16,185,129,0.12), transparent 55%)',
              }}
            />
            <button
              onClick={onFechar}
              aria-label="Fechar"
              className="absolute top-4 right-4 z-10 p-2 bg-zinc-900 border border-white/10 rounded-full text-zinc-400 touch-manipulation"
            >
              <X size={15} />
            </button>

            <div className="relative z-10 flex flex-col gap-4">
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-amber-400">
                Primeira vez aqui?
              </span>

              <h2 className="text-[26px] leading-[1.12] font-black italic uppercase tracking-tight text-white">
                Quando foi a última vez que uma peça caiu <span className="text-amber-400">perfeita</span> em você?
              </h2>

              <p className="text-[12px] leading-relaxed font-medium text-zinc-400">
                É essa sensação que a Fluxo entrega: caimento certo, conforto de verdade —
                e a confiança de sair sabendo que tá bem vestido.
              </p>

              {/* Ticket do cupom */}
              <div className="rounded-2xl border-2 border-dashed border-amber-400/40 bg-amber-400/[0.06] px-5 py-4 flex items-center justify-between gap-3">
                <div className="flex flex-col">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">Seu presente de boas-vindas</span>
                  <span className="text-xl font-black tracking-[0.14em] text-amber-400" data-testid="welcome-cupom-codigo">{cupom}</span>
                </div>
                <div className="flex flex-col items-end shrink-0">
                  <span className="text-2xl font-black text-white leading-none">5%</span>
                  <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">off na 1ª compra</span>
                </div>
              </div>

              <button
                onClick={onQueroCupom}
                className="w-full py-4 min-h-[54px] rounded-2xl font-black text-[11px] uppercase tracking-widest bg-white text-zinc-950 active:scale-95 shadow-2xl flex items-center justify-center gap-2 touch-manipulation"
                data-testid="welcome-cta"
              >
                <Ticket size={15} /> Criar conta e pegar meus 5%
              </button>

              <button
                onClick={onFechar}
                className="w-full py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 touch-manipulation"
              >
                Agora não — quero ver as peças
              </button>

              <p className="text-center text-[9px] font-bold text-zinc-600 uppercase tracking-wide -mt-1">
                Cadastro leva 20 segundos · o cupom aplica direto na sacola
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
