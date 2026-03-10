import { SectorQuestionConfig } from '../../types';

export const healthConfig: SectorQuestionConfig = {
  sectorId: 'health',

  intro: {
    script: "Sağlıkta güven, bir kez kırılırsa geri gelmez. Güçlü bir marka, güçlü bir operasyonun üzerine inşa edilir.",
    text: "Bu interaktif deneyim, sağlık ve wellness markanız için üretilecek görsel ve anlatısal dünyanın güvenilir, tutarlı ve taşıyabildiğiniz kadar iddialı olmasını sağlamak için tasarlandı.",
  },

  stages: [
    // ========================================================================
    // AŞAMA 0: OPERASYONEL GERÇEKLİK
    // ========================================================================
    {
      intro: {
        script: "Operasyonunuz vaat ettiğinizi taşıyamazsa, pazarlama sadece hayal kırıklığını büyütür.",
        stageDescription: "Bu aşama, kliniğinizin veya merkezinizin vaatlerini operasyonel olarak taşıyıp taşıyamayacağını belirler. Sağlıkta tutarsızlık sadece memnuniyetsizlik değil, güven kaybıdır.",
      },
      questions: [
        {
          type: 'selection_scored',
          script: "Hasta/danışan deneyiminiz ne kadar tutarlı?",
          text: "Deneyim Tutarlılığı",
          options: [
            { id: 'varies', title: "Kişiye göre değişiyor", desc: "Her uzman farklı yaklaşım sergiliyor, standart yok", score: 0 },
            { id: 'similar', title: "Benzer ama değişken", desc: "Genel çerçeve var ama her randevuda farklılıklar oluyor", score: 1 },
            { id: 'mostly_stable', title: "Büyük ölçüde sabit", desc: "Çoğu hasta benzer deneyim yaşıyor, küçük sapmalar var", score: 2 },
            { id: 'sop_defined', title: "Protokollerle net", desc: "Hasta yolculuğu baştan sona tanımlı ve uygulanıyor", score: 3 },
            { id: 'other', title: "Diğer (Belirtin)", score: 0 }
          ],
          placeholder: "Durumunuzu açıklayın"
        },
        {
          type: 'selection_scored',
          script: "Yoğun dönemlerde (grip sezonu, kampanya dönemi) kalite ve hizmet nasıl?",
          text: "Yoğun Dönem Dayanıklılığı",
          options: [
            { id: 'collapses', title: "Çöküyor", desc: "Bekleme süreleri uzuyor, hatalar artıyor, hasta şikayetleri patlıyor", score: 0 },
            { id: 'struggling', title: "Zorlanıyor", desc: "Hissedilir kalite düşüşü var ama idare ediliyor", score: 1 },
            { id: 'mostly_holds', title: "Çoğunlukla korunuyor", desc: "Küçük aksamalar olsa da genel kalite stabil kalıyor", score: 2 },
            { id: 'measured', title: "Ölçümlü şekilde korunuyor", desc: "Yoğunluk yönetimi protokolleri var, kalite düşmüyor", score: 3 },
            { id: 'other', title: "Diğer (Belirtin)", score: 0 }
          ],
          placeholder: "Durumunuzu açıklayın"
        },
        {
          type: 'selection_scored',
          script: "Bu çalışma sonrası %30 talep artışı olursa — yeni doktor, oda, ekipman hazırlığınız var mı?",
          text: "Talep Artışı Kapasitesi",
          options: [
            { id: 'cannot', title: "Karşılayamayız", desc: "Mevcut uzman kadrosu ve fiziksel alan yetersiz", score: 0 },
            { id: 'partially', title: "Kısmen karşılarız", desc: "Bazı düzenlemelerle (ek seans, vardiya) idare edebiliriz", score: 1 },
            { id: 'yes', title: "Evet, karşılarız", desc: "Kadro ve altyapı hazır, ölçeklenebiliriz", score: 2 },
            { id: 'other', title: "Diğer (Belirtin)", score: 0 }
          ],
          placeholder: "Durumunuzu açıklayın"
        }
      ],
      educational: {
        script: "İki klinik hikayesi: Biri parlak bir açılış yaptı, diğeri sessizce güven inşa etti. Sadece biri ayakta kaldı.",
        text: "Operasyonel Tutarlılık",
        stats: [
          {
            value: "71%",
            label: "Sağlık kuruluşlarında güven kaybının ana nedeni",
            description: "Hastaların %71'i operasyonel tutarsızlığı (farklı bilgi, değişen prosedür) güven kaybının birincil nedeni olarak görüyor.",
            source: "Kaynak: Press Ganey Patient Experience Report, 2023"
          },
          {
            value: "92%",
            label: "Tutarlılık bekleyen hastalar",
            description: "Hastaların %92'si her ziyaretinde aynı kalite standardını bekliyor. Tutarsız deneyim = klinik değiştirme.",
            source: "Kaynak: Accenture Health Consumer Survey, 2024"
          },
          {
            value: "3.5x",
            label: "Protokollü kliniklerde hasta memnuniyeti",
            description: "Standart hasta yolculuğu protokolü olan klinikler, olmayanlara göre 3.5 kat daha yüksek memnuniyet skoru alıyor.",
            source: "Kaynak: Journal of Healthcare Management, 2023"
          },
          {
            value: "%35",
            label: "Dijital kampanya sonrası artan talep",
            description: "Başarılı bir dijital sağlık kampanyası sonrası randevu taleplerinde ortalama %35 artış görülüyor. Hazır değilseniz bu bir operasyonel felaket.",
            source: "Kaynak: HIMSS Digital Health Report, 2024"
          }
        ],
        caseStudy: {
          title: "Theranos — Parlak İmaj, Çürük Operasyon",
          summary: "Theranos 'tek damla kanla her testi yap' vaadi ile sağlık dünyasını salladı. Elizabeth Holmes karizmatik bir lider, marka inanılmaz güçlüydü. Forbes kapağı, milyar dolarlık değerleme, ünlü yatırımcılar. Ama operasyonel gerçeklik tamamen farklıydı: testler güvenilir değildi, cihazlar çalışmıyordu, sonuçlar hatalıydı. Parlak marka, zayıf operasyonu gizleyemedi — aksine, çöküşü daha dramatik yaptı.",
          outcome: "Sonuç: Sağlıkta marka vaadi ile operasyonel gerçeklik arasındaki uçurum telafi edilemez. İmaj operasyonu kurtarmaz.",
          type: 'failure'
        },
        scenario: "Karşıt Örnek — Mayo Clinic: 150 yıldır reklam yapmadı, viral olmayı hedeflemedi. Ama her hastasına aynı deneyimi yaşattı. Aynı protokoller, aynı kalite standardı, aynı hasta odaklı yaklaşım. Güven vaadi ile operasyonel gerçeklik birebir örtüştü. Sonuç: Dünyanın en güvenilir sağlık markası.",
      },
      resultMatrix: [
        {
          minScore: 0,
          maxScore: 2,
          title: "Önce Operasyon",
          description: "Pazarlama talebi artırır ama sağlıkta tutarsızlık doğrudan güven kaybıdır.",
          recommendations: [
            "Hasta yolculuğu protokolleri oluşturun (karşılama, muayene, takip)",
            "Personel eğitim programı başlatın (iletişim, empati, prosedür)",
            "Kalite kontrol ve hasta geri bildirim sistemleri kurun",
            "Kapasite planlaması yapın (uzman kadro, oda, ekipman)"
          ],
          caseStudy: {
            title: "Mayo Clinic",
            summary: "Reklamdan çok protokole yatırım yaptı. Her hastaya aynı deneyimi sundu.",
            outcome: "Hasta 'sürpriz' değil güven satın aldı. 150 yıldır dünyanın en güvenilir sağlık markası.",
            type: 'success'
          }
        },
        {
          minScore: 3,
          maxScore: 6,
          title: "Kontrollü Büyüme",
          description: "Sınırlı vaat, net sınırlar, randevu disiplini gerekir.",
          recommendations: [
            "Randevu sistemi ile talep yönetimi yapın",
            "Kapasiteyi aşmayan kampanyalar planlayın",
            "Kademeli büyüme stratejisi belirleyin (önce kalite, sonra hacim)",
            "Operasyonel iyileştirmelere paralel olarak marka çalışması yürütün"
          ]
        },
        {
          minScore: 7,
          maxScore: 8,
          title: "Hazır",
          description: "Marka anlatısı ve görsel dünya agresif biçimde büyütülebilir.",
          recommendations: [
            "Tam kapasiteli dijital sağlık kampanyası başlatın",
            "Güven odaklı içerik stratejisi oluşturun",
            "Yeni hizmet alanları ve ölçekleme planları geliştirin",
            "Marka değeri ve otorite yatırımına geçin"
          ]
        }
      ],
    },

    // ========================================================================
    // AŞAMA 1: MARKA RUHU
    // ========================================================================
    {
      intro: {
        script: "İnsanlar tedaviyi unutabilir. Ama nasıl hissettiklerini asla unutmaz.",
        stageDescription: "Bu aşama, markanızın duygusal kimliğini ve danışanlarınızda yaratmak istediğiniz hissi tanımlar. Sağlıkta güven, yetkinlikten önce his ile başlar.",
      },
      questions: [
        {
          type: 'selection_list',
          script: "Markanız kaybolsa, danışan neyi kaybetmiş hisseder?",
          text: "Kayıp Duygusu",
          options: [
            { id: 'safety', title: "Güvenlik", desc: "Kendini güvende hissettiği, her şeyin kontrol altında olduğu bir yer" },
            { id: 'expertise', title: "Uzmanlık", desc: "Alanında en iyisinin elinde olduğunu bilmenin huzuru" },
            { id: 'compassion', title: "Şefkat", desc: "Gerçekten dinlenen, anlaşılan ve önemsenen bir ilişki" },
            { id: 'hope', title: "Umut", desc: "İyileşme ve daha iyi bir yaşam inancı" },
            { id: 'trust', title: "Güven", desc: "Yıllar içinde inşa edilmiş, sorgulanmayan bir bağ" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Hangi duyguyu yaratıyorsunuz?"
        },
        {
          type: 'selection_list',
          script: "Danışanınıza ne sunuyorsunuz?",
          text: "Deneyim Seviyesi",
          options: [
            { id: 'treatment_only', title: "Tedavi", desc: "Doğru tanı, etkili tedavi, klinik sonuç" },
            { id: 'treatment_care', title: "Tedavi + Bakım", desc: "Tedavinin ötesinde takip, destek, ilgi" },
            { id: 'holistic_journey', title: "Bütünsel sağlık yolculuğu", desc: "Fiziksel, zihinsel, duygusal — tüm yaşam kalitesi" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Deneyim seviyenizi tanımlayın"
        },
        {
          type: 'selection_list',
          script: "Tıbbi/sağlık yaklaşımınız?",
          text: "Yaklaşım Stili",
          options: [
            { id: 'traditional', title: "Geleneksel tıp", desc: "Kanıta dayalı, klasik protokoller, güvenilir yöntemler" },
            { id: 'integrative', title: "Entegratif yaklaşım", desc: "Modern tıp + tamamlayıcı terapiler birlikte" },
            { id: 'innovative', title: "Yenilikçi", desc: "Son teknoloji, yeni tedavi yöntemleri, araştırma odaklı" },
            { id: 'pioneer', title: "Öncü", desc: "Sektörde ilkleri yapan, yeni standartlar belirleyen" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Yaklaşımınızı tanımlayın"
        }
      ],
      educational: {
        script: "Sağlıkta güven, yetkinlikten önce hisle başlar.",
        text: "Marka Ruhu",
        stats: [
          {
            value: "85%",
            label: "Duygusal bağ kuran hastalar",
            description: "Hastaların %85'i kendini duygusal olarak güvende hissettiği klinik/doktora sadık kalıyor, daha pahalı olsa bile.",
            source: "Kaynak: Beryl Institute Patient Experience Study, 2024"
          },
          {
            value: "8x",
            label: "Empati algısının etkisi",
            description: "Hastaların empatik algıladığı sağlık kuruluşlarını tavsiye etme oranı, diğerlerine göre 8 kat daha yüksek.",
            source: "Kaynak: Cleveland Clinic Empathy Study, 2023"
          },
          {
            value: "67%",
            label: "Hikaye arayan danışanlar",
            description: "Danışanların %67'si sağlık markasının misyonunu, değerlerini ve felsefesini bilmek istiyor — sadece hizmet listesi yeterli değil.",
            source: "Kaynak: NRC Health Consumer Loyalty Report, 2024"
          },
          {
            value: "2.8x",
            label: "Net kimliğe sahip kliniklerin başarısı",
            description: "Net marka kimliğine sahip sağlık kuruluşları, belirsiz kimliğe sahip olanlara göre 2.8 kat daha yüksek hasta sadakatine sahip.",
            source: "Kaynak: Harvard Business Review Healthcare Branding, 2023"
          }
        ],
        caseStudy: {
          title: "Cleveland Clinic — 'Empati' Manifestosu",
          summary: "Cleveland Clinic dünyanın en iyi hastanelerinden biri. Ama marka ruhlarını 'uzmanlık' üzerine değil, 'empati' üzerine kurdu. 'Patients First' (Önce Hasta) felsefesi her detayda hissediliyor: girişteki karşılamadan, doktorun göz temasına, taburculuk sonrası aramaya kadar. 'Empathy: The Human Connection to Patient Care' videosu 5 milyon kez izlendi — tek bir tıbbi bilgi içermiyordu. Sadece duygu vardı: 'Bu koridorlardan geçen her insanın bir hikayesi var.' Uzmanlık rakiplerinde de vardı. Empati onların markası oldu.",
          outcome: "Sonuç: Net kimlik = hatırlanma. Sağlıkta ruh belirsizse, güven de belirsizdir.",
          type: 'success'
        },
        scenario: "Ruh Çatışması: Bir klinik görsellerde 'sıcak, şefkatli, aile doktoru' havası veriyor ama içeri girince soğuk, kurumsal, bürokratik bir deneyim sunuyor. Hasta web sitesinde hissettiğiyle klinikte hissettiği uyuşmuyor. Kafası karışıyor. Güveni sarsılıyor. Rakibi seçiyor.",
      },
      resultMatrix: [
        {
          minScore: 0,
          maxScore: 999,
          title: "Marka Ruhu Profili",
          description: "Seçimlerinize göre sağlık markanızın ruhu şekillendi.",
          recommendations: [
            "Güvenli Liman: Protokol + sakin, güven veren anlatı",
            "Uzmanlık Kalesi: Bilgi, kanıt, otorite dili",
            "Şefkat Merkezi: İnsan yüzü, empati, ilişki",
            "Umut Işığı: İlham, başarı hikayeleri, pozitif enerji",
            "Güven Çapası: Tutarlılık, şeffaflık, uzun vadeli bağ"
          ]
        }
      ],
    },

    // ========================================================================
    // AŞAMA 2: MARKA KARAKTERİ (ARKETİP)
    // ========================================================================
    {
      intro: {
        script: "Arketip, markanın iyi günde değil, kriz anında kim olduğunu belirler.",
        stageDescription: "Bu aşama, markanızın davranış tarzını ve kriz anlarındaki tepkilerini tanımlar. Tedavi sonucu memnuniyetsizliği, bekleme süresi şikayeti — bu anlarda kim olduğunuz, markanızın karakteridir.",
      },
      questions: [
        {
          type: 'selection_list',
          script: "Bir hasta tedavi sonucundan memnun kalmadığını söylese, ilk tepkiniz ne olur?",
          text: "Kriz Tepkisi",
          options: [
            { id: 'compensate', title: "Telafi eder", desc: "Dinler, ücretsiz kontrol randevusu verir, süreci yeniden değerlendirir (Bakıcı)" },
            { id: 'defend', title: "Protokolü savunur", desc: "Prosedürün doğru uygulandığını açıklar, klinik kanıtları gösterir (Hükümdar)" },
            { id: 'explain', title: "Eğitir", desc: "Neden bu sonucun olabileceğini, sürecin nasıl işlediğini detaylı anlatır (Bilge)" },
            { id: 'innovate', title: "Alternatif sunar", desc: "Farklı bir yaklaşım önerir, yeni tedavi seçeneklerini araştırır (Yaratıcı)" },
            { id: 'challenge', title: "Beklenti yönetimi yapar", desc: "Gerçekçi olmayan beklentileri nazikçe düzeltir (Gerçekçi)" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Kriz tepkinizi açıklayın"
        },
        {
          type: 'selection_list',
          script: "İletişim tonunuz nasıl?",
          text: "İletişim Tonu",
          options: [
            { id: 'clinical', title: "Klinik & profesyonel", desc: "Bilimsel, ölçülü, otoriter" },
            { id: 'warm', title: "Sıcak & empatik", desc: "Yakın, anlayışlı, insan odaklı" },
            { id: 'educational', title: "Eğitici & bilgilendirici", desc: "Açıklayıcı, öğretici, şeffaf" },
            { id: 'motivational', title: "Motive edici & ilham verici", desc: "Pozitif, güçlendirici, umut veren" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "İletişim tonunuzu tanımlayın"
        }
      ],
      educational: {
        script: "Sağlıkta karakter tutarlılığı, güvenin temelidir.",
        text: "Karakter Tutarlılığı",
        stats: [
          {
            value: "76%",
            label: "Tutarlı karakter bekleyen hastalar",
            description: "Hastaların %76'sı bir sağlık markasının web sitesinde, telefonda ve klinikte aynı tonu, aynı yaklaşımı sergilemesini bekliyor.",
            source: "Kaynak: McKinsey Healthcare Consumer Study, 2023"
          },
          {
            value: "6x",
            label: "Kriz anında güvenilir sağlık markaları",
            description: "Net arketipe sahip sağlık markaları, kriz anlarında (hatalı sonuç, gecikme) belirsiz markalara göre 6 kat daha fazla hastayı elde tutuyor.",
            source: "Kaynak: Edelman Health Trust Barometer, 2024"
          },
          {
            value: "89%",
            label: "Karakter tutarlılığının etkisi",
            description: "Sağlık kuruluşlarının %89'u marka karakter tutarlılığının hasta güvenini doğrudan artırdığını raporluyor.",
            source: "Kaynak: HCAHPS Patient Satisfaction Data, 2023"
          },
          {
            value: "72%",
            label: "Karakter çakışması yaşayan hastalar",
            description: "Hastaların %72'si web sitesinde 'sıcak' ama klinikte 'soğuk' bir deneyim yaşadıklarında o klinikten ayrılıyor.",
            source: "Kaynak: Patient Experience Journal, 2024"
          }
        ],
        caseStudy: {
          title: "Acıbadem — 'Güvenilir Uzman' Arketipi",
          summary: "Acıbadem marka kimliğini 'güvenilir uzmanlık' üzerine kurdu. Her dokunma noktasında aynı karakter hissedilir: web sitesinde bilimsel ama anlaşılır dil, klinikte profesyonel ama sıcak yaklaşım, sosyal medyada bilgilendirici ama erişilebilir içerik. Bir hasta şikayet ettiğinde tepki her zaman aynıdır: dinle, anla, kanıtla çöz. Bu tutarlılık, Acıbadem'i Türkiye'nin en güvenilir sağlık markalarından biri yaptı. Hasta ne beklediğini biliyor. Doktor nasıl davranacağını biliyor. Medya nasıl yazacağını biliyor.",
          outcome: "Sonuç: Arketip tutarlıysa her karar kolaylaşır. Renk, dil, yaklaşım, kriz yönetimi — hepsi otomatik hizalanır.",
          type: 'success'
        },
        scenario: "Arketip Çakışması: Klinik görsellerde 'sıcak, aile doktoru' imajı çiziyor ama doktorlar soğuk ve mesafeli. Resepsiyon samimi ama tedavi süreci mekanik. Hasta bilişsel uyumsuzluk yaşıyor: 'Bu klinik hangi klinik?' Güven sarsılıyor.",
      },
      resultMatrix: [
        {
          minScore: 0,
          maxScore: 999,
          title: "Marka Arketipi",
          description: "Kriz anında davranış şekliniz sağlık markanızın karakterini ortaya koydu.",
          recommendations: [
            "Bakıcı: Şefkat, koruma, 'yanınızdayız'",
            "Hükümdar: Protokol, otorite, kontrol, güvenilirlik",
            "Bilge: Bilgi, eğitim, şeffaflık, derinlik",
            "Yaratıcı: İnovasyon, yeni yaklaşımlar, çözüm odaklılık",
            "Gerçekçi: Dürüstlük, beklenti yönetimi, kanıta dayalı iletişim"
          ]
        }
      ],
    },

    // ========================================================================
    // AŞAMA 3: KİM DEĞİLİZ (ANTI-PERSONA)
    // ========================================================================
    {
      intro: {
        script: "Herkese hizmet veren klinik, kimse için vazgeçilmez değildir.",
        stageDescription: "Bu aşama, markanız için zararlı olan danışan profillerini belirlemenize yardımcı olur. Sağlıkta yanlış hasta profili, sadece kârlılık değil, operasyonel kaliteyi de düşürür.",
      },
      questions: [
        {
          type: 'selection_list',
          script: "Hangi danışan tipi markanıza en çok zarar verir?",
          text: "En Zararlı Danışan Tipi",
          options: [
            { id: 'dr_google', title: "Dr. Google", desc: "İnternetten kendi tanısını koymuş, uzmana itiraz eden, tedaviyi sorgulayan" },
            { id: 'price_only', title: "Sadece fiyat arayan", desc: "En ucuz seçeneği arayan, kalite-fiyat dengesini anlamayan" },
            { id: 'non_compliant', title: "Tedaviye uymayan", desc: "Reçeteyi takip etmeyen, kontrollere gelmeyen, sonra şikayet eden" },
            { id: 'chronic_complainer', title: "Sürekli şikayetçi", desc: "Hiçbir sonuçtan memnun kalmayan, sürekli olumsuz geri bildirim veren" },
            { id: 'miracle_seeker', title: "Mucize bekleyen", desc: "Gerçekçi olmayan beklentileri olan, tek seansta çözüm isteyen" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Zararlı danışan tipini tanımlayın"
        },
        {
          type: 'selection_list',
          script: "Bu danışan tipi hangi soruna yol açıyor?",
          text: "Sorun Tipi",
          options: [
            { id: 'reputation', title: "İtibar", desc: "Olumsuz yorumlar, haksız şikayetler, marka algısı hasarı" },
            { id: 'team_morale', title: "Ekip morali", desc: "Doktor ve personel motivasyonunu düşürüyor, tükenmişlik" },
            { id: 'operational', title: "Operasyonel", desc: "Gereksiz zaman kaybı, randevu akışını bozma, kaynak israfı" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Sorun tipini açıklayın"
        },
        {
          type: 'selection_list',
          script: "Bu duruma nasıl yaklaşırsınız?",
          text: "Yaklaşım Tavırı",
          options: [
            { id: 'education', title: "Eğitim ile yönlendirme", desc: "Beklenti yönetimi, bilgilendirme, doğru yönlendirme" },
            { id: 'filtering', title: "Ön filtreleme", desc: "İlk görüşme, uygunluk değerlendirmesi, doğru hasta seçimi" },
            { id: 'referral', title: "Yönlendirme", desc: "Uygun olmayan danışanı başka merkeze nazikçe yönlendirme" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Yaklaşım tavırınızı açıklayın"
        }
      ],
      educational: {
        script: "Sağlıkta doğru hasta profili, kaliteli hizmetin ön koşuludur.",
        text: "Filtreleme Stratejisi",
        stats: [
          {
            value: "74%",
            label: "Hedef dışı hastaların operasyonel etkisi",
            description: "Sağlık kuruluşlarının %74'ü hedef profil dışı hastaların operasyonel verimliliği ciddi şekilde düşürdüğünü bildiriyor.",
            source: "Kaynak: Healthcare Financial Management Association, 2023"
          },
          {
            value: "5x",
            label: "Uygunluk değerlendirmesi yapan kliniklerin başarısı",
            description: "Ön değerlendirme yapan sağlık kuruluşları, yapmayanlara göre 5 kat daha yüksek hasta memnuniyeti ve 3 kat daha düşük şikayet oranına sahip.",
            source: "Kaynak: Journal of Patient Experience, 2024"
          },
          {
            value: "62%",
            label: "Gerçekçi olmayan beklenti sorunu",
            description: "Estetik ve wellness sektöründeki şikayetlerin %62'si gerçekçi olmayan beklentilerden kaynaklanıyor. Ön bilgilendirme bunu %80 azaltıyor.",
            source: "Kaynak: American Society of Plastic Surgeons Data, 2023"
          },
          {
            value: "88%",
            label: "Hasta seçimi yapan premium klinikler",
            description: "Premium konumlanmış sağlık kuruluşlarının %88'i aktif olarak hasta uygunluk değerlendirmesi yapıyor.",
            source: "Kaynak: Private Healthcare UK Market Report, 2024"
          }
        ],
        caseStudy: {
          title: "Florence Nightingale — Ön Değerlendirme Sistemi",
          summary: "Florence Nightingale Hastaneleri belirli uzmanlık alanlarında ön değerlendirme sistemi kurdu. Özellikle estetik cerrahi ve wellness bölümlerinde her danışanla önce bir 'uygunluk görüşmesi' yapılıyor. Bu görüşmede beklentiler, sağlık geçmişi ve motivasyon değerlendiriliyor. Gerçekçi olmayan beklentisi olanlar nazikçe bilgilendirilip yönlendiriliyor. Sonuç: şikayet oranları düştü, hasta memnuniyeti arttı, doktor motivasyonu yükseldi. 'Hayır' diyebilmek, kaliteyi korumanın ilk adımı oldu.",
          outcome: "Sonuç: Doğru hasta seçimi, doğru sonuç demektir. Filtreleme kaliteyi koruyor.",
          type: 'success'
        },
        scenario: "'Dr. Google' Sendromu: Danışan internetten araştırma yapıp gelmiş, kendi tanısını koymuş, tedavi planını hazırlamış. Doktor farklı bir teşhis koyunca tartışma başlıyor. Danışan memnuniyetsiz ayrılıyor, olumsuz yorum yazıyor: 'Doktor beni dinlemedi.' Çözüm: Kovmak değil, ön görüşmede beklenti yönetimi yapmak. Doğru danışanı doğru bilgiyle karşılamak.",
      },
      resultMatrix: [
        {
          minScore: 0,
          maxScore: 999,
          title: "Filtreleme Stratejisi",
          description: "İstemediğiniz danışan profilini tanımladınız.",
          recommendations: [
            "Eğitim Filtresi: Beklenti yönetimi, bilgilendirme içerikleri, ön bilgi paketleri",
            "Uygunluk Sistemi: İlk görüşme, değerlendirme formu, uygunluk kriterleri",
            "Nazik Yönlendirme: Uygun olmayan danışanları alternatif merkezlere yönlendirme"
          ]
        }
      ],
    },

    // ========================================================================
    // AŞAMA 4: HEDEF VE BAŞARI
    // ========================================================================
    {
      intro: {
        script: "Ne istiyoruz? Güvenilirlik mi, hasta hacmi mi, uzmanlık otoritesi mi?",
        stageDescription: "Bu aşama, bu projenin birincil hedefini ve başarı metriklerinizi netleştirir. Güvenilirlik mi, hasta hacmi mi, dijital dönüşüm mü? Hedef belirsizse strateji de belirsiz olur.",
      },
      questions: [
        {
          type: 'selection_list',
          script: "Bu projedeki birincil hedefiniz?",
          text: "Birincil Hedef",
          options: [
            { id: 'trust', title: "Güvenilirlik", desc: "Sağlıkta güvenilir marka algısı oluşturmak" },
            { id: 'volume', title: "Hasta hacmi", desc: "Randevu sayısını ve danışan tabanını büyütmek" },
            { id: 'authority', title: "Uzmanlık otoritesi", desc: "Alanında referans merkez olarak konumlanmak" },
            { id: 'digital', title: "Dijital sağlık", desc: "Online danışmanlık, dijital takip, uzaktan sağlık hizmetleri" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Hedefiniz nedir?"
        },
        {
          type: 'selection_list',
          script: "Büyüme hızı tercihiniz?",
          text: "Büyüme Hızı",
          options: [
            { id: 'aggressive', title: "Agresif", desc: "Hızlı büyüme, çok lokasyon, geniş kitle" },
            { id: 'balanced', title: "Dengeli", desc: "Sürdürülebilir büyüme, kaliteyi koruyarak genişleme" },
            { id: 'selective', title: "Seçici", desc: "Yavaş ama odaklı, niş alanda derinleşme" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Büyüme stratejiniz?"
        },
        {
          type: 'selection_list',
          script: "Başarı sizin için ne demek?",
          text: "Başarı İşareti",
          options: [
            { id: 'satisfaction', title: "Hasta memnuniyeti", desc: "NPS skoru, olumlu geri bildirimler, memnuniyet anketleri" },
            { id: 'occupancy', title: "Randevu doluluk oranı", desc: "Yüksek doluluk, bekleme listesi, talep fazlası" },
            { id: 'referral', title: "Referans oranı", desc: "Hastaların yeni hasta getirmesi, ağızdan ağıza yayılma" },
            { id: 'accreditation', title: "Akreditasyon & ödüller", desc: "JCI, ISO, sektörel ödüller, medyada yer alma" },
            { id: 'retention', title: "Hasta sadakati", desc: "Tekrar ziyaret oranı, uzun vadeli hasta ilişkileri" },
            { id: 'other', title: "Diğer (Belirtin)" }
          ],
          placeholder: "Başarı tanımınız?"
        }
      ],
      educational: {
        script: "Sağlıkta viral olmak bir hedef değil, bir güven testidir.",
        text: "Başarı Tanımı",
        stats: [
          {
            value: "81%",
            label: "Net hedefi olmayan sağlık kuruluşları",
            description: "Sağlık kuruluşu yöneticilerinin %81'i 'hasta hacmi' ve 'kaliteli hizmet' hedeflerini karıştırıyor. Sonuç: belirsiz strateji, kaynak israfı.",
            source: "Kaynak: Becker's Hospital Review, 2023"
          },
          {
            value: "3.8x",
            label: "Net başarı metriği olan klinikler",
            description: "Net başarı metriği tanımlayan sağlık kuruluşları, belirsiz metrikli olanlara göre 3.8 kat daha hızlı büyüyor.",
            source: "Kaynak: Deloitte Health Care Industry Outlook, 2024"
          },
          {
            value: "79%",
            label: "Referansla gelen hastaların sadakati",
            description: "Mevcut hastalardan referansla gelen yeni hastaların %79'u uzun vadeli sadık hasta oluyor. Reklam ile gelenlerde bu oran %23.",
            source: "Kaynak: Journal of Healthcare Marketing, 2024"
          },
          {
            value: "4.2x",
            label: "JCI akreditasyonunun etkisi",
            description: "JCI akreditasyonuna sahip kliniklerin hasta güven skoru, akreditasyonsuz olanlara göre 4.2 kat daha yüksek.",
            source: "Kaynak: Joint Commission International Quality Report, 2023"
          }
        ],
        caseStudy: {
          title: "Headspace — Dijital Sağlıkta Odaklanma",
          summary: "Headspace meditasyon uygulaması olarak başladı. Herkes 'fitness da ekle, beslenme de ekle, uyku da ekle' dedi. Ama Headspace tek bir şeye odaklandı: zihinsel sağlık. 'Meditasyonu herkes için erişilebilir yapmak.' Başarı tanımları net olduğu için, her 'ekle' talebine 'hayır' diyebildiler. Sonuç: 70 milyon kullanıcı, NHS ile ortaklık, bilimsel araştırmalarla desteklenen tek meditasyon markası. Rakipleri (Calm, Insight Timer) özellik eklemeye devam ederken, Headspace derinleşti.",
          outcome: "Sonuç: Başarı tanımınız net olunca, neye 'hayır' diyeceğinizi bilirsiniz. Odaklanma = büyüme.",
          type: 'success'
        },
        scenario: "Karşıt Örnek — Sosyal Medya Tuzağı: Bir klinik 'viral doktor' videoları çekti. Beğeniler patladı, randevu talepleri arttı. Ama operasyon hazır değildi. Bekleme süreleri uzadı, kalite düştü, olumsuz yorumlar arttı. Viral olan şey kliniğin kalitesi değil, sorunu büyüttü. Sağlıkta güven bir kez kırılırsa, geri kazanmak neredeyse imkansız.",
      },
      resultMatrix: [
        {
          minScore: 0,
          maxScore: 999,
          title: "Strateji Modeli",
          description: "Hedef ve başarı tanımınız netleşti.",
          recommendations: [
            "Hacim Motoru: Randevu doluluk, dönüşüm, dijital erişim",
            "Güven İnşası: Hasta memnuniyeti, referans, uzun vadeli sadakat",
            "Otorite Kalesi: Uzmanlık, akreditasyon, bilimsel referans, medya otoritesi"
          ]
        }
      ],
    },
  ],
};
