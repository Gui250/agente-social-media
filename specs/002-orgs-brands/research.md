# Research: Organizações, Marcas e Brand Kit

Não sobrou nenhum NEEDS CLARIFICATION no Technical Context: tudo cabe na stack atual. Cada
decisão abaixo reaproveita um padrão que já existe no código.

## R1. Modelo de acesso: dono único

- **Decision**: `organizations.user_id` (dono). Toda query de empresa filtra por `user_id`; marcas
  e arquivos são autorizados com join até a empresa (`brands → organizations.user_id`).
- **Rationale**: FR-003 (opção A). É o mesmo padrão de todas as tabelas atuais (`user_id` + filtro
  em `src/models`), já coberto por `tests/integration/ownership.test.ts`.
- **Alternatives considered**: tabela `organization_members` com um único membro. Rejeitada por
  enquanto: é uma junção a mais sem uso presente. Para chegar ao modelo B depois, uma migração
  cria `organization_members` a partir de `user_id`, e só as queries de `src/models/organization.ts`
  e `src/models/brand.ts` mudam.

## R2. Slug

- **Decision**: gerado no servidor a partir do nome: `normalize("NFD")`, remoção de diacríticos,
  minúsculas, tudo que não for `[a-z0-9]` vira `-`, sem hífens repetidos ou nas pontas, até 60
  caracteres; se ficar vazio, usa `empresa`. Unicidade por `unique (slug)`; numa violação
  (`23505`), tenta de novo com o sufixo `-` + 4 caracteres hex aleatórios (até 3 tentativas).
  O slug não muda quando a empresa é renomeada, para os links continuarem valendo.
- **Rationale**: FR-002. As URLs das páginas usam o slug (`/empresas/[slug]`); a API usa o id.
- **Alternatives considered**: sufixo sequencial (`-2`, `-3`), que exige consultar os slugs
  existentes e ainda pode colidir entre requisições concorrentes; slug que muda ao renomear, que
  quebraria links salvos.

## R3. Onde guardar o brand kit

- **Decision**: colunas em `brands`: `color_palette jsonb` (`[{hex, role}]`),
  `typography jsonb` (`[{family, usage}]`), `visual_guidelines text[]`,
  `forbidden_elements text[]`. Formato e limites validados com Zod no controller (FR-012..014).
  O "logoUrl" do briefing não é guardado: é um link assinado gerado na leitura a partir do
  `brand_assets` de tipo `logo`.
- **Rationale**: o kit é lido e gravado sempre inteiro, junto com a marca; tabelas filhas para
  cores e fontes só acrescentariam joins. Uma URL guardada contrariaria o princípio III (nada de
  link permanente).
- **Alternatives considered**: tabelas `brand_colors` e `brand_fonts`, rejeitadas porque nenhuma
  consulta filtra por cor ou fonte.

## R4. Envio e validação de arquivos de marca

- **Decision**: mesmo fluxo de `src/controllers/media.ts`: (1) o servidor emite um PUT pré-assinado
  com `uploadUrl()` de `src/lib/storage.ts` em
  `<userId>/brands/<brandId>/<uuid>.<ext>`, com tipo declarado e máximo de 10 MB; (2) o navegador
  envia o arquivo direto ao Blob; (3) no registro, o servidor lê o objeto (`readObject`) e valida
  com `sharp().metadata()`: o formato real precisa ser `png`, `jpeg` ou `webp` e bater com a
  extensão, a imagem precisa decodificar, ter até 10 MB e entre 64 e 8000 px por lado. Se a
  validação falhar, o objeto é apagado e o erro explica o motivo (FR-009). O arquivo fica no
  formato original (logos precisam de transparência; não converte para JPEG como `media`).
- **Rationale**: reaproveita `storage.ts` e o `sharp`, que já está instalado; a checagem pelos
  bytes cobre "tipo real" e "integridade" sem dependência nova.
- **Alternatives considered**: estender `media` / `/api/media`, rejeitado porque mídia de post tem
  outros tipos, converte PNG em JPEG e é apagada depois da publicação. Upload pelo corpo da
  requisição, rejeitado pelo limite de 4,5 MB das Functions.

