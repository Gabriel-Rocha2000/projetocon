"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import {
  executeStudyReset,
  makeStudyResetBackup,
  prepareStudyReset,
  RESET_GLOBAL_COLLECTIONS,
  RESET_USER_COLLECTIONS,
  resetTotals,
} from "@/lib/studyReset";
import type { ResetProgress, StudyResetSnapshot } from "@/lib/studyReset";

const CONFIRMATION = "ZERAR BASE COMPLETA";
const whenReset = [
  "Mapa-Mestre: todas as disciplinas, tópicos e subtópicos de todos os concursos.",
  "Teoria: microblocos, textos de conteúdo, materiais não-PDF e versões do edital.",
  "Banco de questões: enunciados, gabaritos e comentários de todos os concursos.",
  "Histórico da conta atual: respostas, caderno de erros, revisões, sessões e planejamentos.",
  "Lei seca: documentos e registros de leis ligados à base de estudos.",
];

export default function ReiniciarBasePage() {
  const { user } = useAuth();
  const [snapshot, setSnapshot] = useState<StudyResetSnapshot | null>(null);
  const [progress, setProgress] = useState<ResetProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [savedConfirmed, setSavedConfirmed] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState<number | null>(null);
  const totals = useMemo(() => snapshot ? resetTotals(snapshot) : null, [snapshot]);

  async function createInventory() {
    if (!user || busy) return;
    setBusy(true);
    setError("");
    setDone(null);
    setSnapshot(null);
    setDownloaded(false);
    setSavedConfirmed(false);
    setConfirmation("");
    try {
      setSnapshot(await prepareStudyReset(user.uid, setProgress));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível inventariar a base. Nenhum dado foi apagado.");
    } finally {
      setBusy(false);
    }
  }

  function downloadBackup() {
    if (!snapshot) return;
    try {
      const url = URL.createObjectURL(makeStudyResetBackup(snapshot));
      const link = document.createElement("a");
      link.href = url;
      link.download = "concurseiro-clt-backup-integral-" + snapshot.createdAt.replace(/[:.]/g, "-") + ".json";
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10000);
      setDownloaded(true);
      setSavedConfirmed(false);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha na preparação do arquivo de backup.");
    }
  }

  async function reset() {
    if (!user || !snapshot || busy || !downloaded || !savedConfirmed ||
      confirmation.trim() !== CONFIRMATION || done !== null) return;
    if (!window.confirm(
      "ATENÇÃO: deseja excluir os registros de mapas, questões, conteúdos e históricos de estudo de TODOS os concursos?\n\n" +
      "Seu arquivo de backup deve estar salvo. Os PDFs originais serão preservados.\n\n" +
      "Esta ação NÃO possui desfazer automático."
    )) return;
    setBusy(true);
    setError("");
    try {
      const result = await executeStudyReset(snapshot, user.uid, setProgress);
      if (!result.verified) throw new Error("A limpeza não foi confirmada.");
      setDone(result.deleted);
      setConfirmation("");
    } catch (e) {
      setError(
        (e instanceof Error ? e.message : "Não foi possível concluir a reinicialização.") +
        " Algumas exclusões podem ter sido realizadas. Preserve o backup, atualize o inventário e não comece a importar antes de uma conferência."
      );
      setSnapshot(null);
      setDownloaded(false);
      setSavedConfirmed(false);
    } finally {
      setBusy(false);
    }
  }

  const canDelete = !!user && !!snapshot && downloaded && savedConfirmed &&
    confirmation.trim() === CONFIRMATION && !busy && done === null;

  return <AppShell>
    <div className="pageHeader">
      <div>
        <span className="eyebrow">MODO DESENVOLVEDOR · ADMINISTRAÇÃO</span>
        <h1>Reinicializar base de estudos</h1>
        <p className="muted">Recomece todos os concursos com CSVs validados, sem apagar sua conta ou os PDFs originais.</p>
      </div>
      <Link className="actionButton secondaryAction" href="/desenvolvedor">← Modo Desenvolvedor</Link>
    </div>

    <section className="panel">
      <h2>Antes da exclusão</h2>
      <p>Esta operação vai remover definitivamente os dados de estudos e aprendizado de <strong>todos os concursos</strong> cadastrados no aplicativo. Não é apenas “Excluir da lista”.</p>
      <ul className="resetBulletList">{whenReset.map(line => <li key={line}>{line}</li>)}</ul>
      <p className="statusBox"><strong>Serão preservados:</strong> login, dados da conta, configurações, cadastro dos concursos, arquivos PDF no Storage e registros de materiais PDF com arquivo vinculado. Os históricos de outras contas, caso existam, não serão alterados.</p>
      <p className="smallNote muted"><strong>Importante:</strong> o backup JSON conserva IDs e dados, mas a restauração automática ainda não está implementada. Não mantenha outras abas gravando dados durante a reinicialização.</p>
    </section>

    <section className="panel">
      <h2>1. Inventário e backup obrigatório</h2>
      <p className="muted">O inventário lê os registros reais do Firebase. Pode consumir leituras do Firestore e levar algum tempo. Se ocorrer erro, nada é excluído.</p>
      <button className="actionButton" type="button" disabled={busy || !user} onClick={() => void createInventory()}>
        {busy && progress?.phase === "inventario" ? "Preparando inventário..." : snapshot ? "Refazer inventário" : "Conferir base inteira"}
      </button>
      {snapshot && totals && <div style={{ marginTop: 16 }}>
        <div className="devAuditGrid">
          <div className="devAuditStat"><strong>{totals.global}</strong><span>Registros globais para exclusão</span></div>
          <div className="devAuditStat"><strong>{totals.user}</strong><span>Registros de estudo da conta atual</span></div>
          <div className="devAuditStat"><strong>{totals.total}</strong><span>Total previsto para exclusão</span></div>
          <div className="devAuditStat"><strong>{totals.retainedPdfs}</strong><span>PDFs com vínculo preservado</span></div>
        </div>
        <details className="resetInventoryDetails">
          <summary>Conferir todas as coleções antes de continuar</summary>
          <div className="resetInventoryGrid">
            {RESET_GLOBAL_COLLECTIONS.map(name => <div key={name}><code>{name}</code> <strong>{snapshot.global[name].length}</strong></div>)}
            {RESET_USER_COLLECTIONS.map(name => <div key={name}><code>users/.../{name}</code> <strong>{snapshot.currentUser[name].length}</strong></div>)}
          </div>
        </details>
        <button className="actionButton secondaryAction" type="button" disabled={busy} onClick={downloadBackup}>
          Baixar backup integral (.json)
        </button>
        {downloaded && <label className="resetCheck"><input type="checkbox" checked={savedConfirmed} disabled={busy}
          onChange={event => setSavedConfirmed(event.target.checked)} />
          Conferi que o arquivo JSON foi salvo no meu computador e não está vazio.
        </label>}
      </div>}
    </section>

    <section className="panel resetDangerPanel">
      <h2>2. Reinicialização definitiva</h2>
      <p>A exclusão só será liberada após gerar o inventário, baixar o backup e confirmar o arquivo salvo.</p>
      <label htmlFor="resetConfirmation"><strong>Digite exatamente: {CONFIRMATION}</strong></label>
      <input id="resetConfirmation" className="resetConfirmationInput"
        autoComplete="off" spellCheck={false} value={confirmation}
        onChange={event => setConfirmation(event.target.value)}
        disabled={!snapshot || !savedConfirmed || busy || done !== null}
        placeholder={CONFIRMATION}/>
      <button className="dangerButton resetRunButton" type="button" disabled={!canDelete}
        onClick={() => void reset()}>
        {busy && progress?.phase !== "inventario" ? "Limpando e verificando..." : "Apagar todos os dados de estudos"}
      </button>
      {progress && <div role="status" className="resetProgress">
        <strong>{progress.detail}</strong>
        <span>{progress.phase === "inventario" ? "Inventário" :
          progress.phase === "exclusao" ? "Exclusão em lotes" :
          progress.phase === "conferencia" ? "Conferindo banco" : "Concluído"} · {progress.current}/{progress.total}</span>
        <progress max={Math.max(1, progress.total)} value={progress.current} />
      </div>}
      {error && <p className="statusBox" role="alert">{error}</p>}
      {done !== null && <div className="resetSuccess" role="status">
        <h3>Base reinicializada e conferida</h3>
        <p>{done} documentos excluídos. PDFs originais, cadastros de concursos, configurações e login preservados.</p>
        <p>Agora vamos importar um CSV por vez, começando pelo Mapa-Mestre da primeira disciplina.</p>
        <Link className="actionButton" href="/desenvolvedor/importar-mapa">Importar primeiro Mapa-Mestre →</Link>
      </div>}
    </section>
    <section className="panel">
      <h2>3. Sequência de reconstrução</h2>
      <p><strong>Para cada disciplina:</strong> 1) importar Mapa-Mestre e conferir IDs/hierarquia; 2) importar conteúdo, comparar seção/páginas e contagem; 3) vincular e abrir PDF; 4) importar questões com gabarito e vínculos; 5) fazer uma questão e uma revisão de teste; 6) conferir a <Link href="/desenvolvedor/auditoria">auditoria</Link>.</p>
      <p className="smallNote muted">Se houver divergência, interrompa a importação seguinte. Os relatórios previstos × importados serão entregues junto dos futuros CSVs.</p>
    </section>
  </AppShell>;
}
