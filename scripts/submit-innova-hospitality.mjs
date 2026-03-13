import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'intiba-ab4bd' });
}
const db = admin.firestore();

async function main() {
  const timestamp = Date.now();
  const submissionId = `BS-${timestamp}`;

  // Hospitality sector question IDs (same structure):
  // 12,13,14: Stage 0 (Operasyonel Gerceklik)
  // 18,19,20: Stage 1 (Marka Ruhu)
  // 24,25,26: Stage 2 (Marka Karakteri)
  // 30,31,32: Stage 3 (Kim Degiliz)
  // 36,37,38: Stage 4 (Hedef ve Basari)

  const answers = {
    // Stage 0 — Operasyonel Gerceklik
    // 74 odali butik otel, aile isletmesi, Sultanahmet'in en yogun turistik bolgesinde
    12: 'mostly_stable',   // Deneyim Tutarliligi: Buyuk olcude sabit (kucuk otel, kontrol kolay)
    13: 'mostly_holds',    // Yogun Sezon: Cogunlukla korunuyor (74 oda, yonetilebilir)
    14: 'partially',       // Talep Artisi: Kismen karsilariz (sinirli oda kapasitesi)

    // Stage 1 — Marka Ruhu
    // Sultanahmet'te tarihi atmosfer, butik deneyim, rooftop teras, hamam
    18: 'belonging',       // Kayip Duygusu: Aidiyet (ev sicakligi, kisisel ilgi, butik his)
    19: 'room_experience', // Konaklama Deneyimi: Konaklama + deneyim (rooftop, hamam, restoran)
    20: 'boutique',        // Otel Konsepti: Butik / Karakter (ozgun tasarim, tarihi doku)

    // Stage 2 — Marka Karakteri
    // Misafirperver yaklasim, sicak iletisim, Bakici arketipi
    24: 'compensate',      // Kriz Tepkisi: Telafi eder (ozur + cozum, Bakici)
    25: 'story',           // Ikna Yontemi: Hikaye (otelin hikayesi, Sultanahmet'in ruhu)
    26: 'warm',            // Ton: Samimi & Sicak (ev sahipligi, kisisel)

    // Stage 3 — Kim Degiliz
    // Ucuz otel arayan fiyat avcilari degil, deneyim arayan gezginler hedef
    30: 'price_hunter',    // Zararli Misafir: Fiyat avcisi (sadece ucuz arayan)
    31: 'profitability',   // Sorun Tipi: Karlilik (dusuk harcama, yuksek beklenti)
    32: 'positioning',     // Filtreleme: Konumlandirma ile (iletisim tonu, gorsel dil)

    // Stage 4 — Hedef ve Basari
    // 1,433 Instagram takipci - cok dusuk. Direkt rezervasyon ve bilinirlik kritik
    36: 'direct_booking',  // Birincil Hedef: Direkt rezervasyon (OTA bagimliligini azalt)
    37: 'balanced',        // Buyume Hizi: Dengeli (surdurulebilir, kaliteyi koruyarak)
    38: 'direct_ratio',    // Basari Metrigi: Direkt/OTA orani
  };

  const scores = {
    12: 2,  // mostly_stable = score 2
    13: 2,  // mostly_holds = score 2
    14: 1,  // partially = score 1
  };

  const stageResults = [
    { stage: 0, title: 'Kontrollu Buyume', description: 'Sinirli kapasite nedeniyle kontrollü kampanyalar, revenue management gerekir.', score: 5 },
    { stage: 1, title: 'Marka Ruhu Profili', description: 'Aidiyet Evi: Butik, sicak, tarihi atmosferde kisisel ilgi.', score: 0 },
    { stage: 2, title: 'Marka Arketipi', description: 'Bakici: Misafirperver, sicak, telafi eden, hikaye anlatan.', score: 0 },
    { stage: 3, title: 'Filtreleme Stratejisi', description: 'Konumlandirma ile filtreleme: Gorsel dil ve ton ile dogru kitleyi cekme.', score: 0 },
    { stage: 4, title: 'Strateji Modeli', description: 'Direkt Kanal: OTA bagimliligini azaltma, web ve sosyal medya odakli.', score: 0 },
  ];

  const businessContext = {
    businessDescription: '4 yildizli butik otel, Sultanahmet\'in kalbinde. Sultanahmet Camii\'ne 500 metre, Ayasofya, Topkapi Sarayi, Yerebatan Sarnici yurume mesafesinde. 74 oda, 7 kat, 3 asansor. Panoramik rooftop teras restoran & lounge bar, Revan a la carte restoran, 5 bar. Turquaise Spa: otantik Turk hamami, sauna, masaj. INNVISTA Hotels markasi altinda aile isletmesi. Booking.com 471 yorum, lokasyon puani 9.6/10. TripAdvisor 681 yorum, 4/5.',
    competitors: 'Four Seasons Sultanahmet, Sura Hagia Sophia Hotel, Hotel Ibrahim Pasha, Armada Old City Hotel',
    geoScope: 'international',
    digitalPresence: ['instagram', 'website', 'google_business'],
    instagramFollowers: '1k_10k',
    monthlyBudget: 'starter',
    businessStage: 'established',
    triggerReason: 'growth',
  };

  const requestedServices = [
    { id: 'social_media', title: 'Sosyal Medya Yonetimi' },
    { id: 'content_production', title: 'Icerik Uretimi' },
    { id: 'digital_ads', title: 'Dijital Reklam' },
    { id: 'brand_strategy', title: 'Marka Stratejisi' },
  ];

  // Delete old gastronomi lead
  const oldSnap = await db.collection('brand_leads')
    .where('tenantId', '==', 'intiba')
    .where('contact.businessName', '==', 'Innova Sultanahmet Hotel')
    .get();
  for (const doc of oldSnap.docs) {
    await doc.ref.delete();
    console.log('Deleted old lead:', doc.id);
  }

  const readableAnswers = [
    // Stage 0 — Operasyonel Gerçeklik
    {
      stage: 'Operasyonel Gerçeklik',
      questionId: 12,
      question: 'Misafir deneyiminiz odalar ve vardiyalar arasında ne kadar tutarlı?',
      answerKey: 'mostly_stable',
      answer: 'Büyük ölçüde sabit — SOP mevcut, çoğu durumda tutarlı',
    },
    {
      stage: 'Operasyonel Gerçeklik',
      questionId: 13,
      question: 'Yüksek sezon veya tam dolulukta kalite nasıl?',
      answerKey: 'mostly_holds',
      answer: 'Çoğunlukla korunuyor — Küçük aksamalar ama genel standart stabil',
    },
    {
      stage: 'Operasyonel Gerçeklik',
      questionId: 14,
      question: 'Başarılı bir dijital kampanya sonrası %30 rezervasyon artışı olsa ne olur?',
      answerKey: 'partially',
      answer: 'Kısmen karşılarız — Bazı düzenlemelerle idare ederiz',
    },
    // Stage 1 — Marka Ruhu
    {
      stage: 'Marka Ruhu',
      questionId: 18,
      question: 'Oteliniz kapansa, misafir neyi kaybetmiş hisseder?',
      answerKey: 'belonging',
      answer: 'Aidiyet — Ev sıcaklığı, tanınma, kişisel ilgi',
    },
    {
      stage: 'Marka Ruhu',
      questionId: 19,
      question: 'Misafirinize ne sunuyorsunuz?',
      answerKey: 'room_experience',
      answer: 'Konaklama + deneyim — Oda + restoran, spa, aktiviteler',
    },
    {
      stage: 'Marka Ruhu',
      questionId: 20,
      question: 'Konaklama konseptiniz?',
      answerKey: 'boutique',
      answer: 'Butik / Karakter — Özgün tasarım, hikaye, yerel doku',
    },
    // Stage 2 — Marka Karakteri
    {
      stage: 'Marka Karakteri',
      questionId: 24,
      question: "TripAdvisor'da 'Oda kirli, personel ilgisiz' yazan bir yorum geldi. İlk tepkiniz?",
      answerKey: 'compensate',
      answer: 'Telafi eder — Özür diler, sonraki konaklama için indirim teklif eder (Bakıcı)',
    },
    {
      stage: 'Marka Karakteri',
      questionId: 25,
      question: 'İkna yönteminiz?',
      answerKey: 'story',
      answer: 'Hikaye — Otelin hikayesi, Sultanahmet\'in ruhu',
    },
    {
      stage: 'Marka Karakteri',
      questionId: 26,
      question: 'İletişim tonunuz?',
      answerKey: 'warm',
      answer: 'Samimi & Sıcak — Ev sahipliği, kişisel, içten',
    },
    // Stage 3 — Kim Değiliz
    {
      stage: 'Kim Değiliz',
      questionId: 30,
      question: 'Hangi misafir tipi otelinize en çok zarar verir?',
      answerKey: 'price_hunter',
      answer: 'Fiyat avcısı — Sadece en ucuz fırsatı arayan, otelinizin değerini görmeyen',
    },
    {
      stage: 'Kim Değiliz',
      questionId: 31,
      question: 'Bu misafir tipi hangi soruna yol açıyor?',
      answerKey: 'profitability',
      answer: 'Kârlılık — RevPAR düşüyor, OTA komisyonları artıyor',
    },
    {
      stage: 'Kim Değiliz',
      questionId: 32,
      question: 'Bu duruma nasıl yaklaşırsınız?',
      answerKey: 'positioning',
      answer: 'Konumlandırma ile filtreleme — İletişim tonu, görsel dil, hedef kitle mesajı',
    },
    // Stage 4 — Hedef ve Başarı
    {
      stage: 'Hedef ve Başarı',
      questionId: 36,
      question: 'Dijital stratejideki birincil hedefiniz?',
      answerKey: 'direct_booking',
      answer: 'Direkt rezervasyon — OTA bağımlılığını azaltmak, komisyon düşürmek',
    },
    {
      stage: 'Hedef ve Başarı',
      questionId: 37,
      question: 'Büyüme hızı tercihiniz?',
      answerKey: 'balanced',
      answer: 'Dengeli — Sürdürülebilir büyüme, kaliteyi koruyarak',
    },
    {
      stage: 'Hedef ve Başarı',
      questionId: 38,
      question: '6 ay sonra başarıyı neyle ölçersiniz?',
      answerKey: 'direct_ratio',
      answer: 'Direkt/OTA oranı — Direkt rezervasyon payında artış',
    },
  ];

  const leadData = {
    tenantId: 'intiba',
    sector: 'hospitality',
    contact: {
      name: 'Otel Yonetimi',
      email: 'info@innovasultanahmet.com',
      phone: '0444 94 27',
      businessName: 'Innova Sultanahmet Hotel',
      website: 'https://www.innovasultanahmet.com',
    },
    status: 'new',
    priority: 'medium',
    wizard: {
      answers,
      scores,
      stageResults,
      readableAnswers,
      wizardVersion: '2.0',
      completionTime: 540000,
      businessContext,
    },
    requestedServices,
    timeline: [{
      id: `evt-${timestamp}`,
      type: 'created',
      title: 'Website uzerinden basvuru',
      description: 'Innova Sultanahmet Hotel web sitesi formu uzerinden basvurdu',
      createdAt: admin.firestore.Timestamp.now(),
      createdBy: 'system',
      createdByName: 'Website Form',
    }],
    tags: ['otel', 'butik', 'sultanahmet', 'turizm', 'direkt-booking'],
    source: 'website_wizard',
    submissionId,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  const docRef = await db.collection('brand_leads').add(leadData);
  console.log('Innova Sultanahmet lead created:', docRef.id);
  console.log('Submission ID:', submissionId);
  console.log('Sector: hospitality');

  const doc = await docRef.get();
  console.log('\n=== VERIFICATION ===');
  console.log('Status:', doc.data()?.status);
  console.log('Sector:', doc.data()?.sector);
  console.log('Business:', doc.data()?.contact?.businessName);
  console.log('Budget:', doc.data()?.wizard?.businessContext?.monthlyBudget);
  console.log('Stage 0:', doc.data()?.wizard?.stageResults?.[0]?.title);
  console.log('Stage 1:', doc.data()?.wizard?.stageResults?.[1]?.title);

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
