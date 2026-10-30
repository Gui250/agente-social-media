import { KeyRound, Megaphone } from "lucide-react";
import Link from "next/link";
import { LogoutButton } from "@/components/auth/logout-button";
import { NavLinks } from "@/components/shell/nav-links";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <nav className="mx-auto flex h-14 max-w-6xl items-center gap-1 overflow-x-auto px-4">
          <Link href="/chat" className="mr-3 flex items-center gap-2 font-semibold tracking-tight whitespace-nowrap">
            <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
              <Megaphone className="size-4" strokeWidth={1.75} aria-hidden />
            </span>
            Social Media IA
          </Link>
          <NavLinks />
          <div className="ml-auto flex items-center gap-1 pl-2">
            <Link
              href="/senha"
              aria-label="Alterar senha"
              title="Alterar senha"
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <KeyRound className="size-4" strokeWidth={1.75} aria-hidden />
              <span className="hidden lg:inline">Alterar senha</span>
            </Link>
            <LogoutButton />
          </div>
        </nav>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6">{children}</main>
    </div>
  );
}
