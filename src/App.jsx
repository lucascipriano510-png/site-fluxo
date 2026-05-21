import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  Plus, Minus, Trash2, X, Search, LayoutDashboard, 
  ShoppingBag, Home, Power, Package, 
  TrendingUp, Box, MessageCircle,
  Zap, Share2, Info, Star, ChevronRight, ChevronLeft,
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

// ==========================================
// 1. CONFIGURAÇÃO E DADOS INICIAIS
// ==========================================
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatBRL = (v) => BRL.format(Number(v) || 0);
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

const useScrollBounceGuard = () => {
  useEffect(() => {
    let startY = 0;
    const getScrollable = (target) => {
      let el = target instanceof Element ? target : null;
      while (el && el !== document.body && el !== document.documentElement) {
        const style = window.getComputedStyle(el);
        const canScroll = /(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight;
        if (canScroll) return el;
        el = el.parentElement;
      }
      return document.scrollingElement || document.documentElement;
    };
    const onTouchStart = (event) => {
      if (event.touches.length !== 1) return;
      startY = event.touches[0].clientY;
    };
    const onTouchMove = (event) => {
      if (event.touches.length !== 1) return;
      const scrollable = getScrollable(event.target);
      const deltaY = event.touches[0].clientY - startY;
      const atTop = scrollable.scrollTop <= 0;
      const atBottom = scrollable.scrollTop + scrollable.clientHeight >= scrollable.scrollHeight - 1;
      if ((atTop && deltaY > 0) || (atBottom && deltaY < 0)) event.preventDefault();
    };
    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
    };
  }, []);
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
// Unsplash já oferece query params; demais URLs passam pelo proxy gratuito wsrv.nl.
const optimizeImage = (src, width = 600, quality = 70) => {
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
    // Proxy universal: serve em WebP, redimensiona e cacheia globalmente.
    const clean = src.replace(/^https?:\/\//, '');
    return `https://wsrv.nl/?url=${encodeURIComponent(clean)}&w=${width}&q=${quality}&output=webp&we`;
  } catch {
    return src;
  }
};

const buildSrcSet = (src, widths = [400, 600, 900]) =>
  widths.map((w) => `${optimizeImage(src, w)} ${w}w`).join(', ');

const ProductImage = ({ src, alt, isOutOfStock, priority = false }) => {
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

  return (
    <div ref={wrapperRef} className="absolute inset-0">
      {!loaded && <div className="absolute inset-0 bg-zinc-800 animate-pulse" />}
      {inView && (
        <img
          src={optimizeImage(src, 600)}
          srcSet={buildSrcSet(src)}
          sizes="(max-width: 640px) 50vw, 300px"
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={priority ? 'high' : 'low'}
          onLoad={() => setLoaded(true)}
          className={`w-full h-full object-cover transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'} ${isOutOfStock ? 'grayscale opacity-40' : 'group-hover:scale-105'} transition-transform`}
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
        src={optimizeImage(src, 900, 75)}
        srcSet={buildSrcSet(src, [600, 900, 1200])}
        sizes="(max-width: 640px) 100vw, 448px"
        className={`w-full h-full object-cover opacity-80 transition-opacity duration-300 ${loaded ? 'opacity-80' : 'opacity-0'}`}
        alt={alt}
        loading={active ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={active ? 'high' : 'low'}
        onLoad={() => setLoaded(true)}
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
  
  const lowStockProducts = (products || []).filter(p => !p.is_kit && p.stock > 0 && p.stock <= 3);
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

      {(lowStockProducts.length > 0 || outOfStockProducts.length > 0) && (
        <div className="bg-zinc-900/50 p-6 rounded-[32px] border border-red-500/10 space-y-4">
           <h4 className="font-black text-[11px] uppercase tracking-widest text-white flex items-center gap-2"><AlertTriangle size={14} className="text-amber-500"/> Alertas de Estoque</h4>
           <div className="space-y-3">
              {outOfStockProducts.map(p => (
                <div key={p.id} className="flex justify-between items-center bg-red-500/10 px-4 py-3 rounded-2xl border border-red-500/20">
                  <span className="text-[10px] font-bold text-white uppercase truncate pr-4">{p.name}</span>
                  <span className="text-[9px] font-black bg-red-500 text-white px-2 py-1 rounded-full shrink-0">ESGOTADO</span>
                </div>
              ))}
              {lowStockProducts.map(p => (
                <div key={p.id} className="flex justify-between items-center bg-amber-500/10 px-4 py-3 rounded-2xl border border-amber-500/20">
                  <span className="text-[10px] font-bold text-white uppercase truncate pr-4">{p.name}</span>
                  <span className="text-[9px] font-black text-amber-500 shrink-0">Resta(m) {p.stock}</span>
                </div>
              ))}
           </div>
        </div>
      )}
    </div>
  );
};

const AdminInventory = ({ products, setProducts, showToast, availableCollections, productImageFile, setProductImageFile, uploadImage }) => {
  const [editMode, setEditMode] = useState(null); 
  const [invSearch, setInvSearch] = useState('');
  const [previewImage, setPreviewImage] = useState('');
  const [formSizes, setFormSizes] = useState([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

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
      // Carrega componentes do kit do banco
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
    }
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
        name: fd.get('name'),
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
        <form onSubmit={handleSave} className="bg-zinc-900 p-8 rounded-[40px] border border-white/10 space-y-4 shadow-2xl relative">
          <button type="button" onClick={() => { setEditMode(null); setPreviewImage(''); }} className="absolute top-6 right-6 text-zinc-500 hover:text-white"><X/></button>
          <h3 className="font-black italic uppercase tracking-tighter text-xl text-white mb-6">{editMode === 'new' ? 'Novo Produto' : 'Editar Produto'}</h3>
          <div className="relative group overflow-hidden bg-zinc-950 border-2 border-dashed border-white/10 rounded-[32px] aspect-video flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-emerald-500/50 transition-all">
            {previewImage ? (
              <img src={previewImage} className="absolute inset-0 w-full h-full object-cover opacity-60" alt="Preview" />
            ) : (
              <ImageIcon size={40} className="text-zinc-800" />
            )}
            <div className="relative z-10 flex flex-col items-center">
              <Upload size={24} className="text-emerald-500 mb-2" />
              <span className="text-[10px] font-black uppercase tracking-widest text-white">Carregar Imagem</span>
            </div>
            <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" />
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="col-span-2 space-y-1">
               <label className="text-[9px] font-black text-zinc-500 uppercase px-2">Nome</label>
               <input name="name" defaultValue={editMode?.name} className="w-full p-4 bg-zinc-950 border border-white/5 rounded-2xl font-bold text-sm text-white focus:border-emerald-500/50 outline-none" required />
            </div>
            <div className="space-y-1">
               <label className="text-[9px] font-black text-zinc-500 uppercase px-2">SKU (Código Barras)</label>
               <input name="sku" defaultValue={editMode?.sku} className="w-full p-4 bg-zinc-950 border border-white/5 rounded-2xl font-bold text-sm text-white focus:border-emerald-500/50 outline-none" required />
            </div>
            <div className="space-y-1">
               <label className="text-[9px] font-black text-zinc-500 uppercase px-2">Preço (R$)</label>
               <input name="price" type="number" step="0.01" defaultValue={editMode?.price} className="w-full p-4 bg-zinc-950 border border-white/5 rounded-2xl font-bold text-sm text-white focus:border-emerald-500/50 outline-none" required />
            </div>
             <div className="col-span-2 space-y-1">
               <label className="text-[9px] font-black text-zinc-500 uppercase px-2">Categoria</label>
	              <input name="category" defaultValue={editMode?.category} placeholder={isKit ? 'KITS (automático)' : 'Categoria (ex: VESTUÁRIO)'} disabled={isKit} className="w-full p-4 bg-zinc-950 border border-white/5 rounded-2xl text-sm text-white outline-none uppercase disabled:opacity-50" required={!isKit} />
	            </div>
	            <div className="col-span-2 space-y-1">
	               <label className="text-[9px] font-black text-zinc-500 uppercase px-2">Subcategoria (Opcional)</label>
	              <input name="subcategory" defaultValue={editMode?.subcategory || ''} placeholder="Ex: CALÇA JOGADOR" className="w-full p-4 bg-zinc-950 border border-white/5 rounded-2xl text-sm text-white outline-none uppercase" />
	            </div>
	            <div className="col-span-2 space-y-1">
	               <label className="text-[9px] font-black text-zinc-500 uppercase px-2">Vincular à Coleção (Opcional)</label>
	               <select name="collection_name" defaultValue={editMode?.collection_name || ""} className="w-full p-4 bg-zinc-950 border border-white/5 rounded-2xl text-sm text-white outline-none uppercase appearance-none cursor-pointer focus:border-emerald-500/50">
	                 <option value="">Nenhuma Coleção</option>
	                 {availableCollections.map(c => (
	                   <option key={c} value={c}>{c}</option>
	                 ))}
	               </select>
	            </div>
            {/* TOGGLE — É um Kit? */}
            <div className="col-span-2 flex items-center gap-3 bg-gradient-to-r from-amber-500/10 to-pink-500/10 p-4 rounded-2xl border border-amber-400/30 mt-2 cursor-pointer" onClick={() => setIsKit(v => !v)}>
              <div className={`w-11 h-6 rounded-full p-0.5 transition-all ${isKit ? 'bg-gradient-to-r from-amber-400 to-pink-500' : 'bg-zinc-800'}`}>
                <div className={`w-5 h-5 rounded-full bg-white transition-transform ${isKit ? 'translate-x-5' : ''}`} />
              </div>
              <div className="flex-1">
                <p className="text-[11px] font-black uppercase text-white flex items-center gap-1.5"><Zap size={12} className="text-amber-400 fill-amber-400" /> É um KIT (Bundle)</p>
                <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wide">{isKit ? 'Estoque/tamanhos vêm dos itens vinculados' : 'Produto único com tamanhos próprios'}</p>
              </div>
            </div>

            {!isKit && (
              <div className="col-span-2 bg-zinc-950 p-4 rounded-[20px] border border-white/5 space-y-3 mt-2">
                 <label className="text-[9px] font-black text-emerald-500 uppercase flex items-center gap-1"><Layers size={12}/> Grade de Tamanhos</label>
                 {formSizes.map((item, idx) => (
                   <div key={idx} className="flex gap-2 items-center animate-in">
                     <input placeholder="Tam." className="w-1/2 p-3 bg-zinc-900 border border-white/5 rounded-xl font-bold text-sm text-white uppercase outline-none" value={item.size} onChange={(e) => handleSizeChange(idx, 'size', e.target.value)} required />
                     <input type="number" placeholder="Qtd" className="w-1/2 p-3 bg-zinc-900 border border-white/5 rounded-xl font-bold text-sm text-white outline-none" value={item.stock} onChange={(e) => handleSizeChange(idx, 'stock', e.target.value)} required />
                     <button type="button" onClick={() => removeSize(idx)} className="p-3 text-red-500 bg-red-500/5 rounded-xl transition-colors border border-red-500/10"><X size={16}/></button>
                   </div>
                 ))}
                 <button type="button" onClick={addSize} className="w-full py-3 mt-2 border border-dashed border-white/10 rounded-xl text-[10px] font-black uppercase text-zinc-500 hover:text-white transition-all">+ Adicionar</button>
              </div>
            )}

            {/* GALERIA — sempre disponível (imagens adicionais além da principal) */}
            <div className="col-span-2 bg-zinc-950 p-4 rounded-[20px] border border-white/5 space-y-3 mt-2">
              <label className="text-[9px] font-black text-emerald-500 uppercase flex items-center gap-1">
                <ImagePlus size={12}/> {isKit ? `Galeria do Kit (${galleryUrls.length})` : `Fotos extras (${galleryUrls.length})`}
              </label>
              <p className="text-[9px] text-zinc-500 font-bold">
                {isKit ? 'Imagens auxiliares mostrando cada peça.' : 'Ângulos diferentes da peça. A foto principal permanece em destaque.'}
              </p>
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

            {isKit && (
              <>
                {/* MULTI-SELECT DE PRODUTOS */}
                <div className="col-span-2 bg-zinc-950 p-4 rounded-[20px] border border-amber-400/20 space-y-3 mt-2">
                  <label className="text-[9px] font-black text-amber-400 uppercase flex items-center gap-1"><Layers size={12}/> Peças do Kit ({kitComponentIds.length})</label>
                  <input
                    value={kitSearch}
                    onChange={(e) => setKitSearch(e.target.value)}
                    placeholder="Buscar por nome ou SKU..."
                    className="w-full p-3 bg-zinc-900 border border-white/5 rounded-xl text-sm text-white outline-none focus:border-amber-400/50"
                  />
                  <div className="max-h-72 overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
                    {(products || [])
                      .filter(p => !p.is_kit && (
                        !kitSearch.trim() ||
                        (p.name || '').toLowerCase().includes(kitSearch.toLowerCase()) ||
                        (p.sku || '').toLowerCase().includes(kitSearch.toLowerCase())
                      ))
                      .map(p => {
                        const selected = kitComponentIds.includes(p.id);
                        return (
                          <button
                            type="button"
                            key={p.id}
                            onClick={() => toggleKitComponent(p.id)}
                            className={`w-full flex items-center gap-3 p-2 rounded-xl border transition-all text-left ${selected ? 'bg-amber-400/10 border-amber-400/60' : 'bg-zinc-900 border-white/5 hover:border-white/15'}`}
                          >
                            <div className={`w-5 h-5 rounded grid place-items-center border-2 shrink-0 ${selected ? 'bg-amber-400 border-amber-400' : 'border-zinc-600'}`}>
                              {selected && <Check size={12} className="text-zinc-950" strokeWidth={3}/>}
                            </div>
                            <img src={p.image} className="w-10 h-10 rounded-lg object-cover border border-white/5" alt="" />
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-black uppercase text-white truncate">{p.name}</p>
                              <p className="text-[9px] text-zinc-500 font-bold">{p.sku} · {formatBRL(p.price || 0)}</p>
                            </div>
                          </button>
                        );
                      })}
                    {(products || []).filter(p => !p.is_kit).length === 0 && (
                      <p className="text-[10px] text-zinc-500 text-center py-4">Nenhum produto disponível.</p>
                    )}
                  </div>
                </div>
              </>
            )}

            <div className="col-span-2 flex items-center gap-3 bg-zinc-950 p-4 rounded-2xl border border-white/5 mt-2 cursor-pointer" onClick={() => document.getElementById('f-check').click()}>
              <input type="checkbox" name="featured" id="f-check" defaultChecked={editMode?.featured} className="w-5 h-5 accent-emerald-500" />
              <label className="text-[11px] font-black uppercase text-white">Destaque na Home</label>
            </div>
          </div>
          <button type="submit" disabled={isUploadingImage} className={`w-full py-5 rounded-[28px] font-black uppercase text-[11px] tracking-widest mt-6 shadow-[0_0_20px_rgba(16,185,129,0.2)] ${isUploadingImage ? 'bg-zinc-800 text-zinc-500' : 'bg-emerald-500 text-zinc-950 active:scale-95'}`}>
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
        active: fd.get('active') === 'on' 
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
              <div className="flex-1 truncate"><h4 className="font-black text-white text-[10px] uppercase truncate">{b.title}</h4></div>
              <div className="flex gap-1"><button onClick={() => setEditBannerMode(b)} className="p-2 bg-white/5 rounded-lg text-zinc-400"><Edit3 size={12}/></button><button onClick={() => setBanners((banners || []).filter(i => i.id !== b.id))} className="p-2 bg-red-500/10 rounded-lg text-red-500"><Trash2 size={12}/></button></div>
            </div>
          ))}
        </div>
      ) : (
        <form onSubmit={handleSaveBanner} className="bg-zinc-900 p-8 rounded-[32px] border border-white/10 space-y-4 shadow-2xl relative">
          <button type="button" onClick={() => setEditBannerMode(null)} className="absolute top-6 right-6 text-zinc-500"><X/></button>
          <div className="relative overflow-hidden bg-zinc-950 border-2 border-dashed border-white/10 rounded-[20px] aspect-video flex flex-col items-center justify-center cursor-pointer">
            {previewBannerImage ? <img src={previewBannerImage} className="absolute inset-0 w-full h-full object-cover opacity-60" alt="Preview" /> : <ImagePlus size={32} className="text-zinc-800" />}
            <span className="relative z-10 text-[9px] font-black uppercase text-white">Carregar Banner 16:9</span>
            <input type="file" accept="image/*" onChange={handleBannerFileChange} className="absolute inset-0 opacity-0 cursor-pointer" />
          </div>
          <input name="title" defaultValue={editBannerMode?.title} placeholder="Título" className="w-full p-4 bg-zinc-950 border border-white/5 rounded-2xl text-sm text-white outline-none" required />
          <input name="subtitle" defaultValue={editBannerMode?.subtitle} placeholder="Subtítulo" className="w-full p-4 bg-zinc-950 border border-white/5 rounded-2xl text-sm text-white outline-none" />
	          <input name="buttonText" defaultValue={editBannerMode?.buttonText || 'VER PEÇAS'} className="w-full p-4 bg-zinc-950 border border-white/5 rounded-2xl text-sm text-white outline-none uppercase" required />
	          <div className="space-y-1">
	            <label className="text-[9px] font-black text-zinc-500 uppercase px-2">Nome da Coleção (Ex: Lacoste)</label>
	            <input name="collection_name" defaultValue={editBannerMode?.collection_name} placeholder="Digite o nome da coleção..." className="w-full p-4 bg-zinc-950 border border-white/5 rounded-2xl text-sm text-white outline-none uppercase" />
	          </div>
          <label className="flex items-center gap-3 bg-zinc-950 p-4 rounded-2xl border border-white/5"><input type="checkbox" name="active" defaultChecked={editBannerMode === 'new' ? true : editBannerMode?.active} className="w-5 h-5 accent-emerald-500" /><span className="text-[11px] font-black uppercase text-white">Ativo no site</span></label>
          <button type="submit" disabled={isUploadingBanner} className="w-full py-4 bg-emerald-500 text-zinc-950 rounded-[20px] font-black uppercase text-[10px] tracking-widest">{isUploadingBanner ? 'Salvando...' : 'Confirmar'}</button>
        </form>
      )}
    </div>
  );
};

