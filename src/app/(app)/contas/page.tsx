import { Suspense } from "react";
import { AccountList } from "@/components/accounts/account-list";
import { buttonVariants } from "@/components/ui/button";
import * as accounts from "@/controllers/accounts";
import { requireUser } from "@/lib/auth";
import { ListSkeleton } from "@/components/ui/skeleton";

export default function ContasPage({ searchParams }: PageProps<"/contas">) {
  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Contas</h1>
      <p className="text-sm text-muted-foreground">
        A v1 publica apenas no Instagram, em contas profissionais (Business ou Creator). Você pode
        conectar quantas contas quiser e escolher em qual publicar cada post. Com o Facebook, todas
        as contas Instagram vinculadas às suas Páginas são conectadas de uma vez.
      </p>
      <Suspense fallback={<ListSkeleton label="Carregando contas…" />}>
        <Accounts searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Accounts({ searchParams }: { searchParams: PageProps<"/contas">["searchParams"] }) {
  const { erro, conectada } = await searchParams;
  const user = await requireUser();
  const rows = await accounts.list(user.id);
  return (
    <>
      {typeof erro === "string" && (
        <p role="alert" className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">
          {erro}
        </p>
      )}
      {typeof conectada === "string" && (
        <p role="status" className="rounded-md border p-3 text-sm">
          {conectada} {conectada.includes(",") ? "conectadas" : "conectada"}.
        </p>
      )}
      <AccountList
        accounts={rows.map((a) => ({
          id: a.id,
          username: a.username,
          status: a.status,
          loginType: a.login_type,
        }))}
      />
      {/* Plain links: each route answers with a redirect to the provider's login page. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1 rounded-lg border p-3">
          <a href="/api/instagram/facebook/connect" className={buttonVariants()}>
            Conectar com Facebook
          </a>
          <p className="text-xs text-muted-foreground">
            Conecta de uma vez todas as contas Instagram vinculadas às Páginas que você escolher.
          </p>
        </div>
        <div className="grid gap-1 rounded-lg border p-3">
          <a href="/api/instagram/connect" className={buttonVariants({ variant: "outline" })}>
            {rows.length === 0 ? "Conectar com Instagram" : "Conectar outra conta com Instagram"}
          </a>
          <p className="text-xs text-muted-foreground">
            Uma conta por vez, sem Página do Facebook. O Instagram pede login: entre com a conta que
            você quer adicionar.
          </p>
        </div>
      </div>
    </>
  );
}
