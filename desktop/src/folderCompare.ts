import { IndexDoc } from "./scannerApi";

// Klasör seviyesinde karşılaştırma:
//   • Birebir aynı klasörler (tüm içerik aynı) → tek satır, en üst klasör.
//   • Aynı ada sahip ama içeriği farklı klasörler → fark dökümü.
// Tamamen offline (kayıtlı indekslerden, ad+boyut sinyaliyle).

interface FileLite {
  name: string;
  size: number;
  rel: string; // diske göreli tam yol
}

interface FolderNode {
  rel: string; // diske göreli ("" = kök)
  name: string;
  sig: string; // özyinelemeli içerik imzası
  fileCount: number; // özyinelemeli dosya sayısı
  totalSize: number; // özyinelemeli toplam boyut
}

interface DriveModel {
  id: string;
  label: string;
  nodes: Map<string, FolderNode>;
  childFiles: Map<string, FileLite[]>;
  childDirs: Map<string, string[]>;
}

const parentOf = (rel: string) => rel.split("/").slice(0, -1).join("/");

function djb2(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function buildDrive(id: string, label: string, doc: IndexDoc): DriveModel {
  const childFiles = new Map<string, FileLite[]>();
  const childDirs = new Map<string, string[]>();
  const dirSet = new Set<string>([""]);

  for (const e of doc.entries) {
    const parent = parentOf(e.rel_path);
    if (e.is_dir) {
      dirSet.add(e.rel_path);
      if (!childDirs.has(parent)) childDirs.set(parent, []);
      childDirs.get(parent)!.push(e.rel_path);
    } else {
      if (!childFiles.has(parent)) childFiles.set(parent, []);
      childFiles.get(parent)!.push({ name: e.name, size: e.size, rel: e.rel_path });
    }
  }

  const nodes = new Map<string, FolderNode>();
  // post-order: özyinelemeli imza
  const compute = (rel: string): FolderNode => {
    const cached = nodes.get(rel);
    if (cached) return cached;
    const files = (childFiles.get(rel) || [])
      .filter((f) => f.size > 0)
      .map((f) => `f|${f.name.toLowerCase()}|${f.size}`)
      .sort();
    const subdirs = (childDirs.get(rel) || []).map((d) => compute(d));
    let fileCount = (childFiles.get(rel) || []).length;
    let totalSize = (childFiles.get(rel) || []).reduce((s, f) => s + f.size, 0);
    const subParts = subdirs
      .map((s) => `d|${s.name.toLowerCase()}|${s.sig}`)
      .sort();
    for (const s of subdirs) {
      fileCount += s.fileCount;
      totalSize += s.totalSize;
    }
    const sig = djb2([...files, ...subParts].join("\n"));
    const name = rel === "" ? label : rel.split("/").pop()!;
    const node: FolderNode = { rel, name, sig, fileCount, totalSize };
    nodes.set(rel, node);
    return node;
  };
  for (const d of dirSet) compute(d);

  return { id, label, nodes, childFiles, childDirs };
}

// Bir klasörün tüm alt dosyalarını klasöre-göreli anahtarla topla (fark için).
function descendantFiles(dm: DriveModel, rel: string): Map<string, FileLite> {
  const out = new Map<string, FileLite>();
  const prefix = rel ? rel + "/" : "";
  const walk = (dir: string) => {
    for (const f of dm.childFiles.get(dir) || []) {
      const within = f.rel.slice(prefix.length);
      out.set(`${within.toLowerCase()}|${f.size}`, { ...f, rel: within });
    }
    for (const sd of dm.childDirs.get(dir) || []) walk(sd);
  };
  walk(rel);
  return out;
}

export interface IdenticalGroup {
  id: string;
  name: string;
  totalSize: number;
  fileCount: number;
  members: Array<{ driveId: string; label: string; rel: string }>;
}

export interface DiffMember {
  driveId: string;
  label: string;
  rel: string;
  uniqueFiles: Array<{ name: string; rel: string; size: number }>;
}
export interface DifferingGroup {
  name: string;
  members: DiffMember[];
}

export interface CompareResult {
  identical: IdenticalGroup[];
  differing: DifferingGroup[];
  driveCount: number;
}

export function compareFolders(
  indexes: Array<{ id: string; label: string; doc: IndexDoc }>
): CompareResult {
  const drives = indexes.map((x) => buildDrive(x.id, x.label, x.doc));

  // imza → üyeler
  const bySig = new Map<string, Array<{ dm: DriveModel; node: FolderNode }>>();
  for (const dm of drives) {
    for (const node of dm.nodes.values()) {
      if (node.fileCount === 0) continue; // boş klasörleri atla
      if (!bySig.has(node.sig)) bySig.set(node.sig, []);
      bySig.get(node.sig)!.push({ dm, node });
    }
  }
  const dupSigs = new Set<string>();
  for (const [sig, members] of bySig) {
    const drvCount = new Set(members.map((m) => m.dm.id)).size;
    if (drvCount >= 2) dupSigs.add(sig);
  }

  // üst-klasör de kopyaysa alt klasörü gösterme (gürültü engelleme)
  const isTop = (dm: DriveModel, node: FolderNode): boolean => {
    if (node.rel === "") return true;
    const parent = dm.nodes.get(parentOf(node.rel));
    return !parent || !dupSigs.has(parent.sig);
  };

  const identical: IdenticalGroup[] = [];
  for (const sig of dupSigs) {
    const members = bySig
      .get(sig)!
      .filter((m) => isTop(m.dm, m.node));
    const drvIds = new Set(members.map((m) => m.dm.id));
    if (drvIds.size < 2) continue;
    const rep = members[0].node;
    identical.push({
      id: sig,
      name: rep.name,
      totalSize: rep.totalSize,
      fileCount: rep.fileCount,
      members: members.map((m) => ({
        driveId: m.dm.id,
        label: m.dm.label,
        rel: m.node.rel,
      })),
    });
  }
  // kazanılacak yere göre sırala
  identical.sort(
    (a, b) =>
      b.totalSize * (b.members.length - 1) - a.totalSize * (a.members.length - 1)
  );

  // ── Aynı ad, farklı içerik (kopya OLMAYAN) ──
  const byName = new Map<
    string,
    Array<{ dm: DriveModel; node: FolderNode }>
  >();
  for (const dm of drives) {
    for (const node of dm.nodes.values()) {
      if (node.rel === "" || node.fileCount === 0) continue;
      if (dupSigs.has(node.sig)) continue; // birebir aynı zaten yukarıda
      const key = node.name.toLowerCase();
      if (!byName.has(key)) byName.set(key, []);
      byName.get(key)!.push({ dm, node });
    }
  }
  const differing: DifferingGroup[] = [];
  for (const [, members] of byName) {
    const drvIds = new Set(members.map((m) => m.dm.id));
    if (drvIds.size < 2) continue; // en az 2 diskte aynı ad
    // her diske benzersiz dosyaları çıkar
    const fileSets = members.map((m) => ({
      m,
      files: descendantFiles(m.dm, m.node.rel),
    }));
    // tüm anahtarların kaç sette geçtiğini say
    const keyCount = new Map<string, number>();
    for (const fs of fileSets)
      for (const k of fs.files.keys())
        keyCount.set(k, (keyCount.get(k) || 0) + 1);
    const diffMembers: DiffMember[] = fileSets.map((fs) => {
      const unique: DiffMember["uniqueFiles"] = [];
      for (const [k, f] of fs.files)
        if ((keyCount.get(k) || 0) < fileSets.length)
          unique.push({ name: f.name, rel: f.rel, size: f.size });
      return {
        driveId: fs.m.dm.id,
        label: fs.m.dm.label,
        rel: fs.m.node.rel,
        uniqueFiles: unique.sort((a, b) => b.size - a.size),
      };
    });
    // sadece gerçekten farkı olanlar
    if (diffMembers.some((d) => d.uniqueFiles.length > 0)) {
      differing.push({ name: members[0].node.name, members: diffMembers });
    }
  }
  differing.sort(
    (a, b) =>
      b.members.reduce((s, m) => s + m.uniqueFiles.length, 0) -
      a.members.reduce((s, m) => s + m.uniqueFiles.length, 0)
  );

  return { identical, differing, driveCount: drives.length };
}
