import { Timestamp } from 'firebase/firestore';
import { BasePlatformAdapter } from '../types';
import type { PlatformCampaignResult, DateRange } from '../types';
import type {
  AdPlatform,
  MarketingCampaign,
  AdSet,
  AdCreative,
  PerformanceSnapshot,
  PlatformAccount,
} from '@/shared/types/marketing';

/**
 * Email Marketing Adapter (using Resend)
 *
 * Handles email campaign delivery via Resend API.
 * Resend is already integrated in the project.
 *
 * Setup: RESEND_API_KEY environment variable
 */

const RESEND_API_BASE = 'https://api.resend.com';

export class EmailAdapter extends BasePlatformAdapter {
  readonly platform: AdPlatform = 'email';

  getAuthUrl(_redirectUri: string): string {
    // Email doesn't use OAuth — API key based
    return '';
  }

  async handleCallback(_code: string, _redirectUri: string): Promise<PlatformAccount> {
    // Email uses API key, not OAuth callback
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error('RESEND_API_KEY not configured');

    // Validate API key by making a test request
    const res = await fetch(`${RESEND_API_BASE}/domains`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(`Resend API validation failed: ${data.message || 'Unknown error'}`);
    }

    const domains = data.data || [];
    const primaryDomain = domains[0]?.name || 'email';

    return {
      id: '',
      platform: 'email',
      accountId: 'resend',
      accountName: `Email (${primaryDomain})`,
      status: 'connected',
      permissions: ['send', 'list_manage'],
      metadata: {
        apiKey,
        domains: domains.map((d: any) => d.name),
        primaryDomain,
      },
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
  }

  async refreshToken(account: PlatformAccount): Promise<PlatformAccount> {
    // API key doesn't expire — just validate it still works
    const apiKey = account.metadata?.apiKey;
    if (!apiKey) return { ...account, status: 'disconnected', updatedAt: Timestamp.now() };

    try {
      const res = await fetch(`${RESEND_API_BASE}/domains`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (res.ok) return account;
      return { ...account, status: 'expired', updatedAt: Timestamp.now() };
    } catch {
      return { ...account, status: 'disconnected', updatedAt: Timestamp.now() };
    }
  }

  async createCampaign(
    campaign: MarketingCampaign,
    account: PlatformAccount
  ): Promise<PlatformCampaignResult> {
    const apiKey = account.metadata?.apiKey;
    if (!apiKey) return { success: false, error: 'Missing API key' };

    try {
      // For email, "campaign" = batch send
      const emailAdSets = campaign.adSets.filter(as => as.platform === 'email');

      const platformAdIds: string[] = [];

      for (const adSet of emailAdSets) {
        for (const ad of adSet.ads) {
          const creative = ad.creative;

          // Create Resend batch email
          const res = await fetch(`${RESEND_API_BASE}/emails/batch`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify([
              {
                from: `${campaign.name} <noreply@${account.metadata?.primaryDomain || 'example.com'}>`,
                to: [], // Will be populated from email list/segments
                subject: creative.emailSubject || creative.headline,
                html: creative.emailBody || `<h1>${creative.headline}</h1><p>${creative.primaryText}</p><a href="${creative.destinationUrl}">${creative.callToAction}</a>`,
              },
            ]),
          });

          const data = await res.json();

          if (!res.ok) {
            return { success: false, error: data.message || 'Email send failed' };
          }

          platformAdIds.push(data.data?.[0]?.id || 'batch');
        }
      }

      return {
        success: true,
        platformCampaignId: `email-${Date.now()}`,
        platformAdIds,
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async updateCampaign(
    _platformCampaignId: string,
    _updates: Partial<MarketingCampaign>,
    _account: PlatformAccount
  ): Promise<void> {
    // Email campaigns can't be updated after send
    console.log('[EmailAdapter] Email campaigns cannot be updated after sending');
  }

  async pauseCampaign(
    _platformCampaignId: string,
    _account: PlatformAccount
  ): Promise<void> {
    // Email campaigns can't be paused
    console.log('[EmailAdapter] Email campaigns cannot be paused');
  }

  async resumeCampaign(
    _platformCampaignId: string,
    _account: PlatformAccount
  ): Promise<void> {
    console.log('[EmailAdapter] Email campaigns cannot be resumed');
  }

  async deleteCampaign(
    _platformCampaignId: string,
    _account: PlatformAccount
  ): Promise<void> {
    // Can only cancel scheduled emails
    console.log('[EmailAdapter] Email campaign deletion not supported');
  }

  async createAdSet(
    _platformCampaignId: string,
    _adSet: AdSet,
    _account: PlatformAccount
  ): Promise<string> {
    // Email doesn't have ad sets — just return a placeholder
    return `email-adset-${Date.now()}`;
  }

  async updateAdSet(
    _platformAdSetId: string,
    _updates: Partial<AdSet>,
    _account: PlatformAccount
  ): Promise<void> {
    // No-op for email
  }

  async createAd(
    _platformAdSetId: string,
    _creative: AdCreative,
    _account: PlatformAccount
  ): Promise<string> {
    return `email-ad-${Date.now()}`;
  }

  async updateAd(
    _platformAdId: string,
    _updates: Partial<AdCreative>,
    _account: PlatformAccount
  ): Promise<void> {
    // No-op for email
  }

  async getPerformance(
    _platformCampaignId: string,
    _dateRange: DateRange,
    _account: PlatformAccount
  ): Promise<PerformanceSnapshot[]> {
    // Resend provides limited analytics
    // In a full implementation, this would query Resend's event API
    return [];
  }

  override validateCreative(creative: AdCreative): ReturnType<BasePlatformAdapter['validateCreative']> {
    const base = super.validateCreative(creative);
    const errors = [...base.errors];
    const warnings = [...base.warnings];

    if (!creative.emailSubject && !creative.headline) {
      errors.push('Email konu satiri gerekli');
    }
    if (creative.emailSubject && creative.emailSubject.length > 60) {
      warnings.push('Konu satiri 60 karakterden uzun — acilma orani dusebilir');
    }
    if (!creative.emailBody && !creative.primaryText) {
      errors.push('Email govdesi gerekli');
    }

    return { valid: errors.length === 0, errors, warnings };
  }
}
