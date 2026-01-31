import React from 'react';
import { motion } from 'framer-motion';
import { Question } from '../../types';

interface TextAreaQuestionProps {
  question: Question;
  value: string;
  onChange: (value: string) => void;
}

const TextAreaQuestion: React.FC<TextAreaQuestionProps> = ({
  question,
  value,
  onChange,
}) => {
  return (
    <motion.div
      className="flex flex-col gap-6 w-full max-w-xl"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="space-y-3 text-center">
        <h2 className="text-2xl md:text-3xl font-bold font-ramillas" style={{ color: '#171717' }}>
          {question.text}
        </h2>
        <p className="text-base md:text-lg leading-relaxed font-grotesk" style={{ color: '#525252' }}>
          {question.script}
        </p>
      </div>

      <div className="w-full">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={question.placeholder || ''}
          rows={3}
          className="w-full px-6 py-4 rounded-2xl border-2 focus:outline-none transition-all duration-200
                     font-grotesk text-base resize-none"
          style={{
            backgroundColor: '#fffceb',
            borderColor: value.trim() ? '#171717' : '#e5e5e5',
            color: '#171717',
          }}
          onFocus={(e) => { if (!value.trim()) e.target.style.borderColor = '#d4d4d4'; }}
          onBlur={(e) => { if (!value.trim()) e.target.style.borderColor = '#e5e5e5'; }}
        />
        <div className="flex justify-end mt-2">
          <span
            className="text-xs font-grotesk"
            style={{ color: '#a3a3a3' }}
          >
            {value.length} / 300
          </span>
        </div>
      </div>
    </motion.div>
  );
};

export default TextAreaQuestion;
