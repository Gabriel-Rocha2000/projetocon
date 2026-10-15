"use client";

import {
  Suspense,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import Drawer from "@/components/Drawer";
import { useAuth } from "@/contexts/AuthContext";
import { useContest } from "@/contexts/ContestContext";
import {
  getErrors,
  getQuestions,
} from "@/services/firestore";
import { Question } from "@/types";

function CadernoErrosContent() {
  const { user } = useAuth();
  const search = useSearchParams();
  const { activeContestId } = useContest();

  const [errors, setErrors] = useState<any[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [discipline, setDiscipline] = useState(
    search.get("discipline") || ""
  );
  const [status, setStatus] = useState("");
  const [recurrence, setRecurrence] = useState("");
  const [selected, setSelected] = useState<any | null>(
    null
  );

  async function load() {
    if (!user) return;

    const [errorRows, qs] = await Promise.all([
      getErrors(user.uid, activeContestId),
      getQuestions(activeContestId),
    ]);

    setErrors(errorRows);
    setQuestions(qs);

    const focus = search.get("focus");

    if (focus) {
      setSelected(
        errorRows.find(
          (e: any) => e.id === focus
        ) || null
      );
    }
  }

  useEffect(() => {
    load();
  }, [user, activeContestId]);

  const questionMap = useMemo(
    () =>
      new Map(
        questions.map(q => [q.id, q])
      ),
    [questions]
  );

  const disciplines = Array.from(
    new Set(
      errors
        .map(e => e.discipline)
        .filter(Boolean)
    )
  ).sort();

  const filtered = useMemo(
    () =>
      errors
        .filter(
          error =>
            (!discipline ||
              error.discipline === discipline) &&
            (!status ||
              (status === "ativo"
                ? error.status !== "consolidado"
                : error.status === status)) &&
            (!recurrence ||
              (recurrence === "recorrente"
                ? Number(
                    error.recurrence || 1
                  ) >= 2
                : Number(
                    error.recurrence || 1
                  ) >= Number(recurrence)))
        )
        .sort((a, b) => {
          if (
            (a.status === "consolidado") !==
            (b.status === "consolidado")
          ) {
            return a.status === "consolidado"
              ? 1
              : -1;
          }

          if (
            Number(a.correctStreak || 0) !==
            Number(b.correctStreak || 0)
          ) {
            return (
              Number(a.correctStreak || 0) -
              Number(b.correctStreak || 0)
            );
          }

          return (
            Number(b.recurrence || 1) -
            Number(a.recurrence || 1)
          );
        }),
    [errors, discipline, status, recurrence]
  );

  const totals = {
    total: errors.length,

    active: errors.filter(
      e => e.status !== "consolidado"
    ).length,

    recurring: errors.filter(
      e =>
        e.status !== "consolidado" &&
        Number(e.recurrence || 1) >= 2
    ).length,

    consolidated: errors.filter(
      e => e.status === "consolidado"
    ).length,
  };

  return (
    <AppShell>
      <div className="pageHeader">
        <div>
          <h1>Caderno de Erros</h1>

          <p className="muted">
            A lista é permanente. Um erro só deixa de
            ser ativo depois de 3 acertos consecutivos.
          </p>
        </div>
      </div>

      <section className="grid4 compactMetrics">
        <div className="card">
          <span className="muted">Todos</span>
          <strong>{totals.total}</strong>
        </div>

        <div className="card">
          <span className="muted">Ativos</span>
          <strong>{totals.active}</strong>
        </div>

        <div className="card">
          <span className="muted">Recorrentes</span>
          <strong>{totals.recurring}</strong>
        </div>

        <div className="card">
          <span className="muted">Consolidados</span>
          <strong>{totals.consolidated}</strong>
        </div>
      </section>

      <section className="panel errorFilters">
        <label>
          Disciplina

          <select
            value={discipline}
            onChange={e =>
              setDiscipline(e.target.value)
            }
          >
            <option value="">Todas</option>

            {disciplines.map(d => (
              <option key={d}>
                {d}
              </option>
            ))}
          </select>
        </label>

        <label>
          Status

          <select
            value={status}
            onChange={e =>
              setStatus(e.target.value)
            }
          >
            <option value="">Todos</option>
            <option value="ativo">
              Ativos
            </option>
            <option value="consolidado">
              Consolidados
            </option>
          </select>
        </label>

        <label>
          Recorrência

          <select
            value={recurrence}
            onChange={e =>
              setRecurrence(e.target.value)
            }
          >
            <option value="">Qualquer</option>
            <option value="recorrente">
              2x ou mais
            </option>
            <option value="3">
              3x ou mais
            </option>
            <option value="5">
              5x ou mais
            </option>
          </select>
        </label>

        <div className="filterSummary">
          <strong>{filtered.length}</strong>
          <span>item(ns)</span>
        </div>
      </section>

      <section className="panel errorTablePanel">
        <div className="errorTable errorTableHead">
          <span>Disciplina / assunto</span>
          <span>Tipo</span>
          <span>Erros</span>
          <span>Acertos</span>
          <span>Status</span>
        </div>

        {filtered.map(error => {
          const q = questionMap.get(
            error.questionId
          );

          const streak = Math.min(
            3,
            Number(
              error.correctStreak || 0
            )
          );

          return (
            <button
              className="errorTable errorTableRow"
              key={error.id}
              onClick={() =>
                setSelected(error)
              }
            >
              <span>
                <strong>
                  {error.discipline}
                </strong>

                <small>
                  {q?.subject ||
                    error.subject ||
                    error.topicId}
                </small>
              </span>

              <span>
                {String(
                  error.errorType || ""
                ).replaceAll("_", " ")}
              </span>

              <span>
                <strong
                  className={
                    Number(
                      error.recurrence || 1
                    ) >= 3
                      ? "redText"
                      : ""
                  }
                >
                  {error.recurrence || 1}x
                </strong>
              </span>

              <span>
                <span className="miniStreak">
                  {streak}/3
                </span>
              </span>

              <span>
                <span
                  className={`statusPill ${
                    error.status ===
                    "consolidado"
                      ? "active"
                      : ""
                  }`}
                >
                  {error.status ===
                  "consolidado"
                    ? "Revisão"
                    : "Ativo"}
                </span>
              </span>
            </button>
          );
        })}

        {!filtered.length && (
          <div className="emptyState">
            Nenhum erro com estes filtros.
          </div>
        )}
      </section>

      <Drawer
        open={!!selected}
        title="Detalhes do erro"
        onClose={() =>
          setSelected(null)
        }
      >
        {selected &&
          (() => {
            const q =
              questionMap.get(
                selected.questionId
              );

            const streak = Math.min(
              3,
              Number(
                selected.correctStreak || 0
              )
            );

            return (
              <div className="drawerStack">
                <div>
                  <span className="badge">
                    {selected.discipline}
                  </span>

                  <h2>
                    {q?.subject ||
                      selected.subject ||
                      selected.topicId}
                  </h2>
                </div>

                <div className="drawerMetrics">
                  <div>
                    <span>Erros</span>
                    <strong>
                      {selected.recurrence ||
                        1}
                      x
                    </strong>
                  </div>

                  <div>
                    <span>
                      Acertos seguidos
                    </span>
                    <strong>
                      {streak}/3
                    </strong>
                  </div>

                  <div>
                    <span>Status</span>
                    <strong>
                      {selected.status ===
                      "consolidado"
                        ? "Revisão"
                        : "Ativo"}
                    </strong>
                  </div>
                </div>

                <div className="errorStreakLarge">
                  <span
                    className={
                      streak >= 1
                        ? "filled"
                        : ""
                    }
                  >
                    1
                  </span>

                  <i />

                  <span
                    className={
                      streak >= 2
                        ? "filled"
                        : ""
                    }
                  >
                    2
                  </span>

                  <i />

                  <span
                    className={
                      streak >= 3
                        ? "filled"
                        : ""
                    }
                  >
                    3
                  </span>
                </div>

                <div className="detailBlock">
                  <strong>
                    Tipo de erro
                  </strong>

                  <p>
                    {String(
                      selected.errorType ||
                        ""
                    ).replaceAll(
                      "_",
                      " "
                    )}
                  </p>
                </div>

                {selected.comment && (
                  <div className="detailBlock">
                    <strong>
                      Observação
                    </strong>

                    <p>
                      {selected.comment}
                    </p>
                  </div>
                )}

                {q && (
                  <div className="detailBlock">
                    <strong>
                      Questão
                    </strong>

                    <p>
                      {q.statement}
                    </p>
                  </div>
                )}

                <div className="warningBox">
                  {selected.status ===
                  "consolidado"
                    ? "Este erro já teve 3 acertos consecutivos. Ele permanece no histórico e agora entra apenas no ciclo normal de revisão."
                    : "A cada acerto seguido o contador avança. Qualquer novo erro volta a sequência para 0/3."}
                </div>

                <Link
                  className="actionButton"
                  href={`/questoes/${selected.questionId}`}
                >
                  {selected.status ===
                  "consolidado"
                    ? "Revisar questão"
                    : "Refazer questão"}
                </Link>
              </div>
            );
          })()}
      </Drawer>
    </AppShell>
  );
}

export default function CadernoErrosPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div className="emptyState">
            Carregando Caderno de Erros...
          </div>
        </AppShell>
      }
    >
      <CadernoErrosContent />
    </Suspense>
  );
}
