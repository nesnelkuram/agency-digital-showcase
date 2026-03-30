/**
 * Competitor Intelligence Gatherer
 *
 * Takes competitor names from sectorResearch and gathers real data:
 * 1. Website URL discovery (Google search or known patterns)
 * 2. Website crawl (fiyat, contact, about, products)
 * 3. Instagram handle discovery + Apify scrape
 * 4. Google Places data (rating, reviews)
 * 5. Comparison table generation
 *
 * Zero LLM cost for data gathering. One Flash call for comparison insights.
 */

import { fetchAndParseWebsite, type FetchedWebsite } from './websiteFetcher';
import { scrapeInstagramPublic, type InstagramPublicData } from './instagramScraper';
import { fetchGooglePlacesData, type GooglePlacesData } from './googlePlacesScraper';
import { generateGroundedText } from '../geminiClient';

export interface CompetitorProfile {
  name: string;
  // Discovered data
  websiteUrl: string | null;
  websiteData: FetchedWebsite | null;
  instagramHandle: string | null;
  instagramData: InstagramPublicData | null;
  googlePlacesData: GooglePlacesData | null;
  // Extracted metrics (for comparison table)
  metrics: {
    priceRange: { min: number | null; max: number | null; segment: string };
    websiteQuality: number | null;      // 0-10
    googleRating: number | null;        // 1-5
    googleReviewCount: number;
    instagramFollowers: number | null;
    instagramEngagement: number | null;  // percentage
    instagramPostFrequency: string | null;
    productCount: number;
  };
}

export interface CompetitorComparison {
  brand: CompetitorProfile;
  competitors: CompetitorProfile[];
  comparisonTable: ComparisonRow[];
  insights: string[];  // AI-generated competitive insights
  gatherDuration: number;
}

export interface ComparisonRow {
  dimension: string;
  brandValue: string;
  competitorValues: Array<{ name: string; value: string }>;
  source: string;
  brandAdvantage: boolean | null; // true = brand ahead, false = behind, null = neutral
}

// Known Turkish brand website patterns
const KNOWN_WEBSITES: Record<string, string> = {
  'agt': 'https://www.agt.com.tr',
  'şerifoğlu': 'https://www.serifoglu.com.tr',
  'tarkett': 'https://www.tarkett.com.tr',
  'haro': 'https://www.haro.com',
  'dendro': 'https://www.dendroparke.com',
  'kaleseramik': 'https://www.kfrp.com.tr',
  'bien seramik': 'https://www.bien.com.tr',
  'bellona': 'https://www.bellona.com.tr',
  'enza home': 'https://www.enzahome.com',
  'koçtaş': 'https://www.koctas.com.tr',
  'ikea': 'https://www.ikea.com.tr',
};

