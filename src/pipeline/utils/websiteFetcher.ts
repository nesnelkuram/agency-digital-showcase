import * as cheerio from 'cheerio';
import { findPhoneNumbersInText } from 'libphonenumber-js';
// @ts-ignore — no type declarations
import parseDecimalNumber from 'parse-decimal-number';

export interface FetchedWebsite {
  url: string;
  title: string;
  metaDescription: string;
  ogTags: Record<string, string>;
  navigation: string[];
  internalLinks: string[];
  productListings: Array<{ name: string; price?: string; imageAlt?: string; sourceUrl?: string }>;
  ctaButtons: string[];
  headings: string[];
  textContent: string;
  fetchDurationMs: number;
  pagesScraped: string[];
  // v2: Structured business intelligence (zero LLM cost)
  businessIntel: {
    socialLinks: Record<string, string>;  // instagram, facebook, twitter, linkedin, youtube, tiktok
    contactInfo: { phones: string[]; emails: string[]; addresses: string[] };
    priceRange: { min: number | null; max: number | null; currency: string; segment: 'budget' | 'mid' | 'premium' | 'luxury' | 'unknown'; avgPrice: number | null };
    aboutText: string;                    // hakkımızda/about page text
    foundingYear: number | null;          // extracted from text patterns + JSON-LD
    teamSize: string | null;              // "10+ kişi" etc.
    locationCount: number;                // number of branch/location mentions
    certifications: string[];             // ISO, TURKAK, etc.
    testimonialCount: number;             // review/testimonial sections found
    jsonLd: Record<string, any>;          // raw JSON-LD structured data (schema.org)
  };
}

interface PageData {
  url: string;
  title: string;
  headings: string[];
  products: Array<{ name: string; price?: string; imageAlt?: string; sourceUrl?: string }>;
  ctaButtons: string[];
  textContent: string;
  internalLinks: string[];
}

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; BrandAnalyzer/1.0)',
  'Accept': 'text/html,application/xhtml+xml',
  'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8',
};

// Max pages to crawl total (homepage + sub-pages)
const MAX_PAGES = 14;
// Per-page fetch timeout
const PAGE_TIMEOUT_MS = 6_000;
// Max concurrent fetches
const CONCURRENCY = 6;

async function fetchPage(url: string): Promise<{ html: string; finalUrl: string } | null> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), PAGE_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: FETCH_HEADERS });
    clearTimeout(t);
    if (!res.ok) return null;
    const html = await res.text();
    return html.length >= 100 ? { html, finalUrl: res.url || url } : null;
  } catch {
    clearTimeout(t);
    return null;
  }
}

