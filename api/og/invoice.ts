import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Fatura linkleri (/fatura/:token) için sosyal önizleme (Open Graph) katmanı.
 * Yalnızca önizleme botları (WhatsApp, Facebook, Twitter vb.) bu yola yönlendirilir;
 * insan ziyaretçiler normal SPA'yı görür (vercel.json rewrite user-agent ile ayırır).
 *
 * Nötr metin döner — fatura tutarı/müşteri gibi hiçbir gizli bilgi sızdırmaz.
 */
export default function handler(_req: VercelRequest, res: VercelResponse) {
  const title = 'İntiba — Fatura';
  const description = 'Faturanızı güvenle görüntüleyin ve indirin.';

  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <meta name="description" content="${description}" />
  <meta name="robots" content="noindex" />

  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="intiba" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />

  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
</head>
<body>
  <p>${title} — ${description}</p>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  return res.status(200).send(html);
}
