import React from 'react';
import { motion } from 'framer-motion';
import { Question, SelectionOption } from '../../types';

interface SelectionScoredQuestionProps {
  question: Question;
  selectedId: string | null;
  onSelect: (id: string, score: number) => void;
}

const SelectionScoredQuestion: React.FC<SelectionScoredQuestionProps> = ({
  question,
  selectedId,
  onSelect,
}) => {
  const options = question.options || [];

  return (
    <motion.div
      className="flex flex-col gap-6 w-full max-w-xl"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="space-y-3 text-center">
        <h2 className="text-2xl md:text-3xl font-bold font-grotesk" style={{ color: '#171717' }}>
          {question.text}
        </h2>
        <p className="text-base md:text-lg leading-relaxed font-grotesk" style={{ color: '#525252' }}>
          {question.script}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {options.map((option: SelectionOption, index: number) => {
          const isSelected = selectedId === option.id;

          return (
            <motion.button
              key={option.id}
              onClick={() => onSelect(option.id, option.score || 0)}
              className="flex items-center gap-4 p-6 rounded-2xl text-left border-2 transition-all duration-200 cursor-pointer
                         hover:shadow-md"
              style={{
                backgroundColor: isSelected ? '#171717' : '#fffceb',
                borderColor: isSelected ? '#171717' : '#e5e5e5',
              }}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              whileTap={{ scale: 0.98 }}
            >
              <div
                className="w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200"
                style={{
                  borderColor: isSelected ? '#ffffff' : '#d4d4d4',
                  backgroundColor: 'transparent',
                }}
              >
                {isSelected && (
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: '#ffffff' }}
                  />
                )}
              </div>
              <div className="flex flex-col gap-2">
                <span className="font-grotesk font-medium text-lg" style={{ color: isSelected ? '#ffffff' : '#171717' }}>
                  {option.title}
                </span>
                {option.desc && (
                  <p className="text-sm font-grotesk leading-relaxed" style={{ color: isSelected ? '#d4d4d4' : '#525252' }}>
                    {option.desc}
                  </p>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
};

export default SelectionScoredQuestion;
