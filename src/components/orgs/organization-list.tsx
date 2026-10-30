"use client";

import { Building2, ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { Monogram } from "./breadcrumbs";

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
      <form onSubmit={create} className="flex max-w-md gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome da nova empresa"
          aria-label="Nome da empresa"
          maxLength={80}
          required
        />
        <Button type="submit" disabled={pending}>
          <Plus strokeWidth={1.75} aria-hidden />
          {pending ? "Criando…" : "Criar empresa"}
        </Button>
      </form>
      {organizations.length === 0 ? (
        <div className="grid max-w-md justify-items-start gap-2 rounded-xl border border-dashed p-8">
          <Building2 className="size-6 text-primary" strokeWidth={1.75} aria-hidden />
          <h2 className="font-semibold">Nenhuma empresa ainda</h2>
          <p className="text-sm text-muted-foreground">
            Crie a primeira com o nome do cliente ou do seu negócio. Depois cadastre as marcas dela.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {organizations.map((o) => (
            <li key={o.id}>
              <Link
                href={`/empresas/${o.slug}`}
                className="group flex items-center gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition-colors hover:ring-primary/40"
              >
                <Monogram name={o.name} />
                <span className="grid min-w-0 flex-1">
                  <span className="truncate font-medium">{o.name}</span>
                  <span className="text-sm text-muted-foreground">{brandCountLabel(o.brandCount)}</span>
                </span>
                <ChevronRight
                  className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                  strokeWidth={1.75}
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
