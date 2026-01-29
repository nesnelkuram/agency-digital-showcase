import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, CheckCircle2, Database, Search, Compass, Swords, Layers } from 'lucide-react';

interface ProgressStep {
  id: string;
  label: string;
  icon: React.ReactNode;
  estimatedDuration: number; // seconds
}

const STEPS: ProgressStep[] = [
  { id: 'dataNormalizer', label: 'Veri Normalizasyonu', icon: <Database className="w-4 h-4" />, estimatedDuration: 5 },
  { id: 'sectorResearch', label: 'Sektor Arastirmasi', icon: <Search className="w-4 h-4" />, estimatedDuration: 12 },
  { id: 'brandStrategist', label: 'Marka Stratejisi', icon: <Compass className="w-4 h-4" />, estimatedDuration: 12 },
  { id: 'brandChallenger', label: 'Strateji Tartismasi', icon: <Swords className="w-4 h-4" />, estimatedDuration: 12 },
  { id: 'strategySynthesizer', label: 'Sentez & Rapor', icon: <Layers className="w-4 h-4" />, estimatedDuration: 14 },
];

interface Props {
  isLite?: boolean;
}

const AnalysisProgressIndicator: React.FC<Props> = ({ isLite = false }) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Filter steps for lite mode
  const activeSteps = isLite
    ? STEPS.filter((s) => s.id !== 'sectorResearch' && s.id !== 'brandChallenger')
    : STEPS;

  // Calculate which step is "active" based on elapsed time
  let cumulativeTime = 0;
  let activeStepIndex = 0;
  for (let i = 0; i < activeSteps.length; i++) {
    cumulativeTime += activeSteps[i].estimatedDuration;
    if (elapsedSeconds < cumulativeTime) {
      activeStepIndex = i;
      break;
    }
    if (i === activeSteps.length - 1) {
      activeStepIndex = i;
    }
  }

  const totalEstimated = activeSteps.reduce((sum, s) => sum + s.estimatedDuration, 0);
  const progress = Math.min((elapsedSeconds / totalEstimated) * 100, 95);

  return (
    <div className="text-center py-12">
      <Loader2 className="w-12 h-12 text-purple-400 mx-auto mb-6 animate-spin" />
      <h3 className="font-ramillas text-xl font-bold text-neutral-700 mb-2">
        Multi-Agent Analiz Yapiliyor...
      </h3>
      <p className="font-grotesk text-sm text-neutral-500 mb-8">
        5 uzman agent marka stratejinizi olusturuyor. Bu islem 30-50 saniye surebilir.
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
          {Math.round(progress)}% • {elapsedSeconds}s
        </p>
      </div>

      {/* Steps */}
      <div className="max-w-sm mx-auto space-y-3">
        {activeSteps.map((step, i) => {
          const isCompleted = i < activeStepIndex;
          const isActive = i === activeStepIndex;
          const isPending = i > activeStepIndex;

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
              {isActive && (
                <span className="ml-auto font-grotesk text-xs text-purple-400">
                  ~{step.estimatedDuration}s
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
