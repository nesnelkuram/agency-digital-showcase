/**
 * Faz 5: Automation Rules Handlers
 *
 * Collections: automation_rules, rule_execution_logs
 * Types: shared/types/automationRule.ts
 */

import type { ToolContext } from '../toolHandlers.js';

// ---------------------------------------------------------------------------
// Helper: conditions → human-readable summary
// ---------------------------------------------------------------------------

function conditionSummary(conditions: any[], logic: string): string {
  const parts = conditions.map((c: any) => {
    const metricLabel = c.metric || '?';
    const op =
      c.operator === 'greater_than' ? '>' :
      c.operator === 'less_than' ? '<' :
      c.operator === 'equals' ? '=' :
      c.operator === 'between' ? 'arasi' : c.operator;
    const val = c.operator === 'between' ? `${c.value}-${c.value2}` : c.value;
    const window = c.timeWindow || '';
    return `${metricLabel} ${op} ${val}${window ? ` (${window})` : ''}`;
  });
  const connector = logic === 'or' ? ' VEYA ' : ' VE ';
  return parts.join(connector);
}

// ---------------------------------------------------------------------------
// 1. get_automation_rules (auto)
// ---------------------------------------------------------------------------

export async function handleGetAutomationRules(
  ctx: ToolContext,
  _args: Record<string, any>,
) {
  const snap = await ctx.db
    .collection('automation_rules')
    .where('tenantId', '==', ctx.tenantId)
    .orderBy('createdAt', 'desc')
    .get();

  const rules = snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      name: data.name,
      status: data.status || 'active',
      conditions: data.conditions || [],
      conditionLogic: data.conditionLogic || 'and',
      conditionSummary: conditionSummary(data.conditions || [], data.conditionLogic || 'and'),
      action: data.action,
      frequency: data.frequency || 'daily',
      totalExecutions: data.totalExecutions || 0,
      totalTriggered: data.totalTriggered || 0,
      lastExecutedAt: data.lastExecutedAt,
      createdAt: data.createdAt,
    };
  });

  return {
    rules,
    totalCount: rules.length,
    component: 'AutomationRuleListCard',
  };
}

// ---------------------------------------------------------------------------
// 2. get_rule_execution_log (auto)
// ---------------------------------------------------------------------------

export async function handleGetRuleExecutionLog(
  ctx: ToolContext,
  args: Record<string, any>,
) {
  const { ruleId } = args;
  if (!ruleId) return { error: 'ruleId gerekli.' };

  // Verify rule belongs to tenant
  const ruleDoc = await ctx.db.collection('automation_rules').doc(ruleId).get();
  if (!ruleDoc.exists || ruleDoc.data()?.tenantId !== ctx.tenantId) {
    return { error: 'Kural bulunamadi.' };
  }

  const snap = await ctx.db
    .collection('rule_execution_logs')
    .where('ruleId', '==', ruleId)
    .where('tenantId', '==', ctx.tenantId)
    .orderBy('executedAt', 'desc')
    .limit(50)
    .get();

  const logs = snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ruleId: data.ruleId,
      executedAt: data.executedAt,
      triggered: data.triggered || false,
      conditionResults: data.conditionResults || [],
      actionTaken: data.actionTaken,
      campaignId: data.campaignId,
      campaignName: data.campaignName,
      error: data.error,
    };
  });

  return {
    ruleName: ruleDoc.data()?.name,
    logs,
    totalCount: logs.length,
    component: 'RuleExecutionLogCard',
  };
}

// ---------------------------------------------------------------------------
// 3. create_automation_rule (approval-required)
// ---------------------------------------------------------------------------

export async function handleCreateAutomationRule(
  ctx: ToolContext,
  args: Record<string, any>,
) {
  const { name, conditions, conditionLogic, action, frequency, campaignIds } = args;

  if (!name) return { error: 'Kural adi (name) gerekli.' };
  if (!conditions || !Array.isArray(conditions) || conditions.length === 0) {
    return { error: 'En az bir kosul (conditions) gerekli.' };
  }
  if (!action) return { error: 'Aksiyon (action) gerekli.' };

  const ruleRef = ctx.db.collection('automation_rules').doc();
  const ruleData = {
    tenantId: ctx.tenantId,
    name,
    conditions,
    conditionLogic: conditionLogic || 'and',
    action,
    frequency: frequency || 'daily',
    campaignIds: campaignIds || [],
    status: 'active',
    totalExecutions: 0,
    totalTriggered: 0,
    createdBy: ctx.userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await ruleRef.set(ruleData);

  return {
    ruleId: ruleRef.id,
    name,
    status: 'active',
    message: `Otomasyon kurali "${name}" olusturuldu.`,
  };
}

// ---------------------------------------------------------------------------
// 4. update_automation_rule (approval-required)
// ---------------------------------------------------------------------------

export async function handleUpdateAutomationRule(
  ctx: ToolContext,
  args: Record<string, any>,
) {
  const { ruleId } = args;
  if (!ruleId) return { error: 'ruleId gerekli.' };

  const ruleDoc = await ctx.db.collection('automation_rules').doc(ruleId).get();
  if (!ruleDoc.exists || ruleDoc.data()?.tenantId !== ctx.tenantId) {
    return { error: 'Kural bulunamadi.' };
  }

  const updates: Record<string, any> = { updatedAt: new Date() };
  if (args.name) updates.name = args.name;
  if (args.status) updates.status = args.status;
  if (args.conditions) updates.conditions = args.conditions;
  if (args.conditionLogic) updates.conditionLogic = args.conditionLogic;
  if (args.action) updates.action = args.action;
  if (args.frequency) updates.frequency = args.frequency;
  if (args.campaignIds) updates.campaignIds = args.campaignIds;

  await ctx.db.collection('automation_rules').doc(ruleId).update(updates);

  return {
    ruleId,
    updated: Object.keys(updates).filter((k) => k !== 'updatedAt'),
    message: `Otomasyon kurali guncellendi.`,
  };
}

// ---------------------------------------------------------------------------
// 5. delete_automation_rule (approval-required)
// ---------------------------------------------------------------------------

export async function handleDeleteAutomationRule(
  ctx: ToolContext,
  args: Record<string, any>,
) {
  const { ruleId } = args;
  if (!ruleId) return { error: 'ruleId gerekli.' };

  const ruleDoc = await ctx.db.collection('automation_rules').doc(ruleId).get();
  if (!ruleDoc.exists || ruleDoc.data()?.tenantId !== ctx.tenantId) {
    return { error: 'Kural bulunamadi.' };
  }

  const ruleName = ruleDoc.data()?.name || 'Isimsiz';
  await ctx.db.collection('automation_rules').doc(ruleId).delete();

  return {
    ruleId,
    deleted: true,
    message: `Otomasyon kurali "${ruleName}" silindi.`,
  };
}
