import type { VercelResponse } from '@vercel/node';
// @ts-ignore — pre-bundled by esbuild during vercel-build
import { generateJSON } from '../_lib/gemini-bundle.mjs';
import { getAdminDb } from '../_lib/firebaseAdmin.js';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth.js';
import { applyRateLimit, LIMITS } from '../_lib/rateLimit.js';

export const config = {
  maxDuration: 30,
};

const PLATFORM_TONE_GUIDE: Record<string, string> = {
  instagram: 'Samimi, gorsel odakli, emoji kullanimi uygun, hikaye anlatimi tarzinda. Hashtag uyumu onemli.',
  tiktok: 'Enerjik, genc, trend odakli, kisa ve etkili. Viral potansiyeli olan hook cumlesi ile baslat.',
  linkedin: 'Profesyonel, bilgi paylasimi odakli, sektore deger katan, resmi ama sicak.',
  twitter: 'Kisa, net, etkili. 280 karakter siniri var. Tartisma baslatici veya deger paylasimi.',
  facebook: 'Topluluk odakli, paylasima tesvik eden, soru soran, etkilesim artirici.',
};

const MAX_IMAGES = 3;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4MB per image for Gemini

/**
 * Fetch an image from URL and return as base64 inlineData part.
 * Returns null if fetch fails or image is too large.
 */
async function fetchImageAsInlinePart(
  url: string
): Promise<{ inlineData: { data: string; mimeType: string } } | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') || 'image/jpeg';

    // Only process images, skip videos
    if (!contentType.startsWith('image/')) return null;

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_IMAGE_BYTES) return null;

    const base64 = Buffer.from(buffer).toString('base64');
    return {
      inlineData: {
        data: base64,
        mimeType: contentType,
      },
    };
  } catch (err) {
    console.warn('[generate-caption] Could not fetch image:', url, err);
    return null;
  }
}

// Instruction types for caption refinement
type RefinementInstruction = 'daha_kisa' | 'daha_uzun' | 'emoji_ekle' | 'hashtag_oner';

const REFINEMENT_PROMPTS: Record<RefinementInstruction, string> = {
  daha_kisa: 'Asagidaki caption\'i daha kisa ve oz hale getir. Ana mesaji koru, gereksiz kelimeleri cikar.',
  daha_uzun: 'Asagidaki caption\'i daha uzun ve detayli hale getir. Hikayeyi zenginlestir, daha fazla deger kat.',
  emoji_ekle: 'Asagidaki caption\'e uygun emojiler ekle. Platform tonuna uygun, fazla olmayacak sekilde yerlestiyr.',
  hashtag_oner: 'Asagidaki caption icin en etkili hashtag\'leri oner. Populer, niş ve marka hashtaglerini dengele.',
};

