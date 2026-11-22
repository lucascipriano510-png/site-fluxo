-- Prevent a reward's issuing purchase from also being used as its redemption purchase.
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
  if p_order_id=r.origin_order_id then raise exception 'redemption_order_cannot_be_origin_order' using errcode='22023'; end if;
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
