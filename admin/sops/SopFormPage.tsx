import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  BookMarked,
  Plus,
  Trash2,
  GripVertical,
  Loader2,
  Save,
  Clock,
} from 'lucide-react';
import { createSop, updateSop, getSop } from '@/shared/services/sopService';
import { useTenantId } from '@/shared/hooks/useTenant';
import { useAuth } from '@/contexts/AuthContext';
import type { SopStep } from '@/shared/types/sop';
import TrainingResourcePicker from './components/TrainingResourcePicker';

const ROLE_OPTIONS = [
  '', 'videographer', 'designer', 'social_media_manager',
  'project_manager', 'editor', 'admin', 'account_manager',
];

const ROLE_LABELS: Record<string, string> = {
  '': 'Rol seçilmedi',
  videographer: 'Videographer',
  designer: 'Designer',
  social_media_manager: 'Sosyal Medya',
  project_manager: 'Proje Yöneticisi',
  editor: 'Editör',
  admin: 'Yönetici',
  account_manager: 'Müşteri İlişkileri',
};

interface StepDraft extends SopStep {
  _key: string;  // React key (sürükle-bırak için stabil id)
}

const newStepKey = () => Math.random().toString(36).slice(2, 9);

const SopFormPage: React.FC = () => {
  const { sopId } = useParams<{ sopId?: string }>();
  const isEdit = Boolean(sopId);
  const navigate = useNavigate();
  const tenantId = useTenantId();
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [keywordsInput, setKeywordsInput] = useState('');
  const [steps, setSteps] = useState<StepDraft[]>([
    { _key: newStepKey(), title: '', estimatedMinutes: 30 },
  ]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  // Mevcut SOP'u yükle
  useEffect(() => {
    if (!isEdit || !sopId) return;
    setLoading(true);
    getSop(sopId)
      .then((sop) => {
        if (!sop) {
          setError('Kalıp bulunamadı');
          return;
        }
        setName(sop.name);
        setDescription(sop.description);
        setKeywordsInput(sop.matchKeywords.join(', '));
        setSteps(
          sop.steps.map((s) => ({ ...s, _key: newStepKey() }))
        );
      })
      .catch((err) => setError(err?.message || 'Yüklenemedi'))
      .finally(() => setLoading(false));
  }, [isEdit, sopId]);

  // Step CRUD
  const addStep = () => {
    setSteps((prev) => [
      ...prev,
      { _key: newStepKey(), title: '', estimatedMinutes: 30 },
    ]);
  };

  const removeStep = (key: string) => {
    setSteps((prev) => prev.filter((s) => s._key !== key));
  };

  const updateStep = (key: string, patch: Partial<StepDraft>) => {
    setSteps((prev) => prev.map((s) => (s._key === key ? { ...s, ...patch } : s)));
  };

  const moveStep = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    setSteps((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  };

  // Kaydet
  const handleSave = async () => {
    setError(null);
    const cleanName = name.trim();
    const cleanSteps = steps.filter((s) => s.title.trim().length > 0);
    if (!cleanName) {
      setError('Kalıp adı zorunlu');
      return;
    }
    if (cleanSteps.length < 2) {
      setError('En az 2 adım gerekli');
      return;
    }

    const keywords = keywordsInput
      .split(/[,\n]/)
      .map((k) => k.trim().toLowerCase())
      .filter((k) => k.length >= 2)
      .slice(0, 12);

    const stepsForSave: SopStep[] = cleanSteps.map((s) => {
      const out: SopStep = {
        title: s.title.trim(),
        estimatedMinutes: Math.min(480, Math.max(5, s.estimatedMinutes || 30)),
      };
      if (s.assigneeRole) out.assigneeRole = s.assigneeRole;
      if (s.notes?.trim()) out.notes = s.notes.trim();
      if (s.trainingResourceId) out.trainingResourceId = s.trainingResourceId;
      return out;
    });

    setSaving(true);
    try {
      if (isEdit && sopId) {
        await updateSop(sopId, {
          name: cleanName,
          description: description.trim(),
          matchKeywords: keywords,
          steps: stepsForSave,
        });
      } else {
        await createSop({
          tenantId,
          name: cleanName,
          description: description.trim(),
          matchKeywords: keywords,
          steps: stepsForSave,
          createdBy: user?.uid || '',
          createdByName: user?.displayName || user?.email || '',
        });
      }
      navigate('/admin/sops');
    } catch (err: any) {
      setError(err?.message || 'Kaydedilemedi');
      setSaving(false);
    }
  };

  const totalMin = steps.reduce((s, x) => s + (x.estimatedMinutes || 0), 0);
  const totalHr = Math.round((totalMin / 60) * 10) / 10;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-7 h-7 text-indigo-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <Link
          to="/admin/sops"
          className="inline-flex items-center gap-1.5 font-commons text-xs text-neutral-500 hover:text-neutral-700 mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Kalıplar
        </Link>
        <h1 className="text-2xl font-grotesk font-bold text-[#171717] flex items-center gap-2">
          <BookMarked className="w-6 h-6 text-emerald-600" />
          {isEdit ? 'Kalıbı Düzenle' : 'Yeni İş Kalıbı'}
        </h1>
        <p className="font-commons text-sm text-neutral-500 mt-0.5">
          AI bu kalıbı benzer görevlerde otomatik olarak önerip kullanır
        </p>
      </div>

      {/* Form */}
      <div className="bg-white rounded-2xl border border-neutral-100 p-5 space-y-4">
        <div>
          <label className="font-commons text-[10px] font-medium text-neutral-500 uppercase tracking-wide block mb-1.5">
            Kalıp Adı
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Örn. Video Çekimi, Sosyal Medya Postu, Marka Dili"
            className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 font-commons text-sm text-[#171717] focus:outline-none focus:border-indigo-300 focus:bg-white"
          />
        </div>

        <div>
          <label className="font-commons text-[10px] font-medium text-neutral-500 uppercase tracking-wide block mb-1.5">
            Açıklama (opsiyonel)
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="1 cümlede ne işine yarar?"
            className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 font-commons text-sm text-[#171717] focus:outline-none focus:border-indigo-300 focus:bg-white"
          />
        </div>

        <div>
          <label className="font-commons text-[10px] font-medium text-neutral-500 uppercase tracking-wide block mb-1.5">
            Eşleşme Etiketleri
          </label>
          <input
            type="text"
            value={keywordsInput}
            onChange={(e) => setKeywordsInput(e.target.value)}
            placeholder="virgülle ayır: video, çekim, tanıtım, reklam filmi"
            className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 font-commons text-sm text-[#171717] focus:outline-none focus:border-indigo-300 focus:bg-white"
          />
          <p className="font-commons text-[10px] text-neutral-400 mt-1.5 px-1">
            AI bu etiketleri kullanarak yeni gelen görevin bu kalıba uyup uymadığını anlar.
          </p>
        </div>
      </div>

      {/* Steps */}
      <div className="bg-white rounded-2xl border border-neutral-100 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-commons text-sm font-semibold text-[#171717]">
            Adımlar ({steps.length})
          </h2>
          <span className="font-commons text-xs text-neutral-500 inline-flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            ~{totalHr} saat
          </span>
        </div>

        <div className="space-y-2">
          {steps.map((step, idx) => (
            <div
              key={step._key}
              draggable
              onDragStart={() => setDragIdx(idx)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIdx !== null) moveStep(dragIdx, idx);
                setDragIdx(null);
              }}
              className={`group rounded-xl border p-3 transition-all ${
                dragIdx === idx
                  ? 'border-emerald-300 bg-emerald-50/40 opacity-50'
                  : 'border-neutral-200 bg-white hover:border-neutral-300'
              }`}
            >
              <div className="flex items-start gap-2">
                <div className="flex items-center gap-1 mt-1.5">
                  <GripVertical className="w-3.5 h-3.5 text-neutral-300 cursor-grab" />
                  <span className="font-mono text-[10px] text-neutral-400 w-4">{idx + 1}</span>
                </div>

                <div className="flex-1 min-w-0 space-y-2">
                  <input
                    type="text"
                    value={step.title}
                    onChange={(e) => updateStep(step._key, { title: e.target.value })}
                    placeholder="Adım başlığı (emir kipinde — örn. 'Brief'i müşteriden al')"
                    className="w-full px-2.5 py-1.5 rounded-md border border-neutral-200 bg-white font-commons text-sm text-[#171717] focus:outline-none focus:border-indigo-300"
                  />

                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-3">
                      <div className="relative">
                        <input
                          type="number"
                          min={5}
                          max={480}
                          value={step.estimatedMinutes}
                          onChange={(e) =>
                            updateStep(step._key, {
                              estimatedMinutes: Math.max(5, Number(e.target.value) || 0),
                            })
                          }
                          className="w-full pl-2 pr-7 py-1 rounded-md border border-neutral-200 bg-white font-commons text-xs text-[#171717] focus:outline-none focus:border-indigo-300 tabular-nums"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 font-commons text-[10px] text-neutral-400 pointer-events-none">
                          dk
                        </span>
                      </div>
                    </div>
                    <div className="col-span-4">
                      <select
                        value={step.assigneeRole || ''}
                        onChange={(e) =>
                          updateStep(step._key, { assigneeRole: e.target.value || undefined })
                        }
                        className="w-full px-2 py-1 rounded-md border border-neutral-200 bg-white font-commons text-xs text-[#171717] focus:outline-none focus:border-indigo-300"
                      >
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-5">
                      <TrainingResourcePicker
                        value={step.trainingResourceId}
                        onChange={(id) => updateStep(step._key, { trainingResourceId: id })}
                      />
                    </div>
                  </div>

                  <input
                    type="text"
                    value={step.notes || ''}
                    onChange={(e) => updateStep(step._key, { notes: e.target.value })}
                    placeholder="Not (opsiyonel) — örn. 'Brief Selen'den gelir'"
                    className="w-full px-2.5 py-1 rounded-md border border-neutral-100 bg-neutral-50/50 font-commons text-xs text-neutral-600 focus:outline-none focus:border-neutral-200 placeholder:text-neutral-300"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => removeStep(step._key)}
                  disabled={steps.length === 1}
                  className="p-1.5 mt-1 rounded text-neutral-300 hover:text-rose-500 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addStep}
          className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-neutral-300 text-neutral-500 hover:text-neutral-700 hover:border-neutral-400 transition-colors font-commons text-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          Adım Ekle
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl">
          <p className="font-commons text-xs text-rose-700">{error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 sticky bottom-4 bg-white/80 backdrop-blur-sm rounded-xl p-3 border border-neutral-100">
        <Link
          to="/admin/sops"
          className="px-4 py-2 rounded-xl font-commons text-sm text-neutral-600 hover:bg-neutral-100"
        >
          Vazgeç
        </Link>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#171717] text-white font-commons text-sm font-medium hover:bg-neutral-800 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Kaydediliyor…' : isEdit ? 'Güncelle' : 'Kaydet'}
        </button>
      </div>
    </div>
  );
};

export default SopFormPage;
