import { SectorQuestionConfig } from '../../types';

export const retailConfig: SectorQuestionConfig = {
  sectorId: 'retail',

  intro: {
    script: "Mağazanız bir ürün satış noktası mı, yoksa bir marka deneyimi mi? Bu fark, hayatta kalmakla büyümek arasındaki çizgidir.",
    text: "Bu interaktif deneyim, perakende markanız için üretilecek görsel ve anlatısal dünyanın tutarlı, güçlü ve müşterinizin zihninde kalıcı olmasını sağlamak için tasarlandı.",
  },

  stages: [
    // ========================================================================
    // ASAMA 0: OPERASYONEL GERCEKLIK
    // ========================================================================
    {
      intro: {
        script: "Vitrin ne kadar çekici olursa olsun, kasada yaşanan kaos her şeyi siler.",
        stageDescription: "Bu aşama, markanızın vaatlerini operasyonel olarak taşıyıp taşıyamayacağınızı belirler. Kampanya talebi artırır, ancak hazırlıksız bir operasyon bu talebi müşteri kaybına dönüştürür.",
      },
      questions: [
        {
          type: 'selection_scored',
          script: "Müşteri deneyiminiz mağaza ve online arasında ne kadar tutarlı?",
          text: "Kanal Tutarlılığı",
          options: [
            { id: 'inconsistent', title: "Tamamen farklı", desc: "Online ve mağaza ayrı dünyalar gibi çalışıyor", score: 0 },
            { id: 'somewhat', title: "Kısmen benzer", desc: "Fiyatlar aynı ama deneyim farklı", score: 1 },
            { id: 'mostly', title: "Büyük ölçüde tutarlı", desc: "Aynı marka hissi var, küçük sapmalar oluyor", score: 2 },
            { id: 'unified', title: "Tam entegre (omnichannel)", desc: "Online sipariş mağazadan teslim, iade her kanaldan, tek müşteri profili", score: 3 },
            { id: 'other', title: "Diğer (Belirtin)", score: 0 }
          ],
          placeholder: "Durumunuzu açıklayın"
        },
        {
          type: 'selection_scored',
          script: "Kampanya dönemlerinde — Black Friday, sezon indirimi, lansman — operasyonunuz ne durumda?",
          text: "Yoğun Dönem Dayanıklılığı",
          options: [
            { id: 'collapses', title: "Çöküyor", desc: "Stok tükeniyor, kargo gecikiyor, müşteri şikayet patlaması yaşanıyor", score: 0 },
            { id: 'struggling', title: "Zorlanıyor", desc: "Gecikmeler ve hatalar oluyor ama idare ediliyor", score: 1 },
            { id: 'mostly_holds', title: "Çoğunlukla dayanıyor", desc: "Küçük aksamalar olsa da genel kalite korunuyor", score: 2 },
            { id: 'thrives', title: "Güçlenerek çıkıyor", desc: "Yoğun dönemlere özel plan var, ekstra ekip ve stok hazır", score: 3 },
            { id: 'other', title: "Diğer (Belirtin)", score: 0 }
          ],
          placeholder: "Durumunuzu açıklayın"
        },
        {
          type: 'selection_scored',
          script: "Bu çalışma sonrası %30 talep artışı olursa ne olur?",
          text: "Talep Artışı Kapasitesi",
          options: [
            { id: 'cannot', title: "Karşılayamayız", desc: "Stok, personel ve lojistik yetersiz", score: 0 },
            { id: 'partially', title: "Kısmen karşılarız", desc: "Bazı kategorilerde idare ederiz ama darboğazlar olur", score: 1 },
            { id: 'yes', title: "Evet, karşılarız", desc: "Tedarik zinciri ve ekip ölçeklenebilir durumda", score: 2 },
            { id: 'other', title: "Diğer (Belirtin)", score: 0 }
          ],
          placeholder: "Durumunuzu açıklayın"
        }
      ],
      educational: {
        script: "İki mağaza hikayesi: Biri büyük açılış yaptı, diğeri sessizce altyapısını kurdu. Sadece biri büyüyebildi.",
        text: "Operasyonel Tutarlılık",
        stats: [
          {
            value: "73%",
            label: "Omnichannel tutarlılık bekleyen müşteriler",
            description: "Müşterilerin %73'ü online ve mağaza arasında kesintisiz, tutarlı bir deneyim bekliyor. Kanal uyumsuzluğu = güven kaybı.",
            source: "Kaynak: Harvard Business Review Retail Study, 2023"
          },
          {
            value: "30%",
            label: "Black Friday iade oranı",
            description: "Kampanya dönemlerinde aceleci satışlar nedeniyle iade oranları %30'a kadar çıkıyor. Hazırlıksız operasyon, kazancı zarara çevirir.",
            source: "Kaynak: National Retail Federation, 2024"
          },
          {
            value: "4.6x",
            label: "Omnichannel müşteri harcaması",
            description: "Omnichannel deneyim sunan markaların müşterileri, tek kanallı markalara göre 4.6 kat daha fazla harcıyor.",
            source: "Kaynak: McKinsey Retail Report, 2024"
          },
          {
            value: "%40",
            label: "Stok sorunu yaşayan e-ticaret",
            description: "E-ticaret sitelerinin %40'ı yoğun dönemlerde stok senkronizasyon hatası yaşıyor. Müşteri sipariş veriyor, ürün yok.",
            source: "Kaynak: Shopify Commerce Trends, 2024"
          }
        ],
        caseStudy: {
          title: "Forever 21'in Çöküşü",
          summary: "Forever 21, hızlı modanın yıldızıydı. Agresif genişleme: yüzlerce mağaza, düşük fiyat, trend ürünler. Ama arka planda kaos vardı. Stok yönetimi felaket, online deneyim mağazayla uyumsuz. Bir mağazada bulamadığınız ürün online'da da yoktu. Kampanya dönemlerinde kargo haftalar alıyordu. Müşteriler geldi, hayal kırıklığıyla gitti. 2019'da iflas başvurusu yaptılar.",
          outcome: "Sonuç: Hızlı büyüme, operasyonel altyapısız sürdürülemez. Vitrin parladı, arka plan çöktü.",
          type: 'failure'
        },
        scenario: "Karşıt Örnek — Zara: Reklam bütçesi neredeyse sıfır. Ama tedarik zinciri bir saat gibi işliyor. Tasarımdan rafa 2 hafta. Her mağazada aynı deneyim. Stok verileri gerçek zamanlı. Operasyonel mükemmellik, pazarlamanın yerini aldı. 30 yılda dünyanın en büyük moda perakendecisi oldu.",
      },
      resultMatrix: [
        {
          minScore: 0,
          maxScore: 2,
          title: "Önce Operasyon",
          description: "Kampanya talebi artırır ama aynı hızla problemi de büyütür.",
          recommendations: [
            "Stok yönetim sistemi kurun veya güncelleyin",
            "Online ve mağaza deneyimini senkronize edin",
            "Kampanya dönemleri için kapasite planı oluşturun",
            "Müşteri hizmetleri süreçlerini standartlaştırın"
          ],
          caseStudy: {
            title: "Zara",
            summary: "Reklamdan çok tedarik zincirine yatırım yaptı. Operasyonel mükemmellik = marka oldu.",
            outcome: "Müşteri 'sürpriz' değil güvenilir yenilik satın aldı.",
            type: 'success'
          }
        },
        {
          minScore: 3,
          maxScore: 6,
          title: "Kontrollü Büyüme",
          description: "Sınırlı kampanya, net stok planı, kanal tutarlılığı gerekir.",
          recommendations: [
            "Omnichannel entegrasyonu tamamlayın",
            "Kampanya dönemlerinde ekstra kaynak planı yapın",
            "Kademeli büyüme stratejisi uygulayın",
            "Müşteri deneyim haritası çıkarın"
          ]
        },
        {
          minScore: 7,
          maxScore: 8,
          title: "Hazır",
          description: "Marka anlatısı ve kampanya stratejisi agresif biçimde büyütülebilir.",
          recommendations: [
            "Tam kapasiteli pazarlama kampanyası başlatın",
            "Yeni kanal ve pazar genişlemesi planlayın",
            "Sadakat programı ile müşteri bağlılığı artırın",
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
        script: "İnsanlar ürünü unutur. Ama mağazada nasıl hissettiklerini hatırlar.",
        stageDescription: "Bu aşama, markanızın duygusal kimliğini ve müşterilerinizde yaratmak istediğiniz hissi tanımlar. İnsanlar ürünü unutur, ama mağazanızda nasıl hissettiklerini hatırlar.",
      },
      questions: [
        {
          type: 'selection_list',
          script: "Markanız yarın kaybolsa, müşteri neyi kaybetmiş hisseder?",
          text: "Kayıp Duygusu",
          options: [
            { id: 'discovery', title: "Keşif", desc: "Her ziyarette yeni bir şey bulmanın heyecanı" },
            { id: 'quality', title: "Kalite güvencesi", desc: "Her zaman güvenebileceği, kalitesinden emin olduğu bir yer" },
            { id: 'status', title: "Statü", desc: "Orada alışveriş yapmanın verdiği prestij ve ayrıcalık" },
            { id: 'trust', title: "Güven", desc: "Aldatılmayacağını bildiği, dürüst bir ilişki" },
            { id: 'convenience', title: "Kolaylık", desc: "Hayatı kolaylaştıran, zahmetsiz alışveriş deneyimi" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Hangi duyguyu yaratıyorsunuz?"
        },
        {
          type: 'selection_list',
          script: "Müşterinize ne sunuyorsunuz?",
          text: "Deneyim Seviyesi",
          options: [
            { id: 'product_only', title: "Ürün", desc: "Kaliteli ürün, uygun fiyat, ihtiyacı karşılama" },
            { id: 'product_experience', title: "Ürün + Deneyim", desc: "Mağaza tasarımı, sunum, personel yaklaşımı" },
            { id: 'full_journey', title: "Baştan sona sahnelenmiş yolculuk", desc: "Kapıdan girişten çıkışa kadar tasarlanmış bir deneyim hikayesi" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Deneyim seviyenizi tanımlayın"
        },
        {
          type: 'selection_list',
          script: "Ürün yaklaşımınız nedir?",
          text: "Fiyat-Değer Konumlandırması",
          options: [
            { id: 'affordable', title: "Uygun fiyat", desc: "En iyi fiyatla erişilebilir ürünler" },
            { id: 'value', title: "Kalite-fiyat dengesi", desc: "Ödediğinden fazlasını alan müşteri" },
            { id: 'premium', title: "Premium", desc: "Yüksek kalite, seçkin ürünler, bilinçli fiyatlandırma" },
            { id: 'luxury', title: "Lüks", desc: "Ayrıcalık, nadirlik, erişilemezlik hissi" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Ürün yaklaşımınızı tanımlayın"
        }
      ],
      educational: {
        script: "Müşteri ürünü değil, o ürünü alırken hissettiği duyguyu satın alır.",
        text: "Marka Ruhu",
        stats: [
          {
            value: "86%",
            label: "Duygusal bağ kuran müşteriler",
            description: "Müşterilerin %86'sı duygusal bağ kurdukları markalara daha fazla ödemeye razı ve rakibe geçme olasılıkları çok düşük.",
            source: "Kaynak: Motista Brand Intimacy Report, 2024"
          },
          {
            value: "5.7x",
            label: "Deneyim odaklı mağazaların satışı",
            description: "Ürün satışının ötesine geçip deneyim sunan mağazalar, sadece ürün satanlara göre 5.7 kat daha yüksek müşteri başına gelir elde ediyor.",
            source: "Kaynak: Forrester Retail Experience Index, 2023"
          },
          {
            value: "70%",
            label: "Marka hikayesi isteyen tüketiciler",
            description: "Tüketicilerin %70'i bir markanın neyi temsil ettiğini, nereden geldiğini ve nereye gittiğini bilmek istiyor.",
            source: "Kaynak: Edelman Brand Trust Survey, 2024"
          },
          {
            value: "3.1x",
            label: "Net kimliğe sahip markaların sadakati",
            description: "Net marka kimliğine sahip perakende markaları, belirsiz kimliğe sahip olanlara göre 3.1 kat daha yüksek müşteri sadakatine sahip.",
            source: "Kaynak: Bain & Company Retail Loyalty Study, 2023"
          }
        ],
        caseStudy: {
          title: "Apple Store Deneyimi",
          summary: "Apple mağazaları açıldığında herkes 'elektronik mağazası' bekliyordu. Steve Jobs farklı düşündü. Genius Bar'ı koydu — satış elemanı değil, danışman. Ürünlere dokunabiliyordunuz. Mağaza bir showroom değil, bir keşif alanıydı. Satış baskısı yoktu. Müşteri istediği kadar kalabilir, deneyebilir, soru sorabilirdi. Satış elemanları komisyon almıyordu. Amaç satmak değil, ilişki kurmaktı. Sonuç: Metrekare başına dünyanın en çok gelir getiren mağazası oldu.",
          outcome: "Sonuç: Ürün satmak yerine deneyim satınca, müşteri hem ürünü hem markayı satın alır.",
          type: 'success'
        },
        scenario: "Ruh Çatışması: Bir mağaza görsellerde lüks, fiyatlarda uygun, serviște ilgisiz. Müşteri ne beklediğini bilemez. Kafası karışır. Rakibi seçer.",
      },
      resultMatrix: [
        {
          minScore: 0,
          maxScore: 999,
          title: "Marka Ruhu Profili",
          description: "Seçimlerinize göre marka ruhunuz şekillendi.",
          recommendations: [
            "Keşif Alanı: Sürekli yenilik, sürpriz koleksiyonlar, teaser kampanyalar",
            "Kalite Güvencesi: Tutarlılık, garanti, uzun ömür vurgusu",
            "Statü Sahnesi: Ayrıcalık, limitli üretim, seçkinlik",
            "Güven Limanı: Şeffaflık, dürüst fiyat, müşteri ilişkisi",
            "Kolaylık Merkezi: Hız, erişim, zahmetsiz deneyim"
          ]
        }
      ],
    },

    // ========================================================================
    // ASAMA 2: MARKA KARAKTERI (ARKETIP)
    // ========================================================================
    {
      intro: {
        script: "Arketip, markanızın vitrinde değil, iade masasında kim olduğunu belirler.",
        stageDescription: "Bu aşama, markanızın davranış tarzını ve kriz anlarındaki tepkilerini tanımlar. Arketip, markanızın güzel göründüğünde değil, zorlandığında kim olduğunu belirler.",
      },
      questions: [
        {
          type: 'selection_list',
          script: "Müşteri hatalı ürün iadesiyle geldi ve agresif. İlk tepkiniz ne olur?",
          text: "Kriz Tepkisi",
          options: [
            { id: 'compensate', title: "Hemen telafi eder", desc: "Özür diler, değiştirir, ekstra jest yapar (Bakıcı)" },
            { id: 'defend', title: "Politikayı uygular", desc: "Kurallarımız net, bu şartlarda iade yapılır (Hükümdar)" },
            { id: 'explain', title: "Durumu açıklar", desc: "Ürünün neden böyle olduğunu, süreçleri anlatır (Bilge)" },
            { id: 'challenge', title: "Meydan okur", desc: "Gerçekten hatalı mı kontrol edelim, kanıtlayın (Asi)" },
            { id: 'redesign', title: "Çözüm üretir", desc: "Bu ürün yerine size şunu önereyim, birlikte bakalım (Yaratıcı)" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Kriz tepkinizi açıklayın"
        },
        {
          type: 'selection_list',
          script: "Müşterinizi nasıl ikna edersiniz?",
          text: "İkna Yöntemi",
          options: [
            { id: 'consistency', title: "Tutarlılık", desc: "Her seferinde aynı kalite, aynı standart" },
            { id: 'social_proof', title: "Sosyal kanıt", desc: "Yorumlar, influencer onayı, satış rakamları" },
            { id: 'expertise', title: "Uzmanlık", desc: "Ürün bilgisi, malzeme hikayesi, üretim süreci" },
            { id: 'emotion', title: "Duygusal bağ", desc: "Kişisel ilgi, hatırlama, özel hissettirme" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "İkna yönteminizi açıklayın"
        },
        {
          type: 'selection_list',
          script: "İletişim tonunuz nasıl?",
          text: "Ton",
          options: [
            { id: 'minimal', title: "Minimal", desc: "Az söyle, çok göster. Ürün konuşsun" },
            { id: 'prestigious', title: "Prestijli", desc: "Seçkinlik, ayrıcalık, nadirlik vurgusu" },
            { id: 'warm', title: "Samimi", desc: "Yakın, arkadaşça, 'hoş geldin' hissi" },
            { id: 'provocative', title: "Provokatif", desc: "Soru sordurtan, kalıpları kıran, cesur" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "İletişim tonunuzu tanımlayın"
        }
      ],
      educational: {
        script: "Arketip, markanızın vitrinde değil, iade masasında kim olduğunu belirler.",
        text: "Karakter Tutarlılığı",
        stats: [
          {
            value: "78%",
            label: "Tutarlı marka karakteri bekleyen müşteriler",
            description: "Tüketicilerin %78'i bir perakende markasının mağazada, online'da ve sosyal medyada aynı kişiliği sergilemesini bekliyor.",
            source: "Kaynak: Lucidpress Brand Consistency Report, 2023"
          },
          {
            value: "6x",
            label: "Kriz anında güvenilir markalar",
            description: "Net arketipe sahip perakende markaları, kriz anlarında (iade, şikayet, stok sorunu) belirsiz karakterli markalara göre 6 kat daha güvenilir bulunuyor.",
            source: "Kaynak: Edelman Trust Barometer, 2024"
          },
          {
            value: "89%",
            label: "Karakter tutarlılığının satışa etkisi",
            description: "Perakende markalarının %89'u karakter tutarlılığının doğrudan satış artışına yol açtığını raporluyor.",
            source: "Kaynak: Deloitte Retail Brand Study, 2023"
          },
          {
            value: "62%",
            label: "Arketip çakışması yaşayan markalar",
            description: "Müşterilerin %62'si bir mağazada ton çakışması (örn. lüks vitrin + indirim çığırtkanlığı) hissettiklerinde markayı terk ediyor.",
            source: "Kaynak: Retail Dive Consumer Survey, 2024"
          }
        ],
        caseStudy: {
          title: "IKEA — Demokratik Tasarım Arketipi",
          summary: "IKEA her şeyde 'Sıradan İnsan' arketipini yaşatır. Mağazalar self-servis, fiyatlar şeffaf, ürün isimleri İsveççe ama samimi. Bir IKEA mağazasında sizi karşılayan satış elemanı yoktur — keşfetmeniz beklenir. Ama kaybolursanız, her köşede yardım vardır. İade politikası cömerttir. Restoranda köfte 25 TL'dir. Tutarlılık: mağazada, katalogda, online'da, reklamlarda hep aynı ses. 'Herkes için iyi tasarım' vaadi her temas noktasında hissedilir.",
          outcome: "Sonuç: Arketip tutarlıysa müşteri ne beklediğini bilir. IKEA'ya giden 'sürpriz' değil, 'güven' satın alır.",
          type: 'success'
        },
        scenario: "Arketip Çakışması: Premium vitrin tasarımı + 'HER ŞEY %70 İNDİRİMLİ' afişleri. Müşteri zihninde bilişsel uyumsuzluk: Bu mağaza lüks mü, ucuz mu? Nereye geldi?",
      },
      resultMatrix: [
        {
          minScore: 0,
          maxScore: 999,
          title: "Marka Arketipi",
          description: "Kriz anında davranış şekliniz karakterinizi ortaya koydu.",
          recommendations: [
            "Bakıcı: Sıcaklık, koruma, koşulsuz müşteri memnuniyeti",
            "Hükümdar: Standart, otorite, politika tutarlılığı",
            "Bilge: Bilgi, uzmanlık, eğitici içerik",
            "Asi: Provokasyon, kalıp kırma, cesur kampanyalar",
            "Yaratıcı: İnovasyon, çözüm odaklılık, kişiselleştirme"
          ]
        }
      ],
    },

    // ========================================================================
    // ASAMA 3: KIM DEGILIZ (ANTI-PERSONA)
    // ========================================================================
    {
      intro: {
        script: "Herkese satmaya çalışan mağaza, kimseye satamaz.",
        stageDescription: "Bu aşama, markanız için zararlı olan müşteri profillerini belirlemenize yardımcı olur. Herkese hitap etmeye çalışmak, hiç kimse için vazgeçilmez olmamak demektir.",
      },
      questions: [
        {
          type: 'selection_list',
          script: "Hangi müşteri tipi markanıza en çok zarar verir?",
          text: "En Zararlı Müşteri Tipi",
          options: [
            { id: 'serial_returner', title: "Seri iade yapan", desc: "Sürekli alıp iade eden, giyip geri getiren" },
            { id: 'discount_only', title: "Sadece indirim avcısı", desc: "İndirim olmadan asla alışveriş yapmayan, tam fiyatı reddetme" },
            { id: 'theft_risk', title: "Hırsızlık/dolandırıcılık riski", desc: "Ürün kaybı, sahte iade, etiket değiştirme" },
            { id: 'time_waster', title: "Zaman harcayan", desc: "Saatlerce gezer, hiçbir zaman satın almaz, personeli meşgul eder" },
            { id: 'brand_damager', title: "Marka imajını bozan", desc: "Sosyal medyada abartılı şikayetler, manipülatif yorumlar" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Zararlı müşteri tipini tanımlayın"
        },
        {
          type: 'selection_list',
          script: "Bu müşteri tipi hangi soruna yol açıyor?",
          text: "Sorun Tipi",
          options: [
            { id: 'profitability', title: "Kârlılık", desc: "İade maliyeti, indirim baskısı, düşük sepet ortalaması" },
            { id: 'culture', title: "Marka kültürü", desc: "Mağaza atmosferini bozuyor, diğer müşterileri uzaklaştırıyor" },
            { id: 'operations', title: "Operasyon", desc: "Personel verimliliği düşüyor, süreçler aksıyor" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Sorun tipini açıklayın"
        },
        {
          type: 'selection_list',
          script: "Bu duruma nasıl yaklaşırsınız?",
          text: "Yaklaşım Tavırı",
          options: [
            { id: 'soft', title: "Nazik yönlendirme", desc: "İnce mesajlar, mağaza deneyimiyle dolaylı filtreleme" },
            { id: 'barrier', title: "Sistem bariyeri", desc: "Üyelik sistemi, minimum alışveriş tutarı, iade politikası" },
            { id: 'hard_no', title: "Net sınır", desc: "Açık kurallar, kara liste, 'bu mağaza size göre değil' mesajı" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Yaklaşım tavırınızı açıklayın"
        }
      ],
      educational: {
        script: "Herkese satmaya çalışan mağaza, kimseye satamaz.",
        text: "Filtreleme Stratejisi",
        stats: [
          {
            value: "67%",
            label: "Seri iade müşterilerinin maliyeti",
            description: "Perakende sektöründe müşterilerin %67'sinin iade davranışı, bu müşterilerden elde edilen kârı tamamen sıfırlıyor.",
            source: "Kaynak: Appriss Retail Consumer Returns Report, 2024"
          },
          {
            value: "5x",
            label: "Net filtreleme yapan markaların sadakati",
            description: "Net müşteri filtreleme stratejisi olan perakende markaları, herkese satmaya çalışanlara göre 5 kat daha yüksek müşteri ömür boyu değerine sahip.",
            source: "Kaynak: Bain & Company Loyalty Economics, 2023"
          },
          {
            value: "48%",
            label: "İndirim bağımlısı müşterilerin etkisi",
            description: "Sadece indirimle alışveriş yapan müşteriler, mağaza cirosunun %48'ini oluştursa da kâr marjının sadece %8'ine katkı sağlıyor.",
            source: "Kaynak: McKinsey Pricing & Promotions Study, 2024"
          },
          {
            value: "91%",
            label: "Premium markaların filtreleme oranı",
            description: "Başarılı premium perakende markalarının %91'i aktif olarak müşteri filtreleme stratejisi uyguluyor.",
            source: "Kaynak: Luxury Institute Brand Positioning Report, 2023"
          }
        ],
        caseStudy: {
          title: "Boyner — Üyelik Sistemiyle Filtreleme",
          summary: "Boyner, herkese indirim vermek yerine Boyner Club üyelik sistemini kurdu. Üyelere özel fiyatlar, erken erişim, kişisel kampanyalar. İndirim avcıları için cazip değil — çünkü sadakat gerekiyor. Seri iade yapanlar sistem tarafından tespit ediliyor, ayrı bir süreçten geçiyor. Sonuç: Sadık müşteri oranı arttı, sepet ortalaması yükseldi. İndirim bağımlıları kendiliğinden filtrelendi. Boyner kaybettiği müşteri sayısından çok, kazandığı müşteri değerini artırdı.",
          outcome: "Sonuç: Üyelik sistemi hem filtreleme hem sadakat aracı oldu. Doğru müşteri = daha yüksek kâr.",
          type: 'success'
        },
        scenario: "Karşıt Örnek — Seri İade Tuzağı: Online mağazanızda iade oranı %40. Müşteri üç beden alıyor, ikisini iade ediyor. Kargo maliyeti, yeniden paketleme, stok karışıklığı. Çözüm: Sanal deneme kabini teknolojisi, beden rehberi, ilk alışverişte kişisel danışmanlık. Amaç engel koymak değil, doğru alışverişi tasarlamak.",
      },
      resultMatrix: [
        {
          minScore: 0,
          maxScore: 999,
          title: "Filtreleme Stratejisi",
          description: "İstemediğiniz müşteri tipini tanımladınız.",
          recommendations: [
            "Soft Filtreleme: Mağaza deneyimi tasarımı, dolaylı mesajlar, ton",
            "Sistem Bariyeri: Üyelik, minimum tutar, iade politikası, kurallar",
            "Sert Sınır: Kara liste, açık reddetme, net iletişim"
          ]
        }
      ],
    },

    // ========================================================================
    // ASAMA 4: HEDEF VE BASARI
    // ========================================================================
    {
      intro: {
        script: "Satış mı istiyoruz, bilinirlik mi, sadakat mi? Hedef belirsizse strateji de belirsizdir.",
        stageDescription: "Bu aşama, bu projenin birincil hedefini ve başarı metriklerinizi netleştirir. Ciro mu, bilinirlik mi, pazar payı mı? Hedef belirsizse her yatırım israftır.",
      },
      questions: [
        {
          type: 'selection_list',
          script: "Bu projedeki birincil hedefiniz?",
          text: "Birincil Hedef",
          options: [
            { id: 'awareness', title: "Bilinirlik", desc: "Markanın adını duyurmak, geniş kitlelere ulaşmak" },
            { id: 'revenue', title: "Ciro artışı", desc: "Doğrudan satış, sepet ortalaması, dönüşüm oranı" },
            { id: 'market_share', title: "Pazar payı", desc: "Rakiplerden pay almak, kategori liderliği" },
            { id: 'loyalty', title: "Müşteri sadakati", desc: "Tekrar alışveriş, ömür boyu müşteri değeri" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Hedefiniz nedir?"
        },
        {
          type: 'selection_list',
          script: "Büyüme hızı tercihiniz?",
          text: "Büyüme Hızı",
          options: [
            { id: 'fast', title: "Hızlı", desc: "Agresif kampanyalar, kısa sürede maksimum büyüme" },
            { id: 'balanced', title: "Dengeli", desc: "Sürdürülebilir büyüme, kontrollü genişleme" },
            { id: 'slow_premium', title: "Yavaş ama değerli", desc: "Organik büyüme, premium konumlandırma, beklenti yaratma" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Büyüme stratejiniz?"
        },
        {
          type: 'selection_list',
          script: "Başarı sizin için ne demek?",
          text: "Başarı İşareti",
          options: [
            { id: 'revenue_growth', title: "Ciro artışı", desc: "Toplam satış hacminde ölçülebilir büyüme" },
            { id: 'basket_average', title: "Sepet ortalaması yükselişi", desc: "Müşteri başına harcama artışı" },
            { id: 'repeat_visit', title: "Tekrar ziyaret", desc: "Müşterilerin düzenli olarak geri gelmesi" },
            { id: 'brand_recognition', title: "Marka bilinirliği", desc: "Hedef kitlenin markayı tanıması ve hatırlaması" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Başarı tanımınız?"
        }
      ],
      educational: {
        script: "Viral olmak bir hedef değil, sonuçtur. Hedef net olmazsa, viral bile olsanız kaybolursunuz.",
        text: "Başarı Tanımı",
        stats: [
          {
            value: "74%",
            label: "Net hedefi olmayan perakende markaları",
            description: "Perakende yöneticilerinin %74'ü 'satış artışı' ve 'marka bilinirliği' hedeflerini karıştırıyor. Sonuç: her kampanya farklı bir yöne çekiyor.",
            source: "Kaynak: Deloitte Global Retail Outlook, 2024"
          },
          {
            value: "3.8x",
            label: "Net KPI'lı markaların büyümesi",
            description: "Net başarı metrikleri tanımlayan perakende markaları, belirsiz hedefli olanlara göre 3.8 kat daha hızlı büyüyor.",
            source: "Kaynak: BCG Retail Growth Index, 2023"
          },
          {
            value: "82%",
            label: "Sadakat programı ile tekrar alışveriş",
            description: "Etkili sadakat programlarına sahip perakende markalarında müşterilerin %82'si tekrar alışveriş yapıyor.",
            source: "Kaynak: Bond Brand Loyalty Report, 2024"
          },
          {
            value: "58%",
            label: "Sepet ortalamasını artıran deneyim",
            description: "Mağaza deneyimini iyileştiren markalarda sepet ortalaması %58 oranında artıyor.",
            source: "Kaynak: Salesforce Connected Shopper Report, 2024"
          }
        ],
        caseStudy: {
          title: "LC Waikiki — Erişilebilir Moda Stratejisi",
          summary: "LC Waikiki 'herkesin güzel giyinme hakkı var' dedi ve bu cümle her kararın filtresi oldu. Hedef netti: pazar payı ve erişilebilirlik. Premium olmaya çalışmadı. Lüks konumlandırma peşinde koşmadı. Bunun yerine geniş kitlelere uygun fiyatla kaliteli ürün sunmaya odaklandı. Mağaza sayısını hızla artırdı ama her mağazada aynı deneyimi korudu. Sonuç: Türkiye'nin en büyük moda perakendecisi oldu ve 50'den fazla ülkeye açıldı.",
          outcome: "Sonuç: Hedef netti, strateji tutarlıydı. 'Herkes için moda' vaadini her noktada yaşattı.",
          type: 'success'
        },
        scenario: "Karşıt Örnek — Hedef Karmaşası: Bir mağaza hem 'lüks marka' hem 'en uygun fiyat' hem de 'en geniş ürün yelpazesi' olmak istiyor. Kampanyalar çelişiyor: Pazartesi premium reklam, Cuma '%80 indirim' afişi. Müşteri kafası karışıyor. Rakip seçiyor.",
      },
      resultMatrix: [
        {
          minScore: 0,
          maxScore: 999,
          title: "Strateji Modeli",
          description: "Hedef ve başarı tanımınız netleşti.",
          recommendations: [
            "Ciro Motoru: Satış odaklı kampanyalar, dönüşüm optimizasyonu, sepet artırma",
            "Pazar Payı İnşası: Rakip analizi, fiyat stratejisi, lokasyon genişleme",
            "Sadakat Makinesi: Üyelik programı, tekrar alışveriş teşviki, topluluk oluşturma"
          ]
        }
      ],
    },
  ],
};
