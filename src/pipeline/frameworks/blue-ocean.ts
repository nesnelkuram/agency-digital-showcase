// Blue Ocean Strategy — Kim & Mauborgne
// Eliminate-Reduce-Raise-Create (ERRC) Matrix + Value Innovation Canvas

import type { FrameworkScore } from '../evidence';

export interface ERRCMatrix {
  eliminate: Array<{ factor: string; reason: string }>;
  reduce: Array<{ factor: string; currentLevel: string; targetLevel: string; reason: string }>;
  raise: Array<{ factor: string; currentLevel: string; targetLevel: string; reason: string }>;
  create: Array<{ factor: string; description: string; customerValue: string }>;
}

export interface ValueCurvePoint {
  factor: string;
  brandScore: number;    // 0-10
  industryAvg: number;   // 0-10
  keyCompetitor: number; // 0-10
}

export function scoreBlueOcean(matrix: ERRCMatrix, valueCurve: ValueCurvePoint[]): FrameworkScore {
  // Score based on:
  // 1. Number of ERRC actions (more = more innovative)
  // 2. Divergence from industry average on value curve
  // 3. Has "create" elements (new value factors)

  const actionCount = matrix.eliminate.length + matrix.reduce.length +
    matrix.raise.length + matrix.create.length;

  const divergenceScore = valueCurve.length > 0
    ? valueCurve.reduce((sum, p) => sum + Math.abs(p.brandScore - p.industryAvg), 0) / valueCurve.length
    : 0;

  const hasCreation = matrix.create.length > 0;

  const score = Math.min(100, Math.round(
    (actionCount * 5) + // Up to 40 points for actions
    (divergenceScore * 10) + // Up to 30 points for divergence
    (hasCreation ? 30 : 0) // 30 points for creation
  ));

  return {
    framework: 'Blue Ocean ERRC',
    score,
    maxScore: 100,
    rationale: `${actionCount} ERRC aksiyonu, ortalama sapma: ${divergenceScore.toFixed(1)}, yeni değer faktörü: ${hasCreation ? 'Var' : 'Yok'}`,
    subscores: {
      eliminate: matrix.eliminate.length,
      reduce: matrix.reduce.length,
      raise: matrix.raise.length,
      create: matrix.create.length,
      divergence: Math.round(divergenceScore * 10),
    },
  };
}

export const BLUE_OCEAN_PROMPT_SNIPPET = `
## Blue Ocean ERRC Matrisi
Rekabetten kaçınma stratejisini 4 boyutta tasarla:

**Elimine Et (Eliminate):** Sektörün "olmazsa olmaz" dediği ama müşterinin gerçekten umursamadığı faktörler
**Azalt (Reduce):** Sektör standardının altına indirilebilecek faktörler (maliyet tasarrufu)
**Artır (Raise):** Sektör standardının üstüne çıkarılması gereken faktörler
**Yarat (Create):** Sektörde hiç sunulmayan, tamamen yeni değer faktörleri

Her faktör için: faktör adı + neden + müşteri değeri
Değer Eğrisi: Her faktörü 0-10 puanla (marka vs sektör ortalaması vs ana rakip)
`;
