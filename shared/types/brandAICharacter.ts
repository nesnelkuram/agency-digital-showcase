export interface BrandAICharacterSourceFields {
  archetype?: string;
  traits?: string[];
  tone?: string;
  voice?: string;
  characterSliders?: Partial<Record<'friendAuthority' | 'youngMature' | 'playfulSerious' | 'massElite', number>>;
  weAreThis?: string[];
  weAreNotThis?: string[];
  behaviors?: Array<{ value: string; do: string; dont: string; example: string }>;
  dinnerPartyDescription?: string;
  manifesto?: string;
  transformationStory?: string;
  oneLinePromise?: string;
  sector?: string;
  targetAudience?: string;
  moodKeywords?: string[];
}

export interface BrandAICharacter {
  brandId: string;        // brand_leads doc id
  brandName: string;
  projectId?: string;
  voiceSummary: string;   // UI'da gösterilir — bir cümle
  systemPrompt: string;   // Gemini sistem promptu
  sourceFields: BrandAICharacterSourceFields;
  hasAnalysis: boolean;   // false ise fallback (sadece platform tonu)
}
