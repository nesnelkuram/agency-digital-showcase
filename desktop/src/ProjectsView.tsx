import { useEffect, useMemo, useState } from "react";
import { IndexDoc, formatBytes, loadIndex } from "./scannerApi";
import { AssetLink, ProjectLite } from "./firestoreData";
import { NewProjectModal } from "./NewProjectModal";

interface DriveRef {
  id: string;
  label: string;
}
interface ConnDrive {
  id: string;
  label: string;
  mountPath: string;
}

// Bir projenin tek bir disk üstündeki konumu.
interface Location {
  driveId: string;
  driveLabel: string;
  relPath: string;
  folderName: string;
  online: boolean;
  indexed: boolean;
  files: number;
  bytes: number;
}
interface ProjectCard {
  id: string;
  name: string;
  clientName: string;
  status?: string;
  locations: Location[];
  files: number;
  bytes: number;
}

const underPath = (rel: string, base: string) =>
  base === "" ? true : rel === base || rel.startsWith(base + "/");

// Proje-merkezli ana ekran: tüm projeler + her birinin dağıtık disklerdeki yeri.
export function ProjectsView({
  projects,
  links,
  indexedDrives,
  connectedDrives,
  onlineDriveIds,
  onOpen,
}: {
  projects: ProjectLite[];
  links: AssetLink[];
  indexedDrives: DriveRef[];
  connectedDrives: ConnDrive[];
  onlineDriveIds: Set<string>;
  onOpen: (driveId: string, relPath: string) => void;
}) {
  const [indexes, setIndexes] = useState<Record<string, IndexDoc>>({});
  const [q, setQ] = useState("");
  const [newOpen, setNewOpen] = useState(false);

  // İndeksli disklerin indekslerini yükle (konum başına dosya/boyut için).
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

  // Eşlemeleri projeye göre grupla + indeksten dosya/boyut hesapla.
  const cards: ProjectCard[] = useMemo(() => {
    const linksByProject = new Map<string, AssetLink[]>();
    for (const l of links) {
      const key = l.projectId || l.projectName || "";
      if (!key) continue;
      const arr = linksByProject.get(key) || [];
      arr.push(l);
      linksByProject.set(key, arr);
    }

    const statFor = (driveId: string, relPath: string) => {
      const doc = indexes[driveId];
      if (!doc) return { files: 0, bytes: 0 };
      let files = 0;
      let bytes = 0;
      for (const e of doc.entries) {
        if (e.is_dir) continue;
        if (underPath(e.rel_path, relPath)) {
          files++;
          bytes += e.size;
        }
      }
      return { files, bytes };
    };

    const build = (id: string, name: string, clientName: string, status?: string): ProjectCard => {
      const ls = linksByProject.get(id) || [];
      const locations: Location[] = ls.map((l) => {
        const { files, bytes } = statFor(l.driveId, l.relPath);
        return {
          driveId: l.driveId,
          driveLabel: l.driveLabel,
          relPath: l.relPath,
          folderName: l.folderName,
          online: onlineDriveIds.has(l.driveId),
          indexed: !!indexes[l.driveId],
          files,
          bytes,
        };
      });
      return {
        id,
        name,
        clientName,
        status,
        locations,
        files: locations.reduce((s, x) => s + x.files, 0),
        bytes: locations.reduce((s, x) => s + x.bytes, 0),
      };
    };

    // Bilinen projeler + eşlemesi olup proje kaydı silinmiş "yetim" gruplar.
    const known = projects.map((p) => build(p.id, p.name, p.clientName, p.status));
    const knownIds = new Set(projects.map((p) => p.id));
    const orphans: ProjectCard[] = [];
    for (const [key, ls] of linksByProject) {
      if (knownIds.has(key)) continue;
      orphans.push(build(key, ls[0].projectName || "Bilinmeyen proje", ls[0].clientName || "—"));
    }

    const all = [...known, ...orphans];
    const n = q.trim().toLowerCase();
    const filtered = n
      ? all.filter(
          (c) =>
            c.name.toLowerCase().includes(n) ||
            c.clientName.toLowerCase().includes(n)
        )
      : all;

    // Dosyası olanlar önce, sonra ada göre.
    return filtered.sort((a, b) => {
      if ((a.files > 0) !== (b.files > 0)) return a.files > 0 ? -1 : 1;
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });
  }, [projects, links, indexes, onlineDriveIds, q]);

  const linkedCount = cards.filter((c) => c.locations.length > 0).length;

  return (
    <div className="projects">
      <div className="projects-bar" data-tauri-drag-region>
        <div className="pb-title">
          Projeler
          <span className="pb-count">
            {cards.length} proje · {linkedCount} bağlı
          </span>
        </div>
        <div className="pb-actions">
          <input
            className="projects-search"
            placeholder="Proje veya marka ara…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button
            className="pb-new"
            onClick={() => setNewOpen(true)}
            disabled={connectedDrives.length === 0}
            title={
              connectedDrives.length === 0
                ? "Önce bir disk tak"
                : "Standart klasör yapısıyla yeni proje"
            }
          >
            ＋ Yeni Proje
          </button>
        </div>
      </div>

      {cards.length === 0 ? (
        <div className="projects-empty">
          {projects.length === 0
            ? "Henüz proje yok. Web panelinden proje oluştur."
            : "Eşleşen proje yok."}
        </div>
      ) : (
        <div className="projects-grid">
          {cards.map((c) => (
            <div key={c.id} className="pcard">
              <div className="pcard-top">
                <div className="pcard-name" title={c.name}>
                  {c.name}
                </div>
                <div className="pcard-client">{c.clientName}</div>
              </div>

              {c.locations.length === 0 ? (
                <div className="pcard-nolink">Henüz dosya bağlı değil</div>
              ) : (
                <>
                  <div className="pcard-locs">
                    {c.locations.map((loc, i) => {
                      const canOpen = loc.online || loc.indexed;
                      const state = loc.online
                        ? "online"
                        : loc.indexed
                        ? "offline"
                        : "unknown";
                      return (
                        <button
                          key={i}
                          className={`ploc ${state}${canOpen ? "" : " disabled"}`}
                          disabled={!canOpen}
                          onClick={() => canOpen && onOpen(loc.driveId, loc.relPath)}
                          title={
                            (loc.online
                              ? "Takılı — aç"
                              : loc.indexed
                              ? "Offline (indeksli) — gez"
                              : "Bağlı değil, indekssiz") +
                            `\n${loc.driveLabel} / ${loc.relPath || "(kök)"}`
                          }
                        >
                          <span className="ploc-dot" />
                          {loc.driveLabel}
                        </button>
                      );
                    })}
                  </div>
                  <div className="pcard-stats">
                    {c.files > 0 ? (
                      <>
                        <span>
                          <b>{c.files}</b> dosya
                        </span>
                        <span>{formatBytes(c.bytes)}</span>
                      </>
                    ) : (
                      <span className="muted">indeks yok — boyut bilinmiyor</span>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {newOpen && (
        <NewProjectModal
          drives={connectedDrives}
          projects={projects}
          onClose={() => setNewOpen(false)}
        />
      )}
    </div>
  );
}
