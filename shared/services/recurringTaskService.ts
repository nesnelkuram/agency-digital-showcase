/**
 * recurringTaskService — periyodik görev şablonları CRUD.
 * Collection: `recurring_tasks`. Her şablon cron'a göre `tasks`'a görev spawn eder.
 *
 * nextRunAt, kayıt/güncellemede cron'dan hesaplanır (client tarafı) — böylece
 * liste anında "sıradaki çalışma" gösterebilir ve cron endpoint tetikleyebilir.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { getNextRunDate } from '@/shared/utils/cron';
import type { RecurringTaskTemplate } from '@/shared/types/recurringTask';

const COLLECTION = 'recurring_tasks';

function stripUndefined<T extends Record<string, any>>(obj: T): T {
  const out: any = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    out[k] = v;
  }
  return out;
}

export type RecurringTaskInput = Omit<
  RecurringTaskTemplate,
  'id' | 'tenantId' | 'createdAt' | 'updatedAt' | 'spawnCount'
>;

// cron + timezone'dan sıradaki çalışmayı Timestamp olarak hesapla
function computeNextRun(cronExpr: string, timezone: string): Timestamp | undefined {
  const next = getNextRunDate(cronExpr, timezone, new Date());
  return next ? Timestamp.fromDate(next) : undefined;
}

export async function createRecurringTask(
  tenantId: string,
  input: RecurringTaskInput
): Promise<string> {
  if (!db) throw new Error('Firebase not initialized');
  const ref = doc(collection(db, COLLECTION));
  const now = Timestamp.now();
  const nextRunAt = input.schedule.enabled
    ? computeNextRun(input.schedule.cronExpression, input.schedule.timezone)
    : undefined;

  const data = stripUndefined({
    ...input,
    id: ref.id,
    tenantId,
    spawnCount: 0,
    schedule: stripUndefined({
      ...input.schedule,
      nextRunAt,
    }),
    createdAt: now,
    updatedAt: now,
  });

  await setDoc(ref, data);
  return ref.id;
}

export async function updateRecurringTask(
  tenantId: string,
  id: string,
  patch: Partial<RecurringTaskInput>
): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');
  const update: Record<string, any> = { ...patch, updatedAt: Timestamp.now() };

  // Cron veya enabled değiştiyse nextRunAt'i yeniden hesapla
  if (patch.schedule) {
    const { cronExpression, timezone, enabled } = patch.schedule;
    const nextRunAt =
      enabled && cronExpression && timezone
        ? computeNextRun(cronExpression, timezone)
        : null;
    update.schedule = stripUndefined({
      ...patch.schedule,
      nextRunAt: nextRunAt ?? undefined,
    });
  }

  await updateDoc(doc(db, COLLECTION, id), stripUndefined(update));
}

export async function deleteRecurringTask(tenantId: string, id: string): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');
  await deleteDoc(doc(db, COLLECTION, id));
}

export async function getRecurringTask(
  id: string
): Promise<RecurringTaskTemplate | null> {
  if (!db) throw new Error('Firebase not initialized');
  const snap = await getDoc(doc(db, COLLECTION, id));
  return snap.exists() ? (snap.data() as RecurringTaskTemplate) : null;
}

export async function getRecurringTasks(tenantId: string): Promise<RecurringTaskTemplate[]> {
  if (!db) throw new Error('Firebase not initialized');
  const snap = await getDocs(
    query(
      collection(db, COLLECTION),
      where('tenantId', '==', tenantId),
      orderBy('createdAt', 'desc')
    )
  );
  return snap.docs.map((d) => d.data() as RecurringTaskTemplate);
}

export function subscribeToRecurringTasks(
  tenantId: string,
  cb: (items: RecurringTaskTemplate[]) => void,
  onError?: (err: Error) => void
): () => void {
  if (!db) {
    onError?.(new Error('Firebase not initialized'));
    return () => {};
  }
  return onSnapshot(
    query(
      collection(db, COLLECTION),
      where('tenantId', '==', tenantId),
      orderBy('createdAt', 'desc')
    ),
    (snap) => cb(snap.docs.map((d) => d.data() as RecurringTaskTemplate)),
    (err) => onError?.(err)
  );
}
