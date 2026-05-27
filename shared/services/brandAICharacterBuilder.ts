/**
 * Pure brand AI character prompt builder.
 * NO Firestore / firebase imports — server-side safe.
 */

import type { BrandAICharacter, BrandAICharacterSourceFields } from '@/shared/types/brandAICharacter';

const SLIDER_LABELS: Record<string, [string, string]> = {
  friendAuthority: ['Arkadaş', 'Otorite'],
  youngMature: ['Genç', 'Olgun'],
  playfulSerious: ['Şakacı', 'Ciddi'],
  massElite: ['Kitle', 'Elit'],
};

function extractSourceFieldsFromLead(lead: any): BrandAICharacterSourceFields {
  const a = lead?.aiAnalysis || {};
  return {
    archetype: a?.brandPersonality?.archetype,
    traits: a?.brandPersonality?.traits,
    tone: a?.brandPersonality?.tone,
    voice: a?.brandPersonality?.voice,
    characterSliders: a?.brandCharacter?.sliders,
    weAreThis: a?.brandCharacter?.weAreThis,
    weAreNotThis: a?.brandCharacter?.weAreNotThis,
    behaviors: a?.brandCharacter?.behaviors,
    dinnerPartyDescription: a?.brandCharacter?.dinnerPartyDescription,
    manifesto: a?.emotionalNarrative?.manifesto,
    transformationStory: a?.emotionalNarrative?.transformationStory,
    oneLinePromise: a?.emotionalNarrative?.oneLinePromise,
    sector: lead?.sector,
    targetAudience: a?.positioning?.targetAudience,
    moodKeywords: a?.visualWorld?.moodKeywords,
  };
}

function buildVoiceSummary(s: BrandAICharacterSourceFields): string {
  const parts: string[] = [];
  if (s.archetype) parts.push(s.archetype);
  if (s.tone) parts.push(`${s.tone} ton`);
  if (s.traits?.length) parts.push(s.traits.slice(0, 2).join(' & '));
  if (parts.length === 0) return 'Marka karakteri henüz oluşturulmamış';
  return parts.join(' · ');
}

function buildSystemPrompt(brandName: string, s: BrandAICharacterSourceFields): string {
  const sections: string[] = [];

  sections.push(
    `Sen "${brandName}" markasının sesisin. Aşağıdaki marka karakterine ve değerlerine sadık kalarak sosyal medya içerikleri yaz.`
  );

  if (s.archetype || s.tone || s.voice || s.traits?.length) {
    const lines: string[] = [];
    if (s.archetype) lines.push(`- Arketip: ${s.archetype}`);
    if (s.tone) lines.push(`- Ton: ${s.tone}`);
    if (s.voice) lines.push(`- Ses: ${s.voice}`);
    if (s.traits?.length) lines.push(`- Özellikler: ${s.traits.join(', ')}`);
    sections.push(`## MARKA KARAKTERİ\n${lines.join('\n')}`);
  }

  if (s.characterSliders && Object.keys(s.characterSliders).length > 0) {
    const lines = Object.entries(s.characterSliders)
      .filter(([, v]) => typeof v === 'number')
      .map(([k, v]) => {
        const labels = SLIDER_LABELS[k];
        if (!labels) return `- ${k}: ${v}/10`;
        return `- ${labels[0]} ↔ ${labels[1]}: ${v}/10`;
      });
    if (lines.length > 0) {
      sections.push(`## KARAKTER TERAZİLERİ (1-10)\n${lines.join('\n')}`);
    }
  }

  if (s.weAreThis?.length) {
    sections.push(`## BİZ ŞUYUZ\n- ${s.weAreThis.join('\n- ')}`);
  }
  if (s.weAreNotThis?.length) {
    sections.push(
      `## BİZ ŞU(N)LAR DEĞİLİZ (KAÇIN)\n- ${s.weAreNotThis.join('\n- ')}`
    );
  }

  if (s.behaviors?.length) {
    const lines = s.behaviors
      .slice(0, 4)
      .map((b: any) => `- ${b.value}: YAP → ${b.do}; YAPMA → ${b.dont}`);
    sections.push(`## DAVRANIŞ KURALLARI\n${lines.join('\n')}`);
  }

  if (s.manifesto) sections.push(`## MANİFESTO\n${s.manifesto}`);
  if (s.oneLinePromise) sections.push(`## SÖZ\n${s.oneLinePromise}`);

  if (s.sector) sections.push(`## SEKTÖR\n${s.sector}`);
  if (s.targetAudience) sections.push(`## HEDEF KİTLE\n${s.targetAudience}`);
  if (s.moodKeywords?.length) sections.push(`## MOOD\n${s.moodKeywords.join(', ')}`);

  sections.push(
    `## YAZIM KURALLARI
- Türkçe yaz; doğal akışı bozmayacaksa teknik İngilizce terimler kabul.
- Verilen platforma (Instagram/TikTok/LinkedIn/Twitter/Facebook) özgü ton, uzunluk, hashtag normlarına uy.
- Post tipine göre hook/çağrı yapısı kur: reels için ilk 3 saniyede çengel, story için kısa+samimi, post/carousel için hikâye+CTA.
- "BİZ ŞU(N)LAR DEĞİLİZ" listesine asla girme.
- Emoji kullanımını platforma uyarla (LinkedIn minimum, Instagram/TikTok doğal yoğunlukta).`
  );

  return sections.join('\n\n');
}

/** Pure builder — takes a plain lead object (works for both client and server data). */
export function buildBrandCharacterPure(lead: any, leadId: string, projectId?: string): BrandAICharacter {
  const brandName = lead?.contact?.companyName || lead?.contact?.fullName || 'Marka';
  const sourceFields = extractSourceFieldsFromLead(lead);
  const hasAnalysis = Boolean(lead?.aiAnalysis);
  return {
    brandId: leadId,
    brandName,
    projectId,
    voiceSummary: buildVoiceSummary(sourceFields),
    systemPrompt: buildSystemPrompt(brandName, sourceFields),
    sourceFields,
    hasAnalysis,
  };
}
