# Plano de consumo e independência da Supabase

Data: 25 de julho de 2026  
Status: plano aprovado para implementação por fases

## Objetivo

Impedir que indisponibilidade, restrição de cota ou encerramento da Supabase
retire a vitrine da Fluxo Outlet do ar.

A Supabase pode continuar como ferramenta administrativa e banco principal
enquanto for conveniente, mas não pode ser uma dependência obrigatória para a
abertura da loja.

## Diagnóstico verificado

O projeto foi restringido pelas cotas `exceed_storage_size_quota` e
`exceed_cached_egress_quota`.

Situação encontrada em 25/07/2026:

- 453 objetos e 1.426.434.296 bytes armazenados.
- 137 objetos órfãos ocupando 432.915.053 bytes.
- Mesmo removendo os órfãos, restariam aproximadamente 994 MB.
- Imagens e vídeos são enviados sem compressão obrigatória.
- Arquivos substituídos não são removidos automaticamente.
- O aquecedor solicita milhares de variações várias vezes por dia.
- Em 18 e 19 de julho, o `wsrv.nl` buscou cerca de 2,06 GB de originais.
- A vitrine consulta a Supabase diretamente e fica vazia quando recebe HTTP 402.

## Princípio central

O site público deve funcionar com a última versão válida já publicada do
catálogo. Uma falha da Supabase poderá impedir temporariamente alterações no
painel, mas não poderá:

- apagar os produtos da vitrine;
- remover imagens já publicadas;
- impedir o cliente de montar um pedido;
- impedir a continuidade da venda pelo WhatsApp.

## Arquitetura desejada

```text
Painel administrativo
        |
        v
API própria da Fluxo
        |
        +--> Postgres principal
        |
        +--> Publicador
        |       +--> catálogo versionado
        |       +--> cópia embutida no site
        |
        +--> Pipeline de mídia
                +--> storage principal
                +--> réplica independente

Cliente
   +--> catálogo publicado
   +--> cache local
   +--> cópia embutida no site
   +--> checkout normal
   +--> fallback pelo WhatsApp
```

## Plano de controle de consumo

### Medidas imediatas

1. Suspender o agendamento automático do aquecedor de imagens.
2. Fazer inventário e backup antes de qualquer exclusão.
3. Revisar os 137 arquivos órfãos em modo `dry-run` antes da limpeza.
4. Não tratar a limpeza como solução final: restariam quase 1 GB em uso.
5. Remover automaticamente o arquivo anterior ao substituir uma mídia.

### Pipeline obrigatório de mídia

Antes de armazenar ou publicar:

- corrigir orientação e remover metadados desnecessários;
- limitar dimensões;
- gerar WebP ou AVIF;
- gerar tamanhos de card, detalhe e compartilhamento;
- comprimir vídeos e limitar duração, resolução e bitrate;
- impedir upload que não cumpra o orçamento.

Orçamento inicial:

- thumbnail/card: até 200 KB;
- imagem de detalhe: até 700 KB;
- imagem ampliada: até 1 MB;
- vídeo curto: meta de até 8 MB;
- vídeo carregado somente sob interação ou proximidade da tela.

### Requisições e alertas

- Remover polling público a cada 60 segundos.
- Remover dependência do `wsrv.nl` como transformador em tempo real.
- Gerar variantes somente uma vez, durante o upload.
- Não pré-carregar o catálogo inteiro em todas as resoluções.
- Configurar alertas em 50%, 70%, 85% e 95% das cotas.
- Produzir relatório semanal de Storage, egress, órfãos e maiores arquivos.

## Plano para a Supabase não derrubar a vitrine

### Fase 1 — Catálogo estático resiliente

Criar um publicador server-side que leia produtos, kits, banners e
configurações e produza:

```text
catalog/manifest.json
catalog/versions/{versao}/products.json
catalog/versions/{versao}/config.json
```

Cada publicação será atômica:

1. gerar uma nova versão;
2. validar schema, produtos e URLs;
3. publicar os arquivos da versão;
4. atualizar o manifesto somente após a validação;
5. conservar versões anteriores para rollback.

Ordem de leitura do site:

1. catálogo publicado no domínio da Fluxo;
2. última versão válida armazenada no navegador;
3. snapshot embutido no próprio deploy.

O navegador não deverá consultar a Supabase para montar a página inicial.

Resultado esperado: desligar a Supabase durante o teste não altera a vitrine
para visitantes novos.

### Fase 2 — Mídia fora da Supabase

Usar URLs controladas pela Fluxo:

```text
https://media.fluxooutlet.com.br/produtos/...
```

O domínio esconderá o fornecedor real. A primeira configuração poderá usar um
storage compatível com S3, mas o código não dependerá de APIs proprietárias.

Requisitos:

- storage principal e réplica em um segundo fornecedor;
- inventário com hash e tamanho;
- rotina de reconciliação entre as cópias;
- troca de origem sem alterar URLs dos produtos;
- cache longo para arquivos versionados.

### Fase 3 — API própria e banco portátil

O frontend deixará de executar operações de banco diretamente. Todas as
escritas passarão por endpoints da Fluxo:

```text
/api/admin/products
/api/orders
/api/events
/api/customers
```

A API poderá continuar usando Supabase Postgres inicialmente, mas através de
uma camada substituível.

Requisitos:

- migrações SQL versionadas;
- evitar dependência desnecessária de recursos proprietários;
- segredos somente no servidor;
- nenhuma chave administrativa no navegador;
- backup lógico diário;
- teste de restauração em outro Postgres.

### Fase 4 — Venda em modo degradado

O fechamento pelo WhatsApp será o mecanismo de continuidade.

Se a API de pedidos estiver indisponível:

1. o carrinho continua funcionando localmente;
2. o site monta um resumo com SKU, tamanho, quantidade e valor;
3. o cliente é direcionado ao WhatsApp com a mensagem estruturada;
4. o evento pendente fica salvo localmente para nova tentativa.

Uma falha no banco não pode eliminar o caminho até o WhatsApp.

### Fase 5 — Hospedagem e recuperação

- Manter o site estático publicável em pelo menos duas plataformas.
- Conservar domínio, DNS e certificados sob controle da Fluxo.
- Guardar backups do banco em fornecedor diferente do banco principal.
- Guardar réplica da mídia em fornecedor diferente da origem principal.
- Documentar restauração e troca de fornecedor.
- Executar teste mensal de restauração.
- Testar trimestralmente a loja com a Supabase desligada em homologação.

## Critérios de conclusão

O plano estará concluído quando:

- a vitrine abrir para visitante novo com a Supabase desconectada;
- produtos, preços, banners e imagens continuarem disponíveis;
- o cliente conseguir montar o pedido e chegar ao WhatsApp;
- uploads forem comprimidos e versionados automaticamente;
- arquivos substituídos não se acumularem;
- o banco puder ser restaurado em outro Postgres;
- a mídia puder trocar de fornecedor sem mudar URLs públicas;
- existir uma cópia funcional do site em uma segunda hospedagem;
- alertas forem disparados antes de qualquer restrição.

## Ordem recomendada

1. Recuperar e controlar o consumo atual.
2. Implementar catálogo estático e fallback embutido.
3. Migrar mídia para domínio e storage independentes.
4. Colocar escritas atrás da API própria.
5. Implementar backups e restauração em outro Postgres.
6. Publicar uma segunda cópia estática da loja.
7. Testar a operação completa com a Supabase desligada.

Não é necessário remover a Supabase imediatamente. A prioridade é reduzir seu
papel de dependência obrigatória para componente substituível.