function parsePage(url: string, html: string, baseOrigin: string): PageData {
  const $ = cheerio.load(html);

  // Headings
  const headings: string[] = [];
  $('h1, h2, h3').each((_, el) => {
    const t = $(el).text().trim();
    if (t && t.length < 200) headings.push(t);
  });

  // Products — schema.org first
  const products: Array<{ name: string; price?: string; imageAlt?: string; sourceUrl?: string }> = [];
  $('[itemtype*="schema.org/Product"], [typeof="Product"]').each((_, el) => {
    const name = $(el).find('[itemprop="name"]').first().text().trim();
    const price = $(el).find('[itemprop="price"]').first().text().trim()
      || $(el).find('[itemprop="price"]').first().attr('content')?.trim();
    if (name) products.push({ name, price: price || undefined, sourceUrl: url });
  });

  // Products — class patterns
  $('[class*="product"], [class*="Product"], [data-product], [class*="urun"], [class*="item-card"]').each((_, el) => {
    const nameEl = $(el).find('[class*="title"], [class*="name"], [class*="baslik"], h2, h3, h4').first();
    const priceEl = $(el).find('[class*="price"], [class*="fiyat"], [class*="tutar"]').first();
    const imgEl = $(el).find('img').first();
    const name = nameEl.text().trim();
    const price = priceEl.text().trim();
    if (name && name.length > 2 && name.length < 200) {
      products.push({ name, price: price || undefined, imageAlt: imgEl.attr('alt')?.trim() || undefined, sourceUrl: url });
    }
  });

  // Products — price-adjacent text (find ₺ or TL near a heading)
  if (products.length === 0) {
    $('*').filter((_, el) => {
      const text = $(el).text();
      return /[₺][\d.,\s]+|[\d.,]+\s*TL/.test(text) && $(el).children().length < 5;
    }).each((_, el) => {
      const text = $(el).text().trim();
      const priceMatch = text.match(/[₺][\d.,\s]+|[\d.,]+\s*TL/);
      if (priceMatch && text.length < 300) {
        products.push({ name: text.replace(priceMatch[0], '').trim().slice(0, 100), price: priceMatch[0].trim(), sourceUrl: url });
      }
    });
  }

  // CTA buttons
  const ctaButtons: string[] = [];
  $('a[class*="btn"], button, a[class*="cta"], a[class*="button"], [class*="action"] a').each((_, el) => {
    const text = $(el).text().trim();
    if (text && text.length > 1 && text.length < 60 && !ctaButtons.includes(text)) ctaButtons.push(text);
  });

  // Internal links
  const internalLinks: string[] = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href')?.trim() || '';
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return;
    let resolved: string;
    try {
      resolved = href.startsWith('http') ? href : new URL(href, url).href;
    } catch { return; }
    if (!resolved.startsWith(baseOrigin)) return;
    // Strip hash/query
    const clean = resolved.split('#')[0].split('?')[0].replace(/\/$/, '') || baseOrigin;
    // Skip media files, PDFs, archives
    if (/\.(pdf|jpg|jpeg|png|gif|svg|webp|zip|mp4|mp3|doc|docx|xls|xlsx)(\?.*)?$/i.test(clean)) return;
    if (!internalLinks.includes(clean)) internalLinks.push(clean);
  });

  // Text content
  $('script, style, noscript, svg, iframe, header, footer, nav').remove();
  const textContent = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 3000);

  return { url, title: $('title').first().text().trim(), headings, products, ctaButtons, textContent, internalLinks };
}

/** Score a URL to prioritize product/category pages */
function scoreUrl(url: string): number {
  const path = url.split('/').pop() || '';
  // High priority: paths that look like product/category pages
  if (/parke|zemin|laminat|masif|ürün|urun|koleksiyon|marka|katalog|fiyat/i.test(path)) return 10;
  if (/hakkimizda|about|iletisim|contact|referans|blog/i.test(path)) return 3;
  return 5;
}

// ─── Business Intelligence Extractors (zero LLM cost) ────────────────────────

// ─── Business Intelligence Extractors v2 ─────────────────────────────────────
// Uses: libphonenumber-js, parse-decimal-number, cheerio-based JSON-LD extraction

