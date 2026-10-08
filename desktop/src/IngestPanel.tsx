import { useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  CardInfo,
  OffloadProgress,
  OffloadSummary,
  detectCard,
  formatBytes,
  offloadCard,
  onOffloadProgress,
  revealInFinder,
} from "./scannerApi";

type Phase = "detecting" | "ready" | "running" | "done" | "error";

const BRAND_ICON: Record<string, string> = {
  Sony: "🎥",
  Canon: "📷",
  Panasonic: "🎬",
};

// Kamera kartı aktarım paneli — doğrulanmış kopya (xxHash), çoklu hedef.
export function IngestPanel({
  mount,
  label,
  onClose,
  onDone,
}: {
  mount: string;
  label: string;
  onClose: () => void;
  onDone?: (s: OffloadSummary) => void;
}) {
  const [phase, setPhase] = useState<Phase>("detecting");
  const [card, setCard] = useState<CardInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dests, setDests] = useState<string[]>([]);
  const [verify, setVerify] = useState(true);
  const [prog, setProg] = useState<OffloadProgress | null>(null);
  const [summary, setSummary] = useState<OffloadSummary | null>(null);
  const unlistenRef = useRef<null | (() => void)>(null);

  // Kartı algıla
  useEffect(() => {
    let alive = true;
    setPhase("detecting");
    detectCard(mount)
      .then((c) => {
        if (!alive) return;
        setCard(c);
        setPhase("ready");
      })
      .catch((e) => {
        if (!alive) return;
        setError(String(e));
        setPhase("error");
      });
    return () => {
      alive = false;
    };
  }, [mount]);

  // Abonelik temizliği
  useEffect(
    () => () => {
      unlistenRef.current?.();
    },
    []
  );

  const addDest = async () => {
    try {
      const picked = await open({
        directory: true,
        multiple: false,
        title: "Aktarım hedefi seç",
      });
      if (typeof picked === "string" && !dests.includes(picked)) {
        setDests((d) => [...d, picked]);
      }
    } catch (e) {
      setError(String(e));
    }
  };

  const start = async () => {
    if (dests.length === 0 || !card) return;
    setPhase("running");
    setError(null);
    setSummary(null);
    setProg(null);
    // Önce dinlemeye başla, sonra aktarımı tetikle.
    const un = await onOffloadProgress((p) => setProg(p));
    unlistenRef.current = un;
    try {
      const s = await offloadCard(mount, label, dests, verify);
      setSummary(s);
      setPhase("done");
      onDone?.(s);
    } catch (e) {
      setError(String(e));
      setPhase("error");
    } finally {
      un();
      unlistenRef.current = null;
    }
  };

  const pct =
    prog && prog.bytes_total > 0
      ? Math.min(100, Math.round((prog.bytes_done / prog.bytes_total) * 100))
      : 0;

  return (
    <div className="picker-overlay" onClick={phase === "running" ? undefined : onClose}>
      <div className="ingest" onClick={(e) => e.stopPropagation()}>
        <div className="ingest-head">
          <strong>🎬 Karttan Aktar</strong>
          <span className="picker-sub">{label}</span>
          {phase !== "running" && (
            <button className="ingest-x" onClick={onClose} title="Kapat">
              ✕
            </button>
          )}
        </div>

        {phase === "detecting" && (
          <div className="empty">Kart taranıyor…</div>
        )}

        {error && <div className="error inline">{error}</div>}

        {card && phase !== "detecting" && (
          <div className="ingest-card">
            <div className="ic-badge">
              {card.brand ? BRAND_ICON[card.brand] || "🎬" : "💾"}
              <span>
                {card.brand ? `${card.brand} kartı` : "Kamera kartı"}
                {!card.is_card && " (belirsiz)"}
              </span>
            </div>
            <div className="ic-stats">
              <span>
                <b>{card.clip_count}</b> klip
              </span>
              <span>
                <b>{card.file_count}</b> dosya
              </span>
              <span>
                <b>{formatBytes(card.total_bytes)}</b> toplam
              </span>
            </div>
            {card.markers.length > 0 && (
              <div className="ic-markers">
                {card.markers.map((m) => (
                  <span key={m} className="ic-marker">
                    {m}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Hedefler */}
        {(phase === "ready" || phase === "running") && (
          <div className="ingest-dests">
            <div className="id-head">
              <span className="d-label">Hedefler (eş zamanlı kopya)</span>
              {phase === "ready" && (
                <button className="link-btn sm" onClick={addDest}>
                  ＋ Hedef Ekle
                </button>
              )}
            </div>
            {dests.length === 0 && (
              <div className="empty sm">
                En az bir hedef seç. İki hedef = anlık yedek (3-2-1).
              </div>
            )}
            {dests.map((d) => (
              <div key={d} className="id-row">
                <span className="id-path" title={d}>
                  📁 {d}
                </span>
                {phase === "ready" && (
                  <button
                    className="id-rm"
                    onClick={() => setDests((x) => x.filter((p) => p !== d))}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <label className="id-verify">
              <input
                type="checkbox"
                checked={verify}
                disabled={phase === "running"}
                onChange={(e) => setVerify(e.target.checked)}
              />
              Kopya sonrası doğrula (xxHash) — önerilir
            </label>
          </div>
        )}

        {/* İlerleme */}
        {phase === "running" && (
          <div className="ingest-prog">
            <div className="ip-bar">
              <div className="ip-fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="ip-meta">
              <span>
                {prog?.phase === "verify" ? "🔎 Doğrulanıyor" : "⤓ Kopyalanıyor"} ·{" "}
                {prog ? `${prog.file_index}/${prog.file_total}` : "…"}
              </span>
              <span>
                {prog ? formatBytes(prog.bytes_done) : "0"} /{" "}
                {prog ? formatBytes(prog.bytes_total) : "?"}
                {prog && prog.speed_bps > 0 && (
                  <> · {formatBytes(prog.speed_bps)}/sn</>
                )}
              </span>
            </div>
            {prog?.file_name && (
              <div className="ip-file" title={prog.file_name}>
                {prog.file_name}
              </div>
            )}
          </div>
        )}

        {/* Özet */}
        {phase === "done" && summary && (
          <div className="ingest-summary">
            <div className={`is-head ${summary.failed > 0 ? "warn" : "ok"}`}>
              {summary.failed > 0
                ? `⚠️ ${summary.failed} dosya başarısız`
                : "✓ Aktarım tamam — tümü doğrulandı"}
            </div>
            <div className="ic-stats">
              <span>
                <b>{summary.copied}</b> kopyalandı
              </span>
              <span>
                <b>{summary.verified}</b> doğrulandı
              </span>
              <span>
                <b>{formatBytes(summary.total_bytes)}</b>
              </span>
              <span>{Math.round(summary.elapsed_ms / 1000)} sn</span>
            </div>
            {summary.dest_roots.map((r) => (
              <button
                key={r}
                className="id-row link"
                onClick={() => revealInFinder(r)}
                title="Finder'da göster"
              >
                <span className="id-path">📂 {r}</span>
                <span className="id-rm">⤷</span>
              </button>
            ))}
            {summary.failures.length > 0 && (
              <div className="is-fails">
                {summary.failures.slice(0, 8).map((f, i) => (
                  <div key={i} className="is-fail">
                    {f}
                  </div>
                ))}
                {summary.failures.length > 8 && (
                  <div className="is-fail">
                    +{summary.failures.length - 8} daha…
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Aksiyonlar */}
        <div className="ingest-actions">
          {phase === "ready" && (
            <button
              className="ingest-go"
              disabled={dests.length === 0}
              onClick={start}
            >
              ⤓ Aktarımı Başlat
            </button>
          )}
          {phase === "running" && (
            <span className="ingest-running">Aktarılıyor — kartı çıkarma…</span>
          )}
          {(phase === "done" || phase === "error") && (
            <button className="ingest-go" onClick={onClose}>
              Kapat
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
