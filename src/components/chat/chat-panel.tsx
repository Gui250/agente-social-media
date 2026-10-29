"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { MediaUploader, type UploadedMedia } from "@/components/media/media-uploader";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { apiStream } from "@/lib/api-client";
import { type BrandOption, filterBrands, insertMention, mentionQuery, mentionedIds } from "@/lib/mentions";
import type { Message, MessageMedia } from "@/agent/transcript";
import type { Approval, ChatProgress, ChatResponse, SkillOption } from "@/controllers/chat";
import { ApprovalCard } from "./approval-card";

// Shown while the agent runs a tool, instead of "Pensando…".
const TOOL_STATUS: Record<string, string> = {
  generate_creative_script: "Escrevendo o roteiro…",
  load_skill: "Lendo a skill…",
  extract_visual_identity: "Analisando a identidade visual…",
  list_creative_scripts: "Consultando os roteiros…",
  generate_creative_media: "Gerando as artes…",
  list_generations: "Consultando as mídias…",
  list_connected_accounts: "Consultando as contas…",
  list_posts: "Consultando os posts…",
  schedule_post: "Agendando o post…",
  publish_post_now: "Publicando…",
  cancel_post: "Cancelando o post…",
  list_brands: "Consultando suas marcas…",
  get_brand_kit: "Lendo o brand kit…",
  set_active_brand: "Trocando a marca…",
};

type MenuItem = { id: string; label: string; hint: string; pick: () => void };

// The page remounts this (key = conversation id) whenever another conversation is opened.
export function ChatPanel({
  skills = [],
  brands = [],
  initialMessages = [],
  initialApprovals = [],
}: {
  skills?: SkillOption[];
  brands?: BrandOption[];
  initialMessages?: Message[];
  initialApprovals?: Approval[];
}) {
  const router = useRouter();
  const conversationId = useSearchParams().get("c") ?? undefined;
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [media, setMedia] = useState<UploadedMedia[]>([]);
  // Brands picked in the "@" menu; only those still named in the text are sent.
  const [picked, setPicked] = useState<BrandOption[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>(initialApprovals);
  const [decisions, setDecisions] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState(false);
  // The reply as it streams in, or what the agent is doing while no text has arrived yet.
  const [draft, setDraft] = useState({ text: "", status: "Pensando…" });
  const [active, setActive] = useState(0);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  // "/" at the start of a word opens the skill menu and "@" the brand menu, filtered by what follows.
  const open = dismissed !== input;
  const slash = input.match(/(?:^|\s)\/([\w-]*)$/);
  const brandQuery = open ? mentionQuery(input) : null;
  const menu: { id: string; label: string; items: MenuItem[] } | null =
    slash && open
      ? {
          id: "skill-menu",
          label: "Skills",
          items: skills
            .filter((s) => s.name.startsWith(slash[1].toLowerCase()))
            .map((s) => ({ id: `skill-${s.name}`, label: `/${s.name}`, hint: s.description, pick: () => pickSkill(s.name) })),
        }
      : brandQuery !== null
        ? {
            id: "brand-menu",
            label: "Marcas",
            items: filterBrands(brands, brandQuery).map((b) => ({
              id: `brand-${b.id}`,
              label: b.name,
              hint: b.organizationName,
              pick: () => pickBrand(b),
            })),
          }
        : null;
  const items = menu?.items ?? [];
  const highlighted = Math.min(active, items.length - 1);

  function pickSkill(name: string) {
    setInput(`${input.slice(0, input.length - (slash?.[1].length ?? 0) - 1)}/${name} `);
    setActive(0);
  }

  function pickBrand(brand: BrandOption) {
    setInput(insertMention(input, brand));
    setPicked((p) => [...p, brand]);
    setActive(0);
  }

  // Braces matter: scrollIntoView returns a Promise in recent browsers, and an effect may only
  // return a cleanup function.
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, approvals, pending, draft]);

  // A tool call starts a new model turn, so text streamed before it was not the final reply.
  function progress(event: ChatProgress) {
    setDraft((d) =>
      event.type === "delta"
        ? { ...d, text: d.text + event.text }
        : { text: "", status: TOOL_STATUS[event.name] ?? "Trabalhando…" },
    );
  }

  function chat(path: string, body: unknown) {
    setDraft({ text: "", status: "Pensando…" });
    return apiStream<ChatResponse, ChatProgress>(path, body, progress);
  }

  function handle(res: ChatResponse) {
    const media = res.status === "done" ? res.media : [];
    setMessages((m) => [...m, { role: "assistant", text: res.reply, ...(media.length ? { media } : {}) }]);
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
    const brandIds = mentionedIds(message, picked);
    setInput("");
    setMedia([]);
    setPicked([]);
    setMessages((m) => [
      ...m,
      { role: "user", text: mediaIds.length ? `${message}\n📎 ${mediaIds.length} mídia(s)` : message },
    ]);
    setPending(true);
    try {
      handle(await chat("/api/chat", { conversationId, message, mediaIds, brandIds }));
    } catch (err) {
      toast.error((err as Error).message);
      setMessages((m) => m.slice(0, -1));
      setInput(message);
      setMedia(media);
      setPicked(picked);
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
        await chat("/api/chat/approvals", {
          conversationId,
          decisions: approvals.map((a) => ({ id: a.id, approve: next[a.id] })),
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

      {/* aria-busy: screen readers wait for the whole reply instead of reading every streamed piece. */}
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto" aria-live="polite" aria-busy={pending}>
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Diga o segmento do seu negócio e o formato (vídeo curto ou post estático) para receber
            um roteiro. Digite / para escolher uma skill e @ para usar o brand kit de uma marca. Sem
            marca cadastrada, anexe seu logo para extrair as cores e a identidade visual. Para agendar, anexe a imagem ou o vídeo e diga quando publicar.
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
            {m.media && <MediaGrid media={m.media} />}
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
        {pending &&
          (draft.text ? (
            <div className="mr-auto max-w-[85%] rounded-lg bg-muted px-3 py-2 text-sm whitespace-pre-wrap">
              {draft.text}
              <span className="ml-0.5 inline-block animate-pulse" aria-hidden>
                ▍
              </span>
            </div>
          ) : (
            <p className="animate-pulse text-sm text-muted-foreground">{draft.status}</p>
          ))}
        <div ref={bottom} />
      </div>

      <form onSubmit={send} className="grid gap-2">
        {blocked && (
          <p className="text-sm text-muted-foreground">Confirme ou recuse a ação acima para continuar.</p>
        )}
        <div className="flex gap-2">
          <div className="relative flex-1">
            {menu && items.length > 0 && (
              <ul
                id={menu.id}
                role="listbox"
                aria-label={menu.label}
                className="absolute bottom-full left-0 z-10 mb-1 grid max-h-64 w-full max-w-md gap-0.5 overflow-y-auto rounded-md border bg-popover p-1 text-sm shadow-md"
              >
                {items.map((item, i) => (
                  <li
                    key={item.id}
                    id={item.id}
                    role="option"
                    aria-selected={i === highlighted}
                    className={`cursor-pointer rounded px-2 py-1.5 ${i === highlighted ? "bg-muted" : ""}`}
                    onMouseDown={(e) => {
                      e.preventDefault(); // keep focus in the textarea
                      item.pick();
                    }}
                  >
                    <span className="font-medium">{item.label}</span>
                    <span className="block text-xs text-muted-foreground">{item.hint}</span>
                  </li>
                ))}
              </ul>
            )}
            {menu?.id === "brand-menu" && brands.length === 0 && (
              <p className="absolute bottom-full left-0 z-10 mb-1 rounded-md border bg-popover p-2 text-sm shadow-md">
                Nenhuma marca cadastrada.{" "}
                <Link href="/empresas" className="underline">
                  Cadastre em Empresas.
                </Link>
              </p>
            )}
            <Textarea
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (items.length > 0) {
                  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                    e.preventDefault();
                    const step = e.key === "ArrowDown" ? 1 : -1;
                    setActive((highlighted + step + items.length) % items.length);
                    return;
                  }
                  if (e.key === "Enter" || e.key === "Tab") {
                    e.preventDefault();
                    items[highlighted].pick();
                    return;
                  }
                  if (e.key === "Escape") {
                    setDismissed(input);
                    return;
                  }
                }
                if (e.key === "Enter" && !e.shiftKey) send(e);
              }}
              placeholder="Escreva sua mensagem… (/ para skill, @ para marca)"
              aria-label="Mensagem"
              role="combobox"
              aria-expanded={items.length > 0}
              aria-controls={menu?.id ?? "skill-menu"}
              aria-autocomplete="list"
              aria-activedescendant={items.length > 0 ? items[highlighted].id : undefined}
              maxLength={4000}
              rows={2}
              disabled={blocked}
            />
          </div>
          <Button type="submit" disabled={pending || blocked || !input.trim()}>
            Enviar
          </Button>
        </div>
        <MediaUploader value={media} onChange={setMedia} disabled={pending || blocked} />
      </form>
    </div>
  );
}

