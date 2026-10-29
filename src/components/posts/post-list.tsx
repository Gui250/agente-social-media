"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/api-client";
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
};

const STATUS: Record<PostStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "rascunho", variant: "outline" },
  scheduled: { label: "agendado", variant: "default" },
  publishing: { label: "publicando", variant: "secondary" },
  published: { label: "publicado", variant: "secondary" },
  failed: { label: "falhou", variant: "destructive" },
  cancelled: { label: "cancelado", variant: "outline" },
};
const TYPE_LABEL: Record<PostType, string> = { image: "Imagem", carousel: "Carrossel", reel: "Reels" };
const EDITABLE: PostStatus[] = ["draft", "scheduled", "failed"];

export function PostList({ posts, accounts }: { posts: PostItem[]; accounts: AccountOption[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<PostItem | null>(null);
  const [cancelling, setCancelling] = useState<PostItem | null>(null);
  const [retrying, setRetrying] = useState<PostItem | null>(null);
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

  if (posts.length === 0) return <p className="text-sm text-muted-foreground">Nenhum post ainda.</p>;

  return (
    <>
      <ul className="grid gap-2">
        {posts.map((p) => (
          <li key={p.id} className="grid gap-2 rounded-lg border p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={STATUS[p.status].variant}>{STATUS[p.status].label}</Badge>
              <span className="font-medium">{TYPE_LABEL[p.postType]}</span>
              {p.username && <span className="text-muted-foreground">@{p.username}</span>}
              {p.scheduledAtLocal && <span className="text-muted-foreground">· {p.scheduledAtLocal}</span>}
            </div>
            <p className="line-clamp-2 whitespace-pre-wrap">{p.caption || "(sem legenda)"}</p>
            {p.failureReason && <p className="text-destructive">Motivo: {p.failureReason}</p>}
            {p.permalink && (
              <a href={p.permalink} target="_blank" rel="noreferrer" className="text-primary underline">
                Ver no Instagram
              </a>
            )}
            <div className="flex flex-wrap gap-2">
              {EDITABLE.includes(p.status) && (
                <Button size="sm" variant="outline" onClick={() => setEditing(p)}>
                  {p.status === "failed" ? "Reagendar" : "Editar"}
                </Button>
              )}
              {(p.status === "failed" || p.status === "draft") && (
                <Button size="sm" onClick={() => setRetrying(p)}>
                  {p.status === "failed" ? "Tentar de novo" : "Publicar agora"}
                </Button>
              )}
              {p.status === "scheduled" && (
                <Button size="sm" variant="destructive" onClick={() => setCancelling(p)}>
                  Cancelar
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>

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
              {retrying && `${TYPE_LABEL[retrying.postType]} em @${retrying.username ?? "?"} — ${retrying.mediaCount} mídia(s)`}
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
