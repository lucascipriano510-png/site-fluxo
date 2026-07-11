import OfferCountdown from './OfferCountdown';
import ProductReviewsList from './ProductReviewsList';
import ProductVideoPip from './ProductVideoPip';
import React from 'react';
import SizeRowSelector from './SizeRowSelector';
import StarRatingInline from './StarRatingInline';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, Flame, MessageCircle, Ruler, Share2, ShieldCheck, ShoppingBag, Truck, X, Zap, ZoomIn } from 'lucide-react';
import { colorDot, pluralCat } from '../lib/catalogUi';
import { formatBRL } from '../lib/format';
import { hasSizeGuide } from './SizeGuideModal';
import { isOfferLive, offerEndsAt, offerPercent, offerPrice } from '../lib/offers';
import { buildSrcSet, optimizeImage, warmImages } from '../lib/images';

// Larguras do HERO da página de produto — mesmas do srcset do card (q88), que
// o warm-image-cache já mantém quentes. O navegador escolhe pelo DPR real:
// celular baixa ~900-1200px em vez do 1600 fixo de antes (≈metade dos pixels
// = abre e troca de foto bem mais rápido, mesma nitidez por pixel exibido).
const HERO_WIDTHS = [640, 900, 1200, 1600];
const HERO_Q = 88;

// Pré-carrega a galeria assim que o produto abre: thumbs (300px) na hora e as
// versões grandes 300ms depois (só o fôlego do hero começar a baixar).
// Resolve o "quadrado escuro" nas miniaturas e deixa o swipe instantâneo.
const GalleryPreload = ({ gallery }) => {
  const key = (gallery || []).join('|');
  React.useEffect(() => {
    const urls = key ? key.split('|') : [];
    if (urls.length <= 1) return;
    warmImages(urls.map((g) => optimizeImage(g, 300, 80)));
    const t = setTimeout(() => {
      // 900 e 1200 cobrem o que o srcset escolhe na esmagadora maioria dos DPRs
      warmImages(urls.flatMap((g) => [optimizeImage(g, 900, HERO_Q), optimizeImage(g, 1200, HERO_Q)]));
    }, 300);
    return () => clearTimeout(t);
  }, [key]);
  return null;
};

