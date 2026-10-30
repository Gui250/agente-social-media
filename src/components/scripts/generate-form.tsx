"use client";

import { Loader2, Sparkles } from "lucide-react";
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
    <form onSubmit={onSubmit} className="grid gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5">
      <div className="grid gap-1">
        <h2 className="font-semibold">Novo roteiro</h2>
        <p className="text-sm text-muted-foreground">
          A IA escreve gancho, slides, legenda e hashtags. Para gerar as artes, peça no Chat.
        </p>
      </div>
      {/* Only static while there is no AI video provider (Sora is gone). */}
      <input type="hidden" name="format" value="static" />
      <div className="grid gap-2">
        <Label htmlFor="segment">Segmento do negócio</Label>
        <Input id="segment" name="segment" minLength={2} maxLength={120} required placeholder="Ex.: loja de roupas fitness" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="objective">Objetivo (opcional)</Label>
          <Input id="objective" name="objective" maxLength={300} placeholder="Ex.: agendar avaliações" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="audience">Público-alvo (opcional)</Label>
          <Input id="audience" name="audience" maxLength={300} placeholder="Ex.: mulheres de 25 a 40 anos" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="tone">Tom (opcional)</Label>
          <Input id="tone" name="tone" maxLength={300} placeholder="Ex.: descontraído" />
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending ? (
            <Loader2 className="animate-spin motion-reduce:animate-none" strokeWidth={1.75} aria-hidden />
          ) : (
            <Sparkles strokeWidth={1.75} aria-hidden />
          )}
          {pending ? "Gerando…" : "Gerar roteiro"}
        </Button>
      </div>
    </form>
  );
}
