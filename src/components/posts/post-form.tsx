"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { MediaUploader, type UploadedMedia } from "@/components/media/media-uploader";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";

export type AccountOption = { id: string; username: string; status: string };
export type EditablePost = {
  id: string;
  accountId: string | null;
  postType: "image" | "carousel" | "reel";
  caption: string;
  mediaCount: number;
};

const TYPE_LABEL = { image: "imagem", carousel: "carrossel", reel: "Reels" } as const;

// <input type="datetime-local"> has no zone: interpret it in the browser's zone, send UTC ISO.
const toIso = (local: string) => (local ? new Date(local).toISOString() : null);

export function PostForm({
  accounts,
  post,
  onDone,
}: {
  accounts: AccountOption[];
  post?: EditablePost;
  onDone?: () => void;
}) {
  const router = useRouter();
  const active = accounts.filter((a) => a.status === "active");
  const [accountId, setAccountId] = useState(post?.accountId ?? active[0]?.id ?? "");
  const [postType, setPostType] = useState<EditablePost["postType"]>(post?.postType ?? "image");
  const [caption, setCaption] = useState(post?.caption ?? "");
  const [media, setMedia] = useState<UploadedMedia[]>([]);
  const [when, setWhen] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  const username = accounts.find((a) => a.id === accountId)?.username;
  const mediaCount = media.length || post?.mediaCount || 0;

  async function submit() {
    setPending(true);
    try {
      const body = {
        accountId,
        postType,
        caption,
        ...(media.length > 0 || !post ? { mediaIds: media.map((m) => m.id) } : {}),
        ...(when ? { scheduledAt: toIso(when) } : {}),
      };
      if (post) await api(`/api/posts/${post.id}`, { method: "PATCH", body });
      else await api("/api/posts", { body });
      toast.success(when ? "Post agendado." : "Post salvo como rascunho.");
      setConfirming(false);
      setCaption("");
      setMedia([]);
      setWhen("");
      onDone?.();
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
      setConfirming(false);
    } finally {
      setPending(false);
    }
  }

  if (active.length === 0 && !post) {
    return (
      <p className="rounded-lg border p-4 text-sm text-muted-foreground">
        Conecte uma conta Instagram em <a className="underline" href="/contas">Contas</a> para
        criar posts.
      </p>
    );
  }

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (when) setConfirming(true); // scheduling always goes through the confirmation dialog
        else submit();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="account">Conta</Label>
          <NativeSelect id="account" value={accountId} onChange={(e) => setAccountId(e.target.value)} required>
            {accounts.map((a) => (
              <option key={a.id} value={a.id} disabled={a.status !== "active"}>
                @{a.username}
                {a.status !== "active" ? " (expirada)" : ""}
              </option>
            ))}
          </NativeSelect>
          <a href="/contas" className="text-xs text-primary underline-offset-4 hover:underline">
            + Conectar outra conta
          </a>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="postType">Tipo</Label>
          <NativeSelect id="postType" value={postType} onChange={(e) => setPostType(e.target.value as EditablePost["postType"])}>
            <option value="image">Imagem (1 foto)</option>
            <option value="carousel">Carrossel (2 a 20)</option>
            <option value="reel">Reels (1 vídeo)</option>
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="when">Data e hora</Label>
          <Input id="when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="caption">Legenda ({caption.length}/2200)</Label>
        <Textarea id="caption" value={caption} maxLength={2200} rows={4} onChange={(e) => setCaption(e.target.value)} />
      </div>
      <div className="grid gap-1.5">
        <span className="text-sm font-medium">
          Mídia {post && media.length === 0 && `(${post.mediaCount} atual; anexe para substituir)`}
        </span>
        <MediaUploader value={media} onChange={setMedia} disabled={pending} />
      </div>
      <div className="flex justify-end gap-2">
        {onDone && (
          <Button type="button" variant="outline" onClick={onDone}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={pending || !accountId}>
          {when ? "Agendar" : post ? "Salvar" : "Salvar rascunho"}
        </Button>
      </div>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar agendamento</DialogTitle>
            <DialogDescription>
              {TYPE_LABEL[postType]} em @{username} para{" "}
              {when && new Date(when).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })},{" "}
              {mediaCount} mídia(s)
            </DialogDescription>
          </DialogHeader>
          <p className="line-clamp-4 text-sm whitespace-pre-wrap">{caption || "(sem legenda)"}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)}>
              Voltar
            </Button>
            <Button onClick={submit} disabled={pending}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}
