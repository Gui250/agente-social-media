import type { AgentInputItem } from "@openai/agents";

export type MessageMedia = { id: string; kind: "image" | "video"; url: string };
// mediaIds come from the history; the chat controller turns them into signed `media` URLs.
export type Message = { role: "user" | "assistant"; text: string; mediaIds?: string[]; media?: MessageMedia[] };

// Matches the suffix chat.sendMessage appends when media is attached.
const MEDIA = /\n\n\[mídias anexadas: ([^\]]*)\]$/;
// Tools whose results carry media made by the agent (generate_creative_media, list_generations).
const MEDIA_TOOLS = new Set(["generate_creative_media", "list_generations"]);

function text(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((part) => (typeof part?.text === "string" ? part.text : "")).join("");
}

// `{ mediaIds: [...] }` or `[{ mediaId }, ...]`; anything else (e.g. "Erro: ...") has none.
function mediaIdsIn(output: unknown): string[] {
  let value: unknown;
  try {
    value = JSON.parse(text(typeof output === "object" && output && "text" in output ? output.text : output));
  } catch {
    return [];
  }
  if (Array.isArray(value)) return value.flatMap((v) => (typeof v?.mediaId === "string" ? [v.mediaId] : []));
  const ids = (value as { mediaIds?: unknown })?.mediaIds;
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
}

// Agent history → chat bubbles: only user/assistant text. Media produced by tools is attached to
// the assistant message that follows them.
export function toMessages(history: AgentInputItem[]): Message[] {
  const messages: Message[] = [];
  let pendingMedia: string[] = [];
  for (const item of history) {
    if ("type" in item && item.type === "function_call_result" && MEDIA_TOOLS.has(item.name)) {
      pendingMedia.push(...mediaIdsIn(item.output));
      continue;
    }
    if (!("role" in item) || (item.role !== "user" && item.role !== "assistant")) continue;
    let body = text(item.content).trim();
    if (item.role === "user") {
      body = body.replace(MEDIA, (_, ids: string) => `\n📎 ${ids.split(",").length} mídia(s)`);
    }
    if (!body) continue;
    const message: Message = { role: item.role, text: body };
    if (item.role === "assistant" && pendingMedia.length) {
      message.mediaIds = [...new Set(pendingMedia)];
      pendingMedia = [];
    }
    messages.push(message);
  }
  return messages;
}
