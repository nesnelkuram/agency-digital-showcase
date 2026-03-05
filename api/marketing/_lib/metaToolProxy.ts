/**
 * Meta-Tool Proxy Pattern
 *
 * Instead of declaring 60+ tools upfront (which bloats the prompt and confuses the model),
 * we declare ~8 category meta-tools. When the model calls a meta-tool, we:
 * 1. Expand it into the specific tool declarations for that category
 * 2. Re-prompt the model with only those tools available
 * 3. Execute the specific tool the model picks
 *
 * This reduces initial prompt size by ~80% and improves tool selection accuracy.
 *
 * For backward compatibility, the original toolDeclarations can still be used directly.
 */

import { Type } from '@google/genai';
import { toolDeclarations } from './toolDeclarations.js';
import { toolHandlers, ToolContext } from './toolHandlers.js';

// ============================================
// Tool Categories
// ============================================

export interface ToolCategory {
  name: string;
  description: string;
  toolNames: string[];
}

export const TOOL_CATEGORIES: ToolCategory[] = [
  {
    name: 'account_management',
    description: 'Hesap islemleri: bagli hesaplari listele, kampanyalari getir/senkronize et, kampanya detayi gor',
    toolNames: [
      'list_connected_accounts',
      'get_account_campaigns',
      'get_campaign_details',
      'sync_campaigns',
    ],
  },
  {
    name: 'strategy_planning',
    description: 'Strateji olusturma: strateji sorulari sor, huni plani goster, kampanya yapisi planla, butce dagitimi yap, hedef kitle belirle, ozet goster, pazarlama plani olustur, istatistikleri getir',
    toolNames: [
      'ask_strategy_questions',
      'show_funnel_plan',
      'show_campaign_structure',
      'ask_budget_allocation',
      'ask_audience_targeting',
      'show_strategy_summary',
      'create_marketing_plan',
      'get_marketing_stats',
    ],
  },
  {
    name: 'audience_research',
    description: 'Hedef kitle arastirmasi: ilgi alanları, davranislar, demografi, lokasyon ara, kitle boyutu tahmin et, reklam arsivi ara',
    toolNames: [
      'search_interests',
      'search_behaviors',
      'search_demographics',
      'search_geo_locations',
      'estimate_audience_size',
      'search_ads_archive',
    ],
  },
  {
    name: 'campaign_operations',
    description: 'Kampanya CRUD: kampanya/adset/reklam olustur, guncelle; gorsel yukle, kreatif olustur; A/B test; butce planlama',
    toolNames: [
      'create_campaign_v2',
      'create_adset_v2',
      'create_ad_v2',
      'update_campaign_v2',
      'update_adset_v2',
      'update_ad_v2',
      'create_budget_schedule',
      'upload_ad_image',
      'create_ad_creative',
      'get_ad_creatives',
      'get_creative_details',
      'create_ab_test',
      'duplicate_adset',
    ],
  },
  {
    name: 'campaign_details',
    description: 'Kampanya detaylari: adset listesi, adset detayi, reklam listesi, reklam detayi, A/B test sonuclari',
    toolNames: [
      'get_adsets',
      'get_adset_details',
      'get_ads',
      'get_ad_details',
      'get_ab_test_results',
    ],
  },
  {
    name: 'performance_analytics',
    description: 'Performans ve raporlama: ozet, kırılım, butce durumu, uyarılar, rapor listesi, rapor olustur, optimizasyon onerileri, butce tahmini',
    toolNames: [
      'get_campaign_performance',
      'get_performance_summary',
      'get_performance_breakdown',
      'get_budget_overview',
      'get_budget_alerts',
      'get_reports_list',
      'generate_report',
      'get_optimization_suggestions',
      'forecast_budget',
    ],
  },
  {
    name: 'automation',
    description: 'Otomasyon kurallari: kural listele, kural detayi, kural olustur/guncelle/sil, calisma kayitlari',
    toolNames: [
      'get_automation_rules',
      'get_rule_execution_log',
      'create_automation_rule',
      'update_automation_rule',
      'delete_automation_rule',
    ],
  },
  {
    name: 'competitor_intelligence',
    description: 'Rakip analizi: rakip listele, rakip ekle, rakip analiz et, analiz sonuclarini gor',
    toolNames: [
      'get_competitors',
      'get_competitor_analysis',
      'add_competitor',
      'analyze_competitor',
    ],
  },
];

// ============================================
// Meta-Tool Declarations (sent to Gemini initially)
// ============================================

export const metaToolDeclarations = [
  {
    name: 'use_tools',
    description: `Belirli bir kategorideki araclari kullanmak icin cagir. Kategoriler:
- account_management: Hesap ve kampanya yonetimi
- strategy_planning: Strateji olusturma ve planlama
- audience_research: Hedef kitle arastirmasi
- campaign_operations: Kampanya/adset/reklam olusturma ve guncelleme
- campaign_details: Kampanya detaylarini goruntuleme
- performance_analytics: Performans analizi ve raporlama
- automation: Otomasyon kurallari yonetimi
- competitor_intelligence: Rakip analizi

Istedigini acikla, uygun kategoriyi sec.`,
    parameters: {
      type: Type.OBJECT,
      properties: {
        category: {
          type: Type.STRING,
          description: 'Kategori adi: account_management, strategy_planning, audience_research, campaign_operations, campaign_details, performance_analytics, automation, competitor_intelligence',
        },
        intent: {
          type: Type.STRING,
          description: 'Ne yapmak istiyorsun? Ornegin: "aktif kampanyalari listele" veya "yeni bir kampanya olustur"',
        },
      },
      required: ['category', 'intent'],
    },
  },
];

// ============================================
// Resolve category tools
// ============================================

/** Get the full tool declarations for a specific category */
export function getCategoryTools(categoryName: string): any[] {
  const category = TOOL_CATEGORIES.find(c => c.name === categoryName);
  if (!category) return [];

  return toolDeclarations.filter(td => category.toolNames.includes(td.name));
}

/** Get all tool names across all categories */
export function getAllToolNames(): string[] {
  return TOOL_CATEGORIES.flatMap(c => c.toolNames);
}

/** Find which category a tool belongs to */
export function getToolCategory(toolName: string): string | null {
  for (const cat of TOOL_CATEGORIES) {
    if (cat.toolNames.includes(toolName)) return cat.name;
  }
  return null;
}

// ============================================
// Two-phase execution helper
// ============================================

/**
 * Phase 1: Model calls use_tools with category + intent
 * Phase 2: Re-prompt model with only that category's tools
 *
 * Returns the specific tool declarations to use for the next model call.
 */
export function resolveMetaToolCall(
  args: { category: string; intent: string }
): { tools: any[]; systemAddendum: string } | null {
  const categoryTools = getCategoryTools(args.category);
  if (categoryTools.length === 0) return null;

  return {
    tools: categoryTools,
    systemAddendum: `\nKullanici "${args.intent}" istemektedir. Uygun araci sec ve cagir.`,
  };
}
