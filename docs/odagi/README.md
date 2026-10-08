# Odağı — evden e-ticaret operasyonu

Canlı yayın: **https://www.intiba.co.uk/odagi** — 12 Eylül 2026

## İş modeli

Odağı, evinde uygun bir odası ve günlük operasyon için zamanı olan kişilerle küçük e-ticaret markalarını eşleştiren bir depolama ve sipariş hazırlama hizmeti olarak kurgulandı. İlk hedef; kolay saklanan, küçük, standart paketlemeye uygun tekstil, aksesuar, kırtasiye ve küçük ev ürünleri satan markalar. Soğuk zincir, tehlikeli ürünler, yüksek değerli ve özel koşul gerektiren stoklar ilk pilotun dışında.

- **Marka:** ürünleri ve stok bilgisini sağlar; kullanılan alan ve hazırlanan sipariş için ödeme yapar.
- **Alan sahibi:** ürünleri sayarak kabul eder, düzenli saklar, siparişleri paketler ve kararlaştırılan saatlerde kargoya teslim eder.
- **Odağı:** uygunluk kontrolünü, eşleştirmeyi, operasyon standartlarını, mutabakatı ve koordinasyonu yürütür. Marka bedeli ile alan sahibine ödenen bedel arasındaki farktan gelir elde eder.

Kargo, ambalaj, iade, sigorta, zarar ve eksik stok sorumlulukları ayrıca tanımlanır. Sipariş hazırlama bedeline ilk ürün dahil olabilir; ek ürün ve iadeler pilot ölçümlerinden sonra ayrı ücretlendirilir. Başvurular bir işe alım veya gelir garantisi değildir.

## Örnek birim ekonomi — teklif değil, sınanacak varsayım

12 m² alanın tamamen kullanıldığı ve ayda 300 sipariş hazırlandığı senaryo:

| Kalem | Markadan alınan | Alan sahibine ödenen | Odağı farkı |
|---|---:|---:|---:|
| Depolama | 12 × 180 = 2.160 ₺ | 12 × 150 = 1.800 ₺ | 360 ₺ |
| Sipariş hazırlama | 300 × 20 = 6.000 ₺ | 300 × 15 = 4.500 ₺ | 1.500 ₺ |
| Aylık toplam | 8.160 ₺ | 6.300 ₺ | 1.860 ₺ |

Bu tutarlar piyasa fiyatı araştırmasına dayanmayan model varsayımlarıdır. 1.860 ₺ net kâr değildir: koordinasyon, ödeme işlem maliyetleri, müşteri edinimi, hasar karşılığı ve vergiler henüz düşülmemiştir. Alan sahibinin 6.300 ₺ tutarı da giderler ve vergiler öncesidir. Müşterilerden alınacak gerçek teklifler ve paketleme süreleriyle fiyatlar revize edilmeli. Hacim yokken ödeme yükümlülüğü oluşup oluşmayacağı sözleşmede açıkça belirlenmeli; site koşulsuz gelir vadetmez.

## Dört haftalık pilot

1. **İlk hafta:** site içindeki dört adımlı başvuru akışı üzerinden alan başvuruları, İntiba iletişim adresi üzerinden marka talepleri. İlk hedef aynı şehirde 3 uygun oda ve 3 marka adayı; bu sayı gerçekleşmiş ağ büyüklüğü değildir.
2. **İkinci hafta:** alanın görüntülü incelemesi; nem, temizlik, erişim, mülkiyet/kullanım koşulları ve günlük zaman kontrolü. Ürün, kargo şubesi ve sipariş kesim saati eşleştirmesi. Ücret, faturalama, stok sorumluluğu, malzeme ve ödeme takvimini yazılı netleştirme.
3. **Üçüncü hafta:** nokta başına tek marka ve sınırlı SKU ile kontrollü stok girişi. Barkod veya SKU listesi, sayım tutanağı, basit sipariş tablosu; günlük hazırlanmış/teslim edilmiş/istisna listesi. Ekipman ihtiyacı kesinleşmeden alan sahibinden yatırım istenmemesi.
4. **Dördüncü hafta:** süre, maliyet ve kalite ölçümü; olumlu sonuç veren eşleşmelerle devam. Büyümeden önce hata maliyetinin ve iki tarafın emeğinin fiyatlara sığdığını doğrulama.

