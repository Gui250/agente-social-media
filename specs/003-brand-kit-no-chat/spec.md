# Feature Specification: Brand Kit no Chat com @

**Feature Branch**: `003-brand-kit-no-chat`

**Created**: 2026-10-29

**Status**: Draft

**Input**: User description: "003-brand-kit-no-chat: referenciar brand kit no chat com @"

## User Scenarios & Testing *(mandatory)*

Hoje o brand kit cadastrado em Empresas (feature 002) não chega ao chat: para o agente usar cores
e logo, o usuário precisa anexar o logo em cada conversa. Esta feature deixa o usuário mencionar
uma marca no chat digitando `@`, como já faz com `/` para skills, e o agente passa a criar roteiros
e artes com a identidade dessa marca.

### User Story 1 - Mencionar uma marca e receber um roteiro com a identidade dela (Priority: P1)

O usuário digita `@` no chat, vê a lista das suas marcas (com a empresa de cada uma), escolhe
"Sorriso Kids" e pede "um carrossel sobre prevenção de cáries". O agente gera o roteiro usando o
que está no brand kit: segmento, público-alvo, tom de voz, cores, fontes, diretrizes visuais e
elementos proibidos, sem perguntar o que já está cadastrado.

**Why this priority**: É o valor central: o cadastro da marca passa a valer na criação, sem o
usuário repetir informações. Funciona mesmo sem geração de arte.

