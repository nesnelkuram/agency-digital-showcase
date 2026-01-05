import React from 'react';
import { motion } from 'framer-motion';
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
        <p className="text-base md:text-lg leading-relaxed font-grotesk" style={{ color: '#525252' }}>
          {question.script}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {options.map((option: SelectionOption, index: number) => {
          const IconComponent = option.icon ? iconMap[option.icon] : null;
          const isSelected = selectedId === option.id;

          return (
            <motion.button
              key={option.id}
              onClick={() => onSelect(option.id)}
              className="relative flex flex-col items-center p-6 rounded-2xl text-center
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
                  className="w-8 h-8 mb-3"
                  style={{ color: isSelected ? '#ffffff' : '#525252' }}
                />
              )}
              <h3 className="font-grotesk font-medium text-lg mb-1" style={{ color: isSelected ? '#ffffff' : '#171717' }}>
                {option.title}
              </h3>
              {option.desc && (
                <p className="text-sm font-grotesk leading-relaxed" style={{ color: isSelected ? '#d4d4d4' : '#525252' }}>
                  {option.desc}
                </p>
              )}
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
};

export default SelectionCardQuestion;