/** Extract social media links from all page links + footer + head + JSON-LD sameAs */
function extractSocialLinks(allLinks: string[], htmlPages: string[]): Record<string, string> {
  const social: Record<string, string> = {};
  const patterns: Array<[string, RegExp]> = [
    ['instagram', /(?:www\.)?instagram\.com\/([^/?#\s]+)/i],
    ['facebook', /(?:www\.)?facebook\.com\/([^/?#\s]+)/i],
    ['twitter', /(?:www\.)?(twitter|x)\.com\/([^/?#\s]+)/i],
    ['linkedin', /(?:www\.)?linkedin\.com\/(company|in)\/([^/?#\s]+)/i],
    ['youtube', /(?:www\.)?youtube\.com\/(channel|c|@|user)\/([^/?#\s]+)/i],
    ['tiktok', /(?:www\.)?tiktok\.com\/@([^/?#\s]+)/i],
    ['pinterest', /(?:www\.)?pinterest\.\w+\/([^/?#\s]+)/i],
  ];

  // Check all collected links
  for (const link of allLinks) {
    for (const [platform, regex] of patterns) {
      if (!social[platform] && regex.test(link)) {
        social[platform] = link;
      }
    }
  }

  // Also search JSON-LD sameAs and raw HTML for social links missed in text extraction
  for (const html of htmlPages) {
    // JSON-LD sameAs
    const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
    for (const block of jsonLdMatches) {
      try {
        const content = block.replace(/<\/?script[^>]*>/gi, '');
        const ld = JSON.parse(content);
        const sameAs = ld.sameAs || (Array.isArray(ld) ? ld[0]?.sameAs : null);
        if (Array.isArray(sameAs)) {
          for (const url of sameAs) {
            for (const [platform, regex] of patterns) {
              if (!social[platform] && typeof url === 'string' && regex.test(url)) {
                social[platform] = url;
              }
            }
          }
        }
      } catch { /* ignore parse errors */ }
    }

    // Footer and header links (often contain social icons)
    const $ = cheerio.load(html);
    $('footer a[href], header a[href], [class*="social"] a[href], [class*="footer"] a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      for (const [platform, regex] of patterns) {
        if (!social[platform] && regex.test(href)) {
          social[platform] = href;
        }
      }
    });
  }

  return social;
}

/** Extract contact info using libphonenumber-js for proper Turkish phone parsing */
function extractContactInfo(text: string, allLinks: string[]): { phones: string[]; emails: string[]; addresses: string[] } {
  // Phones — libphonenumber-js handles all Turkish formats
  const phoneNumbers = findPhoneNumbersInText(text, 'TR');
  const phones = [...new Set(
    phoneNumbers.map(p => p.number.formatInternational())
  )].slice(0, 5);

  // Emails — regex + mailto links
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const foundEmails = (text.match(emailRegex) || [])
    .filter(e => !e.includes('example') && !e.includes('sentry') && !e.includes('wixpress') && !e.includes('placeholder'));

  for (const link of allLinks) {
    const m = link.match(/mailto:([^?]+)/);
    if (m) foundEmails.push(m[1]);
  }
  const emails = [...new Set(foundEmails)].slice(0, 5);

  // Addresses — Turkish patterns
  const addresses: string[] = [];
  const addrPatterns = [
    /(?:Mah(?:allesi)?\.?\s*)[^,.\n]{5,60}(?:,\s*)?(?:Cad(?:desi)?\.?\s*|Sok(?:ak|ağı)?\.?\s*|Bulvarı\s*)?[^,.\n]{0,40}(?:No\.?\s*\d+)?/gi,
    /(?:Cad(?:desi)?\.?\s*)[^,.\n]{5,60}(?:No\.?\s*:?\s*\d+)?/gi,
  ];
  for (const pattern of addrPatterns) {
    const matches = text.match(pattern) || [];
    for (const m of matches.slice(0, 3)) {
      const cleaned = m.trim().replace(/\s+/g, ' ');
      if (cleaned.length > 15 && !addresses.includes(cleaned)) {
        addresses.push(cleaned);
      }
    }
  }

  return { phones, emails, addresses: addresses.slice(0, 3) };
}

/** Parse Turkish price format: 1.315,50 TL = 1315.50 */
function parseTurkishPrice(priceStr: string): number | null {
  if (!priceStr) return null;
  const cleaned = priceStr.replace(/[^\d.,]/g, '').trim();
  if (!cleaned) return null;

  // Try parse-decimal-number with Turkish locale (dot=thousands, comma=decimal)
  const result = parseDecimalNumber(cleaned, { thousands: '.', decimal: ',' });
  if (!isNaN(result) && result > 0 && result < 10_000_000) return result;

  // Fallback: manual detection
  if (cleaned.includes('.') && cleaned.includes(',')) {
    // "1.315,50" → Turkish format
    return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
  }
  if (cleaned.includes('.') && !cleaned.includes(',')) {
    const parts = cleaned.split('.');
    const lastPart = parts[parts.length - 1];
    // "1.315" (3 digits after dot) = thousands separator = 1315
    if (lastPart.length === 3) return parseFloat(cleaned.replace(/\./g, ''));
    // "1.50" (2 digits) = decimal
    return parseFloat(cleaned);
  }
  if (cleaned.includes(',') && !cleaned.includes('.')) {
    return parseFloat(cleaned.replace(',', '.'));
  }
  return parseFloat(cleaned) || null;
}

/** Extract price range from products with proper Turkish format handling */
function extractPriceRange(products: Array<{ price?: string }>): { min: number | null; max: number | null; currency: string; segment: 'budget' | 'mid' | 'premium' | 'luxury' | 'unknown'; avgPrice: number | null } {
  const prices: number[] = [];
  for (const p of products) {
    const num = parseTurkishPrice(p.price || '');
    if (num && num > 1 && num < 10_000_000) prices.push(num);
  }

  if (prices.length === 0) return { min: null, max: null, currency: 'TRY', segment: 'unknown', avgPrice: null };

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;

  // Segment based on average price (TRY heuristic, 2026 pricing)
  const segment = avg < 200 ? 'budget' : avg < 1000 ? 'mid' : avg < 5000 ? 'premium' : 'luxury';

  return { min: Math.round(min), max: Math.round(max), currency: 'TRY', segment, avgPrice: Math.round(avg) };
}

/** Extract founding year from text + JSON-LD */
function extractFoundingYear(text: string, htmlPages: string[]): number | null {
  // Try JSON-LD foundingDate first (most reliable)
  for (const html of htmlPages) {
    const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
    for (const block of jsonLdMatches) {
      try {
        const content = block.replace(/<\/?script[^>]*>/gi, '');
        const ld = JSON.parse(content);
        const date = ld.foundingDate || (Array.isArray(ld) ? ld[0]?.foundingDate : null);
        if (date) {
          const year = parseInt(String(date).slice(0, 4));
          if (year >= 1900 && year <= new Date().getFullYear()) return year;
        }
      } catch { /* ignore */ }
    }
  }

  // Fallback: regex patterns in text
  const patterns = [
    /(?:kuruldu|kurulmuş|beri|since|est\.?|founded)\s*(?:in\s+)?(\d{4})/i,
    /(\d{4})\s*(?:'[td]en|'dan|'den|yılından)\s*(?:beri|itibaren)/i,
    /(\d{4})\s*yılında\s*(?:kurul|açıl|başla|faaliyet)/i,
    /(\d{4})\s*(?:yılından|senesinden)\s*(?:bu yana|beri)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const year = parseInt(match[1]);
      if (year >= 1900 && year <= new Date().getFullYear()) return year;
    }
  }
  return null;
}

/** Extract about/hakkımızda text from pages */
function extractAboutText(pages: PageData[], htmlPages: string[]): string {
  // Find about page
  const aboutPage = pages.find(p =>
    /hakkimizda|hakkinda|about|biz-kimiz|hikayemiz|story|kurumsal/i.test(p.url)
  );
  if (aboutPage && aboutPage.textContent.length > 100) {
    return aboutPage.textContent.slice(0, 2000);
  }

  // Try JSON-LD description
  for (const html of htmlPages) {
    const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
    for (const block of jsonLdMatches) {
      try {
        const content = block.replace(/<\/?script[^>]*>/gi, '');
        const ld = JSON.parse(content);
        const desc = ld.description || (Array.isArray(ld) ? ld[0]?.description : null);
        if (desc && desc.length > 50) return desc.slice(0, 2000);
      } catch { /* ignore */ }
    }
  }

  // Fallback: look for about sections in any page
  for (const page of pages) {
    const text = page.textContent.toLowerCase();
    for (const keyword of ['hakkımızda', 'hakkimizda', 'hikayemiz', 'biz kimiz', 'about us']) {
      const idx = text.indexOf(keyword);
      if (idx !== -1) return page.textContent.slice(idx, idx + 1500);
    }
  }
  return '';
}

/** Extract location/branch count */
function extractLocationCount(text: string): number {
  const branchPatterns = /(\d+)\s*(?:şube|mağaza|lokasyon|branch|location|store|bayi|showroom)/gi;
  const matches = [...text.matchAll(branchPatterns)];
  if (matches.length > 0) {
    return Math.max(...matches.map(m => parseInt(m[1])));
  }
  const addressCount = (text.match(/(?:Mah\.|Cad\.|Sok\.)/gi) || []).length;
  return Math.min(addressCount, 10);
}

/** Extract certifications */
function extractCertifications(text: string): string[] {
  const certs: string[] = [];
  const patterns = [
    /ISO\s*\d{4,5}(?::\d{4})?/gi,
    /TÜRKAK/gi, /TSE\s*\w*/gi, /CE\s+(?:belgeli|sertifikalı|işaretli)/gi,
    /GMP/g, /HACCP/gi, /Helal\s*(?:Sertifika|Belgeli)/gi,
    /Organik\s*(?:Sertifika|Belgeli)/gi, /LEED\s*\w*/gi,
    /EPD\s*(?:belgeli|sertifikalı)?/gi, /FSC\s*(?:belgeli|sertifikalı)?/gi,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) certs.push(...m.map(c => c.trim()));
  }
  return [...new Set(certs)].slice(0, 15);
}

/** Count testimonials/reviews sections */
function countTestimonials(textParts: string[]): number {
  let count = 0;
  const keywords = /(?:referans|müşteri\s*yorum|testimonial|review|değerlendirme|görüş|başarı\s*hikaye)/gi;
  for (const text of textParts) {
    count += (text.match(keywords) || []).length;
  }
  return Math.min(count, 50);
}

/** Extract structured data from JSON-LD (schema.org) */
function extractJsonLd(htmlPages: string[]): Record<string, any> {
  const structured: Record<string, any> = {};
  for (const html of htmlPages) {
    const blocks = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
    for (const block of blocks) {
      try {
        const content = block.replace(/<\/?script[^>]*>/gi, '');
        const ld = JSON.parse(content);
        const items = Array.isArray(ld) ? ld : [ld];
        for (const item of items) {
          const type = item['@type'];
          if (type && !structured[type]) structured[type] = item;
        }
      } catch { /* ignore */ }
    }
  }
  return structured;
}

export async function fetchAndParseWebsite(url: string): Promise<FetchedWebsite | null> {
  const start = Date.now();

  try {
    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('http')) normalizedUrl = `https://${normalizedUrl}`;
    // Ensure trailing slash removed for consistency
    const baseOrigin = new URL(normalizedUrl).origin;

    // --- Step 1: Fetch homepage ---
    const homeResult = await fetchPage(normalizedUrl);
    if (!homeResult) {
      console.log(`websiteFetcher: Failed to fetch homepage ${normalizedUrl}`);
      return null;
    }

    const homePage = parsePage(normalizedUrl, homeResult.html, baseOrigin);
    const $ = cheerio.load(homeResult.html);

    // Homepage metadata
    const title = $('title').first().text().trim() || '';
    const metaDescription = $('meta[name="description"]').attr('content')?.trim() || '';
    const ogTags: Record<string, string> = {};
    $('meta[property^="og:"]').each((_, el) => {
      const prop = $(el).attr('property')?.replace('og:', '') || '';
      const content = $(el).attr('content') || '';
      if (prop && content) ogTags[prop] = content;
    });
    const navigation: string[] = [];
    $('nav a, header a, [class*="nav"] a, [class*="menu"] a').each((_, el) => {
      const text = $(el).text().trim();
      if (text && text.length < 50 && !navigation.includes(text)) navigation.push(text);
    });

    console.log(`websiteFetcher: Homepage parsed — nav=${navigation.length}, links=${homePage.internalLinks.length}`);

    // --- Step 2: Discover and crawl sub-pages ---
    const visited = new Set<string>([normalizedUrl, normalizedUrl.replace(/\/$/, '')]);
    const pagesScraped: string[] = [normalizedUrl];

    // Score and sort candidate URLs
    const candidates = homePage.internalLinks
      .filter(u => !visited.has(u) && u !== baseOrigin)
      .sort((a, b) => scoreUrl(b) - scoreUrl(a))
      .slice(0, MAX_PAGES - 1);

    // Crawl in parallel batches — hard limit on total pages
    const subPages: PageData[] = [];
    let totalCrawled = 1; // homepage already counted

    for (let i = 0; i < candidates.length && totalCrawled < MAX_PAGES; i += CONCURRENCY) {
      const remaining = MAX_PAGES - totalCrawled;
      const batch = candidates.slice(i, i + Math.min(CONCURRENCY, remaining));
      const results = await Promise.allSettled(
        batch.map(async (pageUrl) => {
          if (visited.has(pageUrl)) return null;
          visited.add(pageUrl);
          const result = await fetchPage(pageUrl);
          if (!result) return null;
          const pageData = parsePage(pageUrl, result.html, baseOrigin);
          console.log(`websiteFetcher: ${pageUrl} — products=${pageData.products.length}, headings=${pageData.headings.length}`);
          return pageData;
        })
      );
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) {
          subPages.push(r.value);
          pagesScraped.push(r.value.url);
          totalCrawled++;
        }
      }

      // Discover product-looking links from new pages (one-time, cap at MAX_PAGES)
      if (totalCrawled < MAX_PAGES) {
        const newlyAdded = new Set<string>();
        for (const page of subPages.slice(-CONCURRENCY)) {
          for (const link of page.internalLinks) {
            if (!visited.has(link) && !candidates.includes(link) && scoreUrl(link) >= 8 && !newlyAdded.has(link)) {
              candidates.push(link);
              newlyAdded.add(link);
            }
          }
        }
      }
    }

    // --- Step 3: Merge all data ---
    const allProducts = [...homePage.products];
    const allHeadings = [...homePage.headings];
    const allCTAs = [...homePage.ctaButtons];
    const textParts = [homePage.textContent];
    const allInternalLinks = [...new Set(homePage.internalLinks)];

    for (const page of subPages) {
      for (const p of page.products) {
        if (!allProducts.find(x => x.name === p.name)) allProducts.push(p);
      }
      for (const h of page.headings) {
        if (!allHeadings.includes(h)) allHeadings.push(h);
      }
      for (const c of page.ctaButtons) {
        if (!allCTAs.includes(c)) allCTAs.push(c);
      }
      if (page.textContent) textParts.push(`\n[${page.url}]\n${page.textContent}`);
    }

    // Deduplicate products
    const seenNames = new Set<string>();
    const uniqueProducts = allProducts.filter(p => {
      const key = p.name.toLowerCase().slice(0, 60);
      if (seenNames.has(key)) return false;
      seenNames.add(key);
      return true;
    }).slice(0, 50);

    // --- Step 4: Extract structured business intelligence (v2) ---
    const allText = textParts.join(' ');
    const allPages = [homePage, ...subPages];

    // Collect all links (internal + external + social) from all pages
    const allExternalLinks: string[] = [];
    const urlRegex = /https?:\/\/[^\s"'<>)]+/gi;
    for (const text of textParts) {
      const urls = text.match(urlRegex) || [];
      allExternalLinks.push(...urls);
    }

    // Collect raw HTML from all pages for JSON-LD and footer extraction
    const htmlPagesRaw: string[] = [homeResult.html];
    // Note: subPages don't have raw HTML stored, only parsed data
    // Re-fetch about page HTML for JSON-LD if we found one
    const aboutPageUrl = allInternalLinks.find(u =>
      /hakkimizda|hakkinda|about|biz-kimiz|hikayemiz|story|kurumsal/i.test(u)
    );
    if (aboutPageUrl && !htmlPagesRaw.some(h => h.includes(aboutPageUrl))) {
      const aboutHtml = await fetchPage(aboutPageUrl);
      if (aboutHtml) htmlPagesRaw.push(aboutHtml.html);
    }

    // Extract JSON-LD structured data
    const jsonLd = extractJsonLd(htmlPagesRaw);

    const businessIntel: FetchedWebsite['businessIntel'] = {
      socialLinks: extractSocialLinks([...allExternalLinks, ...allInternalLinks], htmlPagesRaw),
      contactInfo: extractContactInfo(allText, [...allExternalLinks, ...allInternalLinks]),
      priceRange: extractPriceRange(uniqueProducts),
      aboutText: extractAboutText(allPages, htmlPagesRaw),
      foundingYear: extractFoundingYear(allText, htmlPagesRaw),
      teamSize: (() => {
        const match = allText.match(/(\d+)\s*(?:\+\s*)?(?:kişi|çalışan|personel|ekip\s*üyesi|employee)/i);
        return match ? `${match[1]}+ kişi` : null;
      })(),
      locationCount: extractLocationCount(allText),
      certifications: extractCertifications(allText),
      testimonialCount: countTestimonials(textParts),
      jsonLd,
    };

    console.log(`websiteFetcher: Done — pages=${pagesScraped.length}, products=${uniqueProducts.length}, social=${Object.keys(businessIntel.socialLinks).length}, phones=${businessIntel.contactInfo.phones.length}, priceSegment=${businessIntel.priceRange.segment}(avg:${businessIntel.priceRange.avgPrice}), foundingYear=${businessIntel.foundingYear}, jsonLd=${Object.keys(jsonLd).join(',') || 'none'}, elapsed=${Date.now() - start}ms`);

    return {
      url: normalizedUrl,
      title,
      metaDescription,
      ogTags,
      navigation: navigation.slice(0, 30),
      internalLinks: allInternalLinks.slice(0, 50),
      productListings: uniqueProducts,
      ctaButtons: allCTAs.slice(0, 20),
      headings: allHeadings.slice(0, 60),
      textContent: textParts.join('').slice(0, 12000),
      fetchDurationMs: Date.now() - start,
      pagesScraped,
      businessIntel,
    };
  } catch (error: any) {
    console.error(`websiteFetcher: Failed for ${url} — ${error.message}`);
    return null;
  }
}
