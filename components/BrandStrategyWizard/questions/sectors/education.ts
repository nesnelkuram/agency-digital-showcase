import { SectorQuestionConfig } from '../../types';

export const educationConfig: SectorQuestionConfig = {
  sectorId: 'education',

  intro: {
    script: "Eğitimde marka, öğrenciye ne öğrettiğiniz değil, onu nasıl dönüştürdüğünüzdür. Dönüşüm yoksa, içerik unutulur.",
    text: "Bu interaktif deneyim, eğitim markanız için üretilecek görsel ve anlatısal dünyanın güçlü, tutarlı ve öğrencilerinize gerçekten sunabildiğiniz kadar iddialı olmasını sağlamak için tasarlandı.",
  },

  stages: [
    // ========================================================================
    // AŞAMA 0: OPERASYONEL GERÇEKLİK
    // ========================================================================
    {
      intro: {
        script: "Operasyonunuz vaatlerinizi taşıyamazsa, pazarlama sadece hayal kırıklığını büyütür.",
        stageDescription: "Bu aşama, eğitim kurumunuzun vaatlerini operasyonel olarak taşıyıp taşıyamayacağını belirler. Pazarlama kayıt talebini artırır, ancak hazırlıksız bir operasyon bu talebi kriz haline getirir.",
      },
      questions: [
        {
          type: 'selection_scored',
          script: "Farklı eğitmenler ve şubeler arasında öğrenci deneyimi ne kadar tutarlı?",
          text: "Eğitim Deneyimi Tutarlılığı",
          options: [
            { id: 'varies', title: "Eğitmene göre değişiyor", desc: "Her eğitmen kendi tarzında ilerliyor, ortak bir standart yok", score: 0 },
            { id: 'similar', title: "Benzer ama değişken", desc: "Genel müfredat var ama uygulama kişiye bağlı", score: 1 },
            { id: 'mostly_stable', title: "Büyük ölçüde sabit", desc: "Müfredat ve yöntem tanımlı, küçük sapmalar oluyor", score: 2 },
            { id: 'sop_defined', title: "Standartlarla net", desc: "Eğitim programları, değerlendirme kriterleri ve eğitmen rehberleri yazılı ve uygulanıyor", score: 3 },
            { id: 'other', title: "Diğer (Belirtin)", score: 0 }
          ],
          placeholder: "Durumunuzu açıklayın"
        },
        {
          type: 'selection_scored',
          script: "Yoğun dönemlerde — kayıt zamanı, sınav haftası, dönem başı — kalite ve hizmet nasıl?",
          text: "Yoğun Dönem Dayanıklılığı",
          options: [
            { id: 'collapses', title: "Çöküyor", desc: "Kayıt kaosla yönetiliyor, öğrenci şikayetleri artıyor", score: 0 },
            { id: 'struggling', title: "Zorlanıyor", desc: "Hissedilir aksaklıklar var ama idare ediliyor", score: 1 },
            { id: 'mostly_holds', title: "Çoğunlukla korunuyor", desc: "Bazı gecikmeler olsa da genel kalite stabil", score: 2 },
            { id: 'measured', title: "Ölçümlü şekilde korunuyor", desc: "Dönem planlaması ve kapasite yönetimi var, kalite hiç düşmüyor", score: 3 },
            { id: 'other', title: "Diğer (Belirtin)", score: 0 }
          ],
          placeholder: "Durumunuzu açıklayın"
        },
        {
          type: 'selection_scored',
          script: "Bu çalışma sonrası kayıt talebinde %30 artış olursa ne olur?",
          text: "Talep Artışı Kapasitesi",
          options: [
            { id: 'cannot', title: "Karşılayamayız", desc: "Yeterli sınıf, eğitmen veya platform kapasitemiz yok", score: 0 },
            { id: 'partially', title: "Kısmen karşılarız", desc: "Ek eğitmen veya online geçişle idare edebiliriz", score: 1 },
            { id: 'yes', title: "Evet, karşılarız", desc: "Hazırız — yeni sınıf açabilir, platform ölçeklendirebiliriz", score: 2 },
            { id: 'other', title: "Diğer (Belirtin)", score: 0 }
          ],
          placeholder: "Durumunuzu açıklayın"
        }
      ],
      educational: {
        script: "İki eğitim kurumu hikayesi: Biri hızla büyüdü ve çöktü, diğeri altyapısını sağlamlaştırıp sessizce lider oldu.",
        text: "Operasyonel Tutarlılık",
        stats: [
          {
            value: "42%",
            label: "İlk 3 yılda kapanan eğitim girişimleri",
            description: "Yeni kurulan eğitim girişimlerinin %42'si ilk 3 yıl içinde kapanıyor. Başarısızlığın 1 numaralı nedeni: ölçeklenemeyen operasyon.",
            source: "Kaynak: EdTech Failure Analysis Report, 2023"
          },
          {
            value: "89%",
            label: "Tutarlılık bekleyen öğrenciler",
            description: "Öğrencilerin %89'u bir eğitim kurumunun her şubesinde, her eğitmeninde aynı kalitede deneyim bekliyor.",
            source: "Kaynak: EY Global Education Survey, 2024"
          },
          {
            value: "3.5x",
            label: "Standart müfredata sahip kurumların memnuniyeti",
            description: "Standart müfredat ve eğitmen rehberi olan kurumlar, olmayanlara göre 3.5 kat daha yüksek öğrenci memnuniyeti skoru alıyor.",
            source: "Kaynak: Quality Matters Higher Education Report, 2023"
          },
          {
            value: "%35",
            label: "Başarılı kampanya sonrası artan kayıt talebi",
            description: "Başarılı bir dijital kampanya sonrası eğitim kurumlarına olan kayıt talebi ortalama %35 artıyor. Altyapınız hazır değilse bu bir felaket.",
            source: "Kaynak: HolonIQ EdTech Market Report, 2024"
          }
        ],
        caseStudy: {
          title: "Coursera'nın Pandemi Krizi",
          summary: "2020'de Coursera bir gecede 10 milyon yeni kullanıcı kazandı. Herkes online eğitime koştu. Platform altyapısı zorlandı: sunucular çöktü, destek ekibi yetersiz kaldı, kurs kalitesi dengesizdi. Bazı kurslar mükemmeldi, bazıları amatörce. Kullanıcılar geldi ama %73'ü ilk kursu bitirmeden ayrıldı. Talep patlaması fırsattı ama operasyonel tutarsızlık bu fırsatı israf etti. Sonra Coursera standartlaştırma programı başlattı — Coursera for Campus, kalite kriterleri, eğitmen sertifikasyonu.",
          outcome: "Sonuç: Talep patlaması fırsattır, ancak operasyonel tutarlılık yoksa bu fırsat krize dönüşür.",
          type: 'failure'
        },
        scenario: "Karşıt Örnek — Khan Academy: Hiç agresif reklam yapmadı. Ama her videoda aynı kalite, aynı pedagojik yaklaşım, aynı netlik. Öğrenci ne beklediğini biliyordu. Tutarlılık güven yarattı. 150 milyonun üzerinde kullanıcıya ulaştı — operasyonu her zaman vaadinin önündeydi.",
      },
      resultMatrix: [
        {
          minScore: 0,
          maxScore: 2,
          title: "Önce Operasyon",
          description: "Pazarlama kayıt talebini artırır ama aynı hızla memnuniyetsizliği de büyütür.",
          recommendations: [
            "Standart müfredat ve eğitmen rehberleri oluşturun",
            "Eğitmen kalibrasyon ve eğitim programı başlatın",
            "Öğrenci geri bildirim ve kalite kontrol sistemleri kurun",
            "Kapasite planlaması yapın (sınıf, eğitmen, platform)"
          ],
          caseStudy: {
            title: "Khan Academy",
            summary: "Reklamdan çok içerik kalitesi ve tutarlılığa yatırım yaptı. Standart pedagojik yaklaşım = marka oldu.",
            outcome: "Öğrenci 'sürpriz' değil güven satın aldı. 150M+ kullanıcı.",
            type: 'success'
          }
        },
        {
          minScore: 3,
          maxScore: 6,
          title: "Kontrollü Büyüme",
          description: "Sınırlı kontenjan, net program vaatleri ve kademeli ölçekleme gerekir.",
          recommendations: [
            "Kontenjan sistemi ile talep yönetimi",
            "Kapasiteyi aşmayan kampanyalar",
            "Kademeli büyüme stratejisi (önce kalite, sonra ölçek)",
            "Eğitmen ve altyapı iyileştirmelerine devam"
          ]
        },
        {
          minScore: 7,
          maxScore: 8,
          title: "Hazır",
          description: "Marka anlatısı ve görsel dünya agresif biçimde büyütülebilir.",
          recommendations: [
            "Tam kapasiteli dijital pazarlama kampanyası",
            "Viral içerik ve referans stratejisi",
            "Yeni program ve şube ölçekleme planları",
            "Marka değeri ve akreditasyon yatırımı"
          ]
        }
      ],
    },

    // ========================================================================
    // AŞAMA 1: MARKA RUHU
    // ========================================================================
    {
      intro: {
        script: "İnsanlar müfredatı unutur. Ama kendilerini nasıl hissettiklerini hatırlar.",
        stageDescription: "Bu aşama, eğitim markanızın duygusal kimliğini ve öğrencilerinizde yaratmak istediğiniz hissi tanımlar. İnsanlar bilgiyi unutur, ama dönüşümü hatırlar.",
      },
      questions: [
        {
          type: 'selection_list',
          script: "Eğitim markanız kaybolsa, öğrenciniz neyi kaybetmiş hisseder?",
          text: "Kayıp Duygusu",
          options: [
            { id: 'growth', title: "Gelişim", desc: "Sürekli ilerleme hissi, her gün biraz daha iyi olma" },
            { id: 'trust', title: "Güven", desc: "Bildiği, tutarlı, her zaman yanında olan bir rehber" },
            { id: 'belonging', title: "Aidiyet", desc: "Bir topluluğun parçası olma, yalnız olmama hissi" },
            { id: 'mastery', title: "Ustalık", desc: "Gerçek yetkinlik kazanma, mesleğinde fark yaratma" },
            { id: 'inspiration', title: "İlham", desc: "Yeni dünyalar, yeni bakış açıları, ufuk açıcı deneyimler" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Hangi duyguyu yaratıyorsunuz?"
        },
        {
          type: 'selection_list',
          script: "Öğrencinize ne sunuyorsunuz?",
          text: "Deneyim Seviyesi",
          options: [
            { id: 'knowledge_transfer', title: "Bilgi Aktarımı", desc: "Kaliteli içerik, net müfredat, ölçülebilir öğrenme" },
            { id: 'knowledge_mentoring', title: "Bilgi + Mentorluk", desc: "İçerik artı kişisel rehberlik, kariyer desteği, geri bildirim" },
            { id: 'full_transformation', title: "Tam Dönüşüm Yolculuğu", desc: "Bilgi, mentorluk, topluluk, kariyer dönüşümü — baştan sona sahnelenmiş deneyim" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Deneyim seviyenizi tanımlayın"
        },
        {
          type: 'selection_list',
          script: "Eğitim yaklaşımınızın tarzı?",
          text: "Yaklaşım Stili",
          options: [
            { id: 'classic', title: "Klasik", desc: "Geleneksel pedagoji, kanıtlanmış yöntemler, akademik disiplin" },
            { id: 'modern', title: "Modern", desc: "Teknoloji destekli, interaktif, güncel yaklaşımlar" },
            { id: 'experimental', title: "Deneysel", desc: "Proje bazlı, yaparak öğrenme, stüdyo modeli" },
            { id: 'revolutionary', title: "Devrimci", desc: "Geleneksel eğitimi sorgulayan, tamamen yeni bir model" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Eğitim yaklaşımınızı tanımlayın"
        }
      ],
      educational: {
        script: "İnsanlar müfredatı unutur, ama dönüşümü hatırlar.",
        text: "Marka Ruhu",
        stats: [
          {
            value: "76%",
            label: "Duygusal bağ kuran öğrenciler",
            description: "Öğrencilerin %76'sı duygusal bağ kurdukları eğitim kurumlarını başkalarına tavsiye ediyor ve tekrar tercih ediyor.",
            source: "Kaynak: Gallup-Purdue Education Impact Study, 2024"
          },
          {
            value: "6x",
            label: "Hatırlanan dönüşüm anıları",
            description: "İnsanlar 'aha anlarını' ve kişisel dönüşüm deneyimlerini, ezberledikleri bilgilerden 6 kat daha uzun süre hatırlıyor.",
            source: "Kaynak: Journal of Educational Psychology, 2023"
          },
          {
            value: "71%",
            label: "Misyon ve değer arayan öğrenciler",
            description: "Öğrencilerin %71'i bir eğitim kurumunun misyonunu, değerlerini ve 'neden' var olduğunu bilmek istiyor.",
            source: "Kaynak: Strada Education Network Consumer Survey, 2024"
          },
          {
            value: "2.8x",
            label: "Net kimliğe sahip kurumların başarısı",
            description: "Net marka kimliğine sahip eğitim kurumları, belirsiz kimliğe sahip olanlara göre 2.8 kat daha yüksek öğrenci sadakatine sahip.",
            source: "Kaynak: McKinsey Education Practice Report, 2023"
          }
        ],
        caseStudy: {
          title: "Montessori'nin Manifestosu",
          summary: "Maria Montessori bir okul açmadı — bir felsefe yarattı. 'Çocuğa saygı, kendi hızında öğrenme, bağımsızlık.' Bu sadece müfredat değildi, kim olduklarını tanımlayan bir beyandı. Her sınıfta, her materyalde, her eğitmenin yaklaşımında bu ruh hissediliyordu. Çocuk merkezli ortam, somut materyaller, kendi kendine keşif. Tutarlıydı. Aileler ne beklediğini biliyordu. Eğitmenler nasıl davranacağını biliyordu. Rakipler nasıl konumlanacağını biliyordu. 100 yılı aşkın süredir ayakta.",
          outcome: "Sonuç: Net kimlik = kalıcılık. Ruh belirsizse, kurum belirsizdir.",
          type: 'success'
        },
        scenario: "Ruh Çatışması: Bir eğitim kurumu görsellerde inovatif, müfredatta geleneksel, eğitmenlerde rahat ve samimi. Öğrenci ne beklediğini bilemez. Kafası karışır. Alternatifi seçer.",
      },
      resultMatrix: [
        {
          minScore: 0,
          maxScore: 999,
          title: "Marka Ruhu Profili",
          description: "Seçimlerinize göre eğitim markanızın ruhu şekillendi.",
          recommendations: [
            "Gelişim Odağı: Sürekli ilerleme, ölçülebilir sonuçlar, motivasyon döngüsü",
            "Güven Limanı: Tutarlı kalite, güvenilir rehberlik, her zaman yanında",
            "Aidiyet Alanı: Topluluk, bağ, birlikte öğrenme, alumni ağı",
            "Ustalık Yolu: Derinlik, uzmanlık, sektör yetkinliği, portfolyo",
            "İlham Kaynağı: Yeni bakış açıları, ufuk açıcı içerikler, vizyon"
          ]
        }
      ],
    },

    // ========================================================================
    // AŞAMA 2: MARKA KARAKTERİ (ARKETİP)
    // ========================================================================
    {
      intro: {
        script: "Arketip, kurumun güzel göründüğünde değil, zorlandığında kim olduğunu belirler.",
        stageDescription: "Bu aşama, eğitim markanızın davranış tarzını ve kriz anlarındaki tepkilerini tanımlar. Arketip, markanızın başarılı olduğunda değil, zorlandığında nasıl davrandığını belirler.",
      },
      questions: [
        {
          type: 'selection_list',
          script: "Öğrenciler düşük başarı oranından şikayet etse veya bir eğitmenden memnuniyetsizlik bildirse, ilk tepkiniz ne olur?",
          text: "Kriz Tepkisi",
          options: [
            { id: 'compensate', title: "Telafi eder", desc: "Özür diler, ek ders/destek sağlar, memnuniyeti garanti eder (Bakıcı)" },
            { id: 'defend', title: "Standardı savunur", desc: "Programımızın seviyesi budur, başarı öğrencinin sorumluluğudur (Hükümdar)" },
            { id: 'explain', title: "Veriyle açıklar", desc: "Başarı oranlarını, metodoloji araştırmalarını paylaşır (Bilge)" },
            { id: 'challenge', title: "Meydan okur", desc: "Gerçekten tüm ödevleri yaptınız mı? Kendinize dürüst olun (Asi)" },
            { id: 'redesign', title: "Yeniden tasarlar", desc: "Haklısınız, müfredatı ve yöntemi gözden geçirelim (Yaratıcı)" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Kriz tepkinizi açıklayın"
        },
        {
          type: 'selection_list',
          script: "Potansiyel öğrenciyi nasıl ikna edersiniz?",
          text: "İkna Yöntemi",
          options: [
            { id: 'results', title: "Sonuçlarla", desc: "Mezun başarı oranları, iş bulma yüzdeleri, sınav skorları" },
            { id: 'reference', title: "Referansla", desc: "Akreditasyonlar, ödüller, tanınmış mezunlar, medya" },
            { id: 'knowledge', title: "Bilgiyle", desc: "Metodoloji, müfredat derinliği, akademik yetkinlik" },
            { id: 'experience', title: "Deneyimle", desc: "Ücretsiz ders, kampüs turu, topluluk atmosferi" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "İkna yönteminizi açıklayın"
        },
        {
          type: 'selection_list',
          script: "İletişim tonunuz nasıl?",
          text: "İletişim Tonu",
          options: [
            { id: 'authoritative', title: "Otoriter", desc: "Uzman, bilgili, güven veren, akademik" },
            { id: 'inspiring', title: "İlham verici", desc: "Motive eden, hayaller kuran, vizyon çizen" },
            { id: 'warm', title: "Samimi", desc: "Yakın, destekleyici, mentor gibi, yol arkadaşı" },
            { id: 'provocative', title: "Provokatif", desc: "Soru sordurtan, kalıpları kıran, rahatsız eden" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "İletişim tonunuzu tanımlayın"
        }
      ],
      educational: {
        script: "Arketip, kurumun neye benzediğini değil, krizde nasıl davrandığını belirler.",
        text: "Karakter Tutarlılığı",
        stats: [
          {
            value: "79%",
            label: "Tutarlı karakter bekleyen öğrenciler",
            description: "Öğrencilerin %79'u bir eğitim kurumunun web sitesinde, sınıfta ve iletişimde tutarlı bir karakter sergilemesini bekliyor.",
            source: "Kaynak: Eduventures Student Sentiment Study, 2023"
          },
          {
            value: "4.5x",
            label: "Kriz anında güvenilir kurumlar",
            description: "Net karaktere sahip eğitim kurumları, kriz anlarında (pandemi, müfredat değişikliği) belirsiz karakterli kurumlara göre 4.5 kat daha güvenilir bulunuyor.",
            source: "Kaynak: Edelman Trust in Education Report, 2024"
          },
          {
            value: "88%",
            label: "Karakter tutarlılığının kayıt oranına etkisi",
            description: "Eğitim kurumlarının %88'i karakter tutarlılığının kayıt oranlarını doğrudan artırdığını bildiriyor.",
            source: "Kaynak: NACAC Enrollment Trends Report, 2023"
          },
          {
            value: "62%",
            label: "Karakter çelişkisi hisseden öğrenciler",
            description: "Öğrencilerin %62'si bir eğitim kurumunda karakter çelişkisi (örn. 'inovatif' vaadi + ezberci yöntem) hissettiklerinde kurumu terk ediyor.",
            source: "Kaynak: Inside Higher Ed Student Retention Study, 2024"
          }
        ],
        caseStudy: {
          title: "MasterClass — Otorite Arketipi",
          summary: "MasterClass açıldığında tek bir soru sordu: 'Ya dünyanın en iyileri öğretmenin olsa?' Gordon Ramsay aşçılık, Martin Scorsese sinema, Serena Williams tenis. Her derste aynı ruh: otoriteyle öğretim. Üretim kalitesi sinema seviyesindeydi. Eğitmenler sadece bilgi aktarmıyor, alanlarındaki ustalığı gösteriyordu. Arketip her detayda hissedildi — karanlık stüdyo, dramatik ışık, ustanın sesi. 'Bilge + Hükümdar' arketipi tutarlıydı.",
          outcome: "Sonuç: Arketip tutarlıysa her karar kolaylaşır. Görsel, ses, ton, içerik — hepsi otomatik hizalanır.",
          type: 'success'
        },
        scenario: "Arketip Çakışması: Web sitesinde 'devrimci eğitim' vaadi + sınıfta PowerPoint'ten okuyan eğitmen. Öğrenci zihninde bilişsel uyumsuzluk yaratır. Vaade inanmayı bırakır.",
      },
      resultMatrix: [
        {
          minScore: 0,
          maxScore: 999,
          title: "Marka Arketipi",
          description: "Kriz anında davranış şekliniz eğitim markanızın karakterini ortaya koydu.",
          recommendations: [
            "Bakıcı: Destek, koruma, 'biz yanınızdayız' — mentorluk odaklı",
            "Hükümdar: Standart, disiplin, kalite kontrolü — akademik otorite",
            "Bilge: Veri, araştırma, metodoloji — bilgi odaklı güven",
            "Asi: Kalıpları kırma, sorgulama, farklı düşünme — yenilikçi",
            "Yaratıcı: Sürekli iyileştirme, deneysel yöntemler — tasarım odaklı"
          ]
        }
      ],
    },

    // ========================================================================
    // AŞAMA 3: KİM DEĞİLİZ (ANTI-PERSONA)
    // ========================================================================
    {
      intro: {
        script: "Herkes için olan kurum, kimse için vazgeçilmez değildir.",
        stageDescription: "Bu aşama, eğitim kurumunuz için zararlı olan öğrenci/katılımcı profillerini belirlemenize yardımcı olur. Herkes için olan program, kimseye gerçek değer sunamaz.",
      },
      questions: [
        {
          type: 'selection_list',
          script: "Hangi öğrenci/katılımcı tipi kurumunuza en çok zarar verir?",
          text: "En Zararlı Katılımcı Tipi",
          options: [
            { id: 'certificate_hunter', title: "Sertifika avcısı", desc: "Sadece belge istiyor, öğrenmeyle ilgilenmiyor" },
            { id: 'unmotivated', title: "Motivasyonsuz", desc: "Katılmıyor, ödev yapmıyor, sınıf enerjisini düşürüyor" },
            { id: 'chronic_complainer', title: "Sürekli şikayetçi", desc: "Hiçbir şeyden memnun değil, her şeyi eleştiriyor" },
            { id: 'payment_issue', title: "Ödeme sorunu olan", desc: "Sürekli taksit problemi, gecikmeler, iptaller" },
            { id: 'disruptive', title: "Sınıf düzeni bozucu", desc: "Diğer öğrencilerin öğrenme deneyimini olumsuz etkiliyor" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Zararlı katılımcı tipini tanımlayın"
        },
        {
          type: 'selection_list',
          script: "Bu katılımcı profili hangi soruna yol açıyor?",
          text: "Sorun Tipi",
          options: [
            { id: 'quality', title: "Eğitim kalitesi düşüşü", desc: "Sınıf dinamiği bozuluyor, diğer öğrenciler etkileniyor" },
            { id: 'reputation', title: "İtibar kaybı", desc: "Olumsuz yorumlar, gerçekçi olmayan beklentilerden hayal kırıklığı" },
            { id: 'financial', title: "Finansal kayıp", desc: "İptal, iade, ödeme takibi — operasyonel yük" },
            { id: 'culture', title: "Kurum kültürü erozyonu", desc: "Değerler ve misyonla çelişen davranışlar normalleşiyor" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Sorun tipini açıklayın"
        },
        {
          type: 'selection_list',
          script: "Bu duruma nasıl yaklaşırsınız?",
          text: "Yaklaşım Tavırı",
          options: [
            { id: 'soft', title: "Nazik yönlendirme", desc: "Ön değerlendirme, motivasyon mülakatı, dolaylı filtreleme" },
            { id: 'barrier', title: "Bariyer sistemi", desc: "Giriş sınavı, portfolyo, ön koşul belirleyerek doğal eleme" },
            { id: 'hard_no', title: "Net kural", desc: "Açık katılım şartları, devamsızlık politikası, 'bu program sizin için değil' mesajı" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Yaklaşım tavrınızı açıklayın"
        }
      ],
      educational: {
        script: "Herkes için olan program, kimse için dönüştürücü değildir.",
        text: "Filtreleme Stratejisi",
        stats: [
          {
            value: "67%",
            label: "Hedef dışı öğrencilerin tamamlama oranı",
            description: "Hedef profil dışındaki öğrencilerin %67'si programı tamamlamıyor. Bu, kaynak israfı ve olumsuz yorum demek.",
            source: "Kaynak: Online Learning Consortium Completion Study, 2023"
          },
          {
            value: "5x",
            label: "Seçici kabul yapan kurumların memnuniyeti",
            description: "Net katılımcı profili belirleyen ve filtreleme uygulayan kurumlar, herkesi kabul edenlere göre 5 kat daha yüksek memnuniyet skoru alıyor.",
            source: "Kaynak: EDUCAUSE Student Experience Report, 2024"
          },
          {
            value: "48%",
            label: "Sertifika avcılarının negatif etkisi",
            description: "Sadece sertifika için katılan öğrencilerin %48'i olumsuz yorum bırakıyor — çünkü programdan aldıkları değer, beklentileriyle uyuşmuyor.",
            source: "Kaynak: Class Central Learner Survey, 2023"
          },
          {
            value: "83%",
            label: "Seçici kurumların itibar skoru",
            description: "Öğrenci kabul sürecinde seçici davranan kurumların %83'ü daha yüksek itibar skoruna sahip.",
            source: "Kaynak: Times Higher Education Reputation Rankings, 2024"
          }
        ],
        caseStudy: {
          title: "Koç Üniversitesi — Seçici Kabul Stratejisi",
          summary: "Koç Üniversitesi Türkiye'nin en seçici üniversitelerinden biri olmayı bilinçli bir strateji olarak benimsedi. Sadece sıralama değil — motivasyon mektubu, mülakat, portfolyo. Herkes başvurabiliyor ama herkes kabul edilmiyor. 'Herkesi almak' yerine 'doğru öğrenciyi almak' felsefesi. Sonuç: Mezunların %94'ü ilk 6 ayda iş buluyor. Alumni ağı güçlü. NPS skoru sektör ortalamasının çok üzerinde. Seçicilik, kaliteyi korudu.",
          outcome: "Sonuç: Net filtreleme, doğru öğrenciyi çekti. Herkes için olmayı reddettiler, vazgeçilmez oldular.",
          type: 'success'
        },
        scenario: "Motivasyonsuz Öğrenci Etkisi: Bir bootcamp programında 30 kişilik sınıfın 10'u sadece CV'ye sertifika eklemek için geldi. Ödev yapmıyorlar, tartışmalara katılmıyorlar. Diğer 20 öğrencinin motivasyonu düştü. Eğitmen enerjisi tükendi. Çözüm: Ön değerlendirme ve motivasyon mülakatı eklediler. Sonraki dönem 22 kişiyle başladılar ama tamamlama oranı %40'tan %85'e çıktı.",
      },
      resultMatrix: [
        {
          minScore: 0,
          maxScore: 999,
          title: "Filtreleme Stratejisi",
          description: "İstemediğiniz katılımcı profilini tanımladınız.",
          recommendations: [
            "Soft Filtreleme: Ön değerlendirme, motivasyon mülakatı, deneme dersi",
            "Bariyerli Sistem: Giriş sınavı, portfolyo, ön koşul, seviye testi",
            "Sert Kural: Açık kabul kriterleri, devamsızlık politikası, performans şartı"
          ]
        }
      ],
    },

    // ========================================================================
    // AŞAMA 4: HEDEF VE BAŞARI
    // ========================================================================
    {
      intro: {
        script: "Ne istiyoruz? Öğrenci sayısı mı, eğitim kalitesi mi, sektör otoritesi mi?",
        stageDescription: "Bu aşama, eğitim projenizin birincil hedefini ve başarı metriklerinizi netleştirir. Kayıt doluluk mu, mezun başarısı mı, sektör otoritesi mi? Hedef belirsizse strateji de belirsiz olur.",
      },
      questions: [
        {
          type: 'selection_list',
          script: "Bu projedeki birincil hedefiniz?",
          text: "Birincil Hedef",
          options: [
            { id: 'student_count', title: "Öğrenci sayısı", desc: "Kayıt sayısını artırmak, daha fazla öğrenciye ulaşmak" },
            { id: 'education_quality', title: "Eğitim kalitesi", desc: "Müfredat, metodoloji ve öğrenci deneyimini iyileştirmek" },
            { id: 'sector_authority', title: "Sektör otoritesi", desc: "Alanında referans kurum olmak, düşünce liderliği" },
            { id: 'digital_transformation', title: "Dijital dönüşüm", desc: "Online/hibrit modele geçiş, teknoloji entegrasyonu" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Hedefiniz nedir?"
        },
        {
          type: 'selection_list',
          script: "Büyüme hızı tercihiniz?",
          text: "Büyüme Hızı Tercihi",
          options: [
            { id: 'fast', title: "Hızlı", desc: "Agresif büyüme, kısa sürede maksimum öğrenci sayısı" },
            { id: 'balanced', title: "Dengeli", desc: "Sürdürülebilir büyüme, kaliteyi koruyarak ölçekleme" },
            { id: 'selective', title: "Seçkin", desc: "Yavaş ama değerli, premium konumlandırma, sınırlı kontenjan" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Büyüme stratejiniz?"
        },
        {
          type: 'selection_list',
          script: "Başarı sizin için ne demek?",
          text: "Başarı İşareti",
          options: [
            { id: 'graduate_success', title: "Mezun başarısı", desc: "Mezunların kariyer başarısı, iş bulma oranı, sektördeki etkisi" },
            { id: 'enrollment_rate', title: "Kayıt doluluk oranı", desc: "Kontenjan doluluğu, bekleme listesi, talep fazlası" },
            { id: 'nps', title: "NPS (Tavsiye Skoru)", desc: "Öğrencilerin kurumu başkalarına tavsiye etme oranı" },
            { id: 'accreditation', title: "Akreditasyon ve sertifikasyon", desc: "Ulusal/uluslararası akreditasyonlar, sektör tanınırlığı" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Başarı tanımınız?"
        }
      ],
      educational: {
        script: "Viral olmak bir hedef değil, stres testidir. Eğitimde gerçek başarı ölçülebilir dönüşümdür.",
        text: "Başarı Tanımı",
        stats: [
          {
            value: "74%",
            label: "Net hedefi olmayan eğitim kurumları",
            description: "Eğitim kurumlarının %74'ü 'öğrenci sayısı' ve 'eğitim kalitesi' hedeflerini karıştırıyor. Sonuç: belirsiz strateji, kaynak israfı.",
            source: "Kaynak: Deloitte Education Industry Outlook, 2023"
          },
          {
            value: "3.7x",
            label: "Net başarı metriği olan kurumlar",
            description: "Net başarı metriği tanımlayan eğitim kurumları, belirsiz metrikli olanlara göre 3.7 kat daha hızlı büyüyor.",
            source: "Kaynak: BCG Education Growth Study, 2024"
          },
          {
            value: "91%",
            label: "Mezun başarısının kayıt etkisi",
            description: "Mezun başarı oranını açıkça paylaşan kurumların %91'i kayıt talebinde belirgin artış görüyor.",
            source: "Kaynak: GMAC Application Trends Survey, 2024"
          },
          {
            value: "68%",
            label: "Akreditasyonun güven etkisi",
            description: "Potansiyel öğrencilerin %68'i akreditasyonlu kurumları, akreditasyonsuz alternatiflerine göre 2 kat daha güvenilir buluyor.",
            source: "Kaynak: CHEA Accreditation Impact Report, 2023"
          }
        ],
        caseStudy: {
          title: "Duolingo — Ölçülebilir Dönüşüm",
          summary: "Duolingo kurulduğunda bir hedef koydu: Dil öğrenmeyi herkes için ücretsiz ve erişilebilir kılmak. Ama 'herkes için' demek 'kalitesiz' anlamına gelmedi. Başarı metriğini net tanımladılar: Günlük aktif kullanıcı sayısı değil, gerçek dil yetkinliği kazanma oranı. Gamification, streak sistemi, uyarlanabilir öğrenme — hepsi bu metriğe hizmet etti. 2023'te Duolingo İngilizce testleri, birçok üniversite tarafından TOEFL alternatifi olarak kabul edildi. Hedef netti: Erişilebilir ama ölçülebilir eğitim.",
          outcome: "Sonuç: Başarı tanımınız net olunca, her özellik o hedefe hizmet eder. 500M+ kullanıcı, ama önemli olan: ölçülebilir dil yetkinliği.",
          type: 'success'
        },
        scenario: "Karşıt Örnek — Büyüme Tuzağı: Bir online kurs platformu agresif reklam yaptı. Kayıtlar patladı. Ama eğitmen sayısı yetersizdi, destek ekibi yoktu, içerik kalitesi düşüktü. Tamamlama oranı %8'e düştü. Olumsuz yorumlar çığ gibi büyüdü. Kayıt sayısı hedefti ama başarı metriği tamamlama oranıydı. Yanlış metriği ölçüyorlardı.",
      },
      resultMatrix: [
        {
          minScore: 0,
          maxScore: 999,
          title: "Strateji Modeli",
          description: "Hedef ve başarı tanımınız netleşti.",
          recommendations: [
            "Kayıt Motoru: Öğrenci sayısı, dönüşüm oranı, kontenjan doluluğu",
            "Kalite Odağı: Tamamlama oranı, öğrenci memnuniyeti, NPS",
            "Otorite İnşası: Akreditasyon, sektör tanınırlığı, düşünce liderliği",
            "Dönüşüm Platformu: Mezun başarısı, kariyer etkisi, alumni ağı"
          ]
        }
      ],
    },
  ],
};
