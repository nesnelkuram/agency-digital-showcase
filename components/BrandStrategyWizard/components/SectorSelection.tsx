import React from 'react';
import { motion } from 'framer-motion';
import {
  ChefHat,
  ShoppingBag,
  Building2,
  Cpu,
  HeartPulse,
  GraduationCap,
  Package,
  Lamp,
} from 'lucide-react';
import { Sector } from '@/shared/types/brandLead';
import { SECTOR_CARDS, SectorCard } from '../questions/sectorCards';

const iconMap: Record<string, React.FC<{ className?: string }>> = {
  ChefHat,
  ShoppingBag,
  Building2,
  Cpu,
  HeartPulse,
  GraduationCap,
  Package,
  Lamp,
};

interface SectorSelectionProps {
  onSelect: (sector: Sector) => void;
}

const SectorSelection: React.FC<SectorSelectionProps> = ({ onSelect }) => {
  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center font-grotesk px-4 py-12"
      style={{ backgroundColor: '#ebeef8', color: '#171717' }}
    >
      {/* Header */}
      <motion.div
        className="text-center mb-12 max-w-2xl"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <motion.div
          className="flex justify-center gap-2 mb-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#171717' }} />
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#171717', opacity: 0.4 }} />
        </motion.div>

        <motion.p
          className="text-lg md:text-xl italic mb-4 opacity-70"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.7 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          "Strateji, sektörünüzün gerçeklerinden başlar."
        </motion.p>

        <motion.h1
          className="text-3xl md:text-4xl font-bold mb-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          Sektörünüzü Seçin
        </motion.h1>

        <motion.p
          className="text-base md:text-lg opacity-60"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          Markanızın stratejik analizini sektörünüze özel sorularla gerçekleştireceğiz.
        </motion.p>
      </motion.div>

      {/* Sector Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 w-full max-w-4xl">
        {SECTOR_CARDS.map((card: SectorCard, index: number) => {
          const IconComponent = iconMap[card.icon];

          return (
            <motion.button
              key={card.id}
              onClick={() => onSelect(card.id)}
              className="group relative flex flex-col items-center text-center p-6 md:p-8 rounded-2xl transition-all duration-300 cursor-pointer"
              style={{ backgroundColor: '#fffceb' }}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + index * 0.1, duration: 0.4 }}
              whileHover={{
                scale: 1.03,
                boxShadow: '0 20px 40px -12px rgba(0, 0, 0, 0.15)',
              }}
              whileTap={{ scale: 0.98 }}
            >
              {/* Icon */}
              <div
                className="w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110"
                style={{ backgroundColor: `${card.color}15` }}
              >
                {IconComponent && (
                  <IconComponent
                    className="w-7 h-7 md:w-8 md:h-8"
                    // @ts-ignore
                    style={{ color: card.color }}
                  />
                )}
              </div>

              {/* Title */}
              <h3 className="text-lg md:text-xl font-bold mb-2" style={{ color: '#171717' }}>
                {card.title}
              </h3>

              {/* Description */}
              <p className="text-sm opacity-60" style={{ color: '#171717' }}>
                {card.description}
              </p>

              {/* Hover accent line */}
              <div
                className="absolute bottom-0 left-1/2 -translate-x-1/2 h-1 rounded-full transition-all duration-300 opacity-0 group-hover:opacity-100"
                style={{
                  backgroundColor: card.color,
                  width: '40%',
                }}
              />
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

export default SectorSelection;
