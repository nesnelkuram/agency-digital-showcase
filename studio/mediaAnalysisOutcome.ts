import { describeAnalysisFailure } from '@/shared/mediaAnalysisError';

export type AnalysisOutcome = { ok: true } | { ok: false; message: string; fatal?: boolean };

/**
 * Tek görsel analizi çağrısının sonucunu kullanıcıya gösterilecek DURUMA çevirir. Üç hata kaynağı AYRI söylenir:
 *  - sunucu isteği kendisi reddedildi (yetki/kapalı/yapılandırma/5xx: `Analiz isteği sunucuda reddedildi`),
 *  - sunucu 200 döndü ama görsel analizi başarısız (sağlayıcı reddi veya çıktı doğrulama: `Görsel analizi başarısız`),
 *  - caption/fikir hataları bu yoldan GELMEZ (yaratıcı akışın kendi mesajı).
 * Sağlayıcı ayrıntısı yalnız allowlist'li alanlardan (shared/mediaAnalysisError) kurulur; ham kayıt metni gösterilmez.
 */
export async function analysisOutcome(call: () => Promise<any>): Promise<AnalysisOutcome> {
  try {
    const r = await call();
    const rec = r?.analysis;
    if (rec && rec.status === 'done') return { ok: true };
    return { ok: false, message: rec?.error ? describeAnalysisFailure(rec.error) : 'Görsel analizi tamamlanamadı (kayıt döndürülmedi).' };
  } catch (e: any) {
    const http = typeof e?.status === 'number' ? ` (HTTP ${e.status})` : '';
    return { ok: false, message: `Analiz isteği sunucuda reddedildi${http}: ${e?.message ?? 'bilinmeyen hata'}`, fatal: e?.code === 'feature_disabled' || e?.code === 'model_config_invalid' };
  }
}
