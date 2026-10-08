import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { z } from "zod";
import {
  Timestamp,
  FieldPath,
  type Firestore,
  type DocumentReference,
} from "firebase-admin/firestore";
import type {
  ExportContact,
  ExportConsentStatus,
} from "../../shared/types/exportAudience.js";

export const EXPORT_DATABASE = "export-audience";
export const EXPORT_TENANT = "intiba";
export const REPORT_ID = "abd-tekne-aksesuarlari-2026-09-10";
export const NOTICE_VERSION = "2026-09-11-v1";
export const CONSENT_TEXT =
  "intiba tarafından ihracat araştırmaları, ürün ve tedarik analizleri ile ilgili içerik ve hizmet tanıtımlarının e-posta adresime gönderilmesini istiyorum. İznimi istediğim zaman geri çekebilirim.";
const DAY = 86_400_000;
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const shortText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((v) => !/[\u0000-\u001f\u007f]/.test(v));
export const exportRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  name: shortText(100).optional().default(""),
  profile: z
    .enum(["manufacturer", "seller", "exploring", "unspecified"])
    .default("unspecified"),
  sector: shortText(120).optional().default(""),
  marketingConsent: z.boolean(),
  privacyAcknowledged: z.literal(true),
  website: z.string().max(200).optional().default(""),
  source: z
    .object({
      source: shortText(100).default("direct"),
      medium: shortText(100).default(""),
      campaign: shortText(100).default(""),
    })
    .default({ source: "direct", medium: "", campaign: "" }),
});
export type ExportRequest = z.infer<typeof exportRequestSchema>;

export class ExportAudienceError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface ReportEmail {
  to: string;
  requestId: string;
  downloadUrl: string;
  confirmUrl: string | null;
  unsubscribeUrl: string;
}

export class ExportAudienceService {
  private root: DocumentReference;
  constructor(
    private db: Firestore,
    private baseUrl: string,
    private sendEmail: (email: ReportEmail) => Promise<string>,
    private now: () => number = Date.now,
  ) {
    this.root = db.collection("audiences").doc(EXPORT_TENANT);
  }

  private tokenUrl(action: string, token: string) {
    return `${this.baseUrl}/api/export-research/${action}?token=${encodeURIComponent(token)}`;
  }

  // Distributed limits survive cold starts and concurrent Vercel instances.
  // IP addresses are never stored in plaintext or added to contact profiles.
  private async takeRequestQuota(email: string, ip: string) {
    const now = this.now();
    const hour = Math.floor(now / 3_600_000);
    const day = Math.floor(now / DAY);
    const quotas = [
      { key: `email-${hash(email)}-${hour}`, max: 3 },
      { key: `ip-${hash(`${day}:${ip}`)}-${hour}`, max: 15 },
      { key: `total-${day}`, max: 1000 },
    ];
    await this.db.runTransaction(async (tx) => {
      const refs = quotas.map((q) =>
        this.root.collection("rate_limits").doc(q.key),
      );
      const snaps = await tx.getAll(...refs);
      if (snaps.some((s, i) => (s.data()?.count || 0) >= quotas[i].max)) {
        throw new ExportAudienceError(
          429,
          "Çok fazla istek geldi. Lütfen daha sonra tekrar dene.",
        );
      }
      refs.forEach((ref, i) =>
        tx.set(ref, {
          count: (snaps[i].data()?.count || 0) + 1,
          expiresAt: Timestamp.fromMillis(now + 2 * DAY),
        }),
      );
    });
  }