/** Discover website URL for a competitor name */
async function discoverWebsiteUrl(competitorName: string): Promise<string | null> {
  // Check known patterns first
  const lowerName = competitorName.toLowerCase();
  for (const [key, url] of Object.entries(KNOWN_WEBSITES)) {
    if (lowerName.includes(key)) return url;
  }

  // Use Gemini grounding to search for the website
  try {
    const result = await generateGroundedText(
      `"${competitorName}" resmi web sitesi URL'si nedir? Sadece URL yaz, başka bir şey yazma.`,
      'CompetitorWebDiscovery',
      { temperature: 0.1, maxOutputTokens: 256, modelTier: 'flash' },
    );
    const urlMatch = result.text.match(/https?:\/\/[^\s"'<>]+\.[a-z]{2,}/i);
    if (urlMatch) return urlMatch[0].replace(/[.,;)]+$/, '');
  } catch { /* non-fatal */ }

  return null;
}

/** Discover Instagram handle for a competitor */
function discoverInstagramHandle(
  competitorName: string,
  websiteData: FetchedWebsite | null,
): string | null {
  // Check website social links first (most reliable)
  if (websiteData?.businessIntel?.socialLinks?.instagram) {
    const igUrl = websiteData.businessIntel.socialLinks.instagram;
    const match = igUrl.match(/instagram\.com\/([^/?#\s]+)/i);
    if (match) return match[1];
  }

  // Common handle patterns for Turkish brands
  const name = competitorName.toLowerCase()
    .replace(/[()]/g, '')
    .replace(/\s+/g, '')
    .replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u')
    .replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/ı/g, 'i');

  // These are guesses — Apify will verify if the profile exists
  return name;
}

/** Gather intelligence for a single competitor */
async function gatherCompetitorProfile(
  name: string,
  _sector: string,
  location?: string,
): Promise<CompetitorProfile> {
  console.log(`[CompetitorIntel] Gathering data for: ${name}`);

  // Step 1: Discover website URL
  const websiteUrl = await discoverWebsiteUrl(name);
  console.log(`[CompetitorIntel] ${name} website: ${websiteUrl || 'not found'}`);

  // Step 2: Parallel data gathering
  const [websiteData, googlePlacesData] = await Promise.all([
    websiteUrl ? fetchAndParseWebsite(websiteUrl).catch(() => null) : Promise.resolve(null),
    fetchGooglePlacesData(name, location).catch(() => null),
  ]);

  // Step 3: Discover Instagram handle (needs website data first for social links)
  const instagramHandle = discoverInstagramHandle(name, websiteData);
  let instagramData: InstagramPublicData | null = null;
  if (instagramHandle) {
    instagramData = await scrapeInstagramPublic(instagramHandle).catch(() => null);
    // If handle was a guess and Apify returned nothing, try without
    if (!instagramData && websiteData?.businessIntel?.socialLinks?.instagram) {
      // Already tried the website's link, no fallback needed
    }
  }

  console.log(`[CompetitorIntel] ${name} — website=${!!websiteData}, instagram=${!!instagramData}, places=${!!googlePlacesData}`);

  return {
    name,
    websiteUrl,
    websiteData,
    instagramHandle: instagramData?.handle || instagramHandle,
    instagramData,
    googlePlacesData,
    metrics: {
      priceRange: websiteData?.businessIntel?.priceRange
        ? { min: websiteData.businessIntel.priceRange.min, max: websiteData.businessIntel.priceRange.max, segment: websiteData.businessIntel.priceRange.segment }
        : { min: null, max: null, segment: 'unknown' },
      websiteQuality: websiteData ? estimateWebsiteQuality(websiteData) : null,
      googleRating: googlePlacesData?.rating || null,
      googleReviewCount: googlePlacesData?.reviewCount || 0,
      instagramFollowers: instagramData?.followerCount || null,
      instagramEngagement: instagramData?.engagementRate || null,
      instagramPostFrequency: instagramData?.postingFrequency || null,
      productCount: websiteData?.productListings?.length || 0,
    },
  };
}

/** Estimate website quality score 0-10 from crawl data */
function estimateWebsiteQuality(data: FetchedWebsite): number {
  let score = 5; // baseline

  // Has meta description
  if (data.metaDescription && data.metaDescription.length > 30) score += 0.5;
  // Has OG tags
  if (Object.keys(data.ogTags).length >= 3) score += 0.5;
  // Navigation present
  if (data.navigation.length >= 4) score += 0.5;
  // Multiple pages crawled
  if (data.pagesScraped.length >= 5) score += 0.5;
  // Has products
  if (data.productListings.length >= 5) score += 0.5;
  // Has CTA buttons
  if (data.ctaButtons.length >= 3) score += 0.5;
  // Has social links
  if (Object.keys(data.businessIntel?.socialLinks || {}).length >= 2) score += 0.5;
  // Has contact info
  const contact = data.businessIntel?.contactInfo;
  if (contact && (contact.phones.length > 0 || contact.emails.length > 0)) score += 0.5;
  // Has about text
  if (data.businessIntel?.aboutText && data.businessIntel.aboutText.length > 100) score += 0.5;
  // Has structured data (JSON-LD)
  if (data.businessIntel?.jsonLd && Object.keys(data.businessIntel.jsonLd).length > 0) score += 0.5;

  return Math.min(10, Math.round(score * 10) / 10);
}

/** Build comparison table rows */
function buildComparisonTable(brand: CompetitorProfile, competitors: CompetitorProfile[]): ComparisonRow[] {
  const rows: ComparisonRow[] = [];

  // Price Range
  rows.push({
    dimension: 'Fiyat Aralığı',
    brandValue: brand.metrics.priceRange.min && brand.metrics.priceRange.max
      ? `${brand.metrics.priceRange.min}-${brand.metrics.priceRange.max} TL (${brand.metrics.priceRange.segment})`
      : 'Veri yok',
    competitorValues: competitors.map(c => ({
      name: c.name,
      value: c.metrics.priceRange.min && c.metrics.priceRange.max
        ? `${c.metrics.priceRange.min}-${c.metrics.priceRange.max} TL (${c.metrics.priceRange.segment})`
        : 'Veri yok',
    })),
    source: 'Website crawl',
    brandAdvantage: null,
  });

  // Google Rating
  rows.push({
    dimension: 'Google Puanı',
    brandValue: brand.metrics.googleRating ? `${brand.metrics.googleRating}/5 (${brand.metrics.googleReviewCount} yorum)` : 'Veri yok',
    competitorValues: competitors.map(c => ({
      name: c.name,
      value: c.metrics.googleRating ? `${c.metrics.googleRating}/5 (${c.metrics.googleReviewCount} yorum)` : 'Veri yok',
    })),
    source: 'Google Places',
    brandAdvantage: brand.metrics.googleRating && competitors.some(c => c.metrics.googleRating)
      ? brand.metrics.googleRating >= Math.max(...competitors.filter(c => c.metrics.googleRating).map(c => c.metrics.googleRating!))
      : null,
  });

  // Instagram Followers
  rows.push({
    dimension: 'Instagram Takipçi',
    brandValue: brand.metrics.instagramFollowers ? `${(brand.metrics.instagramFollowers / 1000).toFixed(1)}K` : 'Veri yok',
    competitorValues: competitors.map(c => ({
      name: c.name,
      value: c.metrics.instagramFollowers ? `${(c.metrics.instagramFollowers / 1000).toFixed(1)}K` : 'Veri yok',
    })),
    source: 'Instagram (Apify)',
    brandAdvantage: brand.metrics.instagramFollowers && competitors.some(c => c.metrics.instagramFollowers)
      ? brand.metrics.instagramFollowers >= Math.max(...competitors.filter(c => c.metrics.instagramFollowers).map(c => c.metrics.instagramFollowers!))
      : null,
  });

  // Engagement Rate
  rows.push({
    dimension: 'Engagement Rate',
    brandValue: brand.metrics.instagramEngagement ? `%${brand.metrics.instagramEngagement}` : 'Veri yok',
    competitorValues: competitors.map(c => ({
      name: c.name,
      value: c.metrics.instagramEngagement ? `%${c.metrics.instagramEngagement}` : 'Veri yok',
    })),
    source: 'Instagram (Apify)',
    brandAdvantage: brand.metrics.instagramEngagement && competitors.some(c => c.metrics.instagramEngagement)
      ? brand.metrics.instagramEngagement >= Math.max(...competitors.filter(c => c.metrics.instagramEngagement).map(c => c.metrics.instagramEngagement!))
      : null,
  });

  // Website Quality
  rows.push({
    dimension: 'Website Kalitesi',
    brandValue: brand.metrics.websiteQuality ? `${brand.metrics.websiteQuality}/10` : 'Veri yok',
    competitorValues: competitors.map(c => ({
      name: c.name,
      value: c.metrics.websiteQuality ? `${c.metrics.websiteQuality}/10` : 'Veri yok',
    })),
    source: 'Website crawl',
    brandAdvantage: brand.metrics.websiteQuality && competitors.some(c => c.metrics.websiteQuality)
      ? brand.metrics.websiteQuality >= Math.max(...competitors.filter(c => c.metrics.websiteQuality).map(c => c.metrics.websiteQuality!))
      : null,
  });

  // Product Count
  rows.push({
    dimension: 'Ürün Sayısı (Web)',
    brandValue: brand.metrics.productCount > 0 ? `${brand.metrics.productCount} ürün` : 'Veri yok',
    competitorValues: competitors.map(c => ({
      name: c.name,
      value: c.metrics.productCount > 0 ? `${c.metrics.productCount} ürün` : 'Veri yok',
    })),
    source: 'Website crawl',
    brandAdvantage: null,
  });

  return rows;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function gatherCompetitorIntelligence(
  brandName: string,
  brandWebsiteUrl: string | null,
  brandInstagramHandle: string | null,
  competitorNames: string[],
  sector: string,
  location?: string,
): Promise<CompetitorComparison> {
  const startTime = Date.now();
  const top3 = competitorNames.slice(0, 3); // Limit to top 3 for cost/time

  console.log(`[CompetitorIntel] Starting intelligence gathering for ${brandName} vs [${top3.join(', ')}]`);

  // Gather brand profile
  const brandProfile: CompetitorProfile = {
    name: brandName,
    websiteUrl: brandWebsiteUrl,
    websiteData: null, // Already gathered in Phase 0, don't re-fetch
    instagramHandle: brandInstagramHandle,
    instagramData: null, // Already gathered in Phase 0
    googlePlacesData: null, // Already gathered in Phase 0
    metrics: {
      priceRange: { min: null, max: null, segment: 'unknown' },
      websiteQuality: null,
      googleRating: null,
      googleReviewCount: 0,
      instagramFollowers: null,
      instagramEngagement: null,
      instagramPostFrequency: null,
      productCount: 0,
    },
  };

  // Gather competitor profiles in parallel (max 3 concurrent)
  const competitorProfiles = await Promise.all(
    top3.map(name => gatherCompetitorProfile(name, sector, location).catch((err) => {
      console.warn(`[CompetitorIntel] Failed for ${name}: ${err.message}`);
      return {
        name,
        websiteUrl: null, websiteData: null,
        instagramHandle: null, instagramData: null,
        googlePlacesData: null,
        metrics: { priceRange: { min: null, max: null, segment: 'unknown' }, websiteQuality: null, googleRating: null, googleReviewCount: 0, instagramFollowers: null, instagramEngagement: null, instagramPostFrequency: null, productCount: 0 },
      } as CompetitorProfile;
    }))
  );

  // Build comparison table
  const comparisonTable = buildComparisonTable(brandProfile, competitorProfiles);

  // Generate insights (which dimensions is the brand ahead/behind?)
  const insights: string[] = [];
  for (const row of comparisonTable) {
    if (row.brandAdvantage === true) {
      insights.push(`${row.dimension}: Rakiplerin önünde (kaynak: ${row.source})`);
    } else if (row.brandAdvantage === false) {
      insights.push(`${row.dimension}: Rakiplerin gerisinde — iyileştirme fırsatı (kaynak: ${row.source})`);
    }
  }

  const duration = Date.now() - startTime;
  console.log(`[CompetitorIntel] Done in ${(duration / 1000).toFixed(1)}s — ${competitorProfiles.filter(c => c.websiteData || c.instagramData || c.googlePlacesData).length}/${top3.length} competitors with data`);

  return {
    brand: brandProfile,
    competitors: competitorProfiles,
    comparisonTable,
    insights,
    gatherDuration: duration,
  };
}
