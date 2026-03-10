import { SectorQuestionConfig } from '../../types';

export const fmcgConfig: SectorQuestionConfig = {
  sectorId: 'fmcg',

  intro: {
    script: "Rafta 3 saniyeniz var. Bu 3 saniyede ya seçilirsiniz ya da görünmez olursunuz.",
    text: "Bu interaktif deneyim, gıda ve FMCG markanız için stratejik konumlandırma, görsel dil ve anlatısal dünyanın tutarlı, güçlü ve tüketicinin zihninde kalıcı olmasını sağlamak için tasarlandı.",
  },

  stages: [
    // ========================================================================
    // ASAMA 0: OPERASYONEL GERCEKLIK
    // ========================================================================
    {
      intro: {
        script: "Ambalaj ne kadar güzel olursa olsun, raf ömrü tutmuyorsa her şey çöpe gider.",
        stageDescription: "Bu aşama, markanızın vaatlerini operasyonel olarak taşıyıp taşıyamayacağınızı belirler. Talep artışına üretim ve dağıtım hazır değilse, pazarlama sadece hayal kırıklığı yaratır.",
      },
      questions: [
        {
          type: 'selection_scored',
          script: "Ürün kaliteniz partiden partiye ne kadar tutarlı?",
          text: "Üretim Tutarlılığı",
          options: [
            { id: 'varies', title: "Her parti farklı", desc: "Tat, doku veya görünüm partiler arasında belirgin fark gösteriyor", score: 0 },
            { id: 'similar', title: "Benzer ama değişken", desc: "Genel kalite var ama mevsimsel veya hammadde kaynaklı sapmalar oluyor", score: 1 },
            { id: 'mostly_stable', title: "Büyük ölçüde sabit", desc: "Standartlar var, nadiren sapma oluyor", score: 2 },
            { id: 'certified', title: "Sertifikalı kalite kontrol", desc: "ISO/HACCP standartlarında üretim, her parti test ediliyor", score: 3 },
            { id: 'other', title: "Diğer (Belirtin)", score: 0 }
          ],
          placeholder: "Durumunuzu açıklayın"
        },
        {
          type: 'selection_scored',
          script: "Bayram, sezon veya kampanya dönemlerinde üretim ve dağıtımınız ne durumda?",
          text: "Yoğun Dönem Kapasitesi",
          options: [
            { id: 'collapses', title: "Yetersiz kalıyor", desc: "Raf boş kalıyor, siparişler karşılanamıyor", score: 0 },
            { id: 'struggling', title: "Zorlanıyor", desc: "Gecikmeler oluyor, bazı noktalar stoksuz kalıyor", score: 1 },
            { id: 'mostly_holds', title: "Çoğunlukla karşılıyor", desc: "Küçük aksamalar olsa da genel dağıtım sağlanıyor", score: 2 },
            { id: 'planned', title: "Planlı kapasite", desc: "Yoğun dönemler için stok ve üretim planı var, dağıtım aksaksız", score: 3 },
            { id: 'other', title: "Diğer (Belirtin)", score: 0 }
          ],
          placeholder: "Durumunuzu açıklayın"
        },
        {
          type: 'selection_scored',
          script: "Bu çalışma sonrası talep %30 artarsa üretim ve dağıtımınız ne olur?",
          text: "Talep Artışı Kapasitesi",
          options: [
            { id: 'cannot', title: "Karşılayamayız", desc: "Üretim kapasitesi ve dağıtım ağı yetersiz", score: 0 },
            { id: 'partially', title: "Kısmen karşılarız", desc: "Bazı ürünlerde idare ederiz ama darboğazlar olur", score: 1 },
            { id: 'yes', title: "Evet, karşılarız", desc: "Üretim ölçeklenebilir, dağıtım ağı hazır", score: 2 },
            { id: 'other', title: "Diğer (Belirtin)", score: 0 }
          ],
          placeholder: "Durumunuzu açıklayın"
        }
      ],
      educational: {
        script: "Gıda sektöründe yeni ürünlerin %72'si ilk yıl raftan kalkıyor. Hayatta kalanların ortak özelliği: Sessizce altyapısını kuranlar.",
        text: "Operasyonel Tutarlılık",
        stats: [
          {
            value: "72%",
            label: "İlk yıl raftan kalkan yeni ürünler",
            description: "FMCG sektöründe yeni ürünlerin %72'si ilk yıl içinde raftan kaldırılıyor. Başarısızlığın 1 numaralı nedeni: üretim ve dağıtım tutarsızlığı.",
            source: "Kaynak: Nielsen New Product Innovation Report, 2023"
          },
          {
            value: "89%",
            label: "Raf boşluğu sonrası marka değiştiren tüketiciler",
            description: "Tüketicilerin %89'u aradığı ürünü rafta bulamazsa rakip markaya yöneliyor. Tek bir stoksuz kalma = kalıcı müşteri kaybı.",
            source: "Kaynak: IRI Shopper Survey, 2024"
          },
          {
            value: "3x",
            label: "Kalite tutarlılığının sadakate etkisi",
            description: "Her seferinde aynı tadı ve kaliteyi sunan gıda markaları, tutarsız olanlara göre 3 kat daha yüksek tekrar satın alma oranına sahip.",
            source: "Kaynak: Kantar Brand Footprint, 2024"
          },
          {
            value: "%35",
            label: "Viral kampanya sonrası stok krizi",
            description: "Viral olan gıda markalarının %35'i ilk 2 hafta içinde ciddi stok krizi yaşıyor. Talep patlamasına üretim yetişemiyor.",
            source: "Kaynak: Food Industry Association Report, 2024"
          }
        ],
        caseStudy: {
          title: "Felchlin: 100 Yıllık Tutarlılık",
          summary: "İsviçreli çikolata üreticisi Felchlin, dünya çapında premium kakao tedarik zinciri kurdu. Her parti aynı tadı garantiliyor. Hammadde kaynağı değişse bile formül adapte ediliyor. Sonuç: 100+ yıldır premium segmentte lider. Gıda sektöründe hızlı büyüme peşinde koşan markalar genellikle hammadde kalitesinden ödün veriyor. Tat değişince müşteri fark ediyor, güven kayboluyor. Üretim tutarlılığı olmadan marka vaadi boş kalır.",
          outcome: "Sonuç: Gıda sektöründe tutarlılık = güven. Bir kez tat değişirse müşteri geri gelmez.",
          type: 'success'
        },
        scenario: "Karşıt Örnek — Torku: Reklam bütçesi devasa değil ama her üründe aynı kaliteyi sunuyor. Çikolata, bisküvi, süt — hangi kategoride olursa olsun, Torku aldığınızda ne beklediğinizi bilirsiniz. Operasyonel tutarlılık, pazarlamanın yerini aldı.",
      },
      resultMatrix: [
        {
          minScore: 0,
          maxScore: 2,
          title: "Önce Operasyon",
          description: "Pazarlama talebi artırır ama aynı hızla problemi de büyütür.",
          recommendations: [
            "Kalite kontrol sistemlerini güçlendirin (HACCP, ISO)",
            "Tedarik zinciri güvenilirliğini artırın",
            "Üretim kapasite planlaması yapın",
            "Dağıtım ağını genişletmeden önce mevcut ağı stabilize edin"
          ],
          caseStudy: {
            title: "Torku",
            summary: "Reklam yerine üretim altyapısına yatırım yaptı. Tutarlı kalite = marka güveni.",
            outcome: "Tüketici 'sürpriz' değil güvenilir tat satın aldı.",
            type: 'success'
          }
        },
        {
          minScore: 3,
          maxScore: 6,
          title: "Kontrollü Büyüme",
          description: "Sınırlı dağıtım, net kapasite planı, kademeli genişleme gerekir.",
          recommendations: [
            "Bölgesel dağıtım stratejisiyle kademeli büyüyün",
            "Yoğun dönemler için stok tamponu oluşturun",
            "Üretim kapasitesini talep tahminiyle eşleştirin",
            "Kalite kontrolden ödün vermeden ölçeklenin"
          ]
        },
        {
          minScore: 7,
          maxScore: 8,
          title: "Hazır",
          description: "Marka anlatısı ve pazarlama stratejisi agresif biçimde büyütülebilir.",
          recommendations: [
            "Ulusal kampanya başlatın",
            "Yeni dağıtım kanalları açın (online, export)",
            "Ürün hattını genişletin",
            "Marka değeri yatırımını hızlandırın"
          ]
        }
      ],
    },

    // ========================================================================
    // ASAMA 1: MARKA RUHU
    // ========================================================================
    {
      intro: {
        script: "İnsanlar tadı unutabilir. Ama o ürünle yaşadıkları anı hatırlar.",
        stageDescription: "Bu aşama, markanızın duygusal kimliğini ve tüketicilerinizde yaratmak istediğiniz hissi tanımlar. Gıda sektöründe tat yetmez — anı, güven ve aidiyet hissi satarsınız.",
      },
      questions: [
        {
          type: 'selection_list',
          script: "Markanız raftan kaybolsa, tüketici neyi kaybetmiş hisseder?",
          text: "Kayıp Duygusu",
          options: [
            { id: 'trust', title: "Güven", desc: "Bildiği, her seferinde aynı tadı aldığı güvenilir bir seçenek" },
            { id: 'nostalgia', title: "Nostalji", desc: "Çocukluk anıları, aile sofra geleneği, duygusal bağ" },
            { id: 'discovery', title: "Keşif", desc: "Yeni tatlar, farklı deneyimler, merak uyandıran bir marka" },
            { id: 'health', title: "Sağlıklı yaşam", desc: "Güvenle tükettiği, sağlığına katkı sağladığını bildiği bir ürün" },
            { id: 'pride', title: "Gurur", desc: "Yerli üretim, kaliteli hammadde, paylaşmaktan gurur duyulan marka" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Hangi duyguyu yaratıyorsunuz?"
        },
        {
          type: 'selection_list',
          script: "Ürününüz tüketiciye ne sunuyor?",
          text: "Deneyim Seviyesi",
          options: [
            { id: 'basic', title: "Temel ihtiyaç", desc: "İyi bir ürün, uygun fiyat, işlevsel çözüm" },
            { id: 'quality_story', title: "Kalite + Hikaye", desc: "Ürün kalitesi artı kaynak, üretim veya marka hikayesi" },
            { id: 'lifestyle', title: "Yaşam tarzı", desc: "Ürünün ötesinde bir kimlik, topluluk, yaşam biçimi vaadi" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Deneyim seviyenizi tanımlayın"
        },
        {
          type: 'selection_list',
          script: "Ürün yaklaşımınız nedir?",
          text: "Ürün Felsefesi",
          options: [
            { id: 'traditional', title: "Geleneksel", desc: "Ata tarifi, otantik üretim, değişmeyen lezzet" },
            { id: 'modern_craft', title: "Modern zanaat", desc: "Geleneksel hammadde, modern teknik, premium sunum" },
            { id: 'innovative', title: "Yenilikçi", desc: "Yeni formüller, farklı kombinasyonlar, kategori kıran ürünler" },
            { id: 'clean_label', title: "Temiz etiket", desc: "Doğal, katkısız, minimal işlenmiş, şeffaf içerik" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Ürün felsefenizi tanımlayın"
        }
      ],
      educational: {
        script: "İnsanlar tadı unutabilir. Ama o ürünle yaşadıkları anı hatırlar.",
        text: "Marka Ruhu",
        stats: [
          {
            value: "78%",
            label: "Hikayesi olan gıda markalarına güven",
            description: "Tüketicilerin %78'i üretim hikayesini, kaynağını ve değerlerini paylaşan gıda markalarına daha fazla güveniyor.",
            source: "Kaynak: Label Insight Food Transparency Study, 2024"
          },
          {
            value: "4.2x",
            label: "Duygusal bağ kuran markaların satışı",
            description: "Tüketiciyle duygusal bağ kuran gıda markaları, sadece fiyat ve kaliteyle rekabet edenlere göre 4.2 kat daha yüksek marka sadakatine sahip.",
            source: "Kaynak: Deloitte Consumer Products Study, 2023"
          },
          {
            value: "63%",
            label: "Yerel ve zanaat markalarına yönelen tüketiciler",
            description: "Tüketicilerin %63'ü büyük markalar yerine yerel, zanaat üretimi ve hikayesi olan markaları tercih etmeye başladı.",
            source: "Kaynak: Mintel Food & Drink Trends, 2024"
          },
          {
            value: "2.8x",
            label: "Şeffaf markaların premium fiyat avantajı",
            description: "İçerik ve kaynak şeffaflığı sunan gıda markaları, opak olanlara göre 2.8 kat daha yüksek fiyat kabul oranına sahip.",
            source: "Kaynak: FMI Transparency Imperative Report, 2023"
          }
        ],
        caseStudy: {
          title: "Innocent Drinks — Sadelik ve Samimiyet",
          summary: "Innocent Drinks 1999'da 3 arkadaş tarafından kuruldu. Bir müzik festivalinde 'İşimizi bırakıp smoothie mi satsak?' yazan iki çöp kutusu koydular: EVET ve HAYIR. EVET kutusu doldu. Her ambalajda samimi notlar, her sosyal medya paylaşımında insan sesi. Ürün basit: meyve, meyve suyu, başka bir şey yok. Marka hikayesi tutarlı: sade, dürüst, samimi. Coca-Cola satın aldığında bile bu kimliği korudular.",
          outcome: "Sonuç: Sadelik ve samimiyet, dev rakiplerin yanında hayatta kalmalarını sağladı. Hikaye tutarlıysa marka büyüklükten bağımsız yaşar.",
          type: 'success'
        },
        scenario: "Ruh Çatışması: Bir fındık ezmesi markası ambalajda 'doğal, katkısız, geleneksel' yazıyor ama içerik listesinde palm yağı ve şeker ilk sırada. Tüketici etiketi okuduğunda güven kırılıyor. Bir daha almıyor.",
      },
      resultMatrix: [
        {
          minScore: 0,
          maxScore: 999,
          title: "Marka Ruhu Profili",
          description: "Seçimlerinize göre marka ruhunuz şekillendi.",
          recommendations: [
            "Güven Limanı: Tutarlı kalite, şeffaf içerik, 'her seferinde aynı' vaadi",
            "Nostalji Bağı: Aile, gelenek, çocukluk, duygusal anlatı",
            "Keşif Alanı: Yeni tatlar, limitli üretimler, merak uyandırma",
            "Sağlık Vaadi: Bilimsel destek, temiz etiket, fonksiyonel fayda",
            "Gurur Kaynağı: Yerli üretim, kaliteli hammadde, milli değer"
          ]
        }
      ],
    },

    // ========================================================================
    // ASAMA 2: MARKA KARAKTERI (ARKETIP)
    // ========================================================================
    {
      intro: {
        script: "Arketip, markanızın rafta değil, kriz anında kim olduğunu belirler.",
        stageDescription: "Bu aşama, markanızın davranış tarzını ve kriz anlarındaki tepkilerini tanımlar. Ürün geri çağırma, kalite şikayeti, rakip saldırısı — bu anlarda kim olduğunuz ortaya çıkar.",
      },
      questions: [
        {
          type: 'selection_list',
          script: "Sosyal medyada bir tüketici ürününüzde yabancı madde bulduğunu iddia etti. İlk tepkiniz ne olur?",
          text: "Kriz Tepkisi",
          options: [
            { id: 'compensate', title: "Hemen telafi eder", desc: "Özür diler, ürünü değiştirir, ekstra jest yapar (Bakıcı)" },
            { id: 'defend', title: "Kalite standardını savunur", desc: "Üretim süreçlerimizi ve kontrol noktalarımızı açıklar (Hükümdar)" },
            { id: 'explain', title: "Şeffaf açıklama yapar", desc: "Üretim sürecini, test sonuçlarını kamuoyuyla paylaşır (Bilge)" },
            { id: 'challenge', title: "Kanıt ister", desc: "Doğrulamadan kabul etmez, bağımsız test talep eder (Asi)" },
            { id: 'redesign', title: "Süreci yeniden tasarlar", desc: "Sorunu kabul eder ve kalite kontrol sürecini günceller (Yaratıcı)" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Kriz tepkinizi açıklayın"
        },
        {
          type: 'selection_list',
          script: "Marka iletişim tonunuz nasıl?",
          text: "Ton",
          options: [
            { id: 'minimal', title: "Minimal", desc: "Az söyle, ürün konuşsun. Kalite kendini anlatır" },
            { id: 'warm', title: "Samimi", desc: "Aile havası, sofra sıcaklığı, içten dil" },
            { id: 'expert', title: "Uzman", desc: "Bilgi odaklı, teknik detay, hammadde uzmanlığı" },
            { id: 'provocative', title: "Cesur", desc: "Endüstri normlarına meydan okuyan, fark yaratan" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "İletişim tonunuzu tanımlayın"
        }
      ],
      educational: {
        script: "Arketip, markanızın rafta değil, kriz anında kim olduğunu belirler.",
        text: "Karakter Tutarlılığı",
        stats: [
          {
            value: "81%",
            label: "Tutarlı karakter bekleyen tüketiciler",
            description: "Tüketicilerin %81'i bir gıda markasının ambalajda, reklamda ve sosyal medyada aynı kişiliği sergilemesini bekliyor.",
            source: "Kaynak: Lucidpress Brand Consistency Report, 2023"
          },
          {
            value: "7x",
            label: "Kriz yönetimi başarılı markaların toparlanması",
            description: "Kriz anında tutarlı ve şeffaf davranan gıda markaları, suskunluk tercih edenlere göre 7 kat daha hızlı güven tazeliyorlar.",
            source: "Kaynak: Institute for Crisis Management, 2024"
          },
          {
            value: "93%",
            label: "Karakter tutarlılığının güvene etkisi",
            description: "Gıda markalarının %93'ü karakter tutarlılığının tüketici güvenini doğrudan etkilediğini raporluyor.",
            source: "Kaynak: Food Marketing Institute Trust Study, 2023"
          },
          {
            value: "55%",
            label: "Ton çakışması yaşayan markaların kaybı",
            description: "Tüketicilerin %55'i bir gıda markasında ton çakışması (örn. 'doğal' vaadi + sentetik içerik) fark ettiğinde markayı kalıcı olarak terk ediyor.",
            source: "Kaynak: Euromonitor Consumer Insights, 2024"
          }
        ],
        caseStudy: {
          title: "Nutella — Kriz Anında Kimlik",
          summary: "Nutella'nın palm yağı tartışması patladığında marka suskunluk seçebilirdi. Bunun yerine Ferrero, palm yağı tedarik zincirinin şeffaf bir haritasını yayınladı. Sürdürülebilirlik sertifikalarını gösterdi. Formülü savundu ama eleştirileri de dinledi. Karakter netti: 'Bilge + Hükümdar' — bilgiyle savunma, standartla güvence. Kriz geçti, marka güçlendi. Çünkü kriz anında kim olduklarını biliyorlardı.",
          outcome: "Sonuç: Kriz anında tutarlı kimlik, güveni kırmak yerine pekiştirir. Suskunluk en kötü stratejidir.",
          type: 'success'
        },
        scenario: "Arketip Çakışması: Bir gıda markası ambalajda 'zanaat üretim' yazıyor ama fabrikada endüstriyel üretim yapıyor. Bir food blogger fabrikayı ziyaret edip gerçeği paylaşıyor. Tüketici aldatılmış hissediyor. Marka yılların güvenini bir gecede kaybediyor.",
      },
      resultMatrix: [
        {
          minScore: 0,
          maxScore: 999,
          title: "Marka Arketipi",
          description: "Kriz anında davranış şekliniz karakterinizi ortaya koydu.",
          recommendations: [
            "Bakıcı: Koşulsuz müşteri memnuniyeti, sofra sıcaklığı, 'aile markası'",
            "Hükümdar: Kalite standardı, sertifika, endüstri lideri otorite",
            "Bilge: Şeffaflık, hammadde eğitimi, bilgiyle güven inşası",
            "Asi: Endüstri normlarına meydan okuma, temiz etiket devrimi",
            "Yaratıcı: İnovasyon, yeni tatlar, kategori oluşturma"
          ]
        }
      ],
    },

    // ========================================================================
    // ASAMA 3: KIM DEGILIZ (ANTI-PERSONA)
    // ========================================================================
    {
      intro: {
        script: "Her rafa girmek isteyen marka, hiçbir rafta vazgeçilmez olmaz.",
        stageDescription: "Bu aşama, markanız için zararlı olan tüketici ve kanal profillerini belirlemenize yardımcı olur. Herkese satmak, kimse için özel olmamak demektir.",
      },
      questions: [
        {
          type: 'selection_list',
          script: "Hangi müşteri tipi markanıza en çok zarar verir?",
          text: "En Zararlı Tüketici Tipi",
          options: [
            { id: 'price_only', title: "Sadece fiyat odaklı", desc: "En ucuzu arayan, kalite farkını önemsemeyen" },
            { id: 'disloyal', title: "Kampanya bağımlısı", desc: "Sadece indirimde alan, marka sadakati olmayan" },
            { id: 'trend_chaser', title: "Trend takipçisi", desc: "Her yeni markayı deneyen ama hiçbirine sadık kalmayan" },
            { id: 'copycat_buyer', title: "Market markası tercihçisi", desc: "Her zaman private label / beyaz etiket tercih eden" },
            { id: 'misinformed', title: "Yanlış bilgilenmiş", desc: "Sosyal medya trendlerine göre karar veren, bilimsel temeli sorgulamayan" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Zararlı tüketici tipini tanımlayın"
        },
        {
          type: 'selection_list',
          script: "Bu tüketici tipi hangi soruna yol açıyor?",
          text: "Sorun Tipi",
          options: [
            { id: 'margin', title: "Kâr marjı", desc: "Fiyat baskısı, sürekli promosyon ihtiyacı" },
            { id: 'perception', title: "Marka algısı", desc: "Premium konumlandırmayı zayıflatıyor" },
            { id: 'instability', title: "Talep istikrarsızlığı", desc: "Kampanya varken satış yükseliyor, yokken çöküyor" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Sorun tipini açıklayın"
        },
        {
          type: 'selection_list',
          script: "Bu duruma nasıl yaklaşırsınız?",
          text: "Yaklaşım Tavırı",
          options: [
            { id: 'positioning', title: "Konumlandırma ile filtreleme", desc: "Fiyat, ambalaj ve iletişimle doğru kitleyi çekme" },
            { id: 'channel', title: "Kanal stratejisi", desc: "Belirli mağaza/market zincirleri, seçici dağıtım" },
            { id: 'product_line', title: "Ürün hattı ayrımı", desc: "Premium ve giriş seviye ayrı markalar/alt hatlar" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Yaklaşım tavırınızı açıklayın"
        }
      ],
      educational: {
        script: "Her rafa girmek isteyen marka, hiçbir rafta vazgeçilmez olmaz.",
        text: "Filtreleme Stratejisi",
        stats: [
          {
            value: "76%",
            label: "Promosyon bağımlılığının kâr etkisi",
            description: "Sürekli promosyona bağımlı gıda markalarının kâr marjı, promosyonsuz satış yapanlara göre %76 daha düşük.",
            source: "Kaynak: BCG Pricing Excellence in CPG, 2024"
          },
          {
            value: "4x",
            label: "Seçici dağıtım yapan markaların sadakati",
            description: "Seçici dağıtım ve kanal stratejisi olan gıda markaları, her yerde bulunmaya çalışanlara göre 4 kat daha yüksek marka sadakatine sahip.",
            source: "Kaynak: Bain & Company FMCG Strategy Report, 2023"
          },
          {
            value: "43%",
            label: "Private label'a kaybedilen pazar payı",
            description: "Fiyatla rekabet etmeye çalışan orta segment gıda markalarının %43'ü market markaları karşısında pazar payı kaybediyor.",
            source: "Kaynak: PLMA International Private Label Yearbook, 2024"
          },
          {
            value: "88%",
            label: "Premium gıda markalarının kanal seçiciliği",
            description: "Başarılı premium gıda markalarının %88'i aktif kanal filtreleme stratejisi uyguluyor.",
            source: "Kaynak: Specialty Food Association Market Report, 2023"
          }
        ],
        caseStudy: {
          title: "Nespresso — Kanal ve Müşteri Filtreleme",
          summary: "Nespresso kapsül kahveyi icat ettiğinde süpermarket rafına koymadı. Kendi mağazaları ve online satış kanalı kurdu. Üyelik sistemi oluşturdu. Fiyatı hiçbir zaman düşürmedi. Kampanya yapmadı. Promosyon bağımlısı tüketiciyi filtreledi. Sonuç: Kahve kapsülü pazarının %50'si Nespresso'nun. En ucuz değil, en değerli. Çünkü herkese satmaya çalışmadı.",
          outcome: "Sonuç: Seçici dağıtım ve fiyat tutarlılığı, doğru müşteriyi çekti. Premium = erişilemezlik değil, değer.",
          type: 'success'
        },
        scenario: "Karşıt Örnek — Fiyat Savaşı Tuzağı: Bir fındık ezmesi markası discount markete girdi. Fiyatı %30 düşürdü. Satış patladı ama kâr eridi. Market, private label alternatif çıkardı, %50 daha ucuz. Marka artık ne premium ne ucuz. Müşteri kafası karıştı. İki yıl sonra raftan kaldırıldı.",
      },
      resultMatrix: [
        {
          minScore: 0,
          maxScore: 999,
          title: "Filtreleme Stratejisi",
          description: "İstemediğiniz tüketici tipini ve kanal stratejinizi tanımladınız.",
          recommendations: [
            "Konumlandırma Filtresi: Fiyat, ambalaj ve iletişimle hedef kitleyi çekme",
            "Kanal Stratejisi: Seçici dağıtım, doğru raf, doğru market",
            "Ürün Hattı Ayrımı: Premium hat ve giriş seviye ayrı markalar"
          ]
        }
      ],
    },

    // ========================================================================
    // ASAMA 4: HEDEF VE BASARI
    // ========================================================================
    {
      intro: {
        script: "Raf payı mı istiyoruz, marka değeri mi, sadakat mi? Hedef belirsizse her yatırım israftır.",
        stageDescription: "Bu aşama, bu projenin birincil hedefini ve başarı metriklerinizi netleştirir. Raf payı mı, marka bilinirliği mi, tüketici sadakati mi? Hedef belirsizse strateji de belirsiz olur.",
      },
      questions: [
        {
          type: 'selection_list',
          script: "Bu projedeki birincil hedefiniz?",
          text: "Birincil Hedef",
          options: [
            { id: 'awareness', title: "Marka bilinirliği", desc: "Markanın adını duyurmak, geniş kitlelere ulaşmak" },
            { id: 'shelf_share', title: "Raf payı", desc: "Daha fazla satış noktasına girmek, raf alanını genişletmek" },
            { id: 'premium', title: "Premium algı", desc: "Fiyat kabulünü artırmak, rakiplerden ayrışmak" },
            { id: 'loyalty', title: "Tüketici sadakati", desc: "Tekrar satın alma, ağızdan ağıza yayılma" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Hedefiniz nedir?"
        },
        {
          type: 'selection_list',
          script: "Büyüme stratejiniz?",
          text: "Büyüme Hızı",
          options: [
            { id: 'fast', title: "Hızlı penetrasyon", desc: "Agresif dağıtım, kampanya, hızlı büyüme" },
            { id: 'balanced', title: "Dengeli büyüme", desc: "Sürdürülebilir genişleme, kaliteden ödün vermeden" },
            { id: 'niche', title: "Niş derinleşme", desc: "Dar segment, derin bağ, yüksek değer" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Büyüme stratejiniz?"
        },
        {
          type: 'selection_list',
          script: "Başarı sizin için ne demek?",
          text: "Başarı İşareti",
          options: [
            { id: 'distribution', title: "Dağıtım genişliği", desc: "Daha fazla market, daha fazla şehir, daha fazla raf" },
            { id: 'repeat_purchase', title: "Tekrar satın alma", desc: "Tüketicinin düzenli olarak ürünü tercih etmesi" },
            { id: 'price_premium', title: "Fiyat primi", desc: "Rakiplerden daha yüksek fiyata satabilme" },
            { id: 'category_leader', title: "Kategori liderliği", desc: "Segment birincisi olma, referans marka olma" },
            { id: 'export', title: "İhracat", desc: "Uluslararası pazarlara açılma" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Başarı tanımınız?"
        }
      ],
      educational: {
        script: "Viral olmak bir hedef değil, stres testidir. Hedef net olmazsa rafta görünmez olursunuz.",
        text: "Başarı Tanımı",
        stats: [
          {
            value: "69%",
            label: "Net hedefi olmayan gıda markaları",
            description: "Gıda markalarının %69'u 'satış artışı' ve 'marka bilinirliği' hedeflerini karıştırıyor. Sonuç: tutarsız kampanyalar ve kaynak israfı.",
            source: "Kaynak: Deloitte Consumer Products Outlook, 2024"
          },
          {
            value: "3.5x",
            label: "Net KPI'lı markaların büyümesi",
            description: "Net başarı metrikleri tanımlayan gıda markaları, belirsiz hedefli olanlara göre 3.5 kat daha hızlı büyüyor.",
            source: "Kaynak: BCG FMCG Growth Index, 2023"
          },
          {
            value: "84%",
            label: "Tekrar satın alımın kâra etkisi",
            description: "Gıda sektöründe kârın %84'ü tekrar satın alan müşterilerden geliyor. Yeni müşteri kazanmak, mevcut müşteriyi elde tutmaktan 5 kat daha pahalı.",
            source: "Kaynak: Kantar Worldpanel FMCG Report, 2024"
          },
          {
            value: "%27",
            label: "İhracat ile büyüyen gıda markaları",
            description: "Türk gıda sektöründe ihracata yönelen markaların cirosu son 3 yılda ortalama %27 arttı.",
            source: "Kaynak: TIM Gıda Sektörü İhracat Raporu, 2024"
          }
        ],
        caseStudy: {
          title: "Tariş Zeytin — Yerel'den Globale",
          summary: "Tariş uzun yıllar sadece yerel pazarda satış yaptı. Hedef netti: önce iç pazarda güven, sonra ihracat. Kalite standartlarını uluslararası seviyeye çıkardı (organik sertifika, coğrafi işaret). Ambalajı modernize etti ama hikayesini korudu: Ege'nin zeytini, kooperatif üretimi, üreticinin hakkı. Bugün 40+ ülkeye ihracat yapıyor. Her adımda hedef netti: 'Ege zeytininin dünya markası olmak.'",
          outcome: "Sonuç: Net hedef, tutarlı adımlar. Önce operasyon, sonra pazarlama, sonra ihracat. Sıra atlamadılar.",
          type: 'success'
        },
        scenario: "Karşıt Örnek — Her Şeyi Bir Anda İsteme: Bir fındık ezmesi markası aynı anda ihracat, ulusal dağıtım, premium konumlandırma ve en düşük fiyat hedefliyor. Kampanyalar çelişiyor: Bir ay 'zanaat üretim' reklamı, ertesi ay '%50 indirim' afişi. Tüketici kafası karışıyor. Rakip seçiyor.",
      },
      resultMatrix: [
        {
          minScore: 0,
          maxScore: 999,
          title: "Strateji Modeli",
          description: "Hedef ve başarı tanımınız netleşti.",
          recommendations: [
            "Dağıtım Motoru: Raf payı genişletme, yeni kanal açma, penetrasyon",
            "Sadakat Makinesi: Tekrar satın alma, topluluk, ağızdan ağıza",
            "Premium İnşası: Fiyat primi, kalite algısı, seçici dağıtım",
            "İhracat Köprüsü: Uluslararası sertifikalar, pazar araştırması, adaptasyon"
          ]
        }
      ],
    },
  ],
};
