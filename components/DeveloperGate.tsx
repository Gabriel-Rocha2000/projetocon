"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { isDeveloperSession } from "@/lib/developerMode";

/** Interface convenience only; Firestore rules independently enforce admin writes. */
export default function DeveloperGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [access, setAccess] = useState<"checking" | "allowed" | "denied">("checking");
  useEffect(() => {
    let cancelled = false;
    setAccess("checking");
    if (loading) return;
    if (!user || !isDeveloperSession(user.uid)) {
      setAccess("denied");
      router.replace("/configuracoes");
      return;
    }
    // Force token refresh so a recently assigned/revoked admin claim takes effect.
    user.getIdTokenResult(true).then(token => {
      if (cancelled) return;
      const isAdmin = token.claims.admin === true;
      setAccess(isAdmin ? "allowed" : "denied");
      if (!isAdmin) router.replace("/configuracoes");
    }).catch(() => {
      if (!cancelled) {
        setAccess("denied");
        router.replace("/configuracoes");
      }
    });
    return () => { cancelled = true; };
  }, [loading, user, router]);
  if (loading || access === "checking") return <div className="panel emptyState">Verificando permissão de administrador...</div>;
  if (access !== "allowed") return <div className="panel emptyState">Acesso restrito ao administrador.</div>;
  return <>{children}</>;
}
