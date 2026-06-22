import { useState, useEffect, useMemo } from 'react';
import { fetchBanners, upsertBanner, deleteBanner } from '../lib/supabase';

// Banner de fallback enquanto o Supabase não responde (ou em ambiente sem dados).
export const DEFAULT_BANNERS = [
  {
    id: 'fallback-1',
    title: 'Seleção',
    subtitle: '',
    image: 'https://tapgnlrjhrhewqlpahvg.supabase.co/storage/v1/object/public/product-images/uploads/1780603307357-c93uqo1ylij.png',
    active: true,
    banner_order: 1,
    buttonText: 'VER PEÇAS',
    collection_name: null,
  },
];

const BANNERS_CACHE_KEY = '@fluxo:banners-cache-v1';
const BANNERS_CACHE_TTL = 120_000; // 2 min

/**
 * Camada de dados dos banners: estado + cache local + fetch periódico do Supabase
 * + sync (upsert/delete) ao mutar. Devolve também os derivados usados na home/admin.
 *
 * @param {boolean} isDesktopViewport  separa banner por dispositivo (desktop usa image_desktop)
 */
export function useBanners(isDesktopViewport) {
  const [banners, setBannersRaw] = useState(() => {
    try {
      const cached = JSON.parse(localStorage.getItem(BANNERS_CACHE_KEY) || 'null');
      if (cached && Date.now() - cached.ts < BANNERS_CACHE_TTL && Array.isArray(cached.data) && cached.data.length > 0) return cached.data;
    } catch {}
    return DEFAULT_BANNERS;
  });
  const [bannersLoaded, setBannersLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const remote = await fetchBanners();
        if (alive && Array.isArray(remote) && remote.length > 0) {
          // Normaliza button_text -> buttonText para o UI (vazio = botão oculto)
          const normalized = remote.map(b => ({
            ...b,
            buttonText: b.button_text || b.buttonText || ''
          }));
          setBannersRaw(normalized);
          try { localStorage.setItem(BANNERS_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: normalized })); } catch {}
        }
      } catch (e) { console.warn('[banners] fetch falhou:', e?.message); }
      finally { if (alive) setBannersLoaded(true); }
    };
    load();
    const t = setInterval(load, 120_000); // era 10s → 2 min
    return () => { alive = false; clearInterval(t); };
  }, []);

  // Mutação local com sync remoto: upserta o que mudou, deleta o que sumiu.
  const setBanners = (updater) => {
    setBannersRaw((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try {
        const nextIds = new Set((next || []).map(b => b.id));
        (next || []).forEach(b => {
          const old = (prev || []).find(o => o.id === b.id);
          if (!old || JSON.stringify(old) !== JSON.stringify(b)) {
            upsertBanner(b).catch(err => console.warn('[banners] upsert falhou:', err?.message));
          }
        });
        (prev || []).forEach(b => { if (!nextIds.has(b.id)) deleteBanner(b.id).catch(err => console.warn('[banners] delete falhou:', err?.message)); });
      } catch (e) { console.warn('[banners] sync falhou:', e?.message); }
      return next;
    });
  };

  // Banner é exclusivo por dispositivo: desktop só mostra quem tem imagem desktop;
  // mobile só quem tem imagem mobile. Um nunca puxa o do outro.
  const activeBanners = useMemo(
    () => (banners || []).filter(b => b.active && (isDesktopViewport ? b.image_desktop : b.image)),
    [banners, isDesktopViewport]
  );

  const availableCollections = useMemo(() => {
    const set = new Set();
    (banners || []).forEach(b => { if (b.collection_name) set.add(b.collection_name); });
    return Array.from(set).sort();
  }, [banners]);

  return { banners, setBanners, bannersLoaded, activeBanners, availableCollections };
}
