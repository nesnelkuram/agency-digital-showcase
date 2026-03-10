import { SectorQuestionConfig } from '../../types';

export const techConfig: SectorQuestionConfig = {
  sectorId: 'tech',

  intro: {
    script: "Harika bir ürün, kötü bir markayı kurtarabilir. Ama harika bir marka, kötü bir ürünü asla kurtaramaz.",
    text: "Bu interaktif deneyim, teknoloji markanız için üretilecek görsel ve anlatısal dünyanın tutarlı, güvenilir ve ölçeklenebilir olmasını sağlamak için tasarlandı.",
  },

  stages: [
    // ========================================================================
    // AŞAMA 0: OPERASYONEL GERÇEKLİK
    // ========================================================================
    {
      intro: {
        script: "Kullanıcı deneyiminiz vaatlerinizi taşıyamazsa, pazarlama sadece hayal kırıklığını hızlandırır.",
        stageDescription: "Bu aşama, ürününüzün operasyonel olgunluğunu ve ölçeklenme kapasitesini belirler. Pazarlama talebi artırır, ancak altyapısı hazır olmayan bir ürün bu talebi krize dönüştürür.",
      },
      questions: [
        {
          type: 'selection_scored',
          script: "Kullanıcı deneyiminiz farklı platformlar ve cihazlar arasında ne kadar tutarlı?",
          text: "Deneyim Tutarlılığı",
          options: [
            { id: 'inconsistent', title: "Cihaza göre değişiyor", desc: "Her platformda farklı deneyim, tutarsız UI/UX", score: 0 },
            { id: 'mostly_similar', title: "Benzer ama değişken", desc: "Genel tasarım aynı ama performans ve özellikler cihaza göre farklı", score: 1 },
            { id: 'largely_stable', title: "Büyük ölçüde sabit", desc: "Responsive tasarım var, küçük sapmalar oluyor", score: 2 },
            { id: 'design_system', title: "Design system ile kontrollü", desc: "Tüm platformlarda tutarlı deneyim, design system ve component library var", score: 3 },
            { id: 'other', title: "Diğer (Belirtin)", score: 0 }
          ],
          placeholder: "Durumunuzu açıklayın"
        },
        {
          type: 'selection_scored',
          script: "Launch day veya beklenmedik trafik artışında ürününüz nasıl performans gösteriyor?",
          text: "Yoğunluk/Ölçeklenme Dayanıklılığı",
          options: [
            { id: 'crashes', title: "Çöküyor", desc: "Sunucular düşüyor, kullanıcılar erişemiyor", score: 0 },
            { id: 'degrades', title: "Belirgin yavaşlama", desc: "Sayfa yükleme süreleri artıyor, timeout hataları oluyor", score: 1 },
            { id: 'mostly_holds', title: "Çoğunlukla dayanıyor", desc: "Auto-scaling var ama bazen gecikmeler yaşanıyor", score: 2 },
            { id: 'resilient', title: "Ölçümlü şekilde dayanıklı", desc: "Load balancing, CDN, auto-scaling; SLA garantili uptime", score: 3 },
            { id: 'other', title: "Diğer (Belirtin)", score: 0 }
          ],
          placeholder: "Durumunuzu açıklayın"
        },
        {
          type: 'selection_scored',
          script: "Kullanıcı tabanınız 10x artsa ne olur?",
          text: "10x Büyüme Kapasitesi",
          options: [
            { id: 'cannot', title: "Karşılayamayız", desc: "Mevcut altyapı ve ekip yetersiz kalır", score: 0 },
            { id: 'partially', title: "Kısmen karşılarız", desc: "Teknik olarak ölçeklenir ama destek/onboarding aksar", score: 1 },
            { id: 'ready', title: "Evet, hazırız", desc: "Altyapı, ekip ve süreçler ölçeklenmeye hazır", score: 2 },
            { id: 'other', title: "Diğer (Belirtin)", score: 0 }
          ],
          placeholder: "Durumunuzu açıklayın"
        }
      ],
      educational: {
        script: "İki startup hikayesi: Biri Product Hunt'ta patlayıp çöktü, diğeri sessizce ölçeklendi. Sadece biri bugün hala ayakta.",
        text: "Operasyonel Dayanıklılık",
        stats: [
          {
            value: "90%",
            label: "Başarısız olan startuplar",
            description: "Startupların %90'ı başarısız oluyor. En yaygın nedenlerden biri: ürün-pazar uyumundan önce ölçeklenmeye çalışmak.",
            source: "Kaynak: CB Insights Startup Failure Report, 2023"
          },
          {
            value: "88%",
            label: "Performans beklentisi",
            description: "Kullanıcıların %88'i yavaş yüklenen veya çöken bir uygulamaya bir daha dönmüyor. İlk izlenim = son izlenim.",
            source: "Kaynak: Google/SOASTA Mobile Page Speed Study, 2023"
          },
          {
            value: "5x",
            label: "Design system etkisi",
            description: "Design system kullanan şirketler, kullanmayanlara göre 5 kat daha hızlı yeni özellik çıkarabiliyor. Tutarlılık = hız.",
            source: "Kaynak: Figma State of Design Systems, 2024"
          },
          {
            value: "%40",
            label: "Launch day çöküşleri",
            description: "Yüksek beklentili launch'ların %40'ında trafik spike'ı nedeniyle ciddi performans sorunları yaşanıyor.",
            source: "Kaynak: AWS Launch Day Performance Report, 2024"
          }
        ],
        caseStudy: {
          title: "Clubhouse — Hype Sonrası Çöküş",
          summary: "Clubhouse 2021'de patladı. Davetiye sistemiyle FOMO yarattı, milyonlarca kullanıcı aynı anda akın etti. Sunucular zorlandı, odalar çöktü, ses kalitesi düştü. Ama asıl sorun daha derindeydi: Ölçeklenen kullanıcı tabanına karşılık özellik seti sığdı. Retention düştü, kullanıcılar geldi ama bir daha açmadı. Twitter Spaces ve Spotify Greenroom fırsatı kaptı. Hype kendi kendini yedi.",
          outcome: "Sonuç: Hype ölçeklenemezse çöker. Altyapı ve ürün deneyimi talebi taşıyamazsa, büyüme kendi kendini yok eder.",
          type: 'failure'
        },
        scenario: "Karşıt Örnek — Notion: Yıllarca beta'da kaldı. Ürünü mükemmelleştirdi, topluluk organik büyüdü. Launch günü değil, her gün tutarlı deneyim sundu. Kullanıcılar kendileri tavsiye etti. Operasyonel hazırlık = sürdürülebilir büyüme.",
      },
      resultMatrix: [
        {
          minScore: 0,
          maxScore: 2,
          title: "Önce Altyapı",
          description: "Pazarlama talebi artırır ama altyapınız bu talebi taşıyamaz. Önce temeli sağlamlaştırın.",
          recommendations: [
            "Performans ve uptime monitoring sistemi kurun",
            "Design system ve component library oluşturun",
            "Auto-scaling ve load balancing altyapısını hazırlayın",
            "Kullanıcı onboarding sürecini standardize edin"
          ],
          caseStudy: {
            title: "Notion",
            summary: "Yıllarca ürünü mükemmelleştirdi, altyapıyı sağlamlaştırdı. Launch değil, tutarlılık büyüttü.",
            outcome: "Operasyonel hazırlık, organik büyümeyi sürdürülebilir kıldı.",
            type: 'success'
          }
        },
        {
          minScore: 3,
          maxScore: 6,
          title: "Kontrollü Büyüme",
          description: "Altyapınız temel düzeyde hazır ama ölçeklenme öncesi iyileştirme gerekiyor.",
          recommendations: [
            "Kademeli rollout stratejisi uygulayın (beta, early access)",
            "Kullanıcı segmentasyonu ile kontrollü büyüme planlayın",
            "Performans testleri ve stres testleri yapın",
            "Destek ve onboarding süreçlerini otomatize edin"
          ]
        },
        {
          minScore: 7,
          maxScore: 8,
          title: "Ölçeklenmeye Hazır",
          description: "Altyapı ve süreçler sağlam. Agresif büyüme stratejisi uygulanabilir.",
          recommendations: [
            "Tam kapasiteli büyüme kampanyası başlatın",
            "Viral loop ve referral mekanizmaları kurun",
            "Uluslararası genişleme planları yapın",
            "Marka değeri ve konumlandırma yatırımı artırın"
          ]
        }
      ],
    },

    // ========================================================================
    // AŞAMA 1: MARKA RUHU
    // ========================================================================
    {
      intro: {
        script: "İnsanlar özellik listesini unutur. Ama ürününüzün onları nasıl hissettirdiğini hatırlar.",
        stageDescription: "Bu aşama, markanızın duygusal kimliğini ve kullanıcılarınızda yaratmak istediğiniz hissi tanımlar. Özellikler kopyalanır, ama ruh kopyalanamaz.",
      },
      questions: [
        {
          type: 'selection_list',
          script: "Ürününüz yarın kaybolsa, kullanıcı neyi kaybetmiş hisseder?",
          text: "Kayıp Duygusu",
          options: [
            { id: 'innovation', title: "İnovasyon", desc: "Başka hiçbir yerde bulamayacağı yenilikçi yaklaşım" },
            { id: 'reliability', title: "Güvenilirlik", desc: "Her zaman çalışan, güvendiği araç" },
            { id: 'speed', title: "Hız", desc: "İşleri çok daha hızlı yapabilme gücü" },
            { id: 'simplicity', title: "Sadelik", desc: "Karmaşık şeyleri basitleştiren çözüm" },
            { id: 'empowerment', title: "Güçlenme", desc: "Daha önce yapamadığı şeyleri yapabilme hissi" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Kullanıcınız neyi kaybetmiş hisseder?"
        },
        {
          type: 'selection_list',
          script: "Kullanıcınıza ne sunuyorsunuz?",
          text: "Deneyim Seviyesi",
          options: [
            { id: 'function_only', title: "Fonksiyon", desc: "Belirli bir işi yapan, işlevsel araç" },
            { id: 'function_ux', title: "Fonksiyon + UX", desc: "İşlevsellik artı keyifli kullanıcı deneyimi" },
            { id: 'full_ecosystem', title: "Tam ekosistem", desc: "Ürün, topluluk, eğitim, entegrasyonlar — bütünsel deneyim" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Deneyim seviyenizi tanımlayın"
        },
        {
          type: 'selection_list',
          script: "Teknoloji yaklaşımınız nedir?",
          text: "Teknoloji Yaklaşımı",
          options: [
            { id: 'proven', title: "Kanıtlanmış", desc: "Battle-tested teknolojiler, minimum risk" },
            { id: 'modern', title: "Modern", desc: "Güncel stack, endüstri standartları" },
            { id: 'experimental', title: "Deneysel", desc: "Yeni teknolojilere erken adapte, hesaplı risk" },
            { id: 'pioneer', title: "Öncü", desc: "Henüz yaygınlaşmamış teknolojiler, yol açıcı" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Teknoloji yaklaşımınızı tanımlayın"
        }
      ],
      educational: {
        script: "Özellikler kopyalanır. Ruh kopyalanamaz.",
        text: "Marka Ruhu",
        stats: [
          {
            value: "77%",
            label: "Duygusal bağ kuran kullanıcılar",
            description: "Kullanıcıların %77'si duygusal bağ kurdukları ürünleri rakiplerine rağmen kullanmaya devam ediyor.",
            source: "Kaynak: Forrester CX Index, 2024"
          },
          {
            value: "8x",
            label: "Marka sadakati etkisi",
            description: "Net marka kimliğine sahip SaaS şirketleri, belirsiz kimliğe sahip olanlara göre 8 kat daha düşük churn oranına sahip.",
            source: "Kaynak: ProfitWell SaaS Benchmark Report, 2023"
          },
          {
            value: "64%",
            label: "Değer odaklı tercih",
            description: "Tüketicilerin %64'ü bir teknoloji markasını tercih ederken sadece fiyat ve özelliklere değil, markanın değerlerine ve duruşuna bakıyor.",
            source: "Kaynak: Edelman Brand Trust Report, 2024"
          },
          {
            value: "3.5x",
            label: "Topluluk etkisi",
            description: "Aktif topluluk oluşturan SaaS ürünleri, topluluksuz olanlara göre 3.5 kat daha yüksek net promoter score'a sahip.",
            source: "Kaynak: CMX Community Industry Report, 2024"
          }
        ],
        caseStudy: {
          title: "Slack'in Manifestosu",
          summary: "Slack piyasaya girdiğinde düzinelerce mesajlaşma aracı vardı. Hiçbiri eksik değildi özellik olarak. Ama Slack bir şeyi farklı yaptı: İş iletişimini 'eğlenceli' yaptı. Her detayda bu ruh hissedildi — yükleme ekranındaki esprili mesajlar, özelleştirilebilir emoji'ler, bot entegrasyonları. Ürün sadece mesajlaşma değildi, iş yerinde 'keyif' vaadiydi. Kullanıcılar Slack'i sevdi çünkü kullanması zevkliydi. Microsoft Teams daha fazla özellik sunuyordu ama Slack'in ruhu rakipsizdi.",
          outcome: "Sonuç: Özellik yarışını kazanamazsın, ruh yarışını kazanabilirsin. Slack fonksiyon değil, his sattı.",
          type: 'success'
        },
        scenario: "Ruh Çatışması: Bir SaaS ürünü pazarlamada 'basitlik' vaat ediyor, ama ürün 200 özellikle dolu karmaşık bir arayüz sunuyor. Kullanıcı vaat ile gerçeklik arasındaki uçurumu hissediyor. Güven kırılıyor, rakibe geçiyor.",
      },
      resultMatrix: [
        {
          minScore: 0,
          maxScore: 999,
          title: "Marka Ruhu Profili",
          description: "Seçimlerinize göre marka ruhunuz şekillendi.",
          recommendations: [
            "İnovasyon Odağı: Yenilikçi anlatı, 'ilk biz yaptık' konumlandırması",
            "Güvenilirlik Kalesi: Tutarlılık, uptime, 'her zaman yanınızda' mesajı",
            "Hız Motoru: Performans, verimlilik, 'zaman kazandırır' vurgusu",
            "Sadelik Felsefesi: Minimal tasarım, 'karmaşıklığı yok ederiz' duruşu",
            "Güçlendirme Platformu: Kullanıcıyı kahramana dönüştüren araç"
          ]
        }
      ],
    },

    // ========================================================================
    // AŞAMA 2: MARKA KARAKTERİ (ARKETİP)
    // ========================================================================
    {
      intro: {
        script: "Arketip, ürününüzün güzel göründüğünde değil, bir şeyler ters gittiğinde kim olduğunu belirler.",
        stageDescription: "Bu aşama, markanızın davranış tarzını ve kriz anlarındaki tepkilerini tanımlar. Sistem çöktüğünde, veri ihlali endişesi yaşandığında markanız nasıl konuşur?",
      },
      questions: [
        {
          type: 'selection_list',
          script: "Sistem çöktü veya ciddi bir bug çıktı. Kullanıcılarınıza ilk tepkiniz ne olur?",
          text: "Kriz Tepkisi",
          options: [
            { id: 'transparent', title: "Şeffaf paylaşım", desc: "Status page günceller, postmortem yayınlar, özür diler (Bilge)" },
            { id: 'compensate', title: "Telafi eder", desc: "Kredi verir, süre uzatır, ekstra destek sunar (Bakıcı)" },
            { id: 'defend', title: "Standardı savunur", desc: "SLA'ye referans verir, süreçlerin işlediğini gösterir (Hükümdar)" },
            { id: 'innovate', title: "Çözümle gelir", desc: "Hızla fix çıkarır, yenilikçi çözüm sunar (Yaratıcı)" },
            { id: 'challenge', title: "Meydan okur", desc: "Sorunu fırsata çevirir, sektörü sorgular (Asi)" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Kriz tepkinizi açıklayın"
        },
        {
          type: 'selection_list',
          script: "İletişim tonunuz nasıl?",
          text: "İletişim Tonu",
          options: [
            { id: 'technical', title: "Teknik", desc: "Developer-friendly, detaylı dokümantasyon, jargon" },
            { id: 'friendly', title: "Samimi", desc: "Yakın, esprili, insancıl ton" },
            { id: 'authoritative', title: "Otoriter", desc: "Uzman, güvenilir, kurumsal" },
            { id: 'provocative', title: "Provokatif", desc: "Sektörü sorgulayan, cesur, farklı" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "İletişim tonunuzu tanımlayın"
        }
      ],
      educational: {
        script: "Kriz anı, markanın gerçek karakterini ortaya koyar. Güneşli havada herkes iyi kaptan.",
        text: "Karakter Tutarlılığı",
        stats: [
          {
            value: "76%",
            label: "Tutarlı iletişim bekleyen kullanıcılar",
            description: "Kullanıcıların %76'sı bir teknoloji markasının blog, destek, ürün içi ve sosyal medyada tutarlı bir ses tonu sergilemesini bekliyor.",
            source: "Kaynak: Salesforce State of the Connected Customer, 2024"
          },
          {
            value: "4.5x",
            label: "Şeffaf kriz yönetimi etkisi",
            description: "Kriz anında şeffaf iletişim kuran SaaS şirketleri, sessiz kalanlara göre 4.5 kat daha yüksek kullanıcı güveni koruyor.",
            source: "Kaynak: Statuspage Incident Communication Report, 2023"
          },
          {
            value: "89%",
            label: "Ton tutarlılığının güven etkisi",
            description: "Kullanıcıların %89'u iletişim tonu tutarlı olan markalara daha fazla güveniyor ve premium fiyat ödemeye istekli.",
            source: "Kaynak: Nielsen Norman Group UX Research, 2024"
          },
          {
            value: "67%",
            label: "Karakter çatışması kaybı",
            description: "Pazarlamada samimi ama destek'te robotik davranan markaların %67'si kullanıcı güvenini ilk 90 günde kaybediyor.",
            source: "Kaynak: Zendesk CX Trends Report, 2024"
          }
        ],
        caseStudy: {
          title: "Stripe'ın Kriz İletişimi",
          summary: "Stripe büyük bir API kesintisi yaşadığında ne yaptı? Status page'i anında güncelledi. Her 15 dakikada durum raporu yayınladı. Kesinti sonrası detaylı postmortem blog yazısı paylaştı: Ne oldu, neden oldu, ne yapıyoruz ki bir daha olmasın. Hiçbir şeyi gizlemedi. Developer topluluğu bu şeffaflığı takdir etti. Güven artırdı. Stripe'ın karakteri 'Bilge' arketipiyle tutarlıydı: teknik derinlik, şeffaflık, sorumluluk.",
          outcome: "Sonuç: Kriz anında karakter tutarlılığı, güveni artırır. Stripe kesintiden daha güçlü çıktı.",
          type: 'success'
        },
        scenario: "Karakter Çatışması: Bir SaaS markası pazarlamada 'developer-first, şeffaf, teknik' konumlanıyor. Ama bir kesinti yaşandığında 48 saat sessiz kalıyor, sonra kurumsal bir özür metni yayınlıyor. Kullanıcı bu iki karakteri bağdaştıramıyor. Güven kırılıyor.",
      },
      resultMatrix: [
        {
          minScore: 0,
          maxScore: 999,
          title: "Marka Arketipi",
          description: "Kriz anında davranış şekliniz markanızın gerçek karakterini ortaya koydu.",
          recommendations: [
            "Bilge: Şeffaflık, teknik derinlik, postmortem kültürü",
            "Bakıcı: Empatik destek, kullanıcı öncelikli telafi",
            "Hükümdar: Standart, SLA, güvenilirlik garantisi",
            "Yaratıcı: Hızlı çözüm, inovasyon, iterate etme",
            "Asi: Sektörü sorgulama, farklı olma, cesaret"
          ]
        }
      ],
    },

    // ========================================================================
    // AŞAMA 3: KİM DEĞİLİZ (ANTI-PERSONA)
    // ========================================================================
    {
      intro: {
        script: "Her kullanıcıya evet demek, hiçbir kullanıcıya mükemmel deneyim sunamamak demektir.",
        stageDescription: "Bu aşama, ürününüz için zararlı olan kullanıcı profillerini ve davranış kalıplarını belirlemenize yardımcı olur. Herkes için olan ürün, kimse için vazgeçilmez değildir.",
      },
      questions: [
        {
          type: 'selection_list',
          script: "Hangi kullanıcı tipi ürününüze en çok zarar veriyor?",
          text: "En Zararlı Kullanıcı Tipi",
          options: [
            { id: 'freeloader', title: "Bedavacı", desc: "Sadece free tier, ödeme niyeti yok, destek talebi yüksek" },
            { id: 'feature_requester', title: "Özellik talep bombardımanı", desc: "Sürekli olmayan özellik ister, roadmap'i bozar" },
            { id: 'support_abuser', title: "Destek istismarcısı", desc: "Basit soruları bile destek'e yönlendirir, self-serve kullanmaz" },
            { id: 'churn_risk', title: "Churn riski yüksek", desc: "Kısa süre kullanıp terk eder, negatif yorum bırakır" },
            { id: 'scope_creep', title: "Kapsam genişletici", desc: "Ürünü tasarlanmadığı amaçla kullanmaya çalışır" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Zararlı kullanıcı tipini tanımlayın"
        },
        {
          type: 'selection_list',
          script: "Bu kullanıcı tipi hangi soruna yol açıyor?",
          text: "Sorun Tipi",
          options: [
            { id: 'unit_economics', title: "Birim ekonomi", desc: "CAC yükseliyor, LTV düşüyor, sürdürülemez büyüme" },
            { id: 'product_focus', title: "Ürün odağı kaybı", desc: "Roadmap sapmalar, çekirdek değer zayıflıyor" },
            { id: 'team_morale', title: "Ekip morali", desc: "Destek ekibi tükeniyor, geliştiriciler motivasyon kaybediyor" },
            { id: 'brand_dilution', title: "Marka sulanması", desc: "Yanlış kullanıcılar yanlış algı yaratıyor" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Sorun tipini açıklayın"
        },
        {
          type: 'selection_list',
          script: "Bu duruma nasıl yaklaşıyorsunuz?",
          text: "Filtreleme Yaklaşımı",
          options: [
            { id: 'soft', title: "Nazik yönlendirme", desc: "Onboarding ile doğru segmente yönlendirme, self-serve içerik" },
            { id: 'pricing', title: "Fiyatlandırma bariyeri", desc: "Pricing tier, kullanım limitleri, premium özellikler" },
            { id: 'qualification', title: "Kullanıcı kalifikasyonu", desc: "Başvuru süreci, ideal müşteri profili filtresi, waitlist" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Filtreleme yaklaşımınızı açıklayın"
        }
      ],
      educational: {
        script: "Herkes için olan ürün, kimse için vazgeçilmez değildir.",
        text: "Kullanıcı Filtreleme Stratejisi",
        stats: [
          {
            value: "80%",
            label: "Destek maliyetinin kaynağı",
            description: "SaaS şirketlerinin destek maliyetinin %80'i, en düşük gelir getiren %20'lik kullanıcı segmentinden geliyor.",
            source: "Kaynak: Intercom Customer Support Trends, 2024"
          },
          {
            value: "5x",
            label: "ICP odaklı büyüme",
            description: "Ideal Customer Profile (ICP) tanımlayan ve ona göre filtreleyen SaaS şirketleri, 5 kat daha verimli büyüyor.",
            source: "Kaynak: OpenView SaaS Benchmarks, 2023"
          },
          {
            value: "60%",
            label: "Feature request tuzağı",
            description: "SaaS ürünlerinde eklenen özelliklerin %60'ı kullanıcıların %5'inden az tarafından kullanılıyor. Yanlış kullanıcıyı dinlemek = kaynak israfı.",
            source: "Kaynak: Pendo Feature Adoption Report, 2024"
          },
          {
            value: "3x",
            label: "Negatif churn etkisi",
            description: "Doğru kullanıcı segmentine odaklanan SaaS şirketleri, 3 kat daha yüksek net revenue retention elde ediyor.",
            source: "Kaynak: SaaStr Annual Benchmark Data, 2024"
          }
        ],
        caseStudy: {
          title: "Basecamp — 'Herkes İçin Değiliz' Duruşu",
          summary: "Basecamp (şimdiki 37signals) bilinçli olarak enterprise müşterilerini reddetti. Özel özellik geliştirmedi, ayrı SLA sunmadı, satış ekibi kurmadı. 'Bizim ürünümüz küçük ekipler için' dedi ve buna sadık kaldı. Enterprise müşteriler 'ama biz ödemeye hazırız' dediğinde bile hayır dedi. Roadmap'lerini korudular. Ürün sade kaldı. Çekirdek kullanıcıları memnun kaldı. 20 yılı aşkın süredir karlı.",
          outcome: "Sonuç: Hayır diyebildiğin kullanıcı, evet dediğin kullanıcıyı daha mutlu eder. Basecamp odağını kaybetmedi, karlılığını korudu.",
          type: 'success'
        },
        scenario: "Karşıt Örnek — Evernote Tuzağı: Evernote herkese evet dedi. Not tutma aracıydı, sonra proje yönetimi, sonra iş zekası, sonra sohbet. Her yeni kullanıcı segmenti yeni özellik getirdi. Ürün şişti, karmaşıklaştı. Çekirdek kullanıcı 'bu artık benim aracım değil' dedi ve gitti. Notion'a geçti.",
      },
      resultMatrix: [
        {
          minScore: 0,
          maxScore: 999,
          title: "Filtreleme Stratejisi",
          description: "İstemediğiniz kullanıcı tipini tanımladınız.",
          recommendations: [
            "Soft Filtreleme: Onboarding akışı, self-serve içerik, doğru segmente yönlendirme",
            "Fiyatlandırma Bariyeri: Tier yapısı, kullanım limitleri, premium-only özellikler",
            "Aktif Kalifikasyon: ICP filtresi, başvuru süreci, waitlist, sales qualification"
          ]
        }
      ],
    },

    // ========================================================================
    // AŞAMA 4: HEDEF VE BAŞARI
    // ========================================================================
    {
      intro: {
        script: "Vanity metrics büyüdükçe başarılı hissedersiniz. Ta ki gerçek sayıları görene kadar.",
        stageDescription: "Bu aşama, bu projenin birincil hedefini ve başarı metriklerinizi netleştirir. Kullanıcı sayısı mı, gelir mi, pazar liderliği mi? Hedef belirsizse strateji de belirsiz olur.",
      },
      questions: [
        {
          type: 'selection_list',
          script: "Bu projedeki birincil hedefiniz nedir?",
          text: "Birincil Hedef",
          options: [
            { id: 'user_base', title: "Kullanıcı tabanı büyütme", desc: "Daha fazla kayıt, daha geniş erişim" },
            { id: 'mrr_arr', title: "MRR/ARR artışı", desc: "Aylık veya yıllık tekrarlayan geliri büyütmek" },
            { id: 'market_leadership', title: "Pazar liderliği", desc: "Kategoride referans marka olmak" },
            { id: 'pmf', title: "Ürün-pazar uyumu (PMF)", desc: "Doğru kullanıcıya doğru değeri sunduğunuzu kanıtlamak" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Hedefiniz nedir?"
        },
        {
          type: 'selection_list',
          script: "Büyüme hızı tercihiniz?",
          text: "Büyüme Hızı",
          options: [
            { id: 'blitzscale', title: "Blitzscaling", desc: "Hızla pazar kapmak, 'winner takes all' yaklaşımı" },
            { id: 'sustainable', title: "Sürdürülebilir", desc: "Kontrollü büyüme, unit economics odaklı" },
            { id: 'bootstrapped', title: "Organik / Bootstrap", desc: "Yatırımsız, kârlılık odaklı, kendi hızında" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Büyüme stratejiniz?"
        },
        {
          type: 'selection_list',
          script: "Başarı sizin için ne demek?",
          text: "Başarı İşareti",
          options: [
            { id: 'dau_mau', title: "DAU/MAU oranı", desc: "Günlük/aylık aktif kullanıcı oranının artması" },
            { id: 'churn_reduction', title: "Churn düşüşü", desc: "Kullanıcı kaybının azalması, retention artışı" },
            { id: 'nps', title: "NPS skoru", desc: "Yüksek tavsiye oranı, kullanıcı memnuniyeti" },
            { id: 'funding', title: "Yatırım turu", desc: "Seed, Series A/B/C kapatmak" },
            { id: 'revenue_milestone', title: "Gelir eşiği", desc: "Belirli bir MRR/ARR hedefine ulaşmak" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Başarı tanımınız?"
        }
      ],
      educational: {
        script: "Vanity metrics sizi mutlu eder. Gerçek metrikler sizi büyütür.",
        text: "SaaS Başarı Metrikleri",
        stats: [
          {
            value: "73%",
            label: "Yanlış metrik takip eden startuplar",
            description: "Startupların %73'ü birincil metrik olarak 'toplam kayıt sayısı' takip ediyor. Bu vanity metric, gerçek sağlığı göstermez.",
            source: "Kaynak: First Round Capital State of Startups, 2024"
          },
          {
            value: "40/40",
            label: "SaaS Kuralı",
            description: "Büyüme oranı + kâr marjı toplamı %40'ı geçen SaaS şirketleri 'sağlıklı' kabul ediliyor. Bu dengeyi tutturmak stratejik netlik gerektirir.",
            source: "Kaynak: Bessemer Cloud Index, 2024"
          },
          {
            value: "5%",
            label: "Aylık churn sınırı",
            description: "Aylık churn oranı %5'in üzerindeyse, büyüme çabalarınızın çoğu 'delikli kovayı doldurmak' olur. Retention büyümenin temelidir.",
            source: "Kaynak: Recurly Churn Benchmark Report, 2024"
          },
          {
            value: "3:1",
            label: "LTV:CAC oranı",
            description: "Sağlıklı SaaS şirketlerinde LTV:CAC oranı en az 3:1 olmalı. Bu oranın altındaysa, her yeni müşteri zarar demektir.",
            source: "Kaynak: a16z SaaS Metrics Guide, 2023"
          }
        ],
        caseStudy: {
          title: "Getir — Metrik Odağı Değişimi",
          summary: "Getir başlangıçta tek bir metriğe odaklandı: Teslimat hızı. '10 dakikada kapınızda' vaadi her şeyi tanımladı — operasyon, teknoloji, pazarlama. Bu netlik büyümeyi hızlandırdı. Ama uluslararası genişlemede hedef 'pazar sayısı' oldu. Hız vaadi sulandı, operasyonel maliyetler patladı. Sonunda geri çekildi, çekirdek pazarına ve çekirdek metriğine döndü. Bir startupın başarı tanımı değiştiğinde, her şey değişir.",
          outcome: "Sonuç: Net metrik = net strateji. Metrik kayarsa, strateji de kayar. Getir çekirdek metriğine dönerek toparlandı.",
          type: 'success'
        },
        scenario: "Karşıt Örnek — Vanity Metrics Tuzağı: Bir SaaS ürünü aylık 50K yeni kayıt alıyor. Ekip mutlu, yatırımcılara güzel grafikler sunuluyor. Ama DAU/MAU oranı %8. Yani kullanıcıların %92'si kaydolup kullanmıyor. 'Büyüyoruz' diyorsunuz ama aslında delikli bir kovayı dolduruyorsunuz. Gerçek metrik kayıt değil, aktivasyon ve retention.",
      },
      resultMatrix: [
        {
          minScore: 0,
          maxScore: 999,
          title: "Büyüme Stratejisi",
          description: "Hedef ve başarı tanımınız netleşti.",
          recommendations: [
            "Kullanıcı Büyüme Motoru: PLG (Product-Led Growth), viral loop, freemium optimizasyonu",
            "Gelir Motoru: Pricing optimizasyonu, upsell/cross-sell, expansion revenue",
            "Pazar Liderliği: Thought leadership, kategori yaratma, PR stratejisi",
            "PMF Doğrulama: Kullanıcı görüşmeleri, cohort analizi, retention odağı"
          ]
        }
      ],
    },
  ],
};
