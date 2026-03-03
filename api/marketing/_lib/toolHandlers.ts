/**
 * Unified tool handler map and ToolContext type for Marketing AI Agent
 */

// Handler imports
import { handleListConnectedAccounts } from './handlers/accountHandlers.js';
import {
  handleGetAccountCampaigns,
  handleGetCampaignDetails,
  handleSyncCampaigns,
  handleCreateMarketingPlan,
  handleGetMarketingStats,
} from './handlers/campaignHandlers.js';
import { handleGetCampaignPerformance } from './handlers/performanceHandlers.js';
import {
  handleAskStrategyQuestions,
  handleShowFunnelPlan,
  handleShowCampaignStructure,
  handleAskBudgetAllocation,
  handleAskAudienceTargeting,
  handleShowStrategySummary,
} from './handlers/strategyHandlers.js';
import {
  handleSearchInterests,
  handleSearchBehaviors,
  handleSearchDemographics,
  handleSearchGeoLocations,
  handleEstimateAudienceSize,
  handleSearchAdsArchive,
} from './handlers/researchHandlers.js';
import { handleGetAdsets, handleGetAdsetDetails } from './handlers/adsetHandlers.js';
import { handleGetAds, handleGetAdDetails } from './handlers/adHandlers.js';
import {
  handleUploadAdImage,
  handleCreateAdCreative,
  handleGetAdCreatives,
  handleGetCreativeDetails,
  handleGetAbTestResults,
} from './handlers/createHandlers.js';
import {
  handleGetPerformanceSummary,
  handleGetPerformanceBreakdown,
  handleGetBudgetOverview,
  handleGetBudgetAlerts,
  handleGetReportsList,
  handleGenerateReport,
  handleGetOptimizationSuggestions,
  handleForecastBudget,
} from './handlers/analyticsHandlers.js';
import {
  handleGetAutomationRules,
  handleGetRuleExecutionLog,
  handleCreateAutomationRule,
  handleUpdateAutomationRule,
  handleDeleteAutomationRule,
} from './handlers/automationHandlers.js';
import {
  handleGetCompetitors,
  handleGetCompetitorAnalysis,
  handleAddCompetitor,
  handleAnalyzeCompetitor,
} from './handlers/competitorHandlers.js';

export type ToolContext = {
  db: FirebaseFirestore.Firestore;
  tenantId: string;
  sessionId: string;
  userId: string;
};

export const toolHandlers: Record<
  string,
  (ctx: ToolContext, args: Record<string, any>) => Promise<any>
> = {
  // Account
  list_connected_accounts: (ctx) => handleListConnectedAccounts(ctx),

  // Campaign management
  get_account_campaigns: handleGetAccountCampaigns,
  get_campaign_details: handleGetCampaignDetails,
  sync_campaigns: handleSyncCampaigns,
  create_marketing_plan: handleCreateMarketingPlan,
  get_marketing_stats: handleGetMarketingStats,

  // Performance
  get_campaign_performance: handleGetCampaignPerformance,

  // V3 interactive strategy tools
  ask_strategy_questions: handleAskStrategyQuestions,
  show_funnel_plan: handleShowFunnelPlan,
  show_campaign_structure: handleShowCampaignStructure,
  ask_budget_allocation: handleAskBudgetAllocation,
  ask_audience_targeting: handleAskAudienceTargeting,
  show_strategy_summary: handleShowStrategySummary,

  // Research / targeting (NEW — Faz 1)
  search_interests: handleSearchInterests,
  search_behaviors: handleSearchBehaviors,
  search_demographics: handleSearchDemographics,
  search_geo_locations: handleSearchGeoLocations,
  estimate_audience_size: handleEstimateAudienceSize,
  search_ads_archive: handleSearchAdsArchive,

  // AdSet / Ad read (NEW — Faz 1)
  get_adsets: handleGetAdsets,
  get_adset_details: handleGetAdsetDetails,
  get_ads: handleGetAds,
  get_ad_details: handleGetAdDetails,

  // Creative & Image (NEW — Faz 2A)
  upload_ad_image: handleUploadAdImage,
  create_ad_creative: handleCreateAdCreative,
  get_ad_creatives: handleGetAdCreatives,
  get_creative_details: handleGetCreativeDetails,

  // A/B Test Results (NEW — Faz 3)
  get_ab_test_results: handleGetAbTestResults,

  // Performance & Reporting (NEW — Faz 4)
  get_performance_summary: handleGetPerformanceSummary,
  get_performance_breakdown: handleGetPerformanceBreakdown,
  get_budget_overview: handleGetBudgetOverview,
  get_budget_alerts: handleGetBudgetAlerts,
  get_reports_list: handleGetReportsList,
  generate_report: handleGenerateReport,
  get_optimization_suggestions: handleGetOptimizationSuggestions,
  forecast_budget: handleForecastBudget,

  // Automation Rules (NEW — Faz 5)
  get_automation_rules: handleGetAutomationRules,
  get_rule_execution_log: handleGetRuleExecutionLog,
  create_automation_rule: handleCreateAutomationRule,
  update_automation_rule: handleUpdateAutomationRule,
  delete_automation_rule: handleDeleteAutomationRule,

  // Competitor Intelligence (NEW — Faz 6)
  get_competitors: handleGetCompetitors,
  get_competitor_analysis: handleGetCompetitorAnalysis,
  add_competitor: handleAddCompetitor,
  analyze_competitor: handleAnalyzeCompetitor,
};
