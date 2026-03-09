import React, { Component, useState, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, RefreshCw, SkipForward } from 'lucide-react';
import { getQuestionsForSector } from './questions';
import { Question, ResultMatrix } from './types';
import { Sector, BusinessContext } from '@/shared/types/brandLead';
import ProgressIndicator from './components/ProgressIndicator';
import SectorSelection from './components/SectorSelection';
import {
  IntroQuestion,
  SelectionCardQuestion,
  SelectionMultiQuestion,
  SelectionListQuestion,
  SelectionScoredQuestion,
  TextAreaQuestion,
  EducationalQuestion,
  StageResultQuestion,
  OutroQuestion,
} from './components/QuestionRenderers';

const VALID_SECTORS: Sector[] = ['gastronomi', 'retail', 'corporate', 'tech', 'health', 'education', 'fmcg', 'showroom'];

const BrandStrategyWizard: React.FC = () => {
  const startTime = useRef(Date.now());

  // Read sector from URL params on mount
  const initialSector = useMemo((): Sector | null => {
    const params = new URLSearchParams(window.location.search);
    const urlSector = params.get('sector') as Sector | null;
    if (urlSector && VALID_SECTORS.includes(urlSector)) {
      return urlSector;
    }
    return null;
  }, []);

  const [selectedSector, setSelectedSector] = useState<Sector | null>(initialSector);
  const [questions, setQuestions] = useState<Question[]>(
    initialSector ? getQuestionsForSector(initialSector) : []
  );
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string | string[]>>({});
  const [scores, setScores] = useState<Record<number, number>>({});
  const [stageResults, setStageResults] = useState<Record<number, ResultMatrix>>({});
  const [businessContext, setBusinessContext] = useState<BusinessContext>({});

  const handleSectorSelect = useCallback((sector: Sector) => {
    setSelectedSector(sector);
    setQuestions(getQuestionsForSector(sector));
    setCurrentStep(0);
    setAnswers({});
    setScores({});
    setStageResults({});
    setBusinessContext({});
    startTime.current = Date.now();
    // Update URL without reload
    const url = new URL(window.location.href);
    url.searchParams.set('sector', sector);
    window.history.replaceState(null, '', url.toString());
  }, []);

  // If no sector selected, show sector selection
  if (!selectedSector || questions.length === 0) {
    return <SectorSelection onSelect={handleSectorSelect} />;
  }

  const currentQuestion = questions[currentStep];

  const handleNext = () => {
    if (currentStep < questions.length - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleAnswer = (questionId: number, value: string | string[]) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleScoredAnswer = (questionId: number, value: string, score: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    setScores((prev) => ({ ...prev, [questionId]: score }));
  };

  // --- Business context helpers ---
  const isBusinessContextQuestion = (q: Question): boolean => {
    return typeof q.action === 'string' && q.action.startsWith('ctx:');
  };

  const getContextKey = (q: Question): string | null => {
    if (!q.action?.startsWith('ctx:')) return null;
    return q.action.split(':')[1];
  };

  const isContextRequired = (q: Question): boolean => {
    if (!q.action?.startsWith('ctx:')) return false;
    return q.action.endsWith(':required');
  };

  const handleBusinessContextUpdate = (key: string, value: string | string[]) => {
    setBusinessContext((prev) => ({ ...prev, [key]: value }));
  };

  const handleSkipContextQuestion = () => {
    if (currentStep < questions.length - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  // Calculate stage result based on scores
  const calculateStageResult = (stageQuestions: number[]): ResultMatrix | null => {
    const totalScore = stageQuestions.reduce((sum, qId) => sum + (scores[qId] || 0), 0);

    if (!currentQuestion.resultMatrix) return null;

    const result = currentQuestion.resultMatrix.find(
      (matrix) => totalScore >= matrix.minScore && totalScore <= matrix.maxScore
    );

    return result || currentQuestion.resultMatrix[0];
  };

  // Get stage result for display
  const getStageResult = (): ResultMatrix | null => {
    if (currentQuestion.type !== 'stage_result' || !currentQuestion.stageQuestions) {
      return null;
    }

    const stage = currentQuestion.stage?.stage;
    if (stage !== undefined && stageResults[stage]) {
      return stageResults[stage];
    }

    const result = calculateStageResult(currentQuestion.stageQuestions);
    if (result && stage !== undefined) {
      setStageResults((prev) => ({ ...prev, [stage]: result }));
    }

    return result;
  };

  // Check if the current question is answered
  const isCurrentAnswered = (): boolean => {
    // Business context questions use businessContext state
    if (isBusinessContextQuestion(currentQuestion)) {
      const key = getContextKey(currentQuestion);
      if (!key) return true;
      const required = isContextRequired(currentQuestion);

      if (currentQuestion.type === 'text_area') {
        const val = (businessContext as any)[key] as string | undefined;
        return required ? (typeof val === 'string' && val.trim().length >= 3) : true;
      }
      if (currentQuestion.type === 'selection_list') {
        const val = (businessContext as any)[key] as string | undefined;
        return required ? (typeof val === 'string' && val.length > 0) : true;
      }
      if (currentQuestion.type === 'selection_multi') {
        const val = (businessContext as any)[key] as string[] | undefined;
        return required ? (Array.isArray(val) && val.length > 0) : true;
      }
      return true;
    }

    const answer = answers[currentQuestion.id];

    switch (currentQuestion.type) {
      case 'intro':
      case 'educational':
      case 'stage_result':
      case 'outro':
        return true;

      case 'selection_scored':
      case 'selection_list':
        return typeof answer === 'string' && answer.length > 0;

      case 'selection_card':
        return typeof answer === 'string' && answer.length > 0;

      case 'selection_multi':
        if (Array.isArray(answer) && answer.length > 0) {
          const hasOther = answer.some(a => typeof a === 'string' && a.startsWith('other:'));
          if (hasOther) {
            const otherEntry = answer.find(a => typeof a === 'string' && a.startsWith('other:'));
            if (otherEntry && typeof otherEntry === 'string') {
              const otherText = otherEntry.substring(6).trim();
              return otherText.length > 0 || answer.filter(a => !a.toString().startsWith('other:')).length > 0;
            }
          }
          return true;
        }
        return false;

      default:
        return false;
    }
  };

  // Render the appropriate question component
  const renderQuestion = () => {
    const { type, id } = currentQuestion;

    switch (type) {
      case 'intro':
        return (
          <IntroQuestion
            question={currentQuestion}
            onNext={handleNext}
          />
        );

      case 'selection_scored':
        return (
          <SelectionScoredQuestion
            question={currentQuestion}
            selectedId={(answers[id] as string) || null}
            onSelect={(value, score) => handleScoredAnswer(id, value, score)}
          />
        );

      case 'selection_card':
        return (
          <SelectionCardQuestion
            question={currentQuestion}
            selectedId={(answers[id] as string) || null}
            onSelect={(value) => handleAnswer(id, value)}
          />
        );

      case 'selection_multi': {
        // Business context multi-select uses businessContext state
        const ctxKey = getContextKey(currentQuestion);
        if (ctxKey) {
          const ctxVal = (businessContext as any)[ctxKey] as string[] || [];
          return (
            <SelectionMultiQuestion
              question={currentQuestion}
              selectedIds={ctxVal}
              onToggle={(optionId) => {
                const current = ctxVal;
                if (current.includes(optionId)) {
                  handleBusinessContextUpdate(ctxKey, current.filter((i) => i !== optionId));
                } else {
                  handleBusinessContextUpdate(ctxKey, [...current, optionId]);
                }
              }}
            />
          );
        }
        return (
          <SelectionMultiQuestion
            question={currentQuestion}
            selectedIds={(answers[id] as string[]) || []}
            onToggle={(optionId) => {
              const current = (answers[id] as string[]) || [];
              if (current.includes(optionId)) {
                handleAnswer(id, current.filter((i) => i !== optionId));
              } else {
                handleAnswer(id, [...current, optionId]);
              }
            }}
          />
        );
      }

      case 'selection_list': {
        // Business context selection uses businessContext state
        const ctxKeyList = getContextKey(currentQuestion);
        if (ctxKeyList) {
          return (
            <SelectionListQuestion
              question={currentQuestion}
              selectedId={((businessContext as any)[ctxKeyList] as string) || null}
              onSelect={(value) => handleBusinessContextUpdate(ctxKeyList, value)}
            />
          );
        }
        return (
          <SelectionListQuestion
            question={currentQuestion}
            selectedId={(answers[id] as string) || null}
            onSelect={(value) => handleAnswer(id, value)}
          />
        );
      }

      case 'text_area': {
        const ctxKeyText = getContextKey(currentQuestion);
        if (ctxKeyText) {
          return (
            <TextAreaQuestion
              question={currentQuestion}
              value={((businessContext as any)[ctxKeyText] as string) || ''}
              onChange={(value) => handleBusinessContextUpdate(ctxKeyText, value)}
            />
          );
        }
        return null;
      }

      case 'educational':
        return (
          <EducationalQuestion
            question={currentQuestion}
            onNext={handleNext}
          />
        );

      case 'stage_result': {
        const result = getStageResult();
        if (!result) return null;

        return (
          <StageResultQuestion
            question={currentQuestion}
            result={result}
            onNext={handleNext}
          />
        );
      }

      case 'outro':
        return (
          <OutroQuestion
            question={currentQuestion}
            questions={questions}
            answers={answers}
            scores={scores}
            stageResults={stageResults}
            sector={selectedSector}
            completionTime={Date.now() - startTime.current}
            businessContext={businessContext}
            onSubmit={(data) => {
              console.log('Final submission:', data);
            }}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen w-full h-auto flex flex-col font-grotesk pb-20 overflow-x-hidden" style={{ backgroundColor: '#ebeef8', color: '#171717' }}>
      {/* Header with progress */}
      <header className="p-4 md:p-6 flex items-center justify-between max-w-full">
        <div className="w-10">
          {currentStep > 0 && currentQuestion.type !== 'intro' && (
            <motion.button
              onClick={handleBack}
              className="p-2 rounded-full hover:opacity-80 transition-opacity"
              style={{ backgroundColor: '#fffceb' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              whileTap={{ scale: 0.95 }}
            >
              <ArrowLeft className="w-5 h-5" style={{ color: '#333333' }} />
            </motion.button>
          )}
        </div>

        <ProgressIndicator
          currentStep={currentStep}
          totalSteps={questions.length}
        />

        <div className="w-10" />
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 md:px-6 py-8 w-full max-w-full overflow-x-hidden">
        {/* Question content with animation */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-full flex flex-col items-center"
          >
            {renderQuestion()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer with next button */}
      {currentQuestion.type !== 'intro' &&
       currentQuestion.type !== 'educational' &&
       currentQuestion.type !== 'stage_result' &&
       currentQuestion.type !== 'outro' && (
        <footer className="p-4 md:p-6 flex flex-col items-center gap-3 w-full max-w-full">
          <motion.button
            onClick={handleNext}
            disabled={!isCurrentAnswered()}
            className={`
              w-full max-w-md text-white rounded-full px-10 py-5 font-grotesk font-semibold text-lg
              shadow-lg transition-all duration-300
              ${!isCurrentAnswered() && 'cursor-not-allowed opacity-40'}
            `}
            style={{
              backgroundColor: '#171717',
            }}
            whileHover={isCurrentAnswered() ? {
              scale: 1.02,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
            } : {}}
            whileTap={isCurrentAnswered() ? { scale: 0.98 } : {}}
          >
            Devam Et
          </motion.button>
          {/* Skip button for optional business context questions */}
          {isBusinessContextQuestion(currentQuestion) && !isContextRequired(currentQuestion) && (
            <motion.button
              onClick={handleSkipContextQuestion}
              className="flex items-center gap-1.5 px-4 py-2 font-grotesk text-sm transition-opacity hover:opacity-70"
              style={{ color: '#a3a3a3' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <SkipForward className="w-3.5 h-3.5" />
              Atla
            </motion.button>
          )}
        </footer>
      )}
    </div>
  );
};

// Error Boundary for graceful failure
interface ErrorBoundaryState {
  hasError: boolean;
}

class WizardErrorBoundary extends Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('BrandStrategyWizard error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="min-h-screen flex flex-col items-center justify-center px-6 font-grotesk"
          style={{ backgroundColor: '#ebeef8', color: '#171717' }}
        >
          <div className="text-center space-y-4 max-w-md">
            <h2 className="text-2xl font-bold font-ramillas">Bir sorun oluştu</h2>
            <p className="text-base" style={{ color: '#525252' }}>
              Değerlendirme sırasında beklenmeyen bir hata meydana geldi. Lütfen sayfayı yenileyin.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-white font-semibold"
              style={{ backgroundColor: '#171717' }}
            >
              <RefreshCw className="w-4 h-4" />
              Sayfayı Yenile
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function BrandStrategyWizardWithBoundary() {
  return (
    <WizardErrorBoundary>
      <BrandStrategyWizard />
    </WizardErrorBoundary>
  );
}
