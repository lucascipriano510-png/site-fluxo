# Plano de evolução do CRM — Fluxo Outlet

## Decisão de produto

Não existe um único “CRM mais avançado” que seja a melhor escolha para toda operação. Para a Fluxo Outlet, faz mais sentido aproveitar padrões de CRMs maduros e manter React/Vite, Vercel, o Supabase já conectado e a WhatsApp Cloud API existentes. O Supabase continua sendo a fonte de verdade para clientes, conversas, pedidos e estoque; não criar outro projeto nem copiar todo o banco para uma plataforma externa.

No benchmark, a experiência de WhatsApp e pipeline do Kommo é a referência mais próxima da operação da loja [1] [2]. Pipedrive é uma boa referência para etapas, tarefas e análise comercial; a própria documentação alerta que a integração WhatsApp é beta e depende de disponibilidade [3] [4]. HubSpot demonstra uma linha do tempo rica de contato e atribuição de marketing, mas o WhatsApp do inbox depende de planos Professional/Enterprise [5] [6] [7]. Zoho combina mensagens, automações e módulos comerciais, mas recursos variam por edição [8] [9]. Salesforce oferece maior amplitude de extensibilidade, porém o canal WhatsApp pertence ao contexto de Service Cloud/licenças complementares e o inventário mais forte está em Commerce Cloud/Order Management, não no Sales Cloud básico [10] [11] [12]. A conclusão prática é adaptar padrões, sem comprar nem clonar um CRM inteiro.

## Auditoria do sistema atual

A aba CRM já existe no painel administrativo e tem uma boa base: busca paginada de clientes, perfil com telefone, origem, última compra, frequência e valor, mensagens recebidas, pedidos e registro manual de venda WhatsApp. A rota de CRM exige o usuário Supabase configurado e usa `service_role` apenas no servidor. A view `whatsapp_crm_customer_summary` é legível apenas por `service_role`, não por `anon` ou `authenticated`. A coluna gerada `orders.phone_digits` normaliza os telefones de pedidos e permite associar compras ao contato sem duplicar números.

Há três lacunas concretas para resolver. Primeiro, os cartões “Clientes”, “Conversas” e “Pedidos” somam apenas a página de até 50 contatos carregada no navegador; não são métricas globais. Segundo, o webhook registra mensagens recebidas, não o histórico completo de mensagens enviadas; a interface deve continuar clara sobre isso até haver uma integração de saída aprovada. Terceiro, o formulário manual cria a venda como concluída antes da baixa; a baixa percorre produtos em várias gravações e falhas são capturadas sem interromper o envio de Purchase à Meta. Isso pode deixar pedido, estoque e CAPI divergentes. Uma rotina atômica e idempotente para a baixa reduziria esse risco.

Também foi encontrada uma questão de segurança fora da tela CRM: a tabela `orders` permite `SELECT` para a role pública `anon`, embora contenha nome, telefone, itens e valores. O checkout atual fazia `insert(...).select().single()` diretamente pelo cliente e o painel lia/atualizava pedidos pelo mesmo cliente Supabase; retirar a política pública sem migrar esses caminhos poderia quebrar compras ou o painel. A opção de menor impacto é manter somente `INSERT` público para o checkout sem retornar linha alguma, e migrar leitura, alterações e operações administrativas para rotas de servidor autenticadas. Há ainda uma policy ampla de escrita autenticada em `products`, que merece uma revisão separada. Nenhuma política ou dado de produção foi alterado nesta auditoria.

A tabela `site_lead_signals` já existe e pode enriquecer interesse em produtos e origem, mas a associação deve ocorrer apenas quando houver telefone/visitante confiável. Não inferir campanha, interesse ou compra se os dados não sustentarem essa relação. As tabelas paralelas `bot_leads`/`wa_messages` não serão misturadas ao CRM atual sem uma reconciliação explícita.

## Escopo recomendado

1. **Visão operacional correta.** Criar métricas globais no endpoint autenticado do CRM, em vez de somar apenas os contatos carregados. Adicionar filtros e segmentos transparentes calculados a partir dos dados existentes: primeiro contato sem compra, comprador único, recorrente e cliente além do próprio intervalo médio de recompra. Sem um limite monetário inventado para “VIP” e sem novos alertas de estoque baixo.

2. **Perfil 360 e linha do tempo.** Organizar numa única tela as mensagens efetivamente recebidas, eventos de site que possam ser ligados com confiança e pedidos/vendas reais, em ordem temporal. Mostrar first/last touch e UTM/referral apenas quando registrados. Mensagem recebida não muda etapa para venda e não dispara Purchase.

3. **Fila de próximas ações.** Adicionar tarefas de retorno com data, motivo, observação curta e estado concluída/pendente. A fila destaca vencidas e de hoje; não envia mensagens automaticamente. Os dados ficam em uma tabela CRM própria pequena, protegida por RLS e acessível apenas pela API autenticada do administrador.

4. **Estoque e venda consistentes.** Manter `products` e as quantidades por tamanho no Supabase como fonte única. A tela pode indicar produtos/tamanhos relacionados a um interesse confirmado e consultar disponibilidade atual, sem copiar catálogo nem criar outra galeria. Para venda manual, a baixa opcional deve ser feita numa única operação transacional, validando quantidades e tamanhos antes de concluir o pedido. O evento Purchase continuará no caminho CAPI já existente e só será enviado após a gravação bem-sucedida; preservar `event_id`, trava por pedido e Pixel/CAPI. Não adicionar alertas de pouco estoque.

