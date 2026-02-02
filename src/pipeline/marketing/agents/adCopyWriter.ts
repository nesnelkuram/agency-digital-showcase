import { generateJSON } from '../../geminiClient';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AdCopyInput {
  productDescription: string;
  platform: string;          // meta, google, tiktok, linkedin
  objective: string;         // awareness, traffic, engagement, leads, sales
  tone: string;              // professional, casual, urgent, creative, informative
  targetAudience?: string;
  keywords?: string[];
  brandName?: string;
  existingCopy?: string;     // for improvement / variation
}

export interface AdCopyVariant {
  id: string;
  headline: string;
  primaryText: string;
  description: string;
  callToAction: string;
  tone: string;
  platformNotes: string;     // platform-specific tips for this variant
}

export interface AdCopyOutput {
  variants: AdCopyVariant[];
  strategy: string;          // brief explanation of the copy strategy
  platformTips: string[];    // platform-specific best practices
}

// ---------------------------------------------------------------------------
// Platform character-limit reference (embedded in prompt)
// ---------------------------------------------------------------------------

const PLATFORM_LIMITS: Record<string, string> = {
  meta: `- Baslik (headline): max 40 karakter
- Ana Metin (primaryText): max 125 karakter
- Aciklama (description): max 30 karakter
- CTA secenekleri: Simdi Al, Daha Fazla Bilgi, Kayit Ol, Iletisime Gec, Teklif Al, Hemen Basvur`,

  google: `- Baslik (headline): max 30 karakter
- Aciklama (description): max 90 karakter
- primaryText alani description ile ayni icerige sahip olabilir
- CTA secenekleri: Simdi Ara, Teklif Al, Hemen Basvur, Ucretsiz Dene, Fiyat Ogren`,

  tiktok: `- Baslik / Ana Metin (primaryText): max 100 karakter
- headline alani kisa bir dikkat cekici hook olmali (max 50 karakter)
- description alani hashtag ve ek bilgi icin (max 80 karakter)
- CTA secenekleri: Daha Fazla Bilgi, Simdi Alisveris Yap, Indir, Kayit Ol`,

  linkedin: `- Baslik (headline): max 70 karakter
- Aciklama (description): max 100 karakter
- Ana Metin (primaryText): max 150 karakter
- CTA secenekleri: Daha Fazla Bilgi, Basvur, Kayit Ol, Indir, Demo Talep Et`,
};

// ---------------------------------------------------------------------------
// Objective labels (Turkish)
// ---------------------------------------------------------------------------

const OBJECTIVE_LABELS: Record<string, string> = {
  awareness: 'Marka Bilinirlik',
  traffic: 'Web Sitesi Trafigi',
  engagement: 'Etkilesim',
  leads: 'Potansiyel Musteri (Lead)',
  sales: 'Satis / Donusum',
};

// ---------------------------------------------------------------------------
// Tone labels (Turkish)
// ---------------------------------------------------------------------------

const TONE_LABELS: Record<string, string> = {
  professional: 'Profesyonel ve Guven Veren',
  casual: 'Samimi ve Yakin',
  urgent: 'Aciliyet Yaratan',
  creative: 'Yaratici ve Dikkat Cekici',
  informative: 'Bilgilendirici ve Egitici',
};

// ---------------------------------------------------------------------------
// Main agent function
// ---------------------------------------------------------------------------

