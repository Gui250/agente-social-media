# Feature Specification: Agente de Social Media

**Feature Branch**: `001-social-media-agent`

**Created**: 2026-10-29

**Status**: Draft

**Input**: User description: "implemente o agente de IA seguindo arquitetura MVC, use as melhores praticas de criação de agentes"

## User Scenarios & Testing *(mandatory)*

O usuário (dono de negócio ou social media) conversa com o agente em uma interface de chat e
também acompanha seus roteiros e posts em telas de listagem.

### User Story 1 - Gerar roteiro de criativo por segmento (Priority: P1)

O usuário informa o segmento do negócio (ex.: "clínica odontológica", "loja de roupas fitness")
e, opcionalmente, objetivo, público e tom. O agente devolve um roteiro de criativo pronto para
produção, que o usuário pode salvar, editar ou pedir uma nova versão.

**Why this priority**: É o valor central do agente e não depende de nenhuma rede social conectada.
Sozinho já é um MVP útil.

**Independent Test**: Informar um segmento no chat e receber um roteiro completo e salvo, sem
nenhuma conta de rede social conectada.

**Acceptance Scenarios**:

1. **Given** um usuário autenticado, **When** ele informa apenas o segmento, **Then** o agente
   devolve um roteiro com todos os campos obrigatórios preenchidos, em português do Brasil.
2. **Given** um roteiro gerado, **When** o usuário pede "deixa mais curto" ou "outro gancho",
   **Then** o agente devolve uma nova versão mantendo o segmento original.
3. **Given** um roteiro gerado, **When** o usuário salva, **Then** ele aparece na lista de roteiros.
4. **Given** um pedido sem segmento (ex.: "faz um roteiro"), **When** enviado, **Then** o agente
   pergunta o segmento antes de gerar.

---

### User Story 2 - Agendar posts (Priority: P2)

O usuário pede ao agente para agendar um post (texto, mídia opcional, rede e data/hora), seja a
partir de um roteiro salvo ou de conteúdo próprio. Antes de agendar, o agente mostra um resumo e
pede confirmação. O usuário vê, edita e cancela agendamentos em um calendário/lista.

**Why this priority**: Organizar o calendário editorial é a segunda dor do usuário, mas depende
de conteúdo existir (US1) para ter o máximo valor.

**Independent Test**: Enviar uma imagem e pedir no chat "agende com esta legenda para amanhã às
10h no Instagram", confirmar, e ver o post com estado "agendado" na lista, sem que nada seja
publicado.

**Acceptance Scenarios**:

1. **Given** um conteúdo e uma data futura, **When** o usuário pede o agendamento, **Then** o
   agente mostra rede, texto e horário e só agenda após confirmação explícita.
2. **Given** uma data no passado, **When** o usuário tenta agendar, **Then** o sistema recusa e
   explica o motivo.
3. **Given** um post agendado, **When** o usuário edita ou cancela antes do horário, **Then** a
   mudança é aplicada e o post cancelado não é publicado.
4. **Given** um pedido com horário relativo ("sexta às 18h"), **When** confirmado, **Then** o
   horário é interpretado no fuso horário do usuário e exibido em data absoluta.

---

### User Story 3 - Publicar posts (Priority: P3)

Posts agendados são publicados automaticamente no horário. O usuário também pode pedir publicação
imediata, sempre com confirmação. O resultado (sucesso ou falha com motivo) fica visível no post.

**Why this priority**: Exige conta de rede social conectada e integração externa; entrega o ciclo
completo mas é a fatia de maior risco.

**Independent Test**: Conectar uma conta de teste, agendar um post para daqui a 2 minutos e
verificar que ele é publicado uma única vez e marcado como "publicado" com link.

**Acceptance Scenarios**:

1. **Given** um post agendado e conta conectada, **When** chega o horário, **Then** ele é
   publicado e marcado como "publicado" com o link do post na rede.
2. **Given** um pedido "publica agora", **When** o usuário confirma, **Then** o post é publicado
   imediatamente; sem confirmação, nada é publicado.
3. **Given** uma falha da rede social (token expirado, conteúdo rejeitado), **When** a publicação
   é tentada, **Then** o post fica "falhou" com o motivo e o usuário pode tentar de novo.
4. **Given** um post já publicado, **When** o disparo é processado novamente, **Then** não há
   publicação duplicada.

---

### Edge Cases

- Usuário pede para publicar em uma rede que não está conectada: o agente avisa e oferece conectar.
- Usuário pede outra rede (Facebook, TikTok, LinkedIn): o agente explica que a v1 só publica no
  Instagram; o roteiro pode ser gerado e usado manualmente.
- Usuário tenta agendar sem mídia: o agendamento é bloqueado e o agente pede a imagem ou vídeo.
- Conteúdo excede o limite de caracteres ou formato da rede escolhida: bloqueado antes de agendar.
- Dois agendamentos no mesmo horário e rede: permitido, cada um publicado uma vez.
- O sistema está indisponível no horário agendado: o post é publicado assim que possível e o
  atraso fica registrado; posts com mais de 24 h de atraso viram "falhou" para revisão manual.
- O agente não consegue gerar um roteiro válido (resposta fora do formato): o usuário recebe uma
  mensagem de erro e nada é salvo.
- Pedidos fora do escopo de social media: o agente recusa educadamente e lembra o que sabe fazer.
- Tentativas de instruir o agente a ignorar a confirmação ("publica sem perguntar"): a
  confirmação continua obrigatória.

