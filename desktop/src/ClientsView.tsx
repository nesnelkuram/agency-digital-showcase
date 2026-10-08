import { useEffect, useMemo, useState } from "react";
import { IndexDoc, formatBytes, loadIndex } from "./scannerApi";
import { AssetLink } from "./firestoreData";

interface DriveRef {
  id: string;
  label: string;
}

// "01_Clients" kökünün (büyük/küçük harf duyarsız) tanınması.
const CLIENTS_ROOT = "01_clients";

// Müşteri/proje adlarını eşlemek için sade normalizasyon (Türkçe dahil).
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const underPath = (rel: string, base: string) =>
  base === "" ? true : rel === base || rel.startsWith(base + "/");

// Bir projenin tek bir disk üstündeki konumu.
interface Loc {
  driveId: string;
  driveLabel: string;
  relPath: string;
  online: boolean;
  indexed: boolean;
  files: number;
  bytes: number;
  manual: boolean; // elle bağlandı mı (01_Clients dışı dağınık klasör)
}
interface Proj {
  key: string;
  name: string;
  locs: Map<string, Loc>; // driveId|relPath -> Loc
  files: number;
  bytes: number;
}
interface Client {
  key: string;
  name: string;
  projects: Proj[];
  driveCount: number;
  files: number;
  bytes: number;
}

