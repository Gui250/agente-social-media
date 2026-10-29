---

description: "Task list for Organizações, Marcas e Brand Kit"
---

# Tasks: Organizações, Marcas e Brand Kit

**Input**: Design documents from `/specs/002-orgs-brands/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/http-api.md, quickstart.md

**Tests**: Included where the spec (SC-002, SC-003, SC-006) and the constitution (principles IV and
VIII: tenant isolation, file validation) require them. Unit tests mock models with `vi.mock`
(pattern of `tests/unit/skills.controller.test.ts`); integration tests extend
`tests/integration/ownership.test.ts` and run only with `TEST_DATABASE_URL`.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- All user-facing strings are Portuguese (pt-BR); errors use `DomainError` / `notFound()` from
  `src/lib/errors.ts`; routes use `route()` from `src/lib/http.ts`; pages read through controllers
  inside `<Suspense>` and call `requireUser()` (pattern of `src/app/(app)/skills/page.tsx`).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Make an implicit dependency explicit

- [X] T001 Declare `sharp` (`^0.35.5`, the version already installed through `next`) in `dependencies` of `package.json` and run `npm install` so `package-lock.json` records it; no other dependency is added

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema and audit log that every story writes to

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 Create `db/migrations/0005_orgs_brands.sql` following `0001_init.sql` conventions (`uuid` PKs with `gen_random_uuid()`, `set_updated_at` triggers, no RLS, header comment explaining that every query filters by the owner through `organizations.user_id`), exactly as in `specs/002-orgs-brands/data-model.md`:
  - `organizations`: `user_id uuid not null references users (id) on delete cascade`; `name text not null check (char_length(name) between 2 and 80)`; `slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 65)`; `created_at`, `updated_at`; index `(user_id, created_at desc)`; `updated_at` trigger
  - `brands`: `organization_id uuid not null references organizations (id) on delete cascade`; `name text not null check (char_length(name) between 1 and 80)`; `description text check (char_length(description) <= 1000)`; `industry text check (char_length(industry) <= 120)`; `target_audience text check (char_length(target_audience) <= 500)`; `brand_voice text check (char_length(brand_voice) <= 500)`; `color_palette jsonb not null default '[]'`; `typography jsonb not null default '[]'`; `visual_guidelines text[] not null default '{}'`; `forbidden_elements text[] not null default '{}'`; `created_at`, `updated_at`; `create unique index brands_org_name on brands (organization_id, lower(name))`; `updated_at` trigger
  - `brand_assets`: `brand_id uuid not null references brands (id) on delete cascade`; `asset_type text not null check (asset_type in ('logo', 'logo_alt', 'other'))`; `storage_key text not null unique`; `mime_type text not null check (mime_type in ('image/png', 'image/jpeg', 'image/webp'))`; `width int not null check (width between 64 and 8000)`; `height int not null check (height between 64 and 8000)`; `size_bytes int not null check (size_bytes <= 10485760)`; `created_at`; `create unique index brand_assets_one_logo on brand_assets (brand_id) where asset_type = 'logo'`; index `(brand_id)`
  - `audit_log`: `id bigint generated always as identity primary key`; `user_id uuid not null references users (id) on delete cascade`; `action text not null`; `entity_type text not null check (entity_type in ('organization', 'brand', 'brand_asset'))`; `entity_id uuid not null` (no FK, survives deletes); `metadata jsonb not null default '{}'`; `created_at`; index `(user_id, created_at desc)`
- [X] T003 [P] Create `src/models/audit.ts` with `recordAudit(row: { userId; action; entityType: "organization" | "brand" | "brand_asset"; entityId; metadata?: Record<string, unknown> })` inserting into `audit_log` (`import "server-only"`, `sql()` from `src/lib/db.ts`); actions are `organization.create|rename|delete`, `brand.create|update|delete`, `brand_asset.create|replace|delete`; metadata never holds secrets
- [X] T004 Apply the migration to the local/test database with `npm run db:migrate` (and to `TEST_DATABASE_URL`) and confirm the four tables exist

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 - Cadastrar empresas (Priority: P1) 🎯 MVP

**Goal**: The user creates, lists, renames and deletes companies; nobody else can see or touch them.

**Independent Test**: User A creates two companies and sees both in `/empresas`; user B gets an empty list and a 404 on `/empresas/<slug-de-A>` and on `PATCH/DELETE /api/organizations/<id-de-A>`.

### Tests for User Story 1

- [X] T005 [P] [US1] Unit tests in `tests/unit/organizations.controller.test.ts` (mock `@/models/organization` and `@/models/audit`): `slugify("Ação & Cia") === "acao-cia"`; repeated/edge hyphens trimmed; result capped at 60 chars; a name that slugifies to empty (`"!!!"`) gives `"empresa"`; `create` retries with a `-` + 4 hex suffix when the model throws a Postgres `23505` on `slug` and gives up after 3 attempts; names that are empty or only spaces, shorter than 2 or longer than 80 chars after `trim` are rejected with `DomainError` and nothing is inserted; `create`, `rename` and `remove` call `recordAudit` with `organization.create|rename|delete`
- [X] T006 [P] [US1] Extend `tests/integration/ownership.test.ts`: import `@/models/organization`; in `beforeAll` create an organization for alice; assert alice sees it in `listOrganizations` (with `brandCount: 0`) and via `getOrganizationBySlug`, while bob gets `[]` from `listOrganizations` and 404 from `getOrganization`, `getOrganizationBySlug`, `renameOrganization` and `deleteOrganization`

### Implementation for User Story 1

- [X] T007 [US1] Create `src/models/organization.ts` (`import "server-only"`, every query filters by `user_id`, missing/foreign row → `notFound("Empresa", "a")`): type `OrganizationRow`; `insertOrganization({ userId, name, slug })`; `listOrganizations(userId)` returning rows plus `brandCount` (count of `brands`, ordered by `created_at desc`); `getOrganization(userId, id)`; `getOrganizationBySlug(userId, slug)`; `renameOrganization(userId, id, name)` (slug unchanged); `deleteOrganization(userId, id)` that deletes the organization and returns the `storage_key`s of all its brands' `brand_assets` in the same statement (CTE reading the keys before the `delete`, research R6)
- [X] T008 [US1] Create `src/controllers/organizations.ts`: `OrganizationName = z.string().trim().min(2).max(80)` with Portuguese messages; `slugify(name)` per research R2 (`normalize("NFD")`, strip diacritics, lowercase, non `[a-z0-9]` → `-`, collapse/trim hyphens, max 60, empty → `"empresa"`); `create(userId, name)` inserting with the slug and, on Postgres error `23505` for the slug, retrying with `${slug}-${randomBytes(2).toString("hex")}` up to 3 attempts; `list`, `getBySlug`, `rename(userId, id, name)`; `remove(userId, id)` → `deleteOrganization` then `removeOrphans(keys)` from `src/lib/storage.ts` (logs a failed blob removal instead of failing a delete that already happened); `recordAudit` after each mutation with `{ name }` metadata
- [X] T009 [P] [US1] Create `src/app/api/organizations/route.ts` — `GET` → `organizations.list(user.id)` mapped to camelCase `{ id, name, slug, brandCount, createdAt, updatedAt }`; `POST` with body `z.object({ name: OrganizationName })`, status 201 (contracts/http-api.md › Empresas)
- [X] T010 [P] [US1] Create `src/app/api/organizations/[id]/route.ts` — `PATCH` with body `{ name }` → `organizations.rename`; `DELETE` → `organizations.remove`, 204
- [X] T011 [P] [US1] Create `src/components/orgs/organization-list.tsx` (client): create form (name input + "Criar empresa" button, `api()` from `src/lib/api-client.ts`, `toast` on error, `router.refresh()` on success), list of companies linking to `/empresas/<slug>` showing slug and "N marcas", empty state "Nenhuma empresa ainda. Crie a primeira." 
- [X] T012 [P] [US1] Create `src/components/orgs/organization-header.tsx` (client): shows name and slug, inline rename (PATCH), and "Excluir empresa" opening a controlled `Dialog` (`open`/`onOpenChange`, Base UI) that says how many brands will be deleted with it ("Isso exclui também N marcas e seus arquivos.") and only calls `DELETE` after explicit confirmation, then navigates to `/empresas`
- [X] T013 [US1] Create `src/app/(app)/empresas/page.tsx`: heading "Empresas", `<Suspense>` with a server component that calls `requireUser()` and `organizations.list` and renders `OrganizationList`
- [X] T014 [US1] Create `src/app/(app)/empresas/[slug]/page.tsx`: `params` is a `Promise<{ slug }>`; inside `<Suspense>` load the organization with `organizations.getBySlug(user.id, slug)` and call Next's `notFound()` when it throws a 404 `DomainError`; render `OrganizationHeader` (with `brandCount`); leave a placeholder section "Marcas" that US2 fills
- [X] T015 [US1] Add `{ href: "/empresas", label: "Empresas" }` as the first item of `nav` in `src/app/(app)/layout.tsx`

**Checkpoint**: User Story 1 is fully functional and testable independently

---

## Phase 4: User Story 2 - Cadastrar marcas de uma empresa (Priority: P2)

**Goal**: Inside a company, the user creates, lists, edits and deletes brands with name, description, segment, audience and brand voice.

**Independent Test**: In an existing company create "Sorriso Kids" and "Sorriso Estética", try "sorriso kids" (refused with 409 message), edit the audience of one and see it after reload; bob gets 404 on `GET/PATCH/DELETE /api/brands/<id>`.

### Tests for User Story 2

- [X] T016 [P] [US2] Unit tests in `tests/unit/brands.controller.test.ts` (mock `@/models/brand`, `@/models/organization`, `@/models/audit`, `@/lib/storage`): `BrandInput` trims strings and turns empty optional strings into `null`; rejects `name` outside 1–80, `description` > 1000, `industry` > 120, `targetAudience` > 500, `brandVoice` > 500; `create` checks the organization belongs to the user before inserting; a model `23505` on `brands_org_name` becomes `DomainError("brand_conflict", …, 409)`; `create`/`update`/`remove` call `recordAudit` with `brand.create|update|delete`
- [X] T017 [P] [US2] Extend `tests/integration/ownership.test.ts`: import `@/models/brand`; create a brand in alice's organization; alice sees it in `listBrands` and `getBrand`; bob gets 404 from `getBrand`, `updateBrand`, `deleteBrand` and from `insertBrand` into alice's organization; inserting a second brand named with different case in the same organization fails with `23505`

### Implementation for User Story 2

- [X] T018 [US2] Create `src/models/brand.ts` (`import "server-only"`; every query joins `organizations o` and filters `o.user_id = ${userId}`; missing/foreign → `notFound("Marca", "a")`): type `BrandRow` with all columns of `brands`; `insertBrand(userId, organizationId, fields)` that inserts only when the organization belongs to `userId` (`insert … select … from organizations where id = … and user_id = …`, 0 rows → `notFound("Empresa", "a")`); `listBrands(userId, organizationId)` ordered by `name`; `getBrand(userId, id)` (also returns the organization `slug`); `updateBrand(userId, id, fields)` updating only the given columns (`sql(fields, ...keys)`), 0 rows → 404; `deleteBrand(userId, id)` returning the brand's `brand_assets.storage_key`s in the same statement (research R6)
- [X] T019 [US2] Create `src/controllers/brands.ts`: `BrandInput` Zod object (all optional for PATCH) with `name: 1–80`, `description: ≤1000 | null`, `industry: ≤120 | null`, `targetAudience: ≤500 | null`, `brandVoice: ≤500 | null`, strings trimmed and `""` → `null`; `CreateBrand = BrandInput.extend({ organizationId: z.uuid(), name: required })`; `create`, `list(userId, organizationId)`, `get(userId, id)`, `update(userId, id, input)`, `remove(userId, id)` (→ `removeOrphans(keys)`); map Postgres `23505` on the name index to `DomainError("brand_conflict", "Já existe uma marca com esse nome nesta empresa.", 409)`; camelCase ↔ snake_case mapping lives here; `recordAudit` after each mutation
- [X] T020 [P] [US2] Create `src/app/api/brands/route.ts` — `POST` with body `CreateBrand`, status 201 (contracts/http-api.md › Marcas)
- [X] T021 [P] [US2] Create `src/app/api/brands/[id]/route.ts` — `GET` → `brands.get`; `PATCH` with body `BrandInput` → `brands.update`; `DELETE` → `brands.remove`, 204
- [X] T022 [P] [US2] Create `src/components/orgs/brand-list.tsx` (client): "Nova marca" form (name only) posting to `/api/brands` with `organizationId`, list of brands linking to `/empresas/<slug>/marcas/<brandId>` with segment shown under the name, empty state "Nenhuma marca nesta empresa."
- [X] T023 [P] [US2] Create `src/components/orgs/brand-form.tsx` (client): fields name, description, segmento (`industry`), público-alvo, tom de voz using `Input`/`Textarea`/`Label` from `src/components/ui/`; "Salvar" sends only the changed fields with `PATCH /api/brands/<id>` and shows `toast` success/error; "Excluir marca" opens a controlled confirmation `Dialog` and, after `DELETE`, navigates to `/empresas/<slug>`
- [X] T024 [US2] In `src/app/(app)/empresas/[slug]/page.tsx` replace the "Marcas" placeholder with `brands.list(user.id, organization.id)` rendered by `BrandList`
- [X] T025 [US2] Create `src/app/(app)/empresas/[slug]/marcas/[brandId]/page.tsx`: `params` is a `Promise<{ slug; brandId }>`; inside `<Suspense>` load `brands.get(user.id, brandId)`, call `notFound()` on a 404 or when the brand's organization slug differs from `slug`; show breadcrumb "Empresas › <empresa> › <marca>" and render `BrandForm`

**Checkpoint**: User Stories 1 and 2 both work independently

---

## Phase 5: User Story 3 - Configurar o brand kit (Priority: P3)

**Goal**: On the brand page the user uploads the logo and extra brand files and defines colors, fonts, visual guidelines and forbidden elements.

**Independent Test**: In an existing brand upload a PNG logo, add 3 colors with roles, 2 fonts, 1 guideline and 1 forbidden element, reload and see everything saved with the logo shown; a `.txt` renamed to `.png`, a 32×32 PNG and the color `azulzinho` are refused with the reason.

### Tests for User Story 3

- [X] T026 [P] [US3] Extend `tests/unit/brands.controller.test.ts` for the kit schema: `colorPalette` accepts 0–10 `{ hex: /^#[0-9a-fA-F]{6}$/, role: "primary"|"secondary"|"accent"|"background"|"text"|"other" }` and normalizes `hex` to uppercase, rejects `"azulzinho"` and an 11th color; `typography` accepts 0–5 `{ family: 1–80, usage: "heading"|"subheading"|"body"|"other" }`; `visualGuidelines`/`forbiddenElements` accept 0–30 items of 1–500 chars and reject a 501-char item and a 31st item
- [X] T027 [P] [US3] Unit tests in `tests/unit/brand-assets.test.ts` (mock `@/lib/storage`, `@/models/brand`, `@/models/brand-asset`, `@/models/audit`; build real images with `sharp({ create: … })` like `tests/unit/media.controller.test.ts`): a 128×128 PNG registered as `logo` is accepted with its real `mimeType`, `width`, `height`; refused with `invalid_asset` and the object removed via `removeObjects`: bytes of a text file under a `.png` key, a truncated PNG, a 32×32 PNG, a 9000-px-wide image, a JPEG under a `.png` key (format ≠ declared), more than 10 MB; a `storageKey` outside `<userId>/brands/<brandId>/` or containing `..` → 404 without reading it; a 6th non-logo asset → `asset_limit`; registering a `logo` when one exists calls the model's replace and removes the old key; `requestUpload` rejects `image/gif` and returns a key `<userId>/brands/<brandId>/<uuid>.<png|jpg|webp>`
- [X] T028 [P] [US3] Extend `tests/integration/ownership.test.ts`: import `@/models/brand-asset`; insert a `logo` for alice's brand; a second `insertAsset` with `asset_type = 'logo'` for the same brand fails (unique), while `replaceLogo` swaps it and returns the old `storage_key`; bob gets 404 from `deleteAsset` and an empty list from `listAssets`; finally `deleteOrganization(alice, org)` returns the asset keys and leaves no `brands`/`brand_assets` rows for that organization (cascade, FR-004)

### Implementation for User Story 3

- [X] T029 [US3] Extend `BrandInput` in `src/controllers/brands.ts` with the kit fields, quoting data-model.md: `colorPalette` "0–10 de `{ hex: "#RRGGBB", role }`" (`hex` normalized to uppercase, `role ∈ primary | secondary | accent | background | text | other`), `typography` "0–5 de `{ family: 1–80, usage }`" (`usage ∈ heading | subheading | body | other`), `visualGuidelines` and `forbiddenElements` "0–30 itens, cada um com 1–500 caracteres"; Portuguese messages such as "Cor inválida: use o formato #RRGGBB."; lists replace the whole stored list; texts stored as typed (research R9); map to `color_palette`, `typography`, `visual_guidelines`, `forbidden_elements` in `updateBrand`
- [X] T030 [P] [US3] Create `src/models/brand-asset.ts` (`import "server-only"`; every query joins `brands b` and `organizations o` with `o.user_id = ${userId}`; missing/foreign → `notFound("Arquivo")`): type `BrandAssetRow`; `listAssets(userId, brandId)`; `countNonLogoAssets(userId, brandId)`; `insertAsset(userId, row)`; `replaceLogo(userId, row)` in `sql().begin` that deletes the current `logo` row (`returning storage_key`) and inserts the new one, returning `{ asset, oldKey }`; `deleteAsset(userId, brandId, assetId)` returning the deleted `storage_key`
- [X] T031 [US3] Add brand files to `src/controllers/brands.ts` (research R4/R5, contracts/http-api.md › Arquivos de marca): `TYPES = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" }`, `MAX_BYTES = 10 * 1024 * 1024`, `MIN_SIDE = 64`, `MAX_SIDE = 8000`, `MAX_EXTRA_ASSETS = 5`; `requestUpload(userId, brandId, mimeType)` checks the brand with `getBrand`, builds `<userId>/brands/<brandId>/<randomUUID()>.<ext>` and returns `{ storageKey, uploadUrl: await uploadUrl(key, mimeType, MAX_BYTES, 60) }` (CDN cache capped at 60 s, see Notes); `registerAsset(userId, brandId, storageKey, assetType)` validates the key prefix (no `..`, else 404), `getBrand`, `objectInfo` (missing → 404), then `readObject` + `sharp(bytes).metadata()` inside `try` and rejects (after `removeObjects([storageKey])`) with `DomainError("invalid_asset", …)` when the format is not `png|jpeg|webp`, differs from the key's extension, fails to decode, exceeds 10 MB, or a side is < 64 or > 8000 px ("A imagem precisa ter entre 64 e 8000 pixels de cada lado."); for non-logo types enforce `countNonLogoAssets < 5` (`DomainError("asset_limit", "Limite de 5 arquivos além do logo. Exclua um para enviar outro.")`); `logo` → `replaceLogo` then `removeObjects([oldKey])` and audit `brand_asset.replace` (or `create` when there was none); others → `insertAsset` and audit `brand_asset.create`; return `{ id, assetType, mimeType, width, height, url: await downloadUrl(key) }`; `removeAsset(userId, brandId, assetId)` → `deleteAsset`, `removeObjects`, audit `brand_asset.delete`
- [X] T032 [US3] Make `brands.get` in `src/controllers/brands.ts` return `BrandView` (data-model.md › Visão de leitura): brand fields in camelCase plus `assets` with `url` from `downloadUrl()` generated in parallel (`Promise.all`) and `logoUrl` (the `logo` asset's url or `null`)
- [X] T033 [P] [US3] Create `src/app/api/brands/[id]/assets/upload-url/route.ts` — `POST` with body `{ mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]) }` → `brands.requestUpload`
- [X] T034 [P] [US3] Create `src/app/api/brands/[id]/assets/route.ts` — `POST` with body `{ storageKey: z.string().max(300), assetType: z.enum(["logo", "logo_alt", "other"]) }` → `brands.registerAsset`, status 201
- [X] T035 [P] [US3] Create `src/app/api/brands/[id]/assets/[assetId]/route.ts` — `DELETE` → `brands.removeAsset`, 204
- [X] T036 [P] [US3] Create `src/components/orgs/brand-assets.tsx` (client, same three-step flow as `src/components/media/media-uploader.tsx`: `upload-url` → `PUT uploadUrl` → `POST assets`; `accept="image/png,image/jpeg,image/webp"`): "Logo" block showing the current logo (`<img>` with the signed URL, eslint comment as in media-uploader) with "Enviar logo"/"Trocar logo"; "Outros arquivos" list with type select (`NativeSelect` from `src/components/ui/native-select.tsx`: "Logo alternativo", "Outro") and remove buttons; disable the button while uploading; `toast` the API's Portuguese error; `router.refresh()` after each change
- [X] T037 [US3] Extend `src/components/orgs/brand-form.tsx` with the kit sections: "Cores" (rows with `<input type="color">` + hex text input + role `NativeSelect` in Portuguese labels primária/secundária/destaque/fundo/texto/outra, add/remove, max 10), "Fontes" (family + usage título/subtítulo/texto/outro, max 5), "Diretrizes visuais" and "Elementos proibidos" (one item per line in a `Textarea`, split on save, empty lines dropped); all saved by the same "Salvar" PATCH
- [X] T038 [US3] Render `BrandAssets` above `BrandForm` in `src/app/(app)/empresas/[slug]/marcas/[brandId]/page.tsx`, passing `brand.assets` from the `BrandView`

**Checkpoint**: All user stories are independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation and full validation

- [X] T039 [P] Add an "Empresas e marcas" paragraph to the Architecture section of `CLAUDE.md`: tables `organizations` (owner `user_id`, single-owner model), `brands` (kit in `jsonb`/`text[]`), `brand_assets` (one `logo` per brand, files under `<userId>/brands/<brandId>/`, validated with `sharp` on register), `audit_log`; models filter by owner through `organizations.user_id`; brand kit texts are untrusted data for future prompts
- [X] T040 Run `npx tsc --noEmit`, `npx eslint src tests`, `npm test` (with `TEST_DATABASE_URL` set) and `npx next build`; fix every failure; all pre-existing tests must still pass (SC-006)
- [X] T041 Run the manual script in `specs/002-orgs-brands/quickstart.md` (steps 1–7) with `npm run dev` and record any limitation found in the Notes below

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: after Setup — BLOCKS all user stories (T002 → T004; T003 parallel to T002)
- **US1 (Phase 3)**: after Foundational
- **US2 (Phase 4)**: after Foundational; its pages live under the US1 company page (T024 edits T014's file, T025 needs a company to exist), so in practice after US1
- **US3 (Phase 5)**: after US2 (extends `src/controllers/brands.ts`, `brand-form.tsx` and the brand page)
- **Polish (Phase 6)**: after the stories you want to ship

### Within Each User Story

- Tests first, and they fail before the implementation
- Model → controller → API routes and components → pages
- Same-file tasks are sequential: `src/controllers/brands.ts` (T019 → T029 → T031 → T032), `brand-form.tsx` (T023 → T037), `[slug]/page.tsx` (T014 → T024), brand page (T025 → T038), `ownership.test.ts` (T006 → T017 → T028), `brands.controller.test.ts` (T016 → T026)

### Parallel Opportunities

- T003 alongside T002
- US1: T005 + T006 (tests); after T008: T009, T010, T011, T012
- US2: T016 + T017; after T019: T020, T021, T022, T023
- US3: T026 + T027 + T028; T030 alongside T029; after T031/T032: T033, T034, T035, T036
- T039 alongside T040

---

## Parallel Example: User Story 3

```bash
# Tests together:
Task: "Kit schema tests in tests/unit/brands.controller.test.ts"
Task: "File validation tests in tests/unit/brand-assets.test.ts"
Task: "Asset isolation and cascade in tests/integration/ownership.test.ts"

# After the controller is done, routes and component together:
Task: "POST upload-url in src/app/api/brands/[id]/assets/upload-url/route.ts"
Task: "POST register in src/app/api/brands/[id]/assets/route.ts"
Task: "DELETE asset in src/app/api/brands/[id]/assets/[assetId]/route.ts"
Task: "Uploader UI in src/components/orgs/brand-assets.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 + Phase 2
2. Phase 3 (US1)
3. **STOP and VALIDATE**: quickstart steps 1–2 and the isolation tests
4. Demo: companies with isolation, the base for everything else

### Incremental Delivery

1. Setup + Foundational → schema ready
2. US1 → companies (MVP)
3. US2 → brands per company
4. US3 → brand kit and files
5. Each step runs `npx tsc --noEmit` and `npm test` before moving on (constitution, Fluxo de Desenvolvimento)

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- No agent tools, rate limiting or brand-kit consumption in prompts in this phase (research R10, spec Assumptions)
- Commit after each phase checkpoint

### Implementation notes (2026-10-29)

- T004: migrations applied to a throwaway Postgres (Docker, `TEST_DATABASE_URL`) for the tests, and
  `0005_orgs_brands.sql` applied to `DATABASE_URL` (Neon) by the owner on 2026-10-29.
- Blob's CDN keeps objects for a month by default and a delete does not purge copies already cached:
  a signed logo URL fetched before the delete kept answering 200 (`x-vercel-cache: HIT`). Brand files
  are now uploaded with `cacheControlMaxAge: 60` (Blob's minimum), so SC-004 holds within about a
  minute; in the run, the link answered 404 right after the delete. Post media (`/api/media`) still
  uses the default.
- `validate()` moved from `src/lib/http.ts` to `src/lib/errors.ts` so controllers reuse the same
  400 message; `removeOrphans()` added to `src/lib/storage.ts`.
- Pages answer HTTP 200 with the not-found UI for another owner's company or brand (Partial
  Prerendering streams the status before the 404 is known, same as `/chat`); no data leaks.
- Quickstart run over HTTP against `next start` (production build): API, pages, uploads with
  real Blob (fake PNG, 32×32, GIF refused; old logo link 404 after replace) and cascade delete. The
  UI was checked by its rendered HTML, not clicked through in a browser.
