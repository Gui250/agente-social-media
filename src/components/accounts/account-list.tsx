"use client";

import { AlertCircle, AtSign, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
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
  active: { label: "Ativa", icon: CheckCircle2, className: "bg-accent text-accent-foreground" },
  expired: { label: "Expirada", icon: AlertCircle, className: "bg-destructive/10 text-destructive" },
  revoked: { label: "Revogada", icon: AlertCircle, className: "bg-destructive/10 text-destructive" },
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
    return (
      <p className="max-w-md rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
        Nenhuma conta conectada. Conecte uma abaixo para agendar e publicar.
      </p>
    );
  }

  return (
    <>
      <ul className="grid gap-3 md:grid-cols-2">
        {accounts.map((a) => {
          const status = STATUS[a.status];
          return (
            <li key={a.id} className="flex items-center gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                <AtSign className="size-4" strokeWidth={1.75} aria-hidden />
              </span>
              <div className="grid min-w-0 flex-1 gap-1">
                <span className="truncate font-medium">@{a.username}</span>
                <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${status.className}`}>
                    <status.icon className="size-3.5" strokeWidth={2} aria-hidden />
                    {status.label}
                  </span>
                  via {a.loginType === "facebook" ? "Facebook" : "Instagram"}
                </span>
                {a.status !== "active" && (
                  <span className="text-xs text-destructive">Conecte de novo abaixo para voltar a publicar.</span>
                )}
              </div>
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setTarget(a)}>
                Desconectar
              </Button>
            </li>
          );
        })}
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
