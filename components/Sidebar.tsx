"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useContest } from "@/contexts/ContestContext";
import { disableDeveloperMode, getStudyReturnPath } from "@/lib/developerMode";
import {
  LayoutDashboard, CalendarCheck, Trophy, FileText, Map,
  BookOpen, BookText, NotebookPen, ClipboardList, BookOpenCheck,
  Utensils, Scale, Bot, Search, LogOut, Menu, X, ChevronDown,
  Settings, Wrench, FileCheck2, Files, History, ArrowLeft,
} from "lucide-react";

const primaryLinks = [
  ["/dashboard", "Início", LayoutDashboard],
  ["/conteudo", "Conteúdo", BookText],
  ["/questoes", "Questões e simulados", ClipboardList],
  ["/revisao-almoco", "Revisões", CalendarCheck],
  ["/caderno-erros", "Caderno de Erros", BookOpenCheck],
  ["/planejador", "Planejador do Dia", CalendarCheck],
  ["/mapa-mestre", "Mapa-Mestre", Map],
] as const;
const secondaryLinks = [
  ["/buscar", "Busca rápida", Search],
  ["/concursos", "Concursos", Trophy],
  ["/edital", "Edital", FileText],
  ["/registrar-estudo", "Registrar estudo", NotebookPen],
  ["/lei-seca", "Lei Seca", Scale],
  ["/assistente", "Assistente", Bot],
] as const;
const developerLinks = [
  ["/desenvolvedor", "Visão geral", Wrench],
  ["/desenvolvedor/mapa", "Gerenciar Mapa-Mestre", Map],
  ["/desenvolvedor/importar-mapa", "Importar Mapa-Mestre", Files],
  ["/desenvolvedor/conteudos", "Conteúdos e importações", BookText],
  ["/desenvolvedor/questoes", "Gerenciar questões", ClipboardList],
  ["/desenvolvedor/importar-questoes", "Importar questões", Files],
  ["/desenvolvedor/materiais", "PDFs e materiais", FileText],
  ["/desenvolvedor/auditoria", "Auditoria de vínculos", FileCheck2],
  ["/desenvolvedor/seguranca", "Segurança e versões", History],
] as const;

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { contests, activeContestId, selectContest, error: contestError } = useContest();
  const pathname = usePathname();
  const developer = pathname.startsWith("/desenvolvedor");
  const secondaryActive = secondaryLinks.some(([href]) => pathname === href || pathname.startsWith(`${href}/`));
  const router = useRouter();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  async function sair() {
    disableDeveloperMode();
    await logout();
    router.replace("/login");
  }
  function exitDeveloperMode() {
    const destination = getStudyReturnPath();
    disableDeveloperMode();
    router.push(destination);
  }
  const renderLink = ([href, label, Icon]: readonly [string, string, typeof LayoutDashboard]) => (
    <Link key={href} href={href} className={`navlink ${pathname === href || pathname.startsWith(`${href}/`) ? "active" : ""}`}>
      <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
    </Link>
  );
  return <>
    <button className="mobileMenuButton" aria-label="Abrir menu" onClick={() => setOpen(true)}><Menu size={21} /></button>
    {open && <button className="sidebarOverlay" aria-label="Fechar menu" onClick={() => setOpen(false)} />}
    <aside className={`sidebar ${open ? "mobileOpen" : ""}`}>
      <div className="sidebarTopRow">
        <div className="brandCluster"><span className="brandSymbol" aria-hidden="true"><BookOpen size={25} strokeWidth={1.8}/></span><div><div className="brand">Concurseiro CLT</div><div className="subtitle">{developer ? "Modo Desenvolvedor" : "Seu ambiente de estudos"}</div></div></div>
        <button className="mobileSidebarClose" aria-label="Fechar menu" onClick={() => setOpen(false)}><X size={20} /></button>
      </div>
      {developer && <div className="sidebarDevBack"><button className="devReturnButton" onClick={exitDeveloperMode}><ArrowLeft size={17} /> Voltar aos estudos</button></div>}
      <div className="contestPicker">
        <label htmlFor="contestSidebar">CONCURSO ATIVO</label>
        <select id="contestSidebar" value={activeContestId} onChange={e => selectContest(e.target.value)}>
          {contests.length === 0 && <option value={activeContestId}>{contestError ? "Verifique o Firebase" : activeContestId}</option>}
          {contests.map(contest => <option key={contest.id} value={contest.id}>{contest.name}{contest.role ? ` • ${contest.role}` : ""}</option>)}
        </select>
      </div>
      {contestError && <p role="alert" className="sidebarError">{contestError}</p>}
      <nav aria-label={developer ? "Administração da base" : "Navegação de estudos"}>
        <span className="sidebarGroupTitle">{developer ? "ADMINISTRAÇÃO" : "ÁREA DE ESTUDOS"}</span>
        {developer ? developerLinks.map(renderLink) : <>
          {primaryLinks.map(renderLink)}
          <details className="sidebarMore" open={secondaryActive || undefined} key={pathname.startsWith("/desenvolvedor") ? "dev" : "study"}>
            <summary><span><Files size={18}/> Outras ferramentas</span><ChevronDown size={15}/></summary>
            <div className="sidebarMoreContent">{secondaryLinks.map(renderLink)}</div>
          </details>
          <div className="sidebarNavDivider" />
          {renderLink(["/configuracoes", "Configurações", Settings])}
        </>}
      </nav>
      <div className="sidebarUser">
        <div className="sidebarAvatar">{(user?.email || "C").charAt(0).toUpperCase()}</div>
        <div className="sidebarIdentity"><small>Logado como</small><div className="userEmail" title={user?.email || ""}>{user?.email}</div></div>
        <button className="logoutButton" onClick={sair} aria-label="Sair"><LogOut size={17}/></button>
      </div>
    </aside>
  </>;
}
