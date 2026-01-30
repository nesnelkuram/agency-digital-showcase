import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  Calendar,
  Clock,
  User,
  Sparkles,
  Edit2,
  Trash2,
  UserPlus,
  MessageSquare,
  Send,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Palette,
  Target,
  TrendingUp,
  Lightbulb,
  RefreshCw,
  Database,
  Zap,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/shared/hooks/usePermission';
import { getBrandLead, updateBrandLead, addNoteToLead } from '@/shared/services/brandLeadService';
import {
  BrandLead,
  LeadStatus,
  LeadPriority,
  LEAD_STATUS_LABELS,
  LEAD_STATUS_COLORS,
  PRIORITY_LABELS,
  SECTOR_LABELS,
} from '@/shared/types/brandLead';
import { isFirebaseConfigured } from '@/lib/firebase/config';
import { PERMISSIONS } from '@/lib/rbac/permissions';
import AnalysisProgressIndicator from './components/AnalysisProgressIndicator';
import ResearchFindings from './components/ResearchFindings';
import DebateView from './components/DebateView';
import PositioningSection from './components/PositioningSection';
import ActionPlanSection from './components/ActionPlanSection';
import EvidenceSummary from './components/EvidenceSummary';

const LeadDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { can } = usePermission();

  const [lead, setLead] = useState<BrandLead | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'wizard' | 'timeline' | 'ai'>('overview');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisPhase, setAnalysisPhase] = useState<'normalizing' | 'researching' | 'analyzing' | 'completed'>('normalizing');
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  // AI Analysis — Multi-Agent Async Pipeline
  const handleAnalyzeWithAI = async (mode: 'full' | 'lite' = 'full') => {
    if (!lead || !user || analyzing) return;

    setAnalyzing(true);
    setAnalyzeError(null);
    setAnalysisPhase('normalizing');

    try {
      // Lite mode: use legacy sync endpoint
      if (mode === 'lite') {
        const response = await fetch('/api/analyze-brand-multi', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contact: lead.contact, sector: lead.sector,
            wizard: lead.wizard, requestedServices: lead.requestedServices,
            leadId: lead.id, mode: 'lite',
          }),
        });
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || `Sunucu hatasi (${response.status})`);
        }
        const data = await response.json();
        const aiAnalysis = { ...data.analysis, analyzedAt: new Date() };
        await updateBrandLead(lead.id, { aiAnalysis }, user.uid, user.displayName || 'Unknown');
        const updatedLead = await getBrandLead(lead.id);
        setLead(updatedLead);
        setActiveTab('ai');
        return;
      }

      // Full mode: async 2-phase pipeline
      // Phase 1: Start — dataNormalizer + DR interaction
      setAnalysisPhase('normalizing');
      const startRes = await fetch('/api/analyze-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact: lead.contact, sector: lead.sector,
          wizard: lead.wizard, requestedServices: lead.requestedServices,
          leadId: lead.id,
        }),
      });
      if (!startRes.ok) {
        const err = await startRes.json().catch(() => ({}));
        throw new Error(err.error || `Baslatma hatasi (${startRes.status})`);
      }
      const startData = await startRes.json();
      setAnalysisPhase('researching');

      // Phase 2: Continue loop — DR poll + pipeline
      let result = startData;
      let researchFindings = null;
      let attempts = 0;
      const MAX_ATTEMPTS = 5; // safety: max 5 continue calls

      while (result.status !== 'completed' && result.status !== 'failed' && attempts < MAX_ATTEMPTS) {
        attempts++;
        const continueRes = await fetch('/api/analyze-continue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            drInteractionId: startData.drInteractionId,
            normalizedData: startData.normalizedData,
            researchFindings,
            input: {
              contact: { name: lead.contact.name, businessName: lead.contact.businessName, email: lead.contact.email },
              sector: lead.sector,
              wizard: { answers: lead.wizard.answers, scores: lead.wizard.scores, stageResults: lead.wizard.stageResults },
              requestedServices: lead.requestedServices,
              leadId: lead.id,
              mode: 'full',
            },
          }),
        });

        if (!continueRes.ok) {
          const err = await continueRes.json().catch(() => ({}));
          throw new Error(err.error || `Pipeline hatasi (${continueRes.status})`);
        }

        result = await continueRes.json();

        if (result.researchFindings) {
          researchFindings = result.researchFindings;
          setAnalysisPhase('analyzing');
        }
      }

      if (result.status === 'completed' && result.analysis) {
        const aiAnalysis = { ...result.analysis, analyzedAt: new Date() };
        await updateBrandLead(lead.id, { aiAnalysis }, user.uid, user.displayName || 'Unknown');
        const updatedLead = await getBrandLead(lead.id);
        setLead(updatedLead);
        setActiveTab('ai');
      } else {
        throw new Error(result.error || 'Pipeline tamamlanamadi');
      }
    } catch (error: any) {
      console.error('AI analysis error:', error);
      setAnalyzeError(error.message || 'Bir hata olustu');
    } finally {
      setAnalyzing(false);
    }
  };

  // Load lead
  useEffect(() => {
    if (!id || !isFirebaseConfigured) {
      setLoading(false);
      return;
    }

    const loadLead = async () => {
      try {
        const leadData = await getBrandLead(id);
        setLead(leadData);
      } catch (error) {
        console.error('Error loading lead:', error);
      } finally {
        setLoading(false);
      }
    };

    loadLead();
  }, [id]);

  // Update status
  const handleStatusChange = async (newStatus: LeadStatus) => {
    if (!lead || !user) return;

    setSaving(true);
    try {
      await updateBrandLead(
        lead.id,
        { status: newStatus },
        user.uid,
        user.displayName || 'Unknown'
      );
      setLead((prev) => prev ? { ...prev, status: newStatus } : null);
    } catch (error) {
      console.error('Error updating status:', error);
    } finally {
      setSaving(false);
    }
  };

  // Update priority
  const handlePriorityChange = async (newPriority: LeadPriority) => {
    if (!lead || !user) return;

    setSaving(true);
    try {
      await updateBrandLead(
        lead.id,
        { priority: newPriority },
        user.uid,
        user.displayName || 'Unknown'
      );
      setLead((prev) => prev ? { ...prev, priority: newPriority } : null);
    } catch (error) {
      console.error('Error updating priority:', error);
    } finally {
      setSaving(false);
    }
  };

  // Add note
  const handleAddNote = async () => {
    if (!lead || !user || !newNote.trim()) return;

    setSaving(true);
    try {
      await addNoteToLead(lead.id, newNote.trim(), user.uid, user.displayName || 'Unknown');
      // Reload lead to get updated timeline
      const updatedLead = await getBrandLead(lead.id);
      setLead(updatedLead);
      setNewNote('');
    } catch (error) {
      console.error('Error adding note:', error);
    } finally {
      setSaving(false);
    }
  };

  // Format date
  const formatDate = (timestamp: any) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!isFirebaseConfigured) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <AlertCircle className="w-12 h-12 text-neutral-300 mb-4" />
        <h3 className="font-ramillas text-xl font-bold text-neutral-700 mb-2">
          Firebase Yapilandirilmadi
        </h3>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#171717] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <XCircle className="w-12 h-12 text-red-300 mb-4" />
        <h3 className="font-ramillas text-xl font-bold text-neutral-700 mb-2">
          Lead bulunamadi
        </h3>
        <button
          onClick={() => navigate('/admin/leads')}
          className="font-grotesk text-sm text-neutral-600 hover:text-[#171717]"
        >
          Listeye don
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admin/leads')}
            className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-neutral-600" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-ramillas font-bold text-[#171717]">
                {lead.contact.businessName}
              </h1>
              <span className={`text-xs font-grotesk font-medium px-2 py-1 rounded-full ${LEAD_STATUS_COLORS[lead.status]}`}>
                {LEAD_STATUS_LABELS[lead.status]}
              </span>
              {lead.aiAnalysis && (
                <span className="text-xs font-grotesk font-medium px-2 py-1 rounded-full bg-purple-100 text-purple-700 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  AI Analiz
                </span>
              )}
            </div>
            <p className="font-grotesk text-neutral-500 mt-1">
              {SECTOR_LABELS[lead.sector]} • {lead.submissionId}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {can(PERMISSIONS.LEADS_AI_ANALYZE) && (
            <>
              {!lead.aiAnalysis ? (
                <motion.button
                  onClick={() => handleAnalyzeWithAI('full')}
                  disabled={analyzing}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-full font-grotesk text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  whileHover={!analyzing ? { scale: 1.02 } : {}}
                  whileTap={!analyzing ? { scale: 0.98 } : {}}
                >
                  {analyzing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {analyzing ? 'Analiz Ediliyor...' : 'Multi-Agent Analiz'}
                </motion.button>
              ) : (
                <motion.button
                  onClick={() => handleAnalyzeWithAI('full')}
                  disabled={analyzing}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-100 text-neutral-700 rounded-full font-grotesk text-sm font-medium hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  whileHover={!analyzing ? { scale: 1.02 } : {}}
                  whileTap={!analyzing ? { scale: 0.98 } : {}}
                >
                  {analyzing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  {analyzing ? 'Analiz Ediliyor...' : 'Yeniden Analiz Et'}
                </motion.button>
              )}
            </>
          )}
          {can(PERMISSIONS.LEADS_CONVERT) && lead.status !== 'won' && (
            <motion.button
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-full font-grotesk text-sm font-medium hover:bg-green-700 transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <CheckCircle2 className="w-4 h-4" />
              Musteriye Donustur
            </motion.button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Contact & Quick Actions */}
        <div className="space-y-8">
          {/* Contact Card */}
          <div className="bg-white rounded-2xl p-7 shadow-sm border border-neutral-100">
            <h3 className="font-ramillas text-lg font-bold text-[#171717] mb-4">
              Iletisim Bilgileri
            </h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#fffceb] flex items-center justify-center">
                  <User className="w-5 h-5 text-[#171717]" />
                </div>
                <div>
                  <p className="font-grotesk font-medium text-[#171717]">
                    {lead.contact.name}
                  </p>
                  <p className="font-grotesk text-xs text-neutral-500">Yetkili</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <a
                    href={`mailto:${lead.contact.email}`}
                    className="font-grotesk text-sm text-blue-600 hover:underline"
                  >
                    {lead.contact.email}
                  </a>
                  <p className="font-grotesk text-xs text-neutral-500">Email</p>
                </div>
              </div>

              {lead.contact.phone && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
                    <Phone className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <a
                      href={`tel:${lead.contact.phone}`}
                      className="font-grotesk text-sm text-green-600 hover:underline"
                    >
                      {lead.contact.phone}
                    </a>
                    <p className="font-grotesk text-xs text-neutral-500">Telefon</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Status & Priority */}
          <div className="bg-white rounded-2xl p-7 shadow-sm border border-neutral-100">
            <h3 className="font-ramillas text-lg font-bold text-[#171717] mb-4">
              Durum
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block font-grotesk text-sm text-neutral-500 mb-2">
                  Durum
                </label>
                <select
                  value={lead.status}
                  onChange={(e) => handleStatusChange(e.target.value as LeadStatus)}
                  disabled={saving || !can(PERMISSIONS.LEADS_EDIT)}
                  className="w-full px-4 py-2 rounded-lg border border-neutral-200 bg-neutral-50 font-grotesk text-sm focus:outline-none focus:border-neutral-400"
                >
                  {Object.entries(LEAD_STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-grotesk text-sm text-neutral-500 mb-2">
                  Oncelik
                </label>
                <select
                  value={lead.priority}
                  onChange={(e) => handlePriorityChange(e.target.value as LeadPriority)}
                  disabled={saving || !can(PERMISSIONS.LEADS_EDIT)}
                  className="w-full px-4 py-2 rounded-lg border border-neutral-200 bg-neutral-50 font-grotesk text-sm focus:outline-none focus:border-neutral-400"
                >
                  {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Requested Services */}
          <div className="bg-white rounded-2xl p-7 shadow-sm border border-neutral-100">
            <h3 className="font-ramillas text-lg font-bold text-[#171717] mb-4">
              Talep Edilen Hizmetler
            </h3>
            {lead.requestedServices.length > 0 ? (
              <div className="space-y-2">
                {lead.requestedServices.map((service) => (
                  <div
                    key={service.id}
                    className="px-3 py-2 bg-neutral-50 rounded-lg font-grotesk text-sm text-neutral-700"
                  >
                    {service.title}
                  </div>
                ))}
              </div>
            ) : (
              <p className="font-grotesk text-sm text-neutral-500">
                Hizmet secilmemis
              </p>
            )}
          </div>
        </div>

        {/* Right Column - Tabs Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Tabs */}
          <div className="flex gap-2 border-b border-neutral-200">
            {[
              { id: 'overview', label: 'Genel Bakis' },
              { id: 'wizard', label: 'Form Verileri' },
              { id: 'timeline', label: 'Timeline' },
              { id: 'ai', label: 'AI Analiz' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-3 font-grotesk text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-[#171717] text-[#171717]'
                    : 'border-transparent text-neutral-500 hover:text-neutral-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-7">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-neutral-50 rounded-lg">
                    <p className="font-grotesk text-xs text-neutral-500 mb-1">Olusturulma</p>
                    <p className="font-grotesk text-sm font-medium text-[#171717]">
                      {formatDate(lead.createdAt)}
                    </p>
                  </div>
                  <div className="p-4 bg-neutral-50 rounded-lg">
                    <p className="font-grotesk text-xs text-neutral-500 mb-1">Son Guncelleme</p>
                    <p className="font-grotesk text-sm font-medium text-[#171717]">
                      {formatDate(lead.updatedAt)}
                    </p>
                  </div>
                  <div className="p-4 bg-neutral-50 rounded-lg">
                    <p className="font-grotesk text-xs text-neutral-500 mb-1">Kaynak</p>
                    <p className="font-grotesk text-sm font-medium text-[#171717]">
                      {lead.source === 'website_wizard' ? 'Website Formu' : lead.source}
                    </p>
                  </div>
                  <div className="p-4 bg-neutral-50 rounded-lg">
                    <p className="font-grotesk text-xs text-neutral-500 mb-1">Form Suresi</p>
                    <p className="font-grotesk text-sm font-medium text-[#171717]">
                      {lead.wizard.completionTime
                        ? `${Math.round(lead.wizard.completionTime / 60000)} dk`
                        : '-'}
                    </p>
                  </div>
                </div>

                {/* Stage Results Summary */}
                <div>
                  <h4 className="font-grotesk font-medium text-[#171717] mb-3">Asama Sonuclari</h4>
                  <div className="space-y-2">
                    {lead.wizard.stageResults.map((result) => (
                      <div
                        key={result.stage}
                        className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg"
                      >
                        <span className="font-grotesk text-sm text-neutral-600">
                          Asama {result.stage + 1}
                        </span>
                        <span className="font-grotesk text-sm font-medium text-[#171717]">
                          {result.title}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'wizard' && (
              <div className="space-y-4">
                <h4 className="font-grotesk font-medium text-[#171717]">Form Cevaplari</h4>
                <pre className="p-4 bg-neutral-50 rounded-lg overflow-x-auto text-xs font-mono">
                  {JSON.stringify(lead.wizard.answers, null, 2)}
                </pre>
              </div>
            )}

            {activeTab === 'timeline' && (
              <div className="space-y-6">
                {/* Add Note */}
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="Not ekle..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    className="flex-1 px-4 py-2 rounded-lg border border-neutral-200 bg-neutral-50 font-grotesk text-sm focus:outline-none focus:border-neutral-400"
                  />
                  <button
                    onClick={handleAddNote}
                    disabled={!newNote.trim() || saving}
                    className="px-4 py-2 bg-[#171717] text-white rounded-lg font-grotesk text-sm disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>

                {/* Timeline Events */}
                <div className="space-y-4">
                  {lead.timeline.slice().reverse().map((event) => (
                    <div key={event.id} className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center flex-shrink-0">
                        <MessageSquare className="w-4 h-4 text-neutral-500" />
                      </div>
                      <div className="flex-1">
                        <p className="font-grotesk text-sm font-medium text-[#171717]">
                          {event.title}
                        </p>
                        {event.description && (
                          <p className="font-grotesk text-sm text-neutral-500 mt-1">
                            {event.description}
                          </p>
                        )}
                        <p className="font-grotesk text-xs text-neutral-400 mt-1">
                          {event.createdByName} • {formatDate(event.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'ai' && (
              <div>
                {analyzing ? (
                  <AnalysisProgressIndicator phase={analysisPhase} />
                ) : lead.aiAnalysis ? (
                  <div className="space-y-8">
                    {/* Pipeline Metadata Badge */}
                    {lead.aiAnalysis.pipelineMetadata && (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-100 text-purple-700 rounded-full font-grotesk text-xs font-medium">
                          <Zap className="w-3 h-3" />
                          Multi-Agent v{lead.aiAnalysis.pipelineMetadata.version}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-neutral-100 text-neutral-600 rounded-full font-grotesk text-xs">
                          {lead.aiAnalysis.pipelineMetadata.agentsRun?.length || 0} agent
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-neutral-100 text-neutral-600 rounded-full font-grotesk text-xs">
                          {lead.aiAnalysis.pipelineMetadata.totalDuration
                            ? `${(lead.aiAnalysis.pipelineMetadata.totalDuration / 1000).toFixed(1)}s`
                            : '-'}
                        </span>
                        {lead.aiAnalysis.pipelineMetadata.researchAvailable && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full font-grotesk text-xs">
                            Web Arastirmasi
                          </span>
                        )}
                        {lead.aiAnalysis.pipelineMetadata.researchMethod && (
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-grotesk text-xs ${
                            lead.aiAnalysis.pipelineMetadata.researchMethod === 'deep-research'
                              ? 'bg-blue-100 text-blue-700'
                              : lead.aiAnalysis.pipelineMetadata.researchMethod === 'grounding'
                                ? 'bg-cyan-100 text-cyan-700'
                                : 'bg-red-100 text-red-700'
                          }`}>
                            {lead.aiAnalysis.pipelineMetadata.researchMethod === 'deep-research'
                              ? 'Deep Research'
                              : lead.aiAnalysis.pipelineMetadata.researchMethod === 'grounding'
                                ? 'Grounding'
                                : 'Arastirma Yok'}
                          </span>
                        )}
                        {lead.aiAnalysis.pipelineMetadata.fallbackUsed && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full font-grotesk text-xs">
                            Fallback
                          </span>
                        )}
                      </div>
                    )}

                    {/* Positioning (Multi-Agent) */}
                    {lead.aiAnalysis.positioning && (
                      <PositioningSection positioning={lead.aiAnalysis.positioning} />
                    )}

                    {/* Brand Personality */}
                    {lead.aiAnalysis.brandPersonality && (
                      <div>
                        <div className="flex items-center gap-2 mb-4">
                          <Sparkles className="w-5 h-5 text-purple-600" />
                          <h4 className="font-ramillas text-lg font-bold text-[#171717]">
                            Marka Kisiligi
                          </h4>
                        </div>
                        <div className="bg-purple-50 rounded-xl p-5 space-y-3">
                          <div>
                            <p className="font-grotesk text-xs text-purple-500 uppercase tracking-wider mb-1">Arketip</p>
                            <p className="font-grotesk font-semibold text-[#171717]">
                              {lead.aiAnalysis.brandPersonality.archetype}
                            </p>
                          </div>
                          {lead.aiAnalysis.brandPersonality.traits && (
                            <div>
                              <p className="font-grotesk text-xs text-purple-500 uppercase tracking-wider mb-1">Ozellikler</p>
                              <div className="flex flex-wrap gap-2">
                                {lead.aiAnalysis.brandPersonality.traits.map((trait: string, i: number) => (
                                  <span key={i} className="px-3 py-1 bg-white rounded-full font-grotesk text-xs text-purple-700 border border-purple-200">
                                    {trait}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <p className="font-grotesk text-xs text-purple-500 uppercase tracking-wider mb-1">Ton</p>
                              <p className="font-grotesk text-sm text-neutral-700">{lead.aiAnalysis.brandPersonality.tone}</p>
                            </div>
                            <div>
                              <p className="font-grotesk text-xs text-purple-500 uppercase tracking-wider mb-1">Ses</p>
                              <p className="font-grotesk text-sm text-neutral-700">{lead.aiAnalysis.brandPersonality.voice}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Sector Research (Multi-Agent) */}
                    {lead.aiAnalysis.sectorResearch && lead.aiAnalysis.sectorResearch.sourcesUsed > 0 && (
                      <ResearchFindings research={lead.aiAnalysis.sectorResearch} />
                    )}

                    {/* Debate (Multi-Agent) */}
                    {lead.aiAnalysis.debate && (
                      <DebateView debate={lead.aiAnalysis.debate} />
                    )}

                    {/* Visual World */}
                    {lead.aiAnalysis.visualWorld && (
                      <div>
                        <div className="flex items-center gap-2 mb-4">
                          <Palette className="w-5 h-5 text-pink-600" />
                          <h4 className="font-ramillas text-lg font-bold text-[#171717]">
                            Gorsel Dunya
                          </h4>
                        </div>
                        <div className="bg-pink-50 rounded-xl p-5 space-y-4">
                          {lead.aiAnalysis.visualWorld.moodKeywords && lead.aiAnalysis.visualWorld.moodKeywords.length > 0 && (
                            <div>
                              <p className="font-grotesk text-xs text-pink-500 uppercase tracking-wider mb-2">Mood Anahtar Kelimeler</p>
                              <div className="flex flex-wrap gap-2">
                                {lead.aiAnalysis.visualWorld.moodKeywords.map((kw: string, i: number) => (
                                  <span key={i} className="px-3 py-1 bg-white rounded-full font-grotesk text-xs text-pink-700 border border-pink-200">
                                    {kw}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {lead.aiAnalysis.visualWorld.colorPalette && lead.aiAnalysis.visualWorld.colorPalette.length > 0 && (
                            <div>
                              <p className="font-grotesk text-xs text-pink-500 uppercase tracking-wider mb-2">Renk Paleti</p>
                              <div className="flex gap-3">
                                {lead.aiAnalysis.visualWorld.colorPalette.map((color: any, i: number) => (
                                  <div key={i} className="text-center">
                                    <div
                                      className="w-12 h-12 rounded-xl shadow-sm border border-neutral-200"
                                      style={{ backgroundColor: color.hex }}
                                    />
                                    <p className="font-grotesk text-[10px] text-neutral-500 mt-1">{color.name}</p>
                                    <p className="font-grotesk text-[10px] text-pink-400">{color.usage}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-3">
                            {lead.aiAnalysis.visualWorld.typographyStyle && (
                              <div>
                                <p className="font-grotesk text-xs text-pink-500 uppercase tracking-wider mb-1">Tipografi</p>
                                <p className="font-grotesk text-sm text-neutral-700">{lead.aiAnalysis.visualWorld.typographyStyle}</p>
                              </div>
                            )}
                            {lead.aiAnalysis.visualWorld.imageryStyle && (
                              <div>
                                <p className="font-grotesk text-xs text-pink-500 uppercase tracking-wider mb-1">Gorsel Stil</p>
                                <p className="font-grotesk text-sm text-neutral-700">{lead.aiAnalysis.visualWorld.imageryStyle}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Content Strategy */}
                    {lead.aiAnalysis.contentStrategy && (
                      <div>
                        <div className="flex items-center gap-2 mb-4">
                          <Target className="w-5 h-5 text-blue-600" />
                          <h4 className="font-ramillas text-lg font-bold text-[#171717]">
                            Icerik Stratejisi
                          </h4>
                        </div>
                        <div className="bg-blue-50 rounded-xl p-5 space-y-4">
                          {lead.aiAnalysis.contentStrategy.pillars && lead.aiAnalysis.contentStrategy.pillars.length > 0 && (
                            <div>
                              <p className="font-grotesk text-xs text-blue-500 uppercase tracking-wider mb-2">Icerik Sutunlari</p>
                              <div className="grid grid-cols-2 gap-2">
                                {lead.aiAnalysis.contentStrategy.pillars.map((pillar: string, i: number) => (
                                  <div key={i} className="px-3 py-2 bg-white rounded-lg font-grotesk text-sm text-neutral-700 border border-blue-100">
                                    {pillar}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {lead.aiAnalysis.contentStrategy.toneGuidelines && lead.aiAnalysis.contentStrategy.toneGuidelines.length > 0 && (
                            <div>
                              <p className="font-grotesk text-xs text-blue-500 uppercase tracking-wider mb-2">Ton Rehberi</p>
                              <ul className="space-y-1">
                                {lead.aiAnalysis.contentStrategy.toneGuidelines.map((g: string, i: number) => (
                                  <li key={i} className="font-grotesk text-sm text-neutral-700 flex items-start gap-2">
                                    <span className="text-blue-400 mt-0.5">&#9679;</span>
                                    {g}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {lead.aiAnalysis.contentStrategy.keyMessages && lead.aiAnalysis.contentStrategy.keyMessages.length > 0 && (
                            <div>
                              <p className="font-grotesk text-xs text-blue-500 uppercase tracking-wider mb-2">Anahtar Mesajlar</p>
                              <ul className="space-y-1">
                                {lead.aiAnalysis.contentStrategy.keyMessages.map((msg: string, i: number) => (
                                  <li key={i} className="font-grotesk text-sm text-neutral-700 flex items-start gap-2">
                                    <span className="text-blue-400 mt-0.5">&#8226;</span>
                                    {msg}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {lead.aiAnalysis.contentStrategy.hashtags && lead.aiAnalysis.contentStrategy.hashtags.length > 0 && (
                            <div>
                              <p className="font-grotesk text-xs text-blue-500 uppercase tracking-wider mb-2">Hashtag Onerileri</p>
                              <div className="flex flex-wrap gap-2">
                                {lead.aiAnalysis.contentStrategy.hashtags.map((tag: string, i: number) => (
                                  <span key={i} className="px-3 py-1 bg-white rounded-full font-grotesk text-xs text-blue-700 border border-blue-200">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* SWOT Analysis */}
                    {lead.aiAnalysis.analysis && (
                      <div>
                        <div className="flex items-center gap-2 mb-4">
                          <TrendingUp className="w-5 h-5 text-green-600" />
                          <h4 className="font-ramillas text-lg font-bold text-[#171717]">
                            Stratejik Analiz
                          </h4>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          {lead.aiAnalysis.analysis.strengths && lead.aiAnalysis.analysis.strengths.length > 0 && (
                            <div className="bg-green-50 rounded-xl p-4">
                              <p className="font-grotesk text-xs text-green-600 uppercase tracking-wider mb-2">Guclu Yanlar</p>
                              <ul className="space-y-1">
                                {lead.aiAnalysis.analysis.strengths.map((s: string, i: number) => (
                                  <li key={i} className="font-grotesk text-sm text-neutral-700 flex items-start gap-2">
                                    <span className="text-green-400 mt-0.5">+</span> {s}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {lead.aiAnalysis.analysis.opportunities && lead.aiAnalysis.analysis.opportunities.length > 0 && (
                            <div className="bg-blue-50 rounded-xl p-4">
                              <p className="font-grotesk text-xs text-blue-600 uppercase tracking-wider mb-2">Firsatlar</p>
                              <ul className="space-y-1">
                                {lead.aiAnalysis.analysis.opportunities.map((o: string, i: number) => (
                                  <li key={i} className="font-grotesk text-sm text-neutral-700 flex items-start gap-2">
                                    <span className="text-blue-400 mt-0.5">&#8594;</span> {o}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {lead.aiAnalysis.analysis.challenges && lead.aiAnalysis.analysis.challenges.length > 0 && (
                            <div className="bg-amber-50 rounded-xl p-4">
                              <p className="font-grotesk text-xs text-amber-600 uppercase tracking-wider mb-2">Zorluklar</p>
                              <ul className="space-y-1">
                                {lead.aiAnalysis.analysis.challenges.map((c: string, i: number) => (
                                  <li key={i} className="font-grotesk text-sm text-neutral-700 flex items-start gap-2">
                                    <span className="text-amber-400 mt-0.5">!</span> {c}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {lead.aiAnalysis.analysis.recommendations && lead.aiAnalysis.analysis.recommendations.length > 0 && (
                            <div className="bg-purple-50 rounded-xl p-4">
                              <p className="font-grotesk text-xs text-purple-600 uppercase tracking-wider mb-2">Oneriler</p>
                              <ul className="space-y-1">
                                {lead.aiAnalysis.analysis.recommendations.map((r: string, i: number) => (
                                  <li key={i} className="font-grotesk text-sm text-neutral-700 flex items-start gap-2">
                                    <span className="text-purple-400 mt-0.5">&#9733;</span> {r}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Data Quality (Multi-Agent) */}
                    {lead.aiAnalysis.dataQuality && (
                      <div>
                        <div className="flex items-center gap-2 mb-4">
                          <Database className="w-5 h-5 text-neutral-500" />
                          <h4 className="font-ramillas text-lg font-bold text-[#171717]">
                            Veri Kalitesi
                          </h4>
                          <span className="ml-auto font-grotesk text-sm font-medium text-neutral-600">
                            %{Math.round((lead.aiAnalysis.dataQuality.completeness || 0) * 100)}
                          </span>
                        </div>
                        <div className="bg-neutral-50 rounded-xl p-5 space-y-3">
                          {/* Progress bar */}
                          <div className="w-full bg-neutral-200 rounded-full h-2">
                            <div
                              className="bg-green-500 h-2 rounded-full transition-all"
                              style={{ width: `${(lead.aiAnalysis.dataQuality.completeness || 0) * 100}%` }}
                            />
                          </div>
                          {lead.aiAnalysis.dataQuality.patterns && lead.aiAnalysis.dataQuality.patterns.length > 0 && (
                            <div>
                              <p className="font-grotesk text-xs text-neutral-500 uppercase tracking-wider mb-1">Tespit Edilen Oruntular</p>
                              <div className="flex flex-wrap gap-1.5">
                                {lead.aiAnalysis.dataQuality.patterns.map((p: string, i: number) => (
                                  <span key={i} className="px-2 py-0.5 bg-white rounded font-grotesk text-xs text-neutral-600 border border-neutral-200">
                                    {p}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {lead.aiAnalysis.dataQuality.contradictions && lead.aiAnalysis.dataQuality.contradictions.length > 0 && (
                            <div>
                              <p className="font-grotesk text-xs text-amber-600 uppercase tracking-wider mb-1">Celiskiler</p>
                              <ul className="space-y-0.5">
                                {lead.aiAnalysis.dataQuality.contradictions.map((c: string, i: number) => (
                                  <li key={i} className="font-grotesk text-xs text-neutral-600">! {c}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {lead.aiAnalysis.dataQuality.missingAreas && lead.aiAnalysis.dataQuality.missingAreas.length > 0 && (
                            <div>
                              <p className="font-grotesk text-xs text-red-500 uppercase tracking-wider mb-1">Eksik Alanlar</p>
                              <ul className="space-y-0.5">
                                {lead.aiAnalysis.dataQuality.missingAreas.map((m: string, i: number) => (
                                  <li key={i} className="font-grotesk text-xs text-neutral-600">- {m}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Action Plan (Multi-Agent v2) */}
                    {lead.aiAnalysis.actionPlan && (
                      <ActionPlanSection actionPlan={lead.aiAnalysis.actionPlan} />
                    )}

                    {/* Evidence Summary (Multi-Agent v2) */}
                    {lead.aiAnalysis.evidenceSummary && (
                      <EvidenceSummary evidenceSummary={lead.aiAnalysis.evidenceSummary} />
                    )}

                    {/* Meta Info */}
                    <div className="pt-4 border-t border-neutral-100">
                      <p className="font-grotesk text-xs text-neutral-400">
                        Analiz: {lead.aiAnalysis.analyzedBy === 'gemini-multi-agent' ? 'Multi-Agent Pipeline' : (lead.aiAnalysis.modelVersion || 'Gemini')} •{' '}
                        {lead.aiAnalysis.analyzedAt ? formatDate(lead.aiAnalysis.analyzedAt) : '-'}
                        {lead.aiAnalysis.confidence != null && ` • Guven: %${Math.round(lead.aiAnalysis.confidence * 100)}`}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <Sparkles className="w-12 h-12 text-purple-200 mx-auto mb-4" />
                    <h3 className="font-ramillas text-xl font-bold text-neutral-700 mb-2">
                      AI Analizi Henuz Yapilmadi
                    </h3>
                    <p className="font-grotesk text-neutral-500 mb-4">
                      5 uzman agent ile detayli marka stratejisi olusturmak icin analizi baslatin.
                    </p>
                    {analyzeError && (
                      <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg inline-flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-500" />
                        <p className="font-grotesk text-sm text-red-600">{analyzeError}</p>
                      </div>
                    )}
                    {can(PERMISSIONS.LEADS_AI_ANALYZE) && (
                      <div className="flex gap-3 justify-center">
                        <button
                          onClick={() => handleAnalyzeWithAI('full')}
                          disabled={analyzing}
                          className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-full font-grotesk text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50"
                        >
                          <Sparkles className="w-4 h-4" />
                          Multi-Agent Analiz
                        </button>
                        <button
                          onClick={() => handleAnalyzeWithAI('lite')}
                          disabled={analyzing}
                          className="inline-flex items-center gap-2 px-6 py-3 bg-neutral-100 text-neutral-700 rounded-full font-grotesk text-sm font-medium hover:bg-neutral-200 transition-colors disabled:opacity-50"
                        >
                          <Zap className="w-4 h-4" />
                          Hizli Analiz
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeadDetailPage;
