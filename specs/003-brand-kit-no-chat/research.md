# Research: Brand Kit no Chat com @

Nenhum NEEDS CLARIFICATION ficou no Technical Context. Cada decisão reaproveita um padrão do chat
atual (menu `/` de skills, `[mídias anexadas: …]`, ferramentas finas sobre controllers).

## R1. Como a menção identifica a marca

- **Decision**: o menu `@` insere o nome legível no texto (`@Sorriso Kids `) e o painel guarda à
  parte o id das marcas escolhidas, como já faz com as mídias anexadas. No envio, vão em
  `brandIds` só as marcas cujo `@Nome` ainda está no texto. O servidor confere cada id contra as
  marcas do usuário, descarta o que não for dele e acrescenta à mensagem
  `[marca mencionada: <id> — <Marca> (<Empresa>)]`, no mesmo formato de `[mídias anexadas: …]`.
- **Rationale**: o id é inequívoco mesmo com marcas de mesmo nome em empresas diferentes (FR-003),
  o texto continua legível, e não é preciso inventar um "handle" único para marcas, que não têm
  slug. O marcador fica no histórico, então o modelo sabe de qual marca se falou.
- **Alternatives considered**: handle `@empresa/marca` derivado do nome: exige slug de marca,
  colisões após normalizar e migração. Markup no textarea (`@[Marca](id)`): ilegível ao digitar.

## R2. Marca ativa da conversa

- **Decision**: coluna `conversations.brand_id` (`references brands on delete set null`). O
  servidor atualiza quando a mensagem traz exatamente uma marca mencionada; com duas ou mais, não
  muda e o agente pergunta qual usar. O agente também troca ou limpa a marca ativa com a ferramenta
  `set_active_brand` (pedido por nome, sem `@`, ou "pare de usar a marca"). O id vai para o
  `AgentContext` (`brandId`), que continua dado simples e serializável.
- **Rationale**: FR-004 sem depender de o modelo lembrar do histórico, e as ferramentas e
  controllers sabem a marca sem o modelo repassar ids. `on delete set null` cobre a marca excluída.
- **Alternatives considered**: só o histórico, sem coluna: o modelo pode esquecer ou misturar
  marcas, e o resumo de aprovação não teria como saber a marca.

## R3. Como o kit chega ao agente e ao roteirista

- **Decision**:
  1. `instructions()` (já assíncrona e chamada a cada run) carrega a marca ativa e acrescenta um
     bloco "Marca ativa" com o kit em JSON entre delimitadores `<marca>…</marca>`, com o aviso de que
     é dado do cliente e não instrução (FR-013). Lido a cada pedido (FR-010).
  2. `scripts.generate` recebe a marca ativa do contexto e passa o kit ao roteirista num campo novo
     `brand` do `ScriptRequest`, também delimitado; elementos proibidos entram como restrição
     explícita ("nunca use"), com o conteúdo marcado como dado.
  3. `visualPrompt`/`videoPrompt` recebem `forbidden` e acrescentam "Não mostre: …" (FR-006 nas artes).
- **Rationale**: as regras ficam nos controllers (princípio I): o kit chega ao roteirista mesmo que
  o modelo principal esqueça de repassar algo. A injeção nas instruções evita uma chamada de
  ferramenta extra antes de cada roteiro (SC-001: sem perguntas sobre o que está no kit).
- **Alternatives considered**: só uma ferramenta `get_brand_kit` que o modelo chama: uma volta a
  mais por pedido e depende do modelo lembrar de chamar.

## R4. Cor e logo na arte

- **Decision**: `creatives.generate(userId, input, brandId?)`: se há marca ativa, preenche o que o
  modelo não passou: `brandColor` = cor `primary` do kit ou a primeira da paleta; logo = asset `logo`
  da marca lido do Blob privado (`readObject(storage_key)`, sem link, FR-014). Argumentos explícitos
  (`brandColor`, `logoMediaId` de um logo anexado) prevalecem (FR-008). Marca sem logo: segue sem
  logo e o retorno avisa (`semLogo: true`) para o agente dizer ao usuário.
- **Rationale**: reaproveita `withLogo`/`withText` (`src/services/overlay.tsx`), que já aceitam os
  bytes da imagem; o formato PNG/WebP do logo é lido pelo `sharp`.

## R5. Resumo da confirmação de custo

- **Decision**: `summarize()` recebe `brandName` opcional; para `generate_creative_media` com marca
  ativa: "Gerar com IA as mídias do roteiro para a marca <Marca>. …" (FR-009). `approvalsFor` busca
  o nome pela marca ativa do contexto.

## R6. Ferramentas novas

- **Decision**: `list_brands` (marcas do usuário com empresa e se é a ativa), `get_brand_kit`
  (`brandId` nullable → marca ativa) e `set_active_brand` (`brandId` nullable para limpar). Todas
  sem aprovação (só leitura ou estado da conversa) e com `userId` do contexto (FR-012).
- **Rationale**: cobrem a US3 e a troca de marca sem `@`.

## R7. Conflito com `@conta` do Instagram

- **Decision**: o marcador `[marca mencionada: …]` é a única fonte de menção de marca; as instruções
  mantêm a regra atual de `@conta` para escolher conta. O menu de marcas só abre por escolha no
  `@`, e o texto inserido é o nome da marca, que o agente não confunde com o marcador.

## R8. Menu `@` no painel

- **Decision**: mesmo componente e teclado do menu `/` (ArrowUp/Down, Enter/Tab, Escape), com
  regex `(?:^|\s)@([^\s@]*)$` e filtro sem acento e sem diferenciar maiúsculas por nome da marca ou
  da empresa. Opções carregadas no servidor como `skillOptions` (`chat.brandOptions`). A parte pura
  (filtro e "quais ids ainda estão no texto") fica em `src/lib/mentions.ts` para teste unitário.
- **Alternatives considered**: busca na API a cada tecla: desnecessário para dezenas de marcas.
