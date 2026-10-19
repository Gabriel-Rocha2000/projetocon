"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnswerConfidence, ContentBlock, Difficulty, Question, Topic } from "@/types";
import { getMaterials } from "@/services/firestore";
import { getDownloadURL, ref as storageRef } from "firebase/storage";
import { storage } from "@/lib/firebase";

type AnswerRecord = { selected: string; confidence: AnswerConfidence; correct: boolean };
type ReaderMode = "teoria" | "questoes" | "resumo" | "pdf";
type QuestionScope = "diretas" | "relacionadas";

type Props = {
  topic: Topic;
  blocks: ContentBlock[];
  questions: Question[];
  doneBlocks: Set<string>;
  contestId: string;
  uid?: string;
  initialBlockId?: string | null;
  onAnswer: (q: Question, choice: string, confidence: AnswerConfidence) => Promise<{ correct: boolean }>;
  onFinishBlock: (block: ContentBlock, difficulty: Difficulty) => Promise<void>;
};

function pageReference(block: ContentBlock) {
  const start = block.sourcePageStart;
  const end = block.sourcePageEnd;
  if (start == null) return null;
  return start === end || end == null ? `p. ${start}` : `pp. ${start}–${end}`;
}

export default function ContextualReader({
  topic, blocks, questions, doneBlocks, contestId, uid, initialBlockId, onAnswer, onFinishBlock,
}: Props) {
  const storageKey = `pf:reader:${uid || "guest"}:${contestId}:${topic.id}`;
  const blockIds = useMemo(() => blocks.map(block => block.id).join("|"), [blocks]);
  const readerTop = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [mode, setMode] = useState<ReaderMode>("teoria");
  const [splitStudy, setSplitStudy] = useState(false);
  const [scope, setScope] = useState<QuestionScope>("diretas");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [confidences, setConfidences] = useState<Record<string, AnswerConfidence>>({});
  const [results, setResults] = useState<Record<string, AnswerRecord>>({});
  const [busy, setBusy] = useState(false);
  const [busyBlock, setBusyBlock] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [sourceMessage, setSourceMessage] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceLoading, setSourceLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = sessionStorage.getItem(storageKey);
    const requested = initialBlockId && blocks.some(b => b.id === initialBlockId) ? initialBlockId : stored;
    const index = blocks.findIndex(b => b.id === requested);
    setActiveIndex(index >= 0 ? index : 0);
    setMode("teoria");
    setQuestionIndex(0);
    setScope("diretas");
    setFeedback("");
  }, [storageKey, blockIds, initialBlockId]);

  useEffect(() => {
    document.body.classList.toggle("splitStudyActive", splitStudy);
    return () => document.body.classList.remove("splitStudyActive");
  }, [splitStudy]);

  function toggleSplitStudy() {
    if (!splitStudy) {
      setMode("questoes");
      if (!sourceUrl && !sourceLoading) void findSource();
    }
    setSplitStudy(value => !value);
  }

  const block = blocks[Math.min(activeIndex, blocks.length - 1)];
  const directQuestions = useMemo(() => {
    if (!block) return [];
    return questions.filter(q => q.contentBlockId === block.id || q.contentBlockIds?.includes(block.id));
  }, [questions, block?.id]);
  const relatedQuestions = useMemo(() => {
    const directIds = new Set(directQuestions.map(q => q.id));
    return questions.filter(q => !directIds.has(q.id));
  }, [questions, directQuestions]);
  const shownQuestions = scope === "diretas" ? directQuestions : relatedQuestions;
  const currentQuestion = shownQuestions[Math.min(questionIndex, shownQuestions.length - 1)] || null;
  const currentResult = currentQuestion ? results[currentQuestion.id] : undefined;
  const completed = blocks.filter(b => doneBlocks.has(b.id)).length;
  const percent = blocks.length ? Math.round(100 * completed / blocks.length) : 0;

  function changeBlock(next: number) {
    const index = Math.max(0, Math.min(blocks.length - 1, next));
    const target = blocks[index];
    if (!target) return;
    setActiveIndex(index);
    setMode("teoria");
    setScope("diretas");
    setQuestionIndex(0);
    setSourceMessage("");
    setSourceUrl("");
    setFeedback("");
    if (typeof window !== "undefined") {
      sessionStorage.setItem(storageKey, target.id);
      const url = new URL(window.location.href);
      url.searchParams.set("block", target.id);
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
    readerTop.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function openQuestions(nextScope: QuestionScope = "diretas") {
    setScope(nextScope);
    setQuestionIndex(0);
    setMode("questoes");
    setFeedback("");
    readerTop.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function submit() {
    if (!currentQuestion || !uid || busy || currentResult || !currentQuestion.correctAnswer?.trim()) return;
    const selected = choices[currentQuestion.id];
    const confidence = confidences[currentQuestion.id];
    if (!selected || !confidence) return;
    setBusy(true);
    setFeedback("");
    try {
      const outcome = await onAnswer(currentQuestion, selected, confidence);
      setResults(previous => ({ ...previous, [currentQuestion.id]: { selected, confidence, correct: outcome.correct } }));
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível salvar a resposta. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  async function markBlock(difficulty: Difficulty) {
    if (!block || !uid || busyBlock) return;
    setBusyBlock(true);
    setFeedback("");
    try {
      await onFinishBlock(block, difficulty);
      setFeedback("Leitura registrada e revisão adaptativa atualizada.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível registrar o bloco.");
    } finally {
      setBusyBlock(false);
    }
  }

  async function findSource() {
    if (!block) return;
    setSourceLoading(true);
    setSourceMessage("Localizando o documento original…");
    setSourceUrl("");
    try {
      const materials = await getMaterials(contestId);
      const material = materials.find(item => item.id === block.materialId);
      const documentName = material?.sourceName || material?.fileName || material?.title;
      const page = pageReference(block);
      const label = [documentName, page].filter(Boolean).join(" · ");
      if (!material?.storagePath) {
        setSourceMessage(`Referência: ${label || "origem não informada"}. O PDF não está disponível no Storage; confira o arquivo original antes de validar este trecho.`);
        return;
      }
      const url = await getDownloadURL(storageRef(storage, material.storagePath));
      const physicalPage = block.sourcePageStart;
      setSourceUrl(`${url}${physicalPage != null ? `#page=${physicalPage}` : ""}`);
      setSourceMessage(`${label || "Material original"}. Confira a numeração: a página do PDF pode diferir da página impressa.`);
    } catch {
      setSourceMessage("Não foi possível abrir o PDF no Firebase Storage. Confira o arquivo e suas permissões; o conteúdo de estudo não foi alterado.");
    } finally {
      setSourceLoading(false);
    }
  }

  function showPdf() {
    setMode("pdf");
    if (!sourceUrl && !sourceLoading) void findSource();
  }

  if (!block) return null;

  return <div className={`contextReader ${mode === "pdf" || splitStudy ? "withPdf" : ""} ${splitStudy ? "splitStudyReader" : ""}`} ref={readerTop}>
    <aside className="contextOutline" aria-label="Índice dos microblocos">
      <div className="contextOutlineHead"><strong>Neste conteúdo</strong><small>{completed}/{blocks.length} estudados</small></div>
      <div className="contextOutlineScroll">
        {blocks.map((item, index) => <button type="button" key={item.id} className={`contextOutlineItem ${index === activeIndex ? "selected" : ""}`} aria-current={index === activeIndex ? "step" : undefined} onClick={() => changeBlock(index)}>
          <span className="contextOutlineIndex">{doneBlocks.has(item.id) ? "✓" : index + 1}</span>
          <span className="contextOutlineText"><strong>{item.title || `Microbloco ${index + 1}`}</strong><small>{pageReference(item) || `Bloco ${index + 1}`}</small></span>
        </button>)}
      </div>
      <Link className="contextOutlineReturn" href="/conteudo">← Todos os conteúdos</Link>
    </aside>

    <section className="contextReadingPane" aria-label="Leitor contextual">
      <div className="splitStudyToolbar"><button type="button" className="miniButton" onClick={toggleSplitStudy}>{splitStudy ? "↩ Voltar ao formato normal" : "⛶ Questões + PDF (tela dividida)"}</button></div>
      <div className="contextReaderTop">
        <div><span className="contextEyebrow">LEITURA GUIADA · {topic.discipline}</span><h2>{block.title || topic.title}</h2><span className="contextMeta">Microbloco {activeIndex + 1} de {blocks.length} · {block.estimatedMinutes || 5} min de leitura</span></div>
        <span className="contextCounter">{activeIndex + 1}/{blocks.length}</span>
      </div>
      <div className="contextProgressTrack" role="progressbar" aria-label="Microblocos concluídos" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${percent}%` }}/></div>
      <div className="contextTabs" role="tablist" aria-label="Estudar, praticar e consultar a fonte">
        <button type="button" role="tab" aria-selected={mode === "teoria"} className={mode === "teoria" ? "selected" : ""} onClick={() => setMode("teoria")}>Teoria</button>
        <button type="button" role="tab" aria-selected={mode === "questoes"} className={mode === "questoes" ? "selected" : ""} onClick={() => openQuestions()}>Questões {directQuestions.length ? `(${directQuestions.length})` : ""}</button>
        <button type="button" role="tab" aria-selected={mode === "resumo"} className={mode === "resumo" ? "selected" : ""} onClick={() => setMode("resumo")}>Resumo</button>
        <button type="button" role="tab" aria-selected={mode === "pdf"} className={mode === "pdf" ? "selected" : ""} onClick={showPdf}>PDF fonte</button>
      </div>

      {(mode === "teoria" || mode === "pdf") ? <div className="contextPanel" role="tabpanel">
        <div className="contextSourceLine"><span>{pageReference(block) || "Página de origem não cadastrada"}</span><button type="button" onClick={showPdf}>Abrir PDF ao lado ↗</button></div>
        {sourceMessage && <div className="contextSourceInfo" role="status">{sourceMessage} {sourceUrl && <a href={sourceUrl} target="_blank" rel="noopener noreferrer">Abrir documento ↗</a>}</div>}
        <div className="contextTheoryText">{block.text?.trim() || "Este microbloco está sem texto. Revise o CSV e o vínculo com o PDF antes de marcar como estudado."}</div>
        <div className="contextActiveRecall"><strong>Recuperação ativa</strong><p>Antes de consultar as questões, tente explicar o conceito e suas exceções com suas próprias palavras.</p></div>
        <div className="contextPracticeGateway"><div><strong>Pratique este conceito</strong><p>{directQuestions.length ? `${directQuestions.length} questão(ões) com vínculo direto confirmado.` : "Nenhuma questão está vinculada diretamente a este microbloco."}</p></div><button type="button" className="actionButton" onClick={() => openQuestions()}>{directQuestions.length ? "Resolver agora →" : "Ver opções →"}</button></div>
        <div className="contextFinish"><span>Como foi sua leitura?</span>{([ ["facil", "Fácil"], ["medio", "Médio"], ["dificil", "Difícil"] ] as const).map(([value, label]) => <button type="button" key={value} disabled={!uid || busyBlock || !block.text?.trim()} onClick={() => markBlock(value)}>{label}</button>)}</div>
      </div> : mode === "resumo" ? <div className="contextPanel contextSummaryPanel" role="tabpanel">
        <span className="contextEyebrow">REVISÃO RÁPIDA</span>
        <h3>Resumo deste microbloco</h3>
        <p>Este microbloco ainda não tem um resumo validado em sua base. Para não apresentar informações inventadas ou incompletas, consulte a teoria e o PDF original.</p>
        <div className="contextSummaryActions">
          <button type="button" className="miniButton" onClick={() => setMode("teoria")}>← Voltar à teoria</button>
          <button type="button" className="miniButton" onClick={showPdf}>Conferir fonte no PDF ↗</button>
        </div>
      </div> : <div className="contextPanel" role="tabpanel">
        <div className="contextPracticeHeading"><div><span className="contextEyebrow">RECUPERAÇÃO ATIVA</span><h3>{scope === "diretas" ? "Questões deste microbloco" : "Questões relacionadas ao tópico"}</h3></div><button type="button" className="miniButton" onClick={() => setMode("teoria")}>← Voltar à teoria</button></div>
        {scope === "relacionadas" && <div className="contextScopeNote">Estas questões pertencem ao mesmo tópico, mas <strong>não têm vínculo direto comprovado</strong> com este microbloco. Você optou por ampliar a busca.</div>}
        {!shownQuestions.length ? <div className="contextEmptyQuestions"><strong>{scope === "diretas" ? "Nenhuma questão diretamente vinculada" : "Nenhuma questão relacionada encontrada"}</strong><p>Isso não significa que não haja questões na apostila. Os vínculos precisam ser conferidos durante a importação.</p>{scope === "diretas" && relatedQuestions.length > 0 && <button type="button" className="actionButton" onClick={() => openQuestions("relacionadas")}>Ampliar para questões do tópico ({relatedQuestions.length})</button>}<Link href={`/questoes?topic=${encodeURIComponent(topic.id)}`}>Abrir o caderno de questões →</Link></div> : <>
          <div className="contextQuestionNav"><span>Questão {Math.min(questionIndex + 1, shownQuestions.length)} de {shownQuestions.length}</span><div><button type="button" disabled={questionIndex <= 0} onClick={() => { setQuestionIndex(n => Math.max(0, n - 1)); setFeedback(""); }}>← Anterior</button><button type="button" disabled={questionIndex >= shownQuestions.length - 1} onClick={() => { setQuestionIndex(n => Math.min(shownQuestions.length - 1, n + 1)); setFeedback(""); }}>Próxima →</button></div></div>
          {currentQuestion && <article className="contextQuestionCard" key={currentQuestion.id}>
            <div className="contextQuestionMeta">{[currentQuestion.board, currentQuestion.organ || currentQuestion.examName, currentQuestion.year].filter(Boolean).join(" · ") || "Questão cadastrada"}{currentQuestion.sourcePage != null && <span> · p. {currentQuestion.sourcePage}</span>}</div>
            <p className="contextQuestionStatement">{currentQuestion.statement || "Enunciado ausente. Solicite revisão desta questão."}</p>
            <div className="contextChoices" role="group" aria-label="Alternativas da questão">
              {currentQuestion.questionType === "certo_errado" ? ([ ["C", "Certo"], ["E", "Errado"] ] as const).map(([value, label]) => <button type="button" key={value} className={choices[currentQuestion.id] === value ? "selected" : ""} disabled={!!currentResult || busy} onClick={() => setChoices(old => ({ ...old, [currentQuestion.id]: value }))}><strong>{value}</strong><span>{label}</span></button>) : Object.entries(currentQuestion.alternatives || {}).map(([value, label]) => <button type="button" key={value} className={choices[currentQuestion.id] === value ? "selected" : ""} disabled={!!currentResult || busy} onClick={() => setChoices(old => ({ ...old, [currentQuestion.id]: value }))}><strong>{value}</strong><span>{label}</span></button>)}
            </div>
            {!currentResult && <div className="contextConfidence"><strong>Como você chegou à resposta?</strong><div>{([ ["sabia", "Sabia"], ["entre_duas", "Entre duas"], ["chutei", "Chutei"] ] as const).map(([value, label]) => <button type="button" key={value} disabled={busy} className={confidences[currentQuestion.id] === value ? "selected" : ""} onClick={() => setConfidences(old => ({ ...old, [currentQuestion.id]: value }))}>{label}</button>)}</div></div>}
            {!currentResult ? <div className="contextSubmit"><button type="button" className="actionButton" onClick={submit} disabled={!uid || busy || !choices[currentQuestion.id] || !confidences[currentQuestion.id] || !currentQuestion.correctAnswer?.trim() || !currentQuestion.statement?.trim()}>{busy ? "Salvando…" : "Corrigir resposta"}</button>{!currentQuestion.correctAnswer?.trim() && <small>Gabarito não cadastrado: questão bloqueada para correção.</small>}</div> : <div className={`contextResolution ${currentResult.correct ? "good" : "bad"}`} role="status"><strong>{currentResult.correct ? "✓ Resposta correta" : "✕ Resposta incorreta"} · Gabarito: {currentQuestion.correctAnswer}</strong>{currentResult.correct && currentResult.confidence !== "sabia" && <p>Acerto com baixa confiança: o conteúdo continuará candidato a revisão.</p>}{currentQuestion.explanation ? <div><b>Comentário / fundamento</b><p>{currentQuestion.explanation}</p></div> : <p>Não há comentário validado nesta questão. Consulte o material original para conferir o fundamento.</p>}{currentQuestion.relatedContent && <p><b>Conteúdo relacionado:</b> {currentQuestion.relatedContent}</p>}<button type="button" className="miniButton" onClick={() => setMode("teoria")}>Rever este microbloco →</button><Link className="miniButton" href={`/questoes/${encodeURIComponent(currentQuestion.id)}?fromContent=${encodeURIComponent(topic.id)}&block=${encodeURIComponent(block.id)}`}>Analisar questão completa ↗</Link></div>}
          </article>}
          {scope === "diretas" && relatedQuestions.length > 0 && <button className="contextExpandScope" type="button" onClick={() => openQuestions("relacionadas")}>+ Ver {relatedQuestions.length} questão(ões) relacionadas ao tópico, sem vínculo direto</button>}
          {scope === "relacionadas" && directQuestions.length > 0 && <button className="contextExpandScope" type="button" onClick={() => openQuestions("diretas")}>← Voltar às questões com vínculo direto</button>}
        </>}
      </div>}
      {feedback && <p className="contextReaderFeedback" role="status">{feedback}</p>}
      <nav className="contextBottomNav" aria-label="Navegação entre microblocos"><button type="button" disabled={activeIndex === 0} onClick={() => changeBlock(activeIndex - 1)}>← Bloco anterior</button><span>Bloco {activeIndex + 1} / {blocks.length}</span><button type="button" disabled={activeIndex === blocks.length - 1} onClick={() => changeBlock(activeIndex + 1)}>Próximo bloco →</button></nav>
    </section>
    {(mode === "pdf" || splitStudy) && <aside className="contextPdfPane" aria-label="PDF original ao lado da teoria">
      <div className="contextPdfHeader"><div><strong>PDF da apostila</strong><small>{pageReference(block) || "Página não identificada"}</small></div><button type="button" className="miniButton" onClick={() => { if (splitStudy) setSplitStudy(false); setMode("teoria"); }} aria-label="Fechar visualização de PDF">✕</button></div>
      {sourceUrl ? <>
        <iframe title={`PDF de referência — ${block.title}`} src={sourceUrl} className="contextPdfFrame" loading="lazy" referrerPolicy="no-referrer" />
        <div className="contextPdfFooter"><span>A página impressa pode diferir da página física. Confira a referência antes de validar.</span><a href={sourceUrl} target="_blank" rel="noopener noreferrer">Abrir em outra guia ↗</a></div>
      </> : <div className="contextPdfEmpty" role="status"><strong>{sourceLoading ? "Localizando PDF…" : "PDF não disponível para exibição"}</strong><p>{sourceMessage || "O material original ainda não foi vinculado a um arquivo do Firebase Storage. A teoria continua disponível para estudo."}</p><button type="button" className="miniButton" disabled={sourceLoading} onClick={() => void findSource()}>Tentar localizar novamente</button></div>}
    </aside>}
  </div>;
}
