import { deleteObject, ref, uploadBytes } from "firebase/storage";
import { storage } from "@/lib/firebase";

function safeName(name: string) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "_");
}

export async function sha256File(file: File) {
  const bytes = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function uploadMaterialFile(uid: string, file: File, hash?: string) {
  const fileHash = hash || await sha256File(file);
  const path = `users/${uid}/materials/${fileHash.slice(0, 16)}-${safeName(file.name)}`;
  await uploadBytes(ref(storage, path), file, { contentType: file.type || "application/pdf" });
  return { path, fileHash };
}

export async function uploadEditalFile(uid: string, file: File, hash?: string) {
  const fileHash = hash || await sha256File(file);
  const path = `users/${uid}/editais/${fileHash.slice(0, 16)}-${safeName(file.name)}`;
  await uploadBytes(ref(storage, path), file, { contentType: file.type || "application/pdf" });
  return { path, fileHash };
}

export async function deleteMaterialFile(path?: string | null) {
  if (!path) return;
  try {
    await deleteObject(ref(storage, path));
  } catch {
    // A limpeza da base não deve falhar se o arquivo já tiver sido removido do Storage.
  }
}
