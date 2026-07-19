# Pesquisas e tecnologia — achados datados

Registro do que foi pesquisado, quando, e o que fazer com isso.
Formato: **[data] achado — fonte — status no projeto**.

## Tecnologia de front

- **[2026-07-10] View Transitions API virou utilizável em produção** (Chrome/Edge
  111+, Safari 18+, Firefox 133+; MPA via @view-transition). Shared-element morph
  = sensação de app nativo. — web.dev/learn/css/view-transitions-spas —
  **IMPLEMENTADO**: morph card→hero (App.handleProductClick + data-vt-card).
- **[2026-07-10] Scroll-driven animations (animation-timeline: view/scroll) são
  baseline universal em 2026** — roda no compositor, zero JS. —
  developer.chrome.com + joshwcomeau.com/animation/scroll-driven-animations —
  **IMPLEMENTADO** (.sda-rise, SÓ touch por causa da mina GPU×nitidez no desktop).
- **[2026-07-10] Scroll-TRIGGERED animations chegam no Chrome 145** (dispara ao
  cruzar offset, declarativo) — Chrome-only por enquanto. **AGUARDAR** interop.
- **[2026-07-10] "Liquid glass" com refração real (feDisplacementMap dentro de
  backdrop-filter) só renderiza em Chromium**; Safari parseia e NÃO renderiza
  (perderia o vidro todo). — kube.io/blog/liquid-glass-css-svg + w3c/svgwg#1142 —
  **NA PRATELEIRA**: se fizer, gate por navigator.userAgentData (só Chromium).

## Tendências e-commerce (2026)

- **[2026-07-10] Direções fortes**: imersão 3D/profundidade, tipografia gigante
  como protagonista, micro-animações contextuais, checkout "invisível" (mínimo
  atrito), performance como design. — figma.com/resource-library/web-design-trends,
  optimonk.com/ecommerce-ux-trends — tipografia gigante **IMPLEMENTADA**
  (marquee Anton + spotlight editorial); resto em avaliação por leva.

## Medições internas (contam como pesquisa)

- **[2026-07-10] 60% das imagens do catálogo estavam FRIAS no wsrv (2,5s/img)** —
  medição própria via tools/warm-image-cache.mjs — causa raiz do "quadrado
  escuro". **RESOLVIDO**: warm de 2001 URLs + GitHub Action a cada 6h.
- **[2026-07-19] O payload de produtos é LEVE (15,6 KB gzip, ~200ms de resposta)**
  — medição via curl no REST do Supabase. O atraso do 1º acesso não era a query:
  era a CASCATA bundle→React→só então buscar (~2,5s). **RESOLVIDO** (45a03bf):
  fetch adiantado no index.html (dispara no parse do HTML; é uma RÉPLICA da
  query do fetchProducts — mudou src/lib/supabase.js, mudar lá também), fontes
  Google sem bloquear render, preload do hero-poster (LCP), cache de config/
  banners pinta até 24h (rede corrige por baixo), pedidos só p/ admin logado.

## Como adicionar

Leu estudo/artigo com efeito prático? Anota: data, 1 frase do achado, link,
e o status (IMPLEMENTAR / AGUARDAR / DESCARTADO e por quê).
