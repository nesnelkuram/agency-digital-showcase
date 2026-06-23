import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { Invoice, InvoiceStatus } from '@/shared/types/invoice';
import { generateInvoiceShareToken } from '@/shared/types/invoice';

const COLLECTION = 'invoices';

/** undefined alanları temizle (Firestore undefined kabul etmez). */
function stripUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Timestamp) return obj;
  if (Array.isArray(obj)) return obj.map(stripUndefined) as unknown as T;
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
      if (val !== undefined) result[key] = stripUndefined(val);
    }
    return result as T;
  }
  return obj;
}

// ============================================
// CREATE
// ============================================

export async function createInvoice(
  tenantId: string,
  data: Omit<Invoice, 'id' | 'tenantId' | 'shareToken' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  if (!db) throw new Error('Firebase bağlantısı bulunamadı');
  const now = Timestamp.now();
  const docRef = doc(collection(db, COLLECTION));
  const invoice: Invoice = {
    ...data,
    id: docRef.id,
    tenantId,
    shareToken: generateInvoiceShareToken(),
    createdAt: now,
    updatedAt: now,
  };
  await setDoc(docRef, stripUndefined(invoice));
  return docRef.id;
}

// ============================================
// READ
// ============================================

export async function getInvoice(tenantId: string, invoiceId: string): Promise<Invoice | null> {
  if (!db) return null;
  const snap = await getDoc(doc(db, COLLECTION, invoiceId));
  if (!snap.exists()) return null;
  const data = snap.data() as Invoice;
  if (data.tenantId !== tenantId) return null;
  return { ...data, id: snap.id };
}

/** Public görüntüleme sayfası — sadece shareToken ile erişim (oturum gerektirmez). */
export async function getInvoiceByShareToken(shareToken: string): Promise<Invoice | null> {
  if (!db) return null;
  const q = query(collection(db, COLLECTION), where('shareToken', '==', shareToken), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { ...(d.data() as Invoice), id: d.id };
}

export async function getInvoices(tenantId: string): Promise<Invoice[]> {
  if (!db) return [];
  const q = query(
    collection(db, COLLECTION),
    where('tenantId', '==', tenantId),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ ...(d.data() as Invoice), id: d.id }));
}

/** Real-time abonelik (admin liste sayfası). */
export function subscribeToInvoices(
  tenantId: string,
  onData: (invoices: Invoice[]) => void,
  onError?: (error: Error) => void
): () => void {
  if (!db) {
    onData([]);
    return () => {};
  }
  const q = query(
    collection(db, COLLECTION),
    where('tenantId', '==', tenantId),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(
    q,
    (snap) => {
      const invoices = snap.docs.map((d) => ({ ...(d.data() as Invoice), id: d.id }));
      onData(invoices);
    },
    (err) => {
      console.error('[invoiceService] subscription error:', err);
      onError?.(err);
    }
  );
}

// ============================================
// UPDATE
// ============================================

export async function updateInvoice(
  tenantId: string,
  invoiceId: string,
  data: Partial<Invoice>
): Promise<void> {
  if (!db) throw new Error('Firebase bağlantısı bulunamadı');
  await updateDoc(doc(db, COLLECTION, invoiceId), {
    ...stripUndefined(data),
    updatedAt: Timestamp.now(),
  });
}

export async function updateInvoiceStatus(
  tenantId: string,
  invoiceId: string,
  status: InvoiceStatus
): Promise<void> {
  const patch: Partial<Invoice> = { status };
  if (status === 'paid') patch.paidAt = Timestamp.now();
  if (status === 'sent') patch.sentAt = Timestamp.now();
  await updateInvoice(tenantId, invoiceId, patch);
}

/** Müşteri faturayı public sayfada açtığında (yalnızca ilk kez) işaretler. */
export async function markInvoiceViewed(invoiceId: string): Promise<void> {
  if (!db) return;
  try {
    await updateDoc(doc(db, COLLECTION, invoiceId), { viewedAt: Timestamp.now() });
  } catch (err) {
    console.error('[invoiceService] markInvoiceViewed error:', err);
  }
}

// ============================================
// DELETE
// ============================================

export async function deleteInvoice(tenantId: string, invoiceId: string): Promise<void> {
  if (!db) throw new Error('Firebase bağlantısı bulunamadı');
  await deleteDoc(doc(db, COLLECTION, invoiceId));
}
