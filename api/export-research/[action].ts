import type { VercelRequest, VercelResponse } from "@vercel/node";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getAdminDb, getFirebaseAuth } from "../_lib/firebaseAdmin.js";
import {
  ExportAudienceError,
  ExportAudienceService,
  exportRequestSchema,
  EXPORT_DATABASE,
  EXPORT_TENANT,
} from "../_lib/exportAudience.js";
import { reportEmailContent, htmlEscape } from "../_lib/exportAudienceEmail.js";
import { checkRateLimit } from "../_lib/rateLimit.js";
import type { ExportConsentStatus } from "../../shared/types/exportAudience.js";

let service: ExportAudienceService | undefined;
function publicUrl() {
  const configured = process.env.EXPORT_PUBLIC_URL;
  if (configured) return new URL(configured).origin;
  if (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL)
    return `https://${process.env.VERCEL_URL}`;
  return "https://www.intiba.co.uk";
}
async function getService() {
  if (service) return service;
  getAdminDb(); // Initializes the existing server credential, never the browser SDK.
  const { getFirestore } = await import("firebase-admin/firestore");
  const db = getFirestore(EXPORT_DATABASE); // Intentionally never falls back to (default).
  service = new ExportAudienceService(db, publicUrl(), async (email) => {
    if (!process.env.RESEND_API_KEY)
      throw new Error("Email service not configured");
    const { Resend } = await import("resend");
    const result = await new Resend(process.env.RESEND_API_KEY).emails.send(
      {
        from: "intiba <info@intiba.co.uk>",
        to: email.to,
        replyTo: "info@intiba.co.uk",
        ...reportEmailContent(email),
      },
      { idempotencyKey: `export-report/${email.requestId}` },
    );
    if (result.error || !result.data?.id)
      throw new Error("Email provider rejected request");
    return result.data.id;
  });
  return service;
}

export async function requireExportAdmin(req: VercelRequest) {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith("Bearer "))
    throw new ExportAudienceError(401, "Yönetici girişi gerekli.");
  let uid: string;
  try {
    uid = (await getFirebaseAuth().verifyIdToken(authorization.slice(7), true))
      .uid;
  } catch {
    throw new ExportAudienceError(401, "Oturum geçersiz veya süresi dolmuş.");
  }
  const user = (await getAdminDb().collection("users").doc(uid).get()).data();
  if (
    !user ||
    user.status !== "active" ||
    !["admin", "super_admin"].includes(user.role) ||
    (user.role !== "super_admin" && user.tenantId !== EXPORT_TENANT)
  ) {
    throw new ExportAudienceError(403, "Bu liste için yönetici yetkin yok.");
  }
}

