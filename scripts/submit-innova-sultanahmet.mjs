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
    12: 'mostly_stable',   // Deneyim Tutarliligi: Buyuk olcude sabit (74 odali butik otel, kontrol kolay)
    13: 'mostly_holds',    // Pik Saat: Cogunlukla korunuyor (kucuk otel, yogunluk yonetilebilir)
    14: 'partially',       // Talep Artisi: Kismen karsilariz (74 oda siniri var)

    // Stage 1 — Marka Ruhu
    18: 'trust',           // Kayip Duygusu: Guven (bilinen, tutarli, guvenilir bir yer)
    19: 'food_ritual',     // Deneyim Seviyesi: Yemek + Ritual (rooftop kahvalti, hamam deneyimi)
    20: 'respectful',      // Yorum Seviyesi: Saygili yorum (tarihi dokuya modern dokunuslar)

    // Stage 2 — Marka Karakteri
    24: 'compensate',      // Kriz Tepkisi: Telafi eder (misafirperver yaklasim, Bakici arketipi)
    25: 'influence',       // Ikna Yontemi: Duygusal bag, deneyim, atmosfer
    26: 'warm',            // Ton: Samimi, yakin, dostca

    // Stage 3 — Kim Degiliz
    30: 'price_focused',   // Zararli Kitle: Fiyat odakli (sadece ucuz otel arayan turistler)
    31: 'profitability',   // Sorun Tipi: Karlilik (dusuk harcama, yuksek beklenti)
    32: 'soft',            // Tavir: Nazik eleme (fiyat ve konumlandirma ile filtreleme)

    // Stage 4 — Hedef ve Basari
    36: 'reservation',     // Birincil Hedef: Rezervasyon (doluluk artisi, direkt rezervasyon)
    37: 'balanced',        // Buyume Hizi: Dengeli (surdurulebilir, kontrollü)
    38: 'quality_guest',   // Basari Isareti: Nitelikli misafir (dogru kitle cekmek)
  };

  const scores = {
    12: 2,  // mostly_stable = score 2
    13: 2,  // mostly_holds = score 2
    14: 1,  // partially = score 1
  };

  const stageResults = [
    { stage: 0, title: 'Kontrollu Buyume', description: 'Sinirli kapasite ile kontrollü pazarlama, rezervasyon disiplini gerekir.', score: 5 },
    { stage: 1, title: 'Marka Ruhu Profili', description: 'Guvenli Liman: Tutarli, sicak, tarihi atmosferle sarilmis deneyim.', score: 0 },
    { stage: 2, title: 'Marka Arketipi', description: 'Bakici arketipi: Misafirperver, sicak, telafi eden.', score: 0 },
    { stage: 3, title: 'Filtreleme Stratejisi', description: 'Fiyat odakli turistleri nazik konumlandirma ile filtreleme.', score: 0 },
    { stage: 4, title: 'Strateji Modeli', description: 'Rezervasyon motoru: Doluluk ve nitelikli misafir hedefli.', score: 0 },
  ];

  const businessContext = {
    businessDescription: '4 yildizli butik otel, Sultanahmet\'in kalbinde. Sultanahmet Camii\'ne 500 metre, Ayasofya, Topkapi Sarayi, Yerebatan Sarnici yurumeye mesafede. 74 oda, 7 kat. Panoramik rooftop teras restoran, otantik Turk hamami, spa. Revan a la carte restoran, 5 bar. INNVISTA Hotels markasi altinda. 2009\'dan beri faaliyet.',
    competitors: 'Four Seasons Sultanahmet, Sura Hagia Sophia, Hotel Ibrahim Pasha, Armada Old City',
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
    { id: 'brand_strategy', title: 'Marka Stratejisi' },
    { id: 'digital_ads', title: 'Dijital Reklam' },
  ];

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
      answerKey: 'trust',
      answer: 'Güven — Bilinen, tutarlı, güvenilir bir yer',
    },
    {
      stage: 'Marka Ruhu',
      questionId: 19,
      question: 'Misafirinize ne sunuyorsunuz?',
      answerKey: 'food_ritual',
      answer: 'Yemek + Ritüel — Rooftop kahvaltı, hamam deneyimi',
    },
    {
      stage: 'Marka Ruhu',
      questionId: 20,
      question: 'Konaklama konseptiniz?',
      answerKey: 'respectful',
      answer: 'Saygılı yorum — Tarihi dokuya modern dokunuşlar',
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
      answerKey: 'influence',
      answer: 'Duygusal bağ — Deneyim, atmosfer, duygusal etki',
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
      answerKey: 'price_focused',
      answer: 'Fiyat odaklı — Sadece ucuz otel arayan turistler',
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
      answerKey: 'soft',
      answer: 'Nazik eleme — Fiyat ve konumlandırma ile filtreleme',
    },
    // Stage 4 — Hedef ve Başarı
    {
      stage: 'Hedef ve Başarı',
      questionId: 36,
      question: 'Dijital stratejideki birincil hedefiniz?',
      answerKey: 'reservation',
      answer: 'Rezervasyon — Doluluk artışı, direkt rezervasyon',
    },
    {
      stage: 'Hedef ve Başarı',
      questionId: 37,
      question: 'Büyüme hızı tercihiniz?',
      answerKey: 'balanced',
      answer: 'Dengeli — Sürdürülebilir, kontrollü',
    },
    {
      stage: 'Hedef ve Başarı',
      questionId: 38,
      question: '6 ay sonra başarıyı neyle ölçersiniz?',
      answerKey: 'quality_guest',
      answer: 'Nitelikli misafir — Doğru kitleyi çekmek',
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
      completionTime: 540000, // ~9 minutes
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
    tags: ['otel', 'butik', 'sultanahmet', 'turizm'],
    source: 'website_wizard',
    submissionId,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  const docRef = await db.collection('brand_leads').add(leadData);
  console.log('Innova Sultanahmet lead created:', docRef.id);
  console.log('Submission ID:', submissionId);
  console.log('Sector: hospitality');
  console.log('Contact: info@innovasultanahmet.com');

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
