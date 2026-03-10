import { SectorQuestionConfig } from '../../types';

export const corporateConfig: SectorQuestionConfig = {
  sectorId: 'corporate',

  intro: {
    script: "Kurumsal bir marka, vaadini tutamıyorsa pazarlama sadece hayal kırıklığını hızlandırır.",
    text: "Bu interaktif deneyim, kurumsal markanız için üretilecek strateji ve iletişim dünyasının güvenilir, tutarlı ve sürdürülebilir olmasını sağlamak için tasarlandı.",
  },

  stages: [
    // ========================================================================
    // AŞAMA 0: OPERASYONEL GERÇEKLİK
    // ========================================================================
    {
      intro: {
        script: "Hizmet teslimatınız vaat ettiğinizi taşıyamazsa, yeni sözleşmeler sadece riski büyütür.",
        stageDescription: "Bu aşama, şirketinizin vaatlerini operasyonel olarak taşıyıp taşıyamayacağını belirler. Pazarlama talebi artırır, ancak hazırlıksız bir operasyon bu talebi kriz haline getirir.",
      },
      questions: [
        {
          type: 'selection_scored',
          script: "Hizmet teslimatınız ne kadar tutarlı?",
          text: "Hizmet Teslimat Tutarlılığı",
          options: [
            { id: 'varies', title: "Kişiye göre değişiyor", desc: "Her ekip farklı standartta çalışıyor, süreçler dokümante değil", score: 0 },
            { id: 'similar', title: "Benzer ama değişken", desc: "Genel çerçeve var ama proje bazında sapmalar oluyor", score: 1 },
            { id: 'mostly_stable', title: "Büyük ölçüde sabit", desc: "Çoğu projede tutarlı teslimat, nadir aksamalar", score: 2 },
            { id: 'sop_defined', title: "SOP ile net", desc: "Standart operasyon prosedürleri yazılı, ölçümleniyor ve uygulanıyor", score: 3 },
            { id: 'other', title: "Diğer (Belirtin)", score: 0 }
          ],
          placeholder: "Durumunuzu açıklayın"
        },
        {
          type: 'selection_scored',
          script: "Eş zamanlı birden fazla proje yoğunluğunda kalite ve teslimat nasıl?",
          text: "Proje Yoğunluğu Yönetimi",
          options: [
            { id: 'collapses', title: "Çöküyor", desc: "Eş zamanlı projelerde teslimat kalitesi ciddi düşüş yaşıyor", score: 0 },
            { id: 'struggling', title: "Zorlanıyor", desc: "Hissedilir gecikmeler ve kalite düşüşü var ama idare ediliyor", score: 1 },
            { id: 'mostly_holds', title: "Çoğunlukla korunuyor", desc: "Bazen küçük aksamalar ama genel kalite stabil", score: 2 },
            { id: 'measured', title: "Ölçümlü şekilde korunuyor", desc: "Kaynak planlama sistemi var, kalite hiç düşmüyor", score: 3 },
            { id: 'other', title: "Diğer (Belirtin)", score: 0 }
          ],
          placeholder: "Durumunuzu açıklayın"
        },
        {
          type: 'selection_scored',
          script: "Bu çalışma sonrası iş hacminiz %30 artarsa ne olur?",
          text: "İş Hacmi Artışı Kapasitesi",
          options: [
            { id: 'cannot', title: "Karşılayamayız", desc: "Mevcut kadro ve altyapı yetersiz kalır", score: 0 },
            { id: 'partially', title: "Kısmen karşılarız", desc: "Bazı düzenlemelerle ve dış kaynaklarla idare edebiliriz", score: 1 },
            { id: 'yes', title: "Evet, karşılarız", desc: "Kadro, süreç ve altyapı hazır, ölçeklenebiliriz", score: 2 },
            { id: 'other', title: "Diğer (Belirtin)", score: 0 }
          ],
          placeholder: "Durumunuzu açıklayın"
        }
      ],
      educational: {
        script: "İki şirket hikayesi: Biri agresif büyüdü, diğeri altyapısını güçlendirdi. Sadece biri ayakta kaldı.",
        text: "Operasyonel Tutarlılık",
        stats: [
          {
            value: "68%",
            label: "Tutarsız teslimat yapan B2B şirketleri",
            description: "B2B şirketlerinin %68'i tutarsız hizmet teslimatı nedeniyle müşteri kaybediyor. Başarısızlığın 1 numaralı nedeni: operasyonel standardizasyon eksikliği.",
            source: "Kaynak: Bain & Company B2B Customer Experience Report, 2023"
          },
          {
            value: "91%",
            label: "Tutarlılık bekleyen kurumsal müşteriler",
            description: "Kurumsal müşterilerin %91'i bir hizmet sağlayıcıdan her projede aynı kaliteyi bekliyor. Tutarsızlık = sözleşme yenilememe.",
            source: "Kaynak: Gartner B2B Buying Behavior Survey, 2024"
          },
          {
            value: "4.5x",
            label: "SOP'li şirketlerde müşteri memnuniyeti",
            description: "Standart operasyon prosedürü olan B2B şirketleri, olmayanlara göre 4.5 kat daha yüksek müşteri memnuniyeti skoruna sahip.",
            source: "Kaynak: McKinsey Operations Practice, 2023"
          },
          {
            value: "%35",
            label: "Başarılı konumlandırma sonrası artan talep",
            description: "Başarılı bir kurumsal marka kampanyası sonrası gelen talep ortalama %35 artıyor. Altyapınız hazır değilse bu bir felakettir.",
            source: "Kaynak: Forrester B2B Marketing Impact Report, 2024"
          }
        ],
        caseStudy: {
          title: "Arthur Andersen — Büyüme Çöküşü",
          summary: "Arthur Andersen dünyanın en prestijli danışmanlık firmalarından biriydi. Hızla büyüdü, her yere ofis açtı, her sektöre girdi. Ama hizmet kalitesi standardize değildi. Her ofis farklı çalışıyordu. Kontrol mekanizmaları zayıfladı. Büyüklük, kaliteyi yedi. Enron skandalı patladığında, operasyonel tutarsızlık sorunu zaten oradaydı. Skandal sadece fitili yaktı. Firma çöktü.",
          outcome: "Sonuç: Parlak büyüme, kontrol kaybı. Operasyon standardize değilse büyümek sizi kurtarmaz, bitirir.",
          type: 'failure'
        },
        scenario: "Karşıt Örnek — McKinsey & Company: Her ofiste aynı metodoloji, aynı teslimat standardı, aynı kalite. Japonya'da da Brezilya'da da aynı McKinsey deneyimini yaşarsınız. 100 yıldır ayaktalar çünkü büyümeden önce standardı korudular.",
      },
      resultMatrix: [
        {
          minScore: 0,
          maxScore: 2,
          title: "Önce Operasyon",
          description: "Pazarlama talebi artırır ama aynı hızla problemi de büyütür.",
          recommendations: [
            "SOP (Standart Operasyon Prosedürleri) oluşturun",
            "Ekip eğitim ve sertifikasyon programı başlatın",
            "Kalite kontrol ve teslimat izleme sistemleri kurun",
            "Kaynak ve kapasite planlaması yapın"
          ],
          caseStudy: {
            title: "McKinsey & Company",
            summary: "Büyümeden çok standardizasyona yatırım yaptı. Tutarlılık = marka oldu.",
            outcome: "Müşteri 'sürpriz' değil güven satın aldı.",
            type: 'success'
          }
        },
        {
          minScore: 3,
          maxScore: 6,
          title: "Kontrollü Büyüme",
          description: "Sınırlı vaat, net sınırlar, proje kabul kriterleri disiplini gerekir.",
          recommendations: [
            "Proje kabul kriterleri ile talep yönetimi",
            "Kapasiteyi aşmayan iş geliştirme stratejisi",
            "Kademeli büyüme ve kadrolaşma planı",
            "Operasyonel iyileştirmelere devam"
          ]
        },
        {
          minScore: 7,
          maxScore: 8,
          title: "Hazır",
          description: "Marka anlatısı ve iş geliştirme agresif biçimde büyütülebilir.",
          recommendations: [
            "Tam kapasiteli marka ve pazarlama kampanyası",
            "Thought leadership içerik stratejisi",
            "Yeni pazar ve sektör genişleme planları",
            "Marka değeri ve konumlandırma yatırımı"
          ]
        }
      ],
    },

    // ========================================================================
    // AŞAMA 1: MARKA RUHU
    // ========================================================================
    {
      intro: {
        script: "Paydaşlar hizmeti unutur. Ama kendilerini nasıl hissettirdiğinizi hatırlarlar.",
        stageDescription: "Bu aşama, markanızın duygusal kimliğini ve paydaşlarınızda yaratmak istediğiniz hissi tanımlar. Paydaşlar teknik çözümü unutur, ama nasıl hissettiklerini hatırlar.",
      },
      questions: [
        {
          type: 'selection_list',
          script: "Şirketiniz kaybolsa, paydaşlarınız neyi kaybetmiş hisseder?",
          text: "Kayıp Duygusu",
          options: [
            { id: 'trust', title: "Güvenilirlik", desc: "Bildiği, tutarlı, her zaman yanında olan bir ortak" },
            { id: 'innovation', title: "Yenilikçilik", desc: "Sektörde hep bir adım önde olan vizyon" },
            { id: 'prestige', title: "Prestij", desc: "Onlarla çalışmak statü ve güvence demekti" },
            { id: 'partnership', title: "Ortaklık", desc: "Sadece tedarikçi değil, gerçek bir iş ortağı" },
            { id: 'expertise', title: "Uzmanlık", desc: "Kimsenin bilmediğini bilen, derin sektör bilgisi" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Hangi duyguyu yaratıyorsunuz?"
        },
        {
          type: 'selection_list',
          script: "Paydaşlarınıza ne sunuyorsunuz?",
          text: "Hizmet Deneyim Seviyesi",
          options: [
            { id: 'technical_solution', title: "Teknik Çözüm", desc: "Sorun var, çözeriz. Operasyonel hizmet teslimatı" },
            { id: 'solution_consulting', title: "Çözüm + Danışmanlık", desc: "Sorunu çözer, aynı zamanda yol gösteririz. Stratejik rehberlik" },
            { id: 'strategic_partnership', title: "Stratejik Ortaklık", desc: "İş ortağıyız. Büyüme planlarında birlikte düşünürüz" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Hizmet deneyim seviyenizi tanımlayın"
        },
        {
          type: 'selection_list',
          script: "Sektöre yaklaşım stiliniz?",
          text: "Yaklaşım Stili",
          options: [
            { id: 'traditional', title: "Geleneksel", desc: "Kanıtlanmış yöntemler, endüstri standardı yaklaşımlar" },
            { id: 'modern_twist', title: "Modern yorumlu", desc: "Geleneksel temele sadık ama dijital çağa uyarlanmış" },
            { id: 'radical', title: "Radikal dönüşüm", desc: "Sektörü kökten değiştirecek cesur yaklaşımlar" },
            { id: 'pioneer', title: "Sektör öncüsü", desc: "Henüz kimsenin yapmadığını yapan, yeni kategoriler yaratan" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Yaklaşım stilinizi tanımlayın"
        }
      ],
      educational: {
        script: "Paydaşlar hizmeti unutur, ama hissi hatırlar.",
        text: "Marka Ruhu",
        stats: [
          {
            value: "84%",
            label: "Duygusal bağ kuran B2B müşteriler",
            description: "B2B müşterilerinin %84'ü duygusal bağ kurdukları şirketlerle daha uzun süreli sözleşmeler imzalıyor ve daha yüksek bütçe ayırıyor.",
            source: "Kaynak: Gallup B2B Customer Engagement Report, 2024"
          },
          {
            value: "6x",
            label: "Hatırlanan marka deneyimi",
            description: "Kurumsal müşteriler, teknik çözümden çok markanın kendilerini nasıl hissettirdiğini 6 kat daha uzun süre hatırlıyor.",
            source: "Kaynak: Harvard Business Review B2B Branding Study, 2023"
          },
          {
            value: "71%",
            label: "Marka hikayesi arayan karar vericiler",
            description: "Karar vericilerin %71'i bir şirketin misyonunu, değerlerini ve hikayesini bilmek istiyor. Sadece fiyat ve teknik yeterlilik yetmiyor.",
            source: "Kaynak: LinkedIn B2B Thought Leadership Impact Study, 2024"
          },
          {
            value: "3.1x",
            label: "Net kimliğe sahip B2B markalarının başarısı",
            description: "Net marka kimliğine sahip B2B şirketleri, belirsiz kimlikli rakiplerine göre 3.1 kat daha yüksek sözleşme yenileme oranına sahip.",
            source: "Kaynak: Bain & Company B2B Loyalty Report, 2023"
          }
        ],
        caseStudy: {
          title: "IBM — 'Think' Manifestosu",
          summary: "IBM 100 yılı aşkın süredir tek bir kelimeyle tanınır: 'Think.' Bu sadece bir slogan değildi — kim olduklarını tanımlayan bir beyandı. Her ürün lansmanında, her müşteri toplantısında, her iç iletişimde bu ruh hissediliyordu. Teknoloji değişti, ürünler değişti, pazar değişti. Ama IBM'in ruhu hep aynı kaldı: Düşünmek, çözmek, ileriye taşımak. Paydaş ne beklediğini biliyordu. Rakipler nasıl konumlanacağını biliyordu.",
          outcome: "Sonuç: Net kimlik = hatırlanma. Ruh belirsizse, marka belirsizdir. IBM, ürünleri değişse bile 'Think' ruhuyla her zaman tutarlı kaldı.",
          type: 'success'
        },
        scenario: "Ruh Çatışması: Bir danışmanlık firması web sitesinde 'yenilikçi' diyor, ama sunumlarında 90'ların şablonlarını kullanıyor. Teklif dilinde 'stratejik ortak' vaat ediyor, ama sadece operasyonel taşeronluk yapıyor. Paydaş ne bekleyeceğini bilemez. Kafası karışır. Rakibi seçer.",
      },
      resultMatrix: [
        {
          minScore: 0,
          maxScore: 999,
          title: "Marka Ruhu Profili",
          description: "Seçimlerinize göre marka ruhunuz şekillendi.",
          recommendations: [
            "Güvenilir Ortak: SOP + tutarlı teslimat anlatısı",
            "Yenilikçi Vizyon: Thought leadership, sektör öncülüğü",
            "Prestij Kalkanı: Az konuş, sonuçlarla kanıtla",
            "Stratejik Dost: İnsan yüzü, uzun vadeli bağ",
            "Uzman Otorite: Derin bilgi, sektör referansları"
          ]
        }
      ],
    },

    // ========================================================================
    // AŞAMA 2: MARKA KARAKTERİ (ARKETİP)
    // ========================================================================
    {
      intro: {
        script: "Arketip, markanın neye benzediğini değil, krizde nasıl davrandığını belirler.",
        stageDescription: "Bu aşama, şirketinizin davranış tarzını ve kriz anlarındaki tepkilerini tanımlar. Arketip, şirketinizin iyi günlerde değil, zorlandığında kim olduğunu belirler.",
      },
      questions: [
        {
          type: 'selection_list',
          script: "Proje gecikti ve müşteri şikayet ediyor. İlk tepkiniz ne olur?",
          text: "Kriz Tepkisi",
          options: [
            { id: 'compensate', title: "Telafi eder", desc: "Ekstra kaynak atar, ek hizmet sunar, zararı üstlenir (Bakıcı)" },
            { id: 'defend', title: "Süreci savunur", desc: "Bu projede kapsam değişiklikleri oldu, süreç doğru işledi (Hükümdar)" },
            { id: 'explain', title: "Analiz eder ve açıklar", desc: "Gecikmenin kök nedenini raporlar, çözüm planı sunar (Bilge)" },
            { id: 'challenge', title: "Beklentiyi sorgular", desc: "Kapsam bu süreye sığmaz, baştan gerçekçi olmayan bir plan vardı (Asi)" },
            { id: 'redesign', title: "Yeniden tasarlar", desc: "Haklısınız, farklı bir yaklaşımla çözelim (Yaratıcı)" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Kriz tepkinizi açıklayın"
        },
        {
          type: 'selection_list',
          script: "Kurumsal iletişim tonunuz?",
          text: "İletişim Tonu",
          options: [
            { id: 'authoritative', title: "Otoriter ve güvenli", desc: "Kesin ifadeler, sektör otoritesi, 'biz biliriz' tonu" },
            { id: 'consultative', title: "Danışman ve yönlendirici", desc: "Sorular sorar, birlikte keşfeder, rehberlik eder" },
            { id: 'warm_professional', title: "Samimi ama profesyonel", desc: "Yakın, erişilebilir, insan odaklı ama ciddi" },
            { id: 'provocative', title: "Provokatif ve düşündürücü", desc: "Statükoyu sorgulatan, ezber bozan, cesur" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "İletişim tonunuzu tanımlayın"
        }
      ],
      educational: {
        script: "Arketip, şirketin neye benzediğini değil, krizde nasıl davrandığını belirler.",
        text: "Karakter Tutarlılığı",
        stats: [
          {
            value: "76%",
            label: "Tutarlı karakter bekleyen kurumsal müşteriler",
            description: "Kurumsal müşterilerin %76'sı bir şirketin satış sürecinde, projede ve destek aşamasında aynı karakteri sergilemesini bekliyor.",
            source: "Kaynak: McKinsey B2B Brand Consistency Study, 2023"
          },
          {
            value: "5.2x",
            label: "Kriz anında güvenilir kurumsal markalar",
            description: "Net arketipe sahip B2B şirketleri, kriz anlarında belirsiz karakterli markalara göre 5.2 kat daha güvenilir bulunuyor.",
            source: "Kaynak: Edelman B2B Trust Barometer, 2024"
          },
          {
            value: "89%",
            label: "Karakter tutarlılığının sözleşme yenilemeye etkisi",
            description: "B2B markaların %89'u karakter tutarlılığının sözleşme yenileme oranlarını doğrudan artırdığını onaylıyor.",
            source: "Kaynak: Forbes B2B Brand Loyalty Report, 2023"
          },
          {
            value: "72%",
            label: "Karakter çakışması yaşayan kurumsal markalar",
            description: "Kurumsal müşterilerin %72'si bir şirkette karakter çakışması (örn. 'inovatif' konumlanma + eski usul sunum) hissettiklerinde sözleşme yenilemiyorlar.",
            source: "Kaynak: B2B International Brand Perception Study, 2024"
          }
        ],
        caseStudy: {
          title: "Accenture — 'Let There Be Change'",
          summary: "Accenture yıllarca geleneksel danışmanlık firması olarak algılandı. Sonra bir karar aldı: 'Biz danışmanlık değil, dönüşüm şirketiyiz.' Tüm iletişimlerini yeniden tasarladı. Sunumlar, teklif dili, web sitesi, sosyal medya — hepsinde aynı ton: cesur, ileriye bakan, dönüştürücü. Her krizde aynı tepki: 'Bu bir fırsat, birlikte dönüştürelim.' Arketip tutarlıydı. Müşteri ne beklediğini biliyordu. Rakipler nasıl konumlanacağını biliyordu.",
          outcome: "Sonuç: Arketip tutarlıysa her karar kolaylaşır. Sunum stili, teklif dili, kriz yönetimi — hepsi otomatik hizalanır.",
          type: 'success'
        },
        scenario: "Arketip Çakışması: Web sitesinde 'yenilikçi ve cesur' diyor. Sunumlarda 50 sayfalık PowerPoint ile geliyor. Teklifinde 'stratejik ortak' vaat ediyor ama projelerde sadece talimat bekliyor. Müşteri zihninde bilişsel uyumsuzluk yaratır. Bu şirket kim?",
      },
      resultMatrix: [
        {
          minScore: 0,
          maxScore: 999,
          title: "Marka Arketipi",
          description: "Kriz anında davranış şekliniz kurumsal karakterinizi ortaya koydu.",
          recommendations: [
            "Bakıcı: Koruma, destek, 'her zaman yanınızdayız'",
            "Hükümdar: Standart, otorite, süreç disiplini",
            "Bilge: Analiz, veri, stratejik derinlik",
            "Asi: Ezber bozma, sektör dönüşümü, cesaret",
            "Yaratıcı: İnovasyon, çözüm tasarımı, yeni yaklaşım"
          ]
        }
      ],
    },

    // ========================================================================
    // AŞAMA 3: KİM DEĞİLİZ (ANTI-PERSONA)
    // ========================================================================
    {
      intro: {
        script: "Her müşteriye evet diyen şirket, hiçbir müşteri için vazgeçilmez değildir.",
        stageDescription: "Bu aşama, şirketiniz için zararlı olan müşteri/paydaş profillerini belirlemenize yardımcı olur. Her müşteriye evet diyen şirket, hiçbir müşteri için vazgeçilmez değildir.",
      },
      questions: [
        {
          type: 'selection_list',
          script: "Hangi müşteri/paydaş tipi şirketinize en çok zarar verir?",
          text: "En Zararlı Paydaş Tipi",
          options: [
            { id: 'price_hunter', title: "Fiyat avcısı", desc: "Sadece en düşük teklifi arayan, değeri görmeyen" },
            { id: 'scope_creep', title: "Scope creep yapan", desc: "Sürekli kapsam genişleten, ek talepleri bitmeyen" },
            { id: 'indecisive', title: "Karar veremeyen", desc: "Onay süreçleri belirsiz, her kararı geri alan" },
            { id: 'micromanager', title: "Mikro yönetici", desc: "Her detaya müdahale eden, ekibinizi yönlendirmeye çalışan" },
            { id: 'blame_shifter', title: "Suç atan", desc: "Sorumluluk almayan, her sorunda sizi suçlayan" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Zararlı paydaş tipini tanımlayın"
        },
        {
          type: 'selection_list',
          script: "Bu paydaş tipi hangi soruna yol açıyor?",
          text: "Sorun Tipi",
          options: [
            { id: 'profitability', title: "Kârlılık", desc: "Düşük marj, sürekli ek maliyet, kârsız projeler" },
            { id: 'culture', title: "Şirket kültürü", desc: "Ekip motivasyonu düşüyor, yetenek kaybı yaşanıyor" },
            { id: 'quality', title: "Teslimat kalitesi", desc: "Diğer projelerin kalitesi düşüyor, kaynak dağılımı bozuluyor" },
            { id: 'reputation', title: "İtibar", desc: "Şirketin pazar algısı zedeleniyor, yanlış referanslar oluşuyor" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Sorun tipini açıklayın"
        },
        {
          type: 'selection_list',
          script: "Bu duruma nasıl yaklaşırsınız?",
          text: "Yaklaşım Tavrı",
          options: [
            { id: 'soft', title: "Nazik yönlendirme", desc: "Teklif yapısıyla, fiyatlamayla dolaylı eleme" },
            { id: 'barrier', title: "Bariyer sistemi", desc: "Minimum proje büyüklüğü, ön değerlendirme süreci, nitelik kriterleri" },
            { id: 'hard_no', title: "Net red", desc: "Açık kriterler, 'bu projemiz değil' demek" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Yaklaşımınızı açıklayın"
        }
      ],
      educational: {
        script: "Her müşteriye evet diyen şirket, hiçbir müşteri için vazgeçilmez değildir.",
        text: "B2B Filtreleme Stratejisi",
        stats: [
          {
            value: "80%",
            label: "Kâr marjını düşüren yanlış müşteriler",
            description: "B2B şirketlerinde hedef dışı müşteriler, kâr marjını ortalama %80 oranında düşürüyor (düşük marj, yüksek bakım maliyeti).",
            source: "Kaynak: Harvard Business Review B2B Profitability Study, 2023"
          },
          {
            value: "4.7x",
            label: "Müşteri seçiciliği yapan şirketlerin kârlılığı",
            description: "Net müşteri kabul kriterleri uygulayan B2B şirketleri, herkesle çalışanlara göre 4.7 kat daha yüksek kârlılığa sahip.",
            source: "Kaynak: BCG B2B Growth Strategies Report, 2024"
          },
          {
            value: "63%",
            label: "Yanlış müşteri yüzünden yetenek kaybı",
            description: "B2B şirketlerinin %63'ü zorlu müşteriler nedeniyle kritik yeteneklerini kaybediyor. Ekip tükenmişliği en büyük gizli maliyet.",
            source: "Kaynak: Deloitte Workforce Burnout Survey, 2023"
          },
          {
            value: "88%",
            label: "Filtreleme yapan premium B2B markalar",
            description: "Premium konumlanan B2B şirketlerinin %88'i aktif olarak müşteri profili filtrelemesi yapıyor (minimum proje büyüklüğü, sektör odağı, nitelik kriterleri).",
            source: "Kaynak: Hinge Research Institute, 2024"
          }
        ],
        caseStudy: {
          title: "Koç Holding — Stratejik Seçicilik",
          summary: "Koç Holding yıllarca 'her sektörde, her müşteriyle' çalıştı. 2010'larda stratejik bir karar aldı: Odaklanma. Bazı sektörlerden çekildi, bazı ortaklıkları sonlandırdı. 'Hayır' demeyi öğrendi. 'Her fırsata evet' demek yerine 'doğru fırsata evet' dedi. Portföyü küçüldü ama değeri arttı. Seçicilik, şirketin pazar değerini katladı. Çünkü kaynaklar doğru yere gitti.",
          outcome: "Sonuç: Net filtreleme, doğru müşteriyi çekti. Hacim kaybettiler, değer kazandılar. Seçicilik = büyüme.",
          type: 'success'
        },
        scenario: "Scope Creep Tuzağı: Büyük bir sözleşme imzaladınız. Müşteri sürekli 'ufak bir ekleme daha' istedi. Her ekleme küçüktü ama toplamda proje %40 büyüdü. Marj eridi. Ekip tükendi. Diğer projeler aksadı. Çözüm: Sözleşmede net kapsam tanımı, değişiklik yönetim süreci, 'hayır' diyebilme kültürü.",
      },
      resultMatrix: [
        {
          minScore: 0,
          maxScore: 999,
          title: "Filtreleme Stratejisi",
          description: "İstemediğiniz paydaş profilini tanımladınız.",
          recommendations: [
            "Soft Demarketing: Teklif yapısı, fiyatlama ile dolaylı eleme",
            "Bariyerli Sistem: Minimum proje büyüklüğü, ön değerlendirme, nitelik kriterleri",
            "Sert Kural: Net proje kabul politikası, açık kriterler"
          ]
        }
      ],
    },

    // ========================================================================
    // AŞAMA 4: HEDEF VE BAŞARI
    // ========================================================================
    {
      intro: {
        script: "Ne istiyoruz? Sektör otoritesi mi, iş hacmi mi, premium konumlanma mı?",
        stageDescription: "Bu aşama, bu projenin birincil hedefini ve başarı metriklerinizi netleştirir. Otorite mi, hacim mi, premium mı? Hedef belirsizse strateji de belirsiz olur.",
      },
      questions: [
        {
          type: 'selection_list',
          script: "Bu projedeki birincil hedefiniz?",
          text: "Birincil Hedef",
          options: [
            { id: 'authority', title: "Sektör otoritesi", desc: "Sektörde referans noktası olmak, thought leadership" },
            { id: 'volume', title: "İş hacmi büyütme", desc: "Daha fazla sözleşme, daha geniş müşteri portföyü" },
            { id: 'premium', title: "Premium konumlanma", desc: "Daha az ama daha değerli projeler, yüksek marj" },
            { id: 'talent', title: "Yetenek çekimi", desc: "En iyi profesyonellerin çalışmak istediği şirket olmak" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Hedefiniz nedir?"
        },
        {
          type: 'selection_list',
          script: "Büyüme hızı tercihiniz?",
          text: "Büyüme Hızı Tercihi",
          options: [
            { id: 'aggressive', title: "Agresif", desc: "Hızlı genişleme, yeni pazarlar, yoğun iş geliştirme" },
            { id: 'balanced', title: "Dengeli", desc: "Sürdürülebilir büyüme, kontrollü genişleme" },
            { id: 'selective', title: "Seçici", desc: "Yavaş ama değerli, sadece stratejik fırsatlara odaklanma" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Büyüme stratejiniz?"
        },
        {
          type: 'selection_list',
          script: "Başarı sizin için ne demek?",
          text: "Başarı İşareti",
          options: [
            { id: 'contract_value', title: "Sözleşme değeri", desc: "Ortalama sözleşme büyüklüğünün artması" },
            { id: 'referral_rate', title: "Referans oranı", desc: "Mevcut müşterilerden gelen yeni iş oranı" },
            { id: 'awards', title: "Sektör ödülleri", desc: "Sektörel ödüller, sıralamalar, tanınırlık" },
            { id: 'executive_recognition', title: "Yönetim kadrosu tanınırlığı", desc: "C-level yöneticilerin sektörde tanınan isimler olması" },
            { id: 'renewal_rate', title: "Sözleşme yenileme oranı", desc: "Müşterilerin tekrar çalışmak istemesi, uzun vadeli ilişkiler" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Başarı tanımınız?"
        }
      ],
      educational: {
        script: "Büyümek bir hedef değil, stres testidir. Doğru büyüme, doğru hedefe bağlıdır.",
        text: "B2B Başarı Metrikleri",
        stats: [
          {
            value: "74%",
            label: "Net hedefi olmayan B2B şirketler",
            description: "B2B şirket sahiplerinin %74'ü 'iş hacmi' ve 'premium konumlanma' hedeflerini karıştırıyor. Sonuç: belirsiz strateji, kaynak israfı.",
            source: "Kaynak: Boston Consulting Group B2B Strategy Survey, 2023"
          },
          {
            value: "3.8x",
            label: "Net başarı metriği olan B2B markalar",
            description: "Net başarı metriği tanımlayan B2B şirketleri, belirsiz metrikli olanlara göre 3.8 kat daha hızlı büyüyor.",
            source: "Kaynak: McKinsey B2B Growth Study, 2024"
          },
          {
            value: "82%",
            label: "Agresif büyüme sonrası kalite çöküşü",
            description: "Agresif büyüyen ama altyapı hazırlığı olmayan B2B şirketlerinin %82'si 12 ay içinde müşteri memnuniyetinde ciddi düşüş yaşıyor.",
            source: "Kaynak: Deloitte B2B Growth Impact Report, 2024"
          },
          {
            value: "67%",
            label: "Thought leadership'in iş kazanmaya etkisi",
            description: "Karar vericilerin %67'si thought leadership içeriği sayesinde bir şirkete daha yüksek bütçe ayırmaya hazır olduğunu belirtiyor.",
            source: "Kaynak: Edelman-LinkedIn B2B Thought Leadership Impact Study, 2023"
          }
        ],
        caseStudy: {
          title: "Sabancı Holding — Stratejik Dönüşüm",
          summary: "Sabancı Holding yıllarca 'her sektörde varız' stratejisiyle büyüdü. 2020'lerde kritik bir karar aldı: Dijital dönüşüm ve sürdürülebilirlik odağı. Bazı geleneksel sektörlerden çıktı, dijital yatırımları artırdı. Zirvedeyken bazı işleri bırakmak cesaret istedi. Ama hedef netti: 'Türkiye'nin dijital dönüşüm lideri olmak.' Bu netlik tüm stratejik kararları kolaylaştırdı. Yatırımlar, ortaklıklar, iletişim — hepsi bu hedefe hizalanıyor.",
          outcome: "Sonuç: Başarı tanımınız net olunca, cesur kararlar alabilirsiniz. Hacim mi, değer mi, otorite mi?",
          type: 'success'
        },
        scenario: "Karşıt Örnek — Her Fırsata Evet Tuzağı: Bir danışmanlık firması her gelen projeye evet dedi. Farklı sektörler, farklı ölçekler, farklı ihtiyaçlar. Kadro genişledi ama uzmanlık sulandı. Hiçbir sektörde otorite olamadı. Referansları karışık, konumlanması belirsiz. 'Her şeyi yapan firma' = 'hiçbir şeyi iyi yapan firma' algısı. Hedef belirsizse, büyümek sizi zayıflatır.",
      },
      resultMatrix: [
        {
          minScore: 0,
          maxScore: 999,
          title: "Strateji Modeli",
          description: "Hedef ve başarı tanımınız netleşti.",
          recommendations: [
            "İş Hacmi Motoru: Sözleşme sayısı, dönüşüm oranı, genişleme",
            "Otorite İnşası: Thought leadership, sektör ödülleri, konferans",
            "Premium Konumlanma: Az ama değerli, yüksek marj, seçicilik"
          ]
        }
      ],
    },
  ],
};
