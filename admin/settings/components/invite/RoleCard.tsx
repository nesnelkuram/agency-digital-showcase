import React from 'react';
import { motion } from 'framer-motion';
import { LucideIcon, Check } from 'lucide-react';
import { UserRole } from '@/shared/types/user';

interface RoleCardProps {
  role: UserRole;
  label: string;
  description: string;
  icon: LucideIcon;
  chips: string[];
  accentColor: string; // tailwind gradient "from-...-to-..."
  selected: boolean;
  onClick: () => void;
}

const RoleCard: React.FC<RoleCardProps> = ({
  label,
  description,
  icon: Icon,
  chips,
  accentColor,
  selected,
  onClick,
}) => {
  return (
    <motion.button
      type="button"
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`relative text-left w-full rounded-2xl border transition-all p-4 overflow-hidden ${
        selected
          ? 'border-[#171717] bg-[#171717] text-white shadow-lg'
          : 'border-neutral-200 bg-white hover:border-neutral-400'
      }`}
    >
      <div className={`absolute inset-0 opacity-0 ${selected ? 'opacity-10' : ''} bg-gradient-to-br ${accentColor}`} />
      <div className="relative">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              selected ? 'bg-white/10' : `bg-gradient-to-br ${accentColor}`
            }`}
          >
            <Icon className={`w-5 h-5 ${selected ? 'text-white' : 'text-white'}`} />
          </div>
          {selected && (
            <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center">
              <Check className="w-3.5 h-3.5 text-[#171717]" />
            </div>
          )}
        </div>
        <h3 className={`font-grotesk text-base font-bold ${selected ? 'text-white' : 'text-[#171717]'}`}>
          {label}
        </h3>
        <p className={`font-grotesk text-xs mt-1 ${selected ? 'text-white/70' : 'text-neutral-500'}`}>
          {description}
        </p>
        <div className="flex flex-wrap gap-1 mt-3">
          {chips.map((chip) => (
            <span
              key={chip}
              className={`text-[10px] font-grotesk px-2 py-0.5 rounded-full ${
                selected
                  ? 'bg-white/10 text-white/80'
                  : 'bg-neutral-100 text-neutral-600'
              }`}
            >
              {chip}
            </span>
          ))}
        </div>
      </div>
    </motion.button>
  );
};

export default RoleCard;
