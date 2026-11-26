# Relatório — CRM WhatsApp Fluxo Outlet

## O que foi implementado

A auditoria confirmou que o site usa o Supabase existente `tapgnlrjhrhewqlpahvg`; a função Edge `webhook-meta` é a CAPI da loja e não foi modificada nesta tarefa. O CRM anterior chamava tabelas inexistentes e criava uma conversa fictícia a partir de pedido do checkout. Essa chamada foi removida sem alterar os dados/parâmetros Meta do checkout.

No mesmo Supabase, apliquei as migrations `create_whatsapp_meta_connections`, `create_fluxo_whatsapp_crm` e `secure_whatsapp_meta_connections`. Elas criam a conexão WhatsApp com token cifrado, contatos e mensagens Cloud API deduplicadas, canal de venda e telefone normalizado em `orders`, e a view de resumo de clientes. Telefones brasileiros com DDD local são normalizados para o formato com código do país. As tabelas multi-loja existentes (`wa_*`, `bot_*`) não foram alteradas.

A tela administrativa agora lista e pesquisa clientes derivados de conversas ou pedidos, exibe histórico de mensagens e pedidos, origem disponível, última compra e frequência média. O botão de venda abre o componente `ManualSale` existente, pré-preenche o cliente quando selecionado e marca o pedido como venda WhatsApp. Baixa de estoque e fluxo de Purchase permanecem no componente existente; nenhuma mensagem recebida é tratada como compra.

Foram adicionadas rotas Vercel para verificação GET, recebimento POST com HMAC-SHA256 sobre o corpo bruto, deduplicação por ID da Meta e leitura CRM com autenticação server-side por `META_ADMIN_USER_ID`. O onboarding existente tenta inscrever a WABA em `subscribed_apps` e informa sucesso ou falha, sem devolver token ao navegador.

## Validação e limites

Cinco testes sintéticos passaram, incluindo assinatura inválida/válida, challenge, extração da mensagem, descarte de status como venda e persistência simulada de cliente/mensagem via PostgREST mock. `npm run build` passou, com o aviso Vite de chunks maiores que 500 kB. A checagem ESLint direcionada não ficou limpa: reportou 188 violações de formatação Prettier e 3 avisos nos arquivos checados; não rodei autofix para evitar reformatar código legado. A view foi consultada com sucesso e a autorização efetiva foi verificada: `service_role` pode ler os dados; `anon` e `authenticated` não podem. A correção dos privilégios da tabela que guarda o token cifrado também foi aplicada.

**Não houve teste de mensagem real nem registro end-to-end de venda real.** A Meta ainda precisa ser configurada para chamar o callback, e não foi criado pedido de teste que pudesse gerar um Purchase real. O projeto Vercel `site-deploy-helper`, conectado ao repositório, foi verificado e não possui variáveis de ambiente cadastradas; portanto, as rotas CRM/webhook permanecerão indisponíveis até que os secrets server-side obrigatórios sejam configurados.

O health check e os recibos recentes da CAPI/Pixel `1488076836116872` foram verificados na auditoria anterior: PageView/ViewContent recentes com HTTP 200 e `events_received=1`. Nesta tarefa não enviei evento de teste, não alterei a função CAPI e não fiz nova confirmação de recebimento de evento pela Meta.

## Pendências para ativar a integração real

No ambiente Vercel do projeto, confirme que estão definidos: `SUPABASE_URL` (ou `VITE_SUPABASE_URL`), `SUPABASE_ANON_KEY` (ou `VITE_SUPABASE_ANON_KEY`), `SUPABASE_SERVICE_ROLE_KEY`, `META_ADMIN_USER_ID`, `META_APP_ID`, `META_APP_SECRET`, `META_BUSINESS_ID`, `META_TOKEN_ENCRYPTION_KEY` (32 bytes em Base64) e `META_WHATSAPP_VERIFY_TOKEN`. `META_GRAPH_VERSION` e `META_WHATSAPP_CONFIG_ID` são opcionais; o Config ID só é necessário para usar Embedded Signup, junto com `VITE_META_APP_ID`, e não para webhook/Cloud API. Nenhum valor deve ser inserido no frontend.

Para ativar a integração real, configurar no Meta App Dashboard o callback `https://www.fluxooutlet.com.br/api/meta/whatsapp/webhook`, o mesmo verify token guardado no Vercel e assinar o campo `messages` em WhatsApp > Configuration. Completar o Embedded Signup; o servidor tentará então inscrever a WABA em `/<WABA_ID>/subscribed_apps`. Confirmar que o app tem acesso à permissão `whatsapp_business_messaging` e à WABA/número selecionados. A documentação da Meta descreve a verificação GET e a assinatura HMAC do POST [1], o campo `messages` [2] e a inscrição da WABA [3].

**Nota de segurança preservada:** `src/lib/capi.js` ainda inclui um fallback literal para `VITE_META_WEBHOOK_SECRET` no bundle do navegador. Não alterei a CAPI para evitar uma mudança fora do escopo, mas esse valor não é secreto se incorporado ao frontend. Recomendo substituir/rotacionar o segredo do webhook e movê-lo para uma chamada server-side separada, sem reutilizar essa exposição.

## Referências Meta

[1]: https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/create-webhook-endpoint "Criar endpoint de webhook WhatsApp"
[2]: https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview "Visão geral dos webhooks WhatsApp"
[3]: https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/manage-webhooks "Gerenciar assinaturas de webhook da WABA"
