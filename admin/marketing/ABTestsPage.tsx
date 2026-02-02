import React, { useEffect, useState, useCallback } from 'react';
import {
  Plus,
  FlaskConical,
  Trophy,
  Play,
  Square,
  Trash2,
  ChevronDown,
  BarChart3,
  X,
} from 'lucide-react';
import type {
  ABTest,
  ABTestStatus,
  ABTestType,
  ABTestMetric,
  ABTestVariant,
} from '@/shared/types/abTest';
import {
  AB_TEST_STATUS_LABELS,
  AB_TEST_STATUS_COLORS,
  AB_TEST_TYPE_LABELS,
  AB_TEST_TYPE_COLORS,
  AB_TEST_METRIC_LABELS,
} from '@/shared/types/abTest';
import {
  getABTests,
  createABTest,
  startTest,
  stopTest,
  declareWinner,
  deleteABTest,
} from '@/shared/services/abTestService';
import { getCampaigns } from '@/shared/services/marketingService';
import { useProjectScope } from '@/shared/hooks/useProjectScope';
import { useAuth } from '@/contexts/AuthContext';
import type { CampaignSummary } from '@/shared/types/marketing';

// ============================================
// VARIANT BUILDER DEFAULTS
// ============================================

function createEmptyVariant(index: number): Omit<ABTestVariant, 'metrics'> & { metrics?: undefined } {
  return {
    id: `var-${Date.now()}-${index}`,
    name: `Varyant ${String.fromCharCode(65 + index)}`,
    description: '',
    trafficSplit: 50,
    adIds: [],
    metrics: undefined,
  };
}

const DEFAULT_METRICS = {
  impressions: 0,
  clicks: 0,
  conversions: 0,
  spend: 0,
  ctr: 0,
  cpc: 0,
  cpa: 0,
  roas: 0,
};

// ============================================
// CREATE TEST MODAL
// ============================================

interface CreateTestModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  campaigns: CampaignSummary[];
  projectId?: string;
}

