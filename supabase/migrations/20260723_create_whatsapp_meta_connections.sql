-- Conexões do WhatsApp Embedded Signup. Tokens ficam cifrados pela Function
-- Vercel antes de chegar ao banco; não há acesso do navegador a esta tabela.
CREATE TABLE IF NOT EXISTS public.whatsapp_meta_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id text NOT NULL,
  waba_id text NOT NULL,
  phone_number_id text NOT NULL,
  meta_app_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('connected', 'cancelled', 'error')),
  connected_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  access_token_ciphertext text NOT NULL,
  access_token_iv text NOT NULL,
  access_token_tag text NOT NULL,
  CONSTRAINT whatsapp_meta_connections_identity_key UNIQUE (business_id, waba_id, phone_number_id)
);

ALTER TABLE public.whatsapp_meta_connections ENABLE ROW LEVEL SECURITY;

-- Sem policies: apenas a service role da Function tem acesso (RLS bloqueia anon/authenticated).
CREATE INDEX IF NOT EXISTS idx_whatsapp_meta_connections_business_status
  ON public.whatsapp_meta_connections (business_id, status);
