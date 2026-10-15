"use client";

import { ChangeEvent, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Papa from "papaparse";
import AppShell from "@/components/AppShell";
import HierarchyIndex, { HierarchyIndexNode } from "@/components/HierarchyIndex";
import { useContest } from "@/contexts/ContestContext";
import { getAllTopics, getQuestions, getTopics, importQuestions } from "@/services/firestore";
import { classifyTopic, disciplineCandidates } from "@/lib/classification";
import { Question, Topic } from "@/types";

type SavedFilter = { id: string; label: string; discipline: string; topicId: string; subject: string; theme: string; type: string; board: string; amount: number };
type PdfDraftQuestion = { number: number; statement: string; alternatives: Record<string,string>; correctAnswer: string; questionType: string; rawText: string; topicId?: string; confidence?: number };

function QuestoesContent() {
  const router = useRouter();
  const search = useSearchParams();
  const { activeContestId } = useContest();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [allTopics, setAllTopics] = useState<Topic[]>([]);
  const [discipline, setDiscipline] = useState(search.get("discipline") || "");
  const [topicId, setTopicId] = useState(search.get("topic") || "");
  const [subject, setSubject] = useState(search.get("subject") || "");
  const [theme, setTheme] = useState(search.get("theme") || "");
  const [type, setType] = useState(search.get("type") || "");
  const [board, setBoard] = useState(search.get("board") || "");
  const [legalRef] = useState(search.get("legalRef") || "");
  const [amount, setAmount] = useState(Number(search.get("amount") || 20));
  const [message, setMessage] = useState("");
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [indexSearch, setIndexSearch] = useState("");
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfMeta, setPdfMeta] = useState<any | null>(null);
  const [pdfDraft, setPdfDraft] = useState<PdfDraftQuestion[]>([]);
  const [pdfDiscipline, setPdfDiscipline] = useState("");
  const [pdfDisciplineConfidence, setPdfDisciplineConfidence] = useState(0);
  const autoStarted = useRef(false);

  async function load() {
    const [qs, ts] = await Promise.all([
      getQuestions(activeContestId),
      getTopics(activeContestId)
    ]);

    setQuestions(qs);
    setTopics(ts);
    setAllTopics(ts);
  }

  useEffect(() => {
    autoStarted.current = false;
    load();

    try {
      setSavedFilters(
        JSON.parse(
          localStorage.getItem(`pf-filters-${activeContestId}`) || "[]"
        )
      );
    } catch {
      setSavedFilters([]);
    }
  }, [activeContestId]);

  const activeDisciplines = new Set(topics.filter(t => t.activeInCurrentEdital !== false).map(t => t.discipline));
  const filtered = useMemo(
    () =>
      questions.filter(
        q =>
          (topics.length === 0 || activeDisciplines.has(q.discipline)) &&
          (!discipline || q.discipline === discipline) &&
          (!topicId ||
            q.topicId === topicId ||
            q.subtopicId === topicId) &&
          (!subject || q.subject === subject) &&
          (!theme || q.subsubject === theme) &&
          (!type || q.questionType === type) &&
          (!board || q.board === board) &&
          (!legalRef ||
            q.legalRefs?.includes(legalRef) ||
            q.lawIds?.includes(legalRef))
      ),
    [
      questions,
      topics,
      discipline,
      topicId,
      subject,
      theme,
      type,
      board,
      legalRef,
    ]
  );

  const disciplines = Array.from(
    new Set(
      questions
        .map(q => q.discipline)
        .filter(Boolean)
    )
  ).sort();

  const activeDisciplines = Array.from(
    new Set(
      topics
        .map(t => t.discipline)
        .filter(Boolean)
    )
  ).sort();

  const boards = Array.from(
    new Set(
      questions
        .map(q => q.board)
        .filter(Boolean)
    )
  ).sort();

  function currentFilter(): SavedFilter {
    return {
      id: `${Date.now()}`,
      label:
        [discipline, subject || topicId, board]
          .filter(Boolean)
          .join(" • ") || "Filtro geral",
      discipline,
      topicId,
      subject,
      theme,
      type,
      board,
      amount,
    };
  }

  function persistFilters(next: SavedFilter[]) {
    setSavedFilters(next);

    localStorage.setItem(
      `pf-filters-${activeContestId}`,
      JSON.stringify(next)
    );
  }

  function saveFilter() {
    const f = currentFilter();

    persistFilters(
      [
        f,
        ...savedFilters.filter(
          x => x.label !== f.label
        ),
      ].slice(0, 5)
    );

    setMessage(
      "Filtro salvo para reutilizar depois."
    );
  }

  function applyFilter(f: SavedFilter) {
    setDiscipline(f.discipline || "");
    setTopicId(f.topicId || "");
    setSubject(f.subject || "");
    setTheme(f.theme || "");
    setType(f.type || "");
    setBoard(f.board || "");
    setAmount(f.amount || 20);
  }

  function startBattery(
    rows = filtered,
    override?: Partial<SavedFilter>
  ) {
    const ids = rows
      .slice(0, amount || rows.length)
      .map(q => q.id);

    if (!ids.length) return;

    sessionStorage.setItem(
      "projeto-fazenda-question-pool",
      JSON.stringify(ids)
    );

    const base = currentFilter();

    localStorage.setItem(
      `pf-last-filter-${activeContestId}`,
      JSON.stringify({
        ...base,
        ...override,
        amount,
      })
    );

    router.push(`/questoes/${ids[0]}`);
  }

  function restoreLast() {
    try {
      const f = JSON.parse(
        localStorage.getItem(
          `pf-last-filter-${activeContestId}`
        ) || "null"
      );

      if (f) {
        applyFilter(f);
      } else {
        setMessage(
          "Ainda não há filtro anterior salvo."
        );
      }
    } catch {}
  }

  useEffect(() => {
    if (
      search.get("start") !== "1" ||
      autoStarted.current ||
      !questions.length ||
      !filtered.length
    ) {
      return;
    }

    autoStarted.current = true;
    startBattery();
  }, [
    questions,
    filtered,
    amount,
    search,
  ]);

  async function onCsv(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,

      complete: async result => {
        const count =
          await importQuestions(
            activeContestId,
            result.data as any[]
          );

        setMessage(
          `${count} questões importadas.`
        );

        await load();
      },
    });
  }

  function classifyPdfRows(
    rows: PdfDraftQuestion[],
    selectedDiscipline: string
  ) {
    const candidates =
      allTopics.filter(
        t =>
          t.discipline ===
          selectedDiscipline
      );

    return rows.map(row => {
      const result = classifyTopic(
        `${row.statement}\n${row.rawText}`,
        selectedDiscipline,
        candidates
      );

      return {
        ...row,
        topicId:
          result.confidence >= 65
            ? result.topicId
            : "",
        confidence:
          result.confidence,
      };
    });
  }

  async function onPdf(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    if (!file) return;

    setMessage(
      "Extraindo questões e identificando a disciplina..."
    );

    const form = new FormData();

    form.append("file", file);

    const res = await fetch(
      "/api/question-import",
      {
        method: "POST",
        body: form,
      }
    );

    const data =
      await res.json();

    if (!res.ok) {
      setMessage(
        data.error ||
          "Falha ao processar PDF."
      );

      return;
    }

    const candidates =
      disciplineCandidates(
        `${file.name}\n${data.textPreview || ""}`,
        allTopics
      );

    const detected =
      candidates[0];

    const selected =
      detected?.discipline ||
      activeDisciplines[0] ||
      "";

    setPdfMeta({
      ...data,
      disciplineCandidates:
        candidates,
    });

    setPdfDiscipline(
      selected
    );

    setPdfDisciplineConfidence(
      detected?.confidence || 0
    );

    setPdfDraft(
      classifyPdfRows(
        data.questions || [],
        selected
      )
    );

    setPdfOpen(true);

    setMessage(
      data.warning ||
        "Confira a classificação antes de salvar."
    );
  }

  function changePdfDiscipline(
    value: string
  ) {
    setPdfDiscipline(value);

    const candidate =
      pdfMeta?.disciplineCandidates?.find(
        (x: any) =>
          x.discipline === value
      );

    setPdfDisciplineConfidence(
      candidate?.confidence || 0
    );

    setPdfDraft(rows =>
      classifyPdfRows(
        rows,
        value
      )
    );
  }

  async function commitPdfQuestions() {
    if (
      !pdfDraft.length ||
      !pdfDiscipline
    ) {
      return;
    }

    const activeHasDiscipline =
      topics.some(
        t =>
          t.discipline ===
          pdfDiscipline
      );

    if (!activeHasDiscipline) {
      setMessage(
        `A disciplina ${pdfDiscipline} não existe no edital ativo. Vincule-a primeiro ao concurso ou escolha uma disciplina do edital para evitar dados soltos.`
      );

      return;
    }

    const topicMap =
      new Map(
        topics.map(
          t => [t.id, t]
        )
      );

    const ready =
      pdfDraft
        .filter(
          q =>
            q.topicId &&
            q.correctAnswer
        )
        .map(
          (q, i) => {
            const topic =
              topicMap.get(
                q.topicId!
              );

            return {
              question_id:
                `PDF_${pdfMeta.fileHash.slice(0,10)}_${q.number || i + 1}`,
              disciplina:
                pdfDiscipline,

              topico_id:
                (
                  topic?.parentTopicId ||
                  topic?.id ||
                  ""
                ).replace(
                  `${activeContestId}__`,
                  ""
                ),

              subtopico_id:
                topic?.parentTopicId
                  ? topic.id.replace(
                      `${activeContestId}__`,
                      ""
                    )
                  : "",

              assunto:
                topic?.title ||
                "",

              subassunto:
                "",

              banca:
                "",

              concurso:
                pdfMeta.fileName ||
                "PDF importado",

              tipo:
                q.questionType ===
                "certo_errado"
                  ? "certo_errado"
                  : "multipla_escolha",

              enunciado:
                q.statement,

              alternativa_a:
                q.alternatives?.A ||
                "",

              alternativa_b:
                q.alternatives?.B ||
                "",

              alternativa_c:
                q.alternatives?.C ||
                "",

              alternativa_d:
                q.alternatives?.D ||
                "",

              alternativa_e:
                q.alternatives?.E ||
                "",

              gabarito:
                q.correctAnswer,

              tags:
                `importado_pdf;confianca_${q.confidence || 0}`,

              fonte:
                pdfMeta.fileName ||
                "PDF",
            };
          }
        );

    if (!ready.length) {
      setMessage(
        "Nenhuma questão possui simultaneamente tema e gabarito confirmados. Revise os itens antes de importar."
      );

      return;
    }

    const count =
      await importQuestions(
        activeContestId,
        ready
      );

    setMessage(
      `${count} questão(ões) importadas. ${pdfDraft.length - count} ficaram de fora por ausência de tema ou gabarito.`
    );

    setPdfDraft([]);
    setPdfMeta(null);
    setPdfOpen(false);

    await load();
  }

  const hierarchy =
    useMemo<
      HierarchyIndexNode[]
    >(
      () => {
        const term =
          indexSearch
            .trim()
            .toLowerCase();

        const countFor =
          (rows: Question[]) =>
            rows.length;

        const roots:
          HierarchyIndexNode[] =
          [];

        for (
          const disc of Array.from(
            new Set(
              questions
                .map(
                  q =>
                    q.discipline
                )
                .filter(
                  Boolean
                )
            )
          ).sort()
        ) {
          const discQs =
            questions.filter(
              q =>
                q.discipline ===
                disc
            );

          const topLevel =
            topics
              .filter(
                t =>
                  t.discipline ===
                    disc &&
                  !t.parentTopicId &&
                  t.activeInCurrentEdital !==
                    false
              )
              .sort(
                (a, b) =>
                  a.order -
                  b.order
              );

          const children:
            HierarchyIndexNode[] =
            [];

          for (
            const topic of topLevel
          ) {
            const subtopics =
              topics
                .filter(
                  t =>
                    t.parentTopicId ===
                      topic.id &&
                    t.activeInCurrentEdital !==
                      false
                )
                .sort(
                  (a, b) =>
                    a.order -
                    b.order
                );

            const topicQs =
              discQs.filter(
                q =>
                  q.topicId ===
                    topic.id ||
                  subtopics.some(
                    s =>
                      s.id ===
                        q.subtopicId ||
                      s.id ===
                        q.topicId
                  )
              );

            const subNodes =
              subtopics.map(
                sub => {
                  const qs =
                    discQs.filter(
                      q =>
                        q.subtopicId ===
                          sub.id ||
                        q.topicId ===
                          sub.id
                    );

                  const themes =
                    Array.from(
                      new Set(
                        qs
                          .map(
                            q =>
                              q.subsubject
                          )
                          .filter(
                            Boolean
                          ) as string[]
                      )
                    )
                      .sort()
                      .map(
                        theme => ({
                          id:
                            `theme:${disc}:${sub.id}:${theme}`,
                          label:
                            theme,
                          count:
                            qs.filter(
                              q =>
                                q.subsubject ===
                                theme
                            ).length,
                          actionLabel:
                            "Resolver",
                        })
                      );

                  return {
                    id:
                      `topic:${sub.id}`,
                    label:
                      sub.title,
                    count:
                      countFor(qs),
                    children:
                      themes,
                    actionLabel:
                      "Resolver",
                  };
                }
              );

            children.push({
              id:
                `topic:${topic.id}`,
              label:
                topic.title,
              count:
                countFor(
                  topicQs
                ),
              children:
                subNodes,
              actionLabel:
                "Resolver",
            });
          }

          const unmatchedSubjects =
            Array.from(
              new Set(
                discQs
                  .filter(
                    q =>
                      !topics.some(
                        t =>
                          t.id ===
                            q.topicId ||
                          t.id ===
                            q.subtopicId
                      )
                  )
                  .map(
                    q =>
                      q.subject
                  )
                  .filter(
                    Boolean
                  )
              )
            ).sort();

          unmatchedSubjects.forEach(
            subjectName =>
              children.push({
                id:
                  `subject:${disc}:${subjectName}`,
                label:
                  subjectName,
                count:
                  discQs.filter(
                    q =>
                      q.subject ===
                      subjectName
                  ).length,
                actionLabel:
                  "Resolver",
              })
          );

          const node:
            HierarchyIndexNode = {
            id:
              `discipline:${disc}`,
            label:
              disc,
            count:
              discQs.length,
            children,
            actionLabel:
              "Resolver",
          };

          const matches =
            !term ||
            disc
              .toLowerCase()
              .includes(term) ||
            children.some(
              c =>
                c.label
                  .toLowerCase()
                  .includes(
                    term
                  ) ||
                c.children?.some(
                  s =>
                    s.label
                      .toLowerCase()
                      .includes(
                        term
                      )
                )
            );

          if (matches) {
            roots.push(node);
          }
        }

        return roots;
      },
      [
        questions,
        topics,
        indexSearch,
      ]
    );

  function rowsForNode(
    node: HierarchyIndexNode
  ) {
    if (
      node.id.startsWith(
        "discipline:"
      )
    ) {
      return questions.filter(
        q =>
          q.discipline ===
          node.label
      );
    }

    if (
      node.id.startsWith(
        "topic:"
      )
    ) {
      const id =
        node.id.slice(6);

      const topic =
        topics.find(
          t =>
            t.id === id
        );

      if (!topic) return [];

      const descendants =
        topics
          .filter(
            t =>
              t.parentTopicId ===
              id
          )
          .map(
            t => t.id
          );

      return questions.filter(
        q =>
          q.topicId === id ||
          q.subtopicId === id ||
          descendants.includes(
            q.topicId
          ) ||
          (
            !!q.subtopicId &&
            descendants.includes(
              q.subtopicId
            )
          )
      );
    }

    if (
      node.id.startsWith(
        "subject:"
      )
    ) {
      return questions.filter(
        q =>
          q.discipline ===
            node.id.split(":")[1] &&
          q.subject ===
            node.label
      );
    }

    if (
      node.id.startsWith(
        "theme:"
      )
    ) {
      return questions.filter(
        q =>
          q.subsubject ===
          node.label
      );
    }

    return [];
  }

  function startFromIndex(
    node: HierarchyIndexNode
  ) {
    const rows =
      rowsForNode(node);

    if (!rows.length) return;

    if (
      node.id.startsWith(
        "discipline:"
      )
    ) {
      return startBattery(
        rows,
        {
          discipline:
            node.label,
          topicId:
            "",
          subject:
            "",
          theme:
            "",
          label:
            node.label,
        }
      );
    }

    if (
      node.id.startsWith(
        "topic:"
      )
    ) {
      const id =
        node.id.slice(6);

      const topic =
        topics.find(
          t =>
            t.id === id
        );

      return startBattery(
        rows,
        {
          discipline:
            topic?.discipline ||
            rows[0]?.discipline ||
            "",

          topicId:
            id,

          subject:
            topic?.title ||
            "",

          theme:
            "",

          label:
            `${topic?.discipline || ""} • ${topic?.title || node.label}`,
        }
      );
    }

    if (
      node.id.startsWith(
        "theme:"
      )
    ) {
      return startBattery(
        rows,
        {
          discipline:
            rows[0]?.discipline ||
            "",

          subject:
            rows[0]?.subject ||
            "",

          theme:
            node.label,

          label:
            `${rows[0]?.discipline || ""} • ${node.label}`,
        }
      );
    }

    startBattery(
      rows,
      {
        discipline:
          rows[0]?.discipline ||
          "",

        subject:
          node.label,

        label:
          `${rows[0]?.discipline || ""} • ${node.label}`,
      }
    );
  }

  return (
    <AppShell>
      <div className="pageHeader">
        <div>
          <h1>Questões</h1>

          <p className="muted">
            Navegue pelo índice e importe preferencialmente CSVs já classificados e validados antes de entrarem na base.
          </p>
        </div>

        <div className="quickActions">
          <button
            className="actionButton secondaryAction"
            onClick={() =>
              setShowFilters(
                !showFilters
              )
            }
          >
            Filtros
          </button>

          <label className="actionButton secondaryAction fileButton">
            PDF experimental

            <input
              hidden
              type="file"
              accept=".pdf"
              onChange={onPdf}
            />
          </label>

          <label className="actionButton fileButton">
            Importar CSV validado

            <input
              hidden
              type="file"
              accept=".csv,text/csv"
              onChange={onCsv}
            />
          </label>
        </div>
      </div>

      {legalRef && (
        <div className="statusBox">
          Filtro legal ativo:{" "}
          <strong>
            {legalRef}
          </strong>
        </div>
      )}

      {showFilters && (
        <section className="panel questionFiltersPanel open">
          <div className="filterUtilities">
            <button
              className="miniButton"
              onClick={restoreLast}
            >
              Usar último filtro
            </button>

            {savedFilters.map(
              f => (
                <button
                  key={f.id}
                  className="filterChip"
                  onClick={() =>
                    applyFilter(f)
                  }
                >
                  {f.label}
                </button>
              )
            )}

            <button
              className="textButton"
              onClick={saveFilter}
            >
              + Salvar filtro atual
            </button>
          </div>

          <div className="filterGridQuestions">
            <label>
              Disciplina

              <select
                value={discipline}
                onChange={e =>
                  setDiscipline(
                    e.target.value
                  )
                }
              >
                <option value="">
                  Todas
                </option>

                {disciplines.map(
                  x => (
                    <option key={x}>
                      {x}
                    </option>
                  )
                )}
              </select>
            </label>

            <label>
              Tipo

              <select
                value={type}
                onChange={e =>
                  setType(
                    e.target.value
                  )
                }
              >
                <option value="">
                  Todos
                </option>

                <option value="certo_errado">
                  Certo / Errado
                </option>

                <option value="multipla_escolha">
                  Múltipla escolha
                </option>
              </select>
            </label>

            <label>
              Banca

              <select
                value={board}
                onChange={e =>
                  setBoard(
                    e.target.value
                  )
                }
              >
                <option value="">
                  Todas
                </option>

                {boards.map(
                  x => (
                    <option key={x}>
                      {x}
                    </option>
                  )
                )}
              </select>
            </label>

            <label>
              Quantidade

              <select
                value={amount}
                onChange={e =>
                  setAmount(
                    Number(
                      e.target.value
                    )
                  )
                }
              >
                <option value={10}>
                  10
                </option>

                <option value={20}>
                  20
                </option>

                <option value={30}>
                  30
                </option>

                <option value={9999}>
                  Todas
                </option>
              </select>
            </label>

            <div className="filterSummary">
              <strong>
                {filtered.length}
              </strong>

              <span>
                encontradas
              </span>
            </div>

            <button
              className="actionButton"
              onClick={() =>
                startBattery(
                  filtered
                )
              }
              disabled={
                !filtered.length
              }
            >
              Iniciar bateria
            </button>
          </div>
        </section>
      )}

      {pdfOpen &&
        pdfMeta && (
          <section className="panel importWorkspace">
            <div className="panelHeader">
              <div>
                <h2>
                  Conferir PDF de questões
                </h2>

                <p className="muted">
                  Primeiro confirme a disciplina. Só depois o sistema classifica tópicos dentro dela.
                </p>
              </div>

              <button
                className="textButton"
                onClick={() =>
                  setPdfOpen(false)
                }
              >
                Fechar
              </button>
            </div>

            <div className="classificationHeader">
              <label>
                Disciplina detectada

                <select
                  value={
                    pdfDiscipline
                  }
                  onChange={e =>
                    changePdfDiscipline(
                      e.target.value
                    )
                  }
                >
                  <option value="">
                    Selecione
                  </option>

                  {Array.from(
                    new Set(
                      [
                        ...activeDisciplines,
                        ...(
                          pdfMeta.disciplineCandidates ||
                          []
                        ).map(
                          (x: any) =>
                            x.discipline
                        ),
                      ]
                    )
                  )
                    .sort()
                    .map(
                      d => (
                        <option key={d}>
                          {d}
                        </option>
                      )
                    )}
                </select>
              </label>

              <div
                className={`confidenceBadge ${
                  pdfDisciplineConfidence >=
                  90
                    ? "high"
                    : pdfDisciplineConfidence >=
                        65
                      ? "medium"
                      : "low"
                }`}
              >
                Confiança da disciplina:{" "}
                {
                  pdfDisciplineConfidence
                }
                %
              </div>

              {pdfDiscipline &&
                !activeDisciplines.includes(
                  pdfDiscipline
                ) && (
                  <div className="warningBox">
                    Esta disciplina não existe no edital ativo. O PDF pode ser reconhecido, mas as questões não serão gravadas até haver vínculo com o concurso.
                  </div>
                )}
            </div>

            <div className="importSummary">
              <strong>
                {pdfDraft.length}
              </strong>

              <span>
                questões detectadas
              </span>

              <strong>
                {
                  pdfDraft.filter(
                    q =>
                      q.topicId
                  ).length
                }
              </strong>

              <span>
                com tema sugerido
              </span>

              <strong>
                {
                  pdfDraft.filter(
                    q =>
                      q.correctAnswer
                  ).length
                }
              </strong>

              <span>
                com gabarito detectado
              </span>
            </div>

            <div className="materialBlockPreview">
              {pdfDraft
                .slice(
                  0,
                  160
                )
                .map(
                  (
                    row,
                    i
                  ) => (
                    <div
                      className="materialBlockRow"
                      key={i}
                    >
                      <div>
                        <strong>
                          Questão{" "}
                          {row.number ||
                            i +
                              1}
                        </strong>

                        <p>
                          {row.statement.slice(
                            0,
                            220
                          )}

                          {row.statement
                            .length >
                          220
                            ? "…"
                            : ""}
                        </p>

                        <small>
                          Gabarito:{" "}
                          {row.correctAnswer ||
                            "não detectado"}{" "}
                          • confiança temática:{" "}
                          {row.confidence ||
                            0}
                          %
                        </small>
                      </div>

                      <div className="classificationControls">
                        <select
                          value={
                            row.topicId ||
                            ""
                          }
                          onChange={e =>
                            setPdfDraft(
                              rows =>
                                rows.map(
                                  (
                                    r,
                                    idx
                                  ) =>
                                    idx ===
                                    i
                                      ? {
                                          ...r,
                                          topicId:
                                            e
                                              .target
                                              .value,
                                          confidence:
                                            100,
                                        }
                                      : r
                                )
                            )
                          }
                        >
                          <option value="">
                            Não classificada
                          </option>

                          {topics
                            .filter(
                              t =>
                                t.discipline ===
                                  pdfDiscipline &&
                                t.activeInCurrentEdital !==
                                  false
                            )
                            .map(
                              t => (
                                <option
                                  key={
                                    t.id
                                  }
                                  value={
                                    t.id
                                  }
                                >
                                  {
                                    t.title
                                  }
                                </option>
                              )
                            )}
                        </select>

                        {!row.correctAnswer && (
                          <input
                            placeholder="Gabarito"
                            maxLength={
                              5
                            }
                            onChange={e =>
                              setPdfDraft(
                                rows =>
                                  rows.map(
                                    (
                                      r,
                                      idx
                                    ) =>
                                      idx ===
                                      i
                                        ? {
                                            ...r,
                                            correctAnswer:
                                              e.target.value.toUpperCase(),
                                          }
                                        : r
                                  )
                              )
                            }
                          />
                        )}
                      </div>
                    </div>
                  )
                )}
            </div>

            <button
              className="actionButton"
              onClick={
                commitPdfQuestions
              }
            >
              Salvar questões conferidas
            </button>
          </section>
        )}

      {message && (
        <div className="statusBox">
          {message}
        </div>
      )}

      <section className="panel indexSearchBar">
        <input
          value={indexSearch}
          onChange={e =>
            setIndexSearch(
              e.target.value
            )
          }
          placeholder="Buscar disciplina, tópico ou tema..."
        />

        <span className="muted">
          {questions.length} questões na base
        </span>
      </section>

      <HierarchyIndex
        nodes={hierarchy}
        actionLabel="Resolver"
        onAction={
          startFromIndex
        }
        emptyLabel="Nenhuma questão encontrada neste índice."
      />
    </AppShell>
  );
}

export default function QuestoesPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div className="emptyState">
            Carregando questões...
          </div>
        </AppShell>
      }
    >
      <QuestoesContent />
    </Suspense>
  );
}
