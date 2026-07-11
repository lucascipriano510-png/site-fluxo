import AutoScrollGallery from './AutoScrollGallery';
import OfferCountdown from './OfferCountdown';
import PixIcon from './PixIcon';
import ProductImage from './ProductImage';
import React from 'react';
import StarRatingInline from './StarRatingInline';
import SubBanner from './SubBanner';
import WaterRippleFX from './WaterRippleFX';
import { ArrowRight, ChevronLeft, Flame, Package, Plus, Search, Truck, X, Zap } from 'lucide-react';
import { CAMPAIGN_LABELS, OFFER_CAMPAIGNS, isOfferLive, offerCampaign, offerEndsAt, offerPercent, offerPrice } from '../lib/offers';
import { PRICE_RANGES, colorDot, pluralCat, shineDelay } from '../lib/catalogUi';
import { emitSignal } from '../lib/leadSignals';
import { formatBRL } from '../lib/format';
import { getCatImgData, optimizeImage } from '../lib/images';
import { motion } from 'framer-motion';

// Extraído do App.jsx (verbatim) — recebe estado/handlers do App por props.
const CatalogMain = ({
  activeCollectionFilter,
  availableColors,
  availableSizes,
  availableSubcategories,
  bumpOffers,
  catRailRef,
  categories,
  config,
  currentPage,
  filteredProducts,
  handleProductClick,
  isDesktopViewport,
  kitsOnly,
  midBanner,
  noveltyMode,
  onCatRailScroll,
  paginatedProducts,
  prefersReducedMotion,
  priceRange,
  products,
  productsLoaded,
  ratingsMap,
  recentlyViewedProducts,
  searchActive,
  searchIntent,
  searchQuery,
  selectedCategory,
  selectedColor,
  selectedProduct,
  selectedSize,
  selectedSubcategory,
  selectionSkus,
  setActiveCollectionFilter,
  setCurrentPage,
  setDrawerTab,
  setKitsOnly,
  setNoveltyMode,
  setPriceRange,
  setRatingsMap,
  setSearchQuery,
  setSelectedCategory,
  setSelectedColor,
  setSelectedProduct,
  setSelectedSize,
  setSelectedSizes,
  setSelectedSubcategory,
  setSelectionSkus,
  setShowUserDrawer,
  setSortMode,
  showToast,
  sortMode,
  totalPages,
  userProfile,
}) => (
<main className="w-full px-6 lg:px-10 mt-6 lg:mt-12 space-y-5 lg:space-y-12 min-h-dvh lg:max-w-[1500px] lg:mx-auto" data-testid="catalog-main">
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
              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Filtrando:</span>
              {chips.map(c => (
                <span key={c.k} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-amber-300 bg-amber-400/10 border border-amber-400/25 rounded-full px-2.5 py-1">
                  {c.icon}{c.label}
                </span>
              ))}
            </div>
          );
        })()}

        <div>
        {/* Título da fileira — nem todo mundo deduz que os tiles são categorias */}
        <p className="text-[10px] lg:text-[11px] font-black uppercase tracking-widest text-white/90 mb-3 lg:text-center">Categorias</p>
        <div id="catalog-section" ref={catRailRef} onScroll={onCatRailScroll} className="flex gap-3 lg:gap-5 overflow-x-auto lg:overflow-x-visible lg:flex-wrap lg:justify-center no-scrollbar pb-1 lg:pb-0 mask-linear lg:[mask-image:none] native-x-scroll items-start" style={{ touchAction: 'pan-x pan-y' }}>
          {(() => {
            // Fileira renderizada por função p/ permitir o LOOP INFINITO: no mobile
            // são 3 cópias idênticas + teleporte nas bordas (onCatRailScroll).
            // SEM tile "TODOS" (padrão das grandes): clicar na categoria ATIVA
            // desmarca; voltar do Android, logo e breadcrumb também limpam.
            const hasKits = (products || []).some(p => p.is_kit);
            const kitCover = hasKits ? ((products || []).find(p => p.is_kit && p.is_active !== false && p.image)?.image) : null;
            const realCats = categories.filter(c => c !== 'TODOS');

            const renderKitsTile = (copy) => (
              <button
                key={`__kits__${copy}`}
                onClick={() => { setKitsOnly(v => !v); }}
                data-testid="category-filter-KITS"
                className={`relative shrink-0 w-[92px] h-[115px] lg:w-[120px] lg:h-[150px] rounded-2xl overflow-hidden border-2 transition-all duration-200 touch-manipulation bg-zinc-950 ${kitsOnly
                  ? 'border-amber-300 shadow-[0_0_24px_rgba(251,191,36,0.45)]'
                  : 'border-amber-400/40 hover:border-amber-300 shadow-[0_0_14px_rgba(251,191,36,0.15)]'}`}
              >
                {kitCover ? (
                  <img src={optimizeImage(kitCover, 300, 82)} alt="Kits" className="absolute inset-0 w-full h-full object-cover" loading="lazy" decoding="async" />
                ) : (
                  <span className="absolute inset-0 bg-gradient-to-br from-amber-400 via-orange-500 to-pink-500 flex items-center justify-center">
                    <Zap size={30} className="-mt-4 text-zinc-950 fill-zinc-950" />
                  </span>
                )}
                <div className="absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-black/85 via-black/35 to-transparent pointer-events-none" />
                <span className="absolute top-2 left-2 w-6 h-6 lg:w-7 lg:h-7 rounded-full bg-gradient-to-br from-amber-400 to-pink-500 flex items-center justify-center shadow-[0_2px_10px_rgba(251,191,36,0.5)]">
                  <Zap size={13} className="text-zinc-950 fill-zinc-950" />
                </span>
                <span
                  className={`absolute bottom-2.5 left-2.5 right-2.5 text-left text-[10px] lg:text-[11px] font-black uppercase tracking-wider leading-tight transition-colors ${kitsOnly ? 'text-amber-300' : 'text-white'}`}
                  style={{ textShadow: '0 1px 8px rgba(0,0,0,0.8)' }}
                >
                  Kits
                </span>
              </button>
            );

            const renderCatTile = (cat, copy) => {
              const isActive = selectedCategory === cat;
              const catImgData = getCatImgData((config.category_images || {})[cat]);
              const imgUrl = catImgData.url;
              const imgPos = catImgData.pos;
              return (
                <motion.button
                  key={`${cat}-${copy}`}
                  onClick={() => setSelectedCategory(isActive ? 'TODOS' : cat)}
                  data-testid={`category-filter-${cat}`}
                  whileTap={{ scale: 0.96 }}
                  className={`relative shrink-0 w-[92px] h-[115px] lg:w-[120px] lg:h-[150px] rounded-2xl overflow-hidden border-2 transition-all duration-200 touch-manipulation bg-zinc-950 ${
                    isActive
                      ? 'border-emerald-500 shadow-[0_0_18px_rgba(16,185,129,0.45)]'
                      : 'border-white/10 hover:border-white/30'
                  }`}
                >
                  {imgUrl ? (
                    <img src={optimizeImage(imgUrl, 300, 82)} alt={cat} className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: imgPos }} loading="lazy" decoding="async" />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center -mt-4">
                      <span className={`text-3xl font-black select-none transition-colors ${isActive ? 'text-emerald-400/80' : 'text-white/25'}`}>
                        {(cat || '?').charAt(0)}
                      </span>
                    </span>
                  )}
                  <div className="absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-black/85 via-black/35 to-transparent pointer-events-none" />
                  <span
                    className={`absolute bottom-2.5 left-2.5 right-2.5 text-left text-[10px] lg:text-[11px] font-black uppercase tracking-wider leading-tight transition-colors ${isActive ? 'text-emerald-400' : 'text-white'}`}
                    style={{ textShadow: '0 1px 8px rgba(0,0,0,0.8)' }}
                  >
                    {pluralCat(cat)}
                  </span>
                </motion.button>
              );
            };

            if (kitsOnly) return (
              <>
                {hasKits && renderKitsTile(0)}
                <button
                  onClick={() => setKitsOnly(false)}
                  className="relative px-3 py-2.5 rounded-xl text-[10px] font-black uppercase whitespace-nowrap border transition-all touch-manipulation flex items-center gap-1 shrink-0 self-center text-amber-400 border-amber-400/25 bg-amber-400/5 hover:bg-amber-400/10 hover:border-amber-400/50 active:scale-95"
                >
                  <ChevronLeft size={12} /> Voltar
                </button>
              </>
            );

            return (isDesktopViewport ? [0] : [0, 1, 2]).map((copy) => (
              <React.Fragment key={copy}>
                {hasKits && renderKitsTile(copy)}
                {realCats.map((cat) => renderCatTile(cat, copy))}
              </React.Fragment>
            ));
          })()}
        </div>
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
        {selectionSkus && (
          <div className="flex items-center justify-between bg-zinc-500/10 border border-zinc-400/20 p-4 rounded-2xl animate-in" data-testid="selection-chip">
            <div className="flex flex-col">
              <span className="text-[8px] font-black uppercase text-zinc-300 tracking-widest">Seleção montada pra você</span>
              <span className="text-xs font-black uppercase text-white">{selectionSkus.length} peça(s) escolhida(s)</span>
            </div>
            <button onClick={() => setSelectionSkus(null)} className="p-2 bg-zinc-300 text-zinc-950 rounded-xl active:scale-90 transition-transform" aria-label="Ver loja toda"><X size={14}/></button>
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
              <button key={sz} onClick={() => setSelectedSize(sz)} data-testid={`size-filter-${sz}`} className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase whitespace-nowrap border transition-all touch-manipulation ${selectedSize === sz ? 'bg-zinc-300 text-zinc-950 border-zinc-300 shadow-[0_0_10px_rgba(212,212,216,0.25)]' : 'bg-transparent text-zinc-400 border-white/5 hover:text-white hover:border-white/20'}`}>{sz === 'TODOS' ? 'Todos tamanhos' : sz}</button>
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
                <button key={c} onClick={() => setSelectedColor(c)} data-testid={`color-filter-${c}`} className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[9px] font-black uppercase whitespace-nowrap border transition-all touch-manipulation ${active ? 'bg-zinc-300 text-zinc-950 border-zinc-300 shadow-[0_0_10px_rgba(212,212,216,0.25)]' : 'bg-transparent text-zinc-400 border-white/5 hover:text-white hover:border-white/20'}`}>
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
            <button onClick={() => setPriceRange('TODOS')} className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase whitespace-nowrap border transition-all touch-manipulation ${priceRange === 'TODOS' ? 'bg-zinc-300 text-zinc-950 border-zinc-300 shadow-[0_0_10px_rgba(212,212,216,0.25)]' : 'bg-transparent text-zinc-400 border-white/5 hover:text-white hover:border-white/20'}`}>Qualquer preço</button>
            {PRICE_RANGES.map(r => (
              <button key={r.key} onClick={() => setPriceRange(r.key)} data-testid={`price-filter-${r.key}`} className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase whitespace-nowrap border transition-all touch-manipulation ${priceRange === r.key ? 'bg-emerald-500 text-zinc-950 border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-transparent text-zinc-400 border-white/5 hover:text-white hover:border-white/20'}`}>{r.label}</button>
            ))}
          </div>
        )}

        {/* OFERTAS — carrosséis por campanha (Dia/Semana/Mês), na ordem do Setup */}
        {(() => {
          const isDefaultView = !kitsOnly && selectedCategory === 'TODOS' && (selectedSize === 'TODOS' || !selectedSize) && selectedColor === 'TODOS' && priceRange === 'TODOS' && !searchQuery.trim() && !activeCollectionFilter && !selectionSkus && currentPage === 1;
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
                              <ProductImage src={product.image} alt={product.name} order={10 + secIdx * 40 + idx} sizes="(min-width: 385px) 200px, 52vw" />
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
                              {/* Nome no card de oferta — mesmo tratamento do catálogo (legível, 2 linhas reservadas) */}
                              <h3 className="uppercase line-clamp-2 mb-1.5" style={{ color: '#E4E4E7', fontSize: '11.5px', fontWeight: 600, letterSpacing: '0.04em', lineHeight: 1.35, minHeight: '2.7em' }}>{product.name}</h3>
                              <div className="flex items-baseline gap-2">
                                <span style={{ color: '#fde68a', fontSize: '16px', fontFamily: "'DM Sans', sans-serif", fontWeight: 800, letterSpacing: '-0.01em' }}>{formatBRL(novo)}</span>
                                <span style={{ color: '#71717A', fontSize: '10px', fontWeight: 600, textDecoration: 'line-through' }}>{formatBRL(product.price || 0)}</span>
                              </div>
                              <div className="flex items-center gap-1.5 mt-1.5" style={{ color: '#4ADE80' }}>
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
          const isDefaultView = !kitsOnly && selectedCategory === 'TODOS' && (selectedSize === 'TODOS' || !selectedSize) && selectedColor === 'TODOS' && priceRange === 'TODOS' && !searchQuery.trim() && !activeCollectionFilter && !selectionSkus && currentPage === 1;
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
                      className="snap-center shrink-0 w-[88%] max-w-[480px] lg:w-[420px] lg:max-w-none"
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
                                      <ProductImage src={imgSrc} alt={product.name} priority={idx === 0 && i === 0} order={i === 0 ? 20 + idx : 1500 + idx * 10 + i} sizes="(min-width: 1024px) 420px, (min-width: 545px) 480px, 88vw" />
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
          const isDefaultView = !kitsOnly && selectedCategory === 'TODOS' && (selectedSize === 'TODOS' || !selectedSize) && selectedColor === 'TODOS' && priceRange === 'TODOS' && !searchQuery.trim() && !activeCollectionFilter && !selectionSkus && currentPage === 1;
          if (!isDefaultView || !midBanner) return null;
          return <SubBanner banner={midBanner} whatsapp={config?.whatsapp} />;
        })()}

        {/* ── LETREIRO DE MARCA (marquee streetwear) — só na home limpa.
            (O spotlight "A mais pedida" foi removido em 2026-07-11: brigava
            com a seção "Em Destaque", que já faz o papel de vitrine premium.) */}
        {(() => {
          const isDefaultView = !kitsOnly && selectedCategory === 'TODOS' && (selectedSize === 'TODOS' || !selectedSize) && selectedColor === 'TODOS' && priceRange === 'TODOS' && !searchQuery.trim() && !activeCollectionFilter && !selectionSkus && currentPage === 1;
          if (!isDefaultView) return null;
          return (
            <div className="-mx-6 lg:mx-0 marquee-wrap" aria-hidden="true">
              {/* Só IDENTIDADE aqui — as promessas de compra (frete, 4x,
                  retire) já vivem na faixa do topo; repetir = redundância. */}
              <div className="marquee-track">
                {[0, 1].map(i => (
                  <span key={i} className="marquee-seg">
                    <span className="mq-solid">Fluxo Outlet</span><span className="mq-sep">✦</span>
                    <span className="mq-outline">Streetwear premium</span><span className="mq-sep">✦</span>
                    <span className="mq-solid">Uberaba</span><span className="mq-sep">✦</span>
                  </span>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Vistos recentemente — trilha horizontal (só fora de busca, p/ não poluir) */}
        {recentlyViewedProducts.length > 0 && !searchActive && (
          <div className="pt-1 animate-in">
            <p className="text-[10px] font-black uppercase tracking-widest text-white/90 mb-3">Vistos recentemente</p>
            <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-5 px-5 lg:mx-0 lg:px-0" style={{ touchAction: 'pan-x pan-y' }}>
              {recentlyViewedProducts.map(p => (
                <button key={p.id} onClick={() => handleProductClick(p)} className="shrink-0 w-24 lg:w-32 text-left group">
                  <div className="aspect-[3/4] rounded-xl overflow-hidden bg-zinc-900 border border-white/5 relative mb-1.5">
                    <img src={optimizeImage(p.image, 300, 78)} loading="lazy" decoding="async" className="w-full h-full object-cover group-active:scale-105 transition-transform duration-300" alt={p.name} />
                    {p.is_kit && <span className="absolute top-1.5 left-1.5 z-10 flex items-center gap-1 bg-gradient-to-r from-amber-400 to-pink-500 text-zinc-950 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md"><Zap size={8} className="fill-zinc-950"/> Kit</span>}
                  </div>
                  <p className="text-[9px] font-black uppercase text-zinc-300 truncate">{p.name}</p>
                  <p className="text-[10px] font-black text-emerald-500">{formatBRL(p.promotional_price || p.price || 0)}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {filteredProducts.length > 0 && (
          <div className="flex items-center justify-between gap-3 pt-1 animate-in">
            <span className="text-[10px] font-black uppercase tracking-widest text-white/90 shrink-0">Peças Disponíveis</span>
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-300 flex items-center gap-1.5 shrink-0" data-testid="products-count">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 animate-pulse"></span>
                {filteredProducts.length} {filteredProducts.length === 1 ? 'peça' : 'peças'}
              </span>
              <select
                value={sortMode}
                onChange={(e) => { setSortMode(e.target.value); setCurrentPage(1); }}
                aria-label="Ordenar"
                className="bg-zinc-900 border border-white/10 rounded-lg text-[10px] font-black uppercase tracking-wider text-zinc-200 px-2.5 py-1.5 outline-none focus:border-emerald-500/50 cursor-pointer appearance-none"
                style={{ backgroundImage: 'none' }}
              >
                <option value="relevancia">Ordenar: Relevância</option>
                <option value="novidades">Novidades</option>
              </select>
            </div>
          </div>
        )}

        {!productsLoaded && (products || []).length === 0 ? (
           /* SKELETON — 1º acesso sem cache: nunca mostrar catálogo vazio nem produto demo */
           <div className="products-grid-container grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2.5 lg:gap-4 -mx-5 lg:mx-0 px-1 lg:px-0 w-[calc(100%+40px)] lg:w-full" data-testid="products-skeleton">
             {Array.from({ length: 8 }).map((_, i) => (
               <div key={i} className="rounded-2xl overflow-hidden border flex flex-col" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                 <div className="aspect-[4/5] bg-zinc-800/50 animate-pulse" />
                 <div className="p-3 space-y-2">
                   <div className="h-2.5 w-3/4 bg-zinc-800/60 rounded animate-pulse" />
                   <div className="h-4 w-1/2 bg-zinc-800/60 rounded animate-pulse" />
                   <div className="h-8 w-full bg-zinc-800/40 rounded-md animate-pulse" />
                 </div>
               </div>
             ))}
           </div>
        ) : filteredProducts.length === 0 ? (
           <div className="text-center py-20 opacity-50 animate-in">
               <Package size={48} className="mx-auto mb-4 text-zinc-600"/>
               <h3 className="font-black uppercase text-sm tracking-widest text-zinc-400">Nenhum produto encontrado</h3>
               <p className="text-[10px] text-zinc-400 uppercase mt-2">Tente buscar por outro termo ou categoria.</p>
           </div>
        ) : (
           <>
           <div className="products-grid-container grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2.5 lg:gap-4 -mx-5 lg:mx-0 px-1 lg:px-0 w-[calc(100%+40px)] lg:w-full" data-testid="products-grid">
             {paginatedProducts.map((product, idx) => {
               const isOutOfStock = !product.is_kit && product.stock <= 0;
               const hasMultipleImages = [product.image, ...(Array.isArray(product.gallery) ? product.gallery : [])].filter(Boolean).length > 1;
                return (
                  // div puro + hover via CSS: transform só existe ao passar o mouse →
                  // em repouso NÃO há camada GPU → imagem nítida (framer mantinha
                  // will-change:transform sempre ligado = downscale ruim do Chrome).
                  <div
                    key={product.id}
                    className={`cv-card sda-rise group relative rounded-2xl overflow-hidden border flex flex-col touch-manipulation transition-colors duration-200 ${!isOutOfStock ? 'hover:border-white/25' : ''} ${selectedProduct?.id === product.id ? 'border-emerald-500/60' : ''} ${isOutOfStock ? 'opacity-80' : ''}`}
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
                         data-vt-card={product.id}
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
                               <ProductImage src={imgSrc} alt={product.name} isOutOfStock={isOutOfStock} priority={idx < 2 && i === 0} order={i === 0 ? 100 + idx : 2000 + idx * 10 + i} sizes="(min-width: 1536px) 290px, (min-width: 1024px) 19vw, (min-width: 768px) 24vw, 48vw" fixedWidth={isDesktopViewport ? Math.round(360 * Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 2.5)) : undefined} />
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
                                   <span className="absolute top-0 left-0 h-full w-[28%]" style={{ background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.13), transparent)', animation: 'shineSize 6s ease-in-out infinite', animationDelay: shineDelay(product.id) }} />
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
                          background: 'linear-gradient(to bottom, hsl(228 9% 19%) 0%, hsl(228 9% 16%) 100%)',
                          backgroundImage: 'url("https://www.transparenttextures.com/patterns/egg-shell.png")',
                          backgroundSize: '100px',
                          boxShadow: '0 -1px 0 rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.04)',
                        }}
                        onClick={() => !isOutOfStock && handleProductClick(product)}
                      >
                        {/* Água WebGL na base do card: ondas suaves de luz seguem
                            o mouse POR BAIXO do nome/preço (conteúdo fica no z 6).
                            Desktop only; canvas nasce no hover e morre depois. */}
                        {!isOutOfStock && !prefersReducedMotion && <WaterRippleFX />}
                        <div style={{ position: 'relative', zIndex: 6 }}>
                          {/* Linha 1 — nome. É o que o cliente compra: legível (11.5px, quase branco),
                              2 linhas com altura RESERVADA (cards continuam alinhados no grid). */}
                          <h3 className="uppercase line-clamp-2 mb-1.5" style={{ color: '#E4E4E7', fontSize: '11.5px', fontWeight: 600, letterSpacing: '0.04em', lineHeight: 1.35, minHeight: '2.7em' }}>
                            {product.name}
                          </h3>
                          {(() => {
                            const live = !isOutOfStock && isOfferLive(product);
                            const promo = product.promotional_price;
                            const hasPromo = !isOutOfStock && !live && promo && promo < product.price;
                            const mainPrice = live ? offerPrice(product) : (hasPromo ? promo : product.price);
                            const showStrike = live || hasPromo;
                            return (
                              <>
                                {/* Linha 2 — preço (com riscado) + botão SEMPRE lado a lado.
                                    O Pix/contador saiu daqui pra uma linha própria abaixo, então
                                    o botão tem espaço e nunca sobrepõe o preço, mesmo em cards estreitos. */}
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <div className="flex flex-col leading-none min-w-0">
                                    {showStrike && (
                                      <span style={{ color: '#71717A', fontSize: '10px', fontWeight: 600, textDecoration: 'line-through' }}>
                                        {formatBRL(product.price || 0)}
                                      </span>
                                    )}
                                    <p className="leading-none" style={{ color: isOutOfStock ? 'var(--text-muted)' : (live ? '#fde68a' : '#F3F4F6'), fontSize: '16px', fontFamily: "'DM Sans', sans-serif", fontWeight: '800', letterSpacing: '-0.01em', textDecoration: isOutOfStock ? 'line-through' : 'none', marginTop: showStrike ? '2px' : 0, whiteSpace: 'nowrap', textShadow: (!isOutOfStock && live) ? '0 0 16px rgba(245,200,100,0.45)' : 'none' }}>
                                      {formatBRL(mainPrice || 0)}
                                    </p>
                                  </div>
                                  {!isOutOfStock && (
                                    <motion.button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); handleProductClick(product); }}
                                      whileHover={prefersReducedMotion ? {} : { scale: 1.04, transition: { duration: 0.15, ease: 'easeOut' } }}
                                      whileTap={prefersReducedMotion ? {} : { scale: 0.96, transition: { duration: 0.08 } }}
                                      style={{
                                        height: '32px', padding: '0 12px', borderRadius: '6px', flexShrink: 0,
                                        background: 'linear-gradient(135deg, #D4D4D4 0%, #A8A8A8 50%, #C8C8C8 100%)',
                                        color: '#1a1a1a', fontWeight: '700', fontSize: '10px',
                                        letterSpacing: '0.08em', textTransform: 'uppercase',
                                        border: '1px solid rgba(255,255,255,0.15)',
                                        boxShadow: '0 1px 4px rgba(0,0,0,0.4), 0 0 14px rgba(255,255,255,0.10)',
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
                                              animationDelay: shineDelay(product.id),
                                            }} />
                                          </span>
                                        </>
                                      )}
                                      COMPRAR
                                    </motion.button>
                                  )}
                                </div>
                                {/* Linha 2b — Pix / contador: LARGURA CHEIA embaixo, não disputa espaço com o botão */}
                                {!isOutOfStock && live ? (
                                  <OfferCountdown
                                    target={offerEndsAt(product)}
                                    variant="compact"
                                    onExpire={bumpOffers}
                                    style={{ marginBottom: '6px' }}
                                  />
                                ) : !isOutOfStock ? (
                                  <span style={{ color: '#A1A1AA', fontSize: '9.5px', fontWeight: 600, letterSpacing: '0.02em', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ color: '#32BCAD', display: 'inline-flex' }}><PixIcon size={11} /></span>
                                    {formatBRL((mainPrice || 0) * 0.95)} no Pix
                                  </span>
                                ) : null}
                              </>
                            );
                          })()}

                          {/* Selo de frete / entrega local */}
                          {!isOutOfStock && (
                            <div className="flex items-center gap-1.5 mb-1.5" style={{ color: '#4ADE80' }}>
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
                  </div>
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
);

export default CatalogMain;
