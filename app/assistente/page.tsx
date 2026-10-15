"use client";

import { useState } from "react";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { useContest } from "@/contexts/ContestContext";
import { getDashboardData, getErrors, getTodayPlan } from "@/services/firestore";

export default function AssistentePage() {
  const { user } = useAuth();
  const { activeContestId, activeContest } = useContest();
  const [question, setQuestion] = useState("O que devo priorizar hoje?");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);

  async function ask() {
    if (!user) return;
    setLoading(true); setAnswer("");
    const [dashboard, errors, plan] = await Promise.all([
      getDashboardData(user.uid, activeContestId),
      getErrors(user.uid, activeContestId),
      getTodayPlan(user.uid, activeContestId),
    ]);
    const response = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, context: { contest: activeContest || { id: activeContestId }, dashboard, errors: errors.slice(0, 20), todayPlan: plan } }) });
    const data = await response.json();
    setAnswer(data.answer || data.error || "Sem resposta."); setLoading(false);
  }

  return <AppShell><h1>Assistente Fazenda</h1><p className="muted">Analisa o concurso ativo, o plano do dia, erros e desempenho.</p><section className="panel"><textarea className="assistantInput" value={question} onChange={e => setQuestion(e.target.value)} /><button className="actionButton" onClick={ask} disabled={loading}>{loading ? "Analisando..." : "Perguntar"}</button>{answer && <div className="assistantAnswer">{answer}</div>}</section><section className="panel"><h2>Atalhos</h2><div className="promptGrid">{["O que devo priorizar hoje?", "Quais erros estou repetindo?", "Como está minha evolução por disciplina?", "O que revisar no almoço?"].map(x => <button key={x} className="promptChip" onClick={() => setQuestion(x)}>{x}</button>)}</div></section></AppShell>;
}
