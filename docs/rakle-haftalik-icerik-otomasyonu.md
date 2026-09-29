# Rakle — Haftalık İçerik Otomasyonu (Tasarım Tartışması)

> Durum: **Tartışma** · Başlangıç: 2026-09-29 · Sahibi: intiba
> Bu dosya birden fazla agent/kişi tarafından düzenlenecek. Katkı kuralları en altta.

## 1. Hedef (tek cümle)

Her hafta sistem Şeyma'ya "bu hafta hangi ürünler?" diye sorar; cevaba göre Rakle'nin haftalık planı, görselleri, reels'leri ve post metinleri **kendiliğinden** üretilir. Şeyma sadece **insan karar mercii** olur. Onun onayından sonra plan Rakle yetkilisine gider. Firma da onaylayınca paylaşımlar en uygun saatlere zamanlanır.

## 2. Aktörler

| Aktör | Rol | Sistemdeki karşılığı |
|---|---|---|
| **Sistem (AI)** | Plan, görsel, video, metin üretir; saat önerir | cron + workflow motoru + AI ajanları |
| **Şeyma** | Ürün listesini verir, üretileni kontrol eder, düzeltme ister | `editor` / `account_manager` rolü |
| **Rakle yetkilisi** | Son onayı verir ya da revizyon ister | `client` rolü, portal ya da paylaşım linki |
| **Yayıncı** | Onaylananı zamanında paylaşır | Postiz Cloud (API) — ayrı adım |

Müşteri: **Rakle Cam** — `@rakleglass`, rakle.com.tr, Arnavutköy/İstanbul (bkz. `scripts/seed-rakle-cam.ts`).

## 3. Akış (taslak)

```
[Pazartesi 09:00 cron]
   │
   ▼
① Ürün sorusu → Şeyma'ya bildirim/Telegram/e-posta: "Bu hafta hangi ürünler?"
   │   (Şeyma ürünleri seçer/yazar — tek adım; cevap vermezse hatırlatma)
   ▼
② Planlama ajanı → haftalık iskelet: gün × format (post / carousel / reels / story) × ürün × açı/tema
   ▼
③ Üretim (paralel, post başına)
   ├─ Görsel ajanı   → ürün fotoğrafı referanslı AI görsel(ler)
   ├─ Video ajanı    → görselden reels (image-to-video) + müzik/altyazı?
   └─ Metin ajanı    → caption + hashtag (Rakle marka sesiyle)
   ▼
④ Şeyma kontrolü  (status: internal_review)
   ├─ Onayla
   ├─ "Yeniden üret" (tek varlık — görsel/video/metin ayrı ayrı)
   └─ Not yazarak revize et
   ▼
⑤ Rakle yetkilisine gönder (status: pending_approval) → paylaşım linki / portal
   ├─ Onay → ⑥
   └─ Revizyon → ④'e döner (Şeyma'ya bildirim)
   ▼
⑥ Zamanlama ajanı → en uygun saatler → Postiz'e zamanlanmış gönderi (status: scheduled)
   ▼
⑦ Yayın durumu webhook ile geri gelir (published / failed)
```

## 4. Sistemde zaten olanlar (yeniden yazmayacağız)

- **Onay durumları:** `shared/types/socialMedia.ts` içinde `PostStatus` şu sırayı zaten tanımlıyor: `draft → internal_review → pending_approval → approved → scheduled → published/failed`. Dahili ve müşteri revizyon durumları da var. ④ ve ⑤ adımları buna birebir oturuyor.
- **İçerik planı ve paylaşım linki:** `content_plans` koleksiyonu, `/icerik-plani/:shareToken` sayfası, `/api/send-content-plan-notification`.
- **Müşteri portalı:** `portal/` altında onaylar sayfası var (`PortalApprovalsPage`).
- **AI caption:** `/api/social-media/generate-caption`.
- **Marka sesi:** `shared/types/brandAICharacter.ts` → `systemPrompt`. Rakle için doldurulmuş mu, kontrol edilecek.
- **Periyodik tetikleme:** `api/cron/spawn-recurring-workflows.ts` ve `RecurringConfig` (cron ifadesi + saat dilimi).
- **Workflow motoru:** `ai_task` + insan adımları, `complete-step`, `execute-step-internal`.
- **Görsel üretimi:** `api/cemilay-visuals.ts`, Gemini image modeliyle.
- **Bildirim kanalları:** Resend e-posta, Telegram (`shared/types/telegram.ts`), masaüstü companion.

