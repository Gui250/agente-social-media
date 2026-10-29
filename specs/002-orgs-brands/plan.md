# Implementation Plan: Organizações, Marcas e Brand Kit

**Branch**: `002-orgs-brands` | **Date**: 2026-10-29 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-orgs-brands/spec.md`

## Summary

Primeira fase do Creative Intelligence Engine: o usuário cadastra empresas (só ele as acessa),
marcas por empresa e o brand kit de cada marca (cores, fontes, diretrizes, elementos proibidos,
logo e arquivos). Abordagem: três tabelas novas (`organizations`, `brands`, `brand_assets`) mais
`audit_log`, numa migração SQL; models e controllers no padrão MVC atual; envio de arquivos pelo
mesmo fluxo de PUT pré-assinado de `media`, com validação pelos bytes via `sharp`; três páginas
em `/empresas`. Nenhuma dependência nova.

## Technical Context

**Language/Version**: TypeScript 5, Node.js 24

**Primary Dependencies**: Next.js 16.4 (App Router, Cache Components), Zod 4, postgres.js 3,
`@vercel/blob` 2 (privado), `sharp` 0.35 (já usado em `media` e `overlay`; vem como dependência
transitiva do `next`, sem estar declarado em `package.json`), shadcn/ui (Base UI)

**Storage**: Postgres (Neon) via `src/lib/db.ts`; arquivos no Vercel Blob privado via
`src/lib/storage.ts`

**Testing**: Vitest — unitários com `vi.mock` dos models (padrão de
`tests/unit/skills.controller.test.ts`); integração com `TEST_DATABASE_URL`

**Target Platform**: Vercel (Fluid Compute, Node.js)

**Project Type**: aplicação web única (Next.js full-stack)

**Performance Goals**: lista de empresas e brand kit em menos de 2 s com 50 empresas × 20 marcas
(SC-005): 1–2 queries indexadas por tela, links assinados gerados em paralelo

**Constraints**: corpo de requisição ≤ 4,5 MB (por isso o envio direto ao Blob); arquivo de marca
≤ 10 MB; links assinados de 1 h; texto da UI em pt-BR

**Scale/Scope**: dezenas de empresas por usuário; 4 tabelas, ~9 rotas de API, 3 páginas

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Status | Como |
|-----------|--------|------|
| I. Regras nos controllers | ✅ | `src/controllers/organizations.ts` e `brands.ts` concentram as regras; rotas e páginas só chamam. Sem ferramenta de agente nesta fase (research R10), mas os controllers podem ser chamados por ela. |
| II. Ações externas e custos | ✅ n/a | Nenhuma publicação nem chamada paga. Exclusões passam por diálogo de confirmação. |
| III. Segredos e mídia no servidor | ✅ | Blob privado, links assinados de 1 h, sem URL guardada; validação pelos bytes (PNG/JPEG/WebP, integridade, tamanho, dimensões); log de auditoria (R7). Rate limiting não se aplica: nenhuma rota é cara (R10). |
| IV. Isolamento entre tenants | ✅ | Todas as queries filtram pelo dono via `organizations.user_id`; extensão de `tests/integration/ownership.test.ts`. Escopos de referência ficam para a próxima fase. |
| V. Saídas estruturadas / dados não confiáveis | ✅ | Entradas validadas com Zod; textos do kit guardados como dado (R9). Nenhuma saída de modelo nesta fase. |
| VI. RAG real | ✅ n/a | Sem recuperação nem geração nesta fase. |
| VII. Jobs idempotentes | ✅ n/a | Nada demorado: a validação do arquivo leva menos de 1 s, dentro da requisição. Registrar duas vezes o mesmo `storageKey` falha pelo `unique`. |
| VIII. Simplicidade e testes | ✅ | Sem dependência nova; reaproveita `storage.ts`, `route()`, `DomainError` e `sharp`. Testes de validação de arquivo, isolamento e cascata. Funcionalidades existentes não são tocadas, exceto o item de menu. |

**Resultado pós-design**: continua passando; nenhuma violação, então Complexity Tracking fica vazio.

## Project Structure

### Documentation (this feature)

```text
specs/002-orgs-brands/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/http-api.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
db/migrations/
└── 0005_orgs_brands.sql            # organizations, brands, brand_assets, audit_log

src/
├── models/
│   ├── organization.ts             # CRUD filtrado por user_id, slug com retry, delete → storage keys
│   ├── brand.ts                    # CRUD com join até o dono, kit, delete → storage keys
│   ├── brand-asset.ts              # insert/replace do logo em transação, contagem, delete
│   └── audit.ts                    # recordAudit()
├── controllers/
│   ├── organizations.ts            # slugify, schemas Zod, regras, auditoria
│   └── brands.ts                   # BrandInput, kit, upload-url, registro com sharp, auditoria
├── app/
│   ├── (app)/layout.tsx            # + item "Empresas"
│   ├── (app)/empresas/page.tsx
│   ├── (app)/empresas/[slug]/page.tsx
│   ├── (app)/empresas/[slug]/marcas/[brandId]/page.tsx
│   └── api/
│       ├── organizations/route.ts, [id]/route.ts
│       └── brands/route.ts, [id]/route.ts, [id]/assets/route.ts,
│           [id]/assets/upload-url/route.ts, [id]/assets/[assetId]/route.ts
└── components/orgs/
    ├── organization-list.tsx       # criar/listar
    ├── organization-header.tsx     # renomear, excluir com contagem
    ├── brand-list.tsx              # criar/listar marcas
    ├── brand-form.tsx              # dados da marca + kit (cores, fontes, listas)
    └── brand-assets.tsx            # envio de logo/arquivos (fluxo de media-uploader.tsx)

tests/
├── unit/organizations.controller.test.ts   # slugify, nome, retry de slug
├── unit/brands.controller.test.ts          # BrandInput, validação de arquivo com buffers reais
└── integration/ownership.test.ts           # + empresas, marcas, arquivos, cascata
```

**Structure Decision**: aplicação Next.js única, no MVC já descrito em `CLAUDE.md`. A feature
acrescenta arquivos em `models/`, `controllers/`, `app/` e `components/orgs/` sem mexer nos
existentes, exceto o menu de `src/app/(app)/layout.tsx` e um parágrafo em `CLAUDE.md` sobre
empresas e marcas.

## Complexity Tracking

Nenhuma violação da constituição a justificar.
