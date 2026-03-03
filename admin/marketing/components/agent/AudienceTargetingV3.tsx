import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Plus, Users, MapPin, Heart, Target } from 'lucide-react';
import type { AudienceTargetingV3Data, FunnelStage } from '@/shared/types/marketing';

interface AudienceTargetingV3Props {
  data: AudienceTargetingV3Data;
  onSendMessage: (text: string) => void;
}

const STAGE_COLORS: Record<FunnelStage, { bg: string; text: string }> = {
  tofu: { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  mofu: { bg: 'bg-violet-100', text: 'text-violet-700' },
  bofu: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
};

const STAGE_LABELS: Record<FunnelStage, string> = {
  tofu: 'TOFU — Farkindalik',
  mofu: 'MOFU — Degerlendirme',
  bofu: 'BOFU — Donusum',
};

const GENDER_OPTIONS = [
  { value: 'Erkek', label: 'Erkek' },
  { value: 'Kadin', label: 'Kadin' },
  { value: 'Tumu', label: 'Tumu' },
];

const AudienceTargetingV3: React.FC<AudienceTargetingV3Props> = ({ data, onSendMessage }) => {
  const stageColors = STAGE_COLORS[data.funnelStage];

  // Age range
  const [ageMin, setAgeMin] = useState(data.suggestedAgeRange?.min ?? 18);
  const [ageMax, setAgeMax] = useState(data.suggestedAgeRange?.max ?? 65);

  // Genders
  const [selectedGenders, setSelectedGenders] = useState<string[]>(
    data.suggestedGenders ?? []
  );

  // Locations
  const [locations, setLocations] = useState<string[]>(
    data.suggestedLocations ?? []
  );
  const [showLocationInput, setShowLocationInput] = useState(false);
  const [newLocation, setNewLocation] = useState('');

  // Interests
  const [interests, setInterests] = useState<string[]>(
    data.suggestedInterests ?? []
  );
  const [showInterestInput, setShowInterestInput] = useState(false);
  const [newInterest, setNewInterest] = useState('');

  // Audience type
  const [selectedAudienceType, setSelectedAudienceType] = useState<string | null>(
    () => {
      const recommended = data.audienceTypes?.find((t) => t.recommended);
      return recommended?.id ?? null;
    }
  );

  const toggleGender = (value: string) => {
    setSelectedGenders((prev) =>
      prev.includes(value) ? prev.filter((g) => g !== value) : [...prev, value]
    );
  };

  const removeLocation = (loc: string) => {
    setLocations((prev) => prev.filter((l) => l !== loc));
  };

  const addLocation = () => {
    const trimmed = newLocation.trim();
    if (trimmed && !locations.includes(trimmed)) {
      setLocations((prev) => [...prev, trimmed]);
    }
    setNewLocation('');
    setShowLocationInput(false);
  };

  const removeInterest = (interest: string) => {
    setInterests((prev) => prev.filter((i) => i !== interest));
  };

  const addInterest = () => {
    const trimmed = newInterest.trim();
    if (trimmed && !interests.includes(trimmed)) {
      setInterests((prev) => [...prev, trimmed]);
    }
    setNewInterest('');
    setShowInterestInput(false);
  };

  const handleSubmit = () => {
    const genderStr = selectedGenders.length > 0 ? selectedGenders.join(', ') : 'Belirtilmedi';
    const locationStr = locations.length > 0 ? locations.join(', ') : 'Belirtilmedi';
    const interestStr = interests.length > 0 ? interests.join(', ') : 'Belirtilmedi';
    const audienceLabel =
      data.audienceTypes?.find((t) => t.id === selectedAudienceType)?.label ?? 'Belirtilmedi';

    const message = `[${data.funnelStage}] kitle hedefi: Yas ${ageMin}-${ageMax}, Cinsiyet ${genderStr}, Lokasyon ${locationStr}, Ilgi alanlari ${interestStr}, Tip ${audienceLabel}`;
    onSendMessage(message);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="my-3 space-y-4"
    >
      {/* Card Wrapper */}
      <div className="p-4 rounded-xl border border-neutral-200 bg-white/80 space-y-5">
        {/* Header — Funnel Stage Badge */}
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-neutral-400" />
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-commons font-semibold uppercase tracking-wide ${stageColors.bg} ${stageColors.text}`}
          >
            {STAGE_LABELS[data.funnelStage]}
          </span>
        </div>

        {/* Age Range */}
        <div>
          <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5 block">
            Yas Araligi
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={ageMin}
              onChange={(e) => setAgeMin(Number(e.target.value))}
              min={13}
              max={ageMax}
              className="w-20 px-2 py-1.5 text-sm font-commons border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-300 focus:border-indigo-300"
            />
            <span className="text-xs font-commons text-neutral-400">—</span>
            <input
              type="number"
              value={ageMax}
              onChange={(e) => setAgeMax(Number(e.target.value))}
              min={ageMin}
              max={100}
              className="w-20 px-2 py-1.5 text-sm font-commons border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-300 focus:border-indigo-300"
            />
          </div>
        </div>

        {/* Gender */}
        <div>
          <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5 block">
            <Users className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" />
            Cinsiyet
          </label>
          <div className="flex items-center gap-2 flex-wrap">
            {GENDER_OPTIONS.map((opt) => {
              const isSelected = selectedGenders.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  onClick={() => toggleGender(opt.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-commons font-medium border transition-colors ${
                    isSelected
                      ? 'bg-indigo-100 text-indigo-700 border-indigo-200'
                      : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Locations */}
        <div>
          <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5 block">
            <MapPin className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" />
            Lokasyonlar
          </label>
          <div className="flex items-center gap-1.5 flex-wrap">
            {locations.map((loc) => (
              <span
                key={loc}
                className="px-2.5 py-1 rounded-full text-xs font-commons bg-neutral-100 text-neutral-700 flex items-center gap-1"
              >
                {loc}
                <X
                  className="w-3.5 h-3.5 text-neutral-400 hover:text-red-500 cursor-pointer"
                  onClick={() => removeLocation(loc)}
                />
              </span>
            ))}
            {showLocationInput ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addLocation();
                    if (e.key === 'Escape') {
                      setShowLocationInput(false);
                      setNewLocation('');
                    }
                  }}
                  placeholder="Lokasyon ekle..."
                  autoFocus
                  className="w-32 px-2 py-1 text-xs font-commons border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-300"
                />
                <button
                  onClick={addLocation}
                  className="px-2 py-1 rounded-lg bg-indigo-600 text-white text-xs font-commons"
                >
                  Ekle
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowLocationInput(true)}
                className="px-2.5 py-1 rounded-full text-xs font-commons border border-dashed border-neutral-300 text-neutral-500 hover:border-indigo-300 hover:text-indigo-600 cursor-pointer flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3 h-3" />
                Ekle
              </button>
            )}
          </div>
        </div>

        {/* Interests */}
        <div>
          <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5 block">
            <Heart className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" />
            Ilgi Alanlari
          </label>
          <div className="flex items-center gap-1.5 flex-wrap">
            {interests.map((interest) => (
              <span
                key={interest}
                className="px-2.5 py-1 rounded-full text-xs font-commons bg-neutral-100 text-neutral-700 flex items-center gap-1"
              >
                {interest}
                <X
                  className="w-3.5 h-3.5 text-neutral-400 hover:text-red-500 cursor-pointer"
                  onClick={() => removeInterest(interest)}
                />
              </span>
            ))}
            {showInterestInput ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={newInterest}
                  onChange={(e) => setNewInterest(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addInterest();
                    if (e.key === 'Escape') {
                      setShowInterestInput(false);
                      setNewInterest('');
                    }
                  }}
                  placeholder="Ilgi alani ekle..."
                  autoFocus
                  className="w-32 px-2 py-1 text-xs font-commons border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-300"
                />
                <button
                  onClick={addInterest}
                  className="px-2 py-1 rounded-lg bg-indigo-600 text-white text-xs font-commons"
                >
                  Ekle
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowInterestInput(true)}
                className="px-2.5 py-1 rounded-full text-xs font-commons border border-dashed border-neutral-300 text-neutral-500 hover:border-indigo-300 hover:text-indigo-600 cursor-pointer flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3 h-3" />
                Ekle
              </button>
            )}
          </div>
        </div>

        {/* Audience Types */}
        {data.audienceTypes && data.audienceTypes.length > 0 && (
          <div>
            <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5 block">
              Kitle Tipi
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {data.audienceTypes.map((type) => {
                const isSelected = selectedAudienceType === type.id;
                return (
                  <button
                    key={type.id}
                    onClick={() => setSelectedAudienceType(type.id)}
                    className={`text-left p-3 rounded-xl border transition-colors ${
                      isSelected
                        ? 'border-indigo-300 bg-indigo-50'
                        : 'border-neutral-200 bg-white hover:border-neutral-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-commons font-medium ${
                          isSelected ? 'text-indigo-700' : 'text-[#171717]'
                        }`}
                      >
                        {type.label}
                      </span>
                      {type.recommended && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-commons font-semibold uppercase tracking-wide bg-amber-100 text-amber-700">
                          Onerilen
                        </span>
                      )}
                    </div>
                    {type.description && (
                      <p className="text-xs font-commons text-neutral-500 mt-1">
                        {type.description}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-commons font-medium transition-colors"
        >
          <Target className="w-4 h-4" />
          Kitle Hedefini Onayla
        </button>
      </div>
    </motion.div>
  );
};

export default AudienceTargetingV3;