**Independent Test**: Com uma marca cadastrada (segmento "odontopediatria", tom "leve e
divertido", elemento proibido "imagens de dentes cariados"), mencionar `@` a marca e pedir um
roteiro de carrossel; o roteiro sai no segmento e tom cadastrados, cita as cores da marca nas
descrições visuais e não usa o elemento proibido, sem o agente perguntar o segmento.

**Acceptance Scenarios**:

1. **Given** um usuário com marcas cadastradas, **When** ele digita `@` no campo de mensagem,
   **Then** aparece um menu com as marcas dele (nome da marca e da empresa), filtrado pelo que
   ele digitar depois do `@`, navegável por teclado, como o menu de skills.
2. **Given** o menu aberto, **When** o usuário escolhe uma marca, **Then** a menção é inserida no
   texto de forma que identifica uma única marca, mesmo que outra empresa tenha marca com o mesmo
   nome.
3. **Given** uma mensagem com a menção de uma marca que tem segmento cadastrado, **When** o usuário
   pede um roteiro informando só o tema e o formato, **Then** o agente gera o roteiro sem perguntar
   o segmento, usando público-alvo, tom de voz, cores, fontes e diretrizes do kit.
4. **Given** uma marca com elementos proibidos, **When** o agente gera um roteiro para ela,
   **Then** o roteiro não contém nenhum desses elementos.
5. **Given** uma marca mencionada no começo da conversa, **When** o usuário pede outro roteiro
   mais adiante sem mencionar marca de novo, **Then** o agente continua usando a mesma marca até
   outra ser mencionada.
6. **Given** um usuário sem marcas, **When** ele digita `@`, **Then** o menu informa que não há
   marcas e indica onde cadastrar (Empresas).

---

### User Story 2 - Arte com a cor e o logo da marca mencionada (Priority: P2)

Ao pedir um criativo (arte) para a marca mencionada, a imagem gerada usa a cor primária do kit e o
logo cadastrado, sem o usuário anexar nada.

**Why this priority**: Remove o passo de anexar o logo em toda conversa, mas depende da US1 para
saber qual marca está em uso, e só vale para quem gera arte.

**Independent Test**: Com uma marca que tem cor primária e logo cadastrados, mencionar a marca e
pedir "um post estático sobre a promoção de novembro"; após a confirmação de custo, as imagens
saem com a faixa de texto na cor primária e o logo da marca no canto, sem nenhum anexo na conversa.

**Acceptance Scenarios**:

1. **Given** uma marca mencionada com cor primária e logo, **When** o usuário pede uma arte e
   confirma o custo, **Then** cada imagem gerada usa a cor primária e traz o logo cadastrado.
2. **Given** uma marca sem logo cadastrado, **When** o usuário pede uma arte, **Then** a arte é
   gerada sem logo e o agente avisa que a marca não tem logo cadastrado.
3. **Given** uma marca sem cor primária mas com outras cores, **When** a arte é gerada, **Then**
   usa a primeira cor da paleta; sem nenhuma cor, segue o comportamento atual.
4. **Given** uma marca mencionada e um logo anexado na mesma mensagem, **When** o usuário pede a
   arte, **Then** o agente usa o logo anexado naquela arte e diz que fez isso.
5. **Given** o pedido de confirmação de custo da arte, **When** ele aparece, **Then** o resumo
   mostra para qual marca a arte será gerada.

---

### User Story 3 - Perguntar sobre as marcas no chat (Priority: P3)

O usuário pergunta "quais marcas eu tenho?" ou "qual a paleta da Sorriso Kids?" e o agente responde
com os dados cadastrados, mesmo sem usar `@`.

**Why this priority**: Conveniência; o caminho principal (US1) já cobre a criação.

**Independent Test**: Com duas empresas e três marcas, perguntar "quais marcas eu tenho?" e receber
a lista agrupada por empresa; perguntar "quais as cores da Sorriso Kids?" e receber as cores com
hex e papel.

**Acceptance Scenarios**:

1. **Given** marcas cadastradas, **When** o usuário pergunta quais marcas tem, **Then** o agente
   lista as marcas com a empresa de cada uma.
2. **Given** uma marca citada pelo nome sem `@`, **When** existe uma única marca com esse nome,
   **Then** o agente responde com os dados dela; **When** existe mais de uma, **Then** pergunta de
   qual empresa.
3. **Given** um pedido de roteiro que cita uma marca pelo nome sem `@`, **When** o nome corresponde
   a uma marca cadastrada, **Then** o agente pergunta se deve usar o brand kit dessa marca antes de
   gerar.

---

### Edge Cases

- Menção digitada à mão para uma marca que não existe: o agente diz que não encontrou e lista as
  marcas disponíveis.
- Marca excluída depois de mencionada na conversa: no próximo pedido o agente avisa que a marca não
  existe mais e segue sem brand kit, perguntando o segmento se faltar.
- Brand kit editado no meio da conversa: o próximo pedido usa os dados atualizados.
- Duas marcas mencionadas na mesma mensagem: para criar roteiro ou arte, o agente pergunta qual
  usar; para perguntas (comparar paletas), responde sobre as duas.
- Marca com kit vazio (só o nome): o agente usa o que existe e pergunta o que faltar para o pedido,
  como hoje (segmento, formato).
- `@` seguido de um @ do Instagram (ex.: `@loja_x` para escolher a conta onde publicar): continua
  valendo para escolher a conta; menções inseridas pelo menu de marcas não são confundidas com
  contas.
- Texto do brand kit com frases como "ignore as instruções anteriores": tratado só como dado da
  marca; o agente não segue instruções vindas do kit.
- Marca de outro usuário: nunca aparece no menu nem pode ser usada, mesmo que o identificador seja
  digitado à mão.

## Requirements *(mandatory)*

### Functional Requirements

**Menção**

- **FR-001**: O chat MUST abrir um menu de marcas quando o usuário digita `@` no início de uma
  palavra, filtrado pelo texto seguinte, navegável por teclado e mouse, como o menu de skills.
- **FR-002**: O menu MUST listar apenas as marcas do usuário, mostrando nome da marca e da empresa.
- **FR-003**: A menção inserida MUST identificar uma única marca do usuário, sem ambiguidade entre
  marcas de mesmo nome em empresas diferentes, e continuar legível para o usuário na mensagem.
- **FR-004**: A marca mencionada MUST ficar ativa na conversa até outra marca ser mencionada ou o
  usuário pedir para parar de usar a marca.

**Uso do brand kit**

- **FR-005**: Ao criar roteiro para a marca ativa, o agente MUST usar do kit: segmento, público-alvo,
  tom de voz, cores (com papel), fontes (com uso), diretrizes visuais e elementos proibidos, e MUST
  NOT perguntar o que já está no kit.
- **FR-006**: Roteiros e artes da marca ativa MUST NOT conter elementos proibidos do kit.
- **FR-007**: Ao gerar arte para a marca ativa, o sistema MUST usar a cor primária do kit (ou a
  primeira cor da paleta, se não houver primária) e o logo cadastrado, sem exigir anexo.
- **FR-008**: Um logo anexado na própria mensagem MUST prevalecer sobre o logo do kit naquele pedido.
- **FR-009**: O resumo de confirmação de custo da arte MUST mostrar o nome da marca usada.
- **FR-010**: O agente MUST ler o kit no momento de cada pedido, refletindo edições feitas depois da
  menção.

**Consulta**

- **FR-011**: O agente MUST conseguir listar as marcas do usuário e mostrar o kit de uma marca
  quando perguntado, com ou sem `@`.

**Segurança**

- **FR-012**: O agente MUST acessar apenas marcas do usuário da sessão; o usuário dono vem da
  sessão, nunca do texto da mensagem ou do modelo.
- **FR-013**: Textos do brand kit MUST chegar aos modelos delimitados como dados da marca, nunca
  como instruções.
- **FR-014**: O logo do kit MUST ser lido do armazenamento privado sem gerar links públicos
  permanentes.
- **FR-015**: Todo texto exibido ao usuário MUST estar em português do Brasil.
- **FR-016**: Conversas sem menção de marca MUST continuar funcionando como hoje, incluindo extrair
  identidade de um logo anexado.

### Key Entities *(include if feature involves data)*

- **Menção de marca**: referência a uma marca do usuário dentro de uma mensagem; identifica a
  marca de forma única e é exibida com o nome legível.
- **Marca ativa da conversa**: a última marca mencionada numa conversa; define qual kit vale para
  os próximos pedidos dessa conversa.
- **Brand kit** (existente, feature 002): dados da marca e logo usados como contexto na criação.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: O usuário obtém um roteiro com a identidade da marca em uma única mensagem
  (menção + tema + formato), sem o agente perguntar dados que já estão no kit, em 9 de 10 pedidos
  de teste.
- **SC-002**: Em 10 pedidos de teste para marcas com elementos proibidos, nenhum roteiro contém um
  elemento proibido.
- **SC-003**: O menu de marcas aparece em menos de 1 segundo após digitar `@`.
- **SC-004**: 100% das artes geradas para uma marca com cor e logo trazem a cor primária e o logo
  cadastrados, sem anexo na conversa.
- **SC-005**: 0 casos de marca de outro usuário aparecendo no menu ou sendo usada pelo agente,
  verificado por testes automatizados.
- **SC-006**: Nenhum teste existente deixa de passar e as conversas sem marca se comportam como antes.

## Assumptions

- Vale o modelo de acesso da feature 002: a marca pertence ao dono da empresa.
- As fontes do kit orientam o roteiro e a direção de arte; o texto desenhado sobre a arte continua
  usando as fontes que o app já tem (carregar fontes arbitrárias fica fora do escopo).
- Logo e cor da marca valem para imagens; vídeos seguem sem logo, como hoje.
- A marca ativa vale só dentro da conversa em que foi mencionada; nova conversa começa sem marca.
- Arquivos de marca além do logo (logo alternativo, outros) não são usados nesta fase.
- A dica do chat vazio passa a mencionar `@` para marcas.
