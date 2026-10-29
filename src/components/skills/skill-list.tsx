"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/api-client";

type ImportedSkill = { id: string; name: string; description: string };

const MAX_CHARS = 20_000;

export function SkillImport() {
  const router = useRouter();
  const file = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);

  async function upload(f: File) {
    setPending(true);
    try {
      const source = await f.text();
      if (source.length > MAX_CHARS) throw new Error(`O arquivo passa de ${MAX_CHARS.toLocaleString("pt-BR")} caracteres.`);
      const skill = await api<{ name: string }>("/api/skills", { body: { source } });
      toast.success(`Skill /${skill.name} importada.`);
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setPending(false);
      if (file.current) file.current.value = "";
    }
  }

  return (
    <div>
      <input
        ref={file}
        type="file"
        accept=".md,text/markdown,text/plain"
        className="sr-only"
        aria-label="Arquivo SKILL.md"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
        }}
      />
      <Button onClick={() => file.current?.click()} disabled={pending}>
        {pending ? "Importando…" : "Importar SKILL.md"}
      </Button>
    </div>
  );
}

export function ImportedSkillList({ skills }: { skills: ImportedSkill[] }) {
  const router = useRouter();
  const [target, setTarget] = useState<ImportedSkill | null>(null);
  const [pending, setPending] = useState(false);

  async function remove() {
    if (!target) return;
    setPending(true);
    try {
      await api(`/api/skills/${target.id}`, { method: "DELETE" });
      toast.success(`Skill /${target.name} excluída.`);
      setTarget(null);
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  if (skills.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma skill importada ainda.</p>;
  }

  return (
    <>
      <ul className="grid gap-2">
        {skills.map((s) => (
          <li key={s.id} className="flex items-start gap-3 rounded-lg border p-3">
            <div className="min-w-0">
              <p className="font-medium">/{s.name}</p>
              <p className="text-sm text-muted-foreground">{s.description}</p>
            </div>
            <Button className="ml-auto" variant="outline" size="sm" onClick={() => setTarget(s)}>
              Excluir
            </Button>
          </li>
        ))}
      </ul>
      <Dialog open={target !== null} onOpenChange={(open) => !open && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir /{target?.name}?</DialogTitle>
            <DialogDescription>
              O agente deixa de usar esta skill. Os roteiros já gerados com ela continuam salvos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={remove} disabled={pending}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
