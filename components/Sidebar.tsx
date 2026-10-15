"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useContest } from "@/contexts/ContestContext";
import {
  LayoutDashboard,
  CalendarCheck,
  Trophy,
  FileText,
  Map,
  BookText,
  NotebookPen,
  ClipboardList,
  BookOpenCheck,
  Utensils,
  Scale,
  Bot,
  Search,
  LogOut,
  Menu,
  X,
} from "lucide-react";

const links = [
  ["/dashboard", "Dashboard", LayoutDashboard],
  ["/planejador", "Planejador do Dia", CalendarCheck],
  ["/buscar", "Busca rápida", Search],
  ["/concursos", "Concursos", Trophy],
  ["/edital", "Edital", FileText],
  ["/mapa-mestre", "Mapa-Mestre", Map],
  ["/gerenciar-mapa", "Gerenciar Mapa", Map],
  ["/conteudo", "Conteúdo", BookText],
  ["/registrar-estudo", "Registrar estudo", NotebookPen],
  ["/questoes", "Questões", ClipboardList],
  ["/caderno-erros", "Caderno de Erros", BookOpenCheck],
  ["/revisao-almoco", "Revisão do Almoço", Utensils],
  ["/lei-seca", "Lei Seca", Scale],
  ["/assistente", "Assistente Fazenda", Bot],
] as const;

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { contests, activeContestId, selectContest, error: contestError } = useContest();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  async function sair() {
    await logout();
    router.replace("/login");
  }

  return (
    <>
      <button className="mobileMenuButton" aria-label="Abrir menu" onClick={() => setOpen(true)}><Menu size={21} /></button>
      {open && <button className="sidebarOverlay" aria-label="Fechar menu" onClick={() => setOpen(false)} />}
      <aside className={`sidebar ${open ? "mobileOpen" : ""}`}>
        <div className="sidebarTopRow">
          <div>
            <div className="brand">Projeto Fazenda</div>
            <div className="subtitle">Estudo guiado, ativo e adaptativo</div>
          </div>
          <button className="mobileSidebarClose" aria-label="Fechar menu" onClick={() => setOpen(false)}><X size={20} /></button>
        </div>

        <div className="contestPicker">
          <label>Concurso ativo</label>
          <select value={activeContestId} onChange={e => selectContest(e.target.value)}>
            {contests.length === 0 && <option value={activeContestId}>{contestError ? "Dados indisponíveis — consulte o Firebase" : activeContestId}</option>}
            {contests.map(contest => (
              <option key={contest.id} value={contest.id}>
                {contest.name}{contest.role ? ` • ${contest.role}` : ""}
              </option>
            ))}
          </select>
        </div>

        {contestError && <p role="alert" style={{ color: "#fca5a5", fontSize: 12, padding: "8px 12px" }}>{contestError}</p>}

        <nav>
          {links.map(([href, label, Icon]) => (
            <Link key={href} href={href} className={`navlink ${pathname === href || pathname.startsWith(`${href}/`) ? "active" : ""}`}>
              <Icon size={17} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebarUser">
          <small>Logado como</small>
          <div className="userEmail">{user?.email}</div>
          <button className="logoutButton" onClick={sair}><LogOut size={16} /> Sair</button>
        </div>
      </aside>
    </>
  );
}
