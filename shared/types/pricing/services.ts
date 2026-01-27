import { Timestamp } from 'firebase/firestore';

// ============================================
// SERVICE CATEGORIES
// ============================================

export type ServiceCategory =
  | 'video_production'
  | 'photography'
  | 'social_media'
  | 'digital_marketing'
  | 'event_coverage'
  | 'brand_strategy'
  | 'graphic_design';

export const SERVICE_CATEGORY_LABELS: Record<ServiceCategory, string> = {
  video_production: 'Video Produksiyon',
  photography: 'Fotograf Cekimi',
  social_media: 'Sosyal Medya Yonetimi',
  digital_marketing: 'Digital Marketing',
  event_coverage: 'Etkinlik Cekimi',
  brand_strategy: 'Marka Stratejisi',
  graphic_design: 'Grafik Tasarim',
};

export const SERVICE_CATEGORY_ICONS: Record<ServiceCategory, string> = {
  video_production: 'Video',
  photography: 'Camera',
  social_media: 'Share2',
  digital_marketing: 'TrendingUp',
  event_coverage: 'Calendar',
  brand_strategy: 'Target',
  graphic_design: 'Palette',
};

// ============================================
// SERVICE SUB-TYPES
// ============================================

export const VIDEO_SUBTYPES = {
  youtube_content: 'YouTube Icerik',
  interview: 'Roportaj',
  food_video: 'Yemek Videosu',
  ad_film: 'Reklam Filmi',
  product_video: 'Urun Tanitimi',
  training_video: 'Egitim Videosu',
  reels_tiktok: 'Reels / TikTok',
  documentary: 'Belgesel',
  corporate_film: 'Kurumsal Film',
  event_highlight: 'Etkinlik Ozeti',
} as const;

export const PHOTOGRAPHY_SUBTYPES = {
  product: 'Urun Fotografi',
  food: 'Yemek Fotografi',
  portrait: 'Portre',
  event: 'Etkinlik',
  architectural: 'Mimarlik',
  lifestyle: 'Lifestyle',
  fashion: 'Moda',
  corporate: 'Kurumsal',
} as const;

export const SOCIAL_MEDIA_SUBTYPES = {
  content_creation: 'Icerik Uretimi',
  community_management: 'Topluluk Yonetimi',
  strategy: 'Strateji',
  reporting: 'Raporlama',
  full_management: 'Tam Yonetim',
} as const;

export const GRAPHIC_DESIGN_SUBTYPES = {
  logo: 'Logo Tasarimi',
  brochure: 'Brosur',
  social_media_design: 'Sosyal Medya Gorseli',
  packaging: 'Ambalaj',
  brand_identity: 'Marka Kimligi',
  print: 'Baski Materyali',
  digital_ad: 'Dijital Reklam',
} as const;

// ============================================
// TIME UNITS
// ============================================

export type TimeUnit = 'hours' | 'days' | 'deliverable';

export const TIME_UNIT_LABELS: Record<TimeUnit, string> = {
  hours: 'Saat',
  days: 'Gun',
  deliverable: 'Adet',
};

// ============================================
// SERVICE VARIABLES (Fiyati Etkileyen Degiskenler)
// ============================================

export type VariableType = 'select' | 'number' | 'boolean' | 'multi_select';
export type VariableAffects = 'time' | 'equipment' | 'staff' | 'complexity';

export interface VariableOption {
  value: string;
  label: string;
  costModifier?: number;  // 1.0 = normal, 1.5 = %50 artis, etc.
  timeModifier?: number;  // Zaman carpani
}

export interface ServiceVariable {
  id: string;
  name: string;
  description?: string;
  type: VariableType;
  options?: VariableOption[];
  defaultValue: string | number | boolean | string[];
  affects: VariableAffects;
  isRequired: boolean;
  sortOrder: number;
}

// ============================================
// SERVICE COMPONENTS (Mikro Bilesenler)
// ============================================

export interface StaffRequirement {
  staffId?: string;       // Spesifik personel (opsiyonel)
  roleType: 'junior' | 'senior' | 'owner' | 'any';
  quantity: number;
  timeUnit: TimeUnit;
  timeAmount: number;     // Bu role icin gereken sure
}

export interface EquipmentRequirement {
  equipmentId?: string;   // Spesifik ekipman (opsiyonel)
  equipmentCategory?: string;  // Kategori bazli (opsiyonel)
  days: number;
  isRequired: boolean;
}

export interface ServiceComponent {
  id: string;
  name: string;
  description?: string;

  // Zaman tahmini
  baseTime: number;
  timeUnit: TimeUnit;

  // Gereksinimler
  staffRequirements: StaffRequirement[];
  equipmentRequirements: EquipmentRequirement[];

  // Ayarlar
  isOptional: boolean;        // Kullanici devre disi birakabilir mi?
  priceOverride?: number;     // Sabit fiyat (hesaplama yerine)

  sortOrder: number;
}

// ============================================
// SERVICE DEFINITION (Servis Tanimi)
// ============================================

export interface ServiceDefinition {
  id: string;
  name: string;
  category: ServiceCategory;
  subType?: string;           // VIDEO_SUBTYPES, PHOTOGRAPHY_SUBTYPES, etc.
  description: string;
  shortDescription?: string;

  // Yapilandirma
  variables: ServiceVariable[];
  components: ServiceComponent[];

  // Temel tahminler (degiskenler oncesi)
  baseTimeEstimate: number;
  baseTimeUnit: TimeUnit;

