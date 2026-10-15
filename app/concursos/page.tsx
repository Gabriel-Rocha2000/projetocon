"use client";

import { useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { useContest } from "@/contexts/ContestContext";
import { addContest, seedBaseContent } from "@/services/firestore";
import { Contest } from "@/types";

function makeId(name:string,year:string){return `${name}_${year||new Date().getFullYear()}`.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/[^A-Z0-9]+/g,"_").replace(/^_|_$/g,"");}

export default function ConcursosPage(){
  const {user}=useAuth(); const {contests,activeContestId,selectContest,refreshContests}=useContest();
  const [name,setName]=useState("");const [organ,setOrgan]=useState("");const [role,setRole]=useState("");const [board,setBoard]=useState("");const [year,setYear]=useState(String(new Date().getFullYear()));const [priority,setPriority]=useState<"alta"|"media"|"baixa">("media");const [message,setMessage]=useState("");
  async function createContest(){if(!name.trim())return;const id=makeId(name,year);const contest:Contest={id,name:name.trim(),organ:organ.trim(),role:role.trim(),board:board.trim(),year:Number(year)||undefined,examDate:null,status:"ativo",priority};await addContest(contest);await refreshContests();if(user)await selectContest(id);setMessage(`Concurso ${contest.name} criado. Agora importe o edital na área Edital.`);}
  return <AppShell>
    <div className="pageHeader"><div><h1>Concursos</h1><p className="muted">Troque o concurso ativo sem misturar cobertura. Conteúdos canônicos podem reaproveitar seu domínio entre editais.</p></div><Link href="/edital" className="actionButton">Abrir edital ativo</Link></div>
    <section className="panel formGrid"><label>Nome<input value={name} onChange={e=>setName(e.target.value)} placeholder="Ex.: CGU"/></label><label>Órgão<input value={organ} onChange={e=>setOrgan(e.target.value)}/></label><label>Cargo<input value={role} onChange={e=>setRole(e.target.value)}/></label><label>Banca<input value={board} onChange={e=>setBoard(e.target.value)}/></label><label>Ano<input value={year} onChange={e=>setYear(e.target.value)}/></label><label>Prioridade<select value={priority} onChange={e=>setPriority(e.target.value as any)}><option value="alta">Alta</option><option value="media">Média</option><option value="baixa">Baixa</option></select></label><div className="full quickActions"><button className="actionButton" onClick={createContest}>Adicionar concurso</button><button className="miniButton" onClick={async()=>{await seedBaseContent(activeContestId);await refreshContests();setMessage("Base de teste criada.");}}>Criar base de teste</button></div>{message&&<div className="statusBox full">{message}</div>}</section>
    <section className="stack">{contests.map(contest=><article className={`panel contestCard ${contest.id===activeContestId?"selectedContest":""}`} key={contest.id}><div><span className="badge">Prioridade {contest.priority}</span><h2>{contest.name}{contest.role?` — ${contest.role}`:""}</h2><p className="muted">{contest.organ||"Órgão não informado"}{contest.board?` • ${contest.board}`:""}{contest.year?` • ${contest.year}`:""}</p></div><button className="actionButton secondaryAction" onClick={()=>selectContest(contest.id)}>{contest.id===activeContestId?"Ativo":"Usar este concurso"}</button></article>)}</section>
  </AppShell>;
}
