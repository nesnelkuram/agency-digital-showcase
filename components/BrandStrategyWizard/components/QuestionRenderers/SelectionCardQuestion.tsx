import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Leaf, Zap, Heart, Sparkles, Crown, Compass, Wine, PartyPopper,
  Users, Briefcase, ChefHat, MapPin,
  Minus, Home, Palette, Landmark,
  Lightbulb, Smile, Flame, Award, TrendingUp, ShoppingCart, GraduationCap
} from 'lucide-react';
import { Question, SelectionOption } from '../../types';

interface SelectionCardQuestionProps {
  question: Question;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const iconMap: Record<string, React.FC<{ className?: string }>> = {
  Leaf,
  Zap,
  Heart,
  Sparkles,
  Crown,
  Compass,
  Wine,
  PartyPopper,
  Users,
  Briefcase,
  ChefHat,
  MapPin,
  Minus,
  Home,
  Palette,
  Landmark,
  Lightbulb,
  Smile,
  Flame,
  Award,
  TrendingUp,
  ShoppingCart,
  GraduationCap,
};

const SelectionCardQuestion: React.FC<SelectionCardQuestionProps> = ({
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
    onSelect(`other:${text}`);
  };

  const isOtherSelected = selectedId?.startsWith('other');

  return (
    <motion.div
      className="flex flex-col gap-6 w-full"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="space-y-3 text-center">
        <h2 className="text-2xl md:text-3xl font-bold font-grotesk" style={{ color: '#171717' }}>
          {question.text}
        </h2>
        <p className="text-base md:text-lg leading-relaxed font-grotesk px-4" style={{ color: '#525252' }}>
          {question.script}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
        {options.map((option: SelectionOption, index: number) => {
          const IconComponent = option.icon ? iconMap[option.icon] : null;
          const isSelected = option.id === 'other' ? isOtherSelected : selectedId === option.id;

          return (
            <motion.button
              key={option.id}
              onClick={() => option.id === 'other' ? onSelect('other:') : onSelect(option.id)}
              className="relative flex flex-col items-center p-4 md:p-6 rounded-2xl text-center
                         border-2 transition-all duration-200 cursor-pointer
                         hover:shadow-md"
              style={{
                backgroundColor: isSelected ? '#171717' : '#fffceb',
                borderColor: isSelected ? '#171717' : '#e5e5e5',
              }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              whileTap={{ scale: 0.98 }}
            >
              {IconComponent && (
                <IconComponent
                  className="w-6 h-6 md:w-8 md:h-8 mb-2 md:mb-3"
                  style={{ color: isSelected ? '#ffffff' : '#525252' }}
                />
              )}
              <h3 className="font-grotesk font-medium text-base md:text-lg mb-1" style={{ color: isSelected ? '#ffffff' : '#171717' }}>
                {option.title}
              </h3>
              {option.desc && (
                <p className="text-xs md:text-sm font-grotesk leading-relaxed" style={{ color: isSelected ? '#d4d4d4' : '#525252' }}>
                  {option.desc}
                </p>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Other text input */}
      <AnimatePresence>
        {isOtherSelected && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-xl mx-auto"
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
    </motion.div>
  );
};

export default SelectionCardQuestion;
