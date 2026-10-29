import "server-only";
import { Agent, type AgentInputItem, run } from "@openai/agents";
import { toMessages } from "./transcript";

const MAX_INPUT = 4000;

const summarizer = new Agent({
  name: "Resumidor",
  instructions: `Você dá nome a conversas de um agente de social media para Instagram.
Responda só com um resumo do assunto da conversa, em português do Brasil, com no máximo 8 palavras,
sem aspas e sem ponto final. Ex.: Roteiro de Reels para clínica odontológica`,
  model: process.env.OPENAI_MODEL || undefined,
});

// Newest messages win: they say what the conversation is about now.
export async function summarizeConversation(history: AgentInputItem[]): Promise<string | null> {
  let transcript = "";
  for (const m of toMessages(history).reverse()) {
    const line = `${m.role === "user" ? "Usuário" : "Agente"}: ${m.text}\n`;
    if (transcript.length + line.length > MAX_INPUT) break;
    transcript = line + transcript;
  }
  if (!transcript) return null;
  const result = await run(summarizer, transcript, { maxTurns: 1 });
  const summary = String(result.finalOutput ?? "").trim().replace(/^["“']|["”'.]$/g, "").slice(0, 80);
  return summary || null;
}
