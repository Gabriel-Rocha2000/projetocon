"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Papa from "papaparse";
import AppShell from "@/components/AppShell";
import HierarchyIndex, { HierarchyIndexNode } from "@/components/HierarchyIndex";
import { useAuth } from "@/contexts/AuthContext";
import { useContest } from "@/contexts/ContestContext";
import { addTopic, getTopicLearningStates, getTopics, importEditalRows, updateTopicEditable, renameContestDiscipline, setDisciplineActiveStatus, setTopicTreeActiveStatus, DEFAULT_CONTEST } from "@/services/firestore";
import { Topic } from "@/types";

const statusMeta:any={
  pendente:["Pendente","pending"],
  andamento:["Em andamento","progress"],
  revisao:["Revisão vencida","review"],
  fragil:["Domínio frágil","fragile"],
  dominado:["Dominado","mastered"],
};

type StructureDraft = {
  rows: any[];
  fileName: string;
  disciplines: string[];
  topics: number;
  subtopics: number;
  warnings: string[];
};

function localIdFromTopic(topic: Topic) {
  const prefix = `${topic.contestId}__`;
  return topic.id.startsWith(prefix) ? topic.id.slice(prefix.length) : topic.id;
}

export default function MapaMestrePage() {
  const router = useRouter();
  const developer = usePathname().startsWith("/desenvolvedor/");
  const { user }=useAuth(); const { activeContestId, activeContest } = useContest();
  const [topics,setTopics]=useState<Topic[]>([]); const [states,setStates]=useState<Record<string,any>>({});
  const [localId,setLocalId]=useState(""); const [title,setTitle]=useState(""); const [originalText,setOriginalText]=useState(""); const [discipline,setDiscipline]=useState("Direito Administrativo"); const [canonicalContentId,setCanonicalContentId]=useState(""); const [showManual,setShowManual]=useState(false);
  const [structureDraft,setStructureDraft]=useState<StructureDraft|null>(null);
  const [structureMessage,setStructureMessage]=useState("");
  const [importingStructure,setImportingStructure]=useState(false);
  const [mapSearch,setMapSearch]=useState("");
  const [manageNode, setManageNode] = useState<HierarchyIndexNode | null>(null);
  const [manageMode, setManageMode] = useState<"edit" | "delete" | null>(null);
  const [editName, setEditName] = useState("");
  const [editOriginal, setEditOriginal] = useState("");
  const [editCanonical, setEditCanonical] = useState("");
  const [manageBusy, setManageBusy] = useState(false);
  const [manageError, setManageError] = useState("");
  const [manageNotice, setManageNotice] = useState("");
  const [showRemoved, setShowRemoved] = useState(false);

  async function load(){setTopics(await getTopics(activeContestId));if(user)setStates(await getTopicLearningStates(user.uid,activeContestId));}
  useEffect(()=>{load();},[activeContestId,user]);
  useEffect(() => { setManageNode(null); setManageMode(null); setShowRemoved(false); setManageError(""); }, [activeContestId]);

  async function save(){if(!localId||!title)return;const id=localId.startsWith(`${activeContestId}__`)||activeContestId===DEFAULT_CONTEST?localId:`${activeContestId}__${localId}`;await addTopic({id,contestId:activeContestId,discipline,title,originalText:originalText||title,canonicalContentId:canonicalContentId||null,level:localId.includes(".")?"subtopic":"topic",tags:[],order:topics.length+1,activeInCurrentEdital:true});setLocalId("");setTitle("");setOriginalText("");setCanonicalContentId("");await load();}

  function parseStructureCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setStructureMessage("Validando estrutura antes de adicionar ao Mapa-Mestre...");
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: result => {
        const parserWarnings = (result.errors || []).slice(0, 4).map(err => `CSV: ${err.message}`);
        const input = (result.data as any[]).filter(Boolean);
        const warnings: string[] = [...parserWarnings];
        const rows: any[] = [];
        const seenIds = new Set<string>();

        input.forEach((raw, index) => {
          const id = String(raw.id || raw.topico_id || "").trim();
          const disciplina = String(raw.disciplina || raw.discipline || "").trim();
          const titulo = String(raw.titulo || raw.assunto || raw.title || "").trim();
          const nivelRaw = String(raw.nivel || raw.level || (id.includes(".") ? "subtopic" : "topic")).trim().toLowerCase();
          const nivel = nivelRaw.includes("sub") ? "subtopic" : "topic";
          const parentId = String(raw.parent_id || raw.topico_pai || "").trim();

          if (!id || !disciplina || !titulo) {
            warnings.push(`Linha ${index + 2}: ignorada porque ID, disciplina ou título está vazio.`);
            return;
          }
          if (seenIds.has(id)) {
            warnings.push(`Linha ${index + 2}: ID duplicado (${id}); a segunda ocorrência foi ignorada.`);
            return;
          }
          seenIds.add(id);
          rows.push({
            ...raw,
            id,
            disciplina,
            titulo,
            nivel,
            parent_id: parentId,
            texto_original: String(raw.texto_original || raw.original_text || titulo).trim(),
            conteudo_id: String(raw.conteudo_id || raw.content_id || raw.canonical_content_id || "").trim(),
            ordem: Number(raw.ordem || raw.order || rows.length + 1),
            tags: String(raw.tags || "").trim(),
          });
        });

        const existingIds = new Set(topics.map(localIdFromTopic));
        const fileIds = new Set(rows.map(row => String(row.id)));
        rows.forEach((row, index) => {
          if (row.nivel === "subtopic" && !row.parent_id) {
            warnings.push(`Linha ${index + 2}: subtópico ${row.id} está sem parent_id.`);
          }
          if (row.parent_id && !fileIds.has(row.parent_id) && !existingIds.has(row.parent_id)) {
            warnings.push(`Linha ${index + 2}: parent_id ${row.parent_id} não existe no arquivo nem no Mapa-Mestre atual.`);
          }
        });

        const disciplines = Array.from(new Set(rows.map(row => row.disciplina))).sort((a,b)=>a.localeCompare(b,"pt-BR"));
        setStructureDraft({
          rows,
          fileName: file.name,
          disciplines,
          topics: rows.filter(row => row.nivel === "topic").length,
          subtopics: rows.filter(row => row.nivel === "subtopic").length,
          warnings: Array.from(new Set(warnings)),
        });
        setStructureMessage(rows.length ? `${rows.length} item(ns) prontos para conferência.` : "Nenhum item válido encontrado no CSV.");
        event.target.value = "";
      },
      error: error => {
        setStructureDraft(null);
        setStructureMessage(`Falha ao ler CSV: ${error.message}`);
        event.target.value = "";
      },
    });
  }

  async function commitStructure() {
    if (!structureDraft?.rows.length || importingStructure) return;
    setImportingStructure(true);
    setStructureMessage("Adicionando estrutura ao Mapa-Mestre...");
    try {
      const count = await importEditalRows(activeContestId, structureDraft.rows);
      setStructureDraft(null);
      await load();
      setStructureMessage(`${count} item(ns) adicionados ao Mapa-Mestre de ${activeContest?.name || activeContestId}.`);
    } catch (error) {
      setStructureMessage(error instanceof Error ? `Falha ao importar estrutura: ${error.message}` : "Falha ao importar estrutura CSV.");
    } finally {
      setImportingStructure(false);
    }
  }

  function openManage(node: HierarchyIndexNode, action: "edit" | "delete") {
    const topic = node.id.startsWith("topic:") ? topics.find(t => t.id === node.id.slice(6)) : null;
    const isDiscipline = node.id.startsWith("discipline:");
    if (!isDiscipline && !topic) return;
    setManageNode(node);
    setManageMode(action);
    setEditName(isDiscipline ? node.label : topic?.title || "");
    setEditOriginal(topic?.originalText || "");
    setEditCanonical(topic?.canonicalContentId || "");
    setManageError("");
  }

  function closeManage() {
    if (manageBusy) return;
    setManageNode(null);
    setManageMode(null);
    setManageError("");
  }

  async function saveManagedItem() {
    if (!manageNode || manageBusy) return;
    const name = editName.trim();
    if (!name) { setManageError("Informe um nome ou título."); return; }
    setManageBusy(true);
    setManageError("");
    try {
      if (manageNode.id.startsWith("discipline:")) {
        if (name !== manageNode.label) {
          if (topics.some(t => t.discipline === name)) {
            throw new Error("Já existe uma disciplina com este nome neste concurso. Evite juntar disciplinas sem revisar os vínculos.");
          }
          await renameContestDiscipline(activeContestId, manageNode.label, name);
        }
      } else {
        const topicId = manageNode.id.slice(6);
        if (!topics.some(t => t.id === topicId && t.contestId === activeContestId)) throw new Error("Item não pertence ao concurso ativo.");
        await updateTopicEditable(topicId, {
          title: name,
          originalText: editOriginal.trim() || name,
          canonicalContentId: editCanonical.trim() || null,
        });
      }
      await load();
      setManageNotice("Alterações salvas no Mapa-Mestre.");
      setManageNode(null);
      setManageMode(null);
    } catch (error) {
      setManageError(error instanceof Error ? error.message : "Não foi possível salvar as alterações.");
    } finally {
      setManageBusy(false);
    }
  }

  async function removeManagedItem() {
    if (!manageNode || !user || manageBusy) return;
    setManageBusy(true);
    setManageError("");
    try {
      const count = manageNode.id.startsWith("discipline:")
        ? await setDisciplineActiveStatus(activeContestId, manageNode.label, false)
        : await setTopicTreeActiveStatus(activeContestId, manageNode.id.slice(6), false);
      await load();
      setManageNotice(`${count} item(ns) retirado(s) do Mapa-Mestre. Você pode restaurá-los em "Itens retirados".`);
      setManageNode(null);
      setManageMode(null);
    } catch (error) {
      setManageError(error instanceof Error ? error.message : "Não foi possível retirar o item.");
    } finally {
      setManageBusy(false);
    }
  }

  async function restoreRemoved(discipline: string, topicId?: string) {
    if (manageBusy) return;
    setManageBusy(true);
    setManageNotice("");
    try {
      const count = topicId
        ? await setTopicTreeActiveStatus(activeContestId, topicId, true)
        : await setDisciplineActiveStatus(activeContestId, discipline, true);
      await load();
      setManageNotice(`${count} item(ns) restaurado(s).`);
    } catch (error) {
      setManageNotice(error instanceof Error ? `Erro ao restaurar: ${error.message}` : "Erro ao restaurar item.");
    } finally {
      setManageBusy(false);
    }
  }

  const activeTopics=topics.filter(t=>t.activeInCurrentEdital!==false);
  const removedTopics = topics.filter(t => t.activeInCurrentEdital === false);
  const removedDisciplines = Array.from(new Set(removedTopics.map(t => t.discipline)))
    .filter(d => topics.filter(t => t.discipline === d).every(t => t.activeInCurrentEdital === false))
    .sort((a,b) => a.localeCompare(b,"pt-BR"));
  const independentlyRemoved = removedTopics.filter(t => !removedDisciplines.includes(t.discipline));
  const nextPending=activeTopics.find(t=>states[t.id]?.status==="pendente")||activeTopics.find(t=>states[t.id]?.status==="fragil")||activeTopics[0];
  const counts=useMemo(()=>activeTopics.reduce((acc:any,t)=>{const s=states[t.id]?.status||"pendente";acc[s]=(acc[s]||0)+1;return acc;},{}),[activeTopics,states]);

  const mapHierarchy = useMemo<HierarchyIndexNode[]>(() => {
    const term = mapSearch.trim().toLowerCase();
    const disciplines = Array.from(new Set<string>(activeTopics.map(t=>t.discipline).filter(Boolean))).sort((a,b)=>a.localeCompare(b,"pt-BR"));

    function makeTopicNode(topic: Topic, disciplineRows: Topic[]): HierarchyIndexNode {
      const st=states[topic.id]||{status:"pendente",mastery:0,evidence:0,answered:0,activeErrors:0,studied:false};
      const meta=statusMeta[st.status]||statusMeta.pendente;
      const children=disciplineRows.filter(row=>row.parentTopicId===topic.id).sort((a,b)=>a.order-b.order).map(child=>makeTopicNode(child,disciplineRows));
      return {
        id:`topic:${topic.id}`,
        label:topic.title,
        count:st.answered>0?st.answered:undefined,
        meta:<span className="mapIndexMeta"><span className={`mapIndexDot ${meta[1]}`}></span><span className="mapIndexStatus">{meta[0]}</span>{st.studied&&<><span>Domínio {st.mastery}%</span><span>Evidência {st.evidence}%</span>{st.activeErrors>0&&<span>{st.activeErrors} erro(s)</span>}</>}</span>,
        children,
        actionLabel:st.studied?"Continuar":"Estudar",
      };
    }

    function filterNode(node: HierarchyIndexNode): HierarchyIndexNode | null {
      if(!term) return node;
      const filteredChildren=(node.children||[]).map(filterNode).filter(Boolean) as HierarchyIndexNode[];
      const ownMatch=node.label.toLowerCase().includes(term);
      if(!ownMatch&&!filteredChildren.length) return null;
      return {...node,children:filteredChildren};
    }

    return disciplines.map(disciplineName=>{
      const rows=activeTopics.filter(t=>t.discipline===disciplineName);
      const rowIds=new Set(rows.map(r=>r.id));
      let roots=rows.filter(row=>!row.parentTopicId||!rowIds.has(row.parentTopicId)).sort((a,b)=>a.order-b.order);
      if(!roots.length) roots=[...rows].sort((a,b)=>a.order-b.order);
      const studied=rows.filter(t=>states[t.id]?.studied).length;
      const mastered=rows.filter(t=>states[t.id]?.status==="dominado").length;
      const fragile=rows.filter(t=>["fragil","revisao"].includes(states[t.id]?.status)).length;
      const root:HierarchyIndexNode={
        id:`discipline:${disciplineName}`,
        label:disciplineName,
        count:rows.length,
        meta:<span className="mapIndexDisciplineMeta"><span>{studied}/{rows.length} com contato</span><span className="mapLegendInline"><i className="mapIndexDot mastered"></i>{mastered}</span><span className="mapLegendInline"><i className="mapIndexDot fragile"></i>{fragile}</span></span>,
        children:roots.map(topic=>makeTopicNode(topic,rows)),
        actionLabel:"Questões",
      };
      return filterNode(root);
    }).filter(Boolean) as HierarchyIndexNode[];
  },[activeTopics,states,mapSearch]);

  function mapIndexAction(node: HierarchyIndexNode){
    if(node.id.startsWith("topic:")) router.push(`/conteudo/${encodeURIComponent(node.id.slice(6))}`);
    else if(node.id.startsWith("discipline:")) router.push(`/questoes?discipline=${encodeURIComponent(node.label)}`);
  }

  return <AppShell>
    <div className="pageHeader"><div><h1>{developer ? "Importar Mapa-Mestre" : "Mapa-Mestre"}</h1><p className="muted">{activeContest?.name||activeContestId} • veja estudado, pendente e frágil sem comparar planilhas.</p></div><div className="quickActions">{developer ? <><label className="actionButton secondaryAction fileButton">Importar estrutura CSV<input hidden type="file" accept=".csv,text/csv" onChange={parseStructureCsv}/></label><button className="actionButton secondaryAction" onClick={()=>setShowManual(!showManual)}>+ Item manual</button></> : nextPending&&<Link className="actionButton" href={`/conteudo/${encodeURIComponent(nextPending.id)}`}>Próximo pendente</Link>}</div></div>

    <section className="grid4 compactMetrics mapSummary"><div className="card"><span className="muted">Pendentes</span><strong>{counts.pendente||0}</strong></div><div className="card"><span className="muted">Em andamento</span><strong>{counts.andamento||0}</strong></div><div className="card"><span className="muted">Frágeis / revisão</span><strong>{(counts.fragil||0)+(counts.revisao||0)}</strong></div><div className="card"><span className="muted">Dominados</span><strong>{counts.dominado||0}</strong></div></section>

    {developer && (structureMessage || structureDraft) && <section className="panel">
      <div className="panelHeader"><div><h2>Importar estrutura no Mapa-Mestre</h2><p className="muted">A importação adiciona tópicos e subtópicos ao concurso ativo. Ela não cria uma nova versão formal do edital.</p></div></div>
      {structureMessage && <div className="statusBox">{structureMessage}</div>}
      {structureDraft && <>
        <div className="grid4 compactMetrics">
          <div className="card"><span className="muted">Arquivo</span><strong className="smallMetricText">{structureDraft.fileName}</strong></div>
          <div className="card"><span className="muted">Disciplinas</span><strong>{structureDraft.disciplines.length}</strong></div>
          <div className="card"><span className="muted">Tópicos</span><strong>{structureDraft.topics}</strong></div>
          <div className="card"><span className="muted">Subtópicos</span><strong>{structureDraft.subtopics}</strong></div>
        </div>
        <div className="structurePreview">
          {structureDraft.disciplines.map(name => {
            const disciplineRows = structureDraft.rows.filter(row => row.disciplina === name);
            return <div className="structurePreviewGroup" key={name}><div className="structurePreviewTitle"><strong>{name}</strong><span>{disciplineRows.length} item(ns)</span></div><div className="structurePreviewRows">{disciplineRows.slice(0,12).map((row,index)=><div className={`structurePreviewRow ${row.nivel === "subtopic" ? "subtopic" : ""}`} key={`${row.id}-${index}`}><span className="monoLabel">{row.id}</span><span>{row.titulo}</span><span className="statusPill">{row.nivel === "subtopic" ? "subtópico" : "tópico"}</span></div>)}{disciplineRows.length>12&&<div className="muted structurePreviewMore">+ {disciplineRows.length-12} item(ns) na prévia</div>}</div></div>})}
        </div>
        {structureDraft.warnings.length>0&&<div className="warningBox"><strong>Conferir antes de importar:</strong><ul>{structureDraft.warnings.slice(0,8).map((warning,index)=><li key={index}>{warning}</li>)}</ul>{structureDraft.warnings.length>8&&<p>+ {structureDraft.warnings.length-8} aviso(s).</p>}</div>}
        <div className="quickActions"><button className="actionButton" disabled={importingStructure||!structureDraft.rows.length} onClick={commitStructure}>{importingStructure?"Importando...":`Adicionar ${structureDraft.rows.length} item(ns)`}</button><button className="actionButton secondaryAction" disabled={importingStructure} onClick={()=>{setStructureDraft(null);setStructureMessage("");}}>Cancelar</button></div>
      </>}
    </section>}

    {developer && showManual&&<section className="panel formGrid"><label>ID local<input value={localId} onChange={e=>setLocalId(e.target.value)} /></label><label>Disciplina<input value={discipline} onChange={e=>setDiscipline(e.target.value)} /></label><label className="full">Título<input value={title} onChange={e=>setTitle(e.target.value)} /></label><label className="full">Texto original do edital<textarea value={originalText} onChange={e=>setOriginalText(e.target.value)} /></label><label className="full">Conteúdo canônico<input value={canonicalContentId} onChange={e=>setCanonicalContentId(e.target.value)} /></label><div className="full"><button className="actionButton" onClick={save}>Adicionar item</button></div></section>}

    <section className="mapIndexIntro">
      <div className="indexSearchBar"><input value={mapSearch} onChange={e=>setMapSearch(e.target.value)} placeholder="Buscar disciplina, tópico ou subtópico..." /></div>
      <div className="mapLegend">
        <span><i className="mapIndexDot pending"></i>Pendente</span>
        <span><i className="mapIndexDot progress"></i>Em andamento</span>
        <span><i className="mapIndexDot review"></i>Revisão vencida</span>
        <span><i className="mapIndexDot fragile"></i>Domínio frágil</span>
        <span><i className="mapIndexDot mastered"></i>Dominado</span>
      </div>
    </section>

    {manageNotice && <div className="statusBox mapManageNotice" role="status">{manageNotice}<button type="button" className="textButton" onClick={() => setManageNotice("")}>Fechar</button></div>}

    {developer && <div className="mapManageToolbar">
      <span className="muted">Use ⋯ ao lado de cada disciplina, tópico ou subtópico para editar ou excluir da lista.</span>
      <button type="button" className="actionButton secondaryAction" onClick={() => setShowRemoved(v => !v)}>{showRemoved ? "Ocultar retirados" : `Itens retirados (${removedTopics.length})`}</button>
    </div>}
    {developer && showRemoved && <section className="panel mapRemovedPanel">
      <h2>Restaurar itens retirados</h2>
      <p className="muted">Excluir da lista não apaga questões, histórico, conteúdos ou o registro do edital. Restaurar uma disciplina reativa todos os seus itens.</p>
      {!removedTopics.length && <p className="muted">Nenhum item retirado deste concurso.</p>}
      {removedDisciplines.map(d => <div className="mapRemovedRow" key={`discipline:${d}`}><span><strong>{d}</strong> <small>• disciplina completa</small></span><button type="button" className="treeAction" disabled={manageBusy} onClick={() => restoreRemoved(d)}>Restaurar</button></div>)}
      {independentlyRemoved.map(t => <div className="mapRemovedRow" key={t.id}><span><strong>{t.title}</strong><small> • {t.discipline} • {t.level === "subtopic" ? "subtópico" : "tópico"}</small></span><button type="button" className="treeAction" disabled={manageBusy} onClick={() => restoreRemoved(t.discipline, t.id)}>Restaurar</button></div>)}
    </section>}

    <HierarchyIndex nodes={mapHierarchy} scopeKey={activeContestId} onAction={mapIndexAction} actionLabel="Estudar" emptyLabel="Nenhum item encontrado no Mapa-Mestre." />

    {developer && manageNode && manageMode && <div className="mapManageOverlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) closeManage(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="map-manage-title" className="mapManageDialog">
        <div className="mapManageDialogHead"><h2 id="map-manage-title">{manageMode === "edit" ? "Editar" : "Excluir da lista"}: {manageNode.label}</h2><button type="button" className="treeManageButton" aria-label="Fechar" disabled={manageBusy} onClick={closeManage}>×</button></div>
        {manageMode === "edit" ? <div className="mapManageFields">
          <label>{manageNode.id.startsWith("discipline:") ? "Nome da disciplina" : "Título do tópico/subtópico"}<input value={editName} autoFocus onChange={event => setEditName(event.target.value)} maxLength={180} /></label>
          {manageNode.id.startsWith("topic:") ? <>
            <label>Texto original do edital<textarea value={editOriginal} onChange={event => setEditOriginal(event.target.value)} rows={4} /></label>
            <label>Conteúdo canônico<input value={editCanonical} onChange={event => setEditCanonical(event.target.value)} placeholder="Manter vazio se não houver vínculo" /></label>
            <p className="muted">Os IDs, questões e registros de estudo não serão alterados.</p>
          </> : <p className="muted">O nome será atualizado nos tópicos, questões e materiais vinculados a este concurso. Relatórios históricos antigos podem conservar o nome anterior.</p>}
        </div> : <div className="mapManageFields">
          <p>Deseja retirar <strong>{manageNode.label}</strong> do Mapa-Mestre deste concurso?</p>
          <p className="muted">{manageNode.id.startsWith("discipline:") ? "Todos os tópicos e subtópicos desta disciplina serão ocultados." : "Este item e seus subtópicos serão ocultados."} Nenhum dado será apagado do Firebase. Você poderá restaurar em <strong>Itens retirados</strong>.</p>
        </div>}
        {manageError && <div className="warningBox" role="alert">{manageError}</div>}
        <div className="quickActions mapManageDialogActions">
          <button type="button" className={`actionButton ${manageMode === "delete" ? "mapDangerButton" : ""}`} disabled={manageBusy} onClick={manageMode === "edit" ? saveManagedItem : removeManagedItem}>{manageBusy ? "Aguarde..." : manageMode === "edit" ? "Salvar alterações" : "Excluir da lista"}</button>
          <button type="button" className="actionButton secondaryAction" disabled={manageBusy} onClick={closeManage}>Cancelar</button>
        </div>
      </section>
    </div>}

  </AppShell>;
}
