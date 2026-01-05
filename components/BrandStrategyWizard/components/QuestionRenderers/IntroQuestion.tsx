import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Question } from '../../types';

interface IntroQuestionProps {
  question: Question;
  onNext: () => void;
}

const IntroQuestion: React.FC<IntroQuestionProps> = ({ question, onNext }) => {
  // Split script into words for staggered animation
  const words = useMemo(() => question.script.split(' '), [question.script]);

  // Container animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.03,
        delayChildren: 0.3,
      },
    },
  };

  // Word animation variants
  const wordVariants = {
    hidden: {
      opacity: 0,
      y: 20,
      filter: 'blur(8px)',
    },
    visible: {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: {
        duration: 0.5,
        ease: [0.25, 0.46, 0.45, 0.94],
      },
    },
  };

  // Icon dots animation
  const dotVariants = {
    hidden: { scale: 0, opacity: 0 },
    visible: (i: number) => ({
      scale: 1,
      opacity: 1,
      transition: {
        delay: i * 0.1,
        duration: 0.4,
        ease: [0.25, 0.46, 0.45, 0.94],
      },
    }),
  };

  // Script (italic) animation
  const scriptVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        delay: 0.1,
        duration: 0.6,
        ease: [0.25, 0.46, 0.45, 0.94],
      },
    },
  };

  // Title (bold) animation
  const titleVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        delay: 0.4,
        duration: 0.6,
        ease: [0.25, 0.46, 0.45, 0.94],
      },
    },
  };

  // Button animation
  const buttonVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        delay: 0.7,
        duration: 0.6,
        ease: [0.25, 0.46, 0.45, 0.94],
      },
    },
  };

  // Stage label animation
  const stageLabelVariants = {
    hidden: { opacity: 0, y: -10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        delay: 0.1,
        duration: 0.5,
        ease: [0.25, 0.46, 0.45, 0.94],
      },
    },
  };

  // Stage title animation (large serif)
  const stageTitleVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        delay: 0.3,
        duration: 0.6,
        ease: [0.25, 0.46, 0.45, 0.94],
      },
    },
  };

  // Stage description animation
  const stageDescVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        delay: 0.5,
        duration: 0.6,
        ease: [0.25, 0.46, 0.45, 0.94],
      },
    },
  };

  // Stage intro layout (when question.stage exists)
  if (question.stage) {
    return (
      <div className="flex flex-col items-center text-center gap-6 max-w-2xl mx-auto px-6">
        {/* Stage label - small, uppercase */}
        <motion.span
          className="text-sm font-grotesk font-medium uppercase tracking-widest"
          style={{ color: '#737373' }}
          variants={stageLabelVariants}
          initial="hidden"
          animate="visible"
        >
          Aşama {question.stage.stage + 1}
        </motion.span>

        {/* Stage title - large serif */}
        <motion.h1
          className="text-3xl md:text-4xl lg:text-5xl font-ramillas font-bold leading-tight"
          style={{ color: '#171717' }}
          variants={stageTitleVariants}
          initial="hidden"
          animate="visible"
        >
          {question.stage.title}
        </motion.h1>

        {/* Stage description (if exists) */}
        {question.stageDescription && (
          <motion.p
            className="text-base md:text-lg font-grotesk leading-relaxed max-w-xl"
            style={{ color: '#525252' }}
            variants={stageDescVariants}
            initial="hidden"
            animate="visible"
          >
            {question.stageDescription}
          </motion.p>
        )}

        {/* CTA Button */}
        <motion.button
          onClick={onNext}
          className="mt-6 w-full max-w-md text-white rounded-full px-10 py-5 font-grotesk font-semibold text-lg
                     shadow-lg hover:shadow-xl transition-all duration-300"
          style={{
            backgroundColor: '#171717',
          }}
          variants={buttonVariants}
          initial="hidden"
          animate="visible"
          whileHover={{
            scale: 1.02,
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
          }}
          whileTap={{ scale: 0.98 }}
        >
          {question.action}
        </motion.button>
      </div>
    );
  }

  // Standard intro layout (when no question.stage)
  return (
    <div className="flex flex-col items-center text-center gap-8 max-w-2xl mx-auto px-6">
      {/* Two dots icon (vertical) */}
      <div className="flex flex-col gap-2 mb-4">
        <motion.div
          className="w-4 h-4 rounded-full"
          style={{ backgroundColor: '#171717' }}
          custom={0}
          variants={dotVariants}
          initial="hidden"
          animate="visible"
        />
        <motion.div
          className="w-4 h-4 rounded-full"
          style={{ backgroundColor: '#171717' }}
          custom={1}
          variants={dotVariants}
          initial="hidden"
          animate="visible"
        />
      </div>

      {/* Script (italic, sans-serif) */}
      <motion.p
        className="text-xl md:text-2xl font-grotesk italic leading-relaxed"
        style={{ color: '#171717' }}
        variants={scriptVariants}
        initial="hidden"
        animate="visible"
      >
        {question.script}
      </motion.p>

      {/* Main title (bold, serif) */}
      <motion.h1
        className="text-2xl md:text-3xl font-bold font-ramillas leading-tight"
        style={{ color: '#171717' }}
        variants={titleVariants}
        initial="hidden"
        animate="visible"
      >
        {question.text}
      </motion.h1>

      {/* CTA Button */}
      <motion.button
        onClick={onNext}
        className="mt-6 w-full max-w-md text-white rounded-full px-10 py-5 font-grotesk font-semibold text-lg
                   shadow-lg hover:shadow-xl transition-all duration-300"
        style={{
          backgroundColor: '#171717',
        }}
        variants={buttonVariants}
        initial="hidden"
        animate="visible"
        whileHover={{
          scale: 1.02,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
        }}
        whileTap={{ scale: 0.98 }}
      >
        {question.action}
      </motion.button>
    </div>
  );
};

export default IntroQuestion;
