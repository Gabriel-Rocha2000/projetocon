"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { useContest } from "@/contexts/ContestContext";
import { getQuestions, getTopics, updateQuestionEditable } from "@/services/firestore";
import type { Question, Topic } from "@/types";
export default function GerenciarQuestoes() {
  const { activeContestId } = useContest();
  const [loadedFor, setLoadedFor] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<Question | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function load() {
    setBusy(true);setMessage("");setSelected(null);
    try { const [q,t]=await Promise.all([getQuestions(activeContestId),getTopics(activeContestId)]);
      setQuestions(q);setTopics(t);setLoadedFor(activeContestId); }
    catch (e) {setMessage(e instanceof Error ? e.message : "Não foi possível consultar os dados.");}
    finally {setBusy(false);}
  }
  const rows = useMemo(()=>questions.filter(q=>`${q.id} ${q.discipline} ${q.subject} ${q.statement}`.toLowerCase().includes(filter.trim().toLowerCase())).slice(0,35),[questions,filter]);
  function edit(q: Question) {setSelected({...q,alternatives:{...q.alternatives}});setMessage("");}
  async function save() {
    if (!selected || busy) return;
    if (!window.confirm("Salvar a correção desta questão? O ID e as respostas anteriores serão preservados.")) return;
    setBusy(true);setMessage("");
    try {await updateQuestionEditable(selected.id,activeContestId,{statement:selected.statement,correctAnswer:selected.correctAnswer,alternatives:selected.alternatives,explanation:selected.explanation,topicId:selected.topicId,subtopicId:selected.subtopicId,contentBlockId:selected.contentBlockId});
      setQuestions(prev=>prev.map(q=>q.id===selected.id?selected:q));setSelected(null);setMessage("Questão atualizada. ID e histórico preservados.");}
    catch(e){setMessage(e instanceof Error ? e.message : "Erro ao salvar a questão.");}
    finally{setBusy(false);}
  }
  const usable=loadedFor===activeContestId;
  return <AppShell>
    <div className="pageHeader"><div><h1>Gerenciar questões</h1><p className="muted">Ajuste enunciados, alternativas, comentários e vínculos. Não exclui respostas nem histórico.</p></div><Link className="actionButton secondaryAction" href="/desenvolvedor/importar-questoes">Importar questões</Link></div>
    <section className="panel"><p className="muted">Carregamento manual para evitar leituras desnecessárias no Firestore. Revise o concurso ativo antes de editar.</p>
      <button className="actionButton" disabled={busy} onClick={load}>{busy?"Carregando...":"Carregar questões deste concurso"}</button>
      {usable && <div className="devAuditStat"><strong>{questions.length}</strong><span>questões carregadas</span></div>}
    </section>
    {message && <div role="status" className="statusBox">{message}</div>}
    {usable && <section className="panel"><label className="devField">Buscar questão<input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="ID, enunciado, assunto ou disciplina" /></label><p className="muted">Mostrando até 35 resultados. Use a busca para localizar a questão desejada.</p>
      <div className="managementList">{rows.map(q=><button className="managementListItem" key={q.id} onClick={()=>edit(q)}><span><strong>{q.subject||q.id}</strong><small>{q.discipline} • {q.id} • {q.statement.slice(0,115)}{q.statement.length>115?"…":""}</small></span><span>Editar →</span></button>)}</div>
    </section>}
    {selected && <section className="panel" id="editor-questao"><div className="panelHeader"><div><h2>Editar questão</h2><p className="muted">ID preservado: {selected.id}</p></div><button className="actionButton secondaryAction" onClick={()=>setSelected(null)}>Fechar</button></div>
      <div className="devForm"><label className="devField">Enunciado<textarea rows={8} value={selected.statement} onChange={e=>setSelected({...selected,statement:e.target.value})}/></label>
        <div className="devFieldsGrid">{["A","B","C","D","E"].map(key=><label className="devField" key={key}>Alternativa {key}<textarea rows={2} value={selected.alternatives?.[key]||""} onChange={e=>setSelected({...selected,alternatives:{...selected.alternatives,[key]:e.target.value}})} /></label>)}</div>
        <label className="devField">Gabarito<input value={selected.correctAnswer} onChange={e=>setSelected({...selected,correctAnswer:e.target.value.toUpperCase()})}/></label>
        <label className="devField">Comentário e fundamento<textarea rows={5} value={selected.explanation||""} onChange={e=>setSelected({...selected,explanation:e.target.value})}/></label>
        <label className="devField">Tópico<select value={selected.topicId} onChange={e=>setSelected({...selected,topicId:e.target.value,subtopicId:null})}><option value="">Selecione</option>{topics.filter(t=>t.level!=="subtopic").map(t=><option key={t.id} value={t.id}>{t.discipline} · {t.title}</option>)}</select></label>
        <label className="devField">Subtópico<select value={selected.subtopicId||""} onChange={e=>setSelected({...selected,subtopicId:e.target.value||null})}><option value="">Nenhum</option>{topics.filter(t=>t.parentTopicId===selected.topicId).map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label>
        <label className="devField">ID do microbloco vinculado<input value={selected.contentBlockId||""} onChange={e=>setSelected({...selected,contentBlockId:e.target.value||null})} placeholder="Deixe vazio se não houver confirmação do vínculo" /></label>
        <button className="actionButton" disabled={busy||!selected.statement.trim()||!selected.correctAnswer.trim()||!selected.topicId} onClick={save}>{busy?"Salvando...":"Salvar questão"}</button>
      </div></section>}
  </AppShell>;
}
