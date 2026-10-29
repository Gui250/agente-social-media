import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError } from "@/lib/errors";

const calls: string[] = [];
const conversation = {
  id: "c1",
  user_id: "u1",
  history: [],
  pending_state: "STATE" as string | null,
  pending_approval_ids: ["call-1"],
};
const interruption = { rawItem: { callId: "call-1" }, name: "schedule_post", arguments: "{}" };
const state = {
  getInterruptions: () => [interruption],
  approve: vi.fn(() => calls.push("approve")),
  reject: vi.fn(() => calls.push("reject")),
};

vi.mock("@/agent/agent", () => ({ socialMediaAgent: {} }));
vi.mock("@/models/profile", () => ({ getProfile: async () => ({ timezone: "America/Sao_Paulo" }) }));
vi.mock("@/models/account", () => ({ listAccounts: async () => [] }));
vi.mock("@/models/conversation", () => ({
  getOrCreateConversation: vi.fn(async (userId: string) => {
    if (userId !== "u1") throw new DomainError("not_found", "Conversa não encontrada.", 404);
    return conversation;
  }),
  clearPending: vi.fn(async () => calls.push("clearPending")),
  setPending: vi.fn(),
  saveHistory: vi.fn(),
  setSummary: vi.fn(async (_id: string, summary: string) => calls.push(`setSummary:${summary}`)),
}));
// Runs after() callbacks once the test awaits them, like Next does after the response.
const afterQueue: (() => Promise<void>)[] = [];
vi.mock("next/server", () => ({ after: (fn: () => Promise<void>) => afterQueue.push(fn) }));
vi.mock("@/agent/summarizer", () => ({ summarizeConversation: async () => "Agendamento de post" }));
vi.mock("@openai/agents", () => ({
  RunState: { fromString: vi.fn(async () => state) },
  run: vi.fn(async () => {
    calls.push("run");
    return {
      interruptions: [],
      history: [],
      finalOutput: "Pronto.",
      completed: Promise.resolve(),
      async *[Symbol.asyncIterator]() {
        yield { type: "raw_model_stream_event", data: { type: "output_text_delta", delta: "Pro" } };
        yield { type: "run_item_stream_event", name: "tool_called", item: { rawItem: { name: "schedule_post" } } };
      },
    };
  }),
  user: (t: string) => t,
}));

const { approve } = await import("@/controllers/chat");

async function status(p: Promise<unknown>) {
  try {
    await p;
    return 200;
  } catch (e) {
    return (e as DomainError).status;
  }
}

describe("chat.approve", () => {
  beforeEach(() => {
    calls.length = 0;
    conversation.pending_state = "STATE";
    conversation.pending_approval_ids = ["call-1"];
    state.approve.mockClear();
    state.reject.mockClear();
  });

  it("409 when nothing is pending", async () => {
    conversation.pending_state = null;
    expect(await status(approve("u1", { conversationId: "c1", decisions: [{ id: "call-1", approve: true }] }))).toBe(409);
  });

  it("409 when decision ids differ from the pending ones", async () => {
    expect(await status(approve("u1", { conversationId: "c1", decisions: [{ id: "other", approve: true }] }))).toBe(409);
    expect(await status(approve("u1", { conversationId: "c1", decisions: [] }))).toBe(409);
  });

  it("404 for another user's conversation", async () => {
    expect(await status(approve("u2", { conversationId: "c1", decisions: [{ id: "call-1", approve: true }] }))).toBe(404);
  });

  it("clears the pending state before resuming (no replay)", async () => {
    await approve("u1", { conversationId: "c1", decisions: [{ id: "call-1", approve: true }] });
    expect(calls).toEqual(["clearPending", "approve", "run"]);
    expect(state.approve).toHaveBeenCalledWith(interruption);
  });

  it("saves the conversation summary after the reply", async () => {
    await approve("u1", { conversationId: "c1", decisions: [{ id: "call-1", approve: true }] });
    expect(calls).not.toContain("setSummary:Agendamento de post"); // not before the response
    await Promise.all(afterQueue.splice(0).map((fn) => fn()));
    expect(calls.at(-1)).toBe("setSummary:Agendamento de post");
  });

  it("emits the reply text and the tools called while the run streams", async () => {
    const events: unknown[] = [];
    await approve("u1", { conversationId: "c1", decisions: [{ id: "call-1", approve: true }] }, (e) => events.push(e));
    expect(events).toEqual([{ type: "delta", text: "Pro" }, { type: "tool", name: "schedule_post" }]);
  });

  it("rejects when the user declines", async () => {
    const res = await approve("u1", { conversationId: "c1", decisions: [{ id: "call-1", approve: false }] });
    expect(state.reject).toHaveBeenCalledWith(interruption, { message: "O usuário recusou." });
    expect(state.approve).not.toHaveBeenCalled();
    expect(res.status).toBe("done");
  });
});
