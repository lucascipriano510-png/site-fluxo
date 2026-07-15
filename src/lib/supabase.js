import { supabase } from './supabaseClient';

// Re-export do client (caso algum lugar precise)
export { supabase };

// ===== PRODUTOS =====

// Busca todos os produtos (sem cache travado).
export async function fetchProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('id', { ascending: true });
  if (error) throw error;
  return data || [];
}

// Insere ou atualiza (upsert) um produto pelo id.
export async function upsertProduct(product) {
  const payload = {
    id: product.id,
    sku: product.sku || '',
    name: product.name || '',
    price: Number(product.price || 0),
    category: product.category || 'GERAL',
    subcategory: product.subcategory || null,
    image: product.image || '',
    stock: Number(product.stock || 0),
    sales: Number(product.sales || 0),
    sizes: Array.isArray(product.sizes) ? product.sizes : [],
    featured: !!product.featured,
    collection_name: product.collection_name || null,
    is_kit: !!product.is_kit,
    gallery: Array.isArray(product.gallery) ? product.gallery : [],
    video_url: product.video_url || null,
    updated_at: new Date().toISOString(),
    // Campos novos — opcionais, compatíveis com produtos antigos
    is_active: product.is_active !== false,
    color: product.color || null,
    secondary_colors: Array.isArray(product.secondary_colors) && product.secondary_colors.length > 0 ? product.secondary_colors : null,
    product_type: product.product_type || null,
    material: product.material || null,
    search_tags: Array.isArray(product.search_tags) && product.search_tags.length > 0 ? product.search_tags : null,
    bot_description: product.bot_description || null,
    // Descrição da VITRINE (o que o cliente lê na página do produto).
    // Requer SUPABASE_PRODUCT_DESCRIPTION_SETUP.sql rodado no SQL Editor.
    description: product.description || null,
    promotional_price: product.promotional_price != null ? Number(product.promotional_price) : null,
    featured_order: product.featured_order != null ? Number(product.featured_order) : 999,
    // Oferta do Dia
    offer_active: !!product.offer_active,
    offer_discount_percent: product.offer_discount_percent != null ? Number(product.offer_discount_percent) : null,
    offer_ends_at: product.offer_ends_at || null,
    offer_campaign: product.offer_campaign || 'dia',
    offer_order: product.offer_order != null ? Number(product.offer_order) : 999,
  };
  const { data, error } = await supabase
    .from('products')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ===== KIT ITEMS =====

export async function fetchKitItems(kitId) {
  const { data, error } = await supabase
    .from('kit_items')
    .select('*')
    .eq('kit_id', kitId)
    .order('position', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function fetchAllKitItems() {
  const { data, error } = await supabase
    .from('kit_items')
    .select('*')
    .order('position', { ascending: true });
  if (error) throw error;
  return data || [];
}

// Substitui todos os componentes de um Kit pela lista informada.
export async function saveKitItems(kitId, productIds = []) {
  // limpa relações atuais
  const { error: delErr } = await supabase
    .from('kit_items')
    .delete()
    .eq('kit_id', kitId);
  if (delErr) throw delErr;

  if (!productIds.length) return [];

  const rows = productIds.map((pid, idx) => ({
    kit_id: kitId,
    product_id: pid,
    position: idx,
  }));
  const { data, error } = await supabase
    .from('kit_items')
    .insert(rows)
    .select();
  if (error) throw error;
  return data || [];
}


// Remove um produto pelo id.
export async function deleteProduct(id) {
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) throw error;
}

// ===== BANNERS =====

// Busca todos os banners.
export async function fetchBanners() {
  const { data, error } = await supabase
    .from('banners')
    .select('*')
    .order('banner_order', { ascending: true });
  if (error) throw error;
  return data || [];
}

// Insere ou atualiza (upsert) um banner.
export async function upsertBanner(banner) {
  const payload = {
    id: banner.id,
    title: banner.title || '',
    subtitle: banner.subtitle || '',
    button_text: banner.buttonText ?? banner.button_text ?? '',
    collection_name: banner.collection_name || null,
    image: banner.image || '',
    image_desktop: banner.image_desktop || null,
    active: !!banner.active,
    banner_order: typeof banner.banner_order === 'number' ? banner.banner_order : 999,
    external_link: banner.external_link || null,
    placement: banner.placement === 'mid' ? 'mid' : 'hero',
    wa_message: banner.wa_message || null,
    video_url: banner.video_url || null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('banners')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Remove um banner pelo id.
export async function deleteBanner(id) {
  const { error } = await supabase.from('banners').delete().eq('id', id);
  if (error) throw error;
}

// ===== STORAGE (IMAGENS) =====

/**
 * Faz o upload de um arquivo para o bucket 'product-images' e retorna a URL pública.
 * @param {File} file - O arquivo original (sem compressão).
 * @returns {Promise<string>} - A URL pública da imagem.
 */
export async function uploadImage(file) {
  if (!file) return null;
  
  // Gera um nome único para o arquivo para evitar colisões
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
  const filePath = `uploads/${fileName}`;

  // Faz o upload para o bucket 'product-images'
  const { data, error } = await supabase.storage
    .from('product-images')
    .upload(filePath, file);

  if (error) {
    console.error('[storage] upload falhou:', error.message);
    throw error;
  }

  // Obtém a URL pública
  const { data: { publicUrl } } = supabase.storage
    .from('product-images')
    .getPublicUrl(filePath);

  return publicUrl;
}

// ===== STORAGE (VÍDEOS) =====

/**
 * Faz upload de um vídeo curto do produto para o bucket 'product-videos'
 * e retorna a URL pública. Sem compressão (o navegador toca o MP4 direto,
 * mudo/loop). Mantenha vídeos curtos (5–15s) e leves.
 * @param {File} file
 * @returns {Promise<string>}
 */
export async function uploadVideo(file) {
  if (!file) return null;
  const fileExt = (file.name.split('.').pop() || 'mp4').toLowerCase();
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
  const filePath = `uploads/${fileName}`;

  const { error } = await supabase.storage
    .from('product-videos')
    .upload(filePath, file, { contentType: file.type || 'video/mp4' });

  if (error) {
    console.error('[storage] upload de vídeo falhou:', error.message);
    throw error;
  }

  const { data: { publicUrl } } = supabase.storage
    .from('product-videos')
    .getPublicUrl(filePath);

  return publicUrl;
}
