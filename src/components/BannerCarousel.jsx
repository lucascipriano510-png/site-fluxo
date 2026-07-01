import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight } from 'lucide-react';
import BannerImage from './BannerImage';

/**
 * Carrossel de banners da home: swipe via CSS scroll snap nativo, auto-avanço,
 * parallax/dim no scroll vertical e indicador sempre em sync com o slide visível.
 *
 * Props:
 *  - activeBanners       lista já filtrada por dispositivo (vem do useBanners)
 *  - bannersLoaded       false enquanto o fetch inicial não terminou
 *  - isAdmin             pausa auto-avanço e barra de progresso no painel
 *  - onCollectionFilter  (collectionName) => void  — aplica o filtro de coleção do botão
 */
export default function BannerCarousel({ activeBanners, bannersLoaded, isAdmin, onCollectionFilter }) {
  const [currentBannerSlide, setCurrentBannerSlide] = useState(0);
  const [isHeld, setIsHeld] = useState(false); // cliente segurando o banner → pausa
  const bannerRef = useRef(null);
  const bannerTrackRef = useRef(null);
  const currentBannerSlideRef = useRef(0);
  const holdRef = useRef(false);

  // "Travar ao segurar": pausa o auto-avanço enquanto o dedo/cursor está pressionado.
  // Também impede o timer de brigar com o swipe manual (causa do indicador defasado).
  const setHold = (v) => { holdRef.current = v; setIsHeld(v); };

  useEffect(() => { currentBannerSlideRef.current = currentBannerSlide; }, [currentBannerSlide]);
  // Mantém o slide dentro do range quando a lista muda (ex.: troca mobile<->desktop)
  useEffect(() => { setCurrentBannerSlide(s => (s >= activeBanners.length ? 0 : s)); }, [activeBanners.length]);

  // Navega para slide via scrollTo nativo (scroll snap cuida da animação)
  const goToBannerSlide = (idx) => {
    if (!activeBanners.length) return;
    const total = activeBanners.length;
    const newIdx = ((idx % total) + total) % total;
    const track = bannerTrackRef.current;
    if (track) track.scrollTo({ left: newIdx * track.clientWidth, behavior: 'smooth' });
    setCurrentBannerSlide(newIdx);
  };

  useEffect(() => {
    if (isAdmin || activeBanners.length <= 1) return;
    const timer = setInterval(() => {
      if (holdRef.current) return; // cliente segurando → não avança
      const track = bannerTrackRef.current;
      if (!track) return;
      const w = track.clientWidth || 1;
      // Avança a partir de ONDE O CLIENTE REALMENTE ESTÁ (posição do scroll),
      // não de um índice em memória que pode ter ficado defasado.
      const current = Math.round(track.scrollLeft / w);
      const next = (current + 1) % activeBanners.length;
      track.scrollTo({ left: next * w, behavior: 'smooth' });
      setCurrentBannerSlide(next);
    }, 5000);
    return () => clearInterval(timer);
  }, [activeBanners.length, isAdmin]);

  // Banner: swipe via CSS scroll snap nativo (sem drag JS) + parallax no scroll vertical
  useEffect(() => {
    const section = bannerRef.current;
    const track = bannerTrackRef.current;
    if (!section || !track) return;

    // Detecta slide atual pelo scrollLeft do track (scroll snap nativo).
    // Fonte ÚNICA de verdade do indicador: o que o cliente está realmente vendo.
    const syncIndex = () => {
      const newSlide = Math.round(track.scrollLeft / (track.clientWidth || 1));
      if (newSlide !== currentBannerSlideRef.current) {
        setCurrentBannerSlide(newSlide);
      }
    };
    // Settle: reconfirma a posição FINAL ~120ms depois do último evento de scroll.
    // (No iOS o snap pode terminar sem disparar um evento na posição exata.)
    let settleId = 0;
    const onTrackScroll = () => {
      syncIndex();
      clearTimeout(settleId);
      settleId = setTimeout(syncIndex, 120);
    };
    syncIndex(); // sincroniza o índice assim que os slides existem
    track.addEventListener('scrollend', syncIndex); // onde houver suporte nativo

    // Scroll-driven: parallax + scale + dim + fade de texto via RAF
    let rafId = 0;
    const onScroll = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        const rect = section.getBoundingClientRect();
        const h = rect.height || 1;
        const scrolled = Math.max(0, -rect.top);
        const progress = Math.max(0, Math.min(1, scrolled / h));
        section.style.setProperty('--banner-text-op', Math.max(0, 1 - progress * 2.5).toFixed(3));
        section.style.setProperty('--banner-parallax', `${(scrolled * 0.35).toFixed(1)}px`);
        section.style.setProperty('--banner-scale', (1 - progress * 0.08).toFixed(3));
        section.style.setProperty('--banner-dim', (progress * 0.55).toFixed(3));
      });
    };
    onScroll();

    const scroller = document.getElementById('root') || window;
    track.addEventListener('scroll', onTrackScroll, { passive: true });
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      track.removeEventListener('scroll', onTrackScroll);
      track.removeEventListener('scrollend', syncIndex);
      scroller.removeEventListener('scroll', onScroll);
      clearTimeout(settleId);
      if (rafId) cancelAnimationFrame(rafId);
    };
    // Re-anexa quando os banners carregam (no mount o trilho pode estar vazio).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBanners.length, bannersLoaded]);

  if (!(activeBanners.length > 0 || !bannersLoaded)) return null;

  return (
    <section
      ref={bannerRef}
      className="relative w-full max-w-[640px] lg:max-w-none mx-auto aspect-[4/5] lg:aspect-auto lg:h-[520px] overflow-hidden select-none"
      style={{ touchAction: 'pan-y' }}
      onPointerDown={() => setHold(true)}
      onPointerUp={() => setHold(false)}
      onPointerCancel={() => setHold(false)}
      onPointerLeave={() => setHold(false)}
    >
      {activeBanners.length === 0 && <div className="absolute inset-0 bg-zinc-950" />}

      {/* Trilho com scroll snap nativo + parallax vertical */}
      <div
        ref={bannerTrackRef}
        className="flex h-full overflow-x-auto no-scrollbar native-x-scroll"
        style={{ scrollSnapType: 'x mandatory', willChange: 'transform', transform: 'translate3d(0, var(--banner-parallax, 0px), 0) scale(var(--banner-scale, 1))', transformOrigin: '50% 0%' }}
      >
        {activeBanners.map((banner, idx) => {
          const isActive = idx === currentBannerSlide;
          // Só escurece se houver texto sobreposto (legibilidade). Sem texto = imagem limpa.
          const hasOverlay = !!(banner.collection_name || banner.title || banner.subtitle || banner.buttonText);
          return (
            <div key={idx} className="w-full h-full shrink-0 relative overflow-hidden" style={{ scrollSnapAlign: 'start' }}>
              <div className="absolute inset-0" style={{ transform: 'scale(1)', transformOrigin: '55% 45%' }}>
                <BannerImage src={banner.image} srcDesktop={banner.image_desktop} alt={banner.title || 'Banner'} active={isActive} />
              </div>
              {hasOverlay && <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-zinc-950/75 to-transparent pointer-events-none" />}
              {hasOverlay && <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-zinc-950 via-zinc-950/55 to-transparent pointer-events-none" />}
              {/* Texto com fade proporcional ao scroll */}
              <div className="absolute inset-x-0 bottom-0 px-7 lg:px-16 pb-12 lg:pb-20 flex flex-col lg:max-w-3xl" style={{ opacity: 'var(--banner-text-op, 1)', transform: 'translate3d(0, calc(var(--banner-parallax, 0px) * -0.4), 0)', transition: 'opacity 0.08s linear', willChange: 'opacity, transform' }}>
                {banner.collection_name && (
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="h-px w-8 bg-white/40" />
                    <span className="text-[9px] font-black uppercase tracking-[0.28em] text-white/55">{banner.collection_name}</span>
                  </div>
                )}
                {banner.title && <h2 className="text-[2.6rem] lg:text-[5rem] font-black uppercase leading-[0.92] tracking-tight text-white mb-2.5 drop-shadow-2xl">{banner.title}</h2>}
                {banner.subtitle && <p className="text-[10px] lg:text-[13px] font-semibold uppercase tracking-[0.18em] text-white/60 mb-7">{banner.subtitle}</p>}
                {banner.buttonText && (
                  <button
                    onClick={() => {
                      if (banner.external_link) {
                        window.open(banner.external_link, '_blank', 'noopener');
                      } else if (banner.collection_name) {
                        onCollectionFilter?.(banner.collection_name);
                        document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' });
                      } else {
                        document.getElementById('search-input')?.focus();
                      }
                    }}
                    className="self-start flex items-center gap-2 bg-white text-zinc-950 px-7 lg:px-10 py-3.5 lg:py-4 rounded-full font-black text-[10px] lg:text-[12px] uppercase tracking-widest active:scale-95 transition-transform shadow-[0_8px_30px_rgba(255,255,255,0.18)] touch-manipulation"
                  >
                    {banner.buttonText} <ArrowRight size={11} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Reflexo passando (brilho premium) — luz diagonal cruzando o banner */}
      {activeBanners.length > 0 && <div className="brilho-sheen" aria-hidden="true" />}

      {/* Dimmer que escurece conforme banner sai da viewport */}
      <div className="absolute inset-0 bg-zinc-950 pointer-events-none" style={{ opacity: 'var(--banner-dim, 0)', willChange: 'opacity' }} aria-hidden="true" />

      {/* Contador + linhas de progresso — canto superior direito */}
      {activeBanners.length > 1 && (
        <div className="absolute top-5 right-5 z-20 flex items-center gap-2.5 pointer-events-none">
          <span className="text-[10px] font-black text-white/70 tabular-nums">{String(currentBannerSlide + 1).padStart(2, '0')}</span>
          <div className="flex gap-1 items-center pointer-events-auto">
            {activeBanners.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => goToBannerSlide(idx)}
                aria-label={`Slide ${idx + 1}`}
                className={`h-0.5 rounded-full transition-all duration-500 ${idx === currentBannerSlide ? 'w-8 bg-white' : 'w-2 bg-white/30'}`}
              />
            ))}
          </div>
          <span className="text-[10px] font-black text-white/30 tabular-nums">{String(activeBanners.length).padStart(2, '0')}</span>
        </div>
      )}

      {/* Barra de progresso animada */}
      {activeBanners.length > 1 && !isAdmin && (
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/10 z-20 overflow-hidden">
          <div
            key={currentBannerSlide}
            className="h-full bg-white/45"
            style={{ animation: 'bannerProgress 5s linear forwards', animationPlayState: isHeld ? 'paused' : 'running' }}
          />
        </div>
      )}
    </section>
  );
}
