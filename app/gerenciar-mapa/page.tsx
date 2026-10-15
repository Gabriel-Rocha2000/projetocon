"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { useContest } from "@/contexts/ContestContext";
import {
  getTopics,
  renameContestDiscipline,
  setDisciplineActiveStatus,
  setTopicTreeActiveStatus,
  updateTopicEditable,
} from "@/services/firestore";
import type { Topic } from "@/types";

type Selection =
  | { kind: "discipline"; name: string }
  | { kind: "topic"; topic: Topic };

function orderedTopics(rows: Topic[]): { topic: Topic; depth: number }[] {
  const sorted = [...rows].sort((a, b) => (a.order || 0) - (b.order || 0));
  const ids = new Set(sorted.map(t => t.id));
  const visited = new Set<string>();
  const result: { topic: Topic; depth: number }[] = [];
  function visit(row: Topic, depth: number) {
    if (visited.has(row.id)) return;
    visited.add(row.id);
    result.push({ topic: row, depth: Math.min(depth, 5) });
    sorted.filter(t => t.parentTopicId === row.id && t.id !== row.id)
      .forEach(child => visit(child, depth + 1));
  }
  sorted.filter(t => !t.parentTopicId || !ids.has(t.parentTopicId) || t.parentTopicId === t.id)
    .forEach(root => visit(root, 0));
  sorted.forEach(t => visit(t, 0));
  return result;
}

