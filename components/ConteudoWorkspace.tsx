"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Papa from "papaparse";
import AppShell from "@/components/AppShell";
import NewMicroblockForm from "@/components/NewMicroblockForm";
import HierarchyIndex, { HierarchyIndexNode } from "@/components/HierarchyIndex";
import { useAuth } from "@/contexts/AuthContext";
import { useContest } from "@/contexts/ContestContext";
import { addTopic, deleteContentBlock, deleteMaterialImport, deleteUnusedDiscipline, getAllTopics, getContentBlockProgress, getContentBlocksByMaterial, getMaterials, getQuestions, getTopics, saveContentBlocks, saveMaterial, renameContestDiscipline, setDisciplineActiveStatus } from "@/services/firestore";
import { deleteMaterialFile, uploadMaterialFile } from "@/services/storage";
import { getDownloadURL, ref } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { classifyTopic, disciplineCandidates, slug } from "@/lib/classification";
import { ContentBlock, Material, Question, Topic } from "@/types";

export default function ConteudoPage() {
  const router = useRouter();
  const pathname = usePathname();
  const isDeveloper = pathname.startsWith("/desenvolvedor/");
  const { user } = useAuth();
  const { activeContestId } = useContest();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [allTopics, setAllTopics] = useState<Topic[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [scope, setScope] = useState<"contest"|"library">("contest");
  const [search, setSearch] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [draft, setDraft] = useState<any[]>([]);
  const [draftMeta, setDraftMeta] = useState<any | null>(null);
  const [draftFile, setDraftFile] = useState<File | null>(null);
  const [detectedDiscipline, setDetectedDiscipline] = useState("");
  const [disciplineConfidence, setDisciplineConfidence] = useState(0);
  const [createUnmapped, setCreateUnmapped] = useState(false);
  const [message, setMessage] = useState("");
  const [managedMaterial, setManagedMaterial] = useState<Material | null>(null);
  const [managedBlocks, setManagedBlocks] = useState<ContentBlock[]>([]);
  const [managedDiscipline, setManagedDiscipline] = useState("");
  const [materialSearch, setMaterialSearch] = useState("");
  const [materialDiscipline, setMaterialDiscipline] = useState("");
  const [showMaterialManager, setShowMaterialManager] = useState(false);
  const [showDisciplineManager, setShowDisciplineManager] = useState(false);
  const [savingManagement, setSavingManagement] = useState(false);
  const [blockStudyIds, setBlockStudyIds] = useState<string[]>([]);
  const [blockSearch, setBlockSearch] = useState("");
  const [blockLimit, setBlockLimit] = useState(40);

  async function load() {
    const [ts, ms, qs] = await Promise.all([getTopics(activeContestId), getMaterials(activeContestId), getQuestions(activeContestId)]);
    setTopics(ts); setAllTopics(ts); setMaterials(ms); setQuestions(qs);
  }
  useEffect(() => { load(); }, [activeContestId]);

  const activeDisciplines = Array.from(new Set(topics.map(t => t.discipline).filter(Boolean))).sort();
  const libraryDisciplines = Array.from(new Set(allTopics.map(t => t.discipline).filter(Boolean))).sort();
  const catalogDisciplines = Array.from(new Set([...libraryDisciplines, "Administração Financeira e Orçamentária", "Língua Portuguesa", "Direito Administrativo", "Direito Constitucional", "Raciocínio Lógico", "Informática"])).sort();

  async function openLibrary() {
    setScope("library");
    try { setAllTopics(await getAllTopics()); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Erro ao consultar biblioteca."); }
  }

  async function renameDiscipline(discipline: string) {
    if (savingManagement) return;
    const target = window.prompt(`Novo nome para "${discipline}" apenas no concurso ativo:`, discipline)?.trim();
    if (!target || target === discipline) return;
    const hasTarget = topics.some(t => t.discipline === target);
    if (!window.confirm(`Padronizar "${discipline}" para "${target}" somente neste edital? Isso altera a classificação de seus tópicos e questões, sem mudar seus IDs, histórico ou outros editais.${hasTarget ? " Atenção: a disciplina de destino já existe; confira possíveis tópicos repetidos depois." : ""}`)) return;
    setSavingManagement(true);
    try {
      const result = await renameContestDiscipline(activeContestId, discipline, target);
      await load();
      setMessage(`Classificação alterada neste edital: ${result.topics} tópicos e ${result.questions} questões. Histórico e IDs preservados.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao padronizar disciplina.");
    } finally { setSavingManagement(false); }
  }

  function reclassify(rows: any[], discipline: string) {
    return rows.map(block => {
      const result = classifyTopic(`${block.title}\n${block.text}`, discipline, allTopics);
      return { ...block, topicId: result.confidence >= 65 ? result.topicId : "", confidence: result.confidence, alternatives: result.alternatives?.map((x:Topic)=>x.id) || [] };
    });
  }

  async function parseMaterial(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    // Permite selecionar novamente o mesmo PDF depois de um erro.
    event.target.value = "";
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setMessage("Escolha um arquivo PDF válido."); return;
    }
    if (!user) { setMessage("Faça login para importar um PDF."); return; }
    if (file.size > 30 * 1024 * 1024) { setMessage("PDF acima do limite experimental de 30 MB. Utilize o CSV validado."); return; }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000);
    setMessage("Enviando PDF para o armazenamento do projeto...");
    setDraftFile(file);
    try {
      const uploaded = await uploadMaterialFile(user.uid, file);
      const url = await getDownloadURL(ref(storage, uploaded.path));
      setMessage("PDF enviado. Lendo e separando os microblocos...");
      const res = await fetch("/api/material-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, fileName: file.name }),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setMessage(data?.error || `Falha no processamento do PDF (HTTP ${res.status}). Use o CSV validado.`);
        return;
      }
      if (!Array.isArray(data?.blocks) || !data.blocks.length) {
        setMessage("O PDF foi lido, mas não foram detectados blocos utilizáveis. Use o CSV validado.");
        return;
      }
      const sourceText = `${file.name}\n${data.blocks.slice(0,12).map((block: any) => `${block.title} ${String(block.text || "").slice(0,700)}`).join("\n")}`;
      const candidates = disciplineCandidates(sourceText, allTopics);
      const best = candidates[0];
      const discipline = best?.discipline || "";
      setDraftMeta({ ...data, disciplineCandidates: candidates });
      setDetectedDiscipline(discipline);
      setDisciplineConfidence(best?.confidence || 0);
      setDraft(reclassify(data.blocks, discipline));
      setImportOpen(true);
      setMessage(data.warning || "Confira disciplina e vínculos antes de salvar.");
    } catch (error: unknown) {
      const timedOut = error instanceof Error && error.name === "AbortError";
      setMessage(timedOut
        ? "A leitura experimental excedeu o tempo limite e foi cancelada. Para materiais extensos, importe o CSV validado."
        : `Erro ao processar o PDF: ${error instanceof Error ? error.message : "falha de conexão"}. Tente novamente ou use o CSV validado.`);
    } finally {
      clearTimeout(timeout);
    }
  }

  function changeDiscipline(value: string) {
    setDetectedDiscipline(value);
    const candidate = draftMeta?.disciplineCandidates?.find((x:any)=>x.discipline===value);
    setDisciplineConfidence(candidate?.confidence || 0);
    setDraft(rows => reclassify(rows, value));
  }

  async function openMaterialManager(material: Material) {
    const blocks = await getContentBlocksByMaterial(material.id);
    setManagedMaterial(material);
    setManagedBlocks(blocks);
    setManagedDiscipline(material.discipline || blocks[0]?.discipline || "");
    const progress = user ? await getContentBlockProgress(user.uid, activeContestId) : [];
    setBlockStudyIds(progress.map((row:any) => String(row.contentBlockId || row.id)));
    setShowMaterialManager(true);
    setBlockSearch(""); setBlockLimit(40);
    setMessage("");
  }

  function reclassifyManagedMaterial(discipline: string) {
    setManagedDiscipline(discipline);
    setManagedBlocks(rows => rows.map(block => {
      const result = classifyTopic(`${block.title}\n${block.text}`, discipline, allTopics);
      const topic = result.confidence >= 65 ? allTopics.find(t => t.id === result.topicId) : null;
      return { ...block, discipline, topicId: topic?.id || null, contentId: topic?.canonicalContentId || topic?.id || `UNLINKED__${block.id}` };
    }));
  }

  function updateManagedBlock(id: string, patch: Partial<ContentBlock>) {
    setManagedBlocks(rows => rows.map(block => block.id === id ? { ...block, ...patch } : block));
  }

  async function deleteManagedBlock(block: ContentBlock) {
    const linked = questions.filter(q => q.contentBlockId === block.id).length;
    if (linked || blockStudyIds.includes(block.id)) {
      setMessage(`O bloco “${block.title}” tem questões ou estudo vinculados. Use “Arquivar” para ocultá-lo, preservando o histórico.`);
      return;
    }
    if (!window.confirm(`Excluir definitivamente apenas o microbloco “${block.title}”? Esta ação não pode ser desfeita.`)) return;
    setSavingManagement(true);
    try {
      await deleteContentBlock(block.id, user?.uid);
      setManagedBlocks(rows => rows.filter(row => row.id !== block.id));
      setMessage(`Microbloco “${block.title}” excluído. Outros blocos, tópicos e questões foram preservados.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao excluir microbloco.");
    } finally { setSavingManagement(false); }
  }

  async function saveManagedMaterial() {
    if (!managedMaterial || !managedDiscipline || savingManagement) return;
    if (managedBlocks.some(b => !b.title.trim() || !b.text.trim())) {
      setMessage("Preencha o título e o texto de todos os microblocos antes de salvar."); return;
    }
    setSavingManagement(true);
    try {
    const normalized = managedBlocks.map(block => {
      const topic = block.topicId ? allTopics.find(t => t.id === block.topicId) : null;
      return { ...block, discipline: managedDiscipline, contentId: topic?.canonicalContentId || topic?.id || `UNLINKED__${block.id}` };
    });
    await saveMaterial({ ...managedMaterial, discipline: managedDiscipline, contestId: activeDisciplines.includes(managedDiscipline) ? activeContestId : null });
    await saveContentBlocks(normalized);
    setManagedBlocks(normalized);
    setManagedMaterial({...managedMaterial, discipline: managedDiscipline});
    setMessage(`Conteúdo e vínculos de ${managedMaterial.title} salvos. Questões e Mapa-Mestre preservados.`);
    await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao salvar alterações."); }
    finally { setSavingManagement(false); }
  }

  async function changeDisciplineActive(discipline: string, active: boolean) {
    if (!window.confirm(`${active ? "Reativar" : "Retirar"} “${discipline}” ${active ? "no" : "do"} concurso atual? Nenhuma questão ou registro de estudo será apagado.`)) return;
    setSavingManagement(true);
    try {
      const count = await setDisciplineActiveStatus(activeContestId, discipline, active);
      await load();
      setMessage(`${count} tópico(s) de “${discipline}” ${active ? "reativados" : "retirados"} do concurso. Dados preservados.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Erro ao atualizar disciplina."); }
    finally { setSavingManagement(false); }
  }

  async function removeUnusedDiscipline(discipline: string) {
    if (!user || savingManagement) return;
    if (!window.confirm(`ATENÇÃO: excluir DEFINITIVAMENTE os tópicos de “${discipline}” do concurso atual? Só será permitido se não houver materiais, questões ou histórico vinculados.`)) return;
    setSavingManagement(true);
    try {
      const count = await deleteUnusedDiscipline(user.uid, activeContestId, discipline);
      await load();
      setMessage(`${count} tópico(s) sem vínculos de “${discipline}” excluídos definitivamente.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Exclusão não permitida."); }
    finally { setSavingManagement(false); }
  }

  async function removeManagedMaterial() {
    if (!managedMaterial || savingManagement) return;
    const linked = questions.filter(q => managedBlocks.some(block => block.id === q.contentBlockId)).length;
    if (!window.confirm(`Remover a importação “${managedMaterial.title}” e ${managedBlocks.length} microbloco(s)? ${linked ? `ATENÇÃO: existem ${linked} questão(ões) vinculadas; nesse caso, a exclusão será bloqueada para evitar perda de vínculos. ` : ""}Tópicos e histórico não serão apagados.`)) return;
    setSavingManagement(true);
    try {
      // Gravação no Firestore primeiro; só removemos o arquivo após sucesso dos dados.
      const removed = await deleteMaterialImport(managedMaterial.id, user?.uid);
      try { await deleteMaterialFile(managedMaterial.storagePath); } catch { /* O registro já foi removido; não reexecutar exclusão. */ }
      setMessage(`Importação removida: ${removed} microbloco(s). Questões e tópicos foram preservados.`);
      setManagedMaterial(null); setManagedBlocks([]); setManagedDiscipline("");
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao remover importação."); }
    finally { setSavingManagement(false); }
  }

  function resolveCsvTopic(row: any) {
    const discipline = String(row.disciplina || row.discipline || "").trim();
    const rawTopic = String(row.topico_id || row.topic_id || "").trim();
    const rawSubtopic = String(row.subtopico_id || row.subtopic_id || "").trim();
    const canonical = String(row.content_id || row.conteudo_id || row.canonical_content_id || "").trim();
    const candidates = topics.filter(t => !discipline || t.discipline === discipline);
    const localId = (topic: Topic) => {
      const prefix = `${topic.contestId}__`;
      return topic.id.startsWith(prefix) ? topic.id.slice(prefix.length) : topic.id;
    };
    for (const raw of [rawSubtopic, rawTopic].filter(Boolean)) {
      const hit = candidates.find(t => t.id === raw || t.id === `${activeContestId}__${raw}` || localId(t) === raw);
      if (hit) return hit;
    }
    if (canonical) {
      const hit = candidates.find(t => t.canonicalContentId === canonical);
      if (hit) return hit;
    }
    return null;
  }

  function optionalNumber(value: unknown) {
    const text = String(value ?? "").trim();
    if (!text) return null;
    const parsed = Number(text.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }

  async function importValidatedContentCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setMessage("Validando o CSV de conteúdo antes de gravar...");
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async result => {
        try {
          const rows = (result.data as any[]).filter(Boolean).map(row => Object.fromEntries(
            Object.entries(row).map(([key, value]) => [key.replace(/^\uFEFF/, "").trim().toLowerCase(), value])
          ));
          if (!rows.length) { setMessage("O CSV não possui linhas para importar."); return; }
          const parserErrors = result.errors || [];
          if (parserErrors.some(error => ["Quotes", "FieldMismatch"].includes(error.type))) {
            setMessage(`Importação cancelada: ${parserErrors.length} erro(s) de leitura do CSV. Verifique aspas e quebras de linha; nenhum dado foi gravado.`);
            return;
          }
          const defaultMaterialId = `CSV_${slug(file.name.replace(/\.csv$/i, ""))}`;
          const blocks: ContentBlock[] = [];
          const materialMap = new Map<string, Material>();
          const skipped: string[] = [];

          rows.forEach((row, index) => {
            const discipline = String(row.disciplina || row.discipline || "").trim();
            const title = String(row.titulo || row.title || "").trim();
            const text = String(row.texto || row.text || "").trim();
            if (!discipline || !title || !text) { skipped.push(`linha ${index + 2}: disciplina/título/texto ausente`); return; }

            const topic = resolveCsvTopic(row);
            if (!topic) {
              skipped.push(`linha ${index + 2}: tema não encontrado no Mapa-Mestre (${discipline} • ${title})`);
              return;
            }

            const sourceMaterialId = String(row.material_id || "").trim() || defaultMaterialId;
            const materialId = activeContestId === "ATA_MF_2026" || sourceMaterialId.startsWith(`${activeContestId}__`)
              ? sourceMaterialId : `${activeContestId}__${sourceMaterialId}`;
            const materialTitle = String(row.material_titulo || row.material_title || row.fonte || file.name.replace(/\.csv$/i, "")).trim();
            const sourceName = String(row.fonte || row.source || "CSV validado").trim();
            if (!materialMap.has(materialId)) {
              materialMap.set(materialId, {
                id: materialId,
                contestId: activeDisciplines.includes(discipline) ? activeContestId : null,
                discipline,
                title: materialTitle || materialId,
                sourceName,
                fileName: file.name,
                type: "texto",
              });
            }

            // O detalhamento carrega blocos por canonicalContentId do tópico, não pelo content_id externo.
            // Preservamos a referência externa somente nas tags; a chave de consulta precisa coincidir.
            const externalContentId = String(row.content_id || row.conteudo_id || row.canonical_content_id || "").trim();
            const contentId = topic.canonicalContentId || topic.id;
            const sourceBlockId = String(row.content_block_id || row.bloco_conteudo_id || "").trim() || `${sourceMaterialId}__B${String(index + 1).padStart(3, "0")}`;
            const blockId = activeContestId === "ATA_MF_2026" || sourceBlockId.startsWith(`${activeContestId}__`)
              ? sourceBlockId : `${activeContestId}__${sourceBlockId}`;
            const tags = String(row.tags || "").split(";").map((x:string)=>x.trim()).filter(Boolean);
            blocks.push({
              id: blockId,
              contentId,
              topicId: topic.id,
              materialId,
              discipline,
              title,
              text,
              order: optionalNumber(row.ordem || row.order) || index + 1,
              sourcePageStart: optionalNumber(row.pagina_inicial || row.source_page_start),
              sourcePageEnd: optionalNumber(row.pagina_final || row.source_page_end),
              estimatedMinutes: optionalNumber(row.tempo_estimado || row.estimated_minutes),
              tags: Array.from(new Set([...tags, ...(externalContentId && externalContentId !== contentId ? [`referencia_csv:${externalContentId}`] : []), "importado_csv_validado"])) ,
            });
          });

          if (!blocks.length) {
            setMessage(`Nenhum bloco pôde ser importado. ${skipped.slice(0, 4).join(" | ")}`);
            return;
          }
          const duplicateIds = blocks.map(block => block.id).filter((id, index, ids) => ids.indexOf(id) !== index);
          if (duplicateIds.length) {
            setMessage(`Importação cancelada: IDs de microblocos duplicados no CSV (${Array.from(new Set(duplicateIds)).slice(0, 4).join(", ")}). Nenhum dado foi alterado.`);
            return;
          }
          // O CSV deve conter teoria completa; não resumimos nem reescrevemos os textos.
          // Alertamos sobre microblocos potencialmente sem contexto, mantendo os IDs e vínculos.
          const shortBlocks = blocks.filter(block => block.text.trim().split(/\s+/).length < 45);
          const fragmentBlocks = blocks.filter(block => /^={2,}\S+={2,}$/.test(block.text.trim()) || block.text.trim().length < 25);
          if (shortBlocks.length || fragmentBlocks.length || skipped.length) {
            const diagnostic = `${shortBlocks.length} trecho(s) com menos de 45 palavras, ${fragmentBlocks.length} possível(is) fragmento(s) e ${skipped.length} linha(s) sem vínculo.`;
            if (!window.confirm(`Revisão de integridade do conteúdo\n\n${diagnostic}\n\nConfira os trechos curtos e as linhas sem vínculo: a importação NÃO expande, resume ou recupera texto ausente.\n\nContinuar gravando apenas as ${blocks.length} linhas válidas?`)) {
              setMessage(`Importação cancelada para revisão. ${diagnostic} Nenhum dado foi alterado.`);
              return;
            }
          }
          // Atualiza registros pelo mesmo ID, sem apagar os blocos ausentes deste CSV.
          for (const material of materialMap.values()) await saveMaterial(material);
          await saveContentBlocks(blocks);
          const parserNote = parserErrors.length ? ` O parser também sinalizou ${parserErrors.length} aviso(s).` : "";
          const skippedNote = skipped.length ? ` ${skipped.length} linha(s) ficaram de fora: ${skipped.slice(0, 3).join(" | ")}${skipped.length > 3 ? "…" : ""}` : "";
          setMessage(`${blocks.length} microbloco(s) importados com o texto integral do CSV, sem resumir. ${shortBlocks.length} bloco(s) curtos exigem revisão de contexto. ${materialMap.size} material(is).${skippedNote}${parserNote}`);
          await load();
        } catch (error) {
          setMessage(error instanceof Error ? `Falha ao importar CSV: ${error.message}` : "Falha ao importar CSV de conteúdo.");
        } finally {
          event.target.value = "";
        }
      },
    });
  }

  async function commitMaterial() {
    if (!user || !draftFile || !draftMeta || !draft.length || !detectedDiscipline) return;
    setMessage("Salvando material...");
    let storagePath: string | null = null;
    try { storagePath = (await uploadMaterialFile(user.uid, draftFile, draftMeta.fileHash)).path; } catch { /* validação pode seguir sem storage */ }
    // Escopo por edital evita sobrescrever um mesmo PDF importado em outro concurso.
    const pdfBaseId = `MAT_${draftMeta.fileHash.slice(0,16)}`;
    const materialId = activeContestId === "ATA_MF_2026" ? pdfBaseId : `${activeContestId}__${pdfBaseId}`;
    const belongsToActiveContest = activeDisciplines.includes(detectedDiscipline);
    await saveMaterial({ id: materialId, contestId: belongsToActiveContest ? activeContestId : null, discipline: detectedDiscipline, title: draftFile.name.replace(/\.pdf$/i,""), sourceName: "Material importado", fileName: draftFile.name, fileHash: draftMeta.fileHash, storagePath, pageCount: draftMeta.pages || null, type: "pdf" });

    const createdTopics: Topic[] = [];
    const blocks: ContentBlock[] = [];
    for (let index=0; index<draft.length; index++) {
      const b = draft[index];
      let topic = allTopics.find(t=>t.id===b.topicId) || topics.find(t=>t.id===b.topicId) || null;
      if (!topic && createUnmapped) {
        const id = `LIB__${slug(detectedDiscipline)}__${slug(b.title || `BLOCO_${index+1}`)}`;
        topic = { id, contestId: "__LIBRARY__", discipline: detectedDiscipline, parentTopicId: null, canonicalContentId: `CANON.${slug(detectedDiscipline)}.${slug(b.title || `BLOCO_${index+1}`)}`, title: b.title || `Bloco ${index+1}`, originalText: b.title || "Conteúdo importado", level: "topic", tags: ["biblioteca", "importado_pdf"], order: index+1, activeInCurrentEdital: false };
        await addTopic(topic); createdTopics.push(topic);
      }
      if (!topic) continue;
      blocks.push({ id: `${materialId}__B${String(index+1).padStart(3,"0")}`, contentId: topic.canonicalContentId || topic.id, topicId: topic.id, materialId, discipline: detectedDiscipline, title: b.title || `Bloco ${index+1}`, text: b.text, order: index+1, estimatedMinutes: b.estimatedMinutes || null, tags: [`classificacao_${b.confidence || 0}`] });
    }
    await saveContentBlocks(blocks);
    const skipped = draft.length - blocks.length;
    setMessage(`${blocks.length} microbloco(s) salvos em ${detectedDiscipline}. ${skipped} sem classificação ficaram de fora.${createdTopics.length ? ` ${createdTopics.length} item(ns) canônico(s) foram criados na biblioteca por sua autorização.` : ""}${storagePath ? " PDF original salvo no Storage." : " PDF original não foi enviado ao Storage."}`);
    setDraft([]); setDraftMeta(null); setDraftFile(null); setImportOpen(false); setCreateUnmapped(false); await load();
  }

  const hierarchy = useMemo<HierarchyIndexNode[]>(() => {
    const source = scope === "contest" ? topics.filter(t=>t.activeInCurrentEdital!==false) : allTopics;
    const term = search.trim().toLowerCase();
    const dedupe = new Map<string, Topic>();
    for (const t of source) {
      const key = t.canonicalContentId || `${t.discipline}::${t.title}`;
      if (!dedupe.has(key) || t.contestId === activeContestId) dedupe.set(key, t);
    }
    const list = Array.from(dedupe.values());
    const roots: HierarchyIndexNode[] = [];
    for (const disc of Array.from(new Set(list.map(t=>t.discipline).filter(Boolean))).sort()) {
      const discTopics = list.filter(t=>t.discipline===disc);
      const originalDiscTopics = source.filter(t=>t.discipline===disc);
      let top = discTopics.filter(t=>!t.parentTopicId || !source.some(parent=>parent.id===t.parentTopicId)).sort((a,b)=>a.order-b.order);
      if (!top.length) top = discTopics.sort((a,b)=>a.order-b.order);
      const childNodes = top.map(topic => {
        const children = originalDiscTopics.filter(t=>t.parentTopicId===topic.id).sort((a,b)=>a.order-b.order).map(sub => {
          const qCount = questions.filter(q=>q.topicId===sub.id || q.subtopicId===sub.id || q.relatedContent===sub.canonicalContentId).length;
          return { id:`content:${sub.id}`, label:sub.title, count:qCount, actionLabel:"Abrir" } as HierarchyIndexNode;
        });
        const descendants = originalDiscTopics.filter(t=>t.parentTopicId===topic.id).map(t=>t.id);
        const qCount = questions.filter(q=>q.topicId===topic.id || q.subtopicId===topic.id || descendants.includes(q.topicId) || (!!q.subtopicId&&descendants.includes(q.subtopicId)) || q.relatedContent===topic.canonicalContentId).length;
        return { id:`content:${topic.id}`, label:topic.title, count:qCount, children, actionLabel:"Abrir" } as HierarchyIndexNode;
      });
      const count = questions.filter(q=>q.discipline===disc).length;
      const matches = !term || disc.toLowerCase().includes(term) || childNodes.some(c=>c.label.toLowerCase().includes(term) || c.children?.some(s=>s.label.toLowerCase().includes(term)));
      if (matches) roots.push({ id:`discipline:${disc}`, label:disc, count, children:childNodes, actionLabel:"Questões" });
    }
    return roots;
  }, [scope, topics, allTopics, questions, search, activeContestId]);

  const managedMaterialDisciplines = Array.from(new Set(materials.map(m => m.discipline || "").filter(Boolean))).sort();
  const visibleMaterials = materials.filter(m =>
    (!materialDiscipline || m.discipline === materialDiscipline) &&
    (!materialSearch.trim() || `${m.title} ${m.discipline || ""} ${m.fileName || ""} ${m.id}`.toLowerCase().includes(materialSearch.toLowerCase()))
  );
  const filteredManagedBlocks = managedBlocks.filter(block => !blockSearch.trim() ||
    `${block.id} ${block.title} ${block.text}`.toLowerCase().includes(blockSearch.trim().toLowerCase())
  );
  const disciplineRows = Array.from(new Set(topics.map(t => t.discipline).filter(Boolean))).sort().map(name => {
    const rows = topics.filter(t => t.discipline === name);
    return { name, count: rows.length, active: rows.some(t => t.activeInCurrentEdital !== false),
      questions: questions.filter(q => q.discipline === name).length,
      materials: materials.filter(m => m.discipline === name).length };
  });

  function indexAction(node: HierarchyIndexNode) {
    if (node.id.startsWith("content:")) router.push(`/conteudo/${encodeURIComponent(node.id.slice(8))}`);
    else if (node.id.startsWith("discipline:")) router.push(`/questoes?discipline=${encodeURIComponent(node.label)}`);
  }

  return <AppShell>
    <div className="pageHeader"><div><h1>{isDeveloper ? "Gerenciar conteúdos" : "Conteúdo"}</h1><p className="muted">{isDeveloper ? "Importe, corrija e organize microblocos. Os IDs de estudo são preservados." : "Escolha uma disciplina e um tema para estudar, sem distrações administrativas."}</p></div>{isDeveloper && <div className="quickActions"><label className="actionButton fileButton">Importar CSV validado<input hidden type="file" accept=".csv,text/csv" onChange={importValidatedContentCsv}/></label><button className="actionButton secondaryAction" onClick={()=>setImportOpen(!importOpen)}>PDF experimental</button></div>}</div>
    {isDeveloper && <div className="checkRow compactCheck"><span><strong>Importação segura de CSV</strong><small>O mesmo ID é atualizado, sem excluir automaticamente microblocos anteriores. Para limpar resíduos antigos, use Gerenciar materiais e disciplinas.</small></span></div>}

    {isDeveloper && importOpen && <section className="panel importWorkspace"><div className="panelHeader"><div><h2>Importação automática de PDF — experimental</h2><p className="muted">Use apenas para testes. Para a base principal, prefira o CSV validado: PDF → disciplina → tópico/subtópico → contentId → conferência.</p></div><label className="actionButton secondaryAction fileButton">Escolher PDF<input hidden type="file" accept=".pdf" onChange={parseMaterial}/></label></div>{message && <div className="statusBox">{message}</div>}
      {draftMeta && <div className="classificationHeader"><label>Disciplina<select value={detectedDiscipline} onChange={e=>changeDiscipline(e.target.value)}><option value="">Selecione</option>{catalogDisciplines.map(d=><option key={d}>{d}</option>)}</select></label><div className={`confidenceBadge ${disciplineConfidence>=90?'high':disciplineConfidence>=65?'medium':'low'}`}>Confiança: {disciplineConfidence}%</div>{detectedDiscipline && !activeDisciplines.includes(detectedDiscipline) && <div className="warningBox"><strong>{detectedDiscipline}</strong> não está no edital ativo. O material pode ir para a biblioteca canônica sem ser forçado para Administração Pública/Conhecimentos Gerais.</div>}</div>}
      {draft.length>0 && <><div className="importSummary"><strong>{draft.length}</strong><span>blocos detectados</span><strong>{draft.filter(b=>b.topicId).length}</strong><span>com vínculo sugerido</span><strong>{draft.filter(b=>(b.confidence||0)>=90).length}</strong><span>alta confiança</span></div><div className="materialBlockPreview">{draft.slice(0,180).map((block,i)=><div className="materialBlockRow" key={i}><div><strong>{block.title}</strong><p>{block.text.slice(0,190)}{block.text.length>190?'…':''}</p><small>≈ {block.estimatedMinutes||5} min • confiança temática {block.confidence||0}%</small></div><select value={block.topicId||""} onChange={e=>setDraft(rows=>rows.map((row,idx)=>idx===i?{...row,topicId:e.target.value,confidence:e.target.value?100:0}:row))}><option value="">Não classificado</option>{allTopics.filter(t=>t.discipline===detectedDiscipline).map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></div>)}</div><label className="checkRow"><input type="checkbox" checked={createUnmapped} onChange={e=>setCreateUnmapped(e.target.checked)}/><span><strong>Adicionar blocos não classificados à biblioteca canônica</strong><small>Use somente após conferir os títulos. O sistema não cria temas novos silenciosamente.</small></span></label><button className="actionButton" onClick={commitMaterial}>Salvar material e microblocos conferidos</button></>}
    </section>}

    {(!importOpen || !isDeveloper) && message && <div className="statusBox">{message}</div>}
    {!isDeveloper && <section className="panel contentIndexControls"><div className="segmented"><button className={scope==='contest'?'active':''} onClick={()=>setScope('contest')}>Concurso ativo</button><button className={scope==='library'?'active':''} onClick={openLibrary}>Biblioteca geral</button></div><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar disciplina, tópico ou tema..."/><span className="muted">Número à direita = questões vinculadas</span></section>}

    {isDeveloper && <section className="panel managementHub">
      <div className="panelHeader"><div><h2>Gerenciar conteúdo e disciplinas</h2><p className="muted">Edite ou exclua blocos importados via CSV/PDF; retire do concurso disciplinas que não irá utilizar.</p></div><div className="quickActions"><button className="actionButton secondaryAction" onClick={()=>setShowMaterialManager(value=>!value)}>Materiais ({materials.length})</button><button className="actionButton secondaryAction" onClick={()=>setShowDisciplineManager(value=>!value)}>Disciplinas ({disciplineRows.length})</button></div></div>
      {showMaterialManager && <div className="managementSection"><h3>Importações disponíveis</h3><div className="managementFilters"><input aria-label="Buscar materiais" placeholder="Pesquisar material, CSV, PDF ou ID..." value={materialSearch} onChange={e=>setMaterialSearch(e.target.value)} /><select aria-label="Filtrar materiais por disciplina" value={materialDiscipline} onChange={e=>setMaterialDiscipline(e.target.value)}><option value="">Todas as disciplinas</option>{managedMaterialDisciplines.map(d=><option key={d} value={d}>{d}</option>)}</select></div><div className="managementList">{visibleMaterials.map(m=><button className="managementListItem" key={m.id} onClick={()=>openMaterialManager(m)}><span><strong>{m.title}</strong><small>{m.discipline || "Sem disciplina"} • {m.type === "pdf" ? "PDF" : "CSV / texto"} • ID: {m.id}</small></span><span>Editar →</span></button>)}{!visibleMaterials.length&&<p className="muted">Nenhuma importação encontrada.</p>}</div></div>}
      {showDisciplineManager && <div className="managementSection"><h3>Disciplinas do concurso ativo</h3><p className="muted">Este painel modifica somente o concurso ativo. “Retirar” é reversível e preserva todo o histórico. “Padronizar nome” reclassifica tópicos e questões deste edital sem trocar seus IDs. “Excluir se vazia” exige ausência de vínculos; não exclua outras disciplinas usadas em editais diferentes.</p><div className="managementList">{disciplineRows.map(row=><div className="disciplineManagementRow" key={row.name}><div><strong>{row.name}</strong><small>{row.count} tópico(s) • {row.questions} questão(ões) • {row.materials} material(is) • {row.active ? "Ativa" : "Fora do concurso"}</small></div><div className="quickActions"><button disabled={savingManagement} className="actionButton secondaryAction" onClick={()=>changeDisciplineActive(row.name,!row.active)}>{row.active ? "Retirar do concurso" : "Reativar"}</button><button disabled={savingManagement} className="actionButton secondaryAction" onClick={()=>renameDiscipline(row.name)}>Padronizar nome</button><button disabled={savingManagement} className="dangerButton" onClick={()=>removeUnusedDiscipline(row.name)}>Excluir se vazia</button></div></div>)}</div></div>}
    </section>}

    {isDeveloper && managedMaterial && <section className="panel materialManager"><div className="panelHeader"><div><span className="eyebrow">EDITAR IMPORTAÇÃO — {managedMaterial.type === "pdf" ? "PDF" : "CSV / TEXTO"}</span><h2>{managedMaterial.title}</h2><p className="muted">Edite título, texto e vínculo de cada microbloco. Os IDs não mudam e seu progresso é preservado.</p></div><button className="textButton" onClick={()=>{setManagedMaterial(null);setManagedBlocks([]);}}>Fechar</button></div><div className="classificationHeader"><label>Disciplina do material<select value={managedDiscipline} onChange={e=>reclassifyManagedMaterial(e.target.value)}><option value="">Selecione</option>{catalogDisciplines.map(d=><option key={d}>{d}</option>)}</select></label><div className="quickActions"><button className="actionButton secondaryAction" onClick={()=>reclassifyManagedMaterial(managedDiscipline)} disabled={!managedDiscipline||savingManagement}>Reclassificar</button><button className="actionButton" onClick={saveManagedMaterial} disabled={!managedDiscipline||savingManagement}>{savingManagement?"Salvando...":"Salvar alterações"}</button><button className="dangerButton" onClick={removeManagedMaterial} disabled={savingManagement}>Excluir importação inteira</button></div></div><div className="materialManagerNote">{managedBlocks.length} microbloco(s), {managedBlocks.filter(b=>b.archived).length} arquivado(s). Para um bloco com questões ou estudo, use “Arquivar” em vez de excluir. Para salvar textos e títulos editados, clique em “Salvar alterações”.</div><div className="managementFilters"><input aria-label="Buscar microbloco" placeholder="Buscar microbloco por título, ID ou texto..." value={blockSearch} onChange={e=>{setBlockSearch(e.target.value);setBlockLimit(40);}}/><span className="muted">{filteredManagedBlocks.length} encontrado(s) • exibindo até {Math.min(blockLimit,filteredManagedBlocks.length)}</span></div><div className="materialBlockPreview managedBlockList">{filteredManagedBlocks.slice(0,blockLimit).map((block,index)=><div className="managedBlockEditor" key={block.id}><div className="managedBlockEditorHeader"><strong>Bloco {index+1} • {block.id}</strong>{block.archived&&<span className="statusPill">Arquivado</span>}</div><label>Título<input value={block.title} onChange={e=>updateManagedBlock(block.id,{title:e.target.value})}/></label><label>Texto de estudo<textarea rows={5} value={block.text} onChange={e=>updateManagedBlock(block.id,{text:e.target.value})}/></label><div className="managementFilters"><label>Tópico / subtópico<select value={block.topicId||""} onChange={e=>updateManagedBlock(block.id,{topicId:e.target.value||null})}><option value="">Sem vínculo</option>{allTopics.filter(t=>t.discipline===managedDiscipline).map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label><label>Ordem<input type="number" min={1} value={block.order} onChange={e=>updateManagedBlock(block.id,{order:Math.max(1,Number(e.target.value)||1)})}/></label></div><div className="quickActions"><button className="actionButton secondaryAction" disabled={savingManagement} onClick={()=>updateManagedBlock(block.id,{archived:!block.archived})}>{block.archived?"Restaurar bloco":"Arquivar bloco"}</button><button className="dangerButton" disabled={savingManagement} onClick={()=>deleteManagedBlock(block)}>Excluir bloco</button></div></div>)}{filteredManagedBlocks.length>blockLimit && <button className="actionButton secondaryAction" onClick={()=>setBlockLimit(n=>n+40)}>Carregar mais 40 blocos</button>}</div></section>}

    {isDeveloper && managedMaterial && <NewMicroblockForm material={managedMaterial} topics={topics} onCreated={block => {setManagedBlocks(rows => [...rows, block]);setMessage(`Microbloco “${block.title}” incluído com ID permanente e revisão pendente.`);}} />}

    {!isDeveloper && <HierarchyIndex nodes={hierarchy} scopeKey={`${activeContestId}:${scope}`} onAction={indexAction} actionLabel="Abrir" emptyLabel="Nenhum conteúdo encontrado neste índice." />}
  </AppShell>;
}
