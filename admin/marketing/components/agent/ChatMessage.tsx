import React from 'react';
import { motion } from 'framer-motion';
import { Bot, Wrench } from 'lucide-react';
import AccountSelector from './AccountSelector';
import CampaignGrid from './CampaignGrid';
import CampaignDetail from './CampaignDetail';
import PerformanceWidget from './PerformanceWidget';
import ApprovalCard from './ApprovalCard';
import StrategyQuestionnaire from './StrategyQuestionnaire';
import FunnelPlan from './FunnelPlan';
import CampaignStructure from './CampaignStructure';
import BudgetAllocationV3 from './BudgetAllocationV3';
import AudienceTargetingV3 from './AudienceTargetingV3';
import StrategySummary from './StrategySummary';
import TargetingSearchResults from './TargetingSearchResults';
import GeoLocationResults from './GeoLocationResults';
import AudienceEstimateWidget from './AudienceEstimateWidget';
import CompetitorAdsGrid from './CompetitorAdsGrid';
import AdSetGrid from './AdSetGrid';
import AdSetDetailCard from './AdSetDetailCard';
import AdGrid from './AdGrid';
import AdDetailCard from './AdDetailCard';
import ImageUploadResult from './ImageUploadResult';
import CreativePreviewCard from './CreativePreviewCard';
import CreativeGrid from './CreativeGrid';
import ABTestResultsCard from './ABTestResultsCard';
import PerformanceSummaryCard from './PerformanceSummaryCard';
import PerformanceBreakdownCard from './PerformanceBreakdownCard';
import BudgetOverviewCard from './BudgetOverviewCard';
import ReportListCard from './ReportListCard';
import OptimizationSuggestionsCard from './OptimizationSuggestionsCard';
import BudgetForecastCard from './BudgetForecastCard';
import AutomationRuleListCard from './AutomationRuleListCard';
import AutomationRuleCard from './AutomationRuleCard';
import RuleExecutionLogCard from './RuleExecutionLogCard';
import CompetitorListCard from './CompetitorListCard';
import CompetitorAnalysisCard from './CompetitorAnalysisCard';
import type { AgentV2Message, AgentV2MessagePart } from '@/shared/types/marketing';

interface ChatMessageProps {
  message: AgentV2Message;
  onSendMessage: (text: string) => void;
  onApprove: (actionId: string) => void;
  onReject: (actionId: string) => void;
  isStreaming?: boolean;
}

const TOOL_LABELS: Record<string, string> = {
  list_connected_accounts: 'Hesaplar yukleniyor...',
  get_account_campaigns: 'Kampanyalar getiriliyor...',
  get_campaign_details: 'Kampanya detayi yukleniyor...',
  get_campaign_performance: 'Performans verileri aliniyor...',
  sync_campaigns: 'Kampanyalar senkronize ediliyor...',
  create_marketing_plan: 'Pazarlama plani olusturuluyor...',
  get_marketing_stats: 'Istatistikler yukleniyor...',
  ask_strategy_questions: 'Strateji formu hazirlaniyor...',
  show_funnel_plan: 'Huni plani olusturuluyor...',
  show_campaign_structure: 'Kampanya yapisi hazirlaniyor...',
  ask_budget_allocation: 'Butce formu hazirlaniyor...',
  ask_audience_targeting: 'Kitle hedefleme formu hazirlaniyor...',
  show_strategy_summary: 'Strateji ozeti hazirlaniyor...',
  search_interests: 'Ilgi alanlari araniyor...',
  search_behaviors: 'Davranislar getiriliyor...',
  search_demographics: 'Demografikler getiriliyor...',
  search_geo_locations: 'Konumlar araniyor...',
  estimate_audience_size: 'Kitle buyuklugu hesaplaniyor...',
  search_ads_archive: 'Reklam arsivi taraniyor...',
  get_adsets: 'Reklam setleri getiriliyor...',
  get_adset_details: 'Reklam seti detaylari yukleniyor...',
  get_ads: 'Reklamlar getiriliyor...',
  get_ad_details: 'Reklam detaylari yukleniyor...',
  // Faz 2A — Creative & Image
  upload_ad_image: 'Gorsel yukleniyor...',
  create_ad_creative: 'Creative olusturuluyor...',
  get_ad_creatives: 'Creative listesi getiriliyor...',
  get_creative_details: 'Creative detaylari yukleniyor...',
  // Faz 2B — Write tools
  create_campaign_v2: 'Kampanya olusturuluyor...',
  create_adset_v2: 'Reklam seti olusturuluyor...',
  create_ad_v2: 'Reklam olusturuluyor...',
  update_campaign_v2: 'Kampanya guncelleniyor...',
  update_adset_v2: 'Reklam seti guncelleniyor...',
  update_ad_v2: 'Reklam guncelleniyor...',
  create_budget_schedule: 'Butce plani olusturuluyor...',
  // Faz 3 — A/B Testing
  create_ab_test: 'A/B testi hazirlaniyor...',
  get_ab_test_results: 'Test sonuclari yukleniyor...',
  duplicate_adset: 'Reklam seti kopyalaniyor...',
  // Faz 4 — Performance & Reporting
  get_performance_summary: 'Performans ozeti hazirlaniyor...',
  get_performance_breakdown: 'Performans kirilimi yukleniyor...',
  get_budget_overview: 'Butce durumu kontrol ediliyor...',
  get_budget_alerts: 'Butce uyarilari kontrol ediliyor...',
  get_reports_list: 'Raporlar listeleniyor...',
  generate_report: 'Rapor olusturuluyor...',
  get_optimization_suggestions: 'Optimizasyon onerileri hazirlaniyor...',
  forecast_budget: 'Butce tahmini yapiliyor...',
  // Faz 5 — Automation Rules
  get_automation_rules: 'Otomasyon kurallari yukleniyor...',
  get_rule_execution_log: 'Kural gecmisi yukleniyor...',
  create_automation_rule: 'Otomasyon kurali olusturuluyor...',
  update_automation_rule: 'Otomasyon kurali guncelleniyor...',
  delete_automation_rule: 'Otomasyon kurali siliniyor...',
  // Faz 6 — Competitor Intelligence
  get_competitors: 'Rakipler yukleniyor...',
  get_competitor_analysis: 'Rakip analizi yukleniyor...',
  add_competitor: 'Rakip ekleniyor...',
  analyze_competitor: 'Rakip analizi yapiliyor...',
};

