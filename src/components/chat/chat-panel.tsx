"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { MediaUploader, type UploadedMedia } from "@/components/media/media-uploader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import type { Message } from "@/agent/transcript";
import type { Approval, ChatResponse } from "@/controllers/chat";
import { ApprovalCard } from "./approval-card";

// The page remounts this (key = conversation id) whenever another conversation is opened.
export function ChatPanel({
  initialMessages = [],
  initialApprovals = [],
}: {
  initialMessages?: Message[];
  initialApprovals?: Approval[];
}) {
  const router = useRouter();
  const conversationId = useSearchParams().get("c") ?? undefined;
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [media, setMedia] = useState<UploadedMedia[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>(initialApprovals);
  const [decisions, setDecisions] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  // Braces matter: scrollIntoView returns a Promise in recent browsers, and an effect may only
  // return a cleanup function.
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, approvals, pending]);

  function handle(res: ChatResponse) {
    setMessages((m) => [...m, { role: "assistant", text: res.reply }]);
    setApprovals(res.status === "needs_approval" ? res.approvals : []);
    setDecisions({});
    // Either way the server re-renders, so the history list picks up the new order/title.
    if (res.conversationId !== conversationId) router.replace(`/chat?c=${res.conversationId}`);
    else router.refresh();
  }

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const message = input.trim();
    if (!message || pending || approvals.length > 0) return;
    const mediaIds = media.map((m) => m.id);
    setInput("");
    setMedia([]);
    setMessages((m) => [
      ...m,
      { role: "user", text: mediaIds.length ? `${message}\n📎 ${mediaIds.length} mídia(s)` : message },
    ]);
    setPending(true);
    try {
      handle(await api<ChatResponse>("/api/chat", { body: { conversationId, message, mediaIds } }));
    } catch (err) {
      toast.error((err as Error).message);
      setMessages((m) => m.slice(0, -1));
      setInput(message);
      setMedia(media);
    } finally {
      setPending(false);
    }
  }

  async function decide(id: string, approve: boolean) {
    const next = { ...decisions, [id]: approve };
    setDecisions(next);
    if (approvals.some((a) => next[a.id] === undefined)) return; // wait for every card
    setPending(true);
    try {
      handle(
        await api<ChatResponse>("/api/chat/approvals", {
          body: {
            conversationId,
            decisions: approvals.map((a) => ({ id: a.id, approve: next[a.id] })),
          },
        }),
      );
    } catch (err) {
      toast.error((err as Error).message);
      setApprovals([]);
    } finally {
      setPending(false);
    }
  }

  const blocked = approvals.length > 0;

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Chat</h1>
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => router.push("/chat")}
        >
          Nova conversa
        </Button>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto" aria-live="polite">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Diga o segmento do seu negócio e o formato (vídeo curto ou post estático) para receber
            um roteiro. Para agendar, anexe a imagem ou o vídeo e diga quando publicar.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "user"
                ? "ml-auto max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm whitespace-pre-wrap text-primary-foreground"
                : "mr-auto max-w-[85%] rounded-lg bg-muted px-3 py-2 text-sm whitespace-pre-wrap"
            }
          >
            {m.text}
          </div>
        ))}
        {approvals.map((a) => (
          <ApprovalCard
            key={a.id}
            approval={a}
            decision={decisions[a.id]}
            disabled={pending}
            onDecide={(approve) => decide(a.id, approve)}
          />
        ))}
        {pending && <p className="text-sm text-muted-foreground">Pensando…</p>}
        <div ref={bottom} />
      </div>

      <form onSubmit={send} className="grid gap-2">
        {blocked && (
          <p className="text-sm text-muted-foreground">Confirme ou recuse a ação acima para continuar.</p>
        )}
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) send(e);
            }}
            placeholder="Escreva sua mensagem…"
            aria-label="Mensagem"
            maxLength={4000}
            rows={2}
            disabled={blocked}
          />
          <Button type="submit" disabled={pending || blocked || !input.trim()}>
            Enviar
          </Button>
        </div>
        <MediaUploader value={media} onChange={setMedia} disabled={pending || blocked} />
      </form>
    </div>
  );
}
