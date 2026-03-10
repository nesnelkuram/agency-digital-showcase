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
      required: true,
      placeholder: "Marka isimlerini virgülle ayırın.",
    },

    // 3. Coğrafi Kapsam
    {
      type: 'selection_list',
      key: 'geoScope',
      script: "Hedef pazarınız nerede?",
      text: "Coğrafi Kapsam",
      required: true,
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
      required: true,
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
      required: true,
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
      required: true,
      options: [
        { id: 'starter', title: "50.000 - 100.000 TL", desc: "Başlangıç" },
        { id: 'growth', title: "100.000 - 200.000 TL", desc: "Büyüme" },
        { id: 'scale', title: "200.000 - 400.000 TL", desc: "Ölçekleme" },
        { id: 'enterprise', title: "400.000 TL+", desc: "Kurumsal" },
      ],
    },

    // 7. İşletme Aşaması
    {
      type: 'selection_list',
      key: 'businessStage',
      script: "İşletmeniz ne aşamada?",
      text: "İşletme Aşaması",
      required: true,
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
      required: true,
      options: [
        { id: 'launch', title: "Yeni açılış / lansman", desc: "Yeni bir işletme veya ürün başlatıyorum" },
        { id: 'sales_drop', title: "Satışlar düşüyor", desc: "Mevcut performans yeterli değil" },
        { id: 'competition', title: "Rakipler öne geçti", desc: "Rekabet baskısı artıyor" },
        { id: 'rebrand', title: "Rebranding / yenilenme", desc: "Mevcut marka kimliğini değiştirmek istiyorum" },
        { id: 'first_digital', title: "Dijitale ilk adım", desc: "İlk kez dijital pazarlamaya giriyorum" },
        { id: 'curious', title: "Merak ettim", desc: "Araştırma aşamasındayım" },
      ],
    },

    // 9. Marka Varoluş Amacı (Golden Circle — WHY)
    {
      type: 'text_area',
      key: 'brandWhy',
      script: "Para kazanmanın ve başarılı olmanın ötesinde, bu işin sizin için anlamı nedir?",
      text: "Neden Bu İşi Yapıyorsunuz?",
      required: false,
      placeholder: "Örn: İnsanların evlerinde kahve ritüelini yeniden keşfetmelerini istiyorum. Sabah kahvesi bir rutin değil, bir an olmalı.",
    },

    // 10. Müşteri Algısı (Keller Salience + Kapferer Reflection)
    {
      type: 'text_area',
      key: 'customerPerception',
      script: "Müşterileriniz sizi en çok neyle tanımlıyor? Bir Google yorumu veya geri bildirim paylaşabilirsiniz.",
      text: "Müşteri Gözünden Siz",
      required: false,
      placeholder: "Örn: 'Her gittiğimde aynı kalitede kahve içiyorum, barista isimlerimizi biliyor.' veya 'Fiyatları biraz yüksek ama ortam harika.'",
    },

    // 11. Mevcut Marka Varlıkları (Aaker Symbol + Sharp Distinctive Assets)
    {
      type: 'selection_list',
      key: 'existingBrandAssets',
      script: "Mevcut marka kimlik durumunuz nedir?",
      text: "Marka Kimliğiniz",
      required: true,
      options: [
        { id: 'professional', title: "Profesyonel kimlik var", desc: "Logo, renk paleti, marka kılavuzu mevcut" },
        { id: 'basic', title: "Temel düzeyde var", desc: "Logo var ama stil rehberi veya tutarlı kullanım yok" },
        { id: 'none', title: "Henüz yok", desc: "Logo bile yok veya çok amatör" },
      ],
    },

    // 12. Gelecek Vizyonu (Stratejik derinlik)
    {
      type: 'text_area',
      key: 'futureVision',
      script: "3 yıl sonra işletmenizi nerede görmek istiyorsunuz?",
      text: "3 Yıllık Vizyonunuz",
      required: false,
      placeholder: "Örn: İstanbul'da 5 şube, kendi kavurma tesisimiz ve online abonelik modeliyle Türkiye geneline ulaşmak istiyoruz.",
    },

    // 13. Müşterinin Kiraladığı İş — Jobs-to-be-Done (Christensen)
    {
      type: 'text_area',
      key: 'customerJob',
      script: "Müşterileriniz aslında sizden ne iş yapmanızı bekliyor? Ürün ya da hizmetin ötesinde düşünün.",
      text: "Müşteriniz Sizi Ne İçin 'Kiralıyor'?",
      required: false,
      placeholder: "Örn: Sabah enerjisini toplamak için, iş arkadaşlarıyla kaliteli vakit geçirmek için, evde kafe deneyimi yaşamak için.",
    },

    // 14. Müşterinin Mücadelesi — StoryBrand Problem
    {
      type: 'text_area',
      key: 'customerStruggle',
      script: "Müşterileriniz size gelmeden önce ne ile mücadele ediyor? Hangi sorunu çözmeye çalışıyor?",
      text: "Müşterinizin Mücadelesi",
      required: false,
      placeholder: "Örn: Güvenilir kalitede kahve bulmak zor, her yerde aynı zincir markalar var, kişiye özel ilgi gösterilmiyor.",
    },

    // 15. Marka Düşmanı — Cultural Branding (Holt)
    {
      type: 'text_area',
      key: 'brandEnemy',
      script: "Sektörünüzde en çok neye karşısınız? Hangi kötü alışkanlığı veya yanlış anlayışı değiştirmek istiyorsunuz?",
      text: "Neye Karşısınız?",
      required: false,
      placeholder: "Örn: Standart, ruhsuz kahve deneyimine karşıyız. Hızlı tüketim yerine anı yaşamayı savunuyoruz.",
    },

    // 16. Gerçek Alternatif — JTBD (Christensen)
    {
      type: 'text_area',
      key: 'alternativeToUs',
      script: "Siz olmasaydınız müşterileriniz ne yapardı? Gerçek alternatifleriniz neler?",
      text: "Siz Olmasaydınız?",
      required: false,
      placeholder: "Örn: Evde kendi kahvelerini yaparlardı, ya da en yakın Starbucks'a giderlerdi. Belki de kahve içmezlerdi.",
    },
  ],
};
