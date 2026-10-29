import "server-only";
import { connection } from "next/server";
import type { z } from "zod";
import { currentUser } from "@/lib/auth";
import { DomainError } from "@/lib/errors";
import type { SessionUser } from "@/models/user";

export type Ctx<B> = { user: SessionUser; body: B; req: Request };
type Body<S> = S extends z.ZodType ? z.infer<S> : undefined;

export function errorResponse(e: unknown) {
  if (e instanceof DomainError) {
    return Response.json({ error: { code: e.code, message: e.message } }, { status: e.status });
  }
  console.error(e);
  return Response.json(
    { error: { code: "internal", message: "Algo deu errado. Tente de novo." } },
    { status: 500 },
  );
}

async function parseBody(req: Request, schema: z.ZodType | undefined) {
  if (!schema) return undefined;
  const json = await req.json().catch(() => undefined);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new DomainError(
      "invalid_input",
      `Dados inválidos${issue?.path.length ? ` em "${issue.path.join(".")}"` : ""}: ${issue?.message}`,
    );
  }
  return parsed.data;
}

function toResponse(result: unknown, status = 200) {
  if (result === undefined) return new Response(null, { status: 204 });
  if (result instanceof Response) return result;
  return Response.json(result, { status });
}

// Thin route wrapper: session (401), body validation (400), DomainError mapping.
export function route<S extends z.ZodType | undefined = undefined, P = unknown>(
  handler: (ctx: Ctx<Body<S>>, params: P) => Promise<unknown>,
  opts: { body?: S; status?: number } = {},
) {
  return async (req: Request, routeCtx: { params: Promise<P> }) => {
    // Outside the try: Next rejects this during prerendering, and that must not become a 500.
    await connection();
    try {
      const user = await currentUser();
      if (!user) throw new DomainError("unauthorized", "Faça login para continuar.", 401);
      const body = await parseBody(req, opts.body);
      const result = await handler({ user, body: body as never, req }, (await routeCtx?.params) as P);
      return toResponse(result, opts.status);
    } catch (e) {
      return errorResponse(e);
    }
  };
}

// Streams a long task as NDJSON, one JSON event per line: whatever `work` emits while it runs,
// then {type:"done", response} or {type:"error", message}. The status is already 200 by then, so
// failures travel as the error event (same message errorResponse would send).
export function ndjson<E>(work: (emit: (event: E) => void) => Promise<unknown>) {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        send({ type: "done", response: await work(send) });
      } catch (e) {
        const { error } = await errorResponse(e).json();
        send({ type: "error", message: error.message });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(body, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache, no-transform" },
  });
}

// Same, without a session: login and sign-up.
export function publicRoute<S extends z.ZodType>(handler: (body: z.infer<S>) => Promise<unknown>, opts: { body: S }) {
  return async (req: Request) => {
    await connection();
    try {
      return toResponse(await handler((await parseBody(req, opts.body)) as z.infer<S>));
    } catch (e) {
      return errorResponse(e);
    }
  };
}
