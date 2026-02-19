import type { VercelResponse } from '@vercel/node';
import { Resend } from 'resend';
import { withAuth, AuthenticatedRequest } from './_lib/withAuth.js';

const resend = new Resend(process.env.RESEND_API_KEY);

export default withAuth(async (
  req: AuthenticatedRequest,
  res: VercelResponse
) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      type, // 'new_comment' | 'video_shared'
      videoTitle,
      videoUrl,
      recipientEmail,
      recipientName,
      senderName,
      commentText,
      commentTimestamp,
    } = req.body;

    if (!recipientEmail || !videoTitle || !type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    let subject = '';
    let bodyContent = '';

    if (type === 'new_comment') {
      subject = `${senderName} "${videoTitle}" videosuna yorum birakti`;
      bodyContent = `
        <div class="section">
          <h2>Yeni Yorum</h2>
          <div class="value"><span class="label">Video:</span> ${videoTitle}</div>
          <div class="value"><span class="label">Yorumu Yapan:</span> ${senderName}</div>
          ${commentTimestamp ? `<div class="value"><span class="label">Zaman:</span> ${commentTimestamp}</div>` : ''}
          <div class="comment-box">${commentText}</div>
        </div>
      `;
    } else if (type === 'video_shared') {
      subject = `${senderName} sizinle bir video paylasti: ${videoTitle}`;
      bodyContent = `
        <div class="section">
          <h2>Video Paylasimi</h2>
          <div class="value"><span class="label">Video:</span> ${videoTitle}</div>
          <div class="value"><span class="label">Paylasan:</span> ${senderName}</div>
        </div>
      `;
    }

    const { data, error } = await resend.emails.send({
      from: 'intiba Feedback <onboarding@resend.dev>',
      to: [recipientEmail],
      subject,
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
            .comment-box { background: #f5f5f5; padding: 12px; border-radius: 6px; margin-top: 10px; font-style: italic; }
            .cta { display: inline-block; background: #171717; color: white; padding: 12px 24px; border-radius: 100px; text-decoration: none; margin-top: 15px; font-weight: bold; }
            .footer { text-align: center; padding: 20px; color: #737373; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>intiba Geribildirim</h1>
            </div>
            <div class="content">
              <p>Merhaba ${recipientName || ''},</p>
              ${bodyContent}
              ${videoUrl ? `<a href="${videoUrl}" class="cta">Videoyu Izle</a>` : ''}
            </div>
            <div class="footer">
              <p>Bu email intiba geribildirim sistemi tarafindan otomatik gonderilmistir.</p>
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

    return res.status(200).json({ success: true, messageId: data?.id });
  } catch (error: any) {
    console.error('Server error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});
