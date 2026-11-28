-- CRM da Fluxo Outlet: tarefas privadas, segmentos e transações atômicas de pedidos/estoque.
-- Transações de venda/estoque e fila de ações CRM, com acesso somente ao backend.

CREATE TABLE IF NOT EXISTS public.whatsapp_crm_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.whatsapp_crm_contacts(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
  reason text NOT NULL DEFAULT 'retorno' CHECK (reason IN ('retorno', 'pos_venda', 'recompra', 'outro')),
  note text CHECK (note IS NULL OR char_length(note) <= 1000),
  due_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS whatsapp_crm_tasks_status_due_idx
  ON public.whatsapp_crm_tasks (status, due_at);
CREATE INDEX IF NOT EXISTS whatsapp_crm_tasks_contact_created_idx
  ON public.whatsapp_crm_tasks (contact_id, created_at DESC);
ALTER TABLE public.whatsapp_crm_tasks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.whatsapp_crm_tasks FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.whatsapp_crm_tasks TO service_role;

CREATE OR REPLACE VIEW public.whatsapp_crm_customer_segments AS
SELECT summary.*,
       CASE WHEN summary.last_purchase_at IS NOT NULL AND summary.avg_days_between_purchases IS NOT NULL
            THEN summary.last_purchase_at + (summary.avg_days_between_purchases::double precision * interval '1 day')
            ELSE NULL END AS next_repurchase_due_at,
       COALESCE(summary.last_purchase_at IS NOT NULL
         AND summary.avg_days_between_purchases IS NOT NULL
         AND summary.last_purchase_at + (summary.avg_days_between_purchases::double precision * interval '1 day') <= now(), false)
         AS is_repurchase_due
  FROM public.whatsapp_crm_customer_summary AS summary;
REVOKE ALL ON TABLE public.whatsapp_crm_customer_segments FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.whatsapp_crm_customer_segments TO service_role;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS crm_sale_request_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS orders_crm_sale_request_id_uidx
  ON public.orders (crm_sale_request_id) WHERE crm_sale_request_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.fluxo_apply_order_stock(p_items jsonb, p_direction integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item jsonb;
  v_product public.products%ROWTYPE;
  v_product_id bigint;
  v_qty integer;
  v_size text;
  v_size_index bigint;
  v_size_stock numeric;
  v_sizes jsonb;
  v_has_object_sizes boolean;
BEGIN
  IF p_direction NOT IN (-1, 1) THEN
    RAISE EXCEPTION 'Direção de movimento de estoque inválida';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'Pedido sem itens válidos';
  END IF;
  IF jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'Pedido sem itens válidos'; END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    BEGIN
      v_product_id := (v_item->>'id')::bigint;
      v_qty := COALESCE(NULLIF(v_item->>'qty', '')::integer, NULLIF(v_item->>'quantity', '')::integer, 1);
    EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
      RAISE EXCEPTION 'Produto ou quantidade inválidos';
    END;
    v_size := COALESCE(NULLIF(btrim(v_item->>'size'), ''), 'U');
    IF v_product_id <= 0 OR v_qty <= 0 OR v_qty > 1000 THEN
      RAISE EXCEPTION 'Produto ou quantidade fora dos limites';
    END IF;

    SELECT * INTO v_product FROM public.products WHERE id = v_product_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Produto não encontrado: %', v_product_id; END IF;
    v_sizes := COALESCE(v_product.sizes, '[]'::jsonb);
    v_has_object_sizes := false;
    IF jsonb_typeof(v_sizes) = 'array' THEN
      IF jsonb_array_length(v_sizes) > 0 THEN
        v_has_object_sizes := jsonb_typeof(v_sizes->0) = 'object';
      END IF;
    END IF;

    IF v_has_object_sizes THEN
      SELECT ordinality, COALESCE(NULLIF(value->>'stock', '')::numeric, 0)
        INTO v_size_index, v_size_stock
        FROM jsonb_array_elements(v_sizes) WITH ORDINALITY AS sizes(value, ordinality)
       WHERE upper(btrim(COALESCE(value->>'size', ''))) = upper(v_size)
       LIMIT 1;
      IF v_size_index IS NULL THEN RAISE EXCEPTION 'Tamanho % não existe no produto %', v_size, v_product_id; END IF;
      IF p_direction = -1 AND (v_size_stock < v_qty OR COALESCE(v_product.stock, 0) < v_qty) THEN
        RAISE EXCEPTION 'Estoque insuficiente para produto % tamanho %', v_product_id, v_size;
      END IF;
      v_sizes := jsonb_set(v_sizes, ARRAY[(v_size_index - 1)::text, 'stock'],
        to_jsonb(GREATEST(0, v_size_stock + (p_direction * v_qty))), false);
    ELSE
      IF p_direction = -1 AND COALESCE(v_product.stock, 0) < v_qty THEN
        RAISE EXCEPTION 'Estoque insuficiente para produto %', v_product_id;
      END IF;
      -- Tamanhos legados como strings não carregam saldo individual; preserva-se
      -- o array original e valida-se/atualiza-se o saldo agregado `stock`.
    END IF;

    UPDATE public.products
       SET stock = GREATEST(0, COALESCE(v_product.stock, 0) + (p_direction * v_qty)),
           sales = GREATEST(0, COALESCE(v_product.sales, 0) - (p_direction * v_qty)),
           sizes = v_sizes,
           updated_at = now()
     WHERE id = v_product_id;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.fluxo_create_whatsapp_sale(
  p_request_id uuid, p_name text, p_phone text, p_items jsonb, p_value numeric,
  p_order_number text, p_decrement_stock boolean DEFAULT true
)
RETURNS SETOF public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_phone text := regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g');
BEGIN
  IF p_request_id IS NULL THEN RAISE EXCEPTION 'Chave idempotente ausente'; END IF;
  SELECT * INTO v_order FROM public.orders WHERE crm_sale_request_id = p_request_id FOR UPDATE;
  IF FOUND THEN RETURN NEXT v_order; RETURN; END IF;
  IF char_length(v_phone) < 10 OR char_length(v_phone) > 15 THEN RAISE EXCEPTION 'Telefone inválido'; END IF;
  IF COALESCE(p_value, 0) <= 0 OR p_value > 10000000 THEN RAISE EXCEPTION 'Valor de venda inválido'; END IF;
  IF COALESCE(p_name, '') = '' OR char_length(p_name) > 200 THEN RAISE EXCEPTION 'Nome inválido'; END IF;
  IF COALESCE(p_order_number, '') = '' OR char_length(p_order_number) > 40 THEN RAISE EXCEPTION 'Número do pedido inválido'; END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN RAISE EXCEPTION 'Itens de venda inválidos'; END IF;
  IF jsonb_array_length(p_items) = 0 OR jsonb_array_length(p_items) > 100 THEN
    RAISE EXCEPTION 'Itens de venda inválidos';
  END IF;

  INSERT INTO public.orders (order_number, name, phone, items, value, status, sales_channel, crm_sale_request_id)
  VALUES (p_order_number, left(btrim(p_name), 200), v_phone, p_items, p_value, 'CONCLUÍDO', 'whatsapp', p_request_id)
  ON CONFLICT (crm_sale_request_id) WHERE crm_sale_request_id IS NOT NULL DO NOTHING
  RETURNING * INTO v_order;
  IF NOT FOUND THEN
    SELECT * INTO v_order FROM public.orders WHERE crm_sale_request_id = p_request_id FOR UPDATE;
    RETURN NEXT v_order; RETURN;
  END IF;

  INSERT INTO public.whatsapp_crm_contacts (phone_digits, display_name)
  VALUES (CASE WHEN char_length(v_phone) IN (10, 11) THEN '55' || v_phone ELSE v_phone END, left(btrim(p_name), 200))
  ON CONFLICT (phone_digits) DO UPDATE
    SET display_name = COALESCE(NULLIF(btrim(public.whatsapp_crm_contacts.display_name), ''), EXCLUDED.display_name),
        updated_at = now();

  IF COALESCE(p_decrement_stock, true) THEN
    PERFORM public.fluxo_apply_order_stock(p_items, -1);
  END IF;
  RETURN NEXT v_order;
END;
$$;

CREATE OR REPLACE FUNCTION public.fluxo_confirm_order_sale(p_order_id bigint)
RETURNS SETOF public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF upper(v_order.status) = 'CONCLUÍDO' THEN RETURN NEXT v_order; RETURN; END IF;
  IF upper(v_order.status) = 'CANCELADO' THEN RAISE EXCEPTION 'Pedido cancelado não pode ser concluído'; END IF;
  PERFORM public.fluxo_apply_order_stock(v_order.items, -1);
  UPDATE public.orders SET status = 'CONCLUÍDO', updated_at = now() WHERE id = p_order_id RETURNING * INTO v_order;
  RETURN NEXT v_order;
END;
$$;

CREATE OR REPLACE FUNCTION public.fluxo_cancel_order(p_order_id bigint)
RETURNS SETOF public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF upper(v_order.status) = 'CANCELADO' THEN RETURN NEXT v_order; RETURN; END IF;
  IF upper(v_order.status) = 'CONCLUÍDO' THEN PERFORM public.fluxo_apply_order_stock(v_order.items, 1); END IF;
  UPDATE public.orders SET status = 'CANCELADO', updated_at = now() WHERE id = p_order_id RETURNING * INTO v_order;
  RETURN NEXT v_order;
END;
$$;

REVOKE ALL ON FUNCTION public.fluxo_apply_order_stock(jsonb, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fluxo_create_whatsapp_sale(uuid, text, text, jsonb, numeric, text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fluxo_confirm_order_sale(bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fluxo_cancel_order(bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fluxo_create_whatsapp_sale(uuid, text, text, jsonb, numeric, text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.fluxo_confirm_order_sale(bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.fluxo_cancel_order(bigint) TO service_role;

-- O checkout continuará podendo gravar pedidos novos, mas sem SELECT público.
-- O código desta branch migra a leitura/admin para rotas server-side primeiro.
DROP POLICY IF EXISTS allow_select_anon ON public.orders;
DROP POLICY IF EXISTS orders_admin_read ON public.orders;
DROP POLICY IF EXISTS orders_admin_update ON public.orders;
DROP POLICY IF EXISTS orders_admin_delete ON public.orders;
DROP POLICY IF EXISTS orders_checkout_insert ON public.orders;
CREATE POLICY orders_checkout_insert ON public.orders
  FOR INSERT TO anon, authenticated WITH CHECK (true);
REVOKE SELECT ON TABLE public.orders FROM PUBLIC, anon, authenticated;
REVOKE UPDATE, DELETE ON TABLE public.orders FROM PUBLIC, anon, authenticated;
REVOKE INSERT ON TABLE public.orders FROM PUBLIC;
GRANT INSERT ON TABLE public.orders TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.orders TO service_role;
