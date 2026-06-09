// ============================================================================
// OPERASYONEL / ÜRETİM BRIEF'İ
// ----------------------------------------------------------------------------
// Marka stratejisi üretildikten ve müşteri sözleşme imzaladıktan (lead.status
// === 'won') SONRA doldurulan operasyonel veri katmanı. Stratejiyi ajansın
// AYLIK FAALİYET PLANINA (sosyal medya, içerik, reklam, web, prodüksiyon)
// dönüştürmek için gereken — wizard'ın toplamadığı — somut/operasyonel veriyi
// toplar. Marketing pipeline'a da beslenebilir (gerçekçi hedef + takvim).
//
// Tasarım ilkesi: Strateji wizard'ı "markanın NE olduğunu" sorar; bu brief
// "ajansın HER AY NE ÜRETECEĞİNİ ve NEYE GÖRE ÖLÇECEĞİNİ" sorar.
// ============================================================================

export type OperationalBriefStatus =
  | 'draft'        // Oluşturuldu, henüz doldurulmadı
  | 'in_progress'  // Müşteri/admin dolduruyor
  | 'completed';   // Tamamlandı, planlamaya hazır

export const OPERATIONAL_BRIEF_STATUS_LABELS: Record<OperationalBriefStatus, string> = {
  draft: 'Taslak',
  in_progress: 'Dolduruluyor',
  completed: 'Tamamlandı',
};

// ──────────────────────────────────────────────────────────────────────────
// 1. PERFORMANS TABANI (Baseline) — "Nereden başlıyoruz?"
//    Ajansın etkisini kanıtlayabilmesi için before/after referansı.
//    Strateji raporunun KPI çerçevesinin gerçekçi olabilmesi buna bağlı.
// ──────────────────────────────────────────────────────────────────────────
export interface PerformanceBaseline {
  monthlyRevenue?: string;          // Aylık ciro aralığı (opsiyonel/gizli olabilir)
  monthlyWebsiteVisitors?: string;  // Aylık web ziyaretçisi aralığı
  instagramEngagementRate?: string; // Ort. etkileşim oranı (% veya "bilmiyorum")
  monthlyLeadsOrSales?: string;     // Aylık müşteri adayı / satış adedi
  averageOrderValue?: string;       // Ortalama sepet/işlem tutarı
  currentMonthlyAdSpend?: string;   // Mevcut aylık reklam harcaması (varsa)
  currentRoasOrCac?: string;        // Mevcut ROAS veya müşteri edinme maliyeti (biliniyorsa)
  hasAnalyticsAccess?: boolean;     // GA4 / Meta Insights erişimi sağlanabilir mi?
  baselineNotes?: string;           // Serbest not — bilinen sayılar, dönemsel kıyas
}

// ──────────────────────────────────────────────────────────────────────────
// 2. ÜRETİM KAPASİTESİ & MEVCUT VARLIKLAR — "Ne çekeceğiz, ne küratörlük yapacağız?"
//    Sosyal/içerik işinin kapsamını belirler: sıfırdan üretim mi, mevcut
//    varlık düzenleme mi? Aylık çekim/üretim ritmini tanımlar.
// ──────────────────────────────────────────────────────────────────────────
export type AssetReadiness = 'rich' | 'some' | 'minimal' | 'none';

export interface ProductionCapacity {
  existingVisualAssets?: AssetReadiness; // Mevcut profesyonel görsel/video stoku
  canShootOnSite?: boolean;              // Mekânda/sahada çekim yapılabilir mi?
  shootAccessNotes?: string;            // Çekim erişimi: lokasyon, ürün, model, izin
  productSamplesAvailable?: boolean;     // Çekim için ürün numunesi sağlanabilir mi?
  monthlyContentCapacityNeeded?: string; // Beklenen aylık içerik hacmi (örn. "12 post + 8 reel")
  brandAssetFiles?: string;             // Logo/font/renk dosyaları durumu (var/yok/link)
  contentApprover?: string;             // İçeriği onaylayan kişi (isim/rol)
  approvalTurnaround?: string;          // Onay süresi (örn. "24 saat", "haftada 1 toplu")
}

