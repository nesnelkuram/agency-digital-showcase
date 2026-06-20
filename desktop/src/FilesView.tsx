import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FileKind,
  IndexDoc,
  VolumeInfo,
  formatBytes,
  indexStatus,
  listDir,
  listVolumes,
  loadIndex,
  openPath,
  revealInFinder,
  scanDrive,
} from "./scannerApi";
import { getPreview } from "./previews";
import { CompareView } from "./CompareView";
import { useAuthUser } from "./hooks";
import {
  AssetLink,
  ProjectLite,
  removeLink,
  subscribeLinks,
  subscribeProjects,
  suggestProjects,
  upsertDrive,
  upsertLink,
} from "./firestoreData";

const SEEN_KEY = "intiba-seen-volumes";
interface SeenVolume {
  id: string;
  label: string;
  removable: boolean;
}
function loadSeen(): SeenVolume[] {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) || "[]");
  } catch {
    return [];
  }
}
function saveSeen(list: SeenVolume[]) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

const KIND_ICON: Record<FileKind, string> = {
  folder: "📁",
  video: "🎬",
  image: "🖼️",
  audio: "🎵",
  doc: "📄",
  other: "📦",
};

// ── ortak görüntü öğesi (canlı veya indeksten) ──
interface DisplayEntry {
  name: string;
  isDir: boolean;
  size: number;
  kind: FileKind;
  rel: string; // disk köküne göreli
  abs: string | null; // bağlı değilse null
}
interface ActiveDrive {
  id: string;
  label: string;
  mountPath: string | null; // bağlı değilse null
  connected: boolean;
  removable: boolean;
}

const relOf = (abs: string, mount: string) =>
  abs.slice(mount.replace(/\/$/, "").length).replace(/^\/+/, "");
const parentOf = (rel: string) => rel.split("/").slice(0, -1).join("/");
const joinAbs = (mount: string, rel: string) =>
  rel ? `${mount.replace(/\/$/, "")}/${rel}` : mount;

function PreviewThumb({
  driveId,
  rel,
  abs,
  kind,
}: {
  driveId: string;
  rel: string;
  abs: string | null;
  kind: FileKind;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  useEffect(() => {
    let alive = true;
    if (kind === "video" || kind === "image" || kind === "doc") {
      getPreview(driveId, rel, abs).then((u) => {
        if (alive) {
          setUrl(u);
          setTried(true);
        }
      });
    } else setTried(true);
    return () => {
      alive = false;
    };
  }, [driveId, rel, abs, kind]);

  if (url) return <img className="thumb-img" src={url} alt="" />;
  return (
    <div className="thumb-fallback">
      <span>{KIND_ICON[kind]}</span>
      {!tried && (kind === "video" || kind === "image") && (
        <span className="thumb-spin" />
      )}
    </div>
  );
}

function LinkPicker({
  folderRel,
  folderName,
  projects,
  onPick,
  onClose,
}: {
  folderRel: string;
  folderName: string;
  projects: ProjectLite[];
  onPick: (p: ProjectLite) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const suggested = useMemo(
    () => suggestProjects(folderRel, folderName, projects),
    [folderRel, folderName, projects]
  );
  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return projects;
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(n) ||
        p.clientName.toLowerCase().includes(n)
    );
  }, [q, projects]);

  return (
    <div className="picker-overlay" onClick={onClose}>
      <div className="picker" onClick={(e) => e.stopPropagation()}>
        <div className="picker-head">
          <strong>Klasörü bağla</strong>
          <span className="picker-sub">{folderName}</span>
        </div>
        {suggested.length > 0 && !q && (
          <div className="picker-section">
            <span className="d-label">Öneriler</span>
            {suggested.map((p) => (
              <button key={p.id} className="picker-row sug" onClick={() => onPick(p)}>
                <span className="pr-name">{p.name}</span>
                <span className="pr-client">{p.clientName}</span>
              </button>
            ))}
          </div>
        )}
        <input
          className="picker-search"
          placeholder="Proje veya marka ara…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
        <div className="picker-list">
          {filtered.map((p) => (
            <button key={p.id} className="picker-row" onClick={() => onPick(p)}>
              <span className="pr-name">{p.name}</span>
              <span className="pr-client">{p.clientName}</span>
            </button>
          ))}
          {filtered.length === 0 && <div className="empty">Proje bulunamadı</div>}
        </div>
      </div>
    </div>
  );
}

