# Studio — Marka Medya Kütüphanesi + Saatlik Takvim

> Durum: **Uygulandı, yerel testlerle doğrulandı; commit/deploy YOK** · 2026-10-08 · Yazan: Claude (ana oturum)
> Temel: [studio-v1-plan.md](./studio-v1-plan.md) (Bölüm 8) ve [studio-workflow-integration.md](./studio-workflow-integration.md)
> Gerçek Firebase/Storage/Meta/e-posta/AI çağrısı yapılmadı. Tüm testler mock veya yerel emülatör (`demo-*` proje) üzerinde.

## 1. Kullanıcı kararları (bağlayıcı)

| # | Karar |
|---|---|
| 1 | **Onay haftalık plan düzeyindedir.** Plan → Şeyma iç onay → firmaya plan onay isteği → müşteri onayı veya revize → yalnız müşteri onayından sonra Meta zamanlamasına uygun. Kütüphane dosyasında onay durumu yoktur. |
| 2 | **Marka başına tek paylaşım takvimi, ilk sürümde yalnız Instagram (Meta).** Kütüphane markanın mevcut sosyal medya `projectId`'si altında ortaktır. Yeni çoklu proje / `brandId` modeli yok. |
| 3 | **Yalnız paylaşılmaya hazır FINAL fotoğraf/video.** Storage + Firestore katalog. Ham dosya, Drive, ham–final bağı, çekim tarihi **yok**. Vercel Blob yok. |
| 4 | **Freelancer erişimi yok.** Mevcut ajans rolleri + atanmış `brand_manager`. Müşteri kütüphaneye doğrudan erişmez. |
| 5 | **Dosya başına 1 GB panel yükleme sınırı = `1_000_000_000` bayt** (ondalık, GiB değil). Meta sınırı değildir; Meta uygunluğu ayrı, kaynaklı kontrol. Dönüştürme yok. |
| 6 | **Çekim tarihi yok.** Tarih yalnız post'un `scheduledAt` / `publishedAt` alanı. |
| 7 | **(Ek kapsam) Haftalık GÜN + SAAT ızgarası** (Meta Business Suite mantığı): hücreye tıklama → o gün/saatle editör; kütüphaneden hücreye sürükle-bırak; içerik taşıma. **Onaylanan zaman veya içerik değişimi yeniden onay gerektirir** (önceki `scheduledAt` istisnası kapandı). Saat dilimi görünür ve tutarlı. |

## 2. Mevcut Şeyma → firma haftalık plan akışı (bu işten önce de vardı; korunur)

- Post durumları: `draft → internal_review → (internal_approve) pending_approval → client_approve: approved | client_reject: revision_requested`. Studio projelerinde iç inceleme zorunlu, onayda otomatik zamanlama yok (`contentApprovalServer` Studio politikası).
- **Kilit:** `pending_approval`, `approved`, `scheduled`, `published` durumundaki post'un metni/medyası istemciden değişmez (`firestore.rules` `isContentEditable`). Bu işle **zaman (`scheduledAt`) ve `libraryAssetIds` de kilide girdi.**
- **Revizyona al (`reopen`):** sunucu işlemi; post'lar `internal_review`'a döner, onay alanları temizlenir, plana **yeni `reviewRequestId`** yazılır.
- **Eski müşteri ekranı reddi:** müşteri kararı (`client_approve/reject/undo`) planın güncel `reviewRequestId`'sini taşımalı; uyuşmazsa `409 STALE_REVIEW`, sıfır yazma.
- **Yeni — `reschedule` (sunucu):** tek post + yeni zaman (epoch ms). `pending_approval/approved/scheduled` → `internal_review` + onaylar temizlenir + yeni `reviewRequestId` + plan onay alanları temizlenir (eski müşteri turu geçersiz). Onaya gitmemiş durumlarda yalnız zaman değişir (durum, revizyon sayacı ve notlar aynı kalır). `published`/`failed` reddedilir. Müşteri, atanmamış marka yöneticisi, başka tenant reddedilir.

