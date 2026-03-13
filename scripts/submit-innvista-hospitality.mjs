import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'intiba-ab4bd' });
}
const db = admin.firestore();

async function main() {
  const timestamp = Date.now();
  const submissionId = `BS-${timestamp}`;

  // Hospitality sector question IDs:
  // 12,13,14: Stage 0 (Operasyonel Gerceklik)
  // 18,19,20: Stage 1 (Marka Ruhu)
  // 24,25,26: Stage 2 (Marka Karakteri)
  // 30,31,32: Stage 3 (Kim Degiliz)
  // 36,37,38: Stage 4 (Hedef ve Basari)

  const answers = {
    // Stage 0 — Operasyonel Gerceklik
    // 315 odali 5 yildiz resort, ultra all-inclusive, 706 yatak kapasitesi
    12: 'similar',         // Deneyim Tutarliligi: Benzer ama degisken (buyuk resort, personel degiskenlik)
    13: 'struggling',      // Yogun Sezon: Zorlaniyor (yaz, tum havuzlar+restoranlar tam kapasite)
    14: 'yes',             // Talep Artisi: Evet karsilariz (315 oda, buyuk kapasite)

    // Stage 1 — Marka Ruhu
    // Aile odakli tatil koyu, aquapark, cocuk kulubu, Land of Legends yakini
    18: 'escape',          // Kayip Duygusu: Kacis (gunluk hayattan kopma, tatil, yenilenme)
    19: 'room_experience', // Konaklama Deneyimi: Konaklama + deneyim (5 restoran, aquapark, spa)
    20: 'resort',          // Otel Konsepti: Resort / Tatil (all-inclusive, aile, eglence)

    // Stage 2 — Marka Karakteri
    // Buyuk resort, SOP odakli, misafiri mutlu tutma oncelikli
    24: 'compensate',      // Kriz Tepkisi: Telafi eder (all-inclusive, hemen cozum)
    25: 'social_proof',    // Ikna Yontemi: Sosyal kanit (yorumlar, puanlar, OTA siralamasi)
    26: 'adventurous',     // Ton: Maceraperest & Enerjik (tatil, eglence, aquapark)

    // Stage 3 — Kim Degiliz
    // Ultra ucuz arayan, her seyden sikayetci, tesisi yipratan misafirler
    30: 'facility_abuser', // Zararli Misafir: Tesis yipratici (all-inclusive'de her seyi tuketen)
    31: 'operations',      // Sorun Tipi: Operasyon (ekstra is yuku, personel motivasyon kaybi)
    32: 'pricing',         // Filtreleme: Fiyatlama ile (minimum konaklama, dinamik fiyat, paket)

    // Stage 4 — Hedef ve Basari
    // Belek'te yogun rekabet, bilinirlik ve doluluk kritik
    36: 'brand',           // Birincil Hedef: Marka bilinirlik (Belek'te one cikmak)
    37: 'fast',            // Buyume Hizi: Hizli (sezon kritik, agresif kampanya)
    38: 'occupancy_rate',  // Basari Metrigi: Doluluk orani
  };

  const scores = {
    12: 1,  // similar = score 1
    13: 1,  // struggling = score 1
    14: 2,  // yes = score 2
  };

  const stageResults = [
    { stage: 0, title: 'Kontrollu Buyume', description: 'Yogun sezon operasyonunu iyilestirmeli, off-season kampanyalarla dengelemeli.', score: 4 },
    { stage: 1, title: 'Marka Ruhu Profili', description: 'Kacis Noktasi: Aile tatili, gunlukten kopus, eglence ve yenilenme.', score: 0 },
    { stage: 2, title: 'Marka Arketipi', description: 'Bakici + Maceraci: Enerjik, eglenceli ama cozum odakli.', score: 0 },
    { stage: 3, title: 'Filtreleme Stratejisi', description: 'Fiyat filtresi: Dinamik pricing ve paket yapiyla kaliteli misafir cekmek.', score: 0 },
    { stage: 4, title: 'Strateji Modeli', description: 'Marka Bilinirlik: Hizli doluluk artisi, agresif dijital kampanya.', score: 0 },
  ];

  const businessContext = {
    businessDescription: '5 yildizli Ultra Her Sey Dahil resort. Belek, Antalya\'da 22.472 m2 alan. 315 oda, 706 yatak kapasitesi, 3 bina, 4 asansor. 5 restoran (ana buffet + 4 a la carte: Akdeniz, Asya, Deniz Urunleri, Turk/Anadolu), 5 bar. Aquapark (5 dis havuz, 2 cocuk havuzu, ic havuz), Turquaise Spa, Turk hamami. Cocuk kulubu, mini disko. Land of Legends\'a yurume mesafesinde. 2017 renovasyonu. Booking.com 7.9/10 (828 yorum), TripAdvisor 4.0/5 (2,690 yorum). Instagram ~15K takipci.',
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
      answerKey: 'similar',
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
      answerKey: 'escape',
      answer: 'Kaçış — Günlük hayattan kopma, yenilenme',
    },
    {
      stage: 'Marka Ruhu',
      questionId: 19,
      question: 'Misafirinize ne sunuyorsunuz?',
      answerKey: 'room_experience',
      answer: 'Konaklama + deneyim — 5 restoran, aquapark, spa',
    },
    {
      stage: 'Marka Ruhu',
      questionId: 20,
      question: 'Konaklama konseptiniz?',
      answerKey: 'resort',
      answer: 'Resort / Tatil — All-inclusive, aile, eğlence',
    },
    // Stage 2 — Marka Karakteri
    {
      stage: 'Marka Karakteri',
      questionId: 24,
      question: "TripAdvisor'da 'Oda kirli, personel ilgisiz' yazan bir yorum geldi. İlk tepkiniz?",
      answerKey: 'compensate',
      answer: 'Telafi eder — All-inclusive, hemen çözüm (Bakıcı)',
    },
    {
      stage: 'Marka Karakteri',
      questionId: 25,
      question: 'İkna yönteminiz?',
      answerKey: 'social_proof',
      answer: 'Sosyal kanıt — Yorumlar, puanlar, OTA sıralaması',
    },
    {
      stage: 'Marka Karakteri',
      questionId: 26,
      question: 'İletişim tonunuz?',
      answerKey: 'adventurous',
      answer: 'Maceraperest & Enerjik — Tatil, eğlence, aquapark',
    },
    // Stage 3 — Kim Değiliz
    {
      stage: 'Kim Değiliz',
      questionId: 30,
      question: 'Hangi misafir tipi otelinize en çok zarar verir?',
      answerKey: 'facility_abuser',
      answer: "Tesis yıpratıcı — All-inclusive'de her şeyi sonuna kadar tüketen, tesisi yıpratan",
    },
    {
      stage: 'Kim Değiliz',
      questionId: 31,
      question: 'Bu misafir tipi hangi soruna yol açıyor?',
      answerKey: 'operations',
      answer: 'Operasyon — Ekstra iş yükü, personel motivasyon kaybı',
    },
    {
      stage: 'Kim Değiliz',
      questionId: 32,
      question: 'Bu duruma nasıl yaklaşırsınız?',
      answerKey: 'pricing',
      answer: 'Fiyatlama ile filtreleme — Minimum konaklama, dinamik fiyat, paket',
    },
    // Stage 4 — Hedef ve Başarı
    {
      stage: 'Hedef ve Başarı',
      questionId: 36,
      question: 'Dijital stratejideki birincil hedefiniz?',
      answerKey: 'brand',
      answer: "Marka bilinirliği — Belek'te öne çıkmak",
    },
    {
      stage: 'Hedef ve Başarı',
      questionId: 37,
      question: 'Büyüme hızı tercihiniz?',
      answerKey: 'fast',
      answer: 'Hızlı — Sezon kritik, agresif kampanya',
    },
    {
      stage: 'Hedef ve Başarı',
      questionId: 38,
      question: '6 ay sonra başarıyı neyle ölçersiniz?',
      answerKey: 'occupancy_rate',
      answer: 'Doluluk oranı — Oda doluluğunda artış',
    },
  ];

  // Delete old gastronomi lead
  const oldSnap = await db.collection('brand_leads')
    .where('tenantId', '==', 'intiba')
    .where('contact.businessName', '==', 'Innvista Hotels Belek')
    .get();
  for (const doc of oldSnap.docs) {
    await doc.ref.delete();
    console.log('Deleted old lead:', doc.id);
  }

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
      completionTime: 600000,
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
    tags: ['otel', 'resort', 'all-inclusive', 'belek', 'aile', 'aquapark'],
    source: 'website_wizard',
    submissionId,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  const docRef = await db.collection('brand_leads').add(leadData);
  console.log('Innvista Belek lead created:', docRef.id);
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
