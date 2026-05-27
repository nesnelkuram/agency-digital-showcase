/**
 * Gün → tema eşlemesi. NowPage ve useNowTask aynı kaynağı kullanır.
 * Phase 2: kullanıcı tercihinden (Firestore) okunacak.
 */

export type DayTheme = 'AJANS' | 'DOME' | 'INTIBA' | 'BONUS' | 'OFF';

export const DEFAULT_THEME_SCHEDULE: Record<number, DayTheme> = {
  0: 'OFF',       // Pazar
  1: 'AJANS',     // Pazartesi
  2: 'AJANS',     // Salı
  3: 'DOME',      // Çarşamba
  4: 'DOME',      // Perşembe
  5: 'INTIBA',    // Cuma
  6: 'BONUS',     // Cumartesi
};

export function getTodayTheme(date: Date = new Date()): DayTheme {
  return DEFAULT_THEME_SCHEDULE[date.getDay()] ?? 'OFF';
}

/**
 * Bir görev günün temasıyla uyumlu mu? (projectName veya tags eşleşmesi)
 * Eşik düşük tutulmuş — fazla kısıtlama frog seçimini boğmasın.
 */
export function matchesTheme(
  theme: DayTheme,
  projectName?: string,
  tags?: string[]
): boolean {
  if (theme === 'OFF' || theme === 'BONUS') return false;
  const t = theme.toLowerCase();
  if (projectName && projectName.toLowerCase().includes(t)) return true;
  if (tags && tags.some((tag) => tag.toLowerCase().includes(t))) return true;
  return false;
}
