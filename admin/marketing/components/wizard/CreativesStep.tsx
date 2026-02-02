import React, { useState } from 'react';
import { AdPlatform, PLATFORM_LABELS, PLATFORM_COLORS } from '@/shared/types/marketing';
import { Plus, Pencil, Trash2, X, Check, Sparkles } from 'lucide-react';

interface Ad {
  id: string;
  headline: string;
  primaryText: string;
  description: string;
  cta: string;
  destinationUrl: string;
  variant?: string;
  isAIGenerated?: boolean;
}

interface AdSetWithAds {
  id: string;
  name: string;
  platform: AdPlatform;
  ads: Ad[];
}

interface CreativesStepProps {
  adSets: AdSetWithAds[];
  onChange: (adSets: AdSetWithAds[]) => void;
  isAIFilled?: boolean;
}

const CTA_OPTIONS = [
  { value: 'buy_now', label: 'Şimdi Al' },
  { value: 'learn_more', label: 'Daha Fazla' },
  { value: 'sign_up', label: 'Kayıt Ol' },
  { value: 'download', label: 'İndir' },
  { value: 'contact_us', label: 'İletişime Geç' },
];

const VARIANTS = ['A', 'B', 'C', 'D', 'E'];

export default function CreativesStep({
  adSets,
  onChange,
  isAIFilled
}: CreativesStepProps) {
  const [addingToAdSetId, setAddingToAdSetId] = useState<string | null>(null);
  const [editingAdId, setEditingAdId] = useState<string | null>(null);
  const [editingAdSetId, setEditingAdSetId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Ad>>({
    headline: '',
    primaryText: '',
    description: '',
    cta: 'learn_more',
    destinationUrl: '',
    variant: 'A',
  });

  const handleAdd = (adSetId: string) => {
    if (!formData.headline || !formData.primaryText || !formData.cta || !formData.destinationUrl) {
      return;
    }

    const newAd: Ad = {
      id: `ad-${Date.now()}`,
      headline: formData.headline,
      primaryText: formData.primaryText,
      description: formData.description || '',
      cta: formData.cta,
      destinationUrl: formData.destinationUrl,
      variant: formData.variant,
    };

    const updatedAdSets = adSets.map((adSet) =>
      adSet.id === adSetId
        ? { ...adSet, ads: [...adSet.ads, newAd] }
        : adSet
    );

    onChange(updatedAdSets);
    setFormData({
      headline: '',
      primaryText: '',
      description: '',
      cta: 'learn_more',
      destinationUrl: '',
      variant: 'A',
    });
    setAddingToAdSetId(null);
  };

  const handleUpdate = (adSetId: string, adId: string) => {
    if (!formData.headline || !formData.primaryText || !formData.cta || !formData.destinationUrl) {
      return;
    }

    const updatedAdSets = adSets.map((adSet) =>
      adSet.id === adSetId
        ? {
            ...adSet,
            ads: adSet.ads.map((ad) =>
              ad.id === adId
                ? {
                    ...ad,
                    headline: formData.headline as string,
                    primaryText: formData.primaryText as string,
                    description: formData.description || '',
                    cta: formData.cta as string,
                    destinationUrl: formData.destinationUrl as string,
                    variant: formData.variant,
                  }
                : ad
            ),
          }
        : adSet
    );

    onChange(updatedAdSets);
    setEditingAdId(null);
    setEditingAdSetId(null);
    setFormData({
      headline: '',
      primaryText: '',
      description: '',
      cta: 'learn_more',
      destinationUrl: '',
      variant: 'A',
    });
  };

  const handleEdit = (adSetId: string, ad: Ad) => {
    setEditingAdSetId(adSetId);
    setEditingAdId(ad.id);
    setFormData(ad);
    setAddingToAdSetId(null);
  };

  const handleDelete = (adSetId: string, adId: string) => {
    const updatedAdSets = adSets.map((adSet) =>
      adSet.id === adSetId
        ? { ...adSet, ads: adSet.ads.filter((ad) => ad.id !== adId) }
        : adSet
    );
    onChange(updatedAdSets);
  };

  const handleCancel = () => {
    setAddingToAdSetId(null);
    setEditingAdId(null);
    setEditingAdSetId(null);
    setFormData({
      headline: '',
      primaryText: '',
      description: '',
      cta: 'learn_more',
      destinationUrl: '',
      variant: 'A',
    });
  };

  const getCTALabel = (value: string) => {
    return CTA_OPTIONS.find(c => c.value === value)?.label || value;
  };

  return (
    <div className="space-y-6">
      {isAIFilled && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm font-commons text-blue-800">
            AI tarafından önerilen reklam içerikleri. Düzenleyebilir veya yenilerini ekleyebilirsiniz.
          </p>
        </div>
      )}

      {adSets.map((adSet) => (
        <div key={adSet.id} className="bg-white rounded-xl border border-neutral-200/50 p-6 space-y-4">
          {/* Ad Set Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-commons font-semibold text-[#171717] mb-1">
                {adSet.name}
              </h3>
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${PLATFORM_COLORS[adSet.platform]}`}>
                {PLATFORM_LABELS[adSet.platform]}
              </span>
            </div>
            <span className="text-sm font-commons text-neutral-500">
              {adSet.ads.length} reklam
            </span>
          </div>

          {/* Ads List */}
          {adSet.ads.length === 0 && addingToAdSetId !== adSet.id && (
            <div className="bg-neutral-50 rounded-lg p-6 text-center">
              <p className="text-sm font-commons text-neutral-500 mb-3">
                Bu reklam seti için henüz reklam eklenmedi
              </p>
              <button
                type="button"
                onClick={() => setAddingToAdSetId(adSet.id)}
                className="bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-commons text-sm px-4 py-2 inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Reklam Ekle
              </button>
            </div>
          )}

          {adSet.ads.length > 0 && (
            <div className="space-y-3">
              {adSet.ads.map((ad) => (
                <div key={ad.id}>
                  {editingAdId === ad.id && editingAdSetId === adSet.id ? (
                    <div className="bg-neutral-50 rounded-lg border border-indigo-300 p-4 space-y-3">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-commons font-semibold text-[#171717]">
                          Reklamı Düzenle
                        </h4>
                        <button
                          type="button"
                          onClick={handleCancel}
                          className="text-neutral-400 hover:text-neutral-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 gap-3">
                        <div className="grid grid-cols-3 gap-3">
                          <div className="col-span-2">
                            <label className="text-sm font-commons font-medium text-[#171717] mb-1 block">
                              Başlık
                            </label>
                            <input
                              type="text"
                              value={formData.headline || ''}
                              onChange={(e) => setFormData({ ...formData, headline: e.target.value })}
                              className="w-full border border-neutral-200 rounded-lg px-3 py-2 font-commons text-sm focus:outline-none focus:border-indigo-400"
                              placeholder="Reklamın başlığı"
                            />
                          </div>
                          <div>
                            <label className="text-sm font-commons font-medium text-[#171717] mb-1 block">
                              Varyant
                            </label>
                            <select
                              value={formData.variant || 'A'}
                              onChange={(e) => setFormData({ ...formData, variant: e.target.value })}
                              className="w-full border border-neutral-200 rounded-lg px-3 py-2 font-commons text-sm focus:outline-none focus:border-indigo-400 bg-white"
                            >
                              {VARIANTS.map((v) => (
                                <option key={v} value={v}>Varyant {v}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="text-sm font-commons font-medium text-[#171717] mb-1 block">
                            Ana Metin
                          </label>
                          <textarea
                            value={formData.primaryText || ''}
                            onChange={(e) => setFormData({ ...formData, primaryText: e.target.value })}
                            className="w-full border border-neutral-200 rounded-lg px-3 py-2 font-commons text-sm focus:outline-none focus:border-indigo-400"
                            placeholder="Reklamın ana metni"
                            rows={3}
                          />
                        </div>

                        <div>
                          <label className="text-sm font-commons font-medium text-[#171717] mb-1 block">
                            Açıklama <span className="text-neutral-400 font-normal">(opsiyonel)</span>
                          </label>
                          <textarea
                            value={formData.description || ''}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="w-full border border-neutral-200 rounded-lg px-3 py-2 font-commons text-sm focus:outline-none focus:border-indigo-400"
                            placeholder="Ek açıklama"
                            rows={2}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-sm font-commons font-medium text-[#171717] mb-1 block">
                              CTA (Eylem Çağrısı)
                            </label>
                            <select
                              value={formData.cta || 'learn_more'}
                              onChange={(e) => setFormData({ ...formData, cta: e.target.value })}
                              className="w-full border border-neutral-200 rounded-lg px-3 py-2 font-commons text-sm focus:outline-none focus:border-indigo-400 bg-white"
                            >
                              {CTA_OPTIONS.map((cta) => (
                                <option key={cta.value} value={cta.value}>
                                  {cta.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="text-sm font-commons font-medium text-[#171717] mb-1 block">
                              Hedef URL
                            </label>
                            <input
                              type="url"
                              value={formData.destinationUrl || ''}
                              onChange={(e) => setFormData({ ...formData, destinationUrl: e.target.value })}
                              className="w-full border border-neutral-200 rounded-lg px-3 py-2 font-commons text-sm focus:outline-none focus:border-indigo-400"
                              placeholder="https://..."
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 justify-end">
                        <button
                          type="button"
                          onClick={handleCancel}
                          className="bg-white border border-neutral-200 text-neutral-700 rounded-lg hover:bg-neutral-50 font-commons text-sm px-4 py-2"
                        >
                          İptal
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdate(adSet.id, ad.id)}
                          className="bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-commons text-sm px-4 py-2 inline-flex items-center gap-2"
                        >
                          <Check className="w-4 h-4" />
                          Kaydet
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-neutral-50 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="text-sm font-commons font-semibold text-[#171717]">
                              {ad.headline}
                            </h4>
                            {ad.variant && (
                              <span className="text-xs font-commons font-medium text-neutral-500 bg-white px-2 py-0.5 rounded">
                                Varyant {ad.variant}
                              </span>
                            )}
                            {ad.isAIGenerated && (
                              <span className="inline-flex items-center gap-1 text-xs font-commons font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                                <Sparkles className="w-3 h-3" />
                                AI
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-commons text-neutral-600 mb-2 line-clamp-2">
                            {ad.primaryText}
                          </p>
                          {ad.description && (
                            <p className="text-xs font-commons text-neutral-500 mb-2 line-clamp-1">
                              {ad.description}
                            </p>
                          )}
                          <div className="flex items-center gap-3 text-xs font-commons text-neutral-500">
                            <span className="font-medium text-indigo-600">
                              {getCTALabel(ad.cta)}
                            </span>
                            <span className="text-neutral-300">•</span>
                            <span className="truncate">{ad.destinationUrl}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 ml-4">
                          <button
                            type="button"
                            onClick={() => handleEdit(adSet.id, ad)}
                            className="text-neutral-400 hover:text-indigo-600 p-2"
                            title="Düzenle"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(adSet.id, ad.id)}
                            className="text-neutral-400 hover:text-red-600 p-2"
                            title="Sil"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add New Ad Form */}
          {addingToAdSetId === adSet.id && (
            <div className="bg-neutral-50 rounded-lg border border-indigo-300 p-4 space-y-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-commons font-semibold text-[#171717]">
                  Yeni Reklam
                </h4>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="text-neutral-400 hover:text-neutral-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="text-sm font-commons font-medium text-[#171717] mb-1 block">
                      Başlık
                    </label>
                    <input
                      type="text"
                      value={formData.headline || ''}
                      onChange={(e) => setFormData({ ...formData, headline: e.target.value })}
                      className="w-full border border-neutral-200 rounded-lg px-3 py-2 font-commons text-sm focus:outline-none focus:border-indigo-400"
                      placeholder="Reklamın başlığı"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-commons font-medium text-[#171717] mb-1 block">
                      Varyant
                    </label>
                    <select
                      value={formData.variant || 'A'}
                      onChange={(e) => setFormData({ ...formData, variant: e.target.value })}
                      className="w-full border border-neutral-200 rounded-lg px-3 py-2 font-commons text-sm focus:outline-none focus:border-indigo-400 bg-white"
                    >
                      {VARIANTS.map((v) => (
                        <option key={v} value={v}>Varyant {v}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-commons font-medium text-[#171717] mb-1 block">
                    Ana Metin
                  </label>
                  <textarea
                    value={formData.primaryText || ''}
                    onChange={(e) => setFormData({ ...formData, primaryText: e.target.value })}
                    className="w-full border border-neutral-200 rounded-lg px-3 py-2 font-commons text-sm focus:outline-none focus:border-indigo-400"
                    placeholder="Reklamın ana metni"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="text-sm font-commons font-medium text-[#171717] mb-1 block">
                    Açıklama <span className="text-neutral-400 font-normal">(opsiyonel)</span>
                  </label>
                  <textarea
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full border border-neutral-200 rounded-lg px-3 py-2 font-commons text-sm focus:outline-none focus:border-indigo-400"
                    placeholder="Ek açıklama"
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-commons font-medium text-[#171717] mb-1 block">
                      CTA (Eylem Çağrısı)
                    </label>
                    <select
                      value={formData.cta || 'learn_more'}
                      onChange={(e) => setFormData({ ...formData, cta: e.target.value })}
                      className="w-full border border-neutral-200 rounded-lg px-3 py-2 font-commons text-sm focus:outline-none focus:border-indigo-400 bg-white"
                    >
                      {CTA_OPTIONS.map((cta) => (
                        <option key={cta.value} value={cta.value}>
                          {cta.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-commons font-medium text-[#171717] mb-1 block">
                      Hedef URL
                    </label>
                    <input
                      type="url"
                      value={formData.destinationUrl || ''}
                      onChange={(e) => setFormData({ ...formData, destinationUrl: e.target.value })}
                      className="w-full border border-neutral-200 rounded-lg px-3 py-2 font-commons text-sm focus:outline-none focus:border-indigo-400"
                      placeholder="https://..."
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="bg-white border border-neutral-200 text-neutral-700 rounded-lg hover:bg-neutral-50 font-commons text-sm px-4 py-2"
                >
                  İptal
                </button>
                <button
                  type="button"
                  onClick={() => handleAdd(adSet.id)}
                  className="bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-commons text-sm px-4 py-2 inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Ekle
                </button>
              </div>
            </div>
          )}

          {/* Add Button */}
          {addingToAdSetId !== adSet.id && editingAdSetId !== adSet.id && adSet.ads.length > 0 && (
            <button
              type="button"
              onClick={() => setAddingToAdSetId(adSet.id)}
              className="w-full bg-white border border-dashed border-neutral-300 text-neutral-600 rounded-lg hover:bg-neutral-50 hover:border-indigo-400 hover:text-indigo-600 font-commons text-sm px-4 py-3 inline-flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Reklam Ekle
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
