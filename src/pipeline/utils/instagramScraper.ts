/**
 * Instagram Data Extractor v2
 *
 * Primary: Apify Instagram Profile Scraper (reliable, handles anti-bot)
 * Fallback: Meta tag parsing (limited but zero-cost)
 *
 * Requires: APIFY_API_TOKEN env var for primary method.
 * Without it, falls back to meta tag scraper (unreliable).
 */

import { ApifyClient } from 'apify-client';

export interface InstagramPublicData {
  handle: string;
  displayName: string | null;
  bio: string | null;
  followerCount: number | null;
  followingCount: number | null;
  postCount: number | null;
  isVerified: boolean;
  isBusinessAccount: boolean;
  profilePicUrl: string | null;
  externalUrl: string | null;
  category: string | null;
  // Post analysis (Apify only)
  recentPosts: InstagramPost[];
  // Derived insights
  followerFollowingRatio: number | null;
  accountMaturity: 'new' | 'growing' | 'established' | 'large' | 'unknown';
  engagementRate: number | null;     // avg (likes+comments) / followers * 100
  postingFrequency: string | null;   // "daily", "3-4/week", "weekly", "irregular"
  topHashtags: string[];
  contentMix: { photos: number; videos: number; reels: number; carousels: number } | null;
  dataSource: 'apify' | 'meta_tags' | 'failed';
}

export interface InstagramPost {
  id: string;
  type: 'Image' | 'Video' | 'Sidecar';
  caption: string;
  likes: number;
  comments: number;
  timestamp: string;
  hashtags: string[];
  url: string;
}

