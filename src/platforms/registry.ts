import type { AdPlatform } from '@/shared/types/marketing';
import type { PlatformAdapter } from './types';
import { MetaAdapter } from './adapters/meta';
import { EmailAdapter } from './adapters/email';
import { GoogleAdsAdapter } from './adapters/google';
import { TikTokAdapter } from './adapters/tiktok';
import { LinkedInAdapter } from './adapters/linkedin';

// Platform adapter registry
const adapters = new Map<AdPlatform, PlatformAdapter>();

// Register available adapters
adapters.set('meta', new MetaAdapter());
adapters.set('email', new EmailAdapter());
adapters.set('google', new GoogleAdsAdapter());
adapters.set('tiktok', new TikTokAdapter());
adapters.set('linkedin', new LinkedInAdapter());

export function getAdapter(platform: AdPlatform): PlatformAdapter | null {
  return adapters.get(platform) || null;
}

export function getAvailableAdapters(): AdPlatform[] {
  return Array.from(adapters.keys());
}

export function isAdapterAvailable(platform: AdPlatform): boolean {
  return adapters.has(platform);
}
