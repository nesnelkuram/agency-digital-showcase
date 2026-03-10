import { registerSectorEnrichment } from './types';
import type { SectorEnrichmentModule } from './types';

const fmcg: SectorEnrichmentModule = {
  sector: 'fmcg',
  dataFieldName: 'fmcgData',

  culturalTensions: [
    {
      expectation: 'Büyük marka = güvenilir',
      reality: 'Tüketiciler dev markaların samimiyetsizliğinden bıktı, yerel/butik markalara yöneliyor',
      opportunity: '"Arkasındaki insanı tanıyorsun" samimiyeti — küçük markanın büyük avantajı',
    },
    {
      expectation: 'Doğal/organik = sağlıklı',
      reality: 'Greenwashing yaygın, tüketiciler "doğal" etiketine artık şüpheyle bakıyor',
      opportunity: 'Kanıtlanabilir şeffaflık: üretim süreci, tedarik zinciri, sertifika — görünen dürüstlük',
    },
    {
      expectation: 'Raf görünürlüğü satışı belirler',
      reality: 'Online market, D2C kanallar, sosyal ticaret — raf artık dijital',
      opportunity: 'Dijital raf stratejisi: SEO, marketplace optimizasyonu, influencer seeding',
    },
    {
      expectation: 'Fiyat savaşı kaçınılmaz',
      reality: 'Premium niş ürünler rekor büyüyor, tüketiciler "değer" için ödemeye razı',
      opportunity: 'Fiyat savaşından çıkıp "buna değer" hikayesi kurmak',
    },
    {
      expectation: 'Hızlı tüketim = düşük sadakat',
      reality: 'Tüketiciler az markaya sadık kalıp, o markaları hayatlarının parçası yapıyor',
      opportunity: 'Ürün değil, ritüel satmak — "sabah kahvaltımın vazgeçilmezi"',
    },
  ],

  deepResearchSteps: `

ADIM 6 — RAF VARLIGI & DAGITIM (FMCG'YE OZEL):
- "$BUSINESS_NAME" urunlerini markette/A101/BIM/Migros/Carrefour/online marketlerde ara.
- Hangi perakende zincirlerinde/kanallarda mevcut?
- Online market varligi: Getir, Trendyol Market, Migros Sanal, Istegelsin.
- Dagitim kapsami: yerel mi, bolgesel mi, ulusal mi?

ADIM 7 — URUN PORTFOYU & FIYATLAMA (FMCG'YE OZEL):
- "$BUSINESS_NAME" urun yelpazesi: kac kategori, kac SKU?
- Fiyat konumlandirma: ekonomik/orta/premium segment.
- Rakip urunlere gore raf fiyati karsilastirmasi.
- Promosyon stratejisi: X al Y ode, kampanyali fiyat, numune dagitimi.
- Ambalaj/paketleme: boyut cesitliligi, eko-ambalaj.

ADIM 8 — TUKETICI PROFILI & SATIN ALMA (FMCG'YE OZEL):
- Hedef tuketici profili: yas, cinsiyet, gelir, yasam tarzi.
- Satin alma sikligi ve ortalama harcama.
- Marka sadakati vs fiyat hassasiyeti.
- Tuketici karar sureci: raf basi karar, reklam etkisi, tavsiye.

ADIM 9 — URETIM & KALITE (FMCG'YE OZEL):
- Uretim kapasitesi ve tesisleri (varsa aciklanan).
- Kalite sertifikalari: ISO 22000, HACCP, BRC, IFS, helal sertifika.
- Hammadde tedarik zinciri: yerel mi, ithal mi?
- Surdurulebilirlik uygulamalari (ambalaj, enerji, karbon ayak izi).`,

  terminologyOverrides: {
    productLabel: 'Hangi URUN KATEGORILERI uretiyor/satiyor? (atistirmalik, icecek, temizlik, kisisel bakim, gida, bebek vb.)',
    priceDetail: ' — birim fiyat, rakibe gore raf fiyati konumu',
    positioningExamples: 'premium/orta-ust/kitlesel/ekonomik/organik-dogal/nis',
    competitorAnalysisLabel: 'RAKIP MARKA/URUN ANALIZI',
    competitorSearchExample: 'Ornek: Eger "dogal meyve suyu" ise → "Turkiye dogal meyve suyu markalari" ara.',
    competitorMetrics: 'Rakip urunlerin raf fiyati, dagitim kapsami, pazar payi ve tuketici algi puanlarini karsilastir.',
    competitorStrengthsContext: 'pazar payi, dagitim gucu, marka bilinirlik, fiyat, urun kalitesi, ambalaj tasarimi',
    marketDataFocus: 'FMCG sektoru verileri: kategori pazar buyuklugu, buyume orani, hanehalk harcamalari, perakende kanali dagilimi.',
    audienceLabel: 'Bu markanin urunlerini gercekte kimler satin aliyor? Tuketici profili:',
    audienceDetails: [
      'Yas, cinsiyet, gelir grubu, hanehalki buyuklugu.',
      'Satin alma kanali: market, bakkal, online, toptan.',
      'Karar sureci: fiyat odakli, kalite odakli, marka bagliligi, deneme istegi.',
    ],
    customerTerm: 'tuketiciler',
    websiteAnalysisFocus: 'Urun katalogu, icerik (tarifler, kullanim), e-ticaret entegrasyonu, kampanyalar.',
    researchType: 'FMCG/GIDA BAZLI',
  },

  extraGroundingQueries: (businessName: string, dateRule: string) => [
    {
      prompt: `"${businessName}" urun fiyat market raf — A101, BIM, Migros, Getir fiyatlari, urun cesitleri, dagitim kanallari. Turkce yaz.${dateRule}`,
      label: 'SectorResearch-RetailShelf',
    },
    {
      prompt: `"${businessName}" marka tuketici yorum tercih — tuketici yorumlari, sosyal medya algisi, marka bilinirlik. Turkce yaz.${dateRule}`,
      label: 'SectorResearch-ConsumerPerception',
    },
  ],

  groundingPromptOverrides: {
    competitor: (businessName: string, dateRule: string) =>
      `Sen bir FMCG sektor arastirmacisisin. "${businessName}" ile ayni kategoride rekabet eden markalari arastir. Her rakip icin: marka adi, urun yelpazesi, pazar payi tahmini, fiyat segmenti, dagitim kapsami, guclu/zayif yanlar bul. EN AZ 3, EN FAZLA 7 rakip. Turkce yaz.${dateRule}`,
    market: (businessName: string, dateRule: string) =>
      `Sen bir FMCG pazar arastirmacisisin. "${businessName}" icin: kategori pazar buyuklugu (Turkiye), buyume orani, hanehalk FMCG harcamasi, perakende kanal dagilimi (modern trade vs geleneksel), e-ticaret penetrasyonu arastir. Somut rakamlar ver. Turkce yaz.${dateRule}`,
    trend: (businessName: string, dateRule: string) =>
      `FMCG sektoru "${businessName}" icin: saglikli/dogal/organik urun trendi, surdurulebilir ambalaj, D2C satis modeli, online market buyumesi, influencer pazarlama etkisi, ozel marka (private label) tehdidi. Turkce yaz.${dateRule}`,
  },

  extractionSchemaFragment: `,
  "fmcgData": {
    "distributionProfile": {
      "retailChains": ["Bulundugu perakende zincirleri"],
      "onlineMarkets": ["Online market varligi (Getir, Trendyol Market vb.)"],
      "distributionScope": "Yerel / bolgesel / ulusal / uluslararasi",
      "channelMix": "Modern trade vs geleneksel kanal orani"
    },
    "productPortfolio": {
      "categories": ["Urun kategorileri"],
      "skuCount": "Tahmini SKU sayisi",
      "flagshipProducts": ["Amiral gemisi urunler"],
      "newLaunches": ["Son donem yeni urunler (varsa)"]
    },
    "pricingAnalysis": {
      "priceSegment": "Ekonomik / orta / premium / organik-premium",
      "priceRange": { "low": "En dusuk urun fiyati", "high": "En yuksek urun fiyati" },
      "vsCompetitorPricing": "Rakiplere gore fiyat konumu",
      "promotionStrategy": "Promosyon stratejisi"
    },
    "consumerProfile": {
      "primaryDemographic": "Birincil tuketici demografisi",
      "purchaseFrequency": "Satin alma sikligi",
      "brandLoyalty": "Marka sadakati seviyesi",
      "purchaseChannel": "Birincil satin alma kanali"
    },
    "productionQuality": {
      "certifications": ["Kalite sertifikalari (ISO, HACCP, BRC vb.)"],
      "productionCapacity": "Uretim kapasitesi (varsa)",
      "sustainability": "Surdurulebilirlik uygulamalari"
    },
    "reviewSentiment": {
      "positiveThemes": ["Olumlu temalar — orn: lezzet, dogallik, ambalaj"],
      "negativeThemes": ["Olumsuz temalar — orn: fiyat artisi, boyut kuculme"],
      "overallSentiment": "Genel tuketici algisi"
    }
  }`,

  extractionRules: `
6. FMCG VERILERINI AYRI CIKAR: distributionProfile, productPortfolio, pricingAnalysis, consumerProfile, productionQuality, reviewSentiment alanlarini doldur.
7. Dagitim kanallari ve perakende zincir bilgisi metinde varsa MUTLAKA fmcgData.distributionProfile'a ekle.
8. Urun portfoyu ve SKU bilgisi varsa MUTLAKA fmcgData.productPortfolio'ya ekle.
9. Fiyat karsilastirmasi ve promosyon bilgisi varsa MUTLAKA fmcgData.pricingAnalysis'e ekle.
10. Kalite sertifikalari (HACCP, ISO, BRC vb.) varsa MUTLAKA fmcgData.productionQuality'ye ekle.
11. fmcgData icindeki her alan icin: veri bulunamadiysa "Veri bulunamadi" yaz, ALANI SILME.`,

  formatForSynthesizer: (fd: any): string => {
    if (!fd) return '';
    const parts: string[] = [];
    if (fd.distributionProfile) {
      parts.push(`Dagitim: ${fd.distributionProfile.retailChains?.join(', ') || 'N/A'}, Kapsam: ${fd.distributionProfile.distributionScope || 'N/A'}`);
      if (fd.distributionProfile.onlineMarkets?.length) parts.push(`  Online: ${fd.distributionProfile.onlineMarkets.join(', ')}`);
    }
    if (fd.productPortfolio) {
      parts.push(`Portfoy: ${fd.productPortfolio.categories?.join(', ') || 'N/A'}, SKU: ${fd.productPortfolio.skuCount || 'N/A'}`);
      if (fd.productPortfolio.flagshipProducts?.length) parts.push(`  Amiral gemisi: ${fd.productPortfolio.flagshipProducts.join(', ')}`);
    }
    if (fd.pricingAnalysis) {
      parts.push(`Fiyatlama: Segment: ${fd.pricingAnalysis.priceSegment || 'N/A'}, Rakibe gore: ${fd.pricingAnalysis.vsCompetitorPricing || 'N/A'}`);
    }
    if (fd.consumerProfile) {
      parts.push(`Tuketici: ${fd.consumerProfile.primaryDemographic || 'N/A'}, Sadakat: ${fd.consumerProfile.brandLoyalty || 'N/A'}, Kanal: ${fd.consumerProfile.purchaseChannel || 'N/A'}`);
    }
    if (fd.productionQuality?.certifications?.length) {
      parts.push(`Sertifikalar: ${fd.productionQuality.certifications.join(', ')}`);
    }
    if (fd.reviewSentiment) {
      if (fd.reviewSentiment.positiveThemes?.length) parts.push(`Olumlu temalar: ${fd.reviewSentiment.positiveThemes.join(', ')}`);
      if (fd.reviewSentiment.negativeThemes?.length) parts.push(`Olumsuz temalar: ${fd.reviewSentiment.negativeThemes.join(', ')}`);
    }
    if (!parts.length) return '';
    return `\n\n## FMCG/Gida Verileri (Sektor-Spesifik)\n${parts.join('\n')}`;
  },
};

registerSectorEnrichment(fmcg);

export default fmcg;
