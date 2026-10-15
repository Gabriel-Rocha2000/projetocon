import { NextResponse } from "next/server";
import pdf from "pdf-parse";
import { createHash } from "crypto";

export const runtime = "nodejs";

function clean(text: string) {
  return text.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function parseAlternatives(chunk: string) {
  const alternatives: Record<string,string> = {};
  const matches = [...chunk.matchAll(/(?:^|\n)\s*([A-E])\s*[\)\.\-:]\s*([^\n]+(?:\n(?!\s*[A-E]\s*[\)\.\-:])[^\n]+)*)/gim)];
  for (const match of matches) alternatives[match[1].toUpperCase()] = clean(match[2]).slice(0, 1600);
  return alternatives;
}

function extractAnswer(chunk: string) {
  const direct = chunk.match(/(?:gabarito|resposta|answer)\s*[:\-]\s*([A-E]|CERTO|ERRADO|C|E)\b/i);
  if (direct) return direct[1].toUpperCase().replace("CERTO","C").replace("ERRADO","E");
  return "";
}

function splitQuestions(raw: string) {
  const text = clean(raw);
  const marker = /(?:^|\n)\s*(?:QUEST(?:Ã|A)O\s*)?(\d{1,4})\s*[\.\)\-:]\s+/gim;
  const found = [...text.matchAll(marker)];
  const rows: any[] = [];
  for (let i=0;i<found.length;i++) {
    const start = (found[i].index || 0) + found[i][0].length;
    const end = i+1 < found.length ? (found[i+1].index || text.length) : text.length;
    const chunk = clean(text.slice(start,end));
    if (chunk.length < 40) continue;
    const alternatives = parseAlternatives(`\n${chunk}`);
    let statement = chunk;
    const firstAlt = chunk.search(/\n\s*[A-E]\s*[\)\.\-:]\s*/i);
    if (firstAlt > 0) statement = clean(chunk.slice(0, firstAlt));
    const answer = extractAnswer(chunk);
    rows.push({
      number: Number(found[i][1]),
      statement: statement.slice(0, 5000),
      alternatives,
      correctAnswer: answer,
      questionType: Object.keys(alternatives).length ? "multipla_escolha" : "certo_errado",
      rawText: chunk.slice(0, 7000),
    });
  }
  return rows;
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Envie um PDF." }, { status: 400 });
    if (!file.name.toLowerCase().endsWith(".pdf")) return NextResponse.json({ error: "O arquivo precisa ser PDF." }, { status: 400 });
    const bytes = Buffer.from(await file.arrayBuffer());
    const parsed = await pdf(bytes);
    const fileHash = createHash("sha256").update(bytes).digest("hex");
    const allQuestions = splitQuestions(parsed.text || "");
    const truncated = allQuestions.length > 500;
    const questions = allQuestions.slice(0, 500);
    return NextResponse.json({
      fileName: file.name,
      fileHash,
      pages: parsed.numpages || null,
      textPreview: clean(parsed.text || "").slice(0, 6000),
      questionCount: questions.length,
      questions,
      warning: `${truncated ? `ATENÇÃO: ${allQuestions.length - 500} questões excedentes ficaram fora desta prévia experimental. Use CSV validado para importar todas. ` : ""}A extração de questões de PDF é heurística. Confira disciplina, tema e gabarito antes de salvar.`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Não foi possível processar o PDF de questões." }, { status: 500 });
  }
}
