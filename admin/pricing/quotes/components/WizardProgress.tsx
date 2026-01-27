import React from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

interface Step {
  id: number;
  title: string;
  shortTitle: string;
}

interface WizardProgressProps {
  steps: Step[];
  currentStep: number;
  onStepClick: (step: number) => void;
}

const WizardProgress: React.FC<WizardProgressProps> = ({
  steps,
  currentStep,
  onStepClick,
}) => {
  return (
    <div className="bg-neutral-50 border-t border-neutral-100">
      <div className="max-w-5xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const isCompleted = currentStep > step.id;
            const isCurrent = currentStep === step.id;
            const isClickable = step.id <= currentStep;

            return (
              <React.Fragment key={step.id}>
                {/* Step indicator */}
                <button
                  onClick={() => isClickable && onStepClick(step.id)}
                  disabled={!isClickable}
                  className={`flex flex-col items-center gap-1.5 group ${
                    isClickable ? 'cursor-pointer' : 'cursor-not-allowed'
                  }`}
                >
                  <motion.div
                    className={`
                      w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                      transition-colors duration-200
                      ${
                        isCompleted
                          ? 'bg-green-500 text-white'
                          : isCurrent
                          ? 'bg-[#171717] text-white'
                          : 'bg-neutral-200 text-neutral-500'
                      }
                      ${isClickable && !isCurrent ? 'group-hover:bg-neutral-300' : ''}
                    `}
                    initial={false}
                    animate={{
                      scale: isCurrent ? 1.1 : 1,
                    }}
                    transition={{ duration: 0.2 }}
                  >
                    {isCompleted ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      step.id
                    )}
                  </motion.div>
                  <span
                    className={`
                      font-grotesk text-xs hidden sm:block
                      ${isCurrent ? 'text-[#171717] font-medium' : 'text-neutral-500'}
                    `}
                  >
                    {step.shortTitle}
                  </span>
                </button>

                {/* Connector line */}
                {index < steps.length - 1 && (
                  <div className="flex-1 mx-2 h-0.5 bg-neutral-200 relative">
                    <motion.div
                      className="absolute inset-0 bg-green-500 origin-left"
                      initial={false}
                      animate={{
                        scaleX: isCompleted ? 1 : 0,
                      }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default WizardProgress;
