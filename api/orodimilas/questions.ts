import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../_lib/firebaseAdmin.js';
import { checkRateLimit } from '../_lib/rateLimit.js';
import {
  ORODIMILAS_COLLECTION, QuestionnaireError, questionnaireSchema, resendMail, submitQuestionnaire,
} from '../_lib/orodimilasQuestionnaire.js';

function allowedOrigins() {
  const origins = new Set(['https://www.intiba.co.uk', 'https://intiba.co.uk']);
  if (process.env.VERCEL_URL) origins.add(`https://${process.env.VERCEL_URL}`);
  if (process.env.VERCEL_BRANCH_URL) origins.add(`https://${process.env.VERCEL_BRANCH_URL}`);
  return origins;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Bu işlem yöntemi desteklenmiyor.' });
  }
  try {
    if (!req.headers.origin || !allowedOrigins().has(req.headers.origin)) throw new QuestionnaireError(403, 'İstek kaynağı geçersiz.');
    if (!req.headers['content-type']?.toLowerCase().startsWith('application/json')) throw new QuestionnaireError(415, 'Yanıtları sayfadaki form üzerinden gönderin.');
    if (Buffer.byteLength(JSON.stringify(req.body) || '', 'utf8') > 160_000) throw new QuestionnaireError(413, 'Yanıtlar çok uzun.');
    const parsed = questionnaireSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Lütfen ad soyad ve e-posta alanlarını kontrol edin.', fields: [...new Set(parsed.error.issues.map(issue => issue.path[0]))] });
    const ip = String(req.headers['x-vercel-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
    if (!checkRateLimit(`orodimilas:${ip}`, 5, 60_000).allowed) throw new QuestionnaireError(429, 'Çok fazla istek geldi. Lütfen bir dakika sonra tekrar deneyin.');
    const collection = getAdminDb().collection(ORODIMILAS_COLLECTION);
    const result = await submitQuestionnaire(parsed.data, {
      store: {
        async create(id, data) {
          try { await collection.doc(id).create(data); return 'created'; }
          catch (error: any) { if (error?.code === 6 || /already exists/i.test(error?.message || '')) return 'exists'; throw error; }
        },
      },
      mail: resendMail,
    });
    return res.status(result.duplicate ? 200 : 201).json({ reference: result.reference });
  } catch (error) {
    if (error instanceof QuestionnaireError) return res.status(error.status).json({ error: error.message });
    // Kişisel veri ve istek gövdesi günlüğe yazılmaz.
    console.error('[orodimilas] Yanıt kaydedilemedi');
    return res.status(503).json({ error: 'Yanıtlarınız şu anda gönderilemedi. Bilgileriniz bu tarayıcıda saklı; lütfen tekrar deneyin.' });
  }
}
