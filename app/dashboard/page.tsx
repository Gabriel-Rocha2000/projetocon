"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import Drawer from "@/components/Drawer";
import StatCard from "@/components/StatCard";
import { useAuth } from "@/contexts/AuthContext";
import { useContest } from "@/contexts/ContestContext";
import { generateDailyPlan, generateQuickStudyPlan, getDashboardData, getErrors, getTodayPlan } from "@/services/firestore";
import { DailyPlan, DailyPlanTask, DashboardData } from "@/types";

type DrawerKind = "coverage" | "mastery" | "questions" | "errors" | "risks" | null;

function taskHref(task: DailyPlanTask) {
  if (task.type === "revisao" && task.sourceType === "question" && task.sourceId) return `/questoes/${task.sourceId}`;
  if (task.type === "lei_seca" && task.sourceId) return `/lei-seca?item=${encodeURIComponent(task.sourceId)}&review=1`;
  if (task.type === "questoes" && task.topicId) return `/questoes?topic=${encodeURIComponent(task.topicId)}&amount=${task.questionTarget || 15}&start=1`;
  if (task.topicId) return `/conteudo/${encodeURIComponent(task.topicId)}${task.contentBlockId ? `?block=${encodeURIComponent(task.contentBlockId)}` : ""}`;
  return "/planejador";
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { activeContestId, activeContest, contests, loading: contestLoading, error: contestError } = useContest();
  const [data, setData] = useState<DashboardData | null>(null);
  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [errors, setErrors] = useState<any[]>([]);
  const [drawer, setDrawer] = useState<DrawerKind>(null);
  const [quickMinutes, setQuickMinutes] = useState<number | null>(null);
  const [quickPlan, setQuickPlan] = useState<DailyPlanTask[]>([]);
  const [copyStatus, setCopyStatus] = useState("");
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setPlan(null);
    setErrors([]);
    setDashboardError("");
    setDashboardLoading(true);

    if (!user || contestLoading) return () => { cancelled = true; };
    if (contestError || !contests.some(contest => contest.id === activeContestId)) {
      setDashboardError(contestError || "O concurso ativo não foi encontrado. Verifique a página Concursos e a conexão com o Firestore.");
      setDashboardLoading(false);
      return () => { cancelled = true; };
    }

    async function run() {
      try {
        const uid = user!.uid;
        const [dashboard, existingPlan, errorRows] = await Promise.all([
          getDashboardData(uid, activeContestId),
          getTodayPlan(uid, activeContestId),
          getErrors(uid, activeContestId),
        ]);
        if (cancelled) return;
        // Só geramos plano quando a leitura terminou sem erro.
        const dayPlan = existingPlan || await generateDailyPlan(uid, activeContestId);
        if (cancelled) return;
        setData(dashboard);
        setErrors(errorRows);
        setPlan(dayPlan);
      } catch (error) {
        if (!cancelled) {
          const code = error && typeof error === "object" && "code" in error
            ? String((error as {code?: string}).code || "") : "";
          setDashboardError(code.includes("resource-exhausted")
            ? "Cota de leituras do Firestore atingida. Os dados não foram apagados."
            : error instanceof Error ? `Não foi possível carregar o Dashboard: ${error.message}` : "Falha ao consultar o Firestore.");
        }
      } finally {
        if (!cancelled) setDashboardLoading(false);
      }
    }
    void run();
    return () => { cancelled = true; };
  }, [user?.uid, activeContestId, contestLoading, contestError, contests]);

  const displayReady = !dashboardLoading && !dashboardError && data !== null;

  const pending = useMemo(() => plan?.tasks.filter(t => t.status === "pendente") || [], [plan]);
  const nextTask = pending[0];
  const totalPlanned = pending.reduce((sum, t) => sum + t.durationMinutes, 0);
  const recurring = errors.filter(e => e.status !== "consolidado" && Number(e.recurrence || 1) >= 2).sort((a,b) => Number(b.recurrence || 1) - Number(a.recurrence || 1));
  const drawerTitle = drawer === "coverage" ? "Cobertura do edital" : drawer === "mastery" ? "Domínio efetivo" : drawer === "questions" ? "Questões" : drawer === "risks" ? "Se a prova fosse amanhã" : "Caderno de Erros";

  async function quick(minutes: number) {
    if (!user || !displayReady) return; setQuickMinutes(minutes); setQuickPlan(await generateQuickStudyPlan(user.uid, activeContestId, minutes));
  }

  const chatReport = useMemo(() => {
    if (!data) return dashboardError || "Carregando dados para o relatório...";
    const confidence = data.confidenceBreakdown || { sabia: 0, entreDuas: 0, chutei: 0 };
    const disciplineLines = (data.disciplineStats || []).map(row =>
      `- ${row.discipline}: cobertura ${row.coverage}% | domínio ${row.mastery}% | evidência ${row.evidence}% | ${row.answered} questões | ${row.errors} erros | ${row.fragileCoverage} cobertura(s) frágil(is)`
    );
    const riskLines = (data.risks || []).slice(0, 6).map(risk => `- ${risk.discipline} / ${risk.title}: ${risk.reason}`);
    const errorLines = recurring.slice(0, 6).map(error => `- ${error.discipline} / ${error.subject || error.topicId}: ${error.recurrence || 1} erro(s), ${Number(error.correctStreak || 0)}/3 acertos seguidos`);
    const pendingLines = pending.slice(0, 6).map(task => `- ${task.period}: ${task.discipline} / ${task.title} (${task.durationMinutes} min) — ${task.reason}`);
    return [
      "RELATÓRIO PROJETO FAZENDA — DASHBOARD",
      `Concurso ativo: ${activeContest?.name || activeContestId}${activeContest?.role ? ` — ${activeContest.role}` : ""}`,
      `Gerado em: ${new Date().toLocaleString("pt-BR")}`,
      "Período: base acumulada do concurso ativo",
      "",
      `Tempo registrado: ${Math.round(((data.totalMinutes || 0) / 60) * 10) / 10} h`,
      `Cobertura: ${data.coverage}% | Domínio: ${data.mastery}% | Evidência: ${data.evidence}%`,
      `Questões respondidas: ${data.questionsAnswered} | Acurácia efetiva: ${data.accuracy}%`,
      `Confiança (último registro por questão): Sabia ${confidence.sabia} | Entre duas ${confidence.entreDuas} | Chutei ${confidence.chutei}`,
      `Erros: ${data.totalErrors} totais | ${data.activeErrors} ativos | ${data.recurringErrors} recorrentes | ${data.consolidatedErrors} consolidados`,
      `Revisões vencidas: ${data.dueReviews} | Lei Seca pendente: ${data.dueLaw}`,
      "",
      "POR DISCIPLINA",
      ...(disciplineLines.length ? disciplineLines : ["- Sem dados suficientes"]),
      "",
      "MAIORES RISCOS",
      ...(riskLines.length ? riskLines : ["- Sem riscos calculados"]),
      "",
      "ERROS RECORRENTES",
      ...(errorLines.length ? errorLines : ["- Nenhum erro recorrente ativo"]),
      "",
      "PRÓXIMAS TAREFAS",
      ...(pendingLines.length ? pendingLines : ["- Sem tarefas pendentes"]),
      "",
      "Use este relatório para analisar meu desempenho, apontar lacunas e sugerir o próximo foco de estudo."
    ].join("\n");
  }, [data, recurring, pending, activeContest, activeContestId, dashboardError]);

  async function copyChatReport() {
    try {
      await navigator.clipboard.writeText(chatReport);
      setCopyStatus("Copiado");
      window.setTimeout(() => setCopyStatus(""), 1800);
    } catch {
      setCopyStatus("Selecione o texto e copie manualmente");
    }
  }

  return <AppShell>
    {dashboardError && <div className="statusBox" role="alert">{dashboardError} Não reimporte arquivos nem crie uma base de teste enquanto houver erro.</div>}
    {dashboardLoading && <div className="statusBox" role="status">Carregando métricas do concurso selecionado...</div>}
    <div className="pageHeader"><div><h1>Seu dia</h1><p className="muted">{activeContest?.name || activeContestId} • {pending.length} tarefa(s) • {totalPlanned} min restantes</p></div><div className="quickActions"><Link href="/planejador" className="actionButton secondaryAction">Plano completo</Link></div></div>

    <section className="todayHero panel">{nextTask ? <><div><span className="eyebrow">PRÓXIMO BLOCO</span><h2>{nextTask.discipline} — {nextTask.title}</h2><p className="todayMeta">{nextTask.durationMinutes} min{nextTask.questionTarget ? ` • ${nextTask.questionTarget} questões` : ""}</p><p className="muted">Por quê: {nextTask.reason}</p></div><Link href={taskHref(nextTask)} className="actionButton heroAction">Iniciar</Link></> : <div><span className="eyebrow">HOJE</span><h2>Plano concluído</h2><p className="muted">Sem tarefas pendentes. Use o modo rápido se quiser aproveitar alguns minutos extras.</p></div>}</section>

    <section className="quickTime panel"><div><h2>Tenho alguns minutos agora</h2><p className="muted">O sistema escolhe a melhor combinação sem você montar nada.</p></div><div className="timeButtons">{[10,20,30,60].map(m=><button key={m} className={quickMinutes===m?"selected":""} onClick={()=>quick(m)}>{m===60?'1h':`${m} min`}</button>)}</div></section>
    {quickPlan.length>0 && <section className="panel quickPlanPanel"><div className="panelHeader"><div><span className="eyebrow">MELHOR USO DE {quickMinutes} MIN</span><h2>Comece pelo primeiro item</h2></div><button className="textButton" onClick={()=>{setQuickPlan([]);setQuickMinutes(null)}}>Fechar</button></div><div className="quickPlanList">{quickPlan.map((task,i)=><Link href={taskHref(task)} key={task.id} className="quickPlanRow"><span className="quickPlanNumber">{i+1}</span><div><strong>{task.title}</strong><p>{task.durationMinutes} min • {task.reason}</p></div><span>Iniciar →</span></Link>)}</div></section>}

    {data?.resumeItems?.length ? <section className="resumeSection"><div className="sectionHeading"><h2>Continuar de onde parei</h2></div><div className="resumeGrid">{data.resumeItems.map(item=><Link href={item.href} className="resumeCard" key={item.id}><span className="statusPill">{item.type}</span><strong>{item.title}</strong><span>{item.subtitle}</span></Link>)}</div></section> : null}

    <section className="grid4 metricsGrid"><StatCard label="Cobertura" value={displayReady ? `${data!.coverage}%` : "—"} note="do edital com contato registrado" onClick={() => setDrawer("coverage")} /><StatCard label="Domínio" value={displayReady ? `${data!.mastery}%` : "—"} note="corrigido por baixa confiança" onClick={() => setDrawer("mastery")} /><StatCard label="Evidência" value={displayReady ? `${data!.evidence}%` : "—"} note="força da amostra de questões" onClick={() => setDrawer("questions")} /><StatCard label="Erros ativos" value={displayReady ? `${data!.activeErrors}` : "—"} note={displayReady ? `${data!.recurringErrors} recorrentes • ${data!.consolidatedErrors} em revisão` : "Aguardando dados"} onClick={() => setDrawer("errors")} /></section>

    <section className="panel riskPanel"><div className="panelHeader"><div><span className="eyebrow">DIAGNÓSTICO</span><h2>Se a prova fosse amanhã</h2><p className="muted">Onde há maior chance de você perder pontos hoje.</p></div><button className="miniButton" onClick={()=>setDrawer("risks")}>Ver todos</button></div>{data?.risks?.length ? <div className="riskList">{data.risks.slice(0,4).map(risk=><div className="riskRow" key={risk.id}><span className={`riskDot ${risk.severity}`}/><div><strong>{risk.discipline} — {risk.title}</strong><p>{risk.reason}</p></div>{risk.topicId&&<Link href={`/conteudo/${encodeURIComponent(risk.topicId)}`}>Estudar →</Link>}</div>)}</div> : <div className="emptyState">Ainda não há dados suficientes para um diagnóstico.</div>}</section>

    <section className="panel"><div className="panelHeader"><div><h2>Por disciplina</h2><p className="muted">Cobertura, domínio e evidência aparecem separados para evitar falsa segurança.</p></div></div><div className="disciplineTable"><div className="disciplineHead"><span>Disciplina</span><span>Cobertura</span><span>Domínio</span><span>Evidência</span><span>Questões</span></div>{(data?.disciplineStats || []).map(row => <div className="disciplineRow" key={row.discipline}><strong>{row.discipline}</strong><span>{row.coverage}%</span><span className={row.mastery < 60 ? "redText" : row.mastery < 80 ? "amberText" : "greenText"}>{row.mastery}%</span><span>{row.evidence}%{row.fragileCoverage>0?<small className="fragileHint"> • {row.fragileCoverage} frágeis</small>:null}</span><span>{row.answered}</span></div>)}{!data?.disciplineStats?.length && <div className="emptyState">Ainda não há dados suficientes.</div>}</div></section>

    <section className="grid3 secondaryGrid"><div className="card"><span className="muted">Tempo registrado</span><strong className="big">{Math.round(((data?.totalMinutes ?? 0) / 60) * 10) / 10} h</strong></div><Link href="/revisao-almoco" className="quickCard"><strong>Revisão do almoço</strong><span>{data?.dueReviews ?? 0} revisão(ões) vencida(s)</span></Link><Link href="/lei-seca" className="quickCard"><strong>Lei Seca</strong><span>{data?.dueLaw ?? 0} dispositivo(s) para revisar</span></Link></section>

    <section className="panel chatReportPanel"><div className="panelHeader"><div><span className="eyebrow">COMPARTILHAR CONTEXTO</span><h2>Relatório para ChatGPT</h2><p className="muted">Copie este resumo e cole no chat para eu analisar seu desempenho sem você precisar explicar tudo novamente.</p></div><button className="actionButton secondaryAction" onClick={copyChatReport}>{copyStatus || "Copiar relatório"}</button></div><textarea className="chatReportText" value={chatReport} readOnly aria-label="Relatório de desempenho para ChatGPT" /></section>

    <Drawer open={!!drawer} title={drawerTitle} onClose={() => setDrawer(null)}>
      {drawer === "coverage" && <div className="drawerStack"><p className="muted">Cobertura só mostra contato com o edital. “Cobertura frágil” indica que o assunto foi estudado, mas ainda não há questões suficientes para validar.</p>{(data?.disciplineStats || []).map(row => <div className="drawerListRow" key={row.discipline}><div><strong>{row.discipline}</strong><small>{row.studiedTopics}/{row.totalTopics} itens • {row.fragileCoverage} frágeis</small></div><strong>{row.coverage}%</strong></div>)}</div>}
      {drawer === "mastery" && <div className="drawerStack"><p className="muted">Acertos com “entre duas” ou “chutei” recebem peso menor. O objetivo é medir conhecimento, não sorte.</p>{(data?.disciplineStats || []).map(row => <div className="drawerListRow" key={row.discipline}><div><strong>{row.discipline}</strong><small>{row.answered} respostas • evidência {row.evidence}%</small></div><strong className={row.mastery < 60 ? "redText" : row.mastery < 80 ? "amberText" : "greenText"}>{row.mastery}%</strong></div>)}</div>}
      {drawer === "questions" && <div className="drawerStack"><div className="drawerMetrics"><div><span>Respostas</span><strong>{data?.questionsAnswered ?? 0}</strong></div><div><span>Domínio</span><strong>{data?.accuracy ?? 0}%</strong></div><div><span>Evidência</span><strong>{data?.evidence ?? 0}%</strong></div></div><Link href="/questoes" className="actionButton">Abrir questões</Link></div>}
      {drawer === "errors" && <div className="drawerStack"><div className="drawerMetrics"><div><span>Total</span><strong>{data?.totalErrors ?? 0}</strong></div><div><span>Ativos</span><strong>{data?.activeErrors ?? 0}</strong></div><div><span>Consolidados</span><strong>{data?.consolidatedErrors ?? 0}</strong></div></div>{recurring.slice(0,6).map(error => <div className="drawerListRow" key={error.id}><div><strong>{error.discipline}</strong><small>{error.subject || error.topicId} • {Number(error.correctStreak||0)}/3 acertos</small></div><strong className="redText">{error.recurrence}x</strong></div>)}<Link href="/caderno-erros" className="actionButton">Abrir Caderno de Erros</Link></div>}
      {drawer === "risks" && <div className="drawerStack">{(data?.risks||[]).map(r=><div className="detailBlock" key={r.id}><strong>{r.discipline} — {r.title}</strong><p>{r.reason}</p>{r.topicId&&<Link href={`/conteudo/${encodeURIComponent(r.topicId)}`}>Ir para conteúdo →</Link>}</div>)}</div>}
    </Drawer>
  </AppShell>;
}
