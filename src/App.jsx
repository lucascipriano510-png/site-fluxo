import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Plus, Minus, Trash2, X, Search, LayoutDashboard, ShoppingBag, Package, Box, MessageCircle, Zap, Info, Star, ChevronRight, ChevronLeft, ChevronDown, ArrowRight, Layers, Settings, MapPin, User, CheckCircle2, LogOut, ClipboardList, Database, Image as ImageIcon, ZoomIn, Truck, Check, Flame, ShieldCheck, Award, CreditCard, Lock, Megaphone, Instagram, Menu } from 'lucide-react';
import { fetchProducts, upsertProduct, deleteProduct, uploadImage, fetchAllKitItems } from './lib/supabase';
import OfferCountdown from './components/OfferCountdown';
import ProductReviewsList from './components/ProductReviewsList';
import StarRatingInline from './components/StarRatingInline';
import BannerCarousel from './components/BannerCarousel';
import SubBanner from './components/SubBanner';
import { useBanners } from './hooks/useBanners';
import AdminHeader from './components/AdminHeader';
import AdminInventory from './components/AdminInventory';
import AdminLeads from './components/AdminLeads';
import AdminConfig from './components/AdminConfig';
import AdminBanners from './components/AdminBanners';
import AdminDashboard from './components/AdminDashboard';
import { optimizeImage, buildSrcSet, markWsrvFailed, getCatImgData } from './lib/images';
import { formatBRL } from './lib/format';
import { isOfferLive, offerPrice, offerPercent, offerEndsAt, offerCampaign, OFFER_CAMPAIGNS, CAMPAIGN_LABELS } from './lib/offers';
import { parseQueryIntent, productMatchesIntent, scoreProductForSearch, hasActiveQuery } from './lib/search';
import { emitSignal, setKnownLead, cartSnapshot } from './lib/leadSignals';
import { fetchOrders } from './lib/orders';
import { supabase } from './lib/supabaseClient';
import { fetchSiteConfig, upsertSiteConfig, DEFAULT_CONFIG as SITE_DEFAULT_CONFIG } from './lib/siteConfig';
import { createMetaEventId } from './lib/capi';
import { initMetaPixel, trackEvent } from './lib/metaPixel';
import { criarAtendimentoFromPedido } from './lib/crm';
import { fetchRatingsBatch } from './lib/reviews';
// Admin + recharts: code-split. Só baixam quando o painel abre — fora do bundle do cliente.
const AdminRastreio = React.lazy(() => import('./components/AdminRastreio'));
const AdminCRM = React.lazy(() => import('./components/AdminCRM'));
const AdminGrowth = React.lazy(() => import('./components/AdminGrowth'));

// ==========================================
// 1. CONFIGURAÇÃO E DADOS INICIAIS
// ==========================================
const APP_ID = typeof __app_id !== 'undefined' ? __app_id : 'fluxo-dark-ultimate';
const LEAD_STORAGE_KEY = '@fluxo-outlet:lead-data-v3';
const BANNERS_STORAGE_KEY = `@${APP_ID}:banners`;

const DEFAULT_PRODUCTS = [
  { id: 1, sku: 'CAM-BRA-001', name: 'Camiseta Branca Basic', price: 89.90, category: 'VESTUÁRIO', image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800', stock: 25, sales: 12, sizes: [{size: 'P', stock: 5}, {size: 'M', stock: 10}, {size: 'G', stock: 10}], featured: true },
  { id: 2, sku: 'CAL-JOG-001', name: 'Calça Jogger Tech', price: 169.90, category: 'VESTUÁRIO', image: 'https://images.unsplash.com/photo-1552346154-21d32810aba3?w=800', stock: 15, sales: 8, sizes: [{size: '38', stock: 5}, {size: '40', stock: 5}, {size: '42', stock: 5}], featured: false },
  { id: 3, sku: 'TEN-RUN-002', name: 'Tênis Running Fluxo', price: 299.90, category: 'CALÇADOS', image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800', stock: 2, sales: 45, sizes: [{size: '39', stock: 1}, {size: '41', stock: 1}], featured: true },
  { id: 4, sku: 'BON-PRE-003', name: 'Boné Archer Black', price: 79.90, category: 'ACESSÓRIOS', image: 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=800', stock: 0, sales: 120, sizes: [{size: 'U', stock: 0}], featured: false }, 
  { id: 5, sku: '9059', name: 'Calça Super Skinny Malibu Rasgada', price: 189.90, category: 'VESTUÁRIO', image: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=800', stock: 10, sales: 5, sizes: [{size: '38', stock: 5}, {size: '40', stock: 5}], featured: true }
];

const DEFAULT_CONFIG = {
  brandName: 'FLUXO OUTLET EXCLUSIVE',
  whatsapp: '5534984148067', 
  location: 'UBERABA, MG',
  minOrder: 0.00, 
  pixelId: 'PIXEL_FLUXO_001',
  logoUrl: '', 
  logoZoom: 1.5,
  marqueePhrases: [
    'ALTO PADRÃO EM CADA DETALHE',
    'ENVIO PRIORITÁRIO',
    'COLEÇÕES LIMITADAS',
    'DESIGN AUTÊNTICO E EXCLUSIVO'
  ]
};

const useVisualViewportFrame = () => {
  const [frame, setFrame] = useState({ top: 0, height: 0 });
  useEffect(() => {
    const updateFrame = () => {
      const vv = window.visualViewport;
      setFrame({
        top: vv ? vv.offsetTop : 0,
        height: vv ? vv.height : window.innerHeight,
      });
    };
    updateFrame();
    window.visualViewport?.addEventListener('resize', updateFrame);
    window.visualViewport?.addEventListener('scroll', updateFrame);
    window.addEventListener('resize', updateFrame);
    return () => {
      window.visualViewport?.removeEventListener('resize', updateFrame);
      window.visualViewport?.removeEventListener('scroll', updateFrame);
      window.removeEventListener('resize', updateFrame);
    };
  }, []);
  return frame;
};


class AdminTabErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || 'Erro inesperado na aba.' };
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, message: '' });
    }
  }

  componentDidCatch(error) {
    console.error('[ADMIN_TAB_ERROR]', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 pb-32 text-center">
          <div className="bg-red-500/10 border border-red-500/30 rounded-3xl p-6 text-red-300 text-xs font-bold">
            Erro ao abrir esta aba. Troque de aba e tente novamente.
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ==========================================
// 2. FUNÇÕES DE TRACKING E UTILITÁRIOS
// ==========================================

// Utilitários de imagem (otimização wsrv.nl) — extraídos p/ ./lib/images.

// ──────────────────────────────────────────────────────────────
// Fila de carregamento de imagens com concorrência limitada.
// Garante ORDEM: imagens com menor `priority` (topo da página) baixam
// antes das de baixo. Uma imagem no fim da lista nunca começa antes das
// primeiras — só ganha um "slot" quando chega a sua vez.
// ──────────────────────────────────────────────────────────────
const IMG_CONCURRENCY = 3; // quantas imagens podem baixar ao mesmo tempo
let imgActive = 0;
let imgQueue = [];

const pumpImgQueue = () => {
  imgQueue.sort((a, b) => a.priority - b.priority);
  while (imgActive < IMG_CONCURRENCY && imgQueue.length > 0) {
    const job = imgQueue.shift();
    job.started = true;
    imgActive++;
    try { job.onStart(); } catch { imgActive--; }
  }
};

// Pede permissão para carregar. `onStart` é chamado quando for a vez.
// Retorna um handle com done()/cancel() para liberar o slot.
const acquireImgSlot = (priority, onStart) => {
  const job = { priority, onStart, started: false, finished: false };
  imgQueue.push(job);
  pumpImgQueue();
  const release = () => {
    if (job.finished) return;
    job.finished = true;
    if (job.started) { imgActive = Math.max(0, imgActive - 1); pumpImgQueue(); }
    else { imgQueue = imgQueue.filter(j => j !== job); }
  };
  return { done: release, cancel: release };
};

// Faixas de preço (chips de filtro). max=null => sem teto.
const PRICE_RANGES = [
  { key: 'ate100', label: 'Até R$ 100', min: null, max: 100 },
  { key: '100a200', label: 'R$ 100–200', min: 100, max: 200 },
  { key: '200a300', label: 'R$ 200–300', min: 200, max: 300 },
  { key: '300mais', label: 'R$ 300+', min: 300, max: null },
];
// Cor do nome → bolinha do chip de cor. Desconhecida cai num cinza neutro.
const COLOR_HEX = {
  preto: '#111111', branco: '#f4f4f5', azul: '#3b82f6', 'azul marinho': '#1e3a8a',
  vermelho: '#ef4444', verde: '#22c55e', bege: '#d8c3a5', cinza: '#9ca3af',
  marrom: '#8b5a2b', rosa: '#ec4899', amarelo: '#eab308', laranja: '#f97316',
  roxo: '#8b5cf6', lilas: '#c4b5fd', vinho: '#7f1d1d', dourado: '#d4af37',
  prata: '#c0c0c0', nude: '#e3bc9a', caramelo: '#c97b3c', off: '#efe9dd',
};
const colorDot = (name) => COLOR_HEX[String(name || '').toLowerCase()] || null;

const ProductImage = ({ src, alt, isOutOfStock, priority = false, order = 1000, sizes: sizesProp }) => {
  const [loaded, setLoaded] = React.useState(false);
  const [inView, setInView] = React.useState(priority);
  const [canLoad, setCanLoad] = React.useState(false); // a fila liberou o slot
  const wrapperRef = React.useRef(null);
  const slotRef = React.useRef(null);

  // 1) Detecta proximidade da viewport (não carrega o que está longe pra baixo).
  React.useEffect(() => {
    if (!src) return;
    setLoaded(false);
    setCanLoad(false);
    if (priority) { setInView(true); return; }
    setInView(false);
    const el = wrapperRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setInView(true); return; }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((entry) => {
        if (entry.isIntersecting) { setInView(true); io.disconnect(); }
      }),
      { rootMargin: '400px 0px', threshold: 0.01 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [src, priority]);

  // 2) Estando por perto, entra na fila ORDENADA e só carrega quando for a vez.
  React.useEffect(() => {
    if (!src || !(priority || inView)) return;
    const slot = acquireImgSlot(priority ? 0 : order, () => setCanLoad(true));
    slotRef.current = slot;
    return () => { slot.cancel(); slotRef.current = null; };
  }, [src, inView, priority, order]);

  const finishSlot = () => { if (slotRef.current) { slotRef.current.done(); slotRef.current = null; } };

  // Watchdog: se uma imagem demorar demais, libera o slot pra não travar a fila
  // (a imagem continua carregando em paralelo, só deixa de bloquear as próximas).
  React.useEffect(() => {
    if (!canLoad) return;
    const t = setTimeout(finishSlot, 7000);
    return () => clearTimeout(t);
  }, [canLoad]);

  const srcSet = buildSrcSet(src, [320, 480, 640, 900, 1200], 80);

  return (
    <div ref={wrapperRef} className="absolute inset-0">
      {!loaded && (
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, var(--bg-surface) 25%, var(--bg-elevated) 50%, var(--bg-surface) 75%)', backgroundSize: '200% 100%', animation: 'skeleton-shine 1.4s ease-in-out infinite', zIndex: 1 }} />
      )}
      {canLoad && (
        <img
          src={optimizeImage(src, 1000, 80)}
          srcSet={srcSet}
          sizes={sizesProp || "(min-width: 1280px) 22vw, (min-width: 1024px) 30vw, 50vw"}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={priority ? 'high' : 'auto'}
          onLoad={() => { setLoaded(true); finishSlot(); }}
          onError={(e) => {
            if (!e.target.dataset.fallback) {
              e.target.dataset.fallback = '1';
              markWsrvFailed();
              e.target.src = src; // URL original do Supabase sem proxy
              e.target.srcset = '';
            } else {
              finishSlot(); // libera o slot mesmo se o fallback falhar
            }
          }}
          draggable={false}
          style={{ pointerEvents: 'none' }}
          className={`w-full h-full object-contain transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'} ${isOutOfStock ? 'grayscale opacity-40' : ''} transition-transform`}
        />
      )}
    </div>
  );
};

// ──────────────────────────────────────────────────────────────
// Galeria do card que passa as fotos SÓ ONDE O DEDO ESTÁ PASSANDO (mobile).
// Enquanto o cliente rola e o dedo passa por cima de um card (sem precisar
// segurar/pressionar), AQUELE card vai trocando as fotos sozinho. Saiu dele
// (foi pra outro card ou levantou o dedo), para. Apenas um por vez muda.
// Não bloqueia o scroll vertical: só listeners passivos (nunca preventDefault).
// Como o touchmove fica "preso" no alvo inicial, um rastreador global usa
// elementFromPoint p/ saber sobre qual card o dedo está a cada momento.
// ──────────────────────────────────────────────────────────────
// overflowX 'hidden' (não 'scroll') = o card NÃO é arrastável na horizontal; o
// swipe lateral passa pro carrossel pai. O auto-avanço usa scrollTo programático,
// que segue funcionando com overflow hidden. touchAction 'pan-y' libera só a
// rolagem vertical da página.
const HOLD_SCROLL_STYLE = { position: 'absolute', inset: 0, display: 'flex', overflowX: 'hidden', overflowY: 'hidden', scrollSnapType: 'x mandatory', overscrollBehaviorX: 'contain', msOverflowStyle: 'none', scrollbarWidth: 'none', touchAction: 'pan-y' };
const AUTOPLAY_MS = 1400; // ritmo entre as fotos enquanto o dedo está sobre o card (modo toque)
const AUTO_CYCLE_MS = 2800; // ritmo do modo AUTO (destaque), sozinho — mais lento/ambiente

// Registro de galerias + rastreador global de toque (inicializado uma vez).
const galleryRegistry = new Map(); // element -> { activate, deactivate }
let activeGalleryEl = null;
let galleryListenersOn = false;
let lastPointCheck = 0;
let galleryTouchStartX = 0;
let galleryTouchStartY = 0;
let galleryDragDecided = false; // gesto já virou arrasto do carrossel / rolagem?

const setActiveGalleryAt = (x, y) => {
  let el = null;
  try {
    const node = document.elementFromPoint(x, y);
    el = node ? node.closest('[data-autogallery="1"]') : null;
  } catch { el = null; }
  if (el === activeGalleryEl) return;
  if (activeGalleryEl && galleryRegistry.has(activeGalleryEl)) galleryRegistry.get(activeGalleryEl).deactivate();
  activeGalleryEl = el;
  if (el && galleryRegistry.has(el)) galleryRegistry.get(el).activate();
};
const ensureGalleryListeners = () => {
  if (galleryListenersOn || typeof window === 'undefined') return;
  galleryListenersOn = true;
  // Importante: NÃO paramos no touchend. O card que começou a passar continua
  // sozinho até que OUTRA ÁREA seja tocada — aí ou outro card assume (sobre um
  // card) ou para (toque fora de qualquer card). Por isso só ouvimos start/move.
  const onStart = (e) => {
    const t = e.touches && e.touches[0]; if (!t) return;
    galleryTouchStartX = t.clientX;
    galleryTouchStartY = t.clientY;
    galleryDragDecided = false;
    setActiveGalleryAt(t.clientX, t.clientY); // toque parado já começa a passar as fotos
  };
  const onMove = (e) => {
    const t = e.touches && e.touches[0]; if (!t) return;
    // Decide cedo: arrasto HORIZONTAL = intenção de mover o carrossel (não trocar foto);
    // rolagem VERTICAL = sair do card. Em qualquer um, SOLTA a galeria pra não atrapalhar.
    if (!galleryDragDecided) {
      const dx = Math.abs(t.clientX - galleryTouchStartX);
      const dy = Math.abs(t.clientY - galleryTouchStartY);
      if ((dx > 10 && dx > dy) || dy > 10) {
        galleryDragDecided = true;
        if (activeGalleryEl && galleryRegistry.has(activeGalleryEl)) galleryRegistry.get(activeGalleryEl).deactivate();
        activeGalleryEl = null;
        return;
      }
    }
    if (galleryDragDecided) return; // já é arrasto/rolagem → não reativa a galeria
    const now = Date.now();
    if (now - lastPointCheck < 90) return; // throttle leve
    lastPointCheck = now;
    setActiveGalleryAt(t.clientX, t.clientY);
  };
  window.addEventListener('touchstart', onStart, { passive: true });
  window.addEventListener('touchmove', onMove, { passive: true });
};

// Ícone do Pix (lucide não tem ícone de marca). Cor herda de `color`.
const PixIcon = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path d="M5.283 18.36a3.505 3.505 0 0 0 2.493-1.032l3.6-3.6a.684.684 0 0 1 .946 0l3.613 3.613a3.504 3.504 0 0 0 2.493 1.032h.71l-4.56 4.56a3.647 3.647 0 0 1-5.156 0L4.85 18.36ZM18.428 5.627a3.505 3.505 0 0 0-2.493 1.032l-3.613 3.614a.67.67 0 0 1-.946 0l-3.6-3.6A3.505 3.505 0 0 0 5.283 5.64h-.434l4.573-4.572a3.646 3.646 0 0 1 5.156 0l4.559 4.559ZM1.068 9.422 3.79 6.699h1.492a2.483 2.483 0 0 1 1.744.722l3.6 3.6a1.73 1.73 0 0 0 2.443 0l3.614-3.613a2.482 2.482 0 0 1 1.744-.723h1.767l2.737 2.737a3.646 3.646 0 0 1 0 5.156l-2.736 2.736h-1.768a2.482 2.482 0 0 1-1.744-.722l-3.613-3.613a1.77 1.77 0 0 0-2.444 0l-3.6 3.6a2.483 2.483 0 0 1-1.744.722H3.791l-2.723-2.723a3.646 3.646 0 0 1 0-5.156"/>
  </svg>
);

const AutoScrollGallery = ({ count = 1, children, auto = false, startDelay = 0 }) => {
  const ref = React.useRef(null);
  const timerRef = React.useRef(null);
  const multi = count > 1;
  const [autoIdx, setAutoIdx] = React.useState(0);

  // ===== MODO AUTO (destaque) =====
  // Cicla as fotos SOZINHO via transform (translateX) — sem container de scroll,
  // então NÃO captura toque: o dedo fica 100% livre pra arrastar o carrossel.
  React.useEffect(() => {
    if (!auto || !multi) return;
    let intervalId = null;
    const startId = setTimeout(() => {
      setAutoIdx((i) => (i + 1) % count);
      intervalId = setInterval(() => setAutoIdx((i) => (i + 1) % count), AUTO_CYCLE_MS);
    }, startDelay);
    return () => { clearTimeout(startId); if (intervalId) clearInterval(intervalId); };
  }, [auto, multi, count, startDelay]);

  // ===== MODO TOQUE (catálogo) =====
  // Passa as fotos enquanto o dedo está parado sobre o card (scroll nativo).
  React.useEffect(() => {
    if (auto || !multi) return;
    ensureGalleryListeners();
    const el = ref.current;
    if (!el) return;
    el.setAttribute('data-autogallery', '1');
    const advance = () => {
      const node = ref.current; if (!node) return;
      const w = node.clientWidth || 1;
      const maxLeft = node.scrollWidth - w;
      let next = Math.round(node.scrollLeft / w) * w + w;
      if (next > maxLeft + 1) next = 0;
      node.scrollTo({ left: next, behavior: 'smooth' });
    };
    const controller = {
      activate: () => {
        if (timerRef.current) return;
        advance();
        timerRef.current = setInterval(advance, AUTOPLAY_MS);
      },
      deactivate: () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } },
    };
    galleryRegistry.set(el, controller);
    return () => {
      controller.deactivate();
      galleryRegistry.delete(el);
      if (activeGalleryEl === el) activeGalleryEl = null;
    };
  }, [auto, multi]);

  // Render AUTO: trilho flex transladado, sem scroll (toque atravessa pro carrossel).
  if (auto) {
    return (
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', width: '100%', height: '100%', transform: `translateX(-${autoIdx * 100}%)`, transition: 'transform 0.55s cubic-bezier(0.4,0,0.2,1)' }}>
          {children}
        </div>
      </div>
    );
  }

  // Render TOQUE: container de scroll nativo.
  return (
    <div ref={ref} style={HOLD_SCROLL_STYLE}>
      {children}
    </div>
  );
};

// Wrapper compat: encaminha pro pipeline híbrido (Pixel + CAPI com dedup)
const trackPixel = (eventName, payload = {}) => {
  try { trackEvent(eventName, payload); }
  catch (e) { console.warn('[trackPixel] falhou:', e); }
};

// createMetaEventId extraído p/ ./lib/capi.

// ==========================================
// 3. COMPONENTES ADMIN DESACOPLADOS
// ==========================================

