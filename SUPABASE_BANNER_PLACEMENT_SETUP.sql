-- ===== POSIÇÃO DO BANNER NA HOME =====
-- Define onde o banner aparece:
--   'hero' = banner principal do topo (carrossel 4:5 mobile / 16:9 desktop)
--   'mid'  = sub-banner decorativo (faixa 2:1) entre Destaques e Peças
--
-- Editável no admin: Promo (Banners) → "Posição na home".
-- Padrão 'hero' = todos os banners existentes continuam no topo.

ALTER TABLE banners
  ADD COLUMN IF NOT EXISTS placement text NOT NULL DEFAULT 'hero';

-- Mensagem pronta de WhatsApp do sub-banner: ao clicar no ícone, abre a conversa
-- com a loja (config.whatsapp) já com esse texto preenchido. Vazio = sem botão.
ALTER TABLE banners
  ADD COLUMN IF NOT EXISTS wa_message text;