const CreateTestModal: React.FC<CreateTestModalProps> = ({
  open,
  onClose,
  onCreated,
  campaigns,
  projectId,
}) => {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [testType, setTestType] = useState<ABTestType>('creative');
  const [winnerMetric, setWinnerMetric] = useState<ABTestMetric>('ctr');
  const [variants, setVariants] = useState<ReturnType<typeof createEmptyVariant>[]>([
    createEmptyVariant(0),
    createEmptyVariant(1),
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const totalSplit = variants.reduce((sum, v) => sum + v.trafficSplit, 0);
  const isValid = name.trim() && campaignId && variants.length >= 2 && totalSplit === 100;

  const addVariant = () => {
    setVariants((prev) => [...prev, createEmptyVariant(prev.length)]);
  };

  const removeVariant = (index: number) => {
    if (variants.length <= 2) return;
    setVariants((prev) => prev.filter((_, i) => i !== index));
  };

  const updateVariant = (index: number, field: string, value: string | number) => {
    setVariants((prev) =>
      prev.map((v, i) => (i === index ? { ...v, [field]: value } : v))
    );
  };

  const handleSubmit = async () => {
    if (!isValid || !user) return;
    setSubmitting(true);
    setError('');

    try {
      const selectedCampaign = campaigns.find((c) => c.id === campaignId);
      await createABTest({
        projectId,
        campaignId,
        campaignName: selectedCampaign?.name || '',
        name: name.trim(),
        status: 'draft',
        testType,
        winnerMetric,
        confidenceLevel: 0,
        startDate: '',
        variants: variants.map((v) => ({
          ...v,
          metrics: DEFAULT_METRICS,
        })),
        createdBy: user.uid,
        createdByName: user.displayName || 'Bilinmeyen',
      });
      onCreated();
      resetForm();
    } catch (err) {
      console.error('Failed to create A/B test:', err);
      setError('Test olusturulurken bir hata olustu.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setName('');
    setCampaignId('');
    setTestType('creative');
    setWinnerMetric('ctr');
    setVariants([createEmptyVariant(0), createEmptyVariant(1)]);
    setError('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <h2 className="text-lg font-commons font-bold text-[#171717]">Yeni A/B Test</h2>
          <button
            onClick={handleClose}
            className="p-1 rounded-lg hover:bg-neutral-100 transition-colors"
          >
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {/* Test Name */}
          <div>
            <label className="block text-sm font-commons font-medium text-[#171717] mb-1.5">
              Test Adi
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Orn: Kreatif A/B Testi - Ocak"
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400"
            />
          </div>

          {/* Campaign */}
          <div>
            <label className="block text-sm font-commons font-medium text-[#171717] mb-1.5">
              Kampanya
            </label>
            <select
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400"
            >
              <option value="">Kampanya secin</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Test Type */}
          <div>
            <label className="block text-sm font-commons font-medium text-[#171717] mb-1.5">
              Test Tipi
            </label>
            <select
              value={testType}
              onChange={(e) => setTestType(e.target.value as ABTestType)}
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400"
            >
              {Object.entries(AB_TEST_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Winner Metric */}
          <div>
            <label className="block text-sm font-commons font-medium text-[#171717] mb-1.5">
              Kazanan Metrik
            </label>
            <select
              value={winnerMetric}
              onChange={(e) => setWinnerMetric(e.target.value as ABTestMetric)}
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400"
            >
              {Object.entries(AB_TEST_METRIC_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Variants */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-commons font-medium text-[#171717]">
                Varyantlar
              </label>
              <button
                type="button"
                onClick={addVariant}
                className="text-xs font-commons text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                + Varyant Ekle
              </button>
            </div>

            <div className="space-y-3">
              {variants.map((variant, index) => (
                <div
                  key={variant.id}
                  className="border border-neutral-200 rounded-lg p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-commons font-semibold text-neutral-500 uppercase">
                      Varyant {String.fromCharCode(65 + index)}
                    </span>
                    {variants.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeVariant(index)}
                        className="text-neutral-400 hover:text-red-500 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={variant.name}
                    onChange={(e) => updateVariant(index, 'name', e.target.value)}
                    placeholder="Varyant adi"
                    className="w-full px-2.5 py-1.5 rounded border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400"
                  />
                  <input
                    type="text"
                    value={variant.description}
                    onChange={(e) => updateVariant(index, 'description', e.target.value)}
                    placeholder="Aciklama"
                    className="w-full px-2.5 py-1.5 rounded border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400"
                  />
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-commons text-neutral-500 whitespace-nowrap">
                      Trafik %
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={variant.trafficSplit}
                      onChange={(e) =>
                        updateVariant(index, 'trafficSplit', Number(e.target.value))
                      }
                      className="w-20 px-2.5 py-1.5 rounded border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400 text-center"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Traffic Split Indicator */}
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-2 rounded-full bg-neutral-100 overflow-hidden flex">
                {variants.map((v, i) => (
                  <div
                    key={v.id}
                    className={`h-full transition-all ${
                      i % 3 === 0
                        ? 'bg-indigo-500'
                        : i % 3 === 1
                          ? 'bg-emerald-500'
                          : 'bg-amber-500'
                    }`}
                    style={{ width: `${v.trafficSplit}%` }}
                  />
                ))}
              </div>
              <span
                className={`text-xs font-commons font-medium ${
                  totalSplit === 100 ? 'text-green-600' : 'text-red-500'
                }`}
              >
                {totalSplit}%
              </span>
            </div>
            {totalSplit !== 100 && (
              <p className="text-xs font-commons text-red-500 mt-1">
                Toplam trafik dagilimi %100 olmalidir.
              </p>
            )}
          </div>

          {error && (
            <p className="text-sm font-commons text-red-600">{error}</p>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-neutral-200">
          <button
            onClick={handleClose}
            className="px-4 py-2 rounded-lg border border-neutral-200 font-commons text-sm text-neutral-600 hover:bg-neutral-50 transition-colors"
          >
            Iptal
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-commons text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Olusturuluyor...' : 'Olustur'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// WINNER DROPDOWN
// ============================================

interface WinnerDropdownProps {
  variants: ABTestVariant[];
  onSelect: (variantId: string) => void;
  disabled?: boolean;
}

const WinnerDropdown: React.FC<WinnerDropdownProps> = ({ variants, onSelect, disabled }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 font-commons text-xs text-neutral-600 hover:bg-neutral-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Trophy className="w-3.5 h-3.5" />
        Kazanan Sec
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-neutral-200 rounded-lg shadow-lg py-1 min-w-[160px]">
            {variants.map((v) => (
              <button
                key={v.id}
                onClick={() => {
                  onSelect(v.id);
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-sm font-commons hover:bg-neutral-50 transition-colors"
              >
                {v.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// ============================================
// TEST CARD
// ============================================

interface TestCardProps {
  test: ABTest;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onDeclareWinner: (id: string, variantId: string) => void;
  onDelete: (id: string) => void;
}

const TestCard: React.FC<TestCardProps> = ({
  test,
  onStart,
  onStop,
  onDeclareWinner,
  onDelete,
}) => {
  const maxImpressions = Math.max(...test.variants.map((v) => v.metrics.impressions), 1);

  return (
    <div className="bg-white rounded-xl border border-neutral-200/50 p-5 hover:shadow-sm transition-all">
      {/* Card Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className="font-commons font-semibold text-[#171717] truncate">
              {test.name}
            </h3>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-commons ${AB_TEST_STATUS_COLORS[test.status]}`}
            >
              {AB_TEST_STATUS_LABELS[test.status]}
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-commons ${AB_TEST_TYPE_COLORS[test.testType]}`}
            >
              {AB_TEST_TYPE_LABELS[test.testType]}
            </span>
          </div>
          {test.campaignName && (
            <p className="text-sm font-commons text-neutral-500 mt-1">
              Kampanya: {test.campaignName}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 ml-4 flex-shrink-0">
          {test.status === 'draft' && (
            <button
              onClick={() => onStart(test.id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 font-commons text-xs hover:bg-blue-100 transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              Baslat
            </button>
          )}
          {test.status === 'running' && (
            <>
              <button
                onClick={() => onStop(test.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-100 text-neutral-600 font-commons text-xs hover:bg-neutral-200 transition-colors"
              >
                <Square className="w-3.5 h-3.5" />
                Durdur
              </button>
              <WinnerDropdown
                variants={test.variants}
                onSelect={(variantId) => onDeclareWinner(test.id, variantId)}
              />
            </>
          )}
          {(test.status === 'draft' || test.status === 'stopped') && (
            <button
              onClick={() => onDelete(test.id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-red-500 font-commons text-xs hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Metric Header */}
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="w-4 h-4 text-neutral-400" />
        <span className="text-xs font-commons text-neutral-500">
          Kazanan Metrik: {AB_TEST_METRIC_LABELS[test.winnerMetric]}
          {test.confidenceLevel > 0 && (
            <> &middot; Guven: %{test.confidenceLevel}</>
          )}
        </span>
      </div>

      {/* Variants */}
      <div className="space-y-3">
        {test.variants.map((variant) => {
          const isWinner = test.winnerId === variant.id;
          const barWidth = maxImpressions > 0
            ? Math.max((variant.metrics.impressions / maxImpressions) * 100, 2)
            : 2;

          return (
            <div
              key={variant.id}
              className={`rounded-lg border p-3 transition-colors ${
                isWinner
                  ? 'border-green-300 bg-green-50/50'
                  : 'border-neutral-100 bg-neutral-50/50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-commons font-medium text-sm text-[#171717]">
                    {variant.name}
                  </span>
                  <span className="text-xs font-commons text-neutral-400">
                    {variant.trafficSplit}%
                  </span>
                  {isWinner && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-commons bg-green-100 text-green-700">
                      <Trophy className="w-3 h-3" />
                      Kazanan
                    </span>
                  )}
                </div>
              </div>

              {/* Traffic Split Bar */}
              <div className="h-1.5 rounded-full bg-neutral-200 mb-2.5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    isWinner ? 'bg-green-500' : 'bg-indigo-400'
                  }`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>

              {/* Metric Values */}
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <p className="text-[10px] font-commons text-neutral-400 uppercase">Gosterim</p>
                  <p className="text-sm font-commons font-semibold text-[#171717]">
                    {variant.metrics.impressions.toLocaleString('tr-TR')}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-commons text-neutral-400 uppercase">Tiklama</p>
                  <p className="text-sm font-commons font-semibold text-[#171717]">
                    {variant.metrics.clicks.toLocaleString('tr-TR')}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-commons text-neutral-400 uppercase">CTR</p>
                  <p className="text-sm font-commons font-semibold text-[#171717]">
                    %{variant.metrics.ctr.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-commons text-neutral-400 uppercase">Donusum</p>
                  <p className="text-sm font-commons font-semibold text-[#171717]">
                    {variant.metrics.conversions.toLocaleString('tr-TR')}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================
// MAIN PAGE
// ============================================

const ABTestsPage: React.FC = () => {
  const { projectId } = useProjectScope();
  const [tests, setTests] = useState<ABTest[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ABTestStatus | ''>('');
  const [typeFilter, setTypeFilter] = useState<ABTestType | ''>('');
  const [modalOpen, setModalOpen] = useState(false);

  const loadTests = useCallback(async () => {
    setLoading(true);
    try {
      const filters: { projectId?: string; status?: ABTestStatus } = {};
      if (projectId) filters.projectId = projectId;
      if (statusFilter) filters.status = statusFilter;
      const result = await getABTests(Object.keys(filters).length ? filters : undefined);
      // Apply client-side type filter (Firestore only supports one inequality/in filter)
      const filtered = typeFilter
        ? result.filter((t) => t.testType === typeFilter)
        : result;
      setTests(filtered);
    } catch (err) {
      console.error('Failed to load A/B tests:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId, statusFilter, typeFilter]);

  const loadCampaigns = useCallback(async () => {
    try {
      const filters = projectId ? { projectId } : undefined;
      const result = await getCampaigns(filters);
      setCampaigns(result.campaigns);
    } catch (err) {
      console.error('Failed to load campaigns:', err);
    }
  }, [projectId]);

  useEffect(() => {
    loadTests();
  }, [loadTests]);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  const handleStart = async (id: string) => {
    try {
      await startTest(id);
      loadTests();
    } catch (err) {
      console.error('Failed to start test:', err);
    }
  };

  const handleStop = async (id: string) => {
    try {
      await stopTest(id);
      loadTests();
    } catch (err) {
      console.error('Failed to stop test:', err);
    }
  };

  const handleDeclareWinner = async (id: string, variantId: string) => {
    try {
      await declareWinner(id, variantId);
      loadTests();
    } catch (err) {
      console.error('Failed to declare winner:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Bu A/B testini silmek istediginize emin misiniz?')) return;
    try {
      await deleteABTest(id);
      loadTests();
    } catch (err) {
      console.error('Failed to delete test:', err);
    }
  };

  const handleCreated = () => {
    setModalOpen(false);
    loadTests();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-commons font-bold text-[#171717]">A/B Testleri</h1>
          <p className="text-sm font-commons text-neutral-500 mt-1">
            Reklam varyantlarinizi test edin ve en iyi performansi bulun
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-commons text-sm"
        >
          <Plus className="w-4 h-4" />
          Yeni Test
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ABTestStatus | '')}
          className="px-3 py-2 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400"
        >
          <option value="">Tum Durumlar</option>
          {Object.entries(AB_TEST_STATUS_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as ABTestType | '')}
          className="px-3 py-2 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400"
        >
          <option value="">Tum Tipler</option>
          {Object.entries(AB_TEST_TYPE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Test List */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tests.length === 0 ? (
        <div className="bg-white rounded-xl border border-neutral-200/50 p-12 text-center">
          <FlaskConical className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
          <p className="font-commons text-neutral-500">Henuz A/B testi bulunmuyor</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tests.map((test) => (
            <TestCard
              key={test.id}
              test={test}
              onStart={handleStart}
              onStop={handleStop}
              onDeclareWinner={handleDeclareWinner}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Create Test Modal */}
      <CreateTestModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={handleCreated}
        campaigns={campaigns}
        projectId={projectId}
      />
    </div>
  );
};

export default ABTestsPage;
