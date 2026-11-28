-- =====================================================================
-- FLUXO OUTLET — Setup da tabela `orders` no Supabase
-- =====================================================================
-- LEGADO: NÃO EXECUTAR NO BANCO ATUAL. O esquema abaixo é antigo e foi
-- substituído pelas migrations versionadas em supabase/migrations/.
-- Este arquivo é mantido apenas como histórico; a migration atual de segurança
-- mantém INSERT público do checkout sem SELECT e usa API autenticada no painel.
-- Instruções de execução antigas foram removidas para evitar regressão de RLS.
-- =====================================================================

-- 1. Tabela de pedidos
create table if not exists public.orders (
  id           uuid primary key default gen_random_uuid(),
  customer     jsonb not null default '{}'::jsonb,   -- { name, phone, address, ... }
  items        jsonb not null default '[]'::jsonb,   -- [{ id, name, price, qty, size, image }]
  total        numeric(10,2) not null default 0,
  status       text not null default 'pending',      -- pending | confirmed | cancelled
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Índice para listar mais recentes primeiro
create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_status_idx on public.orders (status);

-- 2. RLS (compatibilidade histórica; não executar em produção)
alter table public.orders enable row level security;

-- Clientes podem inserir pedido, mas nenhuma role pública lê ou altera pedidos.
drop policy if exists "orders_anon_insert" on public.orders;
drop policy if exists "allow_insert_anon" on public.orders;
drop policy if exists "allow_select_anon" on public.orders;
drop policy if exists "orders_admin_read" on public.orders;
drop policy if exists "orders_admin_update" on public.orders;
drop policy if exists "orders_admin_delete" on public.orders;
create policy "orders_anon_insert"
  on public.orders for insert to anon, authenticated with check (true);
revoke select, update, delete on public.orders from public, anon, authenticated;
revoke insert on public.orders from public;
grant insert on public.orders to anon, authenticated;

-- 3. Trigger para manter updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();
