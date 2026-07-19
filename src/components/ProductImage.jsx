import React from 'react';
import { optimizeImage, buildSrcSet, markWsrvFailed } from '../lib/images';

const ProductImage = ({ src, alt, isOutOfStock, priority = false, order = 1000, sizes: sizesProp, fixedWidth, fullRes = false }) => {
  const [loaded, setLoaded] = React.useState(false);
  const [inView, setInView] = React.useState(priority);
  const wrapperRef = React.useRef(null);

  // Carrega assim que a imagem entra PERTO do viewport (segue o scroll).
  // rootMargin generoso pré-carrega à frente da rolagem -> o cliente não se
  // depara com imagem carregando. SEM fila: o navegador (HTTP/2 + lazy nativo)
  // cuida da concorrência e já prioriza o que está na tela.
  // Reset do fade SÓ quando a FOTO troca. Resetar também no flip de `priority`
  // (produto entra/sai do top-2 a cada busca/filtro/reordenação da grade)
  // apagava imagem JÁ carregada: o <img> persiste no DOM, 'load' não dispara de
  // novo e os 2 primeiros cards ficavam no blur de carregando pra sempre.
  React.useEffect(() => { setLoaded(false); }, [src]);

  React.useEffect(() => {
    if (!src) return;
    if (priority) { setInView(true); return; }
    setInView(false);
    const el = wrapperRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setInView(true); return; }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((entry) => {
        if (entry.isIntersecting) { setInView(true); io.disconnect(); }
      }),
      { rootMargin: '2500px 0px', threshold: 0.01 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [src, priority]);

  // fullRes: serve a imagem ORIGINAL (sem wsrv/WebP) — teste de nitidez máxima no desktop.
  // fixedWidth: 1 imagem em alta via wsrv (sem srcset). Sem nenhum: modo responsivo.
  const srcSet = (fullRes || fixedWidth) ? undefined : buildSrcSet(src, [320, 480, 640, 900, 1200, 1600], 88);

  return (
    <div ref={wrapperRef} className="absolute inset-0">
      {/* LQIP blur-up: preview minúsculo (~32px, <1KB) do PRÓPRIO produto aparece
          quase instantâneo no lugar do "quadrado vazio carregando". A imagem nítida
          entra por cima e o preview some -> o cliente nunca encara espaço vazio
          esperando (efeito Netshoes). Só carrega perto do viewport (gated por inView). */}
      {(priority || inView) && !loaded && src && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute', inset: 0, zIndex: 1,
            backgroundImage: `url("${optimizeImage(src, 32, 35)}")`,
            backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
            filter: 'blur(10px)', transform: 'scale(1.04)',
          }}
        />
      )}
      {(priority || inView) && (
        <img
          // Rede de segurança do fade: se o 'load' já tiver acontecido quando o
          // elemento (re)entra no DOM (cache de memória, remontagem), destrava
          // sem depender do evento — imagem pronta nunca fica invisível.
          ref={(el) => { if (el && el.complete && el.naturalWidth > 0) setLoaded(true); }}
          src={fullRes ? src : optimizeImage(src, fixedWidth || 1000, fixedWidth ? 95 : 86)}
          srcSet={srcSet}
          sizes={(fullRes || fixedWidth) ? undefined : (sizesProp || "(min-width: 1280px) 22vw, (min-width: 1024px) 30vw, 50vw")}
          alt={alt}
          loading="eager"
          decoding="async"
          fetchPriority={priority ? 'high' : 'auto'}
          onLoad={() => setLoaded(true)}
          onError={(e) => {
            if (!e.target.dataset.fallback) {
              e.target.dataset.fallback = '1';
              markWsrvFailed();
              e.target.src = src; // URL original do Supabase sem proxy
              e.target.srcset = '';
            }
          }}
          draggable={false}
          style={{ pointerEvents: 'none' }}
          className={`w-full h-full object-contain transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'} ${isOutOfStock ? 'grayscale opacity-40' : ''}`}
        />
      )}
    </div>
  );
};

export default ProductImage;
