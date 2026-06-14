-- ============================================================
-- FLUXO OUTLET — Banner Desktop (16:9)
-- Adiciona a coluna para a imagem de banner do desktop.
-- Mobile continua em "image" (4:5); desktop usa "image_desktop" (16:9).
-- Rode isto uma vez no SQL Editor do Supabase.
-- ============================================================

ALTER TABLE banners
  ADD COLUMN IF NOT EXISTS image_desktop text;

-- Opcional: nada mais é necessário. Banners antigos ficam com
-- image_desktop = NULL e o site cai automaticamente na imagem mobile
-- no desktop até você subir a versão 16:9 pelo painel.
