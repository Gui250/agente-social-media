import "server-only";
import { type AgentInputItem, RunState, run, user } from "@openai/agents";
import { after } from "next/server";
import { socialMediaAgent } from "@/agent/agent";
import { summarize } from "@/agent/approval-summary";
import { listSkills } from "@/agent/skills";
import { summarizeConversation } from "@/agent/summarizer";
import type { AgentContext } from "@/agent/context";
import { type Message, type MessageMedia, toMessages } from "@/agent/transcript";
import { previews } from "@/controllers/media";
import { DomainError } from "@/lib/errors";
import { listAccounts } from "@/models/account";
import {
  clearPending,
  getOrCreateConversation,
  saveHistory,
  setPending,
  setSummary,
} from "@/models/conversation";
import { getProfile } from "@/models/profile";

export type SkillOption = { name: string; description: string };
export type Approval = { id: string; tool: string; summary: string };
export type ChatResponse =
  | { conversationId: string; status: "done"; reply: string; media: MessageMedia[] }
  | { conversationId: string; status: "needs_approval"; reply: string; approvals: Approval[] };

const MAX_TURNS = 10;

type Interruption = { rawItem: { callId?: string }; name?: string; arguments?: string };
const callId = (i: Interruption) => i.rawItem.callId ?? "";

function runOptions(context: AgentContext) {
  return {
    context,
    maxTurns: MAX_TURNS,
    groupId: context.conversationId,
    workflowName: "Agente de Social Media",
  };
}

async function contextFor(userId: string, conversationId?: string) {
  const [profile, conversation] = await Promise.all([
    getProfile(userId),
    getOrCreateConversation(userId, conversationId),
  ]);
  const context: AgentContext = {
    userId,
    timezone: profile.timezone,
    conversationId: conversation.id,
  };
  return { conversation, context };
}

async function approvalsFor(context: AgentContext, interruptions: Interruption[]): Promise<Approval[]> {
  const accounts = await listAccounts(context.userId);
  return interruptions.map((i) => ({
    id: callId(i),
    tool: i.name ?? "",
    summary: summarize(i.name ?? "", i.arguments, { timezone: context.timezone, accounts }),
  }));
}

// A paused run (tool needs approval) is stored server-side; only the call ids reach the client.
async function finish(
  context: AgentContext,
  result: {
    interruptions?: unknown[];
    history: AgentInputItem[];
    finalOutput?: unknown;
    state: { toString(): string };
  },
): Promise<ChatResponse> {
  const conversationId = context.conversationId;
  const interruptions = (result.interruptions ?? []) as Interruption[];
  if (interruptions.length > 0) {
    const approvals = await approvalsFor(context, interruptions);
    await setPending(
      conversationId,
      result.state.toString(),
      approvals.map((a) => a.id),
    );
    return {
      conversationId,
      status: "needs_approval",
      reply: "Confira os dados e confirme para continuar.",
      approvals,
    };
  }
  await saveHistory(conversationId, result.history);
  refreshSummary(conversationId, result.history);
  // Media made in this run is attached to the final reply (the last assistant message).
  const last = toMessages(result.history).at(-1);
  const mediaIds = last?.role === "assistant" ? (last.mediaIds ?? []) : [];
  return {
    conversationId,
    status: "done",
    reply: String(result.finalOutput ?? ""),
    media: await previews(context.userId, mediaIds),
  };
}

// After the reply is sent, so the chat never waits on it. Best effort: the history falls back to
// the first message. ponytail: one small model call per reply; only summarize every few turns if
// the cost ever matters.
function refreshSummary(conversationId: string, history: AgentInputItem[]) {
  after(async () => {
    try {
      const summary = await summarizeConversation(history);
      if (summary) await setSummary(conversationId, summary);
    } catch (e) {
      console.error("refreshSummary:", conversationId, e);
    }
  });
}

async function withMedia(userId: string, messages: Message[]): Promise<Message[]> {
  const media = new Map((await previews(userId, messages.flatMap((m) => m.mediaIds ?? []))).map((m) => [m.id, m]));
  return messages.map(({ mediaIds, ...m }) => {
    const found = (mediaIds ?? []).flatMap((id) => media.get(id) ?? []);
    return found.length ? { ...m, media: found } : m;
  });
}

export async function sendMessage(
  userId: string,
  input: { conversationId?: string; message: string; mediaIds?: string[] },
): Promise<ChatResponse> {
  const { conversation, context } = await contextFor(userId, input.conversationId);
  if (conversation.pending_state) {
    throw new DomainError(
      "approval_pending",
      "Confirme ou recuse a ação pendente antes de enviar outra mensagem.",
      409,
    );
  }

  const text = input.mediaIds?.length
    ? `${input.message}\n\n[mídias anexadas: ${input.mediaIds.join(", ")}]`
    : input.message;
  const history: AgentInputItem[] = [...conversation.history, user(text)];
  const result = await run(socialMediaAgent, history, runOptions(context));
  return finish(context, result);
}

export async function approve(
  userId: string,
  input: { conversationId: string; decisions: { id: string; approve: boolean }[] },
): Promise<ChatResponse> {
  const { conversation, context } = await contextFor(userId, input.conversationId);
  const pending = [...conversation.pending_approval_ids].sort();
  const decided = input.decisions.map((d) => d.id).sort();
  if (
    !conversation.pending_state ||
    pending.length !== decided.length ||
    pending.some((id, i) => id !== decided[i])
  ) {
    throw new DomainError(
      "no_matching_approval",
      "Essa confirmação não está mais pendente. Envie a mensagem de novo.",
      409,
    );
  }

  // Clear first: a second request with the same decisions finds nothing pending (no replay).
  await clearPending(conversation.id);
  const state = await RunState.fromString(socialMediaAgent, conversation.pending_state);
  const byId = new Map(input.decisions.map((d) => [d.id, d.approve]));
  for (const interruption of state.getInterruptions()) {
    if (byId.get(callId(interruption as Interruption))) state.approve(interruption);
    else state.reject(interruption, { message: "O usuário recusou." });
  }

  const result = await run(socialMediaAgent, state, runOptions(context));
  return finish(context, result);
}

export { listConversations } from "@/models/conversation";

// For the "/" menu in the chat: names and descriptions only, the bodies stay on the server.
export async function skillOptions(): Promise<SkillOption[]> {
  return (await listSkills()).map(({ name, description }) => ({ name, description }));
}

// Reopening a conversation: a paused run keeps its newest messages in pending_state, not in
// history, so they (and the approval cards) come from the saved RunState.
export async function openConversation(
  userId: string,
  conversationId: string,
): Promise<{ messages: Message[]; approvals: Approval[] }> {
  const { conversation, context } = await contextFor(userId, conversationId);
  if (!conversation.pending_state) {
    return { messages: await withMedia(userId, toMessages(conversation.history)), approvals: [] };
  }
  const state = await RunState.fromString(socialMediaAgent, conversation.pending_state);
  return {
    messages: await withMedia(userId, toMessages(state.history)),
    approvals: await approvalsFor(context, state.getInterruptions() as Interruption[]),
  };
}
