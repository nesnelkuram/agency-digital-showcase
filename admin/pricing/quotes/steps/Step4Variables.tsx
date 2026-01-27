import React from 'react';
import { motion } from 'framer-motion';
import { Clock, MapPin, Layers, Sparkles, Film, Users } from 'lucide-react';

interface Step4VariablesProps {
  category: string | null;
  serviceType: string | null;
  variables: Record<string, any>;
  onChange: (variables: Record<string, any>) => void;
}

// Variable definitions by category
interface VariableOption {
  value: string;
  label: string;
}

interface VariableDefinition {
  id: string;
  label: string;
  icon: React.ReactNode;
  options: VariableOption[];
  defaultValue: string;
}

const VIDEO_VARIABLES: VariableDefinition[] = [
  {
    id: 'duration',
    label: 'Video Suresi',
    icon: <Clock className="w-5 h-5" />,
    options: [
      { value: 'short', label: '1-3 dakika' },
      { value: 'medium', label: '3-5 dakika' },
      { value: 'long', label: '5-10 dakika' },
      { value: 'extended', label: '10+ dakika' },
    ],
    defaultValue: 'short',
  },
  {
    id: 'location',
    label: 'Cekim Lokasyonu',
    icon: <MapPin className="w-5 h-5" />,
    options: [
      { value: 'studio', label: 'Studyo' },
      { value: 'outdoor', label: 'Dis Mekan' },
      { value: 'client_office', label: 'Musteri Ofisi' },
      { value: 'multiple', label: 'Birden Fazla Mekan' },
    ],
    defaultValue: 'studio',
  },
  {
    id: 'complexity',
    label: 'Kurgu Karmasikligi',
    icon: <Layers className="w-5 h-5" />,
    options: [
      { value: 'basic', label: 'Basit (Kesim)' },
      { value: 'standard', label: 'Standart' },
      { value: 'advanced', label: 'Ileri (Efektli)' },
    ],
    defaultValue: 'standard',
  },
  {
    id: 'graphics',
    label: 'Grafik / Animasyon',
    icon: <Sparkles className="w-5 h-5" />,
    options: [
      { value: 'none', label: 'Yok' },
      { value: 'basic', label: 'Temel (Lower thirds)' },
      { value: 'advanced', label: 'Ileri (Motion)' },
    ],
    defaultValue: 'basic',
  },
];

const PHOTOGRAPHY_VARIABLES: VariableDefinition[] = [
  {
    id: 'product_count',
    label: 'Urun Sayisi',
    icon: <Film className="w-5 h-5" />,
    options: [
      { value: '1-5', label: '1-5 urun' },
      { value: '6-15', label: '6-15 urun' },
      { value: '16-30', label: '16-30 urun' },
      { value: '30+', label: '30+ urun' },
    ],
    defaultValue: '1-5',
  },
  {
    id: 'location',
    label: 'Cekim Lokasyonu',
    icon: <MapPin className="w-5 h-5" />,
    options: [
      { value: 'studio', label: 'Studyo' },
      { value: 'outdoor', label: 'Dis Mekan' },
      { value: 'client_location', label: 'Musteri Lokasyonu' },
    ],
    defaultValue: 'studio',
  },
  {
    id: 'retouching',
    label: 'Rötus Seviyesi',
    icon: <Sparkles className="w-5 h-5" />,
    options: [
      { value: 'basic', label: 'Temel' },
      { value: 'standard', label: 'Standart' },
      { value: 'premium', label: 'Premium' },
    ],
    defaultValue: 'standard',
  },
];

const SOCIAL_MEDIA_VARIABLES: VariableDefinition[] = [
  {
    id: 'platforms',
    label: 'Platform Sayisi',
    icon: <Layers className="w-5 h-5" />,
    options: [
      { value: '1', label: '1 Platform' },
      { value: '2-3', label: '2-3 Platform' },
      { value: '4+', label: '4+ Platform' },
    ],
    defaultValue: '2-3',
  },
  {
    id: 'posts_per_week',
    label: 'Haftalik Paylasim',
    icon: <Film className="w-5 h-5" />,
    options: [
      { value: '3-5', label: '3-5 post' },
      { value: '6-10', label: '6-10 post' },
      { value: '10+', label: '10+ post' },
    ],
    defaultValue: '3-5',
  },
  {
    id: 'community_management',
    label: 'Topluluk Yonetimi',
    icon: <Users className="w-5 h-5" />,
    options: [
      { value: 'none', label: 'Yok' },
      { value: 'basic', label: 'Temel (Yanit)' },
      { value: 'full', label: 'Tam (Proaktif)' },
    ],
    defaultValue: 'basic',
  },
];

