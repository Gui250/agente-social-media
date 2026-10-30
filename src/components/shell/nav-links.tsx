"use client";

import {
  AtSign,
  Building2,
  CalendarClock,
  FileText,
  type LucideIcon,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { cn } from "@/lib/utils";

const nav: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/empresas", label: "Empresas", icon: Building2 },
  { href: "/chat", label: "Chat", icon: MessageCircle },
  { href: "/roteiros", label: "Roteiros", icon: FileText },
  { href: "/skills", label: "Skills", icon: Sparkles },
  { href: "/posts", label: "Posts", icon: CalendarClock },
  { href: "/contas", label: "Contas", icon: AtSign },
];

// The pathname is only known at request time, so prerendering shows the links without highlight.
export function NavLinks() {
  return (
    <Suspense fallback={<Links pathname={null} />}>
      <CurrentLinks />
    </Suspense>
  );
}

function CurrentLinks() {
  return <Links pathname={usePathname()} />;
}

function Links({ pathname }: { pathname: string | null }) {
  return nav.map(({ href, label, icon: Icon }) => {
    const active = !!pathname && (pathname === href || pathname.startsWith(`${href}/`));
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm whitespace-nowrap text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
          active && "bg-accent font-medium text-accent-foreground hover:bg-accent hover:text-accent-foreground",
        )}
      >
        <Icon className="size-4" strokeWidth={1.75} aria-hidden />
        {label}
      </Link>
    );
  });
}
