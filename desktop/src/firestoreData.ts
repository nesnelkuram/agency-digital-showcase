import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";

// ── Projeler (marka = clientName gruplaması) ──────────────────────────────
export interface ProjectLite {
  id: string;
  name: string;
  clientName: string;
  clientCompany?: string;
  status?: string;
}

export function subscribeProjects(
  tenantId: string,
  cb: (projects: ProjectLite[]) => void
): () => void {
  if (!db) {
    cb([]);
    return () => {};
  }
  const q = query(collection(db, "projects"), where("tenantId", "==", tenantId));
  return onSnapshot(
    q,
    (snap) =>
      cb(
        snap.docs.map((d) => {
          const x = d.data();
          return {
            id: d.id,
            name: x.name || "Proje",
            clientName: x.clientName || x.clientCompany || "—",
            clientCompany: x.clientCompany,
            status: x.status,
          };
        })
      ),
    (e) => console.error("[firestore] projects:", e)
  );
}

// ── Dosya konum eşlemeleri (asset_locations) ──────────────────────────────
export interface AssetLink {
  id: string;
  tenantId: string;
  driveId: string;
  driveLabel: string;
  relPath: string; // disk köküne göreli yol (mount değişse de geçerli)
  folderName: string;
  projectId?: string;
  projectName?: string;
  clientName?: string;
}

// driveId + path → deterministik doc id (re-link upsert için)
function hashStr(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
function linkId(driveId: string, path: string): string {
  return `${hashStr(driveId)}_${hashStr(path)}`;
}

export function subscribeLinks(
  tenantId: string,
  cb: (links: AssetLink[]) => void
): () => void {
  if (!db) {
    cb([]);
    return () => {};
  }
  const q = query(
    collection(db, "asset_locations"),
    where("tenantId", "==", tenantId)
  );
  return onSnapshot(
    q,
    (snap) =>
      cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))),
    (e) => console.error("[firestore] asset_locations:", e)
  );
}

export async function upsertLink(
  tenantId: string,
  args: {
    driveId: string;
    driveLabel: string;
    relPath: string;
    folderName: string;
    project: ProjectLite;
  }
): Promise<void> {
  if (!db) throw new Error("Firebase hazır değil");
  const id = linkId(args.driveId, args.relPath);
  await setDoc(
    doc(db, "asset_locations", id),
    {
      tenantId,
      driveId: args.driveId,
      driveLabel: args.driveLabel,
      relPath: args.relPath,
      folderName: args.folderName,
      projectId: args.project.id,
      projectName: args.project.name,
      clientName: args.project.clientName,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function removeLink(
  driveId: string,
  relPath: string
): Promise<void> {
  if (!db) return;
  await deleteDoc(doc(db, "asset_locations", linkId(driveId, relPath)));
}

// ── Disk registry (web app de hangi diskler var görsün) ───────────────────
export async function upsertDrive(
  tenantId: string,
  args: { id: string; label: string; totalBytes: number; freeBytes: number }
): Promise<void> {
  if (!db) return;
  await setDoc(
    doc(db, "drives", `${hashStr(tenantId)}_${hashStr(args.id)}`),
    {
      tenantId,
      driveId: args.id,
      label: args.label,
      totalBytes: args.totalBytes,
      freeBytes: args.freeBytes,
      lastSeenAt: serverTimestamp(),
    },
    { merge: true }
  );
}

// ── Klasör adı → proje bulanık eşleştirme ─────────────────────────────────
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/ı/g, "i")
    .replace(/[ğ]/g, "g")
    .replace(/[ü]/g, "u")
    .replace(/[ş]/g, "s")
    .replace(/[ö]/g, "o")
    .replace(/[ç]/g, "c")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function suggestProjects(
  folderPath: string,
  folderName: string,
  projects: ProjectLite[]
): ProjectLite[] {
  const np = norm(folderPath);
  const nf = norm(folderName);
  const scored = projects.map((p) => {
    let score = 0;
    const pn = norm(p.name);
    const cn = norm(p.clientName);
    if (pn && (nf.includes(pn) || np.includes(pn))) score += 3;
    if (cn && (nf.includes(cn) || np.includes(cn))) score += 2;
    // kelime kesişimi
    const fw = new Set(nf.split(" ").filter((w) => w.length > 2));
    for (const w of pn.split(" ")) if (w.length > 2 && fw.has(w)) score += 1;
    return { p, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((s) => s.p);
}
