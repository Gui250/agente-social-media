import "server-only";
import { type AgentInputItem, RunState, run, user } from "@openai/agents";
import { after } from "next/server";
import { socialMediaAgent } from "@/agent/agent";
import { summarize } from "@/agent/approval-summary";
import { listSkills } from "@/agent/skills";
import { summarizeConversation } from "@/agent/summarizer";
import type { AgentContext } from "@/agent/context";
import { type Message, type MessageMedia, toMessages } from "@/agent/transcript";
import * as brands from "@/controllers/brands";
import { previews } from "@/controllers/media";
import { DomainError } from "@/lib/errors";
import { listAccounts } from "@/models/account";
import {
  clearPending,
  getOrCreateConversation,
  saveHistory,
  setConversationBrand,
  setPending,
  setSummary,
} from "@/models/conversation";
import { getProfile } from "@/models/profile";

export type SkillOption = { name: string; description: string };
export type Approval = { id: string; tool: string; summary: string };
// While the agent runs: its reply text as it's written, and the tools it calls.
export type ChatProgress = { type: "delta"; text: string } | { type: "tool"; name: string };
type Emit = (event: ChatProgress) => void;
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

// Streams the run so the chat can show the reply being typed; the result is the same as run()'s.
async function runAgent(
  input: AgentInputItem[] | RunState<unknown, typeof socialMediaAgent>,
  context: AgentContext,
  emit?: Emit,
) {
  const result = await run(socialMediaAgent, input, { ...runOptions(context), stream: true });
  for await (const event of result) {
    if (event.type === "raw_model_stream_event" && event.data.type === "output_text_delta") {
      emit?.({ type: "delta", text: event.data.delta });
    } else if (event.type === "run_item_stream_event" && event.name === "tool_called") {
      emit?.({ type: "tool", name: (event.item.rawItem as { name?: string }).name ?? "" });
    }
  }
  await result.completed; // rejects with the run's error
  return result;
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
    brandId: conversation.brand_id,
  };
  return { conversation, context };
}

async function approvalsFor(context: AgentContext, interruptions: Interruption[]): Promise<Approval[]> {
  const [accounts, kit] = await Promise.all([
    listAccounts(context.userId),
    brands.activeKit(context.userId, context.brandId),
  ]);
  return interruptions.map((i) => ({
    id: callId(i),
    tool: i.name ?? "",
    summary: summarize(i.name ?? "", i.arguments, { timezone: context.timezone, accounts, brandName: kit?.name }),
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
  input: { conversationId?: string; message: string; mediaIds?: string[]; brandIds?: string[] },
  emit?: Emit,
): Promise<ChatResponse> {
  const { conversation, context } = await contextFor(userId, input.conversationId);
  if (conversation.pending_state) {
    throw new DomainError(
      "approval_pending",
      "Confirme ou recuse a ação pendente antes de enviar outra mensagem.",
      409,
    );
  }

  // Only the user's own brands survive; others are dropped without saying they exist.
  const mentioned = input.brandIds?.length
    ? (await brands.options(userId)).filter((b) => input.brandIds!.includes(b.id))
    : [];
  // One brand becomes the active one; with several the agent asks which (set_active_brand).
  if (mentioned.length === 1) {
    await setConversationBrand(userId, conversation.id, mentioned[0].id);
    context.brandId = mentioned[0].id;
  }

  const markers = [
    input.mediaIds?.length && `[mídias anexadas: ${input.mediaIds.join(", ")}]`,
    ...mentioned.map((b) => `[marca mencionada: ${b.id} — ${b.name} (${b.organizationName})]`),
  ].filter(Boolean);
  const text = markers.length ? `${input.message}\n\n${markers.join("\n")}` : input.message;
  const history: AgentInputItem[] = [...conversation.history, user(text)];
  return finish(context, await runAgent(history, context, emit));
}

export async function approve(
  userId: string,
  input: { conversationId: string; decisions: { id: string; approve: boolean }[] },
  emit?: Emit,
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

  return finish(context, await runAgent(state, context, emit));
}

export { deleteConversation as remove, listConversations } from "@/models/conversation";

// For the "@" menu in the chat.
export const brandOptions = brands.options;

// For the "/" menu in the chat: names and descriptions only, the bodies stay on the server.
export async function skillOptions(userId: string): Promise<SkillOption[]> {
  return (await listSkills(userId)).map(({ name, description }) => ({ name, description }));
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
