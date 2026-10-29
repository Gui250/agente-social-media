# Contract: HTTP API (Next.js Route Handlers)

JSON. Toda rota exige sessão Supabase (cookie), exceto `/api/cron/*` (Bearer `CRON_SECRET`) e o
callback do OAuth (valida `state`). Erros: `{ error: { code, message } }`, com `message` em
português e legível ao usuário. Códigos: 400 validação, 401 sem sessão, 404 não encontrado ou de
outro usuário, 409 conflito de estado, 502 falha do Instagram/OpenAI.

## Chat

### `POST /api/chat`

```text
req  { conversationId?: uuid, message: string (1–4000), mediaIds?: uuid[] }
res  { conversationId, status: "done", reply: string }
   | { conversationId, status: "needs_approval", reply: string,
       approvals: [{ id, tool: "schedule_post" | "publish_post_now", summary: string }] }
409  conversa com aprovação pendente
```

`mediaIds` são anexados à mensagem como texto (`[mídias anexadas: id1, id2]`) para o agente.

### `POST /api/chat/approvals`

```text
req  { conversationId: uuid, decisions: [{ id: string, approve: boolean }] }
res  mesmo formato de /api/chat
409  ids não batem com as aprovações pendentes, ou nada pendente
```

## Roteiros

| Método | Rota | Corpo / Query | Resposta |
|--------|------|---------------|----------|
| GET | `/api/scripts` | `?limit&cursor` | lista de roteiros |
| POST | `/api/scripts` | `{ segment, format, objective?, audience?, tone? }` | roteiro gerado e salvo |
| PATCH | `/api/scripts/:id` | `{ content: CreativeScript }` | roteiro editado |
| DELETE | `/api/scripts/:id` | — | 204 |

## Posts

| Método | Rota | Corpo / Query | Resposta |
|--------|------|---------------|----------|
| GET | `/api/posts` | `?status&from&to` | lista |
| POST | `/api/posts` | `{ accountId, postType, caption, mediaIds, scheduledAt?, scriptId? }` | `draft` (sem data) ou `scheduled` |
| PATCH | `/api/posts/:id` | campos editáveis | post; 409 se estado não editável |
| POST | `/api/posts/:id/cancel` | — | `cancelled`; 409 se não `scheduled` |
| POST | `/api/posts/:id/publish` | — | `publishing`/`published`/`failed` |

Na UI, criar com data e "publicar agora" passam por diálogo de confirmação antes da requisição.

## Mídia

O arquivo não passa pelo servidor Next.js (limite de corpo de funções serverless, ~4,5 MB na
Vercel, inviabiliza vídeos):

1. O navegador envia direto ao bucket privado `post-media`, no caminho
   `<auth.uid()>/<uuid>.<ext>` (policy de Storage restringe ao próprio prefixo; o bucket limita
   tipos a `image/jpeg`, `video/mp4`, `video/quicktime`).
2. `POST /api/media` `{ storagePath }` → o servidor lê os metadados do objeto, valida (imagem
   JPEG ≤ 8 MB; vídeo MP4/MOV), registra e responde `{ id, kind, mimeType, sizeBytes }`.
   400 se tipo ou tamanho inválido (o objeto é apagado); 404 se o caminho não é do usuário.

## Instagram

- `GET /api/instagram/connect` → 302 para o OAuth do Instagram (com `force_reauth=true`, para
  escolher a conta) e `state` em cookie httpOnly.
- `GET /api/instagram/callback?code&state` → troca por token de longa duração, salva conta e
  token, 302 para `/contas?conectada=@usuario`.
- `GET /api/instagram/facebook/connect` → 302 para o diálogo do Facebook Login for Business
  (`config_id`).
- `GET /api/instagram/facebook/callback?code&state` → conecta **todas** as contas Instagram
  vinculadas às Páginas autorizadas, 302 para `/contas?conectada=@a,@b`.
- Erros em qualquer passo (inclusive login não configurado) → 302 para `/contas?erro=<mensagem>`.
- `DELETE /api/accounts/:id` → desconecta (apaga token; posts `scheduled` dessa conta viram
  `failed` com motivo "conta desconectada").

## Cron (chamadas pelo pg_cron)

- `POST /api/cron/publish` → `{ claimed, published, failed, inProgress }`. Faz claim e avança
  posts `publishing` (container IN_PROGRESS).
- `POST /api/cron/refresh-tokens` → renova tokens que expiram em ≤ 7 dias; falha → conta
  `expired`.
- 401 sem `Authorization: Bearer <CRON_SECRET>` (comparação em tempo constante).
