import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'intiba-ab4bd' });
}
const db = admin.firestore();

async function main() {
  const timestamp = Date.now();
  const submissionId = `BS-${timestamp}`;

  // Gastronomi sector question IDs:
  // 12,13,14: Stage 0 (Operasyonel Gerceklik)
  // 18,19,20: Stage 1 (Marka Ruhu)
  // 24,25,26: Stage 2 (Marka Karakteri)
  // 30,31,32: Stage 3 (Kim Degiliz)
  // 36,37,38: Stage 4 (Hedef ve Basari)

  const answers = {
    // Stage 0 — Operasyonel Gerceklik
    12: 'mostly_stable',   // Deneyim Tutarliligi: Buyuk olcude sabit (315 odali resort, SOP mevcut)
    13: 'struggling',      // Pik Saat: Zorlaniyor (yaz sezonunda all-inclusive yogunlugu)
    14: 'yes',             // Talep Artisi: Evet, karsilariz (buyuk resort kapasitesi var)

    // Stage 1 — Marka Ruhu
    18: 'warmth',          // Kayip Duygusu: Sicaklik (aile tatili, eve gelmis gibi)
    19: 'food_ritual',     // Deneyim Seviyesi: Yemek + Ritual (5 restoran, a la carte deneyim)
    20: 'authentic',       // Yorum Seviyesi: Otantik (Turk/Anadolu mutfagi + uluslararasi)

    // Stage 2 — Marka Karakteri
    24: 'compensate',      // Kriz Tepkisi: Telafi eder (all-inclusive, misafiri mutlu tut)
    25: 'sop',             // Ikna Yontemi: SOP (standart, kalite garantisi, buyuk operasyon)
    26: 'warm',            // Ton: Samimi (aile dostu, yakin)

    // Stage 3 — Kim Degiliz
    30: 'price_focused',   // Zararli Kitle: Fiyat odakli (ultra ucuz arayan, her seyden sikayetci)
    31: 'culture',         // Sorun Tipi: Kultur (marka degerlerine aykiri davranis, tesisi yipratma)
    32: 'barrier',         // Tavir: Bariyer (fiyat ve rezervasyon politikalariyla filtreleme)

    // Stage 4 — Hedef ve Basari
    36: 'awareness',       // Birincil Hedef: Bilinirlik (marka adini duyurmak, Belek'te one cikmak)
    37: 'fast',            // Buyume Hizi: Hizli (resort doluluk hedefli, sezon kritik)
    38: 'occupancy',       // Basari Isareti: Doluluk (rezervasyon doluluğu)
  };

  const scores = {
    12: 2,  // mostly_stable = score 2
    13: 1,  // struggling = score 1
    14: 2,  // yes = score 2
  };

  const stageResults = [
    { stage: 0, title: 'Kontrollu Buyume', description: 'Yoğun sezon operasyonu iyilestirmeli, off-season pazarlama ile dengelenmeli.', score: 5 },
    { stage: 1, title: 'Marka Ruhu Profili', description: 'Misafirlik Evi: Sicak, samimi, aile odakli tatil deneyimi.', score: 0 },
    { stage: 2, title: 'Marka Arketipi', description: 'Bakici arketipi: SOP odakli, telafi eden, sicak.', score: 0 },
    { stage: 3, title: 'Filtreleme Stratejisi', description: 'Bariyer sistemi: Fiyat ve politikalarla kaliteli misafir filtreleme.', score: 0 },
    { stage: 4, title: 'Strateji Modeli', description: 'Rezervasyon Motoru: Hizli doluluk artisi, bilinirlik kampanyasi.', score: 0 },
  ];

  const businessContext = {
    businessDescription: '5 yildizli Ultra Her Sey Dahil resort. Belek, Antalya\'da 22.472 m2 alan uzerine kurulu. 315 oda, 706 yatak kapasitesi. 5 restoran (Ana restoran + 4 a la carte: Akdeniz, Asya, Deniz Urunleri, Turk/Anadolu), 5 bar. Aquapark, 5 havuz, Turquaise Spa, Turk hamami, fitness. Cocuk kulubu, mini disko. Land of Legends\'a yurume mesafesinde. 2017 renovasyonu ile yenilendi.',
    competitors: 'Regnum Carya Golf & Spa, Rixos Premium Belek, Maxx Royal Belek, Kaya Belek, Sueno Hotels Deluxe',
    geoScope: 'international',
    digitalPresence: ['instagram', 'website', 'google_business'],
    instagramFollowers: '10k_50k',
    monthlyBudget: 'growth',
    businessStage: 'established',
    triggerReason: 'competition',
  };

  const requestedServices = [
    { id: 'social_media', title: 'Sosyal Medya Yonetimi' },
    { id: 'content_production', title: 'Icerik Uretimi' },
    { id: 'digital_ads', title: 'Dijital Reklam' },
    { id: 'brand_strategy', title: 'Marka Stratejisi' },
    { id: 'website', title: 'Web Sitesi' },
  ];

  const readableAnswers = [
    // Stage 0 — Operasyonel Gerçeklik
    {
      stage: 'Operasyonel Gerçeklik',
      questionId: 12,
      question: 'Misafir deneyiminiz odalar ve vardiyalar arasında ne kadar tutarlı?',
      answerKey: 'mostly_stable',
      answer: 'Benzer ama değişken — Genel çerçeve var, bazen sapmalar oluyor',
    },
    {
      stage: 'Operasyonel Gerçeklik',
      questionId: 13,
      question: 'Yüksek sezon veya tam dolulukta kalite nasıl?',
      answerKey: 'struggling',
      answer: 'Zorlanıyor — Hissedilir kalite düşüşü ama idare ediliyor',
    },
    {
      stage: 'Operasyonel Gerçeklik',
      questionId: 14,
      question: 'Başarılı bir dijital kampanya sonrası %30 rezervasyon artışı olsa ne olur?',
      answerKey: 'yes',
      answer: 'Evet, karşılarız — Kapasite ve ekip hazır',
    },
    // Stage 1 — Marka Ruhu
    {
      stage: 'Marka Ruhu',
      questionId: 18,
      question: 'Oteliniz kapansa, misafir neyi kaybetmiş hisseder?',
      answerKey: 'warmth',
      answer: 'Sıcaklık — Aile tatili, eve gelmiş gibi',
    },
    {
      stage: 'Marka Ruhu',
      questionId: 19,
      question: 'Misafirinize ne sunuyorsunuz?',
      answerKey: 'food_ritual',
      answer: 'Yemek + Ritüel — 5 restoran, a la carte deneyim',
    },
    {
      stage: 'Marka Ruhu',
      questionId: 20,
      question: 'Konaklama konseptiniz?',
      answerKey: 'authentic',
      answer: 'Otantik — Türk/Anadolu mutfağı + uluslararası',
    },
    // Stage 2 — Marka Karakteri
    {
      stage: 'Marka Karakteri',
      questionId: 24,
      question: "TripAdvisor'da 'Oda kirli, personel ilgisiz' yazan bir yorum geldi. İlk tepkiniz?",
      answerKey: 'compensate',
      answer: 'Telafi eder — All-inclusive, misafiri mutlu tut (Bakıcı)',
    },
    {
      stage: 'Marka Karakteri',
      questionId: 25,
      question: 'İkna yönteminiz?',
      answerKey: 'sop',
      answer: 'SOP — Standart, kalite garantisi, büyük operasyon',
    },
    {
      stage: 'Marka Karakteri',
      questionId: 26,
      question: 'İletişim tonunuz?',
      answerKey: 'warm',
      answer: 'Samimi — Aile dostu, yakın',
    },
    // Stage 3 — Kim Değiliz
    {
      stage: 'Kim Değiliz',
      questionId: 30,
      question: 'Hangi misafir tipi otelinize en çok zarar verir?',
      answerKey: 'price_focused',
      answer: 'Fiyat odaklı — Ultra ucuz arayan, her şeyden şikayetçi',
    },
    {
      stage: 'Kim Değiliz',
      questionId: 31,
      question: 'Bu misafir tipi hangi soruna yol açıyor?',
      answerKey: 'culture',
      answer: 'Kültür — Marka değerlerine aykırı davranış, tesisi yıpratma',
    },
    {
      stage: 'Kim Değiliz',
      questionId: 32,
      question: 'Bu duruma nasıl yaklaşırsınız?',
      answerKey: 'barrier',
      answer: 'Bariyer — Fiyat ve rezervasyon politikalarıyla filtreleme',
    },
    // Stage 4 — Hedef ve Başarı
    {
      stage: 'Hedef ve Başarı',
      questionId: 36,
      question: 'Dijital stratejideki birincil hedefiniz?',
      answerKey: 'awareness',
      answer: "Marka bilinirliği — Marka adını duyurmak, Belek'te öne çıkmak",
    },
    {
      stage: 'Hedef ve Başarı',
      questionId: 37,
      question: 'Büyüme hızı tercihiniz?',
      answerKey: 'fast',
      answer: 'Hızlı — Resort doluluk hedefli, sezon kritik',
    },
    {
      stage: 'Hedef ve Başarı',
      questionId: 38,
      question: '6 ay sonra başarıyı neyle ölçersiniz?',
      answerKey: 'occupancy',
      answer: 'Doluluk — Rezervasyon doluluğu',
    },
  ];

  const leadData = {
    tenantId: 'intiba',
    sector: 'hospitality',
    contact: {
      name: 'Otel Yonetimi',
      email: 'info@innvistahotel.com',
      phone: '0444 94 27',
      businessName: 'Innvista Hotels Belek',
      website: 'https://www.innvistahotel.com',
    },
    status: 'new',
    priority: 'high',
    wizard: {
      answers,
      scores,
      stageResults,
      readableAnswers,
      wizardVersion: '2.0',
      completionTime: 600000, // ~10 minutes
      businessContext,
    },
    requestedServices,
    timeline: [{
      id: `evt-${timestamp}`,
      type: 'created',
      title: 'Website uzerinden basvuru',
      description: 'Innvista Hotels Belek web sitesi formu uzerinden basvurdu',
      createdAt: admin.firestore.Timestamp.now(),
      createdBy: 'system',
      createdByName: 'Website Form',
    }],
    tags: ['otel', 'resort', 'all-inclusive', 'belek', 'aile'],
    source: 'website_wizard',
    submissionId,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  const docRef = await db.collection('brand_leads').add(leadData);
  console.log('Innvista Belek lead created:', docRef.id);
  console.log('Submission ID:', submissionId);
  console.log('Sector: hospitality');
  console.log('Contact: info@innvistahotel.com');

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
