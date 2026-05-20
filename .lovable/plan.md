# Recurso de Kits / Bundle Builder

Funcionalidade full-stack para o cliente comprar um "look completo" com itens individuais sendo adicionados ao carrinho separadamente.

## 1. Banco de dados (Supabase)

Migração nova:

- Adicionar colunas em `public.products`:
  - `is_kit boolean not null default false` — marca o produto como Kit.
  - `gallery jsonb not null default '[]'` — URLs adicionais da galeria (além de `image`).
- Nova tabela `public.kit_items`:
  - `kit_id bigint references products(id) on delete cascade`
  - `product_id bigint references products(id) on delete cascade`
  - `position int default 0`
  - Primary key composto `(kit_id, product_id)`
  - RLS pública para leitura, escrita liberada (mesma política dos products).

Kits **não** têm estoque/tamanhos próprios — esses dados são lidos dos produtos vinculados em tempo real.

## 2. Frontend — Navegação

- Botão **"⚡ KITS"** na barra de categorias (entre busca e lista de produtos).
  - Destaque visual: borda gradiente sutil + ícone de raio + bold.
  - Ao clicar: filtra a vitrine para mostrar apenas `is_kit === true`.
  - Sincronizado via URL: `?kits=1` (mesmo padrão de `?categoria=...` já existente).
  - Lido no mount e via `popstate`.

## 3. Página do Kit (modal/sheet do produto)

Quando o produto aberto é um Kit, layout diferente do produto normal:

- **Área 1 — Galeria**: imagem principal grande + tira de miniaturas clicáveis (image + gallery[]). Em mobile, tira horizontal logo abaixo.
- **Área 2 — Bundle Builder**: lista vertical com scrollbar estilizada (`.custom-scrollbar`, já existe no CSS) — essencial para mobile.
  - Cada sub-produto = card horizontal compacto:
    - Thumbnail
    - Nome + preço
    - Checkbox/toggle "incluir no kit" (default = marcado)
    - Chips de tamanhos disponíveis (lidos do produto original, ignorando size com stock=0)
  - Total dinâmico no rodapé somando apenas itens marcados.
  - Botão "Adicionar Kit ao Carrinho":
    - Valida: itens marcados precisam ter tamanho escolhido. Falta → highlight vermelho nos cards faltantes + toast.
    - Itera e chama `addToCart` por item individualmente (mesma função já usada), preservando os tamanhos escolhidos.

## 4. Painel Admin

No formulário de produto (modal de criação/edição):

- Toggle **"É um Kit?"** → quando ligado:
  - Esconde campos de estoque/tamanhos.
  - Mostra: upload múltiplo de imagens (galeria) — salvas em `gallery`.
  - Mostra: campo de busca + multi-select para escolher os produtos que compõem o Kit (lista de products não-kit, busca por nome/SKU). Seleções gravadas em `kit_items` no submit.
- No carregamento do form em modo edição: busca `kit_items` para pré-popular.

## 5. Detalhes técnicos

- Arquivo principal afetado: `src/App.jsx` (modal de produto, admin form, barra de categorias, filtro).
- Reuso: `custom-scrollbar` CSS já existe; `addToCart` já aceita produto+tamanho.
- URL sync: estender a effect existente (linhas ~2086-2099) para também tratar `kits`.
- Cliente Supabase: `src/lib/supabase.js` (sem mudanças, só novos selects/inserts).

## Entregáveis

1. Migração SQL (nova tabela + colunas).
2. Edição `src/App.jsx`: botão KITS na nav, filtro, render condicional do modal de produto, admin form atualizado, lógica do bundle builder.
3. Sem alterações em backend/edge functions — tudo client-side com Supabase.

Sobre o preview: este é um recurso novo (não é refinamento visual de um elemento existente), então não vou gerar prototypes — vou implementar direto após sua aprovação do plano. Posso ajustar visualmente depois com base na sua reação.
