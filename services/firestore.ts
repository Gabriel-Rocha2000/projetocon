import {
  addDoc,
  collection,
  doc,
  deleteDoc,
  getDoc,
  getDocs,
  increment,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Contest,
  ContestVersion,
  EditalItem,
  ContentNode,
  ContentBlock,
  Material,
  AnswerConfidence,
  DailyPlan,
  DailyPlanTask,
  DashboardData,
  Difficulty,
  DisciplineStat,
  ErrorType,
  LawDocument,
  LawItem,
  LawStatus,
  Question,
  StudySettings,
  StudyType,
  Topic,
  RiskItem,
  ResumeItem,
} from "@/types";

// Cache curto de leituras: evita consultas idênticas repetidas entre telas.
// Mantém chamadas em andamento compartilhadas e NÃO armazena erros.
type CacheEntry = { expiresAt: number; promise: Promise<unknown> };
const READ_CACHE_MS = 300_000;
const readCache = new Map<string, CacheEntry>();

function cachedRead<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const current = readCache.get(key);
  if (current && current.expiresAt > Date.now()) {
    return current.promise as Promise<T>;
  }

  const promise: Promise<T> = loader().catch(error => {
    if (readCache.get(key)?.promise === promise) readCache.delete(key);
    throw error;
  });
  readCache.set(key, { expiresAt: Date.now() + READ_CACHE_MS, promise });
  return promise;
}

function clearReadCache(...prefixes: string[]) {
  for (const key of readCache.keys()) {
    if (prefixes.some(prefix => key.startsWith(prefix))) readCache.delete(key);
  }
}

export const DEFAULT_CONTEST = "ATA_MF_2026";
export const DEFAULT_SETTINGS: StudySettings = {
  morningMinutes: 30,
  lunchMinutes: 20,
  eveningMinutes: 90,
  defaultQuestionTarget: 15,
  mode: "normal",
};

function removeUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(item => removeUndefined(item)) as T;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, removeUndefined(v)]);

    return Object.fromEntries(entries) as T;
  }

  return value;
}

function scopedId(contestId: string, rawId: string) {
  if (!rawId) return rawId;
  if (rawId.startsWith(`${contestId}__`)) return rawId;

  return contestId === DEFAULT_CONTEST
    ? rawId
    : `${contestId}__${rawId}`;
}

function dateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function asMillis(value: any) {
  if (!value) return 0;

  if (typeof value?.toMillis === "function") {
    return value.toMillis();
  }

  const parsed = new Date(value).getTime();

  return Number.isFinite(parsed) ? parsed : 0;
}

function progressSummary(rows: any[]) {
  const answered = rows.reduce(
    (sum, row) => sum + Number(row.timesAnswered || 0),
    0
  );

  const rawCorrect = rows.reduce(
    (sum, row) => sum + Number(row.timesCorrect || 0),
    0
  );

  const uncertain = rows.reduce(
    (sum, row) => sum + Number(row.timesUncertainCorrect || 0),
    0
  );

  const effectiveCorrect = Math.max(
    0,
    rawCorrect - uncertain * 0.5
  );

  const accuracy = answered
    ? Math.round((effectiveCorrect / answered) * 100)
    : 0;

  const evidence = Math.min(
    100,
    Math.round((answered / 30) * 100)
  );

  return {
    answered,
    rawCorrect,
    uncertain,
    effectiveCorrect,
    accuracy,
    evidence,
  };
}

function topicMastery(
  progressRows: any[],
  topicId: string | string[]
) {
  const ids = new Set(
    Array.isArray(topicId) ? topicId : [topicId]
  );

  const rows = progressRows.filter(
    row => ids.has(row.topicId) || ids.has(row.subtopicId)
  );

  const summary = progressSummary(rows);

  return summary.answered ? summary.accuracy : null;
}

