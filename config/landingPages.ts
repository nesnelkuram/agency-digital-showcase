// Landing Page Configurations for SEO-optimized service pages
// Each page targets specific keywords for Google Ads campaigns

export interface LandingPageConfig {
  slug: string;
  lang: 'en' | 'tr';

  // SEO Meta Tags
  meta: {
    title: string;
    description: string;
    keywords: string[];
    ogImage?: string;
  };

  // Hero Section Content
  hero: {
    headline: string;
    highlightedText: string;
    subheadline: string;
    subtext: string;
    ctaText: string;
  };

  // Which category to highlight in the phone grid
  defaultCategory: 'all' | 'fashion' | 'commercial' | 'gastronomy' | 'interview';

  // Service focus for this landing page
  serviceFocus: 'video' | 'social' | 'photo' | 'creative';
}

export const landingPages: LandingPageConfig[] = [
  // ============ ENGLISH PAGES ============

  // Video Production - EN
  {
    slug: 'bodrum-video-production',
    lang: 'en',
    meta: {
      title: 'Bodrum Video Production Agency | Professional Video Services',
      description: 'Award-winning video production agency in Bodrum. We create stunning brand videos, commercials, and social media content that increases brand awareness by 300%+.',
      keywords: ['bodrum video production', 'video agency bodrum', 'commercial video turkey', 'brand video production', 'corporate video bodrum'],
    },
    hero: {
      headline: 'Bodrum\'s Premier',
      highlightedText: 'Video Production Agency',
      subheadline: 'That Delivers Results',
      subtext: 'Award-winning video production that increases brand awareness by 300%+',
      ctaText: 'Get Free Strategy Session',
    },
    defaultCategory: 'commercial',
    serviceFocus: 'video',
  },

  // Social Media Agency - EN
  {
    slug: 'bodrum-social-media-agency',
    lang: 'en',
    meta: {
      title: 'Bodrum Social Media Agency | Content & Management Services',
      description: 'Full-service social media agency in Bodrum. We create viral content, manage your accounts, and grow your brand presence across all platforms.',
      keywords: ['bodrum social media agency', 'social media management bodrum', 'instagram marketing turkey', 'social media content creation', 'influencer marketing bodrum'],
    },
    hero: {
      headline: 'Bodrum\'s Leading',
      highlightedText: 'Social Media Agency',
      subheadline: 'That Grows Brands',
      subtext: 'Strategic social media management that turns followers into customers',
      ctaText: 'Start Growing Today',
    },
    defaultCategory: 'fashion',
    serviceFocus: 'social',
  },

  // Creative Agency - EN
  {
    slug: 'bodrum-creative-agency',
    lang: 'en',
    meta: {
      title: 'Bodrum Creative Agency | Branding & Marketing Services',
      description: 'Full-service creative agency in Bodrum. From brand strategy to content creation, we help businesses stand out in competitive markets.',
      keywords: ['bodrum creative agency', 'branding agency bodrum', 'marketing agency turkey', 'creative services bodrum', 'brand strategy bodrum'],
    },
    hero: {
      headline: 'Bodrum\'s Trusted',
      highlightedText: 'Creative Agency',
      subheadline: 'That Builds Brands',
      subtext: 'Full-service creative solutions that transform your brand identity',
      ctaText: 'Let\'s Create Together',
    },
    defaultCategory: 'all',
    serviceFocus: 'creative',
  },

  // Photography - EN
  {
    slug: 'bodrum-photography-agency',
    lang: 'en',
    meta: {
      title: 'Bodrum Photography Agency | Professional Photo Services',
      description: 'Professional photography agency in Bodrum. We capture stunning brand imagery, product photos, and lifestyle content for leading brands.',
      keywords: ['bodrum photography agency', 'commercial photography bodrum', 'product photography turkey', 'brand photography bodrum', 'lifestyle photography'],
    },
    hero: {
      headline: 'Bodrum\'s Expert',
      highlightedText: 'Photography Agency',
      subheadline: 'That Captures Moments',
      subtext: 'Professional photography that tells your brand story beautifully',
      ctaText: 'Book Your Shoot',
    },
    defaultCategory: 'fashion',
    serviceFocus: 'photo',
  },

  // Marketing Agency - EN
  {
    slug: 'bodrum-marketing-agency',
    lang: 'en',
    meta: {
      title: 'Bodrum Marketing Agency | Digital Marketing Services',
      description: 'Results-driven marketing agency in Bodrum. We create data-driven campaigns that increase visibility, engagement, and conversions.',
      keywords: ['bodrum marketing agency', 'digital marketing bodrum', 'marketing services turkey', 'brand marketing bodrum', 'performance marketing'],
    },
    hero: {
      headline: 'Bodrum\'s Results-Driven',
      highlightedText: 'Marketing Agency',
      subheadline: 'That Drives Growth',
      subtext: 'Data-driven marketing strategies that deliver measurable ROI',
      ctaText: 'Get Your Free Audit',
    },
    defaultCategory: 'commercial',
    serviceFocus: 'creative',
  },

  // ============ TURKISH PAGES ============

  // Video Production - TR
  {
    slug: 'bodrum-video-produksiyon',
    lang: 'tr',
    meta: {
      title: 'Bodrum Video Prodüksiyon Ajansı | Profesyonel Video Hizmetleri',
      description: 'Bodrum\'un ödüllü video prodüksiyon ajansı. Marka bilinirliğinizi %300+ artıran etkileyici marka videoları, reklamlar ve sosyal medya içerikleri üretiyoruz.',
      keywords: ['bodrum video prodüksiyon', 'video ajansı bodrum', 'reklam filmi çekimi', 'kurumsal video bodrum', 'tanıtım filmi'],
    },
    hero: {
      headline: 'Bodrum\'un Lider',
      highlightedText: 'Video Prodüksiyon Ajansı',
      subheadline: 'Sonuç Odaklı Çalışmalar',
      subtext: 'Marka bilinirliğinizi %300+ artıran ödüllü video prodüksiyon',
      ctaText: 'Ücretsiz Strateji Görüşmesi',
    },
    defaultCategory: 'commercial',
    serviceFocus: 'video',
  },

  // Social Media Agency - TR
  {
    slug: 'bodrum-sosyal-medya-ajansi',
    lang: 'tr',
    meta: {
      title: 'Bodrum Sosyal Medya Ajansı | İçerik & Yönetim Hizmetleri',
      description: 'Bodrum\'da tam hizmet sosyal medya ajansı. Viral içerikler üretiyor, hesaplarınızı yönetiyor ve marka varlığınızı tüm platformlarda büyütüyoruz.',
      keywords: ['bodrum sosyal medya ajansı', 'sosyal medya yönetimi bodrum', 'instagram pazarlama', 'sosyal medya içerik üretimi', 'influencer pazarlama'],
    },
    hero: {
      headline: 'Bodrum\'un Öncü',
      highlightedText: 'Sosyal Medya Ajansı',
      subheadline: 'Markaları Büyüten',
      subtext: 'Takipçilerinizi müşteriye dönüştüren stratejik sosyal medya yönetimi',
      ctaText: 'Hemen Büyümeye Başlayın',
    },
    defaultCategory: 'fashion',
    serviceFocus: 'social',
  },

  // Creative Agency - TR
  {
    slug: 'bodrum-kreatif-ajans',
    lang: 'tr',
    meta: {
      title: 'Bodrum Kreatif Ajans | Marka & Pazarlama Hizmetleri',
      description: 'Bodrum\'da tam hizmet kreatif ajans. Marka stratejisinden içerik üretimine, rekabetçi pazarlarda öne çıkmanıza yardımcı oluyoruz.',
      keywords: ['bodrum kreatif ajans', 'marka ajansı bodrum', 'pazarlama ajansı', 'kreatif hizmetler bodrum', 'marka stratejisi'],
    },
    hero: {
      headline: 'Bodrum\'un Güvenilir',
      highlightedText: 'Kreatif Ajansı',
      subheadline: 'Markalar İnşa Eden',
      subtext: 'Marka kimliğinizi dönüştüren tam kapsamlı kreatif çözümler',
      ctaText: 'Birlikte Yaratalım',
    },
    defaultCategory: 'all',
    serviceFocus: 'creative',
  },

  // Photography - TR
  {
    slug: 'bodrum-fotograf-ajansi',
    lang: 'tr',
    meta: {
      title: 'Bodrum Fotoğraf Ajansı | Profesyonel Fotoğraf Hizmetleri',
      description: 'Bodrum\'da profesyonel fotoğraf ajansı. Lider markalar için etkileyici marka görselleri, ürün fotoğrafları ve yaşam tarzı içerikleri çekiyoruz.',
      keywords: ['bodrum fotoğraf ajansı', 'ticari fotoğrafçılık bodrum', 'ürün fotoğrafı', 'marka fotoğrafçılığı', 'yaşam tarzı fotoğrafçılık'],
    },
    hero: {
      headline: 'Bodrum\'un Uzman',
      highlightedText: 'Fotoğraf Ajansı',
      subheadline: 'Anları Yakalayan',
      subtext: 'Marka hikayenizi güzelce anlatan profesyonel fotoğrafçılık',
      ctaText: 'Çekiminizi Planlayın',
    },
    defaultCategory: 'fashion',
    serviceFocus: 'photo',
  },

  // Marketing Agency - TR
  {
    slug: 'bodrum-pazarlama-ajansi',
    lang: 'tr',
    meta: {
      title: 'Bodrum Pazarlama Ajansı | Dijital Pazarlama Hizmetleri',
      description: 'Bodrum\'da sonuç odaklı pazarlama ajansı. Görünürlük, etkileşim ve dönüşümlerinizi artıran veri odaklı kampanyalar oluşturuyoruz.',
      keywords: ['bodrum pazarlama ajansı', 'dijital pazarlama bodrum', 'pazarlama hizmetleri', 'marka pazarlama', 'performans pazarlama'],
    },
    hero: {
      headline: 'Bodrum\'un Sonuç Odaklı',
      highlightedText: 'Pazarlama Ajansı',
      subheadline: 'Büyümeyi Tetikleyen',
      subtext: 'Ölçülebilir ROI sağlayan veri odaklı pazarlama stratejileri',
      ctaText: 'Ücretsiz Analiz Alın',
    },
    defaultCategory: 'commercial',
    serviceFocus: 'creative',
  },
];

// Helper function to get landing page by slug
export const getLandingPageBySlug = (slug: string): LandingPageConfig | undefined => {
  return landingPages.find(page => page.slug === slug);
};

// Get all landing page slugs for routing
export const getAllLandingPageSlugs = (): string[] => {
  return landingPages.map(page => page.slug);
};
