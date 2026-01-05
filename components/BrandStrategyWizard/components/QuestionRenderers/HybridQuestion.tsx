import React from 'react';
import { motion } from 'framer-motion';
import { Question } from '../../types';
import VoiceButton from '../VoiceButton';

interface HybridQuestionProps {
  question: Question;
  value: string;
  onChange: (value: string) => void;
  isRecording: boolean;
  onToggleRecording: () => void;
}

const HybridQuestion: React.FC<HybridQuestionProps> = ({
  question,
  value,
  onChange,
  isRecording,
  onToggleRecording,
}) => {
  return (
    <motion.div
      className="flex flex-col gap-6 w-full max-w-2xl"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="space-y-2">
        <h2 className="text-2xl md:text-3xl font-bold font-ramillas" style={{ color: '#171717' }}>
          {question.text}
        </h2>
        <p className="text-base leading-relaxed font-grotesk" style={{ color: '#525252' }}>
          {question.script}
        </p>
      </div>

      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={question.placeholder}
          className="w-full h-40 rounded-xl px-5 py-4 resize-none border-2 focus:outline-none transition-all duration-200 pr-16"
          style={{
            backgroundColor: '#ffffff',
            borderColor: '#d4d4d4',
            color: '#171717',
          }}
          onFocus={(e) => e.target.style.borderColor = '#2563eb'}
          onBlur={(e) => e.target.style.borderColor = '#d4d4d4'}
        />
        <div className="absolute bottom-4 right-4">
          <VoiceButton
            isRecording={isRecording}
            onToggle={onToggleRecording}
          />
        </div>
      </div>
    </motion.div>
  );
};

export default HybridQuestion;
