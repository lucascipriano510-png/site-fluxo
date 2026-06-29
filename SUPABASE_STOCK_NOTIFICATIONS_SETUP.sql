-- =====================================================================
-- FLUXO OUTLET — "Avise-me quando voltar" (estoque esgotado -> lead)
-- Cliente deixa o telefone num tamanho/produto esgotado. O dono ve os
-- pedidos numa aba do admin e avisa pelo WhatsApp quando repor.
-- Ja aplicado via MCP (migration add_stock_notifications). Idempotente.
-- =====================================================================

create table if not exists public.stock_notifications (
  id bigint generated always as identity primary key,
  product_id bigint,
  sku text,
  product_name text,
  size text,
  phone text not null,
  notified boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_stock_notifications_pending
  on public.stock_notifications (notified, created_at desc);

alter table public.stock_notifications enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='stock_notifications' and policyname='stock_notif_insert') then
    create policy stock_notif_insert on public.stock_notifications for insert to anon, authenticated with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='stock_notifications' and policyname='stock_notif_select') then
    create policy stock_notif_select on public.stock_notifications for select to anon, authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='stock_notifications' and policyname='stock_notif_update') then
    create policy stock_notif_update on public.stock_notifications for update to anon, authenticated using (true) with check (true);
  end if;
end $$;
