import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

interface Props {
  questions: string[];
  onSelect: (question: string) => void;
}

const PersonaSuggestedQuestions: React.FC<Props> = ({ questions, onSelect }) => {
  if (questions.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-purple-500" />
        <span className="font-grotesk text-sm text-neutral-500">Baslangic sorulari</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {questions.map((q, i) => (
          <motion.button
            key={i}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.08 }}
            onClick={() => onSelect(q)}
            className="px-3 py-2 rounded-xl bg-white border border-neutral-200 hover:border-purple-300 hover:bg-purple-50 transition-colors font-grotesk text-sm text-neutral-700 text-left"
          >
            {q}
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export default PersonaSuggestedQuestions;
