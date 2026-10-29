import type { AgentInputItem } from "@openai/agents";

export type Message = { role: "user" | "assistant"; text: string };

// Matches the suffix chat.sendMessage appends when media is attached.
const MEDIA = /\n\n\[mídias anexadas: ([^\]]*)\]$/;

function text(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((part) => (typeof part?.text === "string" ? part.text : "")).join("");
}

// Agent history → chat bubbles: only user/assistant text, tool calls and results are skipped.
export function toMessages(history: AgentInputItem[]): Message[] {
  return history.flatMap((item): Message[] => {
    if (!("role" in item) || (item.role !== "user" && item.role !== "assistant")) return [];
    let body = text(item.content).trim();
    if (item.role === "user") {
      body = body.replace(MEDIA, (_, ids: string) => `\n📎 ${ids.split(",").length} mídia(s)`);
    }
    return body ? [{ role: item.role, text: body }] : [];
  });
}
