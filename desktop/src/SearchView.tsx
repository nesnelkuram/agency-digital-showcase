import { useEffect, useMemo, useState } from "react";
import {
  FileKind,
  IndexDoc,
  formatBytes,
  loadIndex,
  openPath,
  revealInFinder,
} from "./scannerApi";

interface DriveRef {
  id: string;
  label: string;
}

const KIND_ICON: Record<FileKind, string> = {
  folder: "📁",
  video: "🎬",
  image: "🖼️",
  audio: "🎵",
  doc: "📄",
  other: "📦",
};

const KINDS: Array<FileKind | "all"> = [
  "all",
  "video",
  "image",
  "audio",
  "doc",
  "folder",
  "other",
];
const KIND_LABEL: Record<string, string> = {
  all: "Tümü",
  folder: "Klasör",
  video: "Video",
  image: "Görsel",
  audio: "Ses",
  doc: "Belge",
  other: "Diğer",
};

interface LoadedDrive {
  id: string;
  label: string;
  doc: IndexDoc;
}
interface Hit {
  driveId: string;
  driveLabel: string;
  rel: string;
  name: string;
  isDir: boolean;
  size: number;
  kind: FileKind;
  abs: string | null; // disk bağlıysa açılabilir, değilse null
}

const LIMIT = 500;
const joinAbs = (mount: string, rel: string) =>
  rel ? `${mount.replace(/\/$/, "")}/${rel}` : mount;
const parentOf = (rel: string) => rel.split("/").slice(0, -1).join("/");

// Tüm indeksli disklerde (bağlı + offline) ad bazlı arama.
export function SearchView({
  drives,
  connectedMounts,
}: {
  drives: DriveRef[];
  connectedMounts: Map<string, string>;
}) {
  const [loaded, setLoaded] = useState<LoadedDrive[]>([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState("");
  const [q, setQ] = useState("");
  const [kindFilter, setKindFilter] = useState<FileKind | "all">("all");

  // Disk kümesinin KİMLİK anahtarı — ID seti değişince indeksleri tazele.
  const driveKey = useMemo(
    () => drives.map((d) => d.id).sort().join(","),
    [drives]
  );

  useEffect(() => {
    let alive = true;
    const list = driveKey ? driveKey.split(",") : [];
    const labelById = new Map(drives.map((d) => [d.id, d.label]));
    (async () => {
      setLoading(true);
      const acc: LoadedDrive[] = [];
      for (let i = 0; i < list.length; i++) {
        if (!alive) return;
        const id = list[i];
        const label = labelById.get(id) || id;
        setProgress(`${i + 1}/${list.length} · ${label}`);
        try {
          const doc = await loadIndex(id);
          acc.push({ id, label, doc });
        } catch {
          /* indeksi okunamayan diski atla */
        }
      }
      if (!alive) return;
      setLoaded(acc);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
    // sadece disk kümesi (ID'ler) değişince yeniden yükle
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driveKey]);

  const { hits, total } = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return { hits: [] as Hit[], total: 0 };
    const out: Hit[] = [];
    let count = 0;
    for (const d of loaded) {
      const mount = connectedMounts.get(d.id) || null;
      for (const e of d.doc.entries) {
        if (kindFilter !== "all" && e.kind !== kindFilter) continue;
        if (!e.name.toLowerCase().includes(needle)) continue;
        count++;
        if (out.length < LIMIT) {
          out.push({
            driveId: d.id,
            driveLabel: d.label,
            rel: e.rel_path,
            name: e.name,
            isDir: e.is_dir,
            size: e.size,
            kind: e.kind,
            abs: mount ? joinAbs(mount, e.rel_path) : null,
          });
        }
      }
    }
    out.sort((a, b) =>
      a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    );
    return { hits: out, total: count };
  }, [q, loaded, kindFilter, connectedMounts]);

  if (drives.length === 0) {
    return (
      <div className="search">
        <div className="empty big">
          Arama için <b>indeksli disk</b> gerekir.
          <br />
          Diskleri "Gözat" sekmesinde <b>⤓ Tara</b> ile indeksle.
        </div>
      </div>
    );
  }

  return (
    <div className="search">
      <div className="search-bar" data-tauri-drag-region>
        <input
          className="search-input"
          placeholder={
            loading
              ? "İndeksler yükleniyor…"
              : `Tüm disklerde ara (${loaded.length} disk)…`
          }
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
          disabled={loading}
        />
        <div className="search-kinds">
          {KINDS.map((k) => (
            <button
              key={k}
              className={`kchip${kindFilter === k ? " active" : ""}`}
              onClick={() => setKindFilter(k)}
            >
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="empty">{progress || "Yükleniyor…"}</div>}

      {!loading && q.trim().length >= 2 && (
        <div className="search-meta">
          {total === 0
            ? "Sonuç yok"
            : `${total} sonuç${
                total > LIMIT ? ` · ilk ${LIMIT} gösteriliyor` : ""
              }`}
        </div>
      )}

      {!loading && q.trim().length < 2 && (
        <div className="empty">En az 2 karakter yaz…</div>
      )}

      {!loading && (
        <div className="search-results">
          {hits.map((h, i) => {
            const dir = parentOf(h.rel);
            return (
              <div
                key={`${h.driveId}:${h.rel}:${i}`}
                className="sres"
                onDoubleClick={() =>
                  h.abs && !h.isDir ? openPath(h.abs) : undefined
                }
                title={h.abs || `${h.driveLabel} / ${h.rel}`}
              >
                <span className="sres-icon">{KIND_ICON[h.kind]}</span>
                <div className="sres-main">
                  <div className="sres-name">{h.name}</div>
                  <div className="sres-path">
                    <span className="sres-drive">{h.driveLabel}</span>
                    {!h.abs && <span className="sres-off"> · 📴 bağlı değil</span>}
                    {dir && <span> · {dir}</span>}
                  </div>
                </div>
                <span className="sres-size">
                  {h.isDir ? "klasör" : formatBytes(h.size)}
                </span>
                {h.abs && (
                  <button
                    className="sres-reveal"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      revealInFinder(h.abs!);
                    }}
                    title="Finder'da göster"
                  >
                    ⤷
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
