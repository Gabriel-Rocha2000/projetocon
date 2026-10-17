"use client";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { useContest } from "@/contexts/ContestContext";
import { getMaterials, getQuestions, getTopics } from "@/services/firestore";
import type { Topic, Question, Material } from "@/types";
export default function AuditoriaAdmin(){
 const {activeContestId}=useContest();
 const [data,setData]=useState<{topics:Topic[];questions:Question[];materials:Material[]}|null>(null);
 const [source,setSource]=useState(""); const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 useEffect(()=>{setData(null);setSource("");},[activeContestId]);
 async function audit(){setBusy(true);setError("");try{const [topics,questions,materials]=await Promise.all([getTopics(activeContestId),getQuestions(activeContestId),getMaterials(activeContestId)]);setData({topics,questions,materials});setSource(activeContestId);}catch(e){setError(e instanceof Error?e.message:"Falha na auditoria.");}finally{setBusy(false)}}
 const stats=useMemo(()=>{if(!data||source!==activeContestId)return null;const topicIds=new Set(data.topics.map(t=>t.id));const activeTopics=new Set(data.topics.filter(t=>t.activeInCurrentEdital!==false).map(t=>t.id));
 const orphans=data.questions.filter(q=>!topicIds.has(q.topicId)&&(!q.subtopicId||!topicIds.has(q.subtopicId)));
 const onRemoved=data.questions.filter(q=>topicIds.has(q.topicId)&&!activeTopics.has(q.topicId));
 const incomplete=data.questions.filter(q=>!q.statement?.trim()||!q.correctAnswer?.trim());
 const withoutTopic=data.topics.filter(t=>t.parentTopicId&&!topicIds.has(t.parentTopicId));
 const materialNoPdf=data.materials.filter(m=>m.type==="pdf"&&!m.storagePath);
 return {orphans,onRemoved,incomplete,withoutTopic,materialNoPdf};},[data,source,activeContestId]);
 return <AppShell><div className="pageHeader"><div><h1>Auditoria da base</h1><p className="muted">Verificação somente de leitura. Nenhum item será apagado, alterado ou reimportado.</p></div></div>
 <section className="panel"><p className="muted">A auditoria lê listas do concurso ativo e pode consumir leituras do Firestore. Execute somente quando necessário. A ausência de alertas não substitui a conferência com o PDF.</p><button className="actionButton" onClick={audit} disabled={busy}>{busy?"Auditando...":"Executar auditoria do concurso"}</button></section>
 {error&&<div className="warningBox" role="alert">{error}</div>}
 {stats&&data&&<><div className="devAuditGrid">{[{label:"Tópicos",n:data.topics.length},{label:"Questões",n:data.questions.length},{label:"Materiais",n:data.materials.length},{label:"Questões sem vínculo válido",n:stats.orphans.length},{label:"Questões em tópicos retirados",n:stats.onRemoved.length},{label:"Questões sem enunciado ou gabarito",n:stats.incomplete.length},{label:"Subtópicos com pai ausente",n:stats.withoutTopic.length},{label:"PDFs sem arquivo no Storage",n:stats.materialNoPdf.length}].map(x=><div key={x.label} className="devAuditStat"><strong>{x.n}</strong><span>{x.label}</span></div>)}</div>
 <section className="panel"><h2>Itens para revisão</h2>{[{label:"Questões sem tópico no mapa",rows:stats.orphans.map(x=>x.id)},{label:"Questões sem campos obrigatórios",rows:stats.incomplete.map(x=>x.id)},{label:"Tópicos com pai ausente",rows:stats.withoutTopic.map(x=>x.id)},{label:"PDFs sem arquivo",rows:stats.materialNoPdf.map(x=>x.id)}].map(g=><div key={g.label} className="devAuditGroup"><strong>{g.label} ({g.rows.length})</strong><small>{g.rows.slice(0,20).join(" · ")||"Nenhuma ocorrência"}{g.rows.length>20?` ... e ${g.rows.length-20} outros`:""}</small></div>)}</section></>}
 </AppShell>;
}
