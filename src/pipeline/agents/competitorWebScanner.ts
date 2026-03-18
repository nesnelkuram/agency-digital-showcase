import type { EnrichedCompetitor } from '../types';
import { fetchAndParseWebsite } from '../utils/websiteFetcher';

export interface EnrichedCompetitorWithSite extends EnrichedCompetitor {
  siteData?: {
    title: string;
    text: string;         // first 3000 chars
    fetchedAt: number;
    status: 'ok' | 'failed' | 'skipped';
  };
}

export async function scanCompetitorWebsites(
  competitors: EnrichedCompetitor[],
  options?: { maxCompetitors?: number; timeoutMs?: number },
): Promise<EnrichedCompetitorWithSite[]> {
  const maxCompetitors = options?.maxCompetitors ?? 5;

  // Split into scannable (has valid URL) and non-scannable
  const withWebsite = competitors.filter(
    (c) => c.website && typeof c.website === 'string' && c.website.startsWith('http'),
  );
  const withoutWebsite = competitors.filter(
    (c) => !c.website || typeof c.website !== 'string' || !c.website.startsWith('http'),
  );

  const toScan = withWebsite.slice(0, maxCompetitors);
  const remaining = withWebsite.slice(maxCompetitors);

  console.log(
    `[CompetitorWebScanner] Scanning ${toScan.length}/${competitors.length} competitor sites (${withoutWebsite.length} skipped — no URL, ${remaining.length} skipped — over limit)`,
  );

  // Parallel fetch with allSettled
  const settledResults = await Promise.allSettled(
    toScan.map((c) => fetchAndParseWebsite(c.website!)),
  );

  const scannedCompetitors: EnrichedCompetitorWithSite[] = toScan.map((competitor, idx) => {
    const result = settledResults[idx];

    if (result.status === 'fulfilled' && result.value) {
      const site = result.value;
      const text = (site.textContent || '').slice(0, 3000);
      return {
        ...competitor,
        siteData: {
          title: site.title || '',
          text,
          fetchedAt: Date.now(),
          status: 'ok',
        },
      };
    } else {
      const reason = result.status === 'rejected' ? String(result.reason) : 'null response';
      console.warn(`[CompetitorWebScanner] Failed to fetch ${competitor.website}: ${reason}`);
      return {
        ...competitor,
        siteData: {
          title: '',
          text: '',
          fetchedAt: Date.now(),
          status: 'failed',
        },
      };
    }
  });

  // Competitors that were over the limit — include as scanned but with skipped status
  const overLimitCompetitors: EnrichedCompetitorWithSite[] = remaining.map((c) => ({
    ...c,
    siteData: {
      title: '',
      text: '',
      fetchedAt: Date.now(),
      status: 'skipped' as const,
    },
  }));

  // Competitors without website — include as-is with skipped status
  const skippedCompetitors: EnrichedCompetitorWithSite[] = withoutWebsite.map((c) => ({
    ...c,
    siteData: {
      title: '',
      text: '',
      fetchedAt: Date.now(),
      status: 'skipped' as const,
    },
  }));

  const allResults = [...scannedCompetitors, ...overLimitCompetitors, ...skippedCompetitors];

  const okCount = scannedCompetitors.filter((c) => c.siteData?.status === 'ok').length;
  const failedCount = scannedCompetitors.filter((c) => c.siteData?.status === 'failed').length;
  console.log(`[CompetitorWebScanner] Done: ${okCount} ok, ${failedCount} failed, ${skippedCompetitors.length + overLimitCompetitors.length} skipped`);

  return allResults;
}
