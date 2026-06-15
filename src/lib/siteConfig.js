import { supabase } from './supabaseClient';

// Valores default — usados enquanto o Supabase ainda não carregou ou falhou
export const DEFAULT_CONFIG = {
  brandName: 'FLUXO OUTLET EXCLUSIVE',
  whatsapp: '5534984148067',
  location: 'UBERABA, MG',
  minOrder: 0,
  pixelId: '',
  logoUrl: '',
  logoZoom: 1.5,
  marqueePhrases: [
    'ALTO PADRÃO EM CADA DETALHE',
    'ENVIO PRIORITÁRIO',
    'COLEÇÕES LIMITADAS',
    'DESIGN AUTÊNTICO E EXCLUSIVO',
  ],
  category_images: {},
  // Ordem dos carrosséis de oferta na home (quais aparecem primeiro)
  offerCampaignOrder: ['dia', 'semana', 'mes'],
};

// row supabase -> shape usado no app (camelCase)
const rowToConfig = (row) => ({
  brandName: row.brand_name || DEFAULT_CONFIG.brandName,
  whatsapp: row.whatsapp || DEFAULT_CONFIG.whatsapp,
  location: row.location || DEFAULT_CONFIG.location,
  minOrder: Number(row.min_order || 0),
  pixelId: row.pixel_id || '',
  logoUrl: row.logo_url || '',
  logoZoom: Number(row.logo_zoom || 1.5),
  marqueePhrases: Array.isArray(row.marquee_phrases) ? row.marquee_phrases : DEFAULT_CONFIG.marqueePhrases,
  category_images: (row.category_images && typeof row.category_images === 'object') ? row.category_images : {},
  offerCampaignOrder: Array.isArray(row.offer_campaign_order) && row.offer_campaign_order.length > 0
    ? row.offer_campaign_order
    : DEFAULT_CONFIG.offerCampaignOrder,
});

// Busca a config global (id='main')
export async function fetchSiteConfig() {
  const { data, error } = await supabase
    .from('site_config')
    .select('*')
    .eq('id', 'main')
    .maybeSingle();
  if (error) throw error;
  if (!data) return DEFAULT_CONFIG;
  return rowToConfig(data);
}

// Atualiza a config (upsert)
export async function upsertSiteConfig(config) {
  const payload = {
    id: 'main',
    brand_name: String(config.brandName || DEFAULT_CONFIG.brandName),
    whatsapp: String(config.whatsapp || '').replace(/\D/g, ''),
    location: String(config.location || ''),
    min_order: Number(config.minOrder || 0),
    pixel_id: String(config.pixelId || ''),
    logo_url: String(config.logoUrl || ''),
    logo_zoom: Number(config.logoZoom || 1.5),
    marquee_phrases: Array.isArray(config.marqueePhrases) ? config.marqueePhrases : [],
    category_images: (config.category_images && typeof config.category_images === 'object') ? config.category_images : {},
    offer_campaign_order: Array.isArray(config.offerCampaignOrder) && config.offerCampaignOrder.length > 0
      ? config.offerCampaignOrder
      : DEFAULT_CONFIG.offerCampaignOrder,
  };
  const { data, error } = await supabase
    .from('site_config')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single();
  if (error) throw error;
  return rowToConfig(data);
}
