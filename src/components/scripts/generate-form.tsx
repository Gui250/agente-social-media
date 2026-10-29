"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";

export function GenerateForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    setPending(true);
    try {
      await api("/api/scripts", { body: data });
      form.reset();
      toast.success("Roteiro gerado.");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2">
      <div className="grid gap-1.5">
        <Label htmlFor="segment">Segmento *</Label>
        <Input id="segment" name="segment" minLength={2} maxLength={120} required placeholder="Ex.: loja de roupas fitness" />
      </div>
      {/* Only static while there is no AI video provider (Sora is gone). */}
      <input type="hidden" name="format" value="static" />
      <div className="grid gap-1.5">
        <Label htmlFor="objective">Objetivo</Label>
        <Input id="objective" name="objective" maxLength={300} placeholder="Ex.: agendar avaliações" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="audience">Público-alvo</Label>
        <Input id="audience" name="audience" maxLength={300} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="tone">Tom</Label>
        <Input id="tone" name="tone" maxLength={300} placeholder="Ex.: descontraído" />
      </div>
      <div className="flex items-end">
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Gerando…" : "Gerar roteiro"}
        </Button>
      </div>
    </form>
  );
}
