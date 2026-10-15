"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import AppShell from "@/components/AppShell";
import Drawer from "@/components/Drawer";
import { useAuth } from "@/contexts/AuthContext";
import { useContest } from "@/contexts/ContestContext";
import { compareEditalVersions, createEditalVersion, getContestVersions, getTopics, updateTopicEditable } from "@/services/firestore";
import { uploadEditalFile } from "@/services/storage";
import { ContestVersion, Topic } from "@/types";

type Tab = "visao" | "conteudo" | "leis" | "versoes" | "editar";

export default function EditalPage() {
  const { user } = useAuth();
  const { activeContestId, activeContest, refreshContests } = useContest();
  const [tab, setTab] = useState<Tab>("visao");
  const [versions, setVersions] = useState<ContestVersion[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [diff, setDiff] = useState<any | null>(null);
  const [draftRows, setDraftRows] = useState<any[]>([]);
  const [draftSource, setDraftSource] = useState<{ type: "csv" | "pdf"; name: string; file?: File } | null>(null);
  const [message, setMessage] = useState("");
  const [warning, setWarning] = useState("");
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [editTopic, setEditTopic] = useState<Partial<Topic>>({});

  async function load() {
    const [vs, ts] = await Promise.all([getContestVersions(activeContestId), getTopics(activeContestId)]);
    setVersions(vs); setTopics(ts);
    const current = vs.find(v => v.status === "atual") || vs[0];
    if (current) setDiff(await compareEditalVersions(activeContestId, current.id, current.previousVersionId)); else setDiff(null);
  }
  useEffect(() => { load(); }, [activeContestId]);

  const current = versions.find(v => v.status === "atual") || versions[0] || null;
  const laws = current?.detectedLaws || [];
  const disciplines = useMemo(() => Array.from(new Set(topics.filter(t => t.activeInCurrentEdital !== false).map(t => t.discipline))).sort(), [topics]);

  async function csvFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    Papa.parse(file, { header: true, skipEmptyLines: true, complete: result => {
      setDraftRows((result.data as any[]).map((row, i) => ({ ...row, confidence: "alta", ordem: row.ordem || i + 1 })));
      setDraftSource({ type: "csv", name: file.name, file });
      setWarning(""); setMessage("CSV carregado. Confira a prévia antes de publicar a nova versão.");
    }});
  }

  async function pdfFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    setMessage("Processando PDF..."); setWarning("");
    const form = new FormData(); form.append("file", file);
    const res = await fetch("/api/edital-import", { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) { setMessage(""); setWarning(data.error || "Falha ao processar PDF."); return; }
    setDraftRows(data.rows || []); setDraftSource({ type: "pdf", name: file.name, file });
    setMessage(`${data.rows?.length || 0} item(ns) detectados. Revise antes de publicar.`); setWarning(data.warning || "");
  }

  function patchDraft(index: number, key: string, value: string) {
    setDraftRows(rows => rows.map((row, i) => i === index ? { ...row, [key]: value } : row));
  }

  async function publish() {
    if (!draftSource || !draftRows.length) return;
    setMessage("Salvando versão...");
    let storageWarning = "";
    if (user && draftSource.file) {
      try { await uploadEditalFile(user.uid, draftSource.file); } catch { storageWarning = " O PDF/CSV foi importado, mas o arquivo original não foi enviado ao Storage. Publique storage.rules para habilitar isso."; }
    }
    const version = await createEditalVersion(activeContestId, draftRows, draftSource.type, draftSource.name);
    setDraftRows([]); setDraftSource(null); await refreshContests(); await load();
    setMessage(`Nova versão publicada: ${version.label}.${storageWarning}`); setWarning(""); setTab("versoes");
  }

  function openEdit(topic: Topic) { setSelectedTopic(topic); setEditTopic({ discipline: topic.discipline, title: topic.title, originalText: topic.originalText, canonicalContentId: topic.canonicalContentId || "" }); }

  return <AppShell>
    <div className="pageHeader"><div><h1>Edital</h1><p className="muted">{activeContest?.name || activeContestId} • histórico preservado, versões comparáveis e conteúdo canônico reutilizável.</p></div></div>

    <div className="sectionTabs">
      {([['visao','Visão Geral'],['conteudo','Conteúdo Programático'],['leis','Leis Detectadas'],['versoes','Versões'],['editar','Editar']] as const).map(([id,label]) => <button key={id} className={`sectionTab ${tab===id?'active':''}`} onClick={()=>setTab(id)}>{label}</button>)}
    </div>

    {tab === "visao" && <>
      <section className="grid4 compactMetrics">
        <div className="card"><span className="muted">Versão atual</span><strong>{current?.label || "Ainda sem versão"}</strong></div>
        <div className="card"><span className="muted">Itens ativos</span><strong>{topics.filter(t=>t.activeInCurrentEdital!==false).length}</strong></div>
        <div className="card"><span className="muted">Disciplinas</span><strong>{disciplines.length}</strong></div>
        <div className="card"><span className="muted">Leis detectadas</span><strong>{laws.length}</strong></div>
      </section>
      <section className="panel"><div className="panelHeader"><div><h2>Atualizar edital</h2><p className="muted">PDF e CSV entram na mesma conferência. Nada incerto é publicado sem você revisar.</p></div></div>
        <div className="quickActions"><label className="actionButton fileButton">Importar PDF<input hidden type="file" accept=".pdf" onChange={pdfFile}/></label><label className="actionButton secondaryAction fileButton">Importar CSV<input hidden type="file" accept=".csv" onChange={csvFile}/></label></div>
        {message && <div className="statusBox">{message}</div>}{warning && <div className="warningBox">⚠️ {warning}</div>}
      </section>
      {draftRows.length > 0 && <section className="panel"><div className="panelHeader"><div><h2>Conferência antes de publicar</h2><p className="muted">Edite os campos necessários. O texto original extraído fica visível.</p></div><button className="actionButton" onClick={publish}>Publicar nova versão</button></div>
        <div className="draftEditalTable"><div className="draftEditalHead"><span>ID</span><span>Disciplina</span><span>Título</span><span>Conteúdo canônico</span><span>Confiança</span></div>{draftRows.slice(0,250).map((row,i)=><div className="draftEditalRow" key={`${row.id}-${i}`}><input value={row.id||row.topico_id||''} onChange={e=>patchDraft(i,'id',e.target.value)}/><input value={row.disciplina||''} onChange={e=>patchDraft(i,'disciplina',e.target.value)}/><textarea value={row.titulo||row.assunto||''} onChange={e=>patchDraft(i,'titulo',e.target.value)}/><input value={row.conteudo_id||''} onChange={e=>patchDraft(i,'conteudo_id',e.target.value)} placeholder="Ex.: PORT.REGENCIA"/><span className={`confidenceTag ${row.confidence||'alta'}`}>{row.confidence||'alta'}</span></div>)}</div>
      </section>}
      {current && diff && <section className="panel"><h2>Mudanças da versão atual</h2><div className="grid4 compactMetrics"><div className="metricLine positive"><strong>+{diff.added.length}</strong><span>adicionados</span></div><div className="metricLine negative"><strong>-{diff.removed.length}</strong><span>removidos</span></div><div className="metricLine"><strong>{diff.altered.length}</strong><span>alterados</span></div><div className="metricLine"><strong>{diff.unchanged.length}</strong><span>mantidos</span></div></div></section>}
    </>}

    {tab === "conteudo" && <>{disciplines.map(discipline => <section className="panel" key={discipline}><h2>{discipline}</h2><div className="cleanList">{topics.filter(t=>t.discipline===discipline && t.activeInCurrentEdital!==false).map(t=><div className="cleanListRow" key={t.id}><div><strong>{t.title}</strong><p>{t.originalText}</p></div><span className="statusPill">{t.level === 'subtopic' ? 'subtópico' : 'tópico'}</span></div>)}</div></section>)}</>}

    {tab === "leis" && <section className="panel"><h2>Leis detectadas no edital atual</h2><p className="muted">A detecção serve como lista de conferência. Depois a Lei Seca pode reutilizar a mesma biblioteca sem duplicar documentos.</p>{laws.length ? <div className="cleanList">{laws.map(law=><div className="cleanListRow" key={law}><strong>{law}</strong><span className="statusPill">detectada</span></div>)}</div> : <div className="emptyState">Nenhuma lei detectada nesta versão.</div>}</section>}

    {tab === "versoes" && <section className="panel"><h2>Histórico de versões</h2><div className="cleanList">{versions.map(v=><div className="cleanListRow" key={v.id}><div><strong>{v.label}</strong><p>{v.sourceType.toUpperCase()} • {v.itemCount} itens • {v.detectedLaws?.length||0} leis detectadas</p></div><span className={`statusPill ${v.status==='atual'?'active':''}`}>{v.status}</span></div>)}{!versions.length && <div className="emptyState">Ainda não há versão formal. Importe o próximo edital por PDF ou CSV.</div>}</div></section>}

    {tab === "editar" && <section className="panel"><h2>Editar estrutura atual</h2><p className="muted">Ajuste classificação e vínculo canônico sem apagar histórico.</p><div className="cleanList">{topics.filter(t=>t.activeInCurrentEdital!==false).map(t=><button className="cleanListRow rowButton" key={t.id} onClick={()=>openEdit(t)}><div><strong>{t.title}</strong><p>{t.discipline} • {t.canonicalContentId||'sem conteúdo canônico'}</p></div><span>Editar →</span></button>)}</div></section>}

    <Drawer open={!!selectedTopic} title="Editar item do edital" onClose={()=>setSelectedTopic(null)}>{selectedTopic && <div className="drawerStack"><label className="drawerField">Disciplina<input value={String(editTopic.discipline||'')} onChange={e=>setEditTopic({...editTopic,discipline:e.target.value})}/></label><label className="drawerField">Título<input value={String(editTopic.title||'')} onChange={e=>setEditTopic({...editTopic,title:e.target.value})}/></label><label className="drawerField">Texto original<textarea value={String(editTopic.originalText||'')} onChange={e=>setEditTopic({...editTopic,originalText:e.target.value})}/></label><label className="drawerField">Conteúdo canônico<input value={String(editTopic.canonicalContentId||'')} onChange={e=>setEditTopic({...editTopic,canonicalContentId:e.target.value})}/></label><button className="actionButton" onClick={async()=>{await updateTopicEditable(selectedTopic.id, editTopic); setSelectedTopic(null); await load();}}>Salvar alterações</button></div>}</Drawer>
  </AppShell>;
}
