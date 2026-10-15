"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { useContest } from "@/contexts/ContestContext";
import { globalSearch } from "@/services/firestore";

export default function BuscarPage() {
  const { user } = useAuth();
  const { activeContestId } = useContest();
  const [term, setTerm] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  async function run() {
    if (!user || term.trim().length < 2) return;
    setLoading(true);
    setRows(await globalSearch(user.uid, activeContestId, term));
    setLoading(false);
  }

  return <AppShell>
    <div className="pageHeader">
      <div><h1>Busca rápida</h1><p className="muted">Encontre conteúdo, questão, lei, erro ou material sem navegar por vários módulos.</p></div>
    </div>
    <section className="panel globalSearchBox">
      <div className="searchInputWrap"><Search size={18}/><input autoFocus value={term} onChange={e => setTerm(e.target.value)} onKeyDown={e => e.key === "Enter" && run()} placeholder="Ex.: reintegração, art. 8º, regência, Aula 11..." /></div>
      <button className="actionButton" onClick={run} disabled={loading || term.trim().length < 2}>{loading ? "Buscando..." : "Buscar"}</button>
    </section>
    <section className="searchResults">
      {rows.map(row => <Link className="panel searchResultRow" key={`${row.type}-${row.id}`} href={row.href}>
        <span className="badge">{row.type}</span><div><strong>{row.title}</strong><p>{row.subtitle}</p></div><span>→</span>
      </Link>)}
      {!loading && term && rows.length === 0 && <div className="panel emptyState">Nenhum resultado. Tente uma palavra mais curta ou outro termo.</div>}
    </section>
  </AppShell>;
}
