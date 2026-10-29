"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    const supabase = createClient();
    const { data, error } =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: { data: { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } },
          });
    setPending(false);
    if (error) return setError(translate(error.message));
    if (!data.session) return setError("Conta criada. Confirme seu e-mail para entrar.");
    router.replace("/chat");
    router.refresh();
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{mode === "signin" ? "Entrar" : "Criar conta"}</CardTitle>
        <CardDescription>Agente de Social Media</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              name="password"
              type="password"
              minLength={6}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" disabled={pending}>
            {pending ? "Aguarde…" : mode === "signin" ? "Entrar" : "Criar conta"}
          </Button>
          <Button
            type="button"
            variant="link"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            {mode === "signin" ? "Não tem conta? Criar conta" : "Já tem conta? Entrar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function translate(message: string) {
  if (/invalid login credentials/i.test(message)) return "E-mail ou senha incorretos.";
  if (/already registered/i.test(message)) return "Este e-mail já tem conta. Entre com sua senha.";
  if (/password/i.test(message)) return "Senha inválida: use pelo menos 6 caracteres.";
  return "Não foi possível entrar. Tente de novo.";
}
