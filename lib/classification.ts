import { Topic } from "@/types";

const STOP = new Set(["de","da","do","das","dos","e","em","a","o","as","os","para","por","com","que","um","uma","no","na","nos","nas","ao","aos"]);

export function normalizedWords(value: string) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(w => w.length > 2 && !STOP.has(w));
}

export function slug(value: string) {
  return String(value || "GERAL").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80) || "GERAL";
}

const DISCIPLINE_HINTS: Record<string, string[]> = {
  "Administração Financeira e Orçamentária": ["afo", "administracao financeira orcamentaria", "orcamento publico", "ppa", "ldo", "loa", "creditos adicionais", "receita publica", "despesa publica", "lei 4320"],
  "Língua Portuguesa": ["portugues", "lingua portuguesa", "gramatica", "interpretacao de texto", "sintaxe", "regencia", "crase", "concordancia"],
  "Direito Administrativo": ["direito administrativo", "atos administrativos", "poderes administrativos", "agentes publicos", "processo administrativo"],
  "Direito Constitucional": ["direito constitucional", "constituicao federal", "controle de constitucionalidade", "direitos fundamentais"],
  "Raciocínio Lógico": ["raciocinio logico", "logica", "proposicoes", "conjuntos", "probabilidade"],
  "Informática": ["informatica", "windows", "linux", "excel", "word", "seguranca da informacao", "redes"],
};

function phraseScore(text: string, phrase: string) {
  const target = phrase.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (!text.includes(target)) return 0;
  const size = normalizedWords(phrase).length;
  return target.length <= 5 ? 10 : Math.max(5, size * 3);
}

export function disciplineCandidates(input: string, topics: Topic[], limit = 6) {
  const text = String(input || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const words = new Set(normalizedWords(text));
  const disciplines = Array.from(new Set([...topics.map(t => t.discipline).filter(Boolean), ...Object.keys(DISCIPLINE_HINTS)]));
  const rows = disciplines.map(discipline => {
    let score = 0;
    const disciplineWords = normalizedWords(discipline);
    disciplineWords.forEach(w => { if (words.has(w)) score += 2; });
    score += phraseScore(text, discipline);
    (DISCIPLINE_HINTS[discipline] || []).forEach(hint => { score += phraseScore(text, hint); });
    const topicMatches = topics.filter(t => t.discipline === discipline).slice(0, 80).reduce((sum, topic) => {
      const needles = normalizedWords(`${topic.title} ${topic.originalText} ${(topic.tags || []).join(" ")}`);
      return sum + Math.min(4, needles.filter(w => words.has(w)).length);
    }, 0);
    score += Math.min(12, topicMatches);
    return { discipline, score };
  }).filter(x => x.score > 0).sort((a,b) => b.score - a.score).slice(0, limit);
  const top = rows[0]?.score || 0;
  const second = rows[1]?.score || 0;
  return rows.map((row, index) => {
    const margin = index === 0 ? top - second : row.score - (rows[index + 1]?.score || 0);
    const absolute = 35 + row.score * 3 + Math.max(0, margin) * 2;
    const relativePenalty = index === 0 || !top ? 0 : Math.round((1 - row.score / top) * 25);
    return { ...row, confidence: Math.max(25, Math.min(98, Math.round(absolute - relativePenalty))) };
  });
}

export function classifyTopic(input: string, discipline: string, topics: Topic[]) {
  const hay = new Set(normalizedWords(input));
  const candidates = topics.filter(t => t.discipline === discipline);
  const scored = candidates.map(topic => {
    const needles = normalizedWords(`${topic.title} ${topic.originalText} ${(topic.tags || []).join(" ")}`);
    const overlap = needles.filter(w => hay.has(w));
    const titleWords = normalizedWords(topic.title);
    const titleOverlap = titleWords.filter(w => hay.has(w)).length;
    const score = overlap.length + titleOverlap * 2;
    return { topic, score };
  }).filter(x => x.score > 0).sort((a,b) => b.score - a.score);
  const best = scored[0];
  const second = scored[1];
  if (!best) return { topicId: "", confidence: 0, alternatives: [] as Topic[] };
  const margin = best.score - (second?.score || 0);
  const confidence = Math.max(45, Math.min(98, 55 + best.score * 6 + margin * 5));
  return { topicId: best.topic.id, confidence, alternatives: scored.slice(0,4).map(x => x.topic) };
}
