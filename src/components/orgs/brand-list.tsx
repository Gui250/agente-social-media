"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";

// colors: the brand kit's palette (hex), shown as swatches.
type BrandItem = { id: string; name: string; industry: string | null; colors: string[] };

export function BrandList({
  organization,
  brands,
}: {
  organization: { id: string; slug: string };
  brands: BrandItem[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const brand = await api<{ name: string }>("/api/brands", { body: { organizationId: organization.id, name } });
      toast.success(`Marca ${brand.name} criada.`);
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
          placeholder="Nome da nova marca"
          aria-label="Nome da marca"
          maxLength={80}
          required
        />
        <Button type="submit" disabled={pending}>
          <Plus strokeWidth={1.75} aria-hidden />
          {pending ? "Criando…" : "Nova marca"}
        </Button>
      </form>
      {brands.length === 0 ? (
        <p className="max-w-md rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
          Nenhuma marca nesta empresa. Crie uma para cadastrar logo, cores e tom de voz.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {brands.map((b) => (
            <li key={b.id}>
              <Link
                href={`/empresas/${organization.slug}/marcas/${b.id}`}
                className="grid gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition-colors hover:ring-primary/40"
              >
                <div className="flex h-8 overflow-hidden rounded-md bg-muted">
                  {b.colors.slice(0, 6).map((hex, i) => (
                    <span key={i} className="flex-1" style={{ backgroundColor: hex }} />
                  ))}
                </div>
                <span className="grid gap-0.5">
                  <span className="font-medium">{b.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {b.industry || (b.colors.length === 0 ? "Brand kit por preencher" : "Sem segmento")}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
