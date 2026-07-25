# WhatsApp Embedded Signup (coexistência)

Esta integração atende a rota privada `/admin/conectar-whatsapp`. Ela usa o fluxo oficial de coexistência `whatsapp_business_app_onboarding`: não chama `/register`, não migra números diretamente e não altera o Flow publicado `1500193561793995`.

## Configuração na Vercel

Configure as variáveis abaixo nos ambientes necessários e faça um novo deploy. Nunca use o prefixo `VITE_` em um segredo.

| Variável                       | Valor / finalidade                                                                                                                   |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `VITE_META_APP_ID`             | `1505001754713162` — exposta ao navegador para inicializar o SDK.                                                                    |
| `VITE_META_WHATSAPP_CONFIG_ID` | Config ID do Embedded Signup criado no Meta for Developers.                                                                          |
| `VITE_META_GRAPH_VERSION`      | `v25.0` (opcional; este é o padrão).                                                                                                 |
| `META_APP_ID`                  | `1505001754713162` — uso exclusivo da Function.                                                                                      |
| `META_APP_SECRET`              | App Secret do app Meta; exclusivo de servidor.                                                                                       |
| `META_WHATSAPP_CONFIG_ID`      | Mesmo Config ID; reservado para auditoria/configuração de servidor.                                                                  |
| `META_GRAPH_VERSION`           | `v25.0`.                                                                                                                             |
| `META_BUSINESS_ID`             | `836103152921929`.                                                                                                                   |
| `META_ADMIN_USER_ID`           | UUID do usuário Supabase que já acessa a administração. A Function recusa todos os outros usuários.                                  |
| `META_TOKEN_ENCRYPTION_KEY`    | Chave aleatória de 32 bytes em Base64 para AES-256-GCM. Ex.: gere localmente com um gerenciador de segredos; não registre seu valor. |
| `SUPABASE_URL`                 | URL do projeto Supabase (somente servidor para esta Function).                                                                       |
| `SUPABASE_ANON_KEY`            | Chave pública usada somente para validar a sessão Supabase.                                                                          |
| `SUPABASE_SERVICE_ROLE_KEY`    | Exclusiva do servidor, para persistir a conexão.                                                                                     |

O App Secret e as chaves server-side não entram no bundle Vite. O access token devolvido pela Meta é cifrado na Function com AES-256-GCM antes de ser enviado ao Supabase; ele não é registrado em logs nem devolvido ao navegador.

## Banco de dados

Execute a migration `supabase/migrations/20260723_create_whatsapp_meta_connections.sql` no Supabase pelo fluxo de migration já usado pelo projeto. Ela cria `whatsapp_meta_connections`, habilita RLS e não cria policy para usuários `anon` ou `authenticated`.

## Meta: passos manuais restantes

1. No Meta for Developers, crie/revise a configuração do WhatsApp Embedded Signup para o app `1505001754713162`, em modo de coexistência com WhatsApp Business App, e copie seu Config ID para as duas variáveis correspondentes.
2. Autorize a URL de produção `https://www.fluxooutlet.com.br/admin/conectar-whatsapp` nas configurações exigidas pela Meta (domínios, redirect/origens permitidas conforme o painel atual).
3. Confirme que o usuário informado em `META_ADMIN_USER_ID` é o administrador do painel Supabase. A rota também exige a sessão Supabase desse mesmo usuário.
4. Faça deploy depois de configurar os env vars e abra a rota administrativa. O fluxo deve retornar `FINISH` com `waba_id` e `phone_number_id`; então a Function troca o código por token e grava a conexão.

WABA conhecida atualmente: `469734826223192`. Ela é apenas referência operacional; a página salva a WABA realmente devolvida pela Meta, para não fixar indevidamente uma seleção futura.

## Segurança e diagnóstico

- O listener aceita apenas `https://www.facebook.com`, `https://web.facebook.com` e `https://business.facebook.com`, e somente payloads `WA_EMBEDDED_SIGNUP`.
- O endpoint exige `Authorization: Bearer <sessão Supabase>` e confere `META_ADMIN_USER_ID` antes de falar com a Meta.
- Logs registram somente status e mensagens genéricas; nunca o authorization code ou access token.
- Não há endpoint `/register` e nenhum Flow existente é modificado.
