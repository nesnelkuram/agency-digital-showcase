// timerService — web app'teki nowService ile birebir uyumlu çalışma sayacı.
// Aynı Firestore alanlarını yazar: status, startedAt, pausedAt, autoPaused,
// accumulatedSeconds, workSessions, actualMinutesSpent/SecondsSpent.
// Böylece web ve masaüstü aynı sayaç durumunu paylaşır.

import {
  Timestamp,
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import { AppUser } from "./types";

const COLLECTION = "tasks";
const MAX_SESSIONS = 300;

interface WorkSession {
  startedAt: number;
  endedAt: number;
  seconds: number;
  auto?: boolean;
}

function stripUndefined<T extends Record<string, any>>(obj: T): T {
  const out: any = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v;
  return out;
}

async function getRaw(taskId: string): Promise<any | null> {
  if (!db) return null;
  const snap = await getDoc(doc(db, COLLECTION, taskId));
  return snap.exists() ? snap.data() : null;
}

async function update(taskId: string, data: Record<string, any>): Promise<void> {
  if (!db) throw new Error("Firebase hazır değil");
  await updateDoc(doc(db, COLLECTION, taskId), {
    ...stripUndefined(data),
    updatedAt: Timestamp.now(),
  });
}

function toMs(v: any): number | undefined {
  if (!v) return undefined;
  if (typeof v === "number") return v;
  if (typeof v.toMillis === "function") return v.toMillis();
  if (typeof v.seconds === "number") return v.seconds * 1000;
  return undefined;
}

// Aktif (in_progress) segment'i asOfMs anına kadar kapatır.
function closeActiveSegment(
  existing: any,
  asOfMs: number,
  auto: boolean
): { session: WorkSession; accumulated: number } | null {
  if (!existing || existing.status !== "in_progress" || !existing.startedAt)
    return null;
  const startMs = toMs(existing.startedAt)!;
  const endMs = Math.max(startMs, asOfMs);
  const seconds = Math.round((endMs - startMs) / 1000);
  if (seconds <= 0) return null;
  const session: WorkSession = { startedAt: startMs, endedAt: endMs, seconds };
  if (auto) session.auto = true;
  return {
    session,
    accumulated: (existing.accumulatedSeconds ?? 0) + seconds,
  };
}

function appendSession(existing: any, session: WorkSession): WorkSession[] {
  const prev: WorkSession[] = existing?.workSessions ?? [];
  return [...prev, session].slice(-MAX_SESSIONS);
}

// ── BAŞLA / DEVAM ───────────────────────────────────────────────────────
export async function startTask(taskId: string, actor?: AppUser): Promise<void> {
  const existing = await getRaw(taskId);
  const now = Timestamp.now();
  const isFreshStart = !existing?.startedAt || existing?.status === "open";
  await update(taskId, {
    status: "in_progress",
    startedAt: now,
    pausedAt: undefined,
    autoPaused: false,
    accumulatedSeconds: isFreshStart ? 0 : existing?.accumulatedSeconds ?? 0,
    ...(isFreshStart ? { workSessions: [] } : {}),
    ...(actor?.uid ? { startedBy: actor.uid } : {}),
    ...(actor?.displayName || actor?.email
      ? { startedByName: actor.displayName || actor.email }
      : {}),
  });
}

// ── DURAKLAT ────────────────────────────────────────────────────────────
export async function pauseTask(
  taskId: string,
  opts?: { asOfMs?: number; auto?: boolean }
): Promise<void> {
  const existing = await getRaw(taskId);
  if (!existing || existing.status !== "in_progress") return;
  const now = Timestamp.now();
  const auto = opts?.auto ?? false;
  const asOfMs = opts?.asOfMs ?? now.toMillis();
  const seg = closeActiveSegment(existing, asOfMs, auto);
  await update(taskId, {
    status: "paused",
    pausedAt: now,
    autoPaused: auto,
    accumulatedSeconds: seg ? seg.accumulated : existing.accumulatedSeconds ?? 0,
    ...(seg ? { workSessions: appendSession(existing, seg.session) } : {}),
  });
}

// ── TAMAMLA ─────────────────────────────────────────────────────────────
export async function completeTask(taskId: string, actor?: AppUser): Promise<void> {
  const existing = await getRaw(taskId);
  const now = Timestamp.now();
  const seg = closeActiveSegment(existing, now.toMillis(), false);
  const totalSec = seg ? seg.accumulated : existing?.accumulatedSeconds ?? 0;
  const actualSecondsSpent = totalSec || undefined;
  const actualMinutesSpent =
    actualSecondsSpent !== undefined
      ? Math.max(1, Math.round(actualSecondsSpent / 60))
      : undefined;
  await update(taskId, {
    status: "completed",
    completedAt: now,
    pausedAt: undefined,
    autoPaused: false,
    accumulatedSeconds: totalSec,
    ...(seg ? { workSessions: appendSession(existing, seg.session) } : {}),
    ...(actor?.uid ? { completedBy: actor.uid } : {}),
    ...(actor?.displayName || actor?.email
      ? { completedByName: actor.displayName || actor.email }
      : {}),
    ...(actualMinutesSpent !== undefined ? { actualMinutesSpent } : {}),
    ...(actualSecondsSpent !== undefined ? { actualSecondsSpent } : {}),
  });
}

// Görevin o anki toplam geçen saniyesi (canlı sayaç için taban + aktif segment).
export function elapsedSeconds(task: {
  status: string;
  accumulatedSeconds?: number;
  startedAtMs?: number;
}): number {
  const base = task.accumulatedSeconds ?? 0;
  if (task.status === "in_progress" && task.startedAtMs) {
    return base + Math.max(0, Math.floor((Date.now() - task.startedAtMs) / 1000));
  }
  return base;
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}sa ${m}dk`;
  if (m > 0) return `${m}dk ${sec}sn`;
  return `${sec}sn`;
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}
