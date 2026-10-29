# Quickstart: validar Empresas, Marcas e Brand Kit

## Pré-requisitos

- `.env.local` com `DATABASE_URL` e `BLOB_READ_WRITE_TOKEN` (template em `.env.example`).
- Migração aplicada: `npm run db:migrate` (inclui `0005_orgs_brands.sql`).
- Para os testes de integração: `TEST_DATABASE_URL` apontando para um banco descartável com as
  migrações aplicadas (ver `CLAUDE.md`), nunca produção.
- Arquivos de teste: um PNG de logo (≥ 64 px), um `.txt` renomeado para `.png` e um PNG de 32×32.

## Verificações automáticas

```bash
npx tsc --noEmit
npx eslint src tests
npm test                      # unitários; integração roda se TEST_DATABASE_URL existir
npx next build
```

Esperado: tudo verde, incluindo os testes já existentes (SC-006). Os testes cobrem
[contracts/http-api.md](contracts/http-api.md) e as regras de [data-model.md](data-model.md):

- slug: acentos e símbolos, colisão, nome que vira slug vazio;
- validação do brand kit: hex inválido, mais de 10 cores, mais de 5 fontes, item com mais de 500
  caracteres;
- validação de arquivo: PNG real aceito; texto com extensão `.png`, imagem corrompida, 32×32 e
  formato diferente do declarado recusados, e o objeto apagado;
- isolamento (integração): outro usuário recebe 404 em empresa, marca e arquivo, e listas vazias;
- cascata (integração): excluir a empresa remove marcas e arquivos e devolve os caminhos dos blobs.

## Roteiro manual (`npm run dev`)

1. **US1**: entre como usuário A, abra **Empresas**, veja o estado vazio, crie "Ação & Cia" →
   aparece com slug `acao-cia`. Crie outra "Ação & Cia" → slug diferente.
2. Copie a URL `/empresas/acao-cia`, entre como usuário B e abra → 404. A lista de B está vazia.
3. **US2**: como A, crie as marcas "Sorriso Kids" e "Sorriso Estética"; tente criar
   "sorriso kids" → recusado com mensagem. Edite o público-alvo e recarregue → salvo.
4. **US3**: na marca, envie o logo PNG → aparece. Envie o `.txt` renomeado e o PNG 32×32 →
   recusados com o motivo. Cadastre 3 cores, 2 fontes, 1 diretriz, 1 elemento proibido;
   tente a cor `azulzinho` → recusada. Recarregue → tudo salvo (SC-001: menos de 5 min).
5. Copie o link do logo (abrir imagem em nova aba), substitua o logo e abra o link antigo → não
   carrega (SC-004).
6. Exclua a empresa → o diálogo mostra "2 marcas"; confirme → some da lista, e o link do logo novo
   para de funcionar.
7. Confira que Chat, Roteiros, Posts, Contas e Skills continuam abrindo e funcionando (FR-019).
