import React, { useEffect, useState, useMemo } from 'react';
import {
  FileText,
  Plus,
  Download,
  Trash2,
  RefreshCw,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  X,
  FileBarChart,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useProjectScope } from '@/shared/hooks/useProjectScope';
import {
  getReports,
  createReport,
  deleteReport,
} from '@/shared/services/reportService';
import { getCampaigns } from '@/shared/services/marketingService';
import type { MarketingReport, ReportType, ReportFormat, ReportSection } from '@/shared/types/report';
import {
  DEFAULT_REPORT_SECTIONS,
  REPORT_TYPE_LABELS,
  REPORT_STATUS_LABELS,
  REPORT_STATUS_COLORS,
  REPORT_FORMAT_LABELS,
} from '@/shared/types/report';
import type { CampaignSummary } from '@/shared/types/marketing';

// ============================================
// YARDIMCI FONKSIYONLAR
// ============================================

function formatDate(ts: any): string {
  if (!ts) return '-';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function getDefaultDateRange(type: ReportType): { startDate: string; endDate: string } {
  const now = new Date();
  const endDate = now.toISOString().split('T')[0];

  switch (type) {
    case 'weekly': {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { startDate: start.toISOString().split('T')[0], endDate };
    }
    case 'monthly': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      return { startDate: start.toISOString().split('T')[0], endDate };
    }
    case 'quarterly': {
      const start = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      return { startDate: start.toISOString().split('T')[0], endDate };
    }
    default:
      return { startDate: endDate, endDate };
  }
}

// ============================================
// ANA SAYFA BILESENI
// ============================================