// ──────────────────────────────────────────────────────────────────────────
// 3. KATALOG & ÖNCELİK — "Neyi öne çıkaracağız?"
//    İçerik ve reklamda hangi ürün/hizmetin vitrine çıkacağı + kârlılık.
//    Bütçe dağılımını ve hero ürün seçimini yönlendirir.
// ──────────────────────────────────────────────────────────────────────────
export interface CatalogPriority {
  heroProducts?: string;            // Öne çıkarılacak ürün/hizmetler (en kârlı/stratejik)
  highestMarginItems?: string;      // En yüksek marjlı kalemler (varsa)
  newOrSeasonalLaunches?: string;   // Yaklaşan lansman / sezonsal ürün
  itemsToDeprioritize?: string;     // Öne çıkarılMAYACAK / stoğu erimekte olanlar
  priceRange?: string;              // Fiyat aralığı (kampanya çerçevesi için)
}

// ──────────────────────────────────────────────────────────────────────────
// 4. SEZONSALLIK & TAKVİM — "Aylık ritim nasıl olmalı?"
//    İçerik takvimi + reklam flight planı. Ajansın yoğunluk dağılımı.
// ──────────────────────────────────────────────────────────────────────────
export interface SeasonalityCalendar {
  peakPeriods?: string;             // Yoğun dönemler (örn. "Kasım–Aralık, bayram öncesi")
  slowPeriods?: string;             // Ölü sezon
  upcomingKeyDates?: string;        // Yaklaşan kritik tarihler (lansman, etkinlik, açılış)
  recurringCampaigns?: string;      // Düzenli kampanyalar (örn. "her ay sonu indirim")
}

// ──────────────────────────────────────────────────────────────────────────
// 5. DÖNÜŞÜM MEKANİĞİ — "Lead nasıl satışa dönüyor?"
//    Funnel + CTA tasarımı. Hangi kanala yatırım yapılacağını belirler.
// ──────────────────────────────────────────────────────────────────────────
export type ConversionChannel =
  | 'whatsapp' | 'phone' | 'in_store' | 'ecommerce'
  | 'reservation' | 'form' | 'dm' | 'marketplace' | 'b2b_sales' | 'other';

export const CONVERSION_CHANNEL_LABELS: Record<ConversionChannel, string> = {
  whatsapp: 'WhatsApp',
  phone: 'Telefon',
  in_store: 'Mağaza / Fiziksel',
  ecommerce: 'E-ticaret sitesi',
  reservation: 'Online rezervasyon',
  form: 'Web formu',
  dm: 'Sosyal medya DM',
  marketplace: 'Pazar yeri (Trendyol, Hepsiburada vb.)',
  b2b_sales: 'B2B satış ekibi',
  other: 'Diğer',
};

export interface ConversionMechanics {
  primaryChannels?: ConversionChannel[]; // Satışın gerçekleştiği ana kanal(lar)
  salesCycleLength?: string;             // Karar/satış döngüsü süresi (B2B için kritik)
  whoHandlesInbound?: string;            // Gelen talebe kim, ne kadar hızlı yanıt veriyor?
  conversionNotes?: string;              // Funnel'daki bilinen darboğaz/sızıntı
}

// ──────────────────────────────────────────────────────────────────────────
// 6. MÜŞTERİ-VERİ VARLIKLARI — "Hangi kanalları açabiliriz?"
//    E-posta/CRM/retargeting kanallarının açılabilirliği.
// ──────────────────────────────────────────────────────────────────────────
export interface DataAssets {
  emailListSize?: string;           // E-posta listesi büyüklüğü (varsa)
  hasCrm?: boolean;                 // CRM / müşteri veritabanı var mı?
  hasPixelInstalled?: boolean;      // Meta Pixel / GA etiketi kurulu mu?
  customerDataNotes?: string;       // Sadakat programı, geçmiş alıcı verisi vb.
}

// ──────────────────────────────────────────────────────────────────────────
// 7. KISITLAR & ERİŞİMLER — "Neye dikkat, neye erişim?"
//    Reklam/içerik risk filtresi + ajansa verilecek hesap erişimleri.
// ──────────────────────────────────────────────────────────────────────────
export interface ConstraintsAccess {
  legalOrComplianceLimits?: string; // Söylenemeyecekler (sağlık/eğitim/finans/FMCG iddiaları)
  toneOrContentNoGo?: string;       // Marka olarak yapılmayacak içerik/ton
  competitorsOffLimits?: string;    // Adı geçirilmeyecek / karşılaştırılmayacak rakipler
  accountAccessReady?: string;      // Verilecek erişimler (Meta BM, Google Ads, web admin)
  internalContacts?: string;        // Ajansın muhatap olacağı kişiler + rolleri
}

