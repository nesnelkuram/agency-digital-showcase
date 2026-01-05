import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  const [otherText, setOtherText] = useState('');

  useEffect(() => {
    if (selectedId && selectedId.startsWith('other:')) {
      setOtherText(selectedId.substring(6));
    } else {
      setOtherText('');
    }
  }, [selectedId]);

  const handleOtherTextChange = (text: string) => {
    setOtherText(text);
    // Find the "other" option to get its score
    const otherOption = options.find(opt => opt.id === 'other');
    onSelect(`other:${text}`, otherOption?.score || 0);
  };

  const isOtherSelected = selectedId?.startsWith('other');

  return (
    <motion.div
      className="flex flex-col gap-6 w-full max-w-xl"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="space-y-3 text-center">
        <h2 className="text-2xl md:text-3xl font-bold font-ramillas px-4" style={{ color: '#171717' }}>
          {question.text}
        </h2>
        <p className="text-base md:text-lg leading-relaxed font-grotesk px-4" style={{ color: '#525252' }}>
          {question.script}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {options.map((option: SelectionOption, index: number) => {
          const isSelected = option.id === 'other' ? isOtherSelected : selectedId === option.id;

          return (
            <React.Fragment key={option.id}>
              <motion.button
                onClick={() => option.id === 'other' ? onSelect('other:', option.score || 0) : onSelect(option.id, option.score || 0)}
                className="flex items-center gap-3 md:gap-4 p-4 md:p-6 rounded-2xl text-left border-2 transition-all duration-200 cursor-pointer
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
                  className="w-5 h-5 md:w-6 md:h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200"
                  style={{
                    borderColor: isSelected ? '#ffffff' : '#d4d4d4',
                    backgroundColor: 'transparent',
                  }}
                >
                  {isSelected && (
                    <div
                      className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full"
                      style={{ backgroundColor: '#ffffff' }}
                    />
                  )}
                </div>
                <div className="flex flex-col gap-1 md:gap-2">
                  <span className="font-grotesk font-bold text-base md:text-lg" style={{ color: isSelected ? '#ffffff' : '#171717' }}>
                    {option.title}
                  </span>
                  {option.desc && (
                    <p className="text-xs md:text-sm font-grotesk leading-relaxed" style={{ color: isSelected ? '#d4d4d4' : '#525252' }}>
                      {option.desc}
                    </p>
                  )}
                </div>
              </motion.button>

              <AnimatePresence>
                {option.id === 'other' && isOtherSelected && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <input
                      type="text"
                      value={otherText}
                      onChange={(e) => handleOtherTextChange(e.target.value)}
                      placeholder={question.placeholder || "Lütfen belirtin..."}
                      className="w-full px-4 md:px-6 py-3 md:py-4 rounded-2xl border-2 focus:outline-none transition-all duration-200
                                 font-grotesk text-sm md:text-base"
                      style={{
                        backgroundColor: '#ffffff',
                        borderColor: '#e5e5e5',
                        color: '#171717',
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#d4d4d4'}
                      onBlur={(e) => e.target.style.borderColor = '#e5e5e5'}
                      autoFocus
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </React.Fragment>
          );
        })}
      </div>
    </motion.div>
  );
};

export default SelectionScoredQuestion;