// Media the agent generated. URLs are signed and short-lived; reopening the chat signs them again.
// Images open in a dialog inside the app (not a new tab), so "Voltar"/Esc returns to the chat.
function MediaGrid({ media }: { media: MessageMedia[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const current = open === null ? null : media[open];
  return (
    <>
      <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {media.map((m, i) => (
          <li key={m.id}>
            {m.kind === "image" ? (
              <button type="button" className="block w-full" onClick={() => setOpen(i)} aria-label={`Ampliar arte ${i + 1}`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- signed Blob URL, not optimizable */}
                <img src={m.url} alt={`Arte ${i + 1}`} className="aspect-[4/5] w-full rounded-md object-cover" />
              </button>
            ) : (
              <video src={m.url} controls playsInline className="aspect-[9/16] w-full rounded-md bg-black" />
            )}
          </li>
        ))}
      </ul>

      <Dialog open={current !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-h-[95vh] sm:max-w-3xl" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Arte {open !== null && open + 1}</DialogTitle>
          </DialogHeader>
          {current && (
            // eslint-disable-next-line @next/next/no-img-element -- signed Blob URL, not optimizable
            <img src={current.url} alt={`Arte ${open! + 1}`} className="max-h-[70vh] w-full rounded-md object-contain" />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(null)}>
              Voltar
            </Button>
            {current && (
              <a href={current.url} target="_blank" rel="noreferrer" className={buttonVariants()}>
                Abrir original
              </a>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
