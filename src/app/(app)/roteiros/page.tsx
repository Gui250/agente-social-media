import { Suspense } from "react";
import { GenerateForm } from "@/components/scripts/generate-form";
import { ScriptCard } from "@/components/scripts/script-card";
import { ScriptActions } from "@/components/scripts/script-editor";
import * as scripts from "@/controllers/scripts";
import { requireUser } from "@/lib/auth";

export default function RoteirosPage() {
  return (
    <div className="grid gap-4">
      <h1 className="text-lg font-semibold">Roteiros</h1>
      <GenerateForm />
      <Suspense fallback={<p className="text-sm text-muted-foreground">Carregando roteiros…</p>}>
        <ScriptList />
      </Suspense>
    </div>
  );
}

async function ScriptList() {
  const user = await requireUser();
  const rows = await scripts.list(user.id, { limit: 50 });
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhum roteiro ainda. Gere um acima ou peça no Chat.
      </p>
    );
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {rows.map((r) => (
        <ScriptCard
          key={r.id}
          script={r.content}
          format={r.format}
          segment={r.segment}
          actions={<ScriptActions id={r.id} format={r.format} script={r.content} />}
        />
      ))}
    </div>
  );
}