const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  onSendMessage,
  onApprove,
  onReject,
  isStreaming,
}) => {
  const isUser = message.role === 'user';

  // Filter out empty messages
  const parts = message.parts || [];
  const hasParts = parts.length > 0 && parts.some(p => {
    if (p.type === 'text') return p.content?.length > 0;
    return true;
  });

  if (!hasParts && !isStreaming) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`flex gap-2 max-w-[90%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {!isUser && (
          <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Bot className="w-3.5 h-3.5 text-indigo-600" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          {parts.map((part, idx) => renderPart(part, idx, {
            isUser,
            onSendMessage,
            onApprove,
            onReject,
          }))}
        </div>
      </div>
    </motion.div>
  );
};

function renderPart(
  part: AgentV2MessagePart,
  index: number,
  opts: {
    isUser: boolean;
    onSendMessage: (text: string) => void;
    onApprove: (actionId: string) => void;
    onReject: (actionId: string) => void;
  }
) {
  switch (part.type) {
    case 'text':
      if (!part.content) return null;
      return (
        <div
          key={index}
          className={`px-4 py-2.5 rounded-2xl font-commons text-sm leading-relaxed ${
            opts.isUser
              ? 'bg-indigo-600 text-white rounded-tr-sm'
              : 'bg-white/80 border border-white/60 text-[#171717] rounded-tl-sm shadow-sm'
          }`}
        >
          <p className="whitespace-pre-wrap">{part.content}</p>
        </div>
      );

    case 'tool_call':
      return (
        <div key={index} className="my-1 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-50 border border-neutral-100">
          <Wrench className="w-3 h-3 text-neutral-400 animate-spin" />
          <span className="text-xs font-commons text-neutral-500">
            {TOOL_LABELS[part.name] || `${part.name} calisiyor...`}
          </span>
        </div>
      );

    case 'tool_result': {
      const data = part.data as any;
      if (!data) return null;

      // Render component based on tool name or component hint
      const component = part.component || '';

      if (component === 'AccountSelector' || part.name === 'list_connected_accounts') {
        return (
          <AccountSelector
            key={index}
            accounts={data.accounts || []}
            onSelect={(acc) => opts.onSendMessage(`${acc.accountName || acc.accountId} hesabini sectim`)}
          />
        );
      }

      if (component === 'CampaignGrid' || part.name === 'get_account_campaigns') {
        return (
          <CampaignGrid
            key={index}
            campaigns={data.campaigns || []}
            onSelect={(c) => opts.onSendMessage(`${c.name} kampanyasi hakkinda bilgi ver`)}
          />
        );
      }

      if (component === 'CampaignDetail' || part.name === 'get_campaign_details') {
        return <CampaignDetail key={index} campaign={data} />;
      }

      if (component === 'PerformanceWidget' || part.name === 'get_campaign_performance') {
        if (data.insights) {
          return (
            <PerformanceWidget
              key={index}
              data={data.insights}
              datePreset={data.datePreset}
            />
          );
        }
      }

      // V3 Interactive Strategy Components
      if (component === 'StrategyQuestionnaire') {
        return <StrategyQuestionnaire key={index} data={data} onSendMessage={opts.onSendMessage} />;
      }

      if (component === 'FunnelPlan') {
        return <FunnelPlan key={index} data={data} onSendMessage={opts.onSendMessage} />;
      }

      if (component === 'CampaignStructure') {
        return <CampaignStructure key={index} data={data} onSendMessage={opts.onSendMessage} />;
      }

      if (component === 'BudgetAllocationV3') {
        return <BudgetAllocationV3 key={index} data={data} onSendMessage={opts.onSendMessage} />;
      }

      if (component === 'AudienceTargetingV3') {
        return <AudienceTargetingV3 key={index} data={data} onSendMessage={opts.onSendMessage} />;
      }

      if (component === 'StrategySummary') {
        return <StrategySummary key={index} data={data} onSendMessage={opts.onSendMessage} />;
      }

      // Research & Targeting Components
      if (component === 'TargetingSearchResults' || part.name === 'search_interests' || part.name === 'search_behaviors' || part.name === 'search_demographics') {
        return <TargetingSearchResults key={index} data={data} onSendMessage={opts.onSendMessage} />;
      }

      if (component === 'GeoLocationResults' || part.name === 'search_geo_locations') {
        return <GeoLocationResults key={index} data={data} onSendMessage={opts.onSendMessage} />;
      }

      if (component === 'AudienceEstimateWidget' || part.name === 'estimate_audience_size') {
        return <AudienceEstimateWidget key={index} data={data} />;
      }

      if (component === 'CompetitorAdsGrid' || part.name === 'search_ads_archive') {
        return <CompetitorAdsGrid key={index} data={data} />;
      }

      // AdSet & Ad Components
      if (component === 'AdSetGrid' || part.name === 'get_adsets') {
        return <AdSetGrid key={index} data={data} onSendMessage={opts.onSendMessage} />;
      }

      if (component === 'AdSetDetailCard' || part.name === 'get_adset_details') {
        return <AdSetDetailCard key={index} data={data} />;
      }

      if (component === 'AdGrid' || part.name === 'get_ads') {
        return <AdGrid key={index} data={data} onSendMessage={opts.onSendMessage} />;
      }

      if (component === 'AdDetailCard' || part.name === 'get_ad_details') {
        return <AdDetailCard key={index} data={data} />;
      }

      // Creative & Image Components (Faz 2A)
      if (component === 'ImageUploadResult' || part.name === 'upload_ad_image') {
        return <ImageUploadResult key={index} data={data} onSendMessage={opts.onSendMessage} />;
      }

      if (component === 'CreativePreviewCard' || part.name === 'create_ad_creative' || part.name === 'get_creative_details') {
        return <CreativePreviewCard key={index} data={data} onSendMessage={opts.onSendMessage} />;
      }

      if (component === 'CreativeGrid' || part.name === 'get_ad_creatives') {
        return <CreativeGrid key={index} data={data} onSendMessage={opts.onSendMessage} />;
      }

      // A/B Test Results (Faz 3)
      if (component === 'ABTestResultsCard' || part.name === 'get_ab_test_results') {
        return <ABTestResultsCard key={index} data={data} />;
      }

      // Performance & Reporting (Faz 4)
      if (component === 'PerformanceSummaryCard' || part.name === 'get_performance_summary') {
        return <PerformanceSummaryCard key={index} data={data} />;
      }

      if (component === 'PerformanceBreakdownCard' || part.name === 'get_performance_breakdown') {
        return <PerformanceBreakdownCard key={index} data={data} />;
      }

      if (component === 'BudgetOverviewCard' || part.name === 'get_budget_overview' || part.name === 'get_budget_alerts') {
        return <BudgetOverviewCard key={index} data={data} />;
      }

      if (component === 'ReportListCard' || part.name === 'get_reports_list') {
        return <ReportListCard key={index} data={data} onSendMessage={opts.onSendMessage} />;
      }

      if (component === 'OptimizationSuggestionsCard' || part.name === 'get_optimization_suggestions') {
        return <OptimizationSuggestionsCard key={index} data={data} />;
      }

      if (component === 'BudgetForecastCard' || part.name === 'forecast_budget') {
        return <BudgetForecastCard key={index} data={data} />;
      }

      // Automation Rules (Faz 5)
      if (component === 'AutomationRuleListCard' || part.name === 'get_automation_rules') {
        return <AutomationRuleListCard key={index} data={data} onSendMessage={opts.onSendMessage} />;
      }

      if (component === 'AutomationRuleCard') {
        return <AutomationRuleCard key={index} data={data} />;
      }

      if (component === 'RuleExecutionLogCard' || part.name === 'get_rule_execution_log') {
        return <RuleExecutionLogCard key={index} data={data} />;
      }

      // Competitor Intelligence (Faz 6)
      if (component === 'CompetitorListCard' || part.name === 'get_competitors') {
        return <CompetitorListCard key={index} data={data} onSendMessage={opts.onSendMessage} />;
      }

      if (component === 'CompetitorAnalysisCard' || part.name === 'get_competitor_analysis' || part.name === 'analyze_competitor') {
        return <CompetitorAnalysisCard key={index} data={data} />;
      }

      // Default: show as JSON-like summary
      if (data.error) {
        return (
          <div key={index} className="my-1 px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-xs font-commons text-red-700">
            {data.error}
          </div>
        );
      }

      if (data.message) {
        return (
          <div key={index} className="my-1 px-3 py-2 rounded-xl bg-neutral-50 border border-neutral-150 text-xs font-commons text-neutral-600">
            {data.message}
          </div>
        );
      }

      return null;
    }

    case 'approval_required':
      return (
        <ApprovalCard
          key={index}
          action={part.action}
          onApprove={opts.onApprove}
          onReject={opts.onReject}
        />
      );

    default:
      return null;
  }
}

export default ChatMessage;
