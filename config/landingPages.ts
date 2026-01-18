// Landing Page Configurations for SEO-optimized service pages
// Each page targets specific keywords for Google Ads campaigns
// Copywriting style: Harry Dry / Marketing Examples - punchy, specific, memorable

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
      title: 'Video Production in Bodrum | We Make Brands Unforgettable',
      description: 'Your competitors have brochures. You\'ll have a story people actually want to watch. Bodrum\'s most-booked video team.',
      keywords: ['bodrum video production', 'video agency bodrum', 'commercial video turkey', 'brand video production', 'corporate video bodrum'],
    },
    hero: {
      headline: 'Your Brand Deserves',
      highlightedText: 'More Than Stock Footage',
      subheadline: 'We shoot stories that sell.',
      subtext: 'Last year, our videos generated 47M views for brands you\'ve definitely heard of.',
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
      highlightedText: 'Start Dominating.',
      subheadline: 'Social content that makes competitors nervous.',
      subtext: '12 brands. 8M+ followers gained. Zero stock photos used.',
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
      description: 'Most agencies sell pretty. We sell results. Brand strategy and creative that moves the needle, not just the mood board.',
      keywords: ['bodrum creative agency', 'branding agency bodrum', 'marketing agency turkey', 'creative services bodrum', 'brand strategy bodrum'],
    },
    hero: {
      headline: 'Creativity Without',
      highlightedText: 'Strategy Is Just Art',
      subheadline: 'We do both. Beautifully.',
      subtext: 'From boutique hotels to global fashion brands — we make the complex look effortless.',
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
      title: 'Photography Agency Bodrum | Shots Worth a Thousand Sales',
      description: 'Product photos that make people click "add to cart" before they read the price. Based in Bodrum, shooting worldwide.',
      keywords: ['bodrum photography agency', 'commercial photography bodrum', 'product photography turkey', 'brand photography bodrum', 'lifestyle photography'],
    },
    hero: {
      headline: 'Good Photos Get Likes.',
      highlightedText: 'Great Photos Get Sales.',
      subheadline: 'We shoot the great ones.',
      subtext: 'Our product shots have a 3.2x higher conversion rate than industry average.',
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
      title: 'Marketing Agency Bodrum | We Turn Clicks Into Customers',
      description: 'Tired of agencies that can\'t show you the numbers? We obsess over ROI so you can obsess over growth.',
      keywords: ['bodrum marketing agency', 'digital marketing bodrum', 'marketing services turkey', 'brand marketing bodrum', 'performance marketing'],
    },
    hero: {
      headline: 'Marketing That',
      highlightedText: 'Pays For Itself',
      subheadline: 'No vanity metrics. Just revenue.',
      subtext: 'Average client ROI: 340%. Average partnership: 3+ years. Coincidence? Nope.',
      ctaText: 'Show Me The Numbers',
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
      title: 'Bodrum Video Prodüksiyon | Markanızı Unutulmaz Kılıyoruz',
      description: 'Rakiplerinizin broşürleri var. Sizin insanların izlemek isteyeceği bir hikayeniz olacak. Bodrum\'un en çok tercih edilen video ekibi.',
      keywords: ['bodrum video prodüksiyon', 'video ajansı bodrum', 'reklam filmi çekimi', 'kurumsal video bodrum', 'tanıtım filmi'],
    },
    hero: {
      headline: 'Markanız',
      highlightedText: 'Stok Videodan Fazlasını Hak Ediyor',
      subheadline: 'Satan hikayeler çekiyoruz.',
      subtext: 'Geçen yıl videolarımız, kesinlikle duyduğunuz markalar için 47M görüntülenme aldı.',
      ctaText: 'Uyumlu muyuz? Bakalım',
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
      description: 'Feed\'iniz unutuluyor. Bunu düzeltelim. Sıradan olmayı reddeden markalar için parmak durduran içerikler üretiyoruz.',
      keywords: ['bodrum sosyal medya ajansı', 'sosyal medya yönetimi bodrum', 'instagram pazarlama', 'sosyal medya içerik üretimi', 'influencer pazarlama'],
    },
    hero: {
      headline: 'Paylaşmayı Bırakın.',
      highlightedText: 'Hükmetmeye Başlayın.',
      subheadline: 'Rakipleri tedirgin eden sosyal içerik.',
      subtext: '12 marka. 8M+ kazanılan takipçi. Sıfır stok fotoğraf.',
      ctaText: 'Feed\'imi Analiz Et',
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
      description: 'Çoğu ajans güzellik satar. Biz sonuç satarız. Mood board\'u değil, ibreyi oynatan marka stratejisi ve kreatif.',
      keywords: ['bodrum kreatif ajans', 'marka ajansı bodrum', 'pazarlama ajansı', 'kreatif hizmetler bodrum', 'marka stratejisi'],
    },
    hero: {
      headline: 'Strateji Olmadan',
      highlightedText: 'Yaratıcılık Sadece Sanattır',
      subheadline: 'Biz ikisini de yapıyoruz. Kusursuzca.',
      subtext: 'Butik otellerden global moda markalarına — karmaşığı zahmetsiz gösteriyoruz.',
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
      title: 'Bodrum Fotoğraf Ajansı | Bin Satış Değerinde Kareler',
      description: 'İnsanların fiyata bakmadan "sepete ekle"ye tıklamasını sağlayan ürün fotoğrafları. Bodrum merkezli, dünya genelinde çekim.',
      keywords: ['bodrum fotoğraf ajansı', 'ticari fotoğrafçılık bodrum', 'ürün fotoğrafı', 'marka fotoğrafçılığı', 'yaşam tarzı fotoğrafçılık'],
    },
    hero: {
      headline: 'İyi Fotoğraflar Beğeni Alır.',
      highlightedText: 'Harika Fotoğraflar Satış Alır.',
      subheadline: 'Biz harika olanları çekiyoruz.',
      subtext: 'Ürün çekimlerimiz sektör ortalamasından 3.2x daha yüksek dönüşüm oranına sahip.',
      ctaText: 'Test Çekimi Planla',
    },
    defaultCategory: 'fashion',
    serviceFocus: 'photo',
  },

  // Marketing Agency - TR
  {
    slug: 'bodrum-pazarlama-ajansi',
    lang: 'tr',
    meta: {
      title: 'Bodrum Pazarlama Ajansı | Tıklamaları Müşteriye Çeviriyoruz',
      description: 'Rakam gösteremeyen ajanslardan sıkıldınız mı? Biz ROI\'ye takıntılıyız ki siz büyümeye takıntılı olabilesiniz.',
      keywords: ['bodrum pazarlama ajansı', 'dijital pazarlama bodrum', 'pazarlama hizmetleri', 'marka pazarlama', 'performans pazarlama'],
    },
    hero: {
      headline: 'Kendini',
      highlightedText: 'Ödeyen Pazarlama',
      subheadline: 'Gösteriş metriği yok. Sadece gelir.',
      subtext: 'Ortalama müşteri ROI\'si: %340. Ortalama ortaklık süresi: 3+ yıl. Tesadüf mü? Hayır.',
      ctaText: 'Rakamları Göster',
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
