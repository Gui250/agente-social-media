import "server-only";
import { Agent } from "@openai/agents";
import type { AgentContext } from "./context";
import { instructions } from "./instructions";
import { tools } from "./tools";

export const socialMediaAgent = new Agent<AgentContext>({
  name: "Agente de Social Media",
  instructions,
  model: process.env.OPENAI_MODEL || undefined,
  tools,
});
