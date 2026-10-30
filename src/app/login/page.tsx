import { Megaphone } from "lucide-react";
import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main className="grid flex-1 md:grid-cols-[1.1fr_1fr]">
      <section className="hidden flex-col justify-between bg-primary p-10 text-primary-foreground md:flex dark:bg-accent dark:text-accent-foreground lg:p-14">
        <span className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid size-8 place-items-center rounded-md bg-current/15">
            <Megaphone className="size-4" strokeWidth={1.75} aria-hidden />
          </span>
          Social Media IA
        </span>
        <div className="grid max-w-md gap-4">
          <h1 className="text-4xl leading-[1.1] font-semibold tracking-tight lg:text-5xl">
            Do roteiro ao post publicado, numa conversa.
          </h1>
          <p className="text-base leading-relaxed opacity-80">
            Peça o criativo no chat, aprove as artes e agende direto no Instagram da sua marca.
          </p>
        </div>
        <Link href="/privacidade" className="w-fit text-xs opacity-70 underline-offset-4 hover:underline">
          Política de Privacidade
        </Link>
      </section>

      <section className="flex flex-col items-center justify-center gap-6 px-4 py-12">
        <span className="flex items-center gap-2 font-semibold tracking-tight md:hidden">
          <span className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground">
            <Megaphone className="size-4" strokeWidth={1.75} aria-hidden />
          </span>
          Social Media IA
        </span>
        <LoginForm />
        <Link href="/privacidade" className="text-xs text-muted-foreground underline md:hidden">
          Política de Privacidade
        </Link>
      </section>
    </main>
  );
}
