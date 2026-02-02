import React, { useState } from 'react';
import { AdPlatform, PLATFORM_LABELS, PLATFORM_COLORS } from '@/shared/types/marketing';
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react';

interface AdSet {
  id: string;
  name: string;
  platform: AdPlatform;
  bidStrategy: string;
  budgetDaily: number;
}

interface AdSetsStepProps {
  adSets: AdSet[];
  platforms: AdPlatform[];
  onChange: (adSets: AdSet[]) => void;
  isAIFilled?: boolean;
}

const BID_STRATEGIES = [
  { value: 'lowest_cost', label: 'En Düşük Maliyet' },
  { value: 'cost_cap', label: 'Maliyet Sınırı' },
  { value: 'bid_cap', label: 'Teklif Sınırı' },
  { value: 'target_cost', label: 'Hedef Maliyet' },
];

export default function AdSetsStep({
  adSets,
  platforms,
  onChange,
  isAIFilled
}: AdSetsStepProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<AdSet>>({
    name: '',
    platform: platforms[0],
    bidStrategy: 'lowest_cost',
    budgetDaily: 0,
  });

  const handleAdd = () => {
    if (!formData.name || !formData.platform || !formData.bidStrategy || !formData.budgetDaily) {
      return;
    }

    const newAdSet: AdSet = {
      id: `adset-${Date.now()}`,
      name: formData.name,
      platform: formData.platform as AdPlatform,
      bidStrategy: formData.bidStrategy,
      budgetDaily: formData.budgetDaily,
    };

    onChange([...adSets, newAdSet]);
    setFormData({
      name: '',
      platform: platforms[0],
      bidStrategy: 'lowest_cost',
      budgetDaily: 0,
    });
    setIsAdding(false);
  };

  const handleUpdate = () => {
    if (!editingId || !formData.name || !formData.platform || !formData.bidStrategy || !formData.budgetDaily) {
      return;
    }

    const updatedAdSets = adSets.map((adSet) =>
      adSet.id === editingId
        ? {
            ...adSet,
            name: formData.name as string,
            platform: formData.platform as AdPlatform,
            bidStrategy: formData.bidStrategy as string,
            budgetDaily: formData.budgetDaily as number,
          }
        : adSet
    );

    onChange(updatedAdSets);
    setEditingId(null);
    setFormData({
      name: '',
      platform: platforms[0],
      bidStrategy: 'lowest_cost',
      budgetDaily: 0,
    });
  };

  const handleEdit = (adSet: AdSet) => {
    setEditingId(adSet.id);
    setFormData(adSet);
    setIsAdding(false);
  };

  const handleDelete = (id: string) => {
    onChange(adSets.filter((adSet) => adSet.id !== id));
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({
      name: '',
      platform: platforms[0],
      bidStrategy: 'lowest_cost',
      budgetDaily: 0,
    });
  };

  const getBidStrategyLabel = (value: string) => {
    return BID_STRATEGIES.find(s => s.value === value)?.label || value;
  };

  return (
    <div className="space-y-4">
      {isAIFilled && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm font-commons text-blue-800">
            AI tarafından önerilen reklam setleri. Düzenleyebilir veya yenilerini ekleyebilirsiniz.
          </p>
        </div>
      )}

      {/* Ad Sets List */}
      {adSets.length === 0 && !isAdding && (
        <div className="bg-white rounded-xl border border-neutral-200/50 p-12 text-center">
          <p className="text-sm font-commons text-neutral-500 mb-4">
            Henüz reklam seti eklenmedi
          </p>
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-commons text-sm px-4 py-2 inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            İlk Reklam Setini Ekle
          </button>
        </div>
      )}

      {adSets.length > 0 && (
        <div className="space-y-3">
          {adSets.map((adSet) => (
            <div key={adSet.id}>
              {editingId === adSet.id ? (
                <div className="bg-white rounded-xl border border-indigo-300 p-4 space-y-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-commons font-semibold text-[#171717]">
                      Reklam Setini Düzenle
                    </h4>
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="text-neutral-400 hover:text-neutral-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-commons font-medium text-[#171717] mb-1 block">
                        Reklam Seti Adı
                      </label>
                      <input
                        type="text"
                        value={formData.name || ''}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full border border-neutral-200 rounded-lg px-3 py-2 font-commons text-sm focus:outline-none focus:border-indigo-400"
                        placeholder="Örn: Hedef Kitle 18-24"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-commons font-medium text-[#171717] mb-1 block">
                        Platform
                      </label>
                      <select
                        value={formData.platform || platforms[0]}
                        onChange={(e) => setFormData({ ...formData, platform: e.target.value as AdPlatform })}
                        className="w-full border border-neutral-200 rounded-lg px-3 py-2 font-commons text-sm focus:outline-none focus:border-indigo-400 bg-white"
                      >
                        {platforms.map((platform) => (
                          <option key={platform} value={platform}>
                            {PLATFORM_LABELS[platform]}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-sm font-commons font-medium text-[#171717] mb-1 block">
                        Teklif Stratejisi
                      </label>
                      <select
                        value={formData.bidStrategy || 'lowest_cost'}
                        onChange={(e) => setFormData({ ...formData, bidStrategy: e.target.value })}
                        className="w-full border border-neutral-200 rounded-lg px-3 py-2 font-commons text-sm focus:outline-none focus:border-indigo-400 bg-white"
                      >
                        {BID_STRATEGIES.map((strategy) => (
                          <option key={strategy.value} value={strategy.value}>
                            {strategy.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-sm font-commons font-medium text-[#171717] mb-1 block">
                        Günlük Bütçe
                      </label>
                      <input
                        type="number"
                        value={formData.budgetDaily || ''}
                        onChange={(e) => setFormData({ ...formData, budgetDaily: parseFloat(e.target.value) || 0 })}
                        className="w-full border border-neutral-200 rounded-lg px-3 py-2 font-commons text-sm focus:outline-none focus:border-indigo-400"
                        placeholder="0"
                        min="0"
                        step="10"
                      />
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
                      onClick={handleUpdate}
                      className="bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-commons text-sm px-4 py-2 inline-flex items-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      Kaydet
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-neutral-200/50 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div>
                      <h4 className="text-sm font-commons font-semibold text-[#171717] mb-1">
                        {adSet.name}
                      </h4>
                      <div className="flex items-center gap-3 text-xs font-commons text-neutral-500">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PLATFORM_COLORS[adSet.platform]}`}>
                          {PLATFORM_LABELS[adSet.platform]}
                        </span>
                        <span>{getBidStrategyLabel(adSet.bidStrategy)}</span>
                        <span className="font-medium text-neutral-700">
                          {adSet.budgetDaily} TRY/gün
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleEdit(adSet)}
                      className="text-neutral-400 hover:text-indigo-600 p-2"
                      title="Düzenle"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(adSet.id)}
                      className="text-neutral-400 hover:text-red-600 p-2"
                      title="Sil"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add New Ad Set Form */}
      {isAdding && (
        <div className="bg-white rounded-xl border border-indigo-300 p-4 space-y-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-commons font-semibold text-[#171717]">
              Yeni Reklam Seti
            </h4>
            <button
              type="button"
              onClick={handleCancel}
              className="text-neutral-400 hover:text-neutral-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-commons font-medium text-[#171717] mb-1 block">
                Reklam Seti Adı
              </label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full border border-neutral-200 rounded-lg px-3 py-2 font-commons text-sm focus:outline-none focus:border-indigo-400"
                placeholder="Örn: Hedef Kitle 18-24"
              />
            </div>

            <div>
              <label className="text-sm font-commons font-medium text-[#171717] mb-1 block">
                Platform
              </label>
              <select
                value={formData.platform || platforms[0]}
                onChange={(e) => setFormData({ ...formData, platform: e.target.value as AdPlatform })}
                className="w-full border border-neutral-200 rounded-lg px-3 py-2 font-commons text-sm focus:outline-none focus:border-indigo-400 bg-white"
              >
                {platforms.map((platform) => (
                  <option key={platform} value={platform}>
                    {PLATFORM_LABELS[platform]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-commons font-medium text-[#171717] mb-1 block">
                Teklif Stratejisi
              </label>
              <select
                value={formData.bidStrategy || 'lowest_cost'}
                onChange={(e) => setFormData({ ...formData, bidStrategy: e.target.value })}
                className="w-full border border-neutral-200 rounded-lg px-3 py-2 font-commons text-sm focus:outline-none focus:border-indigo-400 bg-white"
              >
                {BID_STRATEGIES.map((strategy) => (
                  <option key={strategy.value} value={strategy.value}>
                    {strategy.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-commons font-medium text-[#171717] mb-1 block">
                Günlük Bütçe
              </label>
              <input
                type="number"
                value={formData.budgetDaily || ''}
                onChange={(e) => setFormData({ ...formData, budgetDaily: parseFloat(e.target.value) || 0 })}
                className="w-full border border-neutral-200 rounded-lg px-3 py-2 font-commons text-sm focus:outline-none focus:border-indigo-400"
                placeholder="0"
                min="0"
                step="10"
              />
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
              onClick={handleAdd}
              className="bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-commons text-sm px-4 py-2 inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Ekle
            </button>
          </div>
        </div>
      )}

      {/* Add Button */}
      {!isAdding && adSets.length > 0 && !editingId && (
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="w-full bg-white border border-neutral-200 text-neutral-700 rounded-lg hover:bg-neutral-50 font-commons text-sm px-4 py-3 inline-flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Reklam Seti Ekle
        </button>
      )}
    </div>
  );
}
