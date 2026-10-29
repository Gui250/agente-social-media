import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BrandAssets } from "@/components/orgs/brand-assets";
import { BrandForm } from "@/components/orgs/brand-form";
import * as brands from "@/controllers/brands";
import { requireUser } from "@/lib/auth";
import { orNotFound } from "../../../or-not-found";

type Params = Promise<{ slug: string; brandId: string }>;

export default function BrandPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Carregando marca…</p>}>
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
      <nav className="flex flex-wrap gap-1 text-sm text-muted-foreground" aria-label="Navegação">
        <Link href="/empresas" className="hover:underline">
          Empresas
        </Link>
        <span>›</span>
        <Link href={`/empresas/${slug}`} className="hover:underline">
          {brand.organizationName}
        </Link>
        <span>›</span>
        <span className="text-foreground">{brand.name}</span>
      </nav>
      <h1 className="text-lg font-semibold">{brand.name}</h1>
      <section className="grid gap-3">
        <h2 className="font-medium">Logo e arquivos</h2>
        <BrandAssets brandId={brand.id} assets={brand.assets} />
      </section>
      <section className="grid gap-3">
        <h2 className="font-medium">Dados e brand kit</h2>
        <BrandForm key={brand.updatedAt} brand={brand} />
      </section>
    </div>
  );
}
