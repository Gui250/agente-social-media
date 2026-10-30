# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev                                   # Next.js dev server (needs DATABASE_URL)
npm test                                      # Vitest: unit + integration
npx vitest run tests/unit/publisher.test.ts   # single test file
npx tsc --noEmit                              # typecheck
npx eslint src tests                          # lint
npx next build                                # production build (catches Cache Components errors)
npm run db:migrate                            # apply db/migrations/*.sql to DATABASE_URL (once each)
```

`tests/integration/*` run only with `TEST_DATABASE_URL` pointing at a throwaway database with the
migrations applied (a Neon branch or `docker run -p 54329:5432 -e POSTGRES_PASSWORD=test postgres:18`),
never production: `claim_due_posts` claims every due post. Tests never call OpenAI or Instagram.

Environment: `OPENAI_API_KEY` lives in `.env`; `DATABASE_URL` (Neon, pooled), `BLOB_READ_WRITE_TOKEN`,
Instagram app and `CRON_SECRET` in `.env.local` (template: `.env.example`). Blob and Instagram
variables are optional until uploads/publishing are used.

## What this is

A Portuguese (pt-BR) social media agent: it writes creative scripts (Reels or static/carousel) for
a business segment, schedules posts and publishes them to Instagram. Requirements, design and the
task list live in `specs/001-social-media-agent/` (Spec Kit; see `.specify/memory/constitution.md`).
All user-facing text is Portuguese.

## Architecture (MVC in one Next.js 16 app)

- **Model** `src/models/`: Zod schemas and SQL (postgres.js, `src/lib/db.ts`) per entity. There is
  no RLS: every query that takes a `userId` must filter by `user_id` (covered by
  `tests/integration/ownership.test.ts`). `post.ts` owns the post state machine
  (`assertTransition`); every status change goes through it.
- **Controller** `src/controllers/`: use cases (validation, rules). Route handlers in `src/app/api/`
  stay thin and call controllers through `route()` from `src/lib/http.ts` (session, body
  validation, `DomainError` → JSON error); login/sign-up use `publicRoute()`.
- **Auth** (own, no provider): `src/lib/auth.ts` hashes passwords with scrypt and keeps sessions in
  the `sessions` table (cookie = random token, table = its sha256). `currentUser()`/`requireUser()`
  validate it; `src/proxy.ts` only checks that the cookie exists. Use cases in
  `src/controllers/auth.ts` (5 wrong passwords lock the account for 15 min; changing the password
  signs out other sessions).
- **View** `src/app/**/page.tsx` + `src/components/`. Pages read data through controllers inside a
  `<Suspense>` boundary (Cache Components is on).
- **Agent** `src/agent/`: `socialMediaAgent` (OpenAI Agents SDK) is just another client of the
  controllers, so the chat and the screens share the same rules. Tools read `userId` from the run
  context, never from model arguments.
- **Skills** `skills/<name>/SKILL.md` (front matter `name` + `description`, then guidelines),
  loaded by `src/agent/skills.ts`. The instructions list only names and descriptions; the agent
  reads a body with `load_skill` or passes names in `generate_creative_script.skills`, which hands
  the bodies to the script writer. Add a skill by adding a folder; `next.config.ts` traces it into
  the chat routes. Users also import their own (a SKILL.md upload on `/skills`, table
  `user_skills`, `src/controllers/skills.ts`): pass `userId` to `listSkills`/`getSkills` so they
  are included; an import can't reuse a built-in name.
  Typing `/` in the chat opens a menu of skills (`chat.skillOptions()`); the instructions tell the
  agent that `/name` in a message means that skill was chosen.
- **Visual identity** `extract_visual_identity` → `src/controllers/brand.ts` → `src/agent/brand-reader.ts`
  (vision model, structured output): colors (hex), logo, typography and style of an attached image.
  Not stored; the agent passes a summary in `generate_creative_script.visualIdentity`.
  Reference creatives work the same way: `analyze_reference_creatives` (1–5 attached images) →
  `brand.analyzeReferences` → `readReferences` returns their recipe (pattern, composition, imagery,
  colors, text, hook); the agent passes a summary in `generate_creative_script.references`, which
  reaches the writer inside `<referencias>` as data. The same images go to
  `generate_creative_media.styleMediaIds` (up to 3): the image model gets them after the real photo
  and `visualPrompt` says to follow their look without copying scene, text or logos. They also set
  the text layout: `readTextLayout` (vision, enums) → `TextLayout` (position, align, shadow/box/
  band/plain, size, case, colors) drives `withText`, the clean area in `visualPrompt` and the logo
  corner; without style references it's `DEFAULT_LAYOUT` (top, left, box with the brand color). Never in
  `referenceMediaId`, which is only the real product/place photo. `search_reference_creatives` (attached photo or post + brief) →
  `brand.researchReferences` → `searchReferences`, a sub-agent with OpenAI's hosted `webSearchTool`
  that finds agency campaigns for what the media shows and returns links + the same recipe; links
  go to the user, the recipe to `references`. SDK conventions: `.claude/skills/openai-agents-js/SKILL.md`.
- **Empresas e marcas** (`specs/002-orgs-brands`, base of the Creative Intelligence Engine):
  `organizations` (single owner `user_id`, immutable `slug` used in `/empresas/[slug]`), `brands`
  (brand kit in `color_palette`/`typography` jsonb and `visual_guidelines`/`forbidden_elements`
  text[]), `brand_assets` (one `logo` per brand, files under `<userId>/brands/<brandId>/`, checked
  with `sharp` on register: real format, decode, size, 64–8000 px) and `audit_log`. Brand and asset
  queries authorize by joining up to `organizations.user_id`. Brand kit texts are untrusted data
  for future prompts, never instructions. Blob objects of deleted rows go through
  `removeOrphans()` (logged, not thrown).
- **Brand kit no chat** (`specs/003-brand-kit-no-chat`): `@` opens a brand menu (`src/lib/mentions.ts`)
  next to the `/` skill menu; the panel sends the picked ids as `brandIds`, the server keeps only
  the user's brands and appends `[marca mencionada: id — Marca (Empresa)]`. One mention sets the
  conversation's active brand (`conversations.brand_id`, carried as `AgentContext.brandId`); the
  agent switches it with `set_active_brand` and reads brands with `list_brands`/`get_brand_kit`.
  `instructions()`, `scripts.generate` and `creatives.generate` read the active kit
  (`brands.activeKit`) on every request: the kit reaches models only as JSON inside
  `<marca>…</marca>` (`brands.kitBlock`), its forbidden elements become rules, and art takes the
  kit's primary color and logo unless the agent passes an attached logo or a color.
- **Services** `src/services/`: `instagram.ts` (Graph API, Instagram Login), `facebook.ts`
  (Facebook Login for Business: one login connects every Instagram account linked to the user's
  Pages) and `publisher.ts` (one idempotent publishing step per call, dependencies injected).
  Each account has a `login_type`; `connFor()` picks `graph.instagram.com` or
  `graph.facebook.com/v26.0` for publishing. `creative-gen.ts` (OpenAI images/Sora, same API key)
  and `overlay.tsx` (slide design drawn with `next/og` + `sharp` and `assets/fonts/`, never by the
  image model: first line of the slide text is the headline, the rest a smaller support line,
  `*words*` get a highlight in the brand color, carousels get a page bar, the last slide the `cta`
  as a button; the logo sits at the end of that chrome row, on the side opposite the text) back `src/controllers/creatives.ts`. Each slide is scored by `src/agent/art-critic.ts` (vision
  rubric, `MIN_SCORE`); a rejected one is redone once with the critic's fixes.

## Rules that are easy to break

- `schedule_post`, `publish_post_now` and `generate_creative_media` (costs money) must keep
  `needsApproval: true`. A paused run is saved as
  `conversations.pending_state` and resumed only by `chat.approve`, which clears it first.
- The agent run context is plain data (`src/agent/context.ts`): `RunState.toString()` serializes it
  into the database, so never put clients or tokens in it.
- Instagram tokens are only in `instagram_tokens` and only read in `src/models/account.ts`; they
  never reach the browser.
- Media lives in a private Vercel Blob store (`src/lib/storage.ts`): the browser uploads with a
  presigned PUT under `<userId>/`, `/api/media` checks and registers it, Instagram gets presigned
  GETs. Once a post is published its media is deleted (`releaseMedia`) unless another pending post
  uses it. Media comes from the user's uploads or from `generate_creative_media`, which writes to
  the same store under `<userId>/` and records the prompt in `generations` (kept after the media is
  released). Images are made inside the request. AI video is off since OpenAI shut down Sora
  (2026-09-24): `creatives.generate` refuses video scripts; `startVideo`/`videoTick()` stay for a
  future video provider.
- Publishing is driven by an external scheduler → `/api/cron/publish` (Bearer `CRON_SECRET`; GET
  for Vercel Cron, POST otherwise). `vercel.json` only schedules the daily token refresh (Hobby
  allows daily crons).
  `claim_due_posts()` claims posts atomically; `ig_container_id`/`ig_media_id` are saved as soon as
  they exist so a retry never publishes twice.
- Next.js 16 specifics: middleware is `src/proxy.ts`; route files must not export `runtime`; API
  routes call `connection()` outside any `try` so they are never prerendered.
- shadcn here is the Base UI flavor (`base-nova`): use `render` instead of `asChild`, and controlled
  `Dialog open/onOpenChange`. Selects use `src/components/ui/native-select.tsx`.
