"use client";

import { ChangeEvent, Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import Drawer from "@/components/Drawer";
import { useAuth } from "@/contexts/AuthContext";
import { useContest } from "@/contexts/ContestContext";
import { addLawItem, deleteLawDocument, deleteLawItem, getLawDocuments, getLawItems, getLawProgress, getQuestions, importLawDocument, saveLawProgress, updateLawItem } from "@/services/firestore";
import { LawDocument, LawItem, LawStatus, Question } from "@/types";

function slug(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "").toUpperCase(); }
function stableRef(lawNumber: string | null | undefined, item: any) {
  const base = `LEI_${slug(lawNumber || "SEM_NUMERO")}`;
  return [base, item.article ? `ART_${slug(item.article)}` : "", item.paragraph ? `PAR_${slug(item.paragraph)}` : "", item.inciso ? `INC_${slug(item.inciso)}` : "", item.alinea ? `AL_${slug(item.alinea)}` : ""].filter(Boolean).join("_");
}
function millis(value:any){ if(!value)return 0; if(typeof value?.toMillis==='function')return value.toMillis(); return new Date(value).getTime()||0; }

function LeiSecaContent() {
  const { user } = useAuth(); const search = useSearchParams(); const { activeContestId } = useContest();
  const [documents,setDocuments]=useState<LawDocument[]>([]); const [laws,setLaws]=useState<LawItem[]>([]); const [progress,setProgress]=useState<any[]>([]); const [questions,setQuestions]=useState<Question[]>([]);
  const [selectedDocId,setSelectedDocId]=useState(""); const [selectedArticle,setSelectedArticle]=useState(""); const [selectedItemId,setSelectedItemId]=useState("");
  const [tab,setTab]=useState<"biblioteca"|"revisar">("biblioteca"); const [index,setIndex]=useState(0); const [showAnswer,setShowAnswer]=useState(false); const [message,setMessage]=useState("");
  const [importOpen,setImportOpen]=useState(false); const [file,setFile]=useState<File|null>(null); const [sourceUrl,setSourceUrl]=useState("https://www.planalto.gov.br/"); const [preview,setPreview]=useState<any|null>(null); const [processing,setProcessing]=useState(false); const [editItem,setEditItem]=useState<LawItem|null>(null); const [manualOpen,setManualOpen]=useState(false);

  async function load(){ const [docs,items,prog,qs]=await Promise.all([getLawDocuments(activeContestId),getLawItems(activeContestId),user?getLawProgress(user.uid,activeContestId):Promise.resolve([]),getQuestions(activeContestId)]); setDocuments(docs);setLaws(items);setProgress(prog);setQuestions(qs); const requested=search.get("item"); const match=requested?items.find(i=>i.id===requested):null; const docId=match?.lawDocumentId||selectedDocId||docs[0]?.id||""; setSelectedDocId(docId); if(match?.article)setSelectedArticle(String(match.article)); if(match)setSelectedItemId(match.id); if(search.get("review")==="1")setTab("revisar"); }
  useEffect(()=>{setIndex(0);load();},[user,activeContestId]);

  const selectedDoc=documents.find(d=>d.id===selectedDocId)||null;
  const selectedItems=useMemo(()=>selectedDocId?laws.filter(i=>i.lawDocumentId===selectedDocId):[],[laws,selectedDocId]);
  const studyItems=useMemo(()=>selectedItems.filter(i=>!i.status||i.status==="vigente"),[selectedItems]);
  const articles=useMemo(()=>Array.from(new Set<string>(studyItems.map(i=>String(i.article||"")).filter(Boolean))).sort((a,b)=>Number(a.replace(/\D/g,""))-Number(b.replace(/\D/g,""))),[studyItems]);
  useEffect(()=>{ if(selectedDocId && !articles.includes(selectedArticle)) setSelectedArticle(articles[0]||""); },[selectedDocId,articles]);
  const articleItems=useMemo(()=>studyItems.filter(i=>String(i.article||"")===selectedArticle),[studyItems,selectedArticle]);
  useEffect(()=>{ if(articleItems.length && !articleItems.some(i=>i.id===selectedItemId)) setSelectedItemId(articleItems[0].id); },[articleItems,selectedItemId]);
  const selectedItem=articleItems.find(i=>i.id===selectedItemId)||articleItems[0]||null;
  const progressMap=useMemo(()=>new Map(progress.map(row=>[row.lawItemId,row])),[progress]);
  const due=useMemo(()=>{const now=Date.now();return studyItems.filter(item=>{const p:any=progressMap.get(item.id);return !!p?.nextReviewAt&&millis(p.nextReviewAt)<=now;});},[studyItems,progressMap]);
  const requestedItem=search.get("item");
  const reviewItems=useMemo(()=>{const direct=requestedItem?studyItems.find(i=>i.id===requestedItem):null; return direct?[direct]:due;},[requestedItem,studyItems,due]);
  const current=reviewItems[index%Math.max(1,reviewItems.length)];
  const articleRefs=new Set(articleItems.map(i=>i.stableRef||i.id));
  const articleQuestions=questions.filter(q=>(q.legalRefs||[]).some(r=>articleRefs.has(r))||(q.lawIds||[]).some(r=>articleItems.some(i=>i.id===r)));
  const articleProgress=articleItems.filter(i=>progressMap.has(i.id));
  const articleDue=articleItems.filter(i=>{const p:any=progressMap.get(i.id);return !!p?.nextReviewAt&&millis(p.nextReviewAt)<=Date.now();});

  async function rate(result:"errei"|"quase"|"acertei"){if(!user||!current)return;await saveLawProgress(user.uid,current,result);setMessage(`Salvo: ${result}. Próxima revisão recalculada.`);setShowAnswer(false);setIndex(old=>reviewItems.length?(old+1)%reviewItems.length:0);setProgress(await getLawProgress(user.uid,activeContestId));}
  async function parsePdf(){if(!file)return;setProcessing(true);setMessage("");try{const body=new FormData();body.append("file",file);const res=await fetch("/api/law-import",{method:"POST",body});const json=await res.json();if(!res.ok)throw new Error(json.error||"Falha ao processar PDF");setPreview(json);}catch(error:any){setMessage(error.message);}finally{setProcessing(false);}}
  async function savePreview(){if(!preview)return;const base=preview.meta.lawNumber||preview.meta.lawName||preview.fileName;const documentId=`${activeContestId}__LAW__${slug(base)}`;const lawDocument:LawDocument={id:documentId,contestId:activeContestId,lawName:preview.meta.lawName,lawNumber:preview.meta.lawNumber,lawDate:preview.meta.lawDate,title:preview.meta.title,sourceName:preview.meta.sourceName,sourceUrl:sourceUrl||null,fileName:preview.fileName,fileHash:preview.fileHash,itemCount:preview.items.length};const items:LawItem[]=preview.items.map((item:any)=>({id:`${documentId}__${item.tempId}`,contestId:activeContestId,lawDocumentId:documentId,lawName:preview.meta.lawName,reference:item.reference,stableRef:stableRef(preview.meta.lawNumber,item),level:item.level,status:item.status,article:item.article,paragraph:item.paragraph,inciso:item.inciso,alinea:item.alinea,order:item.order,text:item.text,officialText:item.text,sourceUrl:sourceUrl||null,tags:[]}));const count=await importLawDocument(activeContestId,lawDocument,items);setMessage(`${count} dispositivos preservados. A biblioteca agora agrupa por artigo; histórico/revogado não entra na revisão por padrão.`);setImportOpen(false);setPreview(null);setFile(null);setSelectedDocId(documentId);await load();}

  const reviewed=selectedItems.filter(x=>progressMap.has(x.id)).length; const currentCount=studyItems.length; const reviewFlags=selectedItems.filter(x=>x.status==="revisar").length;
  return <AppShell>
    <div className="pageHeader"><div><h1>Lei Seca</h1><p className="muted">Navegue por lei, artigo e dispositivo. O texto oficial fica preservado e a revisão mostra apenas o que realmente venceu.</p></div><div className="quickActions"><button className="actionButton" onClick={()=>setImportOpen(true)}>Importar PDF oficial</button><button className="actionButton secondaryAction" onClick={()=>{setEditItem(null);setManualOpen(true)}}>+ Dispositivo</button></div></div>
    <div className="lawTabs"><button className={tab==="biblioteca"?"lawTab active":"lawTab"} onClick={()=>setTab("biblioteca")}>Biblioteca</button><button className={tab==="revisar"?"lawTab active":"lawTab"} onClick={()=>setTab("revisar")}>Revisões pendentes ({due.length})</button></div>{message&&<div className="statusBox">{message}</div>}

    {tab==="biblioteca"?<>
      <section className="lawLibraryGrid">{documents.map(docu=>{const items=laws.filter(x=>x.lawDocumentId===docu.id);const seen=items.filter(x=>progressMap.has(x.id)).length;return <button className={`panel lawDocumentCard ${selectedDocId===docu.id?"selectedLaw":""}`} key={docu.id} onClick={()=>{setSelectedDocId(docu.id);setSelectedArticle("")}}><span className="badge">{docu.sourceName}</span><h2>{docu.lawName}</h2><p>{docu.title}</p><div className="lawDocStats"><span>{items.filter(i=>!i.status||i.status==="vigente").length} dispositivos</span><span>{items.length?Math.round((seen/items.length)*100):0}% vistos</span></div></button>})}{!documents.length&&<div className="panel emptyState">Nenhuma lei importada.</div>}</section>
      {selectedDoc&&<section className="panel"><div className="panelHeader"><div><span className="badge">{selectedDoc.sourceName}</span><h2>{selectedDoc.lawName}</h2><p className="muted">{selectedDoc.fileName} • fonte e hash preservados.</p></div><button className="miniButton" onClick={async()=>{if(confirm("Excluir esta lei e seus dispositivos?")){await deleteLawDocument(activeContestId,selectedDoc.id);setSelectedDocId("");await load();}}}>Excluir lei</button></div>
        <div className="grid4 lawMetrics compactMetrics"><div className="card"><span className="muted">Vigentes</span><strong>{currentCount}</strong></div><div className="card"><span className="muted">Vistos</span><strong>{reviewed}</strong></div><div className="card"><span className="muted">Vencidos</span><strong>{due.length}</strong></div><div className="card"><span className="muted">Conferir</span><strong>{reviewFlags}</strong></div></div>
        <div className="lawNavigator"><label>Lei<select value={selectedDocId} onChange={e=>{setSelectedDocId(e.target.value);setSelectedArticle("")}}>{documents.map(d=><option key={d.id} value={d.id}>{d.lawName}</option>)}</select></label><label>Artigo<select value={selectedArticle} onChange={e=>setSelectedArticle(e.target.value)}>{articles.map(a=><option key={a} value={a}>Art. {a}</option>)}</select></label><label>Dispositivo<select value={selectedItemId} onChange={e=>setSelectedItemId(e.target.value)}>{articleItems.map(i=><option key={i.id} value={i.id}>{i.reference}</option>)}</select></label></div>
        {selectedArticle&&<div className="articleStudy"><div className="articleHeader"><div><span className="eyebrow">ARTIGO {selectedArticle}</span><h2>{selectedDoc.lawName}</h2><p className="muted">{articleItems.length} dispositivo(s) • {articleDue.length} revisão(ões) vencida(s) • {articleQuestions.length} questão(ões) vinculada(s)</p></div><div className="quickActions"><Link className="actionButton" href={`/questoes?legalRef=${encodeURIComponent(articleItems.find(i=>i.level==='artigo')?.stableRef||articleItems[0]?.stableRef||articleItems[0]?.id||'')}`}>Questões deste artigo</Link>{selectedItem&&<Link className="actionButton secondaryAction" href={`/lei-seca?item=${encodeURIComponent(selectedItem.id)}&review=1`}>Revisar dispositivo</Link>}</div></div><div className="officialArticleText">{articleItems.map(item=><button className={`officialDevice ${selectedItemId===item.id?'selected':''}`} key={item.id} onClick={()=>setSelectedItemId(item.id)}><span><strong>{item.reference}</strong><em className={`lawStatus ${item.status||'vigente'}`}>{item.status||'vigente'}</em></span><p>{item.text}</p></button>)}</div></div>}
      </section>}
    </>:<>{documents.length>0&&<section className="panel lawSelectBar"><label>Lei<select value={selectedDocId} onChange={e=>{setSelectedDocId(e.target.value);setIndex(0)}}>{documents.map(d=><option key={d.id} value={d.id}>{d.lawName}</option>)}</select></label><span>{reviewItems.length} revisão(ões) realmente pendente(s)</span></section>}{!current?<div className="panel emptyState">Nenhuma revisão vencida nesta lei. Você pode escolher um artigo na Biblioteca para estudar um dispositivo novo.</div>:<section className="panel lawTrainer"><span className="badge">{current.lawName} • {current.reference}</span><h2>Tente lembrar antes de revelar.</h2><div className="lawMeta"><span>{current.level||"dispositivo"}</span><span>Status: {current.status||"vigente"}</span></div>{!showAnswer?<button className="actionButton" onClick={()=>setShowAnswer(true)}>Mostrar texto oficial</button>:<><div className="lawText">{current.text}</div><div className="ratingRow"><button className="dangerBtn" onClick={()=>rate("errei")}>Errei</button><button className="warnBtn" onClick={()=>rate("quase")}>Quase</button><button className="successBtn" onClick={()=>rate("acertei")}>Acertei</button></div></>}</section>}</>}

    <Drawer open={importOpen} title="Importar lei por PDF" onClose={()=>{setImportOpen(false);setPreview(null)}}><div className="drawerStack"><div className="warningBox">Use preferencialmente PDF da fonte oficial. O sistema não reescreve o texto e mantém itens históricos para auditoria.</div><label className="drawerField">PDF oficial<input type="file" accept="application/pdf,.pdf" onChange={(e:ChangeEvent<HTMLInputElement>)=>setFile(e.target.files?.[0]||null)}/></label><label className="drawerField">URL da fonte oficial<input value={sourceUrl} onChange={e=>setSourceUrl(e.target.value)}/></label><button className="actionButton" disabled={!file||processing} onClick={parsePdf}>{processing?"Processando...":"Organizar PDF"}</button>{preview&&<><div className="detailBlock"><strong>{preview.meta.lawName}</strong><p>{preview.meta.title}</p><small>{preview.items.length} dispositivos • {preview.pages||"?"} páginas</small></div><div className="drawerMetrics"><div><span>Vigentes</span><strong>{preview.items.filter((i:any)=>i.status==="vigente").length}</strong></div><div><span>Hist./rev.</span><strong>{preview.items.filter((i:any)=>i.status==="historico"||i.status==="revogado").length}</strong></div><div><span>Conferir</span><strong>{preview.items.filter((i:any)=>i.status==="revisar").length}</strong></div></div><div className="previewLawList">{preview.items.slice(0,18).map((i:any)=><div className="drawerListRow" key={i.tempId}><div><strong>{i.reference}</strong><small>{i.text.slice(0,100)}{i.text.length>100?"…":""}</small></div><span className={`lawStatus ${i.status}`}>{i.status}</span></div>)}</div><button className="actionButton" onClick={savePreview}>Confirmar importação</button></>}</div></Drawer>
    <Drawer open={manualOpen} title={editItem?"Editar dispositivo":"Adicionar dispositivo"} onClose={()=>{setManualOpen(false);setEditItem(null)}}><LawItemEditor item={editItem} document={selectedDoc} contestId={activeContestId} onSaved={async()=>{setManualOpen(false);setEditItem(null);await load()}}/></Drawer>
  </AppShell>;
}

