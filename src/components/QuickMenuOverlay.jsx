import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, ChevronRight, Flame, MessageCircle, Package, Search, Star, X, Zap } from 'lucide-react';

// Extraído do App.jsx (verbatim) — recebe estado/handlers do App por props.
const QuickMenuOverlay = ({
  categories,
  categorySizesMap,
  config,
  expandedSizeCategory,
  handleOpenUserDrawer,
  kitsOnly,
  noveltyMode,
  searchQuery,
  selectedCategory,
  selectedSize,
  setExpandedSizeCategory,
  setKitsOnly,
  setNoveltyMode,
  setSearchQuery,
  setSelectedCategory,
  setSelectedSize,
  setSelectedSubcategory,
  setShowQuickMenu,
  setShowSizeFilter,
  showQuickMenu,
  showSizeFilter,
}) => (
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
                    href={`https://wa.me/${config.whatsapp}?text=${encodeURIComponent('Oi! Tô no site da Fluxo com uma dúvida antes de comprar.')}`}
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
);

export default QuickMenuOverlay;
