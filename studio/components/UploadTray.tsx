/**
 * Tek toplam ilerleme çubuğu (varsayılan görünüm) + açılır dosya ayrıntısı. Ekranın köşesinde, sayfa/marka
 * değişiminden bağımsız yaşar. Çubuk BAYT oranıdır; "tamamlandı" sayısı yalnız katalog kaydı yazılan dosyaları sayar.
 */
import React, { useState, useSyncExternalStore } from 'react';
import { ChevronDown, ChevronUp, Pause, Play, RotateCcw, X } from 'lucide-react';
import { formatBytesDecimal } from '@/shared/types/brandMedia';
import { ACTIVE_STATUSES, type QueuedUpload, type UploadService } from '../library/uploadService';

const STATUS_LABEL: Record<QueuedUpload['status'], string> = {
  queued: 'Sırada',
  uploading: 'Yükleniyor',
  paused: 'Duraklatıldı',
  saving: 'Katalog kaydı yazılıyor',
  done: 'Kütüphaneye eklendi',
  error: 'Hata',
  canceled: 'İptal edildi',
};

const btn = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-neutral-200 bg-white/80 text-xs text-neutral-800 hover:bg-white';

const Row: React.FC<{ item: QueuedUpload; service: UploadService }> = ({ item, service }) => {
  const active = ACTIVE_STATUSES.has(item.status);
  return (
    <li className="py-1.5 border-t border-neutral-100 first:border-t-0" data-testid="upload-row">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-neutral-900 truncate">{item.file.name}</span>
        <span className="text-[11px] text-neutral-500 shrink-0">
          {formatBytesDecimal(item.file.size)} · {STATUS_LABEL[item.status]}
        </span>
      </div>
      {item.projectName && <p className="text-[11px] text-neutral-400 truncate">{item.projectName}</p>}
      {item.error && <p className="text-[11px] text-red-600">{item.error}</p>}
      <div className="flex gap-1 mt-1">
        {item.status === 'uploading' && (
          <button className={btn} onClick={() => service.pause(item.key)}>
            <Pause className="w-3 h-3" /> Duraklat
          </button>
        )}
        {item.status === 'paused' && (
          <button className={btn} onClick={() => service.resume(item.key)}>
            <Play className="w-3 h-3" /> Devam
          </button>
        )}
        {active && item.status !== 'saving' && (
          <button className={btn} onClick={() => service.cancel(item.key)}>
            <X className="w-3 h-3" /> İptal
          </button>
        )}
        {(item.status === 'error' || item.status === 'canceled') && (
          <button className={btn} onClick={() => service.retry(item.key)}>
            <RotateCcw className="w-3 h-3" /> Tekrar dene
          </button>
        )}
        {!active && (
          <button className={btn} onClick={() => service.dismiss(item.key)}>
            Listeden kaldır
          </button>
        )}
      </div>
    </li>
  );
};

const UploadTray: React.FC<{ service: UploadService }> = ({ service }) => {
  const snap = useSyncExternalStore(service.subscribe, service.getSnapshot, service.getSnapshot);
  const [open, setOpen] = useState(false);
  const { items, summary: s, queuePaused, dependencyError } = snap;
  if (items.length === 0) return null;
  const pct = Math.round(s.fraction * 100);
  const finished = !s.active;

  return (
    <aside
      aria-label="Kütüphane yükleme durumu"
      className="fixed bottom-4 right-4 z-[60] w-[min(92vw,380px)] rounded-2xl border border-white/70 bg-white/90 backdrop-blur-xl shadow-lg p-3 font-grotesk"
      data-testid="upload-tray"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-neutral-900" data-testid="upload-tray-count">
            {s.done}/{s.total} dosya kütüphaneye eklendi
          </p>
          <p className="text-[11px] text-neutral-500">
            {formatBytesDecimal(s.uploadedBytes)} / {formatBytesDecimal(s.totalBytes)} yüklendi
            {s.recordsPending > 0 && ` · ${s.recordsPending} dosyanın katalog kaydı bekliyor`}
            {s.failed > 0 && ` · ${s.failed} hata`}
            {s.canceled > 0 && ` · ${s.canceled} iptal`}
            {queuePaused && ' · kuyruk duraklatıldı'}
          </p>
        </div>
        <button className={btn} onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Dosya ayrıntıları">
          {open ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />} Ayrıntı
        </button>
      </div>

      {dependencyError && (
        <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700" role="alert" data-testid="upload-deps-error">
          {dependencyError}{' '}
          <button className={btn} onClick={() => service.retryDependencies()}>
            <RotateCcw className="w-3 h-3" /> Tekrar dene
          </button>
        </div>
      )}

      <div
        className="mt-2 h-2 rounded-full bg-neutral-100 overflow-hidden"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label="Toplam yükleme ilerlemesi"
      >
        <div className={`h-full ${s.failed > 0 ? 'bg-amber-500' : 'bg-[#171717]'}`} style={{ width: `${pct}%` }} />
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {s.active && !queuePaused && (
          <button className={btn} onClick={() => service.pauseAll()}>
            <Pause className="w-3 h-3" /> Duraklat
          </button>
        )}
        {(queuePaused || s.paused > 0) && (
          <button className={btn} onClick={() => service.resumeAll()}>
            <Play className="w-3 h-3" /> Devam
          </button>
        )}
        {s.failed > 0 && (
          <button className={btn} onClick={() => service.retryFailed()}>
            <RotateCcw className="w-3 h-3" /> Hatalıları tekrar dene
          </button>
        )}
        {s.active && (
          <button className={btn} onClick={() => service.cancelAll()}>
            <X className="w-3 h-3" /> Tümünü iptal et
          </button>
        )}
        {finished && (
          <button className={btn} onClick={() => service.clearFinished()}>
            Tamamlananları temizle
          </button>
        )}
      </div>

      {s.active && (
        <p className="mt-2 text-[11px] text-neutral-500">
          Site içinde gezinmek veya marka değiştirmek yüklemeyi durdurmaz. Sekmeyi kapatır ya da yenilerseniz biten dosyalar kalır; yarım
          kalanlar için dosyaları yeniden seçmeniz gerekir.
        </p>
      )}

      {open && (
        <ul className="mt-2 max-h-64 overflow-y-auto pr-1" data-testid="upload-details">
          {items.map((it) => (
            <Row key={it.key} item={it} service={service} />
          ))}
        </ul>
      )}
    </aside>
  );
};

export default UploadTray;
