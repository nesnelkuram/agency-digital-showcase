/**
 * Telegram Bot API helper utilities.
 *
 * Env vars: TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET
 */

const BOT_TOKEN = () => process.env.TELEGRAM_BOT_TOKEN || '';

interface SendMessageOptions {
  parse_mode?: 'HTML' | 'MarkdownV2';
  disable_web_page_preview?: boolean;
  reply_markup?: object;
}

interface TelegramResponse {
  ok: boolean;
  result?: any;
  description?: string;
}

/**
 * Send a text message via Telegram Bot API.
 */
export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  options?: SendMessageOptions
): Promise<TelegramResponse> {
  const token = BOT_TOKEN();
  if (!token) {
    console.warn('[telegram] TELEGRAM_BOT_TOKEN not set — skipping message');
    return { ok: false, description: 'Bot token not configured' };
  }

  const body: Record<string, any> = {
    chat_id: chatId,
    text,
    parse_mode: options?.parse_mode || 'HTML',
    disable_web_page_preview: options?.disable_web_page_preview ?? true,
    ...( options?.reply_markup ? { reply_markup: options.reply_markup } : {} ),
  };

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json() as TelegramResponse;

  if (!data.ok) {
    console.error('[telegram] sendMessage failed:', data.description);
  }

  return data;
}

/**
 * Verify Telegram webhook secret header.
 * Returns true if valid.
 */
export function verifyTelegramWebhook(secretHeader: string | undefined): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected) {
    console.warn('[telegram] TELEGRAM_WEBHOOK_SECRET not set — rejecting all webhooks');
    return false;
  }
  return secretHeader === expected;
}

/**
 * Format a task for Telegram display.
 */
export function formatTaskForTelegram(task: {
  id: string;
  title: string;
  status: string;
  priority: string;
  aiPriorityScore?: number;
  dueDate?: any;
  assigneeName?: string;
}): string {
  const priorityEmoji: Record<string, string> = {
    critical: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '🟢',
  };

  const statusLabel: Record<string, string> = {
    open: '📋 Açık',
    in_progress: '🔄 Devam',
    awaiting_review: '👀 İnceleme',
    blocked: '🚫 Engel',
    completed: '✅ Tamamlandı',
    cancelled: '❌ İptal',
  };

  const emoji = priorityEmoji[task.priority] || '⚪';
  const status = statusLabel[task.status] || task.status;
  const shortId = task.id.slice(0, 6);
  const score = task.aiPriorityScore != null ? ` (${task.aiPriorityScore})` : '';

  let line = `${emoji} <b>${task.title}</b>\n   ${status}${score} · <code>${shortId}</code>`;

  if (task.dueDate) {
    const d = task.dueDate.toDate ? task.dueDate.toDate() : new Date(task.dueDate);
    const isOverdue = d < new Date();
    const dateStr = d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
    line += isOverdue ? `\n   ⚠️ <b>GECİKMİŞ:</b> ${dateStr}` : `\n   📅 ${dateStr}`;
  }

  if (task.assigneeName) {
    line += `\n   👤 ${task.assigneeName}`;
  }

  return line;
}
