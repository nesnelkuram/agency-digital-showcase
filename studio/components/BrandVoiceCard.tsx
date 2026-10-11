import React, { useCallback, useEffect, useState } from 'react';
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

/** Marka sesi paketi durumu ve (yalnız yönetici) yükleme. Paket, scripts/build-brand-voice-bundle.mjs ile yerelde üretilir; rehber METNİ bu ekranda gösterilmez. */
const BrandVoiceCard: React.FC<{ projectId: string }> = ({ projectId }) => {
  const [status, setStatus] = useState<Status | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    api(projectId).then(setStatus).catch((e) => setMessage({ kind: 'err', text: `Durum okunamadı: ${e.message}` }));
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
    <section className="panel" aria-label="Marka sesi paketi" data-testid="brand-voice-card" style={{ margin: '0 16px 12px' }}>
      <h2 style={{ marginTop: 0 }}>Marka sesi paketi</h2>
      {!status && !message && <p className="small muted">Durum okunuyor…</p>}
      {status && !status.exists && <p className="warn" role="status">Yüklenmemiş: metin üretimi bu marka için çalışmaz (412). Aşağıdan yönetici olarak paketi yükleyin.</p>}
      {status?.exists && status.valid === false && <p className="warn" role="alert">Saklanan paket geçersiz: {status.errors?.join(' · ')}</p>}
      {status?.exists && status.valid !== false && (
        <p className="small" data-testid="brand-voice-status">
          Hesap <strong>{status.account}</strong> · {status.captionCount} gönderi · {status.excluded?.length ?? 0} dışlanan · {status.verifiedProducts?.length ?? 0} doğrulanmış ürün
          {status.updatedAt ? ` · güncellendi ${new Date(status.updatedAt).toLocaleString('tr-TR')}` : ''}
          <br />Rehber özetleri: {Object.entries(status.guideHashes ?? {}).map(([k, v]) => `${k} ${String(v).slice(0, 8)}`).join(' · ')}
        </p>
      )}
      <label className="field">Paket dosyası (.json; yalnız yönetici)
        <input type="file" accept="application/json,.json" disabled={busy} onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
      </label>
      {message && <p className={message.kind === 'err' ? 'err small' : 'small'} role={message.kind === 'err' ? 'alert' : 'status'}>{message.text}</p>}
    </section>
  );
};

export default BrandVoiceCard;
