import React from 'react';
import { motion } from 'framer-motion';

interface ProgressIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  currentStep,
  totalSteps,
}) => {
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
};

export default ProgressIndicator;
