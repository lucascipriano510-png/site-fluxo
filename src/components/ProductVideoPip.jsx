import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { optimizeImage } from '../lib/images';

// ──────────────────────────────────────────────────────────────
// Pop-up flutuante de VÍDEO do produto (canto inferior esquerdo da página
// do produto aberto). Aparece SÓ quando o produto tem video_url (opcional).
// SEMPRE mudo (autoplay/loop/playsInline — único jeito de tocar sozinho no
// iPhone). Toque AMPLIA (continua mudo, nunca tem som); X fecha o quadradinho.
// ──────────────────────────────────────────────────────────────
const ProductVideoPip = ({ src, poster }) => {
  const [closed, setClosed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [ready, setReady] = useState(false);
  const vidRef = useRef(null);
  // Garante mudo + tenta dar play (iOS só faz autoplay se mudo + playsInline).
  useEffect(() => {
    setReady(false);
    const v = vidRef.current;
    if (v) { v.muted = true; v.play?.().catch(() => {}); }
  }, [src, expanded]);
  if (!src || closed) return null;

  // poster = imagem do produto (já existe) mostrada NA HORA enquanto o vídeo baixa.
  const posterUrl = poster ? optimizeImage(poster, 300, 72) : undefined;
  const posterStyle = posterUrl
    ? { backgroundImage: `url("${posterUrl}")`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : undefined;
  const videoEl = (cls, style) => (
    <video
      ref={vidRef}
      src={src}
      poster={posterUrl}
      muted
      loop
      autoPlay
      playsInline
      preload="auto"
      onLoadedData={() => setReady(true)}
      className={cls}
      style={{ ...style, opacity: ready ? 1 : 0, transition: 'opacity 280ms ease-out' }}
    />
  );

  if (expanded) {
    return (
      <div
        className="fixed inset-0 z-[210] flex items-center justify-center bg-black/85 backdrop-blur-sm p-6"
        onClick={() => setExpanded(false)}
        role="dialog"
        aria-label="Vídeo do produto ampliado"
      >
        <div className="relative bg-[var(--flux-void)]" style={posterStyle} onClick={(e) => e.stopPropagation()}>
          {videoEl('max-h-[82vh] max-w-[92vw] rounded-2xl shadow-2xl', { objectFit: 'contain' })}
          <button
            onClick={() => setExpanded(false)}
            aria-label="Fechar vídeo"
            className="absolute -top-3 -right-3 bg-white text-zinc-950 rounded-full w-9 h-9 flex items-center justify-center shadow-xl active:scale-90 transition-transform"
          ><X size={18} /></button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed z-[130] left-3 bottom-[106px] lg:bottom-6 w-[84px] lg:w-[132px] aspect-[3/4] rounded-xl lg:rounded-2xl overflow-hidden border border-white/15 bg-zinc-950 shadow-[0_8px_8px_rgba(0,0,0,0.42)]"
      style={{ animation: 'pipIn 0.3s ease-out', ...posterStyle }}
    >
      <style>{`@keyframes pipIn { from { opacity: 0; transform: translateY(12px) scale(0.92); } to { opacity: 1; transform: none; } }`}</style>
      <button
        onClick={() => setExpanded(true)}
        className="block w-full h-full touch-manipulation"
        aria-label="Ampliar vídeo do produto"
      >
        {videoEl('w-full h-full', { objectFit: 'cover', pointerEvents: 'none' })}
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); setClosed(true); }}
        aria-label="Fechar vídeo"
        className="absolute top-1 right-1 z-10 bg-black/60 text-white rounded-full w-5 h-5 flex items-center justify-center active:scale-90 transition-transform"
      ><X size={11} /></button>
    </div>
  );
};

export default ProductVideoPip;
