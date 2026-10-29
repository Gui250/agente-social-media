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

  it("attaches media made by tools to the next assistant message", () => {
    const result = (name: string, value: unknown) => ({
      type: "function_call_result", callId: name, name, status: "completed",
      output: { type: "text", text: typeof value === "string" ? value : JSON.stringify(value) },
    });
    const history = [
      { role: "user", content: "Faça um carrossel" },
      result("generate_creative_script", { id: "s1", mediaIds: ["not-media"] }),
      result("generate_creative_media", { status: "pronto", mediaIds: ["m1", "m2"] }),
      { role: "assistant", status: "completed", content: [{ type: "output_text", text: "Pronto!" }] },
      result("list_generations", [{ mediaId: "m3" }, { mediaId: null }]),
      result("generate_creative_media", "Erro: o gerador falhou"),
      { role: "assistant", status: "completed", content: [{ type: "output_text", text: "Vídeo pronto." }] },
      { role: "assistant", status: "completed", content: [{ type: "output_text", text: "Algo mais?" }] },
    ] as unknown as AgentInputItem[];

    expect(toMessages(history)).toEqual([
      { role: "user", text: "Faça um carrossel" },
      { role: "assistant", text: "Pronto!", mediaIds: ["m1", "m2"] },
      { role: "assistant", text: "Vídeo pronto.", mediaIds: ["m3"] },
      { role: "assistant", text: "Algo mais?" },
    ]);
  });
});
