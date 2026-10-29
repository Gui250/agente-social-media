"use client";

import { Button } from "@/components/ui/button";
import type { Approval } from "@/controllers/chat";

export function ApprovalCard({
  approval,
  decision,
  disabled,
  onDecide,
}: {
  approval: Approval;
  decision: boolean | undefined;
  disabled: boolean;
  onDecide: (approve: boolean) => void;
}) {
  return (
    <div role="group" aria-label="Confirmação pendente" className="mr-auto grid max-w-[85%] gap-2 rounded-lg border-2 border-primary/40 p-3 text-sm">
      <p className="font-medium">Confirmação necessária</p>
      <p>{approval.summary}</p>
      <div className="flex gap-2">
        <Button size="sm" disabled={disabled || decision !== undefined} onClick={() => onDecide(true)}>
          {decision === true ? "Confirmado" : "Confirmar"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled || decision !== undefined}
          onClick={() => onDecide(false)}
        >
          {decision === false ? "Recusado" : "Recusar"}
        </Button>
      </div>
    </div>
  );
}
