import React, { useState } from 'react';
import { X, Plus, ChevronDown, ChevronRight } from 'lucide-react';
import { AudienceTargeting, AdPlatform } from '@/shared/types/marketing';

interface TargetingStepProps {
  data: Partial<AudienceTargeting>;
  platforms: AdPlatform[];
  onChange: (targeting: Partial<AudienceTargeting>) => void;
  isAIFilled?: boolean;
}

type MatchType = 'broad' | 'phrase' | 'exact';

const MATCH_TYPE_LABELS: Record<MatchType, string> = {
  broad: 'Geniş',
  phrase: 'İfade',
  exact: 'Tam',
};

const COMPANY_SIZES = [
  '1-10',
  '11-50',
  '51-200',
  '201-500',
  '501-1000',
  '1001-5000',
  '5001+',
];

const META_PLACEMENTS = [
  { id: 'facebook_feed', label: 'Facebook Feed' },
  { id: 'instagram_feed', label: 'Instagram Feed' },
  { id: 'stories', label: 'Stories' },
  { id: 'reels', label: 'Reels' },
];

export function TargetingStep({
  data,
  platforms,
  onChange,
  isAIFilled = false,
}: TargetingStepProps) {
  const [expandedPlatforms, setExpandedPlatforms] = useState<
    Record<AdPlatform, boolean>
  >({
    meta: true,
    google: true,
    tiktok: true,
    linkedin: true,
    email: false,
  });

  const [inputValues, setInputValues] = useState({
    location: '',
    language: '',
    metaInterest: '',
    metaBehavior: '',
    googleKeyword: '',
    tiktokInterest: '',
    tiktokHashtag: '',
    linkedinIndustry: '',
    linkedinJobTitle: '',
  });

  // Helper functions
  const addLocation = () => {
    if (!inputValues.location.trim()) return;
    const newLocation = {
      type: 'city' as const,
      name: inputValues.location.trim(),
    };
    onChange({
      ...data,
      locations: [...(data.locations || []), newLocation],
    });
    setInputValues({ ...inputValues, location: '' });
  };

  const removeLocation = (index: number) => {
    const newLocations = [...(data.locations || [])];
    newLocations.splice(index, 1);
    onChange({ ...data, locations: newLocations });
  };

  const addLanguage = () => {
    if (!inputValues.language.trim()) return;
    onChange({
      ...data,
      languages: [...(data.languages || []), inputValues.language.trim()],
    });
    setInputValues({ ...inputValues, language: '' });
  };

  const removeLanguage = (index: number) => {
    const newLanguages = [...(data.languages || [])];
    newLanguages.splice(index, 1);
    onChange({ ...data, languages: newLanguages });
  };

  const toggleGender = (gender: 'male' | 'female' | 'all') => {
    const genders = data.genders || [];
    const newGenders = genders.includes(gender)
      ? genders.filter((g) => g !== gender)
      : [...genders, gender];
    onChange({ ...data, genders: newGenders });
  };

  const togglePlatform = (platform: AdPlatform) => {
    setExpandedPlatforms({
      ...expandedPlatforms,
      [platform]: !expandedPlatforms[platform],
    });
  };

  // Platform-specific handlers
  const addMetaInterest = () => {
    if (!inputValues.metaInterest.trim()) return;
    onChange({
      ...data,
      meta: {
        ...data.meta,
        interests: [
          ...(data.meta?.interests || []),
          inputValues.metaInterest.trim(),
        ],
        behaviors: data.meta?.behaviors || [],
        customAudiences: data.meta?.customAudiences || [],
        placements: data.meta?.placements || [],
      },
    });
    setInputValues({ ...inputValues, metaInterest: '' });
  };

  const removeMetaInterest = (index: number) => {
    const interests = [...(data.meta?.interests || [])];
    interests.splice(index, 1);
    onChange({
      ...data,
      meta: { ...data.meta!, interests },
    });
  };

  const addMetaBehavior = () => {
    if (!inputValues.metaBehavior.trim()) return;
    onChange({
      ...data,
      meta: {
        ...data.meta,
        interests: data.meta?.interests || [],
        behaviors: [
          ...(data.meta?.behaviors || []),
          inputValues.metaBehavior.trim(),
        ],
        customAudiences: data.meta?.customAudiences || [],
        placements: data.meta?.placements || [],
      },
    });
    setInputValues({ ...inputValues, metaBehavior: '' });
  };

  const removeMetaBehavior = (index: number) => {
    const behaviors = [...(data.meta?.behaviors || [])];
    behaviors.splice(index, 1);
    onChange({
      ...data,
      meta: { ...data.meta!, behaviors },
    });
  };

  const toggleMetaPlacement = (placementId: string) => {
    const placements = data.meta?.placements || [];
    const newPlacements = placements.includes(placementId)
      ? placements.filter((p) => p !== placementId)
      : [...placements, placementId];
    onChange({
      ...data,
      meta: {
        ...data.meta,
        interests: data.meta?.interests || [],
        behaviors: data.meta?.behaviors || [],
        customAudiences: data.meta?.customAudiences || [],
        placements: newPlacements,
      },
    });
  };

  const addGoogleKeyword = () => {
    if (!inputValues.googleKeyword.trim()) return;
    const newKeyword = {
      text: inputValues.googleKeyword.trim(),
      matchType: 'broad' as MatchType,
    };
    onChange({
      ...data,
      google: {
        ...data.google,
        keywords: [...(data.google?.keywords || []), newKeyword],
        negativeKeywords: data.google?.negativeKeywords || [],
        audiences: data.google?.audiences || [],
        topics: data.google?.topics || [],
      },
    });
    setInputValues({ ...inputValues, googleKeyword: '' });
  };

  const removeGoogleKeyword = (index: number) => {
    const keywords = [...(data.google?.keywords || [])];
    keywords.splice(index, 1);
    onChange({
      ...data,
      google: { ...data.google!, keywords },
    });
  };

  const updateKeywordMatchType = (index: number, matchType: MatchType) => {
    const keywords = [...(data.google?.keywords || [])];
    keywords[index] = { ...keywords[index], matchType };
    onChange({
      ...data,
      google: { ...data.google!, keywords },
    });
  };

  const addTikTokInterest = () => {
    if (!inputValues.tiktokInterest.trim()) return;
    onChange({
      ...data,
      tiktok: {
        ...data.tiktok,
        interests: [
          ...(data.tiktok?.interests || []),
          inputValues.tiktokInterest.trim(),
        ],
        behaviors: data.tiktok?.behaviors || [],
        creatorCategories: data.tiktok?.creatorCategories || [],
        hashtags: data.tiktok?.hashtags || [],
      },
    });
    setInputValues({ ...inputValues, tiktokInterest: '' });
  };

  const removeTikTokInterest = (index: number) => {
    const interests = [...(data.tiktok?.interests || [])];
    interests.splice(index, 1);
    onChange({
      ...data,
      tiktok: { ...data.tiktok!, interests },
    });
  };

  const addTikTokHashtag = () => {
    if (!inputValues.tiktokHashtag.trim()) return;
    onChange({
      ...data,
      tiktok: {
        ...data.tiktok,
        interests: data.tiktok?.interests || [],
        behaviors: data.tiktok?.behaviors || [],
        creatorCategories: data.tiktok?.creatorCategories || [],
        hashtags: [
          ...(data.tiktok?.hashtags || []),
          inputValues.tiktokHashtag.trim(),
        ],
      },
    });
    setInputValues({ ...inputValues, tiktokHashtag: '' });
  };

  const removeTikTokHashtag = (index: number) => {
    const hashtags = [...(data.tiktok?.hashtags || [])];
    hashtags.splice(index, 1);
    onChange({
      ...data,
      tiktok: { ...data.tiktok!, hashtags },
    });
  };

  const addLinkedInIndustry = () => {
    if (!inputValues.linkedinIndustry.trim()) return;
    onChange({
      ...data,
      linkedin: {
        ...data.linkedin,
        companies: {
          sizes: data.linkedin?.companies?.sizes || [],
          industries: [
            ...(data.linkedin?.companies?.industries || []),
            inputValues.linkedinIndustry.trim(),
          ],
        },
        jobTitles: data.linkedin?.jobTitles || [],
        jobFunctions: data.linkedin?.jobFunctions || [],
        seniority: data.linkedin?.seniority || [],
        skills: data.linkedin?.skills || [],
      },
    });
    setInputValues({ ...inputValues, linkedinIndustry: '' });
  };

  const removeLinkedInIndustry = (index: number) => {
    const industries = [...(data.linkedin?.companies?.industries || [])];
    industries.splice(index, 1);
    onChange({
      ...data,
      linkedin: {
        ...data.linkedin!,
        companies: {
          ...data.linkedin!.companies,
          industries,
        },
      },
    });
  };

  const addLinkedInJobTitle = () => {
    if (!inputValues.linkedinJobTitle.trim()) return;
    onChange({
      ...data,
      linkedin: {
        ...data.linkedin,
        companies: data.linkedin?.companies || { sizes: [], industries: [] },
        jobTitles: [
          ...(data.linkedin?.jobTitles || []),
          inputValues.linkedinJobTitle.trim(),
        ],
        jobFunctions: data.linkedin?.jobFunctions || [],
        seniority: data.linkedin?.seniority || [],
        skills: data.linkedin?.skills || [],
      },
    });
    setInputValues({ ...inputValues, linkedinJobTitle: '' });
  };

  const removeLinkedInJobTitle = (index: number) => {
    const jobTitles = [...(data.linkedin?.jobTitles || [])];
    jobTitles.splice(index, 1);
    onChange({
      ...data,
      linkedin: { ...data.linkedin!, jobTitles },
    });
  };

  const toggleLinkedInCompanySize = (size: string) => {
    const sizes = data.linkedin?.companies?.sizes || [];
    const newSizes = sizes.includes(size)
      ? sizes.filter((s) => s !== size)
      : [...sizes, size];
    onChange({
      ...data,
      linkedin: {
        ...data.linkedin,
        companies: {
          sizes: newSizes,
          industries: data.linkedin?.companies?.industries || [],
        },
        jobTitles: data.linkedin?.jobTitles || [],
        jobFunctions: data.linkedin?.jobFunctions || [],
        seniority: data.linkedin?.seniority || [],
        skills: data.linkedin?.skills || [],
      },
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {isAIFilled && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm font-commons text-blue-700">
            Bu alanlar AI tarafından dolduruldu. Dilediğiniz gibi düzenleyebilirsiniz.
          </p>
        </div>
      )}

      <div className="space-y-6">
        {/* Age Range */}
        <div>
          <label className="text-sm font-commons font-medium text-[#171717] mb-2 block">
            Yaş Aralığı
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={data.ageRange?.min || 18}
              onChange={(e) =>
                onChange({
                  ...data,
                  ageRange: {
                    min: parseInt(e.target.value) || 18,
                    max: data.ageRange?.max || 65,
                  },
                })
              }
              min={13}
              max={65}
              className="w-24 border border-neutral-200 rounded-lg px-3 py-2 font-commons text-sm focus:outline-none focus:border-indigo-400"
            />
            <span className="text-sm font-commons text-neutral-600">-</span>
            <input
              type="number"
              value={data.ageRange?.max || 65}
              onChange={(e) =>
                onChange({
                  ...data,
                  ageRange: {
                    min: data.ageRange?.min || 18,
                    max: parseInt(e.target.value) || 65,
                  },
                })
              }
              min={13}
              max={65}
              className="w-24 border border-neutral-200 rounded-lg px-3 py-2 font-commons text-sm focus:outline-none focus:border-indigo-400"
            />
          </div>
        </div>

        {/* Gender */}
        <div>
          <label className="text-sm font-commons font-medium text-[#171717] mb-2 block">
            Cinsiyet
          </label>
          <div className="flex gap-3">
            {[
              { value: 'male' as const, label: 'Erkek' },
              { value: 'female' as const, label: 'Kadın' },
              { value: 'all' as const, label: 'Tümü' },
            ].map((gender) => (
              <label
                key={gender.value}
                className="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={(data.genders || []).includes(gender.value)}
                  onChange={() => toggleGender(gender.value)}
                  className="w-4 h-4 text-indigo-600 border-neutral-300 rounded focus:ring-indigo-500"
                />
                <span className="text-sm font-commons text-neutral-700">
                  {gender.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Locations */}
        <div>
          <label className="text-sm font-commons font-medium text-[#171717] mb-2 block">
            Lokasyonlar
          </label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={inputValues.location}
              onChange={(e) =>
                setInputValues({ ...inputValues, location: e.target.value })
              }
              onKeyPress={(e) => e.key === 'Enter' && addLocation()}
              placeholder="Şehir veya ülke adı girin"
              className="flex-1 border border-neutral-200 rounded-lg px-3 py-2 font-commons text-sm focus:outline-none focus:border-indigo-400"
            />
            <button
              type="button"
              onClick={addLocation}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-commons text-sm hover:bg-indigo-700 flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              Ekle
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {(data.locations || []).map((loc, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-commons"
              >
                {loc.name}
                <button
                  type="button"
                  onClick={() => removeLocation(index)}
                  className="hover:text-indigo-900"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Languages */}
        <div>
          <label className="text-sm font-commons font-medium text-[#171717] mb-2 block">
            Diller
          </label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={inputValues.language}
              onChange={(e) =>
                setInputValues({ ...inputValues, language: e.target.value })
              }
              onKeyPress={(e) => e.key === 'Enter' && addLanguage()}
              placeholder="Dil adı girin (Örn: Türkçe)"
              className="flex-1 border border-neutral-200 rounded-lg px-3 py-2 font-commons text-sm focus:outline-none focus:border-indigo-400"
            />
            <button
              type="button"
              onClick={addLanguage}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-commons text-sm hover:bg-indigo-700 flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              Ekle
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {(data.languages || []).map((lang, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-commons"
              >
                {lang}
                <button
                  type="button"
                  onClick={() => removeLanguage(index)}
                  className="hover:text-indigo-900"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Platform-specific targeting */}
        <div className="border-t border-neutral-200 pt-6">
          <h3 className="text-lg font-commons font-semibold text-[#171717] mb-4">
            Platform-özel Hedefleme
          </h3>

          <div className="space-y-4">
            {/* Meta */}
            {platforms.includes('meta') && (
              <div className="border border-neutral-200 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => togglePlatform('meta')}
                  className="w-full px-4 py-3 bg-neutral-50 flex items-center justify-between hover:bg-neutral-100"
                >
                  <span className="text-sm font-commons font-medium text-[#171717]">
                    Meta (Facebook & Instagram)
                  </span>
                  {expandedPlatforms.meta ? (
                    <ChevronDown className="w-4 h-4 text-neutral-600" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-neutral-600" />
                  )}
                </button>

                {expandedPlatforms.meta && (
                  <div className="p-4 space-y-4">
                    {/* Interests */}
                    <div>
                      <label className="text-sm font-commons font-medium text-[#171717] mb-1 block">
                        İlgi Alanları
                      </label>
                      <div className="flex gap-2 mb-2">
                        <input
                          type="text"
                          value={inputValues.metaInterest}
                          onChange={(e) =>
                            setInputValues({
                              ...inputValues,
                              metaInterest: e.target.value,
                            })
                          }
                          onKeyPress={(e) =>
                            e.key === 'Enter' && addMetaInterest()
                          }
                          placeholder="İlgi alanı girin"
                          className="flex-1 border border-neutral-200 rounded-lg px-3 py-2 font-commons text-sm focus:outline-none focus:border-indigo-400"
                        />
                        <button
                          type="button"
                          onClick={addMetaInterest}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-commons text-sm hover:bg-indigo-700"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(data.meta?.interests || []).map((interest, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-commons"
                          >
                            {interest}
                            <button
                              type="button"
                              onClick={() => removeMetaInterest(index)}
                              className="hover:text-indigo-900"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Behaviors */}
                    <div>
                      <label className="text-sm font-commons font-medium text-[#171717] mb-1 block">
                        Davranışlar
                      </label>
                      <div className="flex gap-2 mb-2">
                        <input
                          type="text"
                          value={inputValues.metaBehavior}
                          onChange={(e) =>
                            setInputValues({
                              ...inputValues,
                              metaBehavior: e.target.value,
                            })
                          }
                          onKeyPress={(e) =>
                            e.key === 'Enter' && addMetaBehavior()
                          }
                          placeholder="Davranış girin"
                          className="flex-1 border border-neutral-200 rounded-lg px-3 py-2 font-commons text-sm focus:outline-none focus:border-indigo-400"
                        />
                        <button
                          type="button"
                          onClick={addMetaBehavior}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-commons text-sm hover:bg-indigo-700"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(data.meta?.behaviors || []).map((behavior, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-commons"
                          >
                            {behavior}
                            <button
                              type="button"
                              onClick={() => removeMetaBehavior(index)}
                              className="hover:text-indigo-900"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Placements */}
                    <div>
                      <label className="text-sm font-commons font-medium text-[#171717] mb-2 block">
                        Yerleşimler
                      </label>
                      <div className="space-y-2">
                        {META_PLACEMENTS.map((placement) => (
                          <label
                            key={placement.id}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={(data.meta?.placements || []).includes(
                                placement.id
                              )}
                              onChange={() =>
                                toggleMetaPlacement(placement.id)
                              }
                              className="w-4 h-4 text-indigo-600 border-neutral-300 rounded focus:ring-indigo-500"
                            />
                            <span className="text-sm font-commons text-neutral-700">
                              {placement.label}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Google */}
            {platforms.includes('google') && (
              <div className="border border-neutral-200 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => togglePlatform('google')}
                  className="w-full px-4 py-3 bg-neutral-50 flex items-center justify-between hover:bg-neutral-100"
                >
                  <span className="text-sm font-commons font-medium text-[#171717]">
                    Google Ads
                  </span>
                  {expandedPlatforms.google ? (
                    <ChevronDown className="w-4 h-4 text-neutral-600" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-neutral-600" />
                  )}
                </button>

                {expandedPlatforms.google && (
                  <div className="p-4 space-y-4">
                    {/* Keywords */}
                    <div>
                      <label className="text-sm font-commons font-medium text-[#171717] mb-1 block">
                        Anahtar Kelimeler
                      </label>
                      <div className="flex gap-2 mb-2">
                        <input
                          type="text"
                          value={inputValues.googleKeyword}
                          onChange={(e) =>
                            setInputValues({
                              ...inputValues,
                              googleKeyword: e.target.value,
                            })
                          }
                          onKeyPress={(e) =>
                            e.key === 'Enter' && addGoogleKeyword()
                          }
                          placeholder="Anahtar kelime girin"
                          className="flex-1 border border-neutral-200 rounded-lg px-3 py-2 font-commons text-sm focus:outline-none focus:border-indigo-400"
                        />
                        <button
                          type="button"
                          onClick={addGoogleKeyword}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-commons text-sm hover:bg-indigo-700"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(data.google?.keywords || []).map((keyword, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center gap-2 px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-commons"
                          >
                            {keyword.text}
                            <select
                              value={keyword.matchType}
                              onChange={(e) =>
                                updateKeywordMatchType(
                                  index,
                                  e.target.value as MatchType
                                )
                              }
                              className="bg-transparent border-none text-xs p-0 focus:ring-0"
                            >
                              {Object.entries(MATCH_TYPE_LABELS).map(
                                ([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                )
                              )}
                            </select>
                            <button
                              type="button"
                              onClick={() => removeGoogleKeyword(index)}
                              className="hover:text-indigo-900"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TikTok */}
            {platforms.includes('tiktok') && (
              <div className="border border-neutral-200 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => togglePlatform('tiktok')}
                  className="w-full px-4 py-3 bg-neutral-50 flex items-center justify-between hover:bg-neutral-100"
                >
                  <span className="text-sm font-commons font-medium text-[#171717]">
                    TikTok Ads
                  </span>
                  {expandedPlatforms.tiktok ? (
                    <ChevronDown className="w-4 h-4 text-neutral-600" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-neutral-600" />
                  )}
                </button>

                {expandedPlatforms.tiktok && (
                  <div className="p-4 space-y-4">
                    {/* Interests */}
                    <div>
                      <label className="text-sm font-commons font-medium text-[#171717] mb-1 block">
                        İlgi Alanları
                      </label>
                      <div className="flex gap-2 mb-2">
                        <input
                          type="text"
                          value={inputValues.tiktokInterest}
                          onChange={(e) =>
                            setInputValues({
                              ...inputValues,
                              tiktokInterest: e.target.value,
                            })
                          }
                          onKeyPress={(e) =>
                            e.key === 'Enter' && addTikTokInterest()
                          }
                          placeholder="İlgi alanı girin"
                          className="flex-1 border border-neutral-200 rounded-lg px-3 py-2 font-commons text-sm focus:outline-none focus:border-indigo-400"
                        />
                        <button
                          type="button"
                          onClick={addTikTokInterest}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-commons text-sm hover:bg-indigo-700"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(data.tiktok?.interests || []).map(
                          (interest, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-commons"
                            >
                              {interest}
                              <button
                                type="button"
                                onClick={() => removeTikTokInterest(index)}
                                className="hover:text-indigo-900"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          )
                        )}
                      </div>
                    </div>

                    {/* Hashtags */}
                    <div>
                      <label className="text-sm font-commons font-medium text-[#171717] mb-1 block">
                        Hashtag'ler
                      </label>
                      <div className="flex gap-2 mb-2">
                        <input
                          type="text"
                          value={inputValues.tiktokHashtag}
                          onChange={(e) =>
                            setInputValues({
                              ...inputValues,
                              tiktokHashtag: e.target.value,
                            })
                          }
                          onKeyPress={(e) =>
                            e.key === 'Enter' && addTikTokHashtag()
                          }
                          placeholder="Hashtag girin (# olmadan)"
                          className="flex-1 border border-neutral-200 rounded-lg px-3 py-2 font-commons text-sm focus:outline-none focus:border-indigo-400"
                        />
                        <button
                          type="button"
                          onClick={addTikTokHashtag}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-commons text-sm hover:bg-indigo-700"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(data.tiktok?.hashtags || []).map((hashtag, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-commons"
                          >
                            #{hashtag}
                            <button
                              type="button"
                              onClick={() => removeTikTokHashtag(index)}
                              className="hover:text-indigo-900"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* LinkedIn */}
            {platforms.includes('linkedin') && (
              <div className="border border-neutral-200 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => togglePlatform('linkedin')}
                  className="w-full px-4 py-3 bg-neutral-50 flex items-center justify-between hover:bg-neutral-100"
                >
                  <span className="text-sm font-commons font-medium text-[#171717]">
                    LinkedIn Ads
                  </span>
                  {expandedPlatforms.linkedin ? (
                    <ChevronDown className="w-4 h-4 text-neutral-600" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-neutral-600" />
                  )}
                </button>

                {expandedPlatforms.linkedin && (
                  <div className="p-4 space-y-4">
                    {/* Industries */}
                    <div>
                      <label className="text-sm font-commons font-medium text-[#171717] mb-1 block">
                        Sektörler
                      </label>
                      <div className="flex gap-2 mb-2">
                        <input
                          type="text"
                          value={inputValues.linkedinIndustry}
                          onChange={(e) =>
                            setInputValues({
                              ...inputValues,
                              linkedinIndustry: e.target.value,
                            })
                          }
                          onKeyPress={(e) =>
                            e.key === 'Enter' && addLinkedInIndustry()
                          }
                          placeholder="Sektör girin"
                          className="flex-1 border border-neutral-200 rounded-lg px-3 py-2 font-commons text-sm focus:outline-none focus:border-indigo-400"
                        />
                        <button
                          type="button"
                          onClick={addLinkedInIndustry}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-commons text-sm hover:bg-indigo-700"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(data.linkedin?.companies?.industries || []).map(
                          (industry, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-commons"
                            >
                              {industry}
                              <button
                                type="button"
                                onClick={() => removeLinkedInIndustry(index)}
                                className="hover:text-indigo-900"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          )
                        )}
                      </div>
                    </div>

                    {/* Job Titles */}
                    <div>
                      <label className="text-sm font-commons font-medium text-[#171717] mb-1 block">
                        İş Ünvanları
                      </label>
                      <div className="flex gap-2 mb-2">
                        <input
                          type="text"
                          value={inputValues.linkedinJobTitle}
                          onChange={(e) =>
                            setInputValues({
                              ...inputValues,
                              linkedinJobTitle: e.target.value,
                            })
                          }
                          onKeyPress={(e) =>
                            e.key === 'Enter' && addLinkedInJobTitle()
                          }
                          placeholder="İş ünvanı girin"
                          className="flex-1 border border-neutral-200 rounded-lg px-3 py-2 font-commons text-sm focus:outline-none focus:border-indigo-400"
                        />
                        <button
                          type="button"
                          onClick={addLinkedInJobTitle}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-commons text-sm hover:bg-indigo-700"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(data.linkedin?.jobTitles || []).map(
                          (jobTitle, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-commons"
                            >
                              {jobTitle}
                              <button
                                type="button"
                                onClick={() => removeLinkedInJobTitle(index)}
                                className="hover:text-indigo-900"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          )
                        )}
                      </div>
                    </div>

                    {/* Company Size */}
                    <div>
                      <label className="text-sm font-commons font-medium text-[#171717] mb-2 block">
                        Şirket Büyüklüğü
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {COMPANY_SIZES.map((size) => (
                          <label
                            key={size}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={(
                                data.linkedin?.companies?.sizes || []
                              ).includes(size)}
                              onChange={() => toggleLinkedInCompanySize(size)}
                              className="w-4 h-4 text-indigo-600 border-neutral-300 rounded focus:ring-indigo-500"
                            />
                            <span className="text-sm font-commons text-neutral-700">
                              {size}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