export default function GerenciarMapaPage() {
  const { user } = useAuth();
  const { activeContestId, activeContest } = useContest();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string[]>([]);
  const [showRemoved, setShowRemoved] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [mode, setMode] = useState<"edit" | "remove" | "restore">("edit");
  const [name, setName] = useState("");
  const [originalText, setOriginalText] = useState("");
  const [canonical, setCanonical] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setTopics([]);
    setSelection(null);
    setExpanded([]);
    setNotice("");
    getTopics(activeContestId)
      .then(rows => { if (!cancelled) setTopics(rows); })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : "Falha ao consultar o Firebase."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [activeContestId]);

  const groups = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    const names = Array.from(new Set(topics.map(t => t.discipline).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, "pt-BR"));
    return names.map(discipline => {
      const allRows = topics.filter(t => t.discipline === discipline);
      const visibleRows = allRows.filter(t => showRemoved || t.activeInCurrentEdital !== false);
      const matched = !term || discipline.toLocaleLowerCase("pt-BR").includes(term)
        ? visibleRows
        : visibleRows.filter(t => t.title.toLocaleLowerCase("pt-BR").includes(term) ||
            t.originalText?.toLocaleLowerCase("pt-BR").includes(term));
      return { discipline, allRows, rows: term && matched.length < visibleRows.length ?
        matched.map(t => ({ topic: t, depth: 0 })) : orderedTopics(matched),
        removed: allRows.filter(t => t.activeInCurrentEdital === false).length };
    }).filter(g => g.rows.length > 0);
  }, [topics, showRemoved, search]);

  function begin(row: Selection, action: "edit" | "remove" | "restore") {
    setSelection(row);
    setMode(action);
    setActionError("");
    setName(row.kind === "discipline" ? row.name : row.topic.title);
    setOriginalText(row.kind === "topic" ? row.topic.originalText || "" : "");
    setCanonical(row.kind === "topic" ? row.topic.canonicalContentId || "" : "");
  }

  async function submit() {
    if (!selection || busy || !user) return;
    const next = name.trim();
    if (mode === "edit" && !next) {
      setActionError("Informe um título ou nome válido.");
      return;
    }
    setBusy(true);
    setActionError("");
    setNotice("");
    try {
      let amount = 1;
      if (selection.kind === "discipline") {
        if (mode === "edit") {
          if (next !== selection.name) {
            if (topics.some(t => t.discipline === next)) {
              throw new Error("Já existe uma disciplina com esse nome neste concurso.");
            }
            await renameContestDiscipline(activeContestId, selection.name, next);
          }
        } else {
          amount = await setDisciplineActiveStatus(activeContestId, selection.name, mode === "restore");
        }
      } else {
        const topic = selection.topic;
        if (!topics.some(t => t.id === topic.id && t.contestId === activeContestId)) {
          throw new Error("Esse tópico não pertence ao concurso selecionado.");
        }
        if (mode === "edit") {
          await updateTopicEditable(topic.id, {
            title: next,
            originalText: originalText.trim() || next,
            canonicalContentId: canonical.trim() || null,
          });
        } else {
          amount = await setTopicTreeActiveStatus(activeContestId, topic.id, mode === "restore");
        }
      }
      setTopics(await getTopics(activeContestId));
      setNotice(mode === "edit" ? "Alterações salvas." :
        `${amount} item(ns) ${mode === "restore" ? "restaurado(s)" : "retirado(s) da lista"}. O histórico foi preservado.`);
      setSelection(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "A operação não foi concluída.");
    } finally {
      setBusy(false);
    }
  }

  const removedCount = topics.filter(t => t.activeInCurrentEdital === false).length;
  const totalCount = topics.length;
  const buttonStyle = { padding: "7px 11px", borderRadius: 8, border: "1px solid #d4dce8", background: "#fff", color: "#1d3157", cursor: "pointer", fontWeight: 700 as const };
  const dangerStyle = { ...buttonStyle, color: "#b42318", borderColor: "#efb9b4" };

  return <AppShell>
    <div className="pageHeader">
      <div>
        <h1>Gerenciar Mapa-Mestre</h1>
        <p className="muted">{activeContest?.name || activeContestId} • versão alternativa 1.4.9b</p>
      </div>
      <div className="quickActions"><Link className="actionButton secondaryAction" href="/mapa-mestre">Voltar ao Mapa-Mestre</Link></div>
    </div>

    <section className="panel" style={{ padding: 18, marginBottom: 16 }}>
      <p style={{ marginTop: 0 }}><strong>Gerenciamento seguro:</strong> editar título/nome ou retirar itens da lista, com restauração disponível. Não há exclusão definitiva de tópicos, questões, conteúdo ou progresso.</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} aria-label="Buscar no Mapa-Mestre" placeholder="Buscar disciplina, tópico ou subtópico..." style={{ flex: "1 1 270px", padding: 10, border: "1px solid #cfd6e1", borderRadius: 8 }} />
        <label style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <input type="checkbox" checked={showRemoved} onChange={e => setShowRemoved(e.target.checked)} />
          Mostrar retirados ({removedCount})
        </label>
        <span className="muted">{totalCount} itens cadastrados</span>
      </div>
    </section>

    {notice && <div role="status" className="statusBox" style={{ marginBottom: 14 }}>{notice}</div>}
    {error && <div role="alert" className="warningBox">Falha ao carregar: {error}. Nenhum dado foi apagado.</div>}
    {loading && <p className="muted">Carregando disciplinas e tópicos...</p>}
    {!loading && !error && groups.length === 0 && <div className="panel emptyState">Nenhum item corresponde aos filtros.</div>}
    {!loading && !error && groups.map(group => {
      const isOpen = expanded.includes(group.discipline) || Boolean(search.trim());
      const completelyRemoved = group.allRows.every(t => t.activeInCurrentEdital === false);
      return <section key={group.discipline} className="panel" style={{ padding: 0, marginBottom: 12, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "12px 15px", borderBottom: isOpen ? "1px solid #e1e7ef" : undefined }}>
          <button type="button" aria-label={isOpen ? "Recolher disciplina" : "Expandir disciplina"} style={buttonStyle} onClick={() => setExpanded(old => isOpen ? old.filter(d => d !== group.discipline) : [...old, group.discipline])}>{isOpen ? "▾" : "▸"}</button>
          <strong style={{ flex: "1 1 200px" }}>{group.discipline}</strong>
          <span className="muted">{group.allRows.length} itens{group.removed ? ` • ${group.removed} retirados` : ""}</span>
          <button type="button" style={buttonStyle} onClick={() => begin({ kind: "discipline", name: group.discipline }, "edit")}>Editar</button>
          <button type="button" style={completelyRemoved ? buttonStyle : dangerStyle} onClick={() => begin({ kind: "discipline", name: group.discipline }, completelyRemoved ? "restore" : "remove")}>{completelyRemoved ? "Restaurar" : "Excluir da lista"}</button>
        </div>
        {isOpen && group.rows.map(({ topic, depth }) => {
          const removed = topic.activeInCurrentEdital === false;
          return <div key={topic.id} style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10, borderBottom: "1px solid #eef1f5", padding: "9px 15px 9px 15px" }}>
            <span style={{ flex: "1 1 240px", minWidth: 130, paddingLeft: depth * 18, opacity: removed ? 0.55 : 1 }}>
              <span style={{ fontSize: 12, color: "#7b899d", marginRight: 7 }}>{depth ? "↳" : "•"}</span>{topic.title}
              {removed && <small style={{ marginLeft: 9, color: "#a34033" }}>Retirado</small>}
            </span>
            <small className="muted">{topic.level === "subtopic" ? "Subtópico" : "Tópico"}</small>
            <button type="button" style={buttonStyle} onClick={() => begin({ kind: "topic", topic }, "edit")}>Editar</button>
            <button type="button" style={removed ? buttonStyle : dangerStyle} onClick={() => begin({ kind: "topic", topic }, removed ? "restore" : "remove")}>{removed ? "Restaurar" : "Excluir da lista"}</button>
          </div>;
        })}
      </section>;
    })}

    {selection && <div role="presentation" style={{ position: "fixed", inset: 0, background: "#0f1e37aa", zIndex: 1500, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onMouseDown={e => { if (e.target === e.currentTarget && !busy) setSelection(null); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="gerenciar-mapa-title" style={{ background: "white", borderRadius: 16, padding: 24, width: "min(100%, 550px)", maxHeight: "90vh", overflowY: "auto" }}>
        <h2 id="gerenciar-mapa-title" style={{ fontSize: 19 }}>{mode === "edit" ? "Editar" : mode === "restore" ? "Restaurar" : "Excluir da lista"}: {selection.kind === "discipline" ? selection.name : selection.topic.title}</h2>
        {mode === "edit" ? <div style={{ display: "grid", gap: 14 }}>
          <label style={{ display: "grid", gap: 7 }}>Nome ou título<input value={name} onChange={e => setName(e.target.value)} maxLength={selection.kind === "discipline" ? 90 : 180} style={{ padding: 10, border: "1px solid #cfd6e1", borderRadius: 8 }} /></label>
          {selection.kind === "topic" && <>
            <label style={{ display: "grid", gap: 7 }}>Texto original do edital<textarea rows={4} value={originalText} onChange={e => setOriginalText(e.target.value)} style={{ padding: 10, border: "1px solid #cfd6e1", borderRadius: 8 }} /></label>
            <label style={{ display: "grid", gap: 7 }}>ID do conteúdo canônico<input value={canonical} onChange={e => setCanonical(e.target.value)} style={{ padding: 10, border: "1px solid #cfd6e1", borderRadius: 8 }} /></label>
          </>}
          <small className="muted">Os IDs dos tópicos e o histórico não serão apagados. Ao renomear uma disciplina, os vínculos do concurso ativo são atualizados.</small>
        </div> : <p>Confirma {mode === "restore" ? "a restauração" : "a retirada reversível"} deste item{selection.kind === "discipline" ? " e de seus tópicos" : " e de seus subtópicos"}? Questões e histórico de estudos serão preservados.</p>}
        {actionError && <p className="warningBox" role="alert">{actionError}</p>}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 22 }}>
          <button type="button" disabled={busy} className="actionButton" onClick={submit}>{busy ? "Aguarde..." : mode === "edit" ? "Salvar" : mode === "restore" ? "Restaurar" : "Excluir da lista"}</button>
          <button type="button" disabled={busy} className="actionButton secondaryAction" onClick={() => setSelection(null)}>Cancelar</button>
        </div>
      </section>
    </div>}
  </AppShell>;
}
