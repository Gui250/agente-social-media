"use client";

import {
  AlertCircle,
  Ban,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  FilePen,
  ImageIcon,
  Layers,
  Loader2,
  type LucideIcon,
  Plus,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { PostStatus, PostType } from "@/models/post";
import { type AccountOption, PostForm } from "./post-form";

export type PostItem = {
  id: string;
  status: PostStatus;
  postType: PostType;
  caption: string;
  mediaCount: number;
  accountId: string | null;
  username: string | null;
  scheduledAtLocal: string | null;
  permalink: string | null;
  failureReason: string | null;
  // First media, signed for a short while; null once published (the media is released).
  preview: { kind: "image" | "video"; url: string } | null;
};

const STATUS: Record<PostStatus, { label: string; icon: LucideIcon; className: string }> = {
  draft: { label: "Rascunho", icon: FilePen, className: "bg-muted text-muted-foreground" },
  scheduled: { label: "Agendado", icon: CalendarClock, className: "bg-accent text-accent-foreground" },
  publishing: { label: "Publicando", icon: Loader2, className: "bg-accent text-accent-foreground" },
  published: { label: "Publicado", icon: CheckCircle2, className: "bg-secondary text-secondary-foreground" },
  failed: { label: "Falhou", icon: AlertCircle, className: "bg-destructive/10 text-destructive" },
  cancelled: { label: "Cancelado", icon: Ban, className: "bg-muted text-muted-foreground" },
};
const TYPE_LABEL: Record<PostType, string> = { image: "Imagem", carousel: "Carrossel", reel: "Reels" };
const EDITABLE: PostStatus[] = ["draft", "scheduled", "failed"];

const TABS = [
  { id: "all", label: "Todos", statuses: null },
  { id: "upcoming", label: "Agendados", statuses: ["scheduled", "publishing"] },
  { id: "pending", label: "Rascunhos e falhas", statuses: ["draft", "failed"] },
  { id: "done", label: "Publicados", statuses: ["published", "cancelled"] },
] as const satisfies readonly { id: string; label: string; statuses: readonly PostStatus[] | null }[];
type TabId = (typeof TABS)[number]["id"];

const inTab = (tab: (typeof TABS)[number], p: PostItem) =>
  tab.statuses === null || (tab.statuses as readonly PostStatus[]).includes(p.status);

export function PostList({ posts, accounts }: { posts: PostItem[]; accounts: AccountOption[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<PostItem | null>(null);
  const [cancelling, setCancelling] = useState<PostItem | null>(null);
  const [retrying, setRetrying] = useState<PostItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState<TabId>("all");
  const [pending, setPending] = useState(false);

  // Reels finish on later cron ticks: refresh while anything is still publishing.
  const publishing = posts.some((p) => p.status === "publishing");
  useEffect(() => {
    if (!publishing) return;
    const timer = setInterval(() => router.refresh(), 15_000);
    return () => clearInterval(timer);
  }, [publishing, router]);

  async function publishNow() {
    if (!retrying) return;
    setPending(true);
    try {
      const post = await api<{ status: string; failure_reason: string | null }>(
        `/api/posts/${retrying.id}/publish`,
        { method: "POST" },
      );
      if (post.status === "failed") toast.error(`Falhou: ${post.failure_reason}`);
      else if (post.status === "published") toast.success("Publicado no Instagram.");
      else toast.info("Publicando… o Instagram ainda está processando a mídia.");
      setRetrying(null);
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  async function cancel() {
    if (!cancelling) return;
    setPending(true);
    try {
      await api(`/api/posts/${cancelling.id}/cancel`, { method: "POST" });
      toast.success("Post cancelado.");
      setCancelling(null);
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  const current = TABS.find((t) => t.id === tab)!;
  const shown = posts.filter((p) => inTab(current, p));

  return (
    <>
      {posts.length === 0 ? (
        <div className="grid max-w-md justify-items-start gap-3 rounded-xl border border-dashed p-8">
          <CalendarClock className="size-6 text-primary" strokeWidth={1.75} aria-hidden />
          <div className="grid gap-1">
            <h2 className="font-semibold">Nenhum post ainda</h2>
            <p className="text-sm text-muted-foreground">
              Crie um post com a sua mídia ou peça um criativo no Chat e agende por lá.
            </p>
          </div>
          <Button onClick={() => setCreating(true)}>
            <Plus strokeWidth={1.75} aria-hidden />
            Novo post
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div role="tablist" aria-label="Filtrar posts" className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-1">
              {TABS.map((t) => {
                const count = posts.filter((p) => inTab(t, p)).length;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={tab === t.id}
                    onClick={() => setTab(t.id)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground",
                      tab === t.id && "bg-background font-medium text-foreground shadow-sm",
                    )}
                  >
                    {t.label}
                    <span className="text-xs tabular-nums opacity-70">{count}</span>
                  </button>
                );
              })}
            </div>
            <Button onClick={() => setCreating(true)}>
              <Plus strokeWidth={1.75} aria-hidden />
              Novo post
            </Button>
          </div>

          {shown.length === 0 ? (
            <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">Nenhum post aqui.</p>
          ) : (
            <ul className="grid gap-3">
              {shown.map((p) => (
                <PostRow
                  key={p.id}
                  post={p}
                  onEdit={() => setEditing(p)}
                  onPublish={() => setRetrying(p)}
                  onCancel={() => setCancelling(p)}
                />
              ))}
            </ul>
          )}
        </div>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Novo post</DialogTitle>
            <DialogDescription>Sem data, ele fica salvo como rascunho.</DialogDescription>
          </DialogHeader>
          {creating && <PostForm accounts={accounts} onDone={() => setCreating(false)} />}
        </DialogContent>
      </Dialog>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar post</DialogTitle>
          </DialogHeader>
          {editing && <PostForm accounts={accounts} post={editing} onDone={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>

      <Dialog open={retrying !== null} onOpenChange={(open) => !open && setRetrying(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publicar agora?</DialogTitle>
            <DialogDescription>
              {retrying && `${TYPE_LABEL[retrying.postType]} em @${retrying.username ?? "?"}, ${retrying.mediaCount} mídia(s)`}
            </DialogDescription>
          </DialogHeader>
          <p className="line-clamp-4 text-sm whitespace-pre-wrap">{retrying?.caption || "(sem legenda)"}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRetrying(null)}>
              Voltar
            </Button>
            <Button onClick={publishNow} disabled={pending}>
              Publicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelling !== null} onOpenChange={(open) => !open && setCancelling(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar este post?</DialogTitle>
            <DialogDescription>Ele não será publicado. Você pode criar outro depois.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelling(null)}>
              Voltar
            </Button>
            <Button variant="destructive" onClick={cancel} disabled={pending}>
              Cancelar post
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PostRow({
  post: p,
  onEdit,
  onPublish,
  onCancel,
}: {
  post: PostItem;
  onEdit: () => void;
  onPublish: () => void;
  onCancel: () => void;
}) {
  const status = STATUS[p.status];
  return (
    <li className="flex gap-4 rounded-xl bg-card p-3 ring-1 ring-foreground/10 sm:p-4">
      <Thumb post={p} />
      <div className="grid min-w-0 flex-1 content-start gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", status.className)}>
            <status.icon
              className={cn("size-3.5", p.status === "publishing" && "animate-spin motion-reduce:animate-none")}
              strokeWidth={2}
              aria-hidden
            />
            {status.label}
          </span>
          {p.scheduledAtLocal && (
            <span className="inline-flex items-center gap-1.5 font-medium">
              <CalendarClock className="size-4 text-muted-foreground" strokeWidth={1.75} aria-hidden />
              {p.scheduledAtLocal}
            </span>
          )}
          <span className="text-muted-foreground">
            {TYPE_LABEL[p.postType]}
            {p.username && ` em @${p.username}`}
          </span>
        </div>
        <p className="line-clamp-2 text-sm whitespace-pre-wrap text-muted-foreground">
          {p.caption || "(sem legenda)"}
        </p>
        {p.failureReason && (
          <p className="flex items-start gap-1.5 rounded-md bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
            <AlertCircle className="mt-px size-3.5 shrink-0" strokeWidth={2} aria-hidden />
            {p.failureReason}
          </p>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          {EDITABLE.includes(p.status) && (
            <Button size="sm" variant="outline" onClick={onEdit}>
              {p.status === "failed" ? "Reagendar" : "Editar"}
            </Button>
          )}
          {(p.status === "failed" || p.status === "draft") && (
            <Button size="sm" onClick={onPublish}>
              {p.status === "failed" ? "Tentar de novo" : "Publicar agora"}
            </Button>
          )}
          {p.status === "scheduled" && (
            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={onCancel}>
              Cancelar
            </Button>
          )}
          {p.permalink && (
            <a href={p.permalink} target="_blank" rel="noreferrer" className={buttonVariants({ size: "sm", variant: "outline" })}>
              <ExternalLink strokeWidth={1.75} aria-hidden />
              Ver no Instagram
            </a>
          )}
        </div>
      </div>
    </li>
  );
}

function Thumb({ post }: { post: PostItem }) {
  const { preview } = post;
  return (
    <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-lg bg-muted sm:h-25 sm:w-20">
      {preview?.kind === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed Blob URL, not optimizable
        <img src={preview.url} alt="" className="size-full object-cover" />
      ) : preview?.kind === "video" ? (
        <video src={preview.url} muted playsInline preload="metadata" className="size-full object-cover" />
      ) : (
        <div className="grid size-full place-items-center text-muted-foreground">
          <ImageIcon className="size-5" strokeWidth={1.5} aria-hidden />
        </div>
      )}
      {post.postType === "carousel" && (
        <Layers
          className="absolute top-1.5 right-1.5 size-4 text-white drop-shadow"
          strokeWidth={2}
          aria-label={`Carrossel com ${post.mediaCount} mídias`}
        />
      )}
    </div>
  );
}
