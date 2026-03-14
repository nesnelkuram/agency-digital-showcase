/**
 * POST /api/telegram/webhook
 *
 * Telegram Bot webhook handler.
 * Auth: X-Telegram-Bot-Api-Secret-Token header.
 *
 * Commands:
 *   /start {linkCode}  — Link Telegram ↔ intiba account
 *   /gorev {text}      — Create a task via single-turn AI
 *   /liste             — List today's tasks
 *   /tamam {shortId}   — Mark a task as completed
 */
import '../_lib/env';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../_lib/firebaseAdmin.js';
// @ts-ignore — pre-bundled
import { generateJSON } from '../_lib/gemini-bundle.mjs';
import { verifyTelegramWebhook, sendTelegramMessage, formatTaskForTelegram } from '../_lib/telegram.js';
import { checkRateLimit } from '../_lib/rateLimit.js';

export const config = { maxDuration: 30 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify webhook secret
  const secretHeader = req.headers['x-telegram-bot-api-secret-token'] as string | undefined;
  const envSet = !!process.env.TELEGRAM_WEBHOOK_SECRET;
  console.log(`[webhook] secret header present: ${!!secretHeader}, env set: ${envSet}, match: ${secretHeader === process.env.TELEGRAM_WEBHOOK_SECRET}`);
  if (!verifyTelegramWebhook(secretHeader)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const update = req.body;
  const message = update?.message;
  if (!message?.text || !message?.chat?.id) {
    return res.status(200).json({ ok: true }); // non-text update, ignore
  }

  const chatId = String(message.chat.id);
  const text = message.text.trim();

  // Rate limit by chatId
  const rl = checkRateLimit(`tg:${chatId}`, 60, 60_000);
  if (!rl.allowed) {
    await sendTelegramMessage(chatId, '⏳ Çok fazla mesaj gönderdiniz. Lütfen biraz bekleyin.');
    return res.status(200).json({ ok: true });
  }

  const db = getAdminDb();

  try {
    // ─── /start {code} ─────────────────────────────────────────────────────
    if (text.startsWith('/start')) {
      const code = text.split(/\s+/)[1];
      if (!code) {
        await sendTelegramMessage(chatId,
          '👋 Merhaba! intiba görev botuna hoş geldiniz.\n\n' +
          'Hesabınızı bağlamak için web panelinden bir bağlantı kodu alın ve şu şekilde gönderin:\n' +
          '<code>/start ABC12345</code>'
        );
        return res.status(200).json({ ok: true });
      }

      // Look up link code
      const codesSnap = await db.collection('telegram_link_codes')
        .where('code', '==', code.toUpperCase())
        .where('used', '==', false)
        .limit(1)
        .get();

      if (codesSnap.empty) {
        await sendTelegramMessage(chatId, '❌ Geçersiz veya süresi dolmuş kod. Lütfen yeni bir kod alın.');
        return res.status(200).json({ ok: true });
      }

      const codeDoc = codesSnap.docs[0];
      const codeData = codeDoc.data();

      if (codeData.expiresAt < Date.now()) {
        await sendTelegramMessage(chatId, '❌ Bu kodun süresi dolmuş. Lütfen yeni bir kod alın.');
        return res.status(200).json({ ok: true });
      }

      // Create/update user link
      const linkRef = db.collection('telegram_user_links').doc();
      await linkRef.set({
        id: linkRef.id,
        tenantId: codeData.tenantId,
        userId: codeData.userId,
        telegramChatId: chatId,
        telegramUsername: message.from?.username || null,
        linkedAt: Date.now(),
        isActive: true,
      });

      // Mark code as used
      await codeDoc.ref.update({ used: true });

      await sendTelegramMessage(chatId,
        '✅ Hesabınız başarıyla bağlandı!\n\n' +
        'Komutlar:\n' +
        '/gorev {açıklama} — Yeni görev oluştur\n' +
        '/liste — Bugünkü görevleri gör\n' +
        '/tamam {id} — Görevi tamamla'
      );
      return res.status(200).json({ ok: true });
    }

    // ─── Resolve user from chatId ───────────────────────────────────────────
    const linkSnap = await db.collection('telegram_user_links')
      .where('telegramChatId', '==', chatId)
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (linkSnap.empty) {
      await sendTelegramMessage(chatId,
        '🔒 Henüz hesabınız bağlı değil.\n' +
        'Web panelinden bir bağlantı kodu alıp <code>/start KOD</code> gönderin.'
      );
      return res.status(200).json({ ok: true });
    }

    const linkData = linkSnap.docs[0].data();
    const { tenantId, userId } = linkData;

    // ─── /gorev {text} ─────────────────────────────────────────────────────
    if (text.startsWith('/gorev')) {
      const taskText = text.replace(/^\/gorev\s*/, '').trim();
      if (!taskText) {
        await sendTelegramMessage(chatId, '📝 Kullanım: <code>/gorev YouTube videosu kurgulanacak</code>');
        return res.status(200).json({ ok: true });
      }

      // Single-turn AI task creation
      const prompt = `Sen bir dijital ajans görev direktörüsün. Aşağıdaki kısa açıklamadan bir görev oluştur.

Açıklama: "${taskText}"

JSON döndür:
{
  "title": "Görev başlığı (kısa, net)",
  "description": "Detaylı açıklama",
  "priority": "critical|high|medium|low",
  "aiPriorityScore": 0-100,
  "aiRiskLevel": "none|low|medium|high",
  "tags": ["etiket1"],
  "estimatedHours": sayı veya null,
  "delegationScore": 0-100,
  "delegationRationale": "Neden bu delegasyon skoru?"
}

Delegasyon Skoru Kriterleri:
- Standart/rutin iş: +30 (delege edilebilir)
- Karar gerektiren: -30 (kişisel yapılmalı)
- Acil: -20 (kişisel takip)
- Teknik uzmanlık gerektiren: -10
- Başlangıç: 50

Sadece geçerli JSON döndür.`;

      const result = await generateJSON(
        'flash',
        prompt,
        'telegram-task',
        { maxOutputTokens: 1024, temperature: 0.5 }
      );

      // Get user display name
      let createdByName = '';
      try {
        const userDoc = await db.collection('users').doc(userId).get();
        if (userDoc.exists) {
          createdByName = userDoc.data()?.displayName || userDoc.data()?.name || '';
        }
      } catch { /* ignore */ }

      const taskRef = db.collection('tasks').doc();
      const now = new Date();

      const taskData: Record<string, any> = {
        id: taskRef.id,
        tenantId,
        title: result.title || taskText,
        status: 'open',
        priority: result.priority || 'medium',
        aiPriorityScore: result.aiPriorityScore ?? 50,
        aiRiskLevel: result.aiRiskLevel || 'none',
        createdBy: userId,
        createdByName,
        createdAt: now,
        updatedAt: now,
        source: 'telegram',
      };

      if (result.description) taskData.description = result.description;
      if (result.tags?.length) taskData.tags = result.tags;
      if (result.estimatedHours) taskData.estimatedHours = result.estimatedHours;
      if (result.delegationScore != null) taskData.delegationScore = result.delegationScore;
      if (result.delegationRationale) taskData.delegationRationale = result.delegationRationale;

      await taskRef.set(taskData);

      const shortId = taskRef.id.slice(0, 6);
      const scoreEmoji = (result.delegationScore ?? 50) >= 60 ? '🤝' : '👤';

      await sendTelegramMessage(chatId,
        `✅ Görev oluşturuldu!\n\n` +
        `<b>${taskData.title}</b>\n` +
        `🆔 <code>${shortId}</code>\n` +
        `📊 Öncelik: ${result.aiPriorityScore ?? 50}/100\n` +
        `${scoreEmoji} Delegasyon: ${result.delegationScore ?? 50}/100\n` +
        (result.delegationRationale ? `💡 ${result.delegationRationale}` : '')
      );
      return res.status(200).json({ ok: true });
    }

    // ─── /liste ─────────────────────────────────────────────────────────────
    if (text.startsWith('/liste')) {
      const tasksSnap = await db.collection('tasks')
        .where('tenantId', '==', tenantId)
        .where('status', 'in', ['open', 'in_progress', 'awaiting_review', 'blocked'])
        .orderBy('aiPriorityScore', 'desc')
        .limit(15)
        .get();

      if (tasksSnap.empty) {
        await sendTelegramMessage(chatId, '🎉 Aktif görev yok! Harika iş.');
        return res.status(200).json({ ok: true });
      }

      const lines = tasksSnap.docs.map(doc => formatTaskForTelegram(doc.data() as any));
      const header = `📋 <b>Aktif Görevler</b> (${tasksSnap.size})\n\n`;

      await sendTelegramMessage(chatId, header + lines.join('\n\n'));
      return res.status(200).json({ ok: true });
    }

    // ─── /tamam {shortId} ───────────────────────────────────────────────────
    if (text.startsWith('/tamam')) {
      const shortId = text.split(/\s+/)[1];
      if (!shortId || shortId.length < 4) {
        await sendTelegramMessage(chatId, '📝 Kullanım: <code>/tamam abc123</code> (görev ID\'nin ilk 6 karakteri)');
        return res.status(200).json({ ok: true });
      }

      // Find task by prefix
      const tasksSnap = await db.collection('tasks')
        .where('tenantId', '==', tenantId)
        .where('status', 'in', ['open', 'in_progress', 'awaiting_review'])
        .get();

      const matchDoc = tasksSnap.docs.find(d => d.id.startsWith(shortId.toLowerCase()));

      if (!matchDoc) {
        await sendTelegramMessage(chatId, `❌ <code>${shortId}</code> ile başlayan aktif görev bulunamadı.`);
        return res.status(200).json({ ok: true });
      }

      await matchDoc.ref.update({
        status: 'completed',
        updatedAt: new Date(),
      });

      await sendTelegramMessage(chatId, `✅ <b>${matchDoc.data().title}</b> tamamlandı!`);
      return res.status(200).json({ ok: true });
    }

    // ─── Unknown command ────────────────────────────────────────────────────
    await sendTelegramMessage(chatId,
      '🤖 Komutlar:\n\n' +
      '/gorev {açıklama} — Yeni görev oluştur\n' +
      '/liste — Aktif görevleri gör\n' +
      '/tamam {id} — Görevi tamamla'
    );
    return res.status(200).json({ ok: true });

  } catch (error: any) {
    console.error('[telegram/webhook] Error:', error);
    try {
      await sendTelegramMessage(chatId, '❗ Bir hata oluştu. Lütfen tekrar deneyin.');
    } catch { /* ignore */ }
    return res.status(200).json({ ok: true }); // Always 200 for Telegram
  }
}
