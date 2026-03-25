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

    console.log(`websiteFetcher: Done — pages=${pagesScraped.length}, products=${uniqueProducts.length}, headings=${allHeadings.length}, elapsed=${Date.now() - start}ms`);

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
    };
  } catch (error: any) {
    console.error(`websiteFetcher: Failed for ${url} — ${error.message}`);
    return null;
  }
}
