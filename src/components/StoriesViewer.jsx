import React from 'react';
import { X } from 'lucide-react';
import { buildSrcSet, optimizeImage, warmImages } from '../lib/images';
import { formatBRL } from '../lib/format';
import { isOfferLive, offerPrice } from '../lib/offers';

// ── VITRINE STORIES ──────────────────────────────────────────────────────
// Novidades em tela cheia com a linguagem que o cliente já conhece do
// Instagram: barrinhas de progresso, toque à direita avança / esquerda
// volta, SEGURAR pausa, arrastar pra baixo fecha. Aprovada pelo dono em
// 2026-07-02, construída em 2026-07-11. Auto-avanço de 5s por peça; motion
// reduzido = sem auto-avanço (só toque). Fotos usam os tamanhos q88 que o
// warm-image-cache mantém quentes.
const STORY_MS = 5000;
const HERO_WIDTHS = [640, 900, 1200, 1600];

const StoriesViewer = ({ products, startIndex = 0, onClose, onOpenProduct }) => {
  const [idx, setIdx] = React.useState(startIndex);
  const [paused, setPaused] = React.useState(false);
  const reduce = React.useMemo(() => window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches, []);
  const touchRef = React.useRef({ y: 0, t: 0 });
  const total = products.length;
  const p = products[idx];

  const next = React.useCallback(() => {
    setIdx((i) => {
      if (i >= total - 1) { onClose(); return i; }
      return i + 1;
    });
  }, [total, onClose]);
  const prev = () => setIdx((i) => Math.max(0, i - 1));

  // Aquece a PRÓXIMA foto enquanto a atual está na tela: avanço sem espera.
  React.useEffect(() => {
    const nx = products[idx + 1];
    if (nx?.image) warmImages([optimizeImage(nx.image, 900, 88), optimizeImage(nx.image, 1200, 88)]);
  }, [idx, products]);

  if (!p) return null;
  const live = isOfferLive(p);
  const price = live ? offerPrice(p) : (p.promotional_price || p.price || 0);

  return (
    <div
      className="fixed inset-0 z-[160] bg-black overscroll-contain select-none"
      style={{ touchAction: 'none' }}
      role="dialog"
      aria-label={`Drop: ${p.name}`}
      onPointerDown={(e) => { setPaused(true); touchRef.current = { y: e.clientY, t: Date.now() }; }}
      onPointerUp={(e) => {
        setPaused(false);
        const dy = e.clientY - touchRef.current.y;
        const dt = Date.now() - touchRef.current.t;
        if (dy > 70) { onClose(); return; } // arrastou pra baixo = fecha
        if (dt < 250 && Math.abs(dy) < 12) {
          if (e.clientX < window.innerWidth * 0.3) prev(); else next();
        }
      }}
    >
      {/* Fundo: LQIP da própria peça borrado (nunca preto seco) */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{ backgroundImage: `url("${optimizeImage(p.image, 40, 35)}")`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(18px)', transform: 'scale(1.1)', opacity: 0.6 }}
      />
      <img
        key={p.id}
        src={optimizeImage(p.image, 1200, 88)}
        srcSet={buildSrcSet(p.image, HERO_WIDTHS, 88)}
        sizes="100vw"
        alt={p.name}
        className="absolute inset-0 w-full h-full object-contain"
        draggable={false}
      />
      {/* Gradientes de legibilidade (topo e rodapé) */}
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/70 to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-52 bg-gradient-to-t from-black/85 to-transparent pointer-events-none" />

      {/* Barras de progresso — a da vez anima 5s; segurar pausa */}
      <div className="absolute top-0 inset-x-0 flex gap-1 px-3" style={{ paddingTop: 'calc(0.6rem + env(safe-area-inset-top))' }}>
        {products.map((s, i) => (
          <span key={s.id} className="h-[3px] flex-1 rounded-full bg-white/25 overflow-hidden">
            <span
              key={i === idx ? `run-${idx}` : `static-${i}`}
              className="block h-full bg-white rounded-full"
              style={
                i < idx ? { width: '100%' }
                : i > idx ? { width: '0%' }
                : reduce ? { width: '100%' }
                : { width: '0%', animation: `sv-progress ${STORY_MS}ms linear forwards`, animationPlayState: paused ? 'paused' : 'running' }
              }
              onAnimationEnd={i === idx ? next : undefined}
            />
          </span>
        ))}
      </div>

      {/* Fechar */}
      <button
        onClick={onClose}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        aria-label="Fechar"
        className="absolute right-3 z-10 w-9 h-9 grid place-items-center rounded-full bg-black/50 text-white border border-white/15 touch-manipulation"
        style={{ top: 'calc(1.6rem + env(safe-area-inset-top))' }}
      >
        <X size={16} />
      </button>

      {/* Rodapé: peça + preço + CTA */}
      <div className="absolute inset-x-0 bottom-0 px-6 flex flex-col gap-2.5" style={{ paddingBottom: 'calc(1.4rem + env(safe-area-inset-bottom))' }}>
        <p className="text-[9px] font-black uppercase tracking-[0.35em] text-amber-400">Drop novo</p>
        <h2 className="text-2xl font-black uppercase text-white leading-tight drop-shadow-lg">{p.name}</h2>
        <div className="flex items-center justify-between gap-4">
          <span className="text-xl font-black text-white">{formatBRL(price)}</span>
          <button
            onClick={() => onOpenProduct(p)}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            className="bg-white text-zinc-950 rounded-full px-7 py-3.5 text-[10px] font-black uppercase tracking-widest touch-manipulation active:scale-95 transition-transform"
          >
            Ver a peça
          </button>
        </div>
      </div>
    </div>
  );
};

export default StoriesViewer;
