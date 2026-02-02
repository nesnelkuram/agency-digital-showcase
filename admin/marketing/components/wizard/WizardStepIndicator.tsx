import React from 'react';
import { Check } from 'lucide-react';

interface WizardStepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  stepLabels: string[];
}

export function WizardStepIndicator({
  currentStep,
  totalSteps,
  stepLabels,
}: WizardStepIndicatorProps) {
  return (
    <div className="w-full py-6">
      <div className="flex items-center justify-between max-w-4xl mx-auto">
        {Array.from({ length: totalSteps }, (_, index) => {
          const step = index + 1;
          const isCompleted = step < currentStep;
          const isActive = step === currentStep;
          const isFuture = step > currentStep;

          return (
            <React.Fragment key={step}>
              <div className="flex flex-col items-center">
                {/* Circle */}
                <div
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center font-commons font-semibold text-sm
                    ${
                      isCompleted
                        ? 'bg-emerald-500 text-white'
                        : isActive
                        ? 'bg-indigo-600 text-white'
                        : 'bg-neutral-200 text-neutral-500'
                    }
                  `}
                >
                  {isCompleted ? <Check className="w-5 h-5" /> : step}
                </div>

                {/* Label */}
                <span
                  className={`
                    mt-2 text-xs font-commons text-center max-w-[80px]
                    ${
                      isActive
                        ? 'text-indigo-600 font-medium'
                        : isCompleted
                        ? 'text-neutral-700'
                        : 'text-neutral-400'
                    }
                  `}
                >
                  {stepLabels[index]}
                </span>
              </div>

              {/* Connecting line */}
              {step < totalSteps && (
                <div
                  className={`
                    flex-1 h-0.5 mx-2 mb-6
                    ${
                      step < currentStep
                        ? 'bg-emerald-500'
                        : 'bg-neutral-200'
                    }
                  `}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
