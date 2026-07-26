import React, { useState, useEffect, useRef } from 'react';
import { Zap, X, ZoomIn, Layers, Check, Plus, ShoppingBag } from 'lucide-react';
import { optimizeImage } from '../lib/images';
import { formatBRL } from '../lib/format';
import { useVisualViewportFrame } from '../hooks/useVisualViewportFrame';

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
        <div className="absolute top-4 left-4 bg-offer text-flux-ink text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full flex items-center gap-1 shadow-[0_4px_8px_rgba(0,0,0,0.3)] pointer-events-none z-10">
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
                src={optimizeImage(activeImage, 1600, 90)}
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
              <span className="text-zinc-600 text-base animate-pulse leading-none">↓</span>
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
                  className="h-full bg-offer rounded-full transition-all duration-300"
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
              <div key={c.id} className={`relative rounded-2xl border transition-all duration-200 p-3 ${included ? (isMissing ? 'bg-red-500/10 border-red-500 animate-pulse' : 'bg-gunmetal border-flux/30') : 'bg-gunmetal/20 border-white/5'}`}>
                {/* Linha de status */}
                {included && (
                  <div className="absolute top-0 left-0 right-0 h-px bg-flux/35 rounded-t-2xl pointer-events-none" />
                )}
                <div className="flex gap-3">
                  <div className="relative shrink-0">
                    <img src={optimizeImage(c.image, 400, 80)} className={`w-16 h-20 rounded-xl object-cover border ${included ? 'border-flux/30' : 'border-white/5 grayscale opacity-50'}`} alt={c.name} loading="lazy" decoding="async" />
                    {included && chosenSize && (
                      <div className="absolute -bottom-1 -right-1 bg-flux text-flux-ink text-[8px] font-black px-1.5 py-0.5 rounded-md leading-none">{chosenSize}</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className={`font-black text-[11px] uppercase leading-tight line-clamp-2 ${included ? 'text-white' : 'text-zinc-500'}`}>{c.name}</h4>
                      <button
                        onClick={() => togglePick(c.id)}
                        className={`shrink-0 w-7 h-7 rounded-lg border-2 grid place-items-center transition-all touch-manipulation ${included ? 'bg-flux border-flux text-flux-ink shadow-[0_0_10px_rgba(232,234,236,0.22)]' : 'bg-zinc-800 border-zinc-600 text-zinc-600 hover:border-zinc-400'}`}
                        aria-label={included ? 'Remover do kit' : 'Adicionar ao kit'}
                      >
                        {included ? <Check size={14} strokeWidth={3} /> : <Plus size={13} strokeWidth={2.5} />}
                      </button>
                    </div>
                    <p className={`font-black text-sm mt-1 ${included ? 'text-flux' : 'text-zinc-500'}`}>{formatBRL(c.price || 0)}</p>
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
                <p className="text-[9px] text-zinc-500 line-through font-bold">{formatBRL(sumOriginal)} completo</p>
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
            className={`w-full py-5 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 touch-manipulation ${includedItems.length === 0 ? 'bg-zinc-900 text-zinc-700' : 'bg-flux text-flux-ink shadow-[0_8px_8px_rgba(0,0,0,0.34)] active:scale-[0.98]'}`}
          >
            <ShoppingBag size={14}/> Adicionar Kit à Sacola
          </button>
        </div>
      </div>
    </div>
  );
};

export default KitModal;