### Kalan istisnalar / sınırlar (somut)
- **Sunucu (Admin SDK) kuralları atlar:** onay geçişleri yalnız `api/content-approval/*` ve motor üzerinden; motor doğrulaması tek garanti.
- **`gridPosition`** (Instagram ızgara sırası) kilitli içerikte de istemciden değişebilir (takvim zamanı değildir).
- **super_admin:** genel yetkisi korunur; bu işle **dar koruma** eklendi: post'ta durum/onay/tur/revizyon alanları ve kilitli post'un içerik+zaman alanları istemciden yazılamaz; onaylı post/plan oluşturulamaz; planda durum/tur/onay/atama alanları yazılamaz. Bunlar dışında super_admin'in mevcut erişimi (okuma, taslak düzenleme, silme, başka tenant) **değiştirilmedi**.
- **`brand_media` için super_admin dahil herkes** aynı tenant + yetkili proje kapsamındadır (Storage ile tutarlı).
- **Admin takvimi etkisi:** `admin/social-media/SocialMediaCalendar.tsx:385` "tarihi kaldır" (`scheduledAt: null`) kilitli (firmada/onaylı) post'ta artık kural tarafından reddedilir (hata konsola düşer). Taslaklarda çalışır. Admin tarafına `reschedule` arayüzü eklenmedi (kapsam Studio).

## 3. Uygulanan çözüm

### Veri ve kurallar
- **Firestore `brand_media/{assetId}`** — `firestore.rules`:
  - Okuma/oluşturma/güncelleme: `canUseLibrary` = aynı tenant + (`super_admin|admin|account_manager|staff|editor` veya **atanmış** `brand_manager`) + **proje var ve aynı tenant'a ait**. Freelancer, müşteri, anonim, başka tenant: red.
  - Oluşturma doğrulaması: alan listesi sabit; `status == 'active'`; `createdBy == uid`; `createdAt/updatedAt == request.time`; kimlikler `^[A-Za-z0-9_-]{1,128}$`; `storage.path == brand-media/{t}/{p}/{docId}/<dosya>` (thumb.jpg değil, `..` yok); `downloadUrl` **`https://firebasestorage.googleapis.com`** + aynı nesne yolu; tür–MIME uyumu; `storage.size` int, `> 0`, `<= 1000000000`; önizleme yolu ve URL'si birlikte ve aynı klasörde `thumb.jpg`.
  - Güncelleme: yalnız `title`, `tags`, `status`, `archivedAt`, `updatedAt`; silme yok (arşiv).
  - Bucket adı kurallarda bilinemez → istemci (seçici/liste) ve onay sunucusu bucket + nesne varlığı + token doğrular.
- **`social_media_posts`**: `libraryAssetIds` (liste, ≤ 10) eklendi; kilitli içerikte değişmez. Kilitli içerikte istemciden yalnız `gridPosition` değişebilir (**`scheduledAt` istisnası kaldırıldı**).
- **Storage `brand-media/{tenantId}/{projectId}/{assetId}/{fileName}`** — `storage.rules` `canUseBrandLibrary` (kullanıcı + proje dokümanı: istek başına 2 Firestore okuması): get/list/create yalnız yetkili ekip; create bir kez, `size <= 1000000000`, image/video; `thumb.jpg` yalnız `image/jpeg` ve ≤ 2 000 000 bayt; update/delete kapalı.
- **İndeksler** (`firestore.indexes.json`): `brand_media (tenantId, projectId, status, createdAt desc)`, aynısı + `tags CONTAINS`, `social_media_posts (tenantId, projectId, libraryAssetIds CONTAINS)` (array-contains ve array-contains-any).
- **Onay motoru**: `isTrustedMediaUrl` `brand-media/{tenantId}/{projectId}/` önekini kabul eder (nesne + token doğrulaması aynen sürer). Yeni `reschedule` işlemi (yukarıda).

