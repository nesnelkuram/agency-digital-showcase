import { registerSectorEnrichment } from './types';
import type { SectorEnrichmentModule } from './types';

const education: SectorEnrichmentModule = {
  sector: 'education',
  dataFieldName: 'educationData',

  culturalTensions: [
    {
      expectation: 'Diploma = başarı garantisi',
      reality: 'Üniversite mezunları iş bulamıyor, sertifika enflasyonu, beceri açığı artıyor',
      opportunity: '"Diploma değil, beceri" vaadi — çıktı odaklı eğitim markası',
    },
    {
      expectation: 'Online eğitim = kaliteli ve erişilebilir',
      reality: 'Tamamlama oranları %5-15, motivasyon düşük, "kurs mezarlığı" olgusu',
      opportunity: 'Tamamlama garantili, topluluk destekli, hesap verebilir eğitim modeli',
    },
    {
      expectation: 'Eğitim çocuklar/gençler içindir',
      reality: 'Hayat boyu öğrenme zorunlu hale geldi, yetişkin eğitimi patlıyor',
      opportunity: 'Yaşa değil, dönüşüme odaklanan "kim olursanız olun, başlayabilirsiniz" markası',
    },
    {
      expectation: 'Daha fazla içerik = daha iyi eğitim',
      reality: 'Bilgi fazlalığı, dikkat süresi düşüşü — öğrenci bunalıyor',
      opportunity: 'Less is more: küratörlenmiş, odaklı, uygulamalı öğrenme deneyimi',
    },
    {
      expectation: 'İyi öğretmen yeterli',
      reality: 'Öğrenme deneyimi, topluluk, akran etkileşimi en az öğretmen kadar önemli',
      opportunity: 'Öğrenme topluluğu inşası — öğrenci yalnız değil, bir grubun parçası',
    },
  ],

  deepResearchSteps: `

ADIM 6 — OGRENCI/VELI YORUMLARI & ITIBAR (EGITIME OZEL):
- "$BUSINESS_NAME" kurumunu Google Maps, Sikayetvar, egitim forumlari ve sosyal medyada ara.
- Puan ve yorum sayilarini bul.
- Olumlu ve olumsuz yorumlardaki TEKRARLAYAN TEMALARI cikart (egitim kalitesi, ogretmen kadrosu, fiyat, tesisler vb.).
- Mezun basari hikayeleri, yerlestime/istihdam oranlari (varsa).

ADIM 7 — PROGRAM & FIYATLAMA ANALIZI (EGITIME OZEL):
- "$BUSINESS_NAME" hangi egitim programlarini/kurslarini sunuyor?
- Program fiyatlari ve odeme secenekleri.
- Online vs yuz yuze egitim orani.
- Sertifika/diploma/akreditasyon durumu (MEB, YOK, uluslararasi).
- Taksit, burs, erken kayit indirimi var mi?

ADIM 8 — OGRENCI PROFILI & KAYIT SURECI (EGITIME OZEL):
- Hedef ogrenci/katilimci profili: yas grubu, meslek, egitim seviyesi.
- Kayit donemi ve kontenjan bilgileri.
- Ogrenci sayisi/kapasite tahmini.
- Yabanci ogrenci/katilimci kabul ediyor mu?

ADIM 9 — EGITIM TEKNOLOJISI & ICERIK (EGITIME OZEL):
- LMS (Learning Management System) kullaniyor mu? Hangi platform?
- Online kurs platformlarinda var mi? (Udemy, Coursera, kendi platformu)
- Icerik uretimi: blog, YouTube, podcast, e-kitap.
- Ogretmen/egitimci kadrosu ve nitelikleri.`,

  terminologyOverrides: {
    productLabel: 'Hangi EGITIM PROGRAMLARI/KURSLARI sunuyor? (dil egitimi, mesleki egitim, universite hazirlik, cocuk gelisim, online kurs vb.)',
    priceDetail: ' — kurs/program ucreti, donem bazli fiyatlama',
    positioningExamples: 'premium-okul/butik-akademi/online-platform/franchise-egitim/kurumsal-egitim',
    competitorAnalysisLabel: 'RAKIP EGITIM KURULUSU ANALIZI',
    competitorSearchExample: 'Ornek: Eger "ingilizce kursu Ankara" ise → "Ankara ingilizce dil kursu en iyi" ara.',
    competitorMetrics: 'Rakip kurumlarin fiyat, program cesitliligi, ogrenci memnuniyet puanlari ve yerlestime oranlarini karsilastir.',
    competitorStrengthsContext: 'egitim kalitesi, ogretmen kadrosu, fiyat, konum, sertifika gecerliligi, mezun basarisi',
    marketDataFocus: 'Egitim sektoru verileri: ozel egitim pazar buyuklugu, online egitim buyumesi, kisi basi egitim harcamasi.',
    audienceLabel: 'Bu egitim kurumuna gercekte kimler kayit yaptiriyor? Ogrenci/katilimci profili:',
    audienceDetails: [
      'Yas grubu, egitim seviyesi, meslek (ogrenci/calisan/kariyer degistiren).',
      'Motivasyon: sertifika, kariyer gelisim, sinav hazirlik, hobi.',
      'Odeme yapan: bireysel mi, kurumsal mi, veli mi? Fiyat hassasiyeti.',
    ],
    customerTerm: 'ogrenciler/katilimcilar',
    websiteAnalysisFocus: 'Program listesi, fiyat bilgisi, online kayit, demo ders, basari hikayeleri, blog/icerik.',
    researchType: 'EGITIM BAZLI',
  },

  extraGroundingQueries: (businessName: string, dateRule: string) => [
    {
      prompt: `"${businessName}" egitim kurumu kurs yorum puan — Google yorumlari, ogrenci memnuniyeti, ogretmen kadrosu, basari orani. Turkce yaz.${dateRule}`,
      label: 'SectorResearch-StudentReviews',
    },
    {
      prompt: `"${businessName}" egitim program fiyat kurs ucreti — fiyat listesi, burs imkanlari, online egitim secenekleri, sertifika. Turkce yaz.${dateRule}`,
      label: 'SectorResearch-EduPricing',
    },
  ],

  groundingPromptOverrides: {
    competitor: (businessName: string, dateRule: string) =>
      `Sen bir egitim sektoru arastirmacisisin. "${businessName}" ile ayni alanda rekabet eden egitim kurumlarini arastir. Her rakip icin: kurum adi, program cesitliligi, fiyat araligi, Google puani, ogrenci sayisi tahmini, guclu/zayif yanlar bul. EN AZ 3, EN FAZLA 7 rakip. Turkce yaz.${dateRule}`,
    market: (businessName: string, dateRule: string) =>
      `Sen bir egitim pazar arastirmacisisin. "${businessName}" icin: Turkiye ozel egitim pazar buyuklugu, online egitim buyume orani, kisi basi egitim harcamasi, mesleki egitim trendleri arastir. Somut rakamlar ver. Turkce yaz.${dateRule}`,
    trend: (businessName: string, dateRule: string) =>
      `Egitim sektoru "${businessName}" icin: online/hibrit egitim modelleri, AI destekli kisisellesmis ogrenme, mikro-sertifika trendleri, gamification, lifelong learning, egitim teknolojisi (EdTech) yatirimlari. Turkce yaz.${dateRule}`,
  },

  extractionSchemaFragment: `,
  "educationData": {
    "reviewScores": {
      "google": { "score": "Google puani", "reviewCount": "Yorum sayisi" }
    },
    "programProfile": {
      "programs": ["Sunulan egitim programlari/kurslari"],
      "deliveryMode": "Online / yuz yuze / hibrit",
      "accreditation": ["Akreditasyonlar (MEB, YOK, uluslararasi)"],
      "certificates": ["Verilen sertifika/diploma turleri"]
    },
    "pricingModel": {
      "priceRange": { "low": "En dusuk program ucreti", "high": "En yuksek program ucreti" },
      "paymentOptions": ["Odeme secenekleri (taksit, burs, erken kayit)"],
      "freeTrialLesson": "Ucretsiz deneme dersi var mi"
    },
    "studentProfile": {
      "targetAgeGroup": "Hedef yas grubu",
      "studentCount": "Ogrenci/katilimci sayisi tahmini",
      "primaryMotivation": "Ana motivasyon (kariyer, sinav, sertifika, hobi)",
      "internationalStudents": "Yabanci ogrenci var mi"
    },
    "edTechCapability": {
      "lmsUsed": "LMS platformu (varsa)",
      "onlineCoursePresence": "Online kurs platformlari",
      "contentProduction": "Icerik uretimi (blog, YouTube, podcast)",
      "facultySize": "Ogretmen/egitimci kadrosu sayisi"
    },
    "reviewSentiment": {
      "positiveThemes": ["Olumlu yorum temalari — orn: ogretmen kalitesi, icerik, ortam"],
      "negativeThemes": ["Olumsuz yorum temalari — orn: fiyat, yogunluk, park yeri"],
      "overallSentiment": "Genel duygu tonu"
    }
  }`,

  extractionRules: `
6. EGITIM VERILERINI AYRI CIKAR: reviewScores, programProfile, pricingModel, studentProfile, edTechCapability, reviewSentiment alanlarini doldur.
7. Google yorumlari ve puanlari metinde varsa MUTLAKA educationData.reviewScores'a ekle.
8. Program listesi ve akreditasyon bilgisi varsa MUTLAKA educationData.programProfile'a ekle.
9. Fiyat ve odeme secenekleri varsa MUTLAKA educationData.pricingModel'e ekle.
10. Ogrenci profili ve sayisi bilgisi varsa MUTLAKA educationData.studentProfile'a ekle.
11. educationData icindeki her alan icin: veri bulunamadiysa "Veri bulunamadi" yaz, ALANI SILME.`,

  formatForSynthesizer: (ed: any): string => {
    if (!ed) return '';
    const parts: string[] = [];
    if (ed.reviewScores?.google?.score) {
      parts.push(`Google Puan: ${ed.reviewScores.google.score} (${ed.reviewScores.google.reviewCount || '?'} yorum)`);
    }
    if (ed.programProfile) {
      parts.push(`Programlar: ${ed.programProfile.programs?.join(', ') || 'N/A'}, Mod: ${ed.programProfile.deliveryMode || 'N/A'}`);
      if (ed.programProfile.accreditation?.length) parts.push(`  Akreditasyon: ${ed.programProfile.accreditation.join(', ')}`);
    }
    if (ed.pricingModel) {
      parts.push(`Fiyatlama: ${ed.pricingModel.priceRange?.low || '?'} — ${ed.pricingModel.priceRange?.high || '?'}, Deneme: ${ed.pricingModel.freeTrialLesson || 'N/A'}`);
    }
    if (ed.studentProfile) {
      parts.push(`Ogrenci: ${ed.studentProfile.studentCount || '?'} kisi, Yas: ${ed.studentProfile.targetAgeGroup || 'N/A'}, Motivasyon: ${ed.studentProfile.primaryMotivation || 'N/A'}`);
    }
    if (ed.edTechCapability) {
      parts.push(`EdTech: LMS: ${ed.edTechCapability.lmsUsed || 'N/A'}, Icerik: ${ed.edTechCapability.contentProduction || 'N/A'}, Kadro: ${ed.edTechCapability.facultySize || 'N/A'}`);
    }
    if (ed.reviewSentiment) {
      if (ed.reviewSentiment.positiveThemes?.length) parts.push(`Olumlu temalar: ${ed.reviewSentiment.positiveThemes.join(', ')}`);
      if (ed.reviewSentiment.negativeThemes?.length) parts.push(`Olumsuz temalar: ${ed.reviewSentiment.negativeThemes.join(', ')}`);
    }
    if (!parts.length) return '';
    return `\n\n## Egitim Verileri (Sektor-Spesifik)\n${parts.join('\n')}`;
  },
};

registerSectorEnrichment(education);

export default education;
