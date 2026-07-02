import { useEffect, useMemo, useRef, useState } from 'react';
import { Barcode, Camera, Check, Clock, Edit3, Film, Flame, Home, Image as ImageIcon, ImagePlus, Layers, Minus, Plus, RefreshCcw, Scan, ScanLine, Search, Tag, Trash2, Upload, X, Zap } from 'lucide-react';
import { formatBRL } from '../lib/format';
import { CAMPAIGN_LABELS, CAMPAIGN_SHORT, OFFER_CAMPAIGNS, formatDayMonth, todayLocalISO } from '../lib/offers';
import { fetchKitItems, saveKitItems, upsertProduct, uploadVideo } from '../lib/supabase';
import { optimizeImage } from '../lib/images';

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
  const [description, setDescription] = useState(''); // descrição da VITRINE (cliente lê)
  const [promotionalPrice, setPromotionalPrice] = useState('');
  // ===== OFERTA DO DIA =====
  const [offerActive, setOfferActive] = useState(false);
  const [offerDiscount, setOfferDiscount] = useState(''); // % de desconto
  const [offerEndDate, setOfferEndDate] = useState('');   // 'YYYY-MM-DD' (último dia, inclusivo)
  const [offerCampaignSel, setOfferCampaignSel] = useState('dia'); // dia | semana | mes
  const [normalPricePreview, setNormalPricePreview] = useState(''); // espelha o Preço Normal p/ preview

  // ===== KIT (Bundle Builder) =====
  const [isKit, setIsKit] = useState(false);
  const [galleryUrls, setGalleryUrls] = useState([]);
  const [isUploadingGallery, setIsUploadingGallery] = useState(false);
  // Vídeo opcional do produto (pop-up flutuante na página do produto).
  const [videoUrl, setVideoUrl] = useState('');
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
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
      setVideoUrl(editMode.video_url || '');
      setIsActive(editMode.is_active !== false);
      setColor(editMode.color || '');
      setSecondaryColors(Array.isArray(editMode.secondary_colors) ? editMode.secondary_colors : []);
      setProductType(editMode.product_type || '');
      setMaterial(editMode.material || '');
      setSearchTags(Array.isArray(editMode.search_tags) ? editMode.search_tags : []);
      setBotDescription(editMode.bot_description || '');
      setDescription(editMode.description || '');
      setPromotionalPrice(editMode.promotional_price != null ? String(editMode.promotional_price) : '');
      setOfferActive(!!editMode.offer_active);
      setOfferDiscount(editMode.offer_discount_percent != null ? String(editMode.offer_discount_percent) : '');
      setOfferEndDate(editMode.offer_ends_at ? String(editMode.offer_ends_at).slice(0, 10) : '');
      setOfferCampaignSel(editMode.offer_campaign || 'dia');
      setNormalPricePreview(editMode.price != null ? String(editMode.price) : '');
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
      setVideoUrl('');
      setKitComponentIds([]);
      setIsActive(true);
      setColor('');
      setSecondaryColors([]);
      setProductType('');
      setMaterial('');
      setSearchTags([]);
      setBotDescription('');
      setDescription('');
      setPromotionalPrice('');
      setOfferActive(false);
      setOfferDiscount('');
      setOfferEndDate('');
      setOfferCampaignSel('dia');
      setNormalPricePreview('');
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

  const handleVideoFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Limite defensivo: 50MB. Vídeo de produto deve ser curto/leve.
    if (file.size > 50 * 1024 * 1024) {
      showToast('Vídeo muito grande (máx. 50MB). Use um clipe curto/comprimido.', 'error');
      e.target.value = '';
      return;
    }
    setIsUploadingVideo(true);
    try {
      const url = await uploadVideo(file);
      if (url) { setVideoUrl(url); showToast('Vídeo adicionado'); }
    } catch (err) {
      showToast('Erro ao subir vídeo: ' + err.message, 'error');
    } finally {
      setIsUploadingVideo(false);
      e.target.value = '';
    }
  };

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
        video_url: videoUrl || null,
        is_active: isActive,
        color: color || null,
        secondary_colors: secondaryColors.length > 0 ? secondaryColors : null,
        product_type: productType.trim() || null,
        material: material.trim() || null,
        search_tags: searchTags.length > 0 ? searchTags : null,
        bot_description: botDescription.trim() || null,
        description: description.trim() || null,
        promotional_price: promotionalPrice !== '' ? parseFloat(promotionalPrice) : null,
        featured_order: editMode !== 'new' && typeof editMode.featured_order === 'number' ? editMode.featured_order : 999,
        // Oferta do Dia — só vale se tiver % E data de validade
        offer_active: offerActive && offerDiscount !== '' && parseFloat(offerDiscount) > 0 && !!offerEndDate,
        offer_discount_percent: offerDiscount !== '' ? parseFloat(offerDiscount) : null,
        offer_ends_at: offerEndDate || null,
        offer_campaign: offerCampaignSel || 'dia',
        offer_order: editMode !== 'new' && typeof editMode.offer_order === 'number' ? editMode.offer_order : 999,
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
      setVideoUrl('');
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
                           <img src={optimizeImage(scannedProduct.image, 280, 78)} loading="lazy" decoding="async" className="w-24 h-32 object-cover rounded-2xl border border-white/5" alt={scannedProduct.name}/>
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
                    <img src={optimizeImage(url, 200, 72)} loading="lazy" decoding="async" className="w-full h-full object-cover" alt="" />
                    <button type="button" onClick={() => removeGalleryUrl(url)} aria-label="Remover imagem" className="absolute top-1 right-1 z-10 bg-red-500 text-white w-5 h-5 rounded-full flex items-center justify-center shadow-md active:scale-90 transition-transform"><X size={11}/></button>
                  </div>
                ))}
                <label className="aspect-square rounded-xl border-2 border-dashed border-white/15 grid place-items-center cursor-pointer hover:border-emerald-500/50 transition-colors">
                  <Upload size={16} className="text-emerald-500" />
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handleGalleryFiles} />
                </label>
              </div>
              {isUploadingGallery && <p className="text-[9px] text-emerald-400 font-bold uppercase">Enviando imagens...</p>}
            </div>
            {/* Vídeo opcional — vira o pop-up flutuante na página do produto (mudo/loop) */}
            <div className="space-y-2 pt-1">
              <label className="text-[9px] font-black text-zinc-500 uppercase flex items-center gap-1"><Film size={12}/> Vídeo do produto (opcional)</label>
              {videoUrl ? (
                <div className="relative w-[120px] aspect-[3/4] rounded-xl overflow-hidden border border-white/10 bg-zinc-950">
                  <video src={videoUrl} muted loop autoPlay playsInline className="w-full h-full object-cover" />
                  <button type="button" onClick={() => setVideoUrl('')} className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-md"><X size={10}/></button>
                </div>
              ) : (
                <label className="w-[120px] aspect-[3/4] rounded-xl border-2 border-dashed border-white/15 grid place-items-center cursor-pointer hover:border-emerald-500/50 transition-colors">
                  <div className="flex flex-col items-center gap-1">
                    <Upload size={18} className="text-emerald-500" />
                    <span className="text-[8px] font-black uppercase text-zinc-500">Subir vídeo</span>
                  </div>
                  <input type="file" accept="video/*" className="hidden" onChange={handleVideoFile} />
                </label>
              )}
              {isUploadingVideo && <p className="text-[9px] text-emerald-400 font-bold uppercase">Enviando vídeo...</p>}
              <p className="text-[8px] text-zinc-600 leading-snug">Curto (5–15s), comprimido. Toca sozinho mudo num quadradinho flutuante no canto inferior esquerdo.</p>
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
            <div className="space-y-1">
              <label className="text-[9px] font-black text-zinc-500 uppercase px-1">Descrição da peça (aparece pro cliente)</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} placeholder={'Ex: "Peça premium com caimento reto, tecido encorpado que não marca. Gola reforçada, não deforma na lavagem."'} className="w-full p-4 bg-zinc-950 border border-white/5 rounded-2xl text-sm text-white outline-none focus:border-emerald-500/50 resize-none" />
              <p className="text-[8px] font-bold text-zinc-600 uppercase px-1">2–4 linhas vendem mais. Diferente da descrição do bot.</p>
            </div>
          </div>

          {/* BLOCO 5 — PREÇO */}
          <div className="bg-zinc-900 p-5 rounded-[28px] border border-white/5 space-y-3">
            <p className="text-[9px] font-black uppercase tracking-widest text-emerald-500">Preço</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-zinc-500 uppercase px-1">Preço Normal (R$)</label>
                <input name="price" type="number" step="0.01" defaultValue={editMode?.price} onChange={e => setNormalPricePreview(e.target.value)} className="w-full p-4 bg-zinc-950 border border-white/5 rounded-2xl font-bold text-sm text-white focus:border-emerald-500/50 outline-none" required />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-zinc-500 uppercase px-1">Preço Promo (opcional)</label>
                <input type="number" step="0.01" value={promotionalPrice} onChange={e => setPromotionalPrice(e.target.value)} placeholder="—" className="w-full p-4 bg-zinc-950 border border-white/5 rounded-2xl font-bold text-sm text-white focus:border-emerald-500/50 outline-none" />
              </div>
            </div>
          </div>

          {/* BLOCO 5.5 — OFERTA DO DIA */}
          <div className="p-[1.5px] rounded-[28px] bg-gradient-to-br from-amber-400/40 via-amber-500/10 to-red-500/30">
            <div className="bg-zinc-900 p-5 rounded-[27px] space-y-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5" style={{ color: '#fbbf24' }}>
                  <Flame size={12} className="fill-amber-400 text-amber-400"/> Oferta do Dia
                </p>
                <button
                  type="button"
                  onClick={() => setOfferActive(v => !v)}
                  className="flex items-center gap-2"
                  aria-pressed={offerActive}
                >
                  <span className={`text-[10px] font-black uppercase ${offerActive ? 'text-amber-400' : 'text-zinc-500'}`}>{offerActive ? 'Ativa' : 'Desligada'}</span>
                  <div className={`w-10 h-5 rounded-full p-0.5 transition-all ${offerActive ? 'bg-gradient-to-r from-amber-400 to-red-500' : 'bg-zinc-700'}`}>
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${offerActive ? 'translate-x-5' : ''}`} />
                  </div>
                </button>
              </div>

              {offerActive && (
                <div className="space-y-4 animate-in">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-zinc-500 uppercase px-1">Desconto (%)</label>
                      <div className="relative">
                        <input
                          type="number" min="1" max="99" step="1" inputMode="numeric"
                          value={offerDiscount}
                          onChange={e => setOfferDiscount(e.target.value)}
                          placeholder="Ex: 30"
                          className="w-full p-4 pr-9 bg-zinc-950 border border-amber-500/20 rounded-2xl font-bold text-sm text-white outline-none focus:border-amber-400/60"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-amber-400 font-black text-sm pointer-events-none">%</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-zinc-500 uppercase px-1">Válida até (incl.)</label>
                      <input
                        type="date"
                        value={offerEndDate}
                        min={todayLocalISO()}
                        onChange={e => setOfferEndDate(e.target.value)}
                        className="w-full p-4 bg-zinc-950 border border-amber-500/20 rounded-2xl font-bold text-sm text-white outline-none focus:border-amber-400/60 [color-scheme:dark]"
                      />
                    </div>
                  </div>

                  {/* Campanha — onde esta oferta aparece na home */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-zinc-500 uppercase px-1">Campanha</label>
                    <div className="grid grid-cols-3 gap-2">
                      {OFFER_CAMPAIGNS.map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setOfferCampaignSel(c)}
                          className={`py-3 rounded-2xl text-[10px] font-black uppercase tracking-wide border transition-all active:scale-95 ${offerCampaignSel === c
                            ? 'text-zinc-950 border-transparent bg-gradient-to-r from-amber-400 to-red-500 shadow-[0_4px_14px_rgba(245,158,11,0.35)]'
                            : 'text-zinc-400 border-white/10 bg-zinc-950 hover:border-amber-400/40'}`}
                        >
                          {CAMPAIGN_SHORT[c]}
                        </button>
                      ))}
                    </div>
                    <p className="text-[9px] font-bold text-zinc-600 px-1">Aparece no carrossel "{CAMPAIGN_LABELS[offerCampaignSel]}" da home.</p>
                  </div>

                  {/* Preview da oferta — De / Por / -% */}
                  {(() => {
                    const base = parseFloat(normalPricePreview);
                    const pct = parseFloat(offerDiscount);
                    const valid = base > 0 && pct > 0 && pct < 100;
                    const novo = valid ? Math.round(base * (1 - pct / 100) * 100) / 100 : 0;
                    return (
                      <div className="rounded-2xl p-4 bg-zinc-950/60 border border-white/5 flex items-center justify-between gap-3">
                        {valid ? (
                          <>
                            <div className="flex flex-col leading-tight">
                              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wide line-through">De {formatBRL(base)}</span>
                              <span className="text-xl font-black text-white tracking-tight">Por {formatBRL(novo)}</span>
                            </div>
                            <span className="shrink-0 text-[12px] font-black text-zinc-950 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-red-500 shadow-[0_4px_14px_rgba(245,158,11,0.4)]">
                              -{Math.round(pct)}%
                            </span>
                          </>
                        ) : (
                          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">Defina preço normal, % e data para ver o preview</span>
                        )}
                      </div>
                    );
                  })()}

                  <div className="flex items-start gap-2 px-1">
                    <Clock size={12} className="text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-[9.5px] font-bold text-zinc-400 leading-snug">
                      O temporizador busca a <span className="text-amber-300">meia-noite</span>{offerEndDate ? <> — acaba na virada do dia <span className="text-amber-300">{formatDayMonth(offerEndDate)}</span></> : ''}. Itens em oferta <span className="text-amber-300">não recebem</span> os 5% do Pix (a oferta já é o desconto).
                    </p>
                  </div>
                </div>
              )}
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
                      <img src={optimizeImage(p.image, 120, 70)} loading="lazy" decoding="async" className="w-10 h-10 rounded-lg object-cover border border-white/5" alt="" />
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
                <img src={optimizeImage(p.image, 160, 72)} loading="lazy" decoding="async" className={`w-16 h-16 rounded-[20px] object-cover shrink-0 ${p.stock === 0 ? 'grayscale opacity-50' : ''}`} alt={p.name} />
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

export default AdminInventory;
