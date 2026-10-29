import "server-only";
import type { User } from "@supabase/supabase-js";
import { connection } from "next/server";
import type { z } from "zod";
import { DomainError } from "@/lib/errors";
import { createClient, type Supabase } from "@/lib/supabase/server";

export type Ctx<B> = { user: User; supabase: Supabase; body: B; req: Request };

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

// Thin route wrapper: session (401), body validation (400), DomainError mapping.
export function route<S extends z.ZodType | undefined = undefined, P = unknown>(
  handler: (
    ctx: Ctx<S extends z.ZodType ? z.infer<S> : undefined>,
    params: P,
  ) => Promise<unknown>,
  opts: { body?: S; status?: number } = {},
) {
  return async (req: Request, routeCtx: { params: Promise<P> }) => {
    // Outside the try: Next rejects this during prerendering, and that must not become a 500.
    await connection();
    try {
      const supabase = await createClient();
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new DomainError("unauthorized", "Faça login para continuar.", 401);

      let body: unknown;
      if (opts.body) {
        const json = await req.json().catch(() => undefined);
        const parsed = opts.body.safeParse(json);
        if (!parsed.success) {
          const issue = parsed.error.issues[0];
          throw new DomainError(
            "invalid_input",
            `Dados inválidos${issue?.path.length ? ` em "${issue.path.join(".")}"` : ""}: ${issue?.message}`,
          );
        }
        body = parsed.data;
      }

      const result = await handler(
        { user: data.user, supabase, body: body as never, req },
        (await routeCtx?.params) as P,
      );
      if (result === undefined) return new Response(null, { status: 204 });
      if (result instanceof Response) return result;
      return Response.json(result, { status: opts.status ?? 200 });
    } catch (e) {
      return errorResponse(e);
    }
  };
}