// ==========================================
// 3.5. KIT MODAL (Bundle Builder / Shop the Look)
// ==========================================
const KitModal = ({ kit, products, kitItemsByKit, cart, setCart, setCartBounce, setIsCartModalOpen, onClose, setZoomImage, showToast }) => {
  const componentIds = kitItemsByKit[kit.id] || [];
  const components = componentIds
    .map(pid => (products || []).find(p => p.id === pid))
    .filter(Boolean);

  // Galeria: imagem principal + gallery[]
  const gallery = [kit.image, ...((Array.isArray(kit.gallery) ? kit.gallery : []) || [])].filter(Boolean);
  const [activeImage, setActiveImage] = useState(gallery[0] || kit.image);

  // ===== ZOOM INLINE (hover desktop / long-press mobile) + tap p/ abrir fullscreen =====
  const [zoomActive, setZoomActive] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });
  const longPressRef = useRef(null);
  const movedRef = useRef(false);
  const tapStartRef = useRef(0);
  const tapStartPosRef = useRef({ x: 0, y: 0 });
  const zoomTriggeredRef = useRef(false);
  const updatePos = (clientX, clientY, rect) => {
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
    setZoomPos({ x, y });
  };
  const onMouseEnter = () => setZoomActive(true);
  const onMouseLeave = () => setZoomActive(false);
  const onMouseMove = (e) => updatePos(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect());
  const onImageClick = () => {
    // desktop: clique simples abre fullscreen
    if (setZoomImage && activeImage) setZoomImage(activeImage);
  };
  const onTouchStart = (e) => {
    movedRef.current = false;
    zoomTriggeredRef.current = false;
    const touch = e.touches[0];
    tapStartRef.current = Date.now();
    tapStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    const target = e.currentTarget;
    longPressRef.current = setTimeout(() => {
      const rect = target.getBoundingClientRect();
      updatePos(touch.clientX, touch.clientY, rect);
      setZoomActive(true);
      zoomTriggeredRef.current = true;
      if (navigator.vibrate) try { navigator.vibrate(15); } catch {}
    }, 450);
  };
  const onTouchMove = (e) => {
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - tapStartPosRef.current.x);
    const dy = Math.abs(touch.clientY - tapStartPosRef.current.y);
    if (zoomActive) {
      updatePos(touch.clientX, touch.clientY, e.currentTarget.getBoundingClientRect());
    } else if (dx > 8 || dy > 8) {
      movedRef.current = true;
      clearTimeout(longPressRef.current);
    }
  };
  const onTouchEnd = () => {
    clearTimeout(longPressRef.current);
    const elapsed = Date.now() - tapStartRef.current;
    const wasZoom = zoomTriggeredRef.current;
    setZoomActive(false);
    // tap curto sem mover => abre fullscreen
    if (!wasZoom && !movedRef.current && elapsed < 300) {
      if (setZoomImage && activeImage) setZoomImage(activeImage);
    }
  };

  // Mantém o modal dentro da área realmente visível do navegador móvel.
  // Isso evita o efeito da barra de URL cobrir os controles quando ela expande/retrai.
  const visualFrame = useVisualViewportFrame();

  // Pré-carrega todas as imagens do kit assim que o modal abre para eliminar delay ao trocar fotos
  useEffect(() => {
    const urls = [
      ...gallery.map(g => optimizeImage(g, 1200, 85)),
      ...components.map(c => optimizeImage(c.image, 400, 80)),
    ].filter(Boolean);
    urls.forEach(url => { const img = new Image(); img.src = url; });
  }, [kit.id]);

  // Estado por componente: { included: bool, size: string }
  const [picks, setPicks] = useState(() => {
    const init = {};
    components.forEach(c => {
      const hasStock = (c.sizes || []).some(s => Number(typeof s === 'string' ? c.stock : s.stock) > 0);
      init[c.id] = { included: hasStock, size: '' };
    });
    return init;
  });
  const [missingFlash, setMissingFlash] = useState({});

  const includedItems = components.filter(c => picks[c.id]?.included);
  const total = includedItems.reduce((acc, c) => acc + Number(c.price || 0), 0);
  const sumOriginal = components.reduce((acc, c) => acc + Number(c.price || 0), 0);

  const togglePick = (id) => setPicks(p => ({ ...p, [id]: { ...(p[id] || {}), included: !p[id]?.included } }));
  const setSize = (id, size) => setPicks(p => ({ ...p, [id]: { ...(p[id] || { included: true }), size } }));

  const handleAddKitToCart = () => {
    if (includedItems.length === 0) {
      showToast('Selecione ao menos uma peça do kit.', 'error');
      return;
    }
    const missing = {};
    includedItems.forEach(c => { if (!picks[c.id]?.size) missing[c.id] = true; });
    if (Object.keys(missing).length > 0) {
      setMissingFlash(missing);
      setTimeout(() => setMissingFlash({}), 1500);
      showToast('Escolha o tamanho de todas as peças marcadas.', 'error');
      return;
    }
    // Adiciona cada sub-produto individualmente
    let updatedCart = [...cart];
    includedItems.forEach(c => {
      const sizeName = picks[c.id].size;
      const itemKey = `${c.id}-${sizeName || 'U'}`;
      const existingIdx = updatedCart.findIndex(it => it.itemKey === itemKey);
      if (existingIdx >= 0) {
        updatedCart[existingIdx] = { ...updatedCart[existingIdx], quantity: updatedCart[existingIdx].quantity + 1 };
      } else {
        updatedCart.push({ ...c, size: sizeName, quantity: 1, itemKey, fromKitId: kit.id, fromKitName: kit.name });
      }
    });
    setCart(updatedCart);
    setCartBounce(true);
    setTimeout(() => setCartBounce(false), 400);
    setIsCartModalOpen(true);
    onClose();
  };

  if (components.length === 0) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
        <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={onClose} />
        <div className="relative bg-zinc-950 max-w-sm w-full p-8 rounded-3xl border border-white/10 text-center">
          <Zap className="mx-auto text-amber-400 mb-3" />
          <h3 className="text-white font-black uppercase text-sm mb-2">Kit em preparação</h3>
          <p className="text-zinc-400 text-xs">Este kit ainda não tem peças vinculadas.</p>
          <button onClick={onClose} className="mt-6 w-full py-3 rounded-2xl bg-white text-zinc-950 font-black text-[11px] uppercase tracking-widest">Fechar</button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-x-0 z-[100] flex items-end justify-center overflow-hidden"
      style={{ top: visualFrame.top, height: visualFrame.height || '100dvh' }}
    >
      <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={onClose} />
      <div
        className="relative bg-zinc-950 w-full max-w-md rounded-t-[40px] animate-slide-up border-t border-white/10 shadow-2xl overflow-hidden flex flex-col"
        style={{ height: visualFrame.height ? `calc(${visualFrame.height}px - 10px)` : 'calc(100dvh - 10px)', overscrollBehavior: 'contain', touchAction: 'pan-y' }}
      >

        {/* Drag handle — overlay fixo sobre o modal */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-white/30 rounded-full backdrop-blur-md pointer-events-none z-10" />
        {/* Fechar — overlay fixo */}
        <button onClick={onClose} className="absolute top-4 right-4 text-white bg-black/50 backdrop-blur-md rounded-full p-2.5 touch-manipulation border border-white/10 active:scale-90 transition-transform z-10">
          <X size={18}/>
        </button>
        {/* Badge KIT — overlay fixo */}
        <div className="absolute top-4 left-4 bg-gradient-to-r from-amber-400 to-pink-500 text-zinc-950 text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full flex items-center gap-1 shadow-[0_4px_15px_rgba(251,191,36,0.4)] pointer-events-none z-10">
          <Zap size={10} className="fill-zinc-950" /> KIT
        </div>

        {/* TUDO num único scroll — rola de qualquer ponto da tela */}
        <div
          className="flex-1 overflow-y-auto custom-scrollbar"
          style={{ overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}
        >
          {/* GALERIA com zoom inline */}
          <div className="relative w-full bg-gradient-to-b from-zinc-900 to-zinc-950 pt-14">
            <div
              className="relative block w-full aspect-[4/3] overflow-hidden select-none cursor-zoom-in"
              style={{ touchAction: zoomActive ? 'none' : 'pan-y' }}
              onMouseEnter={onMouseEnter}
              onMouseLeave={onMouseLeave}
              onMouseMove={onMouseMove}
              onClick={onImageClick}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
              onTouchCancel={onTouchEnd}
              aria-label="Foto do kit — toque para ampliar, segure para zoom"
            >
              <img
                src={optimizeImage(activeImage, 1200, 85)}
                className={`w-full h-full object-cover transition-opacity duration-200 ${zoomActive ? 'opacity-0' : 'opacity-100'}`}
                alt={kit.sku}
                draggable={false}
                fetchPriority="high"
              />
              <div
                className={`absolute inset-0 transition-opacity duration-200 ${zoomActive ? 'opacity-100' : 'opacity-0'}`}
                style={{
                  backgroundImage: `url(${optimizeImage(activeImage, 1400, 85)})`,
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: '220%',
                  backgroundPosition: `${zoomPos.x}% ${zoomPos.y}%`,
                }}
              />
              {!zoomActive && (
                <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-md text-white text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border border-white/10 flex items-center gap-1 pointer-events-none md:hidden">
                  <ZoomIn size={9}/> Segure para ampliar
                </div>
              )}
            </div>
            {/* Hint de scroll */}
            <div className="flex flex-col items-center py-3 gap-0.5 pointer-events-none select-none">
              <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Role para selecionar as peças</span>
              <span className="text-zinc-600 text-base animate-bounce leading-none">↓</span>
            </div>
          </div>

          {/* THUMBS */}
          {gallery.length > 1 && (
            <div
              className="px-4 py-3 flex gap-2 overflow-x-auto overflow-y-hidden no-scrollbar bg-zinc-950 border-b border-white/5"
              style={{ touchAction: 'pan-x', overscrollBehavior: 'contain' }}
            >
              {gallery.map((g, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImage(g)}
                  className={`shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${activeImage === g ? 'border-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.5)] scale-105' : 'border-white/10 opacity-70 hover:opacity-100'}`}
                >
                  <img src={optimizeImage(g, 300, 80)} className="w-full h-full object-cover" alt="" draggable={false} loading="lazy" decoding="async" />
                </button>
              ))}
            </div>
          )}

          {/* BARRA DE PROGRESSO */}
          <div className="px-5 py-3 bg-zinc-900/80 border-b border-white/5 flex items-center gap-3">
            <Layers size={13} className="text-amber-400 shrink-0" />
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Itens no kit</span>
                <span className="text-[10px] font-black text-amber-400">{includedItems.length} / {components.length} peças</span>
              </div>
              <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 to-pink-500 rounded-full transition-all duration-300"
                  style={{ width: `${components.length > 0 ? (includedItems.length / components.length) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>

          {/* INFO + PRODUTOS */}
          <div className="px-7 pt-4 pb-2">
            <span className="text-[8px] font-black text-zinc-500 uppercase bg-zinc-900 px-2 py-1 rounded-md tracking-widest">REF: {kit.sku}</span>
            <p className="text-[9px] text-zinc-500 uppercase font-black mt-3 tracking-widest">Marque as peças que deseja e escolha o tamanho de cada uma.</p>
          </div>

          <div className="px-5 py-3 space-y-2">
          {/* Itens incluídos aparecem primeiro */}
          {[...components].sort((a, b) => {
            const ia = picks[a.id]?.included ? 0 : 1;
            const ib = picks[b.id]?.included ? 0 : 1;
            return ia - ib;
          }).map(c => {
            const included = picks[c.id]?.included;
            const chosenSize = picks[c.id]?.size || '';
            const sizes = (c.sizes || []).map(s => ({
              name: String((typeof s === 'string' ? s : s.size) || '').trim().toUpperCase(),
              stock: typeof s === 'string' ? Number(c.stock || 0) : Number(s.stock || 0),
            })).filter(s => s.name);
            const isMissing = !!missingFlash[c.id];
            return (
              <div key={c.id} className={`relative rounded-2xl border transition-all duration-200 p-3 ${included ? (isMissing ? 'bg-red-500/10 border-red-500 animate-pulse' : 'bg-zinc-900 border-emerald-500/30') : 'bg-zinc-900/20 border-white/5'}`}>
                {/* Linha de status */}
                {included && (
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500/50 to-transparent rounded-t-2xl pointer-events-none" />
                )}
                <div className="flex gap-3">
                  <div className="relative shrink-0">
                    <img src={optimizeImage(c.image, 400, 80)} className={`w-16 h-20 rounded-xl object-cover border ${included ? 'border-emerald-500/30' : 'border-white/5 grayscale opacity-50'}`} alt={c.name} loading="lazy" decoding="async" />
                    {included && chosenSize && (
                      <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-zinc-950 text-[8px] font-black px-1.5 py-0.5 rounded-md leading-none">{chosenSize}</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className={`font-black text-[11px] uppercase leading-tight line-clamp-2 ${included ? 'text-white' : 'text-zinc-600'}`}>{c.name}</h4>
                      <button
                        onClick={() => togglePick(c.id)}
                        className={`shrink-0 w-7 h-7 rounded-lg border-2 grid place-items-center transition-all touch-manipulation ${included ? 'bg-emerald-500 border-emerald-500 text-zinc-950 shadow-[0_0_10px_rgba(16,185,129,0.4)]' : 'bg-zinc-800 border-zinc-600 text-zinc-600 hover:border-zinc-400'}`}
                        aria-label={included ? 'Remover do kit' : 'Adicionar ao kit'}
                      >
                        {included ? <Check size={14} strokeWidth={3} /> : <Plus size={13} strokeWidth={2.5} />}
                      </button>
                    </div>
                    <p className={`font-black text-sm mt-1 ${included ? 'text-emerald-400' : 'text-zinc-600'}`}>{formatBRL(c.price || 0)}</p>
                    {included && (
                      <>
                        {sizes.length > 0 && (
                          <p className="text-[9px] font-black text-zinc-500 uppercase mt-2 mb-1">
                            {chosenSize ? '✓ Tamanho selecionado' : '⚠ Escolha o tamanho'}
                          </p>
                        )}
                        <div className="flex gap-1.5 flex-wrap">
                          {sizes.length === 0 && (
                            <span className="text-[9px] text-zinc-500 uppercase font-bold">Sem tamanhos</span>
                          )}
                          {sizes.map(s => {
                            const disabled = s.stock <= 0;
                            const active = chosenSize === s.name;
                            return (
                              <button
                                key={s.name}
                                disabled={disabled}
                                onClick={() => setSize(c.id, s.name)}
                                className={`px-2.5 py-1 rounded-md border text-[10px] font-black uppercase transition-all touch-manipulation ${
                                  active
                                    ? 'bg-white text-zinc-950 border-white shadow-[0_0_8px_rgba(255,255,255,0.2)]'
                                    : disabled
                                      ? 'bg-zinc-950 text-zinc-700 border-white/5 opacity-40 cursor-not-allowed'
                                      : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:border-zinc-500'
                                }`}
                              >
                                {s.name}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                    {!included && (
                      <button
                        onClick={() => togglePick(c.id)}
                        className="mt-2 text-[9px] font-black text-zinc-500 uppercase tracking-widest hover:text-zinc-300 transition-colors touch-manipulation"
                      >
                        + Adicionar ao kit
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          </div>
        </div>

        {/* RODAPÉ TOTAL + CTA */}
        <div className="px-6 pt-3 pb-5 border-t border-white/10 bg-zinc-950 shrink-0">
          <div className="flex items-end justify-between mb-3">
            <div>
              <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Total do Kit</p>
              <p className="text-2xl font-black text-white tracking-tighter">{formatBRL(total)}</p>
              {includedItems.length < components.length && sumOriginal > total && (
                <p className="text-[9px] text-zinc-600 line-through font-bold">{formatBRL(sumOriginal)} completo</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Peças</p>
              <p className="text-lg font-black text-amber-400">{includedItems.length}</p>
            </div>
          </div>
          <button
            onClick={handleAddKitToCart}
            disabled={includedItems.length === 0}
            className={`w-full py-5 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 touch-manipulation ${includedItems.length === 0 ? 'bg-zinc-900 text-zinc-700' : 'bg-gradient-to-r from-amber-400 via-orange-500 to-pink-500 text-zinc-950 shadow-[0_10px_30px_rgba(251,146,60,0.35)] active:scale-[0.98]'}`}
          >
            <ShoppingBag size={14}/> Adicionar Kit à Sacola
          </button>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 4. APLICATIVO PRINCIPAL (ROOT COMPONENT)
// ==========================================
function App() {
  const prefersReducedMotion = useReducedMotion();
  // ======= PRODUTOS: agora vivem no Supabase =======
  const PRODUCTS_CACHE_KEY = '@fluxo:products-cache-v1';
  const PRODUCTS_CACHE_TTL = 60_000; // 1 min

  const [productsRaw, setProductsRaw] = useState(() => {
    try {
      const cached = JSON.parse(localStorage.getItem(PRODUCTS_CACHE_KEY) || 'null');
      if (cached && Date.now() - cached.ts < PRODUCTS_CACHE_TTL && Array.isArray(cached.data) && cached.data.length > 0) return cached.data;
    } catch {}
    return DEFAULT_PRODUCTS;
  });
  const [productsLoaded, setProductsLoaded] = useState(false);
  const productsRef = useRef(DEFAULT_PRODUCTS);
  useEffect(() => { productsRef.current = productsRaw; }, [productsRaw]);

  // Carrega produtos do Supabase + polling reduzido para 60s (era 5s)
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const remote = await fetchProducts();
        if (alive && Array.isArray(remote) && remote.length > 0) {
          setProductsRaw(remote);
          try { localStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: remote })); } catch {}
        }
      } catch (e) { console.warn('[products] fetch falhou:', e?.message); }
      finally { if (alive) setProductsLoaded(true); }
    };
    load();
    const t = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  // ======= KITS: relação kit_id -> [product_id] =======
  const [kitItemsByKit, setKitItemsByKit] = useState({});
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const rows = await fetchAllKitItems();
        if (!alive) return;
        const map = {};
        rows.forEach(r => {
          if (!map[r.kit_id]) map[r.kit_id] = [];
          map[r.kit_id].push(r.product_id);
        });
        setKitItemsByKit(map);
      } catch (e) { /* tabela pode não existir ainda */ }
    };
    load();
    const t = setInterval(load, 120_000); // era 10s → 2 min
    return () => { alive = false; clearInterval(t); };
  }, []);

  // Wrapper: ao mudar produtos local, sincroniza com Supabase (diff: upsert/delete)
  const setProducts = (updater) => {
    setProductsRaw((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try {
        const prevIds = new Set((prev || []).map(p => p.id));
        const nextIds = new Set((next || []).map(p => p.id));
        // upserts: produtos que mudaram ou são novos
        (next || []).forEach(p => {
          const old = (prev || []).find(o => o.id === p.id);
          if (!old || JSON.stringify(old) !== JSON.stringify(p)) {
            upsertProduct(p).catch(err => console.warn('[products] upsert falhou:', err?.message));
          }
        });
        // deletes
        (prev || []).forEach(p => { if (!nextIds.has(p.id)) deleteProduct(p.id).catch(err => console.warn('[products] delete falhou:', err?.message)); });
      } catch (e) { console.warn('[products] sync falhou:', e?.message); }
      return next;
    });
  };
  const products = productsRaw;

  const CONFIG_CACHE_KEY = '@fluxo:config-cache-v1';
  const CONFIG_CACHE_TTL = 300_000; // 5 min

  const [config, setConfigState] = useState(() => {
    try {
      const cached = JSON.parse(localStorage.getItem(CONFIG_CACHE_KEY) || 'null');
      if (cached && Date.now() - cached.ts < CONFIG_CACHE_TTL && cached.data) return { ...SITE_DEFAULT_CONFIG, ...cached.data };
    } catch {}
    return SITE_DEFAULT_CONFIG;
  });
  // Carrega config do Supabase + polling reduzido para 5 min (era 10s)
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const remote = await fetchSiteConfig();
        if (alive && remote) {
          setConfigState(remote);
          try { localStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: remote })); } catch {}
        }
      } catch (e) { console.warn('[config] fetch falhou:', e?.message); }
    };
    load();
    const t = setInterval(load, 300_000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  // Wrapper: ao alterar config local, envia upsert pro Supabase (requer admin logado)
  const setConfig = (updater) => {
    setConfigState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try {
        upsertSiteConfig(next).catch((e) => console.warn('[config] upsert falhou:', e?.message));
      } catch (e) { /* silencioso */ }
      return next;
    });
  };

  // ======= PEDIDOS (LEADS): agora vivem no Supabase =======
  const [leads, setLeadsState] = useState([]);
  const [leadsLoaded, setLeadsLoaded] = useState(false);
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const seenOrderIdsRef = useRef(null); // Set dos IDs já vistos
  const isAdminRef = useRef(false);
  // Mapeia row do Supabase -> shape interno usado pelo painel
  // Schema real: { id, order_number, name, phone, items (jsonb|string), value, status, created_at }
  const mapOrderRow = (row) => {
    let parsedItems = row.items;
    if (typeof parsedItems === 'string') {
      try { parsedItems = JSON.parse(parsedItems); } catch (e) { parsedItems = []; }
    }
    const items = Array.isArray(parsedItems) ? parsedItems.map(it => ({
      ...it,
      quantity: Number(it.qty ?? it.quantity ?? 1),
    })) : [];
    const statusRaw = String(row.status || 'NOVO').toUpperCase();
    const statusMap = {
      'NOVO': 'NOVO',
      'PENDING': 'NOVO',
      'EM ATENDIMENTO': 'EM ATENDIMENTO',
      'CONFIRMED': 'CONCLUÍDO',
      'CONCLUÍDO': 'CONCLUÍDO',
      'CONCLUIDO': 'CONCLUÍDO',
      'CANCELLED': 'CANCELADO',
      'CANCELADO': 'CANCELADO',
    };
    return {
      id: row.id,
      orderNumber: row.order_number || String(row.id).slice(0, 5),
      name: row.name || '',
      phone: row.phone || '',
      address: '',
      date: row.created_at ? new Date(row.created_at).toLocaleString('pt-BR') : '',
      value: Number(row.value || 0),
      items,
      status: statusMap[statusRaw] || 'NOVO',
      _raw: row,
    };
  };
  const setLeads = setLeadsState; // mantém compat

  // Toca som de notificação (beep sintetizado — sem asset externo)
  const playNotifySound = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      [0, 0.18].forEach((delay) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now + delay);
        osc.frequency.exponentialRampToValueAtTime(1320, now + delay + 0.12);
        gain.gain.setValueAtTime(0.0001, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.35, now + delay + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.16);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + delay);
        osc.stop(now + delay + 0.18);
      });
      setTimeout(() => ctx.close().catch(() => {}), 1200);
    } catch (e) { /* silencioso */ }
  };

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const rows = await fetchOrders();
        if (!alive) return;
        const mapped = rows.map(mapOrderRow);
        setLeadsState(mapped);
        setLeadsLoaded(true);

        // Detecta pedidos novos (depois da 1a carga)
        const currentIds = new Set(mapped.map(o => o.id));
        if (seenOrderIdsRef.current === null) {
          seenOrderIdsRef.current = currentIds;
        } else {
          const newOnes = mapped.filter(o => !seenOrderIdsRef.current.has(o.id) && o.status === 'NOVO');
          if (newOnes.length > 0) {
            seenOrderIdsRef.current = currentIds;
            // Só notifica se for admin logado
            if (isAdminRef.current) {
              setNewOrdersCount((prev) => prev + newOnes.length);
              playNotifySound();
              try {
                if ('Notification' in window && Notification.permission === 'granted') {
                  const last = newOnes[0];
                  new Notification('🔔 Novo pedido', {
                    body: `${last.name} — R$ ${last.value.toFixed(2)}`,
                    tag: `order-${last.id}`,
                  });
                }
              } catch (e) {}
            }
          } else {
            seenOrderIdsRef.current = currentIds;
          }
        }
      } catch (e) { console.warn('[orders] fetch falhou:', e?.message); }
    };
    load();
    // Polling de 30s (era 5s) — só o admin precisa de atualização frequente
    const t = setInterval(load, 30_000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  // Carrinho persistido no localStorage (sobrevive a recarregar/voltar a página).
  const CART_STORAGE_KEY = '@fluxo:cart-v1';
  const [cart, setCart] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || 'null');
      return Array.isArray(saved) ? saved : [];
    } catch { return []; }
  });
  useEffect(() => {
    try { localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart || [])); } catch {}
  }, [cart]);

  const [cartBounce, setCartBounce] = useState(false);

  // --- AUTH Supabase ---
  const [isAdmin, setIsAdmin] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Sincroniza sessão inicial + escuta mudanças
  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      const logged = !!data?.session?.user;
      setIsAdmin(logged);
      isAdminRef.current = logged;
      setAuthReady(true);
    }).catch(() => setAuthReady(true));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const logged = !!session?.user;
      setIsAdmin(logged);
      isAdminRef.current = logged;
    });
    return () => { alive = false; sub?.subscription?.unsubscribe?.(); };
  }, []);

  // Lê filtros iniciais da URL (?tamanho=GG&categoria=VESTUÁRIO&sub=CAMISETAS&busca=...)
  const _initialUrlFilters = (() => {
    if (typeof window === 'undefined') return {};
    const sp = new URLSearchParams(window.location.search);
    return {
      categoria: (sp.get('categoria') || 'TODOS').toUpperCase(),
      sub: (sp.get('sub') || 'TODOS').toUpperCase(),
      tamanho: (sp.get('tamanho') || 'TODOS').toUpperCase(),
      busca: sp.get('busca') || '',
      kits: sp.get('kits') === '1',
      colecao: sp.get('colecao') || null,
    };
  })();
  const [selectedCategory, setSelectedCategory] = useState(_initialUrlFilters.categoria || 'TODOS');
  const [selectedSubcategory, setSelectedSubcategory] = useState(_initialUrlFilters.sub || 'TODOS');
  const [searchQuery, setSearchQuery] = useState(_initialUrlFilters.busca || '');
  const [selectedSize, setSelectedSize] = useState(_initialUrlFilters.tamanho || 'TODOS');
  const [selectedColor, setSelectedColor] = useState('TODOS');
  const [priceRange, setPriceRange] = useState('TODOS');
  const [kitsOnly, setKitsOnly] = useState(!!_initialUrlFilters.kits);
   const [currentPage, setCurrentPage] = useState(() => {
    // Restaura a página a partir do path /paginaN (preferido) ou /pagina/N (fallback legado),
    // depois ?page=N (legado) ou sessionStorage.
    if (typeof window === 'undefined') return 1;
    const path = window.location.pathname;
    // 1) Formato preferido: /paginaN  (ex: /pagina2, /pagina3)
    let m = path.match(/\/pagina(\d+)(?:\/)?$/i);
    // 2) Fallback: /pagina/N  (ex: /pagina/2)
    if (!m) m = path.match(/\/pagina\/(\d+)(?:\/)?$/i);
    if (m) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n > 0) return n;
    }
    const sp = new URLSearchParams(window.location.search);
    const fromUrl = parseInt(sp.get('page') || '', 10);
    if (Number.isFinite(fromUrl) && fromUrl > 0) return fromUrl;
    try {
      const fromStore = parseInt(sessionStorage.getItem('catalog:page') || '', 10);
      if (Number.isFinite(fromStore) && fromStore > 0) return fromStore;
    } catch {}
    return 1;
  });
  const PRODUCTS_PER_PAGE = 20;
  const [showMyOrders, setShowMyOrders] = useState(false);
  const [myOrdersPhone, setMyOrdersPhone] = useState('');
  const [myOrdersResults, setMyOrdersResults] = useState(null);
  const [myOrdersLoading, setMyOrdersLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedSizes, setSelectedSizes] = useState({});
  // Captura ?produto= no mount para deeplink — lido antes de qualquer efeito de sync apagar o param
  const initialUrlProduto = useRef(
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('produto') : null
  );
  const [activeProductImage, setActiveProductImage] = useState(null);
  useEffect(() => {
    if (selectedProduct && !selectedProduct.is_kit) {
      setActiveProductImage(selectedProduct.image);
    }
  }, [selectedProduct]);
  const [zoomImage, setZoomImage] = useState(null);
  const [showCart, setShowCart] = useState(false);
  const [isCartModalOpen, setIsCartModalOpen] = useState(false);
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [productImageFile, setProductImageFile] = useState(null);
  const [bannerImageFile, setBannerImageFile] = useState(null);
  const [currentLead, setCurrentLead] = useState({ name: '', phone: '' });

  // ── Perfil do usuário (localStorage) ──
  const [userProfile, setUserProfileState] = useState(() => {
    try {
      const raw = localStorage.getItem('@fluxo-outlet:user-profile');
      if (!raw) return null;
      const profile = JSON.parse(raw);
      // Garante que perfis antigos (sem id) recebem um UUID persistente
      if (profile && !profile.id) {
        profile.id = crypto.randomUUID();
        try { localStorage.setItem('@fluxo-outlet:user-profile', JSON.stringify(profile)); } catch {}
      }
      return profile;
    } catch { return null; }
  });
  const saveUserProfile = (data) => {
    const profile = { ...data, id: data.id || crypto.randomUUID(), createdAt: data.createdAt || new Date().toISOString() };
    try { localStorage.setItem('@fluxo-outlet:user-profile', JSON.stringify(profile)); } catch {}
    setUserProfileState(profile);
  };
  const clearUserProfile = () => {
    try { localStorage.removeItem('@fluxo-outlet:user-profile'); } catch {}
    setUserProfileState(null);
  };

  // Pré-preenche checkout quando perfil existe
  useEffect(() => {
    if (userProfile?.name && userProfile?.phone) {
      setCurrentLead({ name: userProfile.name, phone: userProfile.phone });
      setKnownLead(userProfile.phone, userProfile.name); // cliente reconhecido → sinais já identificados
    }
  }, [userProfile]);

  // ── Drawer de usuário ──
  const [showQuickMenu, setShowQuickMenu] = useState(false);
  const [noveltyMode, setNoveltyMode] = useState(false);
  const [showSizeFilter, setShowSizeFilter] = useState(false);
  const [expandedSizeCategory, setExpandedSizeCategory] = useState(null);
  const [showUserDrawer, setShowUserDrawer] = useState(false);
  const [drawerTab, setDrawerTab] = useState('profile');
  const [profileForm, setProfileForm] = useState({ name: '', phone: '' });

  // ── Avaliações ──
  const [ratingsMap, setRatingsMap] = useState({});

  const [toast, setToast] = useState(null);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [whatsappLink, setWhatsappLink] = useState('');
  const [checkoutOrderNumber, setCheckoutOrderNumber] = useState('');
  const featuredRailRef = useRef(null);
  const featuredPeekedRef = useRef(false);
  const [activeCollectionFilter, setActiveCollectionFilter] = useState(_initialUrlFilters.colecao || null);
  const [adminTab, setAdminTab] = useState('dashboard'); 
  const visualFrame = useVisualViewportFrame();
  const viewportOverlayStyle = { top: visualFrame.top, height: visualFrame.height || '100dvh' };
  const viewportPanelMaxHeight = visualFrame.height ? `calc(${visualFrame.height}px - 10px)` : 'calc(100dvh - 10px)';

  // Card de produto (não-kit) aberto: vira página em fluxo no mobile.
  const productPageOpen = !!(selectedProduct && !selectedProduct.is_kit);
  // Enquanto aberto, o DOCUMENTO passa a rolar (URL recolhe) e a loja some no mobile.
  useEffect(() => {
    if (!productPageOpen) return;
    document.documentElement.classList.add('product-scroll');
    window.scrollTo(0, 0);
    return () => document.documentElement.classList.remove('product-scroll');
  }, [productPageOpen]);
  // Troca de produto (relacionados) com a página aberta: volta ao topo.
  useEffect(() => {
    if (productPageOpen) window.scrollTo(0, 0);
  }, [selectedProduct?.id, productPageOpen]);

  // Announcement bar: rotate phrases with fade
  const [marqueeIdx, setMarqueeIdx] = useState(0);
  useEffect(() => {
    const phrases = config.marqueePhrases || [];
    if (phrases.length <= 1) { setMarqueeIdx(0); return; }
    const t = setInterval(() => setMarqueeIdx(i => (i + 1) % phrases.length), 3500);
    return () => clearInterval(t);
  }, [config.marqueePhrases]);

  // Referência para o clique duplo
  const lastTapRef = useRef(0);
  useEffect(() => {
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
    } else {
      const meta = document.createElement('meta');
      meta.name = 'viewport';
      meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
      document.head.appendChild(meta);
    }
    // Inicializa Meta Pixel + dispara PageView (com dedup via CAPI)
    try { initMetaPixel(); } catch (e) { console.warn('[pixel] init err', e); }
  }, []);

  // products + leads + banners + config vivem no Supabase.
  // localStorage removido para evitar divergência entre dispositivos.
  // config agora vive no Supabase; nada pra persistir localmente

  // Detecta desktop (>=1024px) p/ separar banners por dispositivo
  const [isDesktopViewport, setIsDesktopViewport] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(min-width: 1024px)').matches : false
  );
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = (e) => setIsDesktopViewport(e.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  // Banners: dados + sync com Supabase + derivados (activeBanners por dispositivo,
  // availableCollections) no hook. O carrossel e seu comportamento (slide, scroll,
  // auto-avanço, indicador) vivem no componente <BannerCarousel/>.
  const { banners, setBanners, bannersLoaded, activeBanners, midBanner, availableCollections } = useBanners(isDesktopViewport);


  // Auto-peek na vitrine de destaques: quando a seção entra no viewport, revela levemente os próximos cards
  useEffect(() => {
    const rail = featuredRailRef.current;
    if (!rail) return;
    featuredPeekedRef.current = false;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !featuredPeekedRef.current && rail.scrollWidth > rail.clientWidth) {
        featuredPeekedRef.current = true;
        observer.disconnect();
        setTimeout(() => {
          rail.scrollTo({ left: 110, behavior: 'smooth' });
          setTimeout(() => rail.scrollTo({ left: 0, behavior: 'smooth' }), 950);
        }, 650);
      }
    }, { threshold: 0.5 });
    observer.observe(rail);
    return () => observer.disconnect();
  }, [productsLoaded]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSecretDoubleTap = async (e) => {
    e.preventDefault();
    const now = Date.now();
    if (now - lastTapRef.current < 400) {
      // Se a sessão ainda está sendo restaurada do storage, espera —
      // evita pedir login quando o usuário já está autenticado.
      if (!authReady) {
        showToast('Verificando sessão...', 'success');
        return;
      }
      // Se voltou para a loja sem deslogar, o estado visual fica como cliente,
      // mas a sessão continua salva. Revalida antes de pedir senha.
      if (isAdmin) return;
      try {
        const { data } = await supabase.auth.getSession();
        const logged = !!data?.session?.user;
        if (logged) {
          setIsAdmin(true);
          isAdminRef.current = true;
          setShowAdminLogin(false);
          return;
        }
      } catch (err) {
        console.warn('[auth] restauração da sessão falhou:', err?.message);
      }
      setShowAdminLogin(true);
    }
    lastTapRef.current = now;
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (loginLoading) return;
    setLoginLoading(true);
    try {
      const email = String(loginUser || '').trim();
      const password = String(loginPass || '');
      if (!email || !password) { showToast('Preencha email e senha.', 'error'); return; }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setShowAdminLogin(false);
      setLoginUser('');
      setLoginPass('');
      showToast('Acesso Concedido!', 'success');
      try {
        if ('Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission().catch(() => {});
        }
      } catch (e) {}
    } catch (err) {
      console.error('[auth] login falhou:', err);
      const msg = /Invalid login credentials/i.test(err?.message || '') ? 'Credenciais inválidas.' : 'Erro no login: ' + (err?.message || 'tente novamente');
      showToast(msg, 'error');
    } finally {
      setLoginLoading(false);
    }
  };

  // "Loja": volta para a aba do cliente sem encerrar a sessão admin.
  // Ao clicar 2x no cadeado depois, entra direto sem pedir senha.
  const handleBackToStore = () => {
    setIsAdmin(false);
  };

  // "Sair": encerra a sessão de verdade no Supabase (próximo acesso pedirá login).
  const handleLogout = async () => {
    try { await supabase.auth.signOut(); } catch (e) {}
    setIsAdmin(false);
  };

  const categories = useMemo(() => ['TODOS', ...new Set((products || []).filter(p => !p.is_kit).map(p => p.category))], [products]);
  const subtotal = useMemo(() => (cart || []).reduce((acc, item) => acc + (item.price * item.quantity), 0), [cart]);

  // Oferta do Dia: ao expirar um relógio, este state muda e re-renderiza a loja toda,
  // recalculando preço/visibilidade (isOfferLive) de cada produto na hora certa.
  const [offerExpiryBump, setOfferExpiryBump] = useState(0);
  const bumpOffers = () => setOfferExpiryBump(v => v + 1);

  // Garantia CENTRAL de expiração: agenda um re-render no instante EXATO em que a
  // próxima oferta viva morre — não depende do timer de cada card (que pode não
  // disparar com aba em 2º plano ou card fora da tela). Reagenda a cada expiração.
  useEffect(() => {
    const live = (products || []).filter(p => isOfferLive(p));
    if (live.length === 0) return;
    const now = Date.now();
    const nextEnd = live
      .map(p => offerEndsAt(p)?.getTime())
      .filter(t => typeof t === 'number' && t > now)
      .sort((a, b) => a - b)[0];
    if (!nextEnd) return;
    // +250ms de folga; teto de 1h (offers distantes só precisam de precisão perto do fim).
    const delay = Math.min(nextEnd - now + 250, 60 * 60 * 1000);
    const id = setTimeout(bumpOffers, delay);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, offerExpiryBump]);

  // Pix 5% NÃO incide sobre itens em oferta. Calcula só a base elegível.
  const pixBaseSubtotal = useMemo(
    () => (cart || []).filter(i => !i.offer_applied).reduce((acc, i) => acc + (i.price * i.quantity), 0),
    [cart]
  );
  const pixDiscount = useMemo(() => pixBaseSubtotal * 0.05, [pixBaseSubtotal]);
  const totalComPix = useMemo(() => subtotal - pixDiscount, [subtotal, pixDiscount]);
  const hasOfferInCart = useMemo(() => (cart || []).some(i => i.offer_applied), [cart]);

  const handleProductClick = (product) => {
    if (!product) return;
    // Kits podem ser abertos mesmo sem estoque próprio (estoque vem dos componentes)
    if (!product.is_kit && product.stock <= 0) return;
    setSelectedProduct(product);
    setSelectedSizes({});
    emitSignal('produto_visto', { product }); // sinal: lead olhou esta peça
  };

  const handleSizeSelect = (sizeName, maxStock) => {
    setSelectedSizes(prev => {
      const currentQty = prev[sizeName] || 0;
      const itemKey = `${selectedProduct?.id}-${sizeName || 'U'}`;
      const qtyInCart = (cart || []).find(i => i.itemKey === itemKey)?.quantity || 0;
      if (currentQty + qtyInCart >= maxStock) { showToast(`Estoque máximo!`, 'error'); return prev; }
      return { ...prev, [sizeName]: currentQty + 1 };
    });
  };

  const handleCommitToCart = () => {
    if (!selectedProduct) return;
    const entries = Object.entries(selectedSizes || {}).filter(([, qty]) => Number(qty) > 0);
    if (entries.length === 0) {
      showToast('Escolha um tamanho primeiro.', 'error');
      return;
    }

    let updatedCart = [...cart];
    entries.forEach(([sizeName, qty]) => {
      const quantity = Number(qty) || 1;
      emitSignal('carrinho_add', { product: selectedProduct, size: sizeName || 'U', qty: quantity }); // sinal com detalhe (cor/tam/marca)
      const itemKey = `${selectedProduct.id}-${sizeName || 'U'}`;
      const existingIdx = updatedCart.findIndex(item => item.itemKey === itemKey);
      if (existingIdx >= 0) {
        updatedCart[existingIdx] = {
          ...updatedCart[existingIdx],
          quantity: updatedCart[existingIdx].quantity + quantity,
        };
      } else {
        const live = isOfferLive(selectedProduct);
        updatedCart.push({
          ...selectedProduct,
          price: live ? offerPrice(selectedProduct) : selectedProduct.price,
          offer_applied: live,
          size: sizeName || 'U',
          quantity,
          itemKey,
        });
      }
    });
    
    setCart(updatedCart);
    setCartBounce(true);
    setTimeout(() => setCartBounce(false), 400);
    setIsCartModalOpen(true);
    showToast('Adicionado à sacola ✓');
    // 🟣 AddToCart (Pixel + CAPI com mesmo event_id)
    try {
      const addedValue = entries.reduce((acc, [, qty]) => acc + (Number(selectedProduct.price || 0) * Number(qty || 0)), 0);
      const addedQty   = entries.reduce((acc, [, qty]) => acc + Number(qty || 0), 0);
      const event_id = createMetaEventId();
      trackPixel('AddToCart', {
        event_id,
        value: addedValue,
        currency: 'BRL',
        content_name: selectedProduct.name,
        content_ids: [String(selectedProduct.sku || selectedProduct.id)],
        content_type: 'product',
        contents: [{ id: String(selectedProduct.sku || selectedProduct.id), quantity: addedQty, item_price: Number(selectedProduct.price || 0) }],
      });
    } catch (e) { /* ignore */ }
    setSelectedProduct(null);
    setSelectedSizes({});
  };

  const handleFinalize = async () => {
    try {
      setIsLoading(true);

      // Validação básica
      const customerName = String(currentLead?.name ?? '').trim();
      const customerPhone = String(currentLead?.phone ?? '').replace(/\D/g, '');
      setKnownLead(customerPhone, customerName); // identifica o lead p/ os sinais
      if (!customerName) { showToast('Informe seu nome.', 'error'); setIsLoading(false); return; }
      if (customerPhone.length < 10) { showToast('Informe um WhatsApp válido com DDD.', 'error'); setIsLoading(false); return; }
      if (!cart || cart.length === 0) { showToast('Carrinho vazio.', 'error'); setIsLoading(false); return; }

      const orderNum = String(Math.floor(10000 + Math.random() * 90000));
      const totalPedido = Number(subtotal) || 0;
      const itensNormalizados = (cart || []).map((item) => ({
        id: Number(item?.id) || 0,
        name: String(item?.name ?? ''),
        sku: String(item?.sku ?? ''),
        size: String(item?.size ?? ''),
        price: Number(item?.price) || 0,
        qty: Number(item?.quantity) || 0,
        image: String(item?.image ?? '')
      }));

      // Schema real da tabela: order_number | name | phone | items (jsonb) | value | status
      const payload = {
        order_number: orderNum,
        name: customerName,
        phone: customerPhone,
        items: itensNormalizados,
        value: totalPedido,
        status: 'NOVO',
      };

      console.log('[checkout] enviando pedido:', payload);

      const { data: newOrder, error } = await supabase.from('orders').insert([payload]).select().single();
      if (error) throw new Error(error.message);

      // Fire-and-forget: registra no CRM sem bloquear o checkout
      criarAtendimentoFromPedido({ ...payload, id: newOrder.id }).catch((e) => console.warn('[CRM]', e));

      // Monta mensagem WhatsApp
      const itemsText = itensNormalizados
        .map((item) => {
          const prodOriginal = products.find(p => p.id === item.id);
          const categoria = prodOriginal?.category || '';
          const subcategoria = prodOriginal?.subcategory || '';
          const subLine = subcategoria ? ` | Sub: ${subcategoria}` : '';
          return `• ${item.name}\n  SKU: ${item.sku} | Tam: ${item.size}${subLine} | Cat: ${categoria}\n  Qtd: ${item.qty}x | R$ ${item.price.toFixed(2)}`;
        })
        .join('\n\n');
      const message = [
        `🛍️ NOVO PEDIDO — ${config.brandName}`,
        ``,
        `📋 Pedido: #${orderNum}`,
        ``,
        `👤 Cliente: ${customerName}`,
        `📱 WhatsApp: ${customerPhone}`,
        ``,
        `🧾 ITENS DO PEDIDO:`,
        itemsText,
        ``,
        `💰 Total: R$ ${totalPedido.toFixed(2)}`,
        ``,
        `⚡ Enviado via ${config.brandName}`,
      ].join('\n');

      // Usa whatsapp do config (fallback pro hardcoded caso vazio)
      const waNumber = String(config?.whatsapp || '5534984148067').replace(/\D/g, '');
      const whatsappUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`;

      // 🟣 AddToCart no clique de finalizar/WhatsApp (Pixel + CAPI com mesmo event_id)
      const addToCartEventId = createMetaEventId();
      trackPixel('AddToCart', {
        event_id: addToCartEventId,
        value: totalPedido,
        currency: 'BRL',
        phone: customerPhone,
        content_ids: itensNormalizados.map(i => String(i.sku || i.id)),
        content_type: 'product',
        contents: itensNormalizados.map(i => ({ id: String(i.sku || i.id), quantity: i.qty, item_price: i.price })),
      });

      // 🟣 InitiateCheckout (gatilho híbrido — Pixel + CAPI com mesmo event_id)
      const checkoutEventId = createMetaEventId();
      trackPixel('InitiateCheckout', {
        event_id: checkoutEventId,
        value: totalPedido,
        currency: 'BRL',
        phone: customerPhone,
        content_ids: itensNormalizados.map(i => String(i.sku || i.id)),
        content_type: 'product',
        contents: itensNormalizados.map(i => ({ id: String(i.sku || i.id), quantity: i.qty, item_price: i.price })),
      });

      // ⚠️ P17: Purchase NÃO é mais disparado aqui (checkout do cliente).
      // O Purchase real (deduplicável e idempotente) sai SOMENTE na confirmação
      // da venda no admin (updateLeadStatus → CONCLUÍDO). Isso elimina a
      // inflação de eventos na Meta. AddToCart e InitiateCheckout acima ficam.

      setWhatsappLink(whatsappUrl);
      setCheckoutOrderNumber(orderNum);
      setCheckoutSuccess(true);   // Mostra tela de sucesso
      setCart([]);
      showToast('Pedido registrado!', 'success');

      // Pequeno delay garante que o beacon do Pixel saia antes da nova aba
      await new Promise((r) => setTimeout(r, 250));

      // Abre WhatsApp em nova aba (não quebra se o popup for bloqueado)
      try { window.open(whatsappUrl, '_blank'); } catch (e) { /* ignora */ }
    } catch (error) {
      console.error('[checkout] erro:', error);
      showToast('Erro ao enviar pedido: ' + (error?.message || 'tente novamente'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const searchIntent = useMemo(() => parseQueryIntent(searchQuery), [searchQuery]);
  const searchActive = hasActiveQuery(searchIntent);

  const filteredProducts = useMemo(() => {
    const base = (products || []).filter(p => {
      if (p.is_active === false) return false;
      if (kitsOnly) {
        if (!p.is_kit) return false;
        return productMatchesIntent(p, searchIntent);
      }
      if (p.is_kit) return false;
      if (p.stock <= 0) return false;
      const matchesCat = selectedCategory === 'TODOS' || p.category === selectedCategory;
      const matchesSub = selectedSubcategory === 'TODOS' || (p.subcategory || '').toUpperCase() === selectedSubcategory;
      const matchesSearch = productMatchesIntent(p, searchIntent);
      const sizeNorm = String(selectedSize || '').trim().toUpperCase();
      const matchesSize = sizeNorm === 'TODOS' || (Array.isArray(p.sizes) && p.sizes.some(s => {
        const sName = String((typeof s === 'string' ? s : s.size) || '').trim().toUpperCase();
        const sStock = typeof s === 'string' ? (p.stock || 0) : Number(s.stock || 0);
        return sName === sizeNorm && sStock > 0;
      }));
      const matchesCollection = !activeCollectionFilter || p.collection_name === activeCollectionFilter;
      const matchesColor = selectedColor === 'TODOS'
        || String(p.color || '').toLowerCase() === selectedColor
        || (Array.isArray(p.secondary_colors) && p.secondary_colors.some(c => String(c || '').toLowerCase() === selectedColor));
      let matchesPrice = true;
      if (priceRange !== 'TODOS') {
        const r = PRICE_RANGES.find(x => x.key === priceRange);
        if (r) {
          const eff = isOfferLive(p) ? offerPrice(p) : ((p.promotional_price > 0 && p.promotional_price < p.price) ? p.promotional_price : (p.price || 0));
          if (r.min != null && eff < r.min) matchesPrice = false;
          if (r.max != null && eff > r.max) matchesPrice = false;
        }
      }
      return matchesCat && matchesSub && matchesSearch && matchesSize && matchesCollection && matchesColor && matchesPrice;
    });
    if (!noveltyMode) return base;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recent = base.filter(p => p.created_at && new Date(p.created_at) > thirtyDaysAgo);
    if (recent.length > 0) return recent;
    return [...base].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)).slice(0, 8);
  }, [noveltyMode, kitsOnly, selectedCategory, selectedSubcategory, searchIntent, selectedSize, selectedColor, priceRange, products, activeCollectionFilter]);

  // Subcategorias disponíveis dentro da categoria atual (ignora produtos sem estoque)
  const availableSubcategories = useMemo(() => {
    const set = new Set();
    (products || []).forEach(p => {
      if (p.stock <= 0) return;
      if (selectedCategory !== 'TODOS' && p.category !== selectedCategory) return;
      if (activeCollectionFilter && p.collection_name !== activeCollectionFilter) return;
      const sub = (p.subcategory || '').toString().trim().toUpperCase();
      if (sub) set.add(sub);
    });
    return ['TODOS', ...Array.from(set)];
  }, [products, selectedCategory, activeCollectionFilter]);

  const _subValidated = React.useRef(false);
  useEffect(() => {
    if (!products || products.length === 0) return;
    // Só valida depois que availableSubcategories tiver dados reais
    if (availableSubcategories.length <= 1) return; // só tem 'TODOS' = ainda carregando
    if (!_subValidated.current) {
      _subValidated.current = true;
      // Sub da URL está disponível — mantém, não reseta
      if (selectedSubcategory !== 'TODOS' && availableSubcategories.includes(selectedSubcategory)) return;
    }
    if (selectedSubcategory !== 'TODOS' && !availableSubcategories.includes(selectedSubcategory)) {
      setSelectedSubcategory('TODOS');
    }
  }, [availableSubcategories, selectedSubcategory, products]);

  // Ao trocar de categoria, sempre limpa a subcategoria — exceto no primeiro render
  // (preserva ?sub=... da URL).
  const _isFirstCategoryChange = React.useRef(true);
  useEffect(() => {
    if (_isFirstCategoryChange.current) { _isFirstCategoryChange.current = false; return; }
    setSelectedSubcategory('TODOS');
    // Limpa refinamentos de cor/preço ao trocar de categoria (some os chips no home).
    setSelectedColor('TODOS');
    setPriceRange('TODOS');
  }, [selectedCategory]);

  // Sincroniza filtros com a URL (query params) sem recarregar a página.
  // Usa history.replaceState para não poluir o histórico e debounce na busca.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handle = setTimeout(() => {
      try {
        const url = new URL(window.location.href);
        const sp = url.searchParams;
        const setOrDel = (k, v, def) => {
          if (v && v !== def) sp.set(k, v); else sp.delete(k);
        };
        setOrDel('categoria', selectedCategory, 'TODOS');
        setOrDel('sub', selectedSubcategory, 'TODOS');
        setOrDel('tamanho', selectedSize, 'TODOS');
        setOrDel('busca', (searchQuery || '').trim(), '');
        setOrDel('kits', kitsOnly ? '1' : '', '');
        setOrDel('colecao', activeCollectionFilter || '', '');
        const newSearch = sp.toString();
        const newUrl = url.pathname + (newSearch ? `?${newSearch}` : '') + url.hash;
        const current = window.location.pathname + window.location.search + window.location.hash;
        // Preserva o state (mantém o marcador __anchor da navegação) ao espelhar a URL.
        if (newUrl !== current) window.history.replaceState(window.history.state, '', newUrl);
      } catch {}
    }, 200);
    return () => clearTimeout(handle);
  }, [selectedCategory, selectedSubcategory, selectedSize, searchQuery, kitsOnly, activeCollectionFilter]);

  // (O "voltar" agora é gerenciado pela ÂNCORA DE HISTÓRICO mais abaixo —
  //  fecha a camada do topo / pede confirmação de saída. A URL continua
  //  espelhada via replaceState acima só para deep-link/compartilhamento.)

  // Deep link de coleção (?colecao=X): rola direto pro catálogo já filtrado.
  const _scrolledToColecao = React.useRef(false);
  useEffect(() => {
    if (_scrolledToColecao.current || !productsLoaded || !_initialUrlFilters.colecao) return;
    _scrolledToColecao.current = true;
    setTimeout(() => document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
  }, [productsLoaded]);

  // Sincroniza produto aberto com a URL (?produto=SKU) para deep linking.
  // Não apaga o param enquanto produtos ainda não carregaram (evita destruir deeplink antes de resolver).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!productsLoaded && !selectedProduct) return;
    try {
      const url = new URL(window.location.href);
      if (selectedProduct?.sku) {
        url.searchParams.set('produto', selectedProduct.sku);
      } else {
        url.searchParams.delete('produto');
      }
      const newUrl = url.pathname + (url.search ? url.search : '') + url.hash;
      const current = window.location.pathname + window.location.search + window.location.hash;
      if (newUrl !== current) window.history.replaceState(window.history.state, '', newUrl);
    } catch {}
  }, [selectedProduct, productsLoaded]);

  // Abre produto automaticamente via deeplink (?produto=SKU).
  // Usa ref capturado no mount para não depender da URL atual (que o efeito de sync pode ter alterado).
  useEffect(() => {
    if (!productsLoaded || !(products || []).length) return;
    const sku = initialUrlProduto.current;
    if (!sku || selectedProduct) return;
    initialUrlProduto.current = null; // evita re-trigger
    const found = (products || []).find(p => (p.sku || '').toUpperCase() === sku.toUpperCase());
    if (found && (found.is_kit || (found.stock || 0) > 0)) {
      setSelectedProduct(found);
      setSelectedSizes({});
    }
  }, [productsLoaded, products]);

  const sortedProducts = useMemo(() => {
    // Com busca ativa: ordena por RELEVÂNCIA (nome exato > começa com > contém...).
    if (searchActive) {
      return [...filteredProducts]
        .map(p => ({ p, s: scoreProductForSearch(p, searchIntent) }))
        .sort((a, b) => b.s - a.s || (b.p.sales || 0) - (a.p.sales || 0))
        .map(x => x.p);
    }
    return [...filteredProducts].sort((a, b) => {
      const aMode  = ratingsMap[a.id]?.mode  || 0;
      const bMode  = ratingsMap[b.id]?.mode  || 0;
      if (bMode !== aMode) return bMode - aMode;
      const aCount = ratingsMap[a.id]?.count || 0;
      const bCount = ratingsMap[b.id]?.count || 0;
      if (bCount !== aCount) return bCount - aCount;
      const aSales = a.sales || 0;
      const bSales = b.sales || 0;
      if (bSales !== aSales) return bSales - aSales;
      return 0;
    });
  }, [filteredProducts, ratingsMap, searchActive, searchIntent]);

  const totalPages = Math.max(1, Math.ceil(sortedProducts.length / PRODUCTS_PER_PAGE));
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * PRODUCTS_PER_PAGE;
    return sortedProducts.slice(start, start + PRODUCTS_PER_PAGE);
  }, [sortedProducts, currentPage]);

  // Sempre que os filtros/busca mudarem, volta para a primeira página.
  // IMPORTANTE: não dispara no mount inicial — preserva a página vinda da URL (?page=N).
  const isFirstFilterRun = React.useRef(true);
  useEffect(() => {
    if (isFirstFilterRun.current) { isFirstFilterRun.current = false; return; }
    setCurrentPage(1);
  }, [selectedCategory, selectedSubcategory, searchQuery, selectedSize, selectedColor, priceRange, activeCollectionFilter]);
  // Se a página atual ficar fora do range (ex.: filtro reduziu lista), corrige.
  // Só corrige depois que a carga remota terminou — evita /pagina2 voltar para / na primeira renderização.
  useEffect(() => {
    if (!productsLoaded) return;
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [totalPages, currentPage, productsLoaded]);
  // Espelha a página atual na URL como /paginaN — replaceState (NÃO cria
  // entrada de histórico; o "voltar" é dono da âncora abaixo). Mantém a URL
  // compartilhável/deep-linkável; os botões de paginação na tela seguem iguais.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Remove qualquer segmento /pagina(/)?N existente do path.
    const cleanPath = window.location.pathname.replace(/\/pagina\/?\d+\/?$/i, '') || '/';
    // Remove ?page= legado também.
    const sp = new URLSearchParams(window.location.search);
    sp.delete('page');
    const qs = sp.toString();
    const base = cleanPath === '/' ? '' : cleanPath.replace(/\/$/, '');
    const newPath = currentPage <= 1 ? (cleanPath || '/') : `${base}/pagina${currentPage}`;
    const newUrl = newPath + (qs ? `?${qs}` : '') + window.location.hash;
    const fullCurrent = window.location.pathname + window.location.search + window.location.hash;
    if (newUrl !== fullCurrent) {
      window.history.replaceState(window.history.state, '', newUrl);
    }
    try { sessionStorage.setItem('catalog:page', String(currentPage)); } catch {}
  }, [currentPage]);

  // ──────────────────────────────────────────────────────────────
  // BOTÃO/GESTO "VOLTAR" DO CELULAR — NUNCA SAI DO SITE SEM QUERER.
  // Loja é página única / primeiro contato. O "voltar" do Android:
  //   1) fecha a camada aberta do topo (card, carrinho, menu, filtro/categoria);
  //   2) se NADA estiver aberto, pede confirmação ("toque de novo pra sair").
  // 'backLayers' lista as camadas fecháveis, do topo (fecha 1º) pro fundo;
  // 'closeTopRef' aponta sempre pra do topo. A âncora de histórico (abaixo)
  // garante que o "voltar" caia sempre no nosso handler.
  // ──────────────────────────────────────────────────────────────
  const filtersActive = (
    selectedCategory !== 'TODOS' ||
    (selectedSize && selectedSize !== 'TODOS') ||
    selectedColor !== 'TODOS' ||
    priceRange !== 'TODOS' ||
    kitsOnly ||
    !!activeCollectionFilter ||
    !!(searchQuery || '').trim()
  );
  // Ordem = prioridade do topo p/ o fundo (camada mais "por cima" fecha primeiro).
  const backLayers = [
    showLeadModal     && (() => { setShowLeadModal(false); setCheckoutSuccess(false); }),
    isCartModalOpen   && (() => setIsCartModalOpen(false)),
    showCart          && (() => setShowCart(false)),
    showUserDrawer    && (() => setShowUserDrawer(false)),
    showQuickMenu     && (() => setShowQuickMenu(false)),
    showAdminLogin    && (() => setShowAdminLogin(false)),
    !!selectedProduct && (() => { setSelectedProduct(null); setSelectedSizes({}); }),
    filtersActive     && (() => {
      setSelectedCategory('TODOS'); setSelectedSubcategory('TODOS'); setSelectedSize('TODOS');
      setSelectedColor('TODOS'); setPriceRange('TODOS'); setKitsOnly(false);
      setActiveCollectionFilter(null); setSearchQuery('');
    }),
  ].filter(Boolean);
  const closeTopRef = React.useRef(null);
  closeTopRef.current = backLayers[0] || null; // sempre aponta pra camada do topo atual

  // ── ÂNCORA DE HISTÓRICO ────────────────────────────────────────
  // Mantém SEMPRE 1 entrada-âncora no topo do histórico e a re-arma a cada
  // "voltar". Assim o popstate dispara aqui em vez de descarregar a página —
  // robusto no Android, sem contagem nem corrida com os syncs de URL.
  const exitArmedRef = React.useRef(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let leaving = false;
    const hasAnchor = () => !!(window.history.state && window.history.state.__anchor);
    const pushAnchor = () => { try { window.history.pushState({ __anchor: true }, ''); } catch {} };
    // Garante a âncora no topo SEM empilhar várias: os syncs de URL usam
    // replaceState preservando o state, então o marcador __anchor sobrevive e
    // este guard sabe se a âncora já existe.
    const ensureAnchor = () => { if (!hasAnchor()) pushAnchor(); };
    ensureAnchor();
    const onPop = () => {
      if (leaving) return;
      const close = closeTopRef.current;
      if (typeof close === 'function') {
        // Tem camada aberta -> fecha só o topo e continua no site.
        close();
        exitArmedRef.current = false;
        pushAnchor();
        return;
      }
      // Nada aberto -> confirma a saída ("toque de novo pra sair").
      if (exitArmedRef.current) {
        exitArmedRef.current = false;
        leaving = true;
        window.history.back(); // deixa sair de verdade
        return;
      }
      exitArmedRef.current = true;
      showToast('Toque em voltar de novo para sair', 'success');
      setTimeout(() => { exitArmedRef.current = false; }, 2500);
      pushAnchor();
    };
    // Em muitos browsers mobile / webview (WhatsApp) o pushState disparado no
    // load — sem gesto do usuário — é IGNORADO, e o 1º "voltar" fecha o site.
    // Re-garantir a âncora no 1º toque (já com gesto) e ao voltar do bfcache
    // resolve, sem empilhar entradas.
    const onGesture = () => ensureAnchor();
    const onPageShow = (e) => { if (e.persisted) { leaving = false; ensureAnchor(); } };
    window.addEventListener('popstate', onPop);
    window.addEventListener('pointerdown', onGesture, { passive: true });
    window.addEventListener('pageshow', onPageShow);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, []);

  const availableSizes = useMemo(() => {
    const set = new Set();
    (products || []).forEach(p => {
      if (p.stock <= 0) return;
      // Filtra apenas pelos produtos da categoria atualmente selecionada
      if (selectedCategory !== 'TODOS' && p.category !== selectedCategory) return;
      // Respeita também a subcategoria selecionada
      if (selectedSubcategory !== 'TODOS' && (p.subcategory || '').toUpperCase() !== selectedSubcategory) return;
      // Respeita também o filtro de coleção ativo (banner)
      if (activeCollectionFilter && p.collection_name !== activeCollectionFilter) return;
      (p.sizes || []).forEach(s => {
        const sName = String((typeof s === 'string' ? s : s.size) || '').trim().toUpperCase();
        const sStock = typeof s === 'string' ? (p.stock || 0) : Number(s.stock || 0);
        if (sName && sStock > 0) set.add(sName);
      });
    });
    return ['TODOS', ...Array.from(set)];
  }, [products, selectedCategory, selectedSubcategory, activeCollectionFilter]);

  // Cores disponíveis na categoria/sub atual (com estoque). Inclui cores secundárias.
  const availableColors = useMemo(() => {
    const set = new Set();
    (products || []).forEach(p => {
      if (p.stock <= 0 || p.is_kit) return;
      if (selectedCategory !== 'TODOS' && p.category !== selectedCategory) return;
      if (selectedSubcategory !== 'TODOS' && (p.subcategory || '').toUpperCase() !== selectedSubcategory) return;
      if (activeCollectionFilter && p.collection_name !== activeCollectionFilter) return;
      if (p.color) set.add(String(p.color).toLowerCase());
      (Array.isArray(p.secondary_colors) ? p.secondary_colors : []).forEach(c => c && set.add(String(c).toLowerCase()));
    });
    return ['TODOS', ...Array.from(set)];
  }, [products, selectedCategory, selectedSubcategory, activeCollectionFilter]);

  // Se a cor selecionada sumir da lista (troca de categoria), volta pra TODOS.
  useEffect(() => {
    if (selectedColor !== 'TODOS' && !availableColors.includes(selectedColor)) setSelectedColor('TODOS');
  }, [availableColors, selectedColor]);

  const categorySizesMap = useMemo(() => {
    const map = {};
    (products || []).forEach(p => {
      if (!p.category || p.stock <= 0 || p.is_kit) return;
      if (!map[p.category]) map[p.category] = new Set();
      (p.sizes || []).forEach(s => {
        const name = String((typeof s === 'string' ? s : s.size) || '').trim().toUpperCase();
        const stock = typeof s === 'string' ? (p.stock || 0) : Number(s.stock || 0);
        if (name && stock > 0) map[p.category].add(name);
      });
    });
    return Object.fromEntries(
      Object.entries(map).filter(([, v]) => v.size > 0).map(([k, v]) => [k, [...v]])
    );
  }, [products]);

  useEffect(() => {
    setNoveltyMode(false);
  }, [selectedCategory, selectedSubcategory, selectedSize, searchQuery, kitsOnly, activeCollectionFilter]);

  const _sizeValidated = React.useRef(false);
  useEffect(() => {
    if (!products || products.length === 0) return;
    if (availableSizes.length <= 1) return; // ainda carregando
    if (!_sizeValidated.current) {
      _sizeValidated.current = true;
      if (selectedSize !== 'TODOS' && availableSizes.includes(selectedSize)) return;
    }
    if (selectedSize !== 'TODOS' && !availableSizes.includes(selectedSize)) {
      setSelectedSize('TODOS');
    }
  }, [availableSizes, selectedSize, products]);

  // Quando a página é aberta com filtros na URL, rola até a vitrine após o catálogo carregar.
  const _didScrollToFiltered = React.useRef(false);
  useEffect(() => {
    if (_didScrollToFiltered.current) return;
    if (typeof window === 'undefined') return;
    if (!products || products.length === 0) return;
    const sp = new URLSearchParams(window.location.search);
    const hasFilter = sp.has('tamanho') || sp.has('categoria') || sp.has('sub') || sp.has('busca') || sp.has('kits');
    if (!hasFilter) return;
    _didScrollToFiltered.current = true;
    setTimeout(() => {
      document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
  }, [products]);

  const handleSearchMyOrders = async () => {
    const phone = String(myOrdersPhone || '').replace(/\D/g, '');
    if (phone.length < 10) { showToast('Digite um WhatsApp válido com DDD.', 'error'); return; }
    setMyOrdersLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('phone', phone)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setMyOrdersResults(data || []);
    } catch (e) {
      showToast('Erro ao buscar pedidos: ' + (e?.message || 'tente novamente'), 'error');
      setMyOrdersResults([]);
    } finally {
      setMyOrdersLoading(false);
    }
  };

  useEffect(() => {
    if (!products || products.length === 0) return;
    fetchRatingsBatch(products.map(p => p.id))
      .then(map => setRatingsMap(map))
      .catch(() => {});
  }, [products]);

  const handleOpenUserDrawer = () => {
    if (userProfile?.phone) {
      setDrawerTab('orders');
      setMyOrdersPhone(userProfile.phone);
      setTimeout(() => handleSearchMyOrders(), 100);
    } else {
      setDrawerTab('profile');
      setProfileForm({ name: '', phone: '' });
    }
    setShowUserDrawer(true);
  };

  const adminNavItems = [
    { key: 'dashboard', icon: <LayoutDashboard size={18}/>, label: 'Painel' },
    { key: 'inventory', icon: <Box size={18}/>, label: 'Estoque' },
    { key: 'leads', icon: <User size={18}/>, label: 'Pedidos', badge: newOrdersCount > 0 ? (newOrdersCount > 99 ? '99+' : String(newOrdersCount)) : null },
    { key: 'crm', icon: <MessageCircle size={18}/>, label: 'Atend.' },
    { key: 'growth', icon: <Flame size={18}/>, label: 'Vendas' },
    { key: 'banners', icon: <Megaphone size={18}/>, label: 'Promo' },
    { key: 'config', icon: <Settings size={18}/>, label: 'Setup' },
    { key: 'rastreio', icon: <Database size={18}/>, label: 'CAPI' },
  ];

  if (isAdmin) {
    return (
      <div className="app-shell min-h-screen bg-zinc-950 font-sans text-zinc-100 selection:bg-emerald-500 selection:text-zinc-950">
        <AdminHeader handleLogout={handleLogout} handleBackToStore={handleBackToStore} newOrdersCount={newOrdersCount} onBell={() => { setAdminTab('leads'); setNewOrdersCount(0); }} />

        <div className="lg:flex">
          {/* SIDEBAR — visível só no desktop */}
          <aside className="hidden lg:flex lg:flex-col lg:w-56 lg:shrink-0 lg:border-r lg:border-white/10 lg:sticky lg:top-20 lg:self-start" style={{ height: 'calc(100vh - 80px)', overflowY: 'auto' }}>
            <nav className="flex flex-col gap-1 p-4">
              {adminNavItems.map(item => (
                <button
                  key={item.key}
                  onClick={() => { setAdminTab(item.key); if (item.key === 'leads') setNewOrdersCount(0); }}
                  className={`flex items-center gap-3 px-4 py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all relative ${adminTab === item.key ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}
                >
                  {item.icon}
                  {item.label}
                  {item.badge && (
                    <span className="ml-auto bg-red-500 text-white text-[9px] font-black min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.6)]">
                      {item.badge}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </aside>

          {/* CONTEÚDO PRINCIPAL */}
          <main className="flex-1 max-w-[640px] mx-auto lg:max-w-none lg:mx-0 pb-24 lg:pb-8">
            <AdminTabErrorBoundary resetKey={adminTab}>
              <React.Suspense fallback={<div className="flex items-center justify-center py-20 text-zinc-600 text-[11px] font-black uppercase tracking-widest">Carregando…</div>}>
              {adminTab === 'dashboard' && <AdminDashboard leads={leads} products={products} loading={!leadsLoaded} setAdminTab={setAdminTab} />}
              {adminTab === 'inventory' && <AdminInventory products={products} setProducts={setProducts} showToast={showToast} availableCollections={availableCollections} productImageFile={productImageFile} setProductImageFile={setProductImageFile} uploadImage={uploadImage} />}
              {adminTab === 'leads' && <AdminLeads leads={leads} setLeads={setLeads} products={products} setProducts={setProducts} showToast={showToast} config={config} />}
              {adminTab === 'banners' && <AdminBanners banners={banners} setBanners={setBanners} showToast={showToast} bannerImageFile={bannerImageFile} setBannerImageFile={setBannerImageFile} uploadImage={uploadImage} />}
              {adminTab === 'config' && <AdminConfig config={config} setConfig={setConfig} showToast={showToast} products={products} setProducts={setProducts} uploadImage={uploadImage} />}
              {adminTab === 'rastreio' && <AdminRastreio />}
              {adminTab === 'crm' && <AdminCRM showToast={showToast} config={config} />}
              {adminTab === 'growth' && <AdminGrowth leads={leads} products={products} config={config} />}
              </React.Suspense>
            </AdminTabErrorBoundary>
          </main>
        </div>

        {/* BOTTOM NAV — visível só no mobile */}
        <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md bg-zinc-900/95 backdrop-blur-xl px-4 py-4 rounded-3xl flex items-center justify-between shadow-[0_20px_50px_rgba(0,0,0,0.8)] z-50 border border-white/10 lg:hidden">
          {adminNavItems.map(item => (
            <button
              key={item.key}
              onClick={() => { setAdminTab(item.key); if (item.key === 'leads') setNewOrdersCount(0); }}
              className={`flex flex-col items-center gap-1 transition-colors duration-200 relative ${adminTab === item.key ? 'text-emerald-500' : 'text-zinc-500'}`}
            >
              {item.icon}
              {item.badge && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[9px] font-black min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center border-2 border-zinc-900 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.6)]">
                  {item.badge}
                </span>
              )}
              <span className={`text-[8px] uppercase transition-all duration-200 ${adminTab === item.key ? 'font-black' : 'font-bold'}`}>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>
    );
  }

  return (
    <div className="app-shell min-h-screen font-sans text-white pb-0 selection:bg-emerald-500 selection:text-zinc-950" style={{ background: 'var(--bg-base)' }}>
      
      {/* LETREIRO SUPERIOR DINÂMICO */}
      {(config.marqueePhrases || []).length > 0 && (
        <div className={`py-2.5 ${productPageOpen ? 'hidden lg:flex' : 'flex'} items-center justify-center border-b`} style={{ background: 'var(--bg-header)', borderColor: 'var(--border)', color: 'var(--text-secondary)', minHeight: '34px' }}>
          <AnimatePresence mode="wait">
            <motion.span
              key={marqueeIdx}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: 'easeInOut' }}
              className="text-[9px] font-black uppercase tracking-[0.25em]"
            >
              ✦ {config.marqueePhrases[marqueeIdx % config.marqueePhrases.length]} ✦
            </motion.span>
          </AnimatePresence>
        </div>
      )}

      {toast && <div className="fixed top-24 lg:top-20 left-1/2 -translate-x-1/2 z-[200] animate-slide-down"><div className="px-6 py-3 rounded-full font-black text-[10px] uppercase bg-white text-zinc-950 shadow-2xl">{toast.message}</div></div>}

      <header className="sticky top-0 z-40 isolate border-b border-white/5 shadow-[0_10px_30px_rgba(0,0,0,0.5)] h-20 lg:h-[68px]" style={{ background: 'var(--bg-header)', backgroundColor: 'var(--bg-header)', backgroundImage: 'none', opacity: 1, backdropFilter: 'none', WebkitBackdropFilter: 'none', filter: 'none', mixBlendMode: 'normal' }}>
        <div className="w-full max-w-[1280px] mx-auto px-6 lg:px-10 h-full flex items-center gap-4">

          {/* LOGO */}
          <button
            className="select-none flex-1 lg:flex-none flex items-center justify-center lg:justify-start mx-2 lg:mx-0 touch-manipulation active:opacity-80 transition-opacity"
            onClick={() => {
              setSelectedProduct(null);
              setSelectedSizes({});
              setSelectedCategory('TODOS');
              setSelectedSubcategory('TODOS');
              setSelectedSize('TODOS');
              setSearchQuery('');
              setKitsOnly(false);
              setActiveCollectionFilter(null);
              setCurrentPage(1);
              (document.getElementById('root') || window).scrollTo({ top: 0, behavior: 'smooth' });
            }}
            aria-label="Voltar ao início"
          >
            {config.logoUrl ? (
              <>
                {/* MOBILE logo */}
                <div
                  className="lg:hidden flex items-center justify-center overflow-hidden"
                  style={{ width: '180px', maxWidth: '48vw', height: '70px', maxHeight: '70px' }}
                >
                  <img
                    src={config.logoUrl}
                    alt={config.brandName}
                    style={{ transform: `scale(${config.logoZoom || 1})`, maxWidth: '180px', maxHeight: '70px' }}
                    className="w-full h-full object-contain mix-blend-screen transition-transform"
                  />
                </div>
                {/* DESKTOP logo — container fixo, alinhado à esquerda */}
                <div className="hidden lg:flex w-[160px] h-[58px] overflow-hidden shrink-0 items-center justify-start">
                  <img
                    src={config.logoUrl}
                    alt={config.brandName}
                    style={{ transform: `scale(${config.logoZoom || 1})`, transformOrigin: 'left center' }}
                    className="w-full h-full object-contain object-left mix-blend-screen transition-transform"
                  />
                </div>
              </>
            ) : (
               <h1 className="logo-font text-xl text-white font-black italic uppercase text-center lg:text-left">{config.brandName}</h1>
            )}
          </button>

          {/* SEARCH — mobile: ícone à esquerda, desktop: some (busca está no main) */}
          <button className="p-2 text-zinc-400 hover:text-white shrink-0 touch-manipulation lg:hidden order-first" onClick={() => setShowQuickMenu(true)} data-testid="btn-header-search"><Menu size={22} /></button>

          {/* NAV desktop — categorias horizontais */}
          <nav className="hidden lg:flex flex-1 items-center justify-center gap-7 px-8 overflow-x-auto no-scrollbar">
            {(categories || []).filter(c => c !== 'TODOS').slice(0, 7).map(cat => (
              <button
                key={cat}
                onClick={() => { setSelectedCategory(cat); setSelectedSubcategory('TODOS'); setSelectedSize('TODOS'); setSearchQuery(''); setKitsOnly(false); document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' }); }}
                className={`text-[11px] font-black uppercase tracking-[0.15em] whitespace-nowrap transition-colors pb-0.5 border-b-2 ${selectedCategory === cat ? 'text-white border-white' : 'text-zinc-500 border-transparent hover:text-zinc-300 hover:border-zinc-600'}`}
              >
                {cat}
              </button>
            ))}
          </nav>

          {/* AÇÕES — direita */}
          <div className="flex items-center gap-2 shrink-0">
            {/* AVATAR USUÁRIO FLUXO */}
            {(() => {
              const initials = userProfile?.name
                ? userProfile.name.trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('')
                : null;
              return (
                <button
                  onClick={handleOpenUserDrawer}
                  data-testid="btn-header-my-orders"
                  title={userProfile ? `Olá, ${userProfile.name.split(' ')[0]}` : 'Minha Conta'}
                  className={`relative w-9 h-9 rounded-full flex items-center justify-center touch-manipulation transition-all duration-200 active:scale-90 shrink-0 ${
                    userProfile
                      ? 'bg-emerald-500/15 border-2 border-emerald-500/60 hover:border-emerald-400'
                      : 'bg-zinc-900 border border-white/15 hover:border-white/40 hover:bg-zinc-800'
                  }`}
                >
                  {initials ? (
                    <span className="text-[11px] font-black text-emerald-400 leading-none select-none">
                      {initials}
                    </span>
                  ) : (
                    <User size={15} className="text-zinc-400" />
                  )}
                  {userProfile && (
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-zinc-950 shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
                  )}
                </button>
              );
            })()}
            <button onClick={() => setShowCart(true)} data-testid="btn-header-cart" className="relative p-2 touch-manipulation">
              <motion.div
                animate={cartBounce ? { scale: [1, 1.3, 0.9, 1.1, 1], rotate: [0, -8, 6, -3, 0] } : { scale: 1 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className={cartBounce ? 'text-emerald-500' : 'text-white hover:text-emerald-500'}
              >
                <ShoppingBag size={24} />
              </motion.div>
              {cart.length > 0 && (
                <motion.span
                  key={cart.reduce((a,i)=>a+i.quantity,0)}
                  initial={{ scale: 0.5 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                  className="absolute top-0 right-0 bg-emerald-500 text-zinc-950 text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-zinc-950 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                >
                  {cart.reduce((a,i)=>a+i.quantity,0)}
                </motion.span>
              )}
            </button>
          </div>

        </div>
      </header>

      {/* CORPO DA LOJA — oculto no mobile quando a página de produto está aberta */}
      <div className={productPageOpen ? 'hidden lg:block' : ''}>

      {/* ── Barra de Benefícios ─────────────────────────────── */}
      <div
        className="w-full overflow-x-auto no-scrollbar flex items-center justify-center border-b"
        style={{ background: '#2c2c2e', borderColor: 'rgba(255,255,255,0.06)', height: '44px' }}
      >
        <div className="flex items-center gap-6 lg:gap-10 px-6 shrink-0">
          {[
            { icon: <Zap size={13} />, label: 'Entrega no mesmo dia em Uberaba' },
            { icon: <MapPin size={13} />, label: 'Retire na loja' },
            { icon: <Truck size={13} />, label: 'Frete grátis em Uberaba' },
            { icon: <CreditCard size={13} />, label: 'Até 4x sem juros' },
            { icon: <PixIcon size={13} />, label: '5% OFF no Pix' },
            { icon: <ShieldCheck size={13} />, label: 'Enviamos pra todo Brasil' },
          ].map(({ icon, label }) => (
            <div key={label} className="flex items-center gap-1.5 shrink-0">
              <span style={{ color: '#a1a1aa' }}>{icon}</span>
              <span style={{ color: '#a1a1aa', fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <BannerCarousel
        activeBanners={activeBanners}
        bannersLoaded={bannersLoaded}
        isAdmin={isAdmin}
        onCollectionFilter={setActiveCollectionFilter}
      />

      <main className="w-full px-6 lg:px-10 mt-6 lg:mt-12 space-y-5 lg:space-y-12 min-h-screen lg:max-w-[1280px] lg:mx-auto" data-testid="catalog-main">
        <div className="relative group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
          <input id="search-input" placeholder="Busque por peça, cor, tamanho ou preço…" data-testid="input-search" className="w-full border py-4 pl-14 pr-12 rounded-2xl text-[16px] font-bold outline-none focus:border-emerald-500/50 shadow-inner client-input" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} aria-label="Limpar busca" className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white bg-zinc-800/60 rounded-full p-1.5 touch-manipulation active:scale-90 transition-all"><X size={13} /></button>
          )}
        </div>
        {/* Chips do que a busca entendeu — feedback de busca inteligente */}
        {searchActive && (() => {
          const chips = [];
          if (searchIntent.onlyOffer) chips.push({ k: 'promo', label: 'Em promoção', icon: <Flame size={10} className="fill-amber-400 text-amber-400" /> });
          if (searchIntent.onlyNew) chips.push({ k: 'novo', label: 'Novidades' });
          if (searchIntent.priceMin != null && searchIntent.priceMax != null) chips.push({ k: 'faixa', label: `${formatBRL(searchIntent.priceMin)} – ${formatBRL(searchIntent.priceMax)}` });
          else if (searchIntent.priceMax != null) chips.push({ k: 'ate', label: `Até ${formatBRL(searchIntent.priceMax)}` });
          else if (searchIntent.priceMin != null) chips.push({ k: 'apartir', label: `A partir de ${formatBRL(searchIntent.priceMin)}` });
          if (searchIntent.sizes.length > 0) chips.push({ k: 'tam', label: `Tam: ${searchIntent.sizes.join(', ')}` });
          if (chips.length === 0) return null;
          return (
            <div className="flex flex-wrap items-center gap-2 -mt-2">
              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-600">Filtrando:</span>
              {chips.map(c => (
                <span key={c.k} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-amber-300 bg-amber-400/10 border border-amber-400/25 rounded-full px-2.5 py-1">
                  {c.icon}{c.label}
                </span>
              ))}
            </div>
          );
        })()}

        <div id="catalog-section" className="flex gap-3 lg:gap-5 overflow-x-auto lg:overflow-x-visible lg:flex-wrap lg:justify-center no-scrollbar pb-1 lg:pb-0 mask-linear lg:[mask-image:none] native-x-scroll items-start" style={{ touchAction: 'pan-x pan-y' }}>
          {/* Botão destacado de KITS — sempre primeiro */}
          {(products || []).some(p => p.is_kit) && (
            <div className="flex flex-col items-center gap-2 shrink-0">
              <button
                key="__kits__"
                onClick={() => { setKitsOnly(v => !v); }}
                data-testid="category-filter-KITS"
                className={`relative px-4 py-2.5 rounded-xl text-[10px] font-black uppercase whitespace-nowrap border-2 transition-all touch-manipulation flex items-center gap-1.5 ${kitsOnly
                  ? 'bg-gradient-to-r from-amber-400 via-orange-500 to-pink-500 text-zinc-950 border-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.45)]'
                  : 'bg-zinc-950 text-amber-400 border-amber-400/50 hover:border-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.18)]'}`}
              >
                <Zap size={12} className={kitsOnly ? 'text-zinc-950 fill-zinc-950' : 'text-amber-400 fill-amber-400'} />
                KITS
              </button>
              <span className="text-[9px] font-black uppercase tracking-widest text-transparent select-none">·</span>
            </div>
          )}
          {kitsOnly && (
            <button
              onClick={() => setKitsOnly(false)}
              className="relative px-3 py-2.5 rounded-xl text-[10px] font-black uppercase whitespace-nowrap border transition-all touch-manipulation flex items-center gap-1 shrink-0 text-amber-400 border-amber-400/25 bg-amber-400/5 hover:bg-amber-400/10 hover:border-amber-400/50 active:scale-95"
            >
              <ChevronLeft size={12} /> Voltar
            </button>
          )}
          {!kitsOnly && categories.map((cat) => {
            const isActive = selectedCategory === cat;
            const catImgData = getCatImgData(cat !== 'TODOS' ? (config.category_images || {})[cat] : null);
            const imgUrl = catImgData.url;
            const imgPos = catImgData.pos;
            const hasLogo = !!config.logoUrl;
            return (
              <motion.button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                data-testid={`category-filter-${cat}`}
                whileTap={{ scale: 0.92 }}
                className="flex flex-col items-center gap-2 shrink-0 touch-manipulation lg:min-w-[80px]"
                style={{ minWidth: '60px' }}
              >
                <div className={`w-[58px] h-[58px] lg:w-[72px] lg:h-[72px] rounded-full overflow-hidden border-2 transition-all duration-200 bg-black flex items-center justify-center relative ${
                  isActive
                    ? 'border-emerald-500 shadow-[0_0_14px_rgba(16,185,129,0.45)]'
                    : 'border-white/10 hover:border-white/30'
                }`}>
                  {imgUrl ? (
                    <img src={imgUrl} alt={cat} className="w-full h-full object-cover" style={{ objectPosition: imgPos }} loading="lazy" decoding="async" />
                  ) : (
                    <span className={`text-lg lg:text-xl font-black select-none transition-colors ${isActive ? 'text-emerald-400/80' : 'text-white/25'}`}>
                      {(cat || '?').charAt(0)}
                    </span>
                  )}
                  {imgUrl && <div className="absolute inset-0 bg-black/25 pointer-events-none" />}
                  {isActive && <div className="absolute inset-[3px] rounded-full border border-emerald-500/40 pointer-events-none" />}
                </div>
                <span className={`text-[9px] lg:text-[12px] font-black uppercase tracking-widest leading-none transition-colors ${
                  isActive ? 'text-emerald-400' : 'text-zinc-500'
                }`}>
                  {cat}
                </span>
              </motion.button>
            );
          })}
        </div>


        {!kitsOnly && selectedCategory !== 'TODOS' && availableSubcategories.length > 1 && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar mask-linear native-x-scroll items-center" data-testid="subcategory-bar">
            {availableSubcategories.map(sub => (
              <button key={sub} onClick={() => setSelectedSubcategory(sub)} data-testid={`subcategory-filter-${sub}`} className={`px-3.5 py-1.5 rounded-lg text-[9px] font-black uppercase whitespace-nowrap border transition-all touch-manipulation ${selectedSubcategory === sub ? 'bg-white/90 text-zinc-950 border-white' : 'bg-transparent text-zinc-500 border-white/10 hover:text-white hover:border-white/30'}`}>{sub === 'TODOS' ? 'Todas subcategorias' : sub}</button>
            ))}
          </div>
        )}

        {activeCollectionFilter && (
          <div className="flex items-center justify-between bg-zinc-500/10 border border-zinc-400/20 p-4 rounded-2xl animate-in">
            <div className="flex flex-col">
              <span className="text-[8px] font-black uppercase text-zinc-300 tracking-widest">Coleção Ativa</span>
              <span className="text-xs font-black uppercase text-white">{activeCollectionFilter}</span>
            </div>
            <button onClick={() => setActiveCollectionFilter(null)} className="p-2 bg-zinc-300 text-zinc-950 rounded-xl active:scale-90 transition-transform"><X size={14}/></button>
          </div>
        )}
        {noveltyMode && (
          <div className="flex items-center justify-between bg-zinc-500/10 border border-zinc-400/20 p-4 rounded-2xl animate-in">
            <div className="flex flex-col">
              <span className="text-[8px] font-black uppercase text-zinc-300 tracking-widest">Filtro Ativo</span>
              <span className="text-xs font-black uppercase text-white">🔥 Novidades</span>
            </div>
            <button onClick={() => setNoveltyMode(false)} className="p-2 bg-zinc-300 text-zinc-950 rounded-xl active:scale-90 transition-transform"><X size={14}/></button>
          </div>
        )}

        {!kitsOnly && availableSizes.length > 1 && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar mask-linear native-x-scroll items-center">
            {availableSizes.map(sz => (
              <button key={sz} onClick={() => setSelectedSize(sz)} data-testid={`size-filter-${sz}`} className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase whitespace-nowrap border transition-all touch-manipulation ${selectedSize === sz ? 'bg-zinc-300 text-zinc-950 border-zinc-300 shadow-[0_0_10px_rgba(212,212,216,0.25)]' : 'bg-transparent text-zinc-600 border-white/5 hover:text-white hover:border-white/20'}`}>{sz === 'TODOS' ? 'Todos tamanhos' : sz}</button>
            ))}
          </div>
        )}

        {/* Filtro de COR — só dentro de uma categoria (evita poluir o home) */}
        {!kitsOnly && selectedCategory !== 'TODOS' && availableColors.length > 1 && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar mask-linear native-x-scroll items-center">
            {availableColors.map(c => {
              const active = selectedColor === c;
              const dot = c !== 'TODOS' ? colorDot(c) : null;
              return (
                <button key={c} onClick={() => setSelectedColor(c)} data-testid={`color-filter-${c}`} className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[9px] font-black uppercase whitespace-nowrap border transition-all touch-manipulation ${active ? 'bg-zinc-300 text-zinc-950 border-zinc-300 shadow-[0_0_10px_rgba(212,212,216,0.25)]' : 'bg-transparent text-zinc-600 border-white/5 hover:text-white hover:border-white/20'}`}>
                  {c !== 'TODOS' && (
                    <span className="w-2.5 h-2.5 rounded-full border border-white/20 shrink-0" style={dot ? { background: dot } : { background: 'conic-gradient(from 0deg,#f87171,#fbbf24,#34d399,#60a5fa,#c084fc,#f87171)' }} />
                  )}
                  {c === 'TODOS' ? 'Todas as cores' : c}
                </button>
              );
            })}
          </div>
        )}

        {/* Filtro de FAIXA DE PREÇO — só dentro de uma categoria (evita poluir o home) */}
        {!kitsOnly && selectedCategory !== 'TODOS' && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar mask-linear native-x-scroll items-center">
            <button onClick={() => setPriceRange('TODOS')} className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase whitespace-nowrap border transition-all touch-manipulation ${priceRange === 'TODOS' ? 'bg-zinc-300 text-zinc-950 border-zinc-300 shadow-[0_0_10px_rgba(212,212,216,0.25)]' : 'bg-transparent text-zinc-600 border-white/5 hover:text-white hover:border-white/20'}`}>Qualquer preço</button>
            {PRICE_RANGES.map(r => (
              <button key={r.key} onClick={() => setPriceRange(r.key)} data-testid={`price-filter-${r.key}`} className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase whitespace-nowrap border transition-all touch-manipulation ${priceRange === r.key ? 'bg-emerald-500 text-zinc-950 border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-transparent text-zinc-600 border-white/5 hover:text-white hover:border-white/20'}`}>{r.label}</button>
            ))}
          </div>
        )}

        {/* OFERTAS — carrosséis por campanha (Dia/Semana/Mês), na ordem do Setup */}
        {(() => {
          const isDefaultView = !kitsOnly && selectedCategory === 'TODOS' && (selectedSize === 'TODOS' || !selectedSize) && selectedColor === 'TODOS' && priceRange === 'TODOS' && !searchQuery.trim() && !activeCollectionFilter && currentPage === 1;
          if (!isDefaultView) return null;
          const orderCfg = Array.isArray(config?.offerCampaignOrder) && config.offerCampaignOrder.length > 0 ? config.offerCampaignOrder : OFFER_CAMPAIGNS;
          const campaignsOrdered = [...orderCfg.filter(c => OFFER_CAMPAIGNS.includes(c)), ...OFFER_CAMPAIGNS.filter(c => !orderCfg.includes(c))];

          const sections = campaignsOrdered.map(camp => ({
            camp,
            list: (products || [])
              .filter(p => isOfferLive(p) && offerCampaign(p) === camp && (p.is_kit || (p.stock || 0) > 0))
              .sort((a, b) =>
                ((a.offer_order ?? 999) - (b.offer_order ?? 999)) ||
                ((offerEndsAt(a)?.getTime() || 0) - (offerEndsAt(b)?.getTime() || 0))
              ),
          })).filter(s => s.list.length > 0);
          if (sections.length === 0) return null;

          return sections.map(({ camp, list }, secIdx) => {
            const suffix = (CAMPAIGN_LABELS[camp] || 'Ofertas').replace(/^Ofertas\s*/i, '');
            return (
              <section
                key={camp}
                className="relative -mx-6 lg:mx-0 lg:rounded-3xl overflow-hidden animate-in"
                data-testid={`offers-section-${camp}`}
                style={{ background: 'radial-gradient(120% 80% at 50% 0%, rgba(245,158,11,0.08) 0%, rgba(9,9,11,0) 58%)' }}
              >
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" aria-hidden="true" />
                <div className="px-6 pt-9 pb-5">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2.5">
                        <Flame size={13} className="fill-amber-400 text-amber-400" />
                        <span className="text-[9px] font-black uppercase tracking-[0.4em]" style={{ color: '#fbbf24' }}>Por tempo limitado</span>
                        <span className="h-px w-6 bg-amber-400/40" />
                      </div>
                      <h2 className="font-black uppercase text-white leading-[0.88] tracking-tight" style={{ fontSize: '2.35rem' }}>
                        Ofertas<br/>
                        <span className="italic font-serif" style={{ fontWeight: 500, background: 'linear-gradient(90deg,#fde68a,#f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{suffix}</span>
                      </h2>
                    </div>
                    <div className="flex flex-col items-end pb-1">
                      <span className="text-[8px] font-black uppercase tracking-[0.3em] text-white/35">Acaba à 00h</span>
                      <span className="text-[10px] font-black tabular-nums text-amber-300/80">
                        {String(list.length).padStart(2, '0')} <span className="text-white/30">{list.length === 1 ? 'peça' : 'peças'}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div
                  className="flex gap-3 overflow-x-auto overflow-y-hidden no-scrollbar snap-x snap-mandatory pb-9 px-6 carousel-scroll"
                  style={{ touchAction: 'pan-x pan-y' }}
                  data-testid={`offers-rail-${camp}`}
                >
                  {list.map((product, idx) => {
                    const pct = offerPercent(product);
                    const novo = offerPrice(product);
                    return (
                      <motion.div
                        key={product.id}
                        initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '80px' }}
                        transition={{ duration: 0.5, delay: Math.min(idx, 6) * 0.06, ease: [0.16, 1, 0.3, 1] }}
                        className="shrink-0 w-[52%] max-w-[200px] snap-start touch-manipulation"
                        data-testid={`offer-card-${product.id}`}
                      >
                        <div className="p-[1.5px] rounded-2xl bg-gradient-to-br from-amber-400/50 via-amber-500/10 to-red-500/40">
                          <button
                            type="button"
                            onClick={() => handleProductClick(product)}
                            className="block w-full text-left rounded-[15px] overflow-hidden bg-zinc-950 shadow-[0_20px_50px_rgba(0,0,0,0.7)]"
                          >
                            <div className="aspect-[4/5] relative overflow-hidden">
                              <ProductImage src={product.image} alt={product.name} order={10 + secIdx * 40 + idx} sizes="55vw" />
                              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/10 to-transparent pointer-events-none" />
                              <div className="absolute top-2 left-2 z-10 flex items-center gap-1 text-white text-[10px] font-black px-2 py-1 rounded-md"
                                style={{ background: 'linear-gradient(135deg,#f59e0b,#ef4444)', boxShadow: '0 2px 10px rgba(245,158,11,0.45)' }}>
                                <Flame size={9} style={{ fill: '#fff' }} /> -{pct}%
                              </div>
                              <div className="absolute bottom-2 left-2 right-2 z-10 flex justify-center">
                                <OfferCountdown target={offerEndsAt(product)} variant="compact" onExpire={bumpOffers} />
                              </div>
                            </div>
                            <div className="p-3">
                              <h3 className="uppercase line-clamp-1 mb-1.5" style={{ color: '#D4D4D8', fontSize: '9.5px', fontWeight: 600, letterSpacing: '0.08em' }}>{product.name}</h3>
                              <div className="flex items-baseline gap-2">
                                <span style={{ color: '#fde68a', fontSize: '16px', fontFamily: "'DM Sans', sans-serif", fontWeight: 800, letterSpacing: '-0.01em' }}>{formatBRL(novo)}</span>
                                <span style={{ color: '#71717A', fontSize: '10px', fontWeight: 600, textDecoration: 'line-through' }}>{formatBRL(product.price || 0)}</span>
                              </div>
                              <div className="flex items-center gap-1.5 mt-1.5" style={{ color: '#34d399' }}>
                                <Truck size={10} strokeWidth={2.4} className="shrink-0" />
                                <span style={{ fontSize: '8px', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Frete grátis · {(config?.location || 'Uberaba').split(',')[0].trim()}</span>
                              </div>
                            </div>
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                  <div className="shrink-0 w-2" aria-hidden="true" />
                </div>
                <div className="h-px bg-gradient-to-r from-transparent via-amber-400/20 to-transparent mb-2" aria-hidden="true" />
              </section>
            );
          });
        })()}

        {/* DESTAQUES */}
        {(() => {
          const isDefaultView = !kitsOnly && selectedCategory === 'TODOS' && (selectedSize === 'TODOS' || !selectedSize) && selectedColor === 'TODOS' && priceRange === 'TODOS' && !searchQuery.trim() && !activeCollectionFilter && currentPage === 1;
          if (!isDefaultView) return null;
          const featured = (products || [])
            .filter(p => p.featured && (p.is_kit || (p.stock || 0) > 0))
            .sort((a, b) => (a.featured_order ?? 999) - (b.featured_order ?? 999));
          if (featured.length === 0) return null;
          return (
            <section
              className="relative -mx-6 lg:mx-0 lg:rounded-3xl overflow-hidden animate-in"
              data-testid="featured-section"
              style={{ background: 'radial-gradient(120% 80% at 50% 0%, rgba(228,228,231,0.06) 0%, rgba(9,9,11,0) 55%), linear-gradient(180deg, rgba(9,9,11,0) 0%, rgba(9,9,11,0) 100%)' }}
            >
              {/* Linha luminosa superior */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" aria-hidden="true" />

              {/* Carrossel — cada destaque é O MESMO bloco (N.º + Em Destaque + card), lado a lado */}
              <div
                className="flex gap-4 overflow-x-auto overflow-y-hidden no-scrollbar snap-x snap-mandatory px-6 lg:px-8 carousel-scroll"
                data-testid="featured-carousel"
              >
                {featured.map((product, idx) => {
                  const imgs = [product.image, ...((Array.isArray(product.gallery) ? product.gallery : []))].filter(Boolean);
                  return (
                    <div
                      key={product.id}
                      data-testid={`featured-slide-${product.id}`}
                      className="snap-center shrink-0 w-[88%] max-w-[480px] lg:w-[600px] lg:max-w-none"
                    >
                      {/* Cabeçalho editorial — idêntico ao original; N.º por produto */}
                      <div className="pt-10 pb-6">
                        <div className="flex items-end justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <span className="text-[9px] font-black uppercase tracking-[0.45em] text-white/40">N.º {String(idx + 1).padStart(2, '0')}</span>
                              <span className="h-px w-6 bg-white/25" />
                            </div>
                            <h2 className="font-black uppercase text-white leading-[0.88] tracking-tight" style={{ fontSize: '2.35rem' }}>
                              Em<br/>
                              <span className="italic font-serif text-white/85" style={{ fontWeight: 500 }}>Destaque</span>
                            </h2>
                          </div>
                          <div className="flex flex-col items-end pb-1">
                            <span className="text-[8px] font-black uppercase tracking-[0.3em] text-white/35">Seleção</span>
                            <span className="text-[10px] font-black tabular-nums text-white/70">
                              {String(featured.length).padStart(2, '0')} <span className="text-white/30">peças</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* HERO — card grande, presença de loja real */}
                      <div className="block w-full text-left touch-manipulation">
                        <div className="relative">
                          {/* Glow ambiente */}
                          <div className="absolute -inset-3 bg-gradient-to-b from-white/8 via-white/2 to-transparent rounded-[36px] blur-2xl opacity-70 pointer-events-none" aria-hidden="true" />
                          {/* Borda platina */}
                          <div className="relative p-[1.5px] rounded-[28px] bg-gradient-to-b from-white/30 via-white/10 to-white/5">
                            <div className="rounded-[27px] bg-zinc-950 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.85)]">
                              <div className="aspect-[4/5] relative">
                                <AutoScrollGallery auto startDelay={2000} count={imgs.length}>
                                  {imgs.map((imgSrc, i) => (
                                    <div key={i} style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always', flexShrink: 0, width: '100%', height: '100%', position: 'relative' }}>
                                      <ProductImage src={imgSrc} alt={product.name} priority={idx === 0 && i === 0} order={i === 0 ? 20 + idx : 1500 + idx * 10 + i} sizes="88vw" />
                                    </div>
                                  ))}
                                </AutoScrollGallery>
                                {/* Vinheta lateral premium */}
                                <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(120% 80% at 50% 35%, transparent 50%, rgba(0,0,0,0.45) 100%)' }} />
                                {/* Gradient inferior */}
                                <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-zinc-950 via-zinc-950/55 to-transparent pointer-events-none" />
                                {/* Conteúdo sobre a imagem */}
                                <div className="absolute inset-x-0 bottom-0 p-5 z-10" onClick={() => handleProductClick(product)} style={{ cursor: 'pointer' }}>
                                  <div className="flex items-center gap-2 mb-2.5">
                                    <span className="text-[8px] font-black uppercase tracking-[0.35em] text-white/55">Em destaque</span>
                                    <span className="h-px flex-1 bg-white/15" />
                                  </div>
                                  {!product.is_kit && (
                                    <h3 className="font-black text-white text-[15px] uppercase leading-tight mb-3 line-clamp-2 drop-shadow-lg">{product.name}</h3>
                                  )}
                                  <div className="flex items-end justify-between">
                                    <div className="flex flex-col">
                                      <span className="text-[8px] font-black uppercase tracking-[0.3em] text-white/45">A partir de</span>
                                      <span className="font-black text-white text-2xl leading-none mt-1 drop-shadow-lg">{formatBRL(product.price || 0)}</span>
                                    </div>
                                    <span className="flex items-center gap-2 bg-white text-zinc-950 px-4 py-2.5 rounded-full font-black text-[9px] uppercase tracking-[0.2em] shadow-[0_8px_30px_rgba(255,255,255,0.18)]">
                                      Ver peça <ArrowRight size={11} />
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div className="shrink-0 w-2" aria-hidden="true" />
              </div>

              {/* Linha luminosa inferior */}
              <div className="h-px bg-gradient-to-r from-transparent via-white/15 to-transparent mt-8 mb-2" aria-hidden="true" />
            </section>
          );
        })()}

        {/* SUB-BANNER (meio) — faixa decorativa 2:1 entre Destaques e Peças */}
        {(() => {
          const isDefaultView = !kitsOnly && selectedCategory === 'TODOS' && (selectedSize === 'TODOS' || !selectedSize) && selectedColor === 'TODOS' && priceRange === 'TODOS' && !searchQuery.trim() && !activeCollectionFilter && currentPage === 1;
          if (!isDefaultView || !midBanner) return null;
          return <SubBanner banner={midBanner} whatsapp={config?.whatsapp} />;
        })()}

        {filteredProducts.length > 0 && (
          <div className="flex items-center justify-between pt-1 animate-in">
            <span className="text-[10px] font-black uppercase tracking-widest text-white/90">Peças Disponíveis</span>
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-300 flex items-center gap-1.5" data-testid="products-count">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 animate-pulse"></span>
              {filteredProducts.length} {filteredProducts.length === 1 ? 'peça' : 'peças'}
            </span>
          </div>
        )}

        {filteredProducts.length === 0 ? (
           <div className="text-center py-20 opacity-50 animate-in">
               <Package size={48} className="mx-auto mb-4 text-zinc-600"/>
               <h3 className="font-black uppercase text-sm tracking-widest text-zinc-400">Nenhum produto encontrado</h3>
               <p className="text-[10px] text-zinc-600 uppercase mt-2">Tente buscar por outro termo ou categoria.</p>
           </div>
        ) : (
           <>
           <div className="products-grid-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', padding: '0 4px', marginLeft: '-20px', marginRight: '-20px', width: 'calc(100% + 40px)' }} data-testid="products-grid">
             {paginatedProducts.map((product, idx) => {
               const isOutOfStock = !product.is_kit && product.stock <= 0;
               const hasMultipleImages = [product.image, ...(Array.isArray(product.gallery) ? product.gallery : [])].filter(Boolean).length > 1;
                return (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 28 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "80px" }}
                    transition={{ type: 'spring', damping: 22, stiffness: 180, delay: Math.min(idx, 5) * 0.07 }}
                    whileHover={!isOutOfStock && !prefersReducedMotion ? {
                      y: -6,
                      boxShadow: '0 32px 64px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.1), inset 0 1px 0 rgba(255,255,255,0.14)',
                      transition: { type: 'spring', damping: 18, stiffness: 280 }
                    } : {}}
                    whileTap={!isOutOfStock ? { scale: 0.975, transition: { type: 'spring', damping: 25, stiffness: 400 } } : {}}
                    className={`cv-card group relative rounded-2xl overflow-hidden border flex flex-col touch-manipulation ${selectedProduct?.id === product.id ? 'border-emerald-500/60' : ''} ${isOutOfStock ? 'opacity-80' : ''}`}
                    style={{ background: 'var(--bg-surface)', borderColor: selectedProduct?.id === product.id ? undefined : 'var(--border)', boxShadow: '0 20px 50px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)' }}
                    data-testid={`product-card-${product.id}`}
                  >
                    {/* X de fechar — aparece quando este card está selecionado */}
                    {selectedProduct?.id === product.id && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedProduct(null); setSelectedSizes({}); }}
                        className="absolute top-2 right-2 z-30 bg-zinc-950/90 border border-white/20 text-white rounded-full w-7 h-7 flex items-center justify-center touch-manipulation active:scale-90 transition-transform shadow-lg"
                        aria-label="Fechar"
                      >
                        <X size={14} />
                      </button>
                    )}
                    {!isOutOfStock && (product.sales || 0) >= 10 && <div className="absolute top-2 right-2 z-10 bg-gradient-to-r from-red-600 to-red-500 text-white text-[8px] font-black uppercase px-2 py-1 rounded-md shadow-[0_0_10px_rgba(239,68,68,0.5)] flex items-center gap-1" data-testid={`badge-best-seller-${product.id}`}><Flame size={9}/> Top</div>}

                       <div
                         className="aspect-[4/5] relative overflow-hidden"
                         onClick={!hasMultipleImages ? () => !isOutOfStock && handleProductClick(product) : undefined}
                         style={!hasMultipleImages && !isOutOfStock ? { cursor: 'pointer' } : undefined}
                       >
                         {/* Badge de desconto % — oferta tem prioridade sobre a promo */}
                         {!isOutOfStock && (() => {
                           const live = isOfferLive(product);
                           const promo = product.promotional_price;
                           const pct = live
                             ? offerPercent(product)
                             : (promo && promo < product.price ? Math.round((1 - promo / product.price) * 100) : 0);
                           if (pct <= 0) return null;
                           return (
                             <div style={{
                               position: 'absolute', top: '8px', left: '8px',
                               zIndex: 20, color: '#fff',
                               fontWeight: 800, fontSize: '11px', borderRadius: '5px',
                               padding: '3px 7px', lineHeight: 1.2,
                               display: 'flex', alignItems: 'center', gap: '3px',
                               background: live ? 'linear-gradient(135deg, #f59e0b, #ef4444)' : '#e53e3e',
                               boxShadow: live ? '0 2px 10px rgba(245,158,11,0.45)' : 'none',
                             }}>
                               {live && <Flame size={9} style={{ fill: '#fff' }} />}
                               -{pct}% OFF
                             </div>
                           );
                         })()}

                         {/* Galeria do card (catálogo) — passa as fotos ao TOQUE (dedo parado) */}
                         <AutoScrollGallery count={[product.image, ...((Array.isArray(product.gallery) ? product.gallery : []))].filter(Boolean).length}>
                           {[product.image, ...((Array.isArray(product.gallery) ? product.gallery : []))].filter(Boolean).map((imgSrc, i) => (
                             <div key={i} style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always', flexShrink: 0, width: '100%', height: '100%', position: 'relative' }}>
                               <ProductImage src={imgSrc} alt={product.name} isOutOfStock={isOutOfStock} priority={idx < 2 && i === 0} order={i === 0 ? 100 + idx : 2000 + idx * 10 + i} />
                             </div>
                           ))}
                         </AutoScrollGallery>

                        {isOutOfStock && (
                           <div className="absolute inset-0 bg-zinc-950/60 backdrop-blur-[2px] flex items-center justify-center">
                               <span className="bg-zinc-950 text-white text-[9px] font-black uppercase tracking-widest px-4 py-2 rounded-full border border-white/20 shadow-2xl">Esgotado</span>
                           </div>
                        )}

                        {!isOutOfStock && (() => {
                           const avail = (product.sizes || [])
                             .map(s => ({ name: typeof s === 'string' ? s : s.size, stock: typeof s === 'string' ? (product.stock || 0) : Number(s.stock || 0) }))
                             .filter(s => s.name && s.stock > 0);
                           if (avail.length === 0) return null;
                           const visible = avail.slice(0, 4);
                           const extra = avail.length - visible.length;
                            return (
                               <div
                                 className="absolute bottom-0 left-0 z-10 flex overflow-hidden bg-white/10 backdrop-blur-md border-t border-r border-white/20 rounded-tr-md shadow-[0_4px_20px_rgba(0,0,0,0.3)]"
                                 data-testid={`product-sizes-${product.id}`}
                               >
                                 <style>{`
                                   @keyframes shineSize {
                                     0%, 60% { transform: translateX(-180%) skewX(-18deg); }
                                     100%     { transform: translateX(280%) skewX(-18deg); }
                                   }
                                 `}</style>
                                 <span className="pointer-events-none absolute inset-0 overflow-hidden">
                                   <span className="absolute top-0 left-0 h-full w-[28%]" style={{ background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.13), transparent)', animation: 'shineSize 6s ease-in-out infinite' }} />
                                 </span>
                                 {visible.map(s => (
                                   <span
                                     key={s.name}
                                     className="relative w-[22px] h-[22px] flex items-center justify-center text-[10px] font-bold text-white/95 border-r border-white/10 last:border-r-0"
                                   >
                                     {s.name}
                                   </span>
                                 ))}
                                 {extra > 0 && (
                                   <span className="relative w-[22px] h-[22px] flex items-center justify-center text-[10px] font-bold text-white/95">
                                     +{extra}
                                   </span>
                                 )}
                               </div>
                            );
                         })()}

                       {!isOutOfStock && (
                          <div className="absolute top-3 right-3 bg-white text-zinc-950 p-2 rounded-full shadow-xl opacity-0 translate-y-[-4px] group-hover:opacity-100 group-hover:translate-y-0 transition-all pointer-events-none"><Plus size={16}/></div>
                       )}
                     </div>
                      <motion.div
                        className="p-3 flex-1 flex flex-col justify-between"
                        style={{
                          cursor: isOutOfStock ? 'default' : 'pointer',
                          position: 'relative',
                          zIndex: 4,
                          background: 'linear-gradient(to bottom, hsl(222 14% 13% / 0.55) 0%, hsl(222 14% 11% / 0.95) 100%)',
                          backdropFilter: 'blur(14px) saturate(1.5) brightness(1.08)',
                          WebkitBackdropFilter: 'blur(14px) saturate(1.5) brightness(1.08)',
                          backgroundImage: 'url("https://www.transparenttextures.com/patterns/egg-shell.png")',
                          backgroundSize: '100px',
                          boxShadow: '0 -1px 0 rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.04)',
                        }}
                        onClick={() => !isOutOfStock && handleProductClick(product)}
                      >
                        <div style={{ position: 'relative', zIndex: 6 }}>
                          {/* Linha 1 — nome */}
                          <h3 className="uppercase line-clamp-1 mb-1.5" style={{ color: '#9CA3AF', fontSize: '9.5px', fontWeight: '500', letterSpacing: '0.1em' }}>
                            {product.name}
                          </h3>
                          {/* Linha 2 — preço + botão */}
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            {(() => {
                              const live = !isOutOfStock && isOfferLive(product);
                              const promo = product.promotional_price;
                              const hasPromo = !isOutOfStock && !live && promo && promo < product.price;
                              const mainPrice = live ? offerPrice(product) : (hasPromo ? promo : product.price);
                              const showStrike = live || hasPromo;
                              return (
                                <div className="flex flex-col leading-none min-w-0">
                                  {showStrike && (
                                    <span style={{ color: '#71717A', fontSize: '10px', fontWeight: 600, textDecoration: 'line-through' }}>
                                      {formatBRL(product.price || 0)}
                                    </span>
                                  )}
                                  <p className="leading-none" style={{ color: isOutOfStock ? 'var(--text-muted)' : (live ? '#fde68a' : '#F3F4F6'), fontSize: '16px', fontFamily: "'DM Sans', sans-serif", fontWeight: '800', letterSpacing: '-0.01em', textDecoration: isOutOfStock ? 'line-through' : 'none', marginTop: showStrike ? '2px' : 0 }}>
                                    {formatBRL(mainPrice || 0)}
                                  </p>
                                  {!isOutOfStock && live ? (
                                    <OfferCountdown
                                      target={offerEndsAt(product)}
                                      variant="compact"
                                      onExpire={bumpOffers}
                                      style={{ marginTop: '4px' }}
                                    />
                                  ) : !isOutOfStock ? (
                                    <span style={{ color: '#A1A1AA', fontSize: '9.5px', fontWeight: 600, letterSpacing: '0.02em', marginTop: '3px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                      <span style={{ color: '#32BCAD', display: 'inline-flex' }}><PixIcon size={11} /></span>
                                      {formatBRL((mainPrice || 0) * 0.95)} no Pix
                                    </span>
                                  ) : null}
                                </div>
                              );
                            })()}
                            {!isOutOfStock && (
                              <motion.button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleProductClick(product); }}
                                whileHover={prefersReducedMotion ? {} : { scale: 1.04, transition: { duration: 0.15, ease: 'easeOut' } }}
                                whileTap={prefersReducedMotion ? {} : { scale: 0.96, transition: { duration: 0.08 } }}
                                style={{
                                  height: '32px', padding: '0 14px', borderRadius: '6px', flexShrink: 0,
                                  background: 'linear-gradient(135deg, #D4D4D4 0%, #A8A8A8 50%, #C8C8C8 100%)',
                                  color: '#1a1a1a', fontWeight: '700', fontSize: '10px',
                                  letterSpacing: '0.08em', textTransform: 'uppercase',
                                  border: '1px solid rgba(255,255,255,0.15)',
                                  boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
                                  cursor: 'pointer', fontFamily: 'inherit', outline: 'none',
                                  touchAction: 'manipulation',
                                  position: 'relative', overflow: 'hidden',
                                }}
                              >
                                {!prefersReducedMotion && (
                                  <>
                                    <style>{`
                                      @keyframes shineBuy {
                                        0%,60% { transform: translateX(-180%) skewX(-18deg); }
                                        100%    { transform: translateX(280%) skewX(-18deg); }
                                      }
                                    `}</style>
                                    <span aria-hidden="true" style={{
                                      position: 'absolute', inset: 0, overflow: 'hidden',
                                      borderRadius: 'inherit', pointerEvents: 'none',
                                    }}>
                                      <span style={{
                                        position: 'absolute', top: 0, left: 0,
                                        width: '28%', height: '100%',
                                        background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.13), transparent)',
                                        animation: 'shineBuy 6s ease-in-out infinite',
                                      }} />
                                    </span>
                                  </>
                                )}
                                COMPRAR
                              </motion.button>
                            )}
                          </div>

                          {/* Selo de frete / entrega local */}
                          {!isOutOfStock && (
                            <div className="flex items-center gap-1.5 mb-1.5" style={{ color: '#34d399' }}>
                              <Truck size={11} strokeWidth={2.4} className="shrink-0" />
                              <span style={{ fontSize: '8.5px', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                                Frete grátis · {(config?.location || 'Uberaba').split(',')[0].trim()}
                              </span>
                            </div>
                          )}

                          {/* Linha 3 — WhatsApp */}
                          {!isOutOfStock && (
                            <a
                              href={`https://wa.me/${String(config?.whatsapp || '5534984148067').replace(/\D/g,'')}?text=${encodeURIComponent(`Olá! Tenho interesse em um produto da Fluxo Outlet 👇\n\n*${product.name}*\nSKU: ${product.sku || 'N/A'}\nCategoria: ${product.category || ''}${product.subcategory ? ' > ' + product.subcategory : ''}\n${isOfferLive(product) ? `🔥 OFERTA DO DIA (-${offerPercent(product)}%): R$ ${offerPrice(product).toFixed(2).replace('.', ',')} (de R$ ${product.price?.toFixed(2).replace('.', ',')})` : `Preço: R$ ${product.price?.toFixed(2).replace('.', ',')}`}\nLink: ${'https://www.fluxooutlet.com.br/?produto=' + product.sku}\n\nPodem me ajudar?`)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={e => { e.stopPropagation(); emitSignal('whatsapp_produto', { product, meta: { via: 'card' } }); }}
                              className="flex items-center justify-center gap-1.5 w-full touch-manipulation transition-colors mb-1.5"
                              style={{
                                minHeight: '36px', borderRadius: '6px',
                                border: '1px solid #25D366', color: '#25D366',
                                fontSize: '10px', fontWeight: 700,
                                letterSpacing: '0.06em', textTransform: 'uppercase',
                                background: 'transparent', textDecoration: 'none',
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = 'rgba(37,211,102,0.08)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="#25D366" style={{ flexShrink: 0 }}>
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                              </svg>
                              WhatsApp
                            </a>
                          )}

                          {/* Linha 4 — estrelas */}
                          <div onClick={e => e.stopPropagation()}>
                            <StarRatingInline
                              product={product}
                              ratingsMap={ratingsMap}
                              userProfile={userProfile}
                              setRatingsMap={setRatingsMap}
                              setShowUserDrawer={setShowUserDrawer}
                              setDrawerTab={setDrawerTab}
                              showToast={showToast}
                            />
                          </div>
                        </div>
                      </motion.div>
                  </motion.div>
                )
             })}
           </div>

           {totalPages > 1 && (
             <div className="flex items-center justify-center gap-1.5 pt-8 pb-2 animate-in flex-wrap" data-testid="pagination-controls">
               <button
                 onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); requestAnimationFrame(() => (document.getElementById('root') || window).scrollTo({ top: 0, left: 0, behavior: 'auto' })); }}
                 disabled={currentPage <= 1}
                 className="w-10 h-10 rounded-xl text-base font-black border border-white/10 bg-zinc-900/60 text-white hover:bg-white hover:text-zinc-950 transition-all active:scale-95 disabled:opacity-25 disabled:cursor-not-allowed touch-manipulation flex items-center justify-center"
                 data-testid="pagination-prev"
               >
                 ←
               </button>
               {(() => {
                 const pages = [];
                 const delta = 1;
                 const left = Math.max(2, currentPage - delta);
                 const right = Math.min(totalPages - 1, currentPage + delta);
                 pages.push(1);
                 if (left > 2) pages.push('...');
                 for (let i = left; i <= right; i++) pages.push(i);
                 if (right < totalPages - 1) pages.push('...');
                 if (totalPages > 1) pages.push(totalPages);
                 return pages.map((p, i) => {
                   if (p === '...') return <span key={`el-${i}`} className="text-zinc-600 font-black text-xs w-6 text-center select-none">···</span>;
                   return (
                     <button
                       key={p}
                       onClick={() => { setCurrentPage(p); requestAnimationFrame(() => (document.getElementById('root') || window).scrollTo({ top: 0, left: 0, behavior: 'auto' })); }}
                       data-testid={`pagination-page-${p}`}
                       className={`w-10 h-10 rounded-xl text-[11px] font-black border transition-all active:scale-95 touch-manipulation ${currentPage === p ? 'bg-white text-zinc-950 border-white shadow-[0_0_15px_rgba(255,255,255,0.2)]' : 'bg-zinc-900/60 text-zinc-400 border-white/10 hover:border-white/30 hover:text-white'}`}
                     >
                       {p}
                     </button>
                   );
                 });
               })()}
               <button
                 onClick={() => { setCurrentPage(p => Math.min(totalPages, p + 1)); requestAnimationFrame(() => (document.getElementById('root') || window).scrollTo({ top: 0, left: 0, behavior: 'auto' })); }}
                 disabled={currentPage >= totalPages}
                 className="w-10 h-10 rounded-xl text-base font-black border border-white/10 bg-zinc-900/60 text-white hover:bg-white hover:text-zinc-950 transition-all active:scale-95 disabled:opacity-25 disabled:cursor-not-allowed touch-manipulation flex items-center justify-center"
                 data-testid="pagination-next"
               >
                 →
               </button>
             </div>
           )}
           </>
        )}
      </main>

      {/* ── BLOCO DE CONFIANÇA — loja real e local (reforço antes do rodapé) ── */}
      <section className="w-full px-6 lg:px-10 mt-16 lg:mt-20 lg:max-w-[1280px] lg:mx-auto">
        <div className="rounded-3xl border border-white/10 bg-zinc-900/40 p-5 lg:p-7">
          <div className="flex items-center gap-2 mb-5">
            <ShieldCheck size={15} className="text-emerald-500 shrink-0" />
            <span className="text-[10px] lg:text-[11px] font-black uppercase tracking-[0.22em] text-white">Loja de verdade, daqui de {(config.location || 'Uberaba, MG').split(',')[0]}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-4">
            <div className="flex items-start gap-3 rounded-2xl bg-zinc-950/40 border border-white/5 p-4">
              <MapPin size={18} className="text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-black uppercase tracking-wide text-white leading-tight">Loja física</p>
                <p className="text-[10px] font-medium text-zinc-400 mt-1 leading-snug">Venha conhecer ou retire seu pedido pessoalmente em {(config.location || 'Uberaba, MG')}.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-2xl bg-zinc-950/40 border border-white/5 p-4">
              <Zap size={18} className="text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-black uppercase tracking-wide text-white leading-tight">Entrega no mesmo dia</p>
                <p className="text-[10px] font-medium text-zinc-400 mt-1 leading-snug">Recebeu hoje em {(config.location || 'Uberaba, MG').split(',')[0]}? A gente entrega hoje.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-2xl bg-zinc-950/40 border border-white/5 p-4">
              <MessageCircle size={18} className="text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-black uppercase tracking-wide text-white leading-tight">Atendimento real</p>
                <p className="text-[10px] font-medium text-zinc-400 mt-1 leading-snug">Fale com gente de verdade no WhatsApp, antes e depois da compra.</p>
              </div>
            </div>
          </div>

          {/* Prova social honesta — Instagram */}
          <a
            href="https://www.instagram.com/fluxooutlet034"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex items-center justify-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3.5 hover:bg-white hover:text-zinc-950 transition-all active:scale-[0.98] touch-manipulation group"
          >
            <Instagram size={16} className="shrink-0" />
            <span className="text-[10px] lg:text-[11px] font-black uppercase tracking-widest">Veja nossos clientes no @fluxooutlet034</span>
            <ArrowRight size={13} className="shrink-0 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-transform" />
          </a>
        </div>
      </section>

      <footer className="mt-20 bg-zinc-900/50 border-t border-white/5 pt-14 pb-10 px-6 lg:px-16 w-full">
        <div className="max-w-2xl lg:max-w-5xl mx-auto space-y-12">

          {/* Logo + tagline */}
          <div className="flex flex-col items-center text-center gap-4">
            <div className="h-16 w-full flex items-center justify-center relative overflow-hidden pointer-events-none">
              {config.logoUrl ? (
                <img src={config.logoUrl} alt={config.brandName} style={{ transform: `scale(${config.logoZoom || 1.5})` }} className="h-full w-auto max-w-full object-contain mix-blend-screen opacity-90 transition-transform" />
              ) : (
                <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">{config.brandName}</h2>
              )}
            </div>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] px-4">
              Lifestyle de alto padrão e streetwear autêntico. Qualidade inegociável em cada detalhe.
            </p>
            <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400">
              <MapPin size={11} className="text-emerald-500" />
              <span>Loja física em {config.location || 'Uberaba, MG'} · Entrega no mesmo dia</span>
            </div>
          </div>

          {/* Instagram */}
          <div className="flex justify-center">
            <a href="https://www.instagram.com/fluxooutlet034" target="_blank" rel="noopener noreferrer" className="group flex items-center gap-3 bg-white/5 border border-white/10 px-8 py-4 rounded-2xl hover:bg-white hover:text-zinc-950 transition-all active:scale-95 shadow-xl touch-manipulation">
              <Instagram size={20} />
              <span className="text-[11px] font-black uppercase tracking-widest">Siga @fluxooutlet034</span>
            </a>
          </div>

          {/* Links institucionais */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 border-t border-white/5 pt-8">
            <div className="space-y-3">
              <p className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.3em]">Institucional</p>
              {[
                ['Sobre a Loja', '#'],
                ['Contato', `https://wa.me/${(config.whatsapp || '').replace(/\D/g,'')}`],
              ].map(([label, href]) => (
                <a key={label} href={href} target="_blank" rel="noopener noreferrer" className="block text-[11px] font-bold text-zinc-500 hover:text-white transition-colors uppercase tracking-wide">{label}</a>
              ))}
            </div>
            <div className="space-y-3">
              <p className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.3em]">Ajuda</p>
              {[
                ['Política de Troca', '#'],
                ['Privacidade', '#'],
                ['Meus Pedidos', null],
              ].map(([label, href]) => (
                href
                  ? <a key={label} href={href} target="_blank" rel="noopener noreferrer" className="block text-[11px] font-bold text-zinc-500 hover:text-white transition-colors uppercase tracking-wide">{label}</a>
                  : <button key={label} onClick={() => setShowMyOrders(true)} className="block text-[11px] font-bold text-zinc-500 hover:text-white transition-colors uppercase tracking-wide text-left">{label}</button>
              ))}
            </div>
          </div>

          {/* Trust + pagamento */}
          <div className="bg-zinc-950/50 rounded-[32px] p-6 border border-white/5 space-y-5">
            <h4 className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.3em] text-center">Checkout 100% Seguro</h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col items-center gap-2"><ShieldCheck size={20} className="text-emerald-500/70" /><span className="text-[7px] font-bold uppercase text-zinc-600">SSL Cripto</span></div>
              <div className="flex flex-col items-center gap-2"><Lock size={20} className="text-emerald-500/70" /><span className="text-[7px] font-bold uppercase text-zinc-600">Seguro</span></div>
              <div className="flex flex-col items-center gap-2"><Award size={20} className="text-emerald-500/70" /><span className="text-[7px] font-bold uppercase text-zinc-600">Original</span></div>
            </div>
            <div className="border-t border-white/5 pt-4">
              <p className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.3em] text-center mb-3">Formas de Pagamento</p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                {['Pix', 'Cartão', 'Dinheiro'].map(m => (
                  <span key={m} className="text-[8px] font-black uppercase text-zinc-600 bg-zinc-900 border border-white/5 px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5">
                    {m === 'Pix' && <span style={{ color: '#32BCAD', display: 'inline-flex' }}><PixIcon size={11} /></span>}
                    {m}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Copyright */}
          <div className="pt-4 text-center border-t border-white/5 text-[8px] font-black text-zinc-700 uppercase tracking-widest flex items-center justify-center gap-2 relative z-10">
            &copy; {new Date().getFullYear()} {config.brandName} &bull; DIREITOS RESERVADOS
            <button onClick={handleSecretDoubleTap} className="text-zinc-800 hover:text-emerald-500 transition-colors outline-none select-none touch-manipulation cursor-pointer"><Lock size={10}/></button>
          </div>
        </div>
      </footer>
      </div>
      {/* /CORPO DA LOJA */}

      {showAdminLogin && (
        <div className="fixed inset-0 z-[300] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6 animate-in">
          <form onSubmit={handleLoginSubmit} className="bg-zinc-950 border border-white/10 rounded-[40px] p-8 w-full max-w-sm space-y-6 shadow-[0_20px_60px_rgba(0,0,0,0.8)] relative">
            <button type="button" onClick={() => setShowAdminLogin(false)} className="absolute top-6 right-6 text-zinc-600 hover:text-white touch-manipulation"><X size={18}/></button>
            
            <div className="text-center space-y-2 mt-2">
              <div className="w-16 h-16 bg-zinc-900 border border-white/5 rounded-[20px] flex items-center justify-center mx-auto mb-6 text-emerald-500 shadow-xl"><ShieldCheck size={32}/></div>
              <h2 className="text-2xl font-black uppercase text-white tracking-tighter">Acesso Restrito</h2>
              <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Painel Operacional Tático</p>
            </div>

            <div className="space-y-4 mt-8">
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-zinc-500 px-2 tracking-widest">Email</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
                  <input required type="email" placeholder="seuemail@exemplo.com" autoComplete="email" value={loginUser} onChange={(e) => setLoginUser(e.target.value)} data-testid="input-admin-email" className="w-full bg-zinc-900 border border-white/5 py-4 pl-12 pr-6 rounded-2xl text-[16px] font-bold text-white outline-none focus:border-emerald-500/50 shadow-inner client-input" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-zinc-500 px-2 tracking-widest">Senha</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
                  <input required type="password" placeholder="••••••••" autoComplete="current-password" value={loginPass} onChange={(e) => setLoginPass(e.target.value)} data-testid="input-admin-password" className="w-full bg-zinc-900 border border-white/5 py-4 pl-12 pr-6 rounded-2xl text-[16px] font-bold text-white outline-none focus:border-emerald-500/50 shadow-inner client-input" />
                </div>
              </div>
            </div>

            <button type="submit" disabled={loginLoading} data-testid="btn-admin-login" className="w-full py-5 mt-4 bg-emerald-500 text-zinc-950 rounded-2xl font-black text-[11px] uppercase tracking-widest active:scale-95 flex justify-center items-center gap-2 shadow-[0_10px_30px_rgba(16,185,129,0.2)] transition-transform touch-manipulation disabled:opacity-60">
              {loginLoading ? 'Autenticando...' : <>Autenticar <ChevronRight size={14}/></>}
            </button>
          </form>
        </div>
      )}

      {selectedProduct && selectedProduct.is_kit && (
        <KitModal
          kit={selectedProduct}
          products={products}
          kitItemsByKit={kitItemsByKit}
          cart={cart}
          setCart={setCart}
          setCartBounce={setCartBounce}
          setIsCartModalOpen={setIsCartModalOpen}
          setZoomImage={setZoomImage}
          showToast={showToast}
          onClose={() => { setSelectedProduct(null); setSelectedSizes({}); }}
        />
      )}

      <AnimatePresence>
      {selectedProduct && !selectedProduct.is_kit && (() => {
        const productGallery = [selectedProduct.image, ...((Array.isArray(selectedProduct.gallery) ? selectedProduct.gallery : []) || [])].filter(Boolean);
        const heroImg = activeProductImage || selectedProduct.image;
        const relatedProducts = (products || []).filter(p =>
          p.id !== selectedProduct.id && !p.is_kit && p.stock > 0 &&
          (p.category === selectedProduct.category || p.featured)
        ).slice(0, 4);
        // Caminho até o produto: início.categoria.subcategoria.produto (clicável p/ navegar).
        const goHome = () => { setSelectedProduct(null); setSelectedSizes({}); };
        const goCategory = (cat, sub) => {
          setSelectedProduct(null); setSelectedSizes({});
          setActiveCollectionFilter(null);
          setSelectedCategory((cat || 'TODOS').toUpperCase());
          setSelectedSubcategory(sub ? sub.toUpperCase() : 'TODOS');
          setTimeout(() => document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
        };
        const crumbs = [
          { label: 'início', onClick: goHome },
          selectedProduct.category && selectedProduct.category !== 'TODOS'
            ? { label: selectedProduct.category, onClick: () => goCategory(selectedProduct.category) } : null,
          selectedProduct.subcategory
            ? { label: selectedProduct.subcategory, onClick: () => goCategory(selectedProduct.category, selectedProduct.subcategory) } : null,
          { label: selectedProduct.name, current: true },
        ].filter(Boolean);
        const renderBreadcrumb = (className) => (
          <nav
            aria-label="Caminho do produto"
            className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${className || ''}`}
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            {crumbs.map((c, i) => (
              <React.Fragment key={i}>
                {i > 0 && (
                  <span className="text-[13px] font-black select-none leading-none" style={{ color: 'var(--text-muted)' }}>.</span>
                )}
                {c.current
                  ? <span className="text-[13px] font-black uppercase tracking-[0.18em] max-w-[200px] truncate leading-none" style={{ color: 'var(--text-secondary)' }}>{c.label}</span>
                  : <button
                      onClick={c.onClick}
                      className="text-[13px] font-black uppercase tracking-[0.18em] leading-none transition-colors hover:text-white active:text-white touch-manipulation"
                      style={{ color: 'var(--text-muted)' }}
                    >{c.label}</button>}
              </React.Fragment>
            ))}
          </nav>
        );
        return (
        <React.Fragment key={`product-modal-${selectedProduct.id}`}>
          {/* ── MOBILE: página de produto em fluxo no documento (oculto no desktop) ── */}
          {/* A barra real (hambúrguer/logo/perfil/sacola) fica sticky logo acima — barra compartilhada com o home. */}
          <motion.div
            className="lg:hidden bg-zinc-950 min-h-screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
              {/* Gallery — full-bleed, colada na barra (sem puxador) */}
              <div className="relative w-full bg-zinc-900">
                {/* Voltar — flutua sobre a imagem, logo abaixo da barra Fluxo */}
                <button onClick={() => { setSelectedProduct(null); setSelectedSizes({}); }} className="absolute top-3 left-3 z-20 flex items-center gap-1 text-white bg-black/50 backdrop-blur-md rounded-full pl-2 pr-3 py-2 touch-manipulation border border-white/10 active:scale-90 transition-transform text-[10px] font-black uppercase tracking-widest"><ChevronLeft size={16}/> Voltar</button>
                <div className="relative w-full aspect-[4/5] overflow-hidden">
                  {/* Imagem única — troca só por TOQUE nas miniaturas/pontos (sem arrastar) */}
                  <img
                    src={optimizeImage(heroImg, 1200, 90)}
                    className="w-full h-full object-cover"
                    alt={selectedProduct.name}
                    fetchPriority="high"
                    draggable={false}
                  />
                  {/* Dot indicators */}
                  {productGallery.length > 1 && (
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-0.5 z-10">
                      {productGallery.map((g, i) => (
                        <button key={i} type="button" onClick={() => setActiveProductImage(g)} aria-label={`Foto ${i + 1}`} className="p-2 -m-1 touch-manipulation">
                          <span className={`block rounded-full transition-all duration-300 ${heroImg === g ? 'w-5 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/40'}`} />
                        </button>
                      ))}
                    </div>
                  )}
                  <button onClick={() => setZoomImage(heroImg)} className="absolute bottom-3 right-3 text-[9px] font-black text-white bg-black/60 backdrop-blur-md rounded-full px-3 py-1.5 uppercase tracking-widest border border-white/10 flex items-center gap-1.5 touch-manipulation active:scale-95"><ZoomIn size={10}/> Ampliar</button>
                </div>
                {productGallery.length > 1 && (
                  <div className="shrink-0 px-4 py-3 flex gap-2 overflow-x-auto no-scrollbar bg-zinc-950 border-b border-white/5" style={{ touchAction: 'pan-x', overscrollBehaviorX: 'contain' }}>
                    {productGallery.map((g, i) => (
                      <button key={i} onClick={() => setActiveProductImage(g)} className={`shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all touch-manipulation ${heroImg === g ? 'border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.5)] scale-105' : 'border-white/10 opacity-60'}`}>
                        <img src={optimizeImage(g, 300, 80)} className="w-full h-full object-cover" alt="" draggable={false} loading="lazy" decoding="async" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Body — scroll único, com ritmo de seções generoso (cara de site grande) */}
              <div className="px-6 pt-7 pb-44 flex flex-col gap-8">

                {/* ── CABEÇALHO ── nome é o herói; ref/rating subordinados; preço com respiro */}
                <div className="flex flex-col gap-5">
                  {renderBreadcrumb()}
                  <div className="flex flex-col gap-3">
                    <h2 className="text-[30px] font-black text-white leading-[1.04] uppercase tracking-tight">{selectedProduct.name}</h2>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      <StarRatingInline
                        product={selectedProduct}
                        ratingsMap={ratingsMap}
                        userProfile={userProfile}
                        setRatingsMap={setRatingsMap}
                        setShowUserDrawer={setShowUserDrawer}
                        setDrawerTab={setDrawerTab}
                        showToast={showToast}
                      />
                      <span className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)' }}>Ref. {selectedProduct.sku}</span>
                    </div>
                  </div>

                  {/* Preço */}
                  {isOfferLive(selectedProduct) ? (
                    <div className="p-[1.5px] rounded-3xl bg-gradient-to-br from-amber-400/50 via-amber-500/10 to-red-500/40">
                      <div className="rounded-[22px] bg-zinc-950/80 p-5 space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.25em]" style={{ color: '#fbbf24' }}>
                            <Flame size={11} className="fill-amber-400 text-amber-400"/> Oferta do Dia
                          </span>
                          <span className="text-[10px] font-black text-zinc-950 px-2 py-0.5 rounded-md bg-gradient-to-r from-amber-400 to-red-500">-{offerPercent(selectedProduct)}%</span>
                        </div>
                        <div className="flex items-baseline gap-3">
                          <span className="text-[34px] font-black tracking-tighter tabular-nums" style={{ color: '#fde68a' }}>{formatBRL(offerPrice(selectedProduct))}</span>
                          <span className="text-base font-bold text-zinc-500 line-through tabular-nums">{formatBRL(selectedProduct.price || 0)}</span>
                        </div>
                        <OfferCountdown target={offerEndsAt(selectedProduct)} variant="full" onExpire={bumpOffers} />
                        <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wide">Acaba à meia-noite · não acumula 5% Pix</p>
                      </div>
                    </div>
                  ) : selectedProduct.promotional_price ? (
                    <div className="flex items-baseline gap-3">
                      <span className="text-[34px] font-black tracking-tighter tabular-nums" style={{ color: 'var(--text-primary)' }}>{formatBRL(selectedProduct.promotional_price)}</span>
                      <span className="text-base font-bold text-zinc-500 line-through tabular-nums">{formatBRL(selectedProduct.price || 0)}</span>
                    </div>
                  ) : (
                    <p className="text-[34px] font-black tracking-tighter tabular-nums" style={{ color: 'var(--text-primary)' }}>{formatBRL(selectedProduct.price || 0)}</p>
                  )}
                </div>

                {/* ── TAMANHO ── seção própria, separada por divisor */}
                <div className="flex flex-col gap-4 border-t border-white/5 pt-8">
                  <p className="text-[11px] font-black text-white uppercase tracking-[0.22em]">Selecione o Tamanho</p>
                  <div className="grid grid-cols-4 gap-2.5">
                    {(selectedProduct.sizes || []).map((s, idx) => {
                      const sz = typeof s === 'string' ? s : s.size;
                      const stock = typeof s === 'string' ? selectedProduct.stock : Number(s.stock || 0);
                      const isEsgotado = stock <= 0;
                      const isLowStock = stock > 0 && stock <= 3;
                      const qty = selectedSizes[sz] || 0;
                      if (qty > 0) return (
                        <div key={idx} className="py-3 rounded-xl border-2 border-white bg-zinc-900 flex flex-col items-center justify-center gap-1.5">
                          <span className="text-sm font-black text-white">{sz}</span>
                          <div className="flex items-center gap-2 bg-zinc-950 rounded-md px-1.5 py-1 border border-zinc-800">
                            <button onClick={() => { const n = {...selectedSizes}; if(n[sz]>1) n[sz]--; else delete n[sz]; setSelectedSizes(n); }} className="text-zinc-400 touch-manipulation"><Minus size={11}/></button>
                            <span className="text-[10px] font-black text-white w-3 text-center">{qty}</span>
                            <button onClick={() => handleSizeSelect(sz, stock)} className="text-zinc-400 touch-manipulation"><Plus size={11}/></button>
                          </div>
                        </div>
                      );
                      return (
                        <button
                          key={idx}
                          disabled={isEsgotado}
                          onClick={() => !isEsgotado && handleSizeSelect(sz, stock)}
                          className={`py-4 rounded-xl border font-black text-sm transition-all touch-manipulation flex flex-col items-center justify-center gap-0.5 ${isEsgotado ? 'bg-zinc-900/40 border-zinc-800/50 cursor-not-allowed' : 'bg-zinc-900 border-zinc-800 text-zinc-300 active:scale-95'}`}
                        >
                          <span className={isEsgotado ? 'text-zinc-700 line-through text-xs' : ''}>{sz}</span>
                          {isEsgotado && <span className="text-[7px] text-zinc-700 font-black uppercase">Esgotado</span>}
                          {isLowStock && !isEsgotado && <span className="text-[7px] text-red-400 font-black">Ult. {stock}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Trust signals */}
                <div className="grid grid-cols-3 gap-3 pt-8 border-t border-white/5">
                  <div className="flex flex-col items-center gap-2 text-center">
                    <div className="w-11 h-11 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center"><ShieldCheck size={16} className="text-emerald-500"/></div>
                    <span className="text-[9px] font-black text-zinc-500 uppercase tracking-wide leading-tight">Compra Segura</span>
                  </div>
                  <div className="flex flex-col items-center gap-2 text-center">
                    <div className="w-11 h-11 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center"><Truck size={16} className="text-emerald-500"/></div>
                    <span className="text-[9px] font-black text-zinc-500 uppercase tracking-wide leading-tight">Envio Rápido</span>
                  </div>
                  <div className="flex flex-col items-center gap-2 text-center">
                    <div className="w-11 h-11 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center"><MessageCircle size={16} className="text-emerald-500"/></div>
                    <span className="text-[9px] font-black text-zinc-500 uppercase tracking-wide leading-tight">Suporte WA</span>
                  </div>
                </div>

                {/* Avaliações */}
                <ProductReviewsList productId={selectedProduct.id} />

                {/* Produtos relacionados */}
                {relatedProducts.length > 0 && (
                  <div>
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-4">Você também pode gostar</p>
                    <div className="grid grid-cols-2 gap-3">
                      {relatedProducts.map(p => (
                        <motion.button
                          key={p.id}
                          whileTap={{ scale: 0.96 }}
                          onClick={() => { setSelectedProduct(p); setSelectedSizes({}); setActiveProductImage(p.image); }}
                          className="text-left group"
                        >
                          <div className="aspect-[3/4] rounded-xl overflow-hidden bg-zinc-900 border border-white/5 relative mb-2">
                            <img src={optimizeImage(p.image, 400, 80)} className="w-full h-full object-cover group-active:scale-105 transition-transform duration-300" alt={p.name} loading="lazy" />
                          </div>
                          <p className="text-[10px] font-black text-zinc-300 uppercase truncate">{p.name}</p>
                          <p className="text-[11px] font-black text-emerald-500">{formatBRL(p.promotional_price || p.price || 0)}</p>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* CTA fixo no rodapé do viewport (mobile) */}
              <div className="fixed bottom-0 left-0 right-0 px-7 py-4 bg-zinc-950/95 backdrop-blur-xl border-t border-white/10 z-[60] lg:hidden" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
                <button
                  onClick={handleCommitToCart}
                  disabled={Object.keys(selectedSizes).length === 0}
                  className={`w-full py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 touch-manipulation ${Object.keys(selectedSizes).length === 0 ? 'bg-zinc-900 text-zinc-700' : 'bg-emerald-500 text-zinc-950 shadow-[0_10px_30px_rgba(16,185,129,0.3)] active:scale-[0.98]'}`}
                >
                  {Object.keys(selectedSizes).length === 0 ? 'Escolha um Tamanho' : `Adicionar à Sacola (${Object.values(selectedSizes).reduce((a,b)=>a+b,0)})`} <ShoppingBag size={14}/>
                </button>
              </div>
          </motion.div>

          {/* ── DESKTOP: página de produto real (oculto no mobile) ── */}
          <motion.div
            className="hidden lg:block fixed inset-0 z-30 overflow-y-auto bg-zinc-950"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            {/* Espaçador do header */}
            <div className="h-20 lg:h-[68px]" />

            {/* CONTEÚDO — container centralizado e limitado */}
            <div className="max-w-[1280px] mx-auto px-8 py-12 flex gap-14 items-start">

              {/* COLUNA ESQUERDA — galeria controlada */}
              <div className="flex-1 min-w-0">
                {/* Imagem principal: altura controlada, peça inteira visível */}
                <button
                  onClick={() => setZoomImage(heroImg)}
                  className="block w-full bg-zinc-900 rounded-2xl overflow-hidden group relative"
                  style={{ maxHeight: '640px' }}
                  aria-label="Ampliar foto"
                >
                  <img
                    src={optimizeImage(heroImg, 1200, 90)}
                    className="w-full object-contain transition-transform duration-500 group-hover:scale-[1.03]"
                    style={{ maxHeight: '640px' }}
                    alt={selectedProduct.name}
                    fetchPriority="high"
                  />
                  <div className="absolute bottom-4 right-4 text-[9px] font-black text-white bg-black/60 backdrop-blur-md rounded-full px-3 py-1.5 uppercase tracking-widest border border-white/10 flex items-center gap-1.5 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <ZoomIn size={10}/> Ampliar
                  </div>
                </button>
                {/* Thumbs */}
                {productGallery.length > 1 && (
                  <div className="mt-4 flex gap-3 overflow-x-auto no-scrollbar" style={{ touchAction: 'pan-x pan-y' }}>
                    {productGallery.map((g, i) => (
                      <button key={i} onClick={() => setActiveProductImage(g)} className={`shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition-all ${heroImg === g ? 'border-emerald-400 shadow-[0_0_16px_rgba(16,185,129,0.5)] scale-105' : 'border-white/10 opacity-50 hover:opacity-100'}`}>
                        <img src={optimizeImage(g, 300, 80)} className="w-full h-full object-cover" alt="" loading="lazy" decoding="async" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* COLUNA DIREITA — painel de compra sticky, em superfície (cara de site grande) */}
              <div className="w-[440px] shrink-0">
                <div className="sticky top-[92px] rounded-3xl border border-white/10 bg-zinc-900/30 p-9">

                  {/* Topo: caminho + fechar na mesma linha */}
                  <div className="flex items-start justify-between gap-4 mb-8">
                    {renderBreadcrumb()}
                    <button
                      onClick={() => { setSelectedProduct(null); setSelectedSizes({}); }}
                      aria-label="Fechar"
                      className="shrink-0 w-9 h-9 -mt-1.5 -mr-1.5 flex items-center justify-center rounded-full text-zinc-400 hover:text-white bg-zinc-900 border border-white/10 transition-colors hover:bg-zinc-800"
                    >
                      <X size={16}/>
                    </button>
                  </div>

                  {/* Cabeçalho do produto — nome herói, rating/ref subordinados */}
                  <h1 className="text-[40px] font-black text-white leading-[1.03] uppercase tracking-tight mb-4">{selectedProduct.name}</h1>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-8">
                    <StarRatingInline
                      product={selectedProduct}
                      ratingsMap={ratingsMap}
                      userProfile={userProfile}
                      setRatingsMap={setRatingsMap}
                      setShowUserDrawer={setShowUserDrawer}
                      setDrawerTab={setDrawerTab}
                      showToast={showToast}
                    />
                    <span className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)' }}>Ref. {selectedProduct.sku}</span>
                  </div>

                  {/* Preço */}
                  {isOfferLive(selectedProduct) ? (
                    <div className="mb-8 p-[1.5px] rounded-3xl bg-gradient-to-br from-amber-400/50 via-amber-500/10 to-red-500/40">
                      <div className="rounded-[22px] bg-zinc-950/80 p-5 space-y-4">
                        <div className="flex items-center gap-2.5">
                          <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: '#fbbf24' }}>
                            <Flame size={13} className="fill-amber-400 text-amber-400"/> Oferta do Dia
                          </span>
                          <span className="text-[11px] font-black text-zinc-950 px-2.5 py-1 rounded-lg bg-gradient-to-r from-amber-400 to-red-500 shadow-[0_4px_14px_rgba(245,158,11,0.4)]">-{offerPercent(selectedProduct)}% OFF</span>
                        </div>
                        <div className="flex items-baseline gap-4">
                          <span className="text-5xl font-black tracking-tighter tabular-nums" style={{ color: '#fde68a' }}>{formatBRL(offerPrice(selectedProduct))}</span>
                          <span className="text-xl font-bold text-zinc-500 line-through tabular-nums">{formatBRL(selectedProduct.price || 0)}</span>
                        </div>
                        <OfferCountdown target={offerEndsAt(selectedProduct)} variant="full" onExpire={bumpOffers} />
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">Acaba à meia-noite · itens em oferta não acumulam os 5% do Pix</p>
                      </div>
                    </div>
                  ) : selectedProduct.promotional_price ? (
                    <div className="flex items-baseline gap-4 mb-8">
                      <span className="text-5xl font-black tracking-tighter tabular-nums" style={{ color: 'var(--text-primary)' }}>{formatBRL(selectedProduct.promotional_price)}</span>
                      <span className="text-xl font-bold text-zinc-500 line-through tabular-nums">{formatBRL(selectedProduct.price || 0)}</span>
                    </div>
                  ) : (
                    <p className="text-5xl font-black tracking-tighter tabular-nums mb-8" style={{ color: 'var(--text-primary)' }}>{formatBRL(selectedProduct.price || 0)}</p>
                  )}

                  {/* Tamanho — seção com divisor */}
                  <div className="border-t border-white/10 pt-8 mb-8">
                    <p className="text-[11px] font-black text-white uppercase tracking-[0.22em] mb-4">Selecione o Tamanho</p>
                    <div className="grid grid-cols-5 gap-2.5">
                      {(selectedProduct.sizes || []).filter(s => { const stock = typeof s === 'string' ? selectedProduct.stock : s.stock; return Number(stock || 0) > 0; }).map((s, idx) => {
                        const sz = typeof s === 'string' ? s : s.size;
                        const stock = typeof s === 'string' ? selectedProduct.stock : s.stock;
                        const qty = selectedSizes[sz] || 0;
                        if (qty > 0) return (
                          <div key={idx} className="py-3 rounded-xl border-2 border-white bg-zinc-900 flex flex-col items-center justify-center gap-1.5">
                            <span className="text-sm font-black text-white">{sz}</span>
                            <div className="flex items-center gap-2 bg-zinc-950 rounded-md px-1.5 py-1 border border-zinc-800">
                              <button onClick={() => { const n = {...selectedSizes}; if(n[sz]>1) n[sz]--; else delete n[sz]; setSelectedSizes(n); }} className="text-zinc-400 hover:text-white transition-colors"><Minus size={11}/></button>
                              <span className="text-[11px] font-black text-white w-4 text-center">{qty}</span>
                              <button onClick={() => handleSizeSelect(sz, stock)} className="text-zinc-400 hover:text-white transition-colors"><Plus size={11}/></button>
                            </div>
                          </div>
                        );
                        return <button key={idx} disabled={stock <= 0} onClick={() => handleSizeSelect(sz, stock)} className={`py-4 rounded-xl border font-black text-sm transition-all ${stock > 0 ? 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:border-white hover:text-white hover:bg-zinc-800' : 'bg-zinc-900/50 border-zinc-800 text-zinc-600 opacity-40 cursor-not-allowed'}`}>{sz}</button>;
                      })}
                    </div>
                  </div>

                  {/* CTA */}
                  <button onClick={handleCommitToCart} disabled={Object.keys(selectedSizes).length === 0} className={`w-full py-5 rounded-2xl font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-3 ${Object.keys(selectedSizes).length === 0 ? 'bg-zinc-900 text-zinc-600 cursor-not-allowed' : 'bg-emerald-500 text-zinc-950 shadow-[0_10px_40px_rgba(16,185,129,0.35)] hover:bg-emerald-400 hover:shadow-[0_10px_50px_rgba(16,185,129,0.5)]'}`}>
                    {Object.keys(selectedSizes).length === 0 ? 'Escolha um Tamanho' : `Adicionar à Sacola — ${Object.values(selectedSizes).reduce((a,b)=>a+b,0)} ${Object.values(selectedSizes).reduce((a,b)=>a+b,0) === 1 ? 'peça' : 'peças'}`}
                    <ShoppingBag size={16}/>
                  </button>

                  {/* Trust signals */}
                  <div className="mt-8 pt-8 border-t border-white/10 grid grid-cols-3 gap-4">
                    <div className="flex flex-col items-center gap-2 text-center">
                      <div className="w-11 h-11 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center"><ShieldCheck size={17} className="text-emerald-500"/></div>
                      <span className="text-[9px] font-black text-zinc-500 uppercase tracking-wider">Compra Segura</span>
                    </div>
                    <div className="flex flex-col items-center gap-2 text-center">
                      <div className="w-11 h-11 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center"><Truck size={17} className="text-emerald-500"/></div>
                      <span className="text-[9px] font-black text-zinc-500 uppercase tracking-wider">Envio Rápido</span>
                    </div>
                    <div className="flex flex-col items-center gap-2 text-center">
                      <div className="w-11 h-11 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center"><MessageCircle size={17} className="text-emerald-500"/></div>
                      <span className="text-[9px] font-black text-zinc-500 uppercase tracking-wider">Suporte WhatsApp</span>
                    </div>
                  </div>

                </div>{/* fim painel sticky */}
              </div>{/* fim coluna direita */}
          </div>{/* fim container max-w */}

          {/* Related products — desktop */}
          {relatedProducts.length > 0 && (
            <div className="max-w-[1320px] mx-auto px-10 pb-16">
              <div className="border-t border-white/10 pt-10">
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-6">Você também pode gostar</p>
                <div className="grid grid-cols-4 gap-4">
                  {relatedProducts.map(p => (
                    <motion.button
                      key={p.id}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => { setSelectedProduct(p); setSelectedSizes({}); setActiveProductImage(p.image); }}
                      className="text-left group"
                    >
                      <div className="aspect-[3/4] rounded-2xl overflow-hidden bg-zinc-900 border border-white/5 relative mb-3">
                        <img src={optimizeImage(p.image, 400, 80)} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={p.name} loading="lazy" />
                      </div>
                      <p className="text-[11px] font-black text-zinc-300 uppercase truncate">{p.name}</p>
                      <p className="text-sm font-black text-emerald-500">{formatBRL(p.promotional_price || p.price || 0)}</p>
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>
          )}
          </motion.div>{/* fim desktop */}
        </React.Fragment>
        );
      })()}
      </AnimatePresence>

      {/* BARRA FLUTUANTE DA SACOLA */}
      {cart.length > 0 && !showCart && !isCartModalOpen && !productPageOpen && (
        <div
          className="fixed bottom-0 left-0 right-0 z-[90] pt-3 md:left-auto md:right-6 md:bottom-6 md:w-auto md:pt-0 pointer-events-none"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)', paddingLeft: '1rem', paddingRight: '1rem' }}
        >
          <button
            onClick={() => setShowCart(true)}
            className="pointer-events-auto w-full md:w-auto flex items-center justify-between md:justify-start gap-4 bg-zinc-900 text-white border border-white/10 px-5 py-4 md:px-6 md:py-4 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] touch-manipulation active:scale-95 transition-transform"
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <ShoppingBag size={22} strokeWidth={2.5} className="text-emerald-400" />
                <span className="absolute -top-2 -right-2 bg-emerald-500 text-zinc-950 text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                  {cart.reduce((a, i) => a + i.quantity, 0)}
                </span>
              </div>
              <div className="flex flex-col items-start leading-tight">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Ver Sacola</span>
                <span className="text-[11px] font-black text-white">{formatBRL(subtotal)}</span>
              </div>
            </div>
            <ChevronRight size={18} strokeWidth={3} className="md:hidden text-zinc-500" />
          </button>
        </div>
      )}

      {/* MODAL — Adicionado ao Carrinho */}
      {isCartModalOpen && (
        <div className="fixed inset-x-0 z-[200] flex items-end sm:items-center justify-center overflow-hidden" style={viewportOverlayStyle}>
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsCartModalOpen(false)} />
          <div className="relative w-full sm:max-w-md bg-zinc-950 border border-zinc-800 rounded-t-3xl sm:rounded-2xl px-6 pt-8 pb-7 animate-slide-up">
            <div className="flex justify-center mb-5">
              <div className="w-14 h-14 rounded-full border-2 border-emerald-500 flex items-center justify-center">
                <Check size={28} className="text-emerald-500" strokeWidth={3} />
              </div>
            </div>
            <h3 className="text-center text-white font-black text-lg uppercase tracking-wide">Adicionado ao Carrinho</h3>
            <p className="text-center text-zinc-400 text-sm mt-2 mb-7">A sua peça foi separada com sucesso.</p>
            <div className="space-y-3">
              <button
                onClick={() => { setIsCartModalOpen(false); setShowCart(true); }}
                className="w-full py-4 rounded-xl bg-emerald-500 text-white font-black text-[12px] uppercase tracking-widest active:scale-95 transition-transform touch-manipulation"
              >
                Ir para o Carrinho
              </button>
              <button
                onClick={() => setIsCartModalOpen(false)}
                className="w-full py-4 rounded-xl bg-transparent border-2 border-zinc-800 text-white font-black text-[12px] uppercase tracking-widest active:scale-95 transition-transform touch-manipulation"
              >
                Continuar Comprando
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX — Zoom em tela cheia */}
      {zoomImage && (
        <div
          className="fixed inset-x-0 z-[300] bg-black/95 backdrop-blur-xl flex items-center justify-center animate-in p-4 overflow-hidden"
          style={viewportOverlayStyle}
          onClick={() => setZoomImage(null)}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setZoomImage(null); }}
            className="absolute top-6 right-6 text-white bg-white/10 backdrop-blur-md rounded-full p-3 touch-manipulation border border-white/20 active:scale-90 transition-transform z-10"
            aria-label="Fechar"
          >
            <X size={20}/>
          </button>
          <img
            src={optimizeImage(zoomImage, 1200, 90)}
            alt="Visualização ampliada"
            className="max-w-full max-h-full object-contain rounded-3xl shadow-[0_20px_80px_rgba(0,0,0,0.6)] animate-in"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[9px] font-black text-white/60 uppercase tracking-widest">
            Toque fora para fechar
          </div>
        </div>
      )}

      <AnimatePresence>
      {showCart && (
        <motion.div
          key="cart-overlay"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-x-0 z-[150] bg-zinc-950 overflow-y-auto" style={viewportOverlayStyle}>
          <div className="max-w-md mx-auto min-h-screen flex flex-col bg-zinc-950 relative">
            <div className="sticky top-0 bg-zinc-950/80 backdrop-blur-xl border-b border-white/5 px-6 py-6 flex justify-between items-center h-20 z-10">
              <h2 className="text-xl font-black uppercase text-white">Sua Sacola <span className="bg-white text-zinc-950 text-[10px] px-2 py-0.5 rounded-full ml-2">{cart.length}</span></h2>
              <button onClick={() => setShowCart(false)} className="p-2 text-zinc-400 bg-zinc-900 rounded-full touch-manipulation"><X size={18}/></button>
            </div>
            
            <div className="flex-1 space-y-4 px-6 py-6 pb-64">
                {cart.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 opacity-50 animate-in">
                       <ShoppingBag size={48} className="mb-4 text-zinc-600"/>
                       <h3 className="font-black uppercase text-sm tracking-widest text-zinc-400">Sua sacola está vazia</h3>
                       <button onClick={() => setShowCart(false)} className="mt-6 border border-white/20 text-[10px] font-black uppercase px-6 py-3 rounded-full text-white hover:bg-white hover:text-zinc-950 transition-colors">Voltar para a loja</button>
                    </div>
                ) : (
                    cart.map(item => (
                      <div key={item.itemKey} className="bg-zinc-900/50 p-3 rounded-[24px] border border-white/5 flex gap-4 shadow-sm animate-in">
                        <img src={item.image} className="w-20 h-24 rounded-[16px] object-cover border border-white/5" alt="Item" />
                        <div className="flex-1 flex flex-col justify-between py-1">
                          <div className="flex justify-between items-start">
                            <div className="overflow-hidden pr-2"><h4 className="font-black text-white text-[11px] uppercase truncate leading-tight">{item.name}</h4><span className="text-[9px] font-bold text-zinc-500 uppercase block mt-0.5">Tam: {item.size}</span></div>
                            <button onClick={() => setCart(cart.filter(i => i.itemKey !== item.itemKey))} className="text-zinc-600 hover:text-red-500 touch-manipulation"><Trash2 size={16}/></button>
                          </div>
                          <div className="flex justify-between items-center mt-3">
                            <span className={`font-black text-sm flex items-center gap-1.5 ${item.offer_applied ? 'text-amber-400' : 'text-emerald-500'}`}>
                              {formatBRL(item.price || 0)}
                              {item.offer_applied && <span className="text-[7px] font-black text-zinc-950 px-1.5 py-0.5 rounded bg-gradient-to-r from-amber-400 to-red-500 tracking-wide">OFERTA</span>}
                            </span>
                            <div className="flex items-center bg-zinc-950 rounded-lg border border-white/5 p-1">
                              <button onClick={() => { if(item.quantity > 1) setCart(cart.map(i => i.itemKey === item.itemKey ? {...i, quantity: i.quantity - 1} : i)) }} className="text-zinc-400 p-1.5 touch-manipulation"><Minus size={12}/></button>
                              <span className="font-black text-xs text-white w-6 text-center">{item.quantity}</span>
                              <button onClick={() => {
                                 const p = products.find(x => x.id === item.id);
                                 const sz = (p.sizes || []).find(s => (typeof s === 'string' ? s : s.size) === item.size);
                                 const max = sz ? (typeof sz === 'string' ? p.stock : sz.stock) : p.stock;
                                 if (item.quantity < max) setCart(cart.map(i => i.itemKey === item.itemKey ? {...i, quantity: i.quantity + 1} : i));
                                 else showToast(`Estoque máximo!`, 'error');
                              }} className="text-zinc-400 p-1.5 touch-manipulation"><Plus size={12}/></button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                )}
            </div>
            {cart.length > 0 && (
              <div className="fixed bottom-0 left-0 right-0 bg-zinc-950/95 backdrop-blur-xl border-t border-white/10 px-6 py-6 max-w-md mx-auto z-50 shadow-2xl">
                <div className="space-y-2 mb-4">
                   <div className="flex justify-between items-center text-[11px] font-bold uppercase text-zinc-400"><span>Subtotal</span><span>{formatBRL(subtotal)}</span></div>
                   <div className="flex justify-between items-center text-[11px] font-bold uppercase"><span className="text-zinc-400 inline-flex items-center gap-1.5"><span style={{ color: '#32BCAD', display: 'inline-flex' }}><PixIcon size={12} /></span>Desconto Pix (5%)</span><span className="text-emerald-500">- {formatBRL(pixDiscount)}</span></div>
                   {hasOfferInCart && (
                     <div className="flex items-start gap-1.5 text-[9px] font-bold text-amber-400/90 uppercase tracking-wide leading-snug">
                       <Flame size={11} className="shrink-0 mt-px fill-amber-400 text-amber-400" />
                       <span>Itens em oferta já estão com desconto e não acumulam os 5% do Pix.</span>
                     </div>
                   )}
                   <div className="flex justify-between items-end pt-3 border-t border-white/10">
                     <div className="flex flex-col">
                       <p className="text-[12px] font-black text-white uppercase tracking-widest inline-flex items-center gap-1.5"><span style={{ color: '#32BCAD', display: 'inline-flex' }}><PixIcon size={13} /></span>Total no Pix</p>
                       <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wide">ou {formatBRL(subtotal)} em até 4x sem juros</span>
                     </div>
                     <h3 className="text-3xl font-black text-emerald-500 tracking-tighter">{formatBRL(totalComPix)}</h3>
                   </div>
                </div>
                {/* Entrega local — diferencial Uberaba */}
                <div className="flex flex-col gap-2 mb-4 p-3 rounded-2xl" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}>
                   <div className="flex items-center gap-2"><Zap size={13} className="text-emerald-500 shrink-0" /><span className="text-[10px] font-bold text-white">Entrega no mesmo dia em Uberaba</span></div>
                   <div className="flex items-center gap-2"><MapPin size={13} className="text-emerald-500 shrink-0" /><span className="text-[10px] font-bold text-zinc-300">Ou retire na loja</span></div>
                   <div className="flex items-center gap-2"><Truck size={13} className="text-zinc-500 shrink-0" /><span className="text-[10px] font-bold text-zinc-500">Outras regiões: frete combinado no WhatsApp</span></div>
                </div>
                <button onClick={() => { emitSignal('checkout_aberto', { cart: cartSnapshot(cart) }); setShowCart(false); setShowLeadModal(true); }} className="w-full py-5 rounded-2xl font-black text-[11px] uppercase bg-white text-zinc-950 active:scale-95 shadow-2xl flex items-center justify-center gap-2 touch-manipulation">Finalizar Pedido <Lock size={14}/></button>
              </div>
            )}
          </div>
        </motion.div>
      )}
      </AnimatePresence>

      <AnimatePresence>
      {showLeadModal && (
        <motion.div
          key="lead-modal"
          className="fixed inset-x-0 z-[200] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6 overflow-hidden"
          style={viewportOverlayStyle}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="bg-zinc-950 w-full max-w-sm rounded-[32px] p-8 space-y-6 shadow-2xl border border-white/10 relative overflow-hidden">
            <button onClick={() => { setShowLeadModal(false); setCheckoutSuccess(false); }} className="absolute top-5 right-5 text-zinc-500 bg-zinc-900 p-2 rounded-full touch-manipulation"><X size={16}/></button>
            {checkoutSuccess ? (
              <div className="text-center relative z-10 space-y-2 mt-4 animate-in">
                 <div className="w-20 h-20 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/20"><CheckCircle2 size={40}/></div>
                 <h3 className="text-2xl font-black uppercase text-white tracking-tighter">Pedido Pronto!</h3>
                 <div className="inline-block bg-zinc-900 border border-white/10 rounded-xl px-4 py-2 mt-2 mb-4"><span className="text-[9px] text-zinc-500 uppercase font-black block">Código do Pedido</span><span className="text-emerald-500 font-black text-xl tracking-widest">#{checkoutOrderNumber}</span></div>
                 <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest px-2 mb-6 text-center">Agora, envie no WhatsApp para validarmos seu envio e combinarmos o frete.</p>
                 <button
                   type="button"
                   onClick={() => {
                     if (!whatsappLink) { showToast('Cadastre um número de WhatsApp válido no Master Control.', 'error'); return; }
                     window.open(whatsappLink, '_blank');
                   }}
                   className="w-full py-5 mt-4 bg-emerald-500 text-zinc-950 rounded-xl font-black text-[11px] uppercase tracking-widest active:scale-95 flex justify-center items-center gap-2 touch-manipulation"
                 >Enviar WhatsApp <Zap size={14}/></button>
                 <button
                   type="button"
                   onClick={() => { setShowLeadModal(false); setCheckoutSuccess(false); }}
                   className="w-full py-3 mt-2 text-zinc-500 hover:text-white font-black text-[10px] uppercase tracking-widest transition-colors"
                 >Fechar</button>
               </div>
             ) : (
               <div className="animate-in">
                 <div className="text-center relative z-10 space-y-2 mt-4">
                   <div className="w-16 h-16 bg-white text-zinc-950 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl"><ShieldCheck size={30}/></div>
                   <h3 className="text-2xl font-black uppercase text-white tracking-tighter">Dados de Entrega</h3>
                   <p className="text-zinc-400 text-[10px] font-bold uppercase">Preencha os dados para concluir seu pedido.</p>
                 </div>
                 <div className="space-y-4 relative z-10 text-left pt-6">
                   <div className="space-y-1"><label className="text-[9px] font-black uppercase text-zinc-500 px-2 tracking-widest">Nome Completo</label><input placeholder="Ex: João da Silva" className="w-full p-4 bg-zinc-900 border border-white/5 rounded-xl text-[16px] font-bold text-white outline-none focus:border-white/30 shadow-inner client-input" value={currentLead.name} onChange={e => setCurrentLead({...currentLead, name: e.target.value})} /></div>
                   <div className="space-y-1"><label className="text-[9px] font-black uppercase text-zinc-500 px-2 tracking-widest">WhatsApp (Com DDD)</label><input placeholder="Ex: 34999999999" type="tel" className="w-full p-4 bg-zinc-900 border border-white/5 rounded-xl text-[16px] font-bold text-white outline-none focus:border-white/30 shadow-inner client-input" value={currentLead.phone} onChange={e => {
                     const ph = e.target.value.replace(/\D/g, '');
                     setCurrentLead({ ...currentLead, phone: ph });
                     // Capturou contato: identifica o lead e liga todo o histórico anônimo ao telefone
                     if (ph.length >= 10) { setKnownLead(ph, currentLead.name); emitSignal('telefone_informado', { phone: ph, name: currentLead.name, cart: cartSnapshot(cart) }); }
                   }} /></div>
                 <button onClick={handleFinalize} disabled={isLoading} className="w-full py-5 bg-emerald-500 text-zinc-950 rounded-xl font-black text-[11px] uppercase tracking-widest active:scale-95 mt-2 flex justify-center items-center gap-2 touch-manipulation">{isLoading ? 'Processando...' : 'Finalizar Pedido via WhatsApp'} <Zap size={14}/></button>
                </div>
                <p className="text-[8px] font-bold uppercase tracking-widest text-zinc-600 flex items-center justify-center gap-1 opacity-70 mt-6"><Lock size={10}/> Ambiente 100% Seguro</p>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      <AnimatePresence>
      {showMyOrders && (
        <motion.div
          key="my-orders-modal"
          className="fixed inset-x-0 z-[200] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6 overflow-hidden"
          style={viewportOverlayStyle}
          data-testid="modal-my-orders"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="bg-zinc-950 w-full max-w-sm rounded-[32px] p-8 space-y-5 shadow-2xl border border-white/10 relative overflow-hidden max-h-[90vh] flex flex-col">
	            <button onClick={() => { setShowMyOrders(false); setMyOrdersResults(null); setMyOrdersPhone(''); }} className="absolute top-5 right-5 text-zinc-500 bg-zinc-900 p-2 rounded-full touch-manipulation z-10" data-testid="btn-close-my-orders"><X size={16}/></button>
	            <div className="text-center space-y-2 shrink-0">
	              <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto border border-emerald-500/20"><ClipboardList size={28}/></div>
	              <h3 className="text-2xl font-black uppercase text-white tracking-tighter">Meus Pedidos</h3>
	              <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Digite seu WhatsApp para consultar</p>
	            </div>

	            <div className="flex gap-2 shrink-0">
	              <input
	                placeholder="Ex: 34999999999"
	                type="tel"
	                className="flex-1 p-4 bg-zinc-900 border border-white/5 rounded-xl text-[16px] font-bold text-white outline-none focus:border-emerald-500/30 client-input"
	                value={myOrdersPhone}
	                onChange={(e) => setMyOrdersPhone(e.target.value.replace(/\D/g, ''))}
	                onKeyDown={(e) => { if (e.key === 'Enter') handleSearchMyOrders(); }}
	                data-testid="input-my-orders-phone"
	              />
	              <button onClick={handleSearchMyOrders} disabled={myOrdersLoading} className="px-5 bg-emerald-500 text-zinc-950 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 disabled:opacity-50" data-testid="btn-search-my-orders">
	                {myOrdersLoading ? '...' : 'Buscar'}
	              </button>
	            </div>

	            <div className="flex-1 overflow-y-auto space-y-3 -mx-2 px-2">
	              {myOrdersResults === null ? (
	                <div className="text-center py-8 text-zinc-600 text-[10px] font-bold uppercase tracking-widest">Informe seu número acima</div>
	              ) : myOrdersResults.length === 0 ? (
	                <div className="text-center py-8 text-zinc-600 text-[10px] font-bold uppercase tracking-widest">Nenhum pedido encontrado para este número</div>
	              ) : (
	                myOrdersResults.map((row) => {
	                  const its = typeof row.items === 'string' ? (() => { try { return JSON.parse(row.items); } catch { return []; } })() : (row.items || []);
	                  const st = String(row.status || 'NOVO').toUpperCase();
	                  const stMap = { 'CONFIRMED': 'CONCLUÍDO', 'CONCLUIDO': 'CONCLUÍDO', 'CANCELLED': 'CANCELADO' };
	                  const status = stMap[st] || st;
	                  const color = status === 'CONCLUÍDO' ? 'text-emerald-500 bg-emerald-500/10' : status === 'CANCELADO' ? 'text-red-500 bg-red-500/10' : status === 'EM ATENDIMENTO' ? 'text-amber-500 bg-amber-500/10' : 'text-blue-500 bg-blue-500/10';
	                  return (
	                    <div key={row.id} className="bg-zinc-900 rounded-2xl p-4 border border-white/5" data-testid={`my-order-${row.order_number}`}>
	                      <div className="flex justify-between items-center mb-2">
	                        <span className="text-[10px] font-black uppercase text-white">#{row.order_number}</span>
	                        <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-full ${color}`}>{status}</span>
	                      </div>
	                      <div className="text-[9px] text-zinc-500 font-bold uppercase mb-2">{row.created_at ? new Date(row.created_at).toLocaleString('pt-BR') : ''}</div>
	                      <div className="space-y-1">
	                        {(its || []).map((it, i) => (
	                          <div key={i} className="text-[10px] text-zinc-300 font-bold flex justify-between">
	                            <span className="truncate pr-2">{it.qty || 1}x {it.name} <span className="text-emerald-500">({it.size || 'U'})</span></span>
	                            <span className="text-zinc-500 shrink-0">{formatBRL(it.price || 0)}</span>
	                          </div>
	                        ))}
	                      </div>
	                      <div className="flex justify-between items-center pt-2 mt-2 border-t border-white/5">
	                        <span className="text-[9px] text-zinc-500 font-black uppercase">Total</span>
	                        <span className="text-[13px] font-black text-emerald-500">{formatBRL(row.value || 0)}</span>
	                      </div>
	                    </div>
	                  );
	                })
	              )}
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      <AnimatePresence>
      {showUserDrawer && (
        <motion.div
          key="user-drawer-overlay"
          className="fixed inset-x-0 z-[200] flex items-end justify-center overflow-hidden"
          style={viewportOverlayStyle}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/85 backdrop-blur-sm"
            onClick={() => setShowUserDrawer(false)}
          />

          {/* Panel */}
          <motion.div
            className="relative bg-zinc-950 w-full max-w-md rounded-t-[40px] border-t border-white/10 shadow-2xl flex flex-col overflow-hidden"
            style={{ maxHeight: viewportPanelMaxHeight }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Drag handle */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-white/20 rounded-full pointer-events-none z-10" />

            {/* Fechar */}
            <button
              onClick={() => setShowUserDrawer(false)}
              className="absolute top-4 right-4 z-20 text-white bg-black/50 backdrop-blur-md rounded-full p-2.5 touch-manipulation border border-white/10 active:scale-90 transition-transform"
            >
              <X size={18} />
            </button>

            {/* Header do drawer */}
            <div className="px-7 pt-10 pb-5 shrink-0">
              {userProfile ? (
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-emerald-500/15 border-2 border-emerald-500/50 flex items-center justify-center shrink-0">
                    <span className="text-lg font-black text-emerald-400 leading-none select-none">
                      {userProfile.name.trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('')}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-emerald-500/70 uppercase tracking-widest">Usuário Fluxo</p>
                    <h3 className="text-lg font-black text-white uppercase leading-tight truncate">
                      {userProfile.name.split(' ')[0]}
                    </h3>
                    <p className="text-[11px] font-bold text-zinc-500 mt-0.5">+55 {userProfile.phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center shrink-0">
                    <User size={24} className="text-zinc-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Bem-vindo</p>
                    <h3 className="text-lg font-black text-white uppercase leading-tight">Minha Conta</h3>
                    <p className="text-[10px] text-zinc-600 mt-0.5 font-bold">Crie seu perfil Fluxo</p>
                  </div>
                </div>
              )}
            </div>

            {/* Tabs — só aparece se identificado */}
            {userProfile && (
              <div className="px-5 pb-3 shrink-0">
                <div className="grid grid-cols-2 gap-1 p-1 bg-zinc-900 rounded-2xl border border-white/5">
                  <button
                    onClick={() => setDrawerTab('profile')}
                    className={`py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                      drawerTab === 'profile'
                        ? 'bg-white text-zinc-950 shadow'
                        : 'text-zinc-500 hover:text-white'
                    }`}
                  >
                    Perfil
                  </button>
                  <button
                    onClick={() => {
                      setDrawerTab('orders');
                      if (myOrdersResults === null && userProfile?.phone) {
                        setMyOrdersPhone(userProfile.phone);
                        setTimeout(() => handleSearchMyOrders(), 100);
                      }
                    }}
                    className={`py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                      drawerTab === 'orders'
                        ? 'bg-emerald-500 text-zinc-950 shadow'
                        : 'text-zinc-500 hover:text-white'
                    }`}
                  >
                    Pedidos
                  </button>
                </div>
              </div>
            )}

            {/* Corpo scrollável */}
            <div className="flex-1 overflow-y-auto px-7 pb-10 pt-2 space-y-4">

              {/* TAB PERFIL */}
              {(drawerTab === 'profile' || !userProfile) && (
                <div className="space-y-4 animate-in">
                  {!userProfile && (
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest leading-relaxed">
                      Salve seu nome e WhatsApp para agilizar seus próximos pedidos. Totalmente opcional.
                    </p>
                  )}

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest px-1">Nome completo</label>
                      <input
                        placeholder="Ex: João Silva"
                        className="w-full p-4 bg-zinc-900 border border-white/5 rounded-xl text-[16px] font-bold text-white outline-none focus:border-emerald-500/30 client-input"
                        value={userProfile ? userProfile.name : profileForm.name}
                        onChange={e => {
                          if (userProfile) {
                            saveUserProfile({ ...userProfile, name: e.target.value });
                          } else {
                            setProfileForm(f => ({ ...f, name: e.target.value }));
                          }
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest px-1">WhatsApp (com DDD)</label>
                      <input
                        placeholder="Ex: 34999999999"
                        type="tel"
                        className="w-full p-4 bg-zinc-900 border border-white/5 rounded-xl text-[16px] font-bold text-white outline-none focus:border-emerald-500/30 client-input"
                        value={userProfile ? userProfile.phone : profileForm.phone}
                        onChange={e => {
                          const v = e.target.value.replace(/\D/g, '');
                          if (userProfile) {
                            saveUserProfile({ ...userProfile, phone: v });
                          } else {
                            setProfileForm(f => ({ ...f, phone: v }));
                          }
                        }}
                      />
                    </div>
                  </div>

                  {/* Botão salvar — só anônimo */}
                  {!userProfile && (
                    <button
                      onClick={() => {
                        const name = profileForm.name.trim();
                        const phone = profileForm.phone.replace(/\D/g, '');
                        if (!name) { showToast('Informe seu nome.', 'error'); return; }
                        if (phone.length < 10) { showToast('WhatsApp inválido (mín. 10 dígitos com DDD).', 'error'); return; }
                        saveUserProfile({ name, phone });
                        setDrawerTab('orders');
                        setMyOrdersPhone(phone);
                        setTimeout(() => handleSearchMyOrders(), 150);
                        showToast('Perfil Fluxo criado!', 'success');
                      }}
                      className="w-full py-4 bg-emerald-500 text-zinc-950 rounded-xl font-black text-[11px] uppercase tracking-widest active:scale-95 transition-transform touch-manipulation shadow-[0_10px_30px_rgba(16,185,129,0.2)]"
                    >
                      Salvar Perfil Fluxo
                    </button>
                  )}

                  {/* Botão sair — só identificado */}
                  {userProfile && (
                    <button
                      onClick={() => {
                        clearUserProfile();
                        setMyOrdersResults(null);
                        setMyOrdersPhone('');
                        setCurrentLead({ name: '', phone: '' });
                        setShowUserDrawer(false);
                        showToast('Perfil removido.', 'success');
                      }}
                      className="w-full py-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl font-black text-[11px] uppercase tracking-widest active:scale-95 transition-transform touch-manipulation flex items-center justify-center gap-2"
                    >
                      <LogOut size={14} /> Sair da Conta Fluxo
                    </button>
                  )}
                </div>
              )}

              {/* TAB PEDIDOS */}
              {drawerTab === 'orders' && userProfile && (
                <div className="space-y-3 animate-in">
                  {myOrdersLoading && (
                    <div className="text-center py-10 text-emerald-500 text-[10px] font-black uppercase tracking-widest animate-pulse">
                      Buscando pedidos...
                    </div>
                  )}
                  {!myOrdersLoading && myOrdersResults === null && (
                    <div className="text-center py-10 text-zinc-600 text-[10px] font-bold uppercase tracking-widest">
                      Carregando...
                    </div>
                  )}
                  {!myOrdersLoading && myOrdersResults !== null && myOrdersResults.length === 0 && (
                    <div className="text-center py-10 text-zinc-600 text-[10px] font-bold uppercase tracking-widest">
                      Nenhum pedido encontrado para este número.
                    </div>
                  )}
                  {!myOrdersLoading && (myOrdersResults || []).map((row) => {
                    const its = typeof row.items === 'string'
                      ? (() => { try { return JSON.parse(row.items); } catch { return []; } })()
                      : (row.items || []);
                    const st = String(row.status || 'NOVO').toUpperCase();
                    const stMap = { 'CONFIRMED': 'CONCLUÍDO', 'CONCLUIDO': 'CONCLUÍDO', 'CANCELLED': 'CANCELADO' };
                    const status = stMap[st] || st;
                    const color = status === 'CONCLUÍDO'
                      ? 'text-emerald-500 bg-emerald-500/10'
                      : status === 'CANCELADO'
                        ? 'text-red-500 bg-red-500/10'
                        : status === 'EM ATENDIMENTO'
                          ? 'text-amber-500 bg-amber-500/10'
                          : 'text-blue-500 bg-blue-500/10';
                    return (
                      <div key={row.id} className="bg-zinc-900 rounded-2xl p-4 border border-white/5">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[10px] font-black uppercase text-white">#{row.order_number}</span>
                          <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-full ${color}`}>{status}</span>
                        </div>
                        <div className="text-[9px] text-zinc-500 font-bold uppercase mb-2">
                          {row.created_at ? new Date(row.created_at).toLocaleString('pt-BR') : ''}
                        </div>
                        <div className="space-y-1">
                          {(its || []).map((it, i) => (
                            <div key={i} className="text-[10px] text-zinc-300 font-bold flex justify-between">
                              <span className="truncate pr-2">{it.qty || 1}x {it.name} <span className="text-emerald-500">({it.size || 'U'})</span></span>
                              <span className="text-zinc-500 shrink-0">{formatBRL(it.price || 0)}</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-between items-center pt-2 mt-2 border-t border-white/5">
                          <span className="text-[9px] text-zinc-500 font-black uppercase">Total</span>
                          <span className="text-[13px] font-black text-emerald-500">{formatBRL(row.value || 0)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* ── Quick Menu Drawer ── */}
      <AnimatePresence>
        {showQuickMenu && (
          <motion.div
            key="quick-menu-overlay"
            className="fixed inset-0 z-[200] flex"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowQuickMenu(false)} />
            <motion.div
              className="relative bg-zinc-950 border-r border-white/10 rounded-r-[28px] shadow-2xl overflow-y-auto flex flex-col"
              style={{ width: '82vw', maxWidth: '340px', height: '100dvh', paddingTop: 'env(safe-area-inset-top)' }}
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-6 pb-4 border-b border-white/5 shrink-0">
                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Menu</span>
                <button type="button" onClick={() => setShowQuickMenu(false)} className="text-zinc-500 hover:text-white touch-manipulation p-1"><X size={18} /></button>
              </div>
              <div className="px-5 space-y-5 py-4 flex-1 overflow-y-auto" style={{ paddingBottom: 'max(40px, env(safe-area-inset-bottom))' }}>

                {/* Bloco A — Busca */}
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" size={18} />
                  <input
                    ref={el => { if (el && showQuickMenu) setTimeout(() => el.focus(), 120); }}
                    type="text"
                    placeholder="O que você procura?"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { setShowQuickMenu(false); document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' }); } }}
                    className="w-full bg-zinc-900 border border-white/10 rounded-2xl py-4 pl-12 pr-10 text-[16px] font-bold text-white outline-none focus:border-emerald-500/40"
                  />
                  {searchQuery && (
                    <button type="button" onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white touch-manipulation">
                      <X size={16} />
                    </button>
                  )}
                </div>

                {/* Bloco B — Atalhos de descoberta */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { Icon: Flame, label: 'Novidades', active: noveltyMode, action: () => { setNoveltyMode(true); setSelectedCategory('TODOS'); setSelectedSize('TODOS'); setKitsOnly(false); setShowQuickMenu(false); document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' }); } },
                    { Icon: Star, label: 'Top', active: !noveltyMode && !kitsOnly && selectedCategory === 'TODOS' && selectedSize === 'TODOS', action: () => { setSelectedCategory('TODOS'); setSelectedSize('TODOS'); setKitsOnly(false); setNoveltyMode(false); setShowQuickMenu(false); document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' }); } },
                    { Icon: Zap, label: 'Kits', active: kitsOnly, action: () => { setKitsOnly(true); setNoveltyMode(false); setShowQuickMenu(false); document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' }); } },
                  ].map(({ Icon, label, active, action }) => (
                    <button key={label} type="button" onClick={action} className={`bg-zinc-900 border rounded-2xl py-3 flex flex-col items-center gap-1.5 touch-manipulation active:scale-95 transition-transform ${active ? 'border-emerald-500/50' : 'border-white/10'}`}>
                      <Icon size={18} className={active ? 'text-emerald-400' : 'text-zinc-400'} strokeWidth={2.2} />
                      <span className={`text-[9px] font-black uppercase tracking-widest ${active ? 'text-emerald-400' : 'text-zinc-400'}`}>{label}</span>
                    </button>
                  ))}
                </div>

                <div className="h-px bg-white/5" />

                {/* Tamanhos — accordion por categoria */}
                {Object.keys(categorySizesMap).length > 0 && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowSizeFilter(v => !v)}
                      className="flex items-center justify-between w-full touch-manipulation"
                    >
                      <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Filtrar por tamanho</p>
                      <ChevronDown size={14} className={`text-zinc-500 transition-transform duration-200 ${showSizeFilter ? 'rotate-180' : ''}`} />
                    </button>
                    {showSizeFilter && (
                      <div className="mt-3 space-y-1.5">
                        {Object.entries(categorySizesMap).map(([cat, sizes]) => (
                          <div key={cat}>
                            <button
                              type="button"
                              onClick={() => setExpandedSizeCategory(v => v === cat ? null : cat)}
                              className="flex items-center justify-between w-full px-3 py-2.5 rounded-xl bg-zinc-900 border border-white/5 touch-manipulation active:scale-[0.98] transition-transform"
                            >
                              <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wide">{cat}</span>
                              <ChevronRight size={13} className={`text-zinc-500 transition-transform duration-200 ${expandedSizeCategory === cat ? 'rotate-90' : ''}`} />
                            </button>
                            {expandedSizeCategory === cat && (
                              <div className="flex flex-wrap gap-2 pt-2 pb-1 px-1">
                                {sizes.map(sz => (
                                  <button
                                    key={sz}
                                    type="button"
                                    onClick={() => { setSelectedCategory(cat); setSelectedSize(sz); setShowQuickMenu(false); document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' }); }}
                                    className={`px-3 py-1.5 rounded-lg text-[11px] font-black border touch-manipulation transition-all ${selectedSize === sz && selectedCategory === cat ? 'bg-white text-zinc-950 border-white' : 'bg-zinc-800 border-white/10 text-zinc-400'}`}
                                  >
                                    {sz}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="h-px bg-white/5" />

                {/* Bloco C — Categorias */}
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-3">Categorias</p>
                  <div className="space-y-1.5">
                    {categories.filter(c => c !== 'TODOS').map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => { setSelectedCategory(cat); setSelectedSubcategory('TODOS'); setSelectedSize('TODOS'); setNoveltyMode(false); setShowQuickMenu(false); document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' }); }}
                        className={`w-full flex items-center justify-between bg-zinc-900/50 rounded-2xl px-4 py-3.5 touch-manipulation active:scale-[0.98] transition-transform border ${selectedCategory === cat ? 'border-emerald-500/30' : 'border-transparent'}`}
                      >
                        <span className={`font-black text-[12px] uppercase ${selectedCategory === cat ? 'text-emerald-400' : 'text-white'}`}>{cat}</span>
                        {selectedCategory === cat ? <Check size={14} className="text-emerald-500 shrink-0" /> : <ChevronRight size={14} className="text-zinc-600 shrink-0" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="h-px bg-white/5" />

                {/* Bloco D — Suporte */}
                <div className="space-y-2">
                  <a
                    href={`https://wa.me/${config.whatsapp}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 bg-zinc-900 border border-white/10 rounded-2xl px-4 py-3.5 touch-manipulation active:scale-[0.98] transition-transform"
                  >
                    <MessageCircle size={16} className="text-emerald-500 shrink-0" />
                    <div>
                      <p className="font-black text-[11px] uppercase text-white">WhatsApp</p>
                      <p className="text-[9px] text-zinc-500">Tire dúvidas antes de comprar</p>
                    </div>
                  </a>
                  <button
                    type="button"
                    onClick={() => { handleOpenUserDrawer(); setShowQuickMenu(false); }}
                    className="w-full flex items-center gap-3 bg-zinc-900 border border-white/10 rounded-2xl px-4 py-3.5 touch-manipulation active:scale-[0.98] transition-transform"
                  >
                    <Package size={16} className="text-zinc-400 shrink-0" />
                    <div className="text-left">
                      <p className="font-black text-[11px] uppercase text-white">Meus Pedidos</p>
                      <p className="text-[9px] text-zinc-500">Consulte seu histórico</p>
                    </div>
                  </button>
                </div>

              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
        
        ::-webkit-scrollbar { display: none; }
        
        html, body {
          background-color: #09090b;
          height: 100%;
          overflow: hidden;
        }

        body {
          font-family: 'Inter', sans-serif;
          -webkit-tap-highlight-color: transparent;
          background-color: #09090b;
          image-rendering: -webkit-optimize-contrast;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        #root {
          height: 100%;
          overflow-x: hidden;
          overflow-y: scroll;
          overscroll-behavior-y: contain;
        }

        .app-shell {
          min-height: 100%;
        }

        .native-x-scroll {
          touch-action: pan-x pan-y;
          overscroll-behavior-x: contain;
          overscroll-behavior-y: auto;
        }

        .carousel-scroll {
          touch-action: pan-x pan-y;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior-x: contain;
          will-change: scroll-position;
        }

        img {
          image-rendering: -webkit-optimize-contrast;
          image-rendering: high-quality;
          image-rendering: crisp-edges;
          -webkit-backface-visibility: hidden;
          backface-visibility: hidden;
          transform: translateZ(0);
          object-fit: cover;
          display: block;
          max-width: 100%;
        }
        
        .premium-shadow {
          shadow-[0_20px_50px_rgba(0,0,0,0.5)];
        }

        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1);
          border-radius: 10px;
        }
        
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .mask-linear { -webkit-mask-image: linear-gradient(to right, black 85%, transparent 100%); mask-image: linear-gradient(to right, black 85%, transparent 100%); }
        .animate-in { animation: fadeIn 0.5s ease-out; }
        .animate-slide-up { animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
        .animate-marquee { animation: marquee 30s linear infinite; }
        
        #reader { position: relative; width: 100%; height: 100%; }
        #reader video { width: 100% !important; height: 100% !important; object-fit: cover !important; position: absolute !important; top: 0; left: 0; border-radius: 20px !important; }
        #reader canvas { position: absolute !important; top: 0; left: 0; z-index: 10 !important; border-radius: 20px !important; }

        @supports (-webkit-touch-callout: none) {
            .client-input { font-size: 16px !important; }
        }

        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes marquee { 0% { transform: translateX(0%); } 100% { transform: translateX(-50%); } }
        @keyframes cardEnter {
          from { opacity: 0; transform: translateY(14px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)     scale(1); }
        }
        .card-enter { animation: cardEnter 0.55s cubic-bezier(0.16, 1, 0.3, 1) both; }
      `}</style>
    </div>
  );
}

export default App;
// Force redeploy Thu Apr 23 13:43:02 EDT 2026
