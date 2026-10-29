<!--
Sync Impact Report
- Version change: (template, unversioned) → 1.0.0
- Modified principles: all 5 placeholders replaced
  - [PRINCIPLE_1_NAME] → I. Agente como Núcleo (OpenAI Agents SDK)
  - [PRINCIPLE_2_NAME] → II. Publicação Sob Controle do Usuário
  - [PRINCIPLE_3_NAME] → III. Segredos Apenas no Servidor
  - [PRINCIPLE_4_NAME] → IV. Saídas Estruturadas e Validadas
  - [PRINCIPLE_5_NAME] → V. Simplicidade e Testes nas Bordas
- Added sections: Restrições de Stack; Fluxo de Desenvolvimento; Governança
- Removed sections: none
- Follow-up TODOs: none (social networks to support are a spec decision, not governance)
-->

# Agente Social Media Constitution

## Core Principles

### I. Agente como Núcleo (OpenAI Agents SDK)

- O agente DEVE ser construído com o OpenAI Agents SDK.
- Cada capacidade do PRD (agendar posts, publicar posts, criar roteiros de criativo) DEVE ser
  exposta ao agente como uma ferramenta (tool) com entrada e saída tipadas.
- A lógica de negócio DEVE viver nas funções das ferramentas, não no prompt. O prompt orienta;
  as ferramentas executam.

Justificativa: ferramentas tipadas são testáveis isoladamente e mantêm o comportamento do agente
previsível.

### II. Publicação Sob Controle do Usuário

- Nenhum post DEVE ser publicado sem aprovação explícita do usuário, seja por confirmação
  imediata, seja por um agendamento que o próprio usuário confirmou.
- Todo post DEVE ser persistido com um estado (`rascunho`, `agendado`, `publicado`, `falhou`)
  antes de qualquer chamada à rede social.
- A publicação DEVE ser idempotente: reprocessar o mesmo post agendado NÃO DEVE gerar publicação
  duplicada.
- Falhas de publicação DEVEM ficar registradas no post e visíveis ao usuário.

Justificativa: publicar é uma ação externa e irreversível em nome do usuário.

### III. Segredos Apenas no Servidor

- `OPENAI_API_KEY` e tokens de redes sociais DEVEM ser lidos apenas no servidor (Route Handlers,
  Server Actions ou jobs). NUNCA em componentes cliente nem em variáveis `NEXT_PUBLIC_*`.
- O frontend DEVE falar com o agente somente via endpoints do próprio servidor Next.js.
- Entradas do usuário DEVEM ser validadas no servidor antes de chegar ao agente ou ao banco.

Justificativa: uma chave vazada permite gasto e publicação não autorizados.

### IV. Saídas Estruturadas e Validadas

- Roteiros de criativo DEVEM ser gerados a partir do segmento informado pelo usuário e retornar
  em formato estruturado validado por schema (Zod), não como texto livre.
- O conteúdo gerado para o usuário DEVE estar em português do Brasil, salvo pedido explícito
  em contrário.
- Uma saída que falhar na validação NÃO DEVE ser persistida nem publicada.

Justificativa: dados estruturados alimentam a UI e o agendamento sem parsing frágil.

### V. Simplicidade e Testes nas Bordas

- Uma única linguagem (TypeScript) para frontend, agente e jobs.
- NÃO DEVEM ser adicionadas dependências, abstrações ou serviços sem uma necessidade presente
  descrita em spec. Uma implementação por integração até que exista uma segunda.
- Lógica de agendamento, transições de estado do post e adaptadores de rede social DEVEM ter
  testes automatizados.
- Testes NUNCA DEVEM publicar em redes sociais reais nem depender da API da OpenAI; usam mocks.

Justificativa: o risco está nas bordas (publicação, horários, APIs externas), não no boilerplate.

## Restrições de Stack

- Frontend e servidor: Next.js (App Router) + TypeScript.
- Agente: OpenAI Agents SDK para TypeScript (`@openai/agents`), executado apenas no servidor.
- UI: shadcn/ui.
- Persistência: Supabase (Postgres) para posts, agendamentos e roteiros.
- As redes sociais suportadas e o mecanismo de disparo de agendamentos DEVEM ser definidos na
  spec da feature, antes da implementação.

## Fluxo de Desenvolvimento

- Toda feature segue o ciclo Spec Kit: `/speckit-specify` → `/speckit-plan` → `/speckit-tasks`
  → `/speckit-implement`.
- O `plan.md` de cada feature DEVE incluir uma checagem contra os princípios I–V. Qualquer
  violação DEVE ser justificada por escrito no plano.
- Uma feature só é considerada concluída com os testes exigidos pelo princípio V passando.

## Governance

- Esta constituição prevalece sobre preferências individuais e sobre planos de feature.
- Emendas são feitas via `/speckit-constitution`, com Sync Impact Report e incremento de versão.
- Versionamento semântico: MAJOR para remoção ou redefinição de princípio; MINOR para princípio
  ou seção nova; PATCH para ajustes de redação.
- Revisões de plano e de código DEVEM verificar conformidade com os princípios.

**Version**: 1.0.0 | **Ratified**: 2026-10-29 | **Last Amended**: 2026-10-29
