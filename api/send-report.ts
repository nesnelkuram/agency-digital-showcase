import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      submissionId,
      submissionTime,
      name,
      businessName,
      email,
      phone,
      requestedServices,
      serviceCount,
      stage0,
      stage0Score,
      stage1,
      stage2,
      stage3,
      stage4,
      allAnswers,
      allScores,
    } = req.body;

    // Send email using Resend
    const { data, error } = await resend.emails.send({
      from: 'Brand Strategy Wizard <onboarding@resend.dev>', // You'll change this to your domain
      to: ['info@intiba.co.uk'],
      replyTo: email,
      subject: `Brand Strategy #${submissionId} - ${businessName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #171717; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 20px; }
            .section { background: white; margin: 15px 0; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .label { font-weight: bold; color: #171717; }
            .value { color: #525252; margin-bottom: 10px; }
            .stage { display: inline-block; padding: 8px 12px; margin: 5px; background: #fffceb; border: 2px solid #171717; border-radius: 6px; }
            .footer { text-align: center; padding: 20px; color: #737373; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎯 Yeni Brand Strategy Değerlendirmesi</h1>
              <p>Submission ID: ${submissionId}</p>
            </div>

            <div class="content">
              <div class="section">
                <h2>👤 İletişim Bilgileri</h2>
                <div class="value"><span class="label">Ad Soyad:</span> ${name}</div>
                <div class="value"><span class="label">İşletme:</span> ${businessName}</div>
                <div class="value"><span class="label">Email:</span> ${email}</div>
                <div class="value"><span class="label">Telefon:</span> ${phone}</div>
                <div class="value"><span class="label">Tarih:</span> ${submissionTime}</div>
              </div>

              <div class="section">
                <h2>🎨 Talep Edilen Hizmetler</h2>
                <div class="value"><span class="label">Seçilen Hizmetler:</span> ${requestedServices}</div>
                <div class="value"><span class="label">Toplam:</span> ${serviceCount} hizmet</div>
              </div>

              <div class="section">
                <h2>📊 Aşama Sonuçları</h2>
                <div class="value">
                  <span class="label">Aşama 0:</span> ${stage0} (Skor: ${stage0Score})
                </div>
                <div class="value">
                  <span class="label">Aşama 1:</span> ${stage1}
                </div>
                <div class="value">
                  <span class="label">Aşama 2:</span> ${stage2}
                </div>
                <div class="value">
                  <span class="label">Aşama 3:</span> ${stage3}
                </div>
                <div class="value">
                  <span class="label">Aşama 4:</span> ${stage4}
                </div>
              </div>

              <div class="section">
                <h2>📝 Detaylı Cevaplar</h2>
                <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px; overflow-x: auto;">${allAnswers}</pre>
              </div>

              <div class="section">
                <h2>🔢 Skorlar</h2>
                <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px; overflow-x: auto;">${allScores}</pre>
              </div>
            </div>

            <div class="footer">
              <p>Bu email Brand Strategy Wizard tarafından otomatik olarak gönderilmiştir.</p>
              <p>Submission ID: ${submissionId}</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error('Resend error:', error);
      return res.status(400).json({ error: error.message });
    }

    console.log('Email sent successfully:', data);
    return res.status(200).json({ success: true, messageId: data?.id });

  } catch (error: any) {
    console.error('Server error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