export default function LeiSecaPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div className="emptyState">Carregando Lei Seca...</div>
        </AppShell>
      }
    >
      <LeiSecaContent />
    </Suspense>
  );
}

function LawItemEditor({item,document,contestId,onSaved}:{item:LawItem|null;document:LawDocument|null;contestId:string;onSaved:()=>Promise<void>}){
  const [reference,setReference]=useState(item?.reference||"");const [level,setLevel]=useState<LawItem["level"]>(item?.level||"artigo");const [status,setStatus]=useState<LawStatus>(item?.status||"vigente");const [text,setText]=useState(item?.text||"");const [article,setArticle]=useState(item?.article||"");
  async function save(){if(!reference||!text)return;if(item)await updateLawItem(item.id,{reference,level,status,text,article:article||null});else{const docId=document?.id||`${contestId}__MANUAL`;const temp={article:article||null,paragraph:null,inciso:null,alinea:null};await addLawItem({id:`${docId}__MANUAL__${Date.now()}`,contestId,lawDocumentId:document?.id||null,lawName:document?.lawName||"Lei manual",reference,stableRef:stableRef(document?.lawNumber,temp),level,status,text,officialText:text,article:article||null,order:Date.now(),tags:[],sourceUrl:document?.sourceUrl||null});}await onSaved();}
  return <div className="drawerStack"><label className="drawerField">Referência<input value={reference} onChange={e=>setReference(e.target.value)}/></label><label className="drawerField">Artigo<input value={article||""} onChange={e=>setArticle(e.target.value)}/></label><label className="drawerField">Nível<select value={level} onChange={e=>setLevel(e.target.value as LawItem["level"])}><option value="artigo">Artigo</option><option value="paragrafo">Parágrafo</option><option value="inciso">Inciso</option><option value="alinea">Alínea</option></select></label><label className="drawerField">Status<select value={status} onChange={e=>setStatus(e.target.value as LawStatus)}><option value="vigente">Vigente</option><option value="revisar">Conferir</option><option value="historico">Histórico</option><option value="revogado">Revogado</option></select></label><label className="drawerField">Texto<textarea value={text} onChange={e=>setText(e.target.value)}/></label><button className="actionButton" onClick={save}>Salvar</button>{item&&<button className="dangerBtn" onClick={async()=>{if(confirm("Excluir este dispositivo?")){await deleteLawItem(item.id);await onSaved();}}}>Excluir</button>}</div>;
}
