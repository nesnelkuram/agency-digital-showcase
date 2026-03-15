// Nir Eyal's Hook Model
// Trigger → Action → Variable Reward → Investment

export interface HookAssessment {
  trigger: {
    external: string[];  // Push notification, email, ad, social post
    internal: string[];  // Emotion, routine, situation that triggers usage
    strength: number;    // 0-10: How strong is the trigger?
  };
  action: {
    description: string;
    simplicity: number;  // 0-10: How easy is the intended action?
    motivationMatch: number; // 0-10: Does the trigger align with the action?
  };
  variableReward: {
    tribe: string;       // Social rewards — what others think
    hunt: string;        // Search for resources/information
    self: string;        // Mastery, competence, completion
    variability: number; // 0-10: How unpredictable is the reward?
  };
  investment: {
    description: string;  // What does user put in? (time, data, effort, social capital)
    loadNextTrigger: boolean; // Does investment set up the next trigger?
    switchingCost: number; // 0-10: How hard to leave after investing?
  };
}

export const HOOK_PROMPT_SNIPPET = `
## Hook Model — Alışkanlık Tasarımı
Markanın müşteri alışkanlığı döngüsünü 4 aşamada tasarla:

**1. Tetikleyici (Trigger):**
- Dış tetikleyiciler: Reklam, e-posta, sosyal medya, arama
- İç tetikleyiciler: Hangi DUYGU veya DURUM müşteriyi markaya yönlendiriyor?
- Güçlü markalar İÇ tetikleyicilere sahiptir

**2. Eylem (Action):**
- İstenen davranış nedir? (Siteye gir, sipariş ver, mağazaya gel)
- Bu eylem ne kadar KOLAY? (BJ Fogg B=MAP ile değerlendir)
- Tetikleyici ile eylem arasında uyum var mı?

**3. Değişken Ödül (Variable Reward):**
- Kabile ödülü: Sosyal onay, topluluğa ait olma hissi
- Av ödülü: Yeni bilgi, keşif, iyi fiyat bulma
- Benlik ödülü: Ustalık, tamamlama, kendini geliştirme
- ÖNEMLİ: Ödül DEĞİŞKEN olmalı — her seferinde aynı → sıkılma

**4. Yatırım (Investment):**
- Müşteri ne yatırır? (Zaman, veri, çaba, sosyal sermaye)
- Bu yatırım bir sonraki tetikleyiciyi hazırlıyor mu?
- Geçiş maliyeti ne kadar yüksek?
`;
