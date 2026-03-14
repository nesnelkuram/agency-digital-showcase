/**
 * Telegram integration types.
 * Firestore collections: telegram_user_links, telegram_link_codes
 */

// ─── Telegram ↔ User Link ──────────────────────────────────────────────────
export interface TelegramUserLink {
  id: string;
  tenantId: string;
  userId: string;            // Firebase Auth UID
  telegramChatId: string;    // Telegram chat_id (stringified)
  telegramUsername?: string;  // @username if available
  linkedAt: number;          // Date.now()
  isActive: boolean;
}

// ─── One-time Link Code ─────────────────────────────────────────────────────
export interface TelegramLinkCode {
  id: string;
  tenantId: string;
  userId: string;
  code: string;              // 8-char alphanumeric
  createdAt: number;
  expiresAt: number;         // createdAt + 10 min
  used: boolean;
}
