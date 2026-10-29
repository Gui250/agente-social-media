# Feature Specification: Organizações, Marcas e Brand Kit

**Feature Branch**: `002-orgs-brands`

**Created**: 2026-10-29

**Status**: Draft

**Input**: User description: "002-orgs-brands: organizações, marcas e brand kit"

## Clarifications

### Session 2026-10-29

- Q: Quem acessa uma empresa? → A: Só quem a criou (opção A, recomendada). O usuário avançou para
  `/speckit-plan` sem responder; o padrão recomendado foi adotado e pode ser revisto com
  `/speckit-clarify`.

## User Scenarios & Testing *(mandatory)*

Primeira fase do Creative Intelligence Engine. O usuário (social media, agência ou dono de
negócio) cadastra as empresas que atende, as marcas de cada empresa e a identidade visual de cada
marca (brand kit). Esses dados são a base para as fases seguintes (biblioteca de referências,
direção criativa e geração), que vão ler o brand kit como contexto da marca.

### User Story 1 - Cadastrar empresas (Priority: P1)

O usuário cria uma empresa informando o nome, vê a lista das empresas a que tem acesso, renomeia
e exclui empresas. Cada empresa é um ambiente de trabalho isolado: nada do que pertence a ela
aparece para quem não tem acesso.

**Why this priority**: Sem empresa não existe marca nem brand kit; é a fundação do isolamento
multiempresa exigido pela constituição.

**Independent Test**: Criar duas empresas com um usuário, ver as duas na lista; entrar com outro
usuário e confirmar que nenhuma delas aparece nem pode ser aberta pelo endereço direto.

**Acceptance Scenarios**:

1. **Given** um usuário autenticado, **When** ele cria uma empresa com o nome "Clínica Sorriso",
   **Then** a empresa aparece na sua lista com um identificador legível (slug) gerado do nome.
2. **Given** já existe uma empresa com o mesmo nome no sistema, **When** outro usuário cria
   "Clínica Sorriso", **Then** a empresa é criada com um identificador legível diferente.
3. **Given** uma empresa do usuário A, **When** o usuário B tenta abrir, editar ou excluir essa
   empresa (inclusive pelo endereço direto), **Then** o sistema responde como se ela não existisse.
4. **Given** uma empresa com marcas, **When** o usuário pede para excluí-la, **Then** o sistema
   mostra quantas marcas serão excluídas junto e só exclui após confirmação explícita.
5. **Given** um nome vazio ou só com espaços, **When** o usuário tenta criar a empresa, **Then** o
   sistema recusa e explica o motivo.

---

### User Story 2 - Cadastrar marcas de uma empresa (Priority: P2)

Dentro de uma empresa, o usuário cria uma ou mais marcas com nome, descrição, segmento, público-alvo
e tom de voz; vê a lista de marcas da empresa, edita e exclui.

**Why this priority**: A marca é a unidade que as próximas fases usam (referências e criativos são
por marca). Depende de existir uma empresa (US1).

**Independent Test**: Em uma empresa existente, criar as marcas "Sorriso Kids" e "Sorriso
Estética", editar o público-alvo de uma delas e ver as duas na lista da empresa.

**Acceptance Scenarios**:

1. **Given** uma empresa do usuário, **When** ele cria uma marca só com o nome, **Then** a marca é
   criada e os demais campos ficam vazios para preencher depois.
2. **Given** uma marca existente, **When** o usuário altera segmento, público-alvo ou tom de voz,
   **Then** a alteração aparece ao reabrir a marca e a data de atualização muda.
3. **Given** a empresa X já tem a marca "Sorriso Kids", **When** o usuário cria outra marca com o
   mesmo nome na mesma empresa, **Then** o sistema recusa e explica o motivo.
4. **Given** uma marca de uma empresa a que o usuário não tem acesso, **When** ele tenta lê-la ou
   alterá-la, **Then** o sistema responde como se ela não existisse.

---

### User Story 3 - Configurar o brand kit (Priority: P3)

Na tela de brand kit de uma marca, o usuário envia o logotipo (e versões alternativas), define a
paleta de cores, as fontes, as diretrizes visuais e os elementos proibidos. O sistema mostra uma
prévia do kit como as próximas fases vão usá-lo.

