import { registerSectorEnrichment } from './types';
import type { SectorEnrichmentModule } from './types';

const corporate: SectorEnrichmentModule = {
  sector: 'corporate',
  dataFieldName: 'corporateData',

  culturalTensions: [
    {
      expectation: 'Kurumsal = güvenilir ve ciddi',
      reality: 'Kurumsal iletişim robotik, ruhsuz ve birbirinin kopyası — kimse okumuyor',
      opportunity: 'Kurumsal ciddiyeti kaybetmeden insan gibi konuşan marka sesi',
    },
    {
      expectation: 'B2B karar sürecinde sadece rasyonel kriterler etkili',
      reality: 'Araştırmalar B2B alıcıların %71\'inin duygusal bağ kurduğu markayı seçtiğini gösteriyor',
      opportunity: 'B2B\'de duygusal hikaye anlatımı: "İşinizi büyütüyoruz" yerine "gece rahat uyumanızı sağlıyoruz"',
    },
    {
      expectation: 'LinkedIn varlığı = dijital dönüşüm',
      reality: 'Çoğu kurumsal LinkedIn hesabı PR bülteni paylaşıyor, kimse etkileşime girmiyor',
      opportunity: 'Thought leadership: gerçek içgörü paylaşan, sektörü şekillendiren görünürlük',
    },
    {
      expectation: 'Holding/grup yapısı güç göstergesi',
      reality: 'Yeni nesil müşteriler monolitik yapıları hantal ve yavaş buluyor',
      opportunity: 'Büyüklüğü çeviklik ve erişilebilirlik hikayesiyle dengelemek',
    },
    {
      expectation: 'İtibar yıllar içinde inşa edilir',
      reality: 'Bir kriz tweeti itibarı saatler içinde yıkabiliyor',
      opportunity: 'Proaktif itibar yönetimi: kriz olmadan önce güven bankası oluşturmak',
    },
  ],

  frameworkReferences: ['Keller CBBE', 'Aaker Identity', 'Cialdini (Authority)', 'Blue Ocean'],
  culturalBrandingLens: 'Dijital dönüşüm baskısı, "butik ajans vs büyük kurum" tercihi, uzaktan çalışma etkisi',

  deepResearchSteps: `

ADIM 6 — KURUMSAL ITIBAR & MEDYA VARLIGI (KURUMSALA OZEL):
- "$BUSINESS_NAME" firmasini ticaret sicil, Turkiye'deki sektor dernekleri ve is dunyasi haberleri kaynaklarinda ara.
- Medya gorunurlugu: son 1 yilda kac haber/basin bulteni yayinlanmis?
- Oduller, sertifikalar, uyelikler (ISO, TSE, TUSIAD, DEIK, sanayi odasi vb.).
- LinkedIn sirket sayfasi: calisan sayisi, takipci sayisi, paylasim sikligi.

ADIM 7 — B2B MUSTERI PORTFOYU & REFERANSLAR (KURUMSALA OZEL):
- "$BUSINESS_NAME" referans musterileri/projeleri hangi sektorlerden?
- Buyuk musteriler/projeler acikca paylasiliyor mu? (case study, logo wall)
- Ihracat yapiyorsa hangi ulkelere? Yurt disi faaliyetleri.
- Is ortakliklari, distributorluk, bayilik agi var mi?

ADIM 8 — SEKTOR KONUMLANDIRMA & REKABET (KURUMSALA OZEL):
- Sektor icindeki konumu: pazar lideri mi, challenger mi, nis oyuncu mu?
- Toplam calisan sayisi, ciro buyuklugu (aciklanan bilgiler).
- Rakiplere gore teknoloji/inovasyon durumu.
- Devlet ihaleleri, kamu projeleri katilimi var mi?

ADIM 9 — DIJITAL OLGUNLUK & LEAD GENERATION (KURUMSALA OZEL):
- Web sitesi B2B odakli mi? Lead formu, demo talebi, teklif isteme var mi?
- Content marketing: blog, whitepaper, webinar, case study uretimi.
- SEO durumu: sektordeki anahtar kelimelerde siralamalari.
- CRM/Marketing automation kullaniyor mu?`,

  terminologyOverrides: {
    productLabel: 'Hangi URUN/HIZMET ve COZUMLERI sunuyor? (danismanlik, uretim, yazilim, lojistik, dis ticaret vb.)',
    priceDetail: ' — proje bazli fiyatlama, abonelik modeli, teklif bazli',
    positioningExamples: 'pazar-lideri/challenger/nis-uzman/butik-danismanlik/enterprise',
    competitorAnalysisLabel: 'RAKIP FIRMA/KURUM ANALIZI',
    competitorSearchExample: 'Ornek: Eger "insaat malzemesi uretici" ise → "Turkiye insaat malzemesi uretim firmalari" ara.',
    competitorMetrics: 'Rakip firmalarin ciro, calisan sayisi, musteri portfoyu ve pazar payini karsilastir.',
    competitorStrengthsContext: 'teknoloji, inovasyon, musteri portfoyu, maliyet avantaji, marka itibar, is ortakliklari',
    marketDataFocus: 'Sektorun Turkiye pazar buyuklugu, ihracat potansiyeli, buyume trendleri, regulator ortam.',
    audienceLabel: 'Bu firmanin hizmetlerini/urunlerini gercekte kimler satin aliyor? Musteri segmentleri:',
    audienceDetails: [
      'B2B musteri profili: KOBi mi, enterprise mi, kamu mu? Hangi sektorlerden?',
      'Karar verici profili: CEO, CTO, satin alma muduru, operasyon muduru.',
      'Satin alma sureci: ihale, teklif karsilastirma, referans bazli, uzun satis dongusu.',
    ],
    customerTerm: 'musteriler/is ortaklari',
    websiteAnalysisFocus: 'Kurumsal tanitim, hizmet/urun sayfasi derinligi, referanslar, iletisim/teklif formu, blog/icerik.',
    researchType: 'KURUMSAL/B2B BAZLI',
  },

  extraGroundingQueries: (businessName: string, dateRule: string) => [
    {
      prompt: `"${businessName}" firma kurumsal profil calisan sayisi referanslar sertifikalar — sektordeki konumu, oduller, is ortakliklari. Turkce yaz.${dateRule}`,
      label: 'SectorResearch-Corporate',
    },
    {
      prompt: `"${businessName}" B2B musteri portfoy ihracat projeler — buyuk musteriler, projeler, sektor dagilimi. Turkce yaz.${dateRule}`,
      label: 'SectorResearch-Portfolio',
    },
  ],

  groundingPromptOverrides: {
    competitor: (businessName: string, dateRule: string) =>
      `Sen bir B2B/kurumsal sektor arastirmacisisin. "${businessName}" ile ayni sektorde rekabet eden firmalari arastir. Her rakip icin: firma adi, web sitesi, ciro tahmini, calisan sayisi, pazar payi, guclu/zayif yanlar bul. EN AZ 3, EN FAZLA 7 rakip. Turkce yaz.${dateRule}`,
    market: (businessName: string, dateRule: string) =>
      `Sen bir B2B pazar arastirmacisisin. "${businessName}" firmasinin faaliyet gosterdigi sektor icin: Turkiye pazar buyuklugu, buyume orani, ihracat potansiyeli, regulator gelismeler, yatirim trendleri arastir. Somut rakamlar ver. Turkce yaz.${dateRule}`,
    trend: (businessName: string, dateRule: string) =>
      `Kurumsal/B2B sektoru "${businessName}" icin: dijital donusum trendleri, AI/otomasyon benimseme, surdurulebilirlik/ESG gereksinimleri, uzaktan calisma etkisi, tedarik zinciri degisimleri, B2B dijital pazarlama trendleri (LinkedIn, content marketing, ABM). Turkce yaz.${dateRule}`,
  },

  extractionSchemaFragment: `,
  "corporateData": {
    "companyProfile": {
      "employeeCount": "Calisan sayisi tahmini",
      "foundedYear": "Kurulus yili",
      "revenueEstimate": "Ciro tahmini (varsa)",
      "certifications": ["Sertifikalar, uyelikler (ISO, TSE vb.)"],
      "awards": ["Oduller (varsa)"]
    },
    "marketPosition": {
      "positionType": "Pazar lideri / challenger / nis oyuncu",
      "marketShare": "Pazar payi tahmini (varsa)",
      "exportMarkets": ["Ihracat pazarlari (varsa)"],
      "keyPartnerships": ["Is ortakliklari / distributorlukler"]
    },
    "clientPortfolio": {
      "targetSectors": ["Hedef musteri sektorleri"],
      "clientSize": "KOBi / Enterprise / Kamu",
      "referenceClients": ["Bilinen referans musteriler"],
      "caseStudies": "Case study / referans icerik var mi"
    },
    "digitalMaturity": {
      "hasLeadForm": "Lead formu / demo talebi var mi",
      "contentMarketing": "Blog, whitepaper, webinar uretimi durumu",
      "linkedInPresence": "LinkedIn calisan/takipci sayisi",
      "crmUsage": "CRM/Marketing automation kullanimi"
    },
    "reviewSentiment": {
      "positiveThemes": ["Olumlu degerlendirme temalari — orn: uzmanlık, zamanında teslimat"],
      "negativeThemes": ["Olumsuz degerlendirme temalari — orn: fiyat, iletisim"],
      "overallSentiment": "Genel itibar tonu"
    }
  }`,

  extractionRules: `
6. KURUMSAL VERILERI AYRI CIKAR: companyProfile, marketPosition, clientPortfolio, digitalMaturity, reviewSentiment alanlarini doldur.
7. Firma profili (calisan, ciro, sertifika) bilgisi metinde varsa MUTLAKA corporateData.companyProfile'a ekle.
8. Pazar konumu ve is ortakliklari bilgisi varsa MUTLAKA corporateData.marketPosition'a ekle.
9. Musteri portfoyu ve referans bilgileri varsa MUTLAKA corporateData.clientPortfolio'ya ekle.
10. Dijital olgunluk (lead form, content, LinkedIn) bilgisi varsa MUTLAKA corporateData.digitalMaturity'ye ekle.
11. corporateData icindeki her alan icin: veri bulunamadiysa "Veri bulunamadi" yaz, ALANI SILME.`,

  formatForSynthesizer: (cd: any): string => {
    if (!cd) return '';
    const parts: string[] = [];
    if (cd.companyProfile) {
      parts.push(`Firma Profili: ${cd.companyProfile.employeeCount || '?'} calisan, Kurulus: ${cd.companyProfile.foundedYear || 'N/A'}, Ciro: ${cd.companyProfile.revenueEstimate || 'N/A'}`);
      if (cd.companyProfile.certifications?.length) parts.push(`  Sertifikalar: ${cd.companyProfile.certifications.join(', ')}`);
    }
    if (cd.marketPosition) {
      parts.push(`Pazar Konumu: ${cd.marketPosition.positionType || 'N/A'}, Pazar payi: ${cd.marketPosition.marketShare || 'N/A'}`);
      if (cd.marketPosition.exportMarkets?.length) parts.push(`  Ihracat: ${cd.marketPosition.exportMarkets.join(', ')}`);
    }
    if (cd.clientPortfolio) {
      parts.push(`Musteri Portfoyu: ${cd.clientPortfolio.targetSectors?.join(', ') || 'N/A'}, Buyukluk: ${cd.clientPortfolio.clientSize || 'N/A'}`);
      if (cd.clientPortfolio.referenceClients?.length) parts.push(`  Referanslar: ${cd.clientPortfolio.referenceClients.join(', ')}`);
    }
    if (cd.digitalMaturity) {
      parts.push(`Dijital Olgunluk: Lead form: ${cd.digitalMaturity.hasLeadForm || 'N/A'}, Content: ${cd.digitalMaturity.contentMarketing || 'N/A'}, LinkedIn: ${cd.digitalMaturity.linkedInPresence || 'N/A'}`);
    }
    if (cd.reviewSentiment) {
      if (cd.reviewSentiment.positiveThemes?.length) parts.push(`Olumlu temalar: ${cd.reviewSentiment.positiveThemes.join(', ')}`);
      if (cd.reviewSentiment.negativeThemes?.length) parts.push(`Olumsuz temalar: ${cd.reviewSentiment.negativeThemes.join(', ')}`);
    }
    if (!parts.length) return '';
    return `\n\n## Kurumsal/B2B Verileri (Sektor-Spesifik)\n${parts.join('\n')}`;
  },
};

registerSectorEnrichment(corporate);

export default corporate;
