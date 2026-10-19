"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { getDownloadURL, ref as storageRef } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { getMaterials } from "@/services/firestore";
import { buildReadingSections } from "@/lib/readingSections";
import type { AnswerConfidence, ContentBlock, Difficulty, Material, Question, Topic } from "@/types";

type Props = {
  topic: Topic;
  blocks: ContentBlock[];
  questions: Question[];
  doneBlocks: Set<string>;
  contestId: string;
  uid?: string;
  initialBlockId?: string | null;
  onAnswer: (q: Question, choice: string, confidence: AnswerConfidence) => Promise<{ correct: boolean }>;
  onFinishBlock: (b: ContentBlock, difficulty: Difficulty) => Promise<void>;
  onFinishSection: (bs: ContentBlock[], difficulty: Difficulty) => Promise<void>;
};
type Mode = "teoria" | "questoes" | "resumo" | "pdf";
type Answer = { correct: boolean; selected: string };
const pages = (a?: number | null, b?: number | null) => a == null ? "Fonte não paginada" : b == null || b === a ? "p. " + a : "pp. " + a + "–" + b;
const hasLink = (q: Question, id: string) => q.contentBlockId === id || !!q.contentBlockIds?.includes(id);

export default function ContinuousReader({ topic, blocks, questions, doneBlocks, contestId, uid, initialBlockId, onAnswer, onFinishBlock, onFinishSection }: Props) {
  const sections = useMemo(() => buildReadingSections(blocks), [blocks]);
  const topRef = useRef<HTMLDivElement>(null);
  const storageKey = ["clt:leitura", uid || "guest", contestId, topic.id].join(":");
  const [sectionIndex, setSectionIndex] = useState(0);
  const [conceptId, setConceptId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("teoria");
  const [related, setRelated] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [confidence, setConfidence] = useState<Record<string, AnswerConfidence>>({});
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");
  const [pdfMessage, setPdfMessage] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfCandidates, setPdfCandidates] = useState<Material[]>([]);
  const [fallbackId, setFallbackId] = useState("");
  const [pdfPage, setPdfPage] = useState<number | null>(null);

  const section = sections[Math.min(sectionIndex, Math.max(0, sections.length - 1))];
  const items = section?.blocks || [];
  const activeConcept = items.find(b => b.id === conceptId) || items[0];
  const done = blocks.filter(b => doneBlocks.has(b.id)).length;
  const sectionDone = items.filter(b => doneBlocks.has(b.id)).length;
  const sourcePage = activeConcept?.sourcePageStart ?? section?.pageStart ?? null;
  const materialId = activeConcept?.materialId || items.find(b => b.materialId)?.materialId || "";

  useEffect(() => {
    const stored = typeof window === "undefined" ? null : sessionStorage.getItem(storageKey);
    const target = initialBlockId && blocks.some(b => b.id === initialBlockId) ? initialBlockId : stored;
    const idx = sections.findIndex(s => s.blocks.some(b => b.id === target));
    setSectionIndex(Math.max(0, idx));
    setConceptId(target && blocks.some(b => b.id === target) ? target : null);
    setMode("teoria");
  }, [initialBlockId, blocks, sections, storageKey]);

  const direct = useMemo(() => {
    const ids = conceptId ? [conceptId] : items.map(b => b.id);
    return questions.filter(q => ids.some(id => hasLink(q, id)));
  }, [questions, conceptId, items]);
  const relatedQs = useMemo(() => {
    const ids = new Set(items.map(b => b.topicId).filter(Boolean));
    ids.add(topic.id);
    const directIds = new Set(direct.map(q => q.id));
    return questions.filter(q => !directIds.has(q.id) && (ids.has(q.topicId) || (q.subtopicId ? ids.has(q.subtopicId) : false)));
  }, [questions, direct, items, topic.id]);
  const pool = related ? relatedQs : direct;
  const question = pool[Math.min(questionIndex, Math.max(pool.length - 1, 0))] || null;
  const result = question ? answers[question.id] : null;

  const jump = (id: string) => {
    const index = sections.findIndex(s => s.blocks.some(b => b.id === id));
    if (index === -1) return;
    setSectionIndex(index);
    setConceptId(id);
    setMode("teoria");
    sessionStorage.setItem(storageKey, id);
    const url = new URL(window.location.href);
    url.searchParams.set("block", id);
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    window.setTimeout(() => document.getElementById("clt-concept-" + id)?.scrollIntoView({ behavior:"smooth", block:"start" }), 70);
  };
  const goSection = (index: number) => {
    if (index < 0 || index >= sections.length) return;
    setSectionIndex(index);
    setConceptId(null);
    setMode("teoria");
    setRelated(false);
    setFeedback("");
    const first = sections[index].blocks[0]?.id;
    if (first) sessionStorage.setItem(storageKey, first);
    topRef.current?.scrollIntoView({ behavior:"smooth",block:"start" });
  };
  const openQuestions = (id: string | null = null, showRelated = false) => {
    setConceptId(id);
    setRelated(showRelated);
    setQuestionIndex(0);
    setMode("questoes");
    setFeedback("");
    topRef.current?.scrollIntoView({ behavior:"smooth",block:"start" });
  };
  const openPdf = async (requestedId: string, page: number | null) => {
    setMode("pdf");
    setPdfBusy(true);
    setPdfMessage("Localizando PDF no Firebase Storage...");
    setPdfUrl("");
    setPdfPage(page);
    try {
      const all = await getMaterials(); // PDFs da biblioteca podem ter sido cadastrados antes do concurso ativo
      setPdfCandidates(all.filter(m => m.type === "pdf" && !!m.storagePath && m.discipline === topic.discipline));
      const selected = all.find(m => m.id === requestedId && !!m.storagePath);
      if (!selected?.storagePath) {
        setPdfMessage("Material sem vínculo com o PDF. Escolha uma apostila da disciplina para consultar, sem alterar os dados.");
        return;
      }
      const url = await getDownloadURL(storageRef(storage, selected.storagePath));
      setPdfUrl(url + (page != null ? "#page=" + page : ""));
      setPdfMessage("Fonte: " + selected.title + ". Confira a diferença entre página impressa e física.");
    } catch (e) {
      setPdfMessage(e instanceof Error ? e.message : "Falha ao carregar o PDF.");
    } finally { setPdfBusy(false); }
  };
  const submit = async () => {
    if (!question || !uid || busy || result || !question.correctAnswer?.trim()) return;
    const choice = choices[question.id], certainty = confidence[question.id];
    if (!choice || !certainty) return;
    setBusy(true); setFeedback("");
    try {
      const saved = await onAnswer(question, choice, certainty);
      setAnswers(a => ({ ...a, [question.id]: { correct: saved.correct, selected: choice } }));
    } catch (e) { setFeedback(e instanceof Error ? e.message : "Não foi possível salvar a resposta."); }
    finally { setBusy(false); }
  };
  const registerBlock = async (block: ContentBlock) => {
    if (!uid || busy || !block.text.trim()) return;
    setBusy(true); setFeedback("");
    try {
      await onFinishBlock(block, "medio");
      setFeedback("Conceito registrado. Ele continua no ciclo de revisões.");
    } catch (e) { setFeedback(e instanceof Error ? e.message : "Falha no registro."); }
    finally { setBusy(false); }
  };
  const registerSection = async (difficulty: Difficulty) => {
    if (!uid || busy) return;
    const pending = items.filter(b => !doneBlocks.has(b.id) && b.text.trim());
    if (!pending.length) { setFeedback("Seção concluída e mantida no planejamento de revisões."); return; }
    setBusy(true); setFeedback("");
    try {
      await onFinishSection(pending, difficulty);
      setFeedback("Seção concluída. " + pending.length + " conceito(s) registrados para revisões.");
    } catch (e) { setFeedback(e instanceof Error ? e.message : "Alguns registros podem ter sido salvos. Confira o progresso."); }
    finally { setBusy(false); }
  };

  if (!section) return null;
  return <div ref={topRef} className={"continuousReader" + (mode === "pdf" ? " withPdf" : "")}>
    <aside className="continuousOutline" aria-label="Índice da aula">
      <header className="continuousOutlineHeader"><strong>Índice da aula</strong><small>{done}/{blocks.length} conceitos estudados</small></header>
      <div className="continuousSections">{sections.map((s, i) => <div className="continuousSectionGroup" key={s.id}>
        <button type="button" className={"continuousSectionButton" + (i === sectionIndex ? " active" : "")} onClick={() => goSection(i)}>
          <span>{i+1}</span><strong>{s.title}</strong><small>{pages(s.pageStart,s.pageEnd)}</small>
        </button>
        {i === sectionIndex && <div className="continuousConceptList">{s.blocks.map(b =>
          <button type="button" key={b.id} className={conceptId === b.id ? "active" : ""} onClick={() => jump(b.id)}>
            <span>{doneBlocks.has(b.id) ? "✓" : "•"}</span>{b.title}
          </button>)}</div>}
      </div>)}</div>
      <Link className="continuousOutlineReturn" href="/conteudo">← Todos os conteúdos</Link>
    </aside>
    <section className="continuousMain" aria-label="Leitura contínua">
      <header className="continuousHeading"><div><span className="contextEyebrow">LEITURA CONTÍNUA · {topic.discipline}</span>
        <h2>{section.title}</h2><p>Seção {sectionIndex+1} de {sections.length} · {pages(section.pageStart,section.pageEnd)} · {sectionDone}/{items.length} conceitos estudados</p></div>
        <span className="contextCounter">{sectionIndex+1}/{sections.length}</span>
      </header>
      <div className="contextProgressTrack"><div style={{width:(blocks.length ? 100*done/blocks.length : 0)+"%"}}/></div>
      <div className="contextTabs" role="tablist">
        {(["teoria","questoes","resumo","pdf"] as const).map((tab) =>
          <button key={tab} type="button" role="tab" aria-selected={mode===tab} className={mode===tab ? "selected":""}
            onClick={() => tab==="pdf" ? void openPdf(materialId,sourcePage) : tab==="questoes" ? openQuestions() : setMode(tab)}>
            {tab==="teoria"?"Teoria":tab==="questoes"?"Questões":tab==="resumo"?"Resumo":"PDF fonte"}
          </button>)}
      </div>
      {(mode==="teoria"||mode==="pdf") ? <div className="continuousTheory">
        <div className="continuousIntro"><p>Leia a seção completa, com subtítulos e exemplos na sequência do material.</p><button type="button" onClick={() => void openPdf(materialId,sourcePage)}>Consultar PDF ao lado ↗</button></div>
        {items.map((b,i) => <article key={b.id} id={"clt-concept-"+b.id} className="continuousConcept">
          <div className="continuousConceptHead"><span className="continuousConceptNumber">{i+1}</span>
            <div><h3>{b.title}</h3><small>{pages(b.sourcePageStart,b.sourcePageEnd)}</small></div>
            {doneBlocks.has(b.id) && <span className="continuousDone">✓ Estudado</span>}
          </div>
          <div className="continuousConceptText">{b.text?.trim() || <strong>Texto ausente. Confira a importação.</strong>}</div>
          <div className="continuousConceptActions">
            <button type="button" onClick={() => openQuestions(b.id)}>Questões deste conceito ({questions.filter(q => hasLink(q,b.id)).length})</button>
            <button type="button" onClick={() => {setConceptId(b.id);void openPdf(b.materialId||materialId,b.sourcePageStart??null);}}>PDF: {pages(b.sourcePageStart,b.sourcePageEnd)}</button>
            <button type="button" disabled={!uid||busy||!b.text?.trim()} onClick={() => void registerBlock(b)}>{doneBlocks.has(b.id)?"Reforçar leitura":"Registrar leitura"}</button>
          </div>
        </article>)}
        <div className="continuousFinish"><div><strong>Concluir esta seção</strong><p>A leitura fica concluída, mas os conceitos continuam entrando nas revisões.</p></div>
          <div>{([["facil","Fácil"],["medio","Médio"],["dificil","Difícil"]] as const).map(([value,label]) =>
            <button key={value} type="button" disabled={!uid||busy||items.every(b=>doneBlocks.has(b.id))} onClick={()=>void registerSection(value)}>{label}</button>)}</div>
        </div>
      </div> : mode==="resumo" ? <div className="continuousTheory"><h3>Resumo da seção</h3><p>Não há resumo validado independente para esta seção. Consulte a teoria e o PDF original para não perder conteúdo.</p><button className="miniButton" type="button" onClick={()=>setMode("teoria")}>← Voltar à teoria</button></div> :
      <div className="continuousTheory">
        <div className="contextPracticeHeading"><div><span className="contextEyebrow">QUESTÕES VINCULADAS</span><h3>{conceptId ? "Questões: "+(activeConcept?.title||"conceito") : "Questões desta seção"}</h3></div>
          <button type="button" className="miniButton" onClick={()=>setMode("teoria")}>← Voltar à leitura</button></div>
        <div className="continuousScopes"><button className={!related?"active":""} onClick={()=>openQuestions(conceptId,false)}>Vínculos diretos ({direct.length})</button>
          <button className={related?"active":""} onClick={()=>openQuestions(conceptId,true)}>Relacionadas ({relatedQs.length})</button>
          {conceptId && <button onClick={()=>openQuestions()}>Toda a seção</button>}</div>
        {related && <p className="contextScopeNote">Estas questões pertencem ao tópico, mas ainda não têm vínculo confirmado com o conceito.</p>}
        {!pool.length ? <div className="contextEmptyQuestions"><strong>Nenhuma questão cadastrada neste recorte.</strong><p>Continue a leitura ou importe questões oficiais no Modo Desenvolvedor.</p><Link href={"/questoes?topic="+encodeURIComponent(topic.id)}>Abrir caderno geral ↗</Link></div> :
          <><div className="contextQuestionNav"><span>Questão {Math.min(questionIndex+1,pool.length)} de {pool.length}</span><div>
            <button disabled={questionIndex===0} onClick={()=>setQuestionIndex(i=>Math.max(0,i-1))}>← Anterior</button>
            <button disabled={questionIndex>=pool.length-1} onClick={()=>setQuestionIndex(i=>Math.min(pool.length-1,i+1))}>Próxima →</button></div></div>
            {question && <article className="contextQuestionCard" key={question.id}>
              <div className="contextQuestionMeta">{[question.board,question.organ,question.year].filter(Boolean).join(" · ")||"Questão cadastrada"}</div>
              <p className="contextQuestionStatement">{question.statement}</p>
              <div className="contextChoices">{(question.questionType==="certo_errado" ? [["C","Certo"],["E","Errado"]] : Object.entries(question.alternatives||{}))
                .map(([letter,label])=><button type="button" key={letter} disabled={!!result||busy} className={choices[question.id]===letter?"selected":""}
                  onClick={()=>setChoices(a=>({...a,[question.id]:letter}))}><strong>{letter}</strong><span>{label}</span></button>)}</div>
              {!result && <div className="contextConfidence"><strong>Como respondeu?</strong><div>
                {([["sabia","Sabia"],["entre_duas","Entre duas"],["chutei","Chutei"]] as const).map(([value,label])=>
                  <button key={value} type="button" className={confidence[question.id]===value?"selected":""} onClick={()=>setConfidence(a=>({...a,[question.id]:value}))}>{label}</button>)}
              </div></div>}
              {!result ? <div className="contextSubmit"><button type="button" className="actionButton" disabled={!uid||busy||!choices[question.id]||!confidence[question.id]||!question.correctAnswer?.trim()} onClick={()=>void submit()}>Corrigir resposta</button></div> :
                <div className={"contextResolution "+(result.correct?"good":"bad")}><strong>{result.correct?"✓ Correta":"✕ Incorreta"} · Gabarito: {question.correctAnswer}</strong>
                  <p>{question.explanation||"Comentário não cadastrado. Consulte a teoria."}</p>
                  <button className="miniButton" type="button" onClick={()=>{
                    const id=question.contentBlockId||question.contentBlockIds?.[0];
                    if (id && blocks.some(b=>b.id===id)) jump(id); else setMode("teoria");
                  }}>Reestudar fundamento ↗</button></div>}
            </article>}</>}
      </div>}
      {feedback && <p className="contextReaderFeedback" role="status">{feedback}</p>}
      <nav className="contextBottomNav"><button disabled={sectionIndex===0} onClick={()=>goSection(sectionIndex-1)}>← Seção anterior</button>
        <span>Seção {sectionIndex+1}/{sections.length}</span>
        <button disabled={sectionIndex>=sections.length-1} onClick={()=>goSection(sectionIndex+1)}>Próxima seção →</button></nav>
    </section>
    {mode==="pdf" && <aside className="continuousPdf" aria-label="PDF da apostila">
      <div className="contextPdfHeader"><div><strong>PDF da apostila</strong><small>{pages(pdfPage,pdfPage)}</small></div><button type="button" className="miniButton" onClick={()=>setMode("teoria")}>✕</button></div>
      {pdfUrl ? <><iframe title="PDF original" src={pdfUrl} loading="lazy" className="contextPdfFrame" referrerPolicy="no-referrer"/>
        <div className="contextPdfFooter"><span>Confira a numeração física e impressa do PDF.</span><a href={pdfUrl} target="_blank" rel="noopener noreferrer">Abrir documento ↗</a></div></> :
        <div className="contextPdfEmpty"><strong>{pdfBusy?"Localizando fonte...":"Fonte não vinculada"}</strong><p>{pdfMessage||"Nenhum PDF cadastrado para este material."}</p>
          {!pdfBusy && pdfCandidates.length>0 && <><label htmlFor="clt-select-pdf">Selecionar PDF desta disciplina</label>
            <select id="clt-select-pdf" value={fallbackId} onChange={e=>setFallbackId(e.target.value)}><option value="">Escolha um arquivo...</option>
              {pdfCandidates.map(m=><option key={m.id} value={m.id}>{m.title}</option>)}</select>
            <button type="button" className="miniButton" disabled={!fallbackId} onClick={()=>void openPdf(fallbackId,pdfPage)}>Abrir PDF selecionado</button>
            <small>Consulta provisória; nenhum ID será modificado.</small></>}
          {!pdfBusy && <button className="miniButton" onClick={()=>void openPdf(materialId,sourcePage)}>Tentar novamente</button>}
        </div>}
    </aside>}
  </div>;
}
