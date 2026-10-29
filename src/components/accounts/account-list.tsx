"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/api-client";

type Account = {
  id: string;
  username: string;
  status: "active" | "expired" | "revoked";
  loginType: "instagram" | "facebook";
};

const STATUS = {
  active: { label: "ativa", variant: "secondary" },
  expired: { label: "expirada", variant: "destructive" },
  revoked: { label: "revogada", variant: "destructive" },
} as const;

export function AccountList({ accounts }: { accounts: Account[] }) {
  const router = useRouter();
  const [target, setTarget] = useState<Account | null>(null);
  const [pending, setPending] = useState(false);

  async function disconnect() {
    if (!target) return;
    setPending(true);
    try {
      await api(`/api/accounts/${target.id}`, { method: "DELETE" });
      toast.success(`@${target.username} desconectada.`);
      setTarget(null);
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  if (accounts.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma conta conectada.</p>;
  }

  return (
    <>
      <ul className="grid gap-2">
        {accounts.map((a) => (
          <li key={a.id} className="flex items-center gap-3 rounded-lg border p-3">
            <span className="font-medium">@{a.username}</span>
            <Badge variant={STATUS[a.status].variant}>{STATUS[a.status].label}</Badge>
            <span className="text-xs text-muted-foreground">
              via {a.loginType === "facebook" ? "Facebook" : "Instagram"}
            </span>
            <Button className="ml-auto" variant="outline" size="sm" onClick={() => setTarget(a)}>
              Desconectar
            </Button>
          </li>
        ))}
      </ul>
      <Dialog open={target !== null} onOpenChange={(open) => !open && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desconectar @{target?.username}?</DialogTitle>
            <DialogDescription>
              Posts agendados para esta conta não serão publicados e ficarão como “falhou”.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={disconnect} disabled={pending}>
              Desconectar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
