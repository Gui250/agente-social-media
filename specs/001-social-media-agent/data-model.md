# Data Model: Agente de Social Media

Postgres (Supabase). Todas as tabelas com `id uuid` (PK, default `gen_random_uuid()`),
`created_at`/`updated_at timestamptz`. RLS ligada em todas; policy padrão
`user_id = auth.uid()` (exceto onde indicado).

## profiles

| Campo | Tipo | Regra |
|-------|------|-------|
| id | uuid | PK = `auth.users.id` |
| timezone | text | IANA válido; default `America/Sao_Paulo` |

## connected_accounts

| Campo | Tipo | Regra |
|-------|------|-------|
| user_id | uuid | FK profiles |
| provider | text | só `instagram` na v1 |
| ig_user_id | text | ID da conta profissional |
| username | text | exibido na UI |
| status | text | `active` \| `expired` \| `revoked` |
| login_type | text | `instagram` (Instagram Login) \| `facebook` (Facebook Login, R6b) |
| fb_page_id | text \| null | Página do Facebook vinculada; obrigatório quando `login_type = facebook` |
| token_expires_at | timestamptz \| null | null para `facebook` (token de Página não expira) |

Único: `(user_id, ig_user_id)`. Um usuário conecta quantas contas quiser; reconectar a mesma
conta (por qualquer login) atualiza a linha existente.

## instagram_tokens

| Campo | Tipo | Regra |
|-------|------|-------|
| account_id | uuid | PK, FK connected_accounts, `on delete cascade` |
| access_token | text | token de longa duração (Instagram Login) ou token da Página (Facebook Login) |

RLS ligada **sem policies**: só o service role acessa (FR-021).

## media

| Campo | Tipo | Regra |
|-------|------|-------|
| user_id | uuid | FK profiles |
| storage_path | text | caminho no bucket privado `post-media` |
| kind | text | `image` \| `video` |
| mime_type | text | `image/jpeg` \| `video/mp4` \| `video/quicktime` |
| size_bytes | int | imagem ≤ 8 MB |

## creative_scripts

| Campo | Tipo | Regra |
|-------|------|-------|
| user_id | uuid | FK profiles |
| segment | text | obrigatório, 2–120 caracteres |
| objective, audience, tone | text \| null | opcionais |
| format | text | `video` \| `static` |
| content | jsonb | objeto `CreativeScript` validado (abaixo) |

Todo roteiro gerado é salvo; regenerar cria nova linha. "Salvar" na spec equivale a não
excluir (US1-3 atendido: o roteiro aparece na lista).

### CreativeScript (schema Zod, também `outputType` do sub-agente)

```text
title        string, 1–120
hook         string, 1–300        gancho de abertura
blocks       1–20 itens           cenas (video) ou slides (static)
  label           string          "Cena 1" / "Slide 1"
  durationSeconds number | null   obrigatório em video, null em static
  visual          string          o que aparece
  text            string          fala ou texto na tela/slide
caption      string, ≤ 2200       legenda
cta          string, 1–200
hashtags     string[], ≤ 30, cada uma começando com "#"
```

## posts

| Campo | Tipo | Regra |
|-------|------|-------|
| user_id | uuid | FK profiles |
| account_id | uuid | FK connected_accounts; deve ser do mesmo usuário e `active` para agendar |
| script_id | uuid \| null | FK creative_scripts |
| post_type | text | `image` \| `carousel` \| `reel` |
| caption | text | ≤ 2200 caracteres, ≤ 30 hashtags |
| media_ids | uuid[] | ordenado; image = 1 imagem; carousel = 2–20; reel = 1 vídeo |
| scheduled_at | timestamptz \| null | obrigatório e futuro em `scheduled` |
| status | text | ver máquina de estados |
| ig_container_id | text \| null | setado uma vez; nunca recriado se presente |
| ig_media_id | text \| null | setado uma vez após `media_publish` |
| permalink | text \| null | link do post publicado |
| failure_reason | text \| null | mensagem legível ao usuário (FR-018) |
| published_at | timestamptz \| null | |

Índice: `(status, scheduled_at)`.

### Máquina de estados

```text
draft ──confirmar agendamento──▶ scheduled ──claim (cron, horário chegou)──▶ publishing
  │                                │  ▲                                        │
  │                                │  └─ editar (continua scheduled)           ├─▶ published
  │                                └─ cancelar ──▶ cancelled                   └─▶ failed
  └──confirmar "publicar agora"──────────────────────────────────▶ publishing
failed ──tentar de novo (agora ou nova data)──▶ publishing | scheduled
scheduled com atraso > 24 h no claim ──▶ failed ("atraso maior que 24 h")
```

- Só `draft`, `scheduled` e `failed` aceitam edição; `published` e `cancelled` são finais.
- `publishing` é exibido como "publicando".
- Transições só pelo controller de posts (`src/controllers/posts.ts`) e pelo publisher; uma
  função `assertTransition(from, to)` concentra as regras e é coberta por testes.

### Função `claim_due_posts(batch int)`

`UPDATE posts SET status = 'publishing' WHERE id IN (SELECT id FROM posts WHERE status =
'scheduled' AND scheduled_at <= now() ORDER BY scheduled_at LIMIT batch FOR UPDATE SKIP LOCKED)
RETURNING *`. Executada só com o service role.

## conversations

| Campo | Tipo | Regra |
|-------|------|-------|
| user_id | uuid | FK profiles |
| history | jsonb | `AgentInputItem[]` do SDK |
| pending_state | text \| null | `RunState` serializado enquanto há aprovação pendente |
| pending_approval_ids | text[] | IDs das interrupções aguardando decisão |

Enquanto `pending_state` não é null, novas mensagens são recusadas (409) até o usuário decidir.
