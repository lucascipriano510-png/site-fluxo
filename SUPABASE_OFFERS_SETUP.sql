-- ============================================================
-- OFERTA DO DIA — colunas na tabela products
-- Roda no SQL Editor do Supabase. Seguro reexecutar (IF NOT EXISTS).
-- ============================================================

-- Liga/desliga a oferta no produto
alter table public.products
  add column if not exists offer_active boolean not null default false;

-- Porcentagem de desconto (ex.: 30 = 30% OFF)
alter table public.products
  add column if not exists offer_discount_percent numeric;

-- Último dia em que a oferta vale (INCLUSIVO).
-- A oferta morre na virada: 00:00 (meia-noite) do dia seguinte, fuso local.
alter table public.products
  add column if not exists offer_ends_at date;

-- Índice para consultar ofertas ativas rapidamente (opcional)
create index if not exists idx_products_offer_active
  on public.products (offer_active)
  where offer_active = true;
