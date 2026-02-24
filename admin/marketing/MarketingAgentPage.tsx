import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  Send,
  Loader2,
  FileText,
  ChevronRight,
  Sparkles,
  LayoutDashboard,
  CheckCircle,
  RefreshCw,
  Globe,
  Target,
  Users,
  DollarSign,
  Calendar,
  BarChart3,
  AlertCircle,
  ExternalLink,
  Upload,
  Pause,
  Play,
  TrendingUp,
  XCircle,
  Clock,
  Trash2,
  Image,
  Crosshair,
} from 'lucide-react';
import { authenticatedFetch } from '@/lib/firebase/apiClient';
import { useProjectScope } from '@/shared/hooks/useProjectScope';
import type { MarketingPlanData, PendingPlatformAction, PlatformActionType } from '@/shared/types/marketing';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  actions?: ActionResult[];
  timestamp: number;
}

interface ActionResult {
  type: string;
  success: boolean;
  data?: any;
  error?: string;
}

const SUGGESTED_PROMPTS = [
  'Merhaba, bir pazarlama planı oluşturmak istiyorum',
  'TOFU kampanyası oluştur, 28K TL awareness Meta',
  'MOFU retargeting kampanyası öner, 21K TL bütçe',
  'BOFU dönüşüm kampanyası oluştur Instagram ve Facebook',
];

// ============================================
// Marketing Plan Card Component
// ============================================

interface MarketingPlanCardProps {
  planId: string;
  planData: MarketingPlanData;
  onPublish: () => void;
  publishing: boolean;
  publishResult: { success: boolean; metaResults?: Record<string, any>; errors?: any[] } | null;
}

