import { registerSectorEnrichment } from './types';
import type { SectorEnrichmentModule } from './types';

const health: SectorEnrichmentModule = {
  sector: 'health',
  dataFieldName: 'healthData',

  culturalTensions: [
    {
      expectation: 'Doktor bilir, hasta dinler',
      reality: 'Hastalar Google\'dan araştırıp geliyor, ikinci görüş alıyor, otorite sorgulanıyor',
      opportunity: 'Bilgi paylaşarak güven inşa eden "eğitici uzman" konumlandırması',
    },
    {
      expectation: 'Sağlık hizmeti = tedavi',
      reality: 'İnsanlar artık "hasta olmadan sağlıklı kalmak" istiyor — wellness patlaması',
      opportunity: 'Tedaviden önlemeye geçiş: sağlıklı yaşam koçu olarak marka',
    },
    {
      expectation: 'Klinik ortam güven verir',
      reality: 'Beyaz duvarlar, soğuk koridorlar, antiseptik koku — hastalar stres ve anksiyete yaşıyor',
      opportunity: 'İyileştirici mekan tasarımı: otel konforu + klinik güveni = "healing experience"',
    },
    {
      expectation: 'Online sağlık bilgisi erişilebilir',
      reality: 'Dezenformasyon, sahte doktorlar, korkutucu içerikler — hasta güvenini sarıyor',
      opportunity: 'Güvenilir, bilimsel, erişilebilir içerik otoritesi olmak',
    },
    {
      expectation: 'Fiyat şeffaflığı bekleniyor',
      reality: 'Sağlık hizmetlerinde fiyat belirsizliği en büyük şikayet konusu',
      opportunity: 'Radikal fiyat şeffaflığı — "ne ödeyeceğinizi bilirsiniz" güveni',
    },
  ],

  frameworkReferences: ['Keller CBBE', 'Cialdini (Authority)', 'Fogg B=MAP', 'Kano Model'],
  culturalBrandingLens: 'Geleneksel tıp vs modern yaklaşım, "doktora güven" erozyonu, sağlık turizmi fırsatı',

  deepResearchSteps: `

ADIM 6 — HASTA/DANISAN YORUMLARI & ITIBAR (SAGLIGA OZEL):
- "$BUSINESS_NAME" kurumunu Google Maps, Doktorsitesi.com, Doktortakvimi, Sikayetvar'da ara.
- Her platformdaki PUAN ve YORUM SAYISINI bul.
- Olumlu ve olumsuz yorumlardaki TEKRARLAYAN TEMALARI cikart (doktor ilgisi, bekleme suresi, temizlik, fiyat vb.).
- Kadro bilgisi: kac doktor/uzman var, uzmanlik alanlari.

ADIM 7 — HIZMET & FIYATLAMA ANALIZI (SAGLIGA OZEL):
- "$BUSINESS_NAME" hangi hizmetleri sunuyor? (poliklinik, cerrahi, estetik, dis, goz, fizik tedavi, wellness vb.)
- Ozel/SGK/Anlasmali sigorta durumu.
- Fiyat politikasi: seffaf fiyat aciklama var mi? Ortalama islem fiyatlari (varsa).
- Paket hizmetler (check-up, estetik paket vb.) sunuluyor mu?

ADIM 8 — HASTA PROFILI & ERISIM (SAGLIGA OZEL):
- Hasta profili: yerli vs medikal turizm, yas grubu, cinsiyet dagilimi.
- Medikal turizm yapiyorsa: hangi ulkelerden hasta geliyor? Disariya yonelik pazarlama var mi?
- Online randevu sistemi var mi? Hangi platform?
- Tele-tip / online konsultasyon sunuyor mu?

ADIM 9 — REGULATOR & SERTIFIKASYON (SAGLIGA OZEL):
- JCI, ISO, Saglik Bakanligi akreditasyon durumu.
- Saglik Bakanligi reklam ve tanitim yasaklarina uyum durumu.
- Ozel hastane ruhsat durumu.
- Universite/akademik isbirlikleri var mi?`,

  terminologyOverrides: {
    productLabel: 'Hangi SAGLIK HIZMETLERI sunuyor? (poliklinik, cerrahi, estetik, dis, goz, wellness, fizik tedavi vb.)',
    priceDetail: ' — islem/paket fiyatlari, SGK/ozel sigorta anlasmasi',
    positioningExamples: 'premium-ozel/butik-klinik/hastane-zinciri/wellness-merkezi/medikal-turizm',
    competitorAnalysisLabel: 'RAKIP SAGLIK KURULUSU ANALIZI',
    competitorSearchExample: 'Ornek: Eger "estetik cerrahi klinik Istanbul" ise → "Istanbul estetik cerrahi en iyi klinikler" ara.',
    competitorMetrics: 'Rakip kuruluslarin doktor kadrosu, hizmet cesitliligi, fiyat ve hasta memnuniyet puanlarini karsilastir.',
    competitorStrengthsContext: 'doktor kadrosu, teknoloji/cihaz altyapisi, hasta deneyimi, fiyat, konum, sigorta anlasmasi',
    marketDataFocus: 'Saglik sektoru verileri: ozel saglik pazari buyuklugu, medikal turizm gelirleri, saglik harcama trendleri.',
    audienceLabel: 'Bu saglik kurulusunun gercek hasta/danisan profili:',
    audienceDetails: [
      'Yas, cinsiyet, gelir grubu, yerli vs yabanci hasta orani.',
      'Basvuru nedeni: tedavi, estetik, check-up, kronik hastalik takibi.',
      'Karar sureci: doktor tavsiyesi, online arastirma, sigorta yonlendirmesi.',
    ],
    customerTerm: 'hastalar/danisanlar',
    websiteAnalysisFocus: 'Doktor kadrosu, hizmet listesi, online randevu, hasta yorumlari, blog/saglik icerigi.',
    researchType: 'SAGLIK BAZLI',
  },

  extraGroundingQueries: (businessName: string, dateRule: string) => [
    {
      prompt: `"${businessName}" klinik hastane yorum puan doktor — Google, Doktorsitesi, Doktortakvimi puanlari, hasta yorumlari, doktor kadrosu. Turkce yaz.${dateRule}`,
      label: 'SectorResearch-PatientReviews',
    },
    {
      prompt: `"${businessName}" saglik hizmet fiyat paket — tedavi fiyatlari, check-up paketleri, sigorta anlasmasi, medikal turizm. Turkce yaz.${dateRule}`,
      label: 'SectorResearch-HealthPricing',
    },
  ],

  groundingPromptOverrides: {
    competitor: (businessName: string, dateRule: string) =>
      `Sen bir saglik sektoru arastirmacisisin. "${businessName}" ile ayni bolge ve uzmanliktaki rakip saglik kuruluslarini arastir. Her rakip icin: kurum adi, uzmanlik alani, doktor sayisi, Google puani, fiyat segmenti, guclu/zayif yanlar bul. EN AZ 3, EN FAZLA 7 rakip. Turkce yaz.${dateRule}`,
    market: (businessName: string, dateRule: string) =>
      `Sen bir saglik pazar arastirmacisisin. "${businessName}" icin: Turkiye ozel saglik pazari buyuklugu, medikal turizm geliri, saglik harcama trendleri, ozel sigorta penetrasyonu, dijital saglik buyumesi arastir. Somut rakamlar ver. Turkce yaz.${dateRule}`,
    trend: (businessName: string, dateRule: string) =>
      `Saglik sektoru "${businessName}" icin: tele-tip/online konsultasyon, AI destekli teshis, hasta deneyimi dijitallesmesi, medikal turizm trendleri, wellness/preventif saglik buyumesi, saglik icerigi pazarlamasi. Turkce yaz.${dateRule}`,
  },

  extractionSchemaFragment: `,
  "healthData": {
    "reviewScores": {
      "google": { "score": "Google puani", "reviewCount": "Yorum sayisi" },
      "doktorsitesi": { "score": "Doktorsitesi puani", "reviewCount": "Yorum sayisi" },
      "doktortakvimi": { "score": "Doktortakvimi puani", "reviewCount": "Yorum sayisi" }
    },
    "serviceProfile": {
      "specialties": ["Uzmanlik alanlari"],
      "doctorCount": "Doktor/uzman sayisi",
      "keyServices": ["Ana hizmetler"],
      "packageServices": ["Paket hizmetler (check-up, estetik paket vb.)"]
    },
    "pricingModel": {
      "insuranceContracts": ["Anlasmali sigortalar"],
      "sgkAccepted": "SGK kabul var mi",
      "priceTransparency": "Web sitesinde fiyat aciklama var mi",
      "avgServicePrice": "Ortalama islem fiyati (varsa)"
    },
    "patientProfile": {
      "domesticVsInternational": "Yerli vs yabanci hasta orani",
      "primaryAgeGroup": "Birincil yas grubu",
      "topReasons": ["Basvuru nedenleri"],
      "medicalTourism": "Medikal turizm yapıyor mu"
    },
    "accreditation": {
      "jci": "JCI akreditasyonu var mi",
      "isoStandards": ["ISO standartlari"],
      "ministryLicense": "Saglik Bakanligi ruhsat durumu",
      "academicAffiliations": ["Universite isbirlikleri"]
    },
    "reviewSentiment": {
      "positiveThemes": ["Olumlu yorum temalari — orn: doktor ilgisi, temizlik, sonuc"],
      "negativeThemes": ["Olumsuz yorum temalari — orn: bekleme, fiyat, iletisim"],
      "overallSentiment": "Genel duygu tonu"
    }
  }`,

  extractionRules: `
6. SAGLIK VERILERINI AYRI CIKAR: reviewScores, serviceProfile, pricingModel, patientProfile, accreditation, reviewSentiment alanlarini doldur.
7. Google, Doktorsitesi puanlari metinde varsa MUTLAKA healthData.reviewScores'a ekle.
8. Hizmet listesi ve doktor kadrosu bilgisi varsa MUTLAKA healthData.serviceProfile'a ekle.
9. Hasta profili (yerli/yabanci, medikal turizm) bilgisi varsa MUTLAKA healthData.patientProfile'a ekle.
10. Akreditasyon ve sertifika bilgileri varsa MUTLAKA healthData.accreditation'a ekle.
11. healthData icindeki her alan icin: veri bulunamadiysa "Veri bulunamadi" yaz, ALANI SILME.`,

  formatForSynthesizer: (hd: any): string => {
    if (!hd) return '';
    const parts: string[] = [];
    if (hd.reviewScores) {
      const scores: string[] = [];
      if (hd.reviewScores.google?.score) scores.push(`Google: ${hd.reviewScores.google.score} (${hd.reviewScores.google.reviewCount || '?'} yorum)`);
      if (hd.reviewScores.doktorsitesi?.score) scores.push(`Doktorsitesi: ${hd.reviewScores.doktorsitesi.score}`);
      if (hd.reviewScores.doktortakvimi?.score) scores.push(`Doktortakvimi: ${hd.reviewScores.doktortakvimi.score}`);
      if (scores.length) parts.push(`Degerlendirmeler: ${scores.join(', ')}`);
    }
    if (hd.serviceProfile) {
      parts.push(`Hizmetler: ${hd.serviceProfile.keyServices?.join(', ') || 'N/A'}, Doktor: ${hd.serviceProfile.doctorCount || 'N/A'}`);
      if (hd.serviceProfile.specialties?.length) parts.push(`  Uzmanliklar: ${hd.serviceProfile.specialties.join(', ')}`);
    }
    if (hd.pricingModel) {
      parts.push(`Fiyatlama: SGK: ${hd.pricingModel.sgkAccepted || 'N/A'}, Sigorta: ${hd.pricingModel.insuranceContracts?.join(', ') || 'N/A'}`);
    }
    if (hd.patientProfile) {
      parts.push(`Hasta Profili: Yerli/Yabanci: ${hd.patientProfile.domesticVsInternational || 'N/A'}, Medikal turizm: ${hd.patientProfile.medicalTourism || 'N/A'}`);
    }
    if (hd.accreditation) {
      const creds: string[] = [];
      if (hd.accreditation.jci) creds.push(`JCI: ${hd.accreditation.jci}`);
      if (hd.accreditation.isoStandards?.length) creds.push(`ISO: ${hd.accreditation.isoStandards.join(', ')}`);
      if (creds.length) parts.push(`Akreditasyon: ${creds.join(', ')}`);
    }
    if (hd.reviewSentiment) {
      if (hd.reviewSentiment.positiveThemes?.length) parts.push(`Olumlu temalar: ${hd.reviewSentiment.positiveThemes.join(', ')}`);
      if (hd.reviewSentiment.negativeThemes?.length) parts.push(`Olumsuz temalar: ${hd.reviewSentiment.negativeThemes.join(', ')}`);
    }
    if (!parts.length) return '';
    return `\n\n## Saglik Verileri (Sektor-Spesifik)\n${parts.join('\n')}`;
  },
};

registerSectorEnrichment(health);

export default health;
