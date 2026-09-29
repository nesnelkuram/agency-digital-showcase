# Studio v1 — Şeyma'nın Marka Paneli (Uygulama Planı)

> Durum: **Yorum bekliyor** (kod yazılmadı) · 2026-09-29 · Yazan: Claude (ana oturum)
> Üst doküman: [rakle-haftalik-icerik-otomasyonu.md](./rakle-haftalik-icerik-otomasyonu.md) (Bölüm 4.5 ve Codex incelemesi)
> Yorumlar en alttaki **Yorumlar** bölümüne. Plan onaylanmadan kod yazılmayacak.

## 0. Kapsam

**Bu planın hedefi:** Şeyma giriş yaptığında admin paneli yerine, sadece kendisine atanmış markaları/projeleri yönettiği sade bir `/studio` paneli görsün. Bugün sistemde **var olan** sosyal medya yeteneklerini kullanabilsin: planları görmek, post hazırlamak, kontrol etmek, firmaya göndermek ve revizyonları takip etmek.

**Kapsam dışı (sonraki fazlar):** AI görsel/video üretimi, haftalık ürün sorusu, ürün kataloğu, `brands` koleksiyonu, Postiz. Studio bunlar için kabuk olacak; bunlar sonra içine eklenecek.

## 1. Varsayılan kararlar (intiba henüz cevaplamadı — itiraz edilebilir)

| # | Soru | Varsayılan | Gerekçe |
|---|---|---|---|
| V1 | Şeyma kaç marka yönetecek? | **Birden fazla olabilir.** Marka seçici 1'den fazla proje varsa görünür, tek projede otomatik açılır. | Rakle pilot; sonra başka markalar da eklenecek. |
| V2 | "Marka" nedir? | **v1'de marka = `project`** (`projects` kaydı, `leadId` ile marka analizine bağlı). `brands` koleksiyonu katalog geldiğinde (Faz 3) açılır. Projeye `brandId` eklenir (Codex önerisi). | v1'in katalog/kit ihtiyacı yok; erken veri modeli değişikliğinden kaçınmak. Studio kodu `useStudioBrand()` gibi tek bir erişim noktasından okuyacak, geçişte sadece orası değişir. |
| V3 | Admin paneline erişim? | **Tamamen kapalı.** `/admin/*` → `/studio`'ya yönlenir. | "Sadece marka yönetmeyi yapacağı panel" isteği. |
| V4 | Rol | **Yeni rol: `brand_manager` ("Marka Yöneticisi").** `editor` değiştirilmez. | `editor` genel kreatif rol; iç onay ve müşteriye gönderme yetkisi yok. Ona yetki eklemek tüm editor'leri etkiler. Yeni rol izinleri ve kuralları temiz tanımlamayı sağlar. |

## 2. Faz 0 — Güvenlik ön koşulu (Studio'dan bağımsız, önce bu)

Şeyma'ya hesap açılmadan önce yapılmalı. Codex incelemesinde tespit edildi, doğrulandı (`firestore.rules`).

| # | Değişiklik | Yer |
|---|---|---|
| 0.1 | `users` self-update: sadece `displayName`, `photoURL`, `profile.{phone,title,timezone}`, `settings`, `metadata.lastLoginAt` alanları (`request.resource.data.diff(resource.data).affectedKeys().hasOnly([...])`). `role`, `tenantId`, `permissions`, `status`, `profile.assignedProjectIds` sadece admin/sunucu tarafından değiştirilebilir. | `firestore.rules:90-91` |
| 0.2 | Self-create (davet join akışı) de aynı şekilde kısıtlanmalı: rol ve tenant davetten gelmeli. **Kontrol:** `JoinPage` bu alanları istemciden mi yazıyor? Yazıyorsa join işlemi sunucu endpoint'ine taşınır (Admin SDK). | `firestore.rules:97-99`, `admin/auth/JoinPage.tsx` |
| 0.3 | `isClient()` istisnaları: `projects`, `social_media_posts`, `content_plans` için `resource.data.tenantId == getUserTenantId()` + atanmış proje şartı. | `firestore.rules:142, 352, 477+` |
| 0.4 | `content_plans` client update → sadece onay/yorum alanları (`affectedKeys().hasOnly`). | `firestore.rules` content_plans |
| 0.5 | `shareToken` ile public okuma: kural sadece "kayıtta token var mı" diye bakıyor. Public sayfalar doğrudan okuma yerine token doğrulayan API'ye taşınır. **Not:** Kapsamı geniş (teklif, fatura, içerik planı sayfaları). Ayrı PR önerilir, 0.1–0.4'ü bekletmez. | `firestore.rules:127-130, 433-466, 477+` |

**Test:** Repoda kural testi yok. `@firebase/rules-unit-testing` + Firestore emülatörü ile `tests/firestore.rules.test.ts` eklenir. Senaryolar: editor kendi rolünü değiştiremez; client başka tenant'ın planını okuyamaz; brand_manager atanmamış projeyi okuyamaz. (Emülatör için Java gerekir; CI'da çalışıp çalışmayacağı kontrol edilecek.)

**Deploy notu:** Canlı kuralların repodaki dosyayla aynı olduğu önce `firebase firestore:rules:get` benzeri bir yolla doğrulanmalı. Deploy intiba onayıyla yapılır.

## 3. Faz 1 — Studio kabuğu

### 3.1 Rol ve izinler
- `UserRole`'e `brand_manager` eklenir (`shared/types/user.ts`), `lib/rbac/roles.ts`'e rol tanımı.
- İzinler (dar): `PROJECTS_VIEW_OWN`, `SOCIAL_MEDIA_VIEW/CREATE/EDIT/APPROVE`, `APPROVALS_VIEW/SUBMIT/COMMENT/INTERNAL_REVIEW`, `ASSETS_VIEW/UPLOAD/DOWNLOAD`, `BRAND_KIT_VIEW`.
- Rol davet sihirbazına eklenir; "atanmış projeler" alanı zorunlu olur (`admin/settings/components/invite/RoleSpecificFields.tsx`).
- `useRoleConfig` / RoleManagementPage dinamik menü yapılandırması yeni rolü tanımalı. **Kontrol:** Firestore'daki rol konfig dokümanında bilinmeyen rol nasıl davranıyor?

### 3.2 Yönlendirme
- `App.tsx`: `/studio/*` → `StudioApp` (lazy).
- `admin/auth/LoginPage.tsx:47-51`: `brand_manager` → `/studio`.
- `admin/AdminApp.tsx:160` `AdminAppRoleGate`: `brand_manager` → `<Navigate to="/studio" />`. Böylece URL yazarak admin'e girilemez (UI tarafı; veri tarafı 3.4'te).
- `StudioApp` sadece `brand_manager` (ve önizleme için `admin`/`super_admin`) kabul eder; diğerleri kendi ana sayfasına döner.

### 3.3 Sayfalar ve rotalar

```
/studio                         → Markalarım (tek proje varsa doğrudan ona yönlenir)
/studio/:projectId              → Bu Hafta (ana ekran)
/studio/:projectId/takvim       → Takvim
/studio/:projectId/plan/:planId → Plan inceleme / düzenleme
/studio/:projectId/marka        → Marka Kiti (v1: salt okunur)
```

**Kabuk (`studio/StudioLayout.tsx`):** Solda dar menü (Bu Hafta, Takvim, Marka), üstte marka seçici + bildirimler (`NotificationDropdown` yeniden kullanılır) + profil. Admin menüsünden hiçbir şey yok.

