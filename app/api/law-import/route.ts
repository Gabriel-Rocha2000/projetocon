import { NextResponse } from "next/server";
import pdf from "pdf-parse";
import { createHash } from "crypto";

export const runtime = "nodejs";

type ParsedItem = {
  tempId: string;
  reference: string;
  level: "artigo" | "paragrafo" | "inciso" | "alinea";
  article: string | null;
  paragraph: string | null;
  inciso: string | null;
  alinea: string | null;
  text: string;
  status: "vigente" | "revogado" | "historico" | "revisar";
  order: number;
};

function cleanLine(line: string) {
  return line.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function slug(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "").toUpperCase();
}

function detectStatus(text: string): ParsedItem["status"] {
  const low = text.toLowerCase();
  if (low.includes("revogado") || low.includes("revogada")) return "revogado";
  if (low.includes("execução suspensa") || low.includes("execucao suspensa")) return "historico";
  if (low.includes("vigência encerrada") || low.includes("vigencia encerrada")) return "historico";
  return "vigente";
}

function parseLegalText(rawText: string) {
  const lines = rawText.split(/\r?\n/).map(cleanLine).filter(Boolean)
    .filter(line => !/^https?:\/\//i.test(line))
    .filter(line => !/^\d+\/\d+$/i.test(line))
    .filter(line => !/^\d{2}\/\d{2}\/\d{4},\s*\d{2}:\d{2}\b/i.test(line))
    .filter(line => !/^L\d+consol$/i.test(line))
    .filter(line => !/^\d+$/i.test(line));

  const joined = lines.join("\n");
  const lawMatch = joined.match(/LEI\s+N[º°o]?\s*([\d.]+)\s*,\s*DE\s*([^\n]+)/i);
  const lawNumber = lawMatch?.[1] || null;
  const lawDate = lawMatch?.[2]?.trim() || null;
  const lawName = lawNumber ? `Lei ${lawNumber}` : "Lei importada";
  const sourceName = /planalto\.gov\.br/i.test(rawText) ? "Presidência da República / Planalto" : "PDF informado pelo usuário";

  let title: string | null = null;
  const titleIndex = lines.findIndex(line => /^Dispõe sobre/i.test(line));
  if (titleIndex >= 0) title = lines.slice(titleIndex, Math.min(titleIndex + 3, lines.length)).join(" ");

  const items: ParsedItem[] = [];
  let currentArticle: string | null = null;
  let currentParagraph: string | null = null;
  let currentInciso: string | null = null;
  let current: ParsedItem | null = null;
  let order = 0;

  function pushCurrent() {
    if (!current) return;
    current.text = cleanLine(current.text);
    current.status = detectStatus(current.text);
    if (current.text.length > 3) items.push(current);
    current = null;
  }

  for (const line of lines) {
    if (/^(Título|Capítulo|Seção|Subseção)\b/i.test(line)) {
      pushCurrent();
      continue;
    }
    const article = line.match(/^Art\.\s*(\d+(?:-[A-Za-z])?)[ºo°]?\.?\s*(.*)$/i);
    const paragraph = line.match(/^(§\s*([\d]+)[ºo°]?|Parágrafo único\.)\s*(.*)$/i);
    const inciso = line.match(/^([IVXLCDM]+)\s*[-–—]\s*(.*)$/);
    const alinea = line.match(/^([a-z])\)\s*(.*)$/i);

    if (article) {
      pushCurrent();
      currentArticle = article[1]; currentParagraph = null; currentInciso = null;
      order++;
      current = { tempId: `ART_${slug(currentArticle)}_${order}`, reference: `Art. ${currentArticle}`, level: "artigo", article: currentArticle, paragraph: null, inciso: null, alinea: null, text: `Art. ${currentArticle} ${article[2]}`.trim(), status: "vigente", order };
      continue;
    }
    if (paragraph && currentArticle) {
      pushCurrent();
      currentParagraph = paragraph[1].toLowerCase().startsWith("parágrafo") ? "único" : paragraph[2]; currentInciso = null;
      order++;
      const ref = currentParagraph === "único" ? `Art. ${currentArticle}, parágrafo único` : `Art. ${currentArticle}, § ${currentParagraph}º`;
      current = { tempId: `ART_${slug(currentArticle)}_PAR_${slug(currentParagraph || "")}_${order}`, reference: ref, level: "paragrafo", article: currentArticle, paragraph: currentParagraph, inciso: null, alinea: null, text: line, status: "vigente", order };
      continue;
    }
    if (inciso && currentArticle) {
      pushCurrent();
      currentInciso = inciso[1];
      order++;
      current = { tempId: `ART_${slug(currentArticle)}_INC_${currentInciso}_${order}`, reference: `Art. ${currentArticle}, ${currentInciso}`, level: "inciso", article: currentArticle, paragraph: currentParagraph, inciso: currentInciso, alinea: null, text: line, status: "vigente", order };
      continue;
    }
    if (alinea && currentArticle && currentInciso) {
      pushCurrent();
      order++;
      current = { tempId: `ART_${slug(currentArticle)}_INC_${currentInciso}_AL_${alinea[1]}_${order}`, reference: `Art. ${currentArticle}, ${currentInciso}, ${alinea[1]})`, level: "alinea", article: currentArticle, paragraph: currentParagraph, inciso: currentInciso, alinea: alinea[1].toLowerCase(), text: line, status: "vigente", order };
      continue;
    }

    if (current && !/^(Título|Capítulo|Seção|Subseção)\b/i.test(line)) current.text += ` ${line}`;
  }
  pushCurrent();

  // PDFs consolidados costumam manter várias redações do mesmo dispositivo.
  // Mantemos todas para auditoria e usamos a última versão não revogada como vigente.
  const groups = new Map<string, ParsedItem[]>();
  for (const item of items) {
    const key = `${item.level}|${item.article || ""}|${item.paragraph || ""}|${item.inciso || ""}|${item.alinea || ""}`;
    groups.set(key, [...(groups.get(key) || []), item]);
  }
  for (const group of groups.values()) {
    if (group.length <= 1) continue;
    const candidates = group.filter(item => item.status !== "revogado" && item.status !== "historico");
    const currentItem = candidates[candidates.length - 1];
    for (const item of group) {
      if (item !== currentItem && item.status === "vigente") item.status = "historico";
    }
  }

  const ambiguous = items.filter(item => /\b(vide|redação dada|incluído pela|alterado pela|medida provisória)\b/i.test(item.text) && item.status === "vigente");
  for (const item of ambiguous) {
    // A última redação pode ser vigente; a interface mostra o alerta para conferência.
    // Não mudamos o texto original em hipótese alguma.
    if (!item.text.match(/Redação dada/i) && /\bVide\b/i.test(item.text)) item.status = "revisar";
  }

  return { meta: { lawName, lawNumber, lawDate, title, sourceName }, items };
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Envie um PDF." }, { status: 400 });
    if (!file.name.toLowerCase().endsWith(".pdf")) return NextResponse.json({ error: "O arquivo precisa ser PDF." }, { status: 400 });
    const bytes = Buffer.from(await file.arrayBuffer());
    const parsed = await pdf(bytes);
    const result = parseLegalText(parsed.text || "");
    const fileHash = createHash("sha256").update(bytes).digest("hex");
    return NextResponse.json({ ...result, fileName: file.name, fileHash, pages: parsed.numpages || null });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Não foi possível processar o PDF." }, { status: 500 });
  }
}
