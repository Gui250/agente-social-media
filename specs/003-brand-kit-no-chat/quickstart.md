# Quickstart: validar Brand Kit no Chat com @

## Pré-requisitos

- Feature 002 em produção (empresas e marcas) e migração `0006_conversation_brand.sql` aplicada.
- `.env` com `OPENAI_API_KEY`; `.env.local` com `DATABASE_URL` e `BLOB_READ_WRITE_TOKEN`.
- Uma empresa com duas marcas, uma delas ("Sorriso Kids") com: segmento "odontopediatria", tom
  "leve e divertido", cor primária, logo PNG e elemento proibido "imagens de dentes cariados".
- Integração: `TEST_DATABASE_URL` apontando para um banco descartável com as migrações.

## Verificações automáticas

```bash
npx tsc --noEmit && npx eslint src tests
npm test
npx next build
```

Cobrem ([contracts/chat-and-tools.md](contracts/chat-and-tools.md),
[data-model.md](data-model.md)): filtro do menu e ids ainda presentes no texto; `sendMessage`
descarta marca alheia e define a marca ativa só com uma menção; bloco "Marca ativa" delimitado e
com texto do cliente escapado; roteirista recebe kit e proibidos; `creatives.generate` usa cor e
logo do kit e respeita argumentos explícitos; resumo de aprovação com o nome da marca;
`setConversationBrand` recusa marca de outro usuário (integração); `generate_creative_media`
continua `needsApproval`.

## Roteiro manual (custa chamadas à OpenAI)

1. Chat novo, digite `@sor` → o menu mostra "Sorriso Kids — <empresa>"; Enter insere `@Sorriso Kids`.
2. Envie "@Sorriso Kids um carrossel sobre prevenção de cáries" → roteiro sem perguntas, tom leve,
   cores da marca nas descrições, sem dentes cariados (SC-001/SC-002; repita 10 vezes para medir).
3. Peça "agora a arte" e confira o cartão: "… para a marca Sorriso Kids". Confirme → imagens com a
   faixa na cor primária e o logo no canto, sem anexo (SC-004).
4. Mais adiante, "outro roteiro sobre escovação" sem `@` → continua na Sorriso Kids.
5. "quais marcas eu tenho?" → lista por empresa. "qual a paleta da <outra marca>?" → cores.
6. Exclua a Sorriso Kids em Empresas e peça outro roteiro na mesma conversa → o agente avisa que a
   marca não está mais ativa.
7. Conversa sem `@`, anexando um logo e pedindo a identidade visual → funciona como antes (FR-016).
