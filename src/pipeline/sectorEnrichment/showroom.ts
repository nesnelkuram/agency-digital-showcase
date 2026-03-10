import { registerSectorEnrichment } from './types';
import type { SectorEnrichmentModule } from './types';

const showroom: SectorEnrichmentModule = {
  sector: 'showroom',
  dataFieldName: 'showroomData',

  culturalTensions: [
    {
      expectation: 'Müşteri fiyata göre karar verir',
      reality: 'Ev dekorasyonunda fiyat değil, "hayal ettiğim ev" vizyonu karar verdiriyor',
      opportunity: 'Ürün satmak yerine "yaşam alanı vizyonu" satmak — showroom as inspiration hub',
    },
    {
      expectation: 'Mimar/tasarımcı yönlendirir, son kullanıcı takip eder',
      reality: 'Pinterest/Instagram ile son kullanıcı artık ne istediğini biliyor, mimarı yönlendiriyor',
      opportunity: 'B2B2C: hem profesyonele hem son kullanıcıya aynı anda hitap eden içerik stratejisi',
    },
    {
      expectation: 'Showroom ziyareti zorunluluk',
      reality: '3D görselleştirme ve AR, showroom ziyaretini gereksiz kılıyor',
      opportunity: 'Showroomu "ürün rüyasını yaşatan" deneyim merkezine çevirmek — dijital yapamayacağı şey',
    },
    {
      expectation: 'Kaliteli malzeme kendini satar',
      reality: 'Müşteri teknik kaliteyi anlamıyor, tüm markalar "en kaliteli" diyor',
      opportunity: 'Kaliteyi hikayeyle anlatmak: malzemenin yolculuğu, ustanın eli, 10 yıl sonrası',
    },
    {
      expectation: 'Daha geniş ürün yelpazesi = daha fazla satış',
      reality: 'Her şeyi sunan showroom hiçbir şeyde uzman görünmüyor',
      opportunity: 'Niş uzmanlık: "Türkiye\'nin banyo uzmanı" vs "her şey var" — kategori sahipliği',
    },
  ],

  deepResearchSteps: `

ADIM 6 — SHOWROOM & MAGAZA DENEYIMI (YAPI & DEKORASYONA OZEL):
- "$BUSINESS_NAME" showroom/magaza konumlarini ve buyuklugunu bul.
- Google Maps yorumlari: puan, yorum sayisi, fotograf sayisi.
- Showroom konsepti: ornek mekan kurulumu, deneyim alani, danismanlik hizmeti.
- Musteri yorumlarinda TEKRARLAYAN TEMALAR (urun kalitesi, fiyat, montaj, teslimat vb.).

ADIM 7 — URUN & FIYAT ANALIZI (YAPI & DEKORASYONA OZEL):
- "$BUSINESS_NAME" urun kategorileri: mobilya, aydinlatma, yapi malzemesi, seramik, banyo, mutfak, dekorasyon?
- Fiyat konumlandirma: ekonomik/orta/premium/luks.
- Urun kaynaklari: yerli uretim mi, ithalat mi, OEM mi?
- Proje bazli calisma yapiyor mu? (ic mimarlik, anahtar teslim, kurumsal proje)
- Ozel siparis / kisisellestirme imkani var mi?

ADIM 8 — MUSTERI & PROJE PROFILI (YAPI & DEKORASYONA OZEL):
- Musteri profili: bireysel ev sahibi, ic mimar, muteahhit, otel/restoran projesi?
- B2C vs B2B dagılım oranı.
- Ortalama proje/siparis buyuklugu.
- Referans projeler: otel, restoran, ofis, konut projesi (varsa).

ADIM 9 — DIJITAL VARLIK & E-TICARET (YAPI & DEKORASYONA OZEL):
- E-ticaret sitesi var mi? Hangi platformda?
- Trendyol/Hepsiburada/N11 gibi pazaryerlerinde var mi?
- Pinterest, Houzz gibi ilham platformlarinda varlik.
- 3D gorselcilik, sanal showroom, AR deneyimi sunuyor mu?`,

  terminologyOverrides: {
    productLabel: 'Hangi URUN KATEGORILERI sunuyor? (mobilya, aydinlatma, seramik, banyo, mutfak, yapi malzemesi, dekorasyon vb.)',
    priceDetail: ' — urun fiyat araligi, proje bazli fiyatlama',
    positioningExamples: 'luks/premium/orta-ust/ekonomik/ithal-butik/yerli-uretim',
    competitorAnalysisLabel: 'RAKIP SHOWROOM/MARKA ANALIZI',
    competitorSearchExample: 'Ornek: Eger "modern mobilya showroom Istanbul" ise → "Istanbul mobilya magaza showroom en iyi" ara.',
    competitorMetrics: 'Rakip showroomlarin urun cesitliligi, fiyat segmenti, magaza sayisi ve musteri memnuniyetini karsilastir.',
    competitorStrengthsContext: 'urun kalitesi, tasarim, fiyat, showroom deneyimi, montaj/teslimat hizmeti, proje referanslari',
    marketDataFocus: 'Yapi/dekorasyon sektoru verileri: mobilya pazar buyuklugu, insaat/renovasyon trendleri, konut satislari etkisi.',
    audienceLabel: 'Bu showroomdan gercekte kimler alisveris yapiyor? Musteri segmentleri:',
    audienceDetails: [
      'Bireysel ev sahibi vs ic mimar vs muteahhit vs kurumsal proje.',
      'Renovasyon vs yeni ev dosen vs proje bazli.',
      'Karar sureci: showroom ziyareti, online arastirma, ic mimar tavsiyesi.',
    ],
    customerTerm: 'musteriler/proje sahipleri',
    websiteAnalysisFocus: 'Urun katalogu, gorsellestirme, proje referanslari, online siparis, showroom randevu.',
    researchType: 'YAPI & DEKORASYON BAZLI',
  },

  extraGroundingQueries: (businessName: string, dateRule: string) => [
    {
      prompt: `"${businessName}" showroom magaza yorum puan — Google Maps yorumlari, musteri deneyimi, urun kalitesi, montaj/teslimat memnuniyeti. Turkce yaz.${dateRule}`,
      label: 'SectorResearch-ShowroomReviews',
    },
    {
      prompt: `"${businessName}" mobilya dekorasyon urun fiyat — urun kategorileri, fiyat araligi, proje referanslari, ithalat/yerli uretim. Turkce yaz.${dateRule}`,
      label: 'SectorResearch-ProductPricing',
    },
  ],

  groundingPromptOverrides: {
    competitor: (businessName: string, dateRule: string) =>
      `Sen bir yapi/dekorasyon sektor arastirmacisisin. "${businessName}" ile ayni segment ve bolgedeki rakip showroom/markalari arastir. Her rakip icin: marka adi, urun kategorisi, fiyat segmenti, showroom sayisi, Google puani, guclu/zayif yanlar bul. EN AZ 3, EN FAZLA 7 rakip. Turkce yaz.${dateRule}`,
    market: (businessName: string, dateRule: string) =>
      `Sen bir yapi/dekorasyon pazar arastirmacisisin. "${businessName}" icin: Turkiye mobilya/dekorasyon pazar buyuklugu, insaat sektoru durumu, konut satislari, renovasyon trendleri, ihracat potansiyeli arastir. Somut rakamlar ver. Turkce yaz.${dateRule}`,
    trend: (businessName: string, dateRule: string) =>
      `Yapi/dekorasyon sektoru "${businessName}" icin: surdurulebilir/eko malzeme trendi, smart home teknolojisi, minimalist/modern tasarim akimlari, AR/3D gorselcilik, Pinterest/Instagram ilham etkisi, D2C online satis modeli. Turkce yaz.${dateRule}`,
  },

  extractionSchemaFragment: `,
  "showroomData": {
    "showroomProfile": {
      "locationCount": "Showroom/magaza sayisi",
      "locations": ["Konumlar"],
      "showroomSize": "Showroom buyuklugu tahmini (m2)",
      "concept": "Showroom konsepti (deneyim alani, ornek mekan vb.)"
    },
    "productPortfolio": {
      "categories": ["Urun kategorileri (mobilya, aydinlatma, seramik vb.)"],
      "sourceType": "Yerli uretim / ithalat / karma",
      "customization": "Ozel siparis/kisisellestirme imkani",
      "flagshipBrands": ["Tasidigi/urettigi ana markalar"]
    },
    "pricingAnalysis": {
      "priceSegment": "Luks / premium / orta-ust / ekonomik",
      "avgProjectSize": "Ortalama proje/siparis buyuklugu",
      "installationService": "Montaj/teslimat hizmeti var mi",
      "projectBasedPricing": "Proje bazli fiyatlama yapiyor mu"
    },
    "customerProfile": {
      "b2cVsB2b": "Bireysel vs kurumsal musteri orani",
      "primarySegments": ["Ana musteri segmentleri (ev sahibi, ic mimar, muteahhit)"],
      "referenceProjects": ["Referans projeler (otel, restoran, ofis vb.)"],
      "decisionProcess": "Karar sureci (showroom, online, ic mimar)"
    },
    "digitalCapability": {
      "hasEcommerce": "E-ticaret sitesi var mi",
      "marketplacePresence": ["Pazaryeri varligi (Trendyol, Hepsiburada vb.)"],
      "has3DVisualization": "3D gorselcilik / AR deneyimi var mi",
      "inspirationPlatforms": ["Ilham platformlari (Pinterest, Houzz vb.)"]
    },
    "reviewSentiment": {
      "positiveThemes": ["Olumlu yorum temalari — orn: tasarim, kalite, showroom deneyimi"],
      "negativeThemes": ["Olumsuz yorum temalari — orn: fiyat, teslimat suresi, montaj"],
      "overallSentiment": "Genel duygu tonu"
    }
  }`,

  extractionRules: `
6. YAPI/DEKORASYON VERILERINI AYRI CIKAR: showroomProfile, productPortfolio, pricingAnalysis, customerProfile, digitalCapability, reviewSentiment alanlarini doldur.
7. Showroom bilgileri (konum, buyukluk, konsept) metinde varsa MUTLAKA showroomData.showroomProfile'a ekle.
8. Urun portfoyu ve kaynak bilgisi varsa MUTLAKA showroomData.productPortfolio'ya ekle.
9. Musteri profili ve referans projeleri varsa MUTLAKA showroomData.customerProfile'a ekle.
10. Dijital yetenekler (e-ticaret, 3D, AR) bilgisi varsa MUTLAKA showroomData.digitalCapability'ye ekle.
11. showroomData icindeki her alan icin: veri bulunamadiysa "Veri bulunamadi" yaz, ALANI SILME.`,

  formatForSynthesizer: (sd: any): string => {
    if (!sd) return '';
    const parts: string[] = [];
    if (sd.showroomProfile) {
      parts.push(`Showroom: ${sd.showroomProfile.locationCount || '?'} lokasyon, Konsept: ${sd.showroomProfile.concept || 'N/A'}`);
    }
    if (sd.productPortfolio) {
      parts.push(`Urunler: ${sd.productPortfolio.categories?.join(', ') || 'N/A'}, Kaynak: ${sd.productPortfolio.sourceType || 'N/A'}, Ozel siparis: ${sd.productPortfolio.customization || 'N/A'}`);
    }
    if (sd.pricingAnalysis) {
      parts.push(`Fiyatlama: Segment: ${sd.pricingAnalysis.priceSegment || 'N/A'}, Ort. proje: ${sd.pricingAnalysis.avgProjectSize || 'N/A'}, Montaj: ${sd.pricingAnalysis.installationService || 'N/A'}`);
    }
    if (sd.customerProfile) {
      parts.push(`Musteri: B2C/B2B: ${sd.customerProfile.b2cVsB2b || 'N/A'}, Segmentler: ${sd.customerProfile.primarySegments?.join(', ') || 'N/A'}`);
      if (sd.customerProfile.referenceProjects?.length) parts.push(`  Referanslar: ${sd.customerProfile.referenceProjects.join(', ')}`);
    }
    if (sd.digitalCapability) {
      parts.push(`Dijital: E-ticaret: ${sd.digitalCapability.hasEcommerce || 'N/A'}, 3D/AR: ${sd.digitalCapability.has3DVisualization || 'N/A'}`);
    }
    if (sd.reviewSentiment) {
      if (sd.reviewSentiment.positiveThemes?.length) parts.push(`Olumlu temalar: ${sd.reviewSentiment.positiveThemes.join(', ')}`);
      if (sd.reviewSentiment.negativeThemes?.length) parts.push(`Olumsuz temalar: ${sd.reviewSentiment.negativeThemes.join(', ')}`);
    }
    if (!parts.length) return '';
    return `\n\n## Yapi & Dekorasyon Verileri (Sektor-Spesifik)\n${parts.join('\n')}`;
  },
};

registerSectorEnrichment(showroom);

export default showroom;
