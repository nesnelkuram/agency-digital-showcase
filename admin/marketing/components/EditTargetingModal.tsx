import React, { useState } from 'react';
import { X, Save, MapPin, Plus, Loader2 } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { AudienceTargeting, AdPlatform } from '@/shared/types/marketing';

interface EditTargetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaignId: string;
  currentTargeting: Partial<AudienceTargeting>;
  platforms: AdPlatform[];
  onSaved: () => void;
}

const GENDER_OPTIONS: { value: 'male' | 'female' | 'all'; label: string }[] = [
  { value: 'all', label: 'Tumu' },
  { value: 'male', label: 'Erkek' },
  { value: 'female', label: 'Kadin' },
];

const EditTargetingModal: React.FC<EditTargetingModalProps> = ({
  isOpen,
  onClose,
  campaignId,
  currentTargeting,
  platforms,
  onSaved,
}) => {
  const [ageMin, setAgeMin] = useState<number>(currentTargeting.ageRange?.min ?? 18);
  const [ageMax, setAgeMax] = useState<number>(currentTargeting.ageRange?.max ?? 65);
  const [genders, setGenders] = useState<('male' | 'female' | 'all')[]>(
    currentTargeting.genders ?? ['all']
  );
  const [locations, setLocations] = useState<AudienceTargeting['locations']>(
    currentTargeting.locations ?? []
  );
  const [locationInput, setLocationInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenderToggle = (gender: 'male' | 'female' | 'all') => {
    setGenders((prev) => {
      if (prev.includes(gender)) {
        const next = prev.filter((g) => g !== gender);
        return next.length === 0 ? ['all'] : next;
      }
      return [...prev, gender];
    });
  };

  const handleAddLocation = () => {
    const trimmed = locationInput.trim();
    if (!trimmed) return;
    if (locations.some((l) => l.name === trimmed)) return;
    setLocations((prev) => [...prev, { type: 'city', name: trimmed }]);
    setLocationInput('');
  };

  const handleRemoveLocation = (name: string) => {
    setLocations((prev) => prev.filter((l) => l.name !== name));
  };

  const handleSave = async () => {
    if (ageMin > ageMax) {
      setError('Minimum yas, maksimum yastan buyuk olamaz.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const campaignRef = doc(db!, 'campaigns', campaignId);
      await updateDoc(campaignRef, {
        'targeting.ageRange': { min: ageMin, max: ageMax },
        'targeting.genders': genders,
        'targeting.locations': locations,
      });
      onSaved();
      onClose();
    } catch (err) {
      console.error('Hedefleme guncellenirken hata olustu:', err);
      setError('Kaydedilirken bir hata olustu. Lutfen tekrar deneyin.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl p-6 w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-commons font-bold text-[#171717]">
            Hedeflemeyi Duzenle
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>

        {/* Form */}
        <div className="space-y-5">
          {/* Age Range */}
          <div>
            <label className="block text-sm font-commons font-semibold text-neutral-700 mb-2">
              Yas Araligi
            </label>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="block text-xs font-commons text-neutral-500 mb-1">
                  Minimum
                </label>
                <input
                  type="number"
                  min={13}
                  max={65}
                  value={ageMin}
                  onChange={(e) => setAgeMin(Number(e.target.value))}
                  className="w-full border border-neutral-200 rounded-lg px-3 py-2 font-commons text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                />
              </div>
              <span className="text-neutral-400 mt-5">-</span>
              <div className="flex-1">
                <label className="block text-xs font-commons text-neutral-500 mb-1">
                  Maksimum
                </label>
                <input
                  type="number"
                  min={13}
                  max={65}
                  value={ageMax}
                  onChange={(e) => setAgeMax(Number(e.target.value))}
                  className="w-full border border-neutral-200 rounded-lg px-3 py-2 font-commons text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                />
              </div>
            </div>
          </div>

          {/* Genders */}
          <div>
            <label className="block text-sm font-commons font-semibold text-neutral-700 mb-2">
              Cinsiyet
            </label>
            <div className="flex flex-wrap gap-2">
              {GENDER_OPTIONS.map((opt) => {
                const isChecked = genders.includes(opt.value);
                return (
                  <label
                    key={opt.value}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors font-commons text-sm ${
                      isChecked
                        ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                        : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleGenderToggle(opt.value)}
                      className="sr-only"
                    />
                    {opt.label}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Locations */}
          <div>
            <label className="block text-sm font-commons font-semibold text-neutral-700 mb-2">
              Konumlar
            </label>
            <div className="flex gap-2 mb-2">
              <div className="relative flex-1">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type="text"
                  value={locationInput}
                  onChange={(e) => setLocationInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddLocation();
                    }
                  }}
                  placeholder="Sehir veya bolge ekle..."
                  className="w-full border border-neutral-200 rounded-lg pl-9 pr-3 py-2 font-commons text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                />
              </div>
              <button
                type="button"
                onClick={handleAddLocation}
                className="flex items-center gap-1 px-3 py-2 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors font-commons text-sm text-neutral-700"
              >
                <Plus className="w-4 h-4" />
                Ekle
              </button>
            </div>
            {locations.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {locations.map((loc) => (
                  <span
                    key={loc.name}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-commons"
                  >
                    {loc.name}
                    <button
                      type="button"
                      onClick={() => handleRemoveLocation(loc.name)}
                      className="hover:text-indigo-900 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Platforms info */}
          {platforms.length > 0 && (
            <div>
              <label className="block text-xs font-commons text-neutral-500 mb-1">
                Platformlar
              </label>
              <div className="flex flex-wrap gap-1">
                {platforms.map((p) => (
                  <span
                    key={p}
                    className="px-2 py-0.5 rounded text-xs font-commons bg-neutral-100 text-neutral-600"
                  >
                    {p}
                  </span>
                ))}
              </div>
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

export default EditTargetingModal;
