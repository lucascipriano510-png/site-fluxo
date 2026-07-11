import React from 'react';

// Hero de vídeo da marca — no lugar do BannerCarousel (dono, 2026-07-11).
// Asset: public/hero-brand.mp4 (Veo 720p, 10s, 1,8 MB, sem áudio; marca d'água
// removida via delogo). Autoplay mudo em loop; quem pede motion reduzido vê só
// o poster. Pra voltar ao carrossel: restaurar <BannerCarousel/> no App.jsx.
const HeroVideo = () => {
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  return (
    <div className="relative w-full overflow-hidden bg-zinc-950 select-none">
      {reduce ? (
        <img src="/hero-poster.jpg" alt="Fluxo Outlet" className="w-full aspect-video lg:aspect-auto lg:h-[520px] object-cover" draggable={false} />
      ) : (
        <video
          src="/hero-brand.mp4"
          poster="/hero-poster.jpg"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-label="Fluxo Outlet"
          className="w-full aspect-video lg:aspect-auto lg:h-[520px] object-cover"
        />
      )}
    </div>
  );
};

export default HeroVideo;