const MarketingPlanCard: React.FC<MarketingPlanCardProps> = ({
  planId,
  planData,
  onPublish,
  publishing,
  publishResult,
}) => {
  const [expanded, setExpanded] = useState(false);
  const hasMetaPlatform = planData.platforms?.includes('meta');

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-4 rounded-2xl bg-white border border-indigo-100 shadow-sm overflow-hidden"
    >
      {/* Plan Header */}
      <div className="px-5 py-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-indigo-100">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center flex-shrink-0">
              <BarChart3 className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <p className="text-xs font-commons font-medium text-indigo-500 uppercase tracking-wide mb-0.5">Pazarlama Planı Hazır</p>
              <h3 className="text-base font-commons font-bold text-[#171717]">{planData.name}</h3>
              <p className="text-xs font-commons text-neutral-500">{planData.brand?.name} · {planData.brand?.industry}</p>
            </div>
          </div>
          {hasMetaPlatform && !publishResult && (
            <button
              onClick={onPublish}
              disabled={publishing}
              className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-200 disabled:text-neutral-400 text-white font-commons text-sm font-medium transition-all"
            >
              {publishing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Yayınlanıyor...
                </>
              ) : (
                <>
                  <Globe className="w-3.5 h-3.5" />
                  Meta'da Yayınla
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Summary Row */}
      <div className="px-5 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3 border-b border-neutral-100">
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-neutral-400 flex-shrink-0" />
          <div>
            <p className="text-xs text-neutral-400 font-commons">Bütçe</p>
            <p className="text-sm font-commons font-semibold text-[#171717]">
              {planData.budget?.total?.toLocaleString('tr-TR')} {planData.budget?.currency}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-neutral-400 flex-shrink-0" />
          <div>
            <p className="text-xs text-neutral-400 font-commons">Hedef</p>
            <p className="text-sm font-commons font-semibold text-[#171717] capitalize">
              {planData.objectives?.join(', ')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-neutral-400 flex-shrink-0" />
          <div>
            <p className="text-xs text-neutral-400 font-commons">Kitle</p>
            <p className="text-sm font-commons font-semibold text-[#171717]">
              {planData.audience?.ageMin}–{planData.audience?.ageMax} yaş
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-neutral-400 flex-shrink-0" />
          <div>
            <p className="text-xs text-neutral-400 font-commons">Süre</p>
            <p className="text-sm font-commons font-semibold text-[#171717]">
              {planData.timeline?.startDate} – {planData.timeline?.endDate}
            </p>
          </div>
        </div>
      </div>

      {/* Campaigns */}
      <div className="px-5 py-3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 text-sm font-commons font-medium text-indigo-600 hover:text-indigo-800 transition-colors mb-2"
        >
          <ChevronRight className={`w-4 h-4 transition-transform ${expanded ? 'rotate-90' : ''}`} />
          {planData.campaigns?.length || 0} Kampanya · {planData.campaigns?.reduce((s, c: any) => s + (c.adSets?.length || 0), 0)} Reklam Seti
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3 overflow-hidden"
            >
              {planData.campaigns?.map((campaign: any, ci: number) => (
                <div key={ci} className="rounded-xl border border-neutral-100 bg-neutral-50 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-commons font-semibold text-[#171717]">{campaign.name}</p>
                      <p className="text-xs font-commons text-neutral-500 capitalize">
                        {campaign.platform} · {campaign.objective} · {campaign.budget?.toLocaleString('tr-TR')} TL
                      </p>
                    </div>
                    {publishResult?.metaResults?.[campaign.name] && (
                      <div className="flex items-center gap-1 px-2 py-1 bg-green-50 border border-green-200 rounded-lg">
                        <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                        <span className="text-xs font-commons text-green-700">Yayınlandı</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {campaign.adSets?.map((adSet: any, ai: number) => (
                      <div key={ai} className="flex items-start gap-2 text-xs font-commons text-neutral-600 pl-2 border-l-2 border-neutral-200">
                        <div>
                          <span className="font-medium">{adSet.name}</span>
                          <span className="text-neutral-400"> · {adSet.adFormat} · {adSet.dailyBudget?.toLocaleString('tr-TR')} TL/gün</span>
                          {adSet.creativeNotes && (
                            <p className="text-neutral-400 mt-0.5">{adSet.creativeNotes}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* KPIs */}
      {planData.kpis && (
        <div className="px-5 py-3 bg-neutral-50 border-t border-neutral-100 flex items-center gap-6 text-xs font-commons text-neutral-500">
          <span>Hedef Gösterim: <strong className="text-neutral-700">{planData.kpis.impressions?.toLocaleString('tr-TR')}</strong></span>
          <span>Tıklama: <strong className="text-neutral-700">{planData.kpis.clicks?.toLocaleString('tr-TR')}</strong></span>
          <span>Dönüşüm: <strong className="text-neutral-700">{planData.kpis.conversions?.toLocaleString('tr-TR')}</strong></span>
        </div>
      )}

      {/* Publish Result */}
      {publishResult && (
        <div className={`px-5 py-3 border-t ${publishResult.success ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
          {publishResult.success ? (
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-commons font-medium text-green-800">
                  {Object.keys(publishResult.metaResults || {}).length} kampanya Meta'da oluşturuldu (PAUSED)
                </p>
                <p className="text-xs font-commons text-green-600 mt-0.5">
                  Meta Business Manager'da kampanyaları aktif hale getirebilirsiniz.
                </p>
              </div>
              <a
                href="https://business.facebook.com/adsmanager"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-commons hover:bg-green-700 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                Ads Manager
              </a>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-commons font-medium text-red-800">Yayınlama hatası</p>
                {publishResult.errors?.map((e: any, i: number) => (
                  <p key={i} className="text-xs font-commons text-red-600 mt-0.5">{e.campaign}: {e.error}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};

// ============================================
// Pending Action Card Component
// ============================================

const ACTION_ICONS: Record<PlatformActionType, React.FC<{ className?: string }>> = {
  publish_plan: Upload,
  pause_campaign: Pause,
  resume_campaign: Play,
  delete_campaign: Trash2,
  update_meta_budget: DollarSign,
  update_campaign_budget: DollarSign,
  create_meta_ad: Target,
  upload_image: Image,
  pause_adset: Pause,
  resume_adset: Play,
  update_adset_targeting: Crosshair,
  fetch_performance: TrendingUp,
};

const ACTION_TYPE_LABELS: Record<PlatformActionType, string> = {
  publish_plan: 'Plan Yayinla',
  pause_campaign: 'Kampanya Duraklat',
  resume_campaign: 'Kampanya Devam',
  delete_campaign: 'Kampanya Sil',
  update_meta_budget: 'AdSet Butce',
  update_campaign_budget: 'Kampanya Butce',
  create_meta_ad: 'Reklam Olustur',
  upload_image: 'Gorsel Yukle',
  pause_adset: 'AdSet Duraklat',
  resume_adset: 'AdSet Devam',
  update_adset_targeting: 'Hedefleme',
  fetch_performance: 'Performans',
};

interface PendingActionCardProps {
  action: PendingPlatformAction;
  onDecision: (actionId: string, decision: 'approve' | 'reject') => void;
  executing: boolean;
}

const PendingActionCard: React.FC<PendingActionCardProps> = ({ action, onDecision, executing }) => {
  const Icon = ACTION_ICONS[action.type] || Target;
  const isResolved = action.status !== 'pending_approval';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`my-2 rounded-xl border p-3 ${
        action.status === 'completed'
          ? 'bg-green-50 border-green-200'
          : action.status === 'failed'
          ? 'bg-red-50 border-red-200'
          : action.status === 'rejected'
          ? 'bg-neutral-50 border-neutral-200'
          : action.status === 'executing'
          ? 'bg-blue-50 border-blue-200'
          : 'bg-amber-50 border-amber-200'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
          action.status === 'completed' ? 'bg-green-100' :
          action.status === 'failed' ? 'bg-red-100' :
          action.status === 'rejected' ? 'bg-neutral-100' :
          'bg-amber-100'
        }`}>
          <Icon className={`w-4 h-4 ${
            action.status === 'completed' ? 'text-green-600' :
            action.status === 'failed' ? 'text-red-600' :
            action.status === 'rejected' ? 'text-neutral-500' :
            'text-amber-600'
          }`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-commons font-semibold uppercase tracking-wide text-amber-600">
              {ACTION_TYPE_LABELS[action.type] || action.type}
            </span>
            {action.status === 'completed' && (
              <span className="flex items-center gap-1 text-xs font-commons text-green-600">
                <CheckCircle className="w-3 h-3" /> Tamamlandi
              </span>
            )}
            {action.status === 'failed' && (
              <span className="flex items-center gap-1 text-xs font-commons text-red-600">
                <AlertCircle className="w-3 h-3" /> Basarisiz
              </span>
            )}
            {action.status === 'rejected' && (
              <span className="flex items-center gap-1 text-xs font-commons text-neutral-500">
                <XCircle className="w-3 h-3" /> Reddedildi
              </span>
            )}
            {action.status === 'executing' && (
              <span className="flex items-center gap-1 text-xs font-commons text-blue-600">
                <Loader2 className="w-3 h-3 animate-spin" /> Yurutuluyor
              </span>
            )}
          </div>
          {action.description && (
            <p className="text-sm font-commons text-[#171717] mb-1">{action.description}</p>
          )}
          {action.impact && (
            <p className="text-xs font-commons text-neutral-500 mb-2">{action.impact}</p>
          )}
          {action.result?.error && (
            <p className="text-xs font-commons text-red-600 mb-2">Hata: {action.result.error}</p>
          )}
          {!isResolved && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onDecision(action.id, 'approve')}
                disabled={executing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 disabled:bg-neutral-300 text-white text-xs font-commons font-medium transition-colors"
              >
                {executing ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                Onayla
              </button>
              <button
                onClick={() => onDecision(action.id, 'reject')}
                disabled={executing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 disabled:bg-neutral-50 text-neutral-600 text-xs font-commons font-medium transition-colors"
              >
                Reddet
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

const MarketingAgentPage: React.FC = () => {
  const { projectId, basePath } = useProjectScope();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showStrategyModal, setShowStrategyModal] = useState(false);
  const [strategyText, setStrategyText] = useState('');
  const [savedStrategy, setSavedStrategy] = useState('');
  const [savingStrategy, setSavingStrategy] = useState(false);

  // Marketing plan state
  const [currentPlan, setCurrentPlan] = useState<{ planId: string; planData: MarketingPlanData } | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<{ success: boolean; metaResults?: Record<string, any>; errors?: any[] } | null>(null);

  // Pending platform actions
  const [pendingActions, setPendingActions] = useState<PendingPlatformAction[]>([]);
  const [executingActionId, setExecutingActionId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Auto-start session on mount
  useEffect(() => {
    if (!sessionId && !starting) {
      startSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startSession = async (strategyContext?: string) => {
    setStarting(true);
    setError(null);
    try {
      const res = await authenticatedFetch('/api/marketing/agent-start', {
        method: 'POST',
        body: JSON.stringify({ projectId: projectId || null, strategyContext: strategyContext || null }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Oturum başlatılamadı (${res.status})`);
      }
      const data = await res.json();
      setSessionId(data.sessionId);
      // Welcome message
      setMessages([{
        role: 'assistant',
        content: savedStrategy || strategyContext
          ? 'Merhaba! Strateji bağlamını aldım. Kampanya oluşturma, bütçe yönetimi veya performans analizi hakkında sormak istediğin bir şey var mı?'
          : 'Merhaba! Ben Marketing AI Ajanınım. Meta Ads kampanyaları oluşturabilir, bütçe yönetebilir ve performans analizi yapabilirim. "Strateji Yükle" butonuyla strateji bağlamı ekleyebilir veya hemen sorularınızı sorabilirsiniz.',
        timestamp: Date.now(),
      }]);
    } catch (err: any) {
      setError(err.message || 'Bağlantı hatası');
    } finally {
      setStarting(false);
    }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || !sessionId || loading) return;

    const userMsg: Message = { role: 'user', content: text.trim(), timestamp: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const res = await authenticatedFetch('/api/marketing/agent-chat', {
        method: 'POST',
        body: JSON.stringify({ sessionId, message: text.trim() }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Yanıt alınamadı (${res.status})`);
      }
      const data = await res.json();
      const assistantMsg: Message = {
        role: 'assistant',
        content: data.reply,
        actions: data.results || [],
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);

      // Check for marketing plan in action results
      const planResult = (data.results || []).find(
        (r: ActionResult) => r.type === 'marketing_plan_created' && r.success && r.data?.planId
      );
      if (planResult) {
        setCurrentPlan({ planId: planResult.data.planId, planData: planResult.data.planData });
        setPublishResult(null);
      }

      // Collect new pending actions
      if (data.pendingActions && data.pendingActions.length > 0) {
        setPendingActions((prev) => [...prev, ...data.pendingActions]);
      }
    } catch (err: any) {
      setError(err.message || 'İstek başarısız');
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleSaveStrategy = async () => {
    setSavingStrategy(true);
    setSavedStrategy(strategyText);
    setShowStrategyModal(false);
    // Restart session with new strategy
    setMessages([]);
    setSessionId(null);
    await startSession(strategyText);
    setSavingStrategy(false);
  };

  const handlePublishPlan = async () => {
    if (!currentPlan || publishing) return;
    setPublishing(true);
    setPublishResult(null);
    try {
      const res = await authenticatedFetch('/api/marketing/publish-plan', {
        method: 'POST',
        body: JSON.stringify({ planId: currentPlan.planId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Yayınlama başarısız (${res.status})`);
      }
      setPublishResult({
        success: data.success,
        metaResults: data.metaResults,
        errors: data.errors,
      });
    } catch (err: any) {
      setPublishResult({ success: false, errors: [{ campaign: 'Genel', error: err.message }] });
    } finally {
      setPublishing(false);
    }
  };

  const handleActionDecision = async (actionId: string, decision: 'approve' | 'reject') => {
    if (!sessionId || executingActionId) return;
    setExecutingActionId(actionId);

    // Optimistically update to executing / rejected
    setPendingActions((prev) =>
      prev.map((a) => a.id === actionId ? { ...a, status: decision === 'approve' ? 'executing' : 'rejected' } as PendingPlatformAction : a)
    );

    try {
      const res = await authenticatedFetch('/api/marketing/agent-execute-action', {
        method: 'POST',
        body: JSON.stringify({ sessionId, actionId, decision }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Istek basarisiz (${res.status})`);
      }

      // Update action status from server response
      setPendingActions((prev) =>
        prev.map((a) =>
          a.id === actionId ? { ...a, status: data.status, result: data.result, resolvedAt: Date.now() } as PendingPlatformAction : a
        )
      );

      // Add result message to chat
      if (data.message) {
        setMessages((prev) => [...prev, {
          role: 'assistant',
          content: data.message,
          timestamp: Date.now(),
        }]);
      }
    } catch (err: any) {
      setPendingActions((prev) =>
        prev.map((a) =>
          a.id === actionId ? { ...a, status: 'failed', result: { error: err.message } } as PendingPlatformAction : a
        )
      );
    } finally {
      setExecutingActionId(null);
    }
  };

  const proposalResults = messages
    .flatMap((m) => m.actions || [])
    .filter((a) => a.type === 'create_proposal' && a.success && a.data?.proposalId);

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-h-[900px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
            <Bot className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-commons font-bold text-[#171717]">Marketing AI Ajan</h1>
            <p className="text-xs font-commons text-neutral-500">
              {savedStrategy ? 'Strateji yüklendi' : 'Kampanya oluştur, bütçe yönet, analiz et'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setStrategyText(savedStrategy); setShowStrategyModal(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 font-commons text-sm hover:bg-indigo-100 transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            Strateji Yükle
          </button>
          <Link
            to={`${basePath}/proposals`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 font-commons text-sm text-neutral-600 hover:bg-neutral-50 transition-colors"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            Öneriler
          </Link>
        </div>
      </div>

      {/* Action Cards (proposal results) */}
      <AnimatePresence>
        {proposalResults.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-3 flex gap-2 flex-wrap"
          >
            {proposalResults.slice(-3).map((r, i) => (
              <motion.div
                key={`${r.data.proposalId}-${i}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-xl text-sm"
              >
                <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                <span className="font-commons text-green-800 text-xs">{r.data.name}</span>
                <Link
                  to={`${basePath}/proposals`}
                  className="flex items-center gap-0.5 text-green-700 hover:text-green-900 font-commons text-xs font-medium"
                >
                  Görüntüle <ChevronRight className="w-3 h-3" />
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto rounded-2xl bg-white/60 border border-white/50 p-4 space-y-3">
        {starting && (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3 text-neutral-400">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="font-commons text-sm">Ajan başlatılıyor...</span>
            </div>
          </div>
        )}

        {!starting && messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-100 mx-auto flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-indigo-500" />
              </div>
              <p className="font-commons text-sm text-neutral-500">Bir mesaj yazın veya öneri seçin</p>
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex gap-2 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-indigo-600" />
                </div>
              )}
              <div
                className={`px-4 py-2.5 rounded-2xl font-commons text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-tr-sm'
                    : 'bg-white/80 border border-white/60 text-[#171717] rounded-tl-sm shadow-sm'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          </motion.div>
        ))}

        {/* Pending Action Cards */}
        {pendingActions.length > 0 && (
          <div className="space-y-1">
            {pendingActions.map((action) => (
              <PendingActionCard
                key={action.id}
                action={action}
                onDecision={handleActionDecision}
                executing={executingActionId === action.id}
              />
            ))}
          </div>
        )}

        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="flex gap-2 items-center">
              <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <Bot className="w-3.5 h-3.5 text-indigo-600" />
              </div>
              <div className="px-4 py-2.5 rounded-2xl rounded-tl-sm bg-white/80 border border-white/60 shadow-sm">
                <div className="flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-sm font-commons text-red-700">
          {error}
        </div>
      )}

      {/* Marketing Plan Card */}
      <AnimatePresence>
        {currentPlan && (
          <MarketingPlanCard
            planId={currentPlan.planId}
            planData={currentPlan.planData as MarketingPlanData}
            onPublish={handlePublishPlan}
            publishing={publishing}
            publishResult={publishResult}
          />
        )}
      </AnimatePresence>

      {/* Suggested Prompts (only when empty) */}
      {!starting && messages.length <= 1 && !loading && (
        <div className="mt-3 flex flex-wrap gap-2">
          {SUGGESTED_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              onClick={() => sendMessage(prompt)}
              className="px-3 py-1.5 bg-white/70 border border-white/60 rounded-xl text-xs font-commons text-neutral-600 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 transition-all"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="mt-3 flex gap-2 items-end">
        <div className="flex-1 relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!sessionId || loading || starting}
            placeholder="Mesajınızı yazın... (Enter ile gönder)"
            rows={1}
            className="w-full resize-none px-4 py-3 rounded-2xl bg-white/70 border border-white/60 font-commons text-sm focus:outline-none focus:bg-white/90 focus:border-indigo-200 placeholder:text-neutral-400 transition-all disabled:opacity-50"
            style={{ minHeight: '48px', maxHeight: '120px' }}
          />
        </div>
        <button
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || !sessionId || loading || starting}
          className="flex-shrink-0 w-12 h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-neutral-200 disabled:text-neutral-400 text-white transition-all flex items-center justify-center"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Strategy Modal */}
      <AnimatePresence>
        {showStrategyModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-50"
              onClick={() => setShowStrategyModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-indigo-600" />
                  </div>
                  <h2 className="text-lg font-commons font-bold text-[#171717]">Strateji Bağlamı</h2>
                </div>
                <p className="text-sm font-commons text-neutral-500 mb-3">
                  Kampanya stratejinizi yapıştırın. Ajan bu bağlamı kullanarak daha isabetli öneriler sunacak.
                </p>
                <textarea
                  value={strategyText}
                  onChange={(e) => setStrategyText(e.target.value)}
                  placeholder="Örnek: TOFU 28K TL farkındalık, MOFU 21K TL retargeting, BOFU 21K TL dönüşüm hedefli..."
                  rows={8}
                  className="w-full resize-none px-4 py-3 rounded-xl border border-neutral-200 font-commons text-sm focus:outline-none focus:border-indigo-300 transition-all"
                />
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    onClick={() => setShowStrategyModal(false)}
                    className="px-4 py-2 rounded-xl font-commons text-sm text-neutral-600 hover:bg-neutral-100 transition-colors"
                  >
                    İptal
                  </button>
                  <button
                    onClick={handleSaveStrategy}
                    disabled={!strategyText.trim() || savingStrategy}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white font-commons text-sm hover:bg-indigo-700 disabled:bg-neutral-200 disabled:text-neutral-400 transition-colors"
                  >
                    {savingStrategy ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    Kaydet ve Yeniden Başlat
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MarketingAgentPage;
