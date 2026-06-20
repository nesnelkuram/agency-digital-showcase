import { useEffect, useMemo, useState } from "react";
import { IndexDoc, formatBytes, loadIndex } from "./scannerApi";
import { CompareResult, compareFolders } from "./folderCompare";

const PALETTE = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#a855f7", "#ec4899", "#84cc16"];

interface DriveRef {
  id: string;
  label: string;
}

export function CompareView({ drives }: { drives: DriveRef[] }) {
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<CompareResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"identical" | "differing">("identical");
  const [expanded, setExpanded] = useState<string | null>(null);

  // Disk kümesinin KİMLİK anahtarı — referans değil, ID seti değişince yenile.
  const driveKey = useMemo(
    () => drives.map((d) => d.id).sort().join(","),
    [drives]
  );

  const colorOf = useMemo(() => {
    const m = new Map<string, string>();
    [...drives]
      .sort((a, b) => a.id.localeCompare(b.id))
      .forEach((d, i) => m.set(d.id, PALETTE[i % PALETTE.length]));
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driveKey]);

  useEffect(() => {
    let alive = true;
    const list = driveKey ? driveKey.split(",") : [];
    const labelById = new Map(drives.map((d) => [d.id, d.label]));
    (async () => {
      setLoading(true);
      setError(null);
      const indexes: Array<{ id: string; label: string; doc: IndexDoc }> = [];
      for (let i = 0; i < list.length; i++) {
        if (!alive) return;
        const id = list[i];
        const label = labelById.get(id) || id;
        setProgress(`${i + 1}/${list.length} · ${label}`);
        try {
          const doc = await loadIndex(id);
          indexes.push({ id, label, doc });
        } catch {
          /* atla */
        }
      }
      if (!alive) return;
      try {
        setResult(compareFolders(indexes));
      } catch (e: any) {
        setError(String(e));
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
    // sadece disk kümesi (ID'ler) değişince yeniden yükle
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driveKey]);

  const reclaimable = useMemo(
    () =>
      result?.identical.reduce(
        (s, g) => s + g.totalSize * (g.members.length - 1),
        0
      ) ?? 0,
    [result]
  );

  if (drives.length < 2) {
    return (
      <div className="compare">
        <div className="empty big">
          Karşılaştırma için en az <b>2 indeksli disk</b> gerekir.
          <br />
          Diskleri "Gözat" sekmesinde <b>⤓ Tara</b> ile indeksle.
        </div>
      </div>
    );
  }

  return (
    <div className="compare">
      <div className="compare-head">
        <div className="compare-summary">
          {loading ? (
            <span>Diskler okunuyor… {progress}</span>
          ) : (
            <>
              <b>{result?.identical.length ?? 0}</b> birebir aynı klasör ·{" "}
              <span className="redundant">{formatBytes(reclaimable)}</span>{" "}
              kazanılabilir · {result?.driveCount ?? drives.length} disk
            </>
          )}
        </div>
        <div className="compare-legend">
          {drives.map((d) => (
            <span key={d.id} className="leg">
              <span className="leg-dot" style={{ background: colorOf.get(d.id) }} />
              {d.label}
            </span>
          ))}
        </div>
      </div>

      {!loading && result && (
        <div className="compare-filters">
          <button
            className={`chip${tab === "identical" ? " active" : ""}`}
            onClick={() => setTab("identical")}
          >
            ✓ Birebir aynı ({result.identical.length})
          </button>
          <button
            className={`chip${tab === "differing" ? " active" : ""}`}
            onClick={() => setTab("differing")}
          >
            ⚠️ Aynı ad, farklı içerik ({result.differing.length})
          </button>
        </div>
      )}

      {error && <div className="error inline">{error}</div>}
      {loading && <div className="empty">Klasörler karşılaştırılıyor… {progress}</div>}

      {!loading && result && tab === "identical" && (
        <div className="dup-list">
          {result.identical.map((g) => {
            const open = expanded === g.id;
            return (
              <div key={g.id} className={`dup${open ? " open" : ""}`}>
                <div className="dup-row" onClick={() => setExpanded(open ? null : g.id)}>
                  <span className="dup-icon">📁</span>
                  <span className="dup-name" title={g.name}>
                    {g.name}
                  </span>
                  <span className="dup-meta">{g.fileCount} dosya</span>
                  <span className="dup-size">{formatBytes(g.totalSize)}</span>
                  <span className="dup-count">×{g.members.length}</span>
                  <span className="dup-drives">
                    {g.members.map((m) => (
                      <span
                        key={m.driveId}
                        className="dbadge"
                        style={{ background: colorOf.get(m.driveId) }}
                        title={m.label}
                      >
                        {m.label}
                      </span>
                    ))}
                  </span>
                </div>
                {open && (
                  <div className="dup-detail">
                    {g.members.map((m) => (
                      <div key={m.driveId} className="dup-loc">
                        <span
                          className="dbadge"
                          style={{ background: colorOf.get(m.driveId) }}
                        >
                          {m.label}
                        </span>
                        <div className="dup-path">/{m.rel}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {result.identical.length === 0 && (
            <div className="empty">Birebir aynı klasör yok 🎉</div>
          )}
        </div>
      )}

      {!loading && result && tab === "differing" && (
        <div className="dup-list">
          {result.differing.map((g, gi) => {
            const id = `${g.name}-${gi}`;
            const open = expanded === id;
            const totalUnique = g.members.reduce(
              (s, m) => s + m.uniqueFiles.length,
              0
            );
            return (
              <div key={id} className={`dup${open ? " open" : ""}`}>
                <div className="dup-row" onClick={() => setExpanded(open ? null : id)}>
                  <span className="dup-icon">⚠️</span>
                  <span className="dup-name" title={g.name}>
                    {g.name}
                  </span>
                  <span className="dup-meta">{totalUnique} farklı dosya</span>
                  <span className="dup-drives">
                    {g.members.map((m) => (
                      <span
                        key={m.driveId}
                        className="dbadge"
                        style={{ background: colorOf.get(m.driveId) }}
                        title={m.label}
                      >
                        {m.label} {m.uniqueFiles.length > 0 ? `+${m.uniqueFiles.length}` : "✓"}
                      </span>
                    ))}
                  </span>
                </div>
                {open && (
                  <div className="dup-detail">
                    {g.members
                      .filter((m) => m.uniqueFiles.length > 0)
                      .map((m) => (
                        <div key={m.driveId} className="dup-loc">
                          <span
                            className="dbadge"
                            style={{ background: colorOf.get(m.driveId) }}
                          >
                            sadece {m.label}
                          </span>
                          <div className="dup-paths">
                            {m.uniqueFiles.slice(0, 30).map((f, i) => (
                              <div key={i} className="dup-path">
                                {f.rel} · {formatBytes(f.size)}
                              </div>
                            ))}
                            {m.uniqueFiles.length > 30 && (
                              <div className="dup-path">
                                … +{m.uniqueFiles.length - 30} dosya
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            );
          })}
          {result.differing.length === 0 && (
            <div className="empty">Aynı adlı farklı klasör yok</div>
          )}
        </div>
      )}
    </div>
  );
}
