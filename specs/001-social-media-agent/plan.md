# Implementation Plan: Agente de Social Media

**Branch**: `001-social-media-agent` | **Date**: 2026-10-29 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-social-media-agent/spec.md`

## Summary

Agente de social media em português que gera roteiros de criativo por segmento, agenda e publica
posts no Instagram. Um app Next.js em arquitetura MVC: o agente (OpenAI Agents SDK) e a UI são
dois clientes dos mesmos controllers. Agendar e publicar exigem aprovação via `needsApproval` do
SDK; o estado pausado fica salvo no banco. Publicação dirigida por `pg_cron` a cada minuto, com
claim atômico e IDs do Instagram persistidos para nunca duplicar. Detalhes em
[research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5, Node.js 22+ LTS

**Primary Dependencies**: Next.js (App Router), `@openai/agents`, `zod`, `@supabase/supabase-js`,
`@supabase/ssr`, shadcn/ui (Tailwind)

**Storage**: Supabase Postgres (RLS) + Supabase Storage (bucket privado `post-media`)

**Testing**: Vitest (unit; integração do `claim_due_posts` com Supabase local)

**Target Platform**: web responsiva; deploy serverless (ex.: Vercel) + Supabase Cloud

**Project Type**: web application (app Next.js único, frontend + backend)

**Performance Goals**: roteiro em < 30 s (SC-001); post publicado em até 5 min do horário (SC-004)

**Constraints**: nenhuma publicação sem aprovação; nenhuma duplicada; segredos só no servidor;
nenhuma função espera processamento de vídeo (Reels avançam por tick)

**Scale/Scope**: pequenos negócios; dezenas a centenas de usuários; ~5 telas; limite de posts
do Instagram por conta em 24 h consultado na API

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Como o design atende | Status |
|-----------|---------------------|--------|
| I. Agente como núcleo | `@openai/agents`; cada capacidade é uma tool Zod ([agent-tools](contracts/agent-tools.md)); regras nos controllers | ✅ |
| II. Publicação sob controle | `needsApproval: true` em `schedule_post`/`publish_post_now`; diálogo de confirmação na UI; estados persistidos antes da chamada ao Instagram; `claim_due_posts` + `ig_container_id`/`ig_media_id` para idempotência; `failure_reason` visível | ✅ |
| III. Segredos no servidor | agente, OpenAI e Instagram só em route handlers; tokens em `instagram_tokens` sem policies; `CRON_SECRET` no Vault; `RunState` só lido do banco com checagem de dono | ✅ |
| IV. Saídas estruturadas | sub-agente `scriptWriter` com `outputType: CreativeScript`; inválido não é salvo; instruções em pt-BR | ✅ |
| V. Simplicidade e testes | uma linguagem; um agente sem handoffs; sem fila, sem lib de datas; testes de estados, agendamento, adaptador, publisher e claim, com mocks | ✅ |
| Restrições de stack | Next.js + TS, `@openai/agents`, shadcn/ui, Supabase; rede (Instagram) e disparo (pg_cron) definidos | ✅ |

**Re-check pós-design (Fase 1)**: sem violações. A camada de controllers e o sub-agente são as
únicas estruturas adicionais e ambas têm necessidade presente (MVC pedido pelo usuário; schema
validado exigido pelo princípio IV).

## Project Structure

### Documentation (this feature)

```text
specs/001-social-media-agent/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── http-api.md
│   └── agent-tools.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── app/                          # VIEW (páginas) + rotas HTTP finas
│   ├── login/page.tsx
│   ├── (app)/chat/page.tsx
│   ├── (app)/roteiros/page.tsx
│   ├── (app)/posts/page.tsx
│   ├── (app)/contas/page.tsx
│   └── api/                      # parse da requisição → controller
│       ├── chat/route.ts
│       ├── chat/approvals/route.ts
│       ├── scripts/…, posts/…, media/route.ts, accounts/[id]/route.ts
│       ├── instagram/connect/route.ts, instagram/callback/route.ts
│       └── cron/publish/route.ts, cron/refresh-tokens/route.ts
├── components/                   # VIEW: componentes (ui/ = shadcn)
├── controllers/                  # CONTROLLER: chat, scripts, posts, media, accounts, cron
├── models/                       # MODEL: schemas Zod + queries Supabase por entidade
├── agent/
│   ├── agent.ts                  # socialMediaAgent
│   ├── script-writer.ts          # sub-agente com outputType CreativeScript
│   ├── instructions.ts
│   └── tools.ts                  # tools finas → controllers
├── services/
│   ├── instagram.ts              # adaptador Graph API (Instagram Login)
│   └── publisher.ts              # máquina de publicação por tick
└── lib/
    ├── supabase/                 # clientes server (sessão) e admin (service role)
    └── errors.ts                 # DomainError

supabase/migrations/              # tabelas, RLS, claim_due_posts, jobs pg_cron
tests/
├── unit/
└── integration/
```

**Structure Decision**: app Next.js único na raiz, MVC em `models/`, `controllers/` e
`app/`+`components/`. O agente fica em `src/agent/` e só chama controllers, como a UI. Sem
pacote backend separado: os route handlers são o backend.

## Complexity Tracking

Sem violações da constituição a justificar.
