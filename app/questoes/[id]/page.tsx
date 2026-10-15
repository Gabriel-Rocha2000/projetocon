"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import Drawer from "@/components/Drawer";
import { useAuth } from "@/contexts/AuthContext";
import { addError, answerQuestion, getContentNode, getLawItems, getQuestion, getQuestionStudyStats, getTopic, updateErrorDetails } from "@/services/firestore";
import { AnswerConfidence, ContentNode, ErrorType, LawItem, Question, Topic } from "@/types";

export default function QuestaoDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [question, setQuestion] = useState<Question | null>(null);
  const [answer, setAnswer] = useState("");
  const [confidence, setConfidence] = useState<AnswerConfidence>("sabia");
  const [result, setResult] = useState<boolean | null>(null);
  const [errorType, setErrorType] = useState<ErrorType>("desconhecimento");
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState("");
  const [pool, setPool] = useState<string[]>([]);
  const [drawer, setDrawer] = useState<"content" | "stats" | "errors" | "review" | "law" | null>(null);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [content, setContent] = useState<ContentNode | null>(null);
  const [laws, setLaws] = useState<LawItem[]>([]);
  const [stats, setStats] = useState<any | null>(null);

  async function loadQuestion(questionId: string) {
    const q = await getQuestion(questionId); setQuestion(q); if (!q) return;
    const topicId = q.subtopicId || q.topicId;
    const t = await getTopic(topicId); setTopic(t); if (t) setContent(await getContentNode(t)); else setContent(null);
    const allLaws = await getLawItems(q.contestId);
    setLaws(allLaws.filter(l => q.legalRefs?.includes(l.stableRef || l.id) || q.lawIds?.includes(l.id) || l.topicId === q.topicId || l.subtopicId === q.subtopicId || l.topicId === q.subtopicId));
    if (user) setStats(await getQuestionStudyStats(user.uid, q.contestId, q));
  }

  useEffect(() => {
    loadQuestion(id);
    try { setPool(JSON.parse(sessionStorage.getItem("projeto-fazenda-question-pool") || "[]")); } catch { setPool([]); }
    setAnswer(""); setConfidence("sabia"); setResult(null); setMessage(""); setDrawer(null);
  }, [id, user]);

  if (!question) return <AppShell><div className="panel">Carregando questão...</div></AppShell>;
  const index = pool.indexOf(question.id); const prev = index > 0 ? pool[index - 1] : null; const next = index >= 0 && index < pool.length - 1 ? pool[index + 1] : null;
  const questionNumber = index >= 0 ? index + 1 : 1; const total = pool.length || 1;

  async function submit() {
    const currentQuestion = question;
    if (!user || !answer || !currentQuestion) return;

    const response = await answerQuestion(user.uid, currentQuestion, answer, confidence);
    setResult(response.correct);

    if (!response.correct) {
      const defaultComment = `Errei ${currentQuestion.subject || currentQuestion.topicId}: `;
      setComment(defaultComment);
      await addError(user.uid, currentQuestion, "desconhecimento", defaultComment);
      setMessage("Erro incluído automaticamente no Caderno. Você pode ajustar a classificação abaixo.");
    } else if (confidence !== "sabia") {
      setMessage("Acertou, mas com baixa confiança. O domínio recebe peso menor e o conteúdo continua candidato a revisão.");
    } else {
      const studyStats = await getQuestionStudyStats(user.uid, currentQuestion.contestId, currentQuestion);
      const existing = (studyStats.relatedErrors as any[] | undefined)?.find((e:any) => e.questionId === currentQuestion.id);
      if (existing && existing.status !== "consolidado") {
        setMessage(`Acerto registrado no erro: ${Number(existing.correctStreak || 0)}/3 seguidos para consolidar.`);
      }
    }

    setStats(await getQuestionStudyStats(user.uid, currentQuestion.contestId, currentQuestion));
  }

  async function saveErrorDetails() {
    const currentQuestion = question;
    if (!user || !currentQuestion) return;

    await updateErrorDetails(user.uid, currentQuestion.id, { errorType, comment });
    setMessage("Classificação do erro atualizada sem alterar a recorrência.");
    setStats(await getQuestionStudyStats(user.uid, currentQuestion.contestId, currentQuestion));
  }

  const relatedErrors = stats?.relatedErrors || []; const topicAccuracy = stats?.topic?.accuracy || 0;
  const currentError = relatedErrors.find((e:any)=>e.questionId===question.id);
  const contentHref = `/conteudo/${encodeURIComponent(question.subtopicId || question.topicId)}${question.contentBlockId ? `?block=${encodeURIComponent(question.contentBlockId)}` : ""}`;

  return <AppShell>
    <div className="questionWorkspace">
      <div className="questionBreadcrumb"><Link href="/questoes">Questões</Link><span>›</span><span>{question.discipline}</span><span>›</span><button onClick={() => setDrawer("content")}>{question.subject || question.topicId}</button>{question.subsubject && <><span>›</span><span>{question.subsubject}</span></>}</div>
      <div className="questionTopbar"><div><strong>Questão {questionNumber} de {total}</strong><span className="questionMiniStats">{stats?.question?.answered || 0} tentativa(s) • {stats?.question?.correct || 0} acerto(s) • {stats?.question?.wrong || 0} erro(s)</span></div><div className="questionToolbar"><button onClick={() => setDrawer("content")}>Conteúdo</button><button onClick={() => setDrawer("stats")}>Estatísticas</button><button onClick={() => setDrawer("errors")}>Erros {relatedErrors.length ? `(${relatedErrors.length})` : ""}</button>{laws.length>0&&<button onClick={()=>setDrawer("law")}>Lei Seca</button>}<button onClick={() => setDrawer("review")}>Revisão</button></div></div>
      {pool.length > 0 && <div className="batteryProgress"><div style={{ width: `${(questionNumber / total) * 100}%` }} /></div>}

      <article className="questionProCard">
        <div className="questionSourceLine"><div><span className="badge">{question.board || "Sem banca"}</span><strong>{question.organ || question.examName || "Prova"}</strong>{question.year && <span>{question.year}</span>}</div><span className="questionCode">#{question.id.split("__").slice(-1)[0]}</span></div>
        <div className="questionSubjectLine"><span>Matéria: <strong>{question.discipline}</strong></span><span>Assunto: <button onClick={() => setDrawer("content")}>{question.subject || question.topicId}</button></span>{question.subsubject && <span>Tema: <strong>{question.subsubject}</strong></span>}</div>
        <div className="questionBody"><p className="statement">{question.statement}</p>
          {question.questionType === "certo_errado" ? <div className="answerGrid twoChoices"><button className={answer === "C" ? "choice selected" : "choice"} onClick={() => setAnswer("C")}><span className="choiceLetter">C</span><span>Certo</span></button><button className={answer === "E" ? "choice selected" : "choice"} onClick={() => setAnswer("E")}><span className="choiceLetter">E</span><span>Errado</span></button></div> : <div className="answerGrid">{Object.entries(question.alternatives || {}).map(([letter, text]) => <button key={letter} className={answer === letter ? "choice selected" : "choice"} onClick={() => setAnswer(letter)}><span className="choiceLetter">{letter}</span><span>{text}</span></button>)}</div>}

          {result === null && <div className="confidenceSelector"><span>Antes de responder:</span>{([['sabia','Sabia'],['entre_duas','Fiquei entre duas'],['chutei','Chutei']] as const).map(([value,label])=><button key={value} className={confidence===value?'selected':''} onClick={()=>setConfidence(value)}>{label}</button>)}</div>}
          <div className="questionAnswerBar"><button className="actionButton" onClick={submit} disabled={!answer || result!==null}>Responder</button>{result !== null && <div className={result ? "inlineResult good" : "inlineResult bad"}>{result ? "✓ Você acertou" : "✕ Você errou"} • Gabarito: {question.correctAnswer}</div>}</div>
          {message && <div className="statusBox">{message}</div>}

          {currentError && <div className={`errorStreakBar ${currentError.status==='consolidado'?'consolidated':''}`}><div><strong>{currentError.status==='consolidado'?'Erro consolidado':'Correção do erro'}</strong><span>{Number(currentError.correctStreak||0)}/3 acertos consecutivos</span></div><div className="streakDots">{[1,2,3].map(n=><span key={n} className={Number(currentError.correctStreak||0)>=n?'filled':''}/>)}</div></div>}

          {result !== null && (question.explanation || question.relatedContent) && <div className="resolutionBox"><div><strong>Resolução / comentário</strong>{question.explanation && <p>{question.explanation}</p>}{question.relatedContent && <p><strong>Conteúdo relacionado:</strong> {question.relatedContent}</p>}{question.sourceName && <small>Fonte: {question.sourceName}{question.sourcePage ? ` • p. ${question.sourcePage}` : ""}</small>}</div><Link className="miniButton" href={contentHref}>Abrir trecho</Link></div>}

          {result === false && <div className="errorPanel compactErrorPanel"><div><h3>Classificar o erro</h3><p className="muted">Ele já foi incluído automaticamente. Aqui você só melhora o diagnóstico.</p></div><div className="errorInlineFields"><label>Tipo<select value={errorType} onChange={e => setErrorType(e.target.value as ErrorType)}><option value="desconhecimento">Desconhecimento</option><option value="confusao_conceitual">Confusão conceitual</option><option value="interpretacao">Interpretação</option><option value="extrapolacao">Extrapolação</option><option value="restricao">Restrição indevida</option><option value="literalidade">Literalidade / detalhe</option><option value="distracao">Distração</option><option value="decoreba">Decoreba</option><option value="calculo">Cálculo</option><option value="pegadinha">Pegadinha</option></select></label><label>O que aconteceu?<input value={comment} onChange={e => setComment(e.target.value)} /></label><button className="actionButton secondaryAction" onClick={saveErrorDetails}>Atualizar</button></div></div>}
        </div>
      </article>

      <div className="questionBottomNav"><button className="miniButton" disabled={!prev} onClick={() => prev && router.push(`/questoes/${prev}`)}>← Anterior</button><div className="questionBottomCenter"><strong>{questionNumber} / {total}</strong><span>{Math.round((questionNumber / total) * 100)}% da bateria</span></div><button className="miniButton" disabled={!next} onClick={() => next && router.push(`/questoes/${next}`)}>Próxima →</button></div>
    </div>

    <Drawer open={drawer === "content"} title="Conteúdo relacionado" onClose={() => setDrawer(null)}><div className="drawerStack"><div><span className="badge">{question.discipline}</span><h2>{topic?.title || question.subject}</h2>{topic?.canonicalContentId && <p className="muted">{topic.canonicalContentId}</p>}</div><div className="detailBlock"><strong>Trecho relacionado</strong><p>{content?.text || question.relatedContent || topic?.originalText || "Use Abrir trecho para acessar o microbloco importado."}</p>{content?.sourceLabel && <small>Fonte: {content.sourceLabel}{content.sourcePage ? ` • ${content.sourcePage}` : ""}</small>}</div><div className="quickActions"><Link className="actionButton" href={contentHref}>Abrir trecho exato</Link><Link className="actionButton secondaryAction" href={`/questoes?topic=${encodeURIComponent(question.subtopicId || question.topicId)}`}>Questões deste conteúdo</Link></div></div></Drawer>

    <Drawer open={drawer === "stats"} title="Estatísticas da questão" onClose={() => setDrawer(null)}><div className="drawerStack"><div className="drawerMetrics"><div><span>Nesta questão</span><strong>{stats?.question?.accuracy || 0}%</strong></div><div><span>Neste conteúdo</span><strong>{topicAccuracy}%</strong></div><div><span>Na disciplina</span><strong>{stats?.discipline?.accuracy || 0}%</strong></div></div><div className="detailBlock"><strong>Interpretação do domínio</strong><p>Acertos marcados como “fiquei entre duas” ou “chutei” recebem peso menor para evitar falsa segurança.</p></div></div></Drawer>

    <Drawer open={drawer === "errors"} title="Erros relacionados" onClose={() => setDrawer(null)}><div className="drawerStack">{!relatedErrors.length && <div className="emptyState">Nenhum erro registrado.</div>}{relatedErrors.map((e:any)=><div className="detailBlock" key={e.id}><strong>{e.subject || e.topicId}</strong><p>{String(e.errorType||"").replaceAll("_"," ")} • {e.recurrence||1} erro(s) • <b>{Number(e.correctStreak||0)}/3 acertos seguidos</b> • {e.status==='consolidado'?'consolidado':'ativo'}</p>{e.comment&&<small>{e.comment}</small>}</div>)}<Link className="actionButton" href={`/caderno-erros?discipline=${encodeURIComponent(question.discipline)}`}>Abrir Caderno de Erros</Link></div></Drawer>

    <Drawer open={drawer === "law"} title="Lei Seca relacionada" onClose={()=>setDrawer(null)}><div className="drawerStack">{laws.map(l=><div className="detailBlock" key={l.id}><strong>{l.lawName} • {l.reference}</strong><p>{l.text}</p><Link href={`/lei-seca?item=${encodeURIComponent(l.id)}&review=1`}>Revisar dispositivo →</Link></div>)}</div></Drawer>

    <Drawer open={drawer === "review"} title="Revisão deste conteúdo" onClose={() => setDrawer(null)}><div className="drawerStack"><div className="warningBox">A Revisão do Almoço usa erros, recorrência, baixa confiança e desempenho. Erros só saem dos ativos após 3 acertos consecutivos.</div><div className="drawerMetrics"><div><span>Domínio</span><strong>{topicAccuracy}%</strong></div><div><span>Erros ativos</span><strong>{stats?.activeErrors || 0}</strong></div><div><span>Recorrentes</span><strong>{stats?.recurringErrors || 0}</strong></div></div><Link className="actionButton" href="/revisao-almoco">Abrir Revisão do Almoço</Link></div></Drawer>
  </AppShell>;
}
