import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Loader2, CheckCircle2, XCircle,
  Database, Search, Compass, Swords, Layers,
  Globe, Users, BookOpen, Pen,
} from 'lucide-react';
import type { AgentProgress, AgentName } from '@/shared/types/pipelineRun';

export type AnalysisPhase = 'normalizing' | 'researching' | 'analyzing' | 'completed';

interface ProgressStep {
  id: AgentName;
  label: string;
  icon: React.ReactNode;
  phase: AnalysisPhase; // legacy fallback mapping
}

const ALL_STEPS: ProgressStep[] = [
  { id: 'dataNormalizer', label: 'Veri Normalizasyonu', icon: <Database className="w-4 h-4" />, phase: 'normalizing' },
  { id: 'sectorResearch', label: 'Derin Web Arastirmasi', icon: <Search className="w-4 h-4" />, phase: 'researching' },
  { id: 'brandStrategist', label: 'Marka Stratejisi', icon: <Compass className="w-4 h-4" />, phase: 'analyzing' },
  { id: 'digitalPresenceAnalyzer', label: 'Dijital Varlik Analizi', icon: <Globe className="w-4 h-4" />, phase: 'analyzing' },
  { id: 'competitorDiscovery', label: 'Rakip Kesfetme', icon: <Users className="w-4 h-4" />, phase: 'analyzing' },
  { id: 'brandChallenger', label: 'Strateji Tartismasi', icon: <Swords className="w-4 h-4" />, phase: 'analyzing' },
  { id: 'blogStrategyAdvisor', label: 'Blog Strateji Danismani', icon: <BookOpen className="w-4 h-4" />, phase: 'analyzing' },
  { id: 'strategySynthesizer', label: 'Sentez & Rapor', icon: <Layers className="w-4 h-4" />, phase: 'analyzing' },
  { id: 'consultantIntroWriter', label: 'Danisman Girisi', icon: <Pen className="w-4 h-4" />, phase: 'analyzing' },
];

// Legacy phase-to-step mapping for timer fallback
const PHASE_TO_STEP: Record<AnalysisPhase, number> = {
  normalizing: 0,
  researching: 1,
  analyzing: 2,
  completed: 9,
};

interface Props {
  /** Real-time agent progress from Firestore (new) */
  agentProgress?: Record<string, AgentProgress>;
  /** Legacy phase-based progress (fallback) */
  phase?: AnalysisPhase;
  isLite?: boolean;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return '<1s';
  return `${Math.round(ms / 1000)}s`;
}

