// Sector-Framework Configuration Map
// Defines which frameworks are prioritized per sector + perceptual map axes

export interface SectorFrameworkConfig {
  priorityFrameworks: string[];
  perceptualMapAxes: {
    xAxis: { label: string; lowEnd: string; highEnd: string };
    yAxis: { label: string; lowEnd: string; highEnd: string };
  };
  keyMetrics: string[];
  culturalBrandingLens: string; // Douglas Holt cultural branding perspective
}

export const SECTOR_FRAMEWORK_MAP: Record<string, SectorFrameworkConfig> = {
  gastronomi: {
    priorityFrameworks: ['Byron Sharp CEPs', 'Hook Model', 'Cialdini', 'Kano Model'],
    perceptualMapAxes: {
      xAxis: { label: 'Fiyat', lowEnd: 'Ekonomik', highEnd: 'Premium' },
      yAxis: { label: 'Deneyim Kalitesi', lowEnd: 'Fonksiyonel (karın doyurma)', highEnd: 'Deneyimsel (yaşam tarzı)' },
    },
    keyMetrics: ['Müşteri başına ortalama hesap', 'Tekrar ziyaret oranı', 'Google/TripAdvisor puanı', 'Sosyal medya paylaşım oranı'],
    culturalBrandingLens: 'Yemek kültürü, "instagramlık" deneyim vs otantik lezzet gerilimi, hızlı tüketim vs slow food',
  },
  hospitality: {
    priorityFrameworks: ['Keller CBBE', 'Byron Sharp CEPs', 'Kano Model', 'Hook Model'],
    perceptualMapAxes: {
      xAxis: { label: 'Fiyat', lowEnd: 'Bütçe Dostu', highEnd: 'Lüks' },
      yAxis: { label: 'Hizmet Seviyesi', lowEnd: 'Self-servis / Standart', highEnd: 'Tam Hizmet / Butik' },
    },
    keyMetrics: ['RevPAR', 'ADR', 'Doluluk oranı', 'Direkt rezervasyon oranı', 'NPS', 'OTA puanı'],
    culturalBrandingLens: '"Ev gibi rahat" vs "evden daha iyi" gerilimi, dijital göçebe trendi, sürdürülebilir turizm baskısı',
  },
  fmcg: {
    priorityFrameworks: ['Byron Sharp CEPs', 'Blue Ocean', 'Cialdini', 'Keller CBBE'],
    perceptualMapAxes: {
      xAxis: { label: 'Fiyat', lowEnd: 'Ekonomik', highEnd: 'Premium' },
      yAxis: { label: 'Kalite Algısı', lowEnd: 'Standart / Jenerik', highEnd: 'Üstün Kalite / Zanaat' },
    },
    keyMetrics: ['Raf payı', 'Marka bilinirliği', 'Tekrar satın alma oranı', 'Penetrasyon oranı'],
    culturalBrandingLens: 'Doğallık vs endüstriyel üretim gerilimi, yerel vs global marka tercihi, sağlık bilinci artışı',
  },
  tech: {
    priorityFrameworks: ['Hook Model', 'Fogg B=MAP', 'Kano Model', 'Blue Ocean'],
    perceptualMapAxes: {
      xAxis: { label: 'Karmaşıklık', lowEnd: 'Basit / Sezgisel', highEnd: 'Güçlü / Karmaşık' },
      yAxis: { label: 'Fiyat', lowEnd: 'Ücretsiz / Freemium', highEnd: 'Enterprise' },
    },
    keyMetrics: ['MRR/ARR', 'Churn rate', 'NPS', 'Activation rate', 'Time-to-value', 'DAU/MAU'],
    culturalBrandingLens: 'Otomasyon korkusu vs verimlilik vaadi, veri gizliliği kaygısı, "bir daha yazılım öğrenmek istemiyorum" yorgunluğu',
  },
  retail: {
    priorityFrameworks: ['Aaker Identity', 'Fogg B=MAP', 'Kano Model', 'Byron Sharp CEPs'],
    perceptualMapAxes: {
      xAxis: { label: 'Fiyat', lowEnd: 'Ekonomik', highEnd: 'Premium' },
      yAxis: { label: 'Bulunabilirlik', lowEnd: 'Sınırlı Erişim / Özel', highEnd: 'Yaygın / Her Yerde' },
    },
    keyMetrics: ['Sepet ortalaması', 'Dönüşüm oranı', 'Tekrar müşteri oranı', 'NPS', 'Online/offline dağılım'],
    culturalBrandingLens: 'Online vs mağaza deneyimi, sürdürülebilirlik baskısı, "ucuz ama kaliteli" paradoksu',
  },
  corporate: {
    priorityFrameworks: ['Keller CBBE', 'Aaker Identity', 'Cialdini (Authority)', 'Blue Ocean'],
    perceptualMapAxes: {
      xAxis: { label: 'Prestij', lowEnd: 'Lokal / Boutique', highEnd: 'Kurumsal / Global' },
      yAxis: { label: 'Uzmanlık', lowEnd: 'Genel / Multi-disiplin', highEnd: 'Niş / Uzman' },
    },
    keyMetrics: ['Müşteri yaşam boyu değeri', 'Teklif dönüşüm oranı', 'Referans oranı', 'NPS'],
    culturalBrandingLens: 'Dijital dönüşüm baskısı, "butik ajans vs büyük kurum" tercihi, uzaktan çalışma etkisi',
  },
  health: {
    priorityFrameworks: ['Keller CBBE', 'Cialdini (Authority)', 'Fogg B=MAP', 'Kano Model'],
    perceptualMapAxes: {
      xAxis: { label: 'Güven', lowEnd: 'Yeni / Bilinmeyen', highEnd: 'Köklü / Güvenilir' },
      yAxis: { label: 'Erişim', lowEnd: 'Sınırlı / Randevu Zor', highEnd: 'Kolay Erişim / Dijital' },
    },
    keyMetrics: ['Hasta memnuniyeti', 'Randevu tamamlama oranı', 'Google puanı', 'Bekleme süresi'],
    culturalBrandingLens: 'Geleneksel tıp vs modern yaklaşım, "doktora güven" erozyonu, sağlık turizmi fırsatı',
  },
  education: {
    priorityFrameworks: ['Hook Model', 'Fogg B=MAP', 'Byron Sharp CEPs', 'Kano Model'],
    perceptualMapAxes: {
      xAxis: { label: 'Fiyat', lowEnd: 'Ücretsiz / Düşük', highEnd: 'Premium' },
      yAxis: { label: 'Kariyer Etkisi', lowEnd: 'Hobi / Kişisel Gelişim', highEnd: 'Kariyer Dönüştürücü' },
    },
    keyMetrics: ['Tamamlama oranı', 'İstihdam oranı', 'NPS', 'Yeniden kayıt oranı'],
    culturalBrandingLens: 'Diploma değersizleşmesi, "skill-based" istihdam trendi, ömür boyu öğrenme zorunluluğu',
  },
  showroom: {
    priorityFrameworks: ['Aaker Identity', 'Kano Model', 'Cialdini', 'Hook Model'],
    perceptualMapAxes: {
      xAxis: { label: 'Fiyat', lowEnd: 'Ekonomik', highEnd: 'Lüks' },
      yAxis: { label: 'Showroom Deneyimi', lowEnd: 'Standart Satış Noktası', highEnd: 'İnteraktif Deneyim Alanı' },
    },
    keyMetrics: ['Ziyaret-satış dönüşüm oranı', 'Ortalama işlem değeri', 'Müşteri geri dönüş oranı'],
    culturalBrandingLens: 'Online vs fiziksel deneyim, "dokunmadan almam" kültürü, sürdürülebilirlik beklentisi',
  },
};

/** Get framework config for a sector (with fallback to generic) */
export function getSectorFrameworkConfig(sector: string): SectorFrameworkConfig {
  // Normalize sector name
  const normalizedSector = sector.toLowerCase().replace(/\s+/g, '');

  return SECTOR_FRAMEWORK_MAP[normalizedSector] || {
    priorityFrameworks: ['Keller CBBE', 'Aaker Identity', 'Blue Ocean', 'Fogg B=MAP'],
    perceptualMapAxes: {
      xAxis: { label: 'Fiyat', lowEnd: 'Ekonomik', highEnd: 'Premium' },
      yAxis: { label: 'Kalite/Deneyim', lowEnd: 'Standart', highEnd: 'Üstün' },
    },
    keyMetrics: ['Müşteri memnuniyeti', 'Marka bilinirliği', 'Tekrar satın alma', 'NPS'],
    culturalBrandingLens: 'Sektöre özgü kültürel gerilimler araştırılmalı',
  };
}
