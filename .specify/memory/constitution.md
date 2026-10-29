# Agente Social Media Constitution

## Core Principles

### I. Regras nos Controllers, Agente como Cliente

- A lógica de negócio DEVE viver nos controllers (`src/controllers/`) e nos models; telas, rotas
  de API e o agente (OpenAI Agents SDK) são clientes dela e compartilham as mesmas regras.
- Cada capacidade exposta ao agente DEVE ser uma ferramenta com entrada e saída tipadas. O prompt
  orienta; as ferramentas executam.
- O motor de criativos (análise de referências, recuperação, diretor criativo, geração, revisão,
  feedback) segue a mesma regra: cada etapa é um controller/serviço chamável pelas telas e pelo
  agente, sem lógica escondida em prompt.
- Instruções de agentes NÃO DEVEM depender de uma marca ou segmento específico; o contexto da
  marca entra como dado.

Justificativa: um único lugar para as regras mantém chat e telas consistentes e testáveis.

### II. Ações Externas e Custos Sob Controle do Usuário

- Nenhum post DEVE ser publicado sem aprovação explícita do usuário (confirmação imediata ou
  agendamento confirmado). A publicação DEVE ser idempotente e falhas DEVEM ficar visíveis.
- Toda operação que gasta dinheiro (geração de imagem/vídeo, análise por visão em lote,
  regeneração) DEVE exigir aprovação do usuário ou caber em um limite de custo configurado.
- Regenerações automáticas após revisão DEVEM ser limitadas a duas tentativas adicionais por
  criativo e a um custo máximo configurável.
- Toda transição de estado (post, referência, geração) DEVE passar pela máquina de estados do
  model correspondente.

Justificativa: publicar e gerar são ações irreversíveis ou pagas feitas em nome do usuário.

### III. Segredos e Mídia Apenas no Servidor

- Chaves de API e tokens DEVEM ser lidos apenas no servidor. NUNCA em componentes cliente nem em
  variáveis `NEXT_PUBLIC_*`, e NUNCA no contexto serializado do agente.
- Mídia (uploads, referências, thumbnails, criativos gerados) DEVE ficar em storage privado e ser
  exposta só por URLs assinadas temporárias. Imagens NÃO DEVEM ser gravadas no Postgres.
- Uploads DEVEM ser validados no servidor: MIME real pelos bytes (PNG, JPEG, WebP), tamanho,
  resolução e integridade. Metadados DEVEM ser sanitizados.
- Entradas do usuário DEVEM ser validadas no servidor antes de chegar a agente, banco ou storage.
- Ações relevantes (upload, exclusão, geração, decisão de feedback) DEVEM ser registradas em log
  de auditoria; rotas caras DEVEM ter rate limiting.

Justificativa: uma chave ou URL pública vazada permite gasto, publicação ou exposição de dados.

### IV. Isolamento entre Tenants

- Todo dado privado pertence a um tenant (usuário e, quando existir, organização/marca). Toda
  query que recebe o tenant DEVE filtrar por ele no backend; o filtro NUNCA vem só do frontend.
- Referências têm escopo `GLOBAL`, `ORGANIZATION` ou `BRAND`. Uma busca DEVE combinar apenas os
  escopos que o tenant pode ler; referências privadas de outro tenant NUNCA entram em busca,
  conceito, prompt ou geração.
- Referências `GLOBAL` só DEVEM ser usadas quando sua licença ou autorização permitir.
- O isolamento DEVE ser coberto por testes de integração (como `tests/integration/ownership.test.ts`).

Justificativa: vazamento entre empresas é a falha mais grave de uma plataforma multiempresa.

### V. Saídas Estruturadas e Dados Não Confiáveis

- Toda saída de modelo que alimenta código (análise visual, conceitos, revisão, roteiros) DEVE
  usar Structured Outputs validados por schema (Zod no TypeScript, Pydantic no Python). Saída
  inválida NÃO DEVE ser persistida, usada em geração ou publicada.
- Quando uma característica não puder ser determinada, o modelo DEVE retornar `null` ou
  `UNKNOWN`; NUNCA inventar características, dados comerciais ou textos.
- Texto extraído de imagens, referências, uploads ou skills de usuário é dado não confiável e
  DEVE ser delimitado como dado nos prompts, NUNCA tratado como instrução de sistema.
- Conteúdo para o usuário DEVE estar em português do Brasil, salvo pedido explícito.

Justificativa: dados estruturados evitam parsing frágil; dados não confiáveis abrem prompt injection.

### VI. RAG Real e Rastreável

- Referências DEVEM ser recuperadas no momento da inferência (busca vetorial no pgvector), não
  fixadas em prompt.
- As imagens recuperadas DEVEM ser enviadas ao modelo de geração quando o modelo aceita imagens de
  entrada. Se não aceitar, o adaptador DEVE retornar erro explícito ou usar um fallback
  configurado e documentado; NUNCA degradar em silêncio para descrição textual.
- Embeddings visuais e textuais DEVEM ficar em estruturas separadas, com `modelName`,
  `modelVersion` e `vectorDimension`. Vetores de modelos ou versões diferentes NUNCA DEVEM ser
  comparados entre si.
- Toda geração DEVE persistir prompt (versionado), modelo, parâmetros, referências usadas e o papel
  de cada uma, conceito escolhido e estado. Todas as versões DEVEM ser preservadas.