Pilot başarı ölçütleri (hedef): siparişlerin en az %95'inin kararlaştırılan saatte teslimi, en az %99 doğru ürün/paket, haftalık stok mutabakatı ve her noktada değişken maliyetlerden sonra pozitif katkı. Bunlar hizmet taahhüdü değil, ölçülecek iç hedeflerdir.

## Web arayüzü

- Bağımsız, responsive HTML/CSS/JavaScript sayfası; mevcut React uygulamasını yüklemez.
- İki özgün yapay zekâ fotoğrafı, mobil WebP varyantları ve mevcut yerel TT Commons yazı tipleri.
- İl, ilçe ve m² girildikten sonra başvuru aynı sayfada açılır: iletişim bilgileri, oda koşulları, çalışma planı ve son kontrol. Önceki bilgileri düzeltmek için geri dönülebilir.
- Başvurular `/api/odagi/applications` üzerinden İntiba veritabanına kaydedilir. Kayıt tamamlanmadan başarı gösterilmez. Tamamlanan başvuru için `ODG-…` numarası verilir; Google Form yönlendirmesi veya iframe yoktur.
- Gönderim başarısız olursa bilgiler ekranda korunur. Aynı bilgilerin yeniden gönderilmesi tek kayıt oluşturur. Bilgiler tarayıcının kalıcı depolamasına yazılmaz.
- Başvuru ve iletişim onayı son adımda işaretlenmemiş olarak gelir; pazarlama izni içermez. Veri kullanım açıklaması ve düzeltme/silme iletişim adresi aynı adımda görünür.
- Yetkili İntiba yöneticileri `/admin/odagi/applications` adresinde başvuruları ve tüm cevapları görebilir. Liste 50 kayıtlık sayfalarla yüklenir; arama yalnızca yüklenmiş kayıtlara uygulanır.
- Alan ve sipariş sürgüleri; değiştirilebilir m² ve sipariş bedelleri; brüt tutarın anlık hesabı. Kargo ve ambalajın dahil olmadığı belirtilir.
- Marka görüşme penceresi, marka/şehir/hacim/ihtiyaç bilgilerinden düzenlenebilir bir e-posta taslağı açar. Alıcı mevcut kurumsal adres **info@intiba.co.uk**. E-posta aracı açılmazsa kopyalanabilir taslak sunar; otomatik e-posta gönderimi yoktur.
- Sık sorulan sorular, mobil menü, klavye odağı ve azaltılmış hareket desteği.

### Kaynaklar

