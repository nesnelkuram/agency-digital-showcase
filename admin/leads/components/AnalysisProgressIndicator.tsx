import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Loader2, CheckCircle2, Database, Search, Compass, Swords, Layers } from 'lucide-react';

export type AnalysisPhase = 'normalizing' | 'researching' | 'analyzing' | 'completed';

interface ProgressStep {
  id: string;
  label: string;
  icon: React.ReactNode;
  phase: AnalysisPhase; // which phase activates this step
}

const STEPS: ProgressStep[] = [
  { id: 'dataNormalizer', label: 'Veri Normalizasyonu', icon: <Database className="w-4 h-4" />, phase: 'normalizing' },
  { id: 'sectorResearch', label: 'Derin Web Arastirmasi', icon: <Search className="w-4 h-4" />, phase: 'researching' },
  { id: 'brandStrategist', label: 'Marka Stratejisi', icon: <Compass className="w-4 h-4" />, phase: 'analyzing' },
  { id: 'brandChallenger', label: 'Strateji Tartismasi', icon: <Swords className="w-4 h-4" />, phase: 'analyzing' },
  { id: 'strategySynthesizer', label: 'Sentez & Rapor', icon: <Layers className="w-4 h-4" />, phase: 'analyzing' },
];

// Map phase to the step index that is "active"
const PHASE_TO_STEP: Record<AnalysisPhase, number> = {
  normalizing: 0,
  researching: 1,
  analyzing: 2, // steps 2-4 animate with elapsed time
  completed: 5,
};

interface Props {
  phase?: AnalysisPhase;
  isLite?: boolean;
}

const AnalysisProgressIndicator: React.FC<Props> = ({ phase = 'normalizing', isLite = false }) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [phaseStartTime, setPhaseStartTime] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Track when phase changes to calculate per-phase elapsed time
  useEffect(() => {
    setPhaseStartTime(elapsedSeconds);
  }, [phase]);

  const activeSteps = isLite
    ? STEPS.filter((s) => s.id !== 'sectorResearch' && s.id !== 'brandChallenger')
    : STEPS;

  // Calculate active step based on phase
  const baseStepIndex = PHASE_TO_STEP[phase] ?? 0;

  // For 'analyzing' phase, advance through steps 2-4 based on elapsed time
  let activeStepIndex = baseStepIndex;
  if (phase === 'analyzing') {
    const phaseElapsed = elapsedSeconds - phaseStartTime;
    // Strategist: 0-50s, Challenger: 50-77s, Synthesizer: 77s+
    if (phaseElapsed > 77) activeStepIndex = 4;
    else if (phaseElapsed > 50) activeStepIndex = 3;
    else activeStepIndex = 2;
  }

  // Clamp to valid range
  activeStepIndex = Math.min(activeStepIndex, activeSteps.length - 1);

  // Progress calculation
  const progress = phase === 'completed'
    ? 100
    : Math.min(((activeStepIndex + 0.5) / activeSteps.length) * 100, 95);

  const phaseMessages: Record<AnalysisPhase, string> = {
    normalizing: 'Veriler hazirlaniyor...',
    researching: 'Derin web arastirmasi devam ediyor. Bu islem 2-5 dakika surebilir.',
    analyzing: '5 uzman agent marka stratejinizi olusturuyor.',
    completed: 'Analiz tamamlandi!',
  };

  return (
    <div className="text-center py-12">
      <Loader2 className="w-12 h-12 text-purple-400 mx-auto mb-6 animate-spin" />
      <h3 className="font-ramillas text-xl font-bold text-neutral-700 mb-2">
        Multi-Agent Analiz Yapiliyor...
      </h3>
      <p className="font-grotesk text-sm text-neutral-500 mb-8">
        {phaseMessages[phase]}
      </p>

      {/* Progress bar */}
      <div className="max-w-md mx-auto mb-8">
        <div className="w-full bg-neutral-100 rounded-full h-2">
          <motion.div
            className="bg-purple-500 h-2 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
        <p className="font-grotesk text-xs text-neutral-400 mt-2">
          {Math.round(progress)}% &bull; {elapsedSeconds}s
        </p>
      </div>

      {/* Steps */}
      <div className="max-w-sm mx-auto space-y-3">
        {activeSteps.map((step, i) => {
          const isCompleted = i < activeStepIndex;
          const isActive = i === activeStepIndex;

          return (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-left ${
                isActive
                  ? 'bg-purple-50 border border-purple-200'
                  : isCompleted
                  ? 'bg-green-50/50'
                  : 'bg-neutral-50'
              }`}
            >
              <div className={`flex-shrink-0 ${
                isActive ? 'text-purple-600' : isCompleted ? 'text-green-500' : 'text-neutral-300'
              }`}>
                {isCompleted ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : isActive ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  step.icon
                )}
              </div>
              <span className={`font-grotesk text-sm ${
                isActive ? 'text-purple-700 font-medium' : isCompleted ? 'text-green-700' : 'text-neutral-400'
              }`}>
                {step.label}
              </span>
              {isActive && step.id === 'sectorResearch' && (
                <span className="ml-auto font-grotesk text-xs text-purple-400">
                  {elapsedSeconds - phaseStartTime}s
                </span>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default AnalysisProgressIndicator;
