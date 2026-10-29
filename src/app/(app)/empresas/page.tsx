import { Suspense } from "react";
import { OrganizationList } from "@/components/orgs/organization-list";
import * as organizations from "@/controllers/organizations";
import { requireUser } from "@/lib/auth";

export default function OrganizationsPage() {
  return (
    <div className="grid gap-4">
      <h1 className="text-lg font-semibold">Empresas</h1>
      <p className="text-sm text-muted-foreground">
        Cada empresa reúne suas marcas e a identidade visual de cada uma. Só você vê as suas empresas.
      </p>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Carregando empresas…</p>}>
        <Organizations />
      </Suspense>
    </div>
  );
}

async function Organizations() {
  const user = await requireUser();
  return <OrganizationList organizations={await organizations.list(user.id)} />;
}
