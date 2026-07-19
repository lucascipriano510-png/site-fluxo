import React, { useState, useMemo, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Plus, Minus, Trash2, X, Search, LayoutDashboard, ShoppingBag, Package, Box, MessageCircle, Zap, Info, Star, ChevronRight, ChevronLeft, ChevronDown, ArrowRight, Layers, Settings, MapPin, User, CheckCircle2, LogOut, ClipboardList, Database, Image as ImageIcon, ZoomIn, Truck, Check, Flame, ShieldCheck, Award, CreditCard, Lock, Megaphone, Instagram, Menu, Share2, Bell, Ruler, Ticket } from 'lucide-react';
import { fetchProducts, upsertProduct, deleteProduct, uploadImage, fetchAllKitItems } from './lib/supabase';
import OfferCountdown from './components/OfferCountdown';
import ProductReviewsList from './components/ProductReviewsList';
import StarRatingInline from './components/StarRatingInline';
// eslint-disable-next-line no-unused-vars -- carrossel guardado; ver comentário no hero
import BannerCarousel from './components/BannerCarousel';
import HeroVideo from './components/HeroVideo';
import SubBanner from './components/SubBanner';
import WaterRippleFX from './components/WaterRippleFX';
import ThreeAtmosphere from './components/ThreeAtmosphere';
import TouchGlow from './components/TouchGlow';
import WelcomeCoupon from './components/WelcomeCoupon';
import { useBanners } from './hooks/useBanners';
import AdminHeader from './components/AdminHeader';
import { optimizeImage, buildSrcSet, markWsrvFailed, getCatImgData } from './lib/images';
import { formatBRL } from './lib/format';
import { isOfferLive, offerPrice, offerPercent, offerEndsAt, offerCampaign, OFFER_CAMPAIGNS, CAMPAIGN_LABELS } from './lib/offers';
import { parseQueryIntent, productMatchesIntent, scoreProductForSearch, hasActiveQuery } from './lib/search';
import { emitSignal, setKnownLead, cartSnapshot } from './lib/leadSignals';
import { iniciarAtencao, exposicaoElemento, interacaoElemento } from './lib/attention';
import { hapticTick } from './lib/haptics';
import { rememberMySize, tocouCardComMeuNumero } from './lib/mySize';
import { aplicarMotor, limparRetorno, notarProdutoVisto, ordenarGradePadrao, tocouPecaImpulsionada } from './lib/intentEngine';
import { isLowEndDevice } from './lib/deviceTier';
import { fetchOrders } from './lib/orders';
import { requestStockAlert, fetchStockAlerts } from './lib/stockAlerts';
import { buildSizeGrid } from './lib/sizeGrid';
import { supabase } from './lib/supabaseClient';
import { getSessionToken, saveSession, clearSession, registerAccount, loginAccount, recoverAccount, fetchAccountOrders } from './lib/account';
import { fetchSiteConfig, upsertSiteConfig, DEFAULT_CONFIG as SITE_DEFAULT_CONFIG } from './lib/siteConfig';
import { createMetaEventId } from './lib/capi';
import { initMetaPixel, trackEvent, getMetaBrowserParams, getStoredUtm, markOwnerDevice } from './lib/metaPixel';
import { criarAtendimentoFromPedido } from './lib/crm';
import { fetchRatingsBatch } from './lib/reviews';
// Admin + recharts: code-split. Só baixam quando o painel abre — fora do bundle do cliente.
const AdminInventory = React.lazy(() => import('./components/AdminInventory'));
const AdminLeads = React.lazy(() => import('./components/AdminLeads'));
const AdminConfig = React.lazy(() => import('./components/AdminConfig'));
const AdminBanners = React.lazy(() => import('./components/AdminBanners'));
const AdminDashboard = React.lazy(() => import('./components/AdminDashboard'));
const AdminRastreio = React.lazy(() => import('./components/AdminRastreio'));
const AdminCRM = React.lazy(() => import('./components/AdminCRM'));
const AdminGrowth = React.lazy(() => import('./components/AdminGrowth'));
const AdminStockAlerts = React.lazy(() => import('./components/AdminStockAlerts'));

// ==========================================
// 1. CONFIGURAÇÃO E DADOS INICIAIS
// ==========================================
// ESCALA DE Z-INDEX (respeitar ao criar camada nova):
//   z-10..z-40  → dentro do componente (badge, sticky header interno)
//   z-50        → barras fixas do app (bottom nav, barra da sacola)
//   z-[60]      → CTA fixo da página de produto
//   z-[90..130] → dropdowns/painéis acima das barras
//   z-[150]     → overlays de página inteira (sacola, menu)
//   z-[200..220]→ modais (220 = modal sobre modal)
//   z-[300]     → toast (sempre por cima de tudo)
const APP_ID = typeof __app_id !== 'undefined' ? __app_id : 'fluxo-dark-ultimate';
const LEAD_STORAGE_KEY = '@fluxo-outlet:lead-data-v3';
const BANNERS_STORAGE_KEY = `@${APP_ID}:banners`;

// (DEFAULT_PRODUCTS removido: os produtos demo de Unsplash apareciam de verdade
// pro cliente no 1º acesso sem cache até o Supabase responder — dava pra clicar
// em peça que não existe. Agora o catálogo mostra SKELETON enquanto carrega.)

const DEFAULT_CONFIG = {
  brandName: 'FLUXO OUTLET EXCLUSIVE',
  whatsapp: '5534984148067', 
  location: 'UBERABA, MG',
  minOrder: 0.00, 
  pixelId: 'PIXEL_FLUXO_001',
  logoUrl: '', 
  logoZoom: 1.5,
  // Marquee = identidade seca (copy-e-voz): categoria, processo, cidade.
  // Sem claim auditável — "alto padrão/autêntico/exclusivo" é a autovalidação
  // que a pesquisa do módulo 4 derruba (afirmar luxo ≠ dar evidência).
  marqueePhrases: [
    'STREETWEAR E GRIFE MASCULINA',
    'PEÇA ESCOLHIDA A DEDO',
    'DAQUI DE UBERABA'
  ]
};


// Componentes folha e helpers extraídos do App.jsx (sem mudança de lógica):
import { useVisualViewportFrame } from './hooks/useVisualViewportFrame';
import AdminTabErrorBoundary from './components/AdminTabErrorBoundary';
import { PRICE_RANGES, colorDot, pluralCat } from './lib/catalogUi';
import ProductImage from './components/ProductImage';
import ProductVideoPip from './components/ProductVideoPip';
import StockAlertModal from './components/StockAlertModal';
import SizeRowSelector from './components/SizeRowSelector';
import SizeGuideModal, { hasSizeGuide } from './components/SizeGuideModal';
import InfoModal from './components/InfoModal';
import AutoScrollGallery from './components/AutoScrollGallery';
import PixIcon from './components/PixIcon';
import { trackPixel } from './lib/trackPixel';
import KitModal from './components/KitModal';
// Seções do return extraídas (verbatim, estado continua no App):
import HeaderBar from './components/HeaderBar';
import CatalogMain from './components/CatalogMain';
import TrustBadges from './components/TrustBadges';
import StoreFooter from './components/StoreFooter';
import ProductPageOverlay from './components/ProductPageOverlay';
import CartOverlay from './components/CartOverlay';
import LeadModalOverlay from './components/LeadModalOverlay';
import MyOrdersOverlay from './components/MyOrdersOverlay';
import UserDrawerOverlay from './components/UserDrawerOverlay';
import QuickMenuOverlay from './components/QuickMenuOverlay';
import GlobalStyles from './components/GlobalStyles';

