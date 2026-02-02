import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout, Plus, Search, Copy, Trash2, Users, Tag } from 'lucide-react';
import {
  PLATFORM_LABELS,
  PLATFORM_COLORS,
  OBJECTIVE_LABELS,
} from '@/shared/types/marketing';
import type { AdPlatform } from '@/shared/types/marketing';
import {
  getTemplates,
  deleteTemplate,
  incrementUsageCount,
  TEMPLATE_CATEGORY_LABELS,
  TEMPLATE_CATEGORY_COLORS,
} from '@/shared/services/templateService';
import type { CampaignTemplate, TemplateCategory } from '@/shared/services/templateService';
import { useProjectScope } from '@/shared/hooks/useProjectScope';

// ============================================
// PLATFORM FILTRE SECENEKLERI
// ============================================

const PLATFORM_OPTIONS: AdPlatform[] = ['meta', 'google', 'tiktok', 'linkedin', 'email'];

// ============================================
// TEMPLATES PAGE
// ============================================

const TemplatesPage: React.FC = () => {
  const navigate = useNavigate();
  const { basePath } = useProjectScope();

  // State
  const [templates, setTemplates] = useState<CampaignTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<TemplateCategory | ''>('');
  const [platformFilter, setPlatformFilter] = useState<AdPlatform | ''>('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Sablonlari yukle
  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const filters: {
        category?: TemplateCategory;
        platform?: AdPlatform;
        search?: string;
      } = {};

      if (categoryFilter) filters.category = categoryFilter;
      if (platformFilter) filters.platform = platformFilter;
      if (searchQuery.trim()) filters.search = searchQuery.trim();

      const result = await getTemplates(
        Object.keys(filters).length > 0 ? filters : undefined
      );
      setTemplates(result);
    } catch (err) {
      console.error('Sablonlar yuklenirken hata:', err);
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, platformFilter, searchQuery]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Sablon kullan -- usageCount artir ve yeni kampanya sayfasina yonlendir
  const handleUseTemplate = async (template: CampaignTemplate) => {
    try {
      await incrementUsageCount(template.id);
      navigate(`${basePath}/campaigns/new?templateId=${template.id}`);
    } catch (err) {
      console.error('Sablon kullanilirken hata:', err);
      // Hata olsa bile yonlendir
      navigate(`${basePath}/campaigns/new?templateId=${template.id}`);
    }
  };

  // Sablon sil
  const handleDeleteTemplate = async (id: string) => {
    if (!window.confirm('Bu sablonu silmek istediginizden emin misiniz?')) return;

    setDeletingId(id);
    try {
      await deleteTemplate(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      console.error('Sablon silinirken hata:', err);
    } finally {
      setDeletingId(null);
    }
  };

  // Platform filtre toggle
  const handlePlatformToggle = (platform: AdPlatform) => {
    setPlatformFilter((prev) => (prev === platform ? '' : platform));
  };

  // Butce formatlama
  const formatBudget = (amount: number, currency: string) => {
    const symbol = currency === 'TRY' ? 'TL' : currency === 'USD' ? '$' : 'EUR';
    return `${amount.toLocaleString('tr-TR')} ${symbol}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-commons font-bold text-[#171717]">
            Kampanya Sablonlari
          </h1>
          <p className="text-sm font-commons text-neutral-500 mt-1">
            Hazir sablonlardan hizla kampanya olusturun
          </p>
        </div>
        <button
          onClick={() => navigate(`${basePath}/templates/new`)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-commons text-sm"
        >
          <Plus className="w-4 h-4" />
          Yeni Sablon
        </button>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        {/* Search + Category */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Sablon ara..."
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as TemplateCategory | '')}
            className="px-3 py-2 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400"
          >
            <option value="">Tum Kategoriler</option>
            {Object.entries(TEMPLATE_CATEGORY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Platform filter tags */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-commons text-neutral-400">Platform:</span>
          {PLATFORM_OPTIONS.map((platform) => (
            <button
              key={platform}
              onClick={() => handlePlatformToggle(platform)}
              className={`px-3 py-1 rounded-full text-xs font-commons transition-colors ${
                platformFilter === platform
                  ? 'bg-indigo-600 text-white'
                  : `${PLATFORM_COLORS[platform]} hover:opacity-80`
              }`}
            >
              {PLATFORM_LABELS[platform].split(' (')[0]}
            </button>
          ))}
          {platformFilter && (
            <button
              onClick={() => setPlatformFilter('')}
              className="px-2 py-1 rounded-full text-xs font-commons text-neutral-400 hover:text-neutral-600 transition-colors"
            >
              Temizle
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : templates.length === 0 ? (
        <div className="bg-white rounded-xl border border-neutral-200/50 p-12 text-center">
          <Layout className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
          <p className="font-commons text-neutral-500">Henuz sablon bulunmuyor</p>
          <p className="font-commons text-neutral-400 text-sm mt-1">
            Yeni bir sablon olusturun veya mevcut kampanyalarinizdan sablon turetin.
          </p>
        </div>
      ) : (
        /* Template Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <div
              key={template.id}
              className="bg-white rounded-xl border border-neutral-200/50 p-5 hover:shadow-md hover:border-indigo-200 transition-all group"
            >
              {/* Card Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-commons font-semibold text-[#171717] truncate">
                    {template.name}
                  </h3>
                  <span
                    className={`inline-block mt-1.5 px-2 py-0.5 rounded-full text-xs font-commons ${
                      TEMPLATE_CATEGORY_COLORS[template.category]
                    }`}
                  >
                    {TEMPLATE_CATEGORY_LABELS[template.category]}
                  </span>
                </div>
                <button
                  onClick={() => handleDeleteTemplate(template.id)}
                  disabled={deletingId === template.id}
                  className="p-1.5 rounded-lg text-neutral-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                  title="Sablonu sil"
                >
                  {deletingId === template.id ? (
                    <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>

              {/* Description */}
              <p className="text-sm font-commons text-neutral-500 mb-3 line-clamp-2">
                {template.description}
              </p>

              {/* Platform badges */}
              <div className="flex flex-wrap gap-1 mb-3">
                {template.platforms.map((platform) => (
                  <span
                    key={platform}
                    className={`px-1.5 py-0.5 rounded text-xs font-commons ${PLATFORM_COLORS[platform]}`}
                  >
                    {PLATFORM_LABELS[platform].split(' (')[0]}
                  </span>
                ))}
              </div>

              {/* Details */}
              <div className="space-y-1.5 mb-4">
                <div className="flex items-center gap-2 text-xs font-commons text-neutral-500">
                  <Tag className="w-3.5 h-3.5" />
                  <span>{OBJECTIVE_LABELS[template.objective]}</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-commons text-neutral-500">
                  <Copy className="w-3.5 h-3.5" />
                  <span>
                    Onerilen butce:{' '}
                    {formatBudget(
                      template.budgetGuide.suggestedTotal,
                      template.budgetGuide.currency
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs font-commons text-neutral-500">
                  <Users className="w-3.5 h-3.5" />
                  <span>{template.usageCount} kez kullanildi</span>
                </div>
              </div>

              {/* Tags */}
              {template.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-4">
                  {template.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500 text-xs font-commons"
                    >
                      {tag}
                    </span>
                  ))}
                  {template.tags.length > 3 && (
                    <span className="px-2 py-0.5 text-neutral-400 text-xs font-commons">
                      +{template.tags.length - 3}
                    </span>
                  )}
                </div>
              )}

              {/* Action */}
              <button
                onClick={() => handleUseTemplate(template)}
                className="w-full py-2 rounded-lg bg-indigo-600 text-white font-commons text-sm hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
              >
                <Copy className="w-4 h-4" />
                Kullan
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TemplatesPage;
