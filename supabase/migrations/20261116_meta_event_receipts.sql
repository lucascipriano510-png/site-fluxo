-- Auditoria mínima de eventos enviados à Meta pela CAPI.
-- Não armazena telefone, nome, payload bruto, IP, user-agent ou URL com query string.
create table if not exists public.meta_event_receipts (
  event_id text primary key,
  event_name text not null,
  source text not null default 'site',
  status text not null default 'pendente'
    check (status = any (array['pendente'::text, 'enviado'::text, 'erro'::text])),
  events_received integer not null default 0,
  http_status integer,
  error_code integer,
  error_subcode integer,
  fb_trace_id text,
  source_path text,
  content_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_meta_event_receipts_created
  on public.meta_event_receipts (created_at desc);
create index if not exists idx_meta_event_receipts_name_status_created
  on public.meta_event_receipts (event_name, status, created_at desc);

alter table public.meta_event_receipts enable row level security;

drop policy if exists meta_event_receipts_select_authenticated
  on public.meta_event_receipts;
create policy meta_event_receipts_select_authenticated
  on public.meta_event_receipts
  for select to authenticated
  using (true);

grant select on public.meta_event_receipts to authenticated;
grant all on public.meta_event_receipts to service_role;

comment on table public.meta_event_receipts is
  'Registro mínimo das respostas da Meta CAPI, sem PII ou payload bruto. events_received informa aceitação pelo endpoint, não atribuição de compra.';
