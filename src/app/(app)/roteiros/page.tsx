import { Suspense } from "react";
import { GenerateForm } from "@/components/scripts/generate-form";
import { ScriptCard } from "@/components/scripts/script-card";
import { ScriptActions } from "@/components/scripts/script-editor";
import * as scripts from "@/controllers/scripts";
import { requireUser } from "@/lib/auth";
import { ListSkeleton } from "@/components/ui/skeleton";

export default function RoteirosPage() {
  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Roteiros</h1>
        <p className="text-sm text-muted-foreground">Os roteiros que você gerou aqui ou no Chat.</p>
      </div>
      <GenerateForm />
      <Suspense fallback={<ListSkeleton label="Carregando roteiros…" />}>
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
      <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
        Nenhum roteiro ainda. Gere o primeiro acima ou peça no Chat.
      </p>
    );
  }
  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
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
