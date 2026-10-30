import { AlertCircle, AtSign, CheckCircle2, Users } from "lucide-react";
import { Suspense } from "react";
import { AccountList } from "@/components/accounts/account-list";
import { buttonVariants } from "@/components/ui/button";
import { ListSkeleton } from "@/components/ui/skeleton";
import * as accounts from "@/controllers/accounts";
import { requireUser } from "@/lib/auth";

export default function ContasPage({ searchParams }: PageProps<"/contas">) {
  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Contas</h1>
        <p className="max-w-[65ch] text-sm text-muted-foreground">
          Contas profissionais do Instagram (Business ou Creator) onde os posts são publicados. Conecte
          quantas quiser e escolha a conta em cada post.
        </p>
      </div>
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
        <p role="alert" className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden />
          {erro}
        </p>
      )}
      {typeof conectada === "string" && (
        <p role="status" className="flex items-start gap-2 rounded-lg bg-accent p-3 text-sm text-accent-foreground">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden />
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
      <section className="grid gap-3">
        <h2 className="font-semibold">{rows.length === 0 ? "Conectar uma conta" : "Conectar mais contas"}</h2>
        {/* Plain links: each route answers with a redirect to the provider's login page. */}
        <div className="grid gap-3 md:grid-cols-2">
          <ConnectOption
            icon={Users}
            title="Pelo Facebook"
            text="Conecta de uma vez todas as contas Instagram vinculadas às Páginas que você escolher."
            href="/api/instagram/facebook/connect"
            label="Conectar com Facebook"
            primary
          />
          <ConnectOption
            icon={AtSign}
            title="Pelo Instagram"
            text="Uma conta por vez, sem Página do Facebook. Entre com a conta que você quer adicionar."
            href="/api/instagram/connect"
            label="Conectar com Instagram"
          />
        </div>
      </section>
    </>
  );
}

function ConnectOption({
  icon: Icon,
  title,
  text,
  href,
  label,
  primary,
}: {
  icon: typeof Users;
  title: string;
  text: string;
  href: string;
  label: string;
  primary?: boolean;
}) {
  return (
    <div className="grid content-start gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5">
      <span className="grid size-9 place-items-center rounded-lg bg-accent text-accent-foreground">
        <Icon className="size-4" strokeWidth={1.75} aria-hidden />
      </span>
      <div className="grid gap-1">
        <h3 className="font-medium">{title}</h3>
        <p className="text-sm text-muted-foreground">{text}</p>
      </div>
      <a href={href} className={buttonVariants({ variant: primary ? "default" : "outline", className: "justify-self-start" })}>
        {label}
      </a>
    </div>
  );
}
