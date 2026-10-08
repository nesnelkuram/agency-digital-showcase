import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb, getFirebaseAuth } from '../_lib/firebaseAdmin.js';
import { checkRateLimit } from '../_lib/rateLimit.js';
import { OdagiApplicationService, OdagiError, odagiApplicationSchema } from '../_lib/odagiApplications.js';

export async function requireOdagiAdmin(req: VercelRequest) {
  const token = req.headers.authorization;
  if (!token?.startsWith('Bearer ')) throw new OdagiError(401, 'Yönetici girişi gerekli.');
  let uid: string;
  try { uid = (await getFirebaseAuth().verifyIdToken(token.slice(7), true)).uid; }
  catch { throw new OdagiError(401, 'Oturum geçersiz veya süresi dolmuş.'); }
  const user = (await getAdminDb().collection('users').doc(uid).get()).data();
  if (!user || user.status !== 'active' || !['admin', 'super_admin'].includes(user.role)
    || (user.role !== 'super_admin' && user.tenantId !== 'intiba'))
    throw new OdagiError(403, 'Odağı başvurularını yalnızca İntiba yöneticileri görebilir.');
}
function allowedOrigins() {
  const origins = new Set(['https://www.intiba.co.uk', 'https://intiba.co.uk']);
  if (process.env.VERCEL_URL) origins.add(`https://${process.env.VERCEL_URL}`);
  if (process.env.NODE_ENV !== 'production')
    for (const host of ['localhost', '127.0.0.1']) for (const port of [3000, 4178, 4181, 5173]) origins.add(`http://${host}:${port}`);
  return origins;
}
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (!['GET', 'POST'].includes(req.method || '')) {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Bu işlem yöntemi desteklenmiyor.' });
  }
  try {
    if (req.method === 'GET') {
      await requireOdagiAdmin(req);
      if (req.query.cursor !== undefined && typeof req.query.cursor !== 'string') throw new OdagiError(400, 'Sayfa bilgisi geçersiz.');
      const result = await new OdagiApplicationService(getAdminDb()).list(req.query.cursor as string | undefined);
      return res.status(200).json(result);
    }
    if (!req.headers.origin || !allowedOrigins().has(req.headers.origin)) throw new OdagiError(403, 'İstek kaynağı geçersiz.');
    if (!req.headers['content-type']?.toLowerCase().startsWith('application/json')) throw new OdagiError(415, 'Başvuruyu sayfadaki form üzerinden gönderin.');
    if (Buffer.byteLength(JSON.stringify(req.body) || '', 'utf8') > 24000) throw new OdagiError(413, 'Başvuru metni çok uzun.');
    const parsed = odagiApplicationSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Lütfen zorunlu alanları ve başvuru onayını kontrol edin.', fields: [...new Set(parsed.error.issues.map(issue => issue.path[0]))] });
    const ip = process.env.VERCEL
      ? String(req.headers['x-vercel-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim()
      : req.socket?.remoteAddress || 'local';
    if (!checkRateLimit(`odagi:${ip}`, 20, 60_000).allowed) throw new OdagiError(429, 'Çok fazla istek geldi. Lütfen bir dakika sonra tekrar deneyin.');
    const result = await new OdagiApplicationService(getAdminDb()).submit(parsed.data, ip);
    return res.status(result.duplicate ? 200 : 201).json({ reference: result.reference });
  } catch (error) {
    if (error instanceof OdagiError) {
      if (error.status === 429) res.setHeader('Retry-After', '3600');
      return res.status(error.status).json({ error: error.message });
    }
    // Do not log personal data, request bodies or credentials.
    console.error('[odagi] Application service unavailable');
    return res.status(503).json({ error: 'Başvuru şu anda tamamlanamadı. Bilgilerinizi koruduk; lütfen tekrar deneyin.' });
  }
}
