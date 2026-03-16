export type QuestionType =
  | 'intro'
  | 'selection_scored'  // Puanlı seçenekler
  | 'selection_card'    // Kart seçimi (arketip vb.)
  | 'selection_multi'   // Çoklu seçim
  | 'selection_list'    // Tekli seçim
  | 'text_area'         // Serbest metin girişi (işletme bağlamı)
  | 'educational'       // Eğitim sayfaları
  | 'stage_result'      // Aşama sonuç ekranı
  | 'outro';

export interface SelectionOption {
  id: string;
  title: string;
  desc?: string;
  icon?: string;
  score?: number;  // Puanlama için
}

export interface StageInfo {
  stage: number;
  title: string;
  description: string;
}

export interface ResultMatrix {
  minScore: number;
  maxScore: number;
  title: string;
  description: string;
  recommendations: string[];
  caseStudy?: {
    title: string;
    summary: string;
    outcome: string;
    type: 'success' | 'failure';
  };
  scenario?: string;
}

export interface Question {
  id: number;
  type: QuestionType;
  stage?: StageInfo;  // Hangi aşamada olduğumuz
  script: string;
  text: string;
  placeholder?: string;
  options?: SelectionOption[] | null;
  action?: string;
  stageDescription?: string;  // Aşama açıklaması (intro'da gösterilir)

  // Educational için
  stats?: Array<{
    value: string;
    label: string;
    description: string;
    source: string;
  }>;
  caseStudy?: {
    title: string;
    summary: string;
    outcome: string;
    type: 'success' | 'failure';
  };
  scenario?: string;

  // Stage result için
  resultMatrix?: ResultMatrix[];
  stageQuestions?: number[];  // Bu aşamadaki soru ID'leri

  // Conditional visibility (business context questions only)
  condition?: { key: string; includes: string };
}

export interface WizardState {
  currentStep: number;
  answers: Record<number, string | string[]>;
  scores: Record<number, number>;  // Her aşamanın puanı
  stageResults: Record<number, ResultMatrix>;  // Her aşamanın sonucu
}

// ============================================================================
// SEKTÖR SORU KONFİGÜRASYONU
// ============================================================================

export interface StageQuestion {
  type: 'selection_scored' | 'selection_list' | 'selection_card' | 'selection_multi';
  script: string;
  text: string;
  options: SelectionOption[];
  placeholder?: string;
}

export interface EducationalContent {
  script: string;
  text: string;
  stats: Array<{
    value: string;
    label: string;
    description: string;
    source: string;
  }>;
  caseStudy: {
    title: string;
    summary: string;
    outcome: string;
    type: 'success' | 'failure';
  };
  scenario: string;
}

export interface StageConfig {
  intro: {
    script: string;
    stageDescription: string;
  };
  questions: [StageQuestion, StageQuestion, StageQuestion];
  educational: EducationalContent;
  resultMatrix: ResultMatrix[];
}

// ============================================================================
// İŞLETME BAĞLAM SORULARI
// ============================================================================

export interface BusinessContextQuestion {
  type: 'text_area' | 'selection_list' | 'selection_multi';
  key: string;          // businessDescription, competitors, geoScope, vb.
  script: string;
  text: string;
  required: boolean;
  options?: SelectionOption[];
  placeholder?: string;
  /** Show this question only when condition is met (checked against businessContext) */
  condition?: { key: string; includes: string };
}

export interface BusinessContextConfig {
  intro: { script: string; text: string };
  questions: BusinessContextQuestion[];
}

export interface SectorQuestionConfig {
  sectorId: string;
  intro: {
    script: string;
    text: string;
  };
  businessContext?: BusinessContextConfig;
  stages: [StageConfig, StageConfig, StageConfig, StageConfig, StageConfig];
  outro?: {
    script?: string;
  };
}
