"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { useContest } from "@/contexts/ContestContext";
import {
  completePlanTask,
  generateDailyPlan,
  getStudySettings,
  getTodayPlan,
  ignorePlanTask,
  saveStudySettings,
} from "@/services/firestore";
import { DailyPlan, DailyPlanTask, Difficulty, StudySettings } from "@/types";

const periodNames = { manha: "Manhã", almoco: "Revisão do almoço", noite: "Noite" } as const;
function taskHref(task: DailyPlanTask) {
  if (task.type === "revisao" && task.sourceType === "question" && task.sourceId) return `/questoes/${task.sourceId}`;
  if (task.type === "lei_seca" && task.sourceId) return `/lei-seca?item=${encodeURIComponent(task.sourceId)}&review=1`;
  if (task.type === "questoes" && task.topicId) return `/questoes?topic=${encodeURIComponent(task.topicId)}&amount=${task.questionTarget || 15}&start=1`;
  if ((task.type === "estudo" || task.type === "revisao") && task.topicId) return `/conteudo/${encodeURIComponent(task.topicId)}${task.contentBlockId ? `?block=${encodeURIComponent(task.contentBlockId)}` : ""}`;
  return "/dashboard";
}


export default function PlanejadorPage() {
  const { user } = useAuth();
  const { activeContestId, activeContest } = useContest();
  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [settings, setSettings] = useState<StudySettings>({ morningMinutes: 30, lunchMinutes: 20, eveningMinutes: 90, defaultQuestionTarget: 15, mode: "normal" });
  const [message, setMessage] = useState("");

  async function load() {
    if (!user) return;
    const [existing, currentSettings] = await Promise.all([
      getTodayPlan(user.uid, activeContestId),
      getStudySettings(user.uid),
    ]);
    setSettings(currentSettings);
    setPlan(existing || await generateDailyPlan(user.uid, activeContestId));
  }

  useEffect(() => { load(); }, [user, activeContestId]);

  const grouped = useMemo(() => ({
    manha: plan?.tasks.filter(t => t.period === "manha") || [],
    almoco: plan?.tasks.filter(t => t.period === "almoco") || [],
    noite: plan?.tasks.filter(t => t.period === "noite") || [],
  }), [plan]);

  async function mark(taskId: string, difficulty: Difficulty) {
    if (!user || !plan) return;
    await completePlanTask(user.uid, plan, taskId, difficulty);
    setMessage(`Concluído. Dificuldade ${difficulty}: a próxima revisão foi recalculada.`);
    setPlan(await getTodayPlan(user.uid, activeContestId));
  }

  return (
    <AppShell>
      <div className="pageHeader">
        <div>
          <h1>Seu dia</h1>
          <p className="muted">{activeContest?.name || activeContestId} • o plano se adapta ao que você estuda, erra e classifica como fácil, médio ou difícil.</p>
        </div>
        <button className="actionButton secondaryAction" onClick={async () => { if (!user) return; setPlan(await generateDailyPlan(user.uid, activeContestId, true)); setMessage("Plano recalculado com os dados atuais."); }}>Recalcular hoje</button>
      </div>

      {message && <div className="statusBox">{message}</div>}

      {(["manha", "almoco", "noite"] as const).map(period => (
        <section className="panel planSection" key={period}>
          <div className="panelHeader">
            <div><span className="badge">{periodNames[period]}</span><h2>{grouped[period].reduce((sum, t) => sum + t.durationMinutes, 0)} min planejados</h2></div>
          </div>
          {grouped[period].length === 0 ? <p className="muted">Nenhuma tarefa para este período.</p> : grouped[period].map(task => (
            <div className={`planTask ${task.status}`} key={task.id}>
              <div className="planTaskMain">
                <div className="taskIcon">{task.type === "revisao" ? "🔁" : task.type === "lei_seca" ? "⚖️" : task.type === "questoes" ? "📝" : "📖"}</div>
                <div>
                  <strong>{task.discipline} — {task.title}</strong>
                  <div className="muted">{task.durationMinutes} min{task.questionTarget ? ` • meta: ${task.questionTarget} questões` : ""}</div>
                  <div className="taskReason">Por quê: {task.reason}</div>
                </div>
              </div>
              {task.status === "pendente" ? (
                <div className="taskActions">
                  <Link className="actionButton startTaskButton" href={taskHref(task)}>▶ Iniciar</Link>
                  <button className="difficulty easy" onClick={() => mark(task.id, "facil")}>Fácil</button>
                  <button className="difficulty medium" onClick={() => mark(task.id, "medio")}>Médio</button>
                  <button className="difficulty hard" onClick={() => mark(task.id, "dificil")}>Difícil</button>
                  <button className="miniButton ghost" onClick={async () => { if (user && plan) { await ignorePlanTask(user.uid, plan, task.id); setPlan(await getTodayPlan(user.uid, activeContestId)); } }}>Não fiz</button>
                </div>
              ) : <span className="taskStatus">{task.status === "concluida" ? `✓ Concluída • ${task.completedDifficulty || ""}` : "Ignorada"}</span>}
            </div>
          ))}
        </section>
      ))}

      <section className="panel">
        <h2>Minha disponibilidade padrão</h2>
        <div className="settingsGrid">
          <label>Manhã (min)<input type="number" min="0" value={settings.morningMinutes} onChange={e => setSettings({ ...settings, morningMinutes: Number(e.target.value) })} /></label>
          <label>Almoço (min)<input type="number" min="0" value={settings.lunchMinutes} onChange={e => setSettings({ ...settings, lunchMinutes: Number(e.target.value) })} /></label>
          <label>Noite (min)<input type="number" min="0" value={settings.eveningMinutes} onChange={e => setSettings({ ...settings, eveningMinutes: Number(e.target.value) })} /></label>
          <label>Meta padrão de questões<input type="number" min="0" value={settings.defaultQuestionTarget} onChange={e => setSettings({ ...settings, defaultQuestionTarget: Number(e.target.value) })} /></label>
          <label>Modo de estudo<select value={settings.mode || "normal"} onChange={e => setSettings({ ...settings, mode: e.target.value as "normal" | "reta_final" })}><option value="normal">Normal — cobertura + domínio</option><option value="reta_final">Reta final — questões + erros + revisão</option></select></label>
        </div>
        <button className="actionButton" onClick={async () => { if (!user) return; await saveStudySettings(user.uid, settings); setPlan(await generateDailyPlan(user.uid, activeContestId, true)); setMessage("Disponibilidade salva e plano recalculado."); }}>Salvar rotina e recalcular</button>
      </section>
    </AppShell>
  );
}
