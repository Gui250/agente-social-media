import Link from "next/link";
import { LogoutButton } from "@/components/auth/logout-button";

const nav = [
  { href: "/chat", label: "Chat" },
  { href: "/roteiros", label: "Roteiros" },
  { href: "/posts", label: "Posts" },
  { href: "/contas", label: "Contas" },
] as const;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b">
        <nav className="mx-auto flex max-w-5xl items-center gap-1 overflow-x-auto px-4 py-2">
          <span className="mr-3 font-semibold whitespace-nowrap">Social Media IA</span>
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-1.5 text-sm hover:bg-muted"
            >
              {item.label}
            </Link>
          ))}
          <div className="ml-auto flex items-center gap-1">
            <Link href="/senha" className="rounded-md px-3 py-1.5 text-sm whitespace-nowrap hover:bg-muted">
              Alterar senha
            </Link>
            <LogoutButton />
          </div>
        </nav>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col p-4">{children}</main>
    </div>
  );
}
