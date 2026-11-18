// ID canônico que liga eventos Pixel/CAPI ao item no feed do Meta.
// SKUs únicos permanecem inalterados; somente colisões usam o ID próprio do produto.
const isFeedProduct = (product) =>
  product &&
  product.is_kit !== true &&
  product.is_active !== false &&
  Boolean(product.image) &&
  Number(product.price || 0) > 0;

export function hasDuplicateMetaSku(product, catalogProducts = []) {
  const sku = String(product?.sku || '').trim();
  if (!sku) return false;
  return (catalogProducts || []).filter((candidate) =>
    isFeedProduct(candidate) && String(candidate.sku || '').trim() === sku
  ).length > 1;
}

export function getMetaCatalogId(product, catalogProducts = []) {
  if (!product) return '';
  const sku = String(product.sku || '').trim();
  if (sku && hasDuplicateMetaSku(product, catalogProducts)) {
    return String(product.id);
  }
  return sku || String(product.id);
}