5. **Segurança de pedidos em etapa controlada.** Usar rotas server-side autenticadas para leitura/alteração administrativa; o checkout mantém `INSERT` público com validações já existentes e não pede retorno de linha/SELECT. A migration proposta revoga `SELECT`, `UPDATE` e `DELETE` públicos, mantendo `INSERT` público para checkout. Preservar o envio de pedidos pelo cliente e validar os contratos de código antes de qualquer migration de produção. Não aplicar permissões no banco nesta tarefa.

6. **IA e envio de mensagens ficam para depois.** Não incluir chatbot, envio automático, campanhas ou chamadas de IA nesta primeira entrega. Se forem desejados, tratar como uma etapa separada com templates aprovados, janela/custos da Meta, consentimento e revisão humana.

## Arquitetura e arquivos

- `src/components/AdminCRM.jsx`: manter como entrada da aba CRM e decompor a tela em componentes menores sob `src/components/crm/` (visão geral, lista/segmentos, perfil/timeline e fila de ações), reutilizando o modal `ManualSale`.
- `src/lib/whatsappCrm.js`: centralizar chamadas autenticadas para métricas, clientes, timeline e tarefas; nenhum segredo Supabase no navegador.
- `api/meta/whatsapp/crm.js`: evoluir a consulta do CRM e a paginação global sem alterar o contrato de webhook.
- `api/meta/whatsapp/tasks.js`: novo endpoint administrativo para criar/atualizar/concluir tarefas, protegido por `requireMetaAdmin` e `service_role` no servidor.
- `api/admin/orders.js`: chamadas administrativas de pedidos e registro transacional de venda com autorização verificada no servidor.
- `src/lib/orders.js` e `src/App.jsx`: preservar a entrada de pedidos do checkout; adaptar apenas os caminhos necessários para que a política RLS segura não quebre o fluxo público.
- `supabase/migrations/`: migrations pequenas para tarefas e, se aprovado, RPC transacional de venda e regras de acesso. Conferir o esquema real; não executar os antigos `SUPABASE_CRM_SETUP.sql`/`SUPABASE_ORDERS_SETUP.sql` como se fossem o banco atual.
- `api/meta/whatsapp/webhook.js`: preservar validação HMAC, deduplicação por ID da Meta, registro apenas de mensagens recebidas e captura de referral/Click-to-WhatsApp. A modificação local preexistente em `supabase/functions/webhook-meta/index.ts` permanece intocada e fora do escopo.

## Direção visual

Reutilizar a interface administrativa atual, escura e mobile-first, em vez de criar outro sistema visual. Movimento: cockpit operacional editorial, com hierarquia simples e leitura rápida. Princípios: decisões acionáveis, histórico verificável, contraste alto e estados explícitos. Manter preto/grafite como base, verde-esmeralda para ações WhatsApp/sucesso e cores de alerta apenas para ocorrências reais. A navegação começa pelas ações de hoje e segmentos; o perfil abre a linha do tempo e as compras, sem empilhar gráficos decorativos. Usar cartões existentes, bordas discretas, badges de etapa e divisores temporais como elementos de identidade. Transições curtas, sem animações que atrasem operação, respeitando redução de movimento. Preservar tipografia e componentes atuais do painel; reaproveitar a marca/logo Fluxo Outlet sem criar uma nova. Microcopy direta: “Retomar conversa” e “Registrar venda confirmada”; nunca “Compra detectada” por causa de uma mensagem.

## Limites desta aprovação

Este arquivo é somente um plano. Até você aprovar o escopo, não há alterações de código, migration, gravação Supabase, commit, push ou deploy. Mesmo depois da aprovação, qualquer migration aplicada ao Supabase de produção e qualquer publicação serão confirmadas separadamente. A branch atual é `Resgate-emergency`; há uma alteração não commitada preexistente no webhook que deve permanecer intacta.

## Referências

[1]: https://www.kommo.com/whatsapp/ "Kommo WhatsApp"
[2]: https://www.kommo.com/salesbot/ "Kommo Salesbot"
[3]: https://support.pipedrive.com/en/article/whatsapp-integration "Pipedrive WhatsApp integration"
[4]: https://support.pipedrive.com/en/article/insights-feature "Pipedrive Insights"
[5]: https://www.hubspot.com/products/crm/contact-management "HubSpot Contact Management"
[6]: https://knowledge.hubspot.com/inbox/connect-a-whatsapp-channel-to-the-conversations-inbox "Connect a WhatsApp channel to the conversations inbox"
[7]: https://www.hubspot.com/products/marketing/analytics "HubSpot Marketing Analytics"
[8]: https://www.zoho.com/crm/whatsapp.html "Zoho CRM WhatsApp"
[9]: https://www.zoho.com/crm/help/complete-feature-list.html "Zoho CRM feature list"
[10]: https://www.salesforce.com/sales/ "Salesforce Sales Cloud"
[11]: https://help.salesforce.com/s/articleView?language=en_US&id=service.messaging_whatsapp_enhanced.htm&type=5 "Salesforce enhanced WhatsApp channel"
[12]: https://www.salesforce.com/commerce/ "Salesforce Commerce Cloud"