  // Fiyatlandirma kurallari
  minimumPrice?: number;      // Minimum fiyat
  complexityMultiplier: number;  // 1.0 = normal, 1.5 = karmasik

  // UI/UX
  icon?: string;              // Lucide icon adi
  color?: string;             // Kategori rengi

  // Meta
  isActive: boolean;
  isPopular?: boolean;        // One cikan servis
  sortOrder: number;

  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// ============================================
// DEFAULT SERVICE TEMPLATES
// ============================================

export const DEFAULT_VIDEO_VARIABLES: ServiceVariable[] = [
  {
    id: 'video_duration',
    name: 'Video Suresi',
    type: 'select',
    options: [
      { value: 'short', label: '1-3 dakika', costModifier: 1.0, timeModifier: 1.0 },
      { value: 'medium', label: '3-10 dakika', costModifier: 1.5, timeModifier: 1.5 },
      { value: 'long', label: '10-30 dakika', costModifier: 2.5, timeModifier: 2.5 },
      { value: 'extra_long', label: '30+ dakika', costModifier: 4.0, timeModifier: 4.0 },
    ],
    defaultValue: 'short',
    affects: 'time',
    isRequired: true,
    sortOrder: 1,
  },
  {
    id: 'location_count',
    name: 'Lokasyon Sayisi',
    type: 'number',
    defaultValue: 1,
    affects: 'time',
    isRequired: true,
    sortOrder: 2,
  },
  {
    id: 'color_grading',
    name: 'Profesyonel Renk Duzeltme',
    description: 'Sinematik color grading',
    type: 'boolean',
    defaultValue: false,
    affects: 'time',
    isRequired: false,
    sortOrder: 3,
  },
  {
    id: 'sound_design',
    name: 'Ses Tasarimi',
    description: 'Profesyonel ses efektleri ve muzik',
    type: 'boolean',
    defaultValue: false,
    affects: 'time',
    isRequired: false,
    sortOrder: 4,
  },
  {
    id: 'motion_graphics',
    name: 'Motion Graphics',
    description: 'Animasyon ve hareketli grafikler',
    type: 'boolean',
    defaultValue: false,
    affects: 'time',
    isRequired: false,
    sortOrder: 5,
  },
];

export const DEFAULT_VIDEO_COMPONENTS: ServiceComponent[] = [
  {
    id: 'pre_production',
    name: 'On Yapim',
    description: 'Konsept, senaryo, planlama',
    baseTime: 4,
    timeUnit: 'hours',
    staffRequirements: [
      { roleType: 'senior', quantity: 1, timeUnit: 'hours', timeAmount: 4 },
    ],
    equipmentRequirements: [],
    isOptional: false,
    sortOrder: 1,
  },
  {
    id: 'shooting',
    name: 'Cekim',
    description: 'Video cekim gunleri',
    baseTime: 1,
    timeUnit: 'days',
    staffRequirements: [
      { roleType: 'senior', quantity: 1, timeUnit: 'days', timeAmount: 1 },
      { roleType: 'junior', quantity: 1, timeUnit: 'days', timeAmount: 1 },
    ],
    equipmentRequirements: [
      { equipmentCategory: 'camera', days: 1, isRequired: true },
      { equipmentCategory: 'lighting', days: 1, isRequired: true },
      { equipmentCategory: 'audio', days: 1, isRequired: true },
    ],
    isOptional: false,
    sortOrder: 2,
  },
  {
    id: 'editing',
    name: 'Kurgu',
    description: 'Video duzenleme ve montaj',
    baseTime: 8,
    timeUnit: 'hours',
    staffRequirements: [
      { roleType: 'junior', quantity: 1, timeUnit: 'hours', timeAmount: 8 },
    ],
    equipmentRequirements: [
      { equipmentCategory: 'computer', days: 1, isRequired: true },
    ],
    isOptional: false,
    sortOrder: 3,
  },
  {
    id: 'revisions',
    name: 'Revizyonlar',
    description: '2 tur revizyon dahil',
    baseTime: 2,
    timeUnit: 'hours',
    staffRequirements: [
      { roleType: 'junior', quantity: 1, timeUnit: 'hours', timeAmount: 2 },
    ],
    equipmentRequirements: [],
    isOptional: false,
    sortOrder: 4,
  },
];

// ============================================
// SERVICE CALCULATION HELPERS
// ============================================

export function applyVariableModifiers(
  baseTime: number,
  variables: ServiceVariable[],
  selectedValues: Record<string, any>
): number {
  let modifiedTime = baseTime;

  for (const variable of variables) {
    const selectedValue = selectedValues[variable.id];

    if (variable.type === 'select' && variable.options) {
      const option = variable.options.find(o => o.value === selectedValue);
      if (option?.timeModifier) {
        modifiedTime *= option.timeModifier;
      }
    }

    if (variable.type === 'number' && typeof selectedValue === 'number') {
      // Sayisal degerler icin (lokasyon sayisi gibi)
      if (variable.affects === 'time' && selectedValue > 1) {
        modifiedTime *= (1 + (selectedValue - 1) * 0.5); // Her ek birim %50 artis
      }
    }

    if (variable.type === 'boolean' && selectedValue === true) {
      // Boolean opsiyonlar icin (color grading gibi)
      modifiedTime *= 1.3; // %30 artis
    }
  }

  return modifiedTime;
}
