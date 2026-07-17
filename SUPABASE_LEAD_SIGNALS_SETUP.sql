-- ============================================================
-- CAPTURA DE SINAIS DE LEAD (o "cerco")
-- O SITE grava aqui cada interação relevante com DETALHE do produto.
-- O Fluxo Command lê read-only (mesmo Supabase) p/ classificar e gerar
-- a mensagem pronta. Roda no SQL Editor do Supabase. Idempotente.
-- ============================================================

create table if not exists public.site_lead_signals (
  id            uuid primary key default gen_random_uuid(),
  visitor_id    text not null,                 -- identidade anônima do navegador
  phone         text,                          -- preenchido quando o cliente informa
  name          text,
  event         text not null,                 -- produto_visto | whatsapp_produto | carrinho_add | checkout_aberto | telefone_informado
                                               -- + atenção (lib/attention.js): sessao | marco_sessao | exposicao_elemento | interacao_elemento
  product_id    text,
  product_sku   text,
  product_name  text,
  category      text,
  subcategory   text,
  color         text,
  size          text,
  brand         text,                          -- marca/modelo (product_type)
  material      text,
  price         numeric,
  qty           integer,
  cart_json     jsonb,                         -- snapshot do carrinho (checkout_aberto/telefone_informado)
  meta          jsonb,
  store_id      text,                          -- reservado p/ multi-loja (null = loja única do site)
  created_at    timestamptz not null default now()
);

-- Consultas do Fluxo Command: por telefone, por visitante e por recência.
create index if not exists idx_lead_signals_phone   on public.site_lead_signals (phone);
create index if not exists idx_lead_signals_visitor on public.site_lead_signals (visitor_id);
create index if not exists idx_lead_signals_created  on public.site_lead_signals (created_at);
create index if not exists idx_lead_signals_event    on public.site_lead_signals (event);

-- RLS: o site insere com a anon key (igual aos pedidos). Liberar só INSERT + SELECT.
alter table public.site_lead_signals enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename='site_lead_signals' and policyname='lead_signals_insert') then
    create policy lead_signals_insert on public.site_lead_signals for insert to anon, authenticated with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='site_lead_signals' and policyname='lead_signals_select') then
    create policy lead_signals_select on public.site_lead_signals for select to anon, authenticated using (true);
  end if;
end $$;
