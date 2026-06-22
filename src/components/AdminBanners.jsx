import { useEffect, useState } from 'react';
import { Edit3, ImagePlus, Trash2, X } from 'lucide-react';

const AdminBanners = ({ banners, setBanners, showToast, bannerImageFile, setBannerImageFile, uploadImage }) => {
  const [editBannerMode, setEditBannerMode] = useState(null);
  const [previewBannerImage, setPreviewBannerImage] = useState('');
  const [bannerDesktopFile, setBannerDesktopFile] = useState(null);
  const [previewDesktopImage, setPreviewDesktopImage] = useState('');
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [placement, setPlacement] = useState('hero'); // 'hero' (topo) | 'mid' (meio, 2:1)
  const isMid = placement === 'mid';
  useEffect(() => {
    setPreviewBannerImage(editBannerMode?.image || '');
    setBannerImageFile(null);
    setPreviewDesktopImage(editBannerMode?.image_desktop || '');
    setBannerDesktopFile(null);
    setPlacement(editBannerMode?.placement || 'hero');
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

  const handleBannerDesktopFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setBannerDesktopFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewDesktopImage(reader.result);
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
        showToast('Enviando banner mobile em alta resolução...', 'info');
        imageUrl = await uploadImage(bannerImageFile);
      }
      let imageDesktopUrl = editBannerMode?.image_desktop || '';
      if (bannerDesktopFile) {
        showToast('Enviando banner desktop em alta resolução...', 'info');
        imageDesktopUrl = await uploadImage(bannerDesktopFile);
      }
      const fd = new FormData(e.target);
      const data = {
        id: editBannerMode === 'new' ? Date.now() : editBannerMode.id,
        title: fd.get('title'),
        subtitle: fd.get('subtitle'),
        buttonText: fd.get('buttonText'),
        collection_name: fd.get('collection_name'),
        image: imageUrl,
        image_desktop: imageDesktopUrl || null,
        active: fd.get('active') === 'on',
        banner_order: parseInt(fd.get('banner_order') || '999', 10),
        external_link: isMid ? null : (fd.get('external_link') || null),
        placement,
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
              <img src={b.image || b.image_desktop} className="w-20 h-12 rounded-lg object-cover" alt="Banner" />
              <div className="flex-1 truncate">
                <div className="flex items-center gap-1.5">
                  <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${b.placement === 'mid' ? 'bg-sky-500/15 text-sky-400' : 'bg-emerald-500/15 text-emerald-400'}`}>{b.placement === 'mid' ? 'Meio' : 'Topo'}</span>
                  <h4 className="font-black text-white text-[10px] uppercase truncate">{b.title || (b.placement === 'mid' ? 'Sub-banner' : '—')}</h4>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span style={{ fontSize: 9, color: '#52525b', fontWeight: 900 }}>#{b.banner_order}</span>
                  <span className="text-[9px] font-black" style={{ color: b.image ? '#10b981' : '#52525b' }}>📱 {b.image ? 'OK' : '—'}</span>
                  {b.placement !== 'mid' && (
                    <span className="text-[9px] font-black" style={{ color: b.image_desktop ? '#10b981' : '#ef4444' }}>🖥️ {b.image_desktop ? 'OK' : 'falta'}</span>
                  )}
                </div>
              </div>
              <div className="flex gap-1"><button onClick={() => setEditBannerMode(b)} className="p-2 bg-white/5 rounded-lg text-zinc-400"><Edit3 size={12}/></button><button onClick={() => setBanners((banners || []).filter(i => i.id !== b.id))} className="p-2 bg-red-500/10 rounded-lg text-red-500"><Trash2 size={12}/></button></div>
            </div>
          ))}
        </div>
      ) : (
        <form onSubmit={handleSaveBanner} className="bg-zinc-900 p-8 rounded-[32px] border border-white/10 space-y-4 shadow-2xl relative">
          <button type="button" onClick={() => setEditBannerMode(null)} className="absolute top-6 right-6 text-zinc-500"><X/></button>

          {/* Posição na home: Topo (hero 4:5) ou Meio (sub-banner 2:1, decorativo) */}
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-zinc-500 uppercase px-2">Posição na home</label>
            <div className="grid grid-cols-2 gap-2">
              {[['hero', 'Topo (Hero)'], ['mid', 'Meio (Sub-banner)']].map(([val, lbl]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setPlacement(val)}
                  className={`py-3 rounded-2xl text-[10px] font-black uppercase tracking-wide border transition-all active:scale-95 ${placement === val
                    ? 'text-zinc-950 border-transparent bg-emerald-500 shadow-[0_4px_14px_rgba(16,185,129,0.35)]'
                    : 'text-zinc-400 border-white/10 bg-zinc-950 hover:border-emerald-400/40'}`}
                >
                  {lbl}
                </button>
              ))}
            </div>
            <p className="text-[9px] font-bold text-zinc-600 px-2">{isMid ? 'Faixa larga entre Destaques e Peças. Só imagem, sem texto nem clique.' : 'Banner principal do topo (carrossel 4:5 mobile / 16:9 desktop).'}</p>
          </div>

          {/* Imagem principal — 4:5 no hero, 2:1 no sub-banner */}
          <div className={`relative overflow-hidden bg-zinc-950 border-2 border-dashed border-white/10 rounded-[20px] ${isMid ? 'aspect-[2/1]' : 'aspect-[4/5] max-h-64'} flex flex-col items-center justify-center cursor-pointer`}>
            {previewBannerImage ? <img src={previewBannerImage} className="absolute inset-0 w-full h-full object-cover opacity-60" alt="Preview" /> : <ImagePlus size={32} className="text-zinc-800" />}
            <span className="relative z-10 text-[9px] font-black uppercase text-white text-center px-4">{isMid ? '🖼️ Sub-banner · 2:1 (ex: 1600×800px)' : '📱 Banner Mobile · 4:5 (ideal 1600×2000px)'}</span>
            <input type="file" accept="image/*" onChange={handleBannerFileChange} className="absolute inset-0 opacity-0 cursor-pointer" />
          </div>

          {!isMid && (
            <>
              {/* Banner DESKTOP — horizontal 16:9 */}
              <div className="relative overflow-hidden bg-zinc-950 border-2 border-dashed border-white/10 rounded-[20px] aspect-video flex flex-col items-center justify-center cursor-pointer">
                {previewDesktopImage ? <img src={previewDesktopImage} className="absolute inset-0 w-full h-full object-cover opacity-60" alt="Preview desktop" /> : <ImagePlus size={32} className="text-zinc-800" />}
                <span className="relative z-10 text-[9px] font-black uppercase text-white text-center px-4">🖥️ Banner Desktop · 16:9 (1920×1080px)</span>
                <input type="file" accept="image/*" onChange={handleBannerDesktopFileChange} className="absolute inset-0 opacity-0 cursor-pointer" />
              </div>
              <span style={{ fontSize: 9, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Suba as duas versões: 4:5 aparece no celular, 16:9 no computador. Se faltar a do desktop, ele usa a do celular.</span>
              <input name="title" defaultValue={editBannerMode?.title} placeholder="Título (opcional)" className="w-full p-4 bg-zinc-950 border border-white/5 rounded-2xl text-sm text-white outline-none" />
              <input name="subtitle" defaultValue={editBannerMode?.subtitle} placeholder="Subtítulo" className="w-full p-4 bg-zinc-950 border border-white/5 rounded-2xl text-sm text-white outline-none" />
	          <div className="space-y-1">
	            <label className="text-[9px] font-black text-zinc-500 uppercase px-2">Texto do botão (opcional — deixe vazio para ocultar)</label>
	            <input name="buttonText" defaultValue={editBannerMode?.buttonText || ''} placeholder="Ex: VER PEÇAS (vazio = sem botão)" className="w-full p-4 bg-zinc-950 border border-white/5 rounded-2xl text-sm text-white outline-none uppercase" />
	          </div>
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
            </>
          )}
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

export default AdminBanners;
