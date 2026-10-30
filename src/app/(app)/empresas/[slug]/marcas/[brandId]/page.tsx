import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BrandAssets } from "@/components/orgs/brand-assets";
import { BrandForm } from "@/components/orgs/brand-form";
import { Breadcrumbs, Monogram } from "@/components/orgs/breadcrumbs";
import { ListSkeleton } from "@/components/ui/skeleton";
import * as brands from "@/controllers/brands";
import { requireUser } from "@/lib/auth";
import { orNotFound } from "../../../or-not-found";

type Params = Promise<{ slug: string; brandId: string }>;

export default function BrandPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<ListSkeleton label="Carregando marca…" />}>
      <Brand params={params} />
    </Suspense>
  );
}

async function Brand({ params }: { params: Params }) {
  const [user, { slug, brandId }] = await Promise.all([requireUser(), params]);
  const brand = await brands.get(user.id, brandId).catch(orNotFound);
  if (brand.organizationSlug !== slug) notFound();
  return (
    <div className="grid gap-6">
      <Breadcrumbs
        items={[
          { label: "Empresas", href: "/empresas" },
          { label: brand.organizationName, href: `/empresas/${slug}` },
          { label: brand.name },
        ]}
      />
      <div className="flex items-center gap-3">
        {brand.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from the private store
          <img src={brand.logoUrl} alt="" className="size-12 rounded-lg border bg-card object-contain p-1" />
        ) : (
          <Monogram name={brand.name} className="size-12 text-lg" />
        )}
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{brand.name}</h1>
          <p className="text-sm text-muted-foreground">{brand.industry || brand.organizationName}</p>
        </div>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[1fr_20rem]">
        <BrandForm key={brand.updatedAt} brand={brand} />
        <aside className="grid gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5 lg:sticky lg:top-20">
          <h2 className="font-semibold">Logo e arquivos</h2>
          <BrandAssets brandId={brand.id} assets={brand.assets} />
        </aside>
      </div>
    </div>
  );
}
