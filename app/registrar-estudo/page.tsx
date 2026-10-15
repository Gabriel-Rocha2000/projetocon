"use client";

import {
  FormEvent,
  Suspense,
  useEffect,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { useContest } from "@/contexts/ContestContext";
import {
  addStudySession,
  getTopics,
} from "@/services/firestore";
import {
  Difficulty,
  StudyType,
  Topic,
} from "@/types";

function RegistrarEstudoContent() {
  const search = useSearchParams();
  const { user } = useAuth();
  const { activeContestId } = useContest();

  const [topics, setTopics] =
    useState<Topic[]>([]);

  const [topicId, setTopicId] =
    useState("");

  const [studyType, setStudyType] =
    useState<StudyType>("pdf");

  const [
    durationMinutes,
    setDurationMinutes,
  ] = useState(60);

  const [
    questionsDone,
    setQuestionsDone,
  ] = useState(0);

  const [
    correctAnswers,
    setCorrectAnswers,
  ] = useState(0);

  const [notes, setNotes] =
    useState("");

  const [
    difficulty,
    setDifficulty,
  ] =
    useState<Difficulty>("medio");

  const [message, setMessage] =
    useState("");

  useEffect(() => {
    getTopics(
      activeContestId
    ).then(rows => {
      setTopics(rows);

      const requested =
        search.get("topic");

      setTopicId(
        requested &&
          rows.some(
            r =>
              r.id === requested
          )
          ? requested
          : rows[0]?.id || ""
      );
    });
  }, [
    activeContestId,
    search,
  ]);

  const selected =
    topics.find(
      t =>
        t.id === topicId
    );

  async function save(
    event: FormEvent
  ) {
    event.preventDefault();

    if (
      !user ||
      !selected
    ) {
      return;
    }

    await addStudySession(
      user.uid,
      activeContestId,
      {
        discipline:
          selected.discipline,

        topicId:
          selected.id,

        subtopicId:
          selected.level ===
          "subtopic"
            ? selected.id
            : null,

        studyType,
        durationMinutes,
        questionsDone,
        correctAnswers,
        notes,
        perceivedDifficulty:
          difficulty,
      }
    );

    setMessage(
      `Sessão salva. Como você marcou ${difficulty}, o intervalo de revisão foi recalculado automaticamente.`
    );

    setNotes("");
  }

  return (
    <AppShell>
      <h1>
        Registrar Estudo
      </h1>

      <p className="muted">
        Além do histórico, a sua percepção de dificuldade alimenta o planejador adaptativo.
      </p>

      <form
        className="panel formGrid"
        onSubmit={save}
      >
        <label className="full">
          Conteúdo

          <select
            value={topicId}
            onChange={e =>
              setTopicId(
                e.target.value
              )
            }
          >
            {topics.map(
              topic => (
                <option
                  key={
                    topic.id
                  }
                  value={
                    topic.id
                  }
                >
                  {
                    topic.discipline
                  }{" "}
                  —{" "}
                  {
                    topic.title
                  }
                </option>
              )
            )}
          </select>
        </label>

        <label>
          Tipo

          <select
            value={
              studyType
            }
            onChange={e =>
              setStudyType(
                e.target
                  .value as StudyType
              )
            }
          >
            <option value="pdf">
              PDF
            </option>

            <option value="videoaula">
              Videoaula
            </option>

            <option value="questoes">
              Questões
            </option>

            <option value="lei_seca">
              Lei Seca
            </option>

            <option value="revisao">
              Revisão
            </option>

            <option value="resumo">
              Resumo
            </option>
          </select>
        </label>

        <label>
          Tempo (min)

          <input
            type="number"
            min="0"
            value={
              durationMinutes
            }
            onChange={e =>
              setDurationMinutes(
                Number(
                  e.target.value
                )
              )
            }
          />
        </label>

        <label>
          Questões feitas

          <input
            type="number"
            min="0"
            value={
              questionsDone
            }
            onChange={e =>
              setQuestionsDone(
                Number(
                  e.target.value
                )
              )
            }
          />
        </label>

        <label>
          Acertos

          <input
            type="number"
            min="0"
            value={
              correctAnswers
            }
            onChange={e =>
              setCorrectAnswers(
                Number(
                  e.target.value
                )
              )
            }
          />
        </label>

        <label className="full">
          Como ficou o conteúdo?

          <div className="difficultySelector">
            <button
              type="button"
              className={
                difficulty ===
                "facil"
                  ? "difficulty easy activeDifficulty"
                  : "difficulty easy"
              }
              onClick={() =>
                setDifficulty(
                  "facil"
                )
              }
            >
              Fácil
            </button>

            <button
              type="button"
              className={
                difficulty ===
                "medio"
                  ? "difficulty medium activeDifficulty"
                  : "difficulty medium"
              }
              onClick={() =>
                setDifficulty(
                  "medio"
                )
              }
            >
              Médio
            </button>

            <button
              type="button"
              className={
                difficulty ===
                "dificil"
                  ? "difficulty hard activeDifficulty"
                  : "difficulty hard"
              }
              onClick={() =>
                setDifficulty(
                  "dificil"
                )
              }
            >
              Difícil
            </button>
          </div>
        </label>

        <label className="full">
          Observações

          <textarea
            value={notes}
            onChange={e =>
              setNotes(
                e.target.value
              )
            }
            placeholder="Ex.: confundi anulação e revogação"
          />
        </label>

        <div className="full">
          <button className="actionButton">
            Salvar sessão + programar revisão
          </button>
        </div>

        {message && (
          <div className="full statusBox">
            {message}
          </div>
        )}
      </form>
    </AppShell>
  );
}

export default function RegistrarEstudoPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div className="emptyState">
            Carregando registro de estudo...
          </div>
        </AppShell>
      }
    >
      <RegistrarEstudoContent />
    </Suspense>
  );
}
