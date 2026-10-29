# Contract: Ferramentas do Agente

Agente principal `socialMediaAgent` (`src/agent/agent.ts`). Contexto do run:
`{ userId: string, timezone: string, conversationId: string }`. Nenhuma ferramenta recebe
`userId` como argumento; todas usam o contexto. Parâmetros opcionais são `nullable`.

| Ferramenta | Parâmetros | needsApproval | Controller | Retorno ao modelo |
|------------|-----------|---------------|------------|-------------------|
| `generate_creative_script` | `segment`, `format: video\|static`, `objective?`, `audience?`, `tone?` | não | `scripts.generate` | roteiro salvo (`id` + `CreativeScript`) |
| `list_creative_scripts` | `limit?` (1–20, padrão 5) | não | `scripts.list` | resumos (id, título, segmento, formato) |
| `list_connected_accounts` | — | não | `accounts.list` | id, username, status |
| `list_posts` | `status?`, `from?`, `to?` (ISO 8601) | não | `posts.list` | posts com horário no fuso do usuário |
| `schedule_post` | `accountId`, `postType`, `caption`, `mediaIds[]`, `scheduledAt` (ISO 8601 com offset), `scriptId?` | **sim** | `posts.schedule` | post `scheduled` |
| `publish_post_now` | `postId?` **ou** campos de `schedule_post` sem `scheduledAt` | **sim** | `posts.publishNow` | post `publishing`/`published`/`failed` |
| `cancel_post` | `postId` | não (reversível: dá para reagendar) | `posts.cancel` | post `cancelled` |

## Regras

- `generate_creative_script` roda o sub-agente `scriptWriter` (`outputType: CreativeScript`).
  Saída inválida → erro "não consegui gerar um roteiro válido, tente de novo"; nada é salvo.
- Erros de domínio (`DomainError`) viram texto para o modelo, ex.: "data no passado", "conta
  Instagram expirada, reconecte em Contas", "imagem precisa ser JPEG", "a v1 só publica no
  Instagram".
- Resumo exibido no cartão de aprovação (montado no servidor a partir dos argumentos):
  `Agendar <tipo> em @<username> para <data no fuso> — "<legenda (80 caracteres)>" — <n> mídia(s)`.
- Teste obrigatório: `schedule_post.needsApproval` e `publish_post_now.needsApproval` são `true`.

## Instruções (resumo, texto final em `src/agent/instructions.ts`)

- Português do Brasil. Escopo: roteiros, agendamento, publicação e consulta de posts; recusar
  o resto e dizer o que sabe fazer.
- Data/hora atual e fuso do usuário injetados a cada run.
- Perguntar segmento, formato, conta, mídia ou horário quando faltar; nunca inventar IDs.
- Antes de agendar, usar `list_connected_accounts`; se não houver conta ativa, orientar a
  conectar em "Contas".