**Why this priority**: Completa a identidade da marca, mas a marca já é útil sem ele; o brand kit
só passa a gerar valor quando as fases de geração existirem.

**Independent Test**: Em uma marca existente, enviar um logo PNG, cadastrar três cores com papel
(primária, secundária, destaque), duas fontes (título e texto), uma diretriz e um elemento
proibido; reabrir a tela e ver tudo salvo, com o logo exibido.

**Acceptance Scenarios**:

1. **Given** uma marca, **When** o usuário envia um logo PNG, JPEG ou WebP válido, **Then** o logo
   aparece no brand kit e fica guardado de forma privada, visível só para quem acessa a marca.
2. **Given** um arquivo com extensão de imagem mas conteúdo de outro tipo, corrompido ou acima do
   limite de tamanho, **When** o usuário tenta enviá-lo, **Then** o sistema recusa e explica o motivo.
3. **Given** uma marca, **When** o usuário cadastra uma cor em formato inválido (ex.: "azulzinho"),
   **Then** o sistema recusa a cor e indica o formato aceito.
4. **Given** um brand kit com logo, **When** o usuário substitui o logo, **Then** o novo logo passa
   a ser exibido e o anterior deixa de ser acessível.
5. **Given** uma marca excluída, **When** alguém tenta abrir um link antigo do logo, **Then** o link
   não funciona mais.

---

### Edge Cases

- Usuário sem nenhuma empresa abre a área de empresas: vê um estado vazio com a ação de criar a
  primeira empresa.
- Dois envios do mesmo logo seguidos (clique duplo): resulta em um único logo ativo.
- Exclusão da empresa enquanto outra aba edita uma de suas marcas: a gravação da aba antiga falha
  com mensagem de que a marca não existe mais.
- Nome de empresa só com acentos ou símbolos (ex.: "Ação & Cia"): o identificador legível é gerado
  sem acentos e sem símbolos e continua único.
- Textos longos colados em diretrizes ou elementos proibidos: aceitos até o limite e recusados
  acima dele com mensagem clara.
- Texto das diretrizes contendo frases como "ignore as instruções anteriores": é guardado como está
  e tratado sempre como dado da marca, nunca como instrução para a IA nas fases seguintes.
- Link do logo copiado e aberto depois de expirar: não exibe a imagem; a tela gera um novo link ao
  ser recarregada.

## Requirements *(mandatory)*

### Functional Requirements

**Empresas**

- **FR-001**: Usuários MUST conseguir criar, listar, renomear e excluir empresas.
- **FR-002**: O sistema MUST gerar para cada empresa um identificador legível (slug) a partir do
  nome, sem acentos nem símbolos, único em todo o sistema.
- **FR-003**: Cada empresa MUST pertencer apenas ao usuário que a criou; um usuário pode ter
  várias empresas (modelo de agência). Convites, equipes e papéis ficam fora desta fase.
- **FR-004**: Excluir uma empresa MUST excluir suas marcas, brand kits e arquivos de marca, e MUST
  exigir confirmação explícita mostrando quantas marcas serão excluídas.

**Marcas**

- **FR-005**: Usuários MUST conseguir criar, listar, editar e excluir marcas dentro de uma empresa
  a que têm acesso; uma empresa pode ter uma ou mais marcas.
- **FR-006**: Cada marca MUST ter nome obrigatório, único dentro da empresa, e os campos opcionais
  descrição, segmento, público-alvo e tom de voz.
- **FR-007**: Excluir uma marca MUST exigir confirmação e MUST excluir seu brand kit e arquivos.

**Brand kit**

- **FR-008**: Usuários MUST conseguir enviar o logotipo principal e até 5 arquivos de marca
  adicionais (ex.: logo alternativo, versão monocromática), cada um com seu tipo.
- **FR-009**: O sistema MUST aceitar apenas PNG, JPEG e WebP para arquivos de marca, verificando o
  tipo real pelo conteúdo do arquivo, a integridade, o tamanho máximo de 10 MB e as dimensões
  entre 64 e 8000 pixels por lado.
- **FR-010**: Arquivos de marca MUST ficar em armazenamento privado e MUST ser exibidos apenas por
  links temporários; nenhum link permanente público pode existir.
