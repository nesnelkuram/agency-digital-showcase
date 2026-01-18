import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { questions } from './questions';
import { ResultMatrix } from './types';
import { Sector } from '@/shared/types/brandLead';
import ProgressIndicator from './components/ProgressIndicator';
import {
  IntroQuestion,
  SelectionCardQuestion,
  SelectionMultiQuestion,
  SelectionListQuestion,
  SelectionScoredQuestion,
  EducationalQuestion,
  StageResultQuestion,
  OutroQuestion,
} from './components/QuestionRenderers';

interface BrandStrategyWizardProps {
  sector?: Sector;
}

const BrandStrategyWizard: React.FC<BrandStrategyWizardProps> = ({ sector = 'gastronomi' }) => {
  const startTime = useRef(Date.now());
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string | string[]>>({});
  const [scores, setScores] = useState<Record<number, number>>({});
  const [stageResults, setStageResults] = useState<Record<number, ResultMatrix>>({});

  const currentQuestion = questions[currentStep];

  const handleNext = useCallback(() => {
    if (currentStep < questions.length - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  }, [currentStep]);

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep]);

  const handleAnswer = useCallback((questionId: number, value: string | string[]) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }, []);

  const handleScoredAnswer = useCallback((questionId: number, value: string, score: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    setScores((prev) => ({ ...prev, [questionId]: score }));
  }, []);

  // Calculate stage result based on scores
  const calculateStageResult = useCallback((stageQuestions: number[]): ResultMatrix | null => {
    const totalScore = stageQuestions.reduce((sum, qId) => sum + (scores[qId] || 0), 0);

    if (!currentQuestion.resultMatrix) return null;

    // Find matching result matrix
    const result = currentQuestion.resultMatrix.find(
      (matrix) => totalScore >= matrix.minScore && totalScore <= matrix.maxScore
    );

    return result || currentQuestion.resultMatrix[0];
  }, [scores, currentQuestion]);

  // Get stage result for display
  const getStageResult = useCallback((): ResultMatrix | null => {
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
  }, [currentQuestion, stageResults, calculateStageResult]);

  // Check if the current question is answered
  const isCurrentAnswered = (): boolean => {
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

      case 'selection_multi':
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

      case 'selection_list':
        return (
          <SelectionListQuestion
            question={currentQuestion}
            selectedId={(answers[id] as string) || null}
            onSelect={(value) => handleAnswer(id, value)}
          />
        );

      case 'educational':
        return (
          <EducationalQuestion
            question={currentQuestion}
            onNext={handleNext}
          />
        );

      case 'stage_result':
        const result = getStageResult();
        if (!result) return null;

        return (
          <StageResultQuestion
            question={currentQuestion}
            result={result}
            onNext={handleNext}
          />
        );

      case 'outro':
        return (
          <OutroQuestion
            question={currentQuestion}
            answers={answers}
            scores={scores}
            stageResults={stageResults}
            sector={sector}
            completionTime={Date.now() - startTime.current}
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
        <footer className="p-4 md:p-6 flex justify-center w-full max-w-full">
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
        </footer>
      )}
    </div>
  );
};

export default BrandStrategyWizard;
