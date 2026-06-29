-- =====================================================================
-- FLUXO OUTLET — Vídeo opcional do produto (pop-up flutuante)
-- Adiciona products.video_url + bucket público 'product-videos'.
-- O vídeo (mudo/loop) aparece num quadradinho no canto inferior esquerdo
-- da página do produto, SÓ quando o produto tem video_url. Opcional.
-- Já aplicado via MCP (migration add_product_video). Idempotente.
-- =====================================================================

-- Coluna opcional de vídeo do produto
alter table public.products add column if not exists video_url text;

-- Bucket público de vídeos (limite 50MB, formatos web comuns)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-videos', 'product-videos', true, 52428800,
        array['video/mp4','video/webm','video/quicktime','video/ogg'])
on conflict (id) do update
  set public = true,
      file_size_limit = 52428800,
      allowed_mime_types = excluded.allowed_mime_types;

-- Policies espelhadas do bucket product-images (role public)
drop policy if exists "product-videos public read" on storage.objects;
create policy "product-videos public read" on storage.objects
  for select to public using (bucket_id = 'product-videos');

drop policy if exists "product-videos insert" on storage.objects;
create policy "product-videos insert" on storage.objects
  for insert to public with check (bucket_id = 'product-videos');

drop policy if exists "product-videos delete" on storage.objects;
create policy "product-videos delete" on storage.objects
  for delete to public using (bucket_id = 'product-videos');