- **FR-011**: Substituir ou excluir um arquivo de marca MUST tornar o arquivo anterior inacessível.
- **FR-012**: Usuários MUST conseguir definir uma paleta de 1 a 10 cores, cada uma em hexadecimal
  (ex.: `#1A2B3C`) com papel (primária, secundária, destaque, fundo, texto ou outra).
- **FR-013**: Usuários MUST conseguir definir até 5 fontes pelo nome, cada uma com uso (título,
  subtítulo, texto ou outro).
- **FR-014**: Usuários MUST conseguir registrar diretrizes visuais e elementos proibidos como
  listas de itens de texto (até 30 itens de até 500 caracteres cada).
- **FR-015**: O sistema MUST guardar textos do brand kit como dados não confiáveis: as fases
  seguintes os recebem delimitados como dados da marca, nunca como instruções.

**Segurança e regras gerais**

- **FR-016**: Toda leitura e alteração de empresa, marca e brand kit MUST ser autorizada no
  servidor pelo acesso do usuário à empresa; recursos de empresas sem acesso MUST ser tratados
  como inexistentes (sem revelar que existem).
- **FR-017**: O sistema MUST registrar em log de auditoria a criação, alteração e exclusão de
  empresas e marcas e o envio, substituição e exclusão de arquivos de marca, com autor e data.
- **FR-018**: Todo texto e mensagem exibidos ao usuário MUST estar em português do Brasil.
- **FR-019**: Funcionalidades existentes (chat, roteiros, posts, contas, skills) MUST continuar
  funcionando sem alteração.

### Key Entities *(include if feature involves data)*

- **Empresa (Organization)**: ambiente de trabalho isolado. Nome, identificador legível único,
  datas de criação e atualização. Tem uma ou mais marcas e pertence a um único usuário.
- **Marca (Brand)**: pertence a uma empresa. Nome, descrição, segmento, público-alvo, tom de voz,
  paleta de cores, fontes, diretrizes visuais, elementos proibidos, logo principal, datas.
- **Arquivo de marca (BrandAsset)**: arquivo de imagem de uma marca. Tipo (logo, logo alternativo,
  outro), referência ao arquivo no armazenamento privado, tipo de conteúdo, dimensões, data.
- **Registro de auditoria**: quem fez qual ação sobre qual empresa, marca ou arquivo, e quando.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um usuário novo cria uma empresa, uma marca e um brand kit completo (logo, 3 cores,
  2 fontes, 1 diretriz) em menos de 5 minutos.
- **SC-002**: 100% das tentativas de ler ou alterar empresas, marcas ou arquivos de outra empresa
  sem acesso são recusadas, verificado por testes automatizados.
- **SC-003**: 100% dos arquivos com tipo real fora de PNG/JPEG/WebP, corrompidos ou acima do
  limite são recusados com mensagem que explica o motivo.
- **SC-004**: Um link de logo deixa de funcionar em até 1 hora após ser gerado e imediatamente após
  a exclusão ou substituição do arquivo.
- **SC-005**: A lista de empresas e a tela de brand kit abrem em menos de 2 segundos para um usuário
  com até 50 empresas e 20 marcas por empresa.
- **SC-006**: Nenhum teste existente deixa de passar após a entrega da feature.

## Assumptions

- O login e as sessões atuais são reaproveitados; não há novo método de autenticação.
- Chat, roteiros, posts e contas do Instagram continuam ligados ao usuário, não à empresa; ligar
  essas áreas a uma marca fica para uma feature futura.
- O chat do agente não lê o brand kit nesta fase; o consumo do brand kit começa nas fases de
  direção criativa e geração.
- Fontes são registradas só pelo nome; envio de arquivos de fonte fica fora desta fase.
- SVG não é aceito para logos nesta fase (risco de conteúdo ativo); PNG, JPEG e WebP cobrem o uso.
- Extrair cores automaticamente do logo (a extração de identidade visual que já existe no chat) é
  uma melhoria futura, fora do escopo.
- Referências, criativos, painel (dashboard) e a biblioteca GLOBAL pertencem às fases seguintes.
- Links temporários de arquivos valem por até 1 hora.