### İstemci
- **Ortak**: `shared/types/brandMedia.ts` — sabitler (`LIBRARY_MAX_FILE_BYTES = 1_000_000_000`), ondalık boyut biçimi, etiket normalizasyonu, güvenli Storage adı (ardışık noktalar teke iner), `isConsistentAsset` (tenant/proje + klasör + **HTTPS resmi host + yapılandırılmış bucket**, ana dosya ve önizleme için), `assetToMediaItem`, `deriveLibraryAssetIds` (post'un `libraryAssetIds`'i her kayıtta medyadan türetilir → seç/çıkar/sırala sonrası tutarlı).
- **Instagram ön kontrolü**: `shared/social/instagramReadiness.ts` — kaynak: Meta "IG User Media" belgesi (https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media, okunma 2026-10-08; sayfada güncelleme tarihi yok). Akış görseli JPEG, ≤ 8 MB, 4:5–1,91:1; Reels MP4/MOV, 3 sn–15 dk, ≤ 300 MB, oran 0,01–10 (9:16 önerilir); hikâye videosu 3–60 sn, ≤ 100 MB; carousel ≤ 10 öğe. "MB" ondalık sayıldı (temkinli). **Carousel içi video şartı belgede yok → "doğrulanamadı".** Codec/FPS/ses ölçülemez → videolar hiçbir zaman "uygun" sayılmaz; eksik metadata "doğrulanamadı". Uyarılar bloklamaz.
- **Saat dilimi**: `shared/time/zonedTime.ts` — marka saat dilimi = tenant `settings.timezone` (geçerliyse), yoksa **`Europe/Istanbul` açıkça "varsayılan"** etiketiyle. Dönüşüm round-trip doğrulamalı: yaz saatine geçişte **var olmayan saat → null** (hücre kapalı, editör hata verir); kış saatine geçişte **iki kez yaşanan saat → deterministik olarak ilk an**; geçersiz tarih/saat → null.
- **Kütüphane sayfası** `/studio/:projectId/kutuphane` (`studio/pages/StudioLibraryPage.tsx`): yükleme kuyruğu (ilerleme, duraklat/devam, iptal, tekrar dene), tür/etiket/kullanım/arşiv filtreleri, ayrıntı (başlık/etiket, arşiv, Instagram ön kontrolü, kullanım geçmişi). Kullanım bilgisi **kesin sorguyla** (`array-contains-any`, 30'luk parçalar); alınamazsa "bilinmiyor" ve kullanılmış/kullanılmamış filtreleri kapalı.
- **Yükleme** (`studio/hooks/useLibraryUpload.ts`, `studio/library/uploadRunner.ts`, `mediaProbe.ts`): tarayıcıdan doğrudan Storage'a `uploadBytesResumable`, sırayla; dosya belleğe alınmaz (object URL); önizleme `thumb.jpg` ayrı dosya; katalog kaydı **yalnız dosya(lar) tamamlanınca**; tekrar denemede tamamlanan adımlar atlanır (yüklenmiş dosya yeniden yüklenmez; kayıt varsa ikinci kez yazılmaz).
- **Seçici** (`LibraryPicker`) ve **takvim çekmecesi** (`LibraryDrawer`): yalnız açık markanın, tutarlı ve aktif varlıkları; marka değişiminde eski liste/geç yanıt yok sayılır.
- **Post düzenleyici** (`StudioPostDetail`, `CreatePostPanel` yalnız `studioMode` kolu): "Kütüphaneden seç"; seçim kaydedilene kadar hiçbir yere yazılmaz; Studio'da platform Instagram'a sabit; içerik türleri `static/carousel/reels/story`; tarih/saat marka saat diliminde; Instagram ön kontrolü. Plan kartlarında kısa ön kontrol özeti.
- **Takvim** (`studio/components/CalendarBoard.tsx`, `studio/pages/StudioCalendarHome.tsx`): hafta = 24 saatlik ızgara (07:00'den görünür), ay görünümü korunur; saat dilimi etiketi; boş hücre tıklaması → o saatle editör; kütüphaneden hücreye bırakma → o saatle, dosya ekli editör; içerik taşıma: taslaklar istemciden yalnız `scheduledAt`, **kilitli içerik onay penceresiyle sunucu `reschedule`**; geçmiş ve var olmayan saatlere oluşturma/taşıma yok. Sayfa marka (tenant+proje) anahtarıyla yeniden kurulur + nesil koruması: eski yanıt, açık editör, taşıma penceresi ve seçim yeni markaya taşınmaz; bırakılan dosya ve taşınan post marka eşleşmesiyle ayrıca doğrulanır.

- **Haftalık plan oluşturma** (`studio/pages/StudioNewPlanPage.tsx`): hafta aralığı marka saat diliminde — Pazartesi günün ilk anı ile sonraki Pazartesi'nin ilk anı − 1 ms (`zonedWeekRange`). Varsayılan "gelecek hafta", seçilen günün Pazartesi'ye normalizasyonu, hafta içi taslakların ön seçimi, plan başlığı ve kaydedilen `weekStartDate`/`weekEndDate` aynı aralıktan; sayfada saat dilimi etiketi. Gece yarısı yaşanmayan günlerde (ör. America/Santiago 2026-09-06) günün ilk var olan anı kullanılır. Tarayıcının yerel saatinden bağımsız.

### Değişen / eklenen dosyalar
- Yeni: `shared/types/brandMedia.ts`, `shared/social/instagramReadiness.ts`, `shared/time/zonedTime.ts`, `studio/brandMediaData.ts`, `studio/library/{uploadRunner,mediaProbe,mediaPolicy}.ts`, `studio/hooks/useLibraryUpload.ts`, `studio/components/{LibraryPicker,LibraryDrawer,ReadinessNotice}.tsx`, `studio/pages/StudioLibraryPage.tsx`.
- Değişen: `firestore.rules`, `storage.rules`, `firestore.indexes.json`, `shared/approval/approvalEngine.ts`, `shared/services/contentApprovalApi.ts`, `api/content-approval/transition.ts`, `shared/types/socialMedia.ts`, `shared/services/socialMediaService.ts`, `admin/social-media/components/CreatePostPanel.tsx` (yalnız Studio kolu), `studio/{StudioApp,StudioLayout,studioData}.tsx|ts`, `studio/components/{CalendarBoard,StudioPostDetail,StudioPostCard}.tsx`, `studio/pages/{StudioCalendarHome,StudioPlanPage,StudioNewPlanPage}.tsx`.
- Testler (yeni): `tests/{brandMedia,instagramReadiness,libraryUploadRunner,zonedTime,approvalReschedule}.test.ts`, `tests/{studioLibraryPicker,studioPostDetailLibrary,useLibraryUpload,studioCalendarSlots,studioCalendarHome,studioLibraryPage,studioNewPlanPage}.test.tsx`, `tests/rules/brandMedia.rules.test.ts`. Güncellenen: `tests/rules/firestore.rules.test.ts` (eski "takvim yeri değişebilir" beklentisi yeni talimatla tersine çevrildi), `tests/rules/approvalServer.emulator.test.ts` (+2 senaryo).
- `StudioApp.tsx`, `StudioCalendarHome.tsx`'teki önceden commit edilmemiş değişikliklerin üzerine yalnız ekleme yapıldı.

## 4. Test kanıtı (2026-10-08, yerel)

| Komut | Sonuç |
|---|---|
| `npx vitest run tests/workflowRuntime.test.ts tests/workflowApi.test.ts tests/workflowStepForm.test.tsx tests/studioPostDetail.test.tsx tests/studioCalendarBoard.test.tsx tests/approvalEngine.test.ts tests/contentPlanAccess.test.ts` (önceki entegrasyon seti) | **97/97** |
| Yeni testler (12 dosya, yukarıdaki liste; plan haftası eklemesiyle) | **90/90** |
| `npx vitest run tests` (emülatörsüz tüm `tests/`) | **287 geçti, 93 atlandı** (76'sı emülatör testleri — aşağıda ayrı koşuldu; 17'si bu işle ilgisiz `odagi`/`exportAudience` entegrasyon testleri) |
| `firebase emulators:exec --only firestore,storage --project demo-rules-media "<node> ./node_modules/vitest/vitest.mjs run tests/rules --no-file-parallelism"` | **76/76** (firestore.rules 37, storage.rules 10, brandMedia.rules 23, approvalServer 6) |
| Hedefli `tsc` (değişen dosyalar, `allowSyntheticDefaultImports`) | Yeni hata yok; kalan tek uyarı önceden var olan `CreatePostPanel` `formatTimeForInput` kullanılmıyor. Global `tsc` repoda önceden var olan React import yapılandırma hataları nedeniyle kırmızı. |
| `vite build` (izole çıktı: scratchpad `outDir`, `copyPublicDir: false`) | **Başarılı** (yalnız önceden var olan büyük chunk uyarısı). `public/` (223 MB) kopyalanmadı ve repodaki `dist/` değiştirilmedi — disk %99 doluydu. |
| `esbuild api/content-approval/transition.ts` (build-api ayarları, scratchpad'e) | **Başarılı** |

Kapsanan senaryolar: 1 GB sınırı istemci + Firestore + Storage metin eşitliği ve `1_000_000_000` kabul / `1_000_000_001` red (Firestore kuralında ve istemcide sınır testi; **Storage kuralında gerçek 1 GB yükleme emülatörde yapılmadı**, sayı metin eşitliğiyle doğrulandı); tenant/proje/rol izolasyonu (freelancer, müşteri, anonim, atanmamış marka yöneticisi, başka tenant, olmayan proje, super_admin aynı/başka tenant); katalog–dosya tutarlılığı (host/bucket/HTTP/çift nokta/klasör/tür); kilitli içerikte medya/zaman değişmez ve `reschedule` ile iç incelemeye dönüş + yeni tur + eski müşteri ekranı `STALE_REVIEW`; kütüphane medyasının müşteriye açılması (nesne yoksa 409); yükleme duraklat/devam/iptal/tekrar dene; kayıt yazılırken iptal kabul edilmez; marka değişimi/unmount sonrası kayıt yazılmaz veya yeni markaya yansımaz; önizleme hatasında önizlemesiz kayıt; saat dilimi dönüşümleri, DST var olmayan/çift saat; hücre tıklama/bırakma/taşıma, geçmiş saat, farklı saat dilimi; takvimde eski marka yanıtı ve açık taşıma penceresi sızmaz (anahtar ve nesil koruması kaldırılınca bu iki testin kırıldığı mutasyonla doğrulandı).

**Plan haftası eklemesi (sonradan):** kurallara/sunucuya dokunmadığı için emülatör testleri ve `vite build` yeniden koşulmadı (disk %100 doluydu, ~157 MB boş); değişen dosyalarda hedefli `tsc` temiz. Yeni testin eski yerel-saat mantığını yakaladığı mutasyonla doğrulandı.

**Yerel UI QA (gerçek tarayıcı): yapılmadı.** İstemci Firebase yapılandırması yalnız canlı projeye bağlanıyor (emülatör bağlantısı yok); tarayıcıda giriş yapıp denemek canlı veri okuma/yazma demek. UI davranışı happy-dom DOM testleriyle doğrulandı; sürükle-bırak gerçek tarayıcıda (özellikle Safari) ve görsel yerleşim elle kontrol edilmeli.

**Ortam notu:** Bu makinede `npm run test:rules` npm betik kabuğu hatası verdi (`/bin/sh: --: invalid option`); Firebase CLI kendi Node 18'ini kullandığı için vitest doğrudan sistem Node'u (v22) ile çağrıldı (yukarıdaki komut). Emülatör günlüğü `firestore-debug.log` (gitignore'da) üretildi.

## 5. Bilinen sınırlar

- **Sayfalama yok:** kütüphane en yeni 200 kaydı listeler (arayüz yazar); kullanım geçmişi varlık başına ilk 50 (arayüz yazar). Etiket araması istemcide, yüklenen kayıtlar üzerinde.
- **Sahipsiz dosya:** yükleme tamamlanıp katalog kaydı yazılamazsa (veya kayıt öncesi iptal/sayfadan çıkış olursa) dosya Storage'da kalır; istemci silemez (write-once). Otomatik silme eklenmedi; temizlik ileride admin/sunucu işi. Başarısız/iptal edilen *yarım* yükleme nesne oluşturmaz.
- **Kayıt yazımı başladıktan sonra** (durum "Kaydediliyor") iptal kabul edilmez; marka değişse de kayıt tamamlanır ve kütüphanede görünür (yanlış "iptal edildi" denmez).
- **Sayfa yenilenirse** yarım yükleme baştan başlar (SDK oturumu kalıcı değil; arayüz uyarır).
- Önizleme üretilemezse (ör. tarayıcının çözemediği video kodeki) varlık önizlemesiz kaydedilir; metadata eksikse uygunluk "doğrulanamadı".
- Story karelerine kütüphaneden seçim eklenmedi (yalnız yükleme).
- Admin "tarihi kaldır" etkisi ve diğer istisnalar: Bölüm 2.

## 6. Canlıya geçiş bağımlılıkları (hepsi kullanıcı onayıyla)

1. Önceki Studio / Faz 0 / workflow işinin ve bu işin incelenip commit edilmesi (henüz commit yok).
2. Canlı kuralların repodaki önceki sürümle aynı olduğunun doğrulanması; ardından `firestore.rules`, `storage.rules`, `firestore.indexes.json` deploy'u (indeks oluşumu beklenmeli).
3. Storage → Firestore okuma izni (cross-service rules) canlıda açık olmalı; Storage kuralı artık proje dokümanını da okuyor.
4. Vercel'de `FIREBASE_STORAGE_BUCKET` (onay sunucusu medya politikası) ve istemcide `VITE_FIREBASE_STORAGE_BUCKET` tanımlı olmalı (yoksa kütüphane listesi boş — fail-closed).
5. Tenant `settings.timezone` ayarı istenirse girilmeli (yoksa Europe/Istanbul varsayılan gösterilir).
6. `brand_manager` kullanıcılarının markanın sosyal medya projesine atanmış olması.
7. 1 GB'lık dosyalar için Storage kota/maliyet kontrolü.
8. Gerçek tarayıcıda UI kabul turu (Bölüm 4) ve admin takvimindeki "tarihi kaldır" davranışının kabulü.
9. Meta yayını/zamanlaması ayrı faz; Instagram sınırları yayın öncesi Meta belgesinden yeniden doğrulanmalı.

## 7. Ayrı not (bu modülün işi değil)

Mevcut Drive katmanında: `api/drive/*` yalnız `withAuth` (rol/izin kontrolü yok); `api/drive/import.ts` kopya modunda `makePublic()`; `platform_accounts` (Drive token'ları) tüm iç rollere okunabilir. Ayrı sertleştirme işi.
