import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle, TrendingUp, AlertCircle } from 'lucide-react';
import { Question } from '../../types';

interface EducationalQuestionProps {
  question: Question;
  onNext: () => void;
}

const EducationalQuestion: React.FC<EducationalQuestionProps> = ({ question, onNext }) => {
  return (
    <motion.div
      className="flex flex-col items-center gap-8 w-full max-w-3xl"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Header */}
      <div className="text-center space-y-3">
        <h2 className="text-2xl md:text-3xl font-bold font-grotesk" style={{ color: '#171717' }}>
          {question.text}
        </h2>
        <p className="text-base md:text-lg leading-relaxed font-grotesk" style={{ color: '#525252' }}>
          {question.script}
        </p>
      </div>

      {/* Stats Grid */}
      {question.stats && question.stats.length > 0 && (
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {question.stats.map((stat, index) => (
            <motion.div
              key={index}
              className="p-6 rounded-xl border-2"
              style={{
                backgroundColor: '#ffffff',
                borderColor: '#e5e5e5',
              }}
              whileHover={{
                borderColor: '#d4d4d4',
                scale: 1.02,
              }}
              transition={{ duration: 0.2 }}
            >
              <div className="text-4xl font-bold font-grotesk mb-2" style={{ color: '#171717' }}>
                {stat.value}
              </div>
              <div className="text-sm font-semibold font-grotesk mb-2" style={{ color: '#171717' }}>
                {stat.label}
              </div>
              <p className="text-xs font-grotesk leading-relaxed mb-2" style={{ color: '#525252' }}>
                {stat.description}
              </p>
              <p className="text-xs font-grotesk italic" style={{ color: '#737373' }}>
                {stat.source}
              </p>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Case Study */}
      {question.caseStudy && (
        <motion.div
          className="w-full p-6 rounded-xl border-2"
          style={{
            backgroundColor: question.caseStudy.type === 'failure' ? '#fef2f2' : '#f0fdf4',
            borderColor: question.caseStudy.type === 'failure' ? '#fca5a5' : '#86efac',
          }}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-start gap-4">
            {question.caseStudy.type === 'failure' ? (
              <AlertTriangle className="w-8 h-8 flex-shrink-0" style={{ color: '#dc2626' }} />
            ) : (
              <CheckCircle className="w-8 h-8 flex-shrink-0" style={{ color: '#16a34a' }} />
            )}
            <div className="flex-1">
              <h3 className="font-bold font-grotesk mb-2 text-lg" style={{ color: '#171717' }}>
                {question.caseStudy.title}
              </h3>
              <p className="text-sm font-grotesk mb-3 leading-relaxed" style={{ color: '#525252' }}>
                {question.caseStudy.summary}
              </p>
              <div
                className="flex items-start gap-2 p-3 rounded-lg"
                style={{
                  backgroundColor: question.caseStudy.type === 'failure' ? '#fee2e2' : '#dcfce7',
                }}
              >
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#525252' }} />
                <p className="text-sm font-grotesk font-semibold" style={{ color: '#171717' }}>
                  {question.caseStudy.outcome}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Scenario */}
      {question.scenario && (
        <motion.div
          className="w-full p-6 rounded-xl border-2"
          style={{
            backgroundColor: '#fffceb',
            borderColor: '#fbbf24',
          }}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex items-start gap-4">
            <TrendingUp className="w-8 h-8 flex-shrink-0" style={{ color: '#f59e0b' }} />
            <div className="flex-1">
              <h3 className="font-bold font-grotesk mb-2" style={{ color: '#171717' }}>
                Senaryo Analizi
              </h3>
              <p className="text-sm font-grotesk leading-relaxed" style={{ color: '#525252' }}>
                {question.scenario}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Continue Button */}
      <motion.button
        onClick={onNext}
        className="mt-6 w-full max-w-md text-white rounded-full px-10 py-5 font-grotesk font-semibold text-lg
                   shadow-lg hover:shadow-xl transition-all duration-300"
        style={{ backgroundColor: '#171717' }}
        whileHover={{
          scale: 1.02,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
        }}
        whileTap={{ scale: 0.98 }}
      >
        {question.action || "Devam Et"}
      </motion.button>
    </motion.div>
  );
};

export default EducationalQuestion;
