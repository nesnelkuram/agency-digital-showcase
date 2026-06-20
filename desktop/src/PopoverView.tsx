import { useEffect, useMemo } from "react";
import { AppUser } from "./types";
import { useTasks, useTick } from "./hooks";
import { TaskRow } from "./ui";
import { ensureNotifyPermission, notify } from "./notify";
import { evaluateRules } from "./rules";
import { openDashboard, openFiles } from "./windowControl";
import {
  enable as enableAutostart,
  isEnabled as isAutostartEnabled,
} from "@tauri-apps/plugin-autostart";

// Kompakt menü-çubuğu paneli: hızlı bakış + bildirim motoru burada koşar.
export function PopoverView({ user }: { user: AppUser }) {
  const { tasks, error } = useTasks(user.tenantId);
  const running = tasks.some((t) => t.status === "in_progress");
  useTick(running);

  // Bildirim izni + autostart (popover daima ayakta olduğu için burada).
  useEffect(() => {
    ensureNotifyPermission();
    isAutostartEnabled()
      .then((on) => {
        if (!on) enableAutostart().catch(() => {});
      })
      .catch(() => {});
  }, []);

  // Kuralları veri değişiminde + her 3 dk değerlendir.
  useEffect(() => {
    const run = () => {
      for (const p of evaluateRules(tasks)) notify(p.title, p.body);
    };
    run();
    const id = setInterval(run, 3 * 60 * 1000);
    return () => clearInterval(id);
  }, [tasks]);

  const sorted = useMemo(
    () =>
      [...tasks].sort(
        (a, b) => (b.aiPriorityScore ?? 0) - (a.aiPriorityScore ?? 0)
      ),
    [tasks]
  );

  return (
    <div className="panel popover">
      <div className="header" data-tauri-drag-region>
        <div className="header-left" data-tauri-drag-region>
          <span className="brand-sm">Şimdi</span>
          <span className="count">{tasks.length}</span>
        </div>
        <div className="header-btns">
          <button className="open-app ghost" title="Diskler & Dosyalar" onClick={() => openFiles()}>
            📁
          </button>
          <button className="open-app" title="Tam uygulamayı aç" onClick={() => openDashboard()}>
            Uygulamayı Aç ↗
          </button>
        </div>
      </div>

      {error && <div className="error inline">Veri hatası: {error}</div>}

      <div className="list">
        {sorted.length === 0 ? (
          <div className="empty">🎉 Aktif görev yok.</div>
        ) : (
          sorted.map((t) => (
            <TaskRow key={t.id} task={t} onClick={() => openDashboard()} />
          ))
        )}
      </div>
    </div>
  );
}
