"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { useContest } from "@/contexts/ContestContext";
import { completeReview, getLunchReviewQueue, getStudySettings, markErrorReviewed, scheduleAdaptiveReview } from "@/services/firestore";

export default function RevisaoAlmocoPage() {
  const { user } = useAuth(); const { activeContestId, activeContest } = useContest(); const [reviews,setReviews]=useState<any[]>([]); const [lunchMinutes,setLunchMinutes]=useState(20); const [copyStatus,setCopyStatus]=useState("");
  async function load(){if(!user)return;const [rows,settings]=await Promise.all([getLunchReviewQueue(user.uid,activeContestId),getStudySettings(user.uid)]);setReviews(rows);setLunchMinutes(settings.lunchMinutes);} useEffect(()=>{load();},[user,activeContestId]);
  const visible=reviews.slice(0,Math.max(1,Math.floor(lunchMinutes/5)));
  const chatReport = useMemo(() => {
    const rows = visible.map((review, index) => {
      const streak = Number(review.correctStreak || 0);
      const recurrence = Number(review.recurrence || 0);
      const status = review.sourceType === "question" ? `${streak}/3 acertos seguidos` : "revisão programada";
      return `${index + 1}. ${review.discipline} | tópico ${review.topicId || "não informado"} | ${String(review.reason || "revisão").replaceAll("_", " ")} | recorrência ${recurrence}x | ${status}${review.comment ? ` | anotação: ${review.comment}` : ""}`;
    });
    return [
      "RELATÓRIO CONCURSEIRO CLT — REVISÃO",
      `Concurso ativo: ${activeContest?.name || activeContestId}${activeContest?.role ? ` — ${activeContest.role}` : ""}`,
      `Gerado em: ${new Date().toLocaleString("pt-BR")}`,
      `Tempo disponível/meta: ${lunchMinutes} min`,
      `Fila total: ${reviews.length} item(ns) | Selecionados agora: ${visible.length}`,
      "",
      "ITENS PRIORIZADOS",
      ...(rows.length ? rows : ["- Fila vazia"]),
      "",
      "Regra do Caderno de Erros: o item permanece ativo até 3 acertos consecutivos; depois entra apenas no ciclo normal de revisão. Novo erro zera a sequência e reativa o item.",
      "",
      "Com base nesses dados, monte uma atividade de almoço objetiva e ativa, priorizando recuperação da memória, questões curtas e os erros mais recorrentes. Evite leitura passiva longa."
    ].join("\n");
  }, [visible, reviews.length, lunchMinutes, activeContest, activeContestId]);
  async function copyChatReport(){try{await navigator.clipboard.writeText(chatReport);setCopyStatus("Copiado");window.setTimeout(()=>setCopyStatus(""),1800);}catch{setCopyStatus("Selecione e copie manualmente");}}
  async function finish(review:any){if(!user)return;if(review.syntheticError&&review.errorId){await markErrorReviewed(user.uid,review.errorId);await scheduleAdaptiveReview(user.uid,activeContestId,{topicId:review.topicId,discipline:review.discipline,difficulty:Number(review.recurrence||1)>=3?"dificil":"medio",sourceType:"question",sourceId:review.questionId||review.sourceId,reasonPrefix:"erro_revisado_no_almoco",objectiveAccuracy:null});}else{await completeReview(user.uid,review.id);if(review.errorId)await markErrorReviewed(user.uid,review.errorId);}await load();}
  return <AppShell>
    <div className="pageHeader"><div><h1>Revisão do Almoço</h1><p className="muted">Poucos minutos, atividades ativas. Erros recorrentes entram primeiro e só se consolidam com 3 acertos seguidos.</p></div></div>
    <section className="panel todayHero"><div><span className="eyebrow">FILA DE HOJE</span><h2>{Math.min(visible.length*5,lunchMinutes)} de {lunchMinutes} min sugeridos</h2><p className="muted">{reviews.length} item(ns) esperando. A fila evita releitura longa: refaça, recupere e avance.</p></div></section>
    <section className="stack">{visible.map(review=><article className={`panel revisionRow ${Number(review.recurrence||0)>=3?"priorityReview":""}`} key={review.id}><div><div className="metaLine">{review.sourceType==="question"&&<span className="badge">Erro</span>}{Number(review.recurrence||0)>=2&&<span className="errorPriorityTag">{review.recurrence}x</span>}{review.sourceType==="question"&&<span className="statusPill">{Number(review.correctStreak||0)}/3 acertos</span>}</div><strong>{review.discipline} — {review.topicId}</strong><div className="muted">{String(review.reason||"revisão").replaceAll("_"," ")}</div>{review.comment&&<div className="taskReason">Sua anotação: {review.comment}</div>}</div><div className="quickActions">{review.sourceType==="question"?<Link className="actionButton" href={`/questoes/${review.sourceId}`}>Refazer agora</Link>:<Link className="actionButton" href={`/conteudo/${encodeURIComponent(review.topicId)}`}>Revisar conteúdo</Link>}<button className="miniButton" onClick={()=>finish(review)}>Já revisei</button></div></article>)}{!reviews.length&&<div className="panel emptyState">Fila limpa. O planejador pode usar o almoço para Lei Seca ou questões curtas.</div>}</section>
    <section className="panel chatReportPanel"><div className="panelHeader"><div><span className="eyebrow">LEVAR PARA O CHAT</span><h2>Gerar atividade com o ChatGPT</h2><p className="muted">O texto já leva a fila, recorrência e o progresso 0/3–3/3 para você só copiar e colar.</p></div><button className="actionButton secondaryAction" onClick={copyChatReport}>{copyStatus || "Copiar relatório"}</button></div><textarea className="chatReportText" value={chatReport} readOnly aria-label="Relatório da revisão do almoço para ChatGPT" /></section>
  </AppShell>;
}