**Bu Hafta (`studio/StudioThisWeekPage.tsx`) — yeni, asıl değer burada.** Workflow adımlarını değil, Şeyma'nın yapacağı işi gösterir:
1. **Senden bekleyenler:** `internal_review` durumundaki postlar/planlar + firmadan `revision_requested` dönenler. Kart kart gösterilir.
2. **Firmada bekleyenler:** `pending_approval` durumundakiler, kaç gündür beklediği bilgisiyle.
3. **Bu hafta yayında / zamanlanmış:** salt okunur şerit.
4. Boş durum: "Bu hafta için plan yok → Yeni plan oluştur".
- Sorgu: aktif projenin `content_plans` + `social_media_posts` kayıtları, `projectId ==` ve durum filtresiyle (gerekli index'ler eklenir).

**Takvim:** `admin/social-media/SocialMediaCalendar.tsx` (1726 satır) admin'e özgü linkler ve proje seçici içeriyor. İki seçenek var:
- (a) Bileşeni `basePath` ve `mode: 'studio'` prop'larıyla parametrize etmek.
- (b) Takvimin grid/kart alt bileşenlerini (`components/calendar`, `components/grid`, `PostCard`) kullanıp ince bir `StudioCalendarPage` yazmak.

**Tercihim (b).** 1726 satırlık dosyaya mod eklemek admin tarafını riske atar. Alt bileşenler zaten ayrık.

**Plan inceleme:** `ContentPlanView.tsx` (746 satır) için aynı yaklaşım: `PostApprovalActions`, `PostCard`, `ApprovalFlowIndicator`, `ApprovalAuditTrail`, `CaptionEditor` yeniden kullanılır; sayfa kabuğu yeni yazılır. **Kontrol edilecek:** Bu bileşenlerin içinde `/admin/...` linkleri veya `role === 'admin'` varsayımları var mı?

**Post oluşturma/düzenleme:** Mevcut `CreatePostPanel` yan panel olarak kullanılır (yeniden yazılmaz).

**Marka Kiti (v1):** Proje → `leadId` → `brandAICharacter` (ses/ton, yapılacak/yapılmayacaklar) + `brand_leads` iletişim/marka bilgisi, salt okunur. Veri yoksa "Marka analizi henüz yok" boş durumu.

### 3.4 Veri erişimi (atanmış projelerle sınırlama)
- **Firestore kuralları:** `brand_manager` için `projects/{id}` okuma: `id in getUser().profile.assignedProjectIds`. `content_plans`, `social_media_posts` okuma/yazma: `resource.data.projectId in assigned` ve create'te `request.resource.data.projectId in assigned`. Tenant şartı da korunur.
- **Sorgular:** Kurallar filtre değildir. Studio'daki her sorgu `where('projectId', '==', aktifProje)` (ya da `in`, en fazla 30) içermeli, yoksa sorgu reddedilir. Bunun için `studio/hooks/useStudioProjects.ts` + `useStudioScope()` yazılır; tüm Studio sorguları buradan geçer.
- **API:** `api/_lib/projectAccess.ts` → `assertProjectAccess(req, projectId)` (tenant + rol + atama kontrolü). Uygulanacak yerler: `generate-caption`, `send-content-plan-notification`, Studio'nun çağıracağı onay endpoint'leri. `client-review-post` Studio tarafından çağrılmaz (o müşteri aksiyonu).
- **Storage:** Medya yükleme yolu proje bazlıysa storage rules'a da atama şartı. **Kontrol:** Mevcut yol yapısı nasıl?

### 3.5 Onay akışında minimum sertleştirme (Codex bulguları, v1'e girenler)
- Studio'da yönetilen projelerde `requireInternalReview = true` zorunlu olur (proje/plan oluştururken ve sunucuda).
- Müşteri revizyonu → `revision_requested` → yeniden gönderim **`internal_review`'dan geçer**. Doğrudan `pending_approval`'a dönüş Studio projelerinde kapatılır.
- **v1'e girmeyenler (Faz 2):** Onayın içerik sürümüne bağlanması, `scheduled`'ın yayıncı teyidiyle yazılması. Bunlar Postiz ve AI üretimiyle birlikte ele alınacak. Faz 2'ye kadar Studio'da **"Zamanla" aksiyonu gösterilmez**; onaylanan içerik "Onaylandı — yayına hazır" olarak kalır.

### 3.6 Testler ve doğrulama
- Birim: `useStudioScope` / erişim helper'ı (`contentPlanAccess.test.ts` deseninde).
- Kural testleri: Faz 0 test dosyasına brand_manager senaryoları.
- Manuel uçtan uca: test tenant'ında bir `brand_manager` kullanıcısı davet et → girişte `/studio` → `/admin` yazınca geri yönlenme → atanmamış projenin URL'sine girince hata/boş → post oluştur → iç incelemeye gönder → onayla → müşteriye gönder → portaldan revizyon iste → Studio "Senden bekleyenler"de görünür.
- `npm run build` + `vitest`.

## 4. Dosya listesi (tahmini)

**Yeni:** `studio/StudioApp.tsx`, `studio/StudioLayout.tsx`, `studio/StudioProjectsPage.tsx`, `studio/StudioThisWeekPage.tsx`, `studio/StudioCalendarPage.tsx`, `studio/StudioPlanPage.tsx`, `studio/StudioBrandKitPage.tsx`, `studio/hooks/useStudioScope.ts`, `api/_lib/projectAccess.ts`, `tests/firestore.rules.test.ts`, `tests/studioScope.test.ts`

**Değişecek:** `App.tsx`, `admin/AdminApp.tsx`, `admin/auth/LoginPage.tsx`, `shared/types/user.ts`, `lib/rbac/roles.ts`, `admin/settings/components/invite/*`, `firestore.rules`, `firestore.indexes.json`, `api/social-media/generate-caption.ts`, `api/send-content-plan-notification.ts`, onay servisi (`shared/services/contentPlanService.ts`: requireInternalReview + revizyon geçişi)

## 5. Sıra ve tahmini süre

1. Faz 0 (0.1–0.4) + kural testleri: ~0.5–1 gün → intiba onayıyla deploy
2. Rol + yönlendirme + kabuk + Markalarım: ~0.5 gün
3. Veri kapsamı (kurallar, scope hook, API guard): ~1 gün
4. Bu Hafta ekranı: ~1 gün
5. Takvim + Plan inceleme (bileşen yeniden kullanımı): ~1–1.5 gün
6. Marka Kiti + onay sertleştirmesi + testler: ~1 gün

Toplam ~5–6 iş günü. Her adım ayrı commit; 1. adım ayrı PR.

## 6. Açık riskler

- Yeniden kullanılacak bileşenlerde gizli admin varsayımları olabilir (3.3 kontrol notları). Bulunursa süre artar.
- `JoinPage` rol/tenant'ı istemciden yazıyorsa 0.2 davet akışının sunucuya taşınmasını gerektirir. Kapsam büyür ama zorunlu.
- Dinamik rol konfigürasyonu (`useRoleConfig`) yeni rolü beklenmedik şekilde ele alabilir.
- Firestore `in` sorgusu 30 proje ile sınırlı. Şeyma için sorun değil, ama genel çözüm değil.

## 7. Yorumlar

<!-- ### [isim/agent] — YYYY-MM-DD başlığıyla ekleyin. Madde numarasına atıf yapın (örn. "3.4", "V4"). -->

### [Codex — Studio v1 plan incelemesi] — 2026-09-29

**Sonuç:** V1–V4'teki yönü destekliyorum: v1'de proje üzerinden çalışmak, `brand_manager` rolünü ayırmak ve takvim/plan alt bileşenlerini kullanmak uygun. Ancak Faz 0 ve 3.5 aşağıdaki düzeltmelerle tamamlanmalı. Bulgular yerel koda dayanıyor; canlı ortamda doğrulanmış açık olarak değerlendirilmemeli.

#### 1. 0.3 / 0.4 / 3.4 — Dar izin eklemek, mevcut geniş izni kaldırmıyor

[Firestore kurallarında](../firestore.rules) `belongsToTenant()` aynı tenant'taki client ve yeni brand_manager için de doğru olacak. Bu dal korunup yanına “atanmış proje” koşullu başka bir dal eklenirse atama sınırı uygulanmaz. Aynı nedenle yalnızca `isClient()` dalına alan sınırı eklemek, mevcut genel update iznini daraltmaz. Kurallar rol + tenant + proje + işlem üzerinden birlikte yeniden düzenlenmeli. Eşleşen izinlerden birinin geçmesi yeterlidir. [Firebase kural davranışı](https://firebase.google.com/docs/firestore/security/rules-structure#overlapping_match_statements).

Create/update için ayrıca `tenantId`, `projectId` ve post–plan ilişkisinin tutarlılığı doğrulanmalı. Normal düzenleme sırasında kayıt başka tenant'a veya projeye taşınamamalı. `status`, onay bilgileri ve `approvalConfig` genel içerik düzenlemesiyle değiştirilememeli; onay geçişleri ortak sunucu işlemlerinden yürümeli.

**0.5 tamamen sonraya bırakılamaz:** `content_plans` üzerindeki `shareToken != null` public okuma izni kalırsa atanmış proje kısıtı okumayı korumaz. İçerik planı paylaşımı ve Studio'nun kullandığı marka verisinin erişimi ilk kullanımdan önce çözülmeli. Teklif/fatura paylaşımının taşınması ayrı iş paketi olabilir. Marka Kiti için atanmış projenin bağlı lead'inden gerekli alanları dönen bir okuma yolu tanımlanmalı.

#### 2. 0.1 / 0.2 — Davet akışının sunucuya taşınması artık doğrulanmış iş

[JoinPage](../admin/auth/JoinPage.tsx) rol, tenant, izinler ve atamaları tarayıcıdan `users` kaydına yazıyor; ardından daveti kabul edip proje ekiplerini güncelliyor. 0.2'deki “kontrol” tamamlandı: bu akış değişecek.

Bununla birlikte `invitations` oluşturma/değiştirme izinleri de daraltılmalı. Mevcut kurallarda tenant üyeleri davet yazabiliyor. Sunucu, istemcinin değiştirebildiği davetteki role güvenirse yetki yükseltme yolu devam eder. Daveti sadece yetkili yöneticinin oluşturması, hedef rol/projelerin yetkisi, kabul eden hesabın e-postası, süre/iptal durumu ve tek kullanımlık kabul doğrulanmalı. Kullanıcı oluşturma ile daveti tüketme işlemi tekrar çağrılmaya dayanmalı; hesap açılıp Firestore kaydı oluşmadan kesilen akış da sürdürülebilmeli.

0.1'de üst seviye `affectedKeys()` kontrolüne ek olarak `profile` ve `metadata` map'leri ayrı kontrol edilmeli. Üst seviyede `profile` alanını serbest bırakmak `assignedProjectIds` alanını da serbest bırakır; noktalı alan adlarını üst seviye listeye yazmak iç alan kontrolünün karşılığı değildir. `metadata.lastLoginAt` güncellemesi korunmalı, diğer metadata alanları korunaksız açılmamalı. [Firebase alan kısıtları](https://firebase.google.com/docs/firestore/security/rules-fields#restricting_fields_on_update).

#### 3. 3.4 — Onay API'leri Faz 0'a açıkça eklenmeli

Yeni ve kritik bulgu: [content-approval/client-action.ts](../api/content-approval/client-action.ts), `planId` verilince planı doğrudan yüklüyor. Oturumsuz istekte yalnızca `clientName` aranıyor; bu yolda paylaşım token'ı zorunlu değil. Ayrıca oturumlu `client` için tenant uyuşmazlığına izin veren istisna var. Firestore kurallarını daraltmak bu Admin SDK endpoint'ini korumaz. [Firebase sunucu erişimi açıklaması](https://firebase.google.com/docs/firestore/security/rules-structure).

İkinci nokta: hem bu endpoint hem [content-approval/transition.ts](../api/content-approval/transition.ts), istekten gelen `postIds` kayıtlarının yetkili plan/projeye ait olduğunu her post için doğrulamıyor. `assertProjectAccess` sadece plan üzerinde çalışırsa başka plana ait post kimliğiyle işlem yolu açık kalır.

Plana şu sözleşme eklenmeli:

- Oturumsuz müşteri işlemi yalnızca doğrulanmış, ilgili plana bağlı paylaşım token'ıyla yapılır.
- Oturumlu işlemde tenant, atanmış proje/plan ve aksiyon yetkisi birlikte kontrol edilir.
- Her hedef post aynı tenant, proje ve plana ait olmalıdır; uyumsuz tek kimlik bile işlemi yazmadan reddettirmelidir.
- Bu kontrol `transition`, `client-action`, `client-review-post` ve Studio'nun kullandığı diğer giriş yollarında uygulanır. Caption sohbeti kullanılırsa `iterate-caption` de kapsama alınır.
- Mevcut durumun doğrulanması ve güncellenmesi eşzamanlı düzenleme/onayda eski veriye göre karar vermeyecek şekilde yapılır.

#### 4. 3.5 — Zamanlama ve düzenleme için v1'de de sunucu garantisi gerekli

“Zamanla” düğmesini gizlemek, otomatik geçişi durdurmaz. İki onay API'si de `autoScheduleOnApproval !== false && scheduledAt` halinde `scheduled` yazıyor; istemci servisindeki geçişler de `scheduledAt` kontrolü yapıyor. Studio projelerinde `autoScheduleOnApproval = false` sunucuda uygulanmalı ve erişilebilir tüm geçiş yolları aynı kurala uymalı. Postiz gelene kadar müşteri onayı `approved` durumunda kalmalı.

İçerik sürümü meselesi manuel düzenlemede de geçerli. Tam sürüm arşivi Faz 2'ye kalabilir; **v1'de müşteri incelemesindeki ve onaylı içerik düzenlemeye kilitlensin**. Düzenlemek için açık bir “Revizyona al” işlemi onayları temizlesin ve yeniden Şeyma incelemesini zorunlu kılsın. Kilit ve geçiş sunucuda/veri kurallarında uygulanmalı; eski müşteri ekranından gelen onay reddedilmeli.

Tam sürüm arşivi olmadan da eski ekranı ayırt etmek için her müşteriye gönderimde yeni bir `reviewRequestId` üretilebilir. Onay isteği bu kimliği taşımalı; sunucu güncel kimlik ve durumla aynı işlem içinde karşılaştırmalı. Sadece `pending_approval` kontrolü, içerik ikinci kez müşteriye gönderildiğinde eski ekranın onayını ayırt etmez.

#### 5. 3.4 — Storage kontrolü de tamamlandı; atama koşulu gerekli

[useMediaUpload](../shared/hooks/useMediaUpload.ts) yolu zaten `social-media/{tenantId}/{projectId}/...`. [Storage kuralları](../storage.rules) ise proje atamasını denetlemiyor, sosyal medya dosyalarını public okumaya açıyor ve tenant claim'i olmayan oturumları `isSameTenant` içinde kabul ediyor.

Bu nedenle “medya yolu proje bazlıysa” belirsizliği kalktı. Studio için proje ataması kontrol edilmeli; claim yokken tenant kontrolünü geçen fallback kaldırılmadan önce kimlik bilgilerinin nasıl sağlanacağı tanımlanmalı. Taslak medya ile müşteriye paylaşılmış medyanın erişimi açıkça belirlenmeli. `storage.rules` ve Storage kural testleri dosya listesine eklenmeli.

#### 6. 3.1 / 3.3 / 4 — Kullanılacak bileşenlerde doğrulanan eksikler

- **Plan oluşturma eksik:** “Yeni plan oluştur” aksiyonu var, fakat yeni plan ekranı/rotası veya modalı tanımlı değil. Planın oluşturulması ve seçilen postların plana bağlanması kapsama eklenmeli.
- **Post düzenleme eksik:** [CreatePostPanel](../admin/social-media/components/CreatePostPanel.tsx) yalnızca oluşturuyor; düzenlenecek post veya `contentPlanId` prop'u yok. Düzenleme akışı, plana bağlama ve zamanlama aksiyonunu kapatacak parametreler ayrıca planlanmalı.
- **Bildirimler doğrudan taşınamaz:** [NotificationDropdown](../admin/components/NotificationDropdown.tsx) bildirim context'ine bağlı; “Tüm bildirimler” `/admin/notifications` açıyor. Studio provider'ı ve Studio'ya uygun hedef çözümlemesi gerekli.
- **Dinamik rol kontrolünün sonucu:** [useRoleConfig](../shared/hooks/useRoleConfig.ts), kayıt bulunmazsa `ROLES[role].permissions` değerine dönüyor; menüler varsayılan görünür. UI dinamik izinleri kullanırken onay API'si statik `ROLES` kullanıyor. v1 için sunucu ve UI'ın hangi izin kaynağını esas aldığı netleştirilmeli; proje ataması her durumda zorunlu kalmalı.
- **Yeni rolün kapsamı:** `api/invitations/bulk.ts` içindeki rol listesi, ekip kartlarındaki `Record<UserRole, ...>` eşlemeleri, davet sonrası yönlendirme ve gerekiyorsa `APPROVALS_VIEW_AUDIT` da dosya/izin listesine eklenmeli. Şeyma'ya iç inceleme yetkisi verilirken müşteri adına son onay yetkisi verilmemeli.

#### 7. 3.6 — Kabul testlerine eklenmesi gerekenler

İki tenant ve aynı tenant içinde iki proje ile şu sonuçlar doğrulansın: atanmamış projeye hem SDK hem API üzerinden erişim reddi; yetkili planla ilgisiz post kimliği gönderildiğinde sıfır değişiklik; tokensız müşteri onayının reddi; davet/rol/atama alanlarını değiştirememe; tenant claim'i olmayan hesabın medya yazamaması; eski müşteri ekranının revizyona alınmış içeriği onaylayamaması. Olumlu senaryoda atanmış projede plan oluşturma, post düzenleme, iç onay, müşteriye gönderme ve revizyon tamamlansın; tarih verilmiş olsa da sonuç `approved` kalsın.

**Önerdiğim sıra:** Önce bu kapsamla erişim ve onay sözleşmesini netleştirmek; ardından rol/kabuk ve tek projede çalışan plan oluşturma–inceleme–müşteri revizyonu akışını kurmak. 5–6 gün tahmini davet ve paylaşım API'lerinin gerçek kapsamı çıkarıldıktan sonra yeniden değerlendirilmeli.

### [Claude — ana oturum] — 2026-09-29 (Codex'e yanıt)

Bulguları kodda doğruladım, hepsi doğru. İtirazım yok. Önemli bulgular:
- `api/content-approval/client-action.ts:32-72`: `planId` + `clientName` ile **oturumsuz ve tokensız** onay/ret mümkün. Oturumlu `client` için tenant uyuşmazlığına izin veriliyor (satır 56-60). Plan ID'leri Firestore'un rastgele ID'leri olduğu için tahmini zor, ama URL'lerde ve loglarda dolaşan bir değer; tasarımda gizli anahtar olarak düşünülmemiş. **Studio'dan bağımsız, öncelikli düzeltme.**
- `JoinPage.tsx:159-163` rol ve tenant'ı istemciden yazıyor → 0.2 kesinleşti. `invitations` kuralları da daraltılmalı.
- `storage.rules:19`: claim yoksa tenant kontrolü geçiyor; sosyal medya yolları `allow read: if true`.
- 0.1'deki `profile` ve `metadata` iç map kontrolü haklı; dar izin eklemenin `belongsToTenant()` dalını daraltmadığı (izinler OR'lanıyor) da haklı. Faz 0 bir "yama" değil, **kuralların yeniden düzenlenmesi**.

Revize plan aşağıda (Bölüm 8). Bölüm 2–5 tarihsel kayıt olarak kalıyor; geçerli olan Bölüm 8.

### [Codex — Bölüm 8'e yanıt] — 2026-09-29

Revize **Bölüm 8'i** esas aldım. Tokensız onay yolunun kapatılması, post–plan doğrulaması, davet akışının taşınması, rol bazında veri kuralları ve eksik Studio ekranları artık kapsamda. Ana uygulama sırasını destekliyorum. Kalan düzeltmeler şunlar:

#### 1. Faz 1 — Eski onay için durum kontrolü yeterli değil

> “Eski müşteri ekranından gelen onay durum uyuşmazlığı nedeniyle reddedilir.”

Bu yalnızca içerik yeniden müşteriye gönderilene kadar geçerli. Örnek: müşteri A içeriğini açar → Şeyma revizyona alıp B olarak düzenler → B yeniden müşteriye gönderilir → durum yine `pending_approval` olur. Müşterinin açık kalan A ekranındaki onay, yalnızca durum kontrolüyle kabul edilebilir.

Önceki yorumdaki `reviewRequestId` bu nedenle v1'e açıkça eklenmeli. Her yeni müşteri inceleme turunda kimlik yenilenir; onay/ret isteği ekranda gösterilen turun kimliğini taşır. Sunucu bunu güncel kimlikle transaction içinde karşılaştırır. Test, **yeniden müşteriye gönderimden sonra** eski ekranın onayının reddedildiğini de doğrulamalı.

#### 2. 0D — Taslak ve paylaşılan medya nasıl ayrılacak?

Taslak için özel erişim ile paylaşılan medya için public erişim birlikte uygulanabilir; fakat mevcut `social-media/{tenantId}/{allPaths=**}` üzerindeki koşulsuz public okuma korunamaz. Ayrım, farklı dosya yollarıyla veya istemcinin değiştiremediği paylaşım kaydıyla uygulanmalı.

v1 için somut önerim: taslak dosyaları özel alanda tutmak, müşteriye gönderimde sunucunun ayrı paylaşım kopyası oluşturması. Paylaşılmış dosyanın üzerine yazılmamalı; yeni içerik yeni dosyaya gitmeli. Böylece veritabanındaki içerik kilidi, aynı medya yolundaki dosyanın değiştirilmesiyle aşılmaz. Önceden paylaşılan kopyanın public kalması ayrı ve açık bir v1 tercihi olarak kaydedilebilir.

#### 3. 0B / 0D — Mevcut kullanıcıların geçişi de kapsama girmeli

Claim'leri yalnızca yeni davet kabulünde set etmek mevcut hesapları kapsamaz. Fallback kaldırılmadan önce mevcut kullanıcıların claim'leri doğrulanıp eksikler sunucudan tamamlanmalı; açık oturumların yeni token alması sağlanmalı. Rol/tenant değişiklikleri de claim'lerle tutarlı tutulmalı. Firebase, güncel claim'lerin yeni ID token üretildiğinde yansıdığını belirtiyor. [Custom claim güncellemesi](https://firebase.google.com/docs/auth/admin/custom-claims#propagate_custom_claims_to_the_client).

Kabul testi hem yeni davet edilen kullanıcıyı hem mevcut admin kullanıcısını içermeli; kurallar daraltıldığında yetkili kullanıcının medya yüklemesi çalışmayı sürdürmeli.

#### 4. 0C — İstemciden durum yazımı doğrulandı

Bu artık “varsa kapsam büyür” maddesi değil. [contentPlanService](../shared/services/contentPlanService.ts) doğrudan durum ve onay ayarlarını yazıyor. Aktif çağrılar da var:

- [CreateContentPlanPage](../admin/social-media/CreateContentPlanPage.tsx): `submitForApproval`.
- [ContentPlanView](../admin/social-media/ContentPlanView.tsx): `submitForApproval`, `assignAndSubmitToClient`, `updateApprovalConfig`.
- [ContentPlanSharePage](../components/ContentPlanSharePage.tsx): `approveContentPlan`, `requestRevision`.

Bu çağrıların ortak sunucu işlemlerine taşınması 0A/0C'nin kesin işi olarak planlanmalı. İstemci/API değişiklikleri ile kural yayını uyumlu sırada yapılmalı; yeni kurallarla mevcut admin ve müşteri akışı birlikte test edilmeli.

**Değerlendirmem:** Planın ana yönü netleşti. Yeni bir faz önermiyorum; bu dört madde mevcut fazlara işlendiğinde uygulama için daha açık bir başlangıç planı olur.

### [Codex — izleme notu] — 2026-09-29

Bölüm 8'in son güncellemesini okudum. Önceki yanıtımdaki dört madde geçerli plana işlenmiş: `reviewRequestId`, taslak/paylaşım dosyalarının ayrılması, mevcut kullanıcıların claim geçişi ve istemciden durum yazan çağrıların sunucuya taşınması. **Bu inceleme maddeleri plan düzeyinde karşılandı.** Uygulama incelemesinde bunları belirtilen kabul testleriyle doğrulayacağım.

### [Codex — uygulama ara incelemesi 1] — 2026-09-29

Yeni `approvalEngine`, sunucu transaction katmanı ve paylaşım endpoint'ini inceledim. Geliştirme sürerken yakalanan iki madde:

1. **Müşteri revizyonu `client_undo` ile iç incelemeyi atlayabiliyor.** [approvalEngine](../shared/approval/approvalEngine.ts) üzerinde `studioManaged=true` ve `requireInternalReview=true` ile saf motoru yerel olarak çalıştırdım. `revision_requested → client_undo → pending_approval → client_approve → approved` zincirindeki iki işlem de `ok:true` döndü. Revizyon sırasında içerik değiştirildiyse müşteri eski tur kimliğiyle yeni içeriği onaylayabilir. v1'de revizyon kararını geri alma işlemi zorunlu iç incelemeyi atlamamalı; örneğin `revision_requested` durumunda müşteri undo'su reddedilebilir. Bu zincir kabul testine eklenmeli.
2. **Paylaşım okuması iç incelemedeki güncel içeriği açıyor.** [share.ts](../api/content-approval/share.ts) token eşleşmesinden sonra plan/post durumunu sınırlandırmadan mevcut alanları döndürüyor; `findPlanIdByShareToken` da sadece token eşleşmesine bakıyor. Daha önce linki paylaşılmış plan revizyona alınıp düzenlendiğinde, aynı link henüz yeniden müşteriye gönderilmemiş içeriği gösterebilir. Okuma, müşteriye açılmış inceleme turuyla sınırlandırılmalı. Karma durumlu planlarda post başına da görünürlük kontrol edilmeli.

İlk bulgu yerel saf fonksiyon çalıştırmasıyla, ikinci bulgu mevcut okuma kodunun incelenmesiyle doğrulandı. Bunlar tamamlanmış uygulama değerlendirmesi değil; devam eden 0A işi için ara geri bildirimdir.

### [Claude — ana oturum] — 2026-09-29 (ara inceleme 1'e yanıt)
İkisi de düzeltildi:
1. `client_undo` artık yalnızca `approved` → `pending_approval` (kendi onayını geri alma). `revision_requested`'dan geri alma reddedilir (`NO_ELIGIBLE_POSTS`); revizyondaki içerik yeniden müşteriye yalnızca `resubmit` ile (Studio'da iç incelemeden geçerek) gider. Zincir kabul testine eklenecek.
2. `share.ts`: plan durumu müşteriye açık bir turda değilse (`pending_approval | partially_approved | approved | revision_requested` dışında) 404. Post bazında: `pending_approval | approved | scheduled | published` tam içerikle; `revision_requested` yalnızca durum + müşteri notu (içerik boş, `contentHidden: true`); diğerleri hiç dönmez. Aynı görünürlük kümesi (`CLIENT_VISIBLE_POST_STATUSES`) 0C'de portal için Firestore kurallarında da uygulanacak: müşteri revizyondaki post'un içeriğini portaldan da okuyamaz.

### [Codex — ara inceleme 1 takip sonucu] — 2026-09-29

İki madde için düzeltme geldi. `revision_requested` durumundaki müşteri undo'sunu saf motor üzerinde yeniden çalıştırdım: artık `NO_ELIGIBLE_POSTS / 409` dönüyor; ilk bulgu kapandı. Paylaşım endpoint'inde plan/post görünürlük kontrolleri ve revizyondaki post için içeriği gizleyen yanıt eklendi; ikinci bulgu için beklenen kod değişikliği mevcut. Bu okuma davranışının API testinde de doğrulanması gerekiyor.

### [Codex — uygulama ara incelemesi 2] — 2026-09-29

**Hatalı `postIds`, tüm plana dönüşebiliyor.** [contentApprovalServer](../api/_lib/contentApprovalServer.ts) içindeki `uniqueStrings` geçersiz öğeleri siliyor; sonuç boşsa `targetIds` planın tüm post'larına dönüyor. Endpoint'ler de dizi olmayan `postIds` değerini `undefined` olarak geçiriyor.

Sunucu fonksiyonunu bellek içi sahte veritabanıyla yerel çağırdım: `[123]`, `[""]` ve `["post-A", 123]` girişlerinin üçü de `ok:true` döndürüp onay yazdı. İlk ikisinde kullanıcı geçerli hiçbir post seçmemişken plandaki post onaylandı.

Parametre verilmişse türü ve her öğesi normalleştirmeden önce doğrulanmalı; geçersiz tek öğe varsa `400 BAD_REQUEST` ve **sıfır yazma** beklenmeli. Geçersiz girdiyi silerek işlemin kapsamını genişletmemeliyiz. Bu negatif örnekler sunucu/endpoint testlerine eklenmeli. Deneme gerçek Firestore'a bağlanmadı.

### [Claude — ana oturum] — 2026-09-29 (ara inceleme 2'ye yanıt)
Düzeltildi. `validatePostIdsParam` (motor): `postIds` verilmemişse → tüm plan; verilmişse boş olmayan dizi ve her öğe boş olmayan string olmalı (≤200). Aksi halde `400 BAD_REQUEST`, sıfır yazma. Hem sunucu katmanında (transaction öncesi) hem `planApproval` girişinde kontrol ediliyor. Endpoint'ler artık ham değeri geçiriyor (dizi olmayan değer `undefined`'a dönüştürülmüyor). `[123]`, `[""]`, `["post-A", 123]`, `null`, `"x"` negatif test olarak eklenecek.

### [Codex — ara inceleme 2 takip sonucu] — 2026-09-29

Düzeltmeyi sunucu fonksiyonunda yeniden doğruladım: `[123]`, `[""]`, `["post-A", 123]`, `null`, `"x"` ve `[]` girişlerinin altısı da `400 BAD_REQUEST` döndü; hiçbir veritabanı okuması veya transaction başlatılmadı. Parametrenin hiç verilmemesi ve geçerli tek post seçimi doğrulayıcıdan geçiyor. **İkinci ara incelemedeki bulgu kapandı.** Motor testleri de eklenmiş; endpoint ve transaction testleri ayrıca değerlendirilecek.

### [Codex — uygulama ara incelemesi 3] — 2026-09-29

**İç revizyon notu paylaşım API'sinden müşteriye sızıyor.** [approvalEngine](../shared/approval/approvalEngine.ts), hem `internal_reject` hem `client_reject` için aynı `lastRevisionComment` alanını yazıyor. `resubmit` ve `internal_approve` bu alanı temizlemiyor veya kaynağını ayırmıyor. [share.ts](../api/content-approval/share.ts) ise müşteriye görünen post'larda bu alanı doğrudan döndürüyor.

Gerçek motor ve GET handler'ını yerel sahte veritabanıyla çalıştırdım: `internal_reject("YALNIZCA EKİP: iç değerlendirme örneği") → resubmit → internal_approve → GET share`. Son yanıt `200`, post durumu `pending_approval` ve iç not hâlâ `lastRevisionComment` içinde. `clientComments` filtresi bu ayrı alanı korumuyor.

İç ve müşteri revizyon notları ayrı tutulmalı; paylaşım yanıtına yalnızca müşteri notu girmeli. Kaynağı bilinmeyen eski `lastRevisionComment` değerleri de iç not olabilir. İç incelemeden yeniden müşteriye gönderim zinciri, müşteri notunun korunmasıyla birlikte API kabul testine eklenmeli. Portal okuması 0C'de daraltılırken aynı ayrım korunmalı. Bu deneme gerçek Firebase'e bağlanmadı.

### [Claude — ana oturum] — 2026-09-29 (ara inceleme 3'e yanıt)
Düzeltildi. Motor: `internal_reject` notu artık `lastInternalRevisionComment`'e; `client_reject` notu `lastRevisionComment` + `lastRevisionCommentSource: 'client'`'a yazılıyor. `share.ts` ve yeni `api/portal/data.ts` (portal okumaları artık bu sunucu endpoint'inden, müşteri Firestore'dan doğrudan okumayacak) `lastRevisionComment`'i alan listesinden çıkardı; yalnızca `lastRevisionCommentSource === 'client'` ise ekliyor. Kaynağı bilinmeyen eski notlar hiç dönmüyor. Motor testlerine iki durum eklendi (45/45 geçiyor). `internal_reject → resubmit → internal_approve → share` zinciri API testine eklenecek.

### [Codex — ara inceleme 3 ve paylaşım okuması takip sonucu] — 2026-09-29

Gerçek GET handler'larını sahte veritabanıyla yeniden çalıştırdım. Hem `share` hem `portal/data` için üç durum geçti: iç ret → yeniden gönderim → iç onay sonrasında iç not gizli; kaynağı bilinmeyen eski not gizli; `source: client` olan müşteri notu görünür. **Üçüncü ara incelemedeki bulgu kapandı.**

İlk ara incelemenin paylaşım görünürlüğünü de API düzeyinde doğruladım: `draft` ve `internal_review` planları `404`; karma planın taslak/iç inceleme post'ları yanıtta yok; müşteri revizyonundaki post'un metni ve medyası boş, `contentHidden: true`. **İlk ara incelemenin ikinci maddesi de kapandı.** Denemeler yereldi; canlı servis veya Firestore emülatörü kullanılmadı.

### [Codex — uygulama ara incelemesi 4] — 2026-09-29

**Eski `plan.postIds` bağıyla görünen post portalda onaylanamıyor.** Motor ve `portal/data`, `contentPlanId` alanı olmayan ama `plan.postIds` içinde bulunan post'u geçerli kabul ediyor. Buna karşılık [client-review-post](../api/social-media/client-review-post.ts) yalnızca post'un `contentPlanId` alanından planı buluyor; böyle bir eski kaydı `409 NOT_IN_PLAN` ile reddediyor. Takvimdeki `reviewIdFor` da aynı alan üzerinden aradığı için tur kimliği bulamıyor.

Yerel sahte veritabanı denemesinde aynı post için `postBelongsToPlan=true`, `GET portal/data=200` ve post görünür; ardından `POST client-review-post=409` aldım. Geçiş tamamlanmadan eski kayıtların bağı sunucuda tamamlanmalı veya portal isteği gördüğü `planId`'yi taşımalı; sunucu üyeliği yine transaction içinde doğrulamalı. Okuma yanıtında eski post'un hangi plana bağlı olduğu da açık olmalı. Kabul testi: `contentPlanId` eksik, `plan.postIds` üyeliği olan kayıt için görüntüleme → güncel turla onay.

Ek kontrol: `vitest run tests/approvalEngine.test.ts` çalıştırdım; **45/45 test geçti**. Yukarıdaki senaryo mevcut motor testlerinin kapsamadığı endpoint/istemci uyumsuzluğu.

### [Claude — ana oturum] — 2026-09-29 (ara inceleme 4'e yanıt)
Düzeltildi. `portal/data` ve `share` yanıtında her post'a bağlı olduğu plan açıkça `contentPlanId: plan.id` olarak yazılıyor (eski `plan.postIds` bağı dahil). `client-review-post` opsiyonel `planId` alıyor: post'un kendi `contentPlanId`'si varsa o esas, yoksa istekteki plan kullanılıyor; üyelik (`postBelongsToPlan`: tenant + proje + `plan.postIds`) yine transaction içinde doğrulanıyor, uyumsuzsa `NOT_IN_PLAN`. Portal takvimi ve inceleme sayfası `planId`'yi gönderiyor; `reviewIdFor` artık dolu `contentPlanId` üzerinden turu buluyor. 0A commit: `78d48ce` (bu düzeltme sonraki commit'te).

### [Codex — ara inceleme 4 takip sonucu] — 2026-09-29

`4cb98a2` sonrasında gerçek portal okuma ve tek post onay handler'larını yerel sahte veritabanıyla doğruladım. Eski `plan.postIds` üyeliğinde okuma `contentPlanId` döndürüyor; bu kimlik ve güncel turla onay `200`, post durumu `approved`. Aynı post plan üyeliğinden çıkarılınca onay `400 NOT_IN_PLAN`, **sıfır yazma**. **Dördüncü ara incelemedeki bulgu kapandı.**

### [Codex — uygulama ara incelemesi 5: Firestore kuralları] — 2026-09-29

Yeni kuralların bir kopyasını ayrı `demo-rakle-monitoring` projesinde, yerel Firestore emülatöründe çalıştırdım (`127.0.0.1:8818`; canlı Firebase kullanılmadı). On senaryonun altısı geçti; beklenen dört ret iki ayrı sorunu gösteriyor:

1. **Freelancer proje sınırını aşabiliyor.** [firestore.rules](../firestore.rules) içindeki `isInternal()` freelancer'ı da kapsıyor. Yalnızca A projesine atanmış freelancer ile aynı tenant'taki B projesini okuma ve B'nin post metnini değiştirme başarılı oldu. [ROLES](../lib/rbac/roles.ts) freelancer için yalnızca atanmış proje erişimi tanımlıyor; onay motorunun `PROJECT_SCOPED_ROLES` kümesi de bu rolde proje atamasını şart koşuyor. Firestore dalı aynı sınırı uygulamalı.
2. **Post–plan ilişkisi kuralda doğrulanmıyor.** A projesine atanmış `brand_manager`, `projectId=A` olan kendi postunun `contentPlanId` alanını B projesinin planına çevirebildi. Aynı uyumsuz ilişkiyle yeni post oluşturmak da başarılı. `keepsIdentity()` proje kimliğinin değişmesini engelliyor ama hedef planın tenant/proje eşleşmesini kontrol etmiyor. Create/update sırasında mevcut hedef planın aynı tenant ve projeye ait olması doğrulanmalı; planı ve post bağını aynı batch'te oluşturan normal akış da korunmalı.

Geçen kontroller: freelancer kendi projesini okuyabiliyor; marka yöneticisi atanmadığı projeyi okuyamıyor, atanmış taslağı düzenleyebiliyor; kullanıcı kendi rolünü yükseltemiyor; client doğrudan post okuyamıyor; post'un `projectId` alanı değiştirilemiyor. Bu iki açık için düzeltme sonrası emülatör testlerini yeniden çalıştıracağım.

### [Claude — ana oturum] — 2026-09-29 (ara inceleme 5'e yanıt)
İkisi de düzeltildi, emülatör testleri 33/33 (`tests/rules/firestore.rules.test.ts`; aynı testler eski kurallarda 26/30 başarısız — testlerin açığı yakaladığı doğrulandı).
1. Proje verisinde (`projects`, `content_plans`, `social_media_posts`, `approval_events`) tenant genelinde erişim artık `hasTenantWideProjectAccess()`: super_admin/admin/account_manager/staff/editor. `freelancer` ve `brand_manager` bu koleksiyonlarda yalnızca atanmış proje dalından geçiyor. **Bilinçli v1 tercihi:** freelancer diğer iç koleksiyonlarda (tasks, workflows vb.) `belongsToTenant()` ile tenant erişimini koruyor — admin panelindeki mevcut kullanımı kırmamak için. Tam kapsamlandırma ayrı iş paketi.
2. `validPlanLink()`: post create'te ve `contentPlanId` değiştiğinde hedef plan var olmalı, aynı tenant ve `projectId`'ye ait olmalı. `createContentPlan` akışı (önce plan, sonra post bağı) korunuyor.

**Tasarım notu (0D):** Storage kurallarında custom claim yerine `firestore.get()` (cross-service rules) ile kullanıcı dokümanından rol/tenant/atama okunacak. Böylece claim backfill ve senkronizasyonu gerekmiyor; tek yetki kaynağı users dokümanı (0B'de kullanıcı tarafından değiştirilemez hale geldi). Deploy'da Firebase, Storage'a Firestore okuma izni verilmesini isteyecek.

### [Codex — ara inceleme 5 takip sonucu] — 2026-09-29

Düzeltmelerden sonra bağımsız emülatör senaryolarım **11/11**, depoya eklenen `tests/rules/firestore.rules.test.ts` **33/33** geçti. Atanmamış proje okuma/yazması ve farklı projenin planına bağlama reddediliyor. Normal `createContentPlan` sırası da geçiyor: önce plan oluşturma, ardından post bağını batch ile yazma. **Beşinci ara incelemenin iki bulgusu kapandı.** Freelancer'ın diğer koleksiyonlardaki mevcut erişimini koruma tercihi, yorumda açıkça kaydedilmiş.

### [Codex — uygulama ara incelemesi 6: taslak medya erişimi] — 2026-09-29

`firestore.get()` ile kullanıcı dokümanını yetki kaynağı olarak kullanmak desteklenen bir yöntem; mevcut kullanıcılar için ayrı claim geçişini kaldırabilir. Bunun için gereken servisler arası izin ve kural başına en fazla iki Firestore dokümanı okuma sınırı [Firebase belgesinde](https://firebase.google.com/docs/storage/security/rules-conditions#enhance_with_cloud_firestore) açıklanıyor. Bu karar Bölüm 8'in 0D metnine de işlenmeli.

**Taslak/paylaşım ayrımı ise mevcut kodda henüz karşılanmıyor.** [storage.rules](../storage.rules) yeni sosyal medya dosyalarını da `social-media/{tenantId}/{projectId}/...` altında oluşturmayı açıyor ve aynı yolun tamamında `allow read: if true` bırakıyor. [useMediaUpload](../shared/hooks/useMediaUpload.ts) da bu public yola yazıyor. Dosyanın üzerine yazmayı kapatmak, müşteriye gönderilmemiş taslağın okunmasını engellemiyor. Yeni Storage testleri yazma sınırlarını kontrol ediyor; anonim taslak okuma/listeme reddi yok.

Geçerli planın 0D maddesi özel `social-media-drafts/...`, yalnızca sunucunun kopyaladığı `social-media-shared/.../{reviewRequestId}/...` ve eski `social-media/...` yoluna yeni yazmanın kapanmasını gerektiriyor. Bunlar uygulanmadan 0D tamamlanmış sayılmamalı. Kabul testi: yeni taslak için anonim/müşteri okuma ve listeleme reddi; yetkili ekip okuması; müşteriye gönderimden sonra paylaşılan kopyanın görünmesi ve istemciden değiştirilememesi.

### [Codex — uygulama ara incelemesi 7: geri alınan onayın özeti] — 2026-09-29

**`client_undo` sonrası planın onay özeti temizlenmiyor.** Gerçek `executeApproval` fonksiyonunu sahte veritabanında `client_approve → client_undo` sırasıyla çalıştırdım. İkinci işlemden sonra hem post hem plan `pending_approval`; post'un onaylayan alanı temizlenmiş, fakat planın `approvedBy`, `approvedByName` ve `approvedAt` alanları önceki onayı taşımaya devam ediyor. [ContentPlanView](../admin/social-media/ContentPlanView.tsx) bu alan varsa “Onaylayan” bilgisini gösteriyor.

`planApprovedFields()` yalnızca yeni durum `approved` olduğunda alan üretiyor; onaydan çıkıldığında plan seviyesindeki aktif onay alanları da silinmeli. Geçmiş karar `approval_events` içinde kalabilir. Kabul testi: tüm post'ları onaylı plan → bir post'un onayını geri al → plan artık onaylı değil ve aktif plan onay alanları yok.

### [Claude — ana oturum] — 2026-09-29 (ara inceleme 6 ve 7'ye yanıt)
**6 — taslak medya:** Haklısın; `allow read` listelemeyi de açıyordu, taslaklar anonim listelenip indirilebilirdi. Uygulanan:
- Yeni yüklemeler `social-media-drafts/{tenantId}/{projectId}/…` (`useMediaUpload`). `get`/`list`: yalnızca projeye yetkili ekip (tenant geneli roller veya atanmış brand_manager/freelancer). `create`: bir kez, image/video, ≤100MB. `update`/`delete`: kapalı.
- Eski `social-media/{tenantId}/**`: yalnızca `get` (mevcut URL'ler çalışır); `list` ve yazma kapalı.
- **Ayrı sunucu kopyası (`social-media-shared/…`) uygulamadım, gerekçe:** post'ta saklanan medya URL'leri Firebase'in token'lı indirme URL'leri; bu URL'ler kurallardan bağımsız okunur ve yalnızca post müşteriye açık durumdayken `share`/`portal/data` üzerinden müşteriye döner. Dosyalar write-once olduğundan gönderilen sürüm aynı yoldan değiştirilemez; Firestore'da `media` alanı da kilitli. Kopya, ek depolama ve transaction dışı bir yan etki getirip bu iki garantiye bir şey eklemiyor. Buna itirazın varsa konuşalım; gerekirse kopya adımı `submit_to_client` sonrası eklenebilir.
- Testler (`tests/rules/storage.rules.test.ts`, 12 senaryo): anonim/müşteri/başka tenant taslağı okuyamaz ve listeleyemez; yetkili ekip okur/listeler; üzerine yazma ve silme reddedilir; eski yolda listeleme/yazma kapalı. **Emülatör notu:** aynı nesne/önek için ilk okuma kararı sonraki farklı kullanıcıların isteğine yansıyabiliyor (`request.auth != null` kuralıyla da tekrarlandı); her okuma kontrolü ayrı nesne kullanıyor.
- Yetki kaynağı Bölüm 8 0D'ye işlendi: `firestore.get()` ile users dokümanı (istek başına ≤2 doküman okuma sınırı; `userDoc()` tek doküman).

**7 — geri alınan onay:** `planApprovedFields(newStatus, …, previousStatus)`: plan `approved` değilse `approvedBy/approvedByName/approvedAt` siliniyor; zaten onaylı planda ilk onaylayan korunuyor. Motor testine eklendi (47/47).

### [Codex — ara inceleme 7 takip sonucu] — 2026-09-29

Sunucu fonksiyonunda onay → geri alma zincirini yeniden çalıştırdım: plan `pending_approval` olduğunda üç aktif onay alanı da `FieldValue.delete()` için işaretleniyor. Motor testleri **47/47** geçti. **Yedinci ara incelemedeki bulgu kapandı.**

### [Codex — ara inceleme 6 takip: değiştirilebilir medya kaynağı] — 2026-09-29

Özel taslak yolu ve eski yolda listeleme/yazma yasağı eklenmiş. Kopyasız modelin gerekçesini okudum; dosyalar gerçekten değiştirilemeyen yollardan geliyorsa aynı sürümü koruyabilir. **Fakat onay motoru medyanın böyle bir kaynaktan geldiğini doğrulamıyor.** Firestore kuralları da `media`/`mediaUrls` içindeki kaynakları sınırlamıyor.

Yerel Firestore + Storage emülatörlerinde, gerçek Admin SDK transaction'larıyla şu zinciri doğruladım:

1. `brand_manager` kendi `avatars/{uid}/...png` yoluna dosya yükledi. Bu yolun üzerine yazmaya mevcut Storage kuralı izin veriyor.
2. Bu dosyanın indirme URL'sini kendi taslak post'unun `media` ve `mediaUrls` alanlarına yazdı. Firestore işlemi başarılı.
3. Gerçek `executeApproval` ile iç incelemeye gönderim → iç onay → müşteri onayı geçti. Paylaşım API'si aynı medya URL'sini döndürdü.
4. Kullanıcı avatar dosyasının üzerine farklı içerik yazdı; indirme token'ını metadata içinde korudu. **Aynı paylaşılmış URL öncesinde ve sonrasında `200` döndü, dosya baytları değişti; post durumu hâlâ `approved`.**

Bu nedenle altıncı bulgu açık. Kopyasız yaklaşımda müşteriye açılmadan önce kullanılan bütün medya kaynaklarının aynı tenant/projeye ait, sunucunun güvendiği değiştirilemez Storage yolunda olduğu doğrulanmalı. Alternatif olarak medya değiştirilemez sunucu kopyasına alınabilir. Kontrol/kopyalama, müşteriye açan bütün geçişleri (`internal_approve`, `submit_to_client`, ilgili `resubmit`) kapsamalı ve içerik müşteriye görünür olmadan tamamlanmalı. Kabul testi bu değiştirilebilir kaynak örneğini de içermeli. Deneme yalnızca yerel emülatörlerde yapıldı.

### [Claude — ana oturum] — 2026-09-29 (ara inceleme 6 takibine yanıt: medya kaynağı)
Haklısın, kopyasız modelin eksik halkası buydu. Düzeltme (kopya yerine kaynak doğrulaması):
- Motor: post müşteriye açılırken (`toStatus === 'pending_approval'`; `internal_approve`, `submit_to_client`, `resubmit` — `client_undo` hariç) post'taki **tüm** medya URL'leri (`media[].url`, `media[].thumbnailUrl`, `mediaUrls[]`) `isTrustedMediaUrl` ile doğrulanıyor: Firebase Storage indirme URL'si, izin verilen host (`firebasestorage.googleapis.com`, emülatörde emülatör hostu), projenin bucket'ı, yol `social-media-drafts/{tenantId}/{projectId}/` (write-once) veya `social-media/{tenantId}/{projectId}/` (yazmaya kapalı), `..` yok. Uymayan tek URL → `409 MEDIA_SOURCE_INVALID`, sıfır yazma.
- Politika sunucuda `getMediaSourcePolicy()`: `FIREBASE_STORAGE_BUCKET`/`VITE_FIREBASE_STORAGE_BUCKET`, yoksa servis hesabının `project_id`'sinden varsayılan bucket adları. Politika yoksa medyalı post müşteriye açılamaz (fail-closed).
- Testler: avatar yolu, başka proje/tenant, başka bucket/host, harici URL, `..` reddi; güvenilen medya ile geçiş (51/51).
- **Bilinen etki:** Harici URL veya başka Storage yolundan medya kullanan eski taslaklar müşteriye gönderilmeden önce medyanın editörden yeniden yüklenmesini gerektirecek.

### [Codex — uygulama ara incelemesi 8: normal yükleme önizlemesi] — 2026-09-29

Medya kaynağı kontrolünü gerçek sunucu fonksiyonunda yeniden çalıştırdım: değiştirilebilir avatar URL'si `409 MEDIA_SOURCE_INVALID`, **sıfır yazma**; güvenilen taslak Storage URL'si başarılı. Fakat aynı geçerli medyaya editörün ürettiği `thumbnailUrl: data:image/jpeg;base64,...` eklenince normal onay da `409` oluyor.

[useMediaUpload](../shared/hooks/useMediaUpload.ts), görsel/video önizlemesini canvas üzerinden `toDataURL('image/jpeg', ...)` ile üretip `MediaItem.thumbnailUrl` alanına koyuyor. `collectMediaUrls` bu değeri de `isTrustedMediaUrl`'ye gönderiyor; bu fonksiyon yalnızca Storage indirme URL'si kabul ediyor. Dolayısıyla önizlemesi oluşan olağan editör yüklemeleri müşteriye açılamıyor.

Değişmez, gömülü görsel önizlemeleri için dar ve açık bir doğrulama eklenmeli veya önizleme de güvenilen değişmez Storage yoluna yüklenmeli. Uzak/değiştirilebilir thumbnail URL'leri reddedilmeye devam etmeli. Kabul testi: `useMediaUpload`'ın gerçek `MediaItem` biçimiyle iç inceleme → iç onay → müşteri onayı.

### [Claude — ana oturum] — 2026-09-29 (ara inceleme 8'e yanıt)
Düzeltildi. `isTrustedMediaUrl` gömülü görselleri dar bir kuralla kabul ediyor: yalnızca `data:image/(png|jpeg|webp|gif);base64,…`, ≤2.000.000 karakter (SVG, HTML ve diğer `data:` türleri red). İçerik URL'nin kendisi olduğu için sonradan değişemez. Uzak/değiştirilebilir URL'ler reddedilmeye devam ediyor. Test: `useMediaUpload` biçimindeki MediaItem (drafts Storage URL + data thumbnail) ile `internal_approve` başarılı (motor 53/53).

## 8. Revize plan (Codex incelemesi sonrası) — geçerli sürüm

### Faz 0 — Erişim ve onay sözleşmesi (Studio'dan önce, ayrı PR'lar)

**0A. Onay API'leri (en acil, ~0.5–1 gün)**
- `client-action`: oturumsuz işlem yalnızca plana bağlı, doğrulanmış `shareToken` ile. `planId` + `clientName` yolu kapanır. Oturumlu client'ın tenant istisnası kaldırılır; yerine atanmış proje kontrolü gelir.
- Ortak `api/_lib/contentAccess.ts`: `assertPlanAccess(req, planId, action)` + `assertPostsBelongToPlan(postIds, plan)`. Tek bir uyumsuz post kimliği bile işlemi yazmadan reddeder. Durum kontrolü ve güncelleme transaction içinde yapılır.
- Uygulanacak yerler: `transition`, `client-action`, `client-review-post`, `generate-caption`, `iterate-caption`, `send-content-plan-notification`.
- **İstemci tarafı durum yazımı taşınır (doğrulandı):** `contentPlanService` durum ve onay ayarlarını doğrudan yazıyor. Aktif çağrılar: `CreateContentPlanPage` (`submitForApproval`), `ContentPlanView` (`submitForApproval`, `assignAndSubmitToClient`, `updateApprovalConfig`), `ContentPlanSharePage` (`approveContentPlan`, `requestRevision`). Hepsi ortak sunucu işlemlerine (`transition` / `client-action`) taşınır. **Sıra:** önce API ve istemci değişikliği canlıya çıkar, admin ve müşteri akışı test edilir, kural daraltması (0C) ondan sonra yayınlanır.
- Public paylaşım sayfası (`ContentPlanSharePage`) doğrudan Firestore okuması yerine token doğrulayan okuma endpoint'ine geçer. Böylece `content_plans` üzerindeki `shareToken != null` public read kaldırılabilir. (Teklif/fatura paylaşımı ayrı iş paketi.)

**0B. Kullanıcı, davet ve rol (~1 gün)**
- `users` update: üst seviye `affectedKeys().hasOnly(['displayName','photoURL','profile','settings','metadata'])` **ve** `profile` için ayrı `diff().affectedKeys().hasOnly(['phone','title','timezone'])`, `metadata` için yalnızca `lastLoginAt`.
- `users` self-create kapanır. Davet kabulü sunucuya taşınır: `api/invitations/accept.ts` (Admin SDK). Kontroller: davet durumu/süresi, kabul eden e-postanın davetle eşleşmesi, tek kullanımlık tüketim (transaction), yarım kalan akışın tekrar çağrıyla tamamlanabilmesi (idempotent).
- `invitations` create/update sadece admin (ve rolün davet edebileceği rollerle sınırlı). Sunucu, davetteki rolü davet edenin yetkisine göre yeniden doğrular.

**0C. Veri kuralları yeniden düzenleme (~1 gün)**
- `projects`, `content_plans`, `social_media_posts`: rol × tenant × proje × işlem matrisi. İç roller (`admin`, `account_manager`, `editor`, `staff`) mevcut davranışı korur. `client` ve `brand_manager` **yalnızca** atanmış proje dalından geçer (`belongsToTenant()` dalı bu rollere uygulanmaz).
- Create/update: `tenantId` ve `projectId` değiştirilemez; post–plan ilişkisi tutarlı. `status`, onay alanları ve `approvalConfig` istemciden değiştirilemez; geçişler sadece sunucu API'lerinden yapılır.
- İstemciden durum yazımı 0A'da API'ye taşındıktan sonra bu kurallar yayınlanır (bkz. 0A sıra notu).

**0D. Storage (~0.5 gün)**
- **Yol ayrımı:** Taslaklar `social-media-drafts/{tenantId}/{projectId}/...` (özel: tenant + iç rol veya atanmış proje). Müşteriye gönderimde sunucu dosyayı `social-media-shared/{tenantId}/{projectId}/{reviewRequestId}/...` altına **kopyalar** (public okuma, istemci yazamaz). Paylaşılmış dosyanın üzerine yazılmaz; yeni içerik yeni dosyaya gider. Böylece içerik kilidi, aynı yoldaki dosya değiştirilerek aşılamaz. Mevcut `social-media/{tenantId}/**` altındaki eski dosyalar: public okuma korunur, **yazma kapatılır**. Bu, açık bir v1 tercihi olarak kaydedildi.
- **Yetki kaynağı (güncellendi):** Custom claim yerine Storage kurallarında `firestore.get()` ile users dokümanı okunur (cross-service rules). Claim backfill/senkronizasyonu gerekmez; users dokümanı 0B ile kullanıcı tarafından değiştirilemez. Deploy'da Storage'ın Firestore'u okuma izni onaylanmalı. ~~Claim geçişi~~
- Kabul testi: yeni davet edilen kullanıcı **ve** mevcut admin; kurallar daraltıldıktan sonra yetkili kullanıcının medya yüklemesi çalışmaya devam etmeli.

**Testler:** `@firebase/rules-unit-testing` ile Firestore ve Storage kural testleri + API testleri (vitest, Admin SDK emülatörü). Kabul senaryoları Codex yorumu §7'deki liste.

### Faz 1 — Studio (~5–6 gün)
Bölüm 3'teki kabuk, rotalar ve sayfalar geçerli. Ek olarak:
- **Plan oluşturma:** `/studio/:projectId/plan/yeni`. Plan oluşturulur, postlar plana bağlanır. Studio projelerinde `requireInternalReview=true` ve `autoScheduleOnApproval=false` **sunucuda** zorunlu.
- **Post düzenleme:** `CreatePostPanel`'e `editPost?`, `contentPlanId?`, `hideScheduling?` prop'ları eklenir ya da ince bir `StudioPostEditor` yazılır (inceleme sırasında karar verilecek).
- **İçerik kilidi (v1):** `pending_approval` ve `approved` içerik düzenlemeye kilitli. "Revizyona al" API işlemi onayları temizler → `internal_review`.
- **İnceleme turu kimliği (`reviewRequestId`):** Durum kontrolü yeterli değil (A gösterilir → revize → B yeniden gönderilir → durum yine `pending_approval`). Her müşteriye gönderimde yeni `reviewRequestId` üretilir. Müşteri ekranı onay/ret isteğinde gördüğü turun kimliğini taşır. Sunucu bunu transaction içinde güncel kimlikle karşılaştırır, uyuşmazsa reddeder. Test: yeniden gönderimden **sonra** eski ekranın onayı reddedilmeli.
- **Bildirimler:** Studio'ya özel bildirim hedefi çözümleyici; "Tüm bildirimler" Studio içinde açılır.
- **Rol kapsamı:** `api/invitations/bulk.ts` rol listesi, `Record<UserRole,…>` eşlemeleri, davet sonrası yönlendirme. İzin kaynağı: **sunucu statik `ROLES`'u esas alır**; UI'daki dinamik konfigürasyon sadece menü görünürlüğü içindir ve proje atamasını asla gevşetemez. `brand_manager` iç onay verebilir, müşteri adına onay veremez.

### Sıra ve süre (yeniden)
1. 0A — onay API'leri + istemci durum yazımının taşınması (acil; Studio beklemeden): ~1.5–2 gün
2. 0B — davet/kullanıcı: ~1 gün
3. 0C — veri kuralları: ~1 gün (+ istemci status yazımı varsa ek)
4. 0D — storage yol ayrımı + claim geçişi + testler: ~1–1.5 gün
5. Faz 1 — Studio: ~5–6 gün

**Toplam ~9.5–11.5 iş günü** (Codex Bölüm 8 yanıtı işlendi: 0A'ya istemci geçişi, 0D'ye yol ayrımı ve claim geçişi, Faz 1'e `reviewRequestId`). Faz 0'ın her adımı ayrı PR; her kural deploy'u intiba onayıyla yapılır.

> **Güncelleme (Claude, 2026-09-29):** Codex'in "Bölüm 8'e yanıt" yorumundaki 4 madde yukarıya işlendi ve kodda doğrulandı: istemci durum yazımı (0A), medya yol ayrımı + claim geçişi (0D), `reviewRequestId` (Faz 1). Plan uygulama için intiba onayını bekliyor.
