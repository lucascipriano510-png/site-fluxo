import { supabase } from './supabaseClient';

export const fetchRatingsBatch = async (productIds) => {
  if (!productIds || productIds.length === 0) return {};
  const { data, error } = await supabase
    .from('product_reviews')
    .select('product_id, rating')
    .in('product_id', productIds);
  if (error || !data) return {};
  const map = {};
  data.forEach(r => {
    if (!map[r.product_id]) map[r.product_id] = { votes: {}, count: 0 };
    map[r.product_id].votes[r.rating] = (map[r.product_id].votes[r.rating] || 0) + 1;
    map[r.product_id].count += 1;
  });
  Object.keys(map).forEach(id => {
    const { votes, count } = map[id];
    // moda: nota com mais votos; em empate, a maior nota vence
    let mode = 0, maxVotes = 0;
    Object.entries(votes).forEach(([rating, v]) => {
      const r = Number(rating);
      if (v > maxVotes || (v === maxVotes && r > mode)) { mode = r; maxVotes = v; }
    });
    map[id] = { mode, count };
  });
  return map;
};

export const fetchProductReviews = async (productId) => {
  const { data, error } = await supabase
    .from('product_reviews')
    .select('*')
    .eq('product_id', productId)
    .order('created_at', { ascending: false });
  if (error) return [];
  return data || [];
};

export const fetchExistingReview = async (productId, phone) => {
  const { data } = await supabase
    .from('product_reviews')
    .select('id, rating')
    .eq('product_id', productId)
    .eq('customer_phone', phone)
    .maybeSingle();
  return data || null;
};

export const submitReview = async ({ productId, customerName, customerPhone, rating }) => {
  const { data, error } = await supabase
    .from('product_reviews')
    .insert([{ product_id: productId, customer_name: customerName,
               customer_phone: customerPhone, rating }])
    .select().single();
  if (error) throw new Error(error.message);
  return data;
};
