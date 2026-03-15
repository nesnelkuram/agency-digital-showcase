// BJ Fogg Behavior Model: B = MAP (Motivation × Ability × Prompt)
// Used for action plan design — every recommended action must pass the MAP test

import type { FrameworkScore } from '../evidence';

export interface FoggAssessment {
  motivation: {
    pleasure: number;    // 0-10: Does this bring pleasure or avoid pain?
    hope: number;        // 0-10: Does this give hope or avoid fear?
    acceptance: number;  // 0-10: Does this provide social acceptance?
  };
  ability: {
    time: number;        // 0-10: How much time is needed? (10=very little)
    money: number;       // 0-10: How affordable? (10=very cheap/free)
    physicalEffort: number; // 0-10: How easy physically? (10=no effort)
    mentalEffort: number;   // 0-10: How easy mentally? (10=no thinking needed)
    socialDeviance: number; // 0-10: How socially normal? (10=perfectly normal)
    nonRoutine: number;     // 0-10: How routine? (10=already a habit)
  };
  prompt: {
    present: boolean;    // Is there a clear prompt/trigger?
    type: 'spark' | 'facilitator' | 'signal'; // Low motivation → spark, Low ability → facilitator, High both → signal
    description: string;
  };
}

export interface ActionMAP {
  action: string;
  motivationScore: number; // 0-10
  abilityScore: number;    // 0-10
  promptDesign: string;
  willHappen: boolean;     // M × A above threshold AND prompt present
  bottleneck: 'motivation' | 'ability' | 'prompt' | 'none';
  recommendation: string;
}

export function assessAction(
  action: string,
  motivation: number,
  ability: number,
  hasPrompt: boolean
): ActionMAP {
  const threshold = 5; // Minimum M × A product (on 0-10 scale each)

  let bottleneck: ActionMAP['bottleneck'] = 'none';
  if (!hasPrompt) bottleneck = 'prompt';
  else if (motivation < 4) bottleneck = 'motivation';
  else if (ability < 4) bottleneck = 'ability';

  const willHappen = motivation >= 4 && ability >= 4 && hasPrompt;

  let recommendation = '';
  switch (bottleneck) {
    case 'motivation':
      recommendation = `Motivasyonu artır: Bu aksiyonun neden ÖNEMLİ olduğunu netleştir. Başarı hikayesi veya kayıp korkusu ile motive et.`;
      break;
    case 'ability':
      recommendation = `Kolaylaştır: Adımları küçült, karmaşıklığı azalt. İlk adımı 2 dakikada yapılabilir hale getir.`;
      break;
    case 'prompt':
      recommendation = `Tetikleyici ekle: Bu aksiyonu hatırlatacak bir sinyal tasarla (takvim, bildirim, rutin).`;
      break;
    default:
      recommendation = 'Aksiyon tasarımı uygun — uygulama aşamasına geç.';
  }

  return {
    action,
    motivationScore: motivation,
    abilityScore: ability,
    promptDesign: hasPrompt ? 'Mevcut' : 'Tasarlanmalı',
    willHappen,
    bottleneck,
    recommendation,
  };
}

export function scoreFogg(assessments: ActionMAP[]): FrameworkScore {
  const total = assessments.length;
  const passing = assessments.filter(a => a.willHappen).length;
  const score = total > 0 ? Math.round((passing / total) * 100) : 0;

  const bottleneckCounts = {
    motivation: assessments.filter(a => a.bottleneck === 'motivation').length,
    ability: assessments.filter(a => a.bottleneck === 'ability').length,
    prompt: assessments.filter(a => a.bottleneck === 'prompt').length,
  };

  const topBottleneck = Object.entries(bottleneckCounts).sort((a, b) => b[1] - a[1])[0];

  return {
    framework: 'BJ Fogg B=MAP',
    score,
    maxScore: 100,
    rationale: `${passing}/${total} aksiyon MAP testini geçti. Ana darboğaz: ${topBottleneck[0]} (${topBottleneck[1]} aksiyon)`,
    subscores: bottleneckCounts,
  };
}

export const FOGG_PROMPT_SNIPPET = `
## BJ Fogg B=MAP Aksiyon Tasarımı
Her önerilen aksiyon için MAP değerlendirmesi yap:

**M (Motivasyon):** Bu aksiyonu yapma isteği ne kadar güçlü? (0-10)
- Zevk/acı boyutu, umut/korku boyutu, sosyal kabul boyutu

**A (Yetenek):** Bu aksiyonu yapmak ne kadar kolay? (0-10)
- Zaman, para, fiziksel efor, zihinsel efor, sosyal kabul, rutin uyumu

**P (Tetikleyici):** Bu aksiyonu başlatacak sinyal var mı?
- Düşük M → Spark (motivasyon artırıcı tetikleyici)
- Düşük A → Facilitator (kolaylaştırıcı tetikleyici)
- İkisi de yüksek → Signal (basit hatırlatıcı)

**Kural:** M × A yeterince yüksek DEĞİLSE, aksiyonu KÜÇÜLT veya motivasyonu ARTIR.
Her aksiyon planı maddesinde "bottleneck" ve "recommendation" belirt.
`;
