"use client";

import { Pencil, Trash2 } from "lucide-react";
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
import { api } from "@/lib/api-client";
import { Monogram } from "./breadcrumbs";
import { brandCountLabel } from "./organization-list";

export function OrganizationHeader({
  organization,
}: {
  organization: { id: string; name: string; slug: string; brandCount: number };
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(organization.name);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  async function rename(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      await api(`/api/organizations/${organization.id}`, { method: "PATCH", body: { name } });
      toast.success("Empresa renomeada.");
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
      await api(`/api/organizations/${organization.id}`, { method: "DELETE" });
      toast.success(`Empresa ${organization.name} excluída.`);
      router.push("/empresas");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
      setPending(false);
    }
  }

  const { brandCount } = organization;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {editing ? (
        <form onSubmit={rename} className="flex max-w-xl flex-1 gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Nome da empresa" maxLength={80} required />
          <Button type="submit" disabled={pending}>
            Salvar
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setEditing(false);
              setName(organization.name);
            }}
          >
            Cancelar
          </Button>
        </form>
      ) : (
        <>
          <div className="flex min-w-0 items-center gap-3">
            <Monogram name={organization.name} className="size-12 text-lg" />
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-semibold tracking-tight">{organization.name}</h1>
              <p className="text-sm text-muted-foreground">{brandCountLabel(brandCount)}</p>
            </div>
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil strokeWidth={1.75} aria-hidden />
              Renomear
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirming(true)}
            >
              <Trash2 strokeWidth={1.75} aria-hidden />
              Excluir empresa
            </Button>
          </div>
        </>
      )}
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir {organization.name}?</DialogTitle>
            <DialogDescription>
              {brandCount === 0
                ? "A empresa não tem marcas. Esta ação não pode ser desfeita."
                : `Isso exclui também ${brandCountLabel(brandCount)} e seus arquivos. Esta ação não pode ser desfeita.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={remove} disabled={pending}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
