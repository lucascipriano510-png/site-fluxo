import { Menu, ShoppingBag, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { pluralCat } from '../lib/catalogUi';
import { optimizeImage } from '../lib/images';

// Logo passa pelo wsrv como toda imagem do site: upload cru de 1-5MB no
// elemento mais visto de todos é contradição fatal (pesquisa módulo 4).
// `&we` do proxy não amplia logo pequeno — se já for leve, nada muda.
const LOGO_W = 540; // 180px de caixa × DPR 3

// Extraído do App.jsx (verbatim) — recebe estado/handlers do App por props.
const HeaderBar = ({
  cart,
  cartBounce,
  categories,
  config,
  handleOpenUserDrawer,
  selectedCategory,
  setActiveCollectionFilter,
  setCurrentPage,
  setKitsOnly,
  setSearchQuery,
  setSelectedCategory,
  setSelectedProduct,
  setSelectedSize,
  setSelectedSizes,
  setSelectedSubcategory,
  setShowCart,
  setShowQuickMenu,
  userProfile,
}) => (
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
                    src={optimizeImage(config.logoUrl, LOGO_W, 90)}
                    alt={config.brandName}
                    style={{ transform: `scale(${config.logoZoom || 1})`, maxWidth: '180px', maxHeight: '70px' }}
                    className="w-full h-full object-contain mix-blend-screen transition-transform"
                  />
                </div>
                {/* DESKTOP logo — container fixo, alinhado à esquerda */}
                <div className="hidden lg:flex w-[160px] h-[58px] overflow-hidden shrink-0 items-center justify-start">
                  <img
                    src={optimizeImage(config.logoUrl, LOGO_W, 90)}
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
                {pluralCat(cat)}
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
                      ? 'bg-flux/10 border-2 border-flux/55 hover:border-flux'
                      : 'bg-zinc-900 border border-white/15 hover:border-white/40 hover:bg-zinc-800'
                  }`}
                >
                  {initials ? (
                    <span className="text-[11px] font-black text-flux leading-none select-none">
                      {initials}
                    </span>
                  ) : (
                    <User size={15} className="text-zinc-400" />
                  )}
                  {userProfile && (
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-flux rounded-full border-2 border-[var(--flux-void)] shadow-[0_0_7px_rgba(232,234,236,0.45)]" />
                  )}
                </button>
              );
            })()}
            <button onClick={() => setShowCart(true)} data-testid="btn-header-cart" className="relative p-2 touch-manipulation">
              <motion.div
                animate={cartBounce ? { scale: [1, 1.3, 0.9, 1.1, 1], rotate: [0, -8, 6, -3, 0] } : { scale: 1 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className={cartBounce ? 'text-flux' : 'text-white hover:text-flux'}
              >
                <ShoppingBag size={24} />
              </motion.div>
              {cart.length > 0 && (
                <motion.span
                  key={cart.reduce((a,i)=>a+i.quantity,0)}
                  initial={{ scale: 0.5 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                  className="absolute top-0 right-0 bg-flux text-flux-ink text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-[var(--flux-void)] shadow-[0_0_10px_rgba(232,234,236,0.28)]"
                >
                  {cart.reduce((a,i)=>a+i.quantity,0)}
                </motion.span>
              )}
            </button>
          </div>

        </div>
      </header>
);

export default HeaderBar;
