"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { useContest } from "@/contexts/ContestContext";
import {
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
  saveContentNode,
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
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [sourceLabel, setSourceLabel] = useState("");
  const [sourcePage, setSourcePage] = useState("");
  const [message, setMessage] = useState("");
  const [inlineAnswers, setInlineAnswers] = useState<Record<string, string>>({});
  const [inlineResults, setInlineResults] = useState<Record<string, boolean>>({});
  const [confidence, setConfidence] = useState<Record<string, AnswerConfidence>>({});
  const [questionIndexByBlock, setQuestionIndexByBlock] = useState<Record<string, number>>({});
  const [theoryCollapsed, setTheoryCollapsed] = useState(false);

  async function load() {
    const t = await getTopic(id);
    setTopic(t);
    if (!t) return;

    const contentId = t.canonicalContentId || t.id;
    const [content, blockRows, qs, lawRows, errorRows, progress, topicRows] = await Promise.all([
      getContentNode(t),
      getContentBlocks(contentId),
      getQuestions(activeContestId),
      getLawItems(activeContestId),
      user ? getErrors(user.uid, activeContestId) : Promise.resolve([]),
      user ? getContentBlockProgress(user.uid, activeContestId) : Promise.resolve([]),
      getTopics(activeContestId),
    ]);

    setNode(content);
    setText(content?.text || t.originalText || "");
    setSourceLabel(content?.sourceLabel || "");
    setSourcePage(content?.sourcePage || "");
    const ownBlocks = blockRows.filter(block => block.topicId === t.id);
    const selectedBlocks = ownBlocks.length ? ownBlocks : blockRows.filter(block => block.contentId === contentId);
    setBlocks(selectedBlocks.sort((a, b) => a.order - b.order));
    setQuestions(qs.filter(q => q.topicId === t.id || q.subtopicId === t.id));
    setLaws(lawRows.filter(l => l.topicId === t.id || l.subtopicId === t.id));
    setErrors(errorRows.filter((e: any) => e.topicId === t.id || e.subtopicId === t.id));
    setBlockProgress(progress);
    setAllTopics(topicRows.filter(row => row.activeInCurrentEdital !== false));
  }

  useEffect(() => {
    load();
  }, [id, activeContestId, user]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedFocus = sessionStorage.getItem(`pf:content-focus:${id}`);
    setTheoryCollapsed(storedFocus === "questions");
    try {
      const storedIndexes = sessionStorage.getItem(`pf:content-question-index:${id}`);
      setQuestionIndexByBlock(storedIndexes ? JSON.parse(storedIndexes) : {});
    } catch {
      setQuestionIndexByBlock({});
    }
  }, [id]);

  useEffect(() => {
    const target = searchParams.get("block");
    if (target) setTimeout(() => document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" }), 250);
  }, [blocks, searchParams]);

  const activeErrors = useMemo(() => errors.filter((e: any) => e.status !== "consolidado"), [errors]);
  const doneBlocks = useMemo(() => new Set(blockProgress.filter(p => p.completed).map(p => p.contentBlockId)), [blockProgress]);
  const progressPct = blocks.length ? Math.round((blocks.filter(block => doneBlocks.has(block.id)).length / blocks.length) * 100) : 0;

  const orderedTopics = useMemo(
    () => [...allTopics].sort((a, b) => a.discipline.localeCompare(b.discipline, "pt-BR") || a.order - b.order || a.title.localeCompare(b.title, "pt-BR")),
    [allTopics],
  );
  const topicIndex = topic ? orderedTopics.findIndex(row => row.id === topic.id) : -1;
  const previousTopic = topicIndex > 0 ? orderedTopics[topicIndex - 1] : null;
  const nextTopic = topicIndex >= 0 && topicIndex < orderedTopics.length - 1 ? orderedTopics[topicIndex + 1] : null;

  const questionsByBlock = useMemo(() => {
    const result: Record<string, Question[]> = {};
    for (const block of blocks) result[block.id] = [];
    for (const q of questions) {
      if (q.contentBlockId && result[q.contentBlockId]) result[q.contentBlockId].push(q);
    }
    return result;
  }, [blocks, questions]);

  function currentQuestionForBlock(blockId: string) {
    const rows = questionsByBlock[blockId] || [];
    if (!rows.length) return null;
    const rawIndex = questionIndexByBlock[blockId] || 0;
    return rows[Math.min(Math.max(rawIndex, 0), rows.length - 1)] || null;
  }

  function moveQuestion(blockId: string, delta: number) {
    const rows = questionsByBlock[blockId] || [];
    if (!rows.length) return;
    setQuestionIndexByBlock(current => {
      const currentIndex = Math.min(Math.max(current[blockId] || 0, 0), rows.length - 1);
      const nextIndex = Math.min(Math.max(currentIndex + delta, 0), rows.length - 1);
      const next = { ...current, [blockId]: nextIndex };
      if (typeof window !== "undefined") sessionStorage.setItem(`pf:content-question-index:${id}`, JSON.stringify(next));
      return next;
    });
  }

  function toggleTheory(blockId?: string) {
    const anchor = blockId ? document.getElementById(blockId) : null;
    const before = anchor?.getBoundingClientRect().top;
    const next = !theoryCollapsed;
    setTheoryCollapsed(next);
    if (typeof window !== "undefined") sessionStorage.setItem(`pf:content-focus:${id}`, next ? "questions" : "theory");
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!anchor || before == null) return;
      const after = anchor.getBoundingClientRect().top;
      window.scrollBy({ top: after - before, behavior: "auto" });
    }));
  }

  async function answerInline(q: Question) {
    if (!user || !inlineAnswers[q.id]) return;
    const response = await answerQuestion(user.uid, q, inlineAnswers[q.id], confidence[q.id] || "sabia");
    setInlineResults(current => ({ ...current, [q.id]: response.correct }));
  }

  async function finishBlock(block: ContentBlock, difficulty: Difficulty) {
    if (!user) return;
    await saveContentBlockProgress(user.uid, activeContestId, block, difficulty);
    setMessage(`Bloco “${block.title}” concluído. A dificuldade entrou no ciclo adaptativo.`);
    await load();
  }

  if (!topic) return <AppShell><div className="panel">Carregando conteúdo...</div></AppShell>;

  return <AppShell>
    <nav className="contentNavigator" aria-label="Navegação entre conteúdos">
      <Link className="contentNavBack" href="/conteudo">← Voltar para conteúdos</Link>
      <div className="contentNavPosition">Conteúdo {topicIndex >= 0 ? topicIndex + 1 : "—"} de {orderedTopics.length || "—"}</div>
      <div className="contentNavArrows">
        {previousTopic ? <Link href={`/conteudo/${encodeURIComponent(previousTopic.id)}`} title={previousTopic.title}>← Anterior</Link> : <span className="disabledNav">← Anterior</span>}
        {nextTopic ? <Link href={`/conteudo/${encodeURIComponent(nextTopic.id)}`} title={nextTopic.title}>Próximo →</Link> : <span className="disabledNav">Próximo →</span>}
      </div>
    </nav>

    <div className="pageHeader contentDetailHeader">
      <div>
        <span className="badge">{topic.discipline}</span>
        <h1>{topic.title}</h1>
        <p className="muted">{topic.canonicalContentId ? `Conteúdo canônico: ${topic.canonicalContentId}` : `Item: ${topic.id}`}</p>
      </div>
      <div className="quickActions">
        <Link className="actionButton" href={`/questoes?topic=${encodeURIComponent(topic.id)}`}>Todas as questões ({questions.length})</Link>
        <Link className="actionButton secondaryAction" href={`/registrar-estudo?topic=${encodeURIComponent(topic.id)}`}>Registrar estudo</Link>
        {laws.length > 0 && <Link className="actionButton secondaryAction" href="/lei-seca">Lei Seca ({laws.length})</Link>}
      </div>
    </div>

    <section className="contentStats grid4 compactMetrics">
      <div className="card"><span className="muted">Microblocos</span><strong>{blocks.length || "—"}</strong></div>
      <div className="card"><span className="muted">Progresso</span><strong>{blocks.length ? `${progressPct}%` : "—"}</strong></div>
      <div className="card"><span className="muted">Questões</span><strong>{questions.length}</strong></div>
      <div className="card"><span className="muted">Erros ativos</span><strong>{activeErrors.length}</strong></div>
    </section>

    {message && <div className="statusBox">{message}</div>}

    {blocks.length > 0 ? <section className={`studyFlow ${theoryCollapsed ? "questionsFocusMode" : ""}`}>
      <div className="studyFlowIntro">
        <div>
          <h2>{theoryCollapsed ? "Modo foco: questões" : "Estudo em blocos"}</h2>
          <p className="muted">{theoryCollapsed ? "A teoria está recolhida. Expanda quando bater dúvida, sem perder a questão atual." : "Leia um trecho curto, recupere a ideia sem olhar e valide com questões antes de avançar."}</p>
        </div>
        <div className="studyFlowActions">
          <span className="progressPill">{blocks.filter(block => doneBlocks.has(block.id)).length}/{blocks.length} concluídos</span>
          <button className="miniButton focusToggle" onClick={() => toggleTheory()}>{theoryCollapsed ? "Mostrar conteúdo" : "Ocultar conteúdo"}</button>
        </div>
      </div>

      {blocks.map((block, index) => {
        const blockQuestions = questionsByBlock[block.id] || [];
        const currentIndex = Math.min(Math.max(questionIndexByBlock[block.id] || 0, 0), Math.max(blockQuestions.length - 1, 0));
        const q = currentQuestionForBlock(block.id);
        const done = doneBlocks.has(block.id);
        return <article className={`studyBlock ${done ? "done" : ""}`} id={block.id} key={block.id}>
          <div className="studyBlockHeader">
            <div><span className="blockNumber">{index + 1}</span><div><h2>{block.title}</h2><span className="muted">≈ {block.estimatedMinutes || 5} min {done ? "• concluído" : ""}</span></div></div>
            <div className="blockHeaderActions">
              {done && <span className="statusPill active">✓ estudado</span>}
              {q && <button className="miniButton" onClick={() => toggleTheory(block.id)}>{theoryCollapsed ? "Mostrar teoria" : "Minimizar teoria"}</button>}
            </div>
          </div>

          {!theoryCollapsed && <>
            <div className="readingText">{block.text}</div>
            <div className="activeRecall"><strong>Recuperação ativa</strong><p>Sem reler: explique mentalmente a ideia central deste bloco em uma frase.</p></div>
          </>}

          {q && <div className="inlinePractice">
            <div className="inlinePracticeHeader questionThemeNavigator">
              <div><strong>Questões deste tema</strong><span className="muted">Questão {currentIndex + 1} de {blockQuestions.length}</span></div>
              <div className="inlineQuestionNav">
                <button className="miniButton" disabled={currentIndex <= 0} onClick={() => moveQuestion(block.id, -1)}>← Anterior</button>
                <button className="miniButton" disabled={currentIndex >= blockQuestions.length - 1} onClick={() => moveQuestion(block.id, 1)}>Próxima →</button>
              </div>
            </div>
            <p>{q.statement}</p>
            {q.questionType === "certo_errado" ? <div className="inlineChoices">
              <button className={inlineAnswers[q.id] === "C" ? "selected" : ""} onClick={() => setInlineAnswers(a => ({ ...a, [q.id]: "C" }))}>Certo</button>
              <button className={inlineAnswers[q.id] === "E" ? "selected" : ""} onClick={() => setInlineAnswers(a => ({ ...a, [q.id]: "E" }))}>Errado</button>
            </div> : <div className="inlineChoices multi">
              {Object.entries(q.alternatives || {}).map(([letter, label]) => <button className={inlineAnswers[q.id] === letter ? "selected" : ""} key={letter} onClick={() => setInlineAnswers(a => ({ ...a, [q.id]: letter }))}><b>{letter}</b> {label}</button>)}
            </div>}
            <div className="confidenceRow">
              <span>Você sabia?</span>
              {([['sabia', 'Sabia'], ['entre_duas', 'Fiquei entre duas'], ['chutei', 'Chutei']] as const).map(([value, label]) => <button key={value} className={confidence[q.id] === value ? "selected" : ""} onClick={() => setConfidence(c => ({ ...c, [q.id]: value }))}>{label}</button>)}
              <button className="miniButton" disabled={!inlineAnswers[q.id]} onClick={() => answerInline(q)}>Responder</button>
            </div>
            {q.id in inlineResults && <div className={inlineResults[q.id] ? "inlineResult good" : "inlineResult bad"}>{inlineResults[q.id] ? "✓ Acertou" : "✕ Errou"} • gabarito {q.correctAnswer}{inlineResults[q.id] && confidence[q.id] !== "sabia" ? " • acerto com baixa confiança não vale domínio cheio" : ""}</div>}
          </div>}

          {!q && <div className="inlinePractice emptyInlinePractice"><span className="muted">Ainda não há questão vinculada diretamente a este microbloco.</span></div>}

          <div className="blockFinish">
            <span>Como foi este bloco?</span>
            <button className="difficulty easy" onClick={() => finishBlock(block, "facil")}>Fácil</button>
            <button className="difficulty medium" onClick={() => finishBlock(block, "medio")}>Médio</button>
            <button className="difficulty hard" onClick={() => finishBlock(block, "dificil")}>Difícil</button>
          </div>
        </article>;
      })}
    </section> : <section className="panel">
      <div className="panelHeader"><div><h2>Conteúdo de estudo</h2><p className="muted">Ainda não há microblocos importados. Você pode estudar o texto consolidado ou importar um CSV validado na área Conteúdo.</p></div><button className="miniButton" onClick={() => setEditing(!editing)}>{editing ? "Cancelar" : "Editar"}</button></div>
      {editing ? <div className="contentEditor">
        <label>Texto<textarea value={text} onChange={e => setText(e.target.value)} /></label>
        <div className="formGrid"><label>Fonte / material<input value={sourceLabel} onChange={e => setSourceLabel(e.target.value)} /></label><label>Página / trecho<input value={sourcePage} onChange={e => setSourcePage(e.target.value)} /></label></div>
        <button className="actionButton" onClick={async () => { await saveContentNode(topic, text, sourceLabel, sourcePage); setEditing(false); await load(); }}>Salvar</button>
      </div> : <div className="contentReading"><p>{node?.text || topic.originalText}</p>{node?.sourceLabel && <div className="sourceBox">Fonte: {node.sourceLabel}{node.sourcePage ? ` • ${node.sourcePage}` : ""}</div>}</div>}
    </section>}

    <section className="panel"><h2>Texto original do edital</h2><p className="muted">{topic.originalText}</p></section>

    {activeErrors.length > 0 && <section className="panel">
      <div className="panelHeader"><div><h2>Erros ligados a este conteúdo</h2><p className="muted">O item só deixa os erros ativos após 3 acertos consecutivos.</p></div><Link href={`/caderno-erros?discipline=${encodeURIComponent(topic.discipline)}`} className="miniButton">Abrir caderno</Link></div>
      {activeErrors.slice(0, 8).map((e: any) => <div className="cleanListRow" key={e.id}><div><strong>{e.topicTitle || e.questionId}</strong><span>{e.consecutiveCorrect || 0}/3 acertos consecutivos • recorrência {e.recurrence || 1}</span></div><span className="statusPill">Ativo</span></div>)}
    </section>}

    <nav className="contentNavigator contentNavigatorBottom" aria-label="Navegação entre conteúdos">
      <Link className="contentNavBack" href="/conteudo">← Voltar para conteúdos</Link>
      <div className="contentNavArrows">
        {previousTopic ? <Link href={`/conteudo/${encodeURIComponent(previousTopic.id)}`}>← Anterior</Link> : <span className="disabledNav">← Anterior</span>}
        {nextTopic ? <Link href={`/conteudo/${encodeURIComponent(nextTopic.id)}`}>Próximo →</Link> : <span className="disabledNav">Próximo →</span>}
      </div>
    </nav>
  </AppShell>;
}
