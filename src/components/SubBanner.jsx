import React from 'react';
import { optimizeImage, buildSrcSet, markWsrvFailed } from '../lib/images';

/**
 * Sub-banner do meio da home (entre Destaques e Peças Disponíveis).
 * Faixa larga 2:1, decorativa (sem clique), otimizada via wsrv e lazy — fica
 * abaixo da dobra, então não é o LCP. onError cai pra URL original.
 */
export default function SubBanner({ banner }) {
  const [loaded, setLoaded] = React.useState(false);
  const src = banner?.image;
  if (!src) return null;

  const imgSrc = optimizeImage(src, 1280, 90);
  const imgSrcSet = buildSrcSet(src, [640, 900, 1280, 1600], 90);

  return (
    <section className="relative -mx-6 lg:mx-0 lg:rounded-3xl overflow-hidden" aria-label={banner.title || 'Destaque'}>
      <div className="relative w-full aspect-[2/1] bg-zinc-950">
        {!loaded && (
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(135deg, #1c1c1e 0%, #2c2c2e 50%, #1c1c1e 100%)',
              backgroundSize: '200% 200%',
              animation: 'bannerSkeleton 1.8s ease-in-out infinite',
            }}
          />
        )}
        <img
          src={imgSrc}
          srcSet={imgSrcSet}
          sizes="100vw"
          className={`w-full h-full object-cover transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          alt={banner.title || 'Destaque'}
          loading="lazy"
          decoding="async"
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={(e) => {
            if (!e.target.dataset.fallback) {
              e.target.dataset.fallback = '1';
              markWsrvFailed();
              e.target.src = src; // URL original sem proxy
              e.target.srcset = '';
            }
          }}
        />
      </div>
    </section>
  );
}
