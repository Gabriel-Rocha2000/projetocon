export type ErrorType =
  | "desconhecimento"
  | "confusao_conceitual"
  | "interpretacao"
  | "distracao"
  | "decoreba"
  | "calculo"
  | "pegadinha"
  | "extrapolacao"
  | "restricao"
  | "literalidade";

export type StudyType = "pdf" | "videoaula" | "questoes" | "lei_seca" | "revisao" | "resumo";
export type Difficulty = "facil" | "medio" | "dificil";
export type DayPeriod = "manha" | "almoco" | "noite" | "agora";
export type PlanTaskType = "estudo" | "questoes" | "revisao" | "lei_seca";
export type LawStatus = "vigente" | "revogado" | "historico" | "revisar";
export type AnswerConfidence = "sabia" | "entre_duas" | "chutei";
export type StudyMode = "normal" | "reta_final";

export interface Contest {
  id: string;
  name: string;
  organ: string;
  role?: string;
  board?: string;
  year?: number;
  examDate?: string | null;
  status: "ativo" | "planejado" | "encerrado";
  priority: "alta" | "media" | "baixa";
  currentVersionId?: string | null;
}

export interface Topic {
  id: string;
  contestId: string;
  discipline: string;
  parentTopicId?: string | null;
  canonicalContentId?: string | null;
  title: string;
  originalText: string;
  level: "topic" | "subtopic";
  tags: string[];
  order: number;
  editalVersionId?: string | null;
  activeInCurrentEdital?: boolean;
}

export interface ContestVersion {
  id: string;
  contestId: string;
  label: string;
  sourceType: "csv" | "pdf" | "manual";
  sourceName?: string | null;
  sourceDate?: string | null;
  importedAt?: unknown;
  itemCount: number;
  status: "rascunho" | "atual" | "arquivada";
  previousVersionId?: string | null;
  detectedLaws?: string[];
}

export interface EditalItem {
  id: string;
  contestId: string;
  versionId: string;
  localId: string;
  discipline: string;
  parentLocalId?: string | null;
  canonicalContentId?: string | null;
  title: string;
  originalText: string;
  level: "topic" | "subtopic";
  tags: string[];
  order: number;
  status: "ativo" | "removido" | "alterado";
}

export interface ContentNode {
  id: string;
  canonicalContentId?: string | null;
  discipline: string;
  title: string;
  text: string;
  sourceLabel?: string | null;
  sourcePage?: string | null;
  updatedAt?: unknown;
}

export interface Material {
  id: string;
  contestId?: string | null;
  discipline?: string | null;
  title: string;
  sourceName?: string | null;
  fileName?: string | null;
  fileHash?: string | null;
  storagePath?: string | null;
  importedAt?: unknown;
  pageCount?: number | null;
  type: "pdf" | "texto";
}

export interface ContentBlock {
  id: string;
  contentId: string;
  topicId?: string | null;
  materialId?: string | null;
  discipline: string;
  title: string;
  text: string;
  order: number;
  sourcePageStart?: number | null;
  sourcePageEnd?: number | null;
  estimatedMinutes?: number | null;
  sectionId?: string | null;
  sectionTitle?: string | null;
  sectionOrder?: number | null;
  tags?: string[];
  archived?: boolean;
}

export interface Question {
  id: string;
  contestId: string;
  discipline: string;
  topicId: string;
  subtopicId?: string | null;
  contentBlockId?: string | null;
  contentBlockIds?: string[];
  subject: string;
  subsubject?: string | null;
  board: string;
  organ?: string;
  examName?: string;
  year?: number;
  questionType: "certo_errado" | "multipla_escolha";
  statement: string;
  alternatives?: Record<string, string>;
  correctAnswer: string;
  difficulty?: "facil" | "media" | "dificil";
  tags: string[];
  sourceName?: string;
  sourcePage?: number | null;
  materialId?: string | null;
  lawIds?: string[];
  legalRefs?: string[];
  relatedContent?: string | null;
  explanation?: string | null;
}

export interface LawDocument {
  id: string;
  contestId: string;
  lawName: string;
  lawNumber?: string | null;
  lawDate?: string | null;
  title?: string | null;
  sourceName: string;
  sourceUrl?: string | null;
  fileName?: string | null;
  fileHash?: string | null;
  importedAt?: unknown;
  itemCount?: number;
  reviewCount?: number;
}

export interface LawItem {
  id: string;
  contestId: string;
  lawDocumentId?: string | null;
  parentLawId?: string | null;
  lawName: string;
  reference: string;
  stableRef?: string | null;
  level?: "artigo" | "paragrafo" | "inciso" | "alinea";
  status?: LawStatus;
  article?: string | null;
  paragraph?: string | null;
  inciso?: string | null;
  alinea?: string | null;
  order?: number;
  text: string;
  officialText?: string | null;
  sourceUrl?: string | null;
  sourcePage?: number | null;
  topicId?: string | null;
  subtopicId?: string | null;
  tags: string[];
  notes?: string | null;
}

export interface StudySettings {
  morningMinutes: number;
  lunchMinutes: number;
  eveningMinutes: number;
  defaultQuestionTarget: number;
  mode?: StudyMode;
}

export interface DailyPlanTask {
  id: string;
  type: PlanTaskType;
  period: DayPeriod;
  discipline: string;
  topicId?: string | null;
  contentBlockId?: string | null;
  title: string;
  durationMinutes: number;
  questionTarget?: number;
  reason: string;
  sourceId?: string | null;
  sourceType?: "question" | "topic" | "law" | "content_block" | null;
  status: "pendente" | "concluida" | "ignorada";
  completedDifficulty?: Difficulty | null;
}

export interface DailyPlan {
  id: string;
  contestId: string;
  dateKey: string;
  generatedAt?: unknown;
  settings: StudySettings;
  tasks: DailyPlanTask[];
}

export interface DisciplineStat {
  discipline: string;
  coverage: number;
  mastery: number;
  evolution: number;
  studiedTopics: number;
  totalTopics: number;
  answered: number;
  errors: number;
  evidence: number;
  fragileCoverage: number;
}

export interface RiskItem {
  id: string;
  discipline: string;
  title: string;
  severity: "alta" | "media" | "baixa";
  reason: string;
  topicId?: string | null;
}

export interface ResumeItem {
  id: string;
  type: "conteudo" | "questoes" | "lei" | "revisao";
  title: string;
  subtitle: string;
  href: string;
}

export interface DashboardData {
  totalMinutes: number;
  questionsAnswered: number;
  accuracy: number;
  totalErrors: number;
  activeErrors: number;
  consolidatedErrors: number;
  recurringErrors: number;
  dueReviews: number;
  dueLaw: number;
  coverage: number;
  mastery: number;
  evidence: number;
  disciplineStats: DisciplineStat[];
  errorByDiscipline: Record<string, number>;
  risks: RiskItem[];
  resumeItems: ResumeItem[];
  confidenceBreakdown: { sabia: number; entreDuas: number; chutei: number };
}
