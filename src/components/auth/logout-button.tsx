"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";

export function LogoutButton() {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-muted-foreground"
      onClick={async () => {
        await api("/api/auth/logout", { method: "POST" });
        router.replace("/login");
        router.refresh();
      }}
    >
      <LogOut strokeWidth={1.75} aria-hidden />
      Sair
    </Button>
  );
}
