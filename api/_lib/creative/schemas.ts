/** Yaratıcı rollerin yapılandırılmış çıktı şemaları (zod = tek doğruluk kaynağı; OpenRouter'a strict JSON Schema olarak gider). Sayısal/anlamsal sınırlar sunucuda ayrıca doğrulanır. */
import { z } from 'zod/v4';

export const IdeasOutputSchema = z.object({
  status: z.enum(['ok', 'bilgi_yetersiz']),
  missingInfo: z.string().nullable(),
  ideas: z.array(
    z.object({
      mainMessage: z.string(),
      creativeAngle: z.string(),
      visualLink: z.string(),
      targetEffect: z.object({ kind: z.enum(['hisset', 'düşün', 'yap', 'belirsiz']), note: z.string() }),
      basisFactIds: z.array(z.string()),
      basisProductIds: z.array(z.string()),
      basisBrandIds: z.array(z.string()),
      interpretation: z.string(),
      uncertainties: z.array(z.string()),
      missingInfoNote: z.string().nullable(),
    })
  ),
});

export const CaptionOutputSchema = z.object({
  caption: z.string(),
  observation: z.string(),
  rationale: z.string(),
  sourceMap: z.array(z.object({ segment: z.string(), source: z.enum(['gorunur_gercek', 'dogrulanmis_urun', 'marka_rehberi', 'yaratici_yorum']), ref: z.string().nullable() })),
});

export const CheckOutputSchema = z.object({
  verdict: z.enum(['uygun', 'düzeltme_gerekli', 'bilgi_yetersiz']),
  summary: z.string(),
  findings: z.array(
    z.object({
      dimension: z.enum(['marka_dili', 'tekrar', 'niyet', 'gorsel_uyum', 'kanitsiz_iddia']),
      status: z.enum(['tamam', 'sorun', 'belirsiz']),
      claim: z.string().nullable(),
      reason: z.string(),
      sourceRef: z.string().nullable(),
    })
  ),
});

export const CREATIVE_SCHEMAS = {
  ideas: { schema: IdeasOutputSchema, name: 'creative_ideas', maxTokens: 3500 },
  caption: { schema: CaptionOutputSchema, name: 'creative_caption', maxTokens: 3000 },
  check: { schema: CheckOutputSchema, name: 'creative_check', maxTokens: 3000 },
} as const;