// ==========================================
// 4. APLICATIVO PRINCIPAL (ROOT COMPONENT)
// ==========================================
function App() {
  const prefersReducedMotion = useReducedMotion();
  // ======= PRODUTOS: agora vivem no Supabase =======
  const PRODUCTS_CACHE_KEY = '@fluxo:products-cache-v1';
  // SWR (stale-while-revalidate): o snapshot local hidrata a vitrine NA HORA
  // (visita repetida sem skeleton, 0 rede) e o fetch do Supabase, que roda já
  // no mount, substitui os dados em ~1s. A janela só descarta snapshot de dias
  // (preço/estoque velhos demais pra mostrar nem por 1 segundo).
  // Era 60s — na prática TODA visita repetida encarava skeleton de novo.
  const PRODUCTS_CACHE_TTL = 24 * 60 * 60_000; // 24h

  const [productsRaw, setProductsRaw] = useState(() => {
    try {
      const cached = JSON.parse(localStorage.getItem(PRODUCTS_CACHE_KEY) || 'null');
      if (cached && Date.now() - cached.ts < PRODUCTS_CACHE_TTL && Array.isArray(cached.data) && cached.data.length > 0) return cached.data;
    } catch {}
    return []; // vazio até o Supabase responder — o catálogo mostra skeleton
  });
  const [productsLoaded, setProductsLoaded] = useState(false);
  const productsRef = useRef([]);
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

  // PRELOAD DAS PRIMEIRAS IMAGENS: guarda a URL exata (currentSrc — já no
  // tamanho que ESTE aparelho escolheu do srcset) das 2 primeiras imagens do
  // grid. O index.html injeta <link rel=preload> delas na PRÓXIMA visita,
  // antes do bundle — corta ~2s da cascata até o primeiro pixel de produto.
  useEffect(() => {
    if (!productsLoaded) return;
    const t = setTimeout(() => {
      try {
        const urls = [...document.querySelectorAll('[data-testid^="product-card-"] img')]
          .map(i => i.currentSrc).filter(Boolean).slice(0, 2);
        if (urls.length > 0) localStorage.setItem('@fluxo:preload-imgs-v1', JSON.stringify(urls));
      } catch { /* silencioso */ }
    }, 2500);
    return () => clearTimeout(t);
  }, [productsLoaded]);

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
      if (logged) markOwnerDevice(); // trava eventos Meta neste navegador
      setAuthReady(true);
    }).catch(() => setAuthReady(true));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const logged = !!session?.user;
      setIsAdmin(logged);
      isAdminRef.current = logged;
      if (logged) markOwnerDevice();
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
      selecao: sp.get('selecao') || null,
    };
  })();
  const [selectedCategory, setSelectedCategory] = useState(_initialUrlFilters.categoria || 'TODOS');
  const [selectedSubcategory, setSelectedSubcategory] = useState(_initialUrlFilters.sub || 'TODOS');
  const [searchQuery, setSearchQuery] = useState(_initialUrlFilters.busca || '');
  const [selectedSize, setSelectedSize] = useState(_initialUrlFilters.tamanho || 'TODOS');
  const [selectedColor, setSelectedColor] = useState('TODOS');
  const [priceRange, setPriceRange] = useState('TODOS');
  const [kitsOnly, setKitsOnly] = useState(!!_initialUrlFilters.kits);
  // Ordenação escolhida pelo cliente: relevancia (padrão) | preco_asc | preco_desc | novidades
  const [sortMode, setSortMode] = useState('relevancia');
  // Histórico "vistos recentemente" (ids), persistido no localStorage.
  const [recentlyViewed, setRecentlyViewed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('fluxo_recently_viewed') || '[]'); } catch { return []; }
  });
  // Alvo do modal "Avise-me quando voltar": { product, size } ou null.
  const [stockAlertTarget, setStockAlertTarget] = useState(null);
  // Guia de medidas (página do produto) e páginas institucionais do rodapé.
  const [showSizeGuide, setShowSizeGuide] = useState(false);
  const [infoPage, setInfoPage] = useState(null); // 'sobre' | 'trocas' | 'privacidade'
  // Contador de avisos de estoque pendentes (badge na aba admin).
  const [stockAlertsPending, setStockAlertsPending] = useState(0);
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
  // Captura ?sacola=SKU:TAM:QTD,SKU:TAM — link de sacola montada (vendedor monta o
  // pedido e manda um link; abre com tudo na sacola). QTD é opcional (padrão 1).
  const initialUrlSacola = useRef(
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('sacola') : null
  );
  const [activeProductImage, setActiveProductImage] = useState(null);
  useEffect(() => {
    if (selectedProduct && !selectedProduct.is_kit) {
      setActiveProductImage(selectedProduct.image);
    }
    setShowSizeGuide(false); // trocar/fechar produto nunca deixa o guia aberto
  }, [selectedProduct]);
  // SEO: título da aba + JSON-LD Product do produto aberto (Google executa JS).
  useEffect(() => {
    const BASE_TITLE = 'FLUXO OUTLET';
    const p = selectedProduct;
    if (!p) { document.title = BASE_TITLE; return; }
    document.title = `${p.name} | ${BASE_TITLE}`;
    try {
      let el = document.getElementById('ldjson-product');
      if (!el) {
        el = document.createElement('script');
        el.type = 'application/ld+json';
        el.id = 'ldjson-product';
        document.head.appendChild(el);
      }
      const promo = Number(p.promotional_price || 0);
      const price = promo > 0 && promo < p.price ? promo : Number(p.price || 0);
      el.textContent = JSON.stringify({
        '@context': 'https://schema.org', '@type': 'Product',
        name: p.name, sku: String(p.sku || p.id),
        image: [p.image, ...(Array.isArray(p.gallery) ? p.gallery : [])].filter(Boolean),
        description: p.description || p.bot_description || undefined,
        brand: { '@type': 'Brand', name: 'Fluxo Outlet' },
        offers: {
          '@type': 'Offer', priceCurrency: 'BRL', price: price.toFixed(2),
          availability: (p.is_kit || (p.stock || 0) > 0) ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          url: `https://www.fluxooutlet.com.br/p/${encodeURIComponent(String(p.sku || p.id))}`,
        },
      });
    } catch { /* SEO é bônus, nunca quebra a loja */ }
    return () => {
      document.title = BASE_TITLE;
      const el = document.getElementById('ldjson-product');
      if (el) el.textContent = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProduct?.id]);
  // 🟣 ViewContent (Pixel + CAPI com mesmo event_id) — dispara em QUALQUER abertura
  // de produto (catálogo, relacionados, deeplink). Meio do funil: sem ele a
  // Meta não tem sinal de "viu a peça" pra retargeting/otimização de catálogo.
  // KIT não dispara: kit fica FORA do feed meta-catalog (sem estoque próprio) e
  // content_id sem par no catálogo só gera aviso de "evento sem item" na Meta.
  useEffect(() => {
    if (!selectedProduct || selectedProduct.is_kit) return;
    try {
      const p = selectedProduct;
      const live = isOfferLive(p);
      const promo = Number(p.promotional_price || 0);
      const value = live ? offerPrice(p) : ((promo > 0 && promo < p.price) ? promo : Number(p.price || 0));
      trackPixel('ViewContent', {
        event_id: createMetaEventId(),
        value,
        currency: 'BRL',
        content_name: p.name,
        content_ids: [String(p.sku || p.id)],
        content_type: 'product',
      });
    } catch (e) { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProduct?.id]);
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
  // ── Conta com senha (telefone + senha; recuperação por código/WhatsApp) ──
  const [accountToken, setAccountToken] = useState(() => getSessionToken());
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'signup' | 'recover'
  const [authForm, setAuthForm] = useState({ phone: '', name: '', password: '', recovery: '' });
  const [authLoading, setAuthLoading] = useState(false);
  // Código de recuperação recém-gerado: mostrado UMA vez, até o cliente confirmar
  const [recoveryToShow, setRecoveryToShow] = useState(null);

  const entrarNaConta = ({ token, profile }) => {
    saveSession(token);
    setAccountToken(token);
    saveUserProfile({ ...(userProfile || {}), name: profile.name, phone: profile.phone });
    setAuthForm({ phone: '', name: '', password: '', recovery: '' });
  };

  const sairDaConta = () => {
    clearSession();
    setAccountToken(null);
    clearUserProfile();
  };

  const handleAuthSubmit = async () => {
    if (authLoading) return;
    const phone = authForm.phone.replace(/\D/g, '');
    setAuthLoading(true);
    try {
      if (authMode === 'signup') {
        const data = await registerAccount({ phone, name: authForm.name.trim(), password: authForm.password });
        entrarNaConta(data);
        setRecoveryToShow(data.recovery); // mostrado UMA vez; cliente confirma que anotou
        showToast('Conta criada!', 'success');
      } else if (authMode === 'login') {
        const data = await loginAccount({ phone, password: authForm.password });
        entrarNaConta(data);
        showToast(`Bem-vindo de volta, ${data.profile.name.split(' ')[0]}!`, 'success');
        setDrawerTab('orders');
        setTimeout(() => handleSearchMyOrders(), 150);
      } else {
        const data = await recoverAccount({ phone, recovery: authForm.recovery, newPassword: authForm.password });
        entrarNaConta(data);
        setRecoveryToShow(data.recovery); // código NOVO (o antigo morreu no uso)
        showToast('Senha redefinida!', 'success');
      }
    } catch (e) {
      showToast(e?.message || 'Erro. Tenta de novo.', 'error');
    } finally {
      setAuthLoading(false);
    }
  };

  // ── Avaliações ──
  const [ratingsMap, setRatingsMap] = useState({});

  const [toast, setToast] = useState(null);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [whatsappLink, setWhatsappLink] = useState('');
  const [checkoutOrderNumber, setCheckoutOrderNumber] = useState('');
  const featuredRailRef = useRef(null);
  const featuredPeekedRef = useRef(false);
  // Início do toque na galeria do produto aberto (swipe lateral troca a foto).
  const productSwipeRef = useRef({ x: 0, y: 0 });
  // Posição do scroll do catálogo no momento que um produto foi aberto -> restaurada
  // ao fechar (o home é desmontado e volta ao topo; isso devolve onde o cliente estava).
  const catalogScrollRef = useRef(0);
  const [activeCollectionFilter, setActiveCollectionFilter] = useState(_initialUrlFilters.colecao || null);
  // Seleção curada via link (?selecao=SKU,SKU,...) — vitrine só com essas peças.
  // Diferente de coleção (nomeada no admin): é avulsa, montada na hora pelo vendedor.
  const [selectionSkus, setSelectionSkus] = useState(() =>
    _initialUrlFilters.selecao
      ? _initialUrlFilters.selecao.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
      : null
  );
  const [adminTab, setAdminTab] = useState('dashboard'); 
  const visualFrame = useVisualViewportFrame();
  const viewportOverlayStyle = { top: visualFrame.top, height: visualFrame.height || '100dvh' };
  const viewportPanelMaxHeight = visualFrame.height ? `calc(${visualFrame.height}px - 10px)` : 'calc(100dvh - 10px)';

  // Card de produto (não-kit) aberto: vira página em fluxo no mobile.
  const productPageOpen = !!(selectedProduct && !selectedProduct.is_kit);
  // Volta ao topo de forma robusta: zera TODOS os scrollers possíveis (window,
  // documento, body e #root). Roda agora E após o layout assentar (rAF), senão
  // a página de produto abre na posição em que o catálogo estava (parte de baixo).
  const scrollProductTop = () => {
    const reset = () => {
      try { window.scrollTo(0, 0); } catch {}
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
      const root = document.getElementById('root');
      if (root) root.scrollTop = 0;
    };
    reset();
    requestAnimationFrame(reset);
  };
  // Enquanto aberto, o DOCUMENTO passa a rolar (URL recolhe) e a loja some no mobile.
  useEffect(() => {
    if (!productPageOpen) return;
    document.documentElement.classList.add('product-scroll');
    scrollProductTop();
    return () => document.documentElement.classList.remove('product-scroll');
  }, [productPageOpen]);
  // Troca de produto (relacionados) com a página aberta: volta ao topo.
  useEffect(() => {
    if (productPageOpen) scrollProductTop();
  }, [selectedProduct?.id, productPageOpen]);
  // Ao FECHAR o produto: restaura a posição do catálogo (#root, não window).
  // O home remonta e a altura assenta aos poucos -> reescreve algumas vezes até colar.
  useEffect(() => {
    if (productPageOpen) return;
    const y = catalogScrollRef.current;
    if (y > 0) {
      const doScroll = () => {
        const root = document.getElementById('root');
        if (root) root.scrollTop = y;
        try { window.scrollTo(0, y); } catch {}
      };
      requestAnimationFrame(() => requestAnimationFrame(doScroll));
      setTimeout(doScroll, 60);
      setTimeout(doScroll, 180);
      setTimeout(() => { doScroll(); catalogScrollRef.current = 0; }, 320);
    }
  }, [productPageOpen]);

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
    // viewport-fit=cover é OBRIGATÓRIO aqui: sem ele o env(safe-area-inset-*) vira 0
    // no iPhone com notch e o CTA fixo/sacola colam no gesto de home.
    const VIEWPORT_CONTENT = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      viewport.content = VIEWPORT_CONTENT;
    } else {
      const meta = document.createElement('meta');
      meta.name = 'viewport';
      meta.content = VIEWPORT_CONTENT;
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
          markOwnerDevice();
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

  // ── Carrossel INFINITO de categorias (mobile) ──
  // 3 cópias da fileira + "teleporte" invisível nas bordas: passou de 1.5x a
  // largura de uma cópia, volta 1x; antes de 0.5x, avança 1x. Como as cópias são
  // idênticas, o salto não aparece. Desktop (flex-wrap, sem scroll) usa 1 cópia.
  const catRailRef = useRef(null);
  const onCatRailScroll = () => {
    const el = catRailRef.current;
    if (!el || isDesktopViewport) return;
    const W = el.scrollWidth / 3;
    if (W <= el.clientWidth) return; // cabe tudo na tela: sem loop
    if (el.scrollLeft < W * 0.5) el.scrollLeft += W;
    else if (el.scrollLeft > W * 1.5) el.scrollLeft -= W;
  };
  useEffect(() => {
    if (isDesktopViewport || kitsOnly) return;
    const el = catRailRef.current;
    if (!el) return;
    const W = el.scrollWidth / 3;
    if (W > el.clientWidth) el.scrollLeft = W; // começa na cópia do meio
  }, [isDesktopViewport, kitsOnly, categories.length, productsLoaded]);
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

  // Revalida o carrinho contra os produtos atuais: se um item entrou com preço de
  // Oferta do Dia e a oferta JÁ EXPIROU (ao recarregar/voltar, ou ao virar a hora),
  // volta pro preço normal e tira a flag de oferta. Roda quando os produtos carregam
  // e a cada expiração (bumpOffers).
  useEffect(() => {
    if (!products || products.length === 0) return;
    setCart(prev => {
      if (!prev || prev.length === 0) return prev;
      let changed = false;
      const next = prev.map(item => {
        const product = products.find(p => p.id === item.id);
        if (!product) return item; // produto sumiu do catálogo: mantém como está
        const live = isOfferLive(product);
        const correctPrice = live ? offerPrice(product) : (product.price || 0);
        if (item.price !== correctPrice || !!item.offer_applied !== live) {
          changed = true;
          return { ...item, price: correctPrice, offer_applied: live };
        }
        return item;
      });
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, offerExpiryBump]);

  // Pix 5% NÃO incide sobre itens em oferta. Calcula só a base elegível.
  const pixBaseSubtotal = useMemo(
    () => (cart || []).filter(i => !i.offer_applied).reduce((acc, i) => acc + (i.price * i.quantity), 0),
    [cart]
  );

  // ── Cupom de desconto (NOVOFLUXO5: boas-vindas, 5%) ──────────────────
  // Mesma regra de margem do Pix: NÃO incide sobre itens em oferta.
  // Pix é forma de pagamento e incide sobre a base JÁ com cupom —
  // cupom+pix compõem (0,95 × 0,95), nunca somam 10% secos.
  // "Primeira compra" real exigiria consultar orders por telefone (RLS não
  // deixa o anon ler) — o controle é 1 uso por dispositivo.
  // REDESENHO 2026-07-17 (pesquisa mód. 2, aval do dono): o cupom NÃO exige
  // mais cadastro — 216 exposições → 8 usos (3,7%) provaram que pedir conta
  // na porta mata o presente. O telefone entra sozinho no checkout, onde o
  // CRM já pega o lead. `precisaCadastro` fica pra cupons futuros.
  const CUPONS = {
    NOVOFLUXO5: { pct: 0.05, precisaCadastro: false },
  };
  const CUPOM_USADO_KEY = '@fluxo-outlet:cupons-usados';
  const [cupomInput, setCupomInput] = useState('');
  const [cupomAtivo, setCupomAtivo] = useState(() => {
    try {
      const c = localStorage.getItem('@fluxo-outlet:cupom-ativo');
      return c && CUPONS[c] ? c : null;
    } catch { return null; }
  });
  const cupomDiscount = useMemo(
    () => (cupomAtivo && CUPONS[cupomAtivo] ? pixBaseSubtotal * CUPONS[cupomAtivo].pct : 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cupomAtivo, pixBaseSubtotal]
  );

  const cupomJaUsado = (codigo) => {
    try { return JSON.parse(localStorage.getItem(CUPOM_USADO_KEY) || '[]').includes(codigo); } catch { return false; }
  };

  const aplicarCupom = (codigoRaw, { silencioso = false } = {}) => {
    const codigo = String(codigoRaw || '').trim().toUpperCase();
    if (!codigo) return false;
    const regra = CUPONS[codigo];
    if (!regra) { if (!silencioso) showToast('Cupom não encontrado. Confere o código!', 'error'); return false; }
    if (cupomJaUsado(codigo)) { if (!silencioso) showToast('Esse cupom já foi usado por aqui 😉', 'error'); return false; }
    if (regra.precisaCadastro && !userProfile) {
      if (!silencioso) {
        showToast('Cadastre-se rapidinho pra liberar o cupom!', 'error');
        setDrawerTab('profile');
        setShowUserDrawer(true);
      }
      return false;
    }
    setCupomAtivo(codigo);
    try { localStorage.setItem('@fluxo-outlet:cupom-ativo', codigo); } catch {}
    if (!silencioso) showToast(`Cupom ${codigo} aplicado — 5% OFF garantido!`, 'success');
    emitSignal('cupom_aplicado', { meta: { cupom: codigo } });
    return true;
  };

  const removerCupom = () => {
    setCupomAtivo(null);
    try { localStorage.removeItem('@fluxo-outlet:cupom-ativo'); } catch {}
  };

  const pixDiscount = useMemo(() => Math.max(0, pixBaseSubtotal - cupomDiscount) * 0.05, [pixBaseSubtotal, cupomDiscount]);
  const totalComPix = useMemo(() => subtotal - cupomDiscount - pixDiscount, [subtotal, cupomDiscount, pixDiscount]);
  const hasOfferInCart = useMemo(() => (cart || []).some(i => i.offer_applied), [cart]);

  // ── Engenharia da Atenção: sessão + funil (lib/attention.js) ──
  useEffect(() => { iniciarAtencao(); }, []);

  // ── Pop-up de boas-vindas (bloco: abre no MOBILE, 1x por visitante) ──
  const [showWelcome, setShowWelcome] = useState(false);
  useEffect(() => {
    if (isDesktopViewport) return;   // o bloco pede mobile; desktop fica de fora
    if (userProfile) return;         // quem já é de casa não é "primeira vez"
    try {
      if (localStorage.getItem('@fluxo-outlet:welcome-visto')) return;
      if (cupomJaUsado('NOVOFLUXO5')) return;
    } catch {}
    // Respiro de 2,6s: pop-up na cara, antes da vitrine carregar, é rejeição.
    const t = setTimeout(() => {
      setShowWelcome(true);
      emitSignal('welcome_popup_visto', {});
      exposicaoElemento('cupom_boas_vindas');
      try { localStorage.setItem('@fluxo-outlet:welcome-visto', '1'); } catch {}
    }, 2600);
    return () => clearTimeout(t);
    // só na montagem: girar o celular depois não deve reabrir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleProductClick = (product) => {
    if (!product) return;
    // Kits podem ser abertos mesmo sem estoque próprio (estoque vem dos componentes)
    if (!product.is_kit && product.stock <= 0) return;
    tocouCardComMeuNumero(product); // telemetria: card aberto tinha o chip "Seu nº"?
    tocouPecaImpulsionada(product); // telemetria: card estava em posição do motor?
    notarProdutoVisto(product);     // motor de intenção aprende a sessão
    // Guarda onde o catálogo estava p/ restaurar ao voltar (só quando vem da vitrine).
    // IMPORTANTE: o catálogo rola pelo #root (overflow-y:scroll), NÃO pela window.
    if (!productPageOpen) {
      const root = document.getElementById('root');
      catalogScrollRef.current = root ? root.scrollTop : (window.scrollY || 0);
    }
    const abrir = () => {
      setSelectedProduct(product);
      setSelectedSizes({});
    };
    // Morph nativo card→hero (View Transitions API): a foto do card se
    // transforma no hero da página do produto, estilo app. Progressivo: sem
    // suporte do navegador, sem card na vitrine, kit (abre modal, não página)
    // ou motion reduzido → abre como sempre abriu. O nome sai do card DENTRO
    // do callback: nome duplicado no mesmo frame desliga a transição inteira.
    const cardEl = document.querySelector(`[data-vt-card="${product.id}"]`);
    const motionReduzido = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (document.startViewTransition && cardEl && !product.is_kit && !motionReduzido && !productPageOpen && !isLowEndDevice()) {
      cardEl.style.viewTransitionName = 'produto-hero';
      const vt = document.startViewTransition(() => {
        cardEl.style.viewTransitionName = '';
        flushSync(abrir);
      });
      vt.finished.finally(() => { cardEl.style.viewTransitionName = ''; });
    } else {
      abrir();
    }
    emitSignal('produto_visto', { product }); // sinal: lead olhou esta peça
    // Histórico "vistos recentemente" (id no topo, único, máx 12).
    setRecentlyViewed(prev => {
      const next = [product.id, ...prev.filter(id => id !== product.id)].slice(0, 12);
      try { localStorage.setItem('fluxo_recently_viewed', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  // Compartilhar a peça: usa o share nativo do celular; sem suporte, copia o link.
  // Usa o deep link ?produto=SKU que o site já entende.
  const handleShareProduct = async (product) => {
    if (!product) return;
    // /p/SKU = rota com OG dinâmico (api/produto.js): preview rico no WhatsApp.
    const url = `https://www.fluxooutlet.com.br/p/${encodeURIComponent(String(product.sku || product.id))}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${product.name} — Fluxo Outlet`, text: 'Olha essa peça da Fluxo Outlet 👇', url });
      } else {
        await navigator.clipboard.writeText(url);
        showToast('Link copiado!');
      }
    } catch { /* cancelado pelo usuário — ignora */ }
  };

  const handleSizeSelect = (sizeName, maxStock) => {
    setSelectedSizes(prev => {
      const currentQty = prev[sizeName] || 0;
      const itemKey = `${selectedProduct?.id}-${sizeName || 'U'}`;
      const qtyInCart = (cart || []).find(i => i.itemKey === itemKey)?.quantity || 0;
      if (currentQty + qtyInCart >= maxStock) { showToast(`Estoque máximo!`, 'error'); return prev; }
      hapticTick(); // tick de aparelho ao marcar tamanho (Android; iOS ignora)
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
    hapticTick(18); // confirmação tátil: peça entrando na sacola
    rememberMySize(selectedProduct, selectedSizes); // vitrine aprende o número (lib/mySize)
    limparRetorno(selectedProduct.id); // entrou na sacola = sai da mira do motor

    // A PEÇA VOA PRA SACOLA: clona a foto ativa do hero e anima até o ícone
    // do header (WAAPI, só transform/opacity no compositor). Decorativo puro:
    // qualquer falha é engolida e a compra segue.
    try {
      const reduzido = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
      const heroEl = document.querySelector('img[style*="produto-hero"]');
      const alvo = document.querySelector('[data-testid="btn-header-cart"]');
      if (!reduzido && heroEl && alvo) {
        const a = heroEl.getBoundingClientRect();
        const b = alvo.getBoundingClientRect();
        if (a.width > 0 && b.width > 0) {
          const ghost = document.createElement('img');
          ghost.src = heroEl.currentSrc || heroEl.src;
          Object.assign(ghost.style, {
            position: 'fixed', left: `${a.left}px`, top: `${a.top}px`,
            width: `${a.width}px`, height: `${a.height}px`,
            objectFit: 'cover', borderRadius: '18px', zIndex: 290,
            pointerEvents: 'none', willChange: 'transform, opacity',
          });
          document.body.appendChild(ghost);
          const dx = (b.left + b.width / 2) - (a.left + a.width / 2);
          const dy = (b.top + b.height / 2) - (a.top + a.height / 2);
          // Voo em ARCO e mais lento (1s): "pega" a peça (cresce um tico),
          // desvia lateral no meio do caminho e pousa no ícone — trajetória
          // curva é o que o olho consegue rastrear; reta rápida vira borrão.
          const voo = ghost.animate(
            [
              { transform: 'translate(0, 0) scale(1)', opacity: 1, offset: 0 },
              { transform: 'translate(0, -14px) scale(1.05)', opacity: 1, offset: 0.12 },
              { transform: `translate(${dx * 0.62}px, ${dy * 0.45}px) scale(0.45)`, opacity: 0.95, offset: 0.55 },
              { transform: `translate(${dx}px, ${dy}px) scale(0.07)`, opacity: 0.4, offset: 1 },
            ],
            { duration: 1000, easing: 'cubic-bezier(0.3, 0.8, 0.3, 1)' }
          );
          const pousar = () => {
            ghost.remove();
            // POUSO: a sacola "recebe" a peça — pulso no ícone + tique tátil.
            alvo.animate(
              [
                { transform: 'scale(1)' },
                { transform: 'scale(1.4)' },
                { transform: 'scale(1)' },
              ],
              { duration: 320, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
            );
            hapticTick(10);
          };
          voo.onfinish = pousar;
          voo.oncancel = () => ghost.remove();
        }
      }
    } catch { /* efeito decorativo — nunca trava a compra */ }

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
      // Valor do evento = preço EFETIVAMENTE cobrado no carrinho (oferta viva usa
      // o preço com desconto) — antes ia o preço cheio e inflava o funil vs Purchase.
      const unitPrice = isOfferLive(selectedProduct) ? offerPrice(selectedProduct) : Number(selectedProduct.price || 0);
      const addedValue = entries.reduce((acc, [, qty]) => acc + (unitPrice * Number(qty || 0)), 0);
      const addedQty   = entries.reduce((acc, [, qty]) => acc + Number(qty || 0), 0);
      const event_id = createMetaEventId();
      trackPixel('AddToCart', {
        event_id,
        value: addedValue,
        currency: 'BRL',
        content_name: selectedProduct.name,
        content_ids: [String(selectedProduct.sku || selectedProduct.id)],
        content_type: 'product',
        contents: [{ id: String(selectedProduct.sku || selectedProduct.id), quantity: addedQty, item_price: unitPrice }],
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
      // Total do pedido JÁ com cupom (o Pix é forma de pagamento, negociada
      // no WhatsApp — o value gravado é o total "cheio" pós-cupom).
      const totalPedido = Math.max(0, (Number(subtotal) || 0) - (Number(cupomDiscount) || 0));
      const itensNormalizados = (cart || []).map((item) => ({
        id: Number(item?.id) || 0,
        name: String(item?.name ?? ''),
        sku: String(item?.sku ?? ''),
        size: String(item?.size ?? ''),
        price: Number(item?.price) || 0,
        qty: Number(item?.quantity) || 0,
        image: String(item?.image ?? '')
      }));

      // EMQ/CAPI: captura os parâmetros de browser do CLIENTE AGORA (ele está no
      // site) pra gravar no pedido. O Purchase é disparado depois pelo admin —
      // sem isso, iria com os dados do admin (IP/UA/cookies errados).
      const metaParams = getMetaBrowserParams();

      // Schema real da tabela: order_number | name | phone | items (jsonb) | value | status
      const payload = {
        order_number: orderNum,
        name: customerName,
        phone: customerPhone,
        items: itensNormalizados,
        value: totalPedido,
        status: 'NOVO',
        fbp: metaParams.fbp,
        fbc: metaParams.fbc,
        client_ua: metaParams.client_ua,
        src_url: metaParams.src_url,
        utm: getStoredUtm(), // de qual anúncio/campanha o cliente veio (last-touch)
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
        ...(cupomAtivo ? [
          `🎟️ Cupom ${cupomAtivo}: -R$ ${cupomDiscount.toFixed(2)}`,
        ] : []),
        `💰 Total: R$ ${totalPedido.toFixed(2)}`,
        ``,
        `⚡ Enviado via ${config.brandName}`,
      ].join('\n');

      // Usa whatsapp do config (fallback pro hardcoded caso vazio)
      const waNumber = String(config?.whatsapp || '5534984148067').replace(/\D/g, '');
      const whatsappUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`;

      // (AddToCart REMOVIDO daqui: já dispara no momento real de adicionar à sacola.
      //  Duplicar no finalizar inflava o evento e distorcia o custo por AddToCart.)

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

      // Cupom usado de verdade: queima neste dispositivo e limpa o ativo
      if (cupomAtivo) {
        try {
          const usados = JSON.parse(localStorage.getItem(CUPOM_USADO_KEY) || '[]');
          if (!usados.includes(cupomAtivo)) usados.push(cupomAtivo);
          localStorage.setItem(CUPOM_USADO_KEY, JSON.stringify(usados));
          localStorage.removeItem('@fluxo-outlet:cupom-ativo');
        } catch {}
        setCupomAtivo(null);
      }

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

  // BUSCA IMERSIVA: a grade reage à query com ~260ms de respiro — sem isso,
  // cada letra dispara uma coreografia por cima da anterior e o cliente não
  // PERCEBE os cards sumindo/flutuando. O input mostra o texto cru na hora;
  // só a filtragem espera a pausa entre teclas.
  const [settledQuery, setSettledQuery] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setSettledQuery(searchQuery), 260);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const searchIntent = useMemo(() => parseQueryIntent(settledQuery), [settledQuery]);
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
      const matchesSelection = !selectionSkus || selectionSkus.includes(String(p.sku || '').toUpperCase());
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
      return matchesCat && matchesSub && matchesSearch && matchesSize && matchesCollection && matchesSelection && matchesColor && matchesPrice;
    });
    if (!noveltyMode) return base;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recent = base.filter(p => p.created_at && new Date(p.created_at) > thirtyDaysAgo);
    if (recent.length > 0) return recent;
    return [...base].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)).slice(0, 8);
  }, [noveltyMode, kitsOnly, selectedCategory, selectedSubcategory, searchIntent, selectedSize, selectedColor, priceRange, products, activeCollectionFilter, selectionSkus]);

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
  // (preserva ?sub=... da URL) e em navegação programática categoria+sub (abaixo).
  const _isFirstCategoryChange = React.useRef(true);
  const _skipNextSubReset = React.useRef(false);
  // Navegação de campanha (CTA do sub-banner): seta categoria E subcategoria de
  // uma vez; o ref pula o reset automático que apagaria a sub logo em seguida.
  const navigateToSubcategory = (cat, sub) => {
    _skipNextSubReset.current = cat !== selectedCategory;
    setSelectedCategory(cat);
    setSelectedSubcategory(sub);
    document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' });
  };
  useEffect(() => {
    if (_isFirstCategoryChange.current) { _isFirstCategoryChange.current = false; return; }
    if (_skipNextSubReset.current) { _skipNextSubReset.current = false; return; }
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
        setOrDel('selecao', selectionSkus ? selectionSkus.join(',') : '', '');
        const newSearch = sp.toString();
        const newUrl = url.pathname + (newSearch ? `?${newSearch}` : '') + url.hash;
        const current = window.location.pathname + window.location.search + window.location.hash;
        // Preserva o state (mantém o marcador __anchor da navegação) ao espelhar a URL.
        if (newUrl !== current) window.history.replaceState(window.history.state, '', newUrl);
      } catch {}
    }, 200);
    return () => clearTimeout(handle);
  }, [selectedCategory, selectedSubcategory, selectedSize, searchQuery, kitsOnly, activeCollectionFilter, selectionSkus]);

  // (O "voltar" agora é gerenciado pela ÂNCORA DE HISTÓRICO mais abaixo —
  //  fecha a camada do topo / pede confirmação de saída. A URL continua
  //  espelhada via replaceState acima só para deep-link/compartilhamento.)

  // Deep link de coleção (?colecao=X): rola direto pro catálogo já filtrado.
  const _scrolledToColecao = React.useRef(false);
  useEffect(() => {
    if (_scrolledToColecao.current || !productsLoaded || (!_initialUrlFilters.colecao && !_initialUrlFilters.selecao)) return;
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

  // Monta a sacola via deeplink (?sacola=SKU:TAM:QTD,...) — o vendedor fecha o
  // pedido no WhatsApp e manda um link que já abre com tudo na sacola.
  // Valida estoque por tamanho; item inválido/esgotado é pulado (avisa no toast).
  useEffect(() => {
    if (!productsLoaded || !(products || []).length) return;
    const raw = initialUrlSacola.current;
    if (!raw) return;
    initialUrlSacola.current = null; // evita re-trigger
    let added = 0, skipped = 0;
    setCart(prev => {
      const updated = [...(prev || [])];
      raw.split(',').forEach(part => {
        const [skuRaw, sizeRaw, qtyRaw] = part.split(':');
        const sku = (skuRaw || '').trim();
        if (!sku) return;
        const product = products.find(p =>
          String(p.sku || '').toUpperCase() === sku.toUpperCase() || String(p.id) === sku
        );
        // Kit não entra direto (as peças dele é que vão pra sacola) — pula.
        if (!product || product.is_kit) { skipped++; return; }
        // Resolve o tamanho contra o formato real do banco (string ou {size, stock}).
        const sizes = product.sizes || [];
        const sizeName = (sizeRaw || '').trim().toUpperCase() || 'U';
        const szEntry = sizes.find(s => String(typeof s === 'string' ? s : s.size).toUpperCase() === sizeName);
        if (!szEntry && sizes.length > 0) { skipped++; return; }
        const maxStock = szEntry ? (typeof szEntry === 'string' ? (product.stock || 0) : (szEntry.stock || 0)) : (product.stock || 0);
        if (maxStock <= 0) { skipped++; return; }
        const wanted = Math.max(1, parseInt(qtyRaw, 10) || 1);
        const itemKey = `${product.id}-${sizeName}`;
        const existingIdx = updated.findIndex(i => i.itemKey === itemKey);
        const already = existingIdx >= 0 ? updated[existingIdx].quantity : 0;
        const quantity = Math.min(wanted, maxStock - already);
        if (quantity <= 0) { skipped++; return; }
        if (existingIdx >= 0) {
          updated[existingIdx] = { ...updated[existingIdx], quantity: already + quantity };
        } else {
          const live = isOfferLive(product);
          updated.push({
            ...product,
            price: live ? offerPrice(product) : product.price,
            offer_applied: live,
            size: sizeName,
            quantity,
            itemKey,
          });
        }
        added++;
      });
      return added > 0 ? updated : prev;
    });
    // Limpa o param da URL (o link já cumpriu o papel; evita re-adicionar no F5).
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('sacola');
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    } catch {}
    if (added > 0) {
      setShowCart(true);
      showToast(skipped > 0 ? `Sacola montada ✓ (${skipped} peça(s) esgotada(s))` : 'Sacola montada pra você ✓');
    } else if (skipped > 0) {
      showToast('As peças desse link esgotaram 😔', 'error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productsLoaded, products]);

  const sortedProducts = useMemo(() => {
    // Ordenação EXPLÍCITA do cliente tem prioridade (inclusive sobre a busca).
    if (sortMode === 'novidades') {
      return [...filteredProducts].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    }
    // Com busca ativa: ordena por RELEVÂNCIA (nome exato > começa com > contém...).
    if (searchActive) {
      return [...filteredProducts]
        .map(p => ({ p, s: scoreProductForSearch(p, searchIntent) }))
        .sort((a, b) => b.s - a.s || (b.p.sales || 0) - (a.p.sales || 0))
        .map(x => x.p);
    }
    // Ordem padrão: régua nova em lib/intentEngine (seu número > vendas >
    // avaliação como desempate > sorteio diário estável; resto-de-grade desce)
    // e o MOTOR DE INTENÇÃO roda por cima (retorno "na mira" + categoria da
    // sessão). selectedProduct na dependência = a grade se reorganiza no
    // momento que o produto fecha, nunca embaixo do dedo durante o scroll.
    return aplicarMotor(ordenarGradePadrao(filteredProducts, ratingsMap));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredProducts, ratingsMap, searchActive, searchIntent, sortMode, selectedProduct]);

  // Produtos do histórico (ids -> objetos atuais), só os que ainda existem/têm estoque
  // e excluindo o que está aberto agora.
  const recentlyViewedProducts = useMemo(() => (
    (recentlyViewed || [])
      .map(id => (products || []).find(p => p.id === id))
      .filter(p => p && (p.is_kit || (p.stock || 0) > 0) && p.id !== selectedProduct?.id)
      .slice(0, 10)
  ), [recentlyViewed, products, selectedProduct?.id]);

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
    !!zoomImage        && (() => setZoomImage(null)),
    !!stockAlertTarget && (() => setStockAlertTarget(null)),
    showSizeGuide      && (() => setShowSizeGuide(false)),
    !!infoPage         && (() => setInfoPage(null)),
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

  // Pedidos agora vêm da edge function site-account com o TOKEN da sessão:
  // o servidor só devolve pedidos do telefone dono do token. (Antes o site
  // consultava orders por telefone digitado — qualquer um via pedido de
  // qualquer um. Esse furo morreu junto com a conta sem senha.)
  const handleSearchMyOrders = async () => {
    const token = getSessionToken();
    if (!token) {
      setMyOrdersResults([]);
      showToast('Entre na sua conta pra ver seus pedidos.', 'error');
      setDrawerTab('profile');
      setAuthMode('login');
      setShowUserDrawer(true);
      return;
    }
    setMyOrdersLoading(true);
    try {
      const { orders } = await fetchAccountOrders(token);
      setMyOrdersResults(orders || []);
    } catch (e) {
      if (e?.status === 401) {
        sairDaConta();
        showToast('Sessão expirada. Entre de novo.', 'error');
      } else {
        showToast('Erro ao buscar pedidos: ' + (e?.message || 'tente novamente'), 'error');
      }
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

  // Avisos de estoque pendentes (badge na aba admin "Avisos").
  useEffect(() => {
    if (!isAdmin) return;
    fetchStockAlerts()
      .then(rows => setStockAlertsPending(rows.filter(r => !r.notified).length))
      .catch(() => {});
  }, [isAdmin]);

  const handleOpenUserDrawer = () => {
    if (accountToken && userProfile?.phone) {
      // logado de verdade (senha): direto pros pedidos
      setDrawerTab('orders');
      setTimeout(() => handleSearchMyOrders(), 100);
    } else if (userProfile?.phone) {
      // perfil antigo sem senha: convida a proteger a conta (cadastro pré-preenchido)
      setDrawerTab('profile');
      setAuthMode('signup');
      setAuthForm(f => ({ ...f, name: userProfile.name || '', phone: userProfile.phone || '' }));
    } else {
      setDrawerTab('profile');
      setAuthMode('login');
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
    { key: 'alerts', icon: <Bell size={18}/>, label: 'Avisos', badge: stockAlertsPending > 0 ? (stockAlertsPending > 99 ? '99+' : String(stockAlertsPending)) : null },
    { key: 'config', icon: <Settings size={18}/>, label: 'Setup' },
    { key: 'rastreio', icon: <Database size={18}/>, label: 'CAPI' },
  ];

  if (isAdmin) {
    return (
      <div className="app-shell min-h-dvh bg-zinc-950 font-sans text-zinc-100 selection:bg-emerald-500 selection:text-zinc-950">
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
              <React.Suspense fallback={<div className="flex items-center justify-center py-20 text-zinc-400 text-[11px] font-black uppercase tracking-widest">Carregando…</div>}>
              {adminTab === 'dashboard' && <AdminDashboard leads={leads} products={products} loading={!leadsLoaded} setAdminTab={setAdminTab} />}
              {adminTab === 'inventory' && <AdminInventory products={products} setProducts={setProducts} showToast={showToast} availableCollections={availableCollections} productImageFile={productImageFile} setProductImageFile={setProductImageFile} uploadImage={uploadImage} />}
              {adminTab === 'leads' && <AdminLeads leads={leads} setLeads={setLeads} products={products} setProducts={setProducts} showToast={showToast} config={config} mapOrderRow={mapOrderRow} />}
              {adminTab === 'banners' && <AdminBanners banners={banners} setBanners={setBanners} showToast={showToast} bannerImageFile={bannerImageFile} setBannerImageFile={setBannerImageFile} uploadImage={uploadImage} products={products} setProducts={setProducts} />}
              {adminTab === 'config' && <AdminConfig config={config} setConfig={setConfig} showToast={showToast} products={products} setProducts={setProducts} uploadImage={uploadImage} />}
              {adminTab === 'rastreio' && <AdminRastreio />}
              {adminTab === 'crm' && <AdminCRM showToast={showToast} config={config} />}
              {adminTab === 'growth' && <AdminGrowth leads={leads} products={products} config={config} />}
              {adminTab === 'alerts' && <AdminStockAlerts showToast={showToast} onPendingChange={setStockAlertsPending} products={products} />}
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
    <div className="app-shell brilho-ambient min-h-dvh font-sans text-white pb-0 selection:bg-emerald-500 selection:text-zinc-950">

      {/* Atmosfera 3D (three.js lazy): profundidade pro brilho-ambient, z -1
          dentro do shell isolado — acima do fundo, abaixo de TODO o conteúdo.
          Motion só com scroll; parada, não repinta nada. */}
      <ThreeAtmosphere />
      {/* Luz neon que segue o dedo/cursor — continuação do galpão do hero */}
      <TouchGlow />

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

      <HeaderBar {...{ cart, cartBounce, categories, config, handleOpenUserDrawer, selectedCategory, setActiveCollectionFilter, setCurrentPage, setKitsOnly, setSearchQuery, setSelectedCategory, setSelectedProduct, setSelectedSize, setSelectedSizes, setSelectedSubcategory, setShowCart, setShowQuickMenu, userProfile }} />

      {/* CORPO DA LOJA — DESMONTADO (não só escondido) quando a página de produto
          está aberta. Ao abrir um produto, o site inteiro (catálogo, banners e TODOS
          os observers/imagens dos cards) sai da árvore React = libera banda e CPU
          100% pro card aberto (imagens extras + vídeo carregam rápido, nada do site
          carrega junto). Fechar o produto remonta o home. */}
      {!productPageOpen && (
      <div>

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

      {/* Hero de vídeo da marca no lugar do carrossel (dono, 2026-07-11).
          Pra voltar: <BannerCarousel activeBanners={activeBanners} bannersLoaded={bannersLoaded} isAdmin={isAdmin} onCollectionFilter={setActiveCollectionFilter} /> */}
      <HeroVideo />

      <CatalogMain {...{ activeCollectionFilter, availableColors, availableSizes, availableSubcategories, bumpOffers, catRailRef, categories, config, currentPage, filteredProducts, handleProductClick, isDesktopViewport, kitsOnly, midBanner, navigateToSubcategory, noveltyMode, onCatRailScroll, paginatedProducts, prefersReducedMotion, priceRange, products, productsLoaded, ratingsMap, recentlyViewedProducts, searchActive, searchIntent, searchQuery, selectedCategory, selectedColor, selectedProduct, selectedSize, selectedSubcategory, selectionSkus, setActiveCollectionFilter, setCurrentPage, setDrawerTab, setKitsOnly, setNoveltyMode, setPriceRange, setRatingsMap, setSearchQuery, setSelectedCategory, setSelectedColor, setSelectedProduct, setSelectedSize, setSelectedSizes, setSelectedSubcategory, setSelectionSkus, setShowUserDrawer, setSortMode, showToast, sortMode, sortedProducts, totalPages, userProfile }} />

      {/* ── BLOCO DE CONFIANÇA — loja real e local (reforço antes do rodapé) ── */}
      <TrustBadges {...{ config }} />

      {/* Footer também com fundo sólido (era zinc-900/50 translúcido — mesma causa de flicker no Android) */}
      <StoreFooter {...{ accountToken, config, handleSearchMyOrders, handleSecretDoubleTap, setInfoPage, setShowMyOrders }} />
      </div>
      )}
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
        <ProductVideoPip key={`pip-kit-${selectedProduct.id}`} src={selectedProduct.video_url} poster={selectedProduct.image} />
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

      <ProductPageOverlay {...{ activeProductImage, bumpOffers, config, handleCommitToCart, handleShareProduct, handleSizeSelect, kitItemsByKit, productSwipeRef, products, ratingsMap, selectedProduct, selectedSizes, setActiveCollectionFilter, setActiveProductImage, setDrawerTab, setRatingsMap, setSelectedCategory, setSelectedProduct, setSelectedSizes, setSelectedSubcategory, setShowSizeGuide, setShowUserDrawer, setStockAlertTarget, setZoomImage, showToast, userProfile }} />

      {/* Modal "Avise-me quando voltar" (estoque) */}
      <StockAlertModal target={stockAlertTarget} onClose={() => setStockAlertTarget(null)} showToast={showToast} whatsapp={config?.whatsapp} />

      {/* Guia de medidas (página do produto) */}
      {showSizeGuide && selectedProduct && (
        <SizeGuideModal product={selectedProduct} whatsapp={config?.whatsapp} onClose={() => setShowSizeGuide(false)} />
      )}

      {/* Páginas institucionais do rodapé (Sobre / Trocas / Privacidade) */}
      <InfoModal page={infoPage} config={config} onClose={() => setInfoPage(null)} />

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
            src={optimizeImage(zoomImage, 2000, 92)}
            alt="Visualização ampliada"
            className="max-w-full max-h-full object-contain rounded-3xl shadow-[0_20px_80px_rgba(0,0,0,0.6)] animate-in"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[9px] font-black text-white/60 uppercase tracking-widest">
            Toque fora para fechar
          </div>
        </div>
      )}

      <CartOverlay {...{ aplicarCupom, cart, cupomAtivo, cupomDiscount, cupomInput, hasOfferInCart, pixDiscount, products, removerCupom, setActiveProductImage, setCart, setCupomInput, setSelectedProduct, setSelectedSizes, setShowCart, setShowLeadModal, showCart, showToast, subtotal, totalComPix, viewportOverlayStyle }} />

      {/* Pop-up de boas-vindas com cupom (bloco: mobile, 1ª visita) */}
      <WelcomeCoupon
        aberto={showWelcome}
        cupom="NOVOFLUXO5"
        onFechar={() => setShowWelcome(false)}
        onQueroCupom={() => {
          interacaoElemento('cupom_boas_vindas');
          setShowWelcome(false);
          // Sem catraca: um toque e o cupom fica ativo (persistido) — aplica
          // sozinho quando a sacola montar. Cadastro saiu da frente (3,7%!).
          aplicarCupom('NOVOFLUXO5');
        }}
      />

      <LeadModalOverlay {...{ cart, checkoutOrderNumber, checkoutSuccess, currentLead, handleFinalize, isLoading, setCheckoutSuccess, setCurrentLead, setShowLeadModal, showLeadModal, showToast, viewportOverlayStyle, whatsappLink }} />

      <MyOrdersOverlay {...{ accountToken, myOrdersResults, setAuthForm, setAuthMode, setDrawerTab, setMyOrdersPhone, setMyOrdersResults, setShowMyOrders, setShowUserDrawer, showMyOrders, userProfile, viewportOverlayStyle }} />

      <UserDrawerOverlay {...{ accountToken, authForm, authLoading, authMode, config, drawerTab, handleAuthSubmit, handleSearchMyOrders, myOrdersLoading, myOrdersResults, recoveryToShow, sairDaConta, saveUserProfile, setAuthForm, setAuthMode, setCurrentLead, setDrawerTab, setMyOrdersPhone, setMyOrdersResults, setRecoveryToShow, setShowUserDrawer, showToast, showUserDrawer, userProfile, viewportOverlayStyle, viewportPanelMaxHeight }} />

      {/* ── Quick Menu Drawer ── */}
      <QuickMenuOverlay {...{ categories, categorySizesMap, config, expandedSizeCategory, handleOpenUserDrawer, kitsOnly, noveltyMode, searchQuery, selectedCategory, selectedSize, setExpandedSizeCategory, setKitsOnly, setNoveltyMode, setSearchQuery, setSelectedCategory, setSelectedSize, setSelectedSubcategory, setShowQuickMenu, setShowSizeFilter, showQuickMenu, showSizeFilter }} />

      <GlobalStyles />
    </div>
  );
}

export default App;
// Force redeploy Thu Apr 23 13:43:02 EDT 2026
