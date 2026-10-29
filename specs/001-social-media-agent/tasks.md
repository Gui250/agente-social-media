---

description: "Task list for Agente de Social Media"
---

# Tasks: Agente de Social Media

**Input**: Design documents from `/specs/001-social-media-agent/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included where the constitution (principle V) requires them: post state transitions,
scheduling validation, Instagram adapter, publisher, `claim_due_posts`, approval flags. Tests
never call OpenAI or Instagram (mocks only).

**Organization**: Tasks are grouped by user story so each story can be implemented and tested
on its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1, US2, US3 from spec.md
- Paths: single Next.js app at the repository root (`src/`, `tests/`, `supabase/`)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization

- [X] T001 Scaffold a Next.js app (TypeScript, App Router, Tailwind, ESLint, `src/` dir, alias `@/*`) at the repository root, keeping the existing `.env`, `.llm/`, `.specify/`, `.claude/`, `specs/` and `CLAUDE.md` intact (scaffold in a temp dir and move files in if `create-next-app` refuses the non-empty dir); result: `package.json`, `next.config.ts`, `tsconfig.json`, `src/app/layout.tsx`
- [X] T002 Install runtime deps `@openai/agents zod @supabase/supabase-js @supabase/ssr server-only` and dev dep `vitest`; confirm the `zod` major version matches the peer dependency of `@openai/agents`, in `package.json`
- [X] T003 [P] Run `npx shadcn@latest init` and add components `button card input textarea label dialog badge select table sonner` (creates `components.json`, `src/components/ui/*`)
- [X] T004 [P] Create `vitest.config.ts` (node environment, `@` alias to `src`) and add scripts `"test": "vitest run"` and `"test:watch": "vitest"` to `package.json`
- [X] T005 [P] Create `.env.example` with the variables listed in `specs/001-social-media-agent/quickstart.md` and make sure `.gitignore` ignores `.env*` except `.env.example`
- [X] T006 [P] Run `supabase init` to create `supabase/config.toml` and the `supabase/migrations/` folder

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Auth, data access, error handling and layout used by every story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T007 Create `src/lib/env.ts`: `import 'server-only'`, parse with Zod `OPENAI_API_KEY`, `OPENAI_MODEL` (optional), `SUPABASE_SERVICE_ROLE_KEY`, `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `INSTAGRAM_REDIRECT_URI`, `CRON_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`; fail fast with the missing variable name
- [X] T008 [P] Create Supabase clients: `src/lib/supabase/server.ts` (session client from cookies via `@supabase/ssr`), `src/lib/supabase/admin.ts` (`import 'server-only'`, service-role client, never imported by client components), `src/lib/supabase/client.ts` (browser client, used only for auth and Storage uploads)
- [X] T009 [P] Create `src/lib/errors.ts`: `class DomainError(code, message, status)` where `message` is user-facing Portuguese; status one of 400, 401, 404, 409, 502
- [X] T010 Create `src/lib/http.ts`: `route(handler, { body?: ZodSchema })` helper that loads the session user (401 if absent), parses/validates the JSON body (400 with Portuguese message), calls the controller and maps `DomainError` to `{ error: { code, message } }` with its status (other errors → 500 with generic message, logged server-side)
- [X] T011 Create migration `supabase/migrations/0001_profiles.sql`: function `set_updated_at()`; table `profiles` (`id uuid` PK references `auth.users(id)` on delete cascade, `timezone text not null default 'America/Sao_Paulo'`, `created_at`, `updated_at`); RLS enabled with policies `id = auth.uid()` for select/update; trigger on `auth.users` insert creating the profile with `timezone` from `raw_user_meta_data->>'timezone'` when it is a valid IANA name (fallback default)
- [X] T012 [P] Create `src/lib/datetime.ts`: `formatInTimeZone(date, timeZone)` with `Intl.DateTimeFormat('pt-BR', { timeZone, dateStyle: 'short', timeStyle: 'short' })` and `nowIn(timeZone)` returning a readable "agora" string for agent instructions
- [X] T013 Create `src/models/profile.ts`: `getProfile(supabase, userId)` returning `{ id, timezone }`
- [X] T014 Create login: `src/app/login/page.tsx` + `src/components/auth/login-form.tsx` (client; email/password sign in and sign up via browser client; on sign up send `options.data.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone`; errors shown in Portuguese)
- [X] T015 Create session middleware `src/middleware.ts` (use `src/proxy.ts` if the installed Next.js version renamed it): refresh the Supabase session and redirect unauthenticated requests for app pages to `/login`; skip `/api/cron/*`, `/api/instagram/callback`, `/login` and static assets
- [X] T016 Create app shell `src/app/(app)/layout.tsx` with nav (Chat, Roteiros, Posts, Contas) and a logout button, plus `src/app/page.tsx` redirecting to `/chat`

**Checkpoint**: A user can sign up, log in and see the empty app shell

---

## Phase 3: User Story 1 - Gerar roteiro de criativo por segmento (Priority: P1) 🎯 MVP

**Goal**: The user names a segment in chat (or the Roteiros screen) and gets a validated,
saved creative script in Portuguese.

**Independent Test**: quickstart.md › US1. With no Instagram account connected, send a segment
in `/chat` and get a complete script that also appears in `/roteiros`.

### Tests for User Story 1

- [X] T017 [P] [US1] Create `tests/unit/creative-script.schema.test.ts`: the refined `CreativeScript` schema accepts a valid video script and a valid static script; rejects `title` outside 1–120, `hook` outside 1–300, `blocks` with 0 or more than 20 items, a `video` block with `durationSeconds = null`, a `static` block with non-null `durationSeconds`, `caption` longer than 2200, more than 30 hashtags, a hashtag not starting with "#", `cta` outside 1–200
- [X] T018 [P] [US1] Create `tests/unit/scripts.controller.test.ts` with `writeScript` and the model module mocked: invalid writer output throws `DomainError` and nothing is inserted; valid output is inserted with the `userId` passed to the controller; `segment` outside 2–120 characters is rejected before calling the writer

### Implementation for User Story 1

- [X] T019 [US1] Create migration `supabase/migrations/0002_scripts_conversations.sql`: table `creative_scripts` (`user_id` FK profiles on delete cascade, `segment text not null check (char_length(segment) between 2 and 120)`, `objective`, `audience`, `tone` text null, `format text not null check (format in ('video','static'))`, `content jsonb not null`, timestamps) and table `conversations` (`user_id`, `history jsonb not null default '[]'`, `pending_state text null`, `pending_approval_ids text[] not null default '{}'`, timestamps); RLS enabled with policies `user_id = auth.uid()` for all operations; `set_updated_at` triggers; index `creative_scripts (user_id, created_at desc)`
- [X] T020 [P] [US1] Create `src/models/creative-script.ts`: `CreativeScriptBase` Zod object exactly as in data-model.md (`title` string 1–120; `hook` string 1–300; `blocks` 1–20 items of `{ label: string, durationSeconds: number | null, visual: string, text: string }`; `caption` string ≤ 2200; `cta` string 1–200; `hashtags` string[] ≤ 30 each starting with "#"), using `.nullable()` never `.optional()`; `creativeScriptFor(format)` adding the refinement "`durationSeconds` required in video, null in static"; queries `insertScript`, `listScripts({ limit, cursor })`, `getScript`, `updateScriptContent`, `deleteScript` using the session client
- [X] T021 [P] [US1] Create `src/models/conversation.ts`: `getOrCreateConversation(supabase, userId, id?)` (404 `DomainError` if the id belongs to another user), `saveHistory(id, history)`, `setPending(id, state, approvalIds)`, `clearPending(id)` (sets `pending_state = null`, `pending_approval_ids = '{}'`)
- [X] T022 [US1] Create `src/agent/script-writer.ts`: `scriptWriter = new Agent({ name: 'Roteirista', instructions, outputType: CreativeScriptBase, model })` with pt-BR instructions describing a strong hook, scenes with duration/visual/speech for `video` and slide text/visual for `static`, caption, CTA and up to 30 hashtags; export `writeScript({ segment, format, objective, audience, tone })` that runs it and validates `finalOutput` with `creativeScriptFor(format)`, throwing `DomainError('invalid_script', 'Não consegui gerar um roteiro válido, tente de novo.', 502)` on failure
- [X] T023 [US1] Create `src/controllers/scripts.ts`: `generate(supabase, userId, input)` (validate `segment` 2–120 and `format` in `video|static` → `writeScript` → `insertScript`), `list`, `update` (validate `content` with `creativeScriptFor(format)`), `remove`
- [X] T024 [US1] Create `src/agent/instructions.ts`: `instructions(runContext)` returning pt-BR text with the rules in `contracts/agent-tools.md` › Instruções (scope and polite refusal, ask for missing segment/format instead of inventing, never invent IDs) and the current date/time from `nowIn(context.timezone)`
- [X] T025 [US1] Create `src/agent/tools.ts`: `type AgentContext = { userId: string; timezone: string; conversationId: string; supabase: SupabaseClient }`; helper `safe(fn)` that turns `DomainError` into the string `Erro: <message>` returned to the model; tools `generate_creative_script` (`segment`, `format: 'video'|'static'`, `objective|audience|tone` nullable) and `list_creative_scripts` (`limit` nullable 1–20, default 5) calling `src/controllers/scripts.ts` with `runContext.context.userId`
- [X] T026 [US1] Create `src/agent/agent.ts`: `socialMediaAgent = new Agent<AgentContext>({ name: 'Agente de Social Media', instructions, model: env.OPENAI_MODEL, tools })`
- [X] T027 [US1] Create `src/controllers/chat.ts` `sendMessage(supabase, userId, { conversationId?, message, mediaIds? })`: load profile timezone, get/create conversation, throw 409 `DomainError` if `pending_state` is set, append `[mídias anexadas: …]` when `mediaIds` given, `run(socialMediaAgent, [...history, user(message)], { context, maxTurns: 10 })` with tracing `groupId = conversationId`, save `result.history`, return `{ conversationId, status: 'done', reply: result.finalOutput }` (leave one clearly marked branch for interruptions, implemented in T049)
- [X] T028 [US1] Create `src/app/api/chat/route.ts` (POST) using `route()` with body `{ conversationId?: uuid, message: string 1–4000, mediaIds?: uuid[] }` per `contracts/http-api.md`
- [X] T029 [P] [US1] Create `src/app/api/scripts/route.ts` (GET `?limit&cursor`, POST `{ segment, format, objective?, audience?, tone? }`) and `src/app/api/scripts/[id]/route.ts` (PATCH `{ content }`, DELETE → 204), all delegating to `src/controllers/scripts.ts`
- [X] T030 [P] [US1] Create `src/components/scripts/script-card.tsx`: renders a `CreativeScript` (title, hook, numbered scenes with seconds for video or slides for static, caption, CTA, hashtags as badges)
- [X] T031 [US1] Create `src/app/(app)/chat/page.tsx` + `src/components/chat/chat-panel.tsx` (client): message list (`whitespace-pre-wrap`), textarea + send, loading indicator, error toast, `conversationId` kept in the URL `?c=`, "Nova conversa" button
- [X] T032 [US1] Create `src/app/(app)/roteiros/page.tsx` (server component listing via `src/controllers/scripts.ts`), `src/components/scripts/generate-form.tsx` (segment, format select, optional objective/audience/tone → POST `/api/scripts`) and `src/components/scripts/script-editor.tsx` (dialog editing title, hook, blocks, caption, CTA, hashtags → PATCH; delete button with confirm)

**Checkpoint**: quickstart.md › US1 passes; `npm test` green

---

## Phase 4: User Story 2 - Agendar posts (Priority: P2)

**Goal**: The user connects Instagram, uploads media and schedules posts from chat or the Posts
screen, always after explicit confirmation; can edit and cancel before publication.

**Independent Test**: quickstart.md › US2. Attach a JPEG, ask to schedule for tomorrow 10h,
confirm, and see the post as "agendado" in `/posts` without anything being published.

### Tests for User Story 2

- [X] T033 [P] [US2] Create `tests/unit/post-transitions.test.ts`: `assertTransition` allows exactly `draft→scheduled`, `draft→publishing`, `scheduled→scheduled`, `scheduled→cancelled`, `scheduled→publishing`, `scheduled→failed`, `publishing→publishing`, `publishing→published`, `publishing→failed`, `failed→publishing`, `failed→scheduled`, and rejects every other pair (including anything from `published` or `cancelled`); `isEditable` is true only for `draft`, `scheduled`, `failed`
- [X] T034 [P] [US2] Create `tests/unit/post-validation.test.ts` for `validatePostInput` with a fixed clock: `scheduledAt` must be ISO 8601 with offset and in the future; `image` needs exactly 1 image, `carousel` 2–20 media, `reel` exactly 1 video; `caption` ≤ 2200 characters and ≤ 30 hashtags; media not owned by the user → 404; account not `active` → `DomainError` "conta Instagram expirada, reconecte em Contas"
- [X] T035 [P] [US2] Create `tests/unit/chat-approvals.test.ts` with models and `run` mocked: `approve` returns 409 when nothing is pending or when decision ids differ from `pending_approval_ids`; 404 for another user's conversation; calls `clearPending` before resuming the run (no replay); a rejected decision calls `state.reject` and an approved one `state.approve`
- [X] T036 [P] [US2] Create `tests/unit/agent-tools.test.ts`: the `schedule_post` tool has `needsApproval === true` and `cancel_post` does not

### Implementation for User Story 2

- [X] T037 [US2] Create migration `supabase/migrations/0003_accounts_media_posts.sql`: `connected_accounts` (`user_id`, `provider text not null default 'instagram' check (provider = 'instagram')`, `ig_user_id`, `username`, `status text check (status in ('active','expired','revoked'))`, `token_expires_at timestamptz`, unique `(user_id, ig_user_id)`); `instagram_tokens` (`account_id` PK FK connected_accounts on delete cascade, `access_token text not null`) with RLS enabled and **no policies**; `media` (`user_id`, `storage_path`, `kind check in ('image','video')`, `mime_type check in ('image/jpeg','video/mp4','video/quicktime')`, `size_bytes int`); `posts` (all fields from data-model.md, `post_type check in ('image','carousel','reel')`, `status check in ('draft','scheduled','publishing','published','failed','cancelled')`, `caption check (char_length(caption) <= 2200)`, `media_ids uuid[] not null`, index `(status, scheduled_at)`); RLS `user_id = auth.uid()` on all but `instagram_tokens`; private Storage bucket `post-media` with `allowed_mime_types` `image/jpeg, video/mp4, video/quicktime` and Storage policies allowing insert/select/delete only where the first path segment equals `auth.uid()::text`
- [X] T038 [P] [US2] Create `src/models/account.ts`: `listAccounts`, `getAccount` (session client); `upsertAccountWithToken`, `getAccessToken(accountId)`, `setAccountStatus`, `deleteAccount` (admin client, file imports `server-only`)
- [X] T039 [P] [US2] Create `src/models/media.ts`: `insertMedia`, `getMediaForUser(ids, userId)` (preserves the given order; 404 if any id is missing or not owned)
- [X] T040 [P] [US2] Create `src/models/post.ts`: `PostStatus`, `PostType`, `assertTransition(from, to)` and `isEditable(status)` matching data-model.md › Máquina de estados; queries `insertPost`, `listPosts({ status?, from?, to? })`, `getPost`, `updatePost(id, fromStatus, patch)` that updates with `.eq('status', fromStatus)` and throws 409 if no row changed
- [X] T041 [US2] Create `src/controllers/post-validation.ts`: pure `validatePostInput(input, { now, media, account })` implementing the rules tested in T034
- [X] T042 [US2] Create `src/services/instagram.ts` OAuth part (`import 'server-only'`): `authorizeUrl(state)` with scopes `instagram_business_basic,instagram_business_content_publish`, `exchangeCode(code)` → short-lived token → long-lived token (`ig_exchange_token`), `getProfile(token)` → `{ igUserId, username }`; check endpoint URLs against Meta's Instagram Login docs at implementation time
- [X] T043 [US2] Create `src/controllers/accounts.ts`: `startConnect` (random `state` stored in an httpOnly, SameSite=Lax cookie), `handleCallback(code, state)` (state must match the cookie, then upsert account + token with `token_expires_at` = now + `expires_in`), `list`, `disconnect` (delete account + token; that account's `scheduled` posts → `failed` with `failure_reason = 'conta desconectada'`)
- [X] T044 [US2] Create routes `src/app/api/instagram/connect/route.ts` (302), `src/app/api/instagram/callback/route.ts` (302 to `/contas`, error message via query on failure) and `src/app/api/accounts/[id]/route.ts` (DELETE)
- [X] T045 [P] [US2] Create `src/app/(app)/contas/page.tsx`: connected accounts with username and status badge (ativa/expirada/revogada), "Conectar Instagram" link to `/api/instagram/connect`, disconnect button with confirm dialog
- [X] T046 [US2] Create `src/controllers/media.ts` + `src/app/api/media/route.ts` (POST `{ storagePath }`): require path prefix `<userId>/` (else 404), read object metadata with the admin client, accept `image/jpeg` ≤ 8 MB or `video/mp4`/`video/quicktime`, otherwise delete the object and return 400; insert `media` row; plus `src/components/media/media-uploader.tsx` (client; uploads to `post-media/<uid>/<uuid>.<ext>` with the browser client, then calls `/api/media`, shows thumbnails)
- [X] T047 [US2] Create `src/controllers/posts.ts`: `create` (no `scheduledAt` → `draft`, with → `scheduled`), `schedule`, `update` (only when `isEditable`), `cancel` (only from `scheduled`), `list` (times formatted with `formatInTimeZone`); every write runs `validatePostInput` and `assertTransition`
- [X] T048 [US2] Create routes `src/app/api/posts/route.ts` (GET, POST), `src/app/api/posts/[id]/route.ts` (PATCH), `src/app/api/posts/[id]/cancel/route.ts` (POST) per `contracts/http-api.md`
- [X] T049 [US2] Add tools to `src/agent/tools.ts`: `list_connected_accounts`, `list_posts` (`status`, `from`, `to` nullable), `schedule_post` (`accountId`, `postType`, `caption`, `mediaIds`, `scheduledAt`, `scriptId` nullable; **`needsApproval: true`**), `cancel_post` (`postId`); register them in `src/agent/agent.ts`; extend `src/agent/instructions.ts` with "call `list_connected_accounts` before scheduling; if none is active, tell the user to connect in Contas; v1 only publishes to Instagram"
- [X] T050 [US2] Create `src/agent/approval-summary.ts`: `summarize(toolName, args, { timezone, accounts })` → `Agendar <tipo> em @<username> para <data no fuso> — "<legenda (80 caracteres)>" — <n> mídia(s)`
- [X] T051 [US2] Implement interruptions in `src/controllers/chat.ts`: when `result.interruptions.length > 0` save `result.state.toString()` and the interruption call ids with `setPending`, return `{ status: 'needs_approval', reply, approvals: [{ id, tool, summary }] }`; add `approve(supabase, userId, { conversationId, decisions })`: owner check (404), ids must equal `pending_approval_ids` (409), `clearPending` first, `RunState.fromString(socialMediaAgent, saved)`, `approve`/`reject` (reject message "O usuário recusou."), `run(socialMediaAgent, state, { context, maxTurns: 10 })`, then handle new interruptions or save history
- [X] T052 [US2] Create `src/app/api/chat/approvals/route.ts` (POST `{ conversationId, decisions: [{ id, approve }] }`)
- [X] T053 [US2] Update `src/components/chat/chat-panel.tsx` and create `src/components/chat/approval-card.tsx`: render pending approvals with summary and Confirmar/Recusar, disable the input while approvals are pending, attach media via `media-uploader.tsx` and send `mediaIds`
- [X] T054 [US2] Create `src/app/(app)/posts/page.tsx`, `src/components/posts/post-list.tsx` (status badges rascunho/agendado/publicando/publicado/falhou/cancelado, times in user timezone, cancel with confirm) and `src/components/posts/post-form.tsx` (account, type, caption with counter 2200, media uploader, optional date/time; confirm dialog showing the summary before scheduling)

**Checkpoint**: quickstart.md › US2 passes; US1 still passes; `npm test` green

---

## Phase 5: User Story 3 - Publicar posts (Priority: P3)

**Goal**: Scheduled posts are published on time exactly once; "publicar agora" works after
confirmation; failures are visible with a reason and can be retried.

**Independent Test**: quickstart.md › US3. Schedule a post 2 minutes ahead, trigger the tick,
see it "publicado" with a working link; trigger again and confirm no duplicate.

### Tests for User Story 3

- [X] T055 [P] [US3] Create `tests/unit/instagram.publish.test.ts` with `fetch` mocked: image container sends `image_url` + `caption`; carousel creates children with `is_carousel_item=true` then a `CAROUSEL` container with comma-separated `children`; reel sends `media_type=REELS` + `video_url`; `getContainerStatus` parses `IN_PROGRESS|FINISHED|PUBLISHED|ERROR|EXPIRED`; `publish` sends `creation_id`; error code 190 maps to `DomainError` "conta Instagram expirada, reconecte em Contas"
- [X] T056 [P] [US3] Create `tests/unit/publisher.test.ts` with a fake adapter and fixed clock: never creates a container when `ig_container_id` is set; never calls `publish` when `ig_media_id` is set; `IN_PROGRESS` keeps `publishing`; `FINISHED` → publish → `published` with `permalink` and `published_at`; `PUBLISHED` → `published` without calling publish; `ERROR`/`EXPIRED` → `failed` with readable reason; claimed more than 24 h late → `failed` with "atraso maior que 24 h"; publishing limit exhausted → `failed` with reason
- [X] T057 [P] [US3] Create `tests/integration/claim-due-posts.test.ts` (requires `supabase start`; skipped with a message when the local DB is unreachable): two concurrent `claim_due_posts(10)` calls return disjoint rows; future, `cancelled` and `draft` posts are never claimed
- [X] T058 [P] [US3] Extend `tests/unit/agent-tools.test.ts`: `publish_post_now` has `needsApproval === true`
- [X] T059 [P] [US3] Create `tests/unit/cron-auth.test.ts`: `/api/cron/publish` and `/api/cron/refresh-tokens` handlers return 401 without the header and with a wrong bearer token

### Implementation for User Story 3

- [X] T060 [US3] Create migration `supabase/migrations/0004_claim_due_posts.sql`: function `claim_due_posts(batch int)` exactly as in data-model.md (`FOR UPDATE SKIP LOCKED`, `scheduled_at <= now()`, sets `status = 'publishing'`, returns rows); `revoke execute` from `anon` and `authenticated`
- [X] T061 [US3] Create migration `supabase/migrations/0005_cron_jobs.sql`: enable `pg_cron` and `pg_net`; schedule `publish-due-posts` at `* * * * *` and `refresh-instagram-tokens` at `0 3 * * *`, each doing `net.http_post` to `<app_url>/api/cron/...` with header `Authorization: Bearer <cron_secret>`, both read from `vault.decrypted_secrets` (secrets `app_url`, `cron_secret` created per environment; document the `vault.create_secret` calls in `specs/001-social-media-agent/quickstart.md` › Produção)
- [X] T062 [US3] Add publishing to `src/services/instagram.ts`: `createImageContainer`, `createCarouselContainer` (children then parent), `createReelContainer`, `getContainerStatus`, `publish(creationId)`, `getPermalink(mediaId)`, `getPublishingLimit`, `refreshToken(token)` (`ig_refresh_token`); map Graph API errors to `DomainError` with Portuguese messages
- [X] T063 [US3] Create `src/services/publisher.ts`: `advance(post, deps)` with injected `{ instagram, posts, media, signedUrl, now }` implementing research.md › R8: late > 24 h → failed; no container → check publishing limit, create container with 1 h signed media URLs, save `ig_container_id`; then check status (`IN_PROGRESS` → stay; `ERROR`/`EXPIRED` → failed; `PUBLISHED` → published; `FINISHED` → `publish`, save `ig_media_id` immediately, fetch permalink → published); every state change through `assertTransition`
- [X] T064 [US3] Add `signedUrl(storagePath, 3600)` to `src/models/media.ts` (admin client)
- [X] T065 [US3] Create `src/controllers/cron.ts`: `publishTick()` (admin client: `claim_due_posts(20)` plus posts already `publishing` with `ig_container_id`; `advance` each, isolating errors per post; return `{ claimed, published, failed, inProgress }`) and `refreshTokens()` (accounts with `token_expires_at <= now() + 7 days` → `refreshToken`; failure → status `expired`)
- [X] T066 [US3] Create `src/app/api/cron/publish/route.ts` and `src/app/api/cron/refresh-tokens/route.ts` (POST, `runtime = 'nodejs'`): compare `Authorization: Bearer <CRON_SECRET>` with `crypto.timingSafeEqual` (401 otherwise), then call the cron controller
- [X] T067 [US3] Add `publishNow(supabase, userId, { postId } | input)` to `src/controllers/posts.ts` (from `draft`, `scheduled` or `failed` → `publishing`, then one `advance`), and route `src/app/api/posts/[id]/publish/route.ts` (POST)
- [X] T068 [US3] Add the `publish_post_now` tool (`postId` nullable, or the `schedule_post` fields without `scheduledAt`; **`needsApproval: true`**) to `src/agent/tools.ts`, register it in `src/agent/agent.ts`, and add its summary ("Publicar agora …") to `src/agent/approval-summary.ts`
- [X] T069 [US3] Update `src/components/posts/post-list.tsx`: link to `permalink` for published posts, `failure_reason` plus "Tentar de novo" (publish now with confirm dialog, or reschedule via `post-form.tsx`) for failed posts, and `router.refresh()` every 15 s while any post is `publishing`

**Checkpoint**: quickstart.md › US3 passes; US1 and US2 still pass; `npm test` green

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T070 [P] Update `CLAUDE.md`: real commands (`npm run dev`, `npm test`, single test `npx vitest run tests/unit/<file>.test.ts`, `supabase start`, `supabase db reset`), MVC layout (`src/models`, `src/controllers`, `src/app` + `src/components`, `src/agent`, `src/services`) and the rule "the agent and the UI both go through controllers"
- [X] T071 Security pass: confirm no secret uses a `NEXT_PUBLIC_` name; `server-only` is imported by `src/lib/env.ts`, `src/lib/supabase/admin.ts`, `src/models/account.ts`, `src/services/instagram.ts`, `src/agent/agent.ts`; every table in `supabase/migrations/` has RLS enabled; `instagram_tokens` has no policies
- [X] T072 Run every scenario in `specs/001-social-media-agent/quickstart.md` and fix any gap found

---

## Phase 7: Várias contas e login com Facebook (extensão de FR-019)

**Goal**: connect several Instagram accounts, one at a time (Instagram Login) or all accounts
linked to the user's Facebook Pages at once (Facebook Login for Business, research.md › R6b).

**Independent Test**: with two accounts connected, the agent asks which `@` to use; "Conectar com
Facebook" connects every linked account; posts for a Facebook-connected account publish through
`graph.facebook.com`.

- [X] T073 [P] Add `force_reauth=true` to the Instagram authorize URL in `src/services/instagram.ts` and test it in `tests/unit/instagram.oauth.test.ts`
- [X] T074 [P] Agent asks which account when several are active and none is named, in `src/agent/instructions.ts`
- [X] T075 Create migration `supabase/migrations/0006_facebook_login.sql`: `login_type text not null default 'instagram' check in ('instagram','facebook')`, `fb_page_id text` required when `login_type = 'facebook'`
- [X] T076 Publishing calls take a `Conn` (`{ token, base }`) chosen by `connFor(login_type)` in `src/services/instagram.ts`, `src/services/publisher.ts`, `src/controllers/cron.ts`
- [X] T077 Create `src/services/facebook.ts` (dialog URL with `config_id`, code → long-lived user token, Pages → linked Instagram accounts with paging) and `tests/unit/facebook.login.test.ts`
- [X] T078 `handleFacebookCallback` in `src/controllers/accounts.ts` upserts every linked account with its Page token and `expiresAt = null`; refresh job only renews `login_type = 'instagram'` in `src/models/account.ts`
- [X] T079 Routes `src/app/api/instagram/facebook/{connect,callback}/route.ts` sharing `src/lib/oauth-routes.ts` (errors redirect to `/contas?erro=`)
- [X] T080 Contas screen with "Conectar com Facebook" and "Conectar com Instagram", "via" label per account, in `src/app/(app)/contas/page.tsx` and `src/components/accounts/account-list.tsx`; link from `src/components/posts/post-form.tsx`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: after Setup; blocks all stories
- **US1 (Phase 3)**: after Foundational
- **US2 (Phase 4)**: after Foundational; reuses the agent and chat built in US1 (T025–T027, T031)
- **US3 (Phase 5)**: after US2 (needs accounts, media, posts and the approval flow)
- **Polish (Phase 6)**: after the stories you intend to ship

### User Story Dependencies

- **US1**: independent; works with no Instagram account
- **US2**: depends on US1's agent/chat infrastructure, not on scripts (posts can be scheduled with
  free text). Testable without publishing anything.
- **US3**: depends on US2's posts, accounts and approvals

### Within Each Story

- Tests first, then migration → models → controllers/services → routes → agent tools → UI
- `src/agent/tools.ts`, `src/agent/agent.ts`, `src/controllers/chat.ts`,
  `src/controllers/posts.ts` and `src/components/posts/post-list.tsx` are edited in more than one
  task: run those tasks in order

### Parallel Opportunities

- Setup: T003, T004, T005, T006
- Foundational: T008, T009, T012 (T010 after T009)
- US1: tests T017, T018; models T020, T021; T029 and T030 once controllers exist
- US2: tests T033–T036; models T038, T039, T040; T045 alongside the posts work
- US3: tests T055–T059

---

## Parallel Example: User Story 2

```bash
# Tests together:
Task: "post transitions test in tests/unit/post-transitions.test.ts"
Task: "post validation test in tests/unit/post-validation.test.ts"
Task: "chat approvals test in tests/unit/chat-approvals.test.ts"
Task: "agent tools approval flags in tests/unit/agent-tools.test.ts"

# Models together (after T037):
Task: "account model in src/models/account.ts"
Task: "media model in src/models/media.ts"
Task: "post model in src/models/post.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 Setup → Phase 2 Foundational
2. Phase 3 US1
3. **Stop and validate** with quickstart.md › US1; demo script generation

### Incremental Delivery

1. Setup + Foundational
2. US1 → validate → demo (MVP, no Meta app needed)
3. US2 → validate → demo scheduling (needs Meta app in dev mode for the account connection)
4. US3 → validate → deploy with pg_cron pointing at the public URL

---

## Notes

- [P] = different files, no dependency on incomplete tasks
- Tests never call OpenAI or Instagram
- Commit after each task or logical group (initialize git first: the folder is not a repository yet)
