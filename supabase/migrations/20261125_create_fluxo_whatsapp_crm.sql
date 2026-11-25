-- CRM WhatsApp da Fluxo Outlet. Aditivo: preserva orders.id bigint e não toca
-- nas tabelas wa_* / bot_* já usadas pelo módulo multi-loja.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS phone_digits text
  GENERATED ALWAYS AS (
    CASE
      WHEN length(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g')) IN (10, 11)
        THEN '55' || regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g')
      ELSE regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g')
    END
  ) STORED;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS sales_channel text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.orders'::regclass
      AND conname = 'orders_sales_channel_check'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_sales_channel_check
      CHECK (sales_channel IS NULL OR sales_channel IN ('website', 'whatsapp'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS orders_phone_digits_created_at_idx
  ON public.orders (phone_digits, created_at DESC);

CREATE TABLE IF NOT EXISTS public.whatsapp_crm_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_digits text NOT NULL UNIQUE,
  display_name text,
  marketing_opt_in boolean NOT NULL DEFAULT false,
  marketing_opt_in_at timestamptz,
  marketing_opt_out_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_crm_contacts_phone_digits_check
    CHECK (phone_digits ~ '^[0-9]{10,15}$')
);

CREATE TABLE IF NOT EXISTS public.whatsapp_crm_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.whatsapp_crm_contacts(id) ON DELETE CASCADE,
  meta_message_id text NOT NULL UNIQUE,
  direction text NOT NULL DEFAULT 'inbound' CHECK (direction = 'inbound'),
  message_type text NOT NULL,
  content text,
  message_at timestamptz NOT NULL,
  referral jsonb,
  phone_number_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whatsapp_crm_messages_contact_time_idx
  ON public.whatsapp_crm_messages (contact_id, message_at DESC);

ALTER TABLE public.whatsapp_crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_crm_messages ENABLE ROW LEVEL SECURITY;

-- Nenhum acesso direto pelo navegador: apenas rotas server-side com service_role.
REVOKE ALL ON TABLE public.whatsapp_crm_contacts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.whatsapp_crm_messages FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.whatsapp_crm_contacts TO service_role;
GRANT ALL ON TABLE public.whatsapp_crm_messages TO service_role;

CREATE OR REPLACE VIEW public.whatsapp_crm_customer_summary AS
WITH all_phones AS (
  SELECT phone_digits
  FROM public.whatsapp_crm_contacts
  UNION
  SELECT phone_digits
  FROM public.orders
  WHERE phone_digits ~ '^[0-9]{10,15}$'
    AND phone_digits !~ '^0+$'
),
order_stats AS (
  SELECT
    phone_digits,
    (array_agg(name ORDER BY created_at DESC))[1] AS latest_order_name,
    count(*)::integer AS order_count,
    count(*) FILTER (WHERE upper(status) = 'CONCLUÍDO')::integer AS purchase_count,
    max(created_at) FILTER (WHERE upper(status) = 'CONCLUÍDO') AS last_purchase_at,
    min(created_at) FILTER (WHERE upper(status) = 'CONCLUÍDO') AS first_purchase_at,
    sum(value) FILTER (WHERE upper(status) = 'CONCLUÍDO') AS total_spent,
    max(created_at) AS last_order_at,
    min(created_at) AS first_order_at,
    count(*) FILTER (WHERE sales_channel = 'whatsapp')::integer AS whatsapp_sales_count,
    count(*) FILTER (WHERE sales_channel = 'website')::integer AS website_sales_count,
    CASE
      WHEN count(*) FILTER (WHERE upper(status) = 'CONCLUÍDO') > 1 THEN
        round(
          extract(epoch FROM (
            max(created_at) FILTER (WHERE upper(status) = 'CONCLUÍDO') -
            min(created_at) FILTER (WHERE upper(status) = 'CONCLUÍDO')
          )) / 86400.0 /
          (count(*) FILTER (WHERE upper(status) = 'CONCLUÍDO') - 1),
          1
        )
      ELSE NULL
    END AS avg_days_between_purchases
  FROM public.orders
  WHERE phone_digits ~ '^[0-9]{10,15}$'
    AND phone_digits !~ '^0+$'
  GROUP BY phone_digits
),
contact_stats AS (
  SELECT
    c.phone_digits,
    (array_agg(c.id ORDER BY c.created_at))[1] AS contact_id,
    (array_agg(c.display_name ORDER BY c.updated_at DESC)
      FILTER (WHERE c.display_name IS NOT NULL AND btrim(c.display_name) <> ''))[1] AS display_name,
    min(c.created_at) AS first_contact_at,
    bool_or(c.marketing_opt_in) AS marketing_opt_in
  FROM public.whatsapp_crm_contacts c
  GROUP BY c.phone_digits
),
message_stats AS (
  SELECT
    c.phone_digits,
    count(m.id)::integer AS message_count,
    max(m.message_at) AS last_message_at,
    (array_agg(m.content ORDER BY m.message_at DESC)
      FILTER (WHERE m.content IS NOT NULL AND btrim(m.content) <> ''))[1] AS last_message_preview,
    (array_agg(m.referral ORDER BY m.message_at DESC)
      FILTER (WHERE m.referral IS NOT NULL))[1] AS latest_referral
  FROM public.whatsapp_crm_contacts c
  JOIN public.whatsapp_crm_messages m ON m.contact_id = c.id
  GROUP BY c.phone_digits
)
SELECT
  c.contact_id,
  'phone:' || p.phone_digits AS contact_key,
  p.phone_digits,
  COALESCE(c.display_name, o.latest_order_name) AS display_name,
  CASE
    WHEN COALESCE(m.message_count, 0) > 0 THEN COALESCE(m.latest_referral->>'source_type', 'WhatsApp')
    WHEN COALESCE(o.whatsapp_sales_count, 0) > 0 THEN 'Venda manual WhatsApp'
    WHEN COALESCE(o.website_sales_count, 0) > 0 THEN 'Site'
    ELSE NULL
  END AS origin,
  COALESCE(c.marketing_opt_in, false) AS marketing_opt_in,
  COALESCE(m.message_count, 0) > 0 AS has_conversation,
  COALESCE(m.message_count, 0) AS message_count,
  m.last_message_at,
  m.last_message_preview,
  COALESCE(o.order_count, 0) AS order_count,
  COALESCE(o.purchase_count, 0) AS purchase_count,
  COALESCE(o.total_spent, 0) AS total_spent,
  o.last_purchase_at,
  o.avg_days_between_purchases,
  CASE
    WHEN c.first_contact_at IS NULL THEN o.first_order_at
    WHEN o.first_order_at IS NULL THEN c.first_contact_at
    ELSE LEAST(c.first_contact_at, o.first_order_at)
  END AS first_seen_at,
  GREATEST(m.last_message_at, o.last_order_at) AS last_activity_at
FROM all_phones p
LEFT JOIN contact_stats c ON c.phone_digits = p.phone_digits
LEFT JOIN message_stats m ON m.phone_digits = p.phone_digits
LEFT JOIN order_stats o ON o.phone_digits = p.phone_digits;

REVOKE ALL ON TABLE public.whatsapp_crm_customer_summary FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.whatsapp_crm_customer_summary TO service_role;

COMMENT ON TABLE public.whatsapp_crm_contacts IS
  'Contatos criados a partir de mensagens WhatsApp Cloud API; deduplicados por telefone normalizado. Consentimento futuro começa falso.';
COMMENT ON TABLE public.whatsapp_crm_messages IS
  'Mensagens recebidas via WhatsApp Cloud API, deduplicadas pelo ID da Meta; não representa venda.';
COMMENT ON COLUMN public.orders.sales_channel IS
  'Canal da venda quando conhecido: website ou whatsapp; NULL preserva origem desconhecida em pedidos antigos.';
