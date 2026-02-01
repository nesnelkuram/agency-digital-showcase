import type {
  AdPlatform,
  MarketingCampaign,
  AdSet,
  AdCreative,
  PerformanceSnapshot,
  PlatformAccount,
} from '@/shared/types/marketing';

// ============================================
// UNIFIED PLATFORM ADAPTER INTERFACE
// ============================================

export interface PlatformCampaignResult {
  success: boolean;
  platformCampaignId?: string;
  platformAdSetIds?: string[];
  platformAdIds?: string[];
  error?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface DateRange {
  start: string;  // YYYY-MM-DD
  end: string;    // YYYY-MM-DD
}

export interface PlatformAdapter {
  readonly platform: AdPlatform;

  // Authentication
  getAuthUrl(redirectUri: string): string;
  handleCallback(code: string, redirectUri: string): Promise<PlatformAccount>;
  refreshToken(account: PlatformAccount): Promise<PlatformAccount>;
  isTokenValid(account: PlatformAccount): boolean;

  // Campaign lifecycle
  createCampaign(campaign: MarketingCampaign, account: PlatformAccount): Promise<PlatformCampaignResult>;
  updateCampaign(platformCampaignId: string, updates: Partial<MarketingCampaign>, account: PlatformAccount): Promise<void>;
  pauseCampaign(platformCampaignId: string, account: PlatformAccount): Promise<void>;
  resumeCampaign(platformCampaignId: string, account: PlatformAccount): Promise<void>;
  deleteCampaign(platformCampaignId: string, account: PlatformAccount): Promise<void>;

  // Ad Set management
  createAdSet(platformCampaignId: string, adSet: AdSet, account: PlatformAccount): Promise<string>;
  updateAdSet(platformAdSetId: string, updates: Partial<AdSet>, account: PlatformAccount): Promise<void>;

  // Ad / Creative management
  createAd(platformAdSetId: string, creative: AdCreative, account: PlatformAccount): Promise<string>;
  updateAd(platformAdId: string, updates: Partial<AdCreative>, account: PlatformAccount): Promise<void>;

  // Reporting
  getPerformance(platformCampaignId: string, dateRange: DateRange, account: PlatformAccount): Promise<PerformanceSnapshot[]>;

  // Validation
  validateCampaign(campaign: MarketingCampaign): ValidationResult;
  validateCreative(creative: AdCreative): ValidationResult;
}

// ============================================
// BASE ADAPTER (Abstract implementation)
// ============================================

export abstract class BasePlatformAdapter implements PlatformAdapter {
  abstract readonly platform: AdPlatform;

  abstract getAuthUrl(redirectUri: string): string;
  abstract handleCallback(code: string, redirectUri: string): Promise<PlatformAccount>;
  abstract refreshToken(account: PlatformAccount): Promise<PlatformAccount>;

  isTokenValid(account: PlatformAccount): boolean {
    if (account.status !== 'connected') return false;
    if (!account.tokenExpiresAt) return true;
    // Token valid if expiry is more than 5 minutes away
    const fiveMinutes = 5 * 60 * 1000;
    return account.tokenExpiresAt.toMillis() > Date.now() + fiveMinutes;
  }

  abstract createCampaign(campaign: MarketingCampaign, account: PlatformAccount): Promise<PlatformCampaignResult>;
  abstract updateCampaign(platformCampaignId: string, updates: Partial<MarketingCampaign>, account: PlatformAccount): Promise<void>;
  abstract pauseCampaign(platformCampaignId: string, account: PlatformAccount): Promise<void>;
  abstract resumeCampaign(platformCampaignId: string, account: PlatformAccount): Promise<void>;
  abstract deleteCampaign(platformCampaignId: string, account: PlatformAccount): Promise<void>;

  abstract createAdSet(platformCampaignId: string, adSet: AdSet, account: PlatformAccount): Promise<string>;
  abstract updateAdSet(platformAdSetId: string, updates: Partial<AdSet>, account: PlatformAccount): Promise<void>;

  abstract createAd(platformAdSetId: string, creative: AdCreative, account: PlatformAccount): Promise<string>;
  abstract updateAd(platformAdId: string, updates: Partial<AdCreative>, account: PlatformAccount): Promise<void>;

  abstract getPerformance(platformCampaignId: string, dateRange: DateRange, account: PlatformAccount): Promise<PerformanceSnapshot[]>;

  validateCampaign(campaign: MarketingCampaign): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!campaign.name) errors.push('Kampanya adi gerekli');
    if (!campaign.objective) errors.push('Kampanya hedefi gerekli');
    if (!campaign.budget?.totalBudget || campaign.budget.totalBudget <= 0) {
      errors.push('Gecerli bir butce gerekli');
    }
    if (!campaign.schedule?.startDate) errors.push('Baslangic tarihi gerekli');
    if (campaign.adSets.length === 0) warnings.push('Hic reklam seti tanimlanmamis');

    return { valid: errors.length === 0, errors, warnings };
  }

  validateCreative(creative: AdCreative): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!creative.headline) errors.push('Baslik gerekli');
    if (!creative.primaryText) errors.push('Birincil metin gerekli');
    if (!creative.callToAction) errors.push('CTA gerekli');
    if (!creative.destinationUrl) errors.push('Hedef URL gerekli');

    return { valid: errors.length === 0, errors, warnings };
  }
}
