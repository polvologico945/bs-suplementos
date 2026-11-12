import type { Metadata } from "next";
import { PasswordRecovery } from "@/components/auth/password-recovery";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Alterar senha | BS Suplementos",
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return <PasswordRecovery />;
}
