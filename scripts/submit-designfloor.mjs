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
