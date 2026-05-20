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
    updated_at: new Date().toISOString(),
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
    .order('id', { ascending: true });
  if (error) throw error;
  return data || [];
}

// Insere ou atualiza (upsert) um banner.
export async function upsertBanner(banner) {
  const payload = {
    id: banner.id,
    title: banner.title || '',
    subtitle: banner.subtitle || '',
    button_text: banner.buttonText || banner.button_text || 'VER PEÇAS',
    collection_name: banner.collection_name || null,
    image: banner.image || '',
    active: !!banner.active,
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