  async request(input: ExportRequest, ip: string) {
    if (input.website) return; // Honeypot: same public response, no write or email.
    await this.takeRequestQuota(input.email, ip);
    const now = this.now();
    const id = hash(`${EXPORT_TENANT}:${input.email}`);
    const requestId = randomUUID();
    const secret = randomBytes(32).toString("hex");
    const requestRef = this.root.collection("requests").doc(requestId);
    const contactRef = this.root.collection("contacts").doc(id);
    const expiry = Timestamp.fromMillis(now + 365 * DAY);
    let unsubscribeKey = "";
    await this.db.runTransaction(async (tx) => {
      const old = await tx.get(contactRef);
      const existing = old.data();
      const freshContact = !old.exists || existing!.expiresAt.toMillis() <= now;
      unsubscribeKey = freshContact
        ? randomBytes(32).toString("hex")
        : existing!.unsubscribeKey;
      if (freshContact) {
        tx.set(contactRef, {
          email: input.email,
          name: input.name,
          profile: input.profile,
          sector: input.sector,
          tenantId: EXPORT_TENANT,
          tags: ["ihracat", "abd-pazari", "tekne-aksesuarlari"],
          createdAt: Timestamp.fromMillis(now),
          updatedAt: Timestamp.fromMillis(now),
          verifiedAt: null,
          confirmedAt: null,
          unsubscribedAt: null,
          consentStatus: input.marketingConsent ? "pending" : "not_requested",
          consentVersion: NOTICE_VERSION,
          source: input.source,
          unsubscribeKey,
          expiresAt: expiry,
        });
      }
      // An unauthenticated form cannot overwrite an existing person's profile or consent.
      tx.create(requestRef, {
        contactId: id,
        email: input.email,
        name: input.name,
        profile: input.profile,
        sector: input.sector,
        source: input.source,
        marketingRequested: input.marketingConsent,
        noticeVersion: NOTICE_VERSION,
        consentText: input.marketingConsent ? CONSENT_TEXT : null,
        tokenHash: hash(secret),
        reportId: REPORT_ID,
        deliveryStatus: "queued",
        createdAt: Timestamp.fromMillis(now),
        expiresAt: Timestamp.fromMillis(now + 7 * DAY),
      });
      tx.create(this.root.collection("consent_events").doc(), {
        contactId: id,
        requestId,
        type: input.marketingConsent ? "requested" : "report_requested",
        noticeVersion: NOTICE_VERSION,
        consentText: input.marketingConsent ? CONSENT_TEXT : null,
        createdAt: Timestamp.fromMillis(now),
        expiresAt: expiry,
      });
    });
    const token = `${requestId}.${secret}`;
    try {
      const messageId = await this.sendEmail({
        to: input.email,
        requestId,
        downloadUrl: this.tokenUrl("download", token),
        confirmUrl: input.marketingConsent
          ? this.tokenUrl("confirm", token)
          : null,
        unsubscribeUrl: this.tokenUrl("unsubscribe", `${id}.${unsubscribeKey}`),
      });
      await requestRef.update({ deliveryStatus: "accepted", messageId });
    } catch {
      await requestRef.update({ deliveryStatus: "failed" }).catch(() => {});
      throw new ExportAudienceError(
        503,
        "Rapor e-postası şu an gönderilemedi. Lütfen biraz sonra tekrar dene.",
      );
    }
  }

  private parseToken(token: unknown, unsubscribe = false) {
    const pattern = unsubscribe
      ? /^([a-f0-9]{64})\.([a-f0-9]{64})$/
      : /^([a-f0-9-]{36})\.([a-f0-9]{64})$/;
    const match = typeof token === "string" && token.match(pattern);
    if (!match)
      throw new ExportAudienceError(
        400,
        "Bağlantı geçersiz. Rapor sayfasından yeni bir bağlantı isteyebilirsin.",
      );
    return { id: match[1], secret: match[2] };
  }

