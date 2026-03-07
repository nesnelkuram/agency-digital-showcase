import {
  Video,
  Camera,
  Share2,
  TrendingUp,
  Calendar,
  Target,
  Palette,
  Plane,
  FileEdit,
  ShoppingBag,
} from 'lucide-react';
import type { ServiceCategory } from '@/shared/types/pricing/services';

export interface ServiceModuleConfig {
  icon: React.ElementType;
  label: string;
  description: string;
  color: string;
  bgColor: string;
  isActive: boolean;
  supportsWorkflow: boolean;
  route?: string;
}

export const SERVICE_MODULE_CONFIG: Record<ServiceCategory, ServiceModuleConfig> = {
  digital_marketing: {
    icon: TrendingUp,
    label: 'Digital Marketing',
    description: 'Meta, Google, TikTok ve LinkedIn reklam kampanyalari',
    color: '#8B5CF6',
    bgColor: 'bg-violet-50',
    isActive: true,
    supportsWorkflow: true,
    route: 'marketing',
  },
  social_media: {
    icon: Share2,
    label: 'Sosyal Medya Yonetimi',
    description: 'Icerik planlama, takvim ve post yonetimi',
    color: '#EC4899',
    bgColor: 'bg-pink-50',
    isActive: true,
    supportsWorkflow: true,
    route: 'social-media',
  },
  video_production: {
    icon: Video,
    label: 'Video Produksiyon',
    description: 'Video cekim, kurgu ve post-produksiyon',
    color: '#3B82F6',
    bgColor: 'bg-blue-50',
    isActive: true,
    supportsWorkflow: true,
  },
  photography: {
    icon: Camera,
    label: 'Fotograf Cekimi',
    description: 'Urun, mekan ve portre fotograf hizmetleri',
    color: '#F59E0B',
    bgColor: 'bg-amber-50',
    isActive: true,
    supportsWorkflow: true,
  },
  event_coverage: {
    icon: Calendar,
    label: 'Etkinlik Cekimi',
    description: 'Etkinlik dokumantasyonu ve canli yayinlar',
    color: '#10B981',
    bgColor: 'bg-emerald-50',
    isActive: true,
    supportsWorkflow: true,
  },
  brand_strategy: {
    icon: Target,
    label: 'Marka Stratejisi',
    description: 'Marka konumlandirma ve strateji danismanligi',
    color: '#6366F1',
    bgColor: 'bg-indigo-50',
    isActive: false,
    supportsWorkflow: false,
  },
  graphic_design: {
    icon: Palette,
    label: 'Grafik Tasarim',
    description: 'Gorsel tasarim ve marka kimligi',
    color: '#F43F5E',
    bgColor: 'bg-rose-50',
    isActive: false,
    supportsWorkflow: false,
  },
  drone_shooting: {
    icon: Plane,
    label: 'Drone Cekimi',
    description: 'Profesyonel hava cekimi hizmetleri',
    color: '#0EA5E9',
    bgColor: 'bg-sky-50',
    isActive: true,
    supportsWorkflow: true,
  },
  scriptwriting: {
    icon: FileEdit,
    label: 'Senaryo & Brief Yazimi',
    description: 'Video senaryo, brief ve metin yazarligi',
    color: '#78716C',
    bgColor: 'bg-stone-50',
    isActive: true,
    supportsWorkflow: true,
  },
  ecommerce_content: {
    icon: ShoppingBag,
    label: 'E-Ticaret Urun Cekimi',
    description: 'Urun fotograf, video ve marketplace icerik uretimi',
    color: '#F97316',
    bgColor: 'bg-orange-50',
    isActive: true,
    supportsWorkflow: true,
  },
};
