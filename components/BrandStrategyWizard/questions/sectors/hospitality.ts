import { SectorQuestionConfig } from '../../types';

export const hospitalityConfig: SectorQuestionConfig = {
  sectorId: 'hospitality',

  intro: {
    script: "Otel, sadece bir yatak değil — bir vaattir. Verdiğiniz sözü taşıyabilecek misiniz?",
    text: "Bu interaktif deneyim, otelcilik ve turizm markanız için dijital stratejinin misafir beklentisiyle örtüşmesini, operasyonunuzun vaadinizi taşıyabilmesini ve doğru kitleye ulaşmanızı sağlamak için tasarlandı.",
  },

  stages: [
    // ========================================================================
    // AŞAMA 0: OPERASYONEL GERÇEKLİK
    // ========================================================================
    {
      intro: {
        script: "Booking'de 9.0 yazmak kolay, her misafirde 9.0 yaşatmak zor.",
        stageDescription: "Bu aşama, otelinizin misafir deneyimini operasyonel olarak ne kadar tutarlı sunabildiğini belirler. Dijital pazarlama beklentiyi artırır — hazırlıksız bir operasyon bu beklentiyi hayal kırıklığına çevirir.",
      },
      questions: [
        {
          type: 'selection_scored',
          script: "Misafir deneyiminiz odalar ve vardiyalar arasında ne kadar tutarlı?",
          text: "Deneyim Tutarlılığı",
          options: [
            { id: 'varies', title: "Odaya ve personele göre değişiyor", desc: "Her kat, her vardiya farklı standart", score: 0 },
            { id: 'similar', title: "Benzer ama değişken", desc: "Genel çerçeve var, bazen sapmalar oluyor", score: 1 },
            { id: 'mostly_stable', title: "Büyük ölçüde sabit", desc: "SOP mevcut, çoğu durumda tutarlı", score: 2 },
            { id: 'sop_defined', title: "SOP ile net tanımlı", desc: "Housekeeping, F&B, resepsiyon standartları yazılı", score: 3 },
          ],
        },
        {
          type: 'selection_scored',
          script: "Yüksek sezon veya tam dolulukta kalite nasıl?",
          text: "Yoğun Sezon Dayanıklılığı",
          options: [
            { id: 'collapses', title: "Ciddi düşüş yaşanıyor", desc: "Temizlik gecikiyor, servis yavaşlıyor, şikayetler artıyor", score: 0 },
            { id: 'struggling', title: "Zorlanıyor", desc: "Hissedilir kalite düşüşü ama idare ediliyor", score: 1 },
            { id: 'mostly_holds', title: "Çoğunlukla korunuyor", desc: "Küçük aksamalar ama genel standart stabil", score: 2 },
            { id: 'measured', title: "Kontrollü şekilde korunuyor", desc: "Revenue management ile doluluk optimize, kalite düşmüyor", score: 3 },
          ],
        },
        {
          type: 'selection_scored',
          script: "Başarılı bir dijital kampanya sonrası %30 rezervasyon artışı olsa ne olur?",
          text: "Talep Artışı Kapasitesi",
          options: [
            { id: 'cannot', title: "Karşılayamayız", desc: "Oda kapasitesi ve personel yetersiz", score: 0 },
            { id: 'partially', title: "Kısmen karşılarız", desc: "Bazı düzenlemelerle idare ederiz", score: 1 },
            { id: 'yes', title: "Evet, karşılarız", desc: "Kapasite ve ekip hazır", score: 2 },
          ],
        }
      ],
      educational: {
        script: "Booking puanı 8.5'un altına düştüğünde, organik görünürlük %40 azalır.",
        text: "Operasyonel Tutarlılık",
        stats: [
          {
            value: "76%",
            label: "OTA yorumlarına güvenen gezginler",
            description: "Gezginlerin %76'sı otel seçerken online yorumları arkadaş tavsiyesi kadar güvenilir buluyor.",
            source: "Kaynak: TripAdvisor Traveler Survey, 2024"
          },
          {
            value: "8.5",
            label: "Booking.com görünürlük eşiği",
            description: "8.5 puanın altındaki oteller Booking.com arama sonuçlarında %40 daha az görünür.",
            source: "Kaynak: Booking.com Partner Insights, 2024"
          },
          {
            value: "68%",
            label: "Tekrar gelmeyen misafirler",
            description: "İlk konaklamasında tutarsız deneyim yaşayan misafirlerin %68'i bir daha gelmiyor.",
            source: "Kaynak: Cornell Hospitality Quarterly, 2023"
          },
          {
            value: "3x",
            label: "Yeni misafir edinme maliyeti",
            description: "Yeni misafir edinmek, mevcut misafiri geri getirmekten 3 kat daha pahalı.",
            source: "Kaynak: Hotel Management Magazine, 2024"
          }
        ],
        caseStudy: {
          title: "Aman Resorts — Sessiz Mükemmellik",
          summary: "Aman hiç reklam yapmaz. Instagram'da nadiren paylaşım yapar. Ama her oteli, dünyanın neresinde olursa olsun, aynı sessiz lüksü sunar. Check-in'den check-out'a her detay SOP ile tanımlı. Misafir sürpriz yaşamaz — güven satın alır. Fiyatlar gecelik $1000+ ama doluluk oranları %85'in üzerinde. Tutarlılık, en güçlü pazarlama aracı.",
          outcome: "Sonuç: Operasyonel tutarlılık = organik büyüme. Reklam değil, deneyim konuşur.",
          type: 'success'
        },
        scenario: "Karşıt Örnek: Bir butik otel Instagram'da viral oldu. Rezervasyonlar patladı. Ama housekeeping ekibi yetersizdi, F&B hazır değildi. Booking puanı 8.8'den 7.2'ye düştü. Organik sıralama çöktü. Viral olmadan önceki durumdan daha gerideler.",
      },
      resultMatrix: [
        {
          minScore: 0,
          maxScore: 2,
          title: "Önce Operasyon",
          description: "Dijital pazarlama talebi artırır ama tutarsız operasyon bunu krize çevirir.",
          recommendations: [
            "Housekeeping, F&B, resepsiyon SOP'lerini yazılı hale getirin",
            "Misafir deneyimi kontrol listeleri oluşturun",
            "Personel eğitim programı başlatın",
            "Yoğun sezon kapasite planlaması yapın"
          ],
          caseStudy: {
            title: "Aman Resorts",
            summary: "Reklamdan çok SOP'ye yatırım yaptı. Tutarlılık = marka oldu.",
            outcome: "Misafir sürpriz değil, güven satın aldı.",
            type: 'success'
          }
        },
        {
          minScore: 3,
          maxScore: 6,
          title: "Kontrollü Büyüme",
          description: "Revenue management ile talep yönetimi, kademeli kampanyalar gerekir.",
          recommendations: [
            "Revenue management stratejisi geliştirin",
            "OTA ve direkt kanal dengesini optimize edin",
            "Kapasiteyi aşmayan kampanyalar planlayın",
            "Misafir memnuniyeti skorlarını düzenli takip edin"
          ]
        },
        {
          minScore: 7,
          maxScore: 8,
          title: "Hazır",
          description: "Marka anlatısı ve dijital strateji agresif biçimde büyütülebilir.",
          recommendations: [
            "Tam kapasiteli dijital pazarlama kampanyası",
            "Direkt rezervasyon oranını artırma stratejisi",
            "Sadakat programı geliştirme",
            "Marka hikayesi içerik üretimi"
          ]
        }
      ],
    },

    // ========================================================================
    // AŞAMA 1: MARKA RUHU
    // ========================================================================
    {
      intro: {
        script: "Misafir odayı unutur. Ama nasıl hissettirdiğinizi hatırlar.",
        stageDescription: "Bu aşama, otelinizin duygusal kimliğini ve misafirlerinizde yaratmak istediğiniz hissi tanımlar. Oda, yatak, havuz — bunları herkes sunar. Fark, hissettirdiklerinizde.",
      },
      questions: [
        {
          type: 'selection_list',
          script: "Oteliniz kapansa, misafir neyi kaybetmiş hisseder?",
          text: "Kayıp Duygusu",
          options: [
            { id: 'comfort', title: "Konfor", desc: "Bildiği, güvendiği, rahat ettiği yer" },
            { id: 'escape', title: "Kaçış", desc: "Günlük hayattan kopma, yenilenme" },
            { id: 'discovery', title: "Keşif", desc: "Yeni deneyimler, yerel kültür, macera" },
            { id: 'prestige', title: "Prestij", desc: "Statü, ayrıcalık, lüks" },
            { id: 'belonging', title: "Aidiyet", desc: "Ev sıcaklığı, tanınma, kişisel ilgi" },
          ],
        },
        {
          type: 'selection_list',
          script: "Misafirinize ne sunuyorsunuz?",
          text: "Konaklama Deneyimi",
          options: [
            { id: 'room_only', title: "Temiz oda, iyi yatak", desc: "Temel konaklama ihtiyacını karşılıyoruz" },
            { id: 'room_experience', title: "Konaklama + deneyim", desc: "Oda + restoran, spa, aktiviteler" },
            { id: 'full_journey', title: "Baştan sona tasarlanmış yolculuk", desc: "Check-in'den check-out'a her an sahnelenmiş" },
          ],
        },
        {
          type: 'selection_list',
          script: "Konaklama konseptiniz?",
          text: "Otel Konsepti",
          options: [
            { id: 'classic', title: "Klasik Otelcilik", desc: "Standart hizmet, güvenilir kalite" },
            { id: 'boutique', title: "Butik / Karakter", desc: "Özgün tasarım, hikaye, yerel doku" },
            { id: 'resort', title: "Resort / Tatil", desc: "All-inclusive, aile, eğlence" },
            { id: 'luxury', title: "Lüks / Premium", desc: "Ayrıcalık, kişiselleştirme, detay" },
            { id: 'experience', title: "Deneyim Oteli", desc: "Tema, konsept, yaşam tarzı" },
          ],
        }
      ],
      educational: {
        script: "Misafir odayı değil, hikayeyi paylaşır.",
        text: "Marka Ruhu",
        stats: [
          {
            value: "86%",
            label: "Deneyim için daha fazla ödeyen gezginler",
            description: "Gezginlerin %86'sı unutulmaz bir deneyim için standart konaklamadan daha fazla ödemeye razı.",
            source: "Kaynak: Skift Research, 2024"
          },
          {
            value: "5x",
            label: "Hikaye paylaşım oranı",
            description: "Misafirler oda fotoğraflarını değil, yaşadıkları deneyimleri 5 kat daha fazla sosyal medyada paylaşıyor.",
            source: "Kaynak: Instagram Travel Trends Report, 2024"
          },
          {
            value: "72%",
            label: "Kimlik arayan misafirler",
            description: "Gezginlerin %72'si konaklayacakları yerin net bir kimliği ve hikayesi olmasını istiyor.",
            source: "Kaynak: Booking.com Traveler Trends, 2024"
          },
          {
            value: "2.8x",
            label: "Konsept otellerin sadakat avantajı",
            description: "Net konsepte sahip oteller, genel otellere göre 2.8 kat daha yüksek tekrar ziyaret oranına sahip.",
            source: "Kaynak: Phocuswright Hotel Study, 2023"
          }
        ],
        caseStudy: {
          title: "The Hoxton — Yaşam Tarzı Oteli",
          summary: "The Hoxton bir otel olarak değil, bir yaşam tarzı olarak konumlandı. Lobi, mahalle kahvesi gibi tasarlandı — misafir olmayanlara da açık. Odalar küçük ama tasarım odaklı. Fiyatlar şeffaf, sürpriz yok. 'Açık ev' konsepti her detayda hissediliyor. Misafir sadece uyumaya değil, yaşamaya geliyor. Instagram'da otel değil, deneyim paylaşılıyor.",
          outcome: "Sonuç: Net konsept = organik büyüme. Reklam değil, kimlik konuşuyor.",
          type: 'success'
        },
        scenario: "Ruh Çatışması: Lüks dekor + all-inclusive kalabalık + butik iletişim. Misafir ne bekleyeceğini bilemez. Booking'de 'beklediğim gibi değildi' yorumları artar.",
      },
      resultMatrix: [
        {
          minScore: 0,
          maxScore: 999,
          title: "Marka Ruhu Profili",
          description: "Seçimlerinize göre otelinizin duygusal kimliği şekillendi.",
          recommendations: [
            "Konfor Limanı: Tutarlılık, güven, 'eviniz gibi'",
            "Kaçış Noktası: Detoks, yenilenme, günlükten kopuş",
            "Keşif Üssü: Yerel kültür, macera, rehberlik",
            "Prestij Sahnesi: Ayrıcalık, az konuş, kanıtla",
            "Aidiyet Evi: Kişisel ilgi, isimle hitap, hatırlama"
          ]
        }
      ],
    },

    // ========================================================================
    // AŞAMA 2: MARKA KARAKTERİ (ARKETİP)
    // ========================================================================
    {
      intro: {
        script: "Arketip, otelinizin güzel göründüğünde değil, şikayet aldığında kim olduğunu belirler.",
        stageDescription: "Bu aşama, markanızın kriz anlarındaki davranış tarzını tanımlar. TripAdvisor'da kötü yorum, odada sorun, geç check-in — bu anlarda markanız konuşur.",
      },
      questions: [
        {
          type: 'selection_list',
          script: "TripAdvisor'da 'Oda kirli, personel ilgisiz' yazan bir yorum geldi. İlk tepkiniz?",
          text: "Kriz Tepkisi",
          options: [
            { id: 'compensate', title: "Telafi eder", desc: "Özür diler, sonraki konaklama için indirim teklif eder (Bakıcı)" },
            { id: 'defend', title: "Standardı savunur", desc: "Standartlarımızı açıklar, kayıtları kontrol eder (Hükümdar)" },
            { id: 'explain', title: "Detaylı yanıtlar", desc: "Ne olduğunu araştırır, şeffaf açıklama yapar (Bilge)" },
            { id: 'redesign', title: "Süreci değiştirir", desc: "Yorumu fırsata çevirir, sistemi günceller (Yaratıcı)" },
            { id: 'challenge', title: "Meydan okur", desc: "Bakış açısını sorgular, kendi değerlerini savunur (Asi)" },
          ],
        },
        {
          type: 'selection_list',
          script: "Potansiyel misafiri nasıl ikna edersiniz?",
          text: "İkna Yöntemi",
          options: [
            { id: 'social_proof', title: "Sosyal kanıt", desc: "Yorumlar, puanlar, ödüller, medya" },
            { id: 'visual', title: "Görsel deneyim", desc: "Fotoğraf, video, sanal tur" },
            { id: 'story', title: "Hikaye", desc: "Otelin hikayesi, bölgenin ruhu, yerel bağ" },
            { id: 'guarantee', title: "Garanti", desc: "En iyi fiyat, iptal kolaylığı, memnuniyet garantisi" },
            { id: 'exclusivity', title: "Ayrıcalık", desc: "Sınırlı kapasite, özel deneyimler, VIP muamele" },
          ],
        },
        {
          type: 'selection_list',
          script: "İletişim tonunuz?",
          text: "Ton",
          options: [
            { id: 'warm', title: "Samimi & Sıcak", desc: "Ev sahipliği, kişisel, içten" },
            { id: 'prestigious', title: "Prestijli & Seçkin", desc: "Ayrıcalık, incelik, zarafet" },
            { id: 'adventurous', title: "Maceraperest & Enerjik", desc: "Keşif, heyecan, dinamik" },
            { id: 'minimal', title: "Minimal & Modern", desc: "Az söyle, çok göster, şık" },
            { id: 'local', title: "Yerel & Otantik", desc: "Bölgenin sesi, kültürel, samimi" },
          ],
        }
      ],
      educational: {
        script: "Kötü yoruma verdiğiniz cevap, otelinizin gerçek karakterini gösterir.",
        text: "Karakter Tutarlılığı",
        stats: [
          {
            value: "89%",
            label: "Yorum yanıtlarını okuyan gezginler",
            description: "Potansiyel misafirlerin %89'u otel yönetiminin kötü yorumlara verdiği yanıtları okuyor ve buna göre karar veriyor.",
            source: "Kaynak: TripAdvisor Management Response Study, 2024"
          },
          {
            value: "4.3x",
            label: "Tutarlı ton kullanan otellerin güveni",
            description: "Her platformda tutarlı iletişim tonu kullanan oteller, tutarsız olanlara göre 4.3 kat daha güvenilir algılanıyor.",
            source: "Kaynak: Revinate Guest Communication Study, 2023"
          },
          {
            value: "65%",
            label: "Yanıt sonrası düşüncesini değiştiren",
            description: "Kötü yorum okuyan potansiyel misafirlerin %65'i, profesyonel ve samimi bir yönetim yanıtı gördüğünde fikrini değiştiriyor.",
            source: "Kaynak: ReviewPro Hospitality Report, 2024"
          },
          {
            value: "71%",
            label: "Arketip uyumu bekleyen misafirler",
            description: "Misafirlerin %71'i otelin online iletişimiyle yerinde deneyiminin birbiriyle örtüşmesini bekliyor.",
            source: "Kaynak: McKinsey Hospitality Brand Study, 2023"
          }
        ],
        caseStudy: {
          title: "Four Seasons — Altın Standart Yanıt",
          summary: "Four Seasons'ın her kötü yoruma yaklaşımı aynı: İsimle hitap, samimi üzüntü, somut çözüm, geri davet. Hiçbir zaman savunmacı değil. Hiçbir zaman robotik değil. Her yanıt, otel müdürünün kişisel imzasıyla biter. Bu tutarlılık, onları TripAdvisor'da en yüksek yönetim yanıt kalitesine sahip zincir yaptı.",
          outcome: "Sonuç: Kriz anındaki tutarlı karakter, markanızı potansiyel misafire satıyor.",
          type: 'success'
        },
        scenario: "Arketip Çakışması: Instagram'da lüks ton, TripAdvisor'da savunmacı yanıtlar, resepsiyonda laubali tavır. Misafir zihninde bilişsel uyumsuzluk yaratır.",
      },
      resultMatrix: [
        {
          minScore: 0,
          maxScore: 999,
          title: "Marka Arketipi",
          description: "Kriz anında davranış şekliniz otelinizin karakterini ortaya koydu.",
          recommendations: [
            "Bakıcı: Ev sahipliği, sıcaklık, telafi",
            "Hükümdar: Standart, otorite, güvence",
            "Bilge: Şeffaflık, bilgi, açıklama",
            "Yaratıcı: Çözüm, inovasyon, esneklik",
            "Asi: Özgünlük, cesaret, farklılık"
          ]
        }
      ],
    },

    // ========================================================================
    // AŞAMA 3: KİM DEĞİLİZ (ANTI-PERSONA)
    // ========================================================================
    {
      intro: {
        script: "Her misafiri mutlu etmeye çalışan otel, hiçbir misafiri özel hissettirmez.",
        stageDescription: "Bu aşama, oteliniz için zararlı olan misafir profillerini belirlemenize yardımcı olur. Doğru misafiri çekmek, yanlış misafiri filtrelemekten başlar.",
      },
      questions: [
        {
          type: 'selection_list',
          script: "Hangi misafir tipi otelinize en çok zarar verir?",
          text: "En Zararlı Misafir",
          options: [
            { id: 'price_hunter', title: "Fiyat avcısı", desc: "Sadece en ucuz fırsatı arayan, otelinizin değerini görmeyen" },
            { id: 'ota_dependent', title: "OTA bağımlısı", desc: "Sadece son dakika fırsatıyla gelen, marka sadakati olmayan" },
            { id: 'complainer', title: "Profesyonel şikayetçi", desc: "Ücretsiz upgrade/indirim koparmak için her şeyi sorun yapan" },
            { id: 'culture_mismatch', title: "Kültür uyumsuz", desc: "Otelinizin konseptini anlamayan, farklı bir şey bekleyen" },
            { id: 'facility_abuser', title: "Tesis yıpratıcı", desc: "All-inclusive'de her şeyi sonuna kadar tüketen, tesisi yıpratan" },
          ],
        },
        {
          type: 'selection_list',
          script: "Bu misafir tipi hangi soruna yol açıyor?",
          text: "Sorun Tipi",
          options: [
            { id: 'profitability', title: "Kârlılık", desc: "RevPAR düşüyor, OTA komisyonları artıyor" },
            { id: 'experience', title: "Deneyim kalitesi", desc: "Diğer misafirlerin deneyimini bozuyor" },
            { id: 'reputation', title: "İtibar", desc: "Haksız kötü yorumlar, puan düşüşü" },
            { id: 'operations', title: "Operasyon", desc: "Ekstra iş yükü, personel motivasyon kaybı" },
          ],
        },
        {
          type: 'selection_list',
          script: "Bu duruma nasıl yaklaşırsınız?",
          text: "Filtreleme Yaklaşımı",
          options: [
            { id: 'pricing', title: "Fiyatlama ile filtreleme", desc: "Minimum konaklama, dinamik fiyatlama, paket yapı" },
            { id: 'positioning', title: "Konumlandırma ile filtreleme", desc: "İletişim tonu, görsel dil, hedef kitle mesajı" },
            { id: 'policy', title: "Politika ile filtreleme", desc: "Rezervasyon kuralları, depozit, iptal şartları" },
            { id: 'channel', title: "Kanal ile filtreleme", desc: "Direkt rezervasyon teşviki, belirli OTA'lardan çekilme" },
          ],
        }
      ],
      educational: {
        script: "En kârlı otel, en dolu otel değil — en doğru misafiri çeken oteldir.",
        text: "Misafir Filtreleme",
        stats: [
          {
            value: "45%",
            label: "OTA komisyon oranı etkisi",
            description: "OTA bağımlı otellerin net kârlılığı, direkt rezervasyon odaklı otellere göre %45 daha düşük.",
            source: "Kaynak: Phocuswright Distribution Study, 2024"
          },
          {
            value: "3.6x",
            label: "Doğru misafirin harcaması",
            description: "Hedef kitle tanımlı otellerde misafir başına harcama, genel otellere göre 3.6 kat daha yüksek.",
            source: "Kaynak: STR Hotel Performance Report, 2023"
          },
          {
            value: "82%",
            label: "Konsept uyumlu misafirlerin memnuniyeti",
            description: "Otel konseptiyle uyumlu misafirlerin %82'si 9+ puan veriyor ve tekrar geliyor.",
            source: "Kaynak: Revinate Guest Satisfaction Study, 2024"
          },
          {
            value: "28%",
            label: "Yanlış misafirin maliyeti",
            description: "Hedef kitle dışı misafirler, operasyonel maliyetleri ortalama %28 artırıyor.",
            source: "Kaynak: Hotel Revenue Management Journal, 2023"
          }
        ],
        caseStudy: {
          title: "Soho House — Üyelik Filtreleme",
          summary: "Soho House bir otel zinciri ama herkese açık değil. Üyelik başvurusu gerekiyor. Her başvuru değerlendiriliyor. Herkes kabul edilmiyor. Bu 'elitist' gibi görünebilir ama sonucu net: İçerideki herkes aynı kültürü paylaşıyor. Şikayet oranı düşük, memnuniyet yüksek. Üyeler marka elçisi oluyor. Bekleme listesi büyüyor.",
          outcome: "Sonuç: Doğru misafiri seçmek, doğru deneyimi yaratmanın önkoşulu.",
          type: 'success'
        },
        scenario: "RevPAR Tuzağı: Doluluk artırmak için flash sale yaptınız. Odalar doldu ama düşük fiyatlı misafirler F&B harcamadı, spa kullanmadı, kötü yorum bıraktı. RevPAR düştü, marka algısı zarar gördü.",
      },
      resultMatrix: [
        {
          minScore: 0,
          maxScore: 999,
          title: "Filtreleme Stratejisi",
          description: "İstenmeyen misafir profilini ve filtreleme yönteminizi tanımladınız.",
          recommendations: [
            "Fiyat Filtresi: Dinamik pricing, minimum stay, paketler",
            "Konumlandırma Filtresi: Görsel dil, ton, hedef mesaj",
            "Politika Filtresi: Depozit, iptal şartları, kurallar",
            "Kanal Filtresi: Direkt teşvik, OTA seçiciliği"
          ]
        }
      ],
    },

    // ========================================================================
    // AŞAMA 4: HEDEF VE BAŞARI
    // ========================================================================
    {
      intro: {
        script: "Doluluk mu, fiyat mı, itibar mı? Hedef belirsizse strateji de belirsizdir.",
        stageDescription: "Bu aşama, dijital stratejinizin birincil hedefini ve başarı metriklerinizi netleştirir. RevPAR mı, direkt rezervasyon oranı mı, Booking puanı mı? Her biri farklı strateji gerektirir.",
      },
      questions: [
        {
          type: 'selection_list',
          script: "Dijital stratejideki birincil hedefiniz?",
          text: "Birincil Hedef",
          options: [
            { id: 'occupancy', title: "Doluluk artışı", desc: "Boş oda oranını azaltmak" },
            { id: 'direct_booking', title: "Direkt rezervasyon", desc: "OTA bağımlılığını azaltmak, komisyon düşürmek" },
            { id: 'adr', title: "Ortalama oda fiyatı (ADR)", desc: "Fiyat algısını yükseltmek" },
            { id: 'reputation', title: "Online itibar", desc: "Booking/TripAdvisor puanlarını yükseltmek" },
            { id: 'brand', title: "Marka bilinirliği", desc: "Oteli/bölgeyi tanıtmak, akılda kalmak" },
          ],
        },
        {
          type: 'selection_list',
          script: "Büyüme hızı tercihiniz?",
          text: "Büyüme Hızı",
          options: [
            { id: 'fast', title: "Hızlı", desc: "Agresif kampanya, yüksek bütçe, hızlı sonuç" },
            { id: 'balanced', title: "Dengeli", desc: "Sürdürülebilir büyüme, kaliteyi koruyarak" },
            { id: 'exclusive', title: "Seçici", desc: "Yavaş ama premium, doğru kitleye odaklı" },
          ],
        },
        {
          type: 'selection_list',
          script: "6 ay sonra başarıyı neyle ölçersiniz?",
          text: "Başarı Metriği",
          options: [
            { id: 'occupancy_rate', title: "Doluluk oranı", desc: "Oda doluluğunda artış" },
            { id: 'revpar', title: "RevPAR artışı", desc: "Oda başı gelirde artış" },
            { id: 'direct_ratio', title: "Direkt/OTA oranı", desc: "Direkt rezervasyon payında artış" },
            { id: 'review_score', title: "Yorum puanı", desc: "Booking/Google/TripAdvisor puanı" },
            { id: 'repeat_guest', title: "Tekrar misafir oranı", desc: "Geri dönen misafir yüzdesi" },
          ],
        }
      ],
      educational: {
        script: "Doluluk, kârlılık demek değildir. Yanlış misafirle dolu otel, boş otelden daha zararlıdır.",
        text: "Başarı Tanımı",
        stats: [
          {
            value: "15-25%",
            label: "OTA komisyon aralığı",
            description: "OTA'lar oda başına %15-25 komisyon alıyor. Direkt rezervasyon oranını %10 artırmak, net kârı dramatik etkiliyor.",
            source: "Kaynak: Phocuswright OTA Commission Study, 2024"
          },
          {
            value: "4.2x",
            label: "Direkt misafirin sadakati",
            description: "Direkt kanaldan rezervasyon yapan misafirler, OTA üzerinden gelenlere göre 4.2 kat daha sık geri dönüyor.",
            source: "Kaynak: Kalibri Labs Direct Booking Study, 2023"
          },
          {
            value: "€2.5",
            label: "Yorum puanı başına gelir artışı",
            description: "Booking.com'da her 0.1 puanlık artış, oda fiyatında ortalama €2.5 artışa karşılık geliyor.",
            source: "Kaynak: Cornell Hotel Revenue Study, 2024"
          },
          {
            value: "73%",
            label: "Metriksiz strateji başarısızlığı",
            description: "Net başarı metriği tanımlamayan otellerin %73'ü dijital pazarlama yatırımının ROI'sini ölçemiyor.",
            source: "Kaynak: Hospitality Technology Magazine, 2024"
          }
        ],
        caseStudy: {
          title: "Citizen M — Direkt Rezervasyon Devrimi",
          summary: "Citizen M, OTA bağımlılığını kırmak için radikal bir karar aldı: Web sitesini en iyi fiyat garantisiyle yeniden tasarladı. Mobil check-in, oda kontrol uygulaması, sadakat programı — hepsi direkt kanalı cazip kılan araçlar. OTA'larda fiyatı %5-10 yükselttiler. Sonuç: Direkt rezervasyon oranı %65'e çıktı. OTA komisyon tasarrufu yılda milyonlarca euro.",
          outcome: "Sonuç: Hedef net olunca strateji de net. Direkt > OTA = kârlılık.",
          type: 'success'
        },
        scenario: "RevPAR Yanılgısı: Doluluk %95 ama ADR düşük, OTA komisyonları yüksek, F&B geliri sıfır. 'Başarılı' görünen otel, aslında en az kâr eden otel.",
      },
      resultMatrix: [
        {
          minScore: 0,
          maxScore: 999,
          title: "Strateji Modeli",
          description: "Hedef ve başarı tanımınız netleşti.",
          recommendations: [
            "Doluluk Motoru: Kampanya, paket, sezon stratejisi",
            "Direkt Kanal: Web optimizasyonu, sadakat, OTA bağımsızlık",
            "Fiyat Pozisyonu: ADR artışı, değer algısı, premium",
            "İtibar İnşası: Yorum yönetimi, memnuniyet, puanlama",
            "Marka Bilinirliği: İçerik, hikaye, sosyal medya"
          ]
        }
      ],
    },
  ],
};
