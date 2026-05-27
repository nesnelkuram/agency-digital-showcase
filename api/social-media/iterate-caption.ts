import type { VercelResponse } from '@vercel/node';
// @ts-ignore — pre-bundled by esbuild during vercel-build
import { generateJSON } from '../_lib/gemini-bundle.mjs';
import { getAdminDb } from '../_lib/firebaseAdmin.js';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth.js';
import { applyRateLimit, LIMITS } from '../_lib/rateLimit.js';
import { buildBrandCharacterPure } from '../../shared/services/brandAICharacterBuilder.js';

export const config = {
  maxDuration: 30,
};

const PLATFORM_TONE_GUIDE: Record<string, string> = {
  instagram: 'Samimi, görsel odaklı, emoji uygun. Hashtag uyumu önemli. Karakter limiti 2200.',
  tiktok: 'Enerjik, trend odaklı, kısa etkili. Viral hook ile başlat. Karakter limiti 2200.',
  linkedin: 'Profesyonel, değer katan, resmi ama sıcak. Karakter limiti 3000.',
  twitter: 'Kısa, net, etkili. 280 karakter sınırı.',
  facebook: 'Topluluk odaklı, etkileşim artırıcı.',
};

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!applyRateLimit(res, req.userUid, LIMITS.AI_CAPTION)) return;

  try {
    const { postId, platform, postType, mediaUrls, messages, currentCaption } = req.body || {};

    if (!postId || !platform || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: 'Missing required fields: postId, platform, messages[]',
      });
    }

    const adminDb = getAdminDb();

    // Load post → project → lead (for brand character)
    let projectId: string | undefined;
    let brandSystemPrompt = '';
    let brandName = 'Marka';

    try {
      const postDoc = await adminDb.collection('social_media_posts').doc(postId).get();
      if (postDoc.exists) {
        projectId = postDoc.data()?.projectId;
      }
      if (projectId) {
        const projectDoc = await adminDb.collection('projects').doc(projectId).get();
        if (projectDoc.exists) {
          const projectData = projectDoc.data();
          brandName = projectData?.name || 'Marka';
          if (projectData?.leadId) {
            const leadDoc = await adminDb.collection('brand_leads').doc(projectData.leadId).get();
            if (leadDoc.exists) {
              const character = buildBrandCharacterPure(leadDoc.data(), leadDoc.id, projectId);
              if (character.hasAnalysis) {
                brandSystemPrompt = character.systemPrompt;
                brandName = character.brandName;
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('[iterate-caption] Could not load brand context:', err);
    }

    const toneGuide = PLATFORM_TONE_GUIDE[platform] || 'Profesyonel ve etkileyici.';

    // Build conversation transcript
    const transcript = (messages as ChatMessage[])
      .map((m) => `${m.role === 'user' ? 'Kullanıcı' : 'Asistan'}: ${m.content}`)
      .join('\n\n');

    const mediaInfo =
      Array.isArray(mediaUrls) && mediaUrls.length > 0
        ? `## Görseller\nPost için ${mediaUrls.length} medya eklenmiş (ilkleri analiz için örnek): ${(mediaUrls as string[])
            .slice(0, 3)
            .join(', ')}\n`
        : '';

    const promptText = `${brandSystemPrompt || `Sen ${brandName} markasının sosyal medya yazarısın.`}

## Platform Bilgisi
${platform} — ${toneGuide}
Post tipi: ${postType || 'belirtilmedi'}

${mediaInfo}${currentCaption ? `## Mevcut Caption\n${currentCaption}\n` : ''}

## Sohbet
${transcript}

## Görev
Sen asistansın. Kullanıcının en son talebine markanın karakterine sadık kalarak cevap ver. Eğer caption önerisi istiyorsa "suggestedCaption" alanına yaz; sadece ton/fikir tartışıyorsa boş bırak. Hashtag öneriyorsan "suggestedHashtags" dizisine koy.

Türkçe yaz. JSON formatında cevap ver:
{
  "assistantMessage": "kullanıcıya doğal dil cevap (tartışma + öneri özeti)",
  "suggestedCaption": "önerilen tam caption veya boş string",
  "suggestedHashtags": ["#etiket1", "#etiket2"]
}`;

    const result = await generateJSON('flash', [{ text: promptText }], 'iterate-caption', {
      maxOutputTokens: 2048,
    });

    return res.status(200).json({
      assistantMessage: result?.assistantMessage || '',
      suggestedCaption: result?.suggestedCaption || '',
      suggestedHashtags: Array.isArray(result?.suggestedHashtags) ? result.suggestedHashtags : [],
      brandName,
    });
  } catch (err: any) {
    console.error('[iterate-caption] Error:', err);
    return res.status(500).json({ error: err?.message || 'AI iterasyon başarısız' });
  }
});
