// @vitest-environment node
import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import {
  ExportAudienceService,
  exportRequestSchema,
  EXPORT_DATABASE,
  EXPORT_TENANT,
  type ReportEmail,
} from "../api/_lib/exportAudience.ts";

// Never point tests at a real project, even if the shell contains live credentials.
const enabled = process.env.FIRESTORE_EMULATOR_HOST === "127.0.0.1:8096";
if (process.env.EXPORT_AUDIENCE_REQUIRE_EMULATOR === "1" && !enabled) {
  throw new Error(
    "Export integration tests require the isolated emulator at 127.0.0.1:8096.",
  );
}
describe.skipIf(!enabled)("Export audience — real Firestore emulator", () => {
  const app = enabled
    ? initializeApp({ projectId: "demo-export-research" }, "export-tests")
    : undefined;
  const db = app ? getFirestore(app, EXPORT_DATABASE) : undefined;
  const contacts = () =>
    db!.collection("audiences").doc(EXPORT_TENANT).collection("contacts");
  let delivered: ReportEmail[];
  let service: ExportAudienceService;
  let now: number;
  const token = (url: string) => new URL(url).searchParams.get("token")!;
  const submit = (email: string, marketingConsent = false, extra = {}) =>
    service.request(
      exportRequestSchema.parse({
        email,
        marketingConsent,
        privacyAcknowledged: true,
        ...extra,
      }),
      "127.0.0.1",
    );

  beforeAll(async () => {
    await db!.listCollections();
  });
  beforeEach(async () => {
    await db!.recursiveDelete(db!.collection("audiences").doc(EXPORT_TENANT));
    now = Date.now();
    delivered = [];
    service = new ExportAudienceService(
      db!,
      "https://example.com",
      async (email) => {
        delivered.push(email);
        return `test-${delivered.length}`;
      },
      () => now,
    );
  });
  afterAll(async () => {
    await db!.terminate();
    await deleteApp(app!);
  });

  it("persists a report-only request in the separate DB without marketing eligibility", async () => {
    await submit("report@example.com", false, {
      profile: "manufacturer",
      sector: "Tekstil",
    });
    expect(delivered).toHaveLength(1);
    expect(delivered[0].confirmUrl).toBeNull();
    const page = await service.list();
    expect(page.contacts[0]).toMatchObject({
      email: "report@example.com",
      profile: "manufacturer",
      consentStatus: "not_requested",
      tags: ["ihracat", "abd-pazari", "tekne-aksesuarlari"],
    });
    expect(page.contacts[0]).not.toHaveProperty("unsubscribeKey");
    await service.recordDownload(token(delivered[0].downloadUrl));
    expect((await service.list()).contacts[0].verifiedAt).not.toBeNull();
    expect(await service.exportSubscribers()).not.toContain(
      "report@example.com",
    );
    await expect(
      service.confirm(token(delivered[0].downloadUrl)),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("only exports an opt-in after confirmation; download and GET validation never subscribe", async () => {
    await submit("yes@example.com", true);
    const t = token(delivered[0].confirmUrl!);
    await service.validateRequest(t);
    await service.recordDownload(t);
    expect((await service.list()).contacts[0].consentStatus).toBe("pending");
    expect(await service.exportSubscribers()).not.toContain("yes@example.com");
    await service.confirm(t);
    expect((await service.list(undefined, "subscribed")).contacts).toHaveLength(
      1,
    );
    expect(await service.exportSubscribers()).toContain("yes@example.com");
    await service.confirm(t); // Confirmation is idempotent.
    const events = await db!
      .collection("audiences")
      .doc(EXPORT_TENANT)
      .collection("consent_events")
      .where("type", "==", "confirmed")
      .get();
    expect(events.size).toBe(1);
  });

  it("removes a withdrawn consent and rejects old confirmation links", async () => {
    await submit("stop@example.com", true);
    const email = delivered[0];
    await service.confirm(token(email.confirmUrl!));
    await service.validateUnsubscribe(token(email.unsubscribeUrl)); // A link scanner has no side effects.
    expect(await service.exportSubscribers()).toContain("stop@example.com");
    now += 1000;
    await service.unsubscribe(token(email.unsubscribeUrl));
    expect(await service.exportSubscribers()).not.toContain("stop@example.com");
    await expect(
      service.confirm(token(email.confirmUrl!)),
    ).rejects.toMatchObject({ status: 410 });
    now += 1000;
    await submit("stop@example.com", true);
    await service.confirm(token(delivered[1].confirmUrl!));
    expect((await service.list()).contacts[0].consentStatus).toBe("subscribed");
  });

  it("deduplicates email and prevents an unverified resubmission changing an existing contact", async () => {
    await submit("owner@example.com", true, { name: "Gerçek İsim" });
    await service.confirm(token(delivered[0].confirmUrl!));
    await submit("OWNER@example.com", false, {
      name: "Değiştirildi",
      profile: "seller",
    });
    const page = await service.list();
    expect(page.contacts).toHaveLength(1);
    expect(page.contacts[0]).toMatchObject({
      name: "Gerçek İsim",
      consentStatus: "subscribed",
    });
  });

  it("never accepts a forged or expired access token", async () => {
    await submit("expired@example.com");
    const t = token(delivered[0].downloadUrl);
    const forged = t.slice(0, -1) + (t.endsWith("0") ? "1" : "0");
    await expect(service.recordDownload(forged)).rejects.toMatchObject({
      status: 410,
    });
    now += 8 * 86_400_000;
    await expect(service.recordDownload(t)).rejects.toMatchObject({
      status: 410,
    });
  });

  it("excludes expired contacts before asynchronous TTL deletion runs", async () => {
    await submit("ttl@example.com", true);
    await service.confirm(token(delivered[0].confirmUrl!));
    now += 366 * 86_400_000;
    expect((await service.list()).contacts).toHaveLength(0);
    expect(await service.exportSubscribers()).not.toContain("ttl@example.com");
  });

  it("allows a fresh request after expiry even while TTL cleanup is pending", async () => {
    await submit("renew@example.com", true);
    await service.confirm(token(delivered[0].confirmUrl!));
    now += 366 * 86_400_000;
    await submit("renew@example.com", false, { name: "Yeni talep" });
    const page = await service.list();
    expect(page.contacts).toHaveLength(1);
    expect(page.contacts[0]).toMatchObject({
      name: "Yeni talep",
      consentStatus: "not_requested",
      verifiedAt: null,
    });
  });

  it("rate-limits repeated delivery requests across service instances", async () => {
    for (let i = 0; i < 3; i++) await submit("limit@example.com");
    service = new ExportAudienceService(
      db!,
      "https://example.com",
      async () => "unexpected",
      () => now,
    );
    await expect(submit("limit@example.com")).rejects.toMatchObject({
      status: 429,
    });
    expect(delivered).toHaveLength(3);
  });

  it("records delivery failure without pretending a message was sent", async () => {
    service = new ExportAudienceService(
      db!,
      "https://example.com",
      async () => {
        throw new Error("provider unavailable");
      },
      () => now,
    );
    await expect(submit("failure@example.com")).rejects.toMatchObject({
      status: 503,
    });
    const requests = await db!
      .collection("audiences")
      .doc(EXPORT_TENANT)
      .collection("requests")
      .get();
    expect(requests.docs[0].data().deliveryStatus).toBe("failed");
    expect(await service.exportSubscribers()).not.toContain(
      "failure@example.com",
    );
  });

  it("discards honeypot submissions without collecting any personal data", async () => {
    await submit("bot@example.com", true, {
      website: "https://spam.example.com",
    });
    expect(delivered).toHaveLength(0);
    expect((await contacts().get()).empty).toBe(true);
  });

  it("paginates without losing equal-timestamp records and scopes to the owner audience", async () => {
    const batch = db!.batch();
    const expiry = Timestamp.fromMillis(now + 86_400_000);
    for (let n = 0; n < 105; n++)
      batch.set(contacts().doc(n.toString(16).padStart(64, "0")), {
        email: `page${n}@example.com`,
        name: "",
        profile: "unspecified",
        sector: "",
        tags: ["ihracat"],
        consentStatus: "not_requested",
        consentVersion: "test",
        createdAt: Timestamp.fromMillis(now),
        expiresAt: expiry,
        verifiedAt: null,
        confirmedAt: null,
        source: { source: "direct", medium: "", campaign: "" },
      });
    batch.set(
      db!
        .collection("audiences")
        .doc("other-tenant")
        .collection("contacts")
        .doc("private"),
      { email: "other@example.com", expiresAt: expiry },
    );
    await batch.commit();
    const first = await service.list();
    const second = await service.list(first.nextCursor!);
    expect(first.contacts).toHaveLength(100);
    expect(second.contacts).toHaveLength(5);
    expect(
      new Set([...first.contacts, ...second.contacts].map((c) => c.id)).size,
    ).toBe(105);
    expect(first.counts.total).toBe(105);
  });
});
