import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Loader2, Trash2, GripVertical, BookMarked, FileText, PlayCircle, Check } from 'lucide-react';

export interface BreakdownStepDraft {
  title: string;
  estimatedMinutes: number;
  alreadyDone?: boolean;             // başlangıçta tamamlanmış say (devam eden iş)
  trainingResourceId?: string;       // SOP'tan miras
}

export interface MatchedSopInfo {
  id: string;
  name: string;
}

export interface BreakdownAcceptPayload {
  steps: BreakdownStepDraft[];
  saveAsNewSop: boolean;          // sadece yeni desen ise
  newSopName?: string;
  asDraft?: boolean;             // true → adımlar taslak (draft) olarak kaydedilir
}

interface NowBreakdownPreviewProps {
  open: boolean;
  taskTitle: string;
  reason?: string;
  initialSteps: BreakdownStepDraft[];
  matchedSop?: MatchedSopInfo | null;   // varsa → mevcut kalıp kullanıldı
  isNewPattern?: boolean;                // true ise "kalıp olarak kaydet" toggle göster
  saving: boolean;
  error: string | null;
  onCancel: () => void;
  onAccept: (payload: BreakdownAcceptPayload) => void;
  cancelLabel?: string;                  // "Vazgeç" yerine özel etiket (örn. "Alt adımsız devam et")
  acceptLabel?: string;                  // "Kabul et, başla" yerine özel etiket
}

