import React, { useState } from 'react';
import {
  Sparkles,
  Copy,
  Save,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Target,
  MessageSquare,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useProjectScope } from '@/shared/hooks/useProjectScope';
import { createCreative } from '@/shared/services/creativeService';
import { PLATFORM_LABELS, OBJECTIVE_LABELS } from '@/shared/types/marketing';
import type { AdPlatform, CampaignObjective } from '@/shared/types/marketing';

// ============================================
// TIPLER
// ============================================

type AdTone = 'professional' | 'casual' | 'urgent' | 'creative' | 'informative';

interface AdVariant {
  id: string;
  headline: string;
  primaryText: string;
  description: string;
  callToAction: string;
  tone: string;
  platformNotes: string;
}

interface GenerateResponse {
  success: boolean;
  variants: AdVariant[];
  strategy: string;
  platformTips: string[];
}

interface FormState {
  platform: AdPlatform | '';
  objective: CampaignObjective | '';
  tone: AdTone | '';
  productDescription: string;
  brandName: string;
  targetAudience: string;
  keywords: string;
  existingCopy: string;
}

// ============================================
// SABITLER
// ============================================

const TONE_LABELS: Record<AdTone, string> = {
  professional: 'Profesyonel',
  casual: 'Samimi',
  urgent: 'Acil',
  creative: 'Yaratici',
  informative: 'Bilgilendirici',
};

const PLATFORM_OPTIONS: { value: AdPlatform; label: string; icon: string }[] = [
  { value: 'meta', label: 'Meta', icon: 'M' },
  { value: 'google', label: 'Google', icon: 'G' },
  { value: 'tiktok', label: 'TikTok', icon: 'T' },
  { value: 'linkedin', label: 'LinkedIn', icon: 'in' },
];

const OBJECTIVE_OPTIONS: { value: CampaignObjective; label: string }[] = [
  { value: 'awareness', label: OBJECTIVE_LABELS.awareness },
  { value: 'traffic', label: OBJECTIVE_LABELS.traffic },
  { value: 'engagement', label: OBJECTIVE_LABELS.engagement },
  { value: 'leads', label: OBJECTIVE_LABELS.leads },
  { value: 'sales', label: OBJECTIVE_LABELS.sales },
];

const TONE_OPTIONS: { value: AdTone; label: string }[] = [
  { value: 'professional', label: TONE_LABELS.professional },
  { value: 'casual', label: TONE_LABELS.casual },
  { value: 'urgent', label: TONE_LABELS.urgent },
  { value: 'creative', label: TONE_LABELS.creative },
  { value: 'informative', label: TONE_LABELS.informative },
];

const INITIAL_FORM: FormState = {
  platform: '',
  objective: '',
  tone: '',
  productDescription: '',
  brandName: '',
  targetAudience: '',
  keywords: '',
  existingCopy: '',
};

// ============================================
// SAYFA BILESENI
// ============================================

