import React, { useState } from 'react';
import { X, Save, Loader2, Calendar } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

interface EditScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaignId: string;
  currentSchedule: {
    startDate: string;
    endDate?: string;
    timezone: string;
  };
  onSaved: () => void;
}

const TIMEZONE_OPTIONS: { value: string; label: string }[] = [
  { value: 'Europe/Istanbul', label: 'Europe/Istanbul (UTC+3)' },
  { value: 'Europe/London', label: 'Europe/London (UTC+0)' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (UTC+1)' },
  { value: 'America/New_York', label: 'America/New_York (UTC-5)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (UTC-8)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (UTC+4)' },
];

const EditScheduleModal: React.FC<EditScheduleModalProps> = ({
  isOpen,
  onClose,
  campaignId,
  currentSchedule,
  onSaved,
}) => {
  const [startDate, setStartDate] = useState<string>(currentSchedule.startDate ?? '');
  const [endDate, setEndDate] = useState<string>(currentSchedule.endDate ?? '');
  const [timezone, setTimezone] = useState<string>(
    currentSchedule.timezone ?? 'Europe/Istanbul'
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!startDate) {
      setError('Baslangic tarihi zorunludur.');
      return;
    }
    if (endDate && endDate < startDate) {
      setError('Bitis tarihi, baslangic tarihinden once olamaz.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const campaignRef = doc(db!, 'campaigns', campaignId);
      const scheduleUpdate: Record<string, any> = {
        'schedule.startDate': startDate,
        'schedule.timezone': timezone,
      };

      if (endDate) {
        scheduleUpdate['schedule.endDate'] = endDate;
      } else {
        scheduleUpdate['schedule.endDate'] = null;
      }

      await updateDoc(campaignRef, scheduleUpdate);
      onSaved();
      onClose();
    } catch (err) {
      console.error('Zamanlama guncellenirken hata olustu:', err);
      setError('Kaydedilirken bir hata olustu. Lutfen tekrar deneyin.');
    } finally {
      setSaving(false);
    }
  };

  const computeDuration = (): string | null => {
    if (!startDate || !endDate) return null;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffMs = end.getTime() - start.getTime();
    if (diffMs < 0) return null;
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return `${diffDays} gun`;
  };

  const duration = computeDuration();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl p-6 w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
              <Calendar className="w-4 h-4 text-indigo-600" />
            </div>
            <h2 className="text-lg font-commons font-bold text-[#171717]">
              Zamanlamayi Duzenle
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>

        {/* Form */}
        <div className="space-y-5">
          {/* Start Date */}
          <div>
            <label className="block text-sm font-commons font-semibold text-neutral-700 mb-2">
              Baslangic Tarihi
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-neutral-200 rounded-lg px-3 py-2 font-commons text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-sm font-commons font-semibold text-neutral-700 mb-2">
              Bitis Tarihi
              <span className="ml-1 text-xs font-normal text-neutral-400">(opsiyonel)</span>
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate || undefined}
              className="w-full border border-neutral-200 rounded-lg px-3 py-2 font-commons text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
            />
            {endDate && (
              <button
                type="button"
                onClick={() => setEndDate('')}
                className="mt-1 text-xs font-commons text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                Bitis tarihini kaldir (surekli kampanya)
              </button>
            )}
          </div>

          {/* Timezone */}
          <div>
            <label className="block text-sm font-commons font-semibold text-neutral-700 mb-2">
              Saat Dilimi
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full border border-neutral-200 rounded-lg px-3 py-2 font-commons text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 bg-white"
            >
              {TIMEZONE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Duration info */}
          {duration && (
            <div className="bg-neutral-50 rounded-lg p-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-neutral-400" />
              <p className="text-xs font-commons text-neutral-500">
                Kampanya suresi: <span className="font-semibold text-neutral-700">{duration}</span>
              </p>
            </div>
          )}

          {!endDate && startDate && (
            <div className="bg-indigo-50 rounded-lg p-3">
              <p className="text-xs font-commons text-indigo-600">
                Bitis tarihi belirlenmedi. Kampanya manuel durdurulana kadar devam edecek.
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-sm font-commons text-red-600">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-neutral-100">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-lg border border-neutral-200 font-commons text-sm text-neutral-600 hover:bg-neutral-50 transition-colors disabled:opacity-50"
          >
            Iptal
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-lg font-commons text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditScheduleModal;
