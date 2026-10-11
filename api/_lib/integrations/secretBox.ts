/**
 * Entegrasyon token'ları için AES-256-GCM şifreleme (yalnız sunucu).
 * Anahtar: INTEGRATION_TOKEN_KEY (base64, 32 bayt). Yoksa/hatalıysa işlem reddedilir (fail-closed).
 * Şifreli değer yalnız istemci erişimi olmayan koleksiyonlarda tutulur.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

export interface SealedValue {
  v: 1;
  iv: string;
  tag: string;
  data: string;
}

function loadKey(raw = process.env.INTEGRATION_TOKEN_KEY): Buffer {
  if (!raw) throw new Error('INTEGRATION_TOKEN_KEY tanımlı değil');
  const key = Buffer.from(raw.trim(), 'base64');
  if (key.length !== 32) throw new Error('INTEGRATION_TOKEN_KEY 32 bayt (base64) olmalı');
  return key;
}

export function seal(plain: string, rawKey?: string): SealedValue {
  const key = loadKey(rawKey);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return { v: 1, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') };
}

export function open(sealed: SealedValue, rawKey?: string): string {
  if (!sealed || sealed.v !== 1) throw new Error('Şifreli değer biçimi geçersiz');
  const key = loadKey(rawKey);
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(sealed.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(sealed.tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(sealed.data, 'base64')), decipher.final()]).toString('utf8');
}
