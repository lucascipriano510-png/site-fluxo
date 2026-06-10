import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { 
  Plus, Minus, Trash2, X, Search, LayoutDashboard, 
  ShoppingBag, Home, Power, Package, 
  TrendingUp, Box, MessageCircle,
  Zap, Share2, Info, Star, ChevronRight, ChevronLeft, ChevronUp, ChevronDown, ArrowRight,
  RefreshCcw, Layers, Settings, Tag, 
  AlertCircle, DollarSign, MapPin, Edit3, User, Phone, 
  CheckCircle2, Camera, Save, ArrowLeft, BarChart3,
  LogOut, ClipboardList, Database, Filter, Eye,
  Barcode, QrCode, AlertTriangle, Upload, Image as ImageIcon,
  Maximize2, ZoomIn, Bell, Clock, Truck, Check, XCircle,
  Flame, ShieldCheck, Award, CreditCard, Lock, Megaphone, ImagePlus,
  GripVertical, Instagram, ShieldQuestion, Globe, HelpCircle, ScanLine, Scan
} from 'lucide-react';
import { fetchProducts, upsertProduct, deleteProduct as deleteProductRemote, fetchBanners, upsertBanner, deleteBanner as deleteBannerRemote, uploadImage, fetchAllKitItems, fetchKitItems, saveKitItems } from './lib/supabase';
import { createOrder, fetchOrders, confirmOrderSale, cancelOrder, deleteOrder as deleteOrderRemote, updateOrderStatus, updateOrderPhone, updateOrderValue, restoreOrderStock } from './lib/orders';
import { supabase } from './lib/supabaseClient';
import { fetchSiteConfig, upsertSiteConfig, DEFAULT_CONFIG as SITE_DEFAULT_CONFIG } from './lib/siteConfig';
import { dispatchCAPIPurchase, dispatchCAPIRefund } from './lib/capi';
import { initMetaPixel, trackEvent } from './lib/metaPixel';
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip as ReTooltip, Cell } from 'recharts';
import AdminRastreio from './components/AdminRastreio';
import AdminCRM from './components/AdminCRM';
import { criarAtendimentoFromPedido } from './lib/crm';
import { fetchRatingsBatch, fetchProductReviews, fetchExistingReview, submitReview } from './lib/reviews';

// ==========================================
// 1. CONFIGURAÇÃO E DADOS INICIAIS
// ==========================================
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatBRL = (v) => BRL.format(Number(v) || 0);
const getCatImgData = (val) => {
  if (!val) return { url: null, pos: '50% 50%' };
  if (typeof val === 'string') return { url: val, pos: '50% 50%' };
  return { url: val.url || null, pos: val.pos || '50% 50%' };
};
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

const DEFAULT_BANNERS = [];

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

// Otimização de imagens via CDN (WebP + resize on-the-fly).
const optimizeImage = (src, width = 600, quality = 90) => {
  if (!src || typeof src !== 'string') return src;
  if (src.startsWith('data:') || src.startsWith('blob:')) return src;
  try {
    if (src.includes('images.unsplash.com')) {
      const u = new URL(src);
      u.searchParams.set('w', String(width));
      u.searchParams.set('q', String(quality));
      u.searchParams.set('auto', 'format');
      u.searchParams.set('fit', 'crop');
      return u.toString();
    }
    // Todas as URLs (inclusive Supabase) passam pelo wsrv.nl para
    // redimensionamento correto + WebP. &we = sem ampliar se já for menor.
    const clean = src.replace(/^https?:\/\//, '');
    return `https://wsrv.nl/?url=${encodeURIComponent(clean)}&w=${width}&q=${quality}&output=webp&we`;
  } catch {
    return src;
  }
};

const buildSrcSet = (src, widths = [400, 600, 900, 1200, 1600], quality = 90) => {
  if (!src) return undefined;
  return widths.map((w) => `${optimizeImage(src, w, quality)} ${w}w`).join(', ');
};

const ProductImage = ({ src, alt, isOutOfStock, priority = false, sizes: sizesProp }) => {
  const [loaded, setLoaded] = React.useState(false);
  const [inView, setInView] = React.useState(priority);
  const wrapperRef = React.useRef(null);

  React.useEffect(() => {
    if (!src) return;
    setLoaded(false);
    if (priority) { setInView(true); return; }
    setInView(false);
    const el = wrapperRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setInView(true);
            io.disconnect();
          }
        });
      },
      { rootMargin: '400px 0px', threshold: 0.01 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [src, priority]);

  const srcSet = buildSrcSet(src);

  return (
    <div ref={wrapperRef} className="absolute inset-0">
      {!loaded && (
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, var(--bg-surface) 25%, var(--bg-elevated) 50%, var(--bg-surface) 75%)', backgroundSize: '200% 100%', animation: 'skeleton-shine 1.4s ease-in-out infinite', zIndex: 1 }} />
      )}
      {inView && (
        <img
          src={optimizeImage(src, 1200, 90)}
          srcSet={srcSet}
          sizes={sizesProp || "(min-width: 1280px) 22vw, (min-width: 1024px) 30vw, 50vw"}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={priority ? 'high' : 'low'}
          onLoad={() => setLoaded(true)}
          draggable={false}
          style={{ pointerEvents: 'none' }}
          className={`w-full h-full object-contain transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'} ${isOutOfStock ? 'grayscale opacity-40' : ''} transition-transform`}
        />
      )}
    </div>
  );
};

const BannerImage = ({ src, alt, active }) => {
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    setLoaded(false);
  }, [src]);

  if (!src) return <div className="absolute inset-0 bg-black" />;

  return (
    <>
      {!loaded && <div className="absolute inset-0 bg-black" />}
      <img
        src={optimizeImage(src, 1920, 90)}
        srcSet={buildSrcSet(src, [640, 900, 1280, 1920, 2560], 90)}
        sizes="100vw"
        className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        style={{ objectPosition: 'center 55%' }}
        alt={alt}
        loading={active ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={active ? 'high' : 'low'}
        onLoad={() => setLoaded(true)}
        draggable={false}
      />
    </>
  );
};

// Wrapper compat: encaminha pro pipeline híbrido (Pixel + CAPI com dedup)
const trackPixel = (eventName, payload = {}) => {
  try { trackEvent(eventName, payload); }
  catch (e) { console.warn('[trackPixel] falhou:', e); }
};