- Arayüz: `public/odagi/index.html`, `style.css`, `app.js`, `application.js`
- Başvuru API ve doğrulama: `api/odagi/applications.ts`, `api/_lib/odagiApplications.ts`
- Yönetim sayfası ve alan tanımları: `admin/odagi/OdagiApplicationsPage.tsx`, `shared/types/odagi.ts`
- Görseller: `public/odagi/assets/oda-hero.webp`, `oda-hero-800.webp`, `paketleme.webp`, `paketleme-800.webp`
- Yönlendirmeler: `vercel.json` içinde `/odagi` ve `/odagi/`
- Başlangıçtaki soru kaynağı; yeni akış bu adrese veri göndermez: [kullanıcının paylaştığı Google Form](https://docs.google.com/forms/d/e/1FAIpQLSc1jbOMSKM9mBzOkWn6gQwnA5_GDE9k27y5Cb2SYwmfDAHqcw/viewform)

Yerel arayüz önizlemesi: `python3 -m http.server 4178 --directory public`; ardından http://localhost:4178/odagi/ . Bu statik sunucu API çalıştırmaz. Aşağıdaki tarayıcı testi API yanıtlarını taklit eder. Gerçek başvuru gönderimi, Firebase sunucu ortamı olan Vercel dağıtımında çalışır.

### Kayıt ve erişim

Varsayılan İntiba Firestore veritabanında `odagi_applications` koleksiyonu kullanılır. Başvuru cevapları, sunucu kayıt zamanı, onay metni/sürümü ve başvuru numarası saklanır. İstemcinin UUID işlem kimliği tekrar gönderimleri birleştirir; aynı kimlikle farklı cevaplar eski kaydı değiştiremez.

API, boyut ve alan doğrulaması, kaynak kontrolü, bot tuzağı ve dağıtık gönderim sınırı uygular. E-posta başına günde 5, IP başına saatte 10 yeni kayıt sınırı vardır. Ham IP kaydedilmez. Teknik sayaçlar `odagi_intake_limits` koleksiyonunda özetlenmiş anahtarlarla tutulur; iki günlük süreleri dolduğunda sonraki gönderimlerde sınırlı gruplar halinde temizlenir. Bu mekanizma bir TTL politikası değildir.

Listeleme API’si Firebase oturumunun iptal durumunu, aktif kullanıcı durumunu ve yönetici yetkisini denetler. İntiba `admin` veya `super_admin` yetkisi gerekir. Kimliksiz API ve doğrudan veritabanı okumaları reddedilir. Başvuru API’si e-posta göndermez.

Başvuruları görmek: [Odağı Başvuruları](https://www.intiba.co.uk/admin/odagi/applications). Silme/düzeltme talepleri şu aşamada yetkili operasyon tarafından ele alınır; bu sürümün yönetim sayfası listeleme ve inceleme içindir.

## Görsel üretimi

Yerleşik **image_gen** aracı kullanıldı; API/CLI alternatifi kullanılmadı. PNG orijinalleri Codex generated_images dizininde korundu. Proje içindeki WebP dosyaları cwebp ile sıkıştırıldı; içerik değiştirilmedi. Görseller temsili olup gerçek bir katılımcıyı veya çalışan operasyonu belgelemiyor.

### Ana fotoğrafın tam üretim promptu

Use case: photorealistic-natural. Asset type: large editorial hero photograph for a Turkish home-based e-commerce fulfillment startup website. Primary request: A real, modest but beautifully organized spare room in a sunlit Istanbul apartment has been turned into a small order packing workspace. A Turkish-looking woman around 32, dark brown hair loosely tied, wearing a warm cream linen shirt and blue jeans, is calmly folding kraft paper around a small unbranded package at a light oak packing table. Behind her, natural birch wood open shelves hold a modest number of small kraft cardboard boxes, folded neutral textiles and organized off-white storage bins. Tall window, sheer linen curtains, one green plant, warm cream walls, everyday lived-in touches, credible small business at home. Style: premium candid lifestyle editorial photography, realistic human skin and hands, subtle analog grain, natural sun and soft shadows, earthy green, cream, oak, kraft palette. Composition: horizontal landscape 3:2, environmental portrait, camera looking into the room from its doorway, show the entire welcoming room, woman slightly right of center with shelves visible. Table and packing action are clearly visible. No visible text, labels with lettering, logos, watermarks, computer generated look, extravagant warehouse or luxury styling. This is a photograph only, no website layout or typography.

### Paketleme fotoğrafının tam üretim promptu

Use case: photorealistic-natural. Asset type: editorial detail photograph for a home-based e-commerce packing service website. Primary request: Close-up candid scene of two realistic hands carefully wrapping a folded oatmeal-colored cotton T-shirt in cream tissue paper inside a small open kraft cardboard shipping box on a clean light oak table in a sunny apartment spare room. To one side there is a roll of kraft paper packing tape, one ready-to-ship closed kraft box, and simple small scissors laid safely flat. Background is softly out of focus with wooden shelves containing a few organized packages and a leafy plant, cream walls. Style: premium natural lifestyle editorial photography, tangible paper fiber and textile texture, gentle late-afternoon window light, subtle photographic grain, warm neutral colors and muted forest green detail. Composition: horizontal landscape 3:2, close crop showing hands and real packing process from an elevated 45-degree angle. No visible lettering or logo or watermark, no fake text, no interface, no illustration, accurate anatomy. Welcoming, thoughtful, practical and realistic small home business.

## Yayın ve doğrulama

Yeni site içi başvuru sürümü `dpl_FPK9fbhYs6uPQphGpUxYJGJtoMvv`, mevcut Vercel projesi `v0-intiba-website` üzerinde READY durumunda yayınlandı ve İntiba alan adına geçirildi. Önceki canlı sürüm `dpl_CGyp9qnnR5UBbuR779XdXq37kn5b`. Yayın ve canlı kontrol sonucu `deployment.json` dosyasında kayıtlıdır.

Dağıtım, önceki canlı kaynak kopyası üzerine başvuru arayüzü, API, alan tanımları, yönetim sayfası ve iki yönetim bağlantısı eklenerek hazırlanmıştır. Toplam 10 kaynak dosyası değişmiştir. Vercel ayarları mevcut production sürümüyle aynıdır; çalışma klasöründeki diğer bekleyen değişiklikler dağıtıma alınmamıştır.

- API, yetki, doğrulama ve gerçek Firestore emülatörü testleri: 2 dosyada 36 test geçti.
- API ve yeni yönetim sayfasının hedefli TypeScript kontrolleri ile yönetim sayfasının esbuild derlemesi geçti.
- Dört başvuru adımı, hata ve başarı ekranları 320, 390, 768 ve 1440 pikselde yatay taşma olmadan doğrulandı.
- axe WCAG 2 A/AA ve 2.1 AA otomatik taramasında altı form durumu, mobil ve masaüstünde ihlalsiz geçti. Bu, bağımsız erişilebilirlik sertifikasyonu değildir.
- Zorunlu alanlar, seçim tutarlılığı, geri dönüşte veri koruma, son kontrol, metinlerin güvenli gösterimi, işaretlenmemiş onay, sunucu hatası, tekrar deneme ve çift gönderim kontrol edildi.
- Canlı veritabanı bağlantısı ve liste sorgusu doğrulandı; kimliksiz doğrudan listeleme HTTP 403 döndü.
- Gerçek kayıt doğrulaması yalnızca benzersiz `example.invalid` e-postalı sentetik başvuruyla yapılır. Test kendi kaydını ve e-posta sayacını işlem sonunda siler. E-posta gönderilmez. Sonuç `native-runtime.json` dosyasındadır.

Güncel kanıtlar: `native-preflight.json`, `native-browser-local.json`, `native-browser-production.json`, `native-runtime.json`, `native-http.json`, `native-admin-access.json`, `native-tests.json`, `deployment.json`. Eski `google-prefill.json` ve ilk yayın raporları önceki Google Form bağlantılı sürümün tarihsel kayıtlarıdır; güncel davranışı tanımlamaz.

Tarayıcı kontrolü: `ODAGI_TEST_BASE=https://www.intiba.co.uk node docs/odagi/native-browser-check.cjs`. API yakalanır; gerçek başvuru gönderilmez. Playwright, axe ve sistem Chrome mevcut Dome projesinden kullanılır.

Gerçek kayıt doğrulaması açık seçim gerektirir: `ODAGI_REAL_SUBMISSION_TEST=1 ODAGI_TEST_BASE=https://www.intiba.co.uk node docs/odagi/verify-production-intake.cjs`. Yerel `.env.vercel-pulled` sunucu kimliği yalnızca veritabanı doğrulaması ve tam olarak testin oluşturduğu kaydın temizlenmesi için kullanılır; çıktıya yazılmaz.
