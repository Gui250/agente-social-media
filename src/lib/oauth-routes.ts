import "server-only";
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { DomainError } from "@/lib/errors";

// Browser redirect back from Instagram/Facebook: always answer with a redirect to /contas.
export function oauthCallback(
  connect: (userId: string, code: string, state: string) => Promise<{ username: string }[]>,
) {
  return async (req: Request) => {
    const url = new URL(req.url);
    const back = (result: { erro?: string; conectada?: string }) => {
      const to = new URL("/contas", url);
      for (const [k, v] of Object.entries(result)) if (v) to.searchParams.set(k, v);
      return NextResponse.redirect(to);
    };

    const user = await currentUser();
    if (!user) return NextResponse.redirect(new URL("/login", url));

    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state) {
      // Meta sends error/error_reason/error_description (or error_code/error_message from the
      // dialog itself) instead of a code when the login fails. No code here, so nothing secret to log.
      const p = url.searchParams;
      const reason = p.get("error_description") ?? p.get("error_message") ?? p.get("error_reason") ?? p.get("error");
      p.delete("code");
      console.error("oauth callback without code", Object.fromEntries(p));
      const errorCode = p.get("error_code");
      return back({
        erro: reason ? `Conexão não concluída: ${reason}${errorCode ? ` (código ${errorCode})` : ""}` : "Conexão cancelada.",
      });
    }
    try {
      const accounts = await connect(user.id, code, state);
      return back({ conectada: accounts.map((a) => `@${a.username}`).join(", ") });
    } catch (e) {
      if (!(e instanceof DomainError)) console.error(e);
      return back({ erro: e instanceof DomainError ? e.message : "Não foi possível conectar a conta." });
    }
  };
}

// Start of the browser flow: redirect to the provider, or back to /contas with a readable error
// (e.g. the login isn't configured) instead of a JSON body the user would see as a raw page.
export function oauthStart(start: () => Promise<string>) {
  return async (req: Request) => {
    const url = new URL(req.url);
    const user = await currentUser();
    if (!user) return NextResponse.redirect(new URL("/login", url));
    try {
      return NextResponse.redirect(await start());
    } catch (e) {
      if (!(e instanceof DomainError)) console.error(e);
      const to = new URL("/contas", url);
      to.searchParams.set("erro", e instanceof DomainError ? e.message : "Não foi possível iniciar a conexão.");
      return NextResponse.redirect(to);
    }
  };
}
