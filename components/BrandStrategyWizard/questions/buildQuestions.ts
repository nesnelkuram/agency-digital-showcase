import { Question, SectorQuestionConfig } from '../types';
import { businessContextConfig } from './businessContext';

const STAGE_META = [
  { stage: 0, title: "Operasyonel Gerçeklik", description: "Brand Readiness Gate" },
  { stage: 1, title: "Marka Ruhu", description: "The Soul" },
  { stage: 2, title: "Marka Karakteri", description: "Arketip" },
  { stage: 3, title: "Kim Değiliz", description: "Anti-Persona" },
  { stage: 4, title: "Hedef ve Başarı", description: "Viral mi, Değer mi?" },
];

const STAGE_LABELS = [
  "Aşama 1 — Operasyonel Gerçeklik",
  "Aşama 2 — Marka Ruhu",
  "Aşama 3 — Marka Karakteri",
  "Aşama 4 — Kim Değiliz",
  "Aşama 5 — Hedef ve Başarı",
];

export function buildQuestions(config: SectorQuestionConfig): Question[] {
  const questions: Question[] = [];
  let id = 1;

  // Global intro
  questions.push({
    id: id++,
    type: 'intro',
    script: config.intro.script,
    text: config.intro.text,
    action: "Başlayalım"
  });

  // Business context questions (after intro, before stages)
  // These use a separate state (businessContext) and don't affect stage question IDs.
  const ctxConfig = config.businessContext || businessContextConfig;
  // Context intro
  questions.push({
    id: id++,
    type: 'intro',
    script: ctxConfig.intro.script,
    text: ctxConfig.intro.text,
    action: "Devam",
    stageDescription: "Bu bilgiler AI analizinizin kalitesini doğrudan artırır.",
  });
  // Context questions - use negative IDs to keep them separate from stage question IDs
  ctxConfig.questions.forEach((q) => {
    questions.push({
      id: id++,
      type: q.type as Question['type'],
      script: q.script,
      text: q.text,
      options: q.options || null,
      placeholder: q.placeholder,
      // Store the context key + importance in the action field for identification
      // Importance tiers: required (zorunlu) | important (yarı-zorunlu) | optional (serbest)
      action: `ctx:${q.key}:${q.required ? 'required' : q.important ? 'important' : 'optional'}`,
      condition: q.condition,
    });
  });

  // 5 stages
  config.stages.forEach((stage, stageIndex) => {
    const meta = STAGE_META[stageIndex];
    const questionIds: number[] = [];

    // Stage intro
    questions.push({
      id: id++,
      type: 'intro',
      stage: { stage: meta.stage, title: meta.title, description: meta.description },
      script: stage.intro.script,
      text: STAGE_LABELS[stageIndex],
      stageDescription: stage.intro.stageDescription,
      action: "Devam"
    });

    // 3 questions per stage
    stage.questions.forEach((q, qIndex) => {
      const qId = id++;
      questionIds.push(qId);
      questions.push({
        id: qId,
        type: q.type,
        script: q.script,
        text: `${stageIndex}.${qIndex + 1} — ${q.text}`,
        options: q.options,
        placeholder: q.placeholder,
      });
    });

    // Educational
    questions.push({
      id: id++,
      type: 'educational',
      script: stage.educational.script,
      text: stage.educational.text,
      stats: stage.educational.stats,
      caseStudy: stage.educational.caseStudy,
      scenario: stage.educational.scenario,
      action: "Devam"
    });

    // Stage result
    questions.push({
      id: id++,
      type: 'stage_result',
      stage: { stage: meta.stage, title: meta.title, description: meta.description },
      script: `${meta.title} sonucu belirlendi`,
      text: `Aşama ${stageIndex + 1} Sonucu`,
      stageQuestions: questionIds,
      resultMatrix: stage.resultMatrix,
      action: "Sonraki Aşama"
    });
  });

  // Outro
  questions.push({
    id: id++,
    type: 'outro',
    script: config.outro?.script || "Bu tünel içerik üretmez. İçeriğin sınırlarını ve taşıma kapasitesini belirler.",
    text: "Analiz Tamamlandı",
    action: "Stratejik Özeti Gör"
  });

  return questions;
}
