# site-fluxo — regras do projeto

Loja: **Fluxo Outlet** — streetwear premium, Uberaba/MG. Venda fecha pelo WhatsApp.
Público chega de anúncio/Instagram pelo celular: **mobile-first sempre**.

## Fatos da loja (não deduzir errado)

- Apesar do nome, **NÃO é outlet**: preços padronizados, sem retórica de caça-oferta.
- Os **2 CTAs do card (COMPRAR + WHATSAPP) são necessários** — a venda fecha no WhatsApp. Nunca sugerir remover; no máximo diferenciar peso visual.
- Ofertas com countdown são **reais** (prazo no banco). Nunca criar urgência falsa.

## Copy e voz

Antes de escrever QUALQUER texto visível ao cliente, ler `aprendizado/copy-e-voz.md`.
Resumo sempre-ativo: linguagem Brás/streetwear direta; **proibido o tique "de verdade"**
e qualquer autovalidação ("loja de verdade", "gente de verdade") — o fato convence
sozinho ("loja física", "atendimento humano", "daqui de Uberaba").

## Design

Antes de criar/alterar visual, ler `aprendizado/gatilhos-saturados.md` (o que denuncia
IA/template) e `aprendizado/pesquisas.md` (tecnologias e tendências datadas).
Direção do dono: **melhorar, nunca reconstruir**; sair de "catálogo convencional" e
parecer marca grande; nada de partículas.

## Minas técnicas (pisou, quebrou)

- O scroll da página é no **`#root`**, não no `window`.
- **Service Worker é PROIBIDO** — cache de SW já serviu site velho aqui.
- Nitidez de imagem é **calibrada a dedo no wsrv** (card 360×DPR, q95, sharp=1).
  Não mexer nos parâmetros do wsrv nem trocar o pipeline sem aval do dono.
  Mudou `src/lib/images.js`? Atualizar `tools/warm-image-cache.mjs` (réplica).
- **Transform/GPU persistente em card no desktop = imagem borrada** (ver comentário
  `cv-card` no CatalogMain). Animação de card só em touch.
- Header sticky tem `backdropFilter:'none'` forçado **de propósito** (mesma briga).
- Clique direto na imagem de card com galeria múltipla NÃO abre o produto —
  testes devem clicar no botão COMPRAR.
- PowerShell 5.1 corrompe UTF-8 ao editar arquivo — usar ferramentas de edição, nunca
  `Set-Content`/`Out-File` em código.
- Pasta `scripts/` é do dono — não commitar nada nela.
- Antes de push: `npm run build` + `npm run test:e2e` (2 testes, preview na porta 5000).
  Push na `Resgate-emergency` = deploy automático em produção (Vercel).

## Aprendizado vivo

A pasta `aprendizado/` é a base de conhecimento do projeto. Dono e IA adicionam
entradas **datadas e com o porquê** (e fonte, quando for pesquisa). Quando o dono
disser "anota no aprendizado", registrar no arquivo certo.