// ──────────────────────────────────────────────────────────────────────────
// ANA TİP
// ──────────────────────────────────────────────────────────────────────────
export interface OperationalBrief {
  id: string;
  tenantId: string;
  leadId: string;                   // İlişkili BrandLead (status: 'won')
  businessName: string;             // Kolay görüntüleme için denormalize
  sector: string;                   // Denormalize (sektöre özel ipuçları için)
  status: OperationalBriefStatus;
  shareToken?: string;              // Müşterinin doldurması için public erişim

  performance?: PerformanceBaseline;
  production?: ProductionCapacity;
  catalog?: CatalogPriority;
  seasonality?: SeasonalityCalendar;
  conversion?: ConversionMechanics;
  dataAssets?: DataAssets;
  constraints?: ConstraintsAccess;

  completionPercent?: number;       // Doluluk yüzdesi (UI ilerleme göstergesi)
  filledBy?: 'admin' | 'client';    // Son dolduran
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

// Yeni brief oluştururken zorunlu alanlar
export interface OperationalBriefInput {
  leadId: string;
  businessName: string;
  sector: string;
  shareToken?: string;
}

// ──────────────────────────────────────────────────────────────────────────
// BÖLÜM META — UI'ın bölümleri sırayla render etmesi + ilerleme hesabı için
// ──────────────────────────────────────────────────────────────────────────
export interface OperationalBriefSectionMeta {
  key: keyof Pick<OperationalBrief,
    'performance' | 'production' | 'catalog' | 'seasonality' | 'conversion' | 'dataAssets' | 'constraints'>;
  title: string;
  description: string;
  /** Bu bölümün doluluk sayımına giren alan sayısı (completionPercent için) */
  fieldCount: number;
}

export const OPERATIONAL_BRIEF_SECTIONS: OperationalBriefSectionMeta[] = [
  {
    key: 'performance',
    title: 'Performans Tabanı',
    description: 'Nereden başlıyoruz? Mevcut sayılar, ajansın etkisini ölçmenin referansıdır.',
    fieldCount: 9,
  },
  {
    key: 'production',
    title: 'Üretim Kapasitesi',
    description: 'Ne çekeceğiz, neyi düzenleyeceğiz? Aylık içerik ritmini bu belirler.',
    fieldCount: 8,
  },
  {
    key: 'catalog',
    title: 'Katalog & Öncelik',
    description: 'Hangi ürün/hizmeti öne çıkaracağız? Bütçe ve hero seçimi.',
    fieldCount: 5,
  },
  {
    key: 'seasonality',
    title: 'Sezonsallık & Takvim',
    description: 'Aylık ritim: yoğun dönemler, kritik tarihler, düzenli kampanyalar.',
    fieldCount: 4,
  },
  {
    key: 'conversion',
    title: 'Dönüşüm Mekaniği',
    description: 'Lead nasıl satışa dönüyor? Hangi kanala yatırım yapacağımızı belirler.',
    fieldCount: 4,
  },
  {
    key: 'dataAssets',
    title: 'Veri Varlıkları',
    description: 'E-posta listesi, CRM, pixel — hangi kanalları açabiliriz?',
    fieldCount: 4,
  },
  {
    key: 'constraints',
    title: 'Kısıtlar & Erişimler',
    description: 'Neye dikkat edilmeli, ajansa hangi hesap erişimleri verilecek?',
    fieldCount: 5,
  },
];

/** Brief'in genel doluluk yüzdesini hesaplar (UI + 'completed' kararı için). */
export function computeBriefCompletion(brief: Partial<OperationalBrief>): number {
  let total = 0;
  let filled = 0;
  for (const section of OPERATIONAL_BRIEF_SECTIONS) {
    total += section.fieldCount;
    const data = (brief[section.key] || {}) as Record<string, unknown>;
    for (const v of Object.values(data)) {
      if (v === undefined || v === null) continue;
      if (typeof v === 'string' && v.trim() === '') continue;
      if (Array.isArray(v) && v.length === 0) continue;
      filled += 1;
    }
  }
  return total === 0 ? 0 : Math.round((filled / total) * 100);
}
