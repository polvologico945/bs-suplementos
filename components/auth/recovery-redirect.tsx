"use client";
import { useEffect } from "react";
import {
  parseRecoveryLink,
  recoveryTarget,
  RECOVERY_PATH,
} from "@/lib/auth/recovery-link";

export function RecoveryRedirect() {
  useEffect(() => {
    const navigate = (event?: Event) => {
      const url = new URL(window.location.href);
      const target = recoveryTarget(url);
      if (target) window.location.replace(target);
      // Um link aberto na mesma aba pode mudar apenas o fragmento, sem remontar
      // React. Reabre a tela para validar essa nova autorização uma única vez.
      // Data: 2026-11-12. @author Carla Evelyn
      else if (
        event &&
        url.pathname === RECOVERY_PATH &&
        parseRecoveryLink(url).kind !== "none"
      )
        window.location.reload();
    };
    navigate();
    window.addEventListener("hashchange", navigate);
    window.addEventListener("popstate", navigate);
    return () => {
      window.removeEventListener("hashchange", navigate);
      window.removeEventListener("popstate", navigate);
    };
  }, []);
  return null;
}