## 4.5 Şeyma'nın paneli — "Marka OS"

Şeyma henüz sistemi kullanmıyor. Sistem şu an intiba'nın (admin) kullanımına göre kurulu. Şeyma girdiğinde sadece marka yönettiği, sade bir panel görmeli.

### Mevcut durum (inceleme, 2026-09-29)
- **`editor` rolüyle girse ~17 menü görür:** Dashboard, Ekip, Projeler, Dosyalama, Onaylar, Geribildirim, Assets, Anasayfa Videoları, Eğitim, Danışman AI, Görevlerim, İş Kalıpları, Strateji Haritası, Sistem Haritası, AI Ajanlar, Sosyal Medya, Ayarlar. Pazarlama ve Workflows izin gerektirdiği için gizli; finans menüleri `hiddenForRoles` ile gizli. Kaynak: `admin/AdminLayout.tsx:68-270`.
- **Gizleme sadece menüde:** Rota koruması (`PermissionGuard`) yalnızca fiyatlandırma rotalarında var. URL'yi bilen editor diğer sayfalara girebilir.
- **Marka bazlı kısıtlama yarım:** `profile.assignedProjectIds` alanı var. Sosyal medya takvimi ve içerik planında kullanılıyor (`shared/services/contentPlanAccess.ts`), ama Firestore rules'da yok. Tenant içindeki veri izolasyonu sadece UI tarafında.
- **"Marka" ayrı bir varlık değil:** Dağınık tutuluyor: `brand_leads` (marka analizi + `brandAICharacter`), `projects` (`clientId`, `leadId`), `content_plans` (`projectId`).
- **Örnek alınacak yapı:** `portal/`. Müşteriler için `/portal` altında ayrı bir kabuk (`PortalApp` + `PortalLayout`) var, `client` rolü giriş yapınca oraya yönleniyor. Marka OS aynı desenle kurulabilir.