const VARIABLES_BY_CATEGORY: Record<string, VariableDefinition[]> = {
  video_production: VIDEO_VARIABLES,
  photography: PHOTOGRAPHY_VARIABLES,
  social_media: SOCIAL_MEDIA_VARIABLES,
  digital_marketing: [
    {
      id: 'scope',
      label: 'Kapsam',
      icon: <Layers className="w-5 h-5" />,
      options: [
        { value: 'basic', label: 'Baslangic' },
        { value: 'standard', label: 'Standart' },
        { value: 'premium', label: 'Premium' },
      ],
      defaultValue: 'standard',
    },
  ],
  event_coverage: [
    {
      id: 'duration',
      label: 'Etkinlik Suresi',
      icon: <Clock className="w-5 h-5" />,
      options: [
        { value: 'half_day', label: 'Yarim Gun' },
        { value: 'full_day', label: 'Tam Gun' },
        { value: 'multi_day', label: 'Cok Gunlu' },
      ],
      defaultValue: 'full_day',
    },
    {
      id: 'attendees',
      label: 'Katilimci Sayisi',
      icon: <Users className="w-5 h-5" />,
      options: [
        { value: 'small', label: '50 kisiye kadar' },
        { value: 'medium', label: '50-200 kisi' },
        { value: 'large', label: '200+ kisi' },
      ],
      defaultValue: 'medium',
    },
  ],
  brand_strategy: [
    {
      id: 'scope',
      label: 'Proje Kapsamı',
      icon: <Layers className="w-5 h-5" />,
      options: [
        { value: 'refresh', label: 'Yenileme' },
        { value: 'full', label: 'Tam Tasarim' },
        { value: 'comprehensive', label: 'Kapsamli (360)' },
      ],
      defaultValue: 'full',
    },
  ],
  graphic_design: [
    {
      id: 'revisions',
      label: 'Revizyon Hakki',
      icon: <Layers className="w-5 h-5" />,
      options: [
        { value: '2', label: '2 Revizyon' },
        { value: '3', label: '3 Revizyon' },
        { value: 'unlimited', label: 'Sinirsiz' },
      ],
      defaultValue: '3',
    },
  ],
};

const Step4Variables: React.FC<Step4VariablesProps> = ({
  category,
  serviceType,
  variables,
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

  const variableDefinitions = VARIABLES_BY_CATEGORY[category] || [];

  // Initialize defaults if needed
  React.useEffect(() => {
    const defaults: Record<string, string> = {};
    let needsUpdate = false;

    variableDefinitions.forEach((varDef) => {
      if (variables[varDef.id] === undefined) {
        defaults[varDef.id] = varDef.defaultValue;
        needsUpdate = true;
      }
    });

    if (needsUpdate) {
      onChange({ ...variables, ...defaults });
    }
  }, [category, variableDefinitions]);

  const handleVariableChange = (variableId: string, value: string) => {
    onChange({ ...variables, [variableId]: value });
  };

  if (variableDefinitions.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="max-w-md mx-auto">
          <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Layers className="w-8 h-8 text-neutral-400" />
          </div>
          <h3 className="font-ramillas text-xl font-bold text-[#171717] mb-2">
            Degisken Yok
          </h3>
          <p className="font-grotesk text-neutral-500">
            Bu kategori icin ek degisken tanimlanmamis. Devam edebilirsiniz.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="text-center mb-8">
        <h2 className="font-ramillas text-2xl font-bold text-[#171717] mb-2">
          Proje Degiskenleri
        </h2>
        <p className="font-grotesk text-neutral-500">
          Proje detaylarini belirleyin
        </p>
      </div>

      <div className="space-y-8">
        {variableDefinitions.map((varDef) => (
          <div key={varDef.id} className="space-y-3">
            <label className="flex items-center gap-2 font-grotesk text-sm font-medium text-neutral-700">
              {varDef.icon}
              {varDef.label}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {varDef.options.map((option) => {
                const isSelected = (variables[varDef.id] || varDef.defaultValue) === option.value;

                return (
                  <motion.button
                    key={option.value}
                    onClick={() => handleVariableChange(varDef.id, option.value)}
                    className={`
                      px-4 py-3 rounded-xl font-grotesk text-sm transition-all
                      ${
                        isSelected
                          ? 'bg-[#171717] text-white'
                          : 'bg-white border border-neutral-200 text-neutral-700 hover:border-neutral-300'
                      }
                    `}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {option.label}
                  </motion.button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Info box */}
      <div className="mt-8 p-4 bg-amber-50 rounded-xl">
        <p className="font-grotesk text-sm text-amber-700">
          <strong>Ipucu:</strong> Bu degiskenler projenin genel karmasikligini belirler.
          Ekip ve ekipman secimi bir sonraki adimda yapilacaktir.
        </p>
      </div>
    </div>
  );
};

export default Step4Variables;
