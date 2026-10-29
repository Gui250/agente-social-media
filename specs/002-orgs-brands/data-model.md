# Data Model: Organizações, Marcas e Brand Kit

Migração nova: `db/migrations/0005_orgs_brands.sql`. Mesmas convenções de `0001_init.sql`:
`uuid` com `gen_random_uuid()`, `created_at`/`updated_at` com o trigger `set_updated_at`, sem RLS.

## organizations

| Coluna | Tipo | Regras |
|--------|------|--------|
| id | uuid PK | |
| user_id | uuid → users(id) on delete cascade | dono; único com acesso (FR-003) |
| name | text | `trim`, 2–80 caracteres |
| slug | text unique | gerado do nome (research R2), `^[a-z0-9]+(-[a-z0-9]+)*$`, ≤ 65; imutável |
| created_at, updated_at | timestamptz | |

Índice: `(user_id, created_at desc)`.

## brands

| Coluna | Tipo | Regras |
|--------|------|--------|
| id | uuid PK | |
| organization_id | uuid → organizations(id) on delete cascade | |
| name | text | `trim`, 1–80; único por empresa sem diferenciar maiúsculas (FR-006) |
| description | text null | ≤ 1000 |
| industry | text null | segmento, ≤ 120 |
| target_audience | text null | ≤ 500 |
| brand_voice | text null | ≤ 500 |
| color_palette | jsonb not null default `[]` | 0–10 de `{ hex: "#RRGGBB", role }` (FR-012) |
| typography | jsonb not null default `[]` | 0–5 de `{ family: 1–80, usage }` (FR-013) |
| visual_guidelines | text[] not null default `{}` | 0–30 itens, cada um com 1–500 caracteres (FR-014) |
| forbidden_elements | text[] not null default `{}` | 0–30 itens, cada um com 1–500 caracteres (FR-014) |
| created_at, updated_at | timestamptz | |

Índices: `unique (organization_id, lower(name))`; `(organization_id, name)`.

`role` ∈ `primary | secondary | accent | background | text | other` (na UI: primária,
secundária, destaque, fundo, texto, outra). `usage` ∈ `heading | subheading | body | other`
(título, subtítulo, texto, outro). `hex` é normalizado para maiúsculas.

## brand_assets

| Coluna | Tipo | Regras |
|--------|------|--------|
| id | uuid PK | |
| brand_id | uuid → brands(id) on delete cascade | |
| asset_type | text | `logo | logo_alt | other` |
| storage_key | text unique | `<userId>/brands/<brandId>/<uuid>.<png|jpg|webp>` |
| mime_type | text | `image/png | image/jpeg | image/webp`, igual ao formato real |
| width, height | int | 64–8000 |
| size_bytes | int | ≤ 10 MB |
| created_at | timestamptz | |

Índices: `unique (brand_id) where asset_type = 'logo'` (um logo ativo); `(brand_id)`.
Regra no controller: no máximo 5 linhas com `asset_type <> 'logo'` por marca (FR-008).

## audit_log

| Coluna | Tipo | Regras |
|--------|------|--------|
| id | bigint identity PK | |
| user_id | uuid → users(id) on delete cascade | autor |
| action | text | ex.: `organization.create`, `brand.update`, `brand_asset.replace` |
| entity_type | text | `organization | brand | brand_asset` |
| entity_id | uuid | sem FK: sobrevive à exclusão |
| metadata | jsonb not null default `{}` | ex.: `{ name }`, `{ assetType }`; nunca segredos |
| created_at | timestamptz | |

Índice: `(user_id, created_at desc)`.

Ações registradas (FR-017): `organization.create|rename|delete`, `brand.create|update|delete`,
`brand_asset.create|replace|delete`.

## Relações e autorização

```text
users 1─* organizations 1─* brands 1─* brand_assets
users 1─* audit_log
```

- Empresa: `where id = $id and user_id = $userId`.
- Marca e arquivo: join até `organizations` com `o.user_id = $userId`. Linha de outro dono = 0
  linhas = `notFound("Marca", "a")` / `notFound("Arquivo")` / `notFound("Empresa", "a")` (404,
  FR-016).
- Exclusão: cascade no banco + `removeObjects()` dos `storage_key` devolvidos (research R6).

## Visão de leitura (não persistida)

`BrandView` = colunas de `brands` + `assets: [{ id, assetType, mimeType, width, height, url }]`,
com `url` de `downloadUrl()` (assinada, 1 h). `logoUrl` = a `url` do asset `logo`, ou `null`.
