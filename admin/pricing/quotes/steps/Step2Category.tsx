import React from 'react';
import { motion } from 'framer-motion';
import {
  Video,
  Camera,
  Share2,
  BarChart2,
  CalendarDays,
  Lightbulb,
  Palette,
} from 'lucide-react';
import { SERVICE_CATEGORY_LABELS, ServiceCategory } from '@/shared/types/pricing';

interface Step2CategoryProps {
  selected: string | null;
  onChange: (category: string) => void;
}

const CATEGORY_ICONS: Record<ServiceCategory, React.ReactNode> = {
  video_production: <Video className="w-8 h-8" />,
  photography: <Camera className="w-8 h-8" />,
  social_media: <Share2 className="w-8 h-8" />,
  digital_marketing: <BarChart2 className="w-8 h-8" />,
  event_coverage: <CalendarDays className="w-8 h-8" />,
  brand_strategy: <Lightbulb className="w-8 h-8" />,
  graphic_design: <Palette className="w-8 h-8" />,
};

const CATEGORY_COLORS: Record<ServiceCategory, { bg: string; text: string; border: string }> = {
  video_production: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200' },
  photography: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' },
  social_media: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200' },
  digital_marketing: { bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-200' },
  event_coverage: { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200' },
  brand_strategy: { bg: 'bg-yellow-50', text: 'text-yellow-600', border: 'border-yellow-200' },
  graphic_design: { bg: 'bg-pink-50', text: 'text-pink-600', border: 'border-pink-200' },
};

const CATEGORIES = Object.entries(SERVICE_CATEGORY_LABELS) as [ServiceCategory, string][];

const Step2Category: React.FC<Step2CategoryProps> = ({ selected, onChange }) => {
  return (
    <div>
      <div className="text-center mb-8">
        <h2 className="font-grotesk text-2xl font-bold text-[#171717] mb-2">
          Servis Kategorisi
        </h2>
        <p className="font-grotesk text-neutral-500">
          Hangi hizmeti sunacaksiniz?
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {CATEGORIES.map(([key, label]) => {
          const isSelected = selected === key;
          const colors = CATEGORY_COLORS[key];

          return (
            <motion.button
              key={key}
              onClick={() => onChange(key)}
              className={`
                relative p-6 rounded-2xl text-center transition-all
                ${
                  isSelected
                    ? `${colors.bg} ${colors.border} border-2 ring-2 ring-offset-2 ring-${key === 'video' ? 'red' : key === 'photography' ? 'blue' : 'purple'}-500/20`
                    : 'bg-white border border-neutral-200 hover:border-neutral-300 hover:shadow-sm'
                }
              `}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div
                className={`
                  mx-auto mb-3 w-16 h-16 rounded-xl flex items-center justify-center
                  ${isSelected ? colors.text : 'text-neutral-400'}
                  ${isSelected ? colors.bg : 'bg-neutral-100'}
                `}
              >
                {CATEGORY_ICONS[key]}
              </div>
              <span
                className={`
                  font-grotesk text-sm font-medium
                  ${isSelected ? 'text-[#171717]' : 'text-neutral-600'}
                `}
              >
                {label}
              </span>

              {isSelected && (
                <motion.div
                  className={`absolute top-2 right-2 w-3 h-3 rounded-full ${colors.text.replace('text-', 'bg-')}`}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

export default Step2Category;