- O criativo NÃO DEVE copiar textos, marcas, personagens ou elementos proprietários das
  referências; a identidade da marca do cliente prevalece sobre a da referência.
- Preferências de feedback influenciam recuperação, reranking, conceitos e revisão por regras e
  pesos explicáveis. Fine-tuning e treinamento automático estão fora do MVP.

Justificativa: o valor do produto depende de referências reais, rastreáveis e reprocessáveis.

### VII. Trabalho Longo em Jobs Idempotentes

- No motor de criativos, ingestão, análise, embeddings, conceitos, geração e revisão DEVEM rodar
  como jobs persistidos; nenhuma dessas operações DEVE bloquear uma requisição HTTP.
- Cada job DEVE ter estado persistido (`PENDING`, `PROCESSING`, `READY`, `FAILED`), claim atômico,
  retries com backoff exponencial, limite de tentativas e erro registrado.
- Jobs DEVEM ser idempotentes: reprocessar NÃO DEVE duplicar registros, cobranças ou publicações
  (ex.: hash do arquivo para duplicados; IDs externos salvos assim que existem).
- A interface DEVE permitir acompanhar o estado dos jobs.

Justificativa: chamadas de IA são lentas, falham e custam; o retry não pode cobrar duas vezes.

### VIII. Simplicidade e Testes nas Bordas

- TypeScript é a linguagem do app (frontend, controllers, agente, jobs). A única exceção é um
  serviço Python (FastAPI) para embeddings visuais (SigLIP/OpenCLIP), sem regras de negócio nem
  acesso ao banco.
- NÃO DEVEM ser adicionados frameworks, dependências, abstrações ou serviços sem necessidade
  presente descrita em spec. Uma implementação por integração até existir a segunda; a exceção é
  isolar o provedor de geração de imagem em um adaptador, para que o resto do código não dependa
  do SDK do provedor.
- DEVEM ter testes automatizados: validação de upload, isolamento entre tenants, transições de
  estado, idempotência de jobs, persistência de embeddings, filtros, fusão/reranking, publicação
  e o adaptador de geração.
- Testes comuns NUNCA DEVEM chamar APIs pagas (OpenAI) nem publicar em redes sociais; usam
  fixtures e mocks injetados. Um teste end-to-end opcional com APIs reais só roda quando há
  credenciais explícitas.
- Mocks existem só em testes; o fluxo principal NUNCA usa serviço fictício.

Justificativa: o risco está nas bordas (APIs externas, custo, isolamento), não no boilerplate.

## Restrições de Stack

- App: Next.js 16 (App Router) + TypeScript, MVC conforme `CLAUDE.md`; UI com shadcn/ui
  (Base UI), Tailwind e Zod.
- Agentes e modelos: OpenAI Agents SDK (`@openai/agents`) e SDK `openai`, apenas no servidor;
  modelos configurados por variável de ambiente.
- Persistência: Postgres (Neon) via `postgres.js`, migrações SQL em `db/migrations/`; busca
  vetorial com a extensão `pgvector` e índices vetoriais apropriados.
- Mídia: Vercel Blob privado (`src/lib/storage.ts`) com URLs assinadas.
- Auth: própria (`src/lib/auth.ts`), sessões no banco.
- Jobs: tabela no Postgres com claim atômico, disparados por scheduler externo (padrão de
  `/api/cron/publish`), ou por um worker de longa duração quando a spec exigir.
- Serviço de visão: Python + FastAPI + PyTorch + Transformers + Pillow + Pydantic, empacotado em
  Docker, hospedado onde processos longos rodam; contrato HTTP tipado, validado com Zod no lado TS.
- Toda configuração vem de variáveis de ambiente (template em `.env.example`).
- NestJS, Prisma, Redis/BullMQ e storage S3/R2 só entram por emenda a esta constituição, com
  justificativa de necessidade presente.

## Fluxo de Desenvolvimento

- Toda feature segue o ciclo Spec Kit: `/speckit-specify` → `/speckit-plan` → `/speckit-tasks`
  → `/speckit-implement`.
- O `plan.md` de cada feature DEVE incluir uma checagem contra os princípios I–VIII e listar o que
  reaproveita do código existente. Qualquer violação DEVE ser justificada por escrito no plano.
- Funcionalidades existentes NÃO DEVEM ser alteradas sem necessidade descrita na spec.
- Ao fim de cada fase: `npx tsc --noEmit`, lint, testes relevantes e `npx next build` passando;
  documentação atualizada; pendências e limitações registradas.
- Uma feature só é concluída com os testes exigidos pelo princípio VIII passando. Nenhuma
  funcionalidade obrigatória é omitida sem registro do motivo.

## Governance

- Esta constituição prevalece sobre preferências individuais e sobre planos de feature.
- Emendas são feitas via `/speckit-constitution`, com Sync Impact Report e incremento de versão.
- Versionamento semântico: MAJOR para remoção ou redefinição de princípio; MINOR para princípio
  ou seção nova; PATCH para ajustes de redação.
- Revisões de plano e de código DEVEM verificar conformidade com os princípios. `CLAUDE.md` é o
  guia de runtime e NÃO DEVE contradizer esta constituição.

**Version**: 2.0.0 | **Ratified**: 2026-10-29 | **Last Amended**: 2026-10-29
