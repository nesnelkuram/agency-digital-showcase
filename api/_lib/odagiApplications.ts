import { createHash } from 'node:crypto';
import { z } from 'zod';
import { FieldPath, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { ODAGI_CONSENT_TEXT, ODAGI_LABELS, ODAGI_NOTICE_VERSION } from '../../shared/types/odagi.js';

const text = (max: number, min = 2) => z.string().trim().min(min).max(max)
  .refine(value => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value));
const answer = z.enum(['yes', 'no']);
const conditions = <T extends [string, ...string[]]>(options: T) => z.array(z.enum(options)).min(1).max(options.length)
  .refine(items => new Set(items).size === items.length && !(items.includes('clear') && items.length > 1));
export const odagiApplicationSchema = z.object({
  requestId: z.string().uuid(), name: text(100), email: z.string().trim().toLowerCase().email().max(254),
  city: text(80), district: text(80), neighborhood: text(100), area: z.number().finite().min(1).max(10000).multipleOf(0.5),
  occupation: text(120), employed: answer, ownsSpace: answer,
  company: z.enum(['exists', 'none', 'considering']), daytimeAvailable: answer,
  couriers: text(1500, 5), petSmoke: conditions(['pets', 'smoking', 'clear']),
  roomConditions: conditions(['damp', 'sunlight', 'clear']), packingSpace: answer, investment: answer,
  roomInfo: text(2000, 5), income: z.enum(['5-25', '25-40', '40-100', '100+']),
  applicationConsent: z.literal(true), website: z.string().max(200).default(''),
}).strict();
export type OdagiInput = z.infer<typeof odagiApplicationSchema>;
export class OdagiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export const ODAGI_COLLECTION = 'odagi_applications';
export const ODAGI_LIMITS = 'odagi_intake_limits';
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

export class OdagiApplicationService {
  constructor(private db: Firestore, private now: () => number = Date.now) {}

  async submit(input: OdagiInput, ip: string) {
    if (input.website) throw new OdagiError(400, 'Başvuru doğrulanamadı. Lütfen alanları kontrol edin.');
    const { requestId, website: _website, ...answers } = input;
    const payloadHash = hash(JSON.stringify(answers));
    const reference = `ODG-${requestId.replaceAll('-', '').slice(0, 12).toUpperCase()}`;
    const application = this.db.collection(ODAGI_COLLECTION).doc(requestId);
    const now = this.now();
    const hour = Math.floor(now / 3_600_000), day = Math.floor(now / 86_400_000);
    const quotas = [
      { id: `ip-${hash(`${day}:${ip}`)}-${hour}`, max: 10 },
      { id: `email-${hash(`${day}:${input.email}`)}-${day}`, max: 5 },
    ];
    const result = await this.db.runTransaction(async tx => {
      const old = await tx.get(application);
      if (old.exists) {
        if (old.data()?.payloadHash !== payloadHash) throw new OdagiError(409, 'Başvuru bilgileri değişmiş. Lütfen yeniden deneyin.');
        return { reference: old.data()!.reference, duplicate: true };
      }
      const limits = quotas.map(quota => this.db.collection(ODAGI_LIMITS).doc(quota.id));
      const snapshots = await tx.getAll(...limits);
      if (snapshots.some((snapshot, i) => (snapshot.data()?.count || 0) >= quotas[i].max))
        throw new OdagiError(429, 'Kısa sürede çok sayıda başvuru denendi. Lütfen daha sonra tekrar deneyin.');
      limits.forEach((ref, i) => tx.set(ref, {
        count: (snapshots[i].data()?.count || 0) + 1,
        expiresAt: Timestamp.fromMillis(now + 2 * 86_400_000),
      }));
      tx.create(application, {
        ...answers, reference, payloadHash, status: 'new', tenantId: 'intiba',
        source: 'odagi-web', createdAt: Timestamp.fromMillis(now),
        noticeVersion: ODAGI_NOTICE_VERSION, consentText: ODAGI_CONSENT_TEXT,
      });
      return { reference, duplicate: false };
    });
    // Keep technical counters short lived without changing existing database policies.
    // Expired counters are inapplicable already; bounded cleanup is best effort.
    try {
      const expired = await this.db.collection(ODAGI_LIMITS).where('expiresAt', '<', Timestamp.fromMillis(now)).limit(20).get();
      if (!expired.empty) {
        const batch = this.db.batch();
        expired.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
      }
    } catch { /* A cleanup failure does not undo a recorded application. */ }
    return result;
  }

  async list(cursor?: string) {
    const ref = this.db.collection(ODAGI_COLLECTION);
    let query = ref.orderBy('createdAt', 'desc').orderBy(FieldPath.documentId(), 'desc').limit(51);
    if (cursor) {
      if (!z.string().uuid().safeParse(cursor).success) throw new OdagiError(400, 'Sayfa bilgisi geçersiz.');
      const previous = await ref.doc(cursor).get();
      if (!previous.exists) throw new OdagiError(400, 'Bu sayfa artık bulunamıyor. Listeyi yenileyin.');
      query = query.startAfter(previous);
    }
    const snapshot = await query.get();
    const documents = snapshot.docs.slice(0, 50);
    const applications = documents.map(doc => {
      const data = doc.data();
      return {
        id: doc.id, reference: data.reference, status: data.status,
        createdAt: data.createdAt.toDate().toISOString(),
        ...Object.fromEntries(Object.keys(ODAGI_LABELS).map(key => [key, data[key]])),
        applicationConsent: data.applicationConsent, noticeVersion: data.noticeVersion,
      };
    });
    return { applications, nextCursor: snapshot.size > 50 ? documents.at(-1)!.id : null };
  }
}
