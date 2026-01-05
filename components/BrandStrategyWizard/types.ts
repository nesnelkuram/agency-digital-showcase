export type QuestionType =
  | 'intro'
  | 'selection_scored'  // Puanlı seçenekler
  | 'selection_card'    // Kart seçimi (arketip vb.)
  | 'selection_multi'   // Çoklu seçim
  | 'selection_list'    // Tekli seçim
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
}

export interface WizardState {
  currentStep: number;
  answers: Record<number, string | string[]>;
  scores: Record<number, number>;  // Her aşamanın puanı
  stageResults: Record<number, ResultMatrix>;  // Her aşamanın sonucu
}
