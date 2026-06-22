import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Flame, Image, Layers, Megaphone, Minus, Settings, Star, Trash2, Upload } from 'lucide-react';
import { getCatImgData } from '../lib/images';
import { CAMPAIGN_LABELS, CAMPAIGN_SHORT, OFFER_CAMPAIGNS, isOfferLive, offerCampaign, offerEndsAt } from '../lib/offers';
import { upsertProduct } from '../lib/supabase';

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
  const [campaignOrder, setCampaignOrder] = useState(() => {
    const saved = Array.isArray(config.offerCampaignOrder) ? config.offerCampaignOrder.filter(c => OFFER_CAMPAIGNS.includes(c)) : [];
    // garante que todas as campanhas existam na lista, sem duplicar
    return [...saved, ...OFFER_CAMPAIGNS.filter(c => !saved.includes(c))];
  });
  const moveCampaign = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= campaignOrder.length) return;
    const list = [...campaignOrder];
    [list[i], list[j]] = [list[j], list[i]];
    setCampaignOrder(list);
  };
  // Ordem dos PRODUTOS dentro dos carrosséis de oferta (qual aparece primeiro).
  const [offerList, setOfferList] = useState(() =>
    (products || [])
      .filter(p => isOfferLive(p) && (p.is_kit || (p.stock || 0) > 0))
      .sort((a, b) =>
        ((a.offer_order ?? 999) - (b.offer_order ?? 999)) ||
        ((offerEndsAt(a)?.getTime() || 0) - (offerEndsAt(b)?.getTime() || 0))
      )
  );
  const [isSavingOfferOrder, setIsSavingOfferOrder] = useState(false);
  const moveOfferUp = (i) => {
    if (i === 0) return;
    const list = [...offerList];
    [list[i - 1], list[i]] = [list[i], list[i - 1]];
    setOfferList(list);
  };
  const moveOfferDown = (i) => {
    if (i === offerList.length - 1) return;
    const list = [...offerList];
    [list[i], list[i + 1]] = [list[i + 1], list[i]];
    setOfferList(list);
  };
  const handleSaveOfferOrder = async () => {
    setIsSavingOfferOrder(true);
    try {
      const updated = offerList.map((p, idx) => ({ ...p, offer_order: idx + 1 }));
      for (const p of updated) {
        await upsertProduct(p);
      }
      setProducts(prev => prev.map(p => {
        const u = updated.find(u => u.id === p.id);
        return u || p;
      }));
      showToast('Ordem das ofertas atualizada!', 'success');
    } catch {
      showToast('Erro ao salvar ordem.', 'error');
    } finally {
      setIsSavingOfferOrder(false);
    }
  };
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
      offerCampaignOrder: campaignOrder,
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

        {/* SEÇÃO: PROMO — ordem dos carrosséis de oferta */}
        <div className="p-[1.5px] rounded-[32px] bg-gradient-to-br from-amber-400/40 via-amber-500/10 to-red-500/30">
          <div className="bg-zinc-900 p-6 rounded-[31px] space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-widest mb-1 flex items-center gap-2" style={{ color: '#fbbf24' }}><Flame size={14} className="fill-amber-400 text-amber-400"/> Promo · Ofertas</h4>
            <p className="text-[10px] font-bold text-zinc-500 leading-snug">Arraste a ordem dos carrosséis de oferta na home. O de cima aparece primeiro. A campanha de cada produto é definida no cadastro do produto.</p>
            <div>
              {campaignOrder.map((c, i) => {
                const liveCount = (products || []).filter(p => isOfferLive(p) && offerCampaign(p) === c && (p.is_kit || (p.stock || 0) > 0)).length;
                return (
                  <div key={c} className="flex items-center gap-3 py-3 border-b border-white/5">
                    <span className="w-6 h-6 rounded-lg bg-gradient-to-r from-amber-400 to-red-500 text-zinc-950 text-[11px] font-black flex items-center justify-center shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-black text-white truncate">{CAMPAIGN_LABELS[c]}</p>
                      <p className="text-[9px] font-bold text-zinc-500 uppercase">{liveCount} {liveCount === 1 ? 'oferta ativa' : 'ofertas ativas'}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button type="button" onClick={() => moveCampaign(i, -1)} disabled={i === 0} className="w-7 h-7 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all flex items-center justify-center disabled:opacity-30"><ChevronUp size={13}/></button>
                      <button type="button" onClick={() => moveCampaign(i, 1)} disabled={i === campaignOrder.length - 1} className="w-7 h-7 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all flex items-center justify-center disabled:opacity-30"><ChevronDown size={13}/></button>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[9px] font-bold text-zinc-600">Salva junto com o botão "Salvar Sistema" abaixo.</p>

            {/* Ordem dos PRODUTOS dentro dos carrosséis de oferta */}
            <div className="pt-4 border-t border-white/5 space-y-3">
              <h5 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2" style={{ color: '#fbbf24' }}><Flame size={13} className="fill-amber-400 text-amber-400"/> Ordem das Ofertas</h5>
              <p className="text-[10px] font-bold text-zinc-500 leading-snug">Qual produto aparece primeiro dentro de cada carrossel. O de cima vem antes. (A expiração é o desempate quando ficam empatados.)</p>
              {offerList.length === 0 ? (
                <p className="text-[11px] text-zinc-600 text-center py-4">Nenhuma oferta ativa no momento.</p>
              ) : (
                <div>
                  {offerList.map((p, i) => (
                    <div key={p.id} className="flex items-center gap-3 py-2.5 border-b border-white/5">
                      <img src={p.image} alt={p.name} className="w-10 h-10 rounded-lg object-cover shrink-0 bg-zinc-800" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-white truncate">{p.name}</p>
                        <p className="text-[9px] font-black uppercase tracking-wide" style={{ color: '#fbbf24' }}>{CAMPAIGN_SHORT[offerCampaign(p)] || 'Dia'}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button type="button" onClick={() => moveOfferUp(i)} disabled={i === 0} className="w-7 h-7 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all touch-manipulation flex items-center justify-center disabled:opacity-30"><ChevronUp size={13}/></button>
                        <button type="button" onClick={() => moveOfferDown(i)} disabled={i === offerList.length - 1} className="w-7 h-7 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all touch-manipulation flex items-center justify-center disabled:opacity-30"><ChevronDown size={13}/></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button type="button" onClick={handleSaveOfferOrder} disabled={isSavingOfferOrder || offerList.length === 0} className="font-black text-[11px] uppercase tracking-widest rounded-2xl py-4 w-full active:scale-95 transition-transform disabled:opacity-50 text-zinc-950 bg-gradient-to-r from-amber-400 to-red-500">{isSavingOfferOrder ? 'Salvando...' : 'Salvar Ordem das Ofertas'}</button>
            </div>
          </div>
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

export default AdminConfig;
