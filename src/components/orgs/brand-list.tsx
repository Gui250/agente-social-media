"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";

type BrandItem = { id: string; name: string; industry: string | null };

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
      const brand = await api<BrandItem>("/api/brands", { body: { organizationId: organization.id, name } });
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
    <div className="grid gap-3">
      <form onSubmit={create} className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome da marca"
          aria-label="Nome da marca"
          maxLength={80}
          required
        />
        <Button type="submit" disabled={pending}>
          {pending ? "Criando…" : "Nova marca"}
        </Button>
      </form>
      {brands.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma marca nesta empresa.</p>
      ) : (
        <ul className="grid gap-2">
          {brands.map((b) => (
            <li key={b.id}>
              <Link
                href={`/empresas/${organization.slug}/marcas/${b.id}`}
                className="block rounded-lg border p-3 hover:bg-muted"
              >
                <p className="font-medium">{b.name}</p>
                {b.industry && <p className="text-sm text-muted-foreground">{b.industry}</p>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