function page(res: VercelResponse, title: string, body: string, status = 200) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  );
  return res
    .status(status)
    .send(
      `<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${htmlEscape(title)} · intiba</title><style>body{background:#f5f3ed;color:#182922;font:18px/1.6 system-ui;margin:0;padding:10vh 24px}main{max-width:560px;margin:auto}h1{font-size:36px;line-height:1.15}a{color:inherit}button{background:#d9f27f;border:1px solid #182922;border-radius:6px;padding:14px 24px;font:inherit;cursor:pointer}small{display:block;margin-top:32px}</style><main><b>intiba.</b><h1>${htmlEscape(title)}</h1>${body}<small><a href="/ihracat">Rapor sayfasına dön →</a></small></main></html>`,
    );
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  const action = req.query.action;
  const methods: Record<string, string[]> = {
    request: ["POST"],
    download: ["GET"],
    confirm: ["GET", "POST"],
    unsubscribe: ["GET", "POST"],
    leads: ["GET"],
  };
  if (typeof action !== "string" || !methods[action])
    return res.status(404).json({ error: "Sayfa bulunamadı." });
  if (!methods[action].includes(req.method || "")) {
    res.setHeader("Allow", methods[action].join(", "));
    return res.status(405).json({ error: "Bu işlem yöntemi desteklenmiyor." });
  }
  const isHtml = ["confirm", "unsubscribe", "download"].includes(action);
  try {
    if (req.method === "POST" && req.headers.origin) {
      const allowed = new Set([
        publicUrl(),
        "https://intiba.co.uk",
        "https://www.intiba.co.uk",
      ]);
      if (process.env.NODE_ENV !== "production")
        [
          "http://localhost:5173",
          "http://127.0.0.1:5173",
          "http://localhost:3000",
          "http://127.0.0.1:3000",
        ].forEach((x) => allowed.add(x));
      if (!allowed.has(req.headers.origin))
        throw new ExportAudienceError(403, "İstek kaynağı geçersiz.");
    }
    const ip = process.env.VERCEL
      ? String(
          req.headers["x-vercel-forwarded-for"] ||
            req.socket?.remoteAddress ||
            "unknown",
        )
          .split(",")[0]
          .trim()
      : req.socket?.remoteAddress || "local";
    if (!checkRateLimit(`export:${ip}`, 60).allowed)
      throw new ExportAudienceError(
        429,
        "Çok fazla istek geldi. Lütfen biraz bekle.",
      );
    if (action === "leads") {
      await requireExportAdmin(req);
      const audience = await getService();
      if (req.query.format === "csv") {
        const csv = await audience.exportSubscribers();
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader(
          "Content-Disposition",
          'attachment; filename="ihracat-izinli-kisiler.csv"',
        );
        return res.status(200).send(csv);
      }
      const statuses = [
        "not_requested",
        "pending",
        "subscribed",
        "unsubscribed",
      ];
      if (req.query.status && !statuses.includes(String(req.query.status)))
        throw new ExportAudienceError(400, "Filtre geçersiz.");
      return res
        .status(200)
        .json(
          await audience.list(
            typeof req.query.cursor === "string" ? req.query.cursor : undefined,
            req.query.status as ExportConsentStatus | undefined,
          ),
        );
    }
    if (action === "request") {
      if (
        !String(req.headers["content-type"] || "").startsWith(
          "application/json",
        )
      )
        throw new ExportAudienceError(415, "JSON biçiminde istek gerekli.");
      if (Buffer.byteLength(JSON.stringify(req.body || {})) > 4096)
        throw new ExportAudienceError(413, "Form bilgileri çok uzun.");
      const parsed = exportRequestSchema.safeParse(req.body);
      if (!parsed.success)
        throw new ExportAudienceError(
          400,
          "E-posta adresini ve form alanlarını kontrol et.",
        );
      if (!parsed.data.website) {
        if (!process.env.RESEND_API_KEY)
          throw new ExportAudienceError(
            503,
            "Rapor gönderimi şu an kullanılamıyor. Lütfen daha sonra tekrar dene.",
          );
        // Check the private artifact before accepting a lead for a missing report.
        await readFile(
          path.join(
            process.cwd(),
            "private-reports",
            "abd-tekne-aksesuarlari.pdf",
          ),
        );
        await (await getService()).request(parsed.data, ip);
      }
      return res
        .status(200)
        .json({
          success: true,
          message:
            "Rapor bağlantısı için e-posta kutunu kontrol et. Birkaç dakika içinde görünmezse spam klasörüne de bak.",
        });
    }
    const audience = await getService();
    const token = req.query.token;
    if (action === "download") {
      await audience.validateRequest(token);
      const file = await readFile(
        path.join(
          process.cwd(),
          "private-reports",
          "abd-tekne-aksesuarlari.pdf",
        ),
      );
      await audience.recordDownload(token);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="ABD-Tekne-Aksesuarlari-Raporu.pdf"',
      );
      return res.status(200).send(file);
    }
    if (action === "confirm") {
      if (req.method === "GET") {
        const { data } = await audience.validateRequest(token);
        if (!data.marketingRequested)
          throw new ExportAudienceError(
            400,
            "Bu talepte bülten izni verilmemiş.",
          );
        return page(
          res,
          "Yeni araştırmalardan haberdar ol.",
          `<p>İhracat araştırmaları ve bu konudaki hizmet tanıtımlarını e-postayla almak için tercihini doğrula. İstediğin zaman ayrılabilirsin.</p><form method="post" action="?token=${htmlEscape(encodeURIComponent(String(token)))}"><button type="submit">Evet, e-posta almak istiyorum</button></form>`,
        );
      }
      await audience.confirm(token);
      return page(
        res,
        "Tamamdır, listeye katıldın.",
        "<p>İhracat araştırmaları ve ilgili hizmetler hakkında e-posta alabilirsin. İznini her e-postadaki bağlantıdan geri çekebilirsin.</p>",
      );
    }
    if (req.method === "GET") {
      await audience.validateUnsubscribe(token);
      return page(
        res,
        "E-posta iznini geri çek.",
        `<p>Bundan sonraki ihracat bülteni ve tanıtım e-postaları için listeden çıkarılacaksın.</p><form method="post" action="?token=${htmlEscape(encodeURIComponent(String(token)))}"><button type="submit">E-posta listesinden ayrıl</button></form>`,
      );
    }
    await audience.unsubscribe(token);
    return page(
      res,
      "E-posta iznin geri çekildi.",
      "<p>Bu listeden yeni bülten veya tanıtım e-postası gönderilmesi için verdiğin izin kapatıldı.</p>",
    );
  } catch (error) {
    const known = error instanceof ExportAudienceError;
    const status = known ? error.status : 503;
    const message = known
      ? error.message
      : "İşlem şu an tamamlanamadı. Lütfen biraz sonra tekrar dene.";
    if (!known)
      console.error("[export-research] Operation failed", {
        action,
        code: (error as { code?: string })?.code || "unknown",
      });
    if (status === 429) res.setHeader("Retry-After", "3600");
    if (isHtml)
      return page(
        res,
        "Bağlantıyı kontrol edelim.",
        `<p>${htmlEscape(message)}</p>`,
        status,
      );
    return res.status(status).json({ error: message });
  }
}