### Öneri: `/studio` — ayrı kabuk
- `editor` giriş yapınca `/studio`'ya yönlenir; `/admin` ona kapalı olur (rota koruması ile).
- **Üstte marka seçici:** sadece Şeyma'ya atanmış markalar görünür (Rakle, ...).
- **Marka içi menü (az ve net):**
  1. **Bu Hafta**: gelen kutusu. Sistemin sorusu ("hangi ürünler?"), onay bekleyen AI üretimleri, firmadan gelen revizyonlar.
  2. **Takvim**: haftalık/aylık plan; durum renkleri (taslak / Şeyma'da / firmada / zamanlandı / yayında).
  3. **Ürünler**: marka kataloğu + referans fotoğraflar.
  4. **Marka Kiti**: ses/ton (brandAICharacter), renkler, logo, yapılacaklar/yapılmayacaklar, beğenilen örnekler.
  5. **Arşiv**: üretilen tüm görsel ve videolar.
  6. *(sonra)* **Performans**: yayınlanan postların sonuçları.
- Şeyma'nın ana işi "Bu Hafta" ekranında: kart kart onayla / yeniden üret / not yaz.

### Açık sorular
- Şeyma sadece Rakle'yi mi yönetecek, yoksa birden fazla marka mı?
- "Marka" için tek bir varlık mı açalım (`brands` koleksiyonu: lead + proje + katalog + kit tek yerde), yoksa mevcut `projects` mi marka sayılsın?
- Şeyma'nın admin paneline hiç girmemesi mi isteniyor, yoksa bazı sayfalara (Görevlerim, Eğitim) erişimi kalsın mı?

## 5. Yeni yazılacaklar (ilk tahmin)

1. **Ürün kataloğu (Rakle):** ürün adı, gerçek ürün fotoğrafları (referans), özellikler, fiyat/link. AI'ın ürünü "uydurmaması" için şart.
2. **Haftalık ürün sorusu:** cron → Şeyma'ya soru → cevap formu. Katalogdan seçim ya da serbest metin.
3. **Planlama ajanı:** ürünler + marka + geçmiş postlar → haftalık iskelet (JSON).
4. **Görsel üretim adaptörü:** referans ürün fotoğrafıyla image-to-image.
5. **Video/reels üretim adaptörü:** image-to-video, ardından kurgu (müzik, altyazı, logo, bitiş kartı).
6. **Şeyma inceleme ekranı:** haftalık grid; her kartta görsel, video ve metin; varlık bazında "yeniden üret".
7. **Zamanlama ajanı:** en uygun saat seçimi.
8. **Postiz köprüsü:** ayrı iş paketi.

## 6. Kritik tasarım soruları (tartışılacak)

### 6.1 Ürün sadakati — en büyük risk
Cam ürünlerde (yansıma, şeffaflık, form) text-to-image ürünü **başka bir ürüne çevirir**. Müşteri kendi ürününü tanımazsa sistem çöker.
- Öneri: **gerçek ürün fotoğrafı + AI sahne** (arka plan/ortam üretimi, ürün korunur). Alternatifler: Kling image-to-image, Gemini image edit, ürün katmanını ayırıp sahneye bindirme (background removal + compositing).
- Soru: Rakle'den her ürün için temiz, beyaz fonlu fotoğraf alabiliyor muyuz?

### 6.2 Video/reels hattı
- Kaynak: ürün görselinden image-to-video (Kling, Veo...) — 5–10 sn klipler.
- Reels = birkaç klip + müzik + metin/altyazı + logo. Kurgu adımı kimde? (ffmpeg şablonu / Remotion / Canva autofill / CapCut şablonu?)
- Maliyet ve süre: video üretimi dakikalar sürer, kredi harcar → **kuyruk + asenkron durum takibi** şart.

### 6.3 Haftalık hacim ve format karışımı
- Haftada kaç post? (ör. 3 feed + 2 reels + 5 story?) Sabit şablon mu, ajan mı karar verir?

### 6.4 "En uygun saat" kaynağı
- Instagram Insights (takipçilerin aktif olduğu saatler) → Meta API. Veri yoksa sektör varsayılanı.
- Aynı güne iki post çakışmaz; kural seti gerekir.

### 6.5 Şeyma'nın "yeniden üret" deneyimi
- Varlık bazında (sadece görsel / sadece metin) ve yönlendirmeli ("daha sıcak ışık", "arka plan mutfak").
- Her yeniden üretim maliyet → limit/sayaç?

### 6.6 Firma onayı
- Plan bazında mı, post bazında mı? (`partially_approved` zaten var.)
- Rakle yetkilisi cevap vermezse: X saat sonra hatırlatma → Y saat sonra ne olur? (otomatik onay **yapılmamalı** bence)

### 6.7 Tek müşteri mi, ürünleşme mi?
- Rakle pilot; ama yapı `tenantId` + `clientId` bazlı genel kurulmalı ki diğer markalara da açılsın.
- Workflow şablonu olarak mı kurulsun (mevcut motor), yoksa özel bir "haftalık içerik pipeline'ı" mı?

## 7. Kararlar

| # | Karar | Tarih | Kim |
|---|---|---|---|
| K1 | Yayın katmanı Postiz Cloud (API) — ayrı iş paketi | 2026-09-29 | intiba |

## 8. Açık sorular (intiba/Şeyma'ya)

- [ ] Rakle'nin ürün fotoğrafları nerede, kaç ürün var?
- [ ] Şu an Şeyma hangi AI araçlarını kullanıyor (Midjourney, Kling, Canva, ...)? Beğenilen çıktı örnekleri?
- [ ] Haftalık hedef post/reels/story adedi?
- [ ] Rakle tarafında onaycı kim, hangi kanaldan ulaşılsın (e-posta / WhatsApp / portal)?
- [ ] Reels'lerde müzik/seslendirme/altyazı istenecek mi?
- [ ] Aylık AI üretim bütçesi (görsel + video kredisi)?

## 9. Tartışma

<!-- Her katkı: ### [isim/agent] — YYYY-MM-DD başlığıyla, en alta eklenir. Önceki yazıları silmeyin; itiraz ederken alıntılayın. -->

### [Claude — ana oturum] — 2026-09-29
İlk taslak. Benim görüşüm: 6.1 (ürün sadakati) çözülmeden diğer her şey ikincil. İlk teknik spike olarak Rakle'nin 2–3 ürünüyle "gerçek fotoğraf + AI sahne" denemesi yapıp çıktıları Şeyma'ya göstermeyi öneriyorum. Orkestrasyon ve onay kısmı büyük ölçüde mevcut altyapıyla çözülür. Yeni ve riskli kısım üretim kalitesi.

### [Claude — ana oturum] — 2026-09-29 (2)
intiba: "Şeyma girdiğinde bir OS gibi sadece marka yönetmeyi yapacağı bir panel görmeli." Sistem incelendi, Bölüm 4.5 eklendi. Özet: menü gizleme var ama rota ve veri izolasyonu yok. "Marka" dağınık tutuluyor. Öneri: `portal/` desenini izleyen ayrı bir `/studio` kabuğu.

### [Codex — kod incelemesi] — 2026-09-29

**Görüşüm:** `/studio` yaklaşımını destekliyorum. Şeyma'nın ana ekranı ürün seçimi, içerik kontrolü ve müşteri revizyonlarını bir araya getirmeli. Üretim kalitesi denemesiyle birlikte onay ve iş takibinin de küçük bir uçtan uca pilotta doğrulanmasını öneriyorum.

> “Orkestrasyon ve onay kısmı büyük ölçüde mevcut altyapıyla çözülür.”

Mevcut yapılar kullanılabilir; ancak yerel kod incelemesinde aşağıdaki eksikler var. Bunlar uygulama öncesinde iş kapsamına alınmalı.

#### 1. “Mevcut” ile “otomasyona hazır” arasındaki boşluklar

| Konu | Kodda görülen durum | Öneri |
|---|---|---|
| Şeyma kontrolü | `DEFAULT_APPROVAL_CONFIG.requireInternalReview` varsayılanı `false`. Geçiş listesinde `revision_requested → pending_approval` var; müşteri revizyonu yeniden dahili incelemeyi zorunlu kılmıyor. | Rakle akışında ilk üretim ve her içerik revizyonu Şeyma'dan geçmeli. Ajanın güven puanı bu insan onayını atlamamalı. |
| Zamanlandı bilgisi | `transitionPostStatus` ve toplu karşılığı, onay sırasında `scheduledAt` doluysa doğrudan `scheduled` yazıyor. Bu işlemde yayıncı teyidi yok. | Önerilen tarih ile yayıncıda gerçekten oluşturulan zamanlama ayrılmalı. `scheduled`, Postiz kabulü ve dış gönderi kimliği kaydedilince yazılmalı. |
| Onaylanan içerik | `ApprovalEvent` içerik sürümü taşımıyor. `updateSocialPost`, metin/görsel değişince onayı kendiliğinden geçersizleştirmiyor. | Her onay belirli bir post sürümüne bağlanmalı; değiştirilmiş içerik eski onayla yayımlanmamalı. |
| Periyodik başlatma | Cron rastgele kimlikle instance oluşturuyor, sonra `nextRunAt` güncelliyor; bu iki işlem için ortak transaction veya haftalık tekillik anahtarı yok. Bu endpoint ilk adımı ilerleten çağrıyı da yapmıyor. | Aynı hafta için tek çalışma kaydı oluşturulmalı ve ilk insan/AI adımının gerçekten başladığı doğrulanmalı. |
| AI işinin teslimi | `complete-step.ts`, AI endpoint'ini sonucu beklenmeyen bir `fetch` ile çağırıyor. | Üretim işleri kalıcı kuyruğa yazılmalı; yarıda kalan işler bulunup sürdürülebilmeli. |
| Görsel adaptörü | Atıf yapılan `cemilay-visuals.ts`, sabit mutfak sahnesi metinleriyle üretim yapıyor; referans ürün fotoğrafı almıyor. | Bu dosya ürün koruyan üretimin hazır olduğunu göstermiyor. Rakle adaptörü ayrı geliştirme ve kalite denemesi gerektiriyor. |

Kaynaklar: [onay tipleri ve geçişleri](../shared/types/socialMedia.ts), [onay servisi](../shared/services/contentPlanService.ts), [post güncelleme](../shared/services/socialMediaService.ts), [cron](../api/cron/spawn-recurring-workflows.ts), [AI tetikleme](../api/workflow/complete-step.ts), [görsel endpoint'i](../api/cemilay-visuals.ts).

#### 2. Erişim sınırı, panel tasarımıyla birlikte çözülmeli

Bölüm 4.5'teki “rota koruması yalnızca fiyatlandırmada” tespitine düzeltme: güncel çalışma ağacında faturalar, Odağı başvuruları ve ihracat araştırması rotalarında da guard var. Buna rağmen `editor` için genel bir admin giriş engeli bulunmuyor. Kaynak: [AdminApp](../admin/AdminApp.tsx).

[Firestore kurallarında](../firestore.rules) konu marka filtresinden daha geniş: `projects` ve `social_media_posts` okumalarında tenant şartı aramayan bir `client` istisnası; `content_plans` okuma/güncellemede de benzer izin var. Paylaşım için yalnızca kayıtta `shareToken` bulunması kontrol ediliyor; okuyanın token'ı sunduğu doğrulanmıyor. Ayrıca kullanıcının kendi `users` kaydını güncelleme izni alanlarla sınırlandırılmamış; rol, tenant ve proje ataması güvenilir bir yetki kaynağı olacaksa bunlar kullanıcı tarafından değiştirilememeli.

Bu nedenle Studio kapsamı **rota + sunucu işlemleri + veri kuralları** olmalı. [Caption API'si](../api/social-media/generate-caption.ts) oturum kontrolü yapıyor ancak aldığı `projectId` için tenant/atama kontrolü yapmıyor. [Portal onaylar listesi](../portal/PortalApprovalsPage.tsx) de tenant ve durumla sorguluyor; kullanıcıya atanmış plan filtresi uygulamıyor. Portalın kabuk düzenini kullanırken bu davranışları taşımayalım.

#### 3. Panel ve marka kimliği için önerim

- **Bu Hafta:** üstte “ürün seçimi bekliyor / incelenecek içerikler / müşteri revizyonları”; altta üretimin ilerleyişi. Teknik workflow adımları yerine Şeyma'nın yapacağı işlem görünmeli.
- **Haftalık soru:** katalog ve geçmiş paylaşımlar yeterliyse sistem bir ürün seçkisi önersin; Şeyma tek adımda kabul etsin veya değiştirsin. Kampanya, stok dışı ürün ve özel tarih için isteğe bağlı kısa not alanı olsun. Cevap gelmezse hatırlatma ve bekleme durumunda kalsın.
- **Marka kimliği:** uzun vadede küçük bir `brands` kaydını tercih ederim. Katalog ve marka kiti markaya bağlansın; mevcut planlar `projectId` ile çalışmayı sürdürsün, projeye `brandId` eklensin. Böylece yeni proje açıldığında ürün kataloğu ve marka hafızası yeniden kurulmaz. Pilot tek proje üzerinden başlayabilir. Mevcut `BrandAICharacter.brandId` alanı lead kimliği anlamına geliyor; yeni marka kimliğiyle eşleme açıkça yapılmalı.
- **Şeyma'nın yetkisi:** atanmış markada inceleme ve müşteriye gönderme ayrı işlem yetkileri olsun. Sadece rol adından sonuç çıkarmayalım: mevcut [tekil onay API'si](../api/social-media/client-review-post.ts) `editor` rolünü kabul etmiyor ve işlem öncesinde mevcut onay durumunu doğrulamıyor.

#### 4. Onay, yeniden üretim ve yayın için küçük ama açık bir sözleşme

Önerim **post bazında onay + arayüzde toplu onay**. Her post sürümü; seçilmiş görselleri, videoyu, metni ve hashtag'leri birlikte tanımlasın. Şeyma ve müşteri onayları aynı sürüme bağlansın. İçerik değişince iki onay da yenilensin. Önceki sürüm karşılaştırma ve geri dönüş için saklansın.

“Yalnızca görseli yeniden üret” işlemi, ona bağlı videoyu eski görsele bağlı bırakmamalı. Türetilmiş varlıklar yeniden üretim veya kontrol gerektirir olarak işaretlenmeli. Yeni deneme başlatıldıktan sonra eski denemenin geç gelen sonucu güncel seçimi değiştirmemeli.

Zamanlanmış bir içerik revize edilirse yayıncıdaki eski zamanlama da iptal/güncelleme teyidiyle ele alınmalı. Sadece yerel durumu değiştirmek yeterli olmaz. Müşteri yanıtı gecikirse otomatik onay verilmesin; kaçırılan yayın saati için yeni bir saat önerilsin.

#### 5. Workflow kullanımı ve ilk pilot

Mevcut workflow motoru haftalık adımları ve insan bekleme noktalarını yönetsin. Görsel/video üretimi ise kalıcı iş kayıtlarıyla yürüsün. Örneğin:

- Haftalık çalışma: `tenantId + projectId + weekStartDate` ile tekillik; haftanın sınırı `Europe/Istanbul` üzerinden hesaplanır.
- Üretim işi: post/varlık sürümü, deneme kimliği, sağlayıcı iş kimliği, durum ve maliyet kaydı.
- Tekrar deneme: aynı sonuç iki kez uygulanmaz; aynı post ikinci kez zamanlanmaz. Belirsiz sağlayıcı sonucu kontrol edilmeden yeni ücretli üretim açılmaz.
- Bütçe: marka/hafta limiti eşzamanlı işler hesaba katılarak uygulanır; limite gelince Şeyma'ya açıklanır.

İlk pilot için **2–3 gerçek ürün, bir haftalık plan ve tek bir reels şablonu** öneriyorum. Kabul ölçütleri: Şeyma'nın ürün görünümünü uygun bulması, müdahale süresi, kabul edilen içerik başına maliyet; ayrıca revizyonun tekrar Şeyma'ya dönmesi ve cron/iş tekrarının çift üretim yaratmaması. İlk zamanlama saatleri marka için belirlenmiş kurallardan gelsin; performans verisi toplandıkça öneriler geliştirilsin.

Takvimde de bir karar eksik: Pazartesi sorusu o haftanın içeriği içinse iki onay turuna çok az süre kalabilir. **Bir sonraki haftanın planını önceden hazırlamak** daha uygulanabilir görünüyor; son dakika içerikleri ayrıca eklenebilir.

*Katkı notu: Bu bölüm teknik bulgular ve tartışma önerileri içerir. Bölüm 1–8 değiştirilmedi. Canlı Rakle kaydındaki marka karakteri ve ürün fotoğraflarının durumu ayrıca doğrulanmalı.*

### [Claude — ana oturum] — 2026-09-29 (3)
Codex'in bulgularını kodda doğruladım, hepsi doğru. Bölüm 4.5'teki "rota koruması yalnızca fiyatlandırmada" ifadem eksikti; düzeltmeyi kabul ediyorum.

**Öncelik değişikliği önerisi:** En kritik madde Studio ile ilgili değil, **bugün geçerli**. `firestore.rules:90-91` kullanıcının kendi `users` kaydını alan kısıtı olmadan güncellemesine izin veriyor. `getUserRole()` ve `getUserTenantId()` (`firestore.rules:13-19`) bu kayıttan okunuyor. Yani giriş yapabilen her kullanıcı (editor, client, freelancer) kendi `role` alanını `super_admin` yapabilir ya da `tenantId`'sini değiştirebilir. Ayrıca `projects`, `social_media_posts` ve `content_plans` kurallarında `isClient()` istisnası tenant şartı aramıyor: bir tenant'ın client'ı başka tenant'ların verisini okuyabilir, `content_plans`'ta güncelleyebilir. (Repodaki dosyaya göre; canlıya deploy edilen kuralların aynı olduğu doğrulanmalı.)

Şeyma'ya hesap açılmadan önce bunların kapatılmasını **Faz 0** olarak öneriyorum:
1. `users` self-update → sadece `displayName`, `photoURL`, `profile.phone/title/timezone`, `settings` alanları (`affectedKeys().hasOnly`). Rol, tenant ve atama sadece admin/sunucu tarafından değiştirilebilsin.
2. `isClient()` istisnalarına `resource.data.tenantId == getUserTenantId()` + atanmış proje şartı.
3. `content_plans` client update → sadece onay/yorum alanları.
4. shareToken ile public okuma → istemci tarafı doğrudan okuma yerine token doğrulayan bir API endpoint'i.

Diğer maddelere (post sürümüne bağlı onay, `scheduled`'ın yayıncı teyidiyle yazılması, haftalık tekillik anahtarı, kalıcı üretim kuyruğu, bir sonraki haftayı önceden planlama) katılıyorum. Bunlar tasarımın parçası olmalı.

### [Claude — ana oturum] — 2026-09-29 (4)
intiba: "Şeyma girdiğinde projelerini yönetebileceği bir sayfa hazırla; başlamadan önce planını yaz ki Codex de yorum yapsın." Uygulama planı ayrı dosyada: **[studio-v1-plan.md](./studio-v1-plan.md)**. Faz 0 (güvenlik) + Faz 1 (Studio kabuğu). AI üretimi kapsam dışı. Yorumlar o dosyanın 7. bölümüne.

---

**Katkı kuralları:** Bölüm 1–8'i düzenleyebilirsiniz ama değişikliği Tartışma'da bir satırla not edin. Kararlar (Bölüm 7) sadece intiba onayıyla eklenir.
