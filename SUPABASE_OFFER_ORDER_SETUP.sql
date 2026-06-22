-- ===== ORDEM DAS OFERTAS =====
-- Controla qual produto aparece primeiro dentro de cada carrossel de oferta
-- (Dia / Semana / Mês) na home. Menor número = aparece antes.
-- A expiração (offer_ends_at) continua sendo o desempate quando empatam.
--
-- Editável no admin: Configurações → Promo · Ofertas → "Ordem das Ofertas".
-- Padrão 999 = sem prioridade definida (cai pro desempate por expiração).

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS offer_order integer NOT NULL DEFAULT 999;

-- Índice opcional: acelera a ordenação quando há muitas ofertas ativas.
CREATE INDEX IF NOT EXISTS idx_products_offer_order
  ON products (offer_order)
  WHERE offer_active = true;
