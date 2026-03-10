import { SectorQuestionConfig } from '../../types';

export const showroomConfig: SectorQuestionConfig = {
  sectorId: 'showroom',

  intro: {
    script: "Showroom'unuz bir satış noktası mı, yoksa bir karar değiştirme deneyimi mi? Bu fark, fiyat savaşıyla marka olmak arasındaki çizgidir.",
    text: "Bu interaktif deneyim; yapı malzemeleri, mobilya, dekorasyon ve aydınlatma gibi showroom odaklı markalar için tasarlandı. Uzun karar süreçleri, çoklu paydaşlar ve fiziksel deneyim gerektiren sektörlerde marka stratejinizi netleştirir.",
  },

  stages: [
    // ========================================================================
    // ASAMA 0: OPERASYONEL GERCEKLIK
    // ========================================================================
    {
      intro: {
        script: "Showroom'unuz ne kadar etkileyici olursa olsun, teslimatta yaşanan kaos her şeyi siler.",
        stageDescription: "Bu aşama, markanızın vaatlerini operasyonel olarak taşıyıp taşıyamayacağınızı belirler. Dijital pazarlama talebi artırır, ancak hazırlıksız bir teslimat zinciri bu talebi müşteri kaybına dönüştürür.",
      },
      questions: [
        {
          type: 'selection_scored',
          script: "Showroom deneyiminiz ile sahada yaşanan gerçeklik ne kadar tutarlı?",
          text: "Showroom-Saha Tutarlılığı",
          options: [
            { id: 'inconsistent', title: "Farklı dünyalar", desc: "Showroom'da gösterilen ile sahada teslim edilen arasında ciddi farklar var", score: 0 },
            { id: 'somewhat', title: "Kısmen tutarlı", desc: "Ürün aynı ama montaj kalitesi, teslimat süresi değişken", score: 1 },
            { id: 'mostly', title: "Büyük ölçüde tutarlı", desc: "Standartlar var, nadiren sapma oluyor", score: 2 },
            { id: 'fully_controlled', title: "Uçtan uca kontrol", desc: "Showroom'dan montaja kadar her adım standardize ve takip ediliyor", score: 3 },
            { id: 'other', title: "Diger (Belirtin)", score: 0 }
          ],
          placeholder: "Durumunuzu aciklayın"
        },
        {
          type: 'selection_scored',
          script: "Yoğun sezon veya toplu proje dönemlerinde teslimat kaliteniz ne durumda?",
          text: "Yogun Donem Dayanıklılıgı",
          options: [
            { id: 'collapses', title: "Cokuyor", desc: "Teslimat gecikiyor, montaj hataları artıyor, musteri sikayet patlaması", score: 0 },
            { id: 'struggling', title: "Zorlanıyor", desc: "Gecikmeler oluyor ama idare ediliyor", score: 1 },
            { id: 'mostly_holds', title: "Cogunlukla dayanıyor", desc: "Kucuk aksamalar olsa da genel kalite korunuyor", score: 2 },
            { id: 'thrives', title: "Guclenip cıkıyor", desc: "Yogun donemlere ozel ekip ve stok planı var, kalite hic dusmuyor", score: 3 },
            { id: 'other', title: "Diger (Belirtin)", score: 0 }
          ],
          placeholder: "Durumunuzu aciklayın"
        },
        {
          type: 'selection_scored',
          script: "Bu calısma sonrası %30 talep artısı olursa tedarik ve teslimat zinciriniz ne olur?",
          text: "Talep Artısı Kapasitesi",
          options: [
            { id: 'cannot', title: "Karsılayamayız", desc: "Stok, lojistik ve montaj ekibi yetersiz", score: 0 },
            { id: 'partially', title: "Kısmen karsılarız", desc: "Bazı urun gruplarında idare ederiz ama darbogazlar olur", score: 1 },
            { id: 'yes', title: "Evet, karsılarız", desc: "Tedarik zinciri ve ekip olceklenebilir durumda", score: 2 },
            { id: 'other', title: "Diger (Belirtin)", score: 0 }
          ],
          placeholder: "Durumunuzu aciklayın"
        }
      ],
      educational: {
        script: "Iki showroom hikayesi: Biri goruntuye yatırım yaptı, digeri tedarik zincirine. Sadece biri buyuyebildi.",
        text: "Operasyonel Tutarlılık",
        stats: [
          {
            value: "68%",
            label: "Montaj sorunu yasayan musteriler",
            description: "Yapı malzemeleri sektorunde musterilerin %68'i urun kalitesinden degil, montaj ve teslimat surecinden sikayetci. Showroom vaadi sahada parcalanıyor.",
            source: "Kaynak: J.D. Power Home Improvement Satisfaction Study, 2024"
          },
          {
            value: "4.2x",
            label: "Uctan uca kontrol eden markaların buyumesi",
            description: "Showroom'dan montaja kadar tum sureci kontrol eden markalar, sadece urun satan markalara gore 4.2 kat daha hızlı buyuyor.",
            source: "Kaynak: McKinsey Building Materials Report, 2023"
          },
          {
            value: "82%",
            label: "Referansla gelen musteriler",
            description: "Yapı ve dekorasyon sektorunde musterilerin %82'si referansla geliyor. Tek bir kotu teslimat, onlarca potansiyel musteriyi kaybettirir.",
            source: "Kaynak: Houzz & Home Renovation Survey, 2024"
          },
          {
            value: "%45",
            label: "Teslimat gecikmesi yasayan projeler",
            description: "Yapı malzemeleri sektorunde projelerin %45'i teslimat gecikmesi yasıyor. Geciken her gun, mimar ve muteahhit guvenini asındırır.",
            source: "Kaynak: Construction Industry Institute, 2024"
          }
        ],
        caseStudy: {
          title: "Porcelanosa — Uctan Uca Kontrol",
          summary: "Ispanyol seramik ve banyo markası Porcelanosa, showroom'larında mukemmel bir deneyim sunuyordu ama asıl farkı sahada yarattı. Kendi lojistik agını kurdu, montaj ekiplerini sertifikalandırdı, her projeyi takip sistemiyle izledi. Showroom'da gordugunuz ile evinize geleni arasında sıfır fark vardı. Mimarlar Porcelanosa onerdiklerinde, 'sorun cıkmaz' diyebiliyorlardı. Bu guven, markanın 150+ ulkeye acılmasını saglayan en buyuk sermayeydi.",
          outcome: "Sonuc: Showroom vitrini degil, teslimat zinciri marka oldu. Goruntu ceker, tutarlılık tutar.",
          type: 'success'
        },
        scenario: "Karsıt Ornek — Teslimat Felaketi: Premium showroom, ithal urunler, harika sunum. Ama montaj ekibi taseronduve her seferinde farklı biri geliyor. Ust duzey parke, ozensiz dosenince sıradan gorunuyor. Musteri showroom'daki ile evindeki arasındaki farkı gordugun anda guven biter. Bir daha gelmez, referans vermez.",
      },
      resultMatrix: [
        {
          minScore: 0,
          maxScore: 2,
          title: "Once Teslimat Zinciri",
          description: "Pazarlama talebi artırır ama tutarsız teslimat her yeni musteriyi kaybedilen bir referansa donusturur.",
          recommendations: [
            "Montaj ekiplerini sertifikalandırın veya kendi ekibinizi kurun",
            "Teslimat ve montaj surecini standartlastırın (SOP)",
            "Proje takip sistemi kurun — showroom'dan montaja kadar",
            "Musteri memnuniyet olcumu olusturun (teslim sonrası)"
          ],
          caseStudy: {
            title: "Porcelanosa",
            summary: "Teslimat zincirini kontrol altına aldı. Tutarlılık = marka oldu.",
            outcome: "Mimar 'surpriz' degil guven satın aldı.",
            type: 'success'
          }
        },
        {
          minScore: 3,
          maxScore: 6,
          title: "Kontrollu Buyume",
          description: "Sınırlı kampanya, net teslimat planlama, bayi kalite kontrolu gerekir.",
          recommendations: [
            "Bayi/montaj ekibi kalite denetim sistemi kurun",
            "Yogun donemlere ozel kapasite planı yapın",
            "Kademeli buyume stratejisi uygulayın",
            "Referans proje portfoyu olusturun"
          ]
        },
        {
          minScore: 7,
          maxScore: 8,
          title: "Hazır",
          description: "Marka anlatısı ve pazarlama agresif bicimde buyutulebilir.",
          recommendations: [
            "Tam kapasiteli dijital pazarlama kampanyası",
            "Mimar ve tasarımcı iliskilerini genisletin",
            "Yeni showroom veya deneyim merkezi planlayın",
            "Marka degeri yatırımını hızlandırın"
          ]
        }
      ],
    },

    // ========================================================================
    // ASAMA 1: MARKA RUHU
    // ========================================================================
    {
      intro: {
        script: "Insanlar urunu unutur. Ama o mekanda nasıl hissettiklerini ve karar verme surecinde kendilerini nasıl guvende hissettiklerini hatırlar.",
        stageDescription: "Bu asama, markanızın duygusal kimligini tanımlar. Yapı ve dekorasyon sektorunde musteri sadece urun degil, guven, ilham ve rehberlik satın alır.",
      },
      questions: [
        {
          type: 'selection_list',
          script: "Markanız yarın kaybolsa, musteri neyi kaybetmis hisseder?",
          text: "Kayıp Duygusu",
          options: [
            { id: 'guidance', title: "Rehberlik", desc: "Dogru urunu secmemde yol gosteren, kafamdaki belirsizligi gideren bir uzman" },
            { id: 'quality_assurance', title: "Kalite guvencesi", desc: "Gozum kapalı guvenebilecegim, hic hayal kırıklıgı yasamadıgım bir kaynak" },
            { id: 'inspiration', title: "Ilham", desc: "Hayal bile edemedigim cozumleri gosteren, mekanımı donusturun bir vizyon" },
            { id: 'prestige', title: "Prestij", desc: "Bu markayı sectim demek, zevkimi ve standardımı gosteriyordu" },
            { id: 'convenience', title: "Kolaylık", desc: "Her seyi tek yerden, sorunsuz, zahmetsiz halledebilecegim bir partner" },
            { id: 'other', title: "Diger (Belirtin)" }
          ],
          placeholder: "Hangi duyguyu yaratıyorsunuz?"
        },
        {
          type: 'selection_list',
          script: "Musterinize ne sunuyorsunuz?",
          text: "Deneyim Seviyesi",
          options: [
            { id: 'product_only', title: "Urun", desc: "Kaliteli urun, rekabetci fiyat, teknik yeterlilik" },
            { id: 'product_consulting', title: "Urun + Danısmanlık", desc: "Urun secimi, mekan analizi, teknik rehberlik" },
            { id: 'full_design', title: "Bastan sona tasarım yolculugu", desc: "Ilham, tasarım, urun secimi, montaj, teslim — uctan uca deneyim" },
            { id: 'other', title: "Diger (Belirtin)" }
          ],
          placeholder: "Deneyim seviyenizi tanımlayın"
        },
        {
          type: 'selection_list',
          script: "Urun yaklasiminiz nedir?",
          text: "Fiyat-Deger Konumlandırması",
          options: [
            { id: 'affordable', title: "Erisilebilir fiyat", desc: "Genis kitleye uygun fiyatla kaliteli urunler" },
            { id: 'value', title: "Kalite-fiyat dengesi", desc: "Odediginden fazlasını alan musteri, uzun omurlu urunler" },
            { id: 'premium', title: "Premium", desc: "Seckin markalar, ust segment, bilinli fiyatlandırma" },
            { id: 'luxury', title: "Luks / Butik", desc: "Ayrıcalık, ozel tasarım, kısıtlı erisim" },
            { id: 'other', title: "Diger (Belirtin)" }
          ],
          placeholder: "Urun yaklasiminizi tanımlayın"
        }
      ],
      educational: {
        script: "Yapı ve dekorasyon sektorunde musteri bir urun degil, bir gelecek vizyonu satın alır.",
        text: "Marka Ruhu",
        stats: [
          {
            value: "91%",
            label: "Showroom deneyimi etkisi",
            description: "Yapı malzemeleri musterilerinin %91'i showroom deneyiminin satın alma kararlarını dogrudan etkiledigini belirtiyor. Online katalog yetmiyor, dokunmak istiyor.",
            source: "Kaynak: Houzz Consumer Research, 2024"
          },
          {
            value: "5.3x",
            label: "Danısmanlık sunan markaların satısı",
            description: "Sadece urun satmak yerine tasarım danısmanlıgı sunan showroom markaları, salt urun satanlara gore 5.3 kat daha yuksek musteri basına gelir elde ediyor.",
            source: "Kaynak: Forrester B2B2C Experience Index, 2023"
          },
          {
            value: "76%",
            label: "Marka hikayesi arayan musteriler",
            description: "Dekorasyon musterilerinin %76'sı bir markanın uretim hikayesini, surdurulebilirlik yaklasımını ve degerlerini bilmek istiyor.",
            source: "Kaynak: Nielsen Home Design Consumer Study, 2024"
          },
          {
            value: "3.7x",
            label: "Net kimlige sahip markaların sadakati",
            description: "Net marka kimligine sahip showroom markaları, belirsiz kimlikli rakiplerine gore 3.7 kat daha yuksek tekrar satis oranına sahip.",
            source: "Kaynak: Bain & Company Home Improvement Report, 2023"
          }
        ],
        caseStudy: {
          title: "Vitra — Banyo Kulturu Yaratmak",
          summary: "Vitra sadece banyo urunleri satmadı, bir 'banyo kulturu' yarattı. Showroom'ları bir magaza degil, ilham merkezi olarak tasarlandı. Dunyanın en unlu tasarımcılarıyla calıstı ama hep Anadolu topragına bagını korudu. Suleymaniye Hamam'ından ilham alan koleksiyonlarla hem yerel hem global bir dil olusturdular. Musteri bir lavabo degil, bir yasam felsefesi satın alıyordu. Mimar Vitra onerdiginde, 'tasarım degeri var' diyebiliyordu.",
          outcome: "Sonuc: Urun satmak yerine kultur yaratınca, fiyat tartısması biter. Musteri hem urunu hem markayı satın alır.",
          type: 'success'
        },
        scenario: "Ruh Catısması: Showroom'da premium atmosfer, web sitesinde 'en ucuz fiyat garantisi' banner'ı. Musteri kafası karısır: Bu marka kalite mi satıyor, fiyat mı? Ikisini aynı anda vaat edemezsiniz.",
      },
      resultMatrix: [
        {
          minScore: 0,
          maxScore: 999,
          title: "Marka Ruhu Profili",
          description: "Secimlerinize gore marka ruhunuz sekillendi.",
          recommendations: [
            "Rehber Usta: Uzman danısmanlık, egitici icerik, 'size en uygun cozumu bulalım' yaklasımı",
            "Kalite Kalkanı: Tutarlılık, garanti, uzun omur vurgusu, test sonucları",
            "Ilham Kaynagı: Tasarım vizyonu, trend onsezisi, mekan donusumu hikayeleri",
            "Prestij Sahnesi: Seckin markalar, ayrıcalıklı deneyim, limitli koleksiyonlar",
            "Kolaylık Merkezi: Uctan uca hizmet, tek noktadan cozum, zahmetsiz surec"
          ]
        }
      ],
    },

    // ========================================================================
    // ASAMA 2: MARKA KARAKTERI (ARKETIP)
    // ========================================================================
    {
      intro: {
        script: "Arketip, showroom'unuzun nasıl gorunduguyle degil, musteri sikayetinde nasıl davrandıgınızla belirlenir.",
        stageDescription: "Bu asama, markanızın davranıs tarzını ve kriz anlarındaki tepkilerini tanımlar. Montaj hatası, teslimat gecikmesi, urun hasarı — bu anlarda kim oldugunuz marka karakterinizi belirler.",
      },
      questions: [
        {
          type: 'selection_list',
          script: "Musteri 'dosenen urun showroom'dakiyle aynı degil' dedi. Ilk tepkiniz ne olur?",
          text: "Kriz Tepkisi",
          options: [
            { id: 'compensate', title: "Hemen telafi eder", desc: "Ekip gonderir, gerekirse yeniden doser, ekstra jest yapar (Bakıcı)" },
            { id: 'defend', title: "Sureci savunur", desc: "Montaj standardımız bu, farklılık algısal olabilir, teknik acıklama yapar (Hukumdar)" },
            { id: 'explain', title: "Analiz eder", desc: "Sahaya gider, farkın nedenini tespit eder, rapor sunar (Bilge)" },
            { id: 'challenge', title: "Beklentiyi sorgular", desc: "Dogal malzeme varyasyonu var, her parca birbirinin aynısı olamaz (Asi)" },
            { id: 'redesign', title: "Alternatif sunar", desc: "Haklısınız, su urunle degistirelim veya su cozumu uygulayalım (Yaratıcı)" },
            { id: 'other', title: "Diger (Belirtin)" }
          ],
          placeholder: "Kriz tepkinizi aciklayın"
        },
        {
          type: 'selection_list',
          script: "Iletisim tonunuz nasıl?",
          text: "Ton",
          options: [
            { id: 'expert', title: "Uzman ve egitici", desc: "Teknik bilgi, malzeme hikayesi, dogru secimi ogretiyor" },
            { id: 'prestigious', title: "Prestijli ve seckin", desc: "Az soyle, kaliteyle goster. Marka konussun" },
            { id: 'warm', title: "Samimi ve yaklasılabilir", desc: "Yakın, yardımsever, 'birlikte bulalım' havası" },
            { id: 'bold', title: "Cesur ve trend belirleyici", desc: "Yeni trendleri sunan, sektorun onunde giden" },
            { id: 'other', title: "Diger (Belirtin)" }
          ],
          placeholder: "Iletisim tonunuzu tanımlayın"
        }
      ],
      educational: {
        script: "Karakter, showroom'un ısıgında degil, montaj sikayetinde ortaya cıkar.",
        text: "Karakter Tutarlılıgı",
        stats: [
          {
            value: "79%",
            label: "Tutarlı karakter bekleyen musteriler",
            description: "Yapı ve dekorasyon musterilerinin %79'u bir markanın showroom'da, web sitesinde, montajda ve satıs sonrasında aynı kisiiligi sergilemesini bekliyor.",
            source: "Kaynak: Deloitte Home Improvement Brand Study, 2023"
          },
          {
            value: "7x",
            label: "Kriz anında guvenilir markalar",
            description: "Net arketipe sahip yapı markaları, montaj hatası veya teslimat gecikmesinde belirsiz karakterli markalara gore 7 kat daha fazla ikinci sans alıyor.",
            source: "Kaynak: J.D. Power Trust Recovery Study, 2024"
          },
          {
            value: "88%",
            label: "Karakter tutarlılıgının mimar tercihine etkisi",
            description: "Mimarların %88'i tutarlı karaktere sahip markaları tekrar tekrar onerdigini ve proje spesifikasyonlarına yazdıgını belirtiyor.",
            source: "Kaynak: Architectural Digest Professional Survey, 2023"
          },
          {
            value: "65%",
            label: "Karakter catısması yasayan markalar",
            description: "Musterilerin %65'i bir showroom markasında ton catısması (orn. luks sunum + pazarcı uslubu satıs baskısı) hissettiklerinde rakibe gidiyor.",
            source: "Kaynak: Home Design Consumer Behavior Report, 2024"
          }
        ],
        caseStudy: {
          title: "USM — Isvicreli Tutarlılık",
          summary: "USM Modular Furniture, 1965'ten bu yana tek bir seyi iyi yapıyor: moduler mobilya. Showroom'ları minimal, satıs ekibi teknik, iletisim tonu her zaman olcullu ve egitici. Bir USM showroom'unda sizi satıs baskısıyla karsılamazsınız. Urun anlatılır, mekanınız analiz edilir, ihtiyacınıza gore konfigurasyonu birlikte tasarlarsınız. Kriz anında da aynı ton: sorun neyse analiz edilir, cozum sunulur, asla savunmaya gecilmez. 60 yıldır aynı karakter.",
          outcome: "Sonuc: Karakter tutarlıysa musteri ne bekleyecegini bilir. USM'e giden 'surpriz' degil 'guven' satın alır.",
          type: 'success'
        },
        scenario: "Karakter Catısması: Web sitesinde 'premium Avrupa kalitesi' vaadi, showroom'da profesyonel sunum, ama telefonda 'abin sana ozel fiyat yapayım' uslubu. Musteri zihninde bilisssel uyumsuzluk: Bu marka premium mi, pazar mı?",
      },
      resultMatrix: [
        {
          minScore: 0,
          maxScore: 999,
          title: "Marka Arketipi",
          description: "Kriz anında davranıs sekliniz karakterinizi ortaya koydu.",
          recommendations: [
            "Bakıcı: Sıcaklık, koruma, kosulsuz musteri memnuniyeti, 'biz hallederiz'",
            "Hukumdar: Standart, otorite, surecine guvenen, kaliteyi kanıtlayan",
            "Bilge: Teknik derinlik, egitici icerik, veri odaklı acıklama",
            "Asi: Sektorde kalıp kıran, trend belirleyen, cesur tasarım tercihleri",
            "Yaratıcı: Cozum odaklı, esnek, her projeye ozel yaklasım"
          ]
        }
      ],
    },

    // ========================================================================
    // ASAMA 3: KIM DEGILIZ (ANTI-PERSONA)
    // ========================================================================
    {
      intro: {
        script: "Her projeye evet diyen showroom, hicbir mimar icin guvenceli referans olamaz.",
        stageDescription: "Bu asama, markanız icin zararlı olan musteri ve proje profillerini belirlemenize yardımcı olur. Herkesin isini almak, hicbir iste mumtaz olmamak demektir.",
      },
      questions: [
        {
          type: 'selection_list',
          script: "Hangi musteri/proje tipi markanıza en cok zarar verir?",
          text: "En Zararlı Musteri Tipi",
          options: [
            { id: 'price_only', title: "Sadece fiyat soran", desc: "Kaliteyi gormeden, showroom'a gelmeden, sadece whatsapp'tan fiyat karsilastıran" },
            { id: 'spec_changer', title: "Surekli fikir degistiren", desc: "Secim yapıp vazgecen, 5 kez numune isteyen, asla karar veremeyen" },
            { id: 'diy_expert', title: "Her seyi bilen", desc: "YouTube'dan ogrendigini iddia eden, montaj ekibini yonlendirmeye calisan" },
            { id: 'blame_shifter', title: "Sorumluluk almayan", desc: "Kendi olcum hatasını markanın problemi olarak gosteren" },
            { id: 'brand_damager', title: "Marka imajını bozan", desc: "Ucuz urun alıp premium hizmet bekleyen, sosyal medyada abartılı sikayet" },
            { id: 'other', title: "Diger (Belirtin)" }
          ],
          placeholder: "Zararlı musteri tipini tanımlayın"
        },
        {
          type: 'selection_list',
          script: "Bu musteri tipi hangi soruna yol acıyor?",
          text: "Sorun Tipi",
          options: [
            { id: 'profitability', title: "Karlılık", desc: "Numune maliyeti, geciken kararlar, iptal edilen siparisler, dusuk marj" },
            { id: 'reputation', title: "Itibar", desc: "Yanlıs referans, sosyal medya sikayetleri, mimar guvenini zedeleyen projeler" },
            { id: 'operations', title: "Operasyon", desc: "Ekip verimliligi dusuyorr, diger projelerin kalitesi etkileniyor" },
            { id: 'other', title: "Diger (Belirtin)" }
          ],
          placeholder: "Sorun tipini aciklayın"
        },
        {
          type: 'selection_list',
          script: "Bu duruma nasıl yaklasırsınız?",
          text: "Yaklasım Tavrı",
          options: [
            { id: 'soft', title: "Nazik yonlendirme", desc: "Showroom deneyimi, danısmanlık sureci ve fiyatlandırmayla dolaylı filtreleme" },
            { id: 'barrier', title: "Sistem bariyeri", desc: "Minimum proje buyuklugu, on gorus sureci, depozito sistemi" },
            { id: 'hard_no', title: "Net sınır", desc: "Acık kriterler, 'bu proje profilimize uymuyor' demek" },
            { id: 'other', title: "Diger (Belirtin)" }
          ],
          placeholder: "Yaklasım tavrınızı aciklayın"
        }
      ],
      educational: {
        script: "Her projeye evet diyen marka, hicbir projede mumtaz olamaz.",
        text: "Filtreleme Stratejisi",
        stats: [
          {
            value: "73%",
            label: "Numune israfı",
            description: "Yapı malzemeleri sektorunde gonderilen numunelerin %73'u satısa donusmeden cope gidiyor. Niteliksiz talep yonetimi = kaynak israfı.",
            source: "Kaynak: Building Materials Industry Association, 2024"
          },
          {
            value: "5.1x",
            label: "Musteri seciciligi yapan markaların karlılıgı",
            description: "Net musteri kabul kriterleri olan showroom markaları, herkesle calısanlara gore 5.1 kat daha yuksek proje basına karlılıga sahip.",
            source: "Kaynak: BCG Home & Living Sector Report, 2023"
          },
          {
            value: "54%",
            label: "Fiyat odaklı musterilerin yarattıgı hasar",
            description: "Sadece fiyatla gelen musteriler, showroom cirosunun %54'unu olusturdugunda bile kar marjının sadece %6'sına katkı saglıyor.",
            source: "Kaynak: McKinsey Building Products Pricing Study, 2024"
          },
          {
            value: "89%",
            label: "Premium showroom'ların filtreleme oranı",
            description: "Basarılı premium showroom markalarının %89'u aktif olarak musteri/proje filtreleme stratejisi uyguluyor.",
            source: "Kaynak: Interior Design Business Report, 2023"
          }
        ],
        caseStudy: {
          title: "Bulthaup — Mutfak Seciciligi",
          summary: "Alman premium mutfak markası Bulthaup, her musteriye evet demez. Showroom'a gelen herkes musteri degil, potansiyeldir. Once bir gorus yapılır: Mekanınız, yasam tarzınız, butceniz, beklentileriniz. Bulthaup size uygun degilse, nazikce yonlendirilirsiniz. Bu secicilik, markanın zarar gorecegi projeleri eledi. Gerceklesen her projenin kalitesi mukemmeldi. Her musteri referans oldu. Sonuc: Az musteri, yuksek deger, mumtaz itibar.",
          outcome: "Sonuc: Hayır diyebildiginiz musteri sayısı, marka degerinizi belirler. Az ama dogru proje = buyume.",
          type: 'success'
        },
        scenario: "WhatsApp Fiyat Tuzagı: Showroom'unuza hic gelmeden, sadece WhatsApp'tan 'su urun kac TL?' diye soran yuzlerce kisi. Hepsine fiyat veriyorsunuz. %95'i bir daha yazmıyor. Cozum: Once showroom daveti, numune deneyimi, mekan analizi. Fiyat son asama. Sureci tasarlayın, fiyatı degil.",
      },
      resultMatrix: [
        {
          minScore: 0,
          maxScore: 999,
          title: "Filtreleme Stratejisi",
          description: "Istemediginiz musteri/proje profilini tanımladınız.",
          recommendations: [
            "Soft Filtreleme: Showroom deneyimi, danısmanlık sureci, fiyat konumlandırmasıyla dolaylı eleme",
            "Sistem Bariyeri: Minimum proje buyuklugu, on gorus, depozito, numune politikası",
            "Sert Sınır: Acık proje kabul kriterleri, 'bu is profilimize uymuyor' iletisimi"
          ]
        }
      ],
    },

    // ========================================================================
    // ASAMA 4: HEDEF VE BASARI
    // ========================================================================
    {
      intro: {
        script: "Ciro mu istiyoruz, mimar tercihi mi, marka degeri mi? Hedef belirsizse her yatırım israftır.",
        stageDescription: "Bu asama, bu projenin birincil hedefini ve basarı metriklerinizi netlestirir. Showroom trafigi mi, mimar iliskileri mi, proje bazlı buyume mi? Hedef belirsizse strateji de belirsiz olur.",
      },
      questions: [
        {
          type: 'selection_list',
          script: "Bu projedeki birincil hedefiniz?",
          text: "Birincil Hedef",
          options: [
            { id: 'awareness', title: "Marka bilinirli gi", desc: "Hedef kitlede markanın adını duyurmak, showroom trafigi artırmak" },
            { id: 'architect_preference', title: "Mimar/Tasarımcı tercihi", desc: "Mimarların ve ic tasarımcıların projelerde oncelikle onerdiigi marka olmak" },
            { id: 'revenue', title: "Ciro artısı", desc: "Proje sayısı, proje buyuklugu veya musteri basına gelir artısı" },
            { id: 'dealer_network', title: "Bayi agı guclen dirmek", desc: "Daha guclu, daha nitelikli, daha yaygın bayi/showroom agı" },
            { id: 'other', title: "Diger (Belirtin)" }
          ],
          placeholder: "Hedefiniz nedir?"
        },
        {
          type: 'selection_list',
          script: "Buyume hızı tercihiniz?",
          text: "Buyume Hızı",
          options: [
            { id: 'fast', title: "Hızlı", desc: "Agresif pazarlama, hızlı bayi acılımı, kısa surede maksimum buyume" },
            { id: 'balanced', title: "Dengeli", desc: "Surdurulebilir buyume, kontrollu genisleme, kaliteyi koruyarak" },
            { id: 'selective', title: "Secici", desc: "Yavas ama degerli, premium konumlandırma, beklenti yaratma" },
            { id: 'other', title: "Diger (Belirtin)" }
          ],
          placeholder: "Buyume stratejiniz?"
        },
        {
          type: 'selection_list',
          script: "Basarı sizin icin ne demek?",
          text: "Basarı Isareti",
          options: [
            { id: 'showroom_traffic', title: "Showroom trafigi", desc: "Daha fazla nitelikli ziyaretci, randevu talebi" },
            { id: 'architect_specs', title: "Mimar spesifikasyonları", desc: "Proje detaylarında markanızın yazılması, mimar tavsiyesi" },
            { id: 'project_value', title: "Proje basına deger", desc: "Ortalama proje buyuklugunun ve kar marjının artması" },
            { id: 'reference_rate', title: "Referans oranı", desc: "Tamamlanmıs projelerden gelen yeni musteri oranı" },
            { id: 'brand_premium', title: "Fiyat primi", desc: "Ayni kategoride rakiplerden daha yuksek fiyata satabilmek" },
            { id: 'other', title: "Diger (Belirtin)" }
          ],
          placeholder: "Basarı tanımınız?"
        }
      ],
      educational: {
        script: "Viral olmak bir hedef degil, sonuctur. Showroom sektorunde gercek basarı referansla gelir.",
        text: "Basarı Tanımı",
        stats: [
          {
            value: "71%",
            label: "Net hedefi olmayan showroom markaları",
            description: "Yapı ve dekorasyon sektorunde yoneticilerin %71'i 'ciro artısı' ve 'marka degeri' hedeflerini karıstırıyor. Sonuc: her kampanya farklı bir yone cekiyor.",
            source: "Kaynak: McKinsey Building & Home Report, 2024"
          },
          {
            value: "4.1x",
            label: "Mimar odaklı markaların buyumesi",
            description: "Mimar ve tasarımcı iliskilerine yatırım yapan showroom markaları, sadece son kullanıcıya odaklananlara gore 4.1 kat daha hızlı buyuyor.",
            source: "Kaynak: Architectural Specification Impact Study, 2023"
          },
          {
            value: "86%",
            label: "Referansla gelen premium musteriler",
            description: "Premium showroom markalarında musterilerin %86'sı mimar tavsiyesi veya tamamlanmıs proje referansıyla geliyor. Reklam degil, referans satıyor.",
            source: "Kaynak: Houzz Professional Network Survey, 2024"
          },
          {
            value: "62%",
            label: "Fiyat priminin kaynagı",
            description: "Yapı malzemeleri sektorunde %62 fiyat primi, urun kalitesinden degil marka algısı ve showroom deneyiminden kaynaklanıyor.",
            source: "Kaynak: Bain & Company Luxury Home Report, 2023"
          }
        ],
        caseStudy: {
          title: "Hansgrohe — Mimar Iliskisi Stratejisi",
          summary: "Alman armatuur markası Hansgrohe, son kullanıcıya degil mimarlara yatırım yaptı. Mimar etkinlikleri, CPD seminerleri, proje destek ekipleri. Mimarlar Hansgrohe'yi projelerine yazdı. Son kullanıcı mimarına guvendi, Hansgrohe'yi secti. Reklam bütcesi rakiplerinden dusuktu ama mimar spesifikasyon oranı sektorde en yuksekti. Sonuc: Reklama degil, iliskiye yatırım yapınca buyume organik ve surdurulebilir oldu.",
          outcome: "Sonuc: Hedef net olunca strateji de net olur. Hansgrohe mimarla musteri arasındaki guven koprusunu kurdu.",
          type: 'success'
        },
        scenario: "Karsıt Ornek — Instagram Tuzagı: Gorselleri cok guzel bir showroom hesabı. Takipci sayısı yuksek, begeniler cok. Ama showroom'a gelen ziyaretci profili yanlıs: Instagram'dan ilham alan ama butcesi uyusmayan kitle. Gorsel bilinirlik arttı ama nitelikli musteri gelmedi. Dogru hedef kitleye dogru kanaldan ulasılmalıydı.",
      },
      resultMatrix: [
        {
          minScore: 0,
          maxScore: 999,
          title: "Strateji Modeli",
          description: "Hedef ve basarı tanımınız netlesti.",
          recommendations: [
            "Ciro Motoru: Showroom trafigi, donusum optimizasyonu, proje buyuklugu artırma",
            "Mimar Agı Insası: Mimar etkinlikleri, CPD programları, proje destek ekibi",
            "Marka Degeri Yatırımı: Premium konumlandırma, referans portfoyu, fiyat primi yaratma"
          ]
        }
      ],
    },
  ],
};
