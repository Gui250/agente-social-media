"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";

export function ChangePasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const newPassword = String(form.get("newPassword"));
    if (newPassword !== String(form.get("confirm"))) return setError("A confirmação não confere com a nova senha.");
    setError(null);
    setPending(true);
    try {
      await api("/api/auth/password", {
        body: { currentPassword: String(form.get("currentPassword")), newPassword },
      });
      formEl.reset();
      toast.success("Senha alterada. Os outros dispositivos foram desconectados.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Alterar senha</CardTitle>
        <CardDescription>Depois da troca, só este dispositivo continua conectado.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="currentPassword">Senha atual</Label>
            <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" maxLength={128} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="newPassword">Nova senha</Label>
            <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" minLength={8} maxLength={128} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="confirm">Confirmar nova senha</Label>
            <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} maxLength={128} required />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" disabled={pending}>
            {pending ? "Aguarde…" : "Alterar senha"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
