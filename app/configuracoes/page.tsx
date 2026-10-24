"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { enableDeveloperMode } from "@/lib/developerMode";
import { Code2, BookOpen, ShieldAlert } from "lucide-react";

export default function Configuracoes() {
  const router = useRouter();
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setIsAdmin(false);
    if (!user || !isAdmin) return;
    user.getIdTokenResult(true).then(token => {
      if (!cancelled) setIsAdmin(token.claims.admin === true);
    }).catch(() => { if (!cancelled) setIsAdmin(false); });
    return () => { cancelled = true; };
  }, [user]);
  function entrar() {
    if (!user) return;
    if (!window.confirm("Entrar no Modo Desenvolvedor? Alterações podem modificar os conteúdos de estudo. Dados existentes não serão excluídos ao entrar.")) return;
    enableDeveloperMode(user.uid);
    router.push("/desenvolvedor");
  }
  return <AppShell>
    <div className="pageHeader"><div><h1>Configurações</h1><p className="muted">Personalize sua experiência no Concurseiro CLT.</p></div></div>
    <section className="panel devSettingsPanel">
      <div className="devIntroIcon"><BookOpen size={23}/></div>
      <div><h2>Modo Estudos</h2><p className="muted">A interface principal continua dedicada à teoria, questões, simulados e revisões, sem botões administrativos.</p></div>
    </section>
    {isAdmin && <section className="panel devSettingsPanel">
      <div className="devIntroIcon"><Code2 size={23}/></div>
      <div className="devSettingsInfo">
        <h2>Modo Desenvolvedor</h2>
        <p className="muted">Gerencie Mapa-Mestre, microblocos, materiais, questões e vínculos em um ambiente separado. Volte aos estudos com um clique.</p>
        <div className="devSafetyNote"><ShieldAlert size={17}/><span>Esta opção separa as interfaces, mas <strong>não substitui permissões de administrador no Firebase</strong>. Antes de permitir outros usuários, restrinja as regras de escrita.</span></div>
        <button className="actionButton" onClick={entrar}>Entrar no Modo Desenvolvedor</button>
      </div>
    </section>}
  </AppShell>;
}
