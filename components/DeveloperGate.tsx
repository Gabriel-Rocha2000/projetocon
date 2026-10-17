"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { isDeveloperSession } from "@/lib/developerMode";

/** A session-level UI gate. Backend authorization must be enforced separately in Firebase rules. */
export default function DeveloperGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    if (loading || !user) return;
    const active = isDeveloperSession(user.uid);
    setAllowed(active);
    if (!active) router.replace("/configuracoes");
  }, [loading, user, router]);
  if (!allowed || !user || loading) return <div className="panel emptyState">Verificando acesso ao Modo Desenvolvedor...</div>;
  return <>{children}</>;
}