// Extraído do App.jsx (verbatim) — recebe estado/handlers do App por props.
const ProductPageOverlay = ({
  activeProductImage,
  bumpOffers,
  handleCommitToCart,
  handleShareProduct,
  handleSizeSelect,
  kitItemsByKit,
  productSwipeRef,
  products,
  ratingsMap,
  selectedProduct,
  selectedSizes,
  setActiveCollectionFilter,
  setActiveProductImage,
  setDrawerTab,
  setRatingsMap,
  setSelectedCategory,
  setSelectedProduct,
  setSelectedSizes,
  setSelectedSubcategory,
  setShowSizeGuide,
  setShowUserDrawer,
  setStockAlertTarget,
  setZoomImage,
  showToast,
  userProfile,
}) => (
<AnimatePresence>
      {selectedProduct && !selectedProduct.is_kit && (() => {
        const productGallery = [selectedProduct.image, ...((Array.isArray(selectedProduct.gallery) ? selectedProduct.gallery : []) || [])].filter(Boolean);
        const heroImg = activeProductImage || selectedProduct.image;
        // Kits que CONTÊM a peça atual (via kit_items) aparecem PRIMEIRO na sugestão.
        // Kit tem stock 0 por design (disponibilidade vem dos componentes), então NÃO
        // aplicamos o filtro de stock aqui — só is_active.
        const linkedKits = (products || []).filter(p =>
          p.is_kit && p.is_active !== false &&
          (kitItemsByKit[p.id] || []).includes(selectedProduct.id)
        );
        const relatedProducts = [
          ...linkedKits,
          ...(products || []).filter(p =>
            p.id !== selectedProduct.id && !p.is_kit && p.stock > 0 &&
            (p.category === selectedProduct.category || p.featured)
          ),
        ].slice(0, 4);
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
            ? { label: pluralCat(selectedProduct.category), onClick: () => goCategory(selectedProduct.category) } : null,
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
                      style={{ color: 'var(--text-secondary)' }}
                    >{c.label}</button>}
              </React.Fragment>
            ))}
          </nav>
        );
        return (
        <React.Fragment key={`product-modal-${selectedProduct.id}`}>
          {/* Pop-up flutuante de vídeo (opcional, só se o produto tiver video_url) */}
          <ProductVideoPip key={`pip-${selectedProduct.id}`} src={selectedProduct.video_url} poster={selectedProduct.image} />
          <GalleryPreload gallery={productGallery} />
          {/* ── MOBILE: página de produto em fluxo no documento (oculto no desktop) ── */}
          {/* A barra real (hambúrguer/logo/perfil/sacola) fica sticky logo acima — barra compartilhada com o home. */}
          <motion.div
            className="lg:hidden min-h-dvh"
            style={{ background: '#202024' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
              {/* Gallery — full-bleed, colada na barra (sem puxador) */}
              <div className="relative w-full bg-zinc-900">
                {/* Voltar — flutua sobre a imagem, logo abaixo da barra Fluxo */}
                <button onClick={() => { setSelectedProduct(null); setSelectedSizes({}); }} className="absolute top-3 left-3 z-20 flex items-center gap-1 text-white bg-black/50 backdrop-blur-md rounded-full pl-2 pr-3 py-2 touch-manipulation border border-white/10 active:scale-90 transition-transform text-[10px] font-black uppercase tracking-widest"><ChevronLeft size={16}/> Voltar</button>
                <button onClick={() => handleShareProduct(selectedProduct)} aria-label="Compartilhar" className="absolute top-3 right-3 z-20 flex items-center justify-center text-white bg-black/50 backdrop-blur-md rounded-full w-9 h-9 touch-manipulation border border-white/10 active:scale-90 transition-transform"><Share2 size={15}/></button>
                <div
                  className="relative w-full aspect-[4/5] overflow-hidden"
                  style={{ touchAction: 'pan-y' }}
                  onTouchStart={(e) => { const t = e.touches[0]; productSwipeRef.current = { x: t.clientX, y: t.clientY }; }}
                  onTouchEnd={(e) => {
                    if (productGallery.length <= 1) return;
                    const t = e.changedTouches[0];
                    const dx = t.clientX - productSwipeRef.current.x;
                    const dy = t.clientY - productSwipeRef.current.y;
                    // Só conta como swipe se for horizontal o suficiente (e mais que vertical).
                    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
                      const i = Math.max(0, productGallery.indexOf(heroImg));
                      const next = dx < 0
                        ? (i + 1) % productGallery.length
                        : (i - 1 + productGallery.length) % productGallery.length;
                      setActiveProductImage(productGallery[next]);
                    }
                  }}
                >
                  {/* LQIP blur-up atrás do hero pesado (1600px): preview instantâneo
                      do produto -> nunca aparece quadrado vazio ao abrir o card. */}
                  <div aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: 0, backgroundImage: `url("${optimizeImage(heroImg, 40, 35)}")`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(12px)', transform: 'scale(1.06)' }} />
                  {/* Troca a foto por SWIPE lateral (handlers no container) ou toque nas miniaturas/pontos */}
                  <img
                    src={optimizeImage(heroImg, 1200, HERO_Q)}
                    srcSet={buildSrcSet(heroImg, HERO_WIDTHS, HERO_Q)}
                    sizes="100vw"
                    className="relative z-[1] w-full h-full object-cover"
                    style={{ viewTransitionName: 'produto-hero' }}
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
                      <button key={i} onClick={() => setActiveProductImage(g)} className={`shrink-0 w-16 h-16 rounded-xl overflow-hidden bg-zinc-800 border-2 transition-all touch-manipulation ${heroImg === g ? 'border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.5)] scale-105' : 'border-white/10 opacity-60'}`}>
                        <img src={optimizeImage(g, 300, 80)} className="w-full h-full object-cover" alt="" draggable={false} decoding="async" />
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
                      <span className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--text-secondary)' }}>Ref. {selectedProduct.sku}</span>
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
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] font-black text-white uppercase tracking-[0.22em]">Selecione o Tamanho</p>
                    {hasSizeGuide(selectedProduct) && (
                      <button onClick={() => setShowSizeGuide(true)} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-400 touch-manipulation active:opacity-70 transition-opacity">
                        <Ruler size={12}/> Guia de medidas
                      </button>
                    )}
                  </div>
                  <SizeRowSelector
                    product={selectedProduct}
                    selectedSizes={selectedSizes}
                    setSelectedSizes={setSelectedSizes}
                    onPick={handleSizeSelect}
                    onAlert={(size) => setStockAlertTarget({ product: selectedProduct, size })}
                  />
                </div>

                {/* ── SOBRE A PEÇA ── descrição da vitrine + material/cor (só se existir) */}
                {(selectedProduct.description || selectedProduct.material || selectedProduct.color) && (
                  <div className="flex flex-col gap-3 border-t border-white/5 pt-8">
                    <p className="text-[11px] font-black text-white uppercase tracking-[0.22em]">Sobre a peça</p>
                    {selectedProduct.description && (
                      <p className="text-[14px] leading-relaxed whitespace-pre-line" style={{ color: 'var(--text-secondary)' }}>{selectedProduct.description}</p>
                    )}
                    {(selectedProduct.material || selectedProduct.color) && (
                      <div className="flex flex-wrap gap-2">
                        {selectedProduct.material && (
                          <span className="text-[10px] font-black uppercase tracking-wide text-zinc-300 bg-zinc-900 border border-white/10 rounded-full px-3 py-1.5">{selectedProduct.material}</span>
                        )}
                        {selectedProduct.color && (
                          <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-zinc-300 bg-zinc-900 border border-white/10 rounded-full px-3 py-1.5">
                            {colorDot(selectedProduct.color) && <span className="w-2.5 h-2.5 rounded-full border border-white/20" style={{ background: colorDot(selectedProduct.color) }} />}
                            {selectedProduct.color}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}

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
                            {p.is_kit && <span className="absolute top-1.5 left-1.5 z-10 flex items-center gap-1 bg-gradient-to-r from-amber-400 to-pink-500 text-zinc-950 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md shadow-lg"><Zap size={8} className="fill-zinc-950"/> Kit</span>}
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
              <div className="fixed bottom-0 left-0 right-0 px-7 py-4 liquid-glass z-[60] lg:hidden" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
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
            className="hidden lg:block fixed inset-0 z-30 overflow-y-auto"
            style={{ background: '#202024' }}
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
                  {/* LQIP blur-up atrás do hero pesado (1600px): preview instantâneo */}
                  <div aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: 0, backgroundImage: `url("${optimizeImage(heroImg, 40, 35)}")`, backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', filter: 'blur(12px)', transform: 'scale(1.04)' }} />
                  <img
                    src={optimizeImage(heroImg, 1200, HERO_Q)}
                    srcSet={buildSrcSet(heroImg, HERO_WIDTHS, HERO_Q)}
                    sizes="(min-width: 1024px) 640px, 100vw"
                    className="relative z-[1] w-full object-contain"
                    style={{ maxHeight: '640px', viewTransitionName: 'produto-hero' }}
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
                      <button key={i} onClick={() => setActiveProductImage(g)} className={`shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-zinc-800 border-2 transition-all ${heroImg === g ? 'border-emerald-400 shadow-[0_0_16px_rgba(16,185,129,0.5)] scale-105' : 'border-white/10 opacity-50 hover:opacity-100'}`}>
                        <img src={optimizeImage(g, 300, 80)} className="w-full h-full object-cover" alt="" decoding="async" />
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
                    <div className="flex items-center gap-2 shrink-0 -mt-1.5 -mr-1.5">
                      <button
                        onClick={() => handleShareProduct(selectedProduct)}
                        aria-label="Compartilhar"
                        className="w-9 h-9 flex items-center justify-center rounded-full text-zinc-400 hover:text-white bg-zinc-900 border border-white/10 transition-colors hover:bg-zinc-800"
                      >
                        <Share2 size={15}/>
                      </button>
                      <button
                        onClick={() => { setSelectedProduct(null); setSelectedSizes({}); }}
                        aria-label="Fechar"
                        className="w-9 h-9 flex items-center justify-center rounded-full text-zinc-400 hover:text-white bg-zinc-900 border border-white/10 transition-colors hover:bg-zinc-800"
                      >
                        <X size={16}/>
                      </button>
                    </div>
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
                    <span className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--text-secondary)' }}>Ref. {selectedProduct.sku}</span>
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
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <p className="text-[11px] font-black text-white uppercase tracking-[0.22em]">Selecione o Tamanho</p>
                      {hasSizeGuide(selectedProduct) && (
                        <button onClick={() => setShowSizeGuide(true)} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-400 hover:text-emerald-300 transition-colors">
                          <Ruler size={12}/> Guia de medidas
                        </button>
                      )}
                    </div>
                    <SizeRowSelector
                      product={selectedProduct}
                      selectedSizes={selectedSizes}
                      setSelectedSizes={setSelectedSizes}
                      onPick={handleSizeSelect}
                      onAlert={(size) => setStockAlertTarget({ product: selectedProduct, size })}
                    />
                  </div>

                  {/* CTA */}
                  <button onClick={handleCommitToCart} disabled={Object.keys(selectedSizes).length === 0} className={`w-full py-5 rounded-2xl font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-3 ${Object.keys(selectedSizes).length === 0 ? 'bg-zinc-900 text-zinc-600 cursor-not-allowed' : 'bg-emerald-500 text-zinc-950 shadow-[0_10px_40px_rgba(16,185,129,0.35)] hover:bg-emerald-400 hover:shadow-[0_10px_50px_rgba(16,185,129,0.5)]'}`}>
                    {Object.keys(selectedSizes).length === 0 ? 'Escolha um Tamanho' : `Adicionar à Sacola — ${Object.values(selectedSizes).reduce((a,b)=>a+b,0)} ${Object.values(selectedSizes).reduce((a,b)=>a+b,0) === 1 ? 'peça' : 'peças'}`}
                    <ShoppingBag size={16}/>
                  </button>

                  {/* Sobre a peça — descrição da vitrine + material/cor (só se existir) */}
                  {(selectedProduct.description || selectedProduct.material || selectedProduct.color) && (
                    <div className="mt-8 pt-8 border-t border-white/10">
                      <p className="text-[11px] font-black text-white uppercase tracking-[0.22em] mb-3">Sobre a peça</p>
                      {selectedProduct.description && (
                        <p className="text-[14px] leading-relaxed whitespace-pre-line mb-3" style={{ color: 'var(--text-secondary)' }}>{selectedProduct.description}</p>
                      )}
                      {(selectedProduct.material || selectedProduct.color) && (
                        <div className="flex flex-wrap gap-2">
                          {selectedProduct.material && (
                            <span className="text-[10px] font-black uppercase tracking-wide text-zinc-300 bg-zinc-900 border border-white/10 rounded-full px-3 py-1.5">{selectedProduct.material}</span>
                          )}
                          {selectedProduct.color && (
                            <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-zinc-300 bg-zinc-900 border border-white/10 rounded-full px-3 py-1.5">
                              {colorDot(selectedProduct.color) && <span className="w-2.5 h-2.5 rounded-full border border-white/20" style={{ background: colorDot(selectedProduct.color) }} />}
                              {selectedProduct.color}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}

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
                        {p.is_kit && <span className="absolute top-2 left-2 z-10 flex items-center gap-1 bg-gradient-to-r from-amber-400 to-pink-500 text-zinc-950 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md shadow-lg"><Zap size={9} className="fill-zinc-950"/> Kit</span>}
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
);

export default ProductPageOverlay;
