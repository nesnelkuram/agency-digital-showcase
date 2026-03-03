import type { ToolContext } from '../toolHandlers.js';

export async function handleAskStrategyQuestions(_ctx: ToolContext, args: Record<string, any>) {
  return { ...args, component: 'StrategyQuestionnaire' };
}

export async function handleShowFunnelPlan(_ctx: ToolContext, args: Record<string, any>) {
  return { ...args, component: 'FunnelPlan' };
}

export async function handleShowCampaignStructure(_ctx: ToolContext, args: Record<string, any>) {
  return { campaigns: args.campaigns, component: 'CampaignStructure' };
}

export async function handleAskBudgetAllocation(_ctx: ToolContext, args: Record<string, any>) {
  return { ...args, component: 'BudgetAllocationV3' };
}

export async function handleAskAudienceTargeting(_ctx: ToolContext, args: Record<string, any>) {
  return { ...args, component: 'AudienceTargetingV3' };
}

export async function handleShowStrategySummary(_ctx: ToolContext, args: Record<string, any>) {
  return { ...args, component: 'StrategySummary' };
}
