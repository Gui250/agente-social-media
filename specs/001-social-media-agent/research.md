# Research: Agente de Social Media

Fase 0 do `/speckit-plan`. Cada item: decisão, justificativa, alternativas.

## R1. Runtime do agente: OpenAI Agents SDK (TypeScript)

- **Decision**: `@openai/agents` (com `zod`) rodando só no servidor Next.js. Modelo definido por
  `OPENAI_MODEL` (fallback: modelo padrão do SDK).
- **Rationale**: exigido pelo PRD e pela constituição (I, V). Mesmo idioma do frontend. O SDK já
  traz o que precisamos: `tool()` com parâmetros Zod, `outputType` para saída estruturada,
  `needsApproval` para human-in-the-loop e `RunState` serializável.
- **Alternatives**: SDK Python (dois runtimes, rejeitado pela constituição V); chamar a Responses
  API direto (reimplementaria loop de tools e aprovações).

## R2. Confirmação antes de agendar/publicar (human-in-the-loop)

- **Decision**: as ferramentas `schedule_post` e `publish_post_now` usam `needsApproval: true`.
  Quando o run pausa, `result.interruptions` vira um cartão de confirmação na UI;
  `result.state.toString()` é salvo na conversa (`pending_state`). Ao confirmar, o servidor faz
  `RunState.fromString(agent, saved)`, `state.approve()`/`state.reject()` e `run(agent, state)`.
- **Rationale**: a confirmação fica no código, não no prompt. Um "publica sem perguntar" não
  consegue pular a aprovação (spec, edge case). Atende a constituição II e FR-010.
- **Segurança** (aviso da documentação do SDK: snapshots não são autenticados): o estado só é
  lido do banco, nunca do cliente; o servidor confere dono da conversa e IDs das aprovações
  pendentes e apaga `pending_state` ao retomar (impede replay).
- **Alternatives**: confirmação só pelo prompt (burlável); duas ferramentas "preparar" e
  "confirmar" (mais estado manual, mesma coisa que o SDK já faz).

## R3. Geração do roteiro com saída estruturada

- **Decision**: um sub-agente `scriptWriter` com `outputType` = schema Zod `CreativeScript`,
  chamado dentro da ferramenta `generate_creative_script`. A ferramenta valida, salva e devolve
  o roteiro ao agente principal. Um único schema cobre os dois formatos: `blocks[]` são cenas
  (vídeo, com `durationSeconds`) ou slides (estático, `durationSeconds = null`).
- **Rationale**: constituição IV (schema validado, nada salvo se inválido); a UI renderiza o JSON
  sem parsing de texto. Campos opcionais usam `.nullable()` (structured outputs em modo estrito
  não aceitam `.optional()`).
- **Alternatives**: `agent.asTool()` (retorna texto ao agente pai; perderíamos o objeto tipado
  para salvar); agente principal com `outputType` (impediria respostas livres no chat).

## R4. Memória da conversa

- **Decision**: tabela `conversations` com `history jsonb` (os `AgentInputItem[]` de
  `result.history`). Próxima mensagem = `[...history, mensagem]`.
- **Rationale**: atende FR-002 com um campo; fica no mesmo banco, sob a mesma regra de acesso.
- **Ceiling**: histórico cresce sem limite. Quando custo/latência incomodar, truncar mantendo
  pares de tool call, ou trocar por uma `Session` do SDK.
- **Alternatives**: `OpenAIConversationsSession` (histórico fora do nosso banco);
  `previousResponseId` (depende da retenção da OpenAI).

## R5. Boas práticas de agente adotadas

- Um agente principal, sem handoffs: há um único domínio (social media). Handoffs só quando
  surgir um segundo domínio.
- Instruções dinâmicas (função de `RunContext`): data/hora atual no fuso do usuário, para
  resolver "sexta às 18h" em data absoluta (FR-013).
- Contexto do run `{ userId, timezone, conversationId }` passado por `run(..., { context })`;
  as ferramentas leem o `userId` daí, nunca de argumentos do modelo.
