-- =====================================================================
-- FLUXO OUTLET — Descrição da peça na vitrine
-- Rode este script no SQL Editor do Supabase ANTES de salvar produtos
-- no admin (o upsert passa a enviar a coluna `description`).
--
-- `description` = texto que o CLIENTE vê na página do produto
-- (diferente de `bot_description`, que é a descrição curta pro bot).
-- =====================================================================

ALTER TABLE products ADD COLUMN IF NOT EXISTS description text;

-- Pronto. Nenhuma alteração de RLS necessária (products já é legível
-- pelo público e gravável só pelo admin autenticado).
