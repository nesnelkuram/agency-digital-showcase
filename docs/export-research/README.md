# İhracat araştırması ve e-posta kitlesi

Agency projesi içinde, ABD tekne aksesuarları araştırmasını anlatan Türkçe bir rapor sayfası ve ayrı ihracat ilgi veritabanı.

## Canlı yayın — 11 Eylül 2026

- [Rapor sayfası](https://www.intiba.co.uk/ihracat)
- [İhracat Kitlesi yönetim ekranı](https://www.intiba.co.uk/admin/marketing/export-audience)
- Production deployment: `dpl_6q7CrtdUgy2Bi6JfDLLJBuFe4TZS`, durum: Ready. `www.intiba.co.uk` bu sürüme geçirildi ve alan adı üzerinden doğrulandı.
- Production ortamında `EXPORT_PUBLIC_URL=https://www.intiba.co.uk` tanımlı. Rapor, onay ve izin iptal bağlantıları bu kök adresi kullanır; sayfanın canonical ve sosyal paylaşım adresleri de aynı alan adındadır.
- Mevcut 618 public dosyası değişmeden korundu. Canlı pakette önizlemeye özgü medya yönlendirmesi yoktur.

Alan adı üzerinden sayfa, gizlilik metni, form doğrulaması ve özel PDF indirme kontrol edildi. PDF'nin 137.226 baytlık içeriği orijinal dosyayla birebir eşleşti. Yetkisiz kişi listesi erişimi 401 döndü; yalnızca rapor erişimiyle pazarlama izni verilemedi. Geçici indirme kaydı temizlendi; test e-postası gönderilmedi. Tarayıcıda mobil görünüm, grafik seçimi, isteğe bağlı pazarlama kutusu ve yönetici giriş yönlendirmesi geçti; JavaScript veya ağ hatası görülmedi. Kanıtlar: `production-kontrol.json`, `production-tarayici.json`, `production-yayin.json`.

## Sayfalar

- `/ihracat`: araştırmanın yöntemi, beş koşullu ürün adayı, taşıma başına satış grafiği, alış tavanı senaryo seçicisi ve rapor formu.
- `/ihracat/gizlilik`: bu formun veri kullanımı ve izin açıklaması.
- `/admin/marketing/export-audience`: Agency yönetim panelinde **İhracat Kitlesi**. intiba yöneticileri ve super_admin erişebilir.

Örnek paylaşım bağlantısı:

```text
/ihracat?utm_source=x&utm_medium=social&utm_campaign=tekne_raporu
```

## Form ve kayıt akışı

1. E-posta zorunlu; ad, profil ve ürün/sektör bilgisi isteğe bağlıdır. Aydınlatma metninin okunduğu ayrı kaydedilir. Pazarlama kutusu başlangıçta boş ve isteğe bağlıdır.
2. Sunucu veriyi doğrular, e-postayı normalleştirir ve kaydı `ihracat`, `abd-pazari`, `tekne-aksesuarlari` etiketleriyle tutar. UTM source/medium/campaign bilgisi kaydedilir. Ziyaretçiden form dışında kimlik veya iletişim bilgisi çıkarılmaz; reklam pikseli, çerezli analiz veya parmak izi eklenmedi.
3. Resend, talep edilen rapor için 7 gün geçerli bir indirme bağlantısı gönderir. PDF, `public/` altında bulunmaz; yalnızca geçerli bağlantıyla API üzerinden sunulur.
4. Pazarlama kutusu seçildiyse e-postaya ayrıca tercih doğrulama bağlantısı eklenir. PDF indirmek pazarlama izni vermez. E-postadaki doğrulama sayfasında düğmeye basılması gerekir; bağlantı tarayıcılarının GET istekleri izni değiştirmez.
5. Yönetimde tüm rapor isteyenler ve izin durumları görülebilir. **İzinli listeyi indir** yalnızca e-posta sahipliği ve pazarlama izni doğrulanmış, süresi dolmamış kayıtları CSV olarak çıkarır. Yetki ve izin filtrelemesi sunucuda yapılır.
6. İzin iptal bağlantısındaki düğme kaydı `unsubscribed` yapar. İptalden önce oluşturulan bir doğrulama bağlantısı eski izni yeniden açamaz. Sonraki yeni talep ve yeni doğrulama ile tekrar katılım mümkündür.

Formun tekrar gönderilmesi mevcut kişinin doğrulanmış adını, profilini veya iznini değiştirmez. E-posta aynıysa ikinci bir kişi kaydı oluşmaz. Mevcut izin, doğrulanmamış bir form gönderimiyle geri çekilmez; bunun için e-postadaki kişiye özel iptal bağlantısı kullanılır.

## Gerçek veritabanı

- Firebase projesi: `intiba-ab4bd`
- Ayrı Firestore veritabanı: **`export-audience`**
- Bölge: **`europe-west3` (Frankfurt)**
- Kayıt yolu: `audiences/intiba/contacts`
- Diğer koleksiyonlar: `requests`, `consent_events`, `rate_limits`
- Ana Agency veritabanına otomatik geri dönüş yoktur.
- Tarayıcı SDK’sı ve anonim istemciler için okuma/yazma kapalıdır. API Admin SDK kullanır; kişi listesi mevcut Firebase oturumunu, aktif hesap durumunu, yönetici rolünü ve tenant bilgisini kontrol eder.

[Firebase konsolunda aç](https://console.firebase.google.com/project/intiba-ab4bd/firestore/databases/export-audience/data)

`not_requested`: yalnızca rapor / `pending`: izin için e-posta doğrulaması bekliyor / `subscribed`: izin doğrulandı / `unsubscribed`: izin geri çekildi.

`verifiedAt` rapor bağlantısının kullanıldığını veya tercihin doğrulandığını gösterir. Tek başına pazarlama izni değildir. İzin kaydında metin sürümü, metnin kendisi, talep ve doğrulama/iptal zamanları tutulur. Ham indirme anahtarı veritabanında tutulmaz. İptal anahtarı yetkili sunucu erişimiyle saklanır; ilgili kişiye gönderilen e-postada ve izinli CSV’de kişisel bağlantı olarak yer alır.

## Saklama ve koruma

- Kişi kaydı: 12 ay; yeni doğrulanmış izinle süre yenilenir.
- İzin işlem kaydı: 12 ay.
- Rapor talebi ve indirme bağlantısı: 7 gün.
- İstek sayacı: 2 gün.

Bu dört koleksiyonda Firestore TTL etkinleştirildi. TTL silmesi eşzamansızdır; sorgular ve bağlantılar süre dolduğunda kaydı zaten kullanımdan çıkarır. Silme koruması veritabanı düzeyinde açıktır.

Koruma: JSON ve uzunluk doğrulaması, honeypot, kaynak kontrolü, örnek başına ani istek sınırı ve veritabanı işlemleriyle uygulanan e-posta/IP/günlük gönderim sınırları. IP profillere eklenmez; günlük değişen hash üzerinden kısa ömürlü teknik sayaç tutulur. CSV hücreleri formül enjeksiyonuna karşı kaçırılır. Hata günlüklerinde e-posta, anahtar veya form gövdesi yazılmaz.

## Pazarlama için kullanım

Her gönderim öncesinde güncel izinli CSV alınmalı; daha eski CSV kopyaları iptalleri yansıtmayabilir. CSV’deki kişiye özel iptal bağlantısı gönderilen e-postaya eklenmelidir. Panelden pazarlama kampanyası gönderimi eklenmedi; bu çalışma rapor teslimi ve izinli kitlenin tutulması içindir. Henüz e-posta kutusunda doğrulanmamış kayıtlar pazarlama için kullanılmaz.

## Çalıştırma ve dağıtım

Mevcut Vercel projesi: `v0-intiba-website`. Statik sayfa, Vercel API fonksiyonu ve yönetim paneli aynı projede çalışır.

Mevcut sunucu değişkenleri kullanılır: `FIREBASE_SERVICE_ACCOUNT`, `RESEND_API_KEY`. Gönderen `intiba <info@intiba.co.uk>`; alan adı Resend üzerinde doğrulanmıştır. İsteğe bağlı `EXPORT_PUBLIC_URL` bağlantıların kök adresini değiştirir. Varsayılan canlı adres `https://www.intiba.co.uk`; Vercel önizleme ortamı kendi deployment adresini kullanır.

`npm run dev` statik sayfayı `/ihracat` adresinde açar. API için projenin mevcut `npm run dev:full` / Vercel geliştirme akışı ve sunucu ortam değişkenleri gerekir. Yalnızca Vite açıkken form hata gösterir; kayıt veya e-posta gönderilmiş gibi davranmaz.

```sh
npm run build
npm run test:export
firebase deploy --only firestore --config firebase.export.json --project intiba-ab4bd
```

Test komutu Node 20+ ve Java/Firestore emulator gerektirir; yalnızca `demo-export-research` adlı yerel demo projesinde çalışır. Standalone Firebase CLI’nin macOS’ta farklı Node mimarisi çalıştırma davranışı test çalıştırıcısında ele alındı. Gerçek e-posta gönderimi testlerde kullanılmaz.

## Araştırma içeriği

Kaynak: `ikigai/tekne-aksesuarlari-abd-2026-09-10/` içindeki rapor ve paylaşım görselleri. PDF’nin bir kopyası `private-reports/abd-tekne-aksesuarlari.pdf` altında, Vercel fonksiyon paketine dahil edilir. Görsellerdeki ürün çizimleri temsilidir.

50 ürün ABD genelinde doğrulanmış satış sıralaması değildir. Beş aday kesin alım listesi değildir; üretici teklifleri ve numuneler beklenir. Sayfadaki satış fiyatları ve alış tavanları 10 Eylül 2026 tarihli araştırmanın model varsayımlarıdır. Birim, paket, iade kaybı ve stres senaryosu açıklamaları sayfada yer alır.

## Doğrulama

- 41 test geçti: form doğrulama, API erişim sınırları ve gerçek Firestore emulator üzerinde kayıt/izin/iptal/TTL/sayfalama akışları.
- API TypeScript kontrolü geçti. Vite production derlemesi geçti; mevcut büyük paket uyarıları devam ediyor.
- Repository genelinde değişiklikten önce alınan `tsc --noEmit` çıktısı zaten 2.717 satır hata içeriyordu; tüm projenin tip kontrolünün geçtiği iddia edilmiyor.
- Gerçek ayrı veritabanında izinli sorgu çalıştı; anonim REST okuması HTTP 403 döndü. Dört TTL politikası `ACTIVE` olarak doğrulandı.
- Tarayıcıda 320, 375, 390, 768, 1024 ve 1440 piksel görünümleri; senaryo seçimi; isteğe bağlı pazarlama izni; hata ve başarı durumları; UTM; üretici/sektör form alanları ve gizlilik adresi kontrol edildi. 320 pikseldeki ilk başlık taşması düzeltildi.
- Mevcut desktop ve Köşebaşı çalışma değişiklikleri bu işin dağıtım kopyasına alınmadı.

Uygulama referansları: [Firestore çoklu veritabanı](https://firebase.google.com/docs/firestore/manage-databases), [Resend gönderim API’si](https://resend.com/docs/api-reference/emails/send-email), [Vercel istek başlıkları](https://vercel.com/docs/headers/request-headers), [KVKK açık rızanın kapsamı](https://www.kvkk.gov.tr/Icerik/2037/Acik-Riza-Alirken-Dikkat-Edilecek-Hususlar).

Önizleme ve canlı dağıtım için ayrı kaynak kopyaları kullanıldı. Derlemenin kullanmadığı kök `videos/` orijinalleri bu kopyalardan çıkarıldı. Yalnızca eski önizlemede Ordino’nun büyük medya dosyaları ana site üzerinden çözümlenir; canlı sürüm tüm mevcut public dosyalarını kendi paketinde tutar.

## Önceki önizleme

- [Rapor sayfası](https://v0-intiba-website-4w8olhd8f-info-intibacouks-projects.vercel.app/ihracat)
- [Kayıt paneli](https://v0-intiba-website-4w8olhd8f-info-intibacouks-projects.vercel.app/admin/marketing/export-audience)
- Deployment: `dpl_49qYzGo72ZtMA22WePcLdcvDEog8`, hedef: preview, durum: Ready.
- Dağıtımda Vercel CLI 59.16.0 ve Node 22.22.0 kullanıldı. Canlı yayın için yukarıdaki ayrı production derlemesi kullanıldı.

Gerçek adreste PDF HTTP 200 ile indirildi; 137.226 baytlık dosyanın SHA-256 değeri orijinal raporla eşleşti. Yetkisiz kişi listesi HTTP 401, geçersiz e-posta HTTP 400, yalnızca rapor talebini pazarlama iznine çevirme girişimi HTTP 400 verdi. Geçici indirme test kaydı silindi; gerçek kişilere test e-postası gönderilmedi. Tarayıcıda sayfa, senaryo seçimi, 390 px mobil görünüm, gizlilik sayfası ve yönetici giriş yönlendirmesi geçti; JavaScript veya başarısız ağ isteği kaydedilmedi. Ayrıntılar `canli-kontrol.json` ve `tarayici-yayinda.json` içindedir.