const AdminConfig = ({ config, setConfig, showToast }) => {
  const [logoPreview, setLogoPreview] = useState(config.logoUrl || '');
  const [logoZoomPreview, setLogoZoomPreview] = useState(config.logoZoom || 1.5);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [phrases, setPhrases] = useState(config.marqueePhrases || []);

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
      marqueePhrases: phrases.filter(p => p.trim() !== '')
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
        
        <button type="submit" disabled={isUploadingLogo} className="w-full py-5 bg-white text-zinc-950 rounded-[28px] font-black uppercase text-[11px] tracking-widest active:scale-95 shadow-xl">{isUploadingLogo ? 'Processando...' : 'Aplicar Mudanças'}</button>
      </form>
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
        style={{ maxHeight: visualFrame.height ? `calc(${visualFrame.height}px - 10px)` : 'calc(100dvh - 10px)', overscrollBehavior: 'contain', touchAction: 'pan-y' }}
      >

        {/* GALERIA com zoom inline (hover desktop / press-hold mobile) */}
        <div className="relative w-full bg-gradient-to-b from-zinc-900 to-zinc-950 shrink-0">
          <div
            className="relative block w-full aspect-square overflow-hidden select-none cursor-zoom-in"
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
              src={activeImage}
              className={`w-full h-full object-cover transition-opacity duration-200 ${zoomActive ? 'opacity-0' : 'opacity-100'}`}
              alt={kit.name}
              draggable={false}
            />
            <div
              className={`absolute inset-0 transition-opacity duration-200 ${zoomActive ? 'opacity-100' : 'opacity-0'}`}
              style={{
                backgroundImage: `url(${activeImage})`,
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
          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-white/30 rounded-full backdrop-blur-md pointer-events-none" />
          <button onClick={onClose} className="absolute top-4 right-4 text-white bg-black/50 backdrop-blur-md rounded-full p-2.5 touch-manipulation border border-white/10 active:scale-90 transition-transform z-10">
            <X size={18}/>
          </button>
          <div className="absolute top-4 left-4 bg-gradient-to-r from-amber-400 to-pink-500 text-zinc-950 text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full flex items-center gap-1 shadow-[0_4px_15px_rgba(251,191,36,0.4)] pointer-events-none">
            <Zap size={10} className="fill-zinc-950" /> KIT
          </div>
        </div>

        {/* THUMBS — sempre visível, scroll só horizontal */}
        {gallery.length > 1 && (
          <div
            className="shrink-0 px-4 py-3 flex gap-2 overflow-x-auto overflow-y-hidden no-scrollbar bg-zinc-950 border-b border-white/5"
            style={{ touchAction: 'pan-x', overscrollBehavior: 'contain' }}
          >
            {gallery.map((g, i) => (
              <button
                key={i}
                onClick={() => setActiveImage(g)}
                className={`shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${activeImage === g ? 'border-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.5)] scale-105' : 'border-white/10 opacity-70 hover:opacity-100'}`}
              >
                <img src={g} className="w-full h-full object-cover" alt="" draggable={false} />
              </button>
            ))}
          </div>
        )}

        {/* CONSTRUTOR DO KIT — INFO + itens rolam juntos; sem pull-to-refresh */}
        <div
          className="flex-1 overflow-y-auto custom-scrollbar"
          style={{ overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}
        >
          {/* INFO (rola junto) */}
          <div className="px-7 pt-4 pb-2">
            <span className="text-[8px] font-black text-zinc-500 uppercase bg-zinc-900 px-2 py-1 rounded-md tracking-widest">REF: {kit.sku}</span>
            <h2 className="text-xl font-black text-white leading-tight uppercase mt-2 tracking-tight">{kit.name}</h2>
            <p className="text-[10px] text-zinc-500 uppercase font-black mt-2 tracking-widest flex items-center gap-1.5">
              <Layers size={11} className="text-amber-400" /> Monte seu kit — {includedItems.length}/{components.length} peças
            </p>
          </div>

          <div className="px-5 py-3 space-y-3">
          {components.map(c => {
            const included = picks[c.id]?.included;
            const chosenSize = picks[c.id]?.size || '';
            const sizes = (c.sizes || []).map(s => ({
              name: String((typeof s === 'string' ? s : s.size) || '').trim().toUpperCase(),
              stock: typeof s === 'string' ? Number(c.stock || 0) : Number(s.stock || 0),
            })).filter(s => s.name);
            const isMissing = !!missingFlash[c.id];
            return (
              <div key={c.id} className={`relative rounded-2xl border transition-all p-3 ${included ? (isMissing ? 'bg-red-500/10 border-red-500 animate-pulse' : 'bg-zinc-900/70 border-white/10') : 'bg-zinc-900/30 border-white/5 opacity-50'}`}>
                <div className="flex gap-3">
                  <img src={c.image} className={`w-16 h-20 rounded-xl object-cover shrink-0 border border-white/10 ${!included ? 'grayscale' : ''}`} alt={c.name} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-black text-white text-[11px] uppercase leading-tight line-clamp-2">{c.name}</h4>
                      <button
                        onClick={() => togglePick(c.id)}
                        className={`shrink-0 w-6 h-6 rounded-md border-2 grid place-items-center transition-all ${included ? 'bg-emerald-500 border-emerald-500 text-zinc-950' : 'bg-transparent border-zinc-600 text-transparent'}`}
                        aria-label={included ? 'Remover do kit' : 'Adicionar ao kit'}
                      >
                        <Check size={14} strokeWidth={3} />
                      </button>
                    </div>
                    <p className={`font-black text-sm mt-1 ${included ? 'text-emerald-400' : 'text-zinc-500 line-through'}`}>{formatBRL(c.price || 0)}</p>
                    {included && (
                      <div className="flex gap-1.5 mt-2 flex-wrap">
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
                                  ? 'bg-white text-zinc-950 border-white'
                                  : disabled
                                    ? 'bg-zinc-950 text-zinc-700 border-white/5 opacity-50'
                                    : 'bg-zinc-950 text-zinc-300 border-white/10 hover:border-white/30'
                              }`}
                            >
                              {s.name}
                            </button>
                          );
                        })}
                      </div>
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
  const [toast, setToast] = useState(null);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [whatsappLink, setWhatsappLink] = useState('');
  const [checkoutOrderNumber, setCheckoutOrderNumber] = useState('');
  const [currentBannerSlide, setCurrentBannerSlide] = useState(0);
  const [activeCollectionFilter, setActiveCollectionFilter] = useState(null);
  const [adminTab, setAdminTab] = useState('dashboard'); 
  const visualFrame = useVisualViewportFrame();
  useScrollBounceGuard();
  const viewportOverlayStyle = { top: visualFrame.top, height: visualFrame.height || '100dvh' };
  const viewportPanelMaxHeight = visualFrame.height ? `calc(${visualFrame.height}px - 10px)` : 'calc(100dvh - 10px)';

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
  const availableCollections = useMemo(() => {
    const set = new Set();
    (banners || []).forEach(b => { if (b.collection_name) set.add(b.collection_name); });
    return Array.from(set).sort();
  }, [banners]);
  useEffect(() => {
    if (isAdmin || activeBanners.length <= 1) return;
    const timer = setInterval(() => { setCurrentBannerSlide((prev) => (prev + 1) % activeBanners.length); }, 5000);
    return () => clearInterval(timer);
    // currentBannerSlide aqui força o timer a reiniciar quando o usuário navega manualmente
  }, [activeBanners.length, isAdmin, currentBannerSlide]);

  const goToBannerSlide = (idx) => {
    if (!activeBanners.length) return;
    const total = activeBanners.length;
    setCurrentBannerSlide(((idx % total) + total) % total);
  };
  const nextBannerSlide = () => goToBannerSlide(currentBannerSlide + 1);
  const prevBannerSlide = () => goToBannerSlide(currentBannerSlide - 1);

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

      const { error } = await supabase.from('orders').insert([payload]);
      if (error) throw new Error(error.message);

      // Monta mensagem WhatsApp
      const itemsText = itensNormalizados
        .map((item) => `• ${item.name} | Tam: ${item.size} | R$ ${item.price.toFixed(2)} x${item.qty}`)
        .join('\n');
      const message = `Olá, acabei de finalizar meu pedido na ${config.brandName}.\n\nCliente: ${customerName}\nWhatsApp: ${customerPhone}\n\nItens:\n${itemsText}\n\nTotal: R$ ${totalPedido.toFixed(2)}\nPedido: #${orderNum}`;

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

  // Se a subcategoria selecionada deixar de existir após trocar de categoria, reseta.
  // Só depois que produtos carregarem — evita matar sub vinda da URL.
  useEffect(() => {
    if (!products || products.length === 0) return;
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
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE));
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * PRODUCTS_PER_PAGE;
    return filteredProducts.slice(start, start + PRODUCTS_PER_PAGE);
  }, [filteredProducts, currentPage]);

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

  // Se a categoria mudar e o tamanho selecionado não existir mais, volta para "TODOS"
  // IMPORTANTE: só roda depois que os produtos carregarem — evita resetar um filtro
  // vindo da URL (?tamanho=GG) antes do catálogo estar disponível.
  useEffect(() => {
    if (!products || products.length === 0) return;
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

  if (isAdmin) {
    return (
      <div className="app-shell min-h-screen bg-zinc-950 font-sans text-zinc-100 pb-20 selection:bg-emerald-500 selection:text-zinc-950">
        <AdminHeader handleLogout={handleLogout} handleBackToStore={handleBackToStore} />
        <main className="max-w-md mx-auto">
          <AdminTabErrorBoundary resetKey={adminTab}>
            {adminTab === 'dashboard' && <AdminDashboard leads={leads} products={products} />}
            {adminTab === 'inventory' && <AdminInventory products={products} setProducts={setProducts} showToast={showToast} availableCollections={availableCollections} productImageFile={productImageFile} setProductImageFile={setProductImageFile} uploadImage={uploadImage} />}
            {adminTab === 'leads' && <AdminLeads leads={leads} setLeads={setLeads} products={products} setProducts={setProducts} showToast={showToast} config={config} />}
            {adminTab === 'banners' && <AdminBanners banners={banners} setBanners={setBanners} showToast={showToast} bannerImageFile={bannerImageFile} setBannerImageFile={setBannerImageFile} uploadImage={uploadImage} />}
            {adminTab === 'config' && <AdminConfig config={config} setConfig={setConfig} showToast={showToast} />}
            {adminTab === 'rastreio' && <AdminRastreio />}
          </AdminTabErrorBoundary>
        </main>
        <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md bg-zinc-900/95 backdrop-blur-xl px-4 py-4 rounded-3xl flex items-center justify-between shadow-[0_20px_50px_rgba(0,0,0,0.8)] z-50 border border-white/10">
          <button onClick={() => setAdminTab('dashboard')} className={`flex flex-col items-center gap-1 transition-colors ${adminTab === 'dashboard' ? 'text-emerald-500' : 'text-zinc-500'}`}><LayoutDashboard size={18}/><span className="text-[8px] font-black uppercase">Painel</span></button>
          <button onClick={() => setAdminTab('inventory')} className={`flex flex-col items-center gap-1 transition-colors ${adminTab === 'inventory' ? 'text-emerald-500' : 'text-zinc-500'}`}><Box size={18}/><span className="text-[8px] font-black uppercase">Estoque</span></button>
          <button onClick={() => { setAdminTab('leads'); setNewOrdersCount(0); }} className={`flex flex-col items-center gap-1 transition-colors relative ${adminTab === 'leads' ? 'text-emerald-500' : 'text-zinc-500'}`}>
            <User size={18}/>
            {newOrdersCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[9px] font-black min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center border-2 border-zinc-900 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.6)]">
                {newOrdersCount > 99 ? '99+' : newOrdersCount}
              </span>
            )}
            <span className="text-[8px] font-black uppercase">CRM</span>
          </button>
          <button onClick={() => setAdminTab('banners')} className={`flex flex-col items-center gap-1 transition-colors ${adminTab === 'banners' ? 'text-emerald-500' : 'text-zinc-500'}`}><Megaphone size={18}/><span className="text-[8px] font-black uppercase">Promo</span></button>
          <button onClick={() => setAdminTab('config')} className={`flex flex-col items-center gap-1 transition-colors ${adminTab === 'config' ? 'text-emerald-500' : 'text-zinc-500'}`}><Settings size={18}/><span className="text-[8px] font-black uppercase">Setup</span></button>
          <button onClick={() => setAdminTab('rastreio')} className={`flex flex-col items-center gap-1 transition-colors ${adminTab === 'rastreio' ? 'text-emerald-500' : 'text-zinc-500'}`}><Database size={18}/><span className="text-[8px] font-black uppercase">CAPI</span></button>
        </nav>
      </div>
    );
  }

  return (
    <div className="app-shell min-h-screen bg-zinc-950 font-sans text-white pb-0 overflow-x-hidden selection:bg-emerald-500 selection:text-zinc-950">
      
      {/* LETREIRO SUPERIOR DINÂMICO */}
      {(config.marqueePhrases || []).length > 0 && (
        <div className="bg-[#A8A8A9] text-black overflow-hidden py-2.5 relative flex items-center justify-center border-b border-black/10">
          <div className="animate-marquee whitespace-nowrap text-[9px] font-black uppercase tracking-[0.25em] flex gap-12">
            {config.marqueePhrases.map((ph, i) => (<span key={i}>✦ {ph}</span>))}
            {config.marqueePhrases.map((ph, i) => (<span key={`dup-${i}`}>✦ {ph}</span>))}
          </div>
        </div>
      )}

      {toast && <div className="fixed top-28 left-1/2 -translate-x-1/2 z-[200] animate-slide-down"><div className="px-6 py-3 rounded-full font-black text-[10px] uppercase bg-white text-zinc-950 shadow-2xl">{toast.message}</div></div>}

      <header className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-2xl border-b border-white/5 px-6 py-2 flex justify-between items-center shadow-[0_10px_30px_rgba(0,0,0,0.5)] h-20">
        <button className="p-2 text-zinc-400 hover:text-white shrink-0 touch-manipulation" onClick={() => document.getElementById('search-input').focus()} data-testid="btn-header-search"><Search size={22} /></button>
        
        <div className="cursor-default select-none flex-1 flex flex-col items-center justify-center mx-2 h-full relative overflow-hidden pointer-events-none">
          {config.logoUrl ? (
             <img src={config.logoUrl} alt={config.brandName} style={{ transform: `scale(${config.logoZoom || 1.5})` }} className="h-full w-auto max-w-full object-contain mix-blend-screen transition-transform" />
          ) : (
             <h1 className="logo-font text-xl text-white font-black italic uppercase text-center">{config.brandName}</h1>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => setShowMyOrders(true)} data-testid="btn-header-my-orders" className="p-2 text-zinc-400 hover:text-emerald-500 transition-colors touch-manipulation" title="Meus Pedidos">
            <ClipboardList size={20} />
          </button>
          <button onClick={() => setShowCart(true)} data-testid="btn-header-cart" className={`relative p-2 text-white hover:text-emerald-500 touch-manipulation transition-transform ${cartBounce ? 'scale-125 text-emerald-500' : 'scale-100'}`}>
            <ShoppingBag size={24} />
            {cart.length > 0 && <span className="absolute top-0 right-0 bg-emerald-500 text-zinc-950 text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-zinc-950 shadow-[0_0_10px_rgba(16,185,129,0.5)]">{cart.reduce((a,i)=>a+i.quantity,0)}</span>}
          </button>
        </div>
      </header>

      {(activeBanners.length > 0 || !bannersLoaded) && (
        <section className="relative w-full max-w-md mx-auto aspect-[4/5] sm:aspect-video bg-black overflow-hidden group">
          {activeBanners.length === 0 && <div className="absolute inset-0 bg-black" />}
          <div className="flex h-full transition-transform duration-700 ease-in-out" style={{ transform: `translateX(-${currentBannerSlide * 100}%)` }}>
            {activeBanners.map((banner, idx) => (
              <div key={idx} className="w-full h-full shrink-0 relative">
                <BannerImage src={banner.image} alt={banner.title || 'Banner'} active={idx === currentBannerSlide} />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent"></div>
                <div className="absolute inset-x-0 bottom-0 p-8 flex flex-col items-center text-center animate-slide-up">
                  <h2 className="text-3xl font-black uppercase tracking-tighter drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)]" style={{ color: '#9aa0a6' }}>{banner.title}</h2>
                  <p className="text-xs font-medium uppercase tracking-widest mt-2 mb-6 drop-shadow-md" style={{ color: '#9aa0a6' }}>{banner.subtitle}</p>
                  <button 
                    onClick={() => {
                      if (banner.collection_name) {
                        setActiveCollectionFilter(banner.collection_name);
                        document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' });
                      } else {
                        document.getElementById('search-input')?.focus();
                      }
                    }} 
                    className="bg-transparent px-8 py-3.5 rounded-md font-bold text-[10px] uppercase tracking-widest active:scale-95 border"
                    style={{ color: '#9aa0a6', borderColor: '#9aa0a6', borderWidth: '1.5px' }}
                  >
                    {banner.buttonText}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {activeBanners.length > 1 && (
            <>
              <button
                type="button"
                onClick={prevBannerSlide}
                aria-label="Banner anterior"
                data-testid="banner-prev"
                className="absolute left-4 top-1/2 -translate-y-1/2 z-30 w-12 h-12 rounded-full bg-zinc-950/80 backdrop-blur-md border border-white/20 text-white flex items-center justify-center active:scale-90 hover:bg-emerald-500 hover:text-zinc-950 hover:border-emerald-500 transition-all shadow-[0_0_20px_rgba(0,0,0,0.5)]"
              >
                <ChevronLeft size={24} />
              </button>
              <button
                type="button"
                onClick={nextBannerSlide}
                aria-label="Próximo banner"
                data-testid="banner-next"
                className="absolute right-4 top-1/2 -translate-y-1/2 z-30 w-12 h-12 rounded-full bg-zinc-950/80 backdrop-blur-md border border-white/20 text-white flex items-center justify-center active:scale-90 hover:bg-emerald-500 hover:text-zinc-950 hover:border-emerald-500 transition-all shadow-[0_0_20px_rgba(0,0,0,0.5)]"
              >
                <ChevronRight size={24} />
              </button>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
                {activeBanners.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => goToBannerSlide(idx)}
                    aria-label={`Ir para banner ${idx + 1}`}
                    data-testid={`banner-dot-${idx}`}
                    className={`h-2 rounded-full transition-all ${idx === currentBannerSlide ? 'w-6 bg-zinc-300' : 'w-2 bg-white/40'}`}
                  />
                ))}
              </div>
            </>
          )}
        </section>
      )}

      <main className="max-w-md mx-auto px-6 mt-6 space-y-5 min-h-screen" data-testid="catalog-main">
        <div className="relative group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
          <input id="search-input" placeholder="O que você procura?" data-testid="input-search" className="w-full bg-zinc-900/50 backdrop-blur-sm border border-white/5 py-4 pl-14 pr-6 rounded-2xl text-[16px] font-bold text-white outline-none focus:border-emerald-500/50 shadow-inner client-input" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        
        <div id="catalog-section" className="flex gap-3 overflow-x-auto no-scrollbar pb-1 mask-linear touch-pan-x">
          {/* Botão destacado de KITS — sempre primeiro */}
          {(products || []).some(p => p.is_kit) && (
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
          )}
          {!kitsOnly && categories.map(cat => (
            <button key={cat} onClick={() => setSelectedCategory(cat)} data-testid={`category-filter-${cat}`} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase whitespace-nowrap border transition-all touch-manipulation ${selectedCategory === cat ? 'bg-white text-zinc-950 border-white shadow-[0_0_15px_rgba(255,255,255,0.2)]' : 'bg-transparent text-zinc-500 border-white/10 hover:border-white/30'}`}>{cat}</button>
          ))}
        </div>


        {!kitsOnly && selectedCategory !== 'TODOS' && availableSubcategories.length > 1 && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar mask-linear touch-pan-x items-center" data-testid="subcategory-bar">
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
          <div className="flex gap-2 overflow-x-auto no-scrollbar mask-linear touch-pan-x items-center">
            {availableSizes.map(sz => (
              <button key={sz} onClick={() => setSelectedSize(sz)} data-testid={`size-filter-${sz}`} className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase whitespace-nowrap border transition-all touch-manipulation ${selectedSize === sz ? 'bg-zinc-300 text-zinc-950 border-zinc-300 shadow-[0_0_10px_rgba(212,212,216,0.25)]' : 'bg-transparent text-zinc-600 border-white/5 hover:text-white hover:border-white/20'}`}>{sz === 'TODOS' ? 'Todos tamanhos' : sz}</button>
            ))}
          </div>
        )}

        {/* DESTAQUES — vitrine de peças marcadas como destaque, só em modo padrão */}
        {(() => {
          const isDefaultView = !kitsOnly
            && selectedCategory === 'TODOS'
            && (selectedSize === 'TODOS' || !selectedSize)
            && !searchQuery.trim()
            && !activeCollectionFilter
            && currentPage === 1;
          if (!isDefaultView) return null;
          const featured = (products || []).filter(p => p.featured && !p.is_kit && (p.stock || 0) > 0);
          if (featured.length === 0) return null;
          return (
            <section className="relative -mx-6 px-6 py-6 mt-2 animate-in" data-testid="featured-section">
              {/* glow de fundo */}
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full bg-emerald-500/10 blur-3xl" />
              </div>
              <div className="relative flex items-end justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[9px] font-black uppercase tracking-[0.3em] text-emerald-400">Selecionado a dedo</span>
                  </div>
                  <h2 className="text-xl font-black uppercase tracking-tight text-white mt-1 flex items-center gap-2">
                    <Flame size={18} className="text-emerald-400" /> Em destaque
                  </h2>
                </div>
                <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                  {featured.length} {featured.length === 1 ? 'peça' : 'peças'}
                </span>
              </div>
              <div
                className="relative flex gap-4 overflow-x-auto overflow-y-hidden no-scrollbar snap-x snap-mandatory pb-2 -mx-2 px-2"
                style={{ touchAction: 'pan-x', overscrollBehavior: 'contain', scrollPaddingLeft: '8px' }}
                data-testid="featured-rail"
              >
                {featured.map((product, idx) => (
                  <motion.button
                    key={product.id}
                    type="button"
                    onClick={() => handleProductClick(product)}
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '80px' }}
                    transition={{ duration: 0.4, delay: idx * 0.05 }}
                    className="group relative shrink-0 w-[68%] max-w-[260px] snap-start rounded-[28px] overflow-hidden border border-white/10 bg-gradient-to-b from-zinc-900 to-zinc-950 shadow-[0_18px_40px_rgba(0,0,0,0.45)] active:scale-[0.98] transition-transform text-left touch-manipulation"
                    data-testid={`featured-card-${product.id}`}
                  >
                    <div className="absolute top-3 left-3 z-10 bg-gradient-to-r from-emerald-400 to-emerald-500 text-zinc-950 text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full shadow-[0_4px_15px_rgba(16,185,129,0.45)] flex items-center gap-1">
                      <Flame size={9} className="fill-zinc-950" /> Destaque
                    </div>
                    <div className="aspect-[4/5] relative overflow-hidden">
                      <ProductImage src={product.image} alt={product.name} priority={idx < 2} />
                      <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent pointer-events-none" />
                      <div className="absolute bottom-3 left-4 right-4">
                        <p className="text-[8px] font-black uppercase tracking-[0.25em] text-emerald-300/90">{product.category}</p>
                        <h3 className="text-white font-black uppercase text-sm leading-tight line-clamp-2 mt-1 drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)]">{product.name}</h3>
                      </div>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3 bg-zinc-950/80 border-t border-white/5">
                      <span className="text-white font-black text-base tracking-tight">{formatBRL(product.price || 0)}</span>
                      <span className="bg-white text-zinc-950 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1 shadow-md group-active:scale-95 transition-transform">
                        Ver <ChevronRight size={11} />
                      </span>
                    </div>
                  </motion.button>
                ))}
              </div>
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
           <div className="grid grid-cols-2 gap-4" data-testid="products-grid">
             {paginatedProducts.map((product, idx) => {
               const isOutOfStock = !product.is_kit && product.stock <= 0;
                return (
                  <motion.div
                    key={product.id}
                    onClick={() => handleProductClick(product)}
                      initial={{ opacity: 0.01, y: 20 }}
                       whileInView={{ opacity: 1, y: 0 }}
                       viewport={{ once: true, margin: "100px" }}
                       transition={{ duration: 0.5, ease: "easeOut" }}
                    className={`group relative bg-zinc-900/40 backdrop-blur-sm rounded-[24px] overflow-hidden border border-white/10 transition-all duration-300 flex flex-col shadow-lg touch-manipulation ${isOutOfStock ? 'opacity-80' : 'hover:border-white/20 hover:-translate-y-0.5 cursor-pointer active:scale-[0.98]'}`}
                    data-testid={`product-card-${product.id}`}
                  >
                    
                    {!isOutOfStock && !product.is_kit && product.stock <= 3 && <div className="absolute top-2 left-2 z-10 bg-amber-500 text-zinc-950 text-[8px] font-black uppercase px-2 py-1 rounded-md animate-pulse" data-testid={`badge-last-pieces-${product.id}`}>Restam {product.stock}</div>}
                    {!isOutOfStock && (product.sales || 0) >= 10 && <div className="absolute top-2 right-2 z-10 bg-gradient-to-r from-red-600 to-red-500 text-white text-[8px] font-black uppercase px-2 py-1 rounded-md shadow-[0_0_10px_rgba(239,68,68,0.5)] flex items-center gap-1" data-testid={`badge-best-seller-${product.id}`}><Flame size={9}/> Top</div>}
                    
                       <div className="aspect-[4/5] relative overflow-hidden">
                         <ProductImage
                           src={product.image}
                           alt={product.name}
                           isOutOfStock={isOutOfStock}
                           priority={idx < 4}
                         />
                        
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
                                     0% { transform: translateX(-150%) skewX(-15deg); }
                                     20%, 100% { transform: translateX(200%) skewX(-15deg); }
                                   }
                                 `}</style>
                                 <span className="pointer-events-none absolute inset-0 overflow-hidden">
                                   <span className="absolute top-0 left-0 h-full w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent" style={{ animation: 'shineSize 4s ease-in-out infinite' }} />
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
                      <div className="p-4 bg-zinc-950/50 flex-1 flex flex-col justify-between">
                        <h3 className="font-black text-zinc-300 text-[10px] uppercase line-clamp-2 leading-tight group-hover:text-white transition-colors">{product.name}</h3>
                        <p className={`font-black text-sm mt-2 ${isOutOfStock ? 'text-zinc-600 line-through' : 'text-white'}`}>{formatBRL(product.price || 0)}</p>
                      </div>
                  </motion.div>
                )
             })}
           </div>

           {totalPages > 1 && (
             <div className="flex items-center justify-between gap-3 pt-8 pb-2 animate-in" data-testid="pagination-controls">
               <button
                onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' })); }}
                 disabled={currentPage <= 1}
                 className="flex-1 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/10 bg-zinc-900/60 text-white hover:bg-white hover:text-zinc-950 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-zinc-900/60 disabled:hover:text-white touch-manipulation"
                 data-testid="pagination-prev"
               >
                 ← Anterior
               </button>
               <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 whitespace-nowrap px-2" data-testid="pagination-info">
                 <span className="text-white">{currentPage}</span> <span className="text-zinc-600">/</span> {totalPages}
               </div>
               <button
                onClick={() => { setCurrentPage(p => Math.min(totalPages, p + 1)); requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' })); }}
                 disabled={currentPage >= totalPages}
                 className="flex-1 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/10 bg-zinc-900/60 text-white hover:bg-white hover:text-zinc-950 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-zinc-900/60 disabled:hover:text-white touch-manipulation"
                 data-testid="pagination-next"
               >
                 Próxima →
               </button>
             </div>
           )}
           </>
        )}
      </main>

      <footer className="mt-20 bg-zinc-900/50 border-t border-white/5 pt-12 pb-10 px-6 max-w-md mx-auto">
        <div className="space-y-10">
          <div className="flex flex-col items-center text-center">
            <div className="h-16 w-full flex items-center justify-center mb-4 relative overflow-hidden pointer-events-none">
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

          <div className="flex flex-col items-center">
             <a href="https://www.instagram.com/fluxooutlet034" target="_blank" rel="noopener noreferrer" className="group flex items-center gap-3 bg-white/5 border border-white/10 px-8 py-4 rounded-2xl hover:bg-white hover:text-zinc-950 transition-all active:scale-95 shadow-xl touch-manipulation">
               <Instagram size={20} />
               <span className="text-[11px] font-black uppercase tracking-widest">Siga @fluxooutlet034</span>
             </a>
          </div>

          <div className="bg-zinc-950/50 rounded-[32px] p-6 border border-white/5 space-y-6 pointer-events-none">
            <h4 className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.3em] text-center">Checkout 100% Seguro</h4>
            <div className="grid grid-cols-3 gap-4 opacity-40">
              <div className="flex flex-col items-center gap-2"><ShieldCheck size={20} className="text-emerald-500" /><span className="text-[7px] font-bold uppercase text-zinc-500">SSL Cripto</span></div>
              <div className="flex flex-col items-center gap-2"><Lock size={20} className="text-emerald-500" /><span className="text-[7px] font-bold uppercase text-zinc-500">Seguro</span></div>
              <div className="flex flex-col items-center gap-2"><Award size={20} className="text-emerald-500" /><span className="text-[7px] font-bold uppercase text-zinc-500">Original</span></div>
            </div>
          </div>

          <div className="pt-6 text-center border-t border-white/5 text-[8px] font-black text-zinc-700 uppercase tracking-widest flex items-center justify-center gap-2 relative z-10">
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

      {selectedProduct && !selectedProduct.is_kit && (() => {
        const productGallery = [selectedProduct.image, ...((Array.isArray(selectedProduct.gallery) ? selectedProduct.gallery : []) || [])].filter(Boolean);
        const heroImg = activeProductImage || selectedProduct.image;
        return (
        <div className="fixed inset-x-0 z-[100] flex items-end justify-center overflow-hidden" style={viewportOverlayStyle}>
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={() => { setSelectedProduct(null); setSelectedSizes({}); }} />
          <div className="relative bg-zinc-950 w-full max-w-md rounded-t-[40px] animate-slide-up border-t border-white/10 shadow-2xl overflow-hidden flex flex-col" style={{ maxHeight: viewportPanelMaxHeight }}>
            {/* HERO IMAGE — grande, clicável para zoom */}
            <div className="relative w-full bg-gradient-to-b from-zinc-900 to-zinc-950 shrink-0">
              <button
                onClick={() => setZoomImage(heroImg)}
                className="block w-full aspect-square overflow-hidden touch-manipulation group"
                aria-label="Ampliar foto"
              >
                <img
                  src={heroImg}
                  className="w-full h-full object-cover transition-transform duration-500 group-active:scale-105"
                  alt={selectedProduct.name}
                />
              </button>
              {/* Drag handle flutuante */}
              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-white/30 rounded-full backdrop-blur-md" />
              {/* Botão fechar flutuante */}
              <button
                onClick={() => { setSelectedProduct(null); setSelectedSizes({}); }}
                className="absolute top-4 right-4 text-white bg-black/50 backdrop-blur-md rounded-full p-2.5 touch-manipulation border border-white/10 active:scale-90 transition-transform"
              >
                <X size={18}/>
              </button>
              {/* Hint de zoom */}
              <div className="absolute bottom-4 right-4 text-[9px] font-black text-white bg-black/60 backdrop-blur-md rounded-full px-3 py-1.5 uppercase tracking-widest border border-white/10 flex items-center gap-1.5 pointer-events-none">
                <Search size={10}/> Toque para ampliar
              </div>
              {/* Fade na base para emendar com conteúdo */}
              <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-b from-transparent to-zinc-950 pointer-events-none" />
            </div>

            {/* THUMBS — quando houver mais de 1 imagem */}
            {productGallery.length > 1 && (
              <div
                className="shrink-0 px-4 py-3 flex gap-2 overflow-x-auto overflow-y-hidden no-scrollbar bg-zinc-950 border-b border-white/5"
                style={{ touchAction: 'pan-x', overscrollBehavior: 'contain' }}
              >
                {productGallery.map((g, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveProductImage(g)}
                    className={`shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${heroImg === g ? 'border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.5)] scale-105' : 'border-white/10 opacity-70 hover:opacity-100'}`}
                  >
                    <img src={g} className="w-full h-full object-cover" alt="" draggable={false} />
                  </button>
                ))}
              </div>
            )}

            {/* CONTEÚDO scrollável */}
            <div className="flex-1 overflow-y-auto px-7 pt-5 pb-8">
              <div className="flex flex-col gap-1 mb-6">
                <span className="text-[8px] font-black text-zinc-500 uppercase bg-zinc-900 px-2 py-1 rounded-md tracking-widest self-start">REF: {selectedProduct.sku}</span>
                <h2 className="text-2xl font-black text-white leading-tight uppercase mt-2 tracking-tight">{selectedProduct.name}</h2>
                <p className="text-3xl font-black text-emerald-500 mt-2 tracking-tighter">{formatBRL(selectedProduct.price || 0)}</p>
              </div>
              <div className="space-y-4">
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Selecione o Tamanho</p>
                <div className="grid grid-cols-4 gap-2">
                  {(selectedProduct.sizes || []).filter(s => {
                    const stock = typeof s === 'string' ? selectedProduct.stock : s.stock;
                    return Number(stock || 0) > 0;
                  }).map((s, idx) => {
                    const sz = typeof s === 'string' ? s : s.size;
                    const stock = typeof s === 'string' ? selectedProduct.stock : s.stock;
                    const qty = selectedSizes[sz] || 0;
                    if (qty > 0) {
                      return (
                        <div key={idx} className="py-2.5 rounded-lg border-2 border-white bg-zinc-900 flex flex-col items-center justify-center gap-1.5">
                          <span className="text-xs font-black text-white">{sz}</span>
                          <div className="flex items-center gap-2 bg-zinc-950 rounded-md px-1 py-1 border border-zinc-800">
                            <button onClick={() => { const n = {...selectedSizes}; if(n[sz]>1) n[sz]--; else delete n[sz]; setSelectedSizes(n); }} className="text-zinc-400 touch-manipulation"><Minus size={10}/></button>
                            <span className="text-[10px] font-black text-white w-3 text-center">{qty}</span>
                            <button onClick={() => handleSizeSelect(sz, stock)} className="text-zinc-400 touch-manipulation"><Plus size={10}/></button>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <button key={idx} disabled={stock <= 0} onClick={() => handleSizeSelect(sz, stock)} className={`py-3 rounded-lg border font-black text-sm transition-all touch-manipulation bg-zinc-900 border-zinc-800 ${stock > 0 ? 'text-zinc-300 active:scale-95' : 'text-zinc-600 opacity-50'}`}>{sz}</button>
                    );
                  })}
                </div>
                <div className="pt-6 mt-4 border-t border-white/5">
                  <button onClick={handleCommitToCart} disabled={Object.keys(selectedSizes).length === 0} className={`w-full py-5 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 touch-manipulation ${Object.keys(selectedSizes).length === 0 ? 'bg-zinc-900 text-zinc-700' : 'bg-emerald-500 text-zinc-950 shadow-[0_10px_30px_rgba(16,185,129,0.3)]'}`}>
                    {Object.keys(selectedSizes).length === 0 ? 'Escolha um Tamanho' : `Adicionar à Sacola (${Object.values(selectedSizes).reduce((a,b)=>a+b,0)})`} <ShoppingBag size={14}/>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        );
      })()}

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
            src={zoomImage}
            alt="Visualização ampliada"
            className="max-w-full max-h-full object-contain rounded-3xl shadow-[0_20px_80px_rgba(0,0,0,0.6)] animate-in"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[9px] font-black text-white/60 uppercase tracking-widest">
            Toque fora para fechar
          </div>
        </div>
      )}

      {showCart && (
        <div className="fixed inset-x-0 z-[150] bg-zinc-950 overflow-y-auto animate-in" style={viewportOverlayStyle}>
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
        </div>
      )}

      {showLeadModal && (
        <div className="fixed inset-x-0 z-[200] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6 overflow-hidden" style={viewportOverlayStyle}>
          <div className="bg-zinc-950 w-full max-w-sm rounded-[32px] p-8 space-y-6 shadow-2xl border border-white/10 animate-in relative overflow-hidden">
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
          </div>
        </div>
      )}

	      {showMyOrders && (
	        <div className="fixed inset-x-0 z-[200] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6 overflow-hidden" style={viewportOverlayStyle} data-testid="modal-my-orders">
	          <div className="bg-zinc-950 w-full max-w-sm rounded-[32px] p-8 space-y-5 shadow-2xl border border-white/10 animate-in relative overflow-hidden max-h-[90vh] flex flex-col">
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
	          </div>
	        </div>
	      )}


      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
        
        ::-webkit-scrollbar { display: none; }
        
        html {
          background-color: #09090b;
          overscroll-behavior-y: none;
          overscroll-behavior-x: none;
          overflow-x: hidden;
          min-height: 100%;
        }

        body { 
          font-family: 'Inter', sans-serif; 
          -webkit-tap-highlight-color: transparent; 
          background-color: #09090b; 
          overflow-x: hidden;
          overscroll-behavior-y: none;
          overscroll-behavior-x: none;
          touch-action: manipulation; 
          image-rendering: -webkit-optimize-contrast;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        #root, .app-shell {
          min-height: 100dvh;
          overscroll-behavior-y: none;
          overscroll-behavior-x: none;
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
