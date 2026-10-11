/**
 * Hafif dil sezgisi (kesin değil). Canlı sunucu yalnız prompt'ta "Metinler Türkçe" der; dil denetimi bu sezgi ve
 * üretim doğrulayıcısıyla yapılır. Kanıt yoksa 'unknown' döner; bu bir başarı iddiası değildir.
 */
const TR_CHARS = /[çğıöşüÇĞİÖŞÜ]/;
const TR_WORDS = new Set(['ve', 'bir', 'bu', 'için', 'ile', 'daha', 'gibi', 'çok', 'sen', 'siz', 'biz', 'değil', 'her', 'ama', 'sadece', 'bize', 'size', 'bile', 'ya', 'de', 'da', 'mi']);
const EN_WORDS = new Set(['the', 'and', 'you', 'your', 'we', 'with', 'for', 'this', 'that', 'is', 'are', 'of', 'to', 'in', 'on', 'it', 'our', 'at', 'just', 'what', 'every', 'because']);

export function detectLang(text: string): 'tr' | 'en' | 'unknown' {
  const words = text.toLocaleLowerCase('tr').split(/[^\p{L}]+/u).filter(Boolean);
  let tr = TR_CHARS.test(text) ? 2 : 0;
  let en = 0;
  for (const w of words) {
    if (TR_WORDS.has(w)) tr++;
    if (EN_WORDS.has(w)) en++;
  }
  if (tr > en && tr >= 1) return 'tr';
  if (en > tr && en >= 2) return 'en';
  return 'unknown';
}