- `maxTurns: 10` por run para limitar loops.
- Ferramentas finas: validam com Zod e chamam os mesmos controllers da UI. Erros de domínio
  voltam como mensagem legível ao modelo, que explica ao usuário.
- Escopo (FR-003) pelas instruções. Sem guardrail de input por LLM: custaria uma chamada a mais
  por mensagem, e o que é perigoso (publicar) já está protegido por aprovação no código.
- Tracing do SDK ligado (padrão), com `groupId = conversationId`, sem PII nos metadados.

## R6. Instagram: API e login

- **Decision**: "Instagram API with Instagram Login" (Business Login for Instagram,
  `graph.instagram.com`), permissões `instagram_business_basic` e
  `instagram_business_content_publish`. Token de usuário de longa duração (60 dias), renovado
  por job diário.
- **Rationale**: não exige Página do Facebook vinculada; um OAuth só. Atende contas Business e
  Creator (FR-015).
- **Fluxo de publicação** (documentação Meta): criar container (`POST /<IG_ID>/media`; carrossel
  = filhos com `is_carousel_item` + container `CAROUSEL`; Reels = `media_type=REELS` +
  `video_url`) → checar `status_code` (IN_PROGRESS, FINISHED, PUBLISHED, ERROR, EXPIRED) →
  `POST /<IG_ID>/media_publish` com `creation_id`.
- **Limites**: mídia precisa de URL pública; imagens só JPEG; carrossel até 20 itens; limite de
  posts por 24 h (a doc cita 100 e 50 em seções diferentes) → consultar
  `GET /<IG_ID>/content_publishing_limit` antes de publicar em vez de fixar número.
- **Produção**: app precisa de revisão da Meta (Advanced Access). Em modo desenvolvimento,
  funciona com contas de testadores.
- **Alternatives**: Instagram API with Facebook Login (exige Página; mais permissões).

## R6b. Login com Facebook (várias contas de uma vez)

- **Decision**: além do Instagram Login, oferecer "Instagram API with Facebook Login for Business"
  (Graph API v26.0). O diálogo usa `config_id` (configuração de login criada no painel da Meta com
  `instagram_basic`, `instagram_content_publish`, `pages_show_list`, `pages_read_engagement`,
  `business_management`), não `scope`. Código → token de usuário → token de longa duração →
  `GET /me/accounts?fields=id,name,access_token,instagram_business_account{id,username}`. Cada
  Página com conta Instagram vira uma conta conectada, salva com o **token da Página**.
- **Rationale**: o usuário pediu para conectar várias contas num login só. O Instagram Login conecta
  uma conta por vez; o Facebook Login devolve todas as contas vinculadas às Páginas autorizadas.
- **Publicação**: mesmos endpoints de container/`media_publish`, mas em `graph.facebook.com/v26.0`
  com o token da Página. Cada conta guarda `login_type` e o publisher escolhe o host.
- **Tokens**: tokens de Página obtidos a partir de token de usuário de longa duração não expiram
  (`token_expires_at = null`); o job de renovação só trata contas `instagram`. Se o usuário trocar a
  senha ou revogar o app, a publicação falha com "reconecte em Contas".
- **Requisitos**: cada conta Instagram precisa estar vinculada a uma Página do Facebook; em
  produção, as permissões passam pela revisão da Meta.
- **Alternatives**: token de usuário do sistema (BISU), que exige portfólio de negócios do provedor
  e é voltado a integrações servidor-servidor; trocar o Instagram Login pelo Facebook Login
  (rejeitado: obrigaria todo usuário a ter Página).

## R7. Mídia

- **Decision**: bucket privado no Supabase Storage. No momento da publicação, gerar URL assinada
  (1 h) e passá-la à Meta. Upload aceita imagem JPEG (até 8 MB) e vídeo MP4/MOV para Reels.
