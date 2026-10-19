import { NextResponse } from "next/server";
import pdf from "pdf-parse";
import { createHash } from "crypto";

export const runtime = "nodejs";

function clean(text: string) {
  return text.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function splitIntoBlocks(raw: string) {
  const text = clean(raw);
  const paragraphs = text.split(/\n\s*\n|(?=\n(?:\d+(?:\.\d+)*\s+)?[A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ\s\-–—:]{5,}\n)/g).map(clean).filter(x => x.length > 20);
  const blocks: Array<{ title: string; text: string; order: number; estimatedMinutes: number }> = [];
  let buffer = "";
  let title = "Bloco inicial";

  const flush = () => {
    const body = clean(buffer);
    if (body.length < 40) { buffer = ""; return; }
    const words = body.split(/\s+/).length;
    blocks.push({ title, text: body, order: blocks.length + 1, estimatedMinutes: Math.max(3, Math.min(12, Math.ceil(words / 170))) });
    buffer = "";
  };

  for (const paragraph of paragraphs) {
    const firstLine = paragraph.split("\n")[0].trim();
    const headingLike = firstLine.length <= 100 && (firstLine === firstLine.toUpperCase() || /^\d+(?:\.\d+)*\s+/.test(firstLine));
    if (headingLike && buffer.length > 950) {
      flush();
      title = firstLine.replace(/^\d+(?:\.\d+)*\s+/, "").slice(0, 90) || `Bloco ${blocks.length + 1}`;
      buffer = paragraph;
      continue;
    }
    // Preserve explanations with definitions, examples and exceptions; only split at paragraph
    // boundaries and avoid producing isolated fragments from a single concept.
    if (buffer.length >= 1800 && buffer.length + paragraph.length > 4500) flush();
    if (!buffer && headingLike) title = firstLine.replace(/^\d+(?:\.\d+)*\s+/, "").slice(0, 90) || `Bloco ${blocks.length + 1}`;
    buffer += `${buffer ? "\n\n" : ""}${paragraph}`;
  }
  flush();
  return blocks;
}

export async function POST(request: Request) {
  try {
    // PDFs grandes são enviados primeiro ao Firebase Storage pelo navegador.
    // A API recebe apenas um link temporário de download, evitando HTTP 413
    // (limite do corpo das requisições em plataformas serverless).
    const input = await request.json().catch(() => null);
    const sourceUrl = String(input?.url || "");
    const fileName = String(input?.fileName || "");
    if (!fileName.toLowerCase().endsWith(".pdf")) return NextResponse.json({ error: "Envie um PDF." }, { status: 400 });
    let url: URL;
    try { url = new URL(sourceUrl); }
    catch { return NextResponse.json({ error: "URL de material inválida." }, { status: 400 }); }
    const allowed = url.protocol === "https:" &&
      url.hostname === "firebasestorage.googleapis.com" &&
      url.pathname.startsWith("/v0/b/") && url.pathname.includes("/o/") &&
      decodeURIComponent(url.pathname).includes("/users/") &&
      decodeURIComponent(url.pathname).includes("/materials/");
    if (!allowed) return NextResponse.json({ error: "O PDF deve estar no Firebase Storage do projeto." }, { status: 400 });
    const response = await fetch(url.toString(), { signal: AbortSignal.timeout(60000), redirect: "error" });
    if (!response.ok) return NextResponse.json({ error: "Não foi possível ler o PDF armazenado." }, { status: 502 });
    const length = Number(response.headers.get("content-length") || 0);
    if (length > 30 * 1024 * 1024) return NextResponse.json({ error: "PDF acima do limite de 30 MB para processamento experimental." }, { status: 413 });
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 30 * 1024 * 1024) return NextResponse.json({ error: "PDF acima do limite de 30 MB." }, { status: 413 });
    const parsed = await pdf(bytes);
    const fileHash = createHash("sha256").update(bytes).digest("hex");
    const allBlocks = splitIntoBlocks(parsed.text || "");
    const truncated = allBlocks.length > 250;
    const blocks = allBlocks.slice(0, 250);
    return NextResponse.json({ fileName, fileHash, pages: parsed.numpages || null, blockCount: blocks.length, blocks, warning: `${truncated ? `ATENÇÃO: ${allBlocks.length - 250} blocos excedentes não foram incluídos nesta prévia experimental. Use CSV validado para uma importação completa. ` : ""}Os microblocos agora agrupam trechos maiores para preservar contexto; confira cada bloco antes de salvar. O texto original não é resumido nem reescrito.` });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Não foi possível processar o material." }, { status: 500 });
  }
}