const AICopyGeneratorPage: React.FC = () => {
  const { user } = useAuth();
  const { projectId } = useProjectScope();

  // Form state
  const [form, setForm] = useState<FormState>(INITIAL_FORM);

  // Sonuc state
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [tipsOpen, setTipsOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  // ============================================
  // FORM HANDLER'LARI
  // ============================================

  const handleChange = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const isFormValid =
    form.platform !== '' &&
    form.objective !== '' &&
    form.tone !== '' &&
    form.productDescription.trim().length > 0;

  // ============================================
  // AI OLUSTURMA
  // ============================================

  const handleGenerate = async () => {
    if (!isFormValid) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setCopiedId(null);
    setSavedIds(new Set());

    try {
      const keywordsArray = form.keywords
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);

      const body: Record<string, unknown> = {
        productDescription: form.productDescription.trim(),
        platform: form.platform,
        objective: form.objective,
        tone: form.tone,
      };

      if (form.targetAudience.trim()) {
        body.targetAudience = form.targetAudience.trim();
      }
      if (keywordsArray.length > 0) {
        body.keywords = keywordsArray;
      }
      if (form.brandName.trim()) {
        body.brandName = form.brandName.trim();
      }
      if (form.existingCopy.trim()) {
        body.existingCopy = form.existingCopy.trim();
      }

      const res = await fetch('/api/marketing/generate-ad-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data: GenerateResponse = await res.json();

      if (!res.ok || !data.success) {
        throw new Error('Metin olusturma basarisiz oldu. Lutfen tekrar deneyin.');
      }

      setResult(data);
    } catch (err: any) {
      console.error('[AICopyGenerator] Hata:', err);
      setError(err.message || 'Beklenmeyen bir hata olustu.');
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // KOPYALA
  // ============================================

  const handleCopy = async (variant: AdVariant) => {
    const text = [variant.headline, variant.primaryText, variant.description]
      .filter(Boolean)
      .join('\n\n');

    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(variant.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('[AICopyGenerator] Kopyalama hatasi:', err);
    }
  };

  // ============================================
  // KUTUPANEYE KAYDET
  // ============================================

  const handleSaveToLibrary = async (variant: AdVariant) => {
    if (!user || !form.platform) return;

    setSavingId(variant.id);
    try {
      await createCreative({
        projectId: projectId || undefined,
        name: variant.headline || 'AI Reklam Metni',
        type: 'text',
        status: 'draft',
        headline: variant.headline,
        primaryText: variant.primaryText,
        description: variant.description,
        callToAction: variant.callToAction,
        platforms: [form.platform as AdPlatform],
        tags: ['ai-generated', form.tone || 'professional'],
        campaignIds: [],
        createdBy: user.uid,
        createdByName: user.displayName || user.email || 'Bilinmeyen',
      });

      setSavedIds((prev) => new Set(prev).add(variant.id));
    } catch (err) {
      console.error('[AICopyGenerator] Kaydetme hatasi:', err);
    } finally {
      setSavingId(null);
    }
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-commons font-bold text-[#171717]">
          AI Reklam Metin Ureticisi
        </h1>
        <p className="text-sm font-commons text-neutral-500 mt-1">
          Yapay zeka ile platform uyumlu reklam metinleri olusturun
        </p>
      </div>

      {/* Ana Icerik: Sol Panel (Form) + Sag Panel (Sonuclar) */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* ============================================ */}
        {/* SOL PANEL - FORM (~40%) */}
        {/* ============================================ */}
        <div className="w-full lg:w-[40%] space-y-5">
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            {/* Platform Secimi */}
            <div className="mb-5">
              <label className="block text-sm font-commons font-medium text-[#171717] mb-2">
                Platform <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                {PLATFORM_OPTIONS.map((opt) => {
                  const isActive = form.platform === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleChange('platform', opt.value)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left ${
                        isActive
                          ? 'border-indigo-600 bg-indigo-50/50'
                          : 'border-neutral-200 bg-white hover:border-neutral-300'
                      }`}
                    >
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center font-commons font-bold text-sm ${
                          isActive
                            ? 'bg-indigo-600 text-white'
                            : 'bg-neutral-100 text-neutral-500'
                        }`}
                      >
                        {opt.icon}
                      </div>
                      <div>
                        <p
                          className={`font-commons text-sm font-semibold ${
                            isActive ? 'text-indigo-700' : 'text-[#171717]'
                          }`}
                        >
                          {opt.label}
                        </p>
                        <p className="font-commons text-xs text-neutral-400">
                          {PLATFORM_LABELS[opt.value]}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Hedef ve Ton - 2 sutunlu grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              {/* Hedef */}
              <div>
                <label className="block text-sm font-commons font-medium text-[#171717] mb-1.5">
                  Hedef <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.objective}
                  onChange={(e) =>
                    handleChange('objective', e.target.value as CampaignObjective | '')
                  }
                  className="w-full px-4 py-2.5 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/20 transition-colors"
                >
                  <option value="">Hedef secin...</option>
                  {OBJECTIVE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Ton */}
              <div>
                <label className="block text-sm font-commons font-medium text-[#171717] mb-1.5">
                  Ton <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.tone}
                  onChange={(e) =>
                    handleChange('tone', e.target.value as AdTone | '')
                  }
                  className="w-full px-4 py-2.5 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/20 transition-colors"
                >
                  <option value="">Ton secin...</option>
                  {TONE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Urun/Hizmet Aciklamasi */}
            <div className="mb-5">
              <label className="block text-sm font-commons font-medium text-[#171717] mb-1.5">
                Urun / Hizmet Aciklamasi <span className="text-red-500">*</span>
              </label>
              <textarea
                value={form.productDescription}
                onChange={(e) => handleChange('productDescription', e.target.value)}
                rows={3}
                placeholder="Reklamini olusturmak istediginiz urun veya hizmeti detayli bicimde aciklayin..."
                className="w-full px-4 py-2.5 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/20 transition-colors resize-none"
              />
            </div>

            {/* Marka Adi */}
            <div className="mb-5">
              <label className="block text-sm font-commons font-medium text-neutral-600 mb-1.5">
                Marka Adi{' '}
                <span className="text-xs text-neutral-400">(opsiyonel)</span>
              </label>
              <input
                type="text"
                value={form.brandName}
                onChange={(e) => handleChange('brandName', e.target.value)}
                placeholder="Marka veya isletme adi"
                className="w-full px-4 py-2.5 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/20 transition-colors"
              />
            </div>

            {/* Hedef Kitle */}
            <div className="mb-5">
              <label className="block text-sm font-commons font-medium text-neutral-600 mb-1.5">
                Hedef Kitle{' '}
                <span className="text-xs text-neutral-400">(opsiyonel)</span>
              </label>
              <input
                type="text"
                value={form.targetAudience}
                onChange={(e) => handleChange('targetAudience', e.target.value)}
                placeholder="25-35 yas, Istanbul, teknoloji ilgililer"
                className="w-full px-4 py-2.5 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/20 transition-colors"
              />
            </div>

            {/* Anahtar Kelimeler */}
            <div className="mb-6">
              <label className="block text-sm font-commons font-medium text-neutral-600 mb-1.5">
                Anahtar Kelimeler{' '}
                <span className="text-xs text-neutral-400">(opsiyonel)</span>
              </label>
              <input
                type="text"
                value={form.keywords}
                onChange={(e) => handleChange('keywords', e.target.value)}
                placeholder="Virgul ile ayirin"
                className="w-full px-4 py-2.5 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/20 transition-colors"
              />
            </div>

            {/* Olustur Butonu */}
            <button
              onClick={handleGenerate}
              disabled={!isFormValid || loading}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-commons text-sm font-medium"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Metinler olusturuluyor...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  AI ile Olustur
                </>
              )}
            </button>

            {/* Hata Mesaji */}
            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="font-commons text-sm text-red-700">{error}</p>
              </div>
            )}
          </div>
        </div>

        {/* ============================================ */}
        {/* SAG PANEL - SONUCLAR (~60%) */}
        {/* ============================================ */}
        <div className="w-full lg:w-[60%] space-y-5">
          {/* Bos durum */}
          {!result && !loading && (
            <div className="bg-white rounded-xl border border-neutral-200 p-12 text-center">
              <MessageSquare className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
              <h3 className="text-lg font-commons font-semibold text-[#171717] mb-2">
                Reklam Metinleriniz Burada Gorunecek
              </h3>
              <p className="text-sm font-commons text-neutral-500 max-w-sm mx-auto">
                Sol taraftaki formu doldurun ve AI ile platform uyumlu reklam metinleri olusturun.
              </p>
            </div>
          )}

          {/* Yukleniyor durumu */}
          {loading && (
            <div className="bg-white rounded-xl border border-neutral-200 p-12 text-center">
              <div className="w-12 h-12 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <h3 className="text-lg font-commons font-semibold text-[#171717] mb-2">
                Metinler olusturuluyor...
              </h3>
              <p className="text-sm font-commons text-neutral-500">
                AI, platform kurallarini ve hedef kitlenizi dikkate alarak metin varyantlari uretiyor.
              </p>
            </div>
          )}

          {/* Sonuclar */}
          {result && !loading && (
            <>
              {/* Strateji Karti */}
              <div className="bg-white rounded-xl border border-neutral-200 p-6">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
                    <Lightbulb className="w-4 h-4 text-amber-600" />
                  </div>
                  <h2 className="text-lg font-commons font-semibold text-[#171717]">
                    Strateji
                  </h2>
                </div>
                <p className="font-commons text-sm text-neutral-600 leading-relaxed">
                  {result.strategy}
                </p>
              </div>

              {/* Platform Ipuclari */}
              {result.platformTips && result.platformTips.length > 0 && (
                <div className="bg-white rounded-xl border border-neutral-200">
                  <button
                    type="button"
                    onClick={() => setTipsOpen(!tipsOpen)}
                    className="w-full flex items-center justify-between p-5 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
                        <Target className="w-4 h-4 text-indigo-600" />
                      </div>
                      <h2 className="text-base font-commons font-semibold text-[#171717]">
                        Platform Ipuclari
                      </h2>
                      <span className="ml-1 text-xs font-commons text-neutral-400">
                        ({result.platformTips.length} ipucu)
                      </span>
                    </div>
                    {tipsOpen ? (
                      <ChevronUp className="w-5 h-5 text-neutral-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-neutral-400" />
                    )}
                  </button>

                  {tipsOpen && (
                    <div className="px-5 pb-5 pt-0">
                      <ul className="space-y-2">
                        {result.platformTips.map((tip, idx) => (
                          <li
                            key={idx}
                            className="flex items-start gap-2 font-commons text-sm text-neutral-600"
                          >
                            <span className="mt-1.5 w-1.5 h-1.5 bg-indigo-400 rounded-full flex-shrink-0" />
                            {tip}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Varyantlar Grid */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-commons font-semibold text-[#171717]">
                    Metin Varyantlari
                  </h2>
                  <span className="text-xs font-commons text-neutral-400">
                    {result.variants.length} varyant
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {result.variants.map((variant) => {
                    const isCopied = copiedId === variant.id;
                    const isSaving = savingId === variant.id;
                    const isSaved = savedIds.has(variant.id);

                    return (
                      <div
                        key={variant.id}
                        className="bg-white rounded-xl border border-neutral-200 p-5 flex flex-col"
                      >
                        {/* Baslik */}
                        <h3 className="font-commons font-bold text-[#171717] text-sm leading-snug mb-2">
                          {variant.headline}
                        </h3>

                        {/* Ana Metin */}
                        <p className="font-commons text-sm text-neutral-600 leading-relaxed mb-3 flex-1">
                          {variant.primaryText}
                        </p>

                        {/* Aciklama */}
                        {variant.description && (
                          <p className="font-commons text-xs text-neutral-500 mb-3 italic">
                            {variant.description}
                          </p>
                        )}

                        {/* Badge'ler */}
                        <div className="flex items-center flex-wrap gap-2 mb-4">
                          <span className="inline-flex items-center px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full font-commons text-xs font-medium">
                            {variant.callToAction}
                          </span>
                          <span className="inline-flex items-center px-2.5 py-1 bg-neutral-100 text-neutral-600 rounded-full font-commons text-xs font-medium">
                            {TONE_LABELS[variant.tone as AdTone] || variant.tone}
                          </span>
                        </div>

                        {/* Aksiyonlar */}
                        <div className="flex items-center gap-2 pt-3 border-t border-neutral-100">
                          <button
                            onClick={() => handleCopy(variant)}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 transition-colors font-commons text-xs font-medium text-neutral-600"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            {isCopied ? (
                              <span className="text-emerald-600">Kopyalandi!</span>
                            ) : (
                              'Kopyala'
                            )}
                          </button>

                          <button
                            onClick={() => handleSaveToLibrary(variant)}
                            disabled={isSaving || isSaved}
                            className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border transition-colors font-commons text-xs font-medium ${
                              isSaved
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 cursor-default'
                                : 'border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-600'
                            } disabled:opacity-60 disabled:cursor-not-allowed`}
                          >
                            {isSaving ? (
                              <>
                                <div className="w-3.5 h-3.5 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin" />
                                Kaydediliyor...
                              </>
                            ) : isSaved ? (
                              <>
                                <Save className="w-3.5 h-3.5" />
                                Kaydedildi
                              </>
                            ) : (
                              <>
                                <Save className="w-3.5 h-3.5" />
                                Kutupaneye Kaydet
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AICopyGeneratorPage;
