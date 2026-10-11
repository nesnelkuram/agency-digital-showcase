import React from 'react';

/** api/_lib/feedback/contentFeedback.ts FEEDBACK_CATEGORIES ile aynı (sunucu şeması doğrular) */
export const FEEDBACK_CATEGORY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'görsel', label: 'Görsel' },
  { value: 'metin', label: 'Metin' },
  { value: 'marka_sesi', label: 'Marka sesi' },
  { value: 'ürün_bilgisi', label: 'Ürün bilgisi' },
  { value: 'format', label: 'Format' },
  { value: 'zamanlama', label: 'Zamanlama' },
  { value: 'tekrar', label: 'Tekrar' },
  { value: 'diğer', label: 'Diğer' },
];

export interface FeedbackReasonValue {
  category: string;
  note: string;
  scope: 'content_only' | 'brand_context';
}

export const EMPTY_REASON: FeedbackReasonValue = { category: '', note: '', scope: 'content_only' };

/** Sebep kategorisi + kısa açıklama + kapsam. Varsayılan kapsam "yalnız bu içerik" (marka bağlamı bilinçli seçim). */
const FeedbackReasonFields: React.FC<{ value: FeedbackReasonValue; onChange: (v: FeedbackReasonValue) => void; notePlaceholder?: string; noteRequired?: boolean }> = ({
  value,
  onChange,
  notePlaceholder = 'Kısa açıklama',
  noteRequired,
}) => (
  <div className="space-y-2" data-testid="feedback-reason">
    <label className="block font-grotesk text-xs text-neutral-600">
      Sebep
      <select
        aria-label="Sebep kategorisi"
        value={value.category}
        onChange={(e) => onChange({ ...value, category: e.target.value })}
        className="block mt-1 w-full px-2 py-1.5 border border-neutral-200 rounded-lg font-grotesk text-sm"
      >
        <option value="">Seçin…</option>
        {FEEDBACK_CATEGORY_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
    <textarea
      aria-label="Sebep açıklaması"
      value={value.note}
      onChange={(e) => onChange({ ...value, note: e.target.value.slice(0, 500) })}
      rows={3}
      placeholder={noteRequired ? `${notePlaceholder} (zorunlu)` : notePlaceholder}
      className="w-full px-3 py-2 border border-neutral-200 rounded-lg font-grotesk text-sm"
    />
    <fieldset className="font-grotesk text-xs text-neutral-600 space-y-1">
      <legend className="mb-1">Bu not nerede kullanılsın?</legend>
      <label className="flex items-center gap-2">
        <input type="radio" name="feedback-scope" checked={value.scope === 'content_only'} onChange={() => onChange({ ...value, scope: 'content_only' })} />
        Yalnız bu içerik için
      </label>
      <label className="flex items-center gap-2">
        <input type="radio" name="feedback-scope" checked={value.scope === 'brand_context'} onChange={() => onChange({ ...value, scope: 'brand_context' })} />
        Sonraki marka planlarında bağlam olarak (marka hafızasını değiştirmez)
      </label>
    </fieldset>
  </div>
);

export default FeedbackReasonFields;
