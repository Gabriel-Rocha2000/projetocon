import Link from "next/link";
import AppShell from "@/components/AppShell";
export default function Seguranca() {return <AppShell><div className="pageHeader"><div><h1>Histórico e segurança</h1><p className="muted">Cuidados antes de editar ou reconstruir sua base.</p></div></div>
<section className="panel"><h2>Disponível nesta versão</h2><p>Retirar e restaurar tópicos e arquivar microblocos são operações reversíveis. Editar preserva os identificadores e os registros de estudo associados.</p><Link className="actionButton secondaryAction" href="/desenvolvedor/mapa">Gerenciar mapa</Link></section>
<section className="panel"><h2>Ainda não implementado</h2><p>Histórico completo de versões por microbloco, restauração de snapshots, exportação de backup e autorização administrativa real via Firebase Custom Claims. Nenhum backup automático é criado por esta página.</p><p className="muted">Antes de limpar ou reconstruir a base, exporte seus dados com ferramentas de backup adequadas. Não faça exclusões em massa sem cópia verificada.</p></section>
</AppShell>;}
