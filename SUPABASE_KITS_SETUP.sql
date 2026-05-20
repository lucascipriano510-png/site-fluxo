-- =====================================================================
-- FLUXO OUTLET — Setup do recurso de KITS (Bundle Builder)
-- =====================================================================
-- COMO USAR:
-- 1. Abra https://supabase.com/dashboard/project/_/sql/new
-- 2. Cole TODO este arquivo e clique em "Run"
-- =====================================================================

-- 1. Colunas novas em products
alter table public.products
  add column if not exists is_kit boolean not null default false;

alter table public.products
  add column if not exists gallery jsonb not null default '[]'::jsonb;

-- 2. Tabela de relação Kit <-> Produtos componentes
create table if not exists public.kit_items (
  kit_id     bigint not null references public.products(id) on delete cascade,
  product_id bigint not null references public.products(id) on delete cascade,
  position   int not null default 0,
  primary key (kit_id, product_id)
);

create index if not exists kit_items_kit_id_idx on public.kit_items(kit_id);

-- 3. RLS
alter table public.kit_items enable row level security;

drop policy if exists "kit_items_public_read" on public.kit_items;
create policy "kit_items_public_read"
  on public.kit_items for select
  to anon, authenticated
  using (true);

drop policy if exists "kit_items_anon_write" on public.kit_items;
create policy "kit_items_anon_write"
  on public.kit_items for all
  to anon, authenticated
  using (true)
  with check (true);
