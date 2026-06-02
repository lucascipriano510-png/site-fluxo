ALTER TABLE products ADD COLUMN IF NOT EXISTS featured_order integer DEFAULT 999;
CREATE INDEX IF NOT EXISTS idx_products_featured_order ON products(featured_order);
