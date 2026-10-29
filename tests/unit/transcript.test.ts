import type { AgentInputItem } from "@openai/agents";
import { describe, expect, it } from "vitest";
import { toMessages } from "@/agent/transcript";

describe("toMessages", () => {
  it("keeps user/assistant text, drops tool items and empty messages", () => {
    const history = [
      { role: "user", content: "Roteiro para padaria\n\n[mídias anexadas: a, b]" },
      { type: "function_call", callId: "1", name: "list_posts", arguments: "{}" },
      { type: "function_call_result", callId: "1", name: "list_posts", status: "completed", output: "[]" },
      { role: "assistant", status: "completed", content: [] },
      { role: "assistant", status: "completed", content: [{ type: "output_text", text: "Aqui está." }] },
    ] as unknown as AgentInputItem[];

    expect(toMessages(history)).toEqual([
      { role: "user", text: "Roteiro para padaria\n📎 2 mídia(s)" },
      { role: "assistant", text: "Aqui está." },
    ]);
  });
});
