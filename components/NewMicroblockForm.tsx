"use client";
import { useState } from "react";
import { saveContentBlocks } from "@/services/firestore";
import type { Material, ContentBlock, Topic } from "@/types";

export default function NewMicroblockForm({ material, topics, onCreated }: {
  material: Material; topics: Topic[]; onCreated: (block: ContentBlock) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [topicId, setTopicId] = useState("");
  const [pageStart, setPageStart] = useState("");
  const [pageEnd, setPageEnd] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const available = topics.filter(t => t.discipline === material.discipline && t.activeInCurrentEdital !== false);
  async function add() {
    const topic = available.find(t => t.id === topicId);
    if (!topic || !title.trim() || !text.trim()) {
      setMessage("Escolha um tópico e preencha o título e o texto integral.");
      return;
    }
    if (!window.confirm("Criar este microbloco dentro do material selecionado? O conteúdo será gravado no Firebase.")) return;
    setBusy(true);setMessage("");
    try {
      const block: ContentBlock = {
        id: `${material.id.replaceAll("/","_")}__MANUAL__${crypto.randomUUID()}`,
        materialId: material.id,
        contentId: topic.canonicalContentId || topic.id,
        topicId: topic.id,
        discipline: topic.discipline,
        title: title.trim(), text: text.trim(), order: Date.now(),
        sourcePageStart: pageStart && Number.isFinite(Number(pageStart)) ? Number(pageStart) : null,
        sourcePageEnd: pageEnd && Number.isFinite(Number(pageEnd)) ? Number(pageEnd) : null,
        tags: ["inserido_manualmente", "pendente_auditoria_pdf"],
        archived: false,
      };
      await saveContentBlocks([block]);
      onCreated(block);setOpen(false);setTitle("");setText("");setTopicId("");setPageStart("");setPageEnd("");
    } catch(e) {setMessage(e instanceof Error ? e.message : "Falha ao adicionar microbloco.");}
    finally {setBusy(false);}
  }
  return <section className="panel">
    <div className="panelHeader"><div><h2>Incluir microbloco manualmente</h2><p className="muted">Complemente trechos ausentes do PDF sem sobrescrever o material importado.</p></div><button className="actionButton secondaryAction" onClick={()=>setOpen(v=>!v)}>{open?"Cancelar":"+ Novo microbloco"}</button></div>
    {open && <div className="devForm"><label className="devField">Tópico ou subtópico de destino<select value={topicId} onChange={e=>setTopicId(e.target.value)}><option value="">Escolha o vínculo</option>{available.map(topic=><option key={topic.id} value={topic.id}>{topic.title}</option>)}</select></label>
      <label className="devField">Título<input value={title} onChange={e=>setTitle(e.target.value)} maxLength={180}/></label>
      <label className="devField">Texto completo<textarea rows={8} value={text} onChange={e=>setText(e.target.value)} placeholder="Conceito, explicações, exemplos e exceções, conforme o PDF..."/></label>
      <div className="devFieldsGrid"><label className="devField">Página inicial (opcional)<input type="number" min="1" value={pageStart} onChange={e=>setPageStart(e.target.value)}/></label><label className="devField">Página final (opcional)<input type="number" min="1" value={pageEnd} onChange={e=>setPageEnd(e.target.value)}/></label></div>
      {available.length===0&&<div className="warningBox">Não existem tópicos ativos desta disciplina no concurso. Cadastre ou vincule primeiro no Gerenciar Mapa-Mestre.</div>}
      {message&&<div role="alert" className="warningBox">{message}</div>}
      <button className="actionButton" onClick={add} disabled={busy||!topicId||!title.trim()||!text.trim()}>{busy?"Salvando...":"Adicionar ao material"}</button>
    </div>}
  </section>;
}
