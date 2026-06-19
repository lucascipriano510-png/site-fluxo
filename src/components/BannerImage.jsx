import React from 'react';
import { optimizeImage, buildSrcSet, markWsrvFailed } from '../lib/images';

// Banner do topo (LCP da home). Mobile 4:5 e desktop 16:9 sempre otimizados
// via wsrv.nl; onError cai pra URL original. Skeleton animado enquanto carrega.
const BannerImage = ({ src, srcDesktop, alt, active }) => {
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    setLoaded(false);
  }, [src, srcDesktop]);

  if (!src && !srcDesktop) return <div className="absolute inset-0 bg-black" />;

  // Mobile (4:5) — sempre otimizado (WebP+resize). O banner é o LCP: servir o
  // original cru (vários MB) atrasava a primeira pintura. onError volta pro original.
  const mobileBase = src || srcDesktop;
  const imgSrc = optimizeImage(mobileBase, 1280, 82);
  const imgSrcSet = buildSrcSet(mobileBase, [640, 900, 1280, 1920], 82);

  // Desktop (16:9) — imagem própria quando existe; senão cai pra mobile
  const deskBase = srcDesktop || src;
  const deskSrc = optimizeImage(deskBase, 1920, 82);
  const deskSrcSet = buildSrcSet(deskBase, [1280, 1920, 2560], 82);

  return (
    <>
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
      <picture className="block w-full h-full">
        {srcDesktop && <source media="(min-width: 1024px)" srcSet={deskSrcSet || deskSrc} sizes="100vw" />}
        <img
          src={imgSrc}
          srcSet={imgSrcSet}
          sizes="100vw"
          className={`w-full h-full object-cover transition-opacity duration-500 banner-img ${loaded ? 'opacity-100' : 'opacity-0'}`}
          style={{ objectPosition: 'center 55%' }}
          alt={alt}
          loading={active ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={active ? 'high' : 'low'}
          onLoad={() => setLoaded(true)}
          onError={(e) => {
            if (!e.target.dataset.fallback) {
              e.target.dataset.fallback = '1';
              markWsrvFailed();
              e.target.src = mobileBase; // URL original sem proxy
              e.target.srcset = '';
            }
          }}
          draggable={false}
        />
      </picture>
    </>
  );
};

export default BannerImage;
