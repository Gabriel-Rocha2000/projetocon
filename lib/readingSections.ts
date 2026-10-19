import type { ContentBlock } from "@/types";

export type ReadingSection = {
  id: string;
  title: string;
  blocks: ContentBlock[];
  pageStart: number | null;
  pageEnd: number | null;
  order: number;
};

const PILOT_DC_A00 = [
  { title: "Fundamentos e evolução", first: 1, last: 5 },
  { title: "Eficácia, limites e aplicabilidade", first: 6, last: 10 },
  { title: "Tratados internacionais e TPI", first: 11, last: 12 },
  { title: "Artigo 5º: fundamentos e igualdade", first: 13, last: 16 },
  { title: "Liberdades e privacidade", first: 17, last: 24 },
  { title: "Reunião e associação", first: 25, last: 26 },
  { title: "Propriedade e criações", first: 27, last: 32 },
];

function pilotSection(block: ContentBlock) {
  const match = /^DC_CGU_PASSO_A00_B(\d{3})$/.exec(block.id.replace(/^.*__/, ""));
  if (!match) return null;
  const number = Number(match[1]);
  const index = PILOT_DC_A00.findIndex(s => number >= s.first && number <= s.last);
  if (index < 0) return null;
  return { id: `DC_CGU_PASSO_A00_SEC${String(index + 1).padStart(2, "0")}`, title: PILOT_DC_A00[index].title, order: index + 1 };
}

export function buildReadingSections(blocks: ContentBlock[]): ReadingSection[] {
  const sorted = blocks.filter(b => b.archived !== true).sort((a,b) => a.order-b.order || (a.sourcePageStart ?? 99999)-(b.sourcePageStart ?? 99999) || a.id.localeCompare(b.id));
  const grouped = new Map<string, ReadingSection>();
  for (const block of sorted) {
    const pilot = pilotSection(block);
    const id = block.sectionId?.trim() || pilot?.id || `material:${block.materialId || "sem-material"}:continua`;
    const title = block.sectionTitle?.trim() || pilot?.title || "Leitura contínua da apostila";
    const order = block.sectionOrder ?? pilot?.order ?? 1;
    const key = `${block.materialId || "sem-material"}::${id}`;
    if (!grouped.has(key)) grouped.set(key, { id: key, title, order, pageStart: null, pageEnd: null, blocks: [] });
    const section = grouped.get(key)!;
    section.blocks.push(block);
    if (block.sourcePageStart != null) section.pageStart = section.pageStart == null ? block.sourcePageStart : Math.min(section.pageStart,block.sourcePageStart);
    if (block.sourcePageEnd != null) section.pageEnd = section.pageEnd == null ? block.sourcePageEnd : Math.max(section.pageEnd,block.sourcePageEnd);
  }
  return [...grouped.values()].sort((a,b) => a.order-b.order || (a.pageStart??99999)-(b.pageStart??99999));
}
