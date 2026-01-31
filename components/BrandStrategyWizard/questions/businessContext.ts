import { BusinessContextConfig } from '../types';

export const businessContextConfig: BusinessContextConfig = {
  intro: {
    script: "Stratejinizi kişiselleştirmek için işletmenizi biraz tanımamız gerekiyor.",
    text: "Başlamadan önce, işletmeniz hakkında birkaç temel bilgi alalım. Bu bilgiler, yapay zeka analizimizin size özel ve somut öneriler sunmasını sağlayacak.",
  },

  questions: [
    // 1. İşletme Tanımı (ZORUNLU)
    {
      type: 'text_area',
      key: 'businessDescription',
      script: "İşletmenizin sunduğu ana ürün veya hizmeti 1-2 cümleyle anlatın.",
      text: "Ne Yapıyorsunuz?",
      required: true,
      placeholder: "Örn: Kadıköy'de 3 şubeli specialty coffee dükkanı, kendi kavurduğumuz çekirdekle.",
    },

    // 2. Rakip Farkındalığı
    {
      type: 'text_area',
      key: 'competitors',
      script: "Kendinize en yakın gördüğünüz 2-3 rakip veya referans marka var mı?",
      text: "Rakipleriniz",
      required: false,
      placeholder: "Marka isimlerini virgülle ayırın. Bilmiyorsanız boş bırakabilirsiniz.",
    },

    // 3. Coğrafi Kapsam
    {
      type: 'selection_list',
      key: 'geoScope',
      script: "Hedef pazarınız nerede?",
      text: "Coğrafi Kapsam",
      required: false,
      options: [
        { id: 'local', title: "Tek mahalle / semt", desc: "Yürüme mesafesindeki müşteriler" },
        { id: 'city', title: "Tek şehir", desc: "İstanbul, Ankara, İzmir vb." },
        { id: 'multi_city', title: "Birden fazla şehir", desc: "Bölgesel veya çok şehirli" },
        { id: 'national', title: "Türkiye geneli", desc: "Ülke çapında erişim" },
        { id: 'international', title: "Uluslararası", desc: "Yurt dışı pazarları da dahil" },
      ],
    },

    // 4. Dijital Varlık Durumu
    {
      type: 'selection_multi',
      key: 'digitalPresence',
      script: "Şu an hangi dijital platformlarda aktifsiniz?",
      text: "Dijital Varlığınız",
      required: false,
      options: [
        { id: 'instagram', title: "Instagram" },
        { id: 'website', title: "Web Sitesi" },
        { id: 'google_business', title: "Google Business Profile" },
        { id: 'tiktok', title: "TikTok" },
        { id: 'youtube', title: "YouTube" },
        { id: 'none', title: "Hiçbirinde aktif değiliz" },
      ],
    },

    // 5. Instagram Takipçi Aralığı
    {
      type: 'selection_list',
      key: 'instagramFollowers',
      script: "Instagram hesabınızın takipçi aralığı nedir?",
      text: "Instagram Takipçi",
      required: false,
      options: [
        { id: 'no_account', title: "Hesabımız yok" },
        { id: '0_1k', title: "0 - 1.000" },
        { id: '1k_10k', title: "1.000 - 10.000" },
        { id: '10k_50k', title: "10.000 - 50.000" },
        { id: '50k_plus', title: "50.000+" },
      ],
    },

    // 6. Bütçe Aralığı
    {
      type: 'selection_list',
      key: 'monthlyBudget',
      script: "Dijital pazarlama ve içerik üretimi için aylık ayırabileceğiniz bütçe aralığı?",
      text: "Aylık Bütçe",
      required: false,
      options: [
        { id: 'starter', title: "0 - 5.000 TL", desc: "Başlangıç" },
        { id: 'growth', title: "5.000 - 15.000 TL", desc: "Büyüme" },
        { id: 'scale', title: "15.000 - 50.000 TL", desc: "Ölçekleme" },
        { id: 'enterprise', title: "50.000 TL+", desc: "Kurumsal" },
      ],
    },

    // 7. İşletme Aşaması
    {
      type: 'selection_list',
      key: 'businessStage',
      script: "İşletmeniz ne aşamada?",
      text: "İşletme Aşaması",
      required: false,
      options: [
        { id: 'idea', title: "Henüz başlamadım", desc: "Fikir aşaması" },
        { id: 'new', title: "0-1 yıl", desc: "Yeni kuruldu" },
        { id: 'growing', title: "1-3 yıl", desc: "Büyüme aşaması" },
        { id: 'established', title: "3+ yıl", desc: "Yerleşik" },
      ],
    },

    // 8. Tetikleyici Neden
    {
      type: 'selection_list',
      key: 'triggerReason',
      script: "Bu başvuruyu yapmaya sizi ne yönlendirdi?",
      text: "Neden Şimdi?",
      required: false,
      options: [
        { id: 'launch', title: "Yeni açılış / lansman", desc: "Yeni bir işletme veya ürün başlatıyorum" },
        { id: 'sales_drop', title: "Satışlar düşüyor", desc: "Mevcut performans yeterli değil" },
        { id: 'competition', title: "Rakipler öne geçti", desc: "Rekabet baskısı artıyor" },
        { id: 'rebrand', title: "Rebranding / yenilenme", desc: "Mevcut marka kimliğini değiştirmek istiyorum" },
        { id: 'first_digital', title: "Dijitale ilk adım", desc: "İlk kez dijital pazarlamaya giriyorum" },
        { id: 'curious', title: "Merak ettim", desc: "Araştırma aşamasındayım" },
      ],
    },
  ],
};