function cleanHandle(handle: string): string {
  return handle
    .trim()
    .replace(/^@/, '')
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/[/?#].*$/, '')
    .toLowerCase();
}

function classifyAccount(followers: number | null): InstagramPublicData['accountMaturity'] {
  if (!followers) return 'unknown';
  if (followers < 1000) return 'new';
  if (followers < 10_000) return 'growing';
  if (followers < 100_000) return 'established';
  return 'large';
}

function calculatePostingFrequency(posts: InstagramPost[]): string | null {
  if (posts.length < 2) return null;
  const dates = posts.map(p => new Date(p.timestamp).getTime()).sort((a, b) => b - a);
  const totalDays = (dates[0] - dates[dates.length - 1]) / (1000 * 60 * 60 * 24);
  if (totalDays <= 0) return null;
  const postsPerWeek = (posts.length / totalDays) * 7;
  if (postsPerWeek >= 7) return 'daily';
  if (postsPerWeek >= 3) return '3-4/week';
  if (postsPerWeek >= 1) return 'weekly';
  return 'irregular';
}

function extractHashtags(caption: string): string[] {
  return (caption.match(/#[\wğüşıöçĞÜŞİÖÇ]+/g) || []).map(h => h.toLowerCase());
}

// ─── Primary: Apify Instagram Profile Scraper ────────────────────────────────

async function scrapeViaApify(handle: string): Promise<InstagramPublicData | null> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    console.log('instagramScraper: APIFY_API_TOKEN not configured — skipping Apify');
    return null;
  }

  try {
    const client = new ApifyClient({ token });

    console.log(`instagramScraper: Starting Apify scrape for @${handle}...`);
    const run = await client.actor('apify/instagram-profile-scraper').call(
      {
        usernames: [handle],
        resultsLimit: 20,
      },
      {
        timeout: 120, // seconds
        memory: 256,
      },
    );

    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    if (!items || items.length === 0) {
      console.log(`instagramScraper: Apify returned no results for @${handle}`);
      return null;
    }

    const profile: any = items[0];

    // Parse recent posts
    const recentPosts: InstagramPost[] = (profile.latestPosts || []).slice(0, 20).map((p: any) => ({
      id: p.id || p.shortCode || '',
      type: p.type || 'Image',
      caption: p.caption || '',
      likes: p.likesCount || p.likes || 0,
      comments: p.commentsCount || p.comments || 0,
      timestamp: p.timestamp || p.takenAtTimestamp || '',
      hashtags: extractHashtags(p.caption || ''),
      url: p.url || `https://www.instagram.com/p/${p.shortCode}/`,
    }));

    // Calculate engagement rate
    const followers = profile.followersCount || profile.followers || null;
    let engagementRate: number | null = null;
    if (followers && followers > 0 && recentPosts.length > 0) {
      const totalEngagement = recentPosts.reduce((sum, p) => sum + p.likes + p.comments, 0);
      engagementRate = Math.round((totalEngagement / recentPosts.length / followers) * 10000) / 100;
    }

    // Top hashtags
    const hashtagCounts: Record<string, number> = {};
    for (const post of recentPosts) {
      for (const tag of post.hashtags) {
        hashtagCounts[tag] = (hashtagCounts[tag] || 0) + 1;
      }
    }
    const topHashtags = Object.entries(hashtagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([tag]) => tag);

    // Content mix
    const contentMix = { photos: 0, videos: 0, reels: 0, carousels: 0 };
    for (const post of recentPosts) {
      if (post.type === 'Sidecar') contentMix.carousels++;
      else if (post.type === 'Video') contentMix.videos++;
      else contentMix.photos++;
    }

    const result: InstagramPublicData = {
      handle,
      displayName: profile.fullName || profile.name || null,
      bio: profile.biography || profile.bio || null,
      followerCount: followers,
      followingCount: profile.followsCount || profile.following || null,
      postCount: profile.postsCount || profile.posts || null,
      isVerified: profile.verified || profile.isVerified || false,
      isBusinessAccount: profile.isBusinessAccount || false,
      profilePicUrl: profile.profilePicUrl || profile.profilePicUrlHD || null,
      externalUrl: profile.externalUrl || null,
      category: profile.businessCategoryName || profile.categoryName || null,
      recentPosts,
      followerFollowingRatio: null,
      accountMaturity: classifyAccount(followers),
      engagementRate,
      postingFrequency: calculatePostingFrequency(recentPosts),
      topHashtags,
      contentMix: recentPosts.length > 0 ? contentMix : null,
      dataSource: 'apify',
    };

    if (result.followerCount && result.followingCount && result.followingCount > 0) {
      result.followerFollowingRatio = Math.round((result.followerCount / result.followingCount) * 10) / 10;
    }

    console.log(`instagramScraper: Apify OK — @${handle}: followers=${result.followerCount}, posts=${result.postCount}, engagement=${engagementRate}%, recentPosts=${recentPosts.length}`);
    return result;
  } catch (err: any) {
    console.warn(`instagramScraper: Apify failed for @${handle}: ${err.message}`);
    return null;
  }
}

// ─── Fallback: Meta Tag Scraper (unreliable but zero-cost) ────────────────────

async function scrapeViaMetaTags(handle: string): Promise<InstagramPublicData | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);

    const response = await fetch(`https://www.instagram.com/${handle}/`, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
    });
    clearTimeout(timer);

    if (!response.ok) return null;
    const html = await response.text();

    const getMetaContent = (prop: string): string | null => {
      const match = html.match(new RegExp(`<meta[^>]*(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']`, 'i'))
        || html.match(new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`, 'i'));
      return match ? match[1] : null;
    };

    const desc = getMetaContent('og:description') || getMetaContent('description') || '';

    // Parse counts from description
    const followersMatch = desc.match(/([\d,.]+[KMB]?)\s*(?:Followers|Takipçi)/i);
    const followingMatch = desc.match(/([\d,.]+[KMB]?)\s*(?:Following|Takip\b)/i);
    const postsMatch = desc.match(/([\d,.]+[KMB]?)\s*(?:Posts|Gönderi)/i);

    const parseShort = (s: string): number => {
      const cleaned = s.replace(/,/g, '').trim();
      const m = cleaned.match(/([\d.]+)\s*([KMB])/i);
      if (m) {
        const num = parseFloat(m[1]);
        const mult = m[2].toUpperCase();
        if (mult === 'K') return Math.round(num * 1_000);
        if (mult === 'M') return Math.round(num * 1_000_000);
        if (mult === 'B') return Math.round(num * 1_000_000_000);
      }
      return parseInt(cleaned) || 0;
    };

    const followerCount = followersMatch ? parseShort(followersMatch[1]) : null;

    return {
      handle,
      displayName: getMetaContent('og:title')?.replace(/ ?\(@[^)]+\).*$/, '').replace(/ on Instagram$/, '').trim() || null,
      bio: desc.replace(/^[\d,.]+[KMB]?\s*(Followers|Takipçi).*?[-–—]\s*/i, '').trim().slice(0, 500) || null,
      followerCount,
      followingCount: followingMatch ? parseShort(followingMatch[1]) : null,
      postCount: postsMatch ? parseShort(postsMatch[1]) : null,
      isVerified: html.includes('"is_verified":true'),
      isBusinessAccount: html.includes('"is_business_account":true'),
      profilePicUrl: getMetaContent('og:image') || null,
      externalUrl: null,
      category: null,
      recentPosts: [],
      followerFollowingRatio: null,
      accountMaturity: classifyAccount(followerCount),
      engagementRate: null,
      postingFrequency: null,
      topHashtags: [],
      contentMix: null,
      dataSource: 'meta_tags',
    };
  } catch {
    return null;
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function scrapeInstagramPublic(rawHandle: string): Promise<InstagramPublicData | null> {
  const handle = cleanHandle(rawHandle);
  if (!handle || handle.length < 2) return null;

  // Try Apify first (reliable), fall back to meta tags (unreliable)
  const apifyResult = await scrapeViaApify(handle);
  if (apifyResult) return apifyResult;

  console.log(`instagramScraper: Falling back to meta tag scraper for @${handle}`);
  const metaResult = await scrapeViaMetaTags(handle);
  if (metaResult) {
    console.log(`instagramScraper: Meta tags — @${handle}: followers=${metaResult.followerCount}`);
    return metaResult;
  }

  console.log(`instagramScraper: All methods failed for @${handle}`);
  return null;
}
