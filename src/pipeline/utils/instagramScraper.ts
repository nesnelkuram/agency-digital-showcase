/**
 * Instagram Public Data Extractor
 *
 * Extracts publicly available data from Instagram profiles without API keys.
 * Uses the public web page + meta tags. Limited but zero-cost.
 *
 * Fallback: if scraping fails, returns null (non-fatal).
 */

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
  // Derived insights
  followerFollowingRatio: number | null; // >10 = strong brand, <1 = inactive
  accountMaturity: 'new' | 'growing' | 'established' | 'large' | 'unknown';
}

const FETCH_TIMEOUT_MS = 8_000;

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

export async function scrapeInstagramPublic(rawHandle: string): Promise<InstagramPublicData | null> {
  const handle = cleanHandle(rawHandle);
  if (!handle || handle.length < 2) return null;

  const url = `https://www.instagram.com/${handle}/`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8',
      },
    });

    clearTimeout(timer);

    if (!response.ok) {
      console.log(`instagramScraper: ${handle} — HTTP ${response.status}`);
      return null;
    }

    const html = await response.text();

    // Try to extract from meta tags (most reliable public data source)
    const result: InstagramPublicData = {
      handle,
      displayName: extractMeta(html, 'og:title')?.replace(/ ?\(@[^)]+\).*$/, '').replace(/ on Instagram$/, '').trim() || null,
      bio: extractMeta(html, 'og:description') || extractMeta(html, 'description') || null,
      followerCount: null,
      followingCount: null,
      postCount: null,
      isVerified: html.includes('"is_verified":true'),
      isBusinessAccount: html.includes('"is_business_account":true'),
      profilePicUrl: extractMeta(html, 'og:image') || null,
      externalUrl: null,
      category: null,
      followerFollowingRatio: null,
      accountMaturity: 'unknown',
    };

    // Extract counts from description: "123K Followers, 45 Following, 678 Posts"
    const desc = result.bio || '';
    const followersMatch = desc.match(/([\d,.]+[KMB]?)\s*Followers/i)
      || desc.match(/([\d,.]+[KMB]?)\s*Takipçi/i);
    const followingMatch = desc.match(/([\d,.]+[KMB]?)\s*Following/i)
      || desc.match(/([\d,.]+[KMB]?)\s*Takip\s/i);
    const postsMatch = desc.match(/([\d,.]+[KMB]?)\s*Posts/i)
      || desc.match(/([\d,.]+[KMB]?)\s*Gönderi/i);

    if (followersMatch) result.followerCount = parseShortNumber(followersMatch[1]);
    if (followingMatch) result.followingCount = parseShortNumber(followingMatch[1]);
    if (postsMatch) result.postCount = parseShortNumber(postsMatch[1]);

    // Try JSON-LD or embedded data as fallback
    const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    if (jsonLdMatch) {
      try {
        const ld = JSON.parse(jsonLdMatch[1]);
        if (ld.mainEntityofPage?.interactionStatistic) {
          for (const stat of ld.mainEntityofPage.interactionStatistic) {
            if (stat.interactionType?.includes('Follow') && stat.userInteractionCount) {
              result.followerCount = result.followerCount || parseInt(stat.userInteractionCount);
            }
          }
        }
        if (ld.description && !result.bio) result.bio = ld.description;
        if (ld.name && !result.displayName) result.displayName = ld.name;
      } catch { /* ignore JSON-LD parse errors */ }
    }

    // Try SharedData embedded JSON (may be blocked by Instagram)
    const sharedDataMatch = html.match(/window\._sharedData\s*=\s*({[\s\S]*?});\s*<\/script>/);
    if (sharedDataMatch) {
      try {
        const shared = JSON.parse(sharedDataMatch[1]);
        const user = shared.entry_data?.ProfilePage?.[0]?.graphql?.user;
        if (user) {
          result.followerCount = result.followerCount || user.edge_followed_by?.count;
          result.followingCount = result.followingCount || user.edge_follow?.count;
          result.postCount = result.postCount || user.edge_owner_to_timeline_media?.count;
          result.bio = result.bio || user.biography;
          result.externalUrl = user.external_url || null;
          result.category = user.category_name || null;
          result.isVerified = user.is_verified || result.isVerified;
          result.isBusinessAccount = user.is_business_account || result.isBusinessAccount;
        }
      } catch { /* ignore SharedData parse errors */ }
    }

    // Clean up bio — remove the stats prefix that Instagram puts in meta description
    if (result.bio) {
      result.bio = result.bio
        .replace(/^[\d,.]+[KMB]?\s*(Followers|Takipçi).*?[-–—]\s*/i, '')
        .replace(/^See Instagram photos and videos from .+$/i, '')
        .trim()
        .slice(0, 500);
    }

    // Derived insights
    if (result.followerCount && result.followingCount && result.followingCount > 0) {
      result.followerFollowingRatio = Math.round((result.followerCount / result.followingCount) * 10) / 10;
    }
    result.accountMaturity = classifyAccount(result.followerCount);

    console.log(`instagramScraper: @${handle} — followers=${result.followerCount}, posts=${result.postCount}, maturity=${result.accountMaturity}, verified=${result.isVerified}`);

    return result;
  } catch (err: any) {
    console.log(`instagramScraper: @${handle} — failed: ${err.message}`);
    return null;
  }
}

function extractMeta(html: string, property: string): string | null {
  // og: tags
  const ogMatch = html.match(new RegExp(`<meta[^>]*property=["']${property}["'][^>]*content=["']([^"']*)["']`, 'i'))
    || html.match(new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*property=["']${property}["']`, 'i'));
  if (ogMatch) return ogMatch[1];

  // name tags (for description)
  const nameMatch = html.match(new RegExp(`<meta[^>]*name=["']${property}["'][^>]*content=["']([^"']*)["']`, 'i'))
    || html.match(new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*name=["']${property}["']`, 'i'));
  return nameMatch ? nameMatch[1] : null;
}

function parseShortNumber(str: string): number {
  const cleaned = str.replace(/,/g, '').trim();
  const multiplierMatch = cleaned.match(/([\d.]+)\s*([KMB])/i);
  if (multiplierMatch) {
    const num = parseFloat(multiplierMatch[1]);
    const mult = multiplierMatch[2].toUpperCase();
    if (mult === 'K') return Math.round(num * 1_000);
    if (mult === 'M') return Math.round(num * 1_000_000);
    if (mult === 'B') return Math.round(num * 1_000_000_000);
  }
  return parseInt(cleaned) || 0;
}
