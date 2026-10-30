import { Suspense } from "react";
import { OrganizationList } from "@/components/orgs/organization-list";
import { ListSkeleton } from "@/components/ui/skeleton";
import * as organizations from "@/controllers/organizations";
import { requireUser } from "@/lib/auth";

export default function OrganizationsPage() {
  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Empresas</h1>
        <p className="max-w-[65ch] text-sm text-muted-foreground">
          Cada empresa reúne suas marcas e o brand kit de cada uma. Só você vê as suas empresas.
        </p>
      </div>
      <Suspense fallback={<ListSkeleton label="Carregando empresas…" />}>
        <Organizations />
      </Suspense>
    </div>
  );
}

async function Organizations() {
  const user = await requireUser();
  return <OrganizationList organizations={await organizations.list(user.id)} />;
}
