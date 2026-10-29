import Link from "next/link";
import { Suspense } from "react";
import { BrandList } from "@/components/orgs/brand-list";
import { OrganizationHeader } from "@/components/orgs/organization-header";
import * as brands from "@/controllers/brands";
import * as organizations from "@/controllers/organizations";
import { requireUser } from "@/lib/auth";
import { orNotFound } from "../or-not-found";

type Params = Promise<{ slug: string }>;

export default function OrganizationPage({ params }: { params: Params }) {
  return (
    <div className="grid gap-4">
      <Link href="/empresas" className="text-sm text-muted-foreground hover:underline">
        ← Empresas
      </Link>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Carregando empresa…</p>}>
        <Organization params={params} />
      </Suspense>
    </div>
  );
}

async function Organization({ params }: { params: Params }) {
  const [user, { slug }] = await Promise.all([requireUser(), params]);
  const organization = await organizations.getBySlug(user.id, slug).catch(orNotFound);
  const brandList = await brands.list(user.id, organization.id);
  return (
    <>
      <OrganizationHeader organization={organization} />
      <section className="grid gap-2">
        <h2 className="font-medium">Marcas</h2>
        <BrandList organization={organization} brands={brandList} />
      </section>
    </>
  );
}
