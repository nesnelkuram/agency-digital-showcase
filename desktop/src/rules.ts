import { Task } from "./types";

// ── Tetiklenen bildirim hafızası (localStorage) ───────────────────────────
const FIRED_KEY = "intiba-fired-notifications";

function loadFired(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(FIRED_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveFired(fired: Record<string, boolean>): void {
  // Aşırı büyümeyi önle.
  const keys = Object.keys(fired);
  if (keys.length > 800) {
    for (const k of keys.slice(0, keys.length - 500)) delete fired[k];
  }
  try {
    localStorage.setItem(FIRED_KEY, JSON.stringify(fired));
  } catch {
    /* ignore */
  }
}

// ── Yardımcılar ────────────────────────────────────────────────────────────
const LEAD_TIMES_MINUTES = [2880, 1440, 720, 360, 180, 60] as const; // büyükten küçüğe

function leadLabel(minutes: number): string {
  if (minutes >= 1440) return `${Math.round(minutes / 1440)} gün kaldı`;
  if (minutes >= 60) return `${Math.round(minutes / 60)} saat kaldı`;
  return `${minutes} dakika kaldı`;
}

function todayStr(now: Date): string {
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

function isSameLocalDay(ms: number, now: Date): boolean {
  const d = new Date(ms);
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export interface PendingNotification {
  key: string;
  title: string;
  body: string;
}

/**
 * Tüm aktif görevleri değerlendirir, tetiklenmesi gereken YENİ bildirimleri döner.
 * Tetiklenen anahtarları kalıcı olarak işaretler (aynı uyarı tekrar gönderilmez).
 */
export function evaluateRules(tasks: Task[], now: Date = new Date()): PendingNotification[] {
  const fired = loadFired();
  const out: PendingNotification[] = [];
  const today = todayStr(now);
  const nowMs = now.getTime();

  const fire = (key: string, title: string, body: string) => {
    if (fired[key]) return;
    fired[key] = true;
    out.push({ key, title, body });
  };

  let noDeadlineCount = 0;
  let hasDueToday = false;

  // Öncelik skoruna göre sırala (en kritik süresiz görev önce dürtülsün).
  const sorted = [...tasks].sort(
    (a, b) => (b.aiPriorityScore ?? 0) - (a.aiPriorityScore ?? 0)
  );

  for (const t of sorted) {
    if (t.reminderEnabled === false) continue;

    // ── Kural 1: Deadline yaklaşıyor / geçti ──────────────────────────────
    if (t.dueDateMs) {
      if (isSameLocalDay(t.dueDateMs, now)) hasDueToday = true;
      const minutesLeft = (t.dueDateMs - nowMs) / 60000;

      if (minutesLeft < 0) {
        const dueLabel = new Date(t.dueDateMs).toLocaleString("tr-TR", {
          dateStyle: "short",
          timeStyle: "short",
        });
        fire(
          `${t.id}:overdue`,
          `⚠️ Görev gecikti: ${t.title}`,
          `Deadline ${dueLabel} idi.${t.projectName ? ` · ${t.projectName}` : ""}`
        );
      } else {
        // En kritik (en küçük) aşılmış milestone'u tetikle, kalanları bastır.
        const candidates = LEAD_TIMES_MINUTES.filter(
          (L) => minutesLeft <= L && !fired[`${t.id}:${L}`]
        );
        if (candidates.length > 0) {
          const toFire = Math.min(...candidates);
          // Daha büyük adayları "geçildi" işaretle (retroaktif spam'i önler).
          for (const L of candidates) if (L !== toFire) fired[`${t.id}:${L}`] = true;
          fire(
            `${t.id}:${toFire}`,
            `⏰ ${leadLabel(toFire)}: ${t.title}`,
            `${t.projectName ? `${t.projectName} · ` : ""}Önceliğin bu.`
          );
        }
      }
    } else {
      // ── Kural 2: Süre/öncelik atanmamış görev ───────────────────────────
      // Deadline yok. Günde en fazla 3 tanesini (en yüksek skorlu) dürt.
      const lowPriority = !t.aiPriorityScore || t.aiPriorityScore < 50;
      if (lowPriority && noDeadlineCount < 3) {
        noDeadlineCount++;
        fire(
          `nodeadline:${t.id}:${today}`,
          `🏷️ Süre/öncelik koymadın: ${t.title}`,
          `${t.projectName ? `${t.projectName} · ` : ""}Bu işe bir tarih ve öncelik belirle.`
        );
      }
    }
  }

  // ── Kural 3: Sabah planlama kontrolü ───────────────────────────────────
  // 08:00–12:00 arası, bugün için planlanmış (dueToday) görev yoksa.
  const hour = now.getHours();
  if (hour >= 8 && hour < 12 && !hasDueToday) {
    fire(
      `plan:${today}`,
      "🌅 Bugünü planladın mı?",
      "Bugün için tarihli görevin yok. Günün işlerini belirle, ŞİMDİ'ye yaz."
    );
  }

  saveFired(fired);
  return out;
}
