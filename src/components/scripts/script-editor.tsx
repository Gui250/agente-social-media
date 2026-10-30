"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import type { CreativeScript, ScriptFormat } from "@/models/creative-script";

export function ScriptActions({
  id,
  format,
  script,
}: {
  id: string;
  format: ScriptFormat;
  script: CreativeScript;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [draft, setDraft] = useState(script);
  const [hashtags, setHashtags] = useState(script.hashtags.join(" "));
  const [pending, setPending] = useState(false);

  const setBlock = (i: number, patch: Partial<CreativeScript["blocks"][number]>) =>
    setDraft((d) => ({ ...d, blocks: d.blocks.map((b, j) => (j === i ? { ...b, ...patch } : b)) }));

  async function save() {
    setPending(true);
    try {
      const content = { ...draft, hashtags: hashtags.split(/\s+/).filter(Boolean) };
      await api(`/api/scripts/${id}`, { method: "PATCH", body: { content } });
      toast.success("Roteiro salvo.");
      setEditing(false);
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    setPending(true);
    try {
      await api(`/api/scripts/${id}`, { method: "DELETE" });
      toast.success("Roteiro excluído.");
      setDeleting(false);
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
        Editar
      </Button>
      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleting(true)}>
        Excluir
      </Button>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar roteiro</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <Field label="Título">
              <Input value={draft.title} maxLength={120} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </Field>
            <Field label="Gancho">
              <Textarea value={draft.hook} maxLength={300} onChange={(e) => setDraft({ ...draft, hook: e.target.value })} />
            </Field>
            {draft.blocks.map((b, i) => (
              <fieldset key={i} className="grid gap-2 rounded-md border p-2">
                <legend className="px-1 text-sm font-medium">
                  {b.label}
                  {format === "video" && " (segundos)"}
                </legend>
                {format === "video" && (
                  <Input
                    type="number"
                    min={1}
                    aria-label={`Duração de ${b.label}`}
                    value={b.durationSeconds ?? ""}
                    onChange={(e) => setBlock(i, { durationSeconds: Number(e.target.value) || null })}
                  />
                )}
                <Input aria-label={`Visual de ${b.label}`} value={b.visual} onChange={(e) => setBlock(i, { visual: e.target.value })} />
                <Textarea aria-label={`Texto de ${b.label}`} value={b.text} onChange={(e) => setBlock(i, { text: e.target.value })} />
              </fieldset>
            ))}
            <Field label={`Legenda (${draft.caption.length}/2200)`}>
              <Textarea value={draft.caption} maxLength={2200} rows={5} onChange={(e) => setDraft({ ...draft, caption: e.target.value })} />
            </Field>
            <Field label="CTA">
              <Input value={draft.cta} maxLength={200} onChange={(e) => setDraft({ ...draft, cta: e.target.value })} />
            </Field>
            <Field label="Hashtags (separadas por espaço)">
              <Input value={hashtags} onChange={(e) => setHashtags(e.target.value)} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={pending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleting} onOpenChange={setDeleting}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir roteiro?</DialogTitle>
            <DialogDescription>“{script.title}” será apagado. Isso não pode ser desfeito.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(false)}>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm leading-none font-medium">{label}</span>
      {children}
    </label>
  );
}
