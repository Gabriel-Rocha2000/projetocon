"use client";
import { useState } from "react";
import AppShell from "@/components/AppShell";
import DeveloperGate from "@/components/DeveloperGate";
import { useAuth } from "@/contexts/AuthContext";
import { useContest } from "@/contexts/ContestContext";
import { db } from "@/lib/firebase";
import { isDeveloperSession } from "@/lib/developerMode";
import { collection, doc, getDocs, writeBatch } from "firebase/firestore";

const COLLECTIONS = ["questions", "content_blocks", "materials", "topics"] as const;
type CollectionName = typeof COLLECTIONS[number];
type RecordRow = { id: string; data: Record<string, unknown> };
type Snapshot = { contestId: string; exportedAt: string; collections: Record<CollectionName, RecordRow[]>; blocked: Record<CollectionName, number> };
const emptyCount = () => ({ questions: 0, content_blocks: 0, materials: 0, topics: 0 });

function serialize(value: unknown): unknown {
  if (value == null || typeof value !== "object") return value;
  if (typeof (value as {toDate?: () => Date}).toDate === "function")
    return { __firestoreTimestamp: (value as {toDate: () => Date}).toDate().toISOString() };
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof (value as {latitude?: unknown}).latitude === "number" && typeof (value as {longitude?: unknown}).longitude === "number")
    return { __geoPoint: [ (value as {latitude:number}).latitude, (value as {longitude:number}).longitude ] };
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, serialize(item)]));
}

export default function Seguranca() {
  const { user } = useAuth();
  const { activeContest, activeContestId } = useContest();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [backedUp, setBackedUp] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [finished, setFinished] = useState<Record<CollectionName, number> | null>(null);

  async function inspect(): Promise<Snapshot> {
    if (!user || !isDeveloperSession(user.uid) || !activeContestId) throw Error("Acesso de desenvolvedor ou concurso ativo indisponível.");
    // Conservador: nunca atribuir documentos legados sem contestId a um concurso.
    const collections = {} as Snapshot["collections"];
    const blocked = emptyCount();
    for (const name of COLLECTIONS) {
      const rows = await getDocs(collection(db, name));
      collections[name] = [];
      for (const row of rows.docs) {
        const data = row.data();
        if (data.contestId === activeContestId) collections[name].push({ id: row.id, data: serialize(data) as Record<string, unknown> });
        else if (!data.contestId) blocked[name]++;
      }
    }
    return { contestId: activeContestId, exportedAt: new Date().toISOString(), collections, blocked };
  }

  async function preview() {
    setBusy(true); setSnapshot(null); setBackedUp(false); setFinished(null); setConfirmation(""); setMessage("");
    try { const next = await inspect(); setSnapshot(next); setMessage("Prévia pronta. Exporte o backup antes de limpar."); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Erro ao consultar dados."); }
    finally { setBusy(false); }
  }

  function exportBackup() {
    if (!snapshot || snapshot.contestId !== activeContestId) return;
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `projeto-fazenda-backup-${activeContestId}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    setBackedUp(true); setMessage("Download do backup solicitado. Confirme se o arquivo foi salvo e se abre corretamente antes de excluir.");
  }

  async function reset() {
    if (!user || !isDeveloperSession(user.uid) || !snapshot || busy || !backedUp || confirmation !== `ZERAR ${activeContestId}`) return;
    setBusy(true); setMessage("");
    const counts = emptyCount();
    try {
      // Revalida o estado antes de destruir. Mudanças após o backup obrigam nova prévia.
      const fresh = await inspect();
      const same = COLLECTIONS.every(name =>
        JSON.stringify(fresh.collections[name].map(x => x.id).sort()) === JSON.stringify(snapshot.collections[name].map(x => x.id).sort()));
      if (!same || fresh.contestId !== snapshot.contestId) throw Error("A base mudou após o backup. Gere nova prévia e novo backup.");
      // Dependências primeiro: não remover tópicos antes de questões e conteúdos.
      for (const name of COLLECTIONS) {
        const ids = fresh.collections[name].map(x => x.id);
        for (let i = 0; i < ids.length; i += 300) {
          const batch = writeBatch(db);
          ids.slice(i, i + 300).forEach(id => batch.delete(doc(db, name, id)));
          await batch.commit();
          counts[name] += Math.min(300, ids.length - i);
          setMessage(`Excluindo ${name}: ${counts[name]}/${ids.length}`);
        }
      }
      setFinished(counts); setSnapshot(null); setBackedUp(false); setConfirmation("");
      setMessage("Limpeza das quatro coleções concluída. Progresso histórico, PDFs no Storage e registros sem contestId foram preservados. Recarregue o aplicativo antes de importar CSVs.");
    } catch (e) {
      setMessage(`Operação interrompida. Removidos até aqui: ${JSON.stringify(counts)}. ${e instanceof Error ? e.message : String(e)}. Refaça a inspeção.`);
      setSnapshot(null); setBackedUp(false); setConfirmation("");
    } finally { setBusy(false); }
  }

  const totals = snapshot ? COLLECTIONS.map(name => ({name, count:snapshot.collections[name].length, legacy:snapshot.blocked[name]})) : [];
  return <AppShell><DeveloperGate>
    <div className="pageHeader"><div><h1>Histórico e segurança</h1><p className="muted">Prévia, backup e reinicialização controlada das importações.</p></div></div>
    <section className="panel">
      <h2>Recomeçar a base do concurso</h2>
      <p>Concurso ativo: <strong>{activeContest?.name || activeContestId}</strong> ({activeContestId}). Este procedimento remove apenas questões, microblocos, materiais cadastrados e tópicos com contestId correspondente. Não apaga outros concursos, contas, arquivos PDF do Storage nem histórico de estudos.</p>
      <p><strong>Atenção:</strong> histórico de estudo pode continuar referenciando registros excluídos. Se a intenção for reiniciar também desempenho, revisões e caderno de erros, isso exige uma operação separada de migração e limpeza dos registros pessoais.</p>
      <button className="actionButton secondaryAction" onClick={preview} disabled={busy}>1. Inspecionar dados</button>
      {snapshot && <div style={{marginTop:18}}>
        <h3>Prévia do que será excluído</h3>
        <ul>{totals.map(({name,count,legacy}) => <li key={name}><strong>{name}</strong>: {count} registros identificados; {legacy} sem concurso definido (preservados)</li>)}</ul>
        <button className="actionButton secondaryAction" onClick={exportBackup} disabled={busy}>2. Exportar backup JSON</button>
        <p className="muted">O download não verifica o salvamento: abra o arquivo e confirme os dados antes de continuar.</p>
        <label htmlFor="reset-confirmation">3. Para confirmar, digite exatamente <strong>ZERAR {activeContestId}</strong></label>
        <input id="reset-confirmation" value={confirmation} onChange={e => setConfirmation(e.target.value)} disabled={busy} style={{display:"block",maxWidth:420,width:"100%",padding:10,margin:"10px 0"}} />
        <button className="actionButton" disabled={busy || !backedUp || confirmation !== `ZERAR ${activeContestId}`} onClick={reset}>4. Excluir registros identificados</button>
      </div>}
      {finished && <p>Concluído: {COLLECTIONS.map(n => `${n}: ${finished[n]}`).join(" · ")}</p>}
      {message && <p role="status">{message}</p>}
    </section>
  </DeveloperGate></AppShell>;
}
