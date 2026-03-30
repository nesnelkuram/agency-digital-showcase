import * as cheerio from 'cheerio';

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
    priceRange: { min: number | null; max: number | null; currency: string; segment: 'budget' | 'mid' | 'premium' | 'luxury' | 'unknown' };
    aboutText: string;                    // hakkımızda/about page text
    foundingYear: number | null;          // extracted from text patterns
    teamSize: string | null;              // "10+ kişi" etc.
    locationCount: number;                // number of branch/location mentions
    certifications: string[];             // ISO, TURKAK, etc.
    testimonialCount: number;             // review/testimonial sections found
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

function extractSocialLinks(allLinks: string[]): Record<string, string> {
  const social: Record<string, string> = {};
  const patterns: Array<[string, RegExp]> = [
    ['instagram', /instagram\.com\/([^/?#]+)/i],
    ['facebook', /facebook\.com\/([^/?#]+)/i],
    ['twitter', /(twitter|x)\.com\/([^/?#]+)/i],
    ['linkedin', /linkedin\.com\/(company|in)\/([^/?#]+)/i],
    ['youtube', /youtube\.com\/(channel|c|@)\/([^/?#]+)/i],
    ['tiktok', /tiktok\.com\/@([^/?#]+)/i],
  ];
  for (const link of allLinks) {
    for (const [platform, regex] of patterns) {
      if (!social[platform] && regex.test(link)) {
        social[platform] = link;
      }
    }
  }
  return social;
}

function extractContactInfo(text: string, allLinks: string[]): { phones: string[]; emails: string[]; addresses: string[] } {
  const phones = [...new Set(
    (text.match(/(?:\+90|0)[\s.-]?\d{3}[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}/g) || [])
      .map(p => p.replace(/[\s.-]/g, ''))
  )].slice(0, 5);

  const emails = [...new Set(
    (text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [])
      .filter(e => !e.includes('example') && !e.includes('sentry'))
  )].slice(0, 5);

  // Look for mailto: links too
  for (const link of allLinks) {
    const m = link.match(/mailto:([^?]+)/);
    if (m && !emails.includes(m[1])) emails.push(m[1]);
  }

  const addresses: string[] = [];
  // Common Turkish address patterns
  const addrPatterns = text.match(/(?:Mah\.|Cad\.|Sok\.|Bulvarı|No:|Kat:)[^.]{10,80}/gi) || [];
  for (const a of addrPatterns.slice(0, 3)) {
    addresses.push(a.trim());
  }

  return { phones, emails, addresses };
}

function extractPriceRange(products: Array<{ price?: string }>): { min: number | null; max: number | null; currency: string; segment: 'budget' | 'mid' | 'premium' | 'luxury' | 'unknown' } {
  const prices: number[] = [];
  for (const p of products) {
    if (!p.price) continue;
    const cleaned = p.price.replace(/[^\d.,]/g, '').replace(',', '.');
    const num = parseFloat(cleaned);
    if (!isNaN(num) && num > 0 && num < 1_000_000) prices.push(num);
  }

  if (prices.length === 0) return { min: null, max: null, currency: 'TRY', segment: 'unknown' };

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;

  // Segment based on average price (rough TRY heuristic)
  const segment = avg < 100 ? 'budget' : avg < 500 ? 'mid' : avg < 2000 ? 'premium' : 'luxury';

  return { min, max, currency: 'TRY', segment };
}

function extractFoundingYear(text: string): number | null {
  // "2015'ten beri", "2018 yılında kuruldu", "since 2010", "est. 2005"
  const patterns = [
    /(?:kuruldu|kurulmuş|beri|since|est\.?|founded)\s*(?:in\s+)?(\d{4})/i,
    /(\d{4})\s*(?:'[td]en|'dan|'den|yılından)\s*(?:beri|itibaren)/i,
    /(\d{4})\s*yılında\s*(?:kurul|açıl|başla)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const year = parseInt(match[1]);
      if (year >= 1950 && year <= new Date().getFullYear()) return year;
    }
  }
  return null;
}

function extractAboutText(pages: PageData[]): string {
  // Find about/hakkımızda page
  const aboutPage = pages.find(p =>
    /hakkimizda|hakkinda|about|biz-kimiz|hikayemiz|story/i.test(p.url)
  );
  if (aboutPage) return aboutPage.textContent.slice(0, 2000);

  // Fallback: look for about sections in homepage
  for (const page of pages) {
    const aboutIdx = page.textContent.toLowerCase().indexOf('hakkımızda');
    if (aboutIdx !== -1) return page.textContent.slice(aboutIdx, aboutIdx + 1500);
    const aboutIdx2 = page.textContent.toLowerCase().indexOf('hikayemiz');
    if (aboutIdx2 !== -1) return page.textContent.slice(aboutIdx2, aboutIdx2 + 1500);
  }
  return '';
}

function extractLocationCount(text: string): number {
  const branchPatterns = /(\d+)\s*(?:şube|mağaza|lokasyon|branch|location|store)/gi;
  const matches = [...text.matchAll(branchPatterns)];
  if (matches.length > 0) {
    return Math.max(...matches.map(m => parseInt(m[1])));
  }
  // Count unique address-like mentions
  const addressCount = (text.match(/(?:Mah\.|Cad\.|Sok\.)/gi) || []).length;
  return Math.min(addressCount, 10); // cap at 10
}

function extractCertifications(text: string): string[] {
  const certs: string[] = [];
  const patterns = [
    /ISO\s*\d{4,5}/gi,
    /TÜRKAK/gi,
    /TSE/g,
    /GMP/g,
    /HACCP/gi,
    /Helal\s*Sertifika/gi,
    /Organik\s*Sertifika/gi,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) certs.push(...m);
  }
  return [...new Set(certs)].slice(0, 10);
}

function countTestimonials($pages: string[]): number {
  let count = 0;
  const keywords = /(?:referans|müşteri\s*yorum|testimonial|review|değerlendirme|görüş)/gi;
  for (const text of $pages) {
    count += (text.match(keywords) || []).length;
  }
  return Math.min(count, 50);
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

    // --- Step 4: Extract structured business intelligence ---
    const allText = textParts.join(' ');
    // Social media links are often external — extract from text via regex
    const allExternalLinks: string[] = [];
    const urlRegex = /https?:\/\/(?:www\.)?(?:instagram|facebook|twitter|x|linkedin|youtube|tiktok)\.com\/[^\s"'<>)]+/gi;
    const socialMatches = allText.match(urlRegex) || [];
    allExternalLinks.push(...socialMatches);
    // Also check navigation for social links
    for (const link of allInternalLinks) {
      if (/instagram|facebook|twitter|linkedin|youtube|tiktok/i.test(link)) {
        allExternalLinks.push(link);
      }
    }

    const allPages = [homePage, ...subPages];
    const businessIntel: FetchedWebsite['businessIntel'] = {
      socialLinks: extractSocialLinks([...allExternalLinks, ...allInternalLinks]),
      contactInfo: extractContactInfo(allText, [...allExternalLinks, ...allInternalLinks]),
      priceRange: extractPriceRange(uniqueProducts),
      aboutText: extractAboutText(allPages),
      foundingYear: extractFoundingYear(allText),
      teamSize: (() => {
        const match = allText.match(/(\d+)\s*(?:\+\s*)?(?:kişi|çalışan|personel|ekip\s*üyesi|employee)/i);
        return match ? `${match[1]}+ kişi` : null;
      })(),
      locationCount: extractLocationCount(allText),
      certifications: extractCertifications(allText),
      testimonialCount: countTestimonials(textParts),
    };

    console.log(`websiteFetcher: Done — pages=${pagesScraped.length}, products=${uniqueProducts.length}, social=${Object.keys(businessIntel.socialLinks).length}, phones=${businessIntel.contactInfo.phones.length}, priceSegment=${businessIntel.priceRange.segment}, foundingYear=${businessIntel.foundingYear}, elapsed=${Date.now() - start}ms`);

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
