// Landing Page Configurations for SEO-optimized service pages
// Each page targets specific keywords for Google Ads campaigns
// Copywriting style: Harry Dry / Marketing Examples - punchy, honest, memorable

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
      title: 'Video Production in Bodrum | Stories That Actually Get Watched',
      description: 'Your competitors have brochures. You\'ll have a story people actually want to watch. Bodrum-based video production team.',
      keywords: ['bodrum video production', 'video agency bodrum', 'commercial video turkey', 'brand video production', 'corporate video bodrum'],
    },
    hero: {
      headline: 'Your Brand Deserves',
      highlightedText: 'More Than Stock Footage',
      subheadline: 'We shoot stories that sell.',
      subtext: 'From concept to final cut — video content that makes people stop scrolling.',
      ctaText: 'See If We\'re a Fit',
    },
    defaultCategory: 'commercial',
    serviceFocus: 'video',
  },

  // Social Media Agency - EN
  {
    slug: 'bodrum-social-media-agency',
    lang: 'en',
    meta: {
      title: 'Social Media Agency Bodrum | Content That Stops The Scroll',
      description: 'Your feed is forgettable. Let\'s fix that. We create thumb-stopping content for brands that refuse to blend in.',
      keywords: ['bodrum social media agency', 'social media management bodrum', 'instagram marketing turkey', 'social media content creation', 'influencer marketing bodrum'],
    },
    hero: {
      headline: 'Stop Posting.',
      highlightedText: 'Start Mattering.',
      subheadline: 'Social content people actually want to share.',
      subtext: 'No templates. No stock photos. Just content that feels like your brand, only better.',
      ctaText: 'Audit My Feed',
    },
    defaultCategory: 'fashion',
    serviceFocus: 'social',
  },

  // Creative Agency - EN
  {
    slug: 'bodrum-creative-agency',
    lang: 'en',
    meta: {
      title: 'Creative Agency Bodrum | Ideas That Actually Work',
      description: 'Most agencies sell pretty. We sell clarity. Brand strategy and creative that makes sense, not just mood boards.',
      keywords: ['bodrum creative agency', 'branding agency bodrum', 'marketing agency turkey', 'creative services bodrum', 'brand strategy bodrum'],
    },
    hero: {
      headline: 'Creativity Without',
      highlightedText: 'Strategy Is Just Decoration',
      subheadline: 'We do both. Beautifully.',
      subtext: 'From boutique hotels to fashion brands — we make the complex look effortless.',
      ctaText: 'Let\'s Talk Strategy',
    },
    defaultCategory: 'all',
    serviceFocus: 'creative',
  },

  // Photography - EN
  {
    slug: 'bodrum-photography-agency',
    lang: 'en',
    meta: {
      title: 'Photography Agency Bodrum | Shots That Tell Stories',
      description: 'Product photos that make people curious. Brand imagery that feels authentic. Based in Bodrum, shooting wherever the story takes us.',
      keywords: ['bodrum photography agency', 'commercial photography bodrum', 'product photography turkey', 'brand photography bodrum', 'lifestyle photography'],
    },
    hero: {
      headline: 'Photos That',
      highlightedText: 'Feel Like Your Brand',
      subheadline: 'Only better.',
      subtext: 'No generic studio shots. Just imagery that makes your products impossible to ignore.',
      ctaText: 'Book a Test Shoot',
    },
    defaultCategory: 'fashion',
    serviceFocus: 'photo',
  },

  // Marketing Agency - EN
  {
    slug: 'bodrum-marketing-agency',
    lang: 'en',
    meta: {
      title: 'Marketing Agency Bodrum | Marketing That Makes Sense',
      description: 'Tired of agencies that speak in jargon? We focus on what actually moves the needle for your business.',
      keywords: ['bodrum marketing agency', 'digital marketing bodrum', 'marketing services turkey', 'brand marketing bodrum', 'performance marketing'],
    },
    hero: {
      headline: 'Marketing That',
      highlightedText: 'You Can Actually Measure',
      subheadline: 'No vanity metrics. Just results.',
      subtext: 'We obsess over what works so you can focus on running your business.',
      ctaText: 'Let\'s Talk Numbers',
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
      title: 'Bodrum Video Prodüksiyon | Gerçekten İzlenen Hikayeler',
      description: 'Rakiplerinizin broşürleri var. Sizin insanların izlemek isteyeceği bir hikayeniz olacak. Bodrum merkezli video prodüksiyon ekibi.',
      keywords: ['bodrum video prodüksiyon', 'video ajansı bodrum', 'reklam filmi çekimi', 'kurumsal video bodrum', 'tanıtım filmi'],
    },
    hero: {
      headline: 'Markanız',
      highlightedText: 'Stok Videodan Fazlasını Hak Ediyor',
      subheadline: 'Satan hikayeler çekiyoruz.',
      subtext: 'Konseptten final cut\'a — insanların kaydırmayı bırakıp izlediği içerikler.',
      ctaText: 'Tanışalım mı?',
    },
    defaultCategory: 'commercial',
    serviceFocus: 'video',
  },

  // Social Media Agency - TR
  {
    slug: 'bodrum-sosyal-medya-ajansi',
    lang: 'tr',
    meta: {
      title: 'Bodrum Sosyal Medya Ajansı | Scroll\'u Durduran İçerikler',
      description: 'Feed\'iniz unutuluyor. Bunu düzeltelim. Sıradan olmayı reddeden markalar için içerikler üretiyoruz.',
      keywords: ['bodrum sosyal medya ajansı', 'sosyal medya yönetimi bodrum', 'instagram pazarlama', 'sosyal medya içerik üretimi', 'influencer pazarlama'],
    },
    hero: {
      headline: 'Paylaşmayı Bırakın.',
      highlightedText: 'Fark Edilmeye Başlayın.',
      subheadline: 'İnsanların paylaşmak istediği içerik.',
      subtext: 'Şablon yok. Stok fotoğraf yok. Sadece markanız gibi hissettiren, ama daha iyi.',
      ctaText: 'Feed\'imi İncele',
    },
    defaultCategory: 'fashion',
    serviceFocus: 'social',
  },

  // Creative Agency - TR
  {
    slug: 'bodrum-kreatif-ajans',
    lang: 'tr',
    meta: {
      title: 'Bodrum Kreatif Ajans | Gerçekten İşe Yarayan Fikirler',
      description: 'Çoğu ajans güzel satar. Biz netlik satarız. Sadece mood board değil, anlam ifade eden marka stratejisi ve kreatif.',
      keywords: ['bodrum kreatif ajans', 'marka ajansı bodrum', 'pazarlama ajansı', 'kreatif hizmetler bodrum', 'marka stratejisi'],
    },
    hero: {
      headline: 'Strateji Olmadan',
      highlightedText: 'Yaratıcılık Sadece Dekorasyondur',
      subheadline: 'Biz ikisini de yapıyoruz. Kusursuzca.',
      subtext: 'Butik otellerden moda markalarına — karmaşığı zahmetsiz gösteriyoruz.',
      ctaText: 'Strateji Konuşalım',
    },
    defaultCategory: 'all',
    serviceFocus: 'creative',
  },

  // Photography - TR
  {
    slug: 'bodrum-fotograf-ajansi',
    lang: 'tr',
    meta: {
      title: 'Bodrum Fotoğraf Ajansı | Hikaye Anlatan Kareler',
      description: 'İnsanları meraklandıran ürün fotoğrafları. Otantik hissettiren marka görselleri. Bodrum merkezli, hikaye nereye götürürse orada.',
      keywords: ['bodrum fotoğraf ajansı', 'ticari fotoğrafçılık bodrum', 'ürün fotoğrafı', 'marka fotoğrafçılığı', 'yaşam tarzı fotoğrafçılık'],
    },
    hero: {
      headline: 'Markanız Gibi',
      highlightedText: 'Hissettiren Fotoğraflar',
      subheadline: 'Sadece daha iyi.',
      subtext: 'Jenerik stüdyo çekimi yok. Ürünlerinizi görmezden gelinemez kılan görseller.',
      ctaText: 'Deneme Çekimi Ayarla',
    },
    defaultCategory: 'fashion',
    serviceFocus: 'photo',
  },

  // Marketing Agency - TR
  {
    slug: 'bodrum-pazarlama-ajansi',
    lang: 'tr',
    meta: {
      title: 'Bodrum Pazarlama Ajansı | Anlaşılır Pazarlama',
      description: 'Jargon konuşan ajanslardan sıkıldınız mı? Biz işiniz için gerçekten fark yaratan şeylere odaklanıyoruz.',
      keywords: ['bodrum pazarlama ajansı', 'dijital pazarlama bodrum', 'pazarlama hizmetleri', 'marka pazarlama', 'performans pazarlama'],
    },
    hero: {
      headline: 'Gerçekten',
      highlightedText: 'Ölçebildiğiniz Pazarlama',
      subheadline: 'Gösteriş metriği yok. Sadece sonuç.',
      subtext: 'Biz neyin işe yaradığına takıntılıyız, siz işinizi yürütmeye odaklanın.',
      ctaText: 'Rakamları Konuşalım',
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
