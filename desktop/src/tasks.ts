import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import { ACTIVE_STATUSES, AppUser, Task, TaskNote } from "./types";

// Firestore Timestamp | number | Date -> epoch ms
function toMs(v: any): number | undefined {
  if (!v) return undefined;
  if (typeof v === "number") return v;
  if (typeof v.toMillis === "function") return v.toMillis();
  if (typeof v.seconds === "number") return v.seconds * 1000;
  const d = new Date(v);
  return isNaN(d.getTime()) ? undefined : d.getTime();
}

function mapNotes(arr: any): TaskNote[] | undefined {
  if (!Array.isArray(arr)) return undefined;
  return arr.map((n) => ({
    id: n.id,
    text: n.text,
    authorName: n.authorName,
    createdAt: typeof n.createdAt === "number" ? n.createdAt : undefined,
  }));
}

function mapTask(id: string, d: any): Task {
  return {
    id,
    tenantId: d.tenantId,
    title: d.title || "Görev",
    description: d.description,
    status: d.status,
    priority: d.priority,
    aiPriorityScore: d.aiPriorityScore,
    aiScoreRationale: d.aiScoreRationale,
    aiRiskLevel: d.aiRiskLevel,
    flagged: d.flagged,
    eisenhowerQuadrant: d.eisenhowerQuadrant,
    category: d.category,
    projectName: d.projectName,
    clientName: d.clientName,
    assigneeName: d.assigneeName,
    dueDateMs: toMs(d.dueDate),
    estimatedHours: d.estimatedHours,
    tags: Array.isArray(d.tags) ? d.tags : undefined,
    notes: mapNotes(d.notes),
    parentTaskId: d.parentTaskId,
    subTaskCount: d.subTaskCount,
    sortOrder: d.sortOrder,
    startedAtMs: toMs(d.startedAt),
    pausedAtMs: toMs(d.pausedAt),
    autoPaused: d.autoPaused,
    accumulatedSeconds: d.accumulatedSeconds,
    actualMinutesSpent: d.actualMinutesSpent,
    reminderEnabled: d.reminderConfig?.enabled !== false,
  };
}

export function watchAuth(
  cb: (user: AppUser | null) => void
): () => void {
  if (!auth || !db) {
    cb(null);
    return () => {};
  }
  return onAuthStateChanged(auth, async (fbUser) => {
    if (!fbUser) {
      cb(null);
      return;
    }
    // tenantId: users/{uid}.tenantId || organizationId (web app ile aynı mantık)
    let tenantId = "default";
    try {
      const snap = await getDoc(doc(db!, "users", fbUser.uid));
      if (snap.exists()) {
        const data = snap.data();
        tenantId = data.tenantId || data.organizationId || "default";
      }
    } catch (e) {
      console.error("[tasks] tenantId okunamadı:", e);
    }
    cb({
      uid: fbUser.uid,
      email: fbUser.email,
      displayName: fbUser.displayName,
      tenantId,
    });
  });
}

export function subscribeTasks(
  tenantId: string,
  cb: (tasks: Task[]) => void,
  onError?: (e: Error) => void
): () => void {
  if (!db) {
    cb([]);
    return () => {};
  }
  const q = query(
    collection(db, "tasks"),
    where("tenantId", "==", tenantId),
    where("status", "in", ACTIVE_STATUSES)
  );
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((doc) => mapTask(doc.id, doc.data()))),
    (err) => {
      console.error("[tasks] abonelik hatası:", err);
      onError?.(err);
    }
  );
}

export function subscribeSubtasks(
  tenantId: string,
  parentTaskId: string,
  cb: (tasks: Task[]) => void
): () => void {
  if (!db) {
    cb([]);
    return () => {};
  }
  const q = query(
    collection(db, "tasks"),
    where("tenantId", "==", tenantId),
    where("parentTaskId", "==", parentTaskId)
  );
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((doc) => mapTask(doc.id, doc.data()));
      items.sort(
        (a, b) =>
          (a.sortOrder ?? Number.MAX_SAFE_INTEGER) -
          (b.sortOrder ?? Number.MAX_SAFE_INTEGER)
      );
      cb(items);
    },
    (err) => console.error("[tasks] subtask abonelik hatası:", err)
  );
}

export async function signIn(email: string, password: string): Promise<void> {
  if (!auth) throw new Error("Firebase yapılandırılmamış (.env.local)");
  await signInWithEmailAndPassword(auth, email, password);
}

export async function signOut(): Promise<void> {
  if (auth) await fbSignOut(auth);
}
