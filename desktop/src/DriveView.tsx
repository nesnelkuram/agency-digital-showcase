import { useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  DriveFolder,
  DriveProgress,
  DriveStatus,
  DriveSummary,
  SharedDrive,
  driveConnect,
  driveDisconnect,
  driveListFolders,
  driveListSharedDrives,
  driveSetCredentials,
  driveStatus,
  driveUpload,
  formatBytes,
  onDriveProgress,
} from "./scannerApi";

interface Crumb {
  id: string;
  name: string;
}

// Google Drive'a kaldığı yerden devam eden (resumable) yükleme.
export function DriveView() {
  const [status, setStatus] = useState<DriveStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [showCreds, setShowCreds] = useState(false);

  const [paths, setPaths] = useState<string[]>([]);
  const [newSub, setNewSub] = useState(""); // opsiyonel yeni alt klasör adı
  const [verify, setVerify] = useState(true);
  const [prog, setProg] = useState<DriveProgress | null>(null);
  const [summary, setSummary] = useState<DriveSummary | null>(null);
  const [shared, setShared] = useState<SharedDrive[]>([]);
  const [target, setTarget] = useState<string>(""); // "" = My Drive, else driveId
  // klasör gezgini
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [crumbs, setCrumbs] = useState<Crumb[]>([]); // boş = kök
  const [loadingFolders, setLoadingFolders] = useState(false);
  const unlistenRef = useRef<null | (() => void)>(null);

  const currentParentId = crumbs.length ? crumbs[crumbs.length - 1].id : null;
  const targetLabel =
    target === ""
      ? "My Drive"
      : shared.find((d) => d.id === target)?.name || "Ortak sürücü";

  const loadFolders = (driveId: string, parentId: string | null) => {
    setLoadingFolders(true);
    driveListFolders(driveId || null, parentId)
      .then(setFolders)
      .catch((e) => setError(String(e)))
      .finally(() => setLoadingFolders(false));
  };
  const enterFolder = (f: DriveFolder) => {
    const next = [...crumbs, { id: f.id, name: f.name }];
    setCrumbs(next);
    loadFolders(target, f.id);
  };
  const goToCrumb = (idx: number) => {
    // idx = -1 → kök
    const next = crumbs.slice(0, idx + 1);
    setCrumbs(next);
    loadFolders(target, next.length ? next[next.length - 1].id : null);
  };

  const refresh = () =>
    driveStatus()
      .then((s) => {
        setStatus(s);
        if (s.connected) loadShared();
      })
      .catch((e) => setError(String(e)));

  const loadShared = () =>
    driveListSharedDrives()
      .then(setShared)
      .catch(() => setShared([]));

  useEffect(() => {
    refresh();
    return () => unlistenRef.current?.();
  }, []);

  // Bağlanınca / hedef sürücü değişince klasör gezginini köke al + yükle.
  useEffect(() => {
    if (status?.connected) {
      setCrumbs([]);
      loadFolders(target, null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.connected, target]);

  const saveCreds = async () => {
    setError(null);
    try {
      await driveSetCredentials(clientId, clientSecret);
      setShowCreds(false);
      setClientSecret("");
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  };

  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      await driveConnect(); // tarayıcı açılır, kullanıcı onaylar
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    await driveDisconnect().catch(() => {});
    refresh();
  };

  const pickFiles = async () => {
    const sel = await open({ multiple: true, title: "Yüklenecek dosyalar" });
    if (Array.isArray(sel)) setPaths((p) => [...new Set([...p, ...sel])]);
    else if (typeof sel === "string") setPaths((p) => [...new Set([...p, sel])]);
  };
  const pickFolder = async () => {
    const sel = await open({ directory: true, title: "Yüklenecek klasör" });
    if (typeof sel === "string") setPaths((p) => [...new Set([...p, sel])]);
  };

  const startUpload = async () => {
    if (paths.length === 0) return;
    setBusy(true);
    setError(null);
    setSummary(null);
    setProg(null);
    const un = await onDriveProgress((p) => setProg(p));
    unlistenRef.current = un;
    try {
      const s = await driveUpload(
        paths,
        target || null,
        currentParentId,
        newSub.trim() || null,
        verify
      );
      setSummary(s);
    } catch (e) {
      setError(String(e));
    } finally {
      un();
      unlistenRef.current = null;
      setBusy(false);
    }
  };

  const pct =
    prog && prog.bytes_total > 0
      ? Math.min(100, Math.round((prog.bytes_done / prog.bytes_total) * 100))
      : 0;

  if (!status) return <div className="drive"><div className="empty">Yükleniyor…</div></div>;

  return (
    <div className="drive">
      <div className="drive-head" data-tauri-drag-region>
        <div className="dh-title">☁️ Google Drive</div>
        {status.connected && (
          <div className="dh-acct">
            <span className="vol-dot online" /> {status.email || "bağlı"}
            <button className="nav-btn sm" onClick={disconnect}>
              Bağlantıyı Kes
            </button>
          </div>
        )}
      </div>

      {error && <div className="error inline">{error}</div>}

      {/* 1) Kurulum: OAuth bilgileri */}
      {!status.configured || showCreds ? (
        <div className="drive-setup">
          <div className="ds-info">
            Google Cloud Console'dan bir <b>Desktop app</b> OAuth istemcisi oluştur,
            Drive API'yi etkinleştir ve aşağıya yapıştır. (Adımlar yan tarafta.)
          </div>
          <input
            className="picker-search"
            placeholder="Client ID"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          />
          <input
            className="picker-search"
            placeholder="Client Secret"
            type="password"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
          />
          <button
            className="ingest-go"
            disabled={!clientId.trim() || !clientSecret.trim()}
            onClick={saveCreds}
          >
            Kaydet
          </button>
        </div>
      ) : !status.connected ? (
        <div className="drive-connect">
          <div className="empty">OAuth bilgisi kayıtlı. Şimdi Google ile bağlan.</div>
          <button className="ingest-go" disabled={busy} onClick={connect}>
            {busy ? "Tarayıcı bekleniyor…" : "🔓 Google ile Bağlan"}
          </button>
          <button className="nav-btn sm" onClick={() => setShowCreds(true)}>
            OAuth bilgilerini değiştir
          </button>
        </div>
      ) : (
        /* 2) Yükleme */
        <div className="drive-upload">
          <div className="du-pickers">
            <button className="nav-btn" onClick={pickFiles} disabled={busy}>
              ＋ Dosya Seç
            </button>
            <button className="nav-btn" onClick={pickFolder} disabled={busy}>
              ＋ Klasör Seç
            </button>
          </div>

          {paths.length > 0 && (
            <div className="du-list">
              {paths.map((p) => (
                <div key={p} className="id-row">
                  <span className="id-path" title={p}>
                    {p}
                  </span>
                  {!busy && (
                    <button
                      className="id-rm"
                      onClick={() => setPaths((x) => x.filter((q) => q !== p))}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="du-target">
            <span className="d-label">Hedef sürücü</span>
            <select
              className="picker-search"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              disabled={busy}
            >
              <option value="">My Drive (kişisel)</option>
              {shared.map((d) => (
                <option key={d.id} value={d.id}>
                  ☍ {d.name} (ortak)
                </option>
              ))}
            </select>
            <button
              className="nav-btn sm"
              onClick={loadShared}
              disabled={busy}
              title="Ortak sürücüleri yenile"
            >
              ↻
            </button>
          </div>

          {/* Klasör gezgini — içeriği görerek hedef seç */}
          <div className="du-browser">
            <div className="dbz-crumbs">
              <button className="dbz-crumb" onClick={() => goToCrumb(-1)} disabled={busy}>
                {targetLabel}
              </button>
              {crumbs.map((c, i) => (
                <span key={c.id}>
                  <span className="dbz-sep">/</span>
                  <button
                    className="dbz-crumb"
                    onClick={() => goToCrumb(i)}
                    disabled={busy}
                  >
                    {c.name}
                  </button>
                </span>
              ))}
            </div>
            <div className="dbz-list">
              {loadingFolders ? (
                <div className="empty sm">Klasörler yükleniyor…</div>
              ) : folders.length === 0 ? (
                <div className="empty sm">Bu klasörde alt klasör yok</div>
              ) : (
                folders.map((f) => (
                  <button
                    key={f.id}
                    className="dbz-row"
                    onClick={() => enterFolder(f)}
                    disabled={busy}
                  >
                    📁 {f.name}
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="du-dest">
            ⤓ Yüklenecek konum: <b>{targetLabel}</b>
            {crumbs.map((c) => ` / ${c.name}`).join("")}
            {newSub.trim() && ` / ${newSub.trim()}`}
          </div>

          <input
            className="picker-search"
            placeholder="(Opsiyonel) burada yeni alt klasör oluştur — örn. 02_Footage"
            value={newSub}
            onChange={(e) => setNewSub(e.target.value)}
            disabled={busy}
          />
          <label className="id-verify">
            <input
              type="checkbox"
              checked={verify}
              disabled={busy}
              onChange={(e) => setVerify(e.target.checked)}
            />
            Yükleme sonrası md5 ile doğrula
          </label>

          {prog && busy && (
            <div className="ingest-prog">
              <div className="ip-bar">
                <div className="ip-fill" style={{ width: `${pct}%` }} />
              </div>
              <div className="ip-meta">
                <span>
                  ☁️ {prog.file_index}/{prog.file_total}
                  {prog.resumed && " · ↻ devam"}
                </span>
                <span>
                  {formatBytes(prog.bytes_done)} / {formatBytes(prog.bytes_total)}
                  {prog.speed_bps > 0 && <> · {formatBytes(prog.speed_bps)}/sn</>}
                </span>
              </div>
              {prog.file_name && (
                <div className="ip-file" title={prog.file_name}>
                  {prog.file_name}
                </div>
              )}
            </div>
          )}

          {summary && (
            <div className="ingest-summary">
              <div className={`is-head ${summary.failed > 0 ? "warn" : "ok"}`}>
                {summary.failed > 0
                  ? `⚠️ ${summary.failed} dosya başarısız`
                  : "✓ Yükleme tamam"}
              </div>
              <div className="ic-stats">
                <span>
                  <b>{summary.uploaded}</b> yüklendi
                </span>
                <span>
                  <b>{summary.verified}</b> doğrulandı
                </span>
                {summary.skipped > 0 && <span>{summary.skipped} atlandı (boş)</span>}
                <span>{formatBytes(summary.total_bytes)}</span>
                <span>{Math.round(summary.elapsed_ms / 1000)} sn</span>
              </div>
              {summary.failures.length > 0 && (
                <div className="is-fails">
                  {summary.failures.slice(0, 8).map((f, i) => (
                    <div key={i} className="is-fail">
                      {f}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            className="ingest-go"
            disabled={busy || paths.length === 0}
            onClick={startUpload}
          >
            {busy ? "Yükleniyor — kopsa bile kaldığı yerden devam eder…" : "☁️ Drive'a Yükle"}
          </button>
        </div>
      )}
    </div>
  );
}