// Müşteri-merkezli ekran: tüm disklerdeki (takılı + offline-indeksli) müşteri
// işlerini tek yerde, hangisinin nerede olduğu ile gösterir. Dosya taşımaz.
export function ClientsView({
  indexedDrives,
  onlineDriveIds,
  links,
  onOpen,
}: {
  indexedDrives: DriveRef[];
  onlineDriveIds: Set<string>;
  links: AssetLink[];
  onOpen: (driveId: string, relPath: string) => void;
}) {
  const [indexes, setIndexes] = useState<Record<string, IndexDoc>>({});
  const [q, setQ] = useState("");
  const [openSet, setOpenSet] = useState<Set<string>>(new Set());

  // İndeksli disklerin indekslerini yükle (otomatik keşif + boyut için).
  const driveKey = useMemo(
    () => indexedDrives.map((d) => d.id).sort().join(","),
    [indexedDrives]
  );
  useEffect(() => {
    let alive = true;
    const ids = driveKey ? driveKey.split(",") : [];
    (async () => {
      const acc: Record<string, IndexDoc> = {};
      for (const id of ids) {
        try {
          acc[id] = await loadIndex(id);
        } catch {
          /* indekssiz diski atla */
        }
      }
      if (alive) setIndexes(acc);
    })();
    return () => {
      alive = false;
    };
  }, [driveKey]);

  const labelFor = (id: string) =>
    indexedDrives.find((d) => d.id === id)?.label ||
    links.find((l) => l.driveId === id)?.driveLabel ||
    id;

  const clients: Client[] = useMemo(() => {
    // clientKey -> { name, projects: Map<projKey, Proj> }
    const cmap = new Map<string, { name: string; projects: Map<string, Proj> }>();

    const getClient = (name: string) => {
      const key = norm(name) || name.toLowerCase();
      let c = cmap.get(key);
      if (!c) {
        c = { name, projects: new Map() };
        cmap.set(key, c);
      }
      return c;
    };
    const getProj = (
      client: { projects: Map<string, Proj> },
      name: string
    ) => {
      const key = norm(name) || name.toLowerCase();
      let p = client.projects.get(key);
      if (!p) {
        p = { key, name, locs: new Map(), files: 0, bytes: 0 };
        client.projects.set(key, p);
      }
      return p;
    };
    const getLoc = (
      proj: Proj,
      info: Omit<Loc, "files" | "bytes">
    ): Loc => {
      const lk = `${info.driveId}|${info.relPath}`;
      let loc = proj.locs.get(lk);
      if (!loc) {
        loc = { ...info, files: 0, bytes: 0 };
        proj.locs.set(lk, loc);
      }
      return loc;
    };

    // 1) Otomatik keşif: her indeksten 01_Clients/<Müşteri>/<Proje> klasörleri.
    for (const [driveId, doc] of Object.entries(indexes)) {
      const online = onlineDriveIds.has(driveId);
      const driveLabel = labelFor(driveId);
      for (const e of doc.entries) {
        const parts = e.rel_path.split("/").filter(Boolean);
        if (parts.length < 3) continue; // 01_Clients / Müşteri / Proje gerekli
        if (parts[0].toLowerCase() !== CLIENTS_ROOT) continue;
        const clientName = parts[1];
        const projName = parts[2];
        const relPath = `${parts[0]}/${clientName}/${projName}`;
        const client = getClient(clientName);
        const proj = getProj(client, projName);
        const loc = getLoc(proj, {
          driveId,
          driveLabel,
          relPath,
          online,
          indexed: true,
          manual: false,
        });
        if (!e.is_dir) {
          loc.files += 1;
          loc.bytes += e.size;
        }
      }
    }

    // 2) Elle bağlananlar: AssetLink (01_Clients dışı dağınık klasörler dahil).
    for (const l of links) {
      const clientName = l.clientName || "—";
      const projName = l.projectName || l.folderName;
      const driveId = l.driveId;
      const online = onlineDriveIds.has(driveId);
      const indexed = !!indexes[driveId];
      const client = getClient(clientName);
      const proj = getProj(client, projName);
      const lk = `${driveId}|${l.relPath}`;
      const existed = proj.locs.has(lk);
      const loc = getLoc(proj, {
        driveId,
        driveLabel: l.driveLabel || labelFor(driveId),
        relPath: l.relPath,
        online,
        indexed,
        manual: true,
      });
      // Otomatik keşifte zaten sayıldıysa tekrar hesaplama. Yeni (dağınık)
      // konumsa ve indeks varsa, o yolun altındaki dosya/boyutu indeksten say.
      if (!existed && indexed) {
        const idx = indexes[driveId];
        for (const e of idx.entries) {
          if (e.is_dir) continue;
          if (underPath(e.rel_path, l.relPath)) {
            loc.files += 1;
            loc.bytes += e.size;
          }
        }
      }
    }

    // Toplamları hesapla + diziye çevir.
    const out: Client[] = [];
    for (const [key, c] of cmap) {
      const projects: Proj[] = [];
      for (const p of c.projects.values()) {
        const locArr = Array.from(p.locs.values());
        p.files = locArr.reduce((s, x) => s + x.files, 0);
        p.bytes = locArr.reduce((s, x) => s + x.bytes, 0);
        projects.push(p);
      }
      projects.sort((a, b) =>
        a.name.toLowerCase().localeCompare(b.name.toLowerCase())
      );
      const driveIds = new Set<string>();
      let files = 0;
      let bytes = 0;
      for (const p of projects) {
        files += p.files;
        bytes += p.bytes;
        for (const loc of p.locs.values()) driveIds.add(loc.driveId);
      }
      out.push({
        key,
        name: c.name,
        projects,
        driveCount: driveIds.size,
        files,
        bytes,
      });
    }

    const n = q.trim().toLowerCase();
    const filtered = n
      ? out.filter(
          (c) =>
            c.name.toLowerCase().includes(n) ||
            c.projects.some((p) => p.name.toLowerCase().includes(n))
        )
      : out;

    return filtered.sort((a, b) =>
      a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    );
  }, [indexes, links, onlineDriveIds, q]);

  const toggle = (key: string) =>
    setOpenSet((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const totalProjects = clients.reduce((s, c) => s + c.projects.length, 0);

  return (
    <div className="projects">
      <div className="projects-bar" data-tauri-drag-region>
        <div className="pb-title">
          Müşteriler
          <span className="pb-count">
            {clients.length} müşteri · {totalProjects} proje
          </span>
        </div>
        <input
          className="projects-search"
          placeholder="Müşteri veya proje ara…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {clients.length === 0 ? (
        <div className="projects-empty">
          {indexedDrives.length === 0
            ? "Henüz indeksli disk yok. Gözat'tan bir harici diski tara."
            : "Müşteri işi bulunamadı. Standart yapı: 01_Clients/<Müşteri>/<Proje>. Dağınık klasörleri Gözat'tan markaya/projeye bağlayabilirsin."}
        </div>
      ) : (
        <div className="projects-grid clients-grid">
          {clients.map((c) => {
            const expanded = openSet.has(c.key);
            return (
              <div key={c.key} className={`pcard ccard${expanded ? " open" : ""}`}>
                <button className="ccard-head" onClick={() => toggle(c.key)}>
                  <span className="ccard-caret">{expanded ? "▾" : "▸"}</span>
                  <div className="ccard-id">
                    <div className="pcard-name" title={c.name}>
                      {c.name}
                    </div>
                    <div className="pcard-client">
                      {c.projects.length} proje · {c.driveCount} disk
                    </div>
                  </div>
                  <div className="ccard-size">
                    {c.files > 0 ? formatBytes(c.bytes) : ""}
                  </div>
                </button>

                {expanded && (
                  <div className="cprojects">
                    {c.projects.map((p) => (
                      <div key={p.key} className="cproj">
                        <div className="cproj-name" title={p.name}>
                          {p.name}
                        </div>
                        <div className="pcard-locs">
                          {Array.from(p.locs.values()).map((loc, i) => {
                            const canOpen = loc.online || loc.indexed;
                            const state = loc.online
                              ? "online"
                              : loc.indexed
                              ? "offline"
                              : "unknown";
                            return (
                              <button
                                key={i}
                                className={`ploc ${state}${
                                  canOpen ? "" : " disabled"
                                }`}
                                disabled={!canOpen}
                                onClick={() =>
                                  canOpen && onOpen(loc.driveId, loc.relPath)
                                }
                                title={
                                  (loc.online
                                    ? "Takılı — aç"
                                    : loc.indexed
                                    ? "Offline (indeksli) — gez"
                                    : "Bağlı değil, indekssiz") +
                                  (loc.manual ? "\n(elle bağlandı)" : "") +
                                  `\n${loc.driveLabel} / ${loc.relPath}`
                                }
                              >
                                <span className="ploc-dot" />
                                {loc.driveLabel}
                                {loc.files > 0 && (
                                  <span className="ploc-meta">
                                    {" "}
                                    {formatBytes(loc.bytes)}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