const NowBreakdownPreview: React.FC<NowBreakdownPreviewProps> = ({
  open,
  taskTitle,
  reason,
  initialSteps,
  matchedSop,
  isNewPattern,
  saving,
  error,
  onCancel,
  onAccept,
  cancelLabel,
  acceptLabel,
}) => {
  const [steps, setSteps] = useState<BreakdownStepDraft[]>(initialSteps);
  const [saveAsSop, setSaveAsSop] = useState(false);
  const [newSopName, setNewSopName] = useState('');
  const [asDraft, setAsDraft] = useState(false);

  useEffect(() => {
    if (open) {
      setSteps(initialSteps);
      setSaveAsSop(false);
      setAsDraft(false);
      setNewSopName(suggestSopName(taskTitle));
    }
  }, [open, initialSteps, taskTitle]);

  const updateStep = (idx: number, title: string) => {
    setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, title } : s)));
  };

  const removeStep = (idx: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== idx));
  };

  const toggleDone = (idx: number) => {
    setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, alreadyDone: !s.alreadyDone } : s)));
  };

  const doneCount = steps.filter((s) => s.alreadyDone).length;

  const totalMinutes = steps.reduce((sum, s) => sum + (s.estimatedMinutes || 0), 0);
  const validSteps = steps.filter((s) => s.title.trim().length > 0);

  const handleAccept = () => {
    onAccept({
      steps: validSteps,
      saveAsNewSop: saveAsSop && newSopName.trim().length > 0,
      newSopName: newSopName.trim() || undefined,
      asDraft,
    });
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={saving ? undefined : onCancel}
          />

          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            className="relative z-10 w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
          >
            {/* Header */}
            <div className="flex items-start justify-between px-5 py-4 border-b border-neutral-100">
              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  matchedSop ? 'bg-emerald-100' : 'bg-violet-100'
                }`}>
                  {matchedSop ? (
                    <BookMarked className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 text-violet-600" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-commons text-sm font-semibold text-[#171717]">
                    Bunu {steps.length} adıma böleyim mi?
                  </h2>
                  <p className="font-commons text-xs text-neutral-500 mt-0.5 truncate">
                    {taskTitle}
                  </p>
                </div>
              </div>
              <button
                onClick={onCancel}
                disabled={saving}
                className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors text-neutral-400 hover:text-neutral-600 disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* SOP chip — mevcut kalıp kullanıldı */}
            {matchedSop && (
              <div className="px-5 py-2.5 bg-emerald-50/60 border-b border-emerald-100 flex items-center gap-2">
                <FileText className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                <p className="font-commons text-[11px] text-emerald-800">
                  <span className="font-medium">{matchedSop.name}</span> kalıbından türetildi
                </p>
              </div>
            )}

            {/* Reason */}
            {reason && !matchedSop && (
              <div className="px-5 py-2 bg-violet-50/40">
                <p className="font-commons text-[11px] text-violet-700 italic">{reason}</p>
              </div>
            )}

            {/* Steps */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
              {steps.length === 0 ? (
                <p className="text-center font-commons text-xs text-neutral-400 py-8">
                  Tüm adımları sildin — onaylarsan görev orijinal hâliyle kalır.
                </p>
              ) : (
                steps.map((step, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg group transition-colors ${
                      step.alreadyDone ? 'bg-emerald-50/40' : 'hover:bg-neutral-50'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleDone(idx)}
                      disabled={saving}
                      title={step.alreadyDone ? 'Yapılacak listesine al' : 'Bu zaten yapıldı'}
                      className={`flex items-center justify-center w-4 h-4 rounded border transition-all flex-shrink-0 ${
                        step.alreadyDone
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : 'border-neutral-300 hover:border-emerald-400'
                      }`}
                    >
                      {step.alreadyDone && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
                    </button>
                    <span className="font-mono text-[10px] text-neutral-400 w-5 text-right flex-shrink-0">
                      {idx + 1}.
                    </span>
                    <GripVertical className="w-3.5 h-3.5 text-neutral-200 flex-shrink-0" />
                    <input
                      type="text"
                      value={step.title}
                      onChange={(e) => updateStep(idx, e.target.value)}
                      disabled={saving}
                      className={`flex-1 min-w-0 bg-transparent font-commons text-sm focus:outline-none placeholder:text-neutral-300 ${
                        step.alreadyDone ? 'line-through text-neutral-400' : 'text-[#171717]'
                      }`}
                    />
                    {step.trainingResourceId && (
                      <PlayCircle
                        className="w-3.5 h-3.5 text-rose-400 flex-shrink-0"
                        aria-label="Eğitim videosu bağlı"
                      />
                    )}
                    <span className="font-mono text-[10px] text-neutral-400 flex-shrink-0 tabular-nums">
                      {step.estimatedMinutes}dk
                    </span>
                    <button
                      type="button"
                      onClick={() => removeStep(idx)}
                      disabled={saving}
                      className="p-1 rounded text-neutral-300 hover:text-rose-500 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* "Kalıp olarak kaydet" — sadece yeni desen ise */}
            {isNewPattern && !matchedSop && validSteps.length >= 3 && (
              <div className="px-5 py-3 bg-amber-50/50 border-t border-amber-100">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saveAsSop}
                    onChange={(e) => setSaveAsSop(e.target.checked)}
                    disabled={saving}
                    className="mt-0.5 accent-amber-600"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-commons text-xs font-medium text-amber-900">
                      Bu kalıbı 'ajans bilgi tabanına' kaydet
                    </p>
                    <p className="font-commons text-[10px] text-amber-700 mt-0.5 leading-relaxed">
                      Bir sonraki benzer iş geldiğinde AI bu kalıbı otomatik kullansın.
                    </p>
                    {saveAsSop && (
                      <input
                        type="text"
                        value={newSopName}
                        onChange={(e) => setNewSopName(e.target.value)}
                        placeholder="Kalıp adı (örn. 'Video Çekimi')"
                        disabled={saving}
                        className="mt-2 w-full px-2.5 py-1.5 rounded-md border border-amber-300 bg-white font-commons text-xs text-[#171717] focus:outline-none focus:border-amber-500"
                      />
                    )}
                  </div>
                </label>
              </div>
            )}

            {/* Footer */}
            <div className="border-t border-neutral-100 px-5 py-3">
              {error && (
                <p className="font-commons text-xs text-rose-600 mb-2">{error}</p>
              )}

              {/* Taslak toggle — adımları aktifleştirmeden plana kaydet */}
              <label className="flex items-center gap-2 mb-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={asDraft}
                  onChange={(e) => setAsDraft(e.target.checked)}
                  disabled={saving}
                  className="accent-amber-600"
                />
                <span className="font-commons text-[11px] text-neutral-600">
                  Taslak olarak kaydet
                  <span className="text-neutral-400"> — şimdilik akışta çıkmasın, sonra aktifleştiririm</span>
                </span>
              </label>

              <div className="flex items-center justify-between gap-3">
                <span className="font-commons text-[11px] text-neutral-500">
                  {validSteps.length} adım · ~{Math.round(totalMinutes / 60 * 10) / 10} saat
                  {doneCount > 0 && (
                    <span className="ml-1.5 text-emerald-600">· {doneCount} hazır</span>
                  )}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onCancel}
                    disabled={saving}
                    className="px-3.5 py-1.5 rounded-lg font-commons text-xs text-neutral-600 hover:bg-neutral-100 transition-colors disabled:opacity-50"
                  >
                    {cancelLabel || 'Vazgeç'}
                  </button>
                  <button
                    type="button"
                    onClick={handleAccept}
                    disabled={saving || validSteps.length === 0}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#171717] text-white font-commons text-xs font-medium hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    {saving ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    {saving
                      ? 'Kaydediliyor…'
                      : asDraft
                      ? 'Taslak kaydet'
                      : acceptLabel || 'Kabul et, başla'}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

// "Soner Şef için tanıtım videosu çekilecek" → "Tanıtım Videosu Çekimi" tarzı kısa öneri
function suggestSopName(taskTitle: string): string {
  const t = taskTitle.toLowerCase();
  if (/video|çekim|prodüksiyon|reklam film/.test(t)) return 'Video Çekimi';
  if (/sosyal medya|instagram|tiktok|reels|post/.test(t)) return 'Sosyal Medya İçeriği';
  if (/marka dil|brand voice|ton/.test(t)) return 'Marka Dili Oluşturma';
  if (/kampanya|launch|lansman/.test(t)) return 'Kampanya Hazırlığı';
  if (/web|site|landing/.test(t)) return 'Web Geliştirme';
  if (/teklif|sunum|proposal/.test(t)) return 'Müşteri Sunumu';
  return '';
}

export default NowBreakdownPreview;
