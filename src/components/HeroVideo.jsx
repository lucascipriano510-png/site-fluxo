import React from 'react';

// Hero de vídeo da marca — no lugar do BannerCarousel (dono, 2026-07-11).
// Asset: public/hero-brand.mp4 (Veo 720p, 10s, 1,8 MB, sem áudio; marca d'água
// removida via delogo). Autoplay mudo em loop; quem pede motion reduzido vê só
// o poster. Pra voltar ao carrossel: restaurar <BannerCarousel/> no App.jsx.
const HeroVideo = () => {
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  const mediaRef = React.useRef(null);

  React.useEffect(() => {
    const media = mediaRef.current;
    if (!media || typeof document === 'undefined') return undefined;

    const canvas = document.createElement('canvas');
    canvas.width = 12;
    canvas.height = 8;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return undefined;

    const sampleLight = () => {
      const width = media.videoWidth || media.naturalWidth || 0;
      const height = media.videoHeight || media.naturalHeight || 0;
      if (!width || !height || document.hidden) return;
      try {
        context.drawImage(media, 0, 0, canvas.width, canvas.height);
        const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
        let red = 0; let green = 0; let blue = 0; let weight = 0;
        for (let i = 0; i < data.length; i += 4) {
          const luma = (data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722) / 255;
          const w = Math.max(0.08, luma);
          red += data[i] * w; green += data[i + 1] * w; blue += data[i + 2] * w; weight += w;
        }
        const avg = [red / weight, green / weight, blue / weight];
        const neutral = (avg[0] + avg[1] + avg[2]) / 3;
        const softened = avg.map((channel) => Math.round(neutral + (channel - neutral) * 0.26));
        document.documentElement.style.setProperty('--hero-light-rgb', softened.join(' '));
      } catch {}
    };

    sampleLight();
    const timer = window.setInterval(sampleLight, 900);
    return () => {
      window.clearInterval(timer);
      document.documentElement.style.removeProperty('--hero-light-rgb');
    };
  }, []);
  return (
    <section className="flux-hero-stage">
      <div className="flux-hero relative w-full overflow-hidden bg-[var(--flux-void)] select-none">
        {reduce ? (
          <img ref={mediaRef} src="/hero-poster.jpg" alt="Fluxo Outlet" className="flux-hero__media w-full aspect-video lg:aspect-auto lg:h-[580px] object-cover" draggable={false} />
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
            ref={mediaRef}
            className="flux-hero__media w-full aspect-video lg:aspect-auto lg:h-[580px] object-cover"
          />
        )}
      </div>
    </section>
  );
};

export default HeroVideo;
