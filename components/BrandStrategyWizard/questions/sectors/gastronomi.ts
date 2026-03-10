import { SectorQuestionConfig } from '../../types';

export const gastronomyConfig: SectorQuestionConfig = {
  sectorId: 'gastronomi',

  intro: {
    script: "Güçlü bir imaj, zayıf bir operasyonu gizlemez. Aksine, onu hızla görünür kılar.",
    text: "Bu interaktif deneyim, gastronomi markanız için üretilecek görsel ve anlatısal dünyanın şık, tutarlı ve taşıyabildiğiniz kadar iddialı olmasını sağlamak için tasarlandı.",
  },

  stages: [
    // ========================================================================
    // AŞAMA 0: OPERASYONEL GERÇEKLİK
    // ========================================================================
    {
      intro: {
        script: "Operasyonunuz vaat ettiğinizi taşıyamazsa, pazarlama sadece problemi büyütür.",
        stageDescription: "Bu aşama, markanızın vaatlerini operasyonel olarak taşıyıp taşıyamayacağınızı belirler. Pazarlama talebi artırır, ancak hazırlıksız bir operasyon bu talebi kriz haline getirir.",
      },
      questions: [
        {
          type: 'selection_scored',
          script: "Misafir deneyiminiz ne kadar tutarlı?",
          text: "Deneyim Tutarlılığı",
          options: [
            { id: 'varies', title: "Kişiye göre değişiyor", desc: "Her personel farklı yaklaşım sergiliyor", score: 0 },
            { id: 'similar', title: "Benzer ama değişken", desc: "Genel çerçeve var ama esneklik fazla", score: 1 },
            { id: 'mostly_stable', title: "Büyük ölçüde sabit", desc: "Çoğu durumda tutarlı, bazen sapmalar oluyor", score: 2 },
            { id: 'sop_defined', title: "SOP ile net", desc: "Standart operasyon prosedürleri yazılı ve uygulanıyor", score: 3 },
            { id: 'other', title: "Diğer (Belirtin)", score: 0 }
          ],
          placeholder: "Durumunuzu açıklayın"
        },
        {
          type: 'selection_scored',
          script: "Yoğun saatlerde kalite ve hizmet nasıl?",
          text: "Pik Saat Dayanıklılığı",
          options: [
            { id: 'collapses', title: "Çöküyor", desc: "Kalite ve hizmet ciddi düşüş yaşıyor", score: 0 },
            { id: 'struggling', title: "Zorlanıyor", desc: "Hissedilir sorunlar var ama idare ediliyor", score: 1 },
            { id: 'mostly_holds', title: "Çoğunlukla korunuyor", desc: "Bazen küçük aksamalar ama genel kalite stabil", score: 2 },
            { id: 'measured', title: "Ölçümlü şekilde korunuyor", desc: "Yoğunluk yönetimi var, kalite hiç düşmüyor", score: 3 },
            { id: 'other', title: "Diğer (Belirtin)", score: 0 }
          ],
          placeholder: "Durumunuzu açıklayın"
        },
        {
          type: 'selection_scored',
          script: "Bu çalışma sonrası %30 ilgi artışı olursa ne olur?",
          text: "Talep Artışı Kapasitesi",
          options: [
            { id: 'cannot', title: "Karşılayamayız", desc: "Mevcut kapasite yetersiz", score: 0 },
            { id: 'partially', title: "Kısmen karşılarız", desc: "Bazı düzenlemelerle idare edebiliriz", score: 1 },
            { id: 'yes', title: "Evet, karşılarız", desc: "Hazırız ve ölçeklenebiliriz", score: 2 },
            { id: 'other', title: "Diğer (Belirtin)", score: 0 }
          ],
          placeholder: "Durumunuzu açıklayın"
        }
      ],
      educational: {
        script: "İki restoran hikayesi: Biri parlak bir başlangıç yaptı, diğeri sessizce büyüdü. Sadece biri ayakta kaldı.",
        text: "Operasyonel Tutarlılık",
        stats: [
          {
            value: "60%",
            label: "İlk yıl kapanan restoranlar",
            description: "Restoranların %60'ı ilk yılda kapanıyor. Başarısızlığın 1 numaralı nedeni: operasyonel hazırlıksızlık.",
            source: "Kaynak: National Restaurant Association, 2023"
          },
          {
            value: "95%",
            label: "Tutarlılık bekleyen müşteriler",
            description: "Müşterilerin %95'i bir markanın her lokasyonunda aynı deneyimi bekliyor. Tutarsızlık = güven kaybı.",
            source: "Kaynak: QSR Magazine Consumer Study, 2024"
          },
          {
            value: "3x",
            label: "SOP'li restoranlarda müşteri memnuniyeti",
            description: "Standart operasyon prosedürü olan restoranlar, olmayanlara göre 3 kat daha yüksek müşteri memnuniyeti skoruna sahip.",
            source: "Kaynak: Cornell Hospitality Quarterly, 2023"
          },
          {
            value: "%30",
            label: "Viral kampanya sonrası artan talep",
            description: "Başarılı bir sosyal medya kampanyası sonrası restoranlara olan talep ortalama %30 artıyor. Hazır değilseniz bu bir felaket.",
            source: "Kaynak: Toast Restaurant Success Report, 2024"
          }
        ],
        caseStudy: {
          title: "Jamie's Italian",
          summary: "Jamie Oliver'ın restoranı açıldığında her yer doluydu. Ünlü şefin adı kapıları açtı. İlk aylar mükemmeldi — medya, kalabalık, beklenti. Sonra genişleme başladı: 60+ restoran. Ama mutfakta kaos vardı. Her şube farklı standartlarda çalışıyordu. Bir şubede harika olan yemek, diğerinde hayal kırıklığıydı. Müşteriler geldi, ama ikinci kez gelmediler. Medya ilgisi azaldıktan sonra geriye sadece kötü yorumlar kaldı. Teker teker kapandılar.",
          outcome: "Sonuç: Parlak başlangış, hızlı çöküş. Operasyon tutarlı değilse marka sizi kurtarmaz.",
          type: 'failure'
        },
        scenario: "Karşıt Örnek — Hillstone Group: Hiç reklam yapmadı. Sosyal medyada görünmez. Ama her restoranlarında aynı deneyimi yaşarsınız. Aynı servis standardı, aynı kalite. Müşteri sürpriz değil, güven satın alır. 40 yıldır ayaktalar.",
      },
      resultMatrix: [
        {
          minScore: 0,
          maxScore: 2,
          title: "Önce Operasyon",
          description: "Pazarlama talebi artırır ama aynı hızla problemi de büyütür.",
          recommendations: [
            "SOP (Standart Operasyon Prosedürleri) oluşturun",
            "Personel eğitim programı başlatın",
            "Kalite kontrol sistemleri kurun",
            "Kapasite planlaması yapın"
          ],
          caseStudy: {
            title: "Hillstone Group",
            summary: "Reklamdan çok SOP'ye yatırım yaptı. Tutarlılık = marka oldu.",
            outcome: "Misafir 'sürpriz' değil güven satın aldı.",
            type: 'success'
          }
        },
        {
          minScore: 3,
          maxScore: 6,
          title: "Kontrollü Büyüme",
          description: "Sınırlı vaat, net sınırlar, rezervasyon disiplini gerekir.",
          recommendations: [
            "Rezervasyon sistemi ile talep yönetimi",
            "Kapasiteyi aşmayan kampanyalar",
            "Kademeli büyüme stratejisi",
            "Operasyonel iyileştirmelere devam"
          ]
        },
        {
          minScore: 7,
          maxScore: 8,
          title: "Hazır",
          description: "Marka anlatısı ve görsel dünya agresif biçimde büyütülebilir.",
          recommendations: [
            "Tam kapasiteli pazarlama kampanyası",
            "Viral içerik stratejisi",
            "Ölçekleme planları",
            "Marka değeri yatırımı"
          ]
        }
      ],
    },

    // ========================================================================
    // AŞAMA 1: MARKA RUHU
    // ========================================================================
    {
      intro: {
        script: "İnsanlar yemeği unutur. Ama nasıl hissettiklerini hatırlar.",
        stageDescription: "Bu aşama, markanızın duygusal kimliğini ve misafirlerinizde yaratmak istediğiniz hissi tanımlar. İnsanlar yemeği unutur, ama nasıl hissettiklerini hatırlar.",
      },
      questions: [
        {
          type: 'selection_list',
          script: "Markanız kaybolsa, misafir neyi kaybetmiş hisseder?",
          text: "Kayıp Duygusu",
          options: [
            { id: 'trust', title: "Güven", desc: "Bildiği, tutarlı, güvenilir bir yer" },
            { id: 'curiosity', title: "Merak", desc: "Her seferinde yeni bir keşif" },
            { id: 'prestige', title: "Prestij", desc: "Statü, ayrıcalık hissi" },
            { id: 'warmth', title: "Sıcaklık", desc: "Eve gelmiş gibi, aile havası" },
            { id: 'courage', title: "Cesaret", desc: "Risk alma, farklı olma özgürlüğü" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Hangi duyguyu yaratıyorsunuz?"
        },
        {
          type: 'selection_list',
          script: "Misafirinize ne sunuyorsunuz?",
          text: "Deneyim Seviyesi",
          options: [
            { id: 'food_only', title: "Yemek", desc: "Lezzetli yemek, kaliteli ürün" },
            { id: 'food_ritual', title: "Yemek + Ritüel", desc: "Sunum, servis tarzı, atmosfer" },
            { id: 'full_journey', title: "Baştan sona sahnelenmiş yolculuk", desc: "Hikaye, tema, duygusal deneyim" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Deneyim seviyenizi tanımlayın"
        },
        {
          type: 'selection_list',
          script: "Mutfak yaklaşımınız?",
          text: "Yorum Seviyesi",
          options: [
            { id: 'authentic', title: "Otantik", desc: "Geleneksel tarifler, orijinal teknikler" },
            { id: 'respectful', title: "Saygılı yorum", desc: "Temele sadık ama modern dokunuşlar" },
            { id: 'radical', title: "Radikal", desc: "Cesur denemeler, beklenmedik kombinasyonlar" },
            { id: 'rewrite', title: "Yeniden yazım", desc: "Tamamen yeni bir dil, meydan okuma" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Mutfak yaklaşımınızı tanımlayın"
        }
      ],
      educational: {
        script: "İnsanlar yemeği unutur, ama hissi hatırlar.",
        text: "Marka Ruhu",
        stats: [
          {
            value: "82%",
            label: "Duygusal bağ kuran misafirler",
            description: "Müşterilerin %82'si duygusal bağ kurdukları restoranlara daha sık gidiyor ve daha fazla ödüyor.",
            source: "Kaynak: Deloitte Restaurant Industry Report, 2024"
          },
          {
            value: "7x",
            label: "Hatırlanan duygusal anılar",
            description: "İnsanlar duygusal deneyimleri yemeklerin kendisinden 7 kat daha uzun süre hatırlıyor.",
            source: "Kaynak: Journal of Consumer Psychology, 2023"
          },
          {
            value: "64%",
            label: "Hikaye isteyen tüketiciler",
            description: "Tüketicilerin %64'ü markanın hikayesini, değerlerini ve nereden geldiğini bilmek istiyor.",
            source: "Kaynak: Sprout Social Consumer Study, 2024"
          },
          {
            value: "2.4x",
            label: "Net kimliğe sahip markaların başarısı",
            description: "Net marka kimliğine sahip restoranlar, belirsiz kimliğe sahip olanlara göre 2.4 kat daha yüksek müşteri sadakatine sahip.",
            source: "Kaynak: Harvard Business Review, 2023"
          }
        ],
        caseStudy: {
          title: "Mikla'nın Manifestosu",
          summary: "Mikla açıldığında bir manifesto yazdı: 'Yeni Anadolu Mutfağı.' Bu sadece menü değildi — kim olduklarını tanımlayan bir beyandı. Her tabakta, her serviște, her sosyal medya paylaşımında bu ruh hissediliyordu. Yerel malzemeler, modern teknikler, İstanbul'un hikayesi. Tutarlıydı. Misafir ne beklediğini biliyordu. Medya ne yazacağını biliyordu. Rakipler nasıl konumlanacağını biliyordu.",
          outcome: "Sonuç: Net kimlik = hatırlanma. Ruh belirsizse, marka belirsizdir.",
          type: 'success'
        },
        scenario: "Ruh Çatışması: Bir restoran görsellerde lüks, serviște samimi, mutfakta deneysel. Misafir ne bekleyeceğini bilemez. Kafası karışır. Rakibi seçer.",
      },
      resultMatrix: [
        {
          minScore: 0,
          maxScore: 999,
          title: "Marka Ruhu Profili",
          description: "Seçimlerinize göre marka ruhunuz şekillendi.",
          recommendations: [
            "Güvenli Liman: SOP + sakin anlatı",
            "Keşif Alanı: Teaser, katmanlı hikaye",
            "Prestij Sahnesi: Az konuş, kanıtla",
            "Misafirlik Evi: İnsan yüzü, bağ",
            "Cesaret Alanı: Risk, tartışma, filtre"
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
        stageDescription: "Bu aşama, markanızın davranış tarzını ve kriz anlarındaki tepkilerini tanımlar. Arketip, markanızın güzel göründüğünde değil, zorlandığında kim olduğunu belirler.",
      },
      questions: [
        {
          type: 'selection_list',
          script: "Misafir 'çorba soğuk' dese, ilk tepkiniz ne olur?",
          text: "Kriz Tepkisi",
          options: [
            { id: 'compensate', title: "Telafi eder", desc: "Özür diler, yenisini getirir, hesaptan düşer (Bakıcı)" },
            { id: 'defend', title: "Standardı savunur", desc: "Bu bizim tarzımız, sıcaklık böyle olmalı (Hükümdar)" },
            { id: 'explain', title: "Açıklar", desc: "Neden böyle servis edildiğini anlatır (Bilge)" },
            { id: 'challenge', title: "Meydan okur", desc: "Gerçekten mi? Tekrar deneyin (Asi)" },
            { id: 'redesign', title: "Yeniden tasarlar", desc: "Haklısınız, şöyle deneyelim... (Yaratıcı)" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Kriz tepkinizi açıklayın"
        },
        {
          type: 'selection_list',
          script: "İletişim tonunuz?",
          text: "Ton",
          options: [
            { id: 'minimal', title: "Minimal", desc: "Az konuş, çok göster" },
            { id: 'prestigious', title: "Prestijli", desc: "Ayrıcalık, seçkinlik vurgusu" },
            { id: 'warm', title: "Samimi", desc: "Yakın, dostça, içten" },
            { id: 'provocative', title: "Provokatif", desc: "Soru sordurtan, tartışma yaratan" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "İletişim tonunuzu tanımlayın"
        }
      ],
      educational: {
        script: "Arketip, markanın neye benzediğini değil, krizde nasıl davrandığını belirler.",
        text: "Karakter Tutarlılığı",
        stats: [
          {
            value: "73%",
            label: "Tutarlı marka karakteri bekleyen müşteriler",
            description: "Tüketicilerin %73'ü bir markanın her temas noktasında tutarlı bir karakter sergilemesini bekliyor.",
            source: "Kaynak: McKinsey Brand Consistency Study, 2023"
          },
          {
            value: "5x",
            label: "Kriz anında güvenilir markalar",
            description: "Net arketipe sahip markalar, kriz anlarında belirsiz karakterli markalara göre 5 kat daha güvenilir bulunuyor.",
            source: "Kaynak: Edelman Trust Barometer, 2024"
          },
          {
            value: "91%",
            label: "Karakter tutarlılığının marka bağlılığına etkisi",
            description: "Markaların %91'i karakter tutarlılığının müşteri bağlılığını artırdığını onaylıyor.",
            source: "Kaynak: Forbes Brand Loyalty Report, 2023"
          },
          {
            value: "68%",
            label: "Arketip çakışması yaşayan markalar",
            description: "Müşterilerin %68'i bir restoranda arketip çakışması (örn. lüks dekor + laubali servis) hissettiklerinde bir daha gitmiyorlar.",
            source: "Kaynak: Restaurant Business Magazine, 2024"
          }
        ],
        caseStudy: {
          title: "Turk Fatih Tutak",
          summary: "Fatih Tutak restoranını açtığında tek bir şey istiyordu: Hikayesini anlatmak. Anadolu'dan gelen malzemeler, Japonya'da öğrendiği teknikler, İstanbul'da yarattığı sentez. 12 kursluk deneyim bir rota gibi tasarlandı. Misafir oturmuyor, yolculuğa çıkıyor. Her tabak bir durak. Her durakta bir hikaye. Arketip mutfakta değil, misafirin hareketindeydi. 'Yaratıcı' arketipi her detayda hissediliyordu.",
          outcome: "Sonuç: Arketip tutarlıysa her karar kolaylaşır. Renk, müzik, tempo, dil — hepsi otomatik hizalanır.",
          type: 'success'
        },
        scenario: "Arketip Çakışması: Hükümdar dekor (lüks, kontrol, otorite) + laubali servis (samimi, rahat, arkadaşça). Misafir zihninde bilişsel uyumsuzluk yaratır. Nereye geldi?",
      },
      resultMatrix: [
        {
          minScore: 0,
          maxScore: 999,
          title: "Marka Arketipi",
          description: "Kriz anında davranış şekliniz karakterinizi ortaya koydu.",
          recommendations: [
            "Bakıcı: Sıcaklık, koruma, 'eve hoş geldiniz'",
            "Hükümdar: Standart, otorite, kontrol",
            "Bilge: Bilgi, eğitim, derinlik",
            "Asi: Provokasyon, meydan okuma, filtre",
            "Yaratıcı: İnovasyon, ustalık, süreç"
          ]
        }
      ],
    },

    // ========================================================================
    // AŞAMA 3: KİM DEĞİLİZ (ANTI-PERSONA)
    // ========================================================================
    {
      intro: {
        script: "Herkes için olan yer, kimse için vazgeçilmez değildir.",
        stageDescription: "Bu aşama, markanız için zararlı olan kitle profillerini belirlemenize yardımcı olur. Herkes için olan yer, kimse için vazgeçilmez değildir.",
      },
      questions: [
        {
          type: 'selection_list',
          script: "Hangi misafir tipi markanıza en çok zarar verir?",
          text: "En Zararlı Kitle",
          options: [
            { id: 'price_focused', title: "Fiyat odaklı", desc: "Sadece indirim, fırsat arayan" },
            { id: 'closed_innovation', title: "Yeniliğe kapalı", desc: "Klasik ister, değişime direnir" },
            { id: 'show_off', title: "Gösterişçi", desc: "Sadece fotoğraf için gelir, deneyim önemsiz" },
            { id: 'operation_disruptor', title: "Operasyon bozucu", desc: "Saatlerce masa tutma, gereksiz talep" },
            { id: 'atmosphere_disruptor', title: "Atmosfer bozucu", desc: "Gürültülü, diğer misafirleri rahatsız eden" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Zararlı kitle tipini tanımlayın"
        },
        {
          type: 'selection_list',
          script: "Bu kitle hangi soruna yol açıyor?",
          text: "Sorun Tipi",
          options: [
            { id: 'profitability', title: "Kârlılık", desc: "Düşük harcama, yüksek talep" },
            { id: 'culture', title: "Kültür", desc: "Marka değerlerine aykırı davranış" },
            { id: 'flow', title: "Akış", desc: "Operasyonel verimlilik düşüyor" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Sorun tipini açıklayın"
        },
        {
          type: 'selection_list',
          script: "Bu duruma nasıl yaklaşırsınız?",
          text: "Tavır",
          options: [
            { id: 'soft', title: "Nazik eleme", desc: "İnce mesajlar, dolaylı yönlendirme" },
            { id: 'barrier', title: "Bariyer", desc: "Fiyat, rezervasyon sistemi, kurallar" },
            { id: 'hard_no', title: "Net red", desc: "Açık kurallar, 'hoş değilsiniz' mesajı" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Tavır yaklaşımınızı açıklayın"
        }
      ],
      educational: {
        script: "Herkes için olan yer, kimse için vazgeçilmez değildir.",
        text: "Filtreleme Stratejisi",
        stats: [
          {
            value: "80%",
            label: "Hedef dışı müşteriler kar marjını düşürür",
            description: "Restoranlarda hedef kitle dışındaki müşteriler, kar marjını ortalama %80 oranında düşürüyor (düşük harcama, yüksek talep).",
            source: "Kaynak: Restaurant Owner Magazine, 2023"
          },
          {
            value: "4x",
            label: "Net filtreleme yapan markaların sadakati",
            description: "Net filtreleme stratejisi uygulayan markalar, herkese hitap edenlere göre 4 kat daha yüksek müşteri sadakatine sahip.",
            source: "Kaynak: Customer Experience Impact Report, 2024"
          },
          {
            value: "56%",
            label: "Değer uyumsuzluğu yaşayan müşteriler",
            description: "Müşterilerin %56'sı marka değerleriyle uyuşmadıkları bir yeri bir daha tercih etmiyor.",
            source: "Kaynak: Brand Values Consumer Survey, 2023"
          },
          {
            value: "92%",
            label: "Filtreleme yapan premium markalar",
            description: "Premium pozisyonlanmış restoranların %92'si aktif olarak istenmeyen müşteri profillerini filtreliyor (fiyat, rezervasyon, kurallar).",
            source: "Kaynak: Fine Dining Positioning Study, 2024"
          }
        ],
        caseStudy: {
          title: "Nobelhart & Schmutzig — Fotoğraf Yasağı",
          summary: "Berlin'de bir fine dining restoranı açıldı. Kural: Fotoğraf yasak. Telefonlar masa başında kapatılıyor. Influencer'lar öfkelendi. 'İçerik üretemiyoruz!' Ama restoran umursamadı. Hedef kitle influencer değildi. Hedef kitle deneyimi yaşamak isteyenlerdi. Fotoğraf yasağı lüks oldu. 'Burada an yaşanır, paylaşılmaz.' Rezervasyon listesi uzadı. Doğru müşteri geldi.",
          outcome: "Sonuç: Net filtreleme, doğru kitleyi çekti. Influencer kaybettiler, sadık misafir kazandılar.",
          type: 'success'
        },
        scenario: "Laptoplu Gezgin: Bir kahve, üç saat masa. Priz, Wi-Fi, sessizlik. Diğer masalar rahatsız. Çözüm: Prizleri kaldırmadınız, stratejik yerlere koydunuz. Masa düzenini değiştirdiniz. Laptop için uygun olmayan sandalyeler seçtiniz. Amaç kovmak değil, doğru davranışı tasarlamak.",
      },
      resultMatrix: [
        {
          minScore: 0,
          maxScore: 999,
          title: "Filtreleme Stratejisi",
          description: "İstemediğiniz kitleyi tanımladınız.",
          recommendations: [
            "Soft Demarketing: İnce mesajlar, tonalite",
            "Bariyerli Sistem: Fiyat, rezervasyon, kurallar",
            "Sert Kural: Açık yasaklar, net sınırlar"
          ]
        }
      ],
    },

    // ========================================================================
    // AŞAMA 4: HEDEF VE BAŞARI
    // ========================================================================
    {
      intro: {
        script: "Ne istiyoruz? Bilinirlik mi, prestij mi, sadakat mi?",
        stageDescription: "Bu aşama, bu projenin birincil hedefini ve başarı metriklerinizi netleştirir. Doluluk mu, prestij mi, sadakat mi? Hedef belirsizse strateji de belirsiz olur.",
      },
      questions: [
        {
          type: 'selection_list',
          script: "Bu projedeki birincil hedefiniz?",
          text: "Birincil Hedef",
          options: [
            { id: 'awareness', title: "Bilinirlik", desc: "Markanın adını duyurmak, çok kişiye ulaşmak" },
            { id: 'prestige', title: "Prestij", desc: "Otorite, seçkinlik algısı oluşturmak" },
            { id: 'authority', title: "Otorite", desc: "Sektörde uzman olarak görülmek" },
            { id: 'reservation', title: "Rezervasyon", desc: "Doğrudan satış, doluluk artışı" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Hedefiniz nedir?"
        },
        {
          type: 'selection_list',
          script: "Büyüme hızı tercihiniz?",
          text: "Büyüme Hızı",
          options: [
            { id: 'fast', title: "Hızlı", desc: "Viral büyüme, kısa sürede maksimum etki" },
            { id: 'balanced', title: "Dengeli", desc: "Sürdürülebilir büyüme, kontrollü genişleme" },
            { id: 'exclusive', title: "Seçkin", desc: "Yavaş ama değerli, lüks konumlandırma" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Büyüme stratejiniz?"
        },
        {
          type: 'selection_list',
          script: "Başarı sizin için ne demek?",
          text: "Başarı İşareti",
          options: [
            { id: 'occupancy', title: "Doluluk", desc: "Rezervasyon doluluğu, kuyruk" },
            { id: 'price_acceptance', title: "Fiyat sorgusu azalması", desc: "Fiyat itirazı olmaması" },
            { id: 'quality_guest', title: "Nitelikli misafir", desc: "Doğru kitle çekmek" },
            { id: 'guide_media', title: "Rehber/Medya", desc: "Michelin, ödüller, basında yer alma" },
            { id: 'loyalty', title: "Sadakat", desc: "Tekrar ziyaret, referans, topluluk" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Başarı tanımınız?"
        }
      ],
      educational: {
        script: "Viral olmak bir hedef değil, stres testidir.",
        text: "Başarı Tanımı",
        stats: [
          {
            value: "78%",
            label: "Net hedefi olmayan işletmeler",
            description: "Restoran sahiplerinin %78'i 'doluluk' ve 'prestij' hedeflerini karıştırıyor. Sonuç: belirsiz strateji, kaynak israfı.",
            source: "Kaynak: Restaurant Leadership Conference, 2023"
          },
          {
            value: "3.2x",
            label: "Net başarı metriği olan markalar",
            description: "Net başarı metriği tanımlayan restoranlar, belirsiz metrikli olanlara göre 3.2 kat daha hızlı büyüyor.",
            source: "Kaynak: MIT Restaurant Growth Study, 2024"
          },
          {
            value: "85%",
            label: "Viral sonrası operasyonel çöküş",
            description: "Viral olan ama operasyonel hazırlığı olmayan restoranların %85'i 6 ay içinde olumsuz yorumlarla karşılaşıyor.",
            source: "Kaynak: Social Media Impact Report, 2024"
          },
          {
            value: "71%",
            label: "Michelin'in prestij etkisi",
            description: "Michelin yıldızı alan restoranların %71'i rezervasyon taleplerinde %300+ artış görüyor. Hazır olmayanlar çöküyor.",
            source: "Kaynak: Michelin Guide Impact Study, 2023"
          }
        ],
        caseStudy: {
          title: "Noma — Yeniden İcat",
          summary: "Noma 5 kez 'Dünyanın En İyi Restoranı' seçildi. Zirvedeyken bir karar aldı: Kapanacak. Restoran servisi bitecek, fermentasyon lab'ına dönüşecek. Herkes şok oldu. 'Neden?' Çünkü başarı tanımları değişmişti. Artık doluluk değil, etki istiyorlardı. Michelin yıldızı değil, yeni bir dil yaratmak. Kapandılar, dönüştüler, evrimleştiler. Hala konuşuluyor.",
          outcome: "Sonuç: Başarı tanımınız net olunca, cesur kararlar alabilirsiniz. Doluluk mu, prestij mi, etki mi?",
          type: 'success'
        },
        scenario: "Karşıt Örnek — Instagram Tuzağı: Viral bir içerik yayınladınız. Beğeni patladı, rezervasyon arttı. Ama operasyon hazır değil. Kalite düştü, şikayetler arttı. Viral etki büyüttüğü şey sorundu. SOP yoksa, viral olmak felaket getirir.",
      },
      resultMatrix: [
        {
          minScore: 0,
          maxScore: 999,
          title: "Strateji Modeli",
          description: "Hedef ve başarı tanımınız netleşti.",
          recommendations: [
            "Rezervasyon Motoru: Doluluk, dönüşüm, satış",
            "Prestij İnşası: Otorite, medya, ödüller",
            "Sadakat Makinesi: Topluluk, tekrar ziyaret, referans"
          ]
        }
      ],
    },
  ],
};
