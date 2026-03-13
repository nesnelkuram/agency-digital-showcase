import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'intiba-ab4bd' });
}
const db = admin.firestore();

async function main() {
  const timestamp = Date.now();
  const submissionId = `BS-${timestamp}`;

  // DesignFloor wizard answers — mapped to showroom sector questions
  // Questions are built by buildQuestions.ts: 1 intro + 1 ctx intro + 8 ctx questions + 5×(1 intro + 3 questions + 1 edu + 1 result) + 1 outro
  // Question IDs start at 1, incrementing
  // IDs 1-2: intros, 3-10: business context, 11: stage0 intro, 12-14: stage0 questions, 15: edu, 16: result, etc.

  const answers = {
    // Stage 0 questions (IDs 12, 13, 14) — Operasyonel Gerçeklik
    12: 'mostly',           // Showroom-Saha Tutarlılığı: Büyük ölçüde tutarlı
    13: 'mostly_holds',     // Yoğun Dönem: Çoğunlukla dayanıyor
    14: 'partially',        // Talep Artışı: Kısmen karşılarız

    // Stage 1 questions (IDs 18, 19, 20) — Marka Ruhu
    18: 'quality_assurance', // Kayıp Duygusu: Kalite güvencesi
    19: 'product_consulting', // Deneyim Seviyesi: Ürün + Danışmanlık
    20: 'premium',           // Fiyat-Değer: Premium

    // Stage 2 questions (IDs 24, 25, 26) — Marka Karakteri
    24: 'explain',          // Kriz Tepkisi: Analiz eder (Bilge)
    25: 'technical',        // İkna Yöntemi: Teknik uzmanlık
    26: 'expert',           // Ton: Uzman ve eğitici

    // Stage 3 questions (IDs 30, 31, 32) — Kim Değiliz
    30: 'price_only',       // Zararlı Müşteri: Sadece fiyat soran
    31: 'profitability',    // Sorun Tipi: Kârlılık
    32: 'soft',             // Yaklaşım: Nazik yönlendirme

    // Stage 4 questions (IDs 36, 37, 38) — Hedef ve Başarı
    36: 'architect_preference', // Birincil Hedef: Mimar/Tasarımcı tercihi
    37: 'balanced',              // Büyüme Hızı: Dengeli
    38: 'reference_rate',        // Başarı İşareti: Referans oranı
  };

  const scores = {
    // Stage 0 scored questions
    12: 2,  // mostly = score 2
    13: 2,  // mostly_holds = score 2
    14: 1,  // partially = score 1
  };

  const stageResults = [
    { stage: 0, title: 'Kontrollü Büyüme', description: 'Sınırlı kampanya, net teslimat planlama, bayi kalite kontrolü gerekir.', score: 5 },
    { stage: 1, title: 'Marka Ruhu Profili', description: 'Seçimlerinize göre marka ruhunuz şekillendi.', score: 0 },
    { stage: 2, title: 'Marka Arketipi', description: 'Kriz anında davranış şekliniz karakterinizi ortaya koydu.', score: 0 },
    { stage: 3, title: 'Filtreleme Stratejisi', description: 'İstemediğiniz müşteri/proje profilini tanımladınız.', score: 0 },
    { stage: 4, title: 'Strateji Modeli', description: 'Hedef ve başarı tanımınız netlesti.', score: 0 },
  ];

  const businessContext = {
    businessDescription: 'Premium parke ve zemin kaplama distribütörü. AlsaFloor, Kaindl, Weitzer, Pergo gibi dünya markalarının Türkiye, Ortadoğu ve Orta Asya distribütörlüğünü yapıyoruz. 135+ satış noktası, Parke Deneyim Merkezi showroom konsepti.',
    competitors: 'Parke Dünyası, FloorPan, AGT, Yıldız Entegre',
    geoScope: 'national',
    digitalPresence: ['instagram', 'website', 'google_business'],
    instagramFollowers: '10k_50k',
    monthlyBudget: 'growth',
    businessStage: 'established',
    triggerReason: 'competition',
  };

  const requestedServices = [
    { id: 'social_media', title: 'Sosyal Medya Yonetimi' },
    { id: 'content_production', title: 'Icerik Uretimi' },
    { id: 'brand_strategy', title: 'Marka Stratejisi' },
  ];

  const readableAnswers = [
    // Stage 0 — Operasyonel Gerçeklik
    {
      stage: 'Operasyonel Gerçeklik',
      questionId: 12,
      question: 'Showroom deneyiminiz ile sahada yaşanan gerçeklik ne kadar tutarlı?',
      answerKey: 'mostly',
      answer: 'Büyük ölçüde tutarlı — Standartlar var, nadiren sapma oluyor',
    },
    {
      stage: 'Operasyonel Gerçeklik',
      questionId: 13,
      question: 'Yoğun sezon veya toplu proje dönemlerinde teslimat kaliteniz ne durumda?',
      answerKey: 'mostly_holds',
      answer: 'Çoğunlukla dayanıyor — Küçük aksamalar olsa da genel kalite korunuyor',
    },
    {
      stage: 'Operasyonel Gerçeklik',
      questionId: 14,
      question: 'Bu çalışma sonrası %30 talep artışı olursa tedarik ve teslimat zinciriniz ne olur?',
      answerKey: 'partially',
      answer: 'Kısmen karşılarız — Bazı ürün gruplarında idare ederiz ama darboğazlar olur',
    },
    // Stage 1 — Marka Ruhu
    {
      stage: 'Marka Ruhu',
      questionId: 18,
      question: 'Markanız yarın kaybolsa, müşteri neyi kaybetmiş hisseder?',
      answerKey: 'quality_assurance',
      answer: 'Kalite güvencesi — Gözüm kapalı güvenebileceğim, hiç hayal kırıklığı yaşamadığım bir kaynak',
    },
    {
      stage: 'Marka Ruhu',
      questionId: 19,
      question: 'Müşterinize ne sunuyorsunuz?',
      answerKey: 'product_consulting',
      answer: 'Ürün + Danışmanlık — Ürün seçimi, mekan analizi, teknik rehberlik',
    },
    {
      stage: 'Marka Ruhu',
      questionId: 20,
      question: 'Ürün yaklaşımınız nedir?',
      answerKey: 'premium',
      answer: 'Premium — Seçkin markalar, üst segment, bilinçli fiyatlandırma',
    },
    // Stage 2 — Marka Karakteri
    {
      stage: 'Marka Karakteri',
      questionId: 24,
      question: "Müşteri 'döşenen ürün showroom'dakiyle aynı değil' dedi. İlk tepkiniz ne olur?",
      answerKey: 'explain',
      answer: 'Analiz eder — Sahaya gider, farkın nedenini tespit eder, rapor sunar (Bilge)',
    },
    {
      stage: 'Marka Karakteri',
      questionId: 25,
      question: 'İkna yönteminiz hangisi?',
      answerKey: 'technical',
      answer: 'Teknik uzmanlık — Teknik bilgi ve malzeme uzmanlığıyla ikna',
    },
    {
      stage: 'Marka Karakteri',
      questionId: 26,
      question: 'İletişim tonunuz nasıl?',
      answerKey: 'expert',
      answer: 'Uzman ve eğitici — Teknik bilgi, malzeme hikayesi, doğru seçimi öğretiyor',
    },
    // Stage 3 — Kim Değiliz
    {
      stage: 'Kim Değiliz',
      questionId: 30,
      question: 'Hangi müşteri/proje tipi markanıza en çok zarar verir?',
      answerKey: 'price_only',
      answer: "Sadece fiyat soran — Kaliteyi görmeden, showroom'a gelmeden, sadece WhatsApp'tan fiyat karşılaştıran",
    },
    {
      stage: 'Kim Değiliz',
      questionId: 31,
      question: 'Bu müşteri tipi hangi soruna yol açıyor?',
      answerKey: 'profitability',
      answer: 'Kârlılık — Numune maliyeti, geciken kararlar, iptal edilen siparişler, düşük marj',
    },
    {
      stage: 'Kim Değiliz',
      questionId: 32,
      question: 'Bu duruma nasıl yaklaşırsınız?',
      answerKey: 'soft',
      answer: 'Nazik yönlendirme — Showroom deneyimi, danışmanlık süreci ve fiyatlandırmayla dolaylı filtreleme',
    },
    // Stage 4 — Hedef ve Başarı
    {
      stage: 'Hedef ve Başarı',
      questionId: 36,
      question: 'Bu projedeki birincil hedefiniz?',
      answerKey: 'architect_preference',
      answer: 'Mimar/Tasarımcı tercihi — Mimarların ve iç tasarımcıların projelerde öncelikle önerdiği marka olmak',
    },
    {
      stage: 'Hedef ve Başarı',
      questionId: 37,
      question: 'Büyüme hızı tercihiniz?',
      answerKey: 'balanced',
      answer: 'Dengeli — Sürdürülebilir büyüme, kontrollü genişleme, kaliteyi koruyarak',
    },
    {
      stage: 'Hedef ve Başarı',
      questionId: 38,
      question: 'Başarı sizin için ne demek?',
      answerKey: 'reference_rate',
      answer: 'Referans oranı — Tamamlanmış projelerden gelen yeni müşteri oranı',
    },
  ];

  const leadData = {
    tenantId: 'intiba',
    sector: 'showroom',
    contact: {
      name: 'Fatih Aslan',
      email: 'f.aslan@df.com.tr',
      phone: '0533 226 6252',
      businessName: 'DesignFloor',
    },
    status: 'new',
    priority: 'high',
    wizard: {
      answers,
      scores,
      stageResults,
      readableAnswers,
      wizardVersion: '2.0',
      completionTime: 480000, // ~8 minutes
      businessContext,
    },
    requestedServices,
    timeline: [{
      id: `evt-${timestamp}`,
      type: 'created',
      title: 'Website uzerinden basvuru',
      description: 'DesignFloor web sitesi formu uzerinden basvurdu',
      createdAt: admin.firestore.Timestamp.now(),
      createdBy: 'system',
      createdByName: 'Website Form',
    }],
    tags: ['premium', 'showroom', 'b2b2c'],
    source: 'website_wizard',
    submissionId,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  const docRef = await db.collection('brand_leads').add(leadData);
  console.log('DesignFloor lead created:', docRef.id);
  console.log('Submission ID:', submissionId);
  console.log('Sector: showroom');
  console.log('Contact: Fatih Aslan - f.aslan@df.com.tr');

  // Verify
  const doc = await docRef.get();
  console.log('\n=== VERIFICATION ===');
  console.log('Status:', doc.data()?.status);
  console.log('Sector:', doc.data()?.sector);
  console.log('Business:', doc.data()?.contact?.businessName);
  console.log('Budget:', doc.data()?.wizard?.businessContext?.monthlyBudget);
  console.log('Stage 0 Result:', doc.data()?.wizard?.stageResults?.[0]?.title);

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
