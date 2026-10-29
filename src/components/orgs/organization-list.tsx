"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";

type OrganizationItem = { id: string; name: string; slug: string; brandCount: number };

export const brandCountLabel = (n: number) => (n === 1 ? "1 marca" : `${n} marcas`);

export function OrganizationList({ organizations }: { organizations: OrganizationItem[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const org = await api<OrganizationItem>("/api/organizations", { body: { name } });
      toast.success(`Empresa ${org.name} criada.`);
      setName("");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-4">
      <form onSubmit={create} className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome da empresa"
          aria-label="Nome da empresa"
          maxLength={80}
          required
        />
        <Button type="submit" disabled={pending}>
          {pending ? "Criando…" : "Criar empresa"}
        </Button>
      </form>
      {organizations.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma empresa ainda. Crie a primeira.</p>
      ) : (
        <ul className="grid gap-2">
          {organizations.map((o) => (
            <li key={o.id}>
              <Link href={`/empresas/${o.slug}`} className="flex items-baseline gap-3 rounded-lg border p-3 hover:bg-muted">
                <span className="font-medium">{o.name}</span>
                <span className="text-xs text-muted-foreground">{o.slug}</span>
                <span className="ml-auto text-sm text-muted-foreground">{brandCountLabel(o.brandCount)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
