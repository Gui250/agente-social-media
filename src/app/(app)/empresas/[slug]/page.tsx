import { Suspense } from "react";
import { Breadcrumbs } from "@/components/orgs/breadcrumbs";
import { BrandList } from "@/components/orgs/brand-list";
import { OrganizationHeader } from "@/components/orgs/organization-header";
import { ListSkeleton } from "@/components/ui/skeleton";
import * as brands from "@/controllers/brands";
import * as organizations from "@/controllers/organizations";
import { requireUser } from "@/lib/auth";
import { orNotFound } from "../or-not-found";

type Params = Promise<{ slug: string }>;

export default function OrganizationPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<ListSkeleton label="Carregando empresa…" />}>
      <Organization params={params} />
    </Suspense>
  );
}

async function Organization({ params }: { params: Params }) {
  const [user, { slug }] = await Promise.all([requireUser(), params]);
  const organization = await organizations.getBySlug(user.id, slug).catch(orNotFound);
  const brandList = await brands.list(user.id, organization.id);
  return (
    <div className="grid gap-6">
      <Breadcrumbs items={[{ label: "Empresas", href: "/empresas" }, { label: organization.name }]} />
      <OrganizationHeader organization={organization} />
      <section className="grid gap-3">
        <h2 className="font-semibold">Marcas</h2>
        <BrandList
          organization={organization}
          brands={brandList.map((b) => ({ id: b.id, name: b.name, industry: b.industry, colors: b.colorPalette.map((c) => c.hex) }))}
        />
      </section>
    </div>
  );
}
