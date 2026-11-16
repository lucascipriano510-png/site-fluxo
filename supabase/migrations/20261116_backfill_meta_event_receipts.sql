-- Backfill idempotente: copia somente eventos e status CAPI já registrados.
-- Nenhum telefone, valor, hash, nome ou payload bruto é selecionado.
insert into public.meta_event_receipts (
  event_id, event_name, source, status, events_received, http_status,
  fb_trace_id, created_at, updated_at
)
select
  event_id,
  event_name,
  'historico',
  case when status = 'erro' then 'erro' else 'enviado' end,
  case when status = 'enviado' then 1 else 0 end,
  case when status = 'enviado' then 200 else null end,
  fb_trace_id,
  created_at,
  now()
from public.rastreio_conversoes
where event_id is not null
  and status in ('enviado', 'erro')
order by created_at desc
limit 1000
on conflict (event_id) do nothing;
