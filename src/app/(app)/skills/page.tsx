import { Suspense } from "react";
import { ImportedSkillList, SkillImport } from "@/components/skills/skill-list";
import { builtinSkills } from "@/agent/skills";
import * as skills from "@/controllers/skills";
import { requireUser } from "@/lib/auth";
import { ListSkeleton } from "@/components/ui/skeleton";

const EXAMPLE = `---
name: promocao-relampago
description: Posts de oferta com prazo curto. Use quando o usuário anunciar uma promoção.
---

- Diga a oferta e o prazo logo na abertura.
- Termine com uma ação direta: "chame no WhatsApp".`;

export default function SkillsPage() {
  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Skills</h1>
      <p className="text-sm text-muted-foreground">
        Skills são diretrizes de criação que o agente aplica nos roteiros. Use no chat digitando / e
        o nome. Importe as suas com um arquivo SKILL.md: ficam só na sua conta, e importar de novo
        com o mesmo name substitui a anterior.
      </p>
      <details className="rounded-lg border p-3 text-sm">
        <summary className="cursor-pointer font-medium">Formato do SKILL.md</summary>
        <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap">{EXAMPLE}</pre>
        <p className="mt-2 text-muted-foreground">
          name: letras minúsculas, números e hífens. description: quando usar a skill (o agente decide
          por ela). Depois do cabeçalho, as diretrizes.
        </p>
      </details>
      <SkillImport />
      <Suspense fallback={<ListSkeleton label="Carregando skills…" />}>
        <Skills />
      </Suspense>
    </div>
  );
}

async function Skills() {
  const user = await requireUser();
  const [mine, builtin] = await Promise.all([skills.list(user.id), builtinSkills()]);
  return (
    <>
      <section className="grid gap-2">
        <h2 className="font-medium">Suas skills</h2>
        <ImportedSkillList skills={mine.map(({ id, name, description }) => ({ id, name, description }))} />
      </section>
      <section className="grid gap-2">
        <h2 className="font-medium">Skills do app</h2>
        <ul className="grid gap-2">
          {builtin.map((s) => (
            <li key={s.name} className="rounded-lg border p-3">
              <p className="font-medium">/{s.name}</p>
              <p className="text-sm text-muted-foreground">{s.description}</p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