export async function ensureUser(
  uid: string,
  email: string | null
) {
  await setDoc(
    doc(db, "users", uid),
    {
      email,
      projetoPrincipal: "Projeto Fazenda",
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function getActiveContestId(uid: string) {
  const snap = await getDoc(doc(db, "users", uid));

  return snap.exists()
    ? String(snap.data().activeContestId || DEFAULT_CONTEST)
    : DEFAULT_CONTEST;
}

export async function setActiveContestId(
  uid: string,
  contestId: string
) {
  await setDoc(
    doc(db, "users", uid),
    {
      activeContestId: contestId,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function getStudySettings(
  uid: string
): Promise<StudySettings> {
  const snap = await getDoc(doc(db, "users", uid));

  const current = snap.exists()
    ? snap.data().studySettings
    : null;

  return {
    ...DEFAULT_SETTINGS,
    ...(current || {}),
  };
}

export async function saveStudySettings(
  uid: string,
  settings: StudySettings
) {
  await setDoc(
    doc(db, "users", uid),
    {
      studySettings: settings,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function getContests(): Promise<Contest[]> {
  return cachedRead<Contest[]>("contests:all", async () => {
    const snap = await getDocs(collection(db, "contests"));
    return snap.docs
    .map(
      d =>
        ({
          id: d.id,
          ...d.data(),
        } as Contest)
    )
    .sort(
      (a, b) =>
        (a.priority === "alta"
          ? -1
          : a.priority === "baixa"
            ? 1
            : 0) -
        (b.priority === "alta"
          ? -1
          : b.priority === "baixa"
            ? 1
            : 0)
    );
  });
}

export async function addContest(contest: Contest) {
  await setDoc(
    doc(db, "contests", contest.id),
    {
      ...contest,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  clearReadCache("contests:");
}

export async function seedBaseContent(
  contestId = DEFAULT_CONTEST
) {
  const contest: Contest = {
    id: contestId,
    name: "ATA",
    organ: "Ministério da Fazenda",
    role: "Assistente Técnico-Administrativo",
    board: "A definir",
    year: 2026,
    examDate: null,
    status: "ativo",
    priority: "alta",
  };

  await addContest(contest);

  const topics: Topic[] = [
    {
      id: scopedId(contestId, "DA-002"),
      contestId,
      discipline: "Direito Administrativo",
      canonicalContentId: "ADM.ATOS",
      title: "Atos administrativos",
      originalText:
        "Atos administrativos: conceito, requisitos, atributos, classificação, espécies e extinção.",
      level: "topic",
      tags: ["atos administrativos"],
      order: 2,
    },
    {
      id: scopedId(contestId, "DA-002.05"),
      contestId,
      discipline: "Direito Administrativo",
      parentTopicId: scopedId(contestId, "DA-002"),
      canonicalContentId: "ADM.ATOS.EXTINCAO",
      title: "Extinção dos atos administrativos",
      originalText:
        "Anulação, revogação, cassação e demais formas de extinção.",
      level: "subtopic",
      tags: ["anulação", "revogação", "cassação"],
      order: 5,
    },
    {
      id: scopedId(contestId, "DC-004"),
      contestId,
      discipline: "Direito Constitucional",
      canonicalContentId: "CONST.DIREITOS_FUNDAMENTAIS",
      title: "Direitos e garantias fundamentais",
      originalText: "Direitos e garantias fundamentais.",
      level: "topic",
      tags: ["direitos fundamentais"],
      order: 4,
    },
    {
      id: scopedId(contestId, "PORT-001"),
      contestId,
      discipline: "Português",
      canonicalContentId: "PORT.INTERPRETACAO",
      title: "Compreensão e interpretação de textos",
      originalText:
        "Compreensão e interpretação de textos de gêneros variados.",
      level: "topic",
      tags: ["interpretação", "texto"],
      order: 1,
    },
  ];

  for (const topic of topics) {
    await setDoc(doc(db, "topics", topic.id), topic, {
      merge: true,
    });
  }

  const lawDocumentId = `${contestId}__LAW__LEI9784`;

  await saveLawDocument({
    id: lawDocumentId,
    contestId,
    lawName: "Lei 9.784/99",
    lawNumber: "9.784",
    lawDate: "29 de janeiro de 1999",
    title:
      "Processo administrativo no âmbito da Administração Pública Federal",
    sourceName: "Base de teste",
    sourceUrl: null,
    itemCount: 1,
  });

  const law: LawItem = {
    id: scopedId(contestId, "LEI9784_ART53"),
    contestId,
    lawDocumentId,
    parentLawId: scopedId(contestId, "LEI9784"),
    lawName: "Lei 9.784/99",
    reference: "Art. 53",
    level: "artigo",
    status: "vigente",
    article: "53",
    order: 53,
    text:
      "A Administração deve anular seus próprios atos, quando eivados de vício de legalidade, e pode revogá-los por motivo de conveniência ou oportunidade, respeitados os direitos adquiridos.",
    topicId: scopedId(contestId, "DA-002"),
    subtopicId: scopedId(contestId, "DA-002.05"),
    tags: ["anulação", "revogação", "autotutela"],
  };

  await setDoc(doc(db, "laws", law.id), law, {
    merge: true,
  });
  clearReadCache("topics:", "contests:");
}

export async function getTopics(contestId: string) {
  return cachedRead<Topic[]>(`topics:contest:${contestId}`, async () => {
  const snap = await getDocs(
    query(
      collection(db, "topics"),
      where("contestId", "==", contestId)
    )
  );

  return snap.docs
    .map(
      d =>
        ({
          id: d.id,
          ...d.data(),
        } as Topic)
    )
    .sort((a, b) => a.order - b.order);
  });
}

export async function getAllTopics() {
  return cachedRead<Topic[]>("topics:all", async () => {
  const snap = await getDocs(collection(db, "topics"));

  return snap.docs
    .map(
      d =>
        ({
          id: d.id,
          ...d.data(),
        } as Topic)
    )
    .sort((a, b) => {
      const discipline = a.discipline.localeCompare(
        b.discipline,
        "pt-BR"
      );

      return discipline || a.order - b.order;
    });
  });
}

export async function getTopic(id: string) {
  const snap = await getDoc(doc(db, "topics", id));

  return snap.exists()
    ? ({
        id: snap.id,
        ...snap.data(),
      } as Topic)
    : null;
}

function contentNodeId(topic: Topic) {
  return topic.canonicalContentId || topic.id;
}

export async function getContentNode(
  topic: Topic
): Promise<ContentNode | null> {
  const id = contentNodeId(topic);

  const snap = await getDoc(
    doc(db, "content_nodes", id)
  );

  return snap.exists()
    ? ({
        id: snap.id,
        ...snap.data(),
      } as ContentNode)
    : null;
}

export async function saveContentNode(
  topic: Topic,
  text: string,
  sourceLabel?: string,
  sourcePage?: string
) {
  const id = contentNodeId(topic);

  const payload: ContentNode = {
    id,
    canonicalContentId: topic.canonicalContentId || null,
    discipline: topic.discipline,
    title: topic.title,
    text,
    sourceLabel: sourceLabel || null,
    sourcePage: sourcePage || null,
    updatedAt: serverTimestamp(),
  };

  await setDoc(
    doc(db, "content_nodes", id),
    removeUndefined(payload),
    { merge: true }
  );
}

export async function addTopic(topic: Topic) {
  await setDoc(
    doc(db, "topics", topic.id),
    {
      ...topic,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  clearReadCache("topics:");
}

export async function importEditalRows(contestId: string, rows: any[]) {
  if (!contestId || !Array.isArray(rows)) throw new Error("Concurso ativo e CSV são obrigatórios.");
  if (!rows.length) return 0;
  const normalized = rows.map((row, index) => {
    const localId = String(row.id || row.topico_id || "").trim();
    const discipline = String(row.disciplina || row.discipline || "").trim();
    const title = String(row.titulo || row.assunto || row.title || "").trim();
    const parentRaw = String(row.parent_id || row.topico_pai || "").trim();
    if (!localId || !discipline || !title) {
      throw new Error(`Linha ${index + 2}: ID, disciplina e título são obrigatórios.`);
    }
    return { row, localId, discipline, title, parentRaw, index };
  });
  const localIds = new Set<string>();
  for (const item of normalized) {
    if (localIds.has(item.localId)) {
      throw new Error(`ID duplicado no CSV: ${item.localId}. Corrija antes de importar.`);
    }
    localIds.add(item.localId);
    if (item.parentRaw === item.localId) {
      throw new Error(`O item ${item.localId} não pode ser seu próprio pai.`);
    }
  }
  // Evita gravar parte do arquivo com referências órfãs. Pais existentes são aceitos.
  const current = await getTopics(contestId);
  const existing = new Set(current.map(topic => topic.id));
  for (const item of normalized) {
    if (item.parentRaw && !localIds.has(item.parentRaw) && !existing.has(scopedId(contestId, item.parentRaw))) {
      throw new Error(`Linha ${item.index + 2}: parent_id ${item.parentRaw} inexistente neste edital e neste CSV.`);
    }
  }
  for (let offset = 0; offset < normalized.length; offset += 350) {
    const batch = writeBatch(db);
    for (const item of normalized.slice(offset, offset + 350)) {
      const {row, localId, discipline, title, parentRaw, index} = item;
      const id = scopedId(contestId, localId);
      const topic: Topic = {
        id, contestId, discipline,
        parentTopicId: parentRaw ? scopedId(contestId, parentRaw) : null,
        canonicalContentId: String(row.conteudo_id || row.content_id || row.canonical_content_id || "").trim() || null,
        title,
        originalText: String(row.texto_original || row.original_text || title).trim(),
        level: String(row.nivel || row.level || "topic").toLowerCase().includes("sub") ? "subtopic" : "topic",
        tags: String(row.tags || "").split(";").map((tag: string) => tag.trim()).filter(Boolean),
        order: Number(row.ordem || row.order || index + 1),
        activeInCurrentEdital: true,
      };
      batch.set(doc(db, "topics", id), topic, { merge: true });
    }
    await batch.commit();
  }
  clearReadCache("topics:");
  return normalized.length;
}

export async function addStudySession(
  uid: string,
  contestId: string,
  input: {
    discipline: string;
    topicId: string;
    subtopicId?: string | null;
    studyType: StudyType;
    durationMinutes: number;
    questionsDone: number;
    correctAnswers: number;
    notes?: string;
    perceivedDifficulty?: Difficulty | null;
  }
) {
  const ref = await addDoc(
    collection(db, "users", uid, "study_sessions"),
    {
      contestId,
      ...input,
      createdAt: serverTimestamp(),
    }
  );

  if (input.perceivedDifficulty) {
    await scheduleAdaptiveReview(uid, contestId, {
      topicId: input.subtopicId || input.topicId,
      discipline: input.discipline,
      difficulty: input.perceivedDifficulty,
      sourceType: "topic",
      sourceId: input.subtopicId || input.topicId,
      reasonPrefix: "sessao_estudo",
      objectiveAccuracy:
        input.questionsDone > 0
          ? Math.round(
              (input.correctAnswers / input.questionsDone) *
                100
            )
          : null,
    });
  }

  return ref;
}

export async function importQuestions(
  contestId: string,
  rows: any[]
) {
  let count = 0;

  for (
    let offset = 0;
    offset < rows.length;
    offset += 400
  ) {
    const batch = writeBatch(db);

    for (
      const row of rows.slice(offset, offset + 400)
    ) {
      const rawId = String(
        row.question_id ||
          row.id ||
          `Q_${Date.now()}_${count}`
      ).trim();

      const id = scopedId(contestId, rawId);

      const alternatives: Record<string, string> = {};

      ["A", "B", "C", "D", "E"].forEach(letter => {
        const value =
          row[`alternativa_${letter.toLowerCase()}`];

        if (value) {
          alternatives[letter] = String(value);
        }
      });

      const topicRaw = String(
        row.topico_id || ""
      ).trim();

      const subRaw = String(
        row.subtopico_id || ""
      ).trim();

      const question: Question = {
        id,
        contestId,
        discipline: String(
          row.disciplina || ""
        ).trim(),
        topicId: scopedId(contestId, topicRaw),
        subtopicId: subRaw
          ? scopedId(contestId, subRaw)
          : null,
        contentBlockId: (() => {
          const raw = String(row.content_block_id || row.bloco_conteudo_id || "").trim();
          return raw ? scopedId(contestId, raw) : null;
        })(),
        subject: String(
          row.assunto || ""
        ).trim(),
        subsubject:
          String(
            row.subassunto || ""
          ).trim() || null,
        board: String(row.banca || "").trim(),
        organ: String(row.orgao || "").trim(),
        examName: String(
          row.concurso || ""
        ).trim(),
        ...(row.ano
          ? { year: Number(row.ano) }
          : {}),
        questionType: String(
          row.tipo || ""
        )
          .toLowerCase()
          .includes("certo")
          ? "certo_errado"
          : "multipla_escolha",
        statement: String(
          row.enunciado || ""
        ).trim(),
        ...(Object.keys(alternatives).length
          ? { alternatives }
          : {}),
        correctAnswer: String(
          row.gabarito || ""
        )
          .trim()
          .toUpperCase(),
        difficulty: String(
          row.dificuldade || "media"
        ).toLowerCase() as
          | "facil"
          | "media"
          | "dificil",
        tags: String(row.tags || "")
          .split(";")
          .map((x: string) => x.trim())
          .filter(Boolean),
        sourceName: String(
          row.fonte || ""
        ).trim(),
        sourcePage: row.pagina
          ? parseInt(String(row.pagina), 10) || null
          : null,
        materialId:
          String(
            row.material_id || ""
          ).trim() || null,
        lawIds: String(
          row.law_ids || ""
        )
          .split(";")
          .map((x: string) => x.trim())
          .filter(Boolean),
        legalRefs: String(
          row.legal_refs ||
            row.referencias_legais ||
            ""
        )
          .split(";")
          .map((x: string) => x.trim())
          .filter(Boolean),
        relatedContent:
          String(
            row.conteudo_relacionado || ""
          ).trim() || null,
        explanation:
          String(
            row.comentario || ""
          ).trim() || null,
      };

      batch.set(
        doc(db, "questions", id),
        removeUndefined(question),
        { merge: true }
      );

      count++;
    }

    await batch.commit();
  }

  clearReadCache("questions:");
  return count;
}
export async function getQuestions(contestId: string) {
  return cachedRead<Question[]>(`questions:${contestId}`, async () => {
  const snap = await getDocs(
    query(
      collection(db, "questions"),
      where("contestId", "==", contestId)
    )
  );

  return snap.docs.map(
    d =>
      ({
        id: d.id,
        ...d.data(),
      } as Question)
  );
  });
}

export async function getQuestion(id: string) {
  const snap = await getDoc(
    doc(db, "questions", id)
  );

  return snap.exists()
    ? ({
        id: snap.id,
        ...snap.data(),
      } as Question)
    : null;
}

export async function answerQuestion(
  uid: string,
  question: Question,
  answer: string,
  confidence: AnswerConfidence = "sabia"
) {
  const correct =
    answer.toUpperCase() ===
    question.correctAnswer.toUpperCase();

  const progressId = question.id;

  const ref = doc(
    db,
    "users",
    uid,
    "question_progress",
    progressId
  );

  const current = await getDoc(ref);

  const currentData = current.exists()
    ? current.data()
    : null;

  const previousStreak = Number(
    currentData?.correctStreak || 0
  );

  const correctStreak = correct
    ? previousStreak + 1
    : 0;

  const uncertainCorrect =
    correct && confidence !== "sabia";

  const base = {
    questionId: question.id,
    contestId: question.contestId,
    discipline: question.discipline,
    topicId: question.topicId,
    subtopicId: question.subtopicId || null,
    contentBlockId: question.contentBlockId || null,
    lastAnswer: answer,
    lastConfidence: confidence,
    wasCorrectLastTime: correct,
    correctStreak,
    lastAnsweredAt: serverTimestamp(),
    reviewStatus:
      correct && confidence === "sabia"
        ? "ok"
        : "pendente",
  };

  if (!current.exists()) {
    await setDoc(ref, {
      ...base,
      timesAnswered: 1,
      timesCorrect: correct ? 1 : 0,
      timesWrong: correct ? 0 : 1,
      timesUncertainCorrect: uncertainCorrect ? 1 : 0,
    });
  } else {
    await updateDoc(ref, {
      ...base,
      timesAnswered: increment(1),
      timesCorrect: increment(correct ? 1 : 0),
      timesWrong: increment(correct ? 0 : 1),
      timesUncertainCorrect: increment(
        uncertainCorrect ? 1 : 0
      ),
    });
  }

  const errorRef = doc(
    db,
    "users",
    uid,
    "error_notebook",
    question.id
  );

  const errorSnap = await getDoc(errorRef);

  if (errorSnap.exists()) {
    const previousErrorStreak = Number(
      errorSnap.data().correctStreak || 0
    );

    const errorStreak = correct
      ? previousErrorStreak + 1
      : 0;

    await updateDoc(errorRef, {
      correctStreak: errorStreak,
      status:
        errorStreak >= 3
          ? "consolidado"
          : "ativo",
      lastAttemptCorrect: correct,
      lastAttemptConfidence: confidence,
      lastAttemptAt: serverTimestamp(),
      ...(errorStreak >= 3
        ? {
            consolidatedAt: serverTimestamp(),
          }
        : {}),
    });
  }

  clearReadCache(`user:questionprogress:${uid}:`);
  return {
    correct,
    correctStreak,
    confidence,
    uncertainCorrect,
  };
}

export async function getQuestionStudyStats(
  uid: string,
  contestId: string,
  question: Question
) {
  const [progressSnap, errors] = await Promise.all([
    cachedRead(`user:questionprogress:${uid}:${contestId}`, () => getDocs(
      query(
        collection(db, "users", uid, "question_progress"),
        where("contestId", "==", contestId)
      )
    )),
    getErrors(uid, contestId),
  ]);

  const rows = progressSnap.docs
    .map(
      d =>
        ({
          id: d.id,
          ...d.data(),
        } as any)
    )
    .filter(
      row => row.contestId === contestId
    );

  const sameDiscipline = rows.filter(
    row => row.discipline === question.discipline
  );

  const sameTopic = rows.filter(
    row =>
      row.topicId === question.topicId ||
      (!!question.subtopicId &&
        row.subtopicId === question.subtopicId) ||
      (!!question.subtopicId &&
        row.topicId === question.subtopicId)
  );

  const current =
    rows.find(
      row =>
        row.questionId === question.id ||
        row.id === question.id
    ) || null;

  function summarize(list: any[]) {
    const base = progressSummary(list);

    return {
      answered: base.answered,
      correct: base.rawCorrect,
      wrong: Math.max(
        0,
        base.answered - base.rawCorrect
      ),
      accuracy: base.accuracy,
      evidence: base.evidence,
      uncertainCorrect: base.uncertain,
    };
  }

  const relatedErrors = errors.filter(
    (row: any) =>
      row.questionId === question.id ||
      row.topicId === question.topicId ||
      (!!question.subtopicId &&
        row.subtopicId === question.subtopicId)
  );

  const activeRelated = relatedErrors.filter(
    (row: any) => row.status !== "consolidado"
  );

  return {
    question: summarize(current ? [current] : []),
    topic: summarize(sameTopic),
    discipline: summarize(sameDiscipline),
    relatedErrors,
    activeErrors: activeRelated.length,
    recurringErrors: activeRelated.filter(
      (row: any) =>
        Number(row.recurrence || 1) >= 2
    ).length,
  };
}

export async function addError(
  uid: string,
  question: Question,
  errorType: ErrorType,
  comment: string
) {
  const errorId = question.id;

  const ref = doc(
    db,
    "users",
    uid,
    "error_notebook",
    errorId
  );

  const current = await getDoc(ref);

  const previousRecurrence = current.exists()
    ? Number(current.data().recurrence || 0)
    : 0;

  const recurrence = previousRecurrence + 1;

  const priority =
    recurrence >= 3
      ? "alta"
      : recurrence >= 2
        ? "media"
        : "baixa";

  if (!current.exists()) {
    await setDoc(ref, {
      questionId: question.id,
      contestId: question.contestId,
      discipline: question.discipline,
      topicId: question.topicId,
      subtopicId: question.subtopicId || null,
      subject: question.subject || null,
      errorType,
      comment,
      recurrence,
      correctStreak: 0,
      status: "ativo",
      priority,
      createdAt: serverTimestamp(),
      lastOccurrenceAt: serverTimestamp(),
    });
  } else {
    await updateDoc(ref, {
      errorType,
      comment,
      subject: question.subject || null,
      recurrence: increment(1),
      correctStreak: 0,
      priority,
      status: "ativo",
      lastOccurrenceAt: serverTimestamp(),
    });
  }

  await scheduleAdaptiveReview(
    uid,
    question.contestId,
    {
      topicId:
        question.subtopicId ||
        question.topicId,
      discipline: question.discipline,
      difficulty:
        recurrence >= 2
          ? "dificil"
          : "medio",
      sourceType: "question",
      sourceId: question.id,
      reasonPrefix:
        recurrence >= 2
          ? "erro_recorrente"
          : "questao_errada",
      objectiveAccuracy: 0,
    }
  );
}

export async function getErrors(
  uid: string,
  contestId: string
): Promise<any[]> {
  const snap = await getDocs(
    query(
      collection(db, "users", uid, "error_notebook"),
      where("contestId", "==", contestId)
    )
  );

  return snap.docs
    .map(
      d =>
        ({
          id: d.id,
          ...d.data(),
        } as any)
    )
    .filter(
      (row: any) =>
        row.contestId === contestId
    );
}

export async function consolidateError(
  uid: string,
  id: string
) {
  await updateDoc(
    doc(
      db,
      "users",
      uid,
      "error_notebook",
      id
    ),
    {
      status: "consolidado",
      lastReviewedAt: serverTimestamp(),
    }
  );
}

export async function getLawDocuments(
  contestId: string
) {
  const snap = await getDocs(
    query(
      collection(db, "law_documents"),
      where("contestId", "==", contestId)
    )
  );

  return snap.docs
    .map(
      d =>
        ({
          id: d.id,
          ...d.data(),
        } as LawDocument)
    )
    .sort((a, b) =>
      a.lawName.localeCompare(b.lawName)
    );
}

export async function saveLawDocument(
  document: LawDocument
) {
  await setDoc(
    doc(db, "law_documents", document.id),
    removeUndefined({
      ...document,
      importedAt:
        document.importedAt ||
        serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
    { merge: true }
  );
}

export async function importLawDocument(
  contestId: string,
  lawDocument: LawDocument,
  items: LawItem[]
) {
  await saveLawDocument({
    ...lawDocument,
    contestId,
    itemCount: items.length,
  });

  let count = 0;

  for (
    let offset = 0;
    offset < items.length;
    offset += 400
  ) {
    const batch = writeBatch(db);

    for (
      const item of items.slice(
        offset,
        offset + 400
      )
    ) {
      const payload = removeUndefined({
        ...item,
        contestId,
        lawDocumentId: lawDocument.id,
        lawName: lawDocument.lawName,
        sourceUrl:
          item.sourceUrl ||
          lawDocument.sourceUrl ||
          null,
      });

      batch.set(
        doc(db, "laws", item.id),
        payload,
        { merge: true }
      );

      count++;
    }

    await batch.commit();
  }

  return count;
}

export async function addLawItem(item: LawItem) {
  await setDoc(
    doc(db, "laws", item.id),
    removeUndefined({
      ...item,
      updatedAt: serverTimestamp(),
    }),
    { merge: true }
  );
}

export async function updateLawItem(
  id: string,
  patch: Partial<LawItem>
) {
  await updateDoc(
    doc(db, "laws", id),
    removeUndefined({
      ...patch,
      updatedAt: serverTimestamp(),
    }) as any
  );
}

export async function deleteLawItem(id: string) {
  await deleteDoc(doc(db, "laws", id));
}

export async function deleteLawDocument(
  contestId: string,
  lawDocumentId: string
) {
  const all = await getLawItems(contestId);

  const related = all.filter(
    item => item.lawDocumentId === lawDocumentId
  );

  for (
    let offset = 0;
    offset < related.length;
    offset += 400
  ) {
    const batch = writeBatch(db);

    related
      .slice(offset, offset + 400)
      .forEach(item =>
        batch.delete(doc(db, "laws", item.id))
      );

    await batch.commit();
  }

  await deleteDoc(
    doc(db, "law_documents", lawDocumentId)
  );
}

export async function getLawItems(
  contestId: string
) {
  const snap = await getDocs(
    query(
      collection(db, "laws"),
      where("contestId", "==", contestId)
    )
  );

  return snap.docs
    .map(
      d =>
        ({
          id: d.id,
          ...d.data(),
        } as LawItem)
    )
    .sort(
      (a, b) =>
        Number(a.order || 0) -
        Number(b.order || 0)
    );
}

export async function saveLawProgress(
  uid: string,
  item: LawItem,
  result: "errei" | "quase" | "acertei"
) {
  const ref = doc(
    db,
    "users",
    uid,
    "law_progress",
    item.id
  );

  const current = await getDoc(ref);

  const intervalDays =
    result === "errei"
      ? 1
      : result === "quase"
        ? 3
        : 7;

  const nextReview = new Date();

  nextReview.setDate(
    nextReview.getDate() + intervalDays
  );

  const payload = {
    lawItemId: item.id,
    contestId: item.contestId,
    lawName: item.lawName,
    reference: item.reference,
    topicId: item.topicId || null,
    lastResult: result,
    nextReviewAt: nextReview,
    lastReviewedAt: serverTimestamp(),
    status: "em_revisao",
  };

  if (!current.exists()) {
    await setDoc(ref, {
      ...payload,
      timesReviewed: 1,
      timesCorrect:
        result === "acertei" ? 1 : 0,
      timesAlmost:
        result === "quase" ? 1 : 0,
      timesWrong:
        result === "errei" ? 1 : 0,
    });
  } else {
    await updateDoc(ref, {
      ...payload,
      timesReviewed: increment(1),
      timesCorrect: increment(
        result === "acertei" ? 1 : 0
      ),
      timesAlmost: increment(
        result === "quase" ? 1 : 0
      ),
      timesWrong: increment(
        result === "errei" ? 1 : 0
      ),
    });
  }
}

export async function getLawProgress(
  uid: string,
  contestId: string
) {
  const snap = await getDocs(
    query(
      collection(db, "users", uid, "law_progress"),
      where("contestId", "==", contestId)
    )
  );

  return snap.docs
    .map(d => ({
      id: d.id,
      ...d.data(),
    }))
    .filter(
      (row: any) =>
        row.contestId === contestId
    );
}

export async function getDueReviews(
  uid: string,
  contestId: string
) {
  const snap = await getDocs(
    query(
      collection(db, "users", uid, "reviews"),
      where("contestId", "==", contestId)
    )
  );

  const now = Date.now();

  return snap.docs
    .map(d => ({
      id: d.id,
      ...d.data(),
    }))
    .filter(
      (item: any) =>
        item.contestId === contestId &&
        item.status === "pendente" &&
        asMillis(item.scheduledFor) <= now
    )
    .sort(
      (a: any, b: any) =>
        asMillis(a.scheduledFor) -
        asMillis(b.scheduledFor)
    );
}

export async function getLunchReviewQueue(
  uid: string,
  contestId: string
) {
  const [dueReviews, errors] = await Promise.all([
    getDueReviews(uid, contestId),
    getErrors(uid, contestId),
  ]);

  const activeErrors = errors
    .filter(
      (row: any) =>
        row.status !== "consolidado"
    )
    .sort(
      (a: any, b: any) =>
        Number(b.recurrence || 1) -
        Number(a.recurrence || 1)
    );

  const byQuestion = new Set(
    dueReviews
      .filter(
        (row: any) =>
          row.sourceType === "question"
      )
      .map(
        (row: any) =>
          String(row.sourceId || "")
      )
  );

  const recurring = activeErrors
    .filter(
      (row: any) =>
        Number(row.recurrence || 1) >= 2 &&
        !byQuestion.has(
          String(row.questionId)
        )
    )
    .map(
      (row: any) => ({
        id: `error__${row.id}`,
        syntheticError: true,
        errorId: row.id,
        questionId: row.questionId,
        contestId,
        sourceType: "question",
        sourceId: row.questionId,
        discipline: row.discipline,
        topicId:
          row.subtopicId ||
          row.topicId,
        reason: "erro_recorrente",
        recurrence: Number(
          row.recurrence || 1
        ),
        correctStreak: Number(
          row.correctStreak || 0
        ),
        priority:
          row.priority ||
          (Number(row.recurrence || 1) >= 3
            ? "alta"
            : "media"),
        intervalDays: 0,
        status: "pendente",
        comment: row.comment || "",
      })
    );

  const enrichedDue = dueReviews.map(
    (review: any) => {
      const err =
        review.sourceType === "question"
          ? (activeErrors as any[]).find(
              (e: any) =>
                e.questionId === review.sourceId
            )
          : null;

      return {
        ...review,
        recurrence: err?.recurrence || 0,
        correctStreak: Number(
          err?.correctStreak || 0
        ),
        errorId: err?.id || null,
        comment: err?.comment || null,
      };
    }
  );

  return [
    ...recurring,
    ...enrichedDue,
  ].sort((a: any, b: any) => {
    const ar = Number(a.recurrence || 0);
    const br = Number(b.recurrence || 0);

    if (ar !== br) {
      return br - ar;
    }

    if (
      a.sourceType === "question" &&
      b.sourceType !== "question"
    ) {
      return -1;
    }

    if (
      b.sourceType === "question" &&
      a.sourceType !== "question"
    ) {
      return 1;
    }

    return (
      asMillis(a.scheduledFor) -
      asMillis(b.scheduledFor)
    );
  });
}

export async function markErrorReviewed(
  uid: string,
  id: string
) {
  await updateDoc(
    doc(
      db,
      "users",
      uid,
      "error_notebook",
      id
    ),
    {
      lastReviewedAt: serverTimestamp(),
    }
  );
}

export async function completeReview(
  uid: string,
  id: string
) {
  await updateDoc(
    doc(
      db,
      "users",
      uid,
      "reviews",
      id
    ),
    {
      status: "concluida",
      completedAt: serverTimestamp(),
    }
  );
}

export async function scheduleAdaptiveReview(
  uid: string,
  contestId: string,
  input: {
    topicId: string;
    discipline: string;
    difficulty: Difficulty;
    sourceType:
      | "question"
      | "topic"
      | "law";
    sourceId: string;
    reasonPrefix: string;
    objectiveAccuracy?: number | null;
  }
) {
  let days =
    input.difficulty === "facil"
      ? 7
      : input.difficulty === "medio"
        ? 4
        : 2;

  if (
    input.objectiveAccuracy !== null &&
    input.objectiveAccuracy !== undefined
  ) {
    if (input.objectiveAccuracy < 60) {
      days = Math.min(days, 2);
    } else if (
      input.objectiveAccuracy < 80
    ) {
      days = Math.min(days, 4);
    }
  }

  const scheduledFor = new Date();

  scheduledFor.setDate(
    scheduledFor.getDate() + days
  );

  return addDoc(
    collection(
      db,
      "users",
      uid,
      "reviews"
    ),
    {
      contestId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      discipline: input.discipline,
      topicId: input.topicId,
      reason:
        `${input.reasonPrefix}_${input.difficulty}`,
      perceivedDifficulty: input.difficulty,
      objectiveAccuracy:
        input.objectiveAccuracy ?? null,
      intervalDays: days,
      scheduledFor,
      status: "pendente",
      reviewMode: "almoco",
      createdAt: serverTimestamp(),
    }
  );
}
export async function getDashboardData(
  uid: string,
  contestId: string
): Promise<DashboardData> {
  const [
    sessions,
    questionProgress,
    errors,
    reviews,
    lawProgress,
    topics,
  ] = await Promise.all([
    getDocs(
      query(
        collection(db, "users", uid, "study_sessions"),
        where("contestId", "==", contestId)
      )
    ),
    getDocs(
      query(
        collection(db, "users", uid, "question_progress"),
        where("contestId", "==", contestId)
      )
    ),
    getDocs(
      query(
        collection(db, "users", uid, "error_notebook"),
        where("contestId", "==", contestId)
      )
    ),
    getDocs(
      query(
        collection(db, "users", uid, "reviews"),
        where("contestId", "==", contestId)
      )
    ),
    getDocs(
      query(
        collection(db, "users", uid, "law_progress"),
        where("contestId", "==", contestId)
      )
    ),
    getTopics(contestId),
  ]);

  const sessionRows = sessions.docs
    .map(
      d =>
        ({
          id: d.id,
          ...d.data(),
        } as any)
    )
    .filter(
      row => row.contestId === contestId
    );

  const progressRows = questionProgress.docs
    .map(
      d =>
        ({
          id: d.id,
          ...d.data(),
        } as any)
    )
    .filter(
      row => row.contestId === contestId
    );

  const errorRows = errors.docs
    .map(
      d =>
        ({
          id: d.id,
          ...d.data(),
        } as any)
    )
    .filter(
      row => row.contestId === contestId
    );

  const reviewRows = reviews.docs
    .map(
      d =>
        ({
          id: d.id,
          ...d.data(),
        } as any)
    )
    .filter(
      row => row.contestId === contestId
    );

  const lawRows = lawProgress.docs
    .map(
      d =>
        ({
          id: d.id,
          ...d.data(),
        } as any)
    )
    .filter(
      row => row.contestId === contestId
    );

  const confidenceBreakdown =
    progressRows.reduce(
      (acc, row) => {
        const value = String(
          row.lastConfidence || "sabia"
        );

        if (value === "chutei") {
          acc.chutei += 1;
        } else if (value === "entre_duas") {
          acc.entreDuas += 1;
        } else {
          acc.sabia += 1;
        }

        return acc;
      },
      {
        sabia: 0,
        entreDuas: 0,
        chutei: 0,
      }
    );

  const totalMinutes = sessionRows.reduce(
    (sum, row) =>
      sum +
      Number(row.durationMinutes || 0),
    0
  );

  const globalProgress =
    progressSummary(progressRows);

  const questionsAnswered =
    globalProgress.answered;

  const mastery =
    globalProgress.accuracy;

  const evidence =
    globalProgress.evidence;

  const studiedTopicIds =
    new Set<string>();

  sessionRows.forEach(row => {
    if (row.topicId) {
      studiedTopicIds.add(row.topicId);
    }

    if (row.subtopicId) {
      studiedTopicIds.add(row.subtopicId);
    }
  });

  progressRows.forEach(row => {
    if (row.topicId) {
      studiedTopicIds.add(row.topicId);
    }

    if (row.subtopicId) {
      studiedTopicIds.add(row.subtopicId);
    }
  });

  const currentTopics = topics.filter(
    t =>
      t.activeInCurrentEdital !== false
  );

  const currentStudied =
    currentTopics.filter(t => {
      const ids = t.canonicalContentId
        ? topics
            .filter(
              x =>
                x.canonicalContentId ===
                t.canonicalContentId
            )
            .map(x => x.id)
        : [t.id];

      return ids.some(id =>
        studiedTopicIds.has(id)
      );
    });

  const coverage = currentTopics.length
    ? Math.min(
        100,
        Math.round(
          (currentStudied.length /
            currentTopics.length) *
            100
        )
      )
    : 0;

  const now = Date.now();

  const disciplines = Array.from(
    new Set(
      currentTopics.map(
        t => t.discipline
      )
    )
  ).sort();

  const disciplineStats:
    DisciplineStat[] =
    disciplines.map(discipline => {
      const dTopics =
        currentTopics.filter(
          t =>
            t.discipline === discipline
        );

      const dStudied =
        dTopics.filter(t => {
          const ids =
            t.canonicalContentId
              ? topics
                  .filter(
                    x =>
                      x.canonicalContentId ===
                      t.canonicalContentId
                  )
                  .map(x => x.id)
              : [t.id];

          return ids.some(id =>
            studiedTopicIds.has(id)
          );
        });

      const dProgress =
        progressRows.filter(
          row =>
            row.discipline ===
            discipline
        );

      const summary =
        progressSummary(dProgress);

      const recentSessions =
        sessionRows.filter(
          row =>
            row.discipline ===
              discipline &&
            asMillis(row.createdAt) >=
              now -
                7 * 86400000
        );

      const previousSessions =
        sessionRows.filter(
          row =>
            row.discipline ===
              discipline &&
            asMillis(row.createdAt) <
              now -
                7 * 86400000 &&
            asMillis(row.createdAt) >=
              now -
                14 * 86400000
        );

      const evolution = Math.max(
        -99,
        Math.min(
          99,
          recentSessions.length -
            previousSessions.length
        )
      );

      const fragileCoverage =
        dStudied.filter(topic => {
          const ids =
            topic.canonicalContentId
              ? topics
                  .filter(
                    x =>
                      x.canonicalContentId ===
                      topic.canonicalContentId
                  )
                  .map(x => x.id)
              : [topic.id];

          const topicRows =
            dProgress.filter(
              row =>
                ids.includes(row.topicId) ||
                ids.includes(
                  row.subtopicId
                )
            );

          return (
            progressSummary(topicRows)
              .answered < 10
          );
        }).length;

      return {
        discipline,
        coverage: dTopics.length
          ? Math.round(
              (dStudied.length /
                dTopics.length) *
                100
            )
          : 0,
        mastery: summary.accuracy,
        evolution,
        studiedTopics: dStudied.length,
        totalTopics: dTopics.length,
        answered: summary.answered,
        errors: errorRows.filter(
          row =>
            row.discipline ===
            discipline
        ).length,
        evidence: summary.evidence,
        fragileCoverage,
      };
    });

  const activeErrors = errorRows.filter(
    row => row.status !== "consolidado"
  );

  const errorByDiscipline =
    errorRows.reduce(
      (
        acc: Record<string, number>,
        row: any
      ) => {
        const key = String(
          row.discipline ||
            "Sem disciplina"
        );

        acc[key] =
          (acc[key] || 0) + 1;

        return acc;
      },
      {}
    );

  const risks: RiskItem[] = [];

  disciplineStats.forEach(stat => {
    if (stat.coverage < 55) {
      risks.push({
        id:
          `coverage-${stat.discipline}`,
        discipline: stat.discipline,
        title: "Cobertura baixa",
        severity: "alta",
        reason:
          `${stat.coverage}% do edital coberto.`,
      });
    } else if (
      stat.fragileCoverage > 0
    ) {
      risks.push({
        id:
          `fragile-${stat.discipline}`,
        discipline: stat.discipline,
        title: "Cobertura frágil",
        severity:
          stat.fragileCoverage >= 3
            ? "alta"
            : "media",
        reason:
          `${stat.fragileCoverage} conteúdo(s) estudado(s) ainda com pouca validação por questões.`,
      });
    }

    if (
      stat.answered >= 10 &&
      stat.mastery < 60
    ) {
      risks.push({
        id:
          `mastery-${stat.discipline}`,
        discipline: stat.discipline,
        title: "Domínio baixo",
        severity: "alta",
        reason:
          `${stat.mastery}% de domínio efetivo em ${stat.answered} respostas.`,
      });
    } else if (
      stat.answered >= 10 &&
      stat.mastery < 80
    ) {
      risks.push({
        id:
          `mastery-${stat.discipline}`,
        discipline: stat.discipline,
        title: "Domínio instável",
        severity: "media",
        reason:
          `${stat.mastery}% de domínio efetivo.`,
      });
    }
  });

  activeErrors
    .filter(
      (row: any) =>
        Number(
          row.recurrence || 1
        ) >= 2
    )
    .sort(
      (a: any, b: any) =>
        Number(
          b.recurrence || 1
        ) -
        Number(
          a.recurrence || 1
        )
    )
    .slice(0, 5)
    .forEach(
      (row: any) =>
        risks.push({
          id:
            `error-${row.id}`,
          discipline:
            row.discipline ||
            "Geral",
          title:
            row.subject ||
            row.topicId ||
            "Erro recorrente",
          severity:
            Number(
              row.recurrence || 1
            ) >= 3
              ? "alta"
              : "media",
          reason:
            `${row.recurrence || 1} erros registrados • ${Number(row.correctStreak || 0)}/3 acertos seguidos.`,
          topicId:
            row.subtopicId ||
            row.topicId ||
            null,
        })
    );

  const severityWeight = {
    alta: 3,
    media: 2,
    baixa: 1,
  };

  risks
    .sort(
      (a, b) =>
        severityWeight[
          b.severity
        ] -
        severityWeight[
          a.severity
        ]
    )
    .splice(8);

  const resumeItems: ResumeItem[] = [];

  const latestSession =
    [...sessionRows].sort(
      (a, b) =>
        asMillis(b.createdAt) -
        asMillis(a.createdAt)
    )[0];

  if (latestSession?.topicId) {
    const t = topics.find(
      x =>
        x.id ===
        (
          latestSession.subtopicId ||
          latestSession.topicId
        )
    );

    resumeItems.push({
      id:
        `session-${latestSession.id}`,
      type: "conteudo",
      title:
        t?.title ||
        latestSession.discipline ||
        "Último conteúdo",
      subtitle:
        `${latestSession.durationMinutes || 0} min registrados • continuar do conteúdo`,
      href:
        `/conteudo/${encodeURIComponent(
          latestSession.subtopicId ||
            latestSession.topicId
        )}`,
    });
  }

  const latestQuestion =
    [...progressRows].sort(
      (a, b) =>
        asMillis(
          b.lastAnsweredAt
        ) -
        asMillis(
          a.lastAnsweredAt
        )
    )[0];

  if (latestQuestion?.questionId) {
    resumeItems.push({
      id:
        `question-${latestQuestion.questionId}`,
      type: "questoes",
      title: "Continuar questões",
      subtitle:
        latestQuestion.discipline ||
        "Última bateria",
      href:
        `/questoes/${latestQuestion.questionId}`,
    });
  }

  const latestLaw =
    [...lawRows].sort(
      (a, b) =>
        asMillis(
          b.lastReviewedAt
        ) -
        asMillis(
          a.lastReviewedAt
        )
    )[0];

  if (latestLaw?.lawItemId) {
    resumeItems.push({
      id:
        `law-${latestLaw.lawItemId}`,
      type: "lei",
      title:
        `${latestLaw.lawName || "Lei Seca"} • ${latestLaw.reference || ""}`,
      subtitle:
        "Continuar revisão da lei",
      href:
        `/lei-seca?item=${encodeURIComponent(
          latestLaw.lawItemId
        )}&review=1`,
    });
  }

  return {
    totalMinutes,
    questionsAnswered,
    accuracy: mastery,
    totalErrors: errorRows.length,
    activeErrors: activeErrors.length,
    consolidatedErrors:
      errorRows.filter(
        row =>
          row.status ===
          "consolidado"
      ).length,
    recurringErrors:
      activeErrors.filter(
        row =>
          Number(
            row.recurrence || 1
          ) >= 2
      ).length,
    dueReviews:
      reviewRows.filter(
        row =>
          row.status ===
            "pendente" &&
          asMillis(
            row.scheduledFor
          ) <= now
      ).length,
    dueLaw:
      lawRows.filter(
        row =>
          row.nextReviewAt &&
          asMillis(
            row.nextReviewAt
          ) <= now
      ).length,
    coverage,
    mastery,
    evidence,
    disciplineStats,
    errorByDiscipline,
    risks,
    resumeItems,
    confidenceBreakdown,
  };
}

export async function generateDailyPlan(
  uid: string,
  contestId: string,
  force = false
): Promise<DailyPlan> {
  const key = dateKey();

  const planId =
    `${contestId}__${key}`;

  const ref = doc(
    db,
    "users",
    uid,
    "daily_plans",
    planId
  );

  const existing = await getDoc(ref);

  if (
    existing.exists() &&
    !force
  ) {
    return {
      id: existing.id,
      ...existing.data(),
    } as DailyPlan;
  }

  const [
    settings,
    topics,
    sessionsSnap,
    progressSnap,
    errors,
    dueReviews,
    lawItems,
    lawProgress,
  ] = await Promise.all([
    getStudySettings(uid),
    getTopics(contestId),
    getDocs(
      query(
        collection(db, "users", uid, "study_sessions"),
        where("contestId", "==", contestId)
      )
    ),
    getDocs(
      query(
        collection(db, "users", uid, "question_progress"),
        where("contestId", "==", contestId)
      )
    ),
    getErrors(uid, contestId),
    getLunchReviewQueue(
      uid,
      contestId
    ),
    getLawItems(contestId),
    getLawProgress(
      uid,
      contestId
    ),
  ]);

  const sessionRows = sessionsSnap.docs
    .map(d => d.data() as any)
    .filter(
      row =>
        row.contestId === contestId
    );

  const progressRows =
    progressSnap.docs
      .map(d => d.data() as any)
      .filter(
        row =>
          row.contestId === contestId
      );

  const activeErrors = (
    errors as any[]
  ).filter(
    (row: any) =>
      row.status !== "consolidado"
  );

  const lastStudyByTopic =
    new Map<string, number>();

  sessionRows.forEach(row => {
    const when = asMillis(row.createdAt);

    [
      row.topicId,
      row.subtopicId,
    ]
      .filter(Boolean)
      .forEach((id: string) => {
        lastStudyByTopic.set(
          id,
          Math.max(
            lastStudyByTopic.get(id) ||
              0,
            when
          )
        );
      });
  });

  const scored = topics
    .filter(
      t =>
        t.level === "topic" &&
        t.activeInCurrentEdital !==
          false
    )
    .map(topic => {
      const equivalentIds =
        topic.canonicalContentId
          ? topics
              .filter(
                t =>
                  t.canonicalContentId ===
                  topic.canonicalContentId
              )
              .map(t => t.id)
          : [topic.id];

      const mastery =
        topicMastery(
          progressRows,
          equivalentIds
        );

      const errorRecurrence =
        activeErrors
          .filter(
            (e: any) =>
              equivalentIds.includes(
                e.topicId
              ) ||
              equivalentIds.includes(
                e.subtopicId
              )
          )
          .reduce(
            (
              sum: number,
              e: any
            ) =>
              sum +
              Number(
                e.recurrence || 1
              ),
            0
          );

      const last = Math.max(
        0,
        ...equivalentIds.map(
          id =>
            lastStudyByTopic.get(
              id
            ) || 0
        )
      );

      const daysSince = last
        ? Math.floor(
            (Date.now() - last) /
              86400000
          )
        : 999;

      let score = last ? 20 : 80;

      if (mastery === null) {
        score += 25;
      } else if (mastery < 60) {
        score += 40;
      } else if (mastery < 80) {
        score += 22;
      } else {
        score += 5;
      }

      score += Math.min(
        35,
        errorRecurrence * 8
      );

      score += Math.min(
        20,
        daysSince > 30
          ? 20
          : Math.floor(
              daysSince / 3
            )
      );

      return {
        topic,
        score,
        mastery,
        errorRecurrence,
        daysSince,
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score
    );

  const tasks: DailyPlanTask[] = [];

  const morningTopic = scored[0];

  if (
    morningTopic &&
    settings.morningMinutes > 0
  ) {
    tasks.push({
      id:
        `manha-${morningTopic.topic.id}`,
      type:
        settings.mode === "reta_final" &&
        morningTopic.mastery !== null
          ? "questoes"
          : "estudo",
      period: "manha",
      discipline:
        morningTopic.topic.discipline,
      topicId: morningTopic.topic.id,
      title:
        settings.mode === "reta_final" &&
        morningTopic.mastery !== null
          ? `Questões — ${morningTopic.topic.title}`
          : morningTopic.topic.title,
      durationMinutes:
        settings.morningMinutes,
      questionTarget: Math.max(
        5,
        Math.round(
          settings.defaultQuestionTarget /
            2
        )
      ),
      reason:
        settings.mode === "reta_final" &&
        morningTopic.mastery !== null
          ? `Reta final • validar domínio (${morningTopic.mastery}%)`
          : morningTopic.daysSince === 999
            ? "Conteúdo ainda não estudado"
            : morningTopic.mastery !== null &&
                morningTopic.mastery < 60
              ? `Domínio baixo (${morningTopic.mastery}%)`
              : "Maior prioridade atual do edital",
      sourceId:
        morningTopic.topic.id,
      sourceType: "topic",
      status: "pendente",
      completedDifficulty: null,
    });
  }

  let lunchRemaining =
    settings.lunchMinutes;

  const lunchReviews =
    dueReviews.slice(0, 5);

  for (
    const review of lunchReviews
  ) {
    if (lunchRemaining < 4) {
      break;
    }

    const duration = Math.min(
      5,
      lunchRemaining
    );

    tasks.push({
      id:
        `almoco-review-${review.id}`,
      type: "revisao",
      period: "almoco",
      discipline: String(
        review.discipline ||
          "Revisão"
      ),
      topicId:
        review.topicId || null,
      title:
        review.sourceType ===
        "question"
          ? review.recurrence >= 2
            ? `Erro recorrente (${review.recurrence}x) — refazer questão`
            : "Refazer questão errada"
          : `Revisar ${review.topicId || "conteúdo"}`,
      durationMinutes: duration,
      reason:
        review.recurrence >= 2
          ? `Erro recorrente com ${review.recurrence} ocorrências`
          : String(
              review.reason ||
                "Revisão vencida"
            ).replaceAll("_", " "),
      sourceId:
        review.sourceId ||
        review.id,
      sourceType:
        review.sourceType ||
        "topic",
      status: "pendente",
      completedDifficulty: null,
    });

    lunchRemaining -= duration;
  }

  const progressMap = new Map(
    lawProgress.map(
      (row: any) => [
        row.lawItemId,
        row,
      ]
    )
  );

  const dueLawItems =
    lawItems.filter(item => {
      if (
        item.status &&
        item.status !== "vigente"
      ) {
        return false;
      }

      const row: any =
        progressMap.get(item.id);

      return (
        !row ||
        !row.nextReviewAt ||
        asMillis(row.nextReviewAt) <=
          Date.now()
      );
    });

  if (
    lunchRemaining >= 4 &&
    dueLawItems.length
  ) {
    const duration = Math.min(
      Math.max(
        4,
        lunchRemaining
      ),
      8
    );

    tasks.push({
      id:
        `almoco-law-${dueLawItems[0].id}`,
      type: "lei_seca",
      period: "almoco",
      discipline: "Lei Seca",
      topicId:
        dueLawItems[0].topicId ||
        null,
      title:
        `${dueLawItems[0].lawName} • ${dueLawItems[0].reference}`,
      durationMinutes: duration,
      reason:
        progressMap.has(
          dueLawItems[0].id
        )
          ? "Card vencido / dificuldade anterior"
          : "Dispositivo ainda não revisado",
      sourceId:
        dueLawItems[0].id,
      sourceType: "law",
      status: "pendente",
      completedDifficulty: null,
    });

    lunchRemaining -= duration;
  }

  const eveningTopics = scored
    .filter(
      x =>
        x.topic.id !==
        morningTopic?.topic.id
    )
    .slice(0, 2);

  let eveningRemaining =
    settings.eveningMinutes;

  if (
    eveningTopics[0] &&
    eveningRemaining > 0
  ) {
    const duration = Math.min(
      45,
      eveningRemaining
    );

    tasks.push({
      id:
        `noite-study-${eveningTopics[0].topic.id}`,
      type:
        settings.mode === "reta_final" &&
        eveningTopics[0].mastery !== null
          ? "questoes"
          : "estudo",
      period: "noite",
      discipline:
        eveningTopics[0].topic.discipline,
      topicId:
        eveningTopics[0].topic.id,
      title:
        settings.mode === "reta_final" &&
        eveningTopics[0].mastery !== null
          ? `Questões — ${eveningTopics[0].topic.title}`
          : eveningTopics[0].topic.title,
      durationMinutes: duration,
      questionTarget:
        settings.defaultQuestionTarget,
      reason:
        settings.mode === "reta_final"
          ? eveningTopics[0]
                .errorRecurrence > 0
            ? `Reta final • ${eveningTopics[0].errorRecurrence} ocorrência(s) de erro`
            : "Reta final • priorizar questões e validação"
          : eveningTopics[0]
                .errorRecurrence > 0
            ? `${eveningTopics[0].errorRecurrence} ocorrência(s) de erro neste tópico`
            : "Próximo tópico de maior prioridade",
      sourceId:
        eveningTopics[0].topic.id,
      sourceType: "topic",
      status: "pendente",
      completedDifficulty: null,
    });

    eveningRemaining -= duration;
  }

  if (
    eveningTopics[1] &&
    eveningRemaining >= 20
  ) {
    const duration = Math.min(
      30,
      eveningRemaining
    );

    tasks.push({
      id:
        `noite-questions-${eveningTopics[1].topic.id}`,
      type: "questoes",
      period: "noite",
      discipline:
        eveningTopics[1].topic.discipline,
      topicId:
        eveningTopics[1].topic.id,
      title:
        `Questões — ${eveningTopics[1].topic.title}`,
      durationMinutes: duration,
      questionTarget:
        settings.defaultQuestionTarget,
      reason:
        eveningTopics[1].mastery === null
          ? "Medir domínio inicial"
          : `Domínio atual: ${eveningTopics[1].mastery}%`,
      sourceId:
        eveningTopics[1].topic.id,
      sourceType: "topic",
      status: "pendente",
      completedDifficulty: null,
    });
  }

  const plan: Omit<
    DailyPlan,
    "id"
  > = {
    contestId,
    dateKey: key,
    generatedAt: serverTimestamp(),
    settings,
    tasks,
  };

  await setDoc(ref, plan);

  return {
    id: planId,
    ...plan,
  };
}

export async function getTodayPlan(
  uid: string,
  contestId: string
) {
  const id =
    `${contestId}__${dateKey()}`;

  const snap = await getDoc(
    doc(
      db,
      "users",
      uid,
      "daily_plans",
      id
    )
  );

  return snap.exists()
    ? ({
        id: snap.id,
        ...snap.data(),
      } as DailyPlan)
    : null;
}

export async function completePlanTask(
  uid: string,
  plan: DailyPlan,
  taskId: string,
  difficulty: Difficulty
) {
  const task = plan.tasks.find(
    t => t.id === taskId
  );

  if (!task) return;

  const updatedTasks =
    plan.tasks.map(t =>
      t.id === taskId
        ? {
            ...t,
            status:
              "concluida" as const,
            completedDifficulty:
              difficulty,
          }
        : t
    );

  await updateDoc(
    doc(
      db,
      "users",
      uid,
      "daily_plans",
      plan.id
    ),
    {
      tasks: updatedTasks,
      updatedAt: serverTimestamp(),
    }
  );

  if (
    (
      task.type === "estudo" ||
      task.type === "questoes"
    ) &&
    task.topicId
  ) {
    await scheduleAdaptiveReview(
      uid,
      plan.contestId,
      {
        topicId: task.topicId,
        discipline:
          task.discipline,
        difficulty,
        sourceType: "topic",
        sourceId: task.topicId,
        reasonPrefix:
          "plano_diario",
        objectiveAccuracy: null,
      }
    );
  }

  if (task.type === "revisao") {
    const queueId =
      task.id.replace(
        /^almoco-review-/,
        ""
      );

    if (
      queueId.startsWith(
        "error__"
      )
    ) {
      await markErrorReviewed(
        uid,
        queueId.replace(
          /^error__/,
          ""
        )
      );
    } else {
      await completeReview(
        uid,
        queueId
      );
    }

    if (
      task.topicId &&
      task.sourceId
    ) {
      await scheduleAdaptiveReview(
        uid,
        plan.contestId,
        {
          topicId:
            task.topicId,
          discipline:
            task.discipline,
          difficulty,
          sourceType:
            task.sourceType ===
            "question"
              ? "question"
              : "topic",
          sourceId:
            task.sourceId,
          reasonPrefix:
            "revisao_almoco_concluida",
          objectiveAccuracy: null,
        }
      );
    }
  }
}

export async function ignorePlanTask(
  uid: string,
  plan: DailyPlan,
  taskId: string
) {
  const updatedTasks =
    plan.tasks.map(t =>
      t.id === taskId
        ? {
            ...t,
            status:
              "ignorada" as const,
          }
        : t
    );

  await updateDoc(
    doc(
      db,
      "users",
      uid,
      "daily_plans",
      plan.id
    ),
    {
      tasks: updatedTasks,
      updatedAt: serverTimestamp(),
    }
  );
}
export async function generateQuickStudyPlan(
  uid: string,
  contestId: string,
  minutes: number
): Promise<DailyPlanTask[]> {
  const [
    topics,
    progressSnap,
    errors,
    dueReviews,
    lawItems,
    lawProgress,
  ] = await Promise.all([
    getTopics(contestId),
    getDocs(
      query(
        collection(db, "users", uid, "question_progress"),
        where("contestId", "==", contestId)
      )
    ),
    getErrors(uid, contestId),
    getLunchReviewQueue(
      uid,
      contestId
    ),
    getLawItems(contestId),
    getLawProgress(
      uid,
      contestId
    ),
  ]);

  const progressRows =
    progressSnap.docs
      .map(
        d =>
          ({
            id: d.id,
            ...d.data(),
          } as any)
      )
      .filter(
        row =>
          row.contestId === contestId
      );

  const activeErrors = (
    errors as any[]
  ).filter(
    (row: any) =>
      row.status !== "consolidado"
  );

  const tasks: DailyPlanTask[] = [];

  let remaining = Math.max(
    5,
    minutes
  );

  const recurring =
    activeErrors.sort(
      (a: any, b: any) =>
        Number(
          b.recurrence || 1
        ) -
        Number(
          a.recurrence || 1
        )
    )[0];

  if (
    recurring &&
    remaining >= 5
  ) {
    const duration =
      Math.min(
        7,
        remaining
      );

    tasks.push({
      id:
        `agora-erro-${recurring.id}`,
      type: "revisao",
      period: "agora",
      discipline:
        recurring.discipline ||
        "Revisão",
      topicId:
        recurring.subtopicId ||
        recurring.topicId ||
        null,
      title:
        `Refazer erro — ${recurring.subject || recurring.topicId}`,
      durationMinutes: duration,
      reason:
        `${recurring.recurrence || 1} erro(s) • ${Number(recurring.correctStreak || 0)}/3 acertos seguidos`,
      sourceId:
        recurring.questionId,
      sourceType: "question",
      status: "pendente",
      completedDifficulty: null,
    });

    remaining -= duration;
  }

  const progressMap = new Map(
    lawProgress.map(
      (row: any) => [
        row.lawItemId,
        row,
      ]
    )
  );

  const dueLaw =
    lawItems.find(item => {
      if (
        item.status &&
        item.status !== "vigente"
      ) {
        return false;
      }

      const row: any =
        progressMap.get(item.id);

      return (
        !row ||
        !row.nextReviewAt ||
        asMillis(row.nextReviewAt) <=
          Date.now()
      );
    });

  if (
    dueLaw &&
    remaining >= 5
  ) {
    const duration =
      Math.min(
        5,
        remaining
      );

    tasks.push({
      id:
        `agora-law-${dueLaw.id}`,
      type: "lei_seca",
      period: "agora",
      discipline: "Lei Seca",
      topicId:
        dueLaw.topicId || null,
      title:
        `${dueLaw.lawName} • ${dueLaw.reference}`,
      durationMinutes: duration,
      reason:
        progressMap.has(
          dueLaw.id
        )
          ? "Revisão legal vencida"
          : "Dispositivo ainda não revisado",
      sourceId: dueLaw.id,
      sourceType: "law",
      status: "pendente",
      completedDifficulty: null,
    });

    remaining -= duration;
  }

  const scored = topics
    .filter(
      topic =>
        topic.activeInCurrentEdital !==
        false
    )
    .map(topic => {
      const summary =
        progressSummary(
          progressRows.filter(
            row =>
              row.topicId ===
                topic.id ||
              row.subtopicId ===
                topic.id
          )
        );

      const topicErrors =
        activeErrors.filter(
          (e: any) =>
            e.topicId === topic.id ||
            e.subtopicId === topic.id
        );

      const recurrence =
        topicErrors.reduce(
          (
            sum: number,
            e: any
          ) =>
            sum +
            Number(
              e.recurrence || 1
            ),
          0
        );

      const score =
        (
          summary.answered === 0
            ? 45
            : summary.accuracy < 60
              ? 55
              : summary.accuracy < 80
                ? 35
                : 10
        ) +
        Math.min(
          35,
          recurrence * 7
        ) +
        (
          summary.evidence < 35
            ? 15
            : 0
        );

      return {
        topic,
        summary,
        recurrence,
        score,
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score
    );

  const target = scored[0];

  if (
    target &&
    remaining >= 6
  ) {
    const studyDuration =
      Math.min(
        remaining >= 20
          ? 10
          : 6,
        remaining
      );

    tasks.push({
      id:
        `agora-study-${target.topic.id}`,
      type: "estudo",
      period: "agora",
      discipline:
        target.topic.discipline,
      topicId:
        target.topic.id,
      title:
        target.topic.title,
      durationMinutes:
        studyDuration,
      questionTarget:
        Math.min(
          5,
          Math.max(
            2,
            Math.floor(
              studyDuration / 2
            )
          )
        ),
      reason:
        target.summary.answered === 0
          ? "Conteúdo ainda sem validação"
          : target.summary.accuracy < 80
            ? `Domínio efetivo ${target.summary.accuracy}%`
            : "Próximo conteúdo prioritário",
      sourceId:
        target.topic.id,
      sourceType: "topic",
      status: "pendente",
      completedDifficulty: null,
    });

    remaining -= studyDuration;
  }

  if (
    target &&
    remaining >= 5
  ) {
    tasks.push({
      id:
        `agora-q-${target.topic.id}`,
      type: "questoes",
      period: "agora",
      discipline:
        target.topic.discipline,
      topicId:
        target.topic.id,
      title:
        `Questões — ${target.topic.title}`,
      durationMinutes: remaining,
      questionTarget:
        Math.max(
          3,
          Math.min(
            15,
            Math.round(
              remaining / 1.5
            )
          )
        ),
      reason:
        "Validar o conteúdo logo após o estudo",
      sourceId:
        target.topic.id,
      sourceType: "topic",
      status: "pendente",
      completedDifficulty: null,
    });
  }

  return tasks;
}

function detectLawMentionsFromRows(
  rows: any[]
) {
  const text = rows
    .map(
      row =>
        `${row.originalText || row.texto_original || ""} ${row.title || row.titulo || ""}`
    )
    .join("\n");

  const found = new Set<string>();

  const patterns = [
    /Lei\s+(?:n[º°o]?\s*)?([\d.]+(?:\/\d{2,4})?)/gi,
    /Decreto\s+(?:n[º°o]?\s*)?([\d.]+(?:\/\d{2,4})?)/gi,
    /Constitui(?:ção|cao)\s+Federal/gi,
  ];

  for (
    const pattern of patterns
  ) {
    for (
      const match of text.matchAll(
        pattern
      )
    ) {
      found.add(
        match[0]
          .replace(/\s+/g, " ")
          .trim()
      );
    }
  }

  return Array.from(found).slice(
    0,
    100
  );
}

export async function getContestVersions(
  contestId: string
): Promise<ContestVersion[]> {
  const snap = await getDocs(
    query(
      collection(
        db,
        "contest_versions"
      ),
      where(
        "contestId",
        "==",
        contestId
      )
    )
  );

  return snap.docs
    .map(
      d =>
        ({
          id: d.id,
          ...d.data(),
        } as ContestVersion)
    )
    .sort(
      (a, b) =>
        asMillis(b.importedAt) -
        asMillis(a.importedAt)
    );
}

export async function getEditalItems(
  contestId: string,
  versionId: string
): Promise<EditalItem[]> {
  const snap = await getDocs(
    query(
      collection(
        db,
        "edital_items"
      ),
      where(
        "contestId",
        "==",
        contestId
      )
    )
  );

  return snap.docs
    .map(
      d =>
        ({
          id: d.id,
          ...d.data(),
        } as EditalItem)
    )
    .filter(
      item =>
        item.versionId === versionId
    )
    .sort(
      (a, b) =>
        a.order - b.order
    );
}

export async function createEditalVersion(
  contestId: string,
  rows: any[],
  sourceType:
    | "csv"
    | "pdf"
    | "manual",
  sourceName: string
) {
  const versions =
    await getContestVersions(
      contestId
    );

  const previous =
    versions.find(
      v => v.status === "atual"
    ) ||
    versions[0] ||
    null;

  const stamp = new Date()
    .toISOString()
    .replace(
      /[-:TZ.]/g,
      ""
    )
    .slice(0, 14);

  const versionId =
    `${contestId}__V_${stamp}`;

  const normalized =
    rows.map(
      (row, index) => {
        const localId = String(
          row.id ||
            row.topico_id ||
            row.localId ||
            `ITEM-${index + 1}`
        ).trim();

        const parentRaw = String(
          row.parent_id ||
            row.topico_pai ||
            row.parentLocalId ||
            ""
        ).trim();

        return {
          localId,
          discipline: String(
            row.disciplina ||
              row.discipline ||
              "Geral"
          ).trim(),
          parentLocalId:
            parentRaw || null,
          canonicalContentId:
            String(
              row.conteudo_id ||
                row.canonical_content_id ||
                row.canonicalContentId ||
                ""
            ).trim() || null,
          title: String(
            row.titulo ||
              row.assunto ||
              row.title ||
              localId
          ).trim(),
          originalText: String(
            row.texto_original ||
              row.original_text ||
              row.originalText ||
              row.titulo ||
              row.assunto ||
              ""
          ).trim(),
          level: String(
            row.nivel ||
              row.level ||
              "topic"
          )
            .toLowerCase()
            .includes("sub")
            ? "subtopic" as const
            : "topic" as const,
          tags: Array.isArray(
            row.tags
          )
            ? row.tags
            : String(
                row.tags || ""
              )
                .split(";")
                .map(
                  (x: string) =>
                    x.trim()
                )
                .filter(Boolean),
          order: Number(
            row.ordem ||
              row.order ||
              index + 1
          ),
        };
      }
    );

  const detectedLaws =
    detectLawMentionsFromRows(
      normalized
    );

  const version:
    ContestVersion = {
    id: versionId,
    contestId,
    label:
      sourceName ||
      `Versão ${versions.length + 1}`,
    sourceType,
    sourceName,
    sourceDate: null,
    importedAt: serverTimestamp(),
    itemCount:
      normalized.length,
    status: "atual",
    previousVersionId:
      previous?.id || null,
    detectedLaws,
  };

  await setDoc(
    doc(
      db,
      "contest_versions",
      versionId
    ),
    removeUndefined(version)
  );

  if (previous?.id) {
    await updateDoc(
      doc(
        db,
        "contest_versions",
        previous.id
      ),
      {
        status: "arquivada",
      }
    );
  }

  for (
    let offset = 0;
    offset < normalized.length;
    offset += 350
  ) {
    const batch = writeBatch(db);

    normalized
      .slice(
        offset,
        offset + 350
      )
      .forEach(
        (item, localIndex) => {
          const globalIndex =
            offset + localIndex;

          const id =
            `${versionId}__${item.localId}`;

          const editalItem:
            EditalItem = {
            id,
            contestId,
            versionId,
            ...item,
            status: "ativo",
          };

          batch.set(
            doc(
              db,
              "edital_items",
              id
            ),
            editalItem
          );

          const topicId =
            scopedId(
              contestId,
              item.localId
            );

          const topic: Topic = {
            id: topicId,
            contestId,
            discipline:
              item.discipline,
            parentTopicId:
              item.parentLocalId
                ? scopedId(
                    contestId,
                    item.parentLocalId
                  )
                : null,
            canonicalContentId:
              item.canonicalContentId,
            title: item.title,
            originalText:
              item.originalText,
            level: item.level,
            tags: item.tags,
            order:
              item.order ||
              globalIndex + 1,
            editalVersionId:
              versionId,
            activeInCurrentEdital:
              true,
          };

          batch.set(
            doc(
              db,
              "topics",
              topicId
            ),
            topic,
            { merge: true }
          );
        }
      );

    await batch.commit();
  }

  await setDoc(
    doc(
      db,
      "contests",
      contestId
    ),
    {
      currentVersionId:
        versionId,
      updatedAt:
        serverTimestamp(),
    },
    { merge: true }
  );

  if (previous?.id) {
    const previousItems =
      await getEditalItems(
        contestId,
        previous.id
      );

    const currentIds = new Set(
      normalized.map(
        x => x.localId
      )
    );

    for (
      const old of previousItems.filter(
        x =>
          !currentIds.has(
            x.localId
          )
      )
    ) {
      const topicId =
        scopedId(
          contestId,
          old.localId
        );

      const topicSnap =
        await getDoc(
          doc(
            db,
            "topics",
            topicId
          )
        );

      if (topicSnap.exists()) {
        await updateDoc(
          doc(
            db,
            "topics",
            topicId
          ),
          {
            activeInCurrentEdital:
              false,
          }
        );
      }
    }
  }

  clearReadCache("topics:", "contests:");
  return version;
}

export async function compareEditalVersions(
  contestId: string,
  currentVersionId: string,
  previousVersionId?:
    | string
    | null
) {
  const current =
    await getEditalItems(
      contestId,
      currentVersionId
    );

  let previous:
    EditalItem[] = [];

  if (previousVersionId) {
    previous =
      await getEditalItems(
        contestId,
        previousVersionId
      );
  }

  if (!previous.length) {
    const topics =
      await getTopics(
        contestId
      );

    previous = topics
      .filter(
        t =>
          t.editalVersionId !==
          currentVersionId
      )
      .map(t => ({
        id: t.id,
        contestId,
        versionId: "legacy",
        localId:
          t.id.replace(
            `${contestId}__`,
            ""
          ),
        discipline:
          t.discipline,
        parentLocalId:
          t.parentTopicId ||
          null,
        canonicalContentId:
          t.canonicalContentId ||
          null,
        title: t.title,
        originalText:
          t.originalText,
        level: t.level,
        tags: t.tags,
        order: t.order,
        status: "ativo",
      }));
  }

  const prevMap = new Map(
    previous.map(
      item => [
        item.localId,
        item,
      ]
    )
  );

  const currMap = new Map(
    current.map(
      item => [
        item.localId,
        item,
      ]
    )
  );

  const added = current.filter(
    item =>
      !prevMap.has(
        item.localId
      )
  );

  const removed =
    previous.filter(
      item =>
        !currMap.has(
          item.localId
        )
    );

  const altered = current.filter(
    item => {
      const old =
        prevMap.get(
          item.localId
        );

      return (
        !!old &&
        (
          old.originalText !==
            item.originalText ||
          old.title !==
            item.title ||
          old.discipline !==
            item.discipline ||
          old.canonicalContentId !==
            item.canonicalContentId
        )
      );
    }
  );

  const unchanged =
    current.filter(
      item => {
        const old =
          prevMap.get(
            item.localId
          );

        return (
          !!old &&
          old.originalText ===
            item.originalText &&
          old.title ===
            item.title &&
          old.discipline ===
            item.discipline &&
          old.canonicalContentId ===
            item.canonicalContentId
        );
      }
    );

  return {
    added,
    removed,
    altered,
    unchanged,
  };
}

export async function updateTopicEditable(
  topicId: string,
  patch: Partial<Topic>
) {
  await updateDoc(
    doc(
      db,
      "topics",
      topicId
    ),
    removeUndefined({
      ...patch,
      updatedAt:
        serverTimestamp(),
    }) as any
  );
  clearReadCache("topics:");
}

export async function saveMaterial(
  material: Material
) {
  await setDoc(
    doc(
      db,
      "materials",
      material.id
    ),
    removeUndefined({
      ...material,
      importedAt:
        material.importedAt ||
        serverTimestamp(),
      updatedAt:
        serverTimestamp(),
    }),
    { merge: true }
  );
  clearReadCache("materials:");
}

export async function getMaterials(
  contestId?: string | null
): Promise<Material[]> {
  // Cacheia a coleção uma única vez e depois filtra em memória.
  // Materiais legados sem contestId continuam visíveis na biblioteca.
  const rows = await cachedRead<Material[]>("materials:all", async () => {
    const snap = await getDocs(collection(db, "materials"));
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() } as Material))
      .sort((a, b) => asMillis(b.importedAt) - asMillis(a.importedAt));
  });
  return rows.filter(row => !contestId || !row.contestId || row.contestId === contestId);
}

export async function getContentBlocksByMaterial(
  materialId: string
): Promise<ContentBlock[]> {
  const snap = await getDocs(
    query(
      collection(
        db,
        "content_blocks"
      ),
      where(
        "materialId",
        "==",
        materialId
      )
    )
  );

  return snap.docs
    .map(
      d =>
        ({
          id: d.id,
          ...d.data(),
        } as ContentBlock)
    )
    .sort(
      (a, b) =>
        a.order - b.order
    );
}

export async function deleteContentBlocksByMaterial(
  materialId: string
) {
  const snap = await getDocs(
    query(
      collection(
        db,
        "content_blocks"
      ),
      where(
        "materialId",
        "==",
        materialId
      )
    )
  );

  for (
    let offset = 0;
    offset < snap.docs.length;
    offset += 350
  ) {
    const batch =
      writeBatch(db);

    snap.docs
      .slice(
        offset,
        offset + 350
      )
      .forEach(
        row =>
          batch.delete(row.ref)
      );

    await batch.commit();
  }

  return snap.docs.length;
}

/** Exclusão conservadora. Solicita UID e bloqueia vínculos diretos conhecidos.
 * O histórico de outras contas/coleções legadas pode não estar indexado;
 * prefira arquivamento quando houver dúvida. */
export async function deleteMaterialImport(materialId: string, uid?: string) {
  if (!uid) throw new Error("Você precisa estar autenticado para excluir importações.");
  const blocks = await getContentBlocksByMaterial(materialId);
  const linkedMaterial = await getDocs(query(collection(db, "questions"), where("materialId", "==", materialId), limit(1)));
  if (!linkedMaterial.empty) throw new Error("Material com questões vinculadas. Arquive em vez de excluir.");
  for (let offset = 0; offset < blocks.length; offset += 25) {
    const blockIds = blocks.slice(offset, offset + 25).map(block => block.id);
    if (!blockIds.length) continue;
    const [linked, studied] = await Promise.all([
      getDocs(query(collection(db, "questions"), where("contentBlockId", "in", blockIds), limit(1))),
      getDocs(query(collection(db, "users", uid, "content_block_progress"), where("contentBlockId", "in", blockIds), limit(1))),
    ]);
    if (!linked.empty || !studied.empty) throw new Error("Esta importação tem questões ou progresso vinculado. Arquive-a para preservar os registros.");
  }
  const removedBlocks = await deleteContentBlocksByMaterial(materialId);
  await deleteDoc(doc(db, "materials", materialId));
  clearReadCache("materials:");
  return removedBlocks;
}

/** Exclusão individual apenas sem questões ou progresso conhecidos. */
export async function deleteContentBlock(blockId: string, uid?: string) {
  if (!uid) throw new Error("Você precisa estar autenticado para excluir microblocos.");
  const [linked, studied] = await Promise.all([
    getDocs(query(collection(db, "questions"), where("contentBlockId", "==", blockId), limit(1))),
    getDocs(query(collection(db, "users", uid, "content_block_progress"), where("contentBlockId", "==", blockId), limit(1))),
  ]);
  if (!linked.empty || !studied.empty) throw new Error("Há questões ou histórico associado a este microbloco. Arquive-o em vez de excluir.");
  await deleteDoc(doc(db, "content_blocks", blockId));
}

export async function setDisciplineActiveStatus(contestId: string, discipline: string, active: boolean) {
  const rows = (await getTopics(contestId)).filter(t => t.discipline === discipline);
  for (let offset = 0; offset < rows.length; offset += 350) {
    const batch = writeBatch(db);
    rows.slice(offset, offset + 350).forEach(t => batch.update(doc(db, "topics", t.id), {
      activeInCurrentEdital: active,
      updatedAt: serverTimestamp(),
    }));
    await batch.commit();
  }
  clearReadCache("topics:");
  return rows.length;
}

/** Exclusão restrita: só para disciplina do concurso SEM nenhum dado associado.
 * Primeiro remova as importações e confira os registros de estudo. Nunca apaga progresso.
 */
/** Retira ou reativa um tópico e seus descendentes no edital escolhido.
 * Não altera IDs e nunca apaga questões, materiais nem histórico de estudos.
 */
export async function setTopicTreeActiveStatus(contestId: string, topicId: string, active: boolean) {
  const allTopics = await getTopics(contestId);
  const root = allTopics.find(topic => topic.id === topicId);
  if (!root) throw new Error("Item não encontrado no concurso ativo.");

  const ids = new Set<string>([root.id]);
  // Percorre a hierarquia: excluir um tópico também oculta seus subtópicos.
  let changed = true;
  while (changed) {
    changed = false;
    for (const topic of allTopics) {
      if (topic.parentTopicId && ids.has(topic.parentTopicId) && !ids.has(topic.id)) {
        ids.add(topic.id);
        changed = true;
      }
    }
  }

  const selected = allTopics.filter(topic => ids.has(topic.id));
  for (let offset = 0; offset < selected.length; offset += 350) {
    const batch = writeBatch(db);
    for (const topic of selected.slice(offset, offset + 350)) {
      batch.update(doc(db, "topics", topic.id), {
        activeInCurrentEdital: active,
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  }
  clearReadCache("topics:");
  return selected.length;
}

export async function deleteUnusedDiscipline(uid: string, contestId: string, discipline: string) {
  const rows = (await getTopics(contestId)).filter(t => t.discipline === discipline);
  if (!rows.length) throw new Error("Disciplina sem tópicos neste edital.");
  // Segurança: mesmo uma única referência impede a exclusão definitiva.
  // Consultas pontuais com limit(1), nunca downloads completos de questions/materials/blocks.
  const [q, m, b, sess, progress, answers, reviews, errors, lawProgress] = await Promise.all([
    getDocs(query(collection(db, "questions"), where("discipline", "==", discipline), limit(1))),
    getDocs(query(collection(db, "materials"), where("discipline", "==", discipline), limit(1))),
    getDocs(query(collection(db, "content_blocks"), where("discipline", "==", discipline), limit(1))),
    getDocs(query(collection(db, "users", uid, "study_sessions"), where("discipline", "==", discipline), limit(1))),
    getDocs(query(collection(db, "users", uid, "content_block_progress"), where("discipline", "==", discipline), limit(1))),
    getDocs(query(collection(db, "users", uid, "question_progress"), where("discipline", "==", discipline), limit(1))),
    getDocs(query(collection(db, "users", uid, "reviews"), where("discipline", "==", discipline), limit(1))),
    getDocs(query(collection(db, "users", uid, "error_notebook"), where("discipline", "==", discipline), limit(1))),
    getDocs(query(collection(db, "users", uid, "law_progress"), where("discipline", "==", discipline), limit(1))),
  ]);
  if ([q,m,b,sess,progress,answers,reviews,errors,lawProgress].some(snap => !snap.empty)) {
    throw new Error("Exclusão bloqueada: existem dados associados à disciplina em pelo menos um edital. Use Retirar do concurso, que não apaga históricos.");
  }
  // Guardião adicional para registros antigos sem campo discipline: se houver estudo no concurso,
  // não fazemos exclusão permanente automática; preferir a retirada reversível.
  const legacyStudy = await getDocs(query(collection(db, "users", uid, "question_progress"), where("contestId", "==", contestId), limit(1)));
  if (!legacyStudy.empty) throw new Error("Exclusão definitiva bloqueada: existe histórico neste concurso. Use Retirar do concurso.");
  for (let offset = 0; offset < rows.length; offset += 350) {
    const batch = writeBatch(db);
    rows.slice(offset, offset + 350).forEach(t => batch.delete(doc(db, "topics", t.id)));
    await batch.commit();
  }
  clearReadCache("topics:");
  return rows.length;
}

/** Padroniza o nome de uma disciplina somente neste edital.
 * Não altera IDs de tópicos, questões nem conteúdo canônico dos demais editais.
 * Materiais sem contestId permanecem na biblioteca comum e não são editados.
 */
export async function renameContestDiscipline(contestId: string, from: string, to: string) {
  const target = to.trim();
  if (!target || target.length > 90) throw new Error("Digite um nome válido (até 90 caracteres).");
  if (from === target) return { topics: 0, questions: 0, materials: 0 };
  const [topicRows, questionRows, materialRows] = await Promise.all([
    getTopics(contestId), getQuestions(contestId), getMaterials(contestId)
  ]);
  const ownTopics = topicRows.filter(t => t.discipline === from);
  const ownQuestions = questionRows.filter(q => q.discipline === from);
  const ownMaterials = materialRows.filter(m => m.contestId === contestId && m.discipline === from);
  if (!ownTopics.length) throw new Error("Disciplina não encontrada neste edital.");
  const blockCollections = await Promise.all(ownMaterials.map(m => getContentBlocksByMaterial(m.id)));
  const ownBlocks = blockCollections.flat().filter(b => b.discipline === from);
  const updates: Array<{collectionName: string; id: string}> = [
    ...ownTopics.map(t => ({ collectionName: "topics", id: t.id })),
    ...ownQuestions.map(q => ({ collectionName: "questions", id: q.id })),
    ...ownMaterials.map(m => ({ collectionName: "materials", id: m.id })),
    ...ownBlocks.map(b => ({ collectionName: "content_blocks", id: b.id })),
  ];
  for (let offset = 0; offset < updates.length; offset += 350) {
    const batch = writeBatch(db);
    for (const item of updates.slice(offset, offset + 350)) {
      batch.update(doc(db, item.collectionName, item.id), { discipline: target, updatedAt: serverTimestamp() });
    }
    await batch.commit();
  }
  clearReadCache("topics:", "questions:", "materials:");
  return { topics: ownTopics.length, questions: ownQuestions.length, materials: ownMaterials.length, blocks: ownBlocks.length };
}

export async function saveContentBlocks(
  blocks: ContentBlock[]
) {
  for (
    let offset = 0;
    offset < blocks.length;
    offset += 350
  ) {
    const batch =
      writeBatch(db);

    blocks
      .slice(
        offset,
        offset + 350
      )
      .forEach(
        block =>
          batch.set(
            doc(
              db,
              "content_blocks",
              block.id
            ),
            removeUndefined(block),
            { merge: true }
          )
      );

    await batch.commit();
  }
}

export async function getContentBlocks(
  contentId: string
): Promise<ContentBlock[]> {
  const snap = await getDocs(
    query(
      collection(
        db,
        "content_blocks"
      ),
      where(
        "contentId",
        "==",
        contentId
      )
    )
  );

  return snap.docs
    .map(
      d =>
        ({
          id: d.id,
          ...d.data(),
        } as ContentBlock)
    )
    .filter(block => block.archived !== true)
    .sort((a, b) => a.order - b.order);
}

export async function saveContentBlockProgress(
  uid: string,
  contestId: string,
  block: ContentBlock,
  difficulty: Difficulty
) {
  await setDoc(
    doc(
      db,
      "users",
      uid,
      "content_block_progress",
      scopedId(contestId, block.id)
    ),
    {
      contestId,
      contentBlockId: block.id,
      contentId: block.contentId,
      topicId:
        block.topicId || null,
      discipline:
        block.discipline,
      completed: true,
      difficulty,
      completedAt:
        serverTimestamp(),
    },
    { merge: true }
  );

  if (block.topicId) {
    await scheduleAdaptiveReview(
      uid,
      contestId,
      {
        topicId: block.topicId,
        discipline:
          block.discipline,
        difficulty,
        sourceType: "topic",
        sourceId: block.topicId,
        reasonPrefix:
          "microbloco",
        objectiveAccuracy: null,
      }
    );
  }
}

export async function getContentBlockProgress(
  uid: string,
  contestId: string
) {
  const snap = await getDocs(
    query(
      collection(db, "users", uid, "content_block_progress"),
      where("contestId", "==", contestId)
    )
  );

  return snap.docs
    .map(
      d =>
        ({
          id: d.id,
          ...d.data(),
        } as any)
    )
    .filter(
      row =>
        row.contestId === contestId
    );
}

export async function globalSearch(
  uid: string,
  contestId: string,
  term: string
) {
  const q =
    term.trim().toLowerCase();

  if (!q) return [];

  const [
    topics,
    questions,
    laws,
    errors,
    materials,
  ] = await Promise.all([
    getTopics(contestId),
    getQuestions(contestId),
    getLawItems(contestId),
    getErrors(uid, contestId),
    getMaterials(contestId),
  ]);

  const includes =
    (value: unknown) =>
      String(value || "")
        .toLowerCase()
        .includes(q);

  const rows = [
    ...topics
      .filter(
        x =>
          includes(x.title) ||
          includes(
            x.originalText
          ) ||
          includes(
            x.canonicalContentId
          )
      )
      .slice(0, 12)
      .map(x => ({
        type: "conteudo",
        id: x.id,
        title: x.title,
        subtitle:
          `${x.discipline} • ${x.originalText.slice(0, 100)}`,
        href:
          `/conteudo/${encodeURIComponent(x.id)}`,
      })),

    ...questions
      .filter(
        x =>
          includes(x.statement) ||
          includes(x.subject) ||
          includes(
            x.subsubject
          )
      )
      .slice(0, 12)
      .map(x => ({
        type: "questao",
        id: x.id,
        title:
          x.subject ||
          x.discipline,
        subtitle:
          x.statement.slice(
            0,
            120
          ),
        href:
          `/questoes/${x.id}`,
      })),

    ...laws
      .filter(
        x =>
          includes(x.lawName) ||
          includes(x.reference) ||
          includes(x.text)
      )
      .slice(0, 12)
      .map(x => ({
        type: "lei",
        id: x.id,
        title:
          `${x.lawName} • ${x.reference}`,
        subtitle:
          x.text.slice(
            0,
            120
          ),
        href:
          `/lei-seca?item=${encodeURIComponent(x.id)}`,
      })),

    ...errors
      .filter(
        (x: any) =>
          includes(x.subject) ||
          includes(x.comment) ||
          includes(
            x.discipline
          )
      )
      .slice(0, 8)
      .map(
        (x: any) => ({
          type: "erro",
          id: x.id,
          title:
            `${x.discipline} • ${x.subject || x.topicId}`,
          subtitle:
            `${x.recurrence || 1} erro(s) • ${Number(x.correctStreak || 0)}/3 acertos`,
          href:
            `/caderno-erros?focus=${encodeURIComponent(x.id)}`,
        })
      ),

    ...materials
      .filter(
        x =>
          includes(x.title) ||
          includes(
            x.sourceName
          ) ||
          includes(x.fileName)
      )
      .slice(0, 8)
      .map(x => ({
        type: "material",
        id: x.id,
        title: x.title,
        subtitle:
          x.sourceName ||
          x.fileName ||
          "Material",
        href: "/conteudo",
      })),
  ];

  return rows.slice(0, 30);
}

export async function updateErrorDetails(
  uid: string,
  id: string,
  patch: {
    errorType?: ErrorType;
    comment?: string;
  }
) {
  await updateDoc(
    doc(
      db,
      "users",
      uid,
      "error_notebook",
      id
    ),
    removeUndefined({
      ...patch,
      updatedAt:
        serverTimestamp(),
    }) as any
  );
}

export async function getTopicLearningStates(
  uid: string,
  contestId: string
) {
  const [
    topics,
    sessionsSnap,
    progressSnap,
    errors,
    reviewsSnap,
  ] = await Promise.all([
    getTopics(contestId),
    getDocs(
      query(
        collection(db, "users", uid, "study_sessions"),
        where("contestId", "==", contestId)
      )
    ),
    getDocs(
      query(
        collection(db, "users", uid, "question_progress"),
        where("contestId", "==", contestId)
      )
    ),
    getErrors(uid, contestId),
    getDocs(
      query(
        collection(db, "users", uid, "reviews"),
        where("contestId", "==", contestId)
      )
    ),
  ]);

  const sessions =
    sessionsSnap.docs
      .map(
        d =>
          d.data() as any
      )
      .filter(
        r =>
          r.contestId ===
          contestId
      );

  const progress =
    progressSnap.docs
      .map(
        d =>
          d.data() as any
      )
      .filter(
        r =>
          r.contestId ===
          contestId
      );

  const reviews =
    reviewsSnap.docs
      .map(
        d =>
          d.data() as any
      )
      .filter(
        r =>
          r.contestId ===
            contestId &&
          r.status ===
            "pendente"
      );

  const now = Date.now();

  const states:
    Record<string, any> = {};

  for (const topic of topics) {
    const equivalentIds =
      topic.canonicalContentId
        ? topics
            .filter(
              x =>
                x.canonicalContentId ===
                topic.canonicalContentId
            )
            .map(x => x.id)
        : [topic.id];

    const topicSessions =
      sessions.filter(
        r =>
          equivalentIds.includes(
            r.topicId
          ) ||
          equivalentIds.includes(
            r.subtopicId
          )
      );

    const topicProgress =
      progress.filter(
        r =>
          equivalentIds.includes(
            r.topicId
          ) ||
          equivalentIds.includes(
            r.subtopicId
          )
      );

    const summary =
      progressSummary(
        topicProgress
      );

    const activeErrors =
      errors.filter(
        (e: any) =>
          (
            equivalentIds.includes(
              e.topicId
            ) ||
            equivalentIds.includes(
              e.subtopicId
            )
          ) &&
          e.status !==
            "consolidado"
      );

    const due =
      reviews.some(
        (r: any) =>
          (
            equivalentIds.includes(
              r.topicId
            ) ||
            equivalentIds.includes(
              r.sourceId
            )
          ) &&
          asMillis(
            r.scheduledFor
          ) <= now
      );

    const studied =
      topicSessions.length > 0 ||
      summary.answered > 0;

    let status:
      | "pendente"
      | "andamento"
      | "revisao"
      | "fragil"
      | "dominado" =
      "pendente";

    if (studied) {
      if (due) {
        status = "revisao";
      } else if (
        (
          summary.answered >= 5 &&
          summary.accuracy < 60
        ) ||
        activeErrors.some(
          (e: any) =>
            Number(
              e.recurrence || 1
            ) >= 2
        )
      ) {
        status = "fragil";
      } else if (
        summary.answered >= 15 &&
        summary.accuracy >= 80 &&
        summary.evidence >= 50
      ) {
        status = "dominado";
      } else {
        status = "andamento";
      }
    }

    states[topic.id] = {
      status,
      studied,
      mastery:
        summary.accuracy,
      evidence:
        summary.evidence,
      answered:
        summary.answered,
      activeErrors:
        activeErrors.length,
      dueReview: due,
      lastStudyAt:
        Math.max(
          0,
          ...topicSessions.map(
            r =>
              asMillis(
                r.createdAt
              )
          )
        ),
    };
  }

  return states;
}
