import type { VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth.js';
import { applyRateLimit, LIMITS } from '../_lib/rateLimit.js';

export const config = {
  maxDuration: 60,
};

/**
 * POST /api/invoices/extract-invoice
 *
 * Yüklenen fatura PDF'ini Gemini ile okuyup yapılandırılmış alanları çıkarır:
 * fatura no, tutar, para birimi, tarihler, müşteri adı/e-posta, açıklama.
 * Body: { pdfData: <base64>, mimeType?: string }
 */
export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!applyRateLimit(res, req.userUid, LIMITS.AI_ANALYSIS)) return;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY yapılandırılmamış' });
  }

  try {
    const { pdfData, mimeType } = req.body || {};
    if (!pdfData) {
      return res.status(400).json({ error: 'pdfData (base64) zorunlu' });
    }

    const client = new GoogleGenAI({ apiKey });

    const prompt = `Bu bir fatura belgesidir. Belgeyi dikkatlice oku ve aşağıdaki alanları çıkar.
Yalnızca aşağıdaki JSON şemasında cevap ver, başka hiçbir şey yazma:

{
  "invoiceNumber": "fatura numarası (string) veya boş string",
  "amount": genel toplam tutar (sadece sayı, ondalık nokta ile; örn 12500.50) veya null,
  "currency": "TRY" | "USD" | "EUR" | "GBP" (₺/TL=TRY, $=USD, €=EUR, £=GBP; belirsizse TRY),
  "issueDate": "düzenlenme tarihi YYYY-MM-DD formatında veya boş string",
  "dueDate": "son ödeme/vade tarihi YYYY-MM-DD formatında veya boş string",
  "customerName": "faturanın kesildiği müşteri/firma adı (alıcı) veya boş string",
  "recipientEmail": "varsa alıcı e-posta adresi veya boş string",
  "description": "fatura konusu/hizmet özeti, kısa (max 120 karakter) veya boş string"
}

ÖNEMLİ:
- Tutar olarak KDV dahil genel toplamı (ödenecek tutar) seç.
- Tarihleri mutlaka YYYY-MM-DD formatına çevir.
- Emin olmadığın alanı boş string ("") veya null bırak, uydurma.
- Sadece geçerli JSON döndür.`;

    const result = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { data: pdfData, mimeType: mimeType || 'application/pdf' } },
            { text: prompt },
          ],
        },
      ],
      config: {
        temperature: 0.1,
        // Düşünmeyi kapat: yapılandırılmış çıkarımda fayda sağlamaz ve token
        // bütçesini tüketerek çıktının boş/yarım dönmesine yol açıyordu.
        thinkingConfig: { thinkingBudget: 0 },
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
      },
    });

    const responseText = result.text ?? '';
    if (!responseText) {
      throw new Error('Gemini boş yanıt döndü');
    }

    let parsed: any;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      const match = responseText.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('Gemini geçersiz JSON döndü');
      parsed = JSON.parse(match[0]);
    }

    const allowedCurrencies = ['TRY', 'USD', 'EUR', 'GBP'];
    const data = {
      invoiceNumber: typeof parsed.invoiceNumber === 'string' ? parsed.invoiceNumber : '',
      amount: typeof parsed.amount === 'number' && parsed.amount > 0 ? parsed.amount : null,
      currency: allowedCurrencies.includes(parsed.currency) ? parsed.currency : 'TRY',
      issueDate: typeof parsed.issueDate === 'string' ? parsed.issueDate : '',
      dueDate: typeof parsed.dueDate === 'string' ? parsed.dueDate : '',
      customerName: typeof parsed.customerName === 'string' ? parsed.customerName : '',
      recipientEmail: typeof parsed.recipientEmail === 'string' ? parsed.recipientEmail : '',
      description: typeof parsed.description === 'string' ? parsed.description : '',
    };

    return res.status(200).json({ success: true, data });
  } catch (err: any) {
    console.error('[extract-invoice] Error:', err.message);
    return res.status(500).json({ error: err.message || 'Fatura okunamadı' });
  }
});
