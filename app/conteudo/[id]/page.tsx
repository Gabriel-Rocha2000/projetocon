"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import ContextualReader from "@/components/ContextualReader";
import { useAuth } from "@/contexts/AuthContext";
import { useContest } from "@/contexts/ContestContext";
import {
  addError,
  answerQuestion,
  getContentBlockProgress,
  getContentBlocks,
  getContentNode,
  getErrors,
  getLawItems,
  getQuestions,
  getTopic,
  getTopics,
  saveContentBlockProgress,
} from "@/services/firestore";
import { AnswerConfidence, ContentBlock, ContentNode, Difficulty, LawItem, Question, Topic } from "@/types";

export default function ConteudoDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { activeContestId } = useContest();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [allTopics, setAllTopics] = useState<Topic[]>([]);
  const [node, setNode] = useState<ContentNode | null>(null);
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [blockProgress, setBlockProgress] = useState<any[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [laws, setLaws] = useState<LawItem[]>([]);
  const [errors, setErrors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError("");
    setTopic(null);

    async function load() {
      try {
        const t = await getTopic(id);
        if (!active) return;
        if (!t || (t.contestId && t.contestId !== activeContestId)) {
          setLoadError("Tópico não encontrado no concurso ativo. Confira o Mapa-Mestre.");
          setLoading(false);
          return;
        }
        const contentId = t.canonicalContentId || t.id;
        const [content, blockRows, qs, lawRows, errorRows, progress, topicRows] = await Promise.all([
          getContentNode(t), getContentBlocks(contentId), getQuestions(activeContestId),
          getLawItems(activeContestId),
          user ? getErrors(user.uid, activeContestId) : Promise.resolve([]),
          user ? getContentBlockProgress(user.uid, activeContestId) : Promise.resolve([]),
          getTopics(activeContestId),
        ]);
        if (!active) return;
        const ownBlocks = blockRows.filter(block => block.topicId === t.id);
        const selectedBlocks = ownBlocks.length ? ownBlocks : blockRows.filter(block => block.contentId === contentId);
        setTopic(t);
        setNode(content);
        setBlocks([...selectedBlocks].sort((a, b) => a.order - b.order));
        setQuestions(qs.filter(q => q.topicId === t.id || q.subtopicId === t.id));
        setLaws(lawRows.filter(l => l.topicId === t.id || l.subtopicId === t.id));
        setErrors(errorRows.filter((e: any) => e.topicId === t.id || e.subtopicId === t.id));
        setBlockProgress(progress);
        setAllTopics(topicRows.filter(row => row.activeInCurrentEdital !== false));
        setLoading(false);
      } catch (error) {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : "Não foi possível carregar este conteúdo.");
        setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [id, activeContestId, user?.uid]);

  const doneBlocks = useMemo(() => new Set(blockProgress.filter(p => p.completed).map(p => p.contentBlockId)), [blockProgress]);
  const activeErrors = useMemo(() => errors.filter((e: any) => e.status !== "consolidado"), [errors]);
  const progressPct = blocks.length ? Math.round(100 * blocks.filter(b => doneBlocks.has(b.id)).length / blocks.length) : 0;
  const orderedTopics = useMemo(() => [...allTopics].sort((a, b) =>
    a.discipline.localeCompare(b.discipline, "pt-BR") || a.order - b.order || a.title.localeCompare(b.title, "pt-BR")), [allTopics]);
  const topicIndex = topic ? orderedTopics.findIndex(row => row.id === topic.id) : -1;
  const previousTopic = topicIndex > 0 ? orderedTopics[topicIndex - 1] : null;
  const nextTopic = topicIndex >= 0 && topicIndex < orderedTopics.length - 1 ? orderedTopics[topicIndex + 1] : null;

  async function answerInline(question: Question, selected: string, confidence: AnswerConfidence) {
    if (!user) throw new Error("Faça login para registrar sua resposta.");
    if (!question.correctAnswer?.trim()) throw new Error("Gabarito não cadastrado: questão bloqueada para correção.");
    const outcome = await answerQuestion(user.uid, question, selected, confidence);
    if (!outcome.correct) {
      try {
        await addError(user.uid, question, "desconhecimento", `Erro na questão ${question.subject || question.id}; revisar o fundamento.`);
      } catch {
        setMessage("Resposta salva, mas não foi possível atualizar o Caderno de Erros. Confira-o antes de seguir.");
      }
    }
    return outcome;
  }

  async function finishBlock(block: ContentBlock, difficulty: Difficulty) {
    if (!user) throw new Error("Faça login para registrar a leitura.");
    await saveContentBlockProgress(user.uid, activeContestId, block, difficulty);
    setBlockProgress(await getContentBlockProgress(user.uid, activeContestId));
  }

  if (loading) return <AppShell><div className="panel">Carregando leitor e vínculos de questões…</div></AppShell>;
  if (loadError || !topic) return <AppShell><section className="panel"><h2>Não foi possível abrir o conteúdo</h2><p>{loadError || "Tópico não encontrado."}</p><Link className="actionButton secondaryAction" href="/conteudo">Voltar para conteúdos</Link></section></AppShell>;

  return <AppShell>
    <nav className="contentNavigator" aria-label="Navegação entre conteúdos">
      <Link className="contentNavBack" href="/conteudo">← Voltar para conteúdos</Link>
      <div className="contentNavPosition">Conteúdo {topicIndex >= 0 ? topicIndex + 1 : "—"} de {orderedTopics.length || "—"}</div>
      <div className="contentNavArrows">
        {previousTopic ? <Link href={`/conteudo/${encodeURIComponent(previousTopic.id)}`} title={previousTopic.title}>← Anterior</Link> : <span className="disabledNav">← Anterior</span>}
        {nextTopic ? <Link href={`/conteudo/${encodeURIComponent(nextTopic.id)}`} title={nextTopic.title}>Próximo →</Link> : <span className="disabledNav">Próximo →</span>}
      </div>
    </nav>
    <header className="pageHeader contentDetailHeader">
      <div><span className="badge">{topic.discipline}</span><h1>{topic.title}</h1><p className="muted">Leitura focada e questões com vínculos identificados · {topic.canonicalContentId || topic.id}</p></div>
      <div className="quickActions">
        <Link className="actionButton secondaryAction" href={`/questoes?topic=${encodeURIComponent(topic.id)}`}>Caderno geral ({questions.length})</Link>
        <Link className="actionButton secondaryAction" href={`/registrar-estudo?topic=${encodeURIComponent(topic.id)}`}>Registrar estudo</Link>
        {laws.length > 0 && <Link className="actionButton secondaryAction" href="/lei-seca">Lei Seca ({laws.length})</Link>}
      </div>
    </header>

    {message && <p className="statusBox" role="status">{message}</p>}

    {blocks.length > 0 ? <ContextualReader
      topic={topic}
      blocks={blocks}
      questions={questions}
      doneBlocks={doneBlocks}
      contestId={activeContestId}
      uid={user?.uid}
      initialBlockId={searchParams.get("block")}
      onAnswer={answerInline}
      onFinishBlock={finishBlock}
    /> : <section className="panel">
      <div className="panelHeader"><div><h2>Conteúdo de estudo</h2><p className="muted">Ainda não há microblocos importados para este tópico. O texto do edital não substitui a teoria da apostila.</p></div></div>
      <div className="contentReading"><p>{node?.text || topic.originalText || "Nenhum texto disponível."}</p>{node?.sourceLabel && <div className="sourceBox">Fonte: {node.sourceLabel}{node.sourcePage ? ` · ${node.sourcePage}` : ""}</div>}</div>
      <p className="smallNote muted">Para incluir ou corrigir microblocos, utilize Configurações → Modo Desenvolvedor.</p>
    </section>}

    <section className="contentStats grid4 compactMetrics">
      <div className="card"><span className="muted">Microblocos</span><strong>{blocks.length || "—"}</strong></div>
      <div className="card"><span className="muted">Leitura concluída</span><strong>{blocks.length ? `${progressPct}%` : "—"}</strong></div>
      <div className="card"><span className="muted">Questões do tópico</span><strong>{questions.length}</strong></div>
      <div className="card"><span className="muted">Erros ativos</span><strong>{activeErrors.length}</strong></div>
    </section>
    <details className="panel contextOriginalEdital"><summary>Consultar texto original do edital</summary><p className="muted">{topic.originalText || "Não há texto original cadastrado neste tópico."}</p></details>
    {activeErrors.length > 0 && <section className="panel"><div className="panelHeader"><div><h2>Erros deste conteúdo</h2><p className="muted">Acompanhe recorrências e revisões no Caderno de Erros.</p></div><Link href={`/caderno-erros?discipline=${encodeURIComponent(topic.discipline)}`} className="miniButton">Abrir caderno</Link></div>{activeErrors.slice(0, 6).map((error: any) => <div className="cleanListRow" key={error.id}><div><strong>{error.subject || error.questionId}</strong><span>{error.correctStreak || 0}/3 acertos consecutivos · recorrência {error.recurrence || 1}</span></div><span className="statusPill">Ativo</span></div>)}</section>}
  </AppShell>;
}
