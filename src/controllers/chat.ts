import "server-only";
import { type AgentInputItem, RunState, run, user } from "@openai/agents";
import type { SupabaseClient } from "@supabase/supabase-js";
import { socialMediaAgent } from "@/agent/agent";
import { summarize } from "@/agent/approval-summary";
import type { AgentContext } from "@/agent/context";
import { DomainError } from "@/lib/errors";
import { listAccounts } from "@/models/account";
import {
  clearPending,
  getOrCreateConversation,
  saveHistory,
  setPending,
} from "@/models/conversation";
import { getProfile } from "@/models/profile";

export type Approval = { id: string; tool: string; summary: string };
export type ChatResponse =
  | { conversationId: string; status: "done"; reply: string }
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

async function contextFor(supabase: SupabaseClient, userId: string, conversationId?: string) {
  const [profile, conversation] = await Promise.all([
    getProfile(supabase, userId),
    getOrCreateConversation(supabase, userId, conversationId),
  ]);
  const context: AgentContext = {
    userId,
    timezone: profile.timezone,
    conversationId: conversation.id,
  };
  return { conversation, context };
}

// A paused run (tool needs approval) is stored server-side; only the call ids reach the client.
async function finish(
  supabase: SupabaseClient,
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
    const accounts = await listAccounts(supabase);
    const approvals = interruptions.map((i) => ({
      id: callId(i),
      tool: i.name ?? "",
      summary: summarize(i.name ?? "", i.arguments, { timezone: context.timezone, accounts }),
    }));
    await setPending(
      supabase,
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
  await saveHistory(supabase, conversationId, result.history);
  return { conversationId, status: "done", reply: String(result.finalOutput ?? "") };
}

export async function sendMessage(
  supabase: SupabaseClient,
  userId: string,
  input: { conversationId?: string; message: string; mediaIds?: string[] },
): Promise<ChatResponse> {
  const { conversation, context } = await contextFor(supabase, userId, input.conversationId);
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
  return finish(supabase, context, result);
}

export async function approve(
  supabase: SupabaseClient,
  userId: string,
  input: { conversationId: string; decisions: { id: string; approve: boolean }[] },
): Promise<ChatResponse> {
  const { conversation, context } = await contextFor(supabase, userId, input.conversationId);
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
  await clearPending(supabase, conversation.id);
  const state = await RunState.fromString(socialMediaAgent, conversation.pending_state);
  const byId = new Map(input.decisions.map((d) => [d.id, d.approve]));
  for (const interruption of state.getInterruptions()) {
    if (byId.get(callId(interruption as Interruption))) state.approve(interruption);
    else state.reject(interruption, { message: "O usuário recusou." });
  }

  const result = await run(socialMediaAgent, state, runOptions(context));
  return finish(supabase, context, result);
}
