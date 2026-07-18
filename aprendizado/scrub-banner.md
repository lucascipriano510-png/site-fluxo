# Sub-banner scrub — troca de conteúdo presa ao scroll (receita guardada)

**[2026-07-18] Testado em protótipo e arquivado pelo dono** ("boa a tentativa,
mas pra prática é inviável" — com as fotos que existiam). A DINÂMICA é boa e
fica guardada aqui pra futuros banners **sem ser foto** (vídeo gerado, 3D,
animação, arte vetorial). Código completo vive no git: commits `bd7f473` (v1)
→ `0ed89e8` (v2) → `33aef15` (v3) → `8be6ce2` (v4, a versão certa da mecânica),
removido em seguida junto deste arquivo.

## O conceito (o que faz ser diferente de vídeo autoplay)

Banner no **fluxo normal da página** — sem pinning, sem seção fixa, sem travar
a rolagem. Só o **conteúdo interno** é dirigido pelo scroll: o quadro exibido é
**função pura da posição do banner na viewport**. Disso vem de graça:

- parou de rolar → congela naquele exato ponto;
- rolou pra cima → **reverte quadro a quadro pelo mesmo caminho**;
- nenhum estado guardado, nenhum "play": o scroll É a linha do tempo.

## A mecânica que FUNCIONOU (v4 — spec do dono)

1. **Âncora = posição do CENTRO do banner na tela**, não % da travessia:
   `q = (vh - (rect.top + rect.height/2)) / vh` → 0 = borda de baixo,
   0.5 = meio da tela, 1 = topo. (Na v1–v3 o progresso era % da travessia
   total e "o banner não sabia onde estava" — estados caíam em pontos
   arbitrários. Ancorar na tela foi o conserto decisivo.)
2. **Estados cravados em posições** (spec literal do dono):
   - surgindo embaixo → estado 1 **pronto** (nada de transição na entrada);
   - pouco antes do meio → estado 2 começa; **no meio da tela → estado 2 completo**;
   - pouquinho depois do meio (q≈0.68) → estado 3 a ~100%;
   - dali até sair → parado no estado final.
   Implementação: poligonal `MAPA_Q = [[0,0],[0.36,.125],[0.50,.375],[0.54,.5],[0.68,.75],[1,1]]`
   mapeando q → tempo da sequência.
3. **Scroll da página é no `#root`** (mina do projeto) — listener nele,
   rAF-throttled, **zero setState no scroll** (canvas/estilos via refs).
4. Títulos/legendas sincronizados nas MESMAS âncoras q (janelas com fade
   separadas — dois títulos legíveis juntos = papa de texto).
5. Frames por **bisseção** (1º, último, meio, quartos…): o scrub responde
   inteiro com ~5 quadros e refina; nunca desenhar substituto a mais de
   4 quadros do alvo (flash de estado errado).
6. Low-end / reduced-motion → imagem estática do estado final.

## Por que morreu com FOTO (pra não repetir)

- Mídia era **retrato** (WhatsApp 464×832) e o formato aprovado era **paisagem
  full-bleed com ~1/3 de tela de altura**: cover corta o conjunto (produto some),
  contain deixa a figura pequena. Geometria não fecha.
- Fonte 464px esticada + frames re-comprimidos (ffmpeg xfade → jpg) = imagem ruim.
- Crossfade assado em ~26 quadros = transição em degraus, sem sutileza.

## Se voltar (banner sem foto), o caminho certo

- **Mídia nativa paisagem**, gerada já no aspecto do banner (ex.: 1600×600),
  ≥720p, enquadramento fixo entre estados.
- Com 2–4 estados estáticos: **NÃO assar frames** — sobrepor as artes em camadas
  e dirigir **opacidade contínua** pelo q (suavidade infinita, 3 downloads,
  qualidade máxima). smoothstep pra easing.
- Com movimento real (vídeo/3D renderizado): aí sim sequência de frames
  (30–60), gerados direto no aspecto final, uma compressão só.
- Pipeline de mídia local: ffmpeg portátil (gyan essentials) — extrair stills
  (`-ss t -frames:v 1`), transição (`xfade`), sequência (`fps=N`).
