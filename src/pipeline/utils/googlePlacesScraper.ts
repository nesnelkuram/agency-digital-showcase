/**
 * Google Places Data Extractor
 *
 * Queries Google Places API for business data:
 * - Review count & average rating
 * - Business category
 * - Operating hours
 * - Address
 *
 * Requires GOOGLE_PLACES_API_KEY in env. Returns null if unavailable.
 */

export interface GooglePlacesData {
  placeId: string;
  name: string;
  address: string;
  rating: number | null;        // 1-5
  reviewCount: number;
  category: string | null;      // "Restaurant", "Beauty Salon", etc.
  priceLevel: number | null;    // 0-4 (0=free, 4=very expensive)
  isOpen: boolean | null;
  phoneNumber: string | null;
  website: string | null;
  mapsUrl: string;
  // Derived insights
  reviewSentiment: 'excellent' | 'good' | 'average' | 'poor' | 'unknown';
  competitivePosition: string;  // "Bölgede ortalamanın üstünde" etc.
}

const FETCH_TIMEOUT_MS = 5_000;

function classifyRating(rating: number | null, reviewCount: number): GooglePlacesData['reviewSentiment'] {
  if (!rating || reviewCount === 0) return 'unknown';
  if (rating >= 4.5) return 'excellent';
  if (rating >= 4.0) return 'good';
  if (rating >= 3.0) return 'average';
  return 'poor';
}

export async function fetchGooglePlacesData(
  businessName: string,
  location?: string,
): Promise<GooglePlacesData | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.log('googlePlaces: GOOGLE_PLACES_API_KEY not configured — skipping');
    return null;
  }

  try {
    // Step 1: Text Search to find the place
    const query = location
      ? `${businessName} ${location}`
      : `${businessName} Türkiye`;

    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&language=tr&key=${apiKey}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const searchRes = await fetch(searchUrl, { signal: controller.signal });
    clearTimeout(timer);

    if (!searchRes.ok) {
      console.log(`googlePlaces: Search failed — HTTP ${searchRes.status}`);
      return null;
    }

    const searchData = await searchRes.json();
    const place = searchData.results?.[0];
    if (!place) {
      console.log(`googlePlaces: No results for "${query}"`);
      return null;
    }

    // Step 2: Place Details for more info
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,formatted_address,formatted_phone_number,rating,user_ratings_total,price_level,opening_hours,website,types,url&language=tr&key=${apiKey}`;

    const controller2 = new AbortController();
    const timer2 = setTimeout(() => controller2.abort(), FETCH_TIMEOUT_MS);

    const detailsRes = await fetch(detailsUrl, { signal: controller2.signal });
    clearTimeout(timer2);

    const detailsData = detailsRes.ok ? await detailsRes.json() : null;
    const details = detailsData?.result || place;

    const rating = details.rating ?? place.rating ?? null;
    const reviewCount = details.user_ratings_total ?? place.user_ratings_total ?? 0;

    // Map Google types to readable category
    const types: string[] = details.types || place.types || [];
    const category = types
      .filter((t: string) => !['point_of_interest', 'establishment', 'premise', 'political'].includes(t))
      .map((t: string) => t.replace(/_/g, ' '))
      [0] || null;

    const result: GooglePlacesData = {
      placeId: place.place_id,
      name: details.name || place.name,
      address: details.formatted_address || place.formatted_address || '',
      rating,
      reviewCount,
      category,
      priceLevel: details.price_level ?? null,
      isOpen: details.opening_hours?.open_now ?? null,
      phoneNumber: details.formatted_phone_number || null,
      website: details.website || null,
      mapsUrl: details.url || `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
      reviewSentiment: classifyRating(rating, reviewCount),
      competitivePosition: rating && rating >= 4.0 && reviewCount >= 50
        ? `${rating} puan, ${reviewCount} değerlendirme — bölgede güçlü konumda`
        : rating && reviewCount >= 10
          ? `${rating} puan, ${reviewCount} değerlendirme — geliştirilebilir`
          : 'Yeterli değerlendirme verisi yok',
    };

    console.log(`googlePlaces: ${result.name} — rating=${rating}, reviews=${reviewCount}, category=${category}, sentiment=${result.reviewSentiment}`);
    return result;
  } catch (err: any) {
    console.log(`googlePlaces: Failed — ${err.message}`);
    return null;
  }
}