  private equal(a: string, b: string) {
    return (
      a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))
    );
  }

  async validateRequest(token: unknown) {
    const { id, secret } = this.parseToken(token);
    const ref = this.root.collection("requests").doc(id);
    const snap = await ref.get();
    const data = snap.data();
    if (
      !data ||
      !this.equal(data.tokenHash, hash(secret)) ||
      data.expiresAt.toMillis() <= this.now()
    ) {
      throw new ExportAudienceError(
        410,
        "Bağlantı geçersiz veya süresi dolmuş. Rapor sayfasından yeni bir bağlantı isteyebilirsin.",
      );
    }
    return { ref, data };
  }

  async recordDownload(token: unknown) {
    const { ref, data } = await this.validateRequest(token);
    const contactRef = this.root.collection("contacts").doc(data.contactId);
    const now = Timestamp.fromMillis(this.now());
    await this.db.runTransaction(async (tx) => {
      const contact = await tx.get(contactRef);
      if (contact.exists) {
        // Download verifies possession of the email link, never grants marketing consent.
        tx.update(contactRef, {
          verifiedAt: contact.data()?.verifiedAt || now,
          updatedAt: now,
        });
      }
      tx.update(ref, { downloadedAt: now });
    });
  }

  async confirm(token: unknown) {
    const { ref, data } = await this.validateRequest(token);
    if (!data.marketingRequested)
      throw new ExportAudienceError(
        400,
        "Bu rapor talebinde bülten izni verilmemiş.",
      );
    const now = this.now();
    const contactRef = this.root.collection("contacts").doc(data.contactId);
    await this.db.runTransaction(async (tx) => {
      const [contactSnap, requestSnap] = await tx.getAll(contactRef, ref);
      const contact = contactSnap.data();
      if (!contact || contact.expiresAt.toMillis() <= now)
        throw new ExportAudienceError(410, "Kayıt artık mevcut değil.");
      if (
        contact.unsubscribedAt &&
        data.createdAt.toMillis() <= contact.unsubscribedAt.toMillis()
      ) {
        throw new ExportAudienceError(
          410,
          "Bu bağlantı izin geri çekilmeden önce oluşturulmuş. Yeniden katılmak için rapor formunu kullanabilirsin.",
        );
      }
      if (requestSnap.data()?.confirmedAt) return;
      const confirmedAt = Timestamp.fromMillis(now);
      tx.update(contactRef, {
        name: data.name,
        profile: data.profile,
        sector: data.sector,
        consentStatus: "subscribed",
        confirmedAt,
        verifiedAt: contact.verifiedAt || confirmedAt,
        consentVersion: data.noticeVersion,
        updatedAt: confirmedAt,
        expiresAt: Timestamp.fromMillis(now + 365 * DAY),
      });
      tx.update(ref, { confirmedAt });
      tx.create(this.root.collection("consent_events").doc(), {
        contactId: data.contactId,
        requestId: ref.id,
        type: "confirmed",
        noticeVersion: data.noticeVersion,
        consentText: data.consentText,
        createdAt: confirmedAt,
        expiresAt: Timestamp.fromMillis(now + 365 * DAY),
      });
    });
  }

  async validateUnsubscribe(token: unknown) {
    const { id, secret } = this.parseToken(token, true);
    const ref = this.root.collection("contacts").doc(id);
    const snap = await ref.get();
    const data = snap.data();
    if (!data || !this.equal(data.unsubscribeKey, secret))
      throw new ExportAudienceError(
        410,
        "Bağlantı geçersiz veya kayıt artık mevcut değil.",
      );
    return { ref, data };
  }

  async unsubscribe(token: unknown) {
    const { ref, data } = await this.validateUnsubscribe(token);
    const now = this.now();
    await this.db.runTransaction(async (tx) => {
      const current = await tx.get(ref);
      if (!current.exists || current.data()?.consentStatus === "unsubscribed")
        return;
      tx.update(ref, {
        consentStatus: "unsubscribed",
        unsubscribedAt: Timestamp.fromMillis(now),
        updatedAt: Timestamp.fromMillis(now),
      });
      tx.create(this.root.collection("consent_events").doc(), {
        contactId: ref.id,
        type: "withdrawn",
        noticeVersion: data.consentVersion,
        createdAt: Timestamp.fromMillis(now),
        expiresAt: Timestamp.fromMillis(now + 365 * DAY),
      });
    });
  }

  private contacts() {
    return this.root
      .collection("contacts")
      .where("expiresAt", ">", Timestamp.fromMillis(this.now()));
  }

  async list(cursor?: string, status?: ExportConsentStatus) {
    if (cursor && !/^\d{10,16}_[a-f0-9]{64}$/.test(cursor))
      throw new ExportAudienceError(400, "Sayfa bilgisi geçersiz.");
    let query = this.contacts()
      .orderBy("expiresAt")
      .orderBy(FieldPath.documentId())
      .limit(100);
    if (status) query = query.where("consentStatus", "==", status);
    if (cursor) {
      const [ms, id] = cursor.split("_");
      query = query.startAfter(Timestamp.fromMillis(Number(ms)), id);
    }
    const [snap, total, subscribed, pending, unsubscribed] = await Promise.all([
      query.get(),
      this.contacts().count().get(),
      this.contacts().where("consentStatus", "==", "subscribed").count().get(),
      this.contacts().where("consentStatus", "==", "pending").count().get(),
      this.contacts()
        .where("consentStatus", "==", "unsubscribed")
        .count()
        .get(),
    ]);
    const contacts = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        email: d.email,
        name: d.name,
        profile: d.profile,
        sector: d.sector,
        tags: d.tags,
        createdAt: d.createdAt.toDate().toISOString(),
        verifiedAt: d.verifiedAt?.toDate().toISOString() || null,
        consentStatus: d.consentStatus,
        consentVersion: d.consentVersion,
        confirmedAt: d.confirmedAt?.toDate().toISOString() || null,
        source: d.source,
      } as ExportContact;
    });
    const last = snap.docs[snap.docs.length - 1];
    return {
      contacts,
      nextCursor:
        snap.size === 100 && last
          ? `${last.data().expiresAt.toMillis()}_${last.id}`
          : null,
      counts: {
        total: total.data().count,
        subscribed: subscribed.data().count,
        pending: pending.data().count,
        unsubscribed: unsubscribed.data().count,
      },
    };
  }

  async exportSubscribers() {
    // Consent is re-checked server-side at export time; no browser-supplied recipient list.
    const snapshot = await this.contacts()
      .where("consentStatus", "==", "subscribed")
      .limit(10_001)
      .get();
    if (snapshot.size > 10_000)
      throw new ExportAudienceError(
        413,
        "Liste 10.000 kaydı aşıyor; toplu dışa aktarma için sayfalama gerekiyor.",
      );
    const rows = [
      [
        "E-posta",
        "Ad",
        "Profil",
        "Sektör",
        "Etiketler",
        "İzin tarihi",
        "İzin metni sürümü",
        "Kaynak",
        "Kampanya",
        "İzin iptal bağlantısı",
      ],
    ];
    for (const doc of snapshot.docs) {
      const d = doc.data();
      if (!d.verifiedAt || !d.confirmedAt) continue;
      rows.push([
        d.email,
        d.name,
        d.profile,
        d.sector,
        d.tags.join(" | "),
        d.confirmedAt.toDate().toISOString(),
        d.consentVersion,
        d.source.source,
        d.source.campaign,
        this.tokenUrl("unsubscribe", `${doc.id}.${d.unsubscribeKey}`),
      ]);
    }
    return (
      "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n")
    );
  }
}

export function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[\s]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
