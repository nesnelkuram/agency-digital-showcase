import React from 'react';
import { motion } from 'framer-motion';
import {
  Lightbulb,
  BarChart3,
  Rocket,
  Settings2,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';

interface WelcomeActionCardsProps {
  onSelect: (prompt: string) => void;
}

const ACTIONS = [
  {
    icon: Lightbulb,
    title: 'Pazarlama Stratejisi',
    description: 'Is hedeflerine uygun funnel bazli strateji gelistir',
    prompt: 'Yeni bir pazarlama stratejisi olusturmak istiyorum',
  },
  {
    icon: BarChart3,
    title: 'Hesap Raporlari',
    description: 'Bagli reklam hesaplarinin performansini analiz et',
    prompt: 'Reklam hesaplarimi goster ve performans raporu ver',
  },
  {
    icon: Rocket,
    title: 'Kampanya Kur',
    description: 'Step-by-step yeni kampanya olustur ve yayinla',
    prompt: 'Yeni bir reklam kampanyasi olusturmak istiyorum',
  },
  {
    icon: Settings2,
    title: 'Kampanya Yonetimi',
    description: 'Mevcut kampanyalari duzenle, duraklat, butce degistir',
    prompt: 'Mevcut kampanyalarimi goster',
  },
  {
    icon: TrendingUp,
    title: 'Performans Analizi',
    description: 'Detayli metrik analizi ve optimizasyon onerileri',
    prompt: 'Kampanya performans analizi yap',
  },
  {
    icon: RefreshCw,
    title: 'Platform Senkronizasyonu',
    description: 'Meta/Google/TikTok verilerini guncelle',
    prompt: 'Kampanyalari senkronize et',
  },
];

const WelcomeActionCards: React.FC<WelcomeActionCardsProps> = ({ onSelect }) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
      {ACTIONS.map((action, i) => {
        const Icon = action.icon;
        return (
          <motion.button
            key={action.title}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => onSelect(action.prompt)}
            className="p-4 rounded-xl border border-neutral-200 hover:border-indigo-300 hover:shadow-sm cursor-pointer transition-all group text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-50 to-purple-50 group-hover:from-indigo-100 group-hover:to-purple-100 flex items-center justify-center mb-2.5 transition-colors">
              <Icon className="w-5 h-5 text-indigo-500 group-hover:text-indigo-600 transition-colors" />
            </div>
            <p className="font-grotesk text-sm font-semibold text-[#171717]">
              {action.title}
            </p>
            <p className="font-commons text-xs text-neutral-500 mt-1">
              {action.description}
            </p>
          </motion.button>
        );
      })}
    </div>
  );
};

export default WelcomeActionCards;