const createMetaEventId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `evt_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

// ==========================================
// 3. COMPONENTES ADMIN DESACOPLADOS
// ==========================================

const AdminHeader = ({ handleLogout, handleBackToStore }) => (
  <div className="bg-zinc-950 text-white px-6 py-6 flex justify-between items-center sticky top-0 z-50 border-b border-white/5">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.3)] relative overflow-hidden">
        <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
        <LayoutDashboard size={20} className="text-zinc-950 relative z-10"/>
      </div>
      <div>
        <h2 className="font-black italic text-lg leading-none uppercase tracking-tighter">Master Control</h2>
        <p className="text-[9px] font-bold text-zinc-500 tracking-[0.2em] uppercase flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Operacional</p>
      </div>
    </div>
    <div className="flex items-center gap-2">
      <button onClick={handleBackToStore} title="Voltar para a loja sem deslogar" className="px-3 py-2 bg-white/5 border border-white/10 text-white rounded-full font-black text-[10px] uppercase tracking-widest hover:bg-white/10 transition-colors flex items-center gap-2" data-testid="admin-back-to-store">
        <ArrowLeft size={12} /> Loja
      </button>
      <button onClick={handleLogout} className="px-4 py-2 bg-white text-zinc-950 rounded-full font-black text-[10px] uppercase tracking-widest hover:bg-zinc-200 transition-colors flex items-center gap-2 shadow-[0_0_15px_rgba(255,255,255,0.2)]">
        Sair <LogOut size={12} />
      </button>
    </div>
  </div>
);

const AdminDashboard = ({ leads, products }) => {
  const validLeads = (leads || []).filter(l => l.status !== 'CANCELADO');
  const concludedLeads = (leads || []).filter(l => l.status === 'CONCLUÍDO');
  const totalRevenue = concludedLeads.reduce((a, b) => a + parseFloat(b.value || 0), 0);
  const avgTicket = concludedLeads.length > 0 ? (totalRevenue / concludedLeads.length) : 0;
  
  // PROTEÇÃO CONTRA CRASH: (lead.items || []) blinda o sistema contra leads antigos sem items
  const totalItemsSold = concludedLeads.reduce((acc, lead) => acc + (lead.items || []).reduce((sum, item) => sum + (item.quantity || item.qty || 0), 0), 0);

  // Dados últimos 7 dias (vendas concluídas por dia)
  const chartData = useMemo(() => {
    const days = [];
    const today = new Date();
    today.setHours(0,0,0,0);
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0,10);
      const label = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.','').toUpperCase().slice(0,3);
      days.push({ key, label, valor: 0, pedidos: 0 });
    }
    concludedLeads.forEach(l => {
      const raw = l._raw?.created_at;
      if (!raw) return;
      const k = new Date(raw).toISOString().slice(0,10);
      const d = days.find(x => x.key === k);
      if (d) { d.valor += Number(l.value || 0); d.pedidos += 1; }
    });
    return days;
  }, [concludedLeads]);
  
  const outOfStockProducts = (products || []).filter(p => !p.is_kit && p.stock === 0);

  const statusColors = { 'NOVO': 'text-blue-500 bg-blue-500/10', 'EM ATENDIMENTO': 'text-amber-500 bg-amber-500/10', 'CONCLUÍDO': 'text-emerald-500 bg-emerald-500/10', 'CANCELADO': 'text-red-500 bg-red-500/10' };

  return (
    <div className="p-6 space-y-6 animate-in pb-24">
      <div className="bg-gradient-to-br from-emerald-900 to-zinc-950 p-6 rounded-[32px] border border-emerald-500/20 shadow-2xl relative overflow-hidden">
        <div className="absolute -right-4 -top-4 opacity-10"><DollarSign size={180}/></div>
        <p className="text-[10px] font-black text-emerald-500/80 uppercase tracking-widest mb-1 relative z-10 flex items-center gap-2"><TrendingUp size={12}/> Vendas Totais / Receita</p>
        <h3 className="text-4xl font-black text-white italic relative z-10 tracking-tighter shadow-black drop-shadow-md">R$ {totalRevenue.toLocaleString(undefined, {minimumFractionDigits: 2})}</h3>
        <div className="h-24 mt-6 relative z-10 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{top: 5, right: 6, bottom: 0, left: 6}}>
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#71717a', fontWeight: 900 }} axisLine={false} tickLine={false} />
              <ReTooltip
                cursor={{ fill: 'rgba(16,185,129,0.08)' }}
                contentStyle={{ background: '#09090b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 11, fontWeight: 900 }}
                labelStyle={{ color: '#a1a1aa' }}
                formatter={(v, n) => n === 'valor' ? [`R$ ${Number(v).toFixed(2)}`, 'Vendas'] : [v, 'Pedidos']}
              />
              <Bar dataKey="valor" radius={[6,6,0,0]}>
                {chartData.map((e, i) => (<Cell key={i} fill={e.valor > 0 ? '#10b981' : '#27272a'} />))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-zinc-900 p-5 rounded-[24px] border border-white/5 shadow-xl flex flex-col justify-between">
          <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2 flex items-center gap-1.5"><ShoppingBag size={12}/> Pedidos</p>
          <h3 className="text-2xl font-black text-white">{validLeads.length}</h3>
        </div>
        <div className="bg-zinc-900 p-5 rounded-[24px] border border-white/5 shadow-xl flex flex-col justify-between">
          <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Package size={12}/> Peças Vendidas</p>
          <h3 className="text-2xl font-black text-white">{totalItemsSold}</h3>
        </div>
        <div className="col-span-2 bg-zinc-900 p-5 rounded-[24px] border border-white/5 shadow-xl flex flex-col justify-between">
          <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2 flex items-center gap-1.5"><BarChart3 size={12}/> Ticket Médio (TM)</p>
          <h3 className="text-2xl font-black text-emerald-500 tracking-tighter">{formatBRL(avgTicket)}</h3>
        </div>
      </div>

      <div className="bg-zinc-900/50 p-6 rounded-[32px] border border-white/5 space-y-4">
         <h4 className="font-black text-[11px] uppercase tracking-widest text-white flex items-center gap-2"><Clock size={14} className="text-zinc-400"/> Pedidos Recentes</h4>
         {(leads || []).slice(0, 4).length === 0 ? (
             <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Nenhuma atividade ainda.</p>
         ) : (
             <div className="space-y-3">
                 {(leads || []).slice(0, 4).map((l, i) => (
                     <div key={i} className="flex justify-between items-center border-b border-white/5 pb-3 last:border-0 last:pb-0">
                         <div className="flex flex-col">
                             <span className="text-[11px] font-black uppercase text-white truncate w-32">{(l.name || 'Desconhecido').split(' ')[0]}</span>
                             <span className="text-[9px] font-bold text-zinc-500">#{l.orderNumber || '0000'}</span>
                         </div>
                         <div className="flex flex-col items-end gap-1">
                             <span className="text-[11px] font-black text-emerald-500">{formatBRL(l.value || 0)}</span>
                             <span className={`text-[7px] font-black uppercase px-2 py-0.5 rounded-full ${statusColors[l.status || 'NOVO']}`}>{l.status || 'NOVO'}</span>
                         </div>
                     </div>
                 ))}
             </div>
         )}
      </div>

    </div>
  );
};

const AdminInventory = ({ products, setProducts, showToast, availableCollections, productImageFile, setProductImageFile, uploadImage }) => {
  const [editMode, setEditMode] = useState(null);
  const [invSearch, setInvSearch] = useState('');

  // Calcula próximo SKU sequencial com base nos SKUs puramente numéricos existentes
  const nextSku = useMemo(() => {
    const nums = (products || [])
      .map(p => p.sku)
      .filter(s => /^\d+$/.test(s || ''))
      .map(s => parseInt(s, 10));
    const max = nums.length > 0 ? Math.max(...nums) : 0;
    return String(max + 1).padStart(4, '0');
  }, [products]);

  const handleReorganizeSkus = async () => {
    if (!window.confirm(`Isso vai renumerar os SKUs de ${products.length} produto(s) em ordem sequencial (0001, 0002…). Continuar?`)) return;
    const sorted = [...products].sort((a, b) => {
      const aNum = /^\d+$/.test(a.sku || '') ? parseInt(a.sku, 10) : Infinity;
      const bNum = /^\d+$/.test(b.sku || '') ? parseInt(b.sku, 10) : Infinity;
      return aNum !== bNum ? aNum - bNum : (a.name || '').localeCompare(b.name || '');
    });
    const updated = sorted.map((p, i) => ({ ...p, sku: String(i + 1).padStart(4, '0') }));
    let errors = 0;
    for (const p of updated) {
      try { await upsertProduct(p); } catch { errors++; }
    }
    setProducts(updated);
    showToast(errors > 0 ? `Reorganizado com ${errors} erro(s).` : 'SKUs reorganizados com sucesso!', errors > 0 ? 'error' : 'success');
  };
  const [previewImage, setPreviewImage] = useState('');
  const [formSizes, setFormSizes] = useState([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // ===== NOVOS CAMPOS =====
  const [isActive, setIsActive] = useState(true);
  const [color, setColor] = useState('');
  const [secondaryColors, setSecondaryColors] = useState([]);
  const [secondaryColorInput, setSecondaryColorInput] = useState('');
  const [productType, setProductType] = useState('');
  const [material, setMaterial] = useState('');
  const [searchTags, setSearchTags] = useState([]);
  const [searchTagInput, setSearchTagInput] = useState('');
  const [botDescription, setBotDescription] = useState('');
  const [promotionalPrice, setPromotionalPrice] = useState('');

  // ===== KIT (Bundle Builder) =====
  const [isKit, setIsKit] = useState(false);
  const [galleryUrls, setGalleryUrls] = useState([]);
  const [isUploadingGallery, setIsUploadingGallery] = useState(false);
  const [kitComponentIds, setKitComponentIds] = useState([]);
  const [kitSearch, setKitSearch] = useState('');

  const [showScanner, setShowScanner] = useState(false);
  const [scannedProduct, setScannedProduct] = useState(null);
  const [scannedSize, setScannedSize] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [isScannerReady, setIsScannerReady] = useState(false);
  const scannerInputRef = useRef(null);

  useEffect(() => {
    if (editMode && editMode !== 'new') {
      setPreviewImage(editMode.image);
      let normalizedSizes = [];
      if (editMode.sizes && editMode.sizes.length > 0) {
         if (typeof editMode.sizes[0] === 'string') {
            const stockPerSize = Math.floor((editMode.stock || 0) / editMode.sizes.length);
            normalizedSizes = editMode.sizes.map(s => ({ size: s, stock: stockPerSize }));
         } else {
            normalizedSizes = editMode.sizes;
         }
      }
      setFormSizes(normalizedSizes.length > 0 ? normalizedSizes : [{ size: 'U', stock: editMode.stock || 0 }]);
      setIsKit(!!editMode.is_kit);
      setGalleryUrls(Array.isArray(editMode.gallery) ? editMode.gallery : []);
      setIsActive(editMode.is_active !== false);
      setColor(editMode.color || '');
      setSecondaryColors(Array.isArray(editMode.secondary_colors) ? editMode.secondary_colors : []);
      setProductType(editMode.product_type || '');
      setMaterial(editMode.material || '');
      setSearchTags(Array.isArray(editMode.search_tags) ? editMode.search_tags : []);
      setBotDescription(editMode.bot_description || '');
      setPromotionalPrice(editMode.promotional_price != null ? String(editMode.promotional_price) : '');
      if (editMode.is_kit && editMode.id) {
        fetchKitItems(editMode.id)
          .then(rows => setKitComponentIds(rows.map(r => r.product_id)))
          .catch(() => setKitComponentIds([]));
      } else {
        setKitComponentIds([]);
      }
    } else if (editMode === 'new') {
      setPreviewImage('');
      setFormSizes([{ size: 'P', stock: 5 }, { size: 'M', stock: 5 }]);
      setIsKit(false);
      setGalleryUrls([]);
      setKitComponentIds([]);
      setIsActive(true);
      setColor('');
      setSecondaryColors([]);
      setProductType('');
      setMaterial('');
      setSearchTags([]);
      setBotDescription('');
      setPromotionalPrice('');
    }
    setSecondaryColorInput('');
    setSearchTagInput('');
    setKitSearch('');
    setProductImageFile(null);
  }, [editMode]);

  const handleGalleryFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setIsUploadingGallery(true);
    try {
      const urls = [];
      for (const f of files) {
        const url = await uploadImage(f);
        if (url) urls.push(url);
      }
      setGalleryUrls(prev => [...prev, ...urls]);
      showToast(`${urls.length} imagem(ns) adicionada(s)`);
    } catch (err) {
      showToast('Erro ao subir galeria: ' + err.message, 'error');
    } finally {
      setIsUploadingGallery(false);
      e.target.value = '';
    }
  };

  const removeGalleryUrl = (url) => setGalleryUrls(prev => prev.filter(u => u !== url));

  const toggleKitComponent = (pid) => {
    setKitComponentIds(prev => prev.includes(pid) ? prev.filter(x => x !== pid) : [...prev, pid]);
  };


  useEffect(() => {
    if (showScanner && cameraActive) {
      if (window.Html5Qrcode) {
        setIsScannerReady(true);
        return;
      }
      const existingScript = document.getElementById('barcode-scanner-lib');
      if (!existingScript) {
        const script = document.createElement('script');
        script.id = 'barcode-scanner-lib';
        script.src = 'https://unpkg.com/html5-qrcode';
        script.async = true;
        script.onload = () => setIsScannerReady(true);
        script.onerror = () => {
           showToast("Falha na rede ao carregar motor óptico.", "error");
           setCameraActive(false);
        };
        document.head.appendChild(script);
      }
    }
  }, [showScanner, cameraActive]);

  useEffect(() => {
    let html5QrCode;
    let isComponentMounted = true;

    const initCamera = async () => {
      if (!showScanner || !cameraActive || !isScannerReady || scannedProduct) return;
      
      try {
        html5QrCode = new window.Html5Qrcode("reader");
        
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.tagName === 'VIDEO') {
                        node.setAttribute('playsinline', 'true');
                        node.setAttribute('webkit-playsinline', 'true');
                        node.setAttribute('muted', 'true');
                    }
                });
            });
        });
        const readerElement = document.getElementById('reader');
        if(readerElement) observer.observe(readerElement, { childList: true, subtree: true });

        await html5QrCode.start(
          { facingMode: "environment" },
          { 
              fps: 15,
              qrbox: function(viewfinderWidth, viewfinderHeight) {
                  return { width: Math.floor(viewfinderWidth * 0.8), height: 120 };
              },
              aspectRatio: 1.0
          },
          (decodedText) => {
            if (!isComponentMounted) return;
            if (navigator.vibrate) navigator.vibrate(200);
            
            html5QrCode.stop().then(() => {
              if (isComponentMounted) {
                  setCameraActive(false);
                  processBarcode(decodedText);
              }
            }).catch(console.error);
          },
          (errorMessage) => { /* ignora erros de scan frame */ }
        );
      } catch (err) {
        if (isComponentMounted) {
          console.error(err);
          showToast("Permita o uso da câmera no navegador.", "error");
          setCameraActive(false);
        }
      }
    };

    initCamera();

    return () => {
      isComponentMounted = false;
      if (html5QrCode) {
        try {
          html5QrCode.stop().then(() => html5QrCode.clear()).catch(() => {});
        } catch (e) {}
      }
    };
  }, [showScanner, cameraActive, isScannerReady, scannedProduct]);

  useEffect(() => {
    if (showScanner && !cameraActive && !scannedProduct && scannerInputRef.current) {
      setTimeout(() => { if (scannerInputRef.current) scannerInputRef.current.focus(); }, 100);
    }
  }, [showScanner, cameraActive, scannedProduct]);

  const handleSizeChange = (index, field, value) => {
    const newSizes = [...formSizes];
    newSizes[index][field] = field === 'stock' ? parseInt(value) || 0 : value.toUpperCase();
    setFormSizes(newSizes);
  };

  const removeSize = (index) => setFormSizes(formSizes.filter((_, i) => i !== index));
  const addSize = () => setFormSizes([...formSizes, { size: '', stock: 0 }]);

  const filteredInv = (products || []).filter(p => 
    (p.name || '').toLowerCase().includes(invSearch.toLowerCase()) || 
    (p.sku || '').toLowerCase().includes(invSearch.toLowerCase())
  );

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProductImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_SIZE = 400; 
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
          } else {
            if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
          }
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          setPreviewImage(canvas.toDataURL('image/jpeg', 0.6)); 
          setIsUploadingImage(false);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsUploadingImage(true);
    try {
      let imageUrl = editMode?.image || 'https://images.unsplash.com/photo-1558769132-cb1fac08c04b?w=400';
      
      // Se houver um novo arquivo, faz o upload para o Storage
      if (productImageFile) {
        showToast('Enviando imagem em alta resolução...', 'info');
        imageUrl = await uploadImage(productImageFile);
      }

      const computedStock = formSizes.reduce((acc, curr) => acc + (parseInt(curr.stock) || 0), 0);
      const fd = new FormData(e.target);
      const productId = editMode === 'new' ? Date.now() : editMode.id;
      const data = {
        id: productId,
        sku: fd.get('sku').toUpperCase(),
        name: isKit ? `Kit ${fd.get('sku').toUpperCase()}` : fd.get('name'),
        price: parseFloat(fd.get('price')),
        category: isKit ? 'KITS' : fd.get('category').toUpperCase(),
        subcategory: (fd.get('subcategory') || '').toString().trim().toUpperCase() || null,
        collection_name: fd.get('collection_name') || null,
        image: imageUrl,
        stock: isKit ? 0 : computedStock,
        sales: editMode === 'new' ? 0 : editMode.sales,
        sizes: isKit ? [] : formSizes.filter(s => s.size && s.size.trim() !== ''),
        featured: fd.get('featured') === 'on',
        is_kit: isKit,
        gallery: galleryUrls,
        is_active: isActive,
        color: color || null,
        secondary_colors: secondaryColors.length > 0 ? secondaryColors : null,
        product_type: productType.trim() || null,
        material: material.trim() || null,
        search_tags: searchTags.length > 0 ? searchTags : null,
        bot_description: botDescription.trim() || null,
        promotional_price: promotionalPrice !== '' ? parseFloat(promotionalPrice) : null,
        featured_order: editMode !== 'new' && typeof editMode.featured_order === 'number' ? editMode.featured_order : 999,
      };
      const updatedProducts = editMode === 'new' ? [data, ...products] : products.map(p => p.id === data.id ? data : p);
      setProducts(updatedProducts);
      // Persiste componentes do kit
      if (isKit) {
        try {
          await saveKitItems(productId, kitComponentIds);
        } catch (err) {
          console.warn('[kit_items] falha ao salvar:', err?.message);
          showToast('Produto salvo, mas falhou ao salvar componentes do kit.', 'error');
        }
      }
      showToast('Produto salvo com sucesso!');
      setEditMode(null);
      setPreviewImage('');
      setProductImageFile(null);
    } catch (err) {
      console.error('[save] erro:', err);
      showToast('Erro ao salvar produto: ' + err.message, 'error');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const processBarcode = (code) => {
    if (!code) return;
    const sanitizedCode = code.toString().trim().toUpperCase();
    if (!sanitizedCode) return;

    let foundProduct = null;
    let foundSize = '';

    foundProduct = products.find(p => (p.sku || '').toUpperCase() === sanitizedCode);
    
    if (!foundProduct && sanitizedCode.includes('-')) {
        const parts = sanitizedCode.split('-');
        const baseSku = parts.slice(0, -1).join('-'); 
        const possibleSize = parts[parts.length - 1]; 

        const possibleProduct = products.find(p => (p.sku || '').toUpperCase() === baseSku);
        if (possibleProduct) {
            const sizeExists = (possibleProduct.sizes || []).some(s => (s.size || s).toString().toUpperCase() === possibleSize);
            if (sizeExists) {
                foundProduct = possibleProduct;
                foundSize = possibleSize;
            }
        }
    }

    if (foundProduct) {
        setScannedProduct(foundProduct);
        if (foundSize) {
             setScannedSize(foundSize);
        } else if ((foundProduct.sizes || []).length === 1) {
             setScannedSize(foundProduct.sizes[0].size || foundProduct.sizes[0]);
        } else {
             setScannedSize(''); 
        }
        showToast('Produto localizado.', 'success');
    } else {
        showToast(`Código não encontrado: ${sanitizedCode}`, 'error');
        if (!cameraActive && scannerInputRef.current) setTimeout(() => scannerInputRef.current.focus(), 50);
    }
  };

  const handlePhysicalScan = (e) => {
    e.preventDefault();
    processBarcode(e.target.elements.barcode.value);
    e.target.reset();
  };

  const handleStockAction = (actionType) => {
      if (!scannedProduct) return;
      if ((scannedProduct.sizes || []).length > 0 && !scannedSize) { showToast('Selecione a variação/tamanho lida.', 'error'); return; }

      const updatedProducts = products.map(p => {
          if (p.id !== scannedProduct.id) return p;

          let stockAdjustment = actionType === 'add' ? 1 : -1;
          
          if (!p.sizes || p.sizes.length === 0) {
              const newTotal = Math.max(0, (p.stock || 0) + stockAdjustment);
              return { ...p, stock: newTotal };
          }

          const newSizes = p.sizes.map(s => {
              const sName = typeof s === 'string' ? s : s.size;
              const sStock = typeof s === 'string' ? (p.stock || 0) : (s.stock || 0);
              if (sName === scannedSize) return { size: sName, stock: Math.max(0, sStock + stockAdjustment) };
              return { size: sName, stock: sStock };
          });

          const newTotalStock = newSizes.reduce((acc, curr) => acc + curr.stock, 0);
          return { ...p, sizes: newSizes, stock: newTotalStock };
      });

      setProducts(updatedProducts);
      const refreshedProduct = updatedProducts.find(p => p.id === scannedProduct.id);
      setScannedProduct(refreshedProduct);
      showToast(actionType === 'add' ? '+1 Estoque' : '-1 Estoque', actionType === 'add' ? 'success' : 'error');
      
      if (!cameraActive && scannerInputRef.current) scannerInputRef.current.focus();
  };

  return (
    <div className="p-6 animate-in space-y-6 pb-24">
      {showScanner && (
        <div className="fixed inset-0 z-[200] bg-zinc-950/95 backdrop-blur-xl flex flex-col animate-in overflow-hidden">
           <div className="flex justify-between items-center p-6 border-b border-white/10 bg-zinc-950">
               <div>
                 <h2 className="text-sm font-black uppercase text-emerald-500 tracking-widest flex items-center gap-2"><Scan size={18}/> Módulo Leitor (POS)</h2>
                 <p className="text-[9px] text-zinc-500 uppercase font-bold mt-1">Conecte o leitor ou use a câmera do celular.</p>
               </div>
               <button onClick={() => { setShowScanner(false); setScannedProduct(null); setCameraActive(false); }} className="p-3 bg-zinc-900 text-zinc-400 hover:text-white rounded-full transition-colors"><X size={20}/></button>
           </div>
           
           <div className="flex-1 overflow-y-auto p-6 space-y-4 flex flex-col items-center">
               {!scannedProduct && (
                   <div className="flex w-full max-w-sm bg-zinc-900 border border-white/5 rounded-[16px] p-1 shadow-inner shrink-0">
                       <button onClick={() => setCameraActive(false)} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 ${!cameraActive ? 'bg-zinc-800 text-white shadow-lg border border-white/10' : 'text-zinc-500 hover:text-white'}`}><Barcode size={14}/> Leitor Físico</button>
                       <button onClick={() => setCameraActive(true)} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 ${cameraActive ? 'bg-emerald-500 text-zinc-950 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'text-zinc-500 hover:text-emerald-500'}`}><Camera size={14}/> Câmera Celular</button>
                   </div>
               )}

               {!scannedProduct && !cameraActive && (
                   <form 
                      onSubmit={handlePhysicalScan} 
                      onClick={() => scannerInputRef.current?.focus()} 
                      className="cursor-pointer w-full max-w-sm flex-1 bg-zinc-900 border-2 border-dashed border-white/10 rounded-3xl p-8 flex flex-col items-center justify-center group focus-within:border-emerald-500/50 transition-colors shadow-2xl"
                   >
                       <ScanLine size={48} className="text-zinc-700 mb-4 group-focus-within:text-emerald-500 group-focus-within:animate-pulse transition-colors" />
                       <h3 className="text-white font-black uppercase text-xs tracking-widest text-center">Aguardando Bip...</h3>
                       <p className="text-[9px] text-zinc-500 uppercase mt-2 text-center">O leitor físico enviará os dados instantaneamente</p>
                       <input 
                          ref={scannerInputRef}
                          name="barcode" 
                          autoFocus
                          placeholder="Escaneie aqui..."
                          className="mt-6 w-full max-w-[200px] text-center bg-zinc-950 border border-white/10 rounded-xl py-3 text-emerald-500 font-mono font-black tracking-widest outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all" 
                          autoComplete="off"
                       />
                   </form>
               )}

               {!scannedProduct && cameraActive && (
                   <div className="w-full max-w-sm flex flex-col items-center justify-start pt-8 shrink-0">
                       {!isScannerReady ? (
                           <div className="flex flex-col items-center text-emerald-500 animate-pulse py-20">
                               <Camera size={32} className="mb-2"/>
                               <p className="text-[10px] font-black uppercase">Iniciando Motor Óptico...</p>
                           </div>
                       ) : (
                           <div className="w-full flex flex-col items-center">
                               <div className="relative w-full aspect-square bg-black rounded-3xl overflow-hidden border-2 border-emerald-500/30 shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
                                   <div id="reader" className="w-full h-full"></div>
                               </div>
                               <p className="text-[10px] text-zinc-400 font-bold uppercase mt-6 text-center tracking-widest flex items-center gap-2 bg-zinc-900 px-4 py-2 rounded-full border border-white/5"><Camera size={14} className="text-emerald-500"/> Centralize o código na área clara</p>
                           </div>
                       )}
                   </div>
               )}

               {scannedProduct && (
                   <div className="w-full max-w-sm bg-zinc-900 rounded-[32px] p-6 border border-emerald-500/30 shadow-2xl animate-slide-up flex-1 flex flex-col">
                       <div className="flex gap-4 mb-6">
                           <img src={scannedProduct.image} className="w-24 h-32 object-cover rounded-2xl border border-white/5" alt={scannedProduct.name}/>
                           <div className="flex flex-col justify-center">
                               <span className="text-[10px] bg-zinc-950 text-zinc-400 px-3 py-1 rounded-lg font-black uppercase inline-block self-start mb-2 border border-white/5">SKU: {scannedProduct.sku}</span>
                               <h3 className="text-sm font-black text-white uppercase leading-tight">{scannedProduct.name}</h3>
                               <p className="text-emerald-500 font-black text-lg mt-1">Estoque Total: {scannedProduct.stock}</p>
                           </div>
                       </div>

                       {(scannedProduct.sizes || []).length > 0 && (
                           <div className="mb-6">
                               <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-3">Confirmar Variação/Tamanho</p>
                               <div className="grid grid-cols-4 gap-2">
                                   {(scannedProduct.sizes || []).map(s => {
                                       const sName = typeof s === 'string' ? s : s.size;
                                       const sStock = typeof s === 'string' ? scannedProduct.stock : s.stock;
                                       return (
                                           <button 
                                              key={sName} 
                                              onClick={() => { setScannedSize(sName); if(!cameraActive) scannerInputRef.current?.focus(); }}
                                              className={`py-3 rounded-xl border font-black text-sm transition-all flex flex-col items-center gap-1 ${scannedSize === sName ? 'bg-emerald-500 text-zinc-950 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-zinc-950 border-white/5 text-zinc-400'}`}
                                           >
                                               <span>{sName}</span>
                                               <span className={`text-[8px] ${scannedSize === sName ? 'text-zinc-800' : 'text-zinc-600'}`}>{sStock} un</span>
                                           </button>
                                       )
                                   })}
                               </div>
                           </div>
                       )}

                       <div className="grid grid-cols-2 gap-4 mt-auto mb-4">
                           <button onClick={() => handleStockAction('remove')} className="py-5 bg-red-500/10 text-red-500 border border-red-500/20 rounded-2xl font-black text-[11px] uppercase tracking-widest active:scale-95 flex items-center justify-center gap-2 transition-all hover:bg-red-500 hover:text-white">
                               <Minus size={16}/> Saída (-1)
                           </button>
                           <button onClick={() => handleStockAction('add')} className="py-5 bg-emerald-500 text-zinc-950 rounded-2xl font-black text-[11px] uppercase tracking-widest active:scale-95 flex items-center justify-center gap-2 shadow-[0_10px_20px_rgba(16,185,129,0.2)] transition-all">
                               <Plus size={16}/> Entrada (+1)
                           </button>
                       </div>

                       <button onClick={() => { setScannedProduct(null); if(cameraActive) setCameraActive(true); else setTimeout(()=>scannerInputRef.current?.focus(), 50); }} className="w-full py-4 text-[10px] font-black uppercase tracking-widest text-zinc-500 border border-white/5 rounded-2xl hover:bg-zinc-800 hover:text-white transition-colors">
                           Escanear Outro Produto
                       </button>
                   </div>
               )}
           </div>
        </div>
      )}

      {!editMode && !showScanner && (
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-black italic uppercase text-white tracking-widest text-lg">Catálogo</h3>
          <div className="flex gap-2">
            <button onClick={handleReorganizeSkus} className="bg-zinc-800 text-zinc-400 px-3 py-3 rounded-2xl font-black text-[9px] uppercase tracking-widest flex items-center gap-1.5 transition-transform active:scale-95 border border-white/5 hover:border-zinc-500 hover:text-white" title="Reorganizar SKUs sequencialmente">
                <RefreshCcw size={12}/> SKUs
            </button>
            <button onClick={() => setShowScanner(true)} className="bg-zinc-800 text-white px-4 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 transition-transform active:scale-95 shadow-lg border border-white/5 hover:border-emerald-500">
                <Scan size={14} className="text-emerald-500"/> POS
            </button>
            <button onClick={() => setEditMode('new')} className="bg-emerald-500 text-zinc-950 px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 transition-transform active:scale-95 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                <Plus size={14}/> Novo
            </button>
          </div>
        </div>
      )}

      {editMode ? (
        <form onSubmit={handleSave} className="space-y-4 pb-32">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-black italic uppercase tracking-tighter text-xl text-white">{editMode === 'new' ? 'Novo Produto' : 'Editar Produto'}</h3>
            <button type="button" onClick={() => { setEditMode(null); setPreviewImage(''); }} className="text-zinc-500 hover:text-white p-2"><X size={20}/></button>
          </div>

          {/* BLOCO 1 — MÍDIA */}
          <div className="bg-zinc-900 p-5 rounded-[28px] border border-white/5 space-y-3">
            <p className="text-[9px] font-black uppercase tracking-widest text-emerald-500 flex items-center gap-1.5"><ImageIcon size={12}/> Mídia</p>
            <div className="relative group overflow-hidden bg-zinc-950 border-2 border-dashed border-white/10 rounded-[24px] aspect-video flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-emerald-500/50 transition-all">
              {previewImage ? <img src={previewImage} className="absolute inset-0 w-full h-full object-cover opacity-60" alt="Preview" /> : <ImageIcon size={40} className="text-zinc-800" />}
              <div className="relative z-10 flex flex-col items-center"><Upload size={24} className="text-emerald-500 mb-2" /><span className="text-[10px] font-black uppercase tracking-widest text-white">Imagem Principal</span></div>
              <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" />
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black text-zinc-500 uppercase flex items-center gap-1"><ImagePlus size={12}/> {isKit ? `Galeria do Kit (${galleryUrls.length})` : `Fotos extras (${galleryUrls.length})`}</label>
              <div className="grid grid-cols-4 gap-2">
                {galleryUrls.map((url, i) => (
                  <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-white/10 group">
                    <img src={url} className="w-full h-full object-cover" alt="" />
                    <button type="button" onClick={() => removeGalleryUrl(url)} className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"><X size={10}/></button>
                  </div>
                ))}
                <label className="aspect-square rounded-xl border-2 border-dashed border-white/15 grid place-items-center cursor-pointer hover:border-emerald-500/50 transition-colors">
                  <Upload size={16} className="text-emerald-500" />
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handleGalleryFiles} />
                </label>
              </div>
              {isUploadingGallery && <p className="text-[9px] text-emerald-400 font-bold uppercase">Enviando imagens...</p>}
            </div>
          </div>

          {/* BLOCO 2 — IDENTIFICAÇÃO */}
          <div className="bg-zinc-900 p-5 rounded-[28px] border border-white/5 space-y-3">
            <p className="text-[9px] font-black uppercase tracking-widest text-emerald-500 flex items-center gap-1.5"><Tag size={12}/> Identificação</p>
            {!isKit && (
              <div className="space-y-1">
                <label className="text-[9px] font-black text-zinc-500 uppercase px-1">Nome</label>
                <input name="name" defaultValue={editMode?.name} className="w-full p-4 bg-zinc-950 border border-white/5 rounded-2xl font-bold text-sm text-white focus:border-emerald-500/50 outline-none" required />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-zinc-500 uppercase px-1 flex items-center gap-1">SKU {editMode === 'new' && <span className="text-emerald-500 text-[8px]">AUTO</span>}</label>
                <input name="sku" defaultValue={editMode === 'new' ? nextSku : editMode?.sku} readOnly={editMode === 'new'} className={`w-full p-4 bg-zinc-950 border rounded-2xl font-bold text-sm text-white outline-none ${editMode === 'new' ? 'border-emerald-500/30 text-emerald-400 cursor-not-allowed' : 'border-white/5 focus:border-emerald-500/50'}`} required />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-zinc-500 uppercase px-1">Status</label>
                <div className="flex items-center gap-3 h-[52px] px-4 bg-zinc-950 border border-white/5 rounded-2xl cursor-pointer" onClick={() => setIsActive(v => !v)}>
                  <div className={`w-10 h-5 rounded-full p-0.5 transition-all ${isActive ? 'bg-emerald-500' : 'bg-zinc-700'}`}>
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${isActive ? 'translate-x-5' : ''}`} />
                  </div>
                  <span className={`text-[11px] font-black uppercase ${isActive ? 'text-emerald-400' : 'text-zinc-500'}`}>{isActive ? 'Ativo' : 'Inativo'}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex items-center gap-2 bg-zinc-950 px-4 py-3 rounded-2xl border border-white/5 cursor-pointer flex-1" onClick={() => document.getElementById('f-check').click()}>
                <input type="checkbox" name="featured" id="f-check" defaultChecked={editMode?.featured} className="w-4 h-4 accent-emerald-500" />
                <label className="text-[10px] font-black uppercase text-white cursor-pointer">Destaque na Home</label>
              </div>
              <div className="flex items-center gap-2 bg-gradient-to-r from-amber-500/10 to-pink-500/10 px-4 py-3 rounded-2xl border border-amber-400/30 cursor-pointer flex-1" onClick={() => setIsKit(v => !v)}>
                <div className={`w-8 h-4 rounded-full p-0.5 transition-all shrink-0 ${isKit ? 'bg-gradient-to-r from-amber-400 to-pink-500' : 'bg-zinc-800'}`}>
                  <div className={`w-3 h-3 rounded-full bg-white transition-transform ${isKit ? 'translate-x-4' : ''}`} />
                </div>
                <span className="text-[10px] font-black uppercase text-white flex items-center gap-1"><Zap size={10} className="text-amber-400 fill-amber-400"/> Kit</span>
              </div>
            </div>
          </div>

          {/* BLOCO 3 — CLASSIFICAÇÃO */}
          <div className="bg-zinc-900 p-5 rounded-[28px] border border-white/5 space-y-3">
            <p className="text-[9px] font-black uppercase tracking-widest text-emerald-500 flex items-center gap-1.5"><Layers size={12}/> Classificação</p>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-zinc-500 uppercase px-1">Categoria</label>
              <input name="category" defaultValue={editMode?.category} placeholder={isKit ? 'KITS (automático)' : 'Ex: VESTUÁRIO'} disabled={isKit} className="w-full p-4 bg-zinc-950 border border-white/5 rounded-2xl text-sm text-white outline-none uppercase disabled:opacity-50 focus:border-emerald-500/50" required={!isKit} />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-zinc-500 uppercase px-1">Subcategoria (opcional)</label>
              <input name="subcategory" defaultValue={editMode?.subcategory || ''} placeholder="Ex: CALÇA JOGADOR" className="w-full p-4 bg-zinc-950 border border-white/5 rounded-2xl text-sm text-white outline-none uppercase focus:border-emerald-500/50" />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-zinc-500 uppercase px-1">Coleção (opcional)</label>
              <select name="collection_name" defaultValue={editMode?.collection_name || ""} className="w-full p-4 bg-zinc-950 border border-white/5 rounded-2xl text-sm text-white outline-none uppercase appearance-none cursor-pointer focus:border-emerald-500/50">
                <option value="">Nenhuma Coleção</option>
                {availableCollections.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-zinc-500 uppercase px-1">Tipo / Modelo</label>
              <input list="product-type-list" value={productType} onChange={e => setProductType(e.target.value)} placeholder="Ex: camisa premium, calça jeans…" className="w-full p-4 bg-zinc-950 border border-white/5 rounded-2xl text-sm text-white outline-none focus:border-emerald-500/50" />
              <datalist id="product-type-list">
                {['camisa básica','camisa premium','polo','malha egípcia','calça jeans','bermuda jeans','tênis','boné','kit'].map(t => <option key={t} value={t}/>)}
              </datalist>
            </div>
          </div>

          {/* BLOCO 4 — ATRIBUTOS */}
          <div className="bg-zinc-900 p-5 rounded-[28px] border border-white/5 space-y-3">
            <p className="text-[9px] font-black uppercase tracking-widest text-emerald-500">Atributos do Produto</p>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-zinc-500 uppercase px-1">Cor Principal</label>
              <select value={color} onChange={e => setColor(e.target.value)} className="w-full p-4 bg-zinc-950 border border-white/5 rounded-2xl text-sm text-white outline-none appearance-none cursor-pointer focus:border-emerald-500/50">
                {['','preto','branco','azul','vermelho','verde','bege','cinza','marrom','rosa','amarelo'].map(c => <option key={c} value={c}>{c || 'não informado'}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-zinc-500 uppercase px-1">Cores Secundárias (opcional)</label>
              <div className="flex gap-2">
                <input value={secondaryColorInput} onChange={e => setSecondaryColorInput(e.target.value)} onKeyDown={e => { if ((e.key === 'Enter' || e.key === ',') && secondaryColorInput.trim()) { e.preventDefault(); setSecondaryColors(v => [...v, secondaryColorInput.trim().toLowerCase()]); setSecondaryColorInput(''); }}} placeholder="Digite e pressione Enter" className="flex-1 p-3 bg-zinc-950 border border-white/5 rounded-xl text-sm text-white outline-none focus:border-emerald-500/50" />
                <button type="button" onClick={() => { if (secondaryColorInput.trim()) { setSecondaryColors(v => [...v, secondaryColorInput.trim().toLowerCase()]); setSecondaryColorInput(''); }}} className="px-4 bg-zinc-800 text-white rounded-xl text-[11px] font-black">+</button>
              </div>
              {secondaryColors.length > 0 && <div className="flex flex-wrap gap-1.5 mt-1">{secondaryColors.map((c, i) => <span key={i} className="flex items-center gap-1 bg-zinc-800 text-zinc-300 text-[10px] font-black px-2 py-1 rounded-full">{c}<button type="button" onClick={() => setSecondaryColors(v => v.filter((_,j) => j !== i))} className="text-zinc-500 hover:text-red-400"><X size={10}/></button></span>)}</div>}
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-zinc-500 uppercase px-1">Material / Tecido</label>
              <input list="material-list" value={material} onChange={e => setMaterial(e.target.value)} placeholder="Ex: algodão, jeans, poliéster…" className="w-full p-4 bg-zinc-950 border border-white/5 rounded-2xl text-sm text-white outline-none focus:border-emerald-500/50" />
              <datalist id="material-list">
                {['algodão','malha egípcia','jeans','sarja','poliéster','viscose','linho'].map(m => <option key={m} value={m}/>)}
              </datalist>
            </div>
          </div>

          {/* BLOCO 5 — PREÇO */}
          <div className="bg-zinc-900 p-5 rounded-[28px] border border-white/5 space-y-3">
            <p className="text-[9px] font-black uppercase tracking-widest text-emerald-500">Preço</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-zinc-500 uppercase px-1">Preço Normal (R$)</label>
                <input name="price" type="number" step="0.01" defaultValue={editMode?.price} className="w-full p-4 bg-zinc-950 border border-white/5 rounded-2xl font-bold text-sm text-white focus:border-emerald-500/50 outline-none" required />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-zinc-500 uppercase px-1">Preço Promo (opcional)</label>
                <input type="number" step="0.01" value={promotionalPrice} onChange={e => setPromotionalPrice(e.target.value)} placeholder="—" className="w-full p-4 bg-zinc-950 border border-white/5 rounded-2xl font-bold text-sm text-white focus:border-emerald-500/50 outline-none" />
              </div>
            </div>
          </div>

          {/* BLOCO 6 — ESTOQUE */}
          {!isKit && (
            <div className="bg-zinc-900 p-5 rounded-[28px] border border-white/5 space-y-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-emerald-500 flex items-center gap-1.5"><Layers size={12}/> Estoque / Grade de Tamanhos</p>
              {formSizes.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input placeholder="Tam." className="w-1/2 p-3 bg-zinc-950 border border-white/5 rounded-xl font-bold text-sm text-white uppercase outline-none" value={item.size} onChange={(e) => handleSizeChange(idx, 'size', e.target.value)} required />
                  <input type="number" placeholder="Qtd" className="w-1/2 p-3 bg-zinc-950 border border-white/5 rounded-xl font-bold text-sm text-white outline-none" value={item.stock} onChange={(e) => handleSizeChange(idx, 'stock', e.target.value)} required />
                  <button type="button" onClick={() => removeSize(idx)} className="p-3 text-red-500 bg-red-500/5 rounded-xl border border-red-500/10"><X size={16}/></button>
                </div>
              ))}
              <button type="button" onClick={addSize} className="w-full py-3 border border-dashed border-white/10 rounded-xl text-[10px] font-black uppercase text-zinc-500 hover:text-white transition-all">+ Adicionar Tamanho</button>
            </div>
          )}

          {/* KIT — seleção de peças */}
          {isKit && (
            <div className="bg-zinc-900 p-5 rounded-[28px] border border-amber-400/20 space-y-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-amber-400 flex items-center gap-1.5"><Layers size={12}/> Peças do Kit ({kitComponentIds.length})</p>
              <input value={kitSearch} onChange={(e) => setKitSearch(e.target.value)} placeholder="Buscar por nome ou SKU..." className="w-full p-3 bg-zinc-950 border border-white/5 rounded-xl text-sm text-white outline-none focus:border-amber-400/50" />
              <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
                {(products || []).filter(p => !p.is_kit && (!kitSearch.trim() || (p.name||'').toLowerCase().includes(kitSearch.toLowerCase()) || (p.sku||'').toLowerCase().includes(kitSearch.toLowerCase()))).map(p => {
                  const selected = kitComponentIds.includes(p.id);
                  return (
                    <button type="button" key={p.id} onClick={() => toggleKitComponent(p.id)} className={`w-full flex items-center gap-3 p-2 rounded-xl border transition-all text-left ${selected ? 'bg-amber-400/10 border-amber-400/60' : 'bg-zinc-950 border-white/5 hover:border-white/15'}`}>
                      <div className={`w-5 h-5 rounded grid place-items-center border-2 shrink-0 ${selected ? 'bg-amber-400 border-amber-400' : 'border-zinc-600'}`}>{selected && <Check size={12} className="text-zinc-950" strokeWidth={3}/>}</div>
                      <img src={p.image} className="w-10 h-10 rounded-lg object-cover border border-white/5" alt="" />
                      <div className="flex-1 min-w-0"><p className="text-[11px] font-black uppercase text-white truncate">{p.name}</p><p className="text-[9px] text-zinc-500 font-bold">{p.sku} · {formatBRL(p.price||0)}</p></div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* BLOCO 7 — BOT / ATENDIMENTO */}
          <div className="bg-zinc-900 p-5 rounded-[28px] border border-white/5 space-y-3">
            <p className="text-[9px] font-black uppercase tracking-widest text-emerald-500">Bot / Atendimento</p>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-zinc-500 uppercase px-1">Descrição curta para o bot</label>
              <textarea value={botDescription} onChange={e => setBotDescription(e.target.value)} rows={3} placeholder='Ex: "Camisa premium branca, estilo casual, disponível em P e M."' className="w-full p-4 bg-zinc-950 border border-white/5 rounded-2xl text-sm text-white outline-none focus:border-emerald-500/50 resize-none" />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-zinc-500 uppercase px-1">Tags de busca</label>
              <div className="flex gap-2">
                <input value={searchTagInput} onChange={e => setSearchTagInput(e.target.value)} onKeyDown={e => { if ((e.key === 'Enter' || e.key === ',') && searchTagInput.trim()) { e.preventDefault(); setSearchTags(v => [...v, searchTagInput.trim().toLowerCase()]); setSearchTagInput(''); }}} placeholder="Digite e pressione Enter" className="flex-1 p-3 bg-zinc-950 border border-white/5 rounded-xl text-sm text-white outline-none focus:border-emerald-500/50" />
                <button type="button" onClick={() => { if (searchTagInput.trim()) { setSearchTags(v => [...v, searchTagInput.trim().toLowerCase()]); setSearchTagInput(''); }}} className="px-4 bg-zinc-800 text-white rounded-xl text-[11px] font-black">+</button>
              </div>
              {searchTags.length > 0 && <div className="flex flex-wrap gap-1.5 mt-1">{searchTags.map((t, i) => <span key={i} className="flex items-center gap-1 bg-zinc-800 text-zinc-300 text-[10px] font-black px-2 py-1 rounded-full">{t}<button type="button" onClick={() => setSearchTags(v => v.filter((_,j) => j !== i))} className="text-zinc-500 hover:text-red-400"><X size={10}/></button></span>)}</div>}
            </div>
          </div>

          <button type="submit" disabled={isUploadingImage} className={`w-full py-5 rounded-[28px] font-black uppercase text-[11px] tracking-widest shadow-[0_0_20px_rgba(16,185,129,0.2)] ${isUploadingImage ? 'bg-zinc-800 text-zinc-500' : 'bg-emerald-500 text-zinc-950 active:scale-95'}`}>
            {isUploadingImage ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </form>
      ) : !showScanner && (
        <div className="space-y-4">
          <div className="relative group mb-6">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
            <input placeholder="Buscar produto..." className="w-full bg-zinc-900 border border-white/5 py-4 pl-14 pr-6 rounded-3xl text-sm font-bold text-white outline-none focus:border-emerald-500/50" value={invSearch} onChange={(e) => setInvSearch(e.target.value)} />
          </div>
          {filteredInv.map(p => (
            <div key={p.id} className="bg-zinc-900 p-4 rounded-[32px] border border-white/5 flex items-center gap-4 hover:border-white/10 transition-colors">
              <div className="relative">
                <img src={p.image} className={`w-16 h-16 rounded-[20px] object-cover shrink-0 ${p.stock === 0 ? 'grayscale opacity-50' : ''}`} alt={p.name} />
                {p.stock === 0 && <span className="absolute -top-2 -right-2 bg-red-500 w-4 h-4 rounded-full border-2 border-zinc-900"></span>}
              </div>
              <div className="flex-1 overflow-hidden">
                <h4 className="font-black text-white text-[11px] truncate uppercase">{p.name}</h4>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[9px] font-bold text-zinc-500 uppercase bg-zinc-950 px-2 py-1 rounded-lg flex items-center gap-1"><Barcode size={10}/> {p.sku}</span>
                  <span className={`text-[9px] font-black px-2 py-1 rounded-lg ${p.stock > 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>{p.stock} UN</span>
                </div>
              </div>
              <div className="flex gap-1 flex-col">
                <button onClick={() => setEditMode(p)} className="p-2.5 bg-white/5 rounded-xl text-zinc-400 hover:text-white transition-colors"><Edit3 size={14}/></button>
                <button onClick={() => { if(window.confirm('Excluir produto?')) setProducts(products.filter(i => i.id !== p.id)); }} className="p-2.5 bg-red-500/10 rounded-xl text-red-500 hover:bg-red-500 hover:text-white transition-colors"><Trash2 size={14}/></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const AdminLeads = ({ leads, setLeads, products, setProducts, showToast, config }) => {
  const [expandedLead, setExpandedLead] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [editingPhoneId, setEditingPhoneId] = useState(null);
  const [editingPhoneValue, setEditingPhoneValue] = useState('');
  const [editingValueId, setEditingValueId] = useState(null);
  const [editingValueText, setEditingValueText] = useState('');
  // Filtro: 'NOVOS' = NOVO + EM ATENDIMENTO; 'CONCLUÍDOS' e 'CANCELADOS' ficam separados
  const [leadsFilter, setLeadsFilter] = useState('NOVOS');

  const openPhoneEditor = (lead) => {
    setEditingPhoneId(lead.id);
    setEditingPhoneValue(String(lead.phone || ''));
  };

  const savePhoneEdit = async () => {
    const lead = leads.find(l => l.id === editingPhoneId);
    if (!lead) { setEditingPhoneId(null); return; }
    const cleaned = editingPhoneValue.replace(/\D/g, '');
    if (cleaned.length < 10) { showToast('Telefone inválido (mín. 10 dígitos com DDD).', 'error'); return; }
    try {
      await updateOrderPhone(lead._raw?.id || lead.id, cleaned);
      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, phone: cleaned } : l));
      showToast('Telefone atualizado!');
      setEditingPhoneId(null);
    } catch (err) {
      console.log('[PHONE_EDIT_ERROR]', err);
      showToast('Erro ao atualizar telefone.', 'error');
    }
  };

  const openValueEditor = (lead) => {
    setEditingValueId(lead.id);
    setEditingValueText(String(Number(lead.value || 0).toFixed(2)).replace('.', ','));
  };

  const saveValueEdit = async () => {
    const lead = leads.find(l => l.id === editingValueId);
    if (!lead) { setEditingValueId(null); return; }
    const parsed = Number(String(editingValueText).replace(/\./g, '').replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed < 0) { showToast('Valor inválido.', 'error'); return; }
    const original = Number(lead.value || 0);
    try {
      await updateOrderValue(lead._raw?.id || lead.id, parsed);
      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, value: parsed } : l));
      const diff = parsed - original;
      const msg = diff === 0
        ? 'Valor atualizado.'
        : diff < 0
          ? `Desconto de ${formatBRL(Math.abs(diff))} aplicado.`
          : `Acréscimo de ${formatBRL(diff)} aplicado.`;
      showToast(msg);
      setEditingValueId(null);
    } catch (err) {
      console.log('[VALUE_EDIT_ERROR]', err);
      showToast('Erro ao atualizar valor.', 'error');
    }
  };

  const updateLeadStatus = async (id, newStatus) => {
    const leadToUpdate = leads.find(l => l.id === id);
    if (!leadToUpdate) return;
    const oldStatus = leadToUpdate.status || 'NOVO';
    try {
      // Sistema 3.0: estoque só baixa quando admin confirma a venda (CONCLUÍDO)
      if (oldStatus !== 'CONCLUÍDO' && newStatus === 'CONCLUÍDO') {
        // monta order no formato esperado por confirmOrderSale
        const orderForSale = {
          id: leadToUpdate._raw?.id || leadToUpdate.id,
          items: (leadToUpdate.items || []).map(i => ({
            id: i.id, size: i.size, qty: i.qty || i.quantity || 1,
          })),
        };
        await confirmOrderSale(orderForSale, products);
        // Atualiza local: marca como concluído. O `value` é preservado pelo spread,
        // então o totalRevenue do Dashboard é recalculado em tempo real (useMemo).
        // A persistência no Supabase já foi feita por confirmOrderSale acima.
        setLeads(prev => prev.map(l => l.id === id ? { ...l, status: 'CONCLUÍDO' } : l));
        // Atualiza products local pra refletir baixa imediata (polling vai re-sincronizar)
        const updatedProducts = products.map(p => {
          const itemsForP = (orderForSale.items || []).filter(it => it.id === p.id);
          if (itemsForP.length === 0) return p;
          const totalQty = itemsForP.reduce((a, c) => a + Number(c.qty || 0), 0);
          const newSizes = (p.sizes || []).map(s => {
            const sName = typeof s === 'string' ? s : (s.size || 'U');
            const sStock = typeof s === 'string' ? (p.stock || 0) : (s.stock || 0);
            const dec = itemsForP.filter(i => i.size === sName).reduce((a, c) => a + Number(c.qty || 0), 0);
            return { size: sName, stock: Math.max(0, sStock - dec) };
          });
          return { ...p, sizes: newSizes, stock: Math.max(0, (p.stock || 0) - totalQty), sales: (p.sales || 0) + totalQty };
        });
        setProducts(updatedProducts);
        showToast('Venda confirmada e estoque atualizado!');
        // 🔴 CAPI — fire-and-forget: dispara Purchase para a Meta (com Advanced Matching)
        dispatchCAPIPurchase({
          phone: leadToUpdate.phone,
          value: leadToUpdate.value,
          name: leadToUpdate.name,
        }).catch(() => {});
      } else if (newStatus === 'CANCELADO') {
        await cancelOrder(leadToUpdate._raw?.id || leadToUpdate.id);

        // 🔄 Devolve estoque SOMENTE se a venda já tinha sido CONCLUÍDA (estoque já baixou).
        // Em qualquer outro status anterior (NOVO, EM ATENDIMENTO) o estoque nunca foi mexido.
        if (oldStatus === 'CONCLUÍDO') {
          const orderForRestore = {
            id: leadToUpdate._raw?.id || leadToUpdate.id,
            items: (leadToUpdate.items || []).map(i => ({
              id: i.id, size: i.size, qty: i.qty || i.quantity || 1,
            })),
          };
          try {
            await restoreOrderStock(orderForRestore, products);
            // Reflete na UI imediatamente (polling re-sincroniza depois)
            const restoredProducts = products.map(p => {
              const itemsForP = (orderForRestore.items || []).filter(it => it.id === p.id);
              if (itemsForP.length === 0) return p;
              const totalQty = itemsForP.reduce((a, c) => a + Number(c.qty || 0), 0);
              const newSizes = (p.sizes || []).map(s => {
                const sName = typeof s === 'string' ? s : (s.size || 'U');
                const sStock = typeof s === 'string' ? (p.stock || 0) : (s.stock || 0);
                const inc = itemsForP.filter(i => i.size === sName).reduce((a, c) => a + Number(c.qty || 0), 0);
                return { size: sName, stock: sStock + inc };
              });
              return { ...p, sizes: newSizes, stock: (p.stock || 0) + totalQty, sales: Math.max(0, (p.sales || 0) - totalQty) };
            });
            setProducts(restoredProducts);
            showToast('Pedido cancelado e estoque devolvido.');
          } catch (restoreErr) {
            console.log('[STOCK_RESTORE_ERROR]', restoreErr);
            showToast('Pedido cancelado, mas houve erro ao devolver estoque.', 'error');
          }
        } else {
          showToast('Pedido cancelado.');
        }

        setLeads(prev => prev.map(l => l.id === id ? { ...l, status: 'CANCELADO' } : l));
        // 🔴 CAPI — fire-and-forget: dispara Refund para a Meta (com Advanced Matching)
        dispatchCAPIRefund({
          phone: leadToUpdate.phone,
          value: leadToUpdate.value,
          name: leadToUpdate.name,
        }).catch(() => {});
      } else {
        // Outros status (NOVO, EM ATENDIMENTO) — persiste no Supabase
        await updateOrderStatus(leadToUpdate._raw?.id || leadToUpdate.id, newStatus);
        setLeads(prev => prev.map(l => l.id === id ? { ...l, status: newStatus } : l));
        showToast('Status atualizado.');
      }
    } catch (err) {
      console.log('[CRM_ERROR]', err); // 5. CATCH
      showToast('Erro ao atualizar status.', 'error');
    } finally {
      setIsProcessing(false); // 6. FINALLY
    }
  };

  const statusColors = { 'NOVO': 'text-blue-500', 'EM ATENDIMENTO': 'text-amber-500', 'CONCLUÍDO': 'text-emerald-500', 'CANCELADO': 'text-red-500' };

  const exportCSV = () => {
    if (!leads || leads.length === 0) { showToast('Nenhum pedido para exportar.', 'error'); return; }
    const esc = (v) => {
      const s = String(v == null ? '' : v);
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g,'""')}"` : s;
    };
    const header = ['Pedido','Data','Cliente','WhatsApp','Status','Total (R$)','Itens'];
    const rows = leads.map(l => [
      l.orderNumber,
      l.date,
      l.name,
      l.phone,
      l.status || 'NOVO',
      Number(l.value || 0).toFixed(2).replace('.', ','),
      (l.items || []).map(i => `${i.quantity || i.qty || 1}x ${i.name} (${i.size || 'U'})`).join(' | '),
    ]);
    const csv = '\uFEFF' + [header, ...rows].map(r => r.map(esc).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pedidos-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('CSV exportado!');
  };

  const novosCount = (leads || []).filter(l => (l.status || 'NOVO') === 'NOVO' || l.status === 'EM ATENDIMENTO').length;
  const concluidosCount = (leads || []).filter(l => l.status === 'CONCLUÍDO').length;
  const canceladosCount = (leads || []).filter(l => l.status === 'CANCELADO').length;

  const visibleLeads = (leads || []).filter(l => {
    const st = l.status || 'NOVO';
    if (leadsFilter === 'NOVOS') return st === 'NOVO' || st === 'EM ATENDIMENTO';
    if (leadsFilter === 'CONCLUÍDOS') return st === 'CONCLUÍDO';
    if (leadsFilter === 'CANCELADOS') return st === 'CANCELADO';
    return true;
  });

  return (
    <div className="p-6 animate-in space-y-4 pb-32">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-black italic uppercase text-white tracking-widest text-lg">CRM / Clientes</h3>
        <button onClick={exportCSV} data-testid="btn-export-csv" className="px-4 py-2.5 bg-zinc-800 border border-white/5 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 active:scale-95 hover:border-emerald-500/30">
          <Database size={12} className="text-emerald-500"/> CSV
        </button>
      </div>
      <div className="grid grid-cols-3 gap-1 p-1 bg-zinc-900 rounded-2xl border border-white/5">
        <button
          type="button"
          onClick={() => setLeadsFilter('NOVOS')}
          className={`py-3 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all ${leadsFilter === 'NOVOS' ? 'bg-white text-zinc-950 shadow-lg' : 'bg-transparent text-zinc-500'}`}
        >
          Novos <span className="ml-1 opacity-70">({novosCount})</span>
        </button>
        <button
          type="button"
          onClick={() => setLeadsFilter('CONCLUÍDOS')}
          className={`py-3 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all ${leadsFilter === 'CONCLUÍDOS' ? 'bg-emerald-500 text-zinc-950 shadow-lg' : 'bg-transparent text-zinc-500'}`}
        >
          Concluídos <span className="ml-1 opacity-70">({concluidosCount})</span>
        </button>
        <button
          type="button"
          onClick={() => setLeadsFilter('CANCELADOS')}
          className={`py-3 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all ${leadsFilter === 'CANCELADOS' ? 'bg-red-500 text-zinc-950 shadow-lg' : 'bg-transparent text-zinc-500'}`}
        >
          Cancelados <span className="ml-1 opacity-70">({canceladosCount})</span>
        </button>
      </div>
      {(!visibleLeads || visibleLeads.length === 0) ? (
        <div className="text-center py-20 bg-zinc-900 rounded-[40px] border border-white/5 text-zinc-700">
          Nenhum pedido nesta aba.
        </div>
      ) : visibleLeads.map(lead => (
        <div key={lead.id} className={`bg-zinc-900 rounded-[32px] border overflow-hidden ${expandedLead === lead.id ? 'border-white/20' : 'border-white/5'}`}>
          <div className="p-6 cursor-pointer" onClick={() => setExpandedLead(expandedLead === lead.id ? null : lead.id)}>
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-black text-white text-sm uppercase">{lead.name} <span className="text-[10px] text-zinc-600">#{lead.orderNumber}</span></h4>
              <span className={`text-[8px] font-black uppercase ${statusColors[lead.status || 'NOVO']}`}>{lead.status || 'NOVO'}</span>
            </div>
            <div className="flex justify-between items-center text-[11px] font-bold text-zinc-400">
              {editingPhoneId === lead.id ? (
                <div className="flex items-center gap-1.5 flex-1 mr-2" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="tel"
                    autoFocus
                    value={editingPhoneValue}
                    onChange={(e) => setEditingPhoneValue(e.target.value.replace(/\D/g, ''))}
                    placeholder="DDD + número"
                    className="flex-1 min-w-0 px-2 py-1 bg-zinc-950 border border-emerald-500/30 rounded-md text-[11px] font-bold text-white outline-none focus:border-emerald-500"
                  />
                  <button
                    onClick={savePhoneEdit}
                    className="px-2 py-1 bg-emerald-500 text-zinc-950 rounded-md text-[9px] font-black uppercase active:scale-95"
                  >OK</button>
                  <button
                    onClick={() => setEditingPhoneId(null)}
                    className="px-2 py-1 bg-zinc-800 text-zinc-400 rounded-md text-[9px] font-black uppercase active:scale-95"
                  >X</button>
                </div>
              ) : (
                <span className="flex items-center gap-1.5">
                  <span>{lead.phone}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); openPhoneEditor(lead); }}
                    className="p-1 text-zinc-500 hover:text-emerald-500 active:scale-90 transition-colors"
                    title="Editar telefone"
                  >
                    <Edit3 size={11}/>
                  </button>
                </span>
              )}
              {editingValueId === lead.id ? (
                <span className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <span className="text-emerald-500 text-[10px]">R$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    autoFocus
                    value={editingValueText}
                    onChange={(e) => setEditingValueText(e.target.value.replace(/[^0-9.,]/g, ''))}
                    className="w-20 px-2 py-1 bg-zinc-950 border border-emerald-500/30 rounded-md text-[11px] font-bold text-emerald-500 outline-none focus:border-emerald-500 text-right"
                  />
                  <button onClick={saveValueEdit} className="px-2 py-1 bg-emerald-500 text-zinc-950 rounded-md text-[9px] font-black uppercase active:scale-95">OK</button>
                  <button onClick={() => setEditingValueId(null)} className="px-2 py-1 bg-zinc-800 text-zinc-400 rounded-md text-[9px] font-black uppercase active:scale-95">X</button>
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <span className="text-emerald-500">{formatBRL(lead.value || 0)}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); openValueEditor(lead); }}
                    className="p-1 text-zinc-500 hover:text-emerald-500 active:scale-90 transition-colors"
                    title="Editar valor (desconto/acréscimo)"
                  >
                    <Edit3 size={11}/>
                  </button>
                </span>
              )}
            </div>

          </div>
          {expandedLead === lead.id && (
            <div className="bg-zinc-950/50 p-6 border-t border-white/5 animate-slide-down space-y-4">
              {(lead.items || []).map((item, idx) => (
                <div key={idx} className="flex gap-4 bg-zinc-900 p-4 rounded-2xl items-center border border-white/5 shadow-inner">
                  <div className="w-16 h-20 bg-zinc-950 rounded-xl overflow-hidden shrink-0 border border-white/10 shadow-2xl">
                    <img src={item.image || 'https://images.unsplash.com/photo-1558769132-cb1fac08c04b?w=200'} className="w-full h-full object-cover" alt="Thumb" />
                  </div>
                  <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-[12px] font-black text-white uppercase truncate tracking-tight">{item.name}</span>
                      <span className="text-emerald-500 font-black text-[11px] shrink-0 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">{item.quantity || item.qty}x</span>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                      <div className="flex items-center gap-1 bg-zinc-950 px-2.5 py-1 rounded-lg border border-white/5">
                        <Barcode size={10} className="text-zinc-500"/>
                        <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">{item.sku || 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-1 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/10">
                        <Box size={10} className="text-emerald-500"/>
                        <span className="text-[9px] font-black text-emerald-500 uppercase">TAM: {item.size || 'U'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => updateLeadStatus(lead.id, 'EM ATENDIMENTO')} className="py-3 bg-zinc-800 rounded-xl text-[9px] font-black uppercase text-white">Atender</button>
                <button onClick={() => updateLeadStatus(lead.id, 'CONCLUÍDO')} className="py-3 bg-emerald-500/10 rounded-xl text-[9px] font-black uppercase text-emerald-500">Concluir</button>
                <button onClick={() => updateLeadStatus(lead.id, 'CANCELADO')} className="py-3 bg-red-500/10 rounded-xl text-[9px] font-black uppercase text-red-500">Cancelar</button>
                <button onClick={() => window.open(`https://api.whatsapp.com/send?phone=${lead.phone}&text=Olá ${lead.name.split(' ')[0]}!`)} className="py-3 bg-emerald-500 rounded-xl text-[9px] font-black uppercase text-zinc-950 flex items-center justify-center gap-1"><MessageCircle size={10}/> Chamar</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

const StarRatingInline = ({ product, ratingsMap, userProfile, setRatingsMap, setShowUserDrawer, setDrawerTab, showToast }) => {
  const rating = ratingsMap[product.id];
  const mode = rating?.mode || 0;
  const count = rating?.count || 0;
  const [pending, setPending] = React.useState(null);
  const [hovered, setHovered] = React.useState(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [myRating, setMyRating] = React.useState(null);

  const userId = userProfile?.phone?.trim() || userProfile?.id || null;

  React.useEffect(() => {
    if (!userId) return;
    fetchExistingReview(product.id, userId)
      .then(existing => { if (existing) setMyRating(existing.rating); })
      .catch(() => {});
  }, [product.id, userId]);

  const display = pending ?? hovered ?? (myRating || mode);

  const handleStarClick = (i) => {
    if (!userProfile) {
      setShowUserDrawer(true);
      setDrawerTab('profile');
      showToast('Crie seu perfil Fluxo para avaliar.', 'success');
      return;
    }
    if (myRating) {
      showToast(`Você já avaliou com ${myRating} estrela${myRating > 1 ? 's' : ''}.`, 'success');
      return;
    }
    setPending(i);
  };

  const handleConfirm = async () => {
    if (!pending || submitting) return;
    setSubmitting(true);
    try {
      await submitReview({ productId: product.id, customerName: userProfile.name?.trim() || userId, customerPhone: userId, rating: pending });
      setMyRating(pending);
      setPending(null);
      const updated = await fetchRatingsBatch([product.id]);
      setRatingsMap(prev => ({ ...prev, ...updated }));
      showToast('Avaliação enviada! Obrigado 🙏', 'success');
    } catch (err) {
      if (err.message?.includes('unique') || err.message?.includes('duplicate')) {
        showToast('Você já avaliou este produto.', 'success');
      } else {
        showToast('Erro ao enviar avaliação.', 'success');
      }
      setPending(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => { setPending(null); setHovered(null); };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-0.5">
        {[1,2,3,4,5].map(i => {
          const filled = i <= (pending ?? hovered ?? (myRating || mode));
          return (
            <motion.button
              key={i}
              type="button"
              whileTap={{ scale: 0.82 }}
              onMouseEnter={() => !pending && !myRating && setHovered(i)}
              onMouseLeave={() => !pending && setHovered(null)}
              onClick={(e) => { e.stopPropagation(); handleStarClick(i); }}
              className="touch-manipulation"
              style={{ background: 'none', border: 'none', padding: '1px', cursor: myRating ? 'default' : 'pointer' }}
            >
              <motion.svg
                width={13} height={13} viewBox="0 0 20 20" fill="none"
                animate={{ scale: filled && pending === i ? [1, 1.35, 1] : 1 }}
                transition={{ duration: 0.25 }}
              >
                <path
                  d="M10 1.5l2.47 5.01 5.53.8-4 3.9.94 5.49L10 14.1l-4.94 2.6.94-5.49-4-3.9 5.53-.8L10 1.5z"
                  fill={filled ? '#f59e0b' : 'rgba(255,255,255,0.22)'}
                  stroke={filled ? '#f59e0b' : 'rgba(255,255,255,0.45)'}
                  strokeWidth="1.5" strokeLinejoin="round"
                />
              </motion.svg>
            </motion.button>
          );
        })}
      </div>
      <AnimatePresence mode="wait">
        {!pending ? (
          <motion.span
            key="count"
            initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -4 }}
            transition={{ duration: 0.18 }}
            style={{ fontSize: '9px', fontWeight: 700, color: 'rgba(113,113,122,0.9)', lineHeight: 1, userSelect: 'none' }}
          >
            {count === 0 ? '0 avaliações' : `${mode}★ · ${count}`}
          </motion.span>
        ) : (
          <motion.div
            key="actions"
            initial={{ opacity: 0, x: -6, scale: 0.85 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -6, scale: 0.85 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center gap-1.5"
          >
            <motion.button type="button" whileTap={{ scale: 0.82 }} onClick={(e) => { e.stopPropagation(); handleCancel(); }}
              className="touch-manipulation flex items-center justify-center"
              style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', cursor: 'pointer', flexShrink: 0 }}
            >
              <svg width={10} height={10} viewBox="0 0 20 20" fill="none">
                <path d="M5 5l10 10M15 5L5 15" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round"/>
              </svg>
            </motion.button>
            <motion.button type="button" whileTap={{ scale: 0.82 }} onClick={(e) => { e.stopPropagation(); handleConfirm(); }}
              disabled={submitting}
              className="touch-manipulation flex items-center justify-center"
              style={{ width: '22px', height: '22px', borderRadius: '50%', background: submitting ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.35)', cursor: submitting ? 'default' : 'pointer', flexShrink: 0, boxShadow: submitting ? 'none' : '0 0 8px rgba(16,185,129,0.2)' }}
            >
              {submitting ? (
                <svg width={9} height={9} viewBox="0 0 20 20" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
                  <circle cx="10" cy="10" r="8" stroke="rgba(16,185,129,0.4)" strokeWidth="2.5"/>
                  <path d="M10 2a8 8 0 018 8" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
              ) : (
                <svg width={10} height={10} viewBox="0 0 20 20" fill="none">
                  <path d="M4 10l5 5 7-8" stroke="#10b981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ProductReviewsList = ({ productId }) => {
  const [reviews, setReviews] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    fetchProductReviews(productId)
      .then(data => setReviews(data))
      .finally(() => setLoading(false));
  }, [productId]);
  if (loading || reviews.length === 0) return null;
  return (
    <div className="space-y-2.5 pt-4 mt-2 border-t border-white/5">
      <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Avaliações ({reviews.length})</p>
      {reviews.map(rv => (
        <div key={rv.id} className="bg-zinc-900 rounded-2xl p-4 border border-white/5 space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-0.5">
              {[1,2,3,4,5].map(i => (
                <svg key={i} width={11} height={11} viewBox="0 0 20 20" fill="none">
                  <path d="M10 1.5l2.47 5.01 5.53.8-4 3.9.94 5.49L10 14.1l-4.94 2.6.94-5.49-4-3.9 5.53-.8L10 1.5z"
                    fill={i <= rv.rating ? '#f59e0b' : 'none'} stroke={i <= rv.rating ? '#f59e0b' : 'rgba(255,255,255,0.12)'}
                    strokeWidth="1.5" strokeLinejoin="round" />
                </svg>
              ))}
            </div>
            <span className="text-[9px] text-zinc-600 font-bold">{new Date(rv.created_at).toLocaleDateString('pt-BR')}</span>
          </div>
          <p className="text-[10px] font-black text-white uppercase tracking-wide">{rv.customer_name.split(' ')[0]}</p>
          {rv.comment && <p className="text-[11px] text-zinc-400 font-medium leading-relaxed">{rv.comment}</p>}
        </div>
      ))}
    </div>
  );
};

const AdminBanners = ({ banners, setBanners, showToast, bannerImageFile, setBannerImageFile, uploadImage }) => {
  const [editBannerMode, setEditBannerMode] = useState(null);
  const [previewBannerImage, setPreviewBannerImage] = useState('');
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  useEffect(() => { 
    setPreviewBannerImage(editBannerMode?.image || ''); 
    setBannerImageFile(null);
  }, [editBannerMode]);

  const handleBannerFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setBannerImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewBannerImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveBanner = async (e) => {
    e.preventDefault();
    setIsUploadingBanner(true);
    try {
      let imageUrl = editBannerMode?.image || '';
      if (bannerImageFile) {
        showToast('Enviando banner em alta resolução...', 'info');
        imageUrl = await uploadImage(bannerImageFile);
      }
      const fd = new FormData(e.target);
      const data = {
        id: editBannerMode === 'new' ? Date.now() : editBannerMode.id,
        title: fd.get('title'),
        subtitle: fd.get('subtitle'),
        buttonText: fd.get('buttonText'),
        collection_name: fd.get('collection_name'),
        image: imageUrl,
        active: fd.get('active') === 'on',
        banner_order: parseInt(fd.get('banner_order') || '999', 10),
        external_link: fd.get('external_link') || null,
      };
      setBanners(editBannerMode === 'new' ? [...banners, data] : (banners || []).map(b => b.id === data.id ? data : b));
      showToast('Banner salvo!'); 
      setEditBannerMode(null);
      setBannerImageFile(null);
    } catch (err) {
      console.error('[banner] erro:', err);
      showToast('Erro ao salvar banner: ' + err.message, 'error');
    } finally {
      setIsUploadingBanner(false);
    }
  };
  return (
    <div className="p-6 animate-in space-y-6 pb-32">
      {!editBannerMode ? (
        <div className="space-y-4">
          <div className="flex justify-between items-center"><h3 className="font-black italic uppercase text-white tracking-widest text-lg">Banners</h3><button onClick={() => setEditBannerMode('new')} className="bg-emerald-500 text-zinc-950 px-4 py-2 rounded-xl font-black text-[10px] uppercase shadow-lg">+ Novo</button></div>
          {(banners || []).map(b => (
            <div key={b.id} className={`bg-zinc-900 p-4 rounded-[24px] border flex items-center gap-4 ${b.active ? 'border-emerald-500/30' : 'border-white/5 opacity-60'}`}>
              <img src={b.image} className="w-20 h-12 rounded-lg object-cover" alt="Banner" />
              <div className="flex-1 truncate"><h4 className="font-black text-white text-[10px] uppercase truncate">{b.title}</h4><span style={{ fontSize: 9, color: '#52525b', fontWeight: 900 }}>#{b.banner_order}</span></div>
              <div className="flex gap-1"><button onClick={() => setEditBannerMode(b)} className="p-2 bg-white/5 rounded-lg text-zinc-400"><Edit3 size={12}/></button><button onClick={() => setBanners((banners || []).filter(i => i.id !== b.id))} className="p-2 bg-red-500/10 rounded-lg text-red-500"><Trash2 size={12}/></button></div>
            </div>
          ))}
        </div>
      ) : (
        <form onSubmit={handleSaveBanner} className="bg-zinc-900 p-8 rounded-[32px] border border-white/10 space-y-4 shadow-2xl relative">
          <button type="button" onClick={() => setEditBannerMode(null)} className="absolute top-6 right-6 text-zinc-500"><X/></button>
          <div className="relative overflow-hidden bg-zinc-950 border-2 border-dashed border-white/10 rounded-[20px] aspect-video flex flex-col items-center justify-center cursor-pointer">
            {previewBannerImage ? <img src={previewBannerImage} className="absolute inset-0 w-full h-full object-cover opacity-60" alt="Preview" /> : <ImagePlus size={32} className="text-zinc-800" />}
            <span className="relative z-10 text-[9px] font-black uppercase text-white">Carregar Banner 4:5 · Mobile (1080×1350px recomendado)</span>
            <input type="file" accept="image/*" onChange={handleBannerFileChange} className="absolute inset-0 opacity-0 cursor-pointer" />
          </div>
          <span style={{ fontSize: 9, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Use proporção 4:5 (vertical) para mobile e o site adapta automaticamente</span>
          <input name="title" defaultValue={editBannerMode?.title} placeholder="Título (opcional)" className="w-full p-4 bg-zinc-950 border border-white/5 rounded-2xl text-sm text-white outline-none" />
          <input name="subtitle" defaultValue={editBannerMode?.subtitle} placeholder="Subtítulo" className="w-full p-4 bg-zinc-950 border border-white/5 rounded-2xl text-sm text-white outline-none" />
	          <input name="buttonText" defaultValue={editBannerMode?.buttonText || 'VER PEÇAS'} className="w-full p-4 bg-zinc-950 border border-white/5 rounded-2xl text-sm text-white outline-none uppercase" required />
	          <div className="space-y-1">
	            <label className="text-[9px] font-black text-zinc-500 uppercase px-2">Nome da Coleção (Ex: Lacoste)</label>
	            <input name="collection_name" defaultValue={editBannerMode?.collection_name} placeholder="Digite o nome da coleção..." className="w-full p-4 bg-zinc-950 border border-white/5 rounded-2xl text-sm text-white outline-none uppercase" />
	          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 9, fontWeight: 900, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.08em', paddingLeft: 8 }}>
              Link externo (opcional — substitui filtro de coleção)
            </label>
            <input
              name="external_link"
              defaultValue={editBannerMode?.external_link || ''}
              placeholder="https://... (deixe vazio para usar filtro de coleção)"
              className="w-full p-4 bg-zinc-950 border border-white/5 rounded-2xl text-sm text-white outline-none"
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 9, fontWeight: 900, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.08em', paddingLeft: 4 }}>
              Ordem de exibição
            </label>
            <input
              type="number"
              name="banner_order"
              min="1"
              max="999"
              defaultValue={editBannerMode === 'new' ? 999 : (editBannerMode?.banner_order ?? 999)}
              className="w-full p-4 bg-zinc-950 border border-white/5 rounded-2xl font-bold text-sm text-white focus:border-emerald-500/50 outline-none"
            />
            <span style={{ fontSize: 9, color: '#52525b', paddingLeft: 4 }}>1 = primeiro a aparecer</span>
          </div>
          <label className="flex items-center gap-3 bg-zinc-950 p-4 rounded-2xl border border-white/5"><input type="checkbox" name="active" defaultChecked={editBannerMode === 'new' ? true : editBannerMode?.active} className="w-5 h-5 accent-emerald-500" /><span className="text-[11px] font-black uppercase text-white">Ativo no site</span></label>
          <button type="submit" disabled={isUploadingBanner} className="w-full py-4 bg-emerald-500 text-zinc-950 rounded-[20px] font-black uppercase text-[10px] tracking-widest">{isUploadingBanner ? 'Salvando...' : 'Confirmar'}</button>
        </form>
      )}
    </div>
  );
};

const AdminConfig = ({ config, setConfig, showToast, products, setProducts, uploadImage }) => {
  const [logoPreview, setLogoPreview] = useState(config.logoUrl || '');
  const [logoZoomPreview, setLogoZoomPreview] = useState(config.logoZoom || 1.5);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [phrases, setPhrases] = useState(config.marqueePhrases || []);
  const [featuredList, setFeaturedList] = useState(() =>
    (products || [])
      .filter(p => p.featured)
      .sort((a, b) => (a.featured_order ?? 999) - (b.featured_order ?? 999))
  );
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [categoryImages, setCategoryImages] = useState(config.category_images || {});
  const [uploadingCategory, setUploadingCategory] = useState(null);
  const [cropModal, setCropModal] = useState(null);
  const cropDragRef = useRef({ active: false, startX: 0, startY: 0, startPosX: 50, startPosY: 50 });
  useEffect(() => {
    setCategoryImages(config.category_images || {});
  }, [config.category_images]);
  const handleCategoryImageUpload = async (categoryName, file) => {
    if (!file) return;
    setUploadingCategory(categoryName);
    try {
      const url = await uploadImage(file);
      const existing = getCatImgData(categoryImages[categoryName]);
      setCropModal({ cat: categoryName, url, posX: 50, posY: 50 });
    } catch (err) {
      showToast('Erro ao enviar imagem: ' + err.message, 'error');
    } finally {
      setUploadingCategory(null);
    }
  };
  const handleConfirmCrop = () => {
    const { cat, url, posX, posY } = cropModal;
    const updated = { ...categoryImages, [cat]: { url, pos: `${posX}% ${posY}%` } };
    setCategoryImages(updated);
    setConfig(prev => ({ ...prev, category_images: updated }));
    setCropModal(null);
    showToast(`Imagem de "${cat}" salva!`, 'success');
  };
  const handleCropPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    cropDragRef.current = { active: true, startX: e.clientX, startY: e.clientY, startPosX: cropModal.posX, startPosY: cropModal.posY };
  };
  const handleCropPointerMove = (e) => {
    if (!cropDragRef.current.active) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const dx = e.clientX - cropDragRef.current.startX;
    const dy = e.clientY - cropDragRef.current.startY;
    const newX = Math.max(0, Math.min(100, cropDragRef.current.startPosX + (dx / rect.width) * 100));
    const newY = Math.max(0, Math.min(100, cropDragRef.current.startPosY + (dy / rect.height) * 100));
    setCropModal(prev => ({ ...prev, posX: Math.round(newX), posY: Math.round(newY) }));
  };
  const handleCropPointerUp = () => { cropDragRef.current.active = false; };
  const handleCategoryImageRemove = (categoryName) => {
    const updated = { ...categoryImages };
    delete updated[categoryName];
    setCategoryImages(updated);
    setConfig(prev => ({ ...prev, category_images: updated }));
    showToast(`Imagem de "${categoryName}" removida.`, 'success');
  };
  const moveUp = (i) => {
    if (i === 0) return;
    const list = [...featuredList];
    [list[i - 1], list[i]] = [list[i], list[i - 1]];
    setFeaturedList(list);
  };
  const moveDown = (i) => {
    if (i === featuredList.length - 1) return;
    const list = [...featuredList];
    [list[i], list[i + 1]] = [list[i + 1], list[i]];
    setFeaturedList(list);
  };
  const handleSaveOrder = async () => {
    setIsSavingOrder(true);
    try {
      const updated = featuredList.map((p, idx) => ({ ...p, featured_order: idx + 1 }));
      for (const p of updated) {
        await upsertProduct(p);
      }
      setProducts(prev => prev.map(p => {
        const u = updated.find(u => u.id === p.id);
        return u || p;
      }));
      showToast('Ordem dos destaques atualizada!', 'success');
    } catch {
      showToast('Erro ao salvar ordem.', 'error');
    } finally {
      setIsSavingOrder(false);
    }
  };

  const handleLogoFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setIsUploadingLogo(true);
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MH = 600; let w = img.width; let h = img.height;
          if (h > MH) { w *= MH / h; h = MH; }
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          setLogoPreview(canvas.toDataURL('image/png', 0.9)); 
          setIsUploadingLogo(false);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePhraseChange = (index, value) => {
    const n = [...phrases];
    n[index] = value.toUpperCase();
    setPhrases(n);
  };

  const handleSaveConfig = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const newConfig = {
      brandName: fd.get('brandName'),
      whatsapp: fd.get('whatsapp').replace(/\D/g, ''),
      location: fd.get('location'),
      minOrder: parseFloat(fd.get('minOrder')),
      pixelId: fd.get('pixelId'),
      logoUrl: logoPreview,
      logoZoom: parseFloat(fd.get('logoZoom') || 1.5),
      marqueePhrases: phrases.filter(p => p.trim() !== ''),
      category_images: categoryImages,
    };
    setConfig(newConfig);
    showToast('Sistema Atualizado!', 'success');
  };

  return (
    <div className="p-6 animate-in space-y-6 pb-32">
      <h3 className="font-black italic uppercase text-white tracking-widest text-lg">Setup Global</h3>
      <form onSubmit={handleSaveConfig} className="space-y-6">
        
        <div className="bg-zinc-900 p-6 rounded-[32px] border border-white/5 space-y-4">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-2 flex items-center gap-2"><ImageIcon size={14}/> Identidade Visual</h4>
          <div className="relative bg-zinc-950 border-2 border-dashed border-white/10 rounded-[20px] h-32 flex flex-col items-center justify-center cursor-pointer">
            {logoPreview ? (
              <div className="absolute inset-0 flex items-center justify-center p-2 overflow-hidden bg-black/50">
                <img src={logoPreview} style={{ transform: `scale(${logoZoomPreview})` }} className="w-full h-full object-contain mix-blend-screen transition-transform" alt="Logo" />
              </div>
            ) : (
              <div className="flex flex-col items-center text-zinc-600">
                <Upload size={20} className="mb-2" />
                <span className="text-[9px] font-black uppercase">Subir Logo (PNG/Fundo Preto)</span>
              </div>
            )}
            <input type="file" accept="image/*" onChange={handleLogoFileChange} className="absolute inset-0 opacity-0 cursor-pointer z-20" />
          </div>
          {logoPreview && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-[9px] font-black text-zinc-500 uppercase px-2">Zoom da Logo</label>
                <span className="text-[10px] font-bold text-emerald-500">{logoZoomPreview}x</span>
              </div>
              <input type="range" name="logoZoom" min="0.5" max="5" step="0.1" value={logoZoomPreview} onChange={(e) => setLogoZoomPreview(parseFloat(e.target.value))} className="w-full accent-emerald-500" />
              <button type="button" onClick={() => setLogoPreview('')} className="text-[9px] font-black uppercase text-red-500 flex items-center gap-1 ml-auto"><Trash2 size={12}/> Remover</button>
            </div>
          )}
        </div>

        <div className="bg-zinc-900 p-6 rounded-[32px] border border-white/5 space-y-4">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-2 flex items-center gap-2"><Megaphone size={14}/> Letreiro Superior</h4>
          <div className="space-y-2">
            {(phrases || []).map((ph, idx) => (
              <div key={idx} className="flex gap-2 animate-in">
                <input value={ph} onChange={(e) => handlePhraseChange(idx, e.target.value)} placeholder="Frase de Gatilho" className="flex-1 p-3 bg-zinc-950 border border-white/5 rounded-xl text-xs font-bold text-white uppercase outline-none focus:border-emerald-500/30" />
                <button type="button" onClick={() => setPhrases(phrases.filter((_, i) => i !== idx))} className="p-3 text-red-500 bg-red-500/5 rounded-xl"><Minus size={14}/></button>
              </div>
            ))}
            <button type="button" onClick={() => setPhrases([...phrases, ''])} className="w-full py-3 mt-2 border border-dashed border-white/10 rounded-xl text-[9px] font-black uppercase text-zinc-500">+ Nova Frase</button>
          </div>
        </div>

        <div className="bg-zinc-900 p-6 rounded-[32px] border border-white/5 space-y-4">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-2 flex items-center gap-2"><Settings size={14}/> Operação & Contactos</h4>
          <input name="brandName" defaultValue={config.brandName} placeholder="Nome da Marca" className="w-full p-4 bg-zinc-950 border border-white/5 rounded-2xl font-bold text-sm text-white outline-none" required />
          <input name="whatsapp" defaultValue={config.whatsapp} placeholder="WhatsApp (DDD+Num)" className="w-full p-4 bg-zinc-950 border border-white/5 rounded-2xl font-bold text-sm text-white outline-none" required />
          <input name="location" defaultValue={config.location} placeholder="Cidade, UF" className="w-full p-4 bg-zinc-950 border border-white/5 rounded-2xl font-bold text-sm text-white outline-none" required />
          <div className="space-y-1">
             <label className="text-[9px] font-black text-zinc-500 uppercase px-2">Pedido Mínimo (R$)</label>
             <input name="minOrder" type="number" step="0.01" defaultValue={config.minOrder} className="w-full p-4 bg-zinc-950 border border-white/5 rounded-2xl font-bold text-sm text-white outline-none" required />
          </div>
          <input name="pixelId" defaultValue={config.pixelId} placeholder="Facebook Pixel ID" className="w-full p-4 bg-zinc-950 border border-white/5 rounded-2xl font-bold text-sm text-white outline-none" />
        </div>

        <div className="bg-zinc-900 p-6 rounded-[32px] border border-white/5 space-y-4">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-2 flex items-center gap-2"><Star size={14}/> Ordem dos Destaques</h4>
          {featuredList.length === 0 ? (
            <p className="text-[11px] text-zinc-600 text-center py-4">Nenhum produto em destaque no momento.</p>
          ) : (
            <div>
              {featuredList.map((p, i) => (
                <div key={p.id} className="flex items-center gap-3 py-2.5 border-b border-white/5">
                  <img src={p.image} alt={p.name} className="w-10 h-10 rounded-lg object-cover shrink-0 bg-zinc-800" />
                  <span className="flex-1 text-[11px] font-bold text-white truncate">{p.name}</span>
                  <div className="flex gap-1 shrink-0">
                    <button type="button" onClick={() => moveUp(i)} disabled={i === 0} className="w-7 h-7 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all touch-manipulation flex items-center justify-center disabled:opacity-30"><ChevronUp size={13}/></button>
                    <button type="button" onClick={() => moveDown(i)} disabled={i === featuredList.length - 1} className="w-7 h-7 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all touch-manipulation flex items-center justify-center disabled:opacity-30"><ChevronDown size={13}/></button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <button type="button" onClick={handleSaveOrder} disabled={isSavingOrder || featuredList.length === 0} className="bg-emerald-500 text-zinc-950 font-black text-[11px] uppercase tracking-widest rounded-2xl py-4 w-full mt-4 active:scale-95 transition-transform disabled:opacity-50">{isSavingOrder ? 'Salvando...' : 'Salvar Ordem'}</button>
        </div>

        {/* SEÇÃO: Imagens de Categoria */}
        <div className="bg-zinc-900 p-6 rounded-[32px] border border-white/5 space-y-4">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-2 flex items-center gap-2">
            <Layers size={14}/> Imagens de Categoria
          </h4>
          <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest leading-relaxed">
            Opcional. Sem imagem, a categoria exibe fundo preto com a logo da loja.
          </p>
          <div className="space-y-3">
            {['TODOS', ...(products || [])
              .filter(p => !p.is_kit && p.category)
              .map(p => p.category)
              .filter((v, i, a) => a.indexOf(v) === i)
              .sort()
            ].map(cat => {
              const catData = getCatImgData(cat === 'TODOS' ? null : categoryImages[cat]);
              const imgUrl = catData.url;
              const imgPos = catData.pos;
              const isUploading = uploadingCategory === cat;
              return (
                <div key={cat} className="flex items-center gap-4 p-3 bg-zinc-950 rounded-2xl border border-white/5">
                  <div className="w-14 h-14 rounded-full overflow-hidden shrink-0 border border-white/10 bg-black flex items-center justify-center relative">
                    {imgUrl ? (
                      <img src={imgUrl} className="w-full h-full object-cover" style={{ objectPosition: imgPos }} alt={cat} />
                    ) : config.logoUrl ? (
                      <img src={config.logoUrl} className="w-8 h-8 object-contain mix-blend-screen opacity-60" alt="logo" />
                    ) : (
                      <span className="text-[11px] font-black text-zinc-600 uppercase">{cat.slice(0,2)}</span>
                    )}
                  </div>
                  <span className="flex-1 text-[11px] font-black uppercase text-white tracking-widest">{cat}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    {imgUrl && (
                      <button
                        type="button"
                        onClick={() => handleCategoryImageRemove(cat)}
                        className="p-2 bg-red-500/10 rounded-xl text-red-500 hover:bg-red-500 hover:text-white transition-colors"
                        title="Remover imagem"
                      >
                        <Trash2 size={13}/>
                      </button>
                    )}
                    {cat !== 'TODOS' && (
                      <label className={`p-2 rounded-xl cursor-pointer transition-colors flex items-center justify-center ${isUploading ? 'bg-zinc-800 text-zinc-600' : 'bg-zinc-800 text-zinc-400 hover:text-emerald-500 border border-white/5'}`}>
                        {isUploading ? (
                          <span className="text-[9px] font-black uppercase text-zinc-500">...</span>
                        ) : (
                          <Upload size={13}/>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={isUploading}
                          onChange={e => {
                            const f = e.target.files?.[0];
                            if (f) handleCategoryImageUpload(cat, f);
                            e.target.value = '';
                          }}
                        />
                      </label>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <button type="submit" disabled={isUploadingLogo} className="w-full py-5 bg-white text-zinc-950 rounded-[28px] font-black uppercase text-[11px] tracking-widest active:scale-95 shadow-xl">{isUploadingLogo ? 'Processando...' : 'Aplicar Mudanças'}</button>
      </form>

      {/* Modal de enquadramento */}
      {cropModal && (
        <div className="fixed inset-0 z-[500] bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center p-6">
          <div className="bg-zinc-900 rounded-[32px] border border-white/10 w-full max-w-sm p-6 space-y-5 shadow-2xl">
            <div className="text-center">
              <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Enquadrar Imagem</p>
              <h3 className="text-lg font-black text-white uppercase">{cropModal.cat}</h3>
            </div>

            {/* Círculo arrastável */}
            <div className="flex flex-col items-center gap-2">
              <div
                className="w-48 h-48 rounded-full overflow-hidden border-2 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)] cursor-grab active:cursor-grabbing select-none"
                style={{ touchAction: 'none' }}
                onPointerDown={handleCropPointerDown}
                onPointerMove={handleCropPointerMove}
                onPointerUp={handleCropPointerUp}
                onPointerCancel={handleCropPointerUp}
              >
                <img
                  src={cropModal.url}
                  className="w-full h-full object-cover pointer-events-none"
                  style={{ objectPosition: `${cropModal.posX}% ${cropModal.posY}%` }}
                  alt=""
                  draggable={false}
                />
              </div>
              <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Arraste para enquadrar</p>
            </div>

            {/* Sliders de controle fino */}
            <div className="space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between items-center px-1">
                  <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Horizontal</label>
                  <span className="text-[9px] font-black text-zinc-400">{cropModal.posX}%</span>
                </div>
                <input type="range" min="0" max="100" value={cropModal.posX}
                  onChange={e => setCropModal(prev => ({ ...prev, posX: Number(e.target.value) }))}
                  className="w-full accent-emerald-500 h-1.5 cursor-pointer"
                />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between items-center px-1">
                  <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Vertical</label>
                  <span className="text-[9px] font-black text-zinc-400">{cropModal.posY}%</span>
                </div>
                <input type="range" min="0" max="100" value={cropModal.posY}
                  onChange={e => setCropModal(prev => ({ ...prev, posY: Number(e.target.value) }))}
                  className="w-full accent-emerald-500 h-1.5 cursor-pointer"
                />
              </div>
            </div>

            {/* Botões */}
            <div className="flex gap-3">
              <button type="button" onClick={() => setCropModal(null)}
                className="flex-1 py-3 bg-zinc-800 text-zinc-400 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-transform">
                Cancelar
              </button>
              <button type="button" onClick={handleConfirmCrop}
                className="flex-1 py-3 bg-emerald-500 text-zinc-950 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-transform">
                Usar esta imagem
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

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
  const [productsRaw, setProductsRaw] = useState(DEFAULT_PRODUCTS);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const productsRef = useRef(DEFAULT_PRODUCTS);
  useEffect(() => { productsRef.current = productsRaw; }, [productsRaw]);

  // Carrega produtos do Supabase + polling de 5s
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const remote = await fetchProducts();
        if (alive && Array.isArray(remote) && remote.length > 0) setProductsRaw(remote);
      } catch (e) { console.warn('[products] fetch falhou:', e?.message); }
      finally { if (alive) setProductsLoaded(true); }
    };
    load();
    const t = setInterval(load, 5000);
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
    const t = setInterval(load, 10000);
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
        (prev || []).forEach(p => { if (!nextIds.has(p.id)) deleteProductRemote(p.id).catch(err => console.warn('[products] delete falhou:', err?.message)); });
      } catch (e) { console.warn('[products] sync falhou:', e?.message); }
      return next;
    });
  };
  const products = productsRaw;

  const [banners, setBannersRaw] = useState(DEFAULT_BANNERS);
  const [bannersLoaded, setBannersLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const remote = await fetchBanners();
        if (alive && Array.isArray(remote) && remote.length > 0) {
          // Normaliza button_text -> buttonText para o UI
          const normalized = remote.map(b => ({
            ...b,
            buttonText: b.button_text || b.buttonText || 'VER PEÇAS'
          }));
          setBannersRaw(normalized);
        }
      } catch (e) { console.warn('[banners] fetch falhou:', e?.message); }
      finally { if (alive) setBannersLoaded(true); }
    };
    load();
    const t = setInterval(load, 10000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const setBanners = (updater) => {
    setBannersRaw((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try {
        const prevIds = new Set((prev || []).map(b => b.id));
        const nextIds = new Set((next || []).map(b => b.id));
        // upserts
        (next || []).forEach(b => {
          const old = (prev || []).find(o => o.id === b.id);
          if (!old || JSON.stringify(old) !== JSON.stringify(b)) {
            upsertBanner(b).catch(err => console.warn('[banners] upsert falhou:', err?.message));
          }
        });
        // deletes
        (prev || []).forEach(b => { if (!nextIds.has(b.id)) deleteBannerRemote(b.id).catch(err => console.warn('[banners] delete falhou:', err?.message)); });
      } catch (e) { console.warn('[banners] sync falhou:', e?.message); }
      return next;
    });
  };
  const [config, setConfigState] = useState(SITE_DEFAULT_CONFIG);
  // Carrega config do Supabase + polling de 10s pra propagar mudanças pra todos
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const remote = await fetchSiteConfig();
        if (alive && remote) setConfigState(remote);
      } catch (e) { console.warn('[config] fetch falhou:', e?.message); }
    };
    load();
    const t = setInterval(load, 10000);
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
    const t = setInterval(load, 5000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  const [cart, setCart] = useState([]);
  
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
    };
  })();
  const [selectedCategory, setSelectedCategory] = useState(_initialUrlFilters.categoria || 'TODOS');
  const [selectedSubcategory, setSelectedSubcategory] = useState(_initialUrlFilters.sub || 'TODOS');
  const [searchQuery, setSearchQuery] = useState(_initialUrlFilters.busca || '');
  const [selectedSize, setSelectedSize] = useState(_initialUrlFilters.tamanho || 'TODOS');
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
    }
  }, [userProfile]);

  // ── Drawer de usuário ──
  const [showUserDrawer, setShowUserDrawer] = useState(false);
  const [drawerTab, setDrawerTab] = useState('profile');
  const [profileForm, setProfileForm] = useState({ name: '', phone: '' });

  // ── Avaliações ──
  const [ratingsMap, setRatingsMap] = useState({});

  const [toast, setToast] = useState(null);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [whatsappLink, setWhatsappLink] = useState('');
  const [checkoutOrderNumber, setCheckoutOrderNumber] = useState('');
  const [currentBannerSlide, setCurrentBannerSlide] = useState(0);
  const bannerRef = useRef(null);
  const bannerTrackRef = useRef(null);
  const bannerDragStateRef = useRef({ startX: 0, startY: 0, dx: 0, decided: false, horizontal: false, active: false, pointerId: -1 });
  const currentBannerSlideRef = useRef(0);
  const activeBannersLengthRef = useRef(0);
  const featuredRailRef = useRef(null);
  const mobileGalleryRef = useRef(null);
  const desktopGalleryRef = useRef(null);
  const featuredPeekedRef = useRef(false);
  const [activeCollectionFilter, setActiveCollectionFilter] = useState(null);
  const [adminTab, setAdminTab] = useState('dashboard'); 
  const visualFrame = useVisualViewportFrame();
  const viewportOverlayStyle = { top: visualFrame.top, height: visualFrame.height || '100dvh' };
  const viewportPanelMaxHeight = visualFrame.height ? `calc(${visualFrame.height}px - 10px)` : 'calc(100dvh - 10px)';

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

  const activeBanners = useMemo(() => (banners || []).filter(b => b.active), [banners]);
  useEffect(() => { currentBannerSlideRef.current = currentBannerSlide; }, [currentBannerSlide]);
  useEffect(() => { activeBannersLengthRef.current = activeBanners.length; }, [activeBanners.length]);
  const availableCollections = useMemo(() => {
    const set = new Set();
    (banners || []).forEach(b => { if (b.collection_name) set.add(b.collection_name); });
    return Array.from(set).sort();
  }, [banners]);

  // Navega para slide via scrollTo nativo (scroll snap cuida da animação)
  const goToBannerSlide = (idx) => {
    if (!activeBanners.length) return;
    const total = activeBanners.length;
    const newIdx = ((idx % total) + total) % total;
    const track = bannerTrackRef.current;
    if (track) track.scrollTo({ left: newIdx * track.clientWidth, behavior: 'smooth' });
    setCurrentBannerSlide(newIdx);
  };
  const nextBannerSlide = () => goToBannerSlide(currentBannerSlideRef.current + 1);
  const prevBannerSlide = () => goToBannerSlide(currentBannerSlideRef.current - 1);

  useEffect(() => {
    if (isAdmin || activeBanners.length <= 1) return;
    const timer = setInterval(() => {
      const next = (currentBannerSlideRef.current + 1) % activeBanners.length;
      const track = bannerTrackRef.current;
      if (track) track.scrollTo({ left: next * track.clientWidth, behavior: 'smooth' });
      setCurrentBannerSlide(next);
    }, 5000);
    return () => clearInterval(timer);
  }, [activeBanners.length, isAdmin]);

  // Banner: swipe via CSS scroll snap nativo (sem drag JS) + parallax no scroll vertical
  useEffect(() => {
    const section = bannerRef.current;
    const track = bannerTrackRef.current;
    if (!section || !track) return;

    // Detecta slide atual pelo scrollLeft do track (scroll snap nativo)
    const onTrackScroll = () => {
      const newSlide = Math.round(track.scrollLeft / (track.clientWidth || 1));
      if (newSlide !== currentBannerSlideRef.current) {
        setCurrentBannerSlide(newSlide);
      }
    };

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
      scroller.removeEventListener('scroll', onScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);


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

  const handleProductClick = (product) => {
    if (!product) return;
    // Kits podem ser abertos mesmo sem estoque próprio (estoque vem dos componentes)
    if (!product.is_kit && product.stock <= 0) return;
    setSelectedProduct(product);
    setSelectedSizes({});
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
      const itemKey = `${selectedProduct.id}-${sizeName || 'U'}`;
      const existingIdx = updatedCart.findIndex(item => item.itemKey === itemKey);
      if (existingIdx >= 0) {
        updatedCart[existingIdx] = {
          ...updatedCart[existingIdx],
          quantity: updatedCart[existingIdx].quantity + quantity,
        };
      } else {
        updatedCart.push({
          ...selectedProduct,
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

      // 🟢 Purchase com Advanced Matching (fn, ph) — dispara ANTES do redirect
      // Formata telefone: só dígitos, garante prefixo país 55 (Brasil)
      const phoneDigits = customerPhone.replace(/\D/g, '');
      const phoneAM = phoneDigits.startsWith('55') ? phoneDigits : `55${phoneDigits}`;
      const firstName = customerName.trim().split(/\s+/)[0] || customerName.trim();
      const purchaseEventId = createMetaEventId();
      try {
        if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
          window.fbq(
            'track',
            'Purchase',
            { value: totalPedido, currency: 'BRL' },
            { eventID: purchaseEventId, fn: firstName, ph: phoneAM }
          );
        }
      } catch (e) { console.warn('[pixel] Purchase AM falhou:', e); }

      // CAPI Purchase (mesmo event_id → dedup) — fire-and-forget
      try {
        dispatchCAPIPurchase({ phone: phoneAM, value: totalPedido, event_id: purchaseEventId });
      } catch (e) { /* ignora */ }

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

  const filteredProducts = useMemo(() => {
    return (products || []).filter(p => {
      // Produtos com is_active === false ficam ocultos para o cliente
      if (p.is_active === false) return false;
      // Modo KITS: só exibe produtos marcados como kit (e ignora estoque/tamanho/categoria)
      if (kitsOnly) {
        if (!p.is_kit) return false;
        const q = searchQuery.toLowerCase().trim();
        const haystack = `${p.name || ''} ${p.sku || ''}`.toLowerCase();
        const tokens = q.split(/\s+/).filter(Boolean);
        return tokens.length === 0 || tokens.every(t => haystack.includes(t));
      }
      // Catálogo normal: esconde kits (eles ficam só na seção KITS)
      if (p.is_kit) return false;
      if (p.stock <= 0) return false;
      const matchesCat = selectedCategory === 'TODOS' || p.category === selectedCategory;
      const matchesSub = selectedSubcategory === 'TODOS' || (p.subcategory || '').toUpperCase() === selectedSubcategory;
      const q = searchQuery.toLowerCase().trim();
      const haystack = `${p.name || ''} ${p.subcategory || ''} ${p.category || ''} ${p.sku || ''}`.toLowerCase();
      const tokens = q.split(/\s+/).filter(Boolean);
      const matchesSearch = tokens.length === 0 || tokens.every(t => haystack.includes(t));
      const sizeNorm = String(selectedSize || '').trim().toUpperCase();
      const matchesSize = sizeNorm === 'TODOS' || (Array.isArray(p.sizes) && p.sizes.some(s => {
        const sName = String((typeof s === 'string' ? s : s.size) || '').trim().toUpperCase();
        const sStock = typeof s === 'string' ? (p.stock || 0) : Number(s.stock || 0);
        return sName === sizeNorm && sStock > 0;
      }));
      const matchesCollection = !activeCollectionFilter || p.collection_name === activeCollectionFilter;
      return matchesCat && matchesSub && matchesSearch && matchesSize && matchesCollection;
    });
  }, [kitsOnly, selectedCategory, selectedSubcategory, searchQuery, selectedSize, products, activeCollectionFilter]);

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
        const newSearch = sp.toString();
        const newUrl = url.pathname + (newSearch ? `?${newSearch}` : '') + url.hash;
        const current = window.location.pathname + window.location.search + window.location.hash;
        if (newUrl !== current) window.history.replaceState(null, '', newUrl);
      } catch {}
    }, 200);
    return () => clearTimeout(handle);
  }, [selectedCategory, selectedSubcategory, selectedSize, searchQuery, kitsOnly]);

  // Reage ao botão voltar/avançar do navegador para refletir os filtros da URL
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onPop = () => {
      const sp = new URLSearchParams(window.location.search);
      setSelectedCategory((sp.get('categoria') || 'TODOS').toUpperCase());
      setSelectedSubcategory((sp.get('sub') || 'TODOS').toUpperCase());
      setSelectedSize((sp.get('tamanho') || 'TODOS').toUpperCase());
      setSearchQuery(sp.get('busca') || '');
      setKitsOnly(sp.get('kits') === '1');
      // Fecha modal de produto se o parâmetro sumiu da URL
      if (!sp.get('produto')) { setSelectedProduct(null); setSelectedSizes({}); }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

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
      if (newUrl !== current) window.history.replaceState(null, '', newUrl);
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
  }, [filteredProducts, ratingsMap]);

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
  }, [selectedCategory, selectedSubcategory, searchQuery, selectedSize, activeCollectionFilter]);
  // Se a página atual ficar fora do range (ex.: filtro reduziu lista), corrige.
  // Só corrige depois que a carga remota terminou — evita /pagina2 voltar para / na primeira renderização.
  useEffect(() => {
    if (!productsLoaded) return;
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [totalPages, currentPage, productsLoaded]);
  // Espelha a página atual na URL como /paginaN (push para criar histórico).
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
      window.history.pushState(null, '', newUrl);
    }
    try { sessionStorage.setItem('catalog:page', String(currentPage)); } catch {}
  }, [currentPage]);
  // Suporte ao botão voltar/avançar do navegador — sincroniza com a URL.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onPop = () => {
      const path = window.location.pathname;
      let m = path.match(/\/pagina(\d+)(?:\/)?$/i);
      if (!m) m = path.match(/\/pagina\/(\d+)(?:\/)?$/i);
      if (m) {
        const n = parseInt(m[1], 10);
        setCurrentPage(Number.isFinite(n) && n > 0 ? n : 1);
        return;
      }
      const sp = new URLSearchParams(window.location.search);
      const n = parseInt(sp.get('page') || '1', 10);
      setCurrentPage(Number.isFinite(n) && n > 0 ? n : 1);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
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
    { key: 'banners', icon: <Megaphone size={18}/>, label: 'Promo' },
    { key: 'config', icon: <Settings size={18}/>, label: 'Setup' },
    { key: 'rastreio', icon: <Database size={18}/>, label: 'CAPI' },
  ];

  if (isAdmin) {
    return (
      <div className="app-shell min-h-screen bg-zinc-950 font-sans text-zinc-100 selection:bg-emerald-500 selection:text-zinc-950">
        <AdminHeader handleLogout={handleLogout} handleBackToStore={handleBackToStore} />

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
              {adminTab === 'dashboard' && <AdminDashboard leads={leads} products={products} />}
              {adminTab === 'inventory' && <AdminInventory products={products} setProducts={setProducts} showToast={showToast} availableCollections={availableCollections} productImageFile={productImageFile} setProductImageFile={setProductImageFile} uploadImage={uploadImage} />}
              {adminTab === 'leads' && <AdminLeads leads={leads} setLeads={setLeads} products={products} setProducts={setProducts} showToast={showToast} config={config} />}
              {adminTab === 'banners' && <AdminBanners banners={banners} setBanners={setBanners} showToast={showToast} bannerImageFile={bannerImageFile} setBannerImageFile={setBannerImageFile} uploadImage={uploadImage} />}
              {adminTab === 'config' && <AdminConfig config={config} setConfig={setConfig} showToast={showToast} products={products} setProducts={setProducts} uploadImage={uploadImage} />}
              {adminTab === 'rastreio' && <AdminRastreio />}
              {adminTab === 'crm' && <AdminCRM showToast={showToast} config={config} />}
            </AdminTabErrorBoundary>
          </main>
        </div>

        {/* BOTTOM NAV — visível só no mobile */}
        <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md bg-zinc-900/95 backdrop-blur-xl px-4 py-4 rounded-3xl flex items-center justify-between shadow-[0_20px_50px_rgba(0,0,0,0.8)] z-50 border border-white/10 lg:hidden">
          {adminNavItems.map(item => (
            <button
              key={item.key}
              onClick={() => { setAdminTab(item.key); if (item.key === 'leads') setNewOrdersCount(0); }}
              className={`flex flex-col items-center gap-1 transition-colors relative ${adminTab === item.key ? 'text-emerald-500' : 'text-zinc-500'}`}
            >
              {item.icon}
              {item.badge && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[9px] font-black min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center border-2 border-zinc-900 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.6)]">
                  {item.badge}
                </span>
              )}
              <span className="text-[8px] font-black uppercase">{item.label}</span>
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
        <div className="py-2.5 flex items-center justify-center border-b" style={{ background: 'var(--bg-header)', borderColor: 'var(--border)', color: 'var(--text-secondary)', minHeight: '34px' }}>
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

      {toast && <div className="fixed top-28 left-1/2 -translate-x-1/2 z-[200] animate-slide-down"><div className="px-6 py-3 rounded-full font-black text-[10px] uppercase bg-white text-zinc-950 shadow-2xl">{toast.message}</div></div>}

      <header className="sticky top-0 z-40 isolate border-b border-white/5 shadow-[0_10px_30px_rgba(0,0,0,0.5)] h-20 lg:h-28" style={{ background: 'var(--bg-header)', backgroundColor: 'var(--bg-header)', backgroundImage: 'none', opacity: 1, backdropFilter: 'none', WebkitBackdropFilter: 'none', filter: 'none', mixBlendMode: 'normal' }}>
        <div className="w-full px-6 lg:px-16 h-full flex items-center gap-4">

          {/* LOGO */}
          <button
            className="select-none flex-1 lg:flex-none flex items-center justify-center lg:justify-start mx-2 lg:mx-0 touch-manipulation active:opacity-80 transition-opacity"
            onClick={() => {
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
          <button className="p-2 text-zinc-400 hover:text-white shrink-0 touch-manipulation lg:hidden order-first" onClick={() => document.getElementById('search-input').focus()} data-testid="btn-header-search"><Search size={22} /></button>

          {/* SPACER desktop */}
          <div className="hidden lg:block flex-1" />

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

      {(activeBanners.length > 0 || !bannersLoaded) && (
        <section
          ref={bannerRef}
          className="relative w-full max-w-[640px] lg:max-w-none mx-auto aspect-[4/5] lg:aspect-[3/1] lg:max-h-[440px] overflow-hidden select-none"
          style={{ touchAction: 'pan-y' }}
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
              return (
                <div key={idx} className="w-full h-full shrink-0 relative overflow-hidden" style={{ scrollSnapAlign: 'start' }}>
                  <div className="absolute inset-0" style={{ transform: isActive ? 'scale(1.09)' : 'scale(1)', transition: isActive ? 'transform 10s ease-out' : 'transform 0.6s ease', transformOrigin: '55% 45%' }}>
                    <BannerImage src={banner.image} alt={banner.title || 'Banner'} active={isActive} />
                  </div>
                  <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-zinc-950/75 to-transparent pointer-events-none" />
                  <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-zinc-950 via-zinc-950/55 to-transparent pointer-events-none" />
                  {/* Texto com fade proporcional ao scroll */}
                  <div className="absolute inset-x-0 bottom-0 px-7 pb-12 flex flex-col" style={{ opacity: 'var(--banner-text-op, 1)', transform: 'translate3d(0, calc(var(--banner-parallax, 0px) * -0.4), 0)', transition: 'opacity 0.08s linear', willChange: 'opacity, transform' }}>
                    {banner.collection_name && (
                      <div className="flex items-center gap-2.5 mb-4">
                        <div className="h-px w-8 bg-white/40" />
                        <span className="text-[9px] font-black uppercase tracking-[0.28em] text-white/55">{banner.collection_name}</span>
                      </div>
                    )}
                    {banner.title && <h2 className="text-[2.6rem] font-black uppercase leading-[0.92] tracking-tight text-white mb-2.5 drop-shadow-2xl">{banner.title}</h2>}
                    {banner.subtitle && <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60 mb-7">{banner.subtitle}</p>}
                    {banner.buttonText && (
                      <button
                        onClick={() => {
                          if (banner.external_link) {
                            window.open(banner.external_link, '_blank', 'noopener');
                          } else if (banner.collection_name) {
                            setActiveCollectionFilter(banner.collection_name);
                            document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' });
                          } else {
                            document.getElementById('search-input')?.focus();
                          }
                        }}
                        className="self-start flex items-center gap-2 bg-white text-zinc-950 px-7 py-3.5 rounded-full font-black text-[10px] uppercase tracking-widest active:scale-95 transition-transform shadow-[0_8px_30px_rgba(255,255,255,0.18)] touch-manipulation"
                      >
                        {banner.buttonText} <ArrowRight size={11} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

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
                style={{ animation: 'bannerProgress 5s linear forwards' }}
              />
            </div>
          )}
        </section>
      )}

      <main className="w-full px-6 lg:px-16 mt-6 lg:mt-10 space-y-5 lg:space-y-8 min-h-screen" data-testid="catalog-main">
        <div className="relative group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
          <input id="search-input" placeholder="O que você procura?" data-testid="input-search" className="w-full border py-4 pl-14 pr-6 rounded-2xl text-[16px] font-bold outline-none focus:border-emerald-500/50 shadow-inner client-input" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        
        <div id="catalog-section" className="flex gap-3 overflow-x-auto no-scrollbar pb-1 mask-linear native-x-scroll items-start" style={{ touchAction: 'pan-x pan-y' }}>
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
                className="flex flex-col items-center gap-2 shrink-0 touch-manipulation"
                style={{ minWidth: '60px' }}
              >
                <div className={`w-[58px] h-[58px] rounded-full overflow-hidden border-2 transition-all duration-200 bg-black flex items-center justify-center relative ${
                  isActive
                    ? 'border-emerald-500 shadow-[0_0_14px_rgba(16,185,129,0.45)]'
                    : 'border-white/10 hover:border-white/30'
                }`}>
                  {imgUrl ? (
                    <img src={imgUrl} alt={cat} className="w-full h-full object-cover" style={{ objectPosition: imgPos }} loading="lazy" decoding="async" />
                  ) : hasLogo ? (
                    <img src={config.logoUrl} alt={cat} className="w-8 h-8 object-contain mix-blend-screen opacity-50" loading="lazy" />
                  ) : (
                    <div className="w-full h-full bg-zinc-950" />
                  )}
                  {imgUrl && <div className="absolute inset-0 bg-black/25 pointer-events-none" />}
                  {isActive && <div className="absolute inset-[3px] rounded-full border border-emerald-500/40 pointer-events-none" />}
                </div>
                <span className={`text-[9px] font-black uppercase tracking-widest leading-none transition-colors ${
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

        {!kitsOnly && availableSizes.length > 1 && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar mask-linear native-x-scroll items-center">
            {availableSizes.map(sz => (
              <button key={sz} onClick={() => setSelectedSize(sz)} data-testid={`size-filter-${sz}`} className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase whitespace-nowrap border transition-all touch-manipulation ${selectedSize === sz ? 'bg-zinc-300 text-zinc-950 border-zinc-300 shadow-[0_0_10px_rgba(212,212,216,0.25)]' : 'bg-transparent text-zinc-600 border-white/5 hover:text-white hover:border-white/20'}`}>{sz === 'TODOS' ? 'Todos tamanhos' : sz}</button>
            ))}
          </div>
        )}

        {/* DESTAQUES */}
        {(() => {
          const isDefaultView = !kitsOnly && selectedCategory === 'TODOS' && (selectedSize === 'TODOS' || !selectedSize) && !searchQuery.trim() && !activeCollectionFilter && currentPage === 1;
          if (!isDefaultView) return null;
          const featured = (products || [])
            .filter(p => p.featured && (p.is_kit || (p.stock || 0) > 0))
            .sort((a, b) => (a.featured_order ?? 999) - (b.featured_order ?? 999));
          if (featured.length === 0) return null;
          const hero = featured[0];
          const rest = featured.slice(1);
          const heroImages = [hero.image, ...((Array.isArray(hero.gallery) ? hero.gallery : []))].filter(Boolean);
          const heroLow = (hero.stock || 0) > 0 && hero.stock <= 3;
          return (
            <section
              className="relative -mx-6 lg:mx-auto lg:max-w-[1000px] lg:rounded-3xl overflow-hidden animate-in"
              data-testid="featured-section"
              style={{ background: 'radial-gradient(120% 80% at 50% 0%, rgba(228,228,231,0.06) 0%, rgba(9,9,11,0) 55%), linear-gradient(180deg, rgba(9,9,11,0) 0%, rgba(9,9,11,0) 100%)' }}
            >
              {/* Linha luminosa superior */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" aria-hidden="true" />

              {/* Cabeçalho editorial */}
              <div className="px-6 pt-10 pb-6">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[9px] font-black uppercase tracking-[0.45em] text-white/40">N.º 01</span>
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
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '120px' }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="block w-full text-left touch-manipulation"
                data-testid={`featured-hero-${hero.id}`}
              >
                <div className="mx-6 lg:mx-auto lg:max-w-[420px] relative">
                  {/* Glow ambiente */}
                  <div className="absolute -inset-3 bg-gradient-to-b from-white/8 via-white/2 to-transparent rounded-[36px] blur-2xl opacity-70 pointer-events-none" aria-hidden="true" />
                  {/* Borda platina */}
                  <div className="relative p-[1.5px] rounded-[28px] bg-gradient-to-b from-white/30 via-white/10 to-white/5">
                    <div className="rounded-[27px] bg-zinc-950 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.85)]">
                      <div className="aspect-[4/5] relative">
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', overflowX: 'scroll', overflowY: 'hidden', scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch', overscrollBehaviorX: 'contain', msOverflowStyle: 'none', scrollbarWidth: 'none', touchAction: 'pan-x pan-y' }}>
                          {heroImages.map((imgSrc, i) => (
                            <div key={i} style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always', flexShrink: 0, width: '100%', height: '100%', position: 'relative' }}>
                              <ProductImage src={imgSrc} alt={hero.name} priority={i === 0} sizes="92vw" />
                            </div>
                          ))}
                        </div>
                        {/* Vinheta lateral premium */}
                        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(120% 80% at 50% 35%, transparent 50%, rgba(0,0,0,0.45) 100%)' }} />
                        {/* Gradient inferior */}
                        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-zinc-950 via-zinc-950/55 to-transparent pointer-events-none" />
                        {heroLow && (
                          <div className="absolute top-4 right-4 z-20 bg-zinc-950/80 backdrop-blur-md border border-red-400/40 rounded-full px-3 py-1">
                            <span className="text-[8px] font-black uppercase tracking-[0.25em] text-red-300">Últimas {hero.stock}</span>
                          </div>
                        )}
                        {/* Conteúdo sobre a imagem */}
                        <div className="absolute inset-x-0 bottom-0 p-5 z-10" onClick={() => handleProductClick(hero)} style={{ cursor: 'pointer' }}>
                          <div className="flex items-center gap-2 mb-2.5">
                            <span className="text-[8px] font-black uppercase tracking-[0.35em] text-white/55">Em destaque</span>
                            <span className="h-px flex-1 bg-white/15" />
                          </div>
                          {!hero.is_kit && (
                            <h3 className="font-black text-white text-[15px] uppercase leading-tight mb-3 line-clamp-2 drop-shadow-lg">{hero.name}</h3>
                          )}
                          <div className="flex items-end justify-between">
                            <div className="flex flex-col">
                              <span className="text-[8px] font-black uppercase tracking-[0.3em] text-white/45">A partir de</span>
                              <span className="font-black text-white text-2xl leading-none mt-1 drop-shadow-lg">{formatBRL(hero.price || 0)}</span>
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
              </motion.div>

              {/* Rail secundário — demais destaques */}
              {rest.length > 0 && (
                <>
                  <div className="flex items-center gap-3 px-6 pt-8 pb-4">
                    <span className="text-[8px] font-black uppercase tracking-[0.4em] text-white/40">Também em destaque</span>
                    <div className="h-px flex-1 bg-gradient-to-r from-white/15 to-transparent" />
                  </div>
                  <div
                    ref={featuredRailRef}
                    className="flex gap-3 overflow-x-auto overflow-y-hidden no-scrollbar snap-x snap-mandatory pb-9 px-6 carousel-scroll"
                    data-testid="featured-rail"
                  >
                    {rest.map((product, idx) => {
                      const fg = [product.image, ...((Array.isArray(product.gallery) ? product.gallery : []))].filter(Boolean);
                      const isLowStock = (product.stock || 0) > 0 && product.stock <= 3;
                      return (
                        <motion.div
                          key={product.id}
                          initial={{ opacity: 0, y: 16 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true, margin: '80px' }}
                          transition={{ duration: 0.5, delay: idx * 0.07, ease: [0.16, 1, 0.3, 1] }}
                          className="shrink-0 w-[54%] max-w-[210px] snap-start text-left touch-manipulation"
                          data-testid={`featured-card-${product.id}`}
                        >
                          <div className="p-[1px] rounded-2xl bg-gradient-to-b from-white/20 to-white/4">
                            <div className="rounded-2xl overflow-hidden bg-zinc-900 shadow-[0_20px_50px_rgba(0,0,0,0.7)]">
                              <div className="aspect-[3/4] relative overflow-hidden">
                                <div style={{ position: 'absolute', inset: 0, display: 'flex', overflowX: 'scroll', overflowY: 'hidden', scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch', overscrollBehaviorX: 'contain', msOverflowStyle: 'none', scrollbarWidth: 'none', touchAction: 'pan-x pan-y' }}>
                                  {fg.map((imgSrc, i) => (
                                    <div key={i} style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always', flexShrink: 0, width: '100%', height: '100%', position: 'relative' }}>
                                      <ProductImage src={imgSrc} alt={product.name} priority={i === 0} sizes="55vw" />
                                    </div>
                                  ))}
                                </div>
                                <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1.5 bg-black/55 backdrop-blur-sm border border-white/15 rounded-full px-2 py-[3px]">
                                  <span className="text-[6px] font-black uppercase tracking-[0.25em] text-white/85">N.º {String(idx + 2).padStart(2, '0')}</span>
                                </div>
                                <div className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-zinc-900 to-transparent pointer-events-none" />
                              </div>
                              <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                              <div className="px-3 pt-2.5 pb-3 bg-zinc-900" onClick={() => handleProductClick(product)} style={{ cursor: 'pointer' }}>
                                {isLowStock && (
                                  <p className="text-[7px] font-black uppercase tracking-widest text-red-400/80 mb-1.5">Últimas {product.stock} peças</p>
                                )}
                                {!product.is_kit && <h3 className="font-black text-zinc-300 text-[10px] uppercase line-clamp-2 leading-tight mb-2.5">{product.name}</h3>}
                                <div className="flex items-center justify-between">
                                  <span className="font-black text-sm text-white">{formatBRL(product.price || 0)}</span>
                                  <span className="w-7 h-7 rounded-full border border-white/15 flex items-center justify-center text-white/60">
                                    <Plus size={13} />
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                    <div className="shrink-0 w-2" aria-hidden="true" />
                  </div>
                </>
              )}

              {/* Linha luminosa inferior */}
              <div className="h-px bg-gradient-to-r from-transparent via-white/15 to-transparent mb-2" aria-hidden="true" />
            </section>
          );
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
                    className={`group relative rounded-2xl overflow-hidden border flex flex-col touch-manipulation ${selectedProduct?.id === product.id ? 'border-emerald-500/60' : ''} ${isOutOfStock ? 'opacity-80' : ''}`}
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
                         {!isOutOfStock && !product.is_kit && product.stock <= 3 && (
                           <div
                             data-testid={`badge-last-pieces-${product.id}`}
                             style={{
                               position: 'absolute',
                               top: '0',
                               left: '0',
                               background: 'rgba(0, 0, 0, 0.52)',
                               backdropFilter: 'blur(20px) saturate(1.6)',
                               WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
                               borderBottom: '0.5px solid rgba(255,255,255,0.1)',
                               borderRight: '0.5px solid rgba(255,255,255,0.1)',
                               borderTopLeftRadius: 'inherit',
                               borderBottomRightRadius: '10px',
                               color: 'rgba(255,255,255,0.55)',
                               fontFamily: "'Anton', Impact, sans-serif",
                               fontSize: '9.5px',
                               fontWeight: '400',
                               letterSpacing: '0.18em',
                               textTransform: 'uppercase',
                               padding: '7px 12px 6px',
                               zIndex: 10,
                               transform: 'translateZ(0)',
                               display: 'flex',
                               alignItems: 'center',
                               gap: '7px',
                               lineHeight: 1,
                             }}
                           >
                             {(() => {
                               const realUnits = (product.sizes && product.sizes.length > 0)
                                 ? product.sizes.reduce((sum, s) => sum + (typeof s === 'string' ? product.stock : Number(s.stock || 0)), 0)
                                 : product.stock;
                               const isAlmostGone = realUnits <= 1;
                               return (
                                 <span style={{
                                   width: '5px', height: '5px', borderRadius: '50%', flexShrink: 0,
                                   background: isAlmostGone ? 'rgba(255,80,80,0.95)' : 'rgba(180,180,178,0.7)',
                                   boxShadow: isAlmostGone ? '0 0 6px rgba(255,80,80,0.5)' : 'none',
                                 }} />
                               );
                             })()}
                             Restam {product.stock}
                           </div>
                         )}
                         {/* Carrossel nativo — deslize para ver fotos adicionais */}
                         <div style={{ position: 'absolute', inset: 0, display: 'flex', overflowX: 'scroll', overflowY: 'hidden', scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch', overscrollBehaviorX: 'contain', msOverflowStyle: 'none', scrollbarWidth: 'none', touchAction: 'pan-x pan-y' }}>
                           {[product.image, ...((Array.isArray(product.gallery) ? product.gallery : []))].filter(Boolean).map((imgSrc, i) => (
                             <div key={i} style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always', flexShrink: 0, width: '100%', height: '100%', position: 'relative' }}>
                               <ProductImage src={imgSrc} alt={product.name} isOutOfStock={isOutOfStock} priority={idx < 4 && i === 0} />
                             </div>
                           ))}
                         </div>

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
                            <p className="leading-none" style={{ color: isOutOfStock ? 'var(--text-muted)' : '#F3F4F6', fontSize: '16px', fontFamily: "'DM Sans', sans-serif", fontWeight: '800', letterSpacing: '-0.01em', textDecoration: isOutOfStock ? 'line-through' : 'none' }}>
                              {formatBRL(product.price || 0)}
                            </p>
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
                          {/* Linha 3 — estrelas */}
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

      <footer className="mt-20 bg-zinc-900/50 border-t border-white/5 pt-14 pb-10 px-6 lg:px-16 w-full">
        <div className="max-w-2xl mx-auto space-y-12">

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
                {['Pix', 'Cartão', 'Boleto', 'Transferência'].map(m => (
                  <span key={m} className="text-[8px] font-black uppercase text-zinc-600 bg-zinc-900 border border-white/5 px-3 py-1.5 rounded-lg">{m}</span>
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
        return (
        <React.Fragment key={`product-modal-${selectedProduct.id}`}>
          {/* ── MOBILE: bottom sheet (oculto no desktop) ── */}
          <motion.div
            className="fixed inset-x-0 bottom-0 z-[100] flex items-end justify-center overflow-hidden lg:hidden"
            style={viewportOverlayStyle}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={() => { setSelectedProduct(null); setSelectedSizes({}); }} />
            <motion.div
              className="relative bg-zinc-950 w-full max-w-md rounded-t-[40px] border-t border-white/10 shadow-2xl overflow-hidden flex flex-col"
              style={{ maxHeight: viewportPanelMaxHeight }}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-white/30 rounded-full z-10 pointer-events-none" />
              <button onClick={() => { setSelectedProduct(null); setSelectedSizes({}); }} className="absolute top-4 right-4 z-20 text-white bg-black/50 backdrop-blur-md rounded-full p-2.5 touch-manipulation border border-white/10 active:scale-90 transition-transform"><X size={18}/></button>

              {/* Gallery — swipeable carousel with indicators */}
              <div className="relative w-full bg-zinc-900 pt-12 shrink-0">
                <div className="relative w-full aspect-[4/3] overflow-hidden">
                  <div
                    ref={mobileGalleryRef}
                    className="flex h-full overflow-x-auto snap-x snap-mandatory no-scrollbar carousel-scroll"
                    onScroll={(e) => {
                      const idx = Math.round(e.currentTarget.scrollLeft / (e.currentTarget.clientWidth || 1));
                      if (productGallery[idx] && productGallery[idx] !== activeProductImage) setActiveProductImage(productGallery[idx]);
                    }}
                  >
                    {productGallery.map((g, i) => (
                      <div key={i} className="snap-start snap-always flex-shrink-0 w-full h-full relative">
                        <img src={optimizeImage(g, 1200, 90)} className="w-full h-full object-cover" alt={selectedProduct.name} fetchPriority={i === 0 ? 'high' : 'low'} loading={i === 0 ? 'eager' : 'lazy'} draggable={false} />
                      </div>
                    ))}
                  </div>
                  {/* Dot indicators */}
                  {productGallery.length > 1 && (
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10 pointer-events-none">
                      {productGallery.map((g, i) => (
                        <div key={i} className={`rounded-full transition-all duration-300 ${heroImg === g ? 'w-5 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/40'}`} />
                      ))}
                    </div>
                  )}
                  <button onClick={() => setZoomImage(heroImg)} className="absolute bottom-3 right-3 text-[9px] font-black text-white bg-black/60 backdrop-blur-md rounded-full px-3 py-1.5 uppercase tracking-widest border border-white/10 flex items-center gap-1.5 touch-manipulation active:scale-95"><ZoomIn size={10}/> Ampliar</button>
                </div>
                {productGallery.length > 1 && (
                  <div className="shrink-0 px-4 py-3 flex gap-2 overflow-x-auto no-scrollbar bg-zinc-950 border-b border-white/5" style={{ touchAction: 'pan-x', overscrollBehaviorX: 'contain' }}>
                    {productGallery.map((g, i) => (
                      <button key={i} onClick={() => {
                          setActiveProductImage(g);
                          const idx = productGallery.indexOf(g);
                          if (mobileGalleryRef.current && idx !== -1) {
                            mobileGalleryRef.current.scrollTo({
                              left: idx * mobileGalleryRef.current.clientWidth,
                              behavior: 'smooth'
                            });
                          }
                        }} className={`shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${heroImg === g ? 'border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.5)] scale-105' : 'border-white/10 opacity-60'}`}>
                        <img src={optimizeImage(g, 300, 80)} className="w-full h-full object-cover" alt="" draggable={false} loading="lazy" decoding="async" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto px-7 pt-5 pb-32 flex flex-col gap-6">
                {/* Info */}
                <div className="flex flex-col gap-1">
                  <span className="text-[8px] font-black text-zinc-500 uppercase bg-zinc-900 px-2 py-1 rounded-md tracking-widest self-start">REF: {selectedProduct.sku}</span>
                  <h2 className="text-2xl font-black text-white leading-tight uppercase mt-2 tracking-tight">{selectedProduct.name}</h2>
                  {selectedProduct.promotional_price ? (
                    <div className="flex items-baseline gap-3 mt-2">
                      <span className="text-3xl font-black text-emerald-500 tracking-tighter">{formatBRL(selectedProduct.promotional_price)}</span>
                      <span className="text-base font-bold text-zinc-500 line-through">{formatBRL(selectedProduct.price || 0)}</span>
                    </div>
                  ) : (
                    <p className="text-3xl font-black text-emerald-500 mt-2 tracking-tighter">{formatBRL(selectedProduct.price || 0)}</p>
                  )}
                  <div className="mt-2">
                    <StarRatingInline
                      product={selectedProduct}
                      ratingsMap={ratingsMap}
                      userProfile={userProfile}
                      setRatingsMap={setRatingsMap}
                      setShowUserDrawer={setShowUserDrawer}
                      setDrawerTab={setDrawerTab}
                      showToast={showToast}
                    />
                  </div>
                </div>

                {/* Size selector — todos os tamanhos, esgotados visíveis como disabled */}
                <div className="space-y-3">
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Selecione o Tamanho</p>
                  <div className="grid grid-cols-4 gap-2">
                    {(selectedProduct.sizes || []).map((s, idx) => {
                      const sz = typeof s === 'string' ? s : s.size;
                      const stock = typeof s === 'string' ? selectedProduct.stock : Number(s.stock || 0);
                      const isEsgotado = stock <= 0;
                      const isLowStock = stock > 0 && stock <= 3;
                      const qty = selectedSizes[sz] || 0;
                      if (qty > 0) return (
                        <div key={idx} className="py-2.5 rounded-lg border-2 border-white bg-zinc-900 flex flex-col items-center justify-center gap-1.5">
                          <span className="text-xs font-black text-white">{sz}</span>
                          <div className="flex items-center gap-2 bg-zinc-950 rounded-md px-1 py-1 border border-zinc-800">
                            <button onClick={() => { const n = {...selectedSizes}; if(n[sz]>1) n[sz]--; else delete n[sz]; setSelectedSizes(n); }} className="text-zinc-400 touch-manipulation"><Minus size={10}/></button>
                            <span className="text-[10px] font-black text-white w-3 text-center">{qty}</span>
                            <button onClick={() => handleSizeSelect(sz, stock)} className="text-zinc-400 touch-manipulation"><Plus size={10}/></button>
                          </div>
                        </div>
                      );
                      return (
                        <button
                          key={idx}
                          disabled={isEsgotado}
                          onClick={() => !isEsgotado && handleSizeSelect(sz, stock)}
                          className={`py-3 rounded-lg border font-black text-sm transition-all touch-manipulation flex flex-col items-center justify-center gap-0.5 ${isEsgotado ? 'bg-zinc-900/40 border-zinc-800/50 cursor-not-allowed' : 'bg-zinc-900 border-zinc-800 text-zinc-300 active:scale-95'}`}
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
                <div className="grid grid-cols-3 gap-3 pt-2 border-t border-white/5">
                  <div className="flex flex-col items-center gap-1.5 text-center">
                    <div className="w-9 h-9 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center"><ShieldCheck size={14} className="text-emerald-500"/></div>
                    <span className="text-[8px] font-black text-zinc-500 uppercase tracking-wide leading-tight">Compra Segura</span>
                  </div>
                  <div className="flex flex-col items-center gap-1.5 text-center">
                    <div className="w-9 h-9 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center"><Truck size={14} className="text-emerald-500"/></div>
                    <span className="text-[8px] font-black text-zinc-500 uppercase tracking-wide leading-tight">Envio Rápido</span>
                  </div>
                  <div className="flex flex-col items-center gap-1.5 text-center">
                    <div className="w-9 h-9 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center"><MessageCircle size={14} className="text-emerald-500"/></div>
                    <span className="text-[8px] font-black text-zinc-500 uppercase tracking-wide leading-tight">Suporte WA</span>
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

              {/* Sticky CTA */}
              <div className="absolute bottom-0 left-0 right-0 px-7 py-4 bg-zinc-950/95 backdrop-blur-xl border-t border-white/10 z-10">
                <button
                  onClick={handleCommitToCart}
                  disabled={Object.keys(selectedSizes).length === 0}
                  className={`w-full py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 touch-manipulation ${Object.keys(selectedSizes).length === 0 ? 'bg-zinc-900 text-zinc-700' : 'bg-emerald-500 text-zinc-950 shadow-[0_10px_30px_rgba(16,185,129,0.3)] active:scale-[0.98]'}`}
                >
                  {Object.keys(selectedSizes).length === 0 ? 'Escolha um Tamanho' : `Adicionar à Sacola (${Object.values(selectedSizes).reduce((a,b)=>a+b,0)})`} <ShoppingBag size={14}/>
                </button>
              </div>
            </motion.div>
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
            <div className="h-20 lg:h-28" />

            {/* CONTEÚDO — container centralizado e limitado */}
            <div className="max-w-[1320px] mx-auto px-10 py-10 flex gap-12 items-start">

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
                      <button key={i} onClick={() => {
                          setActiveProductImage(g);
                          const idx = productGallery.indexOf(g);
                          if (desktopGalleryRef.current && idx !== -1) {
                            desktopGalleryRef.current.scrollTo({
                              left: idx * desktopGalleryRef.current.clientWidth,
                              behavior: 'smooth'
                            });
                          }
                        }} className={`shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition-all ${heroImg === g ? 'border-emerald-400 shadow-[0_0_16px_rgba(16,185,129,0.5)] scale-105' : 'border-white/10 opacity-50 hover:opacity-100'}`}>
                        <img src={optimizeImage(g, 300, 80)} className="w-full h-full object-cover" alt="" loading="lazy" decoding="async" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* COLUNA DIREITA — painel de compra fixo em largura */}
              <div className="w-[420px] shrink-0 flex flex-col">
                {/* X fechar */}
                <div className="flex justify-end mb-4">
                  <button
                    onClick={() => { setSelectedProduct(null); setSelectedSizes({}); }}
                    className="flex items-center gap-2 text-zinc-400 hover:text-white bg-zinc-900 border border-white/10 rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-widest transition-colors hover:bg-zinc-800"
                  >
                    <X size={14}/> Fechar
                  </button>
                </div>
              {selectedProduct.category && (
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] mb-4">
                  {selectedProduct.category}{selectedProduct.collection_name ? ` / ${selectedProduct.collection_name}` : ''}
                </p>
              )}
              <h1 className="text-4xl font-black text-white leading-tight uppercase tracking-tight mb-1">{selectedProduct.name}</h1>
              <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-6">REF: {selectedProduct.sku}</p>
              <p className="text-5xl font-black text-emerald-400 tracking-tighter mb-10">{formatBRL(selectedProduct.price || 0)}</p>

              <div className="mb-8">
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-3">Selecione o Tamanho</p>
                <div className="grid grid-cols-5 gap-2">
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

              <button onClick={handleCommitToCart} disabled={Object.keys(selectedSizes).length === 0} className={`w-full py-5 rounded-2xl font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-3 ${Object.keys(selectedSizes).length === 0 ? 'bg-zinc-900 text-zinc-600 cursor-not-allowed' : 'bg-emerald-500 text-zinc-950 shadow-[0_10px_40px_rgba(16,185,129,0.35)] hover:bg-emerald-400 hover:shadow-[0_10px_50px_rgba(16,185,129,0.5)]'}`}>
                {Object.keys(selectedSizes).length === 0 ? 'Escolha um Tamanho' : `Adicionar à Sacola — ${Object.values(selectedSizes).reduce((a,b)=>a+b,0)} ${Object.values(selectedSizes).reduce((a,b)=>a+b,0) === 1 ? 'peça' : 'peças'}`}
                <ShoppingBag size={16}/>
              </button>

              <div className="mt-10 pt-8 border-t border-white/5 grid grid-cols-3 gap-4">
                <div className="flex flex-col items-center gap-2 text-center">
                  <div className="w-10 h-10 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center"><ShieldCheck size={16} className="text-emerald-500"/></div>
                  <span className="text-[9px] font-black text-zinc-500 uppercase tracking-wider">Compra Segura</span>
                </div>
                <div className="flex flex-col items-center gap-2 text-center">
                  <div className="w-10 h-10 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center"><Truck size={16} className="text-emerald-500"/></div>
                  <span className="text-[9px] font-black text-zinc-500 uppercase tracking-wider">Envio Rápido</span>
                </div>
                <div className="flex flex-col items-center gap-2 text-center">
                  <div className="w-10 h-10 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center"><MessageCircle size={16} className="text-emerald-500"/></div>
                  <span className="text-[9px] font-black text-zinc-500 uppercase tracking-wider">Suporte WhatsApp</span>
                </div>
              </div>
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
      {cart.length > 0 && !showCart && !isCartModalOpen && (
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
                            <span className="font-black text-emerald-500 text-sm">{formatBRL(item.price || 0)}</span>
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
                <div className="space-y-2 mb-5">
                   <div className="flex justify-between items-center text-[11px] font-bold uppercase text-zinc-400"><span>Subtotal</span><span>{formatBRL(subtotal)}</span></div>
                   <div className="flex justify-between items-end pt-3 border-t border-white/10"><p className="text-[12px] font-black text-white uppercase tracking-widest">Total dos Itens</p><h3 className="text-3xl font-black text-emerald-500 tracking-tighter">{formatBRL(subtotal)}</h3></div>
                </div>
                <button onClick={() => { setShowCart(false); setShowLeadModal(true); }} className="w-full py-5 rounded-2xl font-black text-[11px] uppercase bg-white text-zinc-950 active:scale-95 shadow-2xl flex items-center justify-center gap-2 touch-manipulation">Finalizar Pedido <Lock size={14}/></button>
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
                   <div className="space-y-1"><label className="text-[9px] font-black uppercase text-zinc-500 px-2 tracking-widest">WhatsApp (Com DDD)</label><input placeholder="Ex: 34999999999" type="tel" className="w-full p-4 bg-zinc-900 border border-white/5 rounded-xl text-[16px] font-bold text-white outline-none focus:border-white/30 shadow-inner client-input" value={currentLead.phone} onChange={e => setCurrentLead({...currentLead, phone: e.target.value.replace(/\D/g, '')})} /></div>
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
