# Contract: HTTP API — Empresas, Marcas e Brand Kit

JSON. Toda rota exige a sessão própria do app (cookie; `route()` de `src/lib/http.ts`). Erros:
`{ error: { code, message } }`, com `message` em português. Códigos: 400 validação
(`invalid_input`, `invalid_asset`, `asset_limit`), 401 sem sessão, 404 não encontrado ou de outro
dono (`not_found`), 409 conflito (`brand_conflict`).

Os tipos `Organization`, `Brand` e `BrandView` seguem [data-model.md](../data-model.md), com
campos em camelCase.

## Empresas

| Método | Rota | Corpo | Resposta |
|--------|------|-------|----------|
| GET | `/api/organizations` | — | `[{ id, name, slug, brandCount, createdAt, updatedAt }]` |
| POST | `/api/organizations` | `{ name: string (2–80) }` | 201 `Organization` |
| PATCH | `/api/organizations/:id` | `{ name: string (2–80) }` | `Organization` (slug não muda) |
| DELETE | `/api/organizations/:id` | — | 204; apaga marcas e arquivos |

## Marcas

| Método | Rota | Corpo | Resposta |
|--------|------|-------|----------|
| POST | `/api/brands` | `{ organizationId, name, description?, industry?, targetAudience?, brandVoice? }` | 201 `Brand`; 409 nome repetido na empresa |
| GET | `/api/brands/:id` | — | `BrandView` |
| PATCH | `/api/brands/:id` | qualquer subconjunto de `BrandInput` | `BrandView`; 409 nome repetido |
| DELETE | `/api/brands/:id` | — | 204; apaga arquivos |

```text
BrandInput {
  name?: string (1–80)
  description?: string (≤1000) | null
  industry?: string (≤120) | null
  targetAudience?: string (≤500) | null
  brandVoice?: string (≤500) | null
  colorPalette?: [{ hex: /^#[0-9a-fA-F]{6}$/, role: "primary"|"secondary"|"accent"|"background"|"text"|"other" }] (0–10)
  typography?: [{ family: string (1–80), usage: "heading"|"subheading"|"body"|"other" }] (0–5)
  visualGuidelines?: string (1–500)[] (0–30)
  forbiddenElements?: string (1–500)[] (0–30)
}
```

Strings passam por `trim`; string vazia em campo opcional vira `null`. Os campos de lista
substituem a lista inteira.

## Arquivos de marca

| Método | Rota | Corpo | Resposta |
|--------|------|-------|----------|
| POST | `/api/brands/:id/assets/upload-url` | `{ mimeType: "image/png"\|"image/jpeg"\|"image/webp" }` | `{ storageKey, uploadUrl }` (PUT, até 10 MB, vale 10 min) |
| POST | `/api/brands/:id/assets` | `{ storageKey, assetType: "logo"\|"logo_alt"\|"other" }` | 201 `{ id, assetType, mimeType, width, height, url }`; um `logo` substitui o anterior |
| DELETE | `/api/brands/:id/assets/:assetId` | — | 204 |

Fluxo no navegador: `upload-url` → `PUT uploadUrl` com o arquivo → `POST assets`.

Erros do registro (o objeto enviado é apagado):

- `storageKey` fora de `<userId>/brands/<brandId>/` → 404.
- Formato real diferente de PNG/JPEG/WebP, ou diferente do declarado, ou arquivo que não
  decodifica → 400 `invalid_asset`.
- Acima de 10 MB, ou lado menor que 64 px ou maior que 8000 px → 400 `invalid_asset`.
- Já existem 5 arquivos que não são o logo → 400 `asset_limit`.

## Páginas

| Rota | Conteúdo |
|------|----------|
| `/empresas` | lista com contagem de marcas, criar empresa, estado vazio |
| `/empresas/[slug]` | renomear, excluir (diálogo com contagem de marcas), lista e criação de marcas |
| `/empresas/[slug]/marcas/[brandId]` | dados da marca, brand kit (cores, fontes, diretrizes, proibidos), logo e arquivos, excluir marca |

Slug ou marca de outro dono → `notFound()` do Next (404), igual a um id inexistente.
