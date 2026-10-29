import { ChangePasswordForm } from "@/components/auth/change-password-form";

export default function SenhaPage() {
  return (
    <div className="grid gap-4">
      <h1 className="text-lg font-semibold">Senha</h1>
      <ChangePasswordForm />
    </div>
  );
}
