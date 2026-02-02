import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Plus, X, AlertTriangle } from 'lucide-react';
import { useProjectScope } from '@/shared/hooks/useProjectScope';
import { getCampaign, updateCampaign } from '@/shared/services/marketingService';
import ProjectBreadcrumb from '@/admin/projects/components/ProjectBreadcrumb';
import type { AdPlatform, AudienceTargeting, MarketingCampaign } from '@/shared/types/marketing';
import {
  OBJECTIVE_LABELS,
  CAMPAIGN_STATUS_LABELS,
  PLATFORM_LABELS,
  PLATFORM_COLORS,
} from '@/shared/types/marketing';
import type { CampaignObjective, CampaignStatus } from '@/shared/types/marketing';

// ============================================
// TAB TIPLERI
// ============================================

type TabKey = 'basics' | 'targeting' | 'budget' | 'schedule';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'basics', label: 'Temel Bilgiler' },
  { key: 'targeting', label: 'Hedefleme' },
  { key: 'budget', label: 'Butce' },
  { key: 'schedule', label: 'Zamanlama' },
];

const EDITABLE_STATUSES: { value: CampaignStatus; label: string }[] = [
  { value: 'draft', label: 'Taslak' },
  { value: 'active', label: 'Yayinda' },
  { value: 'paused', label: 'Duraklatildi' },
  { value: 'completed', label: 'Tamamlandi' },
];

// ============================================
// MAIN COMPONENT
// ============================================

const CampaignEditPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { basePath, projectId, isProjectScoped } = useProjectScope();

  const [campaign, setCampaign] = useState<MarketingCampaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('basics');
  const [formData, setFormData] = useState<any>({});
  const [saveSuccess, setSaveSuccess] = useState(false);

  // ============================================
  // LOAD CAMPAIGN
  // ============================================

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getCampaign(id)
      .then((camp) => {
        if (camp) {
          setCampaign(camp);
          setFormData({
            name: camp.name || '',
            description: camp.description || '',
            objective: camp.objective || 'awareness',
            status: camp.status || 'draft',
            // Targeting
            ageMin: camp.targeting?.ageRange?.min || 18,
            ageMax: camp.targeting?.ageRange?.max || 65,
            genders: camp.targeting?.genders || ['all'],
            locations: camp.targeting?.locations || [],
            // Platform-specific targeting
            metaTargeting: camp.targeting?.meta || null,
            googleTargeting: camp.targeting?.google || null,
            tiktokTargeting: camp.targeting?.tiktok || null,
            linkedinTargeting: camp.targeting?.linkedin || null,
            emailTargeting: camp.targeting?.email || null,
            // Budget
            totalBudget: camp.budget?.totalBudget || 0,
            dailyLimit: camp.budget?.dailyLimit || 0,
            currency: camp.budget?.currency || 'TRY',
            platformBreakdown: camp.budget?.platformBreakdown || [],
            // Schedule
            startDate: camp.schedule?.startDate || '',
            endDate: camp.schedule?.endDate || '',
            timezone: camp.schedule?.timezone || 'Europe/Istanbul',
          });
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  // ============================================
  // FORM HELPERS
  // ============================================

  const updateField = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
    setSaveSuccess(false);
  };

  const toggleGender = (gender: 'male' | 'female' | 'all') => {
    setFormData((prev: any) => {
      const current: string[] = prev.genders || [];
      if (gender === 'all') {
        return { ...prev, genders: ['all'] };
      }
      const withoutAll = current.filter((g: string) => g !== 'all');
      const idx = withoutAll.indexOf(gender);
      if (idx >= 0) {
        withoutAll.splice(idx, 1);
      } else {
        withoutAll.push(gender);
      }
      return { ...prev, genders: withoutAll.length > 0 ? withoutAll : ['all'] };
    });
    setSaveSuccess(false);
  };

  const addLocation = () => {
    const name = prompt('Konum adi girin (orn: Istanbul, Turkiye):');
    if (!name?.trim()) return;
    setFormData((prev: any) => ({
      ...prev,
      locations: [
        ...(prev.locations || []),
        { type: 'city' as const, name: name.trim() },
      ],
    }));
    setSaveSuccess(false);
  };

  const removeLocation = (index: number) => {
    setFormData((prev: any) => ({
      ...prev,
      locations: (prev.locations || []).filter((_: any, i: number) => i !== index),
    }));
    setSaveSuccess(false);
  };

  const updatePlatformBreakdown = (index: number, field: string, value: any) => {
    setFormData((prev: any) => {
      const updated = [...(prev.platformBreakdown || [])];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, platformBreakdown: updated };
    });
    setSaveSuccess(false);
  };

  // ============================================
  // SAVE HANDLER
  // ============================================

  const handleSave = async () => {
    if (!id || !campaign) return;
    setSaving(true);
    setSaveSuccess(false);

    try {
      const updateData = {
        name: formData.name,
        description: formData.description,
        status: formData.status as CampaignStatus,
        budget: {
          totalBudget: Number(formData.totalBudget) || 0,
          dailyLimit: Number(formData.dailyLimit) || 0,
          currency: formData.currency,
          platformBreakdown: formData.platformBreakdown || [],
          testBudgetPercentage: campaign.budget?.testBudgetPercentage || 20,
        },
        schedule: {
          startDate: formData.startDate,
          endDate: formData.endDate || undefined,
          timezone: formData.timezone,
        },
        targeting: {
          ageRange: { min: Number(formData.ageMin) || 18, max: Number(formData.ageMax) || 65 },
          genders: formData.genders,
          locations: formData.locations || [],
          languages: campaign.targeting?.languages || ['tr'],
          ...(formData.metaTargeting ? { meta: formData.metaTargeting } : {}),
          ...(formData.googleTargeting ? { google: formData.googleTargeting } : {}),
          ...(formData.tiktokTargeting ? { tiktok: formData.tiktokTargeting } : {}),
          ...(formData.linkedinTargeting ? { linkedin: formData.linkedinTargeting } : {}),
          ...(formData.emailTargeting ? { email: formData.emailTargeting } : {}),
        } as Partial<AudienceTargeting>,
      };

      await updateCampaign(id, updateData, 'admin', 'Admin');

      // Reload campaign to reflect changes
      const updated = await getCampaign(id);
      if (updated) setCampaign(updated);
      setSaveSuccess(true);
    } catch (err) {
      console.error('Kampanya guncelleme hatasi:', err);
      alert('Kaydederken bir hata olustu. Lutfen tekrar deneyin.');
    } finally {
      setSaving(false);
    }
  };

  // ============================================
  // LOADING / ERROR STATES
  // ============================================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="text-center py-16">
        <AlertTriangle className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
        <p className="font-commons text-neutral-500">Kampanya bulunamadi</p>
        <button
          onClick={() => navigate(`${basePath}/campaigns`)}
          className="mt-4 px-4 py-2 font-commons text-sm text-indigo-600 hover:text-indigo-700 transition-colors"
        >
          Kampanyalara don
        </button>
      </div>
    );
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Breadcrumb */}
      {isProjectScoped && projectId && (
        <ProjectBreadcrumb projectId={projectId} currentPage="Kampanyayi Duzenle" />
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(`${basePath}/campaigns/${id}`)}
          className="p-2 hover:bg-neutral-50 rounded-lg transition-colors"
          aria-label="Geri"
        >
          <ArrowLeft className="w-5 h-5 text-neutral-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-commons font-bold text-[#171717]">
            Kampanyayi Duzenle
          </h1>
          <p className="text-sm font-commons text-neutral-500 mt-0.5">
            {campaign.name}
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 bg-white rounded-lg border border-neutral-200/50 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg font-commons text-sm transition-colors ${
              activeTab === tab.key
                ? 'bg-indigo-600 text-white'
                : 'text-neutral-600 hover:bg-neutral-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-xl border border-neutral-200/50 p-6">
        {/* ============================================ */}
        {/* TEMEL BILGILER TAB */}
        {/* ============================================ */}
        {activeTab === 'basics' && (
          <div className="space-y-5">
            <h2 className="text-lg font-commons font-semibold text-[#171717] mb-4">
              Temel Bilgiler
            </h2>

            {/* Name */}
            <div>
              <label className="block text-sm font-commons font-medium text-neutral-700 mb-1.5">
                Kampanya Adi
              </label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => updateField('name', e.target.value)}
                className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 font-commons text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/20 transition-colors"
                placeholder="Kampanya adi"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-commons font-medium text-neutral-700 mb-1.5">
                Aciklama
              </label>
              <textarea
                value={formData.description || ''}
                onChange={(e) => updateField('description', e.target.value)}
                rows={3}
                className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 font-commons text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/20 transition-colors resize-none"
                placeholder="Kampanya aciklamasi"
              />
            </div>

            {/* Objective */}
            <div>
              <label className="block text-sm font-commons font-medium text-neutral-700 mb-1.5">
                Hedef
              </label>
              <select
                value={formData.objective || ''}
                onChange={(e) => updateField('objective', e.target.value)}
                className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 font-commons text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/20 transition-colors bg-white"
              >
                {Object.entries(OBJECTIVE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-commons font-medium text-neutral-700 mb-1.5">
                Durum
              </label>
              <select
                value={formData.status || 'draft'}
                onChange={(e) => updateField('status', e.target.value)}
                className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 font-commons text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/20 transition-colors bg-white"
              >
                {EDITABLE_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Platforms (read-only display) */}
            <div>
              <label className="block text-sm font-commons font-medium text-neutral-700 mb-1.5">
                Platformlar
              </label>
              <div className="flex flex-wrap gap-2">
                {campaign.platforms.map((p) => (
                  <span
                    key={p}
                    className={`px-3 py-1.5 rounded-lg text-sm font-commons ${PLATFORM_COLORS[p]}`}
                  >
                    {PLATFORM_LABELS[p]}
                  </span>
                ))}
              </div>
              <p className="text-xs font-commons text-neutral-400 mt-1.5">
                Platformlar kampanya olusturulduktan sonra degistirilemez
              </p>
            </div>
          </div>
        )}

        {/* ============================================ */}
        {/* HEDEFLEME TAB */}
        {/* ============================================ */}
        {activeTab === 'targeting' && (
          <div className="space-y-6">
            <h2 className="text-lg font-commons font-semibold text-[#171717] mb-4">
              Hedef Kitle
            </h2>

            {/* Age Range */}
            <div>
              <label className="block text-sm font-commons font-medium text-neutral-700 mb-1.5">
                Yas Araligi
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={13}
                  max={65}
                  value={formData.ageMin || 18}
                  onChange={(e) => updateField('ageMin', parseInt(e.target.value) || 18)}
                  className="w-24 border border-neutral-200 rounded-lg px-3 py-2.5 font-commons text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/20 transition-colors"
                />
                <span className="text-sm font-commons text-neutral-500">-</span>
                <input
                  type="number"
                  min={13}
                  max={65}
                  value={formData.ageMax || 65}
                  onChange={(e) => updateField('ageMax', parseInt(e.target.value) || 65)}
                  className="w-24 border border-neutral-200 rounded-lg px-3 py-2.5 font-commons text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/20 transition-colors"
                />
                <span className="text-sm font-commons text-neutral-400">yas</span>
              </div>
            </div>

            {/* Gender */}
            <div>
              <label className="block text-sm font-commons font-medium text-neutral-700 mb-1.5">
                Cinsiyet
              </label>
              <div className="flex flex-wrap gap-3">
                {[
                  { value: 'all' as const, label: 'Tumu' },
                  { value: 'male' as const, label: 'Erkek' },
                  { value: 'female' as const, label: 'Kadin' },
                ].map((g) => {
                  const isChecked = (formData.genders || ['all']).includes(g.value);
                  return (
                    <label
                      key={g.value}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                        isChecked
                          ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                          : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleGender(g.value)}
                        className="sr-only"
                      />
                      <span className="text-sm font-commons">{g.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Locations */}
            <div>
              <label className="block text-sm font-commons font-medium text-neutral-700 mb-1.5">
                Konumlar
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {(formData.locations || []).map((loc: any, i: number) => (
                  <span
                    key={i}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 rounded-lg text-sm font-commons text-neutral-700"
                  >
                    {loc.name}
                    <button
                      onClick={() => removeLocation(i)}
                      className="text-neutral-400 hover:text-red-500 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
              <button
                onClick={addLocation}
                className="flex items-center gap-1.5 px-3 py-2 border border-dashed border-neutral-300 rounded-lg text-sm font-commons text-neutral-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Konum Ekle
              </button>
            </div>

            {/* Platform-Specific Targeting Sections */}
            {campaign.platforms.includes('meta') && formData.metaTargeting && (
              <PlatformTargetingSection
                title="Meta Hedefleme"
                platform="meta"
                data={formData.metaTargeting}
                fields={[
                  { key: 'interests', label: 'Ilgi Alanlari' },
                  { key: 'behaviors', label: 'Davranislar' },
                  { key: 'placements', label: 'Yerlestirmeler' },
                ]}
              />
            )}

            {campaign.platforms.includes('google') && formData.googleTargeting && (
              <PlatformTargetingSection
                title="Google Hedefleme"
                platform="google"
                data={formData.googleTargeting}
                fields={[
                  { key: 'audiences', label: 'Kitleler' },
                  { key: 'topics', label: 'Konular' },
                  { key: 'negativeKeywords', label: 'Negatif Anahtar Kelimeler' },
                ]}
              />
            )}

            {campaign.platforms.includes('tiktok') && formData.tiktokTargeting && (
              <PlatformTargetingSection
                title="TikTok Hedefleme"
                platform="tiktok"
                data={formData.tiktokTargeting}
                fields={[
                  { key: 'interests', label: 'Ilgi Alanlari' },
                  { key: 'behaviors', label: 'Davranislar' },
                  { key: 'hashtags', label: 'Hashtagler' },
                ]}
              />
            )}

            {campaign.platforms.includes('linkedin') && formData.linkedinTargeting && (
              <PlatformTargetingSection
                title="LinkedIn Hedefleme"
                platform="linkedin"
                data={formData.linkedinTargeting}
                fields={[
                  { key: 'jobTitles', label: 'Is Unvanlari' },
                  { key: 'skills', label: 'Beceriler' },
                  { key: 'seniority', label: 'Kidemlilik' },
                ]}
              />
            )}

            {campaign.platforms.includes('email') && formData.emailTargeting && (
              <PlatformTargetingSection
                title="Email Hedefleme"
                platform="email"
                data={formData.emailTargeting}
                fields={[
                  { key: 'segments', label: 'Segmentler' },
                  { key: 'tags', label: 'Etiketler' },
                ]}
              />
            )}
          </div>
        )}

        {/* ============================================ */}
        {/* BUTCE TAB */}
        {/* ============================================ */}
        {activeTab === 'budget' && (
          <div className="space-y-5">
            <h2 className="text-lg font-commons font-semibold text-[#171717] mb-4">
              Butce Ayarlari
            </h2>

            {/* Total Budget */}
            <div>
              <label className="block text-sm font-commons font-medium text-neutral-700 mb-1.5">
                Toplam Butce
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={formData.totalBudget || 0}
                  onChange={(e) => updateField('totalBudget', parseFloat(e.target.value) || 0)}
                  className="flex-1 border border-neutral-200 rounded-lg px-3 py-2.5 font-commons text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/20 transition-colors"
                />
                <select
                  value={formData.currency || 'TRY'}
                  onChange={(e) => updateField('currency', e.target.value)}
                  className="w-24 border border-neutral-200 rounded-lg px-3 py-2.5 font-commons text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/20 transition-colors bg-white"
                >
                  <option value="TRY">TRY</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
            </div>

            {/* Daily Limit */}
            <div>
              <label className="block text-sm font-commons font-medium text-neutral-700 mb-1.5">
                Gunluk Limit
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={formData.dailyLimit || 0}
                  onChange={(e) => updateField('dailyLimit', parseFloat(e.target.value) || 0)}
                  className="flex-1 border border-neutral-200 rounded-lg px-3 py-2.5 font-commons text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/20 transition-colors"
                />
                <span className="text-sm font-commons text-neutral-500 w-24">
                  {formData.currency || 'TRY'}
                </span>
              </div>
              <p className="text-xs font-commons text-neutral-400 mt-1">
                0 olarak birakirsaniz gunluk limit uygulanmaz
              </p>
            </div>

            {/* Platform Breakdown Table */}
            {(formData.platformBreakdown || []).length > 0 && (
              <div>
                <label className="block text-sm font-commons font-medium text-neutral-700 mb-2">
                  Platform Dagilimi
                </label>
                <div className="border border-neutral-200 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-neutral-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-commons font-semibold text-neutral-500 uppercase">
                          Platform
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-commons font-semibold text-neutral-500 uppercase">
                          Tutar ({formData.currency || 'TRY'})
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-commons font-semibold text-neutral-500 uppercase">
                          Yuzde (%)
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {(formData.platformBreakdown || []).map((item: any, i: number) => (
                        <tr key={i} className="hover:bg-neutral-50">
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-xs font-commons ${PLATFORM_COLORS[item.platform as AdPlatform] || 'bg-neutral-100 text-neutral-600'}`}>
                              {PLATFORM_LABELS[item.platform as AdPlatform] || item.platform}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              min={0}
                              value={item.amount || 0}
                              onChange={(e) =>
                                updatePlatformBreakdown(i, 'amount', parseFloat(e.target.value) || 0)
                              }
                              className="w-32 border border-neutral-200 rounded-lg px-2.5 py-1.5 font-commons text-sm focus:outline-none focus:border-indigo-400 transition-colors"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={item.percentage || 0}
                              onChange={(e) =>
                                updatePlatformBreakdown(i, 'percentage', parseFloat(e.target.value) || 0)
                              }
                              className="w-20 border border-neutral-200 rounded-lg px-2.5 py-1.5 font-commons text-sm focus:outline-none focus:border-indigo-400 transition-colors"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================ */}
        {/* ZAMANLAMA TAB */}
        {/* ============================================ */}
        {activeTab === 'schedule' && (
          <div className="space-y-5">
            <h2 className="text-lg font-commons font-semibold text-[#171717] mb-4">
              Zamanlama
            </h2>

            {/* Start Date */}
            <div>
              <label className="block text-sm font-commons font-medium text-neutral-700 mb-1.5">
                Baslangic Tarihi
              </label>
              <input
                type="date"
                value={formData.startDate || ''}
                onChange={(e) => updateField('startDate', e.target.value)}
                className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 font-commons text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/20 transition-colors"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-sm font-commons font-medium text-neutral-700 mb-1.5">
                Bitis Tarihi
              </label>
              <input
                type="date"
                value={formData.endDate || ''}
                onChange={(e) => updateField('endDate', e.target.value)}
                className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 font-commons text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/20 transition-colors"
              />
              <p className="text-xs font-commons text-neutral-400 mt-1">
                Bos birakirsaniz kampanya surekli olarak calisir
              </p>
            </div>

            {/* Timezone */}
            <div>
              <label className="block text-sm font-commons font-medium text-neutral-700 mb-1.5">
                Zaman Dilimi
              </label>
              <select
                value={formData.timezone || 'Europe/Istanbul'}
                onChange={(e) => updateField('timezone', e.target.value)}
                className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 font-commons text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/20 transition-colors bg-white"
              >
                <option value="Europe/Istanbul">Europe/Istanbul (UTC+3)</option>
                <option value="Europe/London">Europe/London (UTC+0)</option>
                <option value="Europe/Berlin">Europe/Berlin (UTC+1)</option>
                <option value="America/New_York">America/New_York (UTC-5)</option>
                <option value="America/Los_Angeles">America/Los_Angeles (UTC-8)</option>
                <option value="Asia/Dubai">Asia/Dubai (UTC+4)</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="flex items-center justify-end gap-3 pt-2">
        {saveSuccess && (
          <span className="text-sm font-commons text-green-600">
            Degisiklikler kaydedildi
          </span>
        )}
        <button
          onClick={() => navigate(`${basePath}/campaigns/${id}`)}
          className="px-4 py-2.5 font-commons text-sm font-medium text-neutral-700 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
        >
          Iptal
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 font-commons text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Kaydediliyor...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Kaydet
            </>
          )}
        </button>
      </div>
    </div>
  );
};

// ============================================
// PLATFORM TARGETING SECTION (read-only display)
// ============================================

interface PlatformTargetingSectionProps {
  title: string;
  platform: AdPlatform;
  data: any;
  fields: { key: string; label: string }[];
}

const PlatformTargetingSection: React.FC<PlatformTargetingSectionProps> = ({
  title,
  platform,
  data,
  fields,
}) => {
  return (
    <div className="border border-neutral-200 rounded-lg p-4">
      <h3 className="text-sm font-commons font-semibold text-[#171717] mb-3 flex items-center gap-2">
        <span className={`px-2 py-0.5 rounded text-xs ${PLATFORM_COLORS[platform]}`}>
          {PLATFORM_LABELS[platform]}
        </span>
        {title}
      </h3>
      <div className="space-y-3">
        {fields.map(({ key, label }) => {
          const values = data[key];
          if (!values || (Array.isArray(values) && values.length === 0)) return null;

          return (
            <div key={key}>
              <p className="text-xs font-commons font-medium text-neutral-500 mb-1">{label}</p>
              <div className="flex flex-wrap gap-1.5">
                {Array.isArray(values) ? (
                  values.map((v: any, i: number) => (
                    <span
                      key={i}
                      className="px-2 py-1 bg-neutral-100 rounded text-xs font-commons text-neutral-600"
                    >
                      {typeof v === 'object' ? v.text || v.name || JSON.stringify(v) : v}
                    </span>
                  ))
                ) : (
                  <span className="text-sm font-commons text-neutral-600">
                    {String(values)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CampaignEditPage;
