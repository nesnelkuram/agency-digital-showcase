import * as cheerio from 'cheerio';

export interface FetchedWebsite {
  url: string;
  title: string;
  metaDescription: string;
  ogTags: Record<string, string>;
  navigation: string[];
  productListings: Array<{ name: string; price?: string; imageAlt?: string }>;
  ctaButtons: string[];
  headings: string[];
  textContent: string;
  fetchDurationMs: number;
}

export async function fetchAndParseWebsite(url: string): Promise<FetchedWebsite | null> {
  const start = Date.now();

  try {
    // Normalize URL
    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('http')) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const response = await fetch(normalizedUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BrandAnalyzer/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8',
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.log(`websiteFetcher: HTTP ${response.status} for ${normalizedUrl}`);
      return null;
    }

    const html = await response.text();
    if (!html || html.length < 100) {
      console.log(`websiteFetcher: Empty/tiny response for ${normalizedUrl}`);
      return null;
    }

    const $ = cheerio.load(html);

    // Title
    const title = $('title').first().text().trim() || '';

    // Meta description
    const metaDescription = $('meta[name="description"]').attr('content')?.trim() || '';

    // OG tags
    const ogTags: Record<string, string> = {};
    $('meta[property^="og:"]').each((_, el) => {
      const prop = $(el).attr('property')?.replace('og:', '') || '';
      const content = $(el).attr('content') || '';
      if (prop && content) ogTags[prop] = content;
    });

    // Navigation items
    const navigation: string[] = [];
    $('nav a, header a, [class*="nav"] a, [class*="menu"] a').each((_, el) => {
      const text = $(el).text().trim();
      if (text && text.length < 50 && !navigation.includes(text)) {
        navigation.push(text);
      }
    });

    // Product listings — try multiple patterns
    const productListings: Array<{ name: string; price?: string; imageAlt?: string }> = [];

    // Pattern 1: schema.org Product markup
    $('[itemtype*="schema.org/Product"], [typeof="Product"]').each((_, el) => {
      const name = $(el).find('[itemprop="name"]').first().text().trim();
      const price = $(el).find('[itemprop="price"]').first().text().trim()
        || $(el).find('[itemprop="price"]').first().attr('content')?.trim();
      if (name) productListings.push({ name, price: price || undefined });
    });

    // Pattern 2: Common product card patterns
    if (productListings.length === 0) {
      $('[class*="product"], [class*="Product"], [data-product]').each((_, el) => {
        const nameEl = $(el).find('[class*="title"], [class*="name"], h2, h3, h4').first();
        const priceEl = $(el).find('[class*="price"], [class*="fiyat"]').first();
        const imgEl = $(el).find('img').first();
        const name = nameEl.text().trim();
        const price = priceEl.text().trim();
        if (name && name.length < 200) {
          productListings.push({
            name,
            price: price || undefined,
            imageAlt: imgEl.attr('alt')?.trim() || undefined,
          });
        }
      });
    }

    // Deduplicate products (limit to 20)
    const seenProducts = new Set<string>();
    const uniqueProducts = productListings.filter(p => {
      if (seenProducts.has(p.name)) return false;
      seenProducts.add(p.name);
      return true;
    }).slice(0, 20);

    // CTA buttons
    const ctaButtons: string[] = [];
    $('a[class*="btn"], button, a[class*="cta"], a[class*="button"], [class*="action"] a').each((_, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 1 && text.length < 60 && !ctaButtons.includes(text)) {
        ctaButtons.push(text);
      }
    });

    // Headings (h1, h2, h3)
    const headings: string[] = [];
    $('h1, h2, h3').each((_, el) => {
      const text = $(el).text().trim();
      if (text && text.length < 200) headings.push(text);
    });

    // Text content — strip scripts/styles, get first 5000 chars
    $('script, style, noscript, svg, iframe').remove();
    const rawText = $('body').text().replace(/\s+/g, ' ').trim();
    const textContent = rawText.slice(0, 5000);

    console.log(`websiteFetcher: Parsed ${normalizedUrl} in ${Date.now() - start}ms — ` +
      `products=${uniqueProducts.length}, headings=${headings.length}, nav=${navigation.length}`);

    return {
      url: normalizedUrl,
      title,
      metaDescription,
      ogTags,
      navigation: navigation.slice(0, 30),
      productListings: uniqueProducts,
      ctaButtons: ctaButtons.slice(0, 15),
      headings: headings.slice(0, 30),
      textContent,
      fetchDurationMs: Date.now() - start,
    };
  } catch (error: any) {
    console.error(`websiteFetcher: Failed for ${url} in ${Date.now() - start}ms — ${error.message}`);
    return null;
  }
}
