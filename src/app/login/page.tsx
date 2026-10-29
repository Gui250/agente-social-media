import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
      <LoginForm />
      <Link href="/privacidade" className="text-xs text-muted-foreground underline">
        Política de Privacidade
      </Link>
    </main>
  );
}