export function FilesView() {
  const { user } = useAuthUser();
  const [volumes, setVolumes] = useState<VolumeInfo[]>([]);
  const [seen, setSeen] = useState<SeenVolume[]>(loadSeen());
  const [indexMap, setIndexMap] = useState<Record<string, number | null>>({});
  const [active, setActive] = useState<ActiveDrive | null>(null);
  const [currentRel, setCurrentRel] = useState("");
  const [liveEntries, setLiveEntries] = useState<DisplayEntry[]>([]);
  const [indexDoc, setIndexDoc] = useState<IndexDoc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [projects, setProjects] = useState<ProjectLite[]>([]);
  const [links, setLinks] = useState<AssetLink[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [view, setView] = useState<"browse" | "compare">("browse");
  const mountRef = useRef<string | null>(null);

  // Firestore: projeler + eşlemeler
  useEffect(() => {
    if (!user?.tenantId) return;
    const u1 = subscribeProjects(user.tenantId, setProjects);
    const u2 = subscribeLinks(user.tenantId, setLinks);
    return () => {
      u1();
      u2();
    };
  }, [user?.tenantId]);

  // İndeks durumlarını tazele (bağlı + görülen tüm diskler)
  const refreshIndex = useCallback(async (ids: string[]) => {
    const map: Record<string, number | null> = {};
    await Promise.all(
      ids.map(async (id) => {
        map[id] = await indexStatus(id).catch(() => null);
      })
    );
    setIndexMap((prev) => ({ ...prev, ...map }));
  }, []);

  const refreshVolumes = useCallback(async () => {
    try {
      const vols = await listVolumes();
      setVolumes(vols);
      setSeen((prev) => {
        const map = new Map(prev.map((s) => [s.id, s]));
        for (const v of vols)
          map.set(v.id, { id: v.id, label: v.label, removable: v.is_removable });
        const merged = Array.from(map.values());
        saveSeen(merged);
        refreshIndex(merged.map((m) => m.id));
        return merged;
      });
      if (user?.tenantId)
        for (const v of vols)
          upsertDrive(user.tenantId, {
            id: v.id,
            label: v.label,
            totalBytes: v.total_bytes,
            freeBytes: v.free_bytes,
          }).catch(() => {});
    } catch (e: any) {
      setError(String(e));
    }
  }, [user?.tenantId, refreshIndex]);

  useEffect(() => {
    refreshVolumes();
    const id = setInterval(refreshVolumes, 5000);
    return () => clearInterval(id);
  }, [refreshVolumes]);

  // ── canlı klasör gezme ──
  const browseLive = useCallback(async (mount: string, rel: string) => {
    setLoading(true);
    setError(null);
    try {
      const items = await listDir(joinAbs(mount, rel));
      setLiveEntries(
        items.map((e) => ({
          name: e.name,
          isDir: e.is_dir,
          size: e.size,
          kind: e.kind,
          rel: relOf(e.path, mount),
          abs: e.path,
        }))
      );
      setCurrentRel(rel);
    } catch (e: any) {
      setError(String(e));
      setLiveEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const openDrive = async (v: { id: string; label: string }) => {
    const live = volumes.find((x) => x.id === v.id);
    if (live) {
      // BAĞLI → canlı
      mountRef.current = live.mount_path;
      setActive({
        id: live.id,
        label: live.label,
        mountPath: live.mount_path,
        connected: true,
        removable: live.is_removable,
      });
      setIndexDoc(null);
      browseLive(live.mount_path, "");
    } else if (indexMap[v.id]) {
      // BAĞLI DEĞİL ama indeksli → offline
      try {
        const doc = await loadIndex(v.id);
        setIndexDoc(doc);
        mountRef.current = null;
        setActive({
          id: v.id,
          label: v.label,
          mountPath: null,
          connected: false,
          removable: true,
        });
        setCurrentRel("");
      } catch (e: any) {
        setError(String(e));
      }
    }
  };

  const enterFolder = (e: DisplayEntry) => {
    if (!e.isDir || !active) return;
    if (active.connected && mountRef.current) browseLive(mountRef.current, e.rel);
    else setCurrentRel(e.rel);
  };

  const goUp = () => {
    if (!active || !currentRel) return;
    const parent = parentOf(currentRel);
    if (active.connected && mountRef.current) browseLive(mountRef.current, parent);
    else setCurrentRel(parent);
  };

  const doScan = async () => {
    if (!active?.connected || !active.mountPath) return;
    setScanning(true);
    setError(null);
    try {
      await scanDrive(active.mountPath, active.id);
      await refreshIndex([active.id]);
    } catch (e: any) {
      setError(String(e));
    } finally {
      setScanning(false);
    }
  };

  // ── görüntülenecek öğeler ──
  const entries: DisplayEntry[] = useMemo(() => {
    if (!active) return [];
    if (active.connected) return liveEntries;
    if (indexDoc) {
      return indexDoc.entries
        .filter((e) => parentOf(e.rel_path) === currentRel)
        .map((e) => ({
          name: e.name,
          isDir: e.is_dir,
          size: e.size,
          kind: e.kind,
          rel: e.rel_path,
          abs: null,
        }))
        .sort((a, b) =>
          a.isDir === b.isDir
            ? a.name.toLowerCase().localeCompare(b.name.toLowerCase())
            : a.isDir
            ? -1
            : 1
        );
    }
    return [];
  }, [active, liveEntries, indexDoc, currentRel]);

  const linkByRel = useMemo(() => {
    const m = new Map<string, AssetLink>();
    for (const l of links)
      if (!active || l.driveId === active.id) m.set(l.relPath, l);
    return m;
  }, [links, active]);
  const currentLink = active ? linkByRel.get(currentRel) : undefined;

  const doLink = async (p: ProjectLite) => {
    if (!user?.tenantId || !active) return;
    const folderName =
      currentRel.split("/").pop() || active.label;
    await upsertLink(user.tenantId, {
      driveId: active.id,
      driveLabel: active.label,
      relPath: currentRel,
      folderName,
      project: p,
    }).catch((e) => setError(String(e)));
    setPickerOpen(false);
  };

  const connectedIds = new Set(volumes.map((v) => v.id));
  const isExternal = (mount?: string) => !!mount && mount.startsWith("/Volumes/");
  const crumbs = currentRel ? currentRel.split("/").filter(Boolean) : [];

  // Karşılaştırma için indeksli diskler (bağlı veya offline farketmez)
  const indexedDrives = useMemo(() => {
    const m = new Map<string, string>();
    for (const v of volumes) if (indexMap[v.id]) m.set(v.id, v.label);
    for (const s of seen) if (indexMap[s.id]) m.set(s.id, s.label);
    return Array.from(m.entries()).map(([id, label]) => ({ id, label }));
  }, [volumes, seen, indexMap]);

  return (
    <div className="files-root">
      <div className="files-tabs" data-tauri-drag-region>
        <button
          className={`ftab${view === "browse" ? " active" : ""}`}
          onClick={() => setView("browse")}
        >
          📂 Gözat
        </button>
        <button
          className={`ftab${view === "compare" ? " active" : ""}`}
          onClick={() => setView("compare")}
        >
          ⇄ Karşılaştır
          {indexedDrives.length > 0 && (
            <span className="ftab-badge">{indexedDrives.length}</span>
          )}
        </button>
      </div>

      {view === "compare" ? (
        <CompareView drives={indexedDrives} />
      ) : (
    <div className="files">
      <aside className="files-side">
        <div className="files-side-head" data-tauri-drag-region>
          Diskler
        </div>
        <div className="vol-list">
          {/* bağlı diskler */}
          {volumes.map((v) => {
            const ext = isExternal(v.mount_path);
            const indexed = !!indexMap[v.id];
            return (
              <button
                key={v.id}
                className={`vol${active?.id === v.id ? " active" : ""}`}
                onClick={() => openDrive({ id: v.id, label: v.label })}
              >
                <span className="vol-dot online" />
                <div className="vol-main">
                  <div className="vol-label">{v.label}</div>
                  <div className="vol-sub">
                    {formatBytes(v.free_bytes)} boş
                    {ext ? (indexed ? " · indeksli ✓" : " · harici") : " · dahili"}
                  </div>
                </div>
              </button>
            );
          })}
          {/* görülen ama şu an bağlı OLMAYAN diskler */}
          {seen
            .filter((s) => !connectedIds.has(s.id))
            .map((s) => {
              const indexed = !!indexMap[s.id];
              return (
                <button
                  key={s.id}
                  className={`vol offline-btn${active?.id === s.id ? " active" : ""}`}
                  disabled={!indexed}
                  onClick={() => indexed && openDrive({ id: s.id, label: s.label })}
                  title={indexed ? "Offline gezinme (indeksli)" : "Bağlı değil, indekslenmemiş"}
                >
                  <span className="vol-dot" />
                  <div className="vol-main">
                    <div className="vol-label">{s.label}</div>
                    <div className="vol-sub">
                      {indexed ? "📴 offline — indeksli" : "⚠️ bağlı değil"}
                    </div>
                  </div>
                </button>
              );
            })}
          {volumes.length === 0 && seen.length === 0 && (
            <div className="empty">Disk bulunamadı</div>
          )}
        </div>
        {!user && (
          <div className="side-foot warn">Eşleme için popover'dan giriş yap</div>
        )}
      </aside>

      <main className="files-main">
        <div className="files-bar" data-tauri-drag-region>
          <button className="nav-btn" onClick={goUp} disabled={!currentRel}>
            ↑ Üst
          </button>
          <div className="crumbs">
            {active ? (
              <>
                <span className="crumb">{active.label}</span>
                {!active.connected && <span className="crumb off"> · 📴 offline</span>}
                {crumbs.map((c, i) => (
                  <span key={i} className="crumb">{` / ${c}`}</span>
                ))}
              </>
            ) : (
              <span className="crumb muted">Soldan bir disk seç</span>
            )}
          </div>

          {/* Tara — sadece bağlı harici diskler */}
          {active?.connected && isExternal(active.mountPath || "") && (
            <button className="nav-btn scan" onClick={doScan} disabled={scanning}>
              {scanning
                ? "Taranıyor…"
                : indexMap[active.id]
                ? "↻ Yeniden Tara"
                : "⤓ Tara (offline için)"}
            </button>
          )}

          {/* klasör → marka/proje */}
          {active && (
            <div className="link-bar">
              {currentLink ? (
                <>
                  <span className="link-chip">
                    🔗 {currentLink.projectName}
                    <span className="lc-client"> · {currentLink.clientName}</span>
                  </span>
                  <button
                    className="nav-btn"
                    onClick={() => removeLink(active.id, currentRel)}
                    title="Bağlantıyı kaldır"
                  >
                    ✕
                  </button>
                </>
              ) : (
                <button
                  className="link-btn"
                  disabled={!user}
                  onClick={() => setPickerOpen(true)}
                  title={user ? "" : "Giriş gerekli"}
                >
                  🔗 Markaya/Projeye Bağla
                </button>
              )}
            </div>
          )}
        </div>

        {error && <div className="error inline">{error}</div>}
        {loading && <div className="empty">Yükleniyor…</div>}

        {!loading && active && (
          <div className="grid">
            {entries.map((e) => {
              const link = e.isDir ? linkByRel.get(e.rel) : undefined;
              return (
                <div
                  key={e.rel || e.name}
                  className="cell"
                  onDoubleClick={() =>
                    e.isDir
                      ? enterFolder(e)
                      : e.abs
                      ? openPath(e.abs)
                      : setError("Dosyayı açmak için diski tak")
                  }
                  onClick={() => (e.isDir ? enterFolder(e) : undefined)}
                  title={e.name}
                >
                  <div className="thumb">
                    {e.isDir ? (
                      <div className="thumb-fallback">
                        <span>📁</span>
                      </div>
                    ) : (
                      <PreviewThumb
                        driveId={active.id}
                        rel={e.rel}
                        abs={e.abs}
                        kind={e.kind}
                      />
                    )}
                  </div>
                  <div className="cell-name">{e.name}</div>
                  <div className="cell-sub">
                    {e.isDir ? "klasör" : formatBytes(e.size)}
                  </div>
                  {link && <span className="cell-link">🔗 {link.projectName}</span>}
                  {!e.isDir && e.abs && (
                    <button
                      className="reveal"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        revealInFinder(e.abs!);
                      }}
                      title="Finder'da göster"
                    >
                      ⤷
                    </button>
                  )}
                </div>
              );
            })}
            {entries.length === 0 && <div className="empty">Boş klasör</div>}
          </div>
        )}
      </main>

      {pickerOpen && active && (
        <LinkPicker
          folderRel={currentRel}
          folderName={currentRel.split("/").pop() || active.label}
          projects={projects}
          onPick={doLink}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
      )}
    </div>
  );
}
