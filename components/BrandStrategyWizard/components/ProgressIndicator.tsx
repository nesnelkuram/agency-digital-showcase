import React from 'react';
import { motion } from 'framer-motion';

interface StageGroup {
  label: string;
  startStep: number;
  endStep: number;
}

interface ProgressIndicatorProps {
  currentStep: number;
  totalSteps: number;
  stageGroups?: StageGroup[];
  onNavigate?: (step: number) => void;
}

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  currentStep,
  totalSteps,
  stageGroups,
  onNavigate,
}) => {
  // If no stage groups provided, fall back to simple dots
  if (!stageGroups || stageGroups.length === 0) {
    return (
      <div className="flex items-center gap-2">
        {Array.from({ length: totalSteps }).map((_, index) => (
          <motion.div
            key={index}
            className="h-2 rounded-full transition-all duration-300"
            style={{
              width: index === currentStep ? '2rem' : '0.5rem',
              backgroundColor:
                index === currentStep
                  ? '#2563eb'
                  : index < currentStep
                    ? '#737373'
                    : '#d4d4d4',
            }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
          />
        ))}
      </div>
    );
  }

  // Stage-grouped progress with clickable back navigation
  return (
    <div className="flex items-center gap-1.5 md:gap-2">
      {stageGroups.map((group, index) => {
        const isActive = currentStep >= group.startStep && currentStep <= group.endStep;
        const isCompleted = currentStep > group.endStep;
        const isFuture = currentStep < group.startStep;
        const canNavigate = isCompleted && onNavigate;

        // Calculate progress within this stage
        const stageSteps = group.endStep - group.startStep + 1;
        const stepsIntoStage = Math.max(0, Math.min(currentStep - group.startStep, stageSteps));
        const stageProgress = isCompleted ? 1 : isActive ? stepsIntoStage / stageSteps : 0;

        return (
          <motion.button
            key={index}
            type="button"
            disabled={!canNavigate}
            onClick={() => {
              if (canNavigate) {
                onNavigate(group.startStep);
              }
            }}
            className={`
              relative h-2 rounded-full overflow-hidden transition-all duration-300
              ${canNavigate ? 'cursor-pointer hover:opacity-80' : isFuture ? 'cursor-default' : 'cursor-default'}
            `}
            style={{
              width: isActive ? '3rem' : '1rem',
              backgroundColor: isFuture ? '#d4d4d4' : '#e5e5e5',
            }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.08 }}
            title={canNavigate ? `${group.label} — geri don` : group.label}
          >
            {/* Fill bar */}
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                backgroundColor: isActive ? '#2563eb' : isCompleted ? '#737373' : 'transparent',
              }}
              initial={{ width: '0%' }}
              animate={{ width: `${stageProgress * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </motion.button>
        );
      })}
    </div>
  );
};

export default ProgressIndicator;
