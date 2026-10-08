# Köşebaşı — Strateji & yaratıcı dünya

Sunum adresi: https://www.intiba.co.uk/kosebasi/strateji/

Bu çalışma, marka stratejisini sinematik bir showcase ve etkileşimli strateji haritası olarak sunar. Mevcut `/kosebasi/index.html` teklifi ve yerel `/kosebasi/cati-hikaye/` çalışması değiştirilmemiştir. Bir bitmiş iş / onaylanmış kampanya / operasyonel başarı iddiası değildir.

## İçerik dayanakları

- `../Dieci/Kosebasi_Ortak_Marka_Calismasi.md`, özellikle 11.6 mutabakatı: Köşebaşı Usulü, Önce Dinleyen Usta, üç mesaj sütunu, deneyimde üç seçim hakkı, doğrulama ve pilot gereği.
- `public/kosebasi/cati-hikaye/index.html`: “Bir sofranın etrafında” çatı hikâyesi, üç içerik serisi ve merkezden ağa ortak içerik yaklaşımı.
- Kullanıcının ustalık / yeniden güven / istikrarlı kalite yönlendirmesi.
- “Ustalığın bir usulü var”, “El bilir. Usul yaşatır.” ve diğer yaratıcı cümleler sunum önerileridir; marka tarafından onaylanmış sloganlar olarak sunulmaz.

Araştırmanın müşteri yorumları, tartışma dökümü, eleştirel iç notları, fiyatlandırması ve doğrulanmamış miras/şube sayısı iddiaları bu sayfaya aktarılmadı. Sayfa `noindex,nofollow` taşır; bu bir erişim kısıtlaması değildir, bağlantıyı bilen herkes açabilir.

## Film ve kesitler

Kaynak: Kullanıcının sağladığı `/Users/intiba/Downloads/beko (1).mp4`, 25,4 saniye, 1920 × 1080. Görseller bu videodan çıkarılmıştır; yeni görsel üretilmemiştir.

| Kullanım | Kaynak zaman aralığı | Anlatı |
|---|---|---|
| Giriş döngüsü | 00:13–00:24,5 | Ocak, usta, servis, sofra |
| Ustalık | 00:11–00:15,2 | Fırın, hazırlık, ateş |
| Ürün | 00:04–00:07,5 | Meze ve ortaya gelen tabaklar |
| Buluşma | 00:15,3–00:17,6 | Ocakbaşı ve misafir |
| İsteğe bağlı film | Tam film | Yerel oynatıcı, ses kullanıcı etkileşimiyle |

Arka plan döngüleri sessizdir. Videonun gömülü siyah bantları 36 px üst / alt kırpılarak temizlendi. Ana döngü 1440 px, diğer döngüler 960 px genişliğinde; tam film 1280 px. Posterler ve kapanış karesi aynı kaynaktan gelir.

## Teknik yapı

- Sayfa: `public/kosebasi/strateji/` altında bağımsız HTML/CSS/JS. Ana React uygulaması veya yönetim/Firebase paketleri yüklenmez.
- Three.js kaynağı: `scripts/kosebasi/scene.js`. Üretilen yerel modül: `scene.bundle.js`; yalnızca harita yaklaştığında yüklenir.
- Harita metinleri ve düğmeleri HTML'dir. WebGL kullanılamadığında CSS yörüngesi ve bütün etkileşimler çalışmaya devam eder.
- Videolar görünür olduklarında yüklenir/oynar, ekran dışında ve sekme gizliyken durur. Film açıldığında arka plan döngüleri durur.
- Azaltılmış hareket ve veri tasarrufu tercihlerinde otomatik video/Three.js başlatılmaz. Kullanıcı ayrıca hareketi durdurabilir.
- JavaScript olmadan stratejinin altı açıklaması da okunur.
- Yerel fontlar: projedeki TT Ramillas ve TT Commons dosyaları.
- Vercel'e iki dar kapsamlı rewrite eklendi; yerel Vite'a aynı sayfaya özgü middleware eklendi. Mutlak varlık yolları slash ve slash olmayan adreslerde çalışır; bölüm bağlantıları yeniden sayfa yüklemeden kaydırır.

## Yeniden üretim ve test

```sh
node scripts/kosebasi/prepare-media.mjs '/absolute/path/to/source.mp4'
node scripts/build-kosebasi-showcase.mjs
npm run dev -- --host 127.0.0.1 --port 4197
node scripts/kosebasi/verify-showcase.mjs
npm run build
```

Test betiği bu makinedeki mevcut Playwright kurulumunu kullanır. Başka ortamda `PLAYWRIGHT_MODULE` ile kurulu Playwright `index.mjs` yolunu belirtin. Canlı test için `KOSEBASI_TEST_BASE`, rapor/screenshot dizini için `KOSEBASI_TEST_OUTPUT` kullanılabilir. Test salt okunurdur; form göndermez, veritabanına yazmaz.

Kontroller: üç URL biçimi, video başlat/durdur, film penceresi/Escape/odak iadesi, altı harita katmanı, ok tuşları/Home, 320–1440 px taşma, mobil menü, görsel yükleme, azaltılmış hareket, JavaScript'siz okuma, Three.js yüklenemediğinde yedek görünüm, tarayıcı hataları.

## Yalıtılmış yayın

Çalışma ağacında bu işle ilgisiz bekleyen değişiklikler vardı. `scripts/kosebasi/stage-production.mjs` mevcut canlı dağıtımın kaynak SHA manifestini kullanır; yalnızca yeni showcase dosyalarını ve üretim `vercel.json` dosyasına iki route eklemesini taşır. Diğer 1614 mevcut kaynak dosyası aynen korunur.

Betik varsayılan olarak salt okunur yayın planı çıkarır; `--stage` ile **henüz alan adına atanmayan**, üretim ortam değişkenlerini kullanan aday dağıtım oluşturur. Canlı temel dağıtım değişmişse otomatik durur. Yayın bilgileri `deployment.json` içindedir. Aday test edildikten sonra Vercel promote işlemiyle canlıya alınır. Bu betik genel amaçlı tekrar-yayın komutu değildir; yeni yayında temel dağıtım ve kapsam yeniden gözden geçirilmelidir.
