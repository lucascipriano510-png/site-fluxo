-- Fluxo Rewards: ledger aditivo, sem alterar o esquema de pedidos existente.
-- Customer identity reuses the existing order phone, normalized to digits.

create table if not exists public.loyalty_settings (
  singleton boolean primary key default true check (singleton),
  discount_percent numeric(5,2) not null default 15 check (discount_percent > 0 and discount_percent <= 100),
  validity_days integer not null default 30 check (validity_days between 1 and 365),
  capped_from_cycle integer not null default 3 check (capped_from_cycle >= 1),
  max_discount numeric(10,2) not null default 30 check (max_discount > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

insert into public.loyalty_settings(singleton) values (true) on conflict (singleton) do nothing;

create table if not exists public.loyalty_customer_stats (
  phone text primary key check (phone ~ '^[0-9]{10,15}$'),
  name text not null default '',
  cycles_completed integer not null default 0 check (cycles_completed >= 0),
  first_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.loyalty_rewards (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  customer_phone text not null references public.loyalty_customer_stats(phone) on update cascade on delete restrict,
  customer_name text not null default '',
  origin_order_id bigint not null references public.orders(id) on delete restrict,
  cycle_number integer not null check (cycle_number > 0),
  discount_percent numeric(5,2) not null check (discount_percent > 0 and discount_percent <= 100),
  max_discount numeric(10,2),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','REDEEMED','EXPIRED','CANCELLED')),
  redeemed_order_id bigint references public.orders(id) on delete restrict,
  redeemed_at timestamptz,
  redeemed_by uuid references auth.users(id) on delete set null,
  discount_amount numeric(10,2),
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users(id) on delete set null,
  cancellation_reason text,
  created_by uuid references auth.users(id) on delete set null,
  constraint loyalty_rewards_cap_nonnegative check (max_discount is null or max_discount > 0),
  constraint loyalty_rewards_redeemed_fields check (
    (status <> 'REDEEMED') or (redeemed_order_id is not null and redeemed_at is not null and discount_amount is not null)
  ),
  constraint loyalty_rewards_cancelled_fields check (
    (status <> 'CANCELLED') or (cancelled_at is not null and length(coalesce(cancellation_reason,'')) > 0)
  )
);

create unique index if not exists loyalty_rewards_one_per_origin_order
  on public.loyalty_rewards(origin_order_id);
create unique index if not exists loyalty_rewards_one_active_per_customer
  on public.loyalty_rewards(customer_phone) where status = 'ACTIVE';
create unique index if not exists loyalty_rewards_one_redemption_per_order
  on public.loyalty_rewards(redeemed_order_id) where redeemed_order_id is not null;
create index if not exists loyalty_rewards_customer_history
  on public.loyalty_rewards(customer_phone, issued_at desc);
create index if not exists loyalty_rewards_status_expiry
  on public.loyalty_rewards(status, expires_at);

alter table public.loyalty_settings enable row level security;
alter table public.loyalty_customer_stats enable row level security;
alter table public.loyalty_rewards enable row level security;
revoke all on public.loyalty_settings from anon, authenticated;
revoke all on public.loyalty_customer_stats from anon, authenticated;
revoke all on public.loyalty_rewards from anon, authenticated;
revoke all on public.loyalty_settings from public;
revoke all on public.loyalty_customer_stats from public;
revoke all on public.loyalty_rewards from public;

create or replace function public.loyalty_get_settings()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare s public.loyalty_settings%rowtype;
begin
  if auth.uid() is null then raise exception 'admin_auth_required' using errcode = '42501'; end if;
  select * into s from public.loyalty_settings where singleton = true;
  return jsonb_build_object('discount_percent',s.discount_percent,'validity_days',s.validity_days,'capped_from_cycle',s.capped_from_cycle,'max_discount',s.max_discount);
end;
$$;

create or replace function public.loyalty_update_settings(
  p_discount_percent numeric,
  p_validity_days integer,
  p_capped_from_cycle integer,
  p_max_discount numeric
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare s public.loyalty_settings%rowtype;
begin
  if auth.uid() is null then raise exception 'admin_auth_required' using errcode = '42501'; end if;
  if p_discount_percent is null or p_discount_percent <= 0 or p_discount_percent > 100
     or p_validity_days is null or p_validity_days < 1 or p_validity_days > 365
     or p_capped_from_cycle is null or p_capped_from_cycle < 1
     or p_max_discount is null or p_max_discount <= 0 then
    raise exception 'invalid_loyalty_settings' using errcode = '22023';
  end if;
  insert into public.loyalty_settings(singleton,discount_percent,validity_days,capped_from_cycle,max_discount,updated_at,updated_by)
  values (true,p_discount_percent,p_validity_days,p_capped_from_cycle,p_max_discount,now(),auth.uid())
  on conflict (singleton) do update set discount_percent=excluded.discount_percent,validity_days=excluded.validity_days,
    capped_from_cycle=excluded.capped_from_cycle,max_discount=excluded.max_discount,updated_at=now(),updated_by=auth.uid()
  returning * into s;
  return jsonb_build_object('discount_percent',s.discount_percent,'validity_days',s.validity_days,'capped_from_cycle',s.capped_from_cycle,'max_discount',s.max_discount);
end;
$$;

create or replace function public.loyalty_search_customers(p_search text default '')
returns table (
  phone text,
  customer_name text,
  cycles_completed integer,
  completed_orders_count bigint,
  latest_order_id bigint,
  latest_order_number text,
  latest_order_value numeric,
  latest_order_at timestamptz,
  active_reward_code text
)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare q text := lower(trim(coalesce(p_search,''))); qdigits text := regexp_replace(coalesce(p_search,''),'[^0-9]','','g');
begin
  if auth.uid() is null then raise exception 'admin_auth_required' using errcode = '42501'; end if;
  return query
  with completed as (
    select o.id, o.order_number, o.name, o.value, o.created_at,
      regexp_replace(coalesce(o.phone,''),'[^0-9]','','g') as digits
    from public.orders o
    where upper(trim(coalesce(o.status,''))) in ('CONCLUÍDO','CONCLUIDO','CONFIRMED')
      and length(regexp_replace(coalesce(o.phone,''),'[^0-9]','','g')) between 10 and 15
  ), grouped as (
    select c.digits, max(c.name) as display_name, count(*)::bigint as order_count
    from completed c group by c.digits
  ), all_customers as (
    select g.digits as customer_phone, g.display_name, g.order_count from grouped g
    union
    select s.phone, s.name, 0::bigint from public.loyalty_customer_stats s
  ), latest as (
    select distinct on (c.digits) c.digits, c.id, c.order_number, c.value, c.created_at
    from completed c order by c.digits, c.created_at desc, c.id desc
  )
  select a.customer_phone,
    coalesce(nullif(s.name,''),nullif(a.display_name,''),'Cliente') as customer_name,
    coalesce(s.cycles_completed,0),coalesce(a.order_count,0),l.id,l.order_number,l.value,l.created_at,
    (select r.code from public.loyalty_rewards r where r.customer_phone=a.customer_phone and r.status='ACTIVE' and r.expires_at>now() order by r.issued_at desc limit 1)
  from all_customers a
  left join public.loyalty_customer_stats s on s.phone=a.customer_phone
  left join latest l on l.digits=a.customer_phone
  where q='' or (qdigits<>'' and a.customer_phone like '%'||qdigits||'%') or lower(coalesce(s.name,a.display_name,'')) like '%'||q||'%'
  order by l.created_at desc nulls last, customer_name
  limit 40;
end;
$$;

create or replace function public.loyalty_issue_reward(p_phone text, p_name text, p_origin_order_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_phone text := regexp_replace(coalesce(p_phone,''),'[^0-9]','','g');
  v_name text := trim(coalesce(p_name,''));
  v_order public.orders%rowtype;
  v_stats public.loyalty_customer_stats%rowtype;
  v_settings public.loyalty_settings%rowtype;
  v_reward public.loyalty_rewards%rowtype;
  v_code text;
  v_cycle integer;
  n integer := 0;
begin
  if auth.uid() is null then raise exception 'admin_auth_required' using errcode = '42501'; end if;
  if length(v_phone) < 10 or length(v_phone) > 15 or p_origin_order_id is null then raise exception 'customer_and_origin_order_required' using errcode = '22023'; end if;
  select * into v_order from public.orders where id=p_origin_order_id for update;
  if not found then raise exception 'origin_order_not_found' using errcode = 'P0002'; end if;
  if upper(trim(coalesce(v_order.status,''))) not in ('CONCLUÍDO','CONCLUIDO','CONFIRMED') then raise exception 'origin_order_must_be_completed' using errcode = '22023'; end if;
  if regexp_replace(coalesce(v_order.phone,''),'[^0-9]','','g') <> v_phone then raise exception 'order_customer_phone_mismatch' using errcode = '22023'; end if;
  select * into v_reward from public.loyalty_rewards where origin_order_id=p_origin_order_id;
  if found then return jsonb_build_object('reward',to_jsonb(v_reward),'already_issued',true); end if;
  if v_name='' then v_name := trim(coalesce(v_order.name,'')); end if;
  insert into public.loyalty_customer_stats(phone,name) values (v_phone,v_name)
  on conflict (phone) do update set name=case when excluded.name<>'' then excluded.name else public.loyalty_customer_stats.name end,updated_at=now();
  select * into v_stats from public.loyalty_customer_stats where phone=v_phone for update;
  update public.loyalty_rewards set status='EXPIRED' where customer_phone=v_phone and status='ACTIVE' and expires_at<=now();
  if exists(select 1 from public.loyalty_rewards where customer_phone=v_phone and status='ACTIVE' and expires_at>now()) then raise exception 'active_reward_already_exists' using errcode = '23505'; end if;
  select * into v_settings from public.loyalty_settings where singleton=true;
  v_cycle := v_stats.cycles_completed + 1;
  loop
    n := n + 1;
    v_code := 'FLX-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,24));
    insert into public.loyalty_rewards(code,customer_phone,customer_name,origin_order_id,cycle_number,discount_percent,max_discount,expires_at,created_by)
    values (v_code,v_phone,coalesce(nullif(v_name,''),v_stats.name,'Cliente'),p_origin_order_id,v_cycle,v_settings.discount_percent,
      case when v_cycle>=v_settings.capped_from_cycle then v_settings.max_discount else null end,
      now()+make_interval(days=>v_settings.validity_days),auth.uid())
    on conflict (code) do nothing returning * into v_reward;
    exit when found;
    if n>=5 then raise exception 'reward_code_generation_failed'; end if;
  end loop;
  return jsonb_build_object('reward',to_jsonb(v_reward),'already_issued',false,'cycles_completed',v_stats.cycles_completed);
end;
$$;

create or replace function public.loyalty_validate_reward(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare r public.loyalty_rewards%rowtype;
begin
  if auth.uid() is null then raise exception 'admin_auth_required' using errcode = '42501'; end if;
  select * into r from public.loyalty_rewards where code=upper(trim(coalesce(p_code,''))) for update;
  if not found then return jsonb_build_object('valid',false,'reason','not_found'); end if;
  if r.status='ACTIVE' and r.expires_at<=now() then update public.loyalty_rewards set status='EXPIRED' where id=r.id returning * into r; end if;
  return jsonb_build_object('valid',r.status='ACTIVE','reason',case when r.status='ACTIVE' then null when r.status='EXPIRED' then 'expired' when r.status='REDEEMED' then 'already_redeemed' when r.status='CANCELLED' then 'cancelled' else 'invalid' end,
    'id',r.id,'code',r.code,'customer_phone',r.customer_phone,'customer_name',r.customer_name,'cycle_number',r.cycle_number,
    'discount_percent',r.discount_percent,'max_discount',r.max_discount,'expires_at',r.expires_at,'status',r.status);
end;
$$;

create or replace function public.loyalty_redeem_reward(p_code text, p_order_id bigint, p_original_subtotal numeric)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  r public.loyalty_rewards%rowtype;
  s public.loyalty_customer_stats%rowtype;
  o public.orders%rowtype;
  v_discount numeric(10,2);
  v_final numeric(10,2);
begin
  if auth.uid() is null then raise exception 'admin_auth_required' using errcode = '42501'; end if;
  if p_order_id is null or p_original_subtotal is null or p_original_subtotal<=0 then raise exception 'order_and_subtotal_required' using errcode='22023'; end if;
  select * into r from public.loyalty_rewards where code=upper(trim(coalesce(p_code,''))) for update;
  if not found then raise exception 'reward_not_found' using errcode='P0002'; end if;
  if r.status='ACTIVE' and r.expires_at<=now() then update public.loyalty_rewards set status='EXPIRED' where id=r.id; raise exception 'reward_expired' using errcode='22023'; end if;
  if r.status<>'ACTIVE' then raise exception 'reward_not_active' using errcode='22023'; end if;
  select * into s from public.loyalty_customer_stats where phone=r.customer_phone for update;
  if not found or r.cycle_number<>s.cycles_completed+1 then raise exception 'reward_cycle_mismatch' using errcode='22023'; end if;
  select * into o from public.orders where id=p_order_id for update;
  if not found then raise exception 'redemption_order_not_found' using errcode='P0002'; end if;
  if upper(trim(coalesce(o.status,''))) not in ('CONCLUÍDO','CONCLUIDO','CONFIRMED') then raise exception 'redemption_order_must_be_completed' using errcode='22023'; end if;
  if regexp_replace(coalesce(o.phone,''),'[^0-9]','','g')<>r.customer_phone then raise exception 'redemption_customer_phone_mismatch' using errcode='22023'; end if;
  v_discount := round(p_original_subtotal*r.discount_percent/100,2);
  if r.max_discount is not null then v_discount := least(v_discount,r.max_discount); end if;
  v_final := round(p_original_subtotal-v_discount,2);
  if abs(round(coalesce(o.value,0),2)-v_final)>0.02 then raise exception 'order_total_does_not_match_reward_discount' using errcode='22023'; end if;
  update public.loyalty_rewards set status='REDEEMED',redeemed_order_id=o.id,redeemed_at=now(),redeemed_by=auth.uid(),discount_amount=v_discount where id=r.id returning * into r;
  update public.loyalty_customer_stats set cycles_completed=cycles_completed+1,updated_at=now() where phone=r.customer_phone returning * into s;
  return jsonb_build_object('ok',true,'reward',to_jsonb(r),'discount_amount',v_discount,'cycles_completed',s.cycles_completed);
end;
$$;

create or replace function public.loyalty_cancel_reward(p_reward_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare r public.loyalty_rewards%rowtype; v_reason text := trim(coalesce(p_reason,''));
begin
  if auth.uid() is null then raise exception 'admin_auth_required' using errcode='42501'; end if;
  if p_reward_id is null or length(v_reason)<3 then raise exception 'cancellation_reason_required' using errcode='22023'; end if;
  update public.loyalty_rewards set status='CANCELLED',cancelled_at=now(),cancelled_by=auth.uid(),cancellation_reason=left(v_reason,500)
    where id=p_reward_id and status='ACTIVE' and expires_at>now() returning * into r;
  if not found then raise exception 'active_reward_not_found' using errcode='P0002'; end if;
  return jsonb_build_object('ok',true,'reward',to_jsonb(r));
end;
$$;

create or replace function public.loyalty_list_rewards(p_search text default '')
returns setof public.loyalty_rewards
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare q text := lower(trim(coalesce(p_search,''))); qdigits text := regexp_replace(coalesce(p_search,''),'[^0-9]','','g');
begin
  if auth.uid() is null then raise exception 'admin_auth_required' using errcode='42501'; end if;
  update public.loyalty_rewards set status='EXPIRED' where status='ACTIVE' and expires_at<=now();
  return query select r.* from public.loyalty_rewards r
   where q='' or (qdigits<>'' and r.customer_phone like '%'||qdigits||'%') or lower(r.customer_name) like '%'||q||'%' or lower(r.code) like '%'||q||'%'
   order by r.issued_at desc limit 200;
end;
$$;

revoke all on function public.loyalty_get_settings() from public, anon;
revoke all on function public.loyalty_update_settings(numeric,integer,integer,numeric) from public, anon;
revoke all on function public.loyalty_search_customers(text) from public, anon;
revoke all on function public.loyalty_issue_reward(text,text,bigint) from public, anon;
revoke all on function public.loyalty_validate_reward(text) from public, anon;
revoke all on function public.loyalty_redeem_reward(text,bigint,numeric) from public, anon;
revoke all on function public.loyalty_cancel_reward(uuid,text) from public, anon;
revoke all on function public.loyalty_list_rewards(text) from public, anon;
grant execute on function public.loyalty_get_settings() to authenticated;
grant execute on function public.loyalty_update_settings(numeric,integer,integer,numeric) to authenticated;
grant execute on function public.loyalty_search_customers(text) to authenticated;
grant execute on function public.loyalty_issue_reward(text,text,bigint) to authenticated;
grant execute on function public.loyalty_validate_reward(text) to authenticated;
grant execute on function public.loyalty_redeem_reward(text,bigint,numeric) to authenticated;
grant execute on function public.loyalty_cancel_reward(uuid,text) to authenticated;
grant execute on function public.loyalty_list_rewards(text) to authenticated;
