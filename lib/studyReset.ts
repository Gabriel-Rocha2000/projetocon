import {
  collection,
  doc,
  getCountFromServer,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { invalidateStudyReadCache } from "@/services/firestore";

/**
 * Reinicialização completa da base de estudos.
 * Mantém Auth, documentos de usuário, concursos, configurações e PDFs no Storage.
 * Os registros de materiais PDF com storagePath também são preservados.
 */
export const RESET_GLOBAL_COLLECTIONS = [
  "questions",
  "content_blocks",
  "content_nodes",
  "topics",
  "edital_items",
  "contest_versions",
  "law_documents",
  "laws",
  "materials",
] as const;

export const RESET_USER_COLLECTIONS = [
  "question_progress",
  "content_block_progress",
  "error_notebook",
  "reviews",
  "study_sessions",
  "daily_plans",
  "law_progress",
] as const;

type GlobalName = typeof RESET_GLOBAL_COLLECTIONS[number];
type UserName = typeof RESET_USER_COLLECTIONS[number];
export type ResetEntry = { id: string; data: Record<string, unknown> };
export type StudyResetSnapshot = {
  schemaVersion: 1;
  createdAt: string;
  ownerUid: string;
  description: string;
  global: Record<GlobalName, ResetEntry[]>;
  currentUser: Record<UserName, ResetEntry[]>;
  preservedPdfMaterials: ResetEntry[];
  retainedContests: ResetEntry[];
};
export type ResetProgress = { phase: string; current: number; total: number; detail: string };
const preservePdf = (data: Record<string, unknown>) =>
  data.type === "pdf" && typeof data.storagePath === "string" && data.storagePath.trim().length > 0;

function asEntry(id: string, data: Record<string, unknown>): ResetEntry {
  return { id, data };
}

export function resetTotals(snapshot: StudyResetSnapshot) {
  const global = RESET_GLOBAL_COLLECTIONS.reduce((sum, name) => sum + snapshot.global[name].length, 0);
  const user = RESET_USER_COLLECTIONS.reduce((sum, name) => sum + snapshot.currentUser[name].length, 0);
  return { global, user, total: global + user, retainedPdfs: snapshot.preservedPdfMaterials.length };
}

export async function prepareStudyReset(
  uid: string,
  onProgress?: (p: ResetProgress) => void
): Promise<StudyResetSnapshot> {
  if (!uid) throw new Error("Faça login antes de preparar a reinicialização.");
  const global = {} as Record<GlobalName, ResetEntry[]>;
  const currentUser = {} as Record<UserName, ResetEntry[]>;
  let preservedPdfMaterials: ResetEntry[] = [];
  let retainedContests: ResetEntry[] = [];
  const total = RESET_GLOBAL_COLLECTIONS.length + RESET_USER_COLLECTIONS.length;
  let current = 0;

  for (const name of RESET_GLOBAL_COLLECTIONS) {
    onProgress?.({ phase: "inventario", current, total, detail: "Lendo " + name });
    const rows = await getDocs(collection(db, name));
    const entries = rows.docs.map(row => asEntry(row.id, row.data()));
    if (name === "materials") {
      preservedPdfMaterials = entries.filter(entry => preservePdf(entry.data));
      global[name] = entries.filter(entry => !preservePdf(entry.data));
    } else {
      global[name] = entries;
    }
    current += 1;
  }

  for (const name of RESET_USER_COLLECTIONS) {
    onProgress?.({ phase: "inventario", current, total, detail: "Lendo users/{uid}/" + name });
    const rows = await getDocs(collection(db, "users", uid, name));
    currentUser[name] = rows.docs.map(row => asEntry(row.id, row.data()));
    current += 1;
  }
  onProgress?.({ phase: "inventario", current: total, total, detail: "Conferindo cadastros de concursos mantidos." });
  // Permite restaurar a referência original se necessário. Os concursos continuam existentes.
  const contests = await getDocs(collection(db, "contests"));
  retainedContests = contests.docs.map(row => asEntry(row.id, row.data()));
  onProgress?.({ phase: "inventario", current: total, total, detail: "Inventário completo." });
  return {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    ownerUid: uid,
    description: "Backup antes de zerar o Concurseiro CLT. Restore automático não implementado. Arquivos PDF e registros PDF com storagePath permanecem no Firebase.",
    global,
    currentUser,
    preservedPdfMaterials,
    retainedContests,
  };
}

export async function executeStudyReset(
  snapshot: StudyResetSnapshot,
  uid: string,
  onProgress?: (p: ResetProgress) => void
): Promise<{ deleted: number; verified: boolean }> {
  if (!uid || uid !== snapshot.ownerUid) {
    throw new Error("A conta atual não corresponde à conta que preparou o backup.");
  }
  const totals = resetTotals(snapshot);
  let completed = 0;
  const deleteRows = async (
    path: string[],
    rows: ResetEntry[]
  ) => {
    // 350 gravações por lote: abaixo do limite de 500 do Firestore.
    for (let start = 0; start < rows.length; start += 350) {
      const portion = rows.slice(start, start + 350);
      const batch = writeBatch(db);
      for (const entry of portion) {
        batch.delete(doc(db, path[0], ...path.slice(1), entry.id));
      }
      await batch.commit();
      completed += portion.length;
      onProgress?.({
        phase: "exclusao",
        current: completed,
        total: totals.total,
        detail: path.join("/") + ": " + completed + "/" + totals.total + " registros removidos",
      });
    }
  };
  try {
    // Apaga primeiro os históricos do usuário, depois as entidades globais.
    // Nenhum outro documento de usuário é tocado.
    for (const name of RESET_USER_COLLECTIONS) {
      await deleteRows(["users", uid, name], snapshot.currentUser[name]);
    }
    for (const name of RESET_GLOBAL_COLLECTIONS) {
      await deleteRows([name], snapshot.global[name]);
    }

    // Ao remover versões do edital, o concurso permanece cadastrado,
    // mas a referência da versão ativa não pode apontar para documento excluído.
    for (const contest of snapshot.retainedContests) {
      if (!contest.data.currentVersionId) continue;
      const batch = writeBatch(db);
      batch.set(doc(db, "contests", contest.id), { currentVersionId: null }, { merge: true });
      await batch.commit();
    }

    // Não basta terminar os batches: uma nova consulta confirma a base vazia.
    const totalChecks = RESET_GLOBAL_COLLECTIONS.length + RESET_USER_COLLECTIONS.length;
    let checked = 0;
    for (const name of RESET_GLOBAL_COLLECTIONS) {
      onProgress?.({ phase: "conferencia", current: checked, total: totalChecks, detail: "Verificando " + name });
      const result = await getCountFromServer(collection(db, name));
      const expected = name === "materials" ? snapshot.preservedPdfMaterials.length : 0;
      if (result.data().count !== expected) {
        throw new Error(
          "Verificação falhou em " + name + ": encontrados " + result.data().count +
          " registros; esperado " + expected + ". Não importe CSV até revisar a base."
        );
      }
      checked += 1;
    }
    for (const name of RESET_USER_COLLECTIONS) {
      onProgress?.({ phase: "conferencia", current: checked, total: totalChecks, detail: "Verificando " + name });
      const result = await getCountFromServer(collection(db, "users", uid, name));
      if (result.data().count !== 0) {
        throw new Error(
          "Verificação falhou em users/{uid}/" + name + ": " + result.data().count +
          " registros remanescentes. Não importe CSV até revisar."
        );
      }
      checked += 1;
    }
    invalidateStudyReadCache();
    onProgress?.({ phase: "concluido", current: checked, total: totalChecks, detail: "Base conferida. PDFs originais preservados." });
    return { deleted: completed, verified: true };
  } catch (error) {
    invalidateStudyReadCache();
    throw error;
  }
}

export function makeStudyResetBackup(snapshot: StudyResetSnapshot): Blob {
  // Timestamps Firestore possuem toJSON(); os IDs originais são mantidos.
  return new Blob(
    [JSON.stringify(snapshot, null, 2)],
    { type: "application/json;charset=utf-8" }
  );
}