export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limit: 20 caption generations per user per minute
  if (!applyRateLimit(res, req.userUid, LIMITS.AI_CAPTION)) return;

  try {
    const { projectId, platform, postType, mediaUrls, title, instruction, existingCaption } = req.body || {};

    if (!projectId || !platform) {
      return res.status(400).json({ error: 'Missing required fields: projectId, platform' });
    }

    // Load project info for brand context
    let brandContext = '';
    try {
      const db = getAdminDb();
      const projectDoc = await db.collection('projects').doc(projectId).get();
      if (projectDoc.exists) {
        const data = projectDoc.data();
        brandContext = [
          data?.name ? `Marka: ${data.name}` : '',
          data?.sector ? `Sektor: ${data.sector}` : '',
          data?.description ? `Aciklama: ${data.description}` : '',
        ].filter(Boolean).join('\n');
      }
    } catch (err) {
      console.warn('[generate-caption] Could not load project data:', err);
    }

    const toneGuide = PLATFORM_TONE_GUIDE[platform] || 'Profesyonel ve etkileyici.';

    // ── Refinement mode: modify existing caption ──────────────────────────────
    if (instruction && existingCaption) {
      const refinementPrompt = REFINEMENT_PROMPTS[instruction as RefinementInstruction];
      if (!refinementPrompt) {
        return res.status(400).json({ error: 'Invalid instruction' });
      }

      const isHashtagOnly = instruction === 'hashtag_oner';

      const promptText = `Sen bir sosyal medya icerik uzmanisin.

## Gorev
${refinementPrompt}

## Platform
${platform} - ${toneGuide}

${brandContext ? `## Marka Bilgisi\n${brandContext}\n` : ''}

## Mevcut Caption
${existingCaption}

## Kurallar
- Turkce kalmali
- Platform tonuna uygun olmali
${isHashtagOnly ? '- Sadece hashtag\'leri dondur, caption\'i degistirme' : '- Caption\'i koru ve gelistir'}

Lutfen su JSON formatinda yanit ver:
{
  "caption": "${isHashtagOnly ? 'mevcut caption aynen' : 'duzenlenmiş caption'}",
  "hashtags": "#hashtag1 #hashtag2 #hashtag3 ...",
  "alternateCaption": ""
}`;

      const result = await generateJSON('flash', [{ text: promptText }], 'refine-caption', {
        maxOutputTokens: 1024,
      });

      return res.status(200).json({
        caption: isHashtagOnly ? existingCaption : (result?.caption || existingCaption),
        hashtags: result?.hashtags || '',
        alternateCaption: '',
      });
    }

    // ── Generation mode: create new caption from scratch ──────────────────────
    // Fetch images to send to Gemini for visual analysis
    const imageParts: { inlineData: { data: string; mimeType: string } }[] = [];
    if (mediaUrls?.length) {
      const urlsToFetch = (mediaUrls as string[]).slice(0, MAX_IMAGES);
      const fetched = await Promise.all(urlsToFetch.map(fetchImageAsInlinePart));
      fetched.forEach((part) => {
        if (part) imageParts.push(part);
      });
    }

    const hasImages = imageParts.length > 0;

    const promptText = `Sen bir sosyal medya icerik uzmanisin. ${hasImages ? 'Eklenen gorselleri dikkatlice analiz et — renkleri, nesne/sahne icerigi, markaya iliskin ipuclarini ve hissi degerlendirerek' : 'Asagidaki bilgilere dayanarak'} ${platform} platformu icin bir post caption'i ve hashtag'ler olustur.

${brandContext ? `## Marka Bilgisi\n${brandContext}\n` : ''}
## Platform
${platform} - ${toneGuide}

## Post Tipi
${postType || 'genel'}

${title ? `## Konu/Baslik\n${title}\n` : ''}
${hasImages ? `## Gorsel Analizi\nYuklenen ${imageParts.length} adet gorseli analiz et ve caption'i gorseldeki icerige uygun yaz.\n` : ''}

## Kurallar
- Caption Turkce olmali
- Platform tonuna uygun olmali
- Hashtag'ler alakali ve populer olmali
- Caption'da emoji kullanimi platforma gore ayarlanmali
- LinkedIn icin emoji az, Instagram/TikTok icin uygun miktarda
${hasImages ? '- Caption icerigini dogrudan gorselde gorduklerine dayandirarak yaz\n- Gorseldeki atmosfer, renkler ve objelerden ilham al' : ''}

Lutfen su JSON formatinda yanit ver:
{
  "caption": "... caption metni ...",
  "hashtags": "#hashtag1 #hashtag2 #hashtag3 ...",
  "alternateCaption": "... alternatif caption ..."
}`;

    // Build multimodal contents array: text prompt + image parts
    const contents: any[] = [{ text: promptText }, ...imageParts];

    const result = await generateJSON('flash', contents, 'generate-caption', {
      maxOutputTokens: 2048,
    });

    return res.status(200).json({
      caption: result?.caption || '',
      hashtags: result?.hashtags || '',
      alternateCaption: result?.alternateCaption || '',
    });
  } catch (err: any) {
    console.error('[generate-caption] Error:', err);
    return res.status(500).json({ error: err.message || 'AI caption olusturulamadi' });
  }
});