const AnalysisProgressIndicator: React.FC<Props> = ({ agentProgress, phase = 'normalizing', isLite = false }) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [phaseStartTime, setPhaseStartTime] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setElapsedSeconds((prev) => prev + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => { setPhaseStartTime(elapsedSeconds); }, [phase]);

  // Filter steps for lite mode
  const liteSkipIds: AgentName[] = ['sectorResearch', 'brandChallenger', 'blogStrategyAdvisor', 'strategySynthesizer'];
  const activeSteps = isLite
    ? ALL_STEPS.filter((s) => !liteSkipIds.includes(s.id))
    : ALL_STEPS;

  // ============================
  // MODE: Real-time (Firestore)
  // ============================
  if (agentProgress) {
    // Filter out skipped agents from display
    const visibleSteps = activeSteps.filter((s) => {
      const ap = agentProgress[s.id];
      return !ap || ap.status !== 'skipped';
    });

    const completedCount = visibleSteps.filter((s) => agentProgress[s.id]?.status === 'completed').length;
    const failedCount = visibleSteps.filter((s) => agentProgress[s.id]?.status === 'failed').length;
    const runningAgent = visibleSteps.find((s) => agentProgress[s.id]?.status === 'running');
    const allDone = completedCount + failedCount === visibleSteps.length;

    const progress = allDone ? 100 : Math.min((completedCount / visibleSteps.length) * 100 + 5, 95);

    const statusMessage = allDone
      ? 'Analiz tamamlandi!'
      : runningAgent
        ? `${runningAgent.label} calisiyor...`
        : 'Analiz devam ediyor...';

    return (
      <div className="text-center py-12">
        {allDone ? (
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-6" />
        ) : (
          <Loader2 className="w-12 h-12 text-purple-400 mx-auto mb-6 animate-spin" />
        )}
        <h3 className="font-grotesk text-xl font-bold text-neutral-700 mb-2">
          Multi-Agent Analiz {allDone ? 'Tamamlandi' : 'Yapiliyor...'}
        </h3>
        <p className="font-grotesk text-sm text-neutral-500 mb-8">{statusMessage}</p>

        {/* Progress bar */}
        <div className="max-w-md mx-auto mb-8">
          <div className="w-full bg-neutral-100 rounded-full h-2">
            <motion.div
              className={`h-2 rounded-full ${allDone ? 'bg-green-500' : 'bg-purple-500'}`}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
          <p className="font-grotesk text-xs text-neutral-400 mt-2">
            {completedCount}/{visibleSteps.length} agent tamamlandi &bull; {elapsedSeconds}s
          </p>
        </div>

        {/* Steps — real-time */}
        <div className="max-w-sm mx-auto space-y-3">
          {visibleSteps.map((step, i) => {
            const ap = agentProgress[step.id];
            const status = ap?.status || 'pending';

            const bgClass = status === 'running'
              ? 'bg-purple-50 border border-purple-200'
              : status === 'completed'
                ? 'bg-green-50/50'
                : status === 'failed'
                  ? 'bg-red-50/50'
                  : 'bg-neutral-50';

            const iconColorClass = status === 'running'
              ? 'text-purple-600'
              : status === 'completed'
                ? 'text-green-500'
                : status === 'failed'
                  ? 'text-red-500'
                  : 'text-neutral-300';

            const textClass = status === 'running'
              ? 'text-purple-700 font-medium'
              : status === 'completed'
                ? 'text-green-700'
                : status === 'failed'
                  ? 'text-red-600'
                  : 'text-neutral-400';

            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-left ${bgClass}`}
              >
                <div className={`flex-shrink-0 ${iconColorClass}`}>
                  {status === 'completed' ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : status === 'running' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : status === 'failed' ? (
                    <XCircle className="w-4 h-4" />
                  ) : (
                    step.icon
                  )}
                </div>
                <span className={`font-grotesk text-sm ${textClass}`}>{step.label}</span>
                {ap?.durationMs && (
                  <span className="ml-auto font-grotesk text-xs text-neutral-400">
                    {formatDuration(ap.durationMs)}
                  </span>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  }

  // ============================
  // FALLBACK: Timer-based (legacy)
  // ============================
  const legacySteps = isLite
    ? ALL_STEPS.filter((s) => s.id !== 'sectorResearch' && s.id !== 'brandChallenger' &&
        s.id !== 'blogStrategyAdvisor' && s.id !== 'digitalPresenceAnalyzer' &&
        s.id !== 'competitorDiscovery')
    : ALL_STEPS.filter((s) => s.id !== 'digitalPresenceAnalyzer' && s.id !== 'competitorDiscovery' &&
        s.id !== 'blogStrategyAdvisor' && s.id !== 'consultantIntroWriter');

  const baseStepIndex = PHASE_TO_STEP[phase] ?? 0;
  let activeStepIndex = baseStepIndex;
  if (phase === 'analyzing') {
    const phaseElapsed = elapsedSeconds - phaseStartTime;
    if (phaseElapsed > 77) activeStepIndex = legacySteps.length - 1;
    else if (phaseElapsed > 50) activeStepIndex = Math.min(3, legacySteps.length - 1);
    else activeStepIndex = 2;
  }
  activeStepIndex = Math.min(activeStepIndex, legacySteps.length - 1);

  const legacyProgress = phase === 'completed'
    ? 100
    : Math.min(((activeStepIndex + 0.5) / legacySteps.length) * 100, 95);

  const phaseMessages: Record<AnalysisPhase, string> = {
    normalizing: 'Veriler hazirlaniyor...',
    researching: 'Derin web arastirmasi devam ediyor. Bu islem 2-5 dakika surebilir.',
    analyzing: '5 uzman agent marka stratejinizi olusturuyor.',
    completed: 'Analiz tamamlandi!',
  };

  return (
    <div className="text-center py-12">
      <Loader2 className="w-12 h-12 text-purple-400 mx-auto mb-6 animate-spin" />
      <h3 className="font-grotesk text-xl font-bold text-neutral-700 mb-2">
        Multi-Agent Analiz Yapiliyor...
      </h3>
      <p className="font-grotesk text-sm text-neutral-500 mb-8">{phaseMessages[phase]}</p>

      <div className="max-w-md mx-auto mb-8">
        <div className="w-full bg-neutral-100 rounded-full h-2">
          <motion.div
            className="bg-purple-500 h-2 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${legacyProgress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
        <p className="font-grotesk text-xs text-neutral-400 mt-2">
          {Math.round(legacyProgress)}% &bull; {elapsedSeconds}s
        </p>
      </div>

      <div className="max-w-sm mx-auto space-y-3">
        {legacySteps.map((step, i) => {
          const isCompleted = i < activeStepIndex;
          const isActive = i === activeStepIndex;

          return (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-left ${
                isActive ? 'bg-purple-50 border border-purple-200'
                  : isCompleted ? 'bg-green-50/50' : 'bg-neutral-50'
              }`}
            >
              <div className={`flex-shrink-0 ${
                isActive ? 'text-purple-600' : isCompleted ? 'text-green-500' : 'text-neutral-300'
              }`}>
                {isCompleted ? <CheckCircle2 className="w-4 h-4" />
                  : isActive ? <Loader2 className="w-4 h-4 animate-spin" /> : step.icon}
              </div>
              <span className={`font-grotesk text-sm ${
                isActive ? 'text-purple-700 font-medium' : isCompleted ? 'text-green-700' : 'text-neutral-400'
              }`}>{step.label}</span>
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