const ReportsPage: React.FC = () => {
  const { user } = useAuth();
  const { projectId } = useProjectScope();

  // State
  const [reports, setReports] = useState<MarketingReport[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Modal form state
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState<ReportType>('monthly');
  const [formFormat, setFormFormat] = useState<ReportFormat>('pdf');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formSections, setFormSections] = useState<ReportSection[]>(
    DEFAULT_REPORT_SECTIONS.map((s) => ({ ...s }))
  );
  const [formSelectedCampaigns, setFormSelectedCampaigns] = useState<string[]>([]);
  const [formAllCampaigns, setFormAllCampaigns] = useState(true);

  // Load data
  useEffect(() => {
    loadReports();
    loadCampaigns();
  }, [projectId]);

  // Set default dates when type changes
  useEffect(() => {
    const range = getDefaultDateRange(formType);
    setFormStartDate(range.startDate);
    setFormEndDate(range.endDate);
  }, [formType]);

  const loadReports = async () => {
    setLoading(true);
    try {
      const data = await getReports(projectId);
      setReports(data);
    } catch (err) {
      console.error('Raporlar yuklenemedi:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCampaigns = async () => {
    try {
      const result = await getCampaigns({ projectId });
      setCampaigns(result.campaigns);
    } catch (err) {
      console.error('Kampanyalar yuklenemedi:', err);
    }
  };

  // Stats
  const stats = useMemo(() => {
    const total = reports.length;
    const ready = reports.filter((r) => r.status === 'ready').length;
    const now = new Date();
    const thisMonth = reports.filter((r) => {
      const created = r.createdAt?.toDate ? r.createdAt.toDate() : new Date(r.createdAt as any);
      return (
        created.getMonth() === now.getMonth() &&
        created.getFullYear() === now.getFullYear()
      );
    }).length;
    return { total, ready, thisMonth };
  }, [reports]);

  // Modal handlers
  const openModal = () => {
    setFormTitle('');
    setFormType('monthly');
    setFormFormat('pdf');
    setFormSections(DEFAULT_REPORT_SECTIONS.map((s) => ({ ...s })));
    setFormSelectedCampaigns([]);
    setFormAllCampaigns(true);
    const range = getDefaultDateRange('monthly');
    setFormStartDate(range.startDate);
    setFormEndDate(range.endDate);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
  };

  const toggleSection = (sectionId: string) => {
    setFormSections((prev) =>
      prev.map((s) =>
        s.id === sectionId ? { ...s, included: !s.included } : s
      )
    );
  };

  const toggleCampaign = (campaignId: string) => {
    setFormSelectedCampaigns((prev) =>
      prev.includes(campaignId)
        ? prev.filter((c) => c !== campaignId)
        : [...prev, campaignId]
    );
  };

  // Create report
  const handleCreate = async () => {
    if (!formTitle.trim() || !formStartDate || !formEndDate) return;
    if (!user) return;

    setCreating(true);
    try {
      const reportId = await createReport(
        {
          projectId,
          title: formTitle.trim(),
          type: formType,
          format: formFormat,
          dateRange: { startDate: formStartDate, endDate: formEndDate },
          sections: formSections,
          campaignIds: formAllCampaigns ? undefined : formSelectedCampaigns,
        },
        user.uid,
        user.displayName || user.email || 'Bilinmeyen'
      );

      // Rapor olusturma API'sini cagir
      fetch('/api/marketing/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId,
          projectId,
          dateRange: { startDate: formStartDate, endDate: formEndDate },
          sections: formSections.filter((s) => s.included),
          campaignIds: formAllCampaigns ? undefined : formSelectedCampaigns,
          userId: user.uid,
          userName: user.displayName || user.email || 'Bilinmeyen',
        }),
      }).catch((err) => {
        console.error('Rapor olusturma API hatasi:', err);
      });

      closeModal();
      // Rapor listeyi hemen guncelle (generating durumunda gorunecek)
      await loadReports();
    } catch (err) {
      console.error('Rapor olusturulamadi:', err);
    } finally {
      setCreating(false);
    }
  };

  // Delete report
  const handleDelete = async (id: string) => {
    if (!confirm('Bu raporu silmek istediginizden emin misiniz?')) return;

    setDeletingId(id);
    try {
      await deleteReport(id);
      setReports((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error('Rapor silinemedi:', err);
    } finally {
      setDeletingId(null);
    }
  };

  // Retry generating
  const handleRetry = async (report: MarketingReport) => {
    if (!user) return;

    try {
      fetch('/api/marketing/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId: report.id,
          projectId: report.projectId,
          dateRange: report.dateRange,
          sections: report.sections.filter((s) => s.included),
          userId: user.uid,
          userName: user.displayName || user.email || 'Bilinmeyen',
        }),
      }).catch((err) => {
        console.error('Rapor yeniden olusturma hatasi:', err);
      });

      // Update local state to show generating
      setReports((prev) =>
        prev.map((r) => (r.id === report.id ? { ...r, status: 'generating' as const } : r))
      );
    } catch (err) {
      console.error('Yeniden deneme basarisiz:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-commons font-bold text-[#171717]">Raporlar</h1>
          <p className="text-sm font-commons text-neutral-500 mt-1">
            Pazarlama kampanyalarinizin performans raporlari
          </p>
        </div>
        <button
          onClick={openModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-commons text-sm"
        >
          <Plus className="w-4 h-4" />
          Yeni Rapor Olustur
        </button>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-neutral-200/50 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center">
              <FileBarChart className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-xs font-commons text-neutral-500">Toplam Rapor</p>
              <p className="text-xl font-commons font-bold text-[#171717]">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200/50 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs font-commons text-neutral-500">Hazir Raporlar</p>
              <p className="text-xl font-commons font-bold text-[#171717]">{stats.ready}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200/50 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs font-commons text-neutral-500">Bu Ay</p>
              <p className="text-xl font-commons font-bold text-[#171717]">{stats.thisMonth}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Reports List */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : reports.length === 0 ? (
        <div className="bg-white rounded-xl border border-neutral-200/50 p-12 text-center">
          <FileText className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
          <p className="font-commons text-neutral-500 mb-1">Henuz rapor bulunmuyor</p>
          <p className="font-commons text-neutral-400 text-sm">
            Ilk raporunuzu olusturmak icin yukardaki butonu kullanin
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <div
              key={report.id}
              className="bg-white rounded-xl border border-neutral-200/50 p-5 hover:border-indigo-200 transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-commons font-semibold text-[#171717] truncate">
                      {report.title}
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-commons whitespace-nowrap ${REPORT_STATUS_COLORS[report.status]}`}
                    >
                      {report.status === 'generating' && (
                        <span className="inline-block w-3 h-3 border border-current border-t-transparent rounded-full animate-spin mr-1 align-middle" />
                      )}
                      {REPORT_STATUS_LABELS[report.status]}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-commons bg-indigo-50 text-indigo-600 whitespace-nowrap">
                      {REPORT_TYPE_LABELS[report.type]}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-commons bg-neutral-100 text-neutral-600 whitespace-nowrap">
                      {REPORT_FORMAT_LABELS[report.format]}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm font-commons text-neutral-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {report.dateRange.startDate} - {report.dateRange.endDate}
                    </span>
                    <span>
                      Olusturulma: {formatDate(report.createdAt)}
                    </span>
                    {report.generatedByName && (
                      <span>
                        {report.generatedByName}
                      </span>
                    )}
                  </div>
                  {/* Highlights preview for ready reports */}
                  {report.status === 'ready' && report.highlights && report.highlights.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {report.highlights.slice(0, 2).map((h, i) => (
                        <span
                          key={i}
                          className="text-xs font-commons text-neutral-600 bg-neutral-50 px-2 py-1 rounded"
                        >
                          {h.length > 80 ? h.substring(0, 80) + '...' : h}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 ml-4 shrink-0">
                  {report.status === 'ready' && (
                    <button
                      onClick={() => {
                        // Rapor verilerini JSON olarak indir
                        const blob = new Blob(
                          [JSON.stringify({
                            title: report.title,
                            type: report.type,
                            dateRange: report.dateRange,
                            summary: report.summary,
                            highlights: report.highlights,
                            kpis: report.kpis,
                            campaignResults: report.campaignResults,
                            platformBreakdown: report.platformBreakdown,
                            recommendations: report.recommendations,
                          }, null, 2)],
                          { type: 'application/json' }
                        );
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${report.title.replace(/\s+/g, '_')}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-commons text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Indir
                    </button>
                  )}
                  {report.status === 'failed' && (
                    <button
                      onClick={() => handleRetry(report)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-commons text-amber-600 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Tekrar Dene
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(report.id)}
                    disabled={deletingId === report.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-commons text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                  >
                    {deletingId === report.id ? (
                      <span className="w-3.5 h-3.5 border border-red-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                    Sil
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Report Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={closeModal}
          />

          {/* Modal */}
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
              <h2 className="text-lg font-commons font-bold text-[#171717]">
                Yeni Rapor Olustur
              </h2>
              <button
                onClick={closeModal}
                className="p-1 rounded-lg hover:bg-neutral-100 transition-colors"
              >
                <X className="w-5 h-5 text-neutral-500" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-5 space-y-5">
              {/* Rapor Basligi */}
              <div>
                <label className="block text-sm font-commons font-medium text-[#171717] mb-1.5">
                  Rapor Basligi
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Orn: Ocak 2025 Performans Raporu"
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400"
                />
              </div>

              {/* Rapor Tipi */}
              <div>
                <label className="block text-sm font-commons font-medium text-[#171717] mb-1.5">
                  Rapor Tipi
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(Object.entries(REPORT_TYPE_LABELS) as [ReportType, string][]).map(
                    ([key, label]) => (
                      <button
                        key={key}
                        onClick={() => setFormType(key)}
                        className={`px-3 py-2 rounded-lg text-sm font-commons transition-colors ${
                          formType === key
                            ? 'bg-indigo-600 text-white'
                            : 'bg-neutral-50 text-neutral-600 hover:bg-neutral-100'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Tarih Araligi */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-commons font-medium text-[#171717] mb-1.5">
                    Baslangic Tarihi
                  </label>
                  <input
                    type="date"
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-commons font-medium text-[#171717] mb-1.5">
                    Bitis Tarihi
                  </label>
                  <input
                    type="date"
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400"
                  />
                </div>
              </div>

              {/* Format */}
              <div>
                <label className="block text-sm font-commons font-medium text-[#171717] mb-1.5">
                  Rapor Formati
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.entries(REPORT_FORMAT_LABELS) as [ReportFormat, string][]).map(
                    ([key, label]) => (
                      <button
                        key={key}
                        onClick={() => setFormFormat(key)}
                        className={`px-3 py-2 rounded-lg text-sm font-commons transition-colors ${
                          formFormat === key
                            ? 'bg-indigo-600 text-white'
                            : 'bg-neutral-50 text-neutral-600 hover:bg-neutral-100'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Sections */}
              <div>
                <label className="block text-sm font-commons font-medium text-[#171717] mb-2">
                  Rapor Bolumleri
                </label>
                <div className="space-y-2">
                  {formSections.map((section) => (
                    <label
                      key={section.id}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg bg-neutral-50 hover:bg-neutral-100 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={section.included}
                        onChange={() => toggleSection(section.id)}
                        className="w-4 h-4 rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm font-commons text-[#171717]">
                        {section.title}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Campaign Selector */}
              <div>
                <label className="block text-sm font-commons font-medium text-[#171717] mb-2">
                  Kampanyalar
                </label>

                {/* All campaigns toggle */}
                <label className="flex items-center gap-3 px-3 py-2 rounded-lg bg-neutral-50 hover:bg-neutral-100 cursor-pointer transition-colors mb-2">
                  <input
                    type="checkbox"
                    checked={formAllCampaigns}
                    onChange={(e) => setFormAllCampaigns(e.target.checked)}
                    className="w-4 h-4 rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm font-commons text-[#171717] font-medium">
                    Tum Kampanyalar
                  </span>
                </label>

                {/* Individual campaign selection */}
                {!formAllCampaigns && (
                  <div className="border border-neutral-200 rounded-lg max-h-48 overflow-y-auto">
                    {campaigns.length === 0 ? (
                      <p className="text-sm font-commons text-neutral-400 p-3 text-center">
                        Kampanya bulunamadi
                      </p>
                    ) : (
                      campaigns.map((camp) => (
                        <label
                          key={camp.id}
                          className="flex items-center gap-3 px-3 py-2 hover:bg-neutral-50 cursor-pointer transition-colors border-b border-neutral-100 last:border-b-0"
                        >
                          <input
                            type="checkbox"
                            checked={formSelectedCampaigns.includes(camp.id)}
                            onChange={() => toggleCampaign(camp.id)}
                            className="w-4 h-4 rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-sm font-commons text-[#171717]">
                            {camp.name}
                          </span>
                          <span className="text-xs font-commons text-neutral-400 ml-auto">
                            {camp.totalBudget.toLocaleString()} TL
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                )}
                {!formAllCampaigns && formSelectedCampaigns.length > 0 && (
                  <p className="text-xs font-commons text-neutral-500 mt-1">
                    {formSelectedCampaigns.length} kampanya secildi
                  </p>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-neutral-200">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-sm font-commons text-neutral-600 bg-neutral-100 rounded-lg hover:bg-neutral-200 transition-colors"
              >
                Iptal
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !formTitle.trim() || !formStartDate || !formEndDate}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-commons text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Olusturuluyor...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    Rapor Olustur
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsPage;
