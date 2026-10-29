# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev                                   # Next.js dev server (needs the local Supabase stack)
npm test                                      # Vitest: unit + integration
npx vitest run tests/unit/publisher.test.ts   # single test file
npx tsc --noEmit                              # typecheck
npx eslint src tests                          # lint
npx next build                                # production build (catches Cache Components errors)
npx supabase start                            # local Postgres/Auth/Storage (Docker)
npx supabase db reset                         # re-apply supabase/migrations (wipes local data)
```

`tests/integration/claim-due-posts.test.ts` runs against the local Supabase stack using
`.env.local` and skips itself when the stack is down. Tests never call OpenAI or Instagram.

Environment: `OPENAI_API_KEY` lives in `.env`; Supabase keys, Instagram app and `CRON_SECRET` in
`.env.local` (template: `.env.example`). Instagram variables are optional until US2/US3 are used.

## What this is

A Portuguese (pt-BR) social media agent: it writes creative scripts (Reels or static/carousel) for
a business segment, schedules posts and publishes them to Instagram. Requirements, design and the
task list live in `specs/001-social-media-agent/` (Spec Kit; see `.specify/memory/constitution.md`).
All user-facing text is Portuguese.

## Architecture (MVC in one Next.js 16 app)

- **Model** `src/models/`: Zod schemas and Supabase queries per entity. `post.ts` owns the post
  state machine (`assertTransition`); every status change goes through it.
- **Controller** `src/controllers/`: use cases (validation, rules). Route handlers in `src/app/api/`
  stay thin and call controllers through `route()` from `src/lib/http.ts` (session, body
  validation, `DomainError` → JSON error).
- **View** `src/app/**/page.tsx` + `src/components/`. Pages read data through controllers inside a
  `<Suspense>` boundary (Cache Components is on).
- **Agent** `src/agent/`: `socialMediaAgent` (OpenAI Agents SDK) is just another client of the
  controllers, so the chat and the screens share the same rules. Tools read `userId` from the run
  context, never from model arguments.
- **Services** `src/services/`: `instagram.ts` (Graph API, Instagram Login), `facebook.ts`
  (Facebook Login for Business: one login connects every Instagram account linked to the user's
  Pages) and `publisher.ts` (one idempotent publishing step per call, dependencies injected).
  Each account has a `login_type`; `connFor()` picks `graph.instagram.com` or
  `graph.facebook.com/v26.0` for publishing.

## Rules that are easy to break

- `schedule_post` and `publish_post_now` must keep `needsApproval: true`. A paused run is saved as
  `conversations.pending_state` and resumed only by `chat.approve`, which clears it first.
- The agent run context is plain data (`src/agent/context.ts`): `RunState.toString()` serializes it
  into the database, so never put clients or tokens in it.
- Instagram tokens are only in `instagram_tokens` (RLS on, no policies) and only read with the
  service-role client (`src/lib/supabase/admin.ts`).
- Publishing is driven by pg_cron → `POST /api/cron/publish` (Bearer `CRON_SECRET`).
  `claim_due_posts()` claims posts atomically; `ig_container_id`/`ig_media_id` are saved as soon as
  they exist so a retry never publishes twice.
- Next.js 16 specifics: middleware is `src/proxy.ts`; route files must not export `runtime`; API
  routes call `connection()` outside any `try` so they are never prerendered.
- shadcn here is the Base UI flavor (`base-nova`): use `render` instead of `asChild`, and controlled
  `Dialog open/onOpenChange`. Selects use `src/components/ui/native-select.tsx`.
