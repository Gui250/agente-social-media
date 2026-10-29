import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { ChatPanel } from "@/components/chat/chat-panel";
import * as chat from "@/controllers/chat";
import { requireUser } from "@/lib/auth";
import { formatInTimeZone } from "@/lib/datetime";
import { DomainError } from "@/lib/errors";
import { cn } from "@/lib/utils";

type Search = Promise<{ c?: string | string[] }>;

async function selectedId(searchParams: Search) {
  const { c } = await searchParams;
  if (c === undefined) return undefined;
  const id = z.uuid().safeParse(c);
  if (!id.success) notFound();
  return id.data;
}

export default function ChatPage({ searchParams }: { searchParams: Search }) {
  return (
    <div className="grid flex-1 gap-4 md:grid-cols-[14rem_1fr]">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Carregando conversas…</p>}>
        <History searchParams={searchParams} />
      </Suspense>
      <Suspense>
        <Conversation searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function History({ searchParams }: { searchParams: Search }) {
  const [user, current] = await Promise.all([requireUser(), selectedId(searchParams)]);
  const rows = await chat.listConversations(user.id);
  const list = (
    <ul className="grid gap-1">
      {rows.length === 0 && <li className="text-sm text-muted-foreground">Nenhuma conversa ainda.</li>}
      {rows.map((r) => (
        <li key={r.id}>
          <Link
            href={`/chat?c=${r.id}`}
            aria-current={r.id === current ? "page" : undefined}
            className={cn(
              "block rounded-md px-2 py-1.5 text-sm hover:bg-muted",
              r.id === current && "bg-muted",
            )}
          >
            <span className="block truncate" title={r.title ?? undefined}>
              {r.title ?? "Aguardando confirmação"}
            </span>
            <span className="block text-xs text-muted-foreground">
              {formatInTimeZone(r.updated_at, user.timezone)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <details className="md:hidden">
        <summary className="cursor-pointer text-sm font-medium">Histórico</summary>
        <div className="mt-2">{list}</div>
      </details>
      <aside className="hidden max-h-[calc(100vh-8rem)] overflow-y-auto md:block">
        <h2 className="mb-2 text-sm font-medium">Histórico</h2>
        {list}
      </aside>
    </>
  );
}

async function Conversation({ searchParams }: { searchParams: Search }) {
  const [user, id] = await Promise.all([requireUser(), selectedId(searchParams)]);
  const skills = await chat.skillOptions(user.id);
  if (!id) return <ChatPanel key="new" skills={skills} />;
  const opened = await chat.openConversation(user.id, id).catch((err) => {
    if (err instanceof DomainError && err.status === 404) notFound();
    throw err;
  });
  return (
    <ChatPanel key={id} skills={skills} initialMessages={opened.messages} initialApprovals={opened.approvals} />
  );
}
