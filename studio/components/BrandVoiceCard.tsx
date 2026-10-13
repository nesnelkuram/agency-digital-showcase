import React, { useCallback, useEffect, useRef, useState } from 'react';
import { authenticatedFetch } from '@/lib/firebase/apiClient';

interface Status {
  exists: boolean;
  valid?: boolean;
  errors?: string[];
  account?: string;
  captionCount?: number;
  excluded?: Array<{ id: string; reason: string }>;
  guideHashes?: Record<string, string>;
  verifiedProducts?: Array<{ id: string; name: string }>;
  updatedAt?: number;
}

async function api(projectId: string, init?: { bundle: unknown }): Promise<any> {
  const res = init
    ? await authenticatedFetch('/api/studio/brand-voice', { method: 'PUT', body: JSON.stringify({ projectId, bundle: init.bundle }) })
    : await authenticatedFetch(`/api/studio/brand-voice?${new URLSearchParams({ projectId })}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error([body?.error || `İstek başarısız (${res.status})`, ...(Array.isArray(body?.details) ? body.details.slice(0, 3) : [])].join(' · '));
  return body;
}

/**
 * Marka dili durumu. Ana yol: "Marka dilini birlikte oluştur" (konuşma → taslak → yönetici onayı). Manuel paket yükleme yalnız
 * gelişmiş/yönetici yoludur (scripts/build-brand-voice-bundle.mjs ile yerelde üretilir); rehber METNİ bu ekranda gösterilmez.
 * Marka dili yokluğu planı BLOKLAMAZ: geçici plan tonuyla metin üretilebilir (onaylı marka hafızası değildir).
 */
const BrandVoiceCard: React.FC<{ projectId: string; onStartGuide?: () => void; guideVersion?: number | null }> = ({ projectId, onStartGuide, guideVersion }) => {
  const [status, setStatus] = useState<Status | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const pidRef = useRef(projectId);
  pidRef.current = projectId;
  const refresh = useCallback(() => {
    const at = projectId; // eski projenin geç durum yanıtı yeni projede gösterilmez
    api(projectId).then((st) => { if (pidRef.current === at) setStatus(st); }).catch((e) => { if (pidRef.current === at) setMessage({ kind: 'err', text: `Durum okunamadı: ${e.message}` }); });
  }, [projectId]);
  useEffect(refresh, [refresh]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setMessage(null);
    try {
      if (file.size > 400_000) throw new Error('Dosya çok büyük (en fazla ~350 KB paket).');
      const bundle = JSON.parse(await file.text());
      const r = await api(projectId, { bundle });
      setMessage({ kind: 'ok', text: `Yüklendi: ${r.captionCount} hesap gönderisi, ${r.excluded?.length ?? 0} kayıt dışlandı.` });
      refresh();
    } catch (e: any) {
      setMessage({ kind: 'err', text: `Yüklenemedi: ${e.message}` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel" aria-label="Marka dili" data-testid="brand-voice-card" style={{ margin: '0 16px 12px' }}>
      <h2 style={{ marginTop: 0 }}>Marka dili</h2>
      {!status && !message && <p className="small muted">Durum okunuyor…</p>}
      {guideVersion != null && <p className="small" data-testid="brand-guide-status">Onaylı marka rehberi: sürüm {guideVersion} (konuşmayla oluşturuldu, yönetici onaylı).</p>}
      {status && !status.exists && guideVersion == null && (
        <p className="small" role="status" data-testid="brand-voice-missing">Onaylı marka dili yok. Plan akışı bloklanmaz: bir plan tonu seçip metin üretebilir ya da marka dilini birlikte oluşturabilirsiniz.</p>
      )}
      {onStartGuide && <button onClick={onStartGuide} data-testid="brand-guide-open">{guideVersion != null ? 'Marka dilini güncelle' : 'Marka dilini birlikte oluştur'}</button>}
      {status?.exists && status.valid === false && <p className="warn" role="alert">Saklanan paket geçersiz: {status.errors?.join(' · ')}</p>}
      {status?.exists && status.valid !== false && (
        <p className="small" data-testid="brand-voice-status">
          Hesap <strong>{status.account}</strong> · {status.captionCount} gönderi · {status.excluded?.length ?? 0} dışlanan · {status.verifiedProducts?.length ?? 0} doğrulanmış ürün
          {status.updatedAt ? ` · güncellendi ${new Date(status.updatedAt).toLocaleString('tr-TR')}` : ''}
          <br />Rehber özetleri: {Object.entries(status.guideHashes ?? {}).map(([k, v]) => `${k} ${String(v).slice(0, 8)}`).join(' · ')}
        </p>
      )}
      <details className="advanced">
        <summary>Gelişmiş: marka sesi paketi yükle (yönetici)</summary>
        <label className="field">Paket dosyası (.json; yalnız yönetici)
          <input type="file" accept="application/json,.json" disabled={busy} onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
      </details>
      {message && <p className={message.kind === 'err' ? 'err small' : 'small'} role={message.kind === 'err' ? 'alert' : 'status'}>{message.text}</p>}
    </section>
  );
};

export default BrandVoiceCard;
