# Quickstart: validar o Agente de Social Media

Guia de validação ponta a ponta. Contratos: [http-api](contracts/http-api.md),
[agent-tools](contracts/agent-tools.md). Modelo: [data-model](data-model.md).

## Pré-requisitos

- Node.js 22+ LTS e Docker (para o Supabase local). A Supabase CLI vem como dependência de
  desenvolvimento: use `npx supabase`.
- Conta OpenAI com `OPENAI_API_KEY`.
- Para US3: app Meta com o produto Instagram (Instagram Login) em modo desenvolvimento e uma
  conta Instagram profissional adicionada como testadora.

## Variáveis (`.env.local`)

```text
OPENAI_API_KEY=            # já existe em .env
OPENAI_MODEL=              # opcional
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY= # só servidor
INSTAGRAM_APP_ID=
INSTAGRAM_APP_SECRET=
INSTAGRAM_REDIRECT_URI=http://localhost:3000/api/instagram/callback
FACEBOOK_APP_ID=           # opcional: login com Facebook (várias contas de uma vez)
FACEBOOK_APP_SECRET=
FACEBOOK_CONFIG_ID=        # ID da configuração do Facebook Login for Business
FACEBOOK_REDIRECT_URI=http://localhost:3000/api/instagram/facebook/callback
CRON_SECRET=
```

## Subir

```bash
npm install
npx supabase start && npx supabase db reset   # aplica supabase/migrations
# copie API_URL, ANON_KEY e SERVICE_ROLE_KEY de `npx supabase status` para .env.local
npm run dev
npm test                              # Vitest (unit + integração do claim_due_posts)
```

## Cenários

### US1 — roteiro (sem Instagram conectado)

1. Criar conta em `/login`, abrir `/chat`.
2. Enviar "faz um roteiro". **Esperado**: o agente pergunta o segmento.
3. Enviar "clínica odontológica, vídeo curto, objetivo: agendar avaliações".
   **Esperado**: em < 30 s, roteiro com título, gancho, cenas com duração, legenda, CTA e
   hashtags, em português. Aparece em `/roteiros`.
4. Enviar "outro gancho, mais curto". **Esperado**: novo roteiro, mesmo segmento.
5. Enviar "qual a capital da França?". **Esperado**: recusa educada + o que o agente faz.

### US2 — agendamento (Instagram conectado, sem publicar)

1. Em `/contas`, conectar a conta de teste.
2. No chat, anexar um JPEG e enviar "agenda esse roteiro com essa imagem pra amanhã 10h".
   **Esperado**: cartão de confirmação com conta, data absoluta no seu fuso e legenda. Nada
   aparece como agendado ainda.
3. Recusar. **Esperado**: nenhum post criado. Repetir e confirmar. **Esperado**: post
   `agendado` em `/posts`.
4. Enviar "agenda pra ontem". **Esperado**: recusa por data no passado.
5. Enviar "publica sem me perguntar". **Esperado**: o cartão de confirmação aparece mesmo assim.
6. Cancelar o post em `/posts`. **Esperado**: estado `cancelado`.

### US3 — publicação

1. Agendar um post para daqui a 2 minutos e confirmar.
2. Disparar o tick manualmente (o cron da nuvem não alcança localhost):
   ```bash
   curl -X POST http://localhost:3000/api/cron/publish -H "Authorization: Bearer $CRON_SECRET"
   ```
   Antes do horário: `claimed: 0`. Depois: post `publicado` com link que abre no Instagram.
3. Rodar o mesmo `curl` de novo. **Esperado**: nenhuma publicação duplicada no Instagram.
4. Reels: agendar um vídeo, chamar o tick até sair de `publicando` para `publicado`.
5. Falha: desconectar a conta e tentar publicar agora. **Esperado**: `falhou` com motivo legível
   e botão "tentar de novo".
6. Sem sessão: `curl /api/cron/publish` sem header → 401.

### Várias contas / login com Facebook

Configuração na Meta (app do tipo Business):

1. Adicionar o produto **Facebook Login for Business** e criar uma configuração com token de
   usuário e as permissões `instagram_basic`, `instagram_content_publish`, `pages_show_list`,
   `pages_read_engagement` e `business_management`. O ID gerado vai em `FACEBOOK_CONFIG_ID`.
2. Em "Valid OAuth Redirect URIs", cadastrar `FACEBOOK_REDIRECT_URI`.
3. Cada conta Instagram precisa ser profissional e estar vinculada a uma Página do Facebook.

Cenário:

1. Em `/contas`, clicar em **Conectar com Facebook** e autorizar duas Páginas com Instagram.
   **Esperado**: volta para `/contas` com "@a, @b conectadas", cada uma marcada "via Facebook".
2. No chat, pedir para agendar sem citar a conta. **Esperado**: o agente pergunta em qual `@`.
3. Citar uma das contas. **Esperado**: o cartão de confirmação mostra esse `@`.
4. Publicar agora um post de uma conta "via Facebook". **Esperado**: publicado com link.

## Produção

As migrations criam os jobs do pg_cron (`publish-due-posts` a cada minuto e
`refresh-instagram-tokens` às 03:00 UTC). Eles só chamam o app depois que estes dois segredos
existem no Vault do projeto (SQL Editor do Supabase):

```sql
select vault.create_secret('https://SEU-DOMINIO', 'app_url');
select vault.create_secret('<o mesmo valor de CRON_SECRET do deploy>', 'cron_secret');
```

Conferir execuções em `cron.job_run_details` e respostas em `net._http_response`.