export async function generateAdCopy(input: AdCopyInput): Promise<AdCopyOutput> {
  const {
    productDescription,
    platform,
    objective,
    tone,
    targetAudience,
    keywords,
    brandName,
    existingCopy,
  } = input;

  const platformKey = platform.toLowerCase();
  const charLimits = PLATFORM_LIMITS[platformKey] || PLATFORM_LIMITS.meta;
  const objectiveLabel = OBJECTIVE_LABELS[objective] || objective;
  const toneLabel = TONE_LABELS[tone] || tone;

  const prompt = `Sen Turkiye'nin en basarili dijital reklam metin yazarisin. Asagidaki bilgilere dayanarak ${platform.toUpperCase()} platformu icin 6 farkli reklam metni varyanti olustur.

## Urun / Hizmet Tanimi
${productDescription}

## Parametreler
- Platform: ${platform.toUpperCase()}
- Kampanya Hedefi: ${objectiveLabel}
- Ton: ${toneLabel}
${brandName ? `- Marka Adi: ${brandName}` : ''}
${targetAudience ? `- Hedef Kitle: ${targetAudience}` : ''}
${keywords?.length ? `- Anahtar Kelimeler: ${keywords.join(', ')}` : ''}
${existingCopy ? `\n## Mevcut Reklam Metni (iyilestir / varyasyon olustur)\n${existingCopy}` : ''}

## Platform Karakter Limitleri (${platform.toUpperCase()})
${charLimits}

## VARYANT STRATEJILERI
Her varyant FARKLI bir yaklasim kullanmali:
1. **Duygusal (emotional)** — Hedef kitlenin duygularina hitap et, empati kur
2. **Fayda Odakli (benefit)** — Somut fayda ve degeri on plana cikar
3. **Aciliyet (urgency)** — Sinirli sure/stok/firsat hissi yarat
4. **Sosyal Kanit (social-proof)** — Basari hikayeleri, rakamlar, guven sinyalleri kullan
5. **Soru (question)** — Ilgi cekici bir soru ile basla, merak uyandır
6. **Dogrudan (direct)** — Net, kisa, aksiyona yonlendirici, sade bir mesaj ver

## KURALLAR
1. Tum metinler TURKCE olmali, dogal ve akici Turkce kullan
2. Karakter limitlerini KESINLIKLE asma — her alan belirtilen limite uygun olmali
3. CTA (callToAction) platforma uygun seceneklerden sec
4. Her varyant farkli bir aci kullanmali (yukaridaki 6 strateji)
5. Reklam metinleri ${toneLabel.toLowerCase()} tonunda olmali
6. Kampanya hedefi "${objectiveLabel}" — metinler bu hedefe hizmet etmeli
7. Jenerik ifadelerden kacin, spesifik ve somut ol
8. platformNotes alaninda o varyanta ozel platform ipucu ver
${brandName ? `9. Marka adini dogal bir sekilde metne entegre et` : ''}

## CIKTI FORMATI (JSON)
{
  "variants": [
    {
      "id": "variant_1",
      "headline": "string — platform limitine uygun baslik",
      "primaryText": "string — ana reklam metni, platform limitine uygun",
      "description": "string — ek aciklama, platform limitine uygun",
      "callToAction": "string — CTA butonu metni",
      "tone": "string — emotional | benefit | urgency | social-proof | question | direct",
      "platformNotes": "string — bu varyant icin platforma ozel ipucu/oneri"
    }
  ],
  "strategy": "string — 2-3 cumlelik genel metin stratejisi aciklamasi",
  "platformTips": ["string — ${platform.toUpperCase()} platformuna ozel en iyi uygulamalar ve ipuclari (en az 4 madde)"]
}

ONEMLI: Tam olarak 6 varyant olustur. Yanit olarak SADECE JSON ver, baska bir sey yazma.`;

  console.log(
    `[adCopyWriter] Generating ad copy: platform=${platform}, objective=${objective}, tone=${tone}` +
    (brandName ? `, brand=${brandName}` : '')
  );

  const result = await generateJSON<AdCopyOutput>(
    'pro',
    prompt,
    'adCopyWriter',
    { temperature: 0.9, maxOutputTokens: 4096 }
  );

  // Validate that we actually got variants back
  if (!result.variants || !Array.isArray(result.variants) || result.variants.length === 0) {
    throw new Error('adCopyWriter returned no variants — unexpected empty result');
  }

  // Ensure every variant has an id (patch if Gemini omitted them)
  result.variants = result.variants.map((v, i) => ({
    ...v,
    id: v.id || `variant_${i + 1}`,
  }));

  console.log(
    `[adCopyWriter] Generated ${result.variants.length} variants for ${platform.toUpperCase()}`
  );

  return result;
}
