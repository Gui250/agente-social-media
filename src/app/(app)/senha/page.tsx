import { ChangePasswordForm } from "@/components/auth/change-password-form";

export default function SenhaPage() {
  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Senha</h1>
      <ChangePasswordForm />
    </div>
  );
}
