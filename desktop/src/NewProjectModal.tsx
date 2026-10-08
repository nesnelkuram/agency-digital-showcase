import { useEffect, useMemo, useRef, useState } from "react";
import { createScaffold, listDir, openPath } from "./scannerApi";
import { ProjectLite } from "./firestoreData";
import {
  buildScaffoldDirs,
  projectFolderName,
  projectRelPath,
  sanitizeSeg,
} from "./projectStructure";

interface ConnDrive {
  id: string;
  label: string;
  mountPath: string;
}

const joinAbs = (mount: string, rel: string) =>
  `${mount.replace(/\/$/, "")}/${rel}`;

// Standart ajans klasör ağacını seçilen diskte oluşturan "Yeni Proje" sihirbazı.
export function NewProjectModal({
  drives,
  projects,
  onClose,
}: {
  drives: ConnDrive[];
  projects: ProjectLite[];
  onClose: () => void;
}) {
  const [driveId, setDriveId] = useState(drives[0]?.id || "");
  const [client, setClient] = useState("");
  const [short, setShort] = useState("");
  const [project, setProject] = useState("");
  const [dateStr, setDateStr] = useState(() => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ count: number; abs: string } | null>(null);

  // Diskte zaten var olan müşteri klasörleri + seçili müşterinin projeleri.
  const [clients, setClients] = useState<string[]>([]);
  const [existingProjects, setExistingProjects] = useState<string[]>([]);

  const downOnBackdrop = useRef(false);

  const drive = drives.find((d) => d.id === driveId);
  const dateObj = useMemo(() => {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y || 2026, (m || 1) - 1, d || 1);
  }, [dateStr]);

  const folderName =
    short && project ? projectFolderName(short, project, dateObj) : "";
  const clientSeg = sanitizeSeg(client);
  const relPath =
    client && folderName ? projectRelPath(client, folderName) : "";
  const previewFull =
    drive && relPath ? joinAbs(drive.mountPath, relPath) : "";

  // Disk değişince: o diskteki 01_CLIENTS altındaki müşteri klasörlerini oku.
  useEffect(() => {
    let alive = true;
    setClients([]);
    if (!drive) return;
    listDir(joinAbs(drive.mountPath, "01_Clients"))
      .then((items) => {
        if (alive) setClients(items.filter((i) => i.is_dir).map((i) => i.name));
      })
      .catch(() => alive && setClients([])); // 01_Clients yoksa boş
    return () => {
      alive = false;
    };
  }, [drive?.mountPath]);

  // Müşteri var olan bir klasöre denk geliyorsa: altındaki projeleri oku.
  const clientExists = clients.some(
    (c) => c.toLowerCase() === clientSeg.toLowerCase()
  );
  useEffect(() => {
    let alive = true;
    setExistingProjects([]);
    if (!drive || !clientSeg || !clientExists) return;
    const match = clients.find(
      (c) => c.toLowerCase() === clientSeg.toLowerCase()
    );
    listDir(joinAbs(drive.mountPath, `01_Clients/${match}`))
      .then((items) => {
        if (alive)
          setExistingProjects(items.filter((i) => i.is_dir).map((i) => i.name));
      })
      .catch(() => alive && setExistingProjects([]));
    return () => {
      alive = false;
    };
  }, [drive?.mountPath, clientSeg, clientExists]);

  const projectExists = existingProjects.some(
    (n) => n.toLowerCase() === folderName.toLowerCase()
  );

  const prefill = (p: ProjectLite) => {
    setClient(p.clientName && p.clientName !== "—" ? p.clientName : p.name);
    setProject(p.name);
    if (!short) setShort((p.clientName || p.name).slice(0, 6));
  };

  const create = async () => {
    if (!drive || !client.trim() || !short.trim() || !project.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const dirs = buildScaffoldDirs(client, folderName);
      const n = await createScaffold(drive.mountPath, dirs);
      setDone({ count: n, abs: previewFull });
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const trWarn =
    (client && client !== clientSeg) ||
    (short && short !== sanitizeSeg(short)) ||
    (project && project !== sanitizeSeg(project));

  return (
    <div
      className="picker-overlay"
      onMouseDown={(e) => {
        downOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (!busy && downOnBackdrop.current && e.target === e.currentTarget)
          onClose();
      }}
    >
      <div className="ingest">
        <div className="ingest-head">
          <strong>📁 Yeni Proje</strong>
          <span className="picker-sub">Standart ajans klasör yapısını kurar</span>
          {!busy && (
            <button className="ingest-x" onClick={onClose}>
              ✕
            </button>
          )}
        </div>

        {error && <div className="error inline">{error}</div>}

        {done ? (
          <div className="ingest-summary">
            <div className="is-head ok">✓ {done.count} klasör oluşturuldu</div>
            <button className="id-row link" onClick={() => openPath(done.abs)}>
              <span className="id-path">📂 {done.abs}</span>
              <span className="id-rm">⤷</span>
            </button>
            <div className="ds-info">
              02_Footage, 03_Audio, 05_Projects … hazır. Kartları 02_Footage'a
              aktarabilir, kurguda 07_Scratch'i cache gösterebilirsiniz.
            </div>
            <div className="ingest-actions">
              <button className="ingest-go" onClick={onClose}>
                Bitti
              </button>
            </div>
          </div>
        ) : (
          <>
            <label className="np-field">
              <span className="d-label">Disk</span>
              <select
                className="picker-search"
                value={driveId}
                onChange={(e) => setDriveId(e.target.value)}
                disabled={busy}
              >
                {drives.length === 0 && <option value="">Bağlı disk yok</option>}
                {drives.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>

            {projects.length > 0 && (
              <label className="np-field">
                <span className="d-label">Mevcut projeden doldur (opsiyonel)</span>
                <select
                  className="picker-search"
                  defaultValue=""
                  onChange={(e) => {
                    const p = projects.find((x) => x.id === e.target.value);
                    if (p) prefill(p);
                  }}
                  disabled={busy}
                >
                  <option value="">—</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.clientName}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="np-field">
              <span className="d-label">
                Müşteri
                {client &&
                  (clientExists ? (
                    <em className="np-ok"> · mevcut klasör ✓</em>
                  ) : (
                    <em className="np-new"> · yeni müşteri klasörü</em>
                  ))}
              </span>
              <input
                className="picker-search"
                list="np-clients"
                placeholder="örn. X Otel"
                value={client}
                onChange={(e) => setClient(e.target.value)}
                disabled={busy}
              />
              <datalist id="np-clients">
                {clients.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>

            <div className="np-row2">
              <label className="np-field" style={{ flex: "0 0 150px" }}>
                <span className="d-label">Kısa kod</span>
                <input
                  className="picker-search"
                  placeholder="XOTEL"
                  value={short}
                  onChange={(e) => setShort(e.target.value)}
                  disabled={busy}
                />
              </label>
              <label className="np-field" style={{ flex: 1 }}>
                <span className="d-label">Proje adı</span>
                <input
                  className="picker-search"
                  placeholder="Yaz Kampanyası"
                  value={project}
                  onChange={(e) => setProject(e.target.value)}
                  disabled={busy}
                />
              </label>
            </div>

            <label className="np-field">
              <span className="d-label">Tarih</span>
              <input
                className="picker-search"
                type="date"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                disabled={busy}
              />
            </label>

            {/* Mevcut müşteri varsa altındaki projeleri göster */}
            {clientExists && existingProjects.length > 0 && (
              <div className="np-existing">
                <span className="d-label">
                  Bu müşteride zaten {existingProjects.length} proje var:
                </span>
                <div className="np-existing-list">
                  {existingProjects.slice(0, 8).map((p) => (
                    <span key={p} className="ic-marker">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="du-dest">
              {relPath ? (
                <>
                  ⤓ Oluşturulacak: <b>{drive?.label}</b> / {relPath}
                  <br />
                  <span style={{ opacity: 0.7 }}>
                    + 01_Docs · 02_Footage · 03_Audio · 04_Assets · 05_Projects ·
                    06_Exports · 07_Scratch
                  </span>
                </>
              ) : (
                "Müşteri, kısa kod ve proje adını gir."
              )}
            </div>

            {projectExists && (
              <div className="error inline">
                ⚠️ Bu proje klasörü ({folderName}) bu müşteride zaten var. Aynı
                isimle oluşturmak içine yeni kovalar ekler, var olanları bozmaz.
              </div>
            )}
            {trWarn && (
              <div className="ds-info">
                ⚠️ Türkçe karakter/boşluk düzeltilir →{" "}
                <code>{relPath || sanitizeSeg(short)}</code>
              </div>
            )}

            <div className="ingest-actions">
              <button
                className="ingest-go"
                disabled={
                  busy ||
                  !drive ||
                  !client.trim() ||
                  !short.trim() ||
                  !project.trim()
                }
                onClick={create}
              >
                {busy ? "Oluşturuluyor…" : "📁 Yapıyı Oluştur"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
