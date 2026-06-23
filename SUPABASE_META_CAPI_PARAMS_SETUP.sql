-- ===== EMQ / CAPI — parâmetros do cliente no pedido =====
-- Captura no checkout (quando o CLIENTE está no site) e guarda no pedido, pra
-- enviar no Purchase (disparado depois pelo admin). Sem isso, o Purchase ia com
-- os dados do ADMIN (IP/UA/cookies errados) → EMQ baixo.
--   fbp       cookie _fbp do cliente
--   fbc       cookie _fbc (ou reconstruído do fbclid: fb.1.<ts>.<fbclid>)
--   client_ua user agent do navegador do cliente
--   src_url   URL onde o cliente estava (event_source_url)

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS fbp text,
  ADD COLUMN IF NOT EXISTS fbc text,
  ADD COLUMN IF NOT EXISTS client_ua text,
  ADD COLUMN IF NOT EXISTS src_url text;