## Requirements *(mandatory)*

### Functional Requirements

**Conversa com o agente**

- **FR-001**: Usuários MUST poder conversar com o agente em linguagem natural, em português.
- **FR-002**: O agente MUST manter o contexto da conversa atual (ex.: "agenda esse roteiro"
  refere-se ao último roteiro gerado).
- **FR-003**: O agente MUST responder apenas a pedidos de social media (roteiros, agendamento,
  publicação, consulta de posts) e recusar o resto.
- **FR-004**: O agente MUST pedir a informação que faltar (segmento, rede, horário) em vez de
  inventá-la.

**Roteiros de criativo**

- **FR-005**: Usuários MUST poder gerar um roteiro informando no mínimo o segmento; objetivo,
  público-alvo e tom são opcionais.
- **FR-006**: Cada roteiro MUST conter: título, gancho de abertura, desenvolvimento, texto de
  legenda, chamada para ação e hashtags sugeridas.
- **FR-007**: O roteiro MUST ter um de dois formatos, escolhido pelo usuário (o agente pergunta se
  não for informado): **vídeo curto** (Reels), com desenvolvimento em cenas contendo duração,
  visual e fala/texto na tela; ou **post estático/carrossel**, com desenvolvimento em slides
  contendo o texto de cada slide e a descrição visual.
- **FR-008**: Usuários MUST poder salvar, editar, regenerar e excluir roteiros.

**Agendamento**

- **FR-009**: Usuários MUST poder agendar um post com legenda, mídia (obrigatória: o Instagram
  não aceita posts só de texto), conta de destino e data/hora futura, pelo chat ou pela
  interface.
- **FR-010**: O sistema MUST exigir confirmação explícita do usuário antes de criar um
  agendamento ou uma publicação imediata.
- **FR-011**: O sistema MUST validar o conteúdo contra os limites da rede escolhida antes de
  agendar.
- **FR-012**: Usuários MUST poder listar, editar e cancelar posts agendados enquanto não forem
  publicados.
- **FR-013**: Horários MUST ser armazenados de forma absoluta e exibidos no fuso do usuário.

**Publicação**

- **FR-014**: O sistema MUST publicar posts agendados no horário, com tolerância de até 5 minutos.
- **FR-015**: Na v1, o sistema MUST suportar apenas o Instagram (contas profissionais: Business
  ou Creator), publicando imagem única, carrossel ou Reels. Outras redes ficam para versões
  futuras.
- **FR-016**: Cada post MUST ter um estado visível: rascunho, agendado, publicado, falhou ou
  cancelado.
- **FR-017**: O sistema MUST garantir que um post seja publicado no máximo uma vez.
- **FR-018**: Em caso de falha, o sistema MUST registrar o motivo e permitir nova tentativa manual.
- **FR-019**: Usuários MUST poder conectar e desconectar quantas contas Instagram quiserem, uma
  por vez (login do Instagram) ou todas as contas vinculadas às suas Páginas de uma vez (login do
  Facebook), e escolher em qual conta cada post é publicado.

**Conta e segurança**

- **FR-020**: Usuários MUST se autenticar para usar o sistema e só veem os próprios roteiros,
  posts e contas conectadas.
- **FR-021**: Credenciais de redes sociais MUST nunca ser exibidas ao usuário nem ao navegador.

### Key Entities

- **Usuário**: quem usa o sistema; tem fuso horário e contas conectadas.
- **Conta Conectada**: vínculo entre o usuário e uma rede social; rede, nome do perfil, status
  (ativa/expirada).
- **Roteiro de Criativo**: segmento, objetivo, público, tom, formato e os campos do FR-006;
  pertence a um usuário.
- **Post**: conteúdo, mídia, conta de destino, horário agendado, estado, motivo de falha, link
  publicado; pode ter origem em um roteiro.
- **Conversa**: histórico de mensagens entre usuário e agente, usado para manter contexto.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: O usuário obtém um roteiro completo em menos de 30 segundos após informar o
  segmento.
- **SC-002**: 90% dos roteiros gerados passam na validação de campos obrigatórios na primeira
  tentativa.
- **SC-003**: O usuário agenda um post a partir de um roteiro em menos de 1 minuto.
- **SC-004**: 99% dos posts agendados são publicados em até 5 minutos do horário definido,
  excluindo falhas da própria rede social.
- **SC-005**: Zero publicações sem confirmação do usuário e zero publicações duplicadas.
- **SC-006**: 100% das falhas de publicação ficam visíveis ao usuário com um motivo legível.

## Assumptions

- Público: pequenos negócios e social medias que gerenciam suas próprias contas; uma pessoa por
  conta de usuário (sem equipes ou aprovação em várias etapas na v1).
- O agente gera apenas texto (roteiros e legendas). Geração de imagem/vídeo está fora do escopo;
  a mídia do post é enviada pelo usuário.
- Métricas e analytics de posts publicados estão fora do escopo da v1.
- Interface apenas web, responsiva; app mobile fora do escopo.
- Autenticação por e-mail e senha ou login social padrão.
- Restrições técnicas pedidas pelo usuário e levadas para o `/speckit-plan` (não fazem parte dos
  requisitos de negócio): arquitetura MVC e boas práticas de construção de agentes, conforme a
  constituição do projeto.
