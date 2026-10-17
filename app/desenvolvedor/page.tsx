"use client";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { useContest } from "@/contexts/ContestContext";
import { Map, BookText, ClipboardList, Files, FileText, FileCheck2, History, ArrowRight } from "lucide-react";
const items = [
  { href: "/desenvolvedor/mapa", name: "Mapa-Mestre", detail: "Editar títulos, nomes, vínculos e retirar/restaurar itens", icon: Map },
  { href: "/desenvolvedor/importar-mapa", name: "Importar estrutura", detail: "Adicionar tópicos e subtópicos com validação de CSV", icon: Files },
  { href: "/desenvolvedor/conteudos", name: "Conteúdos e microblocos", detail: "Editar textos, mover vínculos, arquivar, restaurar e importar CSV/PDF", icon: BookText },
  { href: "/desenvolvedor/questoes", name: "Banco de questões", detail: "Corrigir enunciados, alternativas, gabaritos e comentários", icon: ClipboardList },
  { href: "/desenvolvedor/importar-questoes", name: "Importação de questões", detail: "Importar CSV validado e conferir PDFs experimentais", icon: Files },
  { href: "/desenvolvedor/materiais", name: "PDFs e materiais", detail: "Localizar fontes e abrir PDFs salvos no Storage", icon: FileText },
  { href: "/desenvolvedor/auditoria", name: "Auditoria", detail: "Verificar vínculos quebrados antes de reimportar", icon: FileCheck2 },
  { href: "/desenvolvedor/seguranca", name: "Histórico e segurança", detail: "Regras de proteção e recursos ainda planejados", icon: History },
];
export default function DeveloperHome() {
  const { activeContest } = useContest();
  return <AppShell>
    <div className="pageHeader"><div><span className="eyebrow">CONCURSEIRO CLT · ADMINISTRAÇÃO</span><h1>Modo Desenvolvedor</h1><p className="muted">Organize e valide a base de estudos sem alterar a interface do leitor.</p></div></div>
    <div className="devSafetyNote"><span>Concurso ativo: <strong>{activeContest?.name || "Selecione no menu lateral"}</strong>. Confira o concurso antes de salvar mudanças.</span></div>
    <div className="devCards">{items.map(({href,name,detail,icon:Icon})=><Link href={href} key={href} className="devCard"><div className="devCardIcon"><Icon size={22}/></div><div><h2>{name}</h2><p>{detail}</p></div><ArrowRight size={18}/></Link>)}</div>
  </AppShell>;
}