- **Rationale**: a Meta busca a mídia por URL; URL assinada evita bucket público.
- **Upload**: direto do navegador para o Storage (policy por prefixo `auth.uid()/`); o servidor
  só registra e valida os metadados. Funções serverless limitam o corpo da requisição (~4,5 MB
  na Vercel), o que impede vídeos passando pela rota.
- **Ceiling**: só JPEG para imagem. Se usuários reclamarem de PNG/HEIC, converter no upload.

## R8. Disparo dos agendamentos

- **Decision**: `pg_cron` no Supabase a cada minuto (`* * * * *`) chama
  `POST /api/cron/publish` via `pg_net` (`net.http_post`), com `CRON_SECRET` lido do Supabase
  Vault. Um segundo job diário chama `/api/cron/refresh-tokens`.
- **Rationale**: precisão de 1 minuto (SC-004, tolerância de 5 min), sem serviço extra.
  Vercel Cron no plano gratuito roda só 1x/dia.
- **Idempotência** (constituição II, FR-017): função SQL `claim_due_posts()` com
  `FOR UPDATE SKIP LOCKED` move `scheduled → publishing`. O post guarda `ig_container_id` e
  `ig_media_id`: nunca criamos segundo container nem chamamos `media_publish` duas vezes; se o
  container já está `PUBLISHED`, só marcamos como publicado.
- **Reels**: o processamento do vídeo leva minutos. O job não espera: deixa o post em
  `publishing` e o próximo tick confere o status do container. Nenhuma função fica bloqueada.
- **Local**: o Supabase na nuvem não alcança `localhost`; em desenvolvimento o tick é disparado
  manualmente por `curl` (ver quickstart).
- **Alternatives**: Vercel Cron (precisão insuficiente no free); fila dedicada (Inngest, QStash:
  dependência nova sem necessidade).

## R9. Autenticação e isolamento de dados

- **Decision**: Supabase Auth (e-mail e senha) com `@supabase/ssr`. RLS em todas as tabelas por
  `user_id = auth.uid()`. Tokens do Instagram em tabela separada `instagram_tokens` com RLS
  ligada e **nenhuma** policy: só o service role (servidor) lê.
- **Rationale**: FR-020, FR-021, constituição III. Separar a tabela impede que o próprio usuário
  leia o token via API REST do Supabase com o JWT dele.

## R10. Fuso horário

- **Decision**: `profiles.timezone` (IANA, padrão `America/Sao_Paulo`, capturado do navegador no
  cadastro). Banco guarda `timestamptz`. Exibição via `Intl.DateTimeFormat` com `timeZone`.
- **Rationale**: nativo, sem biblioteca de datas. O modelo devolve ISO 8601 com offset; o
  controller valida que é futuro.

## R11. Testes

- **Decision**: Vitest. Unit: transições de estado do post, validação de agendamento (futuro,
  fuso, limites do Instagram), adaptador do Instagram com `fetch` mockado, publisher (máquina de
  estados) com adaptador falso, e checagem de que `schedule_post`/`publish_post_now` têm
  `needsApproval: true`. Integração: `claim_due_posts()` contra Supabase local
  (`supabase start`) para provar que dois ticks concorrentes não pegam o mesmo post.
- **Rationale**: constituição V (risco nas bordas; sem OpenAI nem Instagram reais em teste).
  O comportamento conversacional do agente é validado manualmente pelo quickstart.

## R12. Arquitetura MVC (pedido do usuário)

- **Decision**: MVC dentro de um único app Next.js:
  - **Model** (`src/models/`): schemas Zod + acesso ao Supabase por entidade.
  - **View** (`src/app/**/page.tsx`, `src/components/`): telas e componentes shadcn/ui.
  - **Controller** (`src/controllers/`): casos de uso (auth, validação, regras). Route handlers
    em `src/app/api/` só fazem parse da requisição e chamam um controller.
  - O **agente** (`src/agent/`) é mais um cliente dos controllers, igual à UI. Agendar pelo chat
    e pela tela passa pela mesma regra.
  - Integrações externas em `src/services/` (Instagram, publisher).
- **Rationale**: regras num lugar só; UI e agente não divergem.