## R5. Logo único e substituição

- **Decision**: `brand_assets.asset_type in ('logo','logo_alt','other')` com índice único parcial
  `(brand_id) where asset_type = 'logo'`. Registrar um logo novo, numa transação, apaga a linha do
  logo anterior (`returning storage_path`) e insere a nova; depois do commit, o blob antigo é
  removido. Clique duplo = dois envios, e o último registrado fica como logo (edge case da spec).
  No máximo 5 arquivos que não sejam o logo por marca (FR-008), checado no registro.
- **Rationale**: FR-011 e SC-004: apagado o blob, o link assinado antigo para de funcionar.
- **Achado na implementação**: o CDN do Blob guarda cada objeto por 1 mês por padrão e a exclusão
  não invalida cópias já em cache; um link acessado antes da exclusão continuou respondendo. Os
  arquivos de marca são enviados com `cacheControlMaxAge: 60` (mínimo do Blob), então o link para
  de funcionar em até ~1 minuto.

## R6. Exclusão em cascata e blobs

- **Decision**: FKs com `on delete cascade` (`organizations → brands → brand_assets`). O model
  apaga a empresa ou a marca e devolve, na mesma instrução, os `storage_path` dos arquivos
  (CTE que lê os caminhos antes do `delete`); o controller chama `removeObjects()` em seguida.
- **Rationale**: FR-004 e FR-007 sem órfãos no banco. Se a remoção do blob falhar depois do
  commit, sobra um objeto sem linha que ninguém consegue endereçar; o erro é logado.
  `// ponytail:` sem varredura de órfãos; criar uma se aparecerem.
- **Alternatives considered**: apagar os blobs antes do banco, rejeitado porque deixaria linhas
  apontando para arquivos que não existem se o `delete` falhasse.

## R7. Log de auditoria

- **Decision**: tabela `audit_log (user_id, action, entity_type, entity_id, metadata jsonb,
  created_at)`, sem FK para a entidade, para sobreviver à exclusão. Os controllers gravam depois
  de cada mutação (FR-017). Sem tela nesta fase.
- **Rationale**: o princípio III exige auditoria das ações relevantes; uma tabela só, genérica,
  serve às fases seguintes (referências, geração, feedback).
- **Alternatives considered**: log em `console`, rejeitado porque não é consultável nem durável.

## R8. Nome de marca único por empresa

- **Decision**: `unique (organization_id, lower(name))` como índice; a violação (`23505`) vira
  `DomainError("brand_conflict", …, 409)`.
- **Rationale**: FR-006 e cenário 2.3; a regra fica no banco e vale também sob concorrência.

## R9. Textos não confiáveis

- **Decision**: os textos são guardados como foram digitados (só `trim` e limites). Delimitar como
  dado nos prompts é responsabilidade das fases que vão ler o kit; nenhum prompt lê o brand kit
  nesta fase.
- **Rationale**: FR-015 e princípio V; sanitizar agora mudaria o que o usuário escreveu sem
  proteger nada.

## R10. Rate limiting e ferramentas do agente

- **Decision**: nenhum dos dois nesta fase.
- **Rationale**: o princípio III pede rate limiting nas rotas caras, e nenhuma rota aqui chama IA
  ou gasta dinheiro (o PUT pré-assinado tem tamanho limitado pelo próprio Blob). O princípio I
  exige controllers que o agente possa chamar, o que esta fase cumpre; expor ferramentas ao chat
  fica para quando o agente usar o brand kit (premissa da spec).

## R11. Telas

- **Decision**: `/empresas` (lista com contagem de marcas, criar), `/empresas/[slug]` (renomear,
  excluir com diálogo mostrando quantas marcas, lista e criação de marcas) e
  `/empresas/[slug]/marcas/[brandId]` (dados da marca + brand kit + arquivos). Item "Empresas" no
  menu de `src/app/(app)/layout.tsx`. As páginas leem pelos controllers dentro de `<Suspense>`;
  as mutações usam as rotas de API (padrão de `/skills`).
- **Rationale**: Páginas 2 e 3 do briefing, no mesmo padrão das telas existentes.
