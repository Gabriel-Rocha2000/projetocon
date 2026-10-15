import { NextResponse } from "next/server";
import pdf from "pdf-parse";
import { createHash } from "crypto";

export const runtime = "nodejs";

type Candidate = {
  id: string;
  disciplina: string;
  titulo: string;
  texto_original: string;
  nivel: "topic" | "subtopic";
  parent_id: string;
  conteudo_id: string;
  ordem: number;
  tags: string;
  confidence: "alta" | "media" | "baixa";
};

function cleanLine(line: string) {
  return line.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function isNoise(line: string) {
  return !line || /^\d+$/.test(line) || /^p[áa]gina\s+\d+/i.test(line) || /^https?:\/\//i.test(line);
}

function looksDiscipline(line: string) {
  if (line.length < 4 || line.length > 95) return false;
  if (/^(ANEXO|EDITAL|CAP[IÍ]TULO|SE[CÇ][AÃ]O|T[IÍ]TULO|DAS? |DOS? )/i.test(line)) return false;
  const letters = line.replace(/[^A-Za-zÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç]/g, "");
  if (letters.length < 4) return false;
  const upper = letters.replace(/[^A-ZÁÉÍÓÚÂÊÔÃÕÇ]/g, "").length / letters.length;
  return upper > 0.82 && !/[.;]$/.test(line);
}

function parse(raw: string) {
  const lines = raw.split(/\r?\n/).map(cleanLine).filter(line => !isNoise(line));
  const candidates: Candidate[] = [];
  let discipline = "Geral";
  let order = 0;
  let parent = "";

  for (const line of lines) {
    if (looksDiscipline(line)) {
      discipline = line.replace(/^\d+(?:\.\d+)*\s*[-–—:]?\s*/, "").trim();
      parent = "";
      continue;
    }

    const numbered = line.match(/^(\d+(?:\.\d+)+|\d+)\s*[.\-–—)]\s*(.{5,})$/);
    const bullet = line.match(/^(?:[-•]|[a-z]\)|[IVXLCDM]+\s*[-–—])\s*(.{8,})$/i);
    if (!numbered && !bullet) continue;

    order += 1;
    const local = numbered?.[1] || `ITEM-${order}`;
    const text = cleanLine(numbered?.[2] || bullet?.[1] || line);
    const level = numbered && local.includes(".") ? "subtopic" : "topic";
    if (level === "topic") parent = local;
    candidates.push({
      id: local,
      disciplina: discipline,
      titulo: text.length > 115 ? `${text.slice(0, 112)}…` : text,
      texto_original: text,
      nivel: level,
      parent_id: level === "subtopic" ? parent : "",
      conteudo_id: "",
      ordem: order,
      tags: "",
      confidence: numbered ? (discipline === "Geral" ? "media" : "alta") : "baixa",
    });
  }

  // Se o PDF não tem numeração clara, não fabricamos hierarquia: devolvemos trechos para conferência.
  if (candidates.length < 5) {
    const fallback = lines.filter(line => line.length >= 20 && line.length <= 350).slice(0, 200);
    return fallback.map((line, index) => ({
      id: `REVISAR-${index + 1}`,
      disciplina: "A revisar",
      titulo: line.length > 115 ? `${line.slice(0, 112)}…` : line,
      texto_original: line,
      nivel: "topic" as const,
      parent_id: "",
      conteudo_id: "",
      ordem: index + 1,
      tags: "",
      confidence: "baixa" as const,
    }));
  }
  return candidates.slice(0, 600);
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
    const rows = parse(parsed.text || "");
    const lowConfidence = rows.filter(row => row.confidence === "baixa").length;
    return NextResponse.json({ fileName: file.name, fileHash, pages: parsed.numpages || null, rows, lowConfidence, warning: lowConfidence ? `${lowConfidence} item(ns) precisam de conferência manual. Nenhuma classificação incerta foi confirmada automaticamente.` : null });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Não foi possível processar o edital." }, { status: 500 });
  }
}
