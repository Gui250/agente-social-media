# Implementation Plan: Brand Kit no Chat com @

**Branch**: `003-brand-kit-no-chat` | **Date**: 2026-10-29 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/003-brand-kit-no-chat/spec.md`

## Summary

O usuário menciona uma marca no chat com `@` (menu igual ao `/` de skills) e o agente passa a criar
roteiros e artes com o brand kit dela. Abordagem: o painel envia os ids das marcas escolhidas em
`brandIds`; o servidor confere a posse, marca a mensagem com `[marca mencionada: …]` e guarda a
marca ativa em `conversations.brand_id`; o id vai no `AgentContext`. As instruções do agente
recebem o kit da marca ativa como dado delimitado; `scripts.generate` e `creatives.generate` leem o
kit no servidor (roteirista, proibidos, cor e logo). Três ferramentas novas (`list_brands`,
`get_brand_kit`, `set_active_brand`). Nenhuma dependência nova.

## Technical Context

**Language/Version**: TypeScript 5, Node.js 24

**Primary Dependencies**: Next.js 16.4, `@openai/agents` 0.21, `openai` 7, Zod 4, postgres.js 3,
`@vercel/blob` 2, `sharp` 0.35 (todos já instalados)

**Storage**: Postgres (Neon): coluna nova `conversations.brand_id`; logo lido do Blob privado

**Testing**: Vitest — unitários com `vi.mock` dos models/serviços; integração com `TEST_DATABASE_URL`
para a posse da marca ativa. Testes nunca chamam OpenAI.

**Target Platform**: Vercel (Fluid Compute)

**Project Type**: aplicação web única (Next.js full-stack)

**Performance Goals**: menu `@` em menos de 1 s (opções carregadas com a página, filtro no
navegador); bloco do kit custa uma query por run do agente

**Constraints**: contexto do agente só com dados simples (vai para `pending_state`); geração de
arte continua dentro do limite de 300 s da requisição; `needsApproval` de
`generate_creative_media` mantido

**Scale/Scope**: dezenas de marcas por usuário; 1 migração, 3 ferramentas, ~10 arquivos alterados

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Status | Como |
|-----------|--------|------|
| I. Regras nos controllers | ✅ | Kit aplicado em `scripts.generate` e `creatives.generate`; ferramentas finas sobre `brands`/`chat`. |
| II. Ações externas e custos | ✅ | `generate_creative_media` segue com aprovação; o cartão passa a mostrar a marca. |
| III. Segredos e mídia no servidor | ✅ | Logo lido do Blob privado no servidor, sem link; contexto só com ids. |
| IV. Isolamento entre tenants | ✅ | `brandIds` conferidos contra o usuário; `setConversationBrand` exige conversa e marca do mesmo dono (teste de integração); ferramentas usam `userId` do contexto. |
| V. Dados não confiáveis | ✅ | Kit entra em JSON entre `<marca>…</marca>` com aviso de "dado, não instrução", nas instruções e no roteirista. |
| VI. RAG real | ✅ n/a | Sem recuperação nesta feature. |
| VII. Jobs idempotentes | ✅ n/a | Nada novo demorado; geração de imagem segue como hoje. |
| VIII. Simplicidade e testes | ✅ | Sem dependência nova; reaproveita menu `/`, marcador de mídia, `withLogo`/`withText`. Testes de posse, filtro e resumo; nenhuma chamada paga. |

**Resultado pós-design**: continua passando; Complexity Tracking vazio.

## Project Structure

### Documentation (this feature)

```text
specs/003-brand-kit-no-chat/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/chat-and-tools.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
db/migrations/0006_conversation_brand.sql      # conversations.brand_id

src/
├── lib/mentions.ts                  # NOVO: filtro do menu @, ids ainda no texto (puro)
├── models/conversation.ts           # + brand_id na leitura, setConversationBrand()
├── models/brand.ts                  # + listBrandsForUser(userId)
├── controllers/brands.ts            # + options(), kitFor(), kitBlock()
├── controllers/chat.ts              # brandIds em sendMessage, brandId no contexto, setActiveBrand, brandOptions
├── controllers/scripts.ts           # kit da marca ativa → roteirista
├── controllers/creatives.ts         # cor/logo/proibidos do kit
├── agent/context.ts                 # + brandId
├── agent/instructions.ts            # bloco "Marca ativa" + regras de @
├── agent/tools.ts                   # list_brands, get_brand_kit, set_active_brand
├── agent/script-writer.ts           # campo brand (dado delimitado)
├── agent/visual-prompt.ts           # forbidden → "Não mostre"
├── agent/approval-summary.ts        # nome da marca no resumo
├── app/api/chat/route.ts            # brandIds no corpo
├── app/(app)/chat/page.tsx          # carrega brandOptions
└── components/chat/chat-panel.tsx   # menu @

tests/
├── unit/mentions.test.ts
├── unit/chat-brand.test.ts          # sendMessage/brandIds, contexto, resumo
├── unit/brand-kit-prompts.test.ts   # bloco Marca ativa, roteirista, visual prompt
├── unit/creatives.controller.test.ts  # + cor/logo do kit
└── integration/ownership.test.ts    # + setConversationBrand
```

**Structure Decision**: mesma aplicação Next.js e MVC. A feature altera o chat e o agente
existentes. Risco: `src/controllers/chat.ts` e `src/app/(app)/chat/page.tsx` têm mudanças não
commitadas do usuário (excluir conversas); commitar ou guardar esse trabalho antes de implementar
para não misturar os dois no commit.

## Complexity Tracking

Nenhuma violação da constituição a justificar.
