import React from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import {
  VIDEO_SUBTYPES,
  PHOTOGRAPHY_SUBTYPES,
  SOCIAL_MEDIA_SUBTYPES,
  GRAPHIC_DESIGN_SUBTYPES,
  ServiceCategory,
} from '@/shared/types/pricing';

interface Step3ServiceTypeProps {
  category: string | null;
  selected: string | null;
  onChange: (serviceType: string) => void;
}

// Service subtypes by category
const SERVICE_SUBTYPES: Record<ServiceCategory, Record<string, string>> = {
  video_production: VIDEO_SUBTYPES,
  photography: PHOTOGRAPHY_SUBTYPES,
  social_media: SOCIAL_MEDIA_SUBTYPES,
  digital_marketing: {
    seo: 'SEO Optimizasyonu',
    sem: 'Google Ads Yonetimi',
    content: 'Icerik Pazarlama',
    email: 'E-posta Pazarlama',
    analytics: 'Analitik Raporlama',
  },
  event_coverage: {
    corporate: 'Kurumsal Etkinlik',
    launch: 'Urun Lansmani',
    conference: 'Konferans',
    fair: 'Fuar Organizasyonu',
    opening: 'Acilis Etkinligi',
  },
  brand_strategy: {
    identity: 'Marka Kimligi',
    positioning: 'Marka Konumlandirma',
    naming: 'Marka Isimlendirme',
    rebranding: 'Yeniden Markalama',
    guidelines: 'Marka Kilavuzu',
  },
  graphic_design: GRAPHIC_DESIGN_SUBTYPES,
};

const Step3ServiceType: React.FC<Step3ServiceTypeProps> = ({
  category,
  selected,
  onChange,
}) => {
  if (!category) {
    return (
      <div className="text-center py-12">
        <p className="font-grotesk text-neutral-500">
          Lutfen once bir kategori secin.
        </p>
      </div>
    );
  }

  const subtypes = SERVICE_SUBTYPES[category as ServiceCategory] || {};
  const subtypeEntries = Object.entries(subtypes);

  return (
    <div>
      <div className="text-center mb-8">
        <h2 className="font-grotesk text-2xl font-bold text-[#171717] mb-2">
          Servis Tipi
        </h2>
        <p className="font-grotesk text-neutral-500">
          Hangi tur hizmet verilecek?
        </p>
      </div>

      {subtypeEntries.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {subtypeEntries.map(([key, label]) => {
            const isSelected = selected === key;

            return (
              <motion.button
                key={key}
                onClick={() => onChange(key)}
                className={`
                  relative px-5 py-4 rounded-xl text-left transition-all
                  ${
                    isSelected
                      ? 'bg-[#171717] text-white'
                      : 'bg-white border border-neutral-200 text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50'
                  }
                `}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                <span className="font-grotesk text-sm font-medium">
                  {label}
                </span>

                {isSelected && (
                  <motion.div
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  >
                    <Check className="w-5 h-5" />
                  </motion.div>
                )}
              </motion.button>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 bg-neutral-50 rounded-xl">
          <p className="font-grotesk text-neutral-500">
            Bu kategori icin servis tipi tanimlanmamis.
          </p>
        </div>
      )}
    </div>
  );
};

export default Step3ServiceType;
