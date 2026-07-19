# "De perto" — 3ª distância da peça (arquivado)

**[2026-07-19] Testado em produção por ~1 dia e removido pelo dono ("zoom cego
não faz sentido"). Mecânica guardada aqui; código completo no histórico:
commit `c74dd18` (implementação) / `e13cd70` (revert).**

## A tese (pesquisa módulo 4 — Luxo)

Moda precisa convencer em 3 distâncias: silhueta (card), construção (página),
**trama/costura/acabamento (de perto)**. Peça convincente numa distância só é
frágil. O close responde "é primeira linha?" com evidência em vez de adjetivo —
e o WhatsApp real mostra o cliente pedindo exatamente isso ("manda foto pra eu
ver a peça").

## O que foi construído (e funciona)

Quadro extra no fim da galeria mobile: sentinela `__closeup__` fora da
`productGallery` (desktop/zoom/LQIP blindados via `heroReal`), derivada wsrv
2000px que só baixa quando o cliente chega no quadro, crop CSS `scale(2.05)`
com origem por tipo de peça (`sizeGridKind`: roupas 30% / calças 55% /
calçados 60%), miniatura "DE PERTO" com ação escrita, telemetria
`close_trama` (exposição = thumb visível; interação = 1ª chegada).

## Por que caiu

O crop era **cego**: ponto fixo por tipo de peça, torcendo pra ter tecido ali.
Se a foto tem a peça deslocada ou fundo no ponto, o quadro mostra nada — e
inspeção que resolve em banalidade ensina o cliente a **nunca mais explorar**
(capital de exploração, módulo 2). Evidência precisa de curadoria; curadoria
manual peça a peça foi julgada trabalho demais pra agora.

## O que reativa

1. **Ponto marcado no admin** (1 toque na foto define onde o zoom cai; quadro
   só aparece em peça com ponto) — o caminho mais barato; ou
2. **Foto macro dedicada** (campo próprio ou convenção na galeria) — evidência
   mais forte, custo de foto novo.

Se voltar, recuperar do commit `c74dd18` e só trocar a origem do crop pela
curadoria.
